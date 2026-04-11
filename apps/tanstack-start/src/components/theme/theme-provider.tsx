import { Boolean, Match, Option, Schema } from "effect";
import * as React from "react";

import { UseThemeOutsideProviderError } from "./errors";

// ============================================================================
// Theme model
// ============================================================================

/**
 * Literal schema for the user-facing theme choice. Using Schema instead of a
 * bare string-literal union means we decode-validate values coming out of
 * `localStorage` instead of casting them with `as Theme`.
 */
const ThemeSchema = Schema.Literals(["dark", "light", "system"] as const);
type Theme = typeof ThemeSchema.Type;

type ResolvedTheme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  attribute?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme | undefined;
  systemTheme: ResolvedTheme | undefined;
};

// ============================================================================
// Browser capability helpers
//
// Every DOM/localStorage access goes through one of these `Option`-returning
// accessors so SSR guards become declarative `Option.match` branches instead
// of scattered `if (typeof X === "undefined") return` statements.
// ============================================================================

const tryWindow = (): Option.Option<Window> => Option.fromNullishOr(globalThis.window);

const tryDocument = (): Option.Option<Document> => Option.fromNullishOr(globalThis.document);

const tryLocalStorage = (): Option.Option<Storage> => Option.fromNullishOr(globalThis.localStorage);

/** True in a browser environment. */
const hasWindow = (): boolean => Option.isSome(tryWindow());

/** Parses a persisted theme string with schema validation and fallback. */
const parseStoredTheme = (storageKey: string, defaultTheme: Theme): Theme =>
  Option.getOrElse(
    Option.flatMap(tryLocalStorage(), (storage) =>
      Option.flatMap(Option.fromNullishOr(storage.getItem(storageKey)), (raw) =>
        Schema.decodeUnknownOption(ThemeSchema)(raw),
      ),
    ),
    () => defaultTheme,
  );

/** Queries the current OS color-scheme preference (browser-only). */
const detectSystemTheme = (): Option.Option<ResolvedTheme> =>
  Option.map(tryWindow(), (win) =>
    Boolean.match(win.matchMedia("(prefers-color-scheme: dark)").matches, {
      onTrue: () => "dark" as const,
      onFalse: () => "light" as const,
    }),
  );

// ============================================================================
// DOM mutation helpers
// ============================================================================

/** CSS snippet that kills in-flight transitions. */
const disableTransitionsStyle =
  "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}";

/**
 * Inserts a transient style node that suppresses CSS transitions, forces a
 * reflow so the suppression applies synchronously, and removes the node on
 * the next tick.
 */
const suppressTransitionsOnce = (doc: Document, win: Window): void => {
  const css = doc.createElement("style");
  css.appendChild(doc.createTextNode(disableTransitionsStyle));
  doc.head.appendChild(css);
  // Read a layout-affecting value to force the browser to apply the style
  // before subsequent mutations. The return value is intentionally unused.
  win.getComputedStyle(doc.body);
  setTimeout(() => {
    doc.head.removeChild(css);
  }, 1);
};

/** Writes the resolved theme onto the document root via class list or attribute. */
const writeThemeToRoot = (doc: Document, targetTheme: ResolvedTheme, attribute: string): void => {
  const root = doc.documentElement;
  Match.value(attribute).pipe(
    Match.when("class", () => {
      root.classList.remove("light", "dark");
      root.classList.add(targetTheme);
      return undefined;
    }),
    Match.orElse(() => {
      root.setAttribute(attribute, targetTheme);
      return undefined;
    }),
  );
};

/**
 * Collapses the user-facing `Theme` choice into the resolved `light`/`dark`
 * target. Returns `undefined` when the user picked `"system"` and the OS
 * preference has not been detected yet (SSR or first render).
 */
const resolveTheme = (
  theme: Theme,
  systemTheme: ResolvedTheme | undefined,
): ResolvedTheme | undefined =>
  Match.value(theme).pipe(
    Match.when("system", () => systemTheme),
    Match.whenOr("dark", "light", (t) => t),
    Match.exhaustive,
  );

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  resolvedTheme: undefined,
  systemTheme: undefined,
};

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState);

// ============================================================================
// Provider
// ============================================================================

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  attribute = "class",
  enableSystem = true,
  disableTransitionOnChange = false,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() =>
    parseStoredTheme(storageKey, defaultTheme),
  );

  const [systemTheme, setSystemTheme] = React.useState<ResolvedTheme | undefined>(() =>
    Option.getOrUndefined(detectSystemTheme()),
  );

  const [isMounted, setIsMounted] = React.useState(false);

  const resolvedTheme = resolveTheme(theme, systemTheme);

  const setTheme = React.useCallback(
    (newTheme: Theme) => {
      Option.match(tryLocalStorage(), {
        onNone: () => undefined,
        onSome: (storage) => {
          storage.setItem(storageKey, newTheme);
          return undefined;
        },
      });
      setThemeState(newTheme);
    },
    [storageKey],
  );

  const applyTheme = React.useCallback(
    (targetTheme: ResolvedTheme | undefined) => {
      // Gate the body on having both a concrete theme target and a live
      // document. Replaces the previous `if (!targetTheme || typeof document
      // === "undefined") return` guard.
      Option.match(Option.all([Option.fromNullishOr(targetTheme), tryDocument(), tryWindow()]), {
        onNone: () => undefined,
        onSome: ([target, doc, win]) => {
          Option.match(
            Option.liftPredicate(undefined, () => disableTransitionOnChange),
            {
              onNone: () => undefined,
              onSome: () => {
                suppressTransitionsOnce(doc, win);
                return undefined;
              },
            },
          );
          writeThemeToRoot(doc, target, attribute);
          return undefined;
        },
      });
    },
    [attribute, disableTransitionOnChange],
  );

  // Apply theme when mounted state or resolvedTheme changes.
  React.useEffect(() => {
    Option.match(
      Option.liftPredicate(resolvedTheme, () => isMounted),
      {
        onNone: () => undefined,
        onSome: (target) => {
          applyTheme(target);
          return undefined;
        },
      },
    );
  }, [resolvedTheme, applyTheme, isMounted]);

  // Subscribe to system theme changes. The effect is a no-op on the server
  // and when the caller has disabled system-theme tracking.
  React.useEffect(() => {
    const cleanup = Option.flatMap(tryWindow(), (win) =>
      Boolean.match(enableSystem, {
        onFalse: () => Option.none<() => void>(),
        onTrue: () => {
          const mediaQuery = win.matchMedia("(prefers-color-scheme: dark)");
          const handleSystemThemeChange = (e: MediaQueryListEvent): void => {
            setSystemTheme(
              Boolean.match(e.matches, {
                onTrue: () => "dark" as const,
                onFalse: () => "light" as const,
              }),
            );
          };
          mediaQuery.addEventListener("change", handleSystemThemeChange);
          return Option.some(() =>
            mediaQuery.removeEventListener("change", handleSystemThemeChange),
          );
        },
      }),
    );

    return Option.getOrUndefined(cleanup);
  }, [enableSystem]);

  // Hydration effect — apply the correct theme on first client mount.
  React.useEffect(() => {
    setIsMounted(true);
    applyTheme(resolveTheme(theme, systemTheme));
  }, [theme, systemTheme, applyTheme]);

  // Pre-hydration script that sets the theme class before React hydrates,
  // preventing a flash of incorrect theme (FOIT).
  React.useEffect(() => {
    Option.match(tryDocument(), {
      onNone: () => undefined,
      onSome: (doc) => {
        const script = doc.createElement("script");
        script.innerHTML = `
          try {
            var theme = localStorage.getItem('${storageKey}') || '${defaultTheme}';
            var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            var resolvedTheme = theme === 'system' ? systemTheme : theme;
            if (resolvedTheme === 'dark') {
              document.documentElement.classList.add('dark');
              document.documentElement.classList.remove('light');
            } else {
              document.documentElement.classList.add('light');
              document.documentElement.classList.remove('dark');
            }
          } catch (e) {}
        `;
        Option.match(Option.fromNullishOr(doc.querySelector("script[data-theme-script]")), {
          onNone: () => {
            script.setAttribute("data-theme-script", "true");
            doc.head.appendChild(script);
            return undefined;
          },
          onSome: () => undefined,
        });
        return undefined;
      },
    });
  }, [storageKey, defaultTheme]);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme: Boolean.match(isMounted, {
        onTrue: () => resolvedTheme,
        onFalse: () => undefined,
      }),
      systemTheme: Boolean.match(isMounted, {
        onTrue: () => systemTheme,
        onFalse: () => undefined,
      }),
    }),
    [theme, setTheme, resolvedTheme, systemTheme, isMounted],
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

// ============================================================================
// Consumer hook
// ============================================================================

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext);
  return Option.match(Option.fromNullishOr(context), {
    onNone: (): never => {
      throw new UseThemeOutsideProviderError({});
    },
    onSome: (resolved) => resolved,
  });
};

// Keep `hasWindow` reachable so bundlers tree-shake it only when unused.
export { hasWindow };
