/**
 * User Errors
 *
 * @module
 */
import { Schema as S } from "effect";

import { UserIdSchema } from "../schemas/user";

export class UserCreationError extends S.TaggedErrorClass<UserCreationError>()(
  "UserCreationError",
  {
    email: S.String,
    name: S.String,
  },
  { httpApiStatus: 400 },
) {}

export class UserNotFoundError extends S.TaggedErrorClass<UserNotFoundError>()(
  "UserNotFoundError",
  {
    id: UserIdSchema,
    message: S.String,
  },
  { httpApiStatus: 404 },
) {}
