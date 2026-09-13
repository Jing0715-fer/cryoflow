// t118 — Task 118: minimap framing modes + selection-focus filter.
//
// The minimap always framed content ∪ viewport — panning far into empty
// space dilutes the map into mostly-void. Task 118 adds a header
// segmented control with three framing modes:
//   fit   — content bbox ∪ viewport window (default, old behavior)
//   nodes — content bbox only (node-only framing; a far viewport clips)
//   sel   — selection bbox only; unselected chips AND their edges dim
//           (falls back to fit when the selection clears; the sel button
//           disables itself with an empty selection)
//
// The probe walks all of it:
// Phase S — pre-clean (jobs + edges), remote band seeding (4 cards,
//           2 edges), minimap + header presence, fit default, sel
//           disabled, dots + lines present
// Phase A — fit vs nodes framing: navigate far east → fit box follows
//           the viewport (union formula verified numerically); nodes box
//           = content + MM_PAD exactly; node-only invariant: navigating
//           inside nodes mode leaves the box UNCHANGED
// Phase B — sel focus: shift-click A+B → sel enabled → sel box = sel
//           bbox + pad (C,D excluded); dim contracts (dots whisper 0.15
//           via .mm-chip-dim + data-mm-dim, edges ghost 0.06 vs base 0.25
//           by endpoint — Task 166 ladder); live re-frame
//           on deselect; empty selection → fit fallback + button disable
// Phase C — M toggle regression: minimap hides/shows with header intact
// Phase F — static contract: MM_MODES table, aria-pressed, header
//           pointerdown stopPropagation, ladder class wiring,
//           transition-opacity, no localStorage, sel fallback, matrix
//           glob auto-includes t118
// Phase Z — cleanup (edges + jobs deleted), console clean
//
// Run: node scripts/t118-e2e.mjs   (server on :3000)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const seeded = []; // {id, name} — Z deletes every one, FATAL paths included
const seededEdgeIds = []; // Z deletes every one
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const id of seededEdgeIds) {
    try { await fetch(`${BASE}/api/edges/${id}`, { method: "DELETE" }); } catch {}
  }
  for (const s of seeded) {
    try { await fetch(`${BASE}/api/jobs/${s.id}`, { method: "DELETE" }); } catch {}
  }
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FATAL: ${label}`);
    p?.close().catch(() => {});
    b?.close().catch(() => {});
    process.exit(1);
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
const listEdges = async () => {
  const r = await api("/api/edges");
  const j = await r.json();
  return j.edges ?? [];
};
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
/** the minimap svg's world mapping: viewBox (world box) + client box */
const mapGeo = async () =>
  p.evaluate(() => {
    const svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    if (!svg) return null;
    const vb = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
    const r = svg.getBoundingClientRect();
    return { wx: vb[0], wy: vb[1], ww: vb[2], wh: vb[3], x: r.x, y: r.y, w: r.width, h: r.height };
  });
/** client point on the minimap for a world point — LETTERBOX-AWARE
 *  (Task 138's toWorld lesson, mirrored back into probe space): the
 *  product renders the viewBox with preserveAspectRatio xMidYMid, so a
 *  viewBox whose aspect ≠ svg box aspect gets centered bands and a
 *  uniform scale. The old linear map (independent x/y stretch) landed
 *  systematically off — it only ever passed because the world's aspect
 *  happened to match; the Task 140 world repairs changed the bbox shape
 *  and exposed it. Inversion must know the projection, both directions. */
const worldToClient = (g, wx, wy) => {
  const s = Math.min(g.w / g.ww, g.h / g.wh);
  const ox = (g.w - g.ww * s) / 2;
  const oy = (g.h - g.wh * s) / 2;
  return {
    x: g.x + ox + (wx - g.wx) * s,
    y: g.y + oy + (wy - g.wy) * s,
  };
};
/** map-click navigation: fresh geometry every time (the map re-frames
 *  after each navigation, so stale geometry lies) */
const mapClick = async (wx, wy) => {
  const g = await mapGeo();
  must(g, "map geometry readable for navigation");
  const c = worldToClient(g, wx, wy);
  await p.mouse.click(c.x, c.y);
  await sleep(700);
};
const shiftClickCard = async (id) => {
  await p.locator(`[data-job="${id}"]`).first().click({ modifiers: ["Shift"] });
  await sleep(450);
};
const modeAttr = async () =>
  p.evaluate(() =>
    document.querySelector('[data-canvas-ui="minimap"]')?.getAttribute("data-mm-mode") ?? ""
  );
/** every minimap line with its world geometry + opacity */
const mapLines = async () =>
  p.evaluate(() => {
    const lines = [...document.querySelectorAll('[data-canvas-ui="minimap-svg"] line')];
    return lines.map((l) => ({
      x1: Number(l.getAttribute("x1")), y1: Number(l.getAttribute("y1")),
      x2: Number(l.getAttribute("x2")), y2: Number(l.getAttribute("y2")),
      op: l.getAttribute("opacity"),
      // Task 166 — the dim rides the .mm-edge-dim class (ladder's ghost
      // rung); the attribute stays 0.25, computed style resolves the token
      cso: getComputedStyle(l).opacity,
    }));
  });
/** expected fit-mode world box (ports the component formula): content ∪ viewport, padded */
const fitBox = (jobs, vp, vw, vh) => {
  const view = { x: -vp.x / vp.zoom, y: -vp.y / vp.zoom, w: vw / vp.zoom, h: vh / vp.zoom };
  const x0 = Math.min(view.x, ...jobs.map((j) => j.x)) - 160;
  const y0 = Math.min(view.y, ...jobs.map((j) => j.y)) - 160;
  const x1 = Math.max(view.x + view.w, ...jobs.map((j) => j.x + 220)) + 160;
  const y1 = Math.max(view.y + view.h, ...jobs.map((j) => j.y + 96)) + 160;
  return { wx: x0, wy: y0, ww: x1 - x0, wh: y1 - y0 };
};
const near = (a, bTol, eps = 1.5) => Math.abs(a - bTol) <= eps;
const boxMatches = (g, e) =>
  near(g.wx, e.wx) && near(g.wy, e.wy) && near(g.ww, e.ww) && near(g.wh, e.wh);
const boxDump = (g, e) =>
  `actual viewBox [${g.wx}, ${g.wy}, ${g.ww}, ${g.wh}] vs expected [${e.wx}, ${e.wy}, ${e.ww}, ${e.wh}]`;
/** ratchet the viewport east (fit mode dilates with every hop): click a
 *  point just inside the map's right edge until the view center passes
 *  targetWx — a single far click would land OUTSIDE the current box */
const ratchetEast = async (targetWx, anchorY) => {
  const vw = await p.evaluate(() => {
    const el = document.querySelector('[data-canvas="viewport"]');
    return el ? el.clientWidth : 1600;
  });
  for (let i = 0; i < 10; i++) {
    const vp = await readViewport();
    const cx = -vp.x / vp.zoom + vw / vp.zoom / 2;
    if (cx >= targetWx - 2) return cx;
    const g = await mapGeo();
    must(g, "map readable during ratchet");
    const c = worldToClient(g, g.wx + g.ww - 60, anchorY);
    await p.mouse.click(c.x, c.y);
    await sleep(650);
  }
  return -Infinity;
};

/* ---------------- browser ---------------- */
b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  /* ---------------- Phase S: seeding + header presence ---------------- */
  console.log("Phase S — seeding, header presence, fit default");
  const existing0 = await listJobs();
  for (const j of existing0.filter((j) => j.name?.startsWith("t118 "))) {
    await api(`/api/jobs/${j.id}`, "DELETE");
  }
  const all = await listJobs();
  const wsId = (await (await api("/api/workspaces")).json()).workspaces?.[0]?.id ?? "";
  must(wsId !== "", "S0 workspace resolved for seeding");
  const maxY = all.reduce((m, j) => Math.max(m, j.y ?? 0), 0);
  const maxX = all.reduce((m, j) => Math.max(m, j.x ?? 0), 0);
  const X0 = Math.round(maxX + 3000);
  const Y0 = Math.round(maxY + 2200);
  // two left-cluster cards (A,B) + two right-cluster cards (C,D) — the
  // sel phase frames the left cluster while the right cluster must dim
  const seedSpecs = [
    ["t118 A", X0, Y0],
    ["t118 B", X0 + 400, Y0 + 260],
    ["t118 C", X0 + 1200, Y0],
    ["t118 D", X0 + 1600, Y0 + 260],
  ];
  for (const [name, x, y] of seedSpecs) {
    const r = await (await api("/api/jobs", "POST", { type: "refine3d", name, workspaceId: wsId, x, y })).json();
    seeded.push({ id: r.job.id, name, x, y });
  }
  must(seeded.length === 4, "S1 four cards seeded in the remote band");
  // two edges: A→B (selected endpoints later) and C→D (unselected)
  const edgeAB = await (await api("/api/edges", "POST", { fromJobId: seeded[0].id, toJobId: seeded[1].id })).json();
  const edgeCD = await (await api("/api/edges", "POST", { fromJobId: seeded[2].id, toJobId: seeded[3].id })).json();
  seededEdgeIds.push(edgeAB.edge?.id, edgeCD.edge?.id);
  must(seededEdgeIds.every(Boolean), "S2 two edges created (A→B, C→D)");
  const A = seeded[0], B = seeded[1], C = seeded[2], D = seeded[3];
  // port-to-port line geometry of the two seeded edges (world coords,
  // matching the minimap's straight-line rendering)
  const isAB = (l) => near(l.x1, A.x + 220, 2) && near(l.y1, A.y + 48, 2) &&
                     near(l.x2, B.x, 2) && near(l.y2, B.y + 48, 2);
  const isCD = (l) => near(l.x1, C.x + 220, 2) && near(l.y1, C.y + 48, 2) &&
                     near(l.x2, D.x, 2) && near(l.y2, D.y + 48, 2);

  await p.goto(BASE, { waitUntil: "networkidle" });
  await sleep(1200);
  await toCanvas();
  must((await curView()) === "canvas", "S3 canvas view active");
  must(await p.locator('[data-canvas-ui="minimap"]').isVisible(), "S4 minimap visible by default");
  must((await p.locator("[data-mm-btn]").count()) === 3, "S5 three framing buttons in the header");
  must((await p.locator('[data-mm-btn="fit"]').getAttribute("aria-pressed")) === "true",
    "S6 fit is the default mode (aria-pressed)");
  must((await modeAttr()) === "fit", "S7 container advertises data-mm-mode=fit");
  const selDisabled0 = await p.locator('[data-mm-btn="sel"]').isDisabled();
  must(selDisabled0, "S8 sel button disabled with an empty selection");
  for (const s of seeded) {
    must(await p.locator(`[data-canvas-ui="minimap-dot"][data-job-id="${s.id}"]`).count() === 1,
      `S9 dot on the map for ${s.name}`);
  }
  const lines0 = await mapLines();
  must(lines0.some(isAB) && lines0.some(isCD),
    "S10 both seeded edges rendered as map lines (by geometry)");
  must(!!(await p.locator('[data-mm-btn="nodes"]').getAttribute("title")),
    "S11 nodes button carries a tooltip title");

  // normalize zoom, then bring the band on screen via a fit-mode map-click
  await p.keyboard.press("0");
  await sleep(600);
  await mapClick(A.x + 110, A.y + 48);
  const aBox = await p.locator(`[data-job="${A.id}"]`).boundingBox();
  must(aBox && aBox.width > 40, "S12 card A on screen after map-click navigation");
  // the framing source is the ACTIVE-WORKSPACE job set (old world + our
  // band) — read it from the minimap's own dots so the numeric contracts
  // below verify the FORMULA over the app-observable set, not our guess
  // of which jobs are visible
  const dotJobs = await p.evaluate(() =>
    [...document.querySelectorAll('[data-canvas-ui="minimap-dot"]')].map((d) => ({
      x: Number(d.getAttribute("x")), y: Number(d.getAttribute("y")),
    }))
  );
  must(dotJobs.length >= 4, `S13 framing source readable from dots (${dotJobs.length} jobs)`);

  /* ---------------- Phase A: fit vs nodes framing ---------------- */
  console.log("Phase A — fit follows the viewport; nodes frames content only");
  // ratchet the viewport far east of the content band: fit must dilate to
  // include the viewport window, nodes must stay on the content
  const EAST = X0 + 3020;
  const cxEnd = await ratchetEast(EAST, Y0 + 100);
  must(cxEnd >= EAST - 2, "A0 viewport ratcheted east of the content band");
  const vpA = await readViewport();
  must(vpA, "A1 viewport readable after eastward navigation");
  const vwH = await p.evaluate(() => {
    const el = document.querySelector('[data-canvas="viewport"]');
    return el ? { w: el.clientWidth, h: el.clientHeight } : null;
  });
  must(!!vwH, "A2 canvas viewport measurable");
  const gFit = await mapGeo();
  const eFit = fitBox(dotJobs, vpA, vwH.w, vwH.h);
  must(boxMatches(gFit, eFit),
    `A3 fit box = content ∪ viewport + pad (numeric contract) — ${boxDump(gFit, eFit)} | vp ${JSON.stringify(vpA)} | viewport ${vwH.w}x${vwH.h}`);
  const fitWW = gFit.ww;

  await p.locator('[data-mm-btn="nodes"]').click();
  await sleep(400);
  must((await modeAttr()) === "nodes", "A4 nodes mode active");
  const xs = dotJobs.map((j) => j.x), ys = dotJobs.map((j) => j.y);
  const contentBox = {
    wx: Math.min(...xs) - 160,
    wy: Math.min(...ys) - 160,
    ww: Math.max(...xs.map((x) => x + 220)) - Math.min(...xs) + 320,
    wh: Math.max(...ys.map((y) => y + 96)) - Math.min(...ys) + 320,
  };
  const gNodes = await mapGeo();
  must(boxMatches(gNodes, contentBox),
    `A5 nodes box = content bbox + MM_PAD exactly — ${boxDump(gNodes, contentBox)}`);
  must(gNodes.ww < fitWW - 400, "A6 node-only framing actually shrinks the dilated map");

  // node-only invariant check comes after the re-dilate probe (which needs
  // the viewport still far east) — reorder keeps the strong +400 threshold
  await p.locator('[data-mm-btn="fit"]').click();
  await sleep(400);
  must((await modeAttr()) === "fit", "A9 back to fit");
  const gFit2 = await mapGeo();
  must(gFit2.ww > gNodes.ww + 400, "A10 fit re-dilates around the far viewport");
  await p.locator('[data-mm-btn="nodes"]').click();
  await sleep(400);
  must((await modeAttr()) === "nodes", "A11 nodes again for the invariant check");
  // node-only invariant: navigating inside nodes mode leaves the box alone
  await mapClick(C.x + 110, C.y + 48);
  const vpC = await readViewport();
  const cWorld = { x: -vpC.x / vpC.zoom, y: -vpC.y / vpC.zoom };
  must(near(cWorld.x + vwH.w / vpC.zoom / 2, C.x + 110, 3), "A7 navigation still works in nodes mode");
  const gNodes3 = await mapGeo();
  must(boxMatches(gNodes3, contentBox), "A8 node-only invariant: navigation does NOT dilate the box");

  /* ---------------- Phase B: selection focus ---------------- */
  console.log("Phase B — sel focus: framing, dimming, live re-frame, fallback");
  await mapClick(A.x + 110, A.y + 48); // bring A,B on screen for shift-clicks
  await shiftClickCard(A.id);
  await shiftClickCard(B.id);
  must(!(await p.locator('[data-mm-btn="sel"]').isDisabled()), "B1 selection enables the sel button");
  await p.locator('[data-mm-btn="sel"]').click();
  await sleep(400);
  must((await modeAttr()) === "sel", "B2 sel mode active");
  const selBox = {
    wx: X0 - 160,
    wy: Y0 - 160,
    ww: (X0 + 400 + 220) - X0 + 320,
    wh: (Y0 + 260 + 96) - Y0 + 320,
  };
  const gSel = await mapGeo();
  must(boxMatches(gSel, selBox),
    `B3 sel box = selection bbox + pad (C,D excluded) — ${boxDump(gSel, selBox)}`);
  must(gSel.ww < contentBox.ww - 800, "B4 sel framing is much tighter than the content framing");
  // dim contracts. Task 166: the chip dim moved from the opacity attribute
  // to the .mm-chip-dim class (the ladder's --dim-whisper rung — 0.13 vs
  // the compare curves' 0.15 was drift, now unified at 0.15). Status ink
  // (idle 0.55 / active 0.9) stays attribute-borne; the dim is read from
  // computed style, which resolves the token.
  const dimOf = async (id) =>
    p.evaluate((jid) => {
      const el = document.querySelector(`[data-canvas-ui="minimap-dot"][data-job-id="${jid}"]`);
      return el
        ? {
            dim: el.getAttribute("data-mm-dim"),
            op: el.getAttribute("opacity"),
            cso: getComputedStyle(el).opacity,
          }
        : null;
    }, id);
  const dA = await dimOf(A.id), dB = await dimOf(B.id), dC = await dimOf(C.id), dD = await dimOf(D.id);
  must(dA && dA.dim === null && dA.op === "0.55" && dA.cso === "0.55", "B5 selected A keeps idle opacity, no dim flag");
  must(dB && dB.dim === null, "B6 selected B not dimmed");
  must(dC && dC.dim === "1" && dC.cso === "0.15", "B7 unselected C dims to the whisper rung (0.15) with data-mm-dim");
  must(dD && dD.dim === "1" && dD.cso === "0.15", "B8 unselected D dims to the whisper rung (0.15)");
  // edge dim contract: A→B keeps 0.25 (selected endpoint), C→D dims to
  // the ghost rung (0.06 via .mm-edge-dim; the ATTRIBUTE stays 0.25 —
  // the class carries the recession, computed style resolves it)
  const edgeOps = await mapLines();
  must(edgeOps.some((l) => isAB(l) && l.op === "0.25" && l.cso === "0.25"), "B9 edge A→B keeps full opacity (selected endpoint)");
  must(edgeOps.some((l) => isCD(l) && l.op === "0.25" && l.cso === "0.06"), "B10 edge C→D dims to the ghost rung (0.06, no selected endpoint)");

  // live re-frame: deselect A → the box snaps to B alone
  await shiftClickCard(A.id);
  const gSelB = await mapGeo();
  const boxB = { wx: B.x - 160, wy: B.y - 160, ww: 220 + 320, wh: 96 + 320 };
  must(boxMatches(gSelB, boxB),
    `B11 sel frame follows the live selection (B only) — ${boxDump(gSelB, boxB)}`);
  // empty the selection → automatic fit fallback + button disables again
  await shiftClickCard(B.id);
  await sleep(400);
  must((await modeAttr()) === "fit", "B12 empty selection falls back to fit");
  must((await p.locator('[data-mm-btn="fit"]').getAttribute("aria-pressed")) === "true" &&
       (await p.locator('[data-mm-btn="sel"]').getAttribute("aria-pressed")) === "false",
    "B12b pressed state follows the effective mode (fit on, sel off)");
  must(await p.locator('[data-mm-btn="sel"]').isDisabled(), "B13 sel button re-disables");
  const dC2 = await dimOf(C.id);
  must(dC2 && dC2.dim === null && dC2.op === "0.55" && dC2.cso === "0.55", "B14 dimming clears with the mode");

  /* ---------------- Phase C: M toggle regression ---------------- */
  console.log("Phase C — M toggle still owns the whole minimap");
  await p.keyboard.press("m");
  await sleep(500);
  must((await p.locator('[data-canvas-ui="minimap"]').count()) === 0, "C1 M hides the minimap (header included)");
  await p.keyboard.press("m");
  await sleep(500);
  must(await p.locator('[data-canvas-ui="minimap"]').isVisible(), "C2 M brings it back");
  must((await p.locator("[data-mm-btn]").count()) === 3, "C3 header intact after remount");
  must((await modeAttr()) === "fit", "C4 remount resets to fit (ephemeral mode, no storage)");

  /* ---------------- Phase F: static contract ---------------- */
  console.log("Phase F — static contract");
  const mmSrc = readFileSync("src/components/workflow/canvas-minimap.tsx", "utf8");
  must((mmSrc.match(/data-mm-btn=\{m\.id\}/g) ?? []).length === 1,
    "F1 header buttons bind data-mm-btn");
  must(/aria-pressed=\{effMode === m\.id\}/.test(mmSrc), "F2 buttons advertise the EFFECTIVE mode (no ghost pressed-on-disabled)");
  must(/onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/.test(mmSrc),
    "F3 header buttons stop propagation (container navigate guard)");
  must(/data-mm-mode=\{effMode\}/.test(mmSrc), "F4 container advertises the effective mode");
  must(/data-mm-dim=\{dimmed \|\| findDim \? "1" : undefined\}/.test(mmSrc),
    "F5 dim flag contract on chips (sel focus OR find dim — Task 136)");
  must(/opacity=\{j\.status === "idle" \? 0\.55 : 0\.9\}/.test(mmSrc) && /mm-chip-dim/.test(mmSrc) && /mm-edge-dim/.test(mmSrc) && /opacity=\{0\.25\}/.test(mmSrc),
    "F6 recession rides the ladder classes (chips whisper, edges ghost; status ink attribute-borne)");
  must(/transition-opacity duration-300/.test(mmSrc), "F7 dimming eases via transition");
  must(!/localStorage/.test(mmSrc), "F8 minimap still touches no storage");
  must(/mode === "sel" && selIds\.size === 0 \? "fit" : mode/.test(mmSrc),
    "F9 sel-with-empty-selection falls back to fit");
  must(/const \[mode, setMode\] = React\.useState<MmMode>\("fit"\)/.test(mmSrc),
    "F10 mode is ephemeral component state (default fit)");
  must((mmSrc.match(/id: "(?:fit|nodes|sel)"/g) ?? []).length === 3,
    "F11 exactly three framing modes in the table");
  const matrixSrc = readFileSync("scripts/run-matrix.sh", "utf8");
  must(/for f in scripts\/t1\[0-9\]\[0-9\]-e2e\.mjs; do/.test(matrixSrc),
    "F12 matrix glob auto-includes t118");

  /* ---------------- Phase Z: cleanup ---------------- */
  console.log("Phase Z — cleanup");
  await cleanup();
  const after = await listJobs();
  must(!after.some((j) => j.name?.startsWith("t118 ")), "Z1 all seeded jobs deleted");
  const edgesAfter = await listEdges();
  must(!edgesAfter.some((e) => seededEdgeIds.includes(e.id)), "Z2 both seeded edges deleted");
  must(consoleErrors.length === 0, `Z3 console clean (${consoleErrors.length} errors)`);
} catch (e) {
  console.log("FATAL (uncaught):", e?.message ?? e);
  await cleanup();
  process.exit(1);
}

console.log(`T118 ALL PASS (${PASS} assertions)`);
process.exit(0);
