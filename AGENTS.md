# AGENTS.md

Agent navigation guide for the Effect Worker monorepo. Read this first, then jump to the source files named below.

## Repository Purpose

This repository is a pnpm monorepo for Cloudflare Workers built around Effect v4. It has three deployable apps and four shared packages:
- HTTP API worker: `apps/effect-worker-api`
- RPC worker: `apps/effect-worker-rpc`
- TanStack Start app on Cloudflare: `apps/tanstack-start`
- Shared packages: `@repo/domain`, `@repo/db`, `@repo/cloudflare`, `@repo/contracts`

Documentation map:
- `README.md` — top-level overview and getting started
- `docs/architecture.md` — hexagonal boundaries, responsibilities, request/data flow
- `docs/observability.md` — local-first tracing, NDJSON spans, optional OTLP
- `FP_AGENTS.md` — fp issue-tracking workflow rules

## Workspace Dependency Graph

Direct package dependencies in the current checkout:

```text
@repo/domain
└── no internal workspace dependencies

@repo/db
└── @repo/domain

@repo/cloudflare
├── @repo/db
└── @repo/domain

@repo/contracts
├── @repo/cloudflare
├── @repo/db
└── @repo/domain

apps/effect-worker-api
├── @repo/cloudflare
├── @repo/contracts
├── @repo/db
└── @repo/domain

apps/effect-worker-rpc
├── @repo/cloudflare
├── @repo/contracts
├── @repo/db
└── @repo/domain

apps/tanstack-start
└── currently self-contained; comments reference `@repo/db`, but no runtime `@repo/*` import is wired yet
```

Interpretation: `@repo/domain` is the center. Apps are the outermost composition layer. `@repo/contracts` is the shared transport surface, even though it currently depends on infrastructure service types from `@repo/cloudflare` and `@repo/db`. That coupling is real; do not document an idealized architecture the code does not have.

## Packages

### `@repo/domain`

Purpose: domain schemas, branded identifiers, and typed domain errors.

Entry point: `packages/domain/src/index.ts`
Key files:
- `packages/domain/src/schemas/user.ts` — `UserIdSchema`, `EmailSchema`, `UserSchema`, `CreateUserSchema`, `UserIdPathSchema`
- `packages/domain/src/errors/user.ts` — `UserCreationError`, `UserNotFoundError`
- `packages/domain/src/errors/common.ts` — shared tagged errors for validation, bindings, and database availability

Primary exports:
- Schemas/types: `UserIdSchema`, `UserId`, `EmailSchema`, `Email`, `UserSchema`, `User`, `CreateUserSchema`, `CreateUser`, `UserIdPathSchema`
- Errors: `UserCreationError`, `UserNotFoundError`, `NotFoundError`, `ValidationError`, `CloudflareBindingsError`, `DatabaseConnectionError`

### `@repo/db`

Purpose: relational schema, database service tag, and reusable query programs.

Entry point: `packages/db/src/index.ts`
Key files:
- `packages/db/src/schema.ts` — Drizzle `users` table
- `packages/db/src/queries/users.ts` — `UserQueries.findUserById` and `UserQueries.createUser`
- `packages/db/src/pg-drizzle/index.ts` — `PgDrizzle` tag plus layer/factory helpers

Primary exports:
- Schema: `users`, `DbUser`, `NewUser`
- Queries: `UserQueries.*` from `packages/db/src/queries/index.ts`
- Database wiring: `PgDrizzle`, `PgDrizzleLive`, `PgDrizzleLiveWithConfig`, `makePgDrizzleLayer`, `makeDrizzle`, `makeRemoteCallback`

Notes: this package depends on `@repo/domain` because query programs return domain values and domain errors, not raw Drizzle rows.

### `@repo/cloudflare`

Purpose: Cloudflare Workers integration for Effect, including request-scoped bindings and observability.

Entry point: `packages/cloudflare/src/index.ts`
Key files:
- `packages/cloudflare/src/bindings.ts` — `currentEnv`, `currentCtx`, `withCloudflareBindings`, `waitUntil`
- `packages/cloudflare/src/middleware.ts` — `CloudflareBindings` service plus middleware factories
- `packages/cloudflare/src/observability/Observability.ts` — `makeObservabilityLayer`
- `packages/cloudflare/src/observability/Tracer.ts` — NDJSON tracer implementation

Primary exports:
- Bindings bridge: `currentEnv`, `currentCtx`, `withCloudflareBindings`, `waitUntil`, `WorkerExecutionContext`
- Middleware factories: `CloudflareBindings`, `makeBindingsMiddleware`, `makeDatabaseMiddleware`
- Observability: `makeObservabilityLayer`, tracer/logger utilities, trace record types/constants

### `@repo/contracts`

Purpose: shared HTTP and RPC contracts plus middleware tags consumed by apps.

Entry point: `packages/contracts/src/index.ts`
Subpath entry points:
- `@repo/contracts/http` → `packages/contracts/src/http/index.ts`
- `@repo/contracts/rpc` → `packages/contracts/src/rpc/index.ts`

Key files:
- `packages/contracts/src/http/api.ts` — `WorkerApi` with `/api` prefix and OpenAPI support
- `packages/contracts/src/http/groups/health.ts` — health endpoint contract
- `packages/contracts/src/http/groups/users.ts` — users HTTP endpoints
- `packages/contracts/src/rpc/procedures/users.ts` — `getUser`, `listUsers`, `createUser`, `UsersRpc`
- `packages/contracts/src/middleware/*.ts` — shared HTTP/RPC middleware tags

Primary exports:
- HTTP: `WorkerApi`, `HealthGroup`, `UsersGroup`, middleware tags/errors
- RPC: `UsersRpc`, `getUser`, `listUsers`, `createUser`, RPC middleware tags
- Services: `CloudflareBindings`, `WorkerExecutionContext` re-exported for shared typing

## Applications

### `effect-worker-api`

Runtime: Cloudflare Worker via Wrangler.

Entry points:
- Worker entry: `apps/effect-worker-api/src/index.ts`
- Runtime composition: `apps/effect-worker-api/src/runtime.ts`
- Handler layer: `apps/effect-worker-api/src/handlers/index.ts`
- Middleware wiring: `apps/effect-worker-api/src/services/middleware.ts`
- Worker config: `apps/effect-worker-api/wrangler.jsonc`

Behavior: serves the HTTP API defined by `WorkerApi`, exposes OpenAPI at `/api/openapi.json`, and wires observability plus Cloudflare/database middleware.

Commands:
- Dev: `pnpm --filter effect-worker-api dev` or `pnpm dev:api`
- Test: `pnpm --filter effect-worker-api test`
- Deploy: `pnpm --filter effect-worker-api deploy`
- Build check: `pnpm --filter effect-worker-api build`

### `effect-worker-rpc`

Runtime: Cloudflare Worker via Wrangler.

Entry points:
- Worker entry: `apps/effect-worker-rpc/src/index.ts`
- Runtime composition: `apps/effect-worker-rpc/src/runtime.ts`
- Handler layer: `apps/effect-worker-rpc/src/handlers/index.ts`
- Middleware wiring: `apps/effect-worker-rpc/src/services/middleware.ts`
- Worker config: `apps/effect-worker-rpc/wrangler.jsonc`

Behavior: serves `/health` directly from the entrypoint and mounts NDJSON-serialized Effect RPC at `/rpc`.

Commands:
- Dev: `pnpm --filter effect-worker-rpc dev` or `pnpm dev:rpc`
- Test: `pnpm --filter effect-worker-rpc test`
- Deploy: `pnpm --filter effect-worker-rpc deploy`
- Build check: `pnpm --filter effect-worker-rpc build`

### `tanstack-start-on-cloudflare`

Runtime: Vite + TanStack Start on Cloudflare Workers.

Entry points:
- Worker/server entry: `apps/tanstack-start/src/server.ts`
- Client bootstrap: `apps/tanstack-start/src/start.tsx`
- Router: `apps/tanstack-start/src/router.tsx`
- Effect middleware: `apps/tanstack-start/src/server/middleware/effect-runtime.ts`
- Example server function: `apps/tanstack-start/src/server/functions/example-effect-function.ts`
- Worker config: `apps/tanstack-start/wrangler.jsonc`

Behavior: currently acts as an isolated full-stack app with an example Effect runtime middleware. It is not yet a real consumer of the shared workspace packages.

Commands:
- Dev: `pnpm --filter tanstack-start-on-cloudflare dev`
- Build: `pnpm --filter tanstack-start-on-cloudflare build`
- Serve preview: `pnpm --filter tanstack-start-on-cloudflare serve`
- Deploy: `pnpm --filter tanstack-start-on-cloudflare deploy`
- Tests: no dedicated package script at the moment

## Common Commands

Root scripts that exist now:

| Command | Purpose |
| --- | --- |
| `pnpm build` | Build shared packages (`domain`, `db`, `cloudflare`, `contracts`) |
| `pnpm check` | Run `check` in every workspace package that defines it |
| `pnpm clean` | Clean package build output under `packages/*` |
| `pnpm test` | Run Vitest from the workspace root |
| `pnpm coverage` | Run Vitest with coverage |
| `pnpm dev:api` | Run the HTTP worker in Wrangler dev mode |
| `pnpm dev:rpc` | Run the RPC worker in Wrangler dev mode |
| `pnpm dev:traced:api` | Run the HTTP worker and capture NDJSON spans to `.traces/spans.ndjson` |
| `pnpm dev:traced:rpc` | Run the RPC worker and capture NDJSON spans to `.traces/spans.ndjson` |
| `pnpm trace:inspect` | Pretty-print captured spans with `jq` |
| `pnpm trace:clear` | Remove `.traces/spans.ndjson` |

Tooling commands to know as oxlint/formatter/ast-grep land:

| Command | Use |
| --- | --- |
| `pnpm lint` | Preferred repo lint entrypoint once the root script exists |
| `pnpm format` | Preferred formatter entrypoint once the root script exists |
| `pnpm lint:ast` | Preferred ast-grep scan entrypoint once the root script exists |
| `pnpm exec oxlint .` | Direct lint fallback if the script is not present in your checkout yet |
| `pnpm exec oxfmt --check .` | Direct formatting check fallback |
| `pnpm exec sg scan` | Direct ast-grep scan fallback after `sgconfig.yml` exists |

Database-only commands live in `packages/db`: `db:push`, `db:studio`, `db:generate`, `db:migrate`.

## Architecture Rules

- Keep imports pointed inward: apps may depend on any shared package; shared packages must not import from apps.
- `@repo/domain` stays framework-light: schemas, branded types, and tagged errors only.
- `@repo/db` owns table definitions and reusable query programs. Do not scatter raw Drizzle calls through apps when a shared query belongs here.
- `@repo/cloudflare` owns Worker-specific Effect integration: env/ctx bridging, `waitUntil`, observability, and middleware factories.
- `@repo/contracts` owns transport contracts and middleware tags. Put HTTP groups under `src/http`, RPC procedures under `src/rpc`.
- App `src/index.ts` files are entrypoints only. Runtime composition belongs in `runtime.ts`; handler implementations belong in `handlers/`; app-specific middleware wiring belongs in `services/`.
- Use `src/index.ts` as the canonical package barrel. If you add a new public export, wire it there or in the documented subpath barrel.
- Name Effect operations after business work, not transport trivia. `UserQueries.findUserById` is good; `handleGet` is too vague.
- When docs disagree with source, trust `package.json`, `src/index.ts`, `runtime.ts`, and `wrangler.jsonc` over prose.

## Tooling Reference

### Effect v4 patterns in this repo

- Use `Effect.fn("Name")` for named reusable operations in shared packages.
- Compose live services with `Layer.mergeAll(...)`; apps provide the concrete layers.
- Request-scoped Cloudflare bindings are carried through `ServiceMap` references and middleware, not globals.
- HTTP uses `effect/unstable/httpapi`; RPC uses `effect/unstable/rpc` with NDJSON serialization.
- Prefer tagged domain errors exported from `@repo/domain`; let contracts map them across transport boundaries.

### Cloudflare Workers constraints

- There is no writable local filesystem inside the worker runtime. Trace capture works by writing NDJSON to stdout and collecting it outside the runtime; see `docs/observability.md`.
- Database access assumes a Hyperdrive binding exposed as `env.HYPERDRIVE.connectionString` in the worker apps.
- Both worker apps enable `nodejs_compat` in `wrangler.jsonc`; stay aware of Worker runtime limits anyway.
- Use `waitUntil` from `@repo/cloudflare` for background work you intentionally detach from the request lifecycle.

### Effect Lint Enforcement

This repository uses a two-layer linting model:

| Layer | Tool | When to use |
|-------|------|-------------|
| Structural patterns | ast-grep (`sg scan`) | Effect-specific code shapes and architectural rules |
| General TypeScript | Oxlint (`oxlint .`) | Type safety, console, unused vars, eval, eqeqeq |

Run both with: `pnpm check:all`

#### ast-grep Rule Presets

**`rules/effect/` — Effect architecture rules:**

| Rule | Targets | Severity |
|------|---------|----------|
| `no-arrow-effect-gen` | `(args) => Effect.gen(...)` — must use `Effect.fn("name")` | error |
| `no-await-in-gen` | `await` inside `Effect.gen` — use `yield*` with `Effect.tryPromise` | error |
| `no-bare-new-error` | `new Error(...)` — use `Schema.TaggedErrorClass` | error |
| `no-call-tower` | `Effect.xx(Effect.yy(...))` — build inner first, then flat pipeline | error |
| `no-console-log` | `console.*` — use `Effect.log*` | error |
| `no-data-tagged-error` | `Data.TaggedError` — v3 API, use `Schema.TaggedErrorClass` | error |
| `no-effect-all-step-sequencing` | `Effect.all(..., { concurrency: 1 })` for steps — use `andThen`/`flatMap` | error |
| `no-effect-as` | `Effect.as(...)` — use `Effect.map` or `Effect.asVoid` | error |
| `no-effect-async` | `Effect.async(...)` — use `Effect.tryPromise` or structured lifecycle | error |
| `no-effect-bind` | `Effect.bind(...)` — use `yield*` inside `Effect.gen` | error |
| `no-effect-do` | `Effect.Do` — use `Effect.gen` with generators | error |
| `no-effect-fn-generator` | `Effect.fn(function*(){})` — use `Effect.fn("name")(impl)` | error |
| `no-effect-never` | `Effect.never` — use structured lifecycle | error |
| `no-effect-orElse-ladder` | `pipe(...).pipe(Effect.orElse(...))` — use `catchTag` at terminal | error |
| `no-effect-succeed-variable` | `Effect.succeed(myVar)` placeholder — select value before entering Effect | warning |
| `no-effect-sync-console` | `Effect.sync(() => console.*)` — use `Effect.log*` | error |
| `no-effect-type-alias` | `type X = Effect.Effect<...>` — let TypeScript infer | error |
| `no-effect-wrapper-alias` | `const x = pipe(Effect..., ...)` — use `Effect.fn("name")` | error |
| `no-flatmap-ladder` | `Effect.flatMap(x, _ => Effect.flatMap(...))` — use `Effect.gen` | warning |
| `no-fromnullable-nullish-coalesce` | `Option.fromNullable(x ?? null)` — redundant coalesce | error |
| `no-if-statement` | `if (...)` in Effect code — use `Option.match`/`Match.value` | error |
| `no-iife-wrapper` | `((x) => ...)(arg)` — bind with `const`, keep flat pipeline | error |
| `no-interpolated-logging` | Template literals in `Effect.log*` — use structured args | error |
| `no-json-parse-without-schema` | `JSON.parse` without schema decode | error |
| `no-manual-tag-check` | `._tag === "..."` — use `Effect.catchTag` or `Match.tag` | error |
| `no-match-void-branch` | `Match.orElse(() => Effect.void)` — remove no-op or restructure | error |
| `no-model-overlay-cast` | `x as SomeType` — decode through schema, don't cast | error |
| `no-nested-effect-call` | `Effect.a(Effect.b(Effect.c(...)))` — 3-level nesting | error |
| `no-nested-effect-gen` | Nested `Effect.gen` inside `Effect.gen` — flatten | error |
| `no-option-as` | `Option.as(...)` — use `Option.map` or `Option.getOrElse` | error |
| `no-pipe-ladder` | `pipe(pipe(...))` — flatten into single pipeline | error |
| `no-return-in-arrow` | `(x) => { return ... }` — use expression arrows | info |
| `no-return-null` | `return null` inside Effect — use `Option.none()` or `Effect.fail` | error |
| `no-runpromise-in-effect` | `Effect.runPromise/runSync` in interior code | error |
| `no-runtime-runfork` | `Runtime.runFork` — use `forkScoped` at Layer boundary | error |
| `no-silent-catch` | `catchAll` → `succeed` without logging | error |
| `no-string-sentinel-const` | `const X = "literal"` — use tagged unions or branded types | warning |
| `no-string-sentinel-return` | `Effect.succeed("string")` — use typed unions | error |
| `no-switch-statement` | `switch (...)` — use `Match.value` or `Option.match` | error |
| `no-ternary` | `x ? a : b` — use `Option.match`/`Match.value` | error |
| `no-throw-in-effect` | `throw` inside `Effect.gen` — use `Effect.fail` | error |
| `no-try-catch` | `try/catch` inside `Effect.gen` — use `Effect.try` / `catchTag` | error |
| `no-typed-boundary-assignment` | Untyped external data assignment | error |
| `no-unsafe-typecast-at-boundary` | `as SomeType` on external data | error |
| `prevent-dynamic-imports` | `import(...)` — use static imports | error |
| `tagged-error-location` | Error classes outside `errors.ts`/`errors/` | error |
| `use-tagged-error` | `class X extends Error` — use `Schema.TaggedErrorClass` | error |
| `warn-effect-sync-wrapper` | `Effect.sync(() => fn(...))` — use `Effect.log*` or explicit step | warning |

**`rules/shared/` — general rules:**

| Rule | Targets | Severity |
|------|---------|----------|
| `no-dynamic-import` | `import(...)` in worker/shared packages | error |
| `no-else-after-return` | `if (x) { return } else { ... }` | error |
| `no-foreach` | `.forEach(...)` — use `Effect.forEach` or `for...of` | error |
| `no-hardcoded-colors` | Raw Tailwind color classes in tanstack-start | error |

#### Enforcement Gaps (documented, not enforced)

| Reference Rule | Reason Not Enforced |
|---|---|
| `no-branch-in-object` | AST complexity — object branching with Match/Option/Either needs type context |
| `no-effect-side-effect-wrapper` | Covered by `no-effect-as` + `warn-effect-sync-wrapper` combined |
| `no-match-effect-branch` | Multi-step detection inside Match branches needs type-aware analysis |
| `no-react-state` / `no-atom-registry-*` | No effect-atom/React runtime in this Workers repo |
| `no-render-side-effects` | No React render context in this Workers repo |
| `no-wrapgraphql-catchall` | Domain-specific to GraphQL — not applicable |
| `no-unknown-boolean-coercion-helper` | Highly specific pattern requiring domain knowledge of schema boundaries |
| `no-option-boolean-normalization` | Very narrow pattern — low occurrence expected |
| `no-inline-runtime-provide` | Atom runtime specific — not applicable |

## Troubleshooting

- `env.HYPERDRIVE` is undefined: check the app `wrangler.jsonc` and your local Hyperdrive simulation variable `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`.
- `/api/openapi.json` is missing: inspect `apps/effect-worker-api/src/runtime.ts`; OpenAPI is registered there, not in the entrypoint.
- RPC calls return 404: the handler is mounted at `/rpc`; `/health` is the only non-RPC route served directly by `effect-worker-rpc`.
- Traces are missing: run `pnpm dev:traced:api` or `pnpm dev:traced:rpc`, then inspect `.traces/spans.ndjson`.
- TanStack server functions cannot access shared services yet: `apps/tanstack-start/src/server/middleware/effect-runtime.ts` currently builds `Layer.empty`; wire real layers before assuming `runEffect` has dependencies.
- Agent needs task workflow rules: read `FP_AGENTS.md`; this file is repository navigation, not issue-process policy.