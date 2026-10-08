/**
 * t618-diag2 — the stop-flip crime scene: stop a heavy remote run during
 * the EXEC leg (post-staging), then watch the local run record every 2s
 * for 90s. Does the exit-137 record HOLD, or does a later reconcile flip
 * it to done/exit-0 (the remote process survived the kill and completed)?
 * Usage: node scripts/t618-diag2.mjs
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const BASE = "http://localhost:3000";
const HEAVY_DIR = "/home/z/my-project/data/relion/t618-mics-heavy";
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
  mkdirSync(HEAVY_DIR, { recursive: true });
  const names = ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc", "mic_04.mrc", "mic_05.mrc", "mic_06.mrc"];
  for (const n of names) {
    const W = 256, H = 256, NF = 16;
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
    writeFileSync(`${HEAVY_DIR}/${n}`, buf);
  }

  const importJob = await mkJob({ type: "import", name: "t618 Import Heavy2", params: { micrographsPath: HEAVY_DIR, pixelSize: 1.77, nodeType: "movies" } });
  await fetch(`${BASE}/api/jobs/${importJob.id}/run`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: "{}" });
  for (let i = 0; i < 100; i++) { await sleep(300); if ((await readJob(importJob.id))?.status === "completed") break; }
  console.log("import done");

  const connId = `qa-t618b-${Date.now().toString(36)}`;
  await fetch(`${BASE}/api/remote/connections`, {
    method: "POST",
    headers: { ...SH, "Content-Type": "application/json" },
    body: JSON.stringify({ id: connId, name: "QA t618b Diag", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" }),
  });

  const job = await mkJob({ type: "motioncorr", name: "t618 MotionCorr Heavy2", params: { do_own_motioncor: true } });
  await fetch(`${BASE}/api/edges`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({ fromJobId: importJob.id, toJobId: job.id, fromPort: "movies", toPort: "movies" }) });
  const d = await fetch(`${BASE}/api/jobs/${job.id}/run`, {
    method: "POST", headers: { "Content-Type": "application/json", ...SH },
    body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
  });
  console.log("dispatch:", d.status);

  let running = false;
  for (let i = 0; i < 240 && !running; i++) { await sleep(250); running = (await readJob(job.id))?.status === "running"; }
  console.log("running:", running);
  /* wait for the STAGED leg (the exec surface), like the fixed t270 */
  let staged = false;
  for (let i = 0; i < 120 && !staged; i++) {
    await sleep(500);
    const list = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
    const res = (list.connections ?? []).find((c) => c.id === connId)?.resume;
    const e = (res?.recent ?? []).find((x) => x.jobId === job.id);
    staged = !!(e && e.stagedMs != null && e.done === false);
  }
  console.log("staged leg visible:", staged);

  const stopRes = await fetch(`${BASE}/api/jobs/${job.id}/stop`, { method: "POST", headers: { "Content-Type": "application/json", ...SH }, body: "{}" });
  console.log("stop:", stopRes.status);

  /* t618 — the flip probe: load the canvas page (the reconcile trigger),
   * then keep watching. If the record flips to done/exit-0 after a page
   * load, the mechanism is the page-load-triggered reconciliation. */
  const { execSync: xs } = await import("node:child_process");
  try { xs(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  try { xs(`agent-browser open ${BASE} >/dev/null 2>&1`); } catch { /* */ }
  console.log("canvas page loaded (reconcile trigger fired)");
  /* the watch: does 137 hold? */
  let last = null;
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    const list = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
    const res = (list.connections ?? []).find((c) => c.id === connId)?.resume;
    const e = (res?.recent ?? []).find((x) => x.jobId === job.id);
    const j = await readJob(job.id);
    const sig = `job=${j?.status} | rec done=${e?.done} exit=${e?.exitCode} staged=${e?.stagedMs ?? "-"} sync=${e?.syncMs ?? "-"} | agg total=${res?.total} completed=${res?.completed} failed=${res?.failed}`;
    if (sig !== last) { last = sig; console.log(`t+${i * 2}s ${sig}`); }
  }
} finally {
  for (const id of created) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH }); } catch { /* */ }
  }
  try {
    const raw = JSON.parse(readFileSync("/home/z/my-project/data/remote-connections.json", "utf8"));
    for (const c of (Array.isArray(raw) ? raw : [])) {
      if (String(c?.id ?? "").startsWith("qa-t618b-")) {
        await fetch(`${BASE}/api/remote/connections/${c.id}`, { method: "DELETE", headers: SH }).catch(() => {});
      }
    }
  } catch { /* */ }
}
