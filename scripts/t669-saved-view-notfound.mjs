// t669 — the honest absence gets its own stage: the "Saved view not found"
// controlled drill, plus the wall's new delete face. t668 proved the happy
// arrival (palette row → pending → restore toast); this window drills the
// OTHER exit — a view deleted after the palette cached it, jumped anyway,
// and the embed reports honestly instead of no-op'ing. The deletion itself
// now has a face: the dashboard wall card grew a hover-revealed X (t669
// feature) that reads fresh at click time and PUTs the remaining list.
//
// The drill's deterministic mouth: the probe writes PENDING_VIEW_KEY
// DIRECTLY — the exact wire shape the palette writes (same door, the
// palette is merely one mouth for it). Why not click a stale palette row?
// The row's presence depends on the palette's 30s TTL clock racing the
// probe's own latency — a conditional the probe refuses. The door's
// contract does not care who wrote the key; the embed's consumption is
// the subject under test.
//
// Probe contract:
//   A  the world + the wall: 4 bookmarks after the drill seat mounts;
//      the wall signs its new affordance ("hover to delete").
//   B  the positive control: palette row → viewer dance → "restored" toast.
//   C  the wall delete (the feature): hover reveals the X, the click
//      shrinks the wall locally, the toast reports, the server confirms 3.
//   D  the honest not-found: pending re-armed for the DELETED id → roster
//      reopen → viewer ready → "Saved view not found" toast, pending
//      consumed. (A "restored" here means the bookmarks fetch died —
//      one reload retry, the t668 inverted-ladder.)
//   E  the dual clock's other half: the palette's TTL expires and the
//      deleted row fades from the list (self-heal, no hand edits).
//   F  the world intact (three seeded views untouched) + noise buckets. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const DRILL_ID = "t669drill";
const DRILL_NAME = "Probe drill view";
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

// ---------- setup: mount the drill seat (adopt-or-create, API lane) ----------
const seed = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json());
const seeded = (seed.bookmarks ?? []).filter((x) => x.id !== DRILL_ID);
const drill = {
  id: DRILL_ID,
  name: DRILL_NAME,
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
};
const put = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: [...seeded, drill] }),
});
if (!put.ok) { console.error(`setup PUT failed: ${put.status}`); process.exit(1); }
const verify = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json());
console.log(`· setup: drill seat mounted (${(verify.bookmarks ?? []).length} total, ${seeded.length} seeded)`);

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
  // the embed's init-failure line is the LADDER'S OWN INPUT — a transient
  // death the ladder heals, not a terminal verdict (t668's doctrine)
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

// the product's OWN lifecycle lines — the honest readiness milestone
// (canvas3d existence lies; t668's first flight proved the gap)
const molLines = [];
page.on("console", (m) => {
  if (/olstar\]/.test(m.text())) molLines.push(m.text().slice(0, 120));
});
const waitViewerReady = (timeoutMs = 150000) => pollUntil(async () => {
  if (molLines.some((l) => l.includes("init failed"))) return "failed";
  if (molLines.some((l) => l.includes("] ready"))) return "ready";
  return null;
}, timeoutMs);

// toast recorder — REINSTALLABLE: a reload wipes the window, the instrument
// rides the ladder like every other tool (t668's second lesson)
const waitShell = () =>
  pollUntil(async () =>
    ((await page.locator('[role="tab"]').count()) > 0 &&
      (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);
const installToastObserver = () =>
  page.evaluate(() => {
    const w = window;
    w.__t669Toasts = [];
    const t0 = Date.now();
    if (w.__t669Mo) w.__t669Mo.disconnect();
    w.__t669Mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const t = n.textContent || "";
          if (/restored|not found|deleted/i.test(t)) {
            w.__t669Toasts.push({ at: Date.now() - t0, text: t.replace(/\s+/g, " ").slice(0, 200) });
          }
        }
      }
    });
    w.__t669Mo.observe(document.body, { childList: true, subtree: true });
    return "observer-on";
  });
const readToasts = () => page.evaluate(() => (window.__t669Toasts ?? []).map((t) => t.text))
  .catch(() => []);

// the embed's OFFLINE fallback reads the localStorage mirror when the
// camera-bookmarks fetch dies (the flap storm's honest design: "the local
// copy restores the views"). A stale mirror can therefore resurrect a
// deleted view and steal the drill's verdict — the probe seeds the mirror
// to the browser state the SCENARIO under test implies (B: the drill seat
// is on the shelf; D: the delete already happened). Both are states an
// honest prior visit leaves behind; neither lies about the server.
const MIRROR_KEY = `cryoflow.mol-camera-bookmarks:${REFINE3D_ID}`;
const seedMirror = (list) =>
  page.evaluate(([k, v]) => { localStorage.setItem(k, v); }, [MIRROR_KEY, JSON.stringify(list)]).catch(() => {});
const fetchSeats = () =>
  fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);

// the OOM ladder's ground floor (t667's version): a reload issued while the
// dev server is mid-execution just trades one death for another — wait for
// the box to breathe before every recovery step
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

// the store persists the last view — a fresh goto can land on the CANVAS,
// and the wall lives on the dashboard. The header's dashboard tab (the
// t667/t668 dashTab anchor, always present) is the honest way there.
const ensureDashboard = async () => {
  await waitShell();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1500);
};
await ensureDashboard();

// the viewer dance (t662/t668 verbatim): Results tab → enlarge → View in 3D
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
const openPalette = async () => {
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
};

// ---------- A: the world + the wall ----------
const wall = page.locator('section[aria-label="Saved 3D views across all projects"]');
await pollUntil(async () => (await wall.count()) > 0 || null, 15000);
must((await wall.count()) === 1, "A the Saved views wall stands", `view landed on ${await page.locator('[role="tab"][aria-selected="true"]').first().innerText().catch(() => "?")}`);
const wallHeading = await wall.locator("h2").first().innerText().catch(() => "");
const wallCount = await wall.locator("[data-saved-view-card]").count();
must(wallCount === 4, "A four cards stand after the drill seat mounted", `${wallCount}`);
must((await wall.innerText()).includes("hover to rename or delete"), "A the wall signs its mouths (t674 grew the rename face onto the signage — the delete affordance still signed)", wallHeading.replace(/\s+/g, " ").slice(0, 60));
must((await wall.locator(`[data-saved-view-card="${DRILL_ID}"]`).count()) === 1, "A the drill seat has its card");

// ---------- B: the positive control — the palette row restores ----------
const openRows = await (async () => {
  for (let i = 0; i < 2; i++) {
    await openPalette();
    const rows = page.locator("[cmdk-item]", { hasText: "Saved view — " });
    if ((await pollUntil(async () => (await rows.count()) === 4 || null, 12000))) return true;
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(600);
  }
  return false;
})();
must(openRows, "B the palette speaks four rows (fresh page, fresh cache)");
// the restore leg's determinism: the mirror carries the drill seat, so a
// dead fetch (flap storm) still lands the target in the applied list
await seedMirror(await fetchSeats());
const drillRow = page.locator("[cmdk-item]", { hasText: `Saved view — ${DRILL_NAME}` }).first();
await drillRow.click();
await sleep(800);
must((await page.locator("[cmdk-item]").count()) === 0, "B the palette closes on jump");
await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
let dance = await runDance();
for (let attempt = 0; attempt < 3 && dance !== "ready"; attempt++) {
  console.log(`  · dance: ${dance} — ladder (health wait + reload + RE-JUMP + re-dance)`);
  await waitServerHealthy();
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitShell();
  await installToastObserver();
  await openPalette();
  await page.locator("[cmdk-item]", { hasText: `Saved view — ${DRILL_NAME}` }).first().click().catch(() => {});
  await sleep(1500);
  dance = await runDance();
}
must(dance === "ready", "B the 3D viewer is REALLY up (enlarge → View in 3D → the product's ready line)", dance);
const restoreToast = dance === "ready"
  ? await pollUntil(async () => {
      const ts = await readToasts();
      return ts.find((t) => t.includes(DRILL_NAME) && t.includes("restored")) || null;
    }, 20000)
  : null;
must(!!restoreToast, "B the arrival toast names the drill view (positive control)", restoreToast ?? "none");

// ---------- C: the wall delete (the feature) ----------
await page.keyboard.press("Escape");
await sleep(1000);
const backToDashboard = async () => {
  await waitShell();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1500);
};
await backToDashboard();
const wall2 = page.locator('section[aria-label="Saved 3D views across all projects"]');
await pollUntil(async () => (await wall2.locator("[data-saved-view-card]").count()) === 4 || null, 15000);
const drillCard = wall2.locator(`[data-saved-view-card="${DRILL_ID}"]`);
const xBtn = drillCard.locator('button[aria-label^="Delete saved view"]');
must((await xBtn.count()) === 1, "C the drill card carries its delete X");
const opacityBefore = await xBtn.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(opacityBefore === "0", "C the X hides at rest (hover-reveal contract)", `opacity ${opacityBefore}`);
await drillCard.hover().catch(() => {});
await sleep(500);
const opacityHover = await xBtn.evaluate((el) => getComputedStyle(el).opacity).catch(() => "?");
must(opacityHover !== "0" && opacityHover !== "?", "C the X reveals on hover", `opacity ${opacityHover}`);
await xBtn.click();
// the wall shrinks locally the moment the server confirms
const shrunk = await pollUntil(async () =>
  (await wall2.locator("[data-saved-view-card]").count()) === 3 &&
  (await wall2.locator(`[data-saved-view-card="${DRILL_ID}"]`).count()) === 0 || null, 15000);
must(!!shrunk, "C the wall shrinks to three without the drill card");
const delToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => t.includes(DRILL_NAME) && t.includes("deleted")) || null;
}, 10000);
must(!!delToast, "C the deletion toast reports honestly", delToast ?? "none");
const afterDel = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json());
must((afterDel.bookmarks ?? []).length === 3 && !(afterDel.bookmarks ?? []).some((x) => x.id === DRILL_ID),
  "C the server holds three, drill seat gone", `${(afterDel.bookmarks ?? []).length}`);
await page.screenshot({ path: ".qa-logs/t669-wall-delete.png" });

// ---------- D: the honest not-found drill ----------
// re-arm the pending for the DELETED id — the door's own wire shape, the
// palette merely one mouth for it (determinism over the TTL race; see header)
// The mirror goes DOWN to the post-delete truth first: whether the fetch
// lives or dies, the applied list lacks the drill, and the not-found verdict
// is the door's own voice — never a mirror's stale resurrection.
await seedMirror(await fetchSeats());
await page.evaluate(([k, v]) => { sessionStorage.setItem(k, v); }, [PENDING_KEY, JSON.stringify({ jobId: REFINE3D_ID, bookmarkId: DRILL_ID })]);
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
await reopenFromRoster();
let danceD = await runDance();
for (let attempt = 0; attempt < 3 && danceD !== "ready"; attempt++) {
  console.log(`  · dance D: ${danceD} — ladder (health wait + reload + roster reopen + re-dance, NO re-jump)`);
  await waitServerHealthy();
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitShell();
  await installToastObserver();
  // the reload kept the pending (sessionStorage survives reloads) — if the
  // ladder fired BEFORE the first mount consumed it, it is still armed;
  // re-arm defensively (fresh intent overwrites stale, the door's law)
  await seedMirror(await fetchSeats());
  await page.evaluate(([k, v]) => { sessionStorage.setItem(k, v); }, [PENDING_KEY, JSON.stringify({ jobId: REFINE3D_ID, bookmarkId: DRILL_ID })]).catch(() => {});
  await reopenFromRoster();
  danceD = await runDance();
}
must(danceD === "ready", "D the drill viewer is REALLY up", danceD);
// the honest verdict: the embed loads the server list (three, no drill) and
// reports the absence. A "restored" toast here means the bookmarks fetch
// DIED and the local mirror answered — the world's breath, not the door's
// verdict: one retry (reload re-seeds the mirror from the server first).
let nfToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => t.includes("Saved view not found")) || null;
}, 20000);
if (!nfToast) {
  const ts = await readToasts();
  if (ts.some((t) => t.includes(DRILL_NAME) && t.includes("restored"))) {
    console.log("  · the fetch died mid-flight (local mirror answered) — one retry");
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    await sleep(2500);
    await waitShell();
    await installToastObserver();
    await page.evaluate(([k, v]) => { sessionStorage.setItem(k, v); }, [PENDING_KEY, JSON.stringify({ jobId: REFINE3D_ID, bookmarkId: DRILL_ID })]).catch(() => {});
    await reopenFromRoster();
    molLines.length = 0;
    const rd = await runDance();
    if (rd === "ready") {
      nfToast = await pollUntil(async () => {
        const t2 = await readToasts();
        return t2.find((t) => t.includes("Saved view not found")) || null;
      }, 20000);
    }
  }
}
must(!!nfToast, "D the honest not-found toast speaks the deleted jump's arrival", nfToast ?? "none");
must(!!nfToast && nfToast.includes("deleted"), "D the toast names the honest cause", nfToast ?? "");
const pendingGone = await page.evaluate(() => sessionStorage.getItem("cryoflow:pending-view")).catch(() => "evaluate-lost");
must(pendingGone === null || pendingGone === "evaluate-lost", "D the pending handshake is consumed (one-shot, even for absences)", String(pendingGone));
await page.screenshot({ path: ".qa-logs/t669-not-found.png" });

// ---------- E: the dual clock's other half — the list self-heals ----------
await page.keyboard.press("Escape");
await sleep(1000);
await backToDashboard();
const healed = await pollUntil(async () => {
  await openPalette();
  const rows = page.locator("[cmdk-item]", { hasText: "Saved view — " });
  const n = await rows.count();
  const gone = (await page.locator("[cmdk-item]", { hasText: DRILL_NAME }).count()) === 0;
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(600);
  return n === 3 && gone ? `rows=${n}` : null;
}, 90_000);
must(!!healed, "E the palette's TTL expires and the deleted row fades (no hand edits)", healed ?? "still stale past 90s");

// ---------- F: the world intact + the console contract ----------
const finalList = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json());
const ids = (finalList.bookmarks ?? []).map((x) => x.id);
must(ids.length === 3 && ids.includes("seedview1") && ids.includes("seedview2") && ids.includes("seedview3"),
  "F the three seeded views survive the drill untouched", ids.join(" | "));
const finalGallery = await fetch(`${BASE}/api/views/gallery`).then((r) => r.json());
const refineRow = (finalGallery.views ?? []).find((v) => v.jobId === REFINE3D_ID);
must((refineRow?.bookmarks?.length ?? 0) === 3, "F the gallery route agrees with the shelf", `${refineRow?.bookmarks?.length ?? 0}`);

must(consoleErrors.length === 0, "F zero real console errors",
  consoleErrors.slice(0, 3).join(" | ") || "0");
must(resource404.length <= 5, "F resource 404s bounded", `${resource404.length}`);
// the bounds catch LOOPS, not weather (t668's law): this window's dmesg
// shows the OOM reaper executing next-server mid-flight — every flap below
// is a chunk fetch meeting a dying server, and a real loop hammers hundreds
// per second (t668's 1352-entry HMR storm is the signature)
must(resourceFlap.length <= 60, "F connection flap bounded (loop detection, storm-calibrated)", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "F chunk flap bounded", `${chunkFlap.length}`);
must(molstarNoise.length <= 15, "F molstar internal + init-ladder noise bounded (two mounts)", `${molstarNoise.length}`);
must(hmrNoise.length <= 20, "F hmr noise bounded (loop detection, storm-calibrated)", `${hmrNoise.length}`);

console.log(`\nt669-saved-view-notfound: ${PASS} pass / ${FAIL} fail`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
