/**
 * DIAG t354 — the per-iteration SHEET: 「每一轮的 2D 结果生成一张图片，
 * 可以在本本地的 UI 中查看」.
 *
 * The contract under test:
 *   1. SHEET RENDER — renderClassSheetPng turns a class-average stack into
 *      ONE grid PNG (all slices, black background, per-slice stretch).
 *   2. LOCAL LEG — localIterations lists EVERY round that has a stack
 *      (mirror readdir ∪ preview cache), unmasked variants winning ties.
 *   3. COLD-CACHE SYNTHESIS — a finished REMOTE run whose mirror lost the
 *      per-iteration stacks still offers chips for every round (RELION's
 *      naming law: run_itNNN_data.star ⇒ run_itNNN_classes.mrcs), and the
 *      sheet route RE-PULLS each round on demand.
 *   4. LIVE + AFTER — a real mock-cluster class2d answers sheets WHILE it
 *      runs (t350's slice route keeps working alongside) and after it
 *      finishes; the MB-scale stack never stays (the slimming contract).
 *
 * The mock cluster (:3022) and the dev server must both be up.
 * CF_ROOT / CF_BASE override the defaults (the sandbox convention).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/my-project";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const CONN = "qa-t354";
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

/* ---- a REAL MRC writer (the mock's own dialect, JS) ---------------- */
function mrcBuffer(nx, ny, nz, seed) {
  const data = Buffer.alloc(nx * ny * nz * 4);
  for (let k = 0; k < nx * ny * nz; k++) {
    const v = ((seed * 1103515245 + k * 12345) % 1000) / 1000.0 - 0.5;
    data.writeFloatLE(v, k * 4);
  }
  const header = Buffer.alloc(1024);
  header.writeInt32LE(nx, 0);
  header.writeInt32LE(ny, 4);
  header.writeInt32LE(nz, 8);
  header.writeInt32LE(2, 12); // mode float32
  header.writeInt32LE(nx, 28);
  header.writeInt32LE(ny, 32);
  header.writeInt32LE(nz, 36);
  header.writeFloatLE(nx, 40);
  header.writeFloatLE(ny, 44);
  header.writeFloatLE(nz, 48);
  header.writeInt32LE(1, 88); // ISPG
  header.writeInt32LE(0, 92); // nsymbt
  return Buffer.concat([header, data]);
}

/** run a TS module in bun and print JSON (the t319 unit harness). */
const unit = (prog) => {
  const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
  if (r.status !== 0) return { UNIT_ERROR: `${(r.stderr ?? "").slice(0, 400)}` };
  try {
    return JSON.parse(r.stdout.trim().split("\n").pop());
  } catch {
    return { UNIT_ERROR: `no json: ${(r.stdout ?? "").slice(0, 200)}` };
  }
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
      id: CONN, name: "QA t354", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t354 iteration sheets", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");

  // ======================================================================
  console.log("== PHASE A: UNIT — the sheet renderer + the local leg's stacks ==");
  const tmp = path.join(ROOT, "data", "qa-t354-tmp");
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  // a 6-class stack, 64px box, three DISTINCT class fields per slice
  writeFileSync(path.join(tmp, "run_it002_classes.mrcs"), mrcBuffer(64, 64, 6, 77));
  // the mirror leg: data star + a plain AND an unmasked stack for it 005
  writeFileSync(path.join(tmp, "run_it005_data.star"), "data_particles\n\nloop_\n_rlnImageName #1\n_rlnClassNumber #2\n0@x.mrcs 1\n0@x.mrcs 2\n");
  writeFileSync(path.join(tmp, "run_it005_classes.mrcs"), mrcBuffer(64, 64, 6, 11));
  writeFileSync(path.join(tmp, "run_it005_unmasked_classes.mrcs"), mrcBuffer(64, 64, 6, 12));

  const sheetUnit = unit(`
    const mrc = await import(${JSON.stringify(path.join(ROOT, "src/lib/mrc.ts"))});
    const r = await mrc.renderClassSheetPng(${JSON.stringify(path.join(tmp, "run_it002_classes.mrcs"))});
    console.log(JSON.stringify({ ok: !!r, magic: r ? [r.png[0], r.png[1], r.png[2], r.png[3]] : null, bytes: r ? r.png.length : 0, rendered: r?.rendered, total: r?.total }));
  `);
  must(sheetUnit.ok === true, `renderClassSheetPng renders (${JSON.stringify(sheetUnit).slice(0, 120)})`);
  must(
    Array.isArray(sheetUnit.magic) && sheetUnit.magic[0] === 0x89 && sheetUnit.magic[1] === 0x50,
    `the sheet is a PNG (magic ${JSON.stringify(sheetUnit.magic)})`
  );
  must(sheetUnit.rendered === 6 && sheetUnit.total === 6, `all 6 classes render (${sheetUnit.rendered}/${sheetUnit.total})`);
  must(sheetUnit.bytes > 500, `the sheet has real content (${sheetUnit.bytes} bytes)`);

  const localUnit = unit(`
    const live = await import(${JSON.stringify(path.join(ROOT, "src/lib/remote/iteration-live.ts"))});
    const p = live.localIterations(${JSON.stringify(tmp)});
    console.log(JSON.stringify({ stacks: p.stacks, iters: p.iterations, classes: p.classes.map(c => c.cls), classesFile: p.classesFile }));
  `);
  must(
    Array.isArray(localUnit.stacks) && localUnit.stacks.length === 2 &&
      localUnit.stacks[0].iter === 2 && localUnit.stacks[1].iter === 5,
    `localIterations lists both mirror rounds ascending (${JSON.stringify(localUnit.stacks)})`
  );
  must(
    localUnit.stacks?.[1]?.file === "run_it005_unmasked_classes.mrcs",
    `the unmasked variant wins the same-iteration tie (${localUnit.stacks?.[1]?.file})`
  );
  must(
    Array.isArray(localUnit.classes) && localUnit.classes.length === 2,
    `occupancy counts from the newest data star (${JSON.stringify(localUnit.classes)})`
  );

  // cache-only leg: workdir gone, preview cache holds one round
  const cacheJobId = "qa-t354-cacheonly";
  const cacheDir = path.join(PREVIEW_LIVE, cacheJobId, "run_it009_classes");
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path.join(cacheDir, "sheet.png"), mrcBuffer(2, 2, 1, 1)); // content irrelevant — the dir is the marker
  const cacheUnit = unit(`
    const live = await import(${JSON.stringify(path.join(ROOT, "src/lib/remote/iteration-live.ts"))});
    const p = live.localIterations(${JSON.stringify(path.join(tmp, "definitely-missing"))}, ${JSON.stringify(cacheJobId)});
    console.log(JSON.stringify({ stacks: p.stacks, classes: p.classes.length }));
  `);
  must(
    cacheUnit.stacks?.length === 1 && cacheUnit.stacks[0].iter === 9 && cacheUnit.stacks[0].file === "run_it009_classes.mrcs",
    `a missing mirror still lists the cached round (${JSON.stringify(cacheUnit.stacks)})`
  );
  must(cacheUnit.classes === 0, "the cache-only leg invents NO occupancy (honest shape)");
  rmSync(path.join(PREVIEW_LIVE, cacheJobId), { recursive: true, force: true });

  // ======================================================================
  console.log("== PHASE B: LIVE — a mock-cluster class2d answers sheets while it runs ==");
  // the t319 recipe: a header-only stack + a 24-row particles star on the
  // mock, imported through a real import job
  const stackB64 = (() => {
    const data = Buffer.alloc(1024);
    data.writeInt32LE(48, 0); data.writeInt32LE(48, 4); data.writeInt32LE(24, 8); data.writeInt32LE(2, 12);
    return data.toString("base64");
  })();
  const fx = client(
    "mkdir -p /data2/t354-particles; " +
      `echo ${stackB64} | base64 -d > /data2/t354-particles/stack24.mrcs; ` +
      "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t354-particles/particles.star; " +
      "for i in $(seq 1 24); do printf '%d@/data2/t354-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t354-particles/particles.star; done"
  );
  must(fx === "", `the particles fixtures build quietly (${fx.slice(0, 120)})`);

  const importParts = await mkJob({
    projectId, type: "import", name: "QA t354 particles import",
    params: { micrographsPath: "/data2/t354-particles/particles.star", nodeType: "particles" },
  });
  must(!!importParts?.id, "the particles import creates");
  const runParts = await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runParts.status >= 200 && runParts.status < 300, `the particles import accepts (${runParts.status})`);
  const doneParts = await awaitTerminal(importParts.id, 60_000);
  must(doneParts?.status === "completed", `the particles import completes (${doneParts?.status})`);

  const clsJob = await mkJob({
    projectId, type: "class2d", name: "QA t354 class2d sheets",
    params: { iterations: 8, numClasses: 3 },
  });
  must(!!clsJob?.id, "the class2d job creates");
  const edge = await api("/api/edges", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ fromJobId: importParts.id, toJobId: clsJob.id, fromPort: "particles", toPort: "particles" }),
  });
  must(edge.status === 200 || edge.status === 201, `the particles edge wires import → class2d (${edge.status})`);

  const dispatch = await api(`/api/jobs/${clsJob.id}/run`, {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
  });
  must(dispatch.status >= 200 && dispatch.status < 300, `the class2d dispatch answers (${dispatch.status})`);
  must(!dispatch.body?.error, `the class2d dispatch is ACCEPTED (${String(dispatch.body?.error ?? "").slice(0, 100)})`);

  // poll the live payload until at least one round lands (or the job ends).
  // refresh=1 bypasses the 12s TTL cache — a short mock run would otherwise
  // finish inside the cache window and the poll would never see a stack
  let liveStacksSeen = 0;
  let livePayload = null;
  const liveDeadline = Date.now() + 120_000;
  while (Date.now() < liveDeadline) {
    const j = await jobById(clsJob.id);
    if (j && j.status !== "running" && j.status !== "pending") break;
    const { body } = await api(`/api/jobs/${clsJob.id}/iterations?refresh=1`, { headers: SH });
    livePayload = body;
    if (Array.isArray(body?.stacks) && body.stacks.length > liveStacksSeen) {
      liveStacksSeen = body.stacks.length;
      break; // the first round is all we need mid-run
    }
    await sleep(500);
  }
  must(liveStacksSeen >= 1, `the LIVE payload lists at least one round while running (${liveStacksSeen})`);
  must(
    Array.isArray(livePayload?.stacks) && /^run_it\d{3}_classes\.mrcs$/.test(livePayload.stacks[0]?.file ?? ""),
    `the live chip names follow the RELION law (${livePayload?.stacks?.[0]?.file})`
  );

  // the OLDEST round is long-complete on disk — its sheet must serve mid-run
  let liveSheetOk = false;
  let liveSheetStatus = 0;
  if (liveStacksSeen >= 1 && livePayload?.stacks?.[0]?.file) {
    const firstFile = livePayload.stacks[0].file;
    const r = await fetch(`${BASE}/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent(firstFile)}`, { headers: SH });
    liveSheetStatus = r.status;
    const buf = Buffer.from(await r.arrayBuffer());
    liveSheetOk = r.status === 200 && isPng(buf);
    // t350 regression: the per-slice route answers alongside the sheet
    const s = await fetch(`${BASE}/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent(firstFile)}&slice=0`, { headers: SH });
    const sbuf = Buffer.from(await s.arrayBuffer());
    must(s.status === 200 && isPng(sbuf), `the t350 slice route still answers mid-run (${s.status})`);
  }
  must(liveSheetOk, `the FIRST round's sheet serves WHILE the job runs (${liveSheetStatus})`);

  const done = await awaitTerminal(clsJob.id, 150_000);
  must(done?.status === "completed", `the class2d completes (${done?.status}: ${String(done?.result ?? "").slice(0, 90)})`);

  // ======================================================================
  console.log("== PHASE C: AFTER — every round one image, chips, cache, re-pull ==");
  const after = await api(`/api/jobs/${clsJob.id}/iterations`, { headers: SH });
  const ap = after.body;
  must(after.status === 200 && Array.isArray(ap?.stacks), "the completed job's iterations payload answers");
  must(ap?.stacks?.length === 8, `all 8 rounds have chips (${ap?.stacks?.length}: ${JSON.stringify(ap?.stacks?.map((s) => s.file))})`);
  must(
    ap?.stacks?.every((s, i) => s.iter === i + 1),
    `the chips ascend it 001..008 (${JSON.stringify(ap?.stacks?.map((s) => s.iter))})`
  );

  // every round's sheet serves (the mirror holds the small stacks here)
  for (const s of ap?.stacks ?? []) {
    const r = await fetch(`${BASE}/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent(s.file)}`, { headers: SH });
    const buf = Buffer.from(await r.arrayBuffer());
    must(r.status === 200 && isPng(buf), `round it ${String(s.iter).padStart(3, "0")}'s sheet serves (${r.status}, ${buf.length}B)`);
  }

  // the slimming contract: the MB-scale stack never stays in the preview dir
  const previewJobDir = path.join(PREVIEW_LIVE, clsJob.id);
  const transient = existsSync(previewJobDir)
    ? readdirSync(previewJobDir, { recursive: true }).filter((f) => String(f).includes(".stack.mrcs"))
    : [];
  must(transient.length === 0, `no transient .stack.mrcs survives in the preview cache (${transient.join(", ")})`);
  const sheetFiles = existsSync(previewJobDir)
    ? readdirSync(previewJobDir).filter((d) => existsSync(path.join(previewJobDir, String(d), "sheet.png")))
    : [];
  must(sheetFiles.length >= 1, `rendered sheets persist in the cache (${sheetFiles.length} round(s))`);

  // ---- the cold-restart story: mirror stacks gone (real world: >16MB
  // key-cap keeps them on the cluster) + preview cache wiped -----------
  const mirror = path.join(DATA_DIR, "relion", projectId, `class2d_${clsJob.id.slice(-8)}`);
  const mirrorStacks = existsSync(mirror)
    ? readdirSync(mirror).filter((f) => /^run_it\d{3}_.*classes\.mrcs$/.test(f))
    : [];
  const removed = mirrorStacks.map((f) => { rmSync(path.join(mirror, f)); return f; });
  console.log(`  (mirror stacks removed to simulate the >key-cap world: ${removed.join(", ") || "none were present"})`);
  rmSync(previewJobDir, { recursive: true, force: true });

  const cold = await api(`/api/jobs/${clsJob.id}/iterations`, { headers: SH });
  const cp = cold.body;
  must(
    Array.isArray(cp?.stacks) && cp.stacks.length === 8,
    `the COLD payload still lists all 8 chips — synthesis from the data stars (${cp?.stacks?.length})`
  );
  must(
    cp?.stacks?.every((s) => s.file === `run_it${String(s.iter).padStart(3, "0")}_classes.mrcs`),
    `the synthesized chips follow the naming law (${JSON.stringify(cp?.stacks?.map((s) => s.file))})`
  );

  // the last round was never pulled — its sheet must RE-PULL from the cluster
  const lastFile = cp?.stacks?.[cp.stacks.length - 1]?.file;
  const rr = await fetch(`${BASE}/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent(lastFile)}`, { headers: SH });
  const rbuf = Buffer.from(await rr.arrayBuffer());
  must(rr.status === 200 && isPng(rbuf), `the cold-cache round RE-PULLS its sheet from the cluster (${rr.status}, ${rbuf.length}B)`);
  const repulledSheet = path.join(previewJobDir, `run_it${String(cp.stacks[cp.stacks.length - 1].iter).padStart(3, "0")}_classes`, "sheet.png");
  must(existsSync(repulledSheet) && statSync(repulledSheet).size > 0, "the re-pulled sheet lands in the cache for next time");

  // an honest 404 for a round that never existed
  const nf = await fetch(`${BASE}/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it099_classes.mrcs")}`, { headers: SH });
  must(nf.status === 404 || nf.status === 200 === false, `a never-existed round answers an honest error (${nf.status})`);

  // the containment dialect: ../ and absolute names refuse
  const bad = await fetch(`${BASE}/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("../../etc/passwd")}`, { headers: SH });
  must(bad.status === 400, `a path-escape name refuses (${bad.status})`);
} catch (e) {
  console.error("DIAG t354 crashed:", e);
  fail++;
} finally {
  console.log("== CLEANUP ==");
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
  client("rm -rf /data2/t354-particles");
  rmSync(path.join(ROOT, "data", "qa-t354-tmp"), { recursive: true, force: true });
  console.log(fail === 0 ? "\nDIAG t354: ALL GREEN" : `\nDIAG t354: ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}
