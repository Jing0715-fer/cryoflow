/**
 * Task 35 E2E — pinch zoom% bubble stays on-canvas when the finger midpoint
 * slides past the canvas edge (async stepped synthetic pointers, 16ms/frame).
 *   A. on-canvas pinch: bubble tracks the midpoint (regression)
 *   B. off-canvas pinch (mid → W+90, H+70): bubble clamped inside bounds
 * Usage: eval in page context; writes window.__qa35p
 */
const step = 16;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const root = document.querySelector('[data-canvas="viewport"]');
const R = root.getBoundingClientRect();

async function fire(id, type, x, y) {
  root.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, composed: true,
    pointerId: id, pointerType: "touch", isPrimary: id === 91,
    clientX: R.x + x, clientY: R.y + y,
    // down: primary button pressed · move: buttons held · up: released
    button: type === "pointerdown" ? 0 : -1,
    buttons: type === "pointerup" ? 0 : 1,
  }));
}

function bubblePos() {
  // the chip: span[aria-hidden] with -translate classes inside the root
  const spans = root.querySelectorAll("span[aria-hidden=true]");
  for (const s of spans) {
    if (/%\s*$/.test(s.textContent) && s.className.includes("-translate-x-1/2")) {
      return { left: parseFloat(s.style.left), top: parseFloat(s.style.top), text: s.textContent.trim() };
    }
  }
  return null;
}

async function pinchTrack(pts1, pts2, id1, id2, stepsPerSeg = 12) {
  await fire(id1, "pointerdown", pts1[0].x, pts1[0].y);
  await sleep(step * 2);
  await fire(id2, "pointerdown", pts2[0].x, pts2[0].y);
  await sleep(step * 2);
  const n = Math.max(pts1.length, pts2.length);
  for (let i = 0; i < n; i++) {
    const p1 = pts1[Math.min(i, pts1.length - 1)];
    const p2 = pts2[Math.min(i, pts2.length - 1)];
    await fire(id1, "pointermove", p1.x, p1.y);
    await fire(id2, "pointermove", p2.x, p2.y);
    await sleep(step);
    if (i % 3 === 2) {
      const b = bubblePos();
      if (b) window.__qa35samples.push(b);
    }
  }
  await fire(id1, "pointerup", pts1[pts1.length - 1].x, pts1[pts1.length - 1].y);
  await fire(id2, "pointerup", pts2[pts2.length - 1].x, pts2[pts2.length - 1].y);
  await sleep(80);
}

window.__qa35samples = [];
const out = { W: R.width, H: R.height };

// ---- A: on-canvas pinch (spread horizontally, mid stays inside) ----
await pinchTrack(
  [{ x: R.width * 0.32, y: R.height * 0.45 }, { x: R.width * 0.24, y: R.height * 0.45 }],
  [{ x: R.width * 0.52, y: R.height * 0.45 }, { x: R.width * 0.64, y: R.height * 0.45 }],
  91, 92
);
const aSamples = window.__qa35samples.slice();
window.__qa35samples = [];
const midA = aSamples.length; // bubble should be present during gesture

// ---- B: off-canvas pinch (spread + drag past bottom-right corner) ----
await pinchTrack(
  [{ x: R.width * 0.34, y: R.height * 0.4 }, { x: R.width * 0.30, y: R.height * 0.46 }, { x: R.width + 40, y: R.height * 0.55 }, { x: R.width + 90, y: R.height + 40 }],
  [{ x: R.width * 0.54, y: R.height * 0.4 }, { x: R.width * 0.62, y: R.height * 0.46 }, { x: R.width + 90, y: R.height * 0.6 }, { x: R.width + 150, y: R.height + 70 }],
  93, 94
);
const bSamples = window.__qa35samples.slice();

out.A = { samples: aSamples.length, last: aSamples[aSamples.length - 1] ?? null, bubbleSeen: midA > 0 };
out.B = {
  samples: bSamples.length,
  maxLeft: Math.max(...bSamples.map((s) => s.left)),
  maxTop: Math.max(...bSamples.map((s) => s.top)),
  boundLeft: R.width - 26 - 6,
  boundTop: R.height - 8,
  offCanvasSeen: bSamples.some((s) => s.left > R.width - 40),
  last: bSamples[bSamples.length - 1] ?? null,
};
out.B.clamped = out.B.maxLeft <= out.B.boundLeft && out.B.maxTop <= out.B.boundTop;
window.__qa35p = out;
console.log("[qa35p] done", JSON.stringify(out));
