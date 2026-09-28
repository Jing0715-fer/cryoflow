// diag-t416 — reproduce the denoise remote failure and grab run.err
const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" };
const api = async (m, p, b) => {
  const r = await fetch(`${BASE}${p}`, { method: m, headers: SH, ...(b !== undefined ? { body: JSON.stringify(b) } : {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proj = await api("POST", "/api/projects", { name: `t416diag ${Date.now().toString(36)}` });
const projId = proj.body?.project?.id ?? proj.body?.id;
console.log("proj:", proj.status, projId);
const { execSync } = await import("node:child_process");
const { mkdirSync, writeFileSync } = await import("node:fs");
const FIX = "/home/z/my-project/data/relion/t416diag";
mkdirSync(FIX, { recursive: true });
for (const n of ["mic_01.mrc", "mic_02.mrc", "mic_03.mrc"]) {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8); buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin(i / 7) * 0.1, 1024 + i * 4);
  writeFileSync(`${FIX}/${n}`, buf);
}
const imp = await api("POST", "/api/jobs", { type: "import", name: "diag import", params: { micrographsPath: FIX, pixelSize: 1.77 } });
const impJob = imp.body.job;
await api("POST", `/api/jobs/${impJob.id}/run`, {});
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  const d = await api("GET", "/api/jobs");
  const j = (d.body?.jobs ?? []).find((x) => x.id === impJob.id);
  if (j?.status === "completed") { console.log("import completed"); break; }
}
const connId = `qa-t416diag-${Date.now().toString(36)}`;
const mk = await api("POST", "/api/remote/connections", {
  id: connId, name: "QA diag", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo",
  authMethod: "password", remoteRoot: "/projects/cryoflow",
});
console.log("conn:", mk.status);
const den = await api("POST", "/api/jobs", { type: "topazdenoise", name: "diag denoise", params: {} });
const denJob = den.body.job;
console.log("denoise job:", den.status, denJob?.id);
await api("POST", "/api/edges", { fromJobId: impJob.id, toJobId: denJob.id, fromPort: "micrographs", toPort: "micrographs" });
const d = await api("POST", `/api/jobs/${denJob.id}/run`, { remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } });
console.log("dispatch:", d.status, JSON.stringify(d.body).slice(0, 200));
for (let i = 0; i < 90; i++) {
  await sleep(2000);
  const j = (await api("GET", "/api/jobs")).body?.jobs?.find((x) => x.id === denJob.id);
  if (j && (j.status === "completed" || j.status === "failed")) {
    console.log("FINAL:", j.status, "|", (j.result ?? "").slice(0, 300));
    break;
  }
}
console.log("=== cluster workdir ===");
const wd = `/projects/cryoflow/${projId}/topazdenoise_${denJob.id.slice(-8)}`;
try { console.log(execSync(`node services/mock-cluster/test-client.mjs "ls -la ${wd}/ 2>&1 | head -20"`, { cwd: "/home/z/my-project", encoding: "utf8" })); } catch (e) { console.log("ls fail:", e.message.slice(0, 100)); }
try { console.log("--- run.err ---\n" + execSync(`node services/mock-cluster/test-client.mjs "cat ${wd}/run.err 2>&1"`, { cwd: "/home/z/my-project", encoding: "utf8" })); } catch (e) { console.log("err read fail"); }
try { console.log("--- run.out tail ---\n" + execSync(`node services/mock-cluster/test-client.mjs "tail -15 ${wd}/run.out 2>&1"`, { cwd: "/home/z/my-project", encoding: "utf8" })); } catch (e) { console.log("out read fail"); }
try { console.log("--- local workdir ---"); console.log(execSync(`ls -la /home/z/my-project/data/relion/${projId}/topazdenoise_${denJob.id.slice(-8)}/ 2>&1 | head`, { encoding: "utf8" })); } catch (e) {}
// keep world tidy-ish: print the ids for the next step
console.log("IDS:", JSON.stringify({ projId, impJob: impJob.id, denJob: denJob.id, connId }));
