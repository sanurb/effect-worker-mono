/**
 * User Errors
 *
 * @module
 */
import { Schema as S } from "effect";

import { UserIdSchema } from "../schemas/user";
import { HTTP_STATUS } from "./status";

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
