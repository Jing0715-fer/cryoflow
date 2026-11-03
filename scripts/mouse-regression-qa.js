// Mouse shift-band + plain click regression
(() => {
  const el = document.querySelector(".canvas-grid");
  const r = el.getBoundingClientRect();
  const mk = (type, id, x, y, shift) =>
    new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: "mouse",
      isPrimary: true, clientX: x, clientY: y, button: 0,
      buttons: type === "pointerup" ? 0 : 1, shiftKey: shift,
    });
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  (async () => {
    el.dispatchEvent(mk("pointerdown", 500, cx - 250, cy - 150, true));
    await wait(50);
    el.dispatchEvent(mk("pointermove", 500, cx - 150, cy - 60, true));
    await wait(40);
    window.__bandMouse = !!document.querySelector("svg rect[stroke-dasharray]");
    el.dispatchEvent(mk("pointerup", 500, cx - 150, cy - 60, true));
    await wait(100);
    // plain click on background → clears selection (must not throw)
    el.dispatchEvent(mk("pointerdown", 501, cx, cy, false));
    await wait(30);
    el.dispatchEvent(mk("pointerup", 501, cx, cy, false));
    window.__mouseDone = true;
  })();
  return "mouse regression started";
})()
