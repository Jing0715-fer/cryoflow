/**
 * t238-echo-narrow-probe.mjs — evidence BEFORE the fix (eyeball precedes
 * the probe's expectations). The echo travels: email → phone. The 7-column
 * Session map inventory is the report's centerpiece, and the echo's CSS
 * (t237) has a viewport meta but ZERO narrow-screen form. This probe opens
 * the exported document at a phone's width (390×844) and reports whether
 * the document column breaks (documentElement.scrollWidth > viewport) and
 * how wide the inventory table's own min-content actually is.
 * Cleanup: tmp echo deleted; no twin seeded (the demo world has its own maps).
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const BASE = "http://localhost:3000";
const tmpEcho = "scripts/shots-t223/t238-echo-narrow-tmp.html";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.locator('button[aria-label="Session QC report"]').click();
  await page.waitForSelector("[data-report-doc]", { timeout: 15000 });
  for (let i = 0; i < 24 && (await page.locator("[data-report-body] tr[data-owner-door]").count()) < 2; i++)
    await page.waitForTimeout(500);

  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.locator('button[aria-label="Download portable HTML report"]').click(),
  ]);
  writeFileSync(tmpEcho, readFileSync(await dl.path(), "utf8"));

  // the phone's door: layout viewport 390 (the echo's meta says width=device-width)
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`file://${process.cwd()}/${tmpEcho}`, { waitUntil: "domcontentloaded" });
  await phone.waitForTimeout(600);

  const m = await phone.evaluate(() => {
    const doc = document.documentElement;
    const tables = [...document.querySelectorAll("table")];
    const widest = tables
      .map((t) => ({ cols: t.rows[0]?.cells.length ?? 0, scrollW: t.scrollWidth, clientW: t.clientWidth }))
      .sort((a, b) => b.scrollW - a.scrollW)[0];
    return {
      viewport: window.innerWidth,
      docScrollW: doc.scrollWidth,
      docClientW: doc.clientWidth,
      docOverflows: doc.scrollWidth > doc.clientWidth,
      tableCount: tables.length,
      widest,
    };
  });
  console.log("NARROW PROBE (390px):", JSON.stringify(m, null, 2));
  console.log(m.docOverflows
    ? `BLOWOUT CONFIRMED — document column ${m.docScrollW}px vs viewport ${m.viewport}px (the document asks the phone to scroll sideways)`
    : "document column holds");

  // the evidence frame: the inventory table region on the phone
  await phone.locator('a[href="#s1"]').click();
  await phone.waitForTimeout(700);
  await phone.screenshot({ path: "scripts/shots-t223/t238-echo-narrow-landing-2x.png", scale: "css" });
  console.log("landing-frame: scripts/shots-t223/t238-echo-narrow-landing-2x.png");
} finally {
  await browser.close();
  try { unlinkSync(tmpEcho); } catch {}
}
