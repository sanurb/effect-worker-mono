# Validation Gate Reference

All the commands used to verify this repository. Run them before declaring any change done.

The single fast gate is `vp check && pnpm sg:check`. The other commands catch problems that gate does not.

> The toolchain is **Vite+**. `vp` wraps Vitest, Oxlint, Oxfmt (and the package manager). Tools that Vite+ does **not** wrap — `tsgo`, `wrangler`, `drizzle-kit`, `sg`/`@ast-grep/cli`, `agent-ci` — are still invoked through `pnpm`.

## The Fast Gate

```bash
vp check          # vp fmt --check, vp lint, type-aware lint
pnpm sg:check     # ast-grep structural scan (Effect architecture rules + shared rules)
```

If both pass, the change is clean for style and structure. They do not compile or run tests.

## Full Verification Sequence

Run all of these for any non-trivial change:

```bash
vp install        # restore deps (resolves the vite/vitest overrides)
vp check          # format, lint, type-aware lint
pnpm sg:check     # ast-grep architecture rules
pnpm -r run check # tsgo type check across every workspace package
vp test           # vitest via Vite+ (bundled in vp)
pnpm build        # tsgo build of shared packages in dependency order
```

For a specific package only:

```bash
pnpm --filter @repo/domain run check
pnpm --filter @repo/db run check
pnpm --filter @repo/cloudflare run check
pnpm --filter @repo/contracts run check
pnpm --filter effect-worker-api run check
pnpm --filter effect-worker-rpc run check
```

`vp test --project @repo/domain` runs the tests for one workspace project only.

## Individual Tools

### Lint (`vp lint`, wraps Oxlint)

```bash
vp lint                 # scan entire repo
vp lint --fix           # auto-fix safe issues
vp lint --type-aware    # add type-aware lint passes (oxlint-tsgolint)
```

Config lives in `.oxlintrc.json`. **Do not install `oxlint` directly** — Vite+ wraps it. Use `vp upgrade` to bump it.

### ast-grep (not wrapped by Vite+)

```bash
pnpm sg:check          # scan (same as `sg scan`)
pnpm sg:test           # run rule tests under rule-tests/
pnpm exec sg scan      # direct fallback
```

Rules live under `rules/effect/` (Effect architecture) and `rules/shared/` (general TypeScript). Tests live under `rule-tests/`. Config: `sgconfig.yml`.

When adding a new rule, add a corresponding test in `rule-tests/` and run `pnpm sg:test` to confirm it fires on the bad pattern and passes on the good pattern.

### Format (`vp fmt`, wraps Oxfmt)

```bash
vp fmt                 # write in place
vp fmt --check         # check only (what CI and `vp check` use)
```

Config lives in `.oxfmtrc.json`. **Do not install `oxfmt` directly** — Vite+ wraps it.

### Tests (`vp test`, wraps Vitest)

```bash
vp test                # watch mode
vp test run            # single run (CI mode)
vp test run --coverage # with coverage
vp test --project @repo/domain  # one workspace project only
```

Test files live alongside source: `**/*.test.ts`. Test config lives in the root `vite.config.ts` under `test.*` (replaces the old `vitest.shared.ts` + `vitest.workspace.ts`). The setup file is `setupTests.ts`.

Effect-aware tests import from `@effect/vitest`. Plain tests, if added, **must** import from `vite-plus/test` — not from `vitest`. The pnpm override redirects the `vitest` package name to `@voidzero-dev/vite-plus-test`, so any leftover direct import from `vitest` still resolves but is forbidden by harness rules.

### Build (per-package, via `tsgo`)

```bash
pnpm build             # builds: domain → db → cloudflare → contracts (in order)
pnpm clean             # remove dist output under packages/*
```

Apps are not built by `pnpm build` at the root. Build them individually:

```bash
pnpm --filter effect-worker-api run build
pnpm --filter effect-worker-rpc run build
pnpm --filter tanstack-start-on-cloudflare run build
```

> `vp build` is reserved for Vite-driven apps (currently `tanstack-start`). The shared packages do not use Vite for their build pipeline.

## Observability Check

```bash
pnpm dev:traced:api    # start API worker with NDJSON trace capture
pnpm trace:inspect     # pretty-print captured spans (requires jq)
pnpm trace:clear       # remove .traces/spans.ndjson
```

Spans are written to `.traces/spans.ndjson`. See `docs/observability.md` for the trace record format.

## Database (run from packages/db)

```bash
cd packages/db
DATABASE_URL=postgres://... pnpm db:push       # push schema
DATABASE_URL=postgres://... pnpm db:generate   # generate migration
DATABASE_URL=postgres://... pnpm db:migrate    # run migrations
DATABASE_URL=postgres://... pnpm db:studio     # open Drizzle Studio
```

## What Each Gate Catches

| Gate                | Catches                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `vp lint`           | Unused vars, eval, console, type-unsafe patterns, type-aware lint |
| `vp fmt --check`    | Formatting drift                                                  |
| `vp check`          | Lint + format + type-aware lint in one pass                       |
| `pnpm sg:check`     | Effect anti-patterns, architecture violations, structural rules   |
| `pnpm -r run check` | TypeScript type errors across all packages (via `tsgo`)           |
| `vp test`           | Behavioural regressions                                           |
| `pnpm build`        | Build-breaking import or export errors                            |

No single gate catches everything. Run all of them for non-trivial changes.

## Local CI

Run the real GitHub Actions workflow locally via `@redwoodjs/agent-ci`. Requires Docker.

| Command               | What it does                                      |
| --------------------- | ------------------------------------------------- |
| `pnpm ci:local`       | Run `check.yml` (build + types + test) locally    |
| `pnpm ci:local:all`   | Discover and run all workflows for current branch |
| `pnpm ci:local:retry` | Retry only the failed step after fixing code      |

### When to use

- Before pushing a PR — runs the same pipeline GitHub will run
- After fixing a CI failure — `ci:local:retry` re-runs only the failed step, no full restart
- AI agents should prefer `ci:local` over pushing to trigger remote CI

### Flags reference

| Flag                 | Purpose                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `--quiet`            | Suppress animated output (default in scripts, also set by `AI_AGENT=1`)         |
| `--no-matrix`        | Collapse matrix combinations into single job                                    |
| `--pause-on-failure` | Keep container alive on failure (default behavior)                              |
| `--github-token`     | Provide token for remote reusable workflows (auto-resolves via `gh auth token`) |

### Secrets

Place secrets in `.env.agent-ci` at repo root (gitignored). Format: `KEY=VALUE`.
