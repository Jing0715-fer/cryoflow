// t676 — the ECLIPSE FIX: toasts leave the DismissableLayer stack.
//
// t675's autopsy pinned the "one Esc per layer" tax: every radix
// DismissableLayer shares one global stack and Escape is answered only
// by the LAST-REGISTERED layer. A toast mounts after any open dialog, so
// while a toast is alive it is topmost — the FIRST Escape dies on the
// toast (invisibly: it self-dismisses seconds later anyway) and the
// palette/dialog needs a second press. Whole-app tax: palette, viewer
// dialogs, menus — anything stacked over a fresh mutation toast.
//
// The fix (radix-toast-vendor.mjs, FORK DIFF): ToastImpl no longer wraps
// its <li> in DismissableLayer.Root — toasts are ephemeral notices, not
// modals; they leave via timer/swipe/close/focused-Esc, never via the
// arbitration stack. Escape belongs to the modal language.
//
// Legs (probe-side PUTs seed the world; mutations ride the product UI):
//   S  the wall stands with five seats (3 seeds + 2 drills)
//   A  palette deletes drill1 → toast alive → ONE Escape closes the
//      palette AND THE TOAST SURVIVES (the money shot) → a second
//      Escape (no modal open) still does not kill the toast → the
//      duration timer (5s) takes it home
//   B  wall renames drill2 → toast alive → focus the toast li + Escape
//      → the FOCUSED path still closes it (a11y preserved)
//   C  palette opens and closes with one Escape, no toast around
//   D  world intact + teardown + noise buckets
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const DRILL_ID = "t676drill";
const DRILL2_ID = "t676drill2";
const DRILL_NAME = "Probe drill eclipse";
const DRILL2_NAME = "Probe drill solstice";
const NAME_B2 = "Probe drill solstice II";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(300);
  }
};

// ---------- setup: two drill seats (adopt-or-create, API lane) ----------
mkdirSync(".qa-logs", { recursive: true });
const mkSeat = (id, name) => ({
  id, name, ts: Date.now(),
  snapshot: {
    mode: "iso", fov: 0.876, position: [42.7, 38.1, 95.3], up: [0, 1, 0],
    target: [0, 0, 0], radius: 63.2, radiusMax: 110.4, fog: 0, clipFar: 0, minNear: 0, minFar: 0,
  },
  view: { sigma: 2.5, sign: 1, slice: { on: true, axis: "Z", pos: 0.35 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
});
const fetchSeats = () =>
  fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);
const cur0 = await fetchSeats();
// the three canonical seeds BY ID — everything else is swept below
const seeds = ["seedview1", "seedview2", "seedview3"].map((id) => cur0.find((x) => x.id === id));
if (seeds.some((s) => !s)) { console.error(`setup: canonical seed missing (${seeds.map((s) => s?.id ?? "GONE").join(",")})`); process.exit(1); }
const put = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({
    bookmarks: [...seeds, mkSeat(DRILL_ID, DRILL_NAME), mkSeat(DRILL2_ID, DRILL2_NAME)],
  }),
});
if (!put.ok) { console.error(`setup PUT failed: ${put.status}`); process.exit(1); }
const verify = await fetchSeats();
console.log(`· setup: two drill seats mounted (${verify.length} total, ${seeds.length} seeds intact)`);

// ---------- browser + instruments (t675's grammar) ----------
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [], hmrNoise = [], resourceFlap = [], resource404 = [], chunkFlap = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
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
page.on("pageerror", (e) => {
  if (/Failed to load chunk/.test(e.message)) { chunkFlap.push(e.message); return; }
  consoleErrors.push(`pageerror: ${e.message}`);
});
const waitShell = () => pollUntil(async () =>
  ((await page.locator('[role="tab"]').count()) > 0 &&
    (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);

const TOAST_RE = /view renamed|already exists|view saved|restored|not found|deleted|could not/i;
const installToastObserver = () =>
  page.evaluate((src) => {
    const re = new RegExp(src, "i");
    const w = window;
    w.__t676Toasts = [];
    const t0 = Date.now();
    if (w.__t676Mo) w.__t676Mo.disconnect();
    w.__t676Mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const t = n.textContent || "";
          if (re.test(t)) w.__t676Toasts.push({ at: Date.now() - t0, text: t.replace(/\s+/g, " ").slice(0, 200) });
        }
      }
    });
    w.__t676Mo.observe(document.body, { childList: true, subtree: true });
    return "observer-on";
  }, TOAST_RE.source);
const readToasts = () => page.evaluate(() => (window.__t676Toasts ?? []).map((t) => t.text)).catch(() => []);

// the LIVE toast witness: the viewport ol's open li — is a toast standing
// in the DOM right now (not "did one ever appear")?
const liveToast = () => page.evaluate(() => {
  const lis = [...document.querySelectorAll("ol > li[data-state='open']")];
  return lis.map((li) => (li.textContent || "").replace(/\s+/g, " ").slice(0, 120));
}).catch(() => []);
const liveToastMatching = async (re) => (await liveToast()).find((t) => re.test(t)) || null;

const openPalette = async () => {
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
};
const savedRows = () => page.locator("[cmdk-item]", { hasText: "Saved view — " });
// ONE Escape must close the palette now — press, poll, and FAIL if a
// second press is ever needed (the old press-poll-press grammar is the
// thing this probe exists to retire)
const closePaletteOneEsc = async (label) => {
  await page.keyboard.press("Escape").catch(() => {});
  const closed = await pollUntil(async () => (await page.locator("[cmdk-item]").count()) === 0 || null, 6000);
  must(!!closed, `${label} ONE Escape closes the palette (the eclipse is broken)`,
    closed ? "" : `still ${(await page.locator("[cmdk-item]").count())} cmdk items after 6s`);
  await sleep(400);
  return closed;
};

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await waitShell();
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await sleep(1500);

// ---------- S: the wall stands with five seats ----------
const wall = page.locator('section[aria-label="Saved 3D views across all projects"]');
await pollUntil(async () => (await wall.locator("[data-saved-view-card]").count()) >= 5 || null, 15000);
must((await wall.locator("[data-saved-view-card]").count()) === 5,
  "S the wall stands with five seats (3 seeds + 2 drills)", `${await wall.locator("[data-saved-view-card]").count()} cards`);

// ---------- A: palette delete → toast survives TWO Escapes → timer takes it ----------
await installToastObserver();
await openPalette();
await pollUntil(async () => (await savedRows().count()) === 5 || null, 12000);
must((await savedRows().count()) === 5, "A the palette speaks five rows", `${await savedRows().count()} rows`);
const d1row = page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).first();
await d1row.hover().catch(() => {});
await sleep(400);
await d1row.locator(`button[data-palette-savedview-delete="${DRILL_ID}"]`).click();
const aToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /deleted/i.test(t) && t.includes(DRILL_NAME)) || null;
}, 10000);
must(!!aToast, "A the palette's delete toast speaks", aToast ?? "none");
await pollUntil(async () => (await savedRows().count()) === 4 || null, 8000);
must((await savedRows().count()) === 4, "A the row shrank in place", `${await savedRows().count()} rows`);

// THE MONEY SHOT: one Escape, palette closes, the toast STAYS STANDING.
await closePaletteOneEsc("A");
const survived1 = await pollUntil(async () => liveToastMatching(new RegExp(`deleted.*${DRILL_NAME}|${DRILL_NAME}.*deleted`, "i")) || null, 4000);
must(!!survived1, "A the toast SURVIVES the palette's Escape (no more eclipse)",
  survived1 ?? "toast was eaten — eclipse still standing");
await page.screenshot({ path: ".qa-logs/t676-toast-survives-esc.png" });

// the second Escape (no modal open anywhere): still not the toast's killer
await page.keyboard.press("Escape").catch(() => {});
await sleep(1200);
const survived2 = await liveToastMatching(/deleted/i);
must(!!survived2, "A a second Escape with no modal open does not kill the toast either",
  survived2 ?? "toast eaten by the bare Escape");
// and the timer (5s from birth) takes it home — the toast is not immortal
const gone = await pollUntil(async () => (await liveToast()).length === 0 || null, 9000);
must(!!gone, "A the duration timer takes the toast home (not immortal)", gone ? "" : "toast still standing after 9s");

// server-side truth: the delete landed
const seatsA = await fetchSeats();
must(!seatsA.some((x) => x.id === DRILL_ID), "A the server holds no drill1 (the delete was real)", `${seatsA.length} seats`);

// ---------- B: the FOCUSED toast Escape path is preserved ----------
await installToastObserver();
const drill2Card = wall.locator(`[data-saved-view-card="${DRILL2_ID}"]`).first();
await drill2Card.scrollIntoViewIfNeeded().catch(() => {});
await drill2Card.hover().catch(() => {});
await sleep(400);
const pencil = drill2Card.locator(`button[data-saved-view-rename="${DRILL2_ID}"]`);
await pollUntil(async () => (await pencil.count()) === 1 || null, 6000);
await pencil.click().catch(() => {});
const wallInput = drill2Card.locator(`input[data-saved-view-rename-input="${DRILL2_ID}"]`);
await pollUntil(async () => (await wallInput.count()) === 1 || null, 8000);
await wallInput.fill(NAME_B2);
await page.keyboard.press("Enter");
const bToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /view renamed/i.test(t) && t.includes(NAME_B2)) || null;
}, 10000);
must(!!bToast, "B the wall's rename toast speaks", bToast ?? "none");
// the rename machinery itself is intact under the fork
const renamed = await pollUntil(async () =>
  (await wall.locator(`[data-saved-view-card="${DRILL2_ID}"]`, { hasText: NAME_B2 }).count()) === 1 || null, 10000);
must(!!renamed, "B the wall card carries the new name", renamed ? "" : "card never showed the new name");
// now the a11y contract: focus the standing toast and Escape closes IT
const focused = await page.evaluate(() => {
  const li = document.querySelector("ol > li[data-state='open']");
  if (!li) return false;
  li.focus();
  return document.activeElement === li;
});
must(!!focused, "B the toast li is focusable (tabIndex 0, the radix contract)", focused ? "" : "focus refused");
await page.keyboard.press("Escape").catch(() => {});
const bGone = await pollUntil(async () => (await liveToast()).length === 0 || null, 4000);
must(!!bGone, "B Escape on a FOCUSED toast still closes it (the a11y path survived the fork)", bGone ? "" : "focused toast ignored Escape");

// ---------- C: one Escape, no toast, the palette opens and closes clean ----------
await openPalette();
await pollUntil(async () => (await savedRows().count()) === 4 || null, 12000);
must((await savedRows().count()) === 4, "C the palette speaks four rows (drill2 renamed, drill1 gone)", `${await savedRows().count()} rows`);
await closePaletteOneEsc("C");

// ---------- D: world intact + teardown + noise buckets ----------
const seatsD = await fetchSeats();
must(seatsD.length === 4, "D the server holds four seats (3 seeds + renamed drill2)", `${seatsD.length}`);
must(seeds.every((s) => seatsD.some((x) => x.id === s.id && x.name === s.name)),
  "D the three seeded views keep their names (the drills came and went without a trace)");
const teard = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: seeds }),
});
must(teard.ok, "D the teardown restored the three seeds", `status ${teard.status}`);
const seatsAfterT = await fetchSeats();
must(seatsAfterT.length === 3, "D the world is back to three seats", `${seatsAfterT.length}`);

must(consoleErrors.length === 0, "D console: zero real errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(resource404.length === 0, "D console: zero 404s", `${resource404.length}`);
must(chunkFlap.length === 0, "D zero chunk flaps", `${chunkFlap.length}`);
must(resourceFlap.length <= 2, "D resource flaps bounded", `${resourceFlap.length}`);
must(hmrNoise.length <= 4, "D hmr noise bounded", `${hmrNoise.length}`);

console.log(`\n==== t676 toast-eclipse: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
