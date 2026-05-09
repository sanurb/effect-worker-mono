/**
 * Common Errors
 *
 * Generic error types shared across the application.
 *
 * @module
 */
import { Schema as S } from "effect";

import { HTTP_STATUS } from "./status";

export class NotFoundError extends S.TaggedErrorClass<NotFoundError>()(
  "NotFoundError",
  {
    path: S.String,
    message: S.String,
  },
  { httpApiStatus: HTTP_STATUS.NotFound },
) {}

export class ValidationError extends S.TaggedErrorClass<ValidationError>()(
  "ValidationError",
  {
    message: S.String,
    errors: S.Array(S.String),
  },
  { httpApiStatus: HTTP_STATUS.BadRequest },
) {}

export class CloudflareBindingsError extends S.TaggedErrorClass<CloudflareBindingsError>()(
  "CloudflareBindingsError",
  { message: S.String },
  { httpApiStatus: HTTP_STATUS.InternalServerError },
) {}

export class DatabaseConnectionError extends S.TaggedErrorClass<DatabaseConnectionError>()(
  "DatabaseConnectionError",
  { message: S.String },
  { httpApiStatus: HTTP_STATUS.ServiceUnavailable },
) {}
