import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getRun } from "@/lib/relion/engine";
import { readMrcHeader } from "@/lib/mrc";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface PickEntry {
  /** workdir-relative micrograph path (feeds outputs/file PNG) */
  micPath: string;
  name: string;
  count: number;
  /** [x, y] detector-pixel coordinates (origin bottom-left, as picked) */
  picks: [number, number][];
}

export interface PicksResponse {
  jobId: string;
  total: number;
  /** detector dimensions of the first micrograph (square frames) */
  imageWidth: number;
  imageHeight: number;
  micrographs: PickEntry[];
}

/**
 * GET /api/jobs/[id]/picks — picked-particle coordinates of a ManualPick
 * job from manualpick.star, grouped per micrograph. Coordinates stay in
 * detector pixel space; the client maps them onto MRC thumbnails with an
 * SVG viewBox (and flips Y — RELION .coords are origin bottom-left while
 * MRC rendering is top-down).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await db.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    const empty: PicksResponse = {
      jobId: id,
      total: 0,
      imageWidth: 0,
      imageHeight: 0,
      micrographs: [],
    };
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(empty);
    }
    const starPath = path.join(run.workdir, "manualpick.star");
    if (!existsSync(starPath)) {
      return NextResponse.json(empty);
    }

    const lines = readFileSync(starPath, "utf8").split(/\r?\n/);
    // columns: _rlnCoordinateX #1 _rlnCoordinateY #2 _rlnMicrographName #3
    const perMic = new Map<string, [number, number][]>();
    for (const raw of lines) {
      const t = raw.trim();
      if (!t || t.startsWith("#") || t.startsWith("_") || t === "loop_" || t.startsWith("data_")) continue;
      const cells = t.split(/\s+/);
      if (cells.length < 3) continue;
      const x = parseFloat(cells[0]);
      const y = parseFloat(cells[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const mic = cells[2].replace(/^\.?\//, "");
      let arr = perMic.get(mic);
      if (!arr) {
        arr = [];
        perMic.set(mic, arr);
      }
      arr.push([x, y]);
    }
    if (perMic.size === 0) {
      return NextResponse.json(empty);
    }

    // detector dimensions from the first available micrograph
    let imageWidth = 0;
    let imageHeight = 0;
    for (const mic of perMic.keys()) {
      const abs = path.join(run.workdir, mic);
      if (!existsSync(abs)) continue;
      const hdr = readMrcHeader(abs);
      if (hdr) {
        imageWidth = hdr.nx;
        imageHeight = hdr.ny;
      }
      break;
    }

    const micrographs: PickEntry[] = [...perMic.entries()]
      .map(([mic, picks]) => ({
        micPath: mic,
        name: path.basename(mic),
        count: picks.length,
        picks,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const total = micrographs.reduce((n, m) => n + m.count, 0);
    return NextResponse.json({
      jobId: id,
      total,
      imageWidth,
      imageHeight,
      micrographs,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/picks failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
