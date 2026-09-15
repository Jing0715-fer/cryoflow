/* t204 e2e — the territory opens its own DOOR. t198 named the address
 * (chip), t202 gave the chip a door, t203 drew the territory on the
 * landscape; t204 makes the PAINT itself the door: pressing a bracket
 * lands the plane on the band's CENTRE (the chip's own jump, the chip's
 * own receipt), never the clicked x — a door is pressed, not scrubbed,
 * so stopPropagation keeps t190's scrub from firing. The paint keeps
 * the reading loop (hover brightens the resting bracket) and keeps the
 * keyboard honest (the layer stays aria-hidden and unfocusable; the
 * chip remains the keyboard's door).
 *   S  setup — seeder, orthovol + BOTH half-maps (t203's world)
 *   W  wire — the probe's own band oracle + the CENTRE math
 *   X  source oracles — the door speaks the chip's dialect (same centre
 *      algorithm, same receipt), the scrub father survives, the layer
 *      stays aria-hidden, the hover promise is in the class list
 *   D  live — a pointer press at a NON-centre x still lands on the
 *      centre (the door wins over the scrub, in the same frame); the
 *      receipt is byte-exact; visiting follows the door; the resting
 *      bracket answers hover (0.3 -> 0.85 -> 0.3); no tab order; the
 *      keyboard door survives
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t204";
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
const H = { "sec-fetch-site": "same-origin" };
const QUARTERS = ["Q1 (0–25%)", "Q2 (25–50%)", "Q3 (50–75%)", "Q4 (75–100%)"];

/* ============ S: setup ============ */
section("S: the world");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");
const outs = JSON.stringify(await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`)).json());
must(outs.includes("orthovol.mrc") && outs.includes("run_it020_half1.mrc") && outs.includes("run_it020_half2.mrc"), "S2 orthovol + BOTH half-maps in outputs");

/* ============ W: the wire feeds the band oracle + the centre math ============ */
section("W: bands and centres on the wire");
const prof = async (p) => (await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent(p)}&axis=z`, { headers: H })).json());
const mainW = await prof("orthovol.mrc");
const half1W = await prof("run_it020_half1.mrc");
const half2W = await prof("run_it020_half2.mrc");
must(mainW?.bins?.length > 0 && half1W?.bins?.length > 0 && half2W?.bins?.length > 0, `W1 all three profiles valid (main ${mainW?.bins?.length}, half1 ${half1W?.bins?.length}, half2 ${half2W?.bins?.length} bins)`);
const resample = (bins, n) => {
  if (bins.length <= 1) return Array(n).fill(bins[0] ?? 0);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / Math.max(1, n - 1)) * (bins.length - 1);
    const lo = Math.floor(t), hi = Math.min(bins.length - 1, lo + 1);
    return bins[lo] + (bins[hi] - bins[lo]) * (t - lo);
  });
};
const pearson = (a, b) => {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; cov += da * db; va += da * da; vb += db * db; }
  return va === 0 || vb === 0 ? NaN : cov / Math.sqrt(va * vb);
};
// the SAME cut the lib drew, with the band index kept for the vocabulary
const weakestOf = (mainBins, oBins) => {
  const n = Math.max(mainBins.length, oBins.length);
  if (n < 4) return null;
  const a = resample(mainBins, n), b = resample(oBins, n);
  let w = null;
  for (let k = 0; k < 4; k++) {
    const lo = Math.floor((k * n) / 4), hi = Math.floor(((k + 1) * n) / 4);
    const r = pearson(a.slice(lo, hi), b.slice(lo, hi));
    if (!Number.isFinite(r)) continue;
    if (!w || r < w.r) w = { r, from: lo / n, to: hi / n, k };
  }
  return w;
};
const w1 = weakestOf(mainW.bins, half1W.bins);
const w2 = weakestOf(mainW.bins, half2W.bins);
must(!!w1 && !!w2 && w1.k === 2 && w2.k === 0, `W2 the oracle's addresses match history (half1 Q${w1.k + 1} r ${w1.r.toFixed(2)}, half2 Q${w2.k + 1} r ${w2.r.toFixed(2)})`);
// the CENTRE math: the chip's own algorithm, replayed by the probe
const centreOf = (w) => Math.round(((w.from + w.to) / 2) * 100) / 100;
const c1 = centreOf(w1), c2 = centreOf(w2);
const geo = (w) => ({ x: (w.from * 100).toFixed(2), width: ((w.to - w.from) * 100).toFixed(2) });
const g1 = geo(w1), g2 = geo(w2);
console.log(`  (oracle: half1 x=${g1.x} w=${g1.width} centre=${c1} ${QUARTERS[w1.k]}; half2 x=${g2.x} w=${g2.width} centre=${c2} ${QUARTERS[w2.k]})`);

/* ============ X: source oracles ============ */
section("X: the source keeps its promises");
must(/className="cursor-pointer transition-opacity duration-150 hover:opacity-85"/.test(SRC) && /onPointerDown=\{\(e\) => \{/.test(SRC), "X1 the bracket wears the door's affordances (cursor, hover transition) and carries a pointer handler");
must(/e\.stopPropagation\(\);\s*\n\s*applySliceIntent\(\{ pos: centre \}\);/.test(SRC), "X2 the door stops the scrub AND rides the ONE intent event (applySliceIntent) — never a private channel");
// the centre algorithm and the receipt: TWICE in the file — the chip's
// door (t202) and the bracket's door (t204) speak the same dialect
const centreCount = (SRC.match(/Math\.round\(\(\(w\.from \+ w\.to\) \/ 2\) \* 100\) \/ 100/g) || []).length;
const receiptCount = (SRC.match(/Plane moved to \$\{Math\.round\(centre \* 100\)\}% — the centre of \$\{o\.name\}'s weakest quarter \(\$\{w\.label\}\)/g) || []).length;
must(centreCount === 2, `X3 the centre algorithm appears exactly ${centreCount} times (chip + bracket — one dialect, no fork)`);
must(receiptCount === 2, `X4 the receipt template appears exactly ${receiptCount} times (both doors speak the same sentence)`);
must(/<g aria-hidden="true">\{bandBrackets\}<\/g>/.test(SRC), "X5 the bracket layer stays aria-hidden — the door answers only the hand, the chip keeps the keyboard");
must(/data-band-bracket=\{o\.name\}/.test(SRC) && /data-band-visiting=\{visiting \? "1" : "0"\}/.test(SRC), "X6 the territory's own attributes survived the door (t203's oracle intact)");
must(/onPointerDown=\{onLandscapePointerDown\}/.test(SRC), "X7 t190's scrub father still answers the strip — the door is an exception, not a coup");

/* ============ D: live ============ */
section("D: the door, live");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
// deterministic DARK via the app's own switch (t192's door)
const darkBtn = page.locator('button[aria-label="Switch to dark theme"]');
if (await darkBtn.isVisible().catch(() => false)) { await darkBtn.click(); await sleep(900); }
must(await page.evaluate(() => document.documentElement.classList.contains("dark")), "D0 the dark room is on (the app's own switch)");
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
const orthoTile = page.locator('button[aria-label="Enlarge orthovol"]');
if (await orthoTile.isVisible().catch(() => false)) await orthoTile.click();
else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
let viewerUp = false;
for (let k = 0; k < 30; k++) {
  await sleep(2000);
  if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { viewerUp = true; break; }
}
must(viewerUp, "D1 Mol* viewer live");

await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
// the stability gate (t202's medicine): only Escape when the popover is
// visible TWICE, 250ms apart
const popUp = async () => await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false);
if (await popUp()) { await sleep(250); if (await popUp()) await page.keyboard.press("Escape"); }
await sleep(600);
must((await page.locator('div[data-local-row="1"]').count()) === 0, "D2 self-healed world: NO local row before any adoption");
// the dialog stack can shift under the self-heal — diagnose and re-open
if ((await page.locator('button[aria-label="Toggle cross-section plane"]').count()) === 0) {
  for (let k = 0; k < 3; k++) {
    if (!(await page.locator('[data-slot="dialog-overlay"][data-state="open"]').first().isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    await sleep(900);
  }
  await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
  await sleep(1600);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const ot = page.locator('button[aria-label="Enlarge orthovol"]');
  if (await ot.isVisible().catch(() => false)) await ot.click();
  await sleep(1000);
  await page.locator("button", { hasText: "View in 3D" }).click();
  let v2 = false;
  for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { v2 = true; break; } }
  must(v2, "D2b viewer re-opened after the world shifted");
  await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
}

await page.locator('button[aria-label="Toggle cross-section plane"]').click();
let stripVisible = false;
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { stripVisible = true; break; }
}
must(stripVisible, "D3 main landscape strip rendered");
const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');

// adopt half1
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
const half1Btn = page.locator('[data-testid^="map-choice-"][title*="half1"]');
if (!(await half1Btn.isVisible().catch(() => false))) {
  await page.locator('button[aria-label^="Overlay maps"]').click();
  await sleep(1100);
}
await half1Btn.click();
await sleep(3500);
const br1 = page.locator('[data-band-bracket="run_it020_half1"]');
let b1Up = false;
for (let k = 0; k < 10; k++) {
  if (await br1.isVisible().catch(() => false)) { b1Up = true; break; }
  await sleep(1000);
}
const b1x = await br1.getAttribute("x").catch(() => null);
const b1w = await br1.getAttribute("width").catch(() => null);
must(b1Up && b1x === g1.x && b1w === g1.width, `D4 half1's territory == the wire oracle (x=${b1x} w=${b1w}, expect x=${g1.x} w=${g1.width})`);

// adopt half2
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
const half2Btn = page.locator('[data-testid^="map-choice-"][title*="half2"]');
if (!(await half2Btn.isVisible().catch(() => false))) {
  await page.locator('button[aria-label^="Overlay maps"]').click();
  await sleep(1100);
}
await half2Btn.click();
await sleep(3500);
const br2 = page.locator('[data-band-bracket="run_it020_half2"]');
let b2Up = false;
for (let k = 0; k < 10; k++) {
  if (await br2.isVisible().catch(() => false)) { b2Up = true; break; }
  await sleep(1000);
}
const b2x = await br2.getAttribute("x").catch(() => null);
const b2w = await br2.getAttribute("width").catch(() => null);
must(b2Up && b2x === g2.x && b2w === g2.width, `D5 half2's territory == the wire oracle (x=${b2x} w=${b2w}, expect x=${g2.x} w=${g2.width})`);

// pre-state: Home -> 0% (inside half2's Q1, outside half1's Q3)
await strip.focus(); await sleep(300);
await strip.press("Home"); await sleep(700);
must(Number(await strip.getAttribute("aria-valuenow")) === 0, "D6 pre-state: Home put the plane at 0%");

// THE DOOR (half2): press the bracket at a NON-centre x (15% into the
// rect). If the scrub ate the door the plane would land near the clicked
// x (~4%); the door lands on the CENTRE (13%) — same frame, one press.
const pressBracket = async (br, fracX) => {
  const box = await br.boundingBox();
  if (!box) return null;
  await page.mouse.move(box.x + box.width * fracX, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
};
const clickedFrac = 0.15;
await pressBracket(br2, clickedFrac);
// t208's receipt armor backfitted (RUN sighting: the receipt's ~4s life
// can be swallowed whole by a frozen main thread — all fast polls miss
// it). The DOOR is idempotent: re-pressing the same x re-lands the same
// centre and re-flashes the note — a missed receipt earns a bounded
// re-press, not a failure (t195's bounded-click-retries doctrine).
let doorNow = 0, receipt2 = "";
for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt > 0) await pressBracket(br2, clickedFrac);
  for (let k = 0; k < 10; k++) {
    await sleep(400);
    doorNow = Number(await strip.getAttribute("aria-valuenow"));
    const st = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="status"]')).map((n) => ({
        label: n.getAttribute("aria-label"),
        text: (n.textContent ?? "").slice(0, 140),
      }))
    );
    receipt2 = st.find((s) => s.label === "Profile export status")?.text ?? "";
    if (receipt2.length > 0) break;
  }
  if (receipt2.length > 0) break;
}
const want2 = Math.round(c2 * 100);
const scrubGuess = Math.round((w2.from + (w2.to - w2.from) * clickedFrac) * 100);
must(doorNow === want2, `D7 THE DOOR: a press at ${Math.round(clickedFrac * 100)}% into half2's bracket lands the plane on the CENTRE (${doorNow}% == ${want2}%), NOT the clicked x (~${scrubGuess}%) — the paint is the door, the scrub stays out`);
must(receipt2 === `Plane moved to ${want2}% — the centre of run_it020_half2's weakest quarter (${QUARTERS[w2.k]})`, `D8 the receipt names the door (${receipt2.slice(0, 80)})`);

// visiting follows the door: the plane now sits INSIDE half2's territory
const v1Door = await br1.getAttribute("data-band-visiting");
const v2Door = await br2.getAttribute("data-band-visiting");
must(v2Door === "1" && v1Door === "0", `D9 visiting follows the door: half2 brightens (v=${v2Door}), half1 rests (v=${v1Door})`);

// THE DOOR (half1): End -> 100%, press half1's bracket near its RIGHT
// edge (85% into the rect — clicked x ~71%, the door says 63%)
await strip.focus(); await sleep(200);
await strip.press("End"); await sleep(700);
const clickedFrac1 = 0.85;
await pressBracket(br1, clickedFrac1);
// the same receipt armor as D7/D8 (bounded re-press on a missed note)
let door1Now = 0, receipt1 = "";
for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt > 0) await pressBracket(br1, clickedFrac1);
  for (let k = 0; k < 10; k++) {
    await sleep(400);
    door1Now = Number(await strip.getAttribute("aria-valuenow"));
    const st = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="status"]')).map((n) => ({
        label: n.getAttribute("aria-label"),
        text: (n.textContent ?? "").slice(0, 140),
      }))
    );
    receipt1 = st.find((s) => s.label === "Profile export status")?.text ?? "";
    if (receipt1.length > 0) break;
  }
  if (receipt1.length > 0) break;
}
const want1 = Math.round(c1 * 100);
const scrubGuess1 = Math.round((w1.from + (w1.to - w1.from) * clickedFrac1) * 100);
must(door1Now === want1, `D10 the second door: a press at ${Math.round(clickedFrac1 * 100)}% into half1's bracket lands on ${door1Now}% (centre ${want1}%), not ~${scrubGuess1}% — the door is not a disguised scrub`);
must(receipt1 === `Plane moved to ${want1}% — the centre of run_it020_half1's weakest quarter (${QUARTERS[w1.k]})`, `D11 the receipt names the second door (${receipt1.slice(0, 80)})`);

// HOVER on a RESTING bracket: Home -> 0% puts half1's bracket at rest
// (opacity 0.3); hovering it answers with 0.85; leaving returns 0.3.
// BUT the hand itself carries state: D10's press left the pointer ON
// half1's bracket, so the hover class is still lit — move the hand away
// FIRST, or the rest reading is polluted by the observer's own finger
// (the t201 input-modality lesson, hand edition).
await page.mouse.move(10, 10); await sleep(450);
await strip.focus(); await sleep(200);
await strip.press("Home"); await sleep(700);
await page.mouse.move(10, 10);
// the visiting flip is a RE-RENDER, not a keystroke receipt (t200's
// lesson: persistence lands on the wire, arrival lands in the paint) —
// poll until the bracket actually rests, never trust a blind sleep
let restOp = "", restV = "";
for (let k = 0; k < 12; k++) {
  await sleep(300);
  restV = await br1.getAttribute("data-band-visiting");
  restOp = await br1.evaluate((el) => getComputedStyle(el).opacity);
  if (restV === "0" && restOp === "0.3") break;
}
await br1.hover();
let hoverOp = "";
for (let k = 0; k < 8; k++) {
  await sleep(200);
  hoverOp = await br1.evaluate((el) => getComputedStyle(el).opacity);
  if (hoverOp === "0.85") break;
}
await page.mouse.move(10, 10);
let leaveOp = "";
for (let k = 0; k < 8; k++) {
  await sleep(200);
  leaveOp = await br1.evaluate((el) => getComputedStyle(el).opacity);
  if (leaveOp === "0.3") break;
}
must(restOp === "0.3" && hoverOp === "0.85" && leaveOp === "0.3", `D12 the paint answers the hand: rest ${restOp} -> hover ${hoverOp} -> leave ${leaveOp} (the reading loop on the resting territory)`);

// the door stays OUT of the keyboard: aria-hidden layer, no tabindex,
// focus never lands on a bracket
const tabProbe = await page.evaluate(() => {
  const g = document.querySelector('g[aria-hidden="true"]');
  const rects = g ? Array.from(g.querySelectorAll("rect")) : [];
  return {
    gHidden: g?.getAttribute("aria-hidden") === "true",
    rectTags: rects.every((r) => r.tagName.toLowerCase() === "rect"),
    tabindexes: rects.map((r) => r.getAttribute("tabindex")),
  };
});
must(tabProbe.gHidden && tabProbe.rectTags && tabProbe.tabindexes.every((t) => t === null), `D13 the door is hand-only: aria-hidden g holds plain rects, zero tabindex [${tabProbe.tabindexes.join(",")}]`);

// the KEYBOARD door survives: focus half1's chip, Enter — the plane
// obeys the chip's address (63%) as before
await strip.focus(); await sleep(200);
await strip.press("End"); await sleep(700);
const chip1 = page.locator('[data-local-chip="run_it020_half1"]');
await chip1.focus(); await sleep(200);
await chip1.press("Enter"); await sleep(700);
const kbNow = Number(await strip.getAttribute("aria-valuenow"));
must(kbNow === want1, `D14 the keyboard door survives: Enter on the chip lands ${kbNow}% (== ${want1}) — the bracket's door ate nothing`);

await page.screenshot({ path: `${OUT}/t204-door-2x.png` }).catch(() => {});
await page.screenshot({ path: `${OUT}/t204-viewer-2x.png`, fullPage: false }).catch(() => {});

/* ============ Z: read-only ============ */
section("Z: the world read back");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
// the CANONICAL number is whatever the restored gallery shipped this
// round (restore-gallery.py rebuilt the sandbox at 21 — the previous
// 26 carried five orphan jobs the filesystem snapshot lost); the IRON
// part is identity WITHIN the round: nothing spawned, nothing vanished
must(roster1.length === roster0.length, `Z1 roster identity within the round (${roster0.length} -> ${roster1.length}, restored baseline)`);
const r1names = roster1.map((j) => j.name).sort().join("|");
const r0names = roster0.map((j) => j.name).sort().join("|");
must(r1names === r0names, "Z2 roster identity by name — nothing stayed behind");
await browser.close();
must(consoleErrors.length === 0, `Z3 console clean (${consoleErrors.length} errors${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}${fails.length ? "\n  - " + fails.join("\n  - ") : ""}`);
process.exit(fail === 0 ? 0 : 1);
