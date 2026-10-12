#!/usr/bin/env node
/**
 * t871 — the class3d/symexpand/rebalance family's FIRST GALLERY FACES
 * (the t870 tail's first candidate, non-build-day arm): the roster grew
 * past the walked rooms — the class gallery's film (t869) rode class2d
 * only; class3d's own tiles, the symexpand report's tables, and the
 * rebalance report's rows are unwalked. One command, three faces, the
 * shared-ruler idiom, receipts + screenshots, born with the ledger
 * aboard (the t861 birthright — first ride, arm 1, recorded).
 *
 * Face K — class3d's own iteration gallery (the film's second host):
 *   the host is MEASURED, never pinned: the roster's class3d job.
 *   API cross-check: /api/jobs/<id>/iterations speaks { iterations,
 *   latest, classes, total, stacks } — the UI must speak the SAME
 *   truth: the chips tablist's round count === the API's iterations
 *   length, the class cards' parsed counts sum === the API's total,
 *   the sheet's wrapper label carries the latest round, one chip step
 *   re-speaks the sheet (the t869 film-pair law at round scale), the
 *   jump-home door returns bit-for-bit to the latest.
 *
 * Face S — symexpand's own STAR tables (the t866 lens on a new room):
 *   the Results tab's STAR tables section with its file doors — the
 *   world's TWO dialects (particles_symexp.star AND
 *   particles_symexpand.star) both door'd, the first door opens the
 *   star table dialog (the t866 topmost layer), the region named with
 *   its keyboard door, zero unnamed page-wide with the dialog up,
 *   Escape closes (the world must close what it opened).
 *
 * Face R — the rebalance report's rows (the Overview tab's own room):
 *   API cross-check: /api/jobs/<id>/rebalance speaks { stats, bins }.
 *   THE ARITHMETIC LAW: stats.totalAfter === stats.totalBefore -
 *   stats.removed, and EVERY rendered per-bin bar's label
 *   ("orientation bin N: X before, Y after") must satisfy
 *   X === bins[N].countAfter && Y === bins[N].countBefore &&
 *   Y - X === bins[N].removed — the DOM speaks the API's truth or the
 *   face reds. The six Delta tiles aboard, the honest footnote aboard
 *   (the 3DFSC disclaimer), the progressbar coherence (valuemax ===
 *   countBefore), zero unnamed within the section.
 *
 * Receipt: shots-qa/t871-family-faces.json (+ two PNGs archived).
 *
 *   node scripts/t871-family-faces.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const RECEIPT = "shots-qa/t871-family-faces.json";

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
      /* a plain string */
    }
  }
  return out;
};

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

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';
const pressEscape = '(() => { document.activeElement && document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return "esc"; })()';

/* the shared ruler — the family's canonical chain (shared-ruler.mjs is
 * node-side self-tested; this face's MEASURE embeds the same order) */
const NAMEOF =
  "(function nameOf(el){var al=el.getAttribute('aria-label');if(al)return al;var lb=el.getAttribute('aria-labelledby');if(lb){var t=lb.split(/\\s+/).map(function(i){var d=document.getElementById(i);return d?d.textContent:'';}).join(' ').trim();if(t)return t;}if(el.tagName==='INPUT'||el.tagName==='SELECT'||el.tagName==='TEXTAREA'){if(el.labels&&el.labels.length){var lt=Array.from(el.labels).map(function(l){return l.textContent||'';}).join(' ').trim();if(lt)return lt;}}var tx=(el.textContent||'').trim();if(tx)return tx;if(el.tagName==='IMG'&&el.hasAttribute('alt'))return el.getAttribute('alt')||'';if(el.tagName==='INPUT'){return el.value||el.placeholder||'';}return '';})";

const MEASURE =
  '(() => { const nameOf = ' + NAMEOF + ';' +
  ' const btns = Array.from(document.querySelectorAll("button"));' +
  ' const un = btns.filter((b) => !nameOf(b));' +
  ' const ctrls = Array.from(document.querySelectorAll("input,select,textarea"));' +
  ' const unCtrls = ctrls.filter((c) => !nameOf(c));' +
  ' const imgs = Array.from(document.querySelectorAll("img"));' +
  ' const altless = imgs.filter((i) => !i.hasAttribute("alt"));' +
  ' const dgs = Array.from(document.querySelectorAll("[role=dialog]"));' +
  ' const kSec = document.querySelector(\'section[aria-label="Class snapshots per iteration"]\');' +
  ' const kTabs = kSec ? Array.from(kSec.querySelectorAll(\'[role="tablist"][aria-label="Iteration rounds"] [role="tab"], [role="tablist"][aria-label="Iteration rounds"] button\')) : [];' +
  ' const kSheetWrap = kSec ? kSec.querySelector(\'button[aria-label^="Open iteration"]\') : null;' +
  ' const kSheetImg = kSheetWrap ? kSheetWrap.querySelector("img") : null;' +
  ' const kCards = kSec ? Array.from(kSec.querySelectorAll(\'button[aria-label^="Class "]\')) : [];' +
  ' const kLatest = kSec ? !!kSec.querySelector(\'button[aria-label="Jump back to the latest iteration"]\') : false;' +
  ' const sSec = document.querySelector(\'section[aria-label="STAR tables"]\');' +
  ' const sDoors = sSec ? Array.from(sSec.querySelectorAll("button")) : [];' +
  ' const rSec = document.querySelector(\'section[aria-label="Orientation rebalance report"]\');' +
  ' const rBars = rSec ? Array.from(rSec.querySelectorAll(\'[role="progressbar"]\')) : [];' +
  ' const rBarLabels = rBars.map((b) => b.getAttribute("aria-label") || "");' +
  ' const rTileTexts = rSec ? Array.from(rSec.querySelectorAll("p")).filter((p) => (p.className || "").includes("text-[" + "10px]")).map((p) => (p.textContent || "").trim()).filter(Boolean) : [];' +
  ' const rFoot = rSec ? /distribution-based estimate/.test(rSec.textContent || "") : false;' +
  ' const rBadges = rSec ? (rSec.querySelector("div.mb-2") ? (rSec.querySelector("div.mb-2").textContent || "").trim().slice(0, 160) : "") : "";' +
  ' const rUn = rSec ? Array.from(rSec.querySelectorAll("button,input,select,textarea")).filter((e) => !nameOf(e)).length : -1;' +
  ' const vis = (e) => !!e && e.offsetParent !== null;' +
  ' return JSON.stringify({ pageBtns: btns.length, pageUnnamed: un.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, hasDlg: dgs.length > 0, dlgCount: dgs.length,' +
  '  kSec: !!kSec, kVis: vis(kSec), kTabs: kTabs.length, kTabFirst: kTabs[0] ? nameOf(kTabs[0]).slice(0, 40) : "", kTabLast: kTabs[kTabs.length - 1] ? nameOf(kTabs[kTabs.length - 1]).slice(0, 40) : "",' +
  '  kSheetLabel: kSheetWrap ? (kSheetWrap.getAttribute("aria-label") || "") : "",' +
  '  kSheetOk: kSheetImg ? kSheetImg.complete && kSheetImg.naturalWidth > 0 : false,' +
  '  kSheetSrc: kSheetImg ? (kSheetImg.currentSrc || kSheetImg.src || "").replace(location.origin, "").slice(0, 120) : "",' +
  '  kCards: kCards.length, kCardLabels: kCards.slice(0, 4).map((c) => (c.getAttribute("aria-label") || "").slice(0, 60)), kLatest,' +
  '  sSec: !!sSec, sVis: vis(sSec), sDoors: sDoors.length, sDoorNames: sDoors.slice(0, 4).map((d) => nameOf(d).slice(0, 70)),' +
  '  rSec: !!rSec, rVis: vis(rSec), rBars: rBars.length, rBarLabels, rTiles: rTileTexts, rFoot, rBadges, rUn }); })()';

const waitFor = (what, probe, maxSecs = 30) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  console.log(`    (waitFor "${what}" timed out after ${maxSecs}s — the last measure rides)`);
  return m;
};

/* the name the door SPEAKS (the family's canonical chain), not just its
 * aria-label attribute — the STAR file doors carry no aria-label; their
 * name rides the textContent (file + rows + size). The clicker must hear
 * the same name the census's ruler hears. */
const clickByNamePrefix = (prefix) =>
  '(() => { const nameOf = ' + NAMEOF + ';' +
  ' const el = Array.from(document.querySelectorAll("button")).find((b) => nameOf(b).startsWith("' + prefix + '")); if (!el) return JSON.stringify({ clicked: false }); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()';

const num = (s) => Number(String(s).replace(/,/g, ""));

console.log("t871 — the family's first gallery faces (one command, three faces)\n");

const world = worldIdentity(ROOT);
console.log(`  world key: ${world.id} (${world.mode})`);
const cmp = loadComparator(ROOT, RECEIPT, world.id);
const { prevFound, prevBuild, sameBuild, prevRevision } = cmp;
console.log(`  drift ledger: ${prevFound ? `comparator found (build ${prevBuild}, revision ${prevRevision})` : "no predecessor — arm 1 (first ride)"}`);

/* the hosts: measured, never pinned */
const jobs = await roster();
const class3d = jobs.find((j) => j.type === "class3d" && j.status === "completed");
const symexpand = jobs.find((j) => j.type === "symexpand" && j.status === "completed");
const rebalance = jobs.find((j) => j.type === "rebalance" && j.status === "completed");
if (!class3d || !symexpand || !rebalance) {
  console.error("the roster lacks a completed class3d/symexpand/rebalance trio — the ride stops honestly");
  writeFileSync(
    join(ROOT, RECEIPT),
    JSON.stringify({ instrument: "scripts/t871-family-faces.mjs", date: new Date().toISOString(), build: world.id, checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no trio — the ride stopped honestly before the faces" }, null, 2)
  );
  process.exit(1);
}
console.log(`  hosts: ${class3d.name} / ${symexpand.name} / ${rebalance.name}`);

/* the APIs' truth, fetched before the ride (the DOM must speak it) */
const iterApi = await (await fetch(`${BASE}/api/jobs/${class3d.id}/iterations`, { headers: SH })).json();
const rebApi = await (await fetch(`${BASE}/api/jobs/${rebalance.id}/rebalance`, { headers: SH })).json();
const iterCount = Array.isArray(iterApi.iterations) ? iterApi.iterations.length : 0;
const classTotal = iterApi.total ?? 0;
console.log(`  iterations API: ${iterCount} rounds, latest ${iterApi.latest}, ${iterApi.classes?.length ?? "?"} classes, total ${classTotal}`);
console.log(`  rebalance API: before ${rebApi.stats?.totalBefore}, after ${rebApi.stats?.totalAfter}, removed ${rebApi.stats?.removed}, bins ${rebApi.bins?.length}`);

/* Face 0 — the clean room (the t866 law): own the boot state */
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const boot = evalJson(MEASURE);
ok("F0 the clean room: the boot is panel-closed (the instrument owns its conditions)", !boot.hasDlg, `dlgCount=${boot.dlgCount}`);

/* ---------------- Face K — class3d's own iteration gallery ---------------- */
console.log("\nFace K — class3d's own iteration gallery (the film's second host)");
const k1 = evalJson(plainClick(class3d.id));
ok("K1 the card's plain door opened the inspector", k1.clicked === true);
const kArrive = waitFor("the inspector", (m) => m.hasDlg);
evalJson(tabMouseDown("Results"));
const k = waitFor("the class3d gallery (sheet decoded)", (m) => m.kSec && m.kVis && m.kSheetOk && m.kCards > 0, 40);
ok("K2 the gallery section arrives visible with the sheet decoded", k.kSec && k.kVis && k.kSheetOk, `src=${k.kSheetSrc.slice(0, 70)}`);
ok("K3 the chips speak the API's round count", k.kTabs === iterCount, `UI ${k.kTabs} vs API ${iterCount} (first=${k.kTabFirst}, last=${k.kTabLast})`);
const parsedCounts = (k.kCardLabels || []).slice(0, 12).map((l) => { const m = /Class \d+: ([\d,]+) particles/.exec(l); return m ? num(m[1]) : null; });
const sumKnown = parsedCounts.filter((n) => n != null).reduce((a, b) => a + b, 0);
ok("K4 the class cards speak the API's classes and counts", k.kCards === (iterApi.classes?.length ?? 0) && sumKnown === classTotal, `${k.kCards} cards, parsed sum ${sumKnown} vs API total ${classTotal}`);
ok("K5 zero unnamed page-wide with the gallery up", k.pageUnnamed === 0 && k.unCtrls === 0 && k.altless === 0, `btns=${k.pageBtns} imgs=${k.imgs}`);
/* one chip step: click round 5's chip (index 5), the sheet re-speaks.
 * The click names the chip it struck (nameOf — the census's ruler), and
 * the label's settle is TIMELINED (immediate, then 1s steps): a late flip
 * is evidence about the component's clock, recorded, not guessed. */
const beforeLabel = k.kSheetLabel;
let stepped = { clicked: false };
if (k.kTabs > 6) {
  const chipJs =
    '(() => { const nameOf = ' + NAMEOF + ';' +
    ' const bar = document.querySelector(\'[role="tablist"][aria-label="Iteration rounds"]\'); const tabs = bar ? Array.from(bar.querySelectorAll("[role=tab], button")) : []; const t = tabs[5]; if (!t) return JSON.stringify({ clicked: false }); const nm = nameOf(t); t.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true, chip: nm.slice(0, 30) }); })()';
  stepped = evalJson(chipJs);
}
const kTimeline = [];
let kStep = k;
if (stepped.clicked === true) {
  kTimeline.push({ t: 0, label: evalJson(MEASURE).kSheetLabel });
  const found = waitFor("the sheet re-speaks round 5", (m) => { kTimeline.push({ t: kTimeline.length, label: m.kSheetLabel }); return m.kSheetLabel !== beforeLabel && /005/.test(m.kSheetLabel); }, 30);
  kStep = found;
}
ok(
  "K6 one chip step re-speaks the sheet (the document follows the hand)",
  stepped.clicked === true && kStep.kSheetOk && /005/.test(kStep.kSheetLabel),
  `chip="${stepped.chip ?? "-"}" before="${beforeLabel}" after="${kStep.kSheetLabel}" timeline=${JSON.stringify(kTimeline.slice(0, 6))}`
);
/* the jump home: the sheet returns to the latest bit-for-bit. The door's
 * presence is measured on the STEP view (on the latest view the door is
 * honestly absent — it exists exactly when the hand is away from home). */
const kAway = evalJson(MEASURE);
ok("K6b the jump-home door exists exactly when away from home", kAway.kLatest === true && kAway.kSheetLabel !== beforeLabel, `door=${kAway.kLatest}, view="${kAway.kSheetLabel}"`);
if (kAway.kLatest === true) {
  evalJson(clickByNamePrefix("Jump back to the latest iteration"));
}
const kHome = waitFor("the sheet home (label AND its sheet decoded)", (m) => m.kSheetLabel === beforeLabel && m.kSheetOk, 30);
ok("K7 the jump-home door returns the sheet to the latest", kHome.kSheetLabel === beforeLabel && kHome.kSheetOk, `home="${kHome.kSheetLabel}"`);
try {
  execSync(`agent-browser screenshot shots-qa/t871-class3d-gallery.png`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
  ok("K8 the film archived (shots-qa/t871-class3d-gallery.png)", true);
} catch (e) {
  ok("K8 the film archived", false, String((e && e.stderr) || e).slice(0, 100));
}

/* ---------------- Face S — symexpand's own STAR tables ---------------- */
console.log("\nFace S — symexpand's own STAR tables (the t866 lens on a new room)");
evalJson(pressEscape);
sleep(2);
const s1 = evalJson(plainClick(symexpand.id));
ok("S1 the symexpand card's plain door opened the inspector", s1.clicked === true);
waitFor("the inspector", (m) => m.hasDlg);
evalJson(tabMouseDown("Results"));
const s = waitFor("the STAR tables section", (m) => m.sSec && m.sVis && m.sDoors >= 2, 40);
ok("S2 the STAR tables section arrives visible", s.sSec && s.sVis);
ok(
  "S3 the world's two dialects both door'd (the doors' names carry the files)",
  s.sDoors >= 2 && s.sDoorNames.some((n) => /particles_symexp\.star/.test(n)) && s.sDoorNames.some((n) => /particles_symexpand\.star/.test(n)),
  `doors=${s.sDoors} [${s.sDoorNames.map((n) => n.replace(/ \d.*$/, "")).join(" | ")}]`
);
const d1 = evalJson(clickByNamePrefix("particles_symexp.star"));
sleep(2);
const sDlg = waitFor("the star table dialog", (m) => m.dlgCount >= 2, 20);
ok("S4 the door opens the star table dialog above the inspector (the t866 topmost layer)", d1.clicked === true && sDlg.dlgCount >= 2, `dlgCount=${sDlg.dlgCount}`);
ok("S5 zero unnamed page-wide with the dialog up", sDlg.pageUnnamed === 0 && sDlg.unCtrls === 0 && sDlg.altless === 0, `btns=${sDlg.pageBtns}`);
evalJson(pressEscape);
sleep(1);
const sClosed = evalJson(MEASURE);
ok("S6 Escape closed the dialog (the world closes what it opened)", sClosed.dlgCount === 1, `dlgCount=${sClosed.dlgCount}`);

/* ---------------- Face R — the rebalance report's rows ---------------- */
console.log("\nFace R — the rebalance report's rows (the Overview tab's own room)");
evalJson(pressEscape);
sleep(2);
const r1 = evalJson(plainClick(rebalance.id));
ok("R1 the rebalance card's plain door opened the inspector", r1.clicked === true);
waitFor("the inspector", (m) => m.hasDlg);
evalJson(tabMouseDown("Overview"));
const r = waitFor("the rebalance report section", (m) => m.rSec && m.rVis && m.rBars > 0, 40);
ok("R2 the report section arrives visible on the Overview tab", r.rSec && r.rVis, `bars=${r.rBars}`);

const st = rebApi.stats ?? {};
const arith = st.totalBefore - st.removed === st.totalAfter;
ok("R3a the API's own arithmetic law (totalAfter === totalBefore - removed)", arith, `before ${st.totalBefore} - removed ${st.removed} = after ${st.totalAfter}`);

const binsByIndex = new Map((rebApi.bins ?? []).map((b) => [b.index, b]));
let barLawOk = r.rBarLabels.length > 0;
let barLawDetail = "";
for (const lbl of r.rBarLabels) {
  const m = /^orientation bin (\d+): ([\d,]+) before, ([\d,]+) after$/.exec(lbl);
  if (!m) {
    barLawOk = false;
    barLawDetail = `unparseable label: ${lbl.slice(0, 70)}`;
    break;
  }
  const b = binsByIndex.get(Number(m[1]));
  const before = num(m[2]);
  const after = num(m[3]);
  if (!b || b.countBefore !== before || b.countAfter !== after || before - after !== b.removed) {
    barLawOk = false;
    barLawDetail = `bin ${m[1]}: DOM ${before}/${after} vs API ${b ? `${b.countBefore}/${b.countAfter} (removed ${b.removed})` : "missing"}`;
    break;
  }
}
ok("R3b EVERY rendered bar speaks the API's truth (X=countAfter, Y=countBefore, Y-X=removed)", barLawOk, barLawDetail || `${r.rBars} bars all law-abiding`);
const r2 = evalJson(MEASURE);
const barsCoherent = r2.rBars === Math.min(rebApi.bins?.length ?? 0, 24);
ok("R4 the bar count speaks the chart's own cap (min(bins, 24))", barsCoherent, `DOM ${r2.rBars} vs min(${rebApi.bins?.length}, 24)`);
const tileNames = (r2.rTiles || []).map((t) => t.trim());
const wantTiles = ["Particles", "Removed", "Anisotropy", "Count uniformity", "Mean 3DFSC est.", "Resolution CV"];
const tilesOk = wantTiles.every((w) => tileNames.includes(w));
ok("R5 the six Delta tiles aboard, each named", tilesOk, tileNames.slice(0, 6).join(" | "));
ok("R6 the honest footnote aboard (the 3DFSC disclaimer)", r2.rFoot);
ok("R7 zero unnamed within the section", r2.rUn === 0, `rUn=${r2.rUn}`);
try {
  execSync(`agent-browser screenshot shots-qa/t871-rebalance-report.png`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
  ok("R8 the film archived (shots-qa/t871-rebalance-report.png)", true);
} catch (e) {
  ok("R8 the film archived", false, String((e && e.stderr) || e).slice(0, 100));
}

/* ---------------- the world back ---------------- */
evalJson(pressEscape);
sleep(2);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const w = evalJson(MEASURE);
ok("W1 the world back: panel closed, page healthy", !w.hasDlg && w.pageUnnamed === 0 && w.altless === 0, `btns=${w.pageBtns}`);

/* ---------------- the ledger ---------------- */
const receipt_revision = 1;
const kFace = { pageBtns: k.pageBtns, kTabs: k.kTabs, kCards: k.kCards, sheetOk: k.kSheetOk ? 1 : 0 };
const sFace = { pageBtns: sDlg.pageBtns, sDoors: s.sDoors, dlgCount: sDlg.dlgCount };
const rFace = { pageBtns: r2.pageBtns, rBars: r2.rBars, tiles: r2.rTiles.length };
const kScalar = (o) => o.pageBtns + o.kTabs + o.kCards + o.sheetOk;
const sScalar = (o) => o.pageBtns + o.sDoors + o.dlgCount;
const rScalar = (o) => o.pageBtns + o.rBars + o.tiles;
const faces = {
  class3dGallery: ledgerFace(prevFound ? cmp.prev?.faces?.class3dGallery : null, kFace, kScalar),
  starTables: ledgerFace(prevFound ? cmp.prev?.faces?.starTables : null, sFace, sScalar),
  rebalanceReport: ledgerFace(prevFound ? cmp.prev?.faces?.rebalanceReport : null, rFace, rScalar),
};
const verdicts = Object.entries(faces).map(([n, f]) => `${n}: ${armVerdict(cmp, world, f, receipt_revision).detail}`);
console.log(`\n  drift ledger: ${prevFound ? `sameBuild=${sameBuild}` : "arm 1 (no predecessor)"} — ${verdicts.join("; ")}`);

const receipt = {
  instrument: "scripts/t871-family-faces.mjs",
  instrumentRevision: receipt_revision,
  date: new Date().toISOString(),
  build: world.id,
  hosts: { class3d: class3d.id, symexpand: symexpand.id, rebalance: rebalance.id },
  api: { iterations: { rounds: iterCount, latest: iterApi.latest, classes: iterApi.classes?.length, total: classTotal }, rebalance: { before: st.totalBefore, after: st.totalAfter, removed: st.removed, bins: rebApi.bins?.length } },
  faces: { class3dGallery: kFace, starTables: sFace, rebalanceReport: rFace },
  driftLedger: { prevFound, prevBuild, prevDate: prevFound ? cmp.prev?.date ?? null : null, sameBuild, law: LEDGER_LAW, faces },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict:
    fail === 0
      ? "the family's first gallery faces hold: class3d's own film speaks the iterations API (rounds, classes, counts, the step and the jump home), symexpand's two star dialects both door'd with the dialog named and Escape-honest, the rebalance rows' arithmetic is the API's own truth at DOM scale"
      : `the faces red in ${fail} place(s)`,
};
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2));
console.log(`\nFAMILY-FACES t871: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
