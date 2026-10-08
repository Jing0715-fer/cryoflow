// t743 — the bird's-eye borrows the canvas's ink.
// t734 inked the canvas's committed wires, t742 inked the wire at its
// birthplace, t737/t738 taught the word at the legend and the I/O face —
// and the minimap, the farthest reader of all, kept muting every wire to
// the same gray. This window lets the map's wires drink the same well:
// outputKindOf at the from port → PORT_COLORS wire hex. A bird's-eye that
// tells a different color story than the canvas is lying at altitude.
//
//   A  one book, one more reader at the farthest distance: the minimap
//      imports PORT_COLORS + outputKindOf from the ONE workflow lib (no
//      second directory), derives per edge, strokes kindInk ?? currentColor,
//      and the muted class only rides wordless wires.
//   B  live-fire over the real world: every line the map would draw (both
//      endpoints in the workspace) with a from port resolves a kind — zero
//      ghost — and the inked/bare split is reported honestly.
//   C  the face: one register (the ink rides, the loudness does not — no
//      tiered opacity), the t683 chain law and t166 dim rung survive, the
//      kind anchor rides beside the id anchor, pointerEvents none keeps
//      the wires decoration.
//   D  purity: zero tailwind hue-class literals in the edge block, zero
//      storage, one workflow-lib import, the census's home still covers
//      the vocabulary.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { PORT_COLORS, outputKindOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const mm = readFileSync(path.join(here, "..", "src", "components", "workflow", "canvas-minimap.tsx"), "utf8");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

// the edge block, sliced from the edges comment to the chips block
const eStart = mm.indexOf("{/* edges (thin, kind-inked)");
const eEnd = mm.indexOf("{/* job chips colored by status", eStart);
const edgeBlock = eStart >= 0 && eEnd > eStart ? mm.slice(eStart, eEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, at the farthest reading distance                      */
/* ================================================================== */
console.log("\nA — the map drinks where the canvas drinks");

must(eStart >= 0 && eEnd > eStart,
  "A the kind-inked edge block exists in the minimap");

must(/import \{ CARD_W, CARD_H, PORT_COLORS, outputKindOf \} from "@\/lib\/workflow"/.test(mm),
  "A the minimap imports PORT_COLORS + outputKindOf from the one workflow lib");

must((mm.match(/from "@\/lib\/workflow"/g) ?? []).length === 1,
  "A one workflow-lib import — no second directory line");

must(/outputKindOf\(a\.type, e\.fromPort\)/.test(edgeBlock),
  "A the kind derives through outputKindOf at the from port (the edge layer's own question)");

must(/const kindInk = edgeKind \? PORT_COLORS\[edgeKind\]\.wire : undefined;/.test(edgeBlock),
  "A the ink is the kind's resting WIRE hex from PORT_COLORS");

must(/stroke=\{kindInk \?\? "currentColor"\}/.test(edgeBlock),
  "A the stroke rides kindInk with an explicit bare currentColor fallback");

must(/!kindInk && "text-muted-foreground"/.test(edgeBlock) && !/cn\("text-muted-foreground"/.test(edgeBlock),
  "A the muted class only rides wordless wires (an inked wire ignores it — dead weight)");

/* ================================================================== */
/* B — live-fire: every line the map draws has a name (or is bare)     */
/* ================================================================== */
console.log("\nB — zero ghost kinds across the world the map draws");

let worldOk = false, worldDetail = "api unreachable";
try {
  const edgesRes = await fetch("http://localhost:3000/api/edges", { signal: AbortSignal.timeout(8000) });
  if (edgesRes.ok) {
    const payload = await edgesRes.json();
    // t737 lesson — the API door speaks a wrapped dialect; ask the shape
    // before counting the room
    const edges = Array.isArray(payload) ? payload : payload.edges ?? [];
    const jobsRes = await fetch("http://localhost:3000/api/jobs", { signal: AbortSignal.timeout(8000) });
    const jobsPayload = jobsRes.ok ? await jobsRes.json() : {};
    const jobs = Array.isArray(jobsPayload) ? jobsPayload : jobsPayload.jobs ?? [];
    const byId = new Map(jobs.map((j) => [j.id, j]));
    // the map's caliber: both endpoints visible → a line exists (the same
    // both-end law the canvas legend adopted in t739)
    let drawn = 0, inked = 0, bare = 0, ghost = 0;
    const kindSet = new Set();
    for (const e of edges) {
      const a = byId.get(e.fromJobId);
      const b = e.toJobId ? byId.get(e.toJobId) : undefined;
      if (!a || !b) continue;
      drawn++;
      const k = e.fromPort ? outputKindOf(a.type, e.fromPort) : undefined;
      if (k) { inked++; kindSet.add(k); if (!PORT_COLORS[k]) ghost++; }
      else bare++;
    }
    worldOk = drawn > 0 && ghost === 0 && inked + bare === drawn;
    worldDetail = `${drawn} lines the map draws · ${inked} inked across ${kindSet.size} kinds · ${bare} honestly bare · ${ghost} ghost`;
  }
} catch (e) {
  worldDetail = `live world unreachable (${e.message}) — skipping live assert`;
}
must(worldOk,
  "B the live world: every map line resolves or stays honestly bare",
  worldDetail);

/* ================================================================== */
/* C — the face: ink rides, the register does not move                 */
/* ================================================================== */
console.log("\nC — one register; the dim and chain laws survive");

must((edgeBlock.match(/opacity=\{0\.25\}/g) ?? []).length === 1
  && !/opacity=\{kindInk/.test(edgeBlock)
  && !/kindInk \? 0\./.test(edgeBlock),
  "C one register — a single base opacity, no word-tiered brightness");

must(/dim && "mm-edge-dim"/.test(edgeBlock),
  "C the t166 dim rung survives (sel focus / chain recede via --dim-ghost)");

must(/Task 683/.test(edgeBlock) && /data-mm-edge-id=\{e\.id\}/.test(edgeBlock),
  "C the t683 chain law and its id anchor survive");

must(/data-mm-edge-kind=\{edgeKind \?\? ""\}/.test(edgeBlock),
  "C the kind anchor rides beside the id anchor (ask each wire what it carries)");

must(/pointerEvents="none"/.test(edgeBlock),
  "C the wires stay pure decoration (t139 — never steal the door gesture)");

must(/Task 743 — the map's wires borrow the canvas's ink/.test(mm),
  "C the t743 verdict stands over the derivation (head note)");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — purity: no hue classes, no storage, census home intact");

must(edgeBlock !== "" && !/bg-(cyan|teal|amber|violet|rose|orange|pink|emerald|fuchsia|slate)-\d+/.test(edgeBlock),
  "D zero tailwind hue-class literals in the edge block (hex rides PORT_COLORS only)");

must(!/localStorage|sessionStorage/.test(edgeBlock),
  "D zero storage writes (the map's ink is derived, never remembered)");

must(/COLORS palette definition|PORT_COLORS/.test(census),
  "D the census's workflow.ts home still covers the vocabulary the map reads");

/* ================================================================== */
console.log(`\n==== t743 minimap-ink unit: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
