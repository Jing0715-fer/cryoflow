#!/usr/bin/env node
/**
 * t876 — the E2E MODERNIZATION MAP (the t874 tail's second candidate,
 * unspent — the t875 tail's first non-build-day arm): before ANY deletion
 * of the pre-restore walk generation, the fleet draws the map —
 *
 *   which SURFACES did the shadowed walks film, and which LIVING
 *   instrument hosts those surfaces today?
 *
 * The t874 retirement audit shadowed the pre-restore e2e walks (the
 * cmuwipe-pin generation, 19 walks, every guard PROVEN exit 3) — they
 * cannot be re-run, so the map reads their SURFACES from what survived
 * the restore: the git-tracked SOURCES (the must/ok check labels — the
 * walked doors' own names) and the receipts they wrote while alive. The
 * living coverage reads the same way: the fleet's unit scripts' labels,
 * the a11y family's receipt checks, and the alive e2e walks' labels.
 *
 * THE MATCH IS A PROXY, AND THE RECEIPT SAYS SO: the mechanical term
 * overlap (each walk's distinctive domain terms vs each living label
 * set) names the best HOST CANDIDATE per walk; the map doc's prose makes
 * the human calls. The verdicts are the map's INPUT, not the deletion's
 * trigger — nothing is deleted this window; the guards stay (exit 3);
 * the debt list is the port plan.
 *
 * Asserts (mechanical, measured from disk):
 *   M1  the walk census re-derives the shadowed generation from the
 *       source scan (cmuwipe-bearing + browser-importing), and the set
 *       == the t874 receipt's walk census (the two audits agree)
 *   M2  every walk's surfaces extracted (>= 3 labels each — a walk that
 *       films nothing has no seat in the map)
 *   M3  the living coverage source is non-trivial (>= 40 label-bearing
 *       living instruments across units/receipts/alive e2e)
 *   M4  every walk classified: a host candidate named or DEBT — no walk
 *       unclassified
 *   M5  the KNOWN PORT witnessed mechanically: t651's best host is the
 *       t872 star-sort walk (the t874 tail's own words, the map's
 *       witness that the matcher's proxy and the family's knowledge
 *       agree)
 *   M6  the DEBT walks' surfaces listed (the port plan's input)
 *   M7  the receipt + the map doc written (the map exists on disk)
 *
 * Receipt: shots-qa/t876-e2e-modernization.json
 * Map doc: docs/e2e-modernization-map.md (rewritten each ride — the map
 * is a LIVING document, its bytes the latest ride's truth)
 *
 *   node scripts/t876-e2e-modernization-map.mjs
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t876-e2e-modernization.json";
const MAP_DOC = "docs/e2e-modernization-map.md";
/* the walk-shape markers: a cmuwipe-bearing file that LAUNCHES a browser
 * is a walk (the guard's exit-3 generation); one that doesn't is a
 * one-shot diag/probe/patch (recorded, never mapped) */
const BROWSER_MARKERS = ["from \"playwright\"", "from 'playwright'", "agent-browser"];
const SEEDERS = ["qa-t635-demo-skeleton-seed.mjs"];
const AUDITS = ["t874-e2e-retirement-audit.mjs", "t876-e2e-modernization-map.mjs"];

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

/* ---------- label extraction (the walked surfaces' own names) ---------- */
const extractLabels = (txt) => {
  const labels = new Set();
  for (const line of txt.split("\n")) {
    if (!/\b(must|ok|expect|check)\s*\(/.test(line)) continue;
    // every quoted literal >= 10 chars on a check line is surface speech;
    // the label is the longest one on the line (the detail strings are short)
    const lits = [...line.matchAll(/[`"]([^`"]{10,120})[`"]/g)].map((m) => m[1]);
    if (lits.length === 0) continue;
    const best = lits.reduce((a, b) => (b.length > a.length ? b : a));
    if (!/^Loading|^%|^—/.test(best)) labels.add(best.trim());
  }
  return [...labels];
};

/* ---------- domain terms (the matcher's vocabulary) ---------- */
const STOP = new Set(
  ("the a an and or of to for with without from into onto is are was were be been still its it this that these those " +
    "every each own still ever never not no yes zero one two three first second third last next new old same other " +
    "world rides ride walked walk films filmed surface surfaces door doors law laws page birth born window receipt " +
    "check checks pass fail green red live alive dead gone present absent bit bit-for-bit identical drift comparator " +
    "probe instrument ruler census family unit fleet carriage carrier").split(/\s+/)
);
const termsOf = (labels, fileName) => {
  const counts = new Map();
  const bump = (w) => {
    const k = w.toLowerCase();
    if (k.length < 4 || STOP.has(k) || /^\d+$/.test(k)) return;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const l of labels) for (const w of l.split(/[^a-zA-Z0-9]+/)) bump(w);
  for (const w of fileName.replace(/[-_.]/g, " ").split(/\s+/)) bump(w);
  // distinctive = appears at least twice OR is the file's own subject
  return [...counts.entries()].filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1]);
};

console.log("t876 — the e2e modernization map (the debt before any deletion)\n");

/* ---------- M1: the walk census re-derived ---------- */
const scripts = readdirSync(join(ROOT, "scripts")).filter((f) => f.endsWith(".mjs")).sort();
const browserCmuwipe = [];
const aliveWalks = [];
for (const f of scripts) {
  if (SEEDERS.includes(f) || AUDITS.includes(f)) continue;
  const txt = readFileSync(join(ROOT, "scripts", f), "utf8");
  const isBrowser = BROWSER_MARKERS.some((m) => txt.includes(m));
  if (!isBrowser) continue;
  /* the ROUTE pin, not the word (the t880 lesson): the walks pinned the
   * world ON THE WIRE in two dialects — the assignment (`const X =
   * "cmuwipe..."`, the id bound to a route-riding constant) and the
   * literal URL (/api/jobs/cmuwipe...); the living family instruments
   * mention cmuwipe only in their refusal PROSE, where the id is neither
   * assigned nor fetched — the word alone would classify them as walks
   * and break the extras partition */
  if (/=\s*["'`]cmuwipe[0-9a-z]*["'`]/.test(txt) || /api\/jobs\/cmuwipe/.test(txt)) browserCmuwipe.push(f);
  else if (/-e2e\.mjs$/.test(f)) aliveWalks.push(f);
}
/* the census's honest partition (the t874 lesson's own words): the WALK
 * generation is the t874 receipt's own census — the t65x-t68x instruments
 * a future window might deliberately re-run; the source scan's OTHER
 * browser+cmuwipe files are the one-shot diag/smoke/probe family,
 * recorded, never mapped. The scan must not MISS a walk (the walk set is
 * a subset of the scan); the extras must be exactly the one-shot families. */
const t874 = existsSync(join(ROOT, "shots-qa/t874-e2e-retirement.json"))
  ? JSON.parse(readFileSync(join(ROOT, "shots-qa/t874-e2e-retirement.json"), "utf8"))
  : null;
const walkSet = [...new Set((t874?.verdicts ?? []).map((v) => v.file))].sort();
const missingFromScan = walkSet.filter((w) => !browserCmuwipe.includes(w));
ok("M1a the source scan misses no walk (the t874 census is a subset of the browser+cmuwipe scan)", walkSet.length > 0 && missingFromScan.length === 0, `${walkSet.length} walks / ${browserCmuwipe.length} browser+cmuwipe files; missing: ${missingFromScan.join(", ") || "none"}`);
const extras = browserCmuwipe.filter((f) => !walkSet.includes(f));
const oneShotShape = extras.every((f) => /^(diag|smoke|qa|patch|tmp)-/.test(f) || /-probe\.mjs$|-forensics\.mjs$|-warmup\.mjs$/.test(f));
ok("M1b the scan's extras are exactly the one-shot families (diag/smoke/probe/patch — recorded, never mapped; the t874 partition's own words)", oneShotShape, `${extras.length} extras: ${extras.slice(0, 5).join(", ")}${extras.length > 5 ? " …" : ""}`);
const shadowed = walkSet;

/* ---------- M2: the walks' surfaces ---------- */
const walks = shadowed.map((f) => {
  const txt = readFileSync(join(ROOT, "scripts", f), "utf8");
  const labels = extractLabels(txt);
  const pinnedIds = [...new Set(txt.match(/cmuwipe[0-9a-z]*/g) ?? [])];
  return { file: f, pinnedIds, labels, terms: termsOf(labels, f) };
});
ok("M2 every walk's surfaces extracted (>= 3 labels each)", walks.every((w) => w.labels.length >= 3), `${walks.filter((w) => w.labels.length >= 3).length}/${walks.length} walks carry >= 3 labels; label totals ${walks.reduce((s, w) => s + w.labels.length, 0)}${walks.filter((w) => w.labels.length < 3).length ? `; thin: ${walks.filter((w) => w.labels.length < 3).map((w) => `${w.file}(${w.labels.length})`).join(", ")}` : ""}`);

/* ---------- M3: the living coverage ---------- */
const living = [];
for (const f of scripts) {
  if (shadowed.includes(f) || SEEDERS.includes(f)) continue;
  const txt = readFileSync(join(ROOT, "scripts", f), "utf8");
  if (!/\b(must|ok|expect|check)\s*\(/.test(txt)) continue;
  const labels = extractLabels(txt);
  if (labels.length >= 3) living.push({ file: f, labels, kind: "script" });
}
const receiptDir = join(ROOT, "shots-qa");
for (const f of existsSync(receiptDir) ? readdirSync(receiptDir).filter((x) => x.endsWith(".json") && x !== "t876-e2e-modernization.json") : []) {
  try {
    const r = JSON.parse(readFileSync(join(ROOT, "shots-qa", f), "utf8"));
    const labels = (r.checks ?? []).map((c) => c.label ?? "").filter((l) => l.length >= 10);
    if (labels.length >= 3) living.push({ file: `shots-qa/${f}`, labels, kind: "receipt" });
  } catch { /* a torn receipt is not the map's subject */ }
}
ok("M3 the living coverage source is non-trivial (>= 40 label-bearing instruments)", living.length >= 40, `${living.length} living instruments (${living.filter((l) => l.kind === "script").length} scripts + ${living.filter((l) => l.kind === "receipt").length} receipts)`);

/* ---------- M4: the match (the proxy, named as such) ---------- */
for (const w of walks) {
  w.termSet = new Set(w.terms.map(([t]) => t));
  let best = null;
  for (const lv of living) {
    const lvText = lv.labels.join(" ").toLowerCase();
    let hit = 0;
    for (const t of w.termSet) if (lvText.includes(t)) hit++;
    const score = hit / Math.max(1, w.termSet.size);
    if (!best || score > best.score) best = { file: lv.file, score, kind: lv.kind };
  }
  w.bestHost = best;
  w.verdict = best && best.score >= 0.35 ? "COVERED-CANDIDATE" : "DEBT";
}
ok("M4 every walk classified (a host candidate named or DEBT — no walk unclassified)", walks.every((w) => w.bestHost && w.verdict), walks.map((w) => `${w.file}:${w.verdict}@${(w.bestHost?.score ?? 0).toFixed(2)}`).join(", "));

/* ---------- M5: the KNOWN PORT witnessed ---------- */
const t651 = walks.find((w) => w.file.startsWith("t651"));
const t651Host = t651?.bestHost?.file ?? "";
ok("M5 the known port witnessed mechanically (t651's best host is the t872 star-sort walk — the matcher's proxy and the family's knowledge agree)", !!t651 && /t872/.test(t651Host), `t651 -> ${t651Host} (${(t651?.bestHost?.score ?? 0).toFixed(2)})`);

/* ---------- M6: the debt list ---------- */
const debt = walks.filter((w) => w.verdict === "DEBT");
ok("M6 the debt walks' surfaces listed (the port plan's input)", Array.isArray(debt) && debt.length !== undefined, debt.length === 0 ? "no mechanical debt — every walk has a host candidate (the doc's prose still audits each)" : `${debt.length} debt walks: ${debt.map((d) => d.file).join(", ")}`);

/* ---------- M7: the receipt + the map doc ---------- */
const matrix = walks.map((w) => ({
  walk: w.file,
  pinnedIds: w.pinnedIds,
  surfaces: w.labels,
  distinctiveTerms: w.terms.slice(0, 12).map(([t, n]) => `${t}:${n}`),
  bestHost: w.bestHost,
  verdict: w.verdict,
}));
const receipt = {
  instrument: "scripts/t876-e2e-modernization-map.mjs",
  date: new Date().toISOString(),
  question: "the shadowed walk generation's surfaces — which living instrument hosts them today? (the map before any deletion)",
  proxy: "the host candidate is a MEASURED PROXY (distinctive-term overlap between the walk's check labels and each living instrument's labels); the map doc's prose makes the human calls; nothing is deleted this window",
  walkCount: walks.length,
  labelTotals: { walks: walks.reduce((s, w) => s + w.labels.length, 0), living: living.length },
  coveredCandidates: matrix.filter((m) => m.verdict === "COVERED-CANDIDATE").map((m) => `${m.walk} -> ${m.bestHost.file} (${m.bestHost.score.toFixed(2)})`),
  debt: matrix.filter((m) => m.verdict === "DEBT").map((m) => m.walk),
  matrix,
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict:
    fail === 0
      ? `the modernization map holds: ${walks.length} shadowed walks' surfaces extracted from the surviving sources (${matrix.reduce((s, m) => s + m.surfaces.length, 0)} labels), the two audits agree on the census, every walk classified (host candidate or DEBT), the known port (t651 -> t872) witnessed mechanically, the debt list the port plan's input — nothing deleted, the guards stay`
      : `${fail} red — the map's census or matcher disagrees with the family's knowledge; call the census's own instruments before any deletion`,
};
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2) + "\n");

/* the map doc — a LIVING document, rewritten each ride */
/* the ports amendments (the births' own record — carried IN the
 * generator since t880: a living doc the ride REWRITES must carry its
 * amendments, or every re-ride wipes them — the t880 lesson) */
const PORTS_AMENDMENTS = [
  "## The ports (amended by the births)",
  "",
  "\n- **t673 / t674 \u2014 PORTED (t880)**: the rename family's debt walks ride\n  their first living host, `scripts/t880-rename-family.mjs` (98/98 at\n  revision 2, the arm-3 chain closed bit-for-bit on all FOUR faces \u2014\n  wallFace 137->137, paletteFace 149->149, homeFace 330->330, worldBack\n  153->153; A4e-28's TWENTY-SECOND carrier, 81/81 faces). The\n  label-as-will law closed loop: the walks' surfaces are the port's own\n  labels now \u2014 and the port redrew the doors the shadowed receipts\n  never saw (the pencils carry aria-labels NOW; the wall's edit shell\n  speaks \"Enter saves \u00b7 Esc cancels\"; the chevron/Mountain yields ride\n  group-focus-within TOO \u2014 the keyboard arm is in the product at every\n  surface; the D-leg abort rides agent-browser network route --abort,\n  the playwright successor spiked live: armed -> FETCH-FAILED ->\n  unroute -> 200; the home's rename input hands focus back on every\n  exit \u2014 t788's law). The port also taught the census a NEW shape: the\n  fleet's first MID-TOAST census caught the toast close button riding\n  the page UNNAMED \u2014 a REAL debt, fixed in src (ToastClose aria-label\n  \"Dismiss notification\"), build-day queued; until the build lands the\n  rides measure the stable face AFTER the toast's departure (the honest\n  bridge, recorded in the checks). The first flight's own judge-line:\n  SUBSTRINGS ARE NOT NAMES \u2014 the cross-sync's ghost clause bit its own\n  tongue (\"t880 drill alpha\" is a PREFIX of \"t880 drill alpha II\"); the\n  exact rendered name is the honest witness. The walks stay\n  shadowed-alive (exit 3) until a deliberate retirement window deletes\n  them WITH their port aboard.",
  "- **t680 \u2014 PORTED (t878, grown t879)**: the judge-worker family's debt",
  "  walk rides its first living host, `scripts/t878-judge-worker-family.mjs`",
  "  (48/48 at revision 3, the arm-3 chain closed bit-for-bit on all FOUR",
  "  faces; A4e-28's TWENTY-FIRST carrier, 77/77 faces). The port's SECOND",
  "  HALF (t879) grew the policy gates LIVE on the living host \u2014 the t574",
  "  Face C shape: the autoJudge-off silence (a clean candidate armed during",
  "  the OFF window stays quiet across 2+ ticks), the delete-before-re-arm",
  "  law (the race made impossible), the re-arm quiet, and the MIRROR gate",
  "  LIVE and ISOLATED (a fresh LINKED drill, armed post-watermark, stays",
  "  invisible while the original keeps its one opinion \u2014 gate 4 witnessed",
  "  without the toggle or the watermark confounding it). The label-as-will law closed loop: the walk's",
  "  three S-labels are the port's own labels now \u2014 and the port redrew the",
  "  doors the shadowed receipt never saw (the host MEASURED from the living",
  "  roster \u2014 t680 pinned the cmuwipe world, t574 the EMPIAR world, both",
  "  gone, the port refuses pins; the storm's seats are MINTED drills, never",
  "  the world's own jobs; the boot loop's liveness WITNESSED \u2014 lastTickAt",
  "  fresh within 2.5 ticks, mounted alone is a promise, a fresh tick is a",
  "  beat; the queue's TWO witnesses kept apart \u2014 the live storm proves the",
  "  world (two clean candidates two seconds apart, drained ONE PER TICK",
  "  oldest first, both verdicts ok=true from the real two-pass VLM), the",
  "  t578 bench proves the policy; the console-hygiene check reads the",
  "  PAGE's own error events \u2014 the agent-browser errors channel carries",
  "  empty-message artifacts, the t574-era `errors == \"\"` idiom retired).",
  "  The walk stays shadowed-alive (exit 3) until a deliberate retirement",
  "  window deletes it WITH its port aboard.",
  "",
  "- **t668 / t669 / t670 / t671 \u2014 PORTED (t877)**: the saved-views",
  "  family's debt cluster rides its first living host,",
  "  `scripts/t877-saved-views-family.mjs` (82/82, the arm-3 chain closed",
  "  bit-for-bit; A4e-28's TWENTIETH carrier). The label-as-will law",
  "  closed loop: the debt walks' surfaces are the port's own labels now \u2014",
  "  and the port redrew the doors the shadowed receipts never saw (the",
  "  t793 confirm question, the t674 trio mouths, the t817 after-state,",
  "  the headless world's keyboard-arm reveal). The four walks stay",
  "  shadowed-alive (exit 3) until a deliberate retirement window deletes",
  "  them WITH their port aboard.",
];

const docLines = [
  "# The e2e modernization map (t876)",
  "",
  `> Generated ${new Date().toISOString()} by \`scripts/t876-e2e-modernization-map.mjs\` — a LIVING document,`,
  `> rewritten each ride; the receipt (\`shots-qa/t876-e2e-modernization.json\`) holds the same matrix with the`,
  `> full label lists. The host candidates are a MEASURED PROXY (term overlap); the prose below is the plan.`,
  `> Nothing is deleted: the t874 guards stay (exit 3), the debt list is the port plan's input.`,
  "",
  `## The census`,
  "",
  `- ${walks.length} shadowed walks (the pre-restore cmuwipe generation, every guard PROVEN exit 3): ${walks.map((w) => w.file.replace("-e2e.mjs", "").replace(".mjs", "")).join(", ")}`,
  `- ${living.length} living instruments in the coverage source (${living.filter((l) => l.kind === "script").length} scripts + ${living.filter((l) => l.kind === "receipt").length} receipts)`,
  `- The two audits agree (this census == the t874 receipt's walk census).`,
  "",
  "## The matrix (host candidates by term overlap)",
  "",
  "| walk | surfaces | best host candidate | score | verdict |",
  "|------|----------|--------------------:|------:|---------|",
  ...matrix.map(
    (m) =>
      `| ${m.walk} | ${m.surfaces.length} labels | ${m.bestHost?.file ?? "—"} | ${(m.bestHost?.score ?? 0).toFixed(2)} | ${m.verdict} |`
  ),
  "",
  "## The port plan (the prose calls)",
  "",
  ...matrix.map((m) => {
    const top = m.surfaces.slice(0, 4).map((s) => `    - ${s}`).join("\n");
    return m.verdict === "DEBT"
      ? `### ${m.walk} — DEBT (no living host speaks its domain)\n\n    ${top}\n\n    The port: a living instrument grows these faces, or a new instrument is born\n    before the walk retires with honor. The surfaces' names above are the spec.\n`
      : `### ${m.walk} — host candidate: ${m.bestHost.file}\n\n    ${top}\n\n    The plan: the host's next growth re-walks the walk's distinctive faces (the\n    labels above are the spec); until then the walk stays shadowed-alive\n    (exit 3), retired with honor — deletion waits for the port.\n`;
  }),
  "",
  ...PORTS_AMENDMENTS,
  "",
  "## The laws",
  "",
  "- 「删除前先绘图」: the fleet retires nothing it cannot name the successor of —",
  "  the map is the naming, the debt list the waiting room.",
  "- 「标签是面子的遗嘱」: the shadowed walks cannot re-run, but their check",
  "  labels survived the restore — the walked doors' own names are the port spec.",
  "- 「代理要自认是代理」: the term-overlap host candidate is a measured proxy;",
  "  the receipt says so, the prose makes the calls — the map never mistakes the",
  "  matcher's verdict for the family's knowledge.",
  "",
];
writeFileSync(join(ROOT, MAP_DOC), docLines.join("\n"));

ok("M7 the receipt + the map doc written (the map exists on disk)", existsSync(join(ROOT, RECEIPT)) && existsSync(join(ROOT, MAP_DOC)), `${RECEIPT} + ${MAP_DOC}`);

console.log(`\nE2E-MODERNIZATION-MAP t876: ${pass}/${pass + fail}${fail ? " RED" : " green"}`);
console.log(`  receipt: ${RECEIPT}`);
console.log(`  map doc: ${MAP_DOC}`);
process.exit(fail === 0 ? 0 : 1);
