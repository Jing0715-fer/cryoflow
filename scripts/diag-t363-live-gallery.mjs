/**
 * DIAG t363 — the live-results ticket, in two halves:
 *
 *   1. the UI gate: while a REMOTE classification runs, its local mirror is
 *      EMPTY (the sync-back lands at finalize) — the Results tab's old
 *      `files.length === 0` early return kept ClassIterationGallery
 *      unmounted for the WHOLE run, so rounds only appeared when everything
 *      finished (the user's 「2D运行过程中还是没有实时传回中间结果，
 *      全部完成后再一次性传回每一轮的结果」). The fix mounts the gallery
 *      for the classification types with an honest empty-note. This script
 *      stages the exact world (running remote class2d + empty mirror) for
 *      the browser to verify; `watch` proves the API legs answer LIVE
 *      (rounds stream, sheet + slices pull MID-RUN).
 *   2. the landing smoothness (t364) is browser-side (deferred + chunked
 *      card reveal) — this script can stage a many-card canvas with
 *      `bulk <n>` for that check.
 *
 * Modes (state rides /tmp/t363-state.json):
 *   stage            — connection + remote project + particles import (run
 *                      to completion) + class2d job wired idle; prints ids
 *   dispatch         — dispatch the class2d remote-slurm (real mock rounds)
 *   watch            — while RUNNING: /iterations streams rounds, the sheet
 *                      and a per-class image serve MID-RUN, the outputs
 *                      listing honestly reports an empty mirror
 *   finish           — await terminal; assert completed + the outputs
 *                      listing is no longer empty (the sync-back landed)
 *   bulk <n>         — add n idle import jobs to the staged project (the
 *                      >20-card landing for the t364 reveal check)
 *   cleanup          — delete the staged jobs + project
 *
 * The mock cluster (:3022) and the dev server must both be up.
 * CF_ROOT / CF_BASE override the defaults.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3005";
const CONN = "qa-t363";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const STATE_FILE = "/tmp/t363-state.json";
const ITERS = 40; // ~0.9s per mock round → a ~40s RUNNING window to watch

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
const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  return b?.job;
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
    console.log("== t363 STAGE: the running-remote-2D world ==");
    must((await api("/api/jobs", { headers: SH })).status === 200, "the dev server answers");
    must(await mockListening(), "the mock cluster answers on :3022");

    const mk = await api("/api/remote/connections", {
      method: "POST", headers: SHJ,
      body: JSON.stringify({
        id: CONN, name: "QA t363", host: "127.0.0.1", port: 3022,
        username: "cryo", password: "demo", authMethod: "password",
        remoteRoot: "/projects/cryoflow",
      }),
    });
    must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

    const proj = await api("/api/projects", {
      method: "POST", headers: SHJ,
      body: JSON.stringify({ name: "QA t363 live gallery", mode: "remote", remoteConnectionId: CONN }),
    });
    must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
    const projectId = proj.body?.project?.id;
    must(!!projectId, "the project id rides the response");
    const sw = await api("/api/projects/switch", {
      method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }),
    });
    must(sw.status === 200, `the project activates (${sw.status})`);

    // particles fixture ON the cluster (absolute cluster paths)
    const stackB64 = (() => {
      const data = Buffer.alloc(1024);
      data.writeInt32LE(48, 0); data.writeInt32LE(48, 4); data.writeInt32LE(24, 8); data.writeInt32LE(2, 12);
      return data.toString("base64");
    })();
    const fx = client(
      "mkdir -p /data2/t363-particles; " +
        `echo ${stackB64} | base64 -d > /data2/t363-particles/stack24.mrcs; ` +
        "printf 'data_optics\\n\\nloop_\\n_rlnOpticsGroup #1\\n_rlnImagePixelSize #2\\n_rlnImageSize #3\\n1 0.93 48\\n\\ndata_particles\\n\\nloop_\\n_rlnImageName #1\\n_rlnOpticsGroup #2\\n_rlnAngleRot #3\\n' > /data2/t363-particles/particles.star; " +
        "for i in $(seq 1 24); do printf '%d@/data2/t363-particles/stack24.mrcs 1 %d\\n' $i $((i * 15)) >> /data2/t363-particles/particles.star; done"
    );
    must(fx === "", `the particles fixtures build quietly (${fx.slice(0, 120)})`);

    const importParts = await mkJob({
      projectId, type: "import", name: "QA t363 particles import",
      params: { micrographsPath: "/data2/t363-particles/particles.star", nodeType: "particles" },
    });
    must(!!importParts?.id, "the particles import creates");
    const runParts = await api(`/api/jobs/${importParts.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
    must(runParts.status >= 200 && runParts.status < 300, `the particles import accepts (${runParts.status})`);
    const doneParts = await awaitTerminal(importParts.id, 60_000);
    must(doneParts?.status === "completed", `the particles import completes (${doneParts?.status})`);

    const clsJob = await mkJob({
      projectId, type: "class2d", name: "QA t363 class2d live",
      params: { iterations: ITERS, numClasses: 4 },
    });
    must(!!clsJob?.id, "the class2d job creates");
    const edge = await api("/api/edges", {
      method: "POST", headers: SH,
      body: JSON.stringify({ fromJobId: importParts.id, toJobId: clsJob.id, fromPort: "particles", toPort: "particles" }),
    });
    must(edge.status === 200 || edge.status === 201, `the particles edge wires import → class2d (${edge.status})`);

    saveState({ projectId, importId: importParts.id, class2dId: clsJob.id, conn: CONN });
    console.log(`  staged: project=${projectId} class2d=${clsJob.id} (idle, ${ITERS} rounds armed)`);
  } else if (mode === "dispatch") {
    const st = loadState();
    const dispatch = await api(`/api/jobs/${st.class2dId}/run`, {
      method: "POST", headers: SHJ,
      body: JSON.stringify({ remote: { connectionId: st.conn, module: "relion/5.0.1", mode: "slurm", gpus: 1 } }),
    });
    must(dispatch.status >= 200 && dispatch.status < 300, `the class2d dispatch answers (${dispatch.status})`);
    must(!dispatch.body?.error, `the dispatch is ACCEPTED (${String(dispatch.body?.error ?? "").slice(0, 120)})`);
    console.log(`  dispatched class2d=${st.class2dId} — the RUNNING window is ~${ITERS}s`);
  } else if (mode === "watch") {
    const st = loadState();
    console.log("== t363 WATCH: rounds stream LIVE while the run is up ==");
    const job = await jobById(st.class2dId);
    must(job?.status === "running" || job?.status === "pending", `the class2d is RUNNING (${job?.status})`);

    // the premise: an empty local mirror (the old UI gate hid on exactly this)
    const outputs = await api(`/api/jobs/${st.class2dId}/outputs`, { headers: SH });
    must(outputs.status === 200 && Array.isArray(outputs.body?.files), "the outputs listing answers mid-run");
    console.log(`  (mid-run outputs listing: ${outputs.body?.files?.length} files — the mirror is empty until finalize)`);

    // rounds stream: two samples 3.5s apart must GROW
    let first = null;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const p = await api(`/api/jobs/${st.class2dId}/iterations`, { headers: SH });
      const stacks = p.body?.stacks ?? [];
      if (!p.body?.error && stacks.length > 0) { first = p.body; break; }
      await sleep(1_500);
    }
    must(first != null, "the live iterations payload answers with rounds on the cluster");
    must(first?.remote === true, "the payload admits it is live/remote");
    await sleep(3_500);
    const second = (await api(`/api/jobs/${st.class2dId}/iterations`, { headers: SH })).body;
    must(
      (second?.stacks?.length ?? 0) > (first?.stacks?.length ?? 0),
      `rounds stream while running (${first?.stacks?.length} → ${second?.stacks?.length})`
    );
    must((second?.classes?.length ?? 0) > 0, `occupancy counts on the cluster (${second?.classes?.length} classes)`);

    // MID-RUN pulls: the newest round's sheet + a per-class image
    const newest = second.stacks[second.stacks.length - 1].file;
    const sheet = await raw(`/api/jobs/${st.class2dId}/iterations/sheet?file=${encodeURIComponent(newest)}`);
    must(sheet.status === 200 && isPng(sheet.buf), `the NEWEST round's sheet serves MID-RUN (${sheet.status}, ${sheet.buf.length}B, ${newest})`);
    const slice = await raw(`/api/jobs/${st.class2dId}/iterations/image?file=${encodeURIComponent(newest)}&slice=0`);
    must(slice.status === 200 && isPng(slice.buf), `a per-class image serves MID-RUN (${slice.status}, ${slice.buf.length}B)`);
  } else if (mode === "finish") {
    const st = loadState();
    console.log("== t363 FINISH: the sync-back lands, the listing fills ==");
    const done = await awaitTerminal(st.class2dId, 120_000);
    must(done?.status === "completed", `the class2d completes (${done?.status}: ${String(done?.result ?? "").slice(0, 90)})`);
    const outputs = await api(`/api/jobs/${st.class2dId}/outputs`, { headers: SH });
    must(
      outputs.status === 200 && (outputs.body?.files?.length ?? 0) > 0,
      `the outputs listing is no longer empty (${outputs.body?.files?.length} files — the header row returns)`
    );
  } else if (mode === "bulk") {
    const st = loadState();
    const n = Number(process.argv[3] ?? 26);
    console.log(`== t363 BULK: ${n} idle cards for the landing check ==`);
    for (let i = 0; i < n; i++) {
      const j = await mkJob({
        projectId: st.projectId, type: "import", name: `QA t363 filler ${String(i + 1).padStart(2, "0")}`,
        params: { micrographsPath: "/data2/t363-particles/particles.star", nodeType: "particles" },
      });
      if (!j?.id) { console.log(`  FAIL: filler ${i + 1} did not create`); fail++; break; }
    }
    const { body } = await api("/api/jobs", { headers: SH });
    const count = (body?.jobs ?? []).filter((j) => j.projectId === st.projectId).length;
    must(count >= n, `the canvas carries ${count} cards (reveal territory, >20)`);
  } else if (mode === "cleanup") {
    const st = loadState();
    console.log("== t363 CLEANUP ==");
    if (st.projectId) {
      const del = await api(`/api/projects/${st.projectId}`, { method: "DELETE", headers: SH });
      must(del.status >= 200 && del.status < 300, `the QA project deletes (${del.status})`);
    }
    const conn = await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH });
    must(conn.status >= 200 && conn.status < 300, `the QA connection deletes (${conn.status})`);
  } else {
    console.log("usage: node scripts/diag-t363-live-gallery.mjs stage|dispatch|watch|finish|bulk <n>|cleanup");
    process.exit(2);
  }
} catch (err) {
  console.error("t363 diag crashed:", err);
  fail++;
}
console.log(fail === 0 ? "t363 ALL GREEN" : `t363 ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
