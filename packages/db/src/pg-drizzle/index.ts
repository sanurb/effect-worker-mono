/**
 * PgDrizzle Service
 *
 * Custom Effect v4 integration for Drizzle ORM with PostgreSQL.
 * Replaces the removed @effect/sql-drizzle package.
 *
 * @module
 */
import "./patch.js";
import { PgClient } from "@effect/sql-pg";
import type { DrizzleConfig } from "drizzle-orm";
import { drizzle, type RemoteCallback } from "drizzle-orm/pg-proxy";
import { Context, Effect, Layer, Match, Redacted } from "effect";
import type { SqlError } from "effect/unstable/sql";
import { SqlClient } from "effect/unstable/sql";

export { PgDrizzle } from "./tag.js";
import { PgDrizzle } from "./tag.js";

// ============================================================================
// Internal: RemoteCallback bridge
// ============================================================================

/** Default Drizzle config applied when none is provided. */
const defaultConfig: DrizzleConfig = { casing: "snake_case" };

/**
 * Build a Drizzle RemoteCallback from an Effect SqlClient.
 *
 * The callback translates Drizzle query calls into Effect SqlClient
 * operations. This is the single source of truth for the bridge logic —
 * every layer and helper below delegates to it.
 */
const buildRemoteCallback = (client: SqlClient.SqlClient): RemoteCallback =>
  function (sql, params, method) {
    const statement = client.unsafe(sql, params);
    // Drizzle distinguishes `"execute"` (side-effect, single result wrapped in a
    // 1-element row) from `"all"` (cursor, 2-D rows of raw cell values). Match
    // makes the dispatch explicit and leaves the happy path as a single pipeline.
    const baseEffect = Match.value(method).pipe(
      Match.when("execute", () => Effect.map(statement.raw, (result) => ({ rows: [result] }))),
      Match.orElse(() => Effect.map(statement.values, (rows) => ({ rows: [...rows] }))),
    );
    return Effect.runPromise(baseEffect);
  };

// ============================================================================
// Public API
// ============================================================================

/**
 * Creates the RemoteCallback that bridges Drizzle's pg-proxy to Effect's SqlClient.
 */
export const makeRemoteCallback: Effect.Effect<RemoteCallback, never, SqlClient.SqlClient> =
  Effect.gen(function* () {
    const client = yield* SqlClient.SqlClient;
    return buildRemoteCallback(client);
  });

/**
 * Layer that provides PgDrizzle with custom Drizzle config.
 * When no config is needed, use {@link PgDrizzleLive} instead.
 */
export const PgDrizzleLiveWithConfig = (
  config: DrizzleConfig,
): Layer.Layer<PgDrizzle, never, SqlClient.SqlClient> =>
  Layer.effect(
    PgDrizzle,
    Effect.gen(function* () {
      const callback = yield* makeRemoteCallback;
      return drizzle(callback, config);
    }),
  );

/**
 * Layer that provides PgDrizzle from an existing SqlClient in context.
 * Uses the default `{ casing: "snake_case" }` config.
 */
export const PgDrizzleLive: Layer.Layer<PgDrizzle, never, SqlClient.SqlClient> =
  PgDrizzleLiveWithConfig(defaultConfig);

/**
 * Creates a complete PgDrizzle layer from a connection string. The error
 * channel exposes `SqlError` so callers see connection failures instead of
 * having them silently swallowed by a type-erasure cast.
 */
export const makePgDrizzleLayer = (
  connectionString: string,
  config: DrizzleConfig = defaultConfig,
): Layer.Layer<PgDrizzle, SqlError.SqlError> =>
  PgDrizzleLiveWithConfig(config).pipe(
    Layer.provide(PgClient.layer({ url: Redacted.make(connectionString) })),
  );

/**
 * Creates a PgRemoteDatabase instance from a connection string.
 *
 * The underlying SqlClient is tied to the current Scope — it stays alive
 * for the duration of the enclosing scope (e.g. the request scope in
 * middleware).
 *
 * Composes {@link buildRemoteCallback} with a scoped PgClient, so the
 * bridge logic is never duplicated.
 */
export const makeDrizzle = Effect.fn("makeDrizzle")(function* (
  connectionString: string,
  config: DrizzleConfig = defaultConfig,
) {
  const services = yield* Layer.build(PgClient.layer({ url: Redacted.make(connectionString) }));
  const client = Context.get(services, SqlClient.SqlClient);
  return drizzle(buildRemoteCallback(client), config);
});
