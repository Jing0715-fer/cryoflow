"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Sun/Moon theme toggle. Rendered identically on the server until mounted
 * (both icons present, opacity gated) to avoid hydration mismatches.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative text-muted-foreground hover:text-foreground"
    >
      <Sun
        className={
          "size-4.5 transition-all " +
          (mounted && isDark ? "scale-0 opacity-0" : "scale-100 opacity-100")
        }
      />
      <Moon
        className={
          "absolute size-4.5 transition-all " +
          (mounted && isDark ? "scale-100 opacity-100" : "scale-0 opacity-0")
        }
      />
    </Button>
  );
}
