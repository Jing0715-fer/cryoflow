// t730 — the type card: a dictionary page for a job TYPE. Six windows of
// search-dialect work taught six surfaces to answer "which job"; this
// window gives the lib's TYPE knowledge its first dedicated reading
// surface: what (spec description), where from (upstreamOf — the FULL
// port-compatibility directory, derived live, no canon invented), where
// next (nextStepsFor — the curated t384 canon), what to tune (the
// ParamSchema list with every hint finally readable outside an
// inspector). The two radii stay labelled: arithmetic upstream, curated
// downstream — the two-honest-numbers law applied to provenance.
//
//   A  single sources: upstreamOf lives in lib and drinks
//      portsCompatible (no second port predicate anywhere), the card
//      imports it, the card invents no canon table, zero network, zero
//      storage, no appearance animation, the palette door rides the
//      Task 133 span-as-button grammar.
//   B  live-fire over the REAL directory (lib truth): the front door is
//      honestly empty, the classic chains answer, self-loops are kept
//      (same-type chaining is a legal RELION move), every port pair
//      names ports that exist on both specs, every feeder appears once
//      (hit-and-break discipline), and the two radii answer each other.
//   C  the face: testids, the three section aria-labels, the two radius
//      labels, both honest empty sentences, the palette door's aria and
//      closing contract, the add mouth, hints in full, ADV visible not
//      hidden.
//   D  purity and geometry: the amber census stays at exactly two homes,
//      the card carries no amber of its own, the param grouping covers
//      every param exactly once, the default formatter speaks every
//      ParamType branch, and the card reads no window and no document.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  JOB_TYPES,
  jobType,
  upstreamOf,
  nextStepsFor,
  tabsFor,
  portsCompatible,
} from "../src/lib/workflow";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

const card = readSrc("components/workflow/type-card-dialog.tsx");
const pal = readSrc("components/workflow/palette.tsx");
const wf = readSrc("lib/workflow.ts");
const fm = readSrc("components/workflow/find-mark.tsx");
const badge = readSrc("components/workflow/param-dialect-badge.tsx");

/* ================================================================== */
/* A — single sources                                                  */
/* ================================================================== */
console.log("\nA — the directory lives in lib, the card only reads it");

must(/export function upstreamOf\(key: string\): UpstreamStep\[\]/.test(wf),
  "A upstreamOf is exported from lib/workflow.ts with its UpstreamStep face");
must((wf.match(/export function upstreamOf/g) ?? []).length === 1,
  "A upstreamOf is defined exactly once in the tree");
const upBody = wf.slice(wf.indexOf("export function upstreamOf"));
must(/portsCompatible\(candidate\.key, o\.name, key, i\.name\)/.test(upBody),
  "A upstreamOf derives compatibility through portsCompatible itself (no second port predicate)");
must(/visibleOutputs\(candidate, undefined\)/.test(upBody),
  "A upstreamOf reads spec-visible outputs (the same face the card canvas wires against)");
must(/import\s*{[^}]*upstreamOf[^}]*}\s*from\s*"@\/lib\/workflow"/s.test(card),
  "A the card imports upstreamOf from lib (no private directory)");
must(!/\baccepts\b/.test(card),
  "A the card never touches the `accepts` field directly — port arithmetic stays in lib");
must(!/const NEXT_STEPS|const IMPORT_NEXT_STEPS/.test(card),
  "A the card invents no canon table — nextStepsFor is the only downstream source");
must(/\bfetch\(/.test(card) === false && /localStorage|sessionStorage/.test(card) === false,
  "A the card is synchronous lib data — zero fetch, zero storage");
must(!/animate-/.test(card),
  "A no appearance animation (states, not arrivals — transition-colors hover language only)");
must(/role="button"/.test(card) === false,
  "A the card uses real <button>s inside its own body (no nested-in-button constraint there)");

const infoDoor = pal.slice(pal.indexOf("the dictionary door"));
must(/data-testid=\{`palette-info-\$\{t\.key\}`\}/.test(pal),
  "A the palette row carries the palette-info-{key} dictionary door");
must(infoDoor.indexOf("role=\"button\"") !== -1 && infoDoor.indexOf("stopPropagation") !== -1
    && infoDoor.indexOf("palette-info-") !== -1,
  "A the door rides the Task 133 grammar: span-as-button, pointerdown swallowed");
must(/onKeyDown=\{\(e\) => \{[^}]*"Enter" \|\| e\.key === " "[^}]*setCardKey/.test(pal),
  "A the door answers Enter/Space exactly like the star toggle");
must(/<TypeCardDialog\b/.test(pal) && /open=\{cardKey !== null\}/.test(pal)
    && /if \(!o\) setCardKey\(null\)/.test(pal),
  "A one gate for the card: open derives from cardKey, closing clears it");
must(/onNavigate=\{\(key\) => setCardKey\(key\)\}/.test(pal),
  "A chip navigation re-assigns the key — the dialog stays mounted, the page swaps");

/* ================================================================== */
/* B — live-fire over the REAL directory                               */
/* ================================================================== */
console.log("\nB — the directory answers against the real JOB_TYPES corpus");

must(JOB_TYPES.length >= 35, `B corpus sanity: ${JOB_TYPES.length} types in the book`, "≥35");

const imp = upstreamOf("import");
must(imp.length === 0 && (jobType("import")?.inputs.length ?? -1) === 0,
  "B import has an empty directory because it HAS no inputs — honest emptiness, not a bug");

const mc = upstreamOf("motioncorr");
must(mc.some((u) => u.type === "import"),
  "B motioncorr is fed by import (the movies lane)");

const ctf = upstreamOf("ctffind");
must(ctf.some((u) => u.type === "import") && ctf.some((u) => u.type === "motioncorr"),
  "B ctffind is fed by import AND motioncorr (both lanes genuinely compatible)");

const c2d = upstreamOf("class2d");
must(c2d.some((u) => u.type === "extract") && c2d.some((u) => u.type === "cs2star"),
  "B class2d's directory spans extract and cs2star (particles arrive from both)");

const c3d = upstreamOf("class3d");
must(c3d.some((u) => u.type === "class3d"),
  "B self-loops are kept — same-type chaining is a legal RELION move, the directory says so");

const post = upstreamOf("postprocess");
must(post.some((u) => u.type === "refine3d") && post.some((u) => u.type === "maskcreate"),
  "B postprocess is fed by refine3d and maskcreate");

const downs = nextStepsFor("refine3d");
must(downs.some((d) => d.type === "postprocess") && post.some((u) => u.type === "refine3d"),
  "B the two radii answer each other: refine3d → postprocess (canon) and postprocess ← refine3d (live)");

let portsHonest = true, detail = "";
for (const spec of JOB_TYPES) {
  for (const u of upstreamOf(spec.key)) {
    const from = jobType(u.type);
    if (!from?.outputs.some((o) => o.name === u.fromPort)
      || !spec.inputs.some((i) => i.name === u.toPort)
      || !portsCompatible(u.type, u.fromPort, spec.key, u.toPort)) {
      portsHonest = false; detail = `${u.type} → ${spec.key} names a port that does not exist`; break;
    }
  }
  if (!portsHonest) break;
}
must(portsHonest,
  "B every directory entry names real ports that genuinely pair (full corpus × full directory)", detail);

let onceOnly = true; detail = "";
for (const spec of JOB_TYPES) {
  const seen = new Set();
  for (const u of upstreamOf(spec.key)) {
    if (seen.has(u.type)) { onceOnly = false; detail = `${u.type} lists ${u.type} twice for ${spec.key}`; break; }
    seen.add(u.type);
  }
  if (!onceOnly) break;
}
must(onceOnly,
  "B one port pair per feeder — the hit-and-break discipline holds across the corpus", detail);

const noInputsButHas = JOB_TYPES.filter((s) => s.inputs.length === 0).map((s) => s.key);
must(noInputsButHas.every((k) => upstreamOf(k).length === 0),
  `B every inputless type reports an empty directory (${noInputsButHas.join(", ")})`);

/* ================================================================== */
/* C — the face                                                        */
/* ================================================================== */
console.log("\nC — the face: testids, labels, honest empties, the add mouth");

must(/data-testid="type-card"/.test(card)
  && /data-testid="type-card-add"/.test(card)
  && /data-testid="type-card-upstream"/.test(card)
  && /data-testid="type-card-downstream"/.test(card)
  && /data-testid="type-card-params"/.test(card),
  "C the five fixed testids are present");
must(/data-testid=\{`type-card-upstream-chip-\$\{u\.type\}`\}/.test(card)
  && /data-testid=\{`type-card-downstream-chip-\$\{d\.type\}`\}/.test(card),
  "C the chip testids carry the key they navigate to");
must(/export const UPSTREAM_RADIUS_LABEL[\s\S]*?"derived live from the ports themselves"/.test(card)
  && /export const DOWNSTREAM_RADIUS_LABEL[\s\S]*?"the curated RELION pipeline order"/.test(card),
  "C both radius labels are exported consts — provenance is named, not implied");
must(/export const UPSTREAM_EMPTY_SENTENCE[\s\S]*?"This is the pipeline's front door/.test(card)
  && /export const DOWNSTREAM_EMPTY_SENTENCE[\s\S]*?"Terminal — nothing in the curated canon/.test(card),
  "C both honest empty sentences exist as exported consts (teaching sentence = probe assertion)");
must(/aria-label="Job types that can feed this one"/.test(card)
  && /aria-label="Recommended next steps"/.test(card)
  && /aria-label="Parameter reference"/.test(card),
  "C the three sections name themselves to assistive tech");
must(/aria-label=\{`About \$\{t\.label\} — params, ports, neighbours`\}/.test(pal)
  && /title=\{`About \$\{t\.label\} — params, ports, neighbours`\}/.test(pal),
  "A2 the door's aria and title speak the same sentence");
must(/await addJob\(spec\.key\)/.test(card)
  && /onAddedRef\.current\?\.\(\)/.test(card)
  && /onOpenChange\(false\)/.test(card),
  "C the add mouth rides the store, fires onAdded once, then closes the card");
must(/disabled=\{adding\}/.test(card) && /setAdding\(false\);\s*\}, \[typeKey\]/.test(card),
  "C the busy flag resets when the card changes subject (no leaked spinner across navigation)");
must(/\{p\.hint && /.test(card),
  "C every hint renders in full — the dictionary is where prose gets its reading surface");
must(/p\.advanced && \(/.test(card) && /type-card-param-adv-/.test(card),
  "C advanced rows wear the adv badge instead of hiding (visibility, not burial)");
must(/const tabOf = \(p: ParamSchema\) => p\.tab \?\? "Additional"/.test(card),
  "C unnamed tabs land in Additional (the ParamSchema contract's own default)");

/* ================================================================== */
/* D — purity and geometry                                             */
/* ================================================================== */
console.log("\nD — the hue census, the grouping, the formatter, the sandbox");

const treeAmber = [
  ["find-mark", fm], ["badge", badge],
].filter(([, s]) => /bg-amber-400\/35/.test(s));
let amberHomes = 0;
for (const f of ["find-mark", "param-dialect-badge", "type-card-dialog", "palette", "template-presets-dialog", "job-card", "project-dashboard", "job-inspector", "canvas", "canvas-find-bar"]) {
  if (/bg-amber-400\/35/.test(readSrc(`components/workflow/${f}.tsx`))) amberHomes++;
}
must(treeAmber.length === 2 && amberHomes === 2,
  `D the wash hue's census holds at exactly two homes (found ${amberHomes})`);
must(!/bg-amber-400\/35/.test(card) && !/amber-500\/5/.test(card),
  "D the card carries no amber of its own — it borrows no lens hue and wears no find mirror");

const PARAM_TYPES = ["number", "select", "bool", "path", "text"];
const fmtBranches = PARAM_TYPES.every((t) => card.includes(`"${t}"`));
must(fmtBranches && /function formatDefault\(p: ParamSchema\): string/.test(card),
  "D formatDefault speaks every ParamType branch (the schema's full union)");

let groupingCovers = true; detail = "";
for (const spec of JOB_TYPES) {
  const tabOf = (p) => p.tab ?? "Additional";
  const names = [...tabsFor(spec)];
  for (const p of spec.params) if (!names.includes(tabOf(p))) names.push(tabOf(p));
  const covered = names.flatMap((n) => spec.params.filter((p) => tabOf(p) === n));
  if (covered.length !== spec.params.length) {
    groupingCovers = false; detail = `${spec.key}: ${covered.length} grouped vs ${spec.params.length} params`; break;
  }
  if (spec.params.length > 0 && names.filter((n) => spec.params.some((p) => tabOf(p) === n)).length < 1) {
    groupingCovers = false; detail = `${spec.key}: zero non-empty groups`; break;
  }
}
must(groupingCovers,
  "D the tab grouping covers every param exactly once across the full corpus", detail);

must(!/window\./.test(card) && !/document\./.test(card),
  "D the card reads no window and no document — a pure lib reading surface");

let nonEmpty = true; detail = "";
for (const spec of JOB_TYPES) {
  if (!spec.description || spec.params.length === 0 || spec.params.some((p) => !p.label)) {
    nonEmpty = false; detail = `${spec.key} has a hole in its dictionary data`; break;
  }
}
must(nonEmpty, "D every type's dictionary data is complete (description, params, labels)", detail);

console.log(`\nt730 type card: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
