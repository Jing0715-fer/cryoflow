// diag3 — which click gesture actually toggles selection after reach?
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
p.on("pageerror", (e) => errs.push("PAGEERROR " + e));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(1500);

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
const mk = async (name) => (await (await api("/api/jobs", "POST", { type: "import", name, workspaceId: wsList[0].id, x: 140, y: 300 })).json());
const j1 = await mk("DIAG3 A");
const j2 = await mk("DIAG3 B");
const j3 = await mk("DIAG3 C");
const id1 = (j1?.job ?? j1).id, id2 = (j2?.job ?? j2).id, id3 = (j3?.job ?? j3).id;
await sleep(5000);

const reach = async (name) => {
  await p.keyboard.press("Control+f");
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Control+a");
  await p.keyboard.type(name, { delay: 20 });
  await sleep(350);
  await p.keyboard.press("Enter");
  await sleep(1000);
  await p.keyboard.press("Escape");
  await sleep(500);
};
const tb = async () => await p.evaluate(() => document.querySelector('[data-canvas-ui="selection-toolbar"]')?.textContent ?? "no-toolbar");

// (a) locator.click with Shift modifier
await reach("DIAG3 A");
await p.locator(`[data-job="${id1}"]`).click({ modifiers: ["Shift"], timeout: 5000 }).catch((e) => console.log("a-err:", e.message?.slice(0, 80)));
await sleep(500);
console.log("(a) locator shift-click →", await tb());

// (b) plain click (no shift)
await reach("DIAG3 B");
await p.locator(`[data-job="${id2}"]`).click({ timeout: 5000 }).catch((e) => console.log("b-err:", e.message?.slice(0, 80)));
await sleep(500);
console.log("(b) plain click →", await tb());

// (c) manual keyboard shift + mouse click
await reach("DIAG3 C");
const box = await p.locator(`[data-job="${id3}"]`).boundingBox();
await p.keyboard.down("Shift");
await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
await p.keyboard.up("Shift");
await sleep(500);
console.log("(c) manual shift+mouse →", await tb());

// (d) plain mouse click, no shift at all
const box1 = await p.locator(`[data-job="${id1}"]`).boundingBox();
await p.mouse.click(box1.x + box1.width / 2, box1.y + box1.height * 0.6);
await sleep(500);
console.log("(d) plain mouse on A →", await tb());

console.log("console errors:", errs.length, errs.slice(0, 3));
for (const id of [id1, id2, id3]) await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" });
await b.close();
