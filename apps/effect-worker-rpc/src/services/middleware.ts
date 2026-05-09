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
import { Layer } from "effect";

/** Live implementation of RpcCloudflareMiddleware. */
export const RpcCloudflareMiddlewareLive = Layer.succeed(RpcCloudflareMiddleware)(
  RpcCloudflareMiddleware.of((effect, _options) => provideBindings(effect)),
);

/** Live implementation of RpcDatabaseMiddleware. */
export const RpcDatabaseMiddlewareLive = Layer.succeed(RpcDatabaseMiddleware)(
  RpcDatabaseMiddleware.of((effect, _options) => provideDatabase(effect)),
);

/** Combined middleware layer. */
export const RpcMiddlewareLive = Layer.mergeAll(
  RpcCloudflareMiddlewareLive,
  RpcDatabaseMiddlewareLive,
);
