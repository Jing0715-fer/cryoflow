// t243 — the dashboard's engine-guidance sister page (Task 243).
// The header chip's popover (t242) keeps the "click for guidance" promise at
// the top of the app, but the QUESTION "why is RELION not detected?" arises
// where the reader sees the dead KPI card — the dashboard "Active engine"
// card used to be the ONLY non-clickable card in the band, a dead end.
// Task 243: the card becomes a real button that opens its own popover —
// the THIRD MOUTH of the same well (the API's hint bytes), with the
// Re-detect affordance riding along (the guidance's closing line promises
// "then press Re-detect"; a promise must not point at a door the reader
// cannot reach from where they stand).
// Phases:
//   A  API truth (light) — found:false, the well exists, closes on Re-detect
//   B  dashboard truth — the card is a real button with the SAME promise
//      title as the chip; aria-haspopup/expanded semantics (not aria-pressed);
//      corner info whisper; click opens the popover; MIRROR LAW third case
//      (popover lines === API hint lines); mono A/B; amber tint; band
//      borrows scroll (t238 law); Re-detect door present; Esc closes;
//      re-click reopens
//   C  frame — shots-qa84/t243-engine-guidance-dashboard-2x: the guidance
//      living where the question is asked
//   D  console clean
// Run: node scripts/t243-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// ---- Phase A: API truth (the well) ----------------------------------------
console.log("== PHASE A: API truth (the well) ==");
const sys = await (await fetch(`${BASE}/api/system?force=1`, { headers: { "sec-fetch-site": "same-origin" } })).json();
must(sys.found === false, "engine not found (demo host truth)");
const hint = typeof sys.hint === "string" ? sys.hint : "";
must(hint.length > 40, "the well exists (hint substantial)");
must(hint.includes("then press Re-detect — no restart needed"), "the well's closing line promises Re-detect");

// ---- Phase B: dashboard truth ----------------------------------------------
console.log("== PHASE B: dashboard sister page ==");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
must((jobs.jobs ?? []).length === 21, `roster identity 21 (got ${(jobs.jobs ?? []).length})`);

// to the dashboard view
await page.getByRole("tab", { name: "Dashboard" }).click();
await sleep(1500);

// the card: a real button carrying the SAME promise title as the header chip.
// Scope by the KPI card's group class — the chip in the header carries the
// identical title (that IS the mirror), so the title alone hits two elements.
const card = page.locator('button[class*="group/kpi"][title="RELION not detected on this host — click for guidance"]');
must((await card.count()) === 1, "Active engine card is a real button with the guidance promise title");
const cardInfo = await card.evaluate((el) => ({
  tag: el.tagName,
  haspopup: el.getAttribute("aria-haspopup"),
  expanded: el.getAttribute("aria-expanded"),
  pressed: el.getAttribute("aria-pressed"),
}));
must(cardInfo.haspopup === "dialog", "aria-haspopup=dialog (an opening button, not a pressed toggle)");
must(cardInfo.expanded === "false", "aria-expanded starts false");
must(cardInfo.pressed === null, "no aria-pressed (state semantics evolved with t243)");
must((await card.locator("svg.lucide-info").count()) === 1, "corner info whisper present (guidance verb, not drill-down chevron)");
const sub = await card.locator("p").filter({ hasText: "RELION not detected" }).count();
must(sub === 1, "card reads the not-found state honestly");

// open the popover
await card.click();
await sleep(900);
const pop = page.locator("[data-engine-guidance-dashboard]");
must((await pop.count()) === 1, "dashboard guidance popover opens");
must((await card.getAttribute("aria-expanded")) === "true", "aria-expanded flips true while open");

// MIRROR LAW — third mouth, one well: the rendered non-empty line sequence
// is byte-identical to the API's hint (innerText speaks rendered blocks:
// every <p> boundary is a blank line — the contract is the non-empty lines).
const normLines = (s) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .join("\n")
    .trim();
const block = pop.locator("[data-engine-hint]");
must((await block.count()) === 1, "one guidance block in the dashboard popover");
const uiText = (await block.innerText()).replace(/\r/g, "").trim();
must(normLines(uiText) === normLines(hint), "dashboard popover lines === API hint lines, byte-identical and in order (third mouth, one well)");

must((await block.locator("p.font-mono").count()) === 2, "A/B remedy lines render mono (exactly 2)");
must(((await block.getAttribute("class")) ?? "").includes("amber"), "guidance block carries the amber tint");

// t238's law in the dashboard popover: wide mono line borrows scroll from
// its own band; the band never spills past the popover box.
const geo = await block.evaluate((el) => ({
  sw: el.scrollWidth,
  cw: el.clientWidth,
  right: el.getBoundingClientRect().right,
}));
const popRight = await block.evaluate(
  (el) => el.closest("[data-radix-popper-content-wrapper]")?.getBoundingClientRect().right ?? 0
);
must(geo.sw > geo.cw, `wide B) line borrows scroll from its band (scrollWidth ${geo.sw} > clientWidth ${geo.cw})`);
must(geo.right <= popRight + 1, "guidance band never spills past the popover box");

// the Re-detect door rides along — the promise's affordance is reachable
const redetect = pop.getByRole("button", { name: "Re-detect" });
must((await redetect.count()) === 1, "Re-detect door present in the dashboard popover (the promise is reachable)");
const checkedRow = await pop.textContent();
must(checkedRow?.includes("checked "), "provenance line (checked <time>) rides along");

// Esc closes; the card reports false; re-click reopens (state-toggle restart)
await page.keyboard.press("Escape");
await sleep(600);
must((await pop.count()) === 0, "Escape closes the popover");
must((await card.getAttribute("aria-expanded")) === "false", "aria-expanded returns to false");
await card.click();
await sleep(700);
must((await pop.count()) === 1, "re-click reopens the popover (state toggle, not one-shot)");

// ---- Phase C: frame ---------------------------------------------------------
console.log("== PHASE C: frame ==");
mkdirSync(SHOTS, { recursive: true });
const cardBox = await card.boundingBox();
const popBox = await pop.boundingBox();
if (cardBox && popBox) {
  const x = Math.max(0, Math.min(cardBox.x, popBox.x) - 24);
  const y = Math.max(0, cardBox.y - 24);
  const w = Math.min(1440 - x, Math.max(cardBox.width, popBox.width) + 48);
  const h = Math.min(900 - y, popBox.y - cardBox.y + popBox.height + 48);
  await page.screenshot({
    path: `${SHOTS}/t243-engine-guidance-dashboard-2x.png`,
    clip: { x, y, width: w, height: h },
  });
  console.log(`  frame: ${SHOTS}/t243-engine-guidance-dashboard-2x.png`);
} else {
  must(false, "frame skipped — card or popover not measurable");
}

// ---- Phase D: console clean -------------------------------------------------
console.log("== PHASE D: console ==");
must(errors.length === 0, `console clean (got ${errors.length}: ${errors.slice(0, 2).join(" | ")})`);

await browser.close();
if (fail > 0) {
  console.error(`t243: ${fail} FAIL`);
  process.exit(1);
}
console.log("t243: ALL PASS");
