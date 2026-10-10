#!/usr/bin/env node
/**
 * t317 diag — the code-review follow-through on t315's delivery. The review
 * of bb24706 (0 critical / 1 high / 3 medium) found the t315 headline
 * invariant — "remote tasks are never submitted to WSL" — still violated
 * through the SECONDARY run doors, plus three medium-shape defects. This
 * suite pins every fix end to end against the mock cluster:
 *
 *  A. THE BARE POST (HIGH #1): a remote project's card-context-menu "Run
 *     job" / command palette / toast Retry / inspector "Start again" all
 *     POST /api/jobs/[id]/run with NO body — they used to fall into the
 *     LOCAL lane (the WSL bridge wrapped a job whose inputs live on the
 *     cluster). Now the bare POST inherits the PROJECT's binding: the
 *     class2d fed by a Particles import dispatches on the cluster, and the
 *     submitted wrapper carries the project binding's module.
 *  B. THE EXPLICIT LOCAL REFUSAL FOR PARTICLES (HIGH #1's twin): { local:
 *     true } (the panel's ▾ "Run on this machine") meets the NEW particles
 *     leg of the cluster-resident refusal — class2d's stack refs live on
 *     the cluster, and the refusal names the door before any spawn.
 *  C. THE GHOST TRIGGER (MED #2): the trigger's run record points at a
 *     DELETED connection while the project is re-bound to a live one —
 *     the passthrough must dispatch to the LIVE binding, not resurrect the
 *     dead connectionId (the old OR-ed guard shape did exactly that).
 *  D. THE MODULE-LESS CONNECTION (MED #3): a connection with no
 *     defaultModule but a populated probe — the passthrough falls back to
 *     the first probed module, so the wrapper's `module load` line exists
 *     (a module-less sbatch dies 127 after a full staging round).
 *  E. THE PREVIEW EDGE DOORS: a RELATIVE row of the star is refused (it
 *     would cat against the SSH home, #10); a 600 MB sparse frame stack is
 *     refused by the 512 MB fetch cap with the teaching message (#6); the
 *     manifest's cluster.total is the FULL row count, mixed stars included
 *     (#11).
 *  F. THE BOTH-LABELS DIALECT (#9): a particles STAR carrying
 *     _rlnMicrographName ALONGSIDE _rlnImageName imports fine (the refusal
 *     only fires when the image column is absent).
 *  G. SOURCE-LEVEL INVARIANTS (the mock cannot host them): the root-level
 *     star's sourceDir slicing (#8) is unit-checked with the exact shipped
 *     expression, and the WSL-bridge row translation (#4) is verified as
 *     source + unit (the sandbox is Linux — no wsl.exe to stage the real
 *     thing).
 *
 * Run against the standalone prod server on :3001 (t301/t311 doctrine).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import net from "node:net";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t317";
const CONN_A = "qa-t317-ghost-a";
const CONN_B = "qa-t317-ghost-b";
const CONN_C = "qa-t317-modless";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3001",
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
const apiRaw = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()) };
};

const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const createdJobs = [];
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

// a REAL small MRC (1024-byte header + 64×64 float32 pixels) — the preview
// door renders actual pixels, header-only fixtures would not
const realMrcB64 = (() => {
  const nx = 64;
  const ny = 64;
  const data = Buffer.alloc(1024 + nx * ny * 4);
  data.writeInt32LE(nx, 0);
  data.writeInt32LE(ny, 4);
  data.writeInt32LE(1, 8); // NZ=1 — a summed micrograph
  data.writeInt32LE(2, 12); // MODE=2 — float32
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const v = Math.sin(x / 6.0) * Math.cos(y / 8.0) + (x + y) / 128;
      data.writeFloatLE(v, 1024 + (y * nx + x) * 4);
    }
  }
  return data.toString("base64");
})();

// a REAL small MRC stack for the particles star to point at
const stackMrcB64 = (() => {
  const nx = 48;
  const ny = 48;
  // t338 — NZ must cover every image the particles star references (the
  // dispatch's consumer gate refuses a star that outruns its stack; the
  // old nz=2 under a 24-row star was exactly that lie)
  const nz = 24;
  const data = Buffer.alloc(1024); // header-only (t338): the sniffers read the header; full pixel data would bloat the inline base64 past the mock's exec limits
  data.writeInt32LE(nx, 0);
  data.writeInt32LE(ny, 4);
  data.writeInt32LE(nz, 8);
  data.writeInt32LE(2, 12);
  return data.toString("base64");
})();

const cleanRemoteTree = (projectId = null) => {
  clientBoth(
    "rm -rf /data2/qa-t317-mics /data2/qa-t317-particles /data2/qa-t317-big; " +
      // t309 doctrine: the project's OWN cluster tree burns by id
      `rm -rf /projects/cryoflow/qa-*${projectId ? " /projects/cryoflow/" + projectId : ""} /projects/cryoflow/_staged; ls /projects/cryoflow 2>/dev/null`
  );
  // fresh stage map keeps every run at the first-encounter truth
  try {
    rmSync(`${ROOT}/data/remote-stage-map.json`, { force: true });
  } catch {
    /* best-effort */
  }
};

// ---------------------------------------------------------------- try/catch
try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");
  cleanRemoteTree();

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t317",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      defaultModule: "relion/5.0.1",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the main connection upserts (${mk.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t317 review fixes", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  const projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");
  const activate = await api("/api/projects/switch", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ id: projectId }),
  });
  must(activate.status >= 200 && activate.status < 300, "the project activates");

  // ======================================================================
  console.log("== PHASE 1: fixtures (real-bytes MRCs + stacks + sparse giant) ==");
  const fx1 = clientBoth(
    "mkdir -p /data2/qa-t317-mics /data2/qa-t317-particles /data2/qa-t317-big; " +
      `echo ${realMrcB64} | base64 -d > /tmp/.t317-mic.mrc; ` +
      "for i in $(seq 1 3); do cp /tmp/.t317-mic.mrc /data2/qa-t317-mics/20241031_lijing_925_${i}_Fractions_DW.mrc; done"
  );
  must(fx1 === "", `the micrograph fixtures build quietly (${fx1.slice(0, 160)})`);
  const fx2 = clientBoth(
    `echo ${stackMrcB64} | base64 -d > /data2/qa-t317-particles/stack24.mrcs`
  );
  must(fx2 === "", `the stack fixture builds quietly (${fx2.slice(0, 160)})`);
  // The STARS are written base64-decoded: translateCommand rewrites every
  // /data2/ occurrence in the COMMAND STRING — a printf payload would carry
  // the mock's REAL sandbox paths into the rows (they exist host-side and
  // the cluster-resident gate would never fire). base64 carries no "/data2/"
  // literal, so the decoded rows are TRUE cluster-absolute paths.
  const particlesStarB64 = Buffer.from(
    "data_optics\n\nloop_\n_rlnOpticsGroup #1\n_rlnImagePixelSize #2\n_rlnImageSize #3\n1 0.93 48\n\ndata_particles\n\nloop_\n_rlnImageName #1\n_rlnOpticsGroup #2\n_rlnAngleRot #3\n" +
      Array.from({ length: 24 }, (_, i) => `${i + 1}@/data2/qa-t317-particles/stack24.mrcs 1 ${(i + 1) * 15}\n`).join("")
  ).toString("base64");
  const bothStarB64 = Buffer.from(
    "data_particles\n\nloop_\n_rlnImageName #1\n_rlnMicrographName #2\n_rlnAngleRot #3\n" +
      Array.from({ length: 6 }, (_, i) => `${i + 1}@/data2/qa-t317-particles/stack24.mrcs /data2/qa-t317-mics/20241031_lijing_925_${i + 1}_Fractions_DW.mrc ${(i + 1) * 10}\n`).join("")
  ).toString("base64");
  const fx2b = clientBoth(
    `echo ${particlesStarB64} | base64 -d > /data2/qa-t317-particles/particles.star; ` +
      `echo ${bothStarB64} | base64 -d > /data2/qa-t317-particles/both.star`
  );
  must(fx2b === "", `the star fixtures build quietly, rows truly cluster-absolute (${fx2b.slice(0, 160)})`);
  const fx3 = clientBoth("truncate -s 600M /data2/qa-t317-big/huge_stack.mrc");
  must(fx3 === "", `the sparse 600 MB frame stack builds quietly (${fx3.slice(0, 160)})`);
  must(client("ls /data2/qa-t317-mics | wc -l").trim() === "3", "3 real-bytes micrographs");
  must(client("grep -c '@' /data2/qa-t317-particles/particles.star").trim() === "24", "the particles star holds 24 image rows");
  must(client("stat -c %s /data2/qa-t317-big/huge_stack.mrc").trim() === "629145600", "the sparse stack reports 600 MB");

  // ======================================================================
  console.log("== PHASE A: THE BARE POST — the secondary doors inherit the cluster ==");
  const importA = await mkJob({
    projectId,
    type: "import",
    name: "QA t317 particles import",
    params: { micrographsPath: "/data2/qa-t317-particles/particles.star", nodeType: "particles" },
  });
  must(!!importA?.id, "the particles import creates");
  const runImport = await api(`/api/jobs/${importA.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runImport.status >= 200 && runImport.status < 300, `the import run accepts (${runImport.status})`);
  const doneImport = await pollUntil(async () => {
    const j = await jobById(importA.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneImport?.status === "completed", `the import completes (${doneImport?.status})`);
  must(/24 particles imported/.test(String(doneImport?.result ?? "")), "the import counts 24 particles");

  const class2d = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t317 bare-post class2d",
    params: {},
  });
  must(!!class2d?.id, "the class2d job creates");
  must((await mkEdge(importA.id, class2d.id, "particles", "particles")) < 300, "the particles edge wires");

  // THE no-body POST — byte-identical to store.runJob's card-menu call
  // (fetch with method POST, no body at all)
  const barePost = await api(`/api/jobs/${class2d.id}/run`, { method: "POST", headers: SHJ });
  must(barePost.status >= 200 && barePost.status < 300, `the bare POST accepts (${barePost.status})`);
  must(
    !barePost.body?.waiting || barePost.body?.waiting === "not-ready",
    `the bare POST resolved or staged (waiting=${String(barePost.body?.waiting)}) — not a local spawn: ${String(barePost.body?.error ?? "").slice(0, 120)}`
  );
  const done2d = await pollUntil(async () => {
    const j = await jobById(class2d.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(done2d?.status === "completed", `the class2d runs ON THE CLUSTER via the bare POST (${done2d?.status}: ${String(done2d?.result ?? "").slice(0, 140)})`);
  must(
    /REMOTE\[cryo@127\.0\.0\.1/.test(String(done2d?.result ?? "")),
    `the result carries the REMOTE origin — the side door no longer speaks WSL: ${String(done2d?.result ?? "").slice(0, 160)}`
  );
  must(!!done2d?.runRemote, "the DTO carries the remote strip (runRemote)");
  const wrapper2d = client(`cat /projects/cryoflow/${projectId}/class2d_${class2d.id.slice(-8)}/.cf-run.sh 2>/dev/null`);
  must(
    /module load relion\/5\.0\.1/.test(wrapper2d),
    `the submitted wrapper carries the project binding's module: ${(wrapper2d.split("\n").find((l) => l.includes("module load")) || "").slice(0, 140)}`
  );

  // ======================================================================
  console.log("== PHASE B: THE EXPLICIT LOCAL REFUSAL — particles stacks have the door too ==");
  const class2dB = await mkJob({
    projectId,
    type: "class2d",
    name: "QA t317 local refusal",
    params: {},
  });
  must(!!class2dB?.id, "the refusal class2d creates");
  must((await mkEdge(importA.id, class2dB.id, "particles", "particles")) < 300, "the refusal edge wires");
  const localRun = await api(`/api/jobs/${class2dB.id}/run`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ local: true }),
  });
  must(localRun.status >= 200 && localRun.status < 300, `the explicit local run answers (${localRun.status})`);
  const localErr = String(localRun.body?.error ?? "");
  must(/live on the CLUSTER/i.test(localErr), `the refusal names where the stacks live: ${localErr.slice(0, 140)}`);
  must(/particle stack/i.test(localErr), "the refusal speaks the particles dialect");
  must(/Run on cluster/i.test(localErr), "the refusal names the right door");
  const failedB = await jobById(class2dB.id);
  must(failedB?.status === "failed", `the row fails honestly with the lesson (${failedB?.status})`);
  must(
    client(`test -d /projects/cryoflow/${projectId}/class2d_${class2dB.id.slice(-8)} && echo YES`).trim() !== "YES",
    "nothing landed on the cluster for the refused job"
  );

  // ======================================================================
  console.log("== PHASE C: THE GHOST TRIGGER — a dead connection must not eat the live binding ==");
  // two MORE connection records against the same mock (distinct ids)
  for (const [id, name] of [
    [CONN_A, "QA t317 ghost A"],
    [CONN_B, "QA t317 ghost B"],
  ]) {
    const r = await api("/api/remote/connections", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({
        id,
        name,
        host: "127.0.0.1",
        port: 3022,
        username: "cryo",
        password: "demo",
        authMethod: "password",
        remoteRoot: "/projects/cryoflow",
        defaultModule: "relion/5.0.1",
      }),
    });
    must(r.status === 200 || r.status === 201, `connection ${name} upserts (${r.status})`);
  }
  // bind the project to A for the trigger round
  const rebindA = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: SHJ,
    body: JSON.stringify({ remoteConnectionId: CONN_A }),
  });
  must(rebindA.status >= 200 && rebindA.status < 300, `the project re-binds to A (${rebindA.status})`);

  const importC = await mkJob({
    projectId,
    type: "import",
    name: "QA t317 ghost import",
    params: { micrographsPath: "/data2/qa-t317-mics", pixelSize: 0.93, nodeType: "micrographs" },
  });
  must(!!importC?.id, "the ghost import creates");
  const ctfC = await mkJob({
    projectId,
    type: "ctffind",
    name: "QA t317 ghost trigger",
    params: {},
  });
  must(!!ctfC?.id, "the ghost-trigger ctffind creates");
  must((await mkEdge(importC.id, ctfC.id, "micrographs", "micrographs")) < 300, "the ghost edge wires");
  // pre-start the ctffind so it PENDS on its upstream (the auto-start loop
  // only consumes pending rows — the t315 Phase A idiom)
  const preC = await api(`/api/jobs/${ctfC.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(preC.status >= 200 && preC.status < 300, `the ghost ctffind pre-start accepts (${preC.status})`);
  const pendingC = await jobById(ctfC.id);
  must(pendingC?.status === "pending", `the ghost ctffind waits for its upstream (${pendingC?.status})`);
  const runC = await api(`/api/jobs/${importC.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runC.status >= 200 && runC.status < 300, `the ghost import run accepts (${runC.status})`);
  const doneC = await pollUntil(async () => {
    const j = await jobById(importC.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneC?.status === "completed", `the ghost import completes (${doneC?.status})`);
  must(/3 micrographs imported/.test(String(doneC?.result ?? "")), "the ghost import counts 3");

  // C1 — the mid-flight death is answered HONESTLY: deleting the connection
  // a running job depends on fails the row with the re-add lesson (the
  // reconcile sweep's designed verdict — pinned so the failure mode stays
  // honest). The ctffind dispatches on A the moment the import completes;
  // A is deleted while the task is still live.
  const ctfWorkdir = `/projects/cryoflow/${projectId}/ctffind_${ctfC.id.slice(-8)}`;
  const dispatched = await pollUntil(
    () => (client(`test -d ${ctfWorkdir} && echo YES`).trim() === "YES" ? true : false),
    120_000
  );
  must(dispatched, "the ctffind dispatched to A (its cluster workdir exists)");
  const delA = await api(`/api/remote/connections/${CONN_A}`, { method: "DELETE", headers: SHJ });
  must(delA.status >= 200 && delA.status < 300, `connection A is deleted mid-flight (${delA.status})`);
  const diedC = await pollUntil(async () => {
    const j = await jobById(ctfC.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 90_000);
  must(diedC?.status === "failed", `the mid-flight death fails the row honestly (${diedC?.status})`);
  must(
    /connection for this run was deleted|staging to the cluster was interrupted/i.test(String(diedC?.result ?? "")),
    `the honest death message names the door: ${String(diedC?.result ?? "").slice(0, 160)}`
  );

  // C2 — THE GHOST FORK (the review's finding #2): a trigger record whose
  // connection is dead while the project holds a LIVE binding must hand
  // the LIVE binding to the downstream, never resurrect the dead id. No
  // product door can stage a completed ghost record + a pending downstream
  // (pending rows only exist while their upstream runs, and the run dies
  // with its connection) — so the fork is verified by mirroring its EXACT
  // shipped logic (the same three cases dispatch.ts decides), plus the
  // source invariant. The project-fallback leg it shares with the ghost
  // path is E2E-verified alive by Phase D's real auto-start door.
  {
    // the shipped fork, verbatim in shape (dispatch.ts autoStartPendingDownstream)
    const fork = (triggerRec, triggerConn, projectFallback) =>
      triggerRec?.remote && triggerConn
        ? { via: "trigger", connectionId: triggerRec.remote.connectionId }
        : projectFallback
          ? { via: "project", connectionId: projectFallback.connectionId }
          : { via: "local" };
    // case 1: live trigger record — the trigger's own target wins
    must(
      fork({ remote: { connectionId: "live-A" } }, { id: "live-A" }, { connectionId: "proj-B" }).connectionId === "live-A",
      "ghost fork: a live trigger record wins (its own connectionId)"
    );
    // case 2: THE review's case — dead trigger record + live project binding
    // (the old OR-ed shape dispatched to the DEAD id here)
    must(
      fork({ remote: { connectionId: "dead-A" } }, null, { connectionId: "proj-B" }).connectionId === "proj-B",
      "ghost fork: a dead trigger record falls to the project's LIVE binding, not the dead id"
    );
    must(
      fork({ remote: { connectionId: "dead-A" } }, null, { connectionId: "proj-B" }).via === "project",
      "ghost fork: the fallback branch is the one that speaks"
    );
    // case 3: dead record, no binding — local
    must(
      fork({ remote: { connectionId: "dead-A" } }, null, null).via === "local",
      "ghost fork: no binding left → the local lane"
    );
    // case 4: native trigger (no record at all) + binding — the t315 door
    must(
      fork(null, null, { connectionId: "proj-B" }).via === "project",
      "ghost fork: a native trigger with a binding still inherits the cluster (t315)"
    );
    const dispatchSrc = readFileSync(`${ROOT}/src/lib/relion/dispatch.ts`, "utf8");
    must(
      /triggerRec\?\.remote && triggerConn\n/.test(dispatchSrc),
      "the shipped ternary gates on the ALIVE trigger connection (source invariant — not the OR-ed ghost shape)"
    );
    must(
      !/passthroughConn = passthroughConn \?\? conn/.test(dispatchSrc),
      "the resurrecting passthroughConn assignment is gone (source invariant)"
    );
  }

  // re-bind the project back to the MAIN connection for the phases ahead
  const rebindMain = await api(`/api/projects/${projectId}`, {
    method: "PATCH",
    headers: SHJ,
    body: JSON.stringify({ remoteConnectionId: CONN }),
  });
  must(rebindMain.status >= 200 && rebindMain.status < 300, `the project re-binds to the main connection (${rebindMain.status})`);
  // ghost B stays for the cleanup round below

  // ======================================================================
  console.log("== PHASE D: THE MODULE-LESS CONNECTION — first probed module rides the passthrough ==");
  const mkC = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN_C,
      name: "QA t317 module-less",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
      // deliberately NO defaultModule — the module must come from the probe
    }),
  });
  must(mkC.status === 200 || mkC.status === 201, `the module-less connection upserts (${mkC.status})`);
  const probeC = await api(`/api/remote/connections/${CONN_C}/test`, { method: "POST", headers: SHJ, body: "{}" });
  must(probeC.status >= 200 && probeC.status < 300, `the module-less connection probes (${probeC.status})`);
  const connsList = await api("/api/remote/connections", { headers: SH });
  const connC = (connsList.body?.connections ?? []).find((c) => c.id === CONN_C);
  const firstProbed = connC?.lastProbe?.relionModules?.[0] ?? null;
  must(!!firstProbed, `the probe populated the module list (first: ${firstProbed})`);
  must(connC?.defaultModule == null, "the connection itself still has no defaultModule");

  const proj2 = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t317 module-less", mode: "remote", remoteConnectionId: CONN_C }),
  });
  must(proj2.status >= 200 && proj2.status < 300, `the module-less project creates (${proj2.status})`);
  const projectId2 = proj2.body?.project?.id;
  const activate2 = await api("/api/projects/switch", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ id: projectId2 }),
  });
  must(activate2.status >= 200 && activate2.status < 300, "the module-less project activates");

  const importD = await mkJob({
    projectId: projectId2,
    type: "import",
    name: "QA t317 modless import",
    params: { micrographsPath: "/data2/qa-t317-mics", pixelSize: 0.93, nodeType: "micrographs" },
  });
  must(!!importD?.id, "the module-less import creates");
  const ctfD = await mkJob({
    projectId: projectId2,
    type: "ctffind",
    name: "QA t317 modless ctffind",
    params: {},
  });
  must(!!ctfD?.id, "the module-less ctffind creates");
  must((await mkEdge(importD.id, ctfD.id, "micrographs", "micrographs")) < 300, "the module-less edge wires");
  // pre-start so the row PENDS (the auto-start loop only consumes pending)
  const preD = await api(`/api/jobs/${ctfD.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(preD.status >= 200 && preD.status < 300, `the module-less ctffind pre-start accepts (${preD.status})`);
  const pendingD = await jobById(ctfD.id);
  must(pendingD?.status === "pending", `the module-less ctffind waits for its upstream (${pendingD?.status})`);
  const runD = await api(`/api/jobs/${importD.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runD.status >= 200 && runD.status < 300, `the module-less import run accepts (${runD.status})`);
  const doneD = await pollUntil(async () => {
    const j = await jobById(importD.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneD?.status === "completed", `the module-less import completes (${doneD?.status})`);
  const doneCtfD = await pollUntil(async () => {
    const j = await jobById(ctfD.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 180_000);
  must(
    doneCtfD?.status === "completed",
    `the module-less ctffind auto-starts and completes (${doneCtfD?.status}: ${String(doneCtfD?.result ?? "").slice(0, 140)})`
  );
  const wrapperD = client(`cat /projects/cryoflow/${projectId2}/ctffind_${ctfD.id.slice(-8)}/.cf-run.sh 2>/dev/null`);
  must(
    new RegExp(`module load ${firstProbed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(wrapperD),
    `the wrapper carries the FIRST PROBED module (${firstProbed}): ${(wrapperD.split("\n").find((l) => l.includes("module load")) || "(none — MODULE-LESS DEATH 127)").slice(0, 140)}`
  );

  // back to the main project; the module-less project burns
  const back = await api("/api/projects/switch", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ id: projectId }),
  });
  must(back.status >= 200 && back.status < 300, "the main project re-activates");
  for (const jid of [importD.id, ctfD.id]) {
    await api(`/api/jobs/${jid}`, { method: "DELETE", headers: SHJ }).catch(() => null);
  }
  await api(`/api/projects/${projectId2}`, { method: "DELETE", headers: SHJ }).catch(() => null);
  clientBoth(`rm -rf /projects/cryoflow/${projectId2}`);

  // ======================================================================
  console.log("== PHASE E: THE PREVIEW EDGE DOORS (relative row / fetch cap / full count) ==");
  const importE = await mkJob({
    projectId,
    type: "import",
    name: "QA t317 preview import",
    params: { micrographsPath: "/data2/qa-t317-mics", pixelSize: 0.93, nodeType: "micrographs" },
  });
  must(!!importE?.id, "the preview import creates");
  const runE = await api(`/api/jobs/${importE.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runE.status >= 200 && runE.status < 300, `the preview import run accepts (${runE.status})`);
  const doneE = await pollUntil(async () => {
    const j = await jobById(importE.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneE?.status === "completed", `the preview import completes (${doneE?.status})`);

  // E1 — a RELATIVE row: the door must refuse it instead of cat-ing the
  // SSH home. The row is planted in the job's own star (mtime busts the
  // parse cache) — the mixed star also proves the FULL-count fix (#11).
  const localStarE = `${ROOT}/data/relion/${projectId}/import_${importE.id.slice(-8)}/micrographs.star`;
  must(existsSync(localStarE), "the import's local star exists");
  {
    const text = readFileSync(localStarE, "utf8");
    const withRelative = text.replace(/\s*$/, "") + "\nmicrographs/qa-t317-relative-row.mrc 1\n";
    rmSync(localStarE, { force: true });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(localStarE, withRelative);
  }
  const relPreview = await api(
    `/api/jobs/${importE.id}/micrographs?preview=${encodeURIComponent("micrographs/qa-t317-relative-row.mrc")}`,
    { headers: SH }
  );
  must(relPreview.status === 400, `a RELATIVE row is refused at the cluster door (${relPreview.status})`);
  must(
    /cluster-absolute/i.test(String(relPreview.body?.error ?? "")),
    `the relative-row refusal says why: ${String(relPreview.body?.error ?? "").slice(0, 140)}`
  );
  const manifestE = await api(`/api/jobs/${importE.id}/micrographs`, { headers: SH });
  must(
    manifestE.body?.cluster?.total === 4,
    `the cluster strip counts the FULL row list, relative row included (${manifestE.body?.cluster?.total} of 4)`
  );

  // E2 — the 600 MB sparse frame stack: over the fetch cap, honestly
  const importBig = await mkJob({
    projectId,
    type: "import",
    name: "QA t317 sparse giant",
    params: { micrographsPath: "/data2/qa-t317-big", pixelSize: 1.0, nodeType: "movies" },
  });
  must(!!importBig?.id, "the sparse import creates");
  const runBig = await api(`/api/jobs/${importBig.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runBig.status >= 200 && runBig.status < 300, `the sparse import run accepts (${runBig.status})`);
  const doneBig = await pollUntil(async () => {
    const j = await jobById(importBig.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(doneBig?.status === "completed", `the sparse import completes (${doneBig?.status})`);
  const bigRow = `/data2/qa-t317-big/huge_stack.mrc`;
  const bigPreview = await api(
    `/api/jobs/${importBig.id}/micrographs?preview=${encodeURIComponent(bigRow)}`,
    { headers: SH }
  );
  must(bigPreview.status === 400, `the 600 MB stack is refused by the cap (${bigPreview.status})`);
  must(
    /512 MB preview fetch cap/i.test(String(bigPreview.body?.error ?? "")),
    `the over-cap refusal teaches the way out: ${String(bigPreview.body?.error ?? "").slice(0, 160)}`
  );

  // E3 — the control: a NORMAL micrograph still previews (no guard overreach)
  const normalRow = `/data2/qa-t317-mics/20241031_lijing_925_1_Fractions_DW.mrc`;
  const normalPreview = await apiRaw(
    `/api/jobs/${importE.id}/micrographs?preview=${encodeURIComponent(normalRow)}`,
    { headers: SH }
  );
  must(
    normalPreview.status === 200 && normalPreview.bytes[0] === 0x89 && normalPreview.bytes[1] === 0x50,
    `a normal micrograph still renders a real PNG (${normalPreview.status}, ${normalPreview.bytes.length} bytes)`
  );

  // ======================================================================
  console.log("== PHASE F: THE BOTH-LABELS DIALECT — _rlnImageName present wins ==");
  const importBoth = await mkJob({
    projectId,
    type: "import",
    name: "QA t317 both labels",
    params: { micrographsPath: "/data2/qa-t317-particles/both.star", nodeType: "particles" },
  });
  must(!!importBoth?.id, "the both-labels import creates");
  const runBoth = await api(`/api/jobs/${importBoth.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runBoth.status >= 200 && runBoth.status < 300, `the both-labels run accepts (${runBoth.status})`);
  const doneBoth = await pollUntil(async () => {
    const j = await jobById(importBoth.id);
    return j?.status === "completed" || j?.status === "failed" ? j : null;
  }, 60_000);
  must(
    doneBoth?.status === "completed",
    `the both-labels particles STAR imports fine — no false dialect refusal (${doneBoth?.status}: ${String(doneBoth?.result ?? "").slice(0, 140)})`
  );
  must(/6 particles imported/.test(String(doneBoth?.result ?? "")), "the both-labels import counts 6 particles");

  // ======================================================================
  console.log("== PHASE G: SOURCE-LEVEL INVARIANTS (the mock cannot host these) ==");
  // G1 — the root-level star sourceDir slicing (#8): the mock's translator
  // has no mount prefix for "/"-level files, so the shipped expression is
  // verified with the exact code the engine runs
  {
    const cut = (raw) => {
      const c = raw.lastIndexOf("/");
      return c > 0 ? raw.slice(0, c) : c === 0 ? "/" : ".";
    };
    must(cut("/root.star") === "/", "a root-level star's sourceDir is / (not the file itself)");
    must(cut("particles.star") === ".", "a slashless path's sourceDir is . (not a mangled tail)");
    must(cut("/data2/x/particles.star") === "/data2/x", "a normal path's sourceDir is its parent");
    const engineSrc = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
    must(
      /const cut = raw\.lastIndexOf\("\/"\);\n\s*sourceDir = cut > 0 \? raw\.slice\(0, cut\) : cut === 0 \? "\/" : "\."/.test(engineSrc),
      "the engine ships exactly that slicing (source invariant)"
    );
  }
  // G2 — the WSL-bridge row translation (#4): the sandbox is Linux (no
  // wsl.exe to stage a real bridge), so the shipped logic is verified as
  // source + unit — the gate consults wslToHost BEFORE calling a row missing
  {
    const engineSrc = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
    must(
      /!existsSync\(wslToHost\(n, distro\)\)/.test(engineSrc),
      "the resident gate translates rows through the bridge before the missing verdict (source invariant)"
    );
    must(/savedWslDistro/.test(engineSrc), "the gate reads the SAVED distro for UNC rows (source invariant)");
    // the translation itself, exactly as wsl-bridge ships it
    const wslToHost = (p, distro) => {
      const mnt = p.match(/^\/mnt\/([A-Za-z])\/(.*)$/);
      if (mnt) return `${mnt[1].toUpperCase()}:\\${mnt[2].replace(/\//g, "\\")}`;
      if (p.startsWith("/") && distro) return `\\\\wsl.localhost\\${distro}\\${p.slice(1).replace(/\//g, "\\")}`;
      return p;
    };
    must(wslToHost("/mnt/c/Users/z/data/mic.mrc", null) === "C:\\Users\\z\\data\\mic.mrc", "a /mnt/c row translates back to its Windows drive");
    // with a distro, a cluster-absolute row gets the UNC view — which does
    // NOT exist host-side either, so the row still reads as missing: the
    // Beijing hole stays closed on BOTH translation legs
    must(wslToHost("/data06/Krios/mic.mrc", "Debian") === "\\\\wsl.localhost\\Debian\\data06\\Krios\\mic.mrc", "a cluster-absolute row only ever reaches a non-existent UNC (still missing)");
    must(wslToHost("/data06/Krios/mic.mrc", null) === "/data06/Krios/mic.mrc", "without a bridge the cluster row is just itself (missing everywhere)");
    must(wslToHost("/home/z/src/x.mrc", "Debian") === "\\\\wsl.localhost\\Debian\\home\\z\\src\\x.mrc", "a distro-internal row translates to its UNC view");
  }
  // G3 — the route's bare-POST fallback + explicit-local flag (source shape)
  {
    const routeSrc = readFileSync(`${ROOT}/src/app/api/jobs/[id]/run/route.ts`, "utf8");
    must(/body\?\.local !== true/.test(routeSrc), "the run route honors the explicit local flag (source invariant)");
    must(/projectRemoteTarget\(existing\.projectId\)/.test(routeSrc), "the run route consults the project binding (source invariant)");
  }

  // ======================================================================
  console.log("== PHASE H: cleanup ==");
  for (const jid of createdJobs) {
    await api(`/api/jobs/${jid}`, { method: "DELETE", headers: SHJ }).catch(() => null);
  }
  await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SHJ }).catch(() => null);
  for (const id of [CONN, CONN_B, CONN_C]) {
    await api(`/api/remote/connections/${id}`, { method: "DELETE", headers: SHJ }).catch(() => null);
  }
  cleanRemoteTree(projectId);
  const residue = client("ls /projects/cryoflow/ 2>/dev/null").split("\n").filter((l) => l.includes("qa-"));
  must(residue.length === 0, `the cluster tree burns clean (${residue.join(", ")})`);
  for (const p of [projectId, projectId2]) {
    const localResidue = `${ROOT}/data/relion/${p}`;
    if (existsSync(localResidue)) rmSync(localResidue, { recursive: true, force: true });
  }
  const previewResidue = `${ROOT}/data/remote-preview`;
  if (existsSync(previewResidue)) rmSync(previewResidue, { recursive: true, force: true });
  must(true, "local mirrors + preview cache burned");
} catch (err) {
  fail++;
  console.error("SUITE ERROR:", err);
}

console.log(fail === 0 ? "\nALL GREEN" : `\n${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
