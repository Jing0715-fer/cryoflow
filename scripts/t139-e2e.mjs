// t139 — Task 139: the framed selection is an intent — sel-mode doors.
//
// In minimap sel mode a SELECTED chip is a door with the exact gesture
// contract the amber find chips earned in Task 137:
//
//   framing — sel mode frames EXACTLY the selection bbox + 160 pad
//             (no viewport union): the viewBox attr is predictable
//             from the API coords alone
//   door    — clean press+release (≤6 px travel) on a selected chip
//             jumps the canvas to that job (focusJob: center +
//             legibility zoom ≥ 0.7 + glide) — and focusJob never
//             touches the selection, so a MULTI-select survives its
//             own door (the map stays sel-framed, both chips stay
//             doors, the dimmed witness stays dimmed)
//   gesture — a drag on a door chip is still a PAN (zoom preserved);
//             a dimmed chip press pans; outside sel mode a selected
//             chip press pans too — selection alone doesn't arm
//             doors, the FRAMING does
//
// Phase S — pre-clean T139 orphans, snapshot the roster, seed 6 jobs
//           (2-door pair + an in-frame dimmed witness + 3 far strays;
//           running stamp carries fresh startedAt — Task 135 doctrine).
// Phase B — build the selection: reach Alpha via the find lens (the
//           standard arrival), shift+click Alpha and Beta (pure toggle
//           — no panel, no inspector, no zoom change); sel button
//           un-gates only when a selection exists.
// Phase C — the frame: data-mm-mode="sel"; exactly 2 doors (the
//           selection), 4 dimmed (incl. the in-frame witness);
//           viewBox == selection bbox + 160 pad (exact oracle);
//           aria-label + title tails carry the affordance.
// Phase D — the door: zoomed way out, a clean click on a door chip
//           jumps to that job at legibility zoom — and the selection
//           SURVIVES (mode still sel, still 2 doors, witness still
//           dim). The no-collateral assertion.
// Phase E — drag on a door chip: zoom UNCHANGED (pan won, jump off).
// Phase F — boundaries: in fit mode doors vanish (affordance follows
//           gesture) and a selected chip press pans; back in sel, the
//           framed-but-dimmed witness press pans too (doors only on
//           the selection).
// Phase G — screenshot the sel frame with a hovered door chip.
// Phase Z — console clean, T139 rows deleted, roster restored.
//
// Run: node scripts/t139-e2e.mjs   (server on :3000, fresh build REQUIRED)
import { chromium } from "playwright";
import { execSync } from "child_process";
import { rmSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.next/t139-shot";
const CARD_W = 220;
const CARD_H = 96;
const MM_PAD = 160;
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
 *  later focus legibility bump (≥ 0.7) is an unambiguous zoom CHANGE. */
const zoomWayOut = async () => {
  await p.mouse.move(700, 450);
  for (let i = 0; i < 20; i++) {
    await p.mouse.wheel(0, 400);
    await sleep(150);
    if ((await viewState()).zoom < 0.35) break;
  }
  await sleep(300);
};

/** ids of minimap chips currently carrying a marker */
const mmIds = async (attr) =>
  p.locator(`[data-canvas-ui="minimap-dot"][${attr}]`).evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job-id"))
  );
const mmDot = (id) => p.locator(`[data-canvas-ui="minimap-dot"][data-job-id="${id}"]`);

/** pick a minimap dot whose screen projection is ACTUALLY clickable right
 *  now — the map reframes on every viewport/mode change, so any pinned
 *  locator can go stale between pick and click (query the geometry,
 *  don't pin the actor). mode:
 *    "match" → amber find chips (data-mm-find)
 *    "door"  → jump-armed chips (data-mm-door)
 *    "dim"   → dimmed NON-door chips (data-mm-dim, no data-mm-door) */
const pickMmDot = async (mode = "any") =>
  p.evaluate((m) => {
    const svgR = document.querySelector('[data-canvas-ui="minimap-svg"]')?.getBoundingClientRect();
    if (!svgR) return null;
    const dots = [...document.querySelectorAll('[data-canvas-ui="minimap-dot"]')];
    for (const d of dots) {
      if (m === "match" && d.getAttribute("data-mm-find") !== "1") continue;
      if (m === "door" && d.getAttribute("data-mm-door") !== "1") continue;
      if (m === "dim" && (d.getAttribute("data-mm-dim") !== "1" || d.getAttribute("data-mm-door") === "1")) continue;
      const r = d.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (cx > svgR.x + 2 && cx < svgR.x + svgR.width - 2 && cy > svgR.y + 2 && cy < svgR.y + svgR.height - 2)
        return d.getAttribute("data-job-id");
    }
    return null;
  }, mode);

const boxOk = (bb) =>
  bb && bb.x >= -2 && bb.y >= -2 &&
  bb.x + bb.width <= 1442 && bb.y + bb.height <= 902;

/** click a projected-inside-map dot SELF-HEALINGLY (pick → verify box →
 *  mouse.click at center, re-pick when the map reframed under us) */
const clickMmDot = async (mode) => {
  for (let i = 0; i < 6; i++) {
    const id = await pickMmDot(mode);
    if (!id) return null;
    const bb = await mmDot(id).boundingBox();
    if (boxOk(bb)) {
      await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      return id;
    }
  }
  return null;
};

/** click a SPECIFIC dot self-healingly (mode changes shrink the door set —
 *  F phases click one known id, not a picked one) */
const clickMmId = async (id) => {
  for (let i = 0; i < 6; i++) {
    const bb = await mmDot(id).boundingBox().catch(() => null);
    if (boxOk(bb)) {
      await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      return true;
    }
  }
  return false;
};

/** drag a projected-inside-map chip SELF-HEALINGLY (real press-move-release) */
const dragMmDot = async (mode, dx, dy) => {
  for (let i = 0; i < 6; i++) {
    const id = await pickMmDot(mode);
    if (!id) return null;
    const bb = await mmDot(id).boundingBox();
    if (boxOk(bb)) {
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

/** shift+click a canvas card — the pure multi-select toggle (no panel,
 *  no inspector, no drag). The canvas WIRES are intentionally interactive
 *  (click-to-delete), so a wire can legally cross the card's projected
 *  center and swallow the pointerdown (the C2 diagnosis): scan a grid of
 *  points inside the card and click the first whose hit-target really is
 *  the card — query the geometry, don't pin the point. */
const shiftClickCard = async (id) => {
  const bb = await p.locator(`[data-job="${id}"]`).boundingBox();
  must(!!bb, `card ${id} has a bounding box to shift+click`);
  const pts = [];
  for (const fx of [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85])
    for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8])
      pts.push({ x: bb.x + bb.width * fx, y: bb.y + bb.height * fy });
  let clicked = false;
  for (const pt of pts) {
    const inside = await p.evaluate(
      ({ x, y, sel }) =>
        !!document.elementFromPoint(x, y)?.closest(`[data-job="${sel}"]`),
      { x: pt.x, y: pt.y, sel: id },
    );
    if (inside) {
      await p.keyboard.down("Shift");
      await p.mouse.click(pt.x, pt.y);
      await p.keyboard.up("Shift");
      clicked = true;
      break;
    }
  }
  must(clicked, `card ${id} had a wire-free point to shift+click`);
  await sleep(250);
};

async function main() {
  step("=== t139 — the framed selection is an intent (sel-mode doors) ===");

  /* ---------------- Phase S — baseline + seeded world ---------------- */
  step("--- Phase S: roster snapshot + T139 seed matrix ---");
  const pre = await roster();
  for (const j of pre.filter((j) => (j.name ?? "").startsWith("T139"))) {
    await fetch(`${BASE}/api/jobs/${j.id}`, { method: "DELETE" }).catch(() => {});
  }
  const baseline = await roster();
  must(Array.isArray(baseline), `roster snapshotted (${baseline.length} jobs)`);

  const maxY = baseline.reduce((m, j) => Math.max(m, (j.y ?? 0) + 240), 800);
  // column pair (the 2-door selection) + an in-frame witness + far strays
  const seeds = [
    ["T139 Alpha", "motioncorr", "completed", 140, 0],      // y = maxY+240
    ["T139 Beta", "ctffind", "running", 140, 480],          // door pair partner
    ["T139 Witness", "import", "idle", 260, 240],           // framed but NOT a door
    ["T139 Gamma", "motioncorr", "failed", 140, 960],       // outside the sel frame
    ["T139 Delta", "import", "idle", 140, 1440],
    ["T139 Epsilon", "ctffind", "completed", 140, 1920],
  ];
  const seedIds = {};
  const seedPos = {};
  let yOff = maxY + 240;
  for (const [name, type, status, sx, dy] of seeds) {
    const created = await (await api("/api/jobs", "POST", { type, name, x: sx, y: yOff + dy })).json();
    const j = created?.job ?? created;
    must(!!j?.id, `${name}: created (${type}${status ? ` → ${status}` : ", idle"})`);
    seedIds[name] = j.id;
    seedPos[name] = { x: j.x, y: j.y };
    seededIds.push(j.id);
    if (status) stamp(j.id, status);
  }
  const live = await roster();
  must(
    live.filter((j) => (j.name ?? "").startsWith("T139")).length === 6,
    "S+ six seeds visible via the API"
  );
  const centerOf = Object.fromEntries(
    live.map((j) => [j.id, { x: j.x + CARD_W / 2, y: j.y + CARD_H / 2 }]),
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

  /* ---------------- Phase B — build the selection ---------------- */
  step("--- Phase B: shift+click selection, sel button un-gates ---");
  must(
    await p.locator('[data-mm-btn="sel"]').isDisabled(),
    "B1 with no selection the sel button is disabled (gated on intent)"
  );
  // reach Alpha the standard way (find lens → Enter), then shift+click it
  await p.keyboard.press("Control+f");
  await p.waitForSelector('[data-testid="canvas-find-input"]', { timeout: 5000 });
  await sleep(300);
  await p.keyboard.type("T139 Alpha");
  await sleep(500);
  await p.keyboard.press("Enter");
  await sleep(900); // glide lands
  await p.keyboard.press("Escape");
  await p.waitForSelector('[data-testid="canvas-find-bar"]', { state: "detached", timeout: 5000 });
  const vsReach = await viewState();
  must(vsReach.zoom >= 0.7, `B2 find-reach landed Alpha at legibility (${vsReach.zoom.toFixed(2)})`);
  await shiftClickCard(seedIds["T139 Alpha"]);
  await shiftClickCard(seedIds["T139 Beta"]); // 480 world px below — visible at 0.7
  const vsAfterSel = await viewState();
  must(
    Math.abs(vsAfterSel.zoom - vsReach.zoom) < 0.02,
    `B3 shift+clicks are pure toggles — zoom untouched (${vsAfterSel.zoom.toFixed(2)})`
  );
  must(
    await p.locator('[data-mm-btn="sel"]').isEnabled(),
    "B4 a two-card selection un-gates the sel button"
  );

  /* ---------------- Phase C — the frame IS the selection ---------------- */
  step("--- Phase C: sel mode frames exactly the selection ---");
  await p.locator('[data-mm-btn="sel"]').click();
  await sleep(400);
  must(
    (await p.locator('[data-canvas-ui="minimap"]').getAttribute("data-mm-mode")) === "sel",
    "C1 minimap flipped into sel mode"
  );
  const doorIds = await mmIds("data-mm-door");
  must(
    doorIds.length === 2 && doorIds.includes(seedIds["T139 Alpha"]) && doorIds.includes(seedIds["T139 Beta"]),
    "C2 exactly the selection carries the door anchor"
  );
  const dimIds = await mmIds("data-mm-dim");
  const allDots = await p.locator('[data-canvas-ui="minimap-dot"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-job-id"))
  );
  must(
    dimIds.length === allDots.length - 2 &&
      dimIds.includes(seedIds["T139 Witness"]) &&
      dimIds.includes(seedIds["T139 Gamma"]) &&
      !dimIds.includes(seedIds["T139 Beta"]),
    "C3 everyone but the selection dims (witness + strays included, doors never)"
  );
  const vb = (await p.locator('[data-canvas-ui="minimap-svg"]').getAttribute("viewBox"))
    .split(/\s+/).map(Number);
  const a = seedPos["T139 Alpha"], bt = seedPos["T139 Beta"];
  const exp = {
    x: Math.min(a.x, bt.x) - MM_PAD,
    y: Math.min(a.y, bt.y) - MM_PAD,
    w: Math.abs(a.x - bt.x) + CARD_W + 2 * MM_PAD,
    h: Math.abs(a.y - bt.y) + CARD_H + 2 * MM_PAD,
  };
  must(
    near(vb[0], exp.x, 0.5) && near(vb[1], exp.y, 0.5) && near(vb[2], exp.w, 0.5) && near(vb[3], exp.h, 0.5),
    `C4 viewBox == selection bbox + ${MM_PAD} pad (got ${vb.map((n) => n.toFixed(0)).join(" ")} vs ${Object.values(exp).map((n) => n.toFixed(0)).join(" ")})`
  );
  must(
    (await p.locator('[data-canvas-ui="minimap-svg"]').getAttribute("aria-label")).includes("selected chip to jump"),
    "C5 aria-label carries the sel-door affordance"
  );
  const doorTitle = await mmDot(seedIds["T139 Alpha"]).locator("title").textContent();
  must(
    (doorTitle ?? "").includes("click to jump"),
    "C6 a door chip's tooltip promises the jump"
  );
  const witTitle = await mmDot(seedIds["T139 Witness"]).locator("title").textContent();
  must(
    !(witTitle ?? "").includes("click to jump"),
    "C7 the dimmed witness's tooltip promises nothing"
  );

  /* ---------------- Phase D — the door jump, selection survives ---------------- */
  step("--- Phase D: clean click on a door chip jumps; the selection survives ---");
  await zoomWayOut();
  const beforeJump = await viewState();
  must(beforeJump.zoom < 0.4, `D1 canvas zoomed way out (${beforeJump.zoom.toFixed(2)})`);
  const jumpId = await clickMmDot("door");
  must(!!jumpId, "D2 clean click dispatched on a door chip inside the map");
  must(
    jumpId === seedIds["T139 Alpha"] || jumpId === seedIds["T139 Beta"],
    "D2b the door clicked is one of the selected pair"
  );
  await sleep(1000); // glide lands
  const vsJump = await viewState();
  must(vsJump.zoom >= 0.7, `D3 the jump zoomed in to legibility (${beforeJump.zoom.toFixed(2)} → ${vsJump.zoom.toFixed(2)})`);
  must(
    near(vsJump.cx, centerOf[jumpId].x, 40) && near(vsJump.cy, centerOf[jumpId].y, 40),
    `D4 viewport centered on the clicked selection member (Δ=(${(vsJump.cx - centerOf[jumpId].x).toFixed(0)},${(vsJump.cy - centerOf[jumpId].y).toFixed(0)}))`
  );
  must(
    (await p.locator('[data-canvas-ui="minimap"]').getAttribute("data-mm-mode")) === "sel" &&
      (await mmIds("data-mm-door")).length === 2 &&
      (await mmIds("data-mm-dim")).includes(seedIds["T139 Witness"]),
    "D5 the multi-selection SURVIVED its own door (mode sel, 2 doors, witness still dim)"
  );

  /* ---------------- Phase E — drag on a door chip is still a pan ---------------- */
  step("--- Phase E: drag wins over the armed jump ---");
  await zoomWayOut();
  const beforeDrag = await viewState();
  const dragId = await dragMmDot("door", -130, -50);
  must(!!dragId, "E0 a door chip drag dispatched on a verified box");
  await sleep(700);
  const vsDrag = await viewState();
  must(Math.abs(vsDrag.zoom - beforeDrag.zoom) < 0.02, `E1 zoom UNCHANGED after the drag (${vsDrag.zoom.toFixed(2)})`);
  must(
    !near(vsDrag.cx, centerOf[dragId].x, 60),
    "E2 no jump fired — the viewport panned away from the chip's job"
  );

  /* ---------------- Phase F — doors only in sel mode, only on the selection ---------------- */
  step("--- Phase F: fit-mode selected chip pans; sel-mode dimmed witness pans ---");
  await p.locator('[data-mm-btn="fit"]').click();
  await sleep(300);
  must(
    (await p.locator('[data-canvas-ui="minimap"]').getAttribute("data-mm-mode")) === "fit" &&
      (await mmIds("data-mm-door")).length === 0,
    "F1 back in fit mode the door affordance VANISHES (no lie on the map)"
  );
  const beforeFit = await viewState();
  must(await clickMmId(seedIds["T139 Alpha"]), "F2 the still-selected chip clicked in fit mode");
  await sleep(700);
  const vsFit = await viewState();
  must(
    Math.abs(vsFit.zoom - beforeFit.zoom) < 0.02 && vsFit.zoom < 0.4,
    `F3 fit-mode press on a selected chip PANned (zoom ${vsFit.zoom.toFixed(2)})`
  );
  await p.locator('[data-mm-btn="sel"]').click();
  await sleep(300);
  must(
    (await mmIds("data-mm-door")).length === 2 &&
      (await mmIds("data-mm-dim")).includes(seedIds["T139 Witness"]),
    "F4 sel mode re-arms the same two doors"
  );
  const beforeDim = await viewState();
  must(await clickMmId(seedIds["T139 Witness"]), "F5 the framed-but-dimmed witness clicked");
  await sleep(700);
  const vsDim = await viewState();
  must(
    Math.abs(vsDim.zoom - beforeDim.zoom) < 0.02 && vsDim.zoom < 0.4,
    `F6 dimmed chip press PANned — doors only on the selection (zoom ${vsDim.zoom.toFixed(2)})`
  );

  /* ---------------- Phase G — visual ---------------- */
  step("--- Phase G: screenshot the sel frame with a hovered door ---");
  const gId = seedIds["T139 Alpha"];
  const gb = await mmDot(gId).boundingBox().catch(() => null);
  if (gb && boxOk(gb)) {
    await p.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2).catch(() => {});
  }
  await sleep(300);
  rmSync(OUT, { recursive: true, force: true });
  await p.screenshot({ path: `${OUT}/t139-sel-doors.png` });
  must(true, "G1 visual: t139-sel-doors.png captured (sel frame + hovered door chip)");

  /* ---------------- Phase Z — console + cleanup ---------------- */
  step("--- Phase Z: console + cleanup ---");
  must(pageErrors.length === 0, `Z1 zero page errors (${pageErrors.length})`);
  const honest = consoleErrors.filter(
    (t) => !/favicon|404|sitemap|AbortError|ERR_ABORTED/i.test(t)
  );
  must(honest.length === 0, `Z2 console errors honest (${honest.length}): ${honest[0] ?? ""}`);

  await cleanup();
  const after = await roster();
  must(after.length === baseline.length, `Z3 T139 rows deleted, roster restored (${after.length})`);
  console.log(`\nT139 ALL PASS (${PASS} assertions)`);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup(); // a thrown locator never reaches Phase Z — seeds must not leak
  process.exit(1);
});
