"use client";

/**
 * SVG edge layer — obstacle-avoiding routing.
 *
 * Each connection is routed with A* over a 20px grid (120 x 80 cells) whose
 * obstacles are the job rects inflated by 12px, so edges never cross cards
 * and thin corridors between adjacent cards stay usable. Routing falls back
 * to an S-shaped bezier detour when the search fails (capped iterations).
 *
 * The SVG itself ignores pointer events except the invisible wide "hit"
 * strokes (hover highlight) and the hover delete affordance.
 */

import * as React from "react";
import { CANVAS_H, CANVAS_W, CARD_H, CARD_W, jobType, portY } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import type { EdgeDTO, JobDTO } from "@/lib/types";

const STROKE_BASE = "color-mix(in oklch, var(--foreground) 22%, transparent)";
const STROKE_ACTIVE = "color-mix(in oklch, var(--foreground) 45%, transparent)";
const FILL_BASE = "color-mix(in oklch, var(--foreground) 30%, transparent)";

/* ------------------------------------------------------------------ */
/* A* grid routing                                                     */
/* ------------------------------------------------------------------ */

const CELL = 20;
const COLS = Math.floor(CANVAS_W / CELL); // 120
const ROWS = Math.floor(CANVAS_H / CELL); // 80
/** Rect inflation so paths keep a visual margin around cards. */
const INFLATE = 12;
const MAX_ITER = 20000;
const SQRT2 = Math.SQRT2;

interface Pt {
  x: number;
  y: number;
}

interface Cell {
  r: number;
  c: number;
}

interface RoutedEdge {
  d: string;
  arrowD: string;
  mid: Pt;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Min-heap keyed on f-score for the A* open list. */
class MinHeap {
  private nodes: { idx: number; f: number }[] = [];

  get size() {
    return this.nodes.length;
  }

  push(node: { idx: number; f: number }) {
    const a = this.nodes;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      const tmp = a[p];
      a[p] = a[i];
      a[i] = tmp;
      i = p;
    }
  }

  pop(): { idx: number; f: number } | undefined {
    const a = this.nodes;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop() as { idx: number; f: number };
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const rr = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (rr < a.length && a[rr].f < a[m].f) m = rr;
        if (m === i) break;
        const tmp = a[m];
        a[m] = a[i];
        a[i] = tmp;
        i = m;
      }
    }
    return top;
  }
}

/** Obstacle grid: job rects inflated by INFLATE, border ring kept free. */
function buildGrid(jobs: JobDTO[]): Uint8Array {
  const g = new Uint8Array(COLS * ROWS);
  for (const j of jobs) {
    const c0 = Math.max(0, Math.floor((j.x - INFLATE) / CELL));
    const c1 = Math.min(COLS - 1, Math.ceil((j.x + CARD_W + INFLATE) / CELL) - 1);
    const r0 = Math.max(0, Math.floor((j.y - INFLATE) / CELL));
    const r1 = Math.min(ROWS - 1, Math.ceil((j.y + CARD_H + INFLATE) / CELL) - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) g[r * COLS + c] = 1;
    }
  }
  // always keep a 1-cell ring around the grid free so obstacles are escapable
  for (let c = 0; c < COLS; c++) {
    g[c] = 0;
    g[(ROWS - 1) * COLS + c] = 0;
  }
  for (let r = 0; r < ROWS; r++) {
    g[r * COLS] = 0;
    g[r * COLS + COLS - 1] = 0;
  }
  return g;
}

/** Nearest unblocked cell to a workspace point (spiral search). */
function nearestFree(g: Uint8Array, px: number, py: number): Cell {
  const c = Math.min(COLS - 1, Math.max(0, Math.round((px - CELL / 2) / CELL)));
  const r = Math.min(ROWS - 1, Math.max(0, Math.round((py - CELL / 2) / CELL)));
  if (!g[r * COLS + c]) return { r, c };
  for (let rad = 1; rad <= 12; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue; // ring only
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
        if (!g[nr * COLS + nc]) return { r: nr, c: nc };
      }
    }
  }
  return { r, c };
}

const DIRS: readonly (readonly [number, number, number])[] = [
  [-1, 0, 1],
  [1, 0, 1],
  [0, -1, 1],
  [0, 1, 1],
  [-1, -1, SQRT2],
  [-1, 1, SQRT2],
  [1, -1, SQRT2],
  [1, 1, SQRT2],
];

/** A* over the grid: 8-directional, no corner cutting, manhattan heuristic. */
function findPath(g: Uint8Array, start: Cell, goal: Cell): Cell[] | null {
  const n = ROWS * COLS;
  const sIdx = start.r * COLS + start.c;
  const tIdx = goal.r * COLS + goal.c;
  if (sIdx === tIdx) return [start];

  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = new MinHeap();
  const h = (r: number, c: number) => Math.abs(r - goal.r) + Math.abs(c - goal.c);

  gScore[sIdx] = 0;
  open.push({ idx: sIdx, f: h(start.r, start.c) });

  let found = false;
  let iter = 0;
  while (open.size > 0 && iter < MAX_ITER) {
    iter++;
    const cur = open.pop();
    if (!cur) break;
    if (closed[cur.idx]) continue;
    closed[cur.idx] = 1;
    if (cur.idx === tIdx) {
      found = true;
      break;
    }
    const r = (cur.idx / COLS) | 0;
    const c = cur.idx % COLS;
    for (const [dr, dc, cost] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
      if (g[nr * COLS + nc]) continue;
      // no corner cutting: both orthogonal neighbours must be free
      if (dr !== 0 && dc !== 0 && (g[r * COLS + nc] || g[nr * COLS + c])) continue;
      const nIdx = nr * COLS + nc;
      if (closed[nIdx]) continue;
      const ng = gScore[cur.idx] + cost;
      if (ng < gScore[nIdx]) {
        gScore[nIdx] = ng;
        came[nIdx] = cur.idx;
        open.push({ idx: nIdx, f: ng + h(nr, nc) });
      }
    }
  }
  if (!found) return null;

  const cells: Cell[] = [];
  let cur = tIdx;
  while (cur !== -1 && cur !== sIdx) {
    cells.push({ r: (cur / COLS) | 0, c: cur % COLS });
    cur = came[cur];
  }
  cells.push(start);
  cells.reverse();
  return cells;
}

/** Drop collinear points from a polyline. */
function simplify(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 0.01) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** SVG path with quadratic-rounded corners (radius ~10px). */
function roundedPathD(pts: Pt[], radius = 10): string {
  if (pts.length < 2) return "";
  let d = `M ${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const p = pts[i];
    const next = pts[i + 1];
    const d1 = Math.hypot(p.x - prev.x, p.y - prev.y);
    const d2 = Math.hypot(next.x - p.x, next.y - p.y);
    if (d1 < 1e-6 || d2 < 1e-6) continue;
    const rr = Math.min(radius, d1 / 2, d2 / 2);
    const ax = p.x - ((p.x - prev.x) / d1) * rr;
    const ay = p.y - ((p.y - prev.y) / d1) * rr;
    const bx = p.x + ((next.x - p.x) / d2) * rr;
    const by = p.y + ((next.y - p.y) / d2) * rr;
    d += ` L ${r2(ax)} ${r2(ay)} Q ${r2(p.x)} ${r2(p.y)} ${r2(bx)} ${r2(by)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${r2(last.x)} ${r2(last.y)}`;
  return d;
}

/** Small triangle at the target port, oriented along the final segment. */
function arrowTriangle(tipX: number, tipY: number, angle: number, back = 1.5): string {
  const s = 7;
  const spread = 0.35;
  const tx = tipX - Math.cos(angle) * back;
  const ty = tipY - Math.sin(angle) * back;
  const b1x = tx - s * Math.cos(angle + spread);
  const b1y = ty - s * Math.sin(angle + spread);
  const b2x = tx - s * Math.cos(angle - spread);
  const b2y = ty - s * Math.sin(angle - spread);
  return `M ${r2(tx)} ${r2(ty)} L ${r2(b1x)} ${r2(b1y)} L ${r2(b2x)} ${r2(b2y)} Z`;
}

/** Arc-length midpoint of a polyline. */
function polylineMid(pts: Pt[]): Pt {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  let target = total / 2;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (seg > 0 && acc + seg >= target) {
      const t = (target - acc) / seg;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
    acc += seg;
  }
  return pts[pts.length - 1];
}

/** Route one edge; falls back to an S-shaped bezier when A* fails. */
function routeEdge(grid: Uint8Array, sx: number, sy: number, ex: number, ey: number): RoutedEdge {
  // start just outside the source card's inflated right edge,
  // goal just left of the target card's inflated left edge
  const start = nearestFree(grid, sx + INFLATE + 3, sy);
  const goal = nearestFree(grid, ex - INFLATE - 3, ey);
  const cells = findPath(grid, start, goal);
  if (cells) {
    const cellPts = cells.map((c) => ({ x: c.c * CELL + CELL / 2, y: c.r * CELL + CELL / 2 }));
    const pts = simplify([{ x: sx, y: sy }, ...cellPts, { x: ex, y: ey }]);
    const prev = pts.length >= 2 ? pts[pts.length - 2] : { x: ex - 10, y: ey };
    const angle = Math.atan2(ey - prev.y, ex - prev.x);
    return {
      d: roundedPathD(pts),
      arrowD: arrowTriangle(ex, ey, angle),
      mid: polylineMid(pts),
    };
  }

  // fallback: S-shaped bezier detour (like the previous geometry())
  const dx = Math.max(48, Math.abs(ex - sx) * 0.45);
  const c1x = sx + dx;
  const c2x = ex - dx;
  const d = `M ${r2(sx)} ${r2(sy)} C ${r2(c1x)} ${r2(sy)} ${r2(c2x)} ${r2(ey)} ${r2(ex)} ${r2(ey)}`;
  const angle = Math.atan2(ey - ey, ex - c2x);
  return {
    d,
    arrowD: arrowTriangle(ex, ey, angle),
    mid: {
      x: 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * ex,
      y: 0.125 * sy + 0.375 * sy + 0.375 * ey + 0.125 * ey,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Layer                                                               */
/* ------------------------------------------------------------------ */

/**
 * Module-level path cache registry (NOT a React ref — it is a pure
 * memoization store keyed by the jobs-array identity). During a drag only
 * the edges touching the dragged job miss the cache and re-route; the
 * others reuse their path. After the commit (new jobs array) all re-route.
 */
const pathCacheRegistry = new WeakMap<JobDTO[], Map<string, RoutedEdge>>();

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

  const jobMap = React.useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  // jobs with the live drag offset applied (obstacle + endpoint move together)
  const liveJobs = React.useMemo(
    () =>
      dragLive
        ? jobs.map((j) =>
            j.id === dragLive.id ? { ...j, x: j.x + dragLive.dx, y: j.y + dragLive.dy } : j
          )
        : jobs,
    [jobs, dragLive]
  );
  const grid = React.useMemo(() => buildGrid(liveJobs), [liveJobs]);

  const pathCache = React.useMemo(() => {
    let cache = pathCacheRegistry.get(jobs);
    if (!cache) {
      cache = new Map();
      pathCacheRegistry.set(jobs, cache);
    }
    return cache;
  }, [jobs]);

  const visible = React.useMemo(
    () =>
      edges
        .map((e) => {
          const from = jobMap.get(e.fromJobId);
          const to = jobMap.get(e.toJobId);
          return from && to ? { edge: e, from, to } : null;
        })
        .filter((x): x is { edge: EdgeDTO; from: JobDTO; to: JobDTO } => x !== null),
    [edges, jobMap]
  );

  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      className="pointer-events-none absolute left-0 top-0"
      aria-hidden="true"
    >
      {visible.map(({ edge, from, to }) => {
        // apply live drag offset to whichever endpoint is being dragged
        const fromAdj =
          dragLive && dragLive.id === from.id
            ? { ...from, x: from.x + dragLive.dx, y: from.y + dragLive.dy }
            : from;
        const toAdj =
          dragLive && dragLive.id === to.id
            ? { ...to, x: to.x + dragLive.dx, y: to.y + dragLive.dy }
            : to;
        const fromSpec = jobType(fromAdj.type);
        const toSpec = jobType(toAdj.type);
        const outIdx = Math.max(0, fromSpec?.outputs.findIndex((p) => p.name === edge.fromPort) ?? 0);
        const inIdx = Math.max(0, toSpec?.inputs.findIndex((p) => p.name === edge.toPort) ?? 0);
        const nOut = Math.max(1, fromSpec?.outputs.length ?? 0);
        const nIn = Math.max(1, toSpec?.inputs.length ?? 0);
        const x1 = fromAdj.x + CARD_W;
        const y1 = fromAdj.y + portY(outIdx, nOut);
        const x2 = toAdj.x;
        const y2 = toAdj.y + portY(inIdx, nIn);

        const key = `${Math.round(x1)},${Math.round(y1)},${Math.round(x2)},${Math.round(y2)}`;
        let routed = pathCache.get(key);
        if (!routed) {
          routed = routeEdge(grid, x1, y1, x2, y2);
          pathCache.set(key, routed);
        }

        const running = from.status === "running";
        const hovered = hoveredId === edge.id;
        const stroke = running ? "var(--primary)" : hovered ? STROKE_ACTIVE : STROKE_BASE;
        const fill = running ? "var(--primary)" : hovered ? STROKE_ACTIVE : FILL_BASE;
        const width = hovered ? 2.5 : 2;

        return (
          <g key={edge.id}>
            {/* invisible hit area for hover */}
            <path
              d={routed.d}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: "stroke" }}
              onPointerEnter={() => setHoveredId(edge.id)}
              onPointerLeave={() => setHoveredId((cur) => (cur === edge.id ? null : cur))}
            />
            <path
              d={routed.d}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={running ? "edge-flow" : undefined}
            />
            <path d={routed.arrowD} fill={fill} />
            {/* hover delete affordance at the path midpoint */}
            {hovered && (
              <g
                data-canvas-ui="edge-delete"
                transform={`translate(${r2(routed.mid.x)}, ${r2(routed.mid.y)})`}
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
