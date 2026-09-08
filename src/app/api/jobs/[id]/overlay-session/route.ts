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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const entries = sanitize((body as { entries?: unknown } | null)?.entries);
  try {
    const job = await db.job.findUnique({ where: { id }, select: { id: true } });
    if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
    if (entries.length === 0) {
      // empty session = no overlays — drop the row instead of storing []
      await db.overlaySession.deleteMany({ where: { jobId: id } });
    } else {
      await db.overlaySession.upsert({
        where: { jobId: id },
        update: { data: JSON.stringify(entries) },
        create: { jobId: id, data: JSON.stringify(entries) },
      });
    }
    return NextResponse.json({ ok: true, count: entries.length });
  } catch {
    return NextResponse.json({ error: "persist failed" }, { status: 500 });
  }
}
