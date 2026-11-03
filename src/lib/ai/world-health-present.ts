/**
 * t1148 — the world's health board, the AGENT face: a PURE presenter.
 *
 * The health board learned to speak in t1133 (the engine + pipeline
 * verdicts) and t1140/t1143 (the jobs' own face: the last failure NAMED,
 * the oldest running WEIGHED against the world's own pace, the Fresh and
 * Marathon completions). Thirty-three agent tools could read the roster
 * (get_workflow_state), the box (get_system_diagnostics) and the time
 * (get_session_timeline) — but none could answer "how is the pipeline
 * DOING?" with the board's own words. Re-deriving a diagnosis from the
 * raw roster is how a twin is born; the house law is one father per
 * verdict, and the fathers already live in lib/world-vitals.ts.
 *
 * Laws:
 *  - ONE FATHER — the census is worldVitalsOf's, the verdicts are
 *    worldHealthRows', the jobs' face is worldJobRows'. This module
 *    composes and speaks; it never re-derives a count, a median or a
 *    verdict (no status counting loop, no second formatter — the same
 *    law the t1132 copy ledger speaks).
 *  - THE READ SUCCEEDS WHEN THE BOARD SPEAKS — `ok` is the READ's
 *    health, not the world's: warn rows are the ANSWER (each row
 *    carries its own ok), never a failed read. Only a composition that
 *    cannot speak would fail, and the fathers always speak.
 *  - THE PROBE'S HONEST ABSENCE — a thrown engine probe leaves the
 *    Engine row as worldHealthRows' own absence face (never a invented
 *    green, never a paraphrase); the annex names the provenance
 *    (failed / cached / fresh) so the reader knows which cup was drunk.
 *  - PROJECT SCOPE, SAID ALOUD — the agent's well feeds the WHOLE
 *    project's roster (the db truth; the server cannot know the
 *    client's active workspace). A one-workspace project — the
 *    canonical world — agrees row for row with the dialog's board; a
 *    multi-workspace project gets the scope note in the summary AND the
 *    annex, so the rows' "this workspace" wording is never a lie.
 *  - PURE — no React, no store, no db, no clock: `now` rides the input.
 */

import {
  worldVitalsOf,
  worldHealthRows,
  worldJobRows,
  type HealthRow,
  type JobClock,
  type WorldVitals,
} from "@/lib/world-vitals";
import type { SystemStatusClient } from "@/lib/types";

/** Structurally the tools' AiToolResult — the pure module defines its
 * own shape so it never imports the tool executor's world (db, prisma,
 * the whole engine). */
export interface WorldHealthToolResult {
  ok: boolean;
  summary: string;
  detail?: unknown;
}

export interface WorldHealthInput {
  /** The project's own name (the summary's subject). */
  projectName: string;
  /** The roster, in the JobClock shape the jobs' face eats (ISO stamps). */
  jobs: JobClock[];
  /** The wires (only the count speaks — the pipeline row's coherence). */
  edges: { id: string }[];
  /** The engine status, SystemStatusClient shape (RelionStatus IS it) —
   *  null only when the probe itself failed (the honest absence face). */
  engine: SystemStatusClient | null;
  /** True when the well's detectRelion() THREW — the annex's provenance
   *  line distinguishes "the probe failed" from "nothing found". */
  engineProbeFailed?: boolean;
  /** The read's clock (the jobs' face's `now` — pure; the wall clock
   *  belongs to the well, never to this module). */
  now: number;
  /** How many workspaces hold the roster's jobs (1 = the canonical
   *  world; >1 turns the scope note on). */
  workspaceCount?: number;
}

/** The provenance word for the engine status the read drunk. */
function engineProbeWord(input: WorldHealthInput): string {
  if (input.engineProbeFailed) return "failed";
  if (input.engine == null) return "absent";
  return input.engine.fromCache ? "cached" : "fresh";
}

/** t1148 — the board's agent face. Feed it the roster, the wires, the
 *  engine status and the clock; it returns the board's own rows byte for
 *  byte (verdicts first, then the jobs' own face — the dialog's order)
 *  plus a summary that names the warns so a skim answers "how is it
 *  doing?" without opening the annex. */
export function presentWorldHealth(input: WorldHealthInput): WorldHealthToolResult {
  const vitals: WorldVitals = worldVitalsOf(input.jobs, input.edges);
  const verdicts: HealthRow[] = worldHealthRows(vitals, input.engine);
  const jobRows: HealthRow[] = worldJobRows(input.jobs, input.now);
  const rows: HealthRow[] = [...verdicts, ...jobRows];
  const warns = rows.filter((r) => !r.ok);

  const notStarted = vitals.pending + vitals.idle;
  const counts = `${vitals.jobs} job${vitals.jobs === 1 ? "" : "s"} — ${vitals.completed} completed, ${vitals.failed} failed, ${vitals.running} running, ${notStarted} not started`;
  const subject = vitals.jobs === 0
    ? `Pipeline "${input.projectName}" is empty (0 jobs).`
    : `Pipeline "${input.projectName}": ${counts}.`;
  const warnWord = warns.length === 0
    ? "The board is green — every row speaks ok."
    : `The board speaks ${warns.length} warn row${warns.length === 1 ? "" : "s"}: ${warns.map((r) => r.label).join(", ")}.`;
  const probeWord = engineProbeWord(input);
  const probeNote = input.engineProbeFailed
    ? " The engine probe itself threw on the server — the Engine row is the board's own honest-absence face, not a verdict."
    : "";
  const multiWs = (input.workspaceCount ?? 1) > 1;
  const scopeNote = multiWs
    ? ` This read feeds the WHOLE project's roster (${input.workspaceCount} workspaces' jobs in one read) — the client dialog reads the active workspace's; the rows speak for the roster they were fed.`
    : "";
  const tail =
    " The annex is the health board's own rows byte for byte — the same fathers the World health dialog binds (engine + pipeline verdicts, then the jobs' own face).";

  return {
    ok: true,
    summary: `${subject} ${warnWord}${probeNote}${scopeNote}${tail}`,
    detail: {
      project: input.projectName,
      readAt: new Date(input.now).toISOString(),
      scope: multiWs
        ? `the whole project's roster — ${input.workspaceCount} workspaces' jobs in one read`
        : "the whole project's roster (one workspace — the dialog's active-workspace board agrees row for row)",
      engineProbe: probeWord,
      vitals,
      verdicts: verdicts.map((r) => ({ key: r.key, label: r.label, ok: r.ok, detail: r.detail })),
      jobs: jobRows.map((r) => ({ key: r.key, label: r.label, ok: r.ok, detail: r.detail })),
    },
  };
}
