// diag-t409-t271.mjs — replicate t271's flow, dump the resume DTO + the rendered rows.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function jfetch(url, body, method = "POST") {
  const r = await fetch(url, { method, headers: SH, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

const connId = `qa-t409p-${Date.now().toString(36)}`;
await jfetch(`${BASE}/api/remote/connections/${connId}`, null, "DELETE").catch(() => {});
const conn = await jfetch(`${BASE}/api/remote/connections`, {
  id: connId, name: "QA t409 Probe", host: "127.0.0.1", port: 3022,
  username: "cryo", password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow",
});
console.log("conn:", conn.status);

// a motioncorr job (default params fine — the run's shape is what matters)
const mc = await jfetch(`${BASE}/api/jobs`, { type: "motioncorr", name: "t409p motioncorr", params: { do_own_motioncor: false } });
const job = mc.body.job ?? mc.body;
console.log("job:", job.id);
const run = await jfetch(`${BASE}/api/jobs/${job.id}/run`, { remote: { connectionId: connId, module: "relion/5.0.1", mode: "direct" } });
console.log("dispatch:", run.status);
let st = null;
for (let i = 0; i < 120; i++) {
  await sleep(1000);
  const list = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json().catch(() => null);
  st = list?.jobs?.find((x) => x.id === job.id);
  if (st?.status === "completed" || st?.status === "failed") break;
}
console.log("run terminal:", st?.status);

// the resume DTO for THIS connection (the same call the dialog makes)
const list = await (await fetch(`${BASE}/api/remote/connections`, { headers: SH })).json();
const mine = (list.connections ?? []).find((c) => c.id === connId);
const e0 = mine?.resume?.recent?.[0];
console.log("resume entry:", JSON.stringify(e0));

// the browser: open the dialog, inspect the rows for THIS connection
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
await page.locator('button[aria-label="Remote clusters (SSH)"]').first().click({ force: true }).catch(() => {});
await sleep(2000);
const dom = await page.evaluate((cid) => {
  const card = document.querySelector(`[data-resume-connection="${cid}"]`) || document.querySelector("[data-run-resume]");
  const jumps = [...document.querySelectorAll("[data-resume-jump]")].map((b) => b.getAttribute("data-resume-entry"));
  const entries = [...document.querySelectorAll("[data-resume-entry]")].map((b) => b.getAttribute("data-resume-entry"));
  const connRows = [...document.querySelectorAll("[data-connection-id]")].map((b) => b.getAttribute("data-connection-id")).slice(0, 5);
  return { resumeCardConn: card ? (card.getAttribute("data-resume-connection") || "unmarked") : null, jumpEntries: jumps, allEntries: entries, connRows };
}, connId).catch((e) => ({ err: String(e).slice(0, 120) }));
console.log("dom:", JSON.stringify(dom).slice(0, 400));
await page.screenshot({ path: "/home/z/my-project/shots-qa/t409-t271.png" });
await browser.close();
await jfetch(`${BASE}/api/jobs/${job.id}`, null, "DELETE");
await jfetch(`${BASE}/api/remote/connections/${connId}`, null, "DELETE");
console.log("cleaned");
