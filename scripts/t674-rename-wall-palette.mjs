// t674 — the management mouth grows on the aggregate faces. t669 put the
// delete on the wall card, t670 put it on the palette row, t671 taught the
// embed's own bookmark list to broadcast, t673 anchored the embed's rename.
// What NO aggregate face could do until now: RENAME. The wall card and the
// palette row both speak the embed's rename grammar (Enter saves · Esc
// cancels · empty/untouched silent · dupe warns but commits) over the
// delete contract's read-modify-write (fresh GET at commit time → map →
// PUT → broadcast → own clock renames in place). The wall's pencil is the
// X's floating-chip sibling at right-9; the palette's slot grows into a
// TRIO (Mountain fades, pencil + X sit beneath). Rename preserves the id —
// a renamed view still jumps, still restores, under its new name.
//
// Probe contract:
//   S  setup mounts two drill seats (adopt-or-create) — 3 seeds untouched.
//   A  the wall's rename: pencil hides at rest / reveals on hover (with
//      the X — the wall's floating-chip pair), the chevron yields, the
//      edit shell replaces the jump mouth, Enter commits, toast + card +
//      server agree. 📸 wall-rename.
//   B  the palette's rename: the CLOSED palette already shows A's new name
//      (cross-sync ① — the broadcast reached the listening cache), the
//      trio slot swaps, the row edits in place, Enter commits. 📸 palette.
//      Reopen inside the TTL window shows the truth at zero wire cost.
//   C  the wall heard the PALETTE's rename (cross-sync ②) without reload.
//   D  the honest failure: an aborted PUT keeps the old name and says so;
//      after the abort lifts, the same pencil succeeds (one strike).
//   E  the silent exits: an empty draft and an Escaped draft change
//      nothing, say nothing — and Esc cancels the EDIT, not the dialog.
//   F  the dupe warning: renaming onto an existing sibling's name warns
//      amber AND commits (a nudge, not a veto).
//   G  rename preserved identity: the renamed view jumps via the palette
//      and restores UNDER ITS NEW NAME (id stable through every rename).
//   H  the world intact (3 seeds, original names) + teardown (drills
//      removed) + noise buckets.
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor(); // t707 — saved-state routes reject headerless clients (the door's language)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const DRILL_ID = "t674drill";
const DRILL2_ID = "t674drill2";
const DRILL_NAME = "Probe drill alpha";
const DRILL2_NAME = "Probe drill beta";
const NAME_A2 = "Probe drill alpha II";   // wall rename target (A)
const NAME_B2 = "Probe drill beta II";    // palette rename target (B)
const NAME_B3 = "Probe drill beta III";   // abort drill target (D)
const NAME_BF = "Probe drill beta final"; // dupe-cleanup target (F)
const PENDING_KEY = "cryoflow:pending-view";

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

// ---------- setup: two drill seats (adopt-or-create, API lane) — one
// sacrifices to the wall's rename (A/G), one to the palette's (B/D/E/F);
// the three seeded views are the world-intact witnesses (H) ----------
mkdirSync(".qa-logs", { recursive: true });
const mkSeat = (id, name) => ({
  id,
  name,
  ts: Date.now(),
  snapshot: {
    mode: "iso",
    fov: 0.876,
    position: [42.7, 38.1, 95.3],
    up: [0, 1, 0],
    target: [0, 0, 0],
    radius: 63.2,
    radiusMax: 110.4,
    fog: 0,
    clipFar: 0,
    minNear: 0,
    minFar: 0,
  },
  view: {
    sigma: 2.5,
    sign: 1,
    slice: { on: true, axis: "Z", pos: 0.35 },
    clip: { on: false, x: 1, y: 1, z: 1, invert: false },
  },
});
const seed = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json());
const seeded = (seed.bookmarks ?? []).filter((x) => x.id !== DRILL_ID && x.id !== DRILL2_ID);
const put = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: [...seeded, mkSeat(DRILL_ID, DRILL_NAME), mkSeat(DRILL2_ID, DRILL2_NAME)] }),
});
if (!put.ok) { console.error(`setup PUT failed: ${put.status}`); process.exit(1); }
const verify = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json());
console.log(`· setup: two drill seats mounted (${(verify.bookmarks ?? []).length} total, ${seeded.length} seeded)`);

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
const hmrNoise = [];
const resourceFlap = [];
const resource404 = [];
const chunkFlap = [];
const molstarNoise = [];
// the D-leg route abort's own echo: the probe's instrument speaks in the
// console too (net::ERR_FAILED is the aborted PUT's voice, not the
// product's) — a bucket of its own, so the honest-failure drill doesn't
// read as a console crime
const routeAbortEcho = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("webpack-hmr") && t.includes("ERR_CONNECTION_REFUSED")) { hmrNoise.push(t); return; }
  if (t.includes("olstar] init failed")) { molstarNoise.push(t); return; }
  if (t.startsWith("Failed to load chunk") && t.includes("async loader")) { chunkFlap.push(t); return; }
  if (t.startsWith("Failed to load resource")) {
    if (/status of 404/.test(t)) resource404.push(t);
    else if (/net::ERR_FAILED/.test(t)) routeAbortEcho.push(t);
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => {
  if (/Failed to load chunk/.test(e.message)) { chunkFlap.push(e.message); return; }
  if (e.message === "unreachable") { molstarNoise.push(e.message); return; }
  consoleErrors.push(`pageerror: ${e.message}`);
});

// the product's OWN lifecycle lines — the honest readiness milestone
const molLines = [];
page.on("console", (m) => {
  if (/olstar\]/.test(m.text())) molLines.push(m.text().slice(0, 120));
});
const waitViewerReady = (timeoutMs = 150000) => pollUntil(async () => {
  if (molLines.some((l) => l.includes("init failed"))) return "failed";
  if (molLines.some((l) => l.includes("] ready"))) return "ready";
  return null;
}, timeoutMs);

// toast recorder — REINSTALLABLE (t668's second lesson, t670's hardened
// form: install before EVERY judgment click; a regex that follows the
// toasts' titles, not the world's literals — t673's third lesson)
const waitShell = () =>
  pollUntil(async () =>
    ((await page.locator('[role="tab"]').count()) > 0 &&
      (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);
const TOAST_RE = /view renamed|already exists|could not|restored|not found|deleted/i;
const installToastObserver = () =>
  page.evaluate((src) => {
    const re = new RegExp(src, "i");
    const w = window;
    w.__t674Toasts = [];
    const t0 = Date.now();
    if (w.__t674Mo) w.__t674Mo.disconnect();
    w.__t674Mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const t = n.textContent || "";
          if (re.test(t)) {
            w.__t674Toasts.push({ at: Date.now() - t0, text: t.replace(/\s+/g, " ").slice(0, 200) });
          }
        }
      }
    });
    w.__t674Mo.observe(document.body, { childList: true, subtree: true });
    return "observer-on";
  }, TOAST_RE.source);
const readToasts = () => page.evaluate(() => (window.__t674Toasts ?? []).map((t) => t.text))
  .catch(() => []);

const MIRROR_KEY = `cryoflow.mol-camera-bookmarks:${REFINE3D_ID}`;
const seedMirror = (list) =>
  page.evaluate(([k, v]) => { localStorage.setItem(k, v); }, [MIRROR_KEY, JSON.stringify(list)]).catch(() => {});
const fetchSeats = () =>
  fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);

// the OOM ladder's ground floor (t667's version)
const waitServerHealthy = (timeoutMs = 60000) => pollUntil(async () => {
  const ok = await page.evaluate(async () => {
    const t0 = Date.now();
    try {
      const r = await fetch("/api/jobs", { cache: "no-store" });
      return r.ok && Date.now() - t0 < 2000;
    } catch { return false; }
  });
  return ok || null;
});

// the palette's own wire — the TTL clock's witness (the reopen counter)
const galleryFetches = { n: 0 };
page.on("request", (r) => {
  if (r.url().includes("/api/views/gallery")) galleryFetches.n++;
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await waitShell();
await installToastObserver();

const ensureDashboard = async () => {
  await waitShell();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1500);
};
await ensureDashboard();

const openPalette = async () => {
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
};
const savedRows = () => page.locator("[cmdk-item]", { hasText: "Saved view — " });
// the A-leg opener's double-try ring (t670's lesson: Escape's dismissal
// and Control+k's toggle can race — a single shot would measure that
// race, not the rows)
const openPaletteWithRows = async (n) => {
  for (let i = 0; i < 2; i++) {
    await openPalette();
    await sleep(1200);
    if ((await savedRows().count()) === n) return true;
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(800);
  }
  return false;
};

// the viewer dance (t662/t668/t669/t670 verbatim): Results → enlarge → View in 3D
const runDance = async () => {
  molLines.length = 0; // each mount speaks its OWN lifecycle
  await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
  await sleep(1500);
  const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
  const enlUp = await pollUntil(async () => (await enlarge.count()) > 0 || null, 25000);
  if (!enlUp) return "no-enlarge";
  await enlarge.scrollIntoViewIfNeeded().catch(() => {});
  await enlarge.click().catch(() => {});
  await sleep(1200);
  const v3d = page.locator("button", { hasText: "View in 3D" }).first();
  if (!(await v3d.count())) return "no-view3d";
  await v3d.click().catch(() => {});
  return (await waitViewerReady()) || "no-lifecycle";
};

const wall = page.locator('section[aria-label="Saved 3D views across all projects"]');

// ---------- A: the wall's rename face ----------
await ensureDashboard();
await installToastObserver();
const wallCards = () => wall.locator("[data-saved-view-card]");
const wallUp = await pollUntil(async () =>
  (await wall.count()) === 1 && (await wallCards().count()) === 5 || null, 15000);
must(!!wallUp, "S/A the wall stands with five cards (three seeds + two drills)", `${await wallCards().count()}`);
const drillCard = wall.locator(`[data-saved-view-card="${DRILL_ID}"]`).first();
const pencil = drillCard.locator(`button[data-saved-view-rename="${DRILL_ID}"]`);
must((await pencil.count()) === 1, "A the wall card carries its rename pencil");
const pRest = await pencil.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(pRest === "0", "A the pencil hides at rest (hover-reveal contract)", `opacity ${pRest}`);
await drillCard.hover().catch(() => {});
await sleep(500);
const pHover = await pencil.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(pHover !== "0" && pHover !== "?", "A the pencil reveals on hover", `opacity ${pHover}`);
const xw = drillCard.locator(`button[aria-label^="Delete saved view"]`).first();
const xHover = await xw.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(xHover !== "0" && xHover !== "?", "A the X reveals beside it (the floating-chip pair)", `opacity ${xHover}`);
const chev = drillCard.locator("button").first().locator("svg").last();
const chevOp = await chev.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(chevOp === "0", "A the chevron yields the tail on hover (swap, not overlap)", `opacity ${chevOp}`);
await pencil.click();
const wallInput = drillCard.locator(`input[data-saved-view-rename-input="${DRILL_ID}"]`);
const inputUp = await pollUntil(async () => (await wallInput.count()) === 1 || null, 8000);
must(!!inputUp, "A the edit shell replaces the jump mouth (the card becomes its input)");
const draft0 = await wallInput.inputValue().catch(() => "");
must(draft0 === DRILL_NAME, "A the draft starts as the current name", `value "${draft0}"`);
await page.screenshot({ path: ".qa-logs/t674-wall-rename.png" });
await wallInput.fill(NAME_A2);
await page.keyboard.press("Enter");
const aToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /view renamed/i.test(t) && t.includes(NAME_A2)) || null;
}, 10000);
must(!!aToast, "A the rename toast reports the swap", aToast ?? "none");
const cardRenamed = await pollUntil(async () =>
  (await wall.locator(`[data-saved-view-card="${DRILL_ID}"]`, { hasText: NAME_A2 }).count()) === 1 || null, 10000);
must(!!cardRenamed, "A the card shows the new name in place");
const seatsA = await fetchSeats();
must(seatsA.find((x) => x.id === DRILL_ID)?.name === NAME_A2,
  "A the server holds the new name", seatsA.find((x) => x.id === DRILL_ID)?.name ?? "missing");

// ---------- B: the palette's rename face + cross-sync ① ----------
await installToastObserver();
const openedB = await openPaletteWithRows(5);
must(openedB, "B the palette speaks five rows", `${await savedRows().count()}`);
const drill1Row = page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).first();
const crossSync1 = await drill1Row.locator(`text=${NAME_A2}`).count();
must(crossSync1 >= 1, "B the CLOSED palette already shows the wall's new name (cross-sync ①: the broadcast reached the listening cache)", `${crossSync1}`);
const drill2Row = page.locator(`[data-palette-savedview-row="${DRILL2_ID}"]`).first();
const pPencil = drill2Row.locator(`button[data-palette-savedview-rename="${DRILL2_ID}"]`);
must((await pPencil.count()) === 1, "B the row carries its rename pencil");
const pPRest = await pPencil.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(pPRest === "0", "B the pencil hides at rest", `opacity ${pPRest}`);
await drill2Row.hover().catch(() => {});
await sleep(500);
const pPHover = await pPencil.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(pPHover !== "0" && pPHover !== "?", "B the pencil reveals on hover", `opacity ${pPHover}`);
const mountain = drill2Row.locator("span.relative > svg").first();
const mOp = await mountain.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(mOp === "0", "B the Mountain tail yields the trio slot (swap, not overlap)", `opacity ${mOp}`);
await pPencil.click();
const rowInput = drill2Row.locator(`input[data-palette-savedview-rename-input="${DRILL2_ID}"]`);
const rowInputUp = await pollUntil(async () => (await rowInput.count()) === 1 || null, 8000);
must(!!rowInputUp, "B the row's name becomes the input (the prefix dissolves with it)");
const draftB = await rowInput.inputValue().catch(() => "");
must(draftB === DRILL2_NAME, "B the draft starts as the current name", `value "${draftB}"`);
await rowInput.fill(NAME_B2);
await page.screenshot({ path: ".qa-logs/t674-palette-rename.png" });
await page.keyboard.press("Enter");
const bToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /view renamed/i.test(t) && t.includes(NAME_B2)) || null;
}, 10000);
must(!!bToast, "B the rename toast reports the swap", bToast ?? "none");
const rowRenamed = await pollUntil(async () =>
  (await drill2Row.locator(`text=${NAME_B2}`).count()) >= 1 || null, 10000);
must(!!rowRenamed, "B the row shows the new name in place (no close, no reload)");
const seatsB = await fetchSeats();
must(seatsB.find((x) => x.id === DRILL2_ID)?.name === NAME_B2,
  "B the server holds the new name", seatsB.find((x) => x.id === DRILL2_ID)?.name ?? "missing");

// the reopen inside the TTL window: the cache renamed IN PLACE — a reopen
// rides the cache at zero wire cost when the TTL still holds; if the
// clock ran out mid-probe, the refetch answers the same truth (both
// paths land on the new name; the wire line is the shape it took)
galleryFetches.n = 0;
await page.keyboard.press("Escape").catch(() => {});
await sleep(800);
let reopenB = false;
for (let i = 0; i < 2 && !reopenB; i++) {
  await openPalette();
  await sleep(1500);
  if ((await savedRows().count()) === 5 &&
      (await page.locator("[cmdk-item]", { hasText: NAME_B2 }).count()) >= 1) reopenB = true;
  else { await page.keyboard.press("Escape").catch(() => {}); await sleep(800); }
}
must(reopenB, "B the reopened palette shows the renamed truth (no ghost of the old name)", `${await savedRows().count()} rows, wire=${galleryFetches.n}`);
if (galleryFetches.n === 0) console.log("  · wire: zero gallery refetches — the in-place cache rename answered (the double clock's owned half)");
else console.log(`  · wire: ${galleryFetches.n} gallery refetch(es) — TTL ran out mid-probe, the refetch confirms the rename server-side (honest path B)`);
await page.keyboard.press("Escape").catch(() => {});
await sleep(800);

// ---------- C: the wall heard the PALETTE's rename (cross-sync ②) ----------
await ensureDashboard();
const wallSync2 = await pollUntil(async () =>
  (await wall.count()) === 1 &&
  (await wall.locator(`[data-saved-view-card="${DRILL2_ID}"]`, { hasText: NAME_B2 }).count()) === 1 || null, 15000);
must(!!wallSync2, "C the dashboard wall already shows the palette's new name (cross-sync ②: no reload, no job mutation)", `${await wallCards().count()} cards`);

// ---------- D: the honest failure — an aborted PUT keeps the old name ----------
await waitShell();
await openPaletteWithRows(5);
await installToastObserver();
await page.route("**/camera-bookmarks", (route) => {
  if (route.request().method() === "PUT") route.abort("failed");
  else route.continue().catch(() => {});
});
const dRow = page.locator(`[data-palette-savedview-row="${DRILL2_ID}"]`).first();
const dPencil = dRow.locator(`button[data-palette-savedview-rename="${DRILL2_ID}"]`);
await dRow.hover().catch(() => {});
await sleep(400);
await dPencil.click();
const dInput = dRow.locator(`input[data-palette-savedview-rename-input="${DRILL2_ID}"]`);
await pollUntil(async () => (await dInput.count()) === 1 || null, 8000);
await dInput.fill(NAME_B3);
await page.keyboard.press("Enter");
await sleep(1500);
const dFailToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /could not rename/i.test(t)) || null;
}, 10000);
must(!!dFailToast, "D the failed rename says so (no silent swallow)", dFailToast ?? "none");
const dRowKeeps = await dRow.locator(`text=${NAME_B2}`).count();
must(dRowKeeps >= 1, "D the row keeps its old name", `matches ${dRowKeeps}`);
const seatsD = await fetchSeats();
must(seatsD.find((x) => x.id === DRILL2_ID)?.name === NAME_B2,
  "D the server still holds the old name — the abort was the ONLY lie", seatsD.find((x) => x.id === DRILL2_ID)?.name);
await page.unroute("**/camera-bookmarks");
// the retry is one strike — the same pencil, no reload, no re-arm
await installToastObserver();
await dRow.hover().catch(() => {});
await sleep(400);
await dPencil.click();
const dInput2 = dRow.locator(`input[data-palette-savedview-rename-input="${DRILL2_ID}"]`);
await pollUntil(async () => (await dInput2.count()) === 1 || null, 8000);
await dInput2.fill(NAME_B3);
await page.keyboard.press("Enter");
const dRetry = await pollUntil(async () => {
  const seats = await fetchSeats();
  return seats.find((x) => x.id === DRILL2_ID)?.name === NAME_B3 || null;
}, 15000);
must(!!dRetry, "D after the abort lifts, the same pencil succeeds (one strike, no re-arm)");
const dToast2 = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /view renamed/i.test(t) && t.includes(NAME_B3)) || null;
}, 10000);
must(!!dToast2, "D the successful retry reports honestly too", dToast2 ?? "none");

// ---------- E: the silent exits — and Esc cancels the EDIT, not the dialog ----------
await installToastObserver();
const eRow = page.locator(`[data-palette-savedview-row="${DRILL2_ID}"]`).first();
const ePencil = eRow.locator(`button[data-palette-savedview-rename="${DRILL2_ID}"]`);
await eRow.hover().catch(() => {});
await sleep(400);
await ePencil.click();
const eInput = eRow.locator(`input[data-palette-savedview-rename-input="${DRILL2_ID}"]`);
await pollUntil(async () => (await eInput.count()) === 1 || null, 8000);
await eInput.fill("");
await page.keyboard.press("Enter");
await sleep(1500);
const eToasts = await readToasts();
must(eToasts.length === 0, "E the empty draft changes nothing and says nothing (an edit that never happened is not a fact worth announcing)", eToasts.join(" | ") || "silent");
must((await fetchSeats()).find((x) => x.id === DRILL2_ID)?.name === NAME_B3,
  "E the server never saw the empty draft", (await fetchSeats()).find((x) => x.id === DRILL2_ID)?.name);
await eRow.hover().catch(() => {});
await sleep(400);
await ePencil.click();
const eInput2 = eRow.locator(`input[data-palette-savedview-rename-input="${DRILL2_ID}"]`);
await pollUntil(async () => (await eInput2.count()) === 1 || null, 8000);
await eInput2.fill("Probe drill beta IV");
await page.keyboard.press("Escape");
await sleep(1200);
const eToasts2 = await readToasts();
must(eToasts2.length === 0, "E the Escaped draft changes nothing and says nothing (the cancel flag, not the commit path)", eToasts2.join(" | ") || "silent");
must((await page.locator("[cmdk-item]").count()) > 0, "E Esc canceled the EDIT, not the dialog (the input ate the Escape)", `${await page.locator("[cmdk-item]").count()} items`);
must((await fetchSeats()).find((x) => x.id === DRILL2_ID)?.name === NAME_B3,
  "E the server never saw the Escaped draft", (await fetchSeats()).find((x) => x.id === DRILL2_ID)?.name);

// ---------- F: the dupe warning — a nudge, not a veto ----------
// the dupe target is a SIBLING'S NAME — ids are not names (the first
// flight renamed onto the id string "seedview1" and the server correctly
// saw no duplicate: no bookmark is NAMED seedview1; its name is the
// world's own). Read the sibling's real name off the fresh list.
const seatsF0 = await fetchSeats();
const dupeTarget = seatsF0.find((x) => x.id === "seedview1")?.name ?? seatsF0.find((x) => x.id !== DRILL2_ID)?.name;
await installToastObserver();
const fRow = page.locator(`[data-palette-savedview-row="${DRILL2_ID}"]`).first();
const fPencil = fRow.locator(`button[data-palette-savedview-rename="${DRILL2_ID}"]`);
await fRow.hover().catch(() => {});
await sleep(400);
await fPencil.click();
const fInput = fRow.locator(`input[data-palette-savedview-rename-input="${DRILL2_ID}"]`);
await pollUntil(async () => (await fInput.count()) === 1 || null, 8000);
await fInput.fill(dupeTarget ?? "seedview1-name-unreadable");
await page.keyboard.press("Enter");
const fToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /already exists/i.test(t)) || null;
}, 10000);
must(!!fToast, "F renaming onto an existing sibling's NAME warns amber", fToast ?? "none");
const fCommitted = await pollUntil(async () =>
  (await fetchSeats()).find((x) => x.id === DRILL2_ID)?.name === dupeTarget || null, 10000);
must(!!fCommitted, "F the dupe rename still COMMITTED (a warning, not a veto)", `server name = ${dupeTarget}`);
await installToastObserver();
await fRow.hover().catch(() => {});
await sleep(400);
await fPencil.click();
const fInput2 = fRow.locator(`input[data-palette-savedview-rename-input="${DRILL2_ID}"]`);
await pollUntil(async () => (await fInput2.count()) === 1 || null, 8000);
await fInput2.fill(NAME_BF);
await page.keyboard.press("Enter");
const fCleanup = await pollUntil(async () =>
  (await fetchSeats()).find((x) => x.id === DRILL2_ID)?.name === NAME_BF || null, 15000);
must(!!fCleanup, "F the cleanup rename lands (the drill retires under a tell-apart name)", NAME_BF);

// ---------- G: rename preserved identity — the renamed view jumps & restores ----------
await installToastObserver();
const gOpen = await openPaletteWithRows(5);
must(gOpen, "G the palette opens for the identity drill", `${await savedRows().count()}`);
const gRow = page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).first();
must((await gRow.locator(`text=${NAME_A2}`).count()) >= 1, "G the renamed drill row stands under its new name", NAME_A2);
await seedMirror(await fetchSeats()); // the mirror carries the truth — a dead fetch still lands the target
await gRow.click();
await sleep(800);
must((await page.locator("[cmdk-item]").count()) === 0, "G the palette closes on jump");
const pendingRaw = await page.evaluate((k) => sessionStorage.getItem(k), PENDING_KEY).catch(() => "evaluate-lost");
let pending = null;
try { pending = JSON.parse(pendingRaw ?? "null"); } catch { /* consumed already */ }
must(!!pending && pending.jobId === REFINE3D_ID && pending.bookmarkId === DRILL_ID,
  "G the pending handshake carries the SAME id rename never touched", pendingRaw?.slice(0, 80));
await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
let dance = await runDance();
for (let attempt = 0; attempt < 3 && dance !== "ready"; attempt++) {
  console.log(`  · dance: ${dance} — ladder (health wait + reload + RE-JUMP + re-dance)`);
  await waitServerHealthy();
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitShell();
  await installToastObserver();
  await seedMirror(await fetchSeats());
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [PENDING_KEY, JSON.stringify({ jobId: REFINE3D_ID, bookmarkId: DRILL_ID })]).catch(() => {});
  await openPalette();
  await page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).first().click().catch(() => {});
  await sleep(1500);
  dance = await runDance();
}
must(dance === "ready", "G the 3D viewer is REALLY up (the renamed view's jump mouth fully alive)", dance);
const gToast = dance === "ready"
  ? await pollUntil(async () => {
      const ts = await readToasts();
      return ts.find((t) => /restored/i.test(t) && t.includes(NAME_A2)) || null;
    }, 20000)
  : null;
must(!!gToast, "G the restored toast names the NEW name (identity survived every rename)", gToast ?? "none");
await page.keyboard.press("Escape").catch(() => {});
await sleep(1000);

// ---------- H: the world intact + teardown + the console contract ----------
await waitServerHealthy();
const finalSeats = await fetchSeats();
const ids = finalSeats.map((x) => x.id);
must(ids.includes("seedview1") && ids.includes("seedview2") && ids.includes("seedview3"),
  "H the three seeded views survived every drill", ids.join(","));
const seedNamesClean = finalSeats
  .filter((x) => x.id.startsWith("seedview"))
  .every((x) => !/probe drill/i.test(x.name));
must(seedNamesClean, "H no seed view was renamed by any drill", finalSeats.filter((x) => x.id.startsWith("seedview")).map((x) => x.name).join(","));
// teardown: the drills leave no trace (API lane — the same route the
// probe's mutations rode all flight)
const teardownList = finalSeats.filter((x) => x.id !== DRILL_ID && x.id !== DRILL2_ID);
const tPut = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: teardownList }),
});
must(tPut.ok, "H the teardown PUT confirms (the drills leave no trace)");
const afterT = await fetchSeats();
must(afterT.length === 3 && !afterT.some((x) => /t674drill/.test(x.id)),
  "H the world is back to its three seeds", `${afterT.length}`);
must(consoleErrors.length === 0, "H zero real console errors (the aborted PUT's own echo lives in its bucket)", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(routeAbortEcho.length <= 5, "H the abort's echo stays a whisper (the instrument's own voice, bounded)", `${routeAbortEcho.length}`);
must(resource404.length === 0, "H zero 404s", `${resource404.length}`);
must(resourceFlap.length <= 240, "H flap within the storm-calibrated bound (dance-heavy flight: up to 4 viewer ladders; 228 observed in the OOM storm, loop signature is 1352)", `${resourceFlap.length}`);
must(hmrNoise.length <= 20, "H hmr noise within bound", `${hmrNoise.length}`);
must(chunkFlap.length <= 10, "H chunk flap within bound", `${chunkFlap.length}`);

console.log(`\n=== t674: ${PASS} pass, ${FAIL} fail ===`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
