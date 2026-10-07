// t668 — the Saved views deep link's second act: the palette's FOURTH
// gallery family, and the first one fed by a server route instead of the
// store. The world was shipped-dark (BookmarkSession empty since day one —
// the dashboard wall and the palette group were both a promise with no
// rows); the seeder now gives the refine3d half-map world three named
// camera bookmarks (a real MIP thumbnail derived from the REAL volume
// bytes), and the palette group rides the dashboard wall's OWN jump recipe
// verbatim: PENDING_VIEW_KEY in sessionStorage + openJob with the
// cross-project hint — the embed consumes it when the 3D viewer mounts
// (enlarge → View in 3D), flies to the view, and toasts. Same door, same
// behavior: a palette row that promises a saved view must restore exactly
// what the dashboard card restores — nothing more, nothing less.
//
// Probe contract:
//   A  the world speaks saved views (the route the palette reads).
//   B  the palette's Saved views group: heading count, three rows, REAL
//      thumb pixels, and the TTL cache (second open costs zero requests).
//   C  the jump: lands on the refine3d inspector; the 3D viewer dance
//      completes; the toast names the view — the handshake's arrival.
//   D  one-shot: the pending is consumed; a second viewer mount does not
//      re-restore (a lingering link can never re-open — the Task 81 law).
//   E  a second jump restores the SECOND view (fresh intent overwrites).
//   F  the console contract — five buckets. 📸×2.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
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
  // the embed's init-failure line is the LADDER'S OWN INPUT (waitViewerReady
  // reads it to trigger recovery) — a transient death the ladder heals, not
  // a terminal verdict (the t665 scar doctrine: outcome is not on the wire)
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
  // a ChunkLoadError surfacing as an uncaught pageerror is the SAME
  // compile-window flap fingerprint as its console twin — same bucket
  if (/Failed to load chunk/.test(e.message)) { chunkFlap.push(e.message); return; }
  // molstar's own assertUnreachable (mol-util/type-helpers.js) throws the
  // bare string 'unreachable' from inside its exhaustive switches — a
  // third-party internal that fired WHILE the restore toast succeeded
  // (diag-t668 + flight 3): library noise, not product voice
  if (e.message === "unreachable") { molstarNoise.push(e.message); return; }
  consoleErrors.push(`pageerror: ${e.message}`);
});

// the product's OWN lifecycle lines — the honest readiness milestone.
// canvas3d existence is a LIE: window.__molstar is armed before the init
// chain finishes, and an OOM-truncated compile surfaces as
// "olstar] init failed ChunkLoadError" with canvas3d already true — the
// first flight proved that gap (diag-t668: plugin created, map fetched,
// init failed, phase=error, bookmark effect never ran).
const molLines = [];
page.on("console", (m) => {
  if (/olstar\]/.test(m.text())) molLines.push(m.text().slice(0, 120));
});
const waitViewerReady = (timeoutMs = 150000) => pollUntil(async () => {
  if (molLines.some((l) => l.includes("init failed"))) return "failed";
  if (molLines.some((l) => l.endsWith("] ready") || l.includes("] ready"))) return "ready";
  return null;
}, timeoutMs);

// wire counter for the palette's gallery route (B's cache assertion)
let galleryRequests = 0;
page.on("request", (r) => {
  if (/\/api\/views\/gallery(\?|$)/.test(r.url())) galleryRequests++;
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);

// the toast recorder (qa48's observer form): the restore toast is the
// handshake's arrival fingerprint, and its 5s lifetime is shorter than
// some polls — record every toast text as it mounts, read the log later.
// REINSTALLABLE: a page reload wipes the window — the instrument rides
// the recovery ladder like every other tool (first-flight lesson).
const waitShell = () =>
  pollUntil(async () =>
    ((await page.locator('[role="tab"]').count()) > 0 &&
      (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);
const installToastObserver = () =>
  page.evaluate(() => {
    const w = window;
    w.__t668Toasts = [];
    const t0 = Date.now();
    if (w.__t668Mo) w.__t668Mo.disconnect();
    w.__t668Mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const t = n.textContent || "";
          if (/restored|Saved view|not found/i.test(t)) {
            w.__t668Toasts.push({ at: Date.now() - t0, text: t.replace(/\s+/g, " ").slice(0, 200) });
          }
        }
      }
    });
    w.__t668Mo.observe(document.body, { childList: true, subtree: true });
    return "observer-on";
  });
const readToasts = () => page.evaluate(() => (window.__t668Toasts ?? []).map((t) => t.text))
  .catch(() => []);
await installToastObserver();

// ---------- A: the world speaks saved views ----------
const gallery = await page.evaluate(async () => {
  const r = await fetch("/api/views/gallery", { cache: "no-store" });
  return { status: r.status, body: await r.json() };
});
must(gallery.status === 200, "A the views gallery route answers 200", `${gallery.status}`);
const views = gallery.body.views ?? [];
must(views.length >= 1, "A the world has at least one bookmark-bearing job", `${views.length} views`);
const refine = views.find((v) => v.jobId === REFINE3D_ID);
must(!!refine, "A the refine3d half-map world is on the shelf");
must((refine?.bookmarks?.length ?? 0) === 3, "A three saved views ride the job", `${refine?.bookmarks?.length ?? 0}`);
must((refine?.bookmarks ?? []).every((bm) => typeof bm.thumb === "string" && bm.thumb.startsWith("data:image/png;base64,")),
  "A the thumbs are honest data-URL PNGs");
const names = (refine?.bookmarks ?? []).map((bm) => bm.name);
must(names.includes("Centered iso view") && names.includes("Top-down slice") && names.includes("Front half clipped"),
  "A the three views carry their story names", names.join(" | "));

// ---------- B: the palette's Saved views group ----------
const openPalette = async () => {
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
};
await openPalette();
const svHeading = page.locator("[cmdk-group-heading]", { hasText: "Saved views · " });
await pollUntil(async () => (await svHeading.count()) > 0 || null, 15000);
must((await svHeading.count()) === 1, "B the Saved views group speaks", (await svHeading.innerText().catch(() => "")).trim());
const svRows = page.locator("[cmdk-item]", { hasText: "Saved view — " });
must((await svRows.count()) === 3, "B three rows, one per bookmark", `${await svRows.count()}`);
const thumbReady = await pollUntil(async () => {
  const imgs = svRows.locator("[data-palette-savedview-thumb]");
  const n = await imgs.count();
  if (n !== 3) return null;
  for (let i = 0; i < n; i++) {
    const okImg = await imgs.nth(i).evaluate((el) => el.complete && el.naturalWidth > 0).catch(() => false);
    if (!okImg) return null;
  }
  return true;
}, 15000);
must(!!thumbReady, "B the thumbs really render (naturalWidth > 0)");
const rowJob = await svRows.first().innerText();
must(rowJob.includes("3D auto-refine"), "B the row names its home job", rowJob.replace(/\s+/g, " ").slice(0, 50));
mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t668-palette-saved-views.png" });
// the TTL cache: close and reopen within the window — zero new requests
const before = galleryRequests;
await page.keyboard.press("Escape");
await sleep(800);
await openPalette();
await sleep(1000);
must(galleryRequests === before, "B the second open costs zero gallery requests (TTL cache)",
  `${galleryRequests} == ${before}`);

// ---------- C: the jump — land, dance, restore ----------
const jumpRow = page.locator("[cmdk-item]", { hasText: "Saved view — Centered iso view" }).first();
await jumpRow.click();
await sleep(800);
must((await page.locator("[cmdk-item]").count()) === 0, "C the palette closes on jump");
await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
must((await page.locator('[role="dialog"]').count()) > 0, "C the inspector opens on the jumped job");
// t662's dance: Results tab → enlarge → View in 3D → __molstar ready
await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
await sleep(1500);
const runDance = async () => {
  molLines.length = 0; // each mount speaks its OWN lifecycle — stale lines are a prior page's voice
  const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
  const enlUp = await pollUntil(async () => (await enlarge.count()) > 0 || null, 15000);
  if (!enlUp) return "no-enlarge";
  await enlarge.scrollIntoViewIfNeeded().catch(() => {});
  await enlarge.click().catch(() => {});
  await sleep(1200);
  const v3d = page.locator("button", { hasText: "View in 3D" }).first();
  if (!(await v3d.count())) return "no-view3d";
  await v3d.click().catch(() => {});
  // the lifecycle line is the milestone — not canvas3d (see waitViewerReady)
  return (await waitViewerReady()) || "no-lifecycle";
};
let dance = await runDance();
let restoreToast = null;
for (let attempt = 0; attempt < 2 && dance !== "ready"; attempt++) {
  console.log(`  · dance: ${dance} — recovery ladder (reload + RE-JUMP + re-dance)`);
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitShell();
  await installToastObserver(); // the instrument rides the ladder too
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
  await page.locator("[cmdk-item]", { hasText: "Saved view — Centered iso view" }).first().click().catch(() => {});
  await sleep(1500);
  await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
  await sleep(1500);
  dance = await runDance();
}
must(dance === "ready", "C the 3D viewer is REALLY up (enlarge → View in 3D → the product's own ready line)", dance);
if (dance === "ready") {
  // two honest outcomes ride the same consumer: the restore toast, or —
  // when the OOM regime killed the camera-bookmarks fetch and the local
  // mirror is empty — the embed's HONEST "Saved view not found". The
  // latter is a casualty of the world, not the link: one RE-JUMP retry
  // (fresh intent re-arms) before declaring failure.
  restoreToast = await pollUntil(async () => {
    const toasts = await readToasts();
    return toasts.find((t) => t.includes("Centered iso view") && (t.includes("restored") || t.includes("not found"))) || null;
  }, 20000);
  if (restoreToast && restoreToast.includes("not found")) {
    console.log("  · the fetch died mid-flight (honest not-found) — one re-jump retry");
    molLines.length = 0;
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    await sleep(2500);
    await waitShell();
    await installToastObserver();
    await page.keyboard.press("Control+k");
    await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
    await page.locator("[cmdk-item]", { hasText: "Saved view — Centered iso view" }).first().click().catch(() => {});
    await sleep(1500);
    await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
    await sleep(1500);
    dance = await runDance();
    if (dance === "ready") {
      restoreToast = await pollUntil(async () => {
        const toasts = await readToasts();
        return toasts.find((t) => t.includes("Centered iso view") && t.includes("restored")) || null;
      }, 20000);
    }
  }
}
must(!!restoreToast && restoreToast.includes("restored"), "C the arrival toast names the view (the handshake's fingerprint)", restoreToast ?? "none");
must(!!restoreToast && restoreToast.includes("Jumped here"), "C the arrival speaks its door", restoreToast ?? "");
await page.screenshot({ path: ".qa-logs/t668-view-arrival.png" });

// ---------- D: one-shot — the consumed link never re-opens ----------
const pendingGone = await page.evaluate(() => sessionStorage.getItem("cryoflow:pending-view"));
must(pendingGone === null, "D the pending handshake is consumed (sessionStorage clean)", String(pendingGone));
// close the dialog, reopen the job from the ROSTER (the t667-proven
// dance: dashboard tab → roster row's Open button), walk the dance again.
// LADDER NOTE: the recovery here must NEVER re-jump via the Saved views
// row — that re-arms the pending and would falsify the one-shot verdict.
// Reload + roster reopen only.
await page.keyboard.press("Escape");
await sleep(1000);
const reopenFromRoster = async () => {
  await waitShell();
  await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
  await sleep(1500);
  const reRow = page.locator("[data-roster-row]", { hasText: "3D auto-refine" }).first();
  await pollUntil(async () => (await reRow.count()) > 0 || null, 10000);
  await reRow.locator('button[title^="Open 3D auto-refine"]').first().click().catch(() => {});
  await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
  await sleep(1500);
  await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
  await sleep(1500);
};
await reopenFromRoster();
// the one-shot verdict is a DELTA: on a same-page path the toast log still
// carries C's restore toast; after a ladder reload the fresh log starts at
// zero — either way, "no restore toast NEW IN THIS WINDOW" is the assertion
const dBaseline = (await readToasts()).length;
let dance2 = await runDance();
if (dance2 !== "ready") {
  console.log(`  · dance #2: ${dance2} — ladder (reload + roster reopen, NO re-jump)`);
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await installToastObserver();
  await reopenFromRoster();
  dance2 = await runDance();
}
must(dance2 === "ready", "D the second viewer mount is REALLY up", dance2);
await sleep(6000); // longer than the toast's 5s life — absence is the assertion
const dNew = (await readToasts()).slice(dBaseline);
must(!dNew.some((t) => t.includes("restored")), "D no NEW restore toast in this window (one-shot semantics)",
  dNew.find((t) => t.includes("restored")) ?? `${dNew.length} toasts since baseline, none restore`);

// ---------- E: the second jump restores the second view ----------
await page.keyboard.press("Escape");
await sleep(1000);
// the palette may not open on a post-ladder page (hydration still settling
// under memory pressure) — one reload + retry, the t664 ladder doctrine
let jump2Done = false;
for (let i = 0; i < 2 && !jump2Done; i++) {
  await page.keyboard.press("Control+k");
  const rowsUp = await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
  const jump2 = page.locator("[cmdk-item]", { hasText: "Saved view — Top-down slice" }).first();
  if (rowsUp && (await pollUntil(async () => (await jump2.count()) > 0 || null, 10000))) {
    await jump2.click();
    jump2Done = true;
  } else {
    console.log(`  · palette attempt ${i + 1} stranded — reload + retry`);
    await page.keyboard.press("Escape").catch(() => {});
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
    await sleep(2500);
    await waitShell();
    await installToastObserver();
  }
}
must(jump2Done, "E the second jump issued from the palette");
await sleep(800);
await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
await sleep(1500);
await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
await sleep(1500);
let dance3 = await runDance();
if (dance3 !== "ready") {
  console.log(`  · dance #3: ${dance3} — ladder (reload + RE-JUMP + re-dance)`);
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await sleep(2500);
  await waitShell();
  await installToastObserver();
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
  await page.locator("[cmdk-item]", { hasText: "Saved view — Top-down slice" }).first().click().catch(() => {});
  await sleep(1500);
  await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
  await sleep(1500);
  dance3 = await runDance();
}
must(dance3 === "ready", "E the third viewer mount is REALLY up (fresh intent, same door)", dance3);
const restore2 = await pollUntil(async () => {
  const toasts = await readToasts();
  return toasts.find((t) => t.includes("Top-down slice") && t.includes("restored")) || null;
}, 20000);
must(!!restore2, "E the second jump restores the second view", restore2 ?? "none");

// ---------- F: the console contract ----------
must(consoleErrors.length === 0, "F zero real console errors",
  consoleErrors.slice(0, 3).join(" | ") || "0");
must(resource404.length <= 5, "F resource 404s bounded", `${resource404.length}`);
// the OOM regime kills connections mid-flight and the ladders heal them —
// two ladders' worth of transient deaths is the world's honest voice, not a
// runaway loop (the bounds exist to catch loops, not to punish recoveries)
must(resourceFlap.length <= 10, "F connection flap bounded", `${resourceFlap.length}`);
must(chunkFlap.length <= 5, "F chunk flap bounded", `${chunkFlap.length}`);
// the noise floor for THREE viewer mounts measured across flights 3-11:
// 3-13 entries (molstar's own asserts + ladder-healed init deaths); the
// 1352 runaway in flight 10's HMR storm is what this bound exists to catch
must(molstarNoise.length <= 20, "F molstar internal + init-ladder noise bounded", `${molstarNoise.length}`);
must(hmrNoise.length <= 5, "F hmr noise bounded", `${hmrNoise.length}`);

console.log(`\nt668-saved-view-deeplink: ${PASS} pass / ${FAIL} fail`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
