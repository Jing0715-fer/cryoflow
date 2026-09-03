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
 * Job type palette — used in the desktop sidebar and inside the mobile Sheet.
 * The parent controls layout height; this component fills it and scrolls.
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
          t.group.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      )
    : JOB_TYPES;

  const groups = JOB_GROUPS.filter((g) =>
    filtered.some((t) => t.group === g)
  );

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
        aria-label="Job type catalog"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-4 pt-1"
      >
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No job types match “{query}”.
          </p>
        )}
        {groups.map((group) => (
          <div key={group}>
            <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
              {group}
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
