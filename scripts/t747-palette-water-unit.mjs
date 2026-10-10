// t747 — the row borrows the water dots: the menu says what the type
// pours before the job exists. The tenth reader read the receipt, the
// eleventh read the dictionary card; this twelfth reader reads the MENU —
// the palette row is the first surface every user scans, so the promise
// (pours) now rides it as small steady dots. The appetite (drinks) keeps
// its full sentence behind the info door: same-shaped dots cannot tell
// pours from drinks, so only one family rides the row.
//
//   A  one book: the row asks the lib's own named question (pourKindsOf —
//      the t746 home), dots ride PORT_COLORS[k].wire (the t735/t746
//      sample), and the row computes pours ONCE (dots + ear read it).
//   B  live-fire over the TYPE SPACE: the distribution holds
//      ([[1,35],[2,3],[3,2]] — every type pours at least one kind),
//      named witnesses (import 3 · refine3d 3 · class2d/class3d/multibody 2),
//      zero ghost kinds, dedupe + roster walk order everywhere, and the
//      lib answer equals the raw recompute.
//   C  the face: per-row testid, per-dot title word, aria-hidden dots,
//      the sr-only ear line, small = whisper (size-1.5), steady ink (no
//      hover-coupled opacity — the one-band law), and the t133/t732 row
//      label contracts untouched.
//   D  purity: no hex literals, no storage, census home intact.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, pourKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const pal = readFileSync(path.join(here, "..", "src", "components", "workflow", "palette.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

const stripStart = pal.indexOf("{/* t747 — the row borrows the water dots:");
const stripEnd = pal.indexOf("{/* t730 — the dictionary door:", stripStart);
const strip = stripStart >= 0 && stripEnd > stripStart ? pal.slice(stripStart, stripEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, at the menu                                           */
/* ================================================================== */
console.log("\nA — the row asks the lib's named question");

must(/import \{ JOB_CATEGORIES, JOB_TYPES, PORT_COLORS, jobType, pourKindsOf \} from "@\/lib\/workflow";/.test(pal),
  "A the palette's import is one merged well (PORT_COLORS + pourKindsOf ride the existing workflow line)");

must(libHomeHasPour(), "A pourKindsOf still lives in the lib home (the t746 question, not a directory born in a component)");
function libHomeHasPour() {
  const start = wf.indexOf("t746 — the dictionary page's water row");
  const end = wf.indexOf("/** Port shorthands. */", start);
  return start >= 0 && end > start && /export function pourKindsOf\(typeKey: string\): PortKind\[\]/.test(wf.slice(start, end));
}

must(strip !== "", "A the t747 strip exists between the label block and the t730 door");

must(/const pours = pourKindsOf\(t\.key\); \/\/ t747 — asked once, read twice/.test(pal),
  "A the row computes pours ONCE (dots + ear read the same answer)");

must((strip.match(/background: PORT_COLORS\[k\]\.wire/g) ?? []).length === 1,
  "A the dots ride the resting wire hex (the t735/t746 sample)");

must(!/outputKindOf|\.outputs\.some|\.find\(\(p\) => p\.name/.test(strip),
  "A the strip touches no port arithmetic (lookups live in lib or nowhere)");

/* ================================================================== */
/* B — live-fire: the menu's whole type space                          */
/* ================================================================== */
console.log("\nB — zero ghost waters; the promise is universal");

const keys = new Set(Object.keys(PORT_COLORS));
const rosterOrder = Object.keys(PORT_COLORS);
let types = 0, ghost = 0, unsorted = 0, unduped = 0, libMismatch = 0;
const dist = new Map();
for (const t of JOB_TYPES) {
  types++;
  const pours = pourKindsOf(t.key);
  dist.set(pours.length, (dist.get(pours.length) ?? 0) + 1);
  for (const k of pours) if (!keys.has(k)) ghost++;
  for (let i = 1; i < pours.length; i++) {
    if (rosterOrder.indexOf(pours[i]) <= rosterOrder.indexOf(pours[i - 1])) unsorted++;
  }
  if (new Set(pours).size !== pours.length) unduped++;
  const raw = new Set((t.outputs ?? []).map((o) => o.kind));
  if (pours.length !== raw.size) libMismatch++;
}
const distKey = JSON.stringify([...dist.entries()].sort((a, b) => a[0] - b[0]));
must(types === 40 && distKey === "[[1,35],[2,3],[3,2]]",
  `B the distribution holds: 35 singles · 3 doubles · 2 triples across ${types} types (${distKey})`);
must(ghost === 0, "B zero ghost kinds (every dot's word is a roster member)");
must(unsorted === 0 && unduped === 0,
  "B every pours answer is deduped and walks the roster's own order");
must(libMismatch === 0, "B the lib's named answers equal the raw recompute on every type (one book, two readings agree)");

const poursOf = (k) => pourKindsOf(k);
must(JSON.stringify(poursOf("import")) === JSON.stringify(["movies", "micrographs", "particles"]),
  "B witness import — three dots (movies, micrographs, particles): the menu's front door pours the widest water");
must(JSON.stringify(poursOf("refine3d")) === JSON.stringify(["particles", "volume", "halfmap"]),
  "B witness refine3d — three dots (particles, volume, halfmap)");
must(poursOf("class2d").join(",") === "particles,references2d" && poursOf("class3d").join(",") === "particles,volume" && poursOf("multibody").join(",") === "particles,volume",
  "B witnesses class2d / class3d / multibody — the double-dot family (5 multi-pour types all alive, no dead branch)");

/* ================================================================== */
/* C — the face                                                        */
/* ================================================================== */
console.log("\nC — the whispered strip's face");

must(/data-testid=\{`palette-pours-\$\{t\.key\}`\}/.test(strip),
  "C the strip carries a per-row testid (palette-pours-{type})");

must(/title=\{`pours \$\{k\}`\}/.test(strip),
  "C each dot's title names its word (pours {kind} — hover reads)");

must(/aria-hidden="true"/.test(strip) && /className="sr-only">pours \{pours\.join\(", "\)\}<\/span>/.test(strip),
  "C the dots are aria-hidden and an sr-only line names the kinds for the ear");

must(/size-1\.5/.test(strip),
  "C the whisper is small (size-1.5 — small is the whisper, not a dimmer)");

must(!/group-hover\/item:opacity|opacity-0|opacity-\d\d/.test(strip),
  "C steady ink — no hover-coupled opacity (the one-band law: borrow ink, not volume)");

must(/Drag to canvas to add \$\{t\.label\} \(or press Enter\)/.test(pal) && /TIER_NAMES\[t\.tier\]\} — drag onto the canvas/.test(pal),
  "C the t133/t732 row label contracts untouched (aria-label prefix + title verbatim)");

must(pal.indexOf("t747 — the row borrows the water dots") < pal.indexOf("t730 — the dictionary door: opens the type card"),
  "C promise reads before the info door (identity precedes affordance, the row's own reading order)");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — the row stays clean");

must(!/#[0-9a-fA-F]{3,8}\b/.test(strip),
  "D zero hex literals in the t747 strip (ink comes from the roster, not the row — the fav caret's amber shadow is another task's tenant)");

must(!/localStorage|sessionStorage/.test(strip),
  "D zero storage in the t747 strip (the favorites family's persistence is Task 133's own home, untouched here)");

must(/COLORS palette definition|PORT_COLORS/.test(census),
  "D the census home stays intact (OR word-form — the t743 lesson)");

/* ================================================================== */
console.log(`\nt747 palette water dots — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL > 0 ? 1 : 0);
