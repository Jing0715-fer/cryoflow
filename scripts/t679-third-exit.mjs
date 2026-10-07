// t679 — the third exit gets its own stage: "Saved view could not be
// restored". The pending-view door (t668/t669) owes a verdict on EVERY
// consumption — restore, honest not-found, or an honest could-not-restore
// — and t669 pinned the second exit while the third never got its probe.
//
// The audit that shaped this drill (do not re-litigate):
//   · the fake-success window does NOT exist — the pending consumption
//     runs after an await-fetch, and React runs the SAME commit's later
//     effects (restoreBookmarkRef's assignment) synchronously during that
//     await, so the handler is real by the time the door speaks;
//   · the server route's sanitizeView REPAIRS malformed views on write
//     (v.slice ?? {} — slice/clip are always rebuilt with honest defaults),
//     so a malformed seat cannot be mounted through the API lane at all:
//     the defense-in-depth already holds. The residual real-world entry
//     for a shape-broken view is the localStorage MIRROR's historical
//     entry — a list written by an older build of the app. That state is
//     exactly what this probe seeds: a state an honest prior visit could
//     have left behind, never a lie about the server.
//
// The deterministic mouth (t669's doctrine): the probe writes
// PENDING_VIEW_KEY directly — the door's own wire shape. The consumption
// is the subject under test, not any one mouth.
//
// Legs:
//   A  the world + the wall: 4 cards after the drill seat mounts (the
//      server's stored copy of the drill arrives REPAIRED — the audit's
//      own exhibit).
//   B  the positive control: pending → seedview1 (a well-formed view)
//      → viewer ready → "restored" toast. Proves the pipe and the mouth.
//   C  the mirror's historical shape (no slice field) + the camera-bookmarks
//      GET aborted (the server read dies; the mirror is the honest fallback
//      by design) → pending consumed → the entry SANE-IFIES to pose-only
//      (the import lane's own law, now extended to every read) → a calm
//      "restored" toast (the pose flies; the unrecorded optics stay put)
//      → the viewer SURVIVES (no crash, no remount — the t679 first flight
//      watched the OLD code crash the whole tree on this exact world) →
//      pending consumed one-shot → the server still holds all four seats →
//      the wall card survives.
//   D  the world intact: three seeds untouched, noise buckets (with the
//      routeAbort echo in its OWN bucket — t670's lesson), teardown
//      returns the world to three seats. 📸×2.
//
// The THIRD EXIT ("could not be restored") keeps its verdict on record:
// after the sane-ification every applied entry is shape-current, so the
// exit's dynamic trigger surface goes to zero — it stands as the door's
// permanent goalkeeper (the try/catch stays; unknown-unknown throws from
// the viewer's own internals still owe the honest toast), documented
// rather than drilled (the t678 entry-⑥ adjudication pattern).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const DRILL_ID = "t679drill";
const DRILL_NAME = "Probe drill broken view";
const PENDING_KEY = "cryoflow:pending-view";
const MIRROR_KEY = `cryoflow.mol-camera-bookmarks:${REFINE3D_ID}`;
const SEEDS = ["seedview1", "seedview2", "seedview3"];

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

// ---------- setup: mount the drill seat (adopt-or-create, API lane) ----------
// NOTE the drill's view field IS malformed on the wire — and the server's
// sanitizeView will repair it. That is the audit's exhibit, not a mistake:
// leg A asserts the stored copy arrives REPAIRED, and leg C seeds the
// historical (broken) shape into the mirror itself.
const mkSnapshot = () => ({
  mode: "iso", fov: 0.876, position: [42.7, 38.1, 95.3], up: [0, 1, 0],
  target: [0, 0, 0], radius: 63.2, radiusMax: 110.4, fog: 0, clipFar: 0, minNear: 0, minFar: 0,
});
const fetchSeats = () =>
  fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);
const cur0 = await fetchSeats();
const seedList = SEEDS.map((id) => cur0.find((x) => x.id === id));
if (seedList.some((s) => !s)) { console.error(`setup: canonical seed missing (${SEEDS.map((s) => seedList.find((x) => x?.id === s)?.id ?? "GONE").join(",")})`); process.exit(1); }
const drill = {
  id: DRILL_ID, name: DRILL_NAME, ts: Date.now(), snapshot: mkSnapshot(),
  view: { sigma: 2.5, sign: 1 }, // the historical shape: no slice, no clip
};
const put = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: [...seedList, drill] }),
});
if (!put.ok) { console.error(`setup PUT failed: ${put.status}`); process.exit(1); }
const verify = await fetchSeats();
const storedDrill = verify.find((x) => x.id === DRILL_ID);
console.log(`· setup: drill seat mounted (${verify.length} total) — server stored view slice=${storedDrill?.view?.slice ? "REPAIRED" : "broken(!!)"}`);

// ---------- browser + instruments (t669/t676 grammar) ----------
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const consoleErrors = [], hmrNoise = [], resourceFlap = [], resource404 = [], chunkFlap = [], routeAbortEcho = [];
const molstarNoise = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("webpack-hmr") && t.includes("ERR_CONNECTION_REFUSED")) { hmrNoise.push(t); return; }
  if (t.startsWith("Failed to load chunk") && t.includes("async loader")) { chunkFlap.push(t); return; }
  if (t.startsWith("Failed to load resource")) {
    if (/status of 404/.test(t)) resource404.push(t);
    // t670's lesson: the abort's net::ERR_FAILED is the probe's OWN
    // instrument speaking — it lives in its own bounded bucket, never in
    // the world's real-error bucket
    else if (/net::ERR_FAILED/.test(t)) { routeAbortEcho.push(t); return; }
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => {
  if (/Failed to load chunk/.test(e.message)) { chunkFlap.push(e.message); return; }
  if (/net::ERR_FAILED/.test(e.message)) { routeAbortEcho.push(`pageerror: ${e.message}`); return; }
  // t669's precedent: molstar's own "unreachable" pageerror is a known
  // non-fatal internal line — its own bucket, not the world's real errors
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

const waitShell = () =>
  pollUntil(async () =>
    ((await page.locator('[role="tab"]').count()) > 0 &&
      (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);
const TOAST_RE = /restored|not found|deleted|could not/i;
const installToastObserver = () =>
  page.evaluate((src) => {
    const re = new RegExp(src, "i");
    const w = window;
    w.__t679Toasts = [];
    const t0 = Date.now();
    if (w.__t679Mo) w.__t679Mo.disconnect();
    w.__t679Mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const t = n.textContent || "";
          if (re.test(t)) w.__t679Toasts.push({ at: Date.now() - t0, text: t.replace(/\s+/g, " ").slice(0, 200) });
        }
      }
    });
    w.__t679Mo.observe(document.body, { childList: true, subtree: true });
    return "observer-on";
  }, TOAST_RE.source);
const readToasts = () => page.evaluate(() => (window.__t679Toasts ?? []).map((t) => t.text)).catch(() => []);

const seedMirror = (list) =>
  page.evaluate(([k, v]) => { localStorage.setItem(k, v); }, [MIRROR_KEY, JSON.stringify(list)]).catch(() => {});
const armPending = (bookmarkId) =>
  page.evaluate(([k, v]) => { sessionStorage.setItem(k, v); }, [PENDING_KEY, JSON.stringify({ jobId: REFINE3D_ID, bookmarkId })]).catch(() => {});
const pendingValue = () =>
  page.evaluate((k) => sessionStorage.getItem(k), PENDING_KEY).catch(() => "evaluate-lost");

// the abort valve: the camera-bookmarks GET dies so the mirror (the
// honest offline fallback) answers — the scenario "a prior visit left a
// historical list, and the server cannot be reached right now"
const abortBookmarksGET = () =>
  page.route("**/camera-bookmarks", (route) => {
    if (route.request().method() === "GET") return route.abort();
    return route.fallback();
  });
const unrouteBookmarks = () => page.unroute("**/camera-bookmarks").catch(() => {});

const waitServerHealthy = (timeoutMs = 60000) => pollUntil(async () => {
  const ok = await page.evaluate(async () => {
    const t0 = Date.now();
    try {
      const r = await fetch("/api/jobs", { cache: "no-store" });
      return r.ok && Date.now() - t0 < 2000;
    } catch { return false; }
  });
  return ok || null;
}, timeoutMs);

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

// the viewer dance (t662/t668/t669 verbatim): Results → enlarge → View in 3D
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
const reopenFromRoster = async () => {
  await waitShell();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1500);
  const reRow = page.locator("[data-roster-row]", { hasText: "3D auto-refine" }).first();
  await pollUntil(async () => (await reRow.count()) > 0 || null, 10000);
  await reRow.locator('button[title^="Open 3D auto-refine"]').first().click().catch(() => {});
  await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
  await sleep(1500);
};
const danceLadder = async (label) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    console.log(`  · ${label}: ladder attempt ${attempt + 1} (health wait + reload + roster reopen + re-dance)`);
    await waitServerHealthy();
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    await sleep(2500);
    await waitShell();
    await installToastObserver();
    await seedMirror(await fetchSeats());
    await reopenFromRoster();
    const d = await runDance();
    if (d === "ready") return true;
  }
  return false;
};

// ---------- A: the world + the wall (the server's REPAIR on exhibit) ----------
const wall = page.locator('section[aria-label="Saved 3D views across all projects"]');
await pollUntil(async () => (await wall.count()) > 0 || null, 15000);
must((await wall.count()) === 1, "A the Saved views wall stands");
const wallCount = await wall.locator("[data-saved-view-card]").count();
must(wallCount === 4, "A four cards stand after the drill seat mounted", `${wallCount}`);
must((await wall.locator(`[data-saved-view-card="${DRILL_ID}"]`).count()) === 1, "A the drill seat has its card");
must(!!storedDrill?.view?.slice, "A the server stored the drill's view REPAIRED (sanitizeView is the first line of defense — the audit's own exhibit)",
  `slice=${JSON.stringify(storedDrill?.view?.slice ?? null)}`);

// ---------- B: the positive control — a well-formed view restores ----------
await seedMirror(await fetchSeats());
await armPending("seedview1");
await reopenFromRoster();
let danceB = await runDance();
if (danceB !== "ready") {
  unrouteBookmarks();
  const ok = await danceLadder("dance B");
  if (ok) danceB = "ready";
}
must(danceB === "ready", "B the 3D viewer is REALLY up (positive control dance)", danceB);
const restoreToast = danceB === "ready"
  ? await pollUntil(async () => {
      const ts = await readToasts();
      return ts.find((t) => t.includes("Centered iso view") && /restored/i.test(t)) || null;
    }, 20000)
  : null;
must(!!restoreToast, "B the arrival toast names the seeded view (the pipe and the mouth both work)", restoreToast ?? "none");
const molNoiseB = molstarNoise.length;

// ---------- C: the mirror's historical shape degrades, the tree does not ----------
await page.keyboard.press("Escape"); // close the viewer dialog
await sleep(1200);
const molReadyBefore = molLines.filter((l) => l.includes("] ready")).length;
// the historical entry: the SAME list the server holds, but the drill's
// view is the OLD shape (no slice field) — a state an honest prior visit
// (an older build) could have left in this browser's localStorage
const histSeats = (await fetchSeats()).map((x) =>
  x.id === DRILL_ID ? { ...x, view: { sigma: 2.5, sign: 1 } } : x
);
await seedMirror(histSeats);
await armPending(DRILL_ID);
abortBookmarksGET();
await reopenFromRoster();
let danceC = await runDance();
if (danceC !== "ready") {
  // the ladder's reload would unroute nothing — keep the valve ON across
  // attempts so the mirror stays the only voice (the drill's scenario)
  for (let attempt = 0; attempt < 3 && danceC !== "ready"; attempt++) {
    console.log(`  · dance C: ${danceC} — ladder (health wait + reload + roster reopen + re-dance, valve stays ON)`);
    await waitServerHealthy();
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    await sleep(2500);
    await waitShell();
    await installToastObserver();
    await seedMirror(histSeats);
    await armPending(DRILL_ID);
    await reopenFromRoster();
    danceC = await runDance();
  }
}
must(danceC === "ready", "C the drill viewer is REALLY up (the abort valve stayed on)", danceC);
const restoreToastC = danceC === "ready"
  ? await pollUntil(async () => {
      const ts = await readToasts();
      return ts.find((t) => t.includes(DRILL_NAME) && /restored/i.test(t) && !/could not/i.test(t)) || null;
    }, 20000)
  : null;
must(!!restoreToastC, "C the pose-only restore speaks a calm restored toast (the pose flies; the unrecorded optics stay put)", restoreToastC ?? "none");
must(!(await readToasts()).some((t) => /could not be restored/i.test(t)),
  "C no false alarm spoke (the sane-ified entry is not a failure — the door's goalkeeper stays quiet)");
const dialogAlive = await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 8000);
must(!!dialogAlive, "C the viewer SURVIVES the historical mirror (no crash, dialog stands — the first flight watched the old code die here)");
const molReadyAfter = molLines.filter((l) => l.includes("] ready")).length;
must(molReadyAfter === molReadyBefore, "C no viewer remount happened (the failure is a verdict, not a crash)",
  `ready lines ${molReadyBefore} → ${molReadyAfter}`);
const pend = await pendingValue();
must(pend === null || pend === "evaluate-lost", "C the pending handshake is consumed (one-shot, even for failures)", String(pend));
const seatsAfterC = await fetchSeats();
must(seatsAfterC.length === 4 && seatsAfterC.some((x) => x.id === DRILL_ID),
  "C the server still holds all four seats (honest failure deletes nothing)", `${seatsAfterC.length}`);
unrouteBookmarks();
await page.screenshot({ path: ".qa-logs/t679-third-exit.png" });

// the wall card survives — back to the dashboard
await ensureDashboard();
const wall3 = page.locator('section[aria-label="Saved 3D views across all projects"]');
await pollUntil(async () => (await wall3.locator("[data-saved-view-card]").count()) === 4 || null, 15000);
must((await wall3.locator(`[data-saved-view-card="${DRILL_ID}"]`).count()) === 1,
  "C the wall card survives (the shelf keeps what the flight failed to reach)");
const molNoiseC = molstarNoise.length - molNoiseB;

// ---------- D: the world intact + buckets + teardown ----------
const after = await fetchSeats();
const seedNames = SEEDS.map((id) => after.find((x) => x.id === id)?.name);
must(after.length === 4 && SEEDS.every((id) => after.some((x) => x.id === id)) && seedNames.every(Boolean),
  "D the three seeds stand with their names", seedNames.join(" | "));
must(consoleErrors.length === 0, "D console: zero real errors (the abort echo lives in its own bucket)",
  consoleErrors.slice(0, 3).join(" ;; "));
must(routeAbortEcho.length <= 4, "D the abort's echo is bounded (the probe's own valve, not the world's voice)", `${routeAbortEcho.length}`);
must(resource404.length === 0, "D zero 404s", `${resource404.length}`);
must(molstarNoise.length <= 20, "D molstar's own unreachable noise bounded (the t668 precedent bucket, two mounts)",
  `${molstarNoise.length} (leg B: ${molNoiseB} / leg C: ${molNoiseC})`);
must(chunkFlap.length === 0 && resourceFlap.length === 0 && hmrNoise.length <= 6,
  "D chunk/resource/hmr noise bounded", `chunk=${chunkFlap.length} resource=${resourceFlap.length} hmr=${hmrNoise.length}`);

// teardown: remove the drill seat — the world returns to three
const teardownPut = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: after.filter((x) => SEEDS.includes(x.id)) }),
});
const postTeardown = teardownPut.ok ? await fetchSeats() : [];
must(teardownPut.ok && postTeardown.length === 3 && postTeardown.every((x) => SEEDS.includes(x.id)),
  "D teardown returns the world to three seats", `${postTeardown.length}`);
await page.screenshot({ path: ".qa-logs/t679-world-intact.png" });

console.log(`\n==== t679 third-exit: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
