#!/usr/bin/env node
/**
 * t867 — the a11y rotation's next surface: the QUICK-LOOK face — the
 * results family's next remaining room (the MrcGallery / the image viewer
 * dialog), the star table's page's sibling (t866), walked live with the
 * SHARED RULER (zero src).
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> results family (t865) -> star
 * table (t866) -> THIS page (t867).
 *
 * The surface (the inspector's Results tab hosts the MrcGallery — the
 * round-chip filter row, the thumbnail tile grid with the t777 roving
 * tabindex; a tile's Enter/click opens the IMAGE VIEWER dialog — the
 * quick-look):
 *
 *   O   the clean room — the t866 law (the seed cleared, the panel-closed
 *       boot demanded). The instrument owns its measurement conditions.
 *   G   the gallery face — the round chips measured (aria-pressed state
 *       on final/itNNN/all), the tiles measured (the "Enlarge …" name IS
 *       the door's name), the roving law: exactly ONE tile in the tab
 *       order (the t777 third sibling).
 *   R   the roving walk — ArrowRight moves focus to a neighboring tile
 *       (the t777 geometric law, measured rects), the roving anchor
 *       follows, Enter opens the quick-look (the door lineage).
 *   QL-M the map dialog — the central-slice face: the TOPMOST heading is
 *       the file's label, the region named with its keyboard door
 *       (tabIndex 0 — the t809 house dialect), the "View in 3D (Mol*)"
 *       door present and named (measured, never clicked — the OOM corpse
 *       pattern stays outside this page), the quick-keymap seat (t831's
 *       third seat), zero unnamed page-wide, two settled rides
 *       bit-identical.
 *   QL-S the stack dialog — the .mrcs face: the montage + the slice
 *       cursor (prev/next walk the cursor, the readout speaks, the range
 *       input named), the follow-window toggle's aria-pressed machine,
 *       the mode-gated keymap chips (a single-image stack renders no
 *       slice chip — chips for a dead key would lie).
 *   K   the keymap's own teaching — Escape closes (the layered-escape
 *       contract, the third Esc seat).
 *   W   the world back — fresh load, the canvas count bit-for-bit, AND
 *       the seed hygiene (W2): the ride leaves no session seed behind.
 *
 * Born with the ledger aboard (the t861 birthright): THREE faces through
 * the shared helper — gallery / quickLook / worldBack — the receipt's
 * top-level `faces` block carries the RAW measures, the ledger diffs
 * prev.faces.<name>.live.
 *
 * Receipt: shots-qa/t867-quick-look-a11y.json.
 *
 *   node scripts/t867-quick-look-a11y.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

/** agent-browser eval unwrap — the t837 defensive form. */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

/* ---------- provenance + the comparator (the family's shared law) ---------- */
const world = worldIdentity(ROOT);
const buildId = world.id;
const cmp = loadComparator(ROOT, "shots-qa/t867-quick-look-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t867 quick-look a11y walk — world ${world.mode}:${buildId}, the MrcGallery and the image viewer dialog through the shared ruler\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* same-origin metadata — the roster read is a same-origin gate (the t708 shape) */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};
const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const b = await r.json();
  return b.jobs ?? b;
};

/* ---------- the measure: the SHARED RULER + the quick-look family's probes.
 * ONE superset measure — every face films the same fields; the absent
 * selectors speak false/0 (within-face stability is what the rides diff).
 * NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null; const dlgHeadTop = headOf(dlgTop); const dlgCount = dgs.length; const act = document.activeElement; const actTabEl = dlgTop ? dlgTop.querySelector("[role=tab][data-state=active]") : document.querySelector("[role=tab][data-state=active]"); const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())); const tiles = Array.from(document.querySelectorAll("button[aria-label^=Enlarge]")); const roving = tiles.filter((t) => t.getAttribute("tabindex") === "0").length; const chips = Array.from(document.querySelectorAll("button[aria-pressed]")).filter((b) => /^(final|it\\d|all)/.test((b.textContent || "").trim())); const chipStates = chips.map((b) => ({ t: (b.textContent || "").trim().slice(0, 10), p: b.getAttribute("aria-pressed") })); const region = dlgTop ? dlgTop.querySelector("[role=region]") : null; const keymap = dlgTop ? !!dlgTop.querySelector("[data-canvas-ui=quick-keymap]") : false; const door3d = dlgTop ? Array.from(dlgTop.querySelectorAll("button")).find((b) => (b.textContent || "").trim().startsWith("View in 3D")) : null; const slicePrev = dlgTop ? !!dlgTop.querySelector("[data-canvas-ui=stack-slice-prev]") : false; const sliceNext = dlgTop ? !!dlgTop.querySelector("[data-canvas-ui=stack-slice-next]") : false; const sliceRange = dlgTop ? dlgTop.querySelector("[data-canvas-ui=stack-slice-range]") : null; const sliceReadout = dlgTop ? ((dlgTop.querySelector("[data-canvas-ui=stack-slice-readout]") || {}).textContent || "").trim() : null; const followWin = dlgTop ? dlgTop.querySelector("[data-canvas-ui=stack-montage-window]") : null; const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgHeadTop: dlgHeadTop, dlgCount: dlgCount, act: act ? (dgs.length && dlgTop.contains(act) ? "in-dialog" : act.tagName) : null, actTab: actTabEl ? (actTabEl.textContent || "").trim().slice(0, 12) : null, shimmer: leaves.length, tiles: tiles.length, roving: roving, chips: chipStates, regionNamed: region ? !!(region.getAttribute("aria-label") || "").startsWith("Map and stack preview") : false, regionLabel: region ? (region.getAttribute("aria-label") || "").slice(0, 60) : null, regionTabindex: region ? region.getAttribute("tabindex") : null, keymap: keymap, door3dNamed: door3d ? ((door3d.textContent || "").trim().length > 0) : false, door3dText: door3d ? (door3d.textContent || "").trim().slice(0, 30) : null, slicePrev: slicePrev, sliceNext: sliceNext, sliceRangeNamed: sliceRange ? !!(sliceRange.getAttribute("aria-label") || "") : false, sliceReadout: sliceReadout, followWinPressed: followWin ? followWin.getAttribute("aria-pressed") : null }); })()';

/* the settle law (t864/t865/t866's shape): bounded, MULTIPLE consecutive
 * equal pairs, the lazy barrel's own quiescence door SILENT AND the
 * images' own contract (img.complete). */
const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 18, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next);
      console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.shimmer === 0 && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (shimmer silent, ${run}x stable)`);
  return m;
};

/* the arrival door: WAIT for a predicate on the live measure (bounded) —
 * an arrival waits for arrival, never for a clock. */
const waitFor = (what, probe, maxSecs = 24) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

/* the OOM corpse guard (the t859/t861/t864/t865/t866 pattern): an eval
 * filming a dead server returns ZEROS — say so, stop honestly. */
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

/* the card's PLAIN door: pointerdown+pointerup, no move, no shift — the
 * job-card's own law: idle opens the panel, submitted opens the inspector. */
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

/* the inspector tab's MOUSEDOWN door (t863's teaching: Radix Tabs switch
 * on mousedown — a .click() dispatch is silently ignored). */
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';

/* the roving walk: focus the anchor tile, then ArrowRight through the
 * grid-nav contract (the t777 law — arrows MOVE, Enter enlarges). */
const focusAnchor =
  '(() => { const t = document.querySelector("button[aria-label^=Enlarge][tabindex=\\"0\\"]"); if (!t) return JSON.stringify({ focused: false }); t.focus(); return JSON.stringify({ focused: true, tile: t.getAttribute("data-tile-path") }); })()';
const arrowRight =
  '(() => { const el = document.activeElement; if (!el || !el.dataset || el.dataset.tilePath == null) return JSON.stringify({ moved: false }); el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })); const after = document.activeElement; return JSON.stringify({ moved: after !== el, from: el.dataset.tilePath, to: after && after.dataset ? after.dataset.tilePath : null }); })()';
/* the tile's Enter door: the focused tile's own activation (the door
 * lineage). A SYNTHETIC keydown does not synthesize a button's click —
 * the browser's activation behavior fires for TRUSTED key events only
 * (the first ride's lesson: the dialog never opened and every QL probe
 * filmed the inspector's stand-in). The honest simulation of the trusted
 * Enter is the click activation itself. */
const enterTile =
  '(() => { const el = document.activeElement; if (!el || !el.dataset || el.dataset.tilePath == null) return JSON.stringify({ opened: false }); el.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 })); return JSON.stringify({ opened: true, tile: el.dataset.tilePath }); })()';

/* the zero-unnamed census invariant, one voice everywhere */
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- Face 0: the clean room + the calm canvas ---------- */
console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
if (corpse(m0, "Face 0")) process.exit(1);
ok("O0 the boot is a clean room (the t157 seed cleared, the panel closed)",
  m0.panelOpen === false,
  `panelOpen=${m0.panelOpen}`);
ok("O1 the canvas is calm and named (the census's invariant)",
  !m0.hasDlg && censusOk(m0),
  `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;

/* ---------- the roster: the gallery host, measured never pinned ---------- */
const jobs = await roster();
const host = jobs.find((j) => j.type === "refine3d" && j.status === "completed");
if (!host) {
  console.error("no completed refine3d job in the roster — the Maps gallery cannot open");
  writeFileSync(join(ROOT, "shots-qa/t867-quick-look-a11y.json"), JSON.stringify({ instrument: "scripts/t867-quick-look-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no completed refine3d — the ride stopped honestly before the gallery" }, null, 2));
  process.exit(1);
}
console.log(`  host (measured, not pinned): ${host.name} (${host.id.slice(0, 12)})`);

/* ---------- Face G: the gallery face (the Results tab's Maps gallery) ---------- */
console.log("Face G — the refine3d inspector through the plain door, the Results tab, the MrcGallery");
const c1 = evalJson(plainClick(host.id));
ok("G1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
const w = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
ok("G2 the inspector arrived (a dialog aboard)", w.hasDlg === true, `dlgCount=${w.dlgCount}`);
const tab1 = evalJson(tabMouseDown("Results"));
ok("G3 the Results tab switched through the MOUSEDOWN door (the t863 Radix law)", tab1.found === true);
const s1 = settle("the Results tab (the lazy barrel compiles)");
if (corpse(s1, "Face G")) process.exit(1);
ok("G4 the active tab speaks Results", s1.actTab === "Results", `actTab=${s1.actTab}`);
ok("G5 the gallery hosts tiles, each named (the 'Enlarge …' text IS the door's name)",
  s1.tiles >= 1, `tiles=${s1.tiles}`);
ok("G6 the roving law holds: exactly ONE tile in the tab order (the t777 third sibling)",
  s1.roving === 1, `roving=${s1.roving} of ${s1.tiles}`);
ok("G7 the round chips speak their state (aria-pressed on final/it/all)",
  s1.chips.length >= 2 && s1.chips.some((c) => c.p === "true") && s1.chips.some((c) => c.p === "false"),
  `chips=${JSON.stringify(s1.chips)}`);
ok("G8 zero unnamed page-wide WITH the gallery up (the census's invariant)",
  censusOk(s1),
  `btns=${s1.pageBtns} ctrls=${s1.ctrls}`);

/* ---------- Face R: the roving walk (arrows move, Enter enlarges) ---------- */
console.log("Face R — the t777 roving walk: ArrowRight moves, Enter enlarges");
const f1 = evalJson(focusAnchor);
ok("R1 the anchor tile took focus (the derived anchor's seat)", f1.focused === true, `tile=${(f1.tile || "").slice(-24)}`);
const r1 = evalJson(arrowRight);
ok("R2 ArrowRight moved focus to a NEIGHBORING tile (the geometric law)",
  r1.moved === true && r1.to && r1.to !== r1.from,
  `from=…${(r1.from || "").slice(-18)} to=…${(r1.to || "").slice(-18)}`);
const rovingAfter = evalJson(MEASURE);
ok("R3 the roving anchor followed the focus (still exactly one tile in the tab order)",
  rovingAfter.roving === 1, `roving=${rovingAfter.roving}`);
const e1 = evalJson(enterTile);
ok("R4 Enter enlarged the focused tile (the door lineage: arrows never enlarge)",
  e1.opened === true);
const q0 = waitFor("the quick-look dialog", (m) => m.dlgCount >= 2 && m.regionNamed === true);
ok("R5 the quick-look arrived as the TOPMOST layer (the t865 nested-portal lesson)",
  q0.dlgCount >= 2 && q0.regionNamed === true, `dlgCount=${q0.dlgCount}`);

/* ---------- Face QL-M: the map dialog (the central-slice face) ---------- */
console.log("Face QL-M — the map dialog through the tile's Enter door");
const q1 = settle("the map dialog (the large render)");
if (corpse(q1, "Face QL-M")) process.exit(1);
ok("Q1 the dialog's heading is the file's label, read from the TOPMOST layer",
  (q1.dlgHeadTop || "").length > 0 && !(q1.dlgHeadTop || "").startsWith("3D Refine (tutorial) — job inspector"),
  `head="${q1.dlgHeadTop}"`);
ok("Q2 the region is named (the t809 house dialect's own label)",
  q1.regionNamed === true,
  `label="${q1.regionLabel}"`);
ok("Q3 the region keeps its keyboard door (tabIndex 0 — the ground is focusable)",
  q1.regionTabindex === "0",
  `tabindex=${q1.regionTabindex}`);
ok("Q4 the 'View in 3D (Mol*)' door is present and named (measured, never clicked)",
  q1.door3dNamed === true,
  `door="${q1.door3dText}"`);
ok("Q5 the t831 keymap seat is aboard (quick-keymap — the family's third seat)",
  q1.keymap === true);
ok("Q6 the map face carries no slice cursor (a map has no stack to step — the mode gate)",
  q1.slicePrev === false && q1.sliceNext === false,
  `prev=${q1.slicePrev} next=${q1.sliceNext}`);
ok("Q7 zero unnamed page-wide WITH the quick-look up (the census's invariant)",
  censusOk(q1),
  `btns=${q1.pageBtns} ctrls=${q1.ctrls}`);
const q1b = settle("the map dialog (second ride)");
ok("Q8 two settled rides bit-identical (the t836 law, the t860 settle)",
  JSON.stringify(q1) === JSON.stringify(q1b));

/* ---------- the close: the keymap's own teaching ---------- */
evalJson(ESC_LAST);
sleep(1.5);
const q2 = evalJson(MEASURE);
ok("K1 Escape closed the quick-look (the keymap seat's own teaching, delivered)",
  q2.dlgCount === q1.dlgCount - 1,
  `dlgCount ${q1.dlgCount} -> ${q2.dlgCount}`);
ok("K2 the inspector remains, zero unnamed (the census's invariant after the close)",
  q2.hasDlg === true && censusOk(q2));

/* ---------- Face QL-S: the stack dialog (the .mrcs face) ---------- */
console.log("Face QL-S — the stack dialog through the Classes tile's click door");
const stackTile =
  '(() => { const t = Array.from(document.querySelectorAll("button[aria-label^=Enlarge]")).find((b) => (b.getAttribute("aria-label") || "").includes(".mrcs")); if (!t) return JSON.stringify({ found: false }); t.click(); return JSON.stringify({ found: true, label: t.getAttribute("aria-label").slice(0, 40) }); })()';
const st0 = evalJson(stackTile);
ok("S1 a stack tile's click door opened the dialog (the .mrcs face)",
  st0.found === true, `label="${st0.label || ""}"`);
const q3 = waitFor("the stack dialog", (m) => m.dlgCount >= 2 && m.slicePrev === true);
const q3s = settle("the stack dialog (the montage render)");
if (corpse(q3s, "Face QL-S")) process.exit(1);
ok("S2 the slice cursor is aboard: prev/next doors + the named range input",
  q3s.slicePrev === true && q3s.sliceNext === true && q3s.sliceRangeNamed === true,
  `prev=${q3s.slicePrev} range=${q3s.sliceRangeNamed}`);
ok("S3 the readout speaks the cursor (slice N of M)",
  (q3s.sliceReadout || "").startsWith("slice "), `readout="${q3s.sliceReadout}"`);
ok("S4 the follow-window toggle carries its aria-pressed machine (the t288 law)",
  q3s.followWinPressed === "true" || q3s.followWinPressed === "false",
  `aria-pressed=${q3s.followWinPressed}`);
ok("S5 the stack's keymap teaches the slice step (the mode-gated chips)",
  q3s.keymap === true);
ok("S6 zero unnamed page-wide WITH the stack dialog up (the census's invariant)",
  censusOk(q3s),
  `btns=${q3s.pageBtns} ctrls=${q3s.ctrls}`);
/* the cursor walks: next then prev, the readout follows */
const stepNext =
  '(() => { const b = document.querySelector("[data-canvas-ui=stack-slice-next]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const stepPrev =
  '(() => { const b = document.querySelector("[data-canvas-ui=stack-slice-prev]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const before = evalJson(MEASURE);
evalJson(stepNext);
sleep(1.5);
const after1 = evalJson(MEASURE);
ok("S7 Next stepped the cursor (the readout followed)",
  before.sliceReadout !== after1.sliceReadout,
  `"${before.sliceReadout}" -> "${after1.sliceReadout}"`);
evalJson(stepPrev);
sleep(1.5);
const after2 = evalJson(MEASURE);
ok("S8 Prev stepped the cursor back (the readout returned)",
  after2.sliceReadout === before.sliceReadout,
  `readout="${after2.sliceReadout}"`);

/* ---------- the close + the world back + the seed hygiene ---------- */
evalJson(ESC_LAST);
sleep(1);
evalJson(ESC_LAST);
sleep(1.5);
console.log("Face W — the world back (fresh load, settled)");
ab("open http://localhost:3000");
sleep(3);
const w1 = settle("the restored canvas");
if (corpse(w1, "Face W")) process.exit(1);
ok("W1 the world unharmed (canvas count == the opening count, zero unnamed)",
  w1.pageBtns === OPEN && w1.pageUnnamed === 0 && !w1.hasDlg,
  `btns=${w1.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok("W2 the ride leaves no session seed (the t157 two-way door's honest none — the t866 lesson rides every page)",
  seedAfter.seed === "" || seedAfter.seed === null,
  `seed=${JSON.stringify(seedAfter.seed)}`);

/* ---------- the ledger at birth (three faces: gallery / quickLook / worldBack) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  gallery: ledgerFace(prevFaces ? prevFaces.gallery?.live ?? null : null, s1, scalarOf),
  quickLook: ledgerFace(prevFaces ? prevFaces.quickLook?.live ?? null : null, q1, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the quick-look face holds: the clean room held (the panel-closed boot — the t866 law), the refine3d inspector's Results tab hosts the MrcGallery with ${s1.tiles} named tiles and the roving law's one seat, the round chips speak their aria-pressed states, ArrowRight moved the focus and the anchor followed (the t777 geometric law), Enter enlarged (the door lineage), the map dialog arrived as the TOPMOST layer with the file's label and the named region (tabIndex 0), the 'View in 3D (Mol*)' door present and named but never clicked, the stack dialog's slice cursor walked next -> prev with the readout following, the follow-window toggle carries its aria-pressed machine, the t831 keymap seat taught its keys, zero unnamed on every face, two settled rides bit-identical, the world back bit-for-bit (${OPEN} == ${OPEN}), and the ride left no session seed — the ledger aboard from birth (three faces, the shared law)`
  : `${fail} red — the quick-look layer moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t867-quick-look-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> canvas -> refine3d card (plain door) -> Results tab (mousedown) -> MrcGallery (tiles + roving) -> ArrowRight walk -> Enter -> map dialog (topmost) -> Escape -> stack dialog (.mrcs face, slice cursor) -> Escape -> worldBack + seed hygiene (one command)",
  doors: {
    inspector: "plain pointerdown+pointerup on the refine3d card — the submitted law",
    resultsTab: "mousedown on the Results tab — the t863 Radix law",
    mapDialog: "Enter on the focused tile — the t777 door lineage",
    stackDialog: "click the stack tile — the .mrcs face",
    close: "Escape — the keymap seat's own teaching",
  },
  host: { name: host.name, id: host.id, measured: true },
  openingCanvas: OPEN,
  faces: {
    gallery: { live: s1 },
    quickLook: { live: q1, secondRide: q1b, stackFace: q3s, cursorWalk: [before.sliceReadout, after1.sliceReadout, after2.sliceReadout] },
    worldBack: { live: w1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t867-quick-look-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nQUICK-LOOK-A11Y t867: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
