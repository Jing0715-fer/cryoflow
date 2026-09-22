/**
 * t237-report-html-frame.mjs — the echo's own portrait: the report read
 * OUTSIDE the app.
 *
 * The dialog's render is the well's first mouth (the compass rides it);
 * the echo is the document traveling — one self-contained HTML file,
 * opened here via file:// with the app nowhere in the room. The frame
 * shows the portable document's opening: its own title, the Contents
 * page (the compass that travels with the document), the first section.
 * Twin housekeeping: seed → frame → DELETE (the roster forgets).
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const BASE = "http://localhost:3000";

const twinReceipt = execSync("python3 scripts/seed-twin.py", { encoding: "utf8" });
const twinId = (twinReceipt.match(/TWIN_READY id=(\S+)/) || [])[1];
if (!twinId) throw new Error("twin seed failed");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.locator('button[aria-label="Session QC report"]').click();
  await page.waitForSelector("[data-report-doc]", { timeout: 15000 });
  for (let i = 0; i < 24 && (await page.locator("[data-report-body] tr[data-owner-door]").count()) !== 3; i++)
    await page.waitForTimeout(500);

  // export the echo and hold its bytes
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    page.locator('button[aria-label="Download portable HTML report"]').click(),
  ]);
  const tmpEcho = "scripts/shots-t223/t237-echo-tmp.html";
  writeFileSync(tmpEcho, readFileSync(await dl.path(), "utf8"));

  // the document travels: open the echo in a FRESH page at file:// —
  // no app, no server, no script — the way a colleague reads it
  const reader = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await reader.goto(`file://${process.cwd()}/${tmpEcho}`, { waitUntil: "domcontentloaded" });
  await reader.waitForTimeout(600);
  await reader.screenshot({ path: "scripts/shots-t223/t237-echo-travels-2x.png", scale: "css" });

  // the contents page works without the app: click a TOC link, the
  // document scrolls itself to that section (anchor, not spy)
  await reader.locator('nav.toc a[href="#s8"]').click();
  await reader.waitForTimeout(600);
  await reader.screenshot({ path: "scripts/shots-t223/t237-echo-anchor-2x.png", scale: "css" });

  unlinkSync(tmpEcho); // the twin's echo goes home with the twin
} finally {
  await browser.close();
  try {
    await fetch(`${BASE}/api/jobs/${twinId}`, { method: "DELETE", headers: { "sec-fetch-site": "same-origin" } });
    const left = (await (await fetch(`${BASE}/api/jobs`, { headers: { "sec-fetch-site": "same-origin" } })).json()).jobs ?? [];
    console.log(`roster after teardown: ${left.length} (twin ${twinId} deleted)`);
  } catch (e) {
    console.error("TEARDOWN FETCH FAILED — twin may remain:", twinId, e.message);
  }
}
console.log("t237 frames: t237-echo-travels-2x.png + t237-echo-anchor-2x.png");
