import { Link } from "@tanstack/react-router";
import { Match, Option } from "effect";
import { ExternalLink, Github, Menu } from "lucide-react";
import * as React from "react";

import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ============================================================================
// Data model
// ============================================================================

interface NavigationItem {
  label: string;
  href: string;
  isExternal?: boolean;
  scrollTo?: string;
}

const navigationItems: ReadonlyArray<NavigationItem> = [
  { label: "Features", href: "#features", scrollTo: "features" },
  {
    label: "Documentation",
    href: "https://tanstack.com/start/latest/docs/framework/react/overview",
    isExternal: true,
  },
  {
    label: "GitHub",
    href: "https://github.com/backpine/tanstack-start-on-cloudflare",
    isExternal: true,
  },
];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Best-effort smooth scroll to an element id. Becomes a no-op when the
 * target is missing instead of branching on a nullable lookup via `if`.
 */
const smoothScrollTo = (elementId: string): void => {
  Option.match(Option.fromNullishOr(document.getElementById(elementId)), {
    onNone: () => undefined,
    onSome: (element) => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      return undefined;
    },
  });
};

/** Picks the trailing icon for a navigation item based on its label. */
const trailingIcon = (label: string): React.ReactElement =>
  Match.value(label).pipe(
    Match.when("GitHub", () => <Github className="h-4 w-4" />),
    Match.orElse(() => <ExternalLink className="h-4 w-4" />),
  );

/**
 * Renders a single navigation entry in either its external-link shape or
 * its internal-button shape. Encapsulates the `isExternal` decision so the
 * desktop and mobile nav both call one component.
 */
interface NavLinkProps {
  item: NavigationItem;
  className: string;
  onNavigate: (item: NavigationItem) => void;
  showIcon: boolean;
}

const NavLink = ({ item, className, onNavigate, showIcon }: NavLinkProps): React.ReactElement =>
  Match.value(Boolean(item.isExternal)).pipe(
    Match.when(true, () => (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={() => onNavigate(item)}
      >
        <span>{item.label}</span>
        {showIcon && trailingIcon(item.label)}
      </a>
    )),
    Match.orElse(() => (
      <button onClick={() => onNavigate(item)} className={className}>
        {item.label}
      </button>
    )),
  );

// ============================================================================
// Component
// ============================================================================

export function NavigationBar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = React.useCallback((item: NavigationItem) => {
    Option.match(Option.fromNullishOr(item.scrollTo), {
      onNone: () => undefined,
      onSome: (target) => {
        smoothScrollTo(target);
        return undefined;
      },
    });
    setIsOpen(false);
  }, []);

  return (
    <nav
      className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out", {
        "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-primary/5":
          isScrolled,
        "bg-transparent": !isScrolled,
      })}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo and Brand */}
          <Link to="/" className="group flex items-center space-x-3 no-underline">
            <div className="flex flex-col">
              <span className="text-lg lg:text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary/80 transition-all duration-300">
                TanStack Start
              </span>
              <span className="text-xs text-muted-foreground font-medium tracking-wider">
                on CLOUDFLARE
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {navigationItems.map((item) => (
              <div key={item.label} className="relative group">
                <NavLink
                  item={item}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300 hover:bg-accent/50 group"
                  onNavigate={handleNavClick}
                  showIcon
                />
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 group-hover:w-3/4" />
              </div>
            ))}

            {/* Theme Toggle */}
            <div className="ml-2 pl-2 border-l border-border/30">
              <ThemeToggle variant="ghost" align="end" />
            </div>
          </div>

          {/* Mobile Menu Button + Theme Toggle */}
          <div className="lg:hidden flex items-center space-x-2">
            <ThemeToggle variant="ghost" align="end" />
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-10 w-10 hover:bg-accent/50"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[300px] bg-background/95 backdrop-blur-xl border-l border-border/50"
              >
                <SheetHeader className="text-left space-y-1 pb-6">
                  <SheetTitle className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                    Navigation
                  </SheetTitle>
                  <SheetDescription className="text-muted-foreground">
                    Explore TanStack Start
                  </SheetDescription>
                </SheetHeader>

                <div className="flex flex-col space-y-2 pb-6">
                  {navigationItems.map((item) => (
                    <div key={item.label} className="relative group">
                      <NavLink
                        item={item}
                        className="flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-all duration-300 hover:bg-accent/50"
                        onNavigate={handleNavClick}
                        showIcon
                      />
                    </div>
                  ))}
                </div>

                {/* Mobile CTA */}
                <div className="pt-4 border-t border-border/50"></div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
