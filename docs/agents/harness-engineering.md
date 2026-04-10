# Harness Engineering

How to turn each change into a durable improvement, not a one-off fix.

## Core Mindset

- Humans steer outcomes; agents execute implementation details.
- Human attention is the scarce resource — optimize for signal, not volume.
- Repository-local docs are the source of truth. If knowledge lives only in chat threads, assume it is lost.
- Prefer small, enforceable rules over long, fragile instructions.

## Keep AGENTS.md Small

`AGENTS.md` is a map, not an encyclopedia. Detailed guidance lives in `docs/agents/`. When a behavior changes, update the closest source-of-truth doc in the same PR — not a summary in `AGENTS.md`.

## The Continuous Improvement Loop

Run this loop for every feature, fix, or refactor:

1. **Define intent and acceptance criteria** in the fp issue or PR description.
2. **Implement** the change.
3. **Validate** with the fast gate and then the full sequence:
   ```bash
   pnpm check:all   # lint + ast-grep + format
   pnpm check       # tsc
   pnpm test        # vitest
   ```
4. **Capture** what you learned: update a doc, add a test, or add a lint rule.
5. **Promote** repeated guidance into mechanical enforcement (see below).

## Promote Learning into Enforcement

When a mistake repeats, move the advice into a stronger guardrail. Use this ladder:

| Recurrence | Response |
|------------|----------|
| First time | Fix inline, add a doc note |
| Second time | Document explicitly in `docs/agents/patterns/` |
| Third time | Add an ast-grep rule in `rules/effect/` or `rules/shared/` with a test in `rule-tests/` |
| Systemic | Add a lint rule or encode the pattern in a script |

**Rule of thumb**: if a review comment appears twice, encode it. The toolchain already supports this — adding a new ast-grep rule is three files: the rule YAML, a test case, and optionally a doc update.

### Adding an ast-grep Rule

```bash
# 1. Add rule file
touch rules/effect/no-your-pattern.yml

# 2. Add test case
mkdir -p rule-tests/effect/no-your-pattern
touch rule-tests/effect/no-your-pattern/test.yml

# 3. Verify the rule fires correctly
pnpm sg:test

# 4. Verify the scan still passes on clean code
pnpm sg:check
```

See `sgconfig.yml` for the directory layout. Each rule targets a structural code pattern — write the bad pattern as the `pattern` field and describe the fix in `message`.

## Make Quality Legible

Signals should be easy to run and interpret locally:

- `pnpm check:all` is the single command any contributor can run to know if their change is clean for style and structure.
- Failure messages from oxlint and ast-grep should include enough context to fix the problem without searching docs.
- Keep PRs small with clear intent. Include the verification commands you ran in the PR description.
- Link to relevant docs near the code that needs context (inline comments or the nearest `README`).

## Working Agreements

- **Scope changes tightly.** Split large work into smaller steps that can each be verified independently.
- **Include verification commands** you ran in the fp issue comment or PR description.
- **Update docs in the same change** when a workflow, constraint, or architectural decision shifts.
- **Do not introduce new patterns without documenting when to use them.** A new Layer composition pattern without a doc note in `docs/agents/patterns/effect.md` is tech debt.
- **Favor boring, composable abstractions over opaque magic.** Effect's `Layer.mergeAll`, middleware factories, and named `Effect.fn` operations compose without surprises.

## Preventing Doc Drift

- When architecture changes, update `docs/architecture.md` and `AGENTS.md` routing in the same PR.
- When a new enforcement rule is added, update `AGENTS.md` at `docs/agents/` if the doc routing is affected.
- When troubleshooting reveals a missing signal, add an entry to the Troubleshooting section of `AGENTS.md`.
- Delete guidance that is no longer true. Stale docs are worse than no docs.

## Maintenance Cadence

Periodically (after a cluster of related changes):

- Remove stale guidance from `docs/agents/`.
- Tighten unclear instructions and add cross-links.
- Identify recurring review comments and propose one new ast-grep rule or doc improvement.
- Record follow-up tech debt as an explicit fp issue, not a TODO comment.

Continuous small cleanups are cheaper than periodic large rewrites.

## References

- Validation gate commands: `docs/agents/validation.md`
- Effect anti-pattern rules: `rules/effect/` + `rule-tests/effect/`
- Shared structural rules: `rules/shared/` + `rule-tests/shared/`
- Issue tracking workflow: `FP_AGENTS.md`
