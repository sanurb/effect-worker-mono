/**
 * HTTP Middleware Implementations
 *
 * App-specific wiring of HTTP API middleware tags to the shared
 * `@repo/cloudflare` building blocks. Each tag is implemented by passing
 * its `.of(...)` helper a concrete `(effect, options) => Effect` shape —
 * `.of` narrows the function to the tag's service type, so no `as` cast
 * is needed to bridge cross-transport generics.
 *
 * @module
 */

import { provideBindings, provideDatabase } from "@repo/cloudflare";
import { CloudflareBindingsMiddleware, DatabaseMiddleware } from "@repo/contracts";
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

/** Live implementation of CloudflareBindingsMiddleware. */
export const CloudflareBindingsMiddlewareLive = Layer.succeed(CloudflareBindingsMiddleware)(
  CloudflareBindingsMiddleware.of((effect, _options) => provideBindings(effect)),
);

/** Live implementation of DatabaseMiddleware. */
export const DatabaseMiddlewareLive = Layer.succeed(DatabaseMiddleware)(
  DatabaseMiddleware.of((effect, _options) =>
    provideDatabase(readHyperdriveConnectionString, effect),
  ),
);

/** Combined middleware layer. */
export const MiddlewareLive = Layer.mergeAll(
  CloudflareBindingsMiddlewareLive,
  DatabaseMiddlewareLive,
);
