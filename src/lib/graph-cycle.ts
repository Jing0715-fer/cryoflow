/**
 * THE one cycle detector for every door that lands edges in the world
 * (Task 180). The canvas prevents interactive cycles and POST /api/edges
 * rejects them — but the BATCH doors (workflow-import, custom-template
 * save/instantiate) each skipped that check, so a hand-edited JSON could
 * land a cycle no other door would ever produce. One pure, isomorphic
 * implementation consumed by every door: the shellJoin doctrine applied
 * to graph integrity (one rule, many consumers, the doors cannot drift).
 */

export interface CycleEdge {
  from: string;
  to: string;
}

/**
 * Depth-first search with WHITE/GRAY/BLACK coloring over a batch graph.
 * Returns the cycle path in walking order with the first node repeated
 * last (e.g. ["0","1","2","0"] → "A → B → C → A"), or null when acyclic.
 *
 * - Edge endpoints missing from `nodes` are IGNORED (the script's dangling
 *   rule): callers decide what a dangling endpoint means.
 * - Deterministic: roots walk in `nodes` order, adjacency in edge order —
 *   the same batch always yields the same first cycle.
 * - Iterative on purpose: a recursive DFS blows the stack on deep batches
 *   (imports allow MAX_JOBS=500).
 */
export function findCycle(
  nodes: readonly string[],
  edges: readonly CycleEdge[]
): string[] | null {
  const present = new Set(nodes);
  const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
  for (const e of edges) {
    if (!present.has(e.from) || !present.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
  }
  const UNSEEN = 0;
  const IN_STACK = 1;
  const DONE = 2;
  const color = new Map<string, number>(nodes.map((n) => [n, UNSEEN]));
  const parent = new Map<string, string>();
  for (const root of nodes) {
    if (color.get(root) !== UNSEEN) continue;
    color.set(root, IN_STACK);
    const stack: Array<{ node: string; i: number }> = [{ node: root, i: 0 }];
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const nexts = adj.get(top.node)!;
      if (top.i < nexts.length) {
        const next = nexts[top.i++];
        if (color.get(next) === UNSEEN) {
          color.set(next, IN_STACK);
          parent.set(next, top.node);
          stack.push({ node: next, i: 0 });
        } else if (color.get(next) === IN_STACK) {
          // found one — walk the parent chain back to `next`, then close
          // the loop by repeating it (the repeated last node is the
          // contract: "A → B → A" reads as a cycle, not as two names)
          const cycle = [next];
          let cur = top.node;
          while (cur !== next) {
            cycle.push(cur);
            cur = parent.get(cur)!;
          }
          cycle.push(next);
          return cycle;
        }
      } else {
        color.set(top.node, DONE);
        stack.pop();
      }
    }
  }
  return null;
}

/**
 * "A → B → A" — the human line for 400 bodies and dialog errors. The
 * repeated first/last node is the cycle closing, not a duplicate name.
 */
export function formatCyclePath(
  cycle: readonly string[],
  nameOf: (k: string) => string
): string {
  return cycle.map(nameOf).join(" → ");
}
