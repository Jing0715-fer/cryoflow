#!/usr/bin/env node
/**
 * t865 — the a11y rotation's next surface: the RESULTS FAMILY — the
 * inspector header's question-doors row and the dialogs behind them,
 * walked live with the SHARED RULER (zero src).
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> THIS family (t865).
 *
 * The family (the inspector header hosts the whole question row — one
 * porch, six questions, every door a lazy chunk that compiles on first
 * use — the t391 barrel's own shimmer is the quiescence door):
 *
 *   DR  the doors face — the postprocess inspector's header: the final
 *       verdict door and the particle funnel door present and named; the
 *       A/B doors HONESTLY ABSENT (the guard law: no completed sibling
 *       of the domain, no door); the Duplicate door present (the A/B
 *       loop's front door).
 *   FC  the FSC compare dialog — the results tab's compare chip
 *       (data-testid=fsc-compare-open), the candidate rows, the rescan /
 *       select / toggle doors named, the chart aboard.
 *   PV  the final verdict — the postprocess honesty read (the sixth
 *       question, t457): the reading region named.
 *   PF  the particle funnel — the chain question (t461): the reading
 *       named, the export/copy doors named, the pours aboard.
 *   RA  the resolution arc — the fifth question (t456): the refine3d
 *       run vs its OWN arc, the reading named.
 *   CV  the class convergence — the fourth question (t454): the class2d
 *       run vs its OWN rounds, the reading + Round A/B selects named.
 *   AB  the honest absence — the ctffind inspector: ZERO A/B doors and
 *       ZERO sibling pickers (both guards agree: one completed ctffind,
 *       no twin), the Duplicate door present. An absent door that was
 *       GUARDED into absence is a claim, not a gap — the ride asserts it.
 *   W   the world back — fresh load, the canvas count bit-for-bit.
 *
 * Born with the ledger aboard (the t861 birthright, practiced every
 * window since t862): EIGHT faces through the shared helper — doors /
 * fscCompare / verdict / funnel / arc / convergence / abGuard /
 * worldBack — the receipt's top-level `faces` block carries the RAW
 * measures, the ledger diffs prev.faces.<name>.live.
 *
 * The settle law, the t864 generalization: settled = the lazy barrel's
 * OWN quiescence door SILENT (no "Loading chart…" / "Loading…" leaf)
 * AND two consecutive measures equal — the app's silence, never the
 * instrument's patience. The chip poll rides the same law in the other
 * direction: an arrival door waits for ARRIVAL, bounded.
 *
 * Receipt: shots-qa/t865-results-a11y.json.
 *
 *   node scripts/t865-results-a11y.mjs
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
const cmp = loadComparator(ROOT, "shots-qa/t865-results-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t865 results-family a11y walk — world ${world.mode}:${buildId}, the question-doors porch and five dialogs through the shared ruler\n` +
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

/* ---------- the measure: the SHARED RULER + the whole family's probes.
 * ONE superset measure — every face films the same fields; the absent
 * selectors speak false/0 (within-face stability is what the rides diff).
 * NO ${} inside — the shell reads this string. NO volatile text — the
 * freshness chip and the counts ride as PRESENCE, never as strings. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlg = dgs[0]; const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null; const dlgHead = headOf(dlg); const dlgHeadTop = headOf(dlgTop); const dlgCount = dgs.length; const act = document.activeElement; const actTabEl = document.querySelector("[role=tab][data-state=active]"); const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())); const q = (s) => !!document.querySelector(s); const doorBy = (pre) => btns.some((b) => (b.getAttribute("aria-label") || "").startsWith(pre)); const cnt = (s) => document.querySelectorAll(s).length; const abDoors = btns.filter((b) => (b.getAttribute("aria-label") || "").includes("A/B — compare with another completed run")).length; const sibPicker = btns.filter((b) => (b.getAttribute("aria-label") || "").startsWith("Compare parameters with another")).length; const dup = btns.some((b) => (b.textContent || "").trim() === "Duplicate"); return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: !!dlg, dlgHead: dlgHead, dlgHeadTop: dlgHeadTop, dlgCount: dgs.length, act: act ? (dlg && dlg.contains(act) ? "in-dialog" : act.tagName) : null, actTab: actTabEl ? (actTabEl.textContent || "").trim().slice(0, 12) : null, shimmer: leaves.length, verdictDoor: doorBy("Final verdict — read what the mask bought"), funnelDoor: doorBy("Particle funnel — read where the particles went"), arcDoor: doorBy("Resolution arc — read this"), convDoor: doorBy("Class convergence — read this run"), abDoors: abDoors, sibPicker: sibPicker, dup: dup, fscChip: q("[data-testid=fsc-compare-open]"), fscRows: cnt("[data-testid=fsc-compare-row]"), fscRescan: q(\'button[aria-label="Re-scan the project for FSC curves"]\'), fscSelect: q(\'[aria-label="Select jobs to compare"]\'), fscToggle: q(\'[aria-label="Toggle curves"]\'), fscChart: q("[data-testid=fsc-compare-chart]"), fscLegend: cnt("[data-testid^=fsc-compare-legend-]"), fscFresh: q("[data-testid=fsc-compare-freshness]"), pvReading: q(\'[aria-label^="Postprocess verdict reading"]\'), pfReading: q(\'[aria-label^="Particle funnel reading"]\'), pfCsvNamed: q("[data-testid=funnel-export-csv]"), pfCopyNamed: q("[data-testid=funnel-copy-ledger]"), pfPours: cnt("[data-testid^=funnel-pours-]"), raReading: q(\'[aria-label^="Resolution arc reading"]\'), cvReading: q(\'[aria-label^="Class convergence reading"]\'), cvRoundA: q(\'[aria-label="Round A"]\'), cvRoundB: q(\'[aria-label="Round B"]\') }); })()';

/* the settle law (t864's generalization): the lazy barrel's own quiescence
 * door SILENT (shimmer 0) AND the images' own contract SETTLED (no img
 * pending — the RA face's first birth rode imgs 9→10 between two measures:
 * an async thumbnail is a world arrival with its own door, img.complete —
 * the t857/t860 mechanism, now settled by the app's silence) AND N
 * consecutive measures equal, bounded. The
 * default N=2; the class2d faces ride N=3 — the class sheet arrives with
 * the data's own timing (the t864 inspector lesson, applied at birth). */
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

/* the OOM corpse guard (the t859/t861/t864 pattern, a fourth ride): an
 * eval filming a dead server returns ZEROS — say so, stop honestly. */
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

const clickTestid = (tid) =>
  '(() => { const b = document.querySelector("[data-testid=' + tid + ']"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

const clickDoor = (pre) =>
  '(() => { const b = Array.from(document.querySelectorAll("button")).find((e) => (e.getAttribute("aria-label") || "").startsWith("' + pre + '")); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

/* the zero-unnamed census invariant, one voice everywhere */
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- the roster: the four hosts, measured never pinned ---------- */
const jobs = await roster();
const byType = {};
for (const j of jobs) if (j.status === "completed") (byType[j.type] ??= []).push(j);
const pick = (t) => (byType[t] ?? [])[0] ?? null;
const post = pick("postprocess");
const refine = pick("refine3d");
const class2d = pick("class2d");
const ctf = pick("ctffind");
if (!post || !refine || !class2d || !ctf) {
  const missing = [["postprocess", post], ["refine3d", refine], ["class2d", class2d], ["ctffind", ctf]]
    .filter(([, j]) => !j).map(([t]) => t).join(", ");
  console.error(`the results family cannot walk — completed hosts missing: ${missing}`);
  writeFileSync(join(ROOT, "shots-qa/t865-results-a11y.json"), JSON.stringify({ instrument: "scripts/t865-results-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: `completed hosts missing (${missing}) — the ride stopped honestly before the family's porch` }, null, 2));
  process.exit(1);
}
console.log(`  hosts (measured, not pinned — the t826 lesson): postprocess=${post.id.slice(0, 12)}, refine3d=${refine.id.slice(0, 12)}, class2d=${class2d.id.slice(0, 12)}, ctffind=${ctf.id.slice(0, 12)}`);

/* ---------- Face 0: the calm canvas (the opening count) ---------- */
console.log("Face 0 — the calm canvas (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
if (corpse(m0, "the opening canvas")) process.exit(1);
ok("O1 the canvas is calm and named (the census's invariant)",
  !m0.hasDlg && censusOk(m0),
  `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;

/* ---------- Face DR: the doors porch (the postprocess inspector's header) ---------- */
console.log("Face DR — the question-doors porch (postprocess inspector, the header's row)");
const cP = evalJson(plainClick(post.id));
ok("DR1 the inspector arrived through the card's own plain door (pointerdown→pointerup, no move)",
  cP.clicked === true);
const d0 = waitFor("the inspector", (m) => m.hasDlg && m.shimmer === 0, 30);
if (corpse(d0, "the postprocess inspector")) process.exit(1);
const dr = settle("the doors porch");
ok("DR2 the inspector is up with focus inside (Radix's own contract)",
  dr.hasDlg && dr.act === "in-dialog",
  `actTab=${dr.actTab}`);
ok("DR3 the two single-run doors aboard on the postprocess face, both named",
  dr.verdictDoor === true && dr.funnelDoor === true,
  "Final verdict + Particle funnel");
ok("DR4 the A/B doors honestly absent on the postprocess face (the guard law: none of the A/B domains)",
  dr.abDoors === 0);
ok("DR5 the Duplicate door present (the A/B loop's front door: copy → tweak → run → compare)",
  dr.dup === true);
ok("DR6 zero unnamed page-wide in the inspector (the census's invariant on the porch)",
  censusOk(dr),
  `btns=${dr.pageBtns} ctrls=${dr.ctrls}`);

/* ---------- Face FC: the FSC compare dialog ---------- */
console.log("Face FC — the FSC compare dialog (the results tab's compare chip)");
const tR = evalJson(tabMouseDown("Results"));
ok("FC1 the Results tab answered its mousedown door (the t863 Radix law)",
  tR.found === true);
const chip = waitFor("the compare chip", (m) => m.fscChip === true && m.shimmer === 0, 30);
ok("FC2 the compare chip arrived (the chart's header earns it when the data landed)",
  chip.fscChip === true);
const cc = evalJson(clickTestid("fsc-compare-open"));
ok("FC3 the chip clicked (the FSC chart's own overlay door)", cc.clicked === true);
const fc = settle("the FSC compare dialog");
if (corpse(fc, "the FSC compare dialog")) process.exit(1);
ok("FC4 the overlay dialog arrived as the TOP layer with its heading (Compare FSC curves)",
  fc.hasDlg && (fc.dlgHeadTop || "").startsWith("Compare FSC curves"),
  `top="${fc.dlgHeadTop}" layers=${fc.dlgCount}`);
ok("FC5 the candidate rows aboard (the project's FSC-bearing jobs — measured, printed)",
  fc.fscRows >= 1, `rows=${fc.fscRows}`);
ok("FC6 the doors named: re-scan + select list + toggle curves",
  fc.fscRescan === true && fc.fscSelect === true && fc.fscToggle === true);
ok("FC7 the chart aboard (the overlay's own axis)",
  fc.fscChart === true, `legend chips=${fc.fscLegend}`);
ok("FC8 zero unnamed page-wide WITH the overlay up (the census's invariant on the FSC family)",
  censusOk(fc),
  `btns=${fc.pageBtns} ctrls=${fc.ctrls}`);
const fc2 = settle("the FSC compare dialog (second ride)");
ok("FC9 two settled rides bit-identical (the t836 law, the shimmer-silence settle)",
  JSON.stringify(fc) === JSON.stringify(fc2));
evalJson(ESC_LAST);
sleep(1);
const fc3 = evalJson(MEASURE);
ok("FC10 Escape closed the overlay, the inspector remains (the porch stays)",
  fc3.hasDlg === true && fc3.dlgCount === 1 && fc3.fscChart === false);

/* ---------- Face PV: the final verdict dialog ---------- */
console.log("Face PV — the final verdict (the postprocess honesty read, the sixth question)");
const pvC = evalJson(clickDoor("Final verdict — read what the mask bought"));
ok("PV1 the verdict door clicked (the porch's own seat)", pvC.clicked === true);
const pv = settle("the verdict dialog");
if (corpse(pv, "the verdict dialog")) process.exit(1);
ok("PV2 the dialog arrived as the TOP layer with its heading (Final verdict — …)",
  pv.hasDlg && (pv.dlgHeadTop || "").startsWith("Final verdict —"),
  `top="${pv.dlgHeadTop}" layers=${pv.dlgCount}`);
ok("PV3 the reading region named (three curves, three crossings, one box edge)",
  pv.pvReading === true);
ok("PV4 zero unnamed page-wide WITH the verdict up (the census's invariant)",
  censusOk(pv), `btns=${pv.pageBtns}`);
const pv2 = settle("the verdict dialog (second ride)");
ok("PV5 two settled rides bit-identical", JSON.stringify(pv) === JSON.stringify(pv2));
evalJson(ESC_LAST);
sleep(1);

/* ---------- Face PF: the particle funnel dialog ---------- */
console.log("Face PF — the particle funnel (the chain question, the whole line)");
const pfC = evalJson(clickDoor("Particle funnel — read where the particles went"));
ok("PF1 the funnel door clicked (the porch's chain seat)", pfC.clicked === true);
const pf = settle("the funnel dialog");
if (corpse(pf, "the funnel dialog")) process.exit(1);
ok("PF2 the dialog arrived as the TOP layer with its heading (Particle funnel — …)",
  pf.hasDlg && (pf.dlgHeadTop || "").startsWith("Particle funnel —"),
  `top="${pf.dlgHeadTop}" layers=${pf.dlgCount}`);
ok("PF3 the reading region named (what each stage kept, shed, multiplied)",
  pf.pfReading === true);
ok("PF4 the export doors named: CSV ledger + plain-text ledger",
  pf.pfCsvNamed === true && pf.pfCopyNamed === true);
ok("PF5 the pours aboard (the stages' own pour icons — the chain's flow, measured)",
  pf.pfPours >= 1, `pours=${pf.pfPours}`);
ok("PF6 zero unnamed page-wide WITH the funnel up (the census's invariant)",
  censusOk(pf), `btns=${pf.pageBtns}`);
const pf2 = settle("the funnel dialog (second ride)");
ok("PF7 two settled rides bit-identical", JSON.stringify(pf) === JSON.stringify(pf2));
evalJson(ESC_LAST);
sleep(1);
evalJson(ESC_LAST);
sleep(1.5);

/* ---------- Face RA: the resolution arc (the refine3d inspector) ---------- */
console.log("Face RA — the resolution arc (the fifth question: the run vs its OWN arc)");
const cR = evalJson(plainClick(refine.id));
ok("RA1 the refine3d inspector arrived through the card's plain door", cR.clicked === true);
waitFor("the refine3d inspector", (m) => m.hasDlg && m.shimmer === 0, 30);
const raDoor = waitFor("the arc door", (m) => m.arcDoor === true && m.shimmer === 0, 24);
ok("RA2 the arc door present on the refinement face (the guard's positive form)",
  raDoor.arcDoor === true);
const raC = evalJson(clickDoor("Resolution arc — read this"));
ok("RA3 the arc door clicked", raC.clicked === true);
const ra = settle("the arc dialog");
if (corpse(ra, "the arc dialog")) process.exit(1);
ok("RA4 the dialog arrived as the TOP layer with its heading (Resolution arc — …)",
  ra.hasDlg && (ra.dlgHeadTop || "").startsWith("Resolution arc —"),
  `top="${ra.dlgHeadTop}" layers=${ra.dlgCount}`);
ok("RA5 the reading region named (the estimate curve and the plateau law)",
  ra.raReading === true);
ok("RA6 zero unnamed page-wide WITH the arc up (the census's invariant)",
  censusOk(ra), `btns=${ra.pageBtns}`);
const ra2 = settle("the arc dialog (second ride)");
ok("RA7 two settled rides bit-identical", JSON.stringify(ra) === JSON.stringify(ra2));
evalJson(ESC_LAST);
sleep(1);
evalJson(ESC_LAST);
sleep(1.5);

/* ---------- Face CV: the class convergence (the class2d inspector) ---------- */
console.log("Face CV — the class convergence (the fourth question: the run vs its OWN rounds)");
const cC = evalJson(plainClick(class2d.id));
ok("CV1 the class2d inspector arrived through the card's plain door", cC.clicked === true);
waitFor("the class2d inspector", (m) => m.hasDlg && m.shimmer === 0, 30);
const cvDoor = waitFor("the convergence door", (m) => m.convDoor === true && m.shimmer === 0, 24);
ok("CV2 the convergence door present on the classification face (the round ladder holds)",
  cvDoor.convDoor === true);
const cvC = evalJson(clickDoor("Class convergence — read this run"));
ok("CV3 the convergence door clicked", cvC.clicked === true);
const cv = settle("the convergence dialog", 20, 3);
if (corpse(cv, "the convergence dialog")) process.exit(1);
ok("CV4 the dialog arrived as the TOP layer with its heading (Class convergence — …)",
  cv.hasDlg && (cv.dlgHeadTop || "").startsWith("Class convergence —"),
  `top="${cv.dlgHeadTop}" layers=${cv.dlgCount}`);
ok("CV5 the reading region named (verdict, scatter, movers, census)",
  cv.cvReading === true);
ok("CV6 the round selects named (Round A / Round B — the run's own ladder)",
  cv.cvRoundA === true && cv.cvRoundB === true);
ok("CV7 zero unnamed page-wide WITH the convergence up (the census's invariant)",
  censusOk(cv), `btns=${cv.pageBtns}`);
const cv2 = settle("the convergence dialog (second ride)", 20, 3);
ok("CV8 two settled rides bit-identical", JSON.stringify(cv) === JSON.stringify(cv2));
evalJson(ESC_LAST);
sleep(1);
evalJson(ESC_LAST);
sleep(1.5);

/* ---------- Face AB: the honest absence (the ctffind inspector) ---------- */
console.log("Face AB — the honest absence (the ctffind inspector: the guards agree)");
const cT = evalJson(plainClick(ctf.id));
ok("AB1 the ctffind inspector arrived through the card's plain door", cT.clicked === true);
const abm = waitFor("the ctffind porch with its lazy doors resolved", (m) => m.hasDlg && m.shimmer === 0, 30);
if (corpse(abm, "the ctffind inspector")) process.exit(1);
const ab2 = settle("the ctffind porch (second measure)");
ok("AB2 the guard law's positive absence: ZERO A/B doors (one completed ctffind, no twin — no door)",
  abm.abDoors === 0);
ok("AB3 the sibling picker equally absent (the params guard agrees with the A/B guard)",
  abm.sibPicker === 0);
ok("AB4 the Duplicate door present (the A/B loop's front door stands even where the doors wait)",
  abm.dup === true);
ok("AB5 zero unnamed page-wide on the ctffind porch (the census's invariant)",
  censusOk(abm) && censusOk(ab2), `btns=${abm.pageBtns}`);
evalJson(ESC_LAST);
sleep(1.5);

/* ---------- Face W: the world back (fresh load) ---------- */
console.log("Face W — the world back (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
const w1 = settle("the restored canvas");
ok("W1 the world unharmed (canvas count == the opening count, zero unnamed, no dialog)",
  w1.pageBtns === OPEN && censusOk(w1) && !w1.hasDlg,
  `btns=${w1.pageBtns} (opening ${OPEN})`);

/* ---------- the ledger at birth (EIGHT faces, the shared law) ---------- */
console.log("Ledger — the t861 birthright aboard from ride one (eight faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faceDef = {
  doors: dr,
  fscCompare: fc,
  verdict: pv,
  funnel: pf,
  arc: ra,
  convergence: cv,
  abGuard: abm,
  worldBack: w1,
};
const faces = {};
for (const [name, live] of Object.entries(faceDef)) {
  faces[name] = ledgerFace(prevFaces ? prevFaces[name]?.live ?? null : null, live, scalarOf);
}
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the results family holds: the porch's question row named on the postprocess face (the final verdict + the particle funnel doors aboard, the A/B doors honestly absent, the Duplicate front door present), the FSC overlay rode its chip door (${fc.fscRows} candidate rows measured, the rescan/select/toggle doors named, the chart aboard), the verdict and the funnel dialogs spoke their readings with the export doors named (${pf.pfPours} pours), the arc and the convergence dialogs rode their single-run doors with the round selects named, the ctffind porch proved the guard's POSITIVE absence (zero A/B doors, zero sibling pickers, the guards agreeing) — zero unnamed everywhere on every face, every dialog's two settled rides bit-identical, and the world back bit-for-bit (${OPEN} == ${OPEN}) — the ledger aboard from birth (eight faces, the shared law)`
  : `${fail} red — the results family moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t865-results-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "canvas -> postprocess inspector (card plain door) -> doors porch -> results tab (mousedown) -> FSC compare chip -> overlay -> verdict dialog -> funnel dialog -> refine3d arc -> class2d convergence -> ctffind honest absence -> worldBack (one command)",
  doors: {
    inspector: "plain click [data-card-btn=<id>] — the card's own law: submitted opens the inspector",
    resultsTab: "mousedown [role=tab]=Results — the t863 Radix law",
    fscCompare: "click [data-testid=fsc-compare-open] — the FSC chart header's chip",
    porchDoors: 'click the button whose aria-label starts with the question\'s words ("Final verdict —", "Particle funnel —", "Resolution arc —", "Class convergence —")',
    unmutate: "Escape per dialog, Escape per inspector — the world demanded back bit-for-bit",
  },
  hosts: { postprocess: post.id, refine3d: refine.id, class2d: class2d.id, ctffind: ctf.id, measured: true },
  openingCanvas: OPEN,
  faces: {
    doors: { live: dr },
    fscCompare: { live: fc, secondRide: fc2 },
    verdict: { live: pv, secondRide: pv2 },
    funnel: { live: pf, secondRide: pf2 },
    arc: { live: ra, secondRide: ra2 },
    convergence: { live: cv, secondRide: cv2 },
    abGuard: { live: abm, secondRide: ab2 },
    worldBack: { live: w1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t865-results-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\n${verdict}`);
console.log(`RESULTS-A11Y t865: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
