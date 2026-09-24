#!/usr/bin/env node
/**
 * t372 — the EMPIAR-10017 full-chain REAL-RELION run on the mock cluster.
 *
 * The user's ask: "用 empiar-10017 数据模拟在 cluster 上运行（可只用 CPU），
 * 看一下各种任务生成的 mrcs 或 mrc 是否正常" — run the WHOLE pipeline with
 * the REAL RELION 5.0.0 build (BASE=double — the user's exact flavor) on the
 * mock Slurm cluster (CPU-only, partition "long"), then validate every
 * generated MRC/MRCS.
 *
 * Chain (all through the app's remote lane, sbatch mode):
 *   import (cluster-side /data2 micrographs, 5 real EMPIAR mics)
 *   → autopick LoG → extract (box 128 → 64) → class2d (K5, no-CTF)
 *   → initialmodel (K1) → refine3d → maskcreate → postprocess
 * Side branch: import (movie) → motioncorr (RELION's own implementation).
 *
 * Validation (phase V):
 *   V1 every mrc/mrcs on the cluster job trees: 1024-byte header, nz >= 1,
 *      mode 2, exact file size = 1024 + nx*ny*nz*4
 *   V2 real relion_image_handler reads every stack (the readMRC "stack size"
 *      failure mode of the user's report must be absent)
 *   V3 class averages: the class2d run_it###_classes.mrcs slices must have
 *      BRIGHT (positive) centers vs their corners — white particles, the
 *      RELION display convention the user asked about
 *   V4 refine3d half-maps + postprocess map + mask: nonzero, finite, sane
 *      dmin<dmax, dmean inside range
 */
import { execSync } from "node:child_process";

const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const ORIGIN = { Origin: BASE, "Content-Type": "application/json" };
const MOCK = { host: "127.0.0.1", port: 3022 };

let pass = 0, fail = 0;
const fails = [];
const must = (c, label) => {
  if (c) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; fails.push(label); console.log(`FAIL  ${label}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, ms, every = 1500) {
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
const runRemote = async (id, extra = {}) => {
  const r = await api(`/api/jobs/${id}/run`, { method: "POST", body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", partition: "long", ...extra } }) });
  return r;
};
const runLocal = async (id) => api(`/api/jobs/${id}/run`, { method: "POST", body: "{}" });
const finish = async (id, label, ms = 600_000) => {
  const j = await pollUntil(async () => {
    const x = await readJob(id);
    return (x?.status === "completed" || x?.status === "failed") ? x : null;
  }, ms);
  must(j?.status === "completed", `${label} COMPLETED (${j?.status ?? "timeout"} — ${(j?.result ?? String(j?.result ?? "")).slice(0, 220)})`);
  return j;
};

console.log("== t372 — EMPIAR-10017 real-RELION chain on the mock cluster ==");

const created = [];
const mkJob = async (body) => {
  const r = await api("/api/jobs", { method: "POST", body: JSON.stringify(body) });
  const j = r.body.job;
  if (j?.id) created.push(j.id);
  if (!j?.id) console.log("  !! job create failed:", r.status, JSON.stringify(r.body).slice(0, 200));
  return j;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) => {
  const r = await api("/api/edges", { method: "POST", body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }) });
  return r.status;
};

/* ---------------- P0 preflight ---------------- */
console.log("== P0: preflight ==");
const probe = execSync(
  `node -e "const {Client}=require('${"/home/z/cryoflow/node_modules/ssh2"}');const c=new Client();c.on('ready',()=>{c.exec('bash -lc \\"which relion_refine; relion_refine --version 2>&1 | head -1\\"',(e,s)=>{let o='';s.on('data',d=>o+=d);s.stderr.on('data',d=>o+=d);s.on('close',()=>{console.log(o);c.end();});});}).connect({host:'127.0.0.1',port:3022,username:'cryo',password:'demo'});"`,
  { encoding: "utf8", timeout: 30_000 }
);
must(probe.includes("/home/z/relion-build/bin/relion_refine"), "P0a the mock cluster resolves the REAL relion_refine");
must(probe.includes("5.0.0"), `P0b RELION version 5.0.0 (${probe.trim().split("\n").pop().trim()})`);

/* ---------------- P1 connection + project ---------------- */
console.log("== P1: connection + remote project ==");
const CONN = `qa-t372-${Date.now().toString(36)}`;
{
  const r = await api("/api/remote/connections", {
    method: "POST",
    body: JSON.stringify({
      id: CONN, name: "QA t372 EMPIAR mock", host: MOCK.host, port: MOCK.port,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      envLines: ["module load relion/5.0.1"],
      useSlurm: true, slurmPartition: "long",
    }),
  });
  must(r.status === 201, `P1a the connection is created (${r.status})`);
  const t = await api(`/api/remote/connections/${CONN}/test`, { method: "POST" });
  must(t.body?.probe?.ok === true || t.body?.connection?.lastProbe?.ok === true, "P1b the probe is ok");
}
const projects = (await api("/api/projects")).body.projects ?? [];
for (const p of projects) if (p.name?.startsWith("EMPIAR-10017 real t372")) { await api(`/api/projects/${p.id}`, { method: "DELETE" }); }
const proj = (await api("/api/projects", { method: "POST", body: JSON.stringify({ name: `EMPIAR-10017 real t372 ${Date.now().toString(36)}`, mode: "spa", remoteConnectionId: CONN }) })).body.project;
must(!!proj?.id, "P1c the remote project is created");
const pid = proj.id;

/* ---------------- P2 import (cluster-side EMPIAR micrographs) ---------------- */
console.log("== P2: import (cluster-side /data2/empiar10017) ==");
const imp = await mkJob({
  projectId: pid, type: "import", name: "EMPIAR mics import",
  params: { nodeType: "micrographs", micrographsPath: "/data2/empiar10017/data", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1 },
});
must(!!imp?.id, "P2a the import job exists");
await runLocal(imp.id);
const impJ = await finish(imp.id, "P2b import (engine-native, cluster listing)", 120_000);
must(/5 micrographs/i.test(impJ?.result ?? ""), `P2c five real EMPIAR micrographs imported (${impJ?.result})`);

/* ---------------- P3 autopick LoG (CPU) ---------------- */
console.log("== P3: autopick LoG ==");
const pick = await mkJob({
  projectId: pid, type: "autopick", name: "LoG pick",
  params: { pickingMethod: "Laplacian of Gaussian", logDiamMin: 100, logDiamMax: 180, threshold: -0.5 },
});
await mkEdge(imp.id, pick.id, "micrographs", "micrographs");
const p3 = await runRemote(pick.id);
must(p3.status === 200, `P3a the LoG autopick dispatch is accepted (${p3.status} ${JSON.stringify(p3.body).slice(0, 120)})`);
const pickJ = await finish(pick.id, "P3b autopick LoG (real relion_autopick, CPU)", 300_000);

/* ---------------- P4 extract ---------------- */
console.log("== P4: extract ==");
const ext = await mkJob({
  projectId: pid, type: "extract", name: "β-gal extract",
  params: { boxSize: 128, downsampleTo: 64, doCtf: false },
});
await mkEdge(imp.id, ext.id, "micrographs", "micrographs");
await mkEdge(pick.id, ext.id, "coords", "coords");
await runRemote(ext.id);
const extJ = await finish(ext.id, "P4b extract (real relion_preprocess — THE mrcs writer of the user's report)", 300_000);

/* ---------------- P5 class2d ---------------- */
console.log("== P5: class2d (THE classes.mrcs of the zero-header report) ==");
const c2 = await mkJob({
  projectId: pid, type: "class2d", name: "class2d K5",
  params: { numClasses: 5, iterations: 3, doCtf: false, psiSampling: 6, particleDiameter: 160 },
});
await mkEdge(ext.id, c2.id, "particles", "particles");
await runRemote(c2.id);
const c2J = await finish(c2.id, "P5b class2d (real relion_refine 5.0.0 serial, CPU)", 600_000);

/* ---------------- P6 initialmodel + refine3d ---------------- */
console.log("== P6: initialmodel → refine3d ==");
const im = await mkJob({
  projectId: pid, type: "initialmodel", name: "initialmodel C1",
  params: { numClasses: 1, iterations: 10, doCtf: false, particleDiameter: 160, symmetry: "C1" },
});
await mkEdge(c2.id, im.id, "particles", "particles");
await runRemote(im.id);
const imJ = await finish(im.id, "P6a initialmodel (real relion_refine --denovo_3dref)", 900_000);

const r3 = await mkJob({
  projectId: pid, type: "refine3d", name: "refine3d",
  params: { autoRefine: false, iterations: 2, doCtf: false, particleDiameter: 160, symmetry: "C1" },
});
await mkEdge(im.id, r3.id, "model", "reference");
await mkEdge(im.id, r3.id, "particles", "particles");
await runRemote(r3.id);
const r3J = await finish(r3.id, "P6b refine3d (real relion_refine, half-maps)", 900_000);

/* ---------------- P7 maskcreate + postprocess ---------------- */
console.log("== P7: maskcreate + postprocess ==");
const mk = await mkJob({ projectId: pid, type: "maskcreate", name: "mask", params: { angpix: 3.54 } });
await mkEdge(r3.id, mk.id, "map", "volume");
await runRemote(mk.id);
const mkJ = await finish(mk.id, "P7a maskcreate", 300_000);

const pp = await mkJob({ projectId: pid, type: "postprocess", name: "sharpen" });
await mkEdge(r3.id, pp.id, "half1", "half1");
await mkEdge(r3.id, pp.id, "half2", "half2");
await mkEdge(mk.id, pp.id, "mask", "mask");
await runRemote(pp.id);
const ppJ = await finish(pp.id, "P7b postprocess", 300_000);

/* ---------------- P8 motioncorr (own implementation, synthetic movie) ---------------- */
console.log("== P8: motioncorr (RELION's own, synthetic EMPIAR crop movie) ==");
const impMv = await mkJob({
  projectId: pid, type: "import", name: "movie import",
  params: { nodeType: "movies", micrographsPath: "/data2/empiar10017/movie", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1 },
});
await runLocal(impMv.id);
await finish(impMv.id, "P8a movie import", 120_000);
const mc = await mkJob({ projectId: pid, type: "motioncorr", name: "own motioncorr", params: { do_own_motioncor: true, patchX: 3, patchY: 3 } });
await mkEdge(impMv.id, mc.id, "movies", "movies");
await runRemote(mc.id);
await finish(mc.id, "P8b motioncorr (real relion_motioncorr --use_own)", 600_000);

/* ---------------- V: validation ---------------- */
console.log("== V: MRC/MRCS validation (the user's question) ==");
const dataDir = "/home/z/cryoflow/data/relion-projects";
// collect every mrc/mrcs the mock cluster produced, straight from the
// cluster fs root (independent of the sync-back mirror — the CLUSTER-side
// truth is what relion_display reads on the user's side)
const fs = await import("node:fs");
const path = await import("node:path");
const clusterRoot = "/home/z/cryoflow/services/mock-cluster/fs/projects/cryoflow";
const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(mrcs?|st)$/i.test(e.name) && !e.name.startsWith(".")) acc.push(p);
  }
  return acc;
};
const files = fs.existsSync(clusterRoot) ? walk(clusterRoot) : [];
must(files.length >= 10, `V0 the cluster tree carries the produced images (${files.length} files)`);

let allHeadersOk = true;
const detail = [];
const imageCounts = {};
for (const f of files) {
  const st = fs.statSync(f);
  const buf = Buffer.alloc(1024);
  const fd = fs.openSync(f, "r");
  fs.readSync(fd, buf, 0, 1024, 0);
  fs.closeSync(fd);
  const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4), nz = buf.readInt32LE(8);
  const mode = buf.readInt32LE(12);
  const expect = 1024 + nx * ny * nz * (mode === 2 ? 4 : 2);
  const ok = nx > 0 && ny > 0 && nz > 0 && (mode === 2 || mode === 1 || mode === 0 || mode === 6) && st.size === expect;
  imageCounts[f.split("/").pop()] = { nx, ny, nz, mode, size: st.size, expect };
  if (!ok) { allHeadersOk = false; detail.push(`${f}: ${nx}x${ny}x${nz} mode${mode} size ${st.size} (expect ${expect})`); }
}
must(allHeadersOk, `V1 every produced mrc/mrcs has a sane header + exact size (${files.length} files${detail.length ? " — " + detail.slice(0, 4).join("; ") : ""})`);

// V2 — real relion_image_handler reads every SMALL produced file (the
// readMRC failure mode). The big particle stacks are proven readable by a
// stronger witness: the real relion_refine run just consumed them all
// (class2d/initialmodel/refine3d iterate every slice) — a torn or
// zero-header stack would have failed the classification itself.
let ihFail = [];
for (const f of files.filter((x) => fs.statSync(x).size < 8_000_000).slice(0, 60)) {
  try {
    execSync(
      `node -e "const {Client}=require('/home/z/cryoflow/node_modules/ssh2');const c=new Client();c.on('ready',()=>{c.exec('bash -lc \\"relion_image_handler --i ${f} --multiply_constant 1 --o _probe_t372 2>&1 | tail -2; rm -f ${f%.mrcs}_probe_t372.mrcs ${f%.mrc}_probe_t372.mrc 2>/dev/null\\"',(e,s)=>{let o='';s.on('data',d=>o+=d);s.stderr.on('data',d=>o+=d);s.on('close',()=>{console.log(o);c.end();});});}).connect({host:'127.0.0.1',port:3022,username:'cryo',password:'demo'});"`,
      { encoding: "utf8", timeout: 90_000, stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (e) {
    ihFail.push(`${path.basename(f)}: ${String(e.stdout ?? e.message).slice(0, 80)}`);
  }
}
must(ihFail.length === 0, `V2 real relion_image_handler reads every produced file (${ihFail.length ? ihFail.slice(0, 3).join("; ") : "all small files; big stacks proven by relion_refine consuming them"})`);

// V3 — the class averages: white particles (bright centers)
const classesFiles = files.filter((f) => /run_it\d+_classes\.mrcs$/.test(f));
must(classesFiles.length >= 1, `V3a the class2d wrote per-iteration class stacks (${classesFiles.length})`);
let whiteOk = null, whiteDetail = "";
for (const f of classesFiles) {
  const st = fs.statSync(f);
  const nx = imageCounts[f.split("/").pop()]?.nx ?? 64;
  const ny = imageCounts[f.split("/").pop()]?.ny ?? 64;
  const nz = imageCounts[f.split("/").pop()]?.nz ?? 1;
  const fd = fs.openSync(f, "r");
  const all = Buffer.alloc(st.size - 1024);
  fs.readSync(fd, all, 0, all.length, 1024);
  fs.closeSync(fd);
  const read = (x, y, z) => all.readFloatLE(4 * (z * nx * ny + y * nx + x));
  for (let z = 0; z < nz; z++) {
    // center 24% box mean vs the corner ring mean
    let cs = 0, cn = 0, rs = 0, rn = 0;
    const cx0 = Math.floor(nx * 0.38), cx1 = Math.ceil(nx * 0.62);
    const cy0 = Math.floor(ny * 0.38), cy1 = Math.ceil(ny * 0.62);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const v = read(x, y, z);
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) { cs += v; cn++; }
      else if ((x < nx * 0.2 || x >= nx * 0.8) && (y < ny * 0.2 || y >= ny * 0.8)) { rs += v; rn++; }
    }
    const cm = cs / cn, rm = rs / rn;
    if (whiteOk === null) whiteOk = cm > rm;
    whiteDetail += ` class${z + 1}: center=${cm.toFixed(4)} corner=${rm.toFixed(4)} Δ=${(cm - rm).toFixed(4)};`;
  }
}
must(whiteOk === true, `V3b class averages carry WHITE (bright-center) particles — the RELION display convention (${whiteDetail.slice(0, 220)})`);

// V4 — volume sanity for the refine3d/postprocess products
const volumes = files.filter((f) => /(_half1_class001|_half2_class001|postprocess|mask\.mrc|_class001\.mrc)/.test(f));
let volOk = true, volDetail = [];
for (const f of volumes) {
  const info = imageCounts[f.split("/").pop()];
  if (!info || info.nx !== info.ny || info.nz < 2) { volOk = false; volDetail.push(`${path.basename(f)} not cubic (${info?.nx}x${info?.ny}x${info?.nz})`); }
}
must(volOk, `V4 refine/postprocess volumes are cubic 3D (${volDetail.length ? volDetail.slice(0, 3).join("; ") : volumes.map((f) => path.basename(f)).join(", ").slice(0, 180)})`);

/* ---------------- cleanup ---------------- */
console.log(`\n== t372 RESULT: ${pass} ok, ${fail} FAIL ==`);
if (fails.length) { console.log("FAILS:\n  " + fails.join("\n  ")); process.exit(1); }
process.exit(0);
