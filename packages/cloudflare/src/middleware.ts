/**
 * Middleware Building Blocks
 *
 * Shared Effect programs that an app-level middleware implementation composes
 * over its transport-specific tag (HTTP or RPC). The previous factory API
 * produced Layers via `as unknown as S` widening — that cast silenced a real
 * type mismatch between a single-arg effect function and the two-arg
 * middleware service contract. This module instead exports the *inner*
 * effect programs and lets each app wire them through `tag.of(...)` in its
 * own `services/middleware.ts`, where the tag's service shape is concrete
 * and no cast is needed.
 *
 * @module
 */

import { DatabaseConnectionError, PgDrizzle, makeDrizzle } from "@repo/db";
import { Context, Effect, Option, type Scope } from "effect";

import { currentEnv, currentCtx, type WorkerExecutionContext } from "./bindings";
import { CloudflareBindingsError } from "./errors";

// ============================================================================
// CloudflareBindings service tag
// ============================================================================

/**
 * CloudflareBindings service — provides access to Cloudflare env/ctx.
 *
 * This is the contract service that middleware "provides" to handlers.
 */
export class CloudflareBindings extends Context.Service<
  CloudflareBindings,
  { readonly env: unknown; readonly ctx: WorkerExecutionContext }
>()("@repo/cloudflare/CloudflareBindings") {}

// ============================================================================
// Bindings middleware effect
// ============================================================================

/**
 * Wraps an Effect in Cloudflare bindings resolution: reads `currentEnv` /
 * `currentCtx` from the request-scoped References, fails with
 * `CloudflareBindingsError` if the request entrypoint never set them, or
 * otherwise provides `CloudflareBindings` to the inner effect.
 *
 * Apps compose this into their HTTP or RPC middleware tag via
 * `tag.of((effect, _options) => provideBindings(effect))`.
 */
export const provideBindings = Effect.fn("cloudflare.provideBindings")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>,
) {
  const env = yield* currentEnv;
  const ctx = yield* currentCtx;

  return yield* Option.match(Option.all([Option.fromNullishOr(env), Option.fromNullishOr(ctx)]), {
    onNone: () =>
      new CloudflareBindingsError({
        message:
          "Cloudflare bindings not available. Ensure withCloudflareBindings() wraps the handler.",
      }),
    onSome: ([resolvedEnv, resolvedCtx]) =>
      effect.pipe(
        Effect.provideService(CloudflareBindings, {
          env: resolvedEnv,
          ctx: resolvedCtx,
        }),
      ),
  });
});

// ============================================================================
// Database middleware effect
// ============================================================================

/**
 * Wraps an Effect in PgDrizzle provision: reads `currentEnv` from the
 * request-scoped Reference, derives a connection string via the caller's
 * extractor, opens a scoped PgDrizzle, and provides it to the inner effect.
 *
 * Any failure in the resolution or connection phase is mapped to
 * `DatabaseConnectionError` so the transport layer sees a single typed
 * failure.
 */
export const provideDatabase: <A, E, R>(
  getConnectionString: (env: unknown) => string,
  effect: Effect.Effect<A, E, R>,
) => Effect.Effect<A, E | DatabaseConnectionError, Exclude<R, PgDrizzle> | Scope.Scope> =
  Effect.fnUntraced(function* <A, E, R>(
    getConnectionString: (env: unknown) => string,
    effect: Effect.Effect<A, E, R>,
  ) {
    const env = yield* currentEnv;
    const resolvedEnv = yield* Option.match(Option.fromNullishOr(env), {
      onNone: () =>
        Effect.fail(
          new DatabaseConnectionError({
            message:
              "Cloudflare env not available. Ensure withCloudflareBindings() wraps the handler.",
          }),
        ),
      onSome: Effect.succeed,
    });
    const db = yield* makeDrizzle(getConnectionString(resolvedEnv));
    return yield* effect.pipe(Effect.provideService(PgDrizzle, db));
  }, Effect.mapError(
    () =>
      new DatabaseConnectionError({
        message: "Database connection failed",
      }),
  ));
