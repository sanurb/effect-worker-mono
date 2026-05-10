/**
 * Process API Route Errors
 *
 * Tagged error classes used by the `/api/process` route. Co-located with
 * the route in a dedicated `errors.ts` module so that `tagged-error-location`
 * can enforce "tagged error classes live next to other error definitions".
 *
 * @module
 */
import { Schema as S } from "effect";

/**
 * Raised when the request payload validates structurally but is empty or
 * otherwise unprocessable for the requested operation.
 */
export class ProcessingError extends S.TaggedErrorClass<ProcessingError>()("ProcessingError", {
  message: S.String,
}) {}
