/**
 * Task 35 E2E — minimap touch adaptation (async stepped synthetic pointers).
 * Scenarios:
 *   A. touch drag ON the minimap svg → viewport pans (transform changes)
 *   B. touch drag starting on the "map" caption (padding area) → pans too
 *   C. touch long-press (~700ms, still) on minimap → NO Radix canvas menu
 *   D. mouse drag on minimap → still navigates (desktop regression)
 * Usage: node scripts/qa35-minimap-touch.mjs  (browser must be on the canvas)
 */
const step = 16;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fire(el, type, x, y, id, pointerType) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: id, pointerType, isPrimary: true,
      clientX: x, clientY: y, buttons: 1, button: 0,
      pressure: pointerType === "touch" ? 0.5 : 0,
    })
  );
}

function viewportTransform() {
  const ws = document.querySelector('[data-canvas="workspace"]');
  return ws ? ws.style.transform : "missing";
}

function minimapRect() {
  const mm = document.querySelector('[data-canvas-ui="minimap"]');
  if (!mm) return null;
  const r = mm.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, left: r.x, top: r.y, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
}

async function dragSequence(el, from, to, pointerType, id, opts = {}) {
  await fire(el, "pointerdown", from.x, from.y, id, pointerType);
  const steps = opts.steps ?? 10;
  const preDelay = opts.preDelay ?? 0;
  if (preDelay) await sleep(preDelay);
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await fire(el, "pointermove", x, y, id, pointerType);
    await sleep(step);
  }
  await fire(el, "pointerup", to.x, to.y, id, pointerType);
}

const out = { A: {}, B: {}, C: {}, D: {} };

// ---------- A: touch drag on the svg area ----------
const mm = minimapRect();
if (!mm) throw new Error("minimap not found");
const svg = document.querySelector('[data-canvas-ui="minimap"] svg');

out.A.before = viewportTransform();
await dragSequence(svg, { x: mm.cx, y: mm.cy - 10 }, { x: mm.cx - 60, y: mm.cy - 30 }, "touch", 71);
await sleep(120);
out.A.after = viewportTransform();

// ---------- B: touch drag from the "map" caption ----------
const cap = document.querySelector('[data-canvas-ui="minimap"] p');
const capR = cap.getBoundingClientRect();
out.B.before = viewportTransform();
await dragSequence(cap, { x: capR.x + capR.width / 2, y: capR.y + capR.height / 2 }, { x: capR.x + 40, y: capR.y - 20 }, "touch", 72);
await sleep(120);
out.B.after = viewportTransform();

// ---------- C: touch long-press still on minimap → no menu ----------
await fire(svg, "pointerdown", mm.cx, mm.cy - 10, 73, "touch");
await sleep(700); // past Chrome's ~500ms contextmenu window
await fire(svg, "pointerup", mm.cx, mm.cy - 10, 73, "touch");
await sleep(200);
out.C.menuOpen = !!document.querySelector('[role="menu"]');
out.C.menuItems = document.querySelectorAll('[role="menuitem"]').length;

// ---------- D: mouse drag regression ----------
out.D.before = viewportTransform();
await dragSequence(svg, { x: mm.cx, y: mm.cy - 10 }, { x: mm.cx + 50, y: mm.cy + 20 }, "mouse", 74);
await sleep(120);
out.D.after = viewportTransform();

const moved = (a, b) => a !== b;
const result = {
  A_touchSvg: { moved: moved(out.A.before, out.A.after), from: out.A.before.slice(0, 60), to: out.A.after.slice(0, 60) },
  B_touchCaption: { moved: moved(out.B.before, out.B.after), from: out.B.before.slice(0, 60), to: out.B.after.slice(0, 60) },
  C_longPress: out.C,
  D_mouseDrag: { moved: moved(out.D.before, out.D.after), to: out.D.after.slice(0, 60) },
};
window.__qa35 = result;
console.log("[qa35] done", JSON.stringify(result));
