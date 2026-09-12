// t103 — Task 103: arrow-key graph navigation on the canvas.
//
// Arrow keys walk the graph spatially: the anchor hops to the nearest card
// within a ±45° cone around the pressed direction (predictability over
// cleverness — a down-right trap 660px away must NOT steal the walk from
// the next chain card dead ahead), Shift+Arrow extends the selection with
// the target promoted to primary (walking a chain grows it), and the
// viewport pans the MINIMUM that keeps the new anchor inside a 96px margin
// (never re-centering — F centers explicitly; never touching zoom). With
// nothing selected the anchor point is the world point under the viewport
// center, so arrows enter the graph from wherever the user is looking.
// Dead ends are honest no-ops (no wraparound); the dashboard keeps its
// native arrow behavior (scope guard), and an open Radix Select listbox
// owns the arrows before the graph does.
//
// GEOMETRY: the probe seeds a REMOTE band (maxY of the existing world
// +2200px) so fixture cards from earlier suites can never win a cone race
// — Task 98's "empty band below the bbox" doctrine, scaled for cones.
//
// Phase S — adaptive seeding (6 east chain + 2 decoys), page up, F-center
//   E1, deselect, viewport-center entry armed
// Phase A — entry: ArrowRight with no selection anchors the chain card
//   dead ahead of the viewport center (E1 itself is excluded: zero forward)
// Phase B — walk + minimal pan: zoom to ~1, E2→E3→E4 must ignore the
//   closer down-right decoy (outside the ±45° cone); each pan is the exact
//   post-state invariant vp.x = (rect.width - margin) - worldX·zoom
// Phase V — vertical cone: Up from E4 is an honest dead end (decoy 64°
//   off-axis); Up from E3 reaches the decoy dead above; Down returns to E3
// Phase C — Shift extends: two Shift+Rights grow the selection to 3 with
//   the last arrival as primary; past-E6 Right never wraps
// Phase E — dead end: selection AND viewport frozen
// Phase F — dashboard scope: arrows there are not hijacked
// Phase G — static contract: never-removing stepArrowFocus, scope +
//   listbox guards, drift penalty, minimal-pan math, shortcuts row
// Phase Z — cleanup: every seeded job deleted (asserted), console clean
//
// Run: node scripts/t103-e2e.mjs   (server on :3000)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CARD_W = 220; // mirrors @/lib/workflow — the probe seeds world coords
const CARD_H = 96;
const MARGIN = 96; // the handler's keep-on-screen margin
const RECT_W = 1600; // probe viewport width

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
    console.log(`FATAL: ${label}`);
    // sync exit (t102 lesson): an async cleanup lets the caller keep
    // running into a closed page — close fire-and-forget, die now
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

const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
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
/** selection state read from the cards' own ring classes (the same signal
 *  the user sees). The ring lives on the card BODY (role=button) INSIDE the
 *  [data-job] shell — reading the shell's className sees nothing (the first
 *  run's reader bug: S3 passed vacuously while the app worked fine). */
const readSelection = () =>
  p.evaluate(() => {
    const prim = [];
    const sec = [];
    for (const el of document.querySelectorAll("[data-job]")) {
      const body = el.querySelector('[role="button"]');
      if (!body) continue;
      if (body.className.includes("ring-primary/60")) prim.push(el.getAttribute("data-job"));
      else if (body.className.includes("ring-primary/30")) sec.push(el.getAttribute("data-job"));
    }
    return { primary: prim[0] ?? null, secondary: sec.sort(), total: prim.length + sec.length };
  });
const press = async (key) => {
  await p.keyboard.press(key);
  await sleep(350);
};
/** Pan the canvas by dragging EMPTY background so that the world point wx,wy
 *  sits at the viewport rect's center — plain 1:1 mouse pan. The drag starts
 *  INSIDE the viewport rect (the first run started at x=200 while the rect
 *  begins at x=288 — the palette ate the gesture and nothing panned). */
const panWorldPointToCenter = async (wx, wy) => {
  const vp = await readViewport();
  const rect = await p.evaluate(() => {
    const r = document.querySelector('[data-canvas="viewport"]')?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  });
  const curSX = wx * vp.zoom + vp.x; // card center, viewport-local x
  const curSY = wy * vp.zoom + vp.y;
  const dx = rect.width / 2 - curSX;
  const dy = rect.height / 2 - curSY;
  const sx = rect.x + 120; // inside the rect, over empty world (verified per layout)
  const sy = rect.y + 120;
  await p.mouse.move(sx, sy);
  await p.mouse.down();
  await p.mouse.move(sx + dx, sy + dy, { steps: 8 });
  await p.mouse.up();
  await sleep(800); // wait out the 400ms trailing debounce before anything reads
};
/** post-state invariant of the minimal pan: once a pan fires for a target
 *  whose world center is `wx` (at zoom z), vp.x lands at (rect.width -
 *  MARGIN) - wx·z. The rect is measured LIVE at assert time — the viewport
 *  is 1312px wide with no selection and 932px with the single-panel aside,
 *  and the handler used the width it saw during its own keydown tick. */
const expectedVpX = async (wx, z) => {
  const w = await p.evaluate(
    () => document.querySelector('[data-canvas="viewport"]')?.getBoundingClientRect().width ?? 0
  );
  return w - MARGIN - wx * z;
};
const clickCard = async (name) => {
  await p.locator(`[data-job="${ids[name]}"]`).click();
  await sleep(350);
};

/* ---------------- Phase S: adaptive remote seeding ---------------- */
console.log("Phase S — remote band seeding, view reset");
const existing = await (await api("/api/jobs")).json();
const all0 = existing.jobs ?? existing;
// idempotent pre-clean: leftovers of a crashed earlier run must not skew
// the geometry (a stray card inside a walk cone = wrong anchor)
for (const j of all0.filter((j) => j.name?.startsWith("t103 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
// re-fetch AFTER the sweep: stale bands inflate maxY/maxX and push the
// fresh band needlessly deep into the world (the first runs' FATAL paths
// exit without deleting their seeds — the sweep above is their only mop)
const all = (await (await api("/api/jobs")).json()).jobs ?? [];
const wsId = (await (await api("/api/workspaces")).json()).workspaces?.[0]?.id ?? "";
must(wsId !== "", "S0 workspace resolved for seeding");
// the band goes BELOW and EAST of everything that exists — fixtures live
// near the origin (the QA chain sprawls to x≈3920), cones are ±45°, so
// 2200px of vertical clearance protects the HORIZONTAL walks (fixtures
// would need to be >2200px east to enter a right/left cone) and 3000px of
// eastern clearance protects the VERTICAL walks (a fixture 2200px above
// but ≤2200px sideways would sit inside an up/down cone — west is safer:
// everything old is ≥3000px west, outside every vertical cone radius)
// VERTICAL-cone doctrine (rolled-back-world lesson): a card at the old
// world's NE corner enters E4's Up-cone whenever |vx| ≤ |vy| — i.e.
// whenever maxX+1260 ≤ Y0-160 ⟺ maxX ≤ maxY+780. The rolled-back world
// hit exactly that at a 60px margin (44.9° inside a 45° cone; the probe
// read a "wrong" hit that was geometrically CORRECT). So X0 takes the
// MAX of the eastern clearance and maxY+4380 — that keeps
// |vx| ≥ maxY+2640 > Y0-160 for EVERY old card, whatever aspect ratio
// the world happens to have. The cone must be killed by construction,
// not by the world's current shape.
const maxY = all.reduce((m, j) => Math.max(m, j.y ?? 0), 0);
const maxX = all.reduce((m, j) => Math.max(m, j.x ?? 0), 0);
const Y0 = Math.round(maxY + 2200);
const X0 = Math.round(Math.max(maxX + 3000, maxY + 4380));
must(Y0 > maxY + 2000 && X0 > maxX + 2500 && X0 - 1740 > Y0 - 160,
  `S1 band is ${Y0 - maxY}px below and ${X0 - maxX}px east of the old world — no cone reaches it (vertical dead: |vx| ${X0 - 1740} > |vy| ${Y0 - 160})`);
const LAYOUT = {
  "t103 E1": [X0, Y0],
  "t103 E2": [X0 + 600, Y0],
  "t103 E3": [X0 + 1200, Y0],
  "t103 E4": [X0 + 1800, Y0],
  "t103 E5": [X0 + 2400, Y0],
  "t103 E6": [X0 + 3000, Y0],
  "t103 D1": [X0 + 1200, Y0 - 340], // straight above E3 — the Up target
  "t103 D2": [X0 + 1260, Y0 + 320], // down-right of E3 — the cone trap
};
const ids = {};
for (const [name, [x, y]] of Object.entries(LAYOUT)) {
  const r = await (await api("/api/jobs", "POST", { type: "refine3d", name, workspaceId: wsId, x, y })).json();
  const id = (r.job ?? r).id;
  if (!id) { console.log(`FATAL: seed failed for ${name}`); process.exit(1); }
  ids[name] = id;
  seeded.push({ id, name });
}
must(Object.keys(ids).length === 8, "S2 8 cards seeded (6 chain + 2 decoys)");
b = await chromium.launch();
p = await b.newPage({ viewport: { width: RECT_W, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
await toCanvas();
// arm the entry: drag-pan E1's center onto the viewport rect's center.
// No click (a click selects and shifts the layout), no reload (the
// selection-driven right panel changes the rect across reloads) — the
// plain background drag IS the whole setup, and it must not box-select.
await panWorldPointToCenter(X0 + CARD_W / 2, Y0 + CARD_H / 2);
const centerWorld = await p.evaluate(() => {
  const r = document.querySelector('[data-canvas="viewport"]')?.getBoundingClientRect();
  const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(
    document.querySelector('[data-canvas="workspace"]')?.style.transform ?? ""
  );
  if (!r || !m) return null;
  return {
    x: (r.width / 2 - Number(m[1])) / Number(m[3]),
    y: (r.height / 2 - Number(m[2])) / Number(m[3]),
  };
});
must(centerWorld && Math.abs(centerWorld.x - (X0 + CARD_W / 2)) < 2 &&
    Math.abs(centerWorld.y - (Y0 + CARD_H / 2)) < 2,
  `S3 entry armed: background drag panned E1's center onto the viewport center (got ${JSON.stringify(centerWorld)})`);
must((await readSelection()).total === 0, "S4 the pan drag did not box-select (plain drag = pan, ⇧ drag = band)");

/* ---------------- Phase A: entry from the viewport center ---------------- */
console.log("Phase A — arrow enters the graph");
await press("ArrowRight");
let sel = await readSelection();
must(sel.total === 1 && sel.primary === ids["t103 E2"],
  `A1 ArrowRight anchors the chain card dead ahead of the viewport center (E1 itself excluded — zero forward; farther in-cone decoys lose on distance) — got ${JSON.stringify(sel)}`);

/* ---------------- Phase B: walk, trap spring, minimal pan ---------------- */
console.log("Phase B — cone beats distance, pan is minimal");
for (let i = 0; i < 12; i++) {
  const zv = await readViewport();
  if (zv && zv.zoom >= 1) break;
  await press("+"); // zoomAtCenter — the entry point (E1's center) stays put
}
let vp = await readViewport();
must(vp && vp.zoom >= 1, `B0 zoomed in for pan territory (zoom ${vp?.zoom.toFixed(3)})`);
const z = vp.zoom;
await press("ArrowRight"); // E2 → E3
sel = await readSelection();
must(sel.primary === ids["t103 E3"], "B1 E3 wins over the closer down-right decoy (79° off-axis, outside the ±45° cone)");
vp = await readViewport();
must(Math.abs(vp.x - (await expectedVpX(X0 + 1200 + CARD_W / 2, z))) < 1.5,
  `B2 pan lands on the exact post-state invariant (vp.x ${vp.x.toFixed(1)})`);
must(Math.abs(vp.zoom - z) < 0.001, "B3 pan never drifts the zoom");
await press("ArrowRight"); // E3 → E4
sel = await readSelection();
must(sel.primary === ids["t103 E4"], "B4 walk continues dead along the chain");
vp = await readViewport();
must(Math.abs(vp.x - (await expectedVpX(X0 + 1800 + CARD_W / 2, z))) < 1.5,
  `B5 pan re-fires at the next off-screen step (vp.x ${vp.x.toFixed(1)})`);

/* ---------------- Phase V: vertical cone ---------------- */
console.log("Phase V — up/down");
await press("ArrowUp"); // from E4: D1 is 64° off — dead end expected
sel = await readSelection();
must(sel.primary === ids["t103 E4"],
  `V1 Up from E4 is an honest dead end (decoy 64° off-axis; the old world is ≥3000px west — outside every vertical cone) — got ${JSON.stringify(sel)}`);
await press("ArrowLeft"); // E4 → E3 (dead ahead back)
await press("ArrowUp"); // E3 → D1 straight above
sel = await readSelection();
must(sel.primary === ids["t103 D1"], "V2 Up reaches the decoy dead above E3");
await press("ArrowDown"); // D1 → E3 (in-cone nearest: E3 340px vs D2 663px)
sel = await readSelection();
must(sel.primary === ids["t103 E3"], "V3 Down returns to E3 (cone-nearest — the below-right decoy is in-cone but farther)");

/* ---------------- Phase C: Shift extends, plain replaces ---------------- */
console.log("Phase C — shift-extend walk");
await press("ArrowRight"); // E3 → E4 (plain — replaces)
await press("Shift+ArrowRight"); // E5 joins, becomes primary
sel = await readSelection();
must(sel.total === 2 && sel.primary === ids["t103 E5"] && sel.secondary.join(",") === ids["t103 E4"],
  "C1 Shift+Arrow adds the target and promotes it to primary");
await press("Shift+ArrowRight"); // E6 joins
sel = await readSelection();
must(sel.total === 3 && sel.primary === ids["t103 E6"] &&
    sel.secondary.join(",") === [ids["t103 E4"], ids["t103 E5"]].sort().join(","),
  "C2 the walk grows the selection — survivors keep membership, last arrival anchors");
vp = await readViewport();
must(Math.abs(vp.x - (await expectedVpX(X0 + 3000 + CARD_W / 2, z))) < 1.5,
  "C3 pan follows the shift-walk too (the anchor must be on screen whoever anchored it)");

/* ---------------- Phase E: dead end is a no-op ---------------- */
console.log("Phase E — dead end");
const vpBefore = await readViewport();
await press("ArrowRight");
sel = await readSelection();
const vpAfter = await readViewport();
must(sel.total === 3 && sel.primary === ids["t103 E6"], "E1 dead end: selection unchanged");
must(JSON.stringify(vpBefore) === JSON.stringify(vpAfter), "E2 dead end: viewport frozen (no pan, no zoom drift)");

/* ---------------- Phase F: dashboard is not hijacked ---------------- */
console.log("Phase F — dashboard scope");
await press("Shift+D"); // to dashboard
await sleep(400);
await press("ArrowRight"); // native scroll/behavior there — not ours
await sleep(400);
await press("Shift+D"); // back
await sleep(400);
sel = await readSelection();
must(sel.total === 3 && sel.primary === ids["t103 E6"], "F1 arrows on the dashboard leave the canvas selection untouched");

/* ---------------- Phase G: static contract ---------------- */
console.log("Phase G — static contract");
const storeSrc = readFileSync("src/lib/store.ts", "utf8");
// bound the block: from the action to the NEXT action — an unbounded
// [\s\S]*? reaches toggleSelect's own filter and false-positives
const sfIdx = storeSrc.indexOf("stepArrowFocus: (id, extend) =>");
const sfBlock = sfIdx >= 0
  ? storeSrc.slice(sfIdx, storeSrc.indexOf("toggleSelect: (id) =>", sfIdx))
  : "";
must(
  /s\.selectedIds\.includes\(id\)\s*\?\s*s\.selectedIds/.test(sfBlock) &&
    sfBlock !== "" && !sfBlock.includes(".filter("),
  "G1 stepArrowFocus never removes — re-visiting a selected card re-anchors only"
);
const pageSrc = readFileSync("src/app/page.tsx", "utf8");
must(
  /k\.startsWith\("Arrow"\) && s\.view !== "dashboard"/.test(pageSrc),
  "G2 arrow branch is canvas-scoped (the dashboard keeps native arrow behavior)"
);
must(
  /querySelector\('\[role="listbox"\]'\)/.test(pageSrc),
  "G3 an open Radix Select listbox owns the arrows before the graph does"
);
must(
  /forward <= 0\) continue/.test(pageSrc) &&
    /cos < Math\.SQRT1_2\) continue/.test(pageSrc) &&
    /1 \+ 2 \* \(1 - cos\)/.test(pageSrc),
  "G4 half-plane gate + hard ±45° cone + mild in-cone drift preference present"
);
must(
  /margin = 96/.test(pageSrc) && /s\.setViewport\(\{ x: s\.viewport\.x \+ dx, y: s\.viewport\.y \+ dy \}\)/.test(pageSrc),
  "G5 pan is the minimal keep-inside translate — no re-centering, no zoom drift"
);
const dialogSrc = readFileSync("src/components/workflow/shortcuts-dialog.tsx", "utf8");
must(
  /keys: "← → ↑ ↓", text: "Walk the graph/.test(dialogSrc),
  "G6 shortcuts dialog documents the graph walk"
);

/* ---------------- Phase Z: cleanup + console ---------------- */
console.log("Phase Z — cleanup");
let deleted = 0;
for (const s of seeded) {
  const r = await api(`/api/jobs/${s.id}`, "DELETE");
  if (r.ok) deleted++;
}
must(deleted === seeded.length, `Z1 all ${seeded.length} seeded jobs deleted (got ${deleted})`);
must(consoleErrors.length === 0, `Z2 console clean (got ${consoleErrors.length})`);

console.log(`T103 ALL PASS (${PASS} assertions)`);
await cleanup();
process.exit(0);
