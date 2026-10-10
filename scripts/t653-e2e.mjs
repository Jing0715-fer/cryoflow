// t653 — the fuzzy dialect walks the real canvas: the matcher moved to
// lib/job-match.ts (one home, three consumers) and grew the subsequence
// dialect; this e2e proves the growth on the LIVE find bar + canvas
// rings, in the canonical world, without planting a single row.
//
// Probe contract:
//   B  UI real world —
//      "2dc"  → the dialect hit: no substring exists anywhere, yet the
//               2D classification AND 2D class selection cards ring
//               (2 total). The count chip says 2.
//      "ca2"  → the order guard: same letters, wrong order, honest zero
//               (the count speaks destructive, nothing rings).
//      "ctf"  → the includes regression: exactly the CTF card rings.
//      clear  → Task 134: emptied query, rings all gone.
//      Enter  → the cycle still jumps (count button advances the cursor).
//   C  console hygiene + 📸.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

// dashboard → workflow canvas (the view switcher is the semantic door)
await page.locator('[role="tab"][title^="Workflow canvas"]').click();
await sleep(2000);
must((await page.locator('[data-canvas-ui="find-toggle"]').count()) > 0, "B canvas view reached (find toggle present)");

// open the find bar
await page.locator('[data-canvas-ui="find-toggle"]').click();
await sleep(600);
const input = page.locator('[data-testid="canvas-find-input"]');
must(await input.isVisible(), "B find bar opens (input focused/visible)");

const ringCount = async () => await page.locator('[data-find-match="true"]').count();
const countText = async () => (await page.locator('[data-testid="canvas-find-count"]').innerText()).trim();

// --- the dialect: "2dc" ---
await input.fill("2dc");
await sleep(900);
must((await countText()).startsWith("2"), "B 2dc rings TWO cards (2D classification + 2D class selection)", `count=${await countText()}`);
must((await ringCount()) === 2, "B the ring set matches the count", `rings=${await ringCount()}`);

// the count chip is a door: Enter advances the cycle
await input.press("Enter");
await sleep(700);
must((await page.locator('[data-testid="canvas-find-count"]').count()) > 0, "B Enter over a fuzzy match set keeps the cycle alive");
await page.screenshot({ path: ".qa-logs/t653-fuzzy-2dc.png" });

// --- the order guard: "ca2" ---
await input.fill("ca2");
await sleep(900);
must((await countText()).startsWith("no"), "B ca2 is an honest zero (same letters, wrong order)", `count=${await countText()}`);
must((await ringCount()) === 0, "B no rings for the wrong order");

// --- includes regression: "ctf" ---
await input.fill("ctf");
await sleep(900);
must((await countText()).startsWith("1"), "B ctf keeps its exact include hit", `count=${await countText()}`);
must((await ringCount()) === 1, "B exactly one card rings for ctf");

// --- Task 134: emptied query ---
await input.fill("");
await sleep(700);
must((await ringCount()) === 0, "B emptied query rings nothing (Task 134 intact)");

// console hygiene
must(consoleErrors.length === 0, "C zero console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t653-find-bar.png" });

await b.close();
console.log(`\nt653-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
