"use client";

/**
 * CryoFlow — remote SSH cluster connection manager + header button.
 *
 * The registry face of the remote layer (/api/remote/*). The browser never
 * sees a secret — the DTO only carries hasPassword / hasPassphrase flags —
 * so the form speaks the POST route's three-state secret contract:
 *   · typed    → store the new secret
 *   · "Clear"  → send "" (remove the stored secret)
 *   · untouched → omit the field entirely (keep the stored secret)
 * "Empty submit clears" would make every innocent edit (rename, new env
 * line) silently destroy the login, so clearing is an explicit toggle.
 *
 * Interaction model (one selection, two jobs): the highlighted row is both
 * the connection the form edits AND the ACTIVE connection every
 * "Run on cluster" dialog defaults to. The id persists in localStorage
 * under "cryoflow.remote.active" — activation survives reloads the same
 * way the panel tab does, and clicking a row IS the activation gesture.
 *
 * The probe card is the payoff of POST …/test: uname, module system,
 * relion module chips (click = PATCH defaultModule), per-module home /
 * mpirun / ctffind hints, Slurm + GPU facts — everything the dispatch
 * decision needs, one login round-trip away.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  onEscapeClose,
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ArrowUpRight, BadgeCheck, Check, Loader2, Network, Plus, Server, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store";
import type {
  ConnectionRunResume,
  ConnectionRunResumeEntry,
  RemoteAuthMethod,
  RemoteConnectionDTO,
  RemoteProbe,
} from "@/lib/remote/types";
import { formatLedgerMs } from "./job-inspector";

/* ------------------------------------------------------------------ */
/* Active connection (localStorage)                                    */
/* ------------------------------------------------------------------ */

export const REMOTE_ACTIVE_KEY = "cryoflow.remote.active";

/** t261 — the command palette opens this dialog through a custom event:
 *  the palette can't reach the header button's state (it lives way down
 *  the tree), and the t245 inventory law requires the door's VERB in ⌘K —
 *  so the row dispatches and this component answers. */
export const REMOTE_CLUSTERS_OPEN_EVENT = "cryoflow:open-remote-clusters";

export function readActiveRemoteConnectionId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(REMOTE_ACTIVE_KEY) ?? "";
  } catch {
    return ""; // private mode / quota — activation lives in-RAM for this session
  }
}

function writeActiveRemoteConnectionId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMOTE_ACTIVE_KEY, id);
  } catch {
    /* private mode / quota — non-fatal, the click still selected it */
  }
}

/* ------------------------------------------------------------------ */
/* Connections hook (fetch-on-mount + refresh on open flips)           */
/* ------------------------------------------------------------------ */

/**
 * Loads the secret-free connection list. When `watch` is provided (an
 * open/closed flag) the list refreshes on EVERY flip: opening wants fresh
 * data, closing picks up probe results / new connections the session just
 * wrote behind the dialog.
 */
export function useRemoteConnections(watch?: boolean): {
  connections: RemoteConnectionDTO[];
  setConnections: React.Dispatch<React.SetStateAction<RemoteConnectionDTO[]>>;
  reload: () => void;
} {
  const [connections, setConnections] = React.useState<RemoteConnectionDTO[]>([]);

  const reload = React.useCallback(() => {
    fetch("/api/remote/connections")
      .then((r) => r.json())
      .then((d: { connections?: RemoteConnectionDTO[] } | null) => {
        if (d && Array.isArray(d.connections)) setConnections(d.connections);
      })
      .catch(() => {
        /* server hiccup — the list (and its empty states) stand */
      });
  }, []);

  React.useEffect(() => {
    // runs on mount + on every `watch` transition (see hook doc)
    reload();
  }, [reload, watch]);

  return { connections, setConnections, reload };
}

/* ------------------------------------------------------------------ */
/* Small shared atoms (same grammar as the HPC profiles editor)        */
/* ------------------------------------------------------------------ */

const AUTH_LABEL: Record<RemoteAuthMethod, string> = {
  agent: "SSH agent",
  key: "Private key",
  password: "Password",
};

function Field({
  label, hint, children, className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h4>
      <Separator className="flex-1" />
    </div>
  );
}

/** Rail status dot: green = last probe ok, red = probed and failed, gray = never tested.
 *  t268 — the probe's wall-clock cost rides the label: a slow cluster's
 *  reachability is a quality of the connection worth seeing at a glance. */
function probeDot(c: RemoteConnectionDTO): { className: string; label: string } {
  const secs = c.lastProbe?.durationMs != null ? ` in ${(c.lastProbe.durationMs / 1000).toFixed(1)}s` : "";
  if (c.lastProbe?.ok) return { className: "bg-emerald-500", label: `reachable — last probe ok${secs}` };
  if (c.lastProbe) return { className: "bg-rose-500", label: `last probe failed${secs}${c.lastProbe.error ? `: ${c.lastProbe.error}` : ""}` };
  return { className: "bg-slate-400 dark:bg-slate-500", label: "never tested" };
}

/* ------------------------------------------------------------------ */
/* Probe result card                                                   */
/* ------------------------------------------------------------------ */

function ProbeCard({
  probe,
  defaultModule,
  onPickModule,
  picking,
}: {
  probe: RemoteProbe;
  defaultModule: string | null;
  onPickModule: (m: string) => void;
  picking: string | null;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3" data-probe-card="">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            probe.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          )}
        >
          {probe.ok ? "reachable" : "unreachable"}
        </Badge>
        <Badge variant="outline" className="text-[10px] font-normal">
          {probe.moduleSystem === "none" ? "no module system" : probe.moduleSystem}
        </Badge>
        {probe.slurm ? (
          <Badge
            variant="outline"
            className="border-cyan-500/30 bg-cyan-500/10 text-[10px] font-normal text-cyan-700 dark:text-cyan-300"
          >
            Slurm
          </Badge>
        ) : null}
        {probe.gpus.length > 0 ? (
          <Badge
            variant="outline"
            className="border-teal-500/30 bg-teal-500/10 text-[10px] font-normal text-teal-700 dark:text-teal-300"
          >
            {probe.gpus.length} GPU{probe.gpus.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/80">
          {probe.durationMs != null ? (
            <span
              className="mr-1.5 tabular-nums"
              title="wall-clock cost of the probe round-trip — the dispatch itself probes an unprobed connection (t267), so this is part of its latency"
              data-probe-duration=""
            >
              {probe.durationMs >= 1000 ? `${(probe.durationMs / 1000).toFixed(1)}s` : `${probe.durationMs}ms`}
              {" · "}
            </span>
          ) : null}
          {new Date(probe.checkedAt).toLocaleString()}
        </span>
      </div>

      {probe.uname ? (
        <p className="truncate font-mono text-[10px] leading-relaxed text-muted-foreground" title={probe.uname}>
          {probe.uname}
        </p>
      ) : null}

      {probe.error ? (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-2 py-1.5 text-[11px] leading-relaxed text-rose-700 dark:text-rose-300" role="alert">
          {probe.error}
        </p>
      ) : null}

      {probe.relionModules.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            relion modules — click one to pin the default
          </p>
          <div className="flex flex-wrap gap-1.5">
            {probe.relionModules.map((m) => {
              const isDefault = m === defaultModule;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onPickModule(m)}
                  disabled={picking !== null}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10.5px] transition-colors disabled:opacity-60",
                    isDefault
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground/80 hover:border-primary/40 hover:text-primary"
                  )}
                  aria-pressed={isDefault}
                  aria-label={`Use ${m} as this connection's default module`}
                  title={isDefault ? `${m} — current default` : `Set ${m} as the default module`}
                >
                  {picking === m ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  ) : isDefault ? (
                    <Check className="size-3" aria-hidden="true" />
                  ) : null}
                  {m}
                </button>
              );
            })}
          </div>
          <div className="space-y-0.5">
            {probe.relionModules.map((m) => (
              <p
                key={m}
                className="truncate font-mono text-[10px] leading-relaxed text-muted-foreground/80"
                title={`${m}${probe.relionHomes[m] ? ` · home ${probe.relionHomes[m]}` : ""}${probe.relionMpi[m] ? " · mpirun available" : ""}${probe.relionCtffind[m] ? ` · ctffind ${probe.relionCtffind[m]}` : ""}`}
              >
                {m} · home {probe.relionHomes[m] ?? "—"}
                {probe.relionMpi[m] ? " · mpirun ✓" : ""}
                {probe.relionCtffind[m] ? ` · ctffind ${probe.relionCtffind[m]}` : ""}
              </p>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No relion modules found — <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">module avail</code>{" "}
          came back empty on this node.
        </p>
      )}

      {probe.gpus.length > 0 ? (
        <p className="truncate text-[10px] text-muted-foreground" title={probe.gpus.join(", ")}>
          GPUs: {probe.gpus.join(", ")}
        </p>
      ) : probe.slurmGpus && probe.slurmGpus.length > 0 ? (
        <div className="space-y-0.5">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/80">Compute-node GPUs (via Slurm sinfo):</span>{" "}
            {probe.slurmGpus
              .map(
                (g) =>
                  `${g.partition}: ${g.gpusPerNode} GPU/node × ${g.nodes} node${g.nodes === 1 ? "" : "s"}${
                    g.hosts && g.hosts.length > 0 ? ` (${g.hosts.slice(0, 4).join(", ")}${g.hosts.length > 4 ? ` +${g.hosts.length - 4}` : ""})` : ""
                  }${g.model ? ` · ${g.model}` : ""}`
              )
              .join(" · ")}
          </p>
          <p className="text-[10px] leading-relaxed text-muted-foreground/70">
            The login node has no GPUs (normal — nvidia-smi is quiet here); sbatch runs land on the compute nodes above
            — the run dialog offers each detected group (and its node) as the submit target.
          </p>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/70">
          No GPUs visible on the login node (compute nodes may still have them).
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Run résumé card (t270 — what this cluster has done for the user)    */
/* ------------------------------------------------------------------ */

/** Status dot for one résumé entry: the exit code IS the color (the stop
 *  route writes 137 for user-stopped runs, so rose covers both flavors). */
function resumeDot(e: ConnectionRunResumeEntry): { className: string; label: string } {
  if (!e.done) return { className: "bg-amber-500", label: "still running" };
  if (e.exitCode === 0) return { className: "bg-emerald-500", label: "completed" };
  return { className: "bg-rose-500", label: `failed (exit ${e.exitCode})` };
}

/** The cluster's résumé: an aggregate line + the ≤3 newest runs, each
 *  speaking the time ledger's dialect (formatLedgerMs — the same language
 *  the inspector's remote strip speaks). The tooltip carries the EXACT
 *  milliseconds (t269's leftover: compact display, precise hover).
 *
 *  t271 — the résumé becomes an INDEX: a run whose job still exists on
 *  this canvas is a <button> (click = close this dialog and open that
 *  job's inspector — the résumé entry is the doorway, not a dead end);
 *  a run whose job is not on this canvas stays a plain history row.
 *  t272 — the history row speaks THREE honest states, because the server
 *  now reports per-entry existence (the résumé is global, the canvas is
 *  per-project): "lives on the “X” project's canvas" / "gone (deleted)" /
 *  the pre-t272 merged guess when the server did not say. The résumé
 *  remembers what the canvas forgot, and says WHERE it lives instead of
 *  pretending the jump works.
 *  t294 — the gone rows grow a forget door: history the user cannot act
 *  on is a ledger that only grows. A row whose job is gone EVERYWHERE gets
 *  a quiet X (hover-revealed, like the live row's arrow) that deletes the
 *  dead record; a row whose job lives on ANOTHER canvas keeps no such
 *  door — that record is live history for the canvas that can open it.
 *  t295 — the card grows TWO doors for its own depth: the expand toggle
 *  (the list route shows ≤3 rows; the panorama route returns EVERY entry
 *  under the same shape — the card swaps it in wholesale, and any reload
 *  re-fetches, so the panorama tracks the ledger rather than a snapshot)
 *  and the bulk forget (one click retires every DEAD entry — the server
 *  keeps live records and counts both). The bulk door renders only over
 *  the FULL picture (every row on screen): a count computed from a
 *  three-row fold would understate what the click destroys — a door that
 *  cannot state its blast radius is never drawn. */
function RunResumeCard({
  resume,
  connectionId,
  onOpenJob,
  onForgetRun,
  onForgetAllDead,
}: {
  resume: ConnectionRunResume;
  connectionId: string;
  onOpenJob?: (jobId: string) => void;
  onForgetRun?: (jobId: string) => Promise<void>;
  onForgetAllDead?: () => Promise<{ forgotten: number; kept: number }>;
}) {
  // the store is the truth the inspector can actually open — an entry
  // whose job is not in it renders as history, not as a doorway
  const jobs = useWorkflowStore((s) => s.jobs);
  // t278 — the card-level helper adapts to the record shape the rows
  // actually show: "click one to open" is a lie over a wall of gone rows.
  // Pre-t272 DTO rows (exists undefined) are still openable doors on the
  // canvas that owns them, so they count as live here.
  // t294 — forget-door state: which row is mid-forget (spinner), and the
  // last refusal's honest wording (role=alert, under the rows).
  const [forgetting, setForgetting] = React.useState<string | null>(null);
  const [forgetError, setForgetError] = React.useState<string | null>(null);
  // t295 — the panorama: expanded swaps in the server's full aggregate;
  // bulk = the armed two-step ("Forget n gone" → "Sure?"), its result and
  // refusal lines land under the rows like the single door's do.
  const [expanded, setExpanded] = React.useState(false);
  const [full, setFull] = React.useState<ConnectionRunResume | null>(null);
  const [bulkArmed, setBulkArmed] = React.useState(false);
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkError, setBulkError] = React.useState<string | null>(null);
  const [bulkOk, setBulkOk] = React.useState<{ forgotten: number; kept: number } | null>(null);
  // t295 — the panorama's data path: expanding fetches the full aggregate
  // from the server (one truth — the card never assembles history
  // locally), and any change to the underlying connection (a reload
  // swapped the object) re-fetches. The card is the same renderer at both
  // apertures; only the rows it is handed differ.
  React.useEffect(() => {
    if (!expanded) {
      setFull(null);
      setBulkArmed(false);
      return;
    }
    let alive = true;
    fetch(`/api/remote/records?connectionId=${encodeURIComponent(connectionId)}`)
      .then((r) => r.json())
      .then((d: { ok?: boolean; resume?: ConnectionRunResume } | null) => {
        if (alive && d?.ok && d.resume) setFull(d.resume);
      })
      .catch(() => {
        /* honest absence: the collapsed rows remain on show */
      });
    return () => {
      alive = false;
    };
  }, [expanded, connectionId, resume]);
  const shown = full ?? resume;
  const toggleExpand = () => {
    setBulkArmed(false);
    setExpanded((v) => !v);
  };
  const bulkForget = async () => {
    if (!bulkArmed) {
      setBulkArmed(true);
      return;
    }
    setBulkError(null);
    setBulkOk(null);
    setBulkBusy(true);
    try {
      setBulkOk((await onForgetAllDead?.()) ?? null);
      setBulkArmed(false);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "bulk forget failed");
      setBulkArmed(false);
    } finally {
      setBulkBusy(false);
    }
  };
  const goneCount = shown.recent.filter((e) => e.exists === false).length;
  const openCount = shown.recent.length - goneCount;
  const helperVariant = goneCount === 0 ? "live" : openCount > 0 ? "mixed" : "history";
  const helperText =
    helperVariant === "live"
      ? "Runs dispatched through this connection — click one to open its job's inspector; staging and sync-back times come from each run's time ledger."
      : helperVariant === "mixed"
        ? "Runs dispatched through this connection — click a live one to open its job's inspector; entries marked gone are deleted jobs the résumé keeps as history. Staging and sync-back times come from each run's time ledger."
        : "Runs this connection once dispatched, kept as history — the jobs behind these entries are gone (deleted), so there is nothing left to open.";
  // t295 — the two apertures: overflow decides whether the expand door
  // exists at all; fullPicture decides whether the bulk door may state a
  // count (only when every row is on screen); deadShown is the count that
  // count would state.
  const overflow = shown.total > resume.recent.length;
  const fullPicture = shown.recent.length >= shown.total;
  const deadShown = goneCount;
  const showBulk = deadShown > 0 && fullPicture && onForgetAllDead != null;
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3" data-run-resume="">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]" data-resume-total="">
          {shown.total} run{shown.total === 1 ? "" : "s"}
        </Badge>
        {resume.completed > 0 ? (
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300"
            data-resume-completed=""
          >
            {resume.completed} completed
          </Badge>
        ) : null}
        {resume.failed > 0 ? (
          <Badge
            variant="outline"
            className="border-rose-500/40 bg-rose-500/10 text-[10px] text-rose-700 dark:text-rose-300"
            data-resume-failed=""
          >
            {resume.failed} stopped/failed
          </Badge>
        ) : null}
        {resume.lastRunAt ? (
          <span className="ml-auto text-[10px] text-muted-foreground" data-resume-last="">
            last {new Date(resume.lastRunAt).toLocaleString()}
          </span>
        ) : null}
      </div>
      {shown.recent.map((e) => {
        const dot = resumeDot(e);
        const ledger = [
          e.stagedMs != null ? `staged ${formatLedgerMs(e.stagedMs)}` : "",
          e.syncMs != null ? `synced ${formatLedgerMs(e.syncMs)}` : "",
          e.syncedFiles != null
            ? `${e.syncedFiles} file${e.syncedFiles === 1 ? "" : "s"} back`
            : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const exact = [
          e.stagedMs != null ? `staged ${e.stagedMs}ms` : "",
          e.syncMs != null ? `synced ${e.syncMs}ms` : "",
          e.syncedFiles != null ? `${e.syncedFiles} file(s) pulled back` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        const job = jobs.find((j) => j.id === e.jobId) ?? null;
        const jumpable = job != null && onOpenJob != null;
        // t294 — the forget door lives ONLY on exists===false rows: the
        // server route refuses a live job anyway, but the UI already knows
        // which rows are dead — showing a door only where it can open is
        // the same honesty the row's tooltip speaks.
        const forgettable = e.exists === false && onForgetRun != null;
        const startedShort = new Date(e.startedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const row = (
          <>
            <span
              className={cn("size-1.5 shrink-0 rounded-full", dot.className)}
              aria-hidden="true"
              title={dot.label}
            />
            {job?.name ? (
              <span className="min-w-0 truncate font-medium text-foreground">{job.name}</span>
            ) : null}
            <span className="font-mono text-muted-foreground">{e.jobType}</span>
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground/70" aria-hidden="true">
              {startedShort}
            </span>
            {ledger ? (
              <span
                className="max-w-[45%] truncate font-mono tabular-nums text-muted-foreground"
                title={`${exact} — from the run's time ledger`}
              >
                {ledger}
              </span>
            ) : null}
          </>
        );
        const forget = async (jobId: string) => {
          setForgetError(null);
          setForgetting(jobId);
          try {
            await onForgetRun?.(jobId);
          } catch (err) {
            setForgetError(err instanceof Error ? err.message : "forget failed");
          } finally {
            setForgetting(null);
          }
        };
        return jumpable ? (
          <button
            key={e.jobId}
            type="button"
            data-resume-entry={e.jobId}
            data-resume-jump=""
            onClick={() => onOpenJob?.(e.jobId)}
            className="group -mx-1 flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-[10px] transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title={`Open the inspector for “${job?.name}” — ${e.jobType} started ${new Date(e.startedAt).toLocaleString()}`}
            aria-label={`Open the inspector for ${job?.name ?? e.jobType}`}
          >
            {row}
            <ArrowUpRight
              className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
              aria-hidden="true"
            />
          </button>
        ) : (
          <div
            key={e.jobId}
            data-resume-entry={e.jobId}
            data-resume-gone={e.exists === false ? "gone" : undefined}
            className="group flex items-center gap-1.5 text-[10px] text-muted-foreground/80"
            title={
              // t272 — the server knows whether the job still exists ANYWHERE
              // (the résumé is global, the canvas is per-project), so the
              // history row can speak three honest states instead of one
              // merged guess: another (named!) canvas / gone everywhere /
              // the server did not say (pre-t272 DTO).
              e.exists === true
                ? `the job lives on the “${e.projectName ?? "another"}” project's canvas — switch to that project to inspect it`
                : e.exists === false
                  ? "the job is gone (deleted) — the résumé keeps it as history"
                  : "the job is gone (deleted, or another project's canvas) — the résumé keeps it as history"
            }
          >
            {row}
            {forgettable ? (
              <button
                type="button"
                data-resume-forget={e.jobId}
                disabled={forgetting != null}
                onClick={() => void forget(e.jobId)}
                className="ml-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Forget the history entry for the ${e.jobType} run started ${new Date(e.startedAt).toLocaleString()}`}
                title="Forget this history entry — the job is gone everywhere; the résumé keeps it only until you let it go"
              >
                {forgetting === e.jobId ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <X className="size-3" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
        );
      })}
      {/* t295 — the card's own depth doors. Expand: the panorama toggle
          (exists on overflow, or while expanded to come back down). Bulk:
          the armed two-step, ONLY over the full picture — the label always
          states the exact blast radius (deadShown). */}
      {(overflow || expanded) ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-resume-expand=""
            aria-expanded={expanded}
            onClick={toggleExpand}
            className="rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title={
              expanded
                ? "Back to the three newest runs"
                : `The list view keeps the three newest rows — this card remembers ${shown.total} runs; open the whole ledger`
            }
          >
            {expanded ? "Show recent only" : `Show all ${shown.total} runs`}
          </button>
          {showBulk ? (
            <button
              type="button"
              data-resume-forget-dead=""
              disabled={bulkBusy || forgetting != null}
              onClick={() => void bulkForget()}
              aria-label={
                bulkArmed
                  ? `Confirm forgetting the ${deadShown} dead history entries`
                  : `Forget the ${deadShown} dead history entries`
              }
              className={cn(
                "ml-auto flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
                bulkArmed
                  ? "bg-rose-500/10 text-rose-700 hover:text-rose-800 dark:text-rose-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={
                bulkArmed
                  ? `Click again — ${deadShown} dead records leave the résumé; live ones stay`
                  : "Every entry whose job is gone everywhere, retired in one click — live history stays (its canvas can still open it)"
              }
            >
              {bulkBusy ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <X className="size-3" aria-hidden="true" />
              )}
              {bulkArmed ? `Sure? Forget ${deadShown}` : `Forget ${deadShown} gone`}
            </button>
          ) : null}
        </div>
      ) : null}
      {bulkOk ? (
        <p role="status" data-resume-forget-dead-ok="" className="text-[10px] text-emerald-700 dark:text-emerald-300">
          Forgot {bulkOk.forgotten} dead entr{bulkOk.forgotten === 1 ? "y" : "ies"} · kept {bulkOk.kept} live
        </p>
      ) : null}
      {bulkError ? (
        <p role="alert" data-resume-forget-dead-error="" className="text-[10px] leading-relaxed text-rose-700 dark:text-rose-300">
          {bulkError}
        </p>
      ) : null}
      {forgetError ? (
        <p
          role="alert"
          data-resume-forget-error=""
          className="text-[10px] leading-relaxed text-rose-700 dark:text-rose-300"
        >
          {forgetError}
        </p>
      ) : null}
      <p
        className="text-[10px] leading-relaxed text-muted-foreground/80"
        data-resume-helper={helperVariant}
      >
        {helperText}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connection editor (right pane — remounted per connection)           */
/* ------------------------------------------------------------------ */

/** Editable form state. Secrets are three-state (see file doc). */
interface Draft {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: RemoteAuthMethod;
  privateKeyPath: string;
  password: string;
  clearPassword: boolean;
  passphrase: string;
  clearPassphrase: boolean;
  remoteRoot: string;
  envLines: string;
  useSlurm: boolean;
  /** t297 — Slurm partition for sbatch submissions (empty = cluster default). */
  slurmPartition: string;
  /** t289 — what finalize syncs back: key files only (default) or everything. */
  syncPolicy: "key-files" | "everything";
  /** t289 — binary cap (MB) for the key-files policy. */
  keyFileMb: number;
  maxFileMb: number;
  maxTotalMb: number;
}

function toDraft(c: RemoteConnectionDTO | null): Draft {
  return {
    name: c?.name ?? "",
    host: c?.host ?? "",
    port: c?.port ?? 22,
    username: c?.username ?? "",
    authMethod: c?.authMethod ?? "password",
    privateKeyPath: c?.privateKeyPath ?? "",
    password: "",
    clearPassword: false,
    passphrase: "",
    clearPassphrase: false,
    remoteRoot: c?.remoteRoot ?? "~/cryoflow",
    envLines: (c?.envLines ?? []).join("\n"),
    useSlurm: c?.useSlurm ?? false,
    slurmPartition: c?.slurmPartition ?? "",
    syncPolicy: c?.syncPolicy ?? "key-files",
    keyFileMb: c?.keyFileMb ?? 16,
    maxFileMb: c?.maxFileMb ?? 512,
    maxTotalMb: c?.maxTotalMb ?? 2048,
  };
}

function ConnectionEditor({
  connection,
  onSaved,
  onDeleted,
  onProbed,
  onPatched,
  onCancelCreate,
  onOpenJob,
  onForgetRun,
  onForgetAllDead,
}: {
  /** null = creating a new connection. */
  connection: RemoteConnectionDTO | null;
  onSaved: (c: RemoteConnectionDTO, created: boolean) => void;
  onDeleted: (id: string) => void;
  onProbed: (c: RemoteConnectionDTO | null, probe: RemoteProbe | null) => void;
  onPatched: (c: RemoteConnectionDTO) => void;
  onCancelCreate?: () => void;
  /** t271 — the résumé as an index: called when a résumé entry whose job
   *  still exists is clicked (the dialog closes itself, the inspector opens). */
  onOpenJob?: (jobId: string) => void;
  /** t294 — the résumé's forget door: deletes ONE dead record (the server
   *  refuses live jobs); the caller refreshes the list on success and the
   *  refusal's error propagates back to the row. */
  onForgetRun?: (jobId: string) => Promise<void>;
  /** t295 — the bulk door: retires every DEAD record of the editor's
   *  connection (live ones are kept and counted); the dialog owns the
   *  fetch + reload, the card owns the arm/confirm two-step. */
  onForgetAllDead?: () => Promise<{ forgotten: number; kept: number }>;
}) {
  const creating = connection === null;
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(connection));
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  /** Fresh probe from the last Test round-trip (wins over connection.lastProbe). */
  const [probeOverride, setProbeOverride] = React.useState<RemoteProbe | null>(null);
  const [testError, setTestError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [pickingModule, setPickingModule] = React.useState<string | null>(null);
  /**
   * t297 — the beta/hidden module door: `module avail` never lists hidden
   * modules (Lmod hides beta installs), so a name the user KNOWS loads
   * (`module load relion/beta_5.0_gpu_ompi5_cuda118` in their env lines)
   * needs its own proof. The verify door loads it over SSH, requires
   * relion_refine on PATH, and merges the module into the probe's list —
   * the chips above then offer it like any probed module.
   */
  const [verifyInput, setVerifyInput] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [verifyResult, setVerifyResult] = React.useState<
    | { ok: true; module: string; relionHome: string; mpi: boolean }
    | { ok: false; error: string }
    | null
  >(null);
  /** t289 — the create flow's pre-pinned default module: the by-value probe
   *  shows module chips BEFORE anything is saved; a click stores the pick
   *  here and Create sends it with the connection (saved connections keep
   *  using the PATCH route via pickModule). */
  const [draftDefaultModule, setDraftDefaultModule] = React.useState<string | null>(null);

  const patch = (fields: Partial<Draft>) => {
    setDirty(true);
    setError(null);
    setDraft((d) => ({ ...d, ...fields }));
  };

  // two-step delete confirm auto-rearms after 3s (registry editor idiom)
  React.useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const valid = draft.host.trim().length > 0 && draft.username.trim().length > 0;

  const buildPayload = (): Record<string, unknown> => {
    const port = Number.isFinite(draft.port) && draft.port >= 1 && draft.port <= 65535 ? Math.round(draft.port) : 22;
    const cap = (v: number, dflt: number) => (Number.isFinite(v) && v > 0 ? Math.round(v) : dflt);
    const payload: Record<string, unknown> = {
      name: draft.name.trim() || `${draft.username.trim()}@${draft.host.trim()}`,
      host: draft.host.trim(),
      port,
      username: draft.username.trim(),
      authMethod: draft.authMethod,
      privateKeyPath:
        draft.authMethod === "key" && draft.privateKeyPath.trim() ? draft.privateKeyPath.trim() : null,
      remoteRoot: draft.remoteRoot.trim() || "~/cryoflow",
      envLines: draft.envLines
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
      useSlurm: draft.useSlurm,
      slurmPartition: draft.slurmPartition.trim(),
      syncPolicy: draft.syncPolicy,
      keyFileMb: cap(draft.keyFileMb, 16),
      maxFileMb: cap(draft.maxFileMb, 512),
      maxTotalMb: cap(draft.maxTotalMb, 2048),
    };
    // t289 — the create flow can pre-pin the default module: the by-value
    // probe shows the chips BEFORE anything is saved, a click stores the
    // choice here, and Create sends it along with the connection
    if (creating && draftDefaultModule) payload.defaultModule = draftDefaultModule;
    if (connection) payload.id = connection.id;
    // three-state secrets: typed = store, explicit clear = "", untouched = absent
    if (draft.authMethod === "password") {
      if (draft.clearPassword) payload.password = "";
      else if (draft.password) payload.password = draft.password;
    }
    if (draft.authMethod === "key") {
      if (draft.clearPassphrase) payload.passphrase = "";
      else if (draft.passphrase) payload.passphrase = draft.passphrase;
    }
    return payload;
  };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/remote/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const body = (await res.json().catch(() => null)) as
        | { connection?: RemoteConnectionDTO; error?: string }
        | null;
      if (!res.ok || !body?.connection) {
        setError(body?.error ?? `Save failed (HTTP ${res.status})`);
        return;
      }
      const saved = body.connection;
      // the response is the truth — re-render the form from what the server kept
      setDraft(toDraft(saved));
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2400);
      onSaved(saved, creating);
    } catch {
      setError("Save request failed — the registry is untouched.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!connection || testing) return;
    setTesting(true);
    setTestError(null);
    try {
      const res = await fetch(`/api/remote/connections/${connection.id}/test`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; probe?: RemoteProbe; connection?: RemoteConnectionDTO; error?: string }
        | null;
      if (body?.probe) setProbeOverride(body.probe);
      onProbed(body?.connection ?? null, body?.probe ?? null);
      if (!body?.ok) {
        setTestError(body?.error ?? body?.probe?.error ?? "Connection test failed.");
      }
    } catch {
      setTestError("Test request failed — is the app server reachable?");
    } finally {
      setTesting(false);
    }
  };

  // t289 — the create form's Test & probe: same probe, BY VALUE — the draft
  // above is sent as-is, nothing lands in the registry until Create. A
  // login that works is knowable BEFORE it is committed.
  const testDraft = async () => {
    if (!valid || testing) return;
    setTesting(true);
    setTestError(null);
    try {
      const res = await fetch("/api/remote/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; probe?: RemoteProbe; error?: string }
        | null;
      if (body?.probe) setProbeOverride(body.probe);
      if (!body?.ok) {
        setTestError(body?.error ?? body?.probe?.error ?? "Connection test failed.");
      }
    } catch {
      setTestError("Test request failed — is the app server reachable?");
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!connection || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/remote/connections/${connection.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted(connection.id);
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Delete failed (HTTP ${res.status})`);
      setConfirmDelete(false);
    } catch {
      setError("Delete request failed.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const pickModule = async (m: string) => {
    if (!connection || connection.defaultModule === m || pickingModule) return;
    setPickingModule(m);
    setError(null);
    try {
      const res = await fetch(`/api/remote/connections/${connection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultModule: m }),
      });
      const body = (await res.json().catch(() => null)) as
        | { connection?: RemoteConnectionDTO; error?: string }
        | null;
      if (res.ok && body?.connection) {
        onPatched(body.connection);
      } else {
        setError(body?.error ?? "Could not set the default module.");
      }
    } catch {
      setError("Request failed while setting the default module.");
    } finally {
      setPickingModule(null);
    }
  };

  /**
   * t297 — verify a module name the listing never showed (beta / hidden):
   * the server loads it in a login shell and requires relion_refine on
   * PATH. Success merges the module into the connection's probe (the chips
   * above re-render with it) AND pins it as the default — the exact
   * "confirm this command can call relion 5" the user asked for. A refusal
   * carries the module tool's own words (Lmod's "Unknown module").
   *
   * t310 — the door speaks BY VALUE on the create form too: the draft is
   * sent as-is (nothing persisted until Create), the server merges the
   * verified module into the probe the client already has, and the pin
   * lives in draftDefaultModule (t289's chip idiom — defaultModule rides
   * the Create payload). Saved connections keep the [id] route: the server
   * patches lastProbe + defaultModule and the response DTO is the truth.
   */
  const verifyModule = async () => {
    const name = verifyInput.trim();
    if (!name || verifying || (creating ? !valid : !connection)) return;
    setVerifying(true);
    setVerifyResult(null);
    setError(null);
    try {
      const res = creating
        ? await fetch("/api/remote/connections/verify-module", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...buildPayload(), module: name, probe: probeOverride }),
          })
        : await fetch(`/api/remote/connections/${connection!.id}/verify-module`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ module: name, pin: true }),
          });
      const body = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            module?: string;
            relionHome?: string;
            mpi?: boolean;
            error?: string;
            probe?: RemoteProbe;
            connection?: RemoteConnectionDTO;
          }
        | null;
      const verified = res.ok && body?.ok && (creating ? body.probe : body.connection);
      if (verified) {
        setVerifyResult({
          ok: true,
          module: body?.module ?? name,
          relionHome: body?.relionHome ?? "",
          mpi: body?.mpi === true,
        });
        // the server's truth replaces both the row and the probe card's
        // source — the verified module appears among the chips immediately
        if (creating) {
          setProbeOverride(body!.probe ?? null);
          setDraftDefaultModule(body?.module ?? name);
        } else {
          onPatched(body!.connection!);
          setProbeOverride(body!.connection!.lastProbe ?? null);
        }
        setVerifyInput("");
      } else {
        setVerifyResult({ ok: false, error: body?.error ?? `Verification failed (HTTP ${res.status}).` });
      }
    } catch {
      setVerifyResult({ ok: false, error: "Verify request failed — is the app server reachable?" });
    } finally {
      setVerifying(false);
    }
  };

  // probe card reads the freshest source: this session's test, else the registry
  const probe = probeOverride ?? connection?.lastProbe ?? null;
  // t289 — the remote root, EXPANDED: once any probe brought back the
  // cluster's $HOME, a ~-root can show its absolute form. No probe yet →
  // nothing to expand (the hint already teaches the semantics).
  const resolvedRemoteRoot =
    probe?.homeDir && draft.remoteRoot.trim().startsWith("~")
      ? probe.homeDir.replace(/\/+$/, "") + draft.remoteRoot.trim().slice(1)
      : null;
  const secretRow = (
    label: string,
    value: string,
    onValue: (v: string) => void,
    hasStored: boolean,
    clearFlag: boolean,
    onClearFlag: (v: boolean) => void,
    placeholder: string,
  ) => (
    <Field
      label={label}
      hint={
        clearFlag
          ? "⚠ stored secret will be CLEARED when you save"
          : hasStored
            ? "Leave empty to keep the stored secret"
            : undefined
      }
    >
      <div className="flex items-center gap-1.5">
        <Input
          type="password"
          value={value}
          onChange={(e) => {
            onValue(e.target.value);
            if (e.target.value) onClearFlag(false);
          }}
          placeholder={hasStored ? placeholder : undefined}
          className="h-9 text-sm"
          autoComplete="new-password"
          aria-label={label}
        />
        {hasStored ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 shrink-0 px-2.5 text-[11px] text-muted-foreground hover:text-foreground",
              clearFlag && "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            )}
            onClick={() => onClearFlag(!clearFlag)}
            aria-pressed={clearFlag}
            aria-label={clearFlag ? `Keep the stored ${label.toLowerCase()}` : `Clear the stored ${label.toLowerCase()}`}
            title={clearFlag ? "Undo — keep the stored secret" : "Clear the stored secret on save"}
          >
            {clearFlag ? "Keep stored" : "Clear stored"}
          </Button>
        ) : null}
      </div>
    </Field>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <SectionTitle>{creating ? "New connection" : "Login"}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Host" hint={valid ? undefined : "required"} className="col-span-2">
            <Input
              value={draft.host}
              onChange={(e) => patch({ host: e.target.value.trim().slice(0, 200) })}
              placeholder="login.cluster.example.org"
              className="h-9 text-sm"
              maxLength={200}
              aria-label="SSH host (required)"
            />
          </Field>
          <Field label="Username" hint={valid ? undefined : "required"}>
            <Input
              value={draft.username}
              onChange={(e) => patch({ username: e.target.value.trim().slice(0, 60) })}
              placeholder="your.cluster.user"
              className="h-9 text-sm"
              maxLength={60}
              aria-label="SSH username (required)"
            />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              min={1}
              max={65535}
              value={draft.port}
              onChange={(e) => patch({ port: Number(e.target.value) })}
              className="h-9 text-sm"
              aria-label="SSH port"
            />
          </Field>
          <Field label="Display name">
            <Input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value.slice(0, 120) })}
              placeholder={creating ? "e.g. Lab cluster" : undefined}
              className="h-9 text-sm"
              maxLength={120}
              aria-label="Connection display name"
            />
          </Field>
          <Field label="Auth method">
            <Select
              value={draft.authMethod}
              onValueChange={(v) => patch({ authMethod: v as RemoteAuthMethod })}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="Authentication method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password" className="text-sm">Password</SelectItem>
                <SelectItem value="key" className="text-sm">Private key</SelectItem>
                <SelectItem value="agent" className="text-sm">SSH agent</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="col-span-2">
            <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal text-muted-foreground">
              {AUTH_LABEL[draft.authMethod]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Secret</SectionTitle>
        {draft.authMethod === "agent" ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            No secret needed — CryoFlow authenticates through this machine&apos;s{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">ssh-agent</code>.
          </p>
        ) : null}
        {draft.authMethod === "key" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Private key path"
              hint="Path on THIS machine (~/.ssh/id_ed25519)."
              className="col-span-2"
            >
              <Input
                value={draft.privateKeyPath}
                onChange={(e) => patch({ privateKeyPath: e.target.value.slice(0, 300) })}
                placeholder="~/.ssh/id_ed25519"
                className="h-9 font-mono text-[13px]"
                maxLength={300}
                aria-label="Private key path on this machine"
              />
            </Field>
            <div className="col-span-2">
              {secretRow(
                "Key passphrase (optional)",
                draft.passphrase,
                (v) => patch({ passphrase: v, clearPassphrase: v ? false : draft.clearPassphrase }),
                connection?.hasPassphrase === true && draft.authMethod === "key",
                draft.clearPassphrase,
                (v) => patch({ clearPassphrase: v }),
                "••• stored"
              )}
            </div>
          </div>
        ) : null}
        {draft.authMethod === "password" ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              {secretRow(
                "Password",
                draft.password,
                (v) => patch({ password: v, clearPassword: v ? false : draft.clearPassword }),
                connection?.hasPassword === true && draft.authMethod === "password",
                draft.clearPassword,
                (v) => patch({ clearPassword: v }),
                "••• stored"
              )}
            </div>
            <p className="col-span-2 text-[11px] leading-relaxed text-muted-foreground" data-auth-dialect-hint="">
              Sent over both SSH password and keyboard-interactive prompts — the dialect university
              clusters usually speak (the same login MobaXterm uses).
            </p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <SectionTitle>Cluster layout</SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field
            label="Remote root"
            hint="Where this app's local data/relion workdir is mirrored on the cluster — job workdirs live under it and it is created on first run. ~ means your cluster home. Examples: ~/cryoflow · /scratch/$USER/cryoflow"
            className="col-span-2"
          >
            <Input
              value={draft.remoteRoot}
              onChange={(e) => patch({ remoteRoot: e.target.value.slice(0, 300) })}
              placeholder="~/cryoflow"
              className="h-9 font-mono text-[13px]"
              maxLength={300}
              aria-label="Cluster-side remote root directory"
            />
            {/* t289 — a root the user can SEE: once a probe brought back the
                cluster's $HOME, a ~-root shows its absolute expansion */}
            {resolvedRemoteRoot && resolvedRemoteRoot !== draft.remoteRoot.trim() ? (
              <p
                className="pt-0.5 font-mono text-[10.5px] leading-snug text-muted-foreground"
                data-remote-root-resolved=""
              >
                resolves to {resolvedRemoteRoot}
              </p>
            ) : null}
          </Field>
          <div className="flex items-end gap-2 pb-4">
            <Switch
              id="remote-use-slurm"
              checked={draft.useSlurm}
              onCheckedChange={(v) => patch({ useSlurm: v })}
              aria-label="Prefer Slurm submission"
            />
            <Label htmlFor="remote-use-slurm" className="text-[11px] leading-snug text-muted-foreground">
              Prefer Slurm (sbatch) submission <span className="text-muted-foreground/70">— the run dialog defaults to sbatch; direct nohup stays one click away</span>
            </Label>
          </div>
          <Field
            label="Slurm partition"
            hint="Used for #SBATCH --partition when submitting via sbatch (the probe's sinfo inventory lists what your cluster offers). Leave empty for the cluster default."
          >
            <Input
              value={draft.slurmPartition}
              onChange={(e) => patch({ slurmPartition: e.target.value.trim().slice(0, 80) })}
              placeholder="(cluster default) — e.g. gpu"
              className="h-9 font-mono text-[13px]"
              maxLength={80}
              aria-label="Slurm partition for sbatch submissions"
            />
          </Field>
          <Field
            label="Environment lines"
            hint="module load cuda/12.2 · export FOO=bar — one line each, sourced before runs."
            className="col-span-2"
          >
            <Textarea
              value={draft.envLines}
              onChange={(e) => patch({ envLines: e.target.value })}
              placeholder={"module load cuda/12.2\nexport RELION_MPI_MAX=8"}
              className="min-h-[72px] font-mono text-xs leading-relaxed"
              aria-label="Environment preparation lines"
            />
          </Field>
          <Field
            label="Results sync-back"
            hint="What finalize copies back to this machine. Bulky files that stay on the cluster are still listed in Results — preview or download them there on demand."
            className="col-span-2"
          >
            <Select
              value={draft.syncPolicy}
              onValueChange={(v) => patch({ syncPolicy: v as Draft["syncPolicy"] })}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="Results sync-back policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="key-files" className="text-sm">
                  Key files only — maps &amp; stacks stay on the cluster
                </SelectItem>
                <SelectItem value="everything" className="text-sm">
                  Everything under the caps
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {draft.syncPolicy === "key-files" ? (
            <Field
              label="Key-file cap (MB)"
              hint="Binary outputs above this stay remote (text, STAR and logs always sync)."
            >
              <Input
                type="number"
                min={1}
                value={draft.keyFileMb}
                onChange={(e) => patch({ keyFileMb: Number(e.target.value) })}
                className="h-9 text-sm"
                aria-label="Key-file size cap in MB"
              />
            </Field>
          ) : null}
          <Field label="Max file size (MB)" hint="Sync-back cap for a single file.">
            <Input
              type="number"
              min={1}
              value={draft.maxFileMb}
              onChange={(e) => patch({ maxFileMb: Number(e.target.value) })}
              className="h-9 text-sm"
              aria-label="Maximum single file size in MB for sync-back"
            />
          </Field>
          <Field label="Max total sync (MB)" hint="Sync-back cap for the whole workdir.">
            <Input
              type="number"
              min={1}
              value={draft.maxTotalMb}
              onChange={(e) => patch({ maxTotalMb: Number(e.target.value) })}
              className="h-9 text-sm"
              aria-label="Maximum total sync-back size in MB"
            />
          </Field>
        </div>
      </div>

      {/* Probe — the payoff card (test results / last registry probe).
          t289: the CREATE form speaks too — the by-value test fills
          probeOverride without a saved connection, chips pre-pin the
          default module (draftDefaultModule rides the Create payload).
          t297: below it, the verify door for modules no listing shows. */}
      {probe ? (
        <div className="space-y-2">
          <SectionTitle>{creating ? "Probe (not saved yet)" : "Last probe"}</SectionTitle>
          <ProbeCard
            probe={probe}
            defaultModule={creating ? draftDefaultModule : (connection?.defaultModule ?? null)}
            onPickModule={
              creating
                ? (m) => setDraftDefaultModule(m === draftDefaultModule ? null : m)
                : (m) => void pickModule(m)
            }
            picking={creating ? null : pickingModule}
          />
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {creating ? (
            <>
              Not tested yet — <span className="font-medium text-foreground/80">Test &amp; probe</span> logs in
              with the values above (nothing is saved) and discovers the node&apos;s relion modules.
            </>
          ) : (
            <>
              Never tested — run <span className="font-medium text-foreground/80">Test &amp; probe</span> to log
              in and discover the node&apos;s relion modules.
            </>
          )}
        </p>
      )}

      {/* t297 — the beta/hidden module door. t310: the CREATE form speaks
          too — the by-value route proves the name against the draft (nothing
          persisted until Create), so "does this beta module load HERE" is
          answerable BEFORE the connection exists. The Verify button waits
          for a valid host+username, exactly like Test & probe. */}
      <div
        className="space-y-1.5 rounded-md border border-dashed px-3 py-2.5"
        data-verify-module-row=""
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Module not listed? Verify by name
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Hidden and beta modules (Lmod hides them from <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">module avail</code>)
          still load by full name — type the exact name and verify it.{" "}
          {creating
            ? "It joins the list above and rides with Create as the default (nothing is saved until then)."
            : "It joins the list above and becomes the default."}
        </p>
        <div className="flex items-center gap-1.5">
          <Input
            value={verifyInput}
            onChange={(e) => setVerifyInput(e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void verifyModule();
              }
            }}
            placeholder="relion/beta_5.0_gpu_ompi5_cuda118"
            className="h-9 font-mono text-[13px]"
            maxLength={200}
            aria-label="Module name to verify"
            data-verify-module-input=""
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 text-xs"
            onClick={() => void verifyModule()}
            disabled={verifying || !verifyInput.trim() || (creating && !valid)}
            data-verify-module-button=""
          >
            {verifying ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <BadgeCheck className="size-3.5" aria-hidden="true" />
            )}
            {verifying ? "Verifying…" : creating ? "Verify" : "Verify & pin"}
          </Button>
        </div>
        {verifyResult ? (
          verifyResult.ok ? (
            <p
              role="status"
              className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300"
              data-verify-module-ok=""
            >
              <span className="font-mono">{verifyResult.module}</span> loads — relion_refine at{" "}
              <span className="font-mono">{verifyResult.relionHome || "(module PATH)"}</span>
              {verifyResult.mpi ? " · mpirun ✓" : " · no mpirun (sequential fallback)"}.{" "}
              {creating
                ? "It is in the list above and will become the default when you create the connection."
                : "It is now in the list above and pinned as the default."}
            </p>
          ) : (
            <p
              role="alert"
              className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300"
              data-verify-module-error=""
            >
              {verifyResult.error}
            </p>
          )
        ) : null}
      </div>

      {testError ? (
        <p
          className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-rose-700 dark:text-rose-300"
          role="alert"
        >
          {testError}
        </p>
      ) : null}

      {/* Run résumé (t270) — what this cluster has DONE for the user. Lives
          under the probe card: probe = reachability, résumé = track record.
          Zero runs renders nothing (the badge language: only things that
          happened get badges). */}
      {!creating && connection?.resume ? (
        <div className="space-y-2">
          <SectionTitle>Run résumé</SectionTitle>
          <RunResumeCard
            resume={connection.resume}
            connectionId={connection.id}
            onOpenJob={onOpenJob}
            onForgetRun={onForgetRun}
            onForgetAllDead={onForgetAllDead}
          />
        </div>
      ) : null}

      {error ? (
        <p
          className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-2.5 py-2 text-[11px] leading-relaxed text-rose-700 dark:text-rose-300"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* Editor actions */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        {creating ? (
          <Button variant="ghost" size="sm" className="h-9 text-sm" onClick={onCancelCreate}>
            Cancel
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 text-sm text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400",
              confirmDelete && "bg-rose-500/10"
            )}
            onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
            disabled={deleting}
            aria-label={confirmDelete ? "Confirm delete connection" : "Delete connection"}
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-3.5" aria-hidden="true" />
            )}
            {confirmDelete ? "Sure? Delete" : "Delete"}
          </Button>
        )}
        <div className="flex-1" />
        {savedFlash ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400" role="status">
            <Check className="size-3.5" aria-hidden="true" /> Saved
          </span>
        ) : dirty ? (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground" role="status">
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" /> unsaved edits
          </span>
        ) : null}
        {/* t289 — Test & probe lives on the CREATE form too: the by-value
            probe answers "does this login work" before anything is saved. */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-sm"
          onClick={() => void (creating ? testDraft() : test())}
          disabled={testing || saving || (creating && !valid)}
          title={
            creating
              ? "Log in over SSH with the values above (nothing is saved) and probe the node — can take ~30s"
              : "Log in over SSH and probe the node (can take ~30s)"
          }
        >
          {testing ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Server className="size-3.5" aria-hidden="true" />
          )}
          {testing ? "Probing…" : "Test & probe"}
        </Button>
        <Button
          size="sm"
          className="h-9 text-sm"
          onClick={() => void save()}
          disabled={saving || !valid}
          title={valid ? undefined : "Host and username are required"}
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          {creating ? "Create connection" : "Save"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The manager dialog                                                  */
/* ------------------------------------------------------------------ */

export function RemoteClusterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { connections, setConnections, reload } = useRemoteConnections(open);
  // t271 — the résumé's doorway: closing THIS dialog is part of the jump
  // (the inspector must not fight another dialog for the foreground), and
  // inspect() is the same store action every other surface uses.
  const inspect = useWorkflowStore((s) => s.inspect);
  const handleOpenJob = React.useCallback(
    (jobId: string) => {
      onOpenChange(false);
      inspect(jobId);
    },
    [onOpenChange, inspect]
  );
  // t294 — the forget door's caller: DELETE the dead record, then reload
  // the list — the server re-aggregates the résumé (one truth, no local
  // surgery on a cached card). A refusal (live job / not remote / missing)
  // propagates its honest error text back to the row's role=alert line.
  const handleForgetRun = React.useCallback(
    async (jobId: string) => {
      const res = await fetch(`/api/remote/records/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) throw new Error(body?.error || `forget failed (${res.status})`);
      reload();
    },
    [reload]
  );
  // t295 — the bulk door's caller: one DELETE retires every DEAD record of
  // the connection (the server keeps live records and counts both), then
  // reload — the server re-aggregates (one truth, no local surgery). The
  // counts come back so the card can state what actually happened.
  const handleForgetAllDead = React.useCallback(
    async (connectionId: string): Promise<{ forgotten: number; kept: number }> => {
      const res = await fetch(`/api/remote/records?connectionId=${encodeURIComponent(connectionId)}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; forgotten?: number; kept?: number }
        | null;
      if (!res.ok || !body?.ok) throw new Error(body?.error || `bulk forget failed (${res.status})`);
      reload();
      return { forgotten: body.forgotten ?? 0, kept: body.kept ?? 0 };
    },
    [reload]
  );
  // selection IS activation (see file doc): the highlighted row is the
  // active connection, persisted on every click.
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);

  // seed / repair the selection when the dialog opens or the list settles
  React.useEffect(() => {
    if (!open) return;
    setSelectedId((prev) => {
      if (prev && connections.some((c) => c.id === prev)) return prev;
      const stored = readActiveRemoteConnectionId();
      if (stored && connections.some((c) => c.id === stored)) return stored;
      return connections[0]?.id ?? "";
    });
  }, [open, connections]);

  const select = (id: string) => {
    setSelectedId(id);
    setCreating(false);
    writeActiveRemoteConnectionId(id);
  };

  const selected = connections.find((c) => c.id === selectedId) ?? null;

  const upsert = (c: RemoteConnectionDTO) => {
    setConnections((list) =>
      list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c]
    );
  };

  const handleSaved = (c: RemoteConnectionDTO, created: boolean) => {
    upsert(c);
    if (created) {
      setCreating(false);
      select(c.id); // you built it — it becomes the active connection
    }
  };

  const handleDeleted = (id: string) => {
    const rest = connections.filter((c) => c.id !== id);
    setConnections(rest);
    // keep the pane honest: fall back to a surviving connection
    if (selectedId === id) {
      const next = rest[0]?.id ?? "";
      setSelectedId(next);
      writeActiveRemoteConnectionId(next);
    }
    reload();
  };

  const handleProbed = (c: RemoteConnectionDTO | null, probe: RemoteProbe | null) => {
    if (c) {
      upsert(c);
    } else if (probe) {
      // no connection body — fold the probe into the known row
      setConnections((list) =>
        list.map((x) => (x.id === selectedId ? { ...x, lastProbe: probe } : x))
      );
    } else {
      reload();
    }
  };

  const handlePatched = (c: RemoteConnectionDTO) => upsert(c);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-5xl"
        onKeyDown={onEscapeClose(() => onOpenChange(false))}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="size-4 text-primary" aria-hidden="true" />
            Remote clusters (SSH)
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {connections.length} saved
            </Badge>
          </DialogTitle>
          <DialogDescription>
            SSH login nodes CryoFlow can dispatch jobs to. Secrets are stored on this machine only
            (the form keeps them when left empty);{" "}
            <span className="text-foreground/80">Test &amp; probe</span> logs in and discovers the
            node&apos;s relion modules. The highlighted row is the connection{" "}
            <span className="text-foreground/80">Run on cluster</span> uses.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 sm:flex-row">
          {/* ---------------- left rail: the connection list ---------------- */}
          <div className="flex w-full shrink-0 flex-col gap-1.5 sm:w-60">
            <div
              className="max-h-[54vh] space-y-1 overflow-y-auto pr-0.5"
              role="list"
              aria-label="SSH cluster connections"
            >
              {connections.map((c) => {
                const dot = probeDot(c);
                const active = c.id === selectedId && !creating;
                return (
                  // listitem wrapper keeps the list semantics while the
                  // button itself carries the toggle semantics (aria-pressed
                  // is a button trait, not a listitem one)
                  <div key={c.id} role="listitem">
                    <button
                      type="button"
                      onClick={() => select(c.id)}
                      className={cn(
                        "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                        active
                          ? "border-primary/50 bg-primary/[0.06]"
                          : "border-transparent hover:border-border hover:bg-muted/50"
                      )}
                      aria-pressed={active}
                      aria-label={`${c.name || `${c.username}@${c.host}`} — ${dot.label}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn("size-1.5 shrink-0 rounded-full", dot.className)}
                          aria-hidden="true"
                          title={dot.label}
                        />
                        <span className="truncate text-xs font-medium">
                          {c.name || `${c.username}@${c.host}`}
                        </span>
                        {active ? (
                          <Badge
                            variant="outline"
                            className="ml-auto h-4 shrink-0 border-primary/40 bg-primary/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-primary"
                          >
                            Active
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
                        {c.username}@{c.host}:{c.port}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
                          {AUTH_LABEL[c.authMethod]}
                        </Badge>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {c.lastProbe
                            ? `${c.lastProbe.relionModules.length} relion module${c.lastProbe.relionModules.length === 1 ? "" : "s"}`
                            : "never probed"}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
              {connections.length === 0 ? (
                <p className="rounded-md border border-dashed px-2.5 py-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                  No connections yet.
                </p>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setCreating(true)}
              disabled={creating}
            >
              <Plus className="size-3" aria-hidden="true" /> Add connection
            </Button>
          </div>

          {/* ---------------- right: the selected connection ---------------- */}
          <div
            className="min-w-0 flex-1 overflow-y-auto pr-1"
            style={{ maxHeight: "60vh" }}
            aria-live="polite"
          >
            {creating ? (
              <ConnectionEditor
                key="creating"
                connection={null}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                onProbed={handleProbed}
                onPatched={handlePatched}
                onCancelCreate={() => setCreating(false)}
                onOpenJob={handleOpenJob}
                onForgetRun={handleForgetRun}
              />
            ) : selected ? (
              <ConnectionEditor
                key={selected.id}
                connection={selected}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                onProbed={handleProbed}
                onPatched={handlePatched}
                onOpenJob={handleOpenJob}
                onForgetRun={handleForgetRun}
                onForgetAllDead={() => handleForgetAllDead(selected.id)}
              />
            ) : (
              <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Network className="size-5" aria-hidden="true" />
                </div>
                <p className="text-xs font-medium">No connection selected</p>
                <p className="max-w-64 text-[11px] leading-relaxed text-muted-foreground">
                  Add an SSH login node — host, user and a password or key — then probe it to find its
                  relion modules.
                </p>
                <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setCreating(true)}>
                  <Plus className="size-3" aria-hidden="true" /> Add connection
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Header button (self-contained trigger + dialog + health dot)        */
/* ------------------------------------------------------------------ */

/**
 * The header's entry into the cluster manager. The tiny emerald dot is a
 * reachability heartbeat: it lights when the ACTIVE connection's last
 * probe succeeded — computed after mount (localStorage is client-only),
 * so the SSR pass and the first client render agree: no dot, then truth.
 */
export function RemoteClusterButton() {
  const [open, setOpen] = React.useState(false);
  const { connections } = useRemoteConnections(open);
  const [healthy, setHealthy] = React.useState(false);

  React.useEffect(() => {
    const active = connections.find((c) => c.id === readActiveRemoteConnectionId());
    setHealthy(active?.lastProbe?.ok === true);
  }, [connections]);

  // the palette's row → this dialog (the handshake, see the event's note)
  React.useEffect(() => {
    const openit = () => setOpen(true);
    window.addEventListener(REMOTE_CLUSTERS_OPEN_EVENT, openit);
    return () => window.removeEventListener(REMOTE_CLUSTERS_OPEN_EVENT, openit);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Remote clusters (SSH)"
        title="Remote clusters (SSH) — manage connections, probe relion modules, dispatch jobs"
      >
        <Network className="size-4" aria-hidden="true" />
        {healthy ? (
          <span
            className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-500 ring-2 ring-background"
            aria-hidden="true"
          />
        ) : null}
      </Button>
      <RemoteClusterDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
