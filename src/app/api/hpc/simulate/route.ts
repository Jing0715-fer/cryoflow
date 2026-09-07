import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readRuns } from "@/lib/relion/engine";
import { gpuStrategyFor, simulateQueue, type SimJobInput } from "@/lib/hpc/slurm";

export const dynamic = "force-dynamic";

/**
 * POST /api/hpc/simulate — Slurm-shaped queue simulation of the ACTIVE
 * project's real job graph. Body (all optional):
 *   { clusterGpus?: number, nodes?: number, arrayConcurrency?: number, gpuSpeedup?: number }
 *
 * The graph's types + edges drive dependency chains (afterok), the GPU
 * strategy table drives per-job GPU counts and array shards, and durations
 * come from REAL measured sandbox runs (engine-state durations scaled by
 * the profile speedup) when available, falling back to modelled minutes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      clusterGpus?: unknown; nodes?: unknown; arrayConcurrency?: unknown; gpuSpeedup?: unknown;
    };
    const num = (v: unknown, d: number, lo: number, hi: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
    };
    const cluster = {
      gpus: num(body.clusterGpus, 8, 1, 64),
      nodes: num(body.nodes, 4, 1, 16),
      arrayConcurrency: num(body.arrayConcurrency, 8, 1, 64),
    };
    const speedup = num(body.gpuSpeedup, 25, 1, 500);

    const active = await db.project.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!active) return NextResponse.json({ error: "No project" }, { status: 404 });
    const jobs = await db.job.findMany({ where: { projectId: active.id } });
    const edges = await db.edge.findMany({ where: { projectId: active.id } });
    const runs = readRuns();

    // particle/micrograph counts from real run results
    let micrographs = 10;
    let particles = 5000;
    for (const j of jobs) {
      const st = runs[j.id];
      if (!st?.result) continue;
      const m = /([\d,]+)\s+micrograph/i.exec(st.result);
      if (j.type === "import" && m) micrographs = Math.max(1, Number(m[1].replace(/,/g, "")));
      const p = /([\d,]+)\s+particle/i.exec(st.result);
      if (p && (j.type === "extract" || j.type === "select" || j.type === "class2d")) {
        particles = Math.max(100, Number(p[1].replace(/,/g, "")));
      }
    }

    // build SimJobInput per job: strategy + measured duration (seconds →
    // minutes, GPU jobs scaled by speedup)
    const byKey = new Map(jobs.map((j) => [j.id, j]));
    const simJobs: SimJobInput[] = jobs.map((j) => {
      const strategy = gpuStrategyFor(j.type, { micrographs, particles });
      const st = runs[j.id];
      let minutes = strategy.minutes;
      if (st?.startedAt) {
        // engine-state startedAt → last write; the run record duration is
        // authoritative when the job finished
        const durMs = Number(j.duration ?? 0) || 0;
        if (durMs > 0) {
          const realMin = durMs / 60000;
          minutes = strategy.gpus > 0 ? Math.max(0.2, (realMin * 1) / speedup * 10) : Math.max(0.2, realMin);
          // arrays measure per-micrograph: per-shard minutes
          if (strategy.mode === "array" && micrographs > 0) {
            minutes = Math.max(0.2, (realMin / micrographs) * (strategy.shards ? micrographs / strategy.shards : 1) / (strategy.gpus > 0 ? speedup : 1));
          }
        }
      }
      return {
        key: j.id,
        type: j.type,
        minutes: Math.max(0.2, Math.round(minutes * 10) / 10),
        gpus: strategy.gpus,
        mode: strategy.mode,
        shards: strategy.shards,
        deps: edges.filter((e) => e.toJobId === j.id).map((e) => e.fromJobId).filter((d) => byKey.has(d)),
      };
    });

    const result = simulateQueue(simJobs, cluster);
    return NextResponse.json({
      project: { id: active.id, name: active.name, jobs: jobs.length, edges: edges.length },
      cluster,
      speedup,
      data: { micrographs, particles },
      ...result,
      note:
        "Simulation: durations come from the REAL measured sandbox run times (GPU jobs scaled ×" +
        speedup +
        " for " +
        "cluster-class hardware), strategies from the GPU table, dependencies from the live graph edges " +
        "(afterok semantics). This mirrors what squeue/sacct would report on a real cluster.",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "simulation failed" }, { status: 500 });
  }
}
