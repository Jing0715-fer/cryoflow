#!/usr/bin/env node
/**
 * t339 diag — 「extraction的mrcs也有一些放到本地了，是不是没有必要 …
 * 我希望本地的空间占用尽量小一些」
 *
 * The field report: a remote extraction finalized and HUNDREDS of per-mic
 * .mrcs stacks landed in the local mirror — each a few MB, every one under
 * the t289 key-file cap (16 MB default). Per-file judgment cannot see an
 * aggregate: 865 "small" files are GBs on the laptop, none of them
 * metadata. The fix: under the key-files policy the per-micrograph image
 * producers (BULK_TYPES — extract, motioncorr, polish) sync TEXT ONLY.
 *
 * PHASE A — UNIT: the pure planner (remote/sync-policy.ts) truth table.
 * PHASE B — LIVE (mock): the user's own pipeline shape, both policies,
 *   the lazy fetch door, the downstream chain, the local slimming lever.
 * PHASE C — CONTRACTS: the source ledger (lane order, the type threading,
 *   the exported grammar).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3000";
const CONN = "qa-t339";
const MODULE = "relion/5.0.1";
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
const awaitJobTerminal = async (id, deadlineMs) =>
  pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);

const stateFile = () => path.join(ROOT, "data/engine-state.json");
const readRecord = (jobId) => {
  try {
    return JSON.parse(readFileSync(stateFile(), "utf8"))[jobId] ?? null;
  } catch {
    return null;
  }
};

/** recursive local-mirror walk → { all: rel[], mrcs: rel[] } */
const walkMirror = (dir, rel = "") => {
  const out = { all: [], mrcs: [] };
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const childRel = rel ? `${rel}/${name}` : name;
    const abs = path.join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      const sub = walkMirror(abs, childRel);
      out.all.push(...sub.all);
      out.mrcs.push(...sub.mrcs);
    } else {
      out.all.push(childRel);
      if (/\.(mrcs?|map|hdf)$/i.test(name)) out.mrcs.push(childRel);
    }
  }
  return out;
};

const mrcHdr = (() => {
  const b = Buffer.alloc(64);
  b.writeInt32LE(1024, 0);
  b.writeInt32LE(1024, 4);
  b.writeInt32LE(1, 8);
  b.writeInt32LE(2, 12);
  return b.toString("base64");
})();

const src = (p) => readFileSync(path.join(ROOT, p), "utf8");

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the dev server answers on :3000");
  must(await mockListening(), "the mock cluster answers on :3022");

  // ======================================================================
  console.log("== PHASE A: UNIT — the pure planner truth table ==");

  const SP = "src/lib/remote/sync-policy.ts";
  const spSrc = src(SP);
  must(
    /^import \{ BULK_TYPES \} from "\.\.\/hpc\/cleanup";$/m.test(spSrc) &&
      (spSrc.match(/^import /gm) ?? []).length === 1,
    "sync-policy.ts is PURE except the one sibling import (the shared BULK_TYPES grammar)"
  );

  const unit = (modPath, expr) => {
    const prog = [
      `const m = await import(${JSON.stringify(path.join(ROOT, modPath))});`,
      `const out = (${expr});`,
      `console.log("__UNIT__" + JSON.stringify(out));`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 200)}`;
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("__UNIT__"));
    if (!line) return `UNIT-PARSE-ERROR: ${(r.stdout ?? "").slice(0, 120)}`;
    return JSON.parse(line.slice("__UNIT__".length));
  };

  const MB = 1024 * 1024;
  const exEntries = [
    { rel: "particles.star", size: 2 * MB },
    { rel: "extra/mic_01_extract.mrcs", size: 5 * MB },
    { rel: "extra/mic_02_extract.mrcs", size: 1024 }, // THE LOOPHOLE: a 1 KB stack
    { rel: "run.out", size: 4096 },
    { rel: "run.err", size: 128 },
    { rel: "summary.eps", size: 32 * 1024 },
  ];
  const exCtx = `{ policy: "key-files", jobType: "extract", keyFileMb: 16, maxFileMb: 64, maxTotalMb: 256, remoteWorkdir: "/projects/cryoflow/p/extract_abcd1234" }`;

  // THE FIX — an extraction's stacks stay remote WHATEVER THEIR SIZE
  const exPlan = unit(SP, `m.planSyncBack(${JSON.stringify(exEntries)}, ${exCtx})`);
  must(
    exPlan &&
      exPlan.take.map((t) => t.rel).join(",") === "particles.star,run.out,run.err,summary.eps" &&
      exPlan.skip.length === 2 &&
      exPlan.skip.every((s) => s.why === "metadata-only"),
    `LEG A1: the extraction syncs TEXT ONLY — both stacks stay remote, even the 1 KB one (${JSON.stringify(exPlan?.skip ?? null).slice(0, 120)})`
  );

  // THE CONTROL — a class2d's class averages still come home (non-bulk type)
  const clsEntries = [
    { rel: "run_data.star", size: 8 * MB },
    { rel: "run_classes.mrcs", size: 3 * MB },
    { rel: "run_it025_class001.mrc", size: 15 * MB },
    { rel: "big_final_map.mrc", size: 20 * MB },
  ];
  const clsPlan = unit(
    SP,
    `m.planSyncBack(${JSON.stringify(clsEntries)}, { policy: "key-files", jobType: "class2d", keyFileMb: 16, maxFileMb: 64, maxTotalMb: 256 })`
  );
  must(
    clsPlan &&
      clsPlan.take.map((t) => t.rel).join(",") === "run_data.star,run_classes.mrcs,run_it025_class001.mrc" &&
      clsPlan.skip.length === 1 &&
      clsPlan.skip[0].why === "key-cap",
    `LEG A2: the class2d keeps the t289 doctrine — class averages (3 MB) home, the 20 MB map stays (key-cap) (${JSON.stringify(clsPlan?.skip ?? null).slice(0, 100)})`
  );

  // the other bulk producers + the override + the legacy caller
  const mcPlan = unit(
    SP,
    `m.planSyncBack([{ rel: "corrected_sum_01.mrc", size: 2 * 1024 * 1024 }, { rel: "corrected_micrographs.star", size: 1024 }], { policy: "key-files", jobType: "motioncorr", keyFileMb: 16, maxFileMb: 64, maxTotalMb: 256 })`
  );
  must(
    mcPlan && mcPlan.take.length === 1 && mcPlan.take[0].rel === "corrected_micrographs.star" && mcPlan.skip[0].why === "metadata-only",
    "LEG A3: motioncorr (and polish) share the metadata-only rule"
  );
  const evPlan = unit(
    SP,
    `m.planSyncBack(${JSON.stringify(exEntries)}, { policy: "everything", jobType: "extract", keyFileMb: 16, maxFileMb: 64, maxTotalMb: 256 })`
  );
  must(
    evPlan && evPlan.take.length === 6 && evPlan.skip.length === 0,
    "LEG A4: the everything override brings every stack home (the explicit user choice)"
  );
  const legacyPlan = unit(
    SP,
    `m.planSyncBack([{ rel: "extra/mic_01_extract.mrcs", size: 5 * ${MB} }], { policy: "key-files", keyFileMb: 16, maxFileMb: 64, maxTotalMb: 256 })`
  );
  must(
    legacyPlan && legacyPlan.take.length === 1,
    "LEG A5: a caller with no jobType keeps the pre-t339 behavior (never bulk by default)"
  );

  // the caps + the budget arithmetic
  const capPlan = unit(
    SP,
    `m.planSyncBack([{ rel: "a.star", size: ${70 * MB} }, { rel: "b.star", size: 1024 }], { policy: "everything", jobType: "extract", keyFileMb: 16, maxFileMb: 64, maxTotalMb: 256 })`
  );
  must(
    capPlan && capPlan.skip.map((s) => s.why).join(",") === "per-file-cap" && capPlan.take.length === 1,
    "LEG A6: the per-file cap + budget still speak (a 70 MB file over a 64 MB cap refuses)"
  );
  const budgetPlan = unit(
    SP,
    `m.planSyncBack([{ rel: "a.star", size: ${200 * MB} }, { rel: "b.star", size: ${200 * MB} }], { policy: "everything", jobType: "extract", keyFileMb: 16, maxFileMb: 512, maxTotalMb: 256 })`
  );
  must(
    budgetPlan && budgetPlan.take.length === 1 && budgetPlan.skip[0].why === "budget",
    "LEG A7: the whole-sync budget still bounds the take list"
  );

  // the notes
  const exNote = unit(
    SP,
    `m.describeSyncSkips(${JSON.stringify(exPlan.skip)}, ${exCtx})`
  );
  must(
    typeof exNote === "string" &&
      /2 image file\(s\) stayed on the cluster/.test(exNote) &&
      /extract jobs sync metadata only/.test(exNote) &&
      /whatever their size/.test(exNote) &&
      /fetch it on demand/.test(exNote) &&
      /sync policy to "everything"/.test(exNote),
    `LEG A8: the metadata-only note speaks the POLICY, not caps (${String(exNote).slice(0, 90)}…)`
  );
  const clsNote = unit(
    SP,
    `m.describeSyncSkips(${JSON.stringify(clsPlan.skip)}, { policy: "key-files", jobType: "class2d", keyFileMb: 16, maxFileMb: 64, maxTotalMb: 256 })`
  );
  must(
    typeof clsNote === "string" &&
      /1 bulky file\(s\) stayed on the cluster \(key-files policy\)/.test(clsNote) &&
      /> 16 MB key-file cap/.test(clsNote),
    "LEG A9: the key-cap note keeps the t289 wording (no reader sees a dialect change)"
  );
  const noNote = unit(SP, `m.describeSyncSkips([], ${exCtx})`);
  must(noNote === null, "LEG A10: nothing skipped → no note");
  const mixedNote = unit(
    SP,
    `m.describeSyncSkips([{ rel: "extra/x.mrcs", size: 5, why: "metadata-only" }, { rel: "huge.star", size: ${70 * MB}, why: "per-file-cap" }], ${exCtx})`
  );
  must(
    typeof mixedNote === "string" && mixedNote.includes(" — ") &&
      /image file\(s\) stayed/.test(mixedNote) && /1 bulky file\(s\) stayed on the cluster \(key-files policy\)/.test(mixedNote),
    "LEG A11: both classes coexist in one note, separated (the capped segment keeps its policy's own wording)"
  );

  // ======================================================================
  console.log("== PHASE B: LIVE — the user's pipeline, on the mock ==");

  const mkConn = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t339 (mirror slim)",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      maxFileMb: 16,
      maxTotalMb: 64,
    }),
  });
  must(mkConn.status === 200 || mkConn.status === 201, `the connection upserts (${mkConn.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t339 mirror slim", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;

  const fx = clientBoth(
    "mkdir -p /data2/t339-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t339-mic.mrc; ` +
      "for i in $(seq 1 4); do cp /tmp/.t339-mic.mrc /data2/t339-mics/mic_$(printf %02d $i).mrc; done"
  );
  must(fx === "", `the 4 fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId,
    type: "import",
    name: "QA t339 import",
    params: {
      micrographsPath: Array.from({ length: 4 }, (_, i) => `/data2/t339-mics/mic_${String(i + 1).padStart(2, "0")}.mrc`).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  await api(`/api/jobs/${importJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  const doneImport = await awaitJobTerminal(importJob.id, 90_000);
  must(doneImport?.status === "completed", `the import completes (${doneImport?.status})`);

  const autopickJob = await mkJob({
    projectId,
    type: "autopick",
    name: "QA t339 autopick LoG",
    params: { logDiamMin: 120, logDiamMax: 180 },
  });
  const extractJob = await mkJob({
    projectId,
    type: "extract",
    name: "QA t339 extract",
    params: { boxSize: 128 },
  });
  const class2dJob = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t339 class2d downstream",
    params: { numberOfClasses: 4 },
  });
  must(!!autopickJob?.id && !!extractJob?.id && !!class2dJob?.id, "the autopick/extract/class2d jobs create");
  const eAP = await mkEdge(importJob.id, autopickJob.id, "micrographs", "micrographs");
  const eEXm = await mkEdge(importJob.id, extractJob.id, "micrographs", "micrographs");
  const eEXc = await mkEdge(autopickJob.id, extractJob.id, "coords", "coords");
  const eCL = await mkEdge(extractJob.id, class2dJob.id, "particles", "particles");
  must(
    [eAP, eEXm, eEXc, eCL].every((s) => s === 200 || s === 201),
    `the DAG wires import → autopick → extract → class2d (${eAP}/${eEXm}/${eEXc}/${eCL})`
  );

  const dAP = await dispatch(autopickJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 0 },
  });
  must(dAP.status >= 200 && dAP.status < 300 && !dAP.body?.error, `the LoG autopick dispatch is accepted (${dAP.status})`);
  const doneAP = await awaitJobTerminal(autopickJob.id, 180_000);
  must(doneAP?.status === "completed", `the LoG autopick completes (${doneAP?.status})`);

  // ---- LEG B1: the extract finalizes — the local mirror keeps METADATA --
  const dEX = await dispatch(extractJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 0 },
  });
  must(
    dEX.status >= 200 && dEX.status < 300 && !dEX.body?.error,
    `LEG B1: the extract dispatch is accepted (${dEX.status}${dEX.body?.error ? `: ${dEX.body.error}` : ""})`
  );
  const doneEX = await awaitJobTerminal(extractJob.id, 240_000);
  must(
    doneEX?.status === "completed",
    `LEG B1: the extract COMPLETES on the cluster (${doneEX?.status}: ${String(doneEX?.result ?? "").slice(0, 100)})`
  );

  const exRec = readRecord(extractJob.id);
  const mirror = exRec?.workdir;
  must(!!mirror && existsSync(mirror), "LEG B1: the local mirror exists");
  const walk1 = mirror ? walkMirror(mirror) : { all: [], mrcs: [] };
  must(
    walk1.all.includes("particles.star"),
    `LEG B1: the metadata came home (particles.star + ${walk1.all.length} files)`
  );
  must(
    walk1.mrcs.length === 0,
    `LEG B1: THE FIX — zero image files in the local mirror (found: ${walk1.mrcs.slice(0, 3).join(", ") || "none"})`
  );
  must(
    typeof exRec?.remote?.note === "string" && /sync metadata only/.test(exRec.remote.note) &&
      /4 image file\(s\) stayed on the cluster/.test(exRec.remote.note),
    `LEG B1: the receipt speaks the policy (${String(exRec?.remote?.note ?? "").slice(0, 90)}…)`
  );
  must(
    (exRec?.remote?.skippedFiles ?? []).every((s) => /metadata only/.test(s)) &&
      (exRec?.remote?.skippedFiles ?? []).length === 4,
    "LEG B1: every skipped file carries the metadata-only why (4 stacks)"
  );

  // the manifest keeps the FULL truth (the Results tab + the lazy door live off it)
  const manifestPath = mirror ? path.join(mirror, ".cf-remote-manifest.json") : "";
  const manifest = manifestPath ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const manifestStacks = (manifest?.files ?? []).filter((f) => /_extract\.mrcs$/.test(f.path));
  must(
    manifestStacks.length === 4 && manifestStacks.every((f) => f.size > 1024),
    `LEG B1: the ledger lists all 4 stacks with sizes (${manifestStacks.length} entries)`
  );

  // the Files tab shows what stayed (remote: true, sizes from the ledger)
  const outs = await api(`/api/jobs/${extractJob.id}/outputs`, { headers: SH });
  const remoteStacks = (outs.body?.files ?? []).filter((f) => /_extract\.mrcs$/.test(f.path));
  must(
    remoteStacks.length === 4 && remoteStacks.every((f) => f.remote === true),
    `LEG B1: the Results tab lists the 4 stacks as remote (${remoteStacks.length} remote of ${outs.body?.files?.length ?? 0} files)`
  );

  // ---- LEG B2: the lazy door — one click, one stack, over SSH -----------
  const stackRel = manifestStacks[0]?.path ?? "extra/mic_01_extract.mrcs";
  const png = await fetch(
    `${BASE}/api/jobs/${extractJob.id}/outputs/file?path=${encodeURIComponent(stackRel)}&montage=4&format=png`,
    { headers: SH }
  );
  const pngBytes = png.status === 200 ? await png.arrayBuffer() : null;
  must(
    png.status === 200 && pngBytes && pngBytes.byteLength > 100 && (png.headers.get("content-type") ?? "").includes("image/png"),
    `LEG B2: the lazy fetch renders the remote stack on demand (${png.status}, ${pngBytes?.byteLength ?? 0} B png)`
  );
  const fetchedAbs = mirror ? path.join(mirror, stackRel) : "";
  must(
    !!fetchedAbs && existsSync(fetchedAbs) && statSync(fetchedAbs).size === manifestStacks[0].size,
    "LEG B2: the fetched stack landed at its real workdir path, byte-count verified (the t298 verdict)"
  );

  // ---- LEG B3: downstream chains WITHOUT local stacks + the control -----
  const dCL = await dispatch(class2dJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 0 },
  });
  must(
    dCL.status >= 200 && dCL.status < 300 && !dCL.body?.error,
    `LEG B3: the downstream class2d dispatch is accepted (${dCL.status}${dCL.body?.error ? `: ${dCL.body.error}` : ""})`
  );
  const doneCL = await awaitJobTerminal(class2dJob.id, 240_000);
  must(
    doneCL?.status === "completed",
    `LEG B3: the class2d completes off the CLUSTER copy in place (${doneCL?.status}: ${String(doneCL?.result ?? "").slice(0, 90)})`
  );
  const clRec = readRecord(class2dJob.id);
  const clMirror = clRec?.workdir;
  const walkCL = clMirror && existsSync(clMirror) ? walkMirror(clMirror) : { all: [], mrcs: [] };
  must(
    walkCL.mrcs.includes("run_classes.mrcs"),
    `LEG B3: THE CONTROL — the class2d's own class averages still came home (${walkCL.mrcs.join(", ") || "none"})`
  );
  must(
    typeof clRec?.remote?.note !== "string" || !/sync metadata only/.test(clRec.remote.note),
    "LEG B3: a result-type job never speaks the metadata-only note"
  );

  // ---- LEG B4: the override — 'everything' brings the stacks home -------
  const patch = await api(`/api/remote/connections/${CONN}`, {
    method: "PATCH",
    headers: SHJ,
    body: JSON.stringify({ syncPolicy: "everything" }),
  });
  must(patch.status >= 200 && patch.status < 300, `LEG B4: the connection flips to everything (${patch.status})`);
  const dEX2 = await dispatch(extractJob.id, {
    remote: { connectionId: CONN, module: MODULE, mode: "slurm", gpus: 0 },
  });
  must(
    dEX2.status >= 200 && dEX2.status < 300 && !dEX2.body?.error,
    `LEG B4: the re-run dispatch is accepted (${dEX2.status})`
  );
  const doneEX2 = await awaitJobTerminal(extractJob.id, 240_000);
  must(doneEX2?.status === "completed", `LEG B4: the re-run completes (${doneEX2?.status})`);
  const walk2 = mirror ? walkMirror(mirror) : { all: [], mrcs: [] };
  must(
    walk2.mrcs.filter((f) => /_extract\.mrcs$/.test(f)).length === 4,
    `LEG B4: THE OVERRIDE — all 4 stacks land under 'everything' (${walk2.mrcs.length} image files)`
  );
  const manifest2 = manifestPath ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const sizeOk = (manifest2?.files ?? [])
    .filter((f) => /_extract\.mrcs$/.test(f.path))
    .every((f) => {
      const abs = path.join(mirror, f.path);
      return existsSync(abs) && statSync(abs).size === f.size;
    });
  must(sizeOk, "LEG B4: every landed stack matches the ledger's byte count");

  // ---- LEG B5: the slimming lever — local bulk cleanup, cluster keeps ---
  const clusterStacks = () =>
    parseInt(
      client(
        `ls /projects/cryoflow/${projectId}/extract_${extractJob.id.slice(-8)}/extra/ 2>/dev/null | grep -c '_extract\\.mrcs'`
      ) || "0",
      10
    );
  must(clusterStacks() === 4, "LEG B5: the cluster holds the 4 stacks before the slim");
  const slim = await api(`/api/jobs/${extractJob.id}/cleanup`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ local: true, remote: false, tiers: ["bulk"] }),
  });
  must(
    slim.status === 200 && (slim.body?.local?.deleted ?? 0) >= 4 && (slim.body?.local?.freedBytes ?? 0) > 0,
    `LEG B5: the local-only bulk cleanup frees the mirror (${slim.status}: ${slim.body?.local?.deleted ?? "?"} deleted, ${slim.body?.local?.freedBytes ?? 0} B)`
  );
  const walk3 = mirror ? walkMirror(mirror) : { all: [], mrcs: [] };
  must(
    walk3.mrcs.length === 0 && walk3.all.includes("particles.star"),
    `LEG B5: the mirror is metadata again — stacks gone, star kept (${walk3.all.length} files)`
  );
  must(
    clusterStacks() === 4,
    "LEG B5: THE CLUSTER KEEPS EVERY BYTE (4 stacks still there — the lever for already-landed mirrors)"
  );

  // ======================================================================
  console.log("== PHASE C: CONTRACTS — the source ledger ==");

  const rr = src("src/lib/remote/remote-run.ts");
  must(
    /syncBackWorkdir\(conn, r, localWorkdir, job\.type\)/.test(rr),
    "finalize threads the job's TYPE into the sync (the planner's bulk gate)"
  );
  const ledgerAt = rr.indexOf("writeRemoteManifest(localWorkdir");
  const planAt = rr.indexOf("planSyncBack(entries, policyCtx)");
  const dlAt = rr.indexOf("await remoteDownload(");
  must(
    ledgerAt > 0 && planAt > ledgerAt && dlAt > planAt,
    "the lane order holds: ledger FIRST (even a dying sync leaves the truth) → plan → download"
  );
  must(
    !/const KEY_TEXT_EXT/.test(rr),
    "the extension grammar lives in the pure module now (one brain, three speakers: lane + note + diag)"
  );
  const cleanupSrc = src("src/lib/hpc/cleanup.ts");
  must(/export const BULK_TYPES/.test(cleanupSrc), "BULK_TYPES is exported (deletion and sync share one grammar)");
  must(
    /image stacks never do, whatever their size/.test(src(SP)),
    "the planner's doc speaks the loophole it closed"
  );

  console.log(fail === 0 ? "\n== t339 diag: ALL GREEN ==" : `\n== t339 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: only this suite's own artifacts ----
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
    client("rm -rf /data2/t339-mics /tmp/.t339-mic.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
  process.exitCode = fail === 0 ? 0 : 1;
}
