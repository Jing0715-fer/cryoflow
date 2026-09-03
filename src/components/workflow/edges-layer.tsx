"use client";

/**
 * SVG edge layer — obstacle-avoiding, de-overlapped routing.
 *
 * Routing pipeline per edge (edges are routed SEQUENTIALLY in a
 * deterministic order so parallel wires settle into neighbouring
 * corridors instead of stacking):
 *
 *   1. A* over a 20px grid (120 x 80 cells), state = (cell x direction):
 *      a TURN_COST (2.2 cells) is paid whenever the move direction changes,
 *      which strongly prefers long straight runs and kills staircases.
 *      Obstacles are job rects inflated by INFLATE (24px) so wires keep a
 *      comfortable margin around cards; the edge's own source/target cards
 *      are re-stamped as bare bodies so their port channels stay usable.
 *      Cells already used by a previously routed edge add a soft OCC_COST
 *      (1.8) — passable but expensive — which separates parallel edges.
 *   2. String-pull shortcut pass (max 3) on [stub → cell centres → stub]:
 *      greedily replaces sub-paths with straight segments that have
 *      line-of-sight on the obstacle grid AND the occupancy grid (no corner
 *      cut on diagonals), so wires collapse onto the ideal port-to-port
 *      line when the corridor is clear, yet never shortcut back onto an
 *      earlier wire's corridor. Occupancy is locally forgiven within ~30px
 *      of the two stubs (fan-out/fan-in wires necessarily share that
 *      pocket around a common port).
 *   3. Endpoint stubs: every polyline leaves the source port going RIGHT
 *      and enters the target port from the LEFT via explicit 18px stub
 *      points, then collinear points are merged. A final safety check
 *      rejects any path that would enter a card body (bezier fallback).
 *
 * Fallback for failed searches (capped iterations): S-shaped bezier with a
 * >= 60px control offset so the curve also clears cards.
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
const INFLATE = 24;
/** Extra cost (in cell units) whenever the move direction changes. */
const TURN_COST = 2.2;
/** Soft cost for cells already used by a previously routed edge. */
const OCC_COST = 1.8;
/** Horizontal stub leaving the source / entering the target port. */
const STUB = 18;
/** Max A* pops before falling back to the bezier detour. */
const MAX_ITER = 15000;
const SQRT2 = Math.SQRT2;
/** Direction index for "moving right" (see DIRS). */
const DIR_RIGHT = 1;

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
  /** Simplified polyline (for occupancy rasterization of cached edges). */
  pts: Pt[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Min-heap keyed on f-score for the A* open list. */
class MinHeap {
  private nodes: { idx: number; f: number }[] = [];

  get size() {
    return this.nodes.length;
  }

  clear() {
    this.nodes.length = 0;
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

function stampRect(
  g: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  v: number
) {
  const c0 = Math.max(0, Math.floor(x0 / CELL));
  const c1 = Math.min(COLS - 1, Math.ceil(x1 / CELL) - 1);
  const r0 = Math.max(0, Math.floor(y0 / CELL));
  const r1 = Math.min(ROWS - 1, Math.ceil(y1 / CELL) - 1);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) g[r * COLS + c] = v;
  }
}

/** Obstacle grid: job rects inflated by INFLATE, border ring kept free. */
function buildGrid(jobs: JobDTO[]): Uint8Array {
  const g = new Uint8Array(COLS * ROWS);
  for (const j of jobs) {
    stampRect(g, j.x - INFLATE, j.y - INFLATE, j.x + CARD_W + INFLATE, j.y + CARD_H + INFLATE, 1);
  }
  // always keep a 1-cell ring around the grid free so obstacles are escapable
  clearBorderRing(g);
  return g;
}

function clearBorderRing(g: Uint8Array) {
  for (let c = 0; c < COLS; c++) {
    g[c] = 0;
    g[(ROWS - 1) * COLS + c] = 0;
  }
  for (let r = 0; r < ROWS; r++) {
    g[r * COLS] = 0;
    g[r * COLS + COLS - 1] = 0;
  }
}

/**
 * Per-edge obstacle grid: the shared grid with the SOURCE and TARGET jobs
 * re-stamped as their bare card bodies (no inflation). This opens the port
 * exit/entry channels so the stub connector never has to tunnel around the
 * wire's own endpoint cards (the 42px inter-layer gap stays usable), while
 * every OTHER card keeps its full 24px clearance halo.
 */
function perEdgeGrid(shared: Uint8Array, from: JobDTO, to: JobDTO): Uint8Array {
  const g = shared.slice();
  // clear both inflation halos first, THEN stamp both bodies — the order
  // matters: a clear after a body stamp could un-block a cell where an
  // endpoint's halo merely clips the other endpoint's body at cell level
  for (const j of [from, to]) {
    stampRect(g, j.x - INFLATE, j.y - INFLATE, j.x + CARD_W + INFLATE, j.y + CARD_H + INFLATE, 0);
  }
  for (const j of [from, to]) {
    stampRect(g, j.x, j.y, j.x + CARD_W, j.y + CARD_H, 1);
  }
  if (g[0] || g[COLS - 1] || g[(ROWS - 1) * COLS] || g[(ROWS - 1) * COLS + COLS - 1]) {
    clearBorderRing(g); // stamps may have touched the escape ring
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

/*
 * A* with direction states: idx = cellIndex * 8 + dir. Scratch buffers are
 * module-level and stamped with a generation counter (routing is strictly
 * synchronous) to avoid ~1MB allocations per search.
 */
const N_STATES = COLS * ROWS * 8;
const gScore = new Float64Array(N_STATES);
const gGen = new Int32Array(N_STATES);
const cameS = new Int32Array(N_STATES);
const closedGen = new Int32Array(N_STATES);
let astarGen = 0;
const openHeap = new MinHeap();

/**
 * A* over (cell x direction) states: 8-directional, no corner cutting,
 * manhattan heuristic, TURN_COST on direction changes, OCC_COST on cells
 * already claimed by earlier edges. Stays admissible (turn/occ >= 0).
 */
function findPath(g: Uint8Array, occ: Uint8Array, start: Cell, goal: Cell): Cell[] | null {
  const goalCell = goal.r * COLS + goal.c;
  const startCell = start.r * COLS + start.c;
  if (startCell === goalCell) return [start];

  astarGen++;
  openHeap.clear();
  const h = (cell: number) =>
    Math.abs(((cell / COLS) | 0) - goal.r) + Math.abs((cell % COLS) - goal.c);

  // seed: the wire leaves the source stub moving right
  const startState = startCell * 8 + DIR_RIGHT;
  gGen[startState] = astarGen;
  gScore[startState] = 0;
  cameS[startState] = -1;
  openHeap.push({ idx: startState, f: h(startCell) });

  let found = -1;
  let iter = 0;
  while (openHeap.size > 0 && iter < MAX_ITER) {
    iter++;
    const cur = openHeap.pop();
    if (!cur) break;
    if (closedGen[cur.idx] === astarGen) continue;
    closedGen[cur.idx] = astarGen;
    const cell = cur.idx >> 3;
    if (cell === goalCell) {
      found = cur.idx;
      break;
    }
    const pd = cur.idx & 7;
    const r = (cell / COLS) | 0;
    const c = cell % COLS;
    for (let d = 0; d < 8; d++) {
      const [dr, dc, cost] = DIRS[d];
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue;
      const nCell = nr * COLS + nc;
      if (g[nCell]) continue;
      // no corner cutting: both orthogonal neighbours must be free
      if (dr !== 0 && dc !== 0 && (g[r * COLS + nc] || g[nr * COLS + c])) continue;
      const ng =
        gScore[cur.idx] + cost + (d !== pd ? TURN_COST : 0) + (occ[nCell] ? OCC_COST : 0);
      const nState = nCell * 8 + d;
      if (gGen[nState] === astarGen && ng >= gScore[nState]) continue;
      gGen[nState] = astarGen;
      gScore[nState] = ng;
      cameS[nState] = cur.idx;
      openHeap.push({ idx: nState, f: ng + h(nCell) });
    }
  }
  if (found === -1) return null;

  const cells: Cell[] = [];
  let s = found;
  while (s !== -1) {
    const cell = s >> 3;
    const r = (cell / COLS) | 0;
    const last = cells[cells.length - 1];
    // collapse duplicate cells (path may re-enter a cell with a new direction)
    if (!last || last.r !== r || last.c !== (cell % COLS)) {
      cells.push({ r, c: cell % COLS });
    }
    s = cameS[s];
  }
  cells.reverse();
  return cells;
}

/* ------------------------------------------------------------------ */
/* String-pull shortcut pass                                           */
/* ------------------------------------------------------------------ */

/**
 * Line-of-sight between two workspace points. Blocked by obstacle cells
 * AND by cells already claimed by a previously routed edge (occupancy),
 * so shortcuts never fold one wire onto another. Diagonal transitions
 * obey the no-corner-cut rule.
 */
function losClear(
  g: Uint8Array,
  occ: Uint8Array,
  ax: number,
  ay: number,
  bx: number,
  by: number
): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (CELL * 0.45)));
  let prevC = Math.floor(ax / CELL);
  let prevR = Math.floor(ay / CELL);
  for (let i = 0; i <= steps; i++) {
    const x = ax + ((bx - ax) * i) / steps;
    const y = ay + ((by - ay) * i) / steps;
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return false;
    if (g[r * COLS + c] || occ[r * COLS + c]) return false;
    if (c !== prevC && r !== prevR) {
      // diagonal cell transition — both orthogonal neighbours must be free
      if (g[prevR * COLS + c] || g[r * COLS + prevC]) return false;
    }
    prevC = c;
    prevR = r;
  }
  return true;
}

/** Greedy string-pull: replace sub-paths with LOS-clear shortcuts (<= 3 passes). */
function stringPull(pts: Pt[], g: Uint8Array, occ: Uint8Array): Pt[] {
  let cur = pts;
  for (let pass = 0; pass < 3 && cur.length > 2; pass++) {
    const out: Pt[] = [cur[0]];
    let i = 0;
    while (i < cur.length - 1) {
      let far = i + 1;
      for (let j = i + 2; j < cur.length; j++) {
        if (!losClear(g, occ, cur[i].x, cur[i].y, cur[j].x, cur[j].y)) break;
        far = j;
      }
      out.push(cur[far]);
      i = far;
    }
    if (out.length === cur.length) break; // converged
    cur = out;
  }
  return cur;
}

/* ------------------------------------------------------------------ */
/* Occupancy rasterization (edge separation)                           */
/* ------------------------------------------------------------------ */

function markCell(occ: Uint8Array, r: number, c: number) {
  const r0 = Math.max(0, r - 1);
  const r1 = Math.min(ROWS - 1, r + 1);
  const c0 = Math.max(0, c - 1);
  const c1 = Math.min(COLS - 1, c + 1);
  for (let rr = r0; rr <= r1; rr++) {
    for (let cc = c0; cc <= c1; cc++) occ[rr * COLS + cc] = 1; // 1-cell dilation
  }
}

/** Bresenham-style walk of a polyline into the shared occupancy grid. */
function rasterizePolyline(pts: Pt[], occ: Uint8Array) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (CELL / 2)));
    for (let s = 0; s <= steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps;
      const y = a.y + ((b.y - a.y) * s) / steps;
      markCell(occ, Math.floor(y / CELL), Math.floor(x / CELL));
    }
  }
}

/** Zero the occupancy pocket around a point (shared-port stub zone). */
function clearOccNear(occ: Uint8Array, p: Pt, rad = 30) {
  const c0 = Math.max(0, Math.floor((p.x - rad) / CELL));
  const c1 = Math.min(COLS - 1, Math.floor((p.x + rad) / CELL));
  const r0 = Math.max(0, Math.floor((p.y - rad) / CELL));
  const r1 = Math.min(ROWS - 1, Math.floor((p.y + rad) / CELL));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) occ[r * COLS + c] = 0;
  }
}

/* ------------------------------------------------------------------ */
/* Path rendering helpers                                              */
/* ------------------------------------------------------------------ */

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

/** SVG path with quadratic-rounded corners (radius 16px). */
function roundedPathD(pts: Pt[], radius = 16): string {
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

/* ------------------------------------------------------------------ */
/* Single-edge routing                                                 */
/* ------------------------------------------------------------------ */

interface Endpoints {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
}

/**
 * Safety net: no wire may enter a card body. The first and last segments
 * (the port stubs) are exempt — they touch the card edges at the ports.
 */
function pathClearOfBodies(pts: Pt[], jobs: JobDTO[]): boolean {
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8));
    for (let s = 0; s <= steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps;
      const y = a.y + ((b.y - a.y) * s) / steps;
      for (const j of jobs) {
        if (x > j.x + 2 && x < j.x + CARD_W - 2 && y > j.y + 2 && y < j.y + CARD_H - 2) {
          return false;
        }
      }
    }
  }
  return true;
}

/** Route one edge; falls back to an S-shaped bezier when A* fails. */
function routeEdge(
  grid: Uint8Array,
  occ: Uint8Array,
  ep: Endpoints,
  from: JobDTO,
  to: JobDTO,
  jobs: JobDTO[]
): RoutedEdge {
  const { sx, sy, ex, ey } = ep;
  const g = perEdgeGrid(grid, from, to);
  // horizontal stubs: leave the source port going RIGHT, enter the target
  // port from the LEFT; A* runs between the cells just past the stubs
  const stubA: Pt = { x: sx + STUB, y: sy };
  const stubB: Pt = { x: ex - STUB, y: ey };
  const start = nearestFree(g, sx + STUB + 2, sy);
  const goal = nearestFree(g, ex - STUB - 2, ey);
  const cells = findPath(g, occ, start, goal);
  if (cells) {
    const cellPts = cells.map((c) => ({ x: c.c * CELL + CELL / 2, y: c.r * CELL + CELL / 2 }));
    // local occupancy view: forgive the pocket around the two stubs (fan-out
    // / fan-in wires share it around a common port) — a 9.6kB copy per edge
    const occLocal = occ.slice();
    clearOccNear(occLocal, stubA);
    clearOccNear(occLocal, stubB);
    // string-pull WITH the stubs so a clear corridor collapses onto the ideal
    // port-to-port line (kills the cell-centre y-jog beside the ports);
    // occupancy-aware LOS keeps later wires off earlier corridors
    const pulled = stringPull([stubA, ...cellPts, stubB], g, occLocal);
    const pts = simplify([{ x: sx, y: sy }, ...pulled, { x: ex, y: ey }]);
    const prev = pts.length >= 2 ? pts[pts.length - 2] : { x: ex - STUB, y: ey };
    const angle = Math.atan2(ey - prev.y, ex - prev.x);
    if (pathClearOfBodies(pts, jobs)) {
      return {
        d: roundedPathD(pts),
        arrowD: arrowTriangle(ex, ey, angle),
        mid: polylineMid(pts),
        pts,
      };
    }
  }

  // fallback: S-shaped bezier detour with a >= 60px control offset
  const dx = Math.max(60, Math.abs(ex - sx) * 0.45);
  const c1x = sx + dx;
  const c2x = ex - dx;
  const d = `M ${r2(sx)} ${r2(sy)} C ${r2(c1x)} ${r2(sy)} ${r2(c2x)} ${r2(ey)} ${r2(ex)} ${r2(ey)}`;
  const angle = Math.atan2(ey - ey, ex - c2x);
  // sampled polyline so cached fallback edges rasterize into occupancy too
  const pts: Pt[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * mt * sx + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * ex,
      y: mt * mt * mt * sy + 3 * mt * mt * t * sy + 3 * mt * t * t * ey + t * t * t * ey,
    });
  }
  return {
    d,
    arrowD: arrowTriangle(ex, ey, angle),
    mid: {
      x: 0.125 * sx + 0.375 * c1x + 0.375 * c2x + 0.125 * ex,
      y: 0.125 * sy + 0.375 * sy + 0.375 * ey + 0.125 * ey,
    },
    pts,
  };
}

/* ------------------------------------------------------------------ */
/* Layer                                                               */
/* ------------------------------------------------------------------ */

interface WorkItem {
  edge: EdgeDTO;
  from: JobDTO;
  to: JobDTO;
  ep: Endpoints;
  sortKey: string;
}

/**
 * Module-level path cache registry (NOT a React ref — it is a pure
 * memoization store keyed by the jobs-array identity). During a drag only
 * the edges touching the dragged job miss the cache and re-route; the
 * others reuse their path. After the commit (new jobs array) all re-route.
 */
const pathCacheRegistry = new WeakMap<JobDTO[], Map<string, RoutedEdge>>();

/**
 * Content-signature memo (bounded) so no-op poll ticks that merely swap the
 * jobs-array identity skip the full sequential re-route.
 */
const routeMemo = new Map<string, RoutedEdge[]>();

function endpointKey(ep: Endpoints): string {
  return `${Math.round(ep.sx)},${Math.round(ep.sy)},${Math.round(ep.ex)},${Math.round(ep.ey)}`;
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

  // deterministic routing order + endpoint geometry (with live drag offsets)
  const work = React.useMemo<WorkItem[]>(() => {
    const items: {
      edge: EdgeDTO;
      from: JobDTO;
      to: JobDTO;
      ep: Endpoints;
      sortKey: string;
    }[] = [];
    for (const e of edges) {
      const from = jobMap.get(e.fromJobId);
      const to = jobMap.get(e.toJobId);
      if (!from || !to) continue;
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
      const outIdx = Math.max(0, fromSpec?.outputs.findIndex((p) => p.name === e.fromPort) ?? 0);
      const inIdx = Math.max(0, toSpec?.inputs.findIndex((p) => p.name === e.toPort) ?? 0);
      const nOut = Math.max(1, fromSpec?.outputs.length ?? 0);
      const nIn = Math.max(1, toSpec?.inputs.length ?? 0);
      items.push({
        edge: e,
        from: fromAdj,
        to: toAdj,
        ep: {
          sx: fromAdj.x + CARD_W,
          sy: fromAdj.y + portY(outIdx, nOut),
          ex: toAdj.x,
          ey: toAdj.y + portY(inIdx, nIn),
        },
        sortKey: `${e.fromJobId}|${e.fromPort ?? ""}|${e.toJobId}|${e.toPort ?? ""}`,
      });
    }
    items.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
    return items;
  }, [edges, jobMap, dragLive]);

  // sequential routing with a shared occupancy map (deterministic order):
  // earlier edges claim their corridor; later A* searches pay OCC_COST on
  // claimed cells so they settle into neighbouring corridors.
  const routed = React.useMemo(() => {
    const sig =
      `${jobs.map((j) => `${j.id}:${Math.round(j.x)},${Math.round(j.y)}`).join(";")}|` +
      `${work.map((w) => w.sortKey).join(";")}|` +
      `drag:${dragLive ? `${dragLive.id},${Math.round(dragLive.dx)},${Math.round(dragLive.dy)}` : "-"}`;
    const memoHit = routeMemo.get(sig);
    if (memoHit) return memoHit;

    const occ = new Uint8Array(COLS * ROWS);
    const results: (RoutedEdge | null)[] = new Array(work.length).fill(null);
    const activeDrag = dragLive != null;

    if (activeDrag) {
      // pass 1: edges NOT touching the dragged job reuse their cached path
      // and rasterize it into the shared occupancy map
      for (let k = 0; k < work.length; k++) {
        const w = work[k];
        if (dragLive.id === w.from.id || dragLive.id === w.to.id) continue;
        const cached = pathCache.get(endpointKey(w.ep));
        if (cached) {
          results[k] = cached;
          rasterizePolyline(cached.pts, occ);
        }
      }
      // pass 2: dragged edges re-route against that occupancy
      for (let k = 0; k < work.length; k++) {
        if (results[k]) continue;
        const w = work[k];
        const r = routeEdge(grid, occ, w.ep, w.from, w.to, liveJobs);
        pathCache.set(endpointKey(w.ep), r);
        results[k] = r;
        rasterizePolyline(r.pts, occ);
      }
    } else {
      // full sequential recompute (ignore cache, write results back into it)
      for (let k = 0; k < work.length; k++) {
        const w = work[k];
        const r = routeEdge(grid, occ, w.ep, w.from, w.to, liveJobs);
        pathCache.set(endpointKey(w.ep), r);
        results[k] = r;
        rasterizePolyline(r.pts, occ);
      }
    }

    const out = results as RoutedEdge[];
    if (routeMemo.size > 64) routeMemo.clear(); // bound growth across drags
    routeMemo.set(sig, out);
    return out;
  }, [work, grid, dragLive, pathCache, jobs, liveJobs]);

  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      className="pointer-events-none absolute left-0 top-0"
      aria-hidden="true"
    >
      {work.map((w, k) => {
        const r = routed[k];
        if (!r) return null;
        const { edge, from } = w;

        const running = from.status === "running";
        const hovered = hoveredId === edge.id;
        const stroke = running ? "var(--primary)" : hovered ? STROKE_ACTIVE : STROKE_BASE;
        const fill = running ? "var(--primary)" : hovered ? STROKE_ACTIVE : FILL_BASE;
        const width = hovered ? 2.5 : 2;

        return (
          <g key={edge.id}>
            {/* invisible hit area for hover */}
            <path
              d={r.d}
              stroke="transparent"
              strokeWidth={16}
              fill="none"
              style={{ pointerEvents: "stroke" }}
              onPointerEnter={() => setHoveredId(edge.id)}
              onPointerLeave={() => setHoveredId((cur) => (cur === edge.id ? null : cur))}
            />
            <path
              d={r.d}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={running ? "edge-flow" : undefined}
            />
            <path d={r.arrowD} fill={fill} />
            {/* hover delete affordance at the path midpoint */}
            {hovered && (
              <g
                data-canvas-ui="edge-delete"
                transform={`translate(${r2(r.mid.x)}, ${r2(r.mid.y)})`}
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
