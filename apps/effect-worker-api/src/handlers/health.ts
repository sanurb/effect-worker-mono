import { WorkerApi } from "@repo/contracts";
import { DateTime, Effect } from "effect";
/**
 * Health Handler Implementation
 *
 * @module
 */
import { HttpApiBuilder } from "effect/unstable/httpapi";

/**
 * Health endpoint handler implementation.
 */
export const HealthGroupLive = HttpApiBuilder.group(WorkerApi, "health", (handlers) =>
  handlers.handle("check", () =>
    Effect.sync(() => ({
      status: "ok" as const,
      timestamp: DateTime.nowUnsafe(),
    })),
  ),
);
