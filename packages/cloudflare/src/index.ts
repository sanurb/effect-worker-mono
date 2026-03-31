/**
 * @repo/cloudflare
 *
 * Shared Cloudflare Workers integration for Effect.
 *
 * Provides:
 * - ServiceMap.Reference bridge for request-scoped env/ctx
 * - CloudflareBindings service tag
 * - Middleware factories for bindings and database
 *
 * @module
 */
export {
  currentEnv,
  currentCtx,
  withCloudflareBindings,
  waitUntil,
  type WorkerExecutionContext
} from "./bindings"

export {
  CloudflareBindings,
  makeBindingsMiddleware,
  makeDatabaseMiddleware
} from "./middleware"
