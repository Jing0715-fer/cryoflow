/* t197 shots — the session QC report's portraits, world-safe (the dialog
 * is read-only: it measures, it never adopts). Two screens + the paper:
 *   1. t197-report-2x.png — the dialog on screen (markdown rendered)
 *   2. t197-report-1x.png — the full-page context
 *   3. sample-session-report.md — the carrier's actual bytes
 *   4. t197-report.pdf — the PRINT door's own product (Page.printToPDF
 *      while body[data-report-print] is set): the Markdown→PDF proof,
 *      the exception contract's birth certificate. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t197";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the world door: same S-phase as the probe — seed the half-map pair and
// make the seeded host the deterministic walk winner (a shots script that
// skips the world's door chain shoots the wrong story)
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const host = ((await (await fetch(`${BASE}/api/jobs`, { headers: { "sec-fetch-site": "same-origin" } })).json()).jobs ?? []).find((j) => j.name === "QA Refine3D");
const patch = await fetch(`${BASE}/api/jobs/${host.id}`, {
  method: "PATCH", headers: { "Content-Type": "application/json", "sec-fetch-site": "same-origin" },
  body: JSON.stringify({ note: host.note ?? "" }),
});
if (!patch.ok) throw new Error(`touch failed: ${patch.status}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

await page.locator('button[aria-label="Session QC report"]').click();
// wait for the map section to settle on the carrier
const carrier = page.locator('[data-report-doc][data-md]');
let md = null;
for (let i = 0; i < 40 && !md; i++) {
  const v = await carrier.getAttribute("data-md").catch(() => null);
  if (v && v.includes("Map QC summary")) md = v;
  else await sleep(500);
}
if (!md) throw new Error("map section never settled — no portrait possible");
await sleep(400);

await page.locator('[data-report-doc]').screenshot({ path: `${OUT}/t197-report-2x.png` });
await page.screenshot({ path: `${OUT}/t197-report-1x.png` });
writeFileSync(`${OUT}/sample-session-report.md`, md);

// the paper: printToPDF honors @media print — the exception contract does
// the rest (only the document prints). This file is the proof.
const cdp = await page.context().newCDPSession(page);
const { data } = await cdp.send("Page.printToPDF", { printBackground: false, preferCSSPageSize: false });
writeFileSync(`${OUT}/t197-report.pdf`, Buffer.from(data, "base64"));

await browser.close();
console.log(`portraits archived: ${OUT} (report ${md.length} bytes, pdf ${data.length} bytes)`);
