// diag-t409-badge.mjs — dump the job card's badge HTML while a remote run is live.
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const MICS_DIR = "/home/z/my-project/data/relion/t409-badge-mics";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Content-Type": "application/json" };
rmSync(MICS_DIR, { recursive: true, force: true });
mkdirSync(MICS_DIR, { recursive: true });
for (let i = 1; i <= 6; i++) {
  const W = 64, H = 64;
  const buf = Buffer.alloc(1024 + W * H * 4);
  buf.writeInt32LE(W, 0); buf.writeInt32LE(H, 4); buf.writeInt32LE(1, 8);
  buf.writeInt32LE(2, 12);
  buf.writeInt32LE(W, 28); buf.writeInt32LE(H, 32); buf.writeInt32LE(1, 36);
  buf.writeFloatLE(1.77 * W, 40); buf.writeFloatLE(1.77 * H, 44); buf.writeFloatLE(1.77, 48);
  buf.write("MAP ", 208, "ascii");
  buf.writeUInt8(0x44, 212); buf.writeUInt8(0x44, 213); buf.writeUInt8(0x47, 214); buf.writeUInt8(0x47, 215);
  for (let j = 0; j < W * H; j++) buf.writeFloatLE(Math.sin(j / 7) * 0.1, 1024 + j * 4);
  writeFileSync(`${MICS_DIR}/mic_0${i}.mrc`, buf);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function jfetch(url, body, method = "POST") {
  const r = await fetch(url, { method, headers: SH, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const proj = (await (await fetch(`${BASE}/api/projects`, { headers: SH })).json()).projects?.[0];
const imp = await jfetch(`${BASE}/api/jobs`, { projectId: proj.id, type: "import", name: "t409-badge import", params: { micrographsPath: MICS_DIR, pixelSize: 1.77, nodeType: "movies" } });
const impJob = imp.body.job ?? imp.body;
await jfetch(`${BASE}/api/jobs/${impJob.id}/run`, {});
let done = null;
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  const list = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json().catch(() => null);
  const j = list?.jobs?.find((x) => x.id === impJob.id);
  if (j?.status === "completed") { done = j; break; }
}
console.log("import:", done?.status);
const mc = await jfetch(`${BASE}/api/jobs`, { projectId: proj.id, type: "motioncorr", name: "t409-badge motioncorr", params: { do_own_motioncor: false } });
const mcJob = mc.body.job ?? mc.body;
await jfetch(`${BASE}/api/edges`, { fromJobId: impJob.id, toJobId: mcJob.id, fromPort: "micrographs", toPort: "movies" });
const connId = "qa-t409-badge";
await jfetch(`${BASE}/api/remote/connections/${connId}`, null, "DELETE").catch(() => {});
const conn = await jfetch(`${BASE}/api/remote/connections`, { id: connId, name: "QA t409 Badge", host: "127.0.0.1", port: 3022, username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow" });
console.log("conn:", conn.status);
const run2 = await jfetch(`${BASE}/api/jobs/${mcJob.id}/run`, { remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } });
console.log("dispatch:", run2.status);

// browser: watch the card
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(3000);
for (let i = 0; i < 30; i++) {
  const info = await page.evaluate((jid) => {
    const card = document.querySelector(`[data-job="${jid}"]`);
    if (!card) return { card: false };
    const ariaEls = [...card.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).filter((l) => l && l.toLowerCase().includes("cluster"));
    return { card: true, cardHtml: card.innerHTML.length, ariaEls, full: card.innerHTML.slice(0, 4000) };
  }, mcJob.id).catch((e) => ({ err: String(e).slice(0, 100) }));
  const list = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json().catch(() => null);
  const j = list?.jobs?.find((x) => x.id === mcJob.id);
  console.log(`t=${i}s status=${j?.status} ariaEls=${JSON.stringify(info.ariaEls ?? [])}`);
  if (j?.status === "completed" || j?.status === "failed") {
    console.log("  runRemote in DTO:", JSON.stringify(j?.runRemote)?.slice(0, 200));
    console.log("  card HTML (first 4000):", info.full);
    break;
  }
  await sleep(1000);
}
await page.screenshot({ path: "/home/z/my-project/shots-qa/t409-badge.png" });
await browser.close();
await jfetch(`${BASE}/api/jobs/${mcJob.id}`, null, "DELETE");
await jfetch(`${BASE}/api/jobs/${impJob.id}`, null, "DELETE");
console.log("cleaned");
