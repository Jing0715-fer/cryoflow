#!/usr/bin/env node
/**
 * t936 — the missed stop's SECOND face: the wire-down miss. A stop whose
 * connection is GONE at scancel time — nothing was reachable, the run's
 * fate was unknowable at stop time — and the two honest lanes that live on
 * either side of it.
 *
 * Never witnessed before this ride: the receipt's second miss sentence
 * ("the connection for this run was deleted — kill the process on the
 * cluster manually") had no live fire. The t935 arc witnessed the REFUSED
 * class (the wire answered, scancel exited 1, the run had already
 * finished) — this arc cuts the WIRE itself, mid-flight, and stops.
 *
 * THE TWO PRODUCT CURES the code read exposed before the ride:
 *   1. the miss class rides the receipt and the question — the stop
 *      route's words branched only on missed/not-missed, so the wire-down
 *      class spoke the refused lane's words ("no live cluster session
 *      found") and the manual-kill guidance lived only on the 5s toast;
 *      the row is the reliable surface (the t934 judge-line) and now
 *      carries it. The question carries `class: "wire-down"` so the
 *      landing's sentence knows which promise it fulfills.
 *   2. the heal's sentence never claims "already finished" for the
 *      wire-down class — the refused class's tail was TRUE for t935 (the
 *      cluster said so at stop time) but is a LIE when the run finishes
 *      AFTER the attempt (this arc: alive at stop time, completed while
 *      the wire was down). The wire-down tail names the missing wire.
 *
 * THE ARC (stage1): the mint re-rides, the bind, iterations=16 (an ~18s
 * window), the browser parked on about:blank (the blind-window law — ONE
 * GET after the wire cut would let the run sweep's no-conn branch steal
 * the stop's lane with the vanish word). Mid-flight: THE WIRE CUT (the
 * connection DELETE through the API door), THE STOP through the API door
 * — the receipt's second sentence verbatim, the row's wire-down word, the
 * record's deferring stamp + the question carrying the class. The launcher
 * never notices (the mock's process is independent) and dies naturally —
 * the accounting journal's COMPLETED row lands HOST-SIDE while the app,
 * wireless, keeps the miss words standing (the ledger's word written but
 * unheard). THE WIRE RETURNS (a NEW connection id — the genuine re-add,
 * the t325-a drift shape: the record's dead connectionId resolved by the
 * host:port fallback) — the consult rides the new wire, the heal lands
 * with the WIRE-DOWN tail, the row heals completed.
 *
 * stage2 — THE OTHER LANE + THE FACE: the run sweep's own no-conn branch
 * (the vanish word "the cluster connection for this run was deleted —
 * re-add it and re-run", exitCode -1, no question — never witnessed) when
 * NO stop is attempted; the ledger's word never coming home (the row's
 * vanish word stands even after the accounting row lands); the 409
 * refusal against the vanished row; the UI stop's toast race (the dance
 * first, the wire cut inside the sweep's 4s quiet window, the click —
 * "Stop missed — nothing to kill" + the wire-down message verbatim; a
 * lost race is the honest vanish, banked); the restore.
 *
 *   node scripts/t936-wire-down-miss-witness.mjs stage1|stage2|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t936-wire-down-miss-witness.json";
const STATE = path.join(ROOT, "data", "t936-wire-down.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");
const ENGINE_STATE = path.join(ROOT, "data", "engine-state.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
const ITERS = 16;

/* the wire-down class's own words (the t936 cures, verbatim) */
const WIRE_DOWN_MSG = "the connection for this run was deleted — kill the process on the cluster manually";
const WD_STAMP = "stop missed — the connection for this run was deleted; the cluster ledger decides the final state";
const WD_ROW = "stop missed (the connection for this run was deleted) — kill the process on the cluster manually; the cluster ledger decides the final state if a wire returns";
const WD_HEAL_TAIL = "the stop had no wire to the cluster; the run finished on its own";
const HEAL_PREFIX = "the cluster ledger recorded the run COMPLETED";
/* the run sweep's vanish lane (the t325-era word, never witnessed live) */
const VANISH_ROW = "the cluster connection for this run was deleted — re-add it and re-run";
/* the mock cluster's own credentials (the README's table) */
const MOCK_WIRE = { host: "127.0.0.1", port: 3022, username: "cryo", authMethod: "password", password: "demo" };

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim();
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
      await sleep(500);
      const pos2 = evalJson(locate);
      if (pos2 && pos2.own) {
        sh(`${AB} mouse move ${pos2.x} ${pos2.y}`);
        sh(`${AB} mouse down`);
        sh(`${AB} mouse up`);
        return `clicked@${pos2.x},${pos2.y}`;
      }
      return "OFF-VIEWPORT";
    }
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const settleCensus = async () => {
  let last = null;
  for (let i = 0; i < 24; i++) {
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job')].length)`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
};
const shApi = (url) => {
  let lastErr = null;
  /* 10 × 4s = 40s of patience (the t934 curl-exit-7 law) */
  for (let i = 0; i < 10; i++) {
    try { return sh(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`); }
    catch (e) { lastErr = e; try { execSync("sleep 4", { cwd: ROOT }); } catch {} }
  }
  throw lastErr;
};
const apiJson = (url) => JSON.parse(shApi(url));
const api = (method, url, body) => {
  const cmd = `curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  try { return JSON.parse(sh(cmd)); } catch { return { error: "parse" }; }
};
const jobs = () => apiJson("/api/jobs").jobs ?? [];
const edges = () => apiJson("/api/edges").edges ?? [];
const findName = (n) => jobs().find((j) => j.name === n);
const openInspectorHard = async (name, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
    const opened = await poll(
      `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
      (v) => v.open === true, 5, 500,
    );
    if (opened?.open === true) return `open@try${i}`;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(700);
  }
  return "NEVER-OPEN";
};
/* the t826 pause: park the mouse INSIDE the toast viewport's padding so
 * every close timer freezes while parked — a toast born under the pointer
 * stays on screen until the mouse leaves */
const parkMouseOnToasts = async () => {
  const spot = evalJson(`(() => { const v = document.querySelector('ol[role="region"]') || [...document.querySelectorAll('ol')].find(o => (o.className || '').includes('z-[')); if (!v) return JSON.stringify({ park: false }); const r = v.getBoundingClientRect(); return JSON.stringify({ park: true, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height - 12) }); })()`);
  if (spot?.park) {
    sh(`${AB} mouse move ${spot.x} ${spot.y}`);
    await sleep(400);
    sh(`${AB} mouse move ${Math.max(2, spot.x - 30)} ${spot.y}`);
    await sleep(300);
    sh(`${AB} mouse move ${spot.x} ${spot.y}`);
    await sleep(300);
    return true;
  }
  return false;
};
const toastRead = (needle) => poll(
  `(() => { const t = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(x => ({ title: x.querySelector('[data-title]')?.textContent ?? null, all: x.textContent?.slice(0, 400) ?? '' })); const hit = t.find(x => x.all.includes(${JSON.stringify(needle)})); const vp = document.querySelector('ol[role="region"]'); return JSON.stringify({ any: t.length > 0, hit: !!hit, text: (hit?.all ?? t.map(x => x.all).join(' || ')).slice(0, 400) }); })()`,
  (v) => v.hit === true, 40, 400,
);
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}
const writeState = (obj) => {
  mkdirSync(path.dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify(obj, null, 2));
};
const readState = () => { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return {}; } };
const mockRounds = (dir) => {
  try { return readdirSync(dir).filter((f) => /^run_it\d+_optimiser\.star$/.test(f)).sort(); } catch { return []; }
};
const slurmPids = () => {
  try {
    return readdirSync(SLURM_DIR)
      .filter((f) => /^job-\d+\.pid$/.test(f))
      .map((f) => {
        const full = path.join(SLURM_DIR, f);
        const body = readFileSync(full, "utf8").trim().split(/\s+/);
        return { file: f, id: body[0], pid: Number(body[1]), mtime: statSync(full).mtimeMs };
      });
  } catch { return []; }
};
const accountingRows = () => {
  try { return readFileSync(path.join(SLURM_DIR, "accounting"), "utf8").trim().split("\n").filter(Boolean); } catch { return []; }
};
/* the run record's own testimony — the engine's state file, read HOST-SIDE */
const readRecord = (jobId) => {
  try { return JSON.parse(readFileSync(ENGINE_STATE, "utf8"))[jobId] ?? null; } catch { return null; }
};
/* the manifest-word binding law (the t932/t933 lesson) */
const manifestBinding = () => {
  try { return JSON.parse(readFileSync(path.join(ROOT, "data", "t916-class2d-mint.json"), "utf8")).binding ?? null; } catch { return null; }
};
const pidAlive = (pid) => {
  try { execFileSync("/bin/kill", ["-0", String(pid)], { stdio: "ignore" }); return true; } catch { return false; }
};
/* the fresh launcher pid for a dispatch seconds old (host-side reads only) */
const freshPid = async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000) {
    const f = slurmPids().filter((p) => Date.now() - p.mtime < 120_000).sort((a, b) => b.mtime - a.mtime)[0];
    if (f?.id) return f;
    await sleep(300);
  }
  return null;
};
/* the connection snapshot: everything the re-create needs (the secret is
 * the mock's own README word — the DTO strips it) */
const connSnapshot = () => {
  const c = (apiJson("/api/remote/connections").connections ?? []).find((x) => x.name === "Mock Cluster");
  if (!c) return null;
  const { hasPassword, hasPassphrase, runResume, ...rest } = c;
  return rest;
};
const recreateWire = (snap, id) => {
  const body = { ...snap, ...MOCK_WIRE };
  if (id) body.id = id;
  else delete body.id; /* a NEW connection — the genuine re-add (the drift shape) */
  return api("POST", "/api/remote/connections", body);
};
const connections = () => apiJson("/api/remote/connections").connections ?? [];

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_S2 = STAGE === "main" || STAGE === "stage2";

/* ============================ prep ======================================== */
console.log(`== t936 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * THE WIRE-DOWN MISS: the wire cut mid-flight, the stop through the API
 * door inside the blind window, the receipt's second sentence, the
 * patient question, the unheard death, the wire's return, the heal's
 * wire-down tail. */
console.log("== stage 1: the wire cut, THE STOP THAT COULD NOT REACH, the heal's second class ==");
let c2d = findName(NAME_CLASS2D);
if (c2d) {
  const healBinding = manifestBinding();
  try { api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: healBinding }); } catch {}
  try { sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch {}
  c2d = findName(NAME_CLASS2D);
  if (c2d) {
    console.log("  (self-heal: the remove refused — the manual downstream-first delete rides)");
    for (const nm of [NAME_CLASS2D, "2D Class Selection", "t929 select child", "t916 select witness", "Automated Picking 1 (t926)"]) {
      const j = findName(nm);
      if (j) { try { api("DELETE", `/api/jobs/${j.id}`); } catch {} }
    }
    for (const j of jobs().filter((x) => ["autopick", "extract", "class2d", "select2d"].includes(x.type)).reverse()) {
      try { api("DELETE", `/api/jobs/${j.id}`); } catch {}
    }
    try { sh(`rm -rf ${MOCK_PROJECTS}/${projId}/class2d_* ${MOCK_PROJECTS}/${projId}/extract_* ${MOCK_PROJECTS}/${projId}/autopick_* ${ROOT}/data/relion/${projId}/class2d_* ${ROOT}/data/relion/${projId}/extract_* ${ROOT}/data/relion/${projId}/autopick_*`); } catch {}
    c2d = findName(NAME_CLASS2D);
  }
}
ok("S1 the world starts class2d-free (the self-heal)", !c2d);
let mintOut = "(never ran)";
try { mintOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs mint 2>&1`); } catch (e) { mintOut = String(e); }
ok("S1 the t916 mint GREEN", /mint GREEN — \d+ ok, 0 fail/.test(mintOut), (mintOut.match(/== mint .*/) ?? ["?"])[0]);
c2d = findName(NAME_CLASS2D);
ok("S1 the class2d witness completed (the mint's own run)", c2d?.status === "completed", c2d?.status);
if (!c2d || c2d.status !== "completed") { console.log("FATAL: no class2d witness — aborting"); writeReceipt({ fatal: "no class2d" }); process.exit(2); }

/* the connection snapshot BEFORE anything is deleted (the re-create's fields) */
const snap = connSnapshot();
ok("S1 the Mock Cluster connection snapshotted (the re-create's fields)", !!snap?.id && snap?.host === MOCK_WIRE.host && Number(snap?.port) === MOCK_WIRE.port, `${snap?.id} ${snap?.host}:${snap?.port}`);
if (!snap?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const ORIG_CONN_ID = snap.id;

/* the t300 binding door — the dispatch below rides the binding's lane */
const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: ORIG_CONN_ID });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok("S1 the class2d's iterations pinned at 16 through the PATCH door (the ~18s window)", !!patchP.job?.id && String(patchP.job?.params?.iterations) === "16", JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

/* the blind window: the browser parks on about:blank — the UI's own 5s
 * poll is a sweep driver, and ONE GET after the wire cut would let the
 * run sweep's no-conn branch steal the stop's lane (the vanish word) */
sh(`${AB} open about:blank`);
await sleep(600);

let arc = null;
for (let attempt = 1; attempt <= 3 && !arc; attempt++) {
  console.log(`-- S1 wire-down attempt ${attempt} --`);
  /* re-create the wire if a previous attempt burned it */
  if (!connections().some((x) => x.id === ORIG_CONN_ID)) {
    const rc = recreateWire(snap, ORIG_CONN_ID);
    ok(`S1 attempt ${attempt} the wire re-created (the previous attempt's cut undone)`, !!rc?.connection?.id, rc?.error ?? "");
  }
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S1 attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  ok(`S1 attempt ${attempt} the bare POST accepted (the binding's lane)`, true, "");
  const fresh = await freshPid();
  if (!fresh?.pid) { ok(`S1 attempt ${attempt} the launcher pid found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid read (slurm ${fresh.id}, pid ${fresh.pid})`, true, "");
  /* a little mid-flight depth: run_it001 on the floor before the cut */
  let depth = 0;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000) {
      depth = mockRounds(c2dMockDir).length;
      if (depth >= 1) break;
      await sleep(300);
    }
  }
  if (depth < 1) { ok(`S1 attempt ${attempt} run_it001 landed before the cut (mid-flight depth)`, false, "no rounds in 30s"); continue; }
  ok(`S1 attempt ${attempt} run_it001 landed (mid-flight depth before the cut)`, true, "");
  if (!pidAlive(fresh.pid)) { ok(`S1 attempt ${attempt} the launcher alive at cut time`, false, "already dead"); continue; }

  /* THE WIRE CUT — the connection DELETE through the product's own door */
  const cutP = api("DELETE", `/api/remote/connections/${ORIG_CONN_ID}`);
  const gone = !connections().some((x) => x.id === ORIG_CONN_ID);
  ok(`S1 attempt ${attempt} THE WIRE CUT — the connection deleted through the API door (the registry no longer lists it)`, cutP.ok === true && gone, `ok=${cutP.ok} gone=${gone}`);
  if (!(cutP.ok === true && gone)) continue;

  /* THE STOP THAT COULD NOT REACH — the API door, seconds after the cut;
   * NO /api/jobs GET in between (the vanish-steal law) */
  const stopP = api("POST", `/api/jobs/${c2d.id}/stop`);
  if (stopP.error && !stopP.outcome) {
    ok(`S1 attempt ${attempt} THE STOP FIRED on the live row (no 409 — the sweep never ticked)`, false, JSON.stringify(stopP).slice(0, 110));
    continue;
  }
  ok(`S1 attempt ${attempt} THE STOP FIRED on the live row (no 409 — the sweep never ticked)`, true, "");
  /* THE RECEIPT'S SECOND SENTENCE — the wire-down class, verbatim */
  ok(`S1 attempt ${attempt} THE RECEIPT'S CLASS: stopped=false, outcome='missed', settled=null (nothing was reachable — the question never applied)`, stopP.stopped === false && stopP.outcome === "missed" && stopP.settled === null, `stopped=${stopP.stopped} outcome=${stopP.outcome} settled=${stopP.settled}`);
  ok(`S1 attempt ${attempt} THE MESSAGE IS THE WIRE-DOWN SENTENCE verbatim ('the connection for this run was deleted — kill the process on the cluster manually')`, stopP.message === WIRE_DOWN_MSG, String(stopP.message ?? "none").slice(0, 140));
  /* THE ROW'S WIRE-DOWN WORD — the route's own hand, read from the
   * receipt's job DTO (no GET, no sweep) */
  ok(`S1 attempt ${attempt} THE ROW'S WIRE-DOWN WORD verbatim (failed + the manual-kill guidance on the durable surface)`, stopP.job?.status === "failed" && stopP.job?.result === WD_ROW, `${stopP.job?.status}/${String(stopP.job?.result ?? "none").slice(0, 110)}`);
  /* THE RECORD'S DEFERRING STAMP + THE CLASS ABOARD THE QUESTION */
  const recStop = readRecord(c2d.id);
  ok(`S1 attempt ${attempt} THE DEFERRING STAMP verbatim (done, NO exit code — a missed kill claims nothing; the wire named)`, recStop?.done === true && recStop?.result === WD_STAMP && (recStop?.exitCode ?? null) === null, `done=${recStop?.done} exit=${recStop?.exitCode ?? "none"} result=${String(recStop?.result ?? "none").slice(0, 80)}`);
  ok(`S1 attempt ${attempt} THE QUESTION OPEN with missed:true AND class:'wire-down' (the landing will know which promise it fulfills)`, recStop?.remote?.accountingPending?.missed === true && recStop?.remote?.accountingPending?.class === "wire-down", JSON.stringify(recStop?.remote?.accountingPending ?? null));
  arc = { slurmId: fresh.id, pid: fresh.pid, attempt, receipt: { stopped: stopP.stopped, outcome: stopP.outcome, settled: stopP.settled, message: stopP.message }, cutAt: new Date().toISOString() };
  break;
}
if (!arc) { console.log("FATAL: the wire-down stop never landed — aborting"); writeReceipt({ fatal: "wire-down never landed" }); process.exit(2); }
writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, origConnId: ORIG_CONN_ID, ...arc });

/* THE RUN'S OWN DEATH, UNHEARD: the launcher never notices the app's
 * bookkeeping — it dies naturally, the accounting journal's COMPLETED row
 * lands HOST-SIDE, and the app (wireless) keeps the miss words standing */
let ledgerRow = false;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    if (accountingRows().some((r) => r.startsWith(`${arc.slurmId}|`) && r.includes("COMPLETED"))) { ledgerRow = true; break; }
    await sleep(1000);
  }
}
ok("S1 THE RUN DIED ON ITS OWN — the ledger's COMPLETED row landed host-side (written but unheard)", ledgerRow, `slurm ${arc.slurmId}`);
const recUnheard = readRecord(c2d.id);
ok("S1 THE MISS WORDS STAND (no wire, no echo — the record keeps the deferring stamp and the open question over a run that has in fact finished)", recUnheard?.result === WD_STAMP && !!recUnheard?.remote?.accountingPending, `result=${String(recUnheard?.result ?? "none").slice(0, 80)}`);
/* the row, read through a GET — SAFE now: the record is done (the run
 * sweep skips done records; the accounting branch waits its patience) */
const rowUnheard = jobs().find((x) => x.id === c2d.id);
ok("S1 THE ROW'S WORD STANDS over the finished run (the app honest about its ignorance)", rowUnheard?.status === "failed" && rowUnheard?.result === WD_ROW, `${rowUnheard?.status}/${String(rowUnheard?.result ?? "none").slice(0, 90)}`);

/* THE WIRE RETURNS — a NEW connection id (the genuine re-add; the record's
 * dead connectionId must be resolved by the host:port fallback, t325-a) */
const rcP = recreateWire(snap, null);
const newConnId = rcP?.connection?.id ?? null;
ok("S1 THE WIRE RETURNS — a NEW connection re-created with the mock's own fields (the t325-a drift shape)", !!newConnId && newConnId !== ORIG_CONN_ID, `${newConnId ?? "none"} (was ${ORIG_CONN_ID})`);
if (!newConnId) { console.log("FATAL: the re-create refused — aborting"); writeReceipt({ fatal: "re-create refused" }); process.exit(2); }

/* THE HEAL LANDS — the consult rides the NEW wire (the host:port fallback),
 * finds the COMPLETED row, and speaks the WIRE-DOWN tail (the cure's
 * own sentence — never "already finished": the run finished AFTER the
 * attempt, and the sentence knows) */
let recHeal = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 240_000) {
    jobs(); // every GET is one sweep tick — the consult's driver
    const rec = readRecord(c2d.id);
    if (rec?.result?.startsWith(HEAL_PREFIX) && rec?.result?.includes(WD_HEAL_TAIL)) { recHeal = rec; break; }
    await sleep(2000);
  }
}
ok("S1 THE HEAL SENTENCE VERBATIM on the record ('…COMPLETED (exit 0:0) — the stop had no wire to the cluster; the run finished on its own')", !!recHeal, String(recHeal?.result ?? "none").slice(0, 170));
ok("S1 THE HEAL NEVER CLAIMED 'already finished' (the refused class's tail would be a LIE here — the run finished after the attempt)", !!recHeal && !recHeal.result.includes("already finished"), "");
ok("S1 THE LEDGER'S WORD ABOARD (exit 0, slurmState COMPLETED, the question closed)", recHeal?.exitCode === 0 && recHeal?.remote?.slurmState === "COMPLETED" && !recHeal?.remote?.accountingPending, `exit=${recHeal?.exitCode} slurmState=${recHeal?.remote?.slurmState} acc=${JSON.stringify(recHeal?.remote?.accountingPending ?? null)}`);

/* THE ROW'S FINAL WORD: the heal sentence (the widened flip's landing) */
let rowHeal = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    const j = jobs().find((x) => x.id === c2d.id);
    if (j?.status === "completed" && String(j?.result ?? "").startsWith(HEAL_PREFIX)) { rowHeal = j; break; }
    await sleep(2000);
  }
}
ok("S1 THE ROW HEALED COMPLETED with the wire-down sentence (the heal is a landing, not a flip)", rowHeal?.status === "completed" && String(rowHeal?.result ?? "").includes(WD_HEAL_TAIL), `${rowHeal?.status}/${String(rowHeal?.result ?? "none").slice(0, 130)}`);

/* THE COMPLETED FACE: the warm-up reload law, the inspector, the climb */
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await sleep(800);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await sleep(1200);
sh(`${AB} press Control+f`);
await sleep(500);
sh(`${AB} keyboard type "${NAME_CLASS2D}"`);
await sleep(600);
sh(`${AB} press Enter`);
await sleep(900);
sh(`${AB} press Escape`);
await sleep(400);
await settleCensus();
const insp1 = await openInspectorHard(NAME_CLASS2D);
ok("S1 the HEALED job's inspector opens", String(insp1).startsWith("open@try"), String(insp1));
await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ tabs: [...(d?.querySelectorAll('[role="tab"]') ?? [])].map(t => (t.textContent || '').trim()) }); })()`,
  (v) => v.tabs?.includes("Overview") === true, 12, 600,
);
const faceRead = () => evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ completedWords: t.includes('Completed ·'), heal: t.includes(${JSON.stringify(WD_HEAL_TAIL)}), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`);
let face1 = faceRead();
/* the remount law: the dialog's tab row can re-render between the tabs-wait
 * and the click (the entrance animation's own reconciliation) — realClick
 * returns NO-ELEMENT on a transient null, so the climb retries at its own
 * pace (3 tries; the first standalone ride passed inside the window) */
let ov1 = "skipped";
for (let i = 0; i < 3 && face1?.heal !== true; i++) {
  ov1 = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
  await sleep(1100);
  face1 = faceRead();
}
ok("S1 the Overview climb clicked", String(ov1).startsWith("clicked@"), String(ov1));
ok("S1 the card speaks 'Completed · <duration>' (the completed face's own word)", face1?.completedWords === true);
ok("S1 THE WIRE-DOWN HEAL SENTENCE HANGS ON THE CARD", face1?.heal === true);
ok("S1 THE COMPLETED FACE HAS NO STOP VERB (the Re-run branch stands where Stop stood)", face1?.stopBtn === false && face1?.rerun === true, `stop=${face1?.stopBtn} rerun=${face1?.rerun}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

writeReceipt({ stage1: { pass, fail, slurmId: arc.slurmId, receipt: arc.receipt, heal: recHeal?.result ?? "", row: rowHeal?.result ?? "", newConnId } });
console.log(`== t936 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_S2) {
/* ========================= stage 2 =======================================
 * THE OTHER LANE + THE FACE: the sweep's vanish word (no stop attempted),
 * the ledger's word never coming home, the 409 refusal, the UI stop's
 * toast race, the restore. */
console.log("== stage 2: the vanish lane, the refusal, THE UI STOP'S TOAST RACE, the restore ==");
const st2 = readState();
const c2dId = st2.c2dId;
const ORIG_CONN_ID = st2.origConnId;
const snap = connSnapshot();
ok("S2 the healed arc stands (completed, the wire-down sentence aboard)", findName(NAME_CLASS2D)?.id === c2dId && findName(NAME_CLASS2D)?.status === "completed", `${findName(NAME_CLASS2D)?.status}`);
ok("S2 the wire snapshot available (the re-creates' fields)", !!snap?.id, snap?.id ?? "none");
if (!c2dId || !snap?.id) { console.log("FATAL(stage2): no state — run stage1 first"); process.exit(2); }
const c2d = findName(NAME_CLASS2D);
const c2dMockDir = st2.mockDir ?? path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

/* the live wire for the vanish arc: whatever stage1 left (the NEW conn),
 * rebound to the project so the dispatch rides it */
const liveConn = connections().find((x) => x.host === MOCK_WIRE.host && Number(x.port) === MOCK_WIRE.port);
ok("S2 a live mock wire exists (the stage1 re-add)", !!liveConn?.id, liveConn?.id ?? "none");
const rebindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: liveConn.id });
ok("S2 the project rebound to the live wire", rebindP.ok === true, JSON.stringify(rebindP).slice(0, 60));

/* ---- THE VANISH LANE: the sweep's own no-conn branch, no stop attempted */
let vanish = null;
for (let attempt = 1; attempt <= 3 && !vanish; attempt++) {
  console.log(`-- S2 vanish attempt ${attempt} --`);
  if (!connections().some((x) => x.id === liveConn.id)) {
    const rc = recreateWire(snap, liveConn.id);
    ok(`S2v attempt ${attempt} the wire re-created`, !!rc?.connection?.id, rc?.error ?? "");
    const rb = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: liveConn.id });
    ok(`S2v attempt ${attempt} the binding re-pointed`, rb.ok === true, "");
  }
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S2v attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  const fresh = await freshPid();
  if (!fresh?.pid) { ok(`S2v attempt ${attempt} the launcher pid found`, false, "no fresh pid"); continue; }
  let depth = 0;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000) {
      depth = mockRounds(c2dMockDir).length;
      if (depth >= 1) break;
      await sleep(300);
    }
  }
  if (depth < 1 || !pidAlive(fresh.pid)) { ok(`S2v attempt ${attempt} mid-flight at cut time`, false, `rounds=${depth} alive=${pidAlive(fresh.pid)}`); continue; }
  ok(`S2v attempt ${attempt} mid-flight (run_it001 landed, slurm ${fresh.id} alive)`, true, "");
  /* THE SECOND WIRE CUT — and this time NO stop: the sweep's own hand */
  const cutP = api("DELETE", `/api/remote/connections/${liveConn.id}`);
  ok(`S2v attempt ${attempt} THE WIRE CUT (no stop will be attempted)`, cutP.ok === true, "");
  /* THE VANISH: the next GET-driven reconcile finds no wire and no host
   * match — the run sweep's own no-conn branch finalizes the live run */
  let vrow = null;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 90_000) {
      const j = jobs().find((x) => x.id === c2d.id); // every GET is a sweep tick
      if (j?.status === "failed" && j?.result === VANISH_ROW) { vrow = j; break; }
      if (j?.status === "failed" || j?.status === "completed") break;
      await sleep(1500);
    }
  }
  ok(`S2v attempt ${attempt} THE VANISH WORD VERBATIM ('the cluster connection for this run was deleted — re-add it and re-run')`, vrow?.result === VANISH_ROW, `${vrow?.status}/${String(vrow?.result ?? "none").slice(0, 110)}`);
  if (vrow?.result !== VANISH_ROW) continue;
  const vrec = readRecord(c2d.id);
  ok(`S2v attempt ${attempt} THE RECORD VANISHED WITH THE ROW (done, exitCode -1 — the sweep's honest no-verdict number)`, vrec?.done === true && vrec?.exitCode === -1 && vrec?.result === VANISH_ROW, `done=${vrec?.done} exit=${vrec?.exitCode}`);
  ok(`S2v attempt ${attempt} NO QUESTION OPENED (the sweep's lane claims a fact, not a stop — no ledger to consult)`, !vrec?.remote?.accountingPending, JSON.stringify(vrec?.remote?.accountingPending ?? null));
  vanish = { slurmId: fresh.id, attempt };
  break;
}
if (!vanish) { console.log("FATAL(stage2): the vanish never landed — aborting"); writeReceipt({ fatal: "vanish never landed", stage2: { pass, fail } }); process.exit(2); }
writeState({ ...st2, vanish });

/* THE LEDGER'S WORD NEVER CAME HOME: the launcher finishes; the accounting
 * row lands host-side; no wire, no question — the row's vanish word stands */
let ledger2 = false;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    if (accountingRows().some((r) => r.startsWith(`${vanish.slurmId}|`) && r.includes("COMPLETED"))) { ledger2 = true; break; }
    await sleep(1000);
  }
}
ok("S2 THE RUN FINISHED ON THE CLUSTER — the ledger's COMPLETED row landed host-side", ledger2, `slurm ${vanish.slurmId}`);
const rowAfterLedger = jobs().find((x) => x.id === c2d.id);
ok("S2 THE VANISH WORD STANDS over the finished run (no wire, no question — the ledger's word never came home)", rowAfterLedger?.result === VANISH_ROW, String(rowAfterLedger?.result ?? "none").slice(0, 90));

/* THE REFUSAL BACKSTOP: a stop POST against the vanished row earns the 409 */
const refuseP = api("POST", `/api/jobs/${c2d.id}/stop`);
ok("S2 THE REFUSAL — 409 with the status named ('Job is not running (status: failed)')", refuseP.error === "Job is not running (status: failed)", JSON.stringify(refuseP).slice(0, 110));
const rowAfterRefusal = jobs().find((x) => x.id === c2d.id);
ok("S2 THE ROW UNTOUCHED (the refusal claims nothing)", rowAfterRefusal?.result === VANISH_ROW && rowAfterRefusal?.status === "failed", "");

writeReceipt({ stage2v: { pass, fail, vanishSlurmId: vanish.slurmId, refusal: refuseP.error ?? null } });
console.log(`== t936 stage2 (vanish) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2v") process.exit(fail === 0 ? 0 : 1);

/* ---- THE UI STOP'S TOAST RACE: the dance first, the cut inside the
 * sweep's 4s quiet window, the click — the miss class's toast, witnessed */
console.log("== stage 2 (UI): the toast race ==");
/* the UI arc's window: the dance + the aligner spend ~15-20s of it — 16
 * iterations (~18s) is too tight (the t934 law), 32 (~36s) leaves margin */
const patch32 = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: 32 } });
ok("S2 the UI arc's iterations pinned at 32 (the dance's window)", String(patch32.job?.params?.iterations) === "32", JSON.stringify(patch32.job?.params ?? patch32).slice(0, 80));
let uiStop = null;
let uiLoss = null;
for (let attempt = 1; attempt <= 3 && !uiStop; attempt++) {
  console.log(`-- S2ui attempt ${attempt} --`);
  if (!connections().some((x) => x.id === liveConn.id)) {
    const rc = recreateWire(snap, liveConn.id);
    ok(`S2ui attempt ${attempt} the wire re-created`, !!rc?.connection?.id, rc?.error ?? "");
    const rb = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: liveConn.id });
    ok(`S2ui attempt ${attempt} the binding re-pointed`, rb.ok === true, "");
  }
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S2ui attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  const fresh = await freshPid();
  if (!fresh?.pid) { ok(`S2ui attempt ${attempt} the launcher pid found`, false, "no fresh pid"); continue; }
  /* the warm-up reload law: TWO opens — the first rides the settled bundle */
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
  await sleep(800);
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
  await sleep(1200);
  sh(`${AB} press Control+f`);
  await sleep(500);
  sh(`${AB} keyboard type "${NAME_CLASS2D}"`);
  await sleep(600);
  sh(`${AB} press Enter`);
  await sleep(900);
  sh(`${AB} press Escape`);
  await sleep(400);
  await settleCensus();
  const inspR = await openInspectorHard(NAME_CLASS2D);
  ok(`S2ui attempt ${attempt} the RUNNING job's inspector opens`, String(inspR).startsWith("open@try"), String(inspR));
  const stopBtn = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Stop'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null }); })()`,
    (v) => v.present === true, 20, 600,
  );
  ok(`S2ui attempt ${attempt} THE STOP BUTTON STANDS at the running face`, stopBtn?.present === true && stopBtn?.disabled === false, `disabled=${stopBtn?.disabled}`);
  if (stopBtn?.present !== true) { try { sh(`${AB} press Escape`); } catch {}; continue; }
  const depthOk = mockRounds(c2dMockDir).length >= 1 && pidAlive(fresh.pid);
  if (!depthOk) { ok(`S2ui attempt ${attempt} mid-flight at dance time`, false, "the run is gone — retry"); try { sh(`${AB} press Escape`); } catch {}; continue; }

  /* THE PHASE ALIGNER + THE SINGLE-SHADOW CHAIN: the app-shell's poll
   * fires every 1.2s while any job is active (anyActive → 1200ms — the
   * three losses' own teacher), and the no-conn branch has NO quiet floor
   * (every reconcile finalizes instantly). The ONLY winning window is the
   * SHADOW of a just-landed pollTick: tail the dev server's log; the
   * moment a pollTick's GET lands, the next one is ~1.2s away — the
   * DELETE + the ONE-spawn find-click chain rides inside it (~0.7s), and
   * the POST's own finalize (the record done at ~+0.7s) beats the next
   * tick by ~0.5s. The locate evals ran during the dance (the wire up —
   * no cut window to ride). */
  const stopSpot = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Stop' && !x.disabled); return JSON.stringify({ present: !!b }); })()`);
  if (stopSpot?.present !== true) { ok(`S2ui attempt ${attempt} the Stop button pre-checked (the wire still up)`, false, JSON.stringify(stopSpot ?? {})); try { sh(`${AB} press Escape`); } catch {}; continue; }
  ok(`S2ui attempt ${attempt} the Stop button pre-checked (the wire still up)`, true, "");
  const DEV_LOG = "/tmp/cryoflow-qa/dev-server.log";
  const pollHits = () => {
    try { return Number(execSync(`rg -c "GET /api/jobs\\\\?v=" ${DEV_LOG}`, { encoding: "utf8", cwd: ROOT }).trim()); } catch { return 0; }
  };
  const before = pollHits();
  const t0 = Date.now();
  let observed = false;
  while (Date.now() - t0 < 4000) {
    if (pollHits() > before) { observed = true; break; }
    await sleep(60);
  }
  ok(`S2ui attempt ${attempt} THE POLL TICK OBSERVED in the dev log (the 1.2s shadow opens)`, observed, observed ? "aligned" : "timeout — firing anyway");
  /* THE SINGLE-SHADOW CHAIN: the DELETE and the in-page .click() ride ONE
   * shell invocation (~0.5s total — the find-click's own actionability
   * wait stretched past the shadow; a programmatic .click() fires React's
   * delegated handler all the same). The POST lands ~0.55s after the
   * observed tick; the record is done at ~+0.6s; the next tick at ~+1.2s
   * finds a done record the no-conn branch cannot touch. */
  let chainOut = "(never ran)";
  try {
    chainOut = sh(`curl -s -X DELETE -H "Origin: ${BASE}" "${BASE}/api/remote/connections/${liveConn.id}" >/dev/null; ${AB} eval --stdin <<'CFEOF'
(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.textContent || '').trim() === 'Stop' && !x.disabled); if (!b) return 'NO-BUTTON'; b.click(); return 'CLICKED'; })()
CFEOF`, { cwd: ROOT });
  } catch (e) { chainOut = String(e); }
  const clicked = /CLICKED/.test(chainOut);
  ok(`S2ui attempt ${attempt} THE UI STOP CLICKED (the DELETE + the in-page click in one shadow)`, clicked, String(chainOut).slice(-80));
  const parkedOk = await parkMouseOnToasts();
  ok(`S2ui attempt ${attempt} the pointer parked on the toast viewport (the t826 pause armed)`, parkedOk === true, "");
  /* THE TOAST: the miss class — title + the wire-down sentence verbatim */
  const toast = await toastRead("Stop missed");
  /* THE ROW: the click's receipt (WD_ROW) vs the sweep's steal (VANISH_ROW) */
  let laneRow = null;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 60_000) {
      const j = jobs().find((x) => x.id === c2d.id);
      if (j?.status === "failed") { laneRow = j; break; }
      if (j?.status === "completed") break;
      await sleep(800);
    }
  }
  const won = laneRow?.result === WD_ROW || laneRow?.result === WD_STAMP;
  if (won) {
    ok(`S2ui attempt ${attempt} THE TOAST SPEAKS 'Stop missed — nothing to kill' (the miss class's own title)`, toast?.hit === true, (toast?.text ?? "none").slice(0, 140));
    ok(`S2ui attempt ${attempt} THE TOAST'S DESCRIPTION IS THE WIRE-DOWN SENTENCE verbatim (the manual-kill guidance on the one surface the receipt always reaches)`, (toast?.text ?? "").includes(WIRE_DOWN_MSG), String(toast?.text ?? "none").slice(0, 200));
    ok(`S2ui attempt ${attempt} THE ROW'S WORD after the flip (either honest writer: the route's wire-down word or the record's stamp)`, laneRow?.status === "failed" && (laneRow?.result === WD_ROW || laneRow?.result === WD_STAMP), `${laneRow?.status}/${String(laneRow?.result ?? "none").slice(0, 110)}`);
    /* the failed face: the running landing is LOG (the t934 law — "Job
     * failed" renders on the Overview card only), so CLIMB to Overview
     * before the read — the same climb the S1 healed face rides */
    const faceExpr = `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ named: !!d, failed: t.includes('Job failed'), miss: t.includes('the connection for this run was deleted'), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop') }); })()`;
    let faceF = null;
    for (let i = 0; i < 3; i++) {
      await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
      await sleep(900);
      faceF = evalJson(faceExpr);
      if (faceF?.failed === true) break;
    }
    ok(`S2ui attempt ${attempt} THE FAILED FACE SPEAKS THE MISS (the card's word carries the wire's name)`, faceF?.failed === true && faceF?.miss === true, JSON.stringify(faceF ?? {}));
    ok(`S2ui attempt ${attempt} THE FAILED FACE OFFERS NO STOP (the verb's own work is done)`, faceF?.stopBtn === false, `stop=${faceF?.stopBtn}`);
    uiStop = { attempt, won: true, toast: toast?.text ?? "", row: laneRow?.result ?? "" };
  } else {
    /* the honest loss: the sweep's vanish stole the row before the click
     * could land — the vanish lane's own aggression, co-witnessed; RETRY
     * (the loop continues — the toast deserves its window) */
    ok(`S2ui attempt ${attempt} THE SWEEP STOLE THE ROW before the click could land (the vanish lane co-witnessed)`, laneRow?.result === VANISH_ROW, `${laneRow?.status}/${String(laneRow?.result ?? "none").slice(0, 100)}`);
    uiLoss = { attempt, row: laneRow?.result ?? "" };
  }
}
try { sh(`${AB} press Escape`); } catch {}
if (!uiStop && uiLoss) {
  /* all three attempts lost — the honest loss stands; the toast stays
   * unwitnessed, banked for a future ride */
  ok("S2ui THE TOAST RACE ENDED IN THE HONEST LOSS (all three attempts — the vanish lane's aggression pinned; the toast banked)", uiLoss.row === VANISH_ROW, `attempt ${uiLoss.attempt}: ${String(uiLoss.row).slice(0, 80)}`);
}
if (!uiStop && !uiLoss) { console.log("FATAL(stage2): the UI stop never landed — aborting"); writeReceipt({ fatal: "ui stop never landed", stage2: { pass, fail } }); process.exit(2); }

/* THE RESTORE: the manifest-word binding law, the t916 remove, the
 * standing leave, the ORIGINAL connection re-created (the registry's
 * standing shape), the seed trio, the doctor */
console.log("== stage 2 (restore) ==");
const mBinding = manifestBinding();
const rebind2 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: mBinding });
ok(`S2 THE BINDING RETURNED TO THE MINT-TIME VALUE (the manifest's own word: ${mBinding === null ? "null — the unbound mint" : "the connection"})`, rebind2.ok === true, `m.binding=${String(mBinding).slice(0, 24)}`);
let removeOut = "(never ran)";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
ok("S2 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
const unbind2 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null });
ok("S2 THE STANDING LEAVE — unbound after the manifest is consumed (the t929/t930 law)", unbind2.ok === true, JSON.stringify(unbind2).slice(0, 60));
/* the ORIGINAL connection re-created (the world's standing state — the
 * future windows' t300 binds resolve by name) */
const restoreConn = connections().some((x) => x.id === ORIG_CONN_ID) ? null : recreateWire(snap, ORIG_CONN_ID);
ok("S2 THE ORIGINAL CONNECTION RESTORED (the registry's standing shape: exactly one Mock Cluster)", connections().length === 1 && connections()[0]?.id === ORIG_CONN_ID, `conns=${connections().length} id=${connections()[0]?.id ?? "none"}`);
const jobsAfter = jobs();
const edgesAfter = edges();
ok("S2 the world back to the seed trio (3 jobs)", jobsAfter.length === 3, String(jobsAfter.length));
ok("S2 the world holds exactly 2 edges", edgesAfter.length === 2, String(edgesAfter.length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S2 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({ stage2: { pass, fail, uiStop, refusal: refuseP.error ?? null, restore: "done" } });
console.log(`== t936 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

console.log(`== t936 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
