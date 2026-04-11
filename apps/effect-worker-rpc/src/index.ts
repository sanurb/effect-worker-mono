/**
 * Cloudflare Worker Entry Point
 *
 * Main entry point for the Cloudflare Worker RPC API.
 *
 * @module
 */
import { Context, Match } from "effect";

import { rpcHandler } from "@/runtime";
import { currentEnv, currentCtx } from "@/services/cloudflare";

/**
 * Cloudflare Worker fetch handler.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Route via Match: `/health` returns a synchronous liveness probe,
    // everything else is forwarded to the RPC handler. Match.value expresses
    // the two-branch decision without an imperative `if` guard and keeps the
    // Response construction flat.
    return Match.value(new URL(request.url).pathname).pipe(
      Match.when("/health", () => Response.json({ status: "ok", service: "effect-worker-rpc" })),
      Match.orElse(() =>
        rpcHandler(request, Context.make(currentEnv, env).pipe(Context.add(currentCtx, ctx))),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
