/**
 * CryoFlow — AI assistant tool surface (SERVER ONLY).
 *
 * t419 — the agent's hands. Every tool is the SAME server logic the UI's
 * own doors run (POST /api/jobs' scalar param filter, POST /api/edges'
 * port/cycle validation, startJob's dispatch, the classes route's
 * occupancy) — the assistant never gets a private mutation path the
 * product doesn't already trust.
 *
 * Design laws:
 *  - SCALAR PARAM FILTER: unknown keys drop silently on create/update —
 *    the same security posture the POST route earned (the `interpreter`
 *    leak lesson); the tool result SAYS what was dropped.
 *  - CONFIRM GATES: delete_job refuses completed/running jobs without
 *    confirm:true; run_job's summary names the wipe semantics of a re-run.
 *  - HONEST RESULTS: every tool answers {ok, summary, detail} — the agent
 *    narrates from summaries, never from imagination.
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import {
  CARD_W,
  JOB_TYPES,
  coerceParam,
  defaultParams,
  defaultPorts,
  jobType,
  nextStepsFor,
} from "@/lib/workflow";
import { findEffectiveJob } from "@/lib/link";
import { allAdjacency, portsValid } from "@/lib/edge-ports";
import { findCycle } from "@/lib/graph-cycle";
import { ensureDefaultWorkspace, toJobDTO } from "@/lib/seed";
import { getActiveProject, projectRemoteTarget } from "@/lib/projects";
import { getConnection } from "@/lib/remote/connections";
import { startJob } from "@/lib/relion/dispatch";
import { getRun, latestIterationDataStar, stopRun } from "@/lib/relion/engine";
import { remoteStopRun } from "@/lib/remote/remote-run";
import { fetchRemoteFileIntoWorkdir } from "@/lib/remote/remote-files";
import { renderClassSheetPng } from "@/lib/mrc";
import { parseStar } from "@/lib/starfile";
import { RELION_DIR } from "@/lib/paths";
import { resolveAssistant } from "./settings";
import { visionOnce } from "./wire";
import type { ToolSchema } from "./wire";

export interface AiToolResult {
  ok: boolean;
  summary: string;
  detail?: unknown;
}

export interface AgentCtx {
  /** The active project id (resolved once per iteration). */
  projectId: string;
}

/* ------------------------------------------------------------------ */
/* Tool catalog                                                         */
/* ------------------------------------------------------------------ */

export const AI_TOOLS: ToolSchema[] = [
  {
    name: "list_job_types",
    description:
      "List every job type this app can create: key, label, description, category, input/output ports, and each type's legal NEXT steps (the RELION pipeline canon). Call this before building a chain you are unsure about.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_job_params",
    description:
      "Full parameter schema of ONE job type: key, label, type, default, options (for selects), tab, and whether advanced. Call before setting non-trivial params — keys must match the schema exactly.",
    parameters: {
      type: "object",
      properties: { job_type: { type: "string", description: "Job type key, e.g. class2d" } },
      required: ["job_type"],
      additionalProperties: false,
    },
  },
  {
    name: "get_workflow_state",
    description:
      "The active project's canvas: project info (name, mode, cluster binding), workspaces, every job (id, type, name, status, progress, position, result line) and every wire (from → to with ports). ALWAYS call this first when the user refers to existing jobs.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_job",
    description:
      "Create one job on the canvas. Pass connect_from (an upstream job id) to draw the wire automatically (ports auto-picked, cycle-safe). params may carry schema keys only (unknown keys drop). Position is auto-computed right of the source / right of the canvas content.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Job type key (from list_job_types), e.g. motioncorr" },
        name: { type: "string", description: "Optional custom name (≤120 chars)" },
        connect_from: { type: "string", description: "Upstream job id to wire from (draws the edge)" },
        params: {
          type: "object",
          description: "Param overrides keyed by the type's schema (get_job_params)",
          additionalProperties: true,
        },
        x: { type: "number", description: "Optional explicit canvas x" },
        y: { type: "number", description: "Optional explicit canvas y" },
      },
      required: ["type"],
      additionalProperties: false,
    },
  },
  {
    name: "update_job",
    description:
      "Update a job's params (merged with current values; schema keys only), name, or note.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        params: { type: "object", additionalProperties: true },
        name: { type: "string" },
        note: { type: "string", description: "Free-text annotation (≤500 chars)" },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "connect_jobs",
    description:
      "Wire job A's output to job B's input (ports auto-picked when omitted). Refuses port mismatches, cycles, cross-project pairs and duplicates.",
    parameters: {
      type: "object",
      properties: {
        from_job_id: { type: "string" },
        to_job_id: { type: "string" },
        from_port: { type: "string" },
        to_port: { type: "string" },
      },
      required: ["from_job_id", "to_job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_job",
    description:
      "Remove a job (and its wires) from the canvas. REFUSES completed or running jobs unless confirm:true — ask the user first, then confirm.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        confirm: { type: "boolean", description: "true = the user confirmed destroying this job's results" },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "run_job",
    description:
      "Start a job's REAL run. mode: 'local' forces the local RELION lane; 'cluster' uses the project's bound SSH cluster; omitted picks the project's default. Re-running a completed job WIPES its previous results — only run what the user asked for. Downstream pending jobs auto-start when their upstream completes.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        mode: { type: "string", enum: ["local", "cluster"] },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "stop_job",
    description: "Stop a running job (SIGTERM/SIGKILL locally, scancel on the cluster). Checkpoints stay for refine-family re-runs.",
    parameters: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "inspect_job",
    description:
      "One job in depth: status, result line, key non-default params, run record (lane, cluster, phase), last log lines, and — for classifications — the class occupancy table. Use before judging or troubleshooting.",
    parameters: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "judge_2d_classes",
    description:
      "THE VISION TOOL for 2D classification results: renders the class-average sheet (one grid image, all classes), reads per-class occupancy AND per-class estimated resolution from the model star, sends them with the image to a vision model, and returns a per-class keep/maybe/reject verdict with reasons plus overall advice. Call whenever the user asks which 2D classes are good.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "A class2d job (completed or with results)" },
        question: { type: "string", description: "Optional focus, e.g. '只挑大于5000粒子的类'" },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "select_classes",
    description:
      "Act on a judged classification: create a selection job wired to the chosen classes (default select2d 'Particle Selection'; class3d/refine3d/initialmodel also accept class selections). classes are 1-based class numbers.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "The class2d (or class3d) job to select from" },
        classes: { type: "array", items: { type: "number" }, description: "1-based class numbers to keep" },
        target_type: {
          type: "string",
          enum: ["select2d", "initialmodel", "class3d", "refine3d"],
          description: "The downstream job type to create (default select2d)",
        },
      },
      required: ["job_id", "classes"],
      additionalProperties: false,
    },
  },
];

/* ------------------------------------------------------------------ */
/* Pure helpers (bench-covered)                                        */
/* ------------------------------------------------------------------ */

/** The POST /api/jobs scalar filter, verbatim semantics (import keeps empiarData). */
export function filterParamsForSpec(
  type: string,
  incoming: unknown
): { filtered: Record<string, number | string | boolean>; dropped: string[] } {
  const spec = jobType(type);
  const out: Record<string, number | string | boolean> = {};
  const dropped: string[] = [];
  if (!spec) return { filtered: out, dropped };
  const allowed = new Set((spec.params ?? []).map((p) => p.key));
  if (type === "import") allowed.add("empiarData");
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return { filtered: out, dropped };
  }
  for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
    if (allowed.has(key) && (typeof value === "number" || typeof value === "string" || typeof value === "boolean")) {
      out[key] = value;
    } else if (allowed.has(key)) {
      dropped.push(`${key}(wrong type)`);
    } else {
      dropped.push(key);
    }
  }
  return { filtered: out, dropped };
}

/** Canvas position for a new job: right of its source, or right of everything. */
export function nextPositionFor(
  from: { x: number; y: number } | null,
  content: { x: number; y: number }[]
): { x: number; y: number } {
  if (from) {
    return {
      x: from.x + CARD_W + 100,
      y: from.y + Math.round(Math.random() * 40 - 20),
    };
  }
  if (content.length === 0) return { x: 140 + Math.round(Math.random() * 60), y: 200 + Math.round(Math.random() * 60) };
  const maxX = Math.max(...content.map((j) => j.x));
  const nearRight = content.filter((j) => j.x > maxX - 400);
  const avgY = nearRight.reduce((s, j) => s + j.y, 0) / Math.max(1, nearRight.length);
  return { x: maxX + CARD_W + 100, y: Math.round(avgY + (Math.random() * 80 - 40)) };
}

/** The class-averages stack dialect (mirror of the classes route's canon). */
const STACK_NAME_PATTERNS = [
  /^(?:run_it|_it)\d+_classes\.mrcs?$/i,
  /^(?:run_it|_it)\d+_unmasked_classes\.mrcs?$/i,
  /^run_unmasked_classes\.mrcs?$/i,
];

export function pickClassStackName(names: string[]): string | null {
  const stacks = names.filter((n) => STACK_NAME_PATTERNS.some((re) => re.test(n)));
  const unmasked = stacks.find((n) =>
    /^(?:run_it|_it)\d+_unmasked_classes\.mrcs?$|^run_unmasked_classes\.mrcs?$/i.test(n)
  );
  if (unmasked) return unmasked;
  let bestIter = -1;
  let best: string | null = null;
  for (const n of stacks) {
    const m = n.match(/(?:run_it|_it)(\d+)_classes/i);
    if (m && Number(m[1]) > bestIter) {
      bestIter = Number(m[1]);
      best = n;
    }
  }
  return best;
}

export interface ClassStat {
  cls: number;
  count: number;
  fraction: number;
  /** Å, from the model star's rlnEstimatedResolution (null when absent). */
  resolution: number | null;
}

/** Occupancy from the latest settled data star + resolution from the model star. */
export function classStatsFromWorkdir(workdir: string): {
  iteration: number | null;
  classes: ClassStat[];
  total: number;
  stackFile: string | null;
} {
  let names: string[] = [];
  try {
    names = readdirSync(workdir);
  } catch {
    return { iteration: null, classes: [], total: 0, stackFile: null };
  }
  const stackFile = pickClassStackName(names);
  const best = latestIterationDataStar(workdir);
  if (!best) return { iteration: null, classes: [], total: 0, stackFile };

  // occupancy — count _rlnClassNumber rows in the particles loop
  let counts = new Map<number, number>();
  let total = 0;
  try {
    const file = parseStar(readFileSync(path.join(workdir, best.file), "utf8"));
    let loop = null as { columns: string[]; rows: string[][] } | null;
    for (const b of file.blocks) {
      if (b.loop && b.loop.columns.includes("_rlnClassNumber")) {
        loop = b.loop;
        break;
      }
    }
    if (!loop) {
      for (const b of file.blocks) {
        if (b.loop && b.loop.columns.some((c) => c.startsWith("_rlnClassNumber"))) {
          loop = b.loop;
          break;
        }
      }
    }
    if (loop) {
      const col = loop.columns.findIndex((c) => c.startsWith("_rlnClassNumber"));
      for (const row of loop.rows) {
        const cls = parseInt(row[col] ?? "", 10);
        if (Number.isFinite(cls) && cls > 0) {
          counts.set(cls, (counts.get(cls) ?? 0) + 1);
          total++;
        }
      }
    }
  } catch {
    /* unreadable data star → occupancy stays empty */
  }

  // per-class resolution — the model star's classes loop
  const resolutions = new Map<number, number>();
  const modelCandidates = [
    best.file.replace(/_data\.star$/i, "_model.star"),
    best.file.replace(/_data\.star$/i, "_half1_model.star"),
  ];
  for (const cand of modelCandidates) {
    if (!names.includes(cand)) continue;
    try {
      const file = parseStar(readFileSync(path.join(workdir, cand), "utf8"), 5000);
      for (const b of file.blocks) {
        const loop = b.loop;
        if (!loop || !loop.columns.includes("_rlnEstimatedResolution")) continue;
        const resCol = loop.columns.findIndex((c) => c.startsWith("_rlnEstimatedResolution"));
        loop.rows.forEach((row, i) => {
          const res = parseFloat(row[resCol] ?? "");
          if (Number.isFinite(res)) resolutions.set(i + 1, res);
        });
        break;
      }
    } catch {
      /* unreadable model star → resolutions stay empty */
    }
    if (resolutions.size > 0) break;
  }

  const classes: ClassStat[] = [...counts.entries()]
    .map(([cls, count]) => ({
      cls,
      count,
      fraction: total > 0 ? count / total : 0,
      resolution: resolutions.get(cls) ?? null,
    }))
    .sort((a, b) => a.cls - b.cls);
  return { iteration: best.iteration, classes, total, stackFile };
}

/** Extract the JSON verdict from a VLM answer (fences, prose, or raw). */
export interface JudgeVerdict {
  classes: { cls: number; verdict: string; reason: string }[];
  advice: string;
}
export function parseJudgeVerdict(text: string): JudgeVerdict | null {
  if (!text) return null;
  const candidates: string[] = [];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenced.exec(text))) candidates.push(m[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(text);
  for (const cand of candidates) {
    try {
      const parsed = JSON.parse(cand.trim()) as {
        classes?: unknown;
        advice?: unknown;
      };
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.classes)) continue;
      const classes = parsed.classes
        .map((c) => {
          const r = c as { cls?: unknown; verdict?: unknown; reason?: unknown };
          return {
            cls: Number(r.cls),
            verdict: String(r.verdict ?? "").toLowerCase(),
            reason: String(r.reason ?? ""),
          };
        })
        .filter((c) => Number.isFinite(c.cls) && c.cls > 0);
      if (classes.length === 0) continue;
      return { classes, advice: typeof parsed.advice === "string" ? parsed.advice : "" };
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Executors                                                            */
/* ------------------------------------------------------------------ */

type PrismaJob = Awaited<ReturnType<typeof db.job.findFirst>>;

async function findJobInProject(jobId: string, projectId: string): Promise<PrismaJob> {
  const job = await db.job.findFirst({ where: { id: jobId, projectId } });
  if (!job) {
    // links resolve to their original (the same door every jobs/[id] route uses)
    const linked = await findEffectiveJob(jobId);
    if (linked && linked.projectId === projectId) return linked;
  }
  return job;
}

function truncate(s: string | null | undefined, max = 200): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function executeAiTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentCtx
): Promise<AiToolResult> {
  try {
    switch (name) {
      case "list_job_types":
        return listJobTypes();
      case "get_job_params":
        return getJobParams(String(args.job_type ?? ""));
      case "get_workflow_state":
        return await getWorkflowState(ctx);
      case "create_job":
        return await createJob(ctx, args);
      case "update_job":
        return await updateJob(ctx, args);
      case "connect_jobs":
        return await connectJobs(ctx, args);
      case "delete_job":
        return await deleteJob(ctx, args);
      case "run_job":
        return await runJobTool(ctx, args);
      case "stop_job":
        return await stopJobTool(ctx, args);
      case "inspect_job":
        return await inspectJob(ctx, String(args.job_id ?? ""));
      case "judge_2d_classes":
        return await judge2dClasses(ctx, String(args.job_id ?? ""), typeof args.question === "string" ? args.question : undefined);
      case "select_classes":
        return await selectClasses(ctx, args);
      default:
        return { ok: false, summary: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, summary: `Tool ${name} failed: ${truncate(message, 400)}` };
  }
}

/* ---- list_job_types ------------------------------------------------ */

function listJobTypes(): AiToolResult {
  const rows = JOB_TYPES.map((t) => {
    const next = nextStepsFor(t.key).map((s) => s.type);
    return {
      key: t.key,
      label: t.label,
      category: t.category,
      group: t.group,
      description: t.description,
      tier: t.tier,
      inputs: t.inputs.map((i) => ({ name: i.name, accepts: i.accepts ?? ["*"], multiple: i.multiple ?? false })),
      outputs: t.outputs.map((o) => ({ name: o.name, kind: o.kind ?? "star" })),
      next_steps: next,
    };
  });
  return {
    ok: true,
    summary: `${JOB_TYPES.length} job types across ${rows.filter((r) => r.group === "SPA").length} SPA + ${rows.filter((r) => r.group === "Tomography").length} tomography entries (with legal successors)`,
    detail: { job_types: rows },
  };
}

/* ---- get_job_params ------------------------------------------------ */

function getJobParams(type: string): AiToolResult {
  const spec = jobType(type);
  if (!spec) return { ok: false, summary: `Unknown job type: ${type}` };
  const params = spec.params.slice(0, 120).map((p) => ({
    key: p.key,
    label: p.label,
    type: p.type,
    default: p.default,
    ...(p.options ? { options: p.options } : {}),
    ...(p.min != null ? { min: p.min } : {}),
    ...(p.max != null ? { max: p.max } : {}),
    tab: p.tab ?? "Additional",
    ...(p.advanced ? { advanced: true } : {}),
    ...(p.hint ? { hint: truncate(p.hint, 180) } : {}),
  }));
  return {
    ok: true,
    summary: `${type}: ${params.length} params across tabs ${[...new Set(params.map((p) => p.tab))].join(", ")}`,
    detail: { job_type: type, params },
  };
}

/* ---- get_workflow_state -------------------------------------------- */

async function getWorkflowState(ctx: AgentCtx): Promise<AiToolResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, summary: "No active project" };
  const [jobs, workspaces] = await Promise.all([
    db.job.findMany({ where: { projectId: ctx.projectId }, orderBy: { createdAt: "asc" } }),
    db.workspace.findMany({ where: { projectId: ctx.projectId }, orderBy: { order: "asc" } }),
  ]);
  const edges = await db.edge.findMany({ where: { projectId: ctx.projectId } });
  const wsName = new Map(workspaces.map((w) => [w.id, w.name]));
  let clusterName: string | null = null;
  if (active.meta.remote?.connectionId) {
    const conn = getConnection(active.meta.remote.connectionId);
    clusterName = conn ? (conn.name || `${conn.username}@${conn.host}`) : active.meta.remote.connectionId;
  }
  return {
    ok: true,
    summary: `Project "${active.project.name}": ${jobs.length} jobs, ${edges.length} wires, ${workspaces.length} workspaces`,
    detail: {
      project: {
        name: active.project.name,
        mode: active.meta.mode,
        cluster: clusterName,
      },
      workspaces: workspaces.map((w) => ({ id: w.id, name: w.name })),
      jobs: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        name: j.name,
        status: j.status,
        progress: j.progress,
        workspace: (j.workspaceId ? wsName.get(j.workspaceId) : undefined) ?? "Main",
        result: truncate(j.result, 200),
        note: truncate(j.note, 120),
        x: j.x,
        y: j.y,
      })),
      wires: edges.map((e) => ({ from: e.fromJobId, to: e.toJobId })),
    },
  };
}

/* ---- create_job ----------------------------------------------------- */

async function createJob(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const type = String(args.type ?? "");
  const spec = jobType(type);
  if (!spec) return { ok: false, summary: `Unknown job type: ${type} — call list_job_types for the catalog` };

  const { filtered, dropped } = filterParamsForSpec(type, args.params);

  let connectFrom: PrismaJob = null;
  const connectFromId = typeof args.connect_from === "string" ? args.connect_from : null;
  if (connectFromId) {
    connectFrom = await findJobInProject(connectFromId, ctx.projectId);
    if (!connectFrom) {
      return { ok: false, summary: `connect_from job not found in this project: ${connectFromId} — call get_workflow_state for the real ids` };
    }
  }

  // workspace: the source's workspace (chains stay together), else the first
  let workspaceId = connectFrom?.workspaceId ?? null;
  if (!workspaceId) {
    const first = await db.workspace.findFirst({
      where: { projectId: ctx.projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    workspaceId = first?.id ?? (await ensureDefaultWorkspace(ctx.projectId));
  }

  const content = await db.job.findMany({
    where: { projectId: ctx.projectId },
    select: { x: true, y: true },
  });
  const auto = nextPositionFor(connectFrom ? { x: connectFrom.x, y: connectFrom.y } : null, content);
  const x = typeof args.x === "number" && Number.isFinite(args.x) ? args.x : auto.x;
  const y = typeof args.y === "number" && Number.isFinite(args.y) ? args.y : auto.y;

  const count = await db.job.count({ where: { projectId: ctx.projectId, type } });
  const customName =
    typeof args.name === "string" && args.name.trim() ? args.name.trim().slice(0, 120) : null;

  const storedParams: Record<string, unknown> = {
    ...defaultParams(type),
    ...filtered,
  };

  const job = await db.job.create({
    data: {
      projectId: ctx.projectId,
      workspaceId,
      type,
      name: customName ?? `${spec.label} ${count + 1}`,
      x,
      y,
      params: JSON.stringify(storedParams),
      duration: spec.duration,
    },
  });

  // the wire — same validations the edges route enforces
  let edgeSummary = "";
  if (connectFrom) {
    const ports = defaultPorts(connectFrom.type, type);
    if (!portsValid(connectFrom.type, ports.fromPort, type, ports.toPort)) {
      return {
        ok: true,
        summary: `Created ${job.name} (${type}) but the wire ${connectFrom.name} → ${job.name} was refused: no compatible port pair — wire it manually via connect_jobs`,
        detail: { jobId: job.id, type, wired: false },
      };
    }
    const duplicate = await db.edge.findUnique({
      where: { fromJobId_toJobId: { fromJobId: connectFrom.id, toJobId: job.id } },
    });
    if (!duplicate) {
      await db.edge.create({
        data: { projectId: ctx.projectId, fromJobId: connectFrom.id, toJobId: job.id },
      });
      edgeSummary = `, wired from ${connectFrom.name} (${ports.fromPort} → ${ports.toPort})`;
    }
  }

  const dto = toJobDTO(job);
  dto.engine = "relion";
  return {
    ok: true,
    summary: `Created ${job.name} [${job.id}]${edgeSummary}${dropped.length > 0 ? ` (dropped unknown params: ${dropped.join(", ")})` : ""}`,
    detail: { job: dto, wired: Boolean(connectFrom), dropped },
  };
}

/* ---- update_job ----------------------------------------------------- */

async function updateJob(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if (job.linkedJobId) return { ok: false, summary: `${job.name} is a soft link — edit its original instead` };

  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  if (args.params && typeof args.params === "object" && !Array.isArray(args.params)) {
    const { filtered, dropped } = filterParamsForSpec(job.type, args.params);
    if (Object.keys(filtered).length > 0) {
      const stored = JSON.parse(job.params || "{}") as Record<string, unknown>;
      const spec = jobType(job.type);
      for (const [key, value] of Object.entries(filtered)) {
        const p = spec?.params.find((sp) => sp.key === key);
        stored[key] = p ? coerceParam(p, value) : value;
        changes.push(`${key}=${String(value)}`);
      }
      data.params = JSON.stringify(stored);
    }
    if (dropped.length > 0) {
      changes.push(`dropped: ${dropped.join(", ")}`);
    }
  }
  if (typeof args.name === "string" && args.name.trim()) {
    data.name = args.name.trim().slice(0, 120);
    changes.push(`name → ${data.name}`);
  }
  if (typeof args.note === "string") {
    data.note = args.note.trim() ? args.note.trim().slice(0, 500) : null;
    changes.push("note updated");
  }
  if (Object.keys(data).length === 0) {
    return { ok: true, summary: `Nothing to update on ${job.name} (no valid fields in the request)` };
  }
  const updated = await db.job.update({ where: { id: job.id }, data });
  return {
    ok: true,
    summary: `Updated ${updated.name}: ${changes.join("; ")}`,
    detail: { job: toJobDTO(updated) },
  };
}

/* ---- connect_jobs --------------------------------------------------- */

async function connectJobs(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const fromId = String(args.from_job_id ?? "");
  const toId = String(args.to_job_id ?? "");
  const [fromJob, toJob] = await Promise.all([
    findJobInProject(fromId, ctx.projectId),
    findJobInProject(toId, ctx.projectId),
  ]);
  if (!fromJob || !toJob) {
    return { ok: false, summary: `Job not found: ${!fromJob ? fromId : toId}` };
  }
  if (fromJob.id === toJob.id) {
    return { ok: false, summary: "Cannot connect a job to itself" };
  }
  const ports =
    args.from_port && args.to_port
      ? { fromPort: String(args.from_port), toPort: String(args.to_port) }
      : defaultPorts(fromJob.type, toJob.type);
  if (!portsValid(fromJob.type, ports.fromPort, toJob.type, ports.toPort)) {
    return {
      ok: false,
      summary: `Port mismatch: ${fromJob.type}:${ports.fromPort ?? "?"} cannot feed ${toJob.type}:${ports.toPort ?? "?"} — check list_job_types for the ports`,
    };
  }
  const duplicate = await db.edge.findUnique({
    where: { fromJobId_toJobId: { fromJobId: fromJob.id, toJobId: toJob.id } },
  });
  if (duplicate) {
    return { ok: true, summary: `${fromJob.name} → ${toJob.name} is already wired` };
  }
  // cycle check — the same detector the edges route uses
  const adj = await allAdjacency();
  const nodes = new Set(adj.keys());
  nodes.add(fromJob.id);
  nodes.add(toJob.id);
  const pairs: { from: string; to: string }[] = [];
  for (const [f, ts] of adj) for (const t of ts) pairs.push({ from: f, to: t });
  pairs.push({ from: fromJob.id, to: toJob.id });
  if (findCycle([...nodes], pairs) !== null) {
    return { ok: false, summary: `Refused: wiring ${fromJob.name} → ${toJob.name} would close a cycle` };
  }
  const edge = await db.edge.create({
    data: { projectId: ctx.projectId, fromJobId: fromJob.id, toJobId: toJob.id },
  });
  return {
    ok: true,
    summary: `Wired ${fromJob.name} → ${toJob.name} (${ports.fromPort} → ${ports.toPort})`,
    detail: { edgeId: edge.id, from: fromJob.id, to: toJob.id },
  };
}

/* ---- delete_job ------------------------------------------------------ */

async function deleteJob(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const confirm = args.confirm === true;
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if ((job.status === "completed" || job.status === "running") && !confirm) {
    return {
      ok: false,
      summary: `${job.name} is ${job.status} — deleting destroys its results. Ask the user, then call again with confirm:true`,
    };
  }
  // stop a running job first (the same branch order the project-delete fix t418 taught)
  if (job.status === "running") {
    const rec = getRun(job.id);
    if (rec?.remote) await remoteStopRun(job.id);
    else await stopRun(job.id);
  }
  await db.edge.deleteMany({ where: { OR: [{ fromJobId: job.id }, { toJobId: job.id }] } });
  await db.job.delete({ where: { id: job.id } });
  return { ok: true, summary: `Deleted ${job.name} (workdir kept on disk — the tombstone semantics)` };
}

/* ---- run_job --------------------------------------------------------- */

async function runJobTool(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if (job.status === "running") {
    return { ok: false, summary: `${job.name} is already running (progress ${(job.progress * 100).toFixed(0)}%)` };
  }
  if (job.linkedJobId) {
    return { ok: false, summary: `${job.name} is a soft link — run its original instead` };
  }
  const mode = args.mode === "local" || args.mode === "cluster" ? args.mode : undefined;

  let remote: ReturnType<typeof projectRemoteTarget> = null;
  if (mode === "cluster" || !mode) {
    remote = projectRemoteTarget(ctx.projectId);
    if (!remote && mode === "cluster") {
      return {
        ok: false,
        summary: "This project has no bound cluster — bind one in the project settings or run with mode 'local'",
      };
    }
  }

  const reRunNote =
    job.status === "completed" ? " NOTE: this re-run WIPES the previous results (previous rounds are archived on the cluster)." : "";
  const outcome = await startJob(job, remote ? { remote } : {});
  if (outcome.error) {
    return { ok: false, summary: `Start refused: ${outcome.error}${reRunNote}` };
  }
  if (outcome.busy) {
    return {
      ok: false,
      summary: `Busy (${outcome.busyKind}): ${outcome.busy}`,
    };
  }
  if (outcome.waiting) {
    return {
      ok: true,
      summary: `${job.name} is waiting: ${outcome.waiting} — it starts automatically when its upstream completes`,
    };
  }
  const lane = outcome.job.status === "running" ? "started" : `status now ${outcome.job.status}`;
  return {
    ok: true,
    summary: `${job.name} ${lane}${remote ? " (cluster lane)" : " (local lane)"}${reRunNote}`,
    detail: { status: outcome.job.status, progress: outcome.job.progress },
  };
}

/* ---- stop_job --------------------------------------------------------- */

async function stopJobTool(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if (job.status !== "running") {
    return { ok: false, summary: `${job.name} is not running (status: ${job.status})` };
  }
  const rec = getRun(job.id);
  const outcome = rec?.remote
    ? await remoteStopRun(job.id)
    : await stopRun(job.id);
  return {
    ok: outcome.stopped,
    summary: outcome.stopped
      ? `${job.name} stopped (${outcome.message})`
      : `Stop failed: ${outcome.message}`,
  };
}

/* ---- inspect_job ------------------------------------------------------ */

async function inspectJob(ctx: AgentCtx, jobId: string): Promise<AiToolResult> {
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  const run = getRun(job.id);

  // key non-default params (the honest set the inspector's Overview shows)
  const spec = jobType(job.type);
  const stored = JSON.parse(job.params || "{}") as Record<string, unknown>;
  const nonDefault: Record<string, unknown> = {};
  for (const p of spec?.params ?? []) {
    if (stored[p.key] !== undefined && String(stored[p.key]) !== String(p.default)) {
      nonDefault[p.key] = stored[p.key];
    }
  }

  // log tail (the last ~25 lines of the local mirror)
  let logTail: string[] = [];
  if (run?.logFile && existsSync(run.logFile)) {
    try {
      const text = readFileSync(run.logFile, "utf8");
      logTail = text.split("\n").filter(Boolean).slice(-25);
    } catch {
      /* unreadable log → empty tail */
    }
  }

  const detail: Record<string, unknown> = {
    job: {
      id: job.id,
      type: job.type,
      name: job.name,
      status: job.status,
      progress: job.progress,
      result: truncate(job.result, 300),
      note: truncate(job.note, 200),
      nonDefaultParams: nonDefault,
    },
    run: run
      ? {
          lane: run.remote ? "cluster" : "local",
          ...(run.remote
            ? {
                host: run.remote.host,
                workdir: run.remote.remoteWorkdir,
                slurmId: run.remote.slurmId ?? null,
              }
            : {}),
          done: run.done ?? null,
          exitCode: run.exitCode ?? null,
        }
      : null,
    logTail,
  };

  // classifications carry their class occupancy
  if (job.type === "class2d" || job.type === "class3d") {
    const workdir =
      run?.workdir ?? path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);
    const stats = classStatsFromWorkdir(workdir);
    if (stats.classes.length > 0) {
      detail.classes = stats.classes.map((c) => ({
        cls: c.cls,
        particles: c.count,
        fraction: Number((c.fraction * 100).toFixed(1)),
        ...(c.resolution != null ? { resolutionA: c.resolution } : {}),
      }));
      detail.iteration = stats.iteration;
      return {
        ok: true,
        summary: `${job.name} (${job.status}): ${stats.classes.length} classes at iteration ${stats.iteration}, ${stats.total} particles${logTail.length > 0 ? `, log tail available` : ""}`,
        detail,
      };
    }
  }
  return {
    ok: true,
    summary: `${job.name} — ${job.type} (${job.status}${job.status === "completed" && job.result ? `: ${truncate(job.result, 120)}` : ""})`,
    detail,
  };
}

/* ---- judge_2d_classes (the VLM tool) ---------------------------------- */

async function judge2dClasses(
  ctx: AgentCtx,
  jobId: string,
  question?: string
): Promise<AiToolResult> {
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if (job.type !== "class2d") {
    return {
      ok: false,
      summary: `judge_2d_classes works on class2d jobs — ${job.name} is ${job.type}. For 3D maps use inspect_job + the FSC/resolution data it carries.`,
    };
  }
  const assistant = resolveAssistant();
  if (!assistant) {
    return { ok: false, summary: "The AI provider is not configured (settings → AI provider) — configure one, then ask again" };
  }

  const run = getRun(job.id);
  const workdir = run?.workdir ?? path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);
  if (!existsSync(workdir)) {
    return { ok: false, summary: `${job.name} has no results yet (status ${job.status}) — run it first` };
  }

  const stats = classStatsFromWorkdir(workdir);
  if (!stats.stackFile || stats.classes.length === 0) {
    return {
      ok: false,
      summary: `${job.name} has no class averages in its workdir yet (iteration ${stats.iteration ?? "none"}) — wait for the run to finish or check its results`,
    };
  }

  // the image — local mirror first, cluster pull when the stack stayed remote
  let stackAbs = path.join(workdir, stats.stackFile);
  if (!existsSync(stackAbs) && run?.remote) {
    const pulled = await fetchRemoteFileIntoWorkdir(run, stats.stackFile);
    if (!pulled.ok) {
      return {
        ok: false,
        summary: `The class stack stayed on the cluster and the pull failed: ${truncate(pulled.error, 200)}`,
      };
    }
  }
  if (!existsSync(stackAbs)) {
    return { ok: false, summary: `Class stack ${stats.stackFile} is not readable on this machine` };
  }
  const sheet = await renderClassSheetPng(stackAbs);
  if (!sheet) {
    return { ok: false, summary: `Could not render ${stats.stackFile} to an image (unreadable MRC?)` };
  }

  // the numbers that ride with the image
  const table = stats.classes
    .map(
      (c) =>
        `class ${c.cls}: ${(c.fraction * 100).toFixed(1)}% (${c.count} particles)${c.resolution != null ? `, estimated resolution ${c.resolution} Å` : ", resolution unknown"}`
    )
    .join("\n");
  const prompt = `You are a senior cryo-EM scientist judging 2D class averages from a RELION 2D classification (iteration ${stats.iteration ?? "?"}, ${stats.total} particles total, ${sheet.rendered} classes shown in the image, left-to-right / top-to-bottom order = class number).

Per-class statistics (class number = grid cell order):
${table}
${question ? `\nThe user asks: ${question}` : ""}

Judge each class: crisp internal structure + strong signal (α-helices, β-sheets, clear boundaries) = "keep"; decent but ambiguous = "maybe"; blurry / junk / ice / carbon / empty = "reject". Small classes can still be good; huge classes that are featureless blobs are reject. Weigh the resolution estimates: lower Å is better when present.

Answer with ONLY a JSON object:
{"classes":[{"cls":1,"verdict":"keep|maybe|reject","reason":"<short>"}],"advice":"<2-3 sentences: overall data quality + which classes to take forward and why>"}`;

  const analysis = await visionOnce({
    flavor: assistant.flavor,
    apiKey: assistant.apiKey,
    model: assistant.vlmModel,
    baseUrl: assistant.baseUrl,
    prompt,
    imageBase64: sheet.png.toString("base64"),
  });

  const verdict = parseJudgeVerdict(analysis);
  const keepCount = verdict ? verdict.classes.filter((c) => c.verdict === "keep").length : 0;
  const maybeCount = verdict ? verdict.classes.filter((c) => c.verdict === "maybe").length : 0;
  return {
    ok: true,
    summary: `Judged ${verdict?.classes.length ?? stats.classes.length} classes of ${job.name} (iteration ${stats.iteration ?? "?"}): ${keepCount} keep / ${maybeCount} maybe — ${truncate(verdict?.advice ?? analysis, 300)}`,
    detail: {
      iteration: stats.iteration,
      judgedClasses: verdict?.classes ?? null,
      advice: verdict?.advice ?? analysis,
      rawAnalysis: verdict ? analysis : undefined,
      classStats: stats.classes,
      nextStep: verdict
        ? `Call select_classes({job_id:"${job.id}", classes:[${verdict.classes.filter((c) => c.verdict === "keep").map((c) => c.cls).join(",")}]}) to wire the selection (confirm with the user first)`
        : undefined,
    },
  };
}

/* ---- select_classes --------------------------------------------------- */

async function selectClasses(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const targetType =
    args.target_type === "initialmodel" || args.target_type === "class3d" || args.target_type === "refine3d"
      ? (args.target_type as string)
      : "select2d";
  const classes = Array.isArray(args.classes)
    ? args.classes.map((c) => Number(c)).filter((c) => Number.isInteger(c) && c > 0 && c <= 10000)
    : [];
  if (classes.length === 0) {
    return { ok: false, summary: "classes must be a non-empty list of class numbers" };
  }
  const source = await findJobInProject(jobId, ctx.projectId);
  if (!source || !(source.type === "class2d" || source.type === "class3d")) {
    return { ok: false, summary: `${jobId} is not a classification job of this project` };
  }
  const unique = [...new Set(classes)].sort((a, b) => a - b);
  const spec = jobType(targetType);
  if (!spec) return { ok: false, summary: `Unknown target type: ${targetType}` };

  // the source's workspace keeps the chain together
  let workspaceId = source.workspaceId ?? null;
  if (!workspaceId) {
    const first = await db.workspace.findFirst({
      where: { projectId: ctx.projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    workspaceId = first?.id ?? (await ensureDefaultWorkspace(ctx.projectId));
  }
  const count = await db.job.count({ where: { projectId: ctx.projectId, type: targetType } });

  const storedParams: Record<string, unknown> = {
    ...defaultParams(targetType),
    classStarSelection: { jobId: source.id, classes: unique },
  };
  const job = await db.job.create({
    data: {
      projectId: ctx.projectId,
      workspaceId,
      type: targetType,
      name: `${spec.label} ${count + 1}`,
      x: source.x + CARD_W + 100,
      y: source.y + Math.round(Math.random() * 40 - 20),
      params: JSON.stringify(storedParams),
      duration: spec.duration,
    },
  });
  const duplicate = await db.edge.findUnique({
    where: { fromJobId_toJobId: { fromJobId: source.id, toJobId: job.id } },
  });
  if (!duplicate) {
    await db.edge.create({
      data: { projectId: ctx.projectId, fromJobId: source.id, toJobId: job.id },
    });
  }
  return {
    ok: true,
    summary: `Created ${job.name} [${job.id}] selecting classes ${unique.join(", ")} from ${source.name} (the per-class stars auto-join on dispatch)`,
    detail: { jobId: job.id, type: targetType, classes: unique },
  };
}
