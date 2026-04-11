/**
 * RPC Middleware Implementations
 *
 * App-specific wiring of RPC middleware tags to the shared
 * `@repo/cloudflare` building blocks. Each tag is implemented by passing
 * its `.of(...)` helper a concrete `(effect, options) => Effect` shape —
 * `.of` narrows the function to the tag's service type, so no `as` cast
 * is needed to bridge cross-transport generics.
 *
 * @module
 */

import { provideBindings, provideDatabase } from "@repo/cloudflare";
import { RpcCloudflareMiddleware, RpcDatabaseMiddleware } from "@repo/contracts";
import { Layer, Schema } from "effect";

// ============================================================================
// Worker Env decoding
// ============================================================================

/**
 * Minimal schema for the fields of the worker `Env` binding we actually
 * read in this app. Decoding at this boundary means downstream code reads
 * typed fields directly instead of casting `unknown` into an overlay type.
 */
const DatabaseEnvSchema = Schema.Struct({
  HYPERDRIVE: Schema.Struct({
    connectionString: Schema.String,
  }),
});

/** Runtime-validated lookup of the Hyperdrive connection string. */
const readHyperdriveConnectionString = (env: unknown): string =>
  Schema.decodeUnknownSync(DatabaseEnvSchema)(env).HYPERDRIVE.connectionString;

// ============================================================================
// Middleware layers
// ============================================================================

/** Live implementation of RpcCloudflareMiddleware. */
export const RpcCloudflareMiddlewareLive = Layer.succeed(RpcCloudflareMiddleware)(
  RpcCloudflareMiddleware.of((effect, _options) => provideBindings(effect)),
);

/** Live implementation of RpcDatabaseMiddleware. */
export const RpcDatabaseMiddlewareLive = Layer.succeed(RpcDatabaseMiddleware)(
  RpcDatabaseMiddleware.of((effect, _options) =>
    provideDatabase(readHyperdriveConnectionString, effect),
  ),
);

/** Combined middleware layer. */
export const RpcMiddlewareLive = Layer.mergeAll(
  RpcCloudflareMiddlewareLive,
  RpcDatabaseMiddlewareLive,
);
