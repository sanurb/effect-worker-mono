/**
 * Logger Configuration
 * Configures human-readable console logging and span-linked log events.
 * @module
 */

import { Layer, Logger, References, type LogLevel } from "effect";

// ============================================================================
// Logger layer
// ============================================================================

export const makeLoggerLayer = (logLevel: LogLevel.LogLevel = "Info") =>
  Layer.mergeAll(
    Logger.layer([Logger.consolePretty(), Logger.tracerLogger], {
      mergeWithExisting: false,
    }),
    Layer.succeed(References.MinimumLogLevel)(logLevel),
  );
