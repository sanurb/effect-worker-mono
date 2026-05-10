import * as path from "node:path";

import { defineConfig } from "vite-plus";

// `@repo/<name>` aliases for test runs: source by default, dist when
// TEST_DIST is set so tests exercise the published shape.
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
  // Apps that need a Vite server (e.g. tanstack-start) keep their own
  // `vite.config.ts`; this root config is consumed by `vp test` only.
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
    // Per-package test overrides go inline above, not in scattered
    // `vitest.config.ts` files.
    projects: ["packages/*"],
  },

  // Oxlint config — co-located here per Vite+'s monorepo guide so it stays
  // type-safe and avoids nested `.oxlintrc.json` discovery into `.repos/`.
  // https://viteplus.dev/guide/monorepo
  lint: {
    plugins: ["eslint", "import", "typescript", "unicorn", "oxc"],
    env: {
      browser: false,
      node: true,
    },
    // `typeCheck: true` would re-run the full TS compiler pass that
    // `vp run types:check` already does — leave it off to avoid the overlap.
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

  // Oxfmt — co-located here for the same reason as `lint`.
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

  // Monorepo tasks dispatched via `vp run <task>`.
  run: {
    tasks: {
      "build:packages": {
        // `./packages/*` filter excludes apps — building those would invoke
        // `wrangler deploy --dry-run` / `vp build` which we don't want here.
        // `--recursive` walks the workspace dep graph in topological order.
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
