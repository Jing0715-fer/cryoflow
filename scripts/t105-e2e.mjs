// t105 — Task 105: minimap ergonomics + history UX polish.
//
// The minimap itself is old-world (shipped before Task 69 with touch
// drag, SMIL pulse, edge polylines) but it never had a probe, a toggle,
// or a hotkey. Task 105 adds: a visibility switch (session-local store
// state `minimapOpen`, default true), a Map toggle button in the
// zoom-controls toolbar (aria-pressed, text-primary when open), an M
// keyboard branch (canvas-only, dashboard exempt), a shortcuts-dialog
// row, dynamic undo/redo tooltips that name the NEXT entry and the stack
// depth, and probe testids on the svg / dots / viewport rect.
//
// The probe walks all of it:
// Phase S — pre-clean, remote band seeding (3 cards), minimap visible,
//           per-seed dots, viewport rect present
// Phase C — selection coupling: click card → its dot takes the primary
//           stroke; click card B → the stroke MOVES (A loses, B gains)
// Phase E — dynamic tooltips: empty-stack titles → drag commits "Move
//           <name>" into the undo title → Ctrl+Z flips the stack →
//           Ctrl+Shift+Z flips it back
// Phase A — click navigation: click a far world point on the map → the
//           canvas centers EXACTLY there (same zoom)
// Phase B — drag navigation: drag across the map → the view moves and
//           the map still frames the viewport (union bounds guarantee)
// Phase D — toggle: M hides, button shows, button hides, reload restores
//           the session-local default (open)
// Phase F — static contract: setViewport gateway, stopPropagation guard,
//           no localStorage in the minimap, session-local store flag
//           (no persistence), SMIL pulse, M branch + dashboard guard,
//           shortcuts row, mount guard + dynamic title template
// Phase Z — cleanup (every seeded job deleted), console clean
//
// Run: node scripts/t105-e2e.mjs   (server on :3000)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { installOriginDoor } from "./lib/qa-origin.mjs";
installOriginDoor();

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const seeded = []; // {id, name} — Z deletes every one, FATAL paths included
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const s of seeded) {
    try { await fetch(`${BASE}/api/jobs/${s.id}`, { method: "DELETE" }); } catch {}
  }
}
const must = (cond, label) => {
  if (!cond) {
    // t643 — pure throw (t156 law): the FATAL path must reach cleanup.
    // The old body closed the browser fire-and-forget and process.exit(1)
    // — which SKIPS the finally below, leaking every seeded card into the
    // world; leaked cards push maxX east, the next run's band seeds
    // further out, and E4's drag eventually collides with the WORLD_MAX
    // clamp (the 19_760 ceiling this window autopsied). Cleanup now runs
    // on EVERY death: main().catch awaits it, then exits.
    throw new Error(`FAIL: ${label}`);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};

const api = async (path, method = "GET", body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
};
const listJobs = async () => {
  const r = await api("/api/jobs");
  const j = await r.json();
  return j.jobs ?? j;
};
const jobById = async (id) => (await listJobs()).find((j) => j.id === id) ?? null;

const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? "");
const toCanvas = async () => {
  for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
    await p.keyboard.press("Shift+C");
    await sleep(700);
  }
};
const readViewport = () =>
  p.evaluate(() => {
    const el = document.querySelector('[data-canvas="workspace"]');
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(
      el instanceof HTMLElement ? el.style.transform : ""
    );
    return m ? { x: Number(m[1]), y: Number(m[2]), zoom: Number(m[3]) } : null;
  });
/** Real card drag: pointer down at the card's screen center, move by
 *  (dx,dy) SCREEN px, up. Caller sleeps past the PATCH before reading. */
const dragCard = async (id, dx, dy) => {
  const box = await p.locator(`[data-job="${id}"]`).boundingBox();
  must(box, `drag target ${id} is on screen`);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 });
  await p.mouse.up();
};
const clickCard = async (id) => {
  await p.locator(`[data-job="${id}"]`).click();
  await sleep(350);
};
const ctrlZ = async () => { await p.keyboard.press("Control+z"); await sleep(1000); };
const ctrlShiftZ = async () => { await p.keyboard.press("Control+Shift+z"); await sleep(1000); };
const pos = async (id) => {
  const j = await jobById(id);
  return j ? { x: j.x, y: j.y } : null;
};
/** The minimap svg's on-disk geometry: viewBox string + client box. */
const mapGeo = async () =>
  p.evaluate(() => {
    const svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    if (!svg) return null;
    const vb = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
    const r = svg.getBoundingClientRect();
    return { wx: vb[0], wy: vb[1], ww: vb[2], wh: vb[3], x: r.x, y: r.y, w: r.width, h: r.height };
  });
/** client point on the minimap for a world point — LETTERBOX-AWARE
 *  (the t118 lesson, finally mirrored here): the SVG renders with
 *  preserveAspectRatio xMidYMid, so a viewBox whose aspect ≠ the svg
 *  box gets centered bands and a uniform scale. The old linear map
 *  (independent x/y stretch) only ever passed because the world's
 *  aspect happened to dodge the MM_MIN/MAX_H clamp — the delivered
 *  26-job world's wider box crossed it and exposed the blind spot.
 *  Inversion must know the projection. */
const worldToClient = (g, wx, wy) => {
  const s = Math.min(g.w / g.ww, g.h / g.wh);
  const ox = (g.w - g.ww * s) / 2;
  const oy = (g.h - g.wh * s) / 2;
  return {
    x: g.x + ox + (wx - g.wx) * s,
    y: g.y + oy + (wy - g.wy) * s,
  };
};
const worldAtCenter = async () => {
  const vp = await readViewport();
  const r = await p.evaluate(() => {
    const el = document.querySelector('[data-canvas="viewport"]');
    return el ? { w: el.clientWidth, h: el.clientHeight } : null;
  });
  return {
    wx: (r.w / 2 - vp.x) / vp.zoom,
    wy: (r.h / 2 - vp.y) / vp.zoom,
    zoom: vp.zoom,
  };
};

/* ---------------- browser ---------------- */
b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

async function main() {
try {
  /* ---------------- Phase S: seeding + minimap presence ---------------- */
  console.log("Phase S — seeding, minimap presence");
  const existing0 = await listJobs();
  for (const j of existing0.filter((j) => j.name?.startsWith("t105 "))) {
    await api(`/api/jobs/${j.id}`, "DELETE");
  }
  const all = await listJobs();
  const wsId = (await (await api("/api/workspaces")).json()).workspaces?.[0]?.id ?? "";
  must(wsId !== "", "S0 workspace resolved for seeding");
  const maxY = all.reduce((m, j) => Math.max(m, j.y ?? 0), 0);
  const maxX = all.reduce((m, j) => Math.max(m, j.x ?? 0), 0);
  // t643 — workflow.ts welds the world shut at ±20_000 and every drag
  // commit clamps to it (nx = min(origX + dx/zoom, WORLD_MAX − CARD_W)
  // = 19_760). A band seeded past that ceiling turns E4's +140px drag
  // into a silent snap-to-ceiling — the redo assertion then reads the
  // clamp, not the drag. Cap the band inside the drag-safe margin; if
  // the honest world ever grows close enough for the cap to bite, the
  // S1 distance assertion below fails loudly and the seeding strategy
  // owes a real answer (this window's autopsy found the ceiling the
  // hard way: three leaked runs parked cards at x 20_767+ and A snapped
  // to 19_760).
  const WORLD_MAX = 20_000, CARD_W = 240, CARD_H = 112;
  const Y0 = Math.min(Math.round(maxY + 2200), WORLD_MAX - CARD_H - 600);
  const X0 = Math.min(Math.round(maxX + 3000), WORLD_MAX - CARD_W - 600);
  must(Y0 > maxY + 2000 && X0 > maxX + 2500,
    `S1 band is ${Y0 - maxY}px below and ${X0 - maxX}px east of the old world`);
  must(X0 + 140 <= WORLD_MAX - CARD_W && Y0 + 90 <= WORLD_MAX - CARD_H,
    "S1b band inside drag-safe bounds — a +140/+90 drag can never clamp");
  const seedSpecs = [
    ["t105 A", X0, Y0],
    ["t105 B", X0 + 400, Y0 + 260],
    ["t105 C", X0 + 800, Y0],
  ];
  for (const [name, x, y] of seedSpecs) {
    const r = await (await api("/api/jobs", "POST", { type: "refine3d", name, workspaceId: wsId, x, y })).json();
    seeded.push({ id: r.job.id, name });
  }
  must(seeded.length === 3, "S2 three cards seeded in the remote band");
  await p.goto(BASE, { waitUntil: "networkidle" });
  await sleep(1200);
  await toCanvas();
  must((await curView()) === "canvas", "S3 canvas view active");
  must(await p.locator('[data-canvas-ui="minimap"]').isVisible(), "S4 minimap visible by default");
  for (const s of seeded) {
    must(await p.locator(`[data-canvas-ui="minimap-dot"][data-job-id="${s.id}"]`).count() === 1,
      `S5 dot on the map for ${s.name}`);
  }
  must(await p.locator('[data-canvas-ui="minimap-vp"]').count() === 1,
    "S6 viewport window rect rendered");
  // normalize: 100% zoom; the remote band sits far from the fit view, so
  // the FIRST map-click below both exercises navigation and brings card A
  // into view for the selection/tooltip phases
  await p.keyboard.press("0");
  await sleep(600);
  const A = seeded[0], B = seeded[1];
  const g0 = await mapGeo();
  must(g0, "S7 minimap geometry readable");
  const home = worldToClient(g0, X0 + 110, Y0 + 48);
  await p.mouse.click(home.x, home.y);
  await sleep(700);
  const ABox = await p.locator(`[data-job="${A.id}"]`).boundingBox();
  must(ABox && ABox.width > 40, "S7 card A on screen after map-click navigation");

  /* ---------------- Phase C: selection ring coupling ---------------- */
  console.log("Phase C — selection coupling");
  const dotA = () => p.locator(`[data-canvas-ui="minimap-dot"][data-job-id="${A.id}"]`);
  const dotB = () => p.locator(`[data-canvas-ui="minimap-dot"][data-job-id="${B.id}"]`);
  const strokeOf = (loc) => loc.evaluate((el) => el.getAttribute("stroke"));
  await clickCard(A.id);
  must((await strokeOf(dotA())) === "var(--primary)",
    "C1 selected card's dot takes the primary stroke");
  await clickCard(B.id);
  must((await strokeOf(dotB())) === "var(--primary)" && (await strokeOf(dotA())) !== "var(--primary)",
    "C2 the stroke MOVES with the selection (A loses, B gains)");
  await clickCard(A.id);

  /* ---------------- Phase E: dynamic undo/redo tooltips ---------------- */
  console.log("Phase E — dynamic tooltips");
  const titleOf = (ui) => p.locator(`[data-canvas-ui="${ui}"]`).getAttribute("title");
  must((await titleOf("undo-btn")) === "Nothing to undo (Ctrl+Z)",
    "E1 empty stack: honest 'Nothing to undo' title");
  must((await titleOf("redo-btn")) === "Nothing to redo (Ctrl+Shift+Z or Ctrl+Y)",
    "E1b empty stack: honest 'Nothing to redo' title");
  const origA = await pos(A.id);
  await dragCard(A.id, 140, 90);
  await sleep(1000); // PATCH + entry push
  const undoTitle = await titleOf("undo-btn");
  must(/Undo: Move t105 A/.test(undoTitle ?? "") && /1 step/.test(undoTitle ?? ""),
    `E2 undo title names the next entry + depth: "${undoTitle}"`);
  must((await titleOf("redo-btn")) === "Nothing to redo (Ctrl+Shift+Z or Ctrl+Y)",
    "E2b redo title still empty before any undo");
  await ctrlZ();
  const undoneA = await pos(A.id);
  must(undoneA && origA && undoneA.x === origA.x && undoneA.y === origA.y,
    "E3 Ctrl+Z restored A (server PATCH included)");
  const redoTitle = await titleOf("redo-btn");
  must(/Redo: Move t105 A/.test(redoTitle ?? ""),
    `E3b redo title names the parked entry: "${redoTitle}"`);
  must((await titleOf("undo-btn")) === "Nothing to undo (Ctrl+Z)",
    "E3c undo title back to honest empty");
  await ctrlShiftZ();
  const redoneA = await pos(A.id);
  must(redoneA && origA && Math.abs(redoneA.x - origA.x - 140) <= 2 && Math.abs(redoneA.y - origA.y - 90) <= 2,
    "E4 Ctrl+Shift+Z re-applied the drag");
  must(/Undo: Move t105 A/.test(await titleOf("undo-btn")),
    "E4b undo title flipped back after redo");

  /* ---------------- Phase A: click navigation ---------------- */
  console.log("Phase A — click navigation");
  const vpBefore = await readViewport();
  const g1 = await mapGeo();
  must(g1, "A1 minimap geometry readable");
  // a far corner of the mapped world — well away from the current view
  const farWX = g1.wx + g1.ww * 0.85;
  const farWY = g1.wy + g1.wh * 0.15;
  const c1 = worldToClient(g1, farWX, farWY);
  await p.mouse.click(c1.x, c1.y);
  await sleep(700);
  const center1 = await worldAtCenter();
  must(Math.abs(center1.wx - farWX) <= 40 && Math.abs(center1.wy - farWY) <= 40,
    `A2 click centered the canvas on the map point (got ${Math.round(center1.wx)},${Math.round(center1.wy)} want ${Math.round(farWX)},${Math.round(farWY)})`);
  must(center1.zoom === vpBefore.zoom,
    `A3 zoom preserved (${center1.zoom} === ${vpBefore.zoom})`);
  const g2 = await mapGeo();
  const vpRect1 = await p.locator('[data-canvas-ui="minimap-vp"]').boundingBox();
  must(vpRect1 && vpRect1.x >= g2.x - 2 && vpRect1.y >= g2.y - 2 &&
       vpRect1.x + vpRect1.width <= g2.x + g2.w + 2 &&
       vpRect1.y + vpRect1.height <= g2.y + g2.h + 2,
    "A4 viewport window stays framed on the map after navigation");

  /* ---------------- Phase B: drag navigation ---------------- */
  console.log("Phase B — drag navigation");
  const vpB = await readViewport();
  const g3 = await mapGeo();
  const start = worldToClient(g3, g3.wx + g3.ww * 0.3, g3.wy + g3.wh * 0.7);
  await p.mouse.move(start.x, start.y);
  await p.mouse.down();
  await p.mouse.move(start.x + g3.w * 0.25, start.y - g3.h * 0.3, { steps: 10 });
  await p.mouse.up();
  await sleep(700);
  const vpC = await readViewport();
  must(vpC && (Math.abs(vpC.x - vpB.x) > 10 || Math.abs(vpC.y - vpB.y) > 10),
    "B1 drag on the map panned the canvas");
  must(vpC.zoom === vpB.zoom, `B2 zoom preserved through the drag (${vpC.zoom})`);
  const g4 = await mapGeo();
  const vpRect2 = await p.locator('[data-canvas-ui="minimap-vp"]').boundingBox();
  must(vpRect2 && vpRect2.x >= g4.x - 2 && vpRect2.y >= g4.y - 2 &&
       vpRect2.x + vpRect2.width <= g4.x + g4.w + 2 &&
       vpRect2.y + vpRect2.height <= g4.y + g4.h + 2,
    "B3 the map still frames the viewport after the drag (union bounds)");

  /* ---------------- Phase D: toggle — M key, button, reload ---------------- */
  console.log("Phase D — toggle");
  await p.keyboard.press("m");
  await sleep(400);
  must((await p.locator('[data-canvas-ui="minimap"]').count()) === 0,
    "D1 M hides the minimap");
  must((await p.locator('[data-canvas-ui="minimap-toggle"]').getAttribute("aria-pressed")) === "false",
    "D1b toggle button aria-pressed follows");
  await p.locator('[data-canvas-ui="minimap-toggle"]').click();
  await sleep(400);
  must(await p.locator('[data-canvas-ui="minimap"]').isVisible(),
    "D2 button shows the map again");
  await p.locator('[data-canvas-ui="minimap-toggle"]').click();
  await sleep(400);
  must((await p.locator('[data-canvas-ui="minimap"]').count()) === 0,
    "D3 button hides the map");
  await p.reload({ waitUntil: "networkidle" });
  await sleep(1200);
  await toCanvas();
  must(await p.locator('[data-canvas-ui="minimap"]').isVisible(),
    "D4 reload restores the session-local default (open — nothing persisted)");

  /* ---------------- Phase F: static contract ---------------- */
  console.log("Phase F — static contract");
  const mmSrc = readFileSync("src/components/workflow/canvas-minimap.tsx", "utf8");
  const storeSrc = readFileSync("src/lib/store.ts", "utf8");
  const pageSrc = readFileSync("src/app/page.tsx", "utf8");
  const dialogSrc = readFileSync("src/components/workflow/shortcuts-dialog.tsx", "utf8");
  const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
  must(/setViewport\(\{/.test(mmSrc) && /zoom: s\.viewport\.zoom/.test(mmSrc),
    "F1 navigation rides the setViewport gateway, zoom preserved");
  must(/e\.stopPropagation\(\)/.test(mmSrc) || /stopPropagation/.test(mmSrc),
    "F1b pointerdown stops propagation (pan guard / long-press defused)");
  must(!/localStorage/.test(mmSrc), "F2 minimap touches no storage");
  must(/minimapOpen: true/.test(storeSrc) && /setMinimapOpen: \(open\) => set\(\{ minimapOpen: open \}\)/.test(storeSrc) &&
       !/storage\.setItem\([^)]*minimap/i.test(storeSrc),
    "F3 store flag is session-local: default true, plain set, never persisted");
  // t643 verdict (t157 template) — this oracle was born anchoring
  // STATUS_FILL[j.status]; the map's read path has since evolved into the
  // display word (t322's dialect: Slurm queued paints pending at every
  // distance; t606's news bloom keys on the same word). The SMIL half
  // never moved. The world is right, the oracle was stale — anchor the
  // CHAIN, not the historical spelling: pulse alive, fill rides
  // STATUS_FILL[word], and the queued->pending mapping is pinned so a
  // silent dialect regression still trips this wire.
  // t646 (template's second enforcement) — the chain's home moved again,
  // this time INTO lib: t646 single-sourced the status law in
  // lib/status-style.ts (hex twin + statusWord), so the minimap reads
  // STATUS_HEX[statusWord(job)] and the queued->pending literal lives in
  // the lib. Contract unchanged: the word chain, the map, the pulse.
  const statusStyleSrc = readFileSync("src/lib/status-style.ts", "utf8");
  must(/<animate\b/.test(mmSrc) && /STATUS_HEX\[word\]/.test(mmSrc) &&
       /statusWord\(job\)/.test(mmSrc) &&
       /isSlurmQueued\(job\) \? "pending"/.test(statusStyleSrc),
    "F4 running dots pulse (SMIL); dots read the fill map through the display word (queued paints pending)");
  // t643 verdict (t157 template) — this oracle anchored page.tsx, but the
  // keyboard handler migrated to app-shell.tsx (the shell owns the global
  // keymap now; page.tsx composes views). The CONTRACT never moved: an m/M
  // branch with the dashboard guard toggling the session-local minimap
  // flag. Anchor the handler's current home; the split-guard probe reads
  // the same segment shape it always did.
  const appShellSrc = readFileSync("src/components/workflow/app-shell.tsx", "utf8");
  must(/k === "m" \|\| k === "M"/.test(appShellSrc) &&
       /s\.view !== "dashboard"/.test(appShellSrc.split('k === "m"')[1]?.split("} else if")[0] ?? ""),
    "F5 M branch exists with the dashboard guard (app-shell keymap)");
  must(/Toggle the world-overview map/.test(dialogSrc),
    "F6 shortcuts dialog documents M");
  must(/minimapOpen && <CanvasMinimap/.test(canvasSrc) &&
       /aria-pressed=\{minimapOpen\}/.test(canvasSrc) &&
       /Undo: \$\{historyPast\[historyPast\.length - 1\]\.label\}/.test(canvasSrc) &&
       /Redo: \$\{historyFuture\[historyFuture\.length - 1\]\.label\}/.test(canvasSrc),
    "F7 mount guard + aria-pressed + dynamic undo/redo title templates");

  /* ---------------- Phase Z: cleanup + console ---------------- */
  console.log("Phase Z — cleanup");
  let deleted = 0;
  for (const s of seeded) {
    const r = await api(`/api/jobs/${s.id}`, "DELETE");
    if (r.ok) deleted++;
  }
  must(deleted === seeded.length, `Z1 all ${seeded.length} seeded jobs deleted (got ${deleted})`);
  must(consoleErrors.length === 0, `Z2 console clean (got ${consoleErrors.length})`);
  consoleErrors.slice(0, 5).forEach((e) => console.log(`    console: ${e.slice(0, 200)}`));

  console.log(`T105 ALL PASS (${PASS} assertions)`);
} finally {
  await cleanup();
}
}

main().catch(async (e) => {
  console.error(`FATAL: ${e?.message ?? e}`);
  try { await cleanup(); } catch {}
  process.exit(1);
});
