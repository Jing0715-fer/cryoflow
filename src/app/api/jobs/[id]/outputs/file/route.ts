import { NextRequest, NextResponse } from "next/server";
import { openSync, readSync, closeSync, readFileSync, realpathSync, statSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getRun } from "@/lib/relion/engine";
import { isMrcPath, renderMrcLargePng, renderMrcMontagePng, renderMrcSlicePng } from "@/lib/mrc";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const TEXT_TAIL = 64 * 1024; // last 64 KB for format=text

/* ------------------------------------------------------------------ */
/* Workdir + path safety                                               */
/* ------------------------------------------------------------------ */

/**
 * Resolve `rel` inside the job workdir and verify the path stays inside the
 * workdir (rejects `..`, absolute paths). LEXICAL containment is the security
 * boundary — RELION's engine legitimately symlinks shared inputs (e.g.
 * micrographs) into job workdirs, so realpath may point to project-level
 * files; traversal via `..` is already impossible after path.resolve.
 * Returns { error, status } on failure, { abs, real, name } on success.
 */
function resolveInside(workdir: string, rel: string): { abs: string; real: string; name: string } | { error: string; status: number } {
  if (!rel || rel.startsWith("/") || rel.startsWith("\\") || rel.split("/").includes("..")) {
    return { error: "Invalid path", status: 400 };
  }
  const abs = path.resolve(workdir, rel);
  if (abs !== workdir && !abs.startsWith(workdir + path.sep)) {
    return { error: "Path escapes the job directory", status: 400 };
  }
  let resolvedReal: string;
  try {
    resolvedReal = realpathSync(abs);
  } catch {
    return { error: "File not found", status: 404 };
  }
  return { abs, real: resolvedReal, name: path.basename(resolvedReal) };
}

function tailText(file: string): string {
  const size = statSync(file).size;
  const start = Math.max(0, size - TEXT_TAIL);
  const fd = openSync(file, "r");
  try {
    const len = size - start;
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, start);
    return buf.toString("utf8");
  } finally {
    closeSync(fd);
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/jobs/[id]/outputs/file                                     */
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
    const format = url.searchParams.get("format") ?? "png";

    const resolved = resolveInside(run.workdir, rel);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { abs, name } = resolved;

    const lower = name.toLowerCase();
    const isMrc = isMrcPath(name);
    const isImage = lower.endsWith(".eps") || lower.endsWith(".pdf");
    const isTextual =
      !isMrc && !isImage && (lower.endsWith(".star") || /\.(log|txt|out|err|json|bild|dat|xml|com|lst|coord)$/i.test(lower));

    if (format === "raw") {
      // binary download — maps for Mol*, EPS/PDF reports for the browser
      if (!isMrc && !isImage) {
        return NextResponse.json({ error: "Raw format is for maps and image files" }, { status: 400 });
      }
      const data = readFileSync(abs);
      const safeName = name.replace(/[^A-Za-z0-9._-]/g, "_");
      return new NextResponse(new Uint8Array(data), {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    if (format === "png") {
      if (!isMrc) {
        return NextResponse.json({ error: "PNG rendering is for MRC maps only" }, { status: 400 });
      }
      const montageParam = url.searchParams.get("montage");
      const sliceParam = url.searchParams.get("slice");
      const scale = url.searchParams.get("scale") ?? "thumb";
      let png: Buffer | null = null;
      const isStack = lower.endsWith(".mrcs");
      if (isStack && montageParam !== "0") {
        const n = Math.min(16, Math.max(1, Number.parseInt(montageParam ?? "8", 10) || 8));
        png = await renderMrcMontagePng(abs, n);
      } else if (scale === "large") {
        const slice = sliceParam !== null ? Number.parseInt(sliceParam, 10) || 0 : 0;
        png = await renderMrcLargePng(abs, slice);
      } else {
        const slice = sliceParam !== null ? Number.parseInt(sliceParam, 10) || 0 : undefined;
        png = await renderMrcSlicePng(abs, slice);
      }
      if (!png) {
        return NextResponse.json({ error: "Could not render this MRC file" }, { status: 400 });
      }
      return new NextResponse(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache",
        },
      });
    }

    if (format === "text") {
      if (!isTextual) {
        return NextResponse.json({ error: "Text preview is for log/text files" }, { status: 400 });
      }
      const text = tailText(abs);
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    return NextResponse.json({ error: "Unknown format (expected png, raw or text)" }, { status: 400 });
  } catch (error) {
    console.error("GET /api/jobs/[id]/outputs/file failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
