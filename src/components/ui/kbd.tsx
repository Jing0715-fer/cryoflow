"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The app's single kbd-chip vocabulary (t642).
 *
 * Before this primitive, eighteen `<kbd>` sites across nine files each
 * hand-rolled the same bones — rounded, bordered, mono, tiny — in eight
 * slightly different dialects (bg-background vs bg-muted vs bg-muted/60
 * vs bare; 8 / 8.5 / 9 / 10px; semibold vs bold vs regular; mono vs
 * inherit). The drift was invisible until the keyboard-contract arc
 * (t248 discoverability → t637 lens hints → t638 minimap chip → t641
 * shortcuts groups) put chips from different dialects side by side on
 * one screen — same grammar, mismatched handwriting.
 *
 * The primitive owns the BONES; each site owns its PLACEMENT. Default:
 * rounded border, muted fill, mono, 9px semibold. Sites that sit on a
 * muted surface flip to bg-background (the lens footer sandwich), sites
 * in tight chips snap padding/size down via className — tailwind-merge
 * resolves the conflicts, so overrides read as the delta they are.
 *
 * The keyboard contract must LOOK like one keyboard everywhere: a key
 * that renders as a key reads as a key.
 */
const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded border bg-muted px-1 font-mono text-[9px] font-semibold leading-[14px] text-foreground/80",
        className,
      )}
      {...props}
    />
  ),
);
Kbd.displayName = "Kbd";

export { Kbd };
