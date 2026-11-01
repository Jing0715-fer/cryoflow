#!/usr/bin/env node
/**
 * t1139 — THE TRANSITION INSPECTOR + THE LEDGER'S DOWNLOAD DOOR unit.
 *
 * The t1139 window's feature: the world health board's timeline learns
 * to SPEAK ITS STEPS, and the ledger learns to TRAVEL.
 *
 *   • the transition's words  — transitionWords(prev, cur): only the
 *     MOVERS speak, in the vitals' speaking order, signed (+ arrived /
 *     − left, the typographic minus); the ledger's first world
 *     introduces itself instead of lying about a delta that never
 *     happened; a world that moved only in time says "no visible
 *     change" — the honest guard, never an empty string.
 *   • the keyboard mirror     — the strip takes focus (the t1138
 *     mirror's sixth application): the first arrow lands on the NEWEST
 *     transition (the walk-current law's "you are here"), ← walks
 *     older, → walks newer, Home/End jump, Escape leaves. The gate is
 *     the family's gatekeeper (no ctrl/meta/alt — t908's B7); every
 *     handled key preventDefaults (the B5 law); unhandled keys return
 *     bare; the wire is ELEMENT-level (no raw window keydown — the C1
 *     law); the label teaches EXACTLY the answered keys (the
 *     must-not-lie law).
 *   • ONE readout, two hands  — hover (pointer, momentary) and walk
 *     (keyboard, sticky) both drive ONE aria-live="polite" readout; a
 *     second readout would be a second truth.
 *   • the download door       — the SAME versioned envelope the tab's
 *     memory writes (one father: the export file IS a restorable
 *     memory), the family's stamp grammar (the funnel ledger's ISO
 *     stamp, the cryoflow- prefix), through the ONE download father
 *     (the t191 law — never re-derive the anchor dance). The chip
 *     exists only when the ledger has a story (the honest-empty law).
 *   • the read-side clamp     — the ledger only grows (and slides at
 *     the cap); the clamp is a READ guard, never a render-time state
 *     write (the #13 law).
 *
 * The unit RUNS the lib's pure functions and PINS the dialog's source
 * (the verbs are React handlers — the browser ride belongs to the
 * standing census's live lanes when a build day opens). The family's
 * laws are pinned untouched beside it.
 *
 * node scripts/unit-runner.mjs scripts/t1139-world-ledger-inspector-unit.mjs
 */
import { readFileSync } from "node:fs";
import {
  readWorldLedgerStorage,
  transitionWords,
  worldLedgerFilename,
  worldLedgerJson,
  writeWorldLedgerStorage,
  WORLD_LEDGER_STORAGE_VERSION,
} from "../src/lib/world-vitals.ts";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const dlg = readFileSync("src/components/workflow/world-health-dialog.tsx", "utf8");
const lib = readFileSync("src/lib/world-vitals.ts", "utf8");

/* ---------- A band — the transition's words (the lib runs) ---------- */
console.log("A band — the transition's words:");
const w0 = { t: 1000, jobs: 15, edges: 14, running: 0, completed: 15, failed: 0 };

ok("A1 the first world introduces itself (no fake delta)",
  transitionWords(null, w0) === "the ledger's first world: 15 jobs · 14 edges",
  JSON.stringify(transitionWords(null, w0)));
ok("A2 the first world's singular rides the count",
  transitionWords(null, { ...w0, jobs: 1, edges: 1 }) === "the ledger's first world: 1 job · 1 edge");

const prev = { t: 2000, jobs: 15, edges: 14, running: 2, completed: 13, failed: 0 };
const cur = { t: 3000, jobs: 16, edges: 14, running: 1, completed: 15, failed: 0 };
ok("A3 only the MOVERS speak (the silent fields stay silent)",
  transitionWords(prev, cur) === "+1 job · −1 running · +2 completed",
  JSON.stringify(transitionWords(prev, cur)));

ok("A4 the minus sign is the typographic − (U+2212), both directions",
  transitionWords(cur, prev) === "−1 job · +1 running · −2 completed" &&
  transitionWords(prev, { ...prev, running: 0 }) === "−2 running",
  JSON.stringify(transitionWords(cur, prev)));

ok("A5 singular/plural rides the magnitude",
  transitionWords(prev, { ...prev, jobs: 18 }) === "+3 jobs" &&
  transitionWords(prev, { ...prev, edges: 13 }) === "−1 edge",
  transitionWords(prev, { ...prev, jobs: 18 }));

ok("A6 the five fields speak in the vitals' order (jobs, edges, running, completed, failed)",
  transitionWords(prev, { t: 4000, jobs: 20, edges: 20, running: 9, completed: 10, failed: 1 }) ===
    "+5 jobs · +6 edges · +7 running · −3 completed · +1 failed",
  transitionWords(prev, { t: 4000, jobs: 20, edges: 20, running: 9, completed: 10, failed: 1 }));

ok("A7 a world that moved only in time says so (never an empty string)",
  transitionWords(prev, { ...prev, t: 9999 }) === "no visible change");

ok("A8 the words ride ONE father (the delta pattern lives in the lib alone)",
  lib.includes('words.push(`${d > 0 ? "+" : "−"}${n} ${n === 1 ? f.one : f.many}`);') &&
  !dlg.includes('d > 0 ? "+" : "−"'),
  "the dialog re-derives nothing");

/* ---------- B band — the download door (the lib runs) ---------- */
console.log("B band — the ledger's download door:");
ok("B1 the filename rides the family's stamp grammar (the funnel ledger's own ISO shape, the T included)",
  worldLedgerFilename(new Date("2026-11-02T06:20:27Z")) === "cryoflow-world-ledger-2026-11-02T06-20-27.json",
  worldLedgerFilename(new Date("2026-11-02T06:20:27Z")));
const shape = worldLedgerFilename();
ok("B2 the no-arg stamp rides now (the shape holds)",
  shape.startsWith("cryoflow-world-ledger-") && shape.endsWith(".json") && shape.length === "cryoflow-world-ledger-2026-11-02-06-20-27.json".length);

const rows = [
  { t: 1000, jobs: 15, edges: 14, running: 0, completed: 15, failed: 0 },
  { t: 2000, jobs: 16, edges: 14, running: 1, completed: 15, failed: 0 },
];
ok("B3 the body is EXACTLY the storage envelope (v1, rows, 2-space)",
  worldLedgerJson(rows) === JSON.stringify({ v: WORLD_LEDGER_STORAGE_VERSION, rows }, null, 2));

// B4 — the one-father proof made live: the export file IS a restorable
// memory. A fake store holding the EXPORT's string restores the SAME
// rows through the storage reader — one reader for both contracts.
class FakeStore {
  constructor(raw) { this.raw = raw; }
  getItem() { return this.raw; }
}
const restored = readWorldLedgerStorage(new FakeStore(worldLedgerJson(rows)));
ok("B4 the export file restores through the storage reader (one father, live)",
  JSON.stringify(restored) === JSON.stringify(rows),
  `${restored.length} rows round-tripped`);

const restoredEmpty = readWorldLedgerStorage(new FakeStore(worldLedgerJson([])));
ok("B5 the empty ledger exports an honest absence (and restores as one)",
  worldLedgerJson([]) === '{\n  "v": 1,\n  "rows": []\n}' && restoredEmpty.length === 0);

// B6 — the envelope's ONE SHAPE: the storage write and the export body
// parse to the SAME envelope (the formatting is each door's own face —
// the reader parses, the whitespace is not a contract).
const sink = { payload: null, setItem(_k, v) { this.payload = v; } };
writeWorldLedgerStorage(sink, rows);
ok("B6 the storage write and the export body carry the SAME envelope",
  JSON.stringify(JSON.parse(sink.payload)) === JSON.stringify(JSON.parse(worldLedgerJson(rows))),
  "shape-equal, each door keeps its own face");

/* ---------- C band — the strip's keyboard mirror (source pins) ---------- */
console.log("C band — the strip's keyboard mirror:");
ok("C1 the strip takes focus (group + tabIndex, the t1138 mirror's shape)",
  dlg.includes('data-testid="world-health-timeline-group"') &&
  dlg.includes('role="group"') && dlg.includes("tabIndex={0}"));

const label = (dlg.match(/aria-label="(The transition strip[^"]*)"/) ?? [])[1] ?? "";
ok("C2 the label teaches EXACTLY the answered keys (the must-not-lie law)",
  label.includes("arrow keys") && label.includes("Home") && label.includes("End") && label.includes("Escape") &&
  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Escape"].every((k) => dlg.includes(`case "${k}"`)),
  label.slice(0, 60) + "…");

ok("C3 the wire is ELEMENT-level (no raw window keydown — the t908 C1 law by absence)",
  dlg.includes("onKeyDown={onTimelineKeyDown}") && !dlg.includes("window.addEventListener"));

ok("C4 the gatekeeper stands (no ctrl/meta/alt — the t908 B7 law)",
  dlg.includes("if (e.ctrlKey || e.metaKey || e.altKey) return;"));

ok("C5 handled keys preventDefault; unhandled return bare (the B5 law's twin)",
  /default:\s*\n\s*return; \/\/ unhandled keys stay bare/.test(dlg) &&
  dlg.includes("e.preventDefault();\n    setWalkIdx(next);"));

ok("C6 the first arrow lands on the NEWEST transition (the walk-current law)",
  (dlg.match(/activeIdx == null \? n - 1/g) ?? []).length === 2,
  "both directions enter at the newest");

ok("C7 the readout speaks politely (aria-live — the value reaches the ear)",
  dlg.includes('data-testid="world-health-transition-readout"') &&
  dlg.includes('aria-live="polite"'));

ok("C8 ONE readout (a second would be a second truth)",
  (dlg.match(/world-health-transition-readout/g) ?? []).length === 1);

ok("C9 both hands, one readout (hover wins while present, walk carries the sticky step)",
  /hoverIdx != null && hoverIdx < history\.length\s*\?\s*hoverIdx\s*:\s*walkIdx != null && walkIdx < history\.length/.test(dlg.replace(/\n\s*/g, " ").replace(/\s+/g, " ")) ||
  /hoverIdx != null && hoverIdx < history.length/.test(dlg));

ok("C10 the hover mirror rides the pointer's own channel (enter on bars, leave on the wrapper)",
  dlg.includes("onPointerEnter={() => setHoverIdx(i)}") &&
  dlg.includes("onPointerLeave={() => setHoverIdx(null)}"));

ok("C11 the marker never eats the hover (pointerEvents none) and carries its own face",
  dlg.includes('data-testid="world-health-timeline-marker"') && dlg.includes('pointerEvents="none"'));

ok("C12 the idle faces are honest words, verbatim",
  dlg.includes("focus the strip and walk with ← → — each step speaks what moved; hover reads the same words") &&
  dlg.includes("one world in the ledger — a second makes a transition to walk") &&
  dlg.includes("reading the world…"));

ok("C13 the walk retires with its dialog (the ghost-hand law)",
  /setCopyFace\("idle"\);\s*\n\s*setWalkIdx\(null\);\s*\n\s*setHoverIdx\(null\);/.test(dlg));

ok("C14 the read-side clamp guards the cap-slide; the walk never writes in render",
  (dlg.match(/< history\.length/g) ?? []).length >= 2 &&
  (dlg.match(/setWalkIdx\(/g) ?? []).length === 2,
  "setWalkIdx lives only in the handler and the retirement effect");

/* ---------- D band — the export chip + the family untouched ---------- */
console.log("D band — the export chip + the family:");
ok("D1 the door exists only when the ledger has a story (the honest-empty law)",
  /\{history\.length > 0 && \(\s*\n\s*<Button\s*\n\s*variant="outline"\s*\n\s*size="sm"\s*\n\s*data-testid="world-health-download"/.test(dlg));

ok("D2 zero disabled sites (the tally census untouched — conditional render, not a gate)",
  !dlg.includes("disabled={"));

ok("D3 the chip rides the shadcn Button base (the t1123 mint table)",
  /data-testid="world-health-download"[\s\S]{0,200}?variant="outline"/.test(dlg.replace(/\n/g, "\n")) ||
  (dlg.includes('data-testid="world-health-download"') && dlg.includes('variant="outline"')));

ok("D4 the ONE download father (the t191 law — no anchor dance re-derived)",
  dlg.includes('import { downloadText } from "@/lib/download"') && !dlg.includes("createObjectURL"));

ok("D5 the words ride the lib's imports (no local re-derivation)",
  ["\n  transitionWords,", "\n  worldLedgerFilename,", "\n  worldLedgerJson,", "\n  clockWordsOf,"].every((f) => dlg.includes(f)) &&
  dlg.includes('from "@/lib/world-vitals"'));

ok("D6 the copy breath untouched (the family's number, spoken once)",
  dlg.includes("const COPY_BREATH_MS = 1600;"));

ok("D7 the footer dialect untouched (the board counts what the footer counts)",
  dlg.includes("useActiveWorkspaceJobs()") && dlg.includes("useWorkflowStore((s) => s.edges)"));

// t1141 re-key — the restore reads the TWO tiers (readWorldLedgerTiers)
// and the persist writes THROUGH them (writeWorldLedgerTiers): the
// declaration order's shape held (restore before commit before persist),
// so the pin follows the family's face (the re-key named here, the same
// law the t1130/t1129 re-keys rode).
ok("D8 the restore/commit/persist order holds (declaration order IS the race law; t1141 the tiers' face)",
  dlg.indexOf("readWorldLedgerTiers(session, local)") < dlg.indexOf("appendWorldSnapshot(h,") &&
  dlg.indexOf("appendWorldSnapshot(h,") < dlg.indexOf("writeWorldLedgerTiers(session, local, history)") &&
  dlg.includes("restoredRef.current = true;"));

ok("D9 the t1133 faces untouched (the vitals' five words, the flat face, the rows)",
  dlg.includes('data-testid="world-health-vitals"') &&
  dlg.includes('data-testid="world-health-rows"') &&
  dlg.includes('data-testid="world-health-timeline-flat"') &&
  dlg.includes("no transitions yet — create a job, flip a status, or draw an edge and the"));

/* ---------- receipt ---------- */
console.log(`\nWORLD-LEDGER-INSPECTOR-UNIT t1139: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
