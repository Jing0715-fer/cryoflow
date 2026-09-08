// Synthetic two-finger pinch QA v2 — ASYNC steps so rAF flushes between
// moves (a fully synchronous gesture gets its queued applyPinch cancelled
// by endPinch before any frame fires — real fingers take ~200 ms).
(() => {
  const el = document.querySelector(".canvas-grid");
  if (!el) return "no canvas";
  const r = el.getBoundingClientRect();
  const mk = (type, id, x, y) =>
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: id,
      pointerType: "touch",
      isPrimary: id === 200,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  (async () => {
    // pinch OUT: spread 70 → 190 px over 12 frames
    el.dispatchEvent(mk("pointerdown", 200, cx - 35, cy));
    await wait(30);
    el.dispatchEvent(mk("pointerdown", 201, cx + 35, cy));
    await wait(30);
    for (let i = 1; i <= 12; i++) {
      const s = 35 + i * 13; // 35 → 191
      el.dispatchEvent(mk("pointermove", 200, cx - s, cy));
      el.dispatchEvent(mk("pointermove", 201, cx + s, cy));
      await wait(16);
    }
    await wait(80); // let the last rAF flush before lifting
    el.dispatchEvent(mk("pointerup", 200, cx - 191, cy));
    el.dispatchEvent(mk("pointerup", 201, cx + 191, cy));
    window.__pinchStage = "out-done";
    await wait(250);
    // pinch IN: 190 → 40 px over 12 frames
    el.dispatchEvent(mk("pointerdown", 202, cx - 95, cy));
    await wait(30);
    el.dispatchEvent(mk("pointerdown", 203, cx + 95, cy));
    await wait(30);
    for (let i = 1; i <= 12; i++) {
      const s = 95 - i * 4.6; // 95 → 39.8
      el.dispatchEvent(mk("pointermove", 202, cx - s, cy));
      el.dispatchEvent(mk("pointermove", 203, cx + s, cy));
      await wait(16);
    }
    await wait(80);
    el.dispatchEvent(mk("pointerup", 202, cx - 40, cy));
    el.dispatchEvent(mk("pointerup", 203, cx + 40, cy));
    window.__pinchStage = "in-done";
  })();
  return "async gesture started";
})()
