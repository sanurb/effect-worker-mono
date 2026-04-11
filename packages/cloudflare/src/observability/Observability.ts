/**
 * Observability Layer
 * Composes logging, tracing, and optional OTLP export for Cloudflare Workers.
 * @module
 */

import type { LogLevel } from "effect";
import { Effect, Layer, References, Tracer } from "effect";
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

  const tracerLayer = config.otlpTracesUrl
    ? makeDelegatingTracerLayer(config.otlpTracesUrl, config)
    : Layer.succeed(Tracer.Tracer)(makeNdjsonTracer());

  return Layer.mergeAll(baseLayer, tracerLayer);
};

const makeDelegatingTracerLayer = (
  url: string,
  config: ObservabilityConfig,
): Layer.Layer<never, never, never> =>
  Layer.effect(Tracer.Tracer)(
    OtlpTracer.make({
      url,
      resource: config.otlpServiceName ? { serviceName: config.otlpServiceName } : undefined,
    }).pipe(Effect.map((delegate) => makeNdjsonTracer({ delegate }))),
  ).pipe(Layer.provide(Layer.mergeAll(FetchHttpClient.layer, OtlpSerialization.layerJson)));

// ============================================================================
// Helpers
// ============================================================================

const parseLogLevel = (value: string | undefined): LogLevel.LogLevel => {
  switch (value?.toLowerCase()) {
    case "trace":
      return LOG_LEVEL.TRACE;
    case "debug":
      return LOG_LEVEL.DEBUG;
    case "warn":
    case "warning":
      return LOG_LEVEL.WARN;
    case "error":
      return LOG_LEVEL.ERROR;
    case "fatal":
      return LOG_LEVEL.FATAL;
    case "none":
      return LOG_LEVEL.NONE;
    case "info":
    default:
      return LOG_LEVEL.INFO;
  }
};
