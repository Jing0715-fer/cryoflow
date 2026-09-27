// t407 diag clean — the Map QC h2's exact hast bytes vs the hero mount
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const probes = [];
const page = await browser.newPage({ viewport: { width: 1480, height: 940 } });
page.on("console", (m) => { if (m.text().includes("[h2-probe]")) probes.push(m.text()); });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector('button[aria-label="Open command palette (Ctrl+K)"]', { timeout: 30000 });
await page.click('button[aria-label="Open command palette (Ctrl+K)"]');
await page.waitForSelector('[cmdk-root]', { timeout: 10000 });
await sleep(500);
await page.locator('[data-slot="command-item"]', { hasText: "β-Galactosidase" }).first().click();
await sleep(2000);
await page.keyboard.press("Escape");
await sleep(800);
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
await page.locator('header [aria-label="Session QC report"]').click();
await page.locator("[data-report-doc]").waitFor({ state: "visible", timeout: 15000 });
await sleep(7000);
const state = await page.evaluate(() => {
  const h2s = [...document.querySelectorAll("[data-report-body] h2")].map((h) => ({
    raw: JSON.stringify(h.textContent),
    kids: h.childNodes.length,
    kidTypes: [...h.childNodes].map((n) => n.nodeType).join(","),
  }));
  const hero = document.querySelectorAll("[data-report-body] .report-hero").length;
  const heroSibling = document.querySelectorAll("[data-report-body] figure").length;
  const figs = [...document.querySelectorAll("[data-report-body] figure")].map((f) => f.className);
  return { h2s, hero, heroSibling, figs };
});
console.log("hero:", state.hero, "| all figures:", state.heroSibling, JSON.stringify(state.figs.slice(0, 5)));
state.h2s.forEach((h, i) => console.log(`h2[${i}]:`, h.raw, `kids=${h.kids} types=${h.kidTypes}`));
console.log("PROBES:", JSON.stringify(probes, null, 1));
await browser.close();
