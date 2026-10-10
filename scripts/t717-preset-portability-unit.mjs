// t717-preset-portability-unit.mjs — the carry face's laws, pinned before
// the bundle wakes (the t653 pattern, seventh reuse).
//
// The t717 lane: the preset family (t713 wear / t714 start / t715 mirror /
// t716 overview) gains its FIFTH face — carry. lib/preset-portability.ts
// exports the whole shelf as one JSON file and imports one back through
// the server's own whitelist; the dashboard shelf grows the header verbs
// and the three-phase import dialog. The unit probe pins the laws a
// build-day e2e should never have to re-derive:
//
//   A  the export law — the file carries its identity (kind + version),
//      the lib's exact wire shape, and a date-stamped name.
//   B  the import laws — kind gates BEFORE entry inspection; the server
//      door speaks again entry-by-entry (refusals counted, not fatal);
//      exact twins skipped (key-order-insensitive, createdAt-free);
//      id collisions re-mint while free ids survive; the cap is COUNTED
//      (overflow is a receipt line); import never deletes.
//   C  purity + the single write well — portability touches no storage;
//      the component lands merges through writeUserParamPresets (the
//      t713 lib's persist: localStorage + t715 PUT + changed event) and
//      downloads through downloadText (t191: no hand-danced anchors).
//   D  the dialog's census — three phases by name, every refusal
//      humanized, every nonzero receipt clause spoken, the empty
//      shelf's DOOR present, motion-reduce discipline held.
//
// Run:  node scripts/unit-runner.mjs scripts/t717-preset-portability-unit.mjs

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

// t733 jiti codemod — Node ≥24 ESM no longer resolves extensionless
// imports; jiti (in-tree) loads the REAL lib for live-fire, with the
// project's @/ alias wired so lib-internal @/ imports resolve too.
// In-place (not hoisted): the probe's own execution order is law.
import { createJiti } from "jiti";
import * as __path from "node:path";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": __path.resolve(import.meta.dirname, "..", "src") },
});
const { exportShelfPayload, exportShelfFilename, importShelfPayload, PRESET_PAYLOAD_KIND, PRESET_PAYLOAD_VERSION } = await __jiti.import("../src/lib/preset-portability");
const { writeUserParamPresets } = await __jiti.import("../src/lib/user-param-presets");
import { readFileSync } from "node:fs";

const NOW = 1_760_000_000_000;
const mk = (id, type, name, params, createdAt = NOW) => ({ id, type, name, params, createdAt });

// ---------- A: the export law ----------
console.log("A export:");
const shelfA = [mk("upp-1-abcde", "ctffind", "My standard pass", { box: 256, resMax: 8 }, NOW)];
const payload = JSON.parse(exportShelfPayload(shelfA));
must(payload.kind === "cryoflow-user-param-presets" && payload.kind === PRESET_PAYLOAD_KIND,
  "A1 the file states its kind (a foreign .json is refused by identity, not by guessing)");
must(payload.version === 1 && payload.version === PRESET_PAYLOAD_VERSION,
  "A2 the file states its version (future shape changes refuse with a reason)");
must(Number.isFinite(payload.exportedAt), "A3 the file carries its export time");
must(JSON.stringify(payload.presets) === JSON.stringify(shelfA),
  "A4 presets ride the lib's EXACT wire shape (the same dialect the t715 PUT speaks)");
must(JSON.parse(exportShelfPayload([])).presets.length === 0,
  "A5 an empty shelf exports an honest empty file (the export button hides at zero, the law stays total)");
must(/^cryoflow-param-presets-\d{4}-\d{2}-\d{2}\.json$/.test(exportShelfFilename(new Date(NOW))),
  "A6 the filename is date-stamped (a downloads folder of preset files stays readable)", exportShelfFilename(new Date(NOW)));

// ---------- B: the import laws ----------
console.log("B import:");
const base = [mk("upp-1-abcde", "ctffind", "My standard pass", { box: 256 })];

const goodFile = (presets, kind = PRESET_PAYLOAD_KIND, version = PRESET_PAYLOAD_VERSION) =>
  JSON.stringify({ kind, version, exportedAt: NOW, presets });

const r1 = importShelfPayload(
  goodFile([mk("upp-9-aaaaa", "class2d", "Sharp classes", { K: 50 }), mk("upp-8-bbbbb", "refine3d", "Tight mask", { ini: 20 })]),
  base, { now: NOW }
);
must(r1.ok && r1.added.length === 2 && r1.shelf.length === 3,
  "B1 a clean file adds its entries onto the shelf");
must(r1.shelf[0].id === "upp-1-abcde" && r1.shelf[1].id === "upp-9-aaaaa",
  "B2 existing first, imports after (the merge never reorders what is already there)");
must(r1.duplicates === 0 && r1.invalid === 0 && r1.overflow === 0,
  "B3 a clean receipt counts nothing skipped");

must(importShelfPayload(goodFile([]), base, { now: NOW }).ok, "B4 a well-shaped empty file imports (nothing lands)");
must(!importShelfPayload("{not json", base, { now: NOW }).ok &&
     importShelfPayload("{not json", base, { now: NOW }).reason === "unreadable",
  "B5 unreadable JSON refused with a reason");
must(importShelfPayload("[]", base, { now: NOW }).reason === "shape", "B6 a top-level array is not a presets file");
must(importShelfPayload(JSON.stringify({ kind: "package-lock", version: 1, presets: [] }), base, { now: NOW }).reason === "kind",
  "B7 a foreign kind is refused BEFORE any entry is read (identity first)");
must(importShelfPayload(goodFile([], PRESET_PAYLOAD_KIND, 99), base, { now: NOW }).reason === "version",
  "B8 a future version refuses with its own reason (never mis-read)");

const mixed = importShelfPayload(
  goodFile([
    mk("upp-7-ccccc", "class2d", "Good one", { K: 50 }),                       // lands
    { bad: true },                                                             // refused (no name/type/params)
    mk("upp-6-ddddd", "refine3d", "Broken params", { box: 256, extra: { nested: 1 } }), // survives: non-scalar VALUE is skipped, entry kept
    mk("upp-5-eeeee", "refine3d", "Too many keys", Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`k${i}`, i]))), // refused (65 keys)
  ]),
  base, { now: NOW }
);
must(mixed.ok && mixed.added.length === 2 && mixed.invalid === 2,
  "B9 the server door speaks again entry-by-entry — refusals counted, good neighbours live (skip-not-sink)");
must(!("extra" in mixed.added.find((p) => p.name === "Broken params").params),
  "B10 a non-scalar knob is dropped but its entry survives (mirrors the client's snapshot law)");

const twinShelf = [mk("upp-1-abcde", "ctffind", "My standard pass", { box: 256, resMax: 8 }, 111)];
const rTwin = importShelfPayload(
  goodFile([mk("upp-2-reimported", "ctffind", "My standard pass", { resMax: 8, box: 256 }, 999)]), // reordered params, different createdAt
  twinShelf, { now: NOW }
);
must(rTwin.duplicates === 1 && rTwin.added.length === 0,
  "B11 an exact twin is skipped — key-order-insensitive, createdAt-free (the same tuning from another machine IS the twin)");

const rInternal = importShelfPayload(
  goodFile([mk("a", "class2d", "Twin", { K: 1 }), mk("b", "class2d", "Twin", { K: 1 })]),
  [], { now: NOW }
);
must(rInternal.added.length === 1 && rInternal.duplicates === 1,
  "B12 twins WITHIN one file die too (the twin test reads the shelf-so-far)");

const rCollide = importShelfPayload(
  goodFile([mk("upp-1-abcde", "ctffind", "Same id, different tuning", { box: 512 })]),
  base, { now: NOW }
);
must(rCollide.added.length === 1 && rCollide.added[0].id !== "upp-1-abcde" && rCollide.added[0].id.startsWith("upp-"),
  "B13 a taken id re-mints (identity is internal; the name is the face)");
must(rCollide.shelf.find((p) => p.id === "upp-1-abcde").name === "My standard pass",
  "B14 the shelf's original is untouched by the collision (import never overwrites)");

const free = importShelfPayload(goodFile([mk("upp-free-1", "ctffind", "Kept id", { box: 1 })]), [], { now: NOW });
must(free.added[0].id === "upp-free-1", "B15 a free id is preserved (provenance survives import)");

const full = Array.from({ length: 48 }, (_, i) => mk(`upp-full-${i}`, "ctffind", `P${i}`, { box: i }));
const rFull = importShelfPayload(goodFile([mk("x", "ctffind", "One more", { box: 1 })]), full, { now: NOW });
must(rFull.added.length === 0 && rFull.overflow === 1 && rFull.shelf.length === 48,
  "B16 a full shelf receives nothing and SAYS so (overflow is a receipt line, not a silent drop)");
const near = Array.from({ length: 47 }, (_, i) => mk(`upp-near-${i}`, "ctffind", `P${i}`, { box: i }));
const rNear = importShelfPayload(goodFile([mk("x1", "ctffind", "Lands", { box: 1 }), mk("x2", "ctffind", "Falls", { box: 2 })]), near, { now: NOW });
must(rNear.added.length === 1 && rNear.overflow === 1 && rNear.shelf.length === 48,
  "B17 the cap counts per-entry — one lands, one falls, both told");
must(rFull.shelf.every((p) => full.some((o) => o.id === p.id)),
  "B18 import never deletes (an oversized existing shelf just receives nothing)");

// ---------- C: purity + the single write well ----------
console.log("C purity & write well:");
const portSrc = readFileSync("src/lib/preset-portability.ts", "utf8");
const libSrc = readFileSync("src/lib/user-param-presets.ts", "utf8");
const shelfSrc = readFileSync("src/components/workflow/user-preset-shelf.tsx", "utf8");

must(!portSrc.includes("localStorage") && !portSrc.includes("window.") && !portSrc.includes("fetch("),
  "C1 portability is PURE — no storage, no window, no fetch (the component composes, the lib writes)");
must(libSrc.includes("export function writeUserParamPresets(list: UserParamPreset[]): UserParamPreset[] {\n  persist(list);"),
  "C2 writeUserParamPresets is the ONE public bulk write and it rides persist (localStorage + t715 PUT + changed event)");
must(shelfSrc.includes("importShelfPayload(text, loadUserParamPresets())") && shelfSrc.includes("writeUserParamPresets(pendingReceipt.shelf)"),
  "C3 the component composes door + write well — no second storage path");
must(shelfSrc.includes("downloadText(exportShelfFilename(), exportShelfPayload(presets)") &&
     !shelfSrc.includes('createElement("a")'),
  "C4 export rides downloadText (t191: whatever two consumers derive, a third forks — no hand-danced anchors)");
must(portSrc.includes('from "@/lib/param-preset-sanitize"') && portSrc.includes("sanitizePresetEntry"),
  "C5 the import door IS the server's sanitize (file path and API path cannot drift)");
must(portSrc.includes("MAX_PRESETS") && !/const MAX_PRESETS/.test(portSrc),
  "C6 the cap is single-sourced from the sanitize module (two caps would eventually disagree)");

// ---------- D: the dialog's census ----------
console.log("D dialog:");
must(shelfSrc.includes('data-testid="preset-shelf-export"') && shelfSrc.includes('data-testid="preset-import-open"'),
  "D1 both carry verbs speak by name in the header (t686 anchor law)");
must(/!\s*isEmpty \? \(/.test(shelfSrc) || shelfSrc.includes("{!isEmpty ? ("),
  "D2 export is hidden at zero (an empty file is not a feature; import must stay reachable)");
must(shelfSrc.includes('data-testid="preset-import-empty-door"'),
  "D3 the empty shelf is a DOOR — the zero state's one live action has a testid");
must(shelfSrc.includes('data-testid="preset-import-file"') && shelfSrc.includes('accept=".json,application/json"'),
  "D4 the file input is real and .json-courteous (the kind header does the real checking)");
must(shelfSrc.includes('data-testid="preset-import-preview"') && shelfSrc.includes('data-testid="preset-import-apply"') &&
     shelfSrc.includes('data-testid="preset-import-receipt"') && shelfSrc.includes('data-testid="preset-import-close"'),
  "D5 the three phases speak by name: preview → apply → receipt → close");
must(["unreadable", "shape", "kind", "version"].every((k) => shelfSrc.includes(`${k}:`)),
  "D6 every refusal reason is humanized (a refused file never fails silently)");
must(shelfSrc.includes("already on your shelf") && shelfSrc.includes("past the 48-shelf cap") && shelfSrc.includes("refused (bad entries)"),
  "D7 every nonzero receipt clause is spoken (what happened to my file is never a guess)");
must(shelfSrc.includes("it never\n              overwrites or deletes"),
  "D8 the dialog states what import does NOT do (the delete-confirm's honesty dialect, mirrored)");
must(shelfSrc.includes("disabled={pendingReceipt.added.length === 0}"),
  "D9 apply is disabled when nothing would land (the 1-60 law: the disable, not the late error)");
must((shelfSrc.match(/motion-reduce:transition-none/g) ?? []).length >= 8,
  "D10 motion-reduce discipline held through the new dialog (qa49's law)", `${(shelfSrc.match(/motion-reduce:transition-none/g) ?? []).length} uses`);

// ---------- verdict ----------
console.log(`\n${PASS} pass / ${FAIL} fail`);
process.exit(FAIL > 0 ? 1 : 0);
