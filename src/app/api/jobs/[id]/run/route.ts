import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJobDTO } from "@/lib/seed";
import { startJob } from "@/lib/relion/dispatch";
import { isLocalRequest } from "@/lib/http-guard";
import { remoteInfoFor } from "@/lib/remote/remote-run";
import type { RemoteRunTarget } from "@/lib/remote/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/run — start (or restart) a job on the REAL RELION
 * engine (the only engine — the simulation was retired). Honest failures are
 * surfaced through the job result + an {error} field with HTTP 200.
 * A live process for this job → HTTP 409, nothing is spawned.
 *
 * Optional JSON body: { remote: { connectionId, module?, mode } } — runs the
 * job on an SSH cluster instead (module load relion/<module>, see
 * docs/remote-relion.md). Without a body (or without `remote`) the run is
 * local, exactly as before.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Write door (t252, the CSRF twin of the t251 read ring): this action
    // needs NO parseable body — a cross-site HTML form can POST it blind.
    // Same drive-by door + Host pin pair as the read routes (http-guard).
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site job actions are not allowed" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // linked copies are read-only mirrors: running them would double-write
    // the original's workdir. Downstream jobs consume the original's outputs
    // through the link — that is the supported way to continue from a copy.
    if (existing.linkedJobId) {
      const original = await db.job.findUnique({
        where: { id: existing.linkedJobId },
        select: { name: true },
      });
      return NextResponse.json(
        {
          error: `This is a linked copy${original ? ` of "${original.name}"` : ""} — it mirrors the original's outputs. Run the ORIGINAL job instead; downstream jobs wired to this link already consume its results.`,
        },
        { status: 400 }
      );
    }

    // optional remote target ({ remote: {...} }); absent/invalid → local run
    const body = (await request.json().catch(() => ({}))) as {
      remote?: { connectionId?: unknown; module?: unknown; mode?: unknown; gpus?: unknown; partition?: unknown };
    };
    let remote: RemoteRunTarget | undefined;
    if (body?.remote && typeof body.remote === "object" && typeof body.remote.connectionId === "string" && body.remote.connectionId) {
      // t297 — gpus: the sbatch GPU width (1–8, default 6 — the
      // sbatch6gpu.sh idiom). Non-numeric garbage falls back to the default
      // server-side; the field only means anything in slurm mode.
      const gpusNum = Number(body.remote.gpus);
      // t300 — partition: the detected node group this sbatch pins. The
      // charset clamp ([A-Za-z0-9_.-], ≤64) is the FIRST gate — the engine
      // re-validates; anything else silently degrades to the connection's
      // default (a malformed name must never reach #SBATCH --partition=).
      const partitionRaw =
        typeof body.remote.partition === "string" ? body.remote.partition.trim() : "";
      const partition = /^[A-Za-z0-9_.-]{1,64}$/.test(partitionRaw) ? partitionRaw : null;
      remote = {
        connectionId: body.remote.connectionId,
        module: typeof body.remote.module === "string" && body.remote.module ? body.remote.module : null,
        mode: body.remote.mode === "slurm" ? "slurm" : "direct",
        ...(Number.isFinite(gpusNum) && gpusNum >= 1 ? { gpus: Math.min(8, Math.round(gpusNum)) } : {}),
        ...(partition ? { partition } : {}),
      };
    }

    const { job, error, busy, waiting, busyKind } = await startJob(existing, remote ? { remote } : {});

    if (busy) {
      // the job is already running — do NOT fail it, just refuse the spawn.
      // busyKind tells the client WHICH refusal this is: "inflight" (a
      // duplicate click racing the first start — the client stays silent so
      // the first start's own toast keeps the slot) vs "live" (a real live
      // process — the client gives a neutral heads-up). Both used to wear a
      // destructive "something went wrong" face; neither is an accident.
      return NextResponse.json(
        { job: toJobDTO(job), error: busy, ...(busyKind ? { busyKind } : {}) },
        { status: 409 }
      );
    }

    const dto = toJobDTO(job);
    const rinfo = remoteInfoFor(job.id);
    if (rinfo) dto.runRemote = rinfo;

    return NextResponse.json({
      job: dto,
      ...(error ? { error } : {}),
      ...(waiting ? { waiting } : {}),
    });
  } catch (error) {
    console.error("POST /api/jobs/[id]/run failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
