/**
 * DIAG t355 — the cluster-run 2D gallery that went dark: the field report
 * 「cluster上跑的2D分类的结果看不到图片加载出来，运行2D selection job时
 * 也没法看到每一类的图片加载出来」.
 *
 * The three defects under test (all reproduced against the mock cluster
 * through a REAL dispatch, then the user's world simulated on top):
 *
 *   A. STACKLESS MIRROR — the key-files policy keeps a real run's class
 *      stacks ON the cluster (a 100-class 2D run writes 25–100 MB stacks,
 *      over the 16 MB default cap). The mirror holds the data stars only:
 *        · /iterations  must MERGE the cluster listing (classesFile was
 *          null → "no image" on every card of the class grid)
 *        · /iterations/image must PULL for a DONE run (the old `run.done`
 *          rejection 404'd every per-class image after completion)
 *   B. COLD MIRROR — the sync budget can leave the data stars behind too:
 *        · /iterations answers iterations + occupancy FROM THE CLUSTER
 *        · /classes (the 2D-selection gallery's feed) answers classesFile
 *          + occupancy from the cluster, and its thumbnails lazy-fetch
 *          through /outputs/file (the t289 leg) — landing the stack in
 *          the mirror
 *   C. THE WIRE DOWN — connection deleted: /classes still names the stack
 *      through the finalize MANIFEST (zero SSH), so the gallery degrades
 *      honestly instead of blanking.
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
const CONN = "qa-t355";
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
      id: CONN, name: "QA t355", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t355 cluster gallery", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");

  // ======================================================================
  console.log("== PHASE A: a REAL cluster class2d (mock slurm, 8 rounds, 3 classes) ==");
  const stackB64 = (() => {
    const data = Buffer.alloc(1024);
    data.writeInt32LE(48, 0); data.writeInt32LE(48, 4); data.writeInt32LE(24, 8); data.writeInt32LE(2, 12);
    return data.toString("base64");
  })();
  const fx = client(
    "mkdir -p /data2/t355-particles; " +
      `echo ${stackB64} | base64 -d > /data2/t355-particles/stack24.mrcs; ` +
      "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t355-particles/particles.star; " +
      "for i in $(seq 1 24); do printf '%d@/data2/t355-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t355-particles/particles.star; done"
  );
  must(fx === "", `the particles fixtures build quietly (${fx.slice(0, 120)})`);

  const importParts = await mkJob({
    projectId, type: "import", name: "QA t355 particles import",
    params: { micrographsPath: "/data2/t355-particles/particles.star", nodeType: "particles" },
  });
  must(!!importParts?.id, "the particles import creates");
  const runParts = await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runParts.status >= 200 && runParts.status < 300, `the particles import accepts (${runParts.status})`);
  const doneParts = await awaitTerminal(importParts.id, 60_000);
  must(doneParts?.status === "completed", `the particles import completes (${doneParts?.status})`);

  const clsJob = await mkJob({
    projectId, type: "class2d", name: "QA t355 class2d gallery",
    params: { iterations: 8, numClasses: 3 },
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
  console.log("== PHASE B: STACKLESS MIRROR — the user's exact world ==");
  // delete every class stack from the mirror (what the key-files policy
  // does to a real 25–100 MB stack) and wipe the preview cache (a restart)
  const stacksBefore = existsSync(mirror)
    ? readdirSync(mirror).filter((f) => /classes\.mrcs?$/i.test(f))
    : [];
  must(stacksBefore.length >= 8, `the sync-back landed the small mock stacks (${stacksBefore.length})`);
  for (const f of stacksBefore) rmSync(path.join(mirror, f));
  rmSync(path.join(PREVIEW_LIVE, clsJob.id), { recursive: true, force: true });
  console.log(`  (mirror stacks removed to simulate the >key-cap world: ${stacksBefore.length} files)`);

  // B1 — the merged iterations payload: chips + classesFile from the CLUSTER
  const merged = await api(`/api/jobs/${clsJob.id}/iterations`, { headers: SH });
  const mp = merged.body;
  must(merged.status === 200 && Array.isArray(mp?.stacks), "the merged iterations payload answers");
  must(
    Array.isArray(mp?.stacks) && mp.stacks.length === 8,
    `all 8 chips come back from the cluster listing (${mp?.stacks?.length}: ${JSON.stringify(mp?.stacks?.map((s) => s.file))})`
  );
  must(mp?.classesFile != null, `classesFile is NON-null — the cluster names the stack (${mp?.classesFile})`);
  must(mp?.classes?.length === 3, `occupancy still counts from the local data stars (${mp?.classes?.length} classes)`);
  must(mp?.remote === true, "the payload admits it consulted the cluster");

  // B2 — the per-class images: a DONE remote run pulls on demand (was 404)
  for (const slice of [0, 1, 2]) {
    const r = await raw(`/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent(mp.classesFile)}&slice=${slice}`);
    must(r.status === 200 && isPng(r.buf), `slice ${slice} renders for the DONE remote run (${r.status}, ${r.buf.length}B)`);
  }
  // B3 — the sheet keeps answering (the t354 dialect, now with the merged name)
  const sheet = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent(mp.classesFile)}`);
  must(sheet.status === 200 && isPng(sheet.buf), `the final round's sheet serves (${sheet.status}, ${sheet.buf.length}B)`);
  // B4 — slimming contract holds: the pulled stack never stays
  const previewJobDir = path.join(PREVIEW_LIVE, clsJob.id);
  const transient = existsSync(previewJobDir)
    ? readdirSync(previewJobDir, { recursive: true }).filter((f) => String(f).includes(".stack.mrcs"))
    : [];
  must(transient.length === 0, `no transient .stack.mrcs survives (${transient.join(", ")})`);

  // ======================================================================
  console.log("== PHASE C: COLD MIRROR — the data stars stayed on the cluster too ==");
  for (const f of readdirSync(mirror).filter((f) => /^run_it\d{3}_data\.star$/.test(f))) {
    rmSync(path.join(mirror, f));
  }
  rmSync(previewJobDir, { recursive: true, force: true });

  // C1 — /iterations answers EVERYTHING from the cluster
  const cold = await api(`/api/jobs/${clsJob.id}/iterations`, { headers: SH });
  const cp = cold.body;
  must(
    Array.isArray(cp?.iterations) && cp.iterations.length === 8,
    `the iteration list comes from the CLUSTER (${JSON.stringify(cp?.iterations)})`
  );
  must(cp?.classes?.length === 3, `occupancy counts ON the cluster by awk (${cp?.classes?.length} classes, total ${cp?.total})`);
  must(cp?.classesFile != null, `the stack name still answers (${cp?.classesFile})`);

  // C2 — /classes (the 2D-selection gallery's feed) answers from the cluster
  const cls = await api(`/api/jobs/${clsJob.id}/classes`, { headers: SH });
  const cb = cls.body;
  must(cls.status === 200, `the classes route answers (${cls.status})`);
  must(cb?.classesFile != null, `the SELECT gallery gets its stack name (${cb?.classesFile})`);
  must(Array.isArray(cb?.classes) && cb.classes.length === 3, `occupancy fills from the cluster (${cb?.classes?.length})`);
  must(cb?.iteration === 8, `the iteration number rides along (${cb?.iteration})`);

  // C3 — the thumbnail lazy-fetch: the first /outputs/file pull lands the
  // stack in the mirror (the t289 doctrine), the rest render locally
  const t1 = await raw(`/api/jobs/${clsJob.id}/outputs/file?path=${encodeURIComponent(cb.classesFile)}&format=png&montage=0&slice=0`);
  must(t1.status === 200 && isPng(t1.buf), `the first thumbnail lazy-fetches the stack (${t1.status}, ${t1.buf.length}B)`);
  must(existsSync(path.join(mirror, cb.classesFile)), "the fetched stack lands at its real mirror path");
  const t2 = await raw(`/api/jobs/${clsJob.id}/outputs/file?path=${encodeURIComponent(cb.classesFile)}&format=png&montage=0&slice=2`);
  must(t2.status === 200 && isPng(t2.buf), `the next thumbnail renders from the landed stack (${t2.status}, ${t2.buf.length}B)`);

  // ======================================================================
  console.log("== PHASE D: THE WIRE DOWN — the manifest still names the stack ==");
  // remove the landed stack again + delete the connection: the SSH leg is
  // dead, but the finalize manifest (written at sync-back) still knows
  rmSync(path.join(mirror, cb.classesFile), { force: true });
  const del = await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH });
  must(del.status >= 200 && del.status < 300, `the connection deletes (${del.status})`);

  const offline = await api(`/api/jobs/${clsJob.id}/classes`, { headers: SH });
  const ob = offline.body;
  must(offline.status === 200, `the classes route answers with the wire down (${offline.status})`);
  must(ob?.classesFile != null, `the MANIFEST still names the stack — zero SSH (${ob?.classesFile})`);

  // restore the connection for the cleanup + later suites
  const remk = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t355", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(remk.status === 200 || remk.status === 201, `the connection re-creates (${remk.status})`);

  // ======================================================================
  console.log("== PHASE E: honesty guards ==");
  // a round that never existed → 404 (not 500)
  const nf = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it099_classes.mrcs")}`);
  must(nf.status === 404, `a never-existed round answers 404 (${nf.status})`);
  // a missing file through the lazy-fetch door → 404 "not found on the cluster"
  const nf2 = await raw(`/api/jobs/${clsJob.id}/outputs/file?path=${encodeURIComponent("run_it099_classes.mrcs")}&format=png&montage=0&slice=0`);
  must(nf2.status === 404, `a missing stack lazy-fetch answers 404 (${nf2.status})`);
  // path escape still refuses
  const bad = await raw(`/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent("../../etc/passwd")}&slice=0`);
  must(bad.status === 400, `a path-escape name refuses (${bad.status})`);
} catch (e) {
  console.error("DIAG t355 crashed:", e);
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
  client("rm -rf /data2/t355-particles");
  console.log(fail === 0 ? "\nDIAG t355: ALL GREEN" : `\nDIAG t355: ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}
