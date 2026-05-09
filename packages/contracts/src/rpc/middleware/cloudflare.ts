/**
 * Cloudflare Bindings RPC Middleware Tag
 *
 * RpcMiddleware tag that provides CloudflareBindings to RPC handlers.
 * The implementation is provided by the app via Layer.
 *
 * @module
 */
import { CloudflareBindings, CloudflareBindingsError } from "@repo/cloudflare";
import { RpcMiddleware } from "effect/unstable/rpc";

/**
 * Middleware that provides CloudflareBindings to RPC handlers.
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
  requiredForClient: false,
}) {}
