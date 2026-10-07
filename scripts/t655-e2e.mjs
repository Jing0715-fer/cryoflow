// t655 — the WHY walks the real canvas: every ringing card now shows
// WHICH characters earned the ring (amber washes on the card's own name,
// or on the type row when the label won). The predicate and the
// highlight are one lib computation (jobMatchWhy) — this e2e proves the
// visible half on the LIVE find bar, canonical world, nothing planted.
//
// Probe contract:
//   B  UI real world —
//      "2dc"    → the dialect hit rings TWO cards; both titles carry
//                 data-find-why="name" and their amber marks spell the
//                 query back ("2D"+"C" per card); the type rows stay
//                 unmarked (the why points at the text that WON).
//      "movies" → the label dialect: "EMPIAR mics import" has no
//                 "movies" in its NAME, but its type label does — the
//                 ring arrives and the why lands on the TYPE row.
//      "ctf"    → the includes regression: one contiguous mark "ctf".
//      chip     → status chip alone is a lens: cards ring WITHOUT any
//                 why (the chip is the why — honest absence, t653).
//      clear    → Task 134: rings and whys all gone.
//   C  console hygiene + 📸×2.
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
/** Every ringed card's why, per source: [{source, marks: [text…]}]. */
const whyReport = async () => {
  const out = [];
  const cards = page.locator('[data-find-match="true"]');
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    const source = await card.locator("[data-find-why]").first().getAttribute("data-find-why").catch(() => null);
    const marks = await card.locator("[data-find-why-mark]").allInnerTexts();
    out.push({ source, marks });
  }
  return out;
};
const markWashOn = async () => {
  const marks = page.locator('[data-find-why-mark]');
  const n = await marks.count();
  if (n === 0) return false;
  const bg = await marks.first().evaluate((el) => getComputedStyle(el).backgroundColor);
  return bg !== "rgba(0, 0, 0, 0)";
};

// --- act 1: the name dialect — "2dc" ---
await input.fill("2dc");
await sleep(900);
must((await countText()).startsWith("2"), "B 2dc rings TWO cards", `count=${await countText()}`);
must((await ringCount()) === 2, "B the ring set matches the count");
{
  const rep = await whyReport();
  const allName = rep.length === 2 && rep.every((r) => r.source === "name");
  must(allName, "B both cards explain on the NAME row", JSON.stringify(rep.map((r) => r.source)));
  const concat = rep.map((r) => r.marks.join("").toLowerCase());
  must(concat.every((c) => c === "2dc"), "B the marks spell the query back ('2D'+'C' per card)", concat.join(" | "));
  must(rep.every((r) => r.marks.length === 2), "B two washes per card (gap after '2D' stays honest)", rep.map((r) => r.marks.length).join(","));
}
must((await page.locator('[data-find-why="label"]').count()) === 0, "B no label whys while the name won");
must(await markWashOn(), "B the wash is painted (mark bg not transparent)");
await page.screenshot({ path: ".qa-logs/t655-find-why-2dc.png" });

// --- act 2: the label dialect — "movies" ---
await input.fill("movies");
await sleep(900);
must((await countText()).startsWith("1"), "B 'movies' finds the import card through its TYPE label", `count=${await countText()}`);
{
  const rep = await whyReport();
  must(rep.length === 1 && rep[0].source === "label", "B the why lands on the TYPE row (name never contained 'movies')", JSON.stringify(rep.map((r) => r.source)));
  must(rep[0]?.marks.join("").toLowerCase() === "movies", "B the label marks spell 'movies'", JSON.stringify(rep[0]?.marks));
  must((await page.locator('[data-find-why="name"]').count()) === 0, "B the name stays unmarked — an explanation that points at the loser is a lie");
}
await page.screenshot({ path: ".qa-logs/t655-find-why-label.png" });

// --- act 3: the includes regression — "ctf" ---
await input.fill("ctf");
await sleep(900);
must((await ringCount()) === 1, "B ctf keeps its exact include hit");
{
  const rep = await whyReport();
  must(rep[0]?.source === "name" && rep[0]?.marks.length === 1 && rep[0]?.marks[0].toLowerCase() === "ctf",
    "B one contiguous wash spelling 'ctf'", JSON.stringify(rep[0]?.marks));
}

// --- act 4: chip alone is a lens — ring WITHOUT why ---
await input.fill("");
await sleep(500);
await page.locator('[data-testid="canvas-find-status-completed"]').click();
await sleep(900);
{
  const rings = await ringCount();
  const whys = await page.locator("[data-find-why]").count();
  must(rings > 0, "B status chip alone rings the completed set", `rings=${rings}`);
  must(whys === 0, "B chip-lit rings carry NO character why (the chip is the why)", `whys=${whys}`);
}
await page.locator('[data-testid="canvas-find-status-completed"]').click();
await sleep(700);

// --- act 5: Task 134 — emptied lens, everything gone ---
must((await ringCount()) === 0, "B cleared chip rings nothing (Task 134 intact)");
must((await page.locator("[data-find-why]").count()) === 0, "B no stray whys after the lens closes");

// console hygiene
must(consoleErrors.length === 0, "C zero console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt655-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
