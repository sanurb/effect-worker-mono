/**
 * NDJSON Stdout Sink
 *
 * I/O boundary for the NDJSON tracer. Cloudflare Workers route `console.log`
 * to wrangler's stdout stream, which `scripts/trace-sink.ts` pipes into
 * `.traces/spans.ndjson` during local development. This module is the only
 * place `console.log` / `console.warn` are the correct primitives — the
 * tracer itself routes through these helpers instead of calling the host
 * methods directly, so `no-console-log` stays scoped to hand-written Effect
 * code and this single I/O boundary.
 *
 * @module
 */

/** Writes a single NDJSON line to the worker's stdout stream. */
export const writeNdjsonLine = (line: string): void => {
  console.log(line);
};

/**
 * Reports a sink-level failure to the worker's diagnostic stream.
 *
 * Used when serialization of a span record fails. The tracer never throws
 * from its own finalizer; instead it surfaces the failure here so it lands
 * in the same stream wrangler/observability is watching.
 */
export const reportSinkError = (
  message: string,
  fields: Record<string, unknown>,
): void => {
  console.warn(message, fields);
};
