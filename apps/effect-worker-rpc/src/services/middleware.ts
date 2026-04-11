import { makeBindingsMiddleware, makeDatabaseMiddleware } from "@repo/cloudflare";
import { RpcCloudflareMiddleware, RpcDatabaseMiddleware } from "@repo/contracts";
/**
 * RPC Middleware Implementations
 *
 * App-specific wiring of middleware tags to shared factories from @repo/cloudflare.
 *
 * @module
 */
import { Layer } from "effect";

/**
 * Live implementation of RpcCloudflareMiddleware.
 */
export const RpcCloudflareMiddlewareLive = makeBindingsMiddleware(RpcCloudflareMiddleware);

/**
 * Live implementation of RpcDatabaseMiddleware.
 */
export const RpcDatabaseMiddlewareLive = makeDatabaseMiddleware(
  RpcDatabaseMiddleware,
  (env) => (env as Env).HYPERDRIVE.connectionString,
);

/**
 * Combined middleware layer.
 */
export const RpcMiddlewareLive = Layer.mergeAll(
  RpcCloudflareMiddlewareLive,
  RpcDatabaseMiddlewareLive,
);
