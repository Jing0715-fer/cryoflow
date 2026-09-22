import { chromium } from "playwright";
import { execSync } from "child_process";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stampEx = (id, data) => execSync(`node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`, { cwd: "/home/z/my-project", stdio: "pipe" });
const api = async (path, method = "GET", body) => fetch(BASE + path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });

// rebuild minimal fixture
const mk = async (name, type, y) => { const r = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json(); return r?.job ?? r; };

const up = await mk("T150D Up", "import", 300);
const dn = await mk("T150D DA", "motioncorr", 540);
await api("/api/edges", "POST", { fromJobId: up.id, toJobId: dn.id });
stampEx(up.id, { status: "completed", progress: 100 });
await sleep(2500);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]');
await sleep(1000);
stampEx(dn.id, { status: "pending", progress: 0 });
await sleep(1600);
stampEx(dn.id, { status: "running", progress: 5, startedAt: new Date().toISOString() });
for (let i = 0; i < 48; i++) {
  const loc = p.locator('ol > li[data-state="open"]', { hasText: "T150D DA" });
  if (await loc.count()) {
    const li = loc.first();
    console.log("=== LI HTML ===");
    console.log((await li.evaluate((el) => el.outerHTML)).slice(0, 1600));
    console.log("=== buttons with hasText View ===", await li.locator("button", { hasText: "View" }).count());
    console.log("=== all buttons ===", await li.locator("button").count());
    for (const btn of await li.locator("button").all()) {
      console.log("  btn text:", JSON.stringify(((await btn.textContent()) ?? "").trim()).slice(0, 60), "aria:", await btn.getAttribute("aria-label"));
    }
    break;
  }
  await sleep(250);
}
// purge
execSync(`node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.deleteMany({where:{name:{startsWith:"T150D"}}}).then(()=>p.$disconnect())'`, { cwd: "/home/z/my-project", stdio: "pipe" });
await b.close();
