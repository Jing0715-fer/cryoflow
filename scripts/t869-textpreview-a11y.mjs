#!/usr/bin/env node
/**
 * t869 — the a11y rotation's next surface: the TEXT-PREVIEW face — the
 * results-view room trio's third (star table t866, quick-look t867, THIS
 * page t869), and the second family's seats (the t832 law closes its gap).
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> results family (t865) -> star
 * table (t866) -> quick-look (t867) -> the seed's phantom (t868) -> THIS
 * page (t869).
 *
 * The surface (two families, one brain — the TextPreview of t779):
 *
 *   O0  the clean room — the t866 law: the session seed cleared, the
 *       panel-closed boot demanded. The instrument owns its conditions.
 *   LT  the logs face — the "Logs & reports" section present and named,
 *       its text rows named (the textContent IS the name), the paper
 *       contract (data-print-keep) aboard, zero unnamed.
 *   TP  the preview dialog — the heading = the file's own name (read
 *       from the data, never pinned), the tail contract line ("last
 *       64 KB"), the region named with its keyboard door (tabIndex 0 —
 *       the t812 law), the FOCUS LANDS in the region (the t774 law:
 *       reachability IS the destination), the copy door named (Task
 *       170's one clipboard), the t832 keymap seat aboard, zero unnamed,
 *       two settled rides bit-identical.
 *   EF  the empty-file world — run.err is 0 bytes: the honest empty (the
 *       pre arrives EMPTY, the focus still lands, no false wound, no
 *       lie), Esc closes.
 *   FI  the inspector Files tab — the second family: the Preview doors
 *       named ("Preview run.out"), the peek dialog topmost, the same
 *       focus law, and the t869 SEATS ABOARD (the fix measured live:
 *       text-keymap + star-keymap now ride the inspector's peek dialogs
 *       — the must-not-lie law's second-family turn), Esc closes both.
 *   W   the world back — fresh load, the canvas bit-for-bit, and the W2
 *       seed hygiene (the t866 lesson rides every page).
 *
 * Born with the ledger aboard (the t861 birthright): FIVE faces through
 * the shared helper — logsFace / previewFace / emptyFace / filesFace /
 * worldBack.
 *
 * Receipt: shots-qa/t869-textpreview-a11y.json.
 *
 *   node scripts/t869-textpreview-a11y.mjs
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
const cmp = loadComparator(ROOT, "shots-qa/t869-textpreview-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t869 textpreview a11y walk — world ${world.mode}:${buildId}, the logs face, the preview dialog, the empty world, the Files-tab family and the world back through the shared ruler\n` +
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
/* the outputs listing — the preview dialog's title is the textFile's own
 * `name` (results-view.tsx / job-inspector.tsx), so the heading assertion
 * reads the DATA, never a pinned string (measured, not pinned). */
const outputs = async (id) => {
  const r = await fetch(`${BASE}/api/jobs/${id}/outputs`, { headers: SH });
  const b = await r.json();
  return b.files ?? b;
};

/* ---------- the measure: the SHARED RULER + the text-preview family's
 * probes. ONE superset measure — every face films the same fields; the
 * absent selectors speak false/0 (within-face stability is what the
 * rides diff). NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const inTree = (e) => e.getAttribute("aria-hidden") !== "true" && !e.hidden && !(e.closest && e.closest("[aria-hidden=true]")); const btns = Array.from(document.querySelectorAll("button")).filter(inTree); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")).filter(inTree); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 48) : null; const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart| file)?…$/.test((e.textContent || "").trim())); const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); const actTabEl = dlgTop ? dlgTop.querySelector("[role=tab][data-state=active]") : document.querySelector("[role=tab][data-state=active]"); const logsSec = document.querySelector(\'section[aria-label="Logs and reports"]\'); const logRows = logsSec ? Array.from(logsSec.querySelectorAll("button")) : []; const pre = dlgTop ? dlgTop.querySelector("pre") : null; const descEl = dlgTop ? dlgTop.querySelector("[data-slot=dialog-description]") : null; const copyBtn = dlgTop ? Array.from(dlgTop.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Copy" || (b.textContent || "").trim().startsWith("Copy")) : null; const previewDoors = dlgTop ? Array.from(dlgTop.querySelectorAll("button")).map((b) => b.getAttribute("aria-label") || "").filter((n) => n.startsWith("Preview ")) : []; const errStrip = dlgTop ? !!dlgTop.querySelector("[data-text-error]") : false; const retryChip = dlgTop ? !!dlgTop.querySelector("[data-text-error-retry]") : false; const loadingStatus = dlgTop ? !!dlgTop.querySelector(\'[role=status]\') : false; return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgCount: dgs.length, dlgHeadTop: headOf(dlgTop), shimmer: leaves.length, actTab: actTabEl ? (actTabEl.textContent || "").trim().slice(0, 12) : null, logsSection: !!logsSec, logsRows: logRows.map((r) => ({ n: (r.textContent || "").trim().slice(0, 28), print: r.hasAttribute("data-print-keep") })), preLabel: pre ? pre.getAttribute("aria-label") : null, preTabindex: pre ? pre.getAttribute("tabindex") : null, preFocus: pre ? document.activeElement === pre : false, preLen: pre ? (pre.textContent || "").length : null, descText: descEl ? (descEl.textContent || "").trim().slice(0, 64) : null, copyNamed: copyBtn ? ((copyBtn.getAttribute("aria-label") || "") === "Copy" || (copyBtn.textContent || "").trim().startsWith("Copy")) : false, textKeymap: dlgTop ? !!dlgTop.querySelector("[data-canvas-ui=text-keymap]") : false, starKeymap: dlgTop ? !!dlgTop.querySelector("[data-canvas-ui=star-keymap]") : false, previewDoors: previewDoors.slice(0, 8), errStrip: errStrip, retryChip: retryChip, loadingStatus: loadingStatus }); })()';

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
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); } return "esc"; })()';
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
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

/* the inspector tab's MOUSEDOWN door (t863's teaching: Radix Tabs switch
 * on mousedown — a .click() dispatch is silently ignored). */
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '" || (e.textContent || "").trim().startsWith("' + name + '")); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); t.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 })); t.click(); return JSON.stringify({ found: true }); })()';

/* the logs face's own door: the text row whose name carries the file */
const logsRowDoor = (name) =>
  '(() => { const sec = document.querySelector(\'section[aria-label="Logs and reports"]\'); if (!sec) return JSON.stringify({ clicked: false, why: "no logs section" }); const row = Array.from(sec.querySelectorAll("button")).find((r) => (r.textContent || "").includes("' + name + '")); if (!row) return JSON.stringify({ clicked: false, why: "no row named ' + name + '" }); row.click(); return JSON.stringify({ clicked: true }); })()';

/* the Files tab's Preview door, found by its aria-label. */
const previewDoor = (label) =>
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = d && Array.from(d.querySelectorAll("button")).find((x) => x.getAttribute("aria-label") === "Preview ' + label + '"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

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
const host = jobs.find((j) => j.type === "ctffind" && j.status === "completed");
if (!host) {
  console.error("no completed ctffind in the roster — the logs face cannot open");
  writeFileSync(join(ROOT, "shots-qa/t869-textpreview-a11y.json"), JSON.stringify({ instrument: "scripts/t869-textpreview-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail, total: pass + fail, verdict: "host absent — the roster does not speak the face's own data", faces: null }, null, 2));
  process.exit(1);
}
console.log(`  host (measured): ${host.name}`);
const outs = await outputs(host.id);
const fileArr = Array.isArray(outs) ? outs : [];
const textFiles = fileArr.filter((f) => f.kind === "text");
const tailFile = textFiles.find((f) => f.name === "run.out");
const emptyFile = textFiles.find((f) => (f.size ?? 1) === 0);
const starFileData = fileArr.find((f) => (f.path || "").endsWith(".star"));
if (!tailFile || !emptyFile || !starFileData) {
  console.error(`host lacks the face's data: text=${textFiles.length} tail=${!!tailFile} empty=${!!emptyFile} star=${!!starFileData}`);
  process.exit(1);
}
console.log(`  data: tail="${tailFile.name}" (${tailFile.size}B) empty="${emptyFile.name}" (${emptyFile.size}B) star="${starFileData.label ?? starFileData.name}"`);

/* ---------- Face LT — the logs face ---------- */
console.log("Face LT — the inspector, the Results tab, the Logs & reports section");
const c1 = evalJson(plainClick(host.id));
ok("L1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
const w1 = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
ok("L2 the inspector arrived (a dialog aboard)", w1.hasDlg === true, `dlgCount=${w1.dlgCount}`);
const tab1 = evalJson(tabMouseDown("Results"));
ok("L3 the Results tab switched through the MOUSEDOWN door (the t863 Radix law)", tab1.found === true);
const lArr = waitFor("the logs section (the outputs listing compiles)", (m) => m.logsSection === true && m.logsRows.length >= 2, 40);
if (corpse(lArr, "Face LT")) process.exit(1);
const l1 = settle("the logs face (the lazy barrel's own quiescence)", 30);
ok("L4 the Logs-and-reports section is present and named", l1.logsSection === true);
ok("L5 the text rows are named by their own text, the paper contract aboard",
  l1.logsRows.length >= 2 && l1.logsRows.every((r) => r.n.length > 0 && r.print === true),
  `rows=${JSON.stringify(l1.logsRows)}`);
ok("L6 zero unnamed page-wide WITH the inspector up (the census's invariant)",
  censusOk(l1),
  `btns=${l1.pageBtns} ctrls=${l1.ctrls}`);
const l1s = settle("the logs face (second ride)");
ok("L7 two settled rides bit-identical (the t836 law, the t860 settle)",
  JSON.stringify(l1) === JSON.stringify(l1s),
  diffKeys(l1, l1s).length === 0 ? "bit-for-bit" : `moved: ${diffKeys(l1, l1s).join(", ")}`);

/* ---------- Face TP — the preview dialog ---------- */
console.log("Face TP — the tail preview through the run.out row");
const d0 = evalJson(logsRowDoor("run.out"));
ok("T1 the run.out row's door clicked", d0.clicked === true);
const tArr = waitFor("the preview dialog (the tail fetch walks the file)", (m) => m.dlgCount >= 2 && m.preLabel === "File content preview", 30);
if (corpse(tArr, "Face TP")) process.exit(1);
/* the arrival waited for arrival; the checks read the SETTLED dialog */
const q1 = settle("the preview (its own quiescence)", 30);
ok("T2 the dialog arrived as the TOPMOST layer, heading = the file's own name (from the data)",
  q1.dlgCount >= 2 && q1.dlgHeadTop === tailFile.name,
  `head="${q1.dlgHeadTop}" == data "${tailFile.name}"`);
ok("T3 the tail contract speaks its line (path · last 64 KB)",
  (q1.descText || "").includes("last 64 KB"),
  `desc="${q1.descText}"`);
ok("T4 the region is named with its keyboard door (the house dialect)",
  q1.preLabel === "File content preview" && q1.preTabindex === "0");
ok("T5 the FOCUS LANDS in the region (the t774 law — reachability IS the destination)",
  q1.preFocus === true,
  `activeElement is the pre`);
ok("T6 the copy door is aboard, named (Task 170's one clipboard)", q1.copyNamed === true);
ok("T7 the t832 keymap seat is aboard (text-keymap)", q1.textKeymap === true);
ok("T8 zero unnamed page-wide WITH the preview up (the census's invariant)",
  censusOk(q1) && q1.errStrip === false && q1.retryChip === false,
  `btns=${q1.pageBtns} ctrls=${q1.ctrls} errStrip=${q1.errStrip}`);
const q1b = settle("the preview (second ride)", 34);
ok("T9 two settled rides bit-identical (the t836 law)",
  JSON.stringify(q1) === JSON.stringify(q1b),
  diffKeys(q1, q1b).length === 0 ? "bit-for-bit" : `moved: ${diffKeys(q1, q1b).join(", ")}`);

/* ---------- Face EF — the empty-file world ---------- */
console.log("Face EF — the honest empty (run.err, 0 bytes)");
const e0 = evalJson(ESC_LAST);
sleep(1.5);
const e1 = evalJson(logsRowDoor("run.err"));
ok("E1 the empty file's row clicked (the preview reopened on run.err)", e1.clicked === true);
const eArr = waitFor("the empty preview", (m) => m.dlgCount >= 2 && m.preLabel === "File content preview", 30);
const ef1 = settle("the empty world (its own quiescence)", 30);
ok("E2 the heading is the empty file's own name, the region arrives EMPTY and honest",
  eArr.dlgCount >= 2 && ef1.dlgHeadTop === emptyFile.name && ef1.preLen === 0,
  `head="${ef1.dlgHeadTop}" preLen=${ef1.preLen} (data: ${emptyFile.size}B)`);
ok("E3 the focus still lands in the empty region (the t774 law holds for nothing, too)",
  ef1.preFocus === true);
ok("E4 no false wound and no lie (no error strip, the copy door present, zero unnamed)",
  ef1.errStrip === false && ef1.copyNamed === true && censusOk(ef1),
  `btns=${ef1.pageBtns} ctrls=${ef1.ctrls}`);
const eEsc = evalJson(ESC_LAST);
sleep(1.5);
const eGone = evalJson(MEASURE);
ok("E5 Esc closed the empty world (the keymap's own teaching, delivered)", eGone.dlgCount === 1);

/* ---------- Face FI — the inspector Files tab (the second family) ---------- */
console.log("Face FI — the Files tab's Preview doors, the t869 seats measured live");
const f1 = evalJson(tabMouseDown("Files"));
ok("F1 the Files tab switched through the MOUSEDOWN door", f1.found === true);
const fArr = waitFor("the Files tab (the listing compiles)", (m) => m.previewDoors.length >= 2, 30);
ok("F2 the Preview doors are aboard, each named (Preview <file>)",
  fArr.previewDoors.length >= 2 && fArr.previewDoors.every((n) => n.startsWith("Preview ")),
  `doors=${JSON.stringify(fArr.previewDoors)}`);
const f2 = evalJson(previewDoor("run.out"));
ok("F3 the run.out Preview door clicked", f2.clicked === true);
const fPeek = waitFor("the peek dialog", (m) => m.dlgCount >= 2 && m.preLabel === "File content preview", 30);
const fi1 = settle("the Files-tab peek (its own quiescence)", 30);
ok("F4 the peek arrived TOPMOST, heading = the file's name (from the data)",
  fi1.dlgCount >= 2 && fi1.dlgHeadTop === tailFile.name,
  `head="${fi1.dlgHeadTop}"`);
ok("F5 the focus lands in the peek's region (the same brain, the same law)", fi1.preFocus === true);
ok("F6 the t869 SEAT IS ABOARD (text-keymap in the inspector's peek — the fix, measured live)",
  fi1.textKeymap === true);
ok("F7 zero unnamed page-wide WITH the peek up (the census's invariant)",
  censusOk(fi1) && fi1.errStrip === false,
  `btns=${fi1.pageBtns} ctrls=${fi1.ctrls}`);
evalJson(ESC_LAST);
sleep(1.5);
const f3 = evalJson(previewDoor(starFileData.name));
ok("F8 the star peek's door clicked (the label ?? name from the data)", f3.clicked === true, `label="${starFileData.label ?? starFileData.name}"`);
const sPeek = waitFor("the star peek", (m) => m.dlgCount >= 2 && m.starKeymap === true, 30);
const fi2 = settle("the star peek (its own quiescence)", 30);
ok("F9 the star peek is aboard with its t869 SEAT (star-keymap — the fix, measured live)",
  fi2.dlgCount >= 2 && fi2.starKeymap === true);
ok("F10 the star peek keeps the census's invariant",
  censusOk(fi2),
  `btns=${fi2.pageBtns} ctrls=${fi2.ctrls}`);
const fEsc = escAll();
ok("F11 the whole inspector world closed honestly (all dialogs dismissed)", fEsc !== -1, `escapes=${fEsc}`);

/* ---------- Face W — the world back + the seed hygiene ---------- */
console.log("Face W — the world back (fresh load, sleep 3)");
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

/* ---------- the ledger at birth (five faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (five faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  logsFace: ledgerFace(prevFaces ? prevFaces.logsFace?.live ?? null : null, l1, scalarOf),
  previewFace: ledgerFace(prevFaces ? prevFaces.previewFace?.live ?? null : null, q1, scalarOf),
  emptyFace: ledgerFace(prevFaces ? prevFaces.emptyFace?.live ?? null : null, ef1, scalarOf),
  filesFace: ledgerFace(prevFaces ? prevFaces.filesFace?.live ?? null : null, fi1, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w3, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the text-preview face holds: the clean room held (the panel-closed boot — the t866 law), the logs face hosted ${l1.logsRows.length} named text rows under the paper contract, the tail preview arrived TOPMOST with its heading read from the data and the focus landing in the named region (the t774 law), the empty file's world stayed honest (0 bytes, focus still lands, no false wound), the Files tab's second family rode the same brain WITH the t869 seats aboard (text-keymap + star-keymap measured live), and the world came back bit-for-bit`
  : `${fail} red — the text-preview layer moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t869-textpreview-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> canvas -> ctffind card (plain door) -> Results tab (mousedown) -> Logs & reports rows -> run.out preview (focus lands) -> Esc -> run.err empty world (the honest empty) -> Files tab (mousedown) -> Preview doors -> text peek (t869 seat) -> star peek (t869 seat) -> Esc all -> world back",
  doors: {
    inspector: "plain pointerdown+pointerup on the card — the submitted law",
    resultsTab: "mousedown on the Results tab — the t863 Radix law",
    preview: "click the text row — the textContent IS the name",
    filesTab: "mousedown on the Files tab — the t863 Radix law",
    peek: "click the Preview <file> door — aria-label names it",
    close: "Escape — the keymap seats' own teaching",
  },
  host: { name: host.name, id: host.id, measured: true },
  data: {
    tail: { name: tailFile.name, size: tailFile.size },
    empty: { name: emptyFile.name, size: emptyFile.size },
    star: { name: starFileData.label ?? starFileData.name },
  },
  openingCanvas: OPEN,
  faces: {
    logsFace: { live: l1, secondRide: l1s },
    previewFace: { live: q1, secondRide: q1b },
    emptyFace: { live: ef1 },
    filesFace: { live: fi1, starPeek: fi2 },
    worldBack: { live: w3 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t869-textpreview-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nTEXTPREVIEW-A11Y t869: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
