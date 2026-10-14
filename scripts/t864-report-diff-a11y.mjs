#!/usr/bin/env node
/**
 * t864 — the a11y rotation's next seats: the DOCUMENT dialog (the session
 * QC report, the one dialog that IS a document) and the COMPARE dialog
 * (the params diff — the selection toolbar's own door), walked live with
 * the SHARED RULER (zero src).
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> THIS page (t864). Both dialogs are reachable with the app's own doors
 * and zero creation-mutations:
 *
 *   SR  the session report — the header's named button
 *       (aria-label="Session QC report") opens it; the PRINT CONTRACT is
 *       part of the claim: body[data-report-print] flips ON while the
 *       document is up and OFF after Escape (the t197 dialog-is-a-document
 *       law, asserted both ways); the ONE md carrier (data-md, t194) is
 *       aboard and non-empty; the copy/download doors are named.
 *
 *   PD  the params diff — the card's SHIFT door: pointerdown+pointerup
 *       with shiftKey on two same-type cards (the job-card's own law:
 *       "Shift + card = selection toggle, never a drag"), the selection
 *       toolbar arrives, the compare button (data-testid
 *       =toolbar-compare-params) opens the dialog; the SWAP control is
 *       named and carries aria-pressed (a real boolean state, recorded);
 *       the pair's shared type is MEASURED from the roster, never pinned
 *       (the t826 lesson: print the world-state, gate the invariant);
 *       un-mutation is the SYMMETRIC door — shift+click each card again,
 *       the toolbar unmounts, the canvas count returns bit-for-bit.
 *
 * Born with the ledger aboard (the t861 birthright, t862's practice —
 * and t863's trio joins the family table this same window): the shared
 * helper cuts the faces (report / paramsdiff / worldBack), records the arms.
 *
 * Receipt: shots-qa/t864-report-diff-a11y.json.
 *
 *   node scripts/t864-report-diff-a11y.mjs
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
const cmp = loadComparator(ROOT, "shots-qa/t864-report-diff-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t864 report+diff a11y walk — world ${world.mode}:${buildId}, the document dialog and the compare dialog through the shared ruler\n` +
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

/* ---------- the measure: the SHARED RULER's name computation + the two
 * dialogs' fields. NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const dlg = document.querySelector("[role=dialog]"); const dlgHead = dlg ? ((document.getElementById(dlg.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null; const printOn = document.body.hasAttribute("data-report-print"); const doc = document.querySelector("[data-report-doc]"); const mdLen = doc ? (doc.getAttribute("data-md") || "").length : 0; const copy = document.querySelector(\'button[aria-label="Copy session report"]\'); const dl = document.querySelector(\'button[aria-label="Download session report"]\'); const swap = document.querySelector("[data-testid=params-diff-swap]"); const rows = document.querySelectorAll("[data-testid^=params-diff-open-]").length; const toolbar = document.querySelector("[data-testid=toolbar-compare-params]"); const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); const still = dlg ? Array.from(dlg.querySelectorAll("[aria-label]")).filter((e) => (e.getAttribute("aria-label") || "").includes("still measuring")).length : 0; const act = document.activeElement; return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, hasDlg: !!dlg, dlgHead: dlgHead, printOn: printOn, docAboard: !!doc, mdLen: mdLen, stillMeasuring: still, copyNamed: !!(copy && nameOf(copy)), dlNamed: !!(dl && nameOf(dl)), swapNamed: !!(swap && nameOf(swap)), swapPressed: swap ? swap.getAttribute("aria-pressed") : null, diffRows: rows, hasToolbar: !!toolbar, act: act ? (dlg && dlg.contains(act) ? "in-dialog" : act.tagName) : null, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

/* t860 — the settle-wait: measure, re-measure, require equality, bounded. */
const settle = (what) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < 6; i++) {
    sleep(0.8);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    m = next;
    if (same) break;
  }
  console.log(`  settled ${what}`);
  return m;
};

/* the report face's settle — the SR7 lesson (this instrument's own first
 * ride): the document's map-QC/curves families arrive ASYNC (the profile
 * fetch), so equality between two PRE-ARRIVAL measures is a false settle —
 * the md grew 3459 -> 7918 AFTER two agreements. The app has its own
 * quiescence door: the compass pulse (t499) speaks "— still measuring"
 * in the toc chips while the walks run. Settled = the pulse SILENT and two
 * consecutive measures equal (bounded 14 × 1s — the fetches, not a clock). */
const settleReport = (what) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < 14; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    m = next;
    if (same && m.stillMeasuring === 0) break;
  }
  console.log(`  settled ${what} (pulse silent, bytes stable)`);
  return m;
};

const ESC =
  '(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

/* the card's SHIFT door: pointerdown+pointerup with shiftKey, no move —
 * the job-card's own selection-toggle law (both events carry the flag;
 * the toggle commits on pointerup). */
const shiftClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, shiftKey: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

/* ---------- Face 0: the calm canvas (the opening count) ---------- */
console.log("Face 0 — the calm canvas (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
/* t866 — the CLEAN-ROOM law: the session-position seed (t157) makes the
 * boot state ride-dependent. A seed left by an earlier ride re-opens the
 * side panel (+12 controls) AND boots a one-card multi-selection
 * (store.ts:2410 puts the seed INTO selectedIds), which flips the pair
 * toggle's second click from JOIN to REMOVE — the compare toolbar never
 * forms and the face goes red on a world the instrument did not measure.
 * The instrument owns its measurement conditions (as it owns the viewport
 * and the settle): clear the seed, reload, and DEMAND the panel-closed
 * boot. The world's own session position is the user's, not the film's. */
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
ok("O0 the boot is a clean room (the t157 seed cleared, the panel closed)",
  m0.panelOpen === false,
  `panelOpen=${m0.panelOpen}`);
ok("O1 the canvas is calm and named (the census's invariant)",
  !m0.hasDlg && m0.pageUnnamed === 0 && m0.unCtrls === 0 && m0.altless === 0,
  `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;

/* ---------- Face SR — the session QC report (the document dialog) ---------- */
console.log("Face SR — the session report (the header's named door, the print contract both ways)");
const openR = evalJson('(() => { const b = document.querySelector(\'button[aria-label="Session QC report"]\'); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
ok("SR1 the report door clicked (the header's named button)", openR.clicked === true);
const s1 = settleReport("the report dialog");
ok("SR2 the document dialog arrived, focus inside (Radix's own contract)",
  s1.hasDlg && s1.dlgHead === "Session QC report" && s1.act === "in-dialog",
  `heading="${s1.dlgHead}" focus=${s1.act}`);
ok("SR3 the print contract ON: body[data-report-print] while the document is up (the t197 dialog-is-a-document law)",
  s1.printOn === true);
ok("SR4 the ONE md carrier aboard and non-empty (data-md, the t194 no-parse-of-parse law)",
  s1.docAboard === true && s1.mdLen > 0,
  `md bytes=${s1.mdLen}`);
ok("SR5 the doors are named: copy + download (the report speaks Markdown both ways)",
  s1.copyNamed === true && s1.dlNamed === true);
ok("SR6 zero unnamed page-wide WITH the document up (the census's invariant on the report)",
  s1.pageUnnamed === 0 && s1.unCtrls === 0 && s1.altless === 0,
  `btns=${s1.pageBtns} ctrls=${s1.ctrls}`);
const s2 = settleReport("the report dialog (second ride)");
ok("SR7 two settled rides bit-identical (the t836 law, the t860 settle — the pulse's silence, not a clock)",
  JSON.stringify(s1) === JSON.stringify(s2), `md bytes=${s1.mdLen}, stillMeasuring=${s1.stillMeasuring}`);
evalJson(ESC);
sleep(1);
const s3 = evalJson(MEASURE);
ok("SR8 Escape closed the report AND the print contract flipped back OFF (the contract's other half)",
  s3.hasDlg === false && s3.printOn === false);

/* ---------- Face PD — the params diff (the selection toolbar's compare door) ---------- */
console.log("Face PD — the params diff (shift+click two same-type cards, the card's own toggle law)");
const jobs = await roster();
const byType = {};
for (const j of jobs) (byType[j.type] ??= []).push(j.id);
const pairEntry = Object.entries(byType).find(([, ids]) => ids.length >= 2);
/* the honest absence (the t865 vocabulary, adopted by this page — the t868
 * window's law): the restored world's roster holds ONE job per type — the
 * compare dialog's door cannot open, and the instrument says so as a
 * POSITIVE assertion (two guards agreeing) instead of redding the ride.
 * The pair's walk is the world's guest: when the world speaks a pair
 * again, the walk returns unchanged below. */
const PAIR_ABSENT = !pairEntry;
let pairType = null, idA = null, idB = null;
let d1 = null, d2 = null;
if (PAIR_ABSENT) {
  console.log("  honest absence: no same-type pair in the roster (one job per type — the restored chain's own word)");
  const a1 = settle("the canvas (the absence's first guard)");
  const a2 = settle("the canvas (the absence's second guard)");
  ok("PD1h the honest absence: no same-type pair exists, two guards agreeing (the compare door honestly absent — the positive-assertion form)",
    a1.hasToolbar === false && a2.hasToolbar === false && !a1.hasDlg && !a2.hasDlg,
    `btns ${a1.pageBtns}/${a2.pageBtns}, toolbar ${a1.hasToolbar}/${a2.hasToolbar}`);
  ok("PD2h the absence's census held (zero unnamed on the guarded canvas)",
    a1.pageUnnamed === 0 && a1.unCtrls === 0 && a1.altless === 0,
    `btns=${a1.pageBtns}`);
  d1 = a1;
  d2 = a2;
} else {
  const [pairTypeMeas, pairIds] = pairEntry;
  pairType = pairTypeMeas;
  [idA, idB] = pairIds;
  console.log(`  pair (measured, not pinned — the t826 lesson): type=${pairType}, A=${idA.slice(0, 12)}, B=${idB.slice(0, 12)}`);
  const cA = evalJson(shiftClick(idA));
  ok("PD1 the first shift+click toggled (the card's selection law)",
    cA.clicked === true);
  evalJson(shiftClick(idB));
  sleep(1);
  let t1 = settle("the selection toolbar");
  if (!t1.hasToolbar) {
    /* t866 — the one-retry law (t846's Face-I form): a transient swallow
     * between the dispatches must not red the ride. Clear whatever state
     * the first attempt left (the app-shell Escape cascade collapses the
     * selection when no dialog swallows the key), then re-toggle the pair. */
    evalJson(ESC);
    sleep(0.5);
    evalJson(shiftClick(idA));
    sleep(0.3);
    evalJson(shiftClick(idB));
    sleep(1);
    t1 = settle("the selection toolbar (the one retry)");
  }
  ok("PD2 the selection toolbar arrived for the pair (the canvas's own count in its name)",
    t1.hasToolbar === true, "aria-label speaks the selection size");
  const cmpClick = evalJson('(() => { const b = document.querySelector("[data-testid=toolbar-compare-params]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
  ok("PD3 the compare button clicked (the toolbar's own door)", cmpClick.clicked === true);
  d1 = settle("the compare dialog");
  ok("PD4 the compare dialog arrived with its heading (Compare parameters)",
    d1.hasDlg && d1.dlgHead === "Compare parameters", `heading="${d1.dlgHead}"`);
  ok("PD5 the swap control is named and carries aria-pressed (a real boolean state, recorded never judged)",
    d1.swapNamed === true && (d1.swapPressed === "false" || d1.swapPressed === "true"),
    `aria-pressed=${d1.swapPressed}`);
  ok("PD6 the diff rows are aboard (the two columns' open doors)",
    d1.diffRows >= 1, `rows=${d1.diffRows}`);
  ok("PD7 zero unnamed page-wide WITH the compare dialog up (the census's invariant on the diff)",
    d1.pageUnnamed === 0 && d1.unCtrls === 0 && d1.altless === 0,
    `btns=${d1.pageBtns} ctrls=${d1.ctrls}`);
  d2 = settle("the compare dialog (second ride)");
  ok("PD8 two settled rides bit-identical (the t836 law, the t860 settle)",
    JSON.stringify(d1) === JSON.stringify(d2));
  evalJson(ESC);
  sleep(1);
  /* un-mutation: the SYMMETRIC door — shift+click each card again */
  evalJson(shiftClick(idA));
  sleep(0.5);
  evalJson(shiftClick(idB));
  sleep(1);
  const d3 = settle("the world after un-mutation");
  ok("PD9 un-mutation through the symmetric door: toolbar gone, canvas count back bit-for-bit",
    d3.hasToolbar === false && !d3.hasDlg && d3.pageBtns === OPEN,
    `btns ${d3.pageBtns} == opening ${OPEN}`);
}

/* ---------- Face W — the world back (fresh load) ---------- */
console.log("Face W — the world back (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
const w1 = settle("the restored canvas");
ok("W1 the world unharmed (canvas count == the opening count, zero unnamed)",
  w1.pageBtns === OPEN && w1.pageUnnamed === 0 && !w1.hasDlg && !w1.hasToolbar,
  `btns=${w1.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok("W2 the ride leaves no session seed (the t157 two-way door's honest none — the t866 lesson: a transient join persists, and the next ride boots into the mutated world)",
  seedAfter.seed === "" || seedAfter.seed === null,
  `seed=${JSON.stringify(seedAfter.seed)}`);

/* ---------- the ledger at birth (three faces: report / paramsdiff / worldBack) ---------- */
console.log("Ledger — the t861 birthright aboard from ride one (three faces, the shared law)");
/* the family's wiring (t863's form): the receipt's top-level `faces` block
 * carries the RAW measures; the ledger diffs THIS ride against the previous
 * receipt's raw faces — never against the ledger's own scalar echoes. */
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  report: ledgerFace(prevFaces ? prevFaces.report?.live ?? null : null, s1, scalarOf),
  paramsdiff: ledgerFace(prevFaces ? prevFaces.paramsdiff?.live ?? null : null, d1, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const compareClause = PAIR_ABSENT
  ? "the compare dialog's door honestly absent (the roster holds one job per type — the restored chain's own word, two guards agreeing, the positive-assertion form — the pair walk returns when the world speaks a pair)"
  : `the compare dialog rode the card's own shift door (two same-type cards toggled, the toolbar's compare button, the swap control's aria-pressed recorded, the measured pair type "${pairType}" printed as provenance never pinned)`;
const verdict = fail === 0
  ? `the document and the compare dialogs hold: the report arrived as a DOCUMENT (the print contract ON while up and OFF after Escape, the one md carrier aboard, the copy/download doors named), ${compareClause}, zero unnamed everywhere on both, two settled rides bit-identical each, the world back bit-for-bit (${OPEN} == ${OPEN}) — the ledger aboard from birth (three faces, the shared law)`
  : `${fail} red — the document/compare layer moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t864-report-diff-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "canvas -> report (header door) -> print contract both ways -> shift+click pair (or the honest absence, the t868 clause) -> toolbar compare -> diff dialog -> symmetric un-mutation -> worldBack (one command)",
  doors: {
    report: 'click button[aria-label="Session QC report"] — the header\'s named seat',
    compare: "shift+click two same-type cards (the card's own toggle law) -> click [data-testid=toolbar-compare-params] — the selection toolbar's door",
    unmutate: "shift+click each selected card again — the symmetric toggle, no residue",
  },
  pair: { present: !PAIR_ABSENT, type: pairType, a: idA, b: idB, measured: true },
  openingCanvas: OPEN,
  faces: {
    report: { live: s1, secondRide: s2 },
    paramsdiff: { live: d1, secondRide: d2 },
    worldBack: { live: w1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t864-report-diff-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\n${verdict}`);
console.log(`REPORT-DIFF-A11Y t864: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
