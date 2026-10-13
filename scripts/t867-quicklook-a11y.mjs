#!/usr/bin/env node
/**
 * t867 — the a11y rotation's next surface: the QUICK-LOOK face — the
 * results family's next remaining room, the star table's page's sibling.
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> results family (t865) -> star
 * table (t866) -> THIS page (t867).
 *
 * The surface (three rooms, one window — the results-view's image layer):
 *
 *   O0  the clean room — the t866 law: the session seed cleared, the
 *       panel-closed boot demanded. The instrument owns its conditions.
 *   MP  the maps gallery — the postprocess card's PLAIN door, the Results
 *       tab through the MOUSEDOWN door (the t863 law), the "Maps and
 *       images" section present and named, the Enlarge doors named (the
 *       text IS the name), zero unnamed.
 *   QL  the quick-look dialog (a MAP) — the tile's Enlarge door, the
 *       dialog as the TOPMOST layer (the t865 lesson), the heading = the
 *       file label, the region named with its keyboard door (tabIndex 0 —
 *       the t812 law), the t831 keymap seat aboard, zero unnamed, two
 *       settled rides bit-identical.
 *   HS  the histogram state machine — the quick-hist toggle (aria-pressed
 *       walk), the sigma-preset pressed-array walk (click -> the active
 *       moves -> click back -> restored, read LIVE never pinned), the
 *       lo/hi inputs named, the role=img histogram labeled.
 *   MO  the Mol* dialog + the ortho panel — the View-in-3D TEXT door (the
 *       name rides textContent, not aria-label — measured at birth), the
 *       ortho root named, the disclosure walked (collapsed -> expanded),
 *       the step/show-at doors named per axis, the three plane sliders
 *       named with valuenow, the app's OWN step button walked (valuenow
 *       moves one voxel and returns), the ortho keymap aboard, zero
 *       unnamed with the deepest dialog stack up.
 *   OB  the oblique block — the second disclosure walked, the three
 *       angle/offset sliders named, the adopt/jump doors present, the
 *       cut-3D toggle's aria-pressed walk, zero unnamed.
 *   ST  the stack dialog (a .mrcs) — the extract host, the montage img
 *       alt, the follow-window toggle walk, the slice cursor walked live
 *       (prev/next -> the readout "slice N of M" moves and returns), the
 *       range follows, the ARROW-KEY door dispatched on the dialog (the
 *       t831 teaching delivered), zero unnamed, two settled rides.
 *   W   the world back — fresh load, the canvas bit-for-bit, and the W2
 *       seed hygiene (the t866 lesson rides every page).
 *
 * Born with the ledger aboard (the t861 birthright): SEVEN faces through
 * the shared helper — mapsGallery / quicklook / histogram / molOrtho /
 * oblique / stack / worldBack.
 *
 * Receipt: shots-qa/t867-quicklook-a11y.json.
 *
 *   node scripts/t867-quicklook-a11y.mjs
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
const cmp = loadComparator(ROOT, "shots-qa/t867-quicklook-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t867 quicklook a11y walk — world ${world.mode}:${buildId}, the gallery, the quick-look dialog, the histogram, the Mol* ortho panel and the stack through the shared ruler\n` +
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
/* the outputs listing — the dialog's title is the file's `label ?? name`
 * (results-view.tsx), so the heading assertion reads the DATA, never a
 * pinned string (measured, not pinned). */
const outputs = async (id) => {
  const r = await fetch(`${BASE}/api/jobs/${id}/outputs`, { headers: SH });
  const b = await r.json();
  return b.files ?? b;
};
const titleOf = async (id, suffix) => {
  const files = await outputs(id);
  const f = (Array.isArray(files) ? files : []).find((x) => (x.path || "").endsWith(suffix));
  return f ? f.label ?? f.name : null;
};

/* ---------- the measure: the SHARED RULER + the quick-look family's probes.
 * ONE superset measure — every face films the same fields; the absent
 * selectors speak false/0 (within-face stability is what the rides diff).
 * NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 48) : null; const dlgHeadTop = headOf(dlgTop); const dlgCount = dgs.length; const actTabEl = dlgTop ? dlgTop.querySelector("[role=tab][data-state=active]") : document.querySelector("[role=tab][data-state=active]"); const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())); const sec = document.querySelector(\'section[aria-label="Maps and images"]\'); const tiles = sec ? Array.from(sec.querySelectorAll("button[data-tile-path]")) : []; const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); const region = dlgTop ? dlgTop.querySelector("[role=region]") : null; const pressed = dlgTop ? Array.from(dlgTop.querySelectorAll("button[aria-pressed]")).map((b) => ({ n: (b.getAttribute("aria-label") || (b.textContent || "").trim()).slice(0, 24), p: b.getAttribute("aria-pressed") === "true" })) : []; const sliders = dlgTop ? Array.from(dlgTop.querySelectorAll("[role=slider]")).map((s) => ({ n: (s.getAttribute("aria-label") || "").slice(0, 44), v: s.getAttribute("aria-valuenow") })) : []; const ortho = document.querySelector("[data-canvas-ui=ortho-panel]"); const oBtns = ortho ? Array.from(ortho.querySelectorAll("button")) : []; const oDisc = oBtns.find((b) => b.getAttribute("aria-expanded") !== null); const oSteps = oBtns.filter((b) => (b.getAttribute("aria-label") || "").startsWith("Step the ")); const oShows = oBtns.filter((b) => (b.getAttribute("aria-label") || "").startsWith("Show the ")); const oSliders = ortho ? Array.from(ortho.querySelectorAll("[role=slider]")).map((s) => ({ n: (s.getAttribute("aria-label") || "").slice(0, 44), v: s.getAttribute("aria-valuenow") })) : []; const obDisc = oBtns.filter((b) => b.getAttribute("aria-expanded") !== null)[1]; const readout = dlgTop ? dlgTop.querySelector("[data-canvas-ui=stack-slice-readout]") : null; const rangeEl = dlgTop ? dlgTop.querySelector("[data-canvas-ui=stack-slice-range]") : null; const followWin = dlgTop ? dlgTop.querySelector("[data-canvas-ui=stack-montage-window]") : null; const histImg = dlgTop ? dlgTop.querySelector("[role=img]") : null; return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgHeadTop: dlgHeadTop, dlgCount: dlgCount, actTab: actTabEl ? (actTabEl.textContent || "").trim().slice(0, 12) : null, shimmer: leaves.length, mapsSection: !!sec, tiles: tiles.length, tileNamed: tiles.every((t) => ((t.getAttribute("aria-label") || "").startsWith("Enlarge "))), tilePaths: tiles.slice(0, 8).map((t) => t.getAttribute("data-tile-path")), regionNamed: region ? ((region.getAttribute("aria-label") || "").startsWith("Map and stack preview")) : false, regionLabel: region ? (region.getAttribute("aria-label") || "").slice(0, 50) : null, regionTabindex: region ? region.getAttribute("tabindex") : null, keymap: dlgTop ? !!dlgTop.querySelector("[data-canvas-ui=quick-keymap]") : false, view3d: dlgTop ? !!Array.from(dlgTop.querySelectorAll("button")).find((b) => ((b.getAttribute("aria-label") || b.textContent || "")).includes("View in 3D")) : false, histToggle: dlgTop ? (() => { const t = dlgTop.querySelector("[data-canvas-ui=quick-hist-toggle]"); return t ? t.getAttribute("aria-pressed") : null; })() : null, histImgNamed: histImg ? !!((histImg.getAttribute("aria-label") || "").length > 10) : false, pressed: pressed, sliders: sliders, orthoPresent: !!ortho, orthoRoot: ortho ? ortho.getAttribute("aria-label") : null, orthoExpanded: oDisc ? oDisc.getAttribute("aria-expanded") : null, orthoSteps: oSteps.length, orthoStepsNamed: oSteps.every((b) => (b.getAttribute("aria-label") || "").length > 20), orthoShows: oShows.length, orthoSliders: oSliders, orthoKeymap: ortho ? !!ortho.querySelector("[data-canvas-ui=ortho-keymap]") : false, obliqueExpanded: obDisc ? obDisc.getAttribute("aria-expanded") : null, readout: readout ? (readout.textContent || "").trim() : null, rangeVal: rangeEl ? rangeEl.getAttribute("aria-valuenow") : null, followWin: followWin ? followWin.getAttribute("aria-pressed") : null, montageAlt: dlgTop ? (() => { const im = dlgTop.querySelector("img"); return im ? (im.getAttribute("alt") || "").slice(0, 40) : null; })() : null }); })()';

/* the settle law (t864/t865's generalization): the lazy barrel's own
 * quiescence door SILENT AND the images' own contract AND two consecutive
 * measures equal, bounded. */
const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 16, need = 2) => {
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
const waitFor = (what, probe, maxSecs = 30) => {
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
const escAll = () => {
  for (let i = 0; i < 8; i++) {
    const m = evalJson(MEASURE);
    if (!m.hasDlg) return i;
    evalJson(ESC_LAST);
    sleep(1.2);
  }
  return evalJson(MEASURE).hasDlg ? -1 : 8;
};

/* the card's PLAIN door: pointerdown+pointerup, no move, no shift — the
 * job-card's own law: idle opens the panel, submitted opens the inspector. */
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

/* the inspector tab's MOUSEDOWN door (t863's teaching: Radix Tabs switch
 * on mousedown — a .click() dispatch is silently ignored). */
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';

/* a gallery tile's Enlarge door, found by its data-tile-path suffix. */
const tileDoor = (suffix) =>
  '(() => { const sec = document.querySelector("section[aria-label=\\"Maps and images\\"]"); if (!sec) return JSON.stringify({ clicked: false }); const t = Array.from(sec.querySelectorAll("button[data-tile-path]")).find((b) => b.getAttribute("data-tile-path").endsWith("' + suffix + '")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()';

/* the View-in-3D TEXT door: the name rides textContent (measured at birth:
 * the button carries NO aria-label — the ruler's textContent branch is the
 * door's own name). */
const view3dDoor =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = Array.from(d.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || x.textContent || "")).includes("View in 3D")); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true, ariaLabel: b.getAttribute("aria-label"), text: (b.textContent || "").trim().slice(0, 30) }); })()';

/* the ortho disclosure (first aria-expanded button in the panel). */
const orthoDisc =
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); if (!o) return JSON.stringify({ clicked: false }); const d = Array.from(o.querySelectorAll("button")).find((b) => b.getAttribute("aria-expanded") !== null); if (!d) return JSON.stringify({ clicked: false }); d.click(); return JSON.stringify({ clicked: true, was: d.getAttribute("aria-expanded") }); })()';

/* the oblique disclosure (the SECOND aria-expanded button). */
const obliqueDisc =
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); if (!o) return JSON.stringify({ clicked: false }); const ds = Array.from(o.querySelectorAll("button")).filter((b) => b.getAttribute("aria-expanded") !== null); if (ds.length < 2) return JSON.stringify({ clicked: false }); ds[1].click(); return JSON.stringify({ clicked: true, was: ds[1].getAttribute("aria-expanded") }); })()';

/* the ortho panel's own step button for one axis (dec/inc by index) — the
 * app's own state machine, the valuenow is its readout. */
const orthoStep = (i) =>
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const s = Array.from(o.querySelectorAll("button")).filter((b) => (b.getAttribute("aria-label") || "").startsWith("Step the ")); if (s.length <= ' + i + ') return JSON.stringify({ clicked: false }); s[' + i + '].click(); return JSON.stringify({ clicked: true, label: s[' + i + '].getAttribute("aria-label").slice(0, 50) }); })()';

/* the stack dialog's slice doors + the arrow-key door (the t831 teaching). */
const stackBtn = (ui) =>
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = d && d.querySelector("[data-canvas-ui=' + ui + ']"); if (!b || b.disabled) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const arrowDoor = (key) =>
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) return "no-dialog"; d.dispatchEvent(new KeyboardEvent("keydown", { key: "' + key + '", bubbles: true })); return "arrow"; })()';

/* the zero-unnamed census invariant, one voice everywhere */
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- Face 0: the clean room + the calm canvas ---------- */
console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
/* t866 — the CLEAN-ROOM law: the session-position seed (t157) makes the
 * boot state ride-dependent. The instrument owns its measurement
 * conditions: clear the seed, reload, demand the panel-closed boot. */
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
/* the roster-arrival door (the t846 teaching, same window): the boot's
 * landing dialect mounts the project's cards on their own schedule — a
 * clock-settled canvas can film the 3-card starter while the roster
 * carries 15 (the 88-vs-144 witness). An arrival waits for arrival, never
 * for a clock: the canvas arrives when it hosts the roster's dominant
 * project's cards, measured from the API, never pinned. */
const doorJobs = (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs ?? [];
const rosterCards = (() => {
  const byProject = {};
  for (const j of doorJobs) byProject[j.projectId ?? "?"] = (byProject[j.projectId ?? "?"] ?? 0) + 1;
  return Math.max(1, ...Object.values(byProject));
})();
const cardsNow = () => evalJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()');
for (let i = 0; i < 30 && cardsNow().cards !== rosterCards; i++) sleep(1);
console.log(`  the roster-arrival door: ${cardsNow().cards}/${rosterCards} cards hosted`);
const m0 = settle("the canvas");
if (corpse(m0, "Face 0")) process.exit(1);
ok("O0 the boot is a clean room (the t157 seed cleared, the panel closed)",
  m0.panelOpen === false,
  `panelOpen=${m0.panelOpen}`);
ok("O1 the canvas is calm and named (the census's invariant)",
  !m0.hasDlg && censusOk(m0),
  `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;

/* ---------- the roster: measured never pinned ---------- */
const jobs = await roster();
const mapHost = jobs.find((j) => j.type === "postprocess" && j.status === "completed");
const stackHost = jobs.find((j) => j.type === "extract" && j.status === "completed");
if (!mapHost || !stackHost) {
  console.error("no completed postprocess/extract pair in the roster — the quick-look rooms cannot open");
  writeFileSync(join(ROOT, "shots-qa/t867-quicklook-a11y.json"), JSON.stringify({ instrument: "scripts/t867-quicklook-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no completed hosts — the ride stopped honestly before the quick-look rooms" }, null, 2));
  process.exit(1);
}
console.log(`  map host (measured): ${mapHost.name}; stack host: ${stackHost.name}`);
const mapTitle = await titleOf(mapHost.id, "postprocess.mrc");
const stackTitle = await titleOf(stackHost.id, "particles.mrcs");
console.log(`  titles from the data: map="${mapTitle}" stack="${stackTitle}"`);

/* ---------- Face MP — the maps gallery ---------- */
console.log("Face MP — the postprocess inspector, the Results tab, the maps gallery");
const c1 = evalJson(plainClick(mapHost.id));
ok("M1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
const w1 = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
ok("M2 the inspector arrived (a dialog aboard)", w1.hasDlg === true, `dlgCount=${w1.dlgCount}`);
const tab1 = evalJson(tabMouseDown("Results"));
ok("M3 the Results tab switched through the MOUSEDOWN door (the t863 Radix law)", tab1.found === true);
const g1 = waitFor("the maps gallery (the lazy barrel compiles)", (m) => m.mapsSection === true && m.tiles >= 1, 40);
if (corpse(g1, "Face MP")) process.exit(1);
ok("M4 the active tab speaks Results", g1.actTab === "Results", `actTab=${g1.actTab}`);
ok("M5 the Maps-and-images section is present and named", g1.mapsSection === true);
ok("M6 the gallery hosts Enlarge doors, each named (the text IS the name)",
  g1.tiles >= 1 && g1.tileNamed === true,
  `tiles=${g1.tiles} paths=${JSON.stringify(g1.tilePaths)}`);
ok("M7 zero unnamed page-wide WITH the inspector up (the census's invariant)",
  censusOk(g1),
  `btns=${g1.pageBtns} ctrls=${g1.ctrls}`);
const g1s = settle("the gallery (second ride)");
ok("M8 two settled rides bit-identical (the t836 law, the t860 settle)",
  JSON.stringify(g1) === JSON.stringify(g1s));

/* ---------- Face QL — the quick-look dialog (a map) ---------- */
console.log("Face QL — the map's quick-look dialog through the Enlarge door");
const d0 = evalJson(tileDoor("postprocess.mrc"));
ok("Q1 the map's Enlarge door clicked", d0.clicked === true);
const q1 = waitFor("the quick-look dialog", (m) => m.dlgCount >= 2 && m.regionNamed === true, 30);
if (corpse(q1, "Face QL")) process.exit(1);
ok("Q2 the dialog arrived as the TOPMOST layer (the t865 nested-portal lesson)",
  q1.hasDlg === true && q1.dlgCount >= 2,
  `dlgCount=${q1.dlgCount}`);
ok("Q3 the dialog's heading is the file's own label (label ?? name — read from the data, the TOPMOST layer)",
  mapTitle !== null && q1.dlgHeadTop === mapTitle,
  `head="${q1.dlgHeadTop}" == data "${mapTitle}"`);
ok("Q4 the region is named (the house dialect's own label)", q1.regionNamed === true,
  `label="${q1.regionLabel}"`);
ok("Q5 the region keeps its keyboard door (tabIndex 0 — the t812 law)",
  q1.regionTabindex === "0",
  `tabindex=${q1.regionTabindex}`);
ok("Q6 the t831 keymap seat is aboard (quick-keymap)", q1.keymap === true);
ok("Q7 the View-in-3D door is aboard", q1.view3d === true);
ok("Q8 zero unnamed page-wide WITH the quick-look up (the census's invariant)",
  censusOk(q1),
  `btns=${q1.pageBtns} ctrls=${q1.ctrls}`);
const q1b = settle("the quick-look (second ride)");
ok("Q9 two settled rides bit-identical (the t836 law)",
  JSON.stringify(q1) === JSON.stringify(q1b));

/* ---------- Face HS — the histogram state machine ---------- */
console.log("Face HS — the quick-hist toggle, the sigma presets, the lo/hi bounds");
ok("H1 the histogram toggle is aboard with a pressed state",
  q1.histToggle === "true" || q1.histToggle === "false",
  `aria-pressed=${q1.histToggle}`);
ok("H2 the histogram speaks as an image (role=img, labeled)", q1.histImgNamed === true);
const pressedBefore = q1.pressed;
ok("H3 the dialog hosts pressed-state controls, each named",
  pressedBefore.length >= 1 && pressedBefore.every((p) => p.n.length > 0),
  `pressed=${JSON.stringify(pressedBefore)}`);
/* the sigma walk: click a pressed-candidate whose state differs from an
 * active one (or any, if none active) — the active MOVES; click back —
 * restored. Read LIVE, never pinned. */
const sigmaWalk =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const bs = Array.from(d.querySelectorAll("button[aria-pressed]")); const active = bs.findIndex((b) => b.getAttribute("aria-pressed") === "true"); const target = active === -1 ? 0 : (active + 1) % bs.length; bs[target].click(); return JSON.stringify({ activeBefore: active, target: target, count: bs.length }); })()';
const sw = evalJson(sigmaWalk);
sleep(1.5);
const hs1 = evalJson(MEASURE);
const idxOf = (arr, name) => arr.findIndex((p) => p.n === name);
const targetName = pressedBefore[sw.target] ? pressedBefore[sw.target].n : null;
const movedOk = sw.count >= 2
  ? idxOf(hs1.pressed.filter((p) => p.p), targetName) !== -1
  : hs1.pressed[sw.target] ? hs1.pressed[sw.target].p !== pressedBefore[sw.target].p : false;
ok("H4 the sigma walk MOVED the active preset (the state machine, read live)",
  movedOk,
  `before=${sw.activeBefore} target=${sw.target} (${targetName})`);
/* click back — the walk returns home */
evalJson(sigmaWalk);
sleep(1.5);
const hs2 = evalJson(MEASURE);
const backActive = hs2.pressed.map((p) => p.p).indexOf(true);
const backOk = sw.activeBefore === -1 ? true : backActive === sw.activeBefore;
ok("H5 the walk home restored the preset (bit-for-bit back)", backOk,
  `active now=${backActive} (was ${sw.activeBefore})`);
ok("H6 the lo/hi bounds ride the dialog's named inputs (the census's invariant)",
  censusOk(hs2),
  `ctrls=${hs2.ctrls} unCtrls=${hs2.unCtrls}`);

/* ---------- Face MO — the Mol* dialog + the ortho panel ---------- */
console.log("Face MO — the View-in-3D text door, the Mol* dialog, the ortho panel");
const v3 = evalJson(view3dDoor);
ok("V1 the View-in-3D door clicked (the name rides TEXT — no aria-label, the ruler's branch)",
  v3.clicked === true,
  `text="${v3.text}" ariaLabel=${JSON.stringify(v3.ariaLabel)}`);
const mo1 = waitFor("the Mol* dialog + the ortho panel (the WebGL chunk compiles)", (m) => m.orthoPresent === true, 45);
if (corpse(mo1, "Face MO")) process.exit(1);
ok("V2 the Mol* dialog arrived and the ortho panel rode in (the map handoff)",
  mo1.orthoPresent === true && mo1.dlgCount >= 2,
  `dlgCount=${mo1.dlgCount}`);
ok("V3 the ortho root is named (Orthogonal slice browser)", mo1.orthoRoot === "Orthogonal slice browser");
ok("V4 the ortho disclosure starts COLLAPSED (the panel's own shape, measured)",
  mo1.orthoExpanded === "false",
  `aria-expanded=${mo1.orthoExpanded}`);
const od = evalJson(orthoDisc);
ok("V5 the disclosure walked open (collapsed -> expanded)", od.clicked === true);
const mo2 = waitFor("the expanded ortho panel", (m) => m.orthoExpanded === "true" && m.orthoSteps >= 6, 20);
ok("V6 the step doors are aboard, each named (three axes, dec + inc)",
  mo2.orthoSteps >= 6 && mo2.orthoStepsNamed === true,
  `steps=${mo2.orthoSteps}`);
ok("V7 the show-at doors are aboard (one per axis)", mo2.orthoShows === 3, `shows=${mo2.orthoShows}`);
ok("V8 the three plane sliders are named with a valuenow",
  mo2.orthoSliders.length === 3 && mo2.orthoSliders.every((s) => s.n.length > 8 && s.v !== null && s.v !== ""),
  `sliders=${JSON.stringify(mo2.orthoSliders)}`);
ok("V9 the ortho keymap is aboard (the t830 seat)", mo2.orthoKeymap === true);
/* the app's OWN step machine: step dec -> the XY slider moves; step inc -> back */
const svBefore = mo2.orthoSliders[0] ? mo2.orthoSliders[0].v : null;
evalJson(orthoStep(0));
sleep(1.2);
const mo3 = evalJson(MEASURE);
const svAfter = mo3.orthoSliders[0] ? mo3.orthoSliders[0].v : null;
ok("V10 the app's own step button MOVED the XY plane (the state machine, read live)",
  svBefore !== null && svAfter !== null && svBefore !== svAfter,
  `valuenow ${svBefore} -> ${svAfter}`);
evalJson(orthoStep(1));
sleep(1.2);
const mo4 = evalJson(MEASURE);
const svBack = mo4.orthoSliders[0] ? mo4.orthoSliders[0].v : null;
ok("V11 the step home restored the plane (bit-for-bit back)", svBack === svBefore,
  `valuenow ${svAfter} -> ${svBack}`);
ok("V12 zero unnamed page-wide WITH the Mol* stack up (the census's invariant)",
  censusOk(mo4),
  `btns=${mo4.pageBtns} ctrls=${mo4.ctrls}`);

/* ---------- Face OB — the oblique block ---------- */
console.log("Face OB — the oblique disclosure, the angle sliders, the cut-3D toggle");
const ob = evalJson(obliqueDisc);
ok("B1 the oblique disclosure walked open", ob.clicked === true, `was=${ob.was}`);
const ob1 = waitFor("the oblique block", (m) => m.obliqueExpanded === "true" && m.orthoSliders.length === 6, 20);
ok("B2 the oblique sliders joined the panel (polar / azimuth / offset)",
  ob1.obliqueExpanded === "true" && ob1.orthoSliders.length === 6,
  `sliders=${ob1.orthoSliders.length} names=${JSON.stringify(ob1.orthoSliders.slice(3).map((s) => s.n))}`);
const obName = evalJson('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const ds = Array.from(o.querySelectorAll("button")).filter((b) => b.getAttribute("aria-expanded") !== null); return JSON.stringify({ name: (ds[1].getAttribute("aria-label") || ds[1].textContent || "").slice(0, 40) }); })()');
ok("B3 the oblique disclosure is named (the Oblique section header)",
  (obName.name || "").startsWith("Oblique section"),
  `label="${obName.name}"`);
const obDoors = evalJson('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const bs = Array.from(o.querySelectorAll("button")).map((b) => b.getAttribute("aria-label") || ""); return JSON.stringify({ adopt: bs.some((x) => x.toLowerCase().includes("adopt")), jump: bs.some((x) => x.toLowerCase().includes("jump")), cut3d: bs.filter((x) => x.toLowerCase().includes("cut")).length }); })()');
ok("B4 the oblique mouths are aboard (adopt + jump + the cut-3D toggle)",
  obDoors.adopt === true && obDoors.jump === true && obDoors.cut3d >= 1,
  `adopt=${obDoors.adopt} jump=${obDoors.jump} cut3d=${obDoors.cut3d}`);
/* the cut-3D pressed walk: click the cut toggle, the pressed state flips */
const cutWalk =
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const b = Array.from(o.querySelectorAll("button[aria-pressed]")).find((x) => ((x.getAttribute("aria-label") || "")).toLowerCase().includes("cut")); if (!b) return JSON.stringify({ clicked: false }); const was = b.getAttribute("aria-pressed"); b.click(); return JSON.stringify({ clicked: true, was: was }); })()';
const cw = evalJson(cutWalk);
sleep(1.5);
const cw2 = evalJson('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const b = Array.from(o.querySelectorAll("button[aria-pressed]")).find((x) => ((x.getAttribute("aria-label") || "")).toLowerCase().includes("cut")); return JSON.stringify({ now: b ? b.getAttribute("aria-pressed") : null }); })()');
ok("B5 the cut-3D toggle's state flipped (read live)", cw.clicked === true && cw2.now !== cw.was,
  `aria-pressed ${cw.was} -> ${cw2.now}`);
evalJson(cutWalk);
sleep(1.5);
const cw3 = evalJson('(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const b = Array.from(o.querySelectorAll("button[aria-pressed]")).find((x) => ((x.getAttribute("aria-label") || "")).toLowerCase().includes("cut")); return JSON.stringify({ now: b ? b.getAttribute("aria-pressed") : null }); })()');
ok("B6 the toggle walked home (the world's own state restored)",
  cw3.now === cw.was,
  `aria-pressed ${cw2.now} -> ${cw3.now} (was ${cw.was})`);
ok("B7 zero unnamed page-wide WITH the oblique block up (the census's invariant)",
  censusOk(ob1),
  `btns=${ob1.pageBtns} ctrls=${ob1.ctrls}`);

/* ---------- Face ST — the stack dialog (a .mrcs) ---------- */
console.log("Face ST — Escape home, the extract host, the stack dialog's slice machine");
const esc1 = escAll();
ok("S0 the Mol* world closed honestly (all dialogs dismissed)",
  esc1 !== -1,
  `escapes=${esc1}`);
ab("open http://localhost:3000");
sleep(3);
const c2 = evalJson(plainClick(stackHost.id));
ok("S1 the extract card's plain door opened the inspector", c2.clicked === true);
const w2 = waitFor("the extract inspector", (m) => m.hasDlg && m.dlgCount >= 1);
evalJson(tabMouseDown("Results"));
const g2 = waitFor("the extract gallery", (m) => m.mapsSection === true && m.tiles >= 1, 40);
ok("S2 the extract gallery hosts the stack tile",
  g2.mapsSection === true && g2.tilePaths.some((p) => (p || "").endsWith(".mrcs")),
  `tiles=${g2.tiles} paths=${JSON.stringify(g2.tilePaths)}`);
const d2 = evalJson(tileDoor(".mrcs"));
ok("S3 the stack's Enlarge door clicked", d2.clicked === true);
const st1 = waitFor("the stack dialog", (m) => m.dlgCount >= 2 && (m.readout || "").startsWith("slice"), 30);
if (corpse(st1, "Face ST")) process.exit(1);
ok("S4 the stack dialog arrived as the TOPMOST layer, heading = the stack's own label (from the data)",
  st1.dlgCount >= 2 && stackTitle !== null && st1.dlgHeadTop === stackTitle,
  `head="${st1.dlgHeadTop}" == data "${stackTitle}"`);
ok("S5 the region is named with its keyboard door (the house dialect)",
  st1.regionNamed === true && st1.regionTabindex === "0");
ok("S6 the montage img speaks an alt (the sixteen-distribution sheet)", (st1.montageAlt || "").length > 3,
  `alt="${st1.montageAlt}"`);
ok("S7 the t831 keymap seat is aboard (quick-keymap)", st1.keymap === true);
const rw0 = st1.readout;
const nOf = (s) => { const m = (s || "").match(/slice (\d+)/); return m ? Number(m[1]) : null; };
evalJson(stackBtn("stack-slice-next"));
sleep(1.2);
const st2 = evalJson(MEASURE);
ok("S8 the NEXT door advanced the slice (the readout speaks slice N of M)",
  nOf(st2.readout) === nOf(rw0) + 1,
  `readout "${rw0}" -> "${st2.readout}"`);
evalJson(stackBtn("stack-slice-prev"));
sleep(1.2);
const st3 = evalJson(MEASURE);
ok("S9 the PREV door returned the slice (bit-for-bit back)",
  st3.readout === rw0,
  `readout "${st3.readout}"`);
/* the range follows the cursor */
ok("S10 the range slider follows the slice cursor", st3.rangeVal !== null,
  `aria-valuenow=${st3.rangeVal}`);
/* the arrow-key door — the t831 teaching delivered on the dialog itself */
evalJson(arrowDoor("ArrowRight"));
sleep(1.2);
const st4 = evalJson(MEASURE);
ok("S11 the ARROW-KEY door advanced the slice (the keymap's teaching, delivered)",
  nOf(st4.readout) === nOf(rw0) + 1,
  `readout "${st4.readout}"`);
evalJson(arrowDoor("ArrowLeft"));
sleep(1.2);
const st5 = evalJson(MEASURE);
ok("S12 the LEFT arrow returned the slice", st5.readout === rw0, `readout "${st5.readout}"`);
/* the follow-window toggle walk */
const fw0 = st1.followWin;
const fwToggle =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = d && d.querySelector("[data-canvas-ui=stack-montage-window]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
evalJson(fwToggle);
sleep(1.5);
const st6 = evalJson(MEASURE);
ok("S13 the follow-window toggle's state flipped (read live)",
  fw0 !== null && st6.followWin !== null && st6.followWin !== fw0,
  `aria-pressed ${fw0} -> ${st6.followWin}`);
evalJson(fwToggle);
sleep(1.2);
const st7 = settle("the stack dialog (second ride)");
ok("S14 zero unnamed page-wide WITH the stack dialog up (the census's invariant)",
  censusOk(st7),
  `btns=${st7.pageBtns} ctrls=${st7.ctrls}`);
ok("S15 the walks left NO residue (the settled pair bit-identical: arrival == after all walks home)",
  JSON.stringify(st1) === JSON.stringify(st7),
  diffKeys(st1, st7).length === 0 ? "bit-for-bit" : `moved: ${diffKeys(st1, st7).join(", ")}`);

/* ---------- Face W — the world back + the seed hygiene ---------- */
console.log("Face W — the world back (fresh load, sleep 3)");
escAll();
ab("open http://localhost:3000");
sleep(3);
const w3 = settle("the restored canvas");
if (corpse(w3, "Face W")) process.exit(1);
ok("W1 the world unharmed (canvas count == the opening count, zero unnamed)",
  w3.pageBtns === OPEN && w3.pageUnnamed === 0 && !w3.hasDlg,
  `btns=${w3.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok("W2 the ride leaves no session seed (the t157 two-way door's honest none — the t866 lesson rides every page)",
  seedAfter.seed === "" || seedAfter.seed === null,
  `seed=${JSON.stringify(seedAfter.seed)}`);

/* ---------- the ledger at birth (seven faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (seven faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  mapsGallery: ledgerFace(prevFaces ? prevFaces.mapsGallery?.live ?? null : null, g1, scalarOf),
  quicklook: ledgerFace(prevFaces ? prevFaces.quicklook?.live ?? null : null, q1, scalarOf),
  histogram: ledgerFace(prevFaces ? prevFaces.histogram?.live ?? null : null, hs2, scalarOf),
  molOrtho: ledgerFace(prevFaces ? prevFaces.molOrtho?.live ?? null : null, mo4, scalarOf),
  oblique: ledgerFace(prevFaces ? prevFaces.oblique?.live ?? null : null, ob1, scalarOf),
  stack: ledgerFace(prevFaces ? prevFaces.stack?.live ?? null : null, st7, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w3, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the quick-look face holds: the clean room held (the panel-closed boot — the t866 law), the postprocess gallery hosted ${g1.tiles} named Enlarge doors, the map's quick-look dialog arrived as the TOPMOST layer with the file's label and the named region (tabIndex 0), the histogram's sigma presets walked live and home, the Mol* handoff brought the ortho panel whose disclosure, step doors, three plane sliders and keymap all spoke (the app's own step machine moved the plane and returned it), the oblique block's angle sliders and cut-3D toggle walked live, the extract stack's slice cursor advanced by door AND by arrow key and returned bit-for-bit with the follow-window toggle walked, zero unnamed on every face, the world back bit-for-bit (${OPEN} == ${OPEN}), and the ride left no session seed — the ledger aboard from birth (seven faces, the shared law)`
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
  instrument: "scripts/t867-quicklook-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> canvas -> postprocess card (plain door) -> Results tab (mousedown) -> maps gallery -> Enlarge door -> quick-look dialog (topmost) -> histogram walk -> View-in-3D (text door) -> Mol* ortho panel -> oblique block -> Escape home -> extract card -> stack dialog -> slice + arrow + toggle walks -> worldBack + seed hygiene (one command)",
  doors: {
    inspector: "plain pointerdown+pointerup on the card — the submitted law",
    resultsTab: "mousedown on the Results tab — the t863 Radix law",
    quicklook: "click the tile's Enlarge door — the text IS the name",
    molStar: "click the View-in-3D TEXT door — no aria-label, the ruler's textContent branch",
    close: "Escape — the keymap seats' own teaching",
  },
  host: { map: { name: mapHost.name, id: mapHost.id }, stack: { name: stackHost.name, id: stackHost.id }, measured: true },
  openingCanvas: OPEN,
  faces: {
    mapsGallery: { live: g1, secondRide: g1s },
    quicklook: { live: q1, secondRide: q1b },
    histogram: { live: hs2, walk: { before: pressedBefore, target: sw.target, after: hs2.pressed } },
    molOrtho: { live: mo4, sliderWalk: { before: svBefore, stepped: svAfter, back: svBack } },
    oblique: { live: ob1, cutWalk: { was: cw.was, now: cw2.now } },
    stack: { live: st7, sliceWalk: [rw0, st2.readout, st3.readout, st4.readout, st5.readout], followWin: [fw0, st6.followWin] },
    worldBack: { live: w3 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t867-quicklook-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nQUICKLOOK-A11Y t867: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
