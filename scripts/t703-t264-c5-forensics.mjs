// t703 forensics — reproduce t264's C5 (remote autopick Topaz) failure and
// DUMP the full evidence: job result, record, mirror run.out / run.err.
// Read-only with respect to the world: creates its own import → motioncorr
// → autopick chain, then tears everything down (t264's own cleanup shape).
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};
const MICS_DIR = "/home/z/my-project/data/relion/t703-mics";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const createdJobs = [];
const connIds = [];
try {
  // six movies, the t264 recipe (512² float32, 4 frames, dark blobs)
  mkdirSync(MICS_DIR, { recursive: true });
  const names = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc", "mic_05.mrc", "mic_06.mrc"];
  const W = 512, H = 512, N_FRAMES = 4, SIGMA = 40, AMP = -1.0;
  const BLOBS = [[128,128],[256,128],[384,128],[128,384],[256,384],[384,384]];
  for (const n of names) {
    const buf = Buffer.alloc(1024 + W * H * 4 * N_FRAMES);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(N_FRAMES, 8);
    buf.writeInt32LE(2, 12);
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(N_FRAMES, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77 * N_FRAMES, 48);
    buf.write("MAP ", 208, "ascii");
    for (let s = 0; s < N_FRAMES; s++)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let v = Math.sin((x + y) / 31) * 0.03;
          for (const [bx, by] of BLOBS) {
            const dx = x - bx, dy = y - by;
            v += AMP * Math.exp(-(dx * dx + dy * dy) / (2 * SIGMA * SIGMA));
          }
          buf.writeFloatLE(v, 1024 + (s * W * H + y * W + x) * 4);
        }
    writeFileSync(path.join(MICS_DIR, n), buf);
  }

  const mkJob = async (body) => {
    const r = await fetch(`${BASE}/api/jobs`, {
      method: "POST", headers: { "Content-Type": "application/json", ...SH },
      body: JSON.stringify(body),
    });
    const b = await r.json();
    if (r.status === 201 && b.job?.id) createdJobs.push(b.job.id);
    return b.job;
  };
  const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
    const r = await fetch(`${BASE}/api/edges`, {
      method: "POST", headers: { "Content-Type": "application/json", ...SH },
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    });
    return r.status;
  };
  const readJob = async (id) => {
    const d = await (await fetch(`${BASE}/api/jobs`)).json();
    return (d.jobs ?? []).find((x) => x.id === id) ?? null;
  };

  const importJob = await mkJob({
    type: "import", name: "t703 Import",
    params: { micrographsPath: MICS_DIR, pixelSize: 1.77, nodeType: "movies" },
  });
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: "{}" });
  const importDone = await pollUntil(async () => (await readJob(importJob.id))?.status === "completed", 25_000);
  console.log("import:", importDone ? "completed" : "TIMEOUT");
  // the import's movies star — where do its rows point?
  const state = JSON.parse(readFileSync("/home/z/my-project/data/engine-state.json", "utf8"));
  console.log("import outputs:", JSON.stringify(state[importJob.id]?.outputs ?? {}, null, 1));
  const impWd = state[importJob.id]?.workdir;
  if (impWd) {
    for (const f of execSync(`ls ${impWd}`).toString().trim().split("\n")) console.log("  import wd:", f);
    const star = execSync(`ls ${impWd}/*.star 2>/dev/null | head -1`).toString().trim();
    if (star) {
      console.log("movies star:", star);
      console.log(execSync(`head -20 ${star}`).toString());
    }
  }

  const connId = `qa-t703-${Date.now().toString(36)}`;
  connIds.push(connId);
  await fetch(`${BASE}/api/remote/connections`, {
    method: "POST", headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({ id: connId, name: "QA t703", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" }),
  });

  const jobM = await mkJob({ type: "motioncorr", name: "t703 MotionCorr REMOTE", params: { do_own_motioncor: false } });
  await mkEdge(importJob.id, jobM.id, "movies", "movies");
  await fetch(`${BASE}/api/jobs/${jobM.id}/run`, {
    method: "POST", headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  const doneM = await pollUntil(async () => {
    const j = await readJob(jobM.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 90_000);
  console.log("motioncorr:", doneM?.status, "|", (doneM?.result ?? "").slice(0, 120));

  const jobA = await mkJob({ type: "autopick", name: "t703 AutoPick Topaz", params: { pickingMethod: "Topaz" } });
  await mkEdge(jobM.id, jobA.id, "micrographs", "micrographs");
  await fetch(`${BASE}/api/jobs/${jobA.id}/run`, {
    method: "POST", headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  const doneA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 90_000);
  console.log("autopick:", doneA?.status);
  console.log("autopick FULL result:", JSON.stringify(doneA?.result ?? ""));

  const st2 = JSON.parse(readFileSync("/home/z/my-project/data/engine-state.json", "utf8"));
  const recA = st2[jobA.id];
  console.log("autopick record cmd:", recA?.cmd);
  const awd = recA?.workdir;
  if (awd && existsSync(awd)) {
    for (const f of execSync(`ls -la ${awd}`).toString().trim().split("\n")) console.log("  autopick wd:", f);
    for (const lg of ["run.out", "run.err"]) {
      const p = path.join(awd, lg);
      if (existsSync(p)) {
        console.log(`--- ${lg} (full) ---`);
        console.log(readFileSync(p, "utf8").slice(0, 4000));
      }
    }
  } else {
    console.log("autopick workdir missing:", awd);
    // cluster side
    try {
      const out = execSync(
        `node services/mock-cluster/test-client.mjs 'ls -la /projects/cryoflow/*/autopick_* 2>/dev/null; for f in /projects/cryoflow/*/autopick_*/run.err; do echo ===$f===; cat "$f"; done'`,
        { cwd: "/home/z/my-project", stdio: "pipe", timeout: 30_000 }
      ).toString();
      console.log(out.slice(0, 5000));
    } catch (e) {
      console.log("cluster probe failed:", String(e).slice(0, 200));
    }
  }
} finally {
  for (const id of [...createdJobs].reverse()) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }); } catch {}
  }
  for (const cid of [...connIds].reverse()) {
    try { await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH }); } catch {}
  }
  try { rmSync(MICS_DIR, { recursive: true, force: true }); } catch {}
  try {
    execSync(
      `node services/mock-cluster/test-client.mjs 'rm -rf /projects/cryoflow/*/motioncorr_* /projects/cryoflow/*/autopick_* /projects/cryoflow/*/import_* /projects/cryoflow/*/micrographs'`,
      { cwd: "/home/z/my-project", stdio: "pipe", timeout: 30_000 }
    );
  } catch {}
  console.log("(cleanup done)");
}
