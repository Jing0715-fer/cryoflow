// t534 — the t268 motioncorr failure's out-of-band reproduction.
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const DB = "/home/z/my-project/db/cryoflow.db";
const MICS_DIR = "/home/z/my-project/data/relion/t534mc-mics";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dbRead = (sql, arg) =>
  JSON.parse(execSync(
    `python3 -c "import sqlite3,json,sys;c=sqlite3.connect('${DB}');print(json.dumps(c.execute(sys.argv[1],(sys.argv[2],)).fetchone()))" "${sql}" "${arg}"`,
    { encoding: "utf8", timeout: 10_000 }
  ));

// 4 movie mics (the t268 rig shape: 64x64)
mkdirSync(MICS_DIR, { recursive: true });
const W = 64, H = 64;
for (let k = 1; k <= 4; k++) {
  const n = `mov_${String(k).padStart(2, "0")}.mrc`;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let i = 0; i < W * H; i++) buf.writeFloatLE(Math.sin((i + k) / 7) * 0.1, 1024 + i * 4);
  writeFileSync(path.join(MICS_DIR, n), buf);
}

const imp = await (await fetch(`${BASE}/api/jobs`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "import", name: "diag MC Import", params: { micrographsPath: MICS_DIR, pixelSize: 1.77 } }),
})).json();
const impJob = imp?.job ?? imp;
await fetch(`${BASE}/api/jobs/${impJob.id}/run`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({}) });
for (let i = 0; i < 30; i++) { await sleep(1000); if (dbRead("SELECT status FROM Job WHERE id=?", impJob.id)[0] === "completed") break; }
console.log("import:", dbRead("SELECT status FROM Job WHERE id=?", impJob.id).join(" "));

const connId = `qa-t534mc-${Date.now().toString(36)}`;
await fetch(`${BASE}/api/remote/connections`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ id: connId, name: "QA t534 MC", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" }),
});
const mc = await (await fetch(`${BASE}/api/jobs`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "motioncorr", name: "diag MotionCorr" }),
})).json();
const mcJob = mc?.job ?? mc;
const es = await fetch(`${BASE}/api/edges`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({ fromJobId: impJob.id, toJobId: mcJob.id, fromPort: "micrographs", toPort: "movies" }) });
console.log("edge:", es.status, JSON.stringify(await es.json().catch(() => null)).slice(0, 120));
const disp = await fetch(`${BASE}/api/jobs/${mcJob.id}/run`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
});
console.log("dispatch:", disp.status);
for (let i = 0; i < 60; i++) {
  await sleep(2000);
  const st = dbRead("SELECT status FROM Job WHERE id=?", mcJob.id);
  if (st[0] !== "pending" && st[0] !== "running") break;
}
const v = dbRead("SELECT status, result FROM Job WHERE id=?", mcJob.id);
console.log("MC verdict:", v[0], "\n", (v[1] ?? "").slice(0, 600));

await fetch(`${BASE}/api/jobs/${mcJob.id}`, { method: "DELETE", headers: SH });
await fetch(`${BASE}/api/jobs/${impJob.id}`, { method: "DELETE", headers: SH });
await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH });
execSync(`rm -rf ${MICS_DIR}`);
console.log("cleaned");
