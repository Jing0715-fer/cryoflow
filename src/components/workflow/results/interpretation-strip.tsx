"use client";

/**
 * CryoFlow — the chart panels' interpretation strip (t488).
 *
 * The prep panels (CTF fit quality / accumulated motion / topaz training)
 * used to end at their numbers: badges, bars, curves — a reader had to do
 * the judging alone. But the agent's get_job_curves already speaks a
 * judgment grammar over the very same data ("worst fit resolution 4.4 Å",
 * "early-frames dominate", "train loss 0.61 → 0.31") — built in ONE well
 * (chart-data.ts's interpretCtf / interpretMotion / interpretTopaz,
 * t488). The strip is the panels' face of that grammar: a single
 * evidence line under the panel header, reading the fields the tool
 * quotes. Panel = model can quote, by construction.
 *
 * One component, not three hand-rolled rows: the same marker
 * (data-chart-interpretation), the same tone scale, the same type size —
 * a panel's judgment is visually recognisable as a judgment, and a bench
 * can assert the grammar once.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type InterpretationTone = "teal" | "amber" | "emerald" | "rose" | "fuchsia";

const TONE_CLASS: Record<InterpretationTone, string> = {
  teal: "border-running/25 bg-running/5 text-running-700 dark:text-running-300",
  amber: "border-warning/25 bg-warning/5 text-warning-700 dark:text-warning-300",
  emerald:
    "border-success/25 bg-success/5 text-success-700 dark:text-success-300",
  rose: "border-danger-600/25 bg-danger-600/5 text-danger",
  fuchsia:
    "border-fuchsia-600/25 bg-fuchsia-600/5 text-fuchsia-700 dark:text-fuchsia-300",
};

export function ChartInterpretation({
  icon: Icon,
  tone = "teal",
  label,
  children,
  className,
}: {
  /** the panel's own icon vocabulary — keep it in-family (the ctf panel
   *  speaks Radar, the motion panel Activity, the topaz panel Trending*). */
  icon: LucideIcon;
  tone?: InterpretationTone;
  /** the verdict's noun — "Worst fits" / "Drift triage" / "Train loss" */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-chart-interpretation=""
      className={cn(
        "mt-1.5 flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px] leading-snug",
        TONE_CLASS[tone],
        className
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold uppercase tracking-wide opacity-80">
          {label}
        </span>
        <span className="mx-1 opacity-40">·</span>
        <span className="tabular-nums">{children}</span>
      </p>
    </div>
  );
}
