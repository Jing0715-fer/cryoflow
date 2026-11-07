#!/usr/bin/env node
/**
 * t868 — the text preview's page: the results-view's THIRD room, and the
 * one-brain law's own walk.
 *
 * The results family's room trio closes here: the maps gallery + the
 * quick-look dialog (t867), the star table (t866), and now the TEXT
 * PREVIEW — the "Logs & reports" door's 64 KB tail. The birth's point is
 * the ONE-BRAIN law (t779): the same TextPreview brain serves TWO
 * door-sets (the results view's log rows + the job inspector's Files tab
 * peek doors), word forms verbatim — so the walk rides BOTH mouths and
 * demands the same invariants from each (two doors, one dialog, one law).
 *
 * Faces:
 *   0  the clean room (the t866 law: the seed cleared, the panel closed)
 *      + the calm canvas (the census's invariant)
 *   TP the results view's Logs & reports door: the heading is the file's
 *      own name (the door's text IS the name, from the data), the
 *      description speaks the path + the tail contract ("last 64 KB"),
 *      the <pre> is a NAMED FOCUSABLE scroll region (tabIndex 0 — the
 *      t812 law) that TOOK the focus when the tail landed (t774:
 *      reachability IS the point), the copy door aboard (Task 170's one
 *      clipboard dialect), the tail's bound MEASURED (<= 64 KB + slack —
 *      the backend's own contract, recorded never pinned), zero unnamed
 *      page-wide (the census's invariant, the grown ruler — title at the
 *      chain's end, RENDERED the ghost filter), the keymap seat teaching
 *      exactly ONE key (Esc — the must-not-lie calibre: the text preview
 *      has no other keys), two settled rides bit-identical (the t836 law,
 *      the t860 conditions).
 *   ESC the layered-escape contract: one Escape closes the dialog, the
 *      world back.
 *   FT the Files tab's peek door (the SECOND family): the Preview door
 *      (aria-label "Preview <name>" — the Eye, hover-revealed), the SAME
 *      dialog arrives with the SAME invariants — one brain, two door-sets,
 *      word forms verbatim.
 *   W  the world back (the canvas count == the opening count, zero
 *      unnamed) + W2: the ride leaves NO session seed behind (the t866
 *      lesson rides every page).
 *
 * The ledger is the t861 birthright aboard from birth (three faces, the
 * shared law) with the instrument's own REVISION (the t867 arm 2r's
 * second seat: the receipt signs its instrument's generation, so the
 * ledger can tell a moved world from a widened lens).
 *
 *   node scripts/t868-text-preview-a11y.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW, RENDERED } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
/* the instrument's own revision (the t867 arm 2r's contract): bumped
 * WHENEVER the measurement conditions change. Revision 1 = the birth. */
const REVISION = 3;

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail: detail ?? "" });
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
  if (typeof out === "string") out = JSON.parse(out);
  return out;
};
const corpse = (m, face) => {
  if (m && m.error) {
    fail++;
    console.log(`  ✗ ${face}: ${m.error}`);
    writeReceipt("the ride stopped honestly at a corpse");
    process.exit(1);
  }
  return false;
};
const waitFor = (what, probe, maxSecs = 30) => {
  let m = null;
  for (let i = 0; i < maxSecs; i++) {
    m = evalJson(MEASURE);
    if (probe(m)) return m;
    sleep(1);
  }
  console.log(`    (waitFor "${what}" timed out after ${maxSecs}s — the last measure rides)`);
  return m;
};
const diffKeys = (a, b) => {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return Array.from(keys).filter((k) => JSON.stringify((a ?? {})[k]) !== JSON.stringify((b ?? {})[k]));
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
  console.log(`  settled ${what} (shimmer silent, 2x stable)`);
  return m;
};
/* the layered-escape walk: ONE Escape per call — the topmost layer closes,
 * the layers beneath remain (the inspector is a dialog too; the t867
 * world's dlgCount 2 means preview-over-inspector, and the house contract
 * is one Escape per layer, not a purge) */
const escOne = () =>
  evalJson(
    '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ before: ds.length, after: ds.length, pressed: false }); const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); return JSON.stringify({ before: ds.length, pressed: true }); })()'
  );

/* ---------- the measure: child-level truth, one eval — single line, no
 * backtick, no ${ (the shell hands it verbatim; the grown ruler rides:
 * title at the chain's end, RENDERED the ghost filter). The Preview doors
 * are enumerated ALWAYS: the inspector itself is a dialog (dlgTop truthy
 * even with no peek up), so a dlgTop guard would have measured [] forever
 * — the Eye's opacity-0 reveal keeps the door in the DOM (the hover
 * grammar), the a11y tree too. ---------- */
const MEASURE =
  '(() => { ' + NAMEOF + RENDERED + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b) && rendered(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c) && rendered(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 60) : null; const descOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-describedby") || "") || {}).textContent || "").trim().slice(0, 90) : null; const dlgHeadTop = headOf(dlgTop); const dlgDescTop = descOf(dlgTop); const dlgCount = dgs.length; const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( file| chart)?…$/.test((e.textContent || "").trim())); const sec = document.querySelector(\'section[aria-label="Logs and reports"]\'); const logRows = sec ? Array.from(sec.querySelectorAll("button[data-print-keep]")) : []; const pre = dlgTop ? dlgTop.querySelector("pre[aria-label]") : null; const copyBtn = dlgTop ? Array.from(dlgTop.querySelectorAll("button")).find((b) => ((b.getAttribute("aria-label") || b.textContent || "").trim().toLowerCase() === "copy")) : null; const keymap = dlgTop ? dlgTop.querySelector("[data-canvas-ui=text-keymap]") : null; const kbds = keymap ? Array.from(keymap.querySelectorAll("kbd")).map((k) => (k.textContent || "").trim()) : []; const filesTab = Array.from(document.querySelectorAll("[role=tab]")).some((t) => (t.textContent || "").trim().startsWith("Files") && t.getAttribute("data-state") === "active"); const previewDoors = Array.from(document.querySelectorAll("button[aria-label]")).filter((b) => (b.getAttribute("aria-label") || "").startsWith("Preview ")).map((b) => (b.getAttribute("aria-label") || "").slice(8)); const actTabEl = dlgTop ? dlgTop.querySelector("[role=tab][data-state=active]") : document.querySelector("[role=tab][data-state=active]"); return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 44)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgCount: dlgCount, dlgHeadTop: dlgHeadTop, dlgDescTop: dlgDescTop, shimmer: leaves.length, logsSection: !!sec, logRows: logRows.length, logRowNames: logRows.slice(0, 4).map((b) => (b.textContent || "").trim().slice(0, 28)), preNamed: pre ? ((pre.getAttribute("aria-label") || "") === "File content preview") : false, preTabindex: pre ? pre.getAttribute("tabindex") : null, preFocused: pre ? document.activeElement === pre : false, preLen: pre ? (pre.textContent || "").length : null, copyAboard: !!copyBtn, keymapAboard: !!keymap, keymapKbds: kbds, filesTabActive: filesTab, previewDoors: previewDoors, actTab: actTabEl ? (actTabEl.textContent || "").trim().slice(0, 12) : null }); })()';

const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* the faces' holders — declared before the receipt writer so a corpse path
 * (which calls writeReceipt mid-ride) never trips the TDZ */
let host = null;
let tp = null;
let tpS = null;
let ft = null;
let w3 = null;

/* ---------- the receipt ---------- */
const writeReceipt = (verdict) => {
  writeFileSync(
    join(ROOT, "shots-qa/t868-text-preview-a11y.json"),
    JSON.stringify(
      {
        instrument: "scripts/t868-text-preview-a11y.mjs",
        instrumentRevision: REVISION,
        ruler: NAMEOF_LAW,
        build: world.id,
        worldMode: world.mode,
        date: new Date().toISOString(),
        chain:
          "clean room -> canvas -> postprocess-or-first-logged host (plain door) -> Results tab (mousedown) -> Logs & reports row (the text IS the name) -> text preview dialog (topmost) -> the tail's reachability + the copy door + the one-key seat -> Escape home -> the Files tab's Preview door (the second family, one brain) -> Escape home -> worldBack + seed hygiene (one command)",
        host: host ? { name: host.name, id: host.id, measured: true } : null,
        doors: {
          logRow: "click the Logs & reports row — the text IS the name",
          filesPeek: 'click the Files tab\'s Preview door — aria-label "Preview <name>"',
          close: "Escape — the keymap seats' own teaching",
        },
        faces: {
          textPreview: { live: tp, settled: tpS },
          filesTab: { live: ft },
          worldBack: { live: w3 },
        },
        driftLedger: {
          prevFound: cmp.prevFound,
          sameBuild: cmp.sameBuild,
          prevBuild: cmp.prevBuild,
          prevDate: cmp.prev ? cmp.prev.date : null,
          prevRevision: cmp.prevRevision,
          law: LEDGER_LAW,
          faces: dlFaces,
        },
        checks: results,
        passed: pass,
        failed: fail,
        total: pass + fail,
        verdict,
      },
      null,
      2
    )
  );
};

/* ---------- provenance + the comparator ---------- */
const world = worldIdentity(ROOT);
console.log(
  `t868 text preview a11y walk — world ${world.mode}:${world.id}, the results-view's third room, one command\n`
);
const cmp = loadComparator(ROOT, "shots-qa/t868-text-preview-a11y.json", world.id);
console.log(
  cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${cmp.prev.date} (world ${cmp.prevBuild}, revision ${cmp.prevRevision ?? "unmarked"}, ${cmp.sameBuild ? "SAME key" : "world MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n"
);

/* ---------- Face 0 — the clean room + the calm canvas ---------- */
console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.removeItem("cryoflow.selectedJob.v1"); return JSON.stringify({ cleared: true }); })()');
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
corpse(m0, "Face 0");
ok(
  "O0 the boot is a clean room (the t157 seed cleared, the panel closed)",
  !m0.hasDlg && censusOk(m0),
  `panelOpen absent, btns=${m0.pageBtns} — zero unnamed anywhere`
);

/* ---------- the host, measured (never pinned) ---------- */
const rosterRaw = execSync(
  `curl -s ${BASE}/api/jobs -H "Origin: ${BASE}"`,
  { encoding: "utf8" }
);
const jobs = (JSON.parse(rosterRaw).jobs ?? JSON.parse(rosterRaw)).filter(
  (j) => j.status === "completed"
);
let hostMeasured = null;
let doorName = null;
for (const j of jobs) {
  evalJson(
    '(() => { const c = document.querySelector("[data-card-btn=\\"' + j.id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ clicked: true }); })()'
  );
  sleep(2);
  evalJson(
    '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "Results"); if (!t) return JSON.stringify({ tab: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ tab: true }); })()'
  );
  sleep(3);
  const m = evalJson(MEASURE);
  if (m.logsSection && m.logRows >= 1) {
    hostMeasured = j;
    doorName = m.logRowNames[0];
    break;
  }
  evalJson(
    '(() => { let n = 0; for (let i = 0; i < 4; i++) { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) break; const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); n++; } return JSON.stringify({ esc: n }); })()'
  );
  sleep(1.5);
}
if (!hostMeasured) {
  console.error("no completed job carries Logs & reports rows — the text rooms cannot open");
  writeReceipt("no logged host — the ride stopped honestly before the text rooms");
  process.exit(1);
}
host = hostMeasured;
console.log(`  host (measured): ${host.name}; first log row (the text IS the name): "${doorName}"`);

/* ---------- Face TP — the results view's Logs & reports door ---------- */
console.log("Face TP — the text preview through the log row's own door");
const c1 = evalJson(
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + host.id + '\\"]"); const r = c.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ clicked: true }); })()'
);
ok("T1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
evalJson(
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "Results"); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ tab: true }); })()'
);
sleep(3);
const sec1 = evalJson(MEASURE);
ok(
  "T2 the Logs & reports section is present and named",
  sec1.logsSection === true && sec1.logRows >= 1,
  `rows=${sec1.logRows} first="${sec1.logRowNames[0]}"`
);
const rowClick = evalJson(
  '(() => { const sec = document.querySelector(\'section[aria-label="Logs and reports"]\'); const rows = sec ? Array.from(sec.querySelectorAll("button[data-print-keep]")) : []; if (!rows.length) return JSON.stringify({ clicked: false, name: null }); const named = (r) => { const el = r.querySelector("span"); return el ? (el.textContent || "").trim() : (r.textContent || "").trim(); }; const row = rows.find((r) => named(r).includes("run.out")) || rows[0]; const name = named(row); row.click(); return JSON.stringify({ clicked: true, name: name.slice(0, 40) }); })()'
);
ok("T3 the log row clicked (the text IS the name — from the data)", rowClick.clicked === true, `name="${rowClick.name}"`);
tp = waitFor("the text preview dialog + the tail", (m) => m.hasDlg && m.dlgCount >= 2 && m.preLen !== null, 30);
if (corpse(tp, "Face TP")) process.exit(1);
ok("T4 the dialog arrived as the TOPMOST layer", tp.hasDlg === true && tp.dlgCount >= 2, `dlgCount=${tp.dlgCount}`);
ok(
  "T5 the heading is the file's own name (label ?? name — read from the data, the TOPMOST layer)",
  tp.dlgHeadTop === rowClick.name,
  `head="${tp.dlgHeadTop}" == data "${rowClick.name}"`
);
ok(
  "T6 the description speaks the path + the tail contract (last 64 KB)",
  (tp.dlgDescTop || "").includes("last 64 KB") && (tp.dlgDescTop || "").length > 12,
  `desc="${tp.dlgDescTop}"`
);
ok(
  "T7 the region is named and keeps its keyboard door (the t812 law)",
  tp.preNamed === true && tp.preTabindex === "0",
  `aria-label="File content preview", tabindex=${tp.preTabindex}`
);
ok(
  "T8 the region TOOK the focus (the t774 reachability — the region is the destination)",
  tp.preFocused === true
);
ok(
  "T9 the copy door is aboard (Task 170's one clipboard dialect)",
  tp.copyAboard === true
);
ok(
  "T10 the tail's BOUND is honest (the backend's own contract: the last 64 KB, +slack)",
  tp.preLen !== null && tp.preLen <= 65536 * 1.05,
  `tail length ${tp.preLen} chars (measured, never pinned)`
);
ok(
  "T11 zero unnamed page-wide WITH the preview up (the census's invariant, the grown ruler)",
  censusOk(tp),
  `btns=${tp.pageBtns} ctrls=${tp.ctrls}`
);
ok(
  "T12 the keymap seat teaches exactly ONE key (Esc — the must-not-lie calibre)",
  tp.keymapAboard === true && tp.keymapKbds.length === 1 && tp.keymapKbds[0] === "Esc",
  `kbds=${JSON.stringify(tp.keymapKbds)}`
);
tpS = settle("the text preview (second ride)");
ok(
  "T13 two settled rides bit-identical (the t836 law, the t860 conditions)",
  JSON.stringify(tp) === JSON.stringify(tpS)
);

/* ---------- Face ESC — the layered-escape contract ---------- */
const before = tp.dlgCount;
const esc1 = escOne();
sleep(1);
const afterEsc = evalJson(MEASURE);
ok(
  "E1 ONE Escape closed the TOPMOST layer (the layered-escape contract: one per layer)",
  esc1.pressed === true && afterEsc.dlgCount === before - 1,
  `dlgCount ${esc1.before} -> ${afterEsc.dlgCount} (the inspector beneath remains — the house contract)`
);
ok(
  "E2 the layer beneath is intact (the inspector still rides, its own tab still spoken)",
  afterEsc.hasDlg === true && afterEsc.dlgCount === 1 && (afterEsc.actTab || "").startsWith("Results"),
  `actTab=${afterEsc.actTab}`
);

/* ---------- Face FT — the Files tab's peek door (the second family) ---------- */
console.log("Face FT — the Files tab's Preview door (one brain, two door-sets)");
evalJson(
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim().startsWith("Files")); if (!t) return JSON.stringify({ tab: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ tab: true }); })()'
);
sleep(2);
const ftTab = evalJson(MEASURE);
ok("F1 the Files tab opened (the mousedown door; the trigger's count badge rides the label — \"Files4\" — the prefix match is the measured form)", ftTab.filesTabActive === true);
ok(
  "F2 the Preview doors are aboard (the Eye, aria-label 'Preview <name>')",
  ftTab.previewDoors.length >= 1,
  `doors=${ftTab.previewDoors.length} first="${ftTab.previewDoors[0] ?? "?"}"`
);
const ftClick = evalJson(
  '(() => { const b = Array.from(document.querySelectorAll("button[aria-label]")).find((x) => (x.getAttribute("aria-label") || "").startsWith("Preview ") && !(x.getAttribute("aria-label") || "").endsWith(".star")); if (!b) return JSON.stringify({ clicked: false, name: null }); const name = (b.getAttribute("aria-label") || "").slice(8); b.click(); return JSON.stringify({ clicked: true, name: name.slice(0, 40) }); })()'
);
ok("F3 the peek door clicked (the second family's own mouth)", ftClick.clicked === true, `name="${ftClick.name}"`);
ft = waitFor("the peek dialog + the tail (the same brain)", (m) => m.hasDlg && m.dlgCount >= 2 && m.preLen !== null, 30);
if (corpse(ft, "Face FT")) process.exit(1);
ok(
  "F4 the SAME dialog arrives, the heading is the previewed file's own name (one brain, word forms verbatim)",
  ft.dlgHeadTop === ftClick.name,
  `head="${ft.dlgHeadTop}" == data "${ftClick.name}"`
);
ok(
  "F5 the same invariants hold through the second mouth (named focusable region + focus + copy + the tail's bound)",
  ft.preNamed === true && ft.preTabindex === "0" && ft.preFocused === true && ft.copyAboard === true && ft.preLen !== null && ft.preLen <= 65536 * 1.05,
  `tabindex=${ft.preTabindex}, focused=${ft.preFocused}, tail=${ft.preLen}`
);
ok(
  "F6 zero unnamed page-wide WITH the peek up (the census's invariant)",
  censusOk(ft),
  `btns=${ft.pageBtns} ctrls=${ft.ctrls}`
);
const fBefore = ft.dlgCount;
const esc2 = escOne();
sleep(1);
const afterEsc2 = evalJson(MEASURE);
ok(
  "F7 the peek closed honestly (ONE Escape, the layer contract through the second mouth)",
  esc2.pressed === true && afterEsc2.dlgCount === fBefore - 1,
  `dlgCount ${esc2.before ?? fBefore} -> ${afterEsc2.dlgCount}`
);

/* ---------- Face W — the world back + seed hygiene ---------- */
console.log("Face W — the world back (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
w3 = settle("the restored canvas");
ok(
  "W1 the world unharmed (canvas count == the opening count, zero unnamed)",
  w3.pageBtns === m0.pageBtns && censusOk(w3),
  `btns=${w3.pageBtns} (opening ${m0.pageBtns})`
);
const seed = evalJson('(() => JSON.stringify(localStorage.getItem("cryoflow.selectedJob.v1")))()');
ok(
  "W2 the ride leaves no session seed (the t157 two-way door's honest none — the t866 lesson rides every page)",
  seed === "null" || seed === null || seed === '""',
  `seed=${seed}`
);

/* ---------- the ledger — the t861 birthright, the revision arm's second seat ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const faces = [
  ["textPreview", tp, (m) => m.pageBtns],
  ["filesTab", ft, (m) => m.pageBtns],
  ["worldBack", w3, (m) => m.pageBtns],
];
const dlFaces = {};
for (const [name, live, scalarOf] of faces) {
  const prevObj = cmp.prevFound ? cmp.prev?.faces?.[name]?.live : null;
  const f = ledgerFace(prevObj, live, scalarOf);
  dlFaces[name] = f;
  const v = armVerdict(cmp, world, f, REVISION);
  ok(`${name} face ride-drift law`, v.ok, v.detail);
}

writeReceipt(
  fail === 0
    ? `the text preview's page holds: the results-view's third room through the log row's own door (the heading IS the file's name from the data, the tail's 64 KB bound measured, the named focusable region took the focus — t774's reachability — the copy door aboard, the one-key Esc seat's must-not-lie calibre), the Files tab's peek door spoke the SAME law through the SECOND mouth (one brain, two door-sets, word forms verbatim), zero unnamed everywhere on every face, two settled rides bit-identical, the world back bit-for-bit (${w3.pageBtns} == ${m0.pageBtns}) — the ledger aboard from birth (three faces, the shared law) with the instrument's own revision signed (the arm 2r contract's second seat)`
    : `the text preview's page reds in ${fail} place(s) — the birth's honest reds are the curriculum`
);
console.log(`\nreceipt: ${join(ROOT, "shots-qa/t868-text-preview-a11y.json")}`);
console.log(`\nTEXT-PREVIEW-A11Y t868: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
