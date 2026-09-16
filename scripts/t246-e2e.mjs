// t246 — the exemption doc lives where the question is asked (Task 246).
// Task 245 made "every header door is indexed in the palette" a CONTRACT
// (DOOR_RULES + EXEMPT_RULES as data in the suite). Task 246 productizes
// the exemptions: the shortcuts dialog grows a "Not in ⌘K — and why"
// group, placed directly after Global (whose ⌘K row GIVES BIRTH to the
// question — the doc follows the question). The two exemptions are honest,
// not oversights: each row names its door, renders the reason verbatim,
// and shows the keyboard path that justified the exemption.
//
// THE WELL: src/lib/palette-exemptions.json is the single source of truth.
// Mouth 1 — the shortcuts dialog renders the group FROM these bytes.
// Mouth 2 — t245-e2e reads the same bytes as its EXEMPT_RULES. This suite
// asserts the mirror: JSON ↔ dialog rows byte-identical (whitespace-
// normalized), JSON match regexes each pin exactly one LIVE header door,
// and the count words in the hint derive from the same bytes.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  the doc — press "?" opens the shortcuts dialog; group order
//      (Global → Not in ⌘K — and why: the answer follows the question);
//      the hint's "2 honest exemptions" derives from the well; each
//      exemption row carries door name + reason VERBATIM + keyboard chips
//      matching the JSON keys; the JSON match regexes each hit exactly one
//      live header door (the same data that documents the doors also
//      anchors them)
//   C  filter & peel — "print" keeps only the print row, "palette" only
//      the palette row (the filter reads rows, not groups), nonsense is
//      the empty state, Esc closes, reopening starts unfiltered (the
//      dialog's own stale-filter law)
//   D  console clean + the frame (the dialog scrolled to the new group)
//
// Run: node scripts/t246-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/scripts/shots-qa84";

const exemptions = JSON.parse(
  readFileSync(new URL("../src/lib/palette-exemptions.json", import.meta.url), "utf8"),
);
const EXEMPT_DOORS = exemptions.exemptDoors;
const norm = (s) => s.replace(/\s+/g, " ").trim();

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 940 }, deviceScaleFactor: 2 });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// ---- Phase A: demo truth ------------------------------------------------------
console.log("== PHASE A: demo truth ==");
const res = await page.goto(BASE, { waitUntil: "domcontentloaded" });
must(res.status() === 200, `homepage 200 (got ${res.status()})`);
await sleep(2500);
const roster = await page.evaluate(async () => {
  const r = await fetch("/api/jobs");
  return (await r.json()).jobs.length;
});
must(roster === 21, `roster identity 21 (got ${roster})`);

// ---- Phase B: the doc ----------------------------------------------------------
console.log("== PHASE B: the doc follows the question ==");
await page.keyboard.press("?");
await sleep(900);
const dialog = page.locator('[role="dialog"]');
must(await dialog.count() === 1, "? opens the shortcuts dialog (one dialog)");
must(
  (await dialog.locator("h2, [data-slot='dialog-title']").first().textContent()).includes("Keyboard shortcuts"),
  "the dialog is the Keyboard shortcuts report",
);

const sections = dialog.locator("section");
const groupLabels = await sections.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
must(groupLabels[0] === "Global shortcuts", `group[0] is Global (got "${groupLabels[0]}")`);
must(
  groupLabels[1] === "Not in ⌘K — and why shortcuts",
  `group[1] is the exemption doc, directly after the ⌘K row's group (got "${groupLabels[1]}")`,
);

const notInK = dialog.locator('section[aria-label="Not in ⌘K — and why shortcuts"]');
must((await notInK.count()) === 1, "the Not-in-⌘K group is present exactly once");

// the group renders TWO <p>s: the label first, the hint second — read the second
const hintText = norm(await notInK.locator("p").nth(1).textContent());
must(
  hintText.includes(`${EXEMPT_DOORS.length} honest exemptions`),
  `hint count derives from the well (got "${hintText.slice(0, 80)}…")`,
);
must(
  hintText.includes("Every header door is indexed in the command palette"),
  "hint states the law before the exemptions",
);

// mirror law: each JSON exemption speaks in the dialog VERBATIM
for (const d of EXEMPT_DOORS) {
  const row = notInK.locator("dl > div").filter({
    has: page.locator("dd", { hasText: d.door.split(" (")[0] }),
  });
  must((await row.count()) === 1, `EXEMPT ${d.name}: exactly one row names the door`);
  const rowText = norm((await row.locator("dd").textContent()) ?? "");
  must(rowText.includes(d.door), `EXEMPT ${d.name}: row carries the clean door name`);
  must(rowText.includes(norm(d.reason)), `EXEMPT ${d.name}: reason rendered VERBATIM (same bytes)`);
  must(rowText.includes("—"), `EXEMPT ${d.name}: the em-dash separates door from reason`);
  const chips = await row.locator("dt kbd").allTextContents();
  must(
    norm(chips.join(" ")) === d.keys,
    `EXEMPT ${d.name}: keyboard chips match the well (got [${chips.join(" | ")}])`,
  );
}

// the same well anchors the LIVE doors: each match regex hits exactly one header door
const doorTitles = await page.evaluate(() => {
  const cands = [
    ...document.querySelectorAll("header button, header a, header [role='combobox']"),
  ];
  return cands
    .map((el) => el.getAttribute("aria-label") || el.getAttribute("title") || "")
    .filter(Boolean);
});
for (const d of EXEMPT_DOORS) {
  const re = new RegExp(d.match);
  const hits = doorTitles.filter((t) => re.test(t));
  must(
    hits.length === 1,
    `EXEMPT ${d.name}: the well's match anchors exactly one live header door (got ${hits.length}${hits.length ? `: "${hits[0]}"` : ""})`,
  );
}

// ---- Phase C: filter & peel ----------------------------------------------------
console.log("== PHASE C: filter & peel ==");
const filterInput = dialog.locator("input[aria-label='Filter shortcuts']");
await filterInput.fill("print");
await sleep(400);
const printRows = await notInK.locator("dl > div").count();
const paletteRows = await notInK
  .locator("dl > div", { hasText: "Open command palette" })
  .count();
must(printRows === 1 && paletteRows === 0, `"print" keeps only the print row (rows: ${printRows}, palette rows: ${paletteRows})`);

await filterInput.fill("palette");
await sleep(400);
must(
  (await notInK.locator("dl > div", { hasText: "Open command palette" }).count()) === 1 &&
    (await notInK.locator("dl > div", { hasText: "Print this view" }).count()) === 0,
  `"palette" keeps only the palette row`,
);

await filterInput.fill("zzzq");
await sleep(400);
must(
  (await dialog.textContent()).includes("No shortcut matches"),
  "nonsense hits the honest empty state",
);

await page.keyboard.press("Escape");
await sleep(500);
must((await page.locator('[role="dialog"]').count()) === 0, "Esc closes the dialog");

await page.keyboard.press("?");
await sleep(900);
const filterVal = await page.locator("input[aria-label='Filter shortcuts']").inputValue();
must(filterVal === "", `reopening starts unfiltered (got "${filterVal}")`);
await page.keyboard.press("Escape");
await sleep(400);

// ---- Phase D: console + frame ---------------------------------------------------
console.log("== PHASE D: console + frame ==");
await page.keyboard.press("?");
await sleep(900);
const frameSection = page.locator('section[aria-label="Not in ⌘K — and why shortcuts"]');
await frameSection.scrollIntoViewIfNeeded();
mkdirSync(SHOTS, { recursive: true });
await page.locator('[role="dialog"]').screenshot({ path: `${SHOTS}/t246-not-in-palette-2x.png` });
console.log(`  frame: ${SHOTS}/t246-not-in-palette-2x.png`);
must(consoleErrors.length === 0, `console clean (got ${consoleErrors.length}: ${consoleErrors.join(" | ") || "—"})`);

await browser.close();
console.log(fail === 0 ? "t246: ALL PASS" : `t246: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
