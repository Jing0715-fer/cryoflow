// t128-shot — visual verification of the Task 128 template shelf:
// saved template row with hover-revealed Export button + header Import.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t128-shot";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1000);

  // seed one template via API so the shelf has a row to show
  const payload = {
    jobs: [
      { type: "import", dx: 0, dy: 0, params: {} },
      { type: "motioncorr", dx: 300, dy: 0, params: {} },
      { type: "ctffind", dx: 600, dy: 0, params: { box: 384 } },
    ],
    edges: [
      { from: 0, to: 1, fromPort: "micrographs", toPort: "movies" },
      { from: 1, to: 2, fromPort: "micrographs", toPort: "micrographs" },
    ],
  };
  const created = await (await fetch(`${BASE}/api/custom-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "T128 shot branch", payload }),
  })).json();
  const tid = created?.template?.id;

  await p.keyboard.press("Control+k");
  await sleep(400);
  await p.getByText("Create SPA pipeline with presets…").first().click();
  await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
  const row = p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T128 shot branch" });
  await row.hover();
  await sleep(350);
  await p.screenshot({ path: `${OUT}/t128-shelf.png` });

  // cleanup the shot template
  if (tid) await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(tid)}`, { method: "DELETE" });
  await b.close();
  console.log("t128-shot done");
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
