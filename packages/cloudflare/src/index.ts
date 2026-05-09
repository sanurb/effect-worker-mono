/**
 * @repo/cloudflare
 *
 * Shared Cloudflare Workers integration for Effect.
 *
 * Provides:
 * - Context.Reference bridge for request-scoped env/ctx
 * - CloudflareBindings service tag
 * - Middleware building blocks (provideBindings, provideDatabase)
 *
 * @module
 */
export {
  currentEnv,
  currentCtx,
  withCloudflareBindings,
  waitUntil,
  type WorkerExecutionContext,
} from "./bindings";

export { CloudflareBindingsError } from "./errors";

export { CloudflareBindings, provideBindings, provideDatabase } from "./middleware";

export {
  makeObservabilityLayer,
  type ObservabilityConfig,
} from "./observability/Observability";
