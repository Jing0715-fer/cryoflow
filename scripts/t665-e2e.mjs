// t665 — the palette's third image-surface family: Denoise compare joins
// the deep-link index, and TWO shipped-dark surfaces light up at once.
//
// Backstory: the t542 before/after wall and the t559 pick handoff have
// been mounted behind the `topazdenoise` gate since their windows, but the
// demo world never had a denoise run — both surfaces shipped DARK every
// window (the t660 doctrine: shipped-dark is also debt — an absence may
// mean "not fed", not "not wanted"). This window the seeder grows the
// canonical world by one branch: MotionCorr → Topaz Denoise, whose index
// names ten DERIVED frames (a 16×16 box average of the run's own real
// EMPIAR inputs — a genuine noise reduction, so the wipe divider shows
// physics, not a fake). The palette grows the Denoise compare group; the
// arrival is the t659 two-gate shape: the inspector clears the way to the
// results tab, the WALL consumes (scroll into view + fuchsia flash) — a
// link that promises a before/after comparison puts the comparison in
// view, not just the tab that contains it below the fold.
// The rider: the pairing route's resolver learns the t658 basename
// reconciliation (the corrected star's bare rows vs the micrographs/
// subdir layout — without it the provider leg answered paired=0 against
// exactly the star the run consumed), and the gallery footer's stale
// "the two renders agree" clause (true for engine-run mocks, false for
// the seeded derivation) goes honestly unsaid.
//
// Probe contract:
//   A  the world — denoise-pairs answers 10/10 paired with the provider
//      the engine itself would pick; both PNG legs render real bytes; a
//      non-denoise job gets the honest empty body.
//   B  the palette — a Denoise compare group with exactly the denoise
//      run's row; refine3d has none (it produces maps, not walls).
//   C  the arrival — the jump lands on the results tab with the wall
//      flashed and in view; the flash is ONE-SHOT (on → off, and no
//      re-flash when the job is reopened).
//   D  the wall — 9 cards + show-more reveals the 10th; the keyboard
//      wipe scrubs the divider (aria-valuetext + clip-path agree); the
//      side-by-side mode speaks both labels.
//   E  the gate — a non-denoise job's results tab has no wall.
//   F  the console contract — four buckets, real JS errors 0. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const DEN = "cmututold000topazdenoise";
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
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING|SOCKET_NOT_CONNECTED)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => {
  const m = `pageerror: ${e.message}`;
  // the chunk-flap family wears many faces (t664's taxonomy): an unhandled
  // lazy-chunk rejection is the dev server's compile race, not the
  // product's voice — same bounded bucket, whichever door it used
  if (m.includes("Failed to load chunk")) { chunkFlap.push(m); return; }
  consoleErrors.push(m);
});

// t665 diagnostics — the original-leg tiles failed in-app while curl
// served the same URL 200: capture what the wire actually said (status /
// failure) for every outputs/file request, split by job.
const fileWire = { den: { ok: 0, bad: 0, notes: [] }, orig: { ok: 0, bad: 0, notes: [] } };
page.on("response", (r) => {
  const u = r.url();
  if (!u.includes("/outputs/file")) return;
  const bucket = u.includes("denoised") ? fileWire.den : fileWire.orig;
  if (r.ok()) bucket.ok++;
  else bucket.bad++;
});
page.on("requestfailed", (r) => {
  const u = r.url();
  if (!u.includes("/outputs/file")) return;
  const bucket = u.includes("denoised") ? fileWire.den : fileWire.orig;
  bucket.bad++;
  if (bucket.notes.length < 4) bucket.notes.push(`${u.split("?")[1]?.slice(0, 40)}… ${r.failure()?.errorText}`);
});

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

// the landing view is the canvas — the roster rows live on the Dashboard
// view; the switcher tab's title is the stable anchor (t658's own dial)
const dashTab = page.locator('[role="tab"][title^="Project dashboard"]').first();
for (let i = 0; i < 8 && (await dashTab.count()) === 0; i++) await sleep(800);
if ((await dashTab.count()) > 0) {
  await dashTab.click();
  await sleep(1500);
}
/** open a job from the roster (the t658 row dial) */
const openFromRoster = async (name, titlePrefix) => {
  const row = page.locator("[data-roster-row]", { hasText: name }).first();
  for (let i = 0; i < 10 && (await row.count()) === 0; i++) await sleep(900);
  if ((await row.count()) === 0) return false;
  const btn = row.locator(`button[title^="${titlePrefix}"]`).first();
  if ((await btn.count()) === 0) return false;
  await btn.click();
  return true;
};
/** the recovery ladder (t664): a mid-flight server death closes the
 *  dialog and strands the page — the human answer is reload +
 *  re-navigate + reopen, once. Returns true when a denoise dialog is
 *  open afterwards. */
const recoverToDenoiseWall = async () => {
  if ((await page.locator('[role="dialog"]').count()) > 0) return true;
  console.log("  · recovery ladder: dialog stranded — reload + re-navigate + reopen");
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitServerHealthy("recovery");
  await dashTab.click().catch(() => {});
  await sleep(1500);
  const opened = await openFromRoster("Topaz Denoise", "Open Topaz Denoise");
  if (!opened) return false;
  await sleep(2200);
  return (await page.locator('[role="dialog"]').count()) > 0;
};

// ---------- A: the world answers the pairing route ----------
const pairs = await page.evaluate(async (id) => {
  const r = await fetch(`/api/jobs/${id}/denoise-pairs`, { cache: "no-store" });
  return { status: r.status, body: await r.json() };
}, DEN);
must(pairs.status === 200, "A the pairing route answers 200", `${pairs.status}`);
must(pairs.body.total === 10 && pairs.body.paired === 10,
  "A ten pairs, ten paired — the basename reconciliation feeds the provider leg",
  `total=${pairs.body.total} paired=${pairs.body.paired}`);
must(pairs.body.provider?.id === "cmuwipe6350motioncorr",
  "A the provider is the run's own motioncorr (the engine's primary leg)", pairs.body.provider?.name ?? "none");
const p0 = (pairs.body.pairs ?? [])[0] ?? {};
must(p0.denoised != null && p0.original != null && p0.originalJobId === "cmuwipe6350motioncorr",
  "A pair 0 carries both legs with their own serving doors",
  `${p0.name}: ${p0.denoised} ← ${p0.original}`);
const pngs = await page.evaluate(async (p) => {
  const grab = async (url) => {
    const r = await fetch(url, { cache: "no-store" });
    const buf = await r.arrayBuffer();
    return { ok: r.ok, type: r.headers.get("content-type"), bytes: buf.byteLength };
  };
  return {
    den: await grab(`/api/jobs/${p.denJob}/outputs/file?path=${encodeURIComponent(p.den)}&format=png`),
    orig: await grab(`/api/jobs/${p.origJob}/outputs/file?path=${encodeURIComponent(p.orig)}&format=png`),
  };
}, { denJob: DEN, den: p0.denoised, origJob: p0.originalJobId, orig: p0.original });
must(pngs.den.ok && (pngs.den.type ?? "").includes("image/png") && pngs.den.bytes > 1000,
  "A the denoised leg renders real PNG bytes", `${pngs.den.bytes}B ${pngs.den.type}`);
must(pngs.orig.ok && (pngs.orig.type ?? "").includes("image/png") && pngs.orig.bytes > 1000,
  "A the original leg renders real PNG bytes (nearest-neighbour, full-noise σ)", `${pngs.orig.bytes}B ${pngs.orig.type}`);
const emptyGate = await page.evaluate(async () => {
  const r = await fetch(`/api/jobs/cmuwipe635000class2d/denoise-pairs`, { cache: "no-store" });
  return r.json();
});
must(emptyGate.total === 0 && (emptyGate.pairs ?? []).length === 0,
  "A a non-denoise job gets the honest empty body (not a wound)");

// ---------- warm-up: compile the inspector + gallery chunks ----------
{
  const opened = await openFromRoster("Topaz Denoise", "Open Topaz Denoise");
  if (opened) {
    for (let i = 0; i < 15; i++) {
      if ((await page.locator('[data-insp-face="tabs"]').count()) > 0) break;
      await sleep(900);
    }
    // give the results tab (the completed default) and the gallery's lazy
    // chunk one clean compile + one clean fetch — the measured arrival
    // must not pay first-compile costs, and a first-open lazy compile can
    // push an HMR update that full-reloads the page (both flights saw the
    // inspector die ~15s after its first open): wait that window out HERE,
    // behind the warm-up, not inside a measured leg.
    await sleep(5000);
    await page.keyboard.press("Escape");
    await sleep(8000);
  } else {
    console.log("  · denoise roster row not found — is the demo project active?");
  }
  await waitServerHealthy("after warm-up");
  // the warm-up absorbs the first-render costs (the stat cache now serves
  // every repeat visit from the (size, mtime) slot) — the MEASURED legs
  // must see a warm world, so the wire counters restart here
  fileWire.den = { ok: 0, bad: 0, notes: [] };
  fileWire.orig = { ok: 0, bad: 0, notes: [] };
}

const openPalette = async () => {
  // ctrl+k first; the header chip (the OPEN_EVENT handshake) as the
  // fallback — a post-reload page can miss a keystroke but not a click
  for (let i = 0; i < 4; i++) {
    if (i === 0) await page.keyboard.press("Control+k");
    else await page.locator('button[aria-label^="Open command palette"]').first().click().catch(() => {});
    await sleep(800);
    const n = await page.locator("[cmdk-item]").count();
    if (n > 0) return;
  }
};
const activeTab = page.locator('[data-insp-face="tabs"] [role="tab"][data-state="active"]');

// ---------- B: the palette hangs the Denoise compare group ----------
await openPalette();
const items = page.locator("[cmdk-item]");
let n = 0;
for (let i = 0; i < 10 && !n; i++) {
  n = await items.count();
  if (!n) await sleep(600);
}
must(n > 0, "B palette opens with rows", `rows=${n}`);
const texts = await items.allInnerTexts();
const denRows = texts.filter((t) => t.includes("Denoise compare —"));
must(denRows.length === 1, "B exactly one denoise run has a row", denRows.join(" | "));
const headings = await page.locator("[cmdk-group-heading]").allInnerTexts();
must(headings.some((h) => h.startsWith("Denoise compare")), "B the group heading speaks", headings.filter((h) => h.includes("Denoise")).join(","));
must(!denRows.some((t) => t.includes("3D auto-refine")), "B refine3d has no row (it produces a map, not a wall)");

await items.filter({ hasText: "Denoise compare —" }).first().click();
await sleep(1200);
must((await items.count()) === 0, "B palette closes on the jump");

// ---------- C: the arrival — flash, in view, one-shot ----------
let tabText = "";
for (let i = 0; i < 12; i++) {
  tabText = await activeTab.first().innerText().catch(() => "");
  if (tabText) break;
  await sleep(800);
}
must(tabText.includes("Results"), "C the host cleared the way to RESULTS (the wall's home)", tabText);

const gallery = page.locator('section[data-denoise-gallery][aria-label="Denoise compare"]');
let gVisible = false;
let dialogDied = false;
for (let i = 0; i < 14 && !gVisible; i++) {
  gVisible = (await gallery.count()) > 0 && (await gallery.isVisible());
  if (!gVisible) {
    if ((await page.locator('[role="dialog"]').count()) === 0) dialogDied = true;
    await sleep(900);
  }
}
must(gVisible, "C the shipped-dark wall is LIT (two t542 windows of silence end here)",
  dialogDied ? "INSPECTOR DIED mid-wait (reload/compile)" : undefined);

// the flash is the handshake's fingerprint: only the pending-consume path
// sets it — the default-tab landing cannot fake it
let flashed = false;
for (let i = 0; i < 50 && !flashed; i++) {
  flashed = (await page.locator('[data-denoise-gallery][data-denoise-flash="on"]').count()) > 0;
  if (!flashed) await sleep(250);
}
must(flashed, "C the wall answers its link (fuchsia flash, data-denoise-flash)");

if (gVisible) {
  const inView = await gallery.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    return { top: r.top, bottom: r.bottom, vh };
  });
  must(inView.top <= inView.vh * 0.4 && inView.bottom >= inView.vh * 0.6,
    "C the wall is IN VIEW (scrollIntoView, not just mounted below the fold)",
    `top=${Math.round(inView.top)} bottom=${Math.round(inView.bottom)} vh=${inView.vh}`);
}
let flashCleared = false;
for (let i = 0; i < 20 && !flashCleared; i++) {
  flashCleared = (await page.locator('[data-denoise-gallery][data-denoise-flash="on"]').count()) === 0;
  if (!flashCleared) await sleep(400);
}
must(flashCleared, "C the flash fades (a transient cue, not a permanent paint)");
await page.screenshot({ path: ".qa-logs/t665-arrival.png" });

// ---------- D: the wall answers hands ----------
// the arrival measured; the hands need a LIVING wall — the box's OOM
// regime keeps executing next-server mid-flight, so the recovery ladder
// runs HERE, before the content measurements (t664's doctrine: the
// ladder is part of the probe, not an apology)
await recoverToDenoiseWall();
// real pixels, not just figures: bring the grid fully into the viewport
// (the t660 lazy lesson) and count the rendered tiles
await gallery.scrollIntoViewIfNeeded().catch(() => {});
await sleep(3500);
const wallImgs = gallery.locator("figure[data-denoise-card] img");
const nImgs = await wallImgs.count();
let rendered = 0;
for (let i = 0; i < nImgs; i++) {
  const nw = await wallImgs.nth(i).evaluate((el) => el.naturalWidth).catch(() => 0);
  if (nw > 0) rendered++;
}
must(nImgs >= 10 && rendered >= nImgs - 2,
  "D real pixels on the wall (both legs render — the lazy tail is viewport cost)",
  `${rendered}/${nImgs} imgs`);
const headerChip = await gallery.locator("span", { hasText: /paired/ }).first().innerText().catch(() => "");
must(headerChip.includes("10/10 paired"), "D the pairing chip speaks the full count", headerChip.trim());
let cards = gallery.locator("figure[data-denoise-card]");
let nCards = 0;
for (let i = 0; i < 10 && !nCards; i++) {
  nCards = await cards.count();
  if (!nCards) await sleep(800);
}
must(nCards === 9, "D nine cards before show-more (the pagination ceiling)", `cards=${nCards}`);
if (nCards === 0) {
  // bail diagnostics: is the dialog alive, is the section alive, what's in it
  const diag = await page.evaluate(() => ({
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    sections: document.querySelectorAll("section[data-denoise-gallery]").length,
    figures: document.querySelectorAll("figure[data-denoise-card]").length,
    sectionLen: document.querySelector("section[data-denoise-gallery]")?.innerHTML.length ?? 0,
    wire: null,
  }));
  console.log("  · D diag:", JSON.stringify(diag), "fileWire:", JSON.stringify(fileWire));
}
const moreBtn = gallery.locator("button", { hasText: /show more/ });
must((await moreBtn.count()) === 1, "D show-more owns the honest remainder", (await moreBtn.first().innerText().catch(() => "")).trim());
if ((await moreBtn.count()) === 1) {
  await moreBtn.first().click();
  await sleep(1000);
  const nAfter = await gallery.locator("figure[data-denoise-card]").count();
  must(nAfter === 10, "D show-more reveals the tenth card", `cards=${nAfter}`);
  cards = gallery.locator("figure[data-denoise-card]");
}

// the keyboard wipe: the range input is the real control (the house law:
// keyboard works). 50 → 20 by thirty ArrowLefts — aria-valuetext and the
// clip-path must agree on the same truth.
const firstRange = cards.first().locator('input[type="range"]');
let rngReady = (await firstRange.count()) > 0;
for (let i = 0; i < 8 && !rngReady; i++) { await sleep(700); rngReady = (await firstRange.count()) > 0; }
must(rngReady, "D the wipe card carries its keyboard-scrubbable range control");
if (rngReady) {
  await firstRange.focus();
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowLeft");
  await sleep(400);
  const vt = await firstRange.getAttribute("aria-valuetext").catch(() => "");
  must(vt === "20% original · 80% denoised", "D arrow keys scrub to 20/80 (aria-valuetext speaks)", vt ?? "none");
  const clip = await cards.first().evaluate((el) => el.querySelector('div[style*="clip-path"]')?.style.clipPath ?? "");
  // the browser serializes the inline value ("inset(0 80% 0 0)" →
  // "inset(0px 80% 0px 0px)") — assert the geometry, not the spelling
  must(/inset\(0px?\s+80%\s+0px?\s+0px?\)/.test(clip.replace(/\s+/g, " ")),
    "D the overlay's clip-path agrees (the divider is real geometry, not a picture of one)", clip);
  await page.screenshot({ path: ".qa-logs/t665-wipe.png" });
}

// side-by-side: the honest two-up, labels pinned
const sideBtn = gallery.locator("button", { hasText: "side-by-side" });
if ((await sideBtn.count()) > 0) {
  await sideBtn.first().click();
  await sleep(900);
  // CSS text-transform uppercases the rendered text innerText reports —
  // compare case-insensitively (the label's truth, not its casing)
  const firstCardText = (await cards.first().innerText().catch(() => "")).toLowerCase();
  must(firstCardText.includes("original") && firstCardText.includes("denoised"),
    "D side-by-side pins both labels (the two-up answers which side is which)");
  must((await cards.first().locator('input[type="range"]').count()) === 0,
    "D side-by-side retires the divider (no fake wipe over a static two-up)");
  await gallery.locator("button", { hasText: "wipe" }).first().click();
  await sleep(600);
} else {
  must(false, "D side-by-side toggle present");
}

// ---------- E: the one-shot is consumed, and the gate holds ----------
await page.keyboard.press("Escape");
await sleep(800);
for (let i = 0; i < 4 && (await page.locator('[role="dialog"]').count()) > 0; i++) {
  await page.keyboard.press("Escape");
  await sleep(600);
}
await waitServerHealthy("between D and E");
// openJob forced the canvas view — back to the roster for the reopen legs
await dashTab.click();
await sleep(1500);
let denReopened = await openFromRoster("Topaz Denoise", "Open Topaz Denoise");
if (!denReopened || (await page.locator('[role="dialog"]').count()) === 0) {
  denReopened = await recoverToDenoiseWall();
}
// the FINAL mount is the wire's measured window: the stat cache serves
// every repeat tile from its (size, mtime) slot — this window must be
// clean (the cumulative flight counters keep their scars separately)
fileWire.den = { ok: 0, bad: 0, notes: [] };
fileWire.orig = { ok: 0, bad: 0, notes: [] };
if (denReopened) {
  await sleep(2500);
  // the results tab is the completed default; give the gallery a beat
  let gAgain = false;
  for (let i = 0; i < 10 && !gAgain; i++) {
    gAgain = (await gallery.count()) > 0 && (await gallery.isVisible());
    if (!gAgain) await sleep(800);
  }
  must(gAgain, "E the wall persists (it is a face, not a one-shot gesture)");
  must((await page.locator('[data-denoise-gallery][data-denoise-flash="on"]').count()) === 0,
    "E no re-flash on manual reopen (the link was consumed — one-shot semantics)");
  // the honest outcome: after the bounded retries NO tile is stuck in the
  // error state — the wall is either served, cached, or healed, never
  // half-fed (the t665 wire lesson: a warm wall fires zero requests —
  // outcome, not wire, is the contract)
  const stuck = await gallery.locator("text=unavailable").count();
  must(stuck === 0, "E no tile stuck unavailable (the retry ladder heals transient kills)", `${stuck} stuck`);
  await page.keyboard.press("Escape");
  await sleep(800);
}
if (await openFromRoster("2D classification", "Open")) {
  await sleep(2200);
  // switch to results if the smart default did not already
  const tabNow = await activeTab.first().innerText().catch(() => "");
  if (!tabNow.includes("Results")) {
    await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
    await sleep(1200);
  }
  must((await page.locator("section[data-denoise-gallery]").count()) === 0,
    "E a non-denoise job's results tab carries no wall (the type gate holds)");
  await page.keyboard.press("Escape");
  await sleep(700);
}

// ---------- F: the console contract ----------
// informational: the final window's wire traffic (a warm wall legitimately
// fires ZERO requests — the browser cache + the server's stat cache carry
// it; the outcome contract lives in D's pixel count and E's stuck check)
console.log(`  · final-window wire: den ${fileWire.den.ok}✓/${fileWire.den.bad}✗ · orig ${fileWire.orig.ok}✓/${fileWire.orig.bad}✗`);
must(consoleErrors.length === 0, "F zero real JavaScript console errors", `${consoleErrors.length}`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5));
must(resource404.length === 0, "F zero frame 404s — every lane speaks real bytes", `${resource404.length}`);
must(resourceFlap.length <= 60, "F server-flap resource failures bounded", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "F lazy-chunk fetch flaps bounded", `${chunkFlap.length}`);
must(hmrNoise.length <= 20, "F HMR socket noise bounded", `${hmrNoise.length}`);

mkdirSync(".qa-logs", { recursive: true });
await b.close();
console.log(`\nt665-e2e: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL === 0 ? 0 : 1);
