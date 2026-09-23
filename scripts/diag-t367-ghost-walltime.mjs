/**
 * DIAG t367 — the ghost + the walltime, the field report's whole story:
 *
 *   「2d分类我重新跑了，还是无法在ui中显示结果的图片」+ attachments:
 *   a run.out whose 20 iterations all completed under ONE MPI universe
 *   (t360's fix live) but whose log ends exactly at iteration 20's write
 *   phase, and a run_it020_classes.mrcs that is right-sized (2,001,024 B),
 *   zero-header, zeros everywhere except a 2,176-byte tail fragment — the
 *   pre-t360 multi-writer leftover, NOT this run's product.
 *
 * The three fixes this diag proves:
 *
 *   walls  — the sbatch script now carries an explicit #SBATCH --time
 *            (auto: the refinement family asks the partition's own MaxTime
 *            at submit time, clamped to 24h; explicit connection setting
 *            wins verbatim) + a CRYOFLOW_WALLTIME receipt banner in run.out.
 *            The partition default once killed a ~2h04 run exactly at its
 *            final write phase with zero explanation in the log.
 *   ghost  — the sync-back GENERATION GATE: a leftover that predates the
 *            dispatch (the pre-run wipe's silent degrade) is never adopted
 *            as this run's output — the receipt names it, the mirror
 *            refuses it, and the on-demand pull answers with the honest
 *            corrupt-on-cluster verdict instead of "could not render".
 *   heal   — the MIRROR SELF-HEAL: a corrupt local copy of a stack the
 *            cluster holds healthy is re-rendered through the remote leg
 *            (image route), healed in place (the mirror copy overwritten
 *            with fresh bytes), and the download door re-pulls it instead
 *            of streaming the ghost's zeros.
 *
 * Modes (state rides /tmp/t367-state.json):
 *   stage | walls | ghost | heal | cleanup
 *
 * The mock cluster (:3022) and the dev server must both be up.
 * CF_ROOT / CF_BASE override the defaults.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3005";
const CONN = "qa-t367";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const STATE_FILE = "/tmp/t367-state.json";
const ITERS = 3; // mock rounds; it004 is the "never written by this run" round
const NUM_CLASSES = 4;
const MOCK_STACK_BYTES = 1024 + NUM_CLASSES * 64 * 64 * 4; // 66,560

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
const isPng = (buf) =>
  buf != null && buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
const loadState = () => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {});
const saveState = (s) => writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
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
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  return b?.job;
};
/** the mock-side workdir of a job, found by its unique id8 inside the
 * sbatch script's --job-name (the script lives at <workdir>/.cf-sbatch.sh). */
const mockWorkdirOf = (jobId) => {
  const tag = `cf_class2d_${jobId.slice(-8)}`;
  const listing = client(
    `grep -l ${JSON.stringify(tag)} $(find /projects/cryoflow -name .cf-sbatch.sh 2>/dev/null) 2>/dev/null | head -1`
  );
  if (!listing) return null;
  return listing.replace(/\/.cf-sbatch\.sh$/, "");
};

const mode = process.argv[2] ?? "stage";

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
  if (mode === "stage") {
    console.log("== t367 STAGE: the re-ran-2D world ==");
    must((await api("/api/jobs", { headers: SH })).status === 200, "the dev server answers");
    must(await mockListening(), "the mock cluster answers on :3022");

    const mk = await api("/api/remote/connections", {
      method: "POST", headers: SHJ,
      body: JSON.stringify({
        id: CONN, name: "QA t367", host: "127.0.0.1", port: 3022,
        username: "cryo", password: "demo", authMethod: "password",
        remoteRoot: "/projects/cryoflow",
        useSlurm: true,
        // t367 — a partition the mock's sinfo caps at 8:00:00: the auto
        // --time leg must ask exactly that (the field report's partition
        // default was 2h; the mock's MaxTime stands in for it)
        slurmPartition: "brain",
      }),
    });
    must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

    const proj = await api("/api/projects", {
      method: "POST", headers: SHJ,
      body: JSON.stringify({ name: "QA t367 ghost walltime", mode: "remote", remoteConnectionId: CONN }),
    });
    must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
    const projectId = proj.body?.project?.id;
    const sw = await api("/api/projects/switch", {
      method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }),
    });
    must(sw.status === 200, `the project activates (${sw.status})`);

    // particles fixture ON the cluster (the t363 recipe)
    const stackB64 = (() => {
      const data = Buffer.alloc(1024);
      data.writeInt32LE(48, 0); data.writeInt32LE(48, 4); data.writeInt32LE(24, 8); data.writeInt32LE(2, 12);
      return data.toString("base64");
    })();
    const fx = client(
      "mkdir -p /data2/t367-particles; " +
        `echo ${stackB64} | base64 -d > /data2/t367-particles/stack24.mrcs; ` +
        "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t367-particles/particles.star; " +
        "for i in $(seq 1 24); do printf '%d@/data2/t367-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t367-particles/particles.star; done"
    );
    must(fx === "", `the particles fixtures build quietly (${fx.slice(0, 120)})`);

    const importParts = await mkJob({
      projectId, type: "import", name: "QA t367 particles import",
      params: { micrographsPath: "/data2/t367-particles/particles.star", nodeType: "particles" },
    });
    const runParts = await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
    must(runParts.status >= 200 && runParts.status < 300, `the particles import accepts (${runParts.status})`);
    const doneParts = await awaitTerminal(importParts.id, 60_000);
    must(doneParts?.status === "completed", `the particles import completes (${doneParts?.status})`);

    const wire = async (name) => {
      const j = await mkJob({
        projectId, type: "class2d", name,
        params: { iterations: ITERS, numClasses: NUM_CLASSES },
      });
      const edge = await api("/api/edges", {
        method: "POST", headers: SH,
        body: JSON.stringify({ fromJobId: importParts.id, toJobId: j.id, fromPort: "particles", toPort: "particles" }),
      });
      must(edge.status === 200 || edge.status === 201, `the particles edge wires → ${name} (${edge.status})`);
      return j;
    };
    const wallsAuto = await wire("QA t367 walls auto");
    const wallsOverride = await wire("QA t367 walls override");
    const ghost = await wire("QA t367 ghost");
    must(!!wallsAuto?.id && !!wallsOverride?.id && !!ghost?.id, "the three class2d jobs create idle");

    saveState({ projectId, conn: CONN, wallsAutoId: wallsAuto.id, wallsOverrideId: wallsOverride.id, ghostId: ghost.id });
    console.log(`  staged: project=${projectId} wallsAuto=${wallsAuto.id} wallsOverride=${wallsOverride.id} ghost=${ghost.id}`);
  } else if (mode === "walls") {
    const st = loadState();
    console.log("== t367 WALLS: the sbatch asks for a walltime it can name ==");

    // 1. AUTO — the refinement family asks the partition's own MaxTime
    const dispatchA = await api(`/api/jobs/${st.wallsAutoId}/run`, {
      method: "POST", headers: SHJ,
      body: JSON.stringify({ remote: { connectionId: st.conn, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
    });
    must(dispatchA.status >= 200 && dispatchA.status < 300, `the auto dispatch answers (${dispatchA.status})`);
    let wd = null;
    for (let i = 0; i < 10 && !wd; i++) {
      await sleep(700);
      wd = mockWorkdirOf(st.wallsAutoId);
    }
    must(!!wd, `the auto dispatch's workdir is findable on the cluster (${wd ?? "?"})`);
    const scriptA = wd ? client(`cat ${JSON.stringify(`${wd}/.cf-sbatch.sh`)}`) : "";
    must(/#SBATCH --time=08:00:00/.test(scriptA), "the script requests --time=08:00:00 (brain's own MaxTime, auto leg)");
    must(/CRYOFLOW_WALLTIME: this submission requested --time=08:00:00/.test(scriptA), "the walltime receipt banner rides the script");
    const doneA = await awaitTerminal(st.wallsAutoId, 120_000);
    must(doneA?.status === "completed", `the auto run completes (${doneA?.status})`);
    const runOutA = wd ? client(`grep -c CRYOFLOW_WALLTIME ${JSON.stringify(`${wd}/run.out`)} 2>/dev/null`) : "0";
    must(runOutA.trim() === "1", `run.out carries the walltime banner once (${runOutA.trim()})`);

    // 2. OVERRIDE — the connection's explicit slurmTimeMin wins verbatim
    const patched = await api(`/api/remote/connections/${CONN}`, {
      method: "PATCH", headers: SHJ, body: JSON.stringify({ slurmTimeMin: 90 }),
    });
    must(patched.status >= 200 && patched.status < 300, `the connection takes the override (${patched.status})`);
    must(patched.body?.connection?.slurmTimeMin === 90, `the override reads back (${patched.body?.connection?.slurmTimeMin})`);
    const dispatchB = await api(`/api/jobs/${st.wallsOverrideId}/run`, {
      method: "POST", headers: SHJ,
      body: JSON.stringify({ remote: { connectionId: st.conn, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
    });
    must(dispatchB.status >= 200 && dispatchB.status < 300, `the override dispatch answers (${dispatchB.status})`);
    let wd2 = null;
    for (let i = 0; i < 10 && !wd2; i++) {
      await sleep(700);
      wd2 = mockWorkdirOf(st.wallsOverrideId);
    }
    const scriptB = wd2 ? client(`cat ${JSON.stringify(`${wd2}/.cf-sbatch.sh`)}`) : "";
    must(/#SBATCH --time=01:30:00/.test(scriptB), "the override leg requests --time=01:30:00 (90 minutes, verbatim)");
    const doneB = await awaitTerminal(st.wallsOverrideId, 120_000);
    must(doneB?.status === "completed", `the override run completes (${doneB?.status})`);

    // back to auto for the ghost phase
    const unpatched = await api(`/api/remote/connections/${CONN}`, {
      method: "PATCH", headers: SHJ, body: JSON.stringify({ slurmTimeMin: 0 }),
    });
    must(unpatched.status >= 200 && unpatched.status < 300, `the override clears (${unpatched.status})`);
  } else if (mode === "ghost") {
    const st = loadState();
    console.log("== t367 GHOST: the leftover never graduates ==");
    const dispatch = await api(`/api/jobs/${st.ghostId}/run`, {
      method: "POST", headers: SHJ,
      body: JSON.stringify({ remote: { connectionId: st.conn, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
    });
    must(dispatch.status >= 200 && dispatch.status < 300, `the ghost dispatch answers (${dispatch.status})`);

    // wait until the run is LIVE and has written its first round
    let wd = null;
    for (let i = 0; i < 20 && !wd; i++) {
      await sleep(900);
      wd = mockWorkdirOf(st.ghostId);
    }
    must(!!wd, `the ghost run's workdir is findable (${wd ?? "?"})`);
    let rounds = 0;
    for (let i = 0; i < 20 && rounds === 0; i++) {
      const p = await api(`/api/jobs/${st.ghostId}/iterations`, { headers: SH });
      rounds = p.body?.stacks?.length ?? 0;
      if (rounds === 0) await sleep(900);
    }
    must(rounds > 0, `the run is live and writing rounds (${rounds})`);

    // THE PLANT — the field report's it020, verbatim: right-sized,
    // zero-header, and PREDATING this dispatch (the pre-run wipe's
    // silent-degrade leftover; this run writes it001..it003 and never
    // touches it004)
    const q = JSON.stringify(`${wd}/run_it004_classes.mrcs`);
    const plant = client(
      `head -c 2001024 /dev/zero > ${q} && touch -d '3 hours ago' ${q} && stat -c '%s %Y' ${q}`
    );
    must(/^\s*2001024 \d+/.test(plant), `the corrupt leftover plants with an OLD mtime (${plant.slice(0, 60)})`);

    const done = await awaitTerminal(st.ghostId, 120_000);
    must(done?.status === "completed", `the ghost run completes (${done?.status})`);

    // 1. the receipt NAMES the refused leftover (the generation gate spoke)
    must(
      /EARLIER run/i.test(String(done?.result ?? "")),
      `the receipt names the stale generation (${String(done?.result ?? "").slice(0, 140)}…)`
    );

    // 2. the mirror REFUSED it — the on-demand pull answers the honest
    //    corrupt-on-cluster verdict, not "could not render"
    const ghostImg = await api(
      `/api/jobs/${st.ghostId}/iterations/image?file=${encodeURIComponent("run_it004_classes.mrcs")}&slice=0`,
      { headers: SH }
    );
    must(ghostImg.status === 404, `the ghost stack's image door refuses (${ghostImg.status})`);
    must(
      /CORRUPT ON THE CLUSTER/i.test(String(ghostImg.body?.error ?? "")),
      `the refusal names the corrupt-on-cluster verdict (${String(ghostImg.body?.error ?? "").slice(0, 120)}…)`
    );
    must(
      /EARLIER run/i.test(String(ghostImg.body?.error ?? "")),
      "the verdict names the leftover/earlier-run world"
    );

    // 3. the run's OWN rounds still render (the healthy history survives)
    const realImg = await raw(
      `/api/jobs/${st.ghostId}/iterations/image?file=${encodeURIComponent("run_it003_classes.mrcs")}&slice=0`
    );
    must(realImg.status === 200 && isPng(realImg.buf), `the run's own newest round renders (${realImg.status}, ${realImg.buf?.length}B)`);

    // 4. the ledger still LISTS the leftover (the Files tab speaks the
    //    cluster's truth — it stayed there, marked remote)
    const outputs = await api(`/api/jobs/${st.ghostId}/outputs`, { headers: SH });
    const listed = (outputs.body?.files ?? []).find((f) => f.path === "run_it004_classes.mrcs");
    must(!!listed && listed.remote === true, `the manifest still lists the leftover as remote-only (${JSON.stringify(listed ?? null).slice(0, 80)})`);
  } else if (mode === "heal") {
    const st = loadState();
    console.log("== t367 HEAL: a corrupt mirror copy self-heals from the cluster ==");
    const job = (await api("/api/jobs", { headers: SH })).body?.jobs?.find((x) => x.id === st.ghostId);
    must(!!job, "the ghost job is still on the board");
    // the local mirror workdir: <RELION_DIR>/<projectId>/class2d_<id8>
    const mirror = path.join(ROOT, "data", "relion", job.projectId, `class2d_${st.ghostId.slice(-8)}`);
    must(existsSync(path.join(mirror, "run_it003_classes.mrcs")), `the mirror holds the run's it003 (${mirror})`);

    // 1. corrupt the mirror's it003 IN PLACE, same size (the ghost shape:
    //    a size-only "fresh copy" check would keep it forever)
    const real = readFileSync(path.join(mirror, "run_it003_classes.mrcs"));
    must(real.length === MOCK_STACK_BYTES, `the mock stack is the expected size (${real.length})`);
    writeFileSync(path.join(mirror, "run_it003_classes.mrcs"), Buffer.alloc(MOCK_STACK_BYTES));
    // the render cache must not answer before the mirror does (t356's
    // finalize pipeline rendered these — clear the job's preview cache)
    const preview = path.join(ROOT, "data", "remote-preview", "live", st.ghostId);
    if (existsSync(preview)) rmSync(preview, { recursive: true, force: true });
    console.log("  (mirror it003 zeroed; preview cache cleared)");

    const healed = await raw(
      `/api/jobs/${st.ghostId}/iterations/image?file=${encodeURIComponent("run_it003_classes.mrcs")}&slice=0`
    );
    must(healed.status === 200 && isPng(healed.buf), `the image route falls through to the cluster and renders (${healed.status}, ${healed.buf?.length}B)`);
    const after = readFileSync(path.join(mirror, "run_it003_classes.mrcs"));
    must(after.readInt32LE(0) === 64, `the mirror copy is HEALED in place (nx=${after.readInt32LE(0)} — the header parses again)`);

    // 2. the download door: corrupt it002's mirror copy; the raw fetch must
    //    re-pull instead of streaming the zeros
    writeFileSync(path.join(mirror, "run_it002_classes.mrcs"), Buffer.alloc(MOCK_STACK_BYTES));
    const dl = await raw(
      `/api/jobs/${st.ghostId}/outputs/file?path=${encodeURIComponent("run_it002_classes.mrcs")}&format=raw`
    );
    must(dl.status === 200, `the download door answers (${dl.status})`);
    must(
      dl.buf.length === MOCK_STACK_BYTES && dl.buf.readInt32LE(0) === 64,
      `the download serves HEALED bytes, not the ghost's zeros (nx=${dl.buf.readInt32LE?.(0)})`
    );
    const after2 = readFileSync(path.join(mirror, "run_it002_classes.mrcs"));
    must(after2.readInt32LE(0) === 64, "the it002 mirror copy healed too (the fetch door re-pulled it)");

    // 3. the sheet route heals the same way (corrupt it001 → 200 + healed)
    writeFileSync(path.join(mirror, "run_it001_classes.mrcs"), Buffer.alloc(MOCK_STACK_BYTES));
    if (existsSync(preview)) rmSync(preview, { recursive: true, force: true });
    const sheet = await raw(
      `/api/jobs/${st.ghostId}/iterations/sheet?file=${encodeURIComponent("run_it001_classes.mrcs")}`
    );
    must(sheet.status === 200 && isPng(sheet.buf), `the sheet route renders through the cluster (${sheet.status}, ${sheet.buf?.length}B)`);
    const after3 = readFileSync(path.join(mirror, "run_it001_classes.mrcs"));
    must(after3.readInt32LE(0) === 64, "the it001 mirror copy healed through the sheet door");
  } else if (mode === "cleanup") {
    const st = loadState();
    console.log("== t367 CLEANUP ==");
    client("rm -rf /data2/t367-particles /tmp/t367-probe");
    if (st.projectId) {
      const del = await api(`/api/projects/${st.projectId}`, { method: "DELETE", headers: SH });
      must(del.status >= 200 && del.status < 300, `the QA project deletes (${del.status})`);
    }
    const conn = await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH });
    must(conn.status >= 200 && conn.status < 300, `the QA connection deletes (${conn.status})`);
  } else {
    console.log("usage: node scripts/diag-t367-ghost-walltime.mjs stage|walls|ghost|heal|cleanup");
    process.exit(2);
  }
} catch (err) {
  console.error("t367 diag crashed:", err);
  fail++;
}
console.log(fail === 0 ? "t367 ALL GREEN" : `t367 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
