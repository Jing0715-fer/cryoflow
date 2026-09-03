"use client";

import * as React from "react";
import {
  Boxes,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  Github,
  Loader2,
  RefreshCw,
  Snowflake,
  X,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { ThemeToggle } from "./theme-toggle";
import { HelpPopover } from "./help-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

/* ------------------------------------------------------------------ */
/* Project switcher                                                     */
/* ------------------------------------------------------------------ */

function ProjectSwitcher() {
  const project = useWorkflowStore((s) => s.project);
  const projects = useWorkflowStore((s) => s.projects);
  const switchProject = useWorkflowStore((s) => s.switchProject);
  const [pending, setPending] = React.useState(false);

  const onChange = (id: string) => {
    if (pending || !project || id === project.id) return;
    setPending(true);
    void switchProject(id).finally(() => setPending(false));
  };

  return (
    <div className="flex items-center gap-1.5">
      <Select value={project?.id ?? ""} onValueChange={onChange}>
        <SelectTrigger
          className="h-8 w-[150px] rounded-lg border bg-card text-xs font-medium sm:w-[190px] md:w-[220px]"
          aria-label="Active project"
          title={project?.name}
        >
          <SelectValue placeholder={pending ? "Switching…" : "Select project"} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="max-w-[170px] truncate">{p.name}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 shrink-0 px-1 text-[9px] font-semibold uppercase tracking-wide",
                    p.engine === "relion"
                      ? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                      : "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-400"
                  )}
                >
                  {p.engine === "relion" ? "RELION" : "SIM"}
                </Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* RELION environment chip + detail popover                             */
/* ------------------------------------------------------------------ */

function BinaryRow({ name, present }: { name: string; present: boolean }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md border bg-secondary/50 px-1.5 py-0.5">
      {present ? (
        <Check className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <X className="size-3 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      )}
      <span className="truncate font-mono text-[10px] text-muted-foreground">{name}</span>
    </span>
  );
}

function RelionStatusChip() {
  const system = useWorkflowStore((s) => s.system);
  const refreshSystem = useWorkflowStore((s) => s.refreshSystem);
  const systemRefreshing = useWorkflowStore((s) => s.systemRefreshing);

  const found = system?.found ?? false;
  const label = found ? `RELION ${system?.version ?? ""}`.trim() : "RELION not found";
  const title = found
    ? `RELION ${system?.version ?? "?"} · ${system?.path ?? ""}`
    : "RELION 5 not detected on this host";

  // WSL three-state: RELION found inside WSL / WSL ok but RELION not on PATH /
  // WSL itself unavailable — never collapse the last two into one message.
  const wsl = system?.wsl;
  const wslState = !wsl || !wsl.available
    ? "unavailable"
    : wsl.relionPath
      ? "relion"
      : "no-relion";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          aria-label={`RELION environment status: ${label}`}
          className="flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 card-lift transition-colors hover:bg-secondary/60"
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-60",
                found ? "animate-ping bg-emerald-500" : "bg-amber-500"
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                found ? "bg-emerald-500" : "bg-amber-500"
              )}
            />
          </span>
          {found ? (
            <CircleCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <CircleAlert className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          )}
          <span className="text-xs font-medium">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {found ? (
              <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <CircleAlert className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            )}
            <p className="text-sm font-semibold">
              {found ? "RELION detected" : "RELION not detected"}
            </p>
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="flex justify-between gap-2">
              <span className="shrink-0">Version</span>
              <span className="font-medium text-foreground">{system?.version ?? "—"}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="shrink-0">Source</span>
              <span className="font-medium text-foreground">{system?.source ?? "—"}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="shrink-0">Path</span>
              <span className="truncate font-mono text-[10px] text-foreground" title={system?.path ?? ""}>
                {system?.path ?? "—"}
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="shrink-0">WSL</span>
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    wslState === "relion"
                      ? "bg-emerald-500"
                      : wslState === "no-relion"
                        ? "bg-amber-500"
                        : "bg-muted-foreground/40"
                  )}
                  aria-hidden="true"
                />
                {wslState === "relion"
                  ? `RELION ${wsl?.version ?? ""} in WSL${wsl?.distro ? ` (${wsl.distro})` : ""}`
                  : wslState === "no-relion"
                    ? "WSL ok · RELION not on PATH"
                    : wsl?.unavailableReason === "no-distro"
                      ? "WSL present · no distro"
                      : "WSL not installed"}
              </span>
            </p>
            {system?.wsl.source && system.wsl.relionPath && (
              <p className="flex justify-between gap-2">
                <span className="shrink-0">WSL source</span>
                <span className="max-w-48 truncate font-mono text-[10px] text-foreground" title={`${system.wsl.source} · ${system.wsl.relionPath}`}>
                  {system.wsl.source} · {system.wsl.relionPath}
                </span>
              </p>
            )}
            {system?.wsl.note && (
              <div className="space-y-0.5 rounded-md bg-muted/60 px-2 py-1.5">
                {system.wsl.note.split("\n").map((line, i) => (
                  <p
                    key={i}
                    className={cn(
                      "text-[10px] leading-relaxed",
                      /^[A-C]\)/.test(line.trim()) && "font-mono text-foreground/80"
                    )}
                  >
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Binaries
            </p>
            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
              {(system?.binaries ?? []).map((b) => (
                <BinaryRow key={b.name} name={b.name} present={b.present} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              External programs
            </p>
            <div className="flex flex-wrap gap-1">
              {(system?.externals ?? []).map((b) => (
                <BinaryRow key={b.name} name={b.name} present={b.present} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground/70">
              checked {system ? new Date(system.checkedAt).toLocaleTimeString() : "—"}
            </p>
            <button
              type="button"
              onClick={() => void refreshSystem()}
              disabled={systemRefreshing}
              className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-60"
              title="Re-run the RELION/WSL environment probe (bypasses the 60s cache)"
            >
              <RefreshCw
                className={cn("size-3", systemRefreshing && "animate-spin")}
                aria-hidden="true"
              />
              {systemRefreshing ? "detecting…" : "Re-detect"}
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                               */
/* ------------------------------------------------------------------ */

export function Header() {
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

        {/* Project switcher + stats chips */}
        <div className="hidden items-center gap-2 md:flex">
          <ProjectSwitcher />
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
      <div className="flex items-center gap-1.5">
        <div className="hidden sm:block">
          <RelionStatusChip />
        </div>
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
