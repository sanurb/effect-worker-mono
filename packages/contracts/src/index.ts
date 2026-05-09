/**
 * @repo/contracts
 *
 * Transport contract definitions for Effect Worker.
 *
 * Provides:
 * - HTTP API definitions using `effect/unstable/httpapi`
 * - RPC procedure definitions using `effect/unstable/rpc`
 * - Per-transport middleware tags (each transport's tags live next to its
 *   endpoint definitions in `./http/middleware` and `./rpc/middleware`)
 *
 * Service tags and adapter errors live with their adapters in
 * `@repo/cloudflare` and `@repo/db` — this package only re-exports what the
 * transport surface needs.
 *
 * @module
 */
export * from "./http";
export * from "./rpc";
