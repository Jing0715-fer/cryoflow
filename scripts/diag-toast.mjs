#!/usr/bin/env node
/**
 * diag-toast.mjs — Task 174 selection reconnaissance: the toast's touch
 * exit story, measured live at 390×844.
 *
 * Questions this answers before any code is written:
 *  Q1 ToastClose painted opacity at a coarse-pointer viewport (no hover
 *     device) — is the exit affordance INVISIBLE to touch users?
 *  Q2 ToastClose resolved hit area (t172 census method).
 *  Q3 Does Radix's built-in swipe respond to a playwright MOUSE drag
 *     (pointerType "mouse" — Radix multiplies delta ×2 for mouse,
 *     ×10 for touch; threshold default 50)?
 *  Q4 Does the default swipeDirection "right" ignore a vertical drag?
 *  Q5 Where does the viewport sit at mobile (top-0, p-4)?
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

/* Trigger at desktop (the zoom-cluster button sits at x=419 — outside the
   390px viewport; the toast viewport itself is global+fixed so we resize
   after firing and observe the mobile placement live). */
await page.click('button[aria-label="Export canvas as PNG"]');
console.log("export clicked at desktop size");
const li = page.locator("li[data-swipe-direction]").first();
try {
  await li.waitFor({ state: "visible", timeout: 20000 });
  console.log("toast appeared");
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(800);
} catch {
  console.log("TOAST NEVER APPEARED — trigger path failed");
  await browser.close();
  process.exit(1);
}
const toastText = await li.innerText();
console.log("toast text head:", JSON.stringify(toastText.slice(0, 80)));

/* ---- Q1/Q2: ToastClose visibility + hit area ---- */
console.log("\n== Q1/Q2 ToastClose at coarse viewport ==");
const closeInfo = await li.evaluate((root) => {
  const btn = root.querySelector("[toast-close]");
  if (!btn) return { found: false };
  const cs = getComputedStyle(btn);
  const r = btn.getBoundingClientRect();
  const before = getComputedStyle(btn, "::before");
  return {
    found: true,
    computedOpacity: cs.opacity,
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    beforeW: before.width, beforeH: before.height,
    pointerEvents: cs.pointerEvents,
  };
});
console.log(JSON.stringify(closeInfo, null, 2));

/* ---- Q5: viewport placement ---- */
console.log("\n== Q5 viewport placement at 390×844 ==");
const vpInfo = await page.evaluate(() => {
  const ol = document.querySelector("ol[data-radix-toast-viewport], section ol, li[data-swipe-direction]")?.closest("ol");
  if (!ol) return { found: false };
  const cs = getComputedStyle(ol);
  const r = ol.getBoundingClientRect();
  return { found: true, top: cs.top, right: cs.right, width: r.width, y: r.y, classes: ol.className.slice(0, 120) };
});
console.log(JSON.stringify(vpInfo, null, 2));

/* ---- Q3: horizontal (right) mouse swipe ---- */
console.log("\n== Q3 horizontal mouse swipe (default direction right) ==");
{
  const box = await li.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const swipes = [];
  for (const dx of [15, 35, 60, 90, 130]) {
    await page.mouse.move(cx + dx, cy, { steps: 3 });
    await sleep(40);
    const st = await li.evaluate((n) => ({
      swipe: n.getAttribute("data-swipe"),
      transform: getComputedStyle(n).transform,
      moveVar: n.style.getPropertyValue("--radix-toast-swipe-move-x") || getComputedStyle(n).getPropertyValue("--radix-toast-swipe-move-x"),
    })).catch(() => ({ gone: true }));
    swipes.push({ dx, ...st });
  }
  console.log(JSON.stringify(swipes, null, 2));
  await page.mouse.up();
  await sleep(600);
  const after = await li.count();
  const state = after ? await li.first().getAttribute("data-state").catch(() => "gone") : "unmounted";
  console.log("after mouse.up: toast count =", after, "| data-state =", state);
}

/* ---- Q4: vertical drag ignored when direction is right? ---- */
console.log("\n== Q4 vertical drag with default direction ==");
{
  await page.click('button[aria-label="Export canvas as PNG"]');
  await li.waitFor({ state: "visible", timeout: 20000 });
  const box = await li.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (const dy of [20, 50, 90, 140]) {
    await page.mouse.move(cx, cy + dy, { steps: 3 });
    await sleep(40);
  }
  const during = await li.evaluate((n) => ({
    swipe: n.getAttribute("data-swipe"),
    transform: getComputedStyle(n).transform,
  })).catch(() => ({ gone: true }));
  console.log("during vertical drag:", JSON.stringify(during));
  await page.mouse.up();
  await sleep(600);
  const after = await li.count();
  console.log("after vertical mouse.up: toast count =", after);
}

/* ---- ToastClose actually closes (Q6) ---- */
console.log("\n== Q6 ToastClose click dismisses ==");
{
  await page.click('button[aria-label="Export canvas as PNG"]');
  await li.waitFor({ state: "visible", timeout: 20000 });
  const btn = li.locator("[toast-close]");
  await btn.click({ force: true });
  await sleep(600);
  const after = await li.count();
  console.log("after close click: toast count =", after);
}

console.log("\nDIAG DONE");
await browser.close();
