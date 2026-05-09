/**
 * Database Adapter Errors
 *
 * Failure modes produced by the persistence adapter. Lives here, not in
 * `@repo/domain`, because connection failures are an adapter concern — the
 * domain core has no opinion on how persistence is realised.
 *
 * @module
 */
import { Schema as S } from "effect";

export class DatabaseConnectionError extends S.TaggedErrorClass<DatabaseConnectionError>()(
  "DatabaseConnectionError",
  { message: S.String },
  { httpApiStatus: 503 },
) {}
