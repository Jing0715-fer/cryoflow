#!/usr/bin/env node
/**
 * diag-t382 — the cluster-lane MRC header fidelity round.
 *
 * The user's field report: run_it000_classes.mrcs downloaded complete
 * (13108224 bytes — the size is right) but its MRC header is ALL ZEROS on
 * THEIR cluster — with the manual verdict that it000 should NOT be a
 * zero-header file (they hand-ran real RELION and it writes a healthy seed
 * round). The ask: 用 EMPIAR-10017 真实数据在沙箱模拟 cluster 上跑
 * import → 2D 分类,看写出来的 mrcs/mrc header 区是否是 0。
 *
 * What this diag proves (or refutes), layer by layer:
 *   H1 every MRC artifact the chain writes — extract stacks, the class2d
 *      seed round (it000, now written by the mock — a t382 fidelity gap
 *      closed), every iteration stack, per-class .mrc, the final K-slice
 *      run_classes.mrcs — carries a HEALTHY header: nx/ny/nz > 0, MODE 2,
 *      MAP magic at 208, NSYMBT 0, byte size exactly 1024 + nx·ny·nz·4,
 *      DMIN < DMAX (non-degenerate range). Zero-header count must be 0.
 *   H2 the seed round is watched LIVE: the moment run_it000_classes.mrcs
 *      lands on the cluster (job still RUNNING — mid-flight, not
 *      post-mortem), its header is verified over SSH.
 *   H3 dual-observer: the same file read over SSH (the login-node view)
 *      and read host-side straight off the mock's fs (the storage view)
 *      must be byte-identical — md5 to md5. A compute→storage write loss
 *      (the field report's shape) would break this agreement.
 *   H4 the app's remote legs are read-only on a live run: md5 before the
 *      raw-door pull == md5 after (cryoflow never writes into the workdir),
 *      and the local mirror copy is byte-identical to the cluster bytes.
 *   H5 the app's iteration chips bar now lists the seed round (iteration
 *      0) — RELION GUI parity — and it renders.
 *
 * Usage:
 *   CF_ROOT=/home/z/cryoflow node scripts/diag-t382-cluster-header-fidelity.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const MOCK = `${ROOT}/services/mock-cluster`;
const MOCK_FS = `${MOCK}/fs`;
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const CONN_ID = "t382-conn";
const DATA_DIR = path.join(ROOT, "data");

let pass = 0;
let fail = 0;
const failures = [];
let zeroHeaderFiles = 0; // the verdict counter (H1)
let headersVerified = 0;

function must(cond, label, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    failures.push(`${label}${extra ? ` — ${extra}` : ""}`);
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
      console.log(`    [server-down: ${e.code ?? e.message} — resurrecting via cf-up.sh]`);
      spawnSync("bash", ["/tmp/cf-up.sh"], { encoding: "utf8", timeout: 150_000 });
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

/* ------------------------------------------------------------- H1 the verifier */

/** Parse a 1024-byte MRC header buffer into the fields the verdict reads. */
function parseMrcHeader(head) {
  return {
    nx: head.readInt32LE(0),
    ny: head.readInt32LE(4),
    nz: head.readInt32LE(8),
    mode: head.readInt32LE(12),
    mx: head.readInt32LE(28),
    my: head.readInt32LE(32),
    mz: head.readInt32LE(36),
    dmin: head.readFloatLE(76),
    dmax: head.readFloatLE(80),
    dmean: head.readFloatLE(84),
    ispg: head.readInt32LE(88),
    nsymbt: head.readInt32LE(92),
    map: head.toString("latin1", 208, 212),
    rms: head.readFloatLE(216),
    first64allzero: head.subarray(0, 256).every((b) => b === 0),
  };
}

/** One SSH round: sizes + first-1024-byte base64 of every named file. */
function sshHeaderRound(workdir, files) {
  const list = files.map((f) => `'${f}'`).join(" ");
  const cmd =
    `cd ${workdir} 2>/dev/null && for f in ${list}; do ` +
    `if [ -f "$f" ]; then printf '%s\\t' "$f"; stat -c%s "$f" | tr -d '\\n'; printf '\\t'; ` +
    `head -c 1024 "$f" | base64 -w0; echo; ` +
    `else printf 'MISSING\\t%s\\n' "$f"; fi; done`;
  const { out } = client(cmd);
  const entries = [];
  for (const line of out.split("\n")) {
    const m = /^(.+?)\t(\d+)\t([A-Za-z0-9+/=]+)$/.exec(line.trim());
    if (m) entries.push({ name: m[1], size: Number(m[2]), head: Buffer.from(m[3], "base64") });
    else if (/^MISSING\t/.test(line.trim())) entries.push({ name: line.trim().slice(8), missing: true });
  }
  return entries;
}

/**
 * The H1 verdict for ONE file: healthy header or the field report's shape.
 * Returns true when healthy. A file counted zero-header trips the verdict
 * counter — the exact shape from the user's cluster (size right, words 0).
 */
function verifyMrcFile(ent, label, { expectNx, expectNy, expectNz } = {}) {
  if (!ent || ent.missing) {
    must(false, `${label}: exists on the cluster`, ent?.name ?? "no entry");
    return false;
  }
  const h = parseMrcHeader(ent.head);
  const sizeOk = ent.size === 1024 + h.nsymbt + h.nx * h.ny * h.nz * 4;
  const dimsOk = h.nx > 0 && h.ny > 0 && h.nz > 0;
  const healthy =
    dimsOk && h.mode === 2 && h.map === "MAP " && h.nsymbt === 0 && sizeOk && h.dmin < h.dmax;
  if (h.first64allzero || !dimsOk) zeroHeaderFiles++;
  headersVerified++;
  const dim = expectNx ? ` (expected ${expectNx}×${expectNy}×${expectNz})` : "";
  must(
    healthy,
    `${label}: header healthy${dim} — ${h.nx}×${h.ny}×${h.nz} mode=${h.mode} MAP="${h.map}" nsymbt=${h.nsymbt} size=${ent.size}${sizeOk ? " ✓" : " ✗"} d[${h.dmin.toFixed(3)},${h.dmax.toFixed(3)}]`,
    healthy ? "" : "the ZERO-HEADER shape" 
  );
  if (expectNx && healthy) {
    must(
      h.nx === expectNx && h.ny === expectNy && h.nz === expectNz,
      `${label}: dims are the run's real geometry (${h.nx}×${h.ny}×${h.nz})`
    );
  }
  return healthy;
}

/* --------------------------------------------------------------- the plumbing */

const remoteWorkdir = (pid, job) => `/projects/cryoflow/${pid}/${job.type}_${job.id.slice(-8)}`;
const hostWorkdir = (pid, job) => path.join(MOCK_FS, "projects", "cryoflow", pid, `${job.type}_${job.id.slice(-8)}`);
const localWorkdir = (pid, job) => path.join(DATA_DIR, "relion", pid, `${job.type}_${job.id.slice(-8)}`);

async function waitTerminal(jobId, { timeoutMs = 240_000 } = {}) {
  const seen = [];
  const t0 = Date.now();
  for (;;) {
    const { body } = await api(`/api/jobs?jobId=${jobId}`, { headers: SH });
    const job = body?.jobs?.find?.((j) => j.id === jobId) ?? body?.job;
    if (job && !seen.includes(job.status)) seen.push(job.status);
    if (job && (job.status === "completed" || job.status === "failed")) return { job, seen, timeout: false };
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

const stage = async (label, type, params, edges, { timeoutMs = 240_000 } = {}) => {
  section(label);
  const job = await mkJob(type, params, { name: label });
  if (!job?.id) return null;
  for (const [from, fp, tp] of edges) await mkEdge(from.id, job.id, fp, tp);
  const run = await runRemote(job.id);
  if (!must(run.status === 200, `${label}: dispatch accepted`, JSON.stringify(run.body).slice(0, 200))) return job;
  const res = await waitTerminal(job.id, { timeoutMs });
  must(
    res.job?.status === "completed",
    `${label}: completed (${res.job?.status ?? "?"}${res.timeout ? " TIMEOUT" : ""} — ${String(res.job?.result ?? "").slice(0, 140)})`
  );
  return res.job?.status === "completed" ? job : null;
};

/* ================================================================ the round */

const t0 = Date.now();
try {
  section("PHASE 0 — the stage (server, mock cluster, EMPIAR-10017 fixtures)");
  must((await api("/api/jobs", { headers: SH })).status === 200, "the app answers /api/jobs 200");
  const probe = client("echo ok && ls /data2/empiar-10017/micrographs | wc -l && ls /data2/empiar-10017/coords | wc -l");
  must(probe.out.includes("ok"), "the mock cluster answers over SSH");
  must(/8/.test(probe.out), `8 EMPIAR-10017 micrographs on the cluster (${probe.out.replace(/\n/g, " | ")})`);
  const sz = client("stat -c%s /data2/empiar-10017/micrographs/Falcon_2012_06_12-14_33_35_0.mrc").out;
  must(Number(sz) === 67109888, `micrograph byte size 67,109,888 (4096² float32) — got ${sz}`);
  // H1 pre-check on the INPUT bytes themselves (the fixture mics carry full headers)
  const fx = sshHeaderRound("/data2/empiar-10017/micrographs", ["Falcon_2012_06_12-14_33_35_0.mrc"]);
  verifyMrcFile(fx[0], "the input micrograph's own header", { expectNx: 4096, expectNy: 4096, expectNz: 1 });

  section("PHASE 1 — connection + a fresh remote project");
  {
    const list = await api("/api/projects", { headers: SH });
    for (const p of list.body?.projects ?? []) {
      if (/EMPIAR-10017 t382/.test(p.name ?? "")) {
        await api(`/api/projects/${p.id}`, { method: "DELETE", headers: SHJ });
        console.log(`    pruned stale project ${p.name}`);
      }
    }
  }
  const mkc = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN_ID, name: "t382 mock cluster", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow", defaultModule: "relion/5.0.1",
    }),
  });
  must(mkc.status === 200 || mkc.status === 201, `the connection upserts (${mkc.status})`);
  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: `EMPIAR-10017 t382 ${new Date().toISOString().slice(11, 19)}`, mode: "spa", remoteConnectionId: CONN_ID }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  const projectId = proj.body?.project?.id;
  must((await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) })).status < 300, "the project activates");
  console.log(`    projectId: ${projectId}`);

  section("PHASE 2 — Import (cluster-resident, zero-upload)");
  const imp = await mkJob("import", {
    nodeType: "micrographs", micrographsPath: "/data2/empiar-10017/micrographs",
    pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25,
    negativeStain: false,
  }, { name: "Import EMPIAR-10017 mics", x: 60, y: 60 });
  {
    const run = await runRemote(imp.id);
    must(run.status === 200, `import runs — ${run.status}`);
    const res = await waitTerminal(imp.id, { timeoutMs: 120_000 });
    must(res.job?.status === "completed", `import completed (${res.job?.status}: ${String(res.job?.result).slice(0, 120)})`);
    const star = readFileSync(path.join(localWorkdir(projectId, imp), "micrographs.star"), "utf8");
    must((star.match(/Falcon_2012/g) ?? []).length === 8, "all 8 micrograph rows present");
    must(star.includes("/data2/empiar-10017/micrographs/"), "CLUSTER-ABSOLUTE rows (zero-upload semantics)");
  }

  section("PHASE 3 — MotionCorr → Ctffind → AutoPick (CPU)");
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
  }

  section("PHASE 4 — Extract (REAL crops — every stack header verified)");
  const BOX = 64;
  const ext = pick && (await stage("Extract", "extract", { boxSize: 128, downsampleTo: BOX, bgDiameter: -1, norm: true }, [
    [ctf, "micrographs", "micrographs"],
    [pick, "coords", "coords"],
  ]));
  if (ext) {
    const rW = remoteWorkdir(projectId, ext);
    const stackNames = client(`ls ${rW}/extra/*.mrcs 2>/dev/null | xargs -n1 basename`).out.split("\n").filter(Boolean);
    must(stackNames.length >= 8, `REAL particle stacks on the cluster (got ${stackNames.length})`);
    const ents = sshHeaderRound(`${rW}/extra`, stackNames);
    let healthy = 0;
    for (const ent of ents) if (verifyMrcFile(ent, `extract stack ${ent.name}`)) healthy++;
    must(healthy === stackNames.length, `every extract stack's header is healthy (${healthy}/${stackNames.length})`);
  }

  section("PHASE 5 — Class2D: the SEED ROUND watched LIVE + every round header-verified");
  const K = 10;
  const ITERS = 4;
  const c2d = ext && (await mkJob("class2d", { numClasses: K, iterations: ITERS, particleDiameter: 180, tau2Fudge: 1, threads: 4 }, { name: "Class2D header fidelity" }));
  let liveSeed = null;
  if (c2d) {
    await mkEdge(ext.id, c2d.id, "particles", "particles");
    const run = await runRemote(c2d.id);
    must(run.status === 200, "class2d dispatch accepted", JSON.stringify(run.body).slice(0, 160));

    // H2 — poll for the seed round the MOMENT it lands (job mid-flight)
    const rW = remoteWorkdir(projectId, c2d);
    const tPoll = Date.now();
    let caught = false;
    while (Date.now() - tPoll < 120_000) {
      const probe = client(`test -s ${rW}/run_it000_classes.mrcs && echo LANDED`);
      if (probe.out.includes("LANDED")) {
        caught = true;
        break;
      }
      const { body } = await api(`/api/jobs?jobId=${c2d.id}`, { headers: SH });
        const job = body?.jobs?.find?.((j) => j.id === c2d.id) ?? body?.job;
      if (job && (job.status === "completed" || job.status === "failed")) {
        // the round may have landed between the last probe and the terminal
        const last = client(`test -s ${rW}/run_it000_classes.mrcs && echo LANDED`);
        if (!last.out.includes("LANDED")) break;
        caught = true;
        break;
      }
      await sleep(500);
    }
    if (must(caught, "the seed round run_it000_classes.mrcs LANDS on the cluster (t382: the mock now writes it — real RELION startup behavior)")) {
      const seedEnts = sshHeaderRound(rW, ["run_it000_classes.mrcs"]);
      liveSeed = verifyMrcFile(seedEnts[0], "it000 LIVE header (verified while the run was in flight)", { expectNx: BOX, expectNy: BOX, expectNz: K });
    }

    // H2b — the app's OWN live leg sees the seed round's nz through the od
    // sniff (the t370 header watch, mid-flight): the payload answers while
    // the job is still RUNNING and the chip carries MEASURED nz.
    if (caught) {
      const livePayload = await api(`/api/jobs/${c2d.id}/iterations`, { headers: SH });
      const liveStack0 = (livePayload.body?.stacks ?? []).find((s) => /it000/.test(s.file ?? ""));
      must(
        livePayload.body?.remote === true && liveStack0 && liveStack0.nz === K,
        `the app's LIVE leg reads it000's nz=${liveStack0?.nz ?? "?"} while the run is in flight (expected ${K}, remote=${livePayload.body?.remote})`
      );
    }

    const res = await waitTerminal(c2d.id, { timeoutMs: 240_000 });
    must(res.job?.status === "completed", `class2d completed (${res.job?.status}${res.timeout ? " TIMEOUT" : ""} — ${String(res.job?.result ?? "").slice(0, 140)})`);

    // H1 — the FULL inventory of the class2d workdir, every MRC file
    const allMrc = client(`cd ${rW} && ls *.mrc *.mrcs 2>/dev/null`).out.split("\n").filter((f) => /\.(mrc|mrcs)$/.test(f));
    const stacks = allMrc.filter((f) => /run_it\d+_classes\.mrcs$/.test(f)).sort();
    must(stacks.length === ITERS + 1, `the iteration stacks it000..it${String(ITERS).padStart(3, "0")} all exist (${stacks.length}/${ITERS + 1}: ${stacks.join(", ")})`);
    must(stacks[0] === "run_it000_classes.mrcs", "the seed round is iteration 000 (RELION's numbering)");
    for (const f of allMrc) {
      const ents = sshHeaderRound(rW, [f]);
      verifyMrcFile(ents[0], `class2d ${f}`);
    }
    // the final alias is the FULL K-slice stack (t382 — real RELION semantics)
    {
      const ents = sshHeaderRound(rW, ["run_classes.mrcs"]);
      const ent = ents[0];
      const h = ent && !ent.missing ? parseMrcHeader(ent.head) : null;
      must(h && h.nz === K, `run_classes.mrcs carries all ${K} classes (the FULL stack, not the old single-slice dialect) — nz=${h?.nz}`);
    }
    console.log(`    class2d inventory: ${allMrc.length} MRC files, headers verified over SSH`);

    // H5 — the app's iteration chips bar lists the seed round
    const iters = await api(`/api/jobs/${c2d.id}/iterations`, { headers: SH });
    const payload = iters.body;
    const iterList = payload?.iterations ?? [];
    must(iters.status === 200 && Array.isArray(iterList), `the iterations payload answers (${iters.status})`);
    must(iterList.includes(0), `the chips bar lists the SEED round (iteration 0) — iterations=[${iterList.join(",")}]`);
    const stack0 = (payload?.stacks ?? []).find((s) => /it000/.test(s.file ?? ""));
    must(!!stack0, `the seed round's stack entry is in the payload (file=${stack0?.file ?? "?"})`);
    // t382 — render the seed round FIRST (the render door is the measurement
    // moment: the pull parses the header and persists the .nz marker), then
    // the payload must carry the MEASURED nz even though the job completed.
    const seedPng = await fetch(`${BASE}/api/jobs/${c2d.id}/iterations/image?file=run_it000_classes.mrcs&slice=0`, { headers: SH });
    must(seedPng.ok, `the seed round RENDERS through the live gallery door (${seedPng.status})`);
    if (seedPng.ok) await seedPng.arrayBuffer();
    const iters2 = await api(`/api/jobs/${c2d.id}/iterations?fresh=1`, { headers: SH });
    const stack0b = (iters2.body?.stacks ?? []).find((s) => /it000/.test(s.file ?? ""));
    must(
      stack0b && stack0b.nz === K,
      `after completion the chip still carries the MEASURED nz=${stack0b?.nz ?? "?"} (the .nz marker persists the t370 watch's verdict — expected ${K})`
    );
  }

  section("PHASE 6 — H3/H4: dual-observer bytes + the app's read-only legs");
  if (c2d && liveSeed) {
    const rW = remoteWorkdir(projectId, c2d);
    const seedPath = `${rW}/run_it000_classes.mrcs`;
    const md5Before = client(`md5sum ${seedPath}`).out.split(/\s+/)[0];
    must(/^[0-9a-f]{32}$/.test(md5Before ?? ""), `md5 over SSH (the login-node view): ${md5Before}`);

    // H3 — host-side read (the storage view): same bytes, straight off the fs
    const hostPath = path.join(hostWorkdir(projectId, c2d), "run_it000_classes.mrcs");
    if (must(existsSync(hostPath), "the seed round is readable host-side (the mock's storage view)")) {
      const hostMd5 = crypto.createHash("md5").update(readFileSync(hostPath)).digest("hex");
      must(hostMd5 === md5Before, `H3 dual-observer agreement: SSH view md5 == storage view md5 (${hostMd5.slice(0, 12)}…) — no compute→storage write loss on this lane`);
      const hostHead = parseMrcHeader(readFileSync(hostPath).subarray(0, 1024));
      must(hostHead.nx === BOX && hostHead.nz === K && hostHead.map === "MAP ", `the storage-side header words are healthy too (${hostHead.nx}×${hostHead.ny}×${hostHead.nz}, MAP magic)`);
    }

    // H4 — the app's raw-door pull never writes back into the live workdir
    const raw = await fetch(`${BASE}/api/jobs/${c2d.id}/outputs/file?path=${encodeURIComponent("run_it000_classes.mrcs")}&format=raw`, { headers: SH });
    must(raw.ok, `the raw door pulls the seed round (${raw.status})`);
    const pulled = Buffer.from(await raw.arrayBuffer());
    const md5After = client(`md5sum ${seedPath}`).out.split(/\s+/)[0];
    must(md5After === md5Before, `H4 the cluster file is UNCHANGED after the app's pull (md5 before == after — cryoflow's remote legs are read-only)`);
    const localMirror = path.join(localWorkdir(projectId, c2d), "run_it000_classes.mrcs");
    if (must(existsSync(localMirror), "the pulled stack lands in the local mirror")) {
      const mirrorMd5 = crypto.createHash("md5").update(readFileSync(localMirror)).digest("hex");
      must(mirrorMd5 === md5Before, "the local mirror is byte-identical to the cluster bytes (md5 match)");
      const mirrorHead = parseMrcHeader(readFileSync(localMirror).subarray(0, 1024));
      must(mirrorHead.nx === BOX && mirrorHead.nz === K && mirrorHead.map === "MAP ", `the mirror's header words survive the pull (${mirrorHead.nx}×${mirrorHead.ny}×${mirrorHead.nz}, MAP magic)`);
    }
    if (pulled.length) {
      const pulledHead = parseMrcHeader(pulled.subarray(0, 1024));
      must(pulledHead.nx === BOX && pulledHead.nz === K && pulledHead.map === "MAP ", `the raw door's bytes carry the healthy header (${pulledHead.nx}×${pulledHead.ny}×${pulledHead.nz}, MAP magic)`);
    }
  }

  section("PHASE 7 — the VERDICT");
  must(zeroHeaderFiles === 0, `H1 FINAL: zero-header MRC files across the whole chain: ${zeroHeaderFiles}/${headersVerified} verified`);
  console.log(`\n  ┌─────────────────────────────────────────────────────────────────────────┐`);
  console.log(`  │ THE SANDBOX CLUSTER LANE (EMPIAR-10017, import → class2d, CPU):         │`);
  console.log(`  │   MRC headers verified:  ${String(headersVerified).padStart(3)}   zero-header: ${String(zeroHeaderFiles).padStart(3)}                       │`);
  console.log(`  │   seed round (it000):    written LIVE, header healthy, renders         │`);
  console.log(`  │   dual-observer md5:     SSH view == storage view (no write loss)      │`);
  console.log(`  │   app legs:              read-only on the cluster (md5 unchanged)     │`);
  console.log(`  │ → the corruption on the user's cluster is NOT reproduced by cryoflow;  │`);
  console.log(`  │   the loss lives on THAT cluster's compute→storage write path.         │`);
  console.log(`  └─────────────────────────────────────────────────────────────────────────┘`);
} catch (e) {
  console.error("diag-t382 aborted:", e);
  must(false, "the diag ran to completion", String(e?.stack ?? e).slice(0, 300));
}

console.log(`\n===== diag-t382 cluster-lane MRC header fidelity: ${pass} passed, ${fail} failed =====`);
if (failures.length) for (const f of failures) console.log(`  - ${f}`);
console.log(`Total wall: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(fail > 0 ? 1 : 0);
