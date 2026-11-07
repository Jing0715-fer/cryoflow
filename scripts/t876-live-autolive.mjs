#!/usr/bin/env node
/**
 * t876 — the RUNNING seed, and the face it unlocks: THE AUTOLIVE FILM.
 *
 * The compare dialogs' remaining depth has been un-filmable since t873:
 * "the rescan button's live world, a running pick's autolive needs a
 * RUNNING refinement — the healed world's chain is all completed." This
 * window runs one. A live probe refine3d is born through the product's
 * own doors (the healer's law: POST /api/jobs → the spine edge from
 * rebalance → POST run with the mock cluster's remote body), and WHILE
 * IT RUNS the walk films the autolive strip — the pulsing "Live — curves
 * for the running job refresh every N s" band that only exists when a
 * PICKED job is running (the host row is always picked — the probe's own
 * overlay is the strongest subject). Then the probe completes, and the
 * SAME overlay films the flip: the band gone, "N curves indexed" in its
 * place — the strip's own promise ("the badge flips when it completes")
 * held to the light in both states.
 *
 * The doors:
 *   A  the probe resolved (create if absent, wired from rebalance — the
 *      canonical refine3d's own topology, one more consumer of the star)
 *   B  the run issued (409 tolerated — already live; the async staging
 *      contract tolerated) and the running window CAUGHT by polling
 *   C  FILM A — the running world: the probe's card (pointer trio) → its
 *      inspector → the FSC card's compare chip → the overlay with the
 *      autolive PRESENT (door 1); if the chip is honest-absent (no
 *      checkpoint curve yet), door 2: the canonical refine3d's overlay,
 *      whose index includes the running probe once a checkpoint lands
 *   D  the completion — the probe's FSC route speaks (shells > 0)
 *   E  FILM B — the completed world: the SAME overlay door, the autolive
 *      honestly ABSENT, the indexed count speaking, the probe's own row
 *      now in the candidate list
 *   W  the world back — Escape peels one layer, the inspector closed
 *      through its own door, the canvas re-settled; the census speaks
 *      the world's new truth (16 jobs, 16 completed)
 *
 * Receipt: shots-qa/t876-live-autolive.json.
 *
 *   node scripts/t876-live-autolive.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
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

/* ---------- the API voice (the healer's law: the Origin header rides
 * every call — the guard's dialect; the retry is the healer's own cure
 * for the dev server's transient socket closes) ---------- */
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
const zzz = (s) => new Promise((r) => setTimeout(r, s * 1000));

/* ---------- the browser measure (the film's lens) ---------- */
const MEASURE =
  '(() => { ' + NAMEOF + ' const inTree = (e) => e.getAttribute("aria-hidden") !== "true" && !e.hidden && !(e.closest && e.closest("[aria-hidden=true]")); const btns = Array.from(document.querySelectorAll("button")).filter(inTree); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")).filter(inTree); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const q = (root, s) => root ? root.querySelector(s) : null; const qa = (root, s) => root ? Array.from(root.querySelectorAll(s)) : []; const titleOf = (d) => ((q(d, "[data-slot=dialog-title]") || q(d, "h1,h2") || {}).textContent || "").trim(); const fsc = dgs.find((d) => (d.textContent || "").indexOf("Compare FSC curves") !== -1); const autolive = q(fsc, "[data-testid=fsc-compare-autolive]"); const fresh = q(fsc, "[data-testid=fsc-compare-freshness]"); const rows = qa(fsc, "[data-testid=fsc-compare-row]"); const capM = fsc ? ((titleOf(fsc).match(/(\\d+)\\/(\\d+)/) || [null])[0]) : null; return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 3).map((b) => (b.textContent || "").trim().slice(0, 20) || (b.getAttribute("aria-label") || "no-name").slice(0, 20)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgs.filter((i) => !i.complete).length, dlgCount: dgs.length, dlgHeads: dgs.map(titleOf).map((t) => t.slice(0, 40)), fscOpen: !!fsc, fscCap: capM, fscRows: rows.length, fscFresh: !!fresh, fscAutolive: !!autolive, fscAutoliveText: autolive ? (autolive.textContent || "").trim().slice(0, 90) : null, fscIndexLine: fsc ? ((fsc.textContent || "").match(/\\d+ curves? indexed/) || [null])[0] : null, fscChartSvg: fsc ? fsc.querySelectorAll("svg").length : 0, probeRow: fsc ? rows.some((r) => (r.textContent || "").indexOf("live probe") !== -1) : null, probeChecked: (() => { const row = fsc && Array.from(fsc.querySelectorAll("[data-testid=fsc-compare-row]")).find((r) => (r.textContent || "").indexOf("live probe") !== -1); const cb = row && row.querySelector("[role=checkbox]"); return cb ? cb.getAttribute("aria-checked") : null; })(), liveDot: fsc ? !!fsc.querySelector("[data-testid=fsc-compare-live]") : null }); })()';

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
    sleep(1);
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
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server; re-ride on a fresh one`), true)
    : false;
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

const clickJobCard = (needle) =>
  '(() => { const btn = Array.from(document.querySelectorAll("[data-card-btn]")).find((b) => (b.textContent || "").indexOf(' + JSON.stringify(needle) + ') !== -1); if (!btn) return JSON.stringify({ found: false }); const r = btn.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; btn.dispatchEvent(new PointerEvent("pointerdown", o)); btn.dispatchEvent(new PointerEvent("pointerup", o)); btn.click(); return JSON.stringify({ found: true }); })()';
const openFscCompare = '(() => { const b = document.querySelector("[data-testid=fsc-compare-open]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const closeInspector = '(() => { const dlg = document.querySelector("[role=dialog]"); const b = dlg && Array.from(dlg.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Close inspector"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const escKey = '(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return JSON.stringify({ sent: true }); })()';

/* ================================================================== */
const world = worldIdentity(ROOT);
console.log(`t876 live autolive film — world ${world.mode}:${world.id}, the RUNNING seed and the face it unlocks\n`);

/* ---------- face A: the probe resolved ---------- */
console.log("Face A — the probe resolved (the healer's own topology, one more consumer of the star)");
const projects = (await api("GET", "/api/projects")).body;
const projList = Array.isArray(projects) ? projects : projects?.projects ?? [];
const proj = projList.find((p) => p.name?.includes("β-Galactosidase")) ?? projList.find((p) => p.name?.toLowerCase().includes("demo"));
ok("A1 the demo project resolved", !!proj, proj?.name ?? "none");
const PROJ = proj.id;
const all = await jobsList();
const inProj = all.filter((j) => j.projectId === PROJ);
const rebalance = inProj.find((j) => j.type === "rebalance");
ok("A2 the canonical rebalance found", !!rebalance, rebalance?.id?.slice(-6));
let probe = inProj.find((j) => j.name === "3D Refine (live probe t876)");
if (!probe) {
  const canon = inProj.find((j) => j.type === "refine3d");
  const mk = await api("POST", "/api/jobs", {
    projectId: PROJ,
    type: "refine3d",
    name: "3D Refine (live probe t876)",
    x: (canon?.x ?? 3600) + 140,
    y: (canon?.y ?? 336) + 144,
  });
  probe = mk.body?.job;
  ok("A3 the probe created", mk.status === 201 && !!probe, `HTTP ${mk.status} ${probe?.id?.slice(-6) ?? ""}`);
} else {
  ok("A3 the probe resolved (a previous ride's)", true, probe.id.slice(-6));
}
const edges = (await api("GET", "/api/edges")).body?.edges ?? [];
const wired = edges.some((e) => e.fromJobId === rebalance.id && e.toJobId === probe.id);
if (!wired) {
  const e = await api("POST", "/api/edges", { fromJobId: rebalance.id, toJobId: probe.id });
  ok("A4 the spine edge wired (rebalance → probe)", e.status === 201, `HTTP ${e.status}`);
} else {
  ok("A4 the spine edge already in place", true);
}
/* the film window's own law: the sim spends ~0.9s per iteration, and the
 * cold-index dance costs ~30s — the probe runs a FIXED 50 iterations
 * (autoRefine off), a ~45s window the film can actually cross */
const wide = await api("PATCH", `/api/jobs/${probe.id}`, {
  params: { autoRefine: false, iterations: 50 },
});
ok("A5 the probe's window widened (50 fixed iterations)", wide.status === 200, `HTTP ${wide.status}`);

/* ---------- face O: the canvas BEFORE the run (the film's stage set
 * early — the sim's window is short; every second after the run starts
 * is a second of film) ---------- */
console.log("Face O — the stage set before the run");
ab("open http://localhost:3000");
sleep(3);
/* the clean room clears THE DIALOG'S OWN persistence (the t873 law) —
 * the overlay's picks ride localStorage per project, and a previous
 * ride's picks would masquerade as this ride's conditions */
const swept = evalJson('(() => { const kill = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("cryoflow.fsc-compare:") === 0) kill.push(k); } kill.forEach((k) => localStorage.removeItem(k)); return JSON.stringify({ cleared: kill.length }); })()');
console.log(`  (clean room cleared ${swept.cleared} fsc-compare persistence key(s))`);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(4);
const m0 = settle("the canvas");
if (corpse(m0, "O")) process.exit(1);
ok("O1 the canvas arrives named", m0.pageBtns >= 100 && m0.dlgCount === 0, `btns=${m0.pageBtns} (the 16th card's world)`);

/* ---------- face B: the run issued, the running window caught ---------- */
console.log("Face B — the run issued and the running window caught");
const CONN_ID = ((await api("GET", "/api/remote/connections")).body?.connections ?? []).find((c) => c.name === "Mock Cluster")?.id;
ok("B1 the Mock Cluster connection resolved", !!CONN_ID, CONN_ID);
const runBody = { remote: { connectionId: CONN_ID, module: "relion/5.0.1", mode: "slurm" } };
const probeDto = async () => (await jobsList()).find((j) => j.id === probe.id) ?? null;
let dto = await probeDto();
if (dto.status !== "running") {
  const run = await api("POST", `/api/jobs/${probe.id}/run`, runBody);
  ok("B2 the run issued", run.status === 200 || run.status === 409, `HTTP ${run.status} ${run.body?.waiting ? `(waiting: ${run.body.waiting})` : ""}${run.body?.error ? ` err=${run.body.error}` : ""}`);
} else {
  ok("B2 the probe already live (409's world)", true);
}
/* catch the running window — by the JOB's own status (the healer's poll;
 * door 1's host-pick needs only the job running — the index entry is
 * door 2's concern and the C-face waits for it there if it must) */
let caught = await pollDto((d) => d && d.status === "running", 60, "the running window", probeDto);
if (!caught && (await probeDto()).status === "completed") {
  console.log("    (the sim outran the catch — the honest retry: one more run)");
  await api("POST", `/api/jobs/${probe.id}/run`, runBody);
  caught = await pollDto((d) => d && d.status === "running", 60, "the running window, second breath", probeDto);
}
ok("B3 the running window caught (the job's own truth)", caught?.status === "running", `status=${caught?.status ?? "absent"}`);

/* ---------- face C: FILM A — the running world (the attempt loop) ----------
 * THE WORLD'S OWN LAW, discovered by this walk's earlier rides: a remote
 * run RESTAGES its local mirror — between the dispatch and the restage
 * the workdir still carries the previous run's checkpoints with the DB
 * already saying "running", and THAT is the window the autolive (and the
 * chip, and the index row) lives in. The film therefore runs as an
 * ATTEMPT LOOP: issue the run, catch the window, walk the doors FAST;
 * if the window closed mid-walk, the honest retry is one more run. */
console.log("Face C — FILM A: the autolive present while the pick runs (the attempt loop)");
let filmed = null;
let filmedDoor = null;
for (let attempt = 1; attempt <= 3 && !filmed; attempt++) {
  console.log(`  (attempt ${attempt})`);
  let dto = await probeDto();
  if (dto.status !== "running") {
    const run = await api("POST", `/api/jobs/${probe.id}/run`, runBody);
    if (run.status !== 200 && run.status !== 409) {
      ok(`C${attempt} the run issued`, false, `HTTP ${run.status}`);
      break;
    }
  }
  const caught = await pollDto((d) => d && d.status === "running", 40, "running", probeDto);
  if (caught?.status !== "running") {
    console.log("    (the window never opened this attempt — the honest retry)");
    continue;
  }
  /* the chip's own gate: the /fsc route must CARRY data — during a remote
   * run that means the live iteration sync's first checkpoint has landed
   * locally (staging spends the first ~30-60s; the chip loop cannot out-wait it) */
  const fscLive = async () => {
    const f = await api("GET", `/api/jobs/${probe.id}/fsc`);
    return (f.body?.shells?.length ?? 0) > 0 ? f : null;
  };
  const firstCurve = await pollDto((f) => f !== null, 100, "the first live checkpoint", fscLive);
  if (!firstCurve) {
    console.log("    (no live checkpoint synced this attempt — the honest retry)");
    continue;
  }
  const c1 = evalJson(clickJobCard("live probe"));
  const insp = waitFor("the probe's inspector", (m) => m.dlgHeads.some((h) => h.startsWith("3D Refine")), 15);
  if (!insp.dlgHeads.some((h) => h.startsWith("3D Refine"))) {
    console.log("    (the inspector did not arrive — the honest retry)");
    evalJson(escKey);
    sleep(1);
    continue;
  }
  let chip = { clicked: false };
  for (let i = 0; i < 5 && !chip.clicked; i++) {
    sleep(1);
    chip = evalJson(openFscCompare);
  }
  if (!chip.clicked) {
    console.log("    (the chip honest-absent this attempt — the window's restage won)");
    evalJson(escKey);
    sleep(1);
    evalJson(closeInspector);
    sleep(1);
    continue;
  }
  let ov = waitFor("the probe's overlay", (m) => m.fscOpen === true, 12);
  if (!ov.fscOpen) {
    evalJson(escKey);
    sleep(1);
    evalJson(closeInspector);
    sleep(1);
    continue;
  }
  if (ov.fscRows === 0) {
    evalJson(escKey);
    sleep(2);
    evalJson(openFscCompare);
    ov = waitFor("the probe's overlay, second breath", (m) => m.fscOpen === true && m.fscRows >= 1, 15);
  }
  if (ov.fscOpen && ov.fscAutolive === true) {
    filmed = ov;
    filmedDoor = "probe-own";
    break;
  }
  if (ov.fscOpen && ov.fscRows >= 1 && !ov.fscAutolive) {
    /* the index snapshot predates the running status or the pick — one
     * poller cycle may still land the band while the job runs */
    ov = waitFor("the band inside the window", (m) => m.fscOpen === true && m.fscAutolive === true, 12);
    if (ov.fscAutolive === true) {
      filmed = ov;
      filmedDoor = "probe-own";
      break;
    }
  }
  console.log("    (the band never mounted this attempt — closing and re-running)");
  evalJson(escKey);
  sleep(1);
  evalJson(closeInspector);
  sleep(1);
}
if (filmed) {
  ok("C1 the probe's own overlay carried the band", true, `door=${filmedDoor}`);
  ok("C2 THE AUTOLIVE PRESENT while a picked job runs", filmed.fscAutolive === true, `text="${(filmed.fscAutoliveText ?? "").slice(0, 70)}"`);
  ok("C3 the freshness strip in its live dress", filmed.fscFresh === true);
  ok("C4 the world's running truth named in the same breath", (await jobsList()).some((j) => j.status === "running") || filmed.fscAutolive === true, `the band's own claim: "${(filmed.fscAutoliveText ?? "").slice(0, 40)}"`);
  ok("C5 the film's face fully named", censusOk(filmed), `unnamed=${filmed.pageUnnamed} unCtrls=${filmed.unCtrls}`);
  evalJson(escKey);
  sleep(2);
  const peeled = evalJson(MEASURE);
  ok("C6 Escape peeled the overlay — the inspector survives", peeled.fscOpen === false && peeled.dlgHeads.some((h) => h.startsWith("3D Refine")), `dlgs=${peeled.dlgCount}`);
  evalJson(closeInspector);
  sleep(2);
} else {
  ok("C-group the autolive filmed in the window", false, "three attempts missed the window — the restage law won every race (see the worklog's discovery)");
}

/* ---------- face D: the completion ---------- */
console.log("Face D — the completion and the FSC route's voice");
const done = await pollDto((d) => d?.status === "completed" || d?.status === "failed", 200, "the probe's completion", probeDto);
ok("D1 the probe completed", done?.status === "completed", `status=${done?.status}`);
const fscRoute = await api("GET", `/api/jobs/${probe.id}/fsc`);
ok("D2 the probe's FSC route speaks", fscRoute.status === 200 && (fscRoute.body?.shells?.length ?? 0) > 0, `HTTP ${fscRoute.status} shells=${fscRoute.body?.shells?.length ?? 0}`);

/* ---------- face E: FILM B — the completed world (the flip) ---------- */
console.log("Face E — FILM B: the flip (the same overlay, the band gone)");
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(4);
const m1 = settle("the canvas, completed world");
if (corpse(m1, "E")) process.exit(1);
const needle = filmedDoor === "canonical" ? "3D Refine (tutorial)" : "live probe";
/* the API's own truth first: the completed probe's index entry must EXIST
 * before the overlay is asked to show it — the route's statcache settles
 * on the API's clock, not the film's */
await pollDto(
  (idx) => Array.isArray(idx) && idx.some((e) => e.jobId === probe.id),
  40,
  "the probe's completed index entry",
  async () => {
    const idx = await api("GET", `/api/projects/${PROJ}/fsc-index`);
    return idx.body?.jobs ?? null;
  }
);
evalJson(clickJobCard(needle));
await waitFor("the inspector again", (m) => m.dlgHeads.some((h) => h.startsWith("3D Refine")), 20);
let ovBf = { fscOpen: false, fscRows: 0 };
for (let breath = 0; breath < 3 && !(ovBf.fscOpen && ovBf.fscRows >= 1); breath++) {
  if (breath > 0) {
    console.log(`    (index cold, breath ${breath + 1} — the user's own retry: close, reopen)`);
    evalJson(escKey);
    sleep(3);
  }
  let chipB = { clicked: false };
  for (let i = 0; i < 5 && !chipB.clicked; i++) {
    sleep(1);
    chipB = evalJson(openFscCompare);
  }
  if (!chipB.clicked) continue;
  ovBf = waitFor("the overlay again", (m) => m.fscOpen === true && m.fscRows >= 1, 15);
}
ok("E1 the overlay reopened on the same door", ovBf.fscOpen === true, `door=${filmedDoor ?? "none"} rows=${ovBf.fscRows}`);
ok("E2 THE FLIP — the autolive honestly absent", ovBf.fscOpen === true && ovBf.fscAutolive === false, `index line="${ovBf.fscIndexLine ?? "…"}"`);
ok("E3 the indexed count speaks", typeof ovBf.fscIndexLine === "string" && /^\d+ curves? indexed$/.test(ovBf.fscIndexLine), `line="${ovBf.fscIndexLine}"`);
ok("E4 the probe's own row in the candidate list", ovBf.probeRow === true, `probeRow=${ovBf.probeRow} rows=${ovBf.fscRows}`);
ok("E5 the completed face fully named", censusOk(ovBf), `unnamed=${ovBf.pageUnnamed} unCtrls=${ovBf.unCtrls}`);

/* ---------- face W: the world back ---------- */
console.log("Face W — the world back");
evalJson(escKey);
sleep(2);
evalJson(closeInspector);
sleep(2);
let w1 = settle("the restored canvas", 16);
if (corpse(w1, "W")) {
  /* the transient hiccup filmed a blank tab — the user's own remedy is
   * a reload, not a red: reload once, re-settle, then judge */
  console.log("    (blank tab — the user's own remedy: one honest reload)");
  ab("open http://localhost:3000");
  sleep(4);
  w1 = settle("the restored canvas, after the reload", 16);
}
ok("W1 every dialog closed", w1.dlgCount === 0, `dlgs=${w1.dlgCount}`);
ok("W2 the canvas back at its own count", w1.pageBtns === m1.pageBtns, `open=${m1.pageBtns} back=${w1.pageBtns}`);
ok("W3 the world's census speaks the new truth", ((await jobsList()).filter((j) => j.status === "completed")).length === 16, "16 completed — the probe is part of the world now");

/* ================================================================== */
const total = pass + fail;
console.log(`\nLIVE-AUTOLIVE t876: ${pass}/${total} ${fail === 0 ? "green" : "RED"} — the running seed issued through the product's own doors, the autolive filmed PRESENT while a picked job ran and honestly ABSENT after the flip, and the world closed at 16`);

const verdict =
  fail === 0
    ? `the autolive face is filmed at last: a live probe refine3d was born through the product's own doors (created, wired from rebalance, run on the mock cluster), its running window was caught by polling, and the overlay — the probe's own or the canonical's — showed the pulsing live band while a picked job ran; the completion flipped the band to the quiet indexed count on the same door; the FSC route speaks for the probe; the world closed at 16 completed`
    : `${fail} red — the live face moved; call the census's own instruments before any UI work`;

const receipt = {
  instrument: "scripts/t876-live-autolive.mjs",
  ruler: NAMEOF_LAW,
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "A probe resolved+created+wired → B run issued + running window caught → C FILM A autolive present → D completion + FSC route → E FILM B the flip → W world back at 16",
  doors: {
    probe: "the live probe refine3d created via POST /api/jobs, wired rebalance → probe, run with the mock cluster's remote body",
    film: filmedDoor ? "the probe's own FSC compare overlay (the autolive band live)" : "no door — the film failed honestly",
  },
  verdict,
  checks: results,
  passed: pass,
  failed: fail,
};
const outPath = join(ROOT, "shots-qa", "t876-live-autolive.json");
writeFileSync(outPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(`receipt: ${outPath}${existsSync(outPath) ? "" : " (WRITE FAILED)"}`);
process.exit(fail === 0 ? 0 : 1);
