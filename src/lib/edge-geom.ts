/**
 * CryoFlow — shared edge geometry (pure math).
 *
 * Extracted from EdgesLayer so that BOTH the React render path and the
 * drag-time direct-DOM update path compute wires with exactly the same
 * math (zero visual drift between render and drag).
 *
 * During a card drag we must not re-render the edge layer per frame —
 * instead the drag rAF loop calls `computeEdgeGeoms` with a transient
 * `dragLive` offset and patches the SVG DOM attributes directly.
 * That keeps React completely idle while a card is being dragged.
 */

import { CARD_H, CARD_W, jobType, portY } from "./workflow";
import type { EdgeDTO, JobDTO } from "./types";

/** vertical fan separation between wires sharing a port (px) */
export const FAN_SPREAD = 26;
/** minimum horizontal reach of the direct bezier control points (px) */
export const MIN_CTRL = 56;
/** stub length leaving/entering ports (px) */
export const STUB = 14;
/** clearance kept around card bodies the wire does not connect to (px) */
export const INFLATE = 7;
/** corner rounding of detour polylines (px) */
export const CORNER_R = 14;
/** vertical clearance of wrap-around arcs for backward wires (px) */
export const ARC_CLEAR = 56;

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface EdgeGeom {
  edge: EdgeDTO;
  fromId: string;
  toId: string;
  d: string;
  mid: Pt;
  srcDot: Pt;
  tgtDot: Pt;
  fromPortLabel: string;
  toPortLabel: string;
}

/** transient live-drag offset (same shape the store used to hold) */
export interface DragOffset {
  id: string;
  dx: number;
  dy: number;
}

/* ------------------------------------------------------------------ */
/* Module-level live-drag ref                                          */
/* ------------------------------------------------------------------ */

/**
 * The CURRENT drag offset, kept OUTSIDE React so the edge layer can read
 * it if some other store update forces a re-render mid-drag (e.g. an
 * in-flight poll that started before dragActive paused polling). The
 * drag loop writes it every frame; EdgesLayer reads it at render time.
 * Nobody subscribes to it — per-frame writes cost zero React work.
 */
let liveDrag: DragOffset | null = null;

export function setLiveDrag(o: DragOffset | null): void {
  liveDrag = o;
}

export function getLiveDrag(): DragOffset | null {
  return liveDrag;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Pending (live) wire path — shared by the canvas LiveWire overlay     */
/* ------------------------------------------------------------------ */

/**
 * Geometry of the rubber-band wire drawn while a connection is pending.
 * `sx, sy` is the anchored port; `cx, cy` is the cursor. Forward drags
 * use the same cubic the final edge will use; backward drags (cursor
 * behind the port) sweep a rounded arc around the port's own card so the
 * wire never folds back on itself.
 */
export function pendingWirePath(
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  dir: "out" | "in"
): string {
  // "out": anchor is an output port (right edge) — forward means the
  // cursor is to the right. "in": anchor is an input port (left edge) —
  // forward means the cursor is to the LEFT (over some output port).
  const forward = dir === "out" ? cx - sx >= MIN_CTRL : sx - cx >= MIN_CTRL;
  if (forward) {
    const reach = Math.max(MIN_CTRL, Math.abs(cx - sx) * 0.42);
    const c1 = dir === "out" ? sx + reach : sx - reach;
    const c2 = dir === "out" ? cx - reach : cx + reach;
    return `M ${r2(sx)} ${r2(sy)} C ${r2(c1)} ${r2(sy)}, ${r2(c2)} ${r2(cy)}, ${r2(cx)} ${r2(cy)}`;
  }
  // backward: stub out of the port, arc over/under the anchor card
  // (opposite side from the cursor), run across, then dock onto the cursor
  const sgn = dir === "out" ? 1 : -1; // stub direction out of the port
  const xs0 = sx + sgn * STUB;
  const xe0 = cx - sgn * STUB;
  const dy = cy > sy ? Math.min(sy, cy) - ARC_CLEAR : Math.max(sy, cy) + ARC_CLEAR;
  const poly: Pt[] = [
    { x: sx, y: sy },
    { x: xs0, y: sy },
    { x: xs0, y: dy },
    { x: xe0, y: dy },
    { x: xe0, y: cy },
    { x: cx, y: cy },
  ];
  const { d } = roundCorners(cleanPoly(poly));
  return d;
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ptInRect(p: Pt, r: Rect): boolean {
  return p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1;
}

/** Does the segment (endpoints excluded) pass through any rect? */
function segHitsRects(a: Pt, b: Pt, rects: Rect[]): boolean {
  const steps = Math.max(2, Math.ceil(dist(a, b) / 7));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    for (const r of rects) if (ptInRect(p, r)) return true;
  }
  return false;
}

/** direct cubic bezier geometry (port-to-port S-curve with fan offsets) */
function directBez(sx: number, sy: number, ex: number, ey: number, srcOff: number, tgtOff: number) {
  const reach = Math.max(MIN_CTRL, Math.abs(ex - sx) * 0.42);
  const c1x = sx + reach;
  const c1y = sy + srcOff;
  const c2x = ex - reach;
  const c2y = ey + tgtOff;
  const bez = (t: number) => {
    const u = 1 - t;
    const x = u * u * u * sx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex;
    const y = u * u * u * sy + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey;
    return { x, y };
  };
  // 27 interior samples for the collision test (t=0/1 sit on the ports)
  const pts: Pt[] = [];
  for (let i = 1; i <= 27; i++) pts.push(bez(i / 28));
  return {
    pts,
    d: `M ${r2(sx)} ${r2(sy)} C ${r2(c1x)} ${r2(c1y)}, ${r2(c2x)} ${r2(c2y)}, ${r2(ex)} ${r2(ey)}`,
    mid: bez(0.5),
  };
}

/** drop duplicate / near-collinear points from a polyline */
function cleanPoly(poly: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of poly) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 0.5 && Math.abs(last.y - p.y) < 0.5) continue;
    out.push(p);
  }
  // remove middle points that are (nearly) collinear with their neighbours
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const scale = (dist(a, b) + dist(b, c)) || 1;
    if (Math.abs(cross) / scale < 0.02) out.splice(i, 1);
  }
  return out;
}

/** polyline → SVG path with rounded corners; mid = midpoint of longest run */
function roundCorners(poly: Pt[]): { d: string; mid: Pt } {
  let d = `M ${r2(poly[0].x)} ${r2(poly[0].y)}`;
  let mid: Pt = poly[Math.floor(poly.length / 2)] ?? poly[0];
  let bestLen = -1;
  for (let i = 1; i < poly.length - 1; i++) {
    const prev = poly[i - 1];
    const c = poly[i];
    const next = poly[i + 1];
    const l1 = dist(prev, c);
    const l2 = dist(c, next);
    if (l1 > bestLen) {
      bestLen = l1;
      mid = { x: (prev.x + c.x) / 2, y: (prev.y + c.y) / 2 };
    }
    const rr = Math.min(CORNER_R, l1 * 0.4, l2 * 0.4);
    const d1 = { x: (c.x - prev.x) / l1, y: (c.y - prev.y) / l1 };
    const d2 = { x: (next.x - c.x) / l2, y: (next.y - c.y) / l2 };
    const a = { x: c.x - d1.x * rr, y: c.y - d1.y * rr };
    const b = { x: c.x + d2.x * rr, y: c.y + d2.y * rr };
    d += ` L ${r2(a.x)} ${r2(a.y)} Q ${r2(c.x)} ${r2(c.y)} ${r2(b.x)} ${r2(b.y)}`;
  }
  const last = poly[poly.length - 1];
  const prevLast = poly[poly.length - 2];
  if (prevLast && dist(prevLast, last) > bestLen) {
    mid = { x: (prevLast.x + last.x) / 2, y: (prevLast.y + last.y) / 2 };
  }
  d += ` L ${r2(last.x)} ${r2(last.y)}`;
  return { d, mid };
}

/**
 * Wrap-around route for BACKWARD wires — when the target port sits at
 * (or left of) the source port, a direct S-bezier would leave the output
 * stub rightward and immediately fold back on itself (the classic
 * hairpin loop). Instead the wire exits right, sweeps a rounded arc
 * ABOVE or BELOW both cards (whichever side is clearer), runs left, and
 * docks into the input port from the left — n8n-style, never folding.
 */
function backwardRoute(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  others: Rect[],
  selfRaw: Rect[]
): { d: string; mid: Pt } {
  const xs0 = sx + STUB; // vertical hop just right of the source card
  const xe0 = ex - STUB; // vertical hop just left of the target card
  const topY = Math.min(selfRaw[0].y0, selfRaw[1].y0) - ARC_CLEAR;
  const botY = Math.max(selfRaw[0].y1, selfRaw[1].y1) + ARC_CLEAR;
  const midY = (sy + ey) / 2;

  const poly = (dy: number): Pt[] => [
    { x: sx, y: sy },
    { x: xs0, y: sy },
    { x: xs0, y: dy },
    { x: xe0, y: dy },
    { x: xe0, y: ey },
    { x: ex, y: ey },
  ];

  // prefer the side nearer the ports' midpoint, then require it to be
  // collision-free against unrelated cards
  const ordered = [topY, botY].sort(
    (a, b) => Math.abs(a - midY) - Math.abs(b - midY)
  );
  for (const dy of ordered) {
    if (segHitsRects({ x: xs0, y: sy }, { x: xs0, y: dy }, others)) continue;
    if (segHitsRects({ x: xs0, y: dy }, { x: xe0, y: dy }, others)) continue;
    if (segHitsRects({ x: xe0, y: dy }, { x: xe0, y: ey }, others)) continue;
    return roundCorners(cleanPoly(poly(dy)));
  }
  // dense overlap — sweep below regardless (crossing a card beats a
  // fold-back loop)
  return roundCorners(cleanPoly(poly(botY)));
}

/**
 * Route one wire. `others` = inflated rects of unconnected cards;
 * `selfRaw` = raw rects of the source and target cards (ports sit on
 * their border). Returns the path string + midpoint for the delete chip.
 */
function routeWire(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  others: Rect[],
  selfRaw: Rect[],
  srcOff: number,
  tgtOff: number
): { d: string; mid: Pt } {
  // backward target (left of the source port): wrap-around arc — a
  // direct bezier here would fold back on itself (x non-monotonic)
  if (ex - sx < MIN_CTRL) {
    return backwardRoute(sx, sy, ex, ey, others, selfRaw);
  }
  const bez = directBez(sx, sy, ex, ey, srcOff, tgtOff);
  let hit = false;
  for (const p of bez.pts) {
    if (ptInRect(p, selfRaw[0]) || ptInRect(p, selfRaw[1])) {
      hit = true;
      break;
    }
    for (const r of others) {
      if (ptInRect(p, r)) {
        hit = true;
        break;
      }
    }
    if (hit) break;
  }
  if (!hit) return { d: bez.d, mid: bez.mid };

  // --- detour: corridor route through the gaps between columns ---
  const xs0 = sx + STUB; // vertical hop inside the source gap
  const xe0 = ex - STUB; // vertical hop inside the target gap
  const lo = Math.min(xs0, xe0);
  const hi = Math.max(xs0, xe0);
  const midY = (sy + ey) / 2;

  const cands = new Set<number>();
  cands.add(sy + srcOff * 0.5);
  cands.add(ey + tgtOff * 0.5);
  cands.add(midY);
  for (const r of others) {
    if (r.x1 < lo || r.x0 > hi) continue; // only cards the run would cross
    cands.add(r.y0 - 8);
    cands.add(r.y1 + 8);
  }
  const ordered = [...cands].sort((a, b) => Math.abs(a - midY) - Math.abs(b - midY));

  for (const dyRaw of ordered) {
    const dy = dyRaw; // infinite canvas — no vertical clamp
    if (segHitsRects({ x: xs0, y: sy }, { x: xs0, y: dy }, others)) continue;
    if (segHitsRects({ x: xs0, y: dy }, { x: xe0, y: dy }, others)) continue;
    if (segHitsRects({ x: xe0, y: dy }, { x: xe0, y: ey }, others)) continue;

    const poly: Pt[] = [
      { x: sx, y: sy },
      { x: xs0, y: sy },
    ];
    if (Math.abs(dy - sy) > 1.5) poly.push({ x: xs0, y: dy });
    if (Math.abs(dy - ey) > 1.5) poly.push({ x: xe0, y: dy });
    poly.push({ x: xe0, y: ey }, { x: ex, y: ey });
    const { d, mid } = roundCorners(cleanPoly(poly));
    return { d, mid };
  }

  // dense overlap — draw the smooth curve anyway
  return { d: bez.d, mid: bez.mid };
}

/**
 * Full geometry for the whole edge layer. Pure + cheap (a few thousand
 * float ops for a dozen wires) — safe to run inside a drag rAF.
 * `dragLive` offsets the dragged card's endpoints and obstacle rect.
 */
export function computeEdgeGeoms(
  edges: EdgeDTO[],
  jobs: JobDTO[],
  dragLive: DragOffset | null
): EdgeGeom[] {
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  // group keys to fan apart wires that share an endpoint
  const srcGroups = new Map<string, number>();
  const tgtGroups = new Map<string, number>();

  interface RawEdge {
    edge: EdgeDTO;
    from: JobDTO;
    to: JobDTO;
    sx: number;
    sy: number;
    ex: number;
    ey: number;
    srcKey: string;
    tgtKey: string;
    fromPortLabel: string;
    toPortLabel: string;
  }
  const raw: RawEdge[] = [];

  for (const e of edges) {
    const from = jobMap.get(e.fromJobId);
    const to = jobMap.get(e.toJobId);
    if (!from || !to) continue;
    const fdx = dragLive && dragLive.id === from.id ? dragLive.dx : 0;
    const fdy = dragLive && dragLive.id === from.id ? dragLive.dy : 0;
    const tdx = dragLive && dragLive.id === to.id ? dragLive.dx : 0;
    const tdy = dragLive && dragLive.id === to.id ? dragLive.dy : 0;
    const fromSpec = jobType(from.type);
    const toSpec = jobType(to.type);
    const outIdx = Math.max(0, fromSpec?.outputs.findIndex((p) => p.name === e.fromPort) ?? 0);
    const inIdx = Math.max(0, toSpec?.inputs.findIndex((p) => p.name === e.toPort) ?? 0);
    const nOut = Math.max(1, fromSpec?.outputs.length ?? 0);
    const nIn = Math.max(1, toSpec?.inputs.length ?? 0);
    const sx = from.x + CARD_W + fdx;
    const sy = from.y + portY(outIdx, nOut) + fdy;
    const ex = to.x + tdx;
    const ey = to.y + portY(inIdx, nIn) + tdy;
    const srcKey = `${e.fromJobId}|${e.fromPort ?? ""}`;
    const tgtKey = `${e.toJobId}|${e.toPort ?? ""}`;
    const fromPortLabel =
      fromSpec?.outputs.find((p) => p.name === e.fromPort)?.label ?? e.fromPort ?? "output";
    const toPortLabel =
      toSpec?.inputs.find((p) => p.name === e.toPort)?.label ?? e.toPort ?? "input";
    srcGroups.set(srcKey, (srcGroups.get(srcKey) ?? 0) + 1);
    tgtGroups.set(tgtKey, (tgtGroups.get(tgtKey) ?? 0) + 1);
    raw.push({
      edge: e,
      from,
      to,
      sx,
      sy,
      ex,
      ey,
      srcKey,
      tgtKey,
      fromPortLabel,
      toPortLabel,
    });
  }

  // deterministic fan-slot assignment (stable across renders)
  const srcSlot = new Map<string, number>();
  const tgtSlot = new Map<string, number>();
  raw.sort((a, b) =>
    a.srcKey < b.srcKey ? -1 : a.srcKey > b.srcKey ? 1 : a.tgtKey < b.tgtKey ? -1 : 1
  );

  // obstacle rects (with live drag offsets applied)
  const rectOf = (j: JobDTO): Rect => ({
    x0: j.x + (dragLive && dragLive.id === j.id ? dragLive.dx : 0) - INFLATE,
    y0: j.y + (dragLive && dragLive.id === j.id ? dragLive.dy : 0) - INFLATE,
    x1: j.x + (dragLive && dragLive.id === j.id ? dragLive.dx : 0) + CARD_W + INFLATE,
    y1: j.y + (dragLive && dragLive.id === j.id ? dragLive.dy : 0) + CARD_H + INFLATE,
  });
  const rawOf = (j: JobDTO): Rect => {
    const dx = dragLive && dragLive.id === j.id ? dragLive.dx : 0;
    const dy = dragLive && dragLive.id === j.id ? dragLive.dy : 0;
    return { x0: j.x + dx, y0: j.y + dy, x1: j.x + dx + CARD_W, y1: j.y + dy + CARD_H };
  };
  const rectByJob = new Map(jobs.map((j) => [j.id, rectOf(j)]));
  const rawByJob = new Map(jobs.map((j) => [j.id, rawOf(j)]));

  return raw.map((r) => {
    const ks = srcSlot.get(r.srcKey) ?? 0;
    srcSlot.set(r.srcKey, ks + 1);
    const kt = tgtSlot.get(r.tgtKey) ?? 0;
    tgtSlot.set(r.tgtKey, kt + 1);
    const ns = srcGroups.get(r.srcKey) ?? 1;
    const nt = tgtGroups.get(r.tgtKey) ?? 1;
    const srcOff = (ks - (ns - 1) / 2) * FAN_SPREAD;
    const tgtOff = (kt - (nt - 1) / 2) * FAN_SPREAD;

    // obstacles: every card except the two this wire connects
    const others: Rect[] = [];
    for (const j of jobs) {
      if (j.id === r.from.id || j.id === r.to.id) continue;
      others.push(rectByJob.get(j.id)!);
    }
    const selfRaw = [rawByJob.get(r.from.id)!, rawByJob.get(r.to.id)!];

    const { d, mid } = routeWire(r.sx, r.sy, r.ex, r.ey, others, selfRaw, srcOff, tgtOff);
    return {
      edge: r.edge,
      fromId: r.from.id,
      toId: r.to.id,
      d,
      mid,
      srcDot: { x: r.sx, y: r.sy },
      tgtDot: { x: r.ex, y: r.ey },
      fromPortLabel: r.fromPortLabel,
      toPortLabel: r.toPortLabel,
    };
  });
}
