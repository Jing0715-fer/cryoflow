/**
 * CryoFlow — the job roster's ONE export father (t1032).
 *
 * The dashboard's spotlight roster is the project's paper (Task 84 made it
 * a REAL <table> for print — the printed roster is the management summary)
 * — yet its rows could not leave. This lib is the roster's data mouth: the
 * SAME cells the rows speak, one formula, two surfaces. The grammar chain
 * (t1019 chart faces → t1028 session tables → t1029 one grammar → t1030
 * file ledger → t1031 params diff) visits its SIXTH seat here.
 *
 * The head words are the row's own facts: Job (the name — the roster's
 * names are unique addresses, the t1029 name-address law), Type (the
 * catalog's label word — the row's icon is the type's portrait, the CSV
 * speaks the portrait's NAME: a picture cannot travel into bytes, its word
 * can), Status (the badge's display word — the t322 queued dialect rides:
 * a Slurm-held run speaks the scheduler's word, never "running"),
 * Workspace (the chip's word; the orphan chip's "Unassigned"; "—" when the
 * row prints no chip at all), Detail (the row's second line — the row's
 * one fact line, verbatim).
 *
 * The detail line is the ONE formula the row renders (Task 142's
 * composition — "42% · 12m 05s · ~12m" reads progress, then fact, then
 * prediction): the display-economy law (t1031 F1) says the CSV speaks the
 * value the cell MEANS — the row's `truncate` is WIDTH, the full line
 * travels. The running line's ETA is a live prediction; the door handler
 * injects it at click time (estimateEta reads client-only pace baselines —
 * the lib stays pure, the client-bound half arrives as `etaOf`).
 *
 * Rendered doors never join the bytes (the t223 law): the chain-rank chip,
 * the note badges, the adopt/compare chrome are lens or interaction state —
 * the paper's own .no-print verdicts, already decided by the row.
 */

import { jobType } from "@/lib/workflow";
import { isSlurmQueued } from "@/lib/status-style";
import { compactStayReceipt } from "@/lib/remote/stay-receipt";
import { formatElapsed, formatEta } from "@/lib/elapsed";

/** The paper's own head words — the cells' names, in the row's order. */
export const ROSTER_HEAD = ["Job", "Type", "Status", "Workspace", "Detail"] as const;

/** The row shape the builder speaks — a job plus the faces it needs. */
export interface RosterJob {
  id: string;
  name: string;
  type: string;
  status: string;
  progress: number;
  startedAt: string | null;
  result: string | null;
  workspaceId?: string | null;
  runRemote?: {
    mode?: string;
    slurmState?: string;
    slurmDependsOn?: string[];
  } | null;
  remoteRemaining?: { remaining?: number | null } | null;
}

export interface RosterWorkspace {
  id: string;
  name: string;
}

export interface RosterRow {
  Job: string;
  Type: string;
  Status: string;
  Workspace: string;
  Detail: string;
  /** the CsvRow contract's index signature (the doors' row type) — the
   *  five head words are the only keys the builder ever sets. */
  [key: string]: string;
}

/**
 * The row's second line — ONE formula, two surfaces (the row renders it,
 * the CSV speaks it). The five arms, verbatim from the row's JSX:
 *
 *   running + Slurm-queued → "queued · waits on A, B" / "queued · waiting
 *                             for the scheduler"  (the t322 dialect — no
 *                             progress bar claims compute that has not
 *                             started)
 *   running                → "{pct}% · {elapsed}[ · ~{eta}]"  (the Task
 *                             142 composition; the elapsed arm only when
 *                             the clock has a start, the ETA arm only
 *                             when the pace is observable)
 *   result present         → compactStayReceipt (the stay receipt's own
 *                             compact word; remaining travels with it)
 *   idle                   → "not started"
 *   else                   → "—"
 */
export function rosterDetailLine(
  job: RosterJob,
  ctx: { now: number; etaOf?: (job: RosterJob) => number | null }
): string {
  if (job.status === "running" && isSlurmQueued(job)) {
    return job.runRemote?.slurmDependsOn?.length
      ? `queued · waits on ${job.runRemote.slurmDependsOn.join(", ")}`
      : "queued · waiting for the scheduler";
  }
  if (job.status === "running") {
    const rowElapsed =
      job.startedAt && ctx.now > 0
        ? Math.max(0, ctx.now - new Date(job.startedAt).getTime())
        : 0;
    const eta = ctx.etaOf ? ctx.etaOf(job) : null;
    let line = `${Math.round(job.progress)}%`;
    if (rowElapsed > 0) line += ` · ${formatElapsed(rowElapsed)}`;
    if (eta != null) line += ` · ${formatEta(eta)}`;
    return line;
  }
  if (job.result) {
    return compactStayReceipt(job.result, job.remoteRemaining?.remaining);
  }
  if (job.status === "idle") return "not started";
  return "—";
}

/**
 * The roster's rows — the cells the rows speak, newest-first order left to
 * the CALLER (the door drinks the rows the section SPEAKS NOW — the t1031
 * spoken-rows law: the filtered roster exports the filter's answer, in the
 * order the printed thead names: "newest first").
 *
 * Workspace cell: the chip's word when the row prints one; "Unassigned"
 * when the orphan chip prints (a workspace-less row in a project that HAS
 * workspaces — the row's own word); "—" when the row prints no chip at all
 * (a workspace-less project renders every job on one canvas — there is
 * nothing to attribute).
 *
 * null/empty input → null: the door's contract (an empty roster helps
 * nobody, and the honest refusal is the door's own disabled face).
 */
export function rosterRows(
  jobs: RosterJob[] | null | undefined,
  opts: {
    workspaces: RosterWorkspace[];
    now: number;
    etaOf?: (job: RosterJob) => number | null;
  }
): RosterRow[] | null {
  if (!jobs || jobs.length === 0) return null;
  return jobs.map((job) => {
    const wsName = opts.workspaces.find((w) => w.id === job.workspaceId)?.name ?? null;
    const orphan = !job.workspaceId && opts.workspaces.length > 0;
    return {
      Job: job.name,
      Type: jobType(job.type)?.label ?? job.type,
      Status: isSlurmQueued(job) ? "queued" : job.status,
      Workspace: wsName ?? (orphan ? "Unassigned" : "—"),
      Detail: rosterDetailLine(job, opts),
    };
  });
}
