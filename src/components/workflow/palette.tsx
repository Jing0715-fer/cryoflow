"use client";

import * as React from "react";
import { Search, Shapes } from "lucide-react";
import { JOB_GROUPS, JOB_TYPES } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import { TypeIcon } from "./icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Job type palette (RELION 5 catalog: SPA + Tomography) — used in the
 * desktop sidebar and inside the mobile Sheet.
 */
export function JobPalette({ onAdded }: { onAdded?: () => void }) {
  const addJob = useWorkflowStore((s) => s.addJob);
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? JOB_TYPES.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          t.group.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      )
    : JOB_TYPES;

  const groups = JOB_GROUPS.filter((g) => filtered.some((t) => t.group === g));

  const handleAdd = async (type: string) => {
    if (busy) return;
    setBusy(type);
    try {
      await addJob(type);
      onAdded?.();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3 p-3 pb-2">
        <div className="flex items-center gap-2 px-1">
          <Shapes className="size-3.5 text-primary" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Job Types
          </p>
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/70">
            {JOB_TYPES.length}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job types…"
            aria-label="Search job types"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <nav
        aria-label="RELION 5 job type catalog"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-4 pt-1"
      >
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No job types match “{query}”.
          </p>
        )}
        {groups.map((group) => (
          <div key={group}>
            <p className="flex items-baseline gap-2 px-2 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
              <span>{group === "SPA" ? "SPA · single-particle" : "Tomography"}</span>
              <span className="tabular-nums text-muted-foreground/50">
                {filtered.filter((t) => t.group === group).length}
              </span>
            </p>
            <div className="space-y-0.5">
              {filtered
                .filter((t) => t.group === group)
                .map((t) => {
                  return (
                    <Button
                      key={t.key}
                      variant="ghost"
                      className="h-auto w-full justify-start gap-2.5 px-2.5 py-2 text-left"
                      onClick={() => void handleAdd(t.key)}
                      aria-label={`Add ${t.label} job to canvas`}
                      title={`${t.tier === "core" ? "Core (real engine)" : t.tier === "cmd" ? "Runs real RELION CLI" : "Needs external binary"} — ${t.key}`}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md",
                          t.color.soft,
                          t.color.text
                        )}
                      >
                        <TypeIcon name={t.icon} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-tight">
                          {t.label}
                        </span>
                        <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                          {t.description}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded px-1 py-px font-mono text-[8px] uppercase tracking-wide",
                          t.tier === "core" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          t.tier === "cmd" && "bg-muted text-muted-foreground",
                          t.tier === "external" && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}
                        aria-hidden="true"
                      >
                        {t.tier === "core" ? "core" : t.tier === "cmd" ? "cli" : "ext"}
                      </span>
                    </Button>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
