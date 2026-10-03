// t534 — reproduce the t266 cluster-LoG failure out of band: import + LoG
// autopick on the mock cluster, then read the verdict row. No assertions —
// this is the testimony collector for the t534 window's diagnosis.
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const DB = "/home/z/my-project/db/cryoflow.db";
const MICS_DIR = "/home/z/my-project/data/relion/t534diag-mics";
const SH = {
  Origin: BASE, Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dbRead = (sql, arg) =>
  JSON.parse(execSync(
    `python3 -c "import sqlite3,json,sys;c=sqlite3.connect('${DB}');` +
    `print(json.dumps(c.execute(sys.argv[1], (sys.argv[2],)).fetchone()))" "${sql}" "${arg}"`,
    { encoding: "utf8", timeout: 10_000 }
  ));

// 6 micrographs
mkdirSync(MICS_DIR, { recursive: true });
const W = 64, H = 64;
for (let k = 1; k <= 6; k++) {
  const n = `mic_${String(k).padStart(2, "0")}.mrc`;
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

// (no project creation — jobs land in whatever world is already active)
const mkJob = async (body) => (await (await fetch(`${BASE}/api/jobs`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify(body),
})).json())?.job;
const mkEdge = async (f, t, fp, tp) => (await fetch(`${BASE}/api/edges`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ fromJobId: f, toJobId: t, fromPort: fp, toPort: tp }),
})).status;

const connId = `qa-t534diag-${Date.now().toString(36)}`;
await fetch(`${BASE}/api/remote/connections`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ id: connId, name: "QA t534 diag", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" }),
});

// NO fresh project — the t266 suite runs in the ACTIVE world (its mkJob
// lands in whatever project is active). Replicate that: jobs go to the
// active world; cleanup deletes only our jobs, not the world.
const activeId = JSON.parse(readFileSync("/home/z/my-project/data/projects.json", "utf8")).active;
console.log("active world:", activeId);

const imp = await mkJob({ type: "import", name: "diag Import t534", params: { micrographsPath: MICS_DIR, pixelSize: 1.77 } });
// the suite runs with a browser polling /api/jobs — replicate that lane
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
await fetch(`${BASE}/api/jobs/${imp.id}/run`, { method: "POST", headers: { ...SH, "Content-Type": "application/json" }, body: JSON.stringify({}) });
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  if (dbRead("SELECT status FROM Job WHERE id=?", imp.id)[0] === "completed") break;
}
console.log("import:", dbRead("SELECT status FROM Job WHERE id=?", imp.id).join(" "));

const log_ = await mkJob({ type: "autopick", name: "diag LoG", params: { picker: "log" } });
console.log("edge:", await mkEdge(imp.id, log_.id, "micrographs", "micrographs"));
const disp = await fetch(`${BASE}/api/jobs/${log_.id}/run`, {
  method: "POST", headers: { ...SH, "Content-Type": "application/json" },
  body: JSON.stringify({ remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } }),
});
console.log("dispatch:", disp.status, JSON.stringify((await disp.json().catch(() => null)) ?? {}).slice(0, 200));
for (let i = 0; i < 60; i++) {
  await sleep(2000);
  const st = dbRead("SELECT status FROM Job WHERE id=?", log_.id);
  if (st[0] !== "pending" && st[0] !== "running") break;
}
const verdict = dbRead("SELECT status, result FROM Job WHERE id=?", log_.id);
console.log("LoG verdict:", verdict[0], "\n", (verdict[1] ?? "").slice(0, 500));
console.log("console errors:", consoleErrors.length);

// cleanup: OUR jobs only (the world stays)
await fetch(`${BASE}/api/jobs/${log_.id}`, { method: "DELETE", headers: SH });
await fetch(`${BASE}/api/jobs/${imp.id}`, { method: "DELETE", headers: SH });
await fetch(`${BASE}/api/remote/connections/${connId}`, { method: "DELETE", headers: SH });
execSync(`rm -rf ${MICS_DIR}`);
console.log("cleaned");
