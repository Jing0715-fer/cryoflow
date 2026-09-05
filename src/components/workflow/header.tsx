"use client";

import * as React from "react";
import {
  Boxes,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  Github,
  Layers,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Server,
  Snowflake,
  Terminal,
  Workflow,
  X,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { ThemeToggle } from "./theme-toggle";
import { HelpPopover } from "./help-popover";
import { CommandPaletteTrigger } from "./command-palette";
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
import type { RelionInstallClient } from "@/lib/types";
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
                  className="h-4 shrink-0 border-teal-500/40 bg-teal-500/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400"
                >
                  RELION
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
/* RELION install switcher (multi-version)                             */
/* ------------------------------------------------------------------ */

function InstallRow({
  install,
  selected,
  pending,
  onSelect,
}: {
  install: RelionInstallClient;
  selected: boolean;
  pending: boolean;
  onSelect: (id: string) => void;
}) {
  const isWsl = install.execution === "wsl";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={`${install.path}${install.distro ? ` · ${install.distro}` : ""}`}
      disabled={pending || selected}
      onClick={() => onSelect(install.id)}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
        selected
          ? "border-teal-500/50 bg-teal-500/10"
          : "border-border bg-card hover:bg-secondary/60",
        pending && "opacity-70"
      )}
    >
      {/* selected / switching indicator */}
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-teal-500 bg-teal-500" : "border-muted-foreground/40"
        )}
        aria-hidden="true"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin text-teal-600 dark:text-teal-400" />
        ) : (
          selected && <Check className="size-3 text-white" />
        )}
      </span>
      {/* version + mode */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-semibold tabular-nums">
            RELION {install.version ?? "version ?"}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "h-4 shrink-0 px-1 text-[9px] font-semibold uppercase tracking-wide",
              isWsl
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                : "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"
            )}
          >
            {isWsl ? `WSL · ${install.distro ?? "default"}` : "native"}
          </Badge>
          {install.mpiBinary && (
            <Badge
              variant="outline"
              className="h-4 shrink-0 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
              title="relion_refine_mpi present — MPI-capable install"
            >
              MPI
            </Badge>
          )}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
          {install.path}
        </span>
        <span className="block text-[9px] text-muted-foreground/70">
          via {install.source}
          {install.ctffindPath ? " · ctffind ✓" : " · no ctffind"}
        </span>
      </span>
      {isWsl ? (
        <Terminal className="size-3.5 shrink-0 text-cyan-600/70 dark:text-cyan-400/70" aria-hidden="true" />
      ) : (
        <Server className="size-3.5 shrink-0 text-teal-600/70 dark:text-teal-400/70" aria-hidden="true" />
      )}
    </button>
  );
}

function InstallSwitcher() {
  const system = useWorkflowStore((s) => s.system);
  const selectRelionInstall = useWorkflowStore((s) => s.selectRelionInstall);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const installs = system?.installs ?? [];
  if (installs.length === 0) return null;

  const onSelect = async (id: string) => {
    if (pendingId) return;
    setPendingId(id);
    try {
      await selectRelionInstall(id);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Detected installs</span>
        <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
          {installs.length > 1
            ? `${installs.length} versions — click to switch`
            : system?.autoPicked
              ? "auto-selected"
              : "1 found"}
        </span>
      </p>
      <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5" role="radiogroup" aria-label="RELION installs">
        {installs.map((install) => (
          <InstallRow
            key={install.id}
            install={install}
            selected={install.id === system?.selectedId}
            pending={pendingId === install.id}
            onSelect={(id) => void onSelect(id)}
          />
        ))}
      </div>
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
  const viaWsl = (system?.source ?? "").startsWith("WSL");
  const extraInstalls = Math.max(0, (system?.installs.length ?? 0) - 1);
  const label = found
    ? `RELION ${system?.version ?? ""}${viaWsl ? " · WSL" : ""}${extraInstalls > 0 ? ` · +${extraInstalls}` : ""}`.trim()
    : "RELION not found";
  const title = found
    ? `RELION ${system?.version ?? "?"} · ${system?.path ?? ""}${viaWsl ? " (inside WSL)" : ""}${extraInstalls > 0 ? ` — ${extraInstalls} more install(s) detected, click to switch` : ""}`
    : "RELION not detected on this host — click for guidance";

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
              {found
                ? viaWsl
                  ? "RELION detected (in WSL)"
                  : "RELION detected"
                : "RELION not detected"}
            </p>
            {found && (system?.installs.length ?? 0) > 1 && (
              <Badge
                variant="secondary"
                className="ml-auto h-5 shrink-0 px-1.5 text-[9px] font-semibold tabular-nums"
                title={`${system?.installs.length ?? 0} RELION installs discovered — switch below`}
              >
                {system?.installs.length} installs
              </Badge>
            )}
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="flex justify-between gap-2">
              <span className="shrink-0">Version</span>
              <span className="font-medium text-foreground">{system?.version ?? "—"}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="shrink-0">Source</span>
              <span className="max-w-52 truncate text-right font-medium text-foreground" title={system?.source ?? ""}>
                {system?.source ?? "—"}
              </span>
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
            {system?.execution === "wsl" && (
              <p className="rounded-md bg-cyan-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-cyan-700 dark:text-cyan-300">
                RELION runs inside WSL — jobs execute in the distro through the built-in WSL bridge: argv is relayed via wsl.exe, paths (drives ↔ /mnt/…) are translated automatically, and mpirun/ctffind are resolved distro-side.
              </p>
            )}
          </div>
          <InstallSwitcher />
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
/* Workspace switcher (canvas scope)                                    */
/* ------------------------------------------------------------------ */

function WorkspaceSelect() {
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkflowStore((s) => s.switchWorkspace);
  const jobs = useWorkflowStore((s) => s.jobs);

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  // live per-workspace job counts (derived client-side so poll ticks keep
  // the badges fresh without extra requests)
  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const j of jobs) {
      const key = j.workspaceId ?? "";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [jobs]);

  return (
    <Select
      value={activeWorkspaceId ?? ""}
      onValueChange={(id) => id && switchWorkspace(id)}
    >
      <SelectTrigger
        aria-label="Active workspace"
        title={active ? `Workspace: ${active.name}` : "Workspaces load with the project"}
        className="h-8 w-[128px] rounded-lg border bg-card text-xs font-medium sm:w-[160px]"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Layers className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <SelectValue placeholder="Workspace…">
            <span className="truncate">{active?.name ?? "Workspace…"}</span>
          </SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((w) => (
          <SelectItem key={w.id} value={w.id} className="text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="max-w-[140px] truncate">{w.name}</span>
              <Badge
                variant="secondary"
                className="h-4 shrink-0 px-1 text-[9px] font-semibold tabular-nums"
              >
                {counts.get(w.id) ?? 0}
              </Badge>
              {w.id === activeWorkspaceId && (
                <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------------ */
/* View switcher — dashboard ⇄ workflow canvas                           */
/* ------------------------------------------------------------------ */

function ViewSwitcher() {
  const view = useWorkflowStore((s) => s.view);
  const setView = useWorkflowStore((s) => s.setView);

  return (
    <div
      role="tablist"
      aria-label="View"
      className="flex h-8 items-center gap-0.5 rounded-lg border bg-card p-0.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "dashboard"}
        title="Project dashboard (Shift+D toggles)"
        onClick={() => setView("dashboard")}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
          view === "dashboard"
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutDashboard className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Dashboard</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "canvas"}
        title="Workflow canvas (Shift+D toggles)"
        onClick={() => setView("canvas")}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
          view === "canvas"
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Workflow className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Workflow</span>
      </button>
    </div>
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

        {/* Canvas ⇄ Dashboard view switcher */}
        <ViewSwitcher />

        {/* Workspace + project switcher, stats chips */}
        <div className="hidden items-center gap-2 md:flex">
          <WorkspaceSelect />
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
        <div className="hidden md:block">
          <CommandPaletteTrigger />
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
            href="https://github.com/Jing0715-fer/cryoflow"
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
