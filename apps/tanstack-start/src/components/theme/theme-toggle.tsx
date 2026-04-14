import { Match, Option } from "effect";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { useTheme } from "./theme-provider";

type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

interface ThemeToggleProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  showLabel?: boolean;
  align?: "start" | "center" | "end";
}

// ============================================================================
// Pure helpers
// ============================================================================

/** Next theme in the light → dark → system → light cycle. */
const nextTheme = (current: Theme): Theme =>
  Match.value(current).pipe(
    Match.when("light", () => "dark" as const),
    Match.when("dark", () => "system" as const),
    Match.when("system", () => "light" as const),
    Match.exhaustive,
  );

/** Human label describing the current effective theme. */
const describeActiveTheme = (theme: Theme, resolvedTheme: Resolved | undefined): string =>
  Match.value(theme).pipe(
    Match.when("system", () => `System (${resolvedTheme ?? "unknown"})`),
    Match.whenOr("light", "dark", (t) => t),
    Match.exhaustive,
  );

export function ThemeToggle({
  variant = "ghost",
  size = "default",
  showLabel = false,
  align = "end",
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Pick the trigger icon via Match.value. For "system" the icon is fixed;
  // for explicit themes we inspect the resolved theme so a dark resolved
  // theme shows the Moon icon even when the user switched to "system".
  const currentIcon = Match.value(theme).pipe(
    Match.when("system", () => (
      <Monitor
        className="h-4 w-4 transition-all duration-300 ease-in-out rotate-0 scale-100"
        aria-hidden="true"
      />
    )),
    Match.orElse(() =>
      Match.value(resolvedTheme).pipe(
        Match.when("dark", () => (
          <Moon
            className="h-4 w-4 transition-all duration-500 ease-in-out rotate-0 scale-100"
            aria-hidden="true"
          />
        )),
        Match.orElse(() => (
          <Sun
            className="h-4 w-4 transition-all duration-500 ease-in-out rotate-0 scale-100"
            aria-hidden="true"
          />
        )),
      ),
    ),
  );

  const themeOptions = [
    {
      value: "light",
      label: "Light",
      icon: Sun,
      description: "Use light theme",
    },
    {
      value: "dark",
      label: "Dark",
      icon: Moon,
      description: "Use dark theme",
    },
    {
      value: "system",
      label: "System",
      icon: Monitor,
      description: "Use system theme",
    },
  ] as const;

  const handleThemeSelect = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const currentLabel = Option.getOrUndefined(
    Option.fromNullishOr(themeOptions.find((option) => option.value === theme)?.label),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn(
            "relative overflow-hidden transition-all duration-200 ease-in-out",
            "hover:scale-105 active:scale-95",
            "focus:ring-2 focus:ring-ring focus:ring-offset-2",
            { "gap-2": showLabel, "aspect-square": !showLabel },
          )}
          aria-label="Toggle theme"
        >
          <div className="relative flex items-center justify-center">{currentIcon}</div>
          {showLabel && <span className="text-sm font-medium">{currentLabel}</span>}
          <span className="sr-only">
            Current theme: {describeActiveTheme(theme, resolvedTheme)}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-56 p-2 bg-popover/95 backdrop-blur-sm border border-border/50 shadow-lg"
      >
        <div className="grid gap-1">
          {themeOptions.map(function (option) {
            const Icon = option.icon;
            const isSelected = theme === option.value;

            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handleThemeSelect(option.value)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                  "transition-all duration-200 ease-in-out",
                  "hover:bg-accent/80 focus:bg-accent/80",
                  "rounded-md group",
                  { "bg-accent/60 text-accent-foreground": isSelected },
                )}
              >
                <div className="flex items-center justify-center w-5 h-5">
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-all duration-200 group-hover:scale-105",
                      isSelected && "text-accent-foreground scale-110",
                      !isSelected && "text-muted-foreground",
                    )}
                  />
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <span
                    className={cn("text-sm font-medium leading-none", {
                      "text-accent-foreground": isSelected,
                      "text-foreground": !isSelected,
                    })}
                  >
                    {option.label}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5 leading-none">
                    {option.description}
                  </span>
                </div>

                {isSelected && (
                  <Check className="h-4 w-4 text-accent-foreground animate-in fade-in-0 zoom-in-75 duration-150" />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>

        {resolvedTheme && (
          <div className="border-t border-border/50 mt-2 pt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
              {/*
                Indicator dot uses `bg-foreground` so its visibility follows
                the theme's own text color — no hardcoded palette colors.
              */}
              <div className="w-2 h-2 rounded-full transition-colors duration-200 bg-foreground" />
              Currently using {resolvedTheme} theme
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Simplified version for minimal use cases.
export function ThemeToggleSimple() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const handleToggle = () => {
    setTheme(nextTheme(theme));
  };

  const icon = Match.value(theme).pipe(
    Match.when("system", () => (
      <Monitor className="h-4 w-4 transition-all duration-300 ease-in-out rotate-0 scale-100" />
    )),
    Match.orElse(() =>
      Match.value(resolvedTheme).pipe(
        Match.when("dark", () => (
          <Moon className="h-4 w-4 transition-all duration-500 ease-in-out rotate-0 scale-100" />
        )),
        Match.orElse(() => (
          <Sun className="h-4 w-4 transition-all duration-500 ease-in-out rotate-0 scale-100" />
        )),
      ),
    ),
  );

  return (
    <Button
      variant="ghost"
      size="default"
      onClick={handleToggle}
      className={`
        relative overflow-hidden aspect-square
        transition-all duration-200 ease-in-out
        hover:scale-105 active:scale-95
        focus:ring-2 focus:ring-ring focus:ring-offset-2
      `}
      aria-label={`Switch to ${nextTheme(theme)} theme`}
    >
      <div className="relative flex items-center justify-center">{icon}</div>
      <span className="sr-only">Current theme: {describeActiveTheme(theme, resolvedTheme)}</span>
    </Button>
  );
}
