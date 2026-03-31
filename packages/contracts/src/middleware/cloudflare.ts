/**
 * Cloudflare Bindings Middleware Tags
 *
 * Protocol-agnostic middleware tags that provide CloudflareBindings to handlers.
 * Both HTTP and RPC tags are co-located here since they share the same concern,
 * error type, and factory implementation (`makeBindingsMiddleware`).
 *
 * @module
 */
import { HttpApiMiddleware } from "effect/unstable/httpapi"
import { RpcMiddleware } from "effect/unstable/rpc"
import { CloudflareBindingsError } from "@repo/domain"
import { CloudflareBindings } from "../services"

// ============================================================================
// HTTP
// ============================================================================

/**
 * HTTP middleware that provides CloudflareBindings to handlers.
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
  error: CloudflareBindingsError
}) {}

// ============================================================================
// RPC
// ============================================================================

/**
 * RPC middleware that provides CloudflareBindings to handlers.
 *
 * Apply to RPC procedures that need access to Cloudflare env/ctx:
 *
 * ```typescript
 * const myRpc = Rpc.make("myRpc", { ... })
 *   .middleware(RpcCloudflareMiddleware)
 * ```
 */
export class RpcCloudflareMiddleware extends RpcMiddleware.Service<
  RpcCloudflareMiddleware,
  { provides: CloudflareBindings }
>()("@repo/rpc/RpcCloudflareMiddleware", {
  error: CloudflareBindingsError,
  requiredForClient: false
}) {}

// Re-export for convenience
export { CloudflareBindingsError }
