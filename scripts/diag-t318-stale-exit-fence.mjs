#!/usr/bin/env node
/**
 * t318 diag — the re-run's ghost: a stale .cf-exit must never forge the
 * previous run's verdict onto a fresh dispatch.
 *
 * The user's ticket (post-t316, the FIRST re-run after the symlink fix):
 *
 *   Job failed
 *   REMOTE[lijing@192.168.2.253]: exit 1 (RELION reported an error) —
 *   1 bulky file(s) stayed on the cluster (key-files policy): run.out
 *   (download failed) — …
 *   FAILURE DIAGNOSIS: 0 findings — scanned the full run.out …
 *
 * The anatomy (every oddity explained by ONE race):
 *  - the ctffind workdir is STABLE across re-runs (<root>/ctffind_<jobid8>)
 *    and t314's failed run left `.cf-exit` = 1 inside it;
 *  - the re-run's sbatch script only rm's that file WHEN THE JOB STARTS —
 *    behind seconds of profile+module preamble (or a whole queue wait);
 *  - the poll sweep reads .cf-exit EXISTENCE as the verdict → the first
 *    tick inside that window finalized the fresh dispatch with the OLD
 *    exit code (forged "exit 1", no evidence tail: slurmstepd had just
 *    truncated run.out and nothing was printed yet);
 *  - the sync then raced the still-growing run.out into the t299 byte
 *    account ("download failed") while the REAL cluster job kept running
 *    unwatched.
 *
 * TWO BLADES, both proven live against the mock cluster on the dev server:
 *
 *  A. the PRE-SUBMIT CLEAR (blade 1): the dispatch removes the previous
 *     run's .cf-exit/.cf-pid/run.out/run.err (+ array temps) BEFORE
 *     submitting, and stamps the cluster's clock as the dispatch fence.
 *     PROVEN: a planted t314-shaped ghost (exit 1 + a poisoned run.out +
 *     a fake .cf-pid) vanishes before the job starts, and the dispatch
 *     completes honestly with its OWN verdict.
 *  B. the MTIME FENCE (blade 2): aliveCheckScript only trusts a .cf-exit
 *     whose mtime is ≥ fence−2s; an older file is the previous run's
 *     ghost and the check falls through to the honest ladder (squeue/
 *     sacct say whether anything is live). PROVEN in the hardest window:
 *     a backdated ghost planted MID-RUN (while the sweep is ticking every
 *     4s) never flips the running job — the old code would have finalized
 *     it "exit 1" within one tick.
 *  C. the same contract in DIRECT mode (the setsid wrapper's world).
 *  D. the LEDGER: source contracts + the record's dispatchedAtEpoch.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const CONN = "qa-t318";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};
const SHJ = { ...SH, "Content-Type": "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 800) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  }).stdout?.trim() ?? "";
const clientBoth = (cmd) => {
  const r = spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
  return `${r.stdout?.trim() ?? ""}${r.stderr?.trim() ? ` <<stderr>> ${r.stderr.trim()}` : ""}`.trim();
};

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const createdJobs = [];
let projectId = null;
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  if (b?.job?.projectId) projectId = b.job.projectId;
  return b?.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
  (
    await api("/api/edges", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    })
  ).status;

const dispatchCtf = (id, mode = "slurm") =>
  api(`/api/jobs/${id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      remote: { connectionId: CONN, module: "relion/5.0.1", mode, gpus: 1 },
    }),
  });

// the t314 ghost, verbatim in shape: the old verdict + the poisoned log
const plantGhost = (workdir, { backdate = false } = {}) => {
  const out = clientBoth(
    `mkdir -p ${workdir}; echo 1 > ${workdir}/.cf-exit; ` +
      `echo 99999 12345 > ${workdir}/.cf-pid; ` +
      `echo 'CRYOFLOW_NOTE: GHOST-LOG-t318 from the previous failed run' > ${workdir}/run.out; ` +
      `echo 'ERROR: Failed to make a symlink from X to X' >> ${workdir}/run.out; ` +
      `echo '(old stderr)' > ${workdir}/run.err` +
      (backdate ? `; touch -d '2 hours ago' ${workdir}/.cf-exit` : "")
  );
  return out;
};

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the dev server answers on :3000");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t318",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t318 ghost fence", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");
  const projRoot = `/projects/cryoflow/${projectId}`;

  // ======================================================================
  console.log("== PHASE 1: fixtures — 8 real-header micrographs on cluster storage ==");
  const mrc = (nx, ny, nz, mode) => {
    const b = Buffer.alloc(64);
    b.writeInt32LE(nx, 0);
    b.writeInt32LE(ny, 4);
    b.writeInt32LE(nz, 8);
    b.writeInt32LE(mode, 12);
    return b;
  };
  const singleB64 = mrc(4096, 4096, 1, 2).toString("base64");
  const fixtureOut = clientBoth(
    "mkdir -p /data2/ghost-t318; " +
      `echo ${singleB64} | base64 -d > /tmp/.t318-single.mrc; ` +
      "for i in $(seq 1 8); do cp /tmp/.t318-single.mrc /data2/ghost-t318/20241031_lijing_${i}_Fractions_DW.mrc; done"
  );
  must(fixtureOut === "", `the fixtures build quietly (${fixtureOut.slice(0, 120)})`);
  const nMrc = client("ls /data2/ghost-t318/*.mrc 2>/dev/null | wc -l");
  must(nMrc.trim() === "8", `the folder holds 8 MRCs (${nMrc})`);

  // ======================================================================
  console.log("== PHASE 2: the remote import (zero-upload, cluster-absolute rows) ==");
  const fileList = Array.from(
    { length: 8 },
    (_, i) => `/data2/ghost-t318/20241031_lijing_${i + 1}_Fractions_DW.mrc`
  );
  const importA = await mkJob({
    projectId,
    type: "import",
    name: "QA t318 remote mics",
    params: { micrographsPath: fileList.join("\n"), pixelSize: 0.93, voltage: 300 },
  });
  must(!!importA?.id, "the import job creates");
  const runA = await api(`/api/jobs/${importA.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runA.status >= 200 && runA.status < 300, `the import run accepts (${runA.status})`);
  const doneA = await pollUntil(async () => {
    const j = await jobById(importA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneA?.status === "completed", `the import completes (${doneA?.status}: ${String(doneA?.result ?? "").slice(0, 90)})`);
  must(/8 micrographs imported/.test(String(doneA?.result ?? "")), "the import counts 8");

  // ======================================================================
  console.log("== PHASE 3: THE REGRESSION — the t314 ghost meets a re-run (sbatch) ==");
  // the user's exact world: a ctffind job whose workdir still carries the
  // PREVIOUS failed run's verdict + logs. The old code finalized "exit 1"
  // off this ghost while the fresh job was still loading modules.
  const ctfA = await mkJob({ projectId, type: "ctffind", name: "QA t318 ctf ghost", params: {} });
  must(!!ctfA?.id, "the ctffind job creates");
  const edgeA = await mkEdge(importA.id, ctfA.id, "micrographs", "micrographs");
  must(edgeA === 200 || edgeA === 201, `the edge wires import → ctffind (${edgeA})`);
  const workdirA = `${projRoot}/ctffind_${ctfA.id.slice(-8)}`;

  const ghostA = plantGhost(workdirA);
  must(ghostA === "", `the t314 ghost plants quietly (${ghostA.slice(0, 120)})`);
  must(client(`cat ${workdirA}/.cf-exit`).trim() === "1", "the ghost's verdict says 1 (the old failure)");

  const dispatchA = await dispatchCtf(ctfA.id);
  must(dispatchA.status >= 200 && dispatchA.status < 300, `the dispatch route answers (${dispatchA.status})`);
  must(!dispatchA.body?.error, `the dispatch is ACCEPTED (${String(dispatchA.body?.error ?? "").slice(0, 120)})`);

  // BLADE 1 LIVE: the ghost's verdict + poisoned logs vanish BEFORE the
  // job can be judged — poll until .cf-exit is gone (the clear runs during
  // staging, well before the job's own rm on the "compute node").
  const ghostGone = await pollUntil(() => {
    const present = client(`[ -f ${workdirA}/.cf-exit ] && echo YES || echo NO`);
    return present.includes("NO") ? true : null;
  }, 30_000, 500);
  must(ghostGone === true, "blade 1: the pre-submit clear removed the ghost's .cf-exit");
  // and the poisoned logs went with it (the fresh run.out may already be
  // growing — the GHOST MARKER must never come back)
  const runOutA_end = await pollUntil(async () => {
    const j = await jobById(ctfA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(runOutA_end?.status === "completed", `the ctffind completes HONESTLY (${runOutA_end?.status}: ${String(runOutA_end?.result ?? "").slice(0, 90)})`);
  must(!/exit 1/.test(String(runOutA_end?.result ?? "")), "the receipt does NOT carry the forged exit 1");
  must(/CTF estimated for 8 micrographs/i.test(String(runOutA_end?.result ?? "")), "the receipt carries the REAL verdict (8 estimated)");
  const outA = client(`cat ${workdirA}/run.out 2>/dev/null`);
  must(!outA.includes("GHOST-LOG-t318"), "the ghost's poisoned run.out never resurfaces");
  must(/CTF estimated/.test(outA), "the cluster run.out is the fresh run's own log");
  must(client(`cat ${workdirA}/.cf-exit 2>/dev/null`).trim() === "0", "the cluster's real .cf-exit says 0");

  // ======================================================================
  console.log("== PHASE 4: THE FENCE BATTLE — a backdated ghost planted MID-RUN ==");
  // the hardest window: the job is RUNNING, the sweep is ticking every ~4s,
  // and the previous run's verdict file (mtime 2h ago) appears in the
  // workdir. Without the mtime fence the very next tick finalizes the job
  // "exit 1". With it, the file is refused and the ladder (squeue) keeps
  // telling the truth.
  const ctfB = await mkJob({ projectId, type: "ctffind", name: "QA t318 ctf fence", params: {} });
  must(!!ctfB?.id, "the second ctffind job creates");
  const edgeB = await mkEdge(importA.id, ctfB.id, "micrographs", "micrographs");
  must(edgeB === 200 || edgeB === 201, `the second edge wires (${edgeB})`);
  const workdirB = `${projRoot}/ctffind_${ctfB.id.slice(-8)}`;

  const dispatchB = await dispatchCtf(ctfB.id);
  must(dispatchB.status >= 200 && dispatchB.status < 300, `the second dispatch answers (${dispatchB.status})`);
  must(!dispatchB.body?.error, `the second dispatch is ACCEPTED (${String(dispatchB.body?.error ?? "").slice(0, 120)})`);

  // wait until the run is MID-FLIGHT (the fake ctffind prints per-mic lines)
  const midFlight = await pollUntil(() => {
    const out = client(`tail -c 200 ${workdirB}/run.out 2>/dev/null`);
    return /Micrograph [1-9]/.test(out) ? true : null;
  }, 40_000, 700);
  must(midFlight === true, "the run reaches mid-flight (per-micrograph progress in run.out)");

  // the ambush: a backdated ghost verdict while the sweep is watching
  const ambush = clientBoth(
    `echo 1 > ${workdirB}/.cf-exit; touch -d '2 hours ago' ${workdirB}/.cf-exit; ` +
      `stat -c %Y ${workdirB}/.cf-exit`
  );
  must(/^\d{9,12}$/.test(ambush.split("\n").pop()?.trim() ?? ""), "the backdated ghost lands (stat answers an old mtime)");

  // 8s of sweep ticks against the ghost — the job must not be FORGED into
  // a failure. (the per-connection throttle is 4s, so ≥1 tick is
  // guaranteed to read the planted file inside this window; an HONEST
  // completion inside the window is a pass — the fence only refuses the
  // ghost, never the real verdict)
  let forged = false;
  let sawRunning = false;
  for (let t = 0; t < 8; t += 1) {
    const j = await jobById(ctfB.id);
    if (j?.status === "running") sawRunning = true;
    if (j?.status === "failed") {
      forged = true;
      break;
    }
    if (j?.status === "completed") break;
    await sleep(1000);
  }
  must(sawRunning, "the sweep kept seeing the job running (the ladder speaks)");
  must(!forged, "blade 2: the backdated ghost NEVER forged a verdict (no failed flip)");

  const doneB = await pollUntil(async () => {
    const j = await jobById(ctfB.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneB?.status === "completed", `the ambushed run completes HONESTLY (${doneB?.status}: ${String(doneB?.result ?? "").slice(0, 90)})`);
  must(/CTF estimated for 8 micrographs/i.test(String(doneB?.result ?? "")), "the ambushed run's receipt is its own (8 estimated)");
  must(client(`cat ${workdirB}/.cf-exit 2>/dev/null`).trim() === "0", "the REAL verdict file (fresh mtime) is trusted and says 0");

  // ======================================================================
  console.log("== PHASE 4b: the same contract in DIRECT mode ==");
  const ctfC = await mkJob({ projectId, type: "ctffind", name: "QA t318 ctf direct", params: {} });
  must(!!ctfC?.id, "the direct ctffind job creates");
  const edgeC = await mkEdge(importA.id, ctfC.id, "micrographs", "micrographs");
  must(edgeC === 200 || edgeC === 201, `the direct edge wires (${edgeC})`);
  const workdirC = `${projRoot}/ctffind_${ctfC.id.slice(-8)}`;
  const ghostC = plantGhost(workdirC);
  must(ghostC === "", `the direct ghost plants quietly (${ghostC.slice(0, 120)})`);

  const dispatchC = await dispatchCtf(ctfC.id, "direct");
  must(dispatchC.status >= 200 && dispatchC.status < 300, `the direct dispatch answers (${dispatchC.status})`);
  must(!dispatchC.body?.error, `the direct dispatch is ACCEPTED (${String(dispatchC.body?.error ?? "").slice(0, 120)})`);
  const doneC = await pollUntil(async () => {
    const j = await jobById(ctfC.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneC?.status === "completed", `the direct ctffind completes HONESTLY (${doneC?.status}: ${String(doneC?.result ?? "").slice(0, 90)})`);
  must(!/exit 1/.test(String(doneC?.result ?? "")), "the direct receipt does NOT carry the forged exit 1");
  const outC = client(`cat ${workdirC}/run.out 2>/dev/null`);
  must(!outC.includes("GHOST-LOG-t318"), "the direct ghost's poisoned log never resurfaces");

  // ======================================================================
  console.log("== PHASE 5: the LEDGER (source contracts + the record's fence) ==");
  const src = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  must(
    /rm -f \$\{clearW\}\/\.cf-exit \$\{clearW\}\/\.cf-pid \$\{clearW\}\/run\.out \$\{clearW\}\/run\.err/.test(src),
    "B: the pre-submit clear removes the previous run's verdict + logs (blade 1)"
  );
  must(src.includes("date +%s") && /dispatchedAtEpoch: fenceEpoch/.test(src), "B: the cluster's own clock is the dispatch fence");
  must(
    /stat -c %Y \$\{EXIT\} 2>\/dev\/null \|\| echo 0\)" -lt /.test(src),
    "B: aliveCheckScript trusts .cf-exit only when its mtime ≥ fence−2s (blade 2)"
  );
  must(
    src.includes("aliveCheckScript(r.remoteWorkdir, r.slurmId, r.dispatchedAtEpoch)"),
    "B: BOTH poll doors (the sweep + the pre-spawn guard) pass the fence"
  );
  must(
    src.includes("---CF-EVID---") && src.includes("run.out and run.err are EMPTY on the cluster"),
    "B: a failed receipt mends its evidence over SSH and SAYS when the log is empty (blade 3)"
  );
  const typesSrc = readFileSync(`${ROOT}/src/lib/remote/types.ts`, "utf8");
  must(typesSrc.includes("dispatchedAtEpoch?: number"), "B: the fence rides RemoteRunState");
  const uiSrc = readFileSync(`${ROOT}/src/components/workflow/job-inspector.tsx`, "utf8");
  must(
    uiSrc.includes('text && !text.startsWith("(log fetch failed") ? diagnoseLog(text) : null'),
    "B: an empty/failed log fetch never claims \"scanned the full run.out — 0 findings\" (blade 4)"
  );

  // the record itself: the fence landed on every dispatch above
  let state = {};
  try {
    state = JSON.parse(readFileSync(`${ROOT}/data/engine-state.json`, "utf8"));
  } catch { /* fresh state */ }
  const fenced = Object.values(state).filter(
    (r) => r?.remote?.dispatchedAtEpoch != null && Number.isFinite(r.remote.dispatchedAtEpoch)
  );
  must(fenced.length >= 3, `the run records carry the cluster-clock fence (${fenced.length} ≥ 3 dispatches)`);
  const fenceOk = fenced.every(
    (r) => r.remote.dispatchedAtEpoch > 1_700_000_000 && r.remote.dispatchedAtEpoch < 4_000_000_000
  );
  must(fenceOk, "the fence values are sane epoch seconds");

  console.log(`\n== t318 diag: ${fail === 0 ? "ALL GREEN" : `${fail} FAIL`} ==`);
} finally {
  // ---- cleanup: the API trees + the cluster-side shells + the fixtures ----
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  if (projectId) {
    try {
      client(`rm -rf /projects/cryoflow/${projectId}`);
    } catch { /* the jobs DELETE already dropped the local twin */ }
    try {
      rmSync(path.join(ROOT, "data/relion", projectId), { recursive: true, force: true });
    } catch { /* may not exist */ }
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  try {
    client("rm -rf /data2/ghost-t318 /tmp/.t318-single.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);
