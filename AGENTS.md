# AGENTS.md

Navigation guide for humans and agents. Read this first, then jump to the source files or docs named below. Detailed knowledge lives in those docs — keep this file short.

## Effect Reference Repository

You have access to the Effect repository at `./.repos/effect`.

- Use `./.repos/effect` to extract best practices before introducing new patterns.
- Look at `./.repos/effect/AGENTS.md` for repository-specific guidance from the upstream project.
- Look at existing code in `./.repos/effect` to understand how Effect APIs are typically structured and tested.
- Prefer following upstream Effect conventions when this workshop repo does not yet establish its own pattern.
- Treat `./.repos/effect` as a reference implementation unless the task explicitly requires editing it.

## Code Style Guidance

- Keep changes minimal and consistent with the existing workshop code.
- Prefer established Effect patterns over ad hoc abstractions.
- Before adding a new approach, check whether `./.repos/effect` already demonstrates the same idea.

## Universal Rules

1. Run `vp check` before every PR. It runs format, lint, and type-aware checks in one pass via Vite+. Run `pnpm sg:check` after it for the ast-grep architecture rules (Vite+ does not wrap ast-grep).
2. Run `vp test` to verify the test suite (Vite+ runs the bundled Vitest with the root `vite.config.ts`).
3. Update docs in the same PR when architecture or workflow changes.
4. Cloudflare `env` and `ctx` are request-scoped. Never cache them globally.
5. Put reusable queries in `@repo/db/src/queries/` — do not scatter raw Drizzle in app handlers.
6. Use `fp issue` for all task tracking. See `FP_AGENTS.md`.
7. Effect v4 reference: `~/.local/share/ai-references/effect/v4/LLMS.md`. Authoritative source for `effect` and `@effect/*` packages — read it before browsing `node_modules/`.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

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
vp install              # restore deps with overrides applied
vp check                # vp fmt + vp lint (+ type-aware lint)
pnpm sg:check           # ast-grep architecture rules (not wrapped by Vite+)
vp test                 # vitest via Vite+
vp run types:check      # tsc type check across every workspace package
vp run build:packages   # dependency-ordered tsc build of @repo/* packages
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
- `vp install` fails on a peer mismatch for `vite` → confirm `pnpm-workspace.yaml` still contains the `peerDependencyRules.allowedVersions.vite: "*"` entry. `@voidzero-dev/vite-plus-core` is versioned independently of upstream Vite (`0.2.x` vs `7.x`), so any peer that demands a numeric `vite` range needs this rule. `vitest` no longer needs one: since Vite+ 0.2 it is real upstream Vitest. Bump it through `vp upgrade`, never by adding more `peerDependencyRules` entries.
- A Vite plugin in `tanstack-start` complains about a missing `vite` export → the override redirects `vite` to `@voidzero-dev/vite-plus-core`, pinned in the catalog. Run `vp upgrade` and bump the catalog `vite-plus`/`vite` pair together; do not edit the override version by hand.
- `env.HYPERDRIVE` undefined → check `wrangler.jsonc` and `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `.env`.
- `/api/openapi.json` missing → OpenAPI is registered in `apps/effect-worker-api/src/runtime.ts`, not the entrypoint.
- RPC returns 404 → handler is at `/rpc`; `/health` is the only non-RPC route in `effect-worker-rpc`.
- Traces missing → run `pnpm dev:traced:api` or `pnpm dev:traced:rpc`, inspect `.traces/spans.ndjson`.
- `tanstack-start` server functions can't access shared services → `effect-runtime.ts` uses `Layer.empty`; wire real layers before assuming dependencies are available.
- Docs disagree with code → trust `package.json`, `vite.config.ts`, `runtime.ts`, `wrangler.jsonc` over prose. Fix the prose.
