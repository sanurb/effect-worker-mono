/**
 * RPC Middleware — re-exports
 *
 * RPC-specific middleware tags, re-exported from the unified middleware module.
 * Preserves backwards-compatible import paths for consumers using `@repo/contracts/rpc`.
 *
 * @module
 */
export { RpcCloudflareMiddleware } from "../middleware/cloudflare"
export { RpcDatabaseMiddleware } from "../middleware/database"
