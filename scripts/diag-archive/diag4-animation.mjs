// diag4 — is the post-focus view still animating when we click?
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
const j = await (await api("/api/jobs", "POST", { type: "import", name: "DIAG4 A", workspaceId: wsList[0].id, x: 140, y: 300 })).json();
const jid = (j?.job ?? j).id;
await sleep(5000);

await p.keyboard.press("Control+f");
await p.locator('[data-testid="canvas-find-input"]').click();
await p.keyboard.press("Control+a");
await p.keyboard.type("DIAG4 A", { delay: 20 });
await sleep(350);
await p.keyboard.press("Enter");
// sample the card's bbox right after Enter, no Escape yet
for (let i = 0; i < 9; i++) {
  if (i > 0) await sleep(400);
  const bb = await p.locator(`[data-job="${jid}"]`).boundingBox().catch(() => null);
  console.log(`t≈${i * 400}ms bbox:`, bb && `${Math.round(bb.x)},${Math.round(bb.y)} ${Math.round(bb.width)}x${Math.round(bb.height)}`);
}
await p.keyboard.press("Escape");
await sleep(400);
const bb2 = await p.locator(`[data-job="${jid}"]`).boundingBox().catch(() => null);
console.log("after Escape:", bb2 && `${Math.round(bb2.x)},${Math.round(bb2.y)} ${Math.round(bb2.width)}x${Math.round(bb2.height)}`);

await fetch(`${BASE}/api/jobs/${jid}`, { method: "DELETE" });
await b.close();
