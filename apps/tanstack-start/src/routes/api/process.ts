/**
 * Process API Route
 *
 * Demonstrates Effect-TS in a standard API route pattern.
 * POST JSON data, process with Effect, return Response.
 */
import { ValidationError } from "@repo/domain";
import { createFileRoute } from "@tanstack/react-router";
import { DateTime, Effect, Match, Option, Schema as S } from "effect";

import { effectRuntimeMiddleware } from "@/server/middleware";

import { ProcessingError } from "./errors";

// ============================================================================
// Request/Response Schemas
// ============================================================================

const ProcessRequestSchema = S.Struct({
  items: S.Array(
    S.Struct({
      id: S.String,
      value: S.Number,
    }),
  ),
  operation: S.Literals(["sum", "average", "max", "min"] as const),
});

type ProcessRequest = S.Schema.Type<typeof ProcessRequestSchema>;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Best-effort description of an unknown thrown value. Replaces scattered
 * `x instanceof Error ? x.message : fallback` ternaries with one Match-based
 * helper.
 */
const describeThrowable = (error: unknown, fallback: string): string =>
  Match.value(error).pipe(
    Match.when(Match.instanceOf(Error), (e) => e.message),
    Match.orElse(() => fallback),
  );

// ============================================================================
// Effect Programs
// ============================================================================

const parseRequestBody = (request: Request) =>
  Effect.tryPromise({
    try: () => request.json(),
    catch: () => new ValidationError({ message: "Invalid JSON body", errors: [] }),
  });

const validateRequest = (body: unknown) =>
  S.decodeUnknownEffect(ProcessRequestSchema)(body).pipe(
    Effect.mapError(
      (error) =>
        new ValidationError({
          message: "Invalid request",
          errors: String(error)
            .split("\n")
            .filter((line) => line.length > 0),
        }),
    ),
  );

/**
 * Reduces the requested aggregate (sum/average/max/min) over a list of
 * numeric cell values. Pure — no Effect involvement; the caller decides
 * how to wrap the result.
 */
const aggregate = (values: ReadonlyArray<number>, operation: ProcessRequest["operation"]): number =>
  Match.value(operation).pipe(
    Match.when("sum", () => values.reduce((a, b) => a + b, 0)),
    Match.when("average", () => values.reduce((a, b) => a + b, 0) / values.length),
    Match.when("max", () => Math.max(...values)),
    Match.when("min", () => Math.min(...values)),
    Match.exhaustive,
  );

const processItems = Effect.fn("processItems")(function* (
  items: ProcessRequest["items"],
  operation: ProcessRequest["operation"],
) {
  // Fail loudly on empty input instead of returning a meaningless aggregate.
  const values = yield* Option.match(
    Option.liftPredicate(items, (arr) => arr.length > 0),
    {
      onNone: () => Effect.fail(new ProcessingError({ message: "Cannot process empty array" })),
      onSome: (arr) => Effect.succeed(arr.map((item) => item.value)),
    },
  );

  yield* Effect.log("Processing items").pipe(
    Effect.annotateLogs({ operation, count: values.length }),
  );

  return aggregate(values, operation);
});

// ============================================================================
// Response Helpers
// ============================================================================

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errorResponse = (error: string, status = 400) =>
  jsonResponse({ success: false, error }, status);

// ============================================================================
// Route Definition
// ============================================================================

export const Route = createFileRoute("/api/process")({
  server: {
    middleware: [effectRuntimeMiddleware],
    handlers: {
      /**
       * GET /api/process
       * Returns API info and usage example
       */
      GET: async () =>
        jsonResponse({
          name: "Effect Process API",
          description: "Process data using Effect pipelines",
          usage: {
            method: "POST",
            contentType: "application/json",
            body: {
              items: [
                { id: "a", value: 10 },
                { id: "b", value: 20 },
              ],
              operation: "sum | average | max | min",
            },
          },
          example: {
            request: {
              items: [
                { id: "a", value: 10 },
                { id: "b", value: 20 },
                { id: "c", value: 30 },
              ],
              operation: "sum",
            },
            response: {
              success: true,
              result: 60,
              operation: "sum",
              itemCount: 3,
            },
          },
        }),

      /**
       * POST /api/process
       * Process items with the specified operation
       */
      POST: async ({ request, context }) =>
        context.runEffect(
          Effect.gen(function* () {
            // Parse JSON body
            const body = yield* parseRequestBody(request);

            // Validate against schema
            const data = yield* validateRequest(body);

            // Process the data
            const result = yield* processItems(data.items, data.operation);

            yield* Effect.log("Completed aggregate").pipe(
              Effect.annotateLogs({ operation: data.operation, result }),
            );

            const now = yield* DateTime.now;
            return jsonResponse({
              success: true,
              result,
              operation: data.operation,
              itemCount: data.items.length,
              processedAt: DateTime.formatIso(now),
            });
          }).pipe(
            // Handle validation errors (400)
            Effect.catchTag("ValidationError", (error) =>
              Effect.succeed(errorResponse(error.message, 400)),
            ),
            // Handle processing errors (422)
            Effect.catchTag("ProcessingError", (error) =>
              Effect.succeed(errorResponse(error.message, 422)),
            ),
            // Handle unexpected errors (500)
            Effect.catchDefect((defect) =>
              Effect.succeed(
                errorResponse(describeThrowable(defect, "Internal server error"), 500),
              ),
            ),
          ),
        ),
    },
  },
});
