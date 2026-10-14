#!/usr/bin/env node
/**
 * t868 — the results-view's THIRD Esc seat: the TEXT PREVIEW face — the
 * room trio's last un-walked room (gallery ✓ t867, star table ✓ t866,
 * text preview ✗ → THIS page), the two walked pages' sibling, walked
 * live with the SHARED RULER (zero src).
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> results family (t865) -> star
 * table (t866) -> quick-look (t867) -> THIS page (t868).
 *
 * The surface (the inspector's Results tab hosts the "Logs and reports"
 * section — text files are BUTTON doors named by their file name, images
 * are download anchors; a text door opens the TEXT PREVIEW dialog: the
 * DialogTitle IS the file's name, the description speaks the 64 KB tail
 * contract, the content is a focusable <pre aria-label="File content
 * preview"> that takes focus when the tail lands, a Copy door rides
 * beside it, and the t831 keymap seat teaches Esc):
 *
 *   O   the clean room — the t866 law (the seed cleared, the panel-closed
 *       boot demanded). The instrument owns its measurement conditions.
 *   L   the logs face — the "Logs and reports" section measured: text
 *       doors present and named by their file name, the section's own
 *       zero-unnamed census, the image rows as honest anchors.
 *   T   the text dialog — the TOPMOST layer: heading = the file's name,
 *       the description's "last 64 KB" contract, the pre's name + keyboard
 *       door (tabIndex 0) + focus steal (the tail lands and the pre takes
 *       focus — the t865 img-complete law's focus analog), the content
 *       landed (length > 0), the scrollable region honest (64 KB > view),
 *       the Copy door named, the keymap seat aboard, zero unnamed
 *       page-wide, two settled rides bit-identical.
 *   K   the keymap's own teaching — Escape peels exactly ONE layer (the
 *       helper's law), the second door re-opens and the heading FOLLOWS
 *       the door (run.out -> run.err), Escape again.
 *   W   the world back — fresh load, the canvas count bit-for-bit, AND
 *       the seed hygiene (W2): the ride leaves no session seed behind.
 *
 * The settle law's own growth: the loading leaf is "Loading file…" — the
 * family's shimmer door (/^Loading( chart)?…$/) was blind to it (the
 * scout's honest note); THIS measure extends the regex to "( chart|
 * file)?" — the lens grows where the world speaks (zero src).
 *
 * Born with the ledger aboard (the t861 birthright): THREE faces through
 * the shared helper — logsSection / textDialog / worldBack — the
 * receipt's top-level `faces` block carries the RAW measures, the ledger
 * diffs prev.faces.<name>.live.
 *
 * Receipt: shots-qa/t868-text-preview-a11y.json.
 *
 *   node scripts/t868-text-preview-a11y.mjs
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
const cmp = loadComparator(ROOT, "shots-qa/t868-text-preview-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t868 text-preview a11y walk — world ${world.mode}:${buildId}, the third Esc seat through the shared ruler\n` +
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

/* ---------- the measure: the SHARED RULER + the text-preview family's probes.
 * ONE superset measure — every face films the same fields; the absent
 * selectors speak false/0 (within-face stability is what the rides diff).
 * NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null; const dlgHeadTop = headOf(dlgTop); const dlgCount = dgs.length; const act = document.activeElement; const actTabEl = dlgTop ? dlgTop.querySelector("[role=tab][data-state=active]") : document.querySelector("[role=tab][data-state=active]"); const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart| file)?…$/.test((e.textContent || "").trim())); const sec = document.querySelector(\'section[aria-label="Logs and reports"]\'); const secBtns = sec ? Array.from(sec.querySelectorAll("button")) : []; const secUn = secBtns.filter((b) => !nameOf(b)); const doorName = (b) => (nameOf(b) || (b.textContent || "")).trim(); const textDoors = secBtns.filter((b) => /\\.(out|err|txt|json|log)/i.test(doorName(b))); const doorNames = textDoors.slice(0, 4).map(doorName); const vocabBad = textDoors.filter((b) => !/^Preview /.test(doorName(b))); const anchors = sec ? Array.from(sec.querySelectorAll("a")) : []; const anchorBad = anchors.filter((a) => !/^Download /.test(nameOf(a) || "")); const pre = dlgTop ? dlgTop.querySelector(\'pre[aria-label="File content preview"]\') : null; const desc = dlgTop ? Array.from(dlgTop.querySelectorAll("*")).find((e) => e.children.length === 0 && /last 64 KB/.test(e.textContent || "")) : null; const copyBtn = dlgTop ? Array.from(dlgTop.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Copy" || (b.textContent || "").trim() === "Copy") : null; const keymapEl = dlgTop ? dlgTop.querySelector("[data-canvas-ui=text-keymap]") : null; const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgHeadTop: dlgHeadTop, dlgCount: dlgCount, act: act ? (dgs.length && dlgTop.contains(act) ? (act.tagName === "PRE" ? "PRE" : "in-dialog") : act.tagName) : null, actTab: actTabEl ? (actTabEl.textContent || "").trim().slice(0, 12) : null, shimmer: leaves.length, logSec: !!sec, logDoors: textDoors.length, doorNames: doorNames, secUnnamed: secUn.length, vocabBad: vocabBad.length, secAnchors: anchors.length, anchorBad: anchorBad.length, prePresent: !!pre, preNamed: pre ? pre.getAttribute("aria-label") : null, preTab: pre ? pre.getAttribute("tabindex") : null, preLen: pre ? (pre.textContent || "").length : 0, preHead: pre ? (pre.textContent || "").trim().slice(0, 40) : null, preScroll: pre ? pre.scrollHeight > pre.clientHeight : false, actPre: !!(pre && act === pre), copyNamed: copyBtn ? (copyBtn.getAttribute("aria-label") || (copyBtn.textContent || "").trim()) : null, keymap: !!keymapEl, keymapTeaches: keymapEl ? /Esc/.test(keymapEl.textContent || "") : false, descText: desc ? (desc.textContent || "").trim().slice(0, 90) : null }); })()';

/* the settle law (t864/t865/t866's shape): bounded, MULTIPLE consecutive
 * equal pairs, the loading leaves' own quiescence door (the extended
 * shimmer regex now sees "Loading file…" too) and the images' contract. */
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
  console.log(`  settled ${what} (${run}x stable)`);
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

/* the text door: the file-name button inside the Logs and reports
 * section — the door's accessible name IS the file's name (the t867
 * click-door shape: a synthetic click speaks the button's activation). */
const textDoor = (fname) =>
  '(() => { const sec = document.querySelector(\'section[aria-label="Logs and reports"]\'); if (!sec) return JSON.stringify({ found: false }); const nm = (x) => (x.getAttribute("aria-label") || (x.textContent || "")).trim(); const b = Array.from(sec.querySelectorAll("button")).find((x) => nm(x) === "Preview ' + fname + '" || nm(x) === "' + fname + '"); if (!b) return JSON.stringify({ found: false, doors: Array.from(sec.querySelectorAll("button")).map(nm).slice(0, 6) }); b.click(); return JSON.stringify({ found: true, door: nm(b) }); })()';

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

/* ---------- the roster: the text host, measured never pinned ---------- */
const jobs = await roster();
const host =
  jobs.find((j) => j.type === "motioncorr" && j.status === "completed") ||
  jobs.find((j) => j.status === "completed");
if (!host) {
  console.error("no completed job in the roster — the Logs section cannot open");
  writeFileSync(join(ROOT, "shots-qa/t868-text-preview-a11y.json"), JSON.stringify({ instrument: "scripts/t868-text-preview-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no completed job — the ride stopped honestly before the logs" }, null, 2));
  process.exit(1);
}
console.log(`  host (measured, not pinned): ${host.name} (${host.id.slice(0, 12)})`);

/* ---------- Face L: the logs face (the Results tab's Logs and reports) ---------- */
console.log("Face L — the host inspector through the plain door, the Results tab, the Logs section");
const c1 = evalJson(plainClick(host.id));
ok("L1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
const w = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
ok("L2 the inspector arrived (a dialog aboard)", w.hasDlg === true, `dlgCount=${w.dlgCount}`);
const tab1 = evalJson(tabMouseDown("Results"));
ok("L3 the Results tab switched through the MOUSEDOWN door (the t863 Radix law)", tab1.found === true);
/* the arrival door first (the t864 false-settle lesson, lived again on the
 * post-OOM cold barrel): the lazy Results tab mounts in waves — the
 * section's ARRIVAL is the predicate, the settle only then measures. */
const lArr = waitFor("the Logs section", (m) => m.logSec === true);
if (!lArr.logSec) {
  console.error("  ✗ the Logs section never arrived — the Results tab's barrel did not land; stopping honestly");
  writeFileSync(join(ROOT, "shots-qa/t868-text-preview-a11y.json"), JSON.stringify({ instrument: "scripts/t868-text-preview-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "the Logs section never arrived (cold barrel) — the ride stopped honestly" }, null, 2));
  process.exit(1);
}
const s1 = settle("the Results tab (the lazy barrel compiles)");
if (corpse(s1, "Face L")) process.exit(1);
ok("L4 the active tab speaks Results", s1.actTab === "Results", `actTab=${s1.actTab}`);
ok("L5 the Logs and reports section is aboard", s1.logSec === true, `logSec=${s1.logSec}`);
ok("L6 the text doors are named by their file name (the name IS the door)",
  s1.logDoors >= 2, `doors=${s1.logDoors} [${(s1.doorNames || []).join(" | ")}]`);
ok("L6b the doors speak the family's word (Preview — the Files tab's own vocabulary, the t868 cure's contract)",
  s1.vocabBad === 0, `vocabBad=${s1.vocabBad}`);
ok("L7 the section's own census: zero unnamed, the anchors speak the Download word",
  s1.secUnnamed === 0 && s1.anchorBad === 0, `secUnnamed=${s1.secUnnamed} anchors=${s1.secAnchors} anchorBad=${s1.anchorBad}`);
ok("L8 zero unnamed page-wide WITH the Results tab up (the census's invariant)",
  censusOk(s1),
  `btns=${s1.pageBtns} ctrls=${s1.ctrls}`);

/* ---------- Face T: the text dialog (the 64 KB tail's face) ---------- */
console.log("Face T — the text dialog through the run.out door");
const d1 = evalJson(textDoor("run.out"));
ok("T1 the run.out door opened the dialog (the family word spoke the door)",
  d1.found === true && d1.door === "Preview run.out", `door="${d1.door || ""}"${d1.doors ? ` — doors: ${JSON.stringify(d1.doors)}` : ""}`);
const t0 = waitFor("the text dialog", (m) => m.dlgCount >= 2 && m.prePresent === true && m.preLen > 0);
const t1 = settle("the text dialog (the tail lands)");
if (corpse(t1, "Face T")) process.exit(1);
ok("T2 the dialog arrived as the TOPMOST layer", t1.dlgCount >= 2, `dlgCount=${t1.dlgCount}`);
ok("T3 the heading is the file's name, read from the TOPMOST layer",
  t1.dlgHeadTop === "run.out", `head="${t1.dlgHeadTop}"`);
ok("T4 the description speaks the tail contract (path · last 64 KB)",
  /last 64 KB/.test(t1.descText || ""), `desc="${t1.descText || ""}"`);
ok("T5 the pre is named and keeps its keyboard door (the t809 house dialect)",
  t1.preNamed === "File content preview" && t1.preTab === "0",
  `label="${t1.preNamed}" tabindex=${t1.preTab}`);
ok("T6 the content landed (the 64 KB tail speaks)", t1.preLen > 0, `preLen=${t1.preLen} head="${(t1.preHead || "").slice(0, 24)}…"`);
ok("T7 the pre took focus when the tail landed (the focus steal — the t865 img-complete law's focus analog)",
  t1.actPre === true, `act=${t1.act}`);
ok("T8 the pre is the honest scrollable region (64 KB outgrows the view)",
  t1.preScroll === true, `preScroll=${t1.preScroll}`);
ok("T9 the Copy door is named", t1.copyNamed === "Copy", `copy="${t1.copyNamed}"`);
ok("T10 the keymap seat teaches Esc (the third seat's own words)",
  t1.keymap === true && t1.keymapTeaches === true);
ok("T11 zero unnamed page-wide WITH the dialog up (the census's invariant)",
  censusOk(t1),
  `btns=${t1.pageBtns} ctrls=${t1.ctrls}`);
const t1b = settle("the text dialog (second ride)");
ok("T12 two settled rides bit-identical (the t836 law, the t860 settle)",
  JSON.stringify(t1) === JSON.stringify(t1b));

/* ---------- the close: the keymap's own teaching ---------- */
evalJson(ESC_LAST);
sleep(1.5);
const k1 = evalJson(MEASURE);
ok("K1 Escape peeled exactly ONE layer (the helper's law), the inspector remains",
  k1.dlgCount === t1.dlgCount - 1 && k1.hasDlg === true,
  `dlgCount ${t1.dlgCount} -> ${k1.dlgCount}`);
ok("K2 the peeled layer's census back (zero unnamed without the dialog)",
  censusOk(k1));

/* ---------- the second door: the heading follows the door ---------- */
console.log("Face T2 — the run.err door (the heading follows the door)");
const d2 = evalJson(textDoor("run.err"));
ok("K3 the run.err door opened (the second text door)", d2.found === true, `door="${d2.door || ""}"`);
const t2 = waitFor("the run.err dialog", (m) => m.dlgCount >= 2 && m.dlgHeadTop === "run.err" && m.preLen > 0);
ok("K4 the heading FOLLOWS the door (run.out -> run.err)",
  t2.dlgHeadTop === "run.err", `head="${t2.dlgHeadTop}"`);
ok("K5 the err face's census held (zero unnamed WITH the second dialog)",
  censusOk(t2), `btns=${t2.pageBtns}`);
evalJson(ESC_LAST);
sleep(1.5);
const k3 = evalJson(MEASURE);
ok("K6 Escape peeled the second layer (the contract repeats)",
  k3.dlgCount === t2.dlgCount - 1, `dlgCount ${t2.dlgCount} -> ${k3.dlgCount}`);

/* ---------- the world back + the seed hygiene ---------- */
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

/* ---------- the ledger at birth (three faces: logsSection / textDialog / worldBack) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  logsSection: ledgerFace(prevFaces ? prevFaces.logsSection?.live ?? null : null, s1, scalarOf),
  textDialog: ledgerFace(prevFaces ? prevFaces.textDialog?.live ?? null : null, t1, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the text-preview face holds — the room trio's third Esc seat walked: the clean room held (the panel-closed boot — the t866 law), the host inspector's Results tab hosts the "Logs and reports" section with ${s1.logDoors} file-named text doors and zero unnamed (the anchors honest), the run.out door opened the dialog as the TOPMOST layer (the heading IS the file's name), the description speaks the last-64-KB contract, the pre is named + tabIndex 0 + took focus when the tail landed (the focus steal — the img-complete law's focus analog), the content landed and the scrollable region is honest, the Copy door named, the keymap seat taught Esc, two settled rides bit-identical, Escape peeled exactly one layer and the heading FOLLOWED the second door (run.out -> run.err), the world back bit-for-bit (${OPEN} == ${OPEN}), and the ride left no session seed — the ledger aboard from birth (three faces, the shared law)`
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
  instrument: "scripts/t868-text-preview-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> canvas -> host card (plain door) -> Results tab (mousedown) -> Logs and reports (file-named doors) -> run.out door -> text dialog (topmost, focus steal, 64 KB tail) -> Escape -> run.err door (the heading follows) -> Escape -> worldBack + seed hygiene (one command)",
  doors: {
    inspector: "plain pointerdown+pointerup on the host card — the submitted law",
    resultsTab: "mousedown on the Results tab — the t863 Radix law",
    textDialog: "click the file-name button in the Logs and reports section — the name IS the door",
    close: "Escape — the keymap seat's own teaching (one layer per peel)",
  },
  host: { name: host.name, id: host.id, measured: true },
  openingCanvas: OPEN,
  faces: {
    logsSection: { live: s1 },
    textDialog: { live: t1, secondRide: t1b, errFace: t2 },
    worldBack: { live: w1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t868-text-preview-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nTEXT-PREVIEW-A11Y t868: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
