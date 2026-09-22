// t84-table-probe2 — the decisive variant: a REAL <thead> inside a
// display:table DIV (not a real <table>), with display:table-row DIV rows
// whose flex content relies on the anonymous-cell wrap. Checks:
//   (a) header repeats on continuation pages,
//   (b) row-internal flex layout survives (name left, badge right, one line).
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const rows = Array.from({ length: 50 }, (_, i) => `Job ${String(i + 1).padStart(2, "0")} alpha beta`);
const html = `<!doctype html><style>
  @page { size: A4; margin: 12mm; }
  body { font: 12px/1.4 sans-serif; margin: 0; }
  .roster { display: table; width: 100%; }
  .roster thead { display: table-header-group; }
  .roster th { text-align: left; font-size: 9px; letter-spacing: .1em; text-transform: uppercase;
               color: #777; border-bottom: 1px solid #ddd; padding: 4px 10px; }
  .row { display: table-row; break-inside: avoid; }
  .inner { display: flex; align-items: center; gap: 12px; padding: 5px 10px; border-bottom: 1px solid #eee; }
  .name { font-weight: 600; }
  .badge { margin-left: auto; color: #b45309; font-size: 10px; }
</style>
<div class="roster">
  <thead><tr><th>Jobs · 50</th></tr></thead>
  ${rows.map((r) => `<div class="row"><div class="inner"><span class="name">${r}</span><span class="badge">3 classes noted</span></div></div>`).join("")}
</div>`;

const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(html, { waitUntil: "load" });
await p.pdf({ path: "/home/z/my-project/.qa-logs/t84-probe2.pdf", printBackground: true });
await b.close();

for (let i = 1; i <= 4; i++) {
  let txt = "";
  try {
    txt = execSync(`pdftotext -f ${i} -l ${i} /home/z/my-project/.qa-logs/t84-probe2.pdf -`, { encoding: "utf8" });
  } catch { break; }
  if (!txt.trim()) break;
  const flat = txt.replace(/\s+/g, " ");
  console.log(
    `page ${i}: head=${flat.includes("Jobs · 50") ? "Y" : "n"} ` +
    `nameLeft=${flat.includes("Job 01 alpha beta") ? "Y" : "-"} ` +
    `badgeInline=${/Job 41 alpha beta 3 classes noted/.test(flat) || /alpha beta.*3 classes noted/.test(flat) ? "Y" : "-"}`
  );
}
