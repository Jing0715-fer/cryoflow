#!/usr/bin/env node
/**
 * t911 — the CANVAS STRIP unit: the zoom-controls strip's wrap seat and
 * the laws the narrow-canvas window taught.
 *
 * The window's finding: the strip is ~521px of tools; on a 320 viewport it
 * clipped its whole right tail inside the section's overflow-hidden —
 * Redo, History, Auto-arrange, Viewport bookmarks, unreachable, and the
 * middle two have NO keyboard path (undo/redo do: Ctrl+Z / Ctrl+Y in the
 * app shell). The seat is the house wrap law (the door keymap row's
 * flex-wrap, t909): max-width keeps the gutter, flex-wrap carries the tail
 * to a second row, bottom-3 grows the strip upward.
 *
 * The window's accidents, converted to law:
 *  - a fixed-coordinate pan leg landed on a card and DRAGGED it (the drag
 *    commits x/y via PATCH — the world changed under the rider); the
 *    restore door is the same PATCH, byte-exact. The E-arm pins the demo
 *    chain's pitch so any future stray drag fails loudly.
 *  - the minimap's 0×0 rect at narrow bands is DESIGN (hidden lg:block +
 *    the toggle max-lg:hidden), not death — pinned here so no future
 *    window "fixes" it back.
 *
 *   A1–A6  the wrap seat (the src change itself)
 *   B1–B4  the orphan verbs + the minimap pair + the clip-by-design
 *   C1–C3  the drag commit door (PATCH x/y — the restore law)
 *   D1–D3  the pan/zoom verbs (the reachability kit)
 *   E1–E3  the world truth via the API (finite positions; the chain pitch)
 *
 * Usage: node --import ./scripts/ts-alias-register.mjs scripts/t911-canvas-strip-unit.mjs
 * (dev server :3000 up for the E-arms; A–D are pure source asserts)
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = process.cwd();
const read = (p) => readFileSync(`${ROOT}/${p}`, "utf8");

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const canvas = read("src/components/workflow/canvas.tsx");
const shell = read("src/components/workflow/app-shell.tsx");
const store = read("src/lib/store.ts");
const patchRoute = read("src/app/api/jobs/[id]/route.ts");
const minimap = read("src/components/workflow/canvas-minimap.tsx");
const globals = read("src/app/globals.css");

/* A — the wrap seat */
const stripBlock = canvas.slice(canvas.indexOf('data-canvas-ui="zoom-controls"') - 400, canvas.indexOf('data-canvas-ui="zoom-controls"') + 200);
ok("A1 the strip carries flex-wrap (the tail's second row)", /flex\s+max-w-\[calc\(100%-1\.5rem\)\]\s+flex-wrap\s+items-center/.test(stripBlock), "flex max-w-[calc(100%-1.5rem)] flex-wrap");
ok("A2 the strip keeps a 12px gutter each side (left-3's own measure)", /max-w-\[calc\(100%-1\.5rem\)\]/.test(stripBlock));
ok("A3 the strip keeps the bottom-3 left-3 anchor (grows UPWARD)", /bottom-3 left-3/.test(stripBlock));
ok("A4 the strip keeps the z-30 card-lift overlay identity", /z-30/.test(stripBlock) && /card-lift/.test(stripBlock));
ok("A5 the seat's docblock names the clipped verbs (provenance at the seat)", /Redo, History, Auto-arrange, Viewport bookmarks/.test(canvas));
ok("A6 the house wrap dialect: calc without spaces matches the dialogs' calc(100vw-2rem) family", /calc\(100vw-2rem\)/.test(read("src/components/workflow/results/run-compare-dialog.tsx")));

/* B — wrap, not hide: the keyboard facts + the designed pairs */
ok("B1 undo/redo ride Ctrl+Z/Ctrl+Y in the app shell (the clipped tail's keyboard path)", /\(e\.ctrlKey \|\| e\.metaKey\) && \(k === "z" \|\| k === "Z"\)/.test(shell) && /e\.shiftKey\) void s\.redo\(\)/.test(shell) && /void s\.redo\(\)/.test(shell));
ok("B2 History has a strip button (aria-label) — wrap keeps it reachable, hide would orphan it", /aria-label="History"/.test(canvas));
ok("B3 Auto-arrange + Viewport bookmarks have strip buttons (the same wrap rationale)", /aria-label="Auto-arrange workflow"/.test(canvas) && /aria-label="Viewport bookmarks"/.test(canvas));
ok("B4 the minimap pair is designed responsive law (map hidden lg:block, toggle max-lg:hidden)", /hidden touch-none select-none rounded-lg border bg-card\/95 p-1\.5 backdrop-blur \[-webkit-touch-callout:none\] lg:block/.test(minimap) && /max-lg:hidden/.test(canvas));
ok("B4a the canvas-grid clips by design (the section's own overflow-hidden, the pan/zoom viewport semantics)", /canvas-grid relative min-w-0 flex-1 touch-none overflow-hidden/.test(canvas), "canvas.tsx:2610 owns the clip");

/* C — the drag commit door (the restore law) */
const mjc = store.slice(store.indexOf("moveJobCommit: async (id, x, y)"), store.indexOf("moveJobCommit: async (id, x, y)") + 1600);
ok("C1 a card drag PATCHes /api/jobs/[id] with {x, y} (the byte-exact restore door)", /method: "PATCH"/.test(mjc) && /JSON\.stringify\(\{ x, y \}\)/.test(mjc));
ok("C2 the PATCH route accepts x/y numbers (the route's body contract)", /x\?: unknown/.test(patchRoute) && /y\?: unknown/.test(patchRoute));
ok("C3 the optimistic drag holds positions against the poll (the t383 race guard)", /holdPositions\(\[id\]\)/.test(mjc) && /confirmPositions\(\[id\]\)/.test(mjc));

/* D — the reachability kit */
ok("D1 resetView = zoom 1 + content-bbox recenter (deterministic; observed tx=-240 == the formula at 320)", /setViewport\(\{ x: rect\.width \/ 2 - cx, y: rect\.height \/ 2 - cy, zoom: 1 \}\)/.test(canvas));
ok("D2 the pan gate: cards handle their own drag, overlays keep their events", /target\.closest\("\[data-job\]"\)\) return; \/\/ cards handle their own drag/.test(canvas) && /target\.closest\("\[data-canvas-ui\]"\)\) return; \/\/ overlays keep their events/.test(canvas));
ok("D3 the zoom verbs ride zoomAroundCenter(± ZOOM_STEP) with the ZOOM_MIN clamp", /zoomAroundCenter\(zoom - ZOOM_STEP\)/.test(canvas) && /zoomAroundCenter\(zoom \+ ZOOM_STEP\)/.test(canvas) && /disabled=\{zoom <= ZOOM_MIN\}/.test(canvas));

/* E — the world truth via the API (the t909 law: the API, never a bare client) */
try {
  const res = await fetch("http://localhost:3000/api/jobs", { headers: { Origin: "http://localhost:3000" } });
  const data = await res.json();
  const jobs = data.jobs || data;
  // t921 — the world-shape assert re-pinned to the SEED's own law: the
  // strip's geometry asserts (E2/E3) ride the seed trio (import →
  // motioncorr → ctffind), and a fresh re-seeded world carries exactly
  // those three — the old `>= 15` was the accumulated demo world's shape,
  // one snapshot's accident, not a law.
  ok("E1 the API answers with the world's jobs", Array.isArray(jobs) && jobs.length >= 3, `${jobs.length} jobs`);
  const finite = jobs.every((j) => Number.isFinite(j.x) && Number.isFinite(j.y));
  ok("E2 every job's x/y is a finite number (a drag commit cannot write NaN)", finite);
  const byType = (t) => jobs.find((j) => j.type === t);
  const imp = byType("import"), mc = byType("motioncorr"), ctf = byType("ctffind");
  const pitch1 = mc && imp ? Math.round((mc.x - imp.x) * 100) / 100 : NaN;
  const pitch2 = ctf && mc ? Math.round((ctf.x - mc.x) * 100) / 100 : NaN;
  ok("E3 the demo chain's pitch stands (import → motioncorr → ctffind, 264px, one row) — a stray drag breaks this loudly", pitch1 === 264 && pitch2 === 264 && imp.y === mc.y && mc.y === ctf.y, `x=${imp?.x}/${mc?.x}/${ctf?.x} y=${imp?.y}/${mc?.y}/${ctf?.y}`);
} catch (e) {
  fail++;
  console.log(`  ✗ E* the API leg threw: ${String(e.message).slice(0, 120)} (dev server up?)`);
}

const receipt = { instrument: "t911-canvas-strip-unit", pass, fail, at: new Date().toISOString() };
try {
  writeFileSync(`${ROOT}/shots-qa/t911-canvas-strip-unit.json`, JSON.stringify(receipt, null, 2));
} catch (e) {
  console.log(`  ✗ the receipt could not be written: ${e.message} — the proof IS the receipt, failing loudly`);
  fail++;
}
console.log(`\nCANVAS-STRIP-UNIT t911: ${pass}/${pass + fail} ${fail === 0 ? "green — the strip wraps, the doors hold" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
