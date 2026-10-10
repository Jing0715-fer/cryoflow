// mini-diag: run the denoise lane once, print stateRuns outputs + local workdir
const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Content-Type": "application/json" };
const api = async (m, p, b) => { const r = await fetch(`${BASE}${p}`, { method: m, headers: SH, ...(b !== undefined ? { body: JSON.stringify(b) } : {}) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { execSync } = await import("node:child_process");
const { mkdirSync, writeFileSync, existsSync, readdirSync } = await import("node:fs");

const proj = await api("POST", "/api/projects", { name: `t416mini ${Date.now().toString(36)}` });
const projId = proj.body?.project?.id ?? proj.body?.id;
console.log("proj:", projId);
const FIX = "/home/z/my-project/data/relion/t416mini";
mkdirSync(FIX, { recursive: true });
for (const n of ["m1.mrc", "m2.mrc"]) {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8); buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  writeFileSync(`${FIX}/${n}`, buf);
}
const imp = (await api("POST", "/api/jobs", { type: "import", name: "mini import", params: { micrographsPath: FIX, pixelSize: 1.77 } })).body.job;
await api("POST", `/api/jobs/${imp.id}/run`, {});
for (let i = 0; i < 30; i++) { await sleep(1000); const j = (await api("GET", "/api/jobs")).body?.jobs?.find((x) => x.id === imp.id); if (j?.status === "completed") break; }
const connId = `qa-mini-${Date.now().toString(36)}`;
await api("POST", "/api/remote/connections", { id: connId, name: "QA mini", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" });
const den = (await api("POST", "/api/jobs", { type: "topazdenoise", name: "mini denoise", params: {} })).body.job;
await api("POST", "/api/edges", { fromJobId: imp.id, toJobId: den.id, fromPort: "micrographs", toPort: "micrographs" });
await api("POST", `/api/jobs/${den.id}/run`, { remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } });
let final = null;
for (let i = 0; i < 60; i++) {
  await sleep(2000);
  const j = (await api("GET", "/api/jobs")).body?.jobs?.find((x) => x.id === den.id);
  if (j && (j.status === "completed" || j.status === "failed")) { final = j; break; }
}
console.log("FINAL:", final?.status, "|", (final?.result ?? "").slice(0, 100));
// DB job's outputs
console.log("DB outputs:", JSON.stringify(final?.outputs ?? null).slice(0, 300));
// engine-state record
const st = JSON.parse((await import("node:fs")).readFileSync("/home/z/my-project/data/engine-state.json", "utf8"));
const rec = st?.runs?.[den.id] ?? st?.[den.id] ?? null;
console.log("STATE keys:", rec ? Object.keys(rec) : "NO RECORD");
console.log("STATE outputs:", JSON.stringify(rec?.outputs ?? null)?.slice(0, 300));
console.log("STATE workdir:", rec?.workdir ?? null);
// local workdir listing
const wd = `/home/z/my-project/data/relion/${projId}/topazdenoise_${den.id.slice(-8)}`;
console.log("local wd exists:", existsSync(wd), existsSync(wd) ? readdirSync(wd).join(", ") : "");
console.log("IDS:", JSON.stringify({ projId, denJob: den.id, connId }));
