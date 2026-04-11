/**
 * NDJSON Tracer
 * Emits completed spans as newline-delimited JSON records to stdout.
 * @module
 */

import type { ServiceMap } from "effect";
import { Cause, Exit, Layer, Tracer } from "effect";

import {
  SPAN_STATUS,
  type SpanEvent as TraceRecordSpanEvent,
  type SpanLink as TraceRecordSpanLink,
  type TraceRecord,
} from "./TraceRecord";

// ============================================================================
// Internal models
// ============================================================================

interface NdjsonTracerOptions {
  readonly delegate?: Tracer.Tracer;
}

class NdjsonSpan implements Tracer.Span {
  readonly _tag = "Span";
  readonly traceId: string;
  readonly spanId: string;
  readonly status: Tracer.SpanStatus;
  readonly attributes = new Map<string, unknown>();
  readonly events: Array<TraceRecordSpanEvent> = [];
  readonly links: Array<Tracer.SpanLink>;

  private ended = false;

  constructor(
    readonly name: string,
    readonly parent: Tracer.AnySpan | undefined,
    readonly annotations: ServiceMap.ServiceMap<never>,
    readonly sampled: boolean,
    readonly kind: Tracer.SpanKind,
    readonly startTime: bigint,
    links: ReadonlyArray<Tracer.SpanLink>,
    private readonly delegateSpan?: Tracer.Span,
  ) {
    this.traceId = parent ? parent.traceId : randomTraceId();
    this.spanId = randomSpanId();
    this.status = { _tag: "Started", startTime };
    this.links = Array.from(links);
  }

  end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
    if (this.ended) {
      return;
    }

    this.ended = true;
    (this as { status: Tracer.SpanStatus }).status = {
      _tag: "Ended",
      startTime: this.startTime,
      endTime,
      exit,
    };

    this.delegateSpan?.end(endTime, exit);
    writeTraceRecord(this);
  }

  attribute(key: string, value: unknown): void {
    this.attributes.set(key, value);
    this.delegateSpan?.attribute(key, value);
  }

  event(name: string, startTime: bigint, attributes?: Record<string, unknown>): void {
    this.events.push({
      name,
      timeUnixNano: startTime.toString(),
      ...(attributes ? { attributes: sanitizeRecord(attributes) } : {}),
    });

    this.delegateSpan?.event(name, startTime, attributes);
  }

  addLinks(links: ReadonlyArray<Tracer.SpanLink>): void {
    this.links.push(...links);
    this.delegateSpan?.addLinks(links.map(toDelegateLink));
  }

  get delegate(): Tracer.Span | undefined {
    return this.delegateSpan;
  }
}

// ============================================================================
// Tracer construction
// ============================================================================

export const makeNdjsonTracer = (options: NdjsonTracerOptions = {}): Tracer.Tracer => {
  const { delegate } = options;
  // Capture and bind the delegate's context handler once. `bind` preserves the
  // `this` reference at call time, so the closure does not need a non-null
  // assertion against `delegate.context` later.
  const delegateContext = delegate?.context?.bind(delegate);

  return Tracer.make({
    span({ name, parent, annotations, links, startTime, kind, root, sampled }) {
      const effectiveParent = root ? undefined : parent;
      const delegateParent = toDelegateSpan(effectiveParent);
      const delegateSpan = delegate?.span({
        name,
        parent: delegateParent,
        annotations,
        links: links.map(toDelegateLink),
        startTime,
        kind,
        root,
        sampled,
      });

      return new NdjsonSpan(
        name,
        effectiveParent,
        annotations,
        sampled,
        kind,
        startTime,
        links,
        delegateSpan,
      );
    },
    context: delegateContext,
  });
};

export const NdjsonTracerLive = Layer.succeed(Tracer.Tracer)(makeNdjsonTracer());

// ============================================================================
// Serialization
// ============================================================================

const writeTraceRecord = (span: NdjsonSpan): void => {
  if (span.status._tag !== "Ended") {
    return;
  }

  const record: TraceRecord = {
    _tag: "span",
    name: span.name,
    traceId: span.traceId,
    spanId: span.spanId,
    ...(span.parent ? { parentSpanId: span.parent.spanId } : {}),
    startTimeUnixNano: span.status.startTime.toString(),
    endTimeUnixNano: span.status.endTime.toString(),
    durationMs: Number(span.status.endTime - span.status.startTime) / 1_000_000,
    status: toRecordStatus(span.status.exit),
    attributes: sanitizeRecord(Object.fromEntries(span.attributes)),
    events: span.events,
    links: span.links.map(
      (link): TraceRecordSpanLink => ({
        traceId: link.span.traceId,
        spanId: link.span.spanId,
        attributes: sanitizeRecord(link.attributes),
      }),
    ),
    kind: span.kind,
  };

  try {
    console.log(JSON.stringify(record));
  } catch (error) {
    console.warn("[observability] failed to serialize span record", {
      span: span.name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const toRecordStatus = (exit: Exit.Exit<unknown, unknown>) => {
  if (Exit.isSuccess(exit)) {
    return SPAN_STATUS.OK;
  }

  return Cause.hasInterruptsOnly(exit.cause) ? SPAN_STATUS.INTERRUPTED : SPAN_STATUS.ERROR;
};

const toDelegateSpan = (span: Tracer.AnySpan | undefined): Tracer.AnySpan | undefined => {
  if (span === undefined) {
    return undefined;
  }

  if (span instanceof NdjsonSpan) {
    return (
      span.delegate ??
      Tracer.externalSpan({
        spanId: span.spanId,
        traceId: span.traceId,
        sampled: span.sampled,
        annotations: span.annotations,
      })
    );
  }

  return span;
};

const toDelegateLink = (link: Tracer.SpanLink): Tracer.SpanLink => ({
  span: toDelegateSpan(link.span) ?? link.span,
  attributes: link.attributes,
});

const sanitizeRecord = (input: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, sanitizeValue(value)]));

const sanitizeValue = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "undefined") {
    return "undefined";
  }

  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }

  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, item]) => [String(key), sanitizeValue(item, seen)]),
    );
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map((item) => sanitizeValue(item, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }

    seen.add(value);

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeValue(item, seen)]),
    );
  }

  return String(value);
};

// ============================================================================
// IDs
// ============================================================================

const randomTraceId = (): string => randomHex(16);

const randomSpanId = (): string => randomHex(8);

const randomHex = (bytes: number): string => {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (value) => value.toString(16).padStart(2, "0")).join("");
};
