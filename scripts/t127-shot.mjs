// t127-shot — visual acceptance for Task 127: the save-as-template dialog
// and the "Your templates" shelf, screen captures at meaningful states.
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

// seed via API: 3 wired jobs, a template row for the shelf
const post = async (path, body, method = "POST") =>
  (await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })).json();

const proj = (await (await fetch(`${BASE}/api/project`)).json()).project;
const ws1 = ((await (await fetch(`${BASE}/api/workspaces`)).json()).workspaces ?? [])[0];
const mk = async (type, x, y) =>
  (await post("/api/jobs", { type, workspaceId: ws1.id, x, y })).job;
const j1 = await mk("import", 140, 300);
const j2 = await mk("motioncorr", 440, 300);
const j3 = await mk("ctffind", 740, 300);
await post("/api/edges", { projectId: proj.id, fromJobId: j1.id, toJobId: j2.id, fromPort: "micrographs", toPort: "movies" });
await post("/api/edges", { projectId: proj.id, fromJobId: j2.id, toJobId: j3.id, fromPort: "micrographs", toPort: "micrographs" });
// a saved template for the shelf shot
await post("/api/custom-template", {
  name: "Tuned 2D branch",
  payload: {
    jobs: [
      { type: "extract", dx: 0, dy: 0, params: { boxSize: 220 } },
      { type: "class2d", dx: 300, dy: 0, params: { numClasses: 50 } },
    ],
    edges: [{ from: 0, to: 1, fromPort: "particles", toPort: "particles" }],
  },
});

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
await sleep(1200);

// select the three cards → toolbar → dialog
for (const id of [j1.id, j2.id, j3.id]) {
  await p.locator(`[data-job="${id}"]`).click({ modifiers: ["Shift"] });
  await sleep(200);
}
await p.waitForSelector('[data-canvas-ui="selection-toolbar"]', { timeout: 5000 });
await p.locator('[data-testid="toolbar-save-template"]').click();
await p.waitForSelector('[data-canvas-ui="save-template-dialog"]', { timeout: 5000 });
await p.locator('[data-testid="save-template-name"]').fill("Preprocess trio");
await sleep(300);
await p.screenshot({ path: `/tmp/t127-save-dialog-${stamp}.png` });
console.log("shot 1: save dialog");

// save → reopen presets dialog → shelf with two rows
await p.locator('[data-testid="save-template-confirm"]').click();
await sleep(900);
await p.keyboard.press("Control+k");
await sleep(400);
await p.getByText("Create SPA pipeline with presets…").first().click();
await p.waitForSelector('[data-canvas-ui="custom-templates-list"]', { timeout: 5000 });
await sleep(400);
await p.screenshot({ path: `/tmp/t127-shelf-${stamp}.png` });
console.log("shot 2: shelf with rows");

await b.close();

// cleanup the seeded rows (jobs cascade edges; templates swept by prefix)
for (const id of [j1.id, j2.id, j3.id]) {
  await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }).catch(() => {});
}
const list = await (await fetch(`${BASE}/api/custom-template`)).json();
for (const t of list.templates ?? []) {
  if ((t.name ?? "").startsWith("Tuned 2D branch") || (t.name ?? "").startsWith("Preprocess trio")) {
    await fetch(`${BASE}/api/custom-template?id=${encodeURIComponent(t.id)}`, { method: "DELETE" }).catch(() => {});
  }
}
console.log("cleanup done");
