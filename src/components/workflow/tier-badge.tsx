"use client";

/**
 * CryoFlow — the tier badge (Task 732): the tier language's own home.
 *
 * Every job type carries a tier — core / cmd / external (JobTier, the
 * spec's own field) — and until this window the tier's vocabulary lived
 * in two homes at once: the palette row's inline badge (compact face:
 * 8px, a dot, the short words, aria-hidden because the row's button
 * title already speaks the full names) and the type card's header badge
 * (full face: 10px, no dot, the full tier words, a testid). The t730
 * judgment had to stamp an exemption on BOTH homes' hue lines — the
 * census's own tell that a vocabulary is duplicated. The t720 law says
 * words shared by two faces live in their own file; this is that file
 * (fifth execution: JOURNAL_KIND_FACE → ParamDialectBadge →
 * FindMarkedText → the t730 hue judgements → this).
 *
 * The test stone from t730: "when the tier color changes, do you edit
 * one place or two?" After this window: one. The three vocabularies
 * that make the tier READ as a tier all live here —
 *
 *   • the hue face  — emerald/muted/amber, spoken as IDENTITY (t647's
 *     palette verdict family), never as a job state or a lens hue;
 *   • the dot       — the compact face's extra syllable, same hue words
 *     at solid volume;
 *   • the names     — TIER_NAMES, the full sentences ("Core (real
 *     engine)"…) the palette's button title has spoken since Task 133.
 *     They were a private ternary; now they are exported words, so a
 *     third face can say the tier's full name without re-inventing it.
 *
 * The two faces are the SAME badge with a size dialect, not two badges:
 * compact speaks the row's tight grammar (short words, aria-hidden —
 * the row's own title carries the full sentence), the full face speaks
 * the card's reading grammar (whole words, its own title, testid). No
 * motion anywhere: a tier is a fact, not an arrival.
 */

import * as React from "react";

import type { JobTier } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The full name each tier speaks when there is room for a sentence. */
export const TIER_NAMES: Record<JobTier, string> = {
  core: "Core (real engine)",
  cmd: "Runs real RELION CLI",
  external: "Needs external binary",
};

/** The short word each tier speaks on a tight row. */
export const TIER_SHORT: Record<JobTier, string> = {
  core: "core",
  cmd: "cli",
  external: "ext",
};

export function TierBadge({
  tier,
  testid,
  compact = false,
}: {
  tier: JobTier;
  /** Optional testid — each face names itself where a probe needs it. */
  testid?: string;
  /** The row face: short word + dot + aria-hidden. Default: the card face. */
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded px-1 py-px font-mono uppercase tracking-wide",
        compact ? "text-[8px]" : "px-1.5 py-px text-[10px]",
        tier === "core" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        tier === "cmd" && "bg-muted text-muted-foreground",
        tier === "external" && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      )}
      {...(compact ? { "aria-hidden": true as const } : { title: TIER_NAMES[tier] })}
      data-testid={testid}
    >
      {compact && (
        <span
          className={cn(
            "inline-block size-1 rounded-full",
            tier === "core" && "bg-emerald-500",
            tier === "cmd" && "bg-muted-foreground/60",
            tier === "external" && "bg-amber-500"
          )}
          aria-hidden="true"
        />
      )}
      {compact ? TIER_SHORT[tier] : tier}
    </span>
  );
}
