import * as path from "node:path";

import { defineConfig } from "vite-plus";

// `@repo/<name>` aliases used by tests so they import from source (or built
// output when TEST_DIST is set). Only the packages that actually exist are
// listed; the previous shared config aliased non-existent packages.
const alias = (name: string) => {
  const target = process.env.TEST_DIST !== undefined ? "dist/dist/esm" : "src";
  return {
    [`@repo/${name}/test`]: path.join(import.meta.dirname, "packages", name, "test"),
    [`@repo/${name}`]: path.join(import.meta.dirname, "packages", name, target),
  };
};

// Globs that should never be linted or formatted regardless of where they
// appear in the workspace. Centralised so `lint.ignorePatterns` and
// `fmt.ignorePatterns` stay in sync.
const ignoredPaths = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.wrangler/**",
  "**/__snapshots__/**",
  "**/*.d.ts",
  "**/routeTree.gen.ts",
  ".agents/",
  ".claude/",
  ".codemogger/",
  ".codex/",
  ".fp/",
  ".pi/",
  ".repos/",
  ".traces/",
  "references/",
];

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
    setupFiles: [path.join(import.meta.dirname, "setupTests.ts")],
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

  // Oxlint configuration. Vite+ recommends colocating lint rules in
  // `vite.config.ts` instead of `.oxlintrc.json` so the config stays type-safe
  // and composable. See https://viteplus.dev/guide/monorepo.
  lint: {
    plugins: ["eslint", "import", "typescript", "unicorn", "oxc"],
    env: {
      browser: false,
      node: true,
    },
    // Type-aware lint runs the rules that need TypeScript type information
    // (e.g. `consistent-type-imports`). `typeCheck: true` would additionally
    // run a full TS compiler pass, which `pnpm check` / `vp run types:check`
    // already does — keep it off so the responsibilities don't overlap.
    options: {
      typeAware: true,
    },
    ignorePatterns: ignoredPaths,
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": "off",
      "typescript/no-unused-vars": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "warn",
      "typescript/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-console": "error",
      "no-debugger": "error",
      "no-eval": "error",
      "no-new-func": "error",
      "no-throw-literal": "error",
      "no-return-assign": "error",
      eqeqeq: "error",
      "no-shadow": "off",
      "typescript/no-shadow": "error",
    },
    overrides: [
      {
        // Test files need console output and inevitably reach for `any`.
        files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
        rules: {
          "no-console": "off",
          "typescript/no-explicit-any": "off",
        },
      },
      {
        // Structured-log sink writes to stdout/stderr by design.
        files: ["packages/cloudflare/src/observability/ndjson-sink.ts"],
        rules: {
          "no-console": "off",
        },
      },
    ],
  },

  // Oxfmt configuration. Same rationale as `lint` above — keep the source of
  // truth in this file rather than `.oxfmtrc.json`.
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    bracketSpacing: true,
    arrowParens: "always",
    endOfLine: "lf",
    sortImports: {
      groups: [
        "builtin",
        "external",
        ["internal", "subpath"],
        ["parent", "sibling", "index"],
        "style",
        "unknown",
      ],
      newlinesBetween: true,
    },
    sortPackageJson: true,
    ignorePatterns: ignoredPaths,
  },

  // Vite Task: monorepo task orchestration. `vp run <task>` executes the
  // wrapped command with caching and dependency-aware scheduling. These tasks
  // give a single entry point that mirrors the project's existing pnpm-based
  // scripts but routes them through the Vite+ task runner.
  run: {
    tasks: {
      "build:packages": {
        // pnpm `--recursive` walks the workspace dep graph and runs `build`
        // in topological order (domain → db → cloudflare → contracts), so
        // the hand-rolled chain is no longer needed. The `./packages/*`
        // filter excludes apps (worker apps would otherwise invoke
        // `wrangler deploy --dry-run`, tanstack-start would run `vp build`).
        command: "pnpm --recursive --filter './packages/*' run build",
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
  staged: {
    "*.@(js|ts|tsx|md|yaml|yml|json)": "vp check --fix",
  },
});
