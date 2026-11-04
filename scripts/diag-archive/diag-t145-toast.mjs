// diag-t145-toast.mjs — why doesn't the completion toast appear?
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
const cons = [];
p.on("console", (m) => { if (m.type() === "error") cons.push(m.text()); });
p.on("pageerror", (e) => cons.push("PAGEERR " + e));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(2500); // let a few polls establish prev

// seed a runner, let the client SEE it running
const created = await (await fetch(BASE + "/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "import", name: "T145Diag", x: 140, y: 2000 }) })).json();
const j = created?.job ?? created;
stamp(j.id, { status: "running", progress: 50, startedAt: new Date().toISOString() });
await sleep(3000); // ≥2 polls see it running

// now complete it and watch the DOM
stamp(j.id, { status: "completed", progress: 100, result: "diag result" });
let seen = null;
for (let i = 0; i < 20; i++) {
  const html = await p.evaluate(() => {
    const vp = document.querySelector("[data-radix-toast-viewport]");
    if (!vp) return "NO-VIEWPORT";
    return vp.innerHTML.slice(0, 1200) || "EMPTY-VIEWPORT";
  });
  if (!html.includes("NO-VIEWPORT") && !html.includes("EMPTY-VIEWPORT")) { seen = html; break; }
  await sleep(500);
}
console.log("viewport:", seen ?? "toast never appeared in 10s");
console.log("console errors:", cons.slice(0, 4));

// cleanup
await fetch(BASE + "/api/jobs/" + j.id, { method: "DELETE" });
await b.close();
