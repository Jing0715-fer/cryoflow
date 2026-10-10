// diag-t674 — why did the dupe warning toast escape the observer?
// Replays the F leg precisely and dumps BOTH the observer's array AND the
// live DOM (toasts are near-permanent: TOAST_REMOVE_DELAY=1e6 — if the
// amber toast ever mounted, it is still in the body right now).
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const DRILL_ID = "t674diag";
const DRILL_NAME = "Diag dupe seat";

const mkSeat = (id, name) => ({
  id, name, ts: Date.now(),
  snapshot: { mode: "iso", fov: 0.876, position: [42.7, 38.1, 95.3], up: [0, 1, 0], target: [0, 0, 0], radius: 63.2, radiusMax: 110.4, fog: 0, clipFar: 0, minNear: 0, minFar: 0 },
  view: { sigma: 2.5, sign: 1, slice: { on: true, axis: "Z", pos: 0.35 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
});
const seed = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json());
const seeded = (seed.bookmarks ?? []).filter((x) => !x.id.startsWith("t674diag"));
await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: [...seeded, mkSeat(DRILL_ID, DRILL_NAME)] }),
});

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message.slice(0, 200)));
const toastErrs = [];
page.on("console", (m) => { if (m.type() === "error") toastErrs.push(m.text().slice(0, 160)); });

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(2500);
await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await page.waitForTimeout(1500);

// observer identical to t674's
await page.evaluate(() => {
  const w = window;
  w.__toasts = [];
  const re = /view renamed|already exists|could not|restored|not found|deleted/i;
  w.__mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = n.textContent || "";
        if (re.test(t)) w.__toasts.push(t.replace(/\s+/g, " ").slice(0, 150));
      }
    }
  });
  w.__mo.observe(document.body, { childList: true, subtree: true });
  return "on";
});

await page.keyboard.press("Control+k");
await page.waitForTimeout(1500);
const row = page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).first();
console.log("row count:", await row.count());
await row.hover().catch((e) => console.log("hover err", e.message));
await page.waitForTimeout(400);
await row.locator(`button[data-palette-savedview-rename="${DRILL_ID}"]`).click();
const input = row.locator(`input[data-palette-savedview-rename-input="${DRILL_ID}"]`);
console.log("input count:", await input.count());
await input.fill("seedview1");
await page.keyboard.press("Enter");
await page.waitForTimeout(2000);
console.log("--- pass 1 (id as name, expect NO dupe):", JSON.stringify(await page.evaluate(() => window.__toasts ?? [])));

// pass 2 — the REAL dupe: rename onto a sibling's actual NAME
await page.evaluate(() => { window.__toasts = []; });
await row.hover().catch(() => {});
await page.waitForTimeout(300);
await row.locator(`button[data-palette-savedview-rename="${DRILL_ID}"]`).click();
const input2 = row.locator(`input[data-palette-savedview-rename-input="${DRILL_ID}"]`);
const realName = (await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json())).bookmarks?.find((x) => x.id === "seedview1")?.name;
console.log("dupe target (seedview1's real name):", realName);
await input2.fill(realName ?? "Centered iso view");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
console.log("--- pass 2 (real sibling name, expect already-exists):", JSON.stringify(await page.evaluate(() => window.__toasts ?? [])));
console.log("DOM has 'already exists':", await page.evaluate(() => document.body.innerText.includes("already exists")));
console.log("DOM toast-ish text:",
  await page.evaluate(() => {
    const hits = [];
    for (const el of document.querySelectorAll("[data-radix-collection-item], li, [role='status'], [data-sonner-toast]")) {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (/already exists|renamed|could not/i.test(t) && t.length < 220) hits.push(t);
    }
    return hits.slice(0, 6);
  }));
console.log("server name now:", (await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json())).bookmarks?.find((x) => x.id === DRILL_ID)?.name);
console.log("console errors:", toastErrs.slice(0, 4));

// teardown
const after = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json());
await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: (after.bookmarks ?? []).filter((x) => x.id !== DRILL_ID) }),
});
await b.close();
