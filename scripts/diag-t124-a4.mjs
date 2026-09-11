// diag-t124-a4 — who intercepts the failed-row click?
import { execSync } from "node:child_process";
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

async function main() {
  const wsList = (await (await api("/api/workspaces")).json()).workspaces ?? [];
  const cws = await (await api("/api/workspaces", "POST", { name: "TL124 diag" })).json();
  const wsId = cws?.workspace?.id ?? cws?.id;
  const maxY = ((await (await api("/api/jobs")).json()).jobs ?? []).reduce(
    (m, j) => Math.max(m, (j.y ?? 0) + 240), 800
  );
  const nowMs = Date.now();
  const ids = [];
  const seeds = [
    ["TL Diag A", "motioncorr", "completed", 60, 10000, maxY + 240],
    ["TL Diag B", "ctffind", "failed", 30, 8000, maxY + 480],
  ];
  for (const [name, type, status, ago, dur, y] of seeds) {
    const j = (await (await api("/api/jobs", "POST", { type, name, workspaceId: wsId, x: 140, y })).json());
    const job = j?.job ?? j;
    sh(`node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();` +
      `p.job.update({where:{id:'${job.id}'},data:{status:'${status}',progress:100,` +
      `startedAt:new Date('${new Date(nowMs - ago * 1000).toISOString()}'),duration:${dur}}}).then(()=>p.\\$disconnect())"`);
    ids.push(job.id);
  }

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await sleep(1200);
  await p.click('button[role="tab"][title*="Project dashboard"]');
  await p.waitForSelector('section[aria-label="Pipeline analytics"]', { timeout: 30000 });
  await p.click('button:has-text("TL124 diag")');
  await p.waitForSelector('[data-canvas-ui="analytics-timeline"]', { timeout: 30000 });
  const row = p.locator('[data-tl-row][data-status="completed"]');
  await row.click();
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(800);
  // back to dashboard
  await p.click('button[role="tab"][title*="Project dashboard"]');
  await p.waitForSelector('[data-canvas-ui="analytics-timeline"]', { timeout: 30000 });
  await sleep(300);
  const failed = p.locator('[data-tl-row][data-status="failed"]');
  await failed.scrollIntoViewIfNeeded();
  await sleep(400);
  const bb = await failed.boundingBox();
  console.log("row bbox after scroll:", JSON.stringify(bb));
  const probe = await p.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    const chain = [];
    let cur = el;
    while (cur && chain.length < 6) {
      chain.push(
        `${cur.tagName}.${String(cur.className?.baseVal ?? cur.className ?? "").slice(0, 60)}` +
        (cur.getAttribute?.("data-canvas-ui") ? `[data-canvas-ui=${cur.getAttribute("data-canvas-ui")}]` : "")
      );
      cur = cur.parentElement;
    }
    const html = document.documentElement;
    return {
      at: [x, y],
      chain,
      scrollY: window.scrollY,
      bodyH: document.body.scrollHeight,
      htmlOverflow: getComputedStyle(html).overflow,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  }, [bb.x + bb.width / 2, bb.y + bb.height / 2]);
  console.log("hit test:", JSON.stringify(probe, null, 1));
  await b.close();
  for (const id of ids) await api(`/api/jobs/${id}`, "DELETE").catch(() => {});
  await api(`/api/workspaces/${wsId}`, "DELETE").catch(() => {});
}
main().catch((e) => { console.error(e); process.exit(1); });
