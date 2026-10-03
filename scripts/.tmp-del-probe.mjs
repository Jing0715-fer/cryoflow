// reproduce: inspector open on a completed refine3d → DELETE → who refetches?
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
// 1. create a probe job via API (refine3d)
const mk = await fetch(`${BASE}/api/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "refine3d", name: "QA DelProbe t533" }) });
const { job } = await mk.json();
console.log("probe:", job.id);
// flip completed + plant record
const { execSync } = await import("node:child_process");
execSync(`DATABASE_URL="file:/home/z/my-project/db/cryoflow.db" node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.job.update({where:{id:process.argv[1]},data:{status:'completed',progress:100}}).then(()=>p.\\$disconnect())" ${job.id}`, { cwd: "/home/z/my-project" });
const browser = await chromium.launch();
const page = await browser.newPage();
let t0 = Date.now();
page.on("request", (r) => { if (r.url().includes(job.id)) console.log(`t+${Date.now()-t0}ms REQ`, r.url().replace(BASE, "")); });
page.on("response", (r) => { if (r.status() >= 400) console.log(`t+${Date.now()-t0}ms HTTP ${r.status()}`, r.url().replace(BASE, "")); });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
t0 = Date.now();
await page.locator(`[data-job="${job.id}"]`).first().click({ force: true });
await page.waitForTimeout(3000);
console.log("--- DELETE now ---");
t0 = Date.now();
await fetch(`${BASE}/api/jobs/${job.id}`, { method: "DELETE" });
await page.waitForTimeout(5000);
console.log("--- window observed ---");
await browser.close();
