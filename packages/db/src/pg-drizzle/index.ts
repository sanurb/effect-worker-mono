/**
 * PgDrizzle Service
 *
 * Thin wrapper around `drizzle-orm/effect-postgres.makeWithDefaults` that
 * provisions a `PgClient` (from `@effect/sql-pg`) from a connection string.
 *
 * @module
 */
import { PgClient } from "@effect/sql-pg";
import { type EffectDrizzlePgConfig, makeWithDefaults } from "drizzle-orm/effect-postgres";
import { Effect, Redacted } from "effect";

export { PgDrizzle } from "./tag.js";

/**
 * Creates an EffectPgDatabase tied to the current Scope. The underlying
 * PgClient is released when the enclosing scope ends (e.g. on request end).
 */
export const makeDrizzle = Effect.fnUntraced(function* (
  connectionString: string,
  config?: EffectDrizzlePgConfig,
) {
  return yield* makeWithDefaults(config).pipe(
    Effect.provide(PgClient.layer({ url: Redacted.make(connectionString) })),
  );
});
