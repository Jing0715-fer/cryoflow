// t737 — the legend face: the kind vocabulary's table of contents.
// t734 gave the wire a resting ink; t735 made the color and the word
// travel together at the two reading places; this window gives the
// vocabulary a TOC — a legend in the canvas toolbar's tail that lists
// the kinds the CURRENT world's wires actually wear (derived from the
// same book, never the full 12-word table — a legend of colors the
// canvas never paints would be a lie), and lets a click FOCUS one
// kind: every other wire recedes on the --dim-wire rung.
//
//   A  one book, one more reader: the legend's roster derives through
//      outputKindOf + PORT_COLORS (the same lookup and table the wires
//      themselves read) — zero second directory in the canvas; the dot
//      paints the wire's own hex (inline style — the lib dialect
//      tailwind's JIT can't see); the wire layer accepts the focus.
//   B  live-fire over the REAL book AND the REAL world: every
//      next-step port pair of all 40 types resolves (zero ghost kinds);
//      the live canvas world (API jobs + edges) derives a roster whose
//      every word is a PORT_COLORS key, with wire counts that sum to
//      the kinded-edge count — the world's own chromatography.
//   C  the face: aria-pressed toggle (click focused → release), Escape
//      listener mounted only while a focus is live, background click
//      releases it, the two-size law (compact dot-only face, full
//      dot+word face at 2xl), title speaks "{kind} data on N wires",
//      and the focus rides EdgesLayer's legendKind prop.
//   D  purity: the legend block carries zero tailwind hue-class
//      literals (colors are hex inline styles), zero motion, zero
//      storage writes (a view state, not an asset); the census's
//      workflow.ts home still covers the vocabulary.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { PORT_COLORS, JOB_TYPES, outputKindOf } = await __jiti.import("../src/lib/workflow");
const { nextStepsFor } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

const canvas = readSrc("components/workflow/canvas.tsx");
const edges = readSrc("components/workflow/edges-layer.tsx");
const wf = readSrc("lib/workflow.ts");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

// the legend block, sliced from the canvas source: from the legend's
// data-canvas-ui marker to the toolbar's closing div (the JSON-import
// picker comment that follows it)
const legendStart = canvas.indexOf('data-canvas-ui="kind-legend"');
const legendEnd = canvas.indexOf("{/* workflow JSON import", legendStart);
const legendBlock = legendStart >= 0 && legendEnd > legendStart
  ? canvas.slice(canvas.lastIndexOf("{/* t737", legendStart), legendEnd)
  : "";

/* ================================================================== */
/* A — one book, one more reader                                       */
/* ================================================================== */
console.log("\nA — the legend drinks the same book the wires drink");

must(legendStart >= 0 && legendEnd > legendStart,
  "A the legend block exists in the canvas toolbar");

must(/PORT_COLORS/.test(canvas) && /outputKindOf/.test(canvas),
  "A the canvas imports the book's table and lookup (PORT_COLORS + outputKindOf)");

must(/const k = outputKindOf\(from\.type, e\.fromPort\);/.test(canvas),
  "A the roster derivation asks outputKindOf — zero second directory");

must(/\(Object\.keys\(PORT_COLORS\) as PortKind\[\]\)/.test(canvas),
  "A the roster's ORDER is the book's own key order (no parallel list)");

must(/backgroundColor: PORT_COLORS\[k\]\.wire/.test(canvas),
  "A the dot paints the wire's own hex — inline style, the lib dialect");

must(/legendKind=\{legendKind\}/.test(canvas),
  "A the focus rides the wire layer as a prop");

must(/legendKind\?: PortKind \| null/.test(edges) && /edgeKind !== legendKind/.test(edges),
  "A the wire layer accepts the focus and compares it to the edge's own kind");

/* ================================================================== */
/* B — live-fire: the real book, then the real world                   */
/* ================================================================== */
console.log("\nB — every port pair resolves; the live world's roster is honest");

// B1 — the full type space: every next-step pair resolves to a word
//      the table knows (the legend can never meet a ghost kind)
let pairs = 0, ghost = 0;
const tableKeys = new Set(Object.keys(PORT_COLORS));
for (const t of JOB_TYPES) {
  for (const d of nextStepsFor(t.key)) {
    pairs++;
    if (!outputKindOf(t.key, d.fromPort)) ghost++;
  }
}
must(pairs > 0 && ghost === 0,
  `B all next-step port pairs resolve (${pairs} pairs, zero ghost kinds)`);

// B2 — the LIVE canvas world: derive the roster the legend would show
//      right now, from the same API the app drinks (the seeder's
//      canonical demo world — whatever it holds, the legend must be
//      able to say it)
let rosterOk = false, rosterDetail = "api unreachable";
try {
  const jobsRes = await fetch("http://localhost:3000/api/jobs", { headers: { Origin: "http://localhost:3000" }, signal: AbortSignal.timeout(8000) });
  const edgesRes = await fetch("http://localhost:3000/api/edges", { headers: { Origin: "http://localhost:3000" }, signal: AbortSignal.timeout(8000) });
  if (jobsRes.ok && edgesRes.ok) {
    const jobsPayload = await jobsRes.json();
    const worldJobs = Array.isArray(jobsPayload) ? jobsPayload : jobsPayload.jobs ?? [];
    const worldEdgesRaw = await edgesRes.json();
    // the edges door speaks the {edges: [...]} wrapper — unwrap before walk
    const worldEdges = Array.isArray(worldEdgesRaw) ? worldEdgesRaw : worldEdgesRaw.edges ?? [];
    const byId = new Map(worldJobs.map((j) => [j.id, j]));
    const counts = new Map();
    let kinded = 0, unmapped = 0;
    for (const e of worldEdges) {
      if (!e.fromPort) continue;
      const from = byId.get(e.fromJobId);
      if (!from) continue;
      const k = outputKindOf(from.type, e.fromPort);
      if (k) { counts.set(k, (counts.get(k) ?? 0) + 1); kinded++; }
      else unmapped++;
    }
    const roster = [...counts.keys()];
    const sum = [...counts.values()].reduce((a, b) => a + b, 0);
    rosterOk =
      roster.length > 0 &&
      roster.every((k) => tableKeys.has(k)) &&
      sum === kinded;
    rosterDetail = `roster [${roster.join(", ")}] on ${kinded} kinded wires, ${unmapped} unmapped, counts sum ${sum} === kinded`;
  }
} catch (e) {
  rosterDetail = `live world unreachable (${e.message}) — skipping live assert`;
}
must(rosterOk,
  "B the live world's roster: every word is a table key, counts sum to kinded wires",
  rosterDetail);

/* ================================================================== */
/* C — the face: focus is a question, asked and released               */
/* ================================================================== */
console.log("\nC — toggle, Escape, background release, two sizes, the title");

must(/setLegendKind\(active \? null : k\)/.test(legendBlock) && /aria-pressed=\{active\}/.test(legendBlock),
  "C the focused word releases on a second click (toggle), and says so (aria-pressed)");

must(/e\.key === "Escape"\) setLegendKind\(null\)/.test(canvas)
  && /if \(legendKind == null\) return;/.test(canvas),
  "C Escape releases the focus — listener mounted only while a focus is live");

must(/else s\.select\(null\);\s*\n\s*\/\/ t737/.test(canvas) || /s\.select\(null\);[\s\S]{0,200}setLegendKind\(null\);/.test(canvas),
  "C a background click releases the focus alongside the selection");

must(/hidden items-center[^"]*lg:flex/.test(legendBlock),
  "C the legend is a desktop face (lg up) — compact screens keep the toolbar clean");

must(/hidden 2xl:inline/.test(legendBlock),
  "C the two-size law: compact face = dot only, the word rides at 2xl");

must(/\$\{k\} data on \$\{wires\} wire/.test(legendBlock),
  "C the title teaches the count: \"{kind} data on N wires\"");

must(/size-2 shrink-0 rounded-full/.test(legendBlock),
  "C the dot is a size-2 sample — the wire's resting ink in miniature");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — purity: no hue classes, no motion, no storage in the legend");

must(legendBlock !== "" && !/bg-(cyan|teal|amber|violet|rose|orange|pink|emerald|fuchsia|slate)-\d+/.test(legendBlock),
  "D zero tailwind hue-class literals in the legend block (hex inline styles only)");

must(!/animate|animateMotion/.test(legendBlock),
  "D zero motion in the legend block (a TOC does not dance)");

must(!/localStorage|sessionStorage/.test(legendBlock),
  "D zero storage writes (a view state, not an asset)");

must(/COLORS palette definition|PORT_COLORS/.test(census),
  "D the census's workflow.ts home still covers the vocabulary the legend reads");

/* ================================================================== */
console.log(`\n==== t737 kind-legend unit: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
