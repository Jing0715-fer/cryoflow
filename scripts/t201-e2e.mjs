/* t201 e2e — Mol*'s control affordances get their day in court: the
 * hover state's HOUR (t199 asserted the hover RULES exist; the live
 * hover was never interrogated — and the recon proved it was dead on
 * every visible stack button: Mol*'s !important caramel pair beat our
 * plain ink declarations, and the inline `background: transparent` plus
 * our always-on !important base kept the background at rest colour);
 * the keyboard's RING (:focus-visible — outlines were silenced, Tab
 * through the stack was invisible); and Reset Zoom UNBURIED (the app
 * toolbar's last button has always painted pixel-for-pixel over it —
 * a layout bug in BOTH rooms, so the layout fix is deliberately NOT
 * .dark-scoped while the hover/focus fixes are).
 *   S  setup — seeder, deterministic dark via the app's own switch
 *   X  source oracles — the t201 block exists; the layout rule is
 *      theme-agnostic BY SHAPE (no .dark prefix); hover/focus are
 *      .dark-scoped, carry the load-bearing !important, exclude the
 *      disabled, and drink token vars; the banner documents the
 *      evidence (the !important discipline: every exception lists what
 *      it overrides and why light never sees it); the structure-behaviors
 *      amputation keeps only the volume-relevant three behaviors and no
 *      monkey-patching remains
 *   D  live — raw mouse moves (CSS :hover only cares where the pointer
 *      IS) + the 1x1-canvas color parser (t192/t199's translator):
 *      Reset Zoom's centre hit-tests to ITSELF and clears the toolbar
 *      row in BOTH rooms; hover ink == --accent-foreground bytes and
 *      hover bg == --accent bytes (the caramel is dead); rest state
 *      returns to --secondary/--muted-foreground; the disabled button
 *      does NOT light up under a passing pointer; Tab into the stack
 *      matches :focus-visible with a solid 2px accent outline while a
 *      mouse click focuses QUIETLY; :active presses the chip (scale
 *      0.96); a deliberate canvas SWEEP + click then exercise the
 *      hover-picking guard; the light room gets Mol*'s native caramel
 *      hover back
 *   Z  read-only — roster identity, console clean WITH the sweep in the
 *      ledger (the guard's whole point)
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t201";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

const CSS = readFileSync("src/app/globals.css", "utf8");
const roster0 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];

/* ============ S: setup ============ */
section("S: the world");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");

/* ============ X: source oracles ============ */
section("X: the affordance block tells the truth");
const blockStart = CSS.indexOf("Mol* control affordances (t201)");
must(blockStart > 0, "X1 the t201 affordance block exists in globals.css");
const block = CSS.slice(blockStart);
const blockNoComments = block.replace(/\/\*[\s\S]*?\*\//g, "");
// the layout fix: theme-agnostic BY SHAPE — the selector must not wear
// the .dark prefix, because the burial happens in both rooms
const layoutRule = blockNoComments.match(/\.msp-plugin \.msp-viewport-controls\.msp-viewport-controls\s*\{[^}]*\}/);
must(!!layoutRule && !layoutRule[0].includes(".dark") && layoutRule[0].includes("top: 52px"), "X2 the unbury rule is theme-agnostic (no .dark scope) and sets top: 52px — the burial happens in BOTH rooms");
// hover: dark-scoped, !important on BOTH contested properties, disabled
// excluded, values are tokens not hex snapshots
const hoverRule = blockNoComments.match(/\.dark \.msp-plugin \.msp-viewport-controls-buttons button\[class\]:not\(\[disabled\]\):hover\s*\{[^}]*\}/);
must(!!hoverRule, "X3 the hover rule exists under the dark scope with :not([disabled])");
must(!!hoverRule && (hoverRule[0].match(/!important/g) || []).length === 2 && hoverRule[0].includes("color: var(--msp-accent) !important") && hoverRule[0].includes("background: var(--msp-btn-bg-hover) !important"), "X4 hover carries exactly TWO !important (ink + background — the only CSS that answers Mol*'s own !important caramel pair) and drinks token vars, not hex snapshots");
const focusRule = blockNoComments.match(/\.dark \.msp-plugin \.msp-viewport-controls-buttons button\[class\]:focus-visible\s*\{[^}]*\}/);
must(!!focusRule && focusRule[0].includes("outline: 2px solid var(--msp-accent) !important") && focusRule[0].includes("outline-offset"), "X5 the keyboard ring exists: :focus-visible, solid 2px accent outline, !important against the silencer");
const activeRule = blockNoComments.match(/:not\(\[disabled\]\):active\s*\{[^}]*\}/);
must(!!activeRule && activeRule[0].includes("transform: scale(0.96)"), "X6 pressed feedback exists (:active scale 0.96 — pure geometry, nothing contested)");
must(!/#(dc9c56|ae5d04|9c835f|eeece7|f3f2ee)/i.test(blockNoComments), "X7 zero hardcoded Mol* hex in the RULE BODIES — even the enemy's colours are quoted only in comments");
must((block.match(/!important/g) || []).length >= 5 && block.includes("load-bearing"), "X8 every !important is load-bearing and the banner documents what it answers (the exception discipline: exceptions get an explicit, scoped justification)");
// the structure-behaviors amputation: the throwing loci pipeline belongs
// to behaviors a volume map never needed — the spec keeps only camera
// controls, the axis helper and state snapshots, and no monkey-patching
// remains (the first draft guarded Loci.normalize alone; the throw moved
// downstream to isEmpty and setFromLoci — whack-a-mole is not a fix)
const TSX = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
const amputationStart = TSX.indexOf("The structure-behaviors amputation");
must(amputationStart > 0, "X9a the structure-behaviors amputation is documented at its seam");
const amputation = TSX.slice(amputationStart, amputationStart + 2400);
must(amputation.includes("PluginBehaviors.Camera.CameraAxisHelper") && amputation.includes("PluginBehaviors.Camera.CameraControls") && amputation.includes("PluginBehaviors.State.SnapshotControls"), "X9b the spec keeps the volume-relevant three (camera axis helper, camera controls, snapshot controls)");
must((TSX.match(/normalizeGuarded|LociModule\.normalize|normalizedLoci/g) || []).length === 0, "X9c no monkey-patching remains — the fix is configuration, not surgery (the withdrawn medicine's absence is asserted)");
must(TSX.includes("import(\"molstar/lib/mol-plugin/behavior\")"), "X9d the behavior namespace is imported for the allowlist comparison");

/* ============ D: the live audit ============ */
section("D: hover, focus, and the unburied button — live");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${m.text().slice(0, 160)} @ ${m.location()?.url?.split("/").pop() ?? "?"}:${m.location()?.lineNumber ?? "?"}`); });
page.on("pageerror", (e) => consoleErrors.push(String(e?.stack ?? e).slice(0, 300)));

// the 1x1 canvas is the only interpreter that speaks every CSS color
// syntax (lab/oklch/hex) and answers in sRGB bytes — t192's recipe
const toRgb = async (cssColor) => await page.evaluate((c) => {
  const cv = document.createElement("canvas");
  cv.width = 1; cv.height = 1;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
  return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
}, cssColor);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// raw pointer placement — page.hover() refuses when anything intercepts,
// but CSS :hover only cares WHERE the pointer is
const hoverAt = async (locator) => {
  const r = await locator.evaluate((el) => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(r.x, r.y);
  await sleep(320);
};
const away = async () => { await page.mouse.move(4, 900); await sleep(220); };

const openViewer = async () => {
  await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
  await sleep(1600);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const orthoTile = page.locator('button[aria-label="Enlarge orthovol"]');
  if (await orthoTile.isVisible().catch(() => false)) await orthoTile.click();
  else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
  await sleep(1100);
  await page.locator("button", { hasText: "View in 3D" }).click();
  for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) return true; }
  return false;
};
// the unbury assertions, runnable in both rooms
const assertUnburied = async (tag) => {
  const reset = page.locator('.msp-viewport-controls-buttons button[title="Reset Zoom"]');
  must(await reset.isVisible().catch(() => false), `D-${tag}1 Reset Zoom is VISIBLE in the stack`);
  // the hit test needs a short settle window: the viewer dialog's opening
  // transition leaves a transient overlay div on top for a beat (the
  // first run's D-dark2 caught that beat — hover worked, the geometry
  // was still settling). Retry until stable instead of sleeping blind.
  let geo = null;
  for (let k = 0; k < 12; k++) {
    geo = await reset.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      const chain = [];
      let cur = hit;
      while (cur && chain.length < 4) { chain.push(cur.tagName + "." + String(cur.className).slice(0, 26)); cur = cur.parentElement; }
      return { top: b.y, hitSelf: hit === el || el.contains(hit), hitTag: chain.join(" < ") };
    });
    if (geo.hitSelf) break;
    await sleep(500);
  }
  must(geo.hitSelf, `D-${tag}2 Reset Zoom's centre hit-tests to ITSELF (was: the app toolbar's bookmark button) — got ${geo.hitTag.slice(0, 90)}`);
  const bm = page.locator('button[aria-label*="Camera view bookmarks"]');
  const bmBox = await bm.boundingBox().catch(() => null);
  must(!!bmBox && geo.top >= bmBox.y + bmBox.height + 4, `D-${tag}3 the stack clears the toolbar row (Reset Zoom top ${Math.round(geo.top)} vs toolbar bottom ${Math.round(bmBox ? bmBox.y + bmBox.height : -1)})`);
};

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
// deterministic dark via the app's own switch (t192's lesson)
const lightBtn = page.locator('button[aria-label="Switch to light theme"]');
if (await lightBtn.isVisible().catch(() => false)) { await lightBtn.click(); await sleep(500); }
await page.locator('button[aria-label="Switch to dark theme"]').click();
await sleep(900);

must(await openViewer(), "D1 Mol* viewer live (dark room)");
await assertUnburied("dark");

const stack = page.locator(".msp-viewport-controls-buttons button[class]");
const accFgTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent-foreground").trim());
const accTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
const secTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--secondary").trim());
const dimTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground").trim());
const accFg = await toRgb(accFgTok), acc = await toRgb(accTok), sec = await toRgb(secTok), dim = await toRgb(dimTok);

// hover the unburied Reset Zoom (a toggle-ON button)
const reset = page.locator('.msp-viewport-controls-buttons button[title="Reset Zoom"]');
await hoverAt(reset);
let inkC = await reset.evaluate((el) => getComputedStyle(el).color);
let bgC = await reset.evaluate((el) => getComputedStyle(el).backgroundColor);
must(eq(await toRgb(inkC), accFg), `D2 hover ink == --accent-foreground bytes [${await toRgb(inkC)}] — Mol*'s !important caramel (#dc9c56) is dead`);
must(eq(await toRgb(bgC), acc), `D3 hover background == --accent bytes [${await toRgb(bgC)}] — the inline-transparent ceiling is answered`);
await away();
inkC = await reset.evaluate((el) => getComputedStyle(el).color);
bgC = await reset.evaluate((el) => getComputedStyle(el).backgroundColor);
must(eq(await toRgb(bgC), sec) && eq(await toRgb(inkC), dim), "D4 rest state returns: background == --secondary, ink == --muted-foreground");

// hover a toggle-OFF button (Screenshot) — the other caramel variant
const shot = page.locator('.msp-viewport-controls-buttons button[title^="Screenshot"]');
await hoverAt(shot);
inkC = await shot.evaluate((el) => getComputedStyle(el).color);
bgC = await shot.evaluate((el) => getComputedStyle(el).backgroundColor);
must(eq(await toRgb(inkC), accFg) && eq(await toRgb(bgC), acc), "D5 the toggle-OFF variant lights up too (both !important caramels answered)");
await away();

// the disabled button must NOT light up under a passing pointer
const vr = page.locator('.msp-viewport-controls-buttons button[title^="Augmented"]');
must(await vr.evaluate((el) => el.disabled), "D6a the VR button is genuinely disabled in this world");
await hoverAt(vr);
inkC = await vr.evaluate((el) => getComputedStyle(el).color);
const vrRgb = await toRgb(inkC);
must(!eq(vrRgb, accFg), `D6 the disabled button's ink stays dim under the pointer [${vrRgb}] — dead controls do not glow`);
await away();

// pressed feedback: hold the pointer down on Screenshot and read :active
await hoverAt(shot);
await page.mouse.down();
await sleep(220);
const tf = await shot.evaluate((el) => getComputedStyle(el).transform);
await page.mouse.up();
await away();
must(tf !== "none" && tf.includes("matrix") && /0\.96/.test(tf), `D7 :active presses the chip (transform ${tf})`);

// the keyboard's ring: walk Tab into the stack — honest keyboard path
await page.locator("body").click({ position: { x: 600, y: 500 } }).catch(() => {});
let ringFound = null;
for (let k = 0; k < 60 && !ringFound; k++) {
  await page.keyboard.press("Tab");
  await sleep(60);
  ringFound = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || !el.closest?.(".msp-viewport-controls-buttons")) return null;
    const s = getComputedStyle(el);
    return { fv: el.matches(":focus-visible"), os: s.outlineStyle, ow: s.outlineWidth, oc: s.outlineColor, label: el.getAttribute("title") ?? "?" };
  });
}
must(!!ringFound, "D8 Tab reaches the stack");
must(!!ringFound && ringFound.fv === true, `D9 the focused stack button matches :focus-visible (${ringFound?.label})`);
must(!!ringFound && ringFound.os === "solid" && parseFloat(ringFound.ow) >= 2 && eq(await toRgb(ringFound.oc), accFg), `D10 the ring is real: outline ${ringFound?.os} ${ringFound?.ow}, colour == --accent-foreground bytes (was: outline-style none)`);
// a mouse click must focus QUIETLY (the whole point of :focus-visible)
// — but the Tab walk left the input modality on KEYBOARD, and a scripted
// focus restore after the click would inherit it. Click the canvas first
// to hand the modality back to the mouse, THEN click the button.
await page.locator("canvas").first().click({ position: { x: 300, y: 300 } }).catch(() => {});
await sleep(300);
await reset.click();
await sleep(400);
const clickFv = await reset.evaluate((el) => el.matches(":focus-visible"));
must(clickFv === false, "D11 a mouse click focuses WITHOUT the ring — keyboard-only visibility");
await away();

// exercise the hover-picking guard: a deliberate sweep across the canvas
// (the recon's exact stimulus — 11 TypeErrors per sweep before the
// guard) and a canvas click (+2 more). Z2 then reads the LEDGER.
await page.mouse.move(1300, 300, { steps: 4 });
await page.mouse.move(200, 800, { steps: 24 });
await sleep(300);
await page.mouse.move(700, 400, { steps: 18 });
await page.mouse.click(420, 520);
await sleep(600);
await away();

await page.screenshot({ path: `${OUT}/t201-dark-hover-2x.png`, clip: { x: 1180, y: 100, width: 260, height: 420 } }).catch(() => {});

// LIGHT room — hover returns to Mol*'s native caramel, the ring stays
// silent (dark-scoped), but the UNBURY must hold here too (layout bug)
await page.keyboard.press("Escape");
await sleep(900);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Switch to light theme");
  b?.click();
});
await sleep(1000);
must(await openViewer(), "D12 Mol* viewer live (light room)");
await assertUnburied("light");
const shotL = page.locator('.msp-viewport-controls-buttons button[title^="Screenshot"]');
await hoverAt(shotL);
const inkL = await shotL.evaluate((el) => getComputedStyle(el).color);
const bgL = await shotL.evaluate((el) => getComputedStyle(el).backgroundColor);
const inkLRgb = await toRgb(inkL);
const nativeCaramel = eq(inkLRgb, [220, 156, 86]) || eq(inkLRgb, [174, 93, 4]);
must(nativeCaramel && !eq(inkLRgb, accFg), `D13 light room: hover ink is Mol*'s native caramel [${inkLRgb}], NOT the app token — the dark scope held`);
must(bgL.endsWith("0, 0, 0, 0)"), `D14 light room: hover background stays transparent (${bgL})`);
// and the keyboard ring stays dark-only
await page.locator("body").click({ position: { x: 600, y: 500 } }).catch(() => {});
let ringL = null;
for (let k = 0; k < 60 && !ringL; k++) {
  await page.keyboard.press("Tab");
  await sleep(60);
  ringL = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || !el.closest?.(".msp-viewport-controls-buttons")) return null;
    return { fv: el.matches(":focus-visible"), os: getComputedStyle(el).outlineStyle };
  });
}
must(!!ringL && ringL.fv === true && ringL.os !== "solid", `D15 light room: keyboard focus matches :focus-visible but Mol*'s native (silenced) outline remains — the ring is a dark-room gift only`);

/* ============ Z: read-only ============ */
section("Z: the world unchanged");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length, `Z1 roster identity (${roster1.length} jobs)`);
must(consoleErrors.length === 0, `Z2 console clean (${consoleErrors.length} errors)`);
if (consoleErrors.length) console.error(consoleErrors.slice(0, 5));

await browser.close();
console.log(`\nT201 RUN ${RUN}: ${pass} pass, ${fail} fail`);
if (fail) { console.error(fails.map((f) => "  - " + f).join("\n")); process.exit(1); }
