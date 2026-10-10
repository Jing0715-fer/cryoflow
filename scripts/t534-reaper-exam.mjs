// t534 — the reaper's LIVE exam. The t533 window mounted the global
// reconciler with wiring + bench evidence only; this script is the handoff's
// opening act: the exam nobody has run yet.
//
//   "派一个远端作业后切走 active 指针、关浏览器，15s 内看 inactive 世界自愈"
//
// The exam world goes DARK after setup: active pointer switched away, no
// browser alive (agent-browser pkill'd — the homepage's 2s poll is a GET
// driven tick for whichever world it shows), and this script itself speaks
// ONLY sqlite during observation. In that darkness:
//
//   A  a dispatched remote CtfFind (mock cluster, real ctffind shim) must
//      reach completed — finalized by the reaper's remote sweep leg,
//   B  a dispatched-early downstream twin (pending on inputs) must be
//      auto-started ON THE SAME CLUSTER by the reaper's transition leg and
//      finish remotely (remote passthrough, zero re-upload),
//   C  the prod log must show the reaper SAYING it — a "[reaper] tick:"
//      line with flips>=1 whose timestamp falls inside the exam window.
//
// If those flip while the world is inactive and unwatched, 「驱动 tick 的
// 人才看得见完成」 is dead law: nobody is driving, and the world heals.
//
// Run: node scripts/t534-reaper-exam.mjs   (prod on :3000, mock cluster :3022)
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { Socket } from "node:net";
import path from "node:path";

const BASE = "http://localhost:3000";
const DB = "/home/z/my-project/db/cryoflow.db";
const MICS_DIR = "/home/z/my-project/data/relion/t534-mics";
const PROJ_ROOT = "/home/z/my-project/data/relion";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";
const PROD_LOG = "/home/z/my-project/prod-3001.log";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

async function pollUntil(fn, deadlineMs, intervalMs = 1200) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

function mockListening() {
  return new Promise((resolve) => {
    const sock = new Socket();
    const done = (ok) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });
}

/** The silent observer: python3 sqlite3 read. NO HTTP during the exam.
 * ids travel as argv (parameterized '?' placeholders) — quoting inside
 * python -c strings is a minefield the first run already paid for. */
function dbJobs(ids) {
  const out = execSync(
    `python3 -c "import sqlite3,json,sys;c=sqlite3.connect('${DB}');` +
    `q='SELECT id,status,progress FROM Job WHERE id IN (%s)' % ','.join('?' * len(sys.argv[1:]));` +
    `print(json.dumps([{'id':r[0],'status':r[1],'progress':r[2]} for r in c.execute(q, sys.argv[1:])]))" ` +
    ids.join(" "),
    { encoding: "utf8", timeout: 10_000 }
  );
  return JSON.parse(out.trim().split("\n").pop());
}

const logSize = () => { try { return readFileSync(PROD_LOG, "utf8").length; } catch { return 0; } };
const logSlice = (from, to) => { try { return readFileSync(PROD_LOG, "utf8").slice(from, to); } catch { return ""; } };

console.log("== t534 reaper live exam — the world goes dark ==");
try { execSync("pkill -f agent-browser", { stdio: "pipe" }); } catch { /* none */ }

// ---- Phase A: setup (HTTP allowed — the exam hasn't started) ----
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}
must(await mockListening(), "the mock cluster answers on :3022");

// fabricate twenty micrographs (64x64 float32 — the t262 rig, scaled up:
// the mock ctffind's honest 1.2s/mic pace × 20 = a ~24s running window,
// wide enough that B parks pending inside A's run — at six micrographs
// A completed BEFORE B's dispatch and the exam raced itself)
mkdirSync(MICS_DIR, { recursive: true });
const W = 64, H = 64, NMICS = 20;
for (let k = 1; k <= NMICS; k++) {
  const n = `mic_${String(k).padStart(2, "0")}.mrc`;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin((i + k) / 7) * 0.1, 1024 + i * 4);
  writeFileSync(path.join(MICS_DIR, n), buf);
}
must(Array.from({ length: NMICS }, (_, i) => i + 1).every((k) => existsSync(path.join(MICS_DIR, `mic_${String(k).padStart(2, "0")}.mrc`))), "twenty mock micrographs fabricated");

// fresh connection + probe
const connId = `qa-t534-${Date.now().toString(36)}`;
const mk = await fetch(`${BASE}/api/remote/connections`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ id: connId, name: "QA t534 Reaper", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" }),
});
must(mk.status === 201, `the connection is created (${mk.status})`);
const test = await fetch(`${BASE}/api/remote/connections/${connId}/test`, { method: "POST", headers: SH });
const testBody = await test.json().catch(() => null);
must(test.status === 200 && testBody?.probe?.ok !== false, `the probe speaks (${test.status})`);

// exam project (POST /api/projects sets it active)
const proj = await (await fetch(`${BASE}/api/projects`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "QA t534 reaper exam" }),
})).json();
const projId = proj?.project?.id ?? proj?.id ?? null;
must(!!projId, `the exam project exists (${projId ?? "none"})`);

const mkJob = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json())?.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
  const r = await fetch(`${BASE}/api/edges`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }) });
  return r.status;
};

const importJob = await mkJob({ type: "import", name: "t534 Import", params: { micrographsPath: MICS_DIR, pixelSize: 1.77 } });
must(!!importJob?.id, "the import job exists");
await fetch(`${BASE}/api/jobs/${importJob.id}/run`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({}) });
const importDone = await pollUntil(async () => {
  const d = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
  return (d.jobs ?? []).find((x) => x.id === importJob.id)?.status === "completed" ? true : null;
}, 25_000);
must(!!importDone, "the local import completed");

// ctffind A — the exam's remote runner. params per the t533 contract: the
// mock cluster runs the REAL relion_run_ctffind now, and use_given_ps=true
// (the default) demands rlnCtfPowerSpectrum — a simplified import→ctffind
// chain has none. Computing spectra from the micrographs (use_given_ps=No,
// box 64) is a legitimate workflow choice, not a mock crutch.
const jobA = await mkJob({ type: "ctffind", name: "t534 CtfFind A", params: { use_given_ps: false, box: 64 } });
must(!!jobA?.id, "ctffind A created");
must((await mkEdge(importJob.id, jobA.id, "micrographs", "micrographs")) >= 200, "import → A wired");
const dispA = await fetch(`${BASE}/api/jobs/${jobA.id}/run`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1" } }),
});
const dispABody = await dispA.json().catch(() => null);
must(dispA.status === 200, `A dispatched to the cluster (${dispA.status}, err=${dispABody?.error ?? "-"})`);

// wait for A to be RUNNING before dispatching B (see B's note above)
const aRunning = await pollUntil(async () => {
  const st = dbJobs([jobA.id]).find((x) => x.id === jobA.id)?.status;
  return st === "running" ? st : null;
}, 30_000, 800);
must(!!aRunning, `A is RUNNING before B's dispatch (${aRunning ?? "never"})`);

// ctffind B — the transition + retry legs' target. PLANTED pending (sqlite
// UPDATE, no dispatch): the exam needs a pending row whose upstream is A,
// and the product's dispatch-time input resolution legitimately refuses to
// park a ctffind whose lineage contains a completed import (the accepts
// chain "micrographs_star from import" is a valid alternative — B would
// just run on the import's star, racing A out of the window). A planted
// pending row is exactly the orphan leg 4 exists to heal — and when A
// flips, BOTH the transition leg (autoStartPendingDownstream on the flip)
// and the 20s retry heartbeat can fire startJob(B), which INHERITS A's
// remote target (the passthrough) and runs B on the SAME cluster.
const jobB = await mkJob({ type: "ctffind", name: "t534 CtfFind B", params: { use_given_ps: false, box: 64 } });
must(!!jobB?.id, "ctffind B created");
must((await mkEdge(jobA.id, jobB.id, "micrographs", "micrographs")) >= 200, "A → B wired (B is A's downstream)");
execSync(
  `python3 -c "import sqlite3,sys;c=sqlite3.connect('${DB}');` +
  `c.execute('UPDATE Job SET status=?, progress=0, result=NULL WHERE id=?',('pending',sys.argv[1]));c.commit()" ${jobB.id}`,
  { timeout: 10_000 }
);
must(dbJobs([jobB.id]).find((x) => x.id === jobB.id)?.status === "pending", "B planted pending (the orphan the reaper heals)");

// wait for A to be visibly alive BEFORE the lights go out (setup-phase GETs
// are fine — reconcile is still active-scoped for this world right now)
const aAlive = await pollUntil(async () => {
  const d = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
  const j = (d.jobs ?? []).find((x) => x.id === jobA.id);
  return j && (j.status === "running" || j.status === "pending" || j.status === "completed") ? j.status : null;
}, 30_000, 800);
must(!!aAlive, `A left idle before the switch (first sight: ${aAlive})`);

// ---- the lights go OUT ----
const projects = (await (await fetch(`${BASE}/api/projects`, { headers: SH })).json());
const others = (projects.projects ?? projects ?? []).filter?.((p) => p.id !== projId) ?? [];
const otherId = others[0]?.id ?? null;
must(!!otherId, `another world to switch to (${otherId ?? "none"})`);
const sw = await fetch(`${BASE}/api/projects/switch`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ id: otherId }),
});
must(sw.status === 200, `active pointer switched AWAY from the exam world (${sw.status})`);

const logMark = logSize();
const t0 = Date.now();
console.log(`  (exam window opens at +0s — active world is now ${otherId}, no browser, no GET; observation is sqlite-only)`);

// ---- Phase B: the silent observation ----
// poll the DB every 2s; record every status change with its wall time
const seen = { [jobA.id]: [], [jobB.id]: [] };
const flipAt = { A: null, B_start: null, B_done: null };
let aCompleted = false, bCompleted = false;
const DEADLINE = Date.now() + 240_000;
while (Date.now() < DEADLINE && !(aCompleted && bCompleted)) {
  await sleep(2_000);
  for (const r of dbJobs([jobA.id, jobB.id])) {
    const key = r.id === jobA.id ? seen[jobA.id] : seen[jobB.id];
    const last = key[key.length - 1];
    if (!last || last.status !== r.status) {
      key.push({ status: r.status, at: Math.round((Date.now() - t0) / 1000) });
      console.log(`  (observe) t+${Math.round((Date.now() - t0) / 1000)}s ${r.id === jobA.id ? "A" : "B"} → ${r.status}`);
      if (r.id === jobA.id && r.status === "completed") aCompleted = true;
      if (r.id === jobB.id && r.status === "running") flipAt.B_start = Math.round((Date.now() - t0) / 1000);
      if (r.id === jobB.id && r.status === "completed") bCompleted = true;
    }
  }
}
must(aCompleted, `A reached completed IN THE DARK (${seen[jobA.id].map((s) => `${s.status}@+${s.at}s`).join(" → ")})`);
must(bCompleted, `B was auto-started and completed IN THE DARK (${seen[jobB.id].map((s) => `${s.status}@+${s.at}s`).join(" → ")})`);
// B's life in the dark must show the auto-start: pending (or idle) AFTER the
// window opened, then running — not running from the first sight (that
// would mean B never waited on A, i.e. the transition leg wasn't tested).
const bSawWaiting = seen[jobB.id].some((s) => s.status === "pending") || seen[jobB.id][0]?.status === "idle";
const bLateStart = seen[jobB.id].find((s) => s.status === "running")?.at ?? 0;
must(bSawWaiting && seen[jobB.id].length >= 2 && bLateStart > 0, `B's life shows a wait-then-start arc (${JSON.stringify(seen[jobB.id])})`);

// B's death sentence (if any): the row's own result line, read from the
// DB BEFORE cleanup destroys the world (t272: project DELETE sweeps the
// records — the evidence must be lifted while it exists)
const bResult = execSync(
  `python3 -c "import sqlite3,json,sys;c=sqlite3.connect('${DB}');` +
  `print(json.dumps(c.execute('SELECT status,result FROM Job WHERE id=?',(sys.argv[1],)).fetchone()))" ${jobB.id}`,
  { encoding: "utf8", timeout: 10_000 }
);
console.log(`  (B's verdict row) ${bResult.trim()}`);

// ---- Phase C: verdicts ----
// C1 — the reaper SAID it: a [reaper] tick line inside the exam window
const window = logSlice(logMark, logSize());
const reaperLines = window.split("\n").filter((l) => l.includes("[reaper] tick:"));
const flipsSeen = reaperLines.some((l) => {
  const m = l.match(/flips=(\d+)/);
  return m && Number(m[1]) >= 1;
});
must(!!flipsSeen, `the reaper confessed in the exam window (${reaperLines.length} tick lines, flips>=1: ${flipsSeen})`);
for (const l of reaperLines.slice(0, 4)) console.log(`    ${l.trim()}`);

// C2 — A's mirror + engine record finalized (the sweep's sync-back ran).
// The record read gets a grace window: the DB flip and the record write
// both live inside finalizeRemoteRun, but the sqlite poll may see the row
// flip before the file write lands — poll the record for up to 15s.
const readRec = (id) => {
  try {
    const d = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return d.runs?.[id] ?? d[id] ?? null; // the file is FLAT (jobId → record)
  } catch { return null; }
};
let recA = null, recB = null;
for (let i = 0; i < 15 && !(recA?.done && recB?.done); i++) {
  recA = readRec(jobA.id); recB = readRec(jobB.id);
  if (recA?.done && recB?.done) break;
  await sleep(1_000);
}
const projDir = path.join(PROJ_ROOT, projId);
const mirrorA = path.join(projDir, `ctffind_${jobA.id.slice(-8)}`);
must(existsSync(path.join(mirrorA, "micrographs_ctf.star")), "A's micrographs_ctf.star synced back to the mirror");
must(recA?.done === true && recA?.exitCode === 0, `A's run record finalized (done, exit 0) — the reaper's sweep did the books${recA ? "" : " — NO RECORD AT ALL"}`);
must(recB?.done === true && recB?.exitCode === 0, `B's run record finalized (done, exit 0)${recB ? "" : " — NO RECORD AT ALL"}`);
if (!recA?.done || !recB?.done) {
  console.log("  (autopsy) recA:", JSON.stringify(recA)?.slice(0, 400));
  console.log("  (autopsy) recB:", JSON.stringify(recB)?.slice(0, 400));
}
must(
  (recA?.remote?.remoteOutputs?.micrographs_ctf_star ?? "").startsWith("/projects/cryoflow"),
  "A keeps the remote output twin (downstream passthrough)"
);
// C3 — B ran REMOTELY (the passthrough): its record carries the connection
const recBRemote = recB?.remote?.connectionId === connId || (recB?.remote?.remoteWorkdir ?? "").startsWith("/projects/cryoflow");
must(!!recBRemote, "B ran on the SAME cluster (remote passthrough, zero re-upload)");

// C4 — cleanup: the exam world's residue (t530 roster law)
if (projId) {
  const del = await fetch(`${BASE}/api/projects/${projId}`, { method: "DELETE", headers: SH });
  console.log(`  (cleanup) exam project DELETE → ${del.status}`);
}
const delConn = await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH });
console.log(`  (cleanup) connection DELETE → ${delConn.status}`);

console.log(fail === 0 ? "\nREAPER EXAM: ALL PASS — the dark world healed itself" : `\nREAPER EXAM: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
