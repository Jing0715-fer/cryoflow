// t675 — the FOURTH EAR: the embed's bookmark list learns to LISTEN.
//
// t669 gave the wall a delete mouth, t670 the palette row, t671 taught the
// embed's commitBookmarks to broadcast (the third mouth), t674 made the
// aggregate mouths full managers (rename + delete on wall card and palette
// row). But the embed — the WRITER whose commits PUT the whole list — never
// heard the family broadcast: its bookmarksRef went stale when a foreign
// mouth renamed or deleted a view of the job it is showing, and the stale
// copy had TEETH: the next quick-save PUT the foreign-deleted row right
// back (resurrection by full-list upsert).
//
// The fix rides the same no-payload event: the embed listens and re-reads
// its OWN route — with a writer's guards (busy gate / offline posture /
// mid-read commit guard / trailing re-read).
//
// Legs (probe-side PUTs seed the world; every mutation below rides the
// product's UI, so every broadcast is a real one):
//   S  the viewer stands with 7 seats (3 seeds + 4 drills), popover open
//   A  palette (over the viewer dialog) deletes drill2 → popover reopened
//      shows 6 rows — the ear heard the foreign delete, no remount
//   B  palette renames drill1 → popover shows the new name (the ear heard)
//   C  the RESURRECTION DRILL: B-key quick-save after the foreign delete →
//      server must NOT hold drill2 again (the stale-copy upsert, killed)
//   E  two rapid local deletes (drill3+drill4) — the busy gate smoke
//   D  the palette hears the embed's own mouths (5 rows incl. quick-save)
//   F  world intact + teardown + noise buckets
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const DRILL_ID = "t675drill";
const DRILL2_ID = "t675drill2";
const DRILL3_ID = "t675drill3";
const DRILL4_ID = "t675drill4";
const DRILL_NAME = "Probe drill alpha";
const DRILL2_NAME = "Probe drill beta";
const DRILL3_NAME = "Probe drill gamma";
const DRILL4_NAME = "Probe drill delta";
const NAME_A2 = "Probe drill alpha II";

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

// ---------- setup: four drill seats (adopt-or-create, API lane); the
// three seeded views are the world-intact witnesses ----------
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
// the three canonical seeds, BY ID — anything else (drills, a previous
// flight's crashed leftover quick-save) is swept by the PUT below
const seeds = ["seedview1", "seedview2", "seedview3"].map((id) => cur0.find((x) => x.id === id));
if (seeds.some((s) => !s)) { console.error(`setup: canonical seed missing (${seeds.map((s) => s?.id ?? "GONE").join(",")})`); process.exit(1); }
const put = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({
    bookmarks: [...seeds, mkSeat(DRILL_ID, DRILL_NAME), mkSeat(DRILL2_ID, DRILL2_NAME), mkSeat(DRILL3_ID, DRILL3_NAME), mkSeat(DRILL4_ID, DRILL4_NAME)],
  }),
});
if (!put.ok) { console.error(`setup PUT failed: ${put.status}`); process.exit(1); }
const verify = await fetchSeats();
console.log(`· setup: four drill seats mounted (${verify.length} total, ${seeds.length} seeds intact)`);

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
const TOAST_RE = /view renamed|already exists|view saved|restored|not found|deleted|could not/i;
const installToastObserver = () =>
  page.evaluate((src) => {
    const re = new RegExp(src, "i");
    const w = window;
    w.__t675Toasts = [];
    const t0 = Date.now();
    if (w.__t675Mo) w.__t675Mo.disconnect();
    w.__t675Mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const t = n.textContent || "";
          if (re.test(t)) w.__t675Toasts.push({ at: Date.now() - t0, text: t.replace(/\s+/g, " ").slice(0, 200) });
        }
      }
    });
    w.__t675Mo.observe(document.body, { childList: true, subtree: true });
    return "observer-on";
  }, TOAST_RE.source);
const readToasts = () => page.evaluate(() => (window.__t675Toasts ?? []).map((t) => t.text)).catch(() => []);
const waitServerHealthy = (timeoutMs = 60000) => pollUntil(async () => {
  const ok = await page.evaluate(async () => {
    try { const r = await fetch("/api/jobs", { cache: "no-store" }); return r.ok; }
    catch { return false; }
  });
  return ok || null;
}, timeoutMs);
const galleryFetches = { n: 0 };
page.on("request", (r) => { if (r.url().includes("/api/views/gallery")) galleryFetches.n++; });

// the loading fingerprint (t671): "— N saved" only after the load lands
const waitFingerprint = (n) => pollUntil(async () =>
  (await page.locator(`button[aria-label="Camera view bookmarks — ${n} saved"]`).count()) > 0 || null, 20000);
const fingerprintNow = async () => {
  const t = await page.locator('button[aria-label^="Camera view bookmarks"]').first().getAttribute("aria-label").catch(() => "");
  const m = (t || "").match(/— (\d+) saved/);
  return m ? Number(m[1]) : -1;
};
// the list lives BEHIND the trigger; one open per click (t673's dance)
const openBookmarkList = async () => {
  // the double-try ring (t670's lesson, popover-sized): the palette's exit
  // animation or a stray focus restore can eat the first trigger click
  for (let i = 0; i < 2; i++) {
    const trig = page.locator('button[aria-label^="Camera view bookmarks"]').first();
    await trig.click().catch(() => {});
    await pollUntil(async () => (await page.locator('button[aria-label^="Rename bookmark"]').count()) > 0 || null, 6000);
    if ((await page.locator('button[aria-label^="Rename bookmark"]').count()) > 0) return true;
    await sleep(600);
  }
  // the failure autopsy: what does the world look like when the popover
  // refuses to open? (aria-expanded = the popover's own state witness)
  const autopsy = await page.evaluate(() => ({
    cmdk: document.querySelectorAll("[cmdk-item]").length,
    trigExpanded: document.querySelector('button[aria-label^="Camera view bookmarks"]')?.getAttribute("aria-expanded"),
    trigCount: document.querySelectorAll('button[aria-label^="Camera view bookmarks"]').length,
    focus: document.activeElement ? `${document.activeElement.tagName}.${String(document.activeElement.className).slice(0, 40)}` : "none",
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    popContent: document.querySelectorAll('[data-canvas-ui="camera-bookmarks"]').length,
  })).catch(() => ({}));
  console.log(`  · openBookmarkList autopsy: ${JSON.stringify(autopsy)}`);
  await page.screenshot({ path: `.qa-logs/t675-popover-refused-${Date.now() % 100000}.png` }).catch(() => {});
  return false;
};
const popRows = () => page.locator('[data-canvas-ui="camera-bookmarks"] button[aria-label^="Delete bookmark"]');
const popHasSeat = async (name) =>
  (await page.locator(`[data-canvas-ui="camera-bookmarks"] button[title*="${name}"]`).count()) > 0;

const openPalette = async () => {
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
};
const savedRows = () => page.locator("[cmdk-item]", { hasText: "Saved view — " });
const closePalette = async () => {
  // t675's layer lesson: a fresh mutation toast is radix's TOPMOST
  // DismissableLayer (react-toast wraps every toast in one) — the first
  // Escape dismisses the TOAST, the second dismisses the palette. One
  // Escape per layer, stacked-dialog grammar. So: press, poll, and only
  // press again if the palette is still standing.
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(700);
  if ((await page.locator("[cmdk-item]").count()) > 0) {
    await page.keyboard.press("Escape").catch(() => {});
    await pollUntil(async () => (await page.locator("[cmdk-item]").count()) === 0 || null, 8000);
  }
  await sleep(400);
};

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(2500);
await waitShell();
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await sleep(1500);

// ---------- S: the viewer stands with seven seats ----------
const reRow = page.locator("[data-roster-row]", { hasText: "3D auto-refine" }).first();
await pollUntil(async () => (await reRow.count()) > 0 || null, 10000);
await reRow.locator('button[title^="Open 3D auto-refine"]').first().click().catch(() => {});
await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
await sleep(1500);
await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
await sleep(1500);
const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
const enlUp = await pollUntil(async () => (await enlarge.count()) > 0 || null, 25000);
must(!!enlUp, "S the Results face offers the enlarge door");
await enlarge.scrollIntoViewIfNeeded().catch(() => {});
await enlarge.click().catch(() => {});
await sleep(1200);
const v3d = page.locator("button", { hasText: "View in 3D" }).first();
if (!(await v3d.count())) { console.log("FAIL: no View in 3D — aborting"); process.exit(1); }
await v3d.click().catch(() => {});
const vr = await waitViewerReady();
must(vr === "ready", "S the viewer is ready", String(vr));
const fpS = await waitFingerprint(7);
must(!!fpS, "S the loading fingerprint says seven saved", `fingerprint ${await fingerprintNow()}`);
const listS = await openBookmarkList();
must(listS, "S the bookmark popover opens");
must((await popRows().count()) === 7, "S the popover lists seven seats", `${await popRows().count()}`);
const molReadyAtStart = molLines.filter((l) => l.includes("] ready")).length;

// ---------- A: the palette (over the viewer) deletes drill2 — the ear hears ----------
await installToastObserver();
await openPalette();
const rowsA = await pollUntil(async () => (await savedRows().count()) === 7 || null, 12000);
must(!!rowsA, "A the palette speaks seven rows OVER the viewer dialog", `${await savedRows().count()} saved-view rows`);
const d2row = page.locator(`[data-palette-savedview-row="${DRILL2_ID}"]`).first();
await d2row.hover().catch(() => {});
await sleep(400);
await d2row.locator(`button[data-palette-savedview-delete="${DRILL2_ID}"]`).click();
const aToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /deleted/i.test(t) && t.includes(DRILL2_NAME)) || null;
}, 10000);
must(!!aToast, "A the palette's delete toast speaks", aToast ?? "none");
const rowsAfterDel = await pollUntil(async () => (await savedRows().count()) === 6 || null, 8000);
must(!!rowsAfterDel, "A the palette row shrank in place", `${await savedRows().count()} rows`);
// t675's focus law: the clicked X took its row (and the shell-focus dead
// zone would have taken the next Escape) — the mutation parks focus back
// on the search input, the palette's keyboard grammar home
const parked = await page.evaluate(() =>
  document.activeElement === document.querySelector("[cmdk-input]") || null);
must(!!parked, "A focus parked on the search input after the row mutation (the grammar stays alive)");
await page.screenshot({ path: ".qa-logs/t675-palette-over-viewer.png" });
await closePalette();
// the ear's verdict: reopen the popover — six rows, drill2 gone, NO remount
const reListA = await openBookmarkList();
must(reListA, "A the bookmark popover reopens after the palette");
const rowsInPop = await pollUntil(async () => (await popRows().count()) === 6 || null, 8000);
must(!!rowsInPop, "A the EMBED's list shrank to six — the fourth ear heard the foreign delete (no remount, no reload)", `${await popRows().count()} rows`);
must(!(await popHasSeat(DRILL2_NAME)), "A drill2 is gone from the embed's list");
must((await fingerprintNow()) === 6, "A the trigger's fingerprint follows the ear", `fingerprint ${await fingerprintNow()}`);
must(molLines.filter((l) => l.includes("] ready")).length === molReadyAtStart, "A no viewer remount happened (one lifecycle, still)");

// ---------- B: the palette renames drill1 — the ear hears that too ----------
await installToastObserver();
await openPalette();
const d1row = page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).first();
await d1row.hover().catch(() => {});
await sleep(400);
await d1row.locator(`button[data-palette-savedview-rename="${DRILL_ID}"]`).click();
const bInput = d1row.locator(`input[data-palette-savedview-rename-input="${DRILL_ID}"]`);
await pollUntil(async () => (await bInput.count()) === 1 || null, 8000);
await bInput.fill(NAME_A2);
await page.keyboard.press("Enter");
const bToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /view renamed/i.test(t) && t.includes(NAME_A2)) || null;
}, 10000);
must(!!bToast, "B the palette's rename toast speaks", bToast ?? "none");
await closePalette();
// leg B's own Control+k closed the popover (focus-outside) — reopen before
// asking the embed's list what it heard
const reListB = await openBookmarkList();
must(!!reListB, "B the bookmark popover reopens after the rename");
const rowsInPopB = await pollUntil(async () =>
  (await popRows().count()) === 6 && (await popHasSeat(NAME_A2)) || null, 8000);
must(!!rowsInPopB, "B the embed's list shows the palette's new name — the ear heard the foreign rename", `rows ${await popRows().count()}`);

// ---------- C: the RESURRECTION DRILL — quick-save after the foreign delete ----------
// the old world: bookmarksRef still held drill2 → the B-key's full-list PUT
// would resurrect it. The fourth ear re-read the truth: drill2 must stay dead.
await installToastObserver();
await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
await page.keyboard.press("b");
const cToast = await pollUntil(async () => {
  const ts = await readToasts();
  return ts.find((t) => /view saved/i.test(t)) || null;
}, 10000);
must(!!cToast, "C the B-key quick-save speaks", cToast ?? "none");
const seatsC = await pollUntil(async () => {
  const s = await fetchSeats();
  return s.length === 7 ? s : null;
}, 10000);
must(!!seatsC, "C the server holds seven seats (6 + the quick-save)", `${(await fetchSeats()).length}`);
must(!seatsC.some((x) => x.id === DRILL2_ID), "C drill2 was NOT resurrected by the full-list PUT (the money shot)", seatsC.some((x) => x.id === DRILL2_ID) ? "RESURRECTED" : "absent");
must(seatsC.some((x) => x.name === "View 7"), "C the quick-saved view is on the server", seatsC.find((x) => x.name === "View 7")?.name ?? "missing");
must((await fingerprintNow()) === 7, "C the fingerprint counts the quick-save", `fingerprint ${await fingerprintNow()}`);
must(await popHasSeat("View 7"), "C the embed's list shows the quick-saved row");
await page.screenshot({ path: ".qa-logs/t675-fourth-ear.png" });

// ---------- E: two rapid local deletes — the busy gate holds the mirror ----------
const d3x = page.locator(`button[aria-label="Delete bookmark ${DRILL3_NAME}"]`).first();
await d3x.click().catch(() => {});
await sleep(250);
await page.locator(`button[aria-label="Delete bookmark ${DRILL4_NAME}"]`).first().click().catch(() => {});
const seatsE = await pollUntil(async () => {
  const s = await fetchSeats();
  return s.length === 5 ? s : null;
}, 12000);
must(!!seatsE, "E both rapid deletes landed (five seats)", `${(await fetchSeats()).length}`);
const seatsENow = seatsE ?? (await fetchSeats());
must(!seatsENow.some((x) => x.id === DRILL3_ID || x.id === DRILL4_ID), "E drill3 and drill4 are both gone from the server");
const rowsInPopE = await pollUntil(async () => (await popRows().count()) === 5 || null, 8000);
must(!!rowsInPopE, "E the embed's list ends consistent (no intermediate clobber)", `${await popRows().count()} rows`);

// ---------- D: the palette hears the embed's own mouths ----------
await openPalette();
const rowsD = await pollUntil(async () => (await savedRows().count()) === 5 || null, 10000);
must(!!rowsD, "D the palette speaks five rows (the embed's save + deletes all broadcast)", `${await savedRows().count()}`);
must((await page.locator("[cmdk-item]", { hasText: "View 7" }).count()) >= 1, "D the quick-saved view is in the palette (the embed's own mouth is still heard)");
must((await page.locator("[cmdk-item]", { hasText: NAME_A2 }).count()) >= 1, "D the renamed drill carries its new name");
await closePalette();

// ---------- F: world intact + teardown + noise buckets ----------
const seatsF = await fetchSeats();
must(seeds.every((s) => seatsF.some((x) => x.id === s.id && x.name === s.name)),
  "F the three seeded views keep their names (the drills came and went without a trace)");
const teard = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: seeds }),
});
must(teard.ok, "F the teardown restored the three seeds", `status ${teard.status}`);
const seatsAfterT = await fetchSeats();
must(seatsAfterT.length === 3, "F the world is back to three seats", `${seatsAfterT.length}`);

must(consoleErrors.length === 0, "F console: zero real errors", consoleErrors.slice(0, 3).join(" | ") || "clean");
must(resource404.length === 0, "F console: zero 404s", `${resource404.length}`);
must(molstarNoise.length === 0, "F the molstar surface stayed healthy", `${molstarNoise.length}`);
must(chunkFlap.length === 0, "F zero chunk flaps", `${chunkFlap.length}`);
must(resourceFlap.length <= 2, "F resource flaps bounded", `${resourceFlap.length}`);
must(hmrNoise.length <= 4, "F hmr noise bounded", `${hmrNoise.length}`);

console.log(`\n==== t675 fourth-ear: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
