#!/usr/bin/env node
/**
 * t872 — the SYSTEM DIAGNOSTICS dialog's faces: the box behind the canvas
 * (src/components/workflow/system-diagnostics-dialog.tsx, 431 lines, t530),
 * the rotation's next un-walked room, walked live with the SHARED RULER.
 *
 * The rotation: ... -> find bar (t870) -> workspace panel (t871) -> THIS room.
 *
 * The surface (a Radix Dialog over the compiled `/` route — the t870
 * single-page peace: zero compile, the walk's price is patience):
 *
 *   O   the clean room — the dialog is summoned, never resident; the
 *       header's Activity door is named ("System diagnostics").
 *   Q   the palette's reverse-hop door (the t530 handshake's second
 *       door): the palette names the command ("Open system diagnostics",
 *       value "system diagnostics memory lanes disk build guard
 *       provenance census vitals health"), Enter closes the palette and
 *       the header opens the panel — two modal layers, one handshake.
 *   D   the header door — the Activity button opens the readings: the
 *       title, the description's contract, the t802 keyboard region
 *       (role=region + tabIndex 0 + the roster's dialect name), the four
 *       section cards, zero unnamed page-wide.
 *   M   the memory lanes — the verdict tone (Healthy|Watch|Danger), the
 *       two LaneBars as role=img with their canonical lines spoken IN
 *       the aria-label ("Available: X of Y; GO 2600", "Page cache
 *       (buff/cache): X of Y; warm 1450"), the verdict reason (the why),
 *       the legend teaching the t524 watchdog line (one process, not
 *       the box).
 *   E   the engine & disk — the engine section speaks exactly ONE honest
 *       state (found | build | none — the two-wells mirror law, t242);
 *       the disk lane named with its % note (t527's tree-external
 *       sharers).
 *   C   the world census — the three tiles cross-checked against the
 *       canvas the walk opened with (the census's Jobs tile == the
 *       canvas's job cards: the world's own census agreeing with the
 *       world it sees — the ADOPT invariant made visible).
 *   P   the provenance — exactly one of {commit code, the honest
 *       "No provenance stamp" line} speaks, never both, never neither.
 *   R   the refresh seat — the footer speaks "read at", the Refresh door
 *       named; the click re-reads honestly (enabled again, no failed).
 *   K   the t802 keyboard seat — the region takes focus, ArrowDown
 *       scrolls it (or there is nothing to scroll — the honest either).
 *   B   the world back — Escape closes, the canvas bit-for-bit, no
 *       session seed.
 *
 * The ARRIVAL PREDICATE (the t871 law's own teeth on this face): the
 * dialog fetches /api/diagnostics on first open — a skeleton dialog
 * (title + HonestEmpties + "not read yet") is perfectly stable and
 * perfectly incomplete. The settle waits for the panel's own word:
 * the footer speaking "read at". The panel SAYS when its numbers came
 * home — the predicate reads the world's word, never a clock.
 *
 * The ledger aboard from birth (three faces: diagDialog / readings /
 * worldBack — the t861 birthright, the t869 arrival guard + the t871
 * arrival predicate riding the settle).
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
const cmp = loadComparator(ROOT, "shots-qa/t872-system-diagnostics-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t872 system-diagnostics a11y walk — world ${world.mode}:${buildId}, the box behind the canvas through the shared ruler\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* ---------- the measures. The WORLD measure films the whole page; the
 * DIAG measure films the dialog's own seats. NO ${} inside — the shell
 * reads these strings. */
const WORLD_MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const dlg = document.querySelector("[role=dialog]"); const ip = document.querySelector("[cmdk-input]"); return JSON.stringify({ pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 4).map((b) => String(b.className).slice(0, 44)), hasDlg: !!dlg, cmdkUp: !!ip, door: !!document.querySelector(\'button[aria-label="System diagnostics"]\'), dlgHeading: dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

const DIAG_MEASURE =
  '(() => { ' + NAMEOF + ' const dlg = document.querySelector("[role=dialog]"); if (!dlg) return JSON.stringify({ up: false }); const sec = (t) => dlg.querySelector("[data-testid=" + JSON.stringify(t) + "]"); const region = dlg.querySelector("div[role=region]"); const title = ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim(); const descEl = dlg.querySelector("[data-slot=dialog-description]"); const mem = sec("diag-memory"); const lanes = Array.from(dlg.querySelectorAll("[role=img]")).map((l) => l.getAttribute("aria-label")); const verdictEl = dlg.querySelector("[data-testid=diag-verdict]"); const verdict = verdictEl ? verdictEl.textContent.replace(/\\s+/g, " ").trim().slice(0, 60) : null; const memPs = mem ? Array.from(mem.querySelectorAll("p")) : []; const reason = mem ? (mem.querySelector(\'p[class*="bg-muted"]\') || {}).textContent : null; const legend = memPs.length ? memPs.at(-1).textContent.trim() : null; const eng = sec("diag-engine"); const engState = sec("diag-engine-found") ? "found" : sec("diag-engine-build") ? "build" : sec("diag-engine-none") ? "none" : eng && eng.querySelector("[data-testid=diag-empty]") ? "empty" : "missing"; const engText = eng ? eng.textContent.replace(/\\s+/g, " ").trim().slice(0, 80) : null; const disk = sec("diag-disk"); const diskNote = disk ? (Array.from(disk.querySelectorAll("p")).map((p) => p.textContent.trim()).find((t) => /% used/.test(t)) || null) : null; const worldSec = sec("diag-world"); const tiles = worldSec && sec("diag-census") ? Array.from(sec("diag-census").querySelectorAll(":scope > div")).map((d) => { const ps = d.querySelectorAll("p"); return { value: ps[0] ? ps[0].textContent.trim() : null, label: ps[1] ? ps[1].textContent.trim() : null }; }) : []; const prov = dlg.querySelector("[data-testid=diag-provenance]"); const provCode = prov ? (prov.querySelector("code") || {}).textContent : null; const provHonest = worldSec && /No provenance stamp/.test(worldSec.textContent || ""); const gen = dlg.querySelector("[data-testid=diag-generated]"); const refreshBtn = Array.from(dlg.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Refresh diagnostics"); const failed = !!dlg.querySelector("[data-testid=diag-failed]"); const dlgBtns = Array.from(dlg.querySelectorAll("button")); const dlgUn = dlgBtns.filter((b) => !nameOf(b)); const unnamedInDlg = dlg.querySelectorAll("button,input,select,textarea,[role=img]").length; const dlgUnnamedAll = Array.from(dlg.querySelectorAll("button,input,select,textarea,[role=img]")).filter((el) => !nameOf(el)).length; return JSON.stringify({ up: true, title, desc: descEl ? descEl.textContent.trim().slice(0, 140) : null, region: region ? { role: region.getAttribute("role"), label: region.getAttribute("aria-label"), tabbable: region.tabIndex === 0 } : null, sections: ["diag-memory", "diag-engine", "diag-disk", "diag-world"].map((t) => { const s = sec(t); const h = s ? s.querySelector("h3") : null; return { t, up: !!s, h3: h ? h.textContent.trim() : null }; }), verdict, lanes, reason: reason ? reason.trim().slice(0, 160) : null, legend, engState, engText, diskNote, tiles, prov: prov ? { code: provCode } : provHonest ? { honestNone: true } : null, generated: gen ? gen.textContent.trim() : null, refresh: refreshBtn ? { named: true, disabled: refreshBtn.disabled, label: refreshBtn.textContent.trim() } : null, failed, dlgBtns: dlgBtns.length, dlgUnnamed: dlgUn.length, dlgUnnamedAll, focusIn: dlg.contains(document.activeElement) }); })()';

const CARD_COUNT =
  '(() => { const cards = Array.from(document.querySelectorAll("div[role=button]")).filter((el) => !el.closest("[aria-label=Workspaces]")); return JSON.stringify({ cards: cards.length }); })()';
const cardCount = () => evalJson(CARD_COUNT);

/* the settle: the t869 arrival guard + the t871 arrival predicate. The
 * diagnostics dialog's own word for arrival is the footer's "read at" —
 * the panel SAYS when its numbers came home. */
const settleW = (what, maxIter = 16, need = 2, arrival = null) => {
  let m = evalJson(WORLD_MEASURE);
  let run = 1;
  for (let i = 0; i < maxIter; i++) {
    sleep(1);
    const next = evalJson(WORLD_MEASURE);
    const alive = next.pageBtns > 0;
    const arrived = arrival ? arrival(next) : true;
    const same = alive && arrived && JSON.stringify(next) === JSON.stringify(m);
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need) break;
  }
  console.log(`  settled ${what} (${need}x stable${arrival ? ", arrival-gated" : ""})`);
  return m;
};

const settleD = (what, maxIter = 16, need = 2) => {
  let m = evalJson(DIAG_MEASURE);
  let run = 1;
  for (let i = 0; i < maxIter; i++) {
    sleep(1);
    const next = evalJson(DIAG_MEASURE);
    const arrived = next.up && /read at/.test(next.generated || "");
    const same = arrived && JSON.stringify(next) === JSON.stringify(m);
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need) break;
  }
  console.log(`  settled ${what} (arrival-gated: the panel's own "read at")`);
  return m;
};

const ESC_ALL =
  '(() => { const d = document.querySelector("[role=dialog], [role=alertdialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

const seedRead = () =>
  evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');

/* ---------- Face O: the clean room ---------- */
console.log("Face O — the clean room (the dialog is summoned, never resident)");
ab(`open ${BASE}`);
sleep(3);
/* the walk cleans its own predecessor's residue first (the t871 law,
 * applied to the lens): a leftover session seed boots the world with an
 * inspector open — the clean room must be CLEAN before it is filmed. */
const pre = evalJson('(() => { const s = localStorage.getItem("cryoflow.selectedJob.v1"); if (s) { localStorage.removeItem("cryoflow.selectedJob.v1"); return JSON.stringify({ cleaned: true, was: s.slice(0, 12) }); } return JSON.stringify({ cleaned: false }); })()');
if (pre.cleaned) {
  console.log(`  the seed hygiene pre-pass: removed a leftover seed (${JSON.stringify(pre.was)}) and reloading`);
  ab(`open ${BASE}`);
  sleep(3);
}
const c1 = settleW("the canvas");
const OPEN = c1.pageBtns;
const CARDS_OPEN = cardCount().cards;
ok("O0 the dialog absent before the door + the header door named (summoned, never resident)",
  c1.hasDlg === false && c1.pageUnnamed === 0 && c1.door === true,
  `pageBtns=${OPEN} door=${c1.door}`);

/* ---------- Face W: the first-open tax, paid once (the lazy chunk's own room) ----------
 * The t872 lens lesson: SystemDiagnosticsDialog is a nextDynamic chunk —
 * its FIRST open builds the chunk on the dev server (tens of seconds
 * under memory pressure), so the palette-door ride filmed a closed
 * palette with no panel. The walk pays the tax OUTSIDE the assertions:
 * the warm open is its own honest check, every later door rides warm. */
console.log("Face W — the first-open tax (the nextDynamic chunk's cold build, paid once)");
const wOpen = evalJson('(() => { const b = document.querySelector(\'button[aria-label="System diagnostics"]\'); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
sleep(1);
const w1 = settleD("the first open (the chunk's cold build — the walk waits for the panel's own 'read at')", 48, 2);
ok("W0 the lazy room's first open arrives (the chunk tax paid once, in the open, not in an assertion)",
  w1.up === true && /^read at /.test(w1.generated || ""),
  `up=${w1.up} generated=${JSON.stringify((w1.generated || "").slice(0, 24))}`);
evalJson(ESC_ALL);
sleep(1);
const w2 = settleW("the world after the warm open", 16, 2, (m) => m.hasDlg === false && m.pageBtns === OPEN);
ok("W1 the warm Escape closed it; the canvas back bit-for-bit",
  w2.hasDlg === false && w2.pageBtns === OPEN && w2.pageUnnamed === 0,
  `btns=${w2.pageBtns} (opening ${OPEN})`);

/* ---------- Face Q: the palette's reverse-hop door (the t530 handshake) ----------
 * The ride-3 lesson: the setter + input event typed into the input's DOM
 * value but did NOT drive cmdk's internal filter state, and the Enter
 * selected the FIRST item of the UNFILTERED list — a rogue command that
 * created a job (two rows, both cleaned through the tombstone door).
 * The cure is the TRUSTED keyboard door: `agent-browser keyboard type`
 * fires real keystrokes (cmdk's own onChange runs, the filter filters)
 * and `press Enter` is a real key. The filter's proof is BOTH witnesses:
 * the diagnostics item visible AND the list narrowed (visible < total). */
console.log("Face Q — the palette names the door (the t530 reverse-hop handshake)");
evalJson('(() => { window.dispatchEvent(new Event("cryoflow:open-palette")); return "door"; })()');
sleep(1);
const q0 = settleW("the palette", 16, 2, (m) => m.cmdkUp === true && m.hasDlg === true);
const q0f = evalJson('(() => { const items = Array.from(document.querySelectorAll("[cmdk-item]")); const vis = items.filter((i) => i.offsetParent !== null); return JSON.stringify({ total: items.length, visible: vis.length }); })()');
evalJson('(() => { const ip = document.querySelector("[cmdk-input]"); if (ip) ip.focus(); return "focused"; })()');
ab(`keyboard type diagnostics`);
sleep(1);
const q1 = evalJson('(() => { const items = Array.from(document.querySelectorAll("[cmdk-item]")); const vis = items.filter((i) => i.offsetParent !== null); const item = document.querySelector(\'[data-preview-label="Open system diagnostics"]\'); return JSON.stringify({ total: items.length, visible: vis.length, found: !!item, itemVisible: item ? item.offsetParent !== null : false }); })()');
ok("Q1 the palette's filter narrows to the door (diagnostics visible AND the universe narrowed vs the unfiltered film — the ride-4 lesson: the narrowed palette keeps only the matches in the DOM, the negative witness films the BEFORE)",
  q1.found === true && q1.itemVisible === true && q1.visible < q0f.visible,
  `before=${q0f.visible} after=${q1.visible} itemVisible=${q1.itemVisible}`);
/* the ride-4 lesson (the expensive one): the highlight is the palette's
 * own scoring — among the narrowed matches a job-creation command can
 * outrank the door, and Enter creates a rogue job (two rows paid the
 * tombstone's price). The deterministic door is the CLICK on the filmed
 * item — the door the walk already proves visible. */
const q1c = evalJson('(() => { const item = document.querySelector(\'[data-preview-label="Open system diagnostics"]\'); if (!item || item.offsetParent === null) return JSON.stringify({ clicked: false }); item.click(); return JSON.stringify({ clicked: true }); })()');
ok("Q1b the door clicked (the deterministic door — no highlight lottery)",
  q1c.clicked === true, "");
sleep(2);
const q2 = settleW("the dialog through the palette's door", 30, 2, (m) => m.hasDlg === true && /System diagnostics/.test(m.dlgHeading || "") && m.cmdkUp === false);
ok("Q2 the click closed the palette AND the header opened the panel (the reverse-hop: two layers, one handshake)",
  q2.hasDlg === true && q2.cmdkUp === false && /System diagnostics/.test(q2.dlgHeading || ""),
  `heading="${q2.dlgHeading}" cmdk=${q2.cmdkUp}`);
evalJson(ESC_ALL);
sleep(1);
const q3 = settleW("the world after the palette-door roundtrip", 16, 2, (m) => m.hasDlg === false && m.pageBtns === OPEN);
ok("Q3 Escape closed the panel; the canvas back bit-for-bit",
  q3.hasDlg === false && q3.pageBtns === OPEN && q3.pageUnnamed === 0,
  `btns=${q3.pageBtns} (opening ${OPEN})`);

/* ---------- Face D: the header door + the dialog's seats ---------- */
console.log("Face D — the header door (the Activity button) and the dialog's seats");
evalJson('(() => { const b = document.querySelector(\'button[aria-label="System diagnostics"]\'); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
sleep(1);
const d1w = settleW("the dialog through the header door", 20, 2, (m) => m.hasDlg === true && /System diagnostics/.test(m.dlgHeading || ""));
const d1 = settleD("the readings");
ok("D1 the dialog arrived as the topmost layer, focus inside",
  d1.up === true && d1.focusIn === true, "");
ok("D2 the title speaks 'System diagnostics' (the aria-labelledby chain)",
  d1.title === "System diagnostics", `title=${JSON.stringify(d1.title)}`);
ok("D3 the description speaks the room's contract ('The box behind the canvas')",
  !!d1.desc && /The box behind the canvas/.test(d1.desc),
  `desc=${JSON.stringify((d1.desc || "").slice(0, 60))}`);
ok("D4 the t802 keyboard region: role=region + the honest name + the tab stop",
  d1.region && d1.region.role === "region" && d1.region.tabbable === true &&
    d1.region.label === "System diagnostics readings — memory lanes, engine, disk, world census",
  d1.region ? `tabbable=${d1.region.tabbable}` : "region missing");
ok("D5 the four section cards present, each with its h3 (memory lanes / engine & grinder / disk / world & build)",
  d1.sections.length === 4 && d1.sections.every((s) => s.up && !!s.h3),
  d1.sections.map((s) => `${s.t}:${s.h3 ? "h3" : "NO-H3"}`).join(" "));
const d2w = evalJson(WORLD_MEASURE);
ok("D6 zero unnamed page-wide with the dialog up (every control named, every img-role named)",
  d2w.pageUnnamed === 0 && d1.dlgUnnamed === 0 && d1.dlgUnnamedAll === 0,
  `pageBtns=${d2w.pageBtns} dlgBtns=${d1.dlgBtns}`);

/* ---------- Face M: the memory lanes ---------- */
console.log("Face M — the memory lanes (the verdict, the bars, the canonical lines)");
const tone = d1.verdict ? d1.verdict.replace(/\s+/g, " ") : "";
ok("M1 the verdict speaks a tone label + the total line (Healthy|Watch|Danger, total/swap — the flex-gap lesson: the gap is visual, not textual, the world speaks 'Dangertotal')",
  /^(Healthy|Watch|Danger)\s*total /.test(tone), `verdict=${JSON.stringify(tone.slice(0, 60))}`);
const availLane = (d1.lanes || []).find((l) => /^Available: /.test(l || ""));
const cacheLane = (d1.lanes || []).find((l) => /^Page cache \(buff\/cache\): /.test(l || ""));
ok("M2 the Available lane is a named img whose label speaks the canonical line (GO 2600)",
  !!availLane && /^Available: [\d.,]+ (MB|GB) of [\d.,]+ (MB|GB); GO 2600$/.test(availLane),
  `lane=${JSON.stringify(availLane)}`);
ok("M3 the Page cache lane is a named img whose label speaks the warm line (1450)",
  !!cacheLane && /^Page cache \(buff\/cache\): [\d.,]+ (MB|GB) of [\d.,]+ (MB|GB); warm 1450$/.test(cacheLane),
  `lane=${JSON.stringify(cacheLane)}`);
ok("M4 the verdict reason spoken (the why rides the number)",
  !!d1.reason && d1.reason.length > 10, `reason=${JSON.stringify((d1.reason || "").slice(0, 80))}`);
ok("M5 the legend teaches the t524 watchdog line (one process, not the box)",
  !!d1.legend && /recycles next-server at 2600MB RSS/.test(d1.legend) && /not the box/.test(d1.legend),
  `legend=${JSON.stringify((d1.legend || "").slice(0, 90))}`);

/* ---------- Face E: the engine & the disk ---------- */
console.log("Face E — the engine & grinder, the disk");
ok("E1 the engine speaks exactly ONE honest state (found | build | none — the t242 two-wells mirror, never empty)",
  ["found", "build", "none"].includes(d1.engState),
  `state=${d1.engState} text=${JSON.stringify(d1.engText || "")}`);
const diskLane = (d1.lanes || []).find((l) => /^Used: /.test(l || ""));
ok("E2 the disk lane named with its % note (t527's tree-external sharers taught)",
  !!diskLane && /^Used: [\d.,]+ (MB|GB) of [\d.,]+ (MB|GB); ?$/.test(diskLane) && !!d1.diskNote && /% used/.test(d1.diskNote),
  `lane=${JSON.stringify(diskLane)} note=${JSON.stringify((d1.diskNote || "").slice(0, 60))}`);

/* ---------- Face C: the world census (the cross-well check) ---------- */
console.log("Face C — the world census (the tiles vs the canvas the walk opened with)");
const tile = (label) => (d1.tiles || []).find((t) => t.label === label);
ok("C1 the Projects tile speaks 1 (the census's own word)",
  tile("Projects") && tile("Projects").value === "1",
  `tiles=${JSON.stringify(d1.tiles)}`);
ok("C2 the census's Jobs tile == the canvas's job cards (the ADOPT invariant made visible — two wells, one world)",
  tile("Jobs") && tile("Jobs").value === String(CARDS_OPEN),
  `census=${tile("Jobs") ? tile("Jobs").value : "?"} canvas cards=${CARDS_OPEN}`);
ok("C3 the Running tile speaks 0 (the roster at rest)",
  tile("Running") && tile("Running").value === "0", "");

/* ---------- Face P: the provenance ---------- */
console.log("Face P — the provenance (exactly one honest speaker)");
ok("P1 exactly one of {commit code, the honest 'No provenance stamp' line} speaks — never both, never neither",
  d1.prov && ((d1.prov.code && d1.prov.code.length >= 7) || d1.prov.honestNone === true) &&
    !(d1.prov.code && d1.prov.honestNone),
  `prov=${JSON.stringify(d1.prov)}`);

/* ---------- Face R: the refresh seat ---------- */
console.log("Face R — the refresh seat (the honest re-read)");
ok("R1 the footer speaks 'read at' + the Refresh door named (aria-label, not the visible label's crutch)",
  /^read at /.test(d1.generated || "") && d1.refresh && d1.refresh.named === true && d1.refresh.label === "Refresh",
  `generated=${JSON.stringify(d1.generated)} label=${d1.refresh ? d1.refresh.label : null}`);
evalJson('(() => { const b = Array.from(document.querySelectorAll("[role=dialog] button")).find((x) => (x.getAttribute("aria-label") || "") === "Refresh diagnostics"); if (!b) return "no-btn"; b.click(); return "clicked"; })()');
sleep(1);
const r2 = settleD("the re-read");
ok("R2 the re-read honest: the footer still speaks, the door re-enabled, no failed state",
  /^read at /.test(r2.generated || "") && r2.refresh && r2.refresh.disabled === false && r2.refresh.label === "Refresh" && r2.failed === false,
  `generated=${JSON.stringify(r2.generated)} failed=${r2.failed}`);

/* ---------- Face K: the t802 keyboard seat ---------- */
console.log("Face K — the t802 keyboard seat (the region takes focus; the scroll face works)");
/* The ride-3 lesson: ArrowDown scrolling a focused region is NATIVE
 * browser behavior — untrusted (synthetic) events never fire it, so no
 * lens can film the arrow itself. The checkable law is the STRUCTURE the
 * t802 cure built: the region is focusable, it IS the content's scroll
 * face (overflowing), and a scroll address moves it. The arrow behavior
 * is the browser's own word (the t802 comment's contract), witnessed
 * structurally here. */
const k1 = evalJson('(() => { const r = document.querySelector("[role=dialog] div[role=region]"); if (!r) return JSON.stringify({ ok: false }); r.focus(); const focused = document.activeElement === r; const overflowing = r.scrollHeight > r.clientHeight; const before = r.scrollTop; r.scrollTop = before + 80; const after = r.scrollTop; r.scrollTop = before; return JSON.stringify({ ok: true, focused, overflowing, moved: after > before }); })()');
ok("K1 the region takes focus (the Radix parking spot), overflows, and answers a scroll address (the t802 structural law; the arrow is the browser's own trusted word)",
  k1.ok === true && k1.focused === true && k1.overflowing === true && k1.moved === true,
  `focused=${k1.focused} overflowing=${k1.overflowing} moved=${k1.moved}`);

/* ---------- Face B: the world back ---------- */
console.log("Face B — the world back (Escape, history-agnostic, no seed)");
evalJson(ESC_ALL);
sleep(1);
/* the t871 history lesson: the world's back is the CANVAS (the job-card
 * count) — the inspector's seats are the world's memory speaking, not
 * the canvas. If a selection somehow opened the inspector, the walk's
 * exit dance Escapes it too; the canvas must return bit-for-bit. */
let b1 = null;
for (let i = 0; i < 6; i++) {
  b1 = settleW("the restored world", 20, 2, (m) => m.hasDlg === false);
  const cards = cardCount().cards;
  if (b1.hasDlg === false && cards === CARDS_OPEN) break;
  evalJson(ESC_ALL);
  sleep(1);
}
ok("B1 Escape closed the dialog; the canvas back by its own count (the job cards, history-agnostic); zero unnamed",
  b1.hasDlg === false && cardCount().cards === CARDS_OPEN && b1.pageUnnamed === 0,
  `cards=${cardCount().cards} (opening ${CARDS_OPEN}) pageBtns=${b1.pageBtns}`);
const seedAfter = seedRead();
ok("B2 the walk leaves no session seed (the t157 two-way door's honest none)",
  seedAfter.seed === "" || seedAfter.seed === null,
  `seed=${JSON.stringify(seedAfter.seed)}`);

/* ---------- the ledger at birth (three faces: diagDialog / readings / worldBack) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
/* the readings face's own scalar is the DIALOG's button count — d1 is the
 * DIAG film (no pageBtns; the ride-6 lesson: a scalar extraction must
 * name the film's own field, not borrow the world's) */
const scalarOfDiag = (m) => m.dlgBtns;
const faces = {
  diagDialog: ledgerFace(prevFaces ? prevFaces.diagDialog?.live ?? null : null, d2w, scalarOf),
  readings: ledgerFace(prevFaces ? prevFaces.readings?.live ?? null : null, d1, scalarOfDiag),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, b1, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the system-diagnostics faces hold — the box behind the canvas walked: the clean room held (the dialog summoned, never resident; the header door named), the palette named the door through the t530 reverse-hop handshake (Enter closed the palette and the header opened the panel — two modal layers, one handshake), the header door opened the readings (the title, the contract's description, the t802 keyboard region with its tab stop and honest name, the four section cards, zero unnamed page-wide), the memory lanes spoke their canonical lines ON the bars (Available: GO 2600, Page cache: warm 1450 — the verdict's why riding the number, the legend teaching the t524 watchdog line: one process, not the box), the engine spoke exactly one honest state and the disk its % note, the world census's Jobs tile equaled the canvas's own job cards (the ADOPT invariant made visible), the provenance kept its exactly-one-speaker law, the refresh seat re-read honestly, the t802 region took focus and scrolled, and the world came back bit-for-bit with no session seed — the arrival predicate read the panel's own word (the footer's "read at"), never a clock, the ledger aboard from birth (three faces, the shared law)`
  : `${fail} red — the system-diagnostics layer moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t872-system-diagnostics-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> the palette's reverse-hop door (t530: the palette names the door, the header owns the panel) -> the header door -> the dialog's seats (t802 region, four sections) -> memory lanes (GO 2600 / warm 1450 spoken on the bars) -> engine + disk -> the world census vs the canvas's own cards -> provenance's exactly-one-speaker -> the refresh seat -> the t802 keyboard seat -> worldBack + seed hygiene",
  doors: {
    palette: "the t483 contract event opens the palette; the 'Open system diagnostics' CommandItem fires SYSTEM_DIAGNOSTICS_EVENT after close() — the t530 reverse-hop",
    header: "the header's Activity ghost button, aria-label 'System diagnostics'",
    exit: "Escape on the dialog (the ESC_ALL double dispatch)",
  },
  openingCanvas: OPEN,
  canvasCards: CARDS_OPEN,
  faces: {
    diagDialog: { live: d2w },
    readings: { live: d1 },
    worldBack: { live: b1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t872-system-diagnostics-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nSYSTEM-DIAGNOSTICS-A11Y t872: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
