// t761 — the TEMPLATE SHAPE PREVIEW's miniature nodes speak the pours
// words in their TITLE CONTRACT: the kind vocabulary's TWENTY-SECOND
// reader, and the family's FIRST PURE WORD-FORM reader — no dots, no
// container, no DOM address; the water in the magnifier is HEARD, not
// seen. The seat decision is physical: at MIN_SCALE (0.26) the miniature
// card is ~62px wide with a ~46px text zone — a dot family would crush
// the 9px truncate. So the pours words join the hover reveal as a suffix
// ("{label} ({type}) — pours {kinds}") and the visual card stays
// byte-identical. The ask rides the spec the node already holds (the
// t755 fourth form); the unknown type keeps the bare contract (the t744
// bare-receipt retreat, the undefined law's fifth face).
//
//   A  one book: the import merges; the gated ask appears exactly once
//      in the FILE; the ask rides the held spec verbatim; the suffix
//      gate empties for the unknown; the title contract carries the
//      suffix; the 9px label span stays pure.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      TENTH-interlocked, every known type speaks, a real title string
//      rebuilt from the lib.
//   C  the face: the title contract's exact structure, the suffix's
//      verbatim word-form, the old residents (node testid, node-label,
//      the scale math), both judgment notes lead their blocks.
//   D  purity: zero hex, no storage writes, the edges stay undressed,
//      the scale math verbatim, the MIN_SCALE law stands.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "..", "src", "components", "workflow", "template-shape-preview.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

// slice discipline: the node map runs from its head to the title line
// (the contract's end); the 9px label span is the visual purity witness;
// the edges map is the one-reader undressed witness.
const mapStart = src.indexOf("{payload.jobs.map((j, i) => {");
const titleEnd = src.indexOf("${poursSuffix}`}", mapStart);
const nodeMap = mapStart >= 0 && titleEnd > mapStart ? src.slice(mapStart, titleEnd + "${poursSuffix}`}".length) : "";

const labelStart = src.indexOf('text-[9px] font-medium leading-tight');
const labelSpan = labelStart >= 0 ? src.slice(labelStart, src.indexOf("</span>", labelStart)) : "";

const edgeStart = src.indexOf("edges.map((e) => (");
const edgeEnd = src.indexOf("</svg>", edgeStart);
const edgesSlice = edgeStart >= 0 && edgeEnd > edgeStart ? src.slice(edgeStart, edgeEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, riding the spec the node already holds                */
/* ================================================================== */
console.log("\nA — the miniature node asks through its own held spec, gated");

must((src.match(/import \{ CARD_H, CARD_W, jobType, portY, pourKindsOf \} from "@\/lib\/workflow";/g) || []).length === 1,
  "A the workflow import merges into the existing single line (five names, one home)");

must((src.match(/pourKindsOf\(/g) || []).length === 1,
  "A the GATED ask appears exactly once in the file (one-reader: the edges stay undressed, their absence is this count)");

must(src.includes("const pouring = spec ? pourKindsOf(j.type) : [];"),
  "A the ask rides the held spec verbatim (the t755 fourth form — the label answer was the ask)");

must(src.includes("pouring.length > 0 ? ` — pours ${pouring.join(\", \")}` : \"\";"),
  "A the suffix gate empties for the unknown (empty pours, empty suffix — the bare contract stands)");

must(nodeMap.includes("title={`${label}${j.type === label ? \"\" : ` (${j.type})`}${poursSuffix}`}"),
  "A the title contract carries the suffix after the identity words (label, type tail, then the water)");

must(labelSpan.length > 0 && !/pours|pouring/i.test(labelSpan),
  "A the 9px label span stays pure (the visual card is byte-identical — the truncate keeps its text zone)");

/* ================================================================== */
/* B — live-fire over the type space                                   */
/* ================================================================== */
console.log("\nB — the pour account, re-counted at the magnifier");

let ghost = 0;
const dist = {};
for (const t of JOB_TYPES) {
  const pk = pourKindsOf(t.key);
  for (const k of pk) if (!PORT_COLORS[k]) ghost++;
  dist[pk.length] = (dist[pk.length] ?? 0) + 1;
}

must(JOB_TYPES.length === 40, "B the type space is 40 strong", `got ${JOB_TYPES.length}`);
must(ghost === 0, "B zero ghost kinds (every word the title can say names a real port color)");

const account = Object.entries(dist).map(([n, c]) => [Number(n), c]).sort((a, b) => a[0] - b[0]);
const expected = [[1, 35], [2, 3], [3, 2]];
const accountSame = JSON.stringify(account) === JSON.stringify(expected);
must(accountSame,
  "B the t747 account TENTH-interlocked (rows/chips/shelf/cmd catalog/cmd presets/runtime analytics/queue sim/peek/refmap/magnifier — sorted before compared)",
  JSON.stringify(account));

const allSpeaks = JOB_TYPES.every((t) => pourKindsOf(t.key).length > 0 && jobType(t.key) != null);
must(allSpeaks,
  "B every known type speaks (the suffix never silences a resolved type — silence is for the unknown only)");

const r3 = jobType("refine3d");
const r3suffix = r3 != null ? ` — pours ${pourKindsOf("refine3d").join(", ")}` : "";
must(r3 != null && /^ — pours [a-z, ]+$/.test(r3suffix),
  "B a real suffix string rebuilds from the lib (refine3d's shape: em-dash, pours, comma-space join)",
  r3suffix);

/* ================================================================== */
/* C — the face: contract structure, suffix word-form, old residents   */
/* ================================================================== */
console.log("\nC — the miniature node's spoken face");

must(/\$\{label\}\$\{j\.type === label \? "" : ` \(\$\{j\.type\}\)`\}\$\{poursSuffix\}/.test(src),
  "C the title contract's exact structure: identity words first, the water last (the suffix never leads)");

must(src.includes("` — pours ${pouring.join(\", \")}`"),
  "C the suffix's verbatim word-form (em-dash, pours, comma-space join — the ear's dialect in a title coat)");

must(src.includes('data-node-label={label}') && src.includes('data-testid="template-preview-node"'),
  "C the old residents keep their seats (node testid + node-label — the identity layer untouched)");

must(src.includes("t761 — the water ask rides the spec the node already holds") &&
     src.includes("heard, not") &&
     src.includes("the bare contract stands"),
  "C the t761 judgment note leads the block and names its laws (the riding ask + the pure word-form + the bare retreat)");

must(!/data-testid=\{`[a-z-]*pours/.test(src),
  "C no pours testid (the first pure word-form reader has no DOM address — the family's address ledger notes a word-form seat)");

/* ================================================================== */
/* D — purity: hex, storage, one-reader, scale math, MIN_SCALE law     */
/* ================================================================== */
console.log("\nD — purity checks");

const hexLines = src.split("\n").filter((l) => /#[0-9a-fA-F]{6}\b/.test(l));
const paletteHex = hexLines.filter((l) => /movies:|micrographs:|coords:|particles:|references2d:|volume:|halfmap:|mask:|model:|star:|tiltseries:|tomograms:|FALLBACK_STROKE/.test(l));
must(hexLines.length === 13 && paletteHex.length === 13,
  "D the file's 13 hex literals are ALL pre-existing palette residents (KIND_STROKE table + FALLBACK — the edges' ink source, seated before this window; the t758 legal-resident audit)",
  `${hexLines.length} hex lines, ${paletteHex.length} in the palette block`);

must(!/localStorage|sessionStorage|writeUserParamPresets/.test(src.slice(mapStart - 800, titleEnd + 200)),
  "D no storage writes near the t761 seat");

must(!/pourKindsOf|pours/i.test(edgesSlice),
  "D one-reader discipline: the edges (svg endpoints) are verified undressed (lines are not types)");

must(nodeMap.includes("width: `${(CARD_W * s).toFixed(1)}px`") && nodeMap.includes("height: `${(CARD_H * s).toFixed(1)}px`"),
  "D the scale math stays verbatim (the dots never enter the geometry — there are no dots)");

must(src.includes("MIN_SCALE") && /MIN_SCALE = 0\.26/.test(src),
  "D the MIN_SCALE law stands (the physical reason this seat is word-form: 0.26 scale, ~62px card, ~46px text zone)");

/* ================================================================== */
console.log(`\n==== t761 template pours unit: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
