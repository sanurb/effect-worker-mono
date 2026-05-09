/**
 * Example Effect Server Function
 *
 * Demonstrates how to use Effect in TanStack Start server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { DateTime, Effect, Schema as S } from "effect";

import { effectRuntimeMiddleware } from "../middleware";

/**
 * Base function with Effect runtime middleware.
 * All functions that need Effect should extend from this.
 */
const effectFunction = createServerFn().middleware([effectRuntimeMiddleware]);

/**
 * Validation helper using Effect Schema
 */
const validateWith =
  <A, I>(schema: S.Schema<A, I>) =>
  (input: unknown): A =>
    S.decodeUnknownSync(schema)(input);

/**
 * Request schema
 */
const GreetingRequestSchema = S.Struct({
  name: S.String.pipe(S.check(S.isMinLength(1)), S.check(S.isMaxLength(100))),
});

/**
 * Example server function using Effect.
 *
 * @example
 * ```typescript
 * const result = await greetingFunction({ data: { name: "World" } })
 * console.log(result.message) // "Hello, World!"
 * ```
 */
export const greetingFunction = effectFunction
  .inputValidator(validateWith(GreetingRequestSchema))
  .handler(({ data, context }) =>
    context.runEffect(
      Effect.gen(function* () {
        const greeting = context.env.MY_VAR || "Hello";
        yield* Effect.log("Processing greeting").pipe(Effect.annotateLogs({ name: data.name }));
        const now = yield* DateTime.now;
        return {
          message: `${greeting}, ${data.name}!`,
          timestamp: DateTime.formatIso(now),
        };
      }),
    ),
  );
