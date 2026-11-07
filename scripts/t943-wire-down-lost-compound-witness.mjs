#!/usr/bin/env node
/**
 * t943 — the lost-handle arc's SECOND face: the WIRE-DOWN+LOST COMPOUND.
 *
 * The miss-class table has four knowledge shapes (the finished refusal,
 * the lost handle, the wire-down miss, the sweep's vanish), and every
 * prior arc rode ONE lane at a time: the t941 lost-handle arc's wire
 * never moved; the t936/t940 wire-down arcs never reached the scancel.
 * The compound has never been witnessed: a stop that MISSED through the
 * scancel's lost word (the wire UP at stop time — the receipt speaks the
 * "Invalid job id specified" refusal, the question {at, missed:true,
 * refusal:"lost"}), and THEN the wire drops — the ladder going blind on
 * a lost-class question while the run goes on to complete. Two lanes'
 * knowledge in one arc, one record carrying both without confusing
 * them.
 *
 * THE NEVER-WITNESSED SURFACES this arc rides:
 *   1. the no-connection patience branch answering a refusal:"lost"
 *      question (the t940 scan-cost silence, ON the t941 question — the
 *      audit STATIC, the lost word intact, the field discipline holding:
 *      no class field grows on the lost lane),
 *   2. the accounting ROW LANDING during the blindness (the launcher's
 *      own COMPLETED row in the journal, host-side, while the app cannot
 *      ask — the row is home, the app is blind),
 *   3. the ACCOUNTING consult's t325-a host-matched fallback live fire
 *      (the wire returns as a NEW connection — the record's standing id
 *      is gone — the fallback matches by host and the consult asks
 *      through the re-created wire; every prior fallback fire was the
 *      OUTPUTS leg's, and even that only failed deafly in t940),
 *   4. the heal landing the LOST TAIL through that returned wire — the
 *      sentence keyed on the QUESTION's fields (refusal:"lost"), not on
 *      the wire's history (the t936 wire-down tail never speaks here),
 *   5. the OUTPUTS leg's fallback serving a COMPLETE manifest (the t940
 *      strikes were the fallback's deaf failures; this is its first
 *      honest answer).
 *
 *   stage1  the t916 mint re-rides, the bind, iterations=60 (a ~65s run
 *           inside the age gate), the park, the run, run_it001, THE
 *           LOST LEVER (the pid file removed), THE STOP with the wire
 *           UP (the lost refusal verbatim, the question's lost word),
 *           THE PROOF OF LIFE (the rounds climb), THE WIRE CUT (the
 *           connection DELETE — the registry empty), the blindness
 *           pinned (the audit STATIC, the question open, the journal
 *           rowless — the run still climbing), then THE ROW LANDS
 *           DURING THE BLINDNESS (the journal's COMPLETED row while
 *           the audit stays static and the question stands).
 *   stage2mid  the blindness held as a STATE (the audit still static,
 *           the row home, the question's lost word frozen, the streak
 *           absent — no sweep ticks, no ladder).
 *   stage2  THE WIRE RETURNS as a new connection (the drift shape — a
 *           new id, the same host), THE HEAL THROUGH THE FALLBACK: the
 *           consult's host-match finds the drift wire, the sacct round
 *           fires (the audit grows for the first time since the cut),
 *           the row COMPLETED → THE LOST TAIL VERBATIM (the t941 words
 *           — the question's refusal field decides, the wire's history
 *           does not), the t936 tail never speaks, the t935 tail never
 *           speaks, the question closed, exit 0 + slurmState
 *           COMPLETED, the row healed completed — then the OUTPUTS
 *           QUESTION ANSWERED through the same returned wire (the
 *           manifest lands complete — the fallback's honest answer).
 *   stage3  the fresh door (the complete ledger's exact-entry fetch),
 *           the completed face (the lost tail, no Stop verb, Re-run
 *           stands), the restore (the binding law, the t916 remove,
 *           the unbound leave, THE WIRE RESTORED — the drift id
 *           deleted, the standing id re-created via the explicit-id
 *           POST — the seed trio + 2 edges, the doctor CLEAN).
 *
 *   node scripts/t943-wire-down-lost-compound-witness.mjs stage1|stage2mid|stage2|stage3|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t943-wire-down-lost-compound-witness.json";
const STATE = path.join(ROOT, "data", "t943-wire-down-lost.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");
const ENGINE_STATE = path.join(ROOT, "data", "engine-state.json");
const DEV_LOG = "/tmp/cryoflow-qa/dev-server.log";

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
const ITERS = 60; /* ~65s of rounds at the mock's 0.9s/round — the whole run lives inside VANISH_AGE_MS=120s */

/* the two lanes' words in one arc: the STOP speaks the LOST lane's words
 * (the wire was UP at stop time — the scancel answered), the WAIT rides
 * the WIRE-DOWN lane's silence (the audit static — the no-conn patience
 * branch's scan-cost shape), and the HEAL speaks the LOST tail (the
 * question's refusal field, not the wire's history). */
const LOST_MSG_WORD = "Invalid job id specified";
const REFUSED_STAMP = "stop missed — no live cluster session found; the cluster ledger decides the final state";
const REFUSED_ROW = "stop missed (no live cluster session found) — the cluster ledger decides the final state when the run's records come home";
const HEAL_LOST_TAIL = "the cluster ledger recorded the run COMPLETED (exit 0:0) — the stop had found nothing to kill: the cluster no longer knew the job; the run finished on its own afterwards";
const HEAL_T935_TAIL = "the stop had found nothing to kill because the run had already finished";
const HEAL_T936_WORD = "the stop had no wire to the cluster";
const LANDING_LINE = "the ledger's word landed for";
const ROUND_LANDED = "the outputs ledger landed for";
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
/* the connection snapshot: everything the re-create needs (the secret is
 * the mock's own README word — the DTO strips it) */
const connSnapshot = () => {
  const c = connections().find((x) => x.name === "Mock Cluster");
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
const findName = (n) => jobs().find((j) => j.name === n);
const readRecord = (jobId) => {
  try { return JSON.parse(readFileSync(ENGINE_STATE, "utf8"))[jobId] ?? null; } catch { return null; }
};
const manifestBinding = () => {
  try { return JSON.parse(readFileSync(path.join(ROOT, "data", "t916-class2d-mint.json"), "utf8")).binding ?? null; } catch { return null; }
};
const journalRowsFor = (id) => {
  try { return readFileSync(path.join(SLURM_DIR, "accounting"), "utf8").trim().split("\n").filter((l) => l.startsWith(`${id}|`)); } catch { return []; }
};
const pidFileFor = (id) => path.join(SLURM_DIR, `job-${id}.pid`);
const mockRounds = (dir) => {
  try { return readdirSync(dir).filter((f) => /^run_it\d+_optimiser\.star$/.test(f)).sort(); } catch { return []; }
};
/* the consult's grammar is line-initial and unquoted for numeric ids
 * (the t938 law) — the audit's STATIC-vs-GROWTH is the compound's own
 * receipt: static under the cut (the no-conn patience), growth at the
 * heal (the fallback's sacct round through the returned wire) */
const consultCount = (id) => {
  try {
    const out = sh(`rg -c "^\\\\d+ sacct -j '?${id}'? -n -P -o JobID,State,ExitCode,Elapsed" ${SLURM_DIR}/exec-audit.log 2>/dev/null || echo 0`);
    return Number(String(out).trim().split("\n").pop()) || 0;
  } catch { return 0; }
};
const landingCount = () => {
  try { return sh(`rg -c "${LANDING_LINE}" ${DEV_LOG} 2>/dev/null || echo 0`).split("\n").pop() * 1; }
  catch { return 0; }
};
const legLandedCount = () => {
  try { return sh(`rg -c "${ROUND_LANDED}" ${DEV_LOG} 2>/dev/null || echo 0`).split("\n").pop() * 1; }
  catch { return 0; }
};
const logStat = (needle) => {
  try {
    const lines = readFileSync(DEV_LOG, "utf8").split("\n").filter((l) => l.includes(needle));
    return { count: lines.length, last: lines[lines.length - 1] ?? "" };
  } catch { return { count: 0, last: "" }; }
};
const readManifest = (workdir) => {
  try { return JSON.parse(readFileSync(path.join(workdir, ".cf-remote-manifest.json"), "utf8")); } catch { return null; }
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

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_SMID = STAGE === "main" || STAGE === "stage2mid";
const RUN_S2 = STAGE === "main" || STAGE === "stage2";
const RUN_S3 = STAGE === "main" || STAGE === "stage3";

/* ============================ prep ======================================== */
console.log(`== t943 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

const LOG_BASE = {
  landed: landingCount(),
  legLanded: legLandedCount(),
};
ok("prep the dev log baselines captured", true, `ledgerLanded=${LOG_BASE.landed} legLanded=${LOG_BASE.legLanded}`);

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * THE LOST LEVER, THE STOP WITH THE WIRE UP (the lost refusal), the
 * proof of life, THE WIRE CUT, the blindness pinned (the audit STATIC
 * on a lost-class question), THE ROW LANDING DURING THE BLINDNESS. */
console.log("== stage 1: the lost refusal, then the wire cut — the row lands where the app cannot ask ==");
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ resetAt: new Date().toISOString() }, null, 2));

/* the standing law: a crashed arc leaves its litter — sweep the orphan
 * asides HERE ONLY (a FRESH arc's stage1; this arc's levers are a rm
 * and a registry DELETE — no aside of its own to protect) */
try { sh(`rm -rf ${MOCK_PROJECTS}/${projId}/class2d_*.t939-aside ${MOCK_PROJECTS}/${projId}/class2d_*.t940-aside ${MOCK_PROJECTS}/${projId}/*.swept.* 2>/dev/null`); } catch {}

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

/* the standing wire + its snapshot (the re-create's fields) — the STOP
 * needs the wire UP (the lost lane's precondition), the WAIT needs it
 * DOWN (the blindness's precondition): one wire, two lanes, one arc */
const snap = connSnapshot();
ok("S1 the standing wire present + snapshotted (the stop's precondition AND the re-create's fields)", !!snap?.id && snap?.host === MOCK_WIRE.host && Number(snap?.port) === MOCK_WIRE.port, `${snap?.id} ${snap?.host}:${snap?.port}`);
if (!snap?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const STANDING_CONN_ID = snap.id;

const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: STANDING_CONN_ID });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok(`S1 the class2d's iterations pinned at ${ITERS} through the PATCH door (a life inside the age gate)`, !!patchP.job?.id && String(patchP.job?.params?.iterations) === String(ITERS), JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

/* the blind window from the very start (the park is the t935/t937 law:
 * no GET between the levers and the stop, none between the stop and
 * the cut) */
sh(`${AB} open about:blank`);
await sleep(600);

let arc = null;
for (let attempt = 1; attempt <= 3 && !arc; attempt++) {
  console.log(`-- S1 compound attempt ${attempt} --`);
  /* the wire may be down from a previous attempt's cut — re-create it
   * at the STANDING id before the run (the t936 law) */
  if (!connections().some((x) => x.id === STANDING_CONN_ID)) {
    const rc = recreateWire(snap, STANDING_CONN_ID);
    ok(`S1 attempt ${attempt} the wire re-created at the standing id (a previous attempt's cut undone)`, !!rc?.connection?.id, rc?.error ?? "");
    if (!rc?.connection?.id) continue;
  }
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S1 attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  ok(`S1 attempt ${attempt} the bare POST accepted (the binding's lane)`, true, "");
  let fresh = null;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000) {
      const f = (() => {
        try {
          return readdirSync(SLURM_DIR)
            .filter((x) => /^job-\d+\.pid$/.test(x))
            .map((x) => { const full = path.join(SLURM_DIR, x); return { file: x, id: readFileSync(full, "utf8").trim().split(/\s+/)[0], mtime: statSync(full).mtimeMs }; })
            .filter((x) => Date.now() - x.mtime < 120_000)
            .sort((a, b) => b.mtime - a.mtime)[0];
        } catch { return null; }
      })();
      if (f?.id) { fresh = f; break; }
      await sleep(300);
    }
  }
  if (!fresh?.id) { ok(`S1 attempt ${attempt} the launcher pid file found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid file read (slurm ${fresh.id})`, true, "");
  let depth = 0;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 45_000) {
      depth = mockRounds(c2dMockDir).length;
      if (depth >= 1) break;
      await sleep(300);
    }
  }
  if (depth < 1) { ok(`S1 attempt ${attempt} run_it001 landed before the lever (mid-flight depth)`, false, "no rounds in 45s"); continue; }
  ok(`S1 attempt ${attempt} run_it001 landed (mid-flight depth before the lever)`, true, "");
  if (!existsSync(pidFileFor(fresh.id))) { ok(`S1 attempt ${attempt} the pid file still stands at lever time`, false, "gone already"); continue; }

  /* THE LOST LEVER — the controller loses the job's handle (the pid
   * file removed host-side; the launcher and the run NEVER notice) */
  const pidFile = pidFileFor(fresh.id);
  rmSync(pidFile, { force: true });
  ok(`S1 attempt ${attempt} THE LOST LEVER THROWN — job-${fresh.id}.pid GONE (the controller's memory loss)`, !existsSync(pidFile), pidFile.split("/").pop());

  /* THE STOP WITH THE WIRE UP — the scancel answers with the lost word
   * (the t941 lane's receipt, re-proven as the compound's first lane) */
  const stopP = api("POST", `/api/jobs/${c2d.id}/stop`);
  if (stopP.error && !stopP.outcome) {
    ok(`S1 attempt ${attempt} THE STOP FIRED on the live row (no 409 — nothing stole the lane)`, false, JSON.stringify(stopP).slice(0, 110));
    continue;
  }
  ok(`S1 attempt ${attempt} THE STOP FIRED while the run was alive (no 409)`, true, "");
  ok(`S1 attempt ${attempt} THE RECEIPT'S SHAPE: stopped=false, outcome='missed', settled=null`, stopP.stopped === false && stopP.outcome === "missed" && stopP.settled === null, `stopped=${stopP.stopped} outcome=${stopP.outcome} settled=${stopP.settled}`);
  ok(`S1 attempt ${attempt} THE LOST LANE'S WORD VERBATIM (the scancel's own stderr — the wire was UP, the scancel SPOKE)`, String(stopP.message ?? "").includes("scancel") && String(stopP.message ?? "").includes(LOST_MSG_WORD) && !String(stopP.message ?? "").includes("already finished"), String(stopP.message ?? "none").slice(0, 160));
  ok(`S1 attempt ${attempt} THE ROW'S REFUSED WORD verbatim (the t935/t938/t941 word — the lost lane's durable surface)`, stopP.job?.status === "failed" && stopP.job?.result === REFUSED_ROW, `${stopP.job?.status}/${String(stopP.job?.result ?? "none").slice(0, 110)}`);
  const recStop = readRecord(c2d.id);
  ok(`S1 attempt ${attempt} THE QUESTION OPEN — missed:true AND refusal:'lost' AND class ABSENT (the lost lane rides the lost word only)`, recStop?.remote?.accountingPending?.missed === true && recStop?.remote?.accountingPending?.refusal === "lost" && recStop?.remote?.accountingPending?.class === undefined, JSON.stringify(recStop?.remote?.accountingPending ?? null));
  arc = {
    slurmId: fresh.id,
    attempt,
    openedAt: recStop?.remote?.accountingPending?.at ?? Date.now(),
    rowWordAtStop: stopP.job?.result ?? "",
    leverAt: new Date().toISOString(),
  };
  break;
}
if (!arc) { console.log("FATAL: the lost stop never landed — aborting"); writeReceipt({ fatal: "lost stop never landed" }); process.exit(2); }

/* THE PROOF OF LIFE — the run went on (the launcher never noticed) */
const roundsAtStop = mockRounds(c2dMockDir).length;
await sleep(9_000);
const roundsAfter1 = mockRounds(c2dMockDir).length;
ok("S1 THE RUN WENT ON — the rounds climbed after the stop (the compute node never got the word)", roundsAfter1 > roundsAtStop, `${roundsAtStop} → ${roundsAfter1}`);

/* THE WIRE CUT — the connection DELETE through the product's own door;
 * the lost-class question now rides the no-conn patience (the second
 * lane joins: the ladder has NOTHING to ask with) */
const cutP = api("DELETE", `/api/remote/connections/${STANDING_CONN_ID}`);
const gone = !connections().some((x) => x.id === STANDING_CONN_ID);
ok("S1 THE WIRE CUT — the connection deleted through the API door (the lost question's ladder goes blind)", cutP.ok === true && gone, `ok=${cutP.ok} gone=${gone}`);
if (!gone) { console.log("FATAL: the wire never went down — aborting"); writeReceipt({ fatal: "wire never cut", stage1: { pass, fail } }); process.exit(2); }
const recCut = readRecord(c2d.id);
ok("S1 THE QUESTION'S LOST WORD UNTOUCHED by the cut (the field discipline: the wire-down lane adds NO class to a lost question)", recCut?.remote?.accountingPending?.missed === true && recCut?.remote?.accountingPending?.refusal === "lost" && recCut?.remote?.accountingPending?.class === undefined, JSON.stringify(recCut?.remote?.accountingPending ?? null));

/* the blindness snapshots (judged in deltas — the t937 law) */
const auditBase = consultCount(arc.slurmId);
ok("S1 the cut-time snapshots taken (the audit baseline after the wire-up consult rounds)", true, `consults=${auditBase} rounds=${roundsAfter1}`);

/* THE BLINDNESS — the no-conn patience branch's scan-cost shape on a
 * lost-class question: the audit STATIC (nothing asks), the question
 * open, the journal rowless (the run still alive) */
await sleep(14_000);
const recBlind = readRecord(c2d.id);
const auditBlind1 = consultCount(arc.slurmId);
ok("S1 THE BLINDNESS — the audit STATIC across the cut (the no-conn patience waits at scan cost: nothing asked, nothing answered)", auditBlind1 === auditBase, `consults=${auditBlind1}/${auditBase} (static)`);
ok("S1 the question STILL OPEN under the blindness with its lost word", recBlind?.remote?.accountingPending?.missed === true && recBlind?.remote?.accountingPending?.refusal === "lost" && recBlind?.remote?.accountingPending?.class === undefined, JSON.stringify(recBlind?.remote?.accountingPending ?? null));
ok("S1 THE JOURNAL STILL ROWLESS in the blindness (the run is alive — the row lands only at the natural completion)", journalRowsFor(arc.slurmId).length === 0, "journal silent");
const roundsBlind = mockRounds(c2dMockDir).length;
ok("S1 THE RUN STILL CLIMBING in the blindness (the wire's death is not the run's death)", roundsBlind >= roundsAfter1, `rounds=${roundsBlind} (at cut ${roundsAfter1})`);
ok("S1 the vanishedStreak ABSENT (the park: no sweep ticks, no ladder — the age gate's silence counts nothing)", recBlind?.remote?.vanishedStreak === undefined, `streak=${JSON.stringify(recBlind?.remote?.vanishedStreak ?? null)}`);

/* THE ROW LANDS DURING THE BLINDNESS — poll the journal host-side: the
 * launcher's own COMPLETED row, written while the app cannot ask. THE
 * COMPOUND'S OWN PICTURE: the row is home, the ledger knows, the app
 * is blind. */
let rowLandedBlind = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    try { jobs(); } catch {} /* paced GETs: the monitor's tick cadence without a page */
    const rows = journalRowsFor(arc.slurmId);
    if (rows.length > 0) { rowLandedBlind = rows; break; }
    await sleep(2000);
  }
}
ok("S1 THE ROW LANDED DURING THE BLINDNESS — the launcher's own COMPLETED row in the journal (the ledger knows what the app cannot ask)", !!rowLandedBlind && /COMPLETED/.test(rowLandedBlind[rowLandedBlind.length - 1] ?? ""), (rowLandedBlind ?? []).join(" ; ").slice(0, 120));
if (!rowLandedBlind) { console.log("FATAL: the row never landed — aborting"); writeReceipt({ fatal: "row never landed", stage1: { pass, fail } }); process.exit(2); }
const rowLandedAt = Date.now();
const auditBlind2 = consultCount(arc.slurmId);
ok("S1 THE AUDIT STILL STATIC at the landing (the row is home; the blindness holds — no one asked for it)", auditBlind2 === auditBase, `consults=${auditBlind2}/${auditBase} (static through the landing)`);
const recRowBlind = readRecord(c2d.id);
ok("S1 THE RECORD BLIND TO THE LANDING (the question still open with its lost word — the heal needs a wire)", recRowBlind?.remote?.accountingPending?.missed === true && recRowBlind?.remote?.accountingPending?.refusal === "lost", JSON.stringify(recRowBlind?.remote?.accountingPending ?? null));
ok("S1 THE STAMP STILL STANDS at the landing (done, NO exit — a missed kill claims nothing while blind)", recRowBlind?.done === true && recRowBlind?.result === REFUSED_STAMP && (recRowBlind?.exitCode ?? null) === null, `exit=${recRowBlind?.exitCode ?? "none"}`);
const rowJobBlind = jobs().find((x) => x.id === c2d.id);
ok("S1 THE ROW'S WORD STILL THE REFUSED MISS at the landing (the echo may come; the heal has not)", rowJobBlind?.status === "failed" && rowJobBlind?.result === arc.rowWordAtStop, `${rowJobBlind?.status}/${String(rowJobBlind?.result ?? "none").slice(0, 90)}`);

writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, standingConnId: STANDING_CONN_ID, snap, auditBase, auditBlind: auditBlind2, logBase: LOG_BASE, roundsAtStop, rowLandedAt, ...arc });
writeReceipt({ stage1: { pass, fail, slurmId: arc.slurmId, openedAt: arc.openedAt, levers: ["pid-file-removed", "connection-deleted"], rowLandedDuringBlindness: true, auditStatic: true } });
console.log(`== t943 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_SMID) {
/* ====================== stage 2mid ========================================
 * the blindness held as a STATE: the audit STILL static, the row home,
 * the question's lost word frozen, no sweep ladder. */
console.log("== stage 2mid: the blindness held — the row home, the app still blind ==");
const stm = readState();
const c2dIdM = stm.c2dId;
if (!c2dIdM || !stm.rowLandedAt) { console.log("FATAL(stage2mid): no state — run stage1 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);
await sleep(20_000); /* the blindness as a STATE, not a transient */
const recMid = readRecord(c2dIdM);
const auditMid = consultCount(String(stm.slurmId));
ok("S2M THE BLINDNESS HELD — the audit STILL static (the no-conn patience's scan-cost shape, stable across ticks)", auditMid === (stm.auditBlind ?? stm.auditBase), `consults=${auditMid}/${stm.auditBlind ?? stm.auditBase} (static)`);
ok("S2M THE QUESTION STILL OPEN with its lost word (the patience runs; nothing expires it mid-blindness)", recMid?.remote?.accountingPending?.missed === true && recMid?.remote?.accountingPending?.refusal === "lost" && recMid?.remote?.accountingPending?.class === undefined, JSON.stringify(recMid?.remote?.accountingPending ?? null));
ok("S2M THE ROW STILL HOME (the launcher's COMPLETED row sits in the journal — the ledger knows)", journalRowsFor(String(stm.slurmId)).length > 0 && /COMPLETED/.test(journalRowsFor(String(stm.slurmId))[0] ?? ""), journalRowsFor(String(stm.slurmId)).join(" ; ").slice(0, 100));
ok("S2M THE REGISTRY STILL EMPTY (the wire has not returned — the blindness is the arc's own state, not a race)", connections().length === 0, `conns=${connections().length}`);
ok("S2M THE STAMP STILL STANDS (done, NO exit — the blindness claims nothing)", recMid?.done === true && recMid?.result === REFUSED_STAMP && (recMid?.exitCode ?? null) === null, `exit=${recMid?.exitCode ?? "none"}`);
ok("S2M THE VANISHED STREAK STILL ABSENT (no sweep ticks all arc — the park's discipline)", recMid?.remote?.vanishedStreak === undefined, `streak=${JSON.stringify(recMid?.remote?.vanishedStreak ?? null)}`);
ok("S2M THE DEV LOG INNOCENT at mid-arc (no landing of either family — nothing spoke through no wire)", landingCount() === (stm.logBase?.landed ?? 0) && legLandedCount() === (stm.logBase?.legLanded ?? 0), `ledger=${landingCount()}/${stm.logBase?.landed ?? 0} leg=${legLandedCount()}/${stm.logBase?.legLanded ?? 0}`);
writeReceipt({ stage2mid: { pass, fail, at: new Date().toISOString(), auditStatic: auditMid === (stm.auditBlind ?? stm.auditBase) } });
console.log(`== t943 stage2mid ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2mid") process.exit(fail === 0 ? 0 : 1);
} /* end stage2mid */

if (RUN_S2) {
/* ====================== stage 2 ===========================================
 * THE WIRE RETURNS as a new connection (the drift shape), THE HEAL
 * THROUGH THE FALLBACK (the accounting consult's host-match live fire):
 * the audit grows, the row COMPLETED → THE LOST TAIL VERBATIM (the
 * question's refusal field decides, not the wire's history), then the
 * OUTPUTS QUESTION ANSWERED through the same returned wire. */
console.log("== stage 2: the wire returns, the fallback asks, the lost tail lands ==");
const st2 = readState();
const c2dId = st2.c2dId;
const SLURM_ID = String(st2.slurmId ?? "");
if (!c2dId || !st2.rowLandedAt) { console.log("FATAL(stage2): no state — run stage1 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);

/* THE WIRE RETURNS — a NEW connection (the drift shape: the record's
 * standing id is GONE; the host-match is the only way home) */
const rcP = recreateWire(st2.snap, null);
const driftId = rcP?.connection?.id ?? null;
ok("S2 THE WIRE RETURNS — a NEW connection id (the drift shape: the standing id is gone, the host-match is the only way home)", !!driftId && driftId !== st2.standingConnId, `drift=${driftId ?? "none"} (standing ${st2.standingConnId})`);
if (!driftId) { console.log("FATAL(stage2): the wire never returned — aborting"); writeReceipt({ fatal: "wire never returned", stage2: { pass, fail } }); process.exit(2); }
ok("S2 THE DRIFT WIRE IS THE SAME CLUSTER (the host-match's own precondition: same host, same port)", rcP?.connection?.host === MOCK_WIRE.host && Number(rcP?.connection?.port) === MOCK_WIRE.port, `${rcP?.connection?.host}:${rcP?.connection?.port}`);

/* THE HEAL THROUGH THE FALLBACK — poll the record for the lost tail:
 * the consult's host-match finds the drift wire, the sacct round fires
 * (the audit grows for the first time since the cut), the row is
 * COMPLETED, and the sentence is the LOST tail */
let healed = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    try { jobs(); } catch {}
    const rec = readRecord(c2dId);
    if (rec?.result === HEAL_LOST_TAIL) { healed = rec; break; }
    await sleep(2000);
  }
}
ok("S2 THE HEAL LANDED THROUGH THE FALLBACK — the record's words are the t941 LOST TAIL verbatim (the t325-a host-match's first accounting live fire)", !!healed, healed ? "" : `last=${String(readRecord(c2dId)?.result ?? "none").slice(0, 140)}`);
if (!healed) { console.log("FATAL(stage2): the heal never landed — aborting"); writeReceipt({ fatal: "heal never landed", stage2: { pass, fail }, recordResult: readRecord(c2dId)?.result }); process.exit(2); }
const healAt = Date.now();
ok("S2 THE HEAL CAME AFTER THE WIRE RETURNED (the blindness ordered the landing — the compound's own sequencing)", healAt > (st2.rowLandedAt ?? 0) + 5_000, `heal≈${new Date(healAt).toISOString()} > row=${new Date(st2.rowLandedAt ?? 0).toISOString()}`);
ok("S2 THE T935 TAIL NEVER SPOKE ('already finished' would be the t935 arc's word — the fate was never KNOWN at stop time)", !String(healed?.result ?? "").includes(HEAL_T935_TAIL), String(healed?.result ?? "").slice(0, 140));
ok("S2 THE T936 TAIL NEVER SPOKE ('the stop had no wire to the cluster' would be the WIRE-DOWN lane's word — the stop's wire was UP; only the WAIT's was down)", !String(healed?.result ?? "").includes(HEAL_T936_WORD), String(healed?.result ?? "").slice(0, 140));
ok("S2 THE QUESTION CLOSED (the landing clears the flag)", healed?.remote?.accountingPending === undefined, JSON.stringify(healed?.remote?.accountingPending ?? null));
ok("S2 THE LEDGER'S WORD ABOARD (exit 0, slurmState COMPLETED)", healed?.exitCode === 0 && healed?.remote?.slurmState === "COMPLETED", `exit=${JSON.stringify(healed?.exitCode ?? null)} state=${healed?.remote?.slurmState ?? "none"}`);

/* the audit's growth — the fallback's own SSH round (the blindness was
 * static; the growth IS the fallback's testimony) */
const auditHeal = consultCount(SLURM_ID);
ok("S2 THE AUDIT GREW AT THE HEAL — the fallback's sacct round through the returned wire (the static-then-growth signature)", auditHeal > (st2.auditBlind ?? st2.auditBase), `consults=${auditHeal} (blind ${st2.auditBlind ?? st2.auditBase})`);

/* the dev log's landing line (the consult's own mouth) */
{
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000) {
    const ls = logStat(LANDING_LINE);
    if (ls.count > (st2.logBase?.landed ?? 0) && ls.last.includes(`"${NAME_CLASS2D}"`)) break;
    await sleep(1500);
  }
  const ls = logStat(LANDING_LINE);
  ok("S2 THE DEV LOG'S LANDING LINE (+1, named for this job)", ls.count === (st2.logBase?.landed ?? 0) + 1 && ls.last.includes("COMPLETED (exit 0:0)") && ls.last.includes("the stop-receipt row healed completed"), ls.last.slice(-160));
}

/* THE ROW HEALED COMPLETED — the t935-widened flip (the echo may have
 * flipped it first; the heal's richer sentence reaches the row either
 * way) */
const rowHealed = jobs().find((x) => x.id === c2dId);
ok("S2 THE ROW HEALED COMPLETED with the lost tail (status completed, progress 100, the heal's own words)", rowHealed?.status === "completed" && rowHealed?.progress === 100 && rowHealed?.result === HEAL_LOST_TAIL, `${rowHealed?.status}/${String(rowHealed?.result ?? "none").slice(0, 120)}`);

/* THE OUTPUTS QUESTION ANSWERED through the same returned wire — the
 * OUTPUTS leg's fallback serving a COMPLETE manifest (the t940 strikes
 * were the fallback's deaf failures; this is its first honest answer) */
let legLanded = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 150_000) {
    try { jobs(); } catch {}
    const rec = readRecord(c2dId);
    const lc = legLandedCount();
    if (lc > (st2.logBase?.legLanded ?? 0) && lc > 0 && rec?.remote?.outputsLedgerAt) { legLanded = { rec, lc }; break; }
    await sleep(2500);
  }
}
ok("S2 THE OUTPUTS QUESTION ANSWERED THROUGH THE FALLBACK — the manifest leg landed complete (the t325-a fallback's first HONEST answer: the t940 strikes were its deaf ones)", !!legLanded, legLanded ? `legLanded=${legLanded.lc}` : "no landed line in 150s");
if (!legLanded) { console.log("FATAL(stage2): the manifest leg never landed — aborting"); writeReceipt({ fatal: "manifest leg never landed", stage2: { pass, fail } }); process.exit(2); }
ok("S2 the outputs question CLOSED BY ITS OWN ANSWER (outputsLedgerPending cleared, outputsLedgerAt stamped)", legLanded?.rec?.remote?.outputsLedgerPending === undefined && typeof legLanded?.rec?.remote?.outputsLedgerAt === "number", `pending=${JSON.stringify(legLanded?.rec?.remote?.outputsLedgerPending ?? null)} at=${legLanded?.rec?.remote?.outputsLedgerAt ?? "none"}`);
ok("S2 NOT A STRIKE — no tries field anywhere (the answer arrived through the returned wire)", legLanded?.rec?.remote?.outputsLedgerTries === undefined, `tries=${JSON.stringify(legLanded?.rec?.remote?.outputsLedgerTries ?? null)}`);
{
  const man = readManifest(legLanded?.rec?.workdir ?? "");
  ok("S2 THE MANIFEST LANDED COMPLETE (the natural tree — no inflation this arc: the fallback's answer is whole)", !!man && (man?.files?.length ?? 0) > 0 && man?.truncated !== true, `files=${man?.files?.length ?? 0} truncated=${JSON.stringify(man?.truncated ?? null)}`);
  ok("S2 THE MANIFEST NAMES THE RUN'S OWN WIRE (connectionId = the record's standing id — the record's truth, not the drift's)", man?.connectionId === st2.standingConnId, `${man?.connectionId ?? "none"}`);
}
{
  const ls = logStat(ROUND_LANDED);
  ok("S2 THE LEG'S LANDING LINE (+1, named for this job, the manifest-only shape)", ls.count > (st2.logBase?.legLanded ?? 0) && ls.last.includes(`the outputs ledger landed for "${NAME_CLASS2D}"`) && ls.last.includes("(manifest only; no sync-back ran)"), ls.last.slice(-160));
}

writeState({ ...st2, healedDone: true, driftId, auditHeal });
writeReceipt({ stage2: { pass, fail, healTail: HEAL_LOST_TAIL, driftId, auditHeal, fallback: "accounting+outputs-first-honest" } });
console.log(`== t943 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

if (RUN_S3) {
/* ========================= stage 3 =======================================
 * THE STANDING LEAVE: the fresh ledger's door OPENS (the complete
 * manifest's exact-entry fetch), the completed face speaks the lost
 * tail, the restore — including THE WIRE RESTORED (the drift id
 * deleted, the standing id re-created via the explicit-id POST). */
console.log("== stage 3: the fresh door, the completed face, the wire restored ==");
const st3 = readState();
const c2dId = st3.c2dId;
if (!c2dId || !st3.healedDone) { console.log("FATAL(stage3): no state or the heal has not landed — run stages 1–2 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);

const rec3 = readRecord(c2dId);
ok("S3 the heal's words still stand on the record", rec3?.result === HEAL_LOST_TAIL, String(rec3?.result ?? "none").slice(0, 120));

/* THE FRESH LEDGER'S DOOR OPENS — the manifest the leg landed (through
 * the fallback) names the cluster's files; the exact-entry door serves
 * them (the t941 fresh-200 shape, now on a fallback-served ledger) */
let manPaths = [];
try {
  const man = JSON.parse(readFileSync(path.join(rec3?.workdir ?? "", ".cf-remote-manifest.json"), "utf8"));
  manPaths = (man?.files ?? []).map((f) => f.path).filter(Boolean);
} catch {}
ok("S3 THE FALLBACK-SERVED MANIFEST READ (the local workdir's ledger names the cluster's truth)", manPaths.length > 0, `${manPaths.length} files`);
if (manPaths.length > 0) {
  const probePath = manPaths.find((p) => !p.includes("/")) ?? manPaths[0];
  const syncP = api("POST", `/api/jobs/${c2dId}/outputs/sync`, { paths: [probePath] });
  ok(`S3 THE FRESH DOOR OPENS ('${probePath}' rides the ledger's exact-entry authorization)`, syncP?.ok === true && Array.isArray(syncP?.results) && syncP.results.length === 1 && syncP.results[0]?.ok === true, JSON.stringify(syncP).slice(0, 140));
  writeReceipt({ stage3Door: { shape: "fallback-served-fresh-200", probe: probePath, total: syncP?.total ?? null } });
}

/* THE COMPLETED FACE: the warm-up reload law, then the climb (the find
 * dance dispensed — the t941 law) */
let carded = null;
for (let i = 0; i < 3 && !carded; i++) {
  sh(`${AB} open ${BASE}/`);
  carded = await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 40, 600);
  await sleep(800);
}
ok("S3 the workspace renders (the cards on the page — the warm-up reload law)", !!carded && carded.cards >= 3, `cards=${carded?.cards ?? "none"}`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 40, 600);
await sleep(1500);
await settleCensus();
const faceDiag = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, hasC2d: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent||'').includes('${NAME_CLASS2D}')) })`);
ok("S3 the completed card is on the page before the climb", faceDiag?.hasC2d === true, JSON.stringify(faceDiag));
const insp3 = await openInspectorHard(NAME_CLASS2D, 8);
ok("S3 the COMPLETED job's inspector opens", String(insp3).startsWith("open@try"), String(insp3));
await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ tabs: [...(d?.querySelectorAll('[role="tab"]') ?? [])].map(t => (t.textContent || '').trim()) }); })()`,
  (v) => v.tabs?.includes("Overview") === true, 12, 600,
);
let ov3 = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
let face3 = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ healed: t.includes('the cluster no longer knew the job'), completed: t.includes('Completed'), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`,
  (v) => v.healed === true, 12, 500,
);
ok("S3 the Overview climb clicked", String(ov3).startsWith("clicked@"), String(ov3));
ok("S3 THE COMPLETED FACE SPEAKS THE LOST HANDLE (the heal's own sentence on the card — the compound's whole knowledge)", face3?.healed === true && face3?.completed === true, `healed=${face3?.healed} completed=${face3?.completed}`);
ok("S3 THE COMPLETED FACE HAS NO STOP VERB (Re-run stands where Stop stood)", face3?.stopBtn === false && face3?.rerun === true, `stop=${face3?.stopBtn} rerun=${face3?.rerun}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

/* the resurrect ride-out: the OOM killer has taken the dev server at
 * exactly this arc-weight before (the t941 law) — the restore's PATCH
 * trio waits for it and retries; the pins judge the WORLD, not the
 * transport */
const serverUp = async (label) => {
  for (let i = 0; i < 30; i++) {
    try {
      const probe = sh(`curl -s -o /dev/null -w "%{http_code}" -H "Origin: ${BASE}" "${BASE}/api/jobs" --max-time 8`);
      if (probe === "200") { if (i > 0) console.log(`  (server answered after ${i * 3}s — ${label})`); return true; }
    } catch {}
    await sleep(3000);
  }
  return false;
};
const retryApi = async (label, fn) => {
  for (let i = 0; i < 3; i++) {
    await serverUp(label);
    const r = fn();
    if (r && r.ok === true) return r;
    await sleep(4000);
  }
  return fn();
};

/* the restore: the manifest-word binding law, the t916 remove, the
 * unbound leave, THE WIRE RESTORED (the t940 template: the drift id
 * deleted, the standing id re-created via the explicit-id POST), the
 * seed trio, the doctor */
const mBinding = manifestBinding();
const rebind3 = await retryApi("the rebind", () => api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: mBinding }));
ok(`S3 THE BINDING RETURNED TO THE MINT-TIME VALUE (the manifest's own word: ${mBinding === null ? "null — the unbound mint" : "the connection"})`, rebind3.ok === true, `m.binding=${String(mBinding).slice(0, 24)}`);
let removeOut = "(never ran)";
for (let i = 0; i < 3; i++) {
  await serverUp("the remove");
  try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
  if (/remove GREEN — \d+ ok, 0 fail/.test(removeOut)) break;
  await sleep(4000);
}
ok("S3 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
const unbind3 = await retryApi("the unbind", () => api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null }));
ok("S3 THE STANDING LEAVE — unbound after the manifest is consumed (the t929/t930 law)", unbind3.ok === true, JSON.stringify(unbind3).slice(0, 60));
/* THE WIRE RESTORED — the drift id deleted, the standing id re-created
 * (the t940 template's own restore: the future windows' t300 binds
 * resolve by name AND id) */
if (st3.driftId && st3.driftId !== st3.standingConnId && connections().some((x) => x.id === st3.driftId)) {
  api("DELETE", `/api/remote/connections/${st3.driftId}`);
}
if (!connections().some((x) => x.id === st3.standingConnId)) {
  recreateWire(st3.snap, st3.standingConnId);
}
const connsRestored = connections();
ok(`S3 THE WIRE RESTORED AT ITS STANDING ID (the registry's standing shape: exactly one Mock Cluster at ${st3.standingConnId} — the drift id gone)`, connsRestored.length === 1 && connsRestored[0]?.id === st3.standingConnId, `conns=${connsRestored.length} id=${connsRestored[0]?.id ?? "none"}`);
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
writeReceipt({ stage3: { pass, fail, door: "fallback-served-fresh-200", wireRestored: true, restore: "done" } });
console.log(`== t943 stage3 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage3") process.exit(fail === 0 ? 0 : 1);
} /* end stage3 */

console.log(`== t943 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);



