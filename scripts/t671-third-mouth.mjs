// t671 — the THIRD mouth speaks, and every surface hears it. The saved-
// views collection has three mutation mouths: the dashboard wall's X
// (t669), the palette row's X (t670), and — the bookmark's own HOME — the
// 3D viewer's bookmark list (save via B key, update via ↻, delete via ✕;
// commitBookmarks is the single mutation path all three share). Until this
// window the home was silent: a view saved in the viewer reached the wall
// only when some unrelated job mutation fired its jobCount refetch, and
// the palette waited out its 30s TTL clock. Now commitBookmarks broadcasts
// SAVED_VIEWS_CHANGED_EVENT; the wall re-reads immediately, and the
// palette's always-mounted listener re-reads into the module cache — the
// next open shows the truth even inside the TTL window.
//
// The probe's shape is THREE-PHASE per mutation: act inside the viewer
// dialog, then Esc back to the dashboard to read the wall. The wall lives
// on the dashboard VIEW — openJob forces the canvas view (t667's lesson),
// so "the wall heard it while the dialog was open" is witnessed by the
// page instance never reloading and the wall growing/shrinking with no
// refetch trigger other than the broadcast.
//
// The home's loading fingerprint: the bookmark trigger's aria-label grows
// "— N saved" only after the server/mirror load lands (the 2.5s-cap fetch).
// Acting before it is a probe crime — the B-key PUT writes the browser's
// own list, and an unloaded list is EMPTY (the first flight taught this:
// a quick-save before the load swallowed the seeds server-side). Wait for
// the fingerprint before every list mutation.
//
// Probe contract:
//   S  the stage: the 3D viewer really up, the world at three seeded views.
//   A  the viewer saves (B key) → back to the dashboard the wall holds
//      four (zero reload), and the palette's next open sees the new view
//      (broadcast-refetched cache, not a TTL-stale one).
//   B  the viewer deletes (✕ in the bookmark list) → the wall shrinks to
//      three with no reload, the palette's next open agrees.
//   C  the viewer updates (↻ re-captures) → the wall's thumb changes with
//      it (the gallery route serves the fresh capture; same-source law).
//   D  the pending door survives every mutation: a palette row jump still
//      writes the pending, a FRESH viewer mount consumes it, the restored
//      toast lands (three mouths, no crossfire).
//   F  the world intact (three seeded views) + noise buckets. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
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

// ---------- setup: the world is exactly the three seeded views ----------
// the seeds carry REAL thumbs (8x8 grayscale PNGs, one gradient each) —
// the first fix-restore wrote thumbless seats and the C leg read a
// Mountain fallback where its baseline img should have been (srcBefore
// empty — the probe's own baseline was the lie, the product was fine)
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function grayscalePng(pixels, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = pixels[y * w + x];
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}
const seedThumb = (base) =>
  `data:image/png;base64,${grayscalePng(
    Buffer.from(Array.from({ length: 64 }, (_, i) => Math.min(255, base + i * 3))),
    8,
    8
  ).toString("base64")}`;
const mkSeed = (id, name, i) => ({
  id,
  name,
  ts: Date.now() - (3 - i) * 1000,
  thumb: seedThumb(40 + i * 60),
  snapshot: { mode: "iso", fov: 0.876, position: [42.7, 38.1, 95.3], up: [0, 1, 0], target: [0, 0, 0], radius: 63.2, radiusMax: 110.4, fog: 0, clipFar: 0, minNear: 0, minFar: 0 },
  view: { sigma: 2.5, sign: 1, slice: { on: true, axis: "Z", pos: 0.35 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
});
const seeds = ["seedview1", "seedview2", "seedview3"].map((id, i) =>
  mkSeed(id, ["Centered iso view", "Top-down slice", "Front half clipped"][i], i)
);
const cur = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);
// "clean" means seats AND thumbs: a thumbless seed is the probe's own
// broken baseline (the first fix-restore wrote thumbless seats and the C
// leg read a fallback where its img should have been)
const isClean = cur.length === 3 &&
  ["seedview1", "seedview2", "seedview3"].every((id) => cur.some((x) => x.id === id && (x.thumb ?? "").startsWith("data:image")));
if (!isClean) {
  const w = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ bookmarks: seeds }),
  });
  if (!w.ok) { console.error(`setup PUT failed: ${w.status}`); process.exit(1); }
  console.log(`· setup: world restored to three seeds (was ${cur.length})`);
} else {
  console.log(`· setup: world already clean (three seeds)`);
}

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [];
const hmrNoise = [];
const resourceFlap = [];
const resource404 = [];
const chunkFlap = [];
const molstarNoise = [];
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
page.on("console", (m) => {
  if (/olstar\]/.test(m.text())) molLines.push(m.text().slice(0, 120));
});
const waitViewerReady = (timeoutMs = 150000) => pollUntil(async () => {
  if (molLines.some((l) => l.includes("init failed"))) return "failed";
  if (molLines.some((l) => l.includes("] ready"))) return "ready";
  return null;
}, timeoutMs);

const waitShell = () =>
  pollUntil(async () =>
    ((await page.locator('[role="tab"]').count()) > 0 &&
      (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);
const installToastObserver = () =>
  page.evaluate(() => {
    const w = window;
    w.__t671Toasts = [];
    const t0 = Date.now();
    if (w.__t671Mo) w.__t671Mo.disconnect();
    w.__t671Mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const t = n.textContent || "";
          if (/saved|restored|not found|deleted|could not/i.test(t)) {
            w.__t671Toasts.push({ at: Date.now() - t0, text: t.replace(/\s+/g, " ").slice(0, 200) });
          }
        }
      }
    });
    w.__t671Mo.observe(document.body, { childList: true, subtree: true });
    return "observer-on";
  });
const readToasts = () => page.evaluate(() => (window.__t671Toasts ?? []).map((t) => t.text))
  .catch(() => []);

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

const fetchSeats = () =>
  fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await waitShell();
await installToastObserver();
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await sleep(1500);

const wall = page.locator('section[aria-label="Saved 3D views across all projects"]');
const wallCards = () => wall.locator("[data-saved-view-card]").count();
const openPalette = async () => {
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
};
const savedRows = () => page.locator("[cmdk-item]", { hasText: "Saved view — " });

// the viewer dance (t662/t668 verbatim): open from roster → Results tab →
// enlarge → View in 3D → the product's own ready line
const runDance = async () => {
  molLines.length = 0; // each mount speaks its OWN lifecycle
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

// the home's loading fingerprint: "— N saved" appears only after the
// bookmark load (server ∪ mirror) lands — the guard against the
// quick-save-swallows-the-seeds race the first flight paid for
const waitBookmarksLoaded = (n) =>
  pollUntil(async () =>
    (await page.locator(`button[aria-label="Camera view bookmarks — ${n} saved"]`).count()) > 0 || null, 20000);

// Esc back to the dashboard: two dialogs may be stacked (3D + inspector);
// the canvas view survives them — the dashTab click is the way back
const backToDashboard = async () => {
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(700);
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(700);
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1500);
};

// ---------- S: the stage ----------
const cardsBefore = await wallCards();
must(cardsBefore === 3, "S the wall stands at three (dashboard view)", `${cardsBefore}`);
let dance = await runDance();
for (let attempt = 0; attempt < 3 && dance !== "ready"; attempt++) {
  console.log(`  · dance: ${dance} — ladder (health wait + reload + re-dance)`);
  await waitServerHealthy();
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitShell();
  await installToastObserver();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1200);
  dance = await runDance();
}
must(dance === "ready", "S the 3D viewer is REALLY up (the home mouth's stage)", dance);
const loaded = await waitBookmarksLoaded(3);
must(!!loaded, "S the home's list loaded (the '— 3 saved' fingerprint)", loaded ? "fingerprint seen" : "timeout");

// ---------- A: the viewer saves → every surface hears it ----------
await page.keyboard.press("b");
const saveToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => t.includes("View saved")) || null;
}, 10000);
must(!!saveToast, "A the B-key quick-save announces itself", saveToast ?? "none");
const seatsAfterSave = await fetchSeats();
must(seatsAfterSave.length === 4, "A the server holds four (the browser's list HAD the seeds this time)", `${seatsAfterSave.length}`);
await backToDashboard();
const wallGrew = await pollUntil(async () => (await wallCards()) === 4 || null, 15000);
must(!!wallGrew, "A back on the dashboard the wall holds four — grown by the broadcast, zero reloads", `${await wallCards()}`);
await page.screenshot({ path: ".qa-logs/t671-wall-grows.png" });
await openPalette();
await sleep(1200);
const rowsA = await savedRows().count();
const newRowA = await page.locator("[cmdk-item]", { hasText: "Saved view — View " }).count();
must(rowsA === 4 && newRowA >= 1, "A the palette's next open speaks four rows (the listener beat the TTL clock)", `${rowsA} rows, viewer-saved=${newRowA}`);
await page.keyboard.press("Escape").catch(() => {});
await sleep(800);

// ---------- B: the viewer deletes → the wall and palette shrink ----------
dance = await runDance();
if (dance !== "ready") {
  console.log(`  · dance B: ${dance} — one ladder`);
  await waitServerHealthy();
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitShell();
  await installToastObserver();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1200);
  dance = await runDance();
}
must(dance === "ready", "B the viewer is up again (fresh mount, fresh list)", dance);
must(!!(await waitBookmarksLoaded(4)), "B the home's list loaded (— 4 saved)");
const bmTrigger = page.locator('button[aria-label^="Camera view bookmarks"]').first();
await bmTrigger.click().catch(() => {});
await sleep(900);
const delBtn = page.locator('button[aria-label^="Delete bookmark"]').last();
must((await delBtn.count()) >= 1, "B the bookmark list carries its delete mouths", `${await page.locator('button[aria-label^="Delete bookmark"]').count()}`);
await delBtn.click().catch(() => {});
await sleep(1200);
const seatsAfterDel = await fetchSeats();
must(seatsAfterDel.length === 3, "B the server holds three", `${seatsAfterDel.length}`);
await backToDashboard();
const wallShrunk = await pollUntil(async () => (await wallCards()) === 3 || null, 15000);
must(!!wallShrunk, "B back on the dashboard the wall holds three — shrunk by the broadcast", `${await wallCards()}`);
await openPalette();
await sleep(1200);
const rowsB = await savedRows().count();
must(rowsB === 3, "B the palette's next open agrees (three rows, no TTL ghost)", `${rowsB}`);
await page.keyboard.press("Escape").catch(() => {});
await sleep(800);
await page.screenshot({ path: ".qa-logs/t671-wall-shrinks.png" });

// ---------- C: the viewer updates → the wall's thumb follows ----------
const firstThumb = wall.locator("[data-saved-view-card]").first().locator("img").first();
const srcBefore = await firstThumb.getAttribute("src").catch(() => "");
must(!!srcBefore && srcBefore.startsWith("data:image"), "C the baseline thumb is a real image (the probe's own baseline speaks)", srcBefore.slice(0, 30));
dance = await runDance();
if (dance !== "ready") {
  console.log(`  · dance C: ${dance} — one ladder`);
  await waitServerHealthy();
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitShell();
  await installToastObserver();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1200);
  dance = await runDance();
}
must(dance === "ready", "C the viewer is up for the update", dance);
must(!!(await waitBookmarksLoaded(3)), "C the home's list loaded (— 3 saved)");
await page.locator('button[aria-label^="Camera view bookmarks"]').first().click().catch(() => {});
await sleep(900);
const updBtn = page.locator('button[aria-label^="Update bookmark"]').first();
must((await updBtn.count()) >= 1, "C the bookmark list carries its update mouth");
await updBtn.click().catch(() => {});
await sleep(1500);
const seatsAfterUpd = await fetchSeats();
must(seatsAfterUpd.length === 3, "C the update never changed the count", `${seatsAfterUpd.length}`);
await backToDashboard();
await sleep(500);
// the update re-captured the thumb — the gallery route serves the fresh
// bytes and the broadcast re-read delivered them to the wall
const srcAfter = await firstThumb.getAttribute("src").catch(() => "");
must(!!srcBefore && !!srcAfter && srcBefore !== srcAfter, "C the wall's thumb changed with the update (fresh capture served)", `${srcBefore.slice(0, 22)} -> ${srcAfter.slice(0, 22)}`);

// ---------- D: the pending door survives every mutation ----------
await openPalette();
await sleep(1000);
const jumpRow = page.locator('[data-palette-savedview-row="seedview1"]').first();
must((await jumpRow.count()) === 1, "D the seed row still stands after save/delete/update");
await jumpRow.click().catch(() => {});
await sleep(800);
must((await page.locator("[cmdk-item]").count()) === 0, "D the palette closes on jump");
const pendingRaw = await page.evaluate((k) => sessionStorage.getItem(k), PENDING_KEY).catch(() => "evaluate-lost");
let pending = null;
try { pending = JSON.parse(pendingRaw ?? "null"); } catch { /* consumed */ }
must(!!pending && pending.bookmarkId === "seedview1", "D the pending handshake wrote the jumped row", pendingRaw?.slice(0, 60));
let danceD = await runDance();
for (let attempt = 0; attempt < 3 && danceD !== "ready"; attempt++) {
  console.log(`  · dance D: ${danceD} — ladder (health wait + reload + re-dance, NO re-jump: pending survives reloads)`);
  await waitServerHealthy();
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitShell();
  await installToastObserver();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1200);
  danceD = await runDance();
}
must(danceD === "ready", "D a fresh viewer is REALLY up to consume the pending", danceD);
const restoreToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => t.includes("Centered") && t.includes("restored")) || null;
}, 25000);
must(!!restoreToast, "D the restored toast lands (three mouths, no crossfire)", restoreToast ?? "none");
await page.keyboard.press("Escape").catch(() => {});
await sleep(1000);

// ---------- F: the world intact + the console contract ----------
const finalSeats = await fetchSeats();
const ids = finalSeats.map((x) => x.id);
must(ids.includes("seedview1") && ids.includes("seedview2") && ids.includes("seedview3"),
  "F the three seeded views survived save/delete/update/jump", ids.join(","));
must(consoleErrors.length === 0, "F zero real console errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(resource404.length === 0, "F zero 404s", `${resource404.length}`);
must(resourceFlap.length <= 120, "F flap within the storm-calibrated bound (loop signature is 1352)", `${resourceFlap.length}`);
must(hmrNoise.length <= 20, "F hmr noise within bound", `${hmrNoise.length}`);
must(chunkFlap.length <= 10, "F chunk flap within bound", `${chunkFlap.length}`);

console.log(`\n=== t671: ${PASS} pass, ${FAIL} fail ===`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
