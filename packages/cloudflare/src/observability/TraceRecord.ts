/**
 * Trace Record Schema
 * Defines the NDJSON record format for persisted span data.
 * @module
 */

// ============================================================================
// Constants
// ============================================================================

export const SPAN_STATUS = {
  OK: "ok",
  ERROR: "error",
  INTERRUPTED: "interrupted"
} as const

export type SpanStatus = (typeof SPAN_STATUS)[keyof typeof SPAN_STATUS]

// ============================================================================
// Models
// ============================================================================

export interface SpanEvent {
  readonly name: string
  readonly timeUnixNano: string
  readonly attributes?: Record<string, unknown>
}

export interface SpanLink {
  readonly traceId: string
  readonly spanId: string
  readonly attributes?: Record<string, unknown>
}

export interface TraceRecord {
  readonly _tag: "span"
  readonly name: string
  readonly traceId: string
  readonly spanId: string
  readonly parentSpanId?: string
  readonly startTimeUnixNano: string
  readonly endTimeUnixNano: string
  readonly durationMs: number
  readonly status: SpanStatus
  readonly attributes: Record<string, unknown>
  readonly events: ReadonlyArray<SpanEvent>
  readonly links: ReadonlyArray<SpanLink>
  readonly kind: string
}
