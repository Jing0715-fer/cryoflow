"use client";

import { Boxes, CheckCircle2, Github, Loader2, Snowflake } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { ThemeToggle } from "./theme-toggle";
import { HelpPopover } from "./help-popover";
import { Button } from "@/components/ui/button";

function StatChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div
      className="flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 card-lift"
      title={`${value} ${label}`}
    >
      <span className={tone}>{icon}</span>
      <span className="text-xs font-medium tabular-nums">{value}</span>
      <span className="hidden text-xs text-muted-foreground lg:inline">{label}</span>
    </div>
  );
}

export function Header() {
  const project = useWorkflowStore((s) => s.project);
  const jobs = useWorkflowStore((s) => s.jobs);

  const total = jobs.length;
  const running = jobs.filter((j) => j.status === "running").length;
  const completed = jobs.filter((j) => j.status === "completed").length;

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
      {/* Brand */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Snowflake className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight">CryoFlow</p>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
            Cryo-EM Workflow Builder
          </p>
        </div>

        {/* Project + stats chips */}
        <div className="hidden items-center gap-2 md:flex">
          <span
            className="max-w-[180px] truncate rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
            title={project?.name ?? "Loading project…"}
          >
            {project?.name ?? "…"}
          </span>
          <div className="hidden items-center gap-2 lg:flex" aria-label="Workflow statistics">
            <StatChip
              icon={<Boxes className="size-3.5" />}
              label="jobs"
              value={total}
              tone="text-muted-foreground"
            />
            <StatChip
              icon={<Loader2 className="size-3.5 animate-spin" />}
              label="running"
              value={running}
              tone="text-teal-600 dark:text-teal-400"
            />
            <StatChip
              icon={<CheckCircle2 className="size-3.5" />}
              label="completed"
              value={completed}
              tone="text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <HelpPopover />
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="text-muted-foreground hover:text-foreground"
        >
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="CryoFlow on GitHub (opens in a new tab)"
          >
            <Github className="size-4.5" />
          </a>
        </Button>
      </div>
    </header>
  );
}
