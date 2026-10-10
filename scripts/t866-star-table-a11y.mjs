#!/usr/bin/env node
/**
 * t866 — the a11y rotation's next surface: the STAR TABLE — the results
 * family's own remaining room, walked live with the SHARED RULER (zero src).
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> results family (t865) -> THIS
 * page (t866).
 *
 * The surface (the inspector's Results tab hosts the STAR tables section —
 * one section, one door per .star output; the door opens the STAR table
 * DIALOG — a nested portal above the inspector, the t865 topmost-layer
 * lesson applies at birth):
 *
 *   O   the clean room — the t866 law born of the seed incident: the
 *       session-position seed (t157) makes the boot state ride-dependent,
 *       so Face 0 clears the seed, reloads, and DEMANDS the panel-closed
 *       boot. The instrument owns its measurement conditions.
 *   EXT the extract inspector — the card's PLAIN door (completed opens
 *       the inspector), the Results tab through the MOUSEDOWN door (the
 *       t863 Radix law), the STAR tables section present and named, the
 *       file doors measured (name carries file + rows + size — the text
 *       IS the name).
 *   ST  the STAR table dialog — the TOPMOST layer's heading (the file
 *       label) + the path description; the region named with its
 *       keyboard door (tabIndex 0 — the t812 grounded-verdict law); the
 *       sortable column headers measured (the name, the aria-sort
 *       state); the t832 keymap seat aboard (star-keymap); zero unnamed
 *       page-wide.
 *   SC  the sort cycle — one header clicked three times: ascending ->
 *       descending -> the file's native order (aria-sort undefined).
 *       The state machine read LIVE, never pinned.
 *   W   the world back — fresh load, the canvas count bit-for-bit, AND
 *       the seed hygiene (W2): the ride leaves no session seed behind.
 *
 * Born with the ledger aboard (the t861 birthright): THREE faces through
 * the shared helper — starDoor / starDialog / worldBack — the receipt's
 * top-level `faces` block carries the RAW measures, the ledger diffs
 * prev.faces.<name>.live.
 *
 * The settle law (the t864/t865 generalization): settled = the lazy
 * barrel's OWN quiescence door SILENT (no "Loading…" leaf) AND the
 * images' own contract (img.complete) AND two consecutive measures equal.
 *
 * Receipt: shots-qa/t866-star-table-a11y.json.
 *
 *   node scripts/t866-star-table-a11y.mjs
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
const cmp = loadComparator(ROOT, "shots-qa/t866-star-table-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t866 star-table a11y walk — world ${world.mode}:${buildId}, the STAR tables section and its dialog through the shared ruler\n` +
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

/* ---------- the measure: the SHARED RULER + the star family's probes.
 * ONE superset measure — every face films the same fields; the absent
 * selectors speak false/0 (within-face stability is what the rides diff).
 * NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null; const dlgHeadTop = headOf(dlgTop); const dlgCount = dgs.length; const act = document.activeElement; const actTabEl = dlgTop ? dlgTop.querySelector("[role=tab][data-state=active]") : document.querySelector("[role=tab][data-state=active]"); const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())); const sec = document.querySelector(\'section[aria-label="STAR tables"]\'); const secBtns = sec ? Array.from(sec.querySelectorAll("button")) : []; const region = dlgTop ? dlgTop.querySelector("[role=region]") : null; const sortThs = dlgTop ? Array.from(dlgTop.querySelectorAll("thead th")).slice(1) : []; const sortCols = sortThs.map((th) => ({ n: ((th.querySelector("button") || th).textContent || "").trim().slice(0, 20), s: th.getAttribute("aria-sort") })); const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgHeadTop: dlgHeadTop, dlgCount: dlgCount, act: act ? (dgs.length && dlgTop.contains(act) ? "in-dialog" : act.tagName) : null, actTab: actTabEl ? (actTabEl.textContent || "").trim().slice(0, 12) : null, shimmer: leaves.length, starSection: !!sec, starDoors: secBtns.length, starDoorNamed: secBtns.every((b) => ((b.textContent || "").trim().length > 0)), starDoorRows: secBtns.map((b) => { const m = (b.textContent || "").match(/([\\d,]+) rows/); return m ? Number(m[1].replace(/,/g, "")) : null; }), starDesc: dlgTop ? ((dlgTop.querySelector("[class*=font-mono]") || {}).textContent || "").trim().slice(0, 50) : null, regionNamed: region ? !!(region.getAttribute("aria-label") || "").startsWith("Star table") : false, regionLabel: region ? (region.getAttribute("aria-label") || "").slice(0, 50) : null, regionTabindex: region ? region.getAttribute("tabindex") : null, sortCols: sortCols, keymap: dlgTop ? !!dlgTop.querySelector("[data-canvas-ui=star-keymap]") : false }); })()';

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
const waitFor = (what, probe, maxSecs = 24) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

/* the OOM corpse guard (the t859/t861/t864/t865 pattern): an eval filming
 * a dead server returns ZEROS — say so, stop honestly. */
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

/* the STAR file door: the section's Nth button (the file order is the
 * outputs list's order — measured, never pinned). */
const starDoor = (n) =>
  '(() => { const sec = document.querySelector("section[aria-label=\\"STAR tables\\"]"); if (!sec) return JSON.stringify({ clicked: false }); const b = sec.querySelectorAll("button")[' + n + ']; if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

/* the sort cycle: the dialog's first column header button, Nth click. */
const sortClick =
  '(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const b = d && d.querySelector("thead button"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

/* the zero-unnamed census invariant, one voice everywhere */
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- Face 0: the clean room + the calm canvas ---------- */
console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
/* t866 — the CLEAN-ROOM law: the session-position seed (t157) makes the
 * boot state ride-dependent (the seed incident: a seed left by an earlier
 * ride re-opened the side panel AND booted a one-card selection, flipping
 * the pair toggle's second click from JOIN to REMOVE). The instrument
 * owns its measurement conditions: clear the seed, reload, demand the
 * panel-closed boot. The world's session position is the user's, not
 * the film's. */
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

/* ---------- the roster: the STAR host, measured never pinned ---------- */
const jobs = await roster();
const host = jobs.find((j) => j.type === "extract" && j.status === "completed");
if (!host) {
  console.error("no completed extract job in the roster — the STAR tables section cannot open");
  writeFileSync(join(ROOT, "shots-qa/t866-star-table-a11y.json"), JSON.stringify({ instrument: "scripts/t866-star-table-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no completed extract — the ride stopped honestly before the STAR tables" }, null, 2));
  process.exit(1);
}
console.log(`  host (measured, not pinned): ${host.name} (${host.id.slice(0, 12)})`);

/* ---------- Face EXT — the extract inspector + the STAR tables section ---------- */
console.log("Face EXT — the extract inspector through the plain door, the Results tab, the STAR tables section");
const c1 = evalJson(plainClick(host.id));
ok("E1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
const w = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
ok("E2 the inspector arrived (a dialog aboard)", w.hasDlg === true, `dlgCount=${w.dlgCount}`);
const tab1 = evalJson(tabMouseDown("Results"));
ok("E3 the Results tab switched through the MOUSEDOWN door (the t863 Radix law)", tab1.found === true);
const s1 = settle("the Results tab (the lazy barrel compiles)");
if (corpse(s1, "Face EXT")) process.exit(1);
ok("E4 the active tab speaks Results", s1.actTab === "Results", `actTab=${s1.actTab}`);
ok("E5 the STAR tables section is present and named", s1.starSection === true);
ok("E6 the section hosts file doors, each named (the text IS the name: file + rows + size)",
  s1.starDoors >= 1 && s1.starDoorNamed === true,
  `doors=${s1.starDoors} rows=${JSON.stringify(s1.starDoorRows)}`);
ok("E7 zero unnamed page-wide WITH the inspector up (the census's invariant)",
  censusOk(s1),
  `btns=${s1.pageBtns} ctrls=${s1.ctrls}`);

/* ---------- Face ST — the STAR table dialog (the nested portal) ---------- */
console.log("Face ST — the STAR table dialog through the section's first door");
const d0 = evalJson(starDoor(0));
ok("S1 the first star door clicked", d0.clicked === true);
const s2 = settle("the star dialog (the table fetch)");
if (corpse(s2, "Face ST")) process.exit(1);
ok("S2 the dialog arrived as the TOPMOST layer (the t865 nested-portal lesson)",
  s2.hasDlg === true && s2.dlgCount >= 2,
  `dlgCount=${s2.dlgCount}`);
ok("S3 the dialog's heading is the file label, read from the TOPMOST layer",
  (s2.dlgHeadTop || "").endsWith(".star"),
  `head="${s2.dlgHeadTop}"`);
ok("S4 the region is named (the t812 grounded-verdict law's own label)",
  s2.regionNamed === true,
  `label="${s2.regionLabel}"`);
ok("S5 the region keeps its keyboard door (tabIndex 0 — the ground is focusable)",
  s2.regionTabindex === "0",
  `tabindex=${s2.regionTabindex}`);
ok("S6 the sortable columns are aboard, each with a name",
  s2.sortCols.length >= 1 && s2.sortCols.every((c) => c.n.length > 0),
  `cols=${JSON.stringify(s2.sortCols.map((c) => c.n))}`);
ok("S7 the t832 keymap seat is aboard (star-keymap — the family's one-key teaching)",
  s2.keymap === true);
ok("S8 zero unnamed page-wide WITH the star dialog up (the census's invariant)",
  censusOk(s2),
  `btns=${s2.pageBtns} ctrls=${s2.ctrls}`);
const s2b = settle("the star dialog (second ride)");
ok("S9 two settled rides bit-identical (the t836 law, the t860 settle)",
  JSON.stringify(s2) === JSON.stringify(s2b));

/* ---------- Face SC — the sort cycle, read live ---------- */
console.log("Face SC — the aria-sort state machine: ascending -> descending -> native");
evalJson(sortClick);
sleep(1);
const sc1 = evalJson(MEASURE);
const st1 = sc1.sortCols[0] ? sc1.sortCols[0].s : null;
ok("C1 the first click sorts ascending", st1 === "ascending", `aria-sort=${st1}`);
evalJson(sortClick);
sleep(1);
const sc2 = evalJson(MEASURE);
const st2 = sc2.sortCols[0] ? sc2.sortCols[0].s : null;
ok("C2 the second click sorts descending", st2 === "descending", `aria-sort=${st2}`);
evalJson(sortClick);
sleep(1);
const sc3 = evalJson(MEASURE);
const st3 = sc3.sortCols[0] ? sc3.sortCols[0].s : null;
ok("C3 the third click returns to the file's native order (aria-sort undefined)",
  st3 === null, `aria-sort=${st3}`);
ok("C4 the cycle left zero unnamed behind (the census's invariant on the sorted table)",
  censusOk(sc3));

/* ---------- the close: the keymap's own teaching ---------- */
evalJson(ESC_LAST);
sleep(1.5);
const s4 = evalJson(MEASURE);
ok("S10 Escape closed the star dialog (the keymap seat's own teaching, delivered)",
  s4.dlgCount === s2.dlgCount - 1,
  `dlgCount ${s2.dlgCount} -> ${s4.dlgCount}`);
ok("S11 the inspector remains, zero unnamed (the census's invariant after the close)",
  s4.hasDlg === true && censusOk(s4));

/* ---------- Face W — the world back + the seed hygiene ---------- */
console.log("Face W — the world back (fresh load, sleep 3)");
evalJson(ESC_LAST);
sleep(1);
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

/* ---------- the ledger at birth (three faces: starDoor / starDialog / worldBack) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  starDoor: ledgerFace(prevFaces ? prevFaces.starDoor?.live ?? null : null, s1, scalarOf),
  starDialog: ledgerFace(prevFaces ? prevFaces.starDialog?.live ?? null : null, s2, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the STAR table's page holds: the clean room held (the panel-closed boot — the t866 law), the extract inspector's Results tab hosts the STAR tables section with ${s1.starDoors} named file doors, the dialog arrived as the TOPMOST layer with the file's label, the region named with its keyboard door (tabIndex 0), ${s2.sortCols.length} sortable columns rode the aria-sort machine ascending -> descending -> native, the t832 keymap seat taught its one key, zero unnamed on every face, two settled rides bit-identical, the world back bit-for-bit (${OPEN} == ${OPEN}), and the ride left no session seed — the ledger aboard from birth (three faces, the shared law)`
  : `${fail} red — the star-table layer moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t866-star-table-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> canvas -> extract card (plain door) -> Results tab (mousedown) -> STAR tables section -> star door -> star dialog (topmost) -> sort cycle -> Escape -> worldBack + seed hygiene (one command)",
  doors: {
    inspector: "plain pointerdown+pointerup on the extract card — the submitted law",
    resultsTab: "mousedown on the Results tab — the t863 Radix law",
    starDialog: "click the section's file door — the text IS the name",
    close: "Escape — the keymap seat's own teaching",
  },
  host: { name: host.name, id: host.id, measured: true },
  openingCanvas: OPEN,
  faces: {
    starDoor: { live: s1 },
    starDialog: { live: s2, secondRide: s2b, sortCycle: [st1, st2, st3] },
    worldBack: { live: w1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t866-star-table-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nSTAR-TABLE-A11Y t866: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
