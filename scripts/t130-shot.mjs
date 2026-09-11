// t130-shot — visual verification of the batch header's ARMED state
// ("Delete all N?" + Clear/Keep, Task 130's two-step confirm).
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t130-shot";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1000);

  const seed = async (name, box) => {
    await fetch(`${BASE}/api/custom-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        payload: {
          jobs: [
            { type: "motioncorr", dx: 0, dy: 0, params: {} },
            { type: "ctffind", dx: 300, dy: 0, params: { box } },
          ],
          edges: [{ from: 0, to: 1, fromPort: "micrographs", toPort: "micrographs" }],
        },
      }),
    });
  };
  await seed("T130 shot branch", 384);
  await seed("T130 shot second", 256);

  await p.keyboard.press("Control+k");
  await sleep(400);
  await p.getByText("Create SPA pipeline with presets…").first().click();
  await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
  await sleep(300);
  await p.locator('[data-testid="custom-template-clear"]').click();
  await p.waitForSelector('[data-testid="custom-template-clear-arm"]', { timeout: 5000 });
  await sleep(250);
  await p.screenshot({ path: `${OUT}/t130-armed.png` });

  // cleanup — remove the shot's rows
  const all = (await (await fetch(`${BASE}/api/custom-template?all=1`)).json())?.templates ?? [];
  for (const t of all) {
    if ((t.name ?? "").startsWith("T130")) {
      await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
    }
  }
  await b.close();
  console.log("t130 armed shot done");
}

main().catch((e) => { console.error(e); process.exit(1); });
