/**
 * Database RPC Middleware Tag
 *
 * RpcMiddleware tag that provides PgDrizzle to RPC handlers.
 * The implementation is provided by the app via Layer.
 *
 * `PgDrizzle` is imported from the `pg-drizzle/tag` subpath as a type-only
 * import to keep `pg` out of the contracts consumer graph.
 *
 * @module
 */
import { DatabaseConnectionError } from "@repo/db";
import type { PgDrizzle } from "@repo/db/pg-drizzle/tag";
import { RpcMiddleware } from "effect/unstable/rpc";

/**
 * Middleware that provides PgDrizzle to RPC handlers.
 *
 * Apply to RPC procedures that need database access:
 *
 * ```typescript
 * const myRpc = Rpc.make("myRpc", { ... })
 *   .middleware(RpcDatabaseMiddleware)
 * ```
 *
 * Handlers can then use PgDrizzle directly:
 *
 * ```typescript
 * const drizzle = yield* PgDrizzle
 * const users = yield* drizzle.select().from(usersTable)
 * ```
 */
export class RpcDatabaseMiddleware extends RpcMiddleware.Service<
  RpcDatabaseMiddleware,
  { provides: PgDrizzle }
>()("@repo/rpc/RpcDatabaseMiddleware", {
  error: DatabaseConnectionError,
  requiredForClient: false,
}) {}
