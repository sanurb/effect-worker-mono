import {
  UserSchema,
  UserIdPathSchema,
  CreateUserSchema,
  UserNotFoundError,
  UserCreationError,
} from "@repo/domain";
import { Schema as S } from "effect";
/**
 * Users RPC Procedures
 *
 * RPC procedure definitions for user operations.
 * Reuses domain schemas and errors — no duplication with HTTP contracts.
 *
 * @module
 */
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { RpcDatabaseMiddleware } from "../../middleware";

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Users list response schema.
 * Composes the domain UserSchema into a paginated envelope.
 */
export const RpcUsersListSchema = S.Struct({
  users: S.Array(UserSchema),
  total: S.Number,
});

// ============================================================================
// RPC Procedure Definitions
// ============================================================================

/**
 * Get a user by ID.
 */
export const getUser = Rpc.make("getUser", {
  payload: S.Struct({ id: UserIdPathSchema.fields.id }),
  success: UserSchema,
  error: UserNotFoundError,
}).middleware(RpcDatabaseMiddleware);

/**
 * List all users.
 */
export const listUsers = Rpc.make("listUsers", {
  success: RpcUsersListSchema,
}).middleware(RpcDatabaseMiddleware);

/**
 * Create a new user.
 */
export const createUser = Rpc.make("createUser", {
  payload: CreateUserSchema,
  success: UserSchema,
  error: UserCreationError,
}).middleware(RpcDatabaseMiddleware);

// ============================================================================
// RPC Group
// ============================================================================

/**
 * Users RPC group containing all user-related procedures.
 */
export const UsersRpc = RpcGroup.make(getUser, listUsers, createUser);
