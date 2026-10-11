// diag-t127-geometry — why does the shift-click grid scan never land?
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(1500);

// world state + boot-fit transform from the live canvas
const geo = await p.evaluate(() => {
  const cs = document.querySelector('[data-canvas-ui="pipeline-kpi"]');
  const kpi = cs ? cs.getBoundingClientRect() : null;
  const vp = document.querySelector("[data-view='canvas']");
  const svg = document.querySelector("svg");
  const g = svg ? svg.querySelector("g") : null;
  const tf = g ? getComputedStyle(g).transform : null;
  const jobs = [...document.querySelectorAll("[data-job]")].slice(0, 8).map((el) => {
    const r = el.getBoundingClientRect();
    return { id: el.getAttribute("data-job"), name: el.textContent?.slice(0, 24), x: r.x, y: r.y, w: r.width, h: r.height };
  });
  return { kpi: kpi && { x: kpi.x, y: kpi.y, w: kpi.width, h: kpi.height }, transform: tf, jobs, nJobs: document.querySelectorAll("[data-job]").length };
});
console.log("KPI bar:", JSON.stringify(geo.kpi));
console.log("canvas g transform:", geo.transform);
console.log("jobs on canvas:", geo.nJobs);
for (const j of geo.jobs) console.log("  ", JSON.stringify(j));

// seed like t127 and re-measure
const api = async (path, method = "GET", body) =>
  fetch(BASE + path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
const created = await (await api("/api/jobs", "POST", { type: "import", name: "DIAG t127 probe", workspaceId: wsList[0].id, x: 140, y: 300 })).json();
const jid = (created?.job ?? created).id;
await sleep(5000); // a poll tick
const probe = await p.evaluate((id) => {
  const el = document.querySelector(`[data-job="${id}"]`);
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const pts = [[0.5, 0.5], [0.5, 0.6], [0.5, 0.4], [0.3, 0.5], [0.7, 0.5], [0.5, 0.75]];
  const hits = pts.map(([fx, fy]) => {
    const x = r.x + r.width * fx, y = r.y + r.height * fy;
    const e = document.elementFromPoint(x, y);
    const job = e ? e.closest("[data-job]") : null;
    return { fx, fy, hit: job ? job.getAttribute("data-job") : (e ? e.tagName + "." + (e.className?.toString?.().slice(0, 30) ?? "") : "null") };
  });
  return { found: true, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, hits };
}, jid);
console.log("seeded card:", JSON.stringify(probe, null, 1));

await fetch(`${BASE}/api/jobs/${jid}`, { method: "DELETE" });
await b.close();
