// Third-finger guard: A+B pinch, C lands → C must be ignored (no pan)
(() => {
  const el = document.querySelector(".canvas-grid");
  const r = el.getBoundingClientRect();
  const mk = (type, id, x, y) =>
    new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: "touch",
      isPrimary: id === 600, clientX: x, clientY: y, button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  (async () => {
    el.dispatchEvent(mk("pointerdown", 600, cx - 40, cy));
    await wait(30);
    el.dispatchEvent(mk("pointerdown", 601, cx + 40, cy));
    await wait(30);
    el.dispatchEvent(mk("pointerdown", 602, cx + 200, cy + 100)); // 3rd finger
    await wait(30);
    // drag the 3rd finger hard — if it armed a pan, the viewport would move
    for (let i = 1; i <= 5; i++) {
      el.dispatchEvent(mk("pointermove", 602, cx + 200 + i * 24, cy + 100));
      await wait(16);
    }
    await wait(60);
    const vp = [...document.querySelectorAll("div")].find((d) => d.style?.transform?.includes("scale"));
    window.__vpAfterThird = vp?.style?.transform;
    // drag fingers A+B slightly (pinch continues, 3rd stays ignored)
    el.dispatchEvent(mk("pointermove", 600, cx - 60, cy));
    el.dispatchEvent(mk("pointermove", 601, cx + 60, cy));
    await wait(80);
    el.dispatchEvent(mk("pointerup", 600, cx - 60, cy));
    el.dispatchEvent(mk("pointerup", 601, cx + 60, cy));
    el.dispatchEvent(mk("pointerup", 602, cx + 320, cy + 100));
    window.__thirdDone = true;
  })();
  return "third-finger test started";
})()
