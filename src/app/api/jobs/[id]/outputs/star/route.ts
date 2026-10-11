import { NextRequest, NextResponse } from "next/server";
import { openSync, readFileSync, readSync, closeSync, statSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { resolveInsideJobWorkdir } from "@/lib/relion/jobfile";
import { biggestLoop, extractFsc, findPair, parseStar } from "@/lib/starfile";
import { isLocalRequest } from "@/lib/http-guard";
import { fetchRemoteFileIntoWorkdir } from "@/lib/remote/remote-files";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const HUGE_FILE = 20 * 1024 * 1024; // above this only the first 5 MB is parsed
const PREVIEW_BYTES = 5 * 1024 * 1024;

/** t651 — sanitize the download filename the same way the file route
 * does: basename only, quotes and control chars out, so a weird STAR
 * name can't break out of the Content-Disposition header. */
function safeExportName(rel: string): string {
  const base = path.basename(rel).replace(/\.[^.]+$/, "") || "table";
  return `${base.replace(/["\\\x00-\x1f]/g, "_")}.tsv`;
}

/** t651 — serialize the loop block as TSV: the STAR vocabulary's native
 * dialect is tab-separated columns, so TSV (not CSV) keeps every name
 * and value byte-faithful — pandas/Excel read it back without quoting
 * gymnastics. The header carries the ORIGINAL _rln names (the UI's
 * shortColumn is a view convenience, not the data's identity). */
function toTsv(columns: string[], rows: string[][]): string {
  const esc = (v: string) => v.replace(/[\t\r\n]/g, " ");
  return [columns.join("\t"), ...rows.map((r) => r.map(esc).join("\t"))].join("\n") + "\n";
}

/* ------------------------------------------------------------------ */
/* Path safety (same unified rules as the file route)                  */
/* ------------------------------------------------------------------ */

// resolveInsideJobWorkdir — src/lib/relion/jobfile.ts — is the single
// containment policy for both outputs routes: lexical workdir scoping +
// realpath inside the app data tree. The old realpath-inside-workdir rule
// rejected engine-created cross-job symlinks; the file route's old
// lexical-only rule let planted links escape. Both holes are closed.

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
    // Hardening (t251, the #5 sibling closure): workdir-derived data —
    // same drive-by door + Host pin pair as the outputs/file route
    // (see http-guard for the threat model). Parsed or rendered, the
    // bytes come from the job workdir — the door rides along.
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site access to job data is not allowed" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
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

    let resolved = resolveInsideJobWorkdir(run.workdir, rel);
    // t289 — the same lazy leg as the file route: a remote-only STAR
    // (key-files policy edge, or a sync that died mid-way) is pulled over
    // SSH on the user's explicit click, then parsed from the local mirror.
    if ("error" in resolved && resolved.error === "File not found" && run.remote) {
      const fetched = await fetchRemoteFileIntoWorkdir(
        { workdir: run.workdir, remote: run.remote },
        rel
      );
      if (fetched.ok) {
        resolved = resolveInsideJobWorkdir(run.workdir, rel);
      } else if (fetched.status !== 404) {
        return NextResponse.json({ error: fetched.error }, { status: fetched.status });
      }
    }
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    if (!resolved.real.toLowerCase().endsWith(".star")) {
      return NextResponse.json({ error: "Not a STAR file" }, { status: 400 });
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

    // t651 — the export lane: the loop block AS DATA, serialized where
    // it lives. ?export=tsv returns the FULL parsed row set (the UI's
    // 100-row preview is a view budget, not the file's truth); direct
    // navigation keeps it inside the guard's 'none' lane, same as the
    // file route's attachment downloads.
    if (url.searchParams.get("export") === "tsv") {
      return new NextResponse(toTsv(loop.columns, loop.rows), {
        headers: {
          "Content-Type": "text/tab-separated-values; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeExportName(rel)}"`,
          "Cache-Control": "no-store",
        },
      });
    }

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
