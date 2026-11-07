#!/usr/bin/env node
/**
 * t877 — THE RESCAN BUTTON'S LIVE WORLD: the autolive film's remaining
 * unfilmed half (t876's own tail named it: "the rescan button's live
 * world (the re-scan while the poller is attached)").
 *
 * The freshness strip is ONE unit with two halves: the teal autolive band
 * (the poller's own cadence, filmed at t876) and the labeled Scan button
 * (the manual case). The manual half has never been filmed in the world
 * it exists FOR — a live refinement running underneath the open overlay.
 * This walk runs one (the t876 probe re-issued through the product's own
 * doors), opens the probe's overlay, picks a second (completed) curve,
 * and films the re-scan WHILE THE POLLER IS ATTACHED:
 *
 *   A  the live world seeded (probe resolved, window widened, run issued,
 *      the running window caught, the first live checkpoint landed)
 *   B  the overlay opened with the poller attached (band present, the
 *      tutorial row picked, both curves speaking)
 *   C  FILM — the re-scan in the live world, caught in the SAME TASK as
 *      the click (React 18 flushes discrete events synchronously, so the
 *      walk reads the committed dress before any fetch can resolve):
 *      the scanning dress (disabled + "Scanning…"), the curves dropped
 *      ("Reading curves…"), THE BAND STAYED (the strip's halves move
 *      together) — then the recovery: the button back, the band STILL
 *      present (a re-scan cannot kill the attachment), both curves
 *      re-landed, the selection survived (the restore latch)
 *   D  one poller cadence crossed under the film with NO manual help
 *      (honest tolerance: if the flip lands during the wait, the strip's
 *      own promise arrived early and D says so)
 *   E  the live flip on the OPEN door (band honestly absent with no
 *      interaction — stronger than t876's reopen) + the quiet world's
 *      manual re-scan (the button's other canonical dress)
 *   W  the world back (one-layer escape, the canvas settled, 16
 *      completed, the clean room's keys restored to absence)
 *
 * The per-curve DOM truth is each row's own fetched-resolution span
 * (data-testid=fsc-compare-res-<jobId>: "N.NN Å" once the curve lands,
 * "—" when unreadable, "" while loading) — never a chart-level count.
 *
 * Receipt: shots-qa/t877-rescan-live-world.json.
 *
 *   node scripts/t877-rescan-live-world.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
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
const zzz = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* ---------- the API voice (the healer's law: the Origin header rides
 * every call; the retry is the healer's own cure for transient closes) */
const apiOnce = async (method, url, body) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* a body-less reply is honest too */
  }
  return { status: res.status, body: data };
};
const api = async (method, url, body, attempt = 0) => {
  try {
    return await apiOnce(method, url, body);
  } catch (err) {
    if (attempt >= 2) throw err;
    await zzz(2);
    return api(method, url, body, attempt + 1);
  }
};
const jobsList = async () => (await api("GET", "/api/jobs")).body?.jobs ?? [];

/* ---------- the browser measure (the film's lens) ---------- */
const MEASURE =
  '(() => { ' + NAMEOF + ' const inTree = (e) => e.getAttribute("aria-hidden") !== "true" && !e.hidden && !(e.closest && e.closest("[aria-hidden=true]")); const btns = Array.from(document.querySelectorAll("button")).filter(inTree); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")).filter(inTree); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const q = (root, s) => root ? root.querySelector(s) : null; const qa = (root, s) => root ? Array.from(root.querySelectorAll(s)) : []; const titleOf = (d) => ((q(d, "[data-slot=dialog-title]") || q(d, "h1,h2") || {}).textContent || "").trim(); const fsc = dgs.find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); const autolive = q(fsc, "[data-testid=fsc-compare-autolive]"); const fresh = q(fsc, "[data-testid=fsc-compare-freshness]"); const rows = qa(fsc, "[data-testid=fsc-compare-row]"); const scanBtn = q(fsc, "[data-testid=fsc-compare-rescan]"); const legChips = qa(fsc, "[data-testid^=fsc-compare-legend-]"); const rowBy = (needle) => rows.find((r) => (r.textContent || "").indexOf(needle) !== -1); const resOf = (r) => { if (!r) return null; const s = r.querySelector("[data-testid^=fsc-compare-res-]"); return s ? (s.textContent || "").trim() : null; }; const cbOf = (r) => { const cb = r && r.querySelector("[role=checkbox]"); return cb ? cb.getAttribute("aria-checked") : null; }; const pr = fsc ? rowBy("live probe") : null; const tr = fsc ? rowBy("3D Refine (tutorial)") : null; return JSON.stringify({ url: location.pathname, pageBtns: btns.length, cards: document.querySelectorAll("[data-card-btn]").length, pageUnnamed: un.length, unWho: un.slice(0, 3).map((b) => (b.textContent || "").trim().slice(0, 20) || (b.getAttribute("aria-label") || "no-name").slice(0, 20)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgs.filter((i) => !i.complete).length, dlgCount: dgs.length, dlgHeads: dgs.map(titleOf).map((t) => t.slice(0, 40)), fscOpen: !!fsc, fscCap: fsc ? ((titleOf(fsc).match(/(\\d+)\\/(\\d+)/) || [null])[0]) : null, fscRows: rows.length, fscFresh: !!fresh, fscAutolive: !!autolive, fscAutoliveText: autolive ? (autolive.textContent || "").trim().slice(0, 90) : null, fscIndexLine: fsc ? ((fsc.textContent || "").match(/\\d+ curves? indexed/) || [null])[0] : null, fscChartSvg: fsc ? fsc.querySelectorAll("svg").length : 0, fscScanDis: scanBtn ? scanBtn.disabled : null, fscScanLbl: scanBtn ? (scanBtn.textContent || "").trim() : null, fscQuietText: (fresh && !autolive) ? (((q(fresh, "p") || {}).textContent || "").trim().slice(0, 60)) : null, fscLegend: legChips.length, fscLegendPressed: legChips.filter((c) => c.getAttribute("aria-pressed") === "true").length, fscTutChecked: cbOf(tr), fscProbeChecked: cbOf(pr), resProbe: resOf(pr), resTut: resOf(tr), liveDots: fsc ? fsc.querySelectorAll("[data-testid=fsc-compare-live]").length : 0, probeRow: !!pr }); })()';

/* the SAME-TASK rescan catch, v2 — grown five TIME SAMPLES inside ONE
 * eval (the CLI awaits async evals, probed): the click, then reads at
 * 0/60/140/240/360ms. React's discrete flush lands a beat late in this
 * world, and the curves' re-land outruns the index discovery — the
 * "Reading curves…" window is NARROWER than the scanning window. Five
 * beats in one round trip film both without touching the world's tempo. */
const RESCAN_CATCH =
  '(() => { return (async () => { const b = document.querySelector("[data-testid=fsc-compare-rescan]"); if (!b) return JSON.stringify({ found: false }); const dlgOf = () => Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); const read = () => { const d = dlgOf(); return { lbl: (b.textContent || "").trim(), dis: b.disabled, band: !!document.querySelector("[data-testid=fsc-compare-autolive]"), reading: !!(d && (d.textContent || "").indexOf("Reading curves") !== -1) }; }; const before = { lbl: (b.textContent || "").trim(), dis: b.disabled }; b.click(); const samples = [read()]; for (const wait of [60, 80, 100, 120]) { await new Promise((r) => setTimeout(r, wait)); samples.push(read()); } return JSON.stringify({ found: true, before, samples }); })(); })()';

const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const serverAlive = async () => {
  try {
    const r = await fetch(BASE + "/api/jobs", { headers: { Origin: BASE } });
    return r.status === 200;
  } catch {
    return false;
  }
};
const settle = (what, maxSecs = 16, need = 2) => {
  let m = evalJson(MEASURE);
  /* the MOUNT WAIT (the thin-memory world's own tempo): a fresh open can
   * outrun the dev compile — the page stays unmounted (0 buttons) while
   * the postcss worker spins. The walk waits for the mount (90s) before
   * it judges anything; a blank page under a live server is a slow
   * mount, not a corpse. */
  if (m.pageBtns === 0) {
    console.log("    (the page is unmounted — waiting for the mount)");
    for (let i = 0; i < 90 && m.pageBtns === 0; i++) {
      zzz(1);
      m = evalJson(MEASURE);
    }
  }
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    zzz(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      console.log(`    (measure moved while settling: ${diffKeys(m, next).join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (${run}x stable)`);
  return m;
};
const waitFor = (what, probe, maxSecs = 30) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    zzz(1);
    m = evalJson(MEASURE);
  }
  return m;
};
/* the DTO poller — the async cousin (the API's voice, not the browser's) */
const pollDto = async (probe, maxSecs, what, fetcher) => {
  let d = await fetcher();
  for (let i = 0; i < maxSecs; i++) {
    if (probe(d)) return d;
    await zzz(1.5);
    d = await fetcher();
  }
  return d;
};
/* the CORPSE ARBITER (the t876 lesson, grown a server half): a blank
 * page under a DEAD server is the reaper's corpse — re-ride on a fresh
 * one. A blank page under a LIVE server (after the mount wait) is the
 * tab's own death — the same honest exit, a different epitaph. */
const corpse = async (m, where) => {
  if (!(m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0)) return false;
  const alive = await serverAlive();
  if (alive) {
    console.error(`  ✗ CORPSE at ${where}: pageBtns=0 while the server still speaks — the TAB died; re-ride`);
  } else {
    console.error(`  ✗ CORPSE at ${where}: pageBtns=0 and the server silent — the reaper took it; re-ride on a fresh one`);
  }
  return true;
};
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

const clickJobCard = (needle) =>
  '(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf(' + JSON.stringify(needle) + ') !== -1); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()';
const openFscCompare = '(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const closeInspector = '(() => { const dlg = document.querySelector("[role=dialog]"); const b = dlg && Array.from(dlg.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Close inspector"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
/* the REAL HAND'S DIALECT (the t873 judge-line, which this walk's first
 * rides violated): a real user's Escape targets the focused element and
 * BUBBLES through the dialog's own content — firing the React-level
 * onKeyDown handlers (the overlay's own Escape consumer) BEFORE any
 * document-level listener. A document-dispatched Escape never passes
 * through the content at all: it reaches only Radix's layer stack, whose
 * top-layer bookkeeping this world's flip churn can stale out (five
 * rides' worth of evidence). The dispatch therefore targets the focused
 * element inside the TOP dialog (the last-mounted [role=dialog]),
 * falling back to its content node. */
const escKey = '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const top = dgs.length ? dgs[dgs.length - 1] : document.body; const t = (document.activeElement && top.contains(document.activeElement) && document.activeElement !== top) ? document.activeElement : (top.querySelector("[data-slot=dialog-content]") || top); t.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); return JSON.stringify({ sent: true, target: t.tagName + (t.getAttribute && t.getAttribute("data-testid") ? ":" + t.getAttribute("data-testid") : "") }); })()';
const tutPick =
  '(() => { const dlg = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); if (!dlg) return JSON.stringify({ clicked: false, open: false }); const rows = Array.from(dlg.querySelectorAll("[data-testid=fsc-compare-row]")); const row = rows.find((r) => (r.textContent || "").indexOf("3D Refine (tutorial)") !== -1); if (!row) return JSON.stringify({ clicked: false, rows: rows.length }); const cb = row.querySelector("[role=checkbox]"); if (!cb) return JSON.stringify({ clicked: false, noCb: true }); if (cb.getAttribute("aria-checked") === "true") return JSON.stringify({ clicked: true, already: true }); cb.click(); return JSON.stringify({ clicked: true }); })()';
const cleanRoom =
  '(() => { const kill = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && (k.indexOf("cryoflow.fsc-compare:") === 0 || k === "cryoflow.selectedJob.v1")) kill.push(k); } kill.forEach((k) => localStorage.removeItem(k)); return JSON.stringify({ cleared: kill.length }); })()';

/* ================================================================== */
const world = worldIdentity(ROOT);
/* the walk never stack-traces into the dark (the corpse-arbiter's law
 * grown a receipt half): any uncaught error writes the honest failure
 * receipt before the exit */
process.on("uncaughtException", (err) => {
  console.error(`\n  ✗ UNCAUGHT: ${String(err).slice(0, 300)}`);
  try {
    writeFileSync(
      join(ROOT, "shots-qa", "t877-rescan-live-world.json"),
      JSON.stringify({ instrument: "scripts/t877-rescan-live-world.mjs", ruler: NAMEOF_LAW, build: world.id, worldMode: world.mode, date: new Date().toISOString(), chain: "interrupted by an uncaught error", verdict: `uncaught: ${String(err).slice(0, 200)} — most often the reaper took the dev server mid-film; re-ride on the revived one`, checks: results, passed: pass, failed: fail + 1 }, null, 2) + "\n"
    );
  } catch {
    /* the receipt's own death is honest too */
  }
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error(`\n  ✗ UNHANDLED REJECTION: ${String(err).slice(0, 300)}`);
  try {
    writeFileSync(
      join(ROOT, "shots-qa", "t877-rescan-live-world.json"),
      JSON.stringify({ instrument: "scripts/t877-rescan-live-world.mjs", ruler: NAMEOF_LAW, build: world.id, worldMode: world.mode, date: new Date().toISOString(), chain: "interrupted by an unhandled rejection", verdict: `rejection: ${String(err).slice(0, 200)} — most often the reaper took the dev server mid-film; re-ride on the revived one`, checks: results, passed: pass, failed: fail + 1 }, null, 2) + "\n"
    );
  } catch {
    /* the receipt's own death is honest too */
  }
  process.exit(1);
});
console.log(`t877 rescan live-world film — world ${world.mode}:${world.id}, the strip's manual half in the world it exists for\n`);

/* ---------- face A: the live world seeded ---------- */
console.log("Face A — the live world seeded (the probe re-issued through the product's own doors)");
const projects = (await api("GET", "/api/projects")).body;
const projList = Array.isArray(projects) ? projects : projects?.projects ?? [];
const proj = projList.find((p) => p.name?.includes("β-Galactosidase")) ?? projList.find((p) => p.name?.toLowerCase().includes("demo"));
ok("A1 the demo project resolved", !!proj, proj?.name ?? "none");
const PROJ = proj.id;
const all = await jobsList();
const inProj = all.filter((j) => j.projectId === PROJ);
const rebalance = inProj.find((j) => j.type === "rebalance");
ok("A2 the canonical rebalance found", !!rebalance, rebalance?.id?.slice(-6));
const probe = inProj.find((j) => j.name === "3D Refine (live probe t876)");
ok("A3 the probe resolved (a previous ride's — part of the world now)", !!probe, probe?.id?.slice(-6) ?? "absent");
if (!probe || !rebalance) process.exit(1);
const edges = (await api("GET", "/api/edges")).body?.edges ?? [];
const wired = edges.some((e) => e.fromJobId === rebalance.id && e.toJobId === probe.id);
if (!wired) {
  const e = await api("POST", "/api/edges", { fromJobId: rebalance.id, toJobId: probe.id });
  ok("A4 the spine edge wired (rebalance → probe)", e.status === 201, `HTTP ${e.status}`);
} else {
  ok("A4 the spine edge already in place", true);
}
/* the window law (t876's): the sim spends ~0.9s per iteration — the
 * probe runs the spec's own 50-iteration clamp, a window the film can
 * actually cross */
const wide = await api("PATCH", `/api/jobs/${probe.id}`, { params: { autoRefine: false, iterations: 50 } });
ok("A5 the probe's window widened (50 fixed iterations)", wide.status === 200, `HTTP ${wide.status}`);

/* ---------- face B: the overlay opened with the poller attached ----------
 * THE ATTEMPT LOOP (the restage law, t876's discovery): issue the run,
 * catch the window, walk the doors FAST; if the window closed mid-walk,
 * the honest retry is one more run. */
console.log("Face B — the overlay opened with the poller attached (the attempt loop)");
const CONN_ID = ((await api("GET", "/api/remote/connections")).body?.connections ?? []).find((c) => c.name === "Mock Cluster")?.id;
ok("B1 the Mock Cluster connection resolved", !!CONN_ID, CONN_ID);
const runBody = { remote: { connectionId: CONN_ID, module: "relion/5.0.1", mode: "slurm" } };
const probeDto = async () => (await jobsList()).find((j) => j.id === probe.id) ?? null;

/* ---------- face O: the stage set BEFORE the run (t876's order — the
 * sim's window is short, and the canvas reload must NOT race the
 * staging's own memory burst; two rides filmed corpses at exactly that
 * race, and the world's own order is the cure) ---------- */
console.log("Face O — the stage set before the run");
let filmedB = null;
let m0 = null;
evalJson(cleanRoom);
ab("open http://localhost:3000");
zzz(6);
m0 = settle("the canvas");
if (await corpse(m0, "O")) {
  /* the blank-tab remedy (the W-face's own law, aboard at the film's
   * first door too): the thin-memory world's page loads occasionally
   * outrun the settle window — the user's own remedy is one honest
   * reload, not a red */
  console.log("    (blank stage — the user's own remedy: one honest reload)");
  ab("open http://localhost:3000");
  zzz(6);
  m0 = settle("the canvas, after the reload");
  if (await corpse(m0, "O, after the reload")) process.exit(1);
}
/* the DRESS PATIENCE (the t879 ride's O1 red taught): the settle can
 * catch a PARTIALLY-dressed canvas (88 buttons 2x-stable — the cards
 * lazy-mount in waves and thin memory stretches the waves), and the
 * judge fires before the rest arrives. O1b's full-dress gate waits for
 * the CARD count; O1 gets the same patience for the BUTTON count —
 * bounded, honest, the world's tempo not a selector lie. */
let o1Waited = 0;
for (let i = 0; i < 90 && m0.pageBtns < 100; i++) {
  zzz(1);
  o1Waited++;
  m0 = evalJson(MEASURE);
}
ok("O1 the canvas arrives named", m0.pageBtns >= 100 && m0.dlgCount === 0, `btns=${m0.pageBtns} (the 16-card world)${o1Waited ? ` — after ${o1Waited}s of dress patience` : ""}`);
/* the FULL-DRESS gate: the settle can catch a partially-mounted canvas
 * (this walk's ride 11 measured 103 buttons 2x-stable — the cards
 * lazy-mount in waves). The world's own truth is the CARD COUNT: the
 * canvas is dressed when every job in the project has its card. */
const JOBS_N = inProj.length;
for (let i = 0; i < 30 && m0.cards !== JOBS_N; i++) {
  zzz(1);
  m0 = evalJson(MEASURE);
}
ok("O1b the canvas fully dressed (every job's card present)", m0.cards === JOBS_N, `cards=${m0.cards}/${JOBS_N} btns=${m0.pageBtns}`);

for (let attempt = 1; attempt <= 3 && !filmedB; attempt++) {
  console.log(`  (attempt ${attempt})`);
  let dto = await probeDto();
  if (dto.status !== "running") {
    const run = await api("POST", `/api/jobs/${probe.id}/run`, runBody);
    ok(`B2 the run issued (attempt ${attempt})`, run.status === 200 || run.status === 409, `HTTP ${run.status}${run.body?.waiting ? ` (waiting: ${run.body.waiting})` : ""}${run.body?.error ? ` err=${run.body.error}` : ""}`);
    if (run.status !== 200 && run.status !== 409) break;
  } else {
    ok(`B2 the probe already live (attempt ${attempt})`, true);
  }
  const caught = await pollDto((d) => d && d.status === "running", 60, "the running window", probeDto);
  if (caught?.status !== "running") {
    console.log("    (the window never opened this attempt — the honest retry)");
    continue;
  }
  /* the restage law's FULL ARC (this walk's own discovery — attempt 1 of
   * the previous ride caught the PREVIOUS run's shells still sitting in
   * the mirror before the restage wiped them, walked the doors, and the
   * wipe landed under the film): the fresh checkpoint's gate is the WIPE
   * (the route honestly empty) FIRST, then the first new shell. */
  const fscRoute = async () => {
    const f = await api("GET", `/api/jobs/${probe.id}/fsc`);
    return f.body ?? null;
  };
  await pollDto((b) => b !== null && (b.shells?.length ?? 0) === 0, 45, "the restage's wipe", fscRoute);
  const firstCurve = await pollDto((b) => b !== null && (b.shells?.length ?? 0) > 0, 120, "the first live checkpoint", fscRoute);
  if (!firstCurve) {
    console.log("    (no live checkpoint synced this attempt — the honest retry)");
    continue;
  }
  evalJson(clickJobCard("live probe"));
  const insp = waitFor("the probe's inspector", (m) => m.dlgHeads.some((h) => h.startsWith("3D Refine")), 15);
  if (!insp.dlgHeads.some((h) => h.startsWith("3D Refine"))) {
    console.log("    (the inspector did not arrive — the honest retry)");
    evalJson(escKey);
    zzz(1);
    evalJson(closeInspector);
    zzz(1);
    continue;
  }
  let chip = { clicked: false };
  for (let i = 0; i < 8 && !chip.clicked; i++) {
    zzz(1);
    chip = evalJson(openFscCompare);
  }
  if (!chip.clicked) {
    console.log("    (the chip honest-absent this attempt — the window's restage won)");
    evalJson(escKey);
    zzz(1);
    evalJson(closeInspector);
    zzz(1);
    continue;
  }
  /* the three-breath retry (the index's statcache settles on the API's
   * own clock — the probe's running row must be in the list) */
  let ov = { fscOpen: false, probeRow: false, fscRows: 0 };
  for (let breath = 0; breath < 3 && !(ov.fscOpen && ov.probeRow && ov.fscRows >= 2); breath++) {
    if (breath > 0) {
      console.log(`    (index cold, breath ${breath + 1} — the user's own retry: close, reopen)`);
      evalJson(escKey);
      zzz(3);
      let chipR = { clicked: false };
      for (let i = 0; i < 5 && !chipR.clicked; i++) {
        zzz(1);
        chipR = evalJson(openFscCompare);
      }
      if (!chipR.clicked) break;
    }
    ov = waitFor("the overlay with the running row", (m) => m.fscOpen === true && m.probeRow === true && m.fscRows >= 2, 20);
  }
  if (!(ov.fscOpen && ov.probeRow && ov.fscRows >= 2)) {
    console.log("    (the overlay never carried the running row — the honest retry)");
    evalJson(escKey);
    zzz(1);
    evalJson(closeInspector);
    zzz(1);
    continue;
  }
  if (ov.fscAutolive !== true) {
    /* one poller cycle may still land the band while the job runs */
    ov = waitFor("the band inside the window", (m) => m.fscOpen === true && m.fscAutolive === true, 14);
  }
  if (ov.fscOpen && ov.fscAutolive === true) {
    filmedB = ov;
    break;
  }
  console.log("    (the band never mounted this attempt — closing and re-running)");
  evalJson(escKey);
  zzz(1);
  evalJson(closeInspector);
  zzz(1);
}
if (filmedB) {
  ok("B3 the probe's own overlay carried the band (the poller attached)", true, `rows=${filmedB.fscRows}`);
  ok("B4 THE AUTOLIVE PRESENT while a picked job runs", filmedB.fscAutolive === true, `text="${(filmedB.fscAutoliveText ?? "").slice(0, 70)}"`);
  ok("B5 the freshness strip in its live dress", filmedB.fscFresh === true);
  ok("B6 the Scan button at rest (enabled, its own name)", filmedB.fscScanDis === false && filmedB.fscScanLbl === "Scan", `lbl="${filmedB.fscScanLbl}" dis=${filmedB.fscScanDis}`);
  ok("B7 the film's face fully named", censusOk(filmedB), `unnamed=${filmedB.pageUnnamed} unCtrls=${filmedB.unCtrls}`);

  /* the second pick — the manual case needs a curve that CANNOT refresh
   * itself: a completed neighbour whose curve must survive the re-scan's
   * full-map drop and come back through the scan effect's own re-read */
  const pick = evalJson(tutPick);
  const picked2 = waitFor("the tutorial row picked", (m) => m.fscTutChecked === "true" && (m.resTut ?? "") !== "", 20);
  ok("B8 the second pick added (the completed tutorial)", pick.clicked === true && picked2.fscTutChecked === "true", `cap=${picked2.fscCap ?? "?"} legend=${picked2.fscLegend}`);
  ok("B9 both curves speaking (the row's own fetched-resolution spans)", (picked2.resProbe ?? "") !== "" && (picked2.resTut ?? "") !== "", `probe="${picked2.resProbe}" tut="${picked2.resTut}"`);

  /* ---------- face C: FILM — the re-scan while the poller is attached ---------- */
  console.log("Face C — FILM: the re-scan in the live world (the same-task catch)");
  const pre = evalJson(MEASURE);
  if (await corpse(pre, "C")) process.exit(1);
  if (pre.fscAutolive !== true) {
    ok("C-guard the band still attached at the film's start", false, `autolive=${pre.fscAutolive} — the window closed mid-walk; re-ride`);
  } else {
    ok("C-guard the band still attached at the film's start", true);
    const snap = evalJson(RESCAN_CATCH);
    const smp = Array.isArray(snap.samples) ? snap.samples : [];
    const anyScanning = smp.some((s) => s.dis === true && s.lbl === "Scanning…");
    const anyReading = smp.some((s) => s.reading === true);
    const bandAll = smp.length > 0 && smp.every((s) => s.band === true);
    const scanPath = anyScanning ? (smp[0].dis === true ? "same-task" : "in-eval beat") : "unseen";
    ok("C1 THE SCANNING DRESS — disabled + 'Scanning…'", snap.found === true && anyScanning, `path=${scanPath} before="${snap.before?.lbl}" (dis=${snap.before?.dis}) beats=[${smp.map((s) => `${s.lbl}${s.dis ? "!" : ""}`).join(", ")}]`);
    ok("C2 THE BAND STAYED while scanning (the strip's halves move together)", bandAll, `${smp.length} beats, the teal dress in every one`);
    ok("C3 THE CURVES DROPPED — 'Reading curves…' in the scan's window", snap.found === true && anyReading, `beats=[${smp.map((s) => (s.reading ? "reading" : "-")).join(", ")}]`);
    const rec = waitFor("the recovery", (m) => m.fscOpen === true && m.fscScanDis === false && m.fscScanLbl === "Scan", 25);
    ok("C4 the recovery — the button back at rest", rec.fscScanDis === false && rec.fscScanLbl === "Scan", `lbl="${rec.fscScanLbl}" dis=${rec.fscScanDis}`);
    const stillLive = rec.fscAutolive === true || (await probeDto())?.status === "completed";
    ok("C5 THE ATTACHMENT SURVIVED — the band still present (or the flip landed mid-recovery)", stillLive, rec.fscAutolive ? `text="${(rec.fscAutoliveText ?? "").slice(0, 60)}"` : "the poller's own flip arrived during the recovery");
    ok("C6 the probe's curve re-landed (the row's own span)", (rec.resProbe ?? "") !== "", `probe="${rec.resProbe}"`);
    ok("C7 the second pick's curve re-landed (the full-map drop's re-read)", (rec.resTut ?? "") !== "", `tut="${rec.resTut}"`);
    ok("C8 the selection survived the re-scan (the restore latch)", rec.fscProbeChecked === "true" && rec.fscTutChecked === "true", `probe=${rec.fscProbeChecked} tut=${rec.fscTutChecked}`);
    ok("C9 the re-scanned face fully named", censusOk(rec), `unnamed=${rec.pageUnnamed} unCtrls=${rec.unCtrls}`);

    /* ---------- face D: one poller cadence, no manual help ---------- */
    console.log("Face D — one poller cadence crossed under the film (no manual help)");
    zzz(14);
    const cad = evalJson(MEASURE);
    const dtoD = await probeDto();
    const heldOrFlipped = cad.fscOpen === true && ((cad.fscAutolive === true && dtoD?.status === "running") || (cad.fscAutolive === false && dtoD?.status === "completed"));
    ok("D1 the cadence crossed honestly (held while running / flipped on completion)", heldOrFlipped, cad.fscAutolive ? "the band held across one 12s cadence" : "the flip landed during the wait — the strip's own promise, filmed early");
  }
} else {
  ok("B-group the poller attached at the overlay", false, "two attempts missed the running window — the restage law won every race (the t876 discovery; re-ride)");
  /* the honest failure receipt: the conductor reads a missing receipt as
   * its own red — a written one says WHY it is red */
  const totalF = pass + fail;
  console.log(`\nRESCAN-LIVE-WORLD t877: ${pass}/${totalF} RED — the running window was never caught; the film is red by the world's own tempo`);
  writeFileSync(
    join(ROOT, "shots-qa", "t877-rescan-live-world.json"),
    JSON.stringify({ instrument: "scripts/t877-rescan-live-world.mjs", ruler: NAMEOF_LAW, build: world.id, worldMode: world.mode, date: new Date().toISOString(), chain: "A the live world seeded → B the overlay (the attempt loop exhausted) — the film never opened", verdict: "two attempts missed the running window (the restage law won every race); re-ride on a warm world", checks: results, passed: pass, failed: fail }, null, 2) + "\n"
  );
  process.exit(1);
}

/* ---------- face E: the live flip on the OPEN door + the quiet manual scan ---------- */
console.log("Face E — the live flip on the open door, then the quiet world's manual re-scan");
const dtoE0 = await probeDto();
ok("E0 the probe's API truth before the flip wait", !!dtoE0, `status=${dtoE0?.status ?? "absent"}`);
const done = dtoE0?.status === "completed" ? dtoE0 : await pollDto((d) => d?.status === "completed" || d?.status === "failed", 240, "the probe's completion", probeDto);
ok("E1 the probe completed", done?.status === "completed", `status=${done?.status}`);
const stillOpen = evalJson(MEASURE);
/* the flip's waitFor is UNCONDITIONAL (the t877 lesson: the completion's
 * own re-render can tear a mid-commit measure — a sample taken during the
 * churn saw no overlay at all; the wait rides through the churn and the
 * consistent post-churn world answers) */
const flipM = waitFor("the live flip on the open door", (m) => m.fscOpen === true && m.fscAutolive === false, 60);
ok("E2 THE LIVE FLIP — the band honestly absent on the SAME open door", flipM.fscOpen === true && flipM.fscAutolive === false, `door open=${flipM.fscOpen} (no interaction closed it; the pre-wait sample: open=${stillOpen.fscOpen} band=${stillOpen.fscAutolive})`);
/* the quiet dress may need one beat to speak (the poller's last index
 * commit, the strip's own re-render) — the walk waits, bounded, then
 * judges; the detail carries the strip's own words for the honest read */
const quietLine = waitFor("the quiet dress's indexed line", (m) => m.fscOpen === true && m.fscAutolive === false && /^\d+ curves? indexed$/.test(m.fscIndexLine ?? ""), 15);
ok("E3 the quiet dress speaks (the indexed count)", /^\d+ curves? indexed$/.test(quietLine.fscIndexLine ?? ""), `line="${quietLine.fscIndexLine}" fresh=${quietLine.fscFresh} quiet="${quietLine.fscQuietText ?? ""}" rows=${quietLine.fscRows} cap=${quietLine.fscCap ?? "?"}`);
ok("E4 the row's live dot gone (the row's own dress flipped)", quietLine.liveDots === 0, `liveDots=${quietLine.liveDots}`);
const idxLineBefore = quietLine.fscIndexLine;
const qSnap = evalJson(RESCAN_CATCH);
const qSmp = Array.isArray(qSnap.samples) ? qSnap.samples : [];
const qSeen = qSmp.some((s) => s.dis === true && s.lbl === "Scanning…");
ok("E5 THE QUIET SCAN'S DRESS — the button's other canonical half", qSnap.found === true && qSeen, `beats=[${qSmp.map((s) => `${s.lbl}${s.dis ? "!" : ""}`).join(", ")}]`);
ok("E6 the band stayed ABSENT through the quiet scan", qSmp.length > 0 && qSmp.every((s) => s.band === false), "the quiet dress did not flicker on in any beat");
/* the quiet recovery's own patience (the t879 ride's E7 red taught,
 * the O-face's dress-patience law in its second form): the button's
 * dress recovers BEFORE the row's fetched-resolution span re-lands —
 * the re-read's async completion is the recovery's slower half, and
 * thin memory stretches the beat (probe="" while the count already
 * spoke). The wait requires the button AND the res span; the judge
 * then reads the count-unchanged fact on a fully re-landed world. */
/* the 60s bound (the t881 ride's E7 red taught): a clean revival flushes
 * the dev compile cache — the row's curve fetch is the fsc route's FIRST
 * hit of the session and the cold compile rides the fetch (the t878 law:
 * the compile's tempo is the world's, not a selector lie). 25s read a
 * cold compile as a stall; 60s gives the world its own breath. */
const qRec = waitFor("the quiet recovery", (m) => m.fscOpen === true && m.fscScanDis === false && m.fscScanLbl === "Scan" && (m.resProbe ?? "") !== "", 60);
ok("E7 the quiet recovery — the count unchanged, the curves re-read", qRec.fscScanLbl === "Scan" && qRec.fscIndexLine === idxLineBefore && (qRec.resProbe ?? "") !== "", `line="${qRec.fscIndexLine}" (before "${idxLineBefore}") probe="${qRec.resProbe}"`);
ok("E8 the quiet face fully named", censusOk(qRec), `unnamed=${qRec.pageUnnamed} unCtrls=${qRec.unCtrls}`);

/* ---------- face W: the world back ---------- */
console.log("Face W — the world back");
/* the deafness window's counter (the t878 autopsy's law aboard): a
 * native capture listener on the content distinguishes "the event never
 * reached the content" (escCount=0) from "the handler ran but the close
 * did not land" (escCount>=1) — the micro-mechanism's last fork */
const wArm = evalJson('(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); if (!fsc) return JSON.stringify({ armed: false }); window.__w1esc = 0; fsc.addEventListener("keydown", () => { window.__w1esc = (window.__w1esc || 0) + 1; }, true); return JSON.stringify({ armed: true, activeEl: document.activeElement ? document.activeElement.tagName + (document.activeElement.getAttribute && document.activeElement.getAttribute("data-testid") ? ":" + document.activeElement.getAttribute("data-testid") : "") : "body" }); })()');
/* the synth-wrap (the fork's truly last instrument, t879): the native
 * counter proves the event REACHED the content; it cannot say whether
 * React's synthetic delegation ever INVOKED the content's own onKeyDown.
 * Wrap that handler in place (React reads __reactProps.onKeyDown at
 * dispatch time, so the wrapper sits exactly where delegation calls) and
 * count invocations — wrap never fires = the delegation is dead; wrap
 * fires and the dialog stays = the close call itself is swallowed. The
 * props object carries our mark so the read can tell a replaced wrap
 * (a re-render minted a fresh props object) from a surviving one. */
const wWrap = evalJson('(() => { const fsc = Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").includes("Compare FSC curves")); if (!fsc) return JSON.stringify({ wrapped: false, gone: true }); const pk = Object.keys(fsc).find((k) => k.startsWith("__reactProps")); if (!pk) return JSON.stringify({ wrapped: false, hasProps: false }); const cur = fsc[pk]; if (typeof cur.onKeyDown !== "function") return JSON.stringify({ wrapped: false, hasProps: true, ownKind: typeof cur.onKeyDown }); window.__w1synth = 0; const orig = cur.onKeyDown; cur.onKeyDown = function (e) { window.__w1synth = (window.__w1synth || 0) + 1; return orig.call(this, e); }; cur.__w1wrapped = true; return JSON.stringify({ wrapped: true }); })()');
const wFire = evalJson(escKey);
zzz(2);
const peeled = evalJson(MEASURE);
/* the LATE-LANDING trace (the t879 ride's fiber answer taught): the
 * first fiber read found the dialog GONE four seconds after the Escapes
 * — the close may land LATE rather than never. The trace samples the
 * FSC door every 0.5s for 6s; a mid-trace unmount is the landing beat
 * ("late, not never" — the find's new shape). The W1 contract stays
 * honest: the PROMPT measure above is what the check judges; the trace
 * rides the detail as the latency fact. */
const LATE_TRACE = '(() => { return (async () => { const fsc = () => Array.from(document.querySelectorAll("[role=dialog]")).find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); for (let i = 1; i <= 12; i++) { await new Promise((r) => setTimeout(r, 500)); if (!fsc()) return JSON.stringify({ landed: true, atMs: i * 500 }); } return JSON.stringify({ landed: false, stillOpen: !!fsc() }); })(); })()';
let late = null;
if (peeled.fscOpen !== false) {
  try { late = evalJson(LATE_TRACE); } catch { late = null; }
}
let peel2 = null;
if (peeled.fscOpen !== false && !(late && late.landed === true)) {
  /* the door already closed in the late trace — a second press now
   * would peel the INSPECTOR beneath (the layer below), an unforced
   * error the aftermath cannot afford. The recovery question is only
   * asked while the door is actually still open. */
  evalJson(escKey);
  zzz(2);
  peel2 = evalJson(MEASURE);
}
const wCount = evalJson('(() => JSON.stringify({ escCount: window.__w1esc ?? null, synth: window.__w1synth ?? null }))()');
/* the fiber probe (the fork's last arm): when the events REACH the content
 * but the close does not land, read the React tree's own truth — the
 * Dialog's open prop up the fiber and the synthetic onKeyDown's survival.
 * The t879 ride hardens the probe: a bounded retry (the eval is the
 * instrument and must not die on one transient hiccup), the FULL open
 * chain up the fiber (every boolean open with its hop — the state war's
 * shape, not just its first member), and the synth-wrap's verdicts. */
const FIBER_PROBE = '(() => { const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const fsc = dgs.find((d) => (d.textContent || "").includes("Compare FSC curves")); const counters = { esc: window.__w1esc ?? null, synth: window.__w1synth ?? null }; if (!fsc) return JSON.stringify({ gone: true, dlgCount: dgs.length, dlgHeads: dgs.map((d) => ((d.querySelector("[data-slot=dialog-title]") || {}).textContent || "").trim().slice(0, 40)), counters: counters, url: location.pathname }); const keys = Object.keys(fsc); const fiberKey = keys.find((k) => k.startsWith("__reactFiber")); let n = fiberKey ? fsc[fiberKey] : null, hops = 0, openProp = null, onKey = null; const openChain = []; while (n && hops < 60) { if (n.memoizedProps) { if (typeof n.memoizedProps.open === "boolean") { if (openProp === null) openProp = n.memoizedProps.open; openChain.push(n.memoizedProps.open); } if (n.memoizedProps.onKeyDown && onKey === null) onKey = true; } n = n.return; hops++; } const propsKey = keys.find((k) => k.startsWith("__reactProps")); const own = propsKey ? fsc[propsKey] : null; return JSON.stringify({ gone: false, openPropUp: openProp, openChain: openChain, hops: hops, ancestorOnKeyDown: !!onKey, ownOnKeyDown: own ? typeof own.onKeyDown : null, wrapSurvives: own ? !!own.__w1wrapped : null, synth: window.__w1synth ?? null, esc: window.__w1esc ?? null, dataState: fsc.getAttribute("data-state"), inDoc: document.contains(fsc) }); })()';
let wFiber = null;
if (peeled.fscOpen !== false || (peel2 && peel2.fscOpen !== false)) {
  for (let fi = 0; fi < 2 && !wFiber; fi++) {
    try { wFiber = evalJson(FIBER_PROBE); } catch { if (fi === 0) await zzz(2); }
  }
}
ok("W1 Escape peeled the overlay — the inspector survives", peeled.fscOpen === false && peeled.dlgHeads.some((h) => h.startsWith("3D Refine")), `dlgs=${peeled.dlgCount} heads=[${peeled.dlgHeads.join(" | ")}]${peel2 ? ` | the SECOND Escape: dlgs=${peel2.dlgCount} fscOpen=${peel2.fscOpen}` : ""} | the window's counter: esc=${wCount.escCount ?? "?"} synth=${wCount.synth ?? "?"} fire=${JSON.stringify(wFire)} wrap=${JSON.stringify(wWrap)}${late ? ` | the late trace: ${JSON.stringify(late)}` : ""}${wFiber ? ` | the fiber's truth: ${JSON.stringify(wFiber)}` : ""}`);
evalJson(closeInspector);
zzz(2);
/* the clean room's keys restored to absence (the t873 law: the seed
 * leaves the world as it found it) */
const restored = evalJson(cleanRoom);
let w1 = settle("the restored canvas", 16);
if (await corpse(w1, "W")) {
  console.log("    (blank tab — the user's own remedy: one honest reload)");
  ab("open http://localhost:3000");
  zzz(4);
  w1 = settle("the restored canvas, after the reload", 16);
}
ok("W2 every dialog closed", w1.dlgCount === 0, `dlgs=${w1.dlgCount}`);
/* the completion re-dressed the probe's card mid-film — the canvas's own
 * post-film truth may differ from the pre-run count while the card's
 * dress settles. The walk's W-law on a LIVE-seeded world: the canvas is
 * STABLE ACROSS ITS OWN RELOAD (the user's remedy), and the pre-run
 * delta is the world's own change, named. */
ab("open http://localhost:3000");
zzz(4);
const w2 = settle("the canvas, after the reload", 16);
/* the reload's own full-dress gate (the O-face's lesson, ride 12: the
 * settle caught the canvas at 101 buttons / 0 cards between the cards'
 * lazy-mount waves) — the world's truth is the CARD COUNT, wait for it */
for (let i = 0; i < 30 && w2.cards !== JOBS_N; i++) {
  zzz(1);
  const wm = evalJson(MEASURE);
  Object.assign(w2, wm);
}
ok("W3 the canvas re-loaded at the world's own truth", w2.cards === JOBS_N && w2.pageBtns >= 100, `post-film=${w1.pageBtns} (the SPA's stale dress) reloaded=${w2.pageBtns} cards=${w2.cards}/${JOBS_N} — the reload is the truth`);
ok("W3b the post-reload canvas fully named", censusOk(w2), `unnamed=${w2.pageUnnamed} unCtrls=${w2.unCtrls} altless=${w2.altless}`);
ok("W4 the clean room's keys restored to absence", restored.cleared >= 1, `cleared=${restored.cleared}`);
ok("W5 the census speaks the world's truth (all completed)", ((await jobsList()).filter((j) => j.projectId === PROJ && j.status === "completed")).length === JOBS_N, `${JOBS_N} completed — the re-run changed nothing in the count`);

/* ---------- the drift ledger (the walk family's four faces) ---------- */
const cmp = loadComparator(ROOT, "shots-qa/t877-rescan-live-world.json", world.id);
const liveProj = (m) => ({ pageBtns: m.pageBtns, pageUnnamed: m.pageUnnamed, unCtrls: m.unCtrls, altless: m.altless, fscOpen: m.fscOpen, fscCap: m.fscCap, fscRows: m.fscRows, fscFresh: m.fscFresh, fscAutolive: m.fscAutolive, fscIndexLine: m.fscIndexLine, fscChartSvg: m.fscChartSvg, fscScanDis: m.fscScanDis, fscScanLbl: m.fscScanLbl, fscLegend: m.fscLegend, fscLegendPressed: m.fscLegendPressed, fscTutChecked: m.fscTutChecked, fscProbeChecked: m.fscProbeChecked, resProbe: m.resProbe, resTut: m.resTut, liveDots: m.liveDots, fscQuietText: m.fscQuietText });
const prevFaces = cmp.prev?.driftLedger?.faces ?? cmp.prev?.faces ?? null;
const prevFaceOf = (name) => {
  const pf = prevFaces ? prevFaces[name] : null;
  const lv = pf ? pf.live : null;
  if (lv == null) return null;
  return typeof lv === "number" ? { pageBtns: lv } : lv;
};
const scalarOf = (m) => m.pageBtns;
const ledgerFaces = {
  canvasFace: ledgerFace(prevFaceOf("canvasFace"), m0, scalarOf),
  overlayLive: ledgerFace(prevFaceOf("overlayLive"), liveProj(filmedB), scalarOf),
  overlayQuiet: ledgerFace(prevFaceOf("overlayQuiet"), liveProj(qRec), scalarOf),
  worldBack: ledgerFace(prevFaceOf("worldBack"), w2, scalarOf),
};
console.log("Drift ledger — " + LEDGER_LAW);
for (const [name, face] of Object.entries(ledgerFaces)) {
  const v = armVerdict(cmp, world, face);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ================================================================== */
const total = pass + fail;
console.log(
  `\nRESCAN-LIVE-WORLD t877: ${pass}/${total} ${fail === 0 ? "green" : "RED"} — ` +
  `the freshness strip's manual half filmed in the world it exists for: ` +
  `the re-scan clicked while the poller was attached, the scanning dress + ` +
  `the curves drop + the band's steady teal caught in the click's own task, ` +
  `the recovery re-landing both curves, one poller cadence crossed without ` +
  `manual help, and the live flip landing on the door that never closed`
);

const verdict =
  fail === 0
    ? `the rescan button's live world is filmable standing capability: the t876 probe was re-issued through the product's own doors (run on the mock cluster, the running window caught, the first live checkpoint gated the doors), the overlay opened with the poller attached and a second (completed) pick aboard, and the re-scan was clicked in that live world — the same-task read filmed the scanning dress (disabled + "Scanning…"), the curves dropped ("Reading curves…") and the teal band holding steady in one synchronous breath; the recovery brought the button back, the band still attached, both curves re-landed (the probe's live one and the tutorial's completed one), the selection survived via the restore latch; one poller cadence crossed with no manual help; the completion flipped the band honestly absent on the door that never closed, and the quiet world's manual re-scan wore its own dress with the count unchanged; the world closed at 16 completed with the clean room's keys restored to absence`
    : `${fail} red — the strip's manual half moved; call the census's own instruments before any UI work`;

const receipt = {
  instrument: "scripts/t877-rescan-live-world.mjs",
  ruler: NAMEOF_LAW,
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "A the live world seeded → B the overlay opened with the poller attached (attempt loop) → C FILM the re-scan in the live world (same-task catch) → D one cadence, no manual help → E the live flip on the open door + the quiet manual scan → W the world back",
  doors: {
    probe: "the t876 probe re-issued via POST run with the mock cluster's remote body; the /fsc route's first shell is the door gate (the restage law)",
    film: "the probe's own FSC compare overlay, a second completed pick aboard, the header re-scan clicked while the poller was attached",
  },
  verdict,
  driftLedger: {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevBuild,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces: ledgerFaces,
  },
  checks: results,
  passed: pass,
  failed: fail,
};
const outPath = join(ROOT, "shots-qa", "t877-rescan-live-world.json");
writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(`receipt: ${outPath}${existsSync(outPath) ? "" : " (WRITE FAILED)"}`);
process.exit(fail === 0 ? 0 : 1);
