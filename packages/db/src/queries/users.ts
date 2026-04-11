/**
 * User Queries
 *
 * Reusable Effect programs for user database operations.
 * All public functions use `Effect.fn` for automatic tracing spans.
 *
 * @module
 */
import {
  type CreateUser,
  EmailSchema,
  type User,
  UserCreationError,
  type UserId,
  UserIdSchema,
  UserNotFoundError,
} from "@repo/domain";
import { eq } from "drizzle-orm";
import { DateTime, Effect, Option, Schema } from "effect";

import { PgDrizzle } from "../pg-drizzle/index.js";
import { users } from "../schema";

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Parses a branded UserId back to its database row identifier. Returns
 * `Option.none` when the input does not match the `usr_<digits>` shape —
 * the caller turns that into a domain error (UserNotFoundError).
 */
const parseUserId = (id: UserId): Option.Option<number> =>
  Option.map(Option.fromNullishOr(id.match(/^usr_(\d+)$/)?.[1]), (digits) => parseInt(digits, 10));

/**
 * Maps a Drizzle-decoded row into a branded domain `User`. Branded fields
 * flow through `Schema.decodeUnknownSync` so invalid rows throw at the
 * boundary instead of silently widening through `as` casts. A db that
 * stores a malformed email or user id is a real corruption signal that
 * should surface loudly.
 */
const toDomainUser = (row: typeof users.$inferSelect): User => ({
  id: Schema.decodeUnknownSync(UserIdSchema)(`usr_${row.id}`),
  email: Schema.decodeUnknownSync(EmailSchema)(row.email),
  name: row.name,
  createdAt: DateTime.fromDateUnsafe(row.createdAt),
});

// ============================================================================
// Query Programs
// ============================================================================

/**
 * Find all users.
 */
export const findAllUsers: Effect.Effect<ReadonlyArray<User>, never, PgDrizzle> = Effect.gen(
  function* () {
    const drizzle = yield* PgDrizzle;
    const rows = yield* drizzle
      .select()
      .from(users)
      .pipe(Effect.orElseSucceed(() => [] as const));

    return rows.map(toDomainUser);
  },
);

/**
 * Find user by ID.
 */
export const findUserById = Effect.fn("UserQueries.findUserById")(function* (
  id: UserId,
): Effect.fn.Return<User, UserNotFoundError, PgDrizzle> {
  const dbId = yield* Option.match(parseUserId(id), {
    onNone: () =>
      Effect.fail(new UserNotFoundError({ id, message: `Invalid user ID format: ${id}` })),
    onSome: Effect.succeed,
  });

  const drizzle = yield* PgDrizzle;
  const rows = yield* drizzle
    .select()
    .from(users)
    .where(eq(users.id, dbId))
    .pipe(Effect.orElseSucceed(() => [] as const));

  const row = yield* Option.match(Option.fromNullishOr(rows[0]), {
    onNone: () => Effect.fail(new UserNotFoundError({ id, message: `User not found: ${id}` })),
    onSome: Effect.succeed,
  });

  return toDomainUser(row);
});

/**
 * Create a new user.
 */
export const createUser = Effect.fn("UserQueries.createUser")(function* (
  data: CreateUser,
): Effect.fn.Return<User, UserCreationError, PgDrizzle> {
  const drizzle = yield* PgDrizzle;
  const rows = yield* drizzle
    .insert(users)
    .values({ email: data.email, name: data.name })
    .returning()
    .pipe(Effect.mapError(() => new UserCreationError(data)));

  const row = yield* Option.match(Option.fromNullishOr(rows[0]), {
    onNone: () => Effect.fail(new UserCreationError(data)),
    onSome: Effect.succeed,
  });

  return toDomainUser(row);
});
