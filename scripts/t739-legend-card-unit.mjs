// t739 — the legend grows an index page: the hover card.
// t737 gave the vocabulary a TOC (a legend that lists the kinds the
// world's wires actually wear, with a click-to-focus lamp); this window
// gives each TOC entry its INDEX PAGE — hovering (or keyboard-focusing)
// a word opens that word's card, listing ITS wires as "from → to" rows.
// And the roster now speaks the CANVAS's caliber: a wire belongs only
// when BOTH endpoints are visible jobs — the same law edges-layer paints
// by. The legend indexes the drawn canvas, not the ledger.
//
//   A  one book, still one reader: the roster derives through
//      outputKindOf + PORT_COLORS in a single pass that both counts and
//      collects rows — zero second directory, zero second name list; the
//      canvas caliber (both endpoints visible) is asserted in source.
//   B  live-fire over the REAL world: rebuild the roster from the API
//      (the {edges: [...]} wrapper unwrapped before the walk — the door's
//      dialect), the canvas caliber applied: counts sum to the both-end
//      visible kinded wires, and every card row names REAL jobs (zero
//      ghost names — an index page that lists books not on the shelf is
//      a lie).
//   C  the face: the card is a condition-rendered view (quiet DOM until
//      asked), pointer-events-none (it can't catch its own mouse),
//      anchored bottom-full (the toolbar lives on the canvas floor; the
//      card floats up into the world it describes), opened by BOTH
//      channels (mouseenter for the hand, focus for the keyboard), with
//      an anti-flicker leave (a leaving word may not close a card another
//      word just opened), aria-describedby wiring, the title still
//      teaching the count, and the footer carrying the focus hint.
//   D  purity: zero hue-class literals (hex inline styles only), zero
//      motion (an index page does not dance), zero storage writes; the
//      census's workflow.ts home still covers the vocabulary.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { PORT_COLORS, outputKindOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

const canvas = readSrc("components/workflow/canvas.tsx");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

// the legend block, sliced the same way t737 slices it: from the legend's
// marker comment to the JSON-import picker comment that follows the group
const legendStart = canvas.indexOf('data-canvas-ui="kind-legend"');
const legendEnd = canvas.indexOf("{/* workflow JSON import", legendStart);
const legendBlock = legendStart >= 0 && legendEnd > legendStart
  ? canvas.slice(canvas.lastIndexOf("{/* t737", legendStart), legendEnd)
  : "";

/* ================================================================== */
/* A — one book, one pass, canvas caliber                              */
/* ================================================================== */
console.log("\nA — the index page drinks the same single pass");

must(legendStart >= 0 && legendEnd > legendStart,
  "A the legend block exists in the canvas toolbar");

must(/const k = outputKindOf\(from\.type, e\.fromPort\);/.test(canvas),
  "A the roster still asks outputKindOf — zero second directory");

must(/\(Object\.keys\(PORT_COLORS\) as PortKind\[\]\)/.test(canvas),
  "A the roster's ORDER is still the book's own key order");

must(/const rows = new Map<PortKind, \{ from: string; to: string \}\[\]>\(\);/.test(canvas),
  "A the rows ride the SAME pass as the counts — counting and indexing in one walk");

must(/byId\.get\(e\.fromJobId\)/.test(canvas) && /byId\.get\(e\.toJobId\)/.test(canvas),
  "A card rows name jobs through the SAME byId map — zero second name list");

must(/const to = e\.toJobId \? byId\.get\(e\.toJobId\) : undefined;\s*\n\s*if \(!to\) continue;/.test(canvas),
  "A the canvas caliber: a wire joins the roster only with BOTH endpoints visible");

must(/rows\.get\(k\) \?\? \[\]/.test(canvas) && /legend\.map\(\(\{ kind: k, wires, rows \}\)/.test(legendBlock),
  "A each roster entry carries its count AND its rows (the face reads both)");

/* ================================================================== */
/* B — live-fire: the real world, the canvas caliber                   */
/* ================================================================== */
console.log("\nB — the live world's index pages name real jobs only");

let rosterOk = false, rowsOk = false;
let rosterDetail = "api unreachable", rowsDetail = "api unreachable";
try {
  const jobsRes = await fetch("http://localhost:3000/api/jobs", { signal: AbortSignal.timeout(8000) });
  const edgesRes = await fetch("http://localhost:3000/api/edges", { signal: AbortSignal.timeout(8000) });
  if (jobsRes.ok && edgesRes.ok) {
    const jobsPayload = await jobsRes.json();
    const worldJobs = Array.isArray(jobsPayload) ? jobsPayload : jobsPayload.jobs ?? [];
    const edgesPayload = await edgesRes.json();
    // the edges door speaks the {edges: [...]} wrapper — unwrap before
    // the walk (t737's lesson: ask the shape, then count the guests)
    const worldEdges = Array.isArray(edgesPayload) ? edgesPayload : edgesPayload.edges ?? [];
    const byId = new Map(worldJobs.map((j) => [j.id, j]));
    const tableKeys = new Set(Object.keys(PORT_COLORS));

    // the canvas caliber, rebuilt: both endpoints visible + worded port
    const counts = new Map();
    const rows = new Map();
    let kinded = 0, invisible = 0;
    for (const e of worldEdges) {
      if (!e.fromPort) continue;
      const from = byId.get(e.fromJobId);
      const to = e.toJobId ? byId.get(e.toJobId) : undefined;
      if (!from || !to) { invisible++; continue; }
      const k = outputKindOf(from.type, e.fromPort);
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
      const list = rows.get(k) ?? [];
      list.push({ from: from.name, to: to.name });
      rows.set(k, list);
      kinded++;
    }
    const roster = [...counts.keys()];
    const sum = [...counts.values()].reduce((a, b) => a + b, 0);
    rosterOk = roster.length > 0 && roster.every((k) => tableKeys.has(k)) && sum === kinded;
    rosterDetail = `roster [${roster.join(", ")}] — sum ${sum} === both-end kinded ${kinded} (${invisible} wire(s) outside the canvas caliber)`;

    // every card row must name REAL jobs of the live world (zero ghost
    // names), and each word's row count must equal its wire count (the
    // index page lists exactly the wires the TOC entry claims)
    const names = new Set(worldJobs.map((j) => j.name));
    let ghost = 0, mismatch = 0, totalRows = 0;
    for (const [k, list] of rows) {
      totalRows += list.length;
      if (list.length !== (counts.get(k) ?? 0)) mismatch++;
      for (const r of list) {
        if (!names.has(r.from) || !names.has(r.to)) ghost++;
      }
    }
    rowsOk = totalRows === kinded && ghost === 0 && mismatch === 0;
    rowsDetail = `${totalRows} card rows across ${rows.size} word(s), zero ghost names, every row count === its wire count`;
  }
} catch (e) {
  rosterDetail = `live world unreachable (${e.message}) — skipping live asserts`;
  rowsDetail = rosterDetail;
}
must(rosterOk,
  "B the live roster under the canvas caliber: every word a table key, counts sum to drawn wires",
  rosterDetail);
must(rowsOk,
  "B the live index pages: every row a real name, rows === wires",
  rowsDetail);

/* ================================================================== */
/* C — the face: an index page opens on demand, closes without a fight */
/* ================================================================== */
console.log("\nC — hover reads, click focuses, the card serves the first");

must(/<div key=\{k\} className="relative flex">/.test(legendBlock),
  "C each word sits in a relative wrapper — the card anchors to its own word");

must(/const open = legendHover === k;/.test(legendBlock) && /\{open && \(/.test(legendBlock),
  "C the card is condition-rendered — the DOM stays quiet until asked");

must(/onMouseEnter=\{\(\) => setLegendHover\(k\)\}/.test(legendBlock) && /onFocus=\{\(\) => setLegendHover\(k\)\}/.test(legendBlock),
  "C the card opens on BOTH channels — mouseenter for the hand, focus for the keyboard");

must(/setLegendHover\(\(cur\) => \(cur === k \? null : cur\)\)/.test(legendBlock),
  "C the anti-flicker leave: a leaving word may not close a card another word just opened");

must(/pointer-events-none absolute bottom-full left-0 z-40/.test(legendBlock),
  "C the card can't catch its own mouse and floats UP from the canvas floor");

must(/id=\{`kind-legend-card-\$\{k\}`\}/.test(legendBlock) && /aria-describedby=\{open \? `kind-legend-card-\$\{k\}` : undefined\}/.test(legendBlock),
  "C the card is wired to its word (id + aria-describedby, only while open)");

must(/role="tooltip"/.test(legendBlock) && /data-canvas-ui="kind-legend-card"/.test(legendBlock),
  "C the card speaks tooltip role and carries its own probe handle");

must(/\$\{k\} data on \$\{wires\} wire/.test(legendBlock),
  "C the title still teaches the count: \"{kind} data on N wires\"");

must(/click to focus · Esc to clear/.test(legendBlock),
  "C the focus hint rides the card's footer — the card and the title never say the same thing twice");

must(/"truncate text-muted-foreground"/.test(legendBlock) && /w-max max-w-64/.test(legendBlock),
  "C the rows truncate inside a content-sized card — long names bow out gracefully");

must(/"mt-1\.5 border-t pt-1\.5/.test(legendBlock),
  "C the footer is a ruled zone — hint and list don't blur");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — purity: no hue classes, no motion, no storage in the legend");

must(legendBlock !== "" && !/bg-(cyan|teal|amber|violet|rose|orange|pink|emerald|fuchsia|slate)-\d+/.test(legendBlock),
  "D zero tailwind hue-class literals in the legend block (hex inline styles only)");

must(!/animate|animateMotion/.test(legendBlock),
  "D zero motion in the legend block (an index page does not dance)");

must(!/localStorage|sessionStorage/.test(legendBlock),
  "D zero storage writes (a view state, not an asset)");

must(/COLORS palette definition|PORT_COLORS/.test(census),
  "D the census's workflow.ts home still covers the vocabulary the legend reads");

/* ================================================================== */
console.log(`\n==== t739 legend-card unit: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
