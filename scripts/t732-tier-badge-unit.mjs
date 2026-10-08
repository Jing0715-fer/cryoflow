// t732 — the tier badge: the tier language moves into its own home.
// Two faces had been speaking the tier's vocabulary in two files (the
// palette row's inline compact badge since Task 133, the type card's
// header badge since t730) — the t730 exemption judgment stamped BOTH
// homes' hue lines, the census's own tell that a vocabulary is
// duplicated. The t720 law (fifth execution: JOURNAL_KIND_FACE →
// ParamDialectBadge → FindMarkedText → the t730 judgments → this) says
// words shared by two faces live in their own file. The test stone from
// t730 — "when the tier color changes, do you edit one place or two?" —
// now answers: one.
//
//   A  single sources: the badge component and BOTH vocabularies (full
//      names, short words) export from one file; every tier hue literal
//      lives exactly there; the two consumer faces carry zero tier JSX
//      and zero tier ternaries; the palette's button title drinks
//      TIER_NAMES instead of re-spelling the sentences.
//   B  the two faces: compact (dot + short word + aria-hidden, the
//      row's tight grammar) and full (whole word + title + testid, the
//      card's reading grammar) — and the historical strings survive
//      byte-identical (the Task 133 title sentences, the Task 133 short
//      words), because a migration that rewrites what the user already
//      learned is a redesign wearing a refactor's clothes.
//   C  census collaboration: the exemption verdicts moved WITH the
//      language — tier-badge.tsx is a file-exempt identity home in both
//      tools' tables, the type-card row exemptions are retired (dead
//      exemptions are expired visas), palette's note names the new
//      reality.
//   D  purity: the wash hue's two-home census is untouched, the badge
//      carries no motion debt, and the card/palette gains no new color
//      words of their own.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

const tb = readSrc("components/workflow/tier-badge.tsx");
const pal = readSrc("components/workflow/palette.tsx");
const card = readSrc("components/workflow/type-card-dialog.tsx");
const types = readSrc("lib/types.ts");
const fm = readSrc("components/workflow/find-mark.tsx");
const badge = readSrc("components/workflow/param-dialect-badge.tsx");

/* ================================================================== */
/* A — one home for the vocabulary                                     */
/* ================================================================== */
console.log("\nA — the tier language lives in exactly one file");

must(/export function TierBadge\(/.test(tb)
  && /export const TIER_NAMES: Record<JobTier, string>/.test(tb)
  && /export const TIER_SHORT: Record<JobTier, string>/.test(tb),
  "A tier-badge exports the component AND both vocabularies (names + short words)");
must(/import type \{ JobTier \} from "@\/lib\/types"/.test(tb)
  && /export type JobTier = "core" \| "cmd" \| "external"/.test(types),
  "A the tier union is the spec's own JobTier — no second union invented");
must(/import \{ TierBadge, TIER_NAMES \} from "\.\/tier-badge"/.test(pal),
  "A the palette imports the badge AND the names");
must(/import \{ TierBadge \} from "\.\/tier-badge"/.test(card),
  "A the type card imports the badge");
must(/TIER_NAMES\[t\.tier\]} — drag onto the canvas/.test(pal),
  "A the palette's button title drinks TIER_NAMES (no re-spelled sentences)");
must((pal.match(/bg-emerald-500\/10/g) ?? []).length === 0
  && (card.match(/bg-emerald-500\/10/g) ?? []).length === 0,
  "A the two consumer faces carry zero tier-hue literals (the JSX moved)");
must((pal.match(/"cli"|=== "cli"/g) ?? []).length === 0
  && /core: "core",/.test(tb) && /cmd: "cli",/.test(tb),
  "A the short words live only in TIER_SHORT (the palette's private ternary is gone)");
must((["core", "cmd", "external"].every((t) => (tb.match(new RegExp(`tier === "${t}"`, "g")) ?? []).length >= 1))
  && /tier === "core"/.test(pal) === false,
  "A the hue ternaries live only in the badge (palette has none left)");
must(/\bfetch\(|localStorage|sessionStorage|window\.|document\./.test(tb) === false,
  "A the badge is a pure reading surface — zero fetch, zero storage, zero DOM probes");
must(!/animate-/.test(tb),
  "A no motion debt — a tier is a fact, not an arrival");

/* ================================================================== */
/* B — the two faces and the historical strings                        */
/* ================================================================== */
console.log("\nB — two faces, one badge; the user's learned words survive");

must(/compact \? "text-\[8px\]" : "px-1\.5 py-px text-\[10px\]"/.test(tb),
  "B the size dialect is the faces' only size difference (8px row / 10px card)");
must(/size-1 rounded-full/.test(tb) && /compact && \(/.test(tb),
  "B the dot rides the compact face only (the card's header needs no syllable)");
must(/"aria-hidden": true as const/.test(tb),
  "B the compact face stays aria-hidden (the row's own title speaks the tier)");
must(/title: TIER_NAMES\[tier\]/.test(tb),
  "B the full face speaks its own title — the full sentence rides the badge");
must(/data-testid=\{testid\}/.test(tb) && /<TierBadge tier=\{spec\.tier\} testid="type-card-tier" \/>/.test(card),
  "B the testid is a prop — each face names itself where a probe needs it (t724's law)");
must(/<TierBadge tier=\{t\.tier\} compact \/>/.test(pal),
  "B the palette row renders the compact face");
must(/core: "Core \(real engine\)",\s*\n\s*cmd: "Runs real RELION CLI",\s*\n\s*external: "Needs external binary",/s.test(tb),
  "B TIER_NAMES is byte-identical to the Task 133 ternary's sentences");
must(/core: "core",\s*\n\s*cmd: "cli",\s*\n\s*external: "ext",/s.test(tb),
  "B TIER_SHORT is byte-identical to the Task 133 short words");
must(/tier === "core" && "bg-emerald-500",/.test(tb)
  && /tier === "cmd" && "bg-muted-foreground\/60",/.test(tb)
  && /tier === "external" && "bg-amber-500"/.test(tb),
  "B the dot's solid volume keeps its own per-tier words (identity at full volume)");

/* ================================================================== */
/* C — the verdicts moved with the language                            */
/* ================================================================== */
console.log("\nC — census collaboration: exemptions follow the words");

const census = readFileSync(path.join(here, "t650-solid-census.mjs"), "utf8");
const codemod = readFileSync(path.join(here, "t650-solid-codemod.mjs"), "utf8");
must(census.includes('"src/components/workflow/tier-badge.tsx"')
  && codemod.includes('"src/components/workflow/tier-badge.tsx"'),
  "C both tools' tables carry tier-badge.tsx as a file-exempt identity home");
must(!census.includes("type-card-dialog.tsx\", re:") && !codemod.includes("type-card-dialog.tsx\", re:"),
  "C the type-card row exemptions are retired — dead exemptions are expired visas");
must(/tier badges \+ gold star \(t647; t732/.test(codemod) || /t732/.test(census),
  "C palette's exemption note names the move (the judgment's paper trail stays legible)");

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — the lens hue untouched, no new color words");

const treeHomes = [fm, badge].filter((s) => /bg-amber-400\/35/.test(s)).length;
let homes = 0;
for (const f of ["find-mark", "param-dialect-badge", "tier-badge", "type-card-dialog", "palette", "template-presets-dialog", "job-card", "job-inspector", "canvas", "canvas-find-bar"]) {
  if (/bg-amber-400\/35/.test(readSrc(`components/workflow/${f}.tsx`))) homes++;
}
must(treeHomes === 2 && homes === 2,
  `D the wash hue's census holds at exactly two homes (found ${homes})`);
must(!/bg-amber-400\/35/.test(tb) && !/amber-500\/5/.test(tb),
  "D the tier badge wears its own identity hues — it borrows no lens amber");
must(/t\.tier === "external" &&\s*\n\s*"bg-amber-500\/10/.test(pal) === false,
  "D the palette gains no re-inlined tier words (the move is one-way)");

console.log(`\nt732 tier badge: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
