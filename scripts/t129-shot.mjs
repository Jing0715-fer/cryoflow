// t129-shot — visual verification of the post-apply suggestion chip.
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t129-shot";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1000);

  // save a template via API (motioncorr→ctffind branch)
  const tpl = await (await fetch(`${BASE}/api/custom-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "T129 shot branch",
      payload: {
        jobs: [
          { type: "motioncorr", dx: 0, dy: 0, params: {} },
          { type: "ctffind", dx: 300, dy: 0, params: {} },
        ],
        edges: [{ from: 0, to: 1, fromPort: "micrographs", toPort: "micrographs" }],
      },
    }),
  })).json();

  // apply via UI
  await p.keyboard.press("Control+k");
  await sleep(400);
  await p.getByText("Create SPA pipeline with presets…").first().click();
  await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
  const row = p.locator('[data-canvas-ui="custom-template-row"]').filter({ hasText: "T129 shot branch" });
  await row.locator('[data-testid="custom-template-apply"]').click();
  await sleep(900);
  await p.locator('[data-canvas-ui="template-presets-dialog"] button:has-text("Cancel")').click();
  await p.waitForSelector('[data-canvas-ui="template-presets-dialog"]', { state: "detached", timeout: 5000 });
  await p.waitForSelector('[data-canvas-ui="template-suggestions"]', { timeout: 8000 });
  await sleep(500);
  await p.screenshot({ path: `${OUT}/t129-chip.png` });

  if (tpl?.template?.id) {
    await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(tpl.template.id)}`, { method: "DELETE" });
  }
  await b.close();
  console.log("t129-shot done");
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
