# Observability

## Overview

This monorepo uses a local-first observability model designed for Cloudflare Workers:

- Human-readable logs go to stdout for fast feedback while developing.
- Completed spans are emitted as NDJSON so they can be captured and queried locally.
- OTLP trace export is optional when you want to ship traces to a collector.
- Local debugging does not require a hosted observability backend.

## Architecture

Observability is split into three layers that run together:

1. **Human logs** — Effect `consolePretty()` output plus `tracerLogger` logs go to stdout.
2. **NDJSON spans** — a custom tracer writes completed spans as one JSON object per line to stdout.
3. **OTLP export** — traces can also be sent to a remote collector over HTTP when configured.

This runs on Cloudflare Workers, so there is no local filesystem inside the runtime itself. Logs and span records are written to stdout and captured externally by the local development tooling.

## Quick Start

Run either worker with trace capture enabled:

```bash
pnpm dev:traced:api    # API with trace capture
pnpm dev:traced:rpc    # RPC with trace capture
```

Captured spans are written to `.traces/spans.ndjson`.

## Trace Record Format

Each line in `.traces/spans.ndjson` is a complete JSON span record.

```json
{
  "_tag": "span",
  "name": "UserQueries.findUserById",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "startTimeUnixNano": "1712797510000000000",
  "endTimeUnixNano": "1712797510012300000",
  "durationMs": 12.3,
  "status": "ok",
  "attributes": {},
  "events": [],
  "links": [],
  "kind": "internal"
}
```

Important fields:

- `traceId` groups all spans produced by one request or workflow.
- `spanId` identifies the current span.
- `parentSpanId` links a child span back to its parent when present.
- `events` stores in-span log messages and other span events.
- `status` is `ok`, `error`, or `interrupted`.

## Inspecting Traces

Use `jq` to inspect the trace file directly:

```bash
tail -20 .traces/spans.ndjson | jq .
jq 'select(.status == "error")' .traces/spans.ndjson
jq 'select(.durationMs > 100)' .traces/spans.ndjson
jq 'select(.traceId == "<id>")' .traces/spans.ndjson
jq '.events[]' .traces/spans.ndjson
```

## Adding Instrumentation

Use the standard Effect tracing APIs already present in this codebase:

- `Effect.fn("OperationName")` — creates a named effect function with an automatic span. This is already the pattern in `packages/db/src/queries/users.ts`, for example `UserQueries.findUserById` and `UserQueries.createUser`.
- `Effect.withSpan("name")` — wraps any effect in an explicit span.
- `Effect.annotateCurrentSpan({ key: "value" })` — attaches attributes to the current span.
- `Effect.log("message")` — logs inside a span become span events through `tracerLogger`.

Example shape:

```ts
const program = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan({ userId });
  yield* Effect.log("Loading user");
  return yield* UserQueries.findUserById(userId);
}).pipe(Effect.withSpan("UsersService.getUser"));
```

Prefer naming spans after the business operation, not the transport detail. `UserQueries.findUserById` tells the truth; `handleGet` does not.

## Environment Variables

Set observability configuration through Wrangler vars or `.dev.vars` secrets:

| Variable            | Default   | Description                                                                    |
| ------------------- | --------- | ------------------------------------------------------------------------------ |
| `LOG_LEVEL`         | `info`    | Minimum log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`, `none`) |
| `OTLP_TRACES_URL`   | _(empty)_ | OTLP endpoint for remote trace export                                          |
| `OTLP_SERVICE_NAME` | _(empty)_ | Service name used in OTLP resource attributes                                  |

Set these in the `vars` section of `wrangler.jsonc`, or use `.dev.vars` when you do not want local values committed.

## Optional OTLP Export

To enable remote trace export:

1. Set `OTLP_TRACES_URL` to your collector endpoint.
2. Optionally set `OTLP_SERVICE_NAME`.
3. Restart the worker.

Traces are exported as JSON over HTTP. NDJSON console output continues even when OTLP export is enabled, so local inspection still works.

## Local LGTM Stack

```bash
# Run Grafana LGTM (Loki, Grafana, Tempo, Mimir) as a single container
docker run --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 -d grafana/otel-lgtm:latest

# Configure worker to send traces
# In wrangler.jsonc or .dev.vars:
# OTLP_TRACES_URL=http://localhost:4318/v1/traces
# OTLP_SERVICE_NAME=effect-worker-api

# Open Grafana
open http://localhost:3000  # admin/admin

# Navigate to Explore → Tempo to view traces

# Stop LGTM
docker stop lgtm && docker rm lgtm
```

## Agent Integration

For agents inspecting this repository:

- Trace file: `.traces/spans.ndjson`
- The file is machine-readable NDJSON: one JSON object per line.
- Every span record is self-contained and tagged with `_tag: "span"`.
- Use `traceId` to correlate all spans produced by one request.
- Use `parentSpanId` to reconstruct the span tree.
- Use `events` to inspect logs that occurred inside the span.
- Use `status` to distinguish `ok`, `error`, and `interrupted` spans.

## Trace Capture Script

`scripts/trace-sink.ts` separates structured span records from human-readable logs:

```bash
# Manual usage:
pnpm dev:api 2>&1 | bun scripts/trace-sink.ts

# Human logs pass through to terminal
# Span records are captured to .traces/spans.ndjson
```

This keeps normal Wrangler output readable while extracting span records into a file that humans and agents can query.

## Housekeeping

```bash
pnpm trace:clear        # Delete trace file
rm -rf .traces/         # Remove entire trace directory
```

`.traces/` is gitignored.
