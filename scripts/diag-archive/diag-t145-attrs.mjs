// diag-t145-attrs.mjs — generous waits; dump the toast li's real attributes
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
p.on("console", (m) => { if (m.text().includes("[t145-diag]")) logs.push(m.text()); });
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(2000);

const created = await (await fetch(BASE + "/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "import", name: "T145Diag7", x: 140, y: 2000 }) })).json();
const j = created?.job ?? created;
stamp(j.id, { status: "running", progress: 10, startedAt: new Date().toISOString() });
await sleep(8000); // ≥1 full poll cycle at the SLOW 6s cadence: prev MUST hold "running"
stamp(j.id, { status: "completed", progress: 100, result: "done" });
await sleep(8000); // another full cycle: the transition poll must have fired

const attrs = await p.evaluate(() =>
  [...document.querySelectorAll("ol > li")].map((li) => ({
    role: li.getAttribute("role"),
    state: li.dataset.state ?? null,
    hasTitle: !!li.querySelector("[data-title]"),
    titleText: li.querySelector("[data-title]")?.textContent ?? null,
    txt: (li.textContent || "").slice(0, 70),
  })),
);
console.log("diag lines:", JSON.stringify(logs, null, 1));
console.log("toast attrs:", JSON.stringify(attrs, null, 1));

await fetch(BASE + "/api/jobs/" + j.id, { method: "DELETE" });
await b.close();
