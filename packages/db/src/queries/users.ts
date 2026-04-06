/**
 * User Queries
 *
 * Reusable Effect programs for user database operations.
 * All public functions use `Effect.fn` for automatic tracing spans.
 *
 * @module
 */
import { DateTime, Effect } from "effect"
import { PgDrizzle } from "../pg-drizzle/index.js"
import { eq } from "drizzle-orm"

import { users } from "../schema"
import type { UserId, Email, User, CreateUser } from "@repo/domain"
import { UserNotFoundError, UserCreationError } from "@repo/domain"

// ============================================================================
// Internal Helpers
// ============================================================================

/** Convert database ID to branded UserId */
const toUserId = (id: number): UserId => `usr_${id}` as UserId

/** Parse UserId to database ID, returns null if invalid format */
const parseUserId = (id: UserId): number | null => {
  const match = id.match(/^usr_(\d+)$/)
  return match ? parseInt(match[1]!, 10) : null
}

/** Map database row to domain User */
const toDomainUser = (row: typeof users.$inferSelect): User => ({
  id: toUserId(row.id),
  email: row.email as Email,
  name: row.name,
  createdAt: DateTime.fromDateUnsafe(row.createdAt)
})

// ============================================================================
// Query Programs
// ============================================================================

/**
 * Find all users.
 */
export const findAllUsers: Effect.Effect<
  ReadonlyArray<User>,
  never,
  PgDrizzle
> = Effect.gen(function* () {
  const drizzle = yield* PgDrizzle
  const rows = yield* drizzle
    .select()
    .from(users)
    .pipe(Effect.orElseSucceed(() => [] as const))

  return rows.map(toDomainUser)
})

/**
 * Find user by ID.
 */
export const findUserById = Effect.fn("UserQueries.findUserById")(
  function* (id: UserId): Effect.fn.Return<User, UserNotFoundError, PgDrizzle> {
    const dbId = parseUserId(id)

    if (dbId === null) {
      return yield* new UserNotFoundError({ id, message: `Invalid user ID format: ${id}` })
    }

    const drizzle = yield* PgDrizzle
    const rows = yield* drizzle
      .select()
      .from(users)
      .where(eq(users.id, dbId))
      .pipe(Effect.orElseSucceed(() => [] as const))

    const row = rows[0]

    if (!row) {
      return yield* new UserNotFoundError({ id, message: `User not found: ${id}` })
    }

    return toDomainUser(row)
  }
)

/**
 * Create a new user.
 */
export const createUser = Effect.fn("UserQueries.createUser")(
  function* (data: CreateUser): Effect.fn.Return<User, UserCreationError, PgDrizzle> {
    const drizzle = yield* PgDrizzle
    const rows = yield* drizzle
      .insert(users)
      .values({ email: data.email, name: data.name })
      .returning()
      .pipe(Effect.mapError(() => new UserCreationError(data)))

    const row = rows[0]

    if (!row) {
      return yield* new UserCreationError(data)
    }

    return toDomainUser(row)
  }
)
