/**
 * Database Middleware Tags
 *
 * Protocol-agnostic middleware tags that provide PgDrizzle to handlers.
 * Both HTTP and RPC tags are co-located here since they share the same concern,
 * error type, and factory implementation (`makeDatabaseMiddleware`).
 *
 * @module
 */
import { HttpApiMiddleware } from "effect/unstable/httpapi"
import { RpcMiddleware } from "effect/unstable/rpc"
import { PgDrizzle } from "@repo/db/pg-drizzle/tag"
import { DatabaseConnectionError } from "@repo/domain"

// ============================================================================
// HTTP
// ============================================================================

/**
 * HTTP middleware that provides PgDrizzle to handlers.
 *
 * Apply to groups that need database access:
 *
 * ```typescript
 * export const UsersGroup = HttpApiGroup.make("users")
 *   .add(...)
 *   .middleware(DatabaseMiddleware)
 *   .prefix("/users")
 * ```
 */
export class DatabaseMiddleware extends HttpApiMiddleware.Service<
  DatabaseMiddleware,
  { provides: PgDrizzle }
>()("@repo/api/DatabaseMiddleware", {
  error: DatabaseConnectionError
}) {}

// ============================================================================
// RPC
// ============================================================================

/**
 * RPC middleware that provides PgDrizzle to handlers.
 *
 * Apply to RPC procedures that need database access:
 *
 * ```typescript
 * const myRpc = Rpc.make("myRpc", { ... })
 *   .middleware(RpcDatabaseMiddleware)
 * ```
 */
export class RpcDatabaseMiddleware extends RpcMiddleware.Service<
  RpcDatabaseMiddleware,
  { provides: PgDrizzle }
>()("@repo/rpc/RpcDatabaseMiddleware", {
  error: DatabaseConnectionError,
  requiredForClient: false
}) {}

// Re-export for convenience
export { DatabaseConnectionError }
