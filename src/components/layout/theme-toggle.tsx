"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsHydrated } from "@/hooks/use-motion-variants";

/**
 * Light / dark toggle (ui-context.md §Tokens & theme). The Sun/Moon icons swap
 * with a spring and cross-fade; transforms are skipped when motion is reduced.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useIsHydrated();

  // Before hydration we render a stable placeholder so the markup matches the
  // server; otherwise the sun/moon glyph would flip on first paint.
  if (!hydrated) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme" className={className} disabled>
        <Sun className="size-[18px]" strokeWidth={1.75} />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          aria-pressed={isDark}
          className={cn("relative overflow-hidden", className)}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          <motion.span
            key={isDark ? "moon" : "sun"}
            initial={{ y: 10, opacity: 0, rotate: -25 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={springs.gentle}
            className="grid place-items-center"
          >
            {isDark ? (
              <Moon className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <Sun className="size-[18px]" strokeWidth={1.75} />
            )}
          </motion.span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{isDark ? "Light theme" : "Dark theme"}</TooltipContent>
    </Tooltip>
  );
}
