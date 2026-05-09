/**
 * PgDrizzle Service
 *
 * Native Drizzle ↔ Effect v4 integration. Drizzle 1.0.0-rc.1 ships its own
 * Effect-aware Pg database in `drizzle-orm/effect-postgres`, so this module
 * is now a thin wrapper that wires `PgClient` (from `@effect/sql-pg`) into
 * `makeWithDefaults` and exposes Layer / scoped factories.
 *
 * @module
 */
import { PgClient } from "@effect/sql-pg";
import {
  type EffectDrizzlePgConfig,
  makeWithDefaults,
} from "drizzle-orm/effect-postgres";
import { Effect, Layer, Redacted } from "effect";
import type { SqlError } from "effect/unstable/sql";

export { PgDrizzle } from "./tag.js";
import { PgDrizzle } from "./tag.js";

/**
 * Layer that provides PgDrizzle with custom Drizzle config.
 * When no config is needed, use {@link PgDrizzleLive} instead.
 *
 * Note: drizzle@1.0.0-rc.1 removed the top-level `casing` option from
 * `DrizzlePgConfig`. Apply column casing at the table-builder level (e.g.
 * `import { snakeCase } from "drizzle-orm/pg-core/casing"`) when needed.
 */
export const PgDrizzleLiveWithConfig = (
  config?: EffectDrizzlePgConfig,
): Layer.Layer<PgDrizzle, never, PgClient.PgClient> =>
  Layer.effect(PgDrizzle, makeWithDefaults(config));

/**
 * Layer that provides PgDrizzle from an existing PgClient in context.
 */
export const PgDrizzleLive: Layer.Layer<PgDrizzle, never, PgClient.PgClient> =
  PgDrizzleLiveWithConfig();

/**
 * Creates a complete PgDrizzle layer from a connection string. The error
 * channel exposes `SqlError` so callers see connection failures instead of
 * having them silently swallowed by a type-erasure cast.
 */
export const makePgDrizzleLayer = (
  connectionString: string,
  config?: EffectDrizzlePgConfig,
): Layer.Layer<PgDrizzle, SqlError.SqlError> =>
  PgDrizzleLiveWithConfig(config).pipe(
    Layer.provide(PgClient.layer({ url: Redacted.make(connectionString) })),
  );

/**
 * Creates an EffectPgDatabase instance from a connection string. The
 * underlying PgClient is tied to the current Scope — it stays alive for the
 * duration of the enclosing scope (e.g. the request scope in middleware).
 */
export const makeDrizzle = Effect.fn("makeDrizzle")(function* (
  connectionString: string,
  config?: EffectDrizzlePgConfig,
) {
  return yield* makeWithDefaults(config).pipe(
    Effect.provide(PgClient.layer({ url: Redacted.make(connectionString) })),
  );
});
