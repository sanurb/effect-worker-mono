import * as path from "node:path";

import { defineConfig } from "vite-plus";

// `@repo/<name>` aliases used by tests so they import from source (or built
// output when TEST_DIST is set). Only the packages that actually exist are
// listed; the previous shared config aliased non-existent packages.
const alias = (name: string) => {
  const target = process.env.TEST_DIST !== undefined ? "dist/dist/esm" : "src";
  return {
    [`@repo/${name}/test`]: path.join(__dirname, "packages", name, "test"),
    [`@repo/${name}`]: path.join(__dirname, "packages", name, target),
  };
};

// https://viteplus.dev/config/
export default defineConfig({
  // Standard Vite configuration that all tests inherit. Apps that need a Vite
  // server (e.g. tanstack-start) keep their own `vite.config.ts`.
  // Vite+ replaces esbuild with oxc; the old `esbuild.target` setting from the
  // pre-Vite+ shared config is now a no-op and has been removed.
  optimizeDeps: {
    exclude: ["bun:sqlite"],
  },

  // Vitest is wrapped by Vite+ and configured here in one place.
  test: {
    setupFiles: [path.join(__dirname, "setupTests.ts")],
    fakeTimers: {
      toFake: undefined,
    },
    sequence: {
      concurrent: true,
    },
    include: ["test/**/*.test.ts"],
    alias: {
      ...alias("cloudflare"),
      ...alias("contracts"),
      ...alias("db"),
      ...alias("domain"),
    },
    // `test.projects` replaces the deprecated `vitest.workspace.ts` file. Each
    // workspace package picks up this root config; per-package overrides go
    // inline here, not in scattered `vitest.config.ts` files.
    projects: ["packages/*"],
  },

  // Oxlint and Oxfmt configuration is left in `.oxlintrc.json` / `.oxfmtrc.json`
  // because they hold the project rule sets. Vite+ reads them automatically
  // when `vp lint` / `vp fmt` run. Add `lint` / `fmt` sections here only if
  // you want to override or migrate those files via `vp migrate`.

  // Vite Task: monorepo task orchestration. `vp run <task>` executes the
  // wrapped command with caching and dependency-aware scheduling. These tasks
  // give a single entry point that mirrors the project's existing pnpm-based
  // scripts but routes them through the Vite+ task runner.
  run: {
    tasks: {
      "build:packages": {
        command:
          "pnpm --filter '@repo/domain' run build && pnpm --filter '@repo/db' run build && pnpm --filter '@repo/cloudflare' run build && pnpm --filter '@repo/contracts' run build",
      },
      "types:check": {
        command: "pnpm -r run check",
      },
      "sg:check": {
        command: "sg scan",
      },
      "sg:test": {
        command: "sg test",
      },
    },
  },

  // Git hooks for staged files - https://viteplus.dev/guide/commit-hooks
  // `vp check` does not accept `--disable-nested-config`, so fmt and lint are
  // invoked separately. The flag keeps oxlint from descending into
  // `.repos/effect/.oxlintrc.json`, whose `@effect/oxc/oxlint` plugin is not
  // installed in this repo.
  staged: {
    "*.@(js|ts|tsx|md|yaml|yml|json)": ["vp fmt", "vp lint --disable-nested-config --fix"],
  },
});
