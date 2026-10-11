import { db } from "@/lib/db";
import { COMMAND_TEMPLATES, ENGINE_NATIVE_TYPES } from "./command-templates";
import { lineageFor } from "./dispatch";
import {
  buildArgv,
  parseJobParams,
  resolveInputs,
  workdirFor,
  type EngineJobRef,
} from "./engine";
import { detectRelion } from "./system";

/**
 * CryoFlow — the pipeline earns its replay script (Task 179).
 *
 * Task 170 gave every JOB a launch contract (the command preview's three
 * honest tiers). The project-level artifact was still missing: a builder
 * user's whole point is to walk away with a runnable pipeline, and the
 * JSON export (graph + params, CryoFlow-internal) cannot be `sh`-run on
 * the cluster. This module assembles the whole workflow into ONE shell
 * script:
 *
 *   • dependency order — Kahn's topological sort over the project's
 *     edges; ties broken by createdAt asc so the output is DETERMINISTIC
 *     (two exports of an untouched world differ only in the timestamp).
 *   • per step, the command route's three tiers apply:
 *       - engine-native types (import/select/…) → comment block only:
 *         there is no CLI process to replay (the app's executor performs
 *         them); the template's description speaks for the stage.
 *       - CLI types with resolvable inputs → the REAL argv via the SAME
 *         buildArgv the local runner and the sbatch dry-run use.
 *       - CLI types whose inputs are missing/waiting (or RELION absent)
 *         → the canonical template as a commented line + the reason.
 *   • replay semantics per status: completed → live command; idle with
 *     ready inputs → live command (a WIP pipeline finishes on a real
 *     machine); running → commented (moving target); failed → commented
 *     + inspect note; waiting → commented + reason.
 *   • `set -eu` — the first failed command stops the replay; the header
 *     says so.
 *
 * THE READ-ONLY CONTRACT (the command route's, extended to the project
 * level): building a script must never mkdir, spawn, or write state —
 * an export that litters disk is a leak with a download button.
 *
 * Shared-table doctrine (t166/t170): template BODIES live only in
 * command-templates.ts — this module imports the tables, it never
 * carries a copy of a body.
 */

export type ScriptMarker = "done" | "idle" | "run" | "wait" | "fail" | "native";

export interface PipelineStep {
  jobId: string;
  name: string;
  type: string;
  status: string;
  marker: ScriptMarker;
  /** 0-based line index of this step's marker line inside `script` —
   *  lets a probe assert topological order without parsing prose. */
  line: number;
  /** The command line as emitted ("" for native/commented steps). */
  command: string;
  /** Why the command is commented or absent (waiting reason, failure,
   *  RELION absence). Undefined for live/native steps. */
  note?: string;
}

export interface PipelineScriptResult {
  projectId: string;
  projectName: string;
  generatedAt: string;
  relion: { found: boolean; path: string | null };
  stats: {
    jobs: number;
    done: number;
    idle: number;
    run: number;
    wait: number;
    fail: number;
    native: number;
  };
  steps: PipelineStep[];
  script: string;
}

/** POSIX single-quote join — the copy-paste string for live commands.
 *  The SAME quoting rule the inspector's command preview hands the user
 *  (moved here in Task 179 so the preview and the replay script cannot
 *  drift apart: one quoting implementation, two consumers). Only args
 *  that NEED quoting get quoted (RELION paths in this world are
 *  space-free; a space-bearing path must not silently break a pasted
 *  command). */
export function shellJoin(argv: string[]): string {
  return argv
    .map((a) => (/[\s'"\\$`]/.test(a) ? `'${a.replaceAll("'", `'\\''`)}'` : a))
    .join(" ");
}

/** Kahn's topological sort with a deterministic tie-break. `edges` are
 *  (from,to) pairs among `keys`; the callback reads a step's sort key.
 *  Returns the ordered keys plus any keys trapped in a cycle (appendix
 *  block — the canvas prevents cycles, the script stays honest if one
 *  ever lands in the graph). */
function topoOrder(
  keys: string[],
  edges: { from: string; to: string }[],
  sortKeyOf: (k: string) => string
): { order: string[]; cycled: string[] } {
  const indegree = new Map<string, number>(keys.map((k) => [k, 0]));
  const adj = new Map<string, string[]>(keys.map((k) => [k, []]));
  for (const e of edges) {
    if (!indegree.has(e.from) || !indegree.has(e.to)) continue; // cross-project / dangling
    adj.get(e.from)!.push(e.to);
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
  }
  const ready = keys
    .filter((k) => (indegree.get(k) ?? 0) === 0)
    .sort((a, b) => (sortKeyOf(a) < sortKeyOf(b) ? -1 : 1));
  const order: string[] = [];
  while (ready.length > 0) {
    const k = ready.shift()!;
    order.push(k);
    for (const next of adj.get(k) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, d);
      if (d === 0) {
        ready.push(next);
        ready.sort((a, b) => (sortKeyOf(a) < sortKeyOf(b) ? -1 : 1));
      }
    }
  }
  const cycled = keys.filter((k) => !order.includes(k));
  return { order, cycled };
}

/** Build the whole project's replay script. All reads, no writes. */
export async function buildPipelineScript(
  projectId: string
): Promise<PipelineScriptResult | null> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  // Rows oldest-first: the deterministic tie-break for topo siblings AND
  // the dedupe rule for links (a mirror row never shadows its original —
  // the original, being older, wins the representative slot).
  const rows = await db.job.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  const edgeRows = await db.edge.findMany({
    where: { fromJobId: { in: rows.map((r) => r.id) } },
  });

  // ONE clock read for the whole artifact — the header line and the
  // generatedAt field must carry the SAME instant, or "two exports of an
  // untouched world differ only in the timestamp" is a lie by a few
  // milliseconds (two new Date() calls never agree).
  const generatedAt = new Date().toISOString();

  // Link collapse (the mirror rule from /api/jobs/[id]/command): a linked
  // row MIRRORS an original — resolve every row to its effective job and
  // keep the first occurrence (oldest). Rows whose effective original
  // lives in another project are dropped: the script is one project's
  // pipeline, not the whole database.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const effective = new Map<string, (typeof rows)[number]>(); // representative id → row
  for (const row of rows) {
    let job = row;
    const seen = new Set<string>([job.id]);
    while (job.linkedJobId && byId.has(job.linkedJobId) && !seen.has(job.linkedJobId)) {
      seen.add(job.linkedJobId);
      job = byId.get(job.linkedJobId)!;
    }
    if (!effective.has(job.id)) effective.set(job.id, job);
  }
  const steps0 = [...effective.values()]; // representative rows, oldest-first

  // Edges re-pointed at representatives (an edge into a mirror feeds the
  // original's step — the mirror has no outputs of its own).
  const effIds = new Set(steps0.map((s) => s.id));
  const edgeMap = new Map<string, string>(); // row id → representative id
  for (const [repId, row] of effective) edgeMap.set(row.id, repId);
  const tEdges = edgeRows
    .map((e) => ({ from: edgeMap.get(e.fromJobId) ?? "", to: edgeMap.get(e.toJobId) ?? "" }))
    .filter((e) => effIds.has(e.from) && effIds.has(e.to));

  const { order, cycled } = topoOrder(
    steps0.map((s) => s.id),
    tEdges,
    (k) => {
      const r = effective.get(k)!;
      return `${r.createdAt.getTime()}-${r.id}`; // deterministic tie-break
    }
  );
  const ordered = [...order, ...cycled]; // cycle appendix keeps every step in the script

  const relion = await detectRelion();
  const relionFound = relion.found && !!relion.path;

  const lines: string[] = [];
  const steps: PipelineStep[] = [];
  const push = (s: string) => lines.push(s);
  const markerOf = (m: ScriptMarker) => `# [${m}]`;

  // ---- header -------------------------------------------------------
  push("#!/bin/sh");
  push("# " + "=".repeat(69));
  push(`# CryoFlow pipeline replay — ${project.name}`);
  push(`# steps in dependency order (every command's inputs are produced`);
  push(`# by the steps above it). Generated ${generatedAt}.`);
  if (relionFound) {
    push(`# RELION: ${relion.path}`);
    push(`#`);
    push(`# Live commands are executable as-is; set -eu stops the replay at`);
    push(`# the first failure. Engine-native stages are comment-only (the`);
    push(`# app's own executor performs them; there is no CLI to replay).`);
  } else {
    push(`# RELION: NOT DETECTED — CLI lines below are the canonical`);
    push(`# templates (commented out). Install RELION, point the top bar's`);
    push(`# detector at it, and re-export to get executable paths.`);
    push(`#`);
    push(`# Engine-native stages are comment-only descriptions in any case.`);
  }
  push(`#`);
  push(`# Legend:`);
  push(`#   [done]   completed — command replayed verbatim`);
  push(`#   [idle]   inputs ready — command is live (runs on sh pipeline.sh)`);
  push(`#   [run]    running at export time — commented (moving target)`);
  push(`#   [wait]   inputs missing — commented, reason attached`);
  push(`#   [fail]   last run failed — commented, inspect and fix first`);
  push(`#   [native] engine-native stage — no CLI process exists to replay`);
  push("# " + "=".repeat(69));
  push("set -eu");
  push("");

  // ---- steps --------------------------------------------------------
  const census = { done: 0, idle: 0, run: 0, wait: 0, fail: 0, native: 0 };

  for (const row of ordered.map((id) => effective.get(id)!)) {
    const isNative = ENGINE_NATIVE_TYPES.has(row.type);
    const template = COMMAND_TEMPLATES[row.type] ?? null;
    push("# " + "-".repeat(69));

    if (isNative) {
      census.native += 1;
      const ref: EngineJobRef = {
        id: row.id,
        projectId: row.projectId,
        type: row.type,
        params: parseJobParams(row.params),
      };
      const lineIdx = lines.length;
      push(
        `${markerOf("native")} ${row.name} (${row.type}) — ${
          template ?? "engine-native stage (no template description)"
        }`
      );
      push(`#          workdir: ${workdirFor(ref)}`);
      steps.push({
        jobId: row.id,
        name: row.name,
        type: row.type,
        status: row.status,
        marker: "native",
        line: lineIdx,
        command: "",
      });
      push("");
      continue;
    }

    // CLI step: resolve the command through the SAME chain the command
    // route uses (lineage → inputs → argv), then speak it in shell.
    const ref: EngineJobRef = {
      id: row.id,
      projectId: row.projectId,
      type: row.type,
      params: parseJobParams(row.params),
    };
    const workdir = workdirFor(ref);

    let marker: ScriptMarker;
    let command = "";
    let note: string | undefined;
    let live = false;

    if (row.status === "running") {
      marker = "run";
      note = "running at export time — the replay must not race a live run";
    } else if (row.status === "failed") {
      marker = "fail";
      note = `last run failed — inspect ${workdir}/run.err, fix, then uncomment`;
    } else if (!relionFound) {
      marker = row.status === "completed" ? "done" : "idle";
      note =
        "RELION not detected — canonical template shown; re-export after detection for the real argv";
    } else {
      const upstream = await lineageFor(row.id);
      const resolved = resolveInputs(row.type, upstream, ref.params);
      if (resolved.missing) {
        marker = "wait";
        note = resolved.wait
          ? `waiting: ${resolved.missing} (${resolved.wait})`
          : `missing input: ${resolved.missing}`;
      } else {
        const ctx = {
          binDir: relion.path,
          workdir,
          inputs: resolved.inputs,
          job: ref,
          upstream,
          bridge: null,
        } as unknown as Parameters<typeof buildArgv>[0];
        const built = await buildArgv(ctx);
        if (Array.isArray(built)) {
          marker = row.status === "completed" ? "done" : "idle";
          command = shellJoin(built);
          live = true;
        } else {
          marker = "wait";
          note = `argv refused: ${(built as { error: string }).error}`;
        }
      }
    }

    census[marker] += 1;
    const lineIdx = lines.length;
    push(`${markerOf(marker)} ${row.name} (${row.type})`);
    push(`#          workdir: ${workdir}`);
    if (live) {
      push(command);
    } else {
      if (note) push(`#          ${note}`);
      push(`#          ${template ?? "(no template for this type)"}`);
    }
    steps.push({
      jobId: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      marker,
      line: lineIdx,
      command,
      note,
    });
    push("");
  }

  // ---- cycle appendix (defensive honesty) ---------------------------
  if (cycled.length > 0) {
    push("# " + "-".repeat(69));
    push(`# [wait] (cycle appendix) — ${cycled.length} step(s) sit on a dependency`);
    push(`#        cycle in the graph; they are exported here, out of order.`);
    push("");
  }

  // ---- footer -------------------------------------------------------
  push("# " + "-".repeat(69));
  const nCommands = steps.filter((s) => s.command !== "").length;
  push(
    `# ${steps.length} steps: ${census.done} done · ${census.idle} ready · ${census.run} running · ` +
      `${census.wait} waiting · ${census.fail} failed · ${census.native} native — ${nCommands} live command(s)`
  );
  push(`# replay: sh cryoflow-pipeline-${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project"}.sh`);

  const script = lines.join("\n") + "\n";

  return {
    projectId: project.id,
    projectName: project.name,
    generatedAt,
    relion: { found: relion.found, path: relion.found ? relion.path ?? null : null },
    stats: {
      jobs: steps.length,
      done: census.done,
      idle: census.idle,
      run: census.run,
      wait: census.wait,
      fail: census.fail,
      native: census.native,
    },
    steps,
    script,
  };
}
