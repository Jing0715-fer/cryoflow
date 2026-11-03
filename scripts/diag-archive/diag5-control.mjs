// diag5 — control: shift-click with NO find flow, on a far empty-area seed
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(1500);

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
const j = await (await api("/api/jobs", "POST", { type: "import", name: "DIAG5 Far", workspaceId: wsList[0].id, x: 2000, y: 1600 })).json();
const jid = (j?.job ?? j).id;
await sleep(5000);

const bb = await p.locator(`[data-job="${jid}"]`).boundingBox().catch(() => null);
console.log("bbox:", bb && `${Math.round(bb.x)},${Math.round(bb.y)} ${Math.round(bb.width)}x${Math.round(bb.height)}`);
if (bb) {
  const hit = await p.evaluate(({ x, y, sel }) => {
    const e = document.elementFromPoint(x, y);
    return e ? (e.closest(`[data-job="${sel}"]`) ? "ON-CARD" : e.tagName + "." + (e.className?.toString?.().slice(0, 40) ?? "")) : "null";
  }, { x: bb.x + bb.width * 0.5, y: bb.y + bb.height * 0.5, sel: jid });
  console.log("hit check:", hit);
  await p.keyboard.down("Shift");
  await p.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.5);
  await p.keyboard.up("Shift");
  await sleep(600);
  const tb = await p.evaluate(() => document.querySelector('[data-canvas-ui="selection-toolbar"]')?.textContent ?? "no-toolbar");
  console.log("toolbar:", JSON.stringify(tb));
}

await fetch(`${BASE}/api/jobs/${jid}`, { method: "DELETE" });
await b.close();
