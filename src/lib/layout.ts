/**
 * CryoFlow — one-click auto-arrange (topological layering).
 *
 * Jobs are placed in left→right layers by their dependency depth (Kahn);
 * within a layer, ordering follows the average upstream position to reduce
 * edge crossings. Each layer is wrapped into rows of at most `ROW_WRAP`
 * nodes and vertically centered.
 */

import { CARD_W, CARD_H, CANVAS_W, CANVAS_H } from "./workflow";

const MARGIN_X = 80;
const MARGIN_Y = 120;
const GAP_X = 100;
const GAP_Y = 48;
const ROW_WRAP = 4;

export function autoLayout(
  jobs: { id: string; type: string }[],
  edges: { fromJobId: string; toJobId: string }[]
): Map<string, { x: number; y: number }> {
  const ids = jobs.map((j) => j.id);
  const idSet = new Set(ids);
  const clean = edges.filter((e) => idSet.has(e.fromJobId) && idSet.has(e.toJobId));

  // in-degree over the (acyclic-checked) graph; cycle leftovers sink to the end
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const e of clean) {
    indeg.set(e.toJobId, (indeg.get(e.toJobId) ?? 0) + 1);
    const list = out.get(e.fromJobId) ?? [];
    list.push(e.toJobId);
    out.set(e.fromJobId, list);
  }

  // Kahn layers
  const layers: string[][] = [];
  const remaining = new Set(ids);
  let frontier = ids.filter((id) => (indeg.get(id) ?? 0) === 0);
  while (frontier.length > 0) {
    layers.push(frontier);
    for (const id of frontier) remaining.delete(id);
    const next: string[] = [];
    for (const id of frontier) {
      for (const dep of out.get(id) ?? []) {
        if (!remaining.has(dep)) continue;
        const d = (indeg.get(dep) ?? 1) - 1;
        indeg.set(dep, d);
        if (d === 0 && !next.includes(dep)) next.push(dep);
      }
    }
    frontier = next;
  }
  // cycle stragglers (shouldn't happen — cycle guard) get their own layer
  if (remaining.size > 0) layers.push([...remaining]);

  const positions = new Map<string, { x: number; y: number }>();

  // adaptive layer stride so the whole pipeline fits the canvas width
  // (8-layer EMPIAR pipeline: stride clamps from 320 to ~300)
  const maxStride = Math.floor(
    (CANVAS_W - MARGIN_X - CARD_W) / Math.max(1, layers.length - 1)
  );
  const strideX = Math.max(CARD_W + 40, Math.min(CARD_W + GAP_X, maxStride));

  layers.forEach((layer, li) => {
    // order within the layer: follow upstream order from the previous layer
    if (li === 0) {
      layer.sort((a, b) => a.localeCompare(b));
    } else {
      const prevOrder = new Map(layers[li - 1].map((id, i) => [id, i]));
      const score = (id: string) => {
        const ups = clean.filter((e) => e.toJobId === id).map((e) => e.fromJobId);
        const vals = ups.map((u) => prevOrder.get(u)).filter((v): v is number => v !== undefined);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : Infinity;
      };
      layer.sort((a, b) => {
        const sa = score(a);
        const sb = score(b);
        if (sa !== sb) return sa - sb;
        return a.localeCompare(b);
      });
    }

    const colX = MARGIN_X + li * strideX;
    const rows = Math.min(layer.length, ROW_WRAP);
    const colHeight = rows * CARD_H + (rows - 1) * GAP_Y;
    const startY = Math.max(MARGIN_Y, (CANVAS_H - colHeight) / 2);

    layer.forEach((id, i) => {
      // items of one layer stack vertically; overflow wraps into a
      // sub-column to the right of the layer column
      const sub = Math.floor(i / ROW_WRAP);
      const row = i % ROW_WRAP;
      positions.set(id, {
        x: Math.min(colX + sub * (CARD_W + GAP_Y), CANVAS_W - CARD_W),
        y: Math.min(startY + row * (CARD_H + GAP_Y), CANVAS_H - CARD_H),
      });
    });
  });

  return positions;
}
