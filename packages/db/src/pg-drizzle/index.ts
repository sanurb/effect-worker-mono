/**
 * PgDrizzle Service
 *
 * Thin wrapper around `drizzle-orm/effect-postgres.makeWithDefaults` that
 * provisions a `PgClient` (from `@effect/sql-pg`) from a connection string.
 *
 * @module
 */
import { PgClient } from "@effect/sql-pg";
import {
  type EffectDrizzlePgConfig,
  makeWithDefaults,
} from "drizzle-orm/effect-postgres";
import { Effect, Redacted } from "effect";

export { PgDrizzle } from "./tag.js";

/**
 * Creates an EffectPgDatabase instance from a connection string. The
 * underlying PgClient is tied to the current Scope — it stays alive for the
 * duration of the enclosing scope (e.g. the request scope in middleware).
 *
 * Column casing must be applied at the table-builder level in 1.0.0-rc.1
 * (e.g. `import { snakeCase } from "drizzle-orm/pg-core/casing"`); the
 * top-level `casing` option was removed from `DrizzlePgConfig`.
 */
export const makeDrizzle = Effect.fnUntraced(function* (
  connectionString: string,
  config?: EffectDrizzlePgConfig,
) {
  return yield* makeWithDefaults(config).pipe(
    Effect.provide(PgClient.layer({ url: Redacted.make(connectionString) })),
  );
});
