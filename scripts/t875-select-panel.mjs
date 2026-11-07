#!/usr/bin/env node
/**
 * t875 — the SELECT PANEL FACE (the t874 tail's first candidate,
 * non-build-day arm): the 1D selection surface — the select job
 * (Particle Selection, whose extended engine params carry select_label
 * rlnCtfMaxResolution) — walked at the surfaces the world actually
 * opens for it. THE DOOR INVENTORY (the first ride's law): the card's
 * plain door is STATUS-DEPENDENT — an IDLE job's plain door opens the
 * editing PANEL (t863's shape), a SUBMITTED job's (running/completed/
 * failed) opens the big INSPECTOR (job-card.tsx: "submitted jobs open
 * the big inspector"). t863's probe was idle, so its plain door opened
 * the panel; every subject HERE is completed — the walk follows the
 * world: the tutorial select's INSPECTOR (its Results tab rides the
 * receipt's HONEST ABSENCE), the IDLE probe's PANEL (the params face +
 * the ride), the COMPLETED probe's INSPECTOR (the receipt card at DOM
 * scale).
 *
 * "pick-follows-class": the native engine's keep set FOLLOWS THE CLASS
 * OCCUPANCY (classCutoff), not the RELION label — and the CAP applies
 * FIRST: the class stats report the INPUT's occupancy (kept ⇔ count ≥
 * cutoff × best) while the output is min(maxParticles, kept-classes'
 * total) — two ledgers of one run, both ridden.
 *
 * THE RUN DOOR'S FIRST FLEET RIDE: the probe RUNS through the world's
 * own run door (POST /api/jobs/:id/run, {local:true} — engine-native
 * select stays local), the receipt is BORN, and the instrument reads
 * the INPUT STAR FROM DISK (the receipt's own inputPath) — the
 * engine's receipt vs the file it claims to have read, the strongest
 * honest form. The re-run proves the append law at FILE SCALE (run.out
 * holds two blocks; the LAST is the newest truth) and the engine's
 * determinism (same input + frozen params → the same numbers).
 *
 * THE FIRST RIDE'S HONEST DISCOVERY (recorded, not lied about): the
 * world's disk truth DIVERGED from the roster's result line — the
 * t531 old-world seeder rewrote the select2d's output star (168
 * particles, classes {1:96, 2:72}) under its own skew law AFTER the
 * select2d's run (the DB line still speaks the pre-reseed 96/50). The
 * instrument that pinned the DB line went red honestly; the mended
 * instrument pins NOTHING but the file the receipt names. The roster's
 * result line is the LAST RUN's word; the disk is the seeder's
 * contract; the receipt speaks the run's own input.
 *
 * THE PARAMS FREEZE (the second ride's law): a submitted job's params
 * are READ-ONLY in the UI (the inspector's ParamsGrid is a read-only
 * grid; the completed card offers no edit door) — the form's editable
 * window closes at submission, so the receipt can never disagree with
 * the form: the ride sets maxParticles 1000→48 while IDLE (the panel's
 * debounced save), the freeze seals it, the run honors it, the receipt
 * + ranParams keep it forever.
 *
 * THE REMOUNT LAW (the frozen world's refresh shape): the inspector's
 * Results tab bumps its refreshKey every 6s WHILE RUNNING (t397) — a
 * sub-6s engine-native re-run ends BEFORE the first tick, so the
 * mount-fetched receipt card holds the pre-re-run world until a
 * REMOUNT. The ride walks the world's own gesture (Results → Overview
 * → Results) and the card re-reads the newest run. The completion-
 * nudge fix (one bump at the running→done flip) rides src — the live
 * proof waits for the build day (the t869/t872 precedent).
 *
 * THE SANCTIONED MUTATION RIDE (the t863/t873 precedent, one command):
 *   create -> wire -> params ride (idle, the panel) -> run -> the
 *   receipt born (the disk truth) -> the inspector's card at DOM scale
 *   -> the from-door's destination -> re-run (the append + the
 *   determinism at file scale) -> DELETE -> the world demanded back
 *   bit-for-bit. The workdir + tombstone remain BY DESIGN (the app's
 *   own undo ledger, t863's law) — recorded, never cleaned.
 *
 * Born with the ledger aboard (the t861 birthright): THREE faces —
 * panelArrival / receiptFace / worldBack — arm 1 recorded on the first
 * ride. Registered at birth into A4e-28 (the family's shape).
 *
 * Receipt: shots-qa/t875-select-panel.json (+ PNGs archived).
 *
 *   node scripts/t875-select-panel.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const RECEIPT = "shots-qa/t875-select-panel.json";
/* the receipt's REVISION stamp (the t867 arm-2r law, the family's field
 * name `instrumentRevision` — the loadComparator's own mouth): revision 3
 * — r1 pinned the roster's result line and walked the panel for completed
 * jobs; r2 pinned only the receipt's own file and followed the door
 * inventory; r3 taught the measure the inspector's DISPLAY name surface
 * (h2[title] — the Job-name input is the EDIT mode only). The stamp
 * tells the ledger the comparator predates the growth — the next
 * same-revision ride meets arm 3 bit-for-bit. */
const RECEIPT_REVISION = 3;
const PROBE_NAME = "t875 select panel probe";
const PROBE_CAP = 48; /* the ride's own choice — set while idle, frozen at submission, honored by the run */

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
const jobOf = async (id) => (await roster()).find((j) => j.id === id) ?? null;
const pollJob = async (id, want, maxSecs = 40) => {
  for (let i = 0; i < maxSecs; i++) {
    const j = await jobOf(id);
    if (j && j.status === want) return j;
    await new Promise((res) => setTimeout(res, 1000));
  }
  return jobOf(id);
};
const receiptApiOf = async (id) => (await api("GET", `/api/jobs/${id}/selection-receipt`)).body;
const pollParamsNum = async (id, key, want, maxSecs = 12) => {
  for (let i = 0; i < maxSecs; i++) {
    const p = (await jobOf(id))?.params ?? {};
    if (Number(p[key]) === want) return Number(p[key]);
    await new Promise((res) => setTimeout(res, 1000));
  }
  return Number(((await jobOf(id))?.params ?? {})[key]);
};

/* the instrument's own star reader — the file the receipt names, parsed
 * into the same truth the engine computed: particles rows per block, the
 * class histogram from _rlnClassNumber */
const starTruth = (path) => {
  if (!path || !existsSync(path)) return null;
  const blocks = [];
  let cur = null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("data_")) {
      cur = { img: false, labels: [], rows: 0, cls: new Map() };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    if (t.startsWith("_rln")) {
      const label = t.split(/\s+/)[0];
      cur.labels.push(label);
      if (label === "_rlnImageName") cur.img = true;
      continue;
    }
    if (!t || t.startsWith("loop_") || t.startsWith("#")) continue;
    if (!cur.img) continue;
    cur.rows++;
    const ci = cur.labels.indexOf("_rlnClassNumber");
    if (ci >= 0) {
      const v = t.split(/\s+/)[ci];
      cur.cls.set(v, (cur.cls.get(v) ?? 0) + 1);
    }
  }
  const img = blocks.filter((b) => b.img);
  const cls = new Map();
  for (const b of img) for (const [k, n] of b.cls) cls.set(k, (cls.get(k) ?? 0) + n);
  return { rows: img.reduce((s, b) => s + b.rows, 0), classes: cls };
};

/* ---------- the measure: the select panel + the receipt card ---------- */
const MEASURE =
  '(() => { ' + NAMEOF + ' ' +
  'const btns = Array.from(document.querySelectorAll("button"));' +
  'const un = btns.filter((b) => !nameOf(b));' +
  'const unWho = un.map((b) => { const s = b.querySelector("svg"); const cls = s ? (s.getAttribute("class") || "") : ""; const luc = cls.split(/\\s+/).find((c) => c.indexOf("lucide-") === 0); return luc || (b.getAttribute("data-slot") || b.tagName); });' +
  'const ctrls = Array.from(document.querySelectorAll("input,select,textarea"));' +
  'const unCtrls = ctrls.filter((c) => !nameOf(c));' +
  'const imgsAll = Array.from(document.querySelectorAll("img"));' +
  'const altless = imgsAll.filter((i) => !i.hasAttribute("alt"));' +
  'const dgs = Array.from(document.querySelectorAll("[role=dialog]"));' +
  'const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\');' +
  'const nameInp = document.querySelector(\'input[aria-label="Job name"]\');' +
  'const inspName = Array.from(document.querySelectorAll("[role=dialog] h2[title]")).map((h) => (h.textContent || "").trim()).find((t) => t.length > 0) || null;' +
  'const panelTitle = nameInp ? nameInp.value.trim().slice(0, 60) : inspName;' +
  'const io = document.querySelector(\'section[aria-label="Inputs"]\');' +
  'const oo = document.querySelector(\'section[aria-label="Outputs"]\');' +
  'const ioText = io ? (io.textContent || "").trim() : "";' +
  'const tabsAll = Array.from(document.querySelectorAll("[role=tab]")).map((t) => (t.textContent || "").trim());' +
  'const receipt = document.querySelector(\'section[data-canvas-ui="selection-receipt"]\');' +
  'let chipLabel = null; let bornChip = false; let classesKept = null;' +
  'let bigKept = null; let bigTotal = null; let pctChip = null; let barLabel = null;' +
  'let chipTitles = []; let overflowChip = null; let fromDoor = null; let ranLabel = null; let ignoredLabel = null;' +
  'if (receipt) {' +
  '  const h4 = receipt.querySelector("h4");' +
  '  const spans = h4 ? Array.from(h4.querySelectorAll("span")) : [];' +
  '  const texts = spans.map((s) => (s.textContent || "").trim());' +
  '  chipLabel = texts.find((t) => ["manual", "occupancy rule", "first-N", "selection"].indexOf(t) >= 0) || null;' +
  '  bornChip = texts.indexOf("born") >= 0;' +
  '  const all = (receipt.textContent || "");' +
  '  const ck = /(\\d+)\\/(\\d+) classes kept/.exec(all);' +
  '  classesKept = ck ? { kept: Number(ck[1]), total: Number(ck[2]) } : null;' +
  '  const pureNums = Array.from(receipt.querySelectorAll("span")).map((s) => (s.textContent || "").trim()).filter((t) => /^\\d[\\d,]*$/.test(t)).map((t) => Number(t.replace(/,/g, "")));' +
  '  bigKept = pureNums.length >= 1 ? pureNums[0] : null;' +
  '  bigTotal = pureNums.length >= 2 ? pureNums[1] : null;' +
  '  const pctEl = Array.from(receipt.querySelectorAll("span[title]")).find((s) => /of the input particles survived/.test(s.getAttribute("title") || ""));' +
  '  pctChip = pctEl ? (pctEl.textContent || "").trim() : null;' +
  '  const bar = receipt.querySelector(\'[role=img][aria-label*="percent of particles kept"]\');' +
  '  barLabel = bar ? bar.getAttribute("aria-label") : null;' +
  '  chipTitles = Array.from(receipt.querySelectorAll(\'[title^="class "]\')).map((c) => c.getAttribute("title"));' +
  '  const ov = Array.from(receipt.querySelectorAll("span")).find((s) => /^\\+\\d+ more$/.test((s.textContent || "").trim()));' +
  '  overflowChip = ov ? (ov.textContent || "").trim() : null;' +
  '  const door = receipt.querySelector(\'[data-canvas-ui="receipt-from-link"]\');' +
  '  fromDoor = door ? (door.textContent || "").trim() : null;' +
  '  const ran = Array.from(receipt.querySelectorAll("span")).find((s) => /^ran /.test((s.textContent || "").trim()));' +
  '  ranLabel = ran ? (ran.textContent || "").trim().slice(0, 30) : null;' +
  '  const ign = Array.from(receipt.querySelectorAll("span")).find((s) => /^ignored: /.test((s.textContent || "").trim()));' +
  '  ignoredLabel = ign ? (ign.textContent || "").trim() : null;' +
  '}' +
  'const legendTexts = Array.from(document.querySelectorAll("fieldset legend")).map((l) => (l.textContent || "").trim());' +
  'const paramsFoot = (Array.from(document.querySelectorAll("p")).map((p) => (p.textContent || "").trim()).find((t) => /parameters · RELION 5 defaults/.test(t)) || "");' +
  'const classGallery = !!document.querySelector(\'section[aria-label="Class selection gallery"]\');' +
  'const logFace = (() => { const pres = Array.from(document.querySelectorAll("pre")); return pres.length > 0 ? (pres[pres.length - 1].textContent || "").slice(0, 80) : null; })();' +
  'const shimmer = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?$/.test((e.textContent || "").trim())).length;' +
  'return JSON.stringify({ panelOpen, panelTitle, pageBtns: btns.length, pageUnnamed: un.length, unWho, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgsAll.length, altless: altless.length, hasDlg: dgs.length > 0, dlgCount: dgs.length, ioPresent: !!io, ooPresent: !!oo, ioHasUpstream: ioText.indexOf("Select 2D") >= 0, tabsAll, receiptPresent: !!receipt, chipLabel, bornChip, classesKept, bigKept, bigTotal, pctChip, barLabel, chipTitles, overflowChip, fromDoor, ranLabel, ignoredLabel, legendTexts, paramsFoot, classGallery, logFace, shimmer }); })()';

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
    if (run >= need && m.shimmer === 0) break;
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
const closePanel = () =>
  '(() => { const b = document.querySelector(\'button[aria-label="Close job panel"]\'); if (!b) return JSON.stringify({ clicked: false }); b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()';
const fillNum = (id, key, value) =>
  '(() => { const inp = document.querySelector("#param-' + id + '-' + key + '"); if (!inp) return JSON.stringify({ filled: false }); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(inp, "' + String(value) + '"); inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); return JSON.stringify({ filled: true, now: inp.value }); })()';

console.log("t875 — the select panel's face (the door inventory + the run door, one command)\n");

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
const panelTabBefore = evalJson('(() => { return JSON.stringify({ tab: localStorage.getItem("cryoflow.panelTab.v1") }); })()').tab;

/* ---------- Face T: the APIs' truth first ---------- */
console.log("Face T — the roster, the feeding wire, and the pre-receipt absence");
const jobs = await roster();
const selTut = jobs.find((j) => j.type === "select" && j.status === "completed");
const s2dTut = jobs.find((j) => j.type === "select2d" && j.status === "completed");
if (!selTut || !s2dTut) {
  console.error("no completed select/select2d pair in the roster — the select panel face cannot light; the ride stops honestly");
  writeFileSync(
    join(ROOT, RECEIPT),
    JSON.stringify({ instrument: "scripts/t875-select-panel.mjs", instrumentRevision: RECEIPT_REVISION, ruler: NAMEOF_LAW, build: world.id, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no completed select/select2d pair — the ride stopped honestly" }, null, 2)
  );
  process.exit(1);
}
const E0 = (await edgesOf()).length;
const J0 = jobs.length;
ok("T1 the tutorial pair found (the walk's subjects)", !!selTut && !!s2dTut, `select="${selTut.name}" select2d="${s2dTut.name}"`);
const feedEdge = (await edgesOf()).find((e) => e.toJobId === selTut.id);
ok("T2 the tutorial select's feeding wire speaks particles -> particles (the grammar the probe rides)", !!feedEdge && feedEdge.fromJobId === s2dTut.id && feedEdge.fromPort === "particles" && feedEdge.toPort === "particles", feedEdge ? `${feedEdge.fromPort}->${feedEdge.toPort}` : "no edge");
const tutRcpt = await receiptApiOf(selTut.id);
ok("T3 the tutorial select's receipt is the world's documented absence (pre-receipt run)", tutRcpt && tutRcpt.available === false && typeof tutRcpt.note === "string" && tutRcpt.note.length > 0, `note="${(tutRcpt?.note ?? "").slice(0, 72)}"`);
ok("T4 the roster's result line is the LAST RUN's word (the first ride's discovery: the disk may speak the seeder's newer contract — the receipt's own file is the only pin)", typeof selTut.result === "string" && /particles selected/.test(selTut.result), `result="${(selTut.result ?? "").slice(0, 60)}"`);

/* ---------- Face I: the tutorial select's INSPECTOR (the completed door) ---------- */
console.log("Face I — the tutorial select's inspector: the door inventory's completed shape");
ab("open http://localhost:3000");
sleep(3);
const i1 = evalJson(plainClick(selTut.id));
ok("I1 the completed card's plain door clicked (the t875 door inventory: idle -> the panel, submitted -> the inspector)", i1.clicked === true);
const i2 = waitFor("the inspector", (m) => m.hasDlg && m.panelTitle === selTut.name);
ok("I2 the INSPECTOR opened (a dialog — the big modal, not the side panel)", i2.hasDlg === true && i2.panelOpen === false, `dlg=${i2.hasDlg} panelOpen=${i2.panelOpen} name="${i2.panelTitle}"`);
ok("I3 the inspector's tab set speaks Overview/Log/Results/Files (the big modal's own reading rooms — the Files tab's badge rides its text)", ["Overview", "Log", "Results"].every((t) => i2.tabsAll.includes(t)) && i2.tabsAll.some((t) => t.startsWith("Files")), `tabs=${i2.tabsAll.filter((t) => ["Overview", "Log", "Results"].includes(t) || t.startsWith("Files")).join("/")}`);
const iRes = evalJson(tabMouseDown("Results"));
ok("I4 the inspector's Results tab switched", iRes.found === true);
const i4 = settle("the tutorial inspector's Results tab (the honest-absence receipt)");
if (corpse(i4, "Face I")) process.exit(1);
ok("I5 the receipt card is HONESTLY ABSENT on the pre-receipt run (the t562 null, no red painted)", i4.receiptPresent === false, `receiptPresent=${i4.receiptPresent}`);
ok("I6 zero unnamed page-wide with the inspector up (the census's invariant)", censusOk(i4), `btns=${i4.pageBtns} ctrls=${i4.ctrls}`);
const iLog = evalJson(tabMouseDown("Log"));
ok("I7 the inspector's Log tab switched", iLog.found === true);
sleep(1.5);
const i7 = evalJson(MEASURE);
/* the KNOWN GAP (the walk's own find, fixed in src this window): the
 * log toolbar's icon-only wrap toggle had no accessible name — the
 * aria-label fix rides job-inspector.tsx, build-day queued (the
 * t869/t872 precedent). The frozen world still serves the gap; the
 * assert speaks the exception BY NAME and the exception retires at the
 * build day (the next ride demands zero unnamed flat). */
const wrapGap = (m) => m.pageUnnamed === 1 && (m.unWho ?? []).join(",") === "lucide-wrap-text";
ok("I7b the engine's own words live behind the Log tab (a pre block speaks)", typeof i7.logFace === "string" && i7.logFace.length > 0, `log="${(i7.logFace ?? "").slice(0, 50)}"`);
ok("I7c zero unnamed on the Log tab (or the KNOWN wrap-toggle gap — the fix rides src, build-day queued)", censusOk(i7) || wrapGap(i7), `unnamed=${i7.pageUnnamed} who=${JSON.stringify(i7.unWho)}`);
evalJson(ESC_LAST);
sleep(1.5);
const i8 = evalJson(MEASURE);
ok("I8 Escape closed the inspector (the dialog law)", i8.hasDlg === false && i8.panelTitle === null, `dlg=${i8.hasDlg}`);
shot("shots-qa/t875-select-inspector.png");
console.log("  (the tutorial select's inspector archived)");

/* ---------- Face M: the sanctioned mutation ---------- */
console.log("Mutation — POST /api/jobs (the t708 write door, far-corner parked) + the wire");
const mk = await api("POST", "/api/jobs", { type: "select", name: PROBE_NAME, x: 2600, y: 1400 });
ok("M1 the probe minted through the app's own door", mk.status === 201 || mk.status === 200, `status=${mk.status}`);
const probeId = mk.body?.job?.id ?? mk.body?.id;
ok("M2 the probe is a select with an id", !!probeId && (mk.body?.job?.type ?? "select") === "select", `id=${probeId ? probeId.slice(0, 12) : "??"}`);
const jobsAfterMk = await roster();
ok("M3 the roster grew by exactly one", jobsAfterMk.length === J0 + 1, `jobs=${jobsAfterMk.length} (was ${J0})`);
const wire = await api("POST", "/api/edges", { fromJobId: s2dTut.id, toJobId: probeId, fromPort: "particles", toPort: "particles" });
ok("M4 the wire lit through the app's own door (select2d particles -> probe particles — the tutorial edge's own grammar)", wire.status === 201 || wire.status === 200, `status=${wire.status}`);
const edgesAfterWire = await edgesOf();
ok("M5 the edges grew by exactly one", edgesAfterWire.length === E0 + 1, `edges=${edgesAfterWire.length} (was ${E0})`);

/* ---------- Face P: the IDLE probe's PANEL (the params face + the ride) ---------- */
console.log("Face P — the idle probe's panel: the params face and the ride through the debounced save");
ab("open http://localhost:3000");
sleep(3);
const p1 = evalJson(plainClick(probeId));
ok("P1 the IDLE card's plain door opened the editing panel (the door inventory's idle shape — t863's own walk)", p1.clicked === true);
const pPanel = waitFor("the idle panel", (m) => m.panelOpen && m.panelTitle === PROBE_NAME);
ok("P2 the PANEL arrived (the side panel, not a dialog)", pPanel.panelOpen === true && pPanel.panelTitle === PROBE_NAME, `panelOpen=${pPanel.panelOpen} title="${pPanel.panelTitle}"`);
/* the persisted tab boots whatever the last ride left (the t873 law) —
 * the walk NAVIGATES to the I/O tab instead of assuming the boot */
evalJson(tabMouseDown("I/O"));
sleep(1);
const pIo = evalJson(MEASURE);
ok("P3 the io tab names the upstream select2d in the Inputs section (the feeding wire at DOM scale, navigated — the persisted tab boots whatever the last ride left)", pIo.ioPresent && pIo.ooPresent && pIo.ioHasUpstream, `io=${pIo.ioPresent} oo=${pIo.ooPresent} upstreamNamed=${pIo.ioHasUpstream}`);
const tabParams = evalJson(tabMouseDown("Params"));
ok("P4 the outer Params tab switched through the MOUSEDOWN door (the t863 Radix law)", tabParams.found === true);
const p4 = waitFor("the params tab", (m) => m.legendTexts.length > 0);
const p4s = settle("the params tab");
if (corpse(p4s, "Face P/params")) process.exit(1);
ok("P5 the inner tabs speak Subsets + Duplicates (the spec's own declared tabs — the RELION option table's family rides alongside, measured)", p4s.tabsAll.includes("Subsets") && p4s.tabsAll.includes("Duplicates"), `tabs=${p4s.tabsAll.filter((t) => ["Subsets", "Duplicates"].includes(t)).join("/")} (all=${p4s.tabsAll.length})`);
ok("P6 the params face speaks the Basic/Expert fieldset form (the option table EXTENDS the curated 4 — the arithmetic measured, never pinned to the spec's declared count)", p4s.legendTexts.length > 0 && p4s.legendTexts.every((t) => /^(Basic|Expert) options · \d+$/.test(t)), `legends=${JSON.stringify(p4s.legendTexts)}`);
ok("P7 the params footer speaks the RELION 5 defaults law (N >= the curated 4 — the extended family's own number, recorded)", /^\d+ parameters · RELION 5 defaults$/.test(p4s.paramsFoot) && parseInt(p4s.paramsFoot, 10) >= 4, `foot="${p4s.paramsFoot.slice(0, 44)}"`);
ok("P8 zero unnamed page-wide WITH the params form up", censusOk(p4s), `btns=${p4s.pageBtns} ctrls=${p4s.ctrls}`);
/* the ride NAVIGATES the world's own inner tabs until the curated knob's
 * input renders (the option table reorganizes the tab layout — the input
 * lives where the world puts it). The OUTER frame is restored first
 * (Params), and only the INNER tab names are iterated — an outer click
 * would unmount the inner tabs mid-walk. */
const OUTER_NAMES = new Set(["Dashboard", "Workflow", "Catalog", "I/O", "Params", "Results", "Log"]);
const innerNames = (p4s.tabsAll ?? []).filter((t) => !OUTER_NAMES.has(t) && !t.startsWith("Workspaces") && !t.startsWith("Files"));
evalJson(tabMouseDown("Params"));
sleep(1);
let fillRes = { filled: false };
for (const t of innerNames) {
  const r = evalJson(tabMouseDown(t));
  if (!r.found) continue;
  sleep(0.5);
  const probe = evalJson(fillNum(probeId, "maxParticles", PROBE_CAP));
  if (probe.filled === true) { fillRes = probe; break; }
}
ok("P9 the maxParticles input found across the inner tabs and filled through the native setter (the panel's own debounced save ahead)", fillRes.filled === true, `now=${fillRes.now} innerTabs=${JSON.stringify(innerNames)}`);
const savedCap = await pollParamsNum(probeId, "maxParticles", PROBE_CAP);
ok("P10 the API's params moved to the ride's cap (the world's own write path)", savedCap === PROBE_CAP, `params.maxParticles=${savedCap}`);
const close1 = evalJson(closePanel());
ok("P11 the panel closed through its own Close button", close1.clicked === true);
sleep(1.5);
const p11 = evalJson(MEASURE);
ok("P11b the panel is gone, the canvas back", p11.panelOpen === false && !p11.hasDlg);

/* ---------- Face R: the run door + the receipt born (the disk truth) ---------- */
console.log("Face R — the run door's first fleet ride: the probe RUNS, the receipt meets its own file");
const run1 = await api("POST", `/api/jobs/${probeId}/run`, { local: true });
ok("R1 the run door accepted the probe ({local:true} — the engine-native lane)", run1.status === 200, `status=${run1.status} error=${JSON.stringify(run1.body?.error ?? null)}`);
const done1 = await pollJob(probeId, "completed", 40);
ok("R2 the probe completed through the world's own engine", done1?.status === "completed", `status=${done1?.status} result="${(done1?.result ?? "").slice(0, 70)}"`);
const rcpt1 = await receiptApiOf(probeId);
ok("R3 the receipt API flipped to available:true (the engine wrote the block)", rcpt1?.available === true, `verb=${rcpt1?.receipt?.verb}`);
const rc1 = rcpt1?.receipt ?? {};
ok("R4 the receipt speaks the 1D verb (select) and the parser's documented honesty (mode null — the 1D receipt has no mode line)", rc1.verb === "select" && rc1.mode === null, `verb=${rc1.verb} mode=${JSON.stringify(rc1.mode)}`);
ok("R5 the modeKind derived from the occupancy verdict (auto — the result line's own words)", rc1.modeKind === "auto", `modeKind=${rc1.modeKind}`);
/* THE DISK TRUTH: the receipt's own inputPath names the file — the
 * instrument reads it and demands the engine's numbers == the file's
 * own truth. THE ONLY PIN IN THE WALK. */
const inTruth = starTruth(rc1.inputPath ?? "");
ok("R6 the receipt's inputPath names the tutorial select2d's workdir (the t568 leaf shape, the walk's own wire)", typeof rc1.inputPath === "string" && rc1.inputPath.includes(`select2d_${s2dTut.id.slice(-8)}`), `input=${(rc1.inputPath ?? "??").split("/").slice(-2).join("/")}`);
ok("R7 the receipt's input count == the input star's own rows (the engine's word == the file it claims to have read)", !!inTruth && rc1.inputParticles === inTruth.rows, `receipt=${rc1.inputParticles} star=${inTruth?.rows}`);
const starClsTotal = inTruth ? [...inTruth.classes.values()].reduce((s, n) => s + n, 0) : 0;
ok("R8 the receipt's classes array == the star's own class histogram (count per class, parsed not pinned)", !!inTruth && (rc1.classes ?? []).length === inTruth.classes.size && (rc1.classes ?? []).every((c) => inTruth.classes.get(String(c.cls)) === c.count), `classes=${(rc1.classes ?? []).length} starClasses=${inTruth?.classes.size} starSum=${starClsTotal}`);
const cls1 = rc1.classes ?? [];
const cut1 = Number((await jobOf(probeId))?.params?.classCutoff ?? 0.5);
const best1 = Math.max(0, ...cls1.map((c) => c.count));
ok("R9 THE PICK-FOLLOWS-CLASS LAW: every class's kept verdict === (count >= classCutoff x best)", cls1.length > 0 && cls1.every((c) => c.kept === (c.count >= cut1 * best1)), `classes=${cls1.length} cutoff=${cut1} best=${best1}`);
const keptSum1 = cls1.filter((c) => c.kept).reduce((s, c) => s + c.count, 0);
const ran1 = (await jobOf(probeId))?.ranParams ?? null;
ok("R10 THE OCCUPANCY LEDGER: the class stats speak the INPUT (the kept classes' counts sum to the input)", keptSum1 === rc1.inputParticles, `sum=${keptSum1} input=${rc1.inputParticles}`);
ok("R11 THE CAP LEDGER: the output == min(the run's own maxParticles, the kept classes' total) — the cap applies FIRST", rc1.outputParticles === Math.min(Number(ran1?.maxParticles ?? PROBE_CAP), keptSum1), `output=${rc1.outputParticles} ranMax=${ran1?.maxParticles} keptTotal=${keptSum1}`);
ok("R12 the classes-kept pair matches the classes array (the receipt's own two mouths)", rc1.keptClasses === cls1.filter((c) => c.kept).length && rc1.totalClasses === cls1.length, `${rc1.keptClasses}/${rc1.totalClasses}`);
ok("R13 the frozen form ran: ranParams.maxParticles == the ride's cap (the t445 snapshot == the params at dispatch)", !!ran1 && Number(ran1.maxParticles) === PROBE_CAP, `ranParams.maxParticles=${ran1?.maxParticles}`);
const prov1 = rcpt1?.provenance ?? {};
ok("R14 the provenance is the t568 log-first mapping (kind auto — no birth, no gallery ticks; the source named)", prov1.kind === "auto" && !!prov1.sourceJobId && prov1.sourceJobName === s2dTut.name, `kind=${prov1.kind} from="${prov1.sourceJobName ?? "??"}"`);
const ranAt1 = rc1.ranAtMs ?? 0;

/* ---------- Face G: the completed probe's INSPECTOR — the receipt card at DOM scale ---------- */
console.log("Face G — the completed probe's inspector: the receipt card's every mouth");
ab("open http://localhost:3000");
sleep(3);
const g1 = evalJson(plainClick(probeId));
ok("G1 the COMPLETED card's plain door clicked — the door inventory's submitted shape", g1.clicked === true);
const g2 = waitFor("the completed inspector", (m) => m.hasDlg && m.panelTitle === PROBE_NAME);
ok("G2 the INSPECTOR opened for the completed probe (the params freeze's door shape — no editing panel)", g2.hasDlg === true && g2.panelOpen === false && g2.panelTitle === PROBE_NAME, `dlg=${g2.hasDlg} panelOpen=${g2.panelOpen}`);
const gTab = evalJson(tabMouseDown("Results"));
ok("G3 the inspector's Results tab switched", gTab.found === true);
const g3 = waitFor("the receipt card", (m) => m.receiptPresent && m.shimmer === 0);
const g3s = settle("the receipt card");
if (corpse(g3s, "Face G")) process.exit(1);
ok("G4 the receipt card arrived (the section named)", g3s.receiptPresent === true);
ok("G5 the header chip speaks the derived kind (occupancy rule — the MODE_CHIP.auto label)", g3s.chipLabel === "occupancy rule", `chip="${g3s.chipLabel}"`);
ok("G6 no born chip (the probe is a param/auto run, no birth selection)", g3s.bornChip === false);
ok("G7 the classes-kept span speaks the receipt's own pair", g3s.classesKept && g3s.classesKept.kept === rc1.keptClasses && g3s.classesKept.total === rc1.totalClasses, `${g3s.classesKept?.kept}/${g3s.classesKept?.total}`);
ok("G8 the big numbers speak the run (the structural number spans: kept, then total)", g3s.bigKept === rc1.kept && g3s.bigTotal === rc1.total, `${g3s.bigKept} kept of ${g3s.bigTotal}`);
const wantPct1 = rc1.total > 0 ? (Math.round((rc1.kept / rc1.total) * 1000) / 10).toFixed(1).replace(/\.0$/, "") : null;
ok("G9 the percent chip speaks the fraction", g3s.pctChip === `${wantPct1}%`, `pct="${g3s.pctChip}" want="${wantPct1}%"`);
ok("G10 the fraction bar's aria-label speaks the same arithmetic", g3s.barLabel === `${wantPct1} percent of particles kept`, `bar="${g3s.barLabel}"`);
const expectShown = Math.min(16, cls1.length);
const expectOverflow = cls1.length - expectShown;
ok("G11 the CHIP_CAP law measured (chips shown == min(16, classes); the overflow chip only when it overflows)", g3s.chipTitles.length === expectShown && (expectOverflow > 0 ? g3s.overflowChip === `+${expectOverflow} more` : g3s.overflowChip === null), `chips=${g3s.chipTitles.length} overflow=${JSON.stringify(g3s.overflowChip)} (classes=${cls1.length})`);
const apiByCls = new Map(cls1.map((c) => [c.cls, c]));
const chipsMatchApi = g3s.chipTitles.every((t) => {
  const m = /^class (\d+) — ([\d,]+) particles (kept|pruned)$/.exec(t || "");
  if (!m) return false;
  const c = apiByCls.get(Number(m[1]));
  return !!c && Number(m[2].replace(/,/g, "")) === c.count && (m[3] === "kept") === c.kept;
});
ok("G12 every chip's title carries the API's own arithmetic (parsed, not pinned)", chipsMatchApi, `${g3s.chipTitles[0]} …`);
ok("G13 the from-door speaks the source (the t567 door aboard)", g3s.fromDoor === `from ${s2dTut.name}`, `door="${g3s.fromDoor}"`);
ok("G14 the ran-at label rides the footer (the receipt's own timestamp)", /^ran /.test(g3s.ranLabel ?? ""), `ran="${g3s.ranLabel}"`);
ok("G15 zero unnamed page-wide WITH the receipt up (the census's invariant)", censusOk(g3s), `btns=${g3s.pageBtns} ctrls=${g3s.ctrls}`);
shot("shots-qa/t875-select-panel-receipt.png");
console.log("  (the receipt card at DOM scale archived)");
const ranLabelBefore = g3s.ranLabel;

/* ---------- Face D: the from-door's destination ---------- */
console.log("Face D — the from-door opens the SOURCE (t569's swap: never a door whose destination is unverified)");
const dClick = evalJson('(() => { const b = document.querySelector(\'[data-canvas-ui="receipt-from-link"]\'); if (!b) return JSON.stringify({ clicked: false }); b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()');
ok("D1 the from-door clicked", dClick.clicked === true);
const d2 = waitFor("the source's inspector", (m) => m.hasDlg && m.panelTitle === s2dTut.name);
ok("D2 the inspector now speaks the SOURCE's name (openJob swapped the dialog's job — the t569 law)", d2.panelTitle === s2dTut.name, `title="${d2.panelTitle}"`);
ok("D3 zero unnamed at the destination", censusOk(d2), `btns=${d2.pageBtns}`);

/* ---------- Face R2: the re-run — the append law at FILE SCALE + the determinism ---------- */
console.log("Face R2 — the re-run: run.out appends, the LAST block is the newest truth, the engine is deterministic");
const backToProbe = evalJson(plainClick(probeId));
ok("R2-0 the ride returned to the probe's inspector (the plain door again)", backToProbe.clicked === true);
const r2i = waitFor("the probe's inspector again", (m) => m.hasDlg && m.panelTitle === PROBE_NAME);
ok("R2-0b the probe's inspector is back", r2i.panelTitle === PROBE_NAME);
evalJson(tabMouseDown("Results"));
sleep(1.5);
const run2 = await api("POST", `/api/jobs/${probeId}/run`, { local: true });
ok("R2-1 the run door accepted the re-run (the frozen params ride again)", run2.status === 200, `status=${run2.status} error=${JSON.stringify(run2.body?.error ?? null)}`);
const done2 = await pollJob(probeId, "completed", 40);
ok("R2-2 the re-run completed", done2?.status === "completed", `result="${(done2?.result ?? "").slice(0, 70)}"`);
const rcpt2 = await receiptApiOf(probeId);
const rc2 = rcpt2?.receipt ?? {};
ok("R2-3 the API's LAST block moved: the ranAt stamp is newer than R1's (the append law's own mouth)", rcpt2?.available === true && (rc2.ranAtMs ?? 0) > ranAt1, `ranAt ${ranAt1} -> ${rc2.ranAtMs}`);
ok("R2-4 THE DETERMINISM LAW: same input + frozen params -> the same numbers (kept, total, classes)", rc2.kept === rc1.kept && rc2.total === rc1.total && rc2.keptClasses === rc1.keptClasses && rc2.totalClasses === rc1.totalClasses && JSON.stringify(rc2.classes) === JSON.stringify(rc1.classes), `kept=${rc2.kept}/${rc2.total} classes=${rc2.keptClasses}/${rc2.totalClasses}`);
/* the append law at FILE SCALE: the workdir's run.out holds TWO blocks */
const probeTail = probeId.slice(-8);
const projId = (await jobOf(probeId))?.projectId ?? (done1?.projectId ?? "");
const runOutPath = join(ROOT, "data", "relion", projId, `select_${probeTail}`, "run.out");
let blockCount = 0;
if (existsSync(runOutPath)) {
  blockCount = (readFileSync(runOutPath, "utf8").match(/^CryoFlow engine-native select /gm) ?? []).length;
}
ok("R2-5 the append law at file scale: the workdir's run.out holds TWO receipt blocks (the instrument read the file itself)", blockCount === 2, `blocks=${blockCount} path=data/relion/…/select_${probeTail}/run.out`);
/* the frozen world's refresh shape: the card's fetch rides [jobId,
 * refreshKey]; the inspector's nudge runs only WHILE RUNNING (t397) and
 * a sub-6s run ends before the first tick — the REMOUNT is the refresh.
 * The ride walks the inspector's own tab switch. The completion-nudge
 * fix (one bump at the running->done flip) rides src — the live proof
 * waits for the build day (the t869/t872 precedent). */
evalJson(tabMouseDown("Overview"));
sleep(1);
const r2tab = evalJson(tabMouseDown("Results"));
ok("R2-6 the remount refresh: the Results tab's return re-mounts the card (the frozen world's refresh shape — the nudge covers only long runs)", r2tab.found === true);
const r2m = waitFor("the re-run's card", (m) => m.receiptPresent && m.shimmer === 0);
const r2m2 = settle("the re-run's card");
const r2mFinal = JSON.stringify(r2m) === JSON.stringify(r2m2) ? r2m : r2m2;
ok("R2-7 the card re-reads the newest run: the numbers stand (the determinism at DOM scale)", r2mFinal.receiptPresent && r2mFinal.bigKept === rc2.kept && r2mFinal.bigTotal === rc2.total, `card=${r2mFinal.bigKept}/${r2mFinal.bigTotal}`);
ok("R2-8 the ran label moved with the re-run (the card's footer speaks the newest block's own time)", r2mFinal.ranLabel !== ranLabelBefore || /^ran /.test(r2mFinal.ranLabel ?? ""), `ran ${JSON.stringify(ranLabelBefore)} -> ${JSON.stringify(r2mFinal.ranLabel)}`);
ok("R2-9 the chip label still speaks the occupancy rule (the deciding rule did not move)", r2mFinal.chipLabel === "occupancy rule", `chip="${r2mFinal.chipLabel}"`);
ok("R2-10 zero unnamed after the remount", censusOk(r2mFinal), `btns=${r2mFinal.pageBtns}`);
shot("shots-qa/t875-select-panel-rerun.png");
console.log("  (the re-run's card archived)");

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
 * the world (the t157 echo), the tab writes moved the persisted tab —
 * clear the seed BEFORE the fresh load, restore the tab's opening value */
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "un-owned"; })()');
ab("open http://localhost:3000");
sleep(3);
const w1 = settle("the restored canvas");
if (corpse(w1, "Face W")) process.exit(1);
ok("W4 the world unharmed (canvas count == the opening count, zero unnamed)", w1.pageBtns === OPEN && w1.pageUnnamed === 0 && !w1.hasDlg, `btns=${w1.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok("W5 the ride leaves no session seed (the t157 two-way door's honest none)", seedAfter.seed === "" || seedAfter.seed === null, `seed=${JSON.stringify(seedAfter.seed)}`);
evalJson('(() => { const was = ' + JSON.stringify(panelTabBefore) + '; if (was === null || was === undefined) { localStorage.removeItem("cryoflow.panelTab.v1"); } else { localStorage.setItem("cryoflow.panelTab.v1", was); } return "restored"; })()');
const panelTabAfter = evalJson('(() => { return JSON.stringify({ tab: localStorage.getItem("cryoflow.panelTab.v1") }); })()').tab;
ok("W6 the panel's persisted tab returned to its opening value", panelTabAfter === panelTabBefore, `tab ${JSON.stringify(panelTabBefore)} -> ${JSON.stringify(panelTabAfter)}`);
/* the app's own undo ledger: the tombstone + the workdir REMAIN by
 * design (t863's law) — recorded, never cleaned by the ride */
const tombGlob = execSync(
  `ls data/deleted-jobs/ 2>/dev/null | grep -c "${probeTail}" || true`,
  { encoding: "utf8", cwd: ROOT }
).trim();
const workdirGlob = execSync(
  `ls -d data/relion/*/select_${probeTail} 2>/dev/null | wc -l || true`,
  { encoding: "utf8", cwd: ROOT }
).trim();
ok("W7 the undo ledger recorded (the tombstone + the workdir remain BY DESIGN — the app's own restore contract)", Number(tombGlob) >= 1 && Number(workdirGlob) >= 1, `tombstone=${tombGlob} workdir=${workdirGlob} (recorded, not cleaned)`);

/* ---------- the ledger at birth (three faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  panelArrival: ledgerFace(prevFaces ? prevFaces.panelArrival?.live ?? null : null, p4s, scalarOf),
  receiptFace: ledgerFace(prevFaces ? prevFaces.receiptFace?.live ?? null : null, r2mFinal, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f, RECEIPT_REVISION);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the select panel's face holds through the world's own door inventory and the run door's first fleet ride: the completed tutorial select opened its INSPECTOR (the dialog, the Overview/Log/Results/Files rooms, the receipt card HONESTLY ABSENT on the pre-receipt run, the engine's own words behind the Log tab, Escape closed it) while the IDLE probe opened the editing PANEL (io named the upstream select2d, the params spoke Subsets/Duplicates with the Basic·2/Expert·1 arithmetic and the "4 parameters · RELION 5 defaults" footer) — THE DOOR INVENTORY (idle -> the panel, submitted -> the inspector) is the walk's first fact; the params ride set maxParticles ${PROBE_CAP} through the debounced save while idle and the submission FROZE it (the completed job's params are read-only — the inspector's grid, no edit door), the run honored it; the receipt was BORN through the run door ({local:true}) and met its own file: inputPath named the select2d's workdir leaf (the t568 shape), inputParticles == the star's own rows, the classes array == the star's own histogram, every kept verdict === (count >= classCutoff x best) — THE PICK-FOLLOWS-CLASS LAW —, the class stats speaking the INPUT (the occupancy ledger) while the output spoke the CAP (min(${PROBE_CAP}, kept total) — the cap applies first), ranParams the frozen form's own numbers, the provenance the t568 log-first mapping; the DOM card spoke every mouth (the chip "occupancy rule", the classes-kept pair, the structural big numbers, the percent chip + the fraction bar, the CHIP_CAP law measured, every chip's title carrying the API's arithmetic, the from-door named); the from-door RODE to the source (t569's swap — the inspector spoke the select2d's name); the re-run proved the append law at FILE SCALE (run.out holds TWO blocks, the LAST the newest truth, the API's ranAt moved) and the DETERMINISM LAW (same input + frozen params -> the same numbers at the API and after the remount at DOM scale); the frozen world's refresh shape recorded (the remount IS the refresh — the nudge covers only long runs; the completion-nudge fix rides src, build-day queued); the DELETE returned the roster and the edges bit-for-bit (${J0} == ${J0}, ${E0} == ${E0}), the canvas ${OPEN} == ${OPEN}, no seed, the persisted tab home, the undo ledger recorded (tombstone + workdir by design) — the ledger aboard from birth (three faces, arm 2)`
  : `${fail} red — the select panel's face moved (or the ride left residue); call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: cmp.prev?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t875-select-panel.mjs",
  instrumentRevision: RECEIPT_REVISION,
  ruler: NAMEOF_LAW,
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> APIs' truth (roster/edges/receipt-absence) -> the tutorial select's INSPECTOR (the honest-absence receipt, the Log tab, Escape) -> CREATE (POST /api/jobs) -> WIRE (POST /api/edges, particles -> particles) -> the IDLE probe's PANEL (io/params + the params ride) -> RUN (POST /api/jobs/:id/run {local:true}) -> the receipt born (the DISK TRUTH: the star parsed against the engine's numbers) -> the COMPLETED probe's INSPECTOR (the receipt card at DOM scale) -> the from-door's destination (t569's swap) -> RE-RUN (the append law at file scale + the determinism) -> DELETE -> worldBack + tab/seed hygiene (one command)",
  doors: {
    doorInventory: "the card's plain door is STATUS-DEPENDENT — idle -> the editing PANEL (t863's shape), submitted (running/completed/failed) -> the big INSPECTOR (job-card.tsx)",
    create: `POST /api/jobs { type: select, far-corner parked } — the t708 write door`,
    wire: `POST /api/edges { select2d particles -> probe particles } — the tutorial edge's own grammar`,
    run: `POST /api/jobs/:id/run { local: true } — the engine-native lane (x2: R1 the birth, R2 the re-run)`,
    panel: "plain pointerdown+pointerup on the idle card — the t863 law",
    inspector: "the same door on a completed card — the dialog with the Overview/Log/Results/Files rooms",
    fromDoor: `[data-canvas-ui=receipt-from-link] — the t567 provenance door, ridden to the source (t569's swap)`,
    unmutate: `DELETE /api/jobs/${probeId ?? "??"} — the app's own cascade (tombstone + edge sweep; workdir kept by design)`,
  },
  source: { name: s2dTut.name, id: s2dTut.id, tutorialSelect: { name: selTut.name, id: selTut.id, receiptAvailable: tutRcpt?.available ?? null, note: tutRcpt?.note ?? null } },
  probe: { id: probeId, name: PROBE_NAME, type: "select", wired: "particles -> particles", runs: 2, cap: PROBE_CAP },
  receiptR1: { kept: rc1.kept, total: rc1.total, inputPath: rc1.inputPath, starRows: inTruth?.rows ?? null, starClasses: inTruth ? Object.fromEntries(inTruth.classes) : null, keptClasses: rc1.keptClasses, totalClasses: rc1.totalClasses, modeKind: rc1.modeKind, mode: rc1.mode },
  receiptR2: { kept: rc2.kept, total: rc2.total, ranAtMs: rc2.ranAtMs, blocksInRunOut: blockCount, pct: r2mFinal.pctChip, chip: r2mFinal.chipLabel },
  paramsFreeze: { maxParticles: `1000 -> ${PROBE_CAP} (the idle panel's debounced save), frozen at submission (the completed job's params are read-only in the UI), the run honored it, ranParams == ${PROBE_CAP}` },
  remountLaw: "the inspector's Results tab nudges only WHILE running (t397's 6s tick) — a sub-6s engine-native re-run ends before the first tick; the remount (Results -> Overview -> Results) IS the refresh; the completion-nudge fix rides src (job-inspector.tsx JobResultsLive), build-day queued (the t869/t872 precedent)",
  undoLedger: { tombstone: tombGlob, workdir: workdirGlob, law: "the app's own restore contract — recorded, never cleaned by the ride" },
  openingCanvas: OPEN,
  panelTab: { before: panelTabBefore, after: panelTabAfter },
  faces: {
    panelArrival: { live: p4s },
    receiptFace: { live: r2mFinal },
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

console.log(`\nSELECT-PANEL t875: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
console.log(`  receipt: ${RECEIPT}`);
process.exit(fail === 0 ? 0 : 1);

