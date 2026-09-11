// t137 — Task 137: the lens LEADS — every match gains a door:
//
//   count   — the find bar's count label with matches on hand is a
//             BUTTON: clicking it advances the cycle (same go(1) as
//             Enter and the next-arrow — one cursor, three triggers);
//             the honest-zero state stays a span that promises nothing
//   jump    — an amber minimap match chip is a door: a clean
//             press+release (≤6 px travel) jumps the canvas to that job
//             (focusJob: center + legibility zoom ≥ 0.7 + glide);
//   gesture — a drag on a match chip is still a PAN (zoom preserved);
//             without the lens every chip press pans, exactly as before
//             — the jump is intent-laden, armed only under the lens
//
// Phase S — pre-clean T137 orphans, snapshot the roster, seed 6 jobs
//           across 3 types × 4 statuses (prisma stamps, fresh startedAt
//           for the running pair), verify via the API.
// Phase B — count door: BUTTON tag, "6 matches" → click → "1 of 6"
//           centered on the first seed → click → "2 of 6" → Enter →
//           "3 of 6" (the third trigger rides the same cursor).
// Phase C — map door: zoomed way out, a clean click on the Zeta chip
//           glides the canvas onto Zeta at legibility zoom (≥ 0.7).
// Phase D — drag on the match chip: zoom UNCHANGED (pan won, jump off).
// Phase E — lens off: chip click pans (zoom preserved); lens on:
//           a NON-match chip click pans too (doors only on matches).
// Phase F — honest zero: "zzqq" keeps the count a span, the map bare.
// Phase G — screenshot the armed lens (hover on a match chip).
// Phase Z — console clean, T137 rows deleted, roster restored.
//
// Run: node scripts/t137-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { rmSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t137-shot";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const consoleErrors = [];
const pageErrors = [];
const seededIds = [];

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

const roster = async () =>
  (await (await api("/api/jobs")).json())?.jobs ?? [];

/** Stamp a job's status straight into the DB (qa75 / t135 precedent).
 *  A "running" stamp MUST also write a fresh startedAt: the engine's
 *  reconcile treats a running row with no engine record older than
 *  120s as stale and honestly fails it. */
const stamp = (id, status) => {
  const data =
    status === "running"
      ? `status:"${status}",startedAt:new Date().toISOString()`
      : `status:"${status}"`;
  execSync(
    `node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.job.update({where:{id:"${id}"},data:{${data}}}).then(()=>p.$disconnect())'`,
    { cwd: "/home/z/my-project", stdio: "pipe" },
  );
};

async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededIds) {
    try { await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE" }); } catch {}
  }
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

const countText = async () =>
  (await p.locator('[data-testid="canvas-find-count"]').innerText()).trim();

/** the viewport's zoom + the world point currently at viewport center,
 *  parsed from the workspace's computed matrix (translate·scale, 0 0) */
const viewState = async () =>
  p.evaluate(() => {
    const ws = document.querySelector("[data-canvas='workspace']");
    const t = getComputedStyle(ws).transform;
    const [a, , , , e, f] = t.match(/matrix\(([^)]+)\)/)[1].split(",").map(Number);
    const r = ws.parentElement.getBoundingClientRect();
    return {
      zoom: a,
      cx: (r.width / 2 - e) / a,
      cy: (r.height / 2 - f) / a,
    };
  });

const near = (a, c, tol) => Math.abs(a - c) <= tol;

/** zoom the canvas way out (wheel-down over the canvas center) so any
 *  later focus legibility bump (≥ 0.7) is an unambiguous zoom CHANGE.
 *  Adaptive: Chromium splits a large deltaY into several wheel events,
 *  so scroll-and-read until the matrix says we're below 0.35. */
const zoomWayOut = async () => {
  await p.mouse.move(700, 450);
  for (let i = 0; i < 20; i++) {
    await p.mouse.wheel(0, 400);
    await sleep(150);
    if ((await viewState()).zoom < 0.35) break;
  }
  await sleep(300);
};

/** ids of minimap chips currently carrying the amber find stroke */
const mmFindIds = async () =>
  p.locator('[data-canvas-ui="minimap-dot"][data-mm-find="1"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job-id"))
  );
const mmDot = (id) => p.locator(`[data-canvas-ui="minimap-dot"][data-job-id="${id}"]`);

/** pick a minimap dot whose screen projection is ACTUALLY clickable right
 *  now — the fit framing unions the (huge, zoomed-out) viewport window
 *  into the viewBox, letterboxes the aspect, and a specific job's chip
 *  can project outside the page entirely. "The viewport state is never
 *  trustworthy" applies to the map, too: query the geometry, don't pin
 *  the actor. mode "match" → only amber chips (data-mm-find). */
const pickMmDot = async (mode = "any") =>
  p.evaluate((m) => {
    const svgR = document.querySelector('[data-canvas-ui="minimap-svg"]')?.getBoundingClientRect();
    if (!svgR) return null;
    const dots = [...document.querySelectorAll('[data-canvas-ui="minimap-dot"]')];
    for (const d of dots) {
      if (m === "match" && d.getAttribute("data-mm-find") !== "1") continue;
      const r = d.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (cx > svgR.x + 2 && cx < svgR.x + svgR.width - 2 && cy > svgR.y + 2 && cy < svgR.y + svgR.height - 2)
        return d.getAttribute("data-job-id");
    }
    return null;
  }, mode);


/** click a projected-inside-map dot SELF-HEALINGLY: pick → read the box
 *  with playwright's own geometry → verify it lies inside the page →
 *  mouse.click at its center (real press+release, zero travel). The map
 *  reframes on every viewport change, so any pinned locator can go stale
 *  between pick and click — the loop re-picks instead of trusting it. */
const clickMmDot = async (mode, button = "left") => {
  for (let i = 0; i < 6; i++) {
    const id = await pickMmDot(mode);
    if (!id) return null;
    const bb = await mmDot(id).boundingBox();
    if (
      bb && bb.x >= -2 && bb.y >= -2 &&
      bb.x + bb.width <= 1442 && bb.y + bb.height <= 902
    ) {
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      if (button === "left") await p.mouse.click(cx, cy);
      return id;
    }
  }
  return null;
};

/** drag a projected-inside-map match chip SELF-HEALINGLY (same loop as
 *  clickMmDot, then press-move-release with real mouse events) */
const dragMmDot = async (mode, dx, dy) => {
  for (let i = 0; i < 6; i++) {
    const id = await pickMmDot(mode);
    if (!id) return null;
    const bb = await mmDot(id).boundingBox();
    if (
      bb && bb.x >= -2 && bb.y >= -2 &&
      bb.x + bb.width <= 1442 && bb.y + bb.height <= 902
    ) {
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      await p.mouse.move(cx, cy);
      await p.mouse.down();
      await p.mouse.move(cx + dx, cy + dy, { steps: 8 });
      await p.mouse.up();
      return id;
    }
  }
  return null;
};

async function main() {
  step("=== t137 — the lens leads (count door + map door) ===");

  /* ---------------- Phase S — baseline + seeded statuses ---------------- */
  step("--- Phase S: roster snapshot + T137 seed matrix ---");
  const pre = await roster();
  for (const j of pre.filter((j) => (j.name ?? "").startsWith("T137"))) {
    await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" }).catch(() => {});
  }
  const baseline = await roster();
  must(Array.isArray(baseline), `roster snapshotted (${baseline.length} jobs)`);

  const maxY = baseline.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  const seeds = [
    ["T137 Alpha", "motioncorr", "completed"],
    ["T137 Beta", "motioncorr", "failed"],
    ["T137 Gamma", "ctffind", "running"],
    ["T137 Delta", "import", null],
    ["T137 Epsilon", "ctffind", "running"],
    ["T137 Zeta", "motioncorr", "completed"],
  ];
  const seedIds = {};
  const seedNames = [];
  let y = maxY + 240;
  for (const [name, type, status] of seeds) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: 140, y })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type}${status ? ` → ${status}` : ", idle"})`);
    seedIds[name] = j.id;
    seedNames.push(name);
    seededIds.push(j.id);
    if (status) stamp(j.id, status);
    y += 240;
  }
  const live = await roster();
  // the bar's matches follow the store's fetch order — the same API, so
  // creation order is the canonical expectation (Alpha → Zeta)
  const orderedSeeds = live
    .filter((j) => (j.name ?? "").startsWith("T137"))
    .sort((a, b2) => (a.createdAt ?? "").localeCompare(b2.createdAt ?? ""))
    .map((j) => j.id);
  must(
    JSON.stringify(orderedSeeds) === JSON.stringify(seedNames.map((n) => seedIds[n])),
    "S+ six seeds stamped and ordered (createdAt = bar cycle order)"
  );
  const centerOf = Object.fromEntries(
    live.map((j) => [j.id, { x: j.x + 110, y: j.y + 48 }]),
  );

  /* ---------------- browser ---------------- */
  b = await chromium.launch();
  p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  p.on("pageerror", (e) => pageErrors.push(String(e)));

  await p.goto(BASE, { waitUntil: "networkidle" });
  await p.waitForSelector('[data-view="canvas"]', { timeout: 30000 });
  await p.waitForSelector('[data-canvas-ui="minimap-dot"]', { timeout: 10000 });
  await sleep(1000);

  /* ---------------- Phase B — the count is a door ---------------- */
  step("--- Phase B: count click advances the cycle ---");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  await p.keyboard.type("T137");
  await sleep(500);
  must((await countText()) === "6 matches", "B1 fresh query reads '6 matches'");
  must(
    (await p.locator('[data-testid="canvas-find-count"]').evaluate((el) => el.tagName)) === "BUTTON",
    "B2 the count with matches on hand is a BUTTON"
  );
  await p.locator('[data-testid="canvas-find-count"]').click();
  await sleep(900); // the arrival glides ~520ms — read after it lands
  let vs = await viewState();
  must((await countText()) === "1 of 6", "B3 first count click reads '1 of 6'");
  must(
    near(vs.cx, centerOf[orderedSeeds[0]].x, 30) && near(vs.cy, centerOf[orderedSeeds[0]].y, 30),
    `B4 viewport centered on the first match (Δ=(${(vs.cx - centerOf[orderedSeeds[0]].x).toFixed(0)},${(vs.cy - centerOf[orderedSeeds[0]].y).toFixed(0)}))`
  );
  must(vs.zoom >= 0.7, `B5 legibility zoom after the jump (${vs.zoom.toFixed(2)})`);
  await p.locator('[data-testid="canvas-find-count"]').click();
  await sleep(900);
  vs = await viewState();
  must((await countText()) === "2 of 6", "B6 second click reads '2 of 6'");
  must(
    near(vs.cx, centerOf[orderedSeeds[1]].x, 30) && near(vs.cy, centerOf[orderedSeeds[1]].y, 30),
    "B7 viewport centered on the second match"
  );
  await p.keyboard.press("Enter"); // focus returned to the input after the click
  await sleep(900);
  vs = await viewState();
  must((await countText()) === "3 of 6", "B8 Enter rides the SAME cursor ('3 of 6')");
  must(
    near(vs.cx, centerOf[orderedSeeds[2]].x, 30) && near(vs.cy, centerOf[orderedSeeds[2]].y, 30),
    "B9 viewport centered on the third match"
  );

  /* ---------------- Phase C — the map door (clean click jumps) ---------------- */
  step("--- Phase C: amber chip click jumps the canvas ---");
  await zoomWayOut();
  const beforeJump = await viewState();
  must(beforeJump.zoom < 0.4, `C1 canvas zoomed way out (${beforeJump.zoom.toFixed(2)})`);
  const jumpId = await clickMmDot("match");
  must(!!jumpId, "C2 clean click dispatched on an amber chip inside the map");
  must((await mmFindIds()).includes(jumpId), "C2b the clicked chip carries the amber stroke");
  await sleep(1000); // glide lands
  vs = await viewState();
  must(vs.zoom >= 0.7, `C3 the jump zoomed in to legibility (${beforeJump.zoom.toFixed(2)} → ${vs.zoom.toFixed(2)})`);
  must(
    near(vs.cx, centerOf[jumpId].x, 40) && near(vs.cy, centerOf[jumpId].y, 40),
    `C4 viewport centered on the picked match (Δ=(${(vs.cx - centerOf[jumpId].x).toFixed(0)},${(vs.cy - centerOf[jumpId].y).toFixed(0)}))`
  );
  must((await countText()) === "3 of 6", "C5 the bar's cursor did not move (jump ≠ cycle)");

  /* ---------------- Phase D — drag on a match chip is still a pan ---------------- */
  step("--- Phase D: drag wins over the armed jump ---");
  await zoomWayOut();
  const beforeDrag = await viewState();
  const dragId = await dragMmDot("match", -130, -50);
  must(!!dragId, "D0 an amber chip drag dispatched on a verified box");
  await sleep(700);
  vs = await viewState();
  must(Math.abs(vs.zoom - beforeDrag.zoom) < 0.02, `D1 zoom UNCHANGED after the drag (${vs.zoom.toFixed(2)})`);
  must(
    !near(vs.cx, centerOf[dragId].x, 60),
    "D2 no jump fired — the viewport panned away from the chip's job"
  );

  /* ---------------- Phase E — doors only under the lens, only on matches ---------------- */
  step("--- Phase E: without the lens (or off a match) every press pans ---");
  // lens OFF: a chip click pans to the chip's world spot, zoom preserved
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Escape");
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { state: "detached", timeout: 5000 });
  must((await mmFindIds()).length === 0, "E1 lens closed — no amber on the map");
  const beforePlain = await viewState();
  const plainId = await clickMmDot("any");
  must(!!plainId, "E1b no-lens chip click dispatched on a verified box");
  await sleep(700);
  vs = await viewState();
  must(Math.abs(vs.zoom - beforePlain.zoom) < 0.02, `E2 no-lens chip click kept the zoom (${vs.zoom.toFixed(2)})`);
  must(
    near(vs.cx, centerOf[plainId].x, 220) && near(vs.cy, centerOf[plainId].y, 220),
    `E3 ...and panned to that chip's map spot (Δ=(${(vs.cx - centerOf[plainId].x).toFixed(0)},${(vs.cy - centerOf[plainId].y).toFixed(0)}))`
  );
  // lens ON, NON-match chip: pan, not jump
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  await p.keyboard.type("T137");
  await sleep(500);
  // lens ON, NON-match chip: pan, not jump. The stranger MUST come from
  // the RENDERED canvas ids, not the API roster: the roster spans every
  // workspace (and legacy ws=null rows render nowhere once a second
  // workspace exists — the active-workspace filter drops them), so an
  // API-picked stranger can be a card no minimap dot will ever show.
  const domIds = await p.locator("[data-job]").evaluateAll((els) => els.map((e) => e.getAttribute("data-job")));
  const strangerId = domIds.find((id) => !orderedSeeds.includes(id));
  must(!!strangerId, "E4 a rendered non-seed job exists to sample");
  await mmDot(strangerId).click({ force: true });
  await sleep(700);
  vs = await viewState();
  must(vs.zoom < 0.4, `E5 non-match chip click did NOT jump (zoom ${vs.zoom.toFixed(2)})`);

  /* ---------------- Phase F — honest zero stays a span ---------------- */
  step("--- Phase F: 'zzqq' — no door where there is nothing to reach ---");
  await p.locator('[data-testid="canvas-find-input"]').click();
  await p.keyboard.press("Control+a");
  await p.keyboard.type("zzqq");
  await sleep(400);
  must((await countText()) === "no matches", "F1 the bar reads 'no matches'");
  must(
    (await p.locator('[data-testid="canvas-find-count"]').evaluate((el) => el.tagName)) === "SPAN",
    "F2 the zero count is a SPAN — it promises no cycle"
  );
  await p.keyboard.press("Escape");
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { state: "detached", timeout: 5000 });

  /* ---------------- Phase G — visual ---------------- */
  step("--- Phase G: screenshot the armed lens ---");
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  await p.keyboard.type("T137");
  await sleep(300);
  const gDot = await pickMmDot("match");
  if (gDot) {
    const gb = await mmDot(gDot).boundingBox().catch(() => null);
    if (gb) await p.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2).catch(() => {});
  }
  await sleep(300);
  rmSync(OUT, { recursive: true, force: true });
  await p.screenshot({ path: `${OUT}/t137-lens-doors.png` });
  must(true, "G1 visual: t137-lens-doors.png captured (hover on an amber door chip)");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const after = await roster();
  must(after.length === baseline.length, `Z3 T137 rows deleted, roster restored (${after.length})`);
  console.log(`\nT137 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup(); // a thrown locator never reaches Phase Z — seeds must not leak
  process.exit(1);
});
