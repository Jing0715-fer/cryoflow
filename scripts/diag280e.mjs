#!/usr/bin/env node
/** diag280e.mjs — the sheet Close's computed position, at rest + after tab click. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
});
const page = await context.newPage();
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const idleImport = list.find((j) => j.status === "idle" && /import/i.test(j.name));
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);
for (let attempt = 0; attempt < 10; attempt++) {
  const hit = await page.evaluate((want) => {
    const m = 30;
    const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    if (r.top >= m && r.left >= 0 && r.bottom <= innerHeight - m && r.right <= innerWidth)
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    return null;
  }, idleImport.id);
  if (hit) { await page.touchscreen.tap(hit.cx, hit.cy); break; }
  const px = 140 + (attempt % 3) * 30, py = 300 + (attempt % 2) * 40;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px - 130, py - (attempt % 2 ? 120 : 40), { steps: 6 });
  await page.mouse.up();
  await sleep(700);
}
await sleep(1500);
const probe = async (label) => {
  const d = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"][data-panel-sheet]');
    const R = dlg.getBoundingClientRect();
    // the sheet primitive Close = the button with the XIcon whose class has data-[state=open]:bg-secondary
    const btn = [...dlg.querySelectorAll("button")].find((b) =>
      (b.className || "").includes("data-[state=open]:bg-secondary"));
    if (!btn) return { missing: true };
    const cs = getComputedStyle(btn);
    const r = btn.getBoundingClientRect();
    const before = getComputedStyle(btn, "::before");
    return {
      pos: cs.position, top: cs.top, right: cs.right, left: cs.left,
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
      dlgR: [Math.round(R.left), Math.round(R.right)],
      beforeContent: before.content, beforeRect: before.content !== "none" ? before.height : null,
      parentCls: (btn.parentElement.className || "").slice(0, 60),
      zIndex: cs.zIndex,
    };
  });
  console.log(label, JSON.stringify(d));
};
await probe("AT-REST   ");
await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 });
await sleep(900);
await probe("PARAMS-TAB");
await browser.close();
