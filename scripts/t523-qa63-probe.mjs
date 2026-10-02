/** t523 — qa63's FSC section went missing in a clean solo run (the stash
 *  hearing acquitted our engine changes; the API serves perfect data; the
 *  seeder verifies green). This probe walks qa63's exact steps and, at the
 *  FATAL point, prints everything the inspector actually rendered plus any
 *  console errors — qa63 collects them but dies before printing. */
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const B = "http://localhost:3000";
const HOST_JOB = "QA Post 320";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { sh("pkill -f agent-browser"); } catch {}

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("console", (m) => { if (m.type() === "error") errs.push(String(m.text() || m).slice(0, 200)); });
p.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 200)));
p.on("response", (r) => {
  if (r.url().includes("/fsc") || r.url().includes("chart")) errs.push(`RESP ${r.status()} ${r.url().slice(-60)}`);
});

await p.goto(B, { waitUntil: "networkidle" });
await sleep(1500);
const curView = () => p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  if ((await curView()) === "canvas") {
    const card = await p.locator(`[data-job]`, { hasText: HOST_JOB }).count();
    if (card > 0) onCanvas = true;
  }
  if (!onCanvas) { await p.keyboard.press("Shift+D"); await sleep(2200); }
}
console.log("canvas:", onCanvas);

await p.keyboard.press("Control+f");
const findInput = p.locator('[data-testid="canvas-find-input"]');
if (await findInput.isVisible().catch(() => false)) {
  await findInput.fill(HOST_JOB); await sleep(300);
  await p.keyboard.press("Enter"); await sleep(800);
  await p.keyboard.press("Escape"); await sleep(400);
}

let modal = false;
for (let i = 0; i < 5 && !modal; i++) {
  const card = p.locator("[data-job]", { hasText: HOST_JOB }).locator('[role="button"]').first();
  try { await card.click({ timeout: 3000 }); await sleep(1500); } catch { await sleep(800); }
  modal = await p.evaluate((host) =>
    [...document.querySelectorAll("[role=dialog]")].some((d) => (d.textContent || "").includes(host)), HOST_JOB);
}
console.log("modal:", modal);

if (modal) {
  const detail = await p.evaluate(() => {
    const fsc = document.querySelector('section[aria-label="Fourier-shell correlation"]');
    const dlg = [...document.querySelectorAll("[role=dialog]")][0];
    const sections = dlg ? [...dlg.querySelectorAll("section")].map((s) => s.getAttribute("aria-label") || s.className.slice(0, 40)) : [];
    return {
      fscSection: !!fsc,
      dialogSections: sections,
      dialogTextLen: dlg ? dlg.textContent.length : 0,
      hasResolution: dlg ? dlg.textContent.includes("Resolution") : null,
      hasGuinier: dlg ? dlg.textContent.includes("Guinier") : null,
    };
  });
  console.log("inspector detail:", JSON.stringify(detail, null, 1));
}
console.log("console/page errors:", errs.length ? "\n  " + errs.slice(0, 12).join("\n  ") : "NONE");
await b.close();
