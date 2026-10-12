#!/usr/bin/env node
/**
 * t935 — the missed stop's honest lane: a stop whose scancel finds
 * NOTHING (the run had already finished), the deferring stamp, and the
 * ledger's heal — the third verdict word beside the stamp and the
 * tombstone.
 *
 * Never witnessed before this ride: the t618/t625 contract's missed path
 * ("a missed kill claims NOTHING — no 137, no 'stopped by user'; the
 * ledger record keeps whatever exit it logged; the cluster-ledger
 * reconcile lands the real truth when the run's records come home") was
 * built in unit fires but had NO live fire — and could not even HAVE one
 * on the mock: the mock's scancel exited 0 on every miss, hiding the miss
 * from the app entirely. A stop that arrived after the run had finished
 * claimed "cluster-side session killed" and earned the user-stop stamp
 * over a run it never touched. THE t935 CURES:
 *
 *   1. the mock's scancel speaks the REAL scancel's exit code — the miss
 *      branches exit 1 ("Invalid job id specified" / "already finished"),
 *      so the app's receipt reads an honest "missed";
 *   2. the echo yields to the LEDGER'S OWN LANDING (the t935 extension of
 *      the t934 stampKept law): a record whose words already came from the
 *      accounting consult ("the cluster ledger recorded the run …")
 *      outranks the wrapper's exit the same way the user's hand does;
 *   3. the heal's flip widens: the accounting landing's completed heal
 *      touches a failed OR an already-completed row (only stop-records
 *      carry the open question — a natural completion's row is never
 *      touched), so the heal's richer sentence reaches the row even when
 *      the echo's completed flip got there first.
 *
 * THE ARC (stage1): a 2-iteration run dies naturally (~3s); the
 * instrument watches the ACCOUNTING FILE ONLY (host-side — every
 * /api/jobs GET is one poll-sweep tick, and the sweep would finalize the
 * death before the stop could miss); the moment the ledger's COMPLETED
 * row lands, THE STOP FIRES through the API door (the browser parks on
 * about:blank — the UI's own poll would drive the sweep too). The receipt:
 * stopped=false, outcome "missed", settled null, the message carrying the
 * mock's "already finished"; the job DTO speaks the route's miss word
 * verbatim; the record carries the DEFERRING stamp ("stop missed — no
 * live cluster session found; the cluster ledger decides the final
 * state", missed:true, NO exit code — a missed kill claims nothing). Then
 * the sweeps resume: the echo speaks (the deferral — the wrapper's exit 0
 * lands, the row flips completed), and the ledger's consult heals the
 * record ("the cluster ledger recorded the run COMPLETED (exit 0:0) — the
 * stop had found nothing to kill because the run had already finished")
 * and lands THE HEAL SENTENCE ON THE ROW (the widened flip) — the run the
 * user tried to stop ends COMPLETED, its receipt naming both the miss and
 * the finish. "The heal is a landing, not a flip."
 *
 * stage2 — THE REFUSAL BACKSTOP: a second run completes; a stop POST
 * against a terminal row earns the 409 ("Job is not running (status:
 * completed)") and claims nothing; the UI's completed face has no Stop
 * verb at all. The restore: the manifest-word binding law, the seed trio
 * + 2 edges, the doctor CLEAN.
 *
 *   node scripts/t935-stop-after-finish-heal-witness.mjs stage1|stage2|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t935-stop-after-finish-heal-witness.json";
const STATE = path.join(ROOT, "data", "t935-stop-after-finish.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");
const ENGINE_STATE = path.join(ROOT, "data", "engine-state.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
const ITERS = 2;
/* the missed receipt's own words (the t618/t625 contract, verbatim) */
const MISSED_STAMP = "stop missed — no live cluster session found; the cluster ledger decides the final state";
const MISSED_ROW = "stop missed (no live cluster session found) — the cluster ledger decides the final state when the run's records come home";
const HEAL_PREFIX = "the cluster ledger recorded the run COMPLETED";
const HEAL_MISSED_TAIL = "the stop had found nothing to kill because the run had already finished";

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
  /* 10 × 4s = 40s of patience (the t934 curl-exit-7 law: the dev server
   * can die mid-ride and take ~60s to come back) */
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
/* the run record's own testimony — the engine's state file, read HOST-SIDE
 * (no /api/jobs GET: every GET is one poll-sweep tick, and the sweep would
 * finalize the death the instrument is trying to stop inside) */
const readRecord = (jobId) => {
  try { return JSON.parse(readFileSync(ENGINE_STATE, "utf8"))[jobId] ?? null; } catch { return null; }
};
/* the manifest-word binding law (the t932/t933 lesson) */
const manifestBinding = () => {
  try { return JSON.parse(readFileSync(path.join(ROOT, "data", "t916-class2d-mint.json"), "utf8")).binding ?? null; } catch { return null; }
};

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_S2 = STAGE === "main" || STAGE === "stage2";

/* ============================ prep ======================================== */
console.log(`== t935 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * THE MISSED ARC: the run dies naturally, the stop fires through the API
 * door inside the monitor's blind window, the deferring stamp lands, the
 * echo speaks, the ledger's heal lands on the row. */
console.log("== stage 1: the mint re-rides, the fast death, THE STOP THAT MISSED ==");
let c2d = findName(NAME_CLASS2D);
if (c2d) {
  /* the self-heal: the manifest-word binding patch FIRST (the t933 law),
   * then the t916 remove; if the manifest is gone, the manual
   * downstream-first delete + both sides' workdir sweeps (the t930 escape) */
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

/* the t300 binding door — the bare POST below rides the binding's lane */
const connsP = apiJson("/api/remote/connections").connections ?? [];
const connP = connsP.find((c) => c.name === "Mock Cluster");
ok("S1 the Mock Cluster connection resolved", !!connP?.id, connP?.id?.slice(0, 14));
if (!connP?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: connP.id });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));

/* the FAST run: iterations=2 — the stub dies naturally in ~3s, and the
 * stop must fire inside the monitor's blind window (the sweeps are driven
 * by /api/jobs GETs, and this stage makes NONE until the receipt is home) */
const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok("S1 the class2d's iterations pinned at 2 through the PATCH door (the fast natural death)", !!patchP.job?.id && String(patchP.job?.params?.iterations) === "2", JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

/* the browser parks on about:blank for the whole drive — the UI's own
 * 5s poll is ALSO a sweep driver, and one poll inside the blind window
 * would finalize the death before the stop could miss */
sh(`${AB} open about:blank`);
await sleep(600);

let missed = null;
for (let attempt = 1; attempt <= 3 && !missed; attempt++) {
  console.log(`-- S1 missed attempt ${attempt} --`);
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S1 attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  ok(`S1 attempt ${attempt} the bare POST accepted (the binding's lane)`, true, "");
  /* the fresh launcher pid — submitted seconds ago (host-side reads only) */
  let fresh = null;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000) {
      fresh = slurmPids().filter((p) => Date.now() - p.mtime < 120_000).sort((a, b) => b.mtime - a.mtime)[0];
      if (fresh?.id) break;
      await sleep(300);
    }
  }
  if (!fresh?.id) { ok(`S1 attempt ${attempt} the launcher pid found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid read (slurm ${fresh.id}, pid ${fresh.pid})`, true, "");
  /* THE DEATH WATCH — host-side only: the accounting journal's COMPLETED
   * row for THIS slurmId is the cluster's own verdict, landing at the
   * stub's death, before the app knows a thing */
  let dead = false;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 45_000) {
      if (accountingRows().some((r) => r.startsWith(`${fresh.id}|`) && r.includes("COMPLETED"))) { dead = true; break; }
      await sleep(200);
    }
  }
  if (!dead) { ok(`S1 attempt ${attempt} THE DEATH WATCH — the ledger's COMPLETED row landed (the cluster's own verdict, host-side read)`, false, "no COMPLETED row in 45s"); continue; }
  ok(`S1 attempt ${attempt} THE DEATH WATCH — the ledger's COMPLETED row landed (the cluster's own verdict, host-side read)`, true, "");
  /* THE ROW STILL RUNNING — read through the receipt's own door below, not
   * via a GET (a GET is a sweep tick); the stop POST's 409 would name it */
  /* THE STOP THAT MISSED — the API door, fired the moment the death landed */
  const stopP = api("POST", `/api/jobs/${c2d.id}/stop`);
  if (stopP.error === "parse" || (!stopP.stopped && !stopP.outcome && stopP.error)) {
    /* a 409 refusal means the sweep's beat won the race (the row already
     * terminal) — an honest loss; retry with a fresh run */
    ok(`S1 attempt ${attempt} THE STOP FIRED inside the blind window (no 409 — the sweep's beat had not spoken)`, false, JSON.stringify(stopP).slice(0, 110));
    /* wait for the row to settle terminal before the next attempt's POST */
    {
      const t1 = Date.now();
      while (Date.now() - t1 < 60_000) {
        const st = jobs().find((x) => x.id === c2d.id)?.status;
        if (st === "completed" || st === "failed") break;
        await sleep(1500);
      }
    }
    continue;
  }
  ok(`S1 attempt ${attempt} THE STOP FIRED inside the blind window (no 409 — the sweep's beat had not spoken)`, true, "");
  /* THE MISSED RECEIPT — the t618 contract's third class, verbatim */
  ok(`S1 attempt ${attempt} THE RECEIPT'S CLASS: stopped=false, outcome='missed', settled=null (the question never applied — scancel refused)`, stopP.stopped === false && stopP.outcome === "missed" && stopP.settled === null, `stopped=${stopP.stopped} outcome=${stopP.outcome} settled=${stopP.settled}`);
  ok(`S1 attempt ${attempt} THE MESSAGE NAMES THE MISS — the scancel's failure and the mock's own word ('already finished')`, String(stopP.message ?? "").includes("scancel") && String(stopP.message ?? "").includes("already finished"), String(stopP.message ?? "").slice(0, 140));
  /* THE ROW'S MISS WORD — the route's own hand, read from the receipt's
   * job DTO (the row as the route wrote it: failed + the miss speech) */
  ok(`S1 attempt ${attempt} THE ROW'S MISS WORD verbatim (the route's own write, read from the receipt's job DTO — no GET, no sweep)`, stopP.job?.status === "failed" && stopP.job?.result === MISSED_ROW, `${stopP.job?.status}/${String(stopP.job?.result ?? "none").slice(0, 90)}`);
  /* THE RECORD'S DEFERRING STAMP — done, NO exit code, the miss named, the
   * question open with missed:true (the ledger decides the final state) */
  const recMiss = readRecord(c2d.id);
  ok(`S1 attempt ${attempt} THE DEFERRING STAMP verbatim (done, NO exit code — a missed kill claims nothing)`, recMiss?.done === true && recMiss?.result === MISSED_STAMP && (recMiss?.exitCode ?? null) === null, `done=${recMiss?.done} exit=${recMiss?.exitCode ?? "none"} result=${String(recMiss?.result ?? "none").slice(0, 60)}`);
  ok(`S1 attempt ${attempt} THE QUESTION OPEN with missed:true (the ledger decides the final state)`, !!recMiss?.remote?.accountingPending && recMiss?.remote?.accountingPending?.missed === true, JSON.stringify(recMiss?.remote?.accountingPending ?? null));
  missed = { slurmId: fresh.id, pid: fresh.pid, attempt, receipt: { stopped: stopP.stopped, outcome: stopP.outcome, settled: stopP.settled, message: stopP.message }, missedAt: new Date().toISOString() };
  break;
}
if (!missed) { console.log("FATAL: the missed stop never landed — aborting"); writeReceipt({ fatal: "missed never landed" }); process.exit(2); }
writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, ...missed });

/* THE SWEEPS RESUME: the echo speaks (the deferral — the missed stamp
 * yields by its own words), then the ledger's consult lands the heal. The
 * echo's interim and the heal's landing are both honest reads; the
 * PERMANENT contract is the heal. */
const echoOrHeal = await (async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 240_000) {
    const rec = readRecord(c2d.id);
    if (rec?.result?.startsWith(HEAL_PREFIX)) return { stage: "heal", rec };
    if (rec?.result?.startsWith("REMOTE[") && rec?.exitCode === 0) return { stage: "echo", rec };
    await sleep(2500);
  }
  return { stage: "timeout", rec: readRecord(c2d.id) };
})();
ok("S1 THE ECHO SPOKE (the deferral — the missed stamp yields by its own words; the wrapper's exit 0 lands) OR THE HEAL ALREADY LANDED", echoOrHeal.stage === "echo" || echoOrHeal.stage === "heal", `stage=${echoOrHeal.stage} result=${String(echoOrHeal.rec?.result ?? "none").slice(0, 80)}`);
if (echoOrHeal.stage === "echo") {
  ok("S1 THE ECHO'S EXIT IS THE RUN'S OWN (0 — the natural death, no 137: the missed stamp claimed nothing and the echo keeps its word)", echoOrHeal.rec?.exitCode === 0, `exit=${echoOrHeal.rec?.exitCode}`);
}

/* THE HEAL LANDS — the t625 landing's own sentence, the missed variant */
let recHeal = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 240_000) {
    const rec = readRecord(c2d.id);
    if (rec?.result?.startsWith(HEAL_PREFIX) && rec?.result?.includes(HEAL_MISSED_TAIL)) { recHeal = rec; break; }
    await sleep(2500);
  }
}
ok("S1 THE HEAL SENTENCE VERBATIM on the record ('…COMPLETED (exit 0:0) — the stop had found nothing to kill because the run had already finished')", !!recHeal, String(recHeal?.result ?? "none").slice(0, 160));
ok("S1 THE LEDGER'S WORD ABOARD (exit 0, slurmState COMPLETED, the question closed)", recHeal?.exitCode === 0 && recHeal?.remote?.slurmState === "COMPLETED" && !recHeal?.remote?.accountingPending, `exit=${recHeal?.exitCode} slurmState=${recHeal?.remote?.slurmState} acc=${JSON.stringify(recHeal?.remote?.accountingPending ?? null)}`);

/* THE ROW'S FINAL WORD: the heal sentence (the widened flip — the row was
 * already completed when the consult landed, and the flip reached it) */
let rowHeal = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    const j = jobs().find((x) => x.id === c2d.id);
    if (j?.status === "completed" && String(j?.result ?? "").startsWith(HEAL_PREFIX)) { rowHeal = j; break; }
    await sleep(2000);
  }
}
ok("S1 THE ROW HEALED COMPLETED with the heal sentence verbatim (the widened flip's landing — 'the heal is a landing, not a flip')", rowHeal?.status === "completed" && String(rowHeal?.result ?? "").includes(HEAL_MISSED_TAIL), `${rowHeal?.status}/${String(rowHeal?.result ?? "none").slice(0, 120)}`);

/* THE COMPLETED FACE: the fresh page (the warm-up reload law), the
 * inspector, the Overview climb — the run the user tried to stop ends
 * completed, its receipt naming both the miss and the finish */
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
/* the tabs-wait (the cold-page artifact law): the dialog's shell can paint
 * before its tab list hydrates — wait for the tab row before the climb */
await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ tabs: [...(d?.querySelectorAll('[role="tab"]') ?? [])].map(t => (t.textContent || '').trim()) }); })()`,
  (v) => v.tabs?.includes("Overview") === true, 12, 600,
);
let ov1 = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
let face1 = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ completedWords: t.includes('Completed ·'), heal: t.includes(${JSON.stringify(HEAL_PREFIX)}), miss: t.includes('the stop had found nothing to kill'), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`,
  (v) => v.heal === true, 12, 500,
);
if (face1?.heal !== true) {
  /* the entrance-animation ghost law: ONE honest retry */
  ov1 = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
  face1 = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CLASS2D}')); const t = d?.textContent || ''; return JSON.stringify({ completedWords: t.includes('Completed ·'), heal: t.includes(${JSON.stringify(HEAL_PREFIX)}), miss: t.includes('the stop had found nothing to kill'), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`,
    (v) => v.heal === true, 12, 500,
  );
}
ok("S1 the Overview climb clicked", String(ov1).startsWith("clicked@"), String(ov1));
ok("S1 the card speaks 'Completed · <duration>' (the completed face's own word — the failed face's 'Job failed' twin)", face1?.completedWords === true);
ok("S1 THE HEAL SENTENCE HANGS ON THE CARD (the row's final word travels to the face)", face1?.heal === true && face1?.miss === true, `heal=${face1?.heal} miss=${face1?.miss}`);
ok("S1 THE COMPLETED FACE HAS NO STOP VERB (the Re-run branch stands where Stop stood — the UI's own prevention)", face1?.stopBtn === false && face1?.rerun === true, `stop=${face1?.stopBtn} rerun=${face1?.rerun}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

writeReceipt({ stage1: { pass, fail, slurmId: missed.slurmId, receipt: missed.receipt, echoStage: echoOrHeal.stage, heal: recHeal?.result ?? "", row: rowHeal?.result ?? "" } });
console.log(`== t935 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_S2) {
/* ========================= stage 2 =======================================
 * THE REFUSAL BACKSTOP: a stop POST against a terminal row earns the 409
 * and claims nothing; the UI's completed face has no Stop verb at all. */
console.log("== stage 2: the refusal backstop, the restore ==");
const st2 = readState();
const c2dId = st2.c2dId;
let c2d = findName(NAME_CLASS2D);
ok("S2 the healed arc stands (completed, the heal sentence aboard)", c2d?.id === c2dId && c2d?.status === "completed" && String(c2d?.result ?? "").startsWith(HEAL_PREFIX), `${c2d?.status}/${String(c2d?.result ?? "").slice(0, 60)}`);
if (!c2d || c2d.status !== "completed") { console.log("FATAL(stage2): the class2d is not completed — run stage1 first"); process.exit(2); }

/* a second from-scratch run: fn_cont is empty (this arc never set it), the
 * PATCH's iterations=2 persists — the fast death again, then the monitor's
 * own finalize lands the row completed (no stop involved this time) */
const runP2 = api("POST", `/api/jobs/${c2d.id}/run`);
ok("S2 the bare POST accepted (the second from-scratch dispatch)", !runP2.error, JSON.stringify(runP2).slice(0, 60));
let rowDone2 = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    const j = jobs().find((x) => x.id === c2d.id);
    if (j?.status === "completed" || j?.status === "failed") { rowDone2 = j; break; }
    await sleep(2000);
  }
}
ok("S2 the second run COMPLETED (the monitor's own finalize — no stop involved)", rowDone2?.status === "completed", `${rowDone2?.status}/${String(rowDone2?.result ?? "none").slice(0, 60)}`);
const rowBeforeRefusal = `${rowDone2?.status}/${rowDone2?.result}`;
/* the ledger's baseline AFTER the run's own death (the launcher's
 * COMPLETED journal row is the run's, not the refusal's) */
const before2 = accountingRows().length;

/* THE REFUSAL: the stop POST against the terminal row — the 409, the
 * cause named, the row untouched */
const refuseP = api("POST", `/api/jobs/${c2d.id}/stop`);
ok("S2 THE REFUSAL — 409 with the status named ('Job is not running (status: completed)')", refuseP.error === "Job is not running (status: completed)", JSON.stringify(refuseP).slice(0, 110));
const rowAfterRefusal = jobs().find((x) => x.id === c2d.id);
ok("S2 THE ROW UNTOUCHED (the refusal claims nothing — the receipt stands)", `${rowAfterRefusal?.status}/${rowAfterRefusal?.result}` === rowBeforeRefusal, `${rowAfterRefusal?.status}/${String(rowAfterRefusal?.result ?? "none").slice(0, 70)}`);
ok("S2 NO NEW LEDGER ROW for the refused stop (nothing was cancelled)", accountingRows().length === before2, `${accountingRows().length - before2} new rows`);

/* THE UI'S PREVENTION: the completed face's inspector has no Stop verb at
 * all (the Re-run branch stands where Stop stood) */
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 6, 30);
await sleep(800);
sh(`${AB} press Control+f`);
await sleep(500);
sh(`${AB} keyboard type "${NAME_CLASS2D}"`);
await sleep(600);
sh(`${AB} press Enter`);
await sleep(900);
sh(`${AB} press Escape`);
await sleep(400);
await settleCensus();
const insp2 = await openInspectorHard(NAME_CLASS2D);
ok("S2 the completed face's inspector opens", String(insp2).startsWith("open@try"), String(insp2));
const verbs2 = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ stop: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`,
  (v) => v.rerun === true, 12, 500,
);
ok("S2 THE UI NEVER OFFERS THE STALE STOP (no Stop verb on the completed face)", verbs2?.stop === false && verbs2?.rerun === true, `stop=${verbs2?.stop} rerun=${verbs2?.rerun}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

/* the restore: the manifest-word binding law (the t933 lesson), then the
 * t916 remove (idempotent-deletion-safe), then the standing leave */
const mBinding = manifestBinding();
const rebind2 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: mBinding });
ok(`S2 THE BINDING RETURNED TO THE MINT-TIME VALUE (the manifest's own word: ${mBinding === null ? "null — the unbound mint" : "the connection"})`, rebind2.ok === true, `m.binding=${String(mBinding).slice(0, 24)}`);
let removeOut = "(never ran)";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
ok("S2 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
const unbind2 = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null });
ok("S2 THE STANDING LEAVE — unbound after the manifest is consumed (the t929/t930 law)", unbind2.ok === true, JSON.stringify(unbind2).slice(0, 60));
const jobsAfter = jobs();
const edgesAfter = edges();
ok("S2 the world back to the seed trio (3 jobs)", jobsAfter.length === 3, String(jobsAfter.length));
ok("S2 the world holds exactly 2 edges", edgesAfter.length === 2, String(edgesAfter.length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S2 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);
writeReceipt({ stage2: { pass, fail, refusal: refuseP.error ?? null, untouched: rowAfterRefusal?.status, restore: "done" } });
console.log(`== t935 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

console.log(`== t935 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
