// t748 — the seat's placard: the inspector meta strip says what the type
// drinks and pours, inline beside the surname. The twelfth reader read the
// MENU before the job exists (t747); this thirteenth reader reads the
// TABLE CARD after it does — the user opens the node's door and the meta
// strip's first word is the type's label, with the water words beside it.
// The sentence is t746's dictionary line spoken inline; the dot is the
// t747 scanning whisper (size-1.5), not the dictionary's size-2 study
// face — the dictionary teaches the full lesson, the placard only hangs
// it. Volume belongs to distance: a calm strip whispers.
//
//   A  one book: the header asks the lib's own named questions
//      (drinkKindsOf/pourKindsOf — the t746 home), dots ride
//      PORT_COLORS[k].wire, and the questions are asked ONCE (drinks and
//      pours each computed once, read by both families). The undefined
//      gate: an unknown type stays SILENT — silence is honest, "nothing"
//      would be a lie.
//   B  live-fire over the TYPE SPACE (40): every type pours at least one
//      kind, the drink distribution holds the t746 account
//      (3 nothing / 1 anything / 36 named), the pour distribution holds
//      the t747 account ([[1,35],[2,3],[3,2]]), zero ghost kinds, and the
//      lib answer equals the raw recompute.
//   C  the face: the insp-water testid family (verbatim word forms),
//      data-kind per word, aria-hidden dots + the decorative separator,
//      drinks/pours in the strip's own muted voice, the spec gate's JSX
//      shape sitting between the surname and the count chips.
//   D  purity: no hex literals in the strip, no storage writes, the strip's
//      old residents (t347 count chips, one-calm-line comment, t444 stale
//      strip) keep their seats, and the judgment note is in place.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, drinkKindsOf, pourKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const insp = readFileSync(path.join(here, "..", "src", "components", "workflow", "job-inspector.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

const noteStart = insp.indexOf("/* t748 — the table card's water words");
const noteEnd = insp.indexOf("const running = job.status", noteStart);
const note = noteStart >= 0 && noteEnd > noteStart ? insp.slice(noteStart, noteEnd) : "";
const waterStart = insp.indexOf('data-testid="insp-water"');
const waterEnd = insp.indexOf("{countChips.map", waterStart);
const waterStrip = waterStart >= 0 && waterEnd > waterStart ? insp.slice(insp.lastIndexOf("{spec ? (", waterStart), waterEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, at the seat                                           */
/* ================================================================== */
console.log("\nA — the header asks the lib's named questions");

must(/import \{ jobType, tabsFor, PORT_COLORS, drinkKindsOf, pourKindsOf \} from "@\/lib\/workflow";/.test(insp),
  "A the inspector's import is one merged well (PORT_COLORS + drinkKindsOf + pourKindsOf ride the existing workflow line)");

must(libHomeHasQuestions(), "A drinkKindsOf/pourKindsOf still live in the lib home (the t746 questions, not directory logic reborn in a component)");
function libHomeHasQuestions() {
  const start = wf.indexOf("t746 — the dictionary page's water row");
  const end = wf.indexOf("/** Port shorthands. */", start);
  const home = start >= 0 && end > start ? wf.slice(start, end) : "";
  return home.includes("export function pourKindsOf(typeKey: string): PortKind[]") &&
         home.includes("export function drinkKindsOf(typeKey: string): PortKind[]");
}

must(/const drinkKinds = spec \? drinkKindsOf\(job\.type\) : \[\];/.test(insp) &&
     /const pourKinds = spec \? pourKindsOf\(job\.type\) : \[\];/.test(insp),
  "A the questions are gated by spec (undefined law: an unknown type never asks, never lies)");

must((insp.match(/const drinkKinds = spec/g) || []).length === 1 &&
     (insp.match(/const pourKinds = spec/g) || []).length === 1,
  "A each question is asked exactly ONCE (computed once, read by both families)");

must(waterStrip.includes("PORT_COLORS[k].wire"),
  "A dots ride PORT_COLORS[k].wire (the t735 sample, now at the placard)");

must(note.includes("size-1.5") && note.includes("t747"),
  "A the judgment note names the whisper dialect (size-1.5, the t747 scanning sample)");

/* ================================================================== */
/* B — live-fire over the type space                                   */
/* ================================================================== */
console.log("\nB — the type space's accounts, re-counted at the seat");

let ghost = 0, pourDist = {};
let nothingCount = 0, anythingCount = 0, namedCount = 0;
let rawMismatch = 0;
for (const t of JOB_TYPES) {
  const spec = jobType(t.key);
  const dk = drinkKindsOf(t.key);
  const pk = pourKindsOf(t.key);
  const rawD = [...new Set((spec?.inputs ?? []).flatMap((i) => (i.accepts ?? []).filter((a) => a !== "*")))].sort();
  const rawP = [...new Set((spec?.outputs ?? []).map((o) => o.kind))].sort();
  if (JSON.stringify([...dk].sort()) !== JSON.stringify(rawD) || JSON.stringify([...pk].sort()) !== JSON.stringify(rawP)) rawMismatch++;
  for (const k of [...dk, ...pk]) if (!PORT_COLORS[k]) ghost++;
  if (pk.length === 0) pourDist.zero = (pourDist.zero ?? 0) + 1;
  pourDist[pk.length] = (pourDist[pk.length] ?? 0) + 1;
  if (dk.length > 0) namedCount++;
  else if ((spec?.inputs ?? []).length === 0) nothingCount++;
  else anythingCount++;
}

must(JOB_TYPES.length === 40, "B the type space is 40 strong", `got ${JOB_TYPES.length}`);
must(ghost === 0, "B zero ghost kinds (every word the placard can speak has a color in PORT_COLORS)");
must(rawMismatch === 0, "B the lib answer equals the raw recompute (one truth, two mouths)");
must(pourDist.zero === undefined, "B every type pours at least one kind (no zero-pour outliers)");

const t746Account = nothingCount === 3 && anythingCount === 1 && namedCount === 36;
must(t746Account, "B the drink distribution holds the t746 account (3 nothing / 1 anything / 36 named)",
  `got ${nothingCount} nothing / ${anythingCount} anything / ${namedCount} named`);

const t747Account = pourDist[1] === 35 && pourDist[2] === 3 && pourDist[3] === 2;
must(t747Account, "B the pour distribution holds the t747 account ([[1,35],[2,3],[3,2]])",
  `got ${JSON.stringify(pourDist)}`);

/* ================================================================== */
/* C — the face                                                        */
/* ================================================================== */
console.log("\nC — the placard's face");

must(waterStrip.length > 0, "C the insp-water strip slice exists (the probe can read the placard)");
must(waterStrip.includes('data-testid="insp-water"'), "C the container testid is verbatim (insp-water)");
must(waterStrip.includes('data-testid="insp-water-nothing"') && waterStrip.includes('data-testid="insp-water-anything"'),
  "C the fallback testids speak the t746 contract word forms (nothing / anything)");

must((waterStrip.match(/data-kind=\{k\}/g) || []).length === 2,
  "C each family's word carries data-kind (drinks and pours both readable by kind)");

must((waterStrip.match(/aria-hidden="true"/g) || []).length === 3,
  "C the dots (2) and the decorative separator (1) are aria-hidden (decor stays out of the ear)",
  `got ${(waterStrip.match(/aria-hidden="true"/g) || []).length} aria-hidden marks`);

must((waterStrip.match(/size-1\.5/g) || []).length === 2,
  "C the dots are the scanning whisper (size-1.5 — the t747 sample, not the size-2 study face)");

must(waterStrip.includes(">drinks</span>") && waterStrip.includes(">pours</span>"),
  "C the words drinks/pours are verbatim (t746's sentence, inline)");

must(waterStrip.includes('className="font-medium text-foreground/60"'),
  "C the words wear the strip's muted voice (font-medium text-foreground/60)");

must(insp.indexOf('{spec ? (', insp.indexOf("text-foreground/70\">{spec?.label ?? job.type}")) <
     insp.indexOf("{countChips.map"),
  "C the placard sits between the surname and the count chips (type's own neighborhood)");

must(waterStrip.includes("spec.inputs.length === 0"),
  "C the nothing fallback asks the input mouths (not the drink words) — the t746 logic verbatim");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — the strip stays clean");

must(!/#[0-9a-fA-F]{3,8}\b/.test(waterStrip),
  "D no hex literals in the strip (every color rides PORT_COLORS)");

must(!/localStorage|sessionStorage/.test(waterStrip),
  "D no storage writes in the strip (t133's collector keeps its own home)");

must(insp.includes("one calm line") && insp.includes('data-header-count={c.key}') && insp.includes('data-testid="stale-strip"'),
  "D the strip's old residents keep their seats (one-calm-line note, t347 count chips, t444 stale strip)");

must(/t748 — the table card's water words \(the kind vocabulary's thirteenth/.test(insp),
  "D the judgment note is in place (the thirteenth reader is named)");

/* ================================================================== */
console.log(`\n${PASS}/${PASS + FAIL}`);
process.exit(FAIL === 0 ? 0 : 1);
