#!/usr/bin/env node
/**
 * t873 — the class3d PICKER FACE (the t872 tail's first candidate,
 * non-build-day arm): the selection gallery's 3D dialect — a select2d
 * fed by a class3d — walked live for the first time in THIS world.
 *
 * The t402b idiom (「同理 3d 分类也是」) made the gallery source-agnostic:
 * any incoming edge from a class2d/select2d/class3d lights it, and a
 * class3d source speaks the 3D word forms. But this world's gallery
 * walks so far rode class2d sources only; the class3d-fed picker is
 * unwalked ground. The world's own grammar gates the walk: the classes
 * API answers FIRST (the source's occupancy truth), and the gallery's
 * header must SPEAK the source's kind (the mono type word, the pours
 * dots' testid `class-gallery-pours-class3d`, the sr-only pours word).
 *
 * THE SANCTIONED MUTATION RIDE (the t863 precedent, one command):
 *   create (POST /api/jobs — the t708 write door, far-corner parked)
 *   -> wire (POST /api/edges, class3d's particles -> the probe's
 *      particles — the mouth the world's own grammar already speaks:
 *      the adopt flow's kind scan feeds exactly this pair for a 3D
 *      source, and the gallery's upstream law is port-agnostic, the
 *      t402b seed's own shape)
 *   -> walk (the panel's plain door, the gallery's 3D face, the auto
 *      arithmetic, the click dialect, the zoom lightbox, the sort
 *      arrangement)
 *   -> un-mutate (DELETE /api/jobs/:id — the app's own cascade, the
 *      edge swept with it) -> the world demanded back bit-for-bit.
 *
 *   O   the clean room — the seed cleared, the panel-closed boot, the
 *       calm canvas, the sort preference's opening value (the ride
 *       must return it).
 *   T   the APIs' truth first: the roster, the edges, and the class3d's
 *       classes API (4 classes x 24 particles, total 96, iteration 25,
 *       volumeFiles null — the world speaks the STACK dialect here: the
 *       combined classes.mrcs keeps priority by design, the per-class
 *       volumes are the fallback lane, so the tiles render from the
 *       stack — MEASURED, never pinned, recorded in the receipt).
 *   M   the mutation: POST 201 -> the idle card; the edge POST 201.
 *   G   the gallery's 3D face: the panel opens through the plain door,
 *       the section named, the mono word speaks class3d, the pours seat
 *       speaks its sr-only word, the grid is the named listbox, the
 *       four tiles carry the API's own arithmetic in their names
 *       ("Toggle class N (24 particles, 25%)"), every tile's image
 *       REALLY decoded (complete + naturalWidth, the t865 settle law),
 *       zero unnamed page-wide, two settled rides bit-identical.
 *   A   the auto arithmetic: with occupancy 0.5 x best = 12 < 24, the
 *       auto set keeps ALL four — every tile aria-pressed true, the
 *       Auto door's own pressed state true, the footer speaks the kept
 *       arithmetic. The DOM speaks the classes API's math.
 *   P   the click dialect: first click on class 2 leaves the auto set
 *       (the RELION subset-display feel — auto is a suggestion): the
 *       params' selectedClasses becomes "1,3,4" through the panel's
 *       own debounced save, the tile unpresses; the second click
 *       returns it ("1,2,3,4"); the Auto door restores the suggestion
 *       ("auto", all pressed). The world's own write path is the
 *       assertion's target — the API's params, polled.
 *   Z   the zoom lightbox: the class-zoom door opens the dialog above
 *       the panel (the topmost layer), Escape closes what the world
 *       opened, the panel remains.
 *   S   the sort arrangement (Task 156's law): the occupancy chip is
 *       persist-then-set — storage echoes intent, the arrangement
 *       reorders and hides nothing; the chip clicks are the ONLY write
 *       path, and the ride returns the opening value.
 *   W   the un-mutation: DELETE -> the roster and the edges return
 *       bit-for-bit (the cascade sweeps the edge), the canvas count
 *       returns, zero unnamed, no session seed, the sort key home.
 *
 * Born with the ledger aboard (the t861 birthright): THREE faces —
 * pickerArrival / gallery3d / worldBack — arm 1 recorded on the first
 * ride. Registered at birth into A4e-28 (the family's shape).
 *
 * Receipt: shots-qa/t873-class3d-picker.json (+ two PNGs archived).
 *
 *   node scripts/t873-class3d-picker.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const RECEIPT = "shots-qa/t873-class3d-picker.json";
/* the receipt's REVISION stamp (the t867 arm-2r law, the family's field
 * name `instrumentRevision` — the loadComparator's own mouth): the
 * instrument grew between its first ride (the missing Params-tab door —
 * the gallery never mounted, the faces filmed a gallery-less panel) and
 * its mended walk. The stamp tells the ledger the comparator predates
 * the growth — the next same-revision ride meets arm 3 bit-for-bit. */
const RECEIPT_REVISION = 2;
const PROBE_NAME = "t873 class3d picker probe";

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
const shot = (rel) =>
  execSync(`agent-browser screenshot ${rel}`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });

/* same-origin metadata — the API reads/writes are same-origin gates (the t708 shape) */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
const api = async (method, url, body) => {
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: SH,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let b = null;
  try {
    b = await r.json();
  } catch {
    b = null;
  }
  return { status: r.status, body: b };
};
const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const b = await r.json();
  return b.jobs ?? b;
};
const edgesOf = async () => {
  const r = await fetch(`${BASE}/api/edges`, { headers: SH });
  const b = await r.json();
  return b.edges ?? (Array.isArray(b) ? b : []);
};
const jobParamsOf = async (id) => {
  const jobs = await roster();
  return (jobs.find((j) => j.id === id) ?? {}).params ?? null;
};
const pollParams = async (id, want, maxSecs = 10) => {
  for (let i = 0; i < maxSecs; i++) {
    const p = await jobParamsOf(id);
    if (p && String(p.selectedClasses ?? "") === want) return String(p.selectedClasses);
    await new Promise((res) => setTimeout(res, 1000));
  }
  return String((await jobParamsOf(id))?.selectedClasses ?? "");
};

/* ---------- the measure: the panel + the gallery's superset ---------- */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgsAll = Array.from(document.querySelectorAll("img")); const altless = imgsAll.filter((i) => !i.hasAttribute("alt")); const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null; const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())); const sec = document.querySelector(\'section[aria-label="Class selection gallery"]\'); const grid = sec ? sec.querySelector("[role=listbox]") : null; const tiles = sec ? Array.from(sec.querySelectorAll("button[aria-pressed]")).filter((b) => ((b.getAttribute("aria-label") || "").indexOf("Toggle class ") === 0)) : []; const tileInfo = tiles.map((b) => ({ label: (b.getAttribute("aria-label") || "").slice(0, 60), on: b.getAttribute("aria-pressed") })); const tImgs = sec ? Array.from(sec.querySelectorAll("img")) : []; const imgPending = tImgs.filter((i) => !i.complete || i.naturalWidth === 0).length; const pours = document.querySelector("[data-testid^=class-gallery-pours-]"); const autoBtn = sec ? Array.from(sec.querySelectorAll("button")).find((b) => ((b.textContent || "").trim() === "Auto")) : null; const foot = sec ? sec.querySelector("[data-canvas-ui=class-gallery-footer]") : null; const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); return JSON.stringify({ panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgsAll.length, altless: altless.length, hasDlg: dgs.length > 0, dlgCount: dgs.length, dlgHeadTop: headOf(dlgTop), shimmer: leaves.length, gallery: !!sec, gridNamed: grid ? ((grid.getAttribute("aria-label") || "").indexOf("Class selection grid") === 0) : false, tiles: tileInfo, tileCount: tiles.length, imgPending: imgPending, imgsGallery: tImgs.length, poursId: pours ? pours.getAttribute("data-testid") : null, poursWord: pours ? ((pours.querySelector(".sr-only") || {}).textContent || "").trim() : "", monoType: sec ? (Array.from(sec.querySelectorAll("span")).map((s) => (s.textContent || "").trim()).find((t) => t === "class3d" || t === "class2d") || "") : "", autoOn: autoBtn ? autoBtn.getAttribute("aria-pressed") : null, footText: foot ? (foot.textContent || "").trim().slice(0, 120) : "" }); })()';

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
      if (dk.length) console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.shimmer === 0 && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (shimmer silent, ${run}x stable)`);
  return m;
};
const waitFor = (what, probe, maxSecs = 24) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  console.log(`    (waitFor "${what}" timed out after ${maxSecs}s — the last measure rides)`);
  return m;
};
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- doors ---------- */
const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';
const toggleClick = (cls) =>
  '(() => { const b = Array.from(document.querySelectorAll(\'button[aria-pressed]\')).find((x) => ((x.getAttribute("aria-label") || "").indexOf("Toggle class ' + cls + ' ") === 0)); if (!b) return JSON.stringify({ clicked: false }); b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()';
const uiClick = (ui) =>
  '(() => { const b = document.querySelector("[data-canvas-ui=\\"' + ui + '\\"]") || Array.from(document.querySelectorAll("button")).find((x) => (x.getAttribute("data-canvas-ui") || "") === "' + ui + '"); if (!b) return JSON.stringify({ clicked: false }); b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()';
const zoomClick = (cls) =>
  '(() => { const b = document.querySelector(\'button[aria-label="Zoom class ' + cls + ' — inspect the average full size"]\'); if (!b) return JSON.stringify({ clicked: false }); b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()';

console.log("t873 — the class3d picker's face (the sanctioned mutation ride, one command)\n");

const world = worldIdentity(ROOT);
console.log(`  world key: ${world.id} (${world.mode})`);
const cmp = loadComparator(ROOT, RECEIPT, world.id);
console.log(`  drift ledger: ${cmp.prevFound ? `comparator found (build ${cmp.prevBuild})` : "no predecessor — arm 1 (first ride)"}`);

/* ---------- Face 0: the clean room + the calm canvas ---------- */
console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
if (corpse(m0, "Face 0")) process.exit(1);
ok("O0 the boot is a clean room (the t157 seed cleared, the panel closed)", m0.panelOpen === false, `panelOpen=${m0.panelOpen}`);
ok("O1 the canvas is calm and named (the census's invariant)", !m0.hasDlg && censusOk(m0), `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;
const sortKeyRaw = evalJson('(() => { return JSON.stringify({ sort: localStorage.getItem("cryoflow.classGallerySort.v1") }); })()').sort;
/* the t156 trust rule's own words: only "occupancy" is trusted, everything
 * else falls to "class" — so "class" IS the default and ABSENCE is
 * behaviorally identical. The canonical boot state is therefore absence
 * unless the user's own "occupancy" choice rides; the ride canonicalizes
 * and later un-owns its own chip writes against THAT. */
let sortKeyBefore = sortKeyRaw;
if (sortKeyBefore === "class") {
  evalJson('(() => { localStorage.removeItem("cryoflow.classGallerySort.v1"); return "canonical"; })()');
  sortKeyBefore = null;
}
const panelTabBefore = evalJson('(() => { return JSON.stringify({ tab: localStorage.getItem("cryoflow.panelTab.v1") }); })()').tab;

/* ---------- Face T: the APIs' truth first ---------- */
console.log("Face T — the roster, the edges, and the class3d's classes API");
const jobs = await roster();
const c3d = jobs.find((j) => j.type === "class3d" && j.status === "completed");
if (!c3d) {
  console.error("no completed class3d in the roster — the 3D picker face cannot light; the ride stops honestly");
  writeFileSync(
    join(ROOT, RECEIPT),
    JSON.stringify({ instrument: "scripts/t873-class3d-picker.mjs", ruler: NAMEOF_LAW, build: world.id, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no class3d — the ride stopped honestly" }, null, 2)
  );
  process.exit(1);
}
const E0 = (await edgesOf()).length;
const J0 = jobs.length;
const clsApi = await (await fetch(`${BASE}/api/jobs/${c3d.id}/classes`, { headers: SH })).json();
const clsCounts = (clsApi.classes ?? []).map((c) => c.cls);
const clsCountOf = (c) => ((clsApi.classes ?? []).find((x) => x.cls === c) ?? {}).count ?? null;
console.log(`  class3d ${c3d.name}: ${clsApi.classes?.length ?? "?"} classes, total ${clsApi.total}, iter ${clsApi.iteration}, volumeFiles ${JSON.stringify(clsApi.volumeFiles)} (the stack dialect keeps priority by design — measured, recorded)`);
ok("T1 the classes API speaks the source's occupancy truth", clsApi.classes?.length >= 1 && clsApi.total > 0, `classes=${clsCounts.join("/")} total=${clsApi.total}`);
ok("T2 the world's grammar recorded before the ride", E0 >= 1 && J0 >= 1, `jobs=${J0} edges=${E0}`);

/* ---------- Face M: the sanctioned mutation ---------- */
console.log("Mutation — POST /api/jobs (the t708 write door, far-corner parked) + the wire");
const mk = await api("POST", "/api/jobs", { type: "select2d", name: PROBE_NAME, x: 2600, y: 1400 });
ok("M1 the probe minted through the app's own door", mk.status === 201 || mk.status === 200, `status=${mk.status}`);
const probeId = mk.body?.job?.id ?? mk.body?.id;
ok("M2 the probe is a select2d with an id", !!probeId && (mk.body?.job?.type ?? "select2d") === "select2d", `id=${probeId ? probeId.slice(0, 12) : "??"}`);
const jobsAfterMk = await roster();
ok("M3 the roster grew by exactly one (the idle card aboard)", jobsAfterMk.length === J0 + 1, `jobs=${jobsAfterMk.length} (was ${J0})`);
const wire = await api("POST", "/api/edges", { fromJobId: c3d.id, toJobId: probeId, fromPort: "particles", toPort: "particles" });
ok("M4 the wire lit through the app's own door (particles -> particles — the grammar the adopt flow's kind scan speaks for a 3D source)", wire.status === 201 || wire.status === 200, `status=${wire.status}`);
const edgesAfterWire = await edgesOf();
ok("M5 the edges grew by exactly one", edgesAfterWire.length === E0 + 1, `edges=${edgesAfterWire.length} (was ${E0})`);

/* ---------- Face G: the gallery's 3D face ---------- */
console.log("Face G — the plain door, the panel, the gallery speaking the 3D kind");
ab("open http://localhost:3000");
sleep(3);
const c1 = evalJson(plainClick(probeId));
ok("G1 the idle card's plain door opened the panel (the t863 law)", c1.clicked === true);
/* the PANEL is a side panel (its own Close button), not a Radix dialog —
 * the panelOpen flag is its arrival door (the first ride's lesson: the
 * dialog count films the lightbox layer, never the panel) */
const gPanel = waitFor("the panel itself", (m) => m.panelOpen);
ok("G1b the panel arrived (the side panel's own close button aboard)", gPanel.panelOpen === true, `panelOpen=${gPanel.panelOpen}`);
/* the gallery lives on the panel's OUTER Params tab (the persisted tab's
 * own default is "io" — the t863 walk's lesson: the panel's tabs are
 * Radix triggers and switch on MOUSEDOWN, never on click) */
const tab1 = evalJson(tabMouseDown("Params"));
ok("G1c the outer Params tab switched through the MOUSEDOWN door (the t863 Radix law)", tab1.found === true);
const g1 = waitFor("the panel + the gallery", (m) => m.panelOpen && m.gallery && m.tileCount > 0 && m.imgPending === 0);
const g2 = settle("the gallery (the tiles decode)");
if (corpse(g2, "Face G")) process.exit(1);
ok("G2 the gallery section is present and named", g2.gallery === true);
ok("G3 the header's mono word speaks the 3D kind", g2.monoType === "class3d", `mono="${g2.monoType}"`);
ok("G4 the pours seat is aboard BY KIND (class-gallery-pours-class3d)", g2.poursId === "class-gallery-pours-class3d", `testid=${g2.poursId}`);
ok("G5 the pours seat's sr-only word names the water (the t773 law's voice)", (g2.poursWord || "").indexOf("pours ") === 0, `word="${g2.poursWord}"`);
ok("G6 the grid is the named listbox (arrow keys move, Enter toggles)", g2.gridNamed === true);
const labelMatchesApi = (label) => {
  const m = (label || "").match(/^Toggle class (\d+) \((\d+) particles, (\d+)%\)$/);
  if (!m) return false;
  const apiC = (clsApi.classes ?? []).find((x) => x.cls === Number(m[1]));
  return !!apiC && Number(m[2]) === apiC.count && Number(m[3]) === Math.round((apiC.count / clsApi.total) * 100);
};
ok("G7 the tiles speak the API's own arithmetic in their names (per-class, parsed not pinned)", g2.tileCount === clsApi.classes.length && g2.tiles.every((t) => labelMatchesApi(t.label)), `tiles=${g2.tiles.map((t) => t.label.slice(13, 42)).join(" | ")}`);
ok("G8 every tile's image REALLY decoded (complete + naturalWidth — the t865 settle law)", g2.imgPending === 0 && g2.imgsGallery >= g2.tileCount, `imgs=${g2.imgsGallery} pending=${g2.imgPending}`);
ok("G9 zero unnamed page-wide WITH the panel up (the census's invariant)", censusOk(g2), `btns=${g2.pageBtns} ctrls=${g2.ctrls}`);
const g3 = settle("the gallery (second ride)");
ok("G10 two settled rides bit-identical (the t836 law)", JSON.stringify(g2) === JSON.stringify(g3));

/* ---------- Face A: the auto arithmetic ---------- */
ok("A1 the auto set keeps every class (0.5 x best = 12 < 24 — the DOM speaks the API's math)", g2.tiles.every((t) => t.on === "true"), `pressed=${g2.tiles.map((t) => t.on).join("/")}`);
ok("A2 the Auto door's own pressed state agrees", g2.autoOn === "true", `autoOn=${g2.autoOn}`);
ok("A3 the footer speaks the kept arithmetic", /\d/.test(g2.footText || ""), `foot="${g2.footText.slice(0, 70)}"`);
shot("shots-qa/t873-class3d-picker.png");
console.log("  (the 3D-fed gallery archived)");

/* ---------- Face P: the click dialect (the world's own write path) ---------- */
console.log("Face P — first click leaves the auto set; the params' debounced save speaks");
const p1 = evalJson(toggleClick(clsCounts[1] ?? 2));
ok("P1 class 2's tile clicked", p1.clicked === true);
const sel1 = await pollParams(probeId, "1,3,4");
ok("P2 the param's own write path spoke 1,3,4 (auto is a suggestion — the RELION feel)", sel1 === "1,3,4", `selectedClasses="${sel1}"`);
const g4 = evalJson(MEASURE);
ok("P3 the tile unpressed (the DOM agrees with the world)", (g4.tiles.find((t) => t.label.indexOf(`Toggle class ${clsCounts[1] ?? 2} `) === 0) ?? {}).on === "false");
const p2 = evalJson(toggleClick(clsCounts[1] ?? 2));
const sel2 = await pollParams(probeId, "1,2,3,4");
ok("P4 the second click returned the class (1,2,3,4)", sel2 === "1,2,3,4", `selectedClasses="${sel2}"`);
const autoDoor = evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => ((x.textContent || "").trim() === "Auto")); if (!b) return JSON.stringify({ clicked: false }); b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()');
const sel3 = await pollParams(probeId, "auto");
ok("P5 the Auto door restored the suggestion (the round trip closes)", autoDoor.clicked === true && sel3 === "auto", `selectedClasses="${sel3}"`);

/* ---------- Face Z: the zoom lightbox ---------- */
console.log("Face Z — the zoom door opens the lightbox above the panel");
const z1 = evalJson(zoomClick(clsCounts[0] ?? 1));
ok("Z1 the class-zoom door clicked", z1.clicked === true);
const z2 = waitFor("the lightbox", (m) => m.dlgCount >= 1);
ok("Z2 the lightbox arrived as the page's FIRST dialog layer (the panel is a side panel, the lightbox the dialog)", z2.dlgCount >= 1, `dlgCount=${z2.dlgCount}`);
evalJson(ESC_LAST);
sleep(1.5);
const z3 = evalJson(MEASURE);
ok("Z3 Escape closed the lightbox (the world closes what it opened)", z3.dlgCount === z2.dlgCount - 1 && z3.gallery === true, `dlgCount ${z2.dlgCount} -> ${z3.dlgCount}`);
ok("Z4 the panel remains, zero unnamed", z3.panelOpen === true && censusOk(z3));

/* ---------- Face S: the sort arrangement (persist-then-set) ---------- */
console.log("Face S — the occupancy chip: storage echoes intent, the ride returns the value");
const s1 = evalJson(uiClick("sort-occupancy"));
ok("S1 the occupancy chip clicked", s1.clicked === true);
const sortMid = evalJson('(() => { return JSON.stringify({ sort: localStorage.getItem("cryoflow.classGallerySort.v1") }); })()').sort;
ok("S2 storage echoed the intent BEFORE the state moved (the Task 156 law)", sortMid === "occupancy", `sort=${JSON.stringify(sortMid)}`);
const g5 = evalJson(MEASURE);
ok("S3 the arrangement hid nothing (the same four tiles ride)", g5.tileCount === clsApi.classes.length);
evalJson(uiClick("sort-class"));
const sortBack = evalJson('(() => { return JSON.stringify({ sort: localStorage.getItem("cryoflow.classGallerySort.v1") }); })()').sort;
ok("S4 the sort key returned to the chip's other face", sortBack === "class", `sort=${JSON.stringify(sortBack)}`);
/* the ride un-owns the key it introduced: absence when the boot was
 * canonical, the user's own value back when they chose occupancy — the
 * chip click is the app's only write path, but the ride's clicks are the
 * ride's, and the ride returns what it found */
if (sortKeyBefore === null || sortKeyBefore === undefined) {
  evalJson('(() => { localStorage.removeItem("cryoflow.classGallerySort.v1"); return "un-owned"; })()');
} else {
  evalJson('(() => { localStorage.setItem("cryoflow.classGallerySort.v1", ' + JSON.stringify(sortKeyBefore) + '); return "restored"; })()');
}

/* ---------- Face W: the un-mutation ---------- */
console.log("Un-mutation — DELETE /api/jobs/:id (the app's own cascade, the edge swept)");
evalJson(ESC_LAST);
sleep(1.5);
const del = await api("DELETE", `/api/jobs/${probeId}`);
ok("W1 the probe deleted through the same door", del.status === 200 || del.status === 204, `status=${del.status}`);
const jobsAfterDel = await roster();
const edgesAfterDel = await edgesOf();
ok("W2 the roster returned bit-for-bit", jobsAfterDel.length === J0, `jobs=${jobsAfterDel.length} (opening ${J0})`);
ok("W3 the edges returned bit-for-bit (the cascade swept the wire)", edgesAfterDel.length === E0, `edges=${edgesAfterDel.length} (opening ${E0})`);
/* the ride un-owns its own gestures: the plain door's selection seeded
 * the world (the t157 echo — the app spoke honestly, the ride chose the
 * job), so the ride clears the seed BEFORE the fresh load — the same
 * ownership law Face 0 already practices */
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "un-owned"; })()');
ab("open http://localhost:3000");
sleep(3);
const w1 = settle("the restored canvas");
if (corpse(w1, "Face W")) process.exit(1);
ok("W4 the world unharmed (canvas count == the opening count, zero unnamed)", w1.pageBtns === OPEN && w1.pageUnnamed === 0 && !w1.hasDlg, `btns=${w1.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok("W5 the ride leaves no session seed (the t157 two-way door's honest none)", seedAfter.seed === "" || seedAfter.seed === null, `seed=${JSON.stringify(seedAfter.seed)}`);
const sortKeyAfter = evalJson('(() => { return JSON.stringify({ sort: localStorage.getItem("cryoflow.classGallerySort.v1") }); })()').sort;
ok("W6 the sort preference returned to its opening value (the ride owns nothing)", sortKeyAfter === sortKeyBefore, `sort ${JSON.stringify(sortKeyBefore)} -> ${JSON.stringify(sortKeyAfter)}`);
/* the panel's persisted tab: the ride's Params click wrote "params" —
 * restore the opening value (or the absence the world booted with) */
evalJson('(() => { const was = ' + JSON.stringify(panelTabBefore) + '; if (was === null || was === undefined) { localStorage.removeItem("cryoflow.panelTab.v1"); } else { localStorage.setItem("cryoflow.panelTab.v1", was); } return "restored"; })()');
const panelTabAfter = evalJson('(() => { return JSON.stringify({ tab: localStorage.getItem("cryoflow.panelTab.v1") }); })()').tab;
ok("W7 the panel's persisted tab returned to its opening value", panelTabAfter === panelTabBefore, `tab ${JSON.stringify(panelTabBefore)} -> ${JSON.stringify(panelTabAfter)}`);

/* ---------- the ledger at birth (three faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  pickerArrival: ledgerFace(prevFaces ? prevFaces.pickerArrival?.live ?? null : null, g2, scalarOf),
  gallery3d: ledgerFace(prevFaces ? prevFaces.gallery3d?.live ?? null : null, g4, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f, RECEIPT_REVISION);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the class3d picker's face holds through the world's own sanctioned mutation ride: the probe rode the t708 doors in and out (POST 201 -> the idle card -> the plain door -> the panel; DELETE -> the cascade swept the wire), the roster and the edges returned bit-for-bit (${J0} == ${J0}, ${E0} == ${E0}), the canvas ${OPEN} == ${OPEN}; the gallery spoke the 3D kind at every mouth (the mono word class3d, the pours seat's testid and sr-only word, the named listbox), the four tiles carried the classes API's own arithmetic in their names and every image REALLY decoded, the auto arithmetic kept all four (0.5 x 24 = 12 < 24), the click dialect rode the world's own debounced write path (auto -> 1,3,4 -> 1,2,3,4 -> auto), the zoom lightbox opened above the panel and Escape closed it, the sort arrangement echoed intent to storage and returned the opening value, zero unnamed on every face, two settled rides bit-identical, no seed left — the ledger aboard from birth (three faces, arm 1)`
  : `${fail} red — the picker layer moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: cmp.prev?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t873-class3d-picker.mjs",
  instrumentRevision: RECEIPT_REVISION,
  ruler: NAMEOF_LAW,
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> APIs' truth (roster/edges/classes) -> CREATE (POST /api/jobs) -> WIRE (POST /api/edges, particles -> particles) -> plain door -> PANEL -> the gallery's 3D face -> auto arithmetic -> click dialect (the debounced save) -> zoom lightbox -> sort arrangement -> DELETE -> worldBack + sort-key hygiene (one command)",
  doors: {
    create: `POST /api/jobs { type: select2d, far-corner parked } — the t708 write door`,
    wire: `POST /api/edges { class3d particles -> probe particles } — the adopt flow's kind-scan grammar`,
    panel: "plain pointerdown+pointerup on the idle card — the t863 law",
    unmutate: `DELETE /api/jobs/${probeId ?? "??"} — the app's own cascade (tombstone + edge sweep)`,
  },
  source: { name: c3d.name, id: c3d.id, classesApi: { classes: clsApi.classes, total: clsApi.total, iteration: clsApi.iteration, classesFile: clsApi.classesFile, volumeFiles: clsApi.volumeFiles } },
  probe: { id: probeId, name: PROBE_NAME, type: "select2d", wired: "particles -> particles" },
  openingCanvas: OPEN,
  sortKey: { before: sortKeyBefore, after: sortKeyAfter },
  faces: {
    pickerArrival: { live: g2 },
    gallery3d: { live: g4 },
    worldBack: { live: w1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2));

console.log(`\nCLASS3D-PICKER t873: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
