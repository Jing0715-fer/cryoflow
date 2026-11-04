// diag-t145-instrumented.mjs — capture the TEMP-DIAG console line + toast DOM
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
const errs = [];
p.on("console", (m) => { if (m.text().includes("[t145-diag]")) logs.push(m.text()); });
p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(2000);

// seed a runner, let ≥2 polls see it
const created = await (await fetch(BASE + "/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "import", name: "T145Diag3", x: 140, y: 2000 }) })).json();
const j = created?.job ?? created;
stamp(j.id, { status: "running", progress: 50, startedAt: new Date().toISOString() });
await sleep(3500);
stamp(j.id, { status: "completed", progress: 100, result: "diag" });
await sleep(5000);

const dom = await p.evaluate(() =>
  [...document.querySelectorAll("ol > li")].map((li) => (li.textContent || "").slice(0, 90)),
);
console.log("console-diag lines:", JSON.stringify(logs, null, 1));
console.log("pageerrors:", errs);
console.log("toast DOM:", JSON.stringify(dom));

await fetch(BASE + "/api/jobs/" + j.id, { method: "DELETE" });
await b.close();
