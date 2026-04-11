/**
 * Theme Provider Errors
 *
 * Tagged error classes used by the theme provider. Co-located with the
 * feature but in a dedicated `errors.ts` module so that `tagged-error-location`
 * can enforce "tagged error classes live next to other error definitions".
 *
 * @module
 */
import { Schema } from "effect";

/**
 * Raised when a component calls `useTheme()` outside of a `<ThemeProvider>`
 * subtree. Extends `Schema.TaggedErrorClass`, which produces a throwable
 * subclass of `Error` with an explicit `_tag`.
 */
export class UseThemeOutsideProviderError extends Schema.TaggedErrorClass<UseThemeOutsideProviderError>()(
  "UseThemeOutsideProviderError",
  {},
) {}
