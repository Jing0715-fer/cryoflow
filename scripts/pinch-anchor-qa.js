// Controlled anchor test: reset → pinch at an OFF-CENTER midpoint →
// the workspace point under the initial midpoint must stay under it.
(() => {
  const el = document.querySelector(".canvas-grid");
  const r = el.getBoundingClientRect();
  const mk = (type, id, x, y) =>
    new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: id, pointerType: "touch", isPrimary: id === 300,
      clientX: x, clientY: y, button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
  const mx = r.x + r.width * 0.3; // off-center midpoint
  const my = r.y + r.height * 0.6;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  (async () => {
    el.dispatchEvent(mk("pointerdown", 300, mx - 30, my));
    await wait(30);
    el.dispatchEvent(mk("pointerdown", 301, mx + 30, my));
    await wait(30);
    for (let i = 1; i <= 4; i++) {
      const s = 30 + i * 5; // 30 → 50 (ratio 1.667)
      el.dispatchEvent(mk("pointermove", 300, mx - s, my));
      el.dispatchEvent(mk("pointermove", 301, mx + s, my));
      await wait(16);
    }
    await wait(80);
    el.dispatchEvent(mk("pointerup", 300, mx - 50, my));
    el.dispatchEvent(mk("pointerup", 301, mx + 50, my));
    window.__anchorStage = "done";
  })();
  return "anchor pinch started";
})()
