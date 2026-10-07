// t660 — the palette's gallery family completes: Class averages join the
// deep-link index, and a shipped-dark teaser lights up.
//
// Backstory: the class-averages teaser (t544) has been in the inspector's
// overview tab since its window, but the demo world never wrote the file
// either of its lanes reads — the /classes route answered classesFile:
// null, volumeFiles: [] and the self-hide contract kept the teaser dark
// EVERY window. This window the seeder plants the RELION 5 dialect into
// the workdirs (class2d: run_unmasked_classes.mrcs, 8 slices; class3d:
// run_it003_class00K.mrc volumes) and the teaser renders for the first
// time. The palette grows a Class averages group (completed
// class2d/class3d/initialmodel) whose jump lands on the overview tab —
// the arrival IS the tab: the teaser has no lightbox, the grid is the
// browse surface, so the handshake has ONE consumer (the inspector) and
// no TTL dance (Task 81's sync shape).
// The rider (t656's last ledger item): the star-table's hover face stops
// hard-cutting — row and sticky index cell fade on transition-colors.
//
// Probe contract:
//   A  the world — /classes answers BOTH lanes for the demo world
//      (class2d stack 8 slices; class3d 3 volumes) and the tile route
//      renders real PNGs for each.
//   B  the palette — a Class averages group with exactly the three
//      classification rows; the jump lands on the inspector's OVERVIEW
//      tab with the teaser VISIBLE (8 class2d tiles).
//   C  the one-shot — the request is consumed; reopening the same job
//      keeps the latched Overview but never re-fires anything stale.
//   D  class3d's volume lane renders 3 tiles.
//   E  the rider — the star-table's row and sticky cell carry
//      transition-colors (computed style, not class-string hope).
//   F  the console contract — four buckets, real JS errors 0. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1200 } });
const consoleErrors = [];
const hmrNoise = [];
const resourceFlap = [];
const resource404 = [];
const chunkFlap = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  // t659's four-bucket taxonomy, inherited verbatim: the dev server's
  // self-voices get bounded buckets, the product's voice must be 0.
  if (t.includes("webpack-hmr") && t.includes("ERR_CONNECTION_REFUSED")) { hmrNoise.push(t); return; }
  if (t.startsWith("Failed to load chunk") && t.includes("async loader")) { chunkFlap.push(t); return; }
  if (t.startsWith("Failed to load resource")) {
    if (/status of 404/.test(t)) resource404.push(t);
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

/** t659's server-health gate: never fire a measured leg into a flap. */
const waitServerHealthy = async (label) => {
  for (let i = 0; i < 25; i++) {
    const t0 = Date.now();
    try {
      const ok = await page.evaluate(async () => {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        return r.ok;
      });
      if (ok && Date.now() - t0 < 2000) {
        if (i > 0) console.log(`  · server healthy again after ${i} polls (${label})`);
        return true;
      }
    } catch { /* flap — keep polling */ }
    await sleep(2000);
  }
  return false;
};

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await waitServerHealthy("initial");

// ---------- A: the world answers both lanes ----------
const lanes = await page.evaluate(async () => {
  const grab = async (id) => {
    const r = await fetch(`/api/jobs/${id}/classes`, { cache: "no-store" });
    return r.json();
  };
  return {
    class2d: await grab("cmuwipe635000class2d"),
    class3d: await grab("cmuwipe635000class3d"),
  };
});
must(lanes.class2d.classesFile === "run_unmasked_classes.mrcs" && lanes.class2d.classesSlices === 8,
  "A class2d's stack lane answers (8 slices)", `${lanes.class2d.classesFile} · ${lanes.class2d.classesSlices}`);
must((lanes.class2d.classes ?? []).length === 8, "A class2d carries 8 occupancy rows");
must((lanes.class3d.volumeFiles ?? []).length === 3,
  "A class3d's volume lane answers (3 per-class volumes)", (lanes.class3d.volumeFiles ?? []).join(","));

const tile = await page.evaluate(async () => {
  const r = await fetch(`/api/jobs/cmuwipe635000class2d/outputs/file?path=${encodeURIComponent("run_unmasked_classes.mrcs")}&format=png&montage=0&slice=0`, { cache: "no-store" });
  return { ok: r.ok, type: r.headers.get("content-type") };
});
must(tile.ok && (tile.type ?? "").includes("image/png"), "A the stack's slice renders a PNG", tile.type ?? "none");

// ---------- warm-up: compile the inspector's lazy chunks ----------
{
  const warmCard = page.locator('[data-testid="job-card"]', { hasText: "2D classification" }).first();
  for (let i = 0; i < 10 && (await warmCard.count()) === 0; i++) await sleep(1000);
  if ((await warmCard.count()) > 0) {
    await warmCard.click().catch(() => {});
    for (let i = 0; i < 15; i++) {
      if ((await page.locator('[data-insp-face="tabs"]').count()) > 0) break;
      await sleep(900);
    }
    await sleep(4500);
    await page.keyboard.press("Escape");
    await sleep(900);
  }
  await waitServerHealthy("after warm-up");
}

const openPalette = async () => {
  await page.keyboard.press("Control+k");
  await sleep(700);
};

// ---------- B: the palette hangs the Class averages group ----------
await openPalette();
const items = page.locator("[cmdk-item]");
let n = 0;
for (let i = 0; i < 10 && !n; i++) {
  n = await items.count();
  if (!n) await sleep(600);
}
must(n > 0, "B palette opens with rows", `rows=${n}`);
const texts = await items.allInnerTexts();
const avgRows = texts.filter((t) => t.includes("Class averages —"));
must(avgRows.length === 3, "B exactly three classification rows (2D/3D + initial model)", avgRows.join(" | "));
const headings = await page.locator("[cmdk-group-heading]").allInnerTexts();
must(headings.some((h) => h.startsWith("Class averages")), "B the group heading speaks", headings.filter((h) => h.includes("Class")).join(","));
must(avgRows.some((t) => t.includes("2D classification")), "B the 2D classification has a row");
must(!avgRows.some((t) => t.includes("3D auto-refine")), "B refine3d has no row (it produces a map, not classes)");

await items.filter({ hasText: "Class averages — 2D classification" }).first().click();
await sleep(1200);
must((await items.count()) === 0, "B palette closes on the jump");
const activeTab = page.locator('[data-insp-face="tabs"] [role="tab"][data-state="active"]');
let tabText = "";
for (let i = 0; i < 12; i++) {
  tabText = await activeTab.first().innerText().catch(() => "");
  if (tabText) break;
  await sleep(800);
}
must(tabText.includes("Overview"), "B the host landed on OVERVIEW (the teaser's home)", tabText);

// the teaser: 8 tiles, lit for populated classes, ghosts for empty ones
const teaser = page.locator('section[data-class-teaser][aria-label="Class averages"]');
let teaserVisible = false;
for (let i = 0; i < 14 && !teaserVisible; i++) {
  teaserVisible = (await teaser.count()) > 0 && (await teaser.isVisible());
  if (!teaserVisible) await sleep(900);
}
must(teaserVisible, "B the shipped-dark teaser is LIT (the self-hide contract finally answers)");
// the tiles are lazy images below the fold — bring the teaser into the
// viewport or naturalWidth stays 0 forever (the t657 wall lesson)
await teaser.scrollIntoViewIfNeeded().catch(() => {});
await sleep(2500);
const tiles = teaser.locator('[data-class-tile] img');
let nTiles = 0;
for (let i = 0; i < 12 && !nTiles; i++) {
  nTiles = await tiles.count();
  if (!nTiles) await sleep(900);
}
must(nTiles === 8, "B the teaser renders exactly 8 class tiles", `tiles=${nTiles}`);
let rendered = 0;
for (let i = 0; i < nTiles; i++) {
  const nw = await tiles.nth(i).evaluate((el) => el.naturalWidth).catch(() => 0);
  if (nw > 0) rendered++;
}
must(rendered >= 6, "B real pixels in the tiles (lazy viewport costs the tail)", `${rendered}/${nTiles}`);
const chipText = await teaser.locator("button[data-slot=chip], span").filter({ hasText: /of 8 populated/ }).first().innerText().catch(() => "");
must(/of 8 populated/.test(chipText), "B the populated chip speaks the t544 numbers", chipText.trim());
await page.screenshot({ path: ".qa-logs/t660-class-averages.png" });

// ---------- C: the one-shot is consumed ----------
await page.keyboard.press("Escape");
await sleep(800);
for (let i = 0; i < 4 && (await page.locator('[role="dialog"]').count()) > 0; i++) {
  await page.keyboard.press("Escape");
  await sleep(600);
}
await waitServerHealthy("between B and C");
const card2d = page.locator('[data-testid="job-card"]', { hasText: "2D classification" }).first();
if ((await card2d.count()) > 0) {
  await card2d.click();
  await sleep(1800);
  const tabAgain = await activeTab.first().innerText().catch(() => "");
  must(tabAgain.includes("Overview"), "C the latched Overview persists (manual-choice semantics)", tabAgain);
  must((await page.locator('section[data-class-teaser] [data-class-tile] img').count()) === 8,
    "C the teaser persists (it is a face, not a one-shot gesture)");
  await page.keyboard.press("Escape");
  await sleep(800);
}

// ---------- D: class3d's volume lane ----------
await openPalette();
const items3 = page.locator("[cmdk-item]");
await items3.filter({ hasText: "Class averages — 3D classification" }).first().click();
await sleep(1500);
// the inspector may need a beat to switch jobs — verify WHO is inspected
let dlgLabel = "";
for (let i = 0; i < 8; i++) {
  dlgLabel = await page.locator('[data-insp-face="tabs"]').count() > 0
    ? await page.locator('[role="dialog"] h2').first().innerText().catch(() => "")
    : "";
  if (dlgLabel.includes("3D classification")) break;
  await sleep(900);
}
must(dlgLabel.includes("3D classification"), "D the inspector switched to the 3D classification", dlgLabel);
const teaser3d = page.locator('section[data-class-teaser][aria-label="Class averages"]');
let t3 = false;
for (let i = 0; i < 14 && !t3; i++) {
  t3 = (await teaser3d.count()) > 0 && (await teaser3d.isVisible());
  if (!t3) await sleep(900);
}
must(t3, "D the 3D classification's teaser mounts");
await teaser3d.scrollIntoViewIfNeeded().catch(() => {});
await sleep(2000);
const heading3d = await teaser3d.locator("h3").first().innerText().catch(() => "");
must(heading3d.includes("Class maps"), "D the 3D face speaks its own name (Class maps)", heading3d);
const volTiles = teaser3d.locator('[data-class-tile] img');
let nVol = 0;
for (let i = 0; i < 12 && !nVol; i++) {
  nVol = await volTiles.count();
  if (!nVol) await sleep(900);
}
must(nVol === 3, "D the volume lane renders 3 tiles", `tiles=${nVol}`);
let volRendered = 0;
for (let i = 0; i < nVol; i++) {
  const nw = await volTiles.nth(i).evaluate((el) => el.naturalWidth).catch(() => 0);
  if (nw > 0) volRendered++;
}
must(volRendered >= 2, "D real pixels in the volume tiles", `${volRendered}/${nVol}`);
await page.keyboard.press("Escape");
await sleep(800);

// ---------- E: the rider — star-table hover fades ----------
await openPalette();
const items4 = page.locator("[cmdk-item]");
await items4.filter({ hasText: /^Post-processing|Post-processing —/ }).first().click().catch(async () => {
  await items4.filter({ hasText: "Post-processing" }).first().click();
});
await sleep(1800);
// the smart default for a completed job is RESULTS — where the STAR cards live
const starSection = page.locator('section[aria-label="STAR tables"]');
let starSectionVisible = false;
for (let i = 0; i < 10 && !starSectionVisible; i++) {
  starSectionVisible = (await starSection.count()) > 0;
  if (!starSectionVisible) {
    const tabNow = await activeTab.first().innerText().catch(() => "");
    if (!tabNow.includes("Results")) {
      await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
      await sleep(1000);
    }
    await starSection.scrollIntoViewIfNeeded().catch(() => {});
    await sleep(600);
  }
}
must(starSectionVisible, "E the STAR tables section is in sight (results tab)");
const starCards = starSection.locator("button");
const nCards = await starCards.count();
must(nCards > 0, "E STAR table cards present", `n=${nCards}`);
// open the first card whose dialog hosts the sticky index cell
let stickyCell = null;
const dialogE = page.locator("[role='dialog']");
for (let i = 0; i < nCards && !stickyCell; i++) {
  await starCards.nth(i).click();
  await sleep(1200);
  if ((await dialogE.count()) === 0) continue;
  const cell = dialogE.locator('[data-star-idx-cell]').first();
  for (let w = 0; w < 8; w++) {
    if ((await cell.count()) > 0) { stickyCell = cell; break; }
    await sleep(900);
  }
  if (stickyCell) break;
  await page.keyboard.press("Escape");
  await sleep(600);
}
must(stickyCell != null, "E a star table with its sticky index cell is open");
if (stickyCell) {
  const probe = await stickyCell.evaluate((el) => {
    const row = el.closest("tr");
    const cs = getComputedStyle(el);
    const rs = row ? getComputedStyle(row) : null;
    return {
      stickyTransition: (cs.transitionProperty ?? "").includes("background-color"),
      rowTransition: rs ? (rs.transitionProperty ?? "").includes("background-color") : false,
      sticky: cs.position === "sticky",
    };
  });
  must(probe.sticky, "E the index cell is genuinely sticky");
  must(probe.stickyTransition && probe.rowTransition,
    "E the row AND the sticky cell fade on hover (transition-colors, not a hard cut)",
    `sticky=${probe.stickyTransition} row=${probe.rowTransition}`);
  await page.screenshot({ path: ".qa-logs/t660-star-hover.png" });
  await page.keyboard.press("Escape");
  await sleep(700);
}

// ---------- F: the console contract ----------
must(consoleErrors.length === 0, "F zero real JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0, "F zero frame 404s — every lane speaks real bytes", `${resource404.length}`);
must(resourceFlap.length <= 60, "F server-flap resource failures bounded", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "F lazy-chunk fetch flaps bounded", `${chunkFlap.length}`);
must(hmrNoise.length <= 10, "F HMR socket noise bounded", `${hmrNoise.length}`);

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt660-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
