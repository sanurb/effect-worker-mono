/**
 * Cloudflare Bindings Bridge
 *
 * Shared ServiceMap.Reference bridge for providing Cloudflare's `env` and
 * `ExecutionContext` to Effect handlers. Extracted from app-level duplication
 * so every Cloudflare Worker app can reuse the same bridge.
 *
 * @module
 */
import { Effect, ServiceMap } from "effect";

/**
 * ExecutionContext interface for Cloudflare Workers.
 */
export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * Reference holding the current request's Cloudflare environment bindings.
 */
export const currentEnv = ServiceMap.Reference<unknown>("@repo/cloudflare/currentEnv", {
  defaultValue: () => null,
});

/**
 * Reference holding the current request's ExecutionContext.
 */
export const currentCtx = ServiceMap.Reference<WorkerExecutionContext | null>(
  "@repo/cloudflare/currentCtx",
  { defaultValue: () => null },
);

/**
 * Set Cloudflare bindings for the scope of an effect.
 *
 * Call at the request boundary in your Worker's fetch handler:
 *
 * ```typescript
 * const services = pipe(
 *   ServiceMap.make(currentEnv, env),
 *   ServiceMap.add(currentCtx, ctx)
 * )
 * return handler(request, services)
 * ```
 *
 * Or use this helper for the older FiberRef-style bridge:
 *
 * ```typescript
 * const effect = handleRequest(request).pipe(
 *   withCloudflareBindings(env, ctx),
 * )
 * ```
 */
export const withCloudflareBindings =
  (env: unknown, ctx: WorkerExecutionContext) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.provideService(currentEnv, env), Effect.provideService(currentCtx, ctx));

/**
 * Schedule a background task that runs after the response is sent.
 *
 * Uses ctx.waitUntil() to keep the Worker alive while the effect runs.
 * Errors are logged but don't affect the response.
 */
export const waitUntil = <A, E>(effect: Effect.Effect<A, E>): Effect.Effect<void> =>
  Effect.gen(function* () {
    const ctx = yield* currentCtx;
    if (ctx === null) return;
    const services = yield* Effect.services<never>();
    ctx.waitUntil(
      Effect.runPromiseWith(services)(
        effect.pipe(
          Effect.tapCause(Effect.logError),
          Effect.catch(() => Effect.void),
        ),
      ),
    );
  });
