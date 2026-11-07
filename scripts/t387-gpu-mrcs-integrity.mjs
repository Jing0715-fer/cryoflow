#!/usr/bin/env node
/**
 * t387 — the GPU-lane corrupted-mrcs field report, made deterministic on the
 * mock cluster.
 *
 * The user's report: 「2d分类时选择了gpu加速，就会输出损坏的mrcs文件，
 * 不选gpu加速就正常，可能其他job也存在类似的问题」— with the t384
 * cache-witness fix already pulled. The mechanism this suite proves closed:
 * a GPU classification writes each round's run_itNNN_classes.mrcs in a burst
 * of SECONDS; the live gallery's polls ride inside that write window; a pull
 * that lands there reads the GROWING file through the login node's buffered
 * chunk reads (planting stale ZERO pages in its cache — the t384 poison, now
 * planted by the PULLS, not the sniffs) and can come home torn. The t387
 * write-settled gate refuses the pull BEFORE any body byte crosses the wire
 * (stat + O_DIRECT header words vs the header's own geometry), the post-pull
 * exact-shape check refuses whatever slipped past, and the sync-back /
 * Files-door witness ladders heal a poisoned cache before a corrupt verdict
 * or a corrupt local copy sticks.
 *
 * Phases:
 *   A  fixtures — a REAL 64×64×30 float32 particle stack (blobs + noise,
 *      MRC2014 header) + a particles.star, written straight into the mock
 *      cluster's /data2/t387 tree (the mock's fs IS a local dir).
 *   B  the user's exact lane — import (particles) → class2d dispatched in
 *      sbatch mode with the run dialog's DEFAULT width (gpus 6 →
 *      mpirun -n 7 + .cf-rank-launch.sh + --gpu 0 + --gres=gpu:6 on the
 *      brain2 partition).
 *   C  during the run — hammer the iterations route for every round the
 *      listing shows (the GPU cadence: rounds appear seconds apart), record
 *      every verdict; assert no round ever latched a torn/poisoned render.
 *   D  after the run —
 *      D1/D2 every cluster-side round stack passes the exact-shape check
 *         (1024 + 4·nx·ny·nz, mode 2, nz ≥ 1);
 *      D3 the final round renders (PNG 200);
 *      D4 a TORN round fixture (the first 40% of a healthy stack, header
 *         intact — the mid-write shape byte-for-byte) is REFUSED with
 *         reason "writing", no PNGs, no done marker in the render cache;
 *      D5 a RIGHT-SIZED ZERO-HEADER round fixture is refused (the witness
 *         ladder ran; on the mock buffered == direct so no illusion — the
 *         honest three-worlds verdict), no PNGs;
 *      D6 completing the torn fixture (rewriting the full bytes) makes the
 *         SAME route render it — the gate re-asks, the settled round lands;
 *      D7/D8 the Files door serves the final stack with bytes that pass
 *         the exact-shape check, and RE-PULLS after the local mirror copy
 *         is poisoned with right-sized zeros (the t367 ghost leg + t387
 *         ladder wiring).
 *   E  teardown (project + connection removed; fixtures stay for reuse).
 */
import { execSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readSync, rmSync, statSync, writeFileSync, writeSync, readdirSync } from "node:fs";

const BASE = process.env.CF_BASE ?? "http://localhost:3001";
const ORIGIN = { Origin: BASE };
const MOCK_FS = "/home/z/cryoflow/services/mock-cluster/fs";
const FIXTURE_DIR = `${MOCK_FS}/data2/t387`;
const DATA_DIR = process.env.CF_DATA_DIR ?? "/home/z/cryoflow/data";

let pass = 0, fail = 0;
const fails = [];
const must = (c, label) => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(label); console.log(`FAIL  ${label}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, ms, every = 1000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  return null;
}
const api = async (path, opts) => {
  const r = await fetch(`${BASE}${path}`, { ...opts, headers: { ...ORIGIN, ...(opts?.body ? { "Content-Type": "application/json" } : {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const readJob = async (id) => {
  const d = await (await fetch(`${BASE}/api/jobs`, { headers: ORIGIN })).json();
  return (d.jobs ?? []).find((x) => x.id === id) ?? null;
};

/* ---------------- A: fixtures ---------------- */
console.log("== A: fixtures (a real particle stack in the mock /data2 tree) ==");
const NX = 64, NY = 64, NZ = 30;
function writeFixtureStack() {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const data = Buffer.alloc(NX * NY * NZ * 4);
  let off = 0;
  for (let z = 0; z < NZ; z++) {
    const cx = NX / 2 + 6 * Math.sin(z * 0.7);
    const cy = NY / 2 + 6 * Math.cos(z * 0.9);
    const rad = 0.22 + ((z * 37) % 10) / 60;
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const dx = (x - cx) / (NX * rad);
        const dy = (y - cy) / (NY * rad);
        const r2 = dx * dx + dy * dy;
        const blob = Math.exp(-3.0 * r2);
        const noise = (((z * 1103515245 + (y * NX + x) * 12345) >>> 0) % 1000) / 1000 - 0.5;
        data.writeFloatLE(0.7 * blob + 0.1 * noise, off);
        off += 4;
      }
    }
  }
  const h = Buffer.alloc(1024);
  h.writeInt32LE(NX, 0); h.writeInt32LE(NY, 4); h.writeInt32LE(NZ, 8);
  h.writeInt32LE(2, 12); // MODE float32
  h.writeInt32LE(NX, 28); h.writeInt32LE(NY, 32); h.writeInt32LE(NZ, 36); // MX MY MZ
  h.writeFloatLE(NX, 40); h.writeFloatLE(NY, 44); h.writeFloatLE(NZ, 48); // CELLA
  h.writeFloatLE(90, 52); h.writeFloatLE(90, 56); h.writeFloatLE(90, 60);
  h.writeInt32LE(1, 64); h.writeInt32LE(2, 68); h.writeInt32LE(3, 72); // MAPC/R/S
  h.writeFloatLE(-0.5, 76); h.writeFloatLE(0.85, 80); h.writeFloatLE(0.02, 84);
  h.writeInt32LE(1, 88); // ISPG
  h.write("MAP ", 208); h.write("\x44\x41", 212);
  h.writeFloatLE(0.2, 216);
  h.writeInt32LE(1, 220);
  const fd = openSync(`${FIXTURE_DIR}/particles.mrcs`, "w");
  writeSync(fd, h); writeSync(fd, data);
  closeSync(fd);
  const star = [
    "",
    "data_optics",
    "",
    "loop_",
    "_rlnOpticsGroup #1",
    "_rlnOpticsGroupName #2",
    "_rlnMicrographOriginalPixelSize #3",
    "_rlnVoltage #4",
    "_rlnSphericalAberration #5",
    "_rlnAmplitudeContrast #6",
    "_rlnImageSize #7",
    "1 optics1 1.77 300 2.7 0.1 64",
    "",
    "data_particles",
    "",
    "loop_",
    "_rlnImageName #1",
    ...Array.from({ length: NZ }, (_, i) => `${i + 1}@particles.mrcs`),
    "",
  ].join("\n");
  writeFileSync(`${FIXTURE_DIR}/particles.star`, star);
}
try {
  const st = statSync(`${FIXTURE_DIR}/particles.mrcs`);
  must(st.size === 1024 + NX * NY * NZ * 4, `A1 fixture stack already present (${st.size} bytes)`);
} catch {
  writeFixtureStack();
  must(statSync(`${FIXTURE_DIR}/particles.mrcs`).size === 1024 + NX * NY * NZ * 4, "A1 fixture stack written");
}
must(existsSync(`${FIXTURE_DIR}/particles.star`), "A2 particles.star present");

/* ---------------- B: the user's lane ---------------- */
console.log("== B: import → class2d at the DEFAULT GPU width (the sbatch6gpu idiom) ==");
const CONN = `qa-t387-${Date.now().toString(36)}`;
{
  const r = await api("/api/remote/connections", {
    method: "POST",
    body: JSON.stringify({
      id: CONN, name: "QA t387 GPU mrcs", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "~/cryoflow", envLines: ["module load relion/5.0.1"],
      useSlurm: true, slurmPartition: "brain2",
    }),
  });
  must(r.status === 201, `B1 the connection is created (${r.status})`);
  const t = await api(`/api/remote/connections/${CONN}/test`, { method: "POST" });
  must(t.body?.probe?.ok === true || t.body?.connection?.lastProbe?.ok === true, "B2 the probe is ok");
}
for (const p of (await api("/api/projects")).body.projects ?? []) {
  if (p.name?.startsWith("t387 GPU mrcs")) await api(`/api/projects/${p.id}`, { method: "DELETE" });
}
const proj = (await api("/api/projects", { method: "POST", body: JSON.stringify({ name: `t387 GPU mrcs ${Date.now().toString(36)}`, mode: "spa", remoteConnectionId: CONN }) })).body.project;
must(!!proj?.id, "B3 the remote project is created");
const pid = proj.id;
const mkJob = async (body) => (await api("/api/jobs", { method: "POST", body: JSON.stringify(body) })).body.job;
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
  (await api("/api/edges", { method: "POST", body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }) })).status;

const imp = await mkJob({
  projectId: pid, type: "import", name: "t387 particles import",
  params: { nodeType: "particles", micrographsPath: "/data2/t387/particles.star", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1 },
});
must(!!imp?.id, "B4 the particles import job exists");
{
  const r = await api(`/api/jobs/${imp.id}/run`, { method: "POST", body: "{}" });
  must(r.status === 200 && !r.body.error, `B5 the import runs (${r.status} ${r.body.error ?? ""})`);
  const j = await pollUntil(async () => {
    const x = await readJob(imp.id);
    return (x?.status === "completed" || x?.status === "failed") ? x : null;
  }, 120_000);
  must(j?.status === "completed", `B6 the import completes (${j?.status} — ${String(j?.result ?? "").slice(0, 160)})`);
}

const c2 = await mkJob({
  projectId: pid, type: "class2d", name: "t387 class2d GPU6",
  params: { numClasses: 5, iterations: 3, doCtf: false, particleDiameter: 120 },
});
must(!!c2?.id, "B7 the class2d job exists");
must((await mkEdge(imp.id, c2.id, "particles", "particles")) < 300, "B8 the particles edge lands");
const c2JobId = c2.id;
{
  // the user's exact submission: sbatch mode, GPU width 6 (the dialog's
  // default), the brain2 partition the mock's sinfo offers at 8/node
  const r = await api(`/api/jobs/${c2JobId}/run`, {
    method: "POST",
    body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", partition: "brain2", gpus: 6 } }),
  });
  must(r.status === 200 && !r.body.error, `B9 the GPU-width dispatch is accepted (${r.status} ${JSON.stringify(r.body).slice(0, 200)})`);
}

/* ---------------- C: hammer the live rounds (the GPU cadence) ---------------- */
console.log("== C: hammering the live iterations route while the run writes ==");
let runDone = false;
const finalJob = pollUntil(async () => {
  const x = await readJob(c2JobId);
  const done = x?.status === "completed" || x?.status === "failed";
  if (done) runDone = true;
  return done ? x : null;
}, 600_000, 700);
const verdicts = new Map(); // file -> {status, reason?} (":png" keys are renders)
(async () => {
  while (!runDone) {
    // refresh=1 — the listing's 12s TTL cache would otherwise serve the
    // EMPTY snapshot from the run's first breath for this whole (fast,
    // mock-paced) run; the real gallery's cadence is fine with the TTL,
    // but this hammer must SEE each round the moment it lands
    const listing = await api(`/api/jobs/${c2JobId}/iterations?refresh=1`).catch(() => null);
    const stacks = listing?.body?.stacks ?? [];
    for (const s of stacks) {
      const file = s?.file;
      if (!file || verdicts.has(file + ":png")) continue;
      const img = await fetch(`${BASE}/api/jobs/${c2JobId}/iterations/image?file=${encodeURIComponent(file)}&slice=0`, { headers: ORIGIN }).catch(() => null);
      if (!img) continue;
      if (img.status === 200) { verdicts.set(file + ":png", { status: 200 }); break; }
      const body = await img.json().catch(() => ({}));
      verdicts.set(file + ":refused", { status: img.status, reason: body.reason });
    }
    await sleep(350);
  }
})();
const c2J = await finalJob;
must(c2J?.status === "completed", `C1 the GPU-width class2d completes (${c2J?.status} — ${String(c2J?.result ?? "").slice(0, 200)})`);
await sleep(1500); // let the in-flight hammer legs settle
{
  let bad = [];
  let pngs = 0, honest = 0;
  for (const [k, v] of verdicts) {
    if (k.endsWith(":png")) { pngs++; continue; }
    if (v.reason === "writing" || v.reason === "missing") honest++;
    else bad.push(`${k} -> ${JSON.stringify(v)}`);
  }
  must(pngs >= 1, `C2 at least one round rendered live (${pngs} rendered, ${honest} honest writing/missing refusals, ${verdicts.size - pngs - honest} other)`);
  must(bad.length === 0, `C3 no round ever latched a torn/poisoned render (${bad.slice(0, 3).join("; ") || "all verdicts honest"})`);
}

/* ---------------- D: byte-level + gate verdicts ---------------- */
console.log("== D: byte verification + the write-settled gate's verdicts ==");
// the workdir is deterministic: <remoteRoot>/<projectId>/<type>_<jobId's
// last 8> — the mock's remoteRoot is ~/cryoflow, which on the host IS
// <MOCK_FS>/home/cryo/cryoflow
const remoteWorkdir = `${MOCK_FS}/home/cryo/cryoflow/${pid}/class2d_${c2JobId.slice(-8)}`;
must(existsSync(remoteWorkdir), `D0 the remote workdir is found (${remoteWorkdir})`);
const workdirFs = remoteWorkdir;

const shapeOf = (buf) => {
  const h = buf.subarray(0, 1024);
  const nx = h.readInt32LE(0), ny = h.readInt32LE(4), nz = h.readInt32LE(8), mode = h.readInt32LE(12);
  return { ok: buf.length === 1024 + 4 * nx * ny * nz && mode === 2 && nz > 0, nx, ny, nz, mode, len: buf.length };
};
{
  const stacks = readdirSync(workdirFs).filter((n) => /^run_it\d+_classes\.mrcs$/.test(n)).sort();
  must(stacks.length >= 2, `D1 the run wrote its round stacks (${stacks.join(", ")})`);
  let allOk = true, firstWhy = "";
  for (const s of stacks) {
    const c = shapeOf(readFileSync0(`${workdirFs}/${s}`));
    if (!c.ok) { allOk = false; firstWhy ||= `${s}: ${JSON.stringify(c)}`; }
  }
  must(allOk, `D2 EVERY cluster round stack passes the exact-shape check (${firstWhy || `${stacks.length} stacks`})`);
  const finalStack = stacks[stacks.length - 1];
  const img = await fetch(`${BASE}/api/jobs/${c2JobId}/iterations/image?file=${encodeURIComponent(finalStack)}&slice=0`, { headers: ORIGIN });
  must(img.status === 200, `D3 the final round renders post-run (${finalStack} -> ${img.status})`);
  await img.arrayBuffer();

  // D4 — the TORN round (the mid-write shape byte-for-byte): the first 40%
  // of a healthy stack. The gate must refuse it as "writing" BEFORE any
  // body byte is read, and no render-cache PNG/done marker may appear.
  const tornName = "run_it900_classes.mrcs";
  const fullBytes = readFileSync0(`${workdirFs}/${finalStack}`);
  writeFileSync(`${workdirFs}/${tornName}`, fullBytes.subarray(0, Math.floor(fullBytes.length * 0.4)));
  const tornImg = await fetch(`${BASE}/api/jobs/${c2JobId}/iterations/image?file=${tornName}&slice=0`, { headers: ORIGIN });
  const tornBody = await tornImg.json().catch(() => ({}));
  must(tornImg.status === 404 && tornBody.reason === "truncated",
    `D4 the TORN round is refused with the never-finished verdict (${tornImg.status} reason=${tornBody.reason})`);
  const tornCache = `${DATA_DIR}/remote-preview/live/${c2JobId}/${tornName.replace(/\.mrcs$/, "")}`;
  must(!existsSync(`${tornCache}/slice0000.png`) && !existsSync(`${tornCache}/.done`),
    `D4b no PNG / done marker latched for the torn round (${tornCache})`);

  // D5 — the RIGHT-SIZED ZERO-HEADER round: the t369 shape verbatim.
  const zeroName = "run_it901_classes.mrcs";
  writeFileSync(`${workdirFs}/${zeroName}`, Buffer.alloc(fullBytes.length));
  const zeroImg = await fetch(`${BASE}/api/jobs/${c2JobId}/iterations/image?file=${zeroName}&slice=0`, { headers: ORIGIN });
  const zeroBody = await zeroImg.json().catch(() => ({}));
  must(zeroImg.status === 404 && zeroBody.reason === "unreadable" && /ZERO/i.test(String(zeroBody.error)),
    `D5 the ZERO-HEADER round is refused with the witness verdict (${zeroImg.status} reason=${zeroBody.reason})`);
  const zeroCache = `${DATA_DIR}/remote-preview/live/${c2JobId}/${zeroName.replace(/\.mrcs$/, "")}`;
  must(!existsSync(`${zeroCache}/slice0000.png`), "D5b no PNG latched for the zero-header round");

  // D6 — completing the torn round: the SAME route now renders it.
  writeFileSync(`${workdirFs}/${tornName}`, fullBytes);
  const healedImg = await fetch(`${BASE}/api/jobs/${c2JobId}/iterations/image?file=${tornName}&slice=0`, { headers: ORIGIN });
  must(healedImg.status === 200, `D6 the completed round renders on the re-ask (${healedImg.status})`);
  await healedImg.arrayBuffer();

  // D7/D8 — the Files door serves the final stack with exact-shape bytes,
  // and RE-PULLS after the LOCAL mirror copy is poisoned with right-sized
  // zeros (the t367 ghost leg + the t387 ladder wiring).
  const doorUrl = `${BASE}/api/jobs/${c2JobId}/outputs/file?path=run_classes.mrcs&format=raw`;
  const door1 = await fetch(doorUrl, { headers: ORIGIN });
  must(door1.status === 200, `D7 the Files door serves the final stack (${door1.status})`);
  const shape1 = shapeOf(Buffer.from(await door1.arrayBuffer()));
  must(shape1.ok, `D8 the served bytes pass the exact-shape check (${JSON.stringify(shape1)})`);
  // poison the local mirror copy (right-sized zeros) → the door must re-pull
  const localWorkdir = `${DATA_DIR}/relion/${pid}/class2d_${c2JobId.slice(-8)}`;
  const localStack = `${localWorkdir}/run_classes.mrcs`;
  if (existsSync(localStack)) {
    const st = statSync(localStack);
    writeFileSync(localStack, Buffer.alloc(st.size));
    const door2 = await fetch(doorUrl, { headers: ORIGIN });
    const shape2 = door2.status === 200 ? shapeOf(Buffer.from(await door2.arrayBuffer())) : { ok: false, status: door2.status };
    must(door2.status === 200 && shape2.ok, `D9 the POISONED local copy is re-pulled healthy (${door2.status} ${JSON.stringify(shape2).slice(0, 120)})`);
  } else {
    console.log(`  .. no local mirror copy at ${localStack} — the key-files policy left the stack remote; the door fetch is the only leg (D9 folded into D7/D8)`);
  }
}

/* ---------------- E: teardown ---------------- */
console.log("== E: teardown ==");
{
  const dp = await api(`/api/projects/${pid}`, { method: "DELETE" });
  must(dp.status < 300 || dp.status === 404, `E1 the project is removed (${dp.status})`);
  const dc = await api(`/api/remote/connections/${CONN}`, { method: "DELETE" });
  must(dc.status < 300 || dc.status === 404, `E2 the connection is removed (${dc.status})`);
}

console.log(`\n== t387: ${pass} pass, ${fail} fail ==`);
if (fail > 0) { console.log(fails.map((f) => `  FAIL ${f}`).join("\n")); process.exit(1); }
process.exit(0);

/* small helpers */
function readFileSync0(p) {
  const fd = openSync(p, "r");
  try {
    const st = statSync(p);
    const b = Buffer.alloc(st.size);
    const got = readSync(fd, b, 0, st.size, 0);
    return b.subarray(0, got);
  } finally { closeSync(fd); }
}
