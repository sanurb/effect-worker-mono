/**
 * NDJSON Tracer
 * Emits completed spans as newline-delimited JSON records through the
 * designated stdout sink.
 * @module
 */

import type { Context } from "effect";
import { Boolean, Cause, Exit, Layer, Match, Option, Predicate, Tracer } from "effect";

import { reportSinkError, writeNdjsonLine } from "./ndjson-sink";
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
  readonly attributes = new Map<string, unknown>();
  readonly events: Array<TraceRecordSpanEvent> = [];
  readonly links: Array<Tracer.SpanLink>;

  // `status` is declared non-readonly here. The `Tracer.Span` interface marks
  // it `readonly`, but the class is allowed to widen that contract so `end()`
  // can transition Started -> Ended without a cast — the same shape Effect's
  // own `NativeSpan` uses.
  status: Tracer.SpanStatus;

  constructor(
    readonly name: string,
    readonly parent: Option.Option<Tracer.AnySpan>,
    readonly annotations: Context.Context<never>,
    readonly sampled: boolean,
    readonly kind: Tracer.SpanKind,
    readonly startTime: bigint,
    links: ReadonlyArray<Tracer.SpanLink>,
    private readonly delegateSpan?: Tracer.Span,
  ) {
    this.traceId = Option.getOrUndefined(parent)?.traceId ?? randomTraceId();
    this.spanId = randomSpanId();
    this.status = { _tag: "Started", startTime };
    this.links = Array.from(links);
  }

  end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
    // Idempotent: the first Started -> Ended transition emits and forwards;
    // any subsequent end() call is a no-op. Dispatch via Match.tag keeps the
    // decision declarative and exhaustive across the span status union.
    Match.value(this.status).pipe(
      Match.tag("Started", (started) => {
        this.status = {
          _tag: "Ended",
          startTime: started.startTime,
          endTime,
          exit,
        };
        this.delegateSpan?.end(endTime, exit);
        writeTraceRecord(this);
        return undefined;
      }),
      Match.tag("Ended", () => undefined),
      Match.exhaustive,
    );
  }

  attribute(key: string, value: unknown): void {
    this.attributes.set(key, value);
    this.delegateSpan?.attribute(key, value);
  }

  event(name: string, startTime: bigint, attributes?: Record<string, unknown>): void {
    this.events.push({
      name,
      timeUnixNano: startTime.toString(),
      ...Option.match(Option.fromNullishOr(attributes), {
        onNone: () => ({}),
        onSome: (a) => ({ attributes: sanitizeRecord(a) }),
      }),
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
      // Root spans discard any inherited parent; non-root spans inherit the
      // caller's parent. `Boolean.match` makes the intent explicit.
      const effectiveParent = Boolean.match(root, {
        onTrue: () => Option.none<Tracer.AnySpan>(),
        onFalse: () => parent,
      });
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

/**
 * Writes a trace record to the NDJSON sink if the span has transitioned to
 * Ended. Started spans are no-ops — the emission is driven by `NdjsonSpan.end`.
 */
const writeTraceRecord = (span: NdjsonSpan): void =>
  Match.value(span.status).pipe(
    Match.tag("Ended", (ended) => emitEndedSpan(span, ended)),
    Match.tag("Started", () => undefined),
    Match.exhaustive,
  );

/** Serializes and emits one Ended span. Failures are reported to the sink. */
const emitEndedSpan = (
  span: NdjsonSpan,
  status: Extract<Tracer.SpanStatus, { _tag: "Ended" }>,
): void => {
  const record: TraceRecord = {
    _tag: "span",
    name: span.name,
    traceId: span.traceId,
    spanId: span.spanId,
    ...Option.match(span.parent, {
      onNone: (): { readonly parentSpanId?: string } => ({}),
      onSome: (parent) => ({ parentSpanId: parent.spanId }),
    }),
    startTimeUnixNano: status.startTime.toString(),
    endTimeUnixNano: status.endTime.toString(),
    durationMs: Number(status.endTime - status.startTime) / 1_000_000,
    status: toRecordStatus(status.exit),
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
    writeNdjsonLine(JSON.stringify(record));
  } catch (error) {
    reportSinkError("[observability] failed to serialize span record", {
      span: span.name,
      error: describeError(error),
    });
  }
};

/** Maps an Exit into the flat NDJSON span-status enum. */
const toRecordStatus = (exit: Exit.Exit<unknown, unknown>): TraceRecord["status"] =>
  Exit.match(exit, {
    onSuccess: () => SPAN_STATUS.OK,
    onFailure: (cause) =>
      Boolean.match(Cause.hasInterruptsOnly(cause), {
        onTrue: () => SPAN_STATUS.INTERRUPTED,
        onFalse: () => SPAN_STATUS.ERROR,
      }),
  });

/**
 * Translates a span from our wrapper into a delegate-friendly span so the
 * external tracer records reference the real (non-wrapper) span identity.
 * Non-wrapper spans pass through unchanged.
 */
const toDelegateSpan = (span: Option.Option<Tracer.AnySpan>): Option.Option<Tracer.AnySpan> =>
  Option.map(span, (inner) =>
    Match.value(inner).pipe(
      Match.when(
        (v): v is NdjsonSpan => v instanceof NdjsonSpan,
        (nd) =>
          nd.delegate ??
          Tracer.externalSpan({
            spanId: nd.spanId,
            traceId: nd.traceId,
            sampled: nd.sampled,
            annotations: nd.annotations,
          }),
      ),
      Match.orElse(() => inner),
    ),
  );

const toDelegateLink = (link: Tracer.SpanLink): Tracer.SpanLink => ({
  span: Option.getOrElse(toDelegateSpan(Option.some(link.span)), () => link.span),
  attributes: link.attributes,
});

const sanitizeRecord = (input: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).map(([key, value]) => [key, sanitizeValue(value)]));

/**
 * Converts any value into a JSON-safe representation, guarding against
 * cycles, BigInts, errors, and host objects. The `seen` set prevents
 * infinite recursion on self-referential structures.
 */
const sanitizeValue = (value: unknown, seen: WeakSet<object> = new WeakSet()): unknown =>
  Match.value(value).pipe(
    Match.when(Match.bigint, (v) => v.toString()),
    Match.when(Match.null, () => null),
    Match.when(Match.string, (v) => v),
    Match.when(Match.number, (v) => v),
    Match.when(Match.boolean, (v) => v),
    Match.when(Match.undefined, () => "undefined"),
    Match.when(Predicate.isFunction, (fn) => `[function ${fn.name || "anonymous"}]`),
    Match.when(Match.instanceOf(Error), (e) => ({
      name: e.name,
      message: e.message,
      stack: e.stack,
    })),
    Match.when(
      (v: unknown): v is ReadonlyArray<unknown> => Array.isArray(v),
      (arr) => arr.map((item) => sanitizeValue(item, seen)),
    ),
    Match.when(Match.instanceOf(Map), (map) =>
      Object.fromEntries(
        Array.from(map.entries()).map(([key, item]) => [String(key), sanitizeValue(item, seen)]),
      ),
    ),
    Match.when(Match.instanceOf(Set), (set) =>
      Array.from(set.values()).map((item) => sanitizeValue(item, seen)),
    ),
    Match.when(Match.record, (obj) => sanitizeObject(obj, seen)),
    Match.orElse((v: unknown) => String(v)),
  );

/**
 * Recursively sanitizes a plain object. Returns `"[circular]"` when the
 * same reference has already been visited higher in the traversal.
 */
const sanitizeObject = (obj: { [x: PropertyKey]: unknown }, seen: WeakSet<object>): unknown =>
  Option.match(
    Option.liftPredicate(obj, (o) => !seen.has(o)),
    {
      onNone: () => "[circular]",
      onSome: (o) => {
        seen.add(o);
        return Object.fromEntries(
          Object.entries(o).map(([key, item]) => [key, sanitizeValue(item, seen)]),
        );
      },
    },
  );

/** Best-effort human-readable description of an unknown throwable. */
const describeError = (error: unknown): string =>
  Match.value(error).pipe(
    Match.when(Match.instanceOf(Error), (e) => e.message),
    Match.orElse(() => String(error)),
  );

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
