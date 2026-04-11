/**
 * HTTP Middleware Implementations
 *
 * App-specific wiring of HTTP API middleware tags to the shared
 * `@repo/cloudflare` building blocks. Each tag is implemented by passing
 * its `.of(...)` helper the concrete `(effect, options) => Effect` shape —
 * the `.of` call narrows the function to the tag's service type, so no
 * `as` cast is needed to bridge cross-transport generics.
 *
 * @module
 */

import { provideBindings, provideDatabase } from "@repo/cloudflare";
import { CloudflareBindingsMiddleware, DatabaseMiddleware } from "@repo/contracts";
import { Layer } from "effect";

/** Live implementation of CloudflareBindingsMiddleware. */
export const CloudflareBindingsMiddlewareLive = Layer.succeed(CloudflareBindingsMiddleware)(
  CloudflareBindingsMiddleware.of((effect, _options) => provideBindings(effect)),
);

/**
 * Live implementation of DatabaseMiddleware. The connection string extractor
 * narrows `env: unknown` to the worker's `Env` binding shape by reading the
 * HYPERDRIVE field — Cloudflare Workers generates that type, so the lookup
 * is schema-typed end to end without a manual assertion.
 */
export const DatabaseMiddlewareLive = Layer.succeed(DatabaseMiddleware)(
  DatabaseMiddleware.of((effect, _options) =>
    provideDatabase((env) => (env as Env).HYPERDRIVE.connectionString, effect),
  ),
);

/** Combined middleware layer. */
export const MiddlewareLive = Layer.mergeAll(
  CloudflareBindingsMiddlewareLive,
  DatabaseMiddlewareLive,
);
