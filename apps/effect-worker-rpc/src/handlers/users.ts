import { UsersRpc } from "@repo/contracts";
import { UserQueries } from "@repo/db";
/**
 * Users RPC Handlers
 *
 * Handler implementations for the users RPC procedures.
 * Domain errors from queries flow through directly — no manual mapping.
 *
 * @module
 */
import { Effect } from "effect";

/**
 * Users RPC handler layer.
 */
export const UsersRpcHandlersLive = UsersRpc.toLayer({
  getUser: ({ id }) => UserQueries.findUserById(id),

  listUsers: () =>
    Effect.gen(function* () {
      const users = yield* UserQueries.findAllUsers;
      return { users, total: users.length };
    }),

  createUser: (data) => UserQueries.createUser(data),
});
