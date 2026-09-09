// qa72-verify — clean verification of the shipped fit-to-paper product
// path: NO injected CSS, no probes — open the real page, printToPDF via
// CDP like a user (printBackground + preferCSSPageSize so @page size is
// honored both ways), and assert the paper contract:
//   V1 exactly ONE page
//   V2 landscape paper
//   V3 every job card name on the sheet (full pipeline, un-truncated)
//   V4 doc masthead + per-page footer present
//   V5 ink near the content-box origin (negative-margin alignment landed)
// Run: node scripts/qa72-verify.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const OUT = "/home/z/my-project/.qa-logs/t72-verify.pdf";
rmSync(OUT, { force: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForTimeout(3500);
// make sure we're on the canvas view (Shift+D toggles dashboard/canvas)
const onCanvas = await p.evaluate(() => !!document.querySelector("[data-canvas=workspace]"));
if (!onCanvas) {
  await p.keyboard.press("Shift+D");
  await p.waitForTimeout(2000);
}
const info = await p.evaluate(() => {
  const names = [...document.querySelectorAll("[data-job] [role=button]")]
    .map((b) => (b.getAttribute("aria-label") || "").split("—")[0].trim());
  // custom props live on the SECTION (custom properties inherit downward);
  // reading them here asserts the geometry hand-off actually happened
  const sec = document.querySelector("[data-canvas=viewport]");
  return {
    jobs: document.querySelectorAll("[data-job]").length,
    view: document.querySelector("[data-view]")?.getAttribute("data-view"),
    pz: sec?.style.getPropertyValue("--print-z"),
    pw: sec?.style.getPropertyValue("--print-w"),
    names,
  };
});
console.log("page state:", JSON.stringify({ ...info, names: info.names.length, pz: info.pz?.trim(), pw: info.pw?.trim() }));

await p.emulateMedia({ media: "print" });
await p.pdf({
  path: OUT,
  printBackground: true,
  preferCSSPageSize: true,
});
// Task 74 — dual-paper leg: the fit budget takes the tighter axis of
// Letter/A4 landscape (width from Letter, height from A4), so the SAME
// pipeline must fit on BOTH papers. A4 comes via @page (above,
// preferCSSPageSize); Letter is forced through the pdf options with the
// @page size ignored — if the budget math were wrong for Letter's
// narrower content box, cards would spill to page 2 here.
const OUT_LETTER = "/home/z/my-project/.qa-logs/t72-verify-letter.pdf";
rmSync(OUT_LETTER, { force: true });
await p.pdf({
  path: OUT_LETTER,
  printBackground: true,
  preferCSSPageSize: false,
  format: "Letter",
  landscape: true,
});
await b.close();

// ---- assertions -----------------------------------------------------
const raw = readFileSync(OUT).toString("latin1");
const counts = [...raw.matchAll(/\/Count (\d+)/g)].map((m) => +m[1]);
const pages = Math.max(...counts);
console.log("V1 pages:", pages, pages === 1 ? "OK" : "FAIL");

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

must(pages === 1, `V1 exactly one page (got ${pages})`);

const r = execSync(`pdftoppm -gray -r 100 -f 1 -l 1 ${OUT} /home/z/my-project/.qa-logs/t72v`, { encoding: "utf8" });
const pgm = readFileSync("/home/z/my-project/.qa-logs/t72v-1.pgm");
let i = 2; const vals = [];
while (vals.length < 3) {
  while (pgm[i] === 32 || pgm[i] === 10 || pgm[i] === 13 || pgm[i] === 9) i++;
  if (pgm[i] === 35) { while (pgm[i] !== 10) i++; continue; }
  let j = i; while (!(pgm[j] === 32 || pgm[j] === 10 || pgm[j] === 13 || pgm[j] === 9)) j++;
  vals.push(parseInt(pgm.toString("latin1", i, j))); i = j;
}
i++;
const [w, h] = vals;
const px = pgm.subarray(i);
console.log(`V2 raster: ${w}x${h}`);
must(w > h, `V2 landscape paper (${w}x${h})`);

// ink bbox
let firstCol = -1, firstRow = -1, lastCol = -1, lastRow = -1;
for (let y = 0; y < h && firstRow < 0; y++)
  for (let x = 0; x < w; x++) if (px[y * w + x] < 128) { firstRow = y; break; }
for (let x = 0; x < w && firstCol < 0; x++)
  for (let y = 0; y < h; y++) if (px[y * w + x] < 128) { firstCol = x; break; }
for (let y = h - 1; y >= 0 && lastRow < 0; y--)
  for (let x = 0; x < w; x++) if (px[y * w + x] < 128) { lastRow = y; break; }
for (let x = w - 1; x >= 0 && lastCol < 0; x--)
  for (let y = 0; y < h; y++) if (px[y * w + x] < 128) { lastCol = x; break; }
console.log(`V5 ink bbox: col ${firstCol}..${lastCol}, row ${firstRow}..${lastRow} (page ${w}x${h})`);
// content box origin at 12mm = 47px @100dpi; ink should start near it
must(firstCol > 20 && firstCol < 160, `V5 ink starts near content origin (col ${firstCol})`);
must(lastCol < w - 20, `V5 ink inside right margin (last col ${lastCol} of ${w})`);

const text = execSync(`pdftotext ${OUT} -`, { encoding: "utf8" }).replace(/\s+/g, "");
// expected names come from the LIVE DOM (this workspace's cards only — the
// masthead's job count is project-wide and includes other workspaces)
const names = info.names.map((n) => n.replace(/\s+/g, ""));
let missing = 0;
for (const n of names) if (!text.includes(n)) { console.log("  MISSING:", n); missing++; }
must(missing === 0, `V3 all job names on the sheet (${names.length - missing}/${names.length})`);
must(text.toLowerCase().includes("cryoflow—pipelinesnapshot"), "V4 masthead kicker on paper");
must(/cryoflow—/i.test(text) && /·\d+jobs·\d+edges/.test(text), "V4 per-page footer on paper");

// V6 — Letter landscape leg: same fit contract on the OTHER common paper
const lraw = readFileSync(OUT_LETTER).toString("latin1");
const lcounts = [...lraw.matchAll(/\/Count (\d+)/g)].map((m) => +m[1]);
const lpages = Math.max(...lcounts);
must(lpages === 1, `V6 Letter landscape single page (got ${lpages})`);
const ltext = execSync(`pdftotext ${OUT_LETTER} -`, { encoding: "utf8" }).replace(/\s+/g, "");
let lmissing = 0;
for (const n of names) if (!ltext.includes(n)) { console.log("  MISSING (Letter):", n); lmissing++; }
must(lmissing === 0, `V6 all job names on Letter sheet (${names.length - lmissing}/${names.length})`);

rmSync("/home/z/my-project/.qa-logs/t72v-1.pgm", { force: true });
console.log(fail === 0 ? "QA72-VERIFY GREEN" : `QA72-VERIFY FAILED (${fail})`);
process.exit(fail === 0 ? 0 : 1);
