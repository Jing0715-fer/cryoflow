// t99 — Task 99: viewport memory survives a reload (sessionStorage, per-tab).
//
// Task 98 gave the canvas per-(project:workspace) viewport memory but scoped
// it to the in-RAM store: a reload (F5 — accidental or deliberate) threw the
// view away and re-fit. "Session memory" should live exactly as long as the
// SESSION (the tab), not the React tree:
//   - store hydrates viewportMemory from sessionStorage on boot (same tab
//     ONLY — per-tab storage, zero cross-tab leakage);
//   - every viewport change is debounced (400ms trailing) into sessionStorage
//     — pan emits a state update per pointer move, IO is synchronous;
//   - reload in the same tab → remembered view returns EXACTLY (hydrate seed
//     feeds the canvas' keyChanged restore branch);
//   - a NEW tab starts empty (per-tab isolation) → first-visit fit contract;
//   - closing the tab burns it — never localStorage, never a fresh session.
//
// Phase S — setup: baseline, canvas up, sessionStorage cleared
// Phase A — personalize & persist: zoom+pan Main → sessionStorage holds the
//   record for the current (project:workspace) key, values match the live UI
// Phase B — reload restores: same tab reload → transform returns EXACTLY
// Phase C — tab isolation: a NEW tab fits (empty hydrate); the original tab
//   still restores after another reload (its storage untouched)
// Phase D — static contract: hydrate guard, debounce, quota try/catch,
//   shape validation, storage key, no localStorage, clamp on restore
// Phase Z — cleanup: counts restored, console clean
//
// Run: node scripts/t99-e2e.mjs   (server on :3000)
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
const jobsBefore = (await listJobs()).length;
must(jobsBefore >= 1, `S1 baseline reachable (${jobsBefore} jobs)`);

b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
// clean slate: no leftover memory from anything that ran in this tab before
await p.evaluate(() => window.sessionStorage.clear());
const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
  await p.keyboard.press("Shift+C");
  await sleep(700);
}
must((await curView()) === "canvas", `S2 canvas view active (got "${await curView()}")`);
// re-fit so the starting point is deterministic, then wait out any debounce
await p.locator('[aria-label="Reset view"]').click();
await sleep(800);

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
// the persisted record for the ACTIVE project:workspace key
const storedMemory = () =>
  p.evaluate(() => {
    const raw = window.sessionStorage.getItem("cryoflow.viewportMemory.v1");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return "PARSE_FAIL"; }
  });
const panBg = async (dx, dy) => {
  await p.mouse.move(1200, 810);
  await p.mouse.down();
  await p.mouse.move(1200 + dx, 810 + dy, { steps: 8 });
  await p.mouse.up();
  await sleep(500);
};

/* ---------------- Phase A: personalize & persist ---------------- */
console.log("Phase A — personalize & persist");
const tfFit = await worldTf();
const zoomFit = await zoomPct();
must(tfFit.includes("translate") && tfFit.includes("scale"), `A1 fit baseline live (zoom ${zoomFit}%)`);
await p.locator('[aria-label="Zoom in"]').click();
await sleep(300);
await panBg(-140, -60);
const tfA = await worldTf();
const zoomA = await zoomPct();
must(tfA !== tfFit, `A2 Main view personalized (zoom ${zoomA}%)`);
await sleep(700); // wait out the 400ms trailing debounce
const memA = await storedMemory();
must(!!memA && typeof memA === "object" && Object.keys(memA).length >= 1,
  "A3 sessionStorage holds the viewport record after the debounce window");
const memVals = Object.values(memA ?? {});
const lastZoom = memVals.length ? memVals[memVals.length - 1].zoom : NaN;
must(Math.abs(lastZoom * 100 - Number(zoomA)) < 1,
  `A4 persisted zoom matches the live UI (${(lastZoom * 100).toFixed(1)}% ≈ ${zoomA}%)`);

/* ---------------- Phase B: reload restores ---------------- */
console.log("Phase B — reload restores");
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(1000);
for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
  await p.keyboard.press("Shift+C");
  await sleep(700);
}
const tfReload = await worldTf();
const zoomReload = await zoomPct();
must(tfReload === tfA, `B1 reload restores the view EXACTLY (transform identical, zoom ${zoomReload}%)`);
must(zoomReload === zoomA, `B2 zoom restored to ${zoomA}% (fit would be ${zoomFit}%)`);

/* ---------------- Phase C: tab isolation ---------------- */
console.log("Phase C — tab isolation");
// a NEW tab in the same context has its OWN (empty) sessionStorage
const p2 = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p2.goto(BASE, { waitUntil: "networkidle" });
await p2.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
const view2 = () =>
  p2.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
for (let i = 0; i < 4 && (await view2()) !== "canvas"; i++) {
  await p2.keyboard.press("Shift+C");
  await sleep(700);
}
const tfNewTab = await p2.evaluate(() => {
  const el = document.querySelector('[data-canvas="workspace"]');
  return el instanceof HTMLElement ? (el.style.transform ?? "") : "";
});
const zoomNewTab = await p2.evaluate(() => {
  const el = document.querySelector('[data-canvas-ui="zoom-controls"]');
  return el?.textContent?.match(/(\d+)%/)?.[1] ?? "";
});
must(tfNewTab !== tfA && zoomNewTab !== zoomA,
  `C1 fresh tab does NOT inherit the memory — first-visit fit (zoom ${zoomNewTab}%, not ${zoomA}%)`);
await p2.close();
// the original tab's storage was never touched by the second tab
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(1000);
for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
  await p.keyboard.press("Shift+C");
  await sleep(700);
}
const tfBack = await worldTf();
must(tfBack === tfA, "C2 original tab still restores its own view after the detour");

/* ---------------- Phase D: static contract ---------------- */
console.log("Phase D — static contract");
const storeSrc = readFileSync("src/lib/store.ts", "utf8");
must(
  /function hydrateViewportMemory\(\)[\s\S]*?typeof window === "undefined"/.test(storeSrc),
  "D1 hydrate seeded into the store, SSR-guarded (typeof window)"
);
must(
  storeSrc.includes("VIEWPORT_MEMORY_PERSIST_MS = 400") && /clearTimeout\(viewportMemoryPersistTimer\)/.test(storeSrc),
  "D2 trailing debounce (400ms) — one sessionStorage write per gesture"
);
must(
  /sessionStorage\.setItem\([\s\S]*?\)\s*;\s*\}\s*catch/.test(storeSrc.replace(/\n/g, " ")),
  "D3 persist wrapped in try/catch (private mode / quota can't crash pan)"
);
must(
  (storeSrc.match(/Number\.isFinite\(/g) ?? []).length >= 3,
  "D4 hydrate shape-checks x/y/zoom (corrupted payloads dropped, not trusted)"
);
must(
  storeSrc.includes('VIEWPORT_MEMORY_KEY = "cryoflow.viewportMemory.v1"'),
  "D5 storage key namespaced + versioned"
);
must(
  !/localStorage\.setItem\([^)]*viewport/i.test(storeSrc),
  "D6 never localStorage — the memory burns with the tab by design"
);
const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
must(
  canvasSrc.includes("viewportMemory[fitKey]") && canvasSrc.includes("setViewport(remembered)"),
  "D7 restore goes through setViewport (clamp gate) via the keyChanged branch"
);
must(
  /fittedEpochRef = React\.useRef<number \| null>\(null\)/.test(canvasSrc) &&
    /if \(fittedEpochRef\.current === null\) fittedEpochRef\.current = layoutEpoch;/.test(canvasSrc),
  "D8 mount adopts the CURRENT epoch (lazy-init ref) — reload/remount decide via memory, not fit"
);

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
await sleep(400);
must(consoleErrors.length === 0, `Z1 console clean (got ${consoleErrors.length})`);
const jobsAfter = (await listJobs()).length;
must(jobsAfter === jobsBefore, `Z2 job count untouched (${jobsAfter} == ${jobsBefore})`);

console.log(`T99 ALL PASS (${PASS} assertions)`);
await cleanup();
process.exit(0);
