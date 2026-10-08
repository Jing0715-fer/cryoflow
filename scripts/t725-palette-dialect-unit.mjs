// t725 — the palette dialect unit probe: the third search face learns
// the same dialect. The add-node palette has filtered job types with a
// private four-field includes() since forever — it never heard the t653
// abbreviation dialect ("cls2", "ref3d"), the very pain an operator
// feels most: typing an abbreviation to FIND the node to add. This
// window the palette composes its predicate from lib's dialect pieces
// (the HOW is lib's; the WHAT — label/description/key/category in the
// palette's own reading order — is the palette's), and the find wash
// moves into its own file (t720's law, third execution) so the row can
// wash the characters that won.
//
//   A  the merge: palette imports the lib dialect, the private walk is
//      extinct, substring hit sets are byte-compatible, single
//      characters never fuzzy, the rung order is the reading order.
//   B  the wash's single home: find-mark.tsx owns the amber and the
//      renderer, job-card and palette are consumers, t650 rows follow.
//   C  the contracts: the empty state teaches the dialect, the chip
//      names invisible fields without motion debt, the count stays the
//      filter's product.
//   D  live-fire geometry: spans never escape the text, adjacency
//      merges, the domain is sane.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
// t733 jiti codemod — Node ≥24 ESM no longer resolves extensionless
// imports; jiti (in-tree) loads the REAL lib for live-fire, with the
// project's @/ alias wired so lib-internal @/ imports resolve too.
// In-place (not hoisted): the probe's own execution order is law.
import { createJiti } from "jiti";
import * as __path from "node:path";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": __path.resolve(import.meta.dirname, "..", "src") },
});
const { JOB_TYPES } = await __jiti.import("../src/lib/workflow");
const { subsequenceSpans, subsequenceMatch } = await __jiti.import("../src/lib/job-match");

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const pal = readSrc("components/workflow/palette.tsx");
const card = readSrc("components/workflow/job-card.tsx");
const fm = readSrc("components/workflow/find-mark.tsx");
const censusSrc = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");
const codemodSrc = readFileSync(path.join(here, "t650-solid-codemod.mjs"), "utf8");

// ---------- A: the merge ----------
console.log("A the merge:");
must(pal.includes('from "@/lib/job-match"') && pal.includes("subsequenceSpans") && pal.includes("subsequenceMatch"),
  "A the palette asks lib for the dialect HOW (one door, no second walk)");
must(!/indexOf\(q\[i\]/.test(pal) && !/function\s+\w*[Ss]ubsequence/.test(pal),
  "A the private subsequence walk is extinct in the palette");
{
  // rung order IS the reading order: label, description, key, category,
  // then the guarded subsequence block. Ordered first-match indices.
  const at = (re) => pal.search(re);
  const labelRung = at(/const labelAt = t\.label\.toLowerCase\(\)\.indexOf\(q\);/);
  const descRung = at(/const descAt = t\.description\.toLowerCase\(\)\.indexOf\(q\);/);
  const keyRung = at(/if \(t\.key\.toLowerCase\(\)\.includes\(q\)\) return \{ field: "key" \};/);
  const catRung = at(/if \(t\.category\.toLowerCase\(\)\.includes\(q\)\) return \{ field: "category" \};/);
  const guard = at(/if \(q\.length >= 2\) \{/);
  const seqRung = at(/const labelSeq = subsequenceSpans\(q, t\.label\);/);
  must(labelRung !== -1 && labelRung < descRung && descRung < keyRung && keyRung < catRung && catRung < guard && guard < seqRung,
    "A the rung order is the palette's reading order, guarded subsequence last",
    `label@${labelRung} < desc@${descRung} < key@${keyRung} < cat@${catRung} < guard@${guard} < seq@${seqRung}`);
  must(/const labelAt = t\.label\.toLowerCase\(\)\.indexOf\(q\);\s*\n\s*if \(labelAt !== -1\) return \{ field: "label", spans: \[\[labelAt, labelAt \+ q\.length\]\] \};/.test(pal),
    "A the substring rung carries its wash geometry ([at, at+len))");
}
{
  // favorites gate still applies FIRST: the baseTypes line precedes the
  // dialect filter, so search narrows within favorites, never past them.
  const favAt = pal.indexOf("const baseTypes = favOnly");
  const whyAt = pal.indexOf("const whys = new Map<string, PalWhy>()");
  must(favAt !== -1 && whyAt !== -1 && favAt < whyAt,
    "A the favorites-only gate precedes the dialect filter");
  must(pal.includes("const whys = new Map<string, PalWhy>()") && !pal.includes("useState<Map<string, PalWhy>"),
    "A the why ledger is a per-render Map (no state, no refs)");
}
{
  // live-fire over the REAL catalog. Old formula = the includes era.
  const oldHit = (t, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return t.label.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
  };
  // probe-side mirror of palMatchWhy, built ONLY from lib pieces — the
  // census above pins the implementation to this exact structure. The
  // subsequence rungs read the SHORT identity words only: description
  // is prose, and prose subsequence is noise (first-run evidence:
  // "class" as a subsequence lit 26 of 40 rows; substring alone had 7).
  const newHit = (t, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    if (t.label.toLowerCase().includes(q)) return "label";
    if (t.description.toLowerCase().includes(q)) return "description";
    if (t.key.toLowerCase().includes(q)) return "key";
    if (t.category.toLowerCase().includes(q)) return "category";
    if (q.length >= 2) {
      if (subsequenceSpans(q, t.label)) return "label";
      if (subsequenceMatch(q, t.key)) return "key";
      if (subsequenceMatch(q, t.category)) return "category";
    }
    return null;
  };
  const battery = ["class", "2d", "3d", "ctf", "motion", "refine", "import", "extract",
    "select", "star", "pick", "mask", "tomo", "polish", "external", "classification"];
  // compat law, in three strengths:
  //   1. old ⊆ new for every query — the dialect only ever grows a set;
  //   2. any growth wins on a SHORT identity field, never on prose
  //      ("extract" spelling itself inside "External Command"'s label is
  //      the t653 family's honest ambiguity — inherited, not invented
  //      here; but prose growth would be the noise the first run caught);
  //   3. single characters: byte-identical, no fuzzy at all.
  let compat = true, cDrift = "";
  let proseGrowth = null;
  for (const query of battery) {
    const oldKeys = new Set(JOB_TYPES.filter((t) => oldHit(t, query)).map((t) => t.key));
    for (const t of JOB_TYPES.filter((t) => newHit(t, query))) {
      if (!oldKeys.has(t.key)) {
        const field = newHit(t, query);
        if (field === "description") proseGrowth = `"${query}" grew ${t.key} via prose`;
      }
    }
    for (const k of oldKeys) {
      if (!JOB_TYPES.some((t) => t.key === k && newHit(t, query))) { compat = false; cDrift = `"${query}" lost ${k}`; break; }
    }
    if (!compat) break;
  }
  must(compat, "A substring hits never shrink — old set is inside the new for every query", cDrift || `${battery.length} queries × ${JOB_TYPES.length} types`);
  must(proseGrowth === null, "A growth never comes from prose (the abbreviation rung reads names, not sentences)", proseGrowth ?? "no prose winner in any growth");
  let single = true, sDrift = "";
  for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789") {
    const oldSet = JOB_TYPES.filter((t) => oldHit(t, ch)).map((t) => t.key).join(",");
    const newSet = JOB_TYPES.filter((t) => newHit(t, ch)).map((t) => t.key).join(",");
    if (oldSet !== newSet) { single = false; sDrift = `"${ch}" fuzzy-grew`; break; }
  }
  must(single, "A single characters are substring questions, never patterns", sDrift || "36 chars × full catalog");
  const byKey = (k) => JOB_TYPES.find((t) => t.key === k);
  const growth = (query, key) => {
    const t = byKey(key);
    return t && !oldHit(t, query) && newHit(t, query) !== null;
  };
  must(growth("cls2", "class2d") && growth("cls3", "class3d") && growth("ref3d", "refine3d") && growth("ctffnd", "ctffind"),
    "A the abbreviation dialect grows exactly the set: cls2/cls3/ref3d/ctffnd find their types");
  const cls2 = byKey("class2d");
  must(cls2 && subsequenceSpans("cls2", cls2.label) === null && newHit(cls2, "cls2") === "key",
    "A cls2 wins on the INVISIBLE key (label never spells it) — the chip is the why",
    cls2 ? `label "${cls2.label}"` : "");
  let grew = 0;
  for (const query of ["cls2", "cls3", "ref3d", "ctffnd", "apick", "xtrct"]) {
    const o = JOB_TYPES.filter((t) => oldHit(t, query)).length;
    const n = JOB_TYPES.filter((t) => newHit(t, query)).length;
    if (n > o) grew++;
  }
  must(grew === 6, "A every dialect query only ever GROWS its old hit set", `${grew}/6 queries`);
  must(/if \(q\.length >= 2\) \{[\s\S]*?\}\n  return null;/.test(pal) &&
       !/if \(q\.length >= 2\) \{[\s\S]*?subsequence(?:Spans|Match)\(q, t\.description\)/.test(pal),
    "A prose is exempt from the abbreviation rung — a description is read, not abbreviated");
}

// ---------- B: the wash's single home ----------
console.log("B the wash's single home:");
must(/export const FIND_MARK_CLASS =/.test(fm) && /export function FindMarkedText/.test(fm),
  "B find-mark.tsx owns the amber and the renderer, exported once");
must(fm.includes('data-find-why-mark=""'),
  "B the t655 e2e selector survives the move (data-find-why-mark)");
must(fm.includes("trustworthy") && fm.includes("e <= text.length"),
  "B the honesty guard survives the move (escaped spans fall back to plain text)");
must(card.includes('import { FindMarkedText } from "./find-mark"') && !card.includes("const FIND_MARK_CLASS"),
  "B job-card is a consumer now — no local amber definition");
must(pal.includes('import { FindMarkedText, FIND_MARK_CLASS } from "./find-mark"'),
  "B the palette imports the wash from the same home");
{
  const sites = [];
  for (const rel of ["components/workflow/find-mark.tsx", "components/workflow/param-dialect-badge.tsx",
    "components/workflow/job-card.tsx", "components/workflow/palette.tsx",
    "components/workflow/canvas-find-bar.tsx", "components/workflow/project-dashboard.tsx"]) {
    if (readSrc(rel).includes("bg-amber-400/35")) sites.push(rel);
  }
  must(sites.length === 2 && sites.includes("components/workflow/find-mark.tsx"),
    "B the wash amber lives at exactly two homes: find-mark (wash) + badge (chip)",
    sites.join(" + "));
}
must(censusSrc.includes('find-mark.tsx", re: /FIND_MARK_CLASS = |rounded-\\[2px\\] bg-amber-400\\/35/') &&
     codemodSrc.includes('find-mark.tsx", re: /FIND_MARK_CLASS = |rounded-\\[2px\\] bg-amber-400\\/35/') &&
     !censusSrc.includes('job-card.tsx", re: /FIND_MARK_CLASS = /'),
  "B the t650 census/codemod rows follow the wash to its new home (const line AND amber string line)");
must(censusSrc.includes('param-dialect-badge.tsx", re: /bg-amber-400\\/35/') &&
     codemodSrc.includes('param-dialect-badge.tsx", re: /bg-amber-400\\/35/'),
  "B the badge's amber carries its own exemption row (the t722 residue the census silently carried is now judged)");

// ---------- C: the contracts ----------
console.log("C the contracts:");
must(pal.includes("Abbreviations work too") && pal.includes("cls2") && pal.includes("ref3d") && pal.includes("ctffnd"),
  "C the empty state teaches the dialect at the moment of need");
must(pal.includes('title="Substring first, then in-order abbreviations — matched characters highlight"'),
  "C the input's title names the dialect");
must(pal.includes('placeholder="Search job types…"') && pal.includes('aria-label="Search job types"'),
  "C the placeholder and aria contract survive unchanged");
must(/data-pal-why=\{w\.field\}/.test(pal) && /w\.field === "key" \? "key" : "cat"/.test(pal),
  "C the invisible fields' chip names the field (key/cat)");
{
  const chipAt = pal.indexOf('data-pal-why=');
  const chipBlock = pal.slice(chipAt - 400, chipAt + 700);
  must(!chipBlock.includes("transition") && !chipBlock.includes("animate"),
    "C the chip has no motion debt of its own (a state, not an arrival)");
}
must(pal.includes('w && w.field === "label" ? (') && pal.includes('w && w.field === "description" ? ('),
  "C the wash lands only on the field that won (guard by field)");
{
  const labelWash = pal.indexOf('{w && w.field === "label" ? (');
  const descWash = pal.indexOf('{w && w.field === "description" ? (');
  const chip = pal.indexOf('data-pal-why=');
  must(labelWash !== -1 && labelWash < descWash && descWash < chip,
    "C the row's why follows the row's reading order: label, description, chip");
}
must(pal.includes("`${filtered.length} of ${JOB_TYPES.length} types shown`"),
  "C the count chip stays the dialect filter's product");
must(!pal.includes("fetch("),
  "C the dialect path adds no network (palette stays a client lens)");

// ---------- D: live-fire geometry ----------
console.log("D live-fire geometry:");
{
  const sane = (spans, text) =>
    spans !== null &&
    spans.every(([s, e], i) =>
      Number.isInteger(s) && Number.isInteger(e) && 0 <= s && s < e && e <= text.length &&
      (i === 0 || spans[i - 1][1] <= s));
  const battery = ["cls2", "cls3", "ref3d", "ctffnd", "apick", "xtrct", "class", "2d", "pick"];
  let all = true, drift = "";
  outer:
  for (const query of battery) {
    for (const t of JOB_TYPES) {
      for (const text of [t.label, t.description, t.key, t.category]) {
        const spans = subsequenceSpans(query, text);
        if (spans !== null && !sane(spans, text)) { all = false; drift = `"${query}" on "${text}"`; break outer; }
      }
    }
  }
  must(all, "D every span set is bounded, ascending, non-overlapping", drift || `${battery.length} queries × ${JOB_TYPES.length} types × 4 fields`);
  const merged = subsequenceSpans("class", "2D Classification");
  must(merged && merged.length === 1 && merged[0][0] === 3 && merged[0][1] === 8,
    "D adjacent anchors merge — 'class' is one wash, not five islands");
  const domain = JOB_TYPES.every((t) =>
    typeof t.key === "string" && t.key && typeof t.label === "string" && t.label &&
    typeof t.description === "string" && t.description && typeof t.category === "string" && t.category);
  must(domain, `D the search domain is sane: ${JOB_TYPES.length} types, four non-empty words each`);
  must(subsequenceSpans("cls2", "class2d") !== null && subsequenceSpans("zz9", "class2d") === null,
    "D the primitive answers yes and no honestly");
}

console.log(`\nt725 palette dialect: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
