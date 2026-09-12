// diag-t145-dash.mjs — exact probe replica: dashboard view at stamp time
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = (id, data) => {
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:${JSON.stringify(data)}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
const allCons = [];
p.on("console", (m) => {
  if (m.text().includes("[t145-diag]")) logs.push(m.text());
  else if (m.type() === "error") allCons.push(m.text().slice(0, 150));
});
p.on("pageerror", (e) => allCons.push("PAGEERR " + String(e).slice(0, 200)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(2000);

// seed AFTER boot on canvas, let polls see it running (prev established)
const created = await (await fetch(BASE + "/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "import", name: "T145Diag4", x: 140, y: 2000 }) })).json();
const j = created?.job ?? created;
stamp(j.id, { status: "running", progress: 50, startedAt: new Date().toISOString() });
await sleep(3500); // ≥2 polls on canvas: prev has it running

// NOW switch to dashboard and stamp completed there
const dashTab = p.locator('button[role="tab"][title*="Project dashboard"]');
await dashTab.click({ timeout: 6000 }).catch(() => dashTab.click({ force: true, timeout: 6000 }));
await sleep(1500);
stamp(j.id, { status: "completed", progress: 100, result: "diag-dash" });
await sleep(8000);

const dom = await p.evaluate(() =>
  [...document.querySelectorAll("ol > li")].map((li) => (li.textContent || "").slice(0, 90)),
);
console.log("diag lines:", JSON.stringify(logs, null, 1));
console.log("toast DOM:", JSON.stringify(dom));
console.log("errors:", allCons.slice(0, 5));

await fetch(BASE + "/api/jobs/" + j.id, { method: "DELETE" });
await b.close();
