// qa69 — Task 68: input-modality reveal fix (hover-gated controls on
// touch / (hover:none) devices) + FSC compare freshness strip.
//
// Root cause being closed: Tailwind v4 gates EVERY hover: variant behind
// @media (hover:hover). The headless QA browser (and every real touch
// device) reports hover:none — so "hidden until hover" FUNCTIONAL controls
// (ortho ⌖, gallery zoom, file download, row action groups) were forever
// invisible there. Fix: @custom-variant hover-none + hover-none:opacity-100
// on functional controls (decorative labels stay hover-only on purpose).
//
// Phase A (filesystem): compiled CSS carries the media-gated rule; the 7
//   functional sources opt in; the 5 decorative overlays deliberately don't.
// Phase B (live, in the hover:none browser): the ortho crosshair is
//   VISIBLE at rest (opacity 1 — the Task 67 leftover symptom was opacity
//   0 here) and still drives the 3D cross-section; the file Download
//   button is visible in the Files tab; one Esc peels one layer.
// Phase C: the compare dialog's freshness strip — idle "N curves indexed"
//   + labeled Scan button; picking the running job flips it teal with the
//   autolive notice inside (12 s cadence, qa64 contract intact).
//
// Task 91 — MIGRATED agent-browser CLI → playwright (qa70 pilot, qa66
// follow-up): assertion set byte-identical, only the driver changed. The
// scroll-aware CDP click helper (Radix scroll-lock reverts scrollTop
// writes) collapses into locator.click() — playwright auto-scrolls the
// target into view through scroll-locked ancestors. Esc presses are real
// trusted key events.
//
// Run: node scripts/qa69-e2e.mjs   (server on :3000, qa58+qa60+qa67 seeded)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

const B = "http://localhost:3000";
// Task 85: DB resets stranded this anchor — resolve the living project at
// runtime (env override keeps the old escape hatch)
const PROJECT = process.env.QA_PROJECT
  ?? (await (await fetch(`${B}/api/projects`)).json()).projects[0].id;
const CARD2D = "QA Class2D Source";
const HOST_JOB = "QA Post 320";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let PASS = 0;
const must = (cond, label) => {
  if (!cond) { console.log(`FATAL: ${label}`); cleanup().then(() => process.exit(1)); return; }
  PASS++;
  console.log(`  ok: ${label}`);
};
let b = null;
async function cleanup() {
  try { if (b) await b.close(); } catch {}
}

// ---- job ids via prisma (base64 script — quoting hell immunity) -----------
function nodeRun(script, ...args) {
  const b64 = Buffer.from(script).toString("base64");
  return execSync(
    `node -e 'eval(Buffer.from("${b64}","base64").toString())' ${args.map((a) => `'${a}'`).join(" ")}`,
    { encoding: "utf8", timeout: 60_000 }
  ).trim();
}
const ids = JSON.parse(nodeRun(`
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.job.findMany({ where: { projectId: process.argv[1] }, select: { id: true, name: true } })
  .then(js => { console.log(JSON.stringify(Object.fromEntries(js.map(j => [j.name, j.id])))); return p.$disconnect(); })
  .catch(e => { console.error(e.message); process.exit(1); });
`, PROJECT));
const LIVE_ID = ids["QA Refine Live"];
const HOST_ID = ids[HOST_JOB];
const SRC_ID = ids[CARD2D];
if (!LIVE_ID || !HOST_ID || !SRC_ID) { console.log("FATAL: seed jobs missing"); process.exit(1); }

// ===========================================================================
console.log("— PHASE A: compiled + source contract —");

const cssAll = readdirSync(".next/static/chunks")
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(`.next/static/chunks/${f}`, "utf8"))
  .join("\n");
must(cssAll.includes("@media (hover:none){.hover-none\\:opacity-100{opacity:1}}"),
  "compiled CSS: @media (hover:none) gates the reveal utility");

const FUNC = [
  "src/components/workflow/results/map-ortho-panel.tsx",
  "src/components/workflow/job-inspector.tsx",
  "src/components/workflow/class-gallery.tsx",
  "src/components/workflow/project-panel.tsx",
  "src/components/workflow/project-dashboard.tsx",
  "src/components/workflow/workspace-panel.tsx",
  "src/components/ui/sidebar.tsx",
];
for (const f of FUNC) {
  must(readFileSync(f, "utf8").includes("hover-none:opacity-100"),
    `functional control opts in: ${f.split("/").pop()}`);
}
const DECO = [
  "src/components/workflow/results/picks-map.tsx",
  "src/components/workflow/results/ctf-quality-chart.tsx",
  "src/components/workflow/results/particle-browser.tsx",
  "src/components/workflow/results/import-gallery.tsx",
  "src/components/workflow/results/results-view.tsx",
];
for (const f of DECO) {
  must(!readFileSync(f, "utf8").includes("hover-none:opacity-100"),
    `decorative label stays hover-only: ${f.split("/").pop()}`);
}
must(readFileSync("src/components/workflow/results/map-ortho-panel.tsx", "utf8")
  .includes("group-focus-within/tile:opacity-100"),
  "ortho crosshair reveals on keyboard focus inside the tile too");

console.log(`PHASE A GREEN (${PASS} asserts)`);

// ===========================================================================
console.log("— PHASE B: live reveal in the hover:none browser —");

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
// hasTouch flips the media environment to (hover: none) — the suite's
// premise IS the hover:none browser (agent-browser's old headless reported
// hover:none; playwright's desktop-default reports hover:hover, which
// would silently verify nothing). Touch without isMobile keeps the
// 1600×900 desktop layout.
b = await chromium.launch();
const touchCtx = await b.newContext({ viewport: { width: 1600, height: 900 }, hasTouch: true });
const p = await touchCtx.newPage();
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
p.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 160)));

await p.goto(B, { waitUntil: "networkidle" });
await sleep(1200);
// forget persisted compare picks — each phase drives its own (qa64 parity)
await p.evaluate((k) => localStorage.removeItem(k), `cryoflow.fsc-compare:${PROJECT}`);

let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  const probe = await p.evaluate((card2d) => {
    const card = [...document.querySelectorAll("[role=button]")].find((x) => (x.textContent || "").includes(card2d));
    const dash = !!document.querySelector("h1") && (document.querySelector("h1").textContent || "").includes("Dashboard");
    return (card ? "CARD" : "NOCARD") + (dash ? "+DASH" : "");
  }, CARD2D);
  if (probe.includes("CARD")) onCanvas = true;
  else if (probe.includes("DASH")) {
    await p.keyboard.press("Shift+D");
    await sleep(2200);
  } else await sleep(2000);
}
must(onCanvas, "canvas renders with the class2d job card");

let inResults = false;
for (let i = 0; i < 6 && !inResults; i++) {
  await p.locator('[role="button"]', { hasText: CARD2D }).first().click();
  await sleep(1800);
  await p.locator('[role="tab"]', { hasText: /^Results$/ }).first().click();
  await sleep(1200);
  inResults = await p.evaluate(() => !!document.querySelector('section[aria-label="Maps and images"]'));
  if (!inResults) await sleep(1500);
}
must(inResults, "inspector opens on the Results tab");

for (let i = 0; i < 5; i++) {
  await p.locator('button[aria-label^="Enlarge"][aria-label*="orthovol"]').first().click();
  await sleep(1400);
  if (await p.evaluate(() => [...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes("View in 3D")))) break;
  await sleep(800);
}
for (let i = 0; i < 5; i++) {
  await p.locator("button", { hasText: "View in 3D" }).first().click();
  await sleep(1500);
  if (await p.evaluate(() => !!document.querySelector("[data-canvas-ui=ortho-panel]"))) break;
}
let viewerOpen = false;
for (let i = 0; i < 10 && !viewerOpen; i++) {
  viewerOpen = await p.evaluate(() => !!document.querySelector("[data-canvas-ui=ortho-panel]"));
  if (!viewerOpen) await sleep(2000);
}
must(viewerOpen, "Mol* dialog opens with the orthogonal slice strip");

await p.locator('[data-canvas-ui="ortho-panel"] button[aria-expanded]').first().click();
let tiles = 0;
for (let i = 0; i < 6 && tiles < 3; i++) {
  tiles = await p.evaluate(() => document.querySelectorAll("[data-canvas-ui^=ortho-tile] img").length);
  if (tiles < 3) await sleep(1200);
}
must(tiles === 3, `strip expands to three plane tiles (${tiles})`);

// THE fix: at rest, with no pointer in sight, the crosshair is visible.
// In this env (hover:hover does NOT match) Task 67 measured opacity 0.
const xhOpacity = await p.evaluate(() => {
  const el = document.querySelector('[data-canvas-ui=ortho-tile-z] button[aria-label^="Show the XY plane"]');
  return el ? getComputedStyle(el).opacity : "NOBTN";
});
must(xhOpacity === "1", `crosshair visible at rest in hover:none env (opacity=${xhOpacity})`);

// functionality intact: ⌖ still mirrors the plane into the 3D scene
await p.locator('[data-canvas-ui="ortho-tile-z"] button[aria-label^="Show the XY plane"]').first().click();
await sleep(1200);
let slice3d = "";
for (let i = 0; i < 8 && !slice3d.startsWith("OK"); i++) {
  slice3d = await p.evaluate(() => {
    const t = [...document.querySelectorAll('button[aria-label="Toggle cross-section plane"]')].pop();
    const s = document.querySelector('[role=slider][aria-label^="Cross-section plane position"]');
    if (!t) return "NO-TOGGLE";
    if (!s) return "NO-SLIDER";
    return "OK pressed=" + t.getAttribute("aria-pressed");
  });
  if (!slice3d.startsWith("OK")) await sleep(1200);
}
must(slice3d.startsWith("OK") && slice3d.includes("true"),
  `crosshair still lights the 3D cross-section (got ${slice3d})`);

// one Esc peels only the viewer (Task 66's global-Esc guard holds)
await p.keyboard.press("Escape");
await sleep(900);
const layer1 = await p.evaluate(() => {
  const ortho = !!document.querySelector("[data-canvas-ui=ortho-panel]");
  const insp = !!document.querySelector("[role=dialog]");
  return (ortho ? "ORTHO " : "no-ortho ") + (insp ? "INSP" : "no-insp");
});
must(layer1.trim() === "no-ortho INSP", `Esc peels only the viewer (got ${layer1})`);

// Files tab: the row Download button is visible at rest too.
// The trigger's textContent carries the file-count badge ("Files5") —
// match by prefix and stay scoped to the dialog (the canvas aside has
// its own [role=tab]s).
let filesTab = false;
for (let i = 0; i < 5 && !filesTab; i++) {
  await p.locator('[role="dialog"] [role="tab"]').filter({ hasText: /^Files/ }).first().click();
  await sleep(1200);
  filesTab = await p.evaluate(() => !!document.querySelector("[role=dialog] table"));
}
must(filesTab, "Files tab opens the output file table");
let dlOpacity = "";
for (let i = 0; i < 6 && dlOpacity !== "1"; i++) {
  dlOpacity = await p.evaluate(() => {
    const el = [...document.querySelectorAll('[role=dialog] button[aria-label^="Download"]')][0];
    if (!el) return "NOBTN";
    return String(getComputedStyle(el).opacity);
  });
  if (dlOpacity !== "1") await sleep(900); // outputs fetch + table render
}
must(dlOpacity === "1", `Download visible in hover:none env (opacity=${dlOpacity})`);

must(consoleErrors.length === 0, `zero page errors in Phase B (got ${JSON.stringify(consoleErrors)})`);
console.log(`PHASE B GREEN (${PASS} asserts)`);

// ===========================================================================
console.log("— PHASE C: compare dialog freshness strip —");

// leave the class2d inspector, open the host postprocess instead
await p.keyboard.press("Escape");
await sleep(900);
const backToCanvas = await p.evaluate(() => !document.querySelector("[role=dialog]"));
must(backToCanvas, "second Esc peels the inspector back to the canvas");

let modal = false;
for (let i = 0; i < 5 && !modal; i++) {
  await p.locator('[role="button"]', { hasText: HOST_JOB }).first().click();
  await sleep(1500);
  modal = await p.evaluate((host) => {
    const dl = [...document.querySelectorAll("[role=dialog]")].find((d) => (d.textContent || "").includes(host));
    return !!dl;
  }, HOST_JOB);
  if (!modal) await sleep(1500);
}
must(modal, "inspector modal opens for the host postprocess job");

// JobInspector is mounted ONCE for the whole app (page.tsx) and its tab
// latch (tabTouchedRef) survives close/reopen — Phase B left it on Files,
// and the "never stomp a manual tab choice" guard is doing its job. A real
// user would click Results; so does the harness.
for (let i = 0; i < 5; i++) {
  const hasCompare = await p.evaluate(() =>
    [...document.querySelectorAll("[role=dialog] button")].some(
      (el) => (el.getAttribute("aria-label") || "").includes("compare") || (el.title || "").includes("compare")
    ));
  if (hasCompare) break;
  await p.locator('[role="dialog"] [role="tab"]').filter({ hasText: /^Results/ }).first().click();
  await sleep(1400);
}

// expected row count is DATA-DRIVEN (Task 85): restore-gallery seeds six
// FSC-bearing jobs into the living instance (qa60's four + the qa50/51-
// foddered skeleton pair), and future fodder growth should widen the
// dialog, not break this suite — read the index, assert the dialog agrees
const WANT_ROWS = await fetch(`${B}/api/projects/${PROJECT}/fsc-index`)
  .then((r) => r.json()).then((d) => (d.jobs ?? []).length)
  .catch(() => 0);
must(WANT_ROWS >= 5, `fsc-index reachable for row expectation (got ${WANT_ROWS})`);
let dialog = false;
const attempts = [];
for (let i = 0; i < 5 && !dialog; i++) {
  await p.locator('[role="dialog"] button[aria-label*="compare"], [role="dialog"] button[title*="compare"]').first().click();
  await sleep(1800);
  const rows = await p.evaluate(() => document.querySelectorAll("[data-testid=fsc-compare-row]").length);
  dialog = rows === WANT_ROWS;
  attempts.push(`${i}:rows=${rows}`);
}
must(dialog, `compare dialog opens with ${WANT_ROWS} rows (attempts: ${attempts.join(" | ")})`);

// the strip always exists, with real idle content and a labeled Scan button
let stripIdle = "";
for (let i = 0; i < 6 && !stripIdle; i++) {
  stripIdle = await p.evaluate(() => {
    const s = document.querySelector("[data-testid=fsc-compare-freshness]");
    if (!s) return "";
    const idle = (s.textContent || "").match(/\d+ curves? indexed/);
    return idle ? idle[0] : "NOSTRIPTEXT";
  });
  if (!stripIdle || stripIdle === "NOSTRIPTEXT") { stripIdle = ""; await sleep(900); }
}
must(stripIdle === `${WANT_ROWS} curves indexed`, `idle strip counts the index (got "${stripIdle}")`);

const scanBtn = await p.evaluate(() => {
  const el = document.querySelector("[data-testid=fsc-compare-rescan]");
  if (!el) return "NOBTN";
  return (el.offsetParent ? "VISIBLE" : "HIDDEN") + ":" + (el.textContent || "").trim();
});
must(scanBtn === "VISIBLE:Scan", `Scan button visible with a real label (got ${scanBtn})`);

// re-scan keeps the list intact (qa62's survival contract, restated)
await p.locator('[data-testid="fsc-compare-rescan"]').click();
await sleep(2200);
const rowsAfter = await p.evaluate(() => document.querySelectorAll("[data-testid=fsc-compare-row]").length);
must(rowsAfter === WANT_ROWS, `list survives a re-scan (rows=${rowsAfter})`);

// picking the running job flips the whole strip teal, notice inside
await p.locator(`[data-testid="fsc-compare-row"][data-job-id="${LIVE_ID}"] button[role="checkbox"]`).first().click();
await sleep(1200);
const checked = await p.evaluate((liveId) =>
  document.querySelector(`[data-testid=fsc-compare-row][data-job-id="${liveId}"] button[role=checkbox]`)?.getAttribute("aria-checked") || "MISSING", LIVE_ID);
must(checked === "true", `picked QA Refine Live (aria-checked=${checked})`);

let liveInfo = "";
for (let i = 0; i < 6 && !liveInfo; i++) {
  liveInfo = await p.evaluate(() => {
    const strip = document.querySelector("[data-testid=fsc-compare-freshness]");
    const notice = document.querySelector("[data-testid=fsc-compare-autolive]");
    if (!strip || !notice) return "";
    const teal = strip.className.includes("border-teal-600");
    const cadence = (notice.textContent || "").includes("12");
    return (teal ? "TEAL" : "PLAIN") + "+" + (cadence ? "CADENCE12" : "NOCADENCE");
  });
  if (!liveInfo) await sleep(900);
}
must(liveInfo === "TEAL+CADENCE12", `live strip is teal with the 12 s cadence (got ${liveInfo})`);

// Esc peels the compare dialog; the inspector survives (layering intact)
await p.keyboard.press("Escape");
await sleep(900);
const layerC = await p.evaluate(() => {
  const cmp = !!document.querySelector("[data-testid=fsc-compare-freshness]");
  const insp = !!document.querySelector("[role=dialog]");
  return (cmp ? "CMP " : "no-cmp ") + (insp ? "INSP" : "no-insp");
});
must(layerC.trim() === "no-cmp INSP", `Esc peels only the compare dialog (got ${layerC})`);

must(consoleErrors.length === 0, `zero page errors overall (got ${JSON.stringify(consoleErrors)})`);
console.log(`PHASE C GREEN (${PASS} asserts)`);

await cleanup();
console.log(`QA69 GREEN (${PASS} asserts)`);
process.exit(0);
