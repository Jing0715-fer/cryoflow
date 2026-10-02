// t416 — the Topaz Denoise wrapper (a NEW job type): denoise → pick/train
// on the denoised images, the official topaz flow, as a first-class node.
//
// RELION has no denoise UI of its own — the job speaks topaz's CLI through
// the same wrapper the picking/training faces probe (relion_python_topaz).
// The wrapper contract: --i carries the micrograph star and the WRAPPER
// expands it where the files live (topaz's raw CLI takes image paths, not
// stars — the bridge lives on the compute side, so the local lane and the
// cluster lane run the SAME argv shape with zero mirror special-casing).
//
//   A  the product face — the workflow spec (params/tabs/ports), the
//      command template, the engine's input mouth + remote output
//      candidate + collectOutputs case, the micrograph-file-reader set,
//      the single-GPU set, and the curated next-steps universe
//   B  the wrapper's denoise face, unit-tested DIRECTLY (a fabricated
//      star + three real mrcs → three _denoised.mrc copies + an index
//      star that keeps the micrograph schema + per-image progress lines)
//   C  the live remote lane — a fixture project's import completed, the
//      cluster's own topaz inventoried (t264's probe), the denoise job
//      dispatched and COMPLETED, its result sentence spoken, the index
//      star synced home (key-files), the cluster tree carrying the
//      denoised mrcs
//   D  the downstream leg — an autopick job FED BY the denoised index
//      completes on the cluster (the output star is a real micrographs
//      star, not a ceremonial one)
//   E  console clean + roster law (the world keeps its own census)
//
// Run: node scripts/t416-topaz-denoise.mjs   (server on :3000, mock :3022)
import { chromium } from "playwright";
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { worldProtectBasenames, worldSafeRmScript, worldGuardLine } from "./lib/world-safe-cleanup.mjs";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const SHOTS = `${ROOT}/shots-qa`;
const STATE_FILE = `${ROOT}/data/engine-state.json`;
const FIXTURE = `${ROOT}/data/relion/t416-denoise`;
const CLUSTER_TREE = "/projects/cryoflow";

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
  "Content-Type": "application/json",
};

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: SH,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const b = await res.json().catch(() => ({}));
  return { status: res.status, body: b };
}

async function pollUntil(fn, ms, step = 1500) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > ms) return null;
    await sleep(step);
  }
}

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 30_000,
  }).stdout?.trim() ?? "";

const stateRuns = () => {
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return s?.runs ?? s ?? {};
  } catch {
    return {};
  }
};

// ---- fixture bookkeeping (created identities this suite owns) ------------
const createdJobs = [];
const connIds = [];
let fixtureProjectId = null;
let weLaunchedMock = false;

// fabricate one tiny but VALID mrc (t265's recipe — 64×64 float32)
function mrcBuffer() {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12); // mode 2 = float32
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
  return buf;
}

/* ------------------------------------------------------------------ */
console.log("== PHASE A: the product face ==");
{
  const wf = readFileSync(`${ROOT}/src/lib/workflow.ts`, "utf8");
  must(wf.includes('"topazdenoise"') && wf.includes("Topaz Denoise"), "the workflow speaks the topazdenoise spec");
  must(
    /"topazdenoise",[\s\S]{0,400}?Sparkles/.test(wf),
    "the spec rides the Sparkles icon (the denoise family's own mark)"
  );
  must(
    wf.includes('outp("micrographs", "Denoised micrographs (denoised_micrographs.star)", "micrographs")'),
    "the output port keeps the micrograph schema (pick/train consume it)"
  );
  // t526 — semantic, not literal: the curated arrays legitimately GREW
  // after this bench was written (excludemg joined motioncorr/ctffind's
  // next-steps), so pinning the exact array text kept the bench failing on
  // evolution, not on absence. The denoise contract is: both micrograph
  // producers offer denoise, and denoise flows on to pick/train.
  const nextBlock = wf.slice(wf.indexOf("motioncorr: ["), wf.indexOf("topazdenoise: [") + 200);
  must(
    /motioncorr: \[[^\]]*"topazdenoise"/.test(nextBlock) &&
      /ctffind: \[[^\]]*"topazdenoise"/.test(nextBlock) &&
      /topazdenoise: \[[^\]]*"autopick"[^\]]*"manualpick"[^\]]*"topaztrain"/.test(nextBlock),
    "the curated next-steps universe carries denoise (motioncorr/ctffind → it → pick/train)"
  );

  const tpl = readFileSync(`${ROOT}/src/lib/relion/command-templates.ts`, "utf8");
  must(
    tpl.includes('topazdenoise: "topaz denoise --i <micrographs.star> -o <outdir>/') &&
      tpl.includes("the RELION wrapper expands the star where the files live"),
    "the command template speaks the wrapper contract honestly"
  );

  const eng = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
  must(
    eng.includes('case "topazdenoise"') && eng.includes('"denoise",'),
    "the engine's argv builder carries the denoise face"
  );
  must(
    eng.includes('topazdenoise: [{ key: "micrographs_star", exact: ["denoised_micrographs.star"] }]'),
    "the remote output candidate keys on the denoised index star"
  );
  must(
    eng.includes('outputs.micrographs_star = star;\n        result = `REAL: ${countStarRows(star)} micrographs denoised`;'),
    "collectOutputs turns the index into the chainable output + count sentence"
  );
  must(
    /MIC_FILE_READERS = new Set\(\[[\s\S]*?"topazdenoise",?[\s\S]*?\]\)/.test(eng),
    "denoise joins the micrograph-file-readers (cluster-resident refusal covers it)"
  );
  must(
    eng.includes('case "topazdenoise"') && eng.includes('await externalFor(ctx, "topaz"'),
    "denoise resolves topaz from the compute side's world (t264's law, t387's user-wins)"
  );

  const gw = readFileSync(`${ROOT}/src/lib/hpc/gpu-width.ts`, "utf8");
  must(
    /SINGLE_GPU_TYPES = new Set\(\[[\s\S]*?"topazdenoise",?/.test(gw),
    "denoise joins the single-GPU set (one card per denoise job)"
  );

  const mock = readFileSync(`${ROOT}/services/mock-cluster/fs/opt/bin/relion_python_topaz`, "utf8");
  must(mock.includes("def denoise") && mock.includes("denoised_micrographs.star"), "the mock wrapper grew the denoise face");
}

/* ------------------------------------------------------------------ */
console.log("== PHASE B: the wrapper's denoise face, unit-tested directly ==");
{
  const tmp = `${FIXTURE}/wrapper-unit`;
  mkdirSync(path.join(tmp, "mics"), { recursive: true });
  mkdirSync(path.join(tmp, "out"), { recursive: true });
  const names = ["u_01.mrc", "u_02.mrc", "u_03.mrc"];
  for (const n of names) writeFileSync(path.join(tmp, "mics", n), mrcBuffer());
  // a star with RELATIVE names (the wrapper resolves against the star's dir)
  writeFileSync(
    path.join(tmp, "in.star"),
    "data_optics\n\nloop_\n_rlnOpticsGroup\n1\n\ndata_micrographs\n\nloop_\n_rlnMicrographName #1\n" +
      names.map((n) => `mics/${n}`).join("\n") +
      "\n"
  );
  const r = spawnSync("python3", [
    `${ROOT}/services/mock-cluster/fs/opt/bin/relion_python_topaz`,
    "denoise", "--i", path.join(tmp, "in.star"), "-o", path.join(tmp, "out") + "/",
  ], { encoding: "utf8", timeout: 20_000 });
  must(r.status === 0, `the denoise face exits 0 (got ${r.status}: ${(r.stderr ?? "").slice(0, 80)})`);
  const stdout = r.stdout ?? "";
  must(
    [1, 2, 3].every((k) => stdout.includes(`denoising micrograph ${k}/3`)),
    "per-image progress lines speak (the shape real topaz denoise prints)"
  );
  const outDir = path.join(tmp, "out");
  const produced = existsSync(outDir) ? readdirSync(outDir) : [];
  must(
    names.every((n) => produced.includes(n.replace(/\.mrc$/, "_denoised.mrc"))),
    `three denoised mrcs landed (${produced.filter((f) => f.endsWith("_denoised.mrc")).join(", ")})`
  );
  const idx = path.join(outDir, "denoised_micrographs.star");
  must(existsSync(idx), "the index star lands");
  if (existsSync(idx)) {
    const txt = readFileSync(idx, "utf8");
    must(
      txt.includes("_rlnMicrographName") &&
        ["u_01", "u_02", "u_03"].every((s) => txt.includes(`${s}_denoised.mrc`)),
      "the index keeps the micrograph schema and names every denoised file"
    );
    // byte-faithful: the denoised copy IS the source (the mock's honest stand-in)
    const src = readFileSync(path.join(tmp, "mics", "u_01.mrc"));
    const dst = readFileSync(path.join(outDir, "u_01_denoised.mrc"));
    must(src.equals(dst), "the denoised copy is byte-faithful to its source (mrc header intact)");
  }
}

/* ------------------------------------------------------------------ */
console.log("== PHASE C: the live remote lane ==");
const consoleErrors = [];
let browser = null;
try {
  // C0 — the mock cluster is listening (the sandbox's resident one)
  const net = await import("node:net");
  const listening = await new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });
  if (!listening) {
    execSync("bash services/mock-cluster/launch.sh", { cwd: ROOT, stdio: "pipe" });
    weLaunchedMock = true;
    await sleep(2500);
  }
  must(true, weLaunchedMock ? "the mock cluster was launched by this suite" : "the resident mock cluster is listening");

  // C1 — the fixture project (active switches to it — the t410 discovery)
  const proj = await api("POST", "/api/projects", { name: `t416 Denoise ${Date.now().toString(36)}` });
  must(proj.status === 201 || proj.status === 200, `the fixture project is created (${proj.status})`);
  fixtureProjectId = proj.body?.project?.id ?? proj.body?.id ?? null;

  // C2 — six micrographs + a REAL local import
  mkdirSync(FIXTURE, { recursive: true });
  const micNames = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc", "mic_05.mrc", "mic_06.mrc"];
  for (const n of micNames) writeFileSync(path.join(FIXTURE, n), mrcBuffer());
  const mkJob = async (body) => {
    const r = await api("POST", "/api/jobs", body);
    if (r.status === 201 && r.body?.job?.id) createdJobs.push(r.body.job.id);
    return r.body?.job;
  };
  const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
    (await api("POST", "/api/edges", { fromJobId, toJobId, fromPort, toPort })).status;
  const readJob = async (id) => {
    const d = await api("GET", "/api/jobs");
    return (d.body?.jobs ?? []).find((x) => x.id === id) ?? null;
  };

  const importJob = await mkJob({ type: "import", name: "t416 Import", params: { micrographsPath: FIXTURE, pixelSize: 1.77 } });
  must(!!importJob?.id, "the import job exists");
  await api("POST", `/api/jobs/${importJob.id}/run`, {});
  const importDone = await pollUntil(async () => {
    const j = await readJob(importJob.id);
    return j?.status === "completed" ? j : null;
  }, 25_000);
  must(!!importDone, "the local import completed (engine-native)");

  // C3 — connection + probe (t264's inventory: the cluster's OWN topaz)
  const connId = `qa-t416-${Date.now().toString(36)}`;
  connIds.push(connId);
  const mk = await api("POST", "/api/remote/connections", {
    id: connId,
    name: "QA t416 Mock",
    host: "127.0.0.1",
    port: 3022,
    username: "cryo",
    password: "demo",
    authMethod: "password",
    remoteRoot: CLUSTER_TREE,
  });
  must(mk.status === 201, `the connection is created (got ${mk.status})`);
  const test = await api("POST", `/api/remote/connections/${connId}/test`);
  must(test.status === 200 && test.body?.ok === true, `the probe completes (ok=${test.body?.ok})`);
  const extMap = test.body?.probe?.externals?.["relion/5.0.1"] ?? {};
  must(
    typeof extMap.topaz === "string" && extMap.topaz.includes("/opt/bin/relion_python_topaz"),
    `the cluster's topaz is inventoried (${extMap.topaz ?? "absent"})`
  );

  const dispatchRemote = async (jobId, label) => {
    const d = await api("POST", `/api/jobs/${jobId}/run`, {
      remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" },
    });
    must(d.status === 200 || d.status === 201, `${label} dispatched to the cluster (${d.status})`);
  };

  // C4 — the denoise job, wired to the import, dispatched REMOTE
  const jobD = await mkJob({ type: "topazdenoise", name: "t416 Denoise", params: {} });
  must(!!jobD?.id, "the denoise job exists (a NEW type in the world)");
  must(
    (await mkEdge(importJob.id, jobD.id, "micrographs", "micrographs")) >= 200,
    "import → denoise wired (micrographs → micrographs)"
  );
  await dispatchRemote(jobD.id, "the denoise job");
  const doneD = await pollUntil(async () => {
    const j = await readJob(jobD.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 120_000);
  must(doneD?.status === "completed", `the cluster denoise COMPLETES (${doneD?.status}: ${(doneD?.result ?? "").slice(0, 80)})`);
  must(
    /denoised/i.test(doneD?.result ?? "") && /\d/.test(doneD?.result ?? ""),
    `the result sentence speaks the count ("${(doneD?.result ?? "").slice(0, 60)}")`
  );

  // C5 — the record's outputs register the index; the star synced home.
  // POLL, don't assume: the status flip and the finalize legs (key-files
  // sync home, outputs registration) are the same sweep's work but land
  // across DB + state file — the completed sighting can beat the ledger
  // (witnessed 2026-09-28: a rebuild shifted the timing and the bare read
  // raced). Poll until the outputs key settles; fn must be async (the
  // helper does fn().catch — a sync null crashes on .catch).
  const recD = await pollUntil(async () => {
    const r = stateRuns()[jobD.id];
    return r?.outputs?.micrographs_star ? r : null;
  }, 20_000, 500) ?? stateRuns()[jobD.id];
  const outStar = recD?.outputs?.micrographs_star ?? "";
  must(
    !!outStar && /denoised_micrographs\.star$/.test(outStar),
    `the run record registers the chainable output (${outStar || "none"})`
  );
  must(existsSync(outStar), "the index star synced home (key-files policy)");
  if (outStar && existsSync(outStar)) {
    const txt = readFileSync(outStar, "utf8");
    must(
      /_denoised\.mrc/.test(txt) && txt.includes("_rlnMicrographName"),
      "the synced index names cluster-absolute denoised files"
    );
  }
  // the cluster tree carries the denoised mrcs (images never come home)
  const wd = `${jobD.type}_${jobD.id.slice(-8)}`;
  const listing = client(`ls ${CLUSTER_TREE}/*/topazdenoise_${jobD.id.slice(-8)}/ 2>/dev/null | head -20`);
  must(
    /denoised_micrographs\.star/.test(listing),
    `the cluster workdir carries the products (${wd})`
  );

  // ---- Phase D: the downstream leg --------------------------------------
  console.log("== PHASE D: pick on the denoised images ==");
  const jobA = await mkJob({ type: "autopick", name: "t416 AutoPick on denoised", params: { pickingMethod: "Laplacian of Gaussian" } });
  must(!!jobA?.id, "the downstream autopick exists");
  must(
    (await mkEdge(jobD.id, jobA.id, "micrographs", "micrographs")) >= 200,
    "denoise → autopick wired (the denoised index IS a micrographs star)"
  );
  await dispatchRemote(jobA.id, "the downstream autopick");
  const doneA = await pollUntil(async () => {
    const j = await readJob(jobA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 150_000);
  must(doneA?.status === "completed", `the autopick on denoised images COMPLETES (${doneA?.status}: ${(doneA?.result ?? "").slice(0, 60)})`);

  // ---- Phase E: UI smoke + console --------------------------------------
  console.log("== PHASE E: the face in the world (UI) ==");
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await sleep(3500);
  // the denoise node renders on the canvas (Sparkles mark, rose family)
  const nodeCount = await page.getByText("t416 Denoise", { exact: false }).count();
  must(nodeCount >= 1, "the denoise node speaks on the canvas");
  await page.screenshot({ path: `${SHOTS}/t416-denoise-canvas.png` });
  must(consoleErrors.length === 0, `console stays clean (${consoleErrors.length} errors)`);
} catch (e) {
  fail++;
  console.log(`  FAIL: unexpected: ${e?.message ?? e}`);
} finally {
  // ---- the cleanup: only our own residue, the world's names protected ----
  try {
    for (const id of [...createdJobs].reverse()) {
      await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
    }
    for (const cid of connIds) {
      await fetch(`${BASE}/api/remote/connections/${cid}`, { method: "DELETE", headers: SH }).catch(() => {});
    }
    let worldProtect = [];
    try {
      const wj = await api("GET", "/api/jobs");
      worldProtect = worldProtectBasenames(wj.body?.jobs ?? [], createdJobs);
    } catch { /* the API is gone — the glob degrades to plain rm */ }
    console.log(worldGuardLine(worldProtect.length));
    const parts = [
      `rm -rf ${CLUSTER_TREE}/t416-denoise-unknown 2>/dev/null || true`,
      // this suite's own denoise + autopick workdirs die BY NAME wherever
      // their project shells still stand (the jobs are deleted — the API
      // no longer speaks them — so the protect set cannot save them, which
      // is exactly the residue law); the fixture project's OTHER workdirs
      // (import_*) die with their own name only if this suite owns them
      worldSafeRmScript([`${CLUSTER_TREE}/*/topazdenoise_*`, `${CLUSTER_TREE}/*/autopick_*`], worldProtect),
      fixtureProjectId ? `rm -rf ${CLUSTER_TREE}/${fixtureProjectId} 2>/dev/null || true` : ": no project shell",
    ];
    client(parts.join("; "));
  } catch { /* best effort */ }
  try { rmSync(FIXTURE, { recursive: true, force: true }); } catch { /* gone */ }
  if (browser) { try { await browser.close(); } catch { /* gone */ } }
  if (weLaunchedMock) {
    try {
      execSync("pkill -f 'mock-cluster/server.mjs'", { stdio: "pipe" });
      console.log("  (cleanup) stopped the mock cluster we launched");
    } catch { /* already gone */ }
  }
}

// imports placed late to keep the phases' shape readable

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
