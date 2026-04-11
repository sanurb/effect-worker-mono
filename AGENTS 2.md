# AGENTS.md

Navigation guide for humans and agents. Read this first, then jump to the source files or docs named below. Detailed knowledge lives in those docs — keep this file short.

## Universal Rules

1. Run `vp check` before every PR. It runs format, lint, and type-aware checks in one pass via Vite+. Run `pnpm sg:check` after it for the ast-grep architecture rules (Vite+ does not wrap ast-grep).
2. Run `vp test` to verify the test suite (Vite+ runs the bundled Vitest with the root `vite.config.ts`).
3. Update docs in the same PR when architecture or workflow changes.
4. Cloudflare `env` and `ctx` are request-scoped. Never cache them globally.
5. Put reusable queries in `@repo/db/src/queries/` — do not scatter raw Drizzle in app handlers.
6. Use `fp issue` for all task tracking. See `FP_AGENTS.md`.
7. Effect v4 reference: `~/.local/share/ai-references/effect/v4/LLMS.md`. Authoritative source for `effect` and `@effect/*` packages — read it before browsing `node_modules/`.

<!--VITE PLUS START-->

## Using Vite+, the Unified Toolchain for the Web

This monorepo runs on **Vite+**, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling behind a single global CLI: `vp`. The local entry point is `vite.config.ts` at the repo root, configured via `defineConfig` from `vite-plus`.

Vite+ is distinct from Vite. Vite+ invokes Vite through `vp dev` and `vp build`. The same applies for Vitest, Oxlint, and Oxfmt — Vite+ owns those entry points.

### Vite+ Workflow

`vp` is a global binary. Run `vp help` for the full command list and `vp <command> --help` for details on any command.

#### Start

- `vp create` — scaffold a new project
- `vp migrate` — migrate an existing project to Vite+
- `vp config` — configure hooks and agent integration
- `vp staged` — run linters on staged files
- `vp install` (`vp i`) — install dependencies
- `vp env` — manage Node.js versions

#### Develop

- `vp dev` — run the Vite dev server
- `vp check` — run format, lint, and TypeScript-aware checks in one pass
- `vp lint` — Oxlint
- `vp fmt` — Oxfmt
- `vp test` — Vitest (uses `vite.config.ts` `test.*` config)

#### Execute

- `vp run <task>` — run monorepo tasks defined in `vite.config.ts` `run.tasks`
- `vp exec` — execute a binary from local `node_modules/.bin`
- `vp dlx` — execute a package binary without installing it
- `vp cache` — manage the task cache

#### Build

- `vp build` — production build (Vite + Rolldown)
- `vp pack` — library build for npm publishing
- `vp preview` — preview production build

#### Manage Dependencies

Vite+ wraps the underlying package manager (pnpm here, via `packageManager` in `package.json`).

- `vp add` / `vp remove` (`rm`, `un`, `uninstall`) / `vp update` (`up`)
- `vp dedupe`, `vp outdated`, `vp list`, `vp why`, `vp info`
- `vp link` / `vp unlink`
- `vp pm <args>` — forward a command to pnpm if no `vp` equivalent exists

### What Vite+ Does NOT Wrap (use directly)

| Tool                                                  | Why it stays direct                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `tsgo` (`@effect/tsgo`, `@typescript/native-preview`) | Effect's native TS preview compiler — used for per-package `check`/`build`. Not in Vite+'s scope. |
| `wrangler`                                            | Cloudflare worker dev/deploy.                                                                     |
| `drizzle-kit`                                         | Database migrations and studio.                                                                   |
| `sg` (`@ast-grep/cli`)                                | Effect architecture rules. Run via `pnpm sg:check` / `pnpm sg:test`.                              |
| `agent-ci`                                            | Local CI runner (`pnpm ci:local`).                                                                |

Per-package `tsgo` checks remain in each package's `check` script and run together via `pnpm -r run check` (also exposed as `vp run types:check`).

### Common Pitfalls

- **Do not call pnpm/npm/yarn directly** for normal dependency operations. Use `vp install`, `vp add`, `vp remove`. The remaining `pnpm`-prefixed scripts in `package.json` exist only because they wrap tools Vite+ does not own (`sg`, `tsgo`, `wrangler`, `agent-ci`).
- **Do not run `vp vitest` or `vp oxlint`** — they do not exist. Use `vp test`, `vp lint`, `vp fmt`.
- **Do not install `vitest`, `oxlint`, `oxfmt`, or `tsdown` directly.** Vite+ wraps them. They are pinned via the pnpm overrides in `pnpm-workspace.yaml`. Upgrade them through `vp upgrade` (and the corresponding `vite-plus` / `@voidzero-dev/vite-plus-core` versions in root `package.json`).
- **Use `vp dlx` instead of `pnpm dlx` / `npx`.**
- **Importing test utilities:** Effect-aware tests import from `@effect/vitest`. Plain tests, if added, import from `vite-plus/test` — never directly from `vitest`. The `vitest` package name resolves to `@voidzero-dev/vite-plus-test` via the pnpm override.
- **Type-aware lint:** `vp lint --type-aware` works out of the box. Do not install `oxlint-tsgolint` separately.

### Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
- [ ] Run `pnpm sg:check` for ast-grep architecture rules.
- [ ] For per-package type checks: `pnpm -r run check` (or `vp run types:check`).
- [ ] For build: `pnpm build` (the dependency-ordered tsgo build) — `vp build` is reserved for Vite-driven apps.

<!--VITE PLUS END-->

## Package Index

| Package            | Purpose                                              | Entry                              |
| ------------------ | ---------------------------------------------------- | ---------------------------------- |
| `@repo/domain`     | Branded schemas, domain errors                       | `packages/domain/src/index.ts`     |
| `@repo/db`         | Drizzle schema, `PgDrizzle` service, query programs  | `packages/db/src/index.ts`         |
| `@repo/cloudflare` | Bindings bridge, middleware factories, observability | `packages/cloudflare/src/index.ts` |
| `@repo/contracts`  | HTTP + RPC contracts, middleware tags                | `packages/contracts/src/index.ts`  |

## App Index

| App                 | Runtime                        | Entry                                 |
| ------------------- | ------------------------------ | ------------------------------------- |
| `effect-worker-api` | Cloudflare Worker (HTTP)       | `apps/effect-worker-api/src/index.ts` |
| `effect-worker-rpc` | Cloudflare Worker (RPC)        | `apps/effect-worker-rpc/src/index.ts` |
| `tanstack-start`    | Cloudflare Worker (full-stack) | `apps/tanstack-start/src/server.ts`   |

## Docs by Topic

| Topic                                              | Doc                                          |
| -------------------------------------------------- | -------------------------------------------- |
| Architecture, layer responsibilities, boundaries   | `docs/architecture.md`                       |
| Observability, tracing, NDJSON spans               | `docs/observability.md`                      |
| Boundary conventions (adapters, I/O, entry points) | `docs/agents/patterns/boundaries.md`         |
| Effect patterns and enforced anti-patterns         | `docs/agents/patterns/effect.md`             |
| Coding style                                       | `docs/agents/patterns/coding-style.md`       |
| Data validation                                    | `docs/agents/patterns/data-validation.md`    |
| Testing principles                                 | `docs/agents/patterns/testing-principles.md` |
| End-to-end testing                                 | `docs/agents/patterns/end-to-end-testing.md` |
| Building a new API app                             | `docs/agents/templates/api.md`               |
| Building a new CLI app                             | `docs/agents/templates/cli.md`               |
| Building a new worker app                          | `docs/agents/templates/worker.md`            |
| Validation gate reference (all check commands)     | `docs/agents/validation.md`                  |
| Continuous improvement loop                        | `docs/agents/harness-engineering.md`         |
| Issue tracking workflow                            | `FP_AGENTS.md`                               |

## Verification (run before declaring done)

```bash
vp install         # restore deps with overrides applied
vp check           # vp fmt + vp lint (+ type-aware lint)
pnpm sg:check      # ast-grep architecture rules (not wrapped by Vite+)
vp test            # vitest via Vite+
pnpm -r run check  # tsgo type check across every package
pnpm build         # build shared packages in dependency order
```

### Local CI (run the real GitHub Actions workflow locally)

```bash
pnpm ci:local          # run check.yml (build + types + test) locally via agent-ci
pnpm ci:local:all      # discover and run all workflows relevant to current branch
pnpm ci:local:retry    # retry only the failed step (container stays alive on failure)
```

Requires Docker (OrbStack recommended on macOS). Runs against working tree — uncommitted changes included.

See `docs/agents/validation.md` for per-package and per-tool breakdowns.

## Troubleshooting

- `vp` not found → install Vite+: `curl -fsSL https://vite.plus | bash`. The repo expects `vp` to be on `PATH`.
- `vp install` fails on peer mismatch for `vitest` → confirm `pnpm-workspace.yaml` still contains the `peerDependencyRules` override; the `@effect/vitest` peer on `vitest@^3.2.0` is intentionally satisfied by `@voidzero-dev/vite-plus-test`.
- A Vite plugin in `tanstack-start` complains about a missing `vite` export → the override redirects `vite` to `@voidzero-dev/vite-plus-core`. Upgrade `vite-plus` (`vp upgrade` + bump the root `vite-plus` / `@voidzero-dev/vite-plus-core` versions) before reverting the override.
- `env.HYPERDRIVE` undefined → check `wrangler.jsonc` and `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `.env`.
- `/api/openapi.json` missing → OpenAPI is registered in `apps/effect-worker-api/src/runtime.ts`, not the entrypoint.
- RPC returns 404 → handler is at `/rpc`; `/health` is the only non-RPC route in `effect-worker-rpc`.
- Traces missing → run `pnpm dev:traced:api` or `pnpm dev:traced:rpc`, inspect `.traces/spans.ndjson`.
- `tanstack-start` server functions can't access shared services → `effect-runtime.ts` uses `Layer.empty`; wire real layers before assuming dependencies are available.
- Docs disagree with code → trust `package.json`, `vite.config.ts`, `runtime.ts`, `wrangler.jsonc` over prose. Fix the prose.
