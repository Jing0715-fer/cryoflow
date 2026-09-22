// t298 — THE BORROWED BIG MAP (Task 298).
//
// Two legs of this repo's test world had never crossed:
//   t293 proved the borrow chain's lazy legs — but only ever handed them a
//        720×720×1 (2 MB) map, and only walked the png door.
//   t296 handed Mol* a reconstruction-scale volume (256³ float32 = 64 MB) —
//        but only a LOCAL one (mapimport hardlinks it into the workdir).
// The exam question the leftover named ten windows running: does the
// borrowed map survive the WIRE? A real reconstruction-scale map planted on
// the cluster, left there by the key-files policy, and opened through the
// REMOTE tile's View in 3D — Mol* asks for raw, the file route's 404 branch
// lazy-fetches over SSH (the cat stream, capped, deduped), the bytes land at
// the real workdir path, and the raw route streams them back into
// ParseCcp4 → isosurface. Every gate timed.
//
// The suite FOUND a real infrastructure bug: the mock cluster's exec `cat`
// was LOSSY for big streams — pipe 'end' means HANDED TO the ssh2 channel,
// not FLUSHED to the socket, so the channel close ate the unflushed tail
// (ten-run probe: 10/10 lost 1.6–48 MB with exit=0). The fix lives in
// services/mock-cluster/server.mjs (write-callback pump + drain-aware grace)
// and src/lib/remote/ssh.ts (end the file only on 'close').
//
//   A  demo truth — homepage 200, roster 23, mock cluster answering
//   B  the ledger — the 32 GB fetch ceiling ("infinity is not a policy"),
//      the in-flight dedup ("one SSH pull, both callers wait on it"), the
//      existsSync fast-path ("deliberately NOT a cache"), the cat stream
//      (write callbacks + mid-stream over-cap cut + the 20 s…600 s timer),
//      the file route's lazy-leg funnel, the RemoteFileTile's four doors and
//      its never-auto-load law
//   C  alive on the mock cluster —
//      C0  deterministic 256³ float32 MRC (three gaussian blobs, honest
//          header stats — the t296 generator, now aimed at the cluster)
//      C1  the local import (six 64×64 micrographs) → completed
//      C2  the borrow loop: connection (keyFileMb=1) → ctffind dispatched
//          remote → completed → the text skeleton synced, remoteWorkdir
//          recorded
//      C3  the plant: the 64 MB map into the cluster workdir → RE-RUN →
//          the manifest rewritten, the map NEVER lands, the ledger lists it,
//          the outputs listing shows a REMOTE tile (kind + size + label,
//          dims honestly absent)
//      C4  THE SSH LEG, timed: the raw door API-direct — Mol*'s exact
//          request — 200 + exact Content-Length, the bytes land and are
//          sha256-identical to the cluster twin
//      C5  THE DEDUP RACE: the landed file removed, TWO concurrent raw
//          fetches fire — both 200, the landed copy still byte-identical
//          (the in-flight Map made the second caller await the first's
//          promise; two racing cat streams would corrupt the write)
//      C6  THE UI LEG, timed: the tile is remote again (file removed), the
//          cloud badge shows, View in 3D from the REMOTE tile — Mol* pulls
//          the 64 MB over SSH through the lazy route and commits the
//          isosurface inside the 120 s gate; the tile graduates WITH dims,
//          no remote tile remains
//      C7  the histogram doctrine on the borrowed map: cold full-grid scan
//          → LRU hit (second look free, on a fetched file the cache has
//          never seen)
//   D  console clean;  Z  roster 23
//
// Run: node scripts/t298-remote-big-map.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import {
  readFileSync, writeFileSync, mkdirSync, rmSync, existsSync,
  openSync, writeSync, closeSync, statSync,
} from "node:fs";
import { Socket } from "node:net";
import { createHash } from "node:crypto";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t298-mics";
const TMP = "/home/z/my-project/data/relion/t298-tmp";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";
const MOCK_FS_ROOT = "/home/z/my-project/services/mock-cluster/fs";

const N = Number(process.env.T298_N ?? 256); // 256³ float32 = 64 MB

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

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
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(MOCK_PORT, "127.0.0.1");
  });
}

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);
let weLaunchedMock = false;
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  weLaunchedMock = true;
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3000",
};

const createdJobs = [];
let connId = null;
let mockWorkdir = null; // the planted cluster twin's home — rm'd in finally
const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s.runs ?? s;
  } catch {
    return {};
  }
};
const readConns = () => {
  try {
    const raw = JSON.parse(readFileSync("/home/z/my-project/data/remote-connections.json", "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

// ---- the map generator (the t296 recipe, now aimed at the cluster) ---------
function writeBigMrc(file, n) {
  const voxels = new Float32Array(n * n * n);
  const blobs = [
    { c: [n / 2, n / 2, n / 2], s: n * 0.09, a: 10 },
    { c: [n * 0.3, n * 0.62, n * 0.55], s: n * 0.05, a: 6 },
    { c: [n * 0.68, n * 0.4, n * 0.42], s: n * 0.06, a: 7 },
  ];
  const idx = (x, y, z) => (z * n + y) * n + x;
  for (const b of blobs) {
    const r = Math.ceil(b.s * 4);
    const x0 = Math.max(0, Math.floor(b.c[0] - r)), x1 = Math.min(n - 1, Math.ceil(b.c[0] + r));
    const y0 = Math.max(0, Math.floor(b.c[1] - r)), y1 = Math.min(n - 1, Math.ceil(b.c[1] + r));
    const z0 = Math.max(0, Math.floor(b.c[2] - r)), z1 = Math.min(n - 1, Math.ceil(b.c[2] + r));
    const inv2s2 = 1 / (2 * b.s * b.s);
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const dx = x - b.c[0], dy = y - b.c[1], dz = z - b.c[2];
          voxels[idx(x, y, z)] += b.a * Math.exp(-(dx * dx + dy * dy + dz * dz) * inv2s2);
        }
  }
  let mn = Infinity, mx = -Infinity, sum = 0;
  for (let i = 0; i < voxels.length; i++) {
    const v = voxels[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    sum += v;
  }
  const mean = sum / voxels.length;
  let sum2 = 0;
  for (let i = 0; i < voxels.length; i++) {
    const d = voxels[i] - mean;
    sum2 += d * d;
  }
  const rms = Math.sqrt(sum2 / voxels.length);

  const header = Buffer.alloc(1024);
  header.writeInt32LE(n, 0); header.writeInt32LE(n, 4); header.writeInt32LE(n, 8);
  header.writeInt32LE(2, 12);
  header.writeInt32LE(0, 16); header.writeInt32LE(0, 20); header.writeInt32LE(0, 24);
  header.writeInt32LE(n, 28); header.writeInt32LE(n, 32); header.writeInt32LE(n, 36);
  header.writeFloatLE(n, 40); header.writeFloatLE(n, 44); header.writeFloatLE(n, 48);
  header.writeFloatLE(90, 52); header.writeFloatLE(90, 56); header.writeFloatLE(90, 60);
  header.writeInt32LE(1, 64); header.writeInt32LE(2, 68); header.writeInt32LE(3, 72);
  header.writeFloatLE(mn, 76); header.writeFloatLE(mx, 80); header.writeFloatLE(mean, 84);
  header.writeInt32LE(0, 88);
  header.writeInt32LE(0, 92);
  header.writeFloatLE(0, 196); header.writeFloatLE(0, 200); header.writeFloatLE(0, 204);
  header.write("MAP ", 208, "ascii");
  header[212] = 0x44; header[213] = 0x44;
  header.writeFloatLE(rms, 216);
  header.writeInt32LE(1, 220);

  const body = Buffer.from(voxels.buffer, voxels.byteOffset, voxels.byteLength);
  const fd = openSync(file, "w");
  try {
    writeSync(fd, header); writeSync(fd, body);
  } finally { closeSync(fd); }
  return { bytes: 1024 + voxels.byteLength };
}

// ---- browser ---------------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
const consoleErrors = [];
const badResponses = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url().slice(0, 140)}`); });

mkdirSync(TMP, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
const bigMapSrc = path.join(TMP, `bigmap_${N}.mrc`);
const PLANT = "run_it003_class001.mrc";

const pre = await (await fetch(`${BASE}/api/jobs`)).json();
const roster0 = (pre.jobs ?? []).length;

try {
  // ---- Phase A: demo truth -------------------------------------------------
  console.log("== PHASE A: demo truth ==");
  const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
  must(res.status() === 200, `homepage 200 (got ${res.status()})`);
  await sleep(2500);
  must(roster0 === 23, `roster identity 23 (got ${roster0})`);
  must(await mockListening(), "the mock cluster answers on :3022");

  // ---- Phase B: the ledger -------------------------------------------------
  console.log("== PHASE B: the ledger ==");
  const filesSrc = readFileSync("src/lib/remote/remote-files.ts", "utf8");
  must(
    filesSrc.includes("FETCH_CAP_BYTES = 32 * 1024 * 1024 * 1024") && filesSrc.includes("infinity is not a policy"),
    "the fetch ceiling is named (32 GB) and carries its law (the click is intent, not infinity)"
  );
  must(
    filesSrc.includes("const inFlight = new Map") && filesSrc.includes("one SSH pull, both callers wait on it"),
    "the in-flight dedup is declared with its contract (gallery preview + Mol* sibling share one pull)"
  );
  must(
    filesSrc.includes("existsSync(localPath)) return { ok: true, bytes: 0 }"),
    "the existsSync fast-path — an already-landed file costs zero bytes (idempotent door)"
  );
  must(
    filesSrc.indexOf("inFlight.get(key)") >= 0 &&
      filesSrc.indexOf("inFlight.get(key)") < filesSrc.indexOf("existsSync(localPath)) return"),
    "t298's ordering law: the in-flight check comes BEFORE the fast-path (a concurrent pull's half-written file must never be believed)"
  );
  must(
    filesSrc.includes("no tombstones"),
    "a failed pull leaves no partial file at the real workdir path (the fast-path and the listing would believe it)"
  );
  must(
    filesSrc.includes("byte-count verdict") && filesSrc.includes("retried once"),
    "the door VERIFIES the landed byte count against the pre-pull remoteStat — up to two retries, then an honest 502, never a truncated map"
  );
  must(
    filesSrc.includes("Deliberately NOT a cache"),
    "the fetch lands at the real workdir path — download-on-click is data, not an evictable thumbnail"
  );
  must(
    filesSrc.includes("safeRel") && filesSrc.includes(`rel.split("/").includes("..")`),
    "safeRel refuses traversal before any SSH round trip"
  );

  const sshSrc = readFileSync("src/lib/remote/ssh.ts", "utf8");
  must(
    sshSrc.includes("writeSync(fd, chunk)") && sshSrc.includes("SYNCHRONOUS writes, not a WriteStream"),
    "the download lands chunks with SYNCHRONOUS writes (no stream buffer to drop from under load) — the t298 verdict"
  );
  must(
    sshSrc.includes("written > maxBytes"),
    "the over-cap cut rides the STREAM (mid-transfer enforcement, not a stat-only promise)"
  );
  must(
    sshSrc.includes("Math.max(20_000, Math.min(600_000, st.size / 50))"),
    "the transfer timer scales with size (20 s floor, 600 s cap — a 50 KB/s floor)"
  );
  must(
    sshSrc.includes("end the file ONLY on 'close'"),
    "t298's client law: the file ends on 'close', never on 'exit' (trailing chunks are legal)"
  );

  const fileRoute = readFileSync("src/app/api/jobs/[id]/outputs/file/route.ts", "utf8");
  must(
    fileRoute.includes("fetchRemoteFileIntoWorkdir") && fileRoute.includes("every format (png/raw/text/value/histogram)"),
    "the file route funnels every format through the one resolution — the lazy leg serves gallery, downloads and Mol* alike"
  );
  must(
    fileRoute.includes('"File not found" && run.remote'),
    "only a remote run pays the SSH round trip (the 404 branch is the borrow's gate)"
  );

  const viewSrc = readFileSync("src/components/workflow/results/results-view.tsx", "utf8");
  must(
    viewSrc.includes("never auto-loads") && viewSrc.includes("a render must not cost an SSH transfer"),
    "the RemoteFileTile's law: cluster-resident bytes never load as a render side effect"
  );
  must(
    viewSrc.includes('data-canvas-ui="remote-view-3d"') && viewSrc.includes("Mol* pulls this map from the cluster over SSH"),
    "the remote tile's 3D door exists and says what it does"
  );
  must(
    viewSrc.includes("not synced — click to fetch over SSH"),
    "the tile's preview placeholder is honest about the fetch it is about to cost"
  );

  const mockSrc = readFileSync("services/mock-cluster/server.mjs", "utf8");
  must(
    mockSrc.includes("pendingWrites") && mockSrc.includes("DRAIN_HARD_CAP_MS"),
    "t298's server law: the close waits for the write callbacks (flush-aware), the grace is idle-aware"
  );

  // ---- Phase C: alive on the mock cluster -----------------------------------
  console.log("== PHASE C: alive on the mock cluster ==");
  const stats = writeBigMrc(bigMapSrc, N);
  must(statSync(bigMapSrc).size === stats.bytes, `C0: the deterministic ${N}³ map is written (${(stats.bytes / 1024 / 1024).toFixed(0)} MB)`);

  // C1 — the local import
  mkdirSync(MICS_DIR, { recursive: true });
  for (let k = 1; k <= 6; k++) {
    const W = 64, H = 64;
    const buf = Buffer.alloc(1024 + W * H * 4);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
    buf.writeInt32LE(2, 12);
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
    buf.write("MAP ", 208, "ascii");
    buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x44 + 3, 214); buf.writeUInt8(0x44 + 3, 215);
    for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
    writeFileSync(path.join(MICS_DIR, `mic_0${k}.mrc`), buf);
  }
  const mkJob = async (body) => {
    const r = await fetch(`${BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await r.json();
    if (r.status === 201 && b.job?.id) createdJobs.push(b.job.id);
    return b.job;
  };
  const importJob = await mkJob({ type: "import", name: "t298 Import", params: { micrographsPath: MICS_DIR, pixelSize: 1.77 } });
  must(!!importJob?.id, "C1: the import job exists");
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: JSON.stringify({}) });
  const importDone = await pollUntil(async () => {
    const j = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs.find((x) => x.id === importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "C1: the local import completed");
  const projId = importDone?.projectId ?? importJob.projectId;

  // C2 — the borrow loop
  connId = `qa-t298-${Date.now().toString(36)}`;
  const mk = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch("/api/remote/connections", {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: connId, name: "QA t298 Borrow Big", host: "127.0.0.1", port: 3022,
        username: "cryo", password: "demo", authMethod: "password",
        remoteRoot: "/projects/cryoflow", keyFileMb: 1,
      }),
    });
    return { status: r.status, body: await r.json() };
  }, { connId, SH });
  must(mk.status === 201, "C2: the connection is created with keyFileMb=1 (the 64 MB map is far above the key cap)");

  const jobA = await mkJob({ type: "ctffind", name: "t298 CtfFind A" });
  const edgeRe = await fetch(`${BASE}/api/edges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromJobId: importJob.id, toJobId: jobA.id, fromPort: "micrographs", toPort: "micrographs" }),
  });
  must(!!jobA?.id && [200, 201].includes(edgeRe.status), "C2: ctffind A created and wired to the import");
  const dispA = await page.evaluate(async ({ jobId, connId, SH }) => {
    const r = await fetch(`/api/jobs/${jobId}/run`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
    });
    return r.status;
  }, { jobId: jobA.id, connId, SH });
  must(dispA === 200, `C2: A dispatched to the cluster (${dispA})`);
  const doneA = await pollUntil(async () => (stateRuns()[jobA.id]?.done === true ? stateRuns()[jobA.id] : null), 90_000, 1500);
  must(!!doneA, "C2: A finalized on the cluster");
  const remoteWorkdir = doneA?.remote?.remoteWorkdir ?? "";
  must(remoteWorkdir.startsWith("/projects/cryoflow"), `C2: the record carries the cluster workdir (${remoteWorkdir})`);
  const mirrorA = stateRuns()[jobA.id]?.workdir || `/home/z/my-project/data/relion/${projId}/ctffind_${jobA.id.slice(-8)}`;
  must(existsSync(path.join(mirrorA, "micrographs_ctf.star")), "C2: the STAR synced back (the text skeleton always crosses)");

  // C3 — the plant: the 64 MB map into the cluster workdir, then the RE-RUN
  mockWorkdir = `${MOCK_FS_ROOT}${remoteWorkdir}`;
  const plantLocal = path.join(mockWorkdir, PLANT);
  mkdirSync(mockWorkdir, { recursive: true });
  writeFileSync(plantLocal, readFileSync(bigMapSrc));
  must(statSync(plantLocal).size === stats.bytes, `C3: the ${N}³ map is planted on the cluster (${(stats.bytes / 1024 / 1024).toFixed(0)} MB)`);

  const manifestBefore = JSON.parse(readFileSync(path.join(mirrorA, ".cf-remote-manifest.json"), "utf8"));
  const dispRe = await page.evaluate(async ({ jobId, connId, SH }) => {
    const r = await fetch(`/api/jobs/${jobId}/run`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
    });
    return r.status;
  }, { jobId: jobA.id, connId, SH });
  must(dispRe === 200, `C3: A RE-RUN dispatched (${dispRe} — the planted map rides through the second finalize)`);
  const manifestRe = await pollUntil(async () => {
    try {
      const m = JSON.parse(readFileSync(path.join(mirrorA, ".cf-remote-manifest.json"), "utf8"));
      return m.writtenAt && m.writtenAt !== manifestBefore.writtenAt && stateRuns()[jobA.id]?.done === true ? m : null;
    } catch {
      return null;
    }
  }, 90_000, 1500);
  must(!!manifestRe, "C3: A re-finalized (the manifest ledger was rewritten)");

  must(!existsSync(path.join(mirrorA, PLANT)), "C3: the 64 MB map NEVER landed (the key-files policy left it on the cluster)");
  const manifestEntry = (manifestRe.files ?? []).find((f) => f.path === PLANT);
  must(!!manifestEntry && manifestEntry.size === stats.bytes, `C3: the ledger lists the skipped map at its exact size (${manifestEntry?.size} B)`);
  const outsB = await (await fetch(`${BASE}/api/jobs/${jobA.id}/outputs`, { headers: SH })).json();
  const remoteTile = (outsB.files ?? []).find((f) => f.remote === true && f.path === PLANT);
  must(!!remoteTile, "C3: the outputs listing shows the map as a REMOTE tile");
  must(remoteTile?.kind === "mrc" && remoteTile?.size === stats.bytes, `C3: the tile speaks kind + size (${remoteTile?.kind}, ${remoteTile?.size})`);
  must(remoteTile?.dims === undefined, "C3: the remote tile honestly lacks dims (header facts wait for the fetch)");

  // C4 — THE SSH LEG, timed, API-direct: Mol*'s exact request
  console.log("== PHASE C4: the 64 MB SSH leg (timed) ==");
  const rawUrl = `${BASE}/api/jobs/${jobA.id}/outputs/file?path=${encodeURIComponent(PLANT)}&format=raw`;
  const tFetch = Date.now();
  const rawRes = await fetch(rawUrl, { headers: SH });
  must(rawRes.status === 200, `C4: the raw door lazy-fetches and streams (got ${rawRes.status}${rawRes.status !== 200 ? ` — ${(await rawRes.text()).slice(0, 140)}` : ""})`);
  const rawBuf = rawRes.status === 200 ? Buffer.from(await rawRes.arrayBuffer()) : Buffer.alloc(0);
  const sshMs = Date.now() - tFetch;
  must(rawBuf.byteLength === stats.bytes, `C4: the full ${stats.bytes} bytes crossed (got ${rawBuf.byteLength}) in ${sshMs} ms — SSH fetch + raw stream`);
  must(sshMs < 120_000, `C4: the 64 MB leg is inside the 120 s gate (${sshMs} ms)`);
  must(rawRes.headers.get("content-length") === String(stats.bytes), "C4: Content-Length speaks the exact size (the download progress stays meaningful)");
  const landed = path.join(mirrorA, PLANT);
  must(existsSync(landed) && sha(landed) === sha(plantLocal), "C4: the landed file is BYTE-IDENTICAL to the cluster copy (sha256)");
  must(existsSync(landed) && !statSync(landed).isSymbolicLink?.(), "C4: the landed copy is a real file at the real workdir path");

  // C5 — THE DEDUP RACE: remove the landing, fire two concurrent raw fetches
  console.log("== PHASE C5: the in-flight dedup race ==");
  rmSync(landed, { force: true });
  must(!existsSync(landed), "C5: the landing is removed (the race begins from nothing on disk)");
  const tRace = Date.now();
  const [raceA, raceB] = await Promise.all([
    fetch(rawUrl, { headers: SH }),
    fetch(rawUrl, { headers: SH }),
  ]);
  const raceMs = Date.now() - tRace;
  must(raceA.status === 200 && raceB.status === 200, `C5: both concurrent raw doors answered 200 (${raceA.status}/${raceB.status}) in ${raceMs} ms`);
  const [bufA, bufB] = await Promise.all([raceA.arrayBuffer(), raceB.arrayBuffer()]);
  must(bufA.byteLength === stats.bytes && bufB.byteLength === stats.bytes, "C5: both streams carried the full payload (no truncation, no interleaved corruption)");
  must(existsSync(landed) && sha(landed) === sha(plantLocal), "C5: the landed copy is STILL byte-identical — the dedup made the second caller await the first's pull");

  // C6 — THE UI LEG, timed: remote again, View in 3D from the REMOTE tile
  console.log("== PHASE C6: View in 3D on the borrowed map (timed) ==");
  rmSync(landed, { force: true });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2200);
  await page.locator(`[data-job="${jobA.id}"]`).first().click({ force: true });
  await sleep(1400);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const cloudBadge = page.locator('[data-canvas-ui="remote-fetch-preview"]').first();
  const tileSeen = await pollUntil(async () => (await cloudBadge.isVisible().catch(() => false)) || null, 12_000, 800);
  must(!!tileSeen, "C6: the REMOTE tile wears its cloud badge again (the listing re-merges the manifest)");
  const view3d = page.locator('[data-canvas-ui="remote-view-3d"]').first();
  must(await view3d.isVisible().catch(() => false), "C6: the remote tile's View in 3D door is on screen");

  const dlg = page.locator('[role="dialog"]').last();
  const t0 = Date.now();
  await view3d.click();
  await dlg.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  const canvasMs = Date.now() - t0;
  const stageSpan = dlg.locator('span[aria-live="polite"]').first();
  await stageSpan.waitFor({ state: "visible", timeout: 5_000 }).catch(() => null);
  await stageSpan.waitFor({ state: "detached", timeout: 120_000 });
  const sceneMs = Date.now() - t0;
  must(true, `C6: Mol* canvas mounted in ${canvasMs} ms — SSH fetch + parse + isosurface ${sceneMs} ms for the borrowed ${N}³ map`);
  must(sceneMs < 120_000, `C6: the borrowed big map renders inside the 120 s verdict gate (took ${sceneMs} ms)`);
  must((await dlg.locator("text=3D viewer unavailable").count()) === 0, "C6: no error overlay — the borrow chain delivered the bytes");
  await page.screenshot({ path: `${SHOTS}/t298-remote-big-map.png` });

  must(existsSync(landed) && sha(landed) === sha(plantLocal), "C6: Mol*'s raw request re-fetched the map — the landing is byte-identical AGAIN");
  const outsAfter = await (await fetch(`${BASE}/api/jobs/${jobA.id}/outputs`, { headers: SH })).json();
  const localTile = (outsAfter.files ?? []).find((f) => f.path === PLANT);
  must(!!localTile && localTile.remote !== true, "C6: the listing graduated the tile to local");
  must(
    !!localTile?.dims && JSON.stringify(localTile.dims) === JSON.stringify([N, N, N]),
    `C6: the graduated tile now carries its header facts (dims ${JSON.stringify(localTile?.dims ?? null)})`
  );
  must(((outsAfter.files ?? []).filter((f) => f.remote === true)).length === 0, "C6: no remote tile remains (everything accounted for)");

  // C7 — the histogram doctrine on the borrowed map
  console.log("== PHASE C7: the histogram's second look ==");
  const histUrl = `${BASE}/api/jobs/${jobA.id}/outputs/file?path=${encodeURIComponent(PLANT)}&format=histogram`;
  const tCold = Date.now();
  const coldRes = await fetch(histUrl, { headers: SH });
  const coldMs = Date.now() - tCold;
  const cold = coldRes.status === 200 ? await coldRes.json() : null;
  must(!!cold && Array.isArray(cold.bins) && cold.bins.length === 256, `C7: the borrowed map's histogram speaks 256 bins (got ${cold?.bins?.length})`);
  must(cold?.nFinite === N * N * N, `C7: nFinite is the whole grid (${cold?.nFinite} = ${N}³)`);
  const tWarm = Date.now();
  const warmRes = await fetch(histUrl, { headers: SH });
  const warmMs = Date.now() - tWarm;
  await warmRes.json().catch(() => null);
  must(warmRes.status === 200, `C7: the second look answers (got ${warmRes.status})`);
  must(warmMs < Math.max(120, coldMs / 3), `C7: the LRU collapses the second look (cold ${coldMs} ms → warm ${warmMs} ms)`);
} finally {
  // cleanup newest-first: jobs, connection, the planted cluster map, the mics,
  // the tmp generator output — and the mock only if WE launched it (t271)
  for (const id of [...createdJobs].reverse()) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }); } catch { /* best effort */ }
  }
  if (connId) {
    try { await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH }); } catch { /* best effort */ }
  }
  if (mockWorkdir) {
    try { rmSync(mockWorkdir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  try { rmSync(MICS_DIR, { recursive: true, force: true }); } catch { /* best effort */ }
  // + the CLUSTER-side mirror of the mics tree (the t309 lesson: the local
  // rm never touched services/mock-cluster/fs — the mirror compounded on
  // every family run of the t29 batch)
  try { rmSync(`${FS_ROOT}/t298-mics`, { recursive: true, force: true }); } catch { /* best effort */ }
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  await browser.close();
  if (weLaunchedMock) {
    try { execSync("pkill -f 'mock-cluster/server.mjs'"); } catch { /* already gone */ }
  }
}

console.log("== PHASE Z: the world as it was ==");
const rosterZ = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
must(rosterZ.length === 23, `roster 23 after the dance (got ${rosterZ.length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0].slice(0, 120)}` : ""})`);
must(badResponses.length === 0, `no failed responses (${badResponses.length}${badResponses.length ? `: ${badResponses.slice(0, 3).join(" | ")}` : ""})`);

console.log(fail === 0 ? "t298: ALL PASS" : `t298: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
