#!/usr/bin/env node
/**
 * t938 — the expiry's SECOND variant: the ledger stayed silent.
 *
 * t937 witnessed the no-conn expiry ("expired unheard (no live
 * connection)") — the wire answered NOTHING, the !conn branch's patience
 * ran out, the EMPTY landing closed the question with no new words. The
 * OTHER expiry branch — the no-row branch (remote-run.ts ~line 8005) —
 * has never had a live fire: the wire UP, sacct ANSWERING (exit 0) and
 * still holding NO master row for the slurmId, tick after tick, past the
 * patience. "expired unheard (the ledger stayed silent)".
 *
 * THE HONEST ARC needs a slurmId the ledger never met. The t932 raw-kill
 * lever provides exactly that: /bin/kill -9 the launcher's process group
 * mid-flight — the process never reaches its post-script, the accounting
 * journal never learns the job existed ("2 rounds frozen, no accounting
 * row"). Then the t935 blind-window stop lands on the still-running row:
 * the mock's scancel answers "Job N has already finished" (exit 1, the
 * t935 faithfulness cure) → the REFUSED class — the receipt's miss, the
 * deferring stamp, the question open {at, missed:true} with NO class
 * field (the class rides the wire-down lane only — the refused shape).
 *
 * The wire never goes down. Every consult tick past the 20s floor asks
 * the wire (the SSH tax is REAL here — the no-conn variant waited at
 * scan cost only; this is the no-row variant's own signature), and sacct
 * answers EMPTY every time: exit 0, no master row, `!f` → wait.
 *
 * stage1 (~4 min): the mint re-rides, the bind, iterations=16, the park,
 *   the run, run_it001, THE RAW KILL (the rounds-freeze death proof), the
 *   journal's silence pinned host-side, THE REFUSED STOP through the API
 *   door (the t935 pins compactly re-ridden, the question's NO-class
 *   shape pinned), the wire verified UP, the stop-time snapshots taken.
 * stage2mid (~5 min): THE MID-PATIENCE PIN — the question still open,
 *   the words standing, the dev log innocent, the outputs question not
 *   yet open — and THE SSH TAX: the consult's own sacct grammar in the
 *   mock's exec-audit, grown past its stop-time baseline (the wire is
 *   being asked, and answers empty).
 * stage2 (~7 min): THE EXPIRY past ACCOUNTING_BACKFILL_PATIENCE_MS — the
 *   dev log's line verbatim ("…expired unheard (the ledger stayed
 *   silent) — the stop receipt's stamp stands"), the no-conn variant
 *   never speaking, the EMPTY landing's facts (no words, no exit, the
 *   residue untouched), the outputs question opened — AND ANSWERED
 *   THROUGH THE LIVE WIRE (the manifest leg needs no re-created wire
 *   here: the find names the raw-killed run's partial files, the landing
 *   line lands, the row still failed — the manifest leg heals nothing).
 * stage3 (~4 min): the failed face (the refused miss words on the card,
 *   no Stop verb, Re-run stands), the restore (the binding's manifest
 *   word, the t916 remove, the unbound leave), the seed trio + 2 edges,
 *   the doctor CLEAN, the registry at exactly ONE Mock Cluster.
 *
 *   node scripts/t938-ledger-silent-expiry-witness.mjs stage1|stage2mid|stage2|stage3|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t938-ledger-silent-expiry-witness.json";
const STATE = path.join(ROOT, "data", "t938-ledger-silent.json");
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

/* the product's own words (the stop route's refused branches, verbatim) */
const REFUSED_STAMP = "stop missed — no live cluster session found; the cluster ledger decides the final state";
const REFUSED_ROW = "stop missed (no live cluster session found) — the cluster ledger decides the final state when the run's records come home";
/* the expiry's dev log line (remote-run.ts, the no-row branch) */
const SILENT_LINE = `the accounting question for "${NAME_CLASS2D}" expired unheard (the ledger stayed silent) — the stop receipt's stamp stands`;

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
const journalRowsFor = (id) => {
  try {
    return readFileSync(path.join(SLURM_DIR, "accounting"), "utf8")
      .trim().split("\n").filter(Boolean).filter((l) => l.startsWith(`${id}|`));
  } catch { return []; }
};
/* the consult's OWN sacct grammar (remote-run.ts ~7976), one exec per
 * consult tick — the alive-check ladder embeds its sacct inside a bigger
 * script whose line starts with the stale gate, so the line-initial
 * `sacct` matches ONLY the accounting consult's rounds (the SSH tax's
 * own testimony in the mock's exec-audit). shQuote leaves a bare numeric
 * id UNQUOTED — the quote is optional in this grammar (the first ride's
 * lesson: the audit said `-j 391`, not `-j '391'`). */
const consultCount = (id) => {
  try {
    const out = sh(`rg -c "^\\\\d+ sacct -j '?${id}'? -n -P -o JobID,State,ExitCode,Elapsed" ${SLURM_DIR}/exec-audit.log 2>/dev/null || echo 0`);
    return Number(String(out).trim().split("\n").pop()) || 0;
  } catch { return 0; }
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
/* the dev log's testimony — host-side tails, every pin RELATIVE to a
 * baseline captured at prep (the t937 law: the log outlives the arc) */
const noConnLines = () => {
  try { return sh(`rg "expired unheard \\\\(no live connection\\\\)" ${DEV_LOG} | tail -5`).split("\n").filter(Boolean); }
  catch { return []; }
};
const silentLines = () => {
  try { return sh(`rg -c "expired unheard \\\\(the ledger stayed silent\\\\)" ${DEV_LOG} 2>/dev/null || echo 0`).split("\n").pop() * 1; }
  catch { return 0; }
};
const outputsLandedLines = () => {
  try { return sh(`rg "the outputs ledger landed for" ${DEV_LOG} | tail -5`).split("\n").filter(Boolean); }
  catch { return []; }
};

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_S2 = STAGE === "main" || STAGE === "stage2" || STAGE === "stage2mid";
const RUN_S3 = STAGE === "main" || STAGE === "stage3";

/* ============================ prep ======================================== */
console.log(`== t938 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

/* the dev log's BASELINES — the log outlives the arc (previous windows'
 * lines still hang there); every later log pin is RELATIVE to these */
const LOG_BASE = { noconn: noConnLines().length, silent: silentLines(), landed: outputsLandedLines().length };
ok("prep the dev log baselines captured", true, `noconn=${LOG_BASE.noconn} silent=${LOG_BASE.silent} landed=${LOG_BASE.landed}`);

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * THE RAW KILL (the ledger never meets the job), then THE REFUSED STOP
 * (the blind window, the wire up): the question opens and the patience
 * begins with a wire that ANSWERS — empty. */
console.log("== stage 1: the raw kill, the refused stop, the patience begun with a silent ledger ==");

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

/* the standing wire — NO cut in this arc: the no-row branch's honest
 * precondition is a connection that ANSWERS (empty), not a missing one */
const snap = (() => {
  const c = connections().find((x) => x.name === "Mock Cluster");
  if (!c) return null;
  const { hasPassword, hasPassphrase, runResume, ...rest } = c;
  return rest;
})();
ok("S1 the Mock Cluster connection standing (the wire the consult will ask)", !!snap?.id && snap?.host === MOCK_WIRE.host && Number(snap?.port) === MOCK_WIRE.port, `${snap?.id} ${snap?.host}:${snap?.port}`);
if (!snap?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const STANDING_CONN_ID = snap.id;

/* the t300 binding door — the dispatch below rides the binding's lane */
const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: STANDING_CONN_ID });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok("S1 the class2d's iterations pinned at 16 through the PATCH door (the kill's window)", !!patchP.job?.id && String(patchP.job?.params?.iterations) === "16", JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

/* the blind window: the browser parks on about:blank — the UI's own poll
 * is a sweep driver, and ONE GET between the kill and the stop would let
 * the vanish ladder start its verdicts against a row the stop still needs
 * RUNNING (the park is the t935/t937 law) */
sh(`${AB} open about:blank`);
await sleep(600);

let arc = null;
for (let attempt = 1; attempt <= 3 && !arc; attempt++) {
  console.log(`-- S1 silent-ledger attempt ${attempt} --`);
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S1 attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  ok(`S1 attempt ${attempt} the bare POST accepted (the binding's lane)`, true, "");
  const fresh = await freshPid();
  if (!fresh?.pid) { ok(`S1 attempt ${attempt} the launcher pid found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid read (slurm ${fresh.id}, pid ${fresh.pid})`, true, "");
  /* a little mid-flight depth: run_it001 on the floor before the kill */
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

  /* THE RAW KILL — the process group, no scancel, no accounting row.
   * /bin/kill THE REAL BINARY (the t932 law: the shell builtin mishandles
   * the negative-pid form and orphans the stub). The launcher dies before
   * its post-script — the journal never learns the job existed. */
  try { execFileSync("/bin/kill", ["-9", "--", `-${fresh.pid}`], { stdio: "ignore" }); } catch {}
  try { execFileSync("/bin/kill", ["-9", String(fresh.pid)], { stdio: "ignore" }); } catch {}
  /* THE DEATH IS PROVEN BY THE LADDER'S OWN CLOCK (the t932 law): the stub
   * writes a round every ~0.9s; two consecutive frozen reads prove death.
   * A natural finish also freezes — at SEVENTEEN; the count names which. */
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

  /* THE JOURNAL'S SILENCE — the no-row branch's honest precondition,
   * pinned host-side (the ledger never met this slurmId) */
  const rowsAtKill = journalRowsFor(fresh.id);
  ok(`S1 attempt ${attempt} THE LEDGER NEVER MET THE JOB — no accounting row for slurm ${fresh.id} (the raw kill's own silence)`, rowsAtKill.length === 0, rowsAtKill.join(" ; ").slice(0, 100) || "journal silent");

  /* THE REFUSED STOP — the API door, seconds after the kill; NO /api/jobs
   * GET in between (the vanish-steal law). The mock's scancel finds the
   * pid file but no live process: "already finished", exit 1 — the t935
   * faithfulness cure speaking the REAL scancel's word. */
  const stopP = api("POST", `/api/jobs/${c2d.id}/stop`);
  if (stopP.error && !stopP.outcome) {
    ok(`S1 attempt ${attempt} THE STOP FIRED on the live row (no 409 — the sweep never ticked)`, false, JSON.stringify(stopP).slice(0, 110));
    continue;
  }
  ok(`S1 attempt ${attempt} THE STOP FIRED on the live row (no 409 — the sweep never ticked)`, true, "");
  /* missClass is remoteStopRun's INTERNAL contract — the route's DTO only
   * carries stopped/outcome/message/settled; the refused class is spoken
   * through the message's own words + the question's class-absent shape
   * (both pinned below — the t937 receipt shape) */
  ok(`S1 attempt ${attempt} THE RECEIPT'S CLASS: stopped=false, outcome='missed', settled=null`, stopP.stopped === false && stopP.outcome === "missed" && stopP.settled === null, `stopped=${stopP.stopped} outcome=${stopP.outcome} settled=${stopP.settled}`);
  ok(`S1 attempt ${attempt} THE MESSAGE NAMES THE MISS — the scancel's failure and the mock's own word ('already finished')`, String(stopP.message ?? "").includes("scancel") && String(stopP.message ?? "").includes("already finished"), String(stopP.message ?? "none").slice(0, 140));
  /* THE ROW'S WORD — the route's own hand (the receipt's DTO; judged by
   * UNCHANGED-ness from here on — the either-honest-writer law) */
  const rowWord = stopP.job?.result ?? "";
  ok(`S1 attempt ${attempt} THE ROW'S WORD verbatim (the route's refused miss, the durable surface)`, stopP.job?.status === "failed" && rowWord === REFUSED_ROW, `${stopP.job?.status}/${String(rowWord ?? "none").slice(0, 110)}`);
  const recStop = readRecord(c2d.id);
  ok(`S1 attempt ${attempt} THE DEFERRING STAMP verbatim (done, NO exit code — a missed kill claims nothing)`, recStop?.done === true && recStop?.result === REFUSED_STAMP && (recStop?.exitCode ?? null) === null, `done=${recStop?.done} exit=${recStop?.exitCode ?? "none"} result=${String(recStop?.result ?? "none").slice(0, 80)}`);
  ok(`S1 attempt ${attempt} THE QUESTION OPEN — missed:true, and NO class field (the refused shape: the class rides the wire-down lane only)`, recStop?.remote?.accountingPending?.missed === true && recStop?.remote?.accountingPending?.class === undefined, JSON.stringify(recStop?.remote?.accountingPending ?? null));
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

/* THE WIRE STAYS UP — the arc's own precondition: the consult has a
 * connection to ask, and it answers (empty) */
const connsAfter = connections();
ok("S1 THE WIRE STAYS UP — exactly one Mock Cluster at its standing id (the no-row branch's honest precondition)", connsAfter.length === 1 && connsAfter[0]?.id === STANDING_CONN_ID, `conns=${connsAfter.length} id=${connsAfter[0]?.id ?? "none"}`);

/* the stop-time snapshots the patience will be judged against: the
 * monitor's live-phase slurmState residue, the manifest's writtenAt (the
 * mint's own finalize residue), and the consult's audit baseline (the
 * consult can only fire once the question exists — 0, or at most the
 * background beat's own first tick that raced the read) */
const recSnap = readRecord(c2d.id);
const slurmStateAtStop = recSnap?.remote?.slurmState ?? null;
const rowSnapGet = jobs().find((x) => x.id === c2d.id); /* one GET: the sweep tick settles any mint-finalize race */
let manifestAtStop = null;
try { manifestAtStop = JSON.parse(readFileSync(path.join(recSnap?.workdir ?? "", ".cf-remote-manifest.json"), "utf8"))?.writtenAt ?? null; } catch {}
const auditBase = consultCount(arc.slurmId);
ok("S1 the stop-time snapshots taken (slurmState residue + manifest writtenAt + the consult's audit baseline)", true, `state=${slurmStateAtStop ?? "none"} manifest=${manifestAtStop ?? "none"} consults=${auditBase}`);
ok("S1 the row's word from the GET matches the receipt's hand (the flip stood)", rowSnapGet?.status === "failed" && rowSnapGet?.result === arc.rowWordAtStop, `${rowSnapGet?.status}/${String(rowSnapGet?.result ?? "none").slice(0, 90)}`);

/* THE SILENCE HOLDS: the launcher is dead, nobody journals — the ledger's
 * silence is not a lag, it is the honest absence the raw kill wrote */
await sleep(12_000);
const rowsAfter = journalRowsFor(arc.slurmId);
ok("S1 THE SILENCE HOLDS — still no accounting row 12s past the death (the ledger will answer empty, tick after tick)", rowsAfter.length === 0, rowsAfter.join(" ; ").slice(0, 100) || "journal silent");
ok("S1 THE DEV LOG INNOCENT at patience zero (no expiry of EITHER variant has spoken — the baselines hold)", noConnLines().length === LOG_BASE.noconn && silentLines() === LOG_BASE.silent, `noconn=${noConnLines().length}/${LOG_BASE.noconn} silent=${silentLines()}/${LOG_BASE.silent}`);

writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, standingConnId: STANDING_CONN_ID, snap, slurmStateAtStop, manifestAtStop, auditBase, logBase: LOG_BASE, ...arc });
writeReceipt({ stage1: { pass, fail, slurmId: arc.slurmId, openedAt: arc.openedAt, standingConnId: STANDING_CONN_ID } });
console.log(`== t938 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_S2) {
/* ====================== stage 2mid + stage 2 ==============================
 * THE PATIENCE + THE EXPIRY: ~10 minutes of blind-window discipline —
 * the browser parked, the sweep paced by deliberate GETs past the 20s
 * consult floor — the SSH tax REAL the whole way (the wire answers,
 * empty). Then the no-row branch's expiry, the EMPTY landing, and the
 * outputs leg's answer through the LIVE wire. */
console.log("== stage 2: the patience held, the tax paid, THE EXPIRY's empty landing, the live wire's answer ==");

const st2 = readState();
const c2dId = st2.c2dId;
const SLURM_ID = String(st2.slurmId ?? "");
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
   * is still open halfway through, the words stand, the dev log
   * innocent, and THE SSH TAX IS REAL: the consult has been ASKING the
   * wire (the audit's consult-grammar lines grown past the baseline) */
  await paceUntil(openedAt + Math.floor(PATIENCE_MS / 2));
  const recMid = readRecord(c2dId);
  ok("S2 THE QUESTION STILL OPEN at mid-patience (the patience is real, not instant)", !!recMid?.remote?.accountingPending && recMid.remote.accountingPending.missed === true && recMid.remote.accountingPending.class === undefined, JSON.stringify(recMid?.remote?.accountingPending ?? null));
  ok("S2 THE STAMP STANDS at mid-patience (done, NO exit code)", recMid?.done === true && recMid?.result === REFUSED_STAMP && (recMid?.exitCode ?? null) === null, `exit=${recMid?.exitCode ?? "none"}`);
  const rowMid = jobs().find((x) => x.id === c2dId);
  ok("S2 THE ROW'S WORD STANDS at mid-patience (unchanged since the receipt)", rowMid?.status === "failed" && rowMid?.result === st2.rowWordAtStop, `${rowMid?.status}/${String(rowMid?.result ?? "none").slice(0, 90)}`);
  ok("S2 THE DEV LOG INNOCENT at mid-patience (no expiry of EITHER variant — the baselines hold)", noConnLines().length === (st2.logBase?.noconn ?? 0) && silentLines() === (st2.logBase?.silent ?? 0), `noconn=${noConnLines().length}/${st2.logBase?.noconn ?? 0} silent=${silentLines()}/${st2.logBase?.silent ?? 0}`);
  ok("S2 THE OUTPUTS QUESTION NOT YET OPEN at mid-patience (the landing alone opens it)", !recMid?.remote?.outputsLedgerPending, `outputsLedgerPending=${String(recMid?.remote?.outputsLedgerPending)}`);
  const taxMid = consultCount(SLURM_ID);
  ok("S2 THE SSH TAX IS REAL at mid-patience — the consult's own sacct grammar in the audit, grown past the stop-time baseline (the wire is being ASKED — the no-row variant's own signature)", taxMid > (st2.auditBase ?? 0), `consults=${taxMid} (baseline ${st2.auditBase ?? 0})`);
  const rowsMid = journalRowsFor(SLURM_ID);
  ok("S2 THE LEDGER STILL SILENT at mid-patience (the raw kill's absence is not a lag that heals)", rowsMid.length === 0, rowsMid.join(" ; ").slice(0, 100) || "journal silent");
  writeReceipt({ stage2mid: { pass, fail, at: new Date().toISOString(), taxMid } });
}
if (STAGE === "stage2mid") {
  console.log(`== t938 stage2mid ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* THE EXPIRY: past the patience, the next paced tick lands it — poll the
 * record host-side until the question closes */
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
ok("S2 THE EXPIRY LANDED — the question closed past the patience (the no-row branch's own fingerprint)", !!recExp, recExp ? "" : "the question never closed in 180s");
if (!recExp) { console.log("FATAL(stage2): the expiry never landed — aborting"); writeReceipt({ fatal: "expiry never landed", stage2: { pass, fail } }); process.exit(2); }

const silentBase = st2.logBase?.silent ?? 0;
const silentNow = silentLines();
ok("S2 THE DEV LOG'S LINE VERBATIM ('…expired unheard (the ledger stayed silent) — the stop receipt's stamp stands')", silentNow === silentBase + 1, `silent=${silentNow}/${silentBase}`);
{
  const lastLine = sh(`rg "expired unheard \\\\(the ledger stayed silent\\\\)" ${DEV_LOG} | tail -1`);
  ok("S2 THE LINE'S BODY verbatim (the product's own sentence)", lastLine.includes(SILENT_LINE), lastLine.slice(-150));
}
ok("S2 THE NO-CONN VARIANT NEVER SPOKE (the no-ROW branch, not the no-conn branch — the wire answered, empty, the whole way)", noConnLines().length === (st2.logBase?.noconn ?? 0), `noconn=${noConnLines().length}/${st2.logBase?.noconn ?? 0}`);
/* THE EMPTY LANDING'S FIRST FACT — NO NEW WORDS: the stamp survives
 * byte-identical, the exit stays absent, the ledger never spoke a state */
ok("S2 NO NEW WORDS — the stamp byte-identical (the receipt's own knowledge is the final word)", recExp?.result === REFUSED_STAMP, String(recExp?.result ?? "none").slice(0, 110));
ok("S2 NO EXIT CODE EARNED (a missed kill still claims nothing — the silence decided nothing)", (recExp?.exitCode ?? null) === null, `exit=${recExp?.exitCode ?? "none"}`);
ok("S2 NO NEW LEDGER WORD (the live-phase slurmState residue UNTOUCHED — the landing wrote no state of its own)", recExp?.remote?.slurmState === (st2.slurmStateAtStop ?? null), `state=${recExp?.remote?.slurmState ?? "none"} (stop-time ${st2.slurmStateAtStop ?? "none"})`);
ok("S2 NO LEDGER ELAPSED EARNED (the silence measured nothing)", recExp?.remote?.slurmElapsedMs == null, `elapsed=${String(recExp?.remote?.slurmElapsedMs ?? "none")}`);
/* THE EMPTY LANDING'S SECOND FACT — the outputs question opened by the
 * silence itself (the t626 law: EVERY landing path earns the question) */
ok("S2 THE SILENCE'S OWN QUESTION OPENED (outputsLedgerPending:true — the sync-back never ran for this run either)", recExp?.remote?.outputsLedgerPending === true, `outputsLedgerPending=${String(recExp?.remote?.outputsLedgerPending)}`);
/* the row: the empty landing touches nothing durable */
const rowExp = jobs().find((x) => x.id === c2dId);
ok("S2 THE ROW UNTOUCHED by the expiry (failed + the stop-time word, byte-identical)", rowExp?.status === "failed" && rowExp?.result === st2.rowWordAtStop, `${rowExp?.status}/${String(rowExp?.result ?? "none").slice(0, 90)}`);
const taxExp = consultCount(SLURM_ID);
ok("S2 THE TAX'S FULL ARC — the consult asked the wire again and again to the very end (the audit grew past mid-patience)", taxExp >= (st2.auditBase ?? 0) + 1, `consults=${taxExp} (baseline ${st2.auditBase ?? 0})`);

/* THE OUTPUTS LEG LANDS THROUGH THE LIVE WIRE — the no-row variant's own
 * shape: no re-created wire needed (the t937 arc had to bring one back;
 * this wire never left). The find names the raw-killed run's partial
 * files; the row still failed — the manifest leg heals nothing. */
let recMan = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 240_000) {
    try { jobs(); } catch {}
    const rec = readRecord(c2dId);
    if (rec?.done && !rec?.remote?.outputsLedgerPending) { recMan = rec; break; }
    await sleep(3000);
  }
}
ok("S2 THE OUTPUTS QUESTION ANSWERED through the LIVE wire (the manifest leg needed no re-create — the wire never left)", !!recMan, recMan ? "" : "the manifest leg never landed in 240s");
if (!recMan) { console.log("FATAL(stage2): the manifest leg never landed — aborting"); writeReceipt({ fatal: "manifest leg never landed", stage2: { pass, fail } }); process.exit(2); }
ok("S2 THE LANDING STAMPED (outputsLedgerAt set — the manifest leg's own timestamp)", typeof recMan?.remote?.outputsLedgerAt === "number", `at=${String(recMan?.remote?.outputsLedgerAt ?? "none")}`);
const manPath = recMan?.workdir ? path.join(recMan.workdir, ".cf-remote-manifest.json") : null;
let man = null;
try { man = JSON.parse(readFileSync(manPath, "utf8")); } catch {}
ok("S2 THE MANIFEST FILE EXISTS at the run's workdir (the Files tab's future authorization)", !!man, manPath ?? "no workdir");
ok("S2 THE MANIFEST REWRITTEN BY THE LEG (writtenAt moved past the stop-time residue — the live wire's own hand)", !!man && man?.writtenAt !== (st2.manifestAtStop ?? null) && Date.parse(man?.writtenAt ?? "") > (st2.openedAt ?? 0), `now=${man?.writtenAt ?? "none"} at-stop=${st2.manifestAtStop ?? "none"}`);
ok("S2 THE MANIFEST NAMES THE RUN'S OWN WIRE (connectionId = the standing connection)", man?.connectionId === st2.standingConnId, `${man?.connectionId ?? "none"}`);
ok("S2 THE MANIFEST NAMES THE CLUSTER'S TRUTH (the raw-killed run's partial files listed)", (man?.files?.length ?? 0) > 0 && typeof man?.remoteWorkdir === "string" && man.remoteWorkdir.length > 0, `${man?.files?.length ?? 0} files · ${String(man?.remoteWorkdir ?? "none").slice(0, 60)}`);
const landed2 = outputsLandedLines();
ok("S2 THE DEV LOG'S LANDING LINE ('…N files named on the cluster (manifest only; no sync-back ran)')", landed2.length > (st2.logBase?.landed ?? 0) && landed2.some((l) => l.includes(`the outputs ledger landed for "${NAME_CLASS2D}"`) && l.includes("(manifest only; no sync-back ran)")), (landed2[landed2.length - 1] ?? "none").slice(-160));
/* THE ROW STILL FAILED — the manifest landing heals NOTHING: the ledger's
 * silence closed the accounting question at the expiry, the stop's word
 * is the row's word forever */
const rowMan = jobs().find((x) => x.id === c2dId);
ok("S2 THE ROW STILL FAILED — the manifest landing heals NOTHING (the stop's word is the row's word, forever)", rowMan?.status === "failed" && rowMan?.result === st2.rowWordAtStop, `${rowMan?.status}/${String(rowMan?.result ?? "none").slice(0, 90)}`);
ok("S2 THE RECORD'S WORDS UNTOUCHED by the manifest leg (the stamp stands; the landing only closes the question)", recMan?.result === REFUSED_STAMP && (recMan?.exitCode ?? null) === null, `result=${String(recMan?.result ?? "none").slice(0, 80)}`);

writeState({ ...st2, expiryDone: true, outputsDone: true });
writeReceipt({ stage2: { pass, fail, silentLine: SILENT_LINE, manifestFiles: man?.files?.length ?? 0 } });
console.log(`== t938 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

if (RUN_S3) {
/* ========================= stage 3 =======================================
 * THE STANDING LEAVE: the failed face speaks the refused miss (the whole
 * arc's knowledge, on the card), no Stop verb, Re-run stands; then the
 * restore — the binding's manifest word, the t916 remove, the unbound
 * leave, the seed trio + 2 edges, the doctor CLEAN. */
console.log("== stage 3: the failed face, the standing leave ==");

const st3 = readState();
const c2dId = st3.c2dId;
if (!c2dId || !st3.expiryDone) { console.log("FATAL(stage3): no state or the expiry has not landed — run stages 1–2 first"); process.exit(2); }
const STANDING_CONN_ID3 = st3.standingConnId;

/* the wire never moved — the registry's standing shape through the arc */
const conns3 = connections();
ok("S3 THE WIRE NEVER MOVED — exactly one Mock Cluster at its standing id (the no-row arc's standing precondition, still standing)", conns3.length === 1 && conns3[0]?.id === STANDING_CONN_ID3, `conns=${conns3.length} id=${conns3[0]?.id ?? "none"}`);

/* THE FAILED FACE: the warm-up reload law, the search, the climb — the
 * cards must BE on the page before any face read (the t937 law) */
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
const faceExpr = `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ failed: t.includes('Job failed'), miss: t.includes('no live cluster session found'), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`;
let face3 = evalJson(faceExpr);
/* the remount law: the climb retries at its own pace (3 tries) */
let ov3 = "skipped";
for (let i = 0; i < 3 && face3?.failed !== true; i++) {
  ov3 = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
  await sleep(1100);
  face3 = evalJson(faceExpr);
}
ok("S3 the Overview climb clicked (the failed face read honestly)", String(ov3).startsWith("clicked@") || face3?.failed === true, String(ov3));
ok("S3 THE FAILED FACE SPEAKS THE REFUSED MISS after the whole arc (the card's word carries the stop's knowledge)", face3?.failed === true && face3?.miss === true, JSON.stringify(face3 ?? {}));
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
ok("S3 THE STANDING CONNECTION THROUGHOUT (exactly one Mock Cluster at its standing id)", connsEnd.length === 1 && connsEnd[0]?.id === STANDING_CONN_ID3, `conns=${connsEnd.length} id=${connsEnd[0]?.id ?? "none"}`);
const jobsAfter = jobs();
const edgesAfter = edges();
ok("S3 the world back to the seed trio (3 jobs)", jobsAfter.length === 3, String(jobsAfter.length));
ok("S3 the world holds exactly 2 edges", edgesAfter.length === 2, String(edgesAfter.length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S3 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({ stage3: { pass, fail, manifestFiles: st3.expiryDone ? "see stage2" : 0, restore: "done" } });
console.log(`== t938 stage3 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage3") process.exit(fail === 0 ? 0 : 1);
} /* end stage3 */

console.log(`== t938 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
