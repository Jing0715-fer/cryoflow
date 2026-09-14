/* t191 — the instrument learns to speak and to leave.
 *
 * Task 190 made the landscape a scrub bar for pointers; Task 191 gives it
 * a VOICE and an EXIT:
 *  1. KEYBOARD — the strip becomes a real ARIA slider (tabIndex=0,
 *     role=slider, aria-valuenow/valuetext): ←/→ nudge 1%, Shift+←/→ 5%,
 *     Home/End jump to the ends. The ghosts get the pointer's two doors,
 *     keyed: Enter/Space adopt in place, arrows adopt AND nudge.
 *  2. EXPORT — the landscape's numbers can leave as CSV. ONE builder
 *     (buildProfileCsv) feeds clipboard + download + the data-csv
 *     observation attribute (t188's contract ported to the instrument).
 *     A new landscape RETIRES the previous export; the CSV is a function
 *     of the landscape, NOT the playhead, so scrubbing never retires it.
 *     The download twins (hpc-queue-sim, pipeline-analytics) are collected
 *     into @/lib/download — the third consumer must not fork.
 *
 * X pins it in source; D drives the UI (keys, exports, retirement); Z
 * proves read-only.
 */
import { readFileSync } from "fs";
import path from "path";
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => readFileSync(path.resolve(p), "utf8").replace(/\r/g, "");
const HOST_JOB = "QA Refine3D";

let pass = 0;
const failures = [];
function must(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL: ${label}`);
  }
}
function section(name) {
  console.log(`== ${name} ==`);
}

/** Parse the profile CSV. No RFC 4180 machinery needed here — the builder's
 *  values are controlled (axis enum, ints, fixed-point fractions, finite
 *  floats), no cell can contain a comma; the probe asserts that innocence
 *  via the absence of quotes rather than a state machine. */
function parseProfileCsv(csv) {
  const lines = csv.split("\n").filter((l) => l.length > 0);
  const rows = lines.slice(1).map((l) => l.split(","));
  return { header: lines[0], rows, lines };
}

/* ================= S — baseline + fixture ================= */
section("S: baseline world + seeded volume");
const list0 = await (await fetch(BASE + "/api/jobs")).json();
const jobs0 = Array.isArray(list0) ? list0 : list0.jobs ?? [];
must(jobs0.length === 26, `S1 roster 26 jobs (${jobs0.length})`);
const host = jobs0.find((j) => j.name === HOST_JOB && j.status === "completed");
must(!!host, `S2 the volume host job exists (${HOST_JOB})`);
try {
  execSync(`QA_VOL_HOST="${HOST_JOB}" python3 scripts/qa67-seed-volume.py`, { cwd: path.resolve("."), stdio: "pipe", timeout: 60_000 });
  must(true, "S3 volume seeding ran (idempotent)");
} catch (e) {
  must(false, `S3 volume seeding ran (${e.message?.slice(0, 60)})`);
}

/* ================= X — source oracles ================= */
section("X: the instrument speaks and leaves, written once");
const embSrc = src("src/components/workflow/results/molstar-embed.tsx");

must(
  embSrc.includes('role="slider"') && embSrc.includes("tabIndex={0}"),
  "X1 the strip is a real slider with a keyboard door (tabIndex=0)"
);
must(
  embSrc.includes("onLandscapeKeyDown") && embSrc.includes('case "Home"') && embSrc.includes("preventDefault"),
  "X2 the keyboard contract: arrows/Shift arrows/Home/End, scroll-stealing prevented"
);
must(
  embSrc.includes("aria-valuenow={Math.round(slicePos * 100)}") && embSrc.includes('aria-valuetext={`plane'),
  "X3 the plane position is speakable (aria-valuenow + aria-valuetext)"
);
must(
  embSrc.includes("focus-visible:ring-2 focus-visible:ring-cyan-500/70"),
  "X4 focus is VISIBLE (keyboard users can see the instrument take the keys)"
);
must(
  embSrc.includes("onGhostKeyDown") && embSrc.includes('case " "'),
  "X5 ghosts speak too: Enter/Space adopt, arrows adopt AND nudge (the pointer's doors, keyed)"
);
must(
  embSrc.includes('PROFILE_CSV_HEADER = "axis,bin_index,plane_fraction,mean_density"'),
  "X6 the CSV contract is snake_case 4 columns (machine-first)"
);
must(
  (embSrc.match(/buildProfileCsv\b/g) || []).length === 3 &&
  embSrc.includes('data-csv-carrier="profile"') &&
  embSrc.includes("data-csv={lastProfileCsv ?? undefined}"),
  "X7 ONE builder feeds the data-csv attribute, which rides an ALWAYS-ATTACHED carrier (not the 4-second note) — count synced to 3: t195's report doc-comment names its CSV sibling (the front wave's oracle follows the back wave's source, 6th instance)"
);
must(
  embSrc.includes("(clipboard unavailable)"),
  "X8 the fallback receipt says the degradation out loud (the second door, t188's clause)"
);
must(
  /useEffect\(\(\) => \{\s*setLastProfileCsv\(null\);\s*setProfileExportNote\(null\);\s*\}, \[profile\]\)/.test(embSrc),
  "X9 a new landscape RETIRES the previous export (stale numbers never survive)"
);
must(
  embSrc.includes('import { downloadText } from "@/lib/download"') && !/const downloadText|function downloadText/.test(embSrc),
  "X10 the viewer imports the shared downloadText — no third twin is born"
);
const hpcSrc = src("src/components/workflow/hpc-queue-sim.tsx");
const paSrc = src("src/components/workflow/pipeline-analytics.tsx");
must(
  hpcSrc.includes('import { downloadText } from "@/lib/download"') && !/const downloadText|function downloadText/.test(hpcSrc) &&
  paSrc.includes('import { downloadText } from "@/lib/download"') && !/const downloadText|function downloadText/.test(paSrc),
  "X11 the two private twins are collected into @/lib/download"
);
const dlSrc = src("src/lib/download.ts");
must(
  dlSrc.includes("revokeObjectURL") && dlSrc.includes("a.remove()") && dlSrc.includes("a.click()"),
  "X12 the shared util does the full anchor dance (attach, click, remove, revoke)"
);
must(
  embSrc.includes('aria-label="Copy profile as CSV"') && embSrc.includes('aria-label="Download profile as CSV"') && embSrc.includes("disabled={!profile}"),
  "X13 both export doors have names and refuse an empty landscape"
);
{
  const m = embSrc.match(/const exportProfileCsv[\s\S]*?\n  \};/);
  must(!!m && !m[0].includes("slicePos"), "X14 the CSV is a function of the LANDSCAPE, not the playhead");
}

/* ================= D — the UI loop ================= */
section("D: keys that move the plane, numbers that leave");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

let onCanvas = false;
for (let i = 0; i < 10 && !onCanvas; i++) {
  if (await page.locator("h1", { hasText: "Dashboard" }).isVisible().catch(() => false)) {
    await page.keyboard.press("Shift+KeyD");
    await sleep(2200);
  } else if (await page.locator(`[data-job="${host.id}"]`).first().isVisible().catch(() => false)) {
    onCanvas = true;
  } else await sleep(1800);
}
must(onCanvas, "D1 the canvas renders");
let inResults = false;
for (let i = 0; i < 6 && !inResults; i++) {
  await page.locator(`[data-job="${host.id}"]`).first().click({ timeout: 3000, force: i >= 3 }).catch(() => {});
  await sleep(1600);
  const tab = page.locator('[role="tab"]', { hasText: "Results" });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await sleep(1400);
    inResults = await page.locator('section[aria-label="Maps and images"]').isVisible().catch(() => false);
  }
}
must(inResults, "D2 the inspector opens on Results");

let viewerOpen = false;
for (let i = 0; i < 5 && !viewerOpen; i++) {
  await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 2500 }).catch(() => {});
  await sleep(1200);
  const v3d = page.locator("button", { hasText: "View in 3D" });
  if (await v3d.isVisible().catch(() => false)) {
    await v3d.click();
    await sleep(1500);
    viewerOpen = await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false);
    for (let k = 0; k < 20 && !viewerOpen; k++) {
      await sleep(2500);
      viewerOpen = await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false);
    }
  }
}
must(viewerOpen, "D3 the Mol* viewer opens");

if (viewerOpen) {
  await page.locator('button[aria-label="Toggle cross-section plane"]').click();
  await sleep(700);
  const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');
  let stripOk = false;
  for (let i = 0; i < 12 && !stripOk; i++) {
    stripOk = (await strip.isVisible().catch(() => false)) && !!(await strip.boundingBox().catch(() => null));
    if (!stripOk) await sleep(1000);
  }
  must(stripOk, "D4 the landscape renders as a slider");

  const valuenow = async () => Number((await strip.getAttribute("aria-valuenow").catch(() => "NaN")) ?? NaN);
  const readout = () =>
    page
      .locator("span", { hasText: /^plane \d+%$/ })
      .last()
      .textContent()
      .catch(() => "");
  const playX = () =>
    page.evaluate(() => {
      const svg = [...document.querySelectorAll('svg[role="slider"][aria-label^="Density profile along the"]')][0];
      const dot = svg?.querySelector("circle[cx]");
      return dot ? Number(dot.getAttribute("cx")) : NaN;
    });

  // ---- keyboard: the plane moves ----
  await strip.focus();
  await sleep(300);
  const v0 = await valuenow();
  await page.keyboard.press("ArrowRight");
  await sleep(700);
  const v1 = await valuenow();
  must(v0 === 50 && v1 === 51, `D5 ArrowRight nudges 1% (${v0} -> ${v1})`);
  const px1 = await playX();
  must(Math.abs(px1 - 51) < 3, `D6 the playhead follows the key (cx ${px1}, target 51)`);
  const ro1 = (await readout()) ?? "";
  must(/plane 51%/.test(ro1), `D7 the DOM readout agrees (${ro1.trim()})`);
  const vt = (await strip.getAttribute("aria-valuetext").catch(() => "")) ?? "";
  must(vt === `plane ${v1}%`, `D8 aria-valuetext speaks the position ("${vt}")`);

  await page.keyboard.press("Shift+ArrowRight");
  await sleep(700);
  must((await valuenow()) === 56, `D9 Shift+Arrow nudges 5% (${await valuenow()})`);
  await page.keyboard.press("Home");
  await sleep(700);
  const vH = await valuenow();
  await page.keyboard.press("End");
  await sleep(700);
  must(vH === 0 && (await valuenow()) === 100, `D10 Home/End jump to the ends (${vH} -> ${await valuenow()})`);

  // ---- export: the numbers leave ----
  const copyBtn = page.locator('button[aria-label="Copy profile as CSV"]');
  const dlBtn = page.locator('button[aria-label="Download profile as CSV"]');
  const carrier = page.locator('div[data-csv-carrier="profile"]');
  const carrierCsv = async () => (await carrier.getAttribute("data-csv").catch(() => null)) ?? null;
  must(
    (await copyBtn.isEnabled().catch(() => false)) && (await dlBtn.isEnabled().catch(() => false)),
    "D11 both export doors are enabled once the landscape exists"
  );
  must(
    (await carrierCsv()) === null,
    "D11b before any export the carrier carries NO data-csv (nothing exported, nothing claimed)"
  );
  await copyBtn.click();
  await sleep(600);
  const noteShown = await page
    .locator('div[aria-label="Profile export status"]')
    .isVisible()
    .catch(() => false);
  const csv = await carrierCsv();
  must(noteShown && !!csv, "D12 copy leaves a visible receipt AND the carrier now carries the data-csv bytes");
  if (csv) {
    // the CSV's row count must equal the CURRENT landscape's bins — read
    // the truth from the strip's own footer ("mean ρ along Z · N bins"),
    // never from a hardcoded map (the UI may open any of the job's maps)
    const footerText = (await page.locator("span", { hasText: /mean ρ along/ }).last().textContent().catch(() => "")) ?? "";
    const nb = /· (\d+) bins/.exec(footerText);
    const nBins = nb ? Number(nb[1]) : NaN;
    const { header, rows } = parseProfileCsv(csv);
    const axisOk = rows.every((r) => r[0] === "z");
    const frac0 = rows[0]?.[2], fracN = rows[rows.length - 1]?.[2];
    const densOk = rows.every((r) => Number.isFinite(Number(r[3])) && !r[3].includes(","));
    must(
      header === "axis,bin_index,plane_fraction,mean_density" && Number.isFinite(nBins) && rows.length === nBins && axisOk &&
      frac0 === "0.0000" && fracN === "1.0000" && densOk && !csv.includes('"'),
      `D13 the CSV honors its contract (${rows.length} rows == footer's ${nBins} bins, axis z, fractions 0->1, finite densities)`
    );
  } else must(false, "D13 the CSV honors its contract (no data-csv)");

  await dlBtn.click();
  await sleep(600);
  const note2 = (await page.locator('div[aria-label="Profile export status"]').textContent().catch(() => "")) ?? "";
  must(
    /Downloaded map-profile-z-/.test(note2) && !note2.includes("(clipboard unavailable)"),
    `D14 the explicit download names the file and does not apologize (${note2.trim().slice(0, 60)})`
  );

  // the CSV is a function of the landscape, not the playhead — the carrier
  // attribute survives ANY scrub, at ANY observer speed (no 4s race here)
  const csvBefore = await carrierCsv();
  await strip.focus();
  await page.keyboard.press("ArrowLeft");
  await sleep(900);
  await page.keyboard.press("ArrowRight");
  await sleep(900);
  const csvAfter = await carrierCsv();
  must(csvBefore !== null && csvBefore === csvAfter, "D15 scrubbing does NOT retire the export (carrier bytes unchanged through ArrowLeft+ArrowRight)");

  // a new landscape retires the export — the abdication edict, live and
  // time-independent: the carrier's attribute is REMOVED by the state clear
  await page.locator('button[title="Slice perpendicular to the X axis"]').click();
  let strip2 = false;
  for (let i = 0; i < 15 && !strip2; i++) {
    strip2 = await page
      .locator('svg[role="slider"][aria-label*="along the X axis"]')
      .isVisible()
      .catch(() => false);
    if (!strip2) await sleep(800);
  }
  must(strip2, "D16 the axis switch lands a new landscape");
  must(
    (await carrierCsv()) === null,
    "D17 the new landscape RETIRED the old export (carrier attribute removed)"
  );
  await copyBtn.click();
  await sleep(600);
  const csvX = await carrierCsv();
  if (csvX) {
    const { rows } = parseProfileCsv(csvX);
    must(rows.length > 0 && rows.every((r) => r[0] === "x"), "D18 the re-export speaks for the NEW axis (x rows)");
  } else must(false, "D18 the re-export speaks for the NEW axis (no data-csv)");

  await page.keyboard.press("Escape");
  await sleep(900);
  must(
    !(await page.locator('button[aria-label="Toggle cross-section plane"]').isVisible().catch(() => false)),
    "D19 Escape closes the viewer"
  );
} else {
  must(false, "D4 the landscape renders as a slider (viewer never opened)");
}
await browser.close();

/* ================= Z — read-only proof ================= */
section("Z: the world was only read");
const afterList = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(afterList.length === jobs0.length, `Z1 roster size unchanged (${afterList.length})`);
const afterIds = new Set(afterList.map((j) => j.id));
must(jobs0.every((j) => afterIds.has(j.id)), "Z2 roster identity — nothing stayed behind");
must(consoleErrors.length === 0, `Z3 console clean (${consoleErrors.length})`);

console.log(
  failures.length === 0
    ? `\nT191 ALL PASS (${pass} assertions, 0 failures)`
    : `\nT191 FAILED (${failures.length} of ${pass + failures.length} assertions)\n  - ${failures.join("\n  - ")}`
);
process.exit(failures.length === 0 ? 0 : 1);
