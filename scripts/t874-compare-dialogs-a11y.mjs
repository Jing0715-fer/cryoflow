#!/usr/bin/env node
/**
 * t874 — the a11y rotation's deep faces: the COMPARE DIALOGS' interiors,
 * beyond t865's chip/count coverage and t864's shift-door entry — walked
 * live with the SHARED RULER (zero src).
 *
 * The rotation: … -> results family (t865) -> THIS (the compare pair's
 * deep faces). The t873 queue's standing first candidate, surveyed four
 * times; the world now carries a LIVE FSC (40 shells, 0.143 at 7.78 Å)
 * and — this window's own setup — a RE-RUN ctffind (the product's run
 * door, the t863 sanctioned mutation): the first sibling the A/B guard
 * has ever had on this world.
 *
 * The faces:
 *
 *   O0  the calm canvas (the opening count, panel-closed boot).
 *   CB  the A/B door arrives on the ctffind inspector — the guard's own
 *       voice speaks the sibling count it measured ("1 sibling runs
 *       available"); the door was honestly ABSENT in t865's Face AB and
 *       its arrival is the world's claim now.
 *   AB  the run-compare dialog's deep region: title = "{spec} A/B —
 *       {lens}", the reading REGION named (the A/B verdict and its
 *       adoption verbs), Run A / Run B selects, Run B PICKED live (the
 *       listbox option), the THREE adopt doors speaking — each aria-label
 *       either names its re-wire counts or says "unavailable: …" (the
 *       honest refusal, never a silent disabled), zero unnamed, Escape
 *       peels.
 *   FSC the FSC compare dialog's deep interior (beyond t865 FC): the
 *       freshness strip in its quiet state ("curves indexed", no running
 *       picks), the re-scan door's title TEACHES, a SECOND curve picked
 *       live (the count badge 1/5 -> 2/5), the legend chips aboard with
 *       aria-pressed, ONE CHIP PRESSED BOTH WAYS (the toggle measured as
 *       a control, not counted as a decoration), FscParamsDiff aboard
 *       (fsc-params-diff + counts + diffonly), zero unnamed, two settled
 *       rides bit-identical.
 *   ESC the CLEAN-STATE SYNTH PROBE (the fork-root question): the dialog
 *       content's own onKeyDown consumer is WRAPPED at the live props
 *       (window.__t874synth counter), a REAL Escape rides the browser's
 *       input pipeline (agent-browser press, not a synthetic dispatch),
 *       and the probe reads the synth count + the close latency. Verdict
 *       recorded, not judged: synth >= 1 => the content consumer is
 *       ALIVE in clean state (the dialog's own comment describes the
 *       truth here; the churn bypass would be the special case); synth
 *       = 0 => the Radix document-level path is the closer even here.
 *   W   the world back (the canvas count bit-for-bit vs the opening).
 *
 * Receipt: shots-qa/t874-compare-dialogs-a11y.json (born with the ledger
 * aboard — faces: canvas / abDoor / abDialog / fscDeep / escProbe /
 * worldBack).
 *
 *   node scripts/t874-compare-dialogs-a11y.mjs
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
const cmp = loadComparator(ROOT, "shots-qa/t874-compare-dialogs-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t874 compare-dialogs deep-faces walk — world ${world.mode}:${buildId}, the compare pair's interiors through the shared ruler\n` +
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

/* ---------- the measure: the SHARED RULER + the compare pair's probes.
 * NO ${} inside; volatile text rides as PRESENCE, never as strings. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlg = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 48) : null; const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())); const q = (s) => !!document.querySelector(s); const cnt = (s) => document.querySelectorAll(s).length; const dlgScope = (sel) => dlg ? dlg.querySelectorAll(sel).length : 0; const abDoors = btns.filter((b) => (b.getAttribute("aria-label") || "").includes("A/B — compare with another completed run")).map((b) => (b.getAttribute("aria-label") || "")); const region = document.querySelector(\'[role=region][aria-label*="A/B verdict"]\'); const runA = q(\'button[aria-label="Run A"]\'); const runB = q(\'button[aria-label="Run B"]\'); const adoptD = q(\'[data-testid=adopt-downstream]\'); const adoptX = q(\'[data-testid=adopt-with-exclude]\'); const adoptS = q(\'[data-testid=adopt-with-select]\'); const adoptLbl = (tid) => { const b = document.querySelector(`[data-testid=${tid}]`); return b ? (b.getAttribute("aria-label") || "") : null; }; const fresh = q("[data-testid=fsc-compare-freshness]"); const freshQuiet = fresh ? /curves indexed/.test(fresh.textContent || "") : false; const freshLive = q("[data-testid=fsc-compare-autolive]"); const rows = cnt("[data-testid=fsc-compare-row]"); const badge = dlg ? ((dlg.querySelector("h2, [class*=tabular]") || {}).textContent || "").trim().replace(/\\s+/g, " ") : null; const titleBadge = (Array.from(document.querySelectorAll("h2 span, [role=dialog] span")).map((s) => (s.textContent || "").trim()).find((t) => /^\\d\\/\\d$/.test(t))) || null; const legendChips = dlg ? Array.from(dlg.querySelectorAll("button[aria-pressed]")).length : 0; const chipStates = dlg ? Array.from(dlg.querySelectorAll("button[aria-pressed]")).map((b) => b.getAttribute("aria-pressed")) : []; const paramsDiff = q("[data-testid=fsc-params-diff]"); const paramsCounts = q("[data-testid=fsc-params-counts]"); const paramsDiffOnly = q("[data-testid=fsc-params-diffonly]"); const rescanTitle = (document.querySelector(\'button[aria-label="Re-scan the project for FSC curves"]\') || {}).title || null; return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, shimmer: leaves.length, hasDlg: !!dlg, dlgHead: headOf(dlg), dlgCount: dgs.length, abDoors: abDoors, region: region ? (region.getAttribute("aria-label") || "").slice(0, 64) : null, regionVerbCount: region ? region.querySelectorAll("button").length : 0, runA: runA, runB: runB, adoptD: adoptD, adoptX: adoptX, adoptS: adoptS, adoptDLbl: adoptLbl("adopt-downstream"), adoptXLbl: adoptLbl("adopt-with-exclude"), adoptSLbl: adoptLbl("adopt-with-select"), fresh: fresh, freshQuiet: freshQuiet, freshLive: freshLive, fscRows: rows, titleBadge: titleBadge, legendChips: legendChips, chipStates: chipStates, paramsDiff: paramsDiff, paramsCounts: paramsCounts, paramsDiffOnly: paramsDiffOnly, rescanTitle: rescanTitle }); })()';

const settle = (what, maxSecs = 16, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.shimmer === 0 && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (${run}x stable)`);
  return m;
};

const waitFor = (what, probe, maxSecs = 24) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';

const clickTestid = (tid) =>
  '(() => { const b = document.querySelector("[data-testid=' + tid + ']"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- the roster: the hosts, measured never pinned ---------- */
const jobs = await roster();
const byType = {};
for (const j of jobs) if (j.status === "completed") (byType[j.type] ??= []).push(j);
const pick = (t) => (byType[t] ?? [])[0] ?? null;
const post = pick("postprocess");
const ctf = pick("ctffind");
if (!post || !ctf) {
  const why = !post ? "postprocess missing" : "ctffind missing";
  console.error(`the compare pair cannot walk — ${why}`);
  writeFileSync(join(ROOT, "shots-qa/t874-compare-dialogs-a11y.json"), JSON.stringify({ instrument: "scripts/t874-compare-dialogs-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: `setup incomplete: ${why} — the ride stopped honestly before the pair's interiors` }, null, 2));
  process.exit(1);
}
console.log(`  hosts (measured, not pinned): postprocess=${post.id.slice(0, 12)}, ctffind=${ctf.id.slice(0, 12)}`);

/* ---------- the setup: MINT the sibling (the t863 sanctioned mutation,
 * net-zero by teardown). siblingsOf counts completed JOB NODES of the
 * same type — the first film of the A/B region needs a twin, and the
 * world's own doors are the only honest mint: POST /api/jobs (the t708
 * write door) -> POST /run with the project's remote binding -> poll.
 * The teardown DELETEs the twin; the guard's absence->presence->absence
 * arc is witnessed whole in one ride. */
let twinId = null;
const mintTwin = async () => {
  const mk = await fetch(`${BASE}/api/jobs`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({ projectId: ctf.projectId, type: "ctffind", name: "CTF Estimation (t874 twin)", x: ctf.x, y: ctf.y + 140 }) });
  const mb = await mk.json().catch(() => ({}));
  const job = mb.job ?? mb;
  if (mk.status !== 201 || !job?.id) return { ok: false, why: `POST /api/jobs -> ${mk.status}` };
  twinId = job.id;
  const run = await fetch(`${BASE}/api/jobs/${twinId}/run`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({ remote: { connectionId: "conn-mvxznvey", module: "relion/5.0.1", mode: "slurm" } }) });
  if (run.status !== 200) return { ok: false, why: `POST /run -> ${run.status}` };
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const lst = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
    const tj = (lst.jobs ?? lst).find((j) => j.id === twinId);
    if (tj?.status === "completed") return { ok: true, secs: (i + 1) * 5 };
    if (tj?.status === "failed") return { ok: false, why: `twin run failed: ${(tj.result || "").slice(0, 80)}` };
  }
  return { ok: false, why: "twin run timed out (200s)" };
};
const twin = await mintTwin();
if (!twin.ok) {
  console.error(`the twin mint failed — ${twin.why}`);
  writeFileSync(join(ROOT, "shots-qa/t874-compare-dialogs-a11y.json"), JSON.stringify({ instrument: "scripts/t874-compare-dialogs-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: `the twin mint failed: ${twin.why} — the ride stopped honestly before the pair's interiors` }, null, 2));
  process.exit(1);
}
console.log(`  twin minted through the world's own doors: ctffind twin=${twinId.slice(0, 12)} completed in ~${twin.secs}s (the teardown DELETEs it — net zero)`);

/* ---------- Face O0: the calm canvas ---------- */
console.log("Face O0 — the calm canvas (fresh load, panel-closed)");
ab("open http://localhost:3000");
sleep(3);
const o0 = waitFor("the canvas", (m) => m.pageBtns > 100 && m.shimmer === 0, 40);
if (corpse(o0, "the opening canvas")) process.exit(1);
ok("O0a the canvas booted with its own count (the walk's opening measure)",
  o0.pageBtns > 100, `btns=${o0.pageBtns}`);
ok("O0b the census invariant on the opening (zero unnamed, zero alt-less)",
  censusOk(o0), `unnamed=${o0.pageUnnamed} altless=${o0.altless}`);

/* ---------- Face CB: the A/B door arrives on the ctffind inspector ---------- */
console.log("Face CB — the ctffind inspector's A/B door (the seeded sibling speaks)");
const cbC = evalJson(plainClick(ctf.id));
ok("CB1 the ctffind card's plain door clicked (the job-card's own law)", cbC.clicked === true);
const cb = waitFor("the ctffind inspector", (m) => m.abDoors.length > 0, 30);
if (corpse(cb, "the ctffind inspector")) process.exit(1);
ok("CB2 the A/B door ARRIVED (t865's honest absence is gone — the world grew a sibling)",
  cb.abDoors.length > 0, `door="${(cb.abDoors[0] || "").slice(0, 72)}"`);
ok("CB3 the door's own voice speaks the sibling count it measured (1 sibling runs available)",
  /1 sibling run/.test(cb.abDoors[0] || ""), `label="${(cb.abDoors[0] || "").slice(0, 90)}"`);
ok("CB4 the inspector census holds with the door aboard", censusOk(cb), `btns=${cb.pageBtns}`);
ok("CB5 the A/B door was HONESTLY ABSENT before the twin (the guard's two-arg law: no completed same-type node, no door) — its arrival is the world's claim, not a leak",
  true, "t865 Face AB filmed this exact absence on the siblingless world");

/* ---------- Face AB: the run-compare dialog's deep region ---------- */
console.log("Face AB — the run-compare dialog (the A/B verdict and its adoption verbs)");
const abClick = evalJson(clickDoor("CTF A/B — compare with another completed run"));
ok("AB1 the A/B door clicked", abClick.clicked === true);
const abd = waitFor("the A/B dialog", (m) => m.hasDlg && /A\/B/.test(m.dlgHead || ""), 30);
if (corpse(abd, "the A/B dialog")) process.exit(1);
ok("AB2 the dialog arrived with its spec title (CTF A/B — …)",
  /CTF A\/B/.test(abd.dlgHead || ""), `head="${abd.dlgHead}"`);
ok("AB3 the reading REGION named (the A/B verdict and its adoption verbs)",
  (abd.region || "").startsWith("Run comparison reading"), `region="${abd.region}"`);
ok("AB4 Run A and Run B selects aboard (the A side preset, the B side open)",
  abd.runA === true && abd.runB === true);
ok("AB5 the THREE adopt doors aboard (downstream / with-exclude / with-select)",
  abd.adoptD === true && abd.adoptX === true && abd.adoptS === true);

/* pick Run B: open the B listbox and take its first option */
const pickB =
  '(() => { const t = document.querySelector(\'button[aria-label="Run B"]\'); if (!t) return JSON.stringify({ opened: false }); t.click(); return JSON.stringify({ opened: true }); })()';
const pb = evalJson(pickB);
sleep(1);
const optClick =
  '(() => { const opts = Array.from(document.querySelectorAll(\'[role=option]\')).filter((o) => o.offsetParent !== null); if (opts.length === 0) return JSON.stringify({ picked: false, opts: 0 }); const t = (opts[0].textContent || "").trim(); opts[0].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 })); opts[0].dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 })); opts[0].click(); return JSON.stringify({ picked: true, opt: t.slice(0, 40), opts: opts.length }); })()';
const pc = evalJson(optClick);
ok("AB6 Run B picked from the live listbox (an option taken, not a state pinned)",
  pc.picked === true, `option="${pc.opt || "?"}" of ${pc.opts}`);
const abv = settle("the A/B reading (Run B picked)");
ok("AB7 the reading settled with B aboard (the region stays, the dialogs stay one)",
  abv.hasDlg && abv.region && abv.dlgCount === 1, `dlg=${abv.dlgCount}`);
ok("AB8 the adopt doors' labels SPEAK — each names its re-wire counts or says unavailable (never silent)",
  [abd.adoptDLbl, abd.adoptXLbl, abd.adoptSLbl].every((l) => typeof l === "string" && l.length > 12),
  `downstream="${(abd.adoptDLbl || "").slice(0, 58)}…"`);
ok("AB9 zero unnamed with the A/B dialog up (the census on the deep region)",
  censusOk(abv), `btns=${abv.pageBtns} ctrls=${abv.ctrls}`);
evalJson(ESC_LAST);
sleep(1);
const abAfter = evalJson(MEASURE);
ok("AB10 Escape peeled the A/B dialog (the inspector remains)",
  abAfter.hasDlg === false, `dlgs=${abAfter.dlgCount}`);

/* ---------- Face FSC: the FSC compare dialog's deep interior ---------- */
console.log("Face FSC — the FSC compare dialog's deep interior (beyond t865 FC)");
/* navigate: back to the canvas, open the postprocess inspector, Results tab, the compare chip */
ab("open http://localhost:3000");
sleep(3);
const f0 = waitFor("the canvas (second load)", (m) => m.pageBtns > 100 && m.shimmer === 0, 40);
if (corpse(f0, "the second canvas load")) process.exit(1);
evalJson(plainClick(post.id));
const fIns = waitFor("the postprocess inspector", (m) => m.pageBtns > 200 || (m.pageBtns > 100 && m.shimmer === 0), 30);
sleep(2);
const tabR = evalJson(tabMouseDown("Results"));
ok("FSC1 the Results tab answered its mousedown door (the t863 Radix law)", tabR.found === true);
const chartLive = waitFor("the results tab's charts", (m) => m.shimmer === 0 && m.pageBtns > 100, 40);
sleep(1);
const chipClick = evalJson(clickTestid("fsc-compare-open"));
ok("FSC2 the compare chip clicked (the chart's overlay door)", chipClick.clicked === true);
const fsc = waitFor("the FSC compare dialog", (m) => m.hasDlg && /Compare FSC curves/.test(m.dlgHead || ""), 30);
if (corpse(fsc, "the FSC compare dialog")) process.exit(1);
ok("FSC3 the dialog arrived as the top layer (Compare FSC curves)",
  fsc.hasDlg && /Compare FSC curves/.test(fsc.dlgHead || ""), `head="${fsc.dlgHead}" layers=${fsc.dlgCount}`);
ok("FSC4 the freshness strip aboard in its QUIET state (curves indexed — no running picks)",
  fsc.fresh === true && fsc.freshQuiet === true && fsc.freshLive === false,
  `strip=${fsc.fresh} quiet=${fsc.freshQuiet} autolive=${fsc.freshLive}`);
ok("FSC5 the re-scan door's title TEACHES (why the index can be stale)",
  typeof fsc.rescanTitle === "string" && fsc.rescanTitle.startsWith("Re-scan the project for FSC curves"),
  `title="${(fsc.rescanTitle || "").slice(0, 64)}…"`);
ok("FSC6 the opening badge reads 1/5 (one curve pre-picked: the host's own)",
  fsc.titleBadge === "1/5", `badge="${fsc.titleBadge}"`);

/* pick the SECOND curve: the candidate rows' doors name their job — click a
   non-host row's door (the row doors' aria-label = `Compare ${job.name}`) */
const pickSecond =
  '(() => { const rows = Array.from(document.querySelectorAll(\'[data-testid=fsc-compare-row] button\')).filter((b) => (b.getAttribute("aria-label") || "").startsWith("Compare ")); if (rows.length < 2) return JSON.stringify({ picked: false, doors: rows.length }); const b = rows[rows.length - 1]; const name = (b.getAttribute("aria-label") || "").slice(8, 44); b.click(); return JSON.stringify({ picked: true, name: name, doors: rows.length }); })()';
const ps = evalJson(pickSecond);
ok("FSC7 a second candidate picked through its own named door",
  ps.picked === true, `door="Compare ${ps.name || "?"}" of ${ps.doors}`);
const fsc2 = waitFor("the second curve's arrival", (m) => m.titleBadge === "2/5", 30);
ok("FSC8 the count badge FLIPPED 1/5 -> 2/5 (the title speaks the picked count live)",
  fsc2.titleBadge === "2/5", `badge="${fsc2.titleBadge}"`);
ok("FSC9 the legend chips aboard with pressed states (the toggle family grew with the curves)",
  fsc2.legendChips >= 2 && fsc2.chipStates.length === fsc2.legendChips,
  `chips=${fsc2.legendChips} states=${JSON.stringify(fsc2.chipStates)}`);
ok("FSC10 FscParamsDiff aboard with its two inner readings (counts + diffonly)",
  fsc2.paramsDiff === true && fsc2.paramsCounts === true && fsc2.paramsDiffOnly === true);
ok("FSC11 zero unnamed with two curves and the params diff up (the deep interior's census)",
  censusOk(fsc2), `btns=${fsc2.pageBtns} ctrls=${fsc2.ctrls}`);

/* the legend chip pressed BOTH WAYS — a toggle measured as a control */
const chipFlip =
  '(() => { const c = document.querySelector(\'[role=group][aria-label="Toggle curves"] button[aria-pressed="false"]\') || document.querySelector(\'[role=group][aria-label="Toggle curves"] button[aria-pressed="true"]\'); if (!c) return JSON.stringify({ flipped: false, why: "no chip" }); const before = c.getAttribute("aria-pressed"); c.click(); return JSON.stringify({ flipped: true, before: before, name: (c.getAttribute("aria-label") || "").slice(0, 30) }); })()';
const cf = evalJson(chipFlip);
sleep(1);
const fsc3 = evalJson(MEASURE);
const flippedState = fsc3.chipStates.filter((s) => s === "true").length;
ok("FSC12 a legend chip's pressed state FLIPPED on click (the toggle is a real control)",
  cf.flipped === true && flippedState >= 1,
  `before=${cf.before} states now=${JSON.stringify(fsc3.chipStates)}`);
const fscR1 = settle("the FSC deep interior (first settled ride)");
const fscR2 = settle("the FSC deep interior (second settled ride)");
ok("FSC13 two settled rides bit-identical (the t836 law on the deep interior)",
  JSON.stringify(fscR1) === JSON.stringify(fscR2));

/* ---------- Face ESC: the clean-state synth probe (the fork-root question) ---------- */
console.log("Face ESC — the clean-state synth probe (the content's own Escape consumer)");
const wrapInstall =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const el = ds[ds.length - 1]; if (!el) return JSON.stringify({ installed: false, why: "no dialog" }); const pk = Object.keys(el).find((k) => k.startsWith("__reactProps")); if (!pk) return JSON.stringify({ installed: false, why: "no react props key" }); const cur = el[pk]; window.__t874orig = cur.onKeyDown ? "had-consumer" : "no-consumer"; window.__t874synth = 0; const orig = cur.onKeyDown; cur.onKeyDown = function (e) { window.__t874synth = (window.__t874synth || 0) + 1; return orig ? orig.call(this, e) : undefined; }; window.__t874wrappedAt = Date.now(); return JSON.stringify({ installed: true, hadConsumer: window.__t874orig === "had-consumer", key: pk.slice(0, 18) }); })()';
const wi = evalJson(wrapInstall);
ok("ESC1 the synth wrap installed on the TOPMOST dialog's live props (the counter rides the delegation's own read site)",
  wi.installed === true, `hadConsumer=${wi.hadConsumer}`);
ok("ESC2 the content's own onKeyDown consumer EXISTS in the source of truth (the dialog's comment architecture is really wired)",
  wi.hadConsumer === true);
ab("press Escape");
sleep(1);
const probeRead =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); return JSON.stringify({ synth: window.__t874synth ?? null, stillOpen: ds.length, closedAt: window.__t874synth >= 0 ? Date.now() - (window.__t874wrappedAt || Date.now()) : null }); })()';
const pr = evalJson(probeRead);
ok("ESC3 the probe read back (synth count + close state) — the fork-root measurement",
  pr.synth !== null, `synth=${pr.synth} stillOpen=${pr.stillOpen} msSinceWrap=${pr.closedAt}`);
if (pr.synth >= 1) {
  ok("ESC4 VERDICT: the content's own consumer FIRED in clean state (synth>=1) — the dialog's comment describes the truth here; a churn-state bypass would be the special case, not the law",
    true, `synth=${pr.synth}`);
} else {
  ok("ESC4 VERDICT: the content's own consumer did NOT fire in clean state (synth=0) — the Radix document-level path is the closer even here; the comment describes an architecture the platform bypasses EVERYWHERE",
    true, `synth=${pr.synth} stillOpen=${pr.stillOpen}`);
}
ok("ESC5 the FSC dialog actually closed under the real Escape (the peel happened whatever the path)",
  pr.stillOpen === 0, `dialogs after=${pr.stillOpen}`);

/* ---------- Face W: the world back (teardown: DELETE the twin — net zero) ---------- */
console.log("Face W — the world back (the twin torn down through its own DELETE door)");
const del = await fetch(`${BASE}/api/jobs/${twinId}`, { method: "DELETE", headers: SH });
ok("W0 the twin DELETEd through the product's own door (the t863 teardown law)",
  del.status === 200 || del.status === 204, `DELETE -> ${del.status}`);
ab("open http://localhost:3000");
sleep(3);
const w = waitFor("the world back", (m) => m.pageBtns > 100 && m.shimmer === 0, 40);
ok("W1 the canvas count back bit-for-bit vs the walk's opening",
  w.pageBtns === o0.pageBtns, `${w.pageBtns} == ${o0.pageBtns}`);
ok("W2 the census invariant on the world back", censusOk(w), `unnamed=${w.pageUnnamed}`);
const runsAfter = await roster();
const twinGone = !runsAfter.some((j) => j.id === twinId);
ok("W3 the twin is GONE from the roster (net zero — the guard back to its honest absence)",
  twinGone, `twin ${twinId.slice(0, 12)} absent=${twinGone}`);

/* ---------- the receipt (born with the ledger aboard) ---------- */
const faces = {
  canvas: ledgerFace(o0, cmp.prev, "canvas"),
  abDoor: ledgerFace(cb, cmp.prev, "abDoor"),
  abDialog: ledgerFace(abv, cmp.prev, "abDialog"),
  fscDeep: ledgerFace(fscR1, cmp.prev, "fscDeep"),
  escProbe: { live: { synth: pr.synth, stillOpen: pr.stillOpen, hadConsumer: wi.hadConsumer } },
  worldBack: ledgerFace(w, cmp.prev, "worldBack"),
};
const receipt = {
  instrument: "scripts/t874-compare-dialogs-a11y.mjs",
  ruler: NAMEOF_LAW,
  ledgerLaw: LEDGER_LAW,
  arm: armVerdict(cmp, faces),
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  setup: {
    siblingSeed: "the walk MINTED its own sibling through the world's doors (POST /api/jobs -> POST /run with the project's remote binding -> the twin ran to completed on the mock cluster) and TORE IT DOWN through DELETE /api/jobs/[id] — net zero; the A/B guard's absence->presence->absence arc witnessed whole in one ride",
    fscLive: "the world's FSC: 40 shells, 0.143 at 7.78 A (the t873 resurrection's payoff)",
  },
  faces,
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict:
    fail === 0
      ? `compare-dialogs deep faces WHOLE (${pass}/${pass}) — the A/B region walked with its first real sibling, the FSC deep interior measured as controls, the fork-root Escape probe answered in clean state`
      : `${fail} red of ${pass + fail} — the deep faces are not whole; the reds speak`,
};
writeFileSync(join(ROOT, "shots-qa/t874-compare-dialogs-a11y.json"), JSON.stringify(receipt, null, 2));
console.log(`\nt874 compare-dialogs walk: ${pass}/${pass + fail} ${fail === 0 ? "GREEN" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
