/**
 * HTTP status codes for domain errors. Keys are constrained to
 * `HttpApiSchema.StatusLiteral` so typos fail to compile.
 *
 * @module
 */
import type { HttpApiSchema } from "effect/unstable/httpapi";

export const HTTP_STATUS = {
  BadRequest: 400,
  NotFound: 404,
  InternalServerError: 500,
  ServiceUnavailable: 503,
} as const satisfies Partial<Record<HttpApiSchema.StatusLiteral, number>>;
