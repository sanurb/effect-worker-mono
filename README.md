# Effect Worker Monorepo

A production-ready monorepo for building Cloudflare Workers with Effect-TS, featuring shared domain models, type-safe API contracts, and database integration.

## Quick Start

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm check            # Type check
pnpm test             # Run tests

# Local development
cd apps/effect-worker-api
pnpm dev              # Start dev server
```

## Documentation Map

- [`AGENTS.md`](./AGENTS.md) — agent-first repository navigation, package/app map, commands, troubleshooting
- [`docs/architecture.md`](./docs/architecture.md) — boundaries, responsibilities, request/data flow
- [`docs/observability.md`](./docs/observability.md) — NDJSON traces, local capture, optional OTLP

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Applications                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐│
│  │effect-worker-api │ │ effect-worker-rpc│ │  tanstack-start  ││
│  │   (HTTP REST)    │ │    (RPC JSON)    │ │  (Full-Stack UI) ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                     Shared Packages                              │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────┐    │
│  │  domain   │ │ contracts │ │cloudflare │ │      db      │    │
│  │ (types)   │ │   (API)   │ │  (infra)  │ │   (schema)   │    │
│  └───────────┘ └───────────┘ └───────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

All packages use the `@repo/*` namespace for internal monorepo imports.

### `@repo/domain`

Core domain types, branded schemas, and errors.

```typescript
import { UserId, UserSchema, UserNotFoundError } from "@repo/domain";

// Branded types for type-safe IDs
const id: UserId = "usr_abc123" as UserId;
```

### `@repo/contracts`

API definitions for HTTP and RPC endpoints. Defines the contract between client and server.

```typescript
import { WorkerApi, UsersGroup, UsersRpc } from "@repo/contracts";
```

**HTTP Groups:**

- `HealthGroup` - Health check endpoints
- `UsersGroup` - User CRUD operations

**RPC Procedures:**

- `UsersRpc` - User operations via RPC

### `@repo/cloudflare`

Infrastructure layer for Cloudflare Workers integration with Effect.

```typescript
import {
  withCloudflareBindings, // Wrap effects with env/ctx
  CloudflareBindings, // Service tag
  PgDrizzle, // Database connection
  currentEnv, // FiberRef for env access
} from "@repo/cloudflare";
```

### `@repo/db`

Drizzle ORM schema definitions.

```typescript
import { users } from "@repo/db";
```

## Applications

### `effect-worker-api`

REST HTTP API built with `@effect/platform`.

```bash
cd apps/effect-worker-api
pnpm dev        # Local dev server
pnpm deploy     # Deploy to Cloudflare
```

**Endpoints:**

- `GET /health` - Health check
- `GET /users` - List users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create user

### `effect-worker-rpc`

RPC API using `@effect/rpc` for procedure-based communication.

```bash
cd apps/effect-worker-rpc
pnpm dev        # Local dev server
pnpm deploy     # Deploy to Cloudflare
```

**Endpoints:**

- `GET /health` - Health check
- `POST /rpc` - RPC endpoint

### `tanstack-start`

Full-stack React application with TanStack Start, featuring Effect-TS integration via middleware.

```bash
cd apps/tanstack-start
pnpm dev        # Local dev server (port 3000)
pnpm deploy     # Deploy to Cloudflare
```

**Features:**

- TanStack Router (file-based routing)
- TanStack Query (server state management)
- Effect runtime middleware for server functions
- Tailwind CSS v4 + Shadcn/UI components

**Effect Integration Pattern:**

```typescript
// Middleware creates scoped Effect runtime per-request
export const effectRuntimeMiddleware = createMiddleware().server(async ({ next }) => {
  const servicesLayer = Layer.mergeAll(/* your services */);
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const runtime = yield* Layer.toRuntime(servicesLayer);
        const runEffect = <A, E>(effect: Effect.Effect<A, E, Services>) =>
          Runtime.runPromise(runtime)(effect);
        return yield* Effect.tryPromise({
          try: () => next({ context: { env, runEffect } }),
          catch: (e) => {
            throw e;
          },
        });
      }),
    ),
  );
});

// Server functions use runEffect to execute Effect programs
export const myFunction = createServerFn()
  .middleware([effectRuntimeMiddleware])
  .handler(async ({ context }) => {
    return context.runEffect(
      Effect.gen(function* () {
        const db = yield* PgDrizzle;
        return yield* db.select().from(users);
      }),
    );
  });
```

## Core Patterns

### FiberRef Bridge

Request-scoped Cloudflare bindings via Effect's FiberRef:

```typescript
// Entry point wraps effect with bindings
const effect = handleRequest(request).pipe(withCloudflareBindings(env, ctx));
return runtime.runPromise(effect);

// Handlers access via service
Effect.gen(function* () {
  const { env } = yield* CloudflareBindings;
  // Use env.MY_KV, env.MY_R2, etc.
});
```

### Middleware Pattern

Contracts define abstract middleware tags, apps provide implementations:

```typescript
// In contracts (abstract)
export class DatabaseMiddleware extends HttpApiMiddleware.Tag<DatabaseMiddleware>()(
  "DatabaseMiddleware",
  { failure: DatabaseConnectionError, provides: PgDrizzle },
) {}

// In app (implementation)
export const DatabaseMiddlewareLive = Layer.effect(
  DatabaseMiddleware,
  Effect.gen(function* () {
    const drizzle = yield* makeDrizzle();
    return drizzle;
  }),
);
```

### Handler Implementation

Type-safe handlers using Effect generators:

```typescript
export const UsersGroupLive = HttpApiBuilder.group(WorkerApi, "users", (handlers) =>
  handlers
    .handle("list", () =>
      Effect.gen(function* () {
        const drizzle = yield* PgDrizzle;
        return yield* drizzle.select().from(users);
      }),
    )
    .handle("get", ({ path: { id } }) =>
      Effect.gen(function* () {
        const drizzle = yield* PgDrizzle;
        const user = yield* drizzle.select().from(users).where(eq(users.id, id));
        if (!user) return yield* Effect.fail(new UserNotFoundError({ id }));
        return user;
      }),
    ),
);
```

### Error Handling

Typed errors with automatic HTTP status mapping:

```typescript
export class UserNotFoundError extends S.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  { id: UserIdSchema, message: S.String },
  HttpApiSchema.annotations({ status: 404 }),
) {}
```

## Project Structure

The current source of truth is:

- `apps/effect-worker-api` — HTTP worker (`src/index.ts`, `src/runtime.ts`, `src/handlers`, `src/services`)
- `apps/effect-worker-rpc` — RPC worker (`src/index.ts`, `src/runtime.ts`, `src/handlers`, `src/services`)
- `apps/tanstack-start` — TanStack Start app on Cloudflare (`src/server.ts`, `src/router.tsx`, `src/server`)
- `packages/domain` — schemas and domain errors
- `packages/db` — Drizzle schema, `PgDrizzle`, shared queries
- `packages/cloudflare` — Worker bindings bridge, middleware factories, observability
- `packages/contracts` — HTTP/RPC contracts and middleware tags

For a file-by-file navigation guide, see [`AGENTS.md`](./AGENTS.md). For the deeper architectural explanation, see [`docs/architecture.md`](./docs/architecture.md).

## Configuration

### TypeScript

Strict mode enabled with path aliases for all packages:

```json
{
  "compilerOptions": {
    "paths": {
      "@repo/domain": ["./packages/domain/src"],
      "@repo/contracts": ["./packages/contracts/src"],
      "@repo/cloudflare": ["./packages/cloudflare/src"],
      "@repo/db": ["./packages/db/src"]
    }
  }
}
```

### Cloudflare Bindings

Configure in `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [{ "binding": "MY_KV", "id": "xxx" }],
  "r2_buckets": [{ "binding": "MY_R2", "bucket_name": "xxx" }],
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "xxx" }],
}
```

### Hyperdrive (Database Connection Pooling)

Cloudflare Hyperdrive provides connection pooling for PostgreSQL. In production, configure via `wrangler.jsonc`:

```jsonc
{
  "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "your-hyperdrive-id" }],
}
```

For **local development**, Wrangler simulates Hyperdrive using an environment variable. Create a `.env` file or export:

```bash
# .dev.vars (or export in shell)
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://postgres:postgres@localhost:5432/effect_worker"
```

The `HYPERDRIVE` suffix must match your binding name. Wrangler will automatically provide `env.HYPERDRIVE.connectionString` in your worker.

**Usage in middleware:**

```typescript
return yield * makeDrizzle(env.HYPERDRIVE.connectionString);
```

## Scripts

For the full command reference, including per-app commands, trace capture, and lint/format guidance, see [`AGENTS.md`](./AGENTS.md#common-commands).

Core root scripts available now:

| Command                                       | Description                               |
| --------------------------------------------- | ----------------------------------------- |
| `pnpm build`                                  | Build shared packages                     |
| `pnpm check`                                  | Type check workspaces that define `check` |
| `pnpm test`                                   | Run tests from the workspace root         |
| `pnpm coverage`                               | Generate coverage report                  |
| `pnpm clean`                                  | Remove package `dist` folders             |
| `pnpm dev:api` / `pnpm dev:rpc`               | Run the worker apps locally               |
| `pnpm dev:traced:api` / `pnpm dev:traced:rpc` | Run locally with NDJSON trace capture     |

## Tech Stack

| Category      | Technology                                                |
| ------------- | --------------------------------------------------------- |
| Runtime       | Cloudflare Workers                                        |
| Framework     | Effect-TS                                                 |
| HTTP          | @effect/platform                                          |
| RPC           | @effect/rpc                                               |
| Full-Stack UI | TanStack Start + TanStack Router + TanStack Query         |
| Database      | Drizzle ORM + PostgreSQL                                  |
| Toolchain     | Vite+ (`vp`) wrapping Vite, Vitest, Oxlint, Oxfmt, tsdown |
| Testing       | Vite+ Vitest + @effect/vitest                             |
| Deployment    | Wrangler                                                  |

## Key Dependencies

- **effect** - Core functional effects runtime
- **@effect/platform** - HTTP server & middleware
- **@effect/rpc** - RPC protocol
- **@effect/sql-drizzle** - Database integration
- **@tanstack/react-start** - Full-stack React framework
- **@tanstack/react-router** - Type-safe file-based routing
- **@tanstack/react-query** - Server state management
- **drizzle-orm** - Type-safe ORM
- **wrangler** - Cloudflare Workers CLI

## Development Workflow

1. Make changes in the relevant package or app.
2. Run the narrowest useful verification for what you changed (`pnpm check`, package-specific tests, or trace-enabled local dev).
3. Use `pnpm dev:api` or `pnpm dev:rpc` for worker development, and `pnpm dev:traced:api` / `pnpm dev:traced:rpc` when you need trace capture.
4. Deploy from the target app package (`pnpm --filter effect-worker-api deploy`, `pnpm --filter effect-worker-rpc deploy`, or `pnpm --filter tanstack-start-on-cloudflare deploy`).

## Database Operations

```bash
cd packages/db

# Push schema changes
DATABASE_URL=postgres://postgres:postgres@localhost:5432/effect_worker pnpm db:push

# Open Drizzle Studio
DATABASE_URL=postgres://postgres:postgres@localhost:5432/effect_worker pnpm db:studio

# Generate migrations
DATABASE_URL=postgres://postgres:postgres@localhost:5432/effect_worker pnpm db:generate

# Run migrations
DATABASE_URL=postgres://postgres:postgres@localhost:5432/effect_worker pnpm db:migrate
```

## License

See [LICENSE](./LICENSE) for details.
