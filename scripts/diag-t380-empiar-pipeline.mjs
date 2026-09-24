#!/usr/bin/env node
/**
 * diag-t380 — EMPIAR-10017 full-chain on the cluster lane + the POLARITY
 * verdict (the user's 「用empiar-10017数据模拟在cluster上运行，看一下各种任务
 * 生成的mrcs或mrc是否正常」 + 「2D 分类颗粒是黑色的」).
 *
 * Chain (12 jobs, cluster lane, CPU): Import(mics, zero-upload) → MotionCorr
 * → Ctffind → AutoPick(LoG, REAL dark-blob detection) → Extract(REAL crops,
 * --norm) → Class2D(REAL particle averages) → InitialModel → Class3D →
 * Refine3D → MaskCreate → PostProcess.
 *
 * POLARITY assertions (the point of t380):
 *   P1 raw micrograph — all-positive ice: renders WITHOUT flip → the β-gal
 *      particles are DARK on grey ice (cryo truth)
 *   P2 extracted crops --norm → solvent ≈ 0 σ ≈ 1, particle NEGATIVE → the
 *      app's render FLIPS → bright-on-black
 *   P3 class averages — 8 strong classes (ratio 2.6–3.1, the measured
 *      EMPIAR range) + the t380 DEAD-ZONE class (ratio 1.02–1.04, the exact
 *      shape the OLD 1.2× gate refused to flip — 「颗粒是黑色的」): the LIVE
 *      render must show it bright (new 1.0× gate), and the simulated OLD
 *      gate on the same bytes must show it dark (the A/B proof)
 *   P4 3D maps — negative-density cores → ortho planes render bright
 *   P5 the import's negativeStain checkbox re-pins every downstream render
 *      (PNG bytes change; cache keys never collide)
 *
 * Usage:
 *   CF_ROOT=/home/z/cryoflow node scripts/diag-t380-empiar-pipeline.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const MOCK = `${ROOT}/services/mock-cluster`;
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const CONN_ID = "t380-conn";
const DATA_DIR = path.join(ROOT, "data");

let pass = 0;
let fail = 0;
const failures = [];
function must(cond, label, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    failures.push(`${label}${extra ? ` — ${extra}"` : ""}`);
    console.log(`  ✗ FAIL: ${label}${extra ? ` — ${String(extra).slice(0, 300)}` : ""}`);
  }
  return !!cond;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (t) => console.log(`\n━━━ ${t} ━━━`);

async function api(url, init) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let r;
    try {
      r = await fetch(`${BASE}${url}`, init);
    } catch (e) {
      // the 4GB sandbox OOM-reaps the dev server mid-run — bring it back
      console.log(`    [server-down: ${e.code ?? e.message} — resurrecting via cf-up.sh]`);
      spawnSync("bash", ["/tmp/cf-up.sh"], { encoding: "utf8", timeout: 120_000 });
      await sleep(2000);
      continue;
    }
    let body = null;
    try {
      body = await r.json();
    } catch {}
    return { status: r.status, body };
  }
  return { status: 0, body: null };
}

/** SSH into the mock cluster (the repo's test client). */
function client(cmd) {
  const r = spawnSync("node", [`${MOCK}/test-client.mjs`, cmd], { encoding: "utf8", timeout: 60_000 });
  return { out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

/** grayscale stats of a rendered PNG: center vs border means */
async function pngCenterVsBorder(png, centerFrac = 0.28) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const at = (x, y) => data[(y * w + x) * ch];
  const cx0 = Math.floor((w * (1 - centerFrac)) / 2);
  const cx1 = Math.ceil((w * (1 + centerFrac)) / 2);
  const cy0 = Math.floor((h * (1 - centerFrac)) / 2);
  const cy1 = Math.ceil((h * (1 + centerFrac)) / 2);
  let cs = 0;
  let cn = 0;
  let bs = 0;
  let bn = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = at(x, y);
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) {
        cs += v;
        cn++;
      } else if (x < 10 || y < 10 || x >= w - 10 || y >= h - 10) {
        bs += v;
        bn++;
      }
    }
  }
  return { center: cs / Math.max(1, cn), border: bs / Math.max(1, bn), w, h };
}

/** minimal mode-2 MRC slice reader (host-side, for the A/B gate proof) */
function readMrcSlice(file, z) {
  const buf = readFileSync(file);
  const nx = buf.readInt32LE(0);
  const ny = buf.readInt32LE(4);
  const nz = buf.readInt32LE(8);
  const mode = buf.readInt32LE(12);
  const nsymbt = buf.readInt32LE(92);
  if (mode !== 2) throw new Error(`mode ${mode}`);
  const plane = nx * ny * 4;
  const off = 1024 + nsymbt + z * plane;
  const vals = new Float32Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) vals[i] = buf.readFloatLE(off + i * 4);
  return { nx, ny, nz, vals };
}

/** replicate mrc.ts stretchToGray under a given gate (1.2 old | 1.0 t380) */
function stretchGrays(vals, gate) {
  const n = vals.length;
  const sorted = Float32Array.from(vals).sort();
  const lo = sorted[Math.floor(0.02 * (n - 1))];
  const hi = sorted[Math.ceil(0.98 * (n - 1))];
  const inverted = lo < 0 && -lo > gate * Math.max(hi, Number.EPSILON);
  const gray = new Float32Array(n);
  if (inverted) {
    const loSig = sorted[Math.floor(0.005 * (n - 1))];
    const span = -loSig;
    if (!(span > 0)) return null;
    for (let i = 0; i < n; i++) gray[i] = Math.max(0, Math.min(255, Math.round((-vals[i] / span) * 255)));
  } else {
    const span = hi - lo;
    if (!(span > 0)) return null;
    for (let i = 0; i < n; i++) gray[i] = Math.max(0, Math.min(255, Math.round(((vals[i] - lo) / span) * 255)));
  }
  return gray;
}

function grayCenterVsBorder(gray, nx, ny, frac = 0.28) {
  const cx0 = Math.floor((nx * (1 - frac)) / 2);
  const cx1 = Math.ceil((nx * (1 + frac)) / 2);
  const cy0 = Math.floor((ny * (1 - frac)) / 2);
  const cy1 = Math.ceil((ny * (1 + frac)) / 2);
  let cs = 0;
  let cn = 0;
  let bs = 0;
  let bn = 0;
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const v = gray[y * nx + x];
      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) {
        cs += v;
        cn++;
      } else if (x < 4 || y < 4 || x >= nx - 4 || y >= ny - 4) {
        bs += v;
        bn++;
      }
    }
  }
  return { center: cs / Math.max(1, cn), border: bs / Math.max(1, bn) };
}

function polarityRatio(vals) {
  const n = vals.length;
  const sorted = Float32Array.from(vals).sort();
  const lo = sorted[Math.floor(0.02 * (n - 1))];
  const hi = sorted[Math.ceil(0.98 * (n - 1))];
  return -lo / Math.max(hi, Number.EPSILON);
}

const remoteWorkdir = (pid, job) => `/projects/cryoflow/${pid}/${job.type}_${job.id.slice(-8)}`;
const localWorkdir = (pid, job) => path.join(DATA_DIR, "relion", pid, `${job.type}_${job.id.slice(-8)}`);

async function waitTerminal(jobId, { timeoutMs = 240_000, want = "completed" } = {}) {
  const seen = [];
  const t0 = Date.now();
  for (;;) {
    const { body } = await api(`/api/jobs?jobId=${jobId}`, { headers: SH });
    const job = body?.jobs?.find?.((j) => j.id === jobId) ?? body?.job;
    if (job && !seen.includes(job.status)) seen.push(job.status);
    if (job && (job.status === "completed" || job.status === "failed")) {
      return { job, seen, timeout: false };
    }
    if (Date.now() - t0 > timeoutMs) return { job: job ?? null, seen, timeout: true };
    await sleep(2000);
  }
}

async function mkJob(type, params, extra = {}) {
  const r = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ type, params, ...extra }),
  });
  must(r.status >= 200 && r.status < 300, `create ${type} (${r.status})`, JSON.stringify(r.body).slice(0, 200));
  return r.body?.job ?? r.body;
}

async function mkEdge(fromId, toId, fromPort, toPort) {
  const r = await api("/api/edges", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ fromJobId: fromId, toJobId: toId, ...(fromPort ? { fromPort } : {}), ...(toPort ? { toPort } : {}) }),
  });
  must(r.status >= 200 && r.status < 300, `edge ${fromPort ?? "*"}→${toPort ?? "*"}`, JSON.stringify(r.body).slice(0, 160));
}

async function runRemote(jobId) {
  return api(`/api/jobs/${jobId}/run`, { method: "POST", headers: SHJ, body: "{}" });
}

async function fetchPng(urlPath) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let r;
    try {
      r = await fetch(`${BASE}${urlPath}`, { headers: SH });
    } catch (e) {
      console.log(`    [server-down: ${e.code ?? e.message} — resurrecting via cf-up.sh]`);
      spawnSync("bash", ["/tmp/cf-up.sh"], { encoding: "utf8", timeout: 120_000 });
      await sleep(2000);
      continue;
    }
    if (!r.ok) return { ok: false, status: r.status, text: (await r.text()).slice(0, 200) };
    return { ok: true, buf: Buffer.from(await r.arrayBuffer()) };
  }
  return { ok: false, status: 0, text: "server unreachable after 3 resurrect attempts" };
}

const stage = async (label, type, params, edges, asserts = {}) => {
  section(label);
  const job = await mkJob(type, params, { name: label });
  if (!job?.id) return null;
  for (const [from, fp, tp] of edges) await mkEdge(from.id, job.id, fp, tp);
  const run = await runRemote(job.id);
  if (!must(run.status === 200, `${label}: dispatch accepted`, JSON.stringify(run.body).slice(0, 200))) return job;
  const res = await waitTerminal(job.id, { timeoutMs: asserts.timeoutMs ?? 240_000 });
  must(
    res.job?.status === "completed",
    `${label}: completed (${res.job?.status ?? "?"}${res.timeout ? " TIMEOUT" : ""} — ${String(res.job?.result ?? "").slice(0, 140)})`
  );
  return job;
};

const t0 = Date.now();
try {
  section("PHASE 0 — the stage (server, mock cluster, EMPIAR-10017 fixtures)");
  must((await api("/api/jobs", { headers: SH })).status === 200, "the app answers /api/jobs 200");
  const probe = client("echo ok && ls /data2/empiar-10017/micrographs | wc -l && ls /data2/empiar-10017/coords | wc -l");
  must(probe.out.includes("ok"), "the mock cluster answers over SSH");
  must(/8/.test(probe.out), `8 EMPIAR-10017 micrographs on the cluster (${probe.out.replace(/\n/g, " | ")})`);
  const sz = client("stat -c%s /data2/empiar-10017/micrographs/Falcon_2012_06_12-14_33_35_0.mrc").out;
  must(Number(sz) === 67109888, `micrograph byte size 67,109,888 (4096² float32) — got ${sz}`);
  const hdr = client("head -c 16 /data2/empiar-10017/micrographs/Falcon_2012_06_12-14_33_35_0.mrc | od -An -td4 | tr -s ' '").out;
  must(/4096\s+4096\s+1/.test(hdr), `MRC header NX=NY=4096 NZ=1 — got ${hdr.trim()}`);

  section("PHASE 1 — connection + remote project");
  // prune stale t380 projects from earlier runs (they multiply under OOM retries)
  {
    const list = await api("/api/projects", { headers: SH });
    for (const p of list.body?.projects ?? []) {
      if (/EMPIAR-10017 t380/.test(p.name ?? "")) {
        await api(`/api/projects/${p.id}`, { method: "DELETE", headers: SHJ });
        console.log(`    pruned stale project ${p.name}`);
      }
    }
  }
  const mkc = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN_ID, name: "t380 mock cluster", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow", defaultModule: "relion/5.0.1",
    }),
  });
  must(mkc.status === 200 || mkc.status === 201, `the connection upserts (${mkc.status})`);
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: `EMPIAR-10017 t380 ${new Date().toISOString().slice(11, 19)}`, mode: "spa", remoteConnectionId: CONN_ID }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  const projectId = proj.body?.project?.id;
  const sw = await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  must(sw.status >= 200 && sw.status < 300, "the project activates");
  console.log(`    projectId: ${projectId}`);

  section("PHASE 2 — Import (cluster-resident, zero-upload)");
  const imp = await mkJob("import", {
    nodeType: "micrographs", micrographsPath: "/data2/empiar-10017/micrographs",
    pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25,
    negativeStain: false,
  }, { name: "Import EMPIAR-10017 mics", x: 60, y: 60 });
  {
    const run = await runRemote(imp.id);
    must(run.status === 200, `import runs (bare POST → project binding) — ${run.status}`);
    const res = await waitTerminal(imp.id, { timeoutMs: 120_000 });
    must(res.job?.status === "completed", `import completed (${res.job?.status}: ${String(res.job?.result).slice(0, 120)})`);
    const star = readFileSync(path.join(localWorkdir(projectId, imp), "micrographs.star"), "utf8");
    must((star.match(/Falcon_2012/g) ?? []).length === 8, "all 8 micrograph rows present");
    must(star.includes("/data2/empiar-10017/micrographs/"), "CLUSTER-ABSOLUTE rows (zero-upload semantics)");
    // P1 — raw micrograph polarity: all-positive ice, DARK particles, NO flip.
    // Sample at KNOWN blob positions (the fixture's .coord rows) mapped into
    // preview pixels — the image centre is not guaranteed to carry a particle.
    const preview = await fetchPng(`/api/jobs/${imp.id}/micrographs?preview=/data2/empiar-10017/micrographs/Falcon_2012_06_12-14_33_35_0.mrc`);
    if (must(preview.ok, "the micrograph preview door serves a PNG")) {
      const coordTxt = client("head -6 /data2/empiar-10017/coords/Falcon_2012_06_12-14_33_35_0.coord").out;
      const blobs = coordTxt.split("\n").map((l) => l.trim().split(/\s+/).map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite)).slice(0, 5);
      const { data, info } = await sharp(preview.buf).raw().toBuffer({ resolveWithObject: true });
      const w = info.width;
      const h = info.height;
      const ch = info.channels;
      const at = (x, y) => data[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * ch];
      const sampleAt = (fx, fy, rad) => {
        const px = Math.round((fx / 4096) * w);
        const py = Math.round((fy / 4096) * h);
        let s = 0;
        let n = 0;
        for (let dy = -rad; dy <= rad; dy++)
          for (let dx = -rad; dx <= rad; dx++) {
            s += at(px + dx, py + dy);
            n++;
          }
        return s / Math.max(1, n);
      };
      // corners = clean ice reference (blobs live on a 512px grid starting at 256)
      const ice = (sampleAt(30, 30, 4) + sampleAt(4060, 30, 4) + sampleAt(30, 4060, 4)) / 3;
      const blobMeans = blobs.map(([bx, by]) => sampleAt(bx, by, 3));
      const blobMean = blobMeans.reduce((a, b) => a + b, 0) / Math.max(1, blobMeans.length);
      console.log(`    mic preview ${w}×${h}: ice=${ice.toFixed(1)} blob=${blobMean.toFixed(1)} (samples ${blobMeans.map((m) => m.toFixed(0)).join(",")})`);
      must(blobMean < ice - 6, `P1 raw cryo mic: particles render DARKER than ice (blob ${blobMean.toFixed(1)} < ice ${ice.toFixed(1)}) — no flip on all-positive data`);
    }
  }

  section("PHASE 3 — MotionCorr → Ctffind → AutoPick (LoG, CPU)");
  const mc = await stage("MotionCorr", "motioncorr", { patchX: 5, patchY: 5, bfactor: 150, dosePerFrame: 1.28 }, [[imp, "micrographs", "movies"]]);
  const ctf = mc && (await stage("Ctffind", "ctffind", { box: 512, resMin: 30, resMax: 5, dFMin: 5000, dFMax: 50000 }, [[mc, "micrographs", "micrographs"]]));
  const pick = ctf && (await stage("AutoPick LoG", "autopick", { pickingMethod: "Laplacian of Gaussian", logDiamMin: 120, logDiamMax: 180, logAdjustThreshold: 0, threshold: 0.4 }, [[ctf, "micrographs", "micrographs"]]));
  if (pick) {
    const rW = remoteWorkdir(projectId, pick);
    const n = client(`ls ${rW}/micrographs/*_autopick.star 2>/dev/null | wc -l`).out;
    must(Number(n) >= 8, `per-mic autopick stars on the cluster (got ${n})`);
    const firstStar = client(`cat ${rW}/micrographs/Falcon_2012_06_12-14_33_35_0_autopick.star`).out;
    const rows = firstStar.split("\n").filter((l) => /^\d/.test(l.trim()));
    must(rows.length >= 30, `REAL dark-blob picks on mic 1 (got ${rows.length})`);
    console.log(`    pick sample: ${rows.slice(0, 3).join(" | ")}`);
  }

  section("PHASE 4 — Extract (REAL crops, --norm)");
  const ext = pick && (await stage("Extract", "extract", { boxSize: 128, downsampleTo: 64, bgDiameter: -1, norm: true }, [
    [ctf, "micrographs", "micrographs"],
    [pick, "coords", "coords"],
  ]));
  if (ext) {
    const rW = remoteWorkdir(projectId, ext);
    const stacks = client(`ls ${rW}/extra/*.mrcs 2>/dev/null | wc -l`).out;
    must(Number(stacks) >= 8, `REAL particle stacks on the cluster (got ${stacks})`);
    const logTail = client(`tail -4 ${rW}/run.out 2>/dev/null || tail -4 ${rW}/*.out 2>/dev/null`).out;
    console.log(`    extract log: ${logTail.split("\n").filter(Boolean).slice(-2).join(" / ")}`);
    // P2 — extracted crops: --norm → particle NEGATIVE → render flips bright
    const stackPath = "extra/Falcon_2012_06_12-14_33_35_0_extract.mrcs";
    const png = await fetchPng(`/api/jobs/${ext.id}/outputs/file?path=${encodeURIComponent(stackPath)}&format=png&montage=0&slice=0`);
    if (must(png.ok, "the extract stack renders a PNG via the outputs door")) {
      const st = await pngCenterVsBorder(png.buf);
      console.log(`    crop render ${st.w}×${st.h}: center=${st.center.toFixed(1)} border=${st.border.toFixed(1)}`);
      must(st.center > st.border + 8, `P2 extracted particle renders BRIGHT on dark (center ${st.center.toFixed(1)} > border ${st.border.toFixed(1)}) — the t380 flip`);
    }
  }

  section("PHASE 5 — Class2D (REAL particle averages + the dead-zone class)");
  const c2d = ext && (await stage("Class2D", "class2d", { numClasses: 10, iterations: 4, particleDiameter: 180, tau2Fudge: 1, threads: 4 }, [[ext, "particles", "particles"]]));
  let deadZone = null;
  if (c2d) {
    const rW = remoteWorkdir(projectId, c2d);
    must(client(`test -s ${rW}/run_classes.mrcs && echo YES`).out.includes("YES"), "run_classes.mrcs on the cluster");
    // pull the FINAL classes stack into the local mirror (raw door = lazy SSH fetch)
    const raw = await fetchPng(`/api/jobs/${c2d.id}/outputs/file?path=run_classes.mrcs&format=raw`);
    must(raw.ok, "run_classes.mrcs pulls through the raw door", raw.text ?? "");
    const localClasses = path.join(localWorkdir(projectId, c2d), "run_classes.mrcs");
    must(existsSync(localClasses), "the pulled stack lands in the local mirror");
    // the per-iteration stack carries ALL K slices (the final alias is the
    // class001 copy — a pre-existing dialect); pull it if the mirror lacks it
    const iterFile = "run_it004_classes.mrcs";
    const mirrorIter = path.join(localWorkdir(projectId, c2d), iterFile);
    if (!existsSync(mirrorIter)) {
      const pullIter = await fetchPng(`/api/jobs/${c2d.id}/outputs/file?path=${encodeURIComponent(iterFile)}&format=raw`);
      must(pullIter.ok, "the per-iteration classes stack pulls through the raw door", pullIter.text ?? "");
    }
    const iterExists = existsSync(mirrorIter);
    must(iterExists, "the per-iteration classes stack is in the local mirror");
    const { nz, nx, ny } = (() => {
      const b = readFileSync(mirrorIter);
      return { nz: b.readInt32LE(8), nx: b.readInt32LE(0), ny: b.readInt32LE(4) };
    })();
    console.log(`    per-iteration classes stack: ${nx}×${ny}×${nz}`);
    // P3 — per-class polarity ratios + the live PNG renders
    const pngSlices = [];
    for (let z = 0; z < Math.min(nz, 10); z++) {
      const p = await fetchPng(`/api/jobs/${c2d.id}/iterations/image?file=${iterFile}&slice=${z}`);
      pngSlices.push(p.ok ? await pngCenterVsBorder(p.buf) : null);
    }
    let ratios = [];
    if (iterExists) {
      for (let z = 0; z < nz; z++) {
        const sl = readMrcSlice(mirrorIter, z);
        ratios.push(polarityRatio(sl.vals));
      }
      console.log(`    per-iteration class ratios: ${ratios.map((r) => r.toFixed(2)).join(" ")}`);
      const strong = ratios.filter((r) => r > 1.2).length;
      deadZone = ratios.findIndex((r) => r > 1.0 && r <= 1.2);
      must(strong >= 5, `strong classes (ratio > 1.2, the measured EMPIAR 2.7–3.0 band): ${strong}/${nz}`);
      must(deadZone >= 0, `the t380 DEAD-ZONE class exists (ratio ∈ (1.0, 1.2]) — got ${deadZone >= 0 ? `class ${deadZone + 1} @ ${ratios[deadZone].toFixed(2)}` : "none"}`);
    }
    if (deadZone != null && deadZone >= 0) {
      // the A/B proof on the dead-zone class: OLD gate renders it dark, NEW gate bright
      const dz = readMrcSlice(mirrorIter, deadZone);
      const oldG = stretchGrays(dz.vals, 1.2);
      const newG = stretchGrays(dz.vals, 1.0);
      const oldSt = grayCenterVsBorder(oldG, dz.nx, dz.ny);
      const newSt = grayCenterVsBorder(newG, dz.nx, dz.ny);
      console.log(`    dead-zone class ${deadZone + 1}: old-gate center=${oldSt.center.toFixed(1)} border=${oldSt.border.toFixed(1)} | new-gate center=${newSt.center.toFixed(1)} border=${newSt.border.toFixed(1)}`);
      must(oldSt.center <= oldSt.border + 2, `OLD 1.2× gate would render this class's particle DARK (center ${oldSt.center.toFixed(1)} ≤ border ${oldSt.border.toFixed(1)}) — the 「颗粒是黑色的」 shape`);
      must(newSt.center > newSt.border, `NEW 1.0× gate renders it BRIGHT (center ${newSt.center.toFixed(1)} > border ${newSt.border.toFixed(1)}) — the t380 cure`);
      // the LIVE render must agree with the new gate
      if (pngSlices[deadZone]) {
        const live = pngSlices[deadZone];
        must(live.center > live.border, `the LIVE class-gallery render of the dead-zone class shows a BRIGHT particle (center ${live.center.toFixed(1)} > border ${live.border.toFixed(1)})`);
      }
    }
    const brightCount = pngSlices.filter((s) => s && s.center > s.border + 6).length;
    must(brightCount >= 6, `the live class gallery shows bright particles in ${brightCount}/${pngSlices.length} classes`);
  }

  section("PHASE 6 — the 3D tail (InitialModel → Class3D → Refine3D → MaskCreate → PostProcess)");
  const i0m = ext && (await stage("InitialModel", "initialmodel", { numClasses: 3, iterations: 3, symmetry: "C1" }, [[ext, "particles", "particles"]]));
  const c3d = i0m && (await stage("Class3D", "class3d", { numClasses: 2, iterations: 3, symmetry: "C1", particleDiameter: 180 }, [
    [ext, "particles", "particles"],
    [i0m, "model", "reference"],
  ]));
  const r3d = c3d && (await stage("Refine3D", "refine3d", { symmetry: "D2", iniHigh: 30, iterations: 3, autoRefine: false, particleDiameter: 180 }, [
    [ext, "particles", "particles"],
    [i0m, "model", "reference"],
  ]));
  const mask = c3d && (await stage("MaskCreate", "maskcreate", { threshold: 0.02, softEdge: 6, lowpass: 15, extend: 3 }, [[c3d, "model", "map"]]));
  const post = r3d && mask && (await stage("PostProcess", "postprocess", { autoBfac: true, autobLowres: 10, randomizeFrom: 10 }, [
    [r3d, "half1", "half1"],
    [r3d, "half2", "half2"],
    [mask, "mask", "mask"],
  ]));
  // P4 — the 3D maps render with BRIGHT negative-density cores
  if (c3d) {
    const ortho = await fetchPng(`/api/jobs/${c3d.id}/outputs/file?path=run_class001.mrc&format=png&axis=z&pos=0.5`);
    if (must(ortho.ok, "the class3d map renders an ortho z-plane PNG")) {
      const st = await pngCenterVsBorder(ortho.buf);
      console.log(`    map ortho ${st.w}×${st.h}: center=${st.center.toFixed(1)} border=${st.border.toFixed(1)}`);
      must(st.center > st.border + 6, `P4 the 3D map's negative-density core renders BRIGHT (center ${st.center.toFixed(1)} > border ${st.border.toFixed(1)})`);
    }
  }
  if (post) {
    must(client(`test -s ${remoteWorkdir(projectId, post)}/postprocess.mrc && echo YES`).out.includes("YES"), "postprocess.mrc on the cluster");
    const postPng = await fetchPng(`/api/jobs/${post.id}/outputs/file?path=postprocess.mrc&format=png&axis=z&pos=0.5`);
    if (must(postPng.ok, "the postprocess map renders")) {
      const st = await pngCenterVsBorder(postPng.buf);
      must(st.center > st.border + 6, `postprocess.mrc renders a bright core (center ${st.center.toFixed(1)} > border ${st.border.toFixed(1)})`);
    }
  }

  section("PHASE 7 — P5: the import's negativeStain checkbox re-pins every render");
  if (c2d && deadZone != null && deadZone >= 0) {
    const url = `/api/jobs/${c2d.id}/iterations/image?file=run_it004_classes.mrcs&slice=0`;
    const before = await fetchPng(url);
    must(before.ok, "the cryo (auto) class render answers");
    const patch = await api(`/api/jobs/${imp.id}`, {
      method: "PATCH",
      headers: SHJ,
      body: JSON.stringify({ params: { negativeStain: true } }),
    });
    must(patch.status >= 200 && patch.status < 300, `PATCH import negativeStain=true (${patch.status})`);
    const after = await fetchPng(`${url}&v=ns`);
    if (must(after.ok, "the negative-stain-pinned class render answers")) {
      must(!before.buf.equals(after.buf), "the two polarities render DIFFERENT PNG bytes (cache keys never collide)");
      const stA = await pngCenterVsBorder(before.buf);
      const stB = await pngCenterVsBorder(after.buf);
      console.log(`    auto(flip): center=${stA.center.toFixed(1)} border=${stA.border.toFixed(1)} | ns(no-flip): center=${stB.center.toFixed(1)} border=${stB.border.toFixed(1)}`);
      must(stA.center > stA.border + 6, `auto (cryo): the particle renders BRIGHT on dark (center ${stA.center.toFixed(1)} > border ${stA.border.toFixed(1)})`);
      must(stB.center < stB.border - 6, `negativeStain pin: the SAME particle renders DARK on the bright field (center ${stB.center.toFixed(1)} < border ${stB.border.toFixed(1)}) — the import checkbox re-pins the display convention`);
    }
    const back = await api(`/api/jobs/${imp.id}`, {
      method: "PATCH",
      headers: SHJ,
      body: JSON.stringify({ params: { negativeStain: false } }),
    });
    must(back.status >= 200 && back.status < 300, "the flag patches back to cryo");
    const restored = await fetchPng(`${url}&v=back`);
    must(restored.ok && restored.buf.equals(before.buf), "the auto-polarity render is restored byte-for-byte");
  }

  section("WRAP");
  const { body } = await api("/api/jobs", { headers: SH });
  const chain = (body?.jobs ?? []).filter((j) => j.projectId === projectId);
  const completed = chain.filter((j) => j.status === "completed").length;
  must(completed >= 11, `the project shows ≥11 completed jobs (import + 10 stages) — got ${completed}`);
  console.log(`\nTotal wall: ${((Date.now() - t0) / 1000).toFixed(0)}s — project ${projectId} LEFT FOR UI QA`);
} catch (e) {
  console.error("diag-t380 aborted:", e);
  must(false, "the diag ran to completion", String(e?.stack ?? e).slice(0, 300));
}

console.log(`\n===== diag-t380 EMPIAR-10017 full chain + polarity: ${pass} passed, ${fail} failed =====`);
if (failures.length) for (const f of failures) console.log(`  - ${f}`);
process.exit(fail > 0 ? 1 : 0);
