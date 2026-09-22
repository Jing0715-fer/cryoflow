/**
 * DIAG t356 — the PROACTIVE class-image pipeline (the user's architecture:
 * 「把 cluster 的 mrcs 结果文件下载到本地，之后将 mrcs 文件转换成图片」).
 *
 * The field report after t355: both galleries still dark on the REAL
 * cluster. The lazy on-demand door made every image a fresh SSH round at
 * click time; t356 makes the download+convert PROACTIVE:
 *
 *   A. FINALIZE PIPELINE — a remote class2d completes → the sync-back
 *      manifest's stacks are downloaded and converted to per-class PNGs +
 *      per-round sheets in the LOCAL preview cache, the .mrcs deleted
 *      (t339 slimming). NO image-route call is ever needed — the suite
 *      never touches /iterations/image or /iterations/sheet in phase B,
 *      and the cache still holds every round.
 *   B. THE USER'S WORLD — the mirror has no stacks (key-files caps) and
 *      even the CLUSTER copy is gone: images still answer 200 from the
 *      local cache. The architecture's proof: after finalize the images
 *      ARE local.
 *   C. LEGACY RUN + FINAL UNMASKED — a pre-t356 job (cache wiped) with a
 *      RELION 5 final unmasked stack planted on the cluster: the view
 *      trigger renders it on the first /iterations poll; /classes names
 *      it from the cache (zero SSH); the image + sheet routes accept the
 *      round-less name.
 *   D. RUNNING-STATE TRIGGER — a live run's rounds render in the
 *      background while /iterations is polled, no chip clicks.
 *   E. WIRE DOWN, CACHE UP — connection deleted: /classes still names the
 *      stack, thumbnails + sheets still answer — all from local bytes.
 *
 * The mock cluster (:3022) and the dev server must both be up.
 * CF_ROOT / CF_BASE override the defaults (the sandbox convention).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/my-project";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const CONN = "qa-t356";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const DATA_DIR = path.join(ROOT, "data");
const PREVIEW_LIVE = path.join(DATA_DIR, "remote-preview", "live");

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 60_000,
  }).stdout?.trim() ?? "";
const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const raw = async (url) => {
  const r = await fetch(`${BASE}${url}`, { headers: SH });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, buf };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const awaitTerminal = async (id, deadlineMs) => {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    const { body } = await api("/api/jobs", { headers: SH });
    const j = (body?.jobs ?? []).find((x) => x.id === id);
    if (j && j.status !== "running" && j.status !== "pending") return j;
    await sleep(700);
  }
  return null;
};
const isPng = (buf) =>
  buf != null && buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
/** rendered rounds of a job: dirs under preview/live/<jobId> with the .done
 * verdict (or a legacy sheet) + at least one slice PNG */
const renderedRounds = (jobId) => {
  const dir = path.join(PREVIEW_LIVE, jobId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => {
    if (n.startsWith(".")) return false;
    const inner = path.join(dir, n);
    try {
      if (!statSync(inner).isDirectory()) return false;
      const files = readdirSync(inner);
      const verdict = files.includes(".done") || files.includes("sheet.png");
      const slices = files.some((f) => /^slice\d{4}\.png$/.test(f));
      return verdict && slices;
    } catch {
      return false;
    }
  });
};
const awaitRendered = async (jobId, minRounds, deadlineMs) => {
  const end = Date.now() + deadlineMs;
  while (Date.now() < end) {
    if (renderedRounds(jobId).length >= minRounds) return true;
    await sleep(500);
  }
  return renderedRounds(jobId).length >= minRounds;
};

const createdJobs = [];
let projectId = null;
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  if (b?.job?.projectId) projectId = b.job.projectId;
  return b?.job;
};
const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};
const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the dev server answers on :3000");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t356", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t356 proactive render", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");

  // ======================================================================
  console.log("== PHASE A: a REAL cluster class2d (mock slurm, 6 rounds, 3 classes) ==");
  const stackB64 = (() => {
    const data = Buffer.alloc(1024);
    data.writeInt32LE(48, 0); data.writeInt32LE(48, 4); data.writeInt32LE(24, 8); data.writeInt32LE(2, 12);
    return data.toString("base64");
  })();
  const fx = client(
    "mkdir -p /data2/t356-particles; " +
      `echo ${stackB64} | base64 -d > /data2/t356-particles/stack24.mrcs; ` +
      "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t356-particles/particles.star; " +
      "for i in $(seq 1 24); do printf '%d@/data2/t356-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t356-particles/particles.star; done"
  );
  must(fx === "", `the particles fixtures build quietly (${fx.slice(0, 120)})`);

  const importParts = await mkJob({
    projectId, type: "import", name: "QA t356 particles import",
    params: { micrographsPath: "/data2/t356-particles/particles.star", nodeType: "particles" },
  });
  must(!!importParts?.id, "the particles import creates");
  const runParts = await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runParts.status >= 200 && runParts.status < 300, `the particles import accepts (${runParts.status})`);
  const doneParts = await awaitTerminal(importParts.id, 60_000);
  must(doneParts?.status === "completed", `the particles import completes (${doneParts?.status})`);

  const clsJob = await mkJob({
    projectId, type: "class2d", name: "QA t356 class2d proactive",
    params: { iterations: 6, numClasses: 3 },
  });
  must(!!clsJob?.id, "the class2d job creates");
  const edge = await api("/api/edges", {
    method: "POST", headers: SH,
    body: JSON.stringify({ fromJobId: importParts.id, toJobId: clsJob.id, fromPort: "particles", toPort: "particles" }),
  });
  must(edge.status === 200 || edge.status === 201, `the particles edge wires import → class2d (${edge.status})`);

  const dispatch = await api(`/api/jobs/${clsJob.id}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
  });
  must(dispatch.status >= 200 && dispatch.status < 300, `the class2d dispatch answers (${dispatch.status})`);
  must(!dispatch.body?.error, `the class2d dispatch is ACCEPTED (${String(dispatch.body?.error ?? "").slice(0, 100)})`);

  const done = await awaitTerminal(clsJob.id, 150_000);
  must(done?.status === "completed", `the class2d completes (${done?.status}: ${String(done?.result ?? "").slice(0, 90)})`);
  if (done?.status !== "completed") throw new Error("class2d did not complete — the rest of the suite is meaningless");

  const mirror = path.join(DATA_DIR, "relion", projectId, `class2d_${clsJob.id.slice(-8)}`);
  must(existsSync(mirror), `the local mirror exists (${mirror})`);

  // ======================================================================
  console.log("== PHASE B: the FINALIZE PIPELINE rendered every round — no image call needed ==");
  // The suite NEVER calls /iterations/image or /iterations/sheet for this
  // job in this phase — the only possible renderer is the background
  // pipeline the finalize leg fires from the manifest.
  must(
    await awaitRendered(clsJob.id, 6, 30_000),
    `all 6 rounds rendered into the LOCAL preview cache (${renderedRounds(clsJob.id).length}: ${renderedRounds(clsJob.id).join(", ")})`
  );
  const previewDir = path.join(PREVIEW_LIVE, clsJob.id);
  const allFiles = readdirSync(previewDir, { recursive: true }).map(String);
  must(
    allFiles.filter((f) => /\/sheet\.png$/.test(f)).length === 6,
    "every round carries its SHEET (one image per round — t354's ask, now arriving on its own)"
  );
  must(
    allFiles.filter((f) => /\/slice\d{4}\.png$/.test(f)).length === 18,
    "every slice rendered (6 rounds × 3 classes)"
  );
  must(
    !allFiles.some((f) => f.includes(".stack.mrcs")),
    "no transient .mrcs survives — the slimming contract holds (PNGs local, stacks not)"
  );

  // B2 — the user's world on top: the mirror lost its stacks (the key-files
  // caps) AND the cluster copy is GONE — images must still answer locally
  for (const f of readdirSync(mirror).filter((f) => /classes\.mrcs?$/i.test(f))) {
    rmSync(path.join(mirror, f));
  }
  const clusterWorkdir = client(
    `for f in $(ls /projects/cryoflow/${projectId}/class2d_${clsJob.id.slice(-8)}/run_it*_classes.mrcs 2>/dev/null); do rm -f "$f"; done; echo done`
  );
  must(clusterWorkdir.includes("done"), "the cluster's per-round stacks are deleted (the images must now be local-only)");
  const imgLocal = await raw(`/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent("run_it006_classes.mrcs")}&slice=1`);
  must(imgLocal.status === 200 && isPng(imgLocal.buf), `slice renders with NO stack anywhere but the cache (${imgLocal.status}, ${imgLocal.buf.length}B)`);
  const sheetLocal = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it006_classes.mrcs")}`);
  must(sheetLocal.status === 200 && isPng(sheetLocal.buf), `the final round's sheet serves locally (${sheetLocal.status})`);
  // B3 — the merged payload: chips + classesFile all local (cache fallback)
  const it2 = await api(`/api/jobs/${clsJob.id}/iterations`, { headers: SH });
  const ip2 = it2.body;
  must(
    Array.isArray(ip2?.stacks) && ip2.stacks.length === 6,
    `the chips bar still lists all 6 rounds (cache union — ${ip2?.stacks?.length})`
  );
  must(ip2?.classesFile != null, `classesFile answers from the render cache (${ip2?.classesFile})`);
  must(ip2?.classes?.length === 3, `occupancy still counts from the local data stars (${ip2?.classes?.length})`);

  // ======================================================================
  console.log("== PHASE C: LEGACY RUN + the RELION 5 final unmasked stack ==");
  // wipe the preview cache — this job is now exactly the user's PRE-t356
  // completed runs (mirror stackless, cache cold) — and plant the final
  // unmasked stack on the cluster the way RELION 5 writes it (PHASE B
  // deleted the per-round stacks, so this is a FRESH 48×48×3 stack —
  // `cp` from a deleted source would fail silently behind 2>/dev/null)
  rmSync(previewDir, { recursive: true, force: true });
  const wd = `/projects/cryoflow/${projectId}/class2d_${clsJob.id.slice(-8)}`;
  const finalB64 = (() => {
    const nx = 16, ny = 16, nz = 3;
    const data = Buffer.alloc(nx * ny * nz * 4);
    for (let k = 0; k < nx * ny * nz; k++) data.writeFloatLE(((k * 7) % 23) / 23 - 0.5, k * 4);
    const hdr = Buffer.alloc(1024);
    hdr.writeInt32LE(nx, 0); hdr.writeInt32LE(ny, 4); hdr.writeInt32LE(nz, 8); hdr.writeInt32LE(2, 12);
    return Buffer.concat([hdr, data]).toString("base64");
  })();
  client(`echo ${finalB64} | base64 -d > ${wd}/run_unmasked_classes.mrcs`);
  must(
    client(`test -s ${wd}/run_unmasked_classes.mrcs && echo ok`).includes("ok"),
    "the final unmasked stack lands on the cluster (RELION 5's closing artifact)"
  );
  // the 12s TTL on remoteLiveIterations still holds the PHASE-B listing
  // (stacks deleted since); let it lapse so the merge sees the cluster's
  // CURRENT truth (the planted final stack)
  await sleep(13_000);

  // C1 — ONE /iterations poll: the merge names the final stack, the view
  // trigger schedules it (round-less names never join the chips — the
  // classesFile addendum is the only way it renders)
  const c1 = await api(`/api/jobs/${clsJob.id}/iterations?refresh=1`, { headers: SH });
  const c1p = c1.body;
  must(c1p?.classesFile === "run_unmasked_classes.mrcs", `the merge prefers the FINAL unmasked stack (${c1p?.classesFile})`);
  must(
    await awaitRendered(clsJob.id, 1, 30_000),
    `the view trigger renders the final stack in the background (${renderedRounds(clsJob.id).join(", ")})`
  );
  // C2 — the select gallery's feed names it from the CACHE (zero SSH)
  const cls2 = await api(`/api/jobs/${clsJob.id}/classes`, { headers: SH });
  const cb2 = cls2.body;
  must(cls2.status === 200 && cb2?.classesFile === "run_unmasked_classes.mrcs", `the classes route names the final stack from the render cache (${cb2?.classesFile})`);
  must(Array.isArray(cb2?.classes) && cb2.classes.length === 3, `occupancy keeps its local count (${cb2?.classes?.length})`);
  // C3 — the thumbnail lane: iterations/image accepts the round-less name
  const fin = await raw(`/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent("run_unmasked_classes.mrcs")}&slice=0`);
  must(fin.status === 200 && isPng(fin.buf), `the final stack's slice renders through the image route (${fin.status})`);
  const finSheet = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_unmasked_classes.mrcs")}`);
  must(finSheet.status === 200 && isPng(finSheet.buf), `the final stack's sheet renders (${finSheet.status})`);

  // ======================================================================
  console.log("== PHASE D: RUNNING-STATE trigger — rounds render while the user watches ==");
  const cls2Job = await mkJob({
    projectId, type: "class2d", name: "QA t356 class2d live",
    params: { iterations: 12, numClasses: 3 },
  });
  must(!!cls2Job?.id, "the second class2d job creates");
  const edge2 = await api("/api/edges", {
    method: "POST", headers: SH,
    body: JSON.stringify({ fromJobId: importParts.id, toJobId: cls2Job.id, fromPort: "particles", toPort: "particles" }),
  });
  must(edge2.status === 200 || edge2.status === 201, `the second edge wires (${edge2.status})`);
  const dispatch2 = await api(`/api/jobs/${cls2Job.id}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
  });
  must(dispatch2.status >= 200 && dispatch2.status < 300, `the second dispatch answers (${dispatch2.status})`);

  // poll like the Results tab does — NEVER calling the image/sheet routes;
  // the only renderer can be the view trigger inside /iterations
  let sawStacksWhileRunning = false;
  let roundsWhileRunning = 0;
  const dEnd = Date.now() + 60_000;
  while (Date.now() < dEnd) {
    const j = await jobById(cls2Job.id);
    // pending → running → terminal: the dispatch-to-running transition is
    // part of the live window (the route accepts both)
    if (!j || (j.status !== "running" && j.status !== "pending")) break;
    const { body } = await api(`/api/jobs/${cls2Job.id}/iterations?refresh=1`, { headers: SH });
    if (Array.isArray(body?.stacks) && body.stacks.length > 0) {
      sawStacksWhileRunning = true;
      await sleep(2_500);
      const j2 = await jobById(cls2Job.id);
      roundsWhileRunning = renderedRounds(cls2Job.id).length;
      if (j2?.status !== "running" && j2?.status !== "pending") break;
      if (roundsWhileRunning > 0) break;
    } else {
      await sleep(600);
    }
  }
  must(sawStacksWhileRunning, "the live payload lists rounds while the job runs");
  must(roundsWhileRunning > 0, `rounds render in the background DURING the run — no chip click (${roundsWhileRunning} rendered)`);
  const done2 = await awaitTerminal(cls2Job.id, 120_000);
  must(done2?.status === "completed", `the second class2d completes (${done2?.status})`);
  must(
    await awaitRendered(cls2Job.id, 12, 40_000),
    `after completion every round is rendered (${renderedRounds(cls2Job.id).length}/12)`
  );

  // ======================================================================
  console.log("== PHASE E: WIRE DOWN, CACHE UP ==");
  const del = await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH });
  must(del.status >= 200 && del.status < 300, `the connection deletes (${del.status})`);

  const offIt = await api(`/api/jobs/${cls2Job.id}/iterations`, { headers: SH });
  must(offIt.status === 200, `the iterations payload answers with the wire down (${offIt.status})`);
  const offCls = await api(`/api/jobs/${cls2Job.id}/classes`, { headers: SH });
  const ocb = offCls.body;
  must(offCls.status === 200 && ocb?.classesFile != null, `the classes route names its stack with ZERO SSH (${ocb?.classesFile})`);
  const offImg = await raw(`/api/jobs/${cls2Job.id}/iterations/image?file=${encodeURIComponent(ocb.classesFile)}&slice=2`);
  must(offImg.status === 200 && isPng(offImg.buf), `the thumbnail answers from the local cache with the wire down (${offImg.status})`);
  const offSheet = await raw(`/api/jobs/${cls2Job.id}/iterations/sheet?file=${encodeURIComponent("run_it012_classes.mrcs")}`);
  must(offSheet.status === 200 && isPng(offSheet.buf), `the sheet answers from the local cache too (${offSheet.status})`);

  const remk = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t356", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(remk.status === 200 || remk.status === 201, `the connection re-creates (${remk.status})`);

  // ======================================================================
  console.log("== PHASE F: honesty guards ==");
  const nf = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it099_classes.mrcs")}`);
  must(nf.status === 404, `a never-existed round answers 404 (${nf.status})`);
  const bad = await raw(`/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent("../../etc/passwd")}&slice=0`);
  must(bad.status === 400, `a path-escape name refuses (${bad.status})`);
  const badFinal = await raw(`/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent("run_unmasked_classes.mrc")}&slice=0`);
  must(badFinal.status === 200 || badFinal.status === 404, `the .mrc alias of the final name stays whitelisted (${badFinal.status})`);
} catch (e) {
  console.error("DIAG t356 crashed:", e);
  fail++;
} finally {
  console.log("== CLEANUP ==");
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
  if (projectId) {
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  client("rm -rf /data2/t356-particles");
  console.log(fail === 0 ? "\nDIAG t356: ALL GREEN" : `\nDIAG t356: ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}
