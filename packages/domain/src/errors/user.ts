/**
 * User Errors
 *
 * Domain error classes with HTTP status annotations.
 *
 * `HttpApiSchema.status("BadRequest")` (effect@4.0.0-beta.49+) is the new
 * literal API but it's a Schema modifier, not class-preserving — applying it
 * to a `TaggedErrorClass` strips the constructor. Until effect ships a
 * class-aware variant, name the status codes locally to avoid magic numbers
 * while keeping `new UserCreationError({...})` constructable.
 *
 * @module
 */
import { Schema as S } from "effect";
import type { HttpApiSchema } from "effect/unstable/httpapi";

import { UserIdSchema } from "../schemas/user";

const HTTP_STATUS = {
  BadRequest: 400,
  NotFound: 404,
} as const satisfies Partial<Record<HttpApiSchema.StatusLiteral, number>>;

export class UserCreationError extends S.TaggedErrorClass<UserCreationError>()(
  "UserCreationError",
  {
    email: S.String,
    name: S.String,
  },
  { httpApiStatus: HTTP_STATUS.BadRequest },
) {}

export class UserNotFoundError extends S.TaggedErrorClass<UserNotFoundError>()(
  "UserNotFoundError",
  {
    id: UserIdSchema,
    message: S.String,
  },
  { httpApiStatus: HTTP_STATUS.NotFound },
) {}
