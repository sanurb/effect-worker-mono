/**
 * Cloudflare Bindings HTTP Middleware
 *
 * HttpApiMiddleware that provides CloudflareBindings to HTTP handlers.
 * The implementation is provided by the app via Layer.
 *
 * @module
 */
import { CloudflareBindings, CloudflareBindingsError } from "@repo/cloudflare";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

/**
 * Middleware that provides CloudflareBindings to HTTP handlers.
 *
 * Apply at the API level to make env/ctx available everywhere:
 *
 * ```typescript
 * export class WorkerApi extends HttpApi.make("WorkerApi")
 *   .add(UsersGroup)
 *   .middleware(CloudflareBindingsMiddleware)
 *   .prefix("/api") {}
 * ```
 */
export class CloudflareBindingsMiddleware extends HttpApiMiddleware.Service<
  CloudflareBindingsMiddleware,
  { provides: CloudflareBindings }
>()("@repo/api/CloudflareBindingsMiddleware", {
  error: CloudflareBindingsError,
}) {}
