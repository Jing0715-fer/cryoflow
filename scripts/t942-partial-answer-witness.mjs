#!/usr/bin/env node
/**
 * t942 — the tries lane's THIRD shape: the PARTIAL ANSWER (the canary's
 * live fire at the outputs leg).
 *
 * The outputs ledger leg has two witnessed endings: the t938 landing (the
 * find names the raw-killed run's partial files — complete, question
 * closed landed) and the t939/t940 strikes (the find deaf or the wire
 * gone — three silent rounds, the question closed wholesale). The THIRD
 * shape has never had a live fire: the find SUCCEEDS and the answer is
 * TRUNCATED — the workdir holds more files than the manifest's cap, the
 * cap+1 canary line fires, the ledger lands truncated:true, and the
 * question CLOSES WITH THE LANDED TAIL anyway. A partial answer is still
 * an answer: the t464 cap's honesty (the ledger says "the cluster holds
 * more" instead of lying by completeness) riding the t626 question's
 * own lifecycle — never witnessed together.
 *
 * THE HONEST ARC is the t941 lost-handle template (the fastest route to
 * a heal-opened outputs question — the row lands after the question, the
 * heal lands on a later tick, the leg answers through the live wire)
 * plus ONE LEVER: the world grown PAST THE CAP while the run is still
 * alive. ~20,400 deep pad files (t942-pad/fNNNNN.pad, mindepth 2 —
 * invisible to the rounds census, irrelevant to the launcher) land in
 * the mock workdir seconds after the lost-handle stop, ~40s before the
 * question even opens — no race: the leg cannot tick until the heal
 * creates the question, and the pad predates it by half a minute.
 *
 * At the heal the leg's find enumerates ~21,000+ files through the
 * cap+1 head: the canary fires, the manifest keeps EXACTLY 20,000
 * entries with truncated:true, the door family (band a) rides inside,
 * the landing line speaks the capped clause ("the ledger is capped, the
 * cluster holds more"), and the question closes with the landed tail —
 * NOT a strike (no tries, no exit-1 rounds: the answer arrived, partial
 * but real). The door never dies at the cap: the batch bring-home
 * (t424's exact-entry door) serves the capped manifest's entries — the
 * final star family AND a pad file both fetched home through it.
 *
 *   stage1  the t916 mint re-rides, the bind, iterations=60 (a ~65s run
 *           — its whole life inside VANISH_AGE_MS=120s), the park, the
 *           run, run_it001 landed, THE LEVER (the pid file removed —
 *           the controller's memory loss), THE STOP (the lost refusal
 *           verbatim, the question {at, missed:true, refusal:"lost"}),
 *           THE PROOF OF LIFE (the rounds climb), THE INFLATION LEVER
 *           (20,400 deep pad files — the world grown past the cap while
 *           the question is not yet open), the pad census pinned, the
 *           first consult WAIT (the audit grows, the journal rowless).
 *   stage2mid  ~T+35s: the question open with its lost word, the pad
 *           census HOLDS, the run still climbing, the journal STILL
 *           rowless, the vanishedStreak ABSENT (the age gate), the dev
 *           log innocent (no landing of either family, the capped
 *           clause never spoken).
 *   stage2  THE ROW LANDS (the launcher's own COMPLETED row, after the
 *           question), the heal lands on a later tick (the t941 lost
 *           tail verbatim — the capped world changes NOTHING in the
 *           heal's sentence), the question closed, the ledger's word
 *           aboard, the row healed completed — THEN THE CAPPED LANDING:
 *           the leg's find succeeds, the canary fires, the manifest
 *           lands truncated:true at EXACTLY the cap, the door family
 *           inside, the pad family enumerated, the landing line's
 *           capped clause verbatim, the question closed WITH THE LANDED
 *           TAIL (outputsLedgerAt stamped) and NOT A STRIKE (no tries
 *           field anywhere — the t939 lane's silence).
 *   stage3  the capped door: the batch bring-home serves the capped
 *           ledger (run_optimiser.star AND t942-pad/f00001.pad both
 *           fetched home, total=20000 — the t464 law at the products
 *           leg: the door never dies), the Files tab's note speaks the
 *           ledger sentence ("the cluster holds more than the
 *           manifest's cap"), the completed face (the lost tail, no
 *           Stop verb, Re-run stands), the restore (the binding law,
 *           the t916 remove sweeping the pad with the workdir, the
 *           unbound leave, the seed trio + 2 edges, the doctor CLEAN —
 *           the wire never moved).
 *
 *   node scripts/t942-partial-answer-witness.mjs stage1|stage2mid|stage2|stage3|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t942-partial-answer-witness.json";
const STATE = path.join(ROOT, "data", "t942-partial-answer.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");
const ENGINE_STATE = path.join(ROOT, "data", "engine-state.json");
const DEV_LOG = "/tmp/cryoflow-qa/dev-server.log";

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
const ITERS = 60; /* ~65s of rounds at the mock's 0.9s/round — the whole run lives inside VANISH_AGE_MS=120s */

/* the t941 arc's own words — re-proven byte-identical UNDER the capped
 * world (the heal's sentence is bounded by stop-time knowledge; the
 * ledger's cap is not stop-time knowledge) */
const LOST_MSG_WORD = "Invalid job id specified";
const REFUSED_STAMP = "stop missed — no live cluster session found; the cluster ledger decides the final state";
const REFUSED_ROW = "stop missed (no live cluster session found) — the cluster ledger decides the final state when the run's records come home";
const HEAL_LOST_TAIL = "the cluster ledger recorded the run COMPLETED (exit 0:0) — the stop had found nothing to kill: the cluster no longer knew the job; the run finished on its own afterwards";
const HEAL_T935_TAIL = "the stop had found nothing to kill because the run had already finished";
const LANDING_LINE = "the ledger's word landed for";
const ROUND_LANDED = "the outputs ledger landed for";
/* the capped landing's own words (remote-run.ts, the leg's landing line)
 * and the Files tab's ledger sentence (remote-files.ts, describeListingNote) */
const CAPPED_CLAUSE = "the ledger is capped, the cluster holds more";
const NOTE_LEDGER_WORD = "the cluster holds more than the manifest's cap";
const NOTE_DOOR_WORD = "the final star family is pinned first";

/* THE INFLATION LEVER's own shape: 20,400 deep pad files — past the
 * server's cap (REMOTE_MANIFEST_MAX defaults to 20,000; the dev server
 * carries no CF_SYNC_MANIFEST_MAX) with margin for the natural tree
 * (~674 files at 60 iterations). Deep (mindepth 2) so the rounds census
 * never sees them; neutral .pad names so no classifier claims them. */
const PAD_DIR_NAME = "t942-pad";
const PAD_COUNT = 20400;
const CAP_EXPECTED = 20000; /* the server's own REMOTE_MANIFEST_MAX — the manifest's kept count testifies it */

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
const journalRowsFor = (id) => {
  try { return readFileSync(path.join(SLURM_DIR, "accounting"), "utf8").trim().split("\n").filter((l) => l.startsWith(`${id}|`)); } catch { return []; }
};
const pidFileFor = (id) => path.join(SLURM_DIR, `job-${id}.pid`);
const mockRounds = (dir) => {
  try { return readdirSync(dir).filter((f) => /^run_it\d+_optimiser\.star$/.test(f)).sort(); } catch { return []; }
};
/* the consult's grammar is line-initial and unquoted for numeric ids
 * (the t938 law) — the audit GROWTH is the wait's own receipt */
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
/* the capped clause's own count — the clause has never spoken in any
 * prior arc (the t938/t941 landings were complete ledgers); judged
 * RELATIVE like every log pin (the t937 law) */
const cappedLegLandedCount = () => {
  try { return sh(`rg -c "${ROUND_LANDED}.*${CAPPED_CLAUSE}" ${DEV_LOG} 2>/dev/null || echo 0`).split("\n").pop() * 1; }
  catch { return 0; }
};
const logStat = (needle) => {
  try {
    const lines = readFileSync(DEV_LOG, "utf8").split("\n").filter((l) => l.includes(needle));
    return { count: lines.length, last: lines[lines.length - 1] ?? "" };
  } catch { return { count: 0, last: "" }; }
};
const padDirOf = (mockDir) => path.join(mockDir, PAD_DIR_NAME);
const padCount = (mockDir) => {
  try { return readdirSync(padDirOf(mockDir)).length; } catch { return 0; }
};
/* THE INFLATION LEVER — the world grown past the cap: 20,400 deep pad
 * files in ONE mkdir + one xargs touch (a single touch invocation with
 * 20k args; ARG_MAX safe by an order of magnitude) */
const inflate = (mockDir) => {
  const padDir = padDirOf(mockDir);
  mkdirSync(padDir, { recursive: true });
  sh(`cd ${shQ(padDir)} && seq -f "f%05.0f.pad" 1 ${PAD_COUNT} | xargs touch`);
  return padCount(mockDir);
};
const shQ = (p) => `'${p.replace(/'/g, `'\\''`)}'`;
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
console.log(`== t942 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

const LOG_BASE = {
  landed: landingCount(),
  legLanded: legLandedCount(),
  cappedLegLanded: cappedLegLandedCount(),
};
ok("prep the dev log baselines captured", true, `ledgerLanded=${LOG_BASE.landed} legLanded=${LOG_BASE.legLanded} capped=${LOG_BASE.cappedLegLanded}`);

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * THE LEVER (the controller loses the job's handle), THE STOP THAT
 * MISSED WITH THE RUN ALIVE, the question with the lost word, the proof
 * of life, THE INFLATION LEVER (the world grown past the cap), the pad
 * census, the first consult WAIT. */
console.log("== stage 1: the lost handle, the refused stop, the world grown past the cap ==");
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({ resetAt: new Date().toISOString() }, null, 2));

/* the standing law: a crashed arc leaves its litter — sweep the orphan
 * asides HERE ONLY (a FRESH arc's stage1; this arc's own lever is a rm
 * + an inflation, no aside of its own to protect) */
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

const standingConn = connections().find((x) => x.name === "Mock Cluster");
ok("S1 the standing wire present (the refused class's precondition — the wire answers all arc long)", !!standingConn?.id, standingConn?.id ?? "none");
if (!standingConn?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }

const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: standingConn.id });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok(`S1 the class2d's iterations pinned at ${ITERS} through the PATCH door (a life inside the age gate)`, !!patchP.job?.id && String(patchP.job?.params?.iterations) === String(ITERS), JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

/* the discipline holds (the blind-window law's vestment — the tombstone's
 * age gate makes the lane unstealable; the park keeps the GET cadence out
 * of the arc's timing on principle) */
sh(`${AB} open about:blank`);
await sleep(600);

let arc = null;
for (let attempt = 1; attempt <= 3 && !arc; attempt++) {
  console.log(`-- S1 lost-handle attempt ${attempt} --`);
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

  /* THE LEVER — the controller loses the job's handle (the pid file
   * removed host-side; the launcher and the run NEVER notice) */
  const pidFile = pidFileFor(fresh.id);
  rmSync(pidFile, { force: true });
  ok(`S1 attempt ${attempt} THE LEVER THROWN — job-${fresh.id}.pid GONE (the controller's memory loss)`, !existsSync(pidFile), pidFile.split("/").pop());

  /* THE STOP — through the API door, seconds after the lever; the run is
   * ALIVE (the launcher never noticed), the row is "running" */
  const stopP = api("POST", `/api/jobs/${c2d.id}/stop`);
  if (stopP.error && !stopP.outcome) {
    ok(`S1 attempt ${attempt} THE STOP FIRED on the live row (no 409 — nothing stole the lane)`, false, JSON.stringify(stopP).slice(0, 110));
    continue;
  }
  ok(`S1 attempt ${attempt} THE STOP FIRED while the run was alive (no 409)`, true, "");
  ok(`S1 attempt ${attempt} THE RECEIPT'S SHAPE: stopped=false, outcome='missed', settled=null`, stopP.stopped === false && stopP.outcome === "missed" && stopP.settled === null, `stopped=${stopP.stopped} outcome=${stopP.outcome} settled=${stopP.settled}`);
  ok(`S1 attempt ${attempt} THE RECEIPT'S REFUSAL WORD verbatim (the scancel's own stderr — the controller no longer knew the job)`, String(stopP.message ?? "").includes("scancel") && String(stopP.message ?? "").includes(LOST_MSG_WORD) && !String(stopP.message ?? "").includes("already finished"), String(stopP.message ?? "none").slice(0, 160));
  ok(`S1 attempt ${attempt} THE ROW'S REFUSED WORD verbatim (the t935/t938 word — the class's durable surface unchanged)`, stopP.job?.status === "failed" && stopP.job?.result === REFUSED_ROW, `${stopP.job?.status}/${String(stopP.job?.result ?? "none").slice(0, 110)}`);
  const recStop = readRecord(c2d.id);
  ok(`S1 attempt ${attempt} THE DEFERRING STAMP verbatim (done, NO exit code — a missed kill claims nothing)`, recStop?.done === true && recStop?.result === REFUSED_STAMP && (recStop?.exitCode ?? null) === null, `done=${recStop?.done} exit=${recStop?.exitCode ?? "none"}`);
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
if (!arc) { console.log("FATAL: the lost-handle stop never landed — aborting"); writeReceipt({ fatal: "lost-handle stop never landed" }); process.exit(2); }

/* THE PROOF OF LIFE — the run went on: the rounds keep climbing AFTER
 * the stop (the launcher never noticed the controller's amnesia) */
const roundsAtStop = mockRounds(c2dMockDir).length;
await sleep(9_000);
const roundsAfter1 = mockRounds(c2dMockDir).length;
await sleep(9_000);
const roundsAfter2 = mockRounds(c2dMockDir).length;
ok("S1 THE RUN WENT ON (beat 1) — the rounds climbed after the stop", roundsAfter1 > roundsAtStop, `${roundsAtStop} → ${roundsAfter1}`);
ok("S1 THE RUN WENT ON (beat 2) — still climbing (the compute node never got the word)", roundsAfter2 > roundsAfter1, `${roundsAfter1} → ${roundsAfter2}`);

/* THE INFLATION LEVER — the world grown PAST THE CAP while the question
 * is not yet open (the leg cannot tick until the heal creates the
 * question; the pad predates it by half a minute — no race). Deep files
 * in ONE subdir: invisible to the rounds census, irrelevant to the
 * launcher, enumerated only by the find's deep band. */
const padLanded = inflate(c2dMockDir);
ok(`S1 THE INFLATION LEVER THROWN — ${PAD_COUNT} deep pad files in ${PAD_DIR_NAME}/ (the world grown past the ${CAP_EXPECTED}-file cap)`, padLanded === PAD_COUNT, `${padLanded}/${PAD_COUNT} at ${padDirOf(c2dMockDir).slice(-46)}`);
const roundsAfterPad = mockRounds(c2dMockDir).length;
ok("S1 the pad is invisible to the rounds census (the lever's own hygiene — deep files, root rounds untouched)", roundsAfterPad >= roundsAfter2, `rounds=${roundsAfterPad} (pre-pad ${roundsAfter2})`);

/* the snapshots (the wait judged in deltas — the t937 law) */
const recSnap = readRecord(c2d.id);
const slurmStateAtStop = recSnap?.remote?.slurmState ?? null;
const auditBase = consultCount(arc.slurmId);
ok("S1 the stop-time snapshots taken (slurmState residue + the audit baseline + the pad census)", true, `state=${slurmStateAtStop ?? "none"} consults=${auditBase} pad=${padCount(c2dMockDir)}`);
ok("S1 the vanishedStreak ABSENT at stop time (the age gate wraps the streak — the tombstone cannot even start counting)", recSnap?.remote?.vanishedStreak === undefined, `streak=${JSON.stringify(recSnap?.remote?.vanishedStreak ?? null)}`);
ok("S1 the outputs question NOT YET OPEN at pad time (the inflation predates the question — no race by construction)", recSnap?.remote?.outputsLedgerPending === undefined, `pending=${JSON.stringify(recSnap?.remote?.outputsLedgerPending ?? null)}`);

/* THE FIRST CONSULT WAIT — the accounting-lag branch's live fire WITH
 * THE WIRE UP: the audit grows, the journal stays rowless, the question
 * stays open (the wait's own shape: the wire answered EMPTY) */
let waited = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 75_000) {
    try { jobs(); } catch {}
    const rec = readRecord(c2d.id);
    const n = consultCount(arc.slurmId);
    if (n > auditBase && rec?.remote?.accountingPending && journalRowsFor(arc.slurmId).length === 0) { waited = { n, rec }; break; }
    await sleep(1500);
  }
}
ok("S1 THE FIRST CONSULT WAIT — the audit grew while the journal stayed rowless and the question stood open (the wire answered EMPTY; the lag branch waited)", !!waited, waited ? `consults=${waited.n} (baseline ${auditBase})` : "no wait round in 75s");
if (!waited) { console.log("FATAL: the first wait never landed — aborting"); writeReceipt({ fatal: "no wait round", stage1: { pass, fail } }); process.exit(2); }
ok("S1 the question STILL OPEN after the wait (the non-terminal `!f` branch's own continue)", waited.rec?.remote?.accountingPending?.missed === true && waited.rec?.remote?.accountingPending?.refusal === "lost", JSON.stringify(waited.rec?.remote?.accountingPending ?? null));
ok("S1 the stamp STILL STANDS after the wait (the wait writes no words)", waited.rec?.result === REFUSED_STAMP && (waited.rec?.exitCode ?? null) === null, String(waited.rec?.result ?? "none").slice(0, 90));
ok("S1 THE PAD CENSUS HOLDS through the wait (the world stays past the cap — the find will meet it)", padCount(c2dMockDir) === PAD_COUNT, `${padCount(c2dMockDir)}/${PAD_COUNT}`);

writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, standingConnId: standingConn.id, slurmStateAtStop, auditBase, logBase: LOG_BASE, roundsAtStop: roundsAfterPad, padCountAtStop: padLanded, ...arc });
writeReceipt({ stage1: { pass, fail, slurmId: arc.slurmId, openedAt: arc.openedAt, lever: "pid-file-removed+inflation", padCount: padLanded, firstWait: waited.n } });
console.log(`== t942 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_SMID) {
/* ====================== stage 2mid ========================================
 * ~T+35s: the question open with its lost word, the pad census HOLDS,
 * the run still climbing, the journal STILL rowless, the words frozen. */
console.log("== stage 2mid: the wait held, the pad held, the run went on climbing ==");
const stm = readState();
const c2dIdM = stm.c2dId;
if (!c2dIdM || !stm.openedAt) { console.log("FATAL(stage2mid): no state — run stage1 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);
/* pace to ~openedAt + 35s */
{
  const target = stm.openedAt + 35_000;
  while (Date.now() < target) {
    try { jobs(); } catch {}
    await sleep(Math.min(5000, Math.max(1000, target - Date.now())));
  }
}
const recMid = readRecord(c2dIdM);
ok("S2M THE QUESTION STILL OPEN with its lost word", recMid?.remote?.accountingPending?.missed === true && recMid?.remote?.accountingPending?.refusal === "lost" && recMid?.remote?.accountingPending?.class === undefined, JSON.stringify(recMid?.remote?.accountingPending ?? null));
ok("S2M THE STAMP STANDS at mid-arc (done, NO exit code)", recMid?.done === true && recMid?.result === REFUSED_STAMP && (recMid?.exitCode ?? null) === null, `exit=${recMid?.exitCode ?? "none"}`);
const rowMid = jobs().find((x) => x.id === c2dIdM);
ok("S2M THE ROW'S REFUSED WORD STANDS (unchanged since the receipt)", rowMid?.status === "failed" && rowMid?.result === stm.rowWordAtStop, `${rowMid?.status}/${String(rowMid?.result ?? "none").slice(0, 90)}`);
const roundsMid = mockRounds(stm.mockDir).length;
ok("S2M THE RUN STILL CLIMBING at mid-arc (the run went on — deeper than stage1's beats)", roundsMid > (stm.roundsAtStop ?? 0) + 1, `${stm.roundsAtStop ?? 0} → ${roundsMid}`);
ok("S2M THE PAD CENSUS HOLDS at mid-arc (the world stays past the cap)", padCount(stm.mockDir) === (stm.padCountAtStop ?? PAD_COUNT), `${padCount(stm.mockDir)}/${stm.padCountAtStop ?? PAD_COUNT}`);
ok("S2M THE JOURNAL STILL ROWLESS at mid-arc (the row lands only at the natural completion — the wait is REAL)", journalRowsFor(String(stm.slurmId)).length === 0, journalRowsFor(String(stm.slurmId)).join(" ; ").slice(0, 100) || "journal silent");
const taxMid = consultCount(String(stm.slurmId));
ok("S2M THE AUDIT GREW — the wire answered EMPTY at least once more (the SSH tax is real here: the wire is UP)", taxMid > (stm.auditBase ?? 0), `consults=${taxMid} (baseline ${stm.auditBase ?? 0})`);
ok("S2M THE VANISHED STREAK STILL ABSENT (the age gate's honesty: under 120s the ladder's silence counts nothing)", recMid?.remote?.vanishedStreak === undefined, `streak=${JSON.stringify(recMid?.remote?.vanishedStreak ?? null)}`);
ok("S2M THE DEV LOG INNOCENT at mid-arc (no landing of either family; the capped clause NEVER spoken)", landingCount() === (stm.logBase?.landed ?? 0) && legLandedCount() === (stm.logBase?.legLanded ?? 0) && cappedLegLandedCount() === (stm.logBase?.cappedLegLanded ?? 0), `ledger=${landingCount()}/${stm.logBase?.landed ?? 0} leg=${legLandedCount()}/${stm.logBase?.legLanded ?? 0} capped=${cappedLegLandedCount()}/${stm.logBase?.cappedLegLanded ?? 0}`);
writeReceipt({ stage2mid: { pass, fail, at: new Date().toISOString(), taxMid, roundsMid, padMid: padCount(stm.mockDir) } });
console.log(`== t942 stage2mid ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2mid") process.exit(fail === 0 ? 0 : 1);
} /* end stage2mid */

if (RUN_S2) {
/* ====================== stage 2 ===========================================
 * THE ROW LANDS (the launcher's own COMPLETED row — after the question
 * opened), the heal lands on a later tick (the t941 lost tail — the
 * capped world changes NOTHING in the heal's sentence), then THE CAPPED
 * LANDING: the leg's find succeeds, the canary fires, the manifest
 * lands truncated:true at EXACTLY the cap, the door family inside, the
 * pad family enumerated, the capped clause verbatim, the question
 * closed WITH THE LANDED TAIL — not a strike. */
console.log("== stage 2: the row lands late, the heal lands later, the canary fires ==");
const st2 = readState();
const c2dId = st2.c2dId;
const SLURM_ID = String(st2.slurmId ?? "");
if (!c2dId || !st2.openedAt) { console.log("FATAL(stage2): no state — run stage1 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);

/* THE ROW LANDS — poll the journal host-side for the launcher's own
 * COMPLETED row */
let rowLanded = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 150_000) {
    try { jobs(); } catch {}
    const rows = journalRowsFor(SLURM_ID);
    if (rows.length > 0) { rowLanded = rows; break; }
    await sleep(2000);
  }
}
ok("S2 THE ROW LANDED — the launcher's own verdict in the journal (the run finished on its own)", !!rowLanded && /COMPLETED/.test(rowLanded[rowLanded.length - 1] ?? ""), (rowLanded ?? []).join(" ; ").slice(0, 120));
if (!rowLanded) { console.log("FATAL(stage2): the row never landed — aborting"); writeReceipt({ fatal: "row never landed", stage2: { pass, fail } }); process.exit(2); }
const rowsLandedAt = Date.now();
ok("S2 THE ROW LANDED AFTER THE QUESTION OPENED (the arc's own ordering — the stage2mid rowless journal is its witness)", rowsLandedAt > (st2.openedAt ?? 0), `row=${new Date(rowsLandedAt).toISOString()} > openedAt=${new Date(st2.openedAt ?? 0).toISOString()}`);

/* THE HEAL LANDS ON A LATER TICK — poll the record for the consult's
 * sentence (the lost tail) */
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
ok("S2 THE HEAL LANDED — the record's words are the t941 LOST TAIL verbatim (the capped world changed NOTHING in the heal's sentence)", !!healed, healed ? "" : `last=${String(readRecord(c2dId)?.result ?? "none").slice(0, 140)}`);
if (!healed) { console.log("FATAL(stage2): the heal never landed — aborting"); writeReceipt({ fatal: "heal never landed", stage2: { pass, fail }, recordResult: readRecord(c2dId)?.result }); process.exit(2); }
const healAt = Date.now();
ok("S2 THE HEAL CAME ON A LATER TICK THAN THE QUESTION (the landing's own lateness)", healAt > (st2.openedAt ?? 0) + 20_000, `heal≈${new Date(healAt).toISOString()} vs openedAt=${new Date(st2.openedAt ?? 0).toISOString()}`);
ok("S2 THE T935 TAIL NEVER SPOKE (the cure's proof — 'already finished' would be the t935 arc's word spoken where its knowledge never reached)", !String(healed?.result ?? "").includes(HEAL_T935_TAIL), String(healed?.result ?? "").slice(0, 160));
ok("S2 THE ACCOUNTING QUESTION CLOSED (the landing clears the flag)", healed?.remote?.accountingPending === undefined, JSON.stringify(healed?.remote?.accountingPending ?? null));
ok("S2 THE LEDGER'S WORD ABOARD (exit 0, slurmState COMPLETED)", healed?.exitCode === 0 && healed?.remote?.slurmState === "COMPLETED", `exit=${JSON.stringify(healed?.exitCode ?? null)} state=${healed?.remote?.slurmState ?? "none"}`);

/* the dev log's landing line (the consult's own mouth) */
{
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000) {
    const ls = logStat(LANDING_LINE);
    if (ls.count > (st2.logBase?.landed ?? 0) && ls.last.includes(`"${NAME_CLASS2D}"`)) break;
    await sleep(1500);
  }
  const ls = logStat(LANDING_LINE);
  ok("S2 THE DEV LOG'S LANDING LINE (+1, named for this job — the consult's own mouth)", ls.count === (st2.logBase?.landed ?? 0) + 1 && ls.last.includes("COMPLETED (exit 0:0)") && ls.last.includes("the stop-receipt row healed completed"), ls.last.slice(-160));
}

/* THE ROW HEALED COMPLETED — the t935-widened flip */
const rowHealed = jobs().find((x) => x.id === c2dId);
ok("S2 THE ROW HEALED COMPLETED with the lost tail (status completed, progress 100, the heal's own words)", rowHealed?.status === "completed" && rowHealed?.progress === 100 && rowHealed?.result === HEAL_LOST_TAIL, `${rowHealed?.status}/${String(rowHealed?.result ?? "none").slice(0, 120)}`);

/* THE AUDIT'S FULL TALLY — the waits + the landing round */
const taxAfter = consultCount(SLURM_ID);
ok("S2 THE AUDIT'S TALLY — the consult asked MORE THAN ONCE (the waits) and the last round found the row", taxAfter >= (st2.auditBase ?? 0) + 2, `consults=${taxAfter} (baseline ${st2.auditBase ?? 0})`);

/* ================ THE CAPPED LANDING =====================================
 * the heal's own outputs question, answered by a find that SUCCEEDS with
 * a TRUNCATED world: the canary fires, the manifest lands truncated:true
 * at EXACTLY the cap, the landing line speaks the capped clause, and the
 * question closes WITH THE LANDED TAIL — not a strike. */
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
ok("S2 THE OUTPUTS QUESTION ANSWERED — the manifest leg landed through the live wire (the find SUCCEEDED: a partial answer is still an answer)", !!legLanded, legLanded ? `legLanded=${legLanded.lc}` : "no landed line in 150s");
if (!legLanded) { console.log("FATAL(stage2): the manifest leg never landed — aborting"); writeReceipt({ fatal: "manifest leg never landed", stage2: { pass, fail } }); process.exit(2); }
ok("S2 the outputs question CLOSED BY ITS OWN ANSWER (outputsLedgerPending cleared, outputsLedgerAt stamped — the landed tail)", legLanded?.rec?.remote?.outputsLedgerPending === undefined && typeof legLanded?.rec?.remote?.outputsLedgerAt === "number", `pending=${JSON.stringify(legLanded?.rec?.remote?.outputsLedgerPending ?? null)} at=${legLanded?.rec?.remote?.outputsLedgerAt ?? "none"}`);
ok("S2 NOT A STRIKE — no tries field anywhere (the t939 lane's silence: the three-round budget never started)", legLanded?.rec?.remote?.outputsLedgerTries === undefined, `tries=${JSON.stringify(legLanded?.rec?.remote?.outputsLedgerTries ?? null)}`);

/* the manifest itself — the canary's own testimony */
const man = readManifest(legLanded?.rec?.workdir ?? "");
ok("S2 THE MANIFEST EXISTS at the run's local workdir (the Files tab's future authorization)", !!man, String(legLanded?.rec?.workdir ?? "no workdir").slice(-46));
ok(`S2 THE CANARY FIRED — the manifest carries truncated:true (the t464 honesty riding the t626 landing)`, man?.truncated === true, `truncated=${JSON.stringify(man?.truncated ?? null)}`);
ok(`S2 THE CAP KEPT EXACTLY ${CAP_EXPECTED} ENTRIES (the server's own REMOTE_MANIFEST_MAX — the head took cap+1, the parser kept the cap)`, (man?.files?.length ?? 0) === CAP_EXPECTED, `${man?.files?.length ?? 0}/${CAP_EXPECTED}`);
{
  const paths = new Set((man?.files ?? []).map((f) => f.path));
  const door = ["run_data.star", "run_model.star", "run_optimiser.star"];
  ok("S2 THE DOOR FAMILY INSIDE THE CAPPED LEDGER (band a leads — the door never dies, the t464 law at the leg)", door.every((d) => paths.has(d)), door.map((d) => `${d}:${paths.has(d)}`).join(" "));
  const padKept = [...paths].filter((p) => p.startsWith(`${PAD_DIR_NAME}/`)).length;
  ok("S2 THE PAD FAMILY ENUMERATED (the cut spent itself INSIDE the pad band: the first pad file named, the pad's kept mass the deep budget's own — the exact boundary is readdir's business, the mass is the canary's)", paths.has(`${PAD_DIR_NAME}/f00001.pad`) && padKept > 15_000 && padKept < PAD_COUNT, `f00001:${paths.has(`${PAD_DIR_NAME}/f00001.pad`)} kept=${padKept}/${PAD_COUNT} (the cut fell inside the pad)`);
  ok("S2 THE LEDGER ITSELF NEVER LISTED (the .cf-* exclusion holds at 20k scale)", ![...paths].some((p) => p.startsWith(".cf-")), "");
}

/* the landing line's capped clause — the leg's own mouth */
{
  const ls = logStat(ROUND_LANDED);
  const last = ls.last;
  ok("S2 THE LANDING LINE (+1, named for this job)", ls.count > (st2.logBase?.legLanded ?? 0) && last.includes(`the outputs ledger landed for "${NAME_CLASS2D}"`), last.slice(-170));
  ok("S2 THE CAPPED CLAUSE VERBATIM ('the ledger is capped, the cluster holds more' — the leg's own confession riding the landing)", last.includes(CAPPED_CLAUSE), last.slice(-170));
  ok("S2 THE LANDING LINE NAMES THE MANIFEST-ONLY SHAPE ('manifest only; no sync-back ran' — the t626 doctrine intact)", last.includes("(manifest only; no sync-back ran)"), last.slice(-170));
}
ok("S2 THE CAPPED CLAUSE'S OWN COUNT (+1 — the clause has NEVER spoken in any prior arc; the baselines were relative)", cappedLegLandedCount() === (st2.logBase?.cappedLegLanded ?? 0) + 1, `capped=${cappedLegLandedCount()}/${st2.logBase?.cappedLegLanded ?? 0}`);

/* the row STILL completed with the lost tail — the capped landing heals
 * nothing, changes nothing: the manifest leg's whole business is the
 * ledger, and the ledger's cap is not the row's business */
const rowAfterLeg = jobs().find((x) => x.id === c2dId);
ok("S2 THE ROW UNTOUCHED BY THE CAPPED LANDING (completed + the lost tail, byte-identical)", rowAfterLeg?.status === "completed" && rowAfterLeg?.result === HEAL_LOST_TAIL, `${rowAfterLeg?.status}/${String(rowAfterLeg?.result ?? "none").slice(0, 100)}`);
const recAfterLeg = readRecord(c2dId);
ok("S2 THE RECORD'S WORDS UNTOUCHED by the manifest leg (the heal's sentence stands; the landing only closed the question)", recAfterLeg?.result === HEAL_LOST_TAIL && recAfterLeg?.exitCode === 0, `result=${String(recAfterLeg?.result ?? "none").slice(0, 90)}`);
ok("S2 THE PAD CENSUS HOLDS at the landing (the world the find met is the world the lever wrote)", padCount(st2.mockDir) === (st2.padCountAtStop ?? PAD_COUNT), `${padCount(st2.mockDir)}/${st2.padCountAtStop ?? PAD_COUNT}`);

writeState({ ...st2, healedDone: true, cappedDone: true, taxAfter, manifestFiles: man?.files?.length ?? 0 });
writeReceipt({ stage2: { pass, fail, healTail: HEAL_LOST_TAIL, taxAfter, legLanded: legLanded?.lc ?? null, manifestTruncated: man?.truncated === true, manifestFiles: man?.files?.length ?? 0, cappedClause: CAPPED_CLAUSE } });
console.log(`== t942 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

if (RUN_S3) {
/* ========================= stage 3 =======================================
 * THE CAPPED DOOR: the batch bring-home serves the capped ledger (the
 * final star AND a pad file both fetched home — the t464 law at the
 * products leg), the Files tab's note speaks the ledger sentence, the
 * completed face, the standing leave. */
console.log("== stage 3: the capped door, the honest note, the standing leave ==");
const st3 = readState();
const c2dId = st3.c2dId;
if (!c2dId || !st3.cappedDone) { console.log("FATAL(stage3): no state or the capped landing has not happened — run stages 1–2 first"); process.exit(2); }
sh(`${AB} open about:blank`);
await sleep(600);

const rec3 = readRecord(c2dId);
ok("S3 the heal's words still stand on the record", rec3?.result === HEAL_LOST_TAIL, String(rec3?.result ?? "none").slice(0, 120));

/* THE CAPPED DOOR — the manifest the leg landed names 20,000 cluster
 * files; the exact-entry door serves them (the honest opposite of the
 * t939 empty-400 and the t940 shut doors, at a TRUNCATED ledger) */
const man3 = readManifest(rec3?.workdir ?? "");
ok("S3 THE CAPPED MANIFEST RE-READ (truncated:true, the cap's own count — the door's authorization source)", man3?.truncated === true && (man3?.files?.length ?? 0) === CAP_EXPECTED, `truncated=${JSON.stringify(man3?.truncated ?? null)} files=${man3?.files?.length ?? 0}`);
if (man3?.files?.length) {
  const probeA = "run_optimiser.star";
  const probeB = `${PAD_DIR_NAME}/f00001.pad`;
  const syncP = api("POST", `/api/jobs/${c2dId}/outputs/sync`, { paths: [probeA, probeB] });
  ok(`S3 THE CAPPED DOOR OPENS (both probes ride the ledger's exact-entry authorization)`, syncP?.ok === true && Array.isArray(syncP?.results) && syncP.results.length === 2 && syncP.results[0]?.ok === true && syncP.results[1]?.ok === true, JSON.stringify(syncP).slice(0, 160));
  ok(`S3 THE DOOR'S TOTAL IS THE CAP ITSELF (total=${CAP_EXPECTED} — the capped ledger IS the authorization, whole)`, syncP?.total === CAP_EXPECTED, `total=${syncP?.total ?? "none"} remaining=${syncP?.remaining ?? "none"}`);
  ok("S3 THE DOOR'S REMAINING HONEST (both probes came home — remaining dipped below the total)", typeof syncP?.remaining === "number" && syncP.remaining < syncP?.total, `remaining=${syncP?.remaining ?? "none"} / total=${syncP?.total ?? "none"}`);
  const padHome = existsSync(path.join(rec3?.workdir ?? "", probeB));
  const starHome = existsSync(path.join(rec3?.workdir ?? "", probeA));
  ok("S3 THE PROBES ARE HOME (the star and the pad file both pulled through the capped door — the cap never killed the door)", padHome && starHome, `star=${starHome} pad=${padHome}`);
  writeReceipt({ stage3Door: { shape: "capped-ledger-200", probes: [probeA, probeB], total: syncP?.total ?? null, remaining: syncP?.remaining ?? null } });
}

/* THE FILES TAB'S NOTE — the ledger sentence (the t464 honesty in the
 * UI): the route reads the capped manifest, adds remote cards to its
 * display cap, and speaks ONE sentence naming the ledger's cut */
{
  const outP = apiJson(`/api/jobs/${c2dId}/outputs`);
  ok("S3 THE OUTPUTS ROUTE ANSWERS (the Files tab's well, at a capped ledger)", outP?.status === "ok" && Array.isArray(outP?.files), `status=${outP?.status ?? "none"} files=${outP?.files?.length ?? "none"}`);
  ok("S3 THE NOTE SPEAKS THE LEDGER SENTENCE ('the cluster holds more than the manifest's cap' — the t464 honesty in the UI)", typeof outP?.note === "string" && outP.note.includes(NOTE_LEDGER_WORD), String(outP?.note ?? "none").slice(0, 160));
  ok("S3 THE NOTE NAMES THE CURE ('the final star family is pinned first' — the door's own assurance)", typeof outP?.note === "string" && outP.note.includes(NOTE_DOOR_WORD), String(outP?.note ?? "none").slice(0, 160));
  ok("S3 THE DISPLAY CAP HIT (300 remote cards drawn from a 20,000-entry ledger — the note's count is the display's own)", (outP?.files?.length ?? 0) >= 300, `files=${outP?.files?.length ?? 0}`);
  ok("S3 THE PAD CARD RIDES (the inflation's own file visible in the listing — the cluster's truth the cap confessed to)", (outP?.files ?? []).some((f) => f?.path === `${PAD_DIR_NAME}/f00001.pad`), `${PAD_DIR_NAME}/f00001.pad:${(outP?.files ?? []).some((f) => f?.path === `${PAD_DIR_NAME}/f00001.pad`)}`);
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
ok("S3 THE COMPLETED FACE SPEAKS THE LOST HANDLE (the heal's own sentence on the card — the arc's whole knowledge)", face3?.healed === true && face3?.completed === true, `healed=${face3?.healed} completed=${face3?.completed}`);
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

/* the restore: the manifest-word binding law, the t916 remove (the pad
 * dies with the workdir), the standing leave, the seed trio, the
 * doctor */
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
/* the litter sweep — the pad (20,400 files) dies with the class2d_* dirs
 * on BOTH sides; pin the pad dir GONE (the arc's own lever cleaned up) */
try { sh(`rm -rf ${MOCK_PROJECTS}/${projId}/class2d_* ${MOCK_PROJECTS}/${projId}/extract_* ${MOCK_PROJECTS}/${projId}/autopick_* ${ROOT}/data/relion/${projId}/class2d_* ${ROOT}/data/relion/${projId}/extract_* ${ROOT}/data/relion/${projId}/autopick_* 2>/dev/null`); } catch {}
ok("S3 THE PAD SWEPT (the inflation's litter died with the workdir — no residue past the arc)", padCount(st3.mockDir) === 0, `pad=${padCount(st3.mockDir)}`);
const unbind3 = await retryApi("the unbind", () => api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null }));
ok("S3 THE STANDING LEAVE — unbound after the manifest is consumed (the t929/t930 law)", unbind3.ok === true, JSON.stringify(unbind3).slice(0, 60));
const connsRestored = connections();
ok(`S3 THE WIRE NEVER MOVED (the registry's standing shape: exactly one Mock Cluster at ${st3.standingConnId})`, connsRestored.length === 1 && connsRestored[0]?.id === st3.standingConnId, `conns=${connsRestored.length} id=${connsRestored[0]?.id ?? "none"}`);
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
writeReceipt({ stage3: { pass, fail, door: "capped-ledger-200", restore: "done" } });
console.log(`== t942 stage3 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage3") process.exit(fail === 0 ? 0 : 1);
} /* end stage3 */

console.log(`== t942 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);



