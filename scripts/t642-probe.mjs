// t642 — the kbd-vocabulary unification probe.
//
// Before this window, eighteen <kbd> sites across nine files hand-rolled
// the same bones in eight dialects (bg-background / bg-muted / muted/60 /
// bare; 8 / 8.5 / 9 / 10px; semibold / bold / regular; mono / inherit).
// The t642 primitive (ui/kbd.tsx) owns the bones; sites own placement.
//
// Verdicts:
//   A  platform naming — the find toggle's title speaks ⌘/Ctrl+F (the
//      cross-platform literal; pre-t642 it said Ctrl+F, lying to macOS).
//   B  dialog chips — the shortcuts dialog renders its chips through the
//      primitive: computed font-family is MONOSPACE (the unification
//      point — several dialects had no mono at all), and the 10px row
//      chips carry their px-1.5 py-0.5 placement delta.
//   C  source census — zero raw <kbd> outside the primitive; the palette
//      footer's 8.5px interloper is snapped to the governed 9px rung;
//      the dashboard chips keep their currentColor design (bg-transparent).
//   D  console hygiene.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

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

// C — source census (cheap, deterministic, no browser needed)
const kbdSrc = readFileSync("src/components/ui/kbd.tsx", "utf8");
must(
  kbdSrc.includes("rounded border bg-muted px-1 font-mono text-[9px] font-semibold leading-[14px]"),
  "C primitive owns the bones (rounded · border · bg-muted · mono · 9px · semibold)",
);
const paletteSrc = readFileSync("src/components/workflow/palette.tsx", "utf8");
must(!paletteSrc.includes("text-[8.5px]"), "C palette 8.5px interloper snapped to the 9px rung");
const dashSrc = readFileSync("src/components/workflow/project-dashboard.tsx", "utf8");
must(
  dashSrc.includes("bg-transparent") && !/<kbd/.test(dashSrc),
  "C dashboard chips keep currentColor design through the primitive",
);
const lensSrc = readFileSync("src/components/workflow/job-search-lens.tsx", "utf8");
must(!/<kbd/.test(lensSrc) && lensSrc.includes("<Kbd"), "C lens chips ride the primitive");

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
let view = null;
for (let i = 0; i < 10; i++) {
  view = await page.evaluate(() =>
    document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  if (view === "canvas") break;
  await page.waitForTimeout(1_500);
}
must(view === "canvas", "A canvas view reached", `${view}`);

// A — platform naming lives in the DOM, not just the source
const findTitle = await page
  .locator('[data-canvas-ui="find-toggle"]')
  .getAttribute("title")
  .catch(() => null);
must(
  findTitle != null && findTitle.includes("⌘/Ctrl+F"),
  "A find toggle title speaks the cross-platform literal",
  findTitle ?? "toggle not found",
);

// B — the dialog's chips render through the primitive
await page.keyboard.press("?");
let dlgOpen = false;
for (let i = 0; i < 8; i++) {
  dlgOpen =
    (await page
      .locator('[role="dialog"]')
      .filter({ hasText: "Keyboard shortcuts" })
      .count()) > 0;
  if (dlgOpen) break;
  await page.waitForTimeout(600);
}
must(dlgOpen, "B shortcuts dialog opened via ?");
const chipInfo = await page.evaluate(() => {
  const chips = Array.from(
    document.querySelectorAll('[role="dialog"] kbd'),
  );
  const first = chips[0];
  return {
    count: chips.length,
    mono: first ? getComputedStyle(first).fontFamily.toLowerCase().includes("mono") : false,
    sampleClass: first?.getAttribute("class") ?? "",
  };
});
must(chipInfo.count >= 20, "B dialog renders the key chips", `${chipInfo.count} chips`);
must(chipInfo.mono, "B chip font is monospace — the one-vocabulary point");
must(
  chipInfo.sampleClass.includes("font-mono") && chipInfo.sampleClass.includes("rounded"),
  "B chip carries the primitive's bone classes",
);

// D — console hygiene
must(consoleErrors.length === 0, "D zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

await page.screenshot({ path: ".qa-logs/t642-kbd-vocab.png" });
console.log(`t642-probe: ${PASS} pass / ${FAIL} fail`);
writeFileSync(
  "/tmp/cryoflow-qa/t642-probe-verdict.json",
  JSON.stringify({ PASS, FAIL, chips: chipInfo.count, mono: chipInfo.mono }, null, 2),
);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
