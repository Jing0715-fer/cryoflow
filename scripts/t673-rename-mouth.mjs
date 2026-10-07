// t673 — the rename mouth gets its own anchors. The bookmark's home has
// four mouths now — save (B), update (↻), delete (✕), and RENAME (✎) — and
// t671 anchored only the first three (update's thumb, save/remove
// existence). The rename contract is the richest of the four:
//
//   pencil → the row's name span swaps for an input (autoFocus, draft =
//   current name) → Enter blurs → commitRename is the ONE commit path:
//     · empty draft        → silent exit (no toast, no PUT)
//     · untouched name     → silent exit
//     · Esc                → cancel flag raised BEFORE blur → silent exit
//     · duplicate name     → WARNING toast, still commits ("Saved anyway")
//     · otherwise          → "View renamed" toast + commit
//   and commitRename rides commitBookmarks — the single mutation path whose
//   PUT-chain tail broadcasts SAVED_VIEWS_CHANGED_EVENT, so the wall and
//   the palette hear the rename without a reload.
//
// Legs:
//   S  setup: three seeds + two drill seats, world deterministic via API
//   A  happy rename (drill alpha) — toast + row + server agree
//   B  the palette hears it (in-page Ctrl+K — no reload, the listener beat
//      the 30s TTL)
//   C  the wall hears it (Esc×2 to the dashboard — same page instance)
//   D  duplicate rename (beta → alpha's new name) — warning toast, commits
//   E  Esc cancel — the flag, not the blur, decides
//   F  silent exits — empty draft and untouched draft commit nothing
//   G  world intact (seeds never touched) + teardown + console contract
//
// The observer is reinstalled before EVERY judgment click (t670's second
// lesson: the storm's HMR reload can kill it between any two assertions).

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const ALPHA = "t673drill-a";
const BETA = "t673drill-b";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail = "") => {
  if (cond) { PASS++; console.log(`  ok  ${label}${detail ? ` — ${detail}` : ""}`); }
  else { FAIL++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, timeoutMs = 20000, everyMs = 500) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await sleep(everyMs);
  }
  return null;
};

// ---------- the honest 8x8 grayscale PNG (t671's encoder, verbatim) ----------
const pngChunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crcTable = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  const crcB = Buffer.alloc(4); crcB.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crcB]);
};
const grayscalePng = (pixels, w, h) => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = pixels[y * w + x];
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
};
const seedThumb = (base) =>
  `data:image/png;base64,${grayscalePng(
    Buffer.from(Array.from({ length: 64 }, (_, i) => Math.min(255, base + i * 3))), 8, 8
  ).toString("base64")}`;
const mkSeat = (id, name, i) => ({
  id, name, ts: Date.now() - (5 - i) * 1000, thumb: seedThumb(40 + i * 40),
  snapshot: { mode: "iso", fov: 0.876, position: [42.7, 38.1, 95.3], up: [0, 1, 0], target: [0, 0, 0], radius: 63.2, radiusMax: 110.4, fog: 0, clipFar: 0, minNear: 0, minFar: 0 },
  view: { sigma: 2.5, sign: 1, slice: { on: i === 1, axis: "Z", pos: 0.35 }, clip: { on: i === 2, x: 1, y: 1, z: 1, invert: false } },
});
const seeds = ["seedview1", "seedview2", "seedview3"].map((id, i) =>
  mkSeat(id, ["Centered iso view", "Top-down slice", "Front half clipped"][i], i));
const drillA0 = mkSeat(ALPHA, "probe drill alpha", 3);
const drillB0 = mkSeat(BETA, "probe drill beta", 4);

// ---------- setup: five seats, every flight, idempotent ----------
const fetchSeats = () =>
  fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);
const putSeats = async (seats) => {
  const w = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
    method: "PUT", headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ bookmarks: seats }),
  });
  if (!w.ok) { console.error(`setup PUT failed: ${w.status}`); process.exit(1); }
};
const cur = await fetchSeats();
const wantFive = cur.length === 5 &&
  [drillA0.name, drillB0.name].every((n) => cur.some((x) => x.name === n)) &&
  seeds.every((s) => cur.some((x) => x.id === s.id && (x.thumb ?? "").startsWith("data:image")));
if (!wantFive) {
  await putSeats([...seeds, drillA0, drillB0]);
  console.log("· setup: world set to three seeds + two drills");
} else {
  console.log("· setup: world already five-seat clean");
}

// ---------- browser + instruments ----------
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [], hmrNoise = [], resourceFlap = [], resource404 = [], chunkFlap = [], molstarNoise = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("webpack-hmr") && t.includes("ERR_CONNECTION_REFUSED")) { hmrNoise.push(t); return; }
  if (t.includes("olstar] init failed")) { molstarNoise.push(t); return; }
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
  if (e.message === "unreachable") { molstarNoise.push(e.message); return; }
  consoleErrors.push(`pageerror: ${e.message}`);
});
const molLines = [];
page.on("console", (m) => { if (/olstar\]/.test(m.text())) molLines.push(m.text().slice(0, 120)); });
const waitViewerReady = (timeoutMs = 150000) => pollUntil(async () => {
  if (molLines.some((l) => l.includes("init failed"))) return "failed";
  if (molLines.some((l) => l.includes("] ready"))) return "ready";
  return null;
}, timeoutMs);
const waitShell = () => pollUntil(async () =>
  ((await page.locator('[role="tab"]').count()) > 0 &&
    (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);
const installToastObserver = () => page.evaluate(() => {
  const w = window;
  w.__t673Toasts = [];
  const t0 = Date.now();
  if (w.__t673Mo) w.__t673Mo.disconnect();
  w.__t673Mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = n.textContent || "";
        if (/renamed|already exists|saved|restored|not found|deleted|could not/i.test(t)) {
          w.__t673Toasts.push({ at: Date.now() - t0, text: t.replace(/\s+/g, " ").slice(0, 200) });
        }
      }
    }
  });
  w.__t673Mo.observe(document.body, { childList: true, subtree: true });
  return "observer-on";
});
const readToasts = () => page.evaluate(() => (window.__t673Toasts ?? []).map((t) => t.text)).catch(() => []);
const waitServerHealthy = (timeoutMs = 60000) => pollUntil(async () => {
  const ok = await page.evaluate(async () => {
    const t0 = Date.now();
    try { const r = await fetch("/api/jobs", { cache: "no-store" }); return r.ok && Date.now() - t0 < 2000; }
    catch { return false; }
  });
  return ok || null;
}, timeoutMs);

// the home's loading fingerprint (t671): "— N saved" only after the load lands
const waitBookmarksLoaded = (n) => pollUntil(async () =>
  (await page.locator(`button[aria-label="Camera view bookmarks — ${n} saved"]`).count()) > 0 || null, 20000);
// the list lives BEHIND the trigger (t671's dance: fingerprint → click open →
// the row mouths exist). One open per mount.
const openBookmarkList = async () => {
  const trig = page.locator('button[aria-label^="Camera view bookmarks"]').first();
  await trig.click().catch(() => {});
  await sleep(900);
  return (await page.locator('button[aria-label^="Rename bookmark"]').count()) > 0;
};

// the viewer dance (t662/t668/t671 verbatim)
const runDance = async () => {
  molLines.length = 0;
  const dialogUp = (await page.locator('[role="dialog"]').count()) > 0;
  if (!dialogUp) {
    const reRow = page.locator("[data-roster-row]", { hasText: "3D auto-refine" }).first();
    await pollUntil(async () => (await reRow.count()) > 0 || null, 10000);
    await reRow.locator('button[title^="Open 3D auto-refine"]').first().click().catch(() => {});
    await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
    await sleep(1500);
  }
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

// the rename gesture: pencil → input → fill → key. The row's aria-labels
// embed the CURRENT name, so every leg re-locates from the live name.
const renameVia = async (seatId, currentName, nextName, key) => {
  // self-sufficient: E's Escape bubbles past the input and can collapse the
  // list (the dialog's own Escape handlers) — re-open if the mouths are gone
  if ((await page.locator('button[aria-label^="Rename bookmark"]').count()) === 0) {
    await openBookmarkList();
  }
  const pencil = page.locator(`button[aria-label="Rename bookmark ${currentName}"]`).first();
  await pollUntil(async () => (await pencil.count()) > 0 || null, 15000);
  await pencil.click();
  // the data-testid rides the row's WRAPPER span; the input lives one level down
  const input = page.locator(`[data-testid="bm-rename-${seatId}"] input`).first();
  const up = await pollUntil(async () => (await input.count()) > 0 && (await input.inputValue().catch(() => "")) !== "" || null, 10000);
  if (!up) return "no-input";
  await input.fill(nextName);
  await input.press(key);
  await sleep(800);
  return "committed-gesture";
};

const rowText = (name) =>
  page.locator("div.group\\/bm", { hasText: name }).first().innerText().catch(() => "");

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await waitShell();
await installToastObserver();

// ---------- S: the viewer is up and the home's list carries five seats ----------
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await sleep(1500);
let dance = await runDance();
if (dance !== "ready") {
  console.log(`  · dance S: ${dance} — ladder (health wait + reload + re-dance)`);
  await waitServerHealthy();
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500); await waitShell(); await installToastObserver();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1200);
  dance = await runDance();
}
must(dance === "ready", "S the viewer is REALLY up (the product's own lifecycle line)", dance);
must(!!(await waitBookmarksLoaded(5)), "S the home's list loaded (— 5 saved: three seeds + two drills)");
must(!!(await openBookmarkList()), "S the list opened (the row mouths exist)");

// ---------- A: the happy rename ----------
await installToastObserver(); // fresh instrument for this judgment click
const gestureA = await renameVia(ALPHA, "probe drill alpha", "Probe renamed alpha", "Enter");
must(gestureA === "committed-gesture", "A the pencil swaps the row for an input and Enter commits", gestureA);
const toastA = (await readToasts()).find((t) => /view renamed/i.test(t)) || null;
must(!!toastA, "A the 'View renamed' toast lands", toastA ?? "none");
const seatsA = await fetchSeats();
must(seatsA.find((x) => x.id === ALPHA)?.name === "Probe renamed alpha",
  "A the server holds the new name", seatsA.find((x) => x.id === ALPHA)?.name ?? "missing");
const rowA = await rowText("Probe renamed alpha");
must(rowA.includes("Probe renamed alpha"), "A the row speaks the new name");
await page.screenshot({ path: path.join(REPO, ".qa-logs", "t673-rename.png") }).catch(() => {});

// ---------- B: the palette hears it (in-page, no reload) ----------
{
  await page.keyboard.press("Control+k").catch(() => {});
  const opened = await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
  if (!opened) { // the toggle race (t670): try once more
    await page.keyboard.press("Escape").catch(() => {}); await sleep(600);
    await page.keyboard.press("Control+k").catch(() => {});
    await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
  }
  const newRow = page.locator("[cmdk-item]", { hasText: "Saved view — Probe renamed alpha" });
  must((await pollUntil(async () => (await newRow.count()) > 0 || null, 15000)) !== null,
    "B the palette row speaks the new name (the listener beat the TTL)");
  const oldRow = page.locator("[cmdk-item]", { hasText: "Saved view — probe drill alpha" });
  must((await oldRow.count()) === 0, "B the old name haunts no palette row");
  await page.keyboard.press("Escape").catch(() => {}); await sleep(800);
}

// ---------- C: the wall hears it (navigate to the dashboard — same page
// instance; the Escapes close the dialog but the TAB click is what lands
// on the wall — t671's backToDashboard, verbatim gesture) ----------
{
  await page.keyboard.press("Escape").catch(() => {}); await sleep(700);
  await page.keyboard.press("Escape").catch(() => {}); await sleep(700);
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1500);
  const wall = page.locator('section[aria-label="Saved 3D views across all projects"]');
  const newCard = wall.locator("[data-saved-view-card]", { hasText: "Probe renamed alpha" });
  must((await pollUntil(async () => (await newCard.count()) > 0 || null, 20000)) !== null,
    "C the wall card speaks the new name (zero reload — the broadcast's fresh read)");
  const oldCard = wall.locator("[data-saved-view-card]", { hasText: "probe drill alpha" });
  must((await oldCard.count()) === 0, "C the old name haunts no wall card");
  must((await page.locator("[data-saved-view-card]").count()) === 5,
    "C the wall still carries five cards (rename, not delete)");
}

// ---------- D: the duplicate rename warns but commits ----------
{
  // back into the viewer for the home's own mouth
  let danceD = await runDance();
  if (danceD !== "ready") {
    await waitServerHealthy();
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    await sleep(2500); await waitShell(); await installToastObserver();
    await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
    await sleep(1200);
    danceD = await runDance();
  }
  must(danceD === "ready", "D re-entered the viewer for the home's own mouths", danceD);
  must(!!(await waitBookmarksLoaded(5)), "D the home's list loaded again (— 5 saved)");
  must(!!(await openBookmarkList()), "D the list opened again (one open per mount)");
  await installToastObserver();
  const gD = await renameVia(BETA, "probe drill beta", "Probe renamed alpha", "Enter");
  must(gD === "committed-gesture", "D the pencil accepted beta's rename gesture", gD);
  const dupeToast = (await readToasts()).find((t) => t.includes("already exists") && t.includes("Saved anyway")) || null;
  must(!!dupeToast, "D the duplicate warning toast lands (warn AND commit)", dupeToast ?? "none");
  const seatsD = await fetchSeats();
  must(seatsD.find((x) => x.id === BETA)?.name === "Probe renamed alpha",
    "D the duplicate name COMMITS (the contract warns, it does not block)",
    seatsD.find((x) => x.id === BETA)?.name ?? "missing");
}

// ---------- E: Esc cancel — the flag, not the blur, decides ----------
{
  await installToastObserver();
  const gE = await renameVia(ALPHA, "Probe renamed alpha", "Esc should discard me", "Escape");
  must(gE === "committed-gesture", "E the gesture ran (the input opened, Escape closed it)", gE);
  const seatsE = await fetchSeats();
  must(seatsE.find((x) => x.id === ALPHA)?.name === "Probe renamed alpha",
    "E the server never saw the draft (cancel flag raised before blur)");
  const toastsE = await readToasts();
  must(!toastsE.some((t) => /view renamed/i.test(t)), "E zero rename toast in the window (silent exit)");
}

// ---------- F: the two silent exits ----------
{
  await installToastObserver();
  await renameVia(ALPHA, "Probe renamed alpha", "", "Enter"); // empty draft
  const seatsF1 = await fetchSeats();
  must(seatsF1.find((x) => x.id === ALPHA)?.name === "Probe renamed alpha",
    "F the empty draft commits nothing (silent)");
  must(!(await readToasts()).some((t) => /view renamed/i.test(t)), "F the empty draft is silent — no toast");
  await installToastObserver();
  await renameVia(ALPHA, "Probe renamed alpha", "Probe renamed alpha", "Enter"); // untouched
  const seatsF2 = await fetchSeats();
  must(seatsF2.find((x) => x.id === ALPHA)?.name === "Probe renamed alpha",
    "F the untouched draft commits nothing (silent)");
  must(!(await readToasts()).some((t) => /view renamed/i.test(t)), "F the untouched draft is silent — no toast");
}

// ---------- G: world intact + teardown + the console contract ----------
{
  await putSeats([...seeds]); // the drills retire; the world returns to three seeds
  const finalSeats = await fetchSeats();
  must(finalSeats.length === 3 && ["seedview1", "seedview2", "seedview3"].every((id) => finalSeats.some((x) => x.id === id && (x.thumb ?? "").startsWith("data:image"))),
    "G the three seeded views survived every mouth (thumbs included)",
    finalSeats.map((x) => x.id).join(","));
  must(consoleErrors.length === 0, "G zero real console errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
  must(resource404.length === 0, "G zero 404s", `${resource404.length}`);
  must(resourceFlap.length <= 120, "G flap within the storm-calibrated bound", `${resourceFlap.length}`);
  must(hmrNoise.length <= 20, "G hmr noise within bound", `${hmrNoise.length}`);
  must(chunkFlap.length <= 10, "G chunk flap within bound", `${chunkFlap.length}`);
}

console.log(`\n=== t673: ${PASS} pass, ${FAIL} fail ===`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
