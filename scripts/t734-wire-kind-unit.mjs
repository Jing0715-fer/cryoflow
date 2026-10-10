// t734 — the wire's knowledge color: PORT_COLORS speaks a fourth form.
// The lib's port-kind vocabulary (dot / label / text classes) has lived
// in workflow.ts since the t647 era with ZERO readers — the census
// stamped it as a COLORS-definition home and nothing ever consumed it.
// The canvas's wires answered "who feeds whom" in one neutral ink; the
// DATA KIND a wire carries (particles? half-maps? a mask?) was invisible
// — the one fact a scrolling user can see at a glance was the one fact
// the canvas never said.
//
//   A  one vocabulary, four forms: every PortKind row carries dot/label/
//      text classes AND the wire hex — same row, same edit point. The
//      wire form MUST be a hex value: the tailwind JIT content globs
//      scan components/app but not src/lib, so a class literal here
//      never compiles (the reason the vocabulary had no wire reader for
//      sixteen windows). The hex pairings are pinned to the tw palette.
//   B  live-fire over the REAL book: every output port of every one of
//      the 40 types resolves its kind → wire (zero ghost kinds); the
//      derivation is the from-port's own spec (zero second directory);
//      the ink ladder keeps its order — running/chain/hover/primed
//      outrank the knowledge color, which speaks ONLY at rest; a
//      legacy/unmapped edge keeps the neutral ink (honest fallback).
//   C  the tooltip's third line: the kind's own word rides the hover
//      card only when the book knows the port, and the card + caret
//      grow to hold it; two-line voice for legacy edges stays put.
//   D  purity: zero new tailwind hue-class literals on the edges layer
//      (the hex dialect needs none), the census's workflow.ts exemption
//      still covers the vocabulary's home, and the amber two-home
//      census is untouched.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url);
const { PORT_COLORS, JOB_TYPES, jobType } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

const edges = readSrc("components/workflow/edges-layer.tsx");
const wf = readSrc("lib/workflow.ts");
const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");

const KINDS = ["movies", "micrographs", "coords", "particles", "references2d", "volume", "halfmap", "mask", "model", "star", "tiltseries", "tomograms"];
const TW500 = {
  cyan: "#06b6d4", teal: "#14b8a6", amber: "#f59e0b", violet: "#8b5cf6",
  rose: "#f43f5e", orange: "#f97316", pink: "#ec4899", emerald: "#10b981",
  fuchsia: "#d946ef", slate: "#64748b",
};

/* ================================================================== */
/* A — one vocabulary, four forms                                      */
/* ================================================================== */
console.log("\nA — the port-kind vocabulary carries its wire form in the same row");

must(typeof PORT_COLORS === "object" && Object.keys(PORT_COLORS).length === 12,
  `A the vocabulary covers all 12 kinds`, String(Object.keys(PORT_COLORS).length));

must(KINDS.every((k) => typeof PORT_COLORS[k]?.wire === "string" && /^#[0-9a-f]{6}$/i.test(PORT_COLORS[k].wire)),
  "A every kind's wire is a hex VALUE (#rrggbb) — SVG stroke needs a color, not a class");

// hex pairs with the dot class: bg-cyan-500 ⇔ #06b6d4, same row
let pairOk = true, pairBad = "";
for (const k of KINDS) {
  const row = wf.split("\n").find((l) => l.includes(`${k}: {`));
  const dotM = row?.match(/dot: "bg-([a-z]+)-500"/);
  if (!dotM || TW500[dotM[1]] !== PORT_COLORS[k].wire) { pairOk = false; pairBad = k; break; }
}
must(pairOk, "A every wire hex pairs with its own dot class's hue-500 — same row, same edit point", pairBad || "12/12");

must(/t734 — each kind's vocabulary now speaks a fourth form/.test(wf),
  "A the vocabulary's home carries the why (lib is outside the JIT globs — hex is the canvas's dialect)");

must(/PORT_COLORS, outputKindOf \} from "@\/lib\/workflow"/.test(edges),
  "A the edges layer drinks the vocabulary AND the book's resolver (t735: the lookup moved into the book)");

must(Object.keys(PORT_COLORS).every((k) => wf.includes(`${k}: { dot:`) || wf.includes(`${k}: {`)),
  "A all 12 rows live in workflow.ts (the census's COLORS-definition home, t647)");

/* ================================================================== */
/* B — live-fire over the REAL book                                    */
/* ================================================================== */
console.log("\nB — every output port of every type resolves its kind → wire");

must(JOB_TYPES.length >= 35, `B corpus sanity: ${JOB_TYPES.length} types`, "≥35");

let portCount = 0, kindCount = 0, ghostKinds = new Set();
for (const t of JOB_TYPES) {
  const spec = jobType(t.key);
  for (const p of spec?.outputs ?? []) {
    portCount++;
    if (p.kind) {
      kindCount++;
      if (!PORT_COLORS[p.kind]?.wire) ghostKinds.add(p.kind);
    }
  }
}
must(ghostKinds.size === 0 && portCount >= 40,
  `B ${portCount} output ports across the book, ${kindCount} kinded — zero ghost kinds`,
  ghostKinds.size ? [...ghostKinds].join(",") : "all resolve");

must(/outputKindOf\(from\.type, edge\.fromPort\)/.test(edges),
  "B the derivation reads the FROM port's own spec through the book's outputKindOf — zero second directory (t735 单源)");

must(/const kindInk = edgeKind \? PORT_COLORS\[edgeKind\]\.wire : null;/.test(edges),
  "B an unmapped/legacy edge keeps the neutral ink (null → ?? fallback)");

// the ink ladder: knowledge color speaks ONLY at the resting rung —
// every earlier rung (running/chain/hover/touchesSelected/primed) must
// appear BEFORE the kindInk fallback in both stroke and dotFill
const ladderOk = (() => {
  const strokeBlock = edges.slice(edges.indexOf("const stroke = running"), edges.indexOf("const dotFill"));
  const dotBlock = edges.slice(edges.indexOf("const dotFill = running"), edges.indexOf("// width ladder"));
  for (const block of [strokeBlock, dotBlock]) {
    const kindPos = block.indexOf("kindInk ??");
    const firstStatePos = block.indexOf("var(--primary)");
    if (kindPos === -1 || firstStatePos === -1 || firstStatePos > kindPos) return false;
    if ((block.match(/kindInk \?\?/g) ?? []).length !== 1) return false; // exactly one resting rung
  }
  return true;
})();
must(ladderOk,
  "B the ink ladder's order: state colors (running/chain/hover/primed) outrank the knowledge color — kindInk speaks only at rest, once per decision");

/* ================================================================== */
/* C — the tooltip's third line                                        */
/* ================================================================== */
console.log("\nC — the hover card speaks the kind's word when the book knows it");

must(/\{edgeKind \? \(/.test(edges) && /\{String\(edgeKind\)\} data/.test(edges),
  "C the third line rides edgeKind's presence — '{kind} data' in the card's own muted voice");

must(/height=\{edgeKind \? 45 : 34\}/.test(edges) && /const caretY = edgeKind \? 23 : 12;/.test(edges),
  "C the card and caret grow to hold the third line — the two-line voice for legacy edges keeps its geometry");

must(/fillMutedForegroundColor|fill-muted-foreground/.test(edges),
  "C the third line borrows the card's existing muted voice — zero new color words");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — zero new class words on the wire layer; the census holds");

const edgeHues = edges.match(/(?:stroke|fill|bg|text)-(?:emerald|amber|rose|sky|violet|teal|orange|pink|cyan|fuchsia|slate)-\d{2,3}/g) ?? [];
must(edgeHues.length === 0,
  "D the edges layer carries ZERO tailwind hue-class literals — the hex dialect needs none (JIT would miss them anyway)",
  edgeHues.join(",") || "clean");

must(/"src\/lib\/workflow\.ts",\s*\/\/ COLORS palette definition \(t647\)/.test(census),
  "D the census's workflow.ts exemption (t647 COLORS home) still covers the vocabulary");

const amberHomes = ["components/workflow/param-dialect-badge.tsx", "components/workflow/find-mark.tsx"];
must(amberHomes.every((f) => (readSrc(f).match(/amber-400\/35/g) ?? []).length >= 1)
  && (edges.match(/amber-400\/35/g) ?? []).length === 0,
  "D the amber two-home census is untouched; the wire layer stays clean");

must(!/animate-/.test(edges.slice(edges.indexOf("const edgeKind"), edges.indexOf("</svg>"))),
  "D no motion debt on the knowledge ink — a wire's kind is a fact, not an arrival");

console.log(`\n=== t734: ${PASS} pass / ${FAIL} fail ===`);
process.exit(FAIL === 0 ? 0 : 1);
