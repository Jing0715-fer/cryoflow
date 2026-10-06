/**
 * t618-diag — t270's run-3 crime scene, isolated: does the third remote
 * motioncorr dispatch reach "running" at all, and if not, what does it do?
 * Replicates the t270 choreography (import → connection → dispatch) and
 * samples the job's status at 250ms with a transition timeline, plus the
 * final result text and the app's run log tail.
 * CDP-free (pure API). Usage: node scripts/t618-diag.mjs
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const MICS_DIR = "/home/z/my-project/data/relion/t270-mics";
const SH = (() => {
  try {
    const env = readFileSync("/home/z/my-project/.env.local", "utf8");
    const m = env.match(/SCRUB_HEADERS\s*=\s*(.+)/);
    if (m) return JSON.parse(m[1]);
  } catch { /* fall through */ }
  return { "x-cryoflow-scrub": "1", Origin: "http://localhost:3000" };
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const created = [];
const mkJob = async (body) => {
  const r = await fetch(`${BASE}/api/jobs`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const b = await r.json();
  if (r.status === 201 && b.job?.id) created.push(b.job.id);
  return b.job;
};
const readJob = async (id) => {
  const d = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
  return (d.jobs ?? []).find((x) => x.id === id) ?? null;
};

try {
  /* six tiny movies (the t268/t269 recipe) — idempotent staging */
  mkdirSync(MICS_DIR, { recursive: true });
  const names = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc", "mic_05.mrc", "mic_06.mrc"];
  for (const n of names) {
    const p = `${MICS_DIR}/${n}`;
    try { if (!readFileSync(p)) throw new Error("missing"); } catch {
      const nx = 64, ny = 64, nz = 4;
      const buf = Buffer.alloc(1024 + nx * ny * nz * 4);
      buf.write(" extended", 0, "ascii");
      buf.writeInt32LE(0, 4 * 4); buf.writeInt32LE(nx, 4 * 0 + 4 * 0 ? 4 : 4);
      /* minimal honest MRC: mode 2, nx/ny/nz at offsets 0/4/8 (after the 10-word header the map id) */
      buf.writeInt32LE(nx, 0); buf.writeInt32LE(ny, 4); buf.writeInt32LE(nz, 8);
      buf.writeInt32LE(2, 12); buf.writeInt32LE(0, 16); buf.writeInt32LE(1, 20);
      for (let i = 0; i < nx * ny * nz; i++) buf.writeFloatLE(Math.sin(i / 7) * 100 + 500, 1024 + i * 4);
      writeFileSync(p, buf);
    }
  }
  console.log("staged:", names.length, "movies");

  const importJob = await mkJob({
    type: "import",
    name: "t618 Import (diag)",
    params: { micrographsPath: MICS_DIR, pixelSize: 1.77, nodeType: "movies" },
  });
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: "{}" });
  let imp = null;
  for (let i = 0; i < 100 && !imp; i++) { await sleep(300); imp = (await readJob(importJob.id))?.status === "completed" ? true : null; }
  console.log("import completed:", !!imp);

  /* the connection (same shape as t270's) */
  const connId = `qa-t618-${Date.now().toString(36)}`;
  await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({ id: connId, name: "QA t618 Diag", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" }),
  });

  const job = await mkJob({ type: "motioncorr", name: "t618 MotionCorr (diag run-3 shape)", params: { do_own_motioncor: true } });
  /* the heavy import (the t618 run-3 recipe) */
  const heavyImport = await mkJob({
    type: "import",
    name: "t618 Import Heavy (diag)",
    params: { micrographsPath: MICS_DIR + "-heavy", pixelSize: 1.77, nodeType: "movies" },
  });
  mkdirSync(MICS_DIR + "-heavy", { recursive: true });
  for (const n of names) {
    const W = 128, H = 128, NF = 16;
    const buf = Buffer.alloc(1024 + W * H * 4 * NF);
    buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(NF, 8);
    buf.writeInt32LE(2, 12);
    buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(NF, 36);
    buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77 * NF, 48);
    buf.write("MAP ", 208, "ascii");
    buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
    for (let s = 0; s < NF; s++) {
      for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7 + s) * 0.1, 1024 + (s * W * H + i) * 4);
    }
    writeFileSync(`${MICS_DIR}-heavy/${n}`, buf);
  }
  await fetch(`${BASE}/api/jobs/${heavyImport.id}/run`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: "{}" });
  for (let i = 0; i < 100; i++) { await sleep(300); if ((await readJob(heavyImport.id))?.status === "completed") break; }
  const e1 = await fetch(`${BASE}/api/edges`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({ fromJobId: heavyImport.id, toJobId: job.id, fromPort: "movies", toPort: "movies" }) });
  console.log("heavy edge:", e1.status, JSON.stringify((await e1.json().catch(() => ({})))).slice(0, 160));
  await fetch(`${BASE}/api/edges`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({ fromJobId: importJob.id, toJobId: job.id, fromPort: "movies", toPort: "movies" }) });
  const d = await fetch(`${BASE}/api/jobs/${job.id}/run`, {
    method: "POST", headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  console.log("dispatch:", d.status);

  /* wait for running, then STOP (the t270 C5 shape), then watch the ledger */
  let running = false;
  for (let i = 0; i < 240 && !running; i++) { await sleep(250); running = (await readJob(job.id))?.status === "running"; }
  console.log("reached running:", running);
  if (running) {
    const stopRes = await fetch(`${BASE}/api/jobs/${job.id}/stop`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: "{}" });
    console.log("stop:", stopRes.status);
    const timeline2 = [];
    let last2 = null;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const j = await readJob(job.id);
      const list = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
      const res = (list.connections ?? []).find((c) => c.id === connId)?.resume ?? null;
      const sig = `${j?.status}|total=${res?.total ?? "?"} failed=${res?.failed ?? "?"} recent0=${res?.recent?.[0]?.exitCode ?? "?"}`;
      if (sig !== last2) { last2 = sig; timeline2.push({ at: i, sig }); }
      if (res && res.total >= 1 && res.failed >= 1) break;
    }
    console.log("post-stop ledger timeline:", JSON.stringify(timeline2, null, 1));
  }
} finally {
  for (const id of created) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }); } catch { /* */ }
  }
  try {
    const raw = JSON.parse(readFileSync("/home/z/my-project/data/remote-connections.json", "utf8"));
    for (const c of (Array.isArray(raw) ? raw : [])) {
      if (String(c?.id ?? "").startsWith("qa-t618-")) {
        await fetch(`${BASE}/api/remote/connections/${c.id}`, { method: "DELETE", headers: SH }).catch(() => {});
      }
    }
  } catch { /* */ }
}
