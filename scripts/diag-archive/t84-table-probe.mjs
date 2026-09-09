// t84-table-probe — does Chromium repeat cross-page headers for
// (a) a REAL <table><thead> and (b) a CSS-generated table
// (display:table + display:table-header-group + display:table-row)?
// Prints a 60-row variant of each, 2-up on separate @page areas, then
// checks per-page text for the header label "COL".
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const rows = Array.from({ length: 60 }, (_, i) => i + 1);
const html = `<!doctype html><style>
  @page { size: A4; margin: 12mm; }
  body { font: 12px/1.4 sans-serif; margin: 0; }
  h3 { margin: 4px 0; }
  /* real table */
  table.rt { border-collapse: collapse; width: 100%; }
  table.rt th, table.rt td { border: 1px solid #ccc; padding: 2px 6px; }
  /* generated table */
  .gt { display: table; width: 100%; }
  .gt .hg { display: table-header-group; }
  .gt .r { display: table-row; }
  .gt .c { display: table-cell; border: 1px solid #ccc; padding: 2px 6px; }
</style>
<h3>REAL TABLE</h3>
<table class="rt"><thead><tr><th>COL A</th><th>COL B</th></tr></thead>
<tbody>${rows.map((i) => `<tr><td>r${i}</td><td>x</td></tr>`).join("")}</tbody></table>
<div style="break-before: page"></div>
<h3>GENERATED TABLE</h3>
<div class="gt">
  <div class="hg"><div class="r"><div class="c">COL A</div><div class="c">COL B</div></div></div>
  ${rows.map((i) => `<div class="r"><div class="c">r${i}</div><div class="c">x</div></div>`).join("")}
</div>`;

const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(html, { waitUntil: "load" });
await p.pdf({ path: "/home/z/my-project/.qa-logs/t84-probe.pdf", printBackground: true });
await b.close();

const nPages = 4; // upper bound; detect real count
for (let i = 1; i <= nPages; i++) {
  let txt = "";
  try {
    txt = execSync(`pdftotext -f ${i} -l ${i} /home/z/my-project/.qa-logs/t84-probe.pdf -`, { encoding: "utf8" });
  } catch { break; }
  if (!txt.trim()) break;
  const has = (s) => txt.includes(s) ? "Y" : "n";
  console.log(`page ${i}: COL-A=${has("COL A")} realRows=${has("r1/")} genRows=${txt.includes("r1") ? "Y" : "n"}`);
}
