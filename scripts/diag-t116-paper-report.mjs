// Task 116 diagnostic — print the inspector Results tab for the QA Class
// Select job (gallery + STAR + logs seed: qa58) and dump what the PAPER
// actually contains. Checks:
//   1. glass-door casualties: do "Maps & images" tiles / "STAR tables"
//      rows / "Logs & reports" rows survive on paper?
//   2. pagination: multi-page flow? where do page boundaries fall?
// Mirrors qa70/t115 technique: playwright trusted click (Radix TabsTrigger
// needs pointerdown) + page.pdf() + pdftotext per page.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/scripts/tmp-t116";
fs.mkdirSync(OUT, { recursive: true });

const j = async (url) => JSON.parse(await (await fetch(url)).text());

async function findJob(namePart) {
  const { projects } = await j(`${BASE}/api/projects`);
  for (const p of projects) {
    try {
      const { jobs } = await j(`${BASE}/api/jobs?projectId=${p.id}`);
      const hit = jobs.find((x) => x.name.includes(namePart));
      if (hit) return hit;
    } catch {}
  }
  return null;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200));
});

await page.goto(BASE, { waitUntil: "networkidle" });

// reach the QA Class2D Source job card and open its inspector
const job = await findJob("QA Class2D Source");
if (!job) throw new Error("QA Class2D Source job not found (seed first)");
console.log("job:", job.name, job.status, job.id);

// click the canvas card (role=button carrying the job name — t112 pattern)
const card = page.locator('[role="button"]', { hasText: job.name }).first();
await card.waitFor({ timeout: 10000 });
await card.click();
await page.waitForSelector("[data-inspector-dialog][data-state=open]", { timeout: 8000 });
console.log("inspector open");

// force the Results tab (Radix TabsTrigger needs real pointer)
await page.locator('[role="tab"]').filter({ hasText: /results/i }).click();
await page.waitForTimeout(1200);

// what does the SCREEN show in the results tab? (reference)
const screenProbe = await page.evaluate(() => {
  const dlg = document.querySelector("[data-inspector-dialog]");
  const txt = dlg ? dlg.innerText : "";
  return {
    hasMapsHeading: txt.includes("Maps & images"),
    hasStarHeading: txt.includes("STAR tables"),
    hasLogsHeading: txt.includes("Logs & reports"),
    hasMrcsName: txt.includes("unmasked_classes"),
    hasStarName: txt.includes("run_data.star"),
    tileCount: dlg ? dlg.querySelectorAll("button img").length : 0,
  };
});
console.log("SCREEN:", JSON.stringify(screenProbe));

// print the paper
const pdfPath = path.join(OUT, "results-tab.pdf");
await page.emulateMedia({ media: "print" });
await page.pdf({ path: pdfPath, format: "A4", printBackground: false });

const pages = execSync(`pdfinfo ${pdfPath} | rg '^Pages:'`).toString().trim();
console.log("PAPER:", pages);
const txtPath = path.join(OUT, "results-tab.txt");
execSync(`pdftotext ${pdfPath} ${txtPath}`);
const paper = fs.readFileSync(txtPath, "utf8");
const paperProbe = {
  hasMapsHeading: /Maps\s*&?\s*images/i.test(paper),
  hasStarHeading: /STAR\s*tables/i.test(paper),
  hasLogsHeading: /Logs\s*&?\s*reports/i.test(paper),
  hasMrcsName: paper.includes("unmasked_classes"),
  hasStarName: paper.includes("run_data.star"),
  hasFsc: /FSC/i.test(paper),
  hasWorkdirFooter: /workdir/i.test(paper),
};
console.log("PAPER CONTENT:", JSON.stringify(paperProbe, null, 2));

// per-page dump for pagination eyeballing
const pageTexts = paper.split("\f");
pageTexts.forEach((t, i) => {
  const lines = t.split("\n").map((s) => s.trim()).filter(Boolean);
  console.log(`--- page ${i + 1} (${lines.length} lines) first/last:`);
  console.log("   first:", (lines[0] ?? "").slice(0, 90));
  console.log("   last :", (lines[lines.length - 1] ?? "").slice(0, 90));
});

await browser.close();
console.log("DIAG DONE");
