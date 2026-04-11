import { QueryPromise } from "drizzle-orm";
import { PgSelectBase } from "drizzle-orm/pg-core";
/**
 * Drizzle ORM Effect Patch
 *
 * Makes Drizzle query objects yieldable in Effect.gen() generators.
 * This replaces the removed @effect/sql-drizzle package for Effect v4.
 *
 * @module
 */
import { Effect } from "effect";
import { pipeArguments } from "effect/Pipeable";
import { SqlError } from "effect/unstable/sql";
import { SingleShotGen } from "effect/Utils";

declare module "drizzle-orm" {
  export interface QueryPromise<T> extends Effect.Effect<T, SqlError.SqlError> {}
}

// Monkey-patch QueryPromise / PgSelectBase so Drizzle query objects are
// yieldable in `Effect.gen()`. The runtime prototype is augmented with three
// methods; the matching type contract lives in the `declare module` above.
//
// We use a typed cast (no `any`) instead of `Object.assign`, because
// `Object.assign` returns the patched prototype which TypeScript then sees as
// a floating Effect-able value (`@effect/tsgo` rule TS377058).
type DrizzlePatchProto = {
  [Symbol.iterator]: (this: QueryPromise<unknown>) => SingleShotGen<unknown, unknown>;
  asEffect: (this: { execute: () => Promise<unknown> }) => Effect.Effect<
    unknown,
    SqlError.SqlError
  >;
  pipe: (this: QueryPromise<unknown>) => unknown;
};

const queryPromiseProto = QueryPromise.prototype as unknown as DrizzlePatchProto;

queryPromiseProto[Symbol.iterator] = function (this: QueryPromise<unknown>) {
  return new SingleShotGen(this.asEffect());
};

queryPromiseProto.asEffect = function (this: { execute: () => Promise<unknown> }) {
  return Effect.tryPromise({
    try: () => this.execute(),
    catch: (cause) => new SqlError.SqlError({ cause }),
  });
};

queryPromiseProto.pipe = function (this: QueryPromise<unknown>) {
  // `pipeArguments` requires the live `IArguments` object, not a rest array.
  // eslint-disable-next-line prefer-rest-params -- effect/Pipeable contract
  return pipeArguments(this.asEffect(), arguments);
};

const pgSelectProto = PgSelectBase.prototype as unknown as DrizzlePatchProto;

pgSelectProto[Symbol.iterator] = function (this: QueryPromise<unknown>) {
  return new SingleShotGen(this.asEffect());
};

pgSelectProto.asEffect = function (this: { execute: () => Promise<unknown> }) {
  return Effect.tryPromise({
    try: () => this.execute(),
    catch: (cause) => new SqlError.SqlError({ cause }),
  });
};

pgSelectProto.pipe = function (this: QueryPromise<unknown>) {
  // eslint-disable-next-line prefer-rest-params -- effect/Pipeable contract
  return pipeArguments(this.asEffect(), arguments);
};
