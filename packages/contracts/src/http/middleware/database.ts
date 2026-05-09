/**
 * Database HTTP Middleware
 *
 * HttpApiMiddleware that provides PgDrizzle to HTTP handlers.
 * The implementation is provided by the app via Layer.
 *
 * `PgDrizzle` is imported from the `pg-drizzle/tag` subpath as a type-only
 * import to keep `pg` out of the contracts consumer graph.
 *
 * @module
 */
import { DatabaseConnectionError } from "@repo/db";
import type { PgDrizzle } from "@repo/db/pg-drizzle/tag";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

/**
 * Middleware that provides PgDrizzle to HTTP handlers.
 *
 * Apply to groups that need database access:
 *
 * ```typescript
 * export const UsersGroup = HttpApiGroup.make("users")
 *   .add(...)
 *   .middleware(DatabaseMiddleware)
 *   .prefix("/users")
 * ```
 *
 * Handlers can then use PgDrizzle directly:
 *
 * ```typescript
 * const drizzle = yield* PgDrizzle
 * const users = yield* drizzle.select().from(usersTable)
 * ```
 */
export class DatabaseMiddleware extends HttpApiMiddleware.Service<
  DatabaseMiddleware,
  { provides: PgDrizzle }
>()("@repo/api/DatabaseMiddleware", {
  error: DatabaseConnectionError,
}) {}
