# Validation Gate Reference

All the commands used to verify this repository. Run them before declaring any change done. `pnpm check:all` is the single fast gate; the others catch problems `check:all` does not.

## The Fast Gate

```bash
pnpm check:all
```

Runs in sequence:

1. `oxlint .` — TypeScript and general-purpose lint rules
2. `sg scan` — ast-grep structural scan (Effect architecture rules + shared rules)
3. `oxfmt --check .` — format check

If this passes, the change is clean for style and structure. It does not compile or run tests.

## Full Verification Sequence

Run all four for any non-trivial change:

```bash
pnpm check:all   # lint + ast-grep + format
pnpm check       # tsc type check across every workspace package
pnpm test        # vitest test suite (all packages and apps)
pnpm build       # build shared packages in dependency order
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

## Individual Tools

### oxlint

```bash
pnpm lint              # scan entire repo
pnpm lint:fix          # auto-fix safe issues
pnpm exec oxlint .     # direct fallback (same as pnpm lint)
```

Config lives in the root `oxlint.json` (if present) or defaults.

### ast-grep

```bash
pnpm sg:check          # scan (same as sg scan)
pnpm sg:test           # run rule tests under rule-tests/
pnpm exec sg scan      # direct fallback
```

Rules live under `rules/effect/` (Effect architecture) and `rules/shared/` (general TypeScript). Tests live under `rule-tests/`. Config: `sgconfig.yml`.

When adding a new rule, add a corresponding test in `rule-tests/` and run `pnpm sg:test` to confirm it fires on the bad pattern and passes on the good pattern.

### Format

```bash
pnpm format            # write in place
pnpm format:check      # check only (what CI and check:all use)
pnpm exec oxfmt --write .   # direct fallback
```

### Tests

```bash
pnpm test              # run all tests via vitest workspace
pnpm coverage          # run with coverage
```

Test files live alongside source: `**/*.test.ts`. Vitest workspace config: `vitest.workspace.ts`. Shared config: `vitest.shared.ts`.

### Build

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

| Gate | Catches |
|------|---------|
| `pnpm lint` | Unused vars, eval, console, type-unsafe patterns |
| `pnpm sg:check` | Effect anti-patterns, architecture violations, structural rules |
| `pnpm format:check` | Formatting drift |
| `pnpm check` | TypeScript type errors across all packages |
| `pnpm test` | Behavioural regressions |
| `pnpm build` | Build-breaking import or export errors |

No single gate catches everything. Run all four for non-trivial changes.
