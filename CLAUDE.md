# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Root commands
pnpm install          # Install dependencies
pnpm build            # Build packages in order: domain → db → cloudflare → contracts
pnpm check            # Type check all packages/apps (runs per-package)
pnpm test             # Run all tests with vitest

# App development (run from app directory)
cd apps/effect-worker-api
pnpm dev              # Start local dev server with wrangler
pnpm deploy           # Deploy to Cloudflare

# Database operations (run from packages/db)
cd packages/db
DATABASE_URL=postgres://... pnpm db:push      # Push schema to database
DATABASE_URL=postgres://... pnpm db:studio    # Open Drizzle Studio
DATABASE_URL=postgres://... pnpm db:generate  # Generate migrations
DATABASE_URL=postgres://... pnpm db:migrate   # Run migrations
```

## Architecture

This is a Cloudflare Workers monorepo using Effect-TS. Apps import from shared packages via TypeScript path aliases (`@repo/*`).

### Package Dependency Flow

```
@repo/domain (types, schemas, errors)
       ↓
@repo/db (Drizzle schema + Effect query programs)
       ↓
@repo/cloudflare (bindings bridge, CloudflareBindings service, middleware factories)
       ↓
@repo/contracts (HTTP/RPC API definitions, middleware tags)
       ↓
apps/ (handler implementations, thin middleware wiring)
```

### Key Patterns

**ServiceMap.Reference Bridge**: Cloudflare's `env` and `ctx` are request-scoped. The shared `@repo/cloudflare` package stores them in ServiceMap.Reference at request entry, then middleware factories read them to provide services:

```typescript
// Entry point — pass bindings via ServiceMap context
const services = pipe(
  ServiceMap.make(currentEnv, env),
  ServiceMap.add(currentCtx, ctx)
)
return handler(request, services)

// Middleware factories read Reference → provide service (in @repo/cloudflare)
const env = yield* currentEnv
const ctx = yield* currentCtx
return yield* effect.pipe(Effect.provideService(CloudflareBindings, { env, ctx }))
```

**Middleware Factories**: `makeBindingsMiddleware(tag)` and `makeDatabaseMiddleware(tag, getConnectionString)` in `@repo/cloudflare` encapsulate the shared pattern. Apps wire them in one line:

```typescript
export const CloudflareBindingsMiddlewareLive = makeBindingsMiddleware(CloudflareBindingsMiddleware)
export const DatabaseMiddlewareLive = makeDatabaseMiddleware(DatabaseMiddleware, (env) => (env as Env).HYPERDRIVE.connectionString)
```

**Contract/Implementation Split**: `@repo/contracts` defines abstract middleware tags (HttpApiMiddleware.Service / RpcMiddleware.Service); `@repo/cloudflare` provides shared factory implementations; apps wire tags to factories via thin Layer composition.

**Query Programs**: Database queries live in `@repo/db/src/queries/` as Effect programs requiring `PgDrizzle`. Handlers call these instead of inline queries.

### Import Conventions

- All shared packages use the `@repo/*` namespace (e.g., `@repo/domain`, `@repo/db`)
- Apps use `@/*` for internal imports (e.g., `@/services`, `@/handlers`)
- Packages use relative imports (`./`, `../`)
- Cross-package imports use `@repo/*`
- Never re-export from `@repo/*` in app barrel files; import directly where needed

### Local Development

For Hyperdrive (database), set in `.env`:
```
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://postgres:postgres@localhost:5432/effect_worker"
```

### Where Code Goes

| Type | Location |
|------|----------|
| Domain types, branded schemas | `@repo/domain/src/schemas/` |
| Domain errors | `@repo/domain/src/errors/` |
| Database tables (Drizzle) | `@repo/db/src/schema.ts` |
| Reusable queries | `@repo/db/src/queries/` |
| HTTP endpoint definitions | `@repo/contracts/src/http/groups/` |
| RPC procedure definitions | `@repo/contracts/src/rpc/procedures/` |
| Middleware tags | `@repo/contracts/src/*/middleware/` |
| Middleware factories | `@repo/cloudflare/src/middleware.ts` |
| Bindings bridge (shared) | `@repo/cloudflare/src/bindings.ts` |
| Handler implementations | `apps/*/src/handlers/` |
| Middleware wiring | `apps/*/src/services/middleware.ts` |

## Learning more about the "effect" & "@effect/\*" packages

`~/.local/share/ai-references/v4/LLMS.md` is an authoritative source of information about the
"effect" and "@effect/\*" packages. Read this before looking elsewhere for
information about these packages. It contains the best practices for using
effect.

Use this for learning more about the library, rather than browsing the code in
`node_modules/`.
