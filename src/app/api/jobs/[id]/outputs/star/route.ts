import { NextRequest, NextResponse } from "next/server";
import { openSync, readFileSync, readSync, closeSync, realpathSync, statSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getRun } from "@/lib/relion/engine";
import { biggestLoop, extractFsc, findPair, parseStar } from "@/lib/starfile";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const HUGE_FILE = 20 * 1024 * 1024; // above this only the first 5 MB is parsed
const PREVIEW_BYTES = 5 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Path safety (same rules as the file route)                          */
/* ------------------------------------------------------------------ */

function resolveInside(workdir: string, rel: string): { abs: string } | { error: string; status: number } {
  if (!rel || rel.startsWith("/") || rel.startsWith("\\") || rel.split("/").includes("..")) {
    return { error: "Invalid path", status: 400 };
  }
  let workdirReal: string;
  let resolvedReal: string;
  const abs = path.resolve(workdir, rel);
  try {
    workdirReal = realpathSync(workdir);
    resolvedReal = realpathSync(abs);
  } catch {
    return { error: "File not found", status: 404 };
  }
  if (resolvedReal !== workdirReal && !resolvedReal.startsWith(workdirReal + path.sep)) {
    return { error: "Path escapes the job directory", status: 400 };
  }
  if (!resolvedReal.toLowerCase().endsWith(".star")) {
    return { error: "Not a STAR file", status: 400 };
  }
  return { abs };
}

function readStarText(file: string): { text: string; previewed: boolean } {
  const size = statSync(file).size;
  if (size <= HUGE_FILE) {
    return { text: readFileSync(file, "utf8"), previewed: false };
  }
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(PREVIEW_BYTES);
    const got = readSync(fd, buf, 0, PREVIEW_BYTES, 0);
    return { text: buf.toString("utf8", 0, got), previewed: true };
  } finally {
    closeSync(fd);
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/jobs/[id]/outputs/star                                     */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await db.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir) {
      return NextResponse.json({ error: "No on-disk outputs for this job" }, { status: 400 });
    }

    const url = new URL(request.url);
    const rel = url.searchParams.get("path") ?? "";
    const rowsParam = Math.max(1, Math.min(1000, Number.parseInt(url.searchParams.get("rows") ?? "100", 10) || 100));

    const resolved = resolveInside(run.workdir, rel);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { text, previewed } = readStarText(resolved.abs);
    const parsed = parseStar(text, 200_000);
    const loop = biggestLoop(parsed);
    if (!loop) {
      return NextResponse.json({
        path: rel,
        columns: [],
        rows: [],
        rowCount: 0,
        truncated: false,
        note: previewed ? "No loop block found (file previewed, first 5 MB)" : "No loop block found in this STAR file",
      });
    }

    const rowCount = loop.rows.length;
    const limited = loop.rows.slice(0, rowsParam);
    const truncated = limited.length < rowCount;

    // FSC detection (postprocess.star data_fsc block & friends)
    let fsc: { resolution: number[]; correlation: number[]; finalResolution?: number } | undefined;
    const extracted = extractFsc(loop);
    if (extracted) {
      fsc = {
        resolution: extracted.resolution,
        correlation: extracted.correlation,
      };
      const finalPair = findPair(parsed, "_rlnFinalResolution");
      if (finalPair !== null && Number.isFinite(parseFloat(finalPair))) {
        fsc.finalResolution = parseFloat(finalPair);
      }
    }

    return NextResponse.json({
      path: rel,
      columns: loop.columns,
      rows: limited,
      rowCount,
      truncated,
      fsc,
      note: previewed ? "Large file — parsed the first 5 MB only" : undefined,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/outputs/star failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
