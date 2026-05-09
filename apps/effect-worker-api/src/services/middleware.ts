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
import { Layer } from "effect";

/** Live implementation of CloudflareBindingsMiddleware. */
export const CloudflareBindingsMiddlewareLive = Layer.succeed(CloudflareBindingsMiddleware)(
  CloudflareBindingsMiddleware.of((effect, _options) => provideBindings(effect)),
);

/** Live implementation of DatabaseMiddleware. */
export const DatabaseMiddlewareLive = Layer.succeed(DatabaseMiddleware)(
  DatabaseMiddleware.of((effect, _options) => provideDatabase(effect)),
);

/** Combined middleware layer. */
export const MiddlewareLive = Layer.mergeAll(
  CloudflareBindingsMiddlewareLive,
  DatabaseMiddlewareLive,
);
