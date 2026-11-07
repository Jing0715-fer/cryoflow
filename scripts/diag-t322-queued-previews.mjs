#!/usr/bin/env node
/**
 * t322 diag — two receipts from the real cluster, one honest word each.
 *
 * TICKET 1 (the status badge): the user watched Auto-picking 1 (Slurm
 * 124590, 6 GPU) sit in the QUEUE — the inspector's detail line already
 * said "queued · waits on 124589" — while the CARD BADGE said "Running"
 * and a timer ticked 4m14s. The backend has spoken the scheduler's own
 * word since t297 (runRemote.slurmState, live-patched by the sweep from
 * squeue's %T) — every STATUS SURFACE just ignored it. The fix: ONE
 * shared predicate (isSlurmQueued — status running + mode slurm +
 * slurmState PENDING) driving every surface: the card badge (amber
 * "queued", never teal "running"), the card's row 3 (the queue wait
 * speaks, no 0% bar, no ETA), the hover peek ("Xm in queue", never a
 * %-claim), the panel (the scheduler's words replace the progress bar),
 * the dashboard roster, the inspector timeline ("Queued"/"—", amber
 * "wait" tone) and its result summary ("Waiting in the Slurm queue",
 * with the upstream ids). The DB status stays "running" — the sweep's
 * honest ladder owns the lifecycle; only the RENDERING tells the
 * scheduler's truth.
 *
 * TICKET 2 (the slow gallery): every import-gallery visit re-rolled the
 * random five, so five FRESH cluster paths each time meant the PNG cache
 * never hit and five WHOLE .mrc files crossed SSH every visit (the
 * user's "每次重新读取"). The fix is the DECIMATION LADDER + the stable
 * sample: python3 (pure stdlib) thins both axes ON THE CLUSTER (~0.5 MB
 * travels for a 64 MB micrograph, the user's "在集群上先压缩再传回本
 * 地"), GNU dd strided rows as the no-python fallback, the whole-file
 * pull (FETCH_CAP + its teaching refusal) as the last resort; the sample
 * is DETERMINISTIC per job (seeded by job id + reroll counter, persisted
 * client-side), the preview responses carry Cache-Control so the browser
 * stops re-asking, and the tier headers (X-CF-Preview-Tier/-Bytes) speak
 * the wire bill.
 *
 * PHASES:
 *  A. UNIT — the ladder's builders and parser (heredoc/sentinel grammar,
 *     od/dd dialect, banner-noise immunity, truncation refusal); the
 *     parse truth table against crafted stdout.
 *  B. LIVE Q — the user's exact receipt shape: import (done) →
 *     motioncorr (RUNNING on slurm) → ctffind dispatched while the
 *     parent is live rides --dependency=afterok and sits PENDING; the
 *     DTO says running+PENDING+waits-on while the parent says RUNNING,
 *     progress stays 0 (no fake bar), then the child flips RUNNING and
 *     completes HONESTLY.
 *  C. LIVE P — the preview ladder on real-pixel fixtures: the
 *     deterministic sample (same five twice, a different five on
 *     reroll), the big 64 MB micrograph previewing at python tier with
 *     ~100× less wire, the second hit served from the persistent cache
 *     (byte-identical), the large view its own slot, the 8-frame stack
 *     previewing via ONE frame, the intruder path still 404.
 *  D. LEDGER — every source contract pinned (the six queued surfaces,
 *     the hover peek's queue dialect, the route's seed + cache headers,
 *     the ladder order + caps, the gallery's persisted reroll).
 */

import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const CONN = "qa-t322";
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
async function pollUntil(fn, deadlineMs, intervalMs = 1000) {
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
    timeout: 90_000,
  }).stdout?.trim() ?? "";
const clientBoth = (cmd) => {
  const r = spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 90_000,
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
    sock.once("error", () => done(false));
    sock.once("timeout", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

/** raw fetch — PNG bodies + headers (the preview door speaks bytes). */
const rawApi = async (url) => {
  const r = await fetch(`${BASE}${url}`, { headers: { ...SH, Accept: "image/png,*/*" } });
  return {
    status: r.status,
    headers: r.headers,
    buf: Buffer.from(await r.arrayBuffer()),
  };
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

const dispatch = (id, body) =>
  api(`/api/jobs/${id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify(body) });

const awaitJobTerminal = async (id, deadlineMs) => {
  const done = await pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);
  return done;
};

/** bun unit leg — import the TS ladder module directly. */
const unit = (prog) => {
  const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 300)}`;
  return r.stdout?.trim() ?? "";
};

const readSrc = (p) =>
  spawnSync("cat", [path.join(ROOT, p)], { encoding: "utf8" }).stdout ?? "";

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the dev server answers on :3000");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t322",
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
    body: JSON.stringify({ name: "QA t322 queued previews", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");
  const projRoot = `/projects/cryoflow/${projectId}`;

  // ======================================================================
  console.log("== PHASE A: UNIT — the ladder's builders and parser ==");

  const ladderUnit = unit(`
    const P = await import(${JSON.stringify(path.join(ROOT, "src/lib/remote/preview.ts"))});
    const py = P.buildPythonDecimateCmd("/data2/mic.mrc", 384, "mid");
    const dd = P.buildDdDecimateCmd("/data2/mic.mrc", 384, "mid");
    const out = [];
    out.push("pyHeredoc=" + /python3 - \\/data2\\/mic.mrc 384 mid <<'CFDPY'/.test(py));
    out.push("pyNoNumpy=" + !/numpy/.test(py));
    out.push("pySentinel=" + /CFD\\|PY\\|%d\\|%d\\|%d\\|%d\\|%d\\|%d\\|%d/.test(py));
    out.push("pyErrGrammar=" + /CFD\\|ERR\\|/.test(py));
    out.push("pyMidSel=" + (/sel == 'mid'/.test(py) && /nz \\/\\/ 2/.test(py)));
    out.push("ddOdHeader=" + /od -An -tu4 -j92 -N4/.test(dd));
    out.push("ddStride=" + (/iflag=skip_bytes,count_bytes/.test(dd) && /dd if=/.test(dd)));
    out.push("ddCap=" + /too-big/.test(dd));
    // the parser's truth table on crafted stdout
    const px = P.parseDecimateResponse;
    const mkPy = (w,h,bpp,fill=true) => {
      const n = w*h*bpp;
      const body = Buffer.alloc(fill ? n : Math.floor(n/2), 65).toString("base64");
      return "noise line\\nCFD|PY|4096|4096|1|2|" + w + "|" + h + "|" + bpp + "\\n" + body + "\\nlogout noise";
    };
    out.push("parsePyOk=" + (px(mkPy(4,4,4))?.tier === "python"));
    out.push("parsePyDims=" + (px(mkPy(4,4,4))?.grid.width === 4 && px(mkPy(4,4,4))?.grid.height === 4));
    out.push("parsePyShort=" + (px(mkPy(4,4,4,false)) === null));
    out.push("parseErr=" + (px("CFD|ERR|bad-header") === null));
    out.push("parseNoSentinel=" + (px("just noise") === null));
    out.push("parseDdOk=" + (px("CFD|DD|1024|1024|1|2|16|4096\\n" + Buffer.alloc(16*4096, 66).toString("base64"))?.tier === "dd"));
    out.push("parseDdFullWidth=" + (px("CFD|DD|1024|1024|1|2|16|4096\\n" + Buffer.alloc(16*4096, 66).toString("base64"))?.grid.width === 1024));
    out.push("parseDdShort=" + (px("CFD|DD|1024|1024|1|2|16|4096\\nQUJD") === null));
    console.log(out.join("\\n"));
  `);
  const A = Object.fromEntries(
    ladderUnit
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
  must(ladderUnit.startsWith("pyHeredoc=") || /UNIT-ERROR/.test(ladderUnit), `the unit leg ran (${ladderUnit.slice(0, 80)})`);
  must(A.pyHeredoc === "true", "the python tier lands as a heredoc script (the SSH exec dialect)");
  must(A.pyNoNumpy === "true", "the python tier is PURE STDLIB (no numpy demand on a login node)");
  must(A.pySentinel === "true" && A.pyErrGrammar === "true", "the sentinel grammar is CFD|PY|…/CFD|ERR|…");
  must(A.pyMidSel === "true", "thumb selects the MID slice (sel == 'mid')");
  must(A.ddOdHeader === "true", "the dd tier reads the header with od (nsymbt at offset 92)");
  must(A.ddStride === "true", "the dd tier strides with GNU dd iflag=skip_bytes,count_bytes");
  must(A.ddCap === "true", "the dd tier refuses pathological widths (too-big → next tier)");
  must(A.parsePyOk === "true" && A.parsePyDims === "true", "the parser decodes a well-formed PY payload (tier + grid dims)");
  must(A.parsePyShort === "true", "a TRUNCATED payload refuses (null → next tier, never a half image)");
  must(A.parseErr === "true" && A.parseNoSentinel === "true", "ERR and sentinel-free stdout both refuse");
  must(
    A.parseDdOk === "true" && A.parseDdFullWidth === "true" && A.parseDdShort === "true",
    "the DD payload parses as FULL-width rows (columns thin at render), short refuses"
  );

  // ======================================================================
  console.log("== PHASE B: LIVE Q — the user's receipt: queued child, running parent ==");

  // 32 header-only single-section micrographs (the dispatch stubs read the
  // star rows; headers carry NZ=1 for the CTF byte gate)
  const mrcHdr = (() => {
    const b = Buffer.alloc(64);
    b.writeInt32LE(4096, 0);
    b.writeInt32LE(4096, 4);
    b.writeInt32LE(1, 8);
    b.writeInt32LE(2, 12);
    return b.toString("base64");
  })();
  const fxQ = clientBoth(
    "mkdir -p /data2/t322-q; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t322-mic.mrc; ` +
      "for i in $(seq 1 32); do cp /tmp/.t322-mic.mrc /data2/t322-q/mic_$(printf %02d $i).mrc; done"
  );
  must(fxQ === "", `the 32 queue fixtures build quietly (${fxQ.slice(0, 100)})`);

  const importQ = await mkJob({
    projectId,
    type: "import",
    name: "QA t322 import Q",
    params: {
      micrographsPath: Array.from({ length: 32 }, (_, i) => `/data2/t322-q/mic_${String(i + 1).padStart(2, "0")}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!importQ?.id, "the import job creates");
  const runImportQ = await api(`/api/jobs/${importQ.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runImportQ.status >= 200 && runImportQ.status < 300, `the import run accepts (${runImportQ.status})`);
  const doneImportQ = await awaitJobTerminal(importQ.id, 90_000);
  must(doneImportQ?.status === "completed", `the import completes (${doneImportQ?.status}: ${String(doneImportQ?.result ?? "").slice(0, 80)})`);

  // the parent: motioncorr on slurm (32 mics × 1s = a ~32s live window)
  const mcJob = await mkJob({
    projectId,
    type: "motioncorr",
    name: "QA t322 motioncorr",
    params: { patchX: 5, patchY: 5 },
  });
  must(!!mcJob?.id, "the motioncorr job creates");
  const edgeMC = await mkEdge(importQ.id, mcJob.id, "micrographs", "movies");
  must(edgeMC === 200 || edgeMC === 201, `the edge wires import → motioncorr (${edgeMC})`);
  const dispMC = await dispatch(mcJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
  });
  must(dispMC.status >= 200 && dispMC.status < 300 && !dispMC.body?.error, `the motioncorr dispatch accepts (${dispMC.status} ${String(dispMC.body?.error ?? "").slice(0, 80)})`);

  // wait until the sweep's own word says the parent is RUNNING (the mock
  // holds it PENDING ~1s — the sweep must see PENDING→RUNNING live)
  const mcRunning = await pollUntil(async () => {
    const j = await jobById(mcJob.id);
    return j?.runRemote?.slurmState === "RUNNING" ? j : null;
  }, 30_000);
  must(!!mcRunning, "the parent's slurmState reaches RUNNING (the sweep's live word)");
  const mcSlurmId = mcRunning?.runRemote?.slurmId;
  must(mcSlurmId != null, `the parent's slurmId rides the DTO (${mcSlurmId})`);

  // the child: ctffind, dispatched WHILE the parent is live — the edge
  // motioncorr → ctffind makes the parent a dependency; the input itself
  // resolves from the DONE import (BFS past the running parent)
  const ctfJob = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t322 ctffind",
    params: {},
  });
  must(!!ctfJob?.id, "the ctffind job creates");
  const edgeCtf = await mkEdge(mcJob.id, ctfJob.id, "micrographs", "micrographs");
  must(edgeCtf === 200 || edgeCtf === 201, `the edge wires motioncorr → ctffind (${edgeCtf})`);
  const dispCtf = await dispatch(ctfJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 },
  });
  must(
    dispCtf.status >= 200 && dispCtf.status < 300 && !dispCtf.body?.error,
    `the ctffind dispatch accepts WHILE the parent runs (${dispCtf.status} ${String(dispCtf.body?.error ?? "").slice(0, 90)})`
  );

  // the sbatch script carries the scheduler handoff
  // the DTO remoteWorkdir is the truth — never guess the layout
  const ctfDto0 = await jobById(ctfJob.id);
  const ctfWorkdir = ctfDto0?.runRemote?.remoteWorkdir;
  must(!!ctfWorkdir, `the queued DTO carries its remoteWorkdir (${ctfWorkdir})`);
  // a transient exec-channel hiccup must not fail the suite — the script
  // IS on disk (sbatch ran from it); retry the read a few times
  let sbatchCtf = "";
  for (let i = 0; i < 4 && sbatchCtf.length === 0; i++) {
    sbatchCtf = client(`cat ${ctfWorkdir}/.cf-sbatch.sh 2>/dev/null`);
    if (sbatchCtf.length === 0) await sleep(1200);
  }
  must(sbatchCtf.length > 0, "the ctffind sbatch script is on disk (.cf-sbatch.sh)");
  must(
    new RegExp(`--dependency=afterok:${mcSlurmId}`).test(sbatchCtf),
    `the script carries #SBATCH --dependency=afterok:${mcSlurmId} (the pipeline handoff)`
  );
  must(/--kill-on-invalid-dep=yes/.test(sbatchCtf), "the script carries --kill-on-invalid-dep=yes (no stranded PENDING)");

  // THE RECEIPT SHAPE — one poll seeing both truths at once:
  // child queued (running+PENDING+waits-on, progress 0) while parent runs
  const receipt = await pollUntil(async () => {
    const ctf = await jobById(ctfJob.id);
    if (!ctf || ctf.status !== "running") return null;
    if (ctf.runRemote?.slurmState !== "PENDING") return null;
    if (!ctf.runRemote?.slurmDependsOn?.includes(String(mcSlurmId))) return null;
    if (ctf.progress !== 0) return null;
    return ctf;
  }, 30_000);
  must(!!receipt, "the CHILD's DTO speaks the queue honestly: running + slurmState PENDING + waits on the parent + progress 0");
  const parentSameMoment = await jobById(mcJob.id);
  must(
    parentSameMoment?.runRemote?.slurmState === "RUNNING",
    "in the SAME window the PARENT's DTO says RUNNING (two jobs, two honest words)"
  );
  must(
    receipt?.runRemote?.mode === "slurm" && receipt?.runRemote?.slurmId != null,
    "the queued DTO carries mode slurm + its own slurmId (the UI predicate's full shape)"
  );

  // the RECENT-ACTIVITY FEED carries the queue signal too (t322: the feed
  // used to badge a queued slurm run "Running" over a 0% shimmer bar — the
  // slim runRemote now rides the wire and the feed speaks "Queued")
  const feed = await api("/api/activity/recent?limit=8", { headers: SH });
  const feedRow = (feed.body?.jobs ?? []).find((x) => x.id === ctfJob.id);
  must(
    feedRow?.runRemote?.mode === "slurm" && feedRow?.runRemote?.slurmState === "PENDING",
    "the recent-activity feed row speaks the queue (slim runRemote: slurm + PENDING)"
  );

  // the parent lands → the child wakes: PENDING → RUNNING → completed
  const doneMC = await awaitJobTerminal(mcJob.id, 90_000);
  must(doneMC?.status === "completed", `the parent motioncorr completes (${doneMC?.status}: ${String(doneMC?.result ?? "").slice(0, 80)})`);

  const ctfAwake = await pollUntil(async () => {
    const j = await jobById(ctfJob.id);
    return j?.runRemote?.slurmState === "RUNNING" ? j : null;
  }, 40_000);
  must(!!ctfAwake, "after the parent lands, the child's slurmState flips to RUNNING (the sweep watches the wake-up)");

  const doneCtf = await awaitJobTerminal(ctfJob.id, 150_000);
  must(
    doneCtf?.status === "completed",
    `the queued child completes HONESTLY after its turn (${doneCtf?.status}: ${String(doneCtf?.result ?? "").slice(0, 90)})`
  );
  must(
    /CTF/i.test(String(doneCtf?.result ?? "")),
    "the child's receipt speaks CTF (the run was real, the queue was just the wait)"
  );

  // ======================================================================
  console.log("== PHASE C: LIVE P — the decimation ladder on real pixels ==");

  // real-pixel fixtures, generated ON the cluster (no fixture ever crosses
  // SSH twice): 12 × 1024², one 4096² (64 MB), one 1024²×8 frame stack
  const fxScript = `python3 - <<'CFX'
import struct, os
os.makedirs('/data2/t322-prev', exist_ok=True)
def mkrow(nx):
    b = bytearray()
    for x in range(nx):
        v = ((x * 7) % 251) * 0.5 - 60.0 + (900.0 if x % 17 == 0 else 0.0)
        b += struct.pack('<f', v)
    return bytes(b)
def w(file, nx, ny, nz):
    base = mkrow(nx)
    with open(file, 'wb') as f:
        f.write(struct.pack('<4i', nx, ny, nz, 2))
        f.seek(28); f.write(struct.pack('<3i', nx, ny, nz))
        f.seek(92); f.write(struct.pack('<i', 0))
        f.seek(1024)
        for z in range(nz):
            for y in range(ny):
                s = (y * 7 + z * 13) % nx
                f.write(base[s:] + base[:s])
for i in range(12):
    w('/data2/t322-prev/mic_%02d.mrc' % (i + 1), 1024, 1024, 1)
w('/data2/t322-prev/mic_big.mrc', 4096, 4096, 1)
w('/data2/t322-prev/movie_01.mrc', 1024, 1024, 8)
print('fixtures ok')
CFX`;
  const fxP = clientBoth(fxScript);
  must(/fixtures ok/.test(fxP), `the real-pixel fixtures build on the cluster (${fxP.slice(0, 100)})`);

  const prevFiles = [
    ...Array.from({ length: 12 }, (_, i) => `/data2/t322-prev/mic_${String(i + 1).padStart(2, "0")}.mrc`),
    "/data2/t322-prev/mic_big.mrc",
    "/data2/t322-prev/movie_01.mrc",
  ];
  const importP = await mkJob({
    projectId,
    type: "import",
    name: "QA t322 import P",
    params: {
      micrographsPath: prevFiles.join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!importP?.id, "the preview import job creates");
  const runImportP = await api(`/api/jobs/${importP.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runImportP.status >= 200 && runImportP.status < 300, `the preview import accepts (${runImportP.status})`);
  const doneImportP = await awaitJobTerminal(importP.id, 120_000);
  must(doneImportP?.status === "completed", `the preview import completes (${doneImportP?.status}: ${String(doneImportP?.result ?? "").slice(0, 80)})`);

  const manifest = async (qs) =>
    (await api(`/api/jobs/${importP.id}/micrographs${qs ?? ""}`, { headers: SH })).body;
  const m1 = await manifest();
  const m2 = await manifest();
  must(!!m1?.cluster, "the manifest carries the cluster block (rows live on the mock)");
  must(m1?.total === 14, `the manifest counts all 14 rows (${m1?.total})`);
  const paths1 = (m1?.micrographs ?? []).map((x) => x.path);
  const paths2 = (m2?.micrographs ?? []).map((x) => x.path);
  must(
    paths1.length === 5 && JSON.stringify(paths1) === JSON.stringify(paths2),
    "the sample of five is DETERMINISTIC across visits (the cache finally engages)"
  );
  must(
    paths1.every((p) => prevFiles.includes(p)),
    "every sampled path is a row of this job's own star"
  );
  const m1r1 = await manifest("?reroll=1");
  const pathsR1 = (m1r1?.micrographs ?? []).map((x) => x.path);
  must(
    pathsR1.length === 5 && JSON.stringify(pathsR1) !== JSON.stringify(paths1),
    "reroll=1 samples a DIFFERENT five (the re-sample button's generation)"
  );
  const m1r1b = await manifest("?reroll=1");
  must(
    JSON.stringify((m1r1b?.micrographs ?? []).map((x) => x.path)) === JSON.stringify(pathsR1),
    "the rerolled sample is stable too (deterministic per generation)"
  );

  // the BIG micrograph: 64 MB on the cluster, ~0.5 MB over the wire
  const bigPath = "/data2/t322-prev/mic_big.mrc";
  const bigStat = client(`stat -c %s ${bigPath}`);
  const bigSize = Number(bigStat);
  must(bigSize === 4096 * 4096 * 4 + 1024, `the big fixture is 64 MB on disk (${bigSize})`);
  const prevBig = await rawApi(
    `/api/jobs/${importP.id}/micrographs?preview=${encodeURIComponent(bigPath)}`
  );
  must(prevBig.status === 200, `the big micrograph previews (${prevBig.status})`);
  must(prevBig.buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "the body is a real PNG (magic bytes)");
  must(
    prevBig.headers.get("x-cf-preview-tier") === "python",
    `the ladder's top tier served it (${prevBig.headers.get("x-cf-preview-tier")})`
  );
  const wireBig = Number(prevBig.headers.get("x-cf-preview-bytes") ?? "0");
  must(
    wireBig > 100_000 && wireBig < 1_500_000,
    `the wire bill is the THINNED payload, not the file (${wireBig} bytes for a ${bigSize}-byte file)`
  );
  must(
    wireBig * 20 < bigSize,
    `≥20× less than the whole-file pull the old door paid every visit (got ${Math.round(bigSize / Math.max(1, wireBig))}×)`
  );
  must(
    /public, max-age=86400/.test(prevBig.headers.get("cache-control") ?? ""),
    "the preview response carries Cache-Control (the browser stops re-asking)"
  );

  // the SECOND visit: the persistent cache serves byte-identical bytes
  const prevBig2 = await rawApi(
    `/api/jobs/${importP.id}/micrographs?preview=${encodeURIComponent(bigPath)}`
  );
  must(prevBig2.status === 200, `the second visit answers (${prevBig2.status})`);
  must(
    prevBig2.headers.get("x-cf-preview-tier") === "cache",
    `the second visit is served from the PERSISTENT cache (${prevBig2.headers.get("x-cf-preview-tier")})`
  );
  must(
    prevBig2.buf.equals(prevBig.buf),
    "the cached PNG is byte-identical (no re-render, no re-pull)"
  );

  // the large view: its own scale slot (768), its own cache entry
  const prevBigL = await rawApi(
    `/api/jobs/${importP.id}/micrographs?preview=${encodeURIComponent(bigPath)}&full=1`
  );
  must(prevBigL.status === 200, `the large view answers (${prevBigL.status})`);
  must(
    prevBigL.headers.get("x-cf-preview-tier") === "python" &&
      Number(prevBigL.headers.get("x-cf-preview-bytes") ?? "0") > wireBig,
    "the large view is its own tier-python render (bigger thin grid, its own slot)"
  );
  must(
    prevBigL.buf.length > prevBig.buf.length,
    `the large PNG is actually larger (${prevBigL.buf.length} vs ${prevBig.buf.length})`
  );

  // the FRAME STACK: one mid frame travels, not 32 MB of movie
  const stackPath = "/data2/t322-prev/movie_01.mrc";
  const prevStack = await rawApi(
    `/api/jobs/${importP.id}/micrographs?preview=${encodeURIComponent(stackPath)}`
  );
  must(prevStack.status === 200, `the 8-frame stack previews (${prevStack.status})`);
  must(
    prevStack.headers.get("x-cf-preview-tier") === "python" &&
      Number(prevStack.headers.get("x-cf-preview-bytes") ?? "0") < 1_500_000,
    "the stack preview transfers ONE frame's thin grid (the ladder seeks the mid slice)"
  );
  must(
    prevStack.buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "the stack preview is a real PNG"
  );

  // the intruder: a real file on the cluster that is NOT a row of this
  // star — the preview door stays shut for it (t315's gate, still armed)
  const intruder = "/data2/t322-q/mic_01.mrc";
  const prevIntr = await rawApi(
    `/api/jobs/${importP.id}/micrographs?preview=${encodeURIComponent(intruder)}`
  );
  must(prevIntr.status === 404, `an intruder path is refused (${prevIntr.status})`);

  // the on-disk cache holds the PNGs (kilobyte-scale, persistent)
  let cacheFiles = [];
  try {
    cacheFiles = readdirSync(path.join(ROOT, "data/remote-preview")).filter((f) => f.endsWith(".png"));
  } catch { /* no dir = no cache */ }
  must(cacheFiles.length >= 3, `the persistent cache holds the rendered PNGs (${cacheFiles.length} files)`);

  // ======================================================================
  console.log("== PHASE D: LEDGER — the source contracts ==");

  const cardSrc = readSrc("src/components/workflow/job-card.tsx");
  must(
    /export function isSlurmQueued/.test(cardSrc) &&
      /slurmState === "PENDING"/.test(cardSrc) &&
      /mode === "slurm"/.test(cardSrc),
    "isSlurmQueued is the ONE shared predicate (status running + slurm + PENDING)"
  );
  must(
    (cardSrc.match(/queued=\{isSlurmQueued\(job\)\}/g) ?? []).length >= 2,
    "the badge speaks the queue dialect on the card + the hover peek"
  );
  must(
    /queued \? "queued" : status/.test(cardSrc) && /STATUS_STYLES\.pending/.test(cardSrc),
    'a queued run WEARS the pending style and says "queued", never teal "running"'
  );
  must(
    /\$\{elapsedText\} in queue/.test(cardSrc) && /no fake progress|never a %-claim/is.test(cardSrc),
    "the hover peek's clock says IN QUEUE (the honest wait), never a %-claim"
  );
  must(
    /waits on \$\{job\.runRemote\.slurmDependsOn\.join/.test(cardSrc) &&
      /waiting for the scheduler/.test(cardSrc),
    "the card's row 3 speaks the upstream ids (or the scheduler's own wait)"
  );
  const panelSrc = readSrc("src/components/workflow/job-panel.tsx");
  must(
    /isSlurmQueued\(job\)/.test(panelSrc) && /Queued on the cluster/.test(panelSrc),
    "the panel replaces the progress bar with the scheduler's words for a queued run"
  );
  const dashSrc = readSrc("src/components/workflow/project-dashboard.tsx");
  must(/isSlurmQueued\(job\)/.test(dashSrc) && /queued · waits on/.test(dashSrc), "the dashboard roster speaks the queue dialect");
  const inspSrc = readSrc("src/components/workflow/job-inspector.tsx");
  must(
    /isSlurmQueued\(job\)/.test(inspSrc) && /Waiting in the Slurm queue/.test(inspSrc) && /"wait"/.test(inspSrc),
    "the inspector: Queued timeline step (wait tone) + the queue-wait result card"
  );
  const routeSrc = readSrc("src/app/api/jobs/[id]/micrographs/route.ts");
  must(
    /fnv1a|seededPick/.test(routeSrc) && /reroll/.test(routeSrc) && /Math\.random\(\)/.test(routeSrc) === false,
    "the manifest samples DETERMINISTICALLY (seeded, no Math.random() re-roll)"
  );
  must(
    /X-CF-Preview-Tier/.test(routeSrc) && /public, max-age=86400/.test(routeSrc),
    "the preview door speaks the tier + wire-bill headers and browser caching"
  );
  const previewSrc = readSrc("src/lib/remote/preview.ts");
  must(
    previewSrc.indexOf("buildPythonDecimateCmd") < previewSrc.indexOf("buildDdDecimateCmd") &&
      /remoteDecimatedFetch/.test(previewSrc),
    "the ladder runs python first, dd second (remoteDecimatedFetch)"
  );
  must(/DD_PAYLOAD_CAP/.test(previewSrc) && /FETCH_CAP/.test(previewSrc), "both tiers carry their own caps (dd payload + whole-file FETCH_CAP)");
  must(/tier: "cache"/.test(previewSrc) && /tier: dec\.tier/.test(previewSrc), "the result speaks which tier served (cache/python/dd/full)");
  const mrcSrc = readSrc("src/lib/mrc.ts");
  must(
    /decodeRawVoxels/.test(mrcSrc) && /renderDecimatedPng/.test(mrcSrc) && /decimateColumns/.test(mrcSrc),
    "mrc.ts decodes raw voxels + thins dd-tier columns with downsample()'s own step math"
  );
  const activitySrc = readSrc("src/app/api/activity/recent/route.ts");
  must(
    /remoteInfoFor/.test(activitySrc) && /slurmState/.test(activitySrc),
    "the recent-activity feed carries the queue signal too (slim runRemote: mode + slurmState)"
  );
  const dashFeed = readSrc("src/components/workflow/project-dashboard.tsx");
  must(
    (dashFeed.match(/queued=\{isSlurmQueued\(/g) ?? []).length >= 2,
    "BOTH dashboard surfaces speak the queue dialect (roster row + recent-activity feed)"
  );
  const gallerySrc = readSrc("src/components/workflow/results/import-gallery.tsx");
  must(
    /cryoflow:import-sample/.test(gallerySrc) && /localStorage\.setItem/.test(gallerySrc),
    "the gallery persists its reroll counter per job (the stable five survive reopens)"
  );

  console.log(fail === 0 ? "\n== t322 diag: ALL GREEN ==" : `\n== t322 diag: ${fail} FAIL ==`);
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
    client("rm -rf /data2/t322-q /data2/t322-prev /tmp/.t322-mic.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  try {
    // the preview PNG cache this run filled (it started empty)
    for (const f of readdirSync(path.join(ROOT, "data/remote-preview"))) {
      rmSync(path.join(ROOT, "data/remote-preview", f), { force: true });
    }
  } catch { /* nothing to clean */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);
