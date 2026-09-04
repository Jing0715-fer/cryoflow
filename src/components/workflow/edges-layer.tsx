"use client";

/**
 * SVG edge layer — n8n-style smooth connections that never cross a card.
 *
 * Routing strategy (hybrid):
 *   1. DIRECT: the classic n8n cubic bezier — leaves the output port
 *      horizontally, enters the input port horizontally. Control-point
 *      reach scales with horizontal distance (min 56px); edges sharing a
 *      port fan apart via opposing control-point offsets.
 *      The curve is sampled (27 interior points) and tested against card
 *      bodies. Source/target cards use their RAW rect (the ports live on
 *      their border); all other cards are inflated by 7px for breathing
 *      room. If nothing is hit, the smooth curve wins — the common case.
 *   2. DETOUR: when the direct curve would clip a card, the wire routes
 *      through clear corridors: a 14px stub out of the source port, a
 *      vertical hop inside the column gap, a horizontal run at a y that
 *      avoids every intermediate card (candidates from blocking-card
 *      boundaries, source/target y, and the midline), then a vertical hop
 *      in the target gap and a stub into the input port. Corners are
 *      rounded with 14px quadratic curves so the detour still feels
 *      hand-drawn rather than orthogonal.
 *   3. FALLBACK: if no clear corridor exists (dense overlap), the direct
 *      curve is drawn anyway — visual continuity beats a missing wire.
 *
 * Visual language (n8n): no arrowheads — a solid endpoint dot at the
 * target port plus a smaller dot at the source. Live edges (source job
 * running) use the primary color with marching dashes; primed edges
 * (completed → unfinished) use a soft primary tint; hover thickens and
 * reveals a delete button at the path midpoint. dragLive offsets move
 * endpoints every render (path strings are O(1) per edge).
 */

import * as React from "react";
import { CANVAS_H, CANVAS_W, CARD_H, CARD_W, jobType, portY } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import type { EdgeDTO, JobDTO } from "@/lib/types";

const STROKE_BASE = "color-mix(in oklch, var(--foreground) 32%, transparent)";
const STROKE_ACTIVE = "color-mix(in oklch, var(--foreground) 52%, transparent)";
const STROKE_READY = "color-mix(in oklch, var(--primary) 55%, transparent)";
const DOT_BASE = "color-mix(in oklch, var(--foreground) 42%, transparent)";

/** vertical fan separation between wires sharing a port (px) */
const FAN_SPREAD = 26;
/** minimum horizontal reach of the direct bezier control points (px) */
const MIN_CTRL = 56;
/** stub length leaving/entering ports (px) */
const STUB = 14;
/** clearance kept around card bodies the wire does not connect to (px) */
const INFLATE = 7;
/** corner rounding of detour polylines (px) */
const CORNER_R = 14;

interface Pt {
  x: number;
  y: number;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface EdgeGeom {
  edge: EdgeDTO;
  from: JobDTO;
  to: JobDTO;
  d: string;
  mid: Pt;
  srcDot: Pt;
  tgtDot: Pt;
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
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
): { d: string; mid: Pt; detour: boolean } {
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
  if (!hit) return { d: bez.d, mid: bez.mid, detour: false };

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
    const dy = Math.max(24, Math.min(CANVAS_H - 24, dyRaw));
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
    return { d, mid, detour: true };
  }

  // dense overlap — draw the smooth curve anyway
  return { d: bez.d, mid: bez.mid, detour: false };
}

export const EdgesLayer = React.memo(function EdgesLayer({
  edges,
  jobs,
}: {
  edges: EdgeDTO[];
  jobs: JobDTO[];
}) {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  // live drag offset — while a card is being dragged its connected edges follow it
  const dragLive = useWorkflowStore((s) => s.dragLive);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const selectedId = useWorkflowStore((s) => s.selectedId);

  const jobMap = React.useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const geoms = React.useMemo<EdgeGeom[]>(() => {
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
      srcGroups.set(srcKey, (srcGroups.get(srcKey) ?? 0) + 1);
      tgtGroups.set(tgtKey, (tgtGroups.get(tgtKey) ?? 0) + 1);
      raw.push({ edge: e, from, to, sx, sy, ex, ey, srcKey, tgtKey });
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
    const allRects = jobs.map(rectOf);
    const allRaw = jobs.map(rawOf);
    const rectByJob = new Map(jobs.map((j, i) => [j.id, allRects[i]]));
    const rawByJob = new Map(jobs.map((j, i) => [j.id, allRaw[i]]));

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
        from: r.from,
        to: r.to,
        d,
        mid,
        srcDot: { x: r.sx, y: r.sy },
        tgtDot: { x: r.ex, y: r.ey },
      };
    });
  }, [edges, jobMap, dragLive, jobs]);

  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      className="pointer-events-none absolute left-0 top-0"
      aria-hidden="true"
    >
      {geoms.map((g) => {
        const { edge, from, to } = g;

        const running = from.status === "running";
        // a completed source feeding an unfinished target — the wire is "primed"
        const primed = from.status === "completed" && to.status !== "completed";
        const touchesSelected =
          selectedId != null && (from.id === selectedId || to.id === selectedId);
        const hovered = hoveredId === edge.id;

        const stroke = running
          ? "var(--primary)"
          : hovered || touchesSelected
            ? STROKE_ACTIVE
            : primed
              ? STROKE_READY
              : STROKE_BASE;
        const dotFill = running
          ? "var(--primary)"
          : hovered || touchesSelected
            ? STROKE_ACTIVE
            : primed
              ? STROKE_READY
              : DOT_BASE;
        const width = hovered || touchesSelected ? 3.2 : running ? 2.75 : 2.25;

        return (
          <g key={edge.id}>
            {/* invisible hit area for hover */}
            <path
              d={g.d}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: "stroke" }}
              onPointerEnter={() => setHoveredId(edge.id)}
              onPointerLeave={() => setHoveredId((cur) => (cur === edge.id ? null : cur))}
            />
            <path
              d={g.d}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={running ? "edge-flow" : undefined}
              style={{ transition: "stroke 160ms ease, stroke-width 160ms ease" }}
            />
            {/* source endpoint dot */}
            <circle
              cx={r2(g.srcDot.x)}
              cy={r2(g.srcDot.y)}
              r={3}
              fill={dotFill}
              style={{ transition: "fill 160ms ease" }}
            />
            {/* target endpoint dot (n8n signature) — punched out of the port */}
            <circle
              cx={r2(g.tgtDot.x)}
              cy={r2(g.tgtDot.y)}
              r={4.2}
              fill={dotFill}
              stroke="var(--background)"
              strokeWidth={1.5}
              style={{ transition: "fill 160ms ease" }}
            />
            {/* hover delete affordance at the path midpoint */}
            {hovered && (
              <g
                data-canvas-ui="edge-delete"
                transform={`translate(${r2(g.mid.x)}, ${r2(g.mid.y)})`}
                style={{ pointerEvents: "all", cursor: "pointer" }}
                onPointerEnter={() => setHoveredId(edge.id)}
                onPointerLeave={() => setHoveredId((cur) => (cur === edge.id ? null : cur))}
                onClick={(e) => {
                  e.stopPropagation();
                  void removeEdge(edge.id);
                }}
              >
                <title>Remove connection</title>
                <circle r={16} fill="transparent" />
                <circle r={9} className="fill-card stroke-border" strokeWidth={1} />
                <path
                  d="M -3.2 -3.2 L 3.2 3.2 M 3.2 -3.2 L -3.2 3.2"
                  className="stroke-foreground"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
});
