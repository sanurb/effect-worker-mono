# Architecture

This document explains how the monorepo is split into packages and apps, where each responsibility lives, and how requests move through the system. For command-level navigation, read [`../AGENTS.md`](../AGENTS.md). For tracing and logs, read [`./observability.md`](./observability.md).

## System Shape

The repo is organized as a hexagonal-ish monorepo around shared domain types and deployable Cloudflare applications.

```text
            apps/effect-worker-api      apps/effect-worker-rpc      apps/tanstack-start
                     |                           |                            |
                     +----------- compose shared packages ---------------------+
                                                 |
                                    @repo/contracts  @repo/cloudflare
                                              |           |
                                              +-----+-----+
                                                    |
                                                 @repo/db
                                                    |
                                               @repo/domain
```

That diagram is intentionally honest about the current code, not the idealized version. `@repo/contracts` is part of the application boundary, but today it also references infrastructure service types from `@repo/cloudflare` and `@repo/db` through middleware tags.

## Responsibility by Layer

### 1. Domain core — `@repo/domain`

Responsibilities:

- Own branded IDs, schemas, and domain-facing errors.
- Express invariants without transport or runtime concerns.
- Provide types that every other workspace package can trust.

Key source files:

- `packages/domain/src/schemas/user.ts`
- `packages/domain/src/errors/user.ts`
- `packages/domain/src/errors/common.ts`
- `packages/domain/src/index.ts`

What does not belong here:

- Drizzle table definitions
- Cloudflare bindings
- HTTP or RPC route definitions
- Wrangler config or environment lookups

### 2. Persistence adapter — `@repo/db`

Responsibilities:

- Own the relational schema (`users` table).
- Own the `PgDrizzle` service tag and connection-layer helpers.
- Expose reusable Effect query programs that translate between storage rows and domain values.

Key source files:

- `packages/db/src/schema.ts`
- `packages/db/src/queries/users.ts`
- `packages/db/src/pg-drizzle/index.ts`
- `packages/db/src/index.ts`

Boundary rule:

- This package may depend on `@repo/domain`.
- Apps should prefer shared query programs here over duplicating raw Drizzle sequences in handlers.

### 3. Worker/runtime adapter — `@repo/cloudflare`

Responsibilities:

- Bridge Cloudflare `env` and `ctx` into Effect via request-scoped `ServiceMap` references.
- Provide Worker-specific helpers like `waitUntil`.
- Build reusable middleware factories for Cloudflare bindings and database access.
- Host observability infrastructure: logger, tracer, NDJSON trace emission, optional OTLP delegation.

Key source files:

- `packages/cloudflare/src/bindings.ts`
- `packages/cloudflare/src/middleware.ts`
- `packages/cloudflare/src/observability/Observability.ts`
- `packages/cloudflare/src/observability/Tracer.ts`
- `packages/cloudflare/src/index.ts`

Boundary rule:

- This package is infrastructure. Keep Worker concerns here instead of scattering `env`/`ctx` handling through apps.

### 4. Transport contracts — `@repo/contracts`

Responsibilities:

- Define the HTTP API surface (`WorkerApi`, groups, schemas, middleware tags).
- Define the RPC surface (`UsersRpc`, procedures, middleware tags).
- Provide one shared contract package so transport implementations stay aligned.

Key source files:

- `packages/contracts/src/http/api.ts`
- `packages/contracts/src/http/groups/*.ts`
- `packages/contracts/src/rpc/procedures/users.ts`
- `packages/contracts/src/middleware/*.ts`
- `packages/contracts/src/index.ts`

Boundary reality:

- The contracts package is not pure schema-only code. Its middleware tags reference services from `@repo/cloudflare` and `@repo/db`.
- Treat it as the shared transport boundary for the worker apps, not as a domain-only package.

### 5. Application composition — `apps/*`

Responsibilities:

- Turn shared contracts and infrastructure into deployed Cloudflare applications.
- Compose live layers and handlers.
- Own Wrangler config and runtime entrypoints.

Current apps:

- `apps/effect-worker-api` — HTTP API worker
- `apps/effect-worker-rpc` — RPC worker
- `apps/tanstack-start` — full-stack app on Cloudflare with local Effect middleware scaffolding

Boundary rule:

- App entrypoints (`src/index.ts` or `src/server.ts`) should stay thin. Runtime assembly belongs in `runtime.ts` or the server middleware layer.

## Request and Data Flow

### HTTP API flow

1. Cloudflare invokes `apps/effect-worker-api/src/index.ts`.
2. The entrypoint stores `env` and `ctx` in request-scoped `ServiceMap` references.
3. `apps/effect-worker-api/src/runtime.ts` creates the web handler from `WorkerApi` plus `HttpGroupsLive` and `MiddlewareLive`.
4. HTTP contract definitions come from `@repo/contracts`.
5. App middleware implementations bind contract middleware tags to live factories from `@repo/cloudflare`.
6. User handlers call shared services such as `PgDrizzle` or query programs from `@repo/db`.
7. Database rows are mapped back into domain values/errors defined in `@repo/domain`.
8. Observability from `@repo/cloudflare` records logs/spans around the request lifecycle.

### RPC flow

1. Cloudflare invokes `apps/effect-worker-rpc/src/index.ts`.
2. `/health` is handled directly in the entrypoint.
3. Other requests pass through the request-scoped bindings bridge into `rpcHandler` from `apps/effect-worker-rpc/src/runtime.ts`.
4. `UsersRpc` from `@repo/contracts` defines the procedure surface.
5. `UsersRpcHandlersLive` implements those procedures.
6. Shared middleware tags are fulfilled by app-level wiring in `apps/effect-worker-rpc/src/services/middleware.ts`.
7. Database work runs through `PgDrizzle` and shared query logic, with domain errors propagating back through the RPC layer.
8. Observability is attached at runtime composition, not per handler.

### TanStack Start server function flow

1. `apps/tanstack-start/src/server.ts` provides the Worker server entry.
2. Server functions opt into `effectRuntimeMiddleware` from `apps/tanstack-start/src/server/middleware/effect-runtime.ts`.
3. The middleware builds a request-scoped Effect runtime and exposes `runEffect` on the server-function context.
4. Today the runtime is `Layer.empty`, so the app demonstrates the pattern but does not yet provide shared workspace services.

## Hexagonal Boundary Rules

These are the practical boundaries the codebase should preserve:

- `@repo/domain` defines the language of the system.
- `@repo/db` adapts PostgreSQL/Drizzle to the domain.
- `@repo/cloudflare` adapts the Cloudflare Worker runtime to Effect.
- `@repo/contracts` defines the external ports for HTTP and RPC.
- `apps/*` are delivery mechanisms that assemble concrete adapters and expose endpoints.

Put differently:

- Domain answers “what is a valid user and what errors exist?”
- DB answers “how is that persisted and fetched?”
- Cloudflare answers “how does Worker runtime state enter Effect?”
- Contracts answer “what can clients call and what do they get back?”
- Apps answer “which concrete runtime, middleware, and handlers are live in this deployment?”

## Conventions That Matter

- Public package APIs are surfaced through `src/index.ts` or explicit subpath barrels (`@repo/contracts/http`, `@repo/contracts/rpc`).
- Effect operations in shared packages are named for business work, for example `UserQueries.findUserById`.
- Cloudflare bindings are request-scoped. Do not cache `env` or `ctx` globally.
- Background work should go through `waitUntil` instead of fire-and-forget promises.
- Observability lives with infrastructure, not business handlers. See [`./observability.md`](./observability.md).

## Known Tensions

These are not bugs in the documentation; they are the current architecture tradeoffs:

- `@repo/contracts` depends on infrastructure service types, so it is not a pure boundary package.
- `apps/tanstack-start` is structurally ready for shared services but still acts mostly as an isolated example.
- Database access is shared across both worker apps, but the TanStack app has not been wired into that same runtime model yet.

If you refactor these tensions later, update this document and `AGENTS.md` in the same change so the architecture tells the truth.
