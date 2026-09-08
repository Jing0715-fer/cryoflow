import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/* Camera bookmarks — server-side copy of the 3D viewer's saved poses  */
/* ------------------------------------------------------------------ */
// A good viewing angle is a one-time hunt (channel axis, preferred
// particle orientation) — the localStorage list keeps it per browser,
// this row makes it follow the JOB across browsers and devices. Unlike
// overlay entries, a bookmark cannot go stale: the snapshot is pure
// camera numbers with no reference to files, so there is no self-heal
// pass here — only a strict shape whitelist at the door.

interface BookmarkSnapshot {
  mode?: string;
  fov?: number;
  position?: number[];
  up?: number[];
  target?: number[];
  radius?: number;
  radiusMax?: number;
  fog?: number;
  clipFar?: number;
  minNear?: number;
  minFar?: number;
}

interface BookmarkView {
  sigma: number;
  sign: number;
  slice: { on: boolean; axis: string; pos: number };
  clip: { on: boolean; x: number; y: number; z: number; invert: boolean };
}

interface BookmarkEntry {
  id: string;
  name: string;
  ts: number;
  thumb?: string;
  snapshot: BookmarkSnapshot;
  view?: BookmarkView;
}

const MAX_BOOKMARKS = 8;
const MAX_THUMB_CHARS = 48_000; // ~36 KB binary per JPEG data URL
const THUMB_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** vec3 of finite numbers within sane bounds — camera positions live far
 *  below 1e9 even on zoomed-out fits, anything larger is corruption */
function vec3(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length !== 3) return undefined;
  const v = raw.map((n) => (isFiniteNum(n) ? Math.min(1e9, Math.max(-1e9, n)) : NaN));
  if (v.some((n) => Number.isNaN(n))) return undefined;
  return v;
}

const bounded = (v: unknown, lo: number, hi: number, fallback: number): number =>
  isFiniteNum(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

/** the optical half of a saved view — contour σ (and sign), the slice
 *  plane and the clip box. A bookmark that restores only the camera
 *  brings you back to the right angle looking at the WRONG threshold;
 *  view state makes "fly back" mean the whole picture. */
function sanitizeView(raw: unknown): BookmarkView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const sl = (v.slice ?? {}) as Record<string, unknown>;
  const cp = (v.clip ?? {}) as Record<string, unknown>;
  const axis = sl.axis === "X" || sl.axis === "Y" || sl.axis === "Z" ? sl.axis : "Z";
  return {
    sigma: bounded(v.sigma, 0.01, 100, 2),
    sign: v.sign === -1 ? -1 : 1,
    slice: {
      on: sl.on === true,
      axis,
      pos: bounded(sl.pos, 0, 1, 0.5),
    },
    clip: {
      on: cp.on === true,
      x: bounded(cp.x, 0, 1, 1),
      y: bounded(cp.y, 0, 1, 1),
      z: bounded(cp.z, 0, 1, 1),
      invert: cp.invert === true,
    },
  };
}

function sanitizeSnapshot(raw: unknown): BookmarkSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  const out: BookmarkSnapshot = {};
  if (typeof s.mode === "string" && s.mode) out.mode = s.mode.slice(0, 32);
  out.fov = bounded(s.fov, 0.001, Math.PI, 0.876);
  const pos = vec3(s.position);
  const up = vec3(s.up);
  const tgt = vec3(s.target);
  if (!pos || !up || !tgt) return null; // the three vec3s ARE the pose
  out.position = pos;
  out.up = up;
  out.target = tgt;
  out.radius = bounded(s.radius, 1e-6, 1e12, 10);
  out.radiusMax = bounded(s.radiusMax, 1e-6, 1e12, 1e4);
  out.fog = bounded(s.fog, 0, 1e12, 0);
  out.clipFar = bounded(s.clipFar, 0, 1e12, 0);
  out.minNear = bounded(s.minNear, -1e9, 1e9, 0);
  out.minFar = bounded(s.minFar, 0, 1e12, 0);
  return out;
}

/** defensive shape pass — the client is friendly, the API is not trusting
 *  (same posture as the overlay-session route) */
function sanitize(raw: unknown): BookmarkEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: BookmarkEntry[] = [];
  for (const r of raw.slice(0, MAX_BOOKMARKS)) {
    if (!r || typeof r !== "object") continue;
    const e = r as Record<string, unknown>;
    if (typeof e.id !== "string" || !e.id || e.id.length > 64) continue;
    if (typeof e.name !== "string" || !e.name) continue;
    if (!isFiniteNum(e.ts)) continue;
    const snapshot = sanitizeSnapshot(e.snapshot);
    if (!snapshot) continue;
    const entry: BookmarkEntry = {
      id: e.id.slice(0, 64),
      name: e.name.slice(0, 80),
      ts: Math.min(Date.now() + 60_000, Math.max(0, e.ts)),
      snapshot,
    };
    if (typeof e.thumb === "string" && e.thumb.length <= MAX_THUMB_CHARS && THUMB_RE.test(e.thumb)) {
      entry.thumb = e.thumb;
    }
    const view = sanitizeView(e.view);
    if (view) entry.view = view;
    out.push(entry);
  }
  return out;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  try {
    const row = await db.bookmarkSession.findUnique({ where: { jobId: id } });
    if (!row) return NextResponse.json({ bookmarks: [] });
    let bookmarks: BookmarkEntry[] = [];
    try {
      bookmarks = sanitize(JSON.parse(row.data));
    } catch {
      bookmarks = []; // corrupt row reads as empty — the client rewrites it
    }
    return NextResponse.json({ bookmarks, updatedAt: row.updatedAt });
  } catch {
    return NextResponse.json({ bookmarks: [], error: "read failed" }, { status: 500 });
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
  const bookmarks = sanitize((body as { bookmarks?: unknown } | null)?.bookmarks);
  try {
    const job = await db.job.findUnique({ where: { id }, select: { id: true } });
    if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
    if (bookmarks.length === 0) {
      // empty list = no saved views — drop the row instead of storing []
      await db.bookmarkSession.deleteMany({ where: { jobId: id } });
    } else {
      await db.bookmarkSession.upsert({
        where: { jobId: id },
        update: { data: JSON.stringify(bookmarks) },
        create: { jobId: id, data: JSON.stringify(bookmarks) },
      });
    }
    return NextResponse.json({ ok: true, count: bookmarks.length });
  } catch {
    return NextResponse.json({ error: "persist failed" }, { status: 500 });
  }
}
