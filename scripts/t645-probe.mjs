// t645 — the chip-vocabulary unification probe.
//
// Before this window, ~28 chip sites across ~20 files hand-rolled the
// same pill in seven dialects: 9/10/10.5/11px × px-2/px-2.5/px-1.5 ×
// rounded-full/rounded-md/bare × medium/semibold/inherited × two focus
// generations × two press scales. The t645 primitive (ui/chip.tsx)
// owns the skeleton; sites own placement and tint.
//
// Verdicts:
//   A  primitive legislation — the skeleton rows live in chip.tsx with
//      the t642-era type rungs (xs 9 / sm 10 / md 11 / lg 11-semibold /
//      stamp 10), the muted tone carries the borderless wash, and
//      interactive carries the t586 canonical ring + one press scale.
//   B  dialect extinction — all seven hand-written skeletons are gone
//      from the workflow tree; the legacy focus ring is gone from the
//      one chip site that carried it; no file still hand-writes an
//      inline-flex chip skeleton.
//   C  DOM living body — the canvas find bar's status chips render
//      through the primitive (data-slot="chip" merged onto the button
//      by Slot) and the computed styles are the governed ones:
//      9999px radius, 11px type, 1px hairline border. The unification
//      point is the browser's actual pixels, not the class strings.
//   D  console hygiene.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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

// A — primitive legislation
const chipSrc = readFileSync("src/components/ui/chip.tsx", "utf8");
must(
  chipSrc.includes("rounded-full px-2 py-0.5 text-[11px] font-medium"),
  "A md row: the canonical 11px toggle pill",
);
must(
  chipSrc.includes("rounded-full px-1.5 py-px text-[9px] font-medium leading-none") &&
    chipSrc.includes("rounded-full px-1.5 py-px text-[10px] font-medium") &&
    chipSrc.includes("rounded-full px-2.5 py-1 text-[11px] font-semibold"),
  "A xs/sm/lg rows: the 9/10/11px rungs",
);
must(
  chipSrc.includes('stamp: "rounded-md px-1.5 py-0.5 text-[10px]"'),
  "A stamp row: squared, no weight of its own",
);
must(
  chipSrc.includes("focus-visible:ring-[3px] focus-visible:ring-ring/50") &&
    chipSrc.includes("motion-safe:active:scale-[0.96]"),
  "A interactive: canonical t586 ring + the one press scale",
);

// B — dialect extinction (recursive walk over the component tree)
const roots = ["src/components/workflow", "src/components/ai"];
const dialects = [
  ["D1 11px px-2 pill", "rounded-full border px-2 py-0.5 text-[11px]"],
  ["D2 11px px-2.5 pill", "rounded-full border px-2.5 py-1 text-[11px]"],
  ["D3 10px px-1.5 pill", "rounded-full border px-1.5 py-px text-[10px]"],
  ["D4 squared stamp", "rounded-md border px-1.5 py-0.5 text-[10px]"],
  ["D5 bare muted", "rounded bg-muted/60 px-1.5 py-px"],
  ["D6 9px shrunken pill", "rounded-full border px-1.5 py-px text-[9px]"],
  ["D7 KV stamp", "rounded-md border bg-muted/40 px-1.5 py-0.5 text-[10px]"],
];
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
};
const files = roots.flatMap((r) => walk(r));
for (const [name, skeleton] of dialects) {
  const hits = files.filter((f) => readFileSync(f, "utf8").includes(skeleton));
  must(hits.length === 0, `B ${name} extinct`, hits.length ? hits.join(",") : "0 sites");
}
const fscCompare = readFileSync("src/components/workflow/results/fsc-compare-dialog.tsx", "utf8");
must(
  fscCompare.includes('data-testid={`fsc-compare-legend-${id}`}') &&
    fscCompare.indexOf("<Chip") < fscCompare.indexOf('data-testid={`fsc-compare-legend-${id}`}') &&
    fscCompare.includes('size="md"'),
  "B legend chips render through the primitive (interactive row owns the ring now)",
);

// C — DOM living body: the find bar's status chips through the primitive
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
must(view === "canvas", "C canvas view reached", `${view}`);

await page.keyboard.press("Escape");
const findToggle = page.locator('[data-canvas-ui="find-toggle"]');
let toggleReady = false;
for (let i = 0; i < 10; i++) {
  if ((await findToggle.count()) > 0 && (await findToggle.first().isVisible().catch(() => false))) {
    toggleReady = true;
    break;
  }
  await page.waitForTimeout(1_000);
}
must(toggleReady, "C find toggle present");
await findToggle.first().click();
let barOpen = false;
for (let i = 0; i < 10; i++) {
  barOpen = (await page.locator('[data-testid^="canvas-find-status-"]').count()) > 0;
  if (barOpen) break;
  await page.waitForTimeout(800);
}
must(barOpen, "C find bar opened with status chips");

const chipProbe = await page.evaluate(() => {
  const btn = document.querySelector('button[data-slot="chip"][data-testid^="canvas-find-status-"]');
  if (!btn) return { found: false };
  const cs = getComputedStyle(btn);
  return {
    found: true,
    radius: cs.borderRadius,
    fontSize: cs.fontSize,
    borderWidth: cs.borderTopWidth,
    display: cs.display,
    fontMono: cs.fontFamily.toLowerCase().includes("mono"),
    count: document.querySelectorAll('button[data-slot="chip"]').length,
  };
});
must(chipProbe.found, "C status chips carry data-slot=chip (Slot merge)", `${chipProbe.count ?? 0} chips`);
// Tailwind v4's rounded-full is calc(infinity * 1px); Chromium resolves
// it to 2^25-ish px — assert the magnitude, not the spelling.
must(
  chipProbe.found && parseFloat(chipProbe.radius) > 1e6,
  "C computed radius is the governed pill (infinity → 2^25px)",
  chipProbe.radius,
);
must(chipProbe.found && chipProbe.fontSize === "11px", "C computed type is the governed 11px md row", chipProbe.fontSize);
must(chipProbe.found && chipProbe.borderWidth === "1px", "C computed border is the hairline", chipProbe.borderWidth);

// D — console hygiene
must(consoleErrors.length === 0, "D zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

await page.screenshot({ path: ".qa-logs/t645-chip-vocab.png" });
console.log(`t645-probe: ${PASS} pass / ${FAIL} fail`);
writeFileSync(
  "/tmp/cryoflow-qa/t645-probe-verdict.json",
  JSON.stringify({ PASS, FAIL, chips: chipProbe.count ?? 0, probe: chipProbe }, null, 2),
);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
