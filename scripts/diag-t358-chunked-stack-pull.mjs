/**
 * DIAG t358 — the CHUNKED, byte-verified stack pull + the honest refusal.
 *
 * The field report after t357 (both galleries still dark on the REAL
 * cluster, "could not load the sheet for iteration 020 — the stack may
 * exist on the cluster"): a real 20-round run writes 25–100 MB
 * class-average stacks, and the whole-file `cat` of that size is exactly
 * the t298 loss shape — the receive side silently drops megabytes with
 * exit=0, a loss that is SIZE-DEPENDENT, so three whole-file retries
 * re-roll the same losing dice. Every refusal also collapsed into ONE
 * opaque 404 while the server knew which link broke.
 *
 * This suite reproduces that wire on the mock cluster (the new
 * `cat-drop-bytes` lever: transfers ≥ N bytes lose M bytes mid-stream,
 * exit still 0) and proves:
 *
 *   A. CLEAN WIRE — a full class2d run's stacks still render through the
 *      chunked puller (the t356 pipeline contract holds).
 *   B. THE LOSSY WIRE, BEFORE/AFTER — a 16 MB stack on a wire that drops
 *      1.5 MB from every transfer ≥ 12 MB: the LEGACY whole-file lane
 *      (/outputs/file, the t357 shape) is refused honestly (502, "came
 *      up short"), while the CHUNKED lane (sheet/image routes, 8 MB
 *      chunks under the loss threshold) pulls byte-exact and renders.
 *   C. PER-CHUNK RETRY — a one-shot mid-chunk drop (maxFires=1) is
 *      recovered by that chunk's re-transfer alone.
 *   D. HONEST REFUSAL — a wire that drops EVERY chunk transfer (999
 *      fires) yields 404 { reason: "truncated", … } on both routes and a
 *      renderError on the /iterations payload; no transient partial
 *      survives.
 *   E. THE OTHER REASONS — a missing stack answers "missing"; a 300 MB
 *      sparse stack answers "over-cap" with its size named; a complete
 *      download of garbage bytes answers "unreadable".
 *   F. RECOVERY — the wire heals (lever disarmed), the same stack pulls
 *      and renders.
 *
 * The mock cluster (:3022) and the dev server must both be up.
 * CF_ROOT / CF_BASE override the defaults (the sandbox convention).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/my-project";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const CONN = "qa-t358";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const DATA_DIR = path.join(ROOT, "data");
const PREVIEW_LIVE = path.join(DATA_DIR, "remote-preview", "live");
const MOCK_HOME = path.join(ROOT, "services/mock-cluster/fs/home/cryo");
const LEVER = path.join(MOCK_HOME, ".slurm");

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 120_000,
  }).stdout?.trim() ?? "";
/** write a file on the mock cluster's fs DIRECTLY (host path, no SSH) */
const plant = (hostPath, content) => {
  const sh = `cat > ${JSON.stringify(hostPath)} <<'CFEOF'\n${content}\nCFEOF\n`;
  const r = spawnSync("bash", ["-c", sh], { cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  return r.status === 0;
};
const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};
const raw = async (url) => {
  const r = await fetch(`${BASE}${url}`, { headers: SH });
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get("content-type") ?? "";
  let body = null;
  if (ct.includes("json")) {
    try {
      body = JSON.parse(buf.toString("utf8"));
    } catch {
      body = null;
    }
  }
  return { status: r.status, buf, body };
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
const renderedRounds = (jobId) => {
  const dir = path.join(PREVIEW_LIVE, jobId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => {
    if (n.startsWith(".")) return false;
    const inner = path.join(dir, n);
    try {
      if (!statSync(inner).isDirectory()) return false;
      const files = readdirSync(inner);
      return (files.includes(".done") || files.includes("sheet.png")) &&
        files.some((f) => /^slice\d{4}\.png$/.test(f));
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
const armLever = (spec) => plant(path.join(LEVER, "cat-drop-bytes"), spec);
const disarmLever = () => {
  rmSync(path.join(LEVER, "cat-drop-bytes"), { force: true });
  rmSync(`${path.join(LEVER, "cat-drop-bytes")}.fires`, { force: true });
};
const leverWitnesses = () => {
  try {
    return readFileSync(path.join(LEVER, "cat-lever.log"), "utf8")
      .split("\n")
      .filter((l) => l.includes("drop "))
      .filter((l) => l.includes("run_it006"));
  } catch {
    return [];
  }
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
/** wait until the mock's exec audit stops growing — the view-trigger
 * pipeline's chunk transfers (and any probe) each land a line there, so
 * "quiet" means no pull is in flight (the F-phase wipe must not race a
 * doomed background pull — the first run's exact failure). */
const awaitWireQuiet = async (quietMs = 1300, deadlineMs = 20_000) => {
  const audit = path.join(LEVER, "exec-audit.log");
  let lastSize = -1;
  let stableSince = Date.now();
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    let size = -1;
    try {
      size = statSync(audit).size;
    } catch {
      /* no audit yet — nothing ran */
    }
    if (size !== lastSize) {
      lastSize = size;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= quietMs) {
      return true;
    }
    await sleep(200);
  }
  return false;
};

// the BIG stack: 512×512×16 float32 = 16 MiB + 1 KiB header — three chunks
// (8 MiB + 8 MiB + 9 KiB), each UNDER the 12 MiB loss threshold of phase B
const BIG_NX = 512, BIG_NY = 512, BIG_NZ = 16;
const BIG_DATA = BIG_NX * BIG_NY * BIG_NZ * 4;
const BIG_SIZE = 1024 + BIG_DATA;
const bigHeaderB64 = (() => {
  const b = Buffer.alloc(1024);
  b.writeInt32LE(BIG_NX, 0); b.writeInt32LE(BIG_NY, 4); b.writeInt32LE(BIG_NZ, 8);
  b.writeInt32LE(2, 12); // mode 2 — float32
  b.writeFloatLE(BIG_NX * 1.0, 40); b.writeFloatLE(BIG_NY * 1.0, 44); b.writeFloatLE(BIG_NZ * 1.0, 48);
  return b.toString("base64");
})();

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

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the dev server answers on :3000");
  must(await mockListening(), "the mock cluster answers on :3022");
  disarmLever();

  const mk = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN, name: "QA t358", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "QA t358 chunked pull", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");

  // ======================================================================
  console.log("== PHASE A: clean wire — a full class2d renders through the chunked puller ==");
  const stackB64 = (() => {
    const data = Buffer.alloc(1024);
    data.writeInt32LE(48, 0); data.writeInt32LE(48, 4); data.writeInt32LE(24, 8); data.writeInt32LE(2, 12);
    return data.toString("base64");
  })();
  const fx = client(
    "mkdir -p /data2/t358-particles; " +
      `echo ${stackB64} | base64 -d > /data2/t358-particles/stack24.mrcs; ` +
      "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t358-particles/particles.star; " +
      "for i in $(seq 1 24); do printf '%d@/data2/t358-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t358-particles/particles.star; done"
  );
  must(fx === "", `the particles fixtures build quietly (${fx.slice(0, 120)})`);

  const importParts = await mkJob({
    projectId, type: "import", name: "QA t358 particles import",
    params: { micrographsPath: "/data2/t358-particles/particles.star", nodeType: "particles" },
  });
  must(!!importParts?.id, "the particles import creates");
  const runParts = await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runParts.status >= 200 && runParts.status < 300, `the particles import accepts (${runParts.status})`);
  const doneParts = await awaitTerminal(importParts.id, 60_000);
  must(doneParts?.status === "completed", `the particles import completes (${doneParts?.status})`);

  const clsJob = await mkJob({
    projectId, type: "class2d", name: "QA t358 class2d chunked",
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
  const done = await awaitTerminal(clsJob.id, 150_000);
  must(done?.status === "completed", `the class2d completes (${done?.status}: ${String(done?.result ?? "").slice(0, 90)})`);
  if (done?.status !== "completed") throw new Error("class2d did not complete — the rest of the suite is meaningless");
  must(
    await awaitRendered(clsJob.id, 6, 30_000),
    `the finalize pipeline renders all 6 rounds through the CHUNKED puller (${renderedRounds(clsJob.id).length})`
  );

  const mirror = path.join(DATA_DIR, "relion", projectId, `class2d_${clsJob.id.slice(-8)}`);
  const wd = `/projects/cryoflow/${projectId}/class2d_${clsJob.id.slice(-8)}`;
  const previewDir = path.join(PREVIEW_LIVE, clsJob.id);

  // ======================================================================
  console.log("== PHASE B: the lossy wire — 16 MiB stack, transfers ≥ 12 MiB lose 1.5 MiB ==");
  // the mock's run wrote its own small run_it006 stack; REPLACE it with the
  // BIG one (header + sparse grow — valid MRC, zeros render gray), delete
  // the mirror's copy and the local render of that round: the cluster is
  // now the only source, exactly the field report's world.
  client(`echo ${bigHeaderB64} | base64 -d > ${wd}/run_it006_classes.mrcs && truncate -s ${BIG_SIZE} ${wd}/run_it006_classes.mrcs`);
  must(
    client(`test \$(stat -c %s ${wd}/run_it006_classes.mrcs) = ${BIG_SIZE} && echo ok`).includes("ok"),
    `the BIG stack lands on the cluster (${(BIG_SIZE / 1024 / 1024).toFixed(1)} MiB, ${BIG_NZ} slices)`
  );
  for (const f of readdirSync(mirror).filter((f) => /classes\.mrcs?$/i.test(f))) {
    rmSync(path.join(mirror, f));
  }
  rmSync(path.join(previewDir, "run_it006_classes"), { recursive: true, force: true });

  // arm the lossy wire: ≥ 12 MiB transfers lose 1.5 MiB mid-stream (exit 0)
  armLever(`run_it006_classes ${12 * 1024 * 1024} ${1.5 * 1024 * 1024}`);
  const dropCount = () => leverWitnesses().length;

  // B1 — the LEGACY whole-file lane (the t357 shape) is refused honestly:
  // /outputs/file lazy-fetches with whole-file cats, every one truncated
  const legacy = await api(
    `/api/jobs/${clsJob.id}/outputs/file?path=${encodeURIComponent("run_it006_classes.mrcs")}&format=png&montage=0&slice=0`,
    { headers: SH }
  );
  must(
    legacy.status === 502,
    `the legacy whole-file lane REFUSES on the lossy wire (HTTP ${legacy.status}: ${String(legacy.body?.error ?? "").slice(0, 90)}) — the t357 field shape`
  );
  must(
    dropCount() >= 1,
    `the drop lever actually BIT the whole-file cat (${dropCount()} witness line(s))`
  );

  // B2 — the CHUNKED lane (8 MiB chunks, under the threshold) pulls clean
  const sheetB = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it006_classes.mrcs")}`);
  must(sheetB.status === 200 && isPng(sheetB.buf), `the CHUNKED sheet pulls byte-exact through the lossy wire (${sheetB.status}, ${sheetB.buf.length}B)`);
  const sliceB = await raw(`/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent("run_it006_classes.mrcs")}&slice=15`);
  must(sliceB.status === 200 && isPng(sliceB.buf), `slice 15 of 16 renders (${sliceB.status}) — the whole stack arrived, not a prefix`);
  const roundFiles = readdirSync(path.join(previewDir, "run_it006_classes"));
  must(
    roundFiles.filter((f) => /^slice\d{4}\.png$/.test(f)).length === BIG_NZ,
    `every one of the ${BIG_NZ} slices rendered locally`
  );
  must(!roundFiles.includes(".stack.mrcs"), "no transient .stack.mrcs survives (the slimming contract)");
  const slice0 = await raw(`/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent("run_it006_classes.mrcs")}&slice=0`);
  must(slice0.status === 200 && isPng(slice0.buf), `slice 0 serves from the cache (${slice0.status})`);

  // ======================================================================
  console.log("== PHASE C: per-chunk retry — a ONE-SHOT mid-chunk drop recovers ==");
  rmSync(path.join(previewDir, "run_it006_classes"), { recursive: true, force: true });
  disarmLever();
  // every transfer ≥ 1 byte loses 64 KiB, but ONLY ONCE: chunk k's first
  // attempt truncates, its re-transfer is clean, the rest of the file
  // never re-pays. The old whole-file code burned an entire 3-attempt
  // budget on one flake; the chunked puller pays ONE CHUNK.
  armLever("run_it006_classes 1 65536 1");
  const sheetC = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it006_classes.mrcs")}`);
  must(sheetC.status === 200 && isPng(sheetC.buf), `a mid-chunk drop is recovered by the chunk's own retry (${sheetC.status})`);
  const fires = (() => {
    try {
      return Number(readFileSync(path.join(LEVER, "cat-drop-bytes.fires"), "utf8").trim());
    } catch {
      return -1;
    }
  })();
  must(fires === 1, `the lever fired EXACTLY once (fires=${fires}) — one chunk re-paid, not the file`);
  must(
    readdirSync(path.join(previewDir, "run_it006_classes")).filter((f) => /^slice\d{4}\.png$/.test(f)).length === BIG_NZ,
    "all 16 slices rendered after the recovery"
  );

  // ======================================================================
  console.log("== PHASE D: the hostile wire — EVERY chunk transfer truncated ==");
  rmSync(path.join(previewDir, "run_it006_classes"), { recursive: true, force: true });
  disarmLever();
  armLever(`run_it006_classes 1 65536 999`);
  const sheetD = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it006_classes.mrcs")}`);
  must(sheetD.status === 404, `the sheet answers 404 on a dead wire (${sheetD.status})`);
  must(
    sheetD.body?.reason === "truncated" && /truncated 3× in a row/.test(String(sheetD.body?.error ?? "")),
    `the 404 NAMES the truncation honestly (reason=${sheetD.body?.reason}: ${String(sheetD.body?.error ?? "").slice(0, 110)}…)`
  );
  const imgD = await raw(`/api/jobs/${clsJob.id}/iterations/image?file=${encodeURIComponent("run_it006_classes.mrcs")}&slice=0`);
  must(
    imgD.status === 404 && imgD.body?.reason === "truncated",
    `the image route speaks the same verdict (${imgD.status}, reason=${imgD.body?.reason})`
  );
  const itD = await api(`/api/jobs/${clsJob.id}/iterations?refresh=1`, { headers: SH });
  must(
    /truncated 3× in a row/.test(String(itD.body?.renderError ?? "")),
    `the /iterations payload carries the refusal note for the gallery (classesFile=${itD.body?.classesFile}, newest=${itD.body?.stacks?.[itD.body.stacks.length - 1]?.file}: ${String(itD.body?.renderError ?? "").slice(0, 90)}…)`
  );
  must(
    !existsSync(path.join(previewDir, "run_it006_classes", ".stack.mrcs")),
    "no truncated partial survives on disk"
  );
  // the view trigger (inside itD's GET) fires a background pipeline whose
  // doomed chunk retries may still be on the wire — let them drain before
  // the E/F phases race a wipe against them
  must(await awaitWireQuiet(), "the wire goes quiet after the doomed pipeline retries");

  // ======================================================================
  console.log("== PHASE E: the other honest reasons ==");
  const missing = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it099_classes.mrcs")}`);
  must(
    missing.status === 404 && missing.body?.reason === "missing",
    `a never-existed round answers reason=missing (${missing.status}, ${missing.body?.reason})`
  );
  // a 300 MB sparse stack: over the 256 MB on-demand cap, named in the message
  client(
    `echo ${bigHeaderB64} | base64 -d > ${wd}/run_it098_classes.mrcs && truncate -s ${300 * 1024 * 1024} ${wd}/run_it098_classes.mrcs`
  );
  const overCap = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it098_classes.mrcs")}`);
  must(
    overCap.status === 404 && overCap.body?.reason === "over-cap" && /300 MB/.test(String(overCap.body?.error ?? "")),
    `a 300 MB stack answers reason=over-cap with its size named (${overCap.body?.reason}: ${String(overCap.body?.error ?? "").slice(0, 100)})`
  );
  // complete bytes that are not an MRC: nx=99999 refuses the header parse
  const garbageB64 = (() => {
    const b = Buffer.alloc(8192);
    b.writeInt32LE(99999, 0); b.writeInt32LE(48, 4); b.writeInt32LE(3, 8); b.writeInt32LE(2, 12);
    return b.toString("base64");
  })();
  client(`echo ${garbageB64} | base64 -d > ${wd}/run_it097_classes.mrcs`);
  const unreadable = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it097_classes.mrcs")}`);
  must(
    unreadable.status === 404 && unreadable.body?.reason === "unreadable",
    `garbage bytes answer reason=unreadable (${unreadable.body?.reason}: ${String(unreadable.body?.error ?? "").slice(0, 100)})`
  );
  client(`rm -f ${wd}/run_it098_classes.mrcs ${wd}/run_it097_classes.mrcs`);

  // ======================================================================
  console.log("== PHASE F: the wire heals — the same stack pulls and renders ==");
  disarmLever();
  await awaitWireQuiet();
  rmSync(path.join(previewDir, "run_it006_classes"), { recursive: true, force: true });
  const sheetF = await raw(`/api/jobs/${clsJob.id}/iterations/sheet?file=${encodeURIComponent("run_it006_classes.mrcs")}`);
  must(
    sheetF.status === 200 && isPng(sheetF.buf),
    `the healed wire serves the big stack again (${sheetF.status}${sheetF.body != null ? ` — ${String(sheetF.body?.error ?? "").slice(0, 120)}` : ""})`
  );
  const clsF = await api(`/api/jobs/${clsJob.id}/classes`, { headers: SH });
  must(
    clsF.status === 200 && clsF.body?.classesFile === "run_it006_classes.mrcs" && clsF.body?.renderError == null,
    `the select gallery's feed names the stack with NO refusal note (classesFile=${clsF.body?.classesFile}, renderError=${clsF.body?.renderError ?? "absent"})`
  );
  const allFiles = readdirSync(previewDir, { recursive: true }).map(String);
  must(!allFiles.some((f) => f.includes(".stack.mrcs")), "no transient stack anywhere in the cache");
} catch (e) {
  console.error("DIAG t358 crashed:", e);
  fail++;
} finally {
  console.log("== CLEANUP ==");
  disarmLever();
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
  if (projectId) {
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  client("rm -rf /data2/t358-particles");
  console.log(fail === 0 ? "\nDIAG t358: ALL GREEN" : `\nDIAG t358: ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
}
