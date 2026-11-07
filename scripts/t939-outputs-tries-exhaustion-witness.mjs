#!/usr/bin/env node
/**
 * t939 — the outputs ledger's TRIES EXHAUSTION: the wire up, the find
 * deaf three rounds running, the question closing after 3 silent rounds,
 * and the on-demand doors' honest shape after the budget spends.
 *
 * Never witnessed before this ride: the t626 bumpOutputsLedgerTries lane
 * (remote-run.ts) — "one failed SSH round, one strike; three strikes
 * close the question (a login node that cannot answer `find` three ticks
 * running will not answer the fetch doors either)". The t937/t938 arcs
 * witnessed the question's OPENING (the expiry's two variants) and its
 * ANSWER (the manifest leg landing); the FAILURE side — the find failing
 * non-zero round after round until the budget spends — has no live fire.
 * The dev log's closing words ("the question closes after 3 silent
 * rounds; the on-demand doors stay shut for this run") have never been
 * spoken.
 *
 * WHY THE RAW-KILL OPENER (the first ride's lesson, banked): a NATURAL
 * death arms the monitor's in-process EXIT finalize — its enumeration
 * beat the lever every time and wrote a FRESH manifest (9 files), so the
 * doors were never shut at all. The raw kill (the t932 lever) leaves the
 * record done+stamped before any tick can observe the death: NO finalize
 * runs, NO manifest is written — the only manifest in the local workdir
 * is the MINT'S OWN RESIDUE (the t333 keep-set: the manifest survives the
 * re-dispatch wipe). The t938 opener re-rides verbatim: the raw kill,
 * the blind-window refused stop (the class-absent question), the
 * patience — then the expiry's empty landing opens the OUTPUTS question
 * (the t626 law spares nothing, not even silence).
 *
 * THE ARC: stage1 — the raw kill, the refused stop, the stop-time
 * snapshots, THE DEAF LEVER (the REMOTE workdir moved aside host-side;
 * the wire stays UP, the LOCAL workdir stays — the leg's existsSync gate
 * passes, so the find goes DEAF, it is not skipped; nothing enumerates
 * during the aside: the finalize never ran, the question is not open
 * yet). stage2mid — the mid-patience pins (the question open, the lever
 * still thrown, the SSH tax real). stage2 — the expiry (the silence's
 * line verbatim, the empty landing, the silence's own question), then
 * THE THREE STRIKES paced by the 30s OUTPUTS_LEDGER_FLOOR_MS:
 * round 1 — tries 1, "the question stays open";
 * round 2 — tries 2, "the question stays open";
 * round 3 — tries 3 → EXHAUSTED → the question CLOSES wholesale
 *           (outputsLedgerPending: undefined, outputsLedgerTries:
 *           undefined) and the dev log speaks the never-spoken words.
 * The wire's courtesy restore: the remote workdir comes back — and the
 * question STAYS closed. stage3 — the doors' honest shape: the leg stays
 * SILENT through a 70s watch (the closed question cannot strike, cannot
 * land — even with the wire up and the workdir back); the manifest is
 * STILL (writtenAt byte-identical from the stop-time residue — the
 * closed question cannot rewrite the ledger); the ledger is the PAST'S
 * (its writtenAt predates the arc); the on-demand batch door opens ONLY
 * on that past's ledger (total = the residue's count; a residue-named
 * path answers "already home" bytes:0 — the past's pulls) while the
 * present's truth stays invisible to it; the row keeps the stop's word
 * byte-identical (the manifest leg heals nothing — the tries side's
 * testimony); the failed face speaks the miss; the standing leave.
 *
 *   node scripts/t939-outputs-tries-exhaustion-witness.mjs stage1|stage2mid|stage2|stage3|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t939-outputs-tries-exhaustion-witness.json";
const STATE = path.join(ROOT, "data", "t939-outputs-tries.json");
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

/* the product's own words, verbatim */
const REFUSED_STAMP = "stop missed — no live cluster session found; the cluster ledger decides the final state";
const REFUSED_ROW = "stop missed (no live cluster session found) — the cluster ledger decides the final state when the run's records come home";
const SILENT_LINE = `the accounting question for "${NAME_CLASS2D}" expired unheard (the ledger stayed silent) — the stop receipt's stamp stands`;
const ROUND_FAIL = "the outputs ledger round failed for";
const ROUND_LANDED = "the outputs ledger landed for";
const STAYS_OPEN_TAIL = "— the question stays open";
const DOORS_WORD = "— the question closes after 3 silent rounds; the on-demand doors stay shut for this run";
const SYNC_STALE_WORD = "already home";

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
const shApi = (url) => {
  let lastErr = null;
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
const connections = () => apiJson("/api/remote/connections").connections ?? [];
const findName = (n) => jobs().find((j) => j.name === n);
const readRecord = (jobId) => {
  try { return JSON.parse(readFileSync(ENGINE_STATE, "utf8"))[jobId] ?? null; } catch { return null; }
};
const manifestBinding = () => {
  try { return JSON.parse(readFileSync(path.join(ROOT, "data", "t916-class2d-mint.json"), "utf8")).binding ?? null; } catch { return null; }
};
const accountingRows = () => {
  try { return readFileSync(path.join(SLURM_DIR, "accounting"), "utf8").trim().split("\n").filter(Boolean); } catch { return []; }
};
const journalRowsFor = (id) => {
  try { return readFileSync(path.join(SLURM_DIR, "accounting"), "utf8").trim().split("\n").filter((l) => l.startsWith(`${id}|`)); } catch { return []; }
};
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
const pidAlive = (pid) => {
  try { execFileSync("/bin/kill", ["-0", String(pid)], { stdio: "ignore" }); return true; } catch { return false; }
};
const freshPid = async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000) {
    const f = slurmPids().filter((p) => Date.now() - p.mtime < 120_000).sort((a, b) => b.mtime - a.mtime)[0];
    if (f?.id) return f;
    await sleep(300);
  }
  return null;
};
/* the mock's exec-audit: the consult's own grammar is line-initial and
 * unquoted for numeric ids (the t938 law) */
const consultCount = (id) => {
  try {
    const out = sh(`rg -c "^\\\\d+ sacct -j '?${id}'? -n -P -o JobID,State,ExitCode,Elapsed" ${SLURM_DIR}/exec-audit.log 2>/dev/null || echo 0`);
    return Number(String(out).trim().split("\n").pop()) || 0;
  } catch { return 0; }
};
/* the dev log's testimony — every pin RELATIVE to a baseline (the t937
 * law: the log outlives the arc) */
const noConnLines = () => {
  try { return sh(`rg "expired unheard \\\\(no live connection\\\\)" ${DEV_LOG} | tail -5`).split("\n").filter(Boolean); }
  catch { return []; }
};
const silentLines = () => {
  try { return sh(`rg -c "expired unheard \\\\(the ledger stayed silent\\\\)" ${DEV_LOG} 2>/dev/null || echo 0`).split("\n").pop() * 1; }
  catch { return 0; }
};
const logStat = (needle) => {
  try {
    const lines = readFileSync(DEV_LOG, "utf8").split("\n").filter((l) => l.includes(needle));
    return { count: lines.length, last: lines[lines.length - 1] ?? "" };
  } catch { return { count: 0, last: "" }; }
};
const receiptHas = (key) => {
  try { return JSON.parse(readFileSync(path.join(ROOT, RECEIPT), "utf8"))[key] != null; } catch { return false; }
};
const writeReceipt = (obj) => {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
};
const writeState = (obj) => {
  mkdirSync(path.dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify(obj, null, 2));
};
const readState = () => { try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return {}; } };
const paceUntil = async (targetMs) => {
  while (Date.now() < targetMs) {
    try { jobs(); } catch {}
    const remain = Math.round((targetMs - Date.now()) / 1000);
    console.log(`  ...patience: ${remain}s remain (${new Date().toISOString()})`);
    await sleep(Math.min(45_000, Math.max(1000, targetMs - Date.now())));
  }
};

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_SMID = STAGE === "main" || STAGE === "stage2mid";
const RUN_S2 = STAGE === "main" || STAGE === "stage2";
const RUN_S3 = STAGE === "main" || STAGE === "stage3";

/* ============================ prep ======================================== */
console.log(`== t939 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

const LOG_BASE = {
  noconn: noConnLines().length,
  silent: silentLines(),
  landed: logStat(ROUND_LANDED).count,
  roundfail: logStat(ROUND_FAIL).count,
};
ok("prep the dev log baselines captured", true, `noconn=${LOG_BASE.noconn} silent=${LOG_BASE.silent} landed=${LOG_BASE.landed} roundfail=${LOG_BASE.roundfail}`);

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * THE RAW KILL (no finalize, no manifest), the blind-window refused stop
 * (the class-absent question), the snapshots, THE DEAF LEVER. */
console.log("== stage 1: the raw kill, the refused stop, the deaf lever thrown early ==");
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

const snap = (() => {
  const c = connections().find((x) => x.name === "Mock Cluster");
  if (!c) return null;
  const { hasPassword, hasPassphrase, runResume, ...rest } = c;
  return rest;
})();
ok("S1 the Mock Cluster connection standing (the wire the consult will ask)", !!snap?.id && snap?.host === "127.0.0.1" && Number(snap?.port) === 3022, `${snap?.id} ${snap?.host}:${snap?.port}`);
if (!snap?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const STANDING_CONN_ID = snap.id;

const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: STANDING_CONN_ID });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok("S1 the class2d's iterations pinned at 16 through the PATCH door (the kill's window)", !!patchP.job?.id && String(patchP.job?.params?.iterations) === "16", JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

/* the blind window: the browser parks on about:blank */
sh(`${AB} open about:blank`);
await sleep(600);

let arc = null;
for (let attempt = 1; attempt <= 3 && !arc; attempt++) {
  console.log(`-- S1 deaf-arc attempt ${attempt} --`);
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S1 attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  ok(`S1 attempt ${attempt} the bare POST accepted (the binding's lane)`, true, "");
  const fresh = await freshPid();
  if (!fresh?.pid) { ok(`S1 attempt ${attempt} the launcher pid found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid read (slurm ${fresh.id}, pid ${fresh.pid})`, true, "");
  let depth = 0;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 45_000) {
      depth = mockRounds(c2dMockDir).length;
      if (depth >= 1) break;
      await sleep(300);
    }
  }
  if (depth < 1) { ok(`S1 attempt ${attempt} run_it001 landed before the kill (mid-flight depth)`, false, "no rounds in 45s"); continue; }
  ok(`S1 attempt ${attempt} run_it001 landed (mid-flight depth before the kill)`, true, "");
  if (!pidAlive(fresh.pid)) { ok(`S1 attempt ${attempt} the launcher alive at kill time`, false, "already dead"); continue; }

  /* THE RAW KILL — the t932 lever, the real /bin/kill, the process group */
  try { execFileSync("/bin/kill", ["-9", "--", `-${fresh.pid}`], { stdio: "ignore" }); } catch {}
  try { execFileSync("/bin/kill", ["-9", String(fresh.pid)], { stdio: "ignore" }); } catch {}
  let frozen = false;
  let n1 = mockRounds(c2dMockDir).length;
  for (let i = 0; i < 6; i++) {
    await sleep(2500);
    const n2 = mockRounds(c2dMockDir).length;
    if (n2 === n1) { frozen = true; break; }
    n1 = n2;
  }
  ok(`S1 attempt ${attempt} THE RAW KILL LANDED — the rounds froze (silence is death)`, frozen, `${n1} rounds frozen`);
  if (!frozen) continue;
  if (n1 >= 17) { ok(`S1 attempt ${attempt} the freeze is the run's natural finish (17 rounds), not the kill`, false, "too late — retrying"); continue; }
  const rowNow = jobs().find((x) => x.id === c2d.id);
  if (rowNow?.status !== "running") { ok(`S1 attempt ${attempt} the row still RUNNING (the stop needs the blind window)`, false, String(rowNow?.status)); continue; }
  const rowsAtKill = journalRowsFor(fresh.id);
  ok(`S1 attempt ${attempt} THE LEDGER NEVER MET THE JOB — no accounting row for slurm ${fresh.id} (the raw kill's own silence)`, rowsAtKill.length === 0, rowsAtKill.join(" ; ").slice(0, 100) || "journal silent");

  /* THE REFUSED STOP — the API door, seconds after the kill, no GET
   * between (the vanish-steal law) */
  const stopP = api("POST", `/api/jobs/${c2d.id}/stop`);
  if (stopP.error && !stopP.outcome) {
    ok(`S1 attempt ${attempt} THE STOP FIRED on the live row (no 409 — the sweep never ticked)`, false, JSON.stringify(stopP).slice(0, 110));
    continue;
  }
  ok(`S1 attempt ${attempt} THE STOP FIRED on the live row (no 409 — the sweep never ticked)`, true, "");
  ok(`S1 attempt ${attempt} THE RECEIPT'S CLASS: stopped=false, outcome='missed', settled=null`, stopP.stopped === false && stopP.outcome === "missed" && stopP.settled === null, `stopped=${stopP.stopped} outcome=${stopP.outcome} settled=${stopP.settled}`);
  ok(`S1 attempt ${attempt} THE MESSAGE NAMES THE MISS ('scancel' + the mock's 'already finished')`, String(stopP.message ?? "").includes("scancel") && String(stopP.message ?? "").includes("already finished"), String(stopP.message ?? "none").slice(0, 140));
  const rowWord = stopP.job?.result ?? "";
  ok(`S1 attempt ${attempt} THE ROW'S WORD verbatim (the route's refused miss, the durable surface)`, stopP.job?.status === "failed" && rowWord === REFUSED_ROW, `${stopP.job?.status}/${String(rowWord ?? "none").slice(0, 110)}`);
  const recStop = readRecord(c2d.id);
  ok(`S1 attempt ${attempt} THE DEFERRING STAMP verbatim (done, NO exit code)`, recStop?.done === true && recStop?.result === REFUSED_STAMP && (recStop?.exitCode ?? null) === null, `done=${recStop?.done} exit=${recStop?.exitCode ?? "none"}`);
  ok(`S1 attempt ${attempt} THE QUESTION OPEN — missed:true, NO class field (the refused shape)`, recStop?.remote?.accountingPending?.missed === true && recStop?.remote?.accountingPending?.class === undefined, JSON.stringify(recStop?.remote?.accountingPending ?? null));
  arc = {
    slurmId: fresh.id,
    pid: fresh.pid,
    attempt,
    openedAt: recStop?.remote?.accountingPending?.at ?? Date.now(),
    rowWordAtStop: rowWord,
    killAt: new Date().toISOString(),
  };
  break;
}
if (!arc) { console.log("FATAL: the refused stop never landed — aborting"); writeReceipt({ fatal: "refused stop never landed" }); process.exit(2); }

/* THE WIRE STAYS UP */
const connsAfter = connections();
ok("S1 THE WIRE STAYS UP — exactly one Mock Cluster at its standing id", connsAfter.length === 1 && connsAfter[0]?.id === STANDING_CONN_ID, `conns=${connsAfter.length} id=${connsAfter[0]?.id ?? "none"}`);

/* the stop-time snapshots (the t938 law: the patience is judged in deltas) */
const recSnap = readRecord(c2d.id);
const slurmStateAtStop = recSnap?.remote?.slurmState ?? null;
const rowSnapGet = jobs().find((x) => x.id === c2d.id);
let manifestAtStop = null;
let manifestCountAtStop = 0;
try {
  const man = JSON.parse(readFileSync(path.join(recSnap?.workdir ?? "", ".cf-remote-manifest.json"), "utf8"));
  manifestAtStop = man?.writtenAt ?? null;
  manifestCountAtStop = man?.files?.length ?? 0;
} catch {}
const auditBase = consultCount(arc.slurmId);
ok("S1 the stop-time snapshots taken (slurmState residue + manifest writtenAt/count + the audit baseline)", true, `state=${slurmStateAtStop ?? "none"} manifest=${manifestAtStop ?? "none"} files=${manifestCountAtStop} consults=${auditBase}`);
ok("S1 THE MANIFEST RESIDUE STANDS at stop time (the t333 keep-set: the manifest survives the re-dispatch; its count is the dispatch's own prune-truth — EMPTY here: the re-dispatch's local ledger prune, the t937 files:[] shape witnessed as the prune's own word)", typeof manifestAtStop === "string", `${manifestCountAtStop} files · writtenAt ${manifestAtStop ?? "none"}`);
ok("S1 the row's word from the GET matches the receipt's hand (the flip stood)", rowSnapGet?.status === "failed" && rowSnapGet?.result === arc.rowWordAtStop, `${rowSnapGet?.status}/${String(rowSnapGet?.result ?? "none").slice(0, 90)}`);

/* THE DEAF LEVER — the remote workdir moved aside; the wire UP, the local
 * workdir stays (the leg's existsSync gate passes — the find goes DEAF,
 * not SKIPPED). Nothing enumerates during the aside: the finalize never
 * ran (the raw kill's law), the outputs question is not open yet. */
const rw = recSnap?.remote?.remoteWorkdir ?? "";
const localWorkdir = recSnap?.workdir ?? "";
const hostDir = rw.startsWith("/projects/cryoflow/") ? path.join(MOCK_FS, rw) : null;
const asideDir = hostDir ? `${hostDir}.t939-aside` : null;
ok("S1 THE RECORD NAMES THE REMOTE WORKDIR (under the mock's /projects/cryoflow root)", !!hostDir, rw);
ok("S1 THE LOCAL WORKDIR EXISTS (the leg's gate will pass)", !!localWorkdir && existsSync(localWorkdir), localWorkdir.slice(-40));
ok("S1 THE HOST-SIDE REMOTE WORKDIR EXISTS (the mock's fs is the project tree)", !!hostDir && existsSync(hostDir), String(hostDir).slice(-50));
if (!hostDir || !existsSync(hostDir) || !localWorkdir || !existsSync(localWorkdir)) {
  console.log("FATAL: the lever's precondition failed — aborting");
  writeReceipt({ fatal: "lever precondition", rw, localWorkdir });
  process.exit(2);
}
sh(`mv '${hostDir}' '${asideDir}'`);
ok("S1 THE LEVER THROWN — the remote workdir aside, the wire UP (the find will fail, not skip)", !existsSync(hostDir) && existsSync(asideDir), `aside=${String(asideDir).split("/").pop()}`);

/* THE SILENCE HOLDS */
await sleep(12_000);
const rowsAfter = journalRowsFor(arc.slurmId);
ok("S1 THE SILENCE HOLDS — still no accounting row 12s past the death", rowsAfter.length === 0, rowsAfter.join(" ; ").slice(0, 100) || "journal silent");
ok("S1 THE DEV LOG INNOCENT at patience zero (no expiry, no outputs line of any shape)", noConnLines().length === LOG_BASE.noconn && silentLines() === LOG_BASE.silent && logStat(ROUND_FAIL).count === LOG_BASE.roundfail && logStat(ROUND_LANDED).count === LOG_BASE.landed, `rf=${logStat(ROUND_FAIL).count}/${LOG_BASE.roundfail} landed=${logStat(ROUND_LANDED).count}/${LOG_BASE.landed}`);

writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, standingConnId: STANDING_CONN_ID, slurmStateAtStop, manifestAtStop, manifestCountAtStop, auditBase, logBase: LOG_BASE, localWorkdir, hostDir, asideDir, ...arc });
writeReceipt({ stage1: { pass, fail, slurmId: arc.slurmId, openedAt: arc.openedAt, standingConnId: STANDING_CONN_ID, lever: "thrown" } });
console.log(`== t939 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_SMID) {
/* ====================== stage 2mid ========================================
 * THE MID-PATIENCE PIN (~T+5min): the patience is real, the lever still
 * thrown, the SSH tax real. */
console.log("== stage 2mid: the patience held halfway, the lever still thrown ==");
const stm = readState();
const c2dIdM = stm.c2dId;
if (!c2dIdM || !stm.openedAt) { console.log("FATAL(stage2mid): no state — run stage1 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);
await paceUntil(stm.openedAt + Math.floor(PATIENCE_MS / 2));
const recMid = readRecord(c2dIdM);
ok("S2M THE QUESTION STILL OPEN at mid-patience (the patience is real, not instant)", !!recMid?.remote?.accountingPending && recMid.remote.accountingPending.missed === true && recMid.remote.accountingPending.class === undefined, JSON.stringify(recMid?.remote?.accountingPending ?? null));
ok("S2M THE STAMP STANDS at mid-patience (done, NO exit code)", recMid?.done === true && recMid?.result === REFUSED_STAMP && (recMid?.exitCode ?? null) === null, `exit=${recMid?.exitCode ?? "none"}`);
const rowMid = jobs().find((x) => x.id === c2dIdM);
ok("S2M THE ROW'S WORD STANDS at mid-patience (unchanged since the receipt)", rowMid?.status === "failed" && rowMid?.result === stm.rowWordAtStop, `${rowMid?.status}/${String(rowMid?.result ?? "none").slice(0, 90)}`);
ok("S2M THE DEV LOG INNOCENT at mid-patience (no expiry, no outputs line)", noConnLines().length === (stm.logBase?.noconn ?? 0) && silentLines() === (stm.logBase?.silent ?? 0) && logStat(ROUND_FAIL).count === (stm.logBase?.roundfail ?? 0), `rf=${logStat(ROUND_FAIL).count}/${stm.logBase?.roundfail ?? 0}`);
ok("S2M THE OUTPUTS QUESTION NOT YET OPEN (the landing alone opens it)", !recMid?.remote?.outputsLedgerPending, `outputsLedgerPending=${String(recMid?.remote?.outputsLedgerPending)}`);
const taxMid = consultCount(String(stm.slurmId));
ok("S2M THE SSH TAX IS REAL at mid-patience — the consult asking the wire (empty), grown past the baseline", taxMid > (stm.auditBase ?? 0), `consults=${taxMid} (baseline ${stm.auditBase ?? 0})`);
const rowsMid = journalRowsFor(String(stm.slurmId));
ok("S2M THE LEDGER STILL SILENT at mid-patience (the absence is not a lag that heals)", rowsMid.length === 0, rowsMid.join(" ; ").slice(0, 100) || "journal silent");
ok("S2M THE LEVER STILL THROWN — the remote workdir still aside (the find cannot answer even if the question opened)", stm.hostDir && !existsSync(stm.hostDir) && existsSync(stm.asideDir), "");
writeReceipt({ stage2mid: { pass, fail, at: new Date().toISOString(), taxMid } });
console.log(`== t939 stage2mid ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2mid") process.exit(fail === 0 ? 0 : 1);
} /* end stage2mid */

if (RUN_S2) {
/* ====================== stage 2 ===========================================
 * THE EXPIRY's empty landing opens the outputs question; THE THREE
 * STRIKES spend the budget; the question closes wholesale; the wire's
 * courtesy restore. */
console.log("== stage 2: the expiry, the silence's own question, the three strikes ==");
const st2 = readState();
const c2dId = st2.c2dId;
const SLURM_ID = String(st2.slurmId ?? "");
if (!c2dId || !st2.openedAt) { console.log("FATAL(stage2): no state — run stage1 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);

await paceUntil(st2.openedAt + PATIENCE_MS + 8_000);
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
ok("S2 THE EXPIRY LANDED — the question closed past the patience (the no-row branch's own fingerprint)", !!recExp, recExp ? "" : "the question never closed in 180s");
if (!recExp) { console.log("FATAL(stage2): the expiry never landed — aborting"); writeReceipt({ fatal: "expiry never landed", stage2: { pass, fail } }); process.exit(2); }

const silentBase = st2.logBase?.silent ?? 0;
const silentNow = silentLines();
ok("S2 THE DEV LOG'S LINE VERBATIM ('…expired unheard (the ledger stayed silent)…')", silentNow === silentBase + 1, `silent=${silentNow}/${silentBase}`);
{
  const lastLine = sh(`rg "expired unheard \\\\(the ledger stayed silent\\\\)" ${DEV_LOG} | tail -1`);
  ok("S2 THE LINE'S BODY verbatim (the product's own sentence)", lastLine.includes(SILENT_LINE), lastLine.slice(-150));
}
ok("S2 THE NO-CONN VARIANT NEVER SPOKE (the wire answered, empty, the whole way)", noConnLines().length === (st2.logBase?.noconn ?? 0), `noconn=${noConnLines().length}/${st2.logBase?.noconn ?? 0}`);
ok("S2 NO NEW WORDS — the stamp byte-identical (the receipt's own knowledge is the final word)", recExp?.result === REFUSED_STAMP, String(recExp?.result ?? "none").slice(0, 110));
ok("S2 NO EXIT CODE EARNED (a missed kill still claims nothing)", (recExp?.exitCode ?? null) === null, `exit=${recExp?.exitCode ?? "none"}`);
ok("S2 NO NEW LEDGER WORD (the live-phase slurmState residue UNTOUCHED)", recExp?.remote?.slurmState === (st2.slurmStateAtStop ?? null), `state=${recExp?.remote?.slurmState ?? "none"}`);
ok("S2 THE SILENCE'S OWN QUESTION OPENED (outputsLedgerPending:true — the t626 law spares nothing)", recExp?.remote?.outputsLedgerPending === true, `outputsLedgerPending=${String(recExp?.remote?.outputsLedgerPending)}`);
const rowExp = jobs().find((x) => x.id === c2dId);
ok("S2 THE ROW UNTOUCHED by the expiry (failed + the stop-time word, byte-identical)", rowExp?.status === "failed" && rowExp?.result === st2.rowWordAtStop, `${rowExp?.status}/${String(rowExp?.result ?? "none").slice(0, 90)}`);

/* THE THREE STRIKES — paced by the 30s floor, driven by the reaper and
 * these GETs; the deaf find's `cd` fails → exit non-zero → one strike. */
console.log("-- S2 the three strikes (the 30s floor paces the deaf rounds) --");
const strike1 = await (async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 150_000) {
    try { jobs(); } catch {}
    const rec = readRecord(c2dId);
    if ((rec?.remote?.outputsLedgerTries ?? 0) >= 1) return rec;
    await sleep(1800);
  }
  return null;
})();
const rf1 = logStat(ROUND_FAIL);
ok("S2 STRIKE ONE — the record's tries climbed to 1", (strike1?.remote?.outputsLedgerTries ?? 0) === 1, `tries=${JSON.stringify(strike1?.remote?.outputsLedgerTries ?? null)}`);
ok("S2 STRIKE ONE — the dev log's round-failed line (+1 vs baseline), the err body captured", rf1.count === (st2.logBase?.roundfail ?? 0) + 1 && rf1.last.includes(`"${NAME_CLASS2D}"`), rf1.last.slice(0, 170));
ok("S2 STRIKE ONE — the question STAYS OPEN (the tail's own words)", rf1.last.includes(STAYS_OPEN_TAIL) && !rf1.last.includes("closes after"), rf1.last.slice(-60));
ok("S2 STRIKE ONE — the question still stands on the record", strike1?.remote?.outputsLedgerPending === true, `pending=${JSON.stringify(strike1?.remote?.outputsLedgerPending ?? null)}`);

const strike2 = await (async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 150_000) {
    try { jobs(); } catch {}
    const rec = readRecord(c2dId);
    if ((rec?.remote?.outputsLedgerTries ?? 0) >= 2) return rec;
    await sleep(1800);
  }
  return null;
})();
const rf2 = logStat(ROUND_FAIL);
ok("S2 STRIKE TWO — the record's tries climbed to 2", (strike2?.remote?.outputsLedgerTries ?? 0) === 2, `tries=${JSON.stringify(strike2?.remote?.outputsLedgerTries ?? null)}`);
ok("S2 STRIKE TWO — the dev log's round-failed line (+2 vs baseline), still the stays-open tail", rf2.count === (st2.logBase?.roundfail ?? 0) + 2 && rf2.last.includes(STAYS_OPEN_TAIL), rf2.last.slice(0, 170));

const strike3 = await (async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 180_000) {
    try { jobs(); } catch {}
    const ls = logStat(ROUND_FAIL);
    if (ls.count >= (st2.logBase?.roundfail ?? 0) + 3 && ls.last.includes(DOORS_WORD)) return { rec: readRecord(c2dId), line: ls.last };
    await sleep(1800);
  }
  return null;
})();
const rf3 = logStat(ROUND_FAIL);
ok("S2 STRIKE THREE — THE DEV LOG SPEAKS THE NEVER-SPOKEN WORDS verbatim (the closes tail)", !!strike3 && rf3.count === (st2.logBase?.roundfail ?? 0) + 3 && rf3.last.includes(DOORS_WORD), rf3.last.slice(0, 210));
ok("S2 STRIKE THREE — THE QUESTION CLOSED WHOLESALE on the record (outputsLedgerPending undefined, outputsLedgerTries undefined)", strike3?.rec?.remote?.outputsLedgerPending === undefined && strike3?.rec?.remote?.outputsLedgerTries === undefined, `pending=${JSON.stringify(strike3?.rec?.remote?.outputsLedgerPending ?? null)} tries=${JSON.stringify(strike3?.rec?.remote?.outputsLedgerTries ?? null)}`);
ok("S2 THE FIND NEVER ANSWERED (no landed line through the whole arc)", logStat(ROUND_LANDED).count === (st2.logBase?.landed ?? 0), `landed Δ=${logStat(ROUND_LANDED).count - (st2.logBase?.landed ?? 0)}`);
ok("S2 THE STAMP STILL STANDS after the strikes (the tries lane heals nothing on the record)", strike3?.rec?.result === REFUSED_STAMP && (strike3?.rec?.exitCode ?? null) === null, String(strike3?.rec?.result ?? "none").slice(0, 80));

/* THE WIRE'S COURTESY RESTORE — the workdir comes back, and the question
 * STAYS closed: the leg never runs again. */
if (st2.hostDir && !existsSync(st2.hostDir) && existsSync(st2.asideDir)) {
  sh(`mv '${st2.asideDir}' '${st2.hostDir}'`);
}
ok("S2 THE WIRE'S COURTESY RESTORE — the remote workdir back (the find COULD answer now; the question is closed)", existsSync(st2.hostDir) && !existsSync(st2.asideDir), "");

writeState({ ...st2, expiryDone: true, strikesDone: true });
writeReceipt({ stage2: { pass, fail, strikes: { s1: rf1.last, s2: rf2.last, s3: rf3.last }, expiryLine: SILENT_LINE } });
console.log(`== t939 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

if (RUN_S3) {
/* ========================= stage 3 =======================================
 * THE DOORS' HONEST SHAPE + THE FAILED FACE + THE STANDING LEAVE. */
console.log("== stage 3: the shut doors' honest shape, the failed face, the standing leave ==");
const st3 = readState();
const c2dId = st3.c2dId;
if (!c2dId || !st3.strikesDone) { console.log("FATAL(stage3): no state or the strikes have not landed — run stages 1–2 first"); process.exit(2); }

/* a defensive restore: if a crashed stage left the aside, put it back */
if (st3.hostDir && existsSync(st3.asideDir) && !existsSync(st3.hostDir)) {
  try { sh(`mv '${st3.asideDir}' '${st3.hostDir}'`); } catch {}
}

const rec0 = readRecord(c2dId);
ok("S3 the question still closed on the record (stage2's close stands)", rec0?.remote?.outputsLedgerPending === undefined && rec0?.remote?.outputsLedgerTries === undefined, `pending=${JSON.stringify(rec0?.remote?.outputsLedgerPending ?? null)} tries=${JSON.stringify(rec0?.remote?.outputsLedgerTries ?? null)}`);
const bRound3 = logStat(ROUND_FAIL).count;
const bLanded3 = logStat(ROUND_LANDED).count;

/* THE DOORS-STAY-SHUT WATCH: the wire up, the workdir back, 70s of paced
 * GETs (two reaper beats + one 30s floor interval) — and NO outputs line
 * grows: the closed question cannot strike, cannot land. */
console.log("-- S3 the doors-stay-shut watch (70s: the floor interval passes twice over) --");
{
  const t0 = Date.now();
  while (Date.now() - t0 < 70_000) {
    try { jobs(); } catch {}
    await sleep(2200);
  }
}
ok("S3 THE CLOSED QUESTION CANNOT STRIKE (no new round-failed line through the watch)", logStat(ROUND_FAIL).count === bRound3, `Δ=${logStat(ROUND_FAIL).count - bRound3}`);
ok("S3 THE CLOSED QUESTION CANNOT LAND (no new landed line — the leg never ran again, even with the wire up and the workdir back)", logStat(ROUND_LANDED).count === bLanded3, `Δ=${logStat(ROUND_LANDED).count - bLanded3}`);

/* THE MANIFEST IS STILL — the closed question cannot rewrite the ledger;
 * judged by deltas from the stop-time residue (the t937 law) */
let man = null;
try { man = JSON.parse(readFileSync(path.join(st3.localWorkdir, ".cf-remote-manifest.json"), "utf8")); } catch {}
ok("S3 THE MANIFEST RESIDUE STILL STANDS (the local workdir's ledger never moved)", !!man, st3.localWorkdir?.slice(-40));
ok("S3 THE MANIFEST IS STILL — writtenAt byte-identical from the stop-time residue (the closed question cannot rewrite the ledger)", man?.writtenAt === st3.manifestAtStop, `now=${man?.writtenAt ?? "none"} at-stop=${st3.manifestAtStop ?? "none"}`);
ok("S3 THE LEDGER IS THE PAST'S — its writtenAt predates the arc's question (the re-dispatch's own prune, kept alive by the t333 keep-set)", typeof man?.writtenAt === "string" && Date.parse(man.writtenAt) < (st3.openedAt ?? 0), `writtenAt=${man?.writtenAt ?? "none"} < openedAt=${new Date(st3.openedAt ?? 0).toISOString()}`);
ok("S3 THE LEDGER'S COUNT UNCHANGED (the stale ledger's own files, neither grown nor pruned)", (man?.files?.length ?? 0) === (st3.manifestCountAtStop ?? 0), `${man?.files?.length ?? 0}/${st3.manifestCountAtStop ?? 0}`);

/* THE ON-DEMAND DOORS' HONEST SHAPE — branched on the residue's own
 * count: the route treats an EMPTY ledger as no ledger (the 400 refusal)
 * and a NON-EMPTY stale ledger as the past's authorization (the 200 with
 * the past's pulls). Either way the doors cannot see the present. */
if ((st3.manifestCountAtStop ?? 0) === 0) {
  const syncP0 = api("POST", `/api/jobs/${c2dId}/outputs/sync`, { paths: ["note.txt"] });
  ok("S3 THE ON-DEMAND DOOR STAYS SHUT — the route treats the EMPTY ledger as no ledger (400, the route's own word)", syncP0?.error === "No remote manifest for this job", JSON.stringify(syncP0).slice(0, 120));
  writeReceipt({ stage3Door: { shape: "empty-ledger-400", refusal: syncP0?.error ?? null } });
} else {
  const probePath = man?.files?.[0]?.path ?? "note.txt";
  const syncP = api("POST", `/api/jobs/${c2dId}/outputs/sync`, { paths: [probePath] });
  ok(`S3 THE BATCH DOOR OPENS ON THE PAST'S LEDGER ('${probePath}' rides the stale authorization)`, syncP?.ok === true && Array.isArray(syncP?.results) && syncP.results.length === 1, JSON.stringify(syncP).slice(0, 140));
  ok("S3 THE DOOR'S VERDICT IS THE PAST'S OWN (the residue-named file answers from the past's pulls — no new naming, no new fetch of the present)", syncP?.results?.[0]?.path === probePath && syncP.results[0].ok === true, JSON.stringify(syncP?.results?.[0] ?? null).slice(0, 110));
  ok("S3 THE DOOR SERVES THE STALE LEDGER'S COUNT (total = the residue's files — the present's frozen round is invisible to it)", syncP?.total === (st3.manifestCountAtStop ?? 0), `total=${String(syncP?.total ?? "none")}/${st3.manifestCountAtStop ?? 0}`);
  writeReceipt({ stage3Door: { shape: "stale-ledger-200", probe: probePath, total: syncP?.total ?? null } });
}

/* THE ROW'S WORD UNTOUCHED through the whole tries arc (the manifest leg
 * heals nothing — the tries side's testimony) */
const rowAfter = jobs().find((x) => x.id === c2dId);
ok("S3 THE ROW STILL FAILED with the stop's word byte-identical (the stop's knowledge outlives the ledger's silence)", rowAfter?.status === "failed" && rowAfter?.result === st3.rowWordAtStop, `${rowAfter?.status}/${String(rowAfter?.result ?? "none").slice(0, 90)}`);
const recAfter = readRecord(c2dId);
ok("S3 THE RECORD'S STAMP UNTOUCHED through the strikes and the watch", recAfter?.result === REFUSED_STAMP && (recAfter?.exitCode ?? null) === null && recAfter?.remote?.slurmState === (st3.slurmStateAtStop ?? null), String(recAfter?.result ?? "none").slice(0, 80));

/* THE FAILED FACE: the warm-up reload law, the search, the Overview
 * climb — the card speaks the refused miss, no Stop verb, Re-run stands */
let carded = null;
for (let i = 0; i < 3 && !carded; i++) {
  sh(`${AB} open ${BASE}/`);
  carded = await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 40, 600);
  await sleep(800);
}
ok("S3 the workspace renders (the cards on the page — the warm-up reload law)", !!carded && carded.cards >= 3, `cards=${carded?.cards ?? "none"}`);
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
let ov3 = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
let face3 = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ miss: t.includes(${JSON.stringify(REFUSED_ROW.slice(0, 40))}), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`,
  (v) => v.miss === true, 12, 500,
);
ok("S3 the Overview climb clicked", String(ov3).startsWith("clicked@"), String(ov3));
ok("S3 THE FAILED FACE SPEAKS THE MISS (the stop's knowledge, on the card)", face3?.miss === true);
ok("S3 THE FAILED FACE HAS NO STOP VERB (Re-run stands where Stop stood)", face3?.stopBtn === false && face3?.rerun === true, `stop=${face3?.stopBtn} rerun=${face3?.rerun}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

/* the restore: the manifest-word binding law, the t916 remove, the
 * unbound leave, the seed trio + 2 edges */
const mBinding = manifestBinding();
const rebind3 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: mBinding });
ok(`S3 THE BINDING RETURNED TO THE MINT-TIME VALUE (the manifest's own word: ${mBinding === null ? "null — the unbound mint" : "the connection"})`, rebind3.ok === true, `m.binding=${String(mBinding).slice(0, 24)}`);
let removeOut = "(never ran)";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
ok("S3 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
const unbind3 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null });
ok("S3 THE STANDING LEAVE — unbound after the manifest is consumed (the t929/t930 law)", unbind3.ok === true, JSON.stringify(unbind3).slice(0, 60));
const jobsAfter = jobs();
const edgesAfter = edges();
ok("S3 the world back to the seed trio (3 jobs)", jobsAfter.length === 3, String(jobsAfter.length));
ok("S3 the world holds exactly 2 edges", edgesAfter.length === 2, String(edgesAfter.length));

/* the browser smoke */
sh(`${AB} open ${BASE}/`);
const smoke = await poll(
  `JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, overX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })`,
  (g) => g.cards >= 3, 30,
);
ok("S3 the browser smoke clean (3+ cards, overX 0)", !!smoke && smoke.cards >= 3 && smoke.overX === false, `cards=${smoke?.cards} overX=${smoke?.overX}`);

let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S3 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);
writeReceipt({ stage3: { pass, fail, doorsWatch: "silent", manifestStill: man?.writtenAt === st3.manifestAtStop, restore: "done" } });
console.log(`== t939 stage3 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage3") process.exit(fail === 0 ? 0 : 1);
} /* end stage3 */

console.log(`== t939 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
