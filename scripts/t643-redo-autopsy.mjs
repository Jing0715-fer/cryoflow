// t643 redo autopsy PART 2 — the entry captures a polluted x AT DRAG TIME
// (drag DB = redo DB = orig.x-4807 while y is exactly +90). The store's live
// position is readable from the minimap dot's x/y attributes (x={job.x}).
// This pass compares STORE vs DB at every step, logs the viewport transform
// before/after the drag (glide/animation suspicion), and runs the drag TWICE:
// once immediately after the minimap navigation, once after a 2.5s settle.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

const api = async (path, method = "GET", body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
};
const listJobs = async () => {
  const r = await api("/api/jobs");
  const j = await r.json();
  return j.jobs ?? j;
};
const posOf = async (id) => {
  const j = (await listJobs()).find((j) => j.id === id);
  return j ? { x: j.x, y: j.y } : null;
};
/** store's live position for the card, read off the minimap dot's x/y attrs */
const storePos = async (id) =>
  p.evaluate((jobId) => {
    const el = document.querySelector(`[data-canvas-ui="minimap-dot"][data-job-id="${jobId}"]`);
    return el ? { x: Number(el.getAttribute("x")), y: Number(el.getAttribute("y")) } : null;
  }, id);
const viewport = async () =>
  p.evaluate(() => {
    const el = document.querySelector('[data-canvas="workspace"]');
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(el instanceof HTMLElement ? el.style.transform : "");
    return m ? { x: +m[1], y: +m[2], zoom: +m[3] } : null;
  });

try {
  const existing = await listJobs();
  for (const j of existing.filter((j) => j.name?.startsWith("t643 probe"))) {
    await api(`/api/jobs/${j.id}`, "DELETE");
  }
  const all = await listJobs();
  const wsId = (await (await api("/api/workspaces")).json()).workspaces?.[0]?.id ?? "";
  const X0 = Math.round(all.reduce((m, j) => Math.max(m, j.x ?? 0), 0) + 3000);
  const Y0 = Math.round(all.reduce((m, j) => Math.max(m, j.y ?? 0), 0) + 2200);
  const r = await (await api("/api/jobs", "POST", { type: "refine3d", name: "t643 probe", workspaceId: wsId, x: X0, y: Y0 })).json();
  const id = r.job.id;
  console.log(`seeded at ${X0},${Y0}`);

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
    const vb = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
    const r = svg.getBoundingClientRect();
    return { wx: vb[0], wy: vb[1], ww: vb[2], wh: vb[3], x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const sc = Math.min(g.w / g.ww, g.h / g.wh);
  const ox = (g.w - g.ww * sc) / 2, oy = (g.h - g.wh * sc) / 2;
  await p.mouse.click(g.x + ox + (X0 + 110 - g.wx) * sc, g.y + oy + (Y0 + 48 - g.wy) * sc);
  await sleep(700);

  const orig = await posOf(id);
  console.log("DB orig:", orig, "| viewport after nav:", await viewport(), "| store:", await storePos(id));

  const box = await p.locator(`[data-job="${id}"]`).boundingBox();
  if (!box) { console.log("FATAL: card not on screen"); process.exit(1); }

  // ---- DRAG 1: immediately (current suite flow) ----
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 90, { steps: 6 });
  await p.mouse.up();
  await sleep(400);
  console.log("DRAG1 immediate: DB =", await posOf(id), "| store =", await storePos(id), "| viewport:", await viewport());

  // undo back to orig
  await p.keyboard.press("Control+z");
  await sleep(1200);
  console.log("after undo:      DB =", await posOf(id), "| store =", await storePos(id));

  // ---- DRAG 2: after a 2.5s settle ----
  await sleep(2500);
  const box2 = await p.locator(`[data-job="${id}"]`).boundingBox();
  const vp2 = await viewport();
  console.log("pre-drag2 settled: viewport:", vp2, "store:", await storePos(id));
  await p.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await p.mouse.down();
  await p.mouse.move(box2.x + box2.width / 2 + 140, box2.y + box2.height / 2 + 90, { steps: 6 });
  await p.mouse.up();
  await sleep(400);
  console.log("DRAG2 settled:    DB =", await posOf(id), "| store =", await storePos(id), "| viewport:", await viewport());
  console.log("  expected if healthy: DB.x = orig.x + 140/zoom-ish, DB.y = orig.y + 90/zoom-ish");
  console.log("  (zoom =", vp2?.zoom, ") expected world delta:", vp2 ? { dx: 140 / vp2.zoom, dy: 90 / vp2.zoom } : null);

  // undo again, then redo — does redo converge to DRAG2's DB value this time?
  await p.keyboard.press("Control+z");
  await sleep(1200);
  console.log("after undo2:     DB =", await posOf(id), "| store =", await storePos(id));
  await p.keyboard.press("Control+Shift+z");
  await sleep(1500);
  console.log("after redo:      DB =", await posOf(id), "| store =", await storePos(id), "(expect == DRAG2 DB)");

  console.log("console errors:", consoleErrors.length);
} finally {
  try {
    const all2 = await listJobs();
    for (const j of all2.filter((j) => j.name?.startsWith("t643 probe"))) {
      await api(`/api/jobs/${j.id}`, "DELETE");
    }
  } catch {}
  await p.close().catch(() => {});
  await b.close().catch(() => {});
}
