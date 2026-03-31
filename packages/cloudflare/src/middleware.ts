/**
 * Middleware Factories
 *
 * Generic factories that produce middleware Layer implementations.
 * Each factory encapsulates the shared "read from ServiceMap.Reference,
 * null-check, provide service" pattern that was copy-pasted across apps.
 *
 * @module
 */
import { Effect, Layer, ServiceMap } from "effect"
import { CloudflareBindingsError, DatabaseConnectionError } from "@repo/domain"
import { PgDrizzle, makeDrizzle } from "@repo/db"
import { currentEnv, currentCtx, type WorkerExecutionContext } from "./bindings"

/**
 * CloudflareBindings service — provides access to Cloudflare env/ctx.
 *
 * This is the contract service that middleware "provides" to handlers.
 */
export class CloudflareBindings extends ServiceMap.Service<
  CloudflareBindings,
  { readonly env: unknown; readonly ctx: WorkerExecutionContext }
>()("@repo/cloudflare/CloudflareBindings") {}

// ---------------------------------------------------------------------------
// Shared effects used by factories
// ---------------------------------------------------------------------------

/**
 * Core bindings middleware effect — read env/ctx, null-check, provide.
 */
const bindingsMiddlewareEffect = (effect: Effect.Effect<any, any, any>) =>
  Effect.gen(function* () {
    const env = yield* currentEnv
    const ctx = yield* currentCtx

    if (env === null || ctx === null) {
      return yield* Effect.fail(
        new CloudflareBindingsError({
          message:
            "Cloudflare bindings not available. Ensure withCloudflareBindings() wraps the handler."
        })
      )
    }

    return yield* effect.pipe(
      Effect.provideService(CloudflareBindings, { env, ctx })
    )
  })

/**
 * Core database middleware effect — read env, create connection, provide.
 */
const databaseMiddlewareEffect = (
  getConnectionString: (env: unknown) => string
) =>
  (effect: Effect.Effect<any, any, any>) =>
    Effect.gen(function* () {
      const env = yield* currentEnv
      if (env === null) {
        return yield* Effect.fail(
          new DatabaseConnectionError({
            message:
              "Cloudflare env not available. Ensure withCloudflareBindings() wraps the handler."
          })
        )
      }

      const db = yield* makeDrizzle(getConnectionString(env))

      return yield* effect.pipe(Effect.provideService(PgDrizzle, db))
    }).pipe(
      Effect.catch(() =>
        Effect.fail(
          new DatabaseConnectionError({
            message: "Database connection failed"
          })
        )
      )
    )

// ---------------------------------------------------------------------------
// Bindings middleware factory
// ---------------------------------------------------------------------------

/**
 * Creates a Layer that implements a middleware tag by reading env/ctx from
 * ServiceMap.Reference and providing CloudflareBindings to the wrapped effect.
 *
 * Works for both HttpApiMiddleware.Service and RpcMiddleware.Service tags
 * because they share the same `(effect) => Effect` shape.
 *
 * @example
 * ```ts
 * // HTTP app
 * const CloudflareBindingsMiddlewareLive = makeBindingsMiddleware(CloudflareBindingsMiddleware)
 *
 * // RPC app
 * const RpcCloudflareMiddlewareLive = makeBindingsMiddleware(RpcCloudflareMiddleware)
 * ```
 */
export const makeBindingsMiddleware = <I, S>(
  tag: ServiceMap.Key<I, S>
): Layer.Layer<I> =>
  Layer.succeed(tag)(bindingsMiddlewareEffect as unknown as S)

// ---------------------------------------------------------------------------
// Database middleware factory
// ---------------------------------------------------------------------------

/**
 * Creates a Layer that implements a database middleware tag by reading env
 * from ServiceMap.Reference, creating a PgDrizzle connection, and providing
 * it to the wrapped effect.
 *
 * @example
 * ```ts
 * const DatabaseMiddlewareLive = makeDatabaseMiddleware(
 *   DatabaseMiddleware,
 *   (env) => (env as Env).HYPERDRIVE.connectionString
 * )
 * ```
 */
export const makeDatabaseMiddleware = <I, S>(
  tag: ServiceMap.Key<I, S>,
  getConnectionString: (env: unknown) => string
): Layer.Layer<I> =>
  Layer.succeed(tag)(
    databaseMiddlewareEffect(getConnectionString) as unknown as S
  )
