// t133 — Task 133: job palette FAVORITES (starred types):
//
//   star     — a hover-revealed star on every palette row (reserved slot —
//              the tier badge never shifts; span, not a nested button —
//              invalid DOM inside the row's own button; pointerdown is
//              swallowed so starring never starts a drag)
//   chips    — starred types gather in a "Favorites" chip row ABOVE
//              Recently used (deliberate beats ephemeral); click adds at
//              the viewport center, same dialect as recents
//   favOnly  — a header star toggle filters the catalog to favorites
//              (search narrows WITHIN it); honest empty state with a
//              "Show all types" way out
//   persist  — localStorage cryoflow-fav-types, star order, sanitize-or-
//              default (same contract as recents)
//
// Phase S — clean localStorage, snapshot the job roster (chip-click
//           cleanup material).
// Phase B — star Motion Correction: chip row appears, storage honest.
// Phase C — star CTFFind: two chips in STAR ORDER, count badge "2".
// Phase D — chip click really adds a job (tracked for cleanup).
// Phase E — favorites-only filter: catalog 36→2, search narrows within,
//           unstar-while-filtered updates chips AND catalog.
// Phase F — the empty state is honest and escapable ("Show all types").
// Phase G — persistence: re-star two types, reload → chips survive in
//           star order with stars still pressed.
// Phase H — screenshot.
// Phase Z — console clean, localStorage key cleared, roster restored.
//
// Run: node scripts/t133-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t133-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const tmp = mkdtempSync(join(tmpdir(), "t133-"));
const addedJobIds = [];

const api = async (path, method = "GET") =>
  fetch(BASE + path, { method });

const jobIds = async () =>
  (await (await api("/api/jobs")).json())?.jobs?.map((j) => j.id) ?? [];

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  // jobs added by chip clicks go home; localStorage dies with the browser
  for (const id of addedJobIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}

const must = (cond, label) => {
  if (!cond) {
    console.log(`FAIL: ${label}`);
    void cleanup().then(() => process.exit(1));
    throw new Error(`FAIL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};
const step = (m) => console.log(m);
process.on("SIGINT", () => { console.log("SIGINT"); process.exit(1); });
process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(1); });

/** expand every collapsed palette category — rows inside collapsed
 *  sections are grid-rows-[0fr] ghosts the sticky header shadows */
const expandAll = async () => {
  for (let i = 0; i < 20; i++) {
    const collapsed = p
      .locator('nav[aria-label="RELION 5 job type catalog"] button[aria-expanded="false"]')
      .first();
    if ((await collapsed.count()) === 0) break;
    await collapsed.click();
    await sleep(120);
  }
  await sleep(200);
};

/** hover the palette row of a type and click its star; force click —
 *  the star may be opacity-0 pre-hover and sticky category headers
 *  legally overlap rows at the nav's top edge */
const starType = async (key) => {
  await expandAll();
  const star = p.locator(`[data-testid="palette-star-${key}"]`);
  await star.scrollIntoViewIfNeeded();
  await sleep(200);
  await star.click({ force: true });
  await sleep(250);
};

async function main() {
  step("=== t133 — job palette favorites (starred types) ===");

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  /* ---------------- Phase S — clean slate ---------------- */
  step("--- Phase S: clean localStorage + roster snapshot ---");
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  await p.evaluate(() => {
    localStorage.removeItem("cryoflow-fav-types");
    localStorage.removeItem("cryoflow-recent-types");
  });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1200);
  const rosterBefore = await jobIds();
  must(Array.isArray(rosterBefore), `S1 roster snapshotted (${rosterBefore.length} jobs)`);
  must(
    (await p.locator('[data-testid="palette-fav-filter"]').count()) === 1,
    "S2 favorites filter toggle present in the palette header"
  );
  must((await p.locator('[data-testid="palette-favs-row"]').count()) === 0, "S3 no favorites row on a clean slate");
  must(
    (await p.locator('[data-testid="palette-fav-filter"]').getAttribute("aria-pressed")) === "false",
    "S4 favorites-only filter starts off"
  );
  await expandAll();

  /* ---------------- Phase B — first star ---------------- */
  step("--- Phase B: starring Motion Correction ---");
  await starType("motioncorr");
  must((await p.locator('[data-testid="palette-favs-row"]').count()) === 1, "B1 favorites chip row appeared");
  must((await p.locator('[data-testid="palette-fav-chip-motioncorr"]').count()) === 1, "B2 motioncorr chip present");
  must(
    (await p.evaluate(() => localStorage.getItem("cryoflow-fav-types"))) === JSON.stringify(["motioncorr"]),
    "B3 storage honest ([\"motioncorr\"])"
  );
  must(
    (await p.locator('[data-testid="palette-star-motioncorr"]').getAttribute("aria-pressed")) === "true",
    "B4 row star reports pressed"
  );
  must(
    (await p.locator('[data-testid="palette-favs-count"]').innerText()) === "1",
    "B5 favorites count badge reads 1"
  );

  /* ---------------- Phase C — second star, order matters ---------------- */
  step("--- Phase C: starring CTFFind — star order ---");
  await starType("ctffind");
  const chipIds = await p.locator('[data-testid="palette-favs-row"] [data-testid^="palette-fav-chip-"]').evaluateAll(
    (els) => els.map((e) => e.getAttribute("data-testid"))
  );
  must(
    JSON.stringify(chipIds) ===
      JSON.stringify(["palette-fav-chip-motioncorr", "palette-fav-chip-ctffind"]),
    `C1 chips in star order (${chipIds.join(", ")})`
  );
  must(
    (await p.evaluate(() => localStorage.getItem("cryoflow-fav-types"))) ===
      JSON.stringify(["motioncorr", "ctffind"]),
    "C2 storage honest, star order"
  );

  /* ---------------- Phase D — chip click really adds ---------------- */
  step("--- Phase D: clicking a favorites chip adds the job ---");
  await p.locator('[data-testid="palette-fav-chip-motioncorr"]').click();
  await sleep(1200); // POST /api/jobs round-trip
  const rosterAfter = await jobIds();
  const fresh = rosterAfter.filter((id) => !rosterBefore.includes(id));
  must(fresh.length === 1, `D1 exactly one job added (${fresh.length})`);
  addedJobIds.push(...fresh);
  const freshJob = (await (await api("/api/jobs")).json()).jobs.find((j) => j.id === fresh[0]);
  must(freshJob?.type === "motioncorr", `D2 the added job is a Motion Correction (${freshJob?.type})`);

  /* ---------------- Phase E — favorites-only filter ---------------- */
  step("--- Phase E: favorites-only narrows the catalog ---");
  await p.locator('[data-testid="palette-fav-filter"]').click();
  await sleep(300);
  must(
    (await p.locator('[data-testid="palette-fav-filter"]').getAttribute("aria-pressed")) === "true",
    "E1 filter toggle pressed"
  );
  await sleep(200);
  const visibleRows = await p.locator('button[aria-label^="Drag to canvas to add"]').count();
  must(visibleRows === 2, `E2 catalog narrowed to the 2 favorites (${visibleRows})`);
  await p.getByLabel("Search job types").fill("ctf");
  await sleep(300);
  must(
    (await p.locator('button[aria-label^="Drag to canvas to add"]').count()) === 1,
    "E3 search narrows WITHIN favorites (1 row)"
  );
  await p.getByLabel("Search job types").fill("");
  await sleep(300);
  // unstar while filtered — chips AND catalog both react
  await p.locator('[data-testid="palette-star-motioncorr"]').scrollIntoViewIfNeeded();
  await sleep(200);
  await p.locator('[data-testid="palette-star-motioncorr"]').click({ force: true });
  await sleep(300);
  must((await p.locator('[data-testid="palette-fav-chip-motioncorr"]').count()) === 0, "E4 unstar removes the chip");
  must(
    (await p.locator('button[aria-label^="Drag to canvas to add"]').count()) === 1,
    "E5 catalog re-narrows to ctffind only"
  );

  /* ---------------- Phase F — honest empty state ---------------- */
  step("--- Phase F: favorites-only with zero favorites ---");
  await p.locator('[data-testid="palette-star-ctffind"]').scrollIntoViewIfNeeded();
  await sleep(200);
  await p.locator('[data-testid="palette-star-ctffind"]').click({ force: true });
  await sleep(300);
  must((await p.locator('[data-testid="palette-favs-empty"]').count()) === 1, "F1 empty state honest");
  await p.getByRole("button", { name: "Show all types" }).click();
  await sleep(300);
  must(
    (await p.locator('button[aria-label^="Drag to canvas to add"]').count()) === 36,
    "F2 Show all restores the full catalog (36 types)"
  );
  must((await p.locator('[data-testid="palette-favs-row"]').count()) === 0, "F3 favorites row gone (shelf empty)");

  /* ---------------- Phase G — persistence across reload ---------------- */
  step("--- Phase G: stars survive a reload, in star order ---");
  await starType("extract");
  await starType("class2d");
  must(
    (await p.evaluate(() => localStorage.getItem("cryoflow-fav-types"))) ===
      JSON.stringify(["extract", "class2d"]),
    "G1 two types starred, storage honest"
  );
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(1500);
  await expandAll();
  const chipsAfter = await p
    .locator('[data-testid="palette-favs-row"] [data-testid^="palette-fav-chip-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  must(
    JSON.stringify(chipsAfter) ===
      JSON.stringify(["palette-fav-chip-extract", "palette-fav-chip-class2d"]),
    `G2 chips survive reload in star order (${chipsAfter.join(", ")})`
  );
  must(
    (await p.locator('[data-testid="palette-star-extract"]').getAttribute("aria-pressed")) === "true",
    "G3 row star still pressed after reload"
  );

  /* ---------------- Phase H — visual ---------------- */
  step("--- Phase H: screenshot ---");
  await p.screenshot({ path: `${OUT}/t133-favorites.png` });
  must(true, "H1 visual: t133-favorites.png captured");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const rosterFinal = await jobIds();
  must(
    JSON.stringify(rosterFinal) === JSON.stringify(rosterBefore),
    `Z3 roster restored to baseline (${rosterFinal.length} jobs)`
  );
  console.log(`\nT133 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  // a rejected main must NOT leave the browser alive — an open playwright
  // browser keeps the event loop spinning and the runner hangs to timeout
  await cleanup();
  process.exit(1);
});
