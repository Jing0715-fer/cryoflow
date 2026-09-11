// t123-shot — visual acceptance for the pipeline timeline (Task 123).
// Seeds the same engine-stamped windows as the e2e probe, screenshots the
// dashboard timeline on screen and on simulated paper, then cleans up.
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

const SEEDS = [
  ["TL Import", "import", "completed", 180, 12000],
  ["TL MotionCorr", "motioncorr", "completed", 150, 30000],
  ["TL CtfFind", "ctffind", "completed", 100, 8000],
  ["TL Extract", "extract", "failed", 60, 25000],
  ["TL Class2d", "class2d", "running", 15, 99999],
  ["TL Select", "select", "idle", null, null],
];

async function main() {
  const ws = ((await (await api("/api/workspaces")).json()).workspaces ?? [])[0];
  const maxY = ((await (await api("/api/jobs")).json()).jobs ?? []).reduce(
    (m, j) => Math.max(m, (j.y ?? 0) + 240), 800
  );
  const cws = await (await api("/api/workspaces", "POST", { name: "TL123 shot" })).json();
  const wsId = cws?.workspace?.id ?? cws?.id;
  const nowMs = Date.now();
  const ids = [];
  let y = maxY + 240;
  for (const [name, type, status, ago, dur] of SEEDS) {
    const j = (await (await api("/api/jobs", "POST", { type, name, workspaceId: wsId, x: 140, y })).json());
    const job = j?.job ?? j;
    y += 240;
    if (ago != null) {
      sh(`node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();` +
        `p.job.update({where:{id:'${job.id}'},data:{status:'${status}',progress:${status === "running" ? 40 : 100},` +
        `startedAt:new Date('${new Date(nowMs - ago * 1000).toISOString()}'),duration:${dur}}}).then(()=>p.\\$disconnect())"`);
    }
    ids.push(job.id);
  }

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await sleep(1500);
  await p.click('button[role="tab"][title*="Project dashboard"]');
  await p.waitForSelector('section[aria-label="Pipeline analytics"]', { timeout: 30000 });
  await p.click('button:has-text("TL123 shot")');
  await p.waitForSelector('[data-canvas-ui="analytics-timeline"]', { timeout: 30000 });
  await p.locator("section[aria-label='Pipeline analytics']").screenshot({
    path: ".next/t123-screen.png",
  });
  await p.emulateMedia({ media: "print" });
  await sleep(300);
  await p.locator("section[aria-label='Pipeline analytics']").screenshot({
    path: ".next/t123-paper.png",
  });
  await b.close();

  for (const id of ids) await api(`/api/jobs/${id}`, "DELETE").catch(() => {});
  await api(`/api/workspaces/${wsId}`, "DELETE").catch(() => {});
  console.log("SHOTS SAVED: .next/t123-screen.png .next/t123-paper.png");
}
main().catch((e) => { console.error(e); process.exit(1); });
