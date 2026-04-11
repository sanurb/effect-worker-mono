import { WorkerApi } from "@repo/contracts";
import { UserQueries } from "@repo/db";
import { Effect } from "effect";
/**
 * Users Handler Implementation
 *
 * @module
 */
import { HttpApiBuilder } from "effect/unstable/httpapi";

/**
 * Users endpoint handler implementation.
 */
export const UsersGroupLive = HttpApiBuilder.group(WorkerApi, "users", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        const users = yield* UserQueries.findAllUsers;
        return { users, total: users.length };
      }),
    )
    .handle("get", ({ params: { id } }) => UserQueries.findUserById(id))
    .handle("create", ({ payload }) => UserQueries.createUser(payload)),
);
