/**
 * Cloudflare Worker Entry Point
 *
 * Main entry point for the Cloudflare Worker HTTP API.
 *
 * @module
 */
import { Context } from "effect";

import { handler } from "@/runtime";
import { currentEnv, currentCtx } from "@/services/cloudflare";

/**
 * Cloudflare Worker fetch handler.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Pass per-request Cloudflare bindings via Context. The call is inlined
    // at the single consumer instead of being aliased to a `const services`
    // wrapper — the pipe has no reuse and doesn't earn a name.
    return handler(request, Context.make(currentEnv, env).pipe(Context.add(currentCtx, ctx)));
  },
} satisfies ExportedHandler<Env>;
