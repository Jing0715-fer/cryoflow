// t670 — the palette row gets the wall's delete face. t669 grew the X on
// the dashboard wall card (fresh GET → filter → PUT, single-flight, slot-
// swap grammar); t668 taught that the palette row and the wall card are
// TWO MOUTHS of one door (PENDING_VIEW_KEY). With a second mutation mouth
// comes a second clock problem: the palette's 30s TTL cache would haunt
// the deleted row until expiry, and the wall (whose refetch trigger is
// jobCount — a bookmark mutation never fires it) would hold its stale
// copy until some unrelated job mutation happened. So the delete:
//   • shrinks the palette's OWN cache in place (the double clock now has
//     both halves owned — the reopen inside the TTL window shows the
//     post-delete truth),
//   • broadcasts SAVED_VIEWS_CHANGED_EVENT (payload-less — the wall
//     trusts only its own fresh read), and the wall re-reads the route.
//
// Probe contract:
//   A  the palette row's hover contract: X hides at rest, reveals on
//      hover, the Mountain tail yields the slot (no layout shift).
//   B  the delete flow: click → row exits, toast reports, server confirms
//      4; the reopen inside the TTL window shows the post-delete truth
//      (cache hit at zero wire cost when the TTL still holds).
//   E  the wall syncs WITHOUT a page reload — the broadcast's whole point.
//   C  the jump mouth is unharmed: the other row still writes the pending,
//      opens the viewer, restores (two mouths, no crossfire).
//   D  the honest failure: an aborted PUT keeps the row and says so; after
//      the abort lifts, the same X succeeds (the retry is one click).
//   F  the world intact (three seeded views untouched) + noise buckets. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const DRILL_ID = "t670drill";
const DRILL2_ID = "t670drill2";
const DRILL_NAME = "Probe drill one";
const DRILL2_NAME = "Probe drill two";
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

// ---------- setup: mount TWO drill seats (adopt-or-create, API lane) —
// one sacrifices to the happy path (B), one to the aborted-PUT drill (D);
// the three seeded views are the world-intact witnesses (F) ----------
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

// the product's OWN lifecycle lines — the honest readiness milestone (t668)
const molLines = [];
page.on("console", (m) => {
  if (/olstar\]/.test(m.text())) molLines.push(m.text().slice(0, 120));
});
const waitViewerReady = (timeoutMs = 150000) => pollUntil(async () => {
  if (molLines.some((l) => l.includes("init failed"))) return "failed";
  if (molLines.some((l) => l.includes("] ready"))) return "ready";
  return null;
}, timeoutMs);

// toast recorder — REINSTALLABLE (t668's second lesson: the instrument
// rides the ladder; every reload wipes the window)
const waitShell = () =>
  pollUntil(async () =>
    ((await page.locator('[role="tab"]').count()) > 0 &&
      (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);
const installToastObserver = () =>
  page.evaluate(() => {
    const w = window;
    w.__t670Toasts = [];
    const t0 = Date.now();
    if (w.__t670Mo) w.__t670Mo.disconnect();
    w.__t670Mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const t = n.textContent || "";
          if (/restored|not found|deleted|could not/i.test(t)) {
            w.__t670Toasts.push({ at: Date.now() - t0, text: t.replace(/\s+/g, " ").slice(0, 200) });
          }
        }
      }
    });
    w.__t670Mo.observe(document.body, { childList: true, subtree: true });
    return "observer-on";
  });
const readToasts = () => page.evaluate(() => (window.__t670Toasts ?? []).map((t) => t.text))
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

// the viewer dance (t662/t668/t669 verbatim): Results tab → enlarge → View in 3D
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

// ---------- A: the row's hover contract ----------
const opened = await (async () => {
  for (let i = 0; i < 2; i++) {
    await openPalette();
    if ((await pollUntil(async () => (await savedRows().count()) === 5 || null, 12000))) return true;
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(600);
  }
  return false;
})();
must(opened, "A the palette speaks five rows (three seeds + two drills)", `${await savedRows().count()}`);
const drillRow = page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).first();
must((await drillRow.count()) === 1, "A the drill row carries its row anchor");
const xBtn = drillRow.locator(`button[data-palette-savedview-delete="${DRILL_ID}"]`);
must((await xBtn.count()) === 1, "A the row carries its delete X");
const xLabel = await xBtn.getAttribute("aria-label").catch(() => "");
must(!!xLabel && xLabel.includes(DRILL_NAME), "A the X names the view for assistive tech", xLabel ?? "");
const restOpacity = await xBtn.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(restOpacity === "0", "A the X hides at rest (hover-reveal contract)", `opacity ${restOpacity}`);
await drillRow.hover().catch(() => {});
await sleep(500);
const hoverOpacity = await xBtn.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(hoverOpacity !== "0" && hoverOpacity !== "?", "A the X reveals on hover", `opacity ${hoverOpacity}`);
const mountain = drillRow.locator("span.relative > svg").first();
const mountainOpacity = await mountain.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(mountainOpacity === "0", "A the Mountain tail yields the slot (swap, not overlap)", `opacity ${mountainOpacity}`);

// ---------- B: the delete flow + the palette's own clock shrinks ----------
await xBtn.click();
const rowGone = await pollUntil(async () =>
  (await savedRows().count()) === 4 &&
  (await page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).count()) === 0 || null, 15000);
must(!!rowGone, "B the row exits the palette in place (no close, no reload)", `${await savedRows().count()} rows`);
const delToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => t.includes(DRILL_NAME) && t.includes("deleted")) || null;
}, 10000);
must(!!delToast, "B the deletion toast reports honestly", delToast ?? "none");
const afterDel = await fetchSeats();
must(afterDel.length === 4 && !afterDel.some((x) => x.id === DRILL_ID),
  "B the server holds four, drill one gone", `${afterDel.length}`);
await page.screenshot({ path: ".qa-logs/t670-palette-delete.png" });

// the reopen inside the TTL window: the row must NOT haunt the list. The
// cache was shrunk IN PLACE by the delete — a reopen rides the cache at
// zero wire cost when the TTL still holds; if the clock ran out mid-probe,
// the refetch answers the same truth (both paths land on "gone", the
// anchor is the truth, the wire line is the shape it took). The reopen
// rides the SAME two-attempt loop as the A leg (Escape's dismissal and
// Control+k's toggle can race — a single shot would measure that race,
// not the cache).
galleryFetches.n = 0;
await page.keyboard.press("Escape").catch(() => {});
await sleep(800);
let reopenOk = false;
for (let i = 0; i < 2 && !reopenOk; i++) {
  await openPalette();
  await sleep(1500);
  if ((await savedRows().count()) === 4 && (await page.locator("[cmdk-item]", { hasText: DRILL_NAME }).count()) === 0) reopenOk = true;
  else { await page.keyboard.press("Escape").catch(() => {}); await sleep(800); }
}
const reopenCount = await savedRows().count();
const drillHaunt = await page.locator("[cmdk-item]", { hasText: DRILL_NAME }).count();
must(reopenOk && reopenCount === 4 && drillHaunt === 0, "B the reopened palette shows the post-delete truth (no ghost)", `${reopenCount} rows, wire=${galleryFetches.n}`);
if (galleryFetches.n === 0) console.log("  · wire: zero gallery refetches — the in-place cache shrink answered (the double clock's owned half)");
else console.log(`  · wire: ${galleryFetches.n} gallery refetch(es) — TTL ran out mid-probe, the refetch confirms the shrink server-side (honest path B)`);
await page.keyboard.press("Escape").catch(() => {});
await sleep(800);

// ---------- E: the wall syncs WITHOUT a reload (the broadcast's point) ----------
await ensureDashboard();
const wall = page.locator('section[aria-label="Saved 3D views across all projects"]');
const wallSynced = await pollUntil(async () =>
  (await wall.count()) === 1 &&
  (await wall.locator(`[data-saved-view-card="${DRILL_ID}"]`).count()) === 0 &&
  (await wall.locator("[data-saved-view-card]").count()) === 4 || null, 15000);
must(!!wallSynced, "E the dashboard wall already shows four (the palette's delete reached it — no reload, no job mutation)", `${await wall.locator("[data-saved-view-card]").count()} cards`);
await page.screenshot({ path: ".qa-logs/t670-wall-sync.png" });

// ---------- C: the jump mouth is unharmed ----------
await openPalette();
await sleep(800);
await seedMirror(await fetchSeats()); // the mirror carries the truth — a dead fetch still lands the target (t669's doctrine)
galleryFetches.n = 0;
const jumpRow = page.locator(`[data-palette-savedview-row="seedview1"]`).first();
must((await jumpRow.count()) === 1, "C the seed row still stands after two deletes on its siblings");
await jumpRow.click();
await sleep(800);
must((await page.locator("[cmdk-item]").count()) === 0, "C the palette closes on jump (the jump mouth never saw the X)");
const pendingRaw = await page.evaluate((k) => sessionStorage.getItem(k), PENDING_KEY).catch(() => "evaluate-lost");
let pending = null;
try { pending = JSON.parse(pendingRaw ?? "null"); } catch { /* consumed already */ }
must(!!pending && pending.jobId === REFINE3D_ID && pending.bookmarkId === "seedview1",
  "C the pending handshake was written for the jumped row (not the deleted one)", pendingRaw?.slice(0, 80));
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
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [PENDING_KEY, JSON.stringify({ jobId: REFINE3D_ID, bookmarkId: "seedview1" })]).catch(() => {});
  await openPalette();
  await page.locator(`[data-palette-savedview-row="seedview1"]`).first().click().catch(() => {});
  await sleep(1500);
  dance = await runDance();
}
must(dance === "ready", "C the 3D viewer is REALLY up (jump mouth fully alive after the delete mouth worked)", dance);
const restoreToast = dance === "ready"
  ? await pollUntil(async () => {
      const ts = await readToasts();
      return ts.find((t) => t.includes("Centered") && t.includes("restored")) || null;
    }, 20000)
  : null;
must(!!restoreToast, "C the restored toast names the jumped view (two mouths, no crossfire)", restoreToast ?? "none");
await page.keyboard.press("Escape").catch(() => {});
await sleep(1000);

// ---------- D: the honest failure — an aborted PUT keeps the row ----------
await waitShell();
await ensureDashboard();
await openPalette();
await sleep(1000);
// the instrument rides the ladder's aftermath: the storm's HMR reloads can
// kill the window's observer at ANY point after C's ladders — reinstall
// before every judgment click (t668's second lesson, applied twice)
await installToastObserver();
const drill2Row = page.locator(`[data-palette-savedview-row="${DRILL2_ID}"]`).first();
must((await drill2Row.count()) === 1, "D the second drill row stands for the failure drill");
await page.route("**/camera-bookmarks", (route) => {
  if (route.request().method() === "PUT") route.abort("failed");
  else route.continue().catch(() => {});
});
const x2 = drill2Row.locator(`button[data-palette-savedview-delete="${DRILL2_ID}"]`);
await drill2Row.hover().catch(() => {});
await sleep(400);
await x2.click();
await sleep(1500);
const failToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => t.includes("Could not delete") || (t.includes(DRILL2_NAME) && t.includes("not confirmed"))) || null;
}, 10000);
must(!!failToast, "D the failed delete says so (the row keeps its seat, no silent swallow)", failToast ?? "none");
const rowStill = await drill2Row.count();
must(rowStill === 1, "D the row stays on the palette after the failure", `count ${rowStill}`);
const seatsAfterFail = await fetchSeats();
must(seatsAfterFail.length === 4 && seatsAfterFail.some((x) => x.id === DRILL2_ID),
  "D the server still holds four — the abort was the ONLY lie", `${seatsAfterFail.length}`);
await page.unroute("**/camera-bookmarks");
// the retry is one click — the same X, no reload, no re-arm
await installToastObserver();
await drill2Row.hover().catch(() => {});
await sleep(400);
await x2.click();
const retried = await pollUntil(async () =>
  (await savedRows().count()) === 3 &&
  (await page.locator(`[data-palette-savedview-row="${DRILL2_ID}"]`).count()) === 0 || null, 15000);
must(!!retried, "D after the abort lifts, the same X succeeds (three rows remain)", `${await savedRows().count()} rows`);
const retryToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.filter((t) => t.includes(DRILL2_NAME) && t.includes("deleted")).length >= 1 || null;
}, 10000);
must(!!retryToast, "D the successful retry reports honestly too", "deleted toast");
const finalSeats = await fetchSeats();
must(finalSeats.length === 3 && !finalSeats.some((x) => x.id === DRILL2_ID),
  "D the server holds three", `${finalSeats.length}`);

// ---------- F: the world intact + the console contract ----------
const ids = finalSeats.map((x) => x.id);
must(ids.includes("seedview1") && ids.includes("seedview2") && ids.includes("seedview3"),
  "F the three seeded views survived every drill", ids.join(","));
must(consoleErrors.length === 0, "F zero real console errors (the aborted PUT's own echo lives in its bucket)", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(routeAbortEcho.length <= 5, "F the abort's echo stays a whisper (the instrument's own voice, bounded)", `${routeAbortEcho.length}`);
must(resource404.length === 0, "F zero 404s", `${resource404.length}`);
must(resourceFlap.length <= 240, "F flap within the storm-calibrated bound (this flight is dance-heavy: up to 4 viewer ladders; 228 observed in the OOM storm, loop signature is 1352 — t669: catch loops, not weather)", `${resourceFlap.length}`);
must(hmrNoise.length <= 20, "F hmr noise within bound", `${hmrNoise.length}`);
must(chunkFlap.length <= 10, "F chunk flap within bound", `${chunkFlap.length}`);

console.log(`\n=== t670: ${PASS} pass, ${FAIL} fail ===`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
