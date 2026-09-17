// diag-t266-inspector.mjs — why doesn't the chart show after the click?
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { Socket } from "node:net";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SH = { Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", Host: "localhost:3000" };

function mockListening() {
  return new Promise((resolve) => {
    const sock = new Socket();
    const done = (ok) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });
}

try { execSync("pkill -f agent-browser"); } catch {}
await sleep(400);
if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}

// find the most recent completed topaztrain job (t266's leftovers were cleaned; run a quick mini chain? no — diag on ANY topaztrain in state)
const st = JSON.parse(readFileSync("/home/z/my-project/data/engine-state.json", "utf8"));
const runs = st.runs ?? st;
const tId = Object.keys(runs).find((id) => runs[id]?.type === undefined);

// roster jobs list for type
const jobs = (await (await fetch(`${BASE}/api/jobs`)).json()).jobs ?? [];
const topaz = jobs.find((j) => j.type === "topaztrain" && j.status !== "idle");
console.log("topaztrain job on roster:", topaz?.id ?? "NONE", topaz?.status ?? "");
if (!topaz) { console.log("no topaztrain to diag — run t266 first"); process.exit(2); }

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1720, height: 940 } })).newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("PAGE ERR:", m.text().slice(0, 120)); });

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);

const matches = await page.locator(`[data-job="${topaz.id}"]`).count();
console.log("data-job matches:", matches);
for (let i = 0; i < matches; i++) {
  const el = page.locator(`[data-job="${topaz.id}"]`).nth(i);
  const vis = await el.isVisible().catch(() => false);
  const box = await el.boundingBox().catch(() => null);
  console.log(`  [${i}] visible=${vis} box=${box ? `${Math.round(box.width)}x${Math.round(box.height)}@${Math.round(box.x)},${Math.round(box.y)}` : "null"}`);
}

await page.locator(`[data-job="${topaz.id}"]`).first().click({ force: true });
await sleep(1800);
const dlgCount = await page.locator('[role="dialog"]').count();
console.log("dialogs after click:", dlgCount);
if (dlgCount > 0) {
  const dlg = page.locator('[role="dialog"]').last();
  const text = (await dlg.innerText().catch(() => "")) ?? "";
  console.log("last dialog head:", text.slice(0, 200).replace(/\n+/g, " | "));
  const section = dlg.locator('section[aria-label="Topaz training progress"]');
  console.log("chart section visible:", await section.isVisible().catch(() => false));
  const anySection = await page.locator('section[aria-label="Topaz training progress"]').count();
  console.log("chart sections anywhere in DOM:", anySection);
}
await browser.close().catch(() => {});
process.exit(0);
