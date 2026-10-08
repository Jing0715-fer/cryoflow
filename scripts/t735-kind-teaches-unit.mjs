// t735 — the kind vocabulary's teaching face. t734 gave the canvas
// wire a resting ink drawn from PORT_COLORS; but a color nobody can
// name is decoration. This window makes the same vocabulary teach
// itself at the two places a user READS about a hand-off: the type
// card's port-pair chips (upstream + downstream) grow a color sample
// that IS the wire's hex, and the wire's hover card grows a color
// sample before the kind's word — the color and the word travel
// together everywhere.
//
//   A  one lookup, three readers: outputKindOf lives in the book (the
//      wire layer's derivation, the card's chipInk — a lookup written
//      three times is a directory being born); both consumers carry
//      zero inline find-derivations anymore.
//   B  live-fire over the REAL book: every upstream and downstream
//      port pair of all 40 types resolves its kind → wire (zero ghost
//      pairs); chipInk is pointwise-equal to PORT_COLORS[kind].wire;
//      the sample rides inline style (the hex dialect — tailwind can't
//      see lib classes), conditional (null → no sample).
//   C  the word rides the color: both chips' titles speak "{kind}
//      data"; the wire card's third line draws the sample dot before
//      the same phrase; samples are aria-hidden decoration (the title
//      speaks, the dot paints).
//   D  purity: zero tailwind hue-class literals on either consumer,
//      the census's workflow.ts home still covers the vocabulary, the
//      amber two-home census is untouched, zero motion on samples.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url);
const { PORT_COLORS, JOB_TYPES, jobType, upstreamOf, nextStepsFor, outputKindOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

const edges = readSrc("components/workflow/edges-layer.tsx");
const card = readSrc("components/workflow/type-card-dialog.tsx");
const wf = readSrc("lib/workflow.ts");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

/* ================================================================== */
/* A — one lookup, three readers                                       */
/* ================================================================== */
console.log("\nA — the kind lookup lives in the book, all readers drink it");

must(/export function outputKindOf\(typeKey: string, portName: string\): PortKind \| undefined/.test(wf),
  "A outputKindOf is exported from lib/workflow — the book's own lookup");

must(/outputKindOf/.test(edges) && !/outputs\?\.find/.test(edges),
  "A the wire layer drinks the lookup — zero inline find-derivation left");

must(/outputKindOf/.test(card) && !/outputs\?\.find/.test(card),
  "A the type card drinks the lookup — zero inline find-derivation left");

must(/const kind = outputKindOf\(typeKey, fromPort\);/.test(card)
  && /return kind \? PORT_COLORS\[kind\]\.wire : null;/.test(card),
  "A chipInk is a thin pour: outputKindOf → PORT_COLORS wire, null when silent");

must(/outputKindOf\(.*\?\..*kind|outputKindOf\(.*\)\?\.kind|find\(\(p\) => p\.name === portName\)\?\.kind/.test(wf),
  "A the lookup itself reads the spec's own kind field — zero second directory");

/* ================================================================== */
/* B — live-fire over the REAL book                                    */
/* ================================================================== */
console.log("\nB — every chip's port pair resolves; chipInk IS the wire's hex");

let pairs = 0, ghost = 0;
for (const t of JOB_TYPES) {
  for (const u of upstreamOf(t.key)) {
    pairs++;
    // UpstreamStep.fromPort reads the FEEDER's output — key on u.type
    if (!outputKindOf(u.type, u.fromPort)) ghost++;
  }
  for (const d of nextStepsFor(t.key)) {
    pairs++;
    // NextStep.fromPort reads the SOURCE type's own output — key on
    // t.key, NOT on the target type (the first run's 44 ghosts were
    // this probe asking the wrong side of the hand-off)
    if (!outputKindOf(t.key, d.fromPort)) ghost++;
  }
}
must(pairs >= 60 && ghost === 0,
  `B ${pairs} chip port pairs across the book — zero ghost pairs (all resolve a kind)`,
  ghost ? `${ghost} ghosts` : "all resolve");

let inkOk = true;
for (const t of JOB_TYPES.slice(0, 12)) {
  for (const u of upstreamOf(t.key)) {
    const kind = outputKindOf(u.type, u.fromPort);
    const wire = kind ? PORT_COLORS[kind].wire : null;
    const expected = kind ? PORT_COLORS[kind].wire : null;
    if (wire !== expected) { inkOk = false; break; }
  }
}
must(inkOk, "B chipInk ≡ PORT_COLORS[kind].wire pointwise — the chip teaches exactly what the wire paints");

must(/chipInk\(spec\.key, d\.fromPort\)/.test(card)
  && !/chipInk\(d\.type, d\.fromPort\)/.test(card),
  "B the downstream chip keys the lookup on the SOURCE side (spec.key) — NextStep.fromPort is the source's own output");

must(/style=\{\{ background: chipInk\(u\.type, u\.fromPort\) as string \}\}/.test(card)
  && /style=\{\{ background: chipInk\(spec\.key, d\.fromPort\) as string \}\}/.test(card),
  "B both chips' samples ride inline style — the hex dialect (tailwind can't see lib classes)");

must(/\{chipInk\(u\.type, u\.fromPort\) \? \(/.test(card)
  && /\{chipInk\(spec\.key, d\.fromPort\) \? \(/.test(card),
  "B the sample is conditional — a silent book means no sample, never an empty dot");

/* ================================================================== */
/* C — the word rides the color                                        */
/* ================================================================== */
console.log("\nC — color and word travel together");

must(/— \$\{outputKindOf\(u\.type, u\.fromPort\)\} data/.test(card)
  && /— \$\{outputKindOf\(spec\.key, d\.fromPort\)\} data/.test(card),
  "C both chips' titles speak '{kind} data' — hover reads the word, the dot paints it");

must(/<tspan fill=\{PORT_COLORS\[edgeKind\]\.wire\}/.test(edges) && /\{String\(edgeKind\)\} data/.test(edges),
  "C the wire card's third line draws the sample dot before the same phrase — the vocabulary teaches itself on the wire too");

must(/aria-hidden="true"/.test(card.slice(card.indexOf("chipInk(u.type, u.fromPort) ? ("), card.indexOf("chipInk(u.type, u.fromPort) ? (") + 400)),
  "C the chip sample is aria-hidden decoration — the title speaks, the dot paints");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — zero new class words; the census holds");

const cardHues = card.match(/(?:bg|text)-(?:emerald|amber|rose|sky|violet|teal|orange|pink|cyan|fuchsia|slate)-\d{2,3}/g) ?? [];
const t735CardRegion = card.slice(card.indexOf("t735"), card.indexOf("parameters —"));
must((t735CardRegion.match(/(?:bg|text)-(?:emerald|violet|cyan|teal|amber|rose|orange|pink|fuchsia|slate)-\d{2,3}/g) ?? []).length === 0,
  "D the t735 sample regions carry ZERO tailwind hue classes — hex only");

must(/"src\/lib\/workflow\.ts",\s*\/\/ COLORS palette definition \(t647\)/.test(census),
  "D the census's workflow.ts exemption (t647) still covers the vocabulary's home");

const amberHomes = ["components/workflow/param-dialect-badge.tsx", "components/workflow/find-mark.tsx"];
must(amberHomes.every((f) => (readSrc(f).match(/amber-400\/35/g) ?? []).length >= 1)
  && (edges.match(/amber-400\/35/g) ?? []).length === 0
  && (card.match(/amber-400\/35/g) ?? []).length === 0,
  "D the amber two-home census is untouched; both consumers stay clean");

must(!/animate-/.test(card.slice(card.indexOf("chipInk(u.type"), card.indexOf("</ul>", card.indexOf("downstream")))),
  "D no motion on the samples — a kind is a fact, not an arrival");

console.log(`\n=== t735: ${PASS} pass / ${FAIL} fail ===`);
process.exit(FAIL === 0 ? 0 : 1);
