/**
 * Duplicate-run pure brains (t442) — the twin's recipe, the twin's seat.
 *
 * The store's duplicateJob existed as a template copier: params beside the
 * original, wires left to the user. The A/B loop (t439/t440's compare face)
 * wants a different animal: the SAME recipe re-runnable with one knob
 * turned — which means the upstream wiring comes along, the twin starts
 * unstarted (POST /api/jobs never dispatches), and the seat reads as a
 * parallel branch, not a card stacked on the original.
 *
 * Laws:
 *   - Inheritance flows UPSTREAM only. The twin is a new branch: its
 *     siblings keep reading the ORIGINAL's outputs; copying the downstream
 *     wires would lie about what the children consumed.
 *   - A wire is copied only when the canvas could draw it TODAY. A source
 *     whose params moved on (an Import that switched movies → micrographs)
 *     strands its old wires; the copy refuses to mint a wire the wire-tool
 *     itself would reject, and the receipt says what didn't come along.
 *   - The gallery auto-wire (t350) belongs to the server: when the POST
 *     carries classStarSelection, the source→twin edge comes back IN the
 *     response, and the copy must not draw it a second time.
 */

/** The slice of EdgeDTO the wiring math needs (the store's edges pass as-is). */
export interface EdgeLike {
  fromJobId: string;
  toJobId: string;
  fromPort?: string | null;
  toPort?: string | null;
}

/**
 * The twin's inheritance set: the wires that FEED the original.
 */
export function upstreamEdgesOf(edges: EdgeLike[], jobId: string): EdgeLike[] {
  return edges.filter((e) => e.toJobId === jobId);
}

/**
 * Which of those wires can be redrawn faithfully today? `canWire` is the
 * caller's compatibility verdict (the store's portsCompatible against the
 * live job types). Portless legacy edges pass — the wire tool draws them.
 */
export function faithfulWires<E extends EdgeLike>(
  upstream: E[],
  canWire: (e: E) => boolean
): { wires: E[]; stranded: number } {
  const wires: E[] = [];
  let stranded = 0;
  for (const e of upstream) {
    if (canWire(e)) wires.push(e);
    else stranded += 1;
  }
  return { wires, stranded };
}

/**
 * The server auto-wires the gallery source when classStarSelection rides
 * along — drop that one pair from the manual wiring list so the twin does
 * not grow the same wire twice.
 */
export function withoutAutoEdge<E extends EdgeLike>(
  wires: E[],
  auto: EdgeLike | null | undefined
): E[] {
  if (!auto) return wires;
  return wires.filter(
    (w) => !(w.fromJobId === auto.fromJobId && w.toJobId === auto.toJobId)
  );
}

/**
 * The gallery selection rides INSIDE params (an object the POST's scalar
 * filter would silently drop). Duplication lifts it top-level so the
 * server re-validates the same source & classes — a faithful twin of a
 * gallery consumer re-reads the same per-class stars.
 */
export function extractClassSelection(
  params: Record<string, unknown> | null | undefined
): { jobId: string; classes: number[] } | null {
  if (!params) return null;
  const sel = params.classStarSelection;
  if (!sel || typeof sel !== "object" || Array.isArray(sel)) return null;
  const s = sel as { jobId?: unknown; classes?: unknown };
  if (typeof s.jobId !== "string" || !Array.isArray(s.classes)) return null;
  const classes = s.classes.filter(
    (c): c is number => typeof c === "number" && Number.isInteger(c) && c > 0
  );
  if (classes.length === 0) return null;
  return { jobId: s.jobId, classes };
}

/**
 * The twin's seat: the column to the RIGHT of the original (RELION's
 * left→right grammar — a parallel branch reads at the same height),
 * walking DOWN to the first unoccupied slot. Occupied = the same card
 * overlap test the auto-arrange uses. World-clamped at the end.
 */
export function twinSpot(
  taken: Array<{ x: number; y: number }>,
  src: { x: number; y: number },
  dims: { w: number; h: number; strideX: number; strideY: number },
  world: { min: number; max: number }
): { x: number; y: number } {
  const occupied = (px: number, py: number) =>
    taken.some(
      (j) =>
        px < j.x + dims.w && px + dims.w > j.x && py < j.y + dims.h && py + dims.h > j.y
    );
  let x = src.x + dims.strideX;
  let y = src.y;
  while (occupied(x, y)) y += dims.strideY;
  return {
    x: Math.min(Math.max(x, world.min), world.max - dims.w),
    y: Math.min(Math.max(y, world.min), world.max - dims.h),
  };
}
