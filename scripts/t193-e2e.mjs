/* t193 e2e — the overlay earns its own landscape. Comparison maps
 * (half-maps, masked, classes) draw their own mean-density lines under
 * the main slice landscape, color-matched to their Layers swatches —
 * half-map disagreement (THE cryo-EM QC signal) becomes visible.
 *   S  setup — seeder, roster, both maps present in outputs
 *   W  wire — map-profile serves the OVERLAY path too; different box
 *      sizes give different bins counts (64³ vs 32³)
 *   X  source oracles — map-qualified cache keys, retire-first effect,
 *      color-matched rows, read-only rows, CSV stays main-map
 *   D  live UI — slice on → Layers → add half-map → terrain line appears
 *      color-matched; axis switch retires+refetches; cache feeds the
 *      return trip; remove overlay → line gone
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t193";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

const SRC = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
const roster0 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
// the map-profile surface denies metadata-less requests by design (t189's
// #5 guard) — a probe speaks browser, not curl
const H = { "sec-fetch-site": "same-origin" };

/* ============ S: setup ============ */
section("S: the world");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");
const outs = (await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`)).json());
const outList = JSON.stringify(outs);
must(outList.includes("orthovol.mrc"), "S2 orthovol.mrc (64³ main) in outputs");
must(outList.includes("run_it020_half1.mrc") && outList.includes("run_it020_half2.mrc"), "S3 both half-maps in outputs (the QC comparison pair)");

/* ============ W: the wire serves overlay paths ============ */
section("W: map-profile answers for a half-map too");
const pMain = await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent("orthovol.mrc")}&axis=z`, { headers: H })).json();
const pHalf = await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent("run_it020_half1.mrc")}&axis=z`, { headers: H })).json();
must(Array.isArray(pMain?.bins) && pMain.bins.length > 0 && pMain.bins.every((v) => Number.isFinite(v)), `W1 main map profile valid (${pMain?.bins?.length} bins)`);
must(Array.isArray(pHalf?.bins) && pHalf.bins.length > 0 && pHalf.bins.every((v) => Number.isFinite(v)), `W2 OVERLAY path profile valid (${pHalf?.bins?.length} bins) — the wire already speaks comparison`);
must(pMain.bins.length !== pHalf.bins.length, `W3 different box sizes pool differently (main ${pMain.bins.length} vs half ${pHalf.bins.length}) — fraction alignment is the contract, not bin index`);

/* ============ X: source oracles ============ */
section("X: the source tells the truth");
must(!/profileCache\.current\.(get|set)\((ax|op)\)/.test(SRC), "X1 every cache key is map-qualified (no bare-axis get/set survives)");
must(SRC.includes("const ck = `${path}|${ax}`") && SRC.includes("const ck = `${op}|${ax}`"), "X2 cache keys carry the map dimension (path|axis)");
must(SRC.includes("overlayPathsKey") && SRC.includes("overlayPathsKey.split"), "X3 the overlay terrain effect keys on overlay PATHS (opacity drags never refetch)");
must(/retire first: an axis switch or a removed overlay/.test(SRC), "X4 retire-first doctrine documented and ordered (clear before fetch)");
must(SRC.includes("data-overlay-terrain={o.path}") && SRC.includes("stroke={o.color}"), "X5 terrain rows are color-matched to the Layers swatch (stroke = entry color)");
must(!/role="slider"[^>]*data-overlay-terrain/.test(SRC) && /role="img"[\s\S]{0,200}data-overlay-terrain/.test(SRC), "X6 overlay terrains are read-only (role=img, the main strip keeps every interaction)");
must(/export stays the MAIN map's/.test(SRC) && !/buildProfileCsv\(\[\.\.\.profile/.test(SRC), "X7 the CSV export contract stays main-map (rows == the footer's bins count)");
must(SRC.includes('"op in s"') || SRC.includes("// \"op in s\""), "X8 a row removed mid-flight never resurrects (op-in guard)");

/* ============ D: the live loop ============ */
section("D: the overlay terrain, live");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

const profileCalls = [];
page.on("request", (r) => { if (r.url().includes("map-profile")) profileCalls.push(decodeURIComponent(r.url())); });

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
// DETERMINISTIC MAIN MAP: enlarge orthovol specifically — the first tile
// is whichever output sorts first, and t191's D13 lesson says the viewer
// happily opens a half-map as the main map (then "add half1 as overlay"
// is a nonsense ask — it already IS the main). The probe names its map.
const orthoTile = page.locator('button[aria-label="Enlarge orthovol"]');
if (await orthoTile.isVisible().catch(() => false)) {
  await orthoTile.click();
} else {
  await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
}
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
let viewerUp = false;
for (let k = 0; k < 30; k++) {
  await sleep(2000);
  if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { viewerUp = true; break; }
}
must(viewerUp, "D1 Mol* viewer live");

// the toolbar mounts after canvas3d — wait properly, don't count-race
await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});

// SELF-HEAL: overlay sessions PERSIST server-side and restore on reopen —
// a previous crashed run's adoption would break this run's assumptions
// (the qa67-seeder doctrine: the probe brings its own world state).
// Remove buttons live INSIDE the Layers popover — open it first, then count.
let healed = 0;
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
  healed++;
}
if (healed) console.log(`  (self-heal: removed ${healed} restored overlay${healed > 1 ? "s" : ""} from a previous session)`);
// t202 sync: UNCONDITIONAL Escape is a blind shell (the t196 doctrine,
// third front-wave instance) — the popover may have auto-closed a beat
// after the last removal, and the blind Escape then closes the VIEWER.
// Only fire when the popover is visible TWICE, 250ms apart.
const popUpT193 = async () => await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false);
if (await popUpT193()) { await sleep(250); if (await popUpT193()) await page.keyboard.press("Escape"); }
await sleep(600);

await page.locator('button[aria-label="Toggle cross-section plane"]').click();
let stripVisible = false;
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { stripVisible = true; break; }
}
must(stripVisible, "D2 main landscape strip rendered");
must((await page.locator("[data-overlay-terrain]").count()) === 0, "D3 no overlay terrain before any overlay exists");

// add half1 as overlay through the Layers panel
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
const halfBtn = page.locator('[data-testid^="map-choice-"][title*="half1"]');
const halfBtnVisible = await halfBtn.isVisible().catch(() => false);
must(halfBtnVisible, "D4 half1 offered in the Layers panel");
await halfBtn.click();
await sleep(3500);
let terrainRow = page.locator('[data-overlay-terrain][data-overlay-terrain*="half1"]');
let terrainUp = false;
for (let k = 0; k < 10; k++) {
  if (await terrainRow.isVisible().catch(() => false)) { terrainUp = true; break; }
  await sleep(1000);
}
must(terrainUp, "D5 overlay terrain line appeared after adoption");
// the stroke lives on the polyline child, not the svg root; the color dot
// beside it carries the same overlay color — read BOTH
const stroke = await terrainRow.locator("polyline").getAttribute("stroke").catch(() => null);
// the dot's color via computed style (style attr may render rgb(), not hex)
const dotColor = await page.evaluate(() => {
  const row = document.querySelector('[data-overlay-terrain*="half1"]')?.parentElement;
  const dot = row?.querySelector("span[style*='background']");
  return dot ? getComputedStyle(dot).backgroundColor : null;
});
const hex2rgb = (h) => {
  const m = h?.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  return m ? `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})` : null;
};
must(!!stroke && /^#[0-9a-fA-F]{6}$/.test(stroke), `D6 terrain line carries the overlay's own color (stroke=${stroke})`);
must(!!dotColor && dotColor === hex2rgb(stroke), `D7 the swatch dot and the line share one color (dot=${dotColor})`);
const ariaReadonly = (await terrainRow.getAttribute("role")) === "img";
must(ariaReadonly, "D8 terrain row is role=img (read-only instrument)");
const ariaLabel = (await terrainRow.getAttribute("aria-label")) ?? "";
must(ariaLabel.includes("along the Z axis"), `D9b terrain row speaks its axis (${ariaLabel.slice(0, 60)}...)`);

// axis switch: retires + refetches BOTH maps for the new axis
const callsBefore = profileCalls.length;
await page.locator('button[title="Slice perpendicular to the Y axis"]').click();
await sleep(3500);
const newAxisLabel = (await page.locator('[data-overlay-terrain*="half1"]').getAttribute("aria-label").catch(() => "")) ?? "";
must(newAxisLabel.includes("along the Y axis"), "D9 axis switch relabels the overlay terrain (retirement+refetch visible)");
const yCalls = profileCalls.slice(callsBefore).filter((u) => u.includes("axis=y"));
must(yCalls.length >= 2, `D10 the switch fetched the new axis for BOTH maps (${yCalls.length} axis=y calls: main + overlay)`);

// return to Z: cache feeds BOTH terrains (zero new calls)
const zBefore = profileCalls.length;
await page.locator('button[title="Slice perpendicular to the Z axis"]').click();
await sleep(2500);
const zCalls = profileCalls.slice(zBefore).filter((u) => u.includes("axis=z"));
const backLabel = (await page.locator('[data-overlay-terrain*="half1"]').getAttribute("aria-label").catch(() => "")) ?? "";
must(backLabel.includes("along the Z axis") && zCalls.length === 0, `D11 return to Z: cache feeds both terrains, zero new calls (${zCalls.length})`);

// the portrait: two terrains, one plane — main cyan + overlay color-matched
await page.screenshot({ path: `${OUT}/t193-overlay-terrain.png` }).catch(() => {});

// remove the overlay — the terrain line leaves with it
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
await page.locator('button[aria-label="Remove overlay run_it020_half1"]').click();
await sleep(1600);
must((await page.locator("[data-overlay-terrain]").count()) === 0, "D12 removing the overlay removes its terrain line");

await page.keyboard.press("Escape");
await sleep(600);

/* ============ Z: read-only ============ */
section("Z: read-only");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length, `Z1 roster identity (${roster0.length} == ${roster1.length})`);
must(consoleErrors.length === 0, `Z2 console clean (${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

console.log(`\nT193 RUN ${RUN}: ${pass} pass, ${fail} fail`);
if (fail) { console.log(fails.map((f) => "  ✗ " + f).join("\n")); process.exit(1); }
await browser.close();
