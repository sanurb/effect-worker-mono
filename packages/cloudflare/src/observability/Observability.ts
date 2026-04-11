/**
 * Observability Layer
 * Composes logging, tracing, and optional OTLP export for Cloudflare Workers.
 * @module
 */

import type { LogLevel } from "effect";
import { Effect, Layer, Match, Option, References, Tracer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { OtlpSerialization, OtlpTracer } from "effect/unstable/observability";

import { makeLoggerLayer } from "./Logger";
import { makeNdjsonTracer } from "./Tracer";

// ============================================================================
// Constants
// ============================================================================

const LOG_LEVEL = {
  TRACE: "Trace",
  DEBUG: "Debug",
  INFO: "Info",
  WARN: "Warn",
  ERROR: "Error",
  FATAL: "Fatal",
  NONE: "None",
} as const;

// ============================================================================
// Models
// ============================================================================

export interface ObservabilityConfig {
  readonly logLevel?: string;
  readonly otlpTracesUrl?: string;
  readonly otlpServiceName?: string;
}

// ============================================================================
// Layer construction
// ============================================================================

export const makeObservabilityLayer = (
  config: ObservabilityConfig = {},
): Layer.Layer<never, never, never> => {
  const baseLayer = Layer.mergeAll(
    makeLoggerLayer(parseLogLevel(config.logLevel)),
    Layer.succeed(References.TracerTimingEnabled)(true),
  );

  const tracerLayer = Option.match(Option.fromNullishOr(config.otlpTracesUrl), {
    onNone: () => Layer.succeed(Tracer.Tracer)(makeNdjsonTracer()),
    onSome: (url) => makeDelegatingTracerLayer(url, config),
  });

  return Layer.mergeAll(baseLayer, tracerLayer);
};

const makeDelegatingTracerLayer = (
  url: string,
  config: ObservabilityConfig,
): Layer.Layer<never, never, never> =>
  Layer.effect(Tracer.Tracer)(
    OtlpTracer.make({
      url,
      resource: Option.match(Option.fromNullishOr(config.otlpServiceName), {
        onNone: () => undefined,
        onSome: (serviceName) => ({ serviceName }),
      }),
    }).pipe(Effect.map((delegate) => makeNdjsonTracer({ delegate }))),
  ).pipe(Layer.provide(Layer.mergeAll(FetchHttpClient.layer, OtlpSerialization.layerJson)));

// ============================================================================
// Helpers
// ============================================================================

const parseLogLevel = (value: string | undefined): LogLevel.LogLevel =>
  Match.value(value?.toLowerCase()).pipe(
    Match.when("trace", () => LOG_LEVEL.TRACE),
    Match.when("debug", () => LOG_LEVEL.DEBUG),
    Match.whenOr("warn", "warning", () => LOG_LEVEL.WARN),
    Match.when("error", () => LOG_LEVEL.ERROR),
    Match.when("fatal", () => LOG_LEVEL.FATAL),
    Match.when("none", () => LOG_LEVEL.NONE),
    Match.orElse(() => LOG_LEVEL.INFO),
  );
