/**
 * Drizzle ORM Effect Patch
 *
 * Makes Drizzle query objects yieldable in `Effect.gen()` generators.
 * Replaces the removed @effect/sql-drizzle package for Effect v4.
 *
 * The module augmentation below declares that `QueryPromise<T>` is also an
 * `Effect.Effect<T, SqlError.SqlError>` and exposes an `asEffect()` bridge.
 * With the interface merged, we can assign the monkey-patched methods
 * directly to the prototype — TypeScript sees them as pre-declared members,
 * so no `as` type assertions are needed.
 *
 * `PgSelectBase<...>` picks up the same methods because its interface merge
 * already extends `QueryPromise<TResult>`.
 *
 * @module
 */
import { QueryPromise } from "drizzle-orm";
import { PgSelectBase } from "drizzle-orm/pg-core";
import { Effect } from "effect";
import { pipeArguments } from "effect/Pipeable";
import { SqlError } from "effect/unstable/sql";
import { SingleShotGen } from "effect/Utils";

declare module "drizzle-orm" {
  interface QueryPromise<T> extends Effect.Effect<T, SqlError.SqlError> {
    /** Wraps `execute()` in an `Effect.tryPromise` with a tagged SqlError. */
    asEffect(this: QueryPromise<T>): Effect.Effect<T, SqlError.SqlError>;
  }
}

// ----------------------------------------------------------------------------
// Shared method bodies — assigned to both prototypes below.
// ----------------------------------------------------------------------------

function queryIterator(this: QueryPromise<unknown>) {
  return new SingleShotGen(this.asEffect());
}

function queryAsEffect(this: QueryPromise<unknown>): Effect.Effect<unknown, SqlError.SqlError> {
  return Effect.tryPromise({
    try: () => this.execute(),
    catch: (cause) => new SqlError.SqlError({ reason: new SqlError.UnknownError({ cause }) }),
  });
}

function queryPipe(this: QueryPromise<unknown>) {
  // `pipeArguments` requires the live `IArguments` object, not a rest array.
  // eslint-disable-next-line prefer-rest-params -- effect/Pipeable contract
  return pipeArguments(this.asEffect(), arguments);
}

// ----------------------------------------------------------------------------
// QueryPromise.prototype patch
// ----------------------------------------------------------------------------

QueryPromise.prototype[Symbol.iterator] = queryIterator;
QueryPromise.prototype.asEffect = queryAsEffect;
QueryPromise.prototype.pipe = queryPipe;

// ----------------------------------------------------------------------------
// PgSelectBase.prototype patch
//
// `PgSelectBase` interface-merges with `QueryPromise<TResult>`, so the same
// augmented method set is visible on its prototype.
// ----------------------------------------------------------------------------

PgSelectBase.prototype[Symbol.iterator] = queryIterator;
PgSelectBase.prototype.asEffect = queryAsEffect;
PgSelectBase.prototype.pipe = queryPipe;
