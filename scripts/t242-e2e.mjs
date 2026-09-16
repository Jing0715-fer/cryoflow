// t242 — the engine popover's not-found guidance (Task 242).
// The chip's title has promised "click for guidance" for a long time; the WSL
// world's note honored that promise with A/B/C remedies + a "searched
// automatically" list, but the NATIVE world (every Linux/macOS host without a
// RELION install — the demo world's permanent state) answered with dashes.
// Task 242 composes the native hint FROM the search's own evidence
// (composeNativeHint in src/lib/relion/system.ts) so the guidance cannot
// drift from what was probed, and renders it in the popover.
// Phases:
//   A  API truth — found:false, hint present, the four searched-lines, the
//      A/B remedies, the Re-detect closing; dedupe of the known-path list
//      (the hardcoded /home/z/relion-install/bin vs ~/relion-install/bin)
//   B  popover truth — the chip opens the popover; [data-engine-hint] block
//      carries the SAME lines as the API hint (the mirror law, W3-flavored:
//      two mouths, one well); A/B lines render mono; block is amber-tinted
//      guidance; the wide B) line borrows scroll from its own band (t238's
//      law) instead of spilling past the popover box
//   C  frame — shots-qa84/t242-engine-guidance-2x: the guidance in use
//   D  console clean
// Run: node scripts/t242-e2e.mjs   (server on :3000)
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

// qa81/qa83 lesson: a leftover agent-browser page can hold stale UI state.
try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

// ---- Phase A: API truth ---------------------------------------------------
console.log("== PHASE A: API hint ==");
const sys = await (await fetch(`${BASE}/api/system?force=1`)).json();
must(sys.found === false, "engine not found (demo host truth)");
must(typeof sys.hint === "string" && sys.hint.length > 40, "hint present and substantial");
const hint = sys.hint ?? "";
must(hint.includes("CryoFlow searched this host"), "opens with the searched-this-host line");
must(hint.includes("RELION_HOME — not set"), "RELION_HOME fact line");
must(hint.includes("PATH — no relion_refine on PATH"), "PATH fact line");
must(hint.includes("Known locations"), "known-locations fact line");
must(hint.includes("Home scan"), "home-scan fact line");
must(hint.includes("A) put its bin on PATH"), "remedy A");
must(hint.includes("B) point RELION_HOME at it"), "remedy B");
must(hint.includes("then press Re-detect — no restart needed"), "closing names Re-detect, no restart");
const dup = (hint.match(/\/home\/z\/relion-install\/bin/g) || []).length;
must(dup === 1, `known-path list deduped (${dup} occurrence of the sandbox target)`);
const fresh = await (await fetch(`${BASE}/api/system?force=1`)).json();
must(fresh.hint === hint, "two probes → identical guidance except the clock (bytes stable)");

// ---- Phase B: popover truth ------------------------------------------------
console.log("== PHASE B: popover mirror ==");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

// roster guard (the family's world-identity check)
const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
must((jobs.jobs ?? []).length === 21, `roster identity 21 (got ${(jobs.jobs ?? []).length})`);

const chip = page.locator('button[aria-label^="RELION environment status"]');
must((await chip.count()) === 1, "engine chip present with status aria-label");
await chip.click();
await sleep(900);

const block = page.locator("[data-engine-hint]");
must((await block.count()) === 1, "guidance block rendered once in the popover");
await block.scrollIntoViewIfNeeded().catch(() => {});
// W4 law, examiner edition: innerText speaks RENDERED blocks — every <p>
// boundary reads as a blank line, so the UI text has \n\n where the composer
// bytes have \n. The contract is the SEQUENCE OF NON-EMPTY LINES, byte-
// identical and in order: blank separators are presentation, not content.
const normLines = (s) =>
  s
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .join("\n")
    .trim();
const uiText = (await block.innerText()).replace(/\r/g, "").trim();
must(normLines(uiText) === normLines(hint), "popover lines === API hint lines, byte-identical and in order (two mouths, one well)");

const monoLines = block.locator("p.font-mono");
must((await monoLines.count()) === 2, "A/B remedy lines render mono (exactly 2)");

const cls = (await block.getAttribute("class")) ?? "";
must(cls.includes("amber"), "guidance block carries the amber tint (actionable, not informational)");

// t238's law in the popover: a wide mono line borrows scroll from its OWN
// band — the block clips (scrollWidth > clientWidth) instead of spilling
// past the popover box.
const geo = await block.evaluate((el) => ({
  sw: el.scrollWidth,
  cw: el.clientWidth,
  right: el.getBoundingClientRect().right,
}));
const popRight = await block.evaluate(
  (el) => el.closest("[data-radix-popper-content-wrapper]")?.getBoundingClientRect().right ??
    el.closest('[role="dialog"]')?.getBoundingClientRect().right ?? 0
);
must(geo.sw > geo.cw, `wide B) line borrows scroll from its band (scrollWidth ${geo.sw} > clientWidth ${geo.cw})`);
must(geo.right <= popRight + 1, "guidance band never spills past the popover box");

// ---- Phase C: frame ---------------------------------------------------------
console.log("== PHASE C: frame ==");
mkdirSync(SHOTS, { recursive: true });
const chipBox = await chip.boundingBox();
const popBox = await block.boundingBox();
if (chipBox && popBox) {
  const x = Math.max(0, Math.min(chipBox.x, popBox.x) - 24);
  const y = Math.max(0, chipBox.y - 24);
  const w = Math.min(1440 - x, Math.max(chipBox.width, popBox.width) + 48 + 384);
  const h = Math.min(900 - y, popBox.y - chipBox.y + popBox.height + 48);
  await page.screenshot({
    path: `${SHOTS}/t242-engine-guidance-2x.png`,
    clip: { x, y, width: w, height: h },
  });
  console.log(`  frame: ${SHOTS}/t242-engine-guidance-2x.png`);
} else {
  must(false, "frame skipped — chip or block not measurable");
}

// ---- Phase D: console clean -------------------------------------------------
console.log("== PHASE D: console ==");
must(errors.length === 0, `console clean (got ${errors.length}: ${errors.slice(0, 2).join(" | ")})`);

await browser.close();
if (fail > 0) {
  console.error(`t242: ${fail} FAIL`);
  process.exit(1);
}
console.log("t242 GREEN");
