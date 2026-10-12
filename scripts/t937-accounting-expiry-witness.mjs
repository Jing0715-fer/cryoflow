#!/usr/bin/env node
/**
 * t937 — the unheard expiry's honest lane: the wire-down question's
 * 10-minute patience running out with the wire STILL down, the EMPTY
 * landing that closes the question with NO new words, and the outputs
 * question that the silence itself opens (waiting, at scan cost only,
 * for a wire that has not come back).
 *
 * Never witnessed before this ride: every t935/t936 arc re-created the
 * wire and let the consult LAND a real verdict. The expiry branch —
 * "expired unheard (no live connection) — the stop receipt's stamp
 * stands", the landAccountingVerdict({}) EMPTY landing — has never had a
 * live fire. The honest arc holds the full patience (~10 minutes of
 * blind-window discipline: the browser parked on about:blank, host-side
 * reads only, the sweep paced by deliberate GETs past the 20s floor).
 *
 * THE PRODUCT FACTS the code read pinned before the ride:
 *   - the no-conn branch's expiry: Date.now() - opened.at > 10min →
 *     landAccountingVerdict(id, startedAt, {}) + the dev log's line;
 *   - the EMPTY landing clears accountingPending and opens
 *     outputsLedgerPending (the t626 law: EVERY landing path — even the
 *     silence — earns the outputs question) while touching NO word and
 *     NO exit code: the stamp stands, byte-identical;
 *   - the outputs question with NO wire: the !conn branch's bare
 *     `continue` — the question stays open at scan cost only, no SSH
 *     tax, no tries bump, no manifest;
 *   - when a wire DOES come back (the t325-a host:port fallback), the
 *     manifest-only SSH leg answers the question through it — never
 *     witnessed on a wire-down record before this arc.
 *
 * stage1 (~4 min): the mint re-rides, the bind, iterations=16, the park,
 *   the wire cut, THE STOP THAT COULD NOT REACH (the t936 pins compactly
 *   re-ridden), the run's own death unheard — and then THE WIRE STAYS
 *   DOWN: the state saved, the patience begun.
 * stage2 (~12 min — run it nohup'd): THE PATIENCE — paced host-side GETs
 *   (each past the consult's 20s floor), the mid-patience pin (the
 *   question still open, the words standing, the dev log innocent), THE
 *   EXPIRY (the dev log's line verbatim, the question closed, the EMPTY
 *   landing's two facts: no words changed, the outputs question opened),
 *   the outputs question's own no-wire patience (scan cost only — no SSH
 *   tax, no tries, no manifest).
 * stage3 (~4 min): THE WIRE RETURNS at its ORIGINAL id — the manifest leg
 *   answers the outputs question THROUGH the re-created wire (the t325-a
 *   fallback serving the t626 flag — never witnessed), the row's miss
 *   word stands forever (no heal here — the ledger's word never came),
 *   the failed face, the restore (the binding's manifest word, the t916
 *   remove, the unbound leave), the seed trio + 2 edges, the doctor CLEAN.
 *
 *   node scripts/t937-accounting-expiry-witness.mjs stage1|stage2|stage3|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t937-accounting-expiry-witness.json";
const STATE = path.join(ROOT, "data", "t937-accounting-expiry.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");
const ENGINE_STATE = path.join(ROOT, "data", "engine-state.json");
const DEV_LOG = "/tmp/cryoflow-qa/dev-server.log";

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";

const ITERS = 16;
const PATIENCE_MS = 10 * 60_000; /* ACCOUNTING_BACKFILL_PATIENCE_MS, the product's own word */

/* the product's own words (the stop route's wireDown branches, verbatim) */
const WIRE_DOWN_MSG = "the connection for this run was deleted — kill the process on the cluster manually";
const WD_STAMP = "stop missed — the connection for this run was deleted; the cluster ledger decides the final state";
const WD_ROW = "stop missed (the connection for this run was deleted) — kill the process on the cluster manually; the cluster ledger decides the final state if a wire returns";
/* the expiry's dev log line (remote-run.ts, the no-conn branch) */
const EXPIRY_LINE = `the accounting question for "${NAME_CLASS2D}" expired unheard (no live connection) — the stop receipt's stamp stands`;

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
const connections = () => apiJson("/api/remote/connections").connections ?? [];
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
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}
const receiptHas = (key) => {
  try { return !!JSON.parse(readFileSync(path.join(ROOT, RECEIPT), "utf8"))[key]; } catch { return false; }
};
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
/* the dev log's expiry testimony — host-side tail, the t936 law's file */
const expiryLines = () => {
  try {
    return sh(`rg "expired unheard \\(no live connection\\)" ${DEV_LOG} | tail -5`).split("\n").filter(Boolean);
  } catch { return []; }
};
const silentLines = () => {
  try { return Number(execSync(`rg -c "expired unheard \\(the ledger stayed silent\\)" ${DEV_LOG}`, { encoding: "utf8", cwd: ROOT }).trim()); } catch { return 0; }
};
const outputsLandedLines = () => {
  try {
    return sh(`rg "the outputs ledger landed for" ${DEV_LOG} | tail -5`).split("\n").filter(Boolean);
  } catch { return []; }
};

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_S2 = STAGE === "main" || STAGE === "stage2" || STAGE === "stage2mid";
const RUN_S3 = STAGE === "main" || STAGE === "stage3";

/* ============================ prep ======================================== */
console.log(`== t937 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

/* the dev log's BASELINES — the log outlives the arc (previous windows'
 * lines still hang there); every later log pin is RELATIVE to these */
const LOG_BASE = { expiry: expiryLines().length, silent: silentLines(), landed: outputsLandedLines().length };
ok("prep the dev log baselines captured", true, `expiry=${LOG_BASE.expiry} silent=${LOG_BASE.silent} landed=${LOG_BASE.landed}`);

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * THE WIRE-DOWN MISS, then NO WIRE RETURNS: the t936 arc's opening,
 * compactly re-ridden, ending in the patience instead of the heal. */
console.log("== stage 1: the wire cut, THE STOP THAT COULD NOT REACH, the patience begun ==");

/* a FRESH ARC owns a FRESH receipt — the previous arc's stage keys
 * (stage2mid included) must never leak into this arc's gates */
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ resetAt: new Date().toISOString() }, null, 2));

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

/* the blind window: the browser parks on about:blank — the UI's own poll
 * is a sweep driver, and ONE GET after the wire cut would let the run
 * sweep's no-conn branch steal the stop's lane (the vanish word) */
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
  ok(`S1 attempt ${attempt} THE RECEIPT'S CLASS: stopped=false, outcome='missed', settled=null`, stopP.stopped === false && stopP.outcome === "missed" && stopP.settled === null, `stopped=${stopP.stopped} outcome=${stopP.outcome} settled=${stopP.settled}`);
  ok(`S1 attempt ${attempt} THE MESSAGE IS THE WIRE-DOWN SENTENCE verbatim`, stopP.message === WIRE_DOWN_MSG, String(stopP.message ?? "none").slice(0, 140));
  /* THE ROW'S WORD — either honest writer (the t934 law's own twin: the
   * route's flip and the sweep's orphan heal both speak for the stop; the
   * t936 stage1 rode the route-wins branch, this ride may hit the other) */
  const rowWord = stopP.job?.result ?? "";
  ok(`S1 attempt ${attempt} THE ROW'S WORD — either honest writer (the route's wire-down word or the record's stamp)`, stopP.job?.status === "failed" && (rowWord === WD_ROW || rowWord === WD_STAMP), `${stopP.job?.status}/${String(rowWord ?? "none").slice(0, 110)}`);
  const recStop = readRecord(c2d.id);
  ok(`S1 attempt ${attempt} THE DEFERRING STAMP verbatim (done, NO exit code — a missed kill claims nothing; the wire named)`, recStop?.done === true && recStop?.result === WD_STAMP && (recStop?.exitCode ?? null) === null, `done=${recStop?.done} exit=${recStop?.exitCode ?? "none"} result=${String(recStop?.result ?? "none").slice(0, 80)}`);
  ok(`S1 attempt ${attempt} THE QUESTION OPEN with missed:true AND class:'wire-down'`, recStop?.remote?.accountingPending?.missed === true && recStop?.remote?.accountingPending?.class === "wire-down", JSON.stringify(recStop?.remote?.accountingPending ?? null));
  arc = {
    slurmId: fresh.id,
    pid: fresh.pid,
    attempt,
    openedAt: recStop?.remote?.accountingPending?.at ?? Date.now(),
    rowWordAtStop: rowWord,
    cutAt: new Date().toISOString(),
  };
  break;
}
if (!arc) { console.log("FATAL: the wire-down stop never landed — aborting"); writeReceipt({ fatal: "wire-down never landed" }); process.exit(2); }

/* THE WIRE STAYS DOWN — the arc's own precondition: NO connection anywhere
 * (the !conn branch has no host:port fallback target in the registry) */
const connsAfterCut = connections();
ok("S1 THE WIRE STAYS DOWN — the registry holds NO connection (the expiry branch's honest precondition)", !connsAfterCut.some((x) => x.id === ORIG_CONN_ID) && connsAfterCut.length === 0, `conns=${connsAfterCut.length}`);

/* the stop-time snapshots the patience will be judged against: the
 * monitor's live-phase slurmState residue (the expiry must not CHANGE it)
 * and the manifest's writtenAt (the mint's own finalize residue — the
 * silence must not touch it) */
const recSnap = readRecord(c2d.id);
const slurmStateAtStop = recSnap?.remote?.slurmState ?? null;
const rowSnapGet = jobs().find((x) => x.id === c2d.id); /* one GET: the sweep tick settles any mint-finalize race */
let manifestAtStop = null;
try { manifestAtStop = JSON.parse(readFileSync(path.join(recSnap?.workdir ?? "", ".cf-remote-manifest.json"), "utf8"))?.writtenAt ?? null; } catch {}
ok("S1 the stop-time snapshots taken (slurmState residue + manifest writtenAt)", true, `state=${slurmStateAtStop ?? "none"} manifest=${manifestAtStop ?? "none"}`);
writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, origConnId: ORIG_CONN_ID, snap, slurmStateAtStop, manifestAtStop, logBase: LOG_BASE, ...arc });

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
ok("S1 THE MISS WORDS STAND (no wire, no echo — the deferring stamp and the open question over a run that has in fact finished)", recUnheard?.result === WD_STAMP && !!recUnheard?.remote?.accountingPending, `result=${String(recUnheard?.result ?? "none").slice(0, 80)}`);
const rowUnheard = jobs().find((x) => x.id === c2d.id);
ok("S1 THE ROW'S WORD STANDS over the finished run (either honest writer — unchanged since the receipt)", rowUnheard?.status === "failed" && (rowUnheard?.result === arc.rowWordAtStop), `${rowUnheard?.status}/${String(rowUnheard?.result ?? "none").slice(0, 90)}`);
ok("S1 THE DEV LOG UNCHANGED at patience zero (no NEW expiry has spoken — the baseline holds)", expiryLines().length === LOG_BASE.expiry && silentLines() === LOG_BASE.silent, `expiry=${expiryLines().length}/${LOG_BASE.expiry} silent=${silentLines()}/${LOG_BASE.silent}`);

writeReceipt({ stage1: { pass, fail, slurmId: arc.slurmId, openedAt: arc.openedAt, origConnId: ORIG_CONN_ID } });
console.log(`== t937 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_S2) {
/* ========================= stage 2 =======================================
 * THE PATIENCE + THE EXPIRY: ~10 minutes of blind-window discipline —
 * the browser parked, the sweep paced by deliberate GETs past the 20s
 * consult floor — then the EMPTY landing, witnessed on record, row, and
 * dev log. Run this stage nohup'd: it outlives any single shell window. */
console.log("== stage 2: the patience held, THE EXPIRY's empty landing, the silence's own question ==");

const st2 = readState();
const c2dId = st2.c2dId;
const ORIG_CONN_ID2 = st2.origConnId;
if (!c2dId || !st2.openedAt) { console.log("FATAL(stage2): no state — run stage1 first"); process.exit(2); }
sh(`${AB} open about:blank`); /* the blind window holds (the UI's poll is a sweep driver) */
await sleep(600);

/* a pace helper: one sweep tick (a GET), then a long quiet — every tick
 * rides past the 20s consult floor, so each one is a REAL expiry check */
const paceMs = 45_000;
const paceUntil = async (targetMs) => {
  while (Date.now() < targetMs) {
    try { jobs(); } catch {}
    const remain = Math.round((targetMs - Date.now()) / 1000);
    console.log(`  ...patience: ${remain}s remain (${new Date().toISOString()})`);
    await sleep(Math.min(paceMs, Math.max(1000, targetMs - Date.now())));
  }
};

const openedAt = st2.openedAt;
const elapsed = Date.now() - openedAt;
console.log(`-- the question opened at ${new Date(openedAt).toISOString()} (${Math.round(elapsed / 1000)}s ago) --`);

if (Date.now() < openedAt + PATIENCE_MS && !receiptHas("stage2mid")) {
  /* THE MID-PATIENCE PIN (~T+5min): the patience is real — the question
   * is still open halfway through, the words stand, the dev log innocent */
  await paceUntil(openedAt + Math.floor(PATIENCE_MS / 2));
  const recMid = readRecord(c2dId);
  ok("S2 THE QUESTION STILL OPEN at mid-patience (the patience is real, not instant)", !!recMid?.remote?.accountingPending && recMid.remote.accountingPending.class === "wire-down" && recMid.remote.accountingPending.missed === true, JSON.stringify(recMid?.remote?.accountingPending ?? null));
  ok("S2 THE STAMP STANDS at mid-patience (done, NO exit code, the wire named)", recMid?.done === true && recMid?.result === WD_STAMP && (recMid?.exitCode ?? null) === null, `exit=${recMid?.exitCode ?? "none"}`);
  const rowMid = jobs().find((x) => x.id === c2dId);
  ok("S2 THE ROW'S WORD STANDS at mid-patience (unchanged since the receipt — either honest writer, frozen)", rowMid?.status === "failed" && rowMid?.result === st2.rowWordAtStop, `${rowMid?.status}/${String(rowMid?.result ?? "none").slice(0, 90)}`);
  ok("S2 THE DEV LOG INNOCENT at mid-patience (no NEW expiry line — the baseline holds)", expiryLines().length === (st2.logBase?.expiry ?? 0), `expiry=${expiryLines().length}/${st2.logBase?.expiry ?? 0}`);
  ok("S2 THE OUTPUTS QUESTION NOT YET OPEN at mid-patience (the landing alone opens it)", !recMid?.remote?.outputsLedgerPending, `outputsLedgerPending=${String(recMid?.remote?.outputsLedgerPending)}`);
  writeReceipt({ stage2mid: { pass, fail, at: new Date().toISOString() } });
}
if (STAGE === "stage2mid") {
  console.log(`== t937 stage2mid ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* THE EXPIRY: past the patience, the next paced tick lands the empty
 * landing — poll the record host-side until the question closes */
await paceUntil(openedAt + PATIENCE_MS + 8_000);
let recExp = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 180_000) {
    try { jobs(); } catch {}
    const rec = readRecord(c2dId);
    if (rec?.done && !rec?.remote?.accountingPending) { recExp = rec; break; }
    await sleep(4000);
  }
}
ok("S2 THE EXPIRY LANDED — the question closed past the patience (the empty landing's own fingerprint)", !!recExp, recExp ? "" : "the question never closed in 180s");
if (!recExp) { console.log("FATAL(stage2): the expiry never landed — aborting"); writeReceipt({ fatal: "expiry never landed", stage2: { pass, fail } }); process.exit(2); }

const expBase = st2.logBase?.expiry ?? 0;
const expLines = expiryLines();
ok("S2 THE DEV LOG'S LINE VERBATIM ('…expired unheard (no live connection) — the stop receipt's stamp stands')", expLines.length === expBase + 1 && expLines.some((l) => l.includes(EXPIRY_LINE)), (expLines[expLines.length - 1] ?? "none").slice(-150));
ok("S2 THE SILENT VARIANT NEVER SPOKE (the no-conn branch, not the no-row branch — the right patience for this arc)", silentLines() === (st2.logBase?.silent ?? 0), `silent=${silentLines()}/${st2.logBase?.silent ?? 0}`);
/* THE EMPTY LANDING'S FIRST FACT — NO NEW WORDS: the stamp survives
 * byte-identical, the exit stays absent, the ledger never spoke a state */
ok("S2 NO NEW WORDS — the stamp byte-identical (the receipt's own knowledge is the final word)", recExp?.result === WD_STAMP, String(recExp?.result ?? "none").slice(0, 110));
ok("S2 NO EXIT CODE EARNED (a missed kill still claims nothing — the silence decided nothing)", (recExp?.exitCode ?? null) === null, `exit=${recExp?.exitCode ?? "none"}`);
ok("S2 NO NEW LEDGER WORD (the live-phase slurmState residue UNTOUCHED — the landing wrote no state of its own)", recExp?.remote?.slurmState === (st2.slurmStateAtStop ?? null), `state=${recExp?.remote?.slurmState ?? "none"} (stop-time ${st2.slurmStateAtStop ?? "none"})`);
ok("S2 NO LEDGER ELAPSED EARNED (the silence measured nothing)", recExp?.remote?.slurmElapsedMs == null, `elapsed=${String(recExp?.remote?.slurmElapsedMs ?? "none")}`);
/* THE EMPTY LANDING'S SECOND FACT — the outputs question opened by the
 * silence itself (the t626 law: EVERY landing path earns the question) */
ok("S2 THE SILENCE'S OWN QUESTION OPENED (outputsLedgerPending:true — the sync-back never ran for this run either)", recExp?.remote?.outputsLedgerPending === true, `outputsLedgerPending=${String(recExp?.remote?.outputsLedgerPending)}`);
/* the row: the empty landing touches nothing durable */
const rowExp = jobs().find((x) => x.id === c2dId);
ok("S2 THE ROW UNTOUCHED by the expiry (failed + the stop-time word, byte-identical)", rowExp?.status === "failed" && rowExp?.result === st2.rowWordAtStop, `${rowExp?.status}/${String(rowExp?.result ?? "none").slice(0, 90)}`);

/* THE OUTPUTS QUESTION'S OWN NO-WIRE PATIENCE: the !conn branch's bare
 * `continue` — the question waits at scan cost only: no SSH tax, no
 * tries, no manifest, no words */
{
  await sleep(75_000); /* two-plus ticks past the outputs leg's 30s floor */
  try { jobs(); } catch {}
  await sleep(20_000);
  try { jobs(); } catch {}
  const recOut = readRecord(c2dId);
  const localWorkdir = recOut?.workdir;
  let manNow = null;
  try { manNow = JSON.parse(readFileSync(path.join(localWorkdir ?? "", ".cf-remote-manifest.json"), "utf8")); } catch {}
  ok("S2 THE OUTPUTS QUESTION STILL OPEN with no wire (the honest wait — scan cost only)", recOut?.remote?.outputsLedgerPending === true, `outputsLedgerPending=${String(recOut?.remote?.outputsLedgerPending)}`);
  ok("S2 NO SSH TAX — no tries spent on a wire that cannot answer (outputsLedgerTries absent)", recOut?.remote?.outputsLedgerTries == null, `tries=${String(recOut?.remote?.outputsLedgerTries ?? "none")}`);
  ok("S2 THE MANIFEST UNTOUCHED BY THE SILENCE (writtenAt = the stop-time residue — no cluster was asked, nothing was rewritten)", !!localWorkdir && (manNow?.writtenAt ?? null) === (st2.manifestAtStop ?? null), `now=${manNow?.writtenAt ?? "none"} at-stop=${st2.manifestAtStop ?? "none"}`);
  ok("S2 THE OUTPUTS LEG'S LOG QUIET (no NEW landed line — the leg never even tried)", outputsLandedLines().length === (st2.logBase?.landed ?? 0), `landed=${outputsLandedLines().length}/${st2.logBase?.landed ?? 0}`);
}
writeState({ ...st2, expiryDone: true });
writeReceipt({ stage2: { pass, fail, expiryLine: (expiryLines().slice(-1)[0] ?? "").slice(-150) } });
console.log(`== t937 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

if (RUN_S3) {
/* ========================= stage 3 =======================================
 * THE WIRE RETURNS AT ITS ORIGINAL ID — the manifest leg answers the
 * silence's question THROUGH the re-created wire (the t325-a fallback
 * serving the t626 flag, never witnessed), the row's miss word stands
 * forever, the failed face, the restore. */
console.log("== stage 3: the wire returns, the manifest leg's answer, the standing leave ==");

const st3 = readState();
const c2dId = st3.c2dId;
const ORIG_CONN_ID3 = st3.origConnId;
const snap3 = st3.snap;
if (!c2dId || !ORIG_CONN_ID3 || !snap3) { console.log("FATAL(stage3): no state — run stage1 first"); process.exit(2); }
if (!st3.expiryDone) { console.log("FATAL(stage3): the expiry has not landed — run stage2 first"); process.exit(2); }

/* THE WIRE RETURNS at its ORIGINAL id — the world's standing shape */
if (!connections().some((x) => x.id === ORIG_CONN_ID3)) {
  const rc = recreateWire(snap3, ORIG_CONN_ID3);
  ok("S3 THE WIRE RETURNS at its ORIGINAL id (the registry's standing shape — one Mock Cluster)", !!rc?.connection?.id, rc?.error ?? `${rc?.connection?.id ?? "none"} (wanted ${ORIG_CONN_ID3})`);
}
const conns3 = connections();
ok("S3 the registry holds exactly one Mock Cluster at its standing id", conns3.length === 1 && conns3[0]?.id === ORIG_CONN_ID3, `conns=${conns3.length} id=${conns3[0]?.id ?? "none"}`);

/* THE MANIFEST LEG LANDS — the outputs question answered through the
 * re-created wire (the record's dead connectionId resolved by the
 * host:port fallback, t325-a, now serving the t626 flag) */
let recMan = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 180_000) {
    try { jobs(); } catch {}
    const rec = readRecord(c2dId);
    if (rec?.done && !rec?.remote?.outputsLedgerPending) { recMan = rec; break; }
    await sleep(3000);
  }
}
ok("S3 THE OUTPUTS QUESTION ANSWERED through the re-created wire (the t325-a fallback serving the t626 flag — never witnessed before)", !!recMan, recMan ? "" : "the manifest leg never landed in 180s");
if (!recMan) { console.log("FATAL(stage3): the manifest leg never landed — aborting"); writeReceipt({ fatal: "manifest leg never landed", stage3: { pass, fail } }); process.exit(2); }
ok("S3 THE LANDING STAMPED (outputsLedgerAt set — the manifest leg's own timestamp)", typeof recMan?.remote?.outputsLedgerAt === "number", `at=${String(recMan?.remote?.outputsLedgerAt ?? "none")}`);
const manPath = recMan?.workdir ? path.join(recMan.workdir, ".cf-remote-manifest.json") : null;
let man = null;
try { man = JSON.parse(readFileSync(manPath, "utf8")); } catch {}
ok("S3 THE MANIFEST FILE EXISTS at the run's workdir (the Files tab's future authorization)", !!man, manPath ?? "no workdir");
ok("S3 THE MANIFEST REWRITTEN BY THE LEG (writtenAt moved past the stop-time residue — the re-created wire's own hand)", !!man && man?.writtenAt !== (st3.manifestAtStop ?? null) && Date.parse(man?.writtenAt ?? "") > (st3.openedAt ?? 0), `now=${man?.writtenAt ?? "none"} at-stop=${st3.manifestAtStop ?? "none"}`);
ok("S3 THE MANIFEST NAMES THE RUN'S OWN WIRE (connectionId = the record's standing id)", man?.connectionId === ORIG_CONN_ID3, `${man?.connectionId ?? "none"}`);
ok("S3 THE MANIFEST NAMES THE CLUSTER'S TRUTH (files listed, the remote workdir named)", (man?.files?.length ?? 0) > 0 && typeof man?.remoteWorkdir === "string" && man.remoteWorkdir.length > 0, `${man?.files?.length ?? 0} files · ${String(man?.remoteWorkdir ?? "none").slice(0, 60)}`);
const landed3 = outputsLandedLines();
ok("S3 THE DEV LOG'S LANDING LINE ('…N files named on the cluster (manifest only; no sync-back ran)')", landed3.length > (st3.logBase?.landed ?? 0) && landed3.some((l) => l.includes(`the outputs ledger landed for "${NAME_CLASS2D}"`) && l.includes("(manifest only; no sync-back ran)")), (landed3[landed3.length - 1] ?? "none").slice(-160));
/* THE ROW STILL FAILED — no heal here: the accounting question closed at
 * the expiry, the ledger's word never came home, the manifest leg touches
 * nothing but the record's flag. The stop's word is the row's word. */
const rowMan = jobs().find((x) => x.id === c2dId);
ok("S3 THE ROW STILL FAILED — the manifest landing heals NOTHING (the stop's word is the row's word, forever)", rowMan?.status === "failed" && rowMan?.result === st3.rowWordAtStop, `${rowMan?.status}/${String(rowMan?.result ?? "none").slice(0, 90)}`);
ok("S3 THE RECORD'S WORDS UNTOUCHED by the manifest leg (the stamp stands; the landing only closes the question)", recMan?.result === WD_STAMP && (recMan?.exitCode ?? null) === null, `result=${String(recMan?.result ?? "none").slice(0, 80)}`);

/* THE FAILED FACE: the warm-up reload law, the search, the climb — the
 * cards must BE on the page before any face read (a cardless page once
 * ate this tail silently — the manifest leg's reconcile can hold the
 * page's first GETs; three opens and a LOUD pin keep it honest) */
let carded = null;
for (let i = 0; i < 3 && !carded; i++) {
  sh(`${AB} open ${BASE}/`);
  carded = await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 40, 600);
  await sleep(800);
}
ok("S3 the workspace renders (the cards on the page — the warm-up reload law, three opens deep)", !!carded && carded.cards >= 3, `cards=${carded?.cards ?? "none"}`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 40, 600);
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
const insp3 = await openInspectorHard(NAME_CLASS2D);
ok("S3 the FAILED job's inspector opens", String(insp3).startsWith("open@try"), String(insp3));
await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ tabs: [...(d?.querySelectorAll('[role="tab"]') ?? [])].map(t => (t.textContent || '').trim()) }); })()`,
  (v) => v.tabs?.includes("Overview") === true, 12, 600,
);
const faceExpr = `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ failed: t.includes('Job failed'), miss: t.includes('kill the process on the cluster manually') || t.includes('the cluster ledger decides the final state'), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`;
let face3 = evalJson(faceExpr);
/* the remount law: the climb retries at its own pace (3 tries) */
let ov3 = "skipped";
for (let i = 0; i < 3 && face3?.failed !== true; i++) {
  ov3 = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
  await sleep(1100);
  face3 = evalJson(faceExpr);
}
ok("S3 the Overview climb clicked (the failed face read honestly)", String(ov3).startsWith("clicked@") || face3?.failed === true, String(ov3));
ok("S3 THE FAILED FACE SPEAKS THE MISS after the whole arc (the card's word carries the stop's knowledge — either honest writer's words)", face3?.failed === true && face3?.miss === true, JSON.stringify(face3 ?? {}));
ok("S3 THE FAILED FACE OFFERS NO STOP (the verb's work is done; Re-run stands)", face3?.stopBtn === false && face3?.rerun === true, `stop=${face3?.stopBtn} rerun=${face3?.rerun}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

/* THE RESTORE: the manifest-word binding law, the t916 remove, the
 * standing leave, the registry's shape, the seed trio, the doctor */
console.log("== stage 3 (restore) ==");
const mBinding = manifestBinding();
const rebind3 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: mBinding });
ok(`S3 THE BINDING RETURNED TO THE MINT-TIME VALUE (the manifest's own word: ${mBinding === null ? "null — the unbound mint" : "the connection"})`, rebind3.ok === true, `m.binding=${String(mBinding).slice(0, 24)}`);
let removeOut = "(never ran)";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
ok("S3 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
const unbind3 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null });
ok("S3 THE STANDING LEAVE — unbound after the manifest is consumed (the t929/t930 law)", unbind3.ok === true, JSON.stringify(unbind3).slice(0, 60));
const connsEnd = connections();
ok("S3 THE ORIGINAL CONNECTION STANDING (exactly one Mock Cluster at its original id)", connsEnd.length === 1 && connsEnd[0]?.id === ORIG_CONN_ID3, `conns=${connsEnd.length} id=${connsEnd[0]?.id ?? "none"}`);
const jobsAfter = jobs();
const edgesAfter = edges();
ok("S3 the world back to the seed trio (3 jobs)", jobsAfter.length === 3, String(jobsAfter.length));
ok("S3 the world holds exactly 2 edges", edgesAfter.length === 2, String(edgesAfter.length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S3 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({ stage3: { pass, fail, manifestFiles: man?.files?.length ?? 0, restore: "done" } });
console.log(`== t937 stage3 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage3") process.exit(fail === 0 ? 0 : 1);
} /* end stage3 */

console.log(`== t937 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
