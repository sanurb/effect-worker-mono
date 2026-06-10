// Compatibility shim for `@vitest/runner`.
//
// `@effect/vitest@4.0.0-beta.78+` imports `getCurrentSuite` from
// `@vitest/runner`, but this repo replaces upstream `vitest` with
// `@voidzero-dev/vite-plus-test` (Vite+). Vite+ bundles its runner internally
// and resolves any `@vitest/*` / `vitest/*` specifier *from the project root*
// (see `VitestCoreResolver` in vite-plus-test) — in a normal Vitest install
// `@vitest/runner` is a real sibling package there, but Vite+ never publishes
// one, so the import has nothing to resolve to.
//
// Declaring this package as a root `@vitest/runner` dependency fills that gap.
// It re-exports the collector from `vitest/suite` (Vite+'s only public handle
// on the bundled runner), so `getCurrentSuite` stays the SAME singleton that
// `describe`/`it` populate. A standalone `@vitest/runner@4.x` would be a
// different collector instance and silently break suite registration.
export {
  createChainable,
  createTaskCollector,
  getCurrentSuite,
  getCurrentTest,
  getFn,
  getHooks,
  setFn,
  setHooks,
} from "vitest/suite";
