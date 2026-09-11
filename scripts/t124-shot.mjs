// t124-shot — visual acceptance for the reveal arrival (Task 124).
// Clicks a timeline row and captures the canvas mid-flash (screen + a zoom
// of the card), then cleans up.
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
  const cws = await (await api("/api/workspaces", "POST", { name: "TL124 shot" })).json();
  const wsId = cws?.workspace?.id ?? cws?.id;
  const maxY = ((await (await api("/api/jobs")).json()).jobs ?? []).reduce(
    (m, j) => Math.max(m, (j.y ?? 0) + 240), 800
  );
  const nowMs = Date.now();
  const ids = [];
  const seeds = [
    ["TL Shot A", "motioncorr", "completed", 60, 10000, maxY + 240],
    ["TL Shot B", "ctffind", "failed", 30, 8000, maxY + 480],
  ];
  for (const [name, type, status, ago, dur, y] of seeds) {
    const j = (await (await api("/api/jobs", "POST", { type, name, workspaceId: wsId, x: 240, y })).json());
    const job = j?.job ?? j;
    sh(`node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();` +
      `p.job.update({where:{id:'${job.id}'},data:{status:'${status}',progress:100,` +
      `startedAt:new Date('${new Date(nowMs - ago * 1000).toISOString()}'),duration:${dur}}}).then(()=>p.\\$disconnect())"`);
    ids.push(job.id);
  }

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await sleep(1400);
  await p.click('button[role="tab"][title*="Project dashboard"]');
  await p.waitForSelector('section[aria-label="Pipeline analytics"]', { timeout: 30000 });
  await p.locator('button[title="Scope the analytics to the \u201cTL124 shot\u201d workspace"]').click();
  await p.waitForSelector('[data-canvas-ui="analytics-timeline"]', { timeout: 30000 });
  const row = p.locator('[data-tl-row][data-status="failed"]');
  await row.scrollIntoViewIfNeeded();
  await sleep(350);
  await row.click();
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(420); // mid-flash (1.15s animation), glide ~88% landed
  await p.screenshot({ path: ".next/t124-reveal.png" });
  await b.close();

  for (const id of ids) await api(`/api/jobs/${id}`, "DELETE").catch(() => {});
  await api(`/api/workspaces/${wsId}`, "DELETE").catch(() => {});
  console.log("SHOT SAVED: .next/t124-reveal.png");
}
main().catch((e) => { console.error(e); process.exit(1); });
