#!/usr/bin/env node
/**
 * t950 — the heal sentence table's OTHER side: the non-completed verdicts.
 *
 * THE AUDIT THIS RIDE CORRECTS: the worklog carried "the wire-down
 * COMPLETED heal's cell (line 8048) — the one heal cell still unwitnessed"
 * for seven windows. The carried premise is FALSE: the t936 receipt
 * (stage1, GREEN 31/0, at 2026-10-12T18:11:57Z) holds the line-8048
 * sentence VERBATIM on the record and the row ("the cluster ledger
 * recorded the run COMPLETED (exit 0:0) — the stop had no wire to the
 * cluster; the run finished on its own"), and t941's re-key left the
 * wireDown branch's words byte-identical (git -L: f9329283 introduced the
 * branch WITH its witness; 64f1dd82 added lostHandle BETWEEN wireDown and
 * the plain tail — 8048 untouched). The audit's full coverage matrix:
 *
 *   COMPLETED side                          witnessed by
 *   8048  missed + wireDown                 t936 stage1 (receipt verbatim)
 *   8050  missed + lostHandle               t941 stage2
 *   8051  missed + refusal 'finished'       t935 stage1
 *   8052  NOT missed (the cancel accepted,  — nearly unreachable: a
 *         the run finished first)             successful scancel writes the
 *                                             .cancelled flag and the
 *                                             launcher stands down; the
 *                                             ledger then says CANCELLED,
 *                                             not COMPLETED. A real-slurm
 *                                             microsecond race.
 *   non-completed side
 *   8055  missed + wireDown                 ← THIS RIDE (stage1)
 *   8056  missed + refused (either word)    ← THIS RIDE (stage2)
 *   8057  NOT missed                        — near-unreachable for the
 *                                             same flag reason (a scancel'd
 *                                             job's own ledger word is
 *                                             CANCELLED via scancel's row;
 *                                             the launcher's FAILED row
 *                                             loses the last-row-wins race).
 *   the killed confirm (CANCELLED, not missed) — t934 stage1.
 *
 * THE ARC (stage1 — the 8055 cell): the t936 arc replayed with a DIFFERENT
 * ledger verdict. The mint re-rides, the bind, iterations=16, the blind
 * window (about:blank), run_it001 landed, THE WIRE CUT, THE STOP that
 * could not reach (the receipt's wire-down sentence, the row's manual-kill
 * word, the deferring stamp, the question {missed:true, class:'wire-down'})
 * — then THE FAIL LEVER: the relion_refine descendant TERMed HOST-SIDE (a
 * pid-scoped kill — scancel's group kill would hit the launcher and leave
 * the journal BLANK, the t932 silence). The script's `__rc=$?` reads 143,
 * .cf-exit speaks 143, the launcher journals `<id>|FAILED|143:0|…` — the
 * ledger's word written host-side while the app, wireless, keeps the miss
 * words standing. THE WIRE RETURNS (a NEW connection id — the t325-a drift
 * shape), the consult rides it, finds the FAILED row, and speaks the
 * wire-down FAILED tail — the cell's own words:
 *
 *   "the cluster ledger recorded the run FAILED (exit 143:0) — the stop
 *    had no wire to the cluster; the ledger's word stands"
 *
 * — landing on the record (exitCode 143 aboard, slurmState FAILED, the
 * question closed, the OUTPUTS question opened and answered through the
 * new wire) and swapping onto the row (status failed, the miss word
 * replaced by the ledger's word — the t935-widened flip's non-completed
 * shape), and the FAILED face speaks it.
 *
 * THE ARC (stage2 — the 8056 cell): the t941 lever + the fail lever. The
 * wire NEVER moves; the pid file removed host-side (the controller's
 * memory loss), THE STOP while the run is alive: the receipt's lost word
 * ("scancel N failed: scancel: error: Invalid job id specified"), the
 * row's refused miss word (the t935/t938 word), the question
 * {missed:true, refusal:'lost'} with class ABSENT, the proof of life (the
 * rounds climb), the consult's WAIT (the audit grows while the journal
 * stays rowless — the t941 tax law re-proven) — then THE FAIL LEVER: the
 * relion_refine descendant TERMed, the FAILED row lands, the consult
 * speaks the refused FAILED tail:
 *
 *   "the cluster ledger recorded the run FAILED (exit 143:0) — the stop
 *    had found no live session to kill; the ledger's word stands"
 *
 * — the t935 words' non-completed twin. THE FINDING THE CELL DOCUMENTS:
 * the non-completed side does NOT branch on lostHandle (only the
 * COMPLETED side does) — the lost nuance never reaches the FAILED tail.
 * The words stay honest ("found no live session to kill" is true for both
 * refusal words); the pin records the shape so the table's asymmetry is
 * WRITTEN, not silent.
 *
 *   node scripts/t950-wire-down-failed-witness.mjs stage1|stage2|main
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t950-wire-down-failed-witness.json";
const STATE = path.join(ROOT, "data", "t950-wire-down-failed.json");
const MOCK_FS = path.join(ROOT, "services", "mock-cluster", "fs");
const MOCK_PROJECTS = path.join(MOCK_FS, "projects", "cryoflow");
const SLURM_DIR = path.join(MOCK_FS, "home", "cryo", ".slurm");
const ENGINE_STATE = path.join(ROOT, "data", "engine-state.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CLASS2D = "t916 class2d witness";
const ITERS = 16;

/* the wire-down class's own words (the t936 cures, verbatim — the arc's setup) */
const WIRE_DOWN_MSG = "the connection for this run was deleted — kill the process on the cluster manually";
const WD_STAMP = "stop missed — the connection for this run was deleted; the cluster ledger decides the final state";
const WD_ROW = "stop missed (the connection for this run was deleted) — kill the process on the cluster manually; the cluster ledger decides the final state if a wire returns";
/* the refused class's own words (the t935/t941 cures, verbatim — stage2's setup) */
const LOST_MSG_WORD = "Invalid job id specified";
const REFUSED_STAMP = "stop missed — no live cluster session found; the cluster ledger decides the final state";
const REFUSED_ROW = "stop missed (no live cluster session found) — the cluster ledger decides the final state when the run's records come home";
/* the heal sentence table's shared prefix + THIS RIDE's two tails */
const HEAL_PREFIX = "the cluster ledger recorded the run";
const FAILED_WD_TAIL = "the stop had no wire to the cluster; the ledger's word stands";
const FAILED_REFUSED_TAIL = "the stop had found no live session to kill; the ledger's word stands";
/* the COMPLETED tails' absence pins (the cell separation) */
const COMPLETED_WD_PHRASE = "the run finished on its own";
const LOST_COMPLETED_PHRASE = "the cluster no longer knew the job";
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
const accountingRows = () => {
  try { return readFileSync(path.join(SLURM_DIR, "accounting"), "utf8").trim().split("\n").filter(Boolean); } catch { return []; }
};
const auditLines = () => {
  try { return readFileSync(path.join(SLURM_DIR, "exec-audit.log"), "utf8").trim().split("\n").filter(Boolean).length; } catch { return 0; }
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
    const f = readdirSync(SLURM_DIR)
      .filter((f) => /^job-\d+\.pid$/.test(f))
      .map((f) => {
        const full = path.join(SLURM_DIR, f);
        const body = readFileSync(full, "utf8").trim().split(/\s+/);
        return { file: f, id: body[0], pid: Number(body[1]), mtime: statSync(full).mtimeMs };
      })
      .filter((p) => Date.now() - p.mtime < 120_000)
      .sort((a, b) => b.mtime - a.mtime)[0];
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
const pidFileFor = (id) => path.join(SLURM_DIR, `job-${id}.pid`);

/* THE FAIL LEVER — a pid-scoped TERM on the relion_refine descendant.
 * scancel's GROUP kill would take the launcher too and leave the journal
 * BLANK (the t932 silence — no verdict to consult). The launcher must
 * survive to journal the script's non-zero exit: TERM the python only,
 * the script's `__rc=$?` reads 143, .cf-exit speaks, the launcher writes
 * `<id>|FAILED|143:0|…`. */
const childPids = (pid) => {
  try {
    const out = execFileSync("bash", ["-c", `cat /proc/${pid}/task/*/children 2>/dev/null`], { encoding: "utf8" });
    return out.trim().split(/\s+/).filter(Boolean).map(Number);
  } catch { return []; }
};
const cmdlineOf = (pid) => {
  try { return readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " "); } catch { return ""; }
};
const findRelionDescendant = (pid, depth = 0) => {
  if (depth > 4) return null;
  for (const c of childPids(pid)) {
    if (/relion_refine/.test(cmdlineOf(c))) return c;
    const deep = findRelionDescendant(c, depth + 1);
    if (deep) return deep;
  }
  return null;
};
const termPid = (pid) => {
  try { execFileSync("/bin/kill", ["-TERM", String(pid)], { stdio: "ignore" }); return true; } catch { return false; }
};
/* the launcher's FAILED journal row — read host-side, the verdict derived
 * from the ledger's own bytes (the exit label is the row's, not ours) */
const failedRowFor = (slurmId) => {
  const row = accountingRows().find((r) => r.startsWith(`${slurmId}|FAILED|`));
  if (!row) return null;
  const f = row.split("|");
  return { row, state: f[1], exitLabel: f[2] ?? "?", exitNum: Number((f[2] ?? "?:").split(":")[0]) };
};
const completedRowFor = (slurmId) => accountingRows().find((r) => r.startsWith(`${slurmId}|COMPLETED|`)) ?? null;

/* the FAILED face read: the inspector's Overview card (the row's word lives
 * there — the t936 climb law: the climb precedes every face read) */
const faceRead = (name, tail) => evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); const t = d?.textContent || ''; return JSON.stringify({ named: !!d, failed: t.includes('Job failed'), ledger: t.includes(${JSON.stringify(tail)}), stopBtn: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Stop'), rerun: [...(d?.querySelectorAll('button') ?? [])].some(b => (b.textContent || '').trim() === 'Re-run') }); })()`);
const climbAndReadFace = async (name, tail) => {
  let face = faceRead(name, tail);
  for (let i = 0; i < 3 && face?.ledger !== true; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim() === 'Overview') ?? null; })()`);
    await sleep(1100);
    face = faceRead(name, tail);
  }
  return face;
};

const STAGE = process.argv[2] ?? "main";
const RUN_S1 = STAGE === "main" || STAGE === "stage1";
const RUN_S2 = STAGE === "main" || STAGE === "stage2";

/* ============================ prep ======================================== */
console.log(`== t950 prep (stage ${STAGE}): the seed trio pinned, the world read ==`);
const projId = "cmv4v0ue60000pp5i7i2gu10k";
const seedMc0 = findName(NAME_MC_A);
const seedCtf0 = findName(NAME_CTF_A);
ok("prep the seed trio present", !!seedMc0 && !!seedCtf0, `${seedMc0?.status}/${seedCtf0?.status}`);
const seedEdge0 = seedMc0 && seedCtf0 ? edges().find((e) => e.fromJobId === seedMc0.id && e.toJobId === seedCtf0.id) : null;
ok("prep the seed MC-1→CTF-1 edge rides", !!seedEdge0, seedEdge0?.id?.slice(0, 8));

/* the standing wire: the world's one Mock Cluster at its standing id (the
 * registry's shape every arc starts from) */
const standing = connSnapshot();
const ORIG_CONN_ID = standing?.id ?? readState().origConnId ?? null;
ok("prep the Mock Cluster connection present", !!standing?.id, `${standing?.id ?? "none"} ${standing?.host ?? "?"}:${standing?.port ?? "?"}`);
if (!standing?.id) { console.log("FATAL: no Mock Cluster connection — aborting"); writeReceipt({ fatal: "no connection" }); process.exit(2); }

/* the self-heal: a class2d-free world + the mint (shared by both stages) */
const healAndMint = async (tag) => {
  let c2d = findName(NAME_CLASS2D);
  if (c2d) {
    const healBinding = manifestBinding();
    try { api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: healBinding }); } catch {}
    try { sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch {}
    c2d = findName(NAME_CLASS2D);
    if (c2d) {
      console.log("  (self-heal: the remove refused — the manual downstream-first delete rides)");
      for (const j of jobs().filter((x) => ["autopick", "extract", "class2d", "select2d"].includes(x.type)).reverse()) {
        try { api("DELETE", `/api/jobs/${j.id}`); } catch {}
      }
      try { sh(`rm -rf ${MOCK_PROJECTS}/${projId}/class2d_* ${ROOT}/data/relion/${projId}/class2d_*`); } catch {}
      c2d = findName(NAME_CLASS2D);
    }
  }
  ok(`${tag} the world starts class2d-free (the self-heal)`, !c2d);
  let mintOut = "(never ran)";
  try { mintOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs mint 2>&1`); } catch (e) { mintOut = String(e); }
  ok(`${tag} the t916 mint GREEN`, /mint GREEN — \d+ ok, 0 fail/.test(mintOut), (mintOut.match(/== mint .*/) ?? ["?"])[0]);
  c2d = findName(NAME_CLASS2D);
  ok(`${tag} the class2d witness completed (the mint's own run)`, c2d?.status === "completed", c2d?.status);
  return c2d?.status === "completed" ? c2d : null;
};

if (RUN_S1) {
/* ========================= stage 1 =======================================
 * THE WIRE-DOWN FAILED TAIL (the 8055 cell): the wire cut, the stop that
 * could not reach, THE FAIL LEVER, the wire's return, the ledger's word
 * stands. */
console.log("== stage 1: the wire cut, the stop, THE FAIL LEVER, the FAILED tail ==");
const c2d = await healAndMint("S1");
if (!c2d) { console.log("FATAL: no class2d witness — aborting"); writeReceipt({ fatal: "no class2d" }); process.exit(2); }
const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: ORIG_CONN_ID });
ok("S1 THE PROJECT BOUND through the product's own door", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));
const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok("S1 the class2d's iterations pinned at 16 through the PATCH door (the ~18s window)", !!patchP.job?.id && String(patchP.job?.params?.iterations) === "16", JSON.stringify(patchP.job?.params ?? patchP).slice(0, 90));
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

/* the blind window: the browser parks on about:blank — ONE GET after the
 * wire cut would let the run sweep's no-conn branch steal the stop's lane
 * (the vanish word — the t936 law) */
sh(`${AB} open about:blank`);
await sleep(600);

let arc = null;
for (let attempt = 1; attempt <= 3 && !arc; attempt++) {
  console.log(`-- S1 wire-down attempt ${attempt} --`);
  if (!connections().some((x) => x.id === ORIG_CONN_ID)) {
    const rc = recreateWire(standing, ORIG_CONN_ID);
    ok(`S1 attempt ${attempt} the wire re-created (the previous attempt's cut undone)`, !!rc?.connection?.id, rc?.error ?? "");
  }
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S1 attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  const fresh = await freshPid();
  if (!fresh?.pid) { ok(`S1 attempt ${attempt} the launcher pid found`, false, "no fresh job-*.pid"); continue; }
  ok(`S1 attempt ${attempt} the launcher pid read (slurm ${fresh.id}, pid ${fresh.pid})`, true, "");
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
  if (!pidAlive(fresh.pid)) { ok(`S1 attempt ${attempt} the launcher alive at cut time`, false, "already dead"); continue; }

  /* THE WIRE CUT */
  const cutP = api("DELETE", `/api/remote/connections/${ORIG_CONN_ID}`);
  const gone = !connections().some((x) => x.id === ORIG_CONN_ID);
  ok(`S1 attempt ${attempt} THE WIRE CUT — the connection deleted through the API door`, cutP.ok === true && gone, `ok=${cutP.ok} gone=${gone}`);
  if (!(cutP.ok === true && gone)) continue;

  /* THE STOP THAT COULD NOT REACH — no /api/jobs GET in between */
  const stopP = api("POST", `/api/jobs/${c2d.id}/stop`);
  if (stopP.error && !stopP.outcome) { ok(`S1 attempt ${attempt} THE STOP FIRED on the live row`, false, JSON.stringify(stopP).slice(0, 110)); continue; }
  ok(`S1 attempt ${attempt} THE STOP FIRED on the live row (no 409 — the sweep never ticked)`, true, "");
  const stampOk = stopP.stopped === false && stopP.outcome === "missed" && stopP.settled === null && stopP.message === WIRE_DOWN_MSG
    && stopP.job?.status === "failed" && stopP.job?.result === WD_ROW;
  ok(`S1 attempt ${attempt} THE WIRE-DOWN SETUP verbatim (the receipt's sentence, the row's manual-kill word)`, stampOk, `${stopP.outcome}/${String(stopP.message ?? "none").slice(0, 60)}`);
  if (!stampOk) continue;
  const recStop = readRecord(c2d.id);
  const qOk = recStop?.done === true && recStop?.result === WD_STAMP && (recStop?.exitCode ?? null) === null
    && recStop?.remote?.accountingPending?.missed === true && recStop?.remote?.accountingPending?.class === "wire-down";
  ok(`S1 attempt ${attempt} THE QUESTION OPEN with missed:true AND class:'wire-down' (the landing will know which promise it fulfills)`, qOk, JSON.stringify(recStop?.remote?.accountingPending ?? null));
  if (!qOk) continue;

  /* THE FAIL LEVER — the relion_refine descendant TERMed host-side */
  const relionPid = findRelionDescendant(fresh.pid);
  if (!relionPid || !termPid(relionPid)) { ok(`S1 attempt ${attempt} THE FAIL LEVER THROWN (the relion_refine descendant TERMed)`, false, `relionPid=${relionPid ?? "none"}`); continue; }
  ok(`S1 attempt ${attempt} THE FAIL LEVER THROWN — relion_refine pid ${relionPid} TERMed (the script exits 143, the launcher journals)`, true, "");
  let frow = null;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 20_000) {
      frow = failedRowFor(fresh.id);
      if (frow) break;
      await sleep(500);
    }
  }
  if (!frow) { ok(`S1 attempt ${attempt} THE LEDGER'S FAILED ROW lands host-side`, false, completedRowFor(fresh.id) ? "COMPLETED landed instead — the run beat the lever" : "no row in 20s"); continue; }
  ok(`S1 attempt ${attempt} THE LEDGER'S FAILED ROW lands host-side (written while the app is wireless — unheard)`, true, `${frow.state} exit ${frow.exitLabel}`);
  const recUnheard = readRecord(c2d.id);
  const unheardOk = recUnheard?.result === WD_STAMP && !!recUnheard?.remote?.accountingPending;
  ok(`S1 attempt ${attempt} THE MISS WORDS STAND over the failed run (the app honest about its ignorance)`, unheardOk, String(recUnheard?.result ?? "none").slice(0, 60));
  if (!unheardOk) continue;
  arc = { slurmId: fresh.id, pid: fresh.pid, attempt, exitLabel: frow.exitLabel, exitNum: frow.exitNum, cutAt: new Date().toISOString() };
  break;
}
if (!arc) { console.log("FATAL: the wire-down FAILED arc never landed — aborting"); writeReceipt({ fatal: "arc never landed", stage1: { pass, fail } }); process.exit(2); }
writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, origConnId: ORIG_CONN_ID, ...arc });

/* THE EXPECTED SENTENCE — the ledger's own exit label in the cell's words */
const S1_SENTENCE = `${HEAL_PREFIX} FAILED (exit ${arc.exitLabel}) — ${FAILED_WD_TAIL}`;

/* THE WIRE RETURNS — a NEW connection id (the genuine re-add; the record's
 * dead connectionId must be resolved by the host:port fallback, t325-a) */
const rcP = recreateWire(standing, null);
const newConnId = rcP?.connection?.id ?? null;
ok("S1 THE WIRE RETURNS — a NEW connection re-created with the mock's own fields (the t325-a drift shape)", !!newConnId && newConnId !== ORIG_CONN_ID, `${newConnId ?? "none"} (was ${ORIG_CONN_ID})`);
if (!newConnId) { console.log("FATAL: the re-create refused — aborting"); writeReceipt({ fatal: "re-create refused" }); process.exit(2); }

/* THE HEAL LANDS — the consult rides the NEW wire, finds the FAILED row,
 * and speaks the wire-down FAILED tail (the ledger's word stands — never
 * a completed-side phrase: the run did NOT finish) */
let recHeal = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 240_000) {
    jobs(); // every GET is one sweep tick — the consult's driver
    const rec = readRecord(c2d.id);
    if (rec?.result?.startsWith(HEAL_PREFIX) && rec?.result?.includes(FAILED_WD_TAIL)) { recHeal = rec; break; }
    await sleep(2000);
  }
}
ok("S1 THE FAILED TAIL VERBATIM on the record (the 8055 cell's own words, the ledger's exit label aboard)", recHeal?.result === S1_SENTENCE, String(recHeal?.result ?? "none").slice(0, 170));
ok("S1 THE COMPLETED SIDE NEVER SPOKE (the run did not finish — the finished-on-its-own phrase would be the 8048 cell's word in the wrong cell)", !!recHeal && !recHeal.result.includes(COMPLETED_WD_PHRASE), "");
ok("S1 THE LEDGER'S WORD ABOARD (exit from the row, slurmState FAILED, the question closed)", recHeal?.exitCode === arc.exitNum && recHeal?.remote?.slurmState === "FAILED" && !recHeal?.remote?.accountingPending, `exit=${recHeal?.exitCode} state=${recHeal?.remote?.slurmState} acc=${JSON.stringify(recHeal?.remote?.accountingPending ?? null)}`);

/* THE OUTPUTS QUESTION: the landing opens it (the sync-back never ran for
 * this run), the new wire answers it (the manifest lands) */
let outLanded = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000) {
    const rec = readRecord(c2d.id);
    if (rec?.remote?.outputsLedgerAt != null && rec?.remote?.outputsLedgerPending == null) { outLanded = rec; break; }
    jobs();
    await sleep(2000);
  }
}
ok("S1 THE OUTPUTS QUESTION OPENED AND ANSWERED (the landing opened it, the new wire's manifest closed it)", outLanded?.remote?.outputsLedgerAt != null, `at=${outLanded?.remote?.outputsLedgerAt ?? "never"}`);

/* THE ROW'S FINAL WORD: the sentence swaps onto the failed row (the
 * non-completed flip's own shape — status failed, only the words move) */
let rowHeal = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    const j = jobs().find((x) => x.id === c2d.id);
    if (j?.status === "failed" && String(j?.result ?? "").startsWith(HEAL_PREFIX)) { rowHeal = j; break; }
    await sleep(2000);
  }
}
ok("S1 THE ROW SPEAKS THE LEDGER'S WORD (the miss word replaced — the durable surface carries the verdict)", rowHeal?.status === "failed" && rowHeal?.result === S1_SENTENCE, `${rowHeal?.status}/${String(rowHeal?.result ?? "none").slice(0, 130)}`);

/* THE FAILED FACE: the warm-up reload law, the inspector, the climb */
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (v) => v.cards >= 3, 30);
await sleep(800);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (v) => v.cards >= 3, 30);
await sleep(1200);
const insp1 = await openInspectorHard(NAME_CLASS2D);
ok("S1 the FAILED job's inspector opens", String(insp1).startsWith("open@try"), String(insp1));
await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ tabs: [...(d?.querySelectorAll('[role="tab"]') ?? [])].map(t => (t.textContent || '').trim()) }); })()`,
  (v) => v.tabs?.includes("Overview") === true, 12, 600,
);
const face1 = await climbAndReadFace(NAME_CLASS2D, FAILED_WD_TAIL);
ok("S1 THE FAILED FACE SPEAKS THE LEDGER'S WORD (the card's word carries the tail)", face1?.failed === true && face1?.ledger === true, JSON.stringify(face1 ?? {}));
ok("S1 THE FAILED FACE HAS NO STOP VERB (Re-run stands where Stop stood)", face1?.stopBtn === false && face1?.rerun === true, `stop=${face1?.stopBtn} rerun=${face1?.rerun}`);
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

/* THE RESTORE: the NEW wire stands down, the ORIGINAL re-created (the
 * registry's standing shape), the t916 remove, the unbound leave, the
 * seed trio, the doctor */
console.log("== stage 1 (restore) ==");
/* the NEW wire stands down — the DELETE's own word checked, retried (a
 * transient curl hiccup must not leave a ghost connection behind: the
 * ride-1 lesson — the swallowed throw left conn-mv64… standing and the
 * restore pin honest-RED) */
let delOk = false;
for (let i = 0; i < 5 && !delOk; i++) {
  const delP = api("DELETE", `/api/remote/connections/${newConnId}`);
  delOk = delP?.ok === true;
  if (!delOk) await sleep(1000);
}
ok("S1 THE NEW WIRE STANDS DOWN (the DELETE's own ok)", delOk && !connections().some((x) => x.id === newConnId), `new=${newConnId}`);
const restoreConn = connections().some((x) => x.id === ORIG_CONN_ID) ? null : recreateWire(standing, ORIG_CONN_ID);
ok("S1 THE ORIGINAL CONNECTION RESTORED (exactly one Mock Cluster at its standing id)", connections().length === 1 && connections()[0]?.id === ORIG_CONN_ID, `conns=${connections().length} id=${connections()[0]?.id ?? "none"}`);
const mBinding = manifestBinding();
try { api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: mBinding }); } catch {}
let removeOut = "(never ran)";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
ok("S1 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
try { api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null }); } catch {}
ok("S1 the world back to the seed trio (3 jobs)", jobs().length === 3, String(jobs().length));
ok("S1 the world holds exactly 2 edges", edges().length === 2, String(edges().length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S1 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({ stage1: { pass, fail, slurmId: arc.slurmId, receipt: { stopped: false, outcome: "missed" }, exitLabel: arc.exitLabel, sentence: S1_SENTENCE, newConnId, restore: "done" } });
console.log(`== t950 stage1 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage1") process.exit(fail === 0 ? 0 : 1);
} /* end stage1 */

if (RUN_S2) {
/* ========================= stage 2 =======================================
 * THE REFUSED FAILED TAIL (the 8056 cell): the lost-handle lever + the
 * fail lever, the wire NEVER moves, the consult's wait pays the tax. */
console.log("== stage 2: the lost handle, the stop, THE FAIL LEVER, the refused FAILED tail ==");
const c2d = await healAndMint("S2");
if (!c2d) { console.log("FATAL: no class2d witness — aborting"); writeReceipt({ fatal: "no class2d s2", stage2: { pass, fail } }); process.exit(2); }
const bindP = api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: ORIG_CONN_ID });
ok("S2 THE PROJECT BOUND (the wire never moves all arc)", bindP.ok === true && bindP.rebound === true, JSON.stringify(bindP).slice(0, 80));
const patchP = api("PATCH", `/api/jobs/${c2d.id}`, { params: { iterations: ITERS } });
ok("S2 the class2d's iterations pinned at 16 (the run's whole life inside VANISH_AGE_MS=120s)", !!patchP.job?.id && String(patchP.job?.params?.iterations) === "16", "");
const c2dMockDir = path.join(MOCK_PROJECTS, projId, `class2d_${c2d.id.slice(-8)}`);

sh(`${AB} open about:blank`);
await sleep(600);

let arc = null;
for (let attempt = 1; attempt <= 3 && !arc; attempt++) {
  console.log(`-- S2 lost-handle attempt ${attempt} --`);
  const runP = api("POST", `/api/jobs/${c2d.id}/run`);
  if (runP.error) { ok(`S2 attempt ${attempt} the bare POST accepted`, false, JSON.stringify(runP).slice(0, 90)); continue; }
  const fresh = await freshPid();
  if (!fresh?.pid) { ok(`S2 attempt ${attempt} the launcher pid found`, false, "no fresh job-*.pid"); continue; }
  ok(`S2 attempt ${attempt} the launcher pid read (slurm ${fresh.id}, pid ${fresh.pid})`, true, "");
  let depth = 0;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 45_000) {
      depth = mockRounds(c2dMockDir).length;
      if (depth >= 1) break;
      await sleep(300);
    }
  }
  if (depth < 1) { ok(`S2 attempt ${attempt} run_it001 landed before the lever (mid-flight depth)`, false, "no rounds in 45s"); continue; }
  if (!pidAlive(fresh.pid)) { ok(`S2 attempt ${attempt} the launcher alive at lever time`, false, "already dead"); continue; }

  /* THE LEVER — the controller loses the job's handle (the t941 lever) */
  const pidFile = pidFileFor(fresh.id);
  if (!existsSync(pidFile)) { ok(`S2 attempt ${attempt} the pid file still stands at lever time`, false, "gone already"); continue; }
  rmSync(pidFile);
  ok(`S2 attempt ${attempt} THE LEVER THROWN — job-${fresh.id}.pid GONE (the controller's memory loss)`, !existsSync(pidFile), pidFile.split("/").pop());

  /* THE STOP while the run is alive — the refused class's lost word.
   * The receipt's top-level shape carries {job, stopped, outcome, message,
   * settled} — the missClass/refusal knowledge rides the QUESTION (the
   * t941 pinning law: the receipt's shape + message, the question's lost
   * word), never a top-level field. */
  const stopP = api("POST", `/api/jobs/${c2d.id}/stop`);
  const shapeOk = stopP.stopped === false && stopP.outcome === "missed" && stopP.settled === null;
  ok(`S2 attempt ${attempt} THE RECEIPT'S SHAPE (stopped=false, outcome='missed', settled=null)`, shapeOk, `${stopP.outcome}/${stopP.settled}`);
  const msgOk = String(stopP.message ?? "").startsWith(`scancel ${fresh.id} failed`) && stopP.message.includes(LOST_MSG_WORD) && !stopP.message.includes("already finished");
  ok(`S2 attempt ${attempt} THE RECEIPT'S LOST WORD verbatim ('scancel N failed: scancel: error: Invalid job id specified' — never 'already finished')`, msgOk, String(stopP.message ?? "none").slice(0, 100));
  const rowOk = stopP.job?.status === "failed" && stopP.job?.result === REFUSED_ROW;
  ok(`S2 attempt ${attempt} THE ROW'S REFUSED WORD verbatim (the t935/t938 word — the class's durable surface unchanged)`, rowOk, `${stopP.job?.status}/${String(stopP.job?.result ?? "none").slice(0, 80)}`);
  if (!(shapeOk && msgOk && rowOk)) continue;
  const recStop = readRecord(c2d.id);
  const q = recStop?.remote?.accountingPending;
  const qOk = recStop?.done === true && recStop?.result === REFUSED_STAMP && (recStop?.exitCode ?? null) === null
    && q?.missed === true && q?.refusal === "lost" && q?.class === undefined;
  ok(`S2 attempt ${attempt} THE QUESTION OPEN {missed:true, refusal:'lost'} with class ABSENT (the t941 lane rides the lost word only)`, qOk, JSON.stringify(q ?? null));
  if (!qOk) continue;

  /* THE PROOF OF LIFE — the rounds climb after the stop (the run went on) */
  const roundsAtStop = mockRounds(c2dMockDir).length;
  await sleep(4000);
  const roundsAfter = mockRounds(c2dMockDir).length;
  ok(`S2 attempt ${attempt} THE PROOF OF LIFE (the rounds climbed ${roundsAtStop}→${roundsAfter} after the stop — the run went on)`, roundsAfter > roundsAtStop, "");

  /* THE CONSULT'S WAIT — the audit grows while the journal stays rowless
   * (the !f branch's patience, the t941 tax law) */
  const auditBefore = auditLines();
  const rowlessAtWait = !accountingRows().some((r) => r.startsWith(`${fresh.id}|`));
  for (let i = 0; i < 3; i++) { jobs(); await sleep(2000); }
  const auditAfter = auditLines();
  ok(`S2 attempt ${attempt} THE WAIT PAYS THE WIRE'S TAX (the audit grew ${auditBefore}→${auditAfter} while the journal stayed rowless — the consult asks, the ledger is silent)`, rowlessAtWait && auditAfter > auditBefore, `audit ${auditBefore}→${auditAfter}`);

  /* THE FAIL LEVER — the same pid-scoped TERM (stage1's lever, the live
   * wire's world) */
  const relionPid = findRelionDescendant(fresh.pid);
  if (!relionPid || !termPid(relionPid)) { ok(`S2 attempt ${attempt} THE FAIL LEVER THROWN`, false, `relionPid=${relionPid ?? "none"}`); continue; }
  ok(`S2 attempt ${attempt} THE FAIL LEVER THROWN — relion_refine pid ${relionPid} TERMed`, true, "");
  let frow = null;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 20_000) {
      frow = failedRowFor(fresh.id);
      if (frow) break;
      await sleep(500);
    }
  }
  if (!frow) { ok(`S2 attempt ${attempt} THE LEDGER'S FAILED ROW lands (after the question opened — the ordering the wait pinned)`, false, completedRowFor(fresh.id) ? "COMPLETED instead" : "no row in 20s"); continue; }
  ok(`S2 attempt ${attempt} THE LEDGER'S FAILED ROW lands AFTER the question opened (the launcher's own row, the late ordering)`, true, `${frow.state} exit ${frow.exitLabel}`);
  arc = { slurmId: fresh.id, pid: fresh.pid, attempt, exitLabel: frow.exitLabel, exitNum: frow.exitNum, roundsAtStop, roundsAfter };
  break;
}
if (!arc) { console.log("FATAL: the lost-handle FAILED arc never landed — aborting"); writeReceipt({ fatal: "s2 arc never landed", stage2: { pass, fail } }); process.exit(2); }
writeState({ c2dId: c2d.id, projId, mockDir: c2dMockDir, origConnId: ORIG_CONN_ID, ...arc });

const S2_SENTENCE = `${HEAL_PREFIX} FAILED (exit ${arc.exitLabel}) — ${FAILED_REFUSED_TAIL}`;

/* THE HEAL LANDS — the consult rides the LIVE wire (the t941 shape), finds
 * the FAILED row on a later tick, and speaks the refused FAILED tail */
let recHeal = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 240_000) {
    jobs();
    const rec = readRecord(c2d.id);
    if (rec?.result?.startsWith(HEAL_PREFIX) && rec?.result?.includes(FAILED_REFUSED_TAIL)) { recHeal = rec; break; }
    await sleep(2000);
  }
}
ok("S2 THE REFUSED FAILED TAIL VERBATIM on the record (the 8056 cell's own words)", recHeal?.result === S2_SENTENCE, String(recHeal?.result ?? "none").slice(0, 170));
ok("S2 THE LOST NUANCE NEVER REACHED THE FAILED SIDE (the table's asymmetry WRITTEN: only the COMPLETED side branches on lostHandle — 'no longer knew the job' is the 8050 cell's phrase)", !!recHeal && !recHeal.result.includes(LOST_COMPLETED_PHRASE), "");
ok("S2 THE LEDGER'S WORD ABOARD (exit from the row, slurmState FAILED, the question closed)", recHeal?.exitCode === arc.exitNum && recHeal?.remote?.slurmState === "FAILED" && !recHeal?.remote?.accountingPending, `exit=${recHeal?.exitCode} state=${recHeal?.remote?.slurmState}`);

/* THE OUTPUTS QUESTION answered by the live wire (the t938/t941 precedent) */
let outLanded = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 90_000) {
    const rec = readRecord(c2d.id);
    if (rec?.remote?.outputsLedgerAt != null && rec?.remote?.outputsLedgerPending == null) { outLanded = rec; break; }
    jobs();
    await sleep(2000);
  }
}
ok("S2 THE OUTPUTS QUESTION ANSWERED (the landing opened it, the live wire's manifest closed it)", outLanded?.remote?.outputsLedgerAt != null, `at=${outLanded?.remote?.outputsLedgerAt ?? "never"}`);

/* THE ROW'S FINAL WORD + THE FAILED FACE */
let rowHeal = null;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 120_000) {
    const j = jobs().find((x) => x.id === c2d.id);
    if (j?.status === "failed" && String(j?.result ?? "").startsWith(HEAL_PREFIX)) { rowHeal = j; break; }
    await sleep(2000);
  }
}
ok("S2 THE ROW SPEAKS THE LEDGER'S WORD (the t935/t938 miss word replaced)", rowHeal?.status === "failed" && rowHeal?.result === S2_SENTENCE, `${rowHeal?.status}/${String(rowHeal?.result ?? "none").slice(0, 130)}`);

sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (v) => v.cards >= 3, 30);
await sleep(800);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (v) => v.cards >= 3, 30);
await sleep(1200);
const insp2 = await openInspectorHard(NAME_CLASS2D);
ok("S2 the FAILED job's inspector opens", String(insp2).startsWith("open@try"), String(insp2));
await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${NAME_CLASS2D}')); return JSON.stringify({ tabs: [...(d?.querySelectorAll('[role="tab"]') ?? [])].map(t => (t.textContent || '').trim()) }); })()`,
  (v) => v.tabs?.includes("Overview") === true, 12, 600,
);
const face2 = await climbAndReadFace(NAME_CLASS2D, FAILED_REFUSED_TAIL);
ok("S2 THE FAILED FACE SPEAKS THE LEDGER'S WORD", face2?.failed === true && face2?.ledger === true, JSON.stringify(face2 ?? {}));
try { sh(`${AB} press Escape`); } catch {}
await sleep(600);

/* THE RESTORE: the wire NEVER moved (the registry's standing shape
 * untouched), the t916 remove, the unbound leave, the seed trio, the doctor */
console.log("== stage 2 (restore) ==");
ok("S2 THE WIRE NEVER MOVED (exactly one Mock Cluster at its standing id)", connections().length === 1 && connections()[0]?.id === ORIG_CONN_ID, `conns=${connections().length} id=${connections()[0]?.id ?? "none"}`);
const mBinding = manifestBinding();
try { api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: mBinding }); } catch {}
let removeOut = "(never ran)";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
ok("S2 the t916 remove GREEN", /remove GREEN — \d+ ok, 0 fail/.test(removeOut), (removeOut.match(/== remove .*/) ?? ["?"])[0]);
try { api("PATCH", `/api/projects/${projId}`, { remoteConnectionId: null }); } catch {}
ok("S2 the world back to the seed trio (3 jobs)", jobs().length === 3, String(jobs().length));
ok("S2 the world holds exactly 2 edges", edges().length === 2, String(edges().length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("S2 the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({ stage2: { pass, fail, slurmId: arc.slurmId, exitLabel: arc.exitLabel, sentence: S2_SENTENCE, restore: "done" } });
console.log(`== t950 stage2 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "stage2") process.exit(fail === 0 ? 0 : 1);
} /* end stage2 */

console.log(`== t950 witness (${STAGE}) ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
if (STAGE === "main") process.exit(fail === 0 ? 0 : 1);
