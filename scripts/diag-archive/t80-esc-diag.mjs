// t80 esc diag — what survives Escape in the lightbox?
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEL = "QA Class Select";

execSync("python3 scripts/qa58-seed-gallery.py", { encoding: "utf8", timeout: 120_000 });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);

const card = p.locator('[role="button"]', { hasText: SEL }).first();
await card.click();
await sleep(1000);
const tab = p.getByRole("tab", { name: "Params" });
if (await tab.count()) { await tab.first().click(); await sleep(700); }
console.log("gallery:", await p.locator('section[aria-label="Class selection gallery"]').count());

// seed one note via the UI path: open lightbox on class 2 via note button (not-noted → hover pen)
const btn = p.locator('[data-canvas-ui="class-note"]').first();
await btn.click({ force: true });
await p.waitForSelector('[data-canvas-ui="class-note-editor"]');
await p.locator('[data-canvas-ui="class-note-editor"]').fill("diag note");
console.log("before esc: editor=", await p.locator('[data-canvas-ui="class-note-editor"]').count(),
  "dialogs=", await p.evaluate(() => document.querySelectorAll('[role="dialog"][data-state="open"]').length));

await p.locator('[data-canvas-ui="class-note-editor"]').focus();
await p.keyboard.press("Escape");
await sleep(400);
console.log("after esc: editor=", await p.locator('[data-canvas-ui="class-note-editor"]').count(),
  "dialogs=", await p.evaluate(() => document.querySelectorAll('[role="dialog"][data-state="open"]').length),
  "grid=", await p.locator('[data-canvas-ui="class-grid"]').count(),
  "gallery=", await p.locator('section[aria-label="Class selection gallery"]').count(),
  "asides=", await p.locator("aside").count(),
  "paramsTab=", await p.getByRole("tab", { name: "Params" }).count());
await b.close();
