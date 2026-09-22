import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* Overlay session — server-side copy of the 3D viewer's Layers setup  */
/* ------------------------------------------------------------------ */
// localStorage keeps the session per browser; this row makes it follow
// the JOB across browsers and devices. Paths are stored as given (relative
// to the job workdir) and re-validated against the job's live outputs on
// restore — a stale entry can never reach the viewer, so the stored list
// self-heals on the next visit.

interface OverlayEntry {
  path: string;
  name: string;
  color: string;
  alpha: number;
  sigmaOffset: number;
}

const MAX_ENTRIES = 12;

/** defensive shape/color/clamp pass — the client is friendly, the API is
 *  not trusting (same posture as the params PATCH route) */
function sanitize(raw: unknown): OverlayEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: OverlayEntry[] = [];
  for (const r of raw.slice(0, MAX_ENTRIES)) {
    if (!r || typeof r !== "object") continue;
    const e = r as Record<string, unknown>;
    if (typeof e.path !== "string" || !e.path || e.path.length > 512 || e.path.includes("\0")) continue;
    if (typeof e.name !== "string" || !e.name) continue;
    if (typeof e.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(e.color)) continue;
    const alpha =
      typeof e.alpha === "number" && Number.isFinite(e.alpha) ? Math.min(1, Math.max(0.05, e.alpha)) : 0.55;
    const sigmaOffset =
      typeof e.sigmaOffset === "number" && Number.isFinite(e.sigmaOffset)
        ? Math.min(3, Math.max(-3, e.sigmaOffset))
        : 0;
    out.push({
      path: e.path.slice(0, 512),
      name: e.name.slice(0, 160),
      color: e.color.toLowerCase(),
      alpha,
      sigmaOffset,
    });
  }
  return out;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  try {
    const row = await db.overlaySession.findUnique({ where: { jobId: id } });
    if (!row) return NextResponse.json({ entries: [] });
    let entries: OverlayEntry[] = [];
    try {
      entries = sanitize(JSON.parse(row.data));
    } catch {
      entries = []; // corrupt row reads as empty — the client rewrites it
    }
    return NextResponse.json({ entries, updatedAt: row.updatedAt });
  } catch {
    return NextResponse.json({ entries: [], error: "read failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  let body: {
    entries?: unknown;
    removedPaths?: unknown;
    mode?: unknown;
  } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const entries = sanitize(body?.entries);
  const mode = body?.mode === "replace" ? "replace" : "merge";
  // tombstones: paths the user explicitly deleted in this browser — without
  // them a merge would resurrect deleted overlays when another browser's
  // older session still carries the entry
  const removedPaths = new Set(
    Array.isArray(body?.removedPaths)
      ? body.removedPaths
          .filter((p): p is string => typeof p === "string" && !!p && p.length <= 512 && !p.includes("\0"))
          .slice(0, 24)
      : [],
  );
  try {
    const job = await db.job.findUnique({ where: { id }, select: { id: true } });
    if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

    let final = entries;
    if (mode === "merge") {
      // concurrent-browser merge: the client's list is the LIVE edit for the
      // paths it carries, but paths it never saw (edited in another browser
      // since this mount) must survive instead of being clobbered by a
      // last-write-wins replace. "replace" mode is the restore self-heal,
      // which HAS validated against the live outputs and speaks absolute truth.
      const row = await db.overlaySession.findUnique({ where: { jobId: id } });
      let existing: OverlayEntry[] = [];
      if (row) {
        try {
          existing = sanitize(JSON.parse(row.data));
        } catch {
          existing = []; // corrupt row — the client list rebuilds it
        }
      }
      const byPath = new Map(existing.filter((e) => !removedPaths.has(e.path)).map((e) => [e.path, e]));
      for (const e of entries) byPath.set(e.path, e);
      final = [...byPath.values()].slice(0, MAX_ENTRIES);
    }

    if (final.length === 0) {
      // empty session = no overlays — drop the row instead of storing []
      await db.overlaySession.deleteMany({ where: { jobId: id } });
    } else {
      await db.overlaySession.upsert({
        where: { jobId: id },
        update: { data: JSON.stringify(final) },
        create: { jobId: id, data: JSON.stringify(final) },
      });
    }
    return NextResponse.json({ ok: true, count: final.length });
  } catch {
    return NextResponse.json({ error: "persist failed" }, { status: 500 });
  }
}
