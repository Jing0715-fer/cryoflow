// t98 — Task 98: per-workspace viewport memory (session scope).
//
// Every workspace/project switch forced a zoom-to-fit — you never got lost,
// but you also never got to KEEP a view: zoom into ws A to arrange a branch,
// peek at ws B, come back → fit-all again. Design tools remember each
// page's viewport; now the canvas does too:
//   - every viewport change is written through to viewportMemory under the
//     (project:workspace) key (store.setViewport / panBy);
//   - switching BACK to a visited workspace restores the remembered view;
//   - FIRST visit still fits (fresh landing contract);
//   - layoutEpoch (import / auto-arrange) always re-fits and the fit
//     becomes the new memory — fresh content wins over stale memory;
//   - session scope: hydrated from sessionStorage (same tab) on load, so a
//     reload in THIS tab restores the view (Task 99); a fresh tab or a
//     closed tab deliberately re-fits — never localStorage.
//
// Phase S — setup: baseline, second workspace + one seeded job, canvas up
// Phase A — remember & restore: pan+zoom Main → switch to Second (first
//   visit FITS, not Main's view) → pan Second → back to Main (view returns
//   EXACTLY) → back to Second (its own memory, not its fit)
// Phase B — reload restores: sessionStorage hydrate brings Main's view back
//   in the same tab (Task 99 contract)
// Phase C — arrange wins: auto-arrange reframes Main, and the fit becomes
//   the remembered view (switch away and back → still the fit)
// Phase D — static contract: write-through in setViewport+panBy, merged
//   trigger effect (epoch fit > memory restore > first-visit fit), no
//   localStorage in the viewport path
// Phase Z — cleanup: t98 job + workspace deleted, counts restored
//
// Run: node scripts/t98-e2e.mjs   (server on :3000)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FATAL: ${label}`);
    p?.close().catch(() => {});
    b?.close().catch(() => {});
    process.exit(1);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};

const api = async (path, method = "GET", body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  if (method === "DELETE") return null;
  return res.json();
};
const listJobs = async () => (await api("/api/jobs")).jobs;

/* ---------------- Phase S: setup ---------------- */
console.log("Phase S — setup");
for (const j of (await listJobs()).filter((x) => x.name.startsWith("t98"))) {
  try { await api(`/api/jobs/${j.id}`, "DELETE"); } catch { /* gone */ }
}
for (const w of (await api("/api/workspaces")).workspaces.filter((w) => w.name.startsWith("t98 "))) {
  try { await api(`/api/workspaces/${w.id}`, "DELETE"); } catch { /* gone */ }
}
const jobsBefore = (await listJobs()).length;
const wsBefore = ((await api("/api/workspaces")).workspaces).length;
must(jobsBefore >= 1 && wsBefore >= 1, `S1 baseline reachable (${jobsBefore} jobs, ${wsBefore} ws)`);

const homeWs = ((await api("/api/workspaces")).workspaces)[0];
const ws2 = (await api("/api/workspaces", "POST", { name: "t98 Second" })).workspace;
const seeded = (await api("/api/jobs", "POST", {
  type: "motioncorr",
  name: "t98 Solo MotionCorr",
  workspaceId: ws2.id,
  x: 400,
  y: 300,
})).job;
must(!!ws2?.id && !!seeded?.id, "S2 second workspace + one seeded job created");

b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
  await p.keyboard.press("Shift+C");
  await sleep(700);
}
must((await curView()) === "canvas", `S3 canvas view active (got "${await curView()}")`);

// the world layer carries translate(...) scale(...) — the viewport's fingerprint
const worldTf = () =>
  p.evaluate(() => {
    const el = document.querySelector('[data-canvas="workspace"]');
    return el instanceof HTMLElement ? (el.style.transform ?? "") : "";
  });
const zoomPct = () =>
  p.evaluate(() => {
    const el = document.querySelector('[data-canvas-ui="zoom-controls"]');
    return el?.textContent?.match(/(\d+)%/)?.[1] ?? "";
  });

const switchWs = async (name) => {
  await p.locator('[aria-label="Active workspace"]').click();
  await sleep(400);
  await p.locator('[role="option"]', { hasText: name }).first().click();
  await sleep(900);
};
// plain background drag = pan (Shift+drag would be the rubber band)
const panBg = async (dx, dy) => {
  await p.mouse.move(1200, 810);
  await p.mouse.down();
  await p.mouse.move(1200 + dx, 810 + dy, { steps: 8 });
  await p.mouse.up();
  await sleep(500);
};

/* ---------------- Phase A: remember & restore ---------------- */
console.log("Phase A — remember & restore");
const tfFit0 = await worldTf();
const zoomFit0 = await zoomPct();
must(tfFit0.includes("translate") && tfFit0.includes("scale"), `A1 world transform fingerprint live (got "${tfFit0.slice(0, 60)}")`);
await p.locator('[aria-label="Zoom in"]').click();
await sleep(400);
await panBg(-140, -60);
const tfA = await worldTf();
const zoomA = await zoomPct();
must(tfA !== tfFit0, `A2 Main view personalized (zoom ${zoomA}%, transform moved)`);
must(zoomA === String(Math.min(100, Number(zoomFit0) + 10)), `A3 zoom-in landed one step up (${zoomFit0}% → ${zoomA}%)`);

await switchWs("t98 Second");
const wsLabel = await p.locator('[aria-label="Active workspace"]').textContent();
must((wsLabel ?? "").includes("t98 Second"), `A4 switched to the second workspace (label "${(wsLabel ?? "").trim()}")`);
const tfBfit = await worldTf();
const zoomBfit = await zoomPct();
must(tfBfit !== tfA, `A5 first visit FITS the new workspace (not Main's view)`);
await panBg(200, 80);
const tfB2 = await worldTf();
const zoomB2 = await zoomPct();
must(tfB2 !== tfBfit || zoomB2 !== zoomBfit, "A6 Second workspace panned to its own view");

await switchWs("Main");
const tfBack = await worldTf();
const zoomBack = await zoomPct();
must(tfBack === tfA && zoomBack === zoomA, `A7 back to Main — view restored EXACTLY (zoom ${zoomBack}%)`);
await switchWs("t98 Second");
const tfBack2 = await worldTf();
must(tfBack2 === tfB2, "A8 back to Second — ITS remembered view (not the fit)");

/* ---------------- Phase B: reload restores (same tab) ---------------- */
console.log("Phase B — reload restores");
await switchWs("Main");
const tfPre = await worldTf();
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(1000);
const tfReload = await worldTf();
const zoomReload = await zoomPct();
must(tfReload === tfPre, `B1 reload restores Main's remembered view via sessionStorage hydrate (zoom ${zoomReload}%)`);

/* ---------------- Phase C: arrange wins ---------------- */
console.log("Phase C — arrange wins");
// capture the world before the arrange — auto-arrange PERSISTS new card
// positions, and leaving a re-arranged Main behind would poison every
// geometry-sensitive suite after this one (t87 anchors seeds relative to
// existing cards). Probe side-effects must be world-restoring.
const posBefore = (await listJobs()).map((j) => ({ id: j.id, x: j.x, y: j.y }));
await p.locator('[aria-label="Zoom in"]').click();
await sleep(300);
await panBg(120, 60);
const tfPreC = await worldTf();
await p.locator('[aria-label="Auto-arrange workflow"]').click();
await sleep(1200);
const tfC = await worldTf();
must(tfC !== tfPreC, "C1 auto-arrange reframed the canvas");
await switchWs("t98 Second");
await switchWs("Main");
const tfCBack = await worldTf();
must(tfCBack === tfC, "C2 the fit BECAME the memory — switch away/back keeps it");
// restore the pre-arrange world (same bulk route applyLayout uses)
await api("/api/jobs/layout", "POST", { updates: posBefore });

/* ---------------- Phase D: static contract ---------------- */
console.log("Phase D — static contract");
const storeSrc = readFileSync("src/lib/store.ts", "utf8");
must(
  (storeSrc.match(/scheduleViewportMemoryPersist\(memory\)/g) ?? []).length === 2,
  "D1 store: debounced sessionStorage persist wired in BOTH setViewport and panBy"
);
must(
  storeSrc.includes("viewportMemory: hydrateViewportMemory()") && storeSrc.includes("Record<string, Viewport>"),
  "D2 store: memory field typed + hydrated from sessionStorage seed"
);
const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
must(
  canvasSrc.includes("fittedEpochRef") && canvasSrc.includes("fittedKeyRef"),
  "D3 canvas: merged trigger effect with epoch+key refs (poll no-ops)"
);
must(
  canvasSrc.includes("viewportMemory[fitKey]") && canvasSrc.indexOf("epochChanged") < canvasSrc.indexOf("viewportMemory[fitKey]"),
  "D4 canvas: epoch fit wins BEFORE the memory restore"
);
must(
  !storeSrc.includes("localStorage.setItem(VIEWPORT_MEMORY_KEY") &&
    !canvasSrc.includes("localStorage.setItem"),
  "D5 session scope: the viewport MEMORY never touches localStorage (Task 100's bookmarks are a different object — user assets, different key)"
);

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
for (const j of (await listJobs()).filter((x) => x.name.startsWith("t98"))) {
  try { await api(`/api/jobs/${j.id}`, "DELETE"); } catch { /* gone */ }
}
for (const w of (await api("/api/workspaces")).workspaces.filter((w) => w.name.startsWith("t98 "))) {
  try { await api(`/api/workspaces/${w.id}`, "DELETE"); } catch { /* gone */ }
}
const jobsAfter = (await listJobs()).length;
const wsAfter = ((await api("/api/workspaces")).workspaces).length;
must(jobsAfter === jobsBefore, `Z1 job count restored (${jobsAfter} == ${jobsBefore})`);
must(wsAfter === wsBefore, `Z2 workspace count restored (${wsAfter} == ${wsBefore})`);
await sleep(400);
must(consoleErrors.length === 0, `Z3 console clean (got ${consoleErrors.length})`);

console.log(`T98 ALL PASS (${PASS} assertions)`);
await cleanup();
process.exit(0);
