/* t191-forensics — why does the receipt vanish after a keyboard scrub?
 * Samples the receipt's existence, the strip's aria-label (axis), the
 * footer text, and every map-profile response, at 100 ms granularity. */
import { execSync } from "node:child_process";
import path from "path";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HOST_JOB = "QA Refine3D";

const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
const host = jobs0.find((j) => j.name === HOST_JOB && j.status === "completed");
execSync(`QA_VOL_HOST="${HOST_JOB}" python3 scripts/qa67-seed-volume.py`, { cwd: path.resolve("."), stdio: "pipe", timeout: 60_000 });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error" || /olstar|slice update skipped|profile|t191-fx/i.test(m.text()))
    console.log(`  [console.${m.type()}] ${m.text().slice(0, 160)}`);
});
page.on("response", (r) => {
  const u = r.url();
  if (u.includes("/map-profile") || (u.includes("/outputs/file") && u.includes("format=png"))) {
    console.log(`  [net] ${u.replace(BASE, "").slice(0, 110)} -> ${r.status()}`);
  }
});
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2000);

let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  if (await page.locator("h1", { hasText: "Dashboard" }).isVisible().catch(() => false)) {
    await page.keyboard.press("Shift+KeyD");
    await sleep(2000);
  } else if (await page.locator(`[data-job="${host.id}"]`).first().isVisible().catch(() => false)) {
    onCanvas = true;
  } else await sleep(1500);
}
for (let i = 0; i < 6; i++) {
  await page.locator(`[data-job="${host.id}"]`).first().click({ timeout: 3000, force: i >= 3 }).catch(() => {});
  await sleep(1500);
  const tab = page.locator('[role="tab"]', { hasText: "Results" });
  if (await tab.isVisible().catch(() => false)) { await tab.click(); await sleep(1200); break; }
}
for (let i = 0; i < 5; i++) {
  await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 2500 }).catch(() => {});
  await sleep(1100);
  const v3d = page.locator("button", { hasText: "View in 3D" });
  if (await v3d.isVisible().catch(() => false)) {
    await v3d.click();
    await sleep(1500);
    if (await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false)) break;
    for (let k = 0; k < 20; k++) {
      await sleep(2500);
      if (await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false)) break;
    }
    break;
  }
}
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
await sleep(700);
const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');
for (let i = 0; i < 12; i++) {
  if (await strip.isVisible().catch(() => false)) break;
  await sleep(1000);
}
console.log("== strip ready, exporting ==");
const tMark = Date.now();
await page.locator('button[aria-label="Copy profile as CSV"]').click();
await sleep(500);

const snap = async (tag) => {
  const receipt = await page.locator('div[aria-label="Profile export status"]').isVisible().catch(() => false);
  const dom = await page.evaluate(() => {
    const els = [...document.querySelectorAll('div[aria-label="Profile export status"]')];
    return els.map((el) => ({
      attached: true,
      hasAttr: el.hasAttribute("data-csv"),
      text: (el.textContent ?? "").slice(0, 40),
      rect: `${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`,
    }));
  });
  const s = await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').count().catch(() => 0);
  const axis = s ? (/along the (\w) axis/.exec((await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').first().getAttribute("aria-label")) ?? "")?.[1] ?? "?") : "-";
  const measuring = await page.locator("p", { hasText: "measuring the density" }).count().catch(() => 0);
  console.log(`  [${tag} +${Date.now() - tMark}ms] receipt=${receipt} strip=${s} axis=${axis} measuring=${measuring} dom=${JSON.stringify(dom)}`);
};

await snap("t0");
await strip.focus();
await page.keyboard.press("ArrowLeft");
for (let i = 0; i < 15; i++) {
  await sleep(100);
  await snap(`t+${(i + 1) * 100}ms`);
}
await browser.close();
console.log("FORENSICS DONE");
