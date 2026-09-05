import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { resolveMicrographEntry } from "@/lib/relion/pathref";
import { readMrcHeader } from "@/lib/mrc";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export interface MicrographEntry {
  /** workdir-relative path (micrographs/<name>.mrc) — feeds outputs/file */
  path: string;
  name: string;
  /** file size in bytes */
  size: number;
  /** detector dimensions */
  nx: number;
  ny: number;
}

export interface MicrographsResponse {
  jobId: string;
  total: number;
  /** optics from micrographs.star */
  pixelSize: number | null;
  voltage: number | null;
  sphericalAberration: number | null;
  amplitudeContrast: number | null;
  micrographs: MicrographEntry[];
}

/**
 * GET /api/jobs/[id]/micrographs — the import job's micrograph manifest:
 * optics-group metadata + per-micrograph dimensions, straight from
 * micrographs.star plus a peek at each MRC header.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    const empty: MicrographsResponse = {
      jobId: id,
      total: 0,
      pixelSize: null,
      voltage: null,
      sphericalAberration: null,
      amplitudeContrast: null,
      micrographs: [],
    };
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(empty);
    }

    const starPath = path.join(run.workdir, "micrographs.star");
    if (!existsSync(starPath)) {
      return NextResponse.json(empty);
    }
    const text = readFileSync(starPath, "utf8");
    const lines = text.split(/\r?\n/);

    // optics group block: _rlnMicrographPixelSize #3 _rlnVoltage #4 …
    let pixelSize: number | null = null;
    let voltage: number | null = null;
    let sphericalAberration: number | null = null;
    let amplitudeContrast: number | null = null;
    const opticsLabels: Record<string, number> = {};
    {
      let inOptics = false;
      let inLoop = false;
      let colOf: Record<string, number> = {};
      for (const raw of lines) {
        const t = raw.trim();
        if (t.startsWith("data_")) {
          inOptics = t === "data_optics";
          inLoop = false;
          continue;
        }
        if (!inOptics) continue;
        if (t === "loop_") {
          inLoop = true;
          colOf = {};
          continue;
        }
        if (inLoop && t.startsWith("_rln")) {
          const m = /^(_rln\S+)(?:\s+#(\d+))?\s*$/.exec(t);
          if (m) colOf[m[1]] = m[2] ? parseInt(m[2], 10) - 1 : Object.keys(colOf).length;
          continue;
        }
        if (inLoop && t && !t.startsWith("#")) {
          const cells = t.split(/\s+/);
          const read = (label: string): number | null => {
            const i = colOf[label];
            if (i === undefined || i >= cells.length) return null;
            const v = parseFloat(cells[i]);
            return Number.isFinite(v) ? v : null;
          };
          if (pixelSize === null) pixelSize = read("_rlnMicrographPixelSize");
          if (voltage === null) voltage = read("_rlnVoltage");
          if (sphericalAberration === null) sphericalAberration = read("_rlnSphericalAberration");
          if (amplitudeContrast === null) amplitudeContrast = read("_rlnAmplitudeContrast");
          inLoop = false; // one data row is all the optics block carries
        } else if (!inLoop && t.startsWith("_rln")) {
          // "label value" pair (non-loop optics)
          const m = /^(_rln\S+)\s+(.+)$/.exec(t);
          if (m) opticsLabels[m[1]] = parseFloat(m[2]);
        }
      }
      if (pixelSize === null) pixelSize = opticsLabels["_rlnMicrographPixelSize"] ?? null;
      if (voltage === null) voltage = opticsLabels["_rlnVoltage"] ?? null;
      if (sphericalAberration === null) sphericalAberration = opticsLabels["_rlnSphericalAberration"] ?? null;
      if (amplitudeContrast === null) amplitudeContrast = opticsLabels["_rlnAmplitudeContrast"] ?? null;
    }

    // micrograph rows: first column is the project-relative path
    const names: string[] = [];
    {
      let inMic = false;
      let inLoop = false;
      for (const raw of lines) {
        const t = raw.trim();
        if (t.startsWith("data_")) {
          inMic = t === "data_micrographs";
          inLoop = false;
          continue;
        }
        if (!inMic) continue;
        if (t === "loop_") {
          inLoop = true;
          continue;
        }
        if (t.startsWith("_rln")) continue;
        if (!inLoop || !t || t.startsWith("#")) continue;
        const first = t.split(/\s+/)[0];
        if (first) names.push(first.replace(/^\.?\//, ""));
      }
    }

    const micDir = path.join(run.workdir, "micrographs");
    const micrographs: MicrographEntry[] = [];
    if (existsSync(micDir)) {
      // linked files (hardlink/symlink/junction) resolve directly; files the
      // engine could NOT link (Windows cross-drive / UNC sources) have a
      // .pathref marker recording their source location — stat + header come
      // from there so the gallery shows the SAME 84 thumbnails either way
      for (const n of names) {
        const base = path.basename(n);
        const resolved = resolveMicrographEntry(micDir, base);
        if (!resolved) continue;
        let size = 0;
        let nx = 0;
        let ny = 0;
        try {
          size = statSync(resolved.abs).size;
          const hdr = readMrcHeader(resolved.abs);
          if (hdr) {
            nx = hdr.nx;
            ny = hdr.ny;
          }
        } catch {
          /* stat/header best-effort */
        }
        micrographs.push({ path: resolved.rel, name: base, size, nx, ny });
      }
    } else {
      // engine only symlinked micrographs into workdir from 2026-09-04 on —
      // older completed import jobs expose the list without previews
      for (const n of names) {
        micrographs.push({
          path: n,
          name: path.basename(n),
          size: 0,
          nx: 0,
          ny: 0,
        });
      }
    }

    return NextResponse.json({
      jobId: id,
      total: micrographs.length,
      pixelSize,
      voltage,
      sphericalAberration,
      amplitudeContrast,
      micrographs,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/micrographs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
