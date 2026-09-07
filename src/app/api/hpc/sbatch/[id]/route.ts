import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { existsSync } from "fs";
import { db } from "@/lib/db";
import { lineageFor } from "@/lib/relion/dispatch";
import { readRuns } from "@/lib/relion/engine";
import { buildSbatchForJob, loadProfiles, type EngineJobLike } from "@/lib/hpc/slurm";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/hpc/sbatch/[jobId]?profile=<profileId> — DRY-RUN Slurm
 * submission for a concrete job in the graph. The script embeds the
 * engine's REAL argv (identical builder to the local runner) with paths
 * translated onto the cluster profile, plus the GPU strategy
 * (array / multi-GPU / single / CPU) for this job type.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await db.job.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const profileId = request.nextUrl.searchParams.get("profile");
    const profiles = loadProfiles();
    const profile =
      profiles.find((p) => p.id === profileId) ??
      profiles.find((p) => p.id !== "local-workstation") ??
      profiles[0];

    const upstream = await lineageFor(job.id);

    // data-volume inputs for the strategy (micrographs / particles)
    const runs = readRuns();
    let micrographs = 10;
    for (const up of upstream) {
      const st = runs[up.id];
      if (up.type === "import" && st?.done) {
        const star = st.outputs?.micrographs_star;
        if (star && existsSync(star)) {
          const txt = (await import("fs").then((m) => m.readFileSync(star, "utf8")));
          micrographs = Math.max(1, txt.split("\n").filter((l) => l.includes(".mrc")).length);
        }
      }
    }
    let particles = 5000;
    for (const up of upstream) {
      const st = runs[up.id];
      if ((up.type === "extract" || up.type === "select") && st?.result) {
        const m = /([\d,]+)\s+particle/i.exec(st.result);
        if (m) particles = Math.max(100, Number(m[1].replace(/,/g, "")));
      }
    }

    const localWorkdir = path.join(process.cwd(), "data", "relion", job.projectId, `${job.type}_${job.id.slice(-8)}`);
    const clusterWorkdir = profile.dataRoot
      ? `${profile.dataRoot.replace(/\/$/, "")}/${job.projectId}/${job.type}_${job.id.slice(-8)}`
      : localWorkdir;

    const result = await buildSbatchForJob({
      job: { id: job.id, projectId: job.projectId, type: job.type, params: JSON.parse(JSON.stringify(job.params ?? {})) as Record<string, number | string | boolean>, name: job.name ?? undefined },
      upstream,
      profile,
      localWorkdir,
      clusterWorkdir,
      micrographs,
      particles,
    });

    return NextResponse.json({
      jobId: job.id,
      jobName: job.name,
      jobType: job.type,
      profile: {
        id: profile.id, name: profile.name, partition: profile.partition,
        gpuModel: profile.gpuModel, gpusPerNode: profile.gpusPerNode, host: profile.host,
      },
      ...result,
      dryRun: true,
      note:
        "Dry-run: the sandbox has no Slurm controller — this is the exact script sbatch would receive " +
        "(real argv from the live job graph, cluster-translated paths). On a cluster login node, submit with " +
        "sbatch --dependency=afterok:<upstream_id> to chain it after its inputs.",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "sbatch generation failed" }, { status: 500 });
  }
}
