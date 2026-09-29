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
import { getConnection, loadConnections } from "@/lib/remote/connections";
import { startJob } from "@/lib/relion/dispatch";
import { getRun, latestIterationDataStar, stopRun } from "@/lib/relion/engine";
import { remoteInfoFor, remoteStopRun } from "@/lib/remote/remote-run";
import {
  CONTINUE_FAMILY_TYPES,
  continueSourcesFor,
} from "@/lib/relion/continue-sources";
import {
  checkpointOf,
  continueLaneOf,
  continuePlanOf,
  continueParamWrites,
  iterKnobOf,
  moreOptionsFor,
  selfScanErrorOf,
} from "@/lib/convergence-continue";
import { fetchRemoteFileIntoWorkdir } from "@/lib/remote/remote-files";
import { renderClassSheetPng } from "@/lib/mrc";
import { parseStar } from "@/lib/starfile";
import { RELION_DIR } from "@/lib/paths";
import { resolveAssistant } from "./settings";
import { visionOnce } from "./wire";
import type { ToolSchema } from "./wire";
import { resolveJobTypeKey, typeResolutionNote } from "./type-aliases";
import {
  funnelDoorCandidate,
  funnelLedgerOf,
  funnelLedgerText,
} from "@/lib/particle-funnel";
import {
  joinByName,
  pairedDeltas,
  verdict as pairedVerdict,
  topMovers,
  fmtDelta,
  pairVerdictText,
  DEFAULT_WORDS,
  type LensSpec,
  type VerdictWords,
} from "@/lib/paired-compare";
import { CTF_LENSES, defocusAgreement } from "@/lib/ctf-compare";
import { MOTION_LENSES } from "@/lib/motion-compare";
import {
  CLASS_LENSES,
  CLASS_DEFAULT_LENS,
  CLASS_WORDS,
  classRunRow,
  concentrationCensus,
} from "@/lib/class-compare";
import { ctfMicrographRows, motionCatalogueRows } from "@/lib/compare-rows";
import {
  arcPresentationOf,
  arcSummary as arcSummaryOf,
  arcVerdict as arcVerdictOf,
  biggestJump,
  resolutionArcOf,
} from "@/lib/resolution-arc";
import {
  defaultRoundPair,
  movingCensus,
  roundLabel,
} from "@/lib/convergence";
import {
  resolutionArcFromWorkdir,
  roundOccupancy,
  workdirRounds,
} from "@/lib/convergence-rows";

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
    name: "list_clusters",
    description:
      "Read the SSH cluster registry — the Remote clusters dialog's own roll call: each saved connection's name, host, auth shape (booleans only, never secrets), remote root, Slurm flag, default RELION module, its LAST probe's truth (reachable / probe-failed with the error line / never-tested — each probe block carries checkedAt; quote the timestamp when health matters, clusters are probed when tested or dispatched, never by this read) and whether the ACTIVE project is bound to it. Also answers 'which cluster would run_job mode:'cluster' dispatch to?' via the project binding.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_funnel_chain",
    description:
      "Read the particle funnel LEDGER of a chain — the same cross-job story the UI's funnel dialog and its Copy-ledger button export: per-station counts (micrographs/picks/particles, class counts), the edge verbs BETWEEN stations (carry / shed with percentages / gain with factors / transform), the off-mainline census, and the closing postprocess resolution when one ends the chain. THE tool for '我的粒子都去哪了 / why did my particle count drop / summarize what this chain produced' — read the ledger before answering any count question, never arithmetic from per-job receipts. Omit job_id to read the crown chain (the deepest finished funnel verb on the canvas); pass job_id to read the chain around a specific verb (unfinished stations honestly report their status instead of counts).",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Optional — a verb on the chain to read (any status). Omit for the crown chain.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "compare_jobs",
    description:
      "Paired A/B verdict between two completed runs of the SAME stage — the compare dialog's own brain, read by the agent: CTF fit quality (ctffind), Motion drift (motioncorr) or 2D/3D class occupancy (class2d/class3d). The domain is detected from the two jobs' type; the lens defaults per domain (fom / total drift / occupancy share) or pass lens explicitly. Returns the verdict counts in the domain's OWN words (improved/regressed/unchanged for quality; gained/lost/held for occupancy — a class that gained particles did not 'improve', the population moved), the median delta, the named top movers, the unpaired non-voters and the pairing's health line. THE tool for '哪次跑更好 / did my new params help / 比较 / which run is better' — a compare question is a READ, never arithmetic from two receipts.",
    parameters: {
      type: "object",
      properties: {
        job_a: {
          type: "string",
          description: "The A run's job id (get_workflow_state lists ids).",
        },
        job_b: {
          type: "string",
          description: "The B run's job id — the SAME stage as A.",
        },
        lens: {
          type: "string",
          description: "Optional lens key: ctf fom|maxres|astig · motion total|early|late · class share. Defaults per domain (fom / total / share).",
        },
      },
      required: ["job_a", "job_b"],
      additionalProperties: false,
    },
  },
  {
    name: "check_convergence",
    description:
      "One run compared with ITSELF across its own iterations — the convergence family's reading, read by the agent (the class-convergence dialog's census + the resolution-arc dialog's plateau verdict, t454/t456/t459): did the classification settle (which classes still move particles between two rounds), and is the estimate still sharpening (per-round resolution arc — gold FSC for refine3d, the model's own estimate for class2d/class3d). The default pair is the run's WHOLE arc (earliest vs latest round); pass round_a/round_b to ask any two. Returns the census in the domain's own words (gained/lost/held + 'settled / mostly settled / still re-shuffling') and the arc's verdict ('plateaued / still improving / still moving'). THE tool for '收敛了吗 / did it converge / has it settled / is it still improving / plateau' — a convergence question is a READ of the run's own rounds, never arithmetic from two receipts. For comparing two DIFFERENT runs use compare_jobs instead.",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "The run's job id (get_workflow_state lists ids).",
        },
        round_a: {
          type: "number",
          description: "Optional earlier round (iteration number). Default: the run's first round.",
        },
        round_b: {
          type: "number",
          description: "Optional later round (iteration number). Default: the run's last round.",
        },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_job",
    description:
      "Create one job on the canvas. Pass connect_from (an upstream job id) to draw the wire automatically (ports auto-picked, cycle-safe). params may carry schema keys only (unknown keys drop). Position is auto-computed right of the source / right of the canvas content.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Job type key (from list_job_types; Chinese stage names like 运动/CTF/挑选 resolve to canonical keys), e.g. motioncorr" },
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
    name: "build_pipeline",
    description:
      "Create a whole CHAIN of jobs in ONE call: steps are created in order and wired head-to-tail (ports auto-picked, cycle-safe). Prefer this over repeated create_job when the user asks for a multi-job flow ('搭一个完整流程'). All types are validated BEFORE anything is created; a refused wire (no compatible port pair) is reported per step and the chain keeps building.",
    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          maxItems: 12,
          description: "Ordered chain steps, e.g. [motioncorr, ctffind, manualpick, extract, class2d]. Chinese stage names (导入/运动/CTF/挑选/2D分类…) resolve to their canonical keys.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "Job type key (from list_job_types)" },
              name: { type: "string", description: "Optional custom name (≤120 chars)" },
              params: {
                type: "object",
                additionalProperties: true,
                description: "Param overrides keyed by the type's schema (get_job_params)",
              },
            },
            required: ["type"],
          },
        },
        connect_from: { type: "string", description: "Optional upstream job id to wire the FIRST step from" },
      },
      required: ["steps"],
      additionalProperties: false,
    },
  },
  {
    name: "wait_for_jobs",
    description:
      "Wait for jobs to SETTLE (leave running/pending) up to a timeout, then report each job's status, progress and result line. Call after run_job to catch quick completions and immediate failures within the same conversation turn. Jobs still running at the timeout are reported honestly with progress — never claim a job finished while it runs; check later with inspect_job.",
    parameters: {
      type: "object",
      properties: {
        job_ids: { type: "array", items: { type: "string" }, maxItems: 10 },
        timeout_sec: { type: "number", description: "Max seconds to wait (default 45, max 180)" },
      },
      required: ["job_ids"],
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
      "Start a job's REAL run. mode: 'local' forces the local RELION lane; 'cluster' uses the project's bound SSH cluster; omitted picks the project's default. Re-running a completed job WIPES its previous results — only run what the user asked for; to extend a finished refine-family run use continue_run instead (it resumes from the checkpoint instead of wiping). Downstream pending jobs auto-start when their upstream completes.",
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
    name: "continue_run",
    description:
      "Continue a finished refine-family run (class2d/class3d/refine3d/initialmodel/multibody) with MORE iterations — RELION's own restart idiom: the run resumes from its NEWEST COMPLETE checkpoint (run_itNNN_optimiser.star) and the --iter total extends to current + more, clamped to the form's ceiling. This is NOT run_job: a re-run WIPES the previous results, a continue RESUMES from them — when check_convergence says 'still improving' and the user asks for more rounds ('还要继续跑', 'continue with more iterations'), this is the verb. The lane is the job's OWN lane (a cluster checkpoint continues on the cluster that wrote it). Refuses honestly when the run directory holds no complete optimiser family, the dialect has no --iter knob (RELION's auto-refine owns its own convergence), or the type is outside the refine family.",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "The finished run's job id (check_convergence's subject).",
        },
        more: {
          type: "number",
          description:
            "Optional — how many MORE iterations (default: the convergence dialog's first chip — 5 EM epochs or 50 VDAM mini-batches). RELION's --iter is the TOTAL: the written value is current + more.",
        },
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
      case "list_clusters":
        return await listClustersTool(ctx);
      case "get_funnel_chain":
        return await getFunnelChain(ctx, typeof args.job_id === "string" ? args.job_id : "");
      case "compare_jobs":
        return await compareJobs(ctx, args);
      case "check_convergence":
        return await checkConvergence(ctx, args);
      case "create_job":
        return await createJob(ctx, args);
      case "build_pipeline":
        return await buildPipeline(ctx, args);
      case "wait_for_jobs":
        return await waitForJobs(ctx, args);
      case "update_job":
        return await updateJob(ctx, args);
      case "connect_jobs":
        return await connectJobs(ctx, args);
      case "delete_job":
        return await deleteJob(ctx, args);
      case "run_job":
        return await runJobTool(ctx, args);
      case "continue_run":
        return await continueRunTool(ctx, args);
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
  const resolved = resolveJobTypeKey(type);
  const spec = resolved.key ? jobType(resolved.key) : undefined;
  if (!spec) return { ok: false, summary: `Unknown job type: ${type} — call list_job_types for the catalog` };
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
    summary: `${spec.key}: ${params.length} params across tabs ${[...new Set(params.map((p) => p.tab))].join(", ")}${typeResolutionNote(resolved)}`,
    detail: { job_type: spec.key, params },
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

/* ---- list_clusters ------------------------------------------------- */

async function listClustersTool(ctx: AgentCtx): Promise<AiToolResult> {
  const conns = loadConnections();
  const active = await getActiveProject();
  const boundId = active?.meta.remote?.connectionId ?? null;
  const boundConn = boundId ? conns.find((c) => c.id === boundId) ?? null : null;

  if (conns.length === 0) {
    return {
      ok: true,
      summary: boundId
        ? `No clusters in the registry — the project still points at connection ${boundId}, which no longer exists`
        : "No clusters in the registry — save one in the Remote clusters dialog first",
      detail: {
        projectBinding: boundId ? { connectionId: boundId, missing: true } : null,
        roster: [],
        note: "runs can still go mode:'local' — the cluster roster is empty",
      },
    };
  }

  const roster = conns.map((c) => {
    const p = c.lastProbe;
    return {
      id: c.id,
      name: c.name || `${c.username}@${c.host}`,
      host: `${c.username}@${c.host}:${c.port}`,
      // the dialog DTO's secret shape: booleans only, never the secrets
      auth: { method: c.authMethod, hasPassword: !!c.password, hasPassphrase: !!c.passphrase },
      remoteRoot: c.remoteRoot,
      useSlurm: c.useSlurm,
      defaultModule: c.defaultModule,
      projectBound: c.id === boundId,
      probe: p
        ? {
            // the dialog rail's three-word law (t268's probeDot): reachable /
            // probe-failed / never-tested — a probe's truth has a birthday
            state: p.ok ? "reachable" : "probe-failed",
            checkedAt: p.checkedAt,
            durationMs: p.durationMs ?? null,
            error: p.ok ? null : (p.error ?? "the probe failed without a reason line"),
            moduleSystem: p.moduleSystem,
            relionModules: p.relionModules,
            slurm: p.slurm === true,
            gpus: p.gpus?.length ?? 0,
          }
        : null,
    };
  });

  const reachable = roster.filter((r) => r.probe?.state === "reachable").length;
  const boundName = boundConn ? boundConn.name || `${boundConn.username}@${boundConn.host}` : null;
  const summary =
    `${roster.length} cluster${roster.length === 1 ? "" : "s"} in the registry, ${reachable} reachable by last probe; ` +
    (boundName
      ? `the active project dispatches to "${boundName}" (run_job mode:'cluster')`
      : boundId
        ? `the project still points at connection ${boundId}, which no longer exists — rebind in the project panel before dispatching`
        : "the active project has no cluster bound (mode:'cluster' would refuse)");

  return {
    ok: true,
    summary,
    detail: {
      projectBinding: boundId ? { connectionId: boundId, name: boundName, missing: !boundConn } : null,
      roster,
      note: "probe facts are the LAST probe's truth — quote checkedAt when health matters; a fresh probe is the dialog's Test button or the dispatch's own gate, not this read",
    },
  };
}

/* ---- get_funnel_chain ------------------------------------------------- */

/**
 * t468 — the agent reads the LEDGER. The funnel dialog and its Copy-ledger
 * button are the UI's own doors onto the cross-job story (t460–t463); this
 * tool runs the SAME pure brains on the SAME DB shape the funnel route
 * fetches — the assistant never gets a private read path the product
 * doesn't already trust (t419 design law).
 *
 * Door semantics mirror the canvas door (funnelDoorCandidate): no job_id →
 * the crown chain (deepest finished funnel verb, deterministic); a named
 * job_id → the chain around that verb, ANY status — unfinished stations
 * speak as honest status rows (the pure brain's own contract), so the
 * agent can read a chain while it runs and never invents a receipt.
 */
async function getFunnelChain(ctx: AgentCtx, jobId: string): Promise<AiToolResult> {
  const [jobs, edges] = await Promise.all([
    db.job.findMany({
      where: { projectId: ctx.projectId },
      select: { id: true, type: true, name: true, status: true, result: true, updatedAt: true },
    }),
    db.edge.findMany({ where: { projectId: ctx.projectId }, select: { fromJobId: true, toJobId: true } }),
  ]);

  const named = jobId.trim();
  let enteredId: string;
  let picked: "crown" | "named";
  // the pure brains speak ISO strings (the store's dialect) — Prisma rows
  // carry Date, so the translation happens once, here at the boundary
  const funnelJobs = jobs.map((j) => ({
    id: j.id,
    type: j.type,
    name: j.name,
    status: j.status,
    result: j.result,
    updatedAt: j.updatedAt ? j.updatedAt.toISOString() : null,
  }));
  if (named) {
    if (!jobs.some((j) => j.id === named)) {
      return {
        ok: false,
        summary: `No job with id "${truncate(named, 48)}" on this canvas — call get_workflow_state first and pass a real job id.`,
      };
    }
    enteredId = named;
    picked = "named";
  } else {
    const door = funnelDoorCandidate(funnelJobs, []);
    if (door.kind === "blocked") {
      return { ok: false, summary: door.line };
    }
    enteredId = door.job.id;
    picked = "crown";
  }

  const ledger = funnelLedgerOf({ jobs, edges, enteredId });
  if (!ledger || ledger.rows.length === 0) {
    return {
      ok: false,
      summary: "No funnel reads from that verb — it sits outside every wire's lineage on this canvas.",
    };
  }

  const entered = jobs.find((j) => j.id === enteredId)!;
  const ledgerText = funnelLedgerText(ledger, entered.name);
  const statusById = new Map(jobs.map((j) => [j.id, j.status]));
  const unfinished = ledger.rows
    .filter((r) => statusById.get(r.jobId) !== "completed")
    .map((r) => ({ id: r.jobId, name: r.name, type: r.type, status: statusById.get(r.jobId) ?? "unknown" }));

  const countRows = ledger.rows.filter((r) => r.kind === "ok" && r.count != null);
  const head = `Funnel of "${entered.name}" [${entered.type}] — ${ledger.headline} (${countRows.length} counted station${countRows.length === 1 ? "" : "s"} on the mainline${ledger.offMainline.length ? `, ${ledger.offMainline.length} off-mainline` : ""})`;
  const summary = unfinished.length
    ? `${head} — ${unfinished.length} station${unfinished.length === 1 ? " has" : "s have"} no receipt yet: ${unfinished.map((u) => `${u.name} (${u.status})`).join(", ")}. The numbers below cover finished stations only.`
    : head;

  return {
    ok: true,
    summary,
    detail: {
      picked,
      entered: { id: entered.id, type: entered.type, name: entered.name, status: entered.status },
      ledgerText,
      headline: ledger.headline,
      note: ledger.note,
      stations: ledger.rows.map((r) => ({
        id: r.jobId,
        type: r.type,
        name: r.name,
        kind: r.kind,
        count: r.count,
        unit: r.unit,
        classes: r.classes,
        perMic: r.perMic,
        edge: r.delta?.line ?? null,
      })),
      offMainline: ledger.offMainline,
      closing: ledger.closing,
      ...(unfinished.length ? { unfinished } : {}),
    },
  };
}

/* ---- compare_jobs ----------------------------------------------------- */

/** The compare family's domains, spoken by type. The dialog's own
 *  typeGates (run-compare-dialog): /ctffind|ctf/, /motioncorr|motion/,
 *  /class2d|class3d/ — the agent detects the SAME domain from the SAME
 *  type, never from the user's phrasing. */
function compareDomainOf(type: string): "ctf" | "motion" | "class" | null {
  if (/ctffind|ctf/i.test(type)) return "ctf";
  if (/motioncorr|motion/i.test(type)) return "motion";
  if (/class2d|class3d/i.test(type)) return "class";
  return null;
}

interface CompareDomainShape<R> {
  label: string;
  lenses: Record<string, LensSpec<R>>;
  defaultLens: string;
  words: VerdictWords;
  rowsOf(workdir: string): R[];
  /** The pairing's own health check, pre-formatted (null hides — the
   *  motion domain's count chips are its health, it has no line). */
  trustLine?(pairs: { a: R; b: R }[]): string | null;
}

/** One shape per domain — each field is the DIALOG's own spec value,
 *  imported from the domain modules, never re-typed here. */
const COMPARE_DOMAINS: Record<string, CompareDomainShape<never>> = {
  ctf: {
    label: "CTF",
    lenses: CTF_LENSES,
    defaultLens: "fom",
    words: DEFAULT_WORDS,
    // CtfMicrograph is a superset of CtfRunRow — the dialog feeds route
    // rows straight in, the tool feeds lib rows the same way
    rowsOf: (wd) => ctfMicrographRows(wd) as never[],
    trustLine: (pairs) => {
      const v = defocusAgreement(pairs as never[]);
      return `Defocus agreement: median |Δ| = ${
        Number.isFinite(v) ? `${v.toFixed(3)} µm` : "—"
      } across ${pairs.length} paired micrographs — the pairing's own health check.`;
    },
  },
  motion: {
    label: "Motion",
    lenses: MOTION_LENSES,
    defaultLens: "total",
    words: DEFAULT_WORDS,
    rowsOf: (wd) => motionCatalogueRows(wd).micrographs as never[],
  },
  class: {
    label: "Class",
    lenses: CLASS_LENSES,
    defaultLens: CLASS_DEFAULT_LENS,
    words: CLASS_WORDS,
    rowsOf: (wd) =>
      classStatsFromWorkdir(wd).classes.map((c) =>
        classRunRow({ cls: c.cls, count: c.count, fraction: c.fraction }),
      ) as never[],
    trustLine: (pairs) => concentrationCensus(pairs as never[]),
  },
};

/**
 * t469 — the agent reads the PAIR VERDICT. The compare dialog (t439/t440/
 * t453) is the UI's own door onto "did my new params help"; this tool runs
 * the SAME brain on the SAME rows: the shared join/deltas/verdict/movers
 * (lib/paired-compare.ts), the domains' own lenses and word laws
 * (ctf/motion/class-compare.ts), the rows from the ONE shared grammar
 * (lib/compare-rows.ts — the same functions the ctf/motion routes call).
 * No private brain, no private read path (t419 law, third read tool).
 *
 * Door semantics mirror the dialog's guard: both runs completed, same
 * type, a compare domain exists — every refusal says WHY and names the
 * fix, never a fabricated verdict.
 */
async function compareJobs(
  ctx: AgentCtx,
  args: { job_a?: unknown; job_b?: unknown; lens?: unknown },
): Promise<AiToolResult> {
  const aId = typeof args.job_a === "string" ? args.job_a.trim() : "";
  const bId = typeof args.job_b === "string" ? args.job_b.trim() : "";
  if (!aId || !bId) {
    return {
      ok: false,
      summary:
        "compare_jobs needs BOTH job ids — call get_workflow_state first and pass two real job ids.",
    };
  }

  const jobs = await db.job.findMany({
    where: { projectId: ctx.projectId },
    select: { id: true, type: true, name: true, status: true, projectId: true },
  });
  const a = jobs.find((j) => j.id === aId);
  const b = jobs.find((j) => j.id === bId);
  if (!a || !b) {
    const missing = !a ? aId : bId;
    return {
      ok: false,
      summary: `No job with id "${truncate(missing, 48)}" on this canvas — call get_workflow_state first and pass real job ids.`,
    };
  }
  if (aId === bId) {
    return {
      ok: false,
      summary: `"${a.name}" cannot pair with itself — one run against itself is the convergence question (inspect_job reads its iterations), while compare_jobs speaks pairs of runs.`,
    };
  }

  const domA = compareDomainOf(a.type);
  const domB = compareDomainOf(b.type);
  if (!domA || !domB || domA !== domB) {
    return {
      ok: false,
      summary: `These two jobs do not share a compare domain — "${a.name}" is ${a.type}, "${b.name}" is ${b.type}. The compare family speaks CTF (ctffind), Motion (motioncorr) and class occupancy (class2d/class3d); pair two completed runs of the SAME stage.`,
    };
  }
  const domain = COMPARE_DOMAINS[domA] as unknown as CompareDomainShape<Record<string, unknown> & { name: string }>;

  // the dialog's door guard: entries render nothing unless the host is a
  // completed run of the domain's type AND a completed sibling exists
  for (const j of [a, b]) {
    if (j.status !== "completed") {
      return {
        ok: false,
        summary: `"${j.name}" is ${j.status} — the pair verdict speaks only between two COMPLETED runs (a running run has no receipts to pair). Check again with inspect_job or wait_for_jobs.`,
      };
    }
  }

  // the same workdir resolution inspect_job speaks: engine record first,
  // then the computed RELION_DIR layout (dispatched-but-persisted jobs)
  const workdirOf = (j: { id: string; type: string; projectId: string }) => {
    const run = getRun(j.id);
    return (
      run?.workdir ?? path.join(RELION_DIR, j.projectId, `${j.type}_${j.id.slice(-8)}`)
    );
  };

  const rowsA = domain.rowsOf(workdirOf(a));
  const rowsB = domain.rowsOf(workdirOf(b));
  if (rowsA.length === 0 || rowsB.length === 0) {
    const cold = rowsA.length === 0 ? a : b;
    return {
      ok: false,
      summary: `"${cold.name}" has no ${domain.label} rows in its workdir (status completed, but the ${domain.label} outputs are missing${getRun(cold.id)?.remote ? " — this run lived on a cluster and its mirror is cold" : ""}). The verdict needs two finished runs' outputs.`,
    };
  }

  const lensKey = typeof args.lens === "string" && args.lens.trim() ? args.lens.trim() : domain.defaultLens;
  const lens = domain.lenses[lensKey] as LensSpec<{ name: string }> | undefined;
  if (!lens) {
    const keys = Object.keys(domain.lenses).join("|");
    return {
      ok: false,
      summary: `Lens "${truncate(args.lens as string, 32)}" is not one of the ${domain.label} domain's lenses (${keys}) — retry with one of those, or omit lens for the default (${domain.defaultLens}).`,
    };
  }

  const join = joinByName(rowsA, rowsB);
  if (join.pairs.length === 0) {
    return {
      ok: false,
      summary: `No shared names between the two runs — ${rowsA.length} rows in "${a.name}", ${rowsB.length} in "${b.name}", none paired. A pair verdict joins on the row name; these runs saw different inputs, so there is nothing to compare.`,
    };
  }

  const deltas = pairedDeltas(join.pairs as never, lens as never);
  const v = pairedVerdict(deltas);
  const movers = topMovers(deltas);
  const verdictText = pairVerdictText({
    domainLabel: domain.label,
    nameA: a.name,
    nameB: b.name,
    lensLabel: lens.label,
    unit: lens.unit,
    digits: lens.digits,
    higherIsBetter: lens.higherIsBetter,
    words: domain.words,
    verdict: v,
    movers,
    onlyA: join.onlyA,
    onlyB: join.onlyB,
  });
  const trustLine = domain.trustLine?.(join.pairs as never) ?? null;

  const summary = `"${a.name}" vs "${b.name}" — ${join.pairs.length} paired · ${v.improved} ${domain.words.better} / ${v.regressed} ${domain.words.worse} / ${v.tied} ${domain.words.same} · median Δ ${fmtDelta(v.medianDelta, lens.digits)}${lens.unit} (${lens.label})`;

  return {
    ok: true,
    summary,
    detail: {
      domain: domA,
      lens: lens.key,
      runs: [a, b].map((j) => ({ id: j.id, name: j.name, type: j.type, status: j.status })),
      verdict: v,
      movers: {
        improvers: movers.improvers.map((d) => ({ name: d.name, a: d.a, b: d.b, delta: d.delta })),
        regressors: movers.regressors.map((d) => ({ name: d.name, a: d.a, b: d.b, delta: d.delta })),
      },
      unpaired: { onlyA: join.onlyA.length, onlyB: join.onlyB.length },
      trustLine,
      verdictText,
    },
  };
}

/* ---- check_convergence ----------------------------------------------- */

/**
 * t470 — the agent reads the SETTLED QUESTION. The convergence family's
 * two faces (t454's class census, t456/t459's resolution arc) compare ONE
 * run with ITSELF at two of its own rounds. This tool runs the SAME brains
 * on the SAME rows: the class-convergence dialog's chain (joinByName +
 * pairedDeltas on the share lens + verdict/topMovers + movingCensus) and
 * the resolution-arc route's own scan (convergence-rows.ts) + the plateau
 * law. No private brain, no private read path (t419 law, fourth read tool).
 *
 * Door semantics mirror the dialogs' guards: a COMPLETED run of a type the
 * arc family speaks (refine3d gold; class2d/class3d serial), at least two
 * settled rounds on the ladder, two DISTINCT real rounds. The census is
 * the classification domain's question only (the dialog never opened for
 * refine3d — a refinement's single-class data star has no population to
 * move); the arc answers the refinement. Every refusal says WHY and names
 * the fix.
 */
async function checkConvergence(
  ctx: AgentCtx,
  args: { job_id?: unknown; round_a?: unknown; round_b?: unknown },
): Promise<AiToolResult> {
  const jobId = typeof args.job_id === "string" ? args.job_id.trim() : "";
  if (!jobId) {
    return {
      ok: false,
      summary:
        "check_convergence needs a job id — call get_workflow_state first and pass a real job id.",
    };
  }
  const jobs = await db.job.findMany({
    where: { projectId: ctx.projectId },
    select: { id: true, type: true, name: true, status: true, projectId: true },
  });
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    return {
      ok: false,
      summary: `No job with id "${truncate(jobId, 48)}" on this canvas — call get_workflow_state first and pass a real job id.`,
    };
  }

  const presentation = arcPresentationOf(job.type);
  if (!presentation) {
    return {
      ok: false,
      summary: `"${job.name}" is ${job.type} — the convergence family speaks refinement (refine3d, the gold-standard FSC arc) and classification (class2d/class3d, the occupancy census plus the model's own estimate). A run cannot converge where there is no per-round arc.`,
    };
  }
  if (job.status !== "completed") {
    return {
      ok: false,
      summary: `"${job.name}" is ${job.status} — the convergence reading speaks a run's SETTLED rounds (a running run's rounds are still being written). Check again with inspect_job or wait_for_jobs, then ask.`,
    };
  }

  // the same workdir resolution inspect_job and compare_jobs speak
  const run = getRun(job.id);
  const workdir =
    run?.workdir ?? path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);

  // each dialect's door is its OWN dialog's door: the census gate reads
  // the data-star ladder (the convergence dialog's rounds), the arc gate
  // reads the model stars (the resolution-arc dialog's points)
  const rounds = workdirRounds(workdir);
  const arc = resolutionArcOf(resolutionArcFromWorkdir(workdir));
  const arcVerdict = arcVerdictOf(arc);

  if (presentation.dialect === "gold") {
    if (arc.length < 2) {
      return {
        ok: false,
        summary:
          rounds.length > 0
            ? `"${job.name}" wrote ${rounds.length} data-star rounds but no model stars with _rlnCurrentResolution — the refinement's arc has no estimates to read. The run's outputs are missing their model family.`
            : `"${job.name}" has no iteration rounds and no model stars with _rlnCurrentResolution in its workdir (status completed${run?.remote ? " — this run lived on a cluster and its mirror is cold" : ""}). The refinement's arc has no estimates to read.`,
      };
    }
    if (
      (typeof args.round_a === "number" && Number.isFinite(args.round_a)) ||
      (typeof args.round_b === "number" && Number.isFinite(args.round_b))
    ) {
      return {
        ok: false,
        summary: `"${job.name}" is a refinement — its arc reads the run's WHOLE journey (the plateau law watches the last moves); round pairs are the classification census's question. Call again without round_a/round_b.`,
      };
    }
  } else {
    if (rounds.length === 0) {
      return {
        ok: false,
        summary: `"${job.name}" has no iteration rounds in its workdir (status completed, but no run_itNNN_data.star landed${run?.remote ? " — this run lived on a cluster and its mirror is cold" : ""}). The convergence reading reads the run's own rounds; there are none to read.`,
      };
    }
    if (rounds.length < 2) {
      return {
        ok: false,
        summary: `"${job.name}" has only one settled round (${roundLabel(rounds[0])}) — a convergence reading needs at least two iterations to compare.`,
      };
    }
  }

  // the census — the classification domain's own question. The default
  // pair is the run's WHOLE arc (the dialog's own law); explicit rounds
  // override that end. Gold speaks the arc alone — no pair, no census.
  let census: {
    verdict: { improved: number; regressed: number; tied: number; medianDelta: number };
    movers: { improvers: { name: string; delta: number }[]; regressors: { name: string; delta: number }[] };
    unpaired: { onlyA: number; onlyB: number };
    censusLine: string | null;
    censusText: string;
  } | null = null;
  let roundA = 0;
  let roundB = 0;

  if (presentation.dialect === "serial") {
    const def = defaultRoundPair(rounds)!;
    const wantA = typeof args.round_a === "number" && Number.isFinite(args.round_a) ? args.round_a : def.a;
    const wantB = typeof args.round_b === "number" && Number.isFinite(args.round_b) ? args.round_b : def.b;
    for (const want of [wantA, wantB]) {
      if (!rounds.includes(want)) {
        const ladder = rounds.map((r) => roundLabel(r)).join(", ");
        return {
          ok: false,
          summary: `${roundLabel(want)} is not one of this run's rounds — the ladder holds ${rounds.length} rounds: ${ladder}. Pick two of those as round_a/round_b, or omit both for the whole arc (${roundLabel(def.a)} vs ${roundLabel(def.b)}).`,
        };
      }
    }
    if (wantA === wantB) {
      return {
        ok: false,
        summary: `${roundLabel(wantA)} paired with itself has no arc — a convergence reading needs two DISTINCT rounds of one run. The run's ladder spans ${roundLabel(rounds[0])} to ${roundLabel(rounds[rounds.length - 1])}.`,
      };
    }
    [roundA, roundB] = wantA < wantB ? [wantA, wantB] : [wantB, wantA];

    const occA = roundOccupancy(workdir, roundA);
    const occB = roundOccupancy(workdir, roundB);
    const dead = !occA || !occB || occA.classes.length === 0 || occB.classes.length === 0;
    if (dead) {
      const which = !occA || occA.classes.length === 0 ? roundLabel(roundA) : roundLabel(roundB);
      return {
        ok: false,
        summary: `${which}'s data star holds no class rows (the round may have died mid-write) — the census refuses rather than guess. Try a different pair of the run's ${rounds.length} rounds.`,
      };
    }
    const join = joinByName(occA.classes, occB.classes);
    if (join.pairs.length === 0) {
      return {
        ok: false,
        summary: `No shared class numbers between ${roundLabel(roundA)} and ${roundLabel(roundB)} — a convergence reading joins the same classes across two rounds of ONE run; these rounds hold different class inventories (${occA.classes.length} vs ${occB.classes.length}), so there is nothing to pair.`,
      };
    }
    const lens = CLASS_LENSES.share as LensSpec<{ name: string }>;
    const deltas = pairedDeltas(join.pairs as never, lens as never);
    const v = pairedVerdict(deltas);
    const movers = topMovers(deltas);
    const censusLine = movingCensus(deltas as never, { aRound: roundA, bRound: roundB });
    const censusText =
      pairVerdictText({
        domainLabel: "Class occupancy",
        nameA: roundLabel(roundA),
        nameB: roundLabel(roundB),
        lensLabel: lens.label,
        unit: lens.unit,
        digits: lens.digits,
        higherIsBetter: lens.higherIsBetter,
        words: CLASS_WORDS,
        verdict: v,
        movers,
        onlyA: join.onlyA,
        onlyB: join.onlyB,
      }) + (censusLine ? `\n${censusLine}` : "");
    census = {
      verdict: v,
      movers: {
        improvers: movers.improvers.map((d) => ({ name: d.name, delta: d.delta })),
        regressors: movers.regressors.map((d) => ({ name: d.name, delta: d.delta })),
      },
      unpaired: { onlyA: join.onlyA.length, onlyB: join.onlyB.length },
      censusLine,
      censusText,
    };
  }

  // the arc — the estimate per round, gold or serial by the type's dialect
  const arcReading =
    arc.length >= 2
      ? {
          points: arc.length,
          from: { iteration: arc[0].iteration, resolution: arc[0].resolution },
          to: {
            iteration: arc[arc.length - 1].iteration,
            resolution: arc[arc.length - 1].resolution,
          },
          best: arc.reduce((b, p) => (p.resolution < b.resolution ? p : b), arc[0]),
          verdictWord: arcVerdict?.word ?? null,
          verdictDetail: arcVerdict?.detail ?? null,
          summary: arcSummaryOf(arc),
          biggestJump: (() => {
            const j = biggestJump(arc);
            return j
              ? {
                  from: j.from.iteration,
                  to: j.to.iteration,
                  delta: Number(j.delta.toFixed(2)),
                }
              : null;
          })(),
          estimateLabel: presentation.estimateLabel,
        }
      : null;

  if (presentation.dialect === "serial" && !arcReading) {
    // the census alone is a complete reading (t454's face had no arc);
    // the honest note says why the second half stays silent
    if (census) census.censusText += "\nNo model stars with _rlnCurrentResolution — this run wrote no per-round estimates, so there is no arc to read alongside the census.";
  }

  // the summary — one line, the domain's own words
  const arcNote = arcReading
    ? `${arcReading.summary}${arcReading.verdictWord ? ` (${arcReading.verdictWord})` : ""}`
    : null;
  const censusEnding = census?.censusLine
    ? census.censusLine.replace(/^.* — /, "").replace(/\.$/, "")
    : "";
  const summary = census
    ? `"${job.name}" ${presentation.noun} — ${census.verdict.improved} ${CLASS_WORDS.better} / ${census.verdict.regressed} ${CLASS_WORDS.worse} / ${census.verdict.tied} ${CLASS_WORDS.same} between ${roundLabel(roundA)} and ${roundLabel(roundB)} (${censusEnding})${arcNote ? ` · arc ${arcNote}` : ""}`
    : `"${job.name}" ${presentation.noun} — ${arcNote ?? "no arc"}`;

  return {
    ok: true,
    summary,
    detail: {
      job: { id: job.id, name: job.name, type: job.type, status: job.status },
      dialect: presentation.dialect,
      noun: presentation.noun,
      rounds,
      pair: presentation.dialect === "serial" ? { a: roundA, b: roundB } : null,
      census,
      arc: arcReading,
    },
  };
}

/* ---- create_job ----------------------------------------------------- */

/** What one job creation produced — shared by create_job and build_pipeline. */
interface CreateOneOutcome {
  ok: boolean;
  summary: string;
  jobId: string | null;
  jobName: string | null;
  /** True when a connect_from was requested AND the wire landed. */
  wired: boolean;
  dropped: string[];
  /** The created row (null when refused) — create_job DTOs it. */
  job: PrismaJob | null;
}

async function createOneJob(
  ctx: AgentCtx,
  opts: {
    type: string;
    name?: string;
    params?: unknown;
    connectFromId?: string | null;
    x?: number;
    y?: number;
  }
): Promise<CreateOneOutcome> {
  const fail = (summary: string): CreateOneOutcome => ({
    ok: false,
    summary,
    jobId: null,
    jobName: null,
    wired: false,
    dropped: [],
    job: null,
  });
  // t463 — the alias ladder: models (and users) say "ctf" / "2d分类" / "motion"
  // for the canonical keys. Resolve here so create_job AND build_pipeline
  // both recover instead of refusing; the resolution note rides every summary.
  const resolved = resolveJobTypeKey(opts.type);
  const spec = resolved.key ? jobType(resolved.key) : undefined;
  if (!spec) return fail(`Unknown job type: ${opts.type} — call list_job_types for the catalog`);
  const typeKey = spec.key;
  const typeNote = typeResolutionNote(resolved);

  const { filtered, dropped } = filterParamsForSpec(typeKey, opts.params);

  let connectFrom: PrismaJob = null;
  if (opts.connectFromId) {
    connectFrom = await findJobInProject(opts.connectFromId, ctx.projectId);
    if (!connectFrom) {
      return fail(
        `connect_from job not found in this project: ${opts.connectFromId} — call get_workflow_state for the real ids`
      );
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
  const x = typeof opts.x === "number" && Number.isFinite(opts.x) ? opts.x : auto.x;
  const y = typeof opts.y === "number" && Number.isFinite(opts.y) ? opts.y : auto.y;

  const count = await db.job.count({ where: { projectId: ctx.projectId, type: typeKey } });
  const customName =
    typeof opts.name === "string" && opts.name.trim() ? opts.name.trim().slice(0, 120) : null;

  const storedParams: Record<string, unknown> = {
    ...defaultParams(typeKey),
    ...filtered,
  };

  const job = await db.job.create({
    data: {
      projectId: ctx.projectId,
      workspaceId,
      type: typeKey,
      name: customName ?? `${spec.label} ${count + 1}`,
      x,
      y,
      params: JSON.stringify(storedParams),
      duration: spec.duration,
    },
  });

  // the wire — same validations the edges route enforces. A refused wire
  // does NOT fail the creation: the job stands, the report says why.
  let wired = false;
  let wireNote = "";
  if (connectFrom) {
    const ports = defaultPorts(connectFrom.type, typeKey);
    if (!portsValid(connectFrom.type, ports.fromPort, typeKey, ports.toPort)) {
      wireNote = ` — the wire ${connectFrom.name} → ${job.name} was refused (no compatible port pair; wire it manually via connect_jobs)`;
    } else {
      const duplicate = await db.edge.findUnique({
        where: { fromJobId_toJobId: { fromJobId: connectFrom.id, toJobId: job.id } },
      });
      if (!duplicate) {
        await db.edge.create({
          data: { projectId: ctx.projectId, fromJobId: connectFrom.id, toJobId: job.id },
        });
        wired = true;
        wireNote = `, wired from ${connectFrom.name} (${ports.fromPort} → ${ports.toPort})`;
      }
    }
  }

  return {
    ok: true,
    summary: `Created ${job.name} [${job.id}]${wireNote}${typeNote}${dropped.length > 0 ? ` (dropped unknown params: ${dropped.join(", ")})` : ""}`,
    jobId: job.id,
    jobName: job.name,
    wired,
    dropped,
    job,
  };
}

async function createJob(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const out = await createOneJob(ctx, {
    type: String(args.type ?? ""),
    name: typeof args.name === "string" ? args.name : undefined,
    params: args.params,
    connectFromId: typeof args.connect_from === "string" ? args.connect_from : null,
    x: typeof args.x === "number" ? args.x : undefined,
    y: typeof args.y === "number" ? args.y : undefined,
  });
  if (!out.ok) return { ok: false, summary: out.summary };
  const dto = out.job ? toJobDTO(out.job) : null;
  if (dto) dto.engine = "relion";
  return {
    ok: true,
    summary: out.summary,
    detail: { job: dto, wired: out.wired, dropped: out.dropped },
  };
}

/* ---- build_pipeline -------------------------------------------------- */

const PIPELINE_STEP_CAP = 12;

/**
 * t463 — the canonical bridge between chain steps that don't port-match.
 * The field shape: users say「挑选 → 2D 分类」(pick → classify) and RELION's
 * own law inserts Extract between them (coords must become particles
 * before any classification). The law is deliberately NARROW — a bridge
 * is offered only when the upstream truly produces coords AND the
 * downstream truly consumes particles AND extract port-matches both
 * sides; anything else keeps its honest refusal instead of a dead chain
 * (import → class2d must NOT grow an extract with no coords to feed it).
 */
const BRIDGE_CANDIDATES = ["extract"];

export function bridgeBetween(a: string, b: string): string | null {
  const from = jobType(a);
  const to = jobType(b);
  if (!from || !to) return null;
  const direct = defaultPorts(a, b);
  if (portsValid(a, direct.fromPort, b, direct.toPort)) return null;
  const aOutputsCoords = from.outputs.some((o) => o.kind === "coords");
  const bWantsParticles = to.inputs.some((i) => (i.accepts ?? []).includes("particles"));
  if (!aOutputsCoords || !bWantsParticles) return null;
  for (const mid of BRIDGE_CANDIDATES) {
    const up = defaultPorts(a, mid);
    const down = defaultPorts(mid, b);
    if (portsValid(a, up.fromPort, mid, up.toPort) && portsValid(mid, down.fromPort, b, down.toPort)) {
      return mid;
    }
  }
  return null;
}

export interface BridgedSteps {
  steps: { type: string; name?: string; params?: unknown }[];
  inserted: { after: string; bridge: string }[];
}

/** Pre-pass: insert bridges where adjacent steps don't port-match. Pure. */
export function bridgePipelineSteps(
  steps: { type: string; name?: string; params?: unknown }[]
): BridgedSteps {
  const out: { type: string; name?: string; params?: unknown }[] = [];
  const inserted: { after: string; bridge: string }[] = [];
  for (let i = 0; i < steps.length; i++) {
    out.push(steps[i]);
    if (i + 1 < steps.length) {
      const bridge = bridgeBetween(steps[i].type, steps[i + 1].type);
      if (bridge && steps.length + inserted.length < PIPELINE_STEP_CAP) {
        out.push({ type: bridge });
        inserted.push({ after: steps[i].type, bridge });
      }
    }
  }
  return { steps: out, inserted };
}

export function normalizePipelineSteps(
  raw: unknown
): { steps: { type: string; name?: string; params?: unknown }[]; error: string | null } {
  if (!Array.isArray(raw)) return { steps: [], error: "steps must be an ordered array of {type, name?, params?}" };
  if (raw.length === 0) return { steps: [], error: "steps is empty — pass the chain's job types in pipeline order" };
  if (raw.length > PIPELINE_STEP_CAP)
    return { steps: [], error: `too many steps (${raw.length}) — the cap is ${PIPELINE_STEP_CAP} per call; split the chain` };
  const steps: { type: string; name?: string; params?: unknown }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    if (!s || typeof s !== "object" || Array.isArray(s))
      return { steps: [], error: `step ${i + 1} is not an object` };
    const type = String((s as { type?: unknown }).type ?? "");
    if (!type) return { steps: [], error: `step ${i + 1} is missing its type` };
    const rec: { type: string; name?: string; params?: unknown } = { type };
    const name = (s as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) rec.name = name;
    const params = (s as { params?: unknown }).params;
    if (params && typeof params === "object" && !Array.isArray(params)) rec.params = params;
    steps.push(rec);
  }
  return { steps, error: null };
}

async function buildPipeline(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const { steps, error } = normalizePipelineSteps(args.steps);
  if (error) return { ok: false, summary: error };

  // validate every type BEFORE creating anything — a typo in step 5
  // must not leave half a chain on the canvas. t463: the alias ladder runs
  // here too, so a model that says "ctf"/"2d分类" builds the chain instead
  // of dying at the gate — the canonical key replaces the step in place.
  const interpreted: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const resolved = resolveJobTypeKey(steps[i].type);
    if (!resolved.key) {
      return {
        ok: false,
        summary: `step ${i + 1}: unknown job type "${steps[i].type}" — nothing was created (call list_job_types for the catalog)`,
      };
    }
    if (resolved.key !== steps[i].type) {
      interpreted.push(`step ${i + 1}: "${steps[i].type}" → ${resolved.key}`);
      steps[i].type = resolved.key;
    }
  }

  // t463 — the bridge pre-pass: adjacent steps that don't port-match get
  // the canonical connector (pick → classify grows an extract). The chain
  // the user asked for stays THEIR chain — the bridge is the road RELION
  // itself would pave, and the summary names every stone that was added.
  const bridged = bridgePipelineSteps(steps);
  if (bridged.inserted.length > 0) {
    steps.splice(0, steps.length, ...bridged.steps);
  }

  let prevId: string | null = typeof args.connect_from === "string" ? args.connect_from : null;
  if (prevId) {
    const prev = await findJobInProject(prevId, ctx.projectId);
    if (!prev) {
      return {
        ok: false,
        summary: `connect_from job not found in this project: ${prevId} — call get_workflow_state for the real ids`,
      };
    }
    prevId = prev.id;
  }

  const created: { step: number; id: string; name: string; type: string; wired: boolean }[] = [];
  const refusedWires: { step: number; reason: string }[] = [];
  const dropped: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const out = await createOneJob(ctx, {
      type: steps[i].type,
      name: steps[i].name,
      params: steps[i].params,
      connectFromId: prevId,
    });
    if (!out.ok) {
      return {
        ok: false,
        summary: `step ${i + 1} (${steps[i].type}) failed: ${out.summary} — the ${created.length} job(s) before it stay on the canvas`,
        detail: { created, refusedWires, dropped },
      };
    }
    created.push({ step: i + 1, id: out.jobId!, name: out.jobName!, type: steps[i].type, wired: out.wired });
    if (prevId && !out.wired) {
      refusedWires.push({ step: i + 1, reason: `no compatible port pair with step ${i} — wire manually via connect_jobs` });
    }
    for (const d of out.dropped) dropped.push(`step${i + 1}:${d}`);
    prevId = out.jobId;
  }

  const chain = created.map((c) => c.type).join(" → ");
  const wireSummary =
    refusedWires.length === 0
      ? "fully wired"
      : `${refusedWires.length} wire(s) refused (see refusedWires)`;
  return {
    ok: true,
    summary: `Built ${created.length}-job chain: ${chain} — ${wireSummary}${interpreted.length > 0 ? `; interpreted stage names: ${interpreted.join("; ")}` : ""}${bridged.inserted.length > 0 ? `; auto-inserted ${bridged.inserted.map((b) => `${b.bridge} after ${b.after}`).join(", ")} (the port law's own connector)` : ""}${dropped.length > 0 ? `; dropped unknown params: ${dropped.join(", ")}` : ""}`,
    detail: {
      jobs: created.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      head: created[0]?.id ?? null,
      tail: created[created.length - 1]?.id ?? null,
      refusedWires,
      dropped,
      interpreted,
      inserted: bridged.inserted,
      next: `run_job on the head (${created[0]?.name ?? "?"}) — downstream pending jobs auto-start`,
    },
  };
}

/* ---- wait_for_jobs --------------------------------------------------- */

const WAIT_POLL_MS = 1500;
const WAIT_DEFAULT_SEC = 45;
const WAIT_MAX_SEC = 180;

/** Clamp a caller-supplied wait budget to [1, 180] seconds (bench-covered). */
export function clampWaitSeconds(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return WAIT_DEFAULT_SEC;
  return Math.min(WAIT_MAX_SEC, Math.max(1, Math.round(v)));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForJobs(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const ids = Array.isArray(args.job_ids) ? args.job_ids.map((x) => String(x)).filter(Boolean) : [];
  if (ids.length === 0) return { ok: false, summary: "job_ids is empty" };
  if (ids.length > 10) return { ok: false, summary: `too many jobs (${ids.length}) — the cap is 10 per call` };

  // resolve through the same link-aware door every tool uses
  const resolved = new Map<string, NonNullable<PrismaJob>>();
  for (const id of ids) {
    const job = await findJobInProject(id, ctx.projectId);
    if (!job) return { ok: false, summary: `job not found in this project: ${id}` };
    resolved.set(id, job);
  }
  const realIds = [...new Set([...resolved.values()].map((j) => j.id))];
  const argOfReal = new Map<string, string>();
  for (const [argId, job] of resolved) argOfReal.set(job.id, argId);

  const timeoutSec = clampWaitSeconds(args.timeout_sec);
  const deadline = Date.now() + timeoutSec * 1000;
  const unsettled = (rows: { status: string }[]) => rows.filter((r) => r.status === "running" || r.status === "pending");

  let rows = await db.job.findMany({
    where: { id: { in: realIds } },
    select: { id: true, status: true, progress: true },
  });
  let waitedMs = 0;
  while (unsettled(rows).length > 0 && Date.now() < deadline) {
    await sleep(WAIT_POLL_MS);
    waitedMs = Date.now() - (deadline - timeoutSec * 1000);
    rows = await db.job.findMany({
      where: { id: { in: realIds } },
      select: { id: true, status: true, progress: true },
    });
  }

  const final = await db.job.findMany({ where: { id: { in: realIds } } });
  const byReal = new Map(final.map((j) => [j.id, j]));
  const report = ids.map((argId) => {
    const j = resolved.get(argId)!;
    const row = byReal.get(j.id) ?? j;
    return {
      id: argId,
      name: row.name,
      status: row.status,
      progress: row.progress,
      result: truncate(row.result, 200),
    };
  });
  const stillUnsettled = report.filter((r) => r.status === "running" || r.status === "pending");
  const allSettled = stillUnsettled.length === 0;
  const lines = report.map(
    (r) => `${r.name}: ${r.status}${r.status === "running" ? ` (${Math.round(r.progress * 100)}%)` : r.result ? ` — ${r.result}` : ""}`
  );
  return {
    ok: true,
    summary: allSettled
      ? `${report.length}/${report.length} settled in ${(waitedMs / 1000).toFixed(1)}s — ${lines.join("; ")}`
      : `still ${stillUnsettled.length} running/pending after ${timeoutSec}s — ${lines.join("; ")} — check again with inspect_job or wait_for_jobs later`,
    detail: {
      jobs: report,
      waitedMs,
      timeoutSec,
      allSettled,
      ...(argOfReal.size !== realIds.length ? { note: "some job ids resolved through soft links" } : {}),
    },
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

/* ---- continue_run ----------------------------------------------------- */

/**
 * t471 — the convergence verdict's verb, read by the agent (the 18th
 * tool). The UI's continue verb (t455, continue-verb-row.tsx) fires the
 * same three moves: checkpointOf → continuePlanOf → continueParamWrites,
 * then saveJob + run on the job's OWN lane. This tool is that row's
 * server face — the same shared brains (convergence-continue.ts), the
 * same data plane (continueSourcesFor — the picker's route), the same
 * dispatch (startJob), zero private mutation path.
 *
 * Laws mirrored, never invented:
 *  - THE LANE IS THE JOB'S OWN: continueLaneOf reads the runRemote
 *    ledger (remoteInfoFor — the DTO's own projection) because a cluster
 *    checkpoint is a CLUSTER path; run_job's project-binding default
 *    would be a category error here.
 *  - THE ARC'S HEAD IS THE CHECKPOINT: checkpointOf — the newest
 *    COMPLETE self round, live over archived; the verdict's reading
 *    pair is never a continue target.
 *  - --iter IS THE TOTAL (RELION's restart law), clamped to the form's
 *    ceiling, and the clamp is SAID.
 *  - NO CHECKPOINT, NO VERB; NO KNOB, NO VERB — the row's honest whys,
 *    verbatim.
 *  - THE WRITES RIDE THE SPEC: fn_cont + the knob key are legal spec
 *    params; the merge is update_job's own (coerceParam), then startJob
 *    reads explicitContinueOf from the updated row — the product's own
 *    resume path (the fresh-start wipe keeps the run_it family alive
 *    for an explicit in-workdir target, engine t394 law).
 */
async function continueRunTool(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  if (!jobId) {
    return { ok: false, summary: "continue_run needs a job id — pass the finished run's job id (get_workflow_state lists ids)" };
  }
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) {
    return { ok: false, summary: `Job not found: ${jobId} — get_workflow_state lists the canvas's ids` };
  }
  if (job.status === "running") {
    return { ok: false, summary: `${job.name} is already running (progress ${(job.progress * 100).toFixed(0)}%) — a continue resumes a SETTLED run; let it finish or stop it first` };
  }
  if (job.linkedJobId) {
    return { ok: false, summary: `${job.name} is a soft link — continue its original instead` };
  }
  if (!CONTINUE_FAMILY_TYPES.has(job.type)) {
    return {
      ok: false,
      summary: `${job.type} jobs have no continue — only the refine family (class2d, class3d, refine3d, initialmodel, multibody) carries RELION's fn_cont restart idiom`,
    };
  }

  const stored = JSON.parse(job.params || "{}") as Record<string, unknown>;
  const knob = iterKnobOf(job.type, stored);
  if (!knob) {
    return {
      ok: false,
      summary:
        job.type === "refine3d"
          ? "RELION's auto-refine owns this run's convergence — it stops on its own criterion, and a written --iter would be dead. The continue verb speaks only the manual dialect."
          : "This run's dialect carries no --iter knob — the continue verb has nothing to extend.",
    };
  }

  // the picker's own data plane (the route's brain, server-side import —
  // never a private scan)
  const sources = await continueSourcesFor({
    id: job.id,
    name: job.name,
    type: job.type,
    projectId: job.projectId,
  });
  const checkpoint = checkpointOf(sources);
  if (!checkpoint) {
    const scanError = selfScanErrorOf(sources);
    return {
      ok: false,
      summary: scanError
        ? `The run directory could not be read (${scanError}) — the continue verb stays absent rather than guessing.`
        : "No complete checkpoint in this run's own directory — RELION --continue needs the optimiser.star family (run_itNNN_optimiser.star with its data/model/sampling siblings). The verdict stays a reading.",
    };
  }

  const chips = moreOptionsFor(knob.vdam);
  let more = chips[0] ?? 5;
  if (args.more !== undefined) {
    const m = typeof args.more === "number" ? args.more : Number(args.more);
    if (!Number.isFinite(m) || m <= 0) {
      return {
        ok: false,
        summary: `more must be a positive number of iterations — the convergence dialog's chips are ${chips.join("/")} (${knob.vdam ? "VDAM mini-batches" : "EM epochs"})`,
      };
    }
    more = Math.round(m);
  }

  const plan = continuePlanOf({ type: job.type, params: stored, checkpoint, more });
  if (!plan) {
    return { ok: false, summary: "the continue plan could not be assembled (no --iter knob for this dialect)" };
  }
  const lane = continueLaneOf({ runRemote: remoteInfoFor(job.id) });

  // the writes ride the spec (update_job's own merge law): fn_cont +
  // the knob key are legal curated params, coerced through the schema
  const spec = jobType(job.type);
  const merged: Record<string, unknown> = { ...stored };
  for (const [k, v] of Object.entries(continueParamWrites(plan))) {
    const p = spec?.params.find((sp) => sp.key === k);
    merged[k] = p ? coerceParam(p, v) : v;
  }
  const updated = await db.job.update({
    where: { id: job.id },
    data: { params: JSON.stringify(merged) },
  });

  const archivedNote = plan.checkpoint.archived ? " (archived generation)" : "";
  const planLine = `${roundLabel(plan.checkpoint.iteration)}${archivedNote}: ${knob.key} ${knob.current} + ${more} → ${plan.totalIter} (--iter is the TOTAL${plan.clamped ? ", reaching the form's ceiling" : ""})`;
  const detail = {
    jobId: job.id,
    jobName: job.name,
    type: job.type,
    checkpoint: { round: plan.checkpoint.iteration, path: plan.checkpoint.path, archived: plan.checkpoint.archived },
    paramKey: plan.paramKey,
    currentIter: knob.current,
    more,
    totalIter: plan.totalIter,
    clamped: plan.clamped,
    lane: lane ? "cluster" : "local",
    fnCont: plan.fnCont,
  };

  const outcome = await startJob(updated, lane ? { remote: lane } : {});
  if (outcome.error) {
    return {
      ok: false,
      summary: `Start refused: ${outcome.error} — the continue plan is written on ${job.name} (${planLine}, fn_cont=${plan.fnCont}) — fix the start problem and fire continue_run again, or clear fn_cont with update_job to abandon the continue`,
      detail,
    };
  }
  if (outcome.busy) {
    return { ok: false, summary: `Busy (${outcome.busyKind}): ${outcome.busy}`, detail };
  }
  if (outcome.waiting) {
    return {
      ok: true,
      summary: `${job.name} is waiting: ${outcome.waiting} — the continue plan is written (${planLine}); it fires when its upstream completes`,
      detail,
    };
  }
  return {
    ok: true,
    summary: `${job.name} continues from ${roundLabel(plan.checkpoint.iteration)}${archivedNote} — its newest complete checkpoint — ${plan.paramKey} ${knob.current} + ${more} → ${plan.totalIter} total (--iter is the TOTAL${plan.clamped ? ", reaching the form's ceiling" : ""}) on ${lane ? "its own cluster lane" : "the local lane"}`,
    detail: { ...detail, status: outcome.job.status, progress: outcome.job.progress },
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
