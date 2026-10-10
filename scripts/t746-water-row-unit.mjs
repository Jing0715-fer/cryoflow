// t746 — the water row: the dictionary page's ingredient line.
// The type card's header said "2 in · 1 out" — counts without words. This
// window gives the card a row that says what water crosses the type:
// drinks (the input sockets' capacity — t738's socket semantics) and pours
// (the output ports' kind — the water's certainty). The tenth reader read
// the receipt; this eleventh reader reads the DICTIONARY — the vocabulary
// now teaches before the job even exists.
//
//   A  one book: both radii derive by filtering the book's own key order
//      (PORT_COLORS), pours from output kind, drinks from accepts (with
//      the optional honesty `?? []`); dots ride PORT_COLORS[k].wire.
//   B  live-fire over the TYPE SPACE (the dictionary's whole world): zero
//      ghost drinks or pours across every type, every type pours at least
//      one kind, and all three drink branches have living witnesses —
//      nothing (the import family), anything (external, the honest
//      omnivore), named dots (everyone else). No dead branch.
//   C  the face: testids, aria-hidden dots, the wrap-graceful row, the
//      drinks/pours labels in font-medium.
//   D  purity: no hue-class literals, no storage, census home intact.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, pourKindsOf, drinkKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const card = readFileSync(path.join(here, "..", "src", "components", "workflow", "type-card-dialog.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

const libStart = wf.indexOf("t746 — the dictionary page's water row");
const libEnd = wf.indexOf("/** Port shorthands. */", libStart);
const libHome = libStart >= 0 && libEnd > libStart ? wf.slice(libStart, libEnd) : "";

const rowStart = card.indexOf("{/* t746 — the water row: the dictionary page's ingredient line.");
const rowEnd = card.indexOf("{/* ------------------------------------------------ upstream", rowStart);
const row = rowStart >= 0 && rowEnd > rowStart ? card.slice(rowStart, rowEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, at the dictionary page                                */
/* ================================================================== */
console.log("\nA — the water row drinks where the roster drinks");

must(libHome !== "",
  "A the water questions live in the lib home (a lookup written in a component is a directory being born)");

must(/export function pourKindsOf\(typeKey: string\): PortKind\[\]/.test(libHome) && /export function drinkKindsOf\(typeKey: string\): PortKind\[\]/.test(libHome),
  "A both named questions are lib exports (pourKindsOf / drinkKindsOf)");

must(/spec\.outputs\.some\(\(o\) => o\.kind === k\)/.test(libHome),
  "A pours ride the OUTPUT ports' kind (the water's certainty)");

must(/spec\.inputs\.some\(\(i\) => \(i\.accepts \?\? \[\]\)\.includes\(k\)\)/.test(libHome),
  "A drinks ride the INPUT sockets' accepts (the socket's capacity, optional-honest)");

must((libHome.match(/Object\.keys\(PORT_COLORS\)/g) ?? []).length === 2,
  "A both radii filter in the book's own key order (the roster's walk order)");

must(/pourKindsOf|drinkKindsOf/.test(card) && !/Object\.keys\(PORT_COLORS\)/.test(card) && !/\baccepts\b/.test(card),
  "A the card asks the lib's named questions and touches no accepts arithmetic (the t730 law, now water-row compliant)");

must((row.match(/background: PORT_COLORS\[k\]\.wire/g) ?? []).length === 2,
  "A both dot families ride the resting wire hex");

must(/>drinks</.test(row) && />pours</.test(row),
  "A the two labels speak (drinks / pours)");

must(/spec\.inputs\.length === 0 \? \(/.test(row) && /type-card-water-nothing/.test(row) && /type-card-water-anything/.test(row),
  "A the honest fallbacks: no sockets → nothing, all wildcards → anything");

/* ================================================================== */
/* B — live-fire: the dictionary's whole type space                    */
/* ================================================================== */
console.log("\nB — zero ghost waters; no dead branch");

const keys = new Set(Object.keys(PORT_COLORS));
let types = 0, ghostDrink = 0, ghostPour = 0, emptyPours = 0, libMismatch = 0;
let zeroInput = 0, allWild = 0, named = 0;
for (const t of JOB_TYPES) {
  types++;
  // the lib's own named questions — the exact code path the card uses
  const pours = pourKindsOf(t.key);
  const drinks = drinkKindsOf(t.key);
  if (pours.length === 0) emptyPours++;
  for (const k of pours) if (!keys.has(k)) ghostPour++;
  for (const k of drinks) if (!keys.has(k)) ghostDrink++;
  const inputs = t.inputs ?? [];
  const drinkSet = new Set(inputs.flatMap((i) => (i.accepts ?? []).filter((a) => a !== "*")));
  const pourSet = new Set((t.outputs ?? []).map((o) => o.kind));
  if (inputs.length === 0) zeroInput++;
  else if (drinkSet.size === 0) allWild++;
  else named++;
  // the lib answer must equal the raw recompute (one book, two readings)
  if (pours.length !== pourSet.size || drinks.length !== drinkSet.size) libMismatch++;
}
must(types > 0 && ghostDrink === 0 && ghostPour === 0,
  `B zero ghost waters across the whole type space (${types} types · drinks+pours all named)`);
must(emptyPours === 0,
  "B every type pours at least one kind (the pours row never renders empty)");
must(zeroInput > 0 && allWild > 0 && named > 0,
  `B all three drink branches have living witnesses (${zeroInput} nothing · ${allWild} anything · ${named} named dots) — no dead branch`);
must(libMismatch === 0,
  "B the lib's named answers equal the raw recompute on every type (one book, two readings agree)");

/* ================================================================== */
/* C — the face                                                        */
/* ================================================================== */
console.log("\nC — the ingredient line's face");

must(/data-testid="type-card-water"/.test(row),
  "C the row carries its probe anchor");

must((row.match(/aria-hidden="true"/g) ?? []).length === 2,
  "C both dot families are aria-hidden decoration (the words are the content)");

must(/flex flex-wrap items-center gap-x-4 gap-y-1/.test(row),
  "C the row wraps gracefully on a narrow dialog");

must(/className="font-medium"/.test(row),
  "C the labels carry a slight weight step above the kind words");

must(/the t735 sample,/.test(row),
  "C the sample's heritage note stands (the same hex the canvas rests in)");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — purity");

must(row !== "" && !/bg-(cyan|teal|amber|violet|rose|orange|pink|emerald|fuchsia|slate)-\d+/.test(row) && !/bg-(cyan|teal|amber|violet|rose|orange|pink|emerald|fuchsia|slate)-\d+/.test(libHome),
  "D zero tailwind hue-class literals in row and lib home (hex rides PORT_COLORS only)");

must(!/localStorage|sessionStorage/.test(row) && !/localStorage|sessionStorage/.test(libHome),
  "D zero storage writes (the ingredient line is derived, never remembered)");

must(/COLORS palette definition|PORT_COLORS/.test(census),
  "D the census's workflow.ts home still covers the vocabulary the row reads");

/* ================================================================== */
console.log(`\n==== t746 water-row unit: ${PASS} pass / ${FAIL} fail ====`);
process.exit(FAIL === 0 ? 0 : 1);
