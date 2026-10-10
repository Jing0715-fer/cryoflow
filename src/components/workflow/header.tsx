"use client";

import * as React from "react";
import nextDynamic from "next/dynamic";
import {
  Activity,
  Boxes,
  Check,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  FileText,
  Github,
  Layers,
  LayoutDashboard,
  HardDrive,
  Loader2,
  Printer,
  RefreshCw,
  Server,
  Snowflake,
  Sparkles,
  StickyNote,
  Workflow,
  X,
} from "lucide-react";
import { useWorkflowStore, useActiveWorkspaceJobs } from "@/lib/store";
import { hasJudgment } from "@/lib/class-notes";
import { ThemeToggle } from "./theme-toggle";
import { HelpPopover } from "./help-popover";
import { RemoteClusterButton } from "./remote-cluster-dialog";
import { KnockSettingsButton } from "./finish-knock-button";
import { CommandPaletteTrigger, SESSION_REPORT_EVENT, SYSTEM_DIAGNOSTICS_EVENT } from "./command-palette";
import { EngineBuildRail, EngineHintBlock, EngineReDetectRow, InstallSwitcher } from "./engine-guidance";
// t197: the session QC report is code-split (react-markdown + remark-gfm
// ride their own chunk) — the app shell never pays for the document
// renderer until the report is opened for the first time.
const SessionReportDialog = nextDynamic(() => import("./session-report-dialog"), { ssr: false });
const StorageDialog = nextDynamic(() => import("./storage-dialog"), { ssr: false });
// t530: the diagnostics panel is code-split too — its rail + bars only
// ride a chunk when someone actually asks how the box is doing.
const SystemDiagnosticsDialog = nextDynamic(() => import("./system-diagnostics-dialog"), { ssr: false });
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

/** t483: the guide's storage door — the manual dispatches, the header
 *  (which owns the StorageDialog and its storageOpen state) listens.
 *  Same handshake as SESSION_REPORT_EVENT and REMOTE_CLUSTERS_OPEN_EVENT:
 *  the surface that names the door never mounts a second dialog, it only
 *  rings the owner's bell. The storage map had no cross-open route before
 *  — a manual row that says "open me" while wired to nothing is a lying
 *  door, so the route now exists. */
export const STORAGE_OPEN_EVENT = "cryoflow:open-storage";

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

  // t300 — a remote project's trigger shows WHERE its data lives (the
  // bound cluster), so the top bar names the world the canvas is editing.
  const activeRemote = project?.remote ?? null;

  return (
    // t510 — min-w-0 on the wrapper AND the trigger: flexbox floors rule
    // (a nowrap trigger's min-content is its FULL name — the fixed w-[]
    // is only a preference). Without the chain the trigger refuses below
    // 275px and paints over the actions cluster; with it the value
    // ellipsises and the row degrades gracefully.
    <div className="flex min-w-0 items-center gap-1.5">
      <Select value={project?.id ?? ""} onValueChange={onChange}>
        <SelectTrigger
          // t510 — tiered width: 170 at xl (1280–1535, where the row's
          // budget measured 650px: brand 266 + workspace 160 + this 170
          // + gaps 30 = 626 ≤ 650), the roomy 220 back from 2xl. The
          // name truncates a touch harder in the tight band; the full
          // name lives in the title and the dropdown. min-w-[130px] = a
          // name-worthy floor (an ellipsis with no name teaches nothing);
          // the binding badge's truncating text yields below it.
          className="h-8 w-[150px] min-w-[130px] rounded-lg border bg-card text-xs font-medium xl:w-[170px] 2xl:w-[220px]"
          aria-label="Active project"
          title={project?.name}
        >
          {/* t510 — the trigger speaks the NAME, nothing else (the same law
              WorkspaceSelect's trigger already obeys). Radix renders the
              selected item's whole content here — its shrink-0 RELION
              badge used to eat ~60px of every width and the whole name
              below 190px; the badge still lives on every dropdown row,
              and remote-ness has the outer violet binding badge. */}
          <SelectValue placeholder={pending ? "Switching…" : "Select project"}>
            <span className="truncate">{project?.name ?? ""}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="max-w-[170px] truncate">{p.name}</span>
                <Badge
                  variant="outline"
                  className="h-4 shrink-0 border-running/40 bg-running/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-running"
                >
                  RELION
                </Badge>
                {p.remote ? (
                  <Badge
                    variant="outline"
                    className="h-4 max-w-[140px] shrink-0 gap-1 border-violet-500/40 bg-violet-500/10 px-1 text-[9px] font-medium normal-case tracking-normal text-violet-600 dark:text-violet-400"
                    title={`Remote project — data on ${p.remote.username}@${p.remote.host}`}
                  >
                    <Server className="size-2.5" aria-hidden="true" />
                    <span className="truncate">{p.remote.host}</span>
                  </Badge>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {activeRemote ? (
        // t510 — the binding badge joins the shrink chain (it used to be
        // shrink-0: a hard 105px floor that ate the row's budget and left
        // the project trigger an ellipsis with no name — the ORIGINAL SIN
        // of the 1280 overflow, visible only in a remote-bound world).
        // Now it truncates with the trigger; the full host lives in title.
        <Badge
          variant="outline"
          className="h-8 max-w-[170px] min-w-0 gap-1 rounded-lg border-violet-500/40 bg-violet-500/10 px-2 text-[10px] font-medium normal-case tracking-normal text-violet-600 dark:text-violet-400"
          title={`Remote project — data lives on ${activeRemote.username}@${activeRemote.host}:${activeRemote.port}; the import browser and the run dialog target this cluster`}
        >
          <Server className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{activeRemote.name || activeRemote.host}</span>
        </Badge>
      ) : null}
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
        <Check className="size-3 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <X className="size-3 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      )}
      <span className="truncate font-mono text-[10px] text-muted-foreground">{name}</span>
    </span>
  );
}

function RelionStatusChip() {
  const system = useWorkflowStore((s) => s.system);

  const found = system?.found ?? false;
  const viaWsl = (system?.source ?? "").startsWith("WSL");
  const fromCache = system?.fromCache === true;
  const extraInstalls = Math.max(0, (system?.installs.length ?? 0) - 1);
  // t529 — while the recipe grinds a REAL RELION in its build tree, the
  // not-found chip says how far along it is instead of a bare "not found".
  const build = system?.build ?? null;
  const buildDone = build ? build.stages.filter((s) => s.state === "done").length : 0;
  const label = found
    ? `RELION ${system?.version ?? ""}${viaWsl ? " · WSL" : ""}${extraInstalls > 0 ? ` · +${extraInstalls}` : ""}`.trim()
    : `RELION not found${build ? ` · build ${buildDone}/${build.stages.length}` : ""}`;
  const title = found
    ? `RELION ${system?.version ?? "?"} · ${system?.path ?? ""}${viaWsl ? " (inside WSL)" : ""}${extraInstalls > 0 ? ` — ${extraInstalls} more install(s) detected, click to switch` : ""}${fromCache ? " · status from the saved last detection, re-verifying in the background" : ""}`
    : build
      ? `RELION not detected yet — a rebuild from the recipe is in progress (${buildDone}/${build.stages.length} stages done) in ${build.root}. Click for the stage rail + guidance.`
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
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 card-lift transition-colors hover:bg-secondary/60"
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-60",
                found ? "animate-ping bg-success-500" : "bg-warning-500"
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                found ? "bg-success-500" : "bg-warning-500"
              )}
            />
          </span>
          {found ? (
            <CircleCheck className="size-3.5 text-success" aria-hidden="true" />
          ) : (
            <CircleAlert className="size-3.5 text-warning" aria-hidden="true" />
          )}
          {/* t301 — a status chip is ONE line, full stop. Under header
              crowding (2xl stat chips + a remote project badge + a long
              "not found"/WSL label) the flex row squeezed this button to
              ~52px of label room and the multi-word label WRAPPED to three
              lines, blowing vertically out of the h-8 chrome onto its
              neighbors. shrink-0 lets the truncating LEFT cluster absorb
              the squeeze; nowrap+truncate keeps the chip itself honest
              (title carries the full text). */}
          <span className="max-w-[220px] truncate whitespace-nowrap text-xs font-medium">{label}</span>
          {fromCache && (
            <Badge
              variant="outline"
              className="h-4 shrink-0 border-warning/40 bg-warning/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-warning"
              title="This status was restored from the saved last detection — the server is re-verifying in the background and updates automatically"
            >
              saved
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {found ? (
              <CircleCheck className="size-4 text-success" aria-hidden="true" />
            ) : (
              <CircleAlert className="size-4 text-warning" aria-hidden="true" />
            )}
            <p className="text-sm font-semibold">
              {found
                ? viaWsl
                  ? "RELION detected (in WSL)"
                  : "RELION detected"
                : "RELION not detected"}
            </p>
            {fromCache && (
              <span
                className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning"
                title="data/relion-snapshot.json answered instantly; a fresh probe is running in the background"
              >
                <RefreshCw className="size-2.5 animate-spin" aria-hidden="true" />
                from saved detection
              </span>
            )}
            {found && !fromCache && (system?.installs.length ?? 0) > 1 && (
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
                      ? "bg-success-500"
                      : wslState === "no-relion"
                        ? "bg-warning-500"
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
          {!found && build && <EngineBuildRail build={build} />}
          {!found && system?.hint && <EngineHintBlock hint={system.hint} />}
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
          <EngineReDetectRow />
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

  // live per-workspace census (derived client-side so poll ticks keep
  // the badges fresh without extra requests). Task 148 widens the census
  // beyond the active workspace: the jobs array is PROJECT-wide (every
  // job carries its workspaceId), so each workspace's running/failed
  // counts are already here — the switcher just never spoke them.
  const counts = React.useMemo(() => {
    const map = new Map<string, { total: number; running: number; failed: number }>();
    for (const j of jobs) {
      const key = j.workspaceId ?? "";
      const c = map.get(key) ?? { total: 0, running: 0, failed: 0 };
      c.total += 1;
      if (j.status === "running") c.running += 1;
      else if (j.status === "failed") c.failed += 1;
      map.set(key, c);
    }
    return map;
  }, [jobs]);

  // Task 148 — the world next door. A runner in workspace B is invisible
  // to every census surface that speaks for workspace A (footer, tab
  // title, favicon) — so the CLOSED trigger carries one small dot while
  // any non-active workspace has life in it (rose outranks teal — the
  // favicon doctrine at workspace scope), with the per-workspace facts
  // spelled out in the title. Opening the menu, each item carries its
  // own dot. All derived — zero extra requests, poll ticks keep it live.
  const elsewhere = React.useMemo(() => {
    let running = 0;
    let failed = 0;
    const names: string[] = [];
    for (const w of workspaces) {
      if (w.id === activeWorkspaceId) continue;
      const c = counts.get(w.id);
      if (!c || (c.running === 0 && c.failed === 0)) continue;
      running += c.running;
      failed += c.failed;
      const bits: string[] = [];
      if (c.running) bits.push(`${c.running} running`);
      if (c.failed) bits.push(`${c.failed} failed`);
      names.push(`${w.name} — ${bits.join(" · ")}`);
    }
    return { running, failed, names };
  }, [workspaces, activeWorkspaceId, counts]);
  const elsewhereHue: "rose" | "teal" | "none" =
    elsewhere.failed > 0 ? "rose" : elsewhere.running > 0 ? "teal" : "none";

  /** the per-item dot — rose outranks teal (alarm outranks alive) */
  const dotFor = (id: string): "rose" | "teal" | "none" => {
    const c = counts.get(id);
    if (!c) return "none";
    if (c.failed > 0) return "rose";
    if (c.running > 0) return "teal";
    return "none";
  };

  return (
    <Select
      value={activeWorkspaceId ?? ""}
      onValueChange={(id) => id && switchWorkspace(id)}
    >
      <SelectTrigger
        aria-label="Active workspace"
        title={
          (active ? `Workspace: ${active.name}` : "Workspaces load with the project") +
          (elsewhereHue !== "none" ? ` · Elsewhere: ${elsewhere.names.join(", ")}` : "")
        }
        className="h-8 w-[128px] min-w-0 rounded-lg border bg-card text-xs font-medium sm:w-[160px]"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Layers className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <SelectValue placeholder="Workspace…">
            <span className="truncate">{active?.name ?? "Workspace…"}</span>
          </SelectValue>
          {elsewhereHue !== "none" && (
            <span
              data-ws-elsewhere={elsewhereHue}
              aria-hidden="true"
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                elsewhereHue === "rose" ? "bg-rose-500" : "bg-teal-500"
              )}
            />
          )}
        </span>
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((w) => {
          const dot = dotFor(w.id);
          const c = counts.get(w.id);
          const dotBits: string[] = [];
          if (c?.running) dotBits.push(`${c.running} running`);
          if (c?.failed) dotBits.push(`${c.failed} failed`);
          return (
            <SelectItem key={w.id} value={w.id} className="text-xs">
              <span
                className="flex min-w-0 items-center gap-2"
                title={dotBits.length ? dotBits.join(" · ") : undefined}
              >
                <span className="max-w-[140px] truncate">{w.name}</span>
                <Badge
                  variant="secondary"
                  className="h-4 shrink-0 px-1 text-[9px] font-semibold tabular-nums"
                >
                  {c?.total ?? 0}
                </Badge>
                {dot !== "none" && (
                  <span
                    data-ws-dot={dot}
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      dot === "rose" ? "bg-rose-500" : "bg-teal-500"
                    )}
                  />
                )}
              </span>
              {w.id === activeWorkspaceId && (
                <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              )}
            </SelectItem>
          );
        })}
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
        {/* t828 — the labels wait for xl: measured at 768-1023 the tabs
            (200px with labels) painted INTO the right cluster's first
            148px (the t510 interpenetration, alive at the md band); the
            icons alone fit beside the full seat row and the wordmark
            gets its room back. */}
        <span className="hidden xl:inline">Dashboard</span>
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
        <span className="hidden xl:inline">Workflow</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Note spotlight chip (Task 75)                                        */
/* ------------------------------------------------------------------ */

/** Toggles the note-spotlight lens and shows how many jobs in the ACTIVE
 *  workspace carry a human judgment. Disabled at zero — a lens over nothing
 *  is a dead control, and a disabled chip says "no annotations yet" more
 *  honestly than an empty toggle. Counts the active workspace (not the
 *  global store) because the lens itself only dims the canvas in front
 *  of the user.
 *  Task 83: counts via hasJudgment — job notes AND select2d class notes —
 *  the same predicate the canvas lens and the dashboard Noted chip read,
 *  so the chip can never promise a spotlight the lens won't deliver. */
function NoteSpotlightChip() {
  const jobs = useActiveWorkspaceJobs();
  const on = useWorkflowStore((s) => s.noteSpotlight);
  const toggle = useWorkflowStore((s) => s.toggleNoteSpotlight);
  const noted = jobs.filter(hasJudgment).length;
  return (
    <button
      type="button"
      data-note-spotlight
      data-note-spotlight-count={noted}
      aria-pressed={on}
      aria-label="Spotlight noted jobs"
      disabled={noted === 0}
      onClick={toggle}
      title={
        noted === 0
          ? "No noted jobs yet — add a note from a job's Overview tab or annotate classes in the gallery"
          : `${noted} job${noted === 1 ? "" : "s"} carry annotations — ${on ? "showing" : "click to spotlight"} them`
      }
      className={cn(
        // t510 — the chip joins the wide tier (2xl): at 1280 the middle
        // row's three controls painted 207px past their container INTO
        // the actions cluster (measured: RELION badge x=678 w=162 vs
        // this chip x=783 — 57px interpenetration, "not found" over
        // "note"). The lens is the row's least-essential control (the
        // dashboard Noted chip is its second entry) — it yields first.
        "hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 card-lift transition-colors 2xl:flex",
        on
          ? "border-warning-500/60 bg-warning/10"
          : "border-border bg-card hover:bg-secondary/60",
        noted === 0 && "opacity-50"
      )}
    >
      <StickyNote
        className={cn(
          "size-3.5",
          on ? "text-warning" : "text-muted-foreground"
        )}
      />
      <span className="text-xs font-medium tabular-nums">{noted}</span>
      <span className="hidden text-xs text-muted-foreground xl:inline">noted</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                               */
/* ------------------------------------------------------------------ */

export function Header() {
  const jobs = useWorkflowStore((s) => s.jobs);
  // t197 — the session QC report's door lives beside "Print this view":
  // both are document-level actions on the session, so both live in the
  // document-level corner of the chrome.
  const [reportOpen, setReportOpen] = React.useState(false);
  // t436 — the storage overview rides the same document-level corner: a
  // per-project fact ("how much disk am I using") that belongs next to
  // the session report, not inside any one job's inspector.
  const [storageOpen, setStorageOpen] = React.useState(false);
  // t530 — the system diagnostics door: the box-level facts (memory
  // lanes, disk, provenance, census) sit one level above the storage
  // map, so the button sits one slot beside it.
  const [diagOpen, setDiagOpen] = React.useState(false);
  // t221: the palette's report door — the palette dispatches, the owner
  // listens (the OPEN_EVENT handshake, the reverse hop). The header owns
  // the dialog; the palette only names the door, it never mounts a
  // second report.
  React.useEffect(() => {
    const open = () => setReportOpen(true);
    window.addEventListener(SESSION_REPORT_EVENT, open);
    return () => window.removeEventListener(SESSION_REPORT_EVENT, open);
  }, []);
  // t483: the storage door's ear — same handshake, same owner-listens law.
  React.useEffect(() => {
    const open = () => setStorageOpen(true);
    window.addEventListener(STORAGE_OPEN_EVENT, open);
    return () => window.removeEventListener(STORAGE_OPEN_EVENT, open);
  }, []);
  // t530: the diagnostics door's ear — the palette names the door, the
  // header owns the panel (same reverse-hop handshake).
  React.useEffect(() => {
    const open = () => setDiagOpen(true);
    window.addEventListener(SYSTEM_DIAGNOSTICS_EVENT, open);
    return () => window.removeEventListener(SYSTEM_DIAGNOSTICS_EVENT, open);
  }, []);

  const total = jobs.length;
  const running = jobs.filter((j) => j.status === "running").length;
  const completed = jobs.filter((j) => j.status === "completed").length;

  return (
    // .no-print (Task 79): the app header is interactive chrome — on paper
    // its controls (project picker, search, menus) are dead weight, and a
    // sticky header would repeat on every printed page of a multi-page
    // dashboard roster. PrintDocHeader is the official paper masthead.
    <header
      className="no-print pointer-events-auto sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4"
    >
      {/* Brand */}
      {/* t828 — the narrow-band tier law, measured like t301/t510 before it:
          the RIGHT cluster is ~404px of icon seats that flex cannot shrink
          (min-width:auto floors), so at 375/640 justify-between crushed the
          brand row to ZERO (the wordmark vanished silently) and the tail
          seats painted 53px/16px past the viewport — the theme toggle and
          help were unreachable and the shell scrollWidth lied (428 > 375).
          Tiers, measured: max-sm the brand is the ViewSwitcher alone (the
          tabs are the identity that navigates), and the four ops seats
          (storage map / diagnostics / print / knock settings) fall away;
          sm..md the wordmark and Relion chip / diagnostics / print / GitHub
          wait — and the re-measure caught the t510 interpenetration alive
          at md..xl (the labeled tabs painted 148px INTO the seat row at
          768), so the Relion chip and the tab labels wait for xl, and the
          wordmark lives again from md up. Every band re-measured after
          the cut — see the t828 probe. */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary max-sm:hidden">
          <Snowflake className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 leading-tight max-md:hidden">
          <p className="truncate text-sm font-semibold tracking-tight">CryoFlow</p>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
            Cryo-EM Workflow Builder
          </p>
        </div>

        {/* Canvas ⇄ Dashboard view switcher */}
        <ViewSwitcher />

        {/* Workspace + project switcher, stats chips */}
        {/* Progressive disclosure — the header only truly fits when each
            tier has room (measured at 1280/1366/1440/1536: the middle zone
            used to overflow INTO the actions cluster below ~1470px, the
            last stat chip silently hidden under it). xl = workspace +
            project + lens chip; the three counters join from 1700px up
            (t301 re-measure — see below). */}
        {/* t301 — re-measured, the tiers had drifted: the right cluster
            grew (remote-clusters door, session report) and a remote
            project adds a violet binding badge to the project switcher,
            so at 1600px the 2xl counters made the LEFT cluster overflow
            INTO the right one (measured: "noted" chip ended at x=1215
            while the RELION chip already started at x=1169 — 46px of
            interpenetration). The counters need ~270px of row that only
            exists from ~1700px up; 2xl (1536) was a lie since t300. */}
        {/* t510 — re-measured, the RIGHT cluster grew again (t419 AI door,
            t436 storage, t438 knock bell, the remote-clusters door): at
            1280 the middle tier overflowed INTO it a second time (RELION
            badge x=678 vs spotlight chip x=783 — 57px of interpenetration;
            the row's children painted 207px past their 650px container).
            The tier re-cut, same law: xl = workspace + project only (the
            project trigger gives 50px back: 170 in the tight band), the
            lens chip — the row's least-essential control — rises to 2xl
            beside the roomy 220px trigger. Measured at 1280/1366/1440:
            626 ≤ 650, 626 ≤ 736, 626 ≤ 810 — slack in every band. */}
        {/* t510 — min-w-0 rides the row: when a future tier miscalculates,
            the row itself compresses (triggers truncate) instead of the
            whole row painting over the actions cluster unclipped. */}
        <div className="hidden min-w-0 items-center gap-2 xl:flex">
          <WorkspaceSelect />
          <ProjectSwitcher />
          {/* t510 — the counters' tier re-measured (t301 said 1700; that
              measurement predates the right cluster's t419/t436/t438
              growth): the row's natural width with all four controls is
              ~1311px, which exists from ~2000 up (at 1700 the project
              trigger crushed to 54px — an ellipsis with no name). Below
              2000 the footer census speaks the same three numbers — the
              counters are the most redundant chrome, they wait longest. */}
          <div className="hidden items-center gap-2 min-[2000px]:flex" aria-label="Workflow statistics">
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
              tone="text-running"
            />
            <StatChip
              icon={<CheckCircle2 className="size-3.5" />}
              label="completed"
              value={completed}
              tone="text-success"
            />
          </div>
          {/* lens control, not a stat — sits beside the counters but outside
              the "Workflow statistics" group so assistive tech sees the
              difference between "how many" and "do something" */}
          <NoteSpotlightChip />
        </div>
      </div>

      {/* Actions — interactive chrome has no paper meaning; .no-print hides
          the whole cluster when printing, the paper masthead takes over */}
      <div className="no-print flex shrink-0 items-center gap-1.5">
        {/* t828 — the cluster's seats never shrink: the t510 contract makes
            the LEFT row the shock absorber (min-w-0, triggers truncate),
            and a min-w-0 here let the greedy left row steal space back at
            1280 (left 671 vs right 565 — the seats overflowed INSIDE the
            cluster and the theme toggle painted past the viewport again).
            The narrow bands are yielded by the TIER LAW above — seats fall
            away measured — not by squeezing the seats that remain. */}
        <div className="hidden xl:block">
          <RelionStatusChip />
        </div>
        {/* Task 179: the palette (and with it the whole export family —
            PNG, JSON, the pipeline replay script) was unreachable on
            touch: Ctrl+K needs a keyboard and this chip used to hide
            below md — the export family had NO mobile entry at all.
            Always visible now; below sm it renders icon-only (the K span
            is already sm:inline) with tightened padding. The width came
            out of the lowest-value chrome on the strip: the GitHub link
            button, which is decoration next to a command surface. The
            280 fold still fits — measured, not guessed. */}
        {/* t419 — the AI assistant door: always visible (icon-only under sm,
          * the same mobile law the palette trigger follows — a headline
          * feature hides from nobody). t427 — teal: the assistant's brand
          * follows the app's cryo-teal identity (the panel was reworked
          * to match in the same round).
          * t501 — data-dialog-live + the mask's z-[39] (below this z-40
          * strip): the door KEEPS WORKING while a modal dialog is open.
          * That was the user's bug — clicking this button with the job
          * params page open dismissed the page (the click landed on the
          * mask); now the click opens the assistant, the companion
          * registration strips the dialog's modality, and both live. */}
        <Button
          variant="ghost"
          size="icon"
          data-dialog-live=""
          className="max-sm:px-2 text-primary hover:text-primary/80"
          onClick={() => useWorkflowStore.getState().openAiAssistant()}
          aria-label="AI assistant"
          title="AI 助手 — 自然语言建流程 / 判 class"
        >
          <Sparkles className="size-4.5" aria-hidden="true" />
        </Button>
        <CommandPaletteTrigger />
        <Button
          variant="ghost"
          size="icon"
          className="max-sm:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setStorageOpen(true)}
          aria-label="Project storage overview"
          title="Project storage — what this project keeps on disk, the heaviest runs first"
        >
          <HardDrive className="size-4" aria-hidden="true" />
        </Button>
        {/* t530 — the box's vitals: one slot beside the storage map, one
            level up in scope (project bytes → host health). */}
        <Button
          variant="ghost"
          size="icon"
          className="max-md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setDiagOpen(true)}
          aria-label="System diagnostics"
          title="System diagnostics — memory lanes against the build guard's lines, disk, engine build progress and the running build's provenance"
        >
          <Activity className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setReportOpen(true)}
          aria-label="Session QC report"
          title="Session QC report — pipeline glance, map QC and the sweep verdict bound into one printable document"
        >
          <FileText className="size-4" aria-hidden="true" />
        </Button>
        {/* t438 — the finish knock: the out-of-page channels (chime +
            OS notification) ride an explicit opt-in behind this bell;
            the title flicker needs no door, it is chrome. */}
        <span className="max-sm:hidden">
          <KnockSettingsButton />
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="max-md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => window.print()}
          aria-label="Print this view"
          title="Print / save as PDF — the paper stylesheet forces a light palette and hides interactive chrome"
        >
          <Printer className="size-4" aria-hidden="true" />
        </Button>
        {/* Remote clusters (SSH) — the emerald dot is the active
            connection's probe heartbeat */}
        <RemoteClusterButton />
        <HelpPopover />
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="max-md:hidden text-muted-foreground hover:text-foreground"
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
      <SessionReportDialog open={reportOpen} onOpenChange={setReportOpen} />
      <SystemDiagnosticsDialog open={diagOpen} onOpenChange={setDiagOpen} />
      <StorageDialog open={storageOpen} onOpenChange={setStorageOpen} />
    </header>
  );
}
