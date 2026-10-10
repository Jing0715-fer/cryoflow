// t638-e2e — the geometry echo moves to gesture end; the map shows its door.
//
// Two increments, one probe:
//   A. assistant geometry (t157 Phase F's caught mint, repaired + deepened):
//      fresh boot mints NOTHING; a drag echoes ONCE at pointerup (the final
//      shape, not the 60Hz trail); a bare click (down+up, no move) echoes
//      NOTHING; snap-home (dblclick) echoes the home shape.
//   B. the minimap's in-place dismiss hint: the kbd chip rides the map
//      header (lens-hints vocabulary), and the M door round-trips.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const GEO = "cryoflow.assistant.geometry.v1";
let PASS = 0;
const must = (cond, label, detail = "") => {
  if (!cond) throw new Error(`FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  PASS++;
  console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  console.log("--- Phase A1: fresh boot mints nothing ---");
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1500); // let every mount effect fire
  must((await p.evaluate((k) => localStorage.getItem(k), GEO)) === null,
    "fresh boot writes NO geometry key (the mint is dead)");
  must((await p.locator('[data-canvas-ui="minimap"] [data-mm-hint] kbd').textContent()) === "M",
    "the minimap header carries the M kbd chip");

  console.log("--- Phase A2: a bare click echoes nothing ---");
  await p.locator('[aria-label="AI assistant"]').click({ timeout: 5000 });
  await sleep(1200);
  const title = p.locator('text=AI 助手').first();
  const tb = await title.boundingBox();
  must(!!tb, "the assistant window opened with its header title");
  await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await p.mouse.down();
  await p.mouse.up();
  await sleep(600);
  must((await p.evaluate((k) => localStorage.getItem(k), GEO)) === null,
    "a bare click on the header echoes NOTHING (moved flag stays false)");

  console.log("--- Phase A3: a drag echoes once, at gesture end ---");
  const tb2 = await title.boundingBox();
  await p.mouse.move(tb2.x + tb2.width / 2, tb2.y + tb2.height / 2);
  await p.mouse.down();
  // a 120px travel in steps — the old effect would have written ~every step
  for (let i = 1; i <= 8; i++) {
    await p.mouse.move(tb2.x + tb2.width / 2 + i * 15, tb2.y + tb2.height / 2 + i * 8);
    await sleep(30);
  }
  await p.mouse.up();
  await sleep(600);
  const raw = await p.evaluate((k) => localStorage.getItem(k), GEO);
  must(!!raw, "the drag's pointerup echoes the shape (key present)");
  const g = JSON.parse(raw);
  must(typeof g.x === "number" && typeof g.y === "number" && typeof g.w === "number" && typeof g.h === "number",
    "the echo is a well-formed WinGeo", JSON.stringify(g));
  must(g.x > 500, "the echo holds the DRAGGED shape (x moved right)", `x=${g.x}`);

  console.log("--- Phase B: the M door round-trips ---");
  await p.keyboard.press("M");
  await sleep(500);
  must((await p.locator('[data-canvas-ui="minimap"]').count()) === 0,
    "M hides the map");
  await p.keyboard.press("M");
  await sleep(500);
  must((await p.locator('[data-canvas-ui="minimap"] [data-mm-hint]').count()) === 1,
    "M brings the map back, chip and all");

  // reload — the dragged shape must survive (the echo's whole point).
  // t638 note: measure the WINDOW root ([data-ai-assistant], whose
  // left/top ARE g.x/g.y), not the title text — the text sits one icon
  // and a padding band inside the header (~63px right, ~15px down), a
  // offset the first cut of this probe mistook for a failed restore.
  console.log("--- Phase C: the dragged shape outlives a reload ---");
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await p.locator('[aria-label="AI assistant"]').click({ timeout: 5000 });
  await sleep(1200);
  const win = await p.locator('[data-ai-assistant]').boundingBox();
  must(!!win && Math.abs(win.x - g.x) < 8 && Math.abs(win.y - g.y) < 8,
    "reload restores the dragged position (window root, not the title text)",
    `win=(${Math.round(win?.x ?? -1)},${Math.round(win?.y ?? -1)}) want=(${g.x},${g.y})`);

  must(errors.length === 0, "zero console/page errors", errors.slice(0, 2).join(" | ") || "0");
  await p.screenshot({ path: "/home/z/my-project/.qa-logs/t638-final.png" });
  await b.close();
  console.log(`T638 ALL PASS (${PASS} assertions)`);
};

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
