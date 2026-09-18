// t293 — THE BORROW GETS ITS GUARD (Task 292).
//
// t290's five-part feature — test-before-save (by-value probe), the Run ▾
// mode switch, the remote-root hint, the key-files sync policy (manifest +
// keyFileMb cap) and the on-demand lazy fetch — landed verified LIVE BY
// HAND and rode no family suite. But it rewired the ONE resolution point
// the whole results surface shares: the outputs/file 404 branch now may
// pull a file over SSH before serving it. png, raw, value, histogram and
// Mol* all walk that door (t283/t284/t291 are its consumers) — an
// unguarded change there is an unguarded change everywhere. This suite
// makes the borrow a first-class family citizen:
//
//   A  demo truth — homepage 200, roster 21, mock cluster answering, the
//      rig's stub relion binaries in place
//   B  the ledger — the by-value test route (sanitize → probe → drop,
//      host/username required, gated), the sync policy (key-files default,
//      keyFileMb cap, KEY_TEXT_EXT always), the manifest (dotfile ledger,
//      merge remote:true, 300 cap), the lazy leg (stat-verify, 32 GB
//      ceiling, safeRel, STAR rewrite, in-flight dedup, existsSync
//      fast-path), the file route's 404→fetch branch, the UI (Run ▾ mode
//      items, dialogOnly controlled door, RemoteFileTile's four doors +
//      cloud badge, the root hint)
//   C  alive on the mock cluster —
//      C1 the by-value probe: good creds → ok + relion/5.0.1 + $HOME,
//         registry count UNCHANGED after; bad password → ok:false + the
//         error line (never a 500), still nothing persisted
//      C2 the mode switch: the job card's Run ▾ offers both worlds and
//         the local item is honestly disabled (no RELION in the sandbox)
//      C3 the borrow loop: import → dispatch on the cluster (keyFileMb=1)
//         → completed → text skeleton syncs (star + logs)
//      C4 the cap: a planted 2 MB map in the cluster workdir SURVIVES the
//         re-run, is skipped by the policy (never lands), and the outputs
//         listing shows it as a REMOTE tile (size + label, no dims — the
//         header facts are honestly absent until the fetch)
//      C5 the lazy leg: the png door pulls it (200 + real PNG), the file
//         lands at its real workdir path BYTE-IDENTICAL to the cluster
//         copy, and the listing graduates the tile to local WITH dims
//      C6 the artifact: the remote tile posed before the fetch
//   Z  roster identity + console clean
//
// Run: node scripts/t293-remote-borrow.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { Socket } from "node:net";
import { createHash } from "node:crypto";
import path from "node:path";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";
const MOCK_PORT = 3022;
const MICS_DIR = "/home/z/my-project/data/relion/t293-mics";
const STATE_FILE = "/home/z/my-project/data/engine-state.json";
const MOCK_FS_ROOT = "/home/z/my-project/services/mock-cluster/fs";

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

console.log("== PHASE A: demo truth ==");
await fetch(`${BASE}/`).then((r) => must(r.status === 200, `homepage 200 (got ${r.status})`));
const roster0 = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
must(roster0.length === 21, `roster identity 21 (got ${roster0.length})`);
must(await mockListening(), `the mock cluster answers on :${MOCK_PORT}`);
must(
  existsSync(`${MOCK_FS_ROOT}/opt/bin/relion_run_ctffind`) && existsSync(`${MOCK_FS_ROOT}/opt/bin/relion_refine`),
  "the rig ships stub relion binaries (relion_run_ctffind + relion_refine)"
);

console.log("== PHASE B: the ledger ==");
const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");

const testRoute = src("src/app/api/remote/connections/test/route.ts");
must(testRoute.includes("isLocalRequest(request)"), "the by-value probe is gated like every remote route");
must(
  testRoute.includes('body.host !== "string"') && testRoute.includes('body.username !== "string"'),
  "the by-value probe demands host and username"
);
must(
  testRoute.includes("sanitizeConnection(body)") &&
    testRoute.includes("probeConnection(conn)") &&
    testRoute.includes("dropConnection(conn.id)"),
  "the by-value probe: sanitize → probe → drop (a phantom id must not squat the SSH pool)"
);
must(
  testRoute.includes("ok: probe.ok, probe }"),
  "an unreachable cluster answers ok:false + the error line, not a 500"
);

const rr = src("src/lib/remote/remote-run.ts");
must(
  rr.includes('const policy = conn.syncPolicy === "everything" ? "everything" : "key-files";'),
  "the sync policy defaults to key-files (a missing field reads the default)"
);
must(
  rr.includes("const keyCap = (conn.keyFileMb ?? 16) * 1024 * 1024;"),
  "the key-file cap reads keyFileMb (default 16 MB)"
);
must(
  rr.includes("KEY_TEXT_EXT") &&
    rr.includes('policy === "key-files" && !KEY_TEXT_EXT.test(rel) && size > keyCap'),
  "text skeletons always sync; binaries ride the cap"
);
must(
  rr.includes("skipped.push") && rr.includes("key-file cap"),
  "skipped binaries are SPOKEN (a skipped note, not a silent drop)"
);
must(
  rr.includes("writeRemoteManifest") && rr.includes(".cf-remote-manifest.json"),
  "finalize writes the manifest ledger into the local mirror"
);

const rf = src("src/lib/remote/remote-files.ts");
must(rf.includes("REMOTE_MANIFEST_NAME = \".cf-remote-manifest.json\""), "the manifest is a dotfile (bookkeeping, not data)");
must(rf.includes("const FETCH_CAP_BYTES = 32 * 1024 * 1024 * 1024;"), "the lazy leg carries a 32 GB ceiling (infinity is not a policy)");
must(rf.includes("const st = await remoteStat(conn, remotePath);"), "the lazy leg stat-verifies over SSH BEFORE the pull");
must(
  rf.includes('rel.split("/").includes("..")'),
  "safeRel refuses absolute paths and .. escapes"
);
must(
  rf.includes('rewriteStarPaths(text, "to-local", remote.remoteRoot)'),
  "a fetched STAR is rewritten to-local (downstream local runs can eat it)"
);
must(rf.includes("const inFlight = new Map"), "in-flight fetches dedup (one SSH pull, both callers wait)");
must(rf.includes("if (existsSync(localPath)) return { ok: true, bytes: 0 };"), "the lazy leg is idempotent (a local file costs nothing)");

const outsRoute = src("src/app/api/jobs/[id]/outputs/route.ts");
must(
  outsRoute.includes("readRemoteManifest(workdir)") && outsRoute.includes("remote: true,"),
  "the outputs listing merges manifest entries marked remote:true"
);
must(outsRoute.includes("remoteAdded >= 300"), "the remote merge carries the same 300 cap as the local walk");
must(
  outsRoute.includes("Header facts (dims/slices) are unknown until"),
  "the remote tile speaks size + label honestly (no invented header facts)"
);

const fileRoute = src("src/app/api/jobs/[id]/outputs/file/route.ts");
must(
  fileRoute.includes('resolved.error === "File not found" && run.remote') &&
    fileRoute.includes("fetchRemoteFileIntoWorkdir"),
  "the lazy leg is wired at the ONE resolution point (the 404 branch of a remote run)"
);

const jp = src("src/components/workflow/job-panel.tsx");
must(
  jp.includes('aria-label="Run on this machine"') && jp.includes('aria-label="Run on cluster over SSH"'),
  "the Run ▾ menu speaks both worlds with named items"
);
must(
  jp.includes('aria-label="Choose run mode: this machine or cluster (SSH)"'),
  "the mode trigger carries its own locator (a seam you can click)"
);
must(jp.includes("runModeBlocked") && jp.includes("relionBlocked"), "the local item disables honestly when RELION is absent");

const rrb = src("src/components/workflow/remote-run-button.tsx");
must(
  rrb.includes("dialogOnly") && rrb.includes("onOpenChange"),
  "RemoteRunButton is a controlled door (one dialog, many openers)"
);

const rv = src("src/components/workflow/results/results-view.tsx");
must(
  rv.includes("remote-fetch-preview") && rv.includes("remote-fetch-btn") && rv.includes("remote-view-3d") && rv.includes("remote-download"),
  "the remote tile grows its four doors (preview / fetch / 3D / download)"
);
must(rv.includes("RemoteFileTile"), "the remote tile is a component of its own");
must(rv.includes("onLoaded"), "MrcImage reports its load (the tile graduates on the listing refresh)");

const connDto = src("src/lib/remote/types.ts");
must(
  connDto.includes("homeDir") || src("src/lib/remote/probe.ts").includes("homeDir"),
  "the probe captures $HOME (the root hint's raw material)"
);

console.log("== PHASE C: alive on the mock cluster ==");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2500);

  // C1 — the by-value probe: answers without persisting, twice over
  const registryBefore = readConns().length;
  const probeGood = await page.evaluate(async ({ SH }) => {
    const r = await fetch("/api/remote/connections/test", {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "127.0.0.1", port: 3022, username: "cryo", password: "demo",
        authMethod: "password", remoteRoot: "/projects/cryoflow",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, { SH });
  must(probeGood.status === 200 && probeGood.body?.ok === true, `the by-value probe speaks ok (got ${probeGood.status}/${probeGood.body?.ok})`);
  const modules = probeGood.body?.probe?.relionModules ?? [];
  must(modules.includes("relion/5.0.1"), `the probe inventories relion/5.0.1 (${modules.join(", ")})`);
  must(!!probeGood.body?.probe?.homeDir, `the probe captured $HOME (${probeGood.body?.probe?.homeDir})`);
  must(readConns().length === registryBefore, `the registry is UNCHANGED after the probe (${registryBefore})`);

  const probeBad = await page.evaluate(async ({ SH }) => {
    const r = await fetch("/api/remote/connections/test", {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "127.0.0.1", port: 3022, username: "cryo", password: "wrong-password",
        authMethod: "password", remoteRoot: "/projects/cryoflow",
      }),
    });
    return { status: r.status, body: await r.json() };
  }, { SH });
  must(probeBad.status === 200 && probeBad.body?.ok === false, `a bad password degrades to ok:false (got ${probeBad.status}/${probeBad.body?.ok})`);
  must(!!probeBad.body?.probe?.error, `the probe carries the error line ("${String(probeBad.body?.probe?.error ?? "").slice(0, 60)}")`);
  must(readConns().length === registryBefore, "the registry is STILL unchanged after the bad probe");

  // the world scrub (t262's ghost-dispatch lesson)
  for (const sc of readConns()) {
    if (String(sc?.id ?? "").startsWith("qa-")) {
      await page.evaluate(async (cid) => {
        await fetch(`/api/remote/connections/${cid}`, { method: "DELETE" }).catch(() => {});
      }, sc.id);
    }
  }

  // C3 — the borrow loop: import → dispatch (keyFileMb=1) → completed
  mkdirSync(MICS_DIR, { recursive: true });
  const names = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc", "mic_05.mrc", "mic_06.mrc"];
  for (const n of names) {
    const W = 64, H = 64;
    const buf = Buffer.alloc(1024 + W * H * 4);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
    buf.writeInt32LE(2, 12);
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
    buf.write("MAP ", 208, "ascii");
    buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x44 + 3, 214); buf.writeUInt8(0x44 + 3, 215);
    for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
    writeFileSync(path.join(MICS_DIR, n), buf);
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
  const importJob = await mkJob({ type: "import", name: "t293 Import", params: { micrographsPath: MICS_DIR, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: JSON.stringify({}) });
  const importDone = await pollUntil(async () => {
    const j = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs.find((x) => x.id === importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed");
  const projId = importDone?.projectId ?? importJob.projectId;

  connId = `qa-t293-${Date.now().toString(36)}`;
  const mk = await page.evaluate(async ({ connId, SH }) => {
    const r = await fetch("/api/remote/connections", {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: connId, name: "QA t293 Borrow", host: "127.0.0.1", port: 3022,
        username: "cryo", password: "demo", authMethod: "password",
        remoteRoot: "/projects/cryoflow", keyFileMb: 1,
      }),
    });
    return { status: r.status, body: await r.json() };
  }, { connId, SH });
  must(mk.status === 201, `the connection is created with keyFileMb=1 (got ${mk.status})`);

  const jobA = await mkJob({ type: "ctffind", name: "t293 CtfFind A" });
  const mkEdge = async (fromJobId, toJobId) => {
    const r = await fetch(`${BASE}/api/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromJobId, toJobId, fromPort: "micrographs", toPort: "micrographs" }),
    });
    return r.status;
  };
  must(!!jobA?.id && [200, 201].includes(await mkEdge(importJob.id, jobA.id)), "ctffind A created and wired");
  const dispA = await page.evaluate(async ({ jobId, connId, SH }) => {
    const r = await fetch(`/api/jobs/${jobId}/run`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
    });
    return r.status;
  }, { jobId: jobA.id, connId, SH });
  must(dispA === 200, `A dispatched to the cluster (${dispA})`);
  const doneA = await pollUntil(async () => (stateRuns()[jobA.id]?.done === true ? stateRuns()[jobA.id] : null), 90_000, 1500);
  must(!!doneA, "A finalized on the cluster");
  const remoteWorkdir = doneA?.remote?.remoteWorkdir ?? "";
  must(remoteWorkdir.startsWith("/projects/cryoflow"), `the record carries the cluster workdir (${remoteWorkdir})`);
  const mirrorA = `/home/z/my-project/data/relion/${projId}/ctffind_${jobA.id.slice(-8)}`;
  must(existsSync(path.join(mirrorA, "micrographs_ctf.star")), "the STAR synced back (text skeleton always syncs)");

  // C4 — the cap: a 2 MB map planted on the cluster survives the re-run,
  // is skipped by the policy, and the listing shows it as a REMOTE tile
  const relCluster = remoteWorkdir.replace(/^\/projects/, "/projects");
  const mockWorkdir = `${MOCK_FS_ROOT}${relCluster}`;
  const PLANT = "run_it003_class001.mrc";
  const PW = 720, PH = 720;
  const plant = Buffer.alloc(1024 + PW * PH * 4, 0);
  plant.writeInt32LE(PW, 0); plant.writeInt32LE(PH, 4); plant.writeInt32LE(1, 8);
  plant.writeInt32LE(2, 12);
  plant.writeInt32LE(PW, 28); plant.writeInt32LE(PH, 32); plant.writeInt32LE(1, 36);
  plant.writeFloatLE(1.78 * PW, 40); plant.writeFloatLE(1.78 * PH, 44); plant.writeFloatLE(1.78, 48);
  plant.write("MAP ", 208, "ascii");
  plant.writeUInt8(0x44, 212); plant.writeUInt8(0x44, 213); plant.writeUInt8(0x44 + 3, 214); plant.writeUInt8(0x44 + 3, 215);
  for (let i = 0; i < PW * PH; i++) plant.writeFloatLE(Math.cos(i / 11) * 0.3, 1024 + i * 4);
  const plantLocal = path.join(mockWorkdir, PLANT);
  mkdirSync(mockWorkdir, { recursive: true });
  writeFileSync(plantLocal, plant);
  must(existsSync(plantLocal), `the 2 MB map is planted on the cluster (${PW}×${PH} float32)`);
  const plantBytes = plant.length;

  // RE-RUN job A itself (the Re-run flow — same workdir, so the planted
  // map rides through the second finalize): the record re-finalizes and
  // the manifest is rewritten — poll on the manifest's writtenAt change
  const manifestBefore = JSON.parse(readFileSync(path.join(mirrorA, ".cf-remote-manifest.json"), "utf8"));
  const dispRe = await page.evaluate(async ({ jobId, connId, SH }) => {
    const r = await fetch(`/api/jobs/${jobId}/run`, {
      method: "POST",
      headers: { ...SH, "Content-Type": "application/json" },
      body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
    });
    return r.status;
  }, { jobId: jobA.id, connId, SH });
  must(dispRe === 200, `A RE-RUN dispatched to the cluster (${dispRe} — a completed job re-runs into its own workdir)`);
  const doneRe = await pollUntil(async () => {
    try {
      const m = JSON.parse(readFileSync(path.join(mirrorA, ".cf-remote-manifest.json"), "utf8"));
      return m.writtenAt && m.writtenAt !== manifestBefore.writtenAt && (stateRuns()[jobA.id]?.done === true) ? m : null;
    } catch {
      return null;
    }
  }, 90_000, 1500);
  must(!!doneRe, "A re-finalized (the manifest was rewritten — the planted map rode through)");

  must(!existsSync(path.join(mirrorA, PLANT)), "the planted 2 MB map NEVER landed (the cap held)");
  const manifestB = doneRe;
  const manifestEntry = (manifestB.files ?? []).find((f) => f.path === PLANT);
  must(!!manifestEntry && manifestEntry.size === plantBytes, `the manifest ledger lists the skipped map (${manifestEntry?.size} B)`);
  must(
    (stateRuns()[jobA.id]?.remote?.syncedFiles ?? 0) >= 3,
    `the re-run's own skeleton synced (${stateRuns()[jobA.id]?.remote?.syncedFiles} files)`
  );

  const outsB = await (await fetch(`${BASE}/api/jobs/${jobA.id}/outputs`, { headers: SH })).json();
  const remoteTile = (outsB.files ?? []).find((f) => f.remote === true && f.path === PLANT);
  must(!!remoteTile, "the outputs listing shows the skipped map as a REMOTE tile");
  must(remoteTile?.kind === "mrc" && remoteTile?.size === plantBytes, `the remote tile speaks kind + size (${remoteTile?.kind}, ${remoteTile?.size})`);
  must(/Class 1/i.test(remoteTile?.label ?? ""), `the remote tile carries its friendly label ("${remoteTile?.label}")`);
  must(remoteTile?.dims === undefined, "the remote tile honestly lacks dims (header facts wait for the fetch)");

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2200);
  await page.locator(`[data-job="${jobA.id}"]`).first().click({ force: true });
  await sleep(1400);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const cloudBadge = page.locator('[data-canvas-ui="remote-fetch-preview"]').first();
  const tileSeen = await pollUntil(async () => (await cloudBadge.isVisible().catch(() => false)) || null, 12_000, 800);
  must(!!tileSeen, "the REMOTE tile wears its cloud badge in Results (fetch-gated by construction)");
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/t293-remote-borrow.png` });

  // C5 — the lazy leg: the png door pulls the file, byte-identical, and
  // the tile graduates to local WITH dims
  const pngRes = await fetch(`${BASE}/api/jobs/${jobA.id}/outputs/file?path=${encodeURIComponent(PLANT)}&format=png`, { headers: SH });
  must(pngRes.status === 200, `the png door lazy-fetches and renders (${pngRes.status})`);
  const pngBuf = Buffer.from(await pngRes.arrayBuffer());
  must(pngBuf.length > 4 && pngBuf[0] === 0x89 && pngBuf[1] === 0x50, `the door serves a real PNG (${Math.round(pngBuf.length / 1024)} KiB)`);
  const landed = path.join(mirrorA, PLANT);
  must(existsSync(landed), "the fetched file landed at its REAL workdir path (not a cache)");
  must(existsSync(landed) && sha(landed) === sha(plantLocal), "the landed file is BYTE-IDENTICAL to the cluster copy (sha256)");
  const outsAfter = await (await fetch(`${BASE}/api/jobs/${jobA.id}/outputs`, { headers: SH })).json();
  const localTile = (outsAfter.files ?? []).find((f) => f.path === PLANT);
  must(!!localTile && localTile.remote !== true, "the listing graduated the tile to local");
  must(!!localTile?.dims, `the graduated tile now carries its header facts (dims ${JSON.stringify(localTile?.dims ?? null)})`);
  must(((outsAfter.files ?? []).filter((f) => f.remote === true)).length === 0, "no remote tile remains (everything accounted for)");

  // C2 — the mode switch: the Run ▾ menu offers both worlds, local honestly disabled
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await sleep(2200);
  await page.locator(`[data-job="${jobA.id}"]`).first().click({ force: true });
  await sleep(1400);
  const modeTrigger = page.locator('[aria-label="Choose run mode: this machine or cluster (SSH)"]').first();
  must(await modeTrigger.isVisible().catch(() => false), "the mode trigger is on the job card");
  // open the menu with a retry (a transient toast may eat the first click)
  let localItem = null;
  let clusterItem = null;
  for (let k = 0; k < 4 && !localItem; k++) {
    if (k > 0) await modeTrigger.click().catch(() => {});
    await sleep(600);
    const menu = page.locator('[role="menu"][data-state="open"]');
    if (!(await menu.isVisible().catch(() => false))) continue;
    localItem = menu.locator('[data-run-mode="local"]').first();
    clusterItem = menu.locator('[data-run-mode="cluster"]').first();
    if (!(await localItem.isVisible().catch(() => false))) localItem = null;
  }
  must(!!localItem, "the menu offers Run on this machine (data-run-mode=local)");
  must(!!clusterItem, "the menu offers Run on cluster (SSH) (data-run-mode=cluster)");
  must(!(await clusterItem.isDisabled()), "the cluster item stays enabled (the connection exists)");
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(400);

  // the HONEST disabled state lives in the job-panel's menu (idle job):
  // the inspector's Re-run ▾ handles the no-RELION case via its confirm
  // dialog instead — assert each gate on the component that owns it
  const idleJob = await mkJob({ type: "import", name: "t293 Mode Probe", params: { micrographsPath: MICS_DIR, pixelSize: 1.77 } });
  must(!!idleJob?.id, "an idle job exists for the panel-menu gate");
  await page.locator(`[data-job="${idleJob.id}"]`).first().click({ force: true });
  await sleep(1200);
  const panelTrigger = page.locator('[aria-label="Choose run mode: this machine or cluster (SSH)"]').first();
  await panelTrigger.click().catch(() => {});
  let panelLocal = null;
  for (let k = 0; k < 4 && !panelLocal; k++) {
    if (k > 0) await panelTrigger.click().catch(() => {});
    await sleep(600);
    const menu = page.locator('[role="menu"][data-state="open"]');
    if (!(await menu.isVisible().catch(() => false))) continue;
    const cand = menu.locator('[data-run-mode="local"]').first();
    if (await cand.isVisible().catch(() => false)) panelLocal = cand;
  }
  must(!!panelLocal, "the idle job's panel menu offers Run on this machine");
  if (panelLocal) {
    must(await panelLocal.isDisabled(), "the PANEL's local item is honestly disabled (no RELION — idle job, job-panel gate)");
  }
  await page.keyboard.press("Escape").catch(() => {});
} finally {
  // cleanup newest-first: jobs, connection, planted cluster file, mics
  for (const id of [...createdJobs].reverse()) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }); } catch { /* best effort */ }
  }
  if (connId) {
    try { await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH }); } catch { /* best effort */ }
  }
  try { rmSync(MICS_DIR, { recursive: true, force: true }); } catch { /* best effort */ }
  await browser.close();
}

console.log("== PHASE Z: the world as it was ==");
const rosterZ = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
must(rosterZ.length === 21, `roster 21 after the dance (got ${rosterZ.length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0].slice(0, 120)}` : ""})`);

console.log(fail === 0 ? "t293: ALL PASS" : `t293: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
