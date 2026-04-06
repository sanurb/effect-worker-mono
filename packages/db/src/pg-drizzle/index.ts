/**
 * PgDrizzle Service
 *
 * Custom Effect v4 integration for Drizzle ORM with PostgreSQL.
 * Replaces the removed @effect/sql-drizzle package.
 *
 * @module
 */
import "./patch.js"

import { Effect, Layer, Redacted, ServiceMap } from "effect"
import { SqlClient } from "effect/unstable/sql"
import { PgClient } from "@effect/sql-pg"
import { drizzle, type RemoteCallback } from "drizzle-orm/pg-proxy"
import type { DrizzleConfig } from "drizzle-orm"

export { PgDrizzle } from "./tag.js"
import { PgDrizzle } from "./tag.js"

// ============================================================================
// Internal: RemoteCallback bridge
// ============================================================================

/** Default Drizzle config applied when none is provided. */
const defaultConfig: DrizzleConfig = { casing: "snake_case" }

/**
 * Build a Drizzle RemoteCallback from an Effect SqlClient.
 *
 * The callback translates Drizzle query calls into Effect SqlClient
 * operations. This is the single source of truth for the bridge logic —
 * every layer and helper below delegates to it.
 */
const buildRemoteCallback = (client: SqlClient.SqlClient): RemoteCallback =>
  ((sql: string, params: any[], method: "all" | "execute") => {
    const statement = client.unsafe(sql, params)
    const baseEffect =
      method === "execute"
        ? Effect.map(statement.raw, (result) => ({ rows: [result] }))
        : Effect.map(statement.values, (result) => ({ rows: result as any[] }))
    return Effect.runPromise(baseEffect) as Promise<{ rows: any[] }>
  }) satisfies RemoteCallback

// ============================================================================
// Public API
// ============================================================================

/**
 * Creates the RemoteCallback that bridges Drizzle’s pg-proxy to Effect’s SqlClient.
 */
export const makeRemoteCallback: Effect.Effect<RemoteCallback, never, SqlClient.SqlClient> =
  Effect.gen(function* () {
    const client = yield* SqlClient.SqlClient
    return buildRemoteCallback(client)
  })

/**
 * Layer that provides PgDrizzle with custom Drizzle config.
 * When no config is needed, use {@link PgDrizzleLive} instead.
 */
export const PgDrizzleLiveWithConfig = (
  config: DrizzleConfig
): Layer.Layer<PgDrizzle, never, SqlClient.SqlClient> =>
  Layer.effect(
    PgDrizzle,
    Effect.gen(function* () {
      const callback = yield* makeRemoteCallback
      return drizzle(callback, config)
    })
  )

/**
 * Layer that provides PgDrizzle from an existing SqlClient in context.
 * Uses the default `{ casing: "snake_case" }` config.
 */
export const PgDrizzleLive: Layer.Layer<PgDrizzle, never, SqlClient.SqlClient> =
  PgDrizzleLiveWithConfig(defaultConfig)

/**
 * Creates a complete PgDrizzle layer from a connection string.
 * Includes PgClient setup with proper lifecycle management.
 */
export const makePgDrizzleLayer = (
  connectionString: string,
  config: DrizzleConfig = defaultConfig
): Layer.Layer<PgDrizzle> =>
  PgDrizzleLiveWithConfig(config).pipe(
    Layer.provide(PgClient.layer({ url: Redacted.make(connectionString) }))
  ) as Layer.Layer<PgDrizzle>

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
export const makeDrizzle = (
  connectionString: string,
  config: DrizzleConfig = defaultConfig
) =>
  Effect.gen(function* () {
    const services = yield* Layer.build(
      PgClient.layer({ url: Redacted.make(connectionString) })
    )
    const client = ServiceMap.get(services, SqlClient.SqlClient)
    return drizzle(buildRemoteCallback(client), config)
  })
