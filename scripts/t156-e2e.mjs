// t156 — Task 156: the occupancy sort outlives the reload — an
// arrangement, not an occlusion.
//
// The class gallery's Sort toggle (Class # vs Occupancy, Task 59) was
// ephemeral view state: a user triaging a real 2D run re-chose
// "Occupancy" on EVERY gallery open and EVERY reload — a problem the
// user already solved, delivered fresh each boot. Task 156 reclassifies
// by CONTRACT (the Task 153 law): the sort is an ARRANGEMENT — it
// reorders what is visible but hides nothing — so its contract is
// stay-put, like the dashboard sort or the export scale (the
// view-preference family). The FILTERS (kept-only, noted-only) stay
// ephemeral on purpose: a filter's honest boot state hides nothing, and
// kept sets are PER-JOB — a persisted kept-only meeting another job's
// empty kept set would boot an honest dead grid, an error state more
// aggressive than the correct one.
//
// Trust rule (Task 153's): only the exact string "occupancy" is
// trusted; missing/corrupt/hand-edited seeds fall to "class" — the
// RELION index order, the default that hides nothing and matches the
// paper. Storage echoes intent (the chip click is the only write
// path); hydration reads and writes nothing.
//
// Phase S — seed the Class2D → Select2D gallery chain (qa58 seeder,
//           idempotent by name) + roster snapshot AFTER seeding.
// Phase X — source oracles: the key, the trust rule, the persist shape,
//           the UNIQUE write path, the lazy-hydrate initializer, the
//           event-path wrapper, the filters still useState(false), the
//           SSR guard, the Task 156 doc.
// Phase B — fresh world: storage null after the gallery is mounted
//           (hydrate reads, writes NOTHING); default is Class # order
//           [1..8]; click Occupancy → grid flips to rank order
//           [2,4,6,1,8,3,5,7] and storage holds "occupancy"
//           immediately (the synchronous echo).
// Phase C — RELOAD: the gallery reopens in occupancy order — the
//           reclaimed arrangement stays reclaimed (CORE).
// Phase D — the two-way door: Class # persists the string "class"
//           (not a delete), and the reload honors it.
// Phase E — a corrupt seed ("garbage{{{") boots the honest default:
//           Class # order, no crash.
// Phase F — the filters stay ephemeral: toggling Kept only writes NO
//           storage and adds NO localStorage key (negative oracle).
// Phase G — screenshot: the occupancy order surviving a reload.
// Phase Z — strict console (404 radius accountable) + roster restored.
//
// Run: node scripts/t156-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t156-shot";
const SORT_KEY = "cryoflow.classGallerySort.v1";
// qa58 seed ladder — occupancy DECOUPLED from class number:
//   cls:  1    2    3    4    5   6    7   8
//   count:180  420  90   300  60  240  45  120
const CLASS_ORDER = ["1", "2", "3", "4", "5", "6", "7", "8"];
const OCCUPANCY_ORDER = ["2", "4", "6", "1", "8", "3", "5", "7"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

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

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}

/** the gallery's grid order — class numbers in DOCUMENT order (the
 *  sort's whole point is to change this order) */
const gridOrder = async () =>
  p.evaluate(() => {
    const grid = document.querySelector('[data-canvas-ui="class-grid"]');
    if (!grid) return null;
    const cards = [...grid.querySelectorAll("button[aria-pressed]")];
    return cards.map(
      (btn) => (btn.getAttribute("aria-label").match(/Toggle class (\d+)/) || [])[1]
    );
  });

const viewbar = async () =>
  p.evaluate(() => {
    const bar = document.querySelector('[data-canvas-ui="class-viewbar"]');
    if (!bar) return null;
    const press = (ui) =>
      bar.querySelector(`[data-canvas-ui="${ui}"]`)?.getAttribute("aria-pressed") ?? null;
    return { sortClass: press("sort-class"), sortOcc: press("sort-occupancy") };
  });

const openGallery = async (label) => {
  for (let i = 0; i < 8; i++) {
    // the card body is div[role="button"] with the job name in its
    // aria-label (textContent lives deeper) — and the canvas selection
    // listens on the REAL pointer stream (pointerdown/up), so the click
    // must be a trusted playwright click, not an untrusted .click()
    try {
      await p
        .locator('[role="button"][aria-label^="QA Class Select"]')
        .first()
        .click({ timeout: 4000 });
    } catch {
      await sleep(1500);
      continue;
    }
    await sleep(1100);
    try {
      await p.getByRole("tab", { name: "Params" }).click({ timeout: 4000 });
    } catch {
      await sleep(1200);
      continue;
    }
    await sleep(800);
    const has = await p.evaluate(
      () =>
        !!document.querySelector('section[aria-label="Class selection gallery"]') &&
        !!document.querySelector('[data-canvas-ui="class-grid"]')
    );
    if (has) {
      await sleep(400);
      return true;
    }
    await sleep(1500);
  }
  throw new Error(`gallery never opened (${label})`);
};

async function main() {
  /* ---------- Phase S — seed the gallery chain + snapshot --------------- */
  step("--- Phase S: seed Class2D→Select2D chain + roster snapshot ---");
  execSync("python3 scripts/qa58-seed-gallery.py", {
    cwd: "/home/z/my-project",
    encoding: "utf8",
    timeout: 120_000,
  });
  const rosterBefore = (await roster()).length;
  const sel = (await roster()).find((j) => j.type === "select2d" && j.name === "QA Class Select");
  must(!!sel?.id, "S1 select2d gallery job seeded (QA Class Select)");

  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);

  /* ---------- Phase X — source oracles ----------------------------------- */
  step("--- Phase X: source oracle — arrangement vs occlusion ---");
  const src = execSync("cat src/components/workflow/class-gallery.tsx", {
    cwd: "/home/z/my-project",
    encoding: "utf8",
  });
  must(/const CLASS_GALLERY_SORT_KEY = "cryoflow\.classGallerySort\.v1";/.test(src),
    "oracle: the sort preference lives under its own namespaced key");
  must(/if \(raw === "occupancy"\) return "occupancy";/.test(src),
    "oracle: the trust rule reads ONLY the exact string 'occupancy'");
  must(/if \(typeof window === "undefined"\) return "class";/.test(src),
    "oracle: hydration is SSR-guarded and falls to the honest default");
  must(/window\.localStorage\.setItem\(CLASS_GALLERY_SORT_KEY, mode\);/.test(src),
    "oracle: the persist path writes the raw mode string");
  must((src.match(/persistClassGallerySort\(/g) || []).length === 2,
    "oracle: ONE definition + ONE call — the chip click is the only write path");
  must(/useState<GallerySortMode>\(/.test(src) && /hydrateClassGallerySort,\s*\);/.test(src),
    "oracle: the lazy initializer hydrates at mount (reads once, writes nothing)");
  must(/persistClassGallerySort\(m\);\s*setSortModeState\(m\);/.test(src),
    "oracle: the event path persists BEFORE the state moves (persist-then-set)");
  must(/const \[keptOnly, setKeptOnly\] = useState\(false\);/.test(src) &&
       /const \[notedOnly, setNotedOnly\] = useState\(false\);/.test(src),
    "oracle: the filters stay ephemeral (occlusion is re-declared every session)");
  must(/Task 156/.test(src), "oracle: the contract split is written down (Task 156 doc)");

  /* ---------- Phase B — fresh world: default, flip, echo ----------------- */
  step("--- Phase B: fresh world — default Class #, flip to Occupancy ---");
  must(await openGallery("B"), "gallery opens in the select2d Params panel");
  must((await p.evaluate((k) => window.localStorage.getItem(k), SORT_KEY)) === null,
    "boot writes NOTHING (hydrate reads; storage is not the render state's shadow)");
  let vb = await viewbar();
  must(vb?.sortClass === "true" && vb?.sortOcc === "false",
    "fresh default is Class # (RELION index order)");
  must(JSON.stringify(await gridOrder()) === JSON.stringify(CLASS_ORDER),
    `default grid order is class-index order (${(await gridOrder()).join(" → ")})`);

  await p.click('[data-canvas-ui="sort-occupancy"]');
  await sleep(400);
  vb = await viewbar();
  must(vb?.sortOcc === "true" && vb?.sortClass === "false", "Occupancy chip takes the press");
  must(JSON.stringify(await gridOrder()) === JSON.stringify(OCCUPANCY_ORDER),
    `grid reorders to occupancy rank order (${(await gridOrder()).join(" → ")})`);
  must((await p.evaluate((k) => window.localStorage.getItem(k), SORT_KEY)) === "occupancy",
    "storage holds 'occupancy' immediately (the synchronous echo)");

  /* ---------- Phase C — the arrangement survives a reload ---------------- */
  step("--- Phase C: reload — the reclaimed arrangement stays reclaimed ---");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
  must(await openGallery("C"), "gallery reopens after reload");
  vb = await viewbar();
  must(vb?.sortOcc === "true" && vb?.sortClass === "false",
    "Occupancy is STILL pressed after the reload");
  must(JSON.stringify(await gridOrder()) === JSON.stringify(OCCUPANCY_ORDER),
    `occupancy rank order survives the reload (${(await gridOrder()).join(" → ")})`);
  execSync(`mkdir -p ${OUT}`);
  await p.screenshot({ path: `${OUT}/t156-occupancy-survives.png` });

  /* ---------- Phase D — the two-way door ---------------------------------- */
  step("--- Phase D: Class # persists the string, the door swings back ---");
  await p.click('[data-canvas-ui="sort-class"]');
  await sleep(400);
  must((await p.evaluate((k) => window.localStorage.getItem(k), SORT_KEY)) === "class",
    "flipping back writes the string 'class' — a correction, not a delete");
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
  must(await openGallery("D"), "gallery reopens (door phase)");
  vb = await viewbar();
  must(vb?.sortClass === "true" && vb?.sortOcc === "false",
    "Class # is pressed again after the reload (two-way door)");
  must(JSON.stringify(await gridOrder()) === JSON.stringify(CLASS_ORDER),
    "class-index order restored after the reload");

  /* ---------- Phase E — a corrupt seed boots the honest default ---------- */
  step("--- Phase E: corrupt seed — the honest unknown is Class # ---");
  await p.close();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  p.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`);
  });
  await p.addInitScript(
    ([k]) => window.localStorage.setItem(k, "garbage{{{"),
    [SORT_KEY]
  );
  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await sleep(900);
  must(await openGallery("E"), "gallery opens over a corrupt seed");
  vb = await viewbar();
  must(vb?.sortClass === "true" && vb?.sortOcc === "false",
    "corrupt 'occupancy' seeds fall to Class # (the state that hides nothing)");
  must(JSON.stringify(await gridOrder()) === JSON.stringify(CLASS_ORDER),
    "the grid still renders in class-index order (no crash, no dead view)");

  /* ---------- Phase F — the filters stay ephemeral (negative oracle) ----- */
  step("--- Phase F: filters write NOTHING — occlusion re-declared ---");
  const keysBefore = await p.evaluate(() => Object.keys(window.localStorage).slice().sort());
  await p.click('[data-canvas-ui="kept-only"]');
  await sleep(400);
  const keysAfter = await p.evaluate(() => Object.keys(window.localStorage).slice().sort());
  must(JSON.stringify(keysAfter) === JSON.stringify(keysBefore),
    `toggling Kept only adds NO localStorage key (${keysAfter.length} keys before == after)`);
  must((await p.evaluate((k) => window.localStorage.getItem(k), SORT_KEY)) === "garbage{{{",
    "the corrupt seed is untouched by filter toggles (hydrate reads, never writes)");

  /* ---------- Phase G — screenshot ---------------------------------------- */
  step("--- Phase G: screenshot ---");
  must(execSync(`test -f ${OUT}/t156-occupancy-survives.png && echo yes`)
    .toString()
    .trim() === "yes",
    "the occupancy-survives screenshot is on disk");

  /* ---------- Phase Z — console + cleanup ---------------------------------- */
  step("--- Phase Z: console + roster ---");
  must(pageErrors.length === 0,
    pageErrors.length ? `page errors: ${pageErrors[0]}` : "0 page errors");
  const isGenericRadiusEcho = (t) => /Failed to load resource.*404/.test(t);
  const genN = consoleErrors.filter(isGenericRadiusEcho).length;
  const radiusN = badResponses.filter((l) => l.startsWith("404")).length;
  must(genN <= radiusN,
    `generic 404 echoes accountable to the radius (${genN} <= ${radiusN})`);
  const hardConsole = consoleErrors.filter((t) => !/\[Fast Refresh\]/.test(t) && !isGenericRadiusEcho(t));
  must(hardConsole.length === 0,
    hardConsole.length ? `console errors: ${hardConsole[0]}` : "0 console errors");
  const after = (await roster()).length;
  must(after === rosterBefore, `roster restored (${after} == ${rosterBefore})`);

  await p.close(); p = null;
  await b.close(); b = null;

  console.log(`\nT156 ALL PASS (${PASS} assertions)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
