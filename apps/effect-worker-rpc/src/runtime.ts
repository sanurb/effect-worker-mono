import { makeObservabilityLayer } from "@repo/cloudflare";
import { UsersRpc } from "@repo/contracts";
/**
 * RPC Runtime Configuration
 *
 * Sets up the RPC server using HttpRouter.toWebHandler.
 *
 * @module
 */
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { RpcServer, RpcSerialization } from "effect/unstable/rpc";

import { UsersRpcHandlersLive } from "@/handlers";
import { RpcMiddlewareLive } from "@/services";

// ============================================================================
// Observability
// ============================================================================

/**
 * Observability layer — provides Logger + Tracer.
 *
 * Layer construction is memoized by HttpRouter.toWebHandler, so we keep
 * the runtime configuration static at module load.
 */
const ObservabilityLive = makeObservabilityLayer();

// ============================================================================
// Layer Composition
// ============================================================================

/**
 * Protocol layer — HTTP transport with ndjson serialization.
 *
 * layerProtocolHttp requires RpcSerialization + HttpRouter.
 * We provide RpcSerialization here; HttpRouter is provided by toWebHandler.
 */
const ProtocolLayer = RpcServer.layerProtocolHttp({ path: "/rpc" }).pipe(
  Layer.provide(RpcSerialization.layerNdjson),
);

/**
 * Full RPC routes layer.
 *
 * RpcServer.layer requires Protocol + handlers + middleware.
 * After composition, only HttpRouter remains as a requirement
 * (provided by HttpRouter.toWebHandler).
 */
const RpcRoutes = RpcServer.layer(UsersRpc).pipe(
  Layer.provide(UsersRpcHandlersLive),
  Layer.provide(RpcMiddlewareLive),
  Layer.provide(ProtocolLayer),
);

/**
 * Web handler for RPC requests.
 *
 * Layers are memoized internally — built once at startup.
 * Per-request services (env/ctx) are passed via the Context.
 */
export const { handler: rpcHandler, dispose } = HttpRouter.toWebHandler(
  RpcRoutes.pipe(Layer.provide(HttpServer.layerServices), Layer.provide(ObservabilityLive)),
);
