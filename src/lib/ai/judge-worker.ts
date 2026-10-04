/**
 * CryoFlow — the JUDGE WORKER (t574): the verdict arrives before you ask.
 *
 * t565/t573 made the judge an on-demand tool — ask the assistant about a
 * finished classification and a two-pass VLM opinion gets stamped onto
 * the job (data/ai-verdicts.json). But "on-demand" meant the verdict
 * only exists for people who already thought to ask. This worker closes
 * the loop the other way: a class2d/class3d that completes gets judged
 * in the background, and by the time the scientist opens the Results tab
 * the opinion is already there — badge on the card, stamp in the file.
 *
 * Architecture mirrors the t533 global reaper exactly (the house's only
 * prior art for boot-mounted background loops):
 *
 *   - mounted ONCE per process via a globalThis singleton (dev-mode dual
 *     module instances share it), from instrumentation.register()'s
 *     dynamic import (+10s — the static graph would delay the listener);
 *     the status route (GET /api/ai/judge-worker) mounts defensively.
 *   - a tick every CRYOFLOW_JUDGE_WORKER_MS (default 30s, clamped
 *     10s–10min; a judge is a two-pass VLM call — politeness over
 *     reactivity) that scans completed classifications through the PURE
 *     planner (judge-worker-plan.ts) and runs at most ONE judge per tick.
 *   - double memory against re-judging: the stamps file is the per-job
 *     memory (one opinion per job, never overwritten by the worker), and
 *     data/judge-worker.json's watermark is the per-ERA memory — a first
 *     boot initializes it to NOW so the back catalog is never storm-
 *     judged, a restart re-arms from the persisted moment, so jobs that
 *     completed while the server was DOWN still get their verdict (the
 *     reaper's headless-heal doctrine, judge edition).
 *   - never dies loudly: a tick's failure is swallowed (the next tick
 *     re-tries); the interval is unref'd so it cannot hold the process;
 *     CRYOFLOW_NO_JUDGE_WORKER=1 is the escape hatch (reaper's
 *     CRYOFLOW_NO_REAPER symmetry); the settings dialog's autoJudge
 *     switch is the product-level off.
 *
 * The judge functions themselves (tools.ts judge2dClasses/judge3dClasses)
 * own everything about BEING a judge — workdir discovery, the two-pass
 * VLM, the stamp write, the honest refusals. The worker owns only WHEN.
 */

import path from "path";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { DATA_DIR } from "@/lib/paths";
import { db } from "@/lib/db";
import { resolveAssistant, loadAiSettings } from "@/lib/ai/settings";
import { listStampIds } from "@/lib/ai/verdict-stamps";
import { judge2dClasses, judge3dClasses } from "@/lib/ai/tools";
import {
  clampJudgeTickMs,
  planJudgeCandidates,
  DEFAULT_JUDGE_TICK_MS,
  type JudgeScanJob,
} from "@/lib/ai/judge-worker-plan";

/* ---------------------------------------------------------------------- */
/* Worker state (bounded — the status route reads it verbatim)             */
/* ---------------------------------------------------------------------- */

interface JudgeRecord {
  jobId: string;
  jobName: string;
  type: string;
  ok: boolean;
  summary: string;
  at: number;
}

interface WorkerState {
  mounted: boolean;
  timer: ReturnType<typeof setInterval> | null;
  tickMs: number;
  startedAt: number;
  lastTickAt: number | null;
  lastScanAt: number | null;
  scanning: boolean;
  judged: JudgeRecord[];
}

/** globalThis on purpose: dev-mode compiles a module graph twice (route +
 * instrumentation) and both instances must agree on ONE interval. */
const g = globalThis as unknown as { __cryoflowJudgeWorker?: WorkerState };

function state(): WorkerState {
  if (!g.__cryoflowJudgeWorker) {
    g.__cryoflowJudgeWorker = {
      mounted: false,
      timer: null,
      tickMs: clampJudgeTickMs(process.env.CRYOFLOW_JUDGE_WORKER_MS),
      startedAt: Date.now(),
      lastTickAt: null,
      lastScanAt: null,
      scanning: false,
      judged: [],
    };
  }
  return g.__cryoflowJudgeWorker;
}

/* ---------------------------------------------------------------------- */
/* Watermark persistence (the per-ERA memory)                              */
/* ---------------------------------------------------------------------- */

const WATERMARK_FILE = path.join(DATA_DIR, "judge-worker.json");

function readWatermark(): number | null {
  try {
    if (!existsSync(WATERMARK_FILE)) return null;
    const doc = JSON.parse(readFileSync(WATERMARK_FILE, "utf8")) as { watermark?: unknown };
    return typeof doc.watermark === "number" && Number.isFinite(doc.watermark)
      ? doc.watermark
      : null;
  } catch {
    return null;
  }
}

function writeWatermark(ms: number): void {
  try {
    mkdirSync(path.dirname(WATERMARK_FILE), { recursive: true });
    const tmp = `${WATERMARK_FILE}.tmp-${Date.now().toString(36)}`;
    writeFileSync(tmp, JSON.stringify({ watermark: ms }, null, 2));
    renameSync(tmp, WATERMARK_FILE);
  } catch {
    /* a lost watermark can only cause a re-scan; the stamps file still
     * prevents any actual re-judging (the per-job memory catches it) */
  }
}

/* ---------------------------------------------------------------------- */
/* The tick                                                                 */
/* ---------------------------------------------------------------------- */

/**
 * One beat: scan → plan → judge (≤1) → advance the watermark. The
 * watermark advances to the SCAN START (not the scan end): a job that
 * completes mid-scan has updatedAt after it, so the next tick picks it
 * up — nothing falls between ticks.
 */
export async function judgeTick(): Promise<void> {
  const s = state();
  if (s.scanning) return; // re-entrancy guard — a slow VLM call skips beats
  s.scanning = true;
  const scanStart = Date.now();
  try {
    const settings = loadAiSettings();
    const assistant = resolveAssistant();
    const stampedIds = listStampIds();
    const rows = await db.job.findMany({
      where: { type: { in: ["class2d", "class3d"] }, status: "completed" },
      select: {
        id: true,
        type: true,
        status: true,
        linkedJobId: true,
        updatedAt: true,
        name: true,
        projectId: true,
      },
    });
    const jobs: JudgeScanJob[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      linkedJobId: r.linkedJobId,
      updatedAtMs: r.updatedAt.getTime(),
    }));
    const candidates = planJudgeCandidates(jobs, {
      watermarkMs: s.lastScanAt ?? readWatermark() ?? scanStart,
      autoJudge: settings.autoJudge,
      providerOk: assistant != null,
      stampedIds,
    });
    s.lastScanAt = scanStart;
    writeWatermark(scanStart);
    s.lastTickAt = Date.now();

    if (candidates.length === 0) return;

    // one per tick — the planner already capped and sorted oldest-first
    const target = candidates[0];
    const row = rows.find((r) => r.id === target.id);
    const name = row?.name ?? target.id;
    console.log(`[judge-worker] auto-judging ${target.type} "${name}" (${target.id})`);
    const result =
      target.type === "class2d"
        ? await judge2dClasses({ projectId: row?.projectId ?? "" }, target.id)
        : await judge3dClasses({ projectId: row?.projectId ?? "" }, target.id);
    const record: JudgeRecord = {
      jobId: target.id,
      jobName: name,
      type: target.type,
      ok: result.ok === true,
      summary: (result.summary ?? "").slice(0, 400),
      at: Date.now(),
    };
    s.judged.unshift(record);
    if (s.judged.length > 20) s.judged.length = 20;
    console.log(
      `[judge-worker] ${record.ok ? "verdict stamped" : "judge declined"} — ${record.jobName}: ${record.summary.slice(0, 160)}`
    );
  } catch (error) {
    // never die loudly — the next tick re-tries
    console.error("[judge-worker] tick failed (will retry next beat):", error);
    s.lastTickAt = Date.now();
  } finally {
    s.scanning = false;
  }
}

/* ---------------------------------------------------------------------- */
/* Mount + status                                                           */
/* ---------------------------------------------------------------------- */

/** Idempotent mount (globalThis singleton — see state() above). */
export function ensureJudgeWorker(): void {
  if (process.env.CRYOFLOW_NO_JUDGE_WORKER === "1") return;
  const s = state();
  if (s.mounted) return;
  s.mounted = true;
  s.timer = setInterval(() => void judgeTick(), s.tickMs);
  s.timer.unref?.(); // the worker must never hold the process open
  console.log(`[judge-worker] mounted — tick ${s.tickMs}ms (default ${DEFAULT_JUDGE_TICK_MS}ms)`);
}

export interface JudgeWorkerStatus {
  mounted: boolean;
  disabled: boolean;
  autoJudge: boolean;
  providerOk: boolean;
  tickMs: number;
  startedAt: number;
  lastTickAt: number | null;
  lastScanAt: number | null;
  watermark: number | null;
  judged: JudgeRecord[];
}

/** Honest introspection — the status route's body, the harness's handle. */
export function judgeWorkerStatus(): JudgeWorkerStatus {
  const s = state();
  return {
    mounted: s.mounted,
    disabled: process.env.CRYOFLOW_NO_JUDGE_WORKER === "1",
    autoJudge: loadAiSettings().autoJudge,
    providerOk: resolveAssistant() != null,
    tickMs: s.tickMs,
    startedAt: s.startedAt,
    lastTickAt: s.lastTickAt,
    lastScanAt: s.lastScanAt,
    watermark: s.lastScanAt ?? readWatermark(),
    judged: [...s.judged],
  };
}
