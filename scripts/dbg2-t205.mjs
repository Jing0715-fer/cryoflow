/* dbg2 — when does the Overlay maps button appear, and what else is on
 * stage while it is missing? Poll the stage every 5s for 90s after the
 * viewer is up, printing everything that could plausibly host or replace
 * the button (dialogs, toolbar aria-labels, restore spinners). */
import { chromium } from "playwright";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
page.on("console", (m) => { if (m.type() === "error") console.log("CERR:", m.text().slice(0, 160)); });
page.on("pageerror", (e) => console.log("PERR:", String(e).slice(0, 160)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2000);
await page.locator('button[aria-label="Switch to dark theme"]').click().catch(() => {});
await sleep(600);
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const host = jobs.jobs.find((j) => j.name === "QA Refine3D");
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
await page.locator('button[aria-label="Enlarge orthovol"]').click().catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
let up = false;
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { up = true; break; } }
console.log("viewer up:", up);

for (let k = 0; k < 18; k++) {
  const st = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button[aria-label]")).map((b) => b.getAttribute("aria-label"));
    const overlay = btns.filter((l) => l && l.startsWith("Overlay"));
    const restore = btns.filter((l) => l && /restore|loading/i.test(l));
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [data-slot="dialog-overlay"]')).map((d) => d.getAttribute("data-state"));
    const body = document.body.innerText.slice(0, 0);
    const textHints = ["Restoring", "Loading", "Scanning"].map((w) => ({ w, present: document.body.innerText.includes(w) }));
    return { overlay, restore, dialogs, textHints, canvas: !!window.__molstar?.canvas3d };
  }).catch((e) => ({ err: String(e).slice(0, 120) }));
  console.log(`t+${k * 5}s:`, JSON.stringify(st));
  if (st.overlay && st.overlay.length > 0) break;
  await sleep(5000);
}
await browser.close();
