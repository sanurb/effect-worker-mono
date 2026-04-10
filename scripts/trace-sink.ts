#!/usr/bin/env bun
/**
 * Trace Sink
 * @module
 *
 * Captures NDJSON span records from wrangler dev output and persists
 * them to .traces/spans.ndjson for local debugging.
 *
 * Usage:
 *   pnpm dev:api 2>&1 | bun scripts/trace-sink.ts
 *   # or via package.json script:
 *   pnpm dev:traced:api
 */
import { createWriteStream, type WriteStream } from "node:fs"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { createInterface } from "node:readline"

// ============================================================================
// Constants
// ============================================================================

const TRACES_DIR = join(process.cwd(), ".traces")
const TRACE_FILE = join(TRACES_DIR, "spans.ndjson")
const FLUSH_INTERVAL_MS = 100
const MAX_BUFFERED_RECORDS = 10

// ============================================================================
// Types
// ============================================================================

interface SpanRecord {
  readonly _tag: "span"
}

// ============================================================================
// Guards
// ============================================================================

const isSpanRecord = (value: unknown): value is SpanRecord => {
  if (typeof value !== "object" || value === null) {
    return false
  }

  return (value as Record<string, unknown>)._tag === "span"
}

// ============================================================================
// Parsing
// ============================================================================

const parseSpanLine = (line: string): string | null => {
  try {
    const parsed = JSON.parse(line) as unknown
    return isSpanRecord(parsed) ? line : null
  } catch {
    return null
  }
}

// ============================================================================
// File IO
// ============================================================================

const writeToStream = (stream: WriteStream, payload: string): Promise<void> =>
  new Promise((resolve, reject) => {
    stream.write(payload, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

const closeStream = (stream: WriteStream): Promise<void> =>
  new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      stream.off("error", onError)
      reject(error)
    }

    stream.once("error", onError)
    stream.end(() => {
      stream.off("error", onError)
      resolve()
    })
  })

// ============================================================================
// Main
// ============================================================================

await mkdir(TRACES_DIR, { recursive: true })

const traceStream = createWriteStream(TRACE_FILE, { flags: "a" })
const stdin = createInterface({ input: process.stdin, crlfDelay: Infinity })

let buffer: Array<string> = []
let isFlushing = false
let exitCode = 0

const flushBuffer = async (): Promise<void> => {
  if (isFlushing || buffer.length === 0) {
    return
  }

  const pending = buffer
  buffer = []
  isFlushing = true

  try {
    await writeToStream(traceStream, `${pending.join("\n")}\n`)
  } catch (error) {
    buffer = [...pending, ...buffer]
    throw error
  } finally {
    isFlushing = false
  }
}

const requestShutdown = (code: number): void => {
  exitCode = code
  clearInterval(flushInterval)
  stdin.close()
}

const reportFatalError = (error: unknown): void => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  requestShutdown(1)
}

const flushInterval = setInterval(() => {
  void flushBuffer().catch(reportFatalError)
}, FLUSH_INTERVAL_MS)

flushInterval.unref?.()

const handleLine = async (line: string): Promise<void> => {
  if (line.trim().length === 0) {
    process.stdout.write(`${line}\n`)
    return
  }

  const spanLine = parseSpanLine(line)
  if (spanLine === null) {
    process.stdout.write(`${line}\n`)
    return
  }

  buffer.push(spanLine)
  if (buffer.length >= MAX_BUFFERED_RECORDS) {
    await flushBuffer()
  }
}

process.once("SIGINT", () => {
  requestShutdown(0)
})

process.once("SIGTERM", () => {
  requestShutdown(0)
})

try {
  for await (const line of stdin) {
    await handleLine(line)
  }
} catch (error) {
  reportFatalError(error)
} finally {
  clearInterval(flushInterval)
  await flushBuffer()
  await closeStream(traceStream)

  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}