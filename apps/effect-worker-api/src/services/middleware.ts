/**
 * Middleware Implementations
 *
 * App-specific wiring of middleware tags to shared factories from @repo/cloudflare.
 *
 * @module
 */
import { Layer } from "effect"
import {
  makeBindingsMiddleware,
  makeDatabaseMiddleware
} from "@repo/cloudflare"
import {
  CloudflareBindingsMiddleware,
  DatabaseMiddleware
} from "@repo/contracts"

/**
 * Live implementation of CloudflareBindingsMiddleware.
 */
export const CloudflareBindingsMiddlewareLive = makeBindingsMiddleware(
  CloudflareBindingsMiddleware
)

/**
 * Live implementation of DatabaseMiddleware.
 */
export const DatabaseMiddlewareLive = makeDatabaseMiddleware(
  DatabaseMiddleware,
  (env) => (env as Env).HYPERDRIVE.connectionString
)

/**
 * Combined middleware layer.
 */
export const MiddlewareLive = Layer.mergeAll(
  CloudflareBindingsMiddlewareLive,
  DatabaseMiddlewareLive
)
