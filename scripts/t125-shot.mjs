// t125-shot — visual acceptance: history panel kind icons + disclosure group
import { chromium } from "playwright";
import { setTimeout as sleep } from "timers/promises";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
mkdirSync(".next/t125-shots", { recursive: true });
const api = async (path, method = "GET", body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
};
const listJobs = async () => {
  const j = await (await api("/api/jobs")).json();
  return j.jobs ?? j;
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const seeded = [];
try {
  const all = await listJobs();
  for (const j of all.filter((j) => j.name?.startsWith("t125s "))) {
    await api(`/api/jobs/${j.id}`, "DELETE");
  }
  const wsId = (await (await api("/api/workspaces")).json()).workspaces?.[0]?.id ?? "";
  const maxY = all.reduce((m, j) => Math.max(m, j.y ?? 0), 0);
  const maxX = all.reduce((m, j) => Math.max(m, j.x ?? 0), 0);
  const X0 = Math.round(maxX + 3000), Y0 = Math.round(maxY + 2200);
  for (const [name, x, y] of [["t125s A", X0, Y0], ["t125s B", X0 + 320, Y0], ["t125s C", X0, Y0 + 260], ["t125s D", X0 + 320, Y0 + 260]]) {
    const r = await (await api("/api/jobs", "POST", { type: "refine3d", name, workspaceId: wsId, x, y })).json();
    seeded.push(r.job.id);
  }
  await p.goto(BASE, { waitUntil: "networkidle" });
  await sleep(1200);
  for (let i = 0; i < 4 && (await p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? "")) !== "canvas"; i++) {
    await p.keyboard.press("Shift+C");
    await sleep(700);
  }
  await p.keyboard.press("0");
  await sleep(600);
  const g = await p.evaluate(() => {
    const svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    const vb = (svg?.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
    const r = svg.getBoundingClientRect();
    return { wx: vb[0], wy: vb[1], ww: vb[2], wh: vb[3], x: r.x, y: r.y, w: r.width, h: r.height };
  });
  // LETTERBOX-AWARE (the t118 lesson): preserveAspectRatio xMidYMid gives a
  // clamped map centered bands + uniform scale — inversion must know it
  const w2c = (wx, wy) => {
    const s = Math.min(g.w / g.ww, g.h / g.wh);
    const ox = (g.w - g.ww * s) / 2;
    const oy = (g.h - g.wh * s) / 2;
    return { x: g.x + ox + (wx - g.wx) * s, y: g.y + oy + (wy - g.wy) * s };
  };
  const home = w2c(X0 + 160, Y0 + 130);
  await p.mouse.click(home.x, home.y);
  await sleep(700);

  const drag = async (id, dx, dy) => {
    const box = await p.locator(`[data-job="${id}"]`).boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 });
    await p.mouse.up();
    await sleep(900);
  };
  for (const id of seeded) await drag(id, 60, 40);

  // delete D via keyboard for the kind mix
  await p.locator(`[data-job="${seeded[3]}"]`).click();
  await sleep(250);
  await p.keyboard.press("Delete");
  await sleep(500);
  await p.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await sleep(1000);

  await p.locator('[data-canvas-ui="history-trigger"]').click();
  await sleep(400);
  await p.screenshot({ path: ".next/t125-shots/panel-collapsed.png" });

  // expand the move group
  await p.locator('[data-canvas-ui="history-group"]').first().click();
  await sleep(300);
  await p.screenshot({ path: ".next/t125-shots/panel-expanded.png" });
  console.log("shots saved: .next/t125-shots/{panel-collapsed,panel-expanded}.png");
} finally {
  try { await p.close(); } catch {}
  try { await b.close(); } catch {}
  for (const id of seeded) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
}
