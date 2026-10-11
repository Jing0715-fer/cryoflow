// diag-t145-toastpipe.mjs — does the toast pipeline render AT ALL?
import { chromium } from "playwright";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(1200);

await p.locator("[role=tab]:has-text('Workspaces')").click({ timeout: 8000 });
await sleep(800);
// open the create dialog
const newBtn = p.locator("button:has-text('New Workspace'), button:has-text('New workspace'), button[title*='workspace' i]").first();
console.log("newBtn count:", await newBtn.count());
await newBtn.click({ timeout: 8000 }).catch(async (e) => {
  console.log("newBtn click failed, trying any dialog-opener:", String(e).slice(0, 120));
  await p.locator("button").filter({ has: p.locator("svg.lucide-plus") }).first().click({ timeout: 5000 });
});
await sleep(800);
const inp = p.locator("#new-workspace-name");
console.log("input count:", await inp.count());
await inp.fill("T145ToastWs");
const btn = p.locator("button:has-text('Create'), button:has-text('Add')").first();
console.log("btn count:", await btn.count());
await btn.click();
await sleep(2000);

const probe = await p.evaluate(() => ({
  liRoleStatus: document.querySelectorAll("li[role=status]").length,
  workspaceToast: [...document.querySelectorAll("li")]
    .filter((l) => (l.textContent || "").includes("Workspace created"))
    .map((l) => l.textContent.slice(0, 80)),
  viewportTag: document.querySelector("ol[tabindex], ol[class*=fixed]")?.tagName ?? null,
}));
console.log("probe:", JSON.stringify(probe));
console.log("pageerrors:", errs);

const ws = await (await fetch("http://localhost:3000/api/workspaces")).json();
const bad = (ws.workspaces ?? []).find((w) => w.name === "T145ToastWs");
if (bad) {
  await fetch("http://localhost:3000/api/workspaces/" + bad.id, { method: "DELETE" });
  console.log("ws deleted");
}
await b.close();
