// t641 — the toast-reunification + shortcuts-completeness probe.
//
// Two repairs under verdict (playwright direct-drive, qa66 doctrine —
// the agent-browser daemon's environment diseases don't reach a fresh
// browser profile):
//
//   A  world identity — landing + dashboard convergence (t632/t90 law:
//      Shift+D toggle, t523 law: poll rows, never blind-read).
//
//   B  toast reunion — THE MONEY SHOT. The AI surfaces' ten sonner toasts
//      fed a <Toaster/> that was never mounted: "save failed", "rename
//      failed", "new chat started" all died in the void the day they were
//      written. After the t641 migration to the Radix use-toast law, the
//      "new chat" toast must VISIBLY land in the live toast viewport —
//      before this window that element never appeared in the DOM.
//      (resetChat fires the toast unconditionally — even the best-effort
//      catch path lands on it — so the live-fire is deterministic without
//      needing a configured AI backend.)
//
//   C  shortcuts completeness — the dialog is the single discoverable
//      surface (t246). Three live keyboards had no rows: the 3D map
//      viewer's whole layer (1–6 axis presets / 0 reset / B quick-save —
//      B was spoken only by its own completion toast, you had to press it
//      by accident to learn it), the search lens walk (↑↓ ↵ Esc — t637
//      put a footer on the lens but the dialog stayed dark), and the
//      enlarged class sheet's round stepping (← →). t248's law: a live
//      key with no row is a drift.
//
//   D  console hygiene — zero product console errors / pageerrors.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
let PASS = 0;
let FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) {
    PASS++;
    console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    FAIL++;
    console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
};

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

// A — land + converge on the dashboard (roster rows prove the world)
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
let rows = 0;
for (let i = 0; i < 12; i++) {
  const view = await page.evaluate(() =>
    document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  rows = await page.locator("[data-roster-row]").count();
  if (view === "dashboard" && rows >= 12) break;
  if (view !== "dashboard") await page.keyboard.press("Shift+D");
  await page.waitForTimeout(1_800);
}
must(rows >= 12, "A dashboard converged with roster rows", `${rows} rows`);

// B — toast reunion live-fire: the new-chat toast must LAND in the DOM.
// Pre-t641 this assertion could never pass: sonner had no mounted
// <Toaster/>, so the toast was a fire-and-forget into the void.
// (t641 diag: this Radix version's ToastViewport renders as
// ol[tabindex=-1] with z-[100] in its class — no data attribute — so
// the locator anchors the class. Every interaction carries an explicit
// timeout: the panel's mount re-render cycle can starve an unbounded
// click's actionability wait — the first probe run hung there.)
await page.locator('[aria-label="AI assistant"]').click({ timeout: 8_000 });
let panelOpen = false;
for (let i = 0; i < 10; i++) {
  panelOpen = (await page.locator("[data-ai-assistant]").count()) > 0;
  if (panelOpen) break;
  await page.waitForTimeout(800);
}
must(panelOpen, "B AI assistant panel opened from the header door");
await page.waitForTimeout(1_200); // let the panel's mount fetches settle

const toastViewport = page.locator('ol[class*="z-[100]"]');
try {
  await page.locator('[aria-label="New chat"]').click({ timeout: 8_000 });
} catch (e) {
  must(false, "B new-chat button clickable", e.message.split("\n")[0]);
}
let toastText = "";
for (let i = 0; i < 10; i++) {
  toastText = await toastViewport.textContent().catch(() => "");
  if (toastText && toastText.includes("已开始新对话")) break;
  await page.waitForTimeout(600);
}
must(
  toastText.includes("已开始新对话"),
  "B new-chat toast VISIBLY lands in the Radix viewport",
  toastText.trim().slice(0, 40) || "viewport empty — the old dead-end",
);

// dismiss it so it can't shadow later assertions (limit=1 would eat the
// next toast, but the viewport text lingers — close it properly)
await page.keyboard.press("Escape");

// C — shortcuts dialog completeness: open from "?" and demand the rows
await page.keyboard.press("?");
let dlgText = "";
for (let i = 0; i < 8; i++) {
  dlgText = (await page.locator('[role="dialog"]').textContent().catch(() => "")) ?? "";
  if (dlgText.includes("Keyboard shortcuts")) break;
  await page.waitForTimeout(600);
}
must(dlgText.includes("Keyboard shortcuts"), "C shortcuts dialog opened via ?");

const viewerSection = page.locator('section[aria-label="3D map viewer shortcuts"]');
must((await viewerSection.count()) === 1, "C 3D map viewer group exists");
const viewerText = (await viewerSection.textContent().catch(() => "")) ?? "";
must(
  viewerText.includes("Snap to a standard axis view") &&
    viewerText.includes("Reset to the default") &&
    viewerText.includes("Quick-save the current camera"),
  "C viewer group documents 1–6 / 0 / B",
);
must(
  dlgText.includes("Search lens — walk the results"),
  "C dashboard group documents the search lens walk",
);
must(
  dlgText.includes("Step rounds inside the enlarged class sheet"),
  "C gallery group documents the class sheet ← →",
);
// the new group has NO scope — it must never claim "current view"
must(
  (await viewerSection.getAttribute("data-current-view")) === null,
  "C viewer group stays out of the you-are-here logic",
);

// D — console hygiene
must(consoleErrors.length === 0, "D zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

await page.screenshot({ path: ".qa-logs/t641-shortcuts-toast.png" });
console.log(`t641-probe: ${PASS} pass / ${FAIL} fail`);
writeFileSync(
  "/tmp/cryoflow-qa/t641-probe-verdict.json",
  JSON.stringify({ PASS, FAIL, rows, toastLanded: toastText.includes("已开始新对话") }, null, 2),
);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
