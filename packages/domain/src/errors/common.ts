/**
 * Common Domain Errors
 *
 * Generic error types shared across the application.
 *
 * Adapter-specific failure modes (Cloudflare bindings, database connection)
 * live with their adapters in `@repo/cloudflare` and `@repo/db` respectively.
 *
 * @module
 */
import { Schema as S } from "effect";

export class NotFoundError extends S.TaggedErrorClass<NotFoundError>()(
  "NotFoundError",
  {
    path: S.String,
    message: S.String,
  },
  { httpApiStatus: 404 },
) {}

export class ValidationError extends S.TaggedErrorClass<ValidationError>()(
  "ValidationError",
  {
    message: S.String,
    errors: S.Array(S.String),
  },
  { httpApiStatus: 400 },
) {}
