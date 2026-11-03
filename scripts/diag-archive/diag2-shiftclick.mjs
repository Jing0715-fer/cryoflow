// diag2 — full replay of the reach-first shift-click with forensics
import { chromium } from "playwright";
import { execSync } from "child_process";

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
const created = await (await api("/api/jobs", "POST", { type: "import", name: "DIAG2 Alpha", workspaceId: wsList[0].id, x: 140, y: 300 })).json();
const jid = (created?.job ?? created).id;
await sleep(5000);

// reach via find
await p.keyboard.press("Control+f");
await p.locator('[data-testid="canvas-find-input"]').click();
await p.keyboard.press("Control+a");
await p.keyboard.type("DIAG2 Alpha", { delay: 20 });
await sleep(350);
const matchInfo = await p.evaluate(() => document.querySelector('[data-testid="canvas-find-count"]')?.textContent ?? "no-count-el");
console.log("find count label:", JSON.stringify(matchInfo));
await p.keyboard.press("Enter");
await sleep(1000);
await p.keyboard.press("Escape");
await sleep(500);

const forensics = await p.evaluate((id) => {
  const el = document.querySelector(`[data-job="${id}"]`);
  if (!el) return { found: false };
  const cards = [...document.querySelectorAll(`[data-job="${id}"]`)];
  const rects = cards.map((c) => { const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, x: Math.round(r.x), y: Math.round(r.y) }; });
  const r = el.getBoundingClientRect();
  const cx = r.x + r.width * 0.5, cy = r.y + r.height * 0.6;
  const e = document.elementFromPoint(cx, cy);
  const chain = [];
  let cur = e;
  while (cur && chain.length < 5) { chain.push(`${cur.tagName}${cur.getAttribute?.("data-job") ? `[data-job]` : ""}.${(cur.className?.toString?.() ?? "").slice(0, 40)}`); cur = cur.parentElement; }
  return { found: true, nMatches: cards.length, rects, clickPoint: { cx, cy }, chain };
}, jid);
console.log("forensics:", JSON.stringify(forensics, null, 1));

// try the shift-click with detailed logging
const box = await p.locator(`[data-job="${jid}"]`).first().boundingBox();
console.log("bbox:", JSON.stringify(box));
await p.keyboard.down("Shift");
await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
await p.keyboard.up("Shift");
await sleep(600);
const tb = await p.evaluate(() => document.querySelector('[data-canvas-ui="selection-toolbar"]')?.textContent ?? "no-toolbar");
console.log("toolbar after click:", JSON.stringify(tb));

await fetch(`${BASE}/api/jobs/${jid}`, { method: "DELETE" });
await b.close();
