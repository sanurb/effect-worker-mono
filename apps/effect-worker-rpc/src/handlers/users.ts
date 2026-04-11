/**
 * Users RPC Handlers
 *
 * Handler implementations for the users RPC procedures.
 * Domain errors from queries flow through directly — no manual mapping.
 *
 * @module
 */
import { UsersRpc } from "@repo/contracts";
import { UserQueries } from "@repo/db";
import { Effect } from "effect";

/**
 * Users RPC handler layer.
 */
export const UsersRpcHandlersLive = UsersRpc.toLayer({
  getUser: ({ id }) => UserQueries.findUserById(id),

  listUsers: () =>
    Effect.map(UserQueries.findAllUsers, (users) => ({ users, total: users.length })),

  createUser: (data) => UserQueries.createUser(data),
});
