// Touch + mouse gesture regression after pinch landed
(() => {
  const el = document.querySelector(".canvas-grid");
  const r = el.getBoundingClientRect();
  const mk = (type, id, x, y, type2 = "touch") =>
    new PointerEvent(type, {
      bubbles: true, cancelable: true, composed: true,
      pointerId: id, pointerType: type2, isPrimary: true,
      clientX: x, clientY: y, button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    });
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  (async () => {
    // A. single-finger pan: down → drag 120px → up; viewport x should shift ~120
    window.__vpBefore = getComputedStyle([...document.querySelectorAll("div")].find((d) => d.style?.transform?.includes("scale"))).transform;
    el.dispatchEvent(mk("pointerdown", 400, cx, cy));
    await wait(40);
    for (let i = 1; i <= 6; i++) {
      el.dispatchEvent(mk("pointermove", 400, cx + i * 20, cy));
      await wait(16);
    }
    await wait(80);
    el.dispatchEvent(mk("pointerup", 400, cx + 120, cy));
    window.__panDone = true;
    await wait(200);
    // B. long-press → band: press, hold 500ms, drag, up → selection set may
    //    be empty (band over empty space) but the BAND must have appeared;
    //    verify via the marching-ants rect element existence mid-gesture.
    el.dispatchEvent(mk("pointerdown", 401, cx - 200, cy - 100));
    await wait(500); // > LP_PRESS_MS 420
    el.dispatchEvent(mk("pointermove", 401, cx - 120, cy - 40));
    await wait(60);
    window.__bandSeen = !!document.querySelector("svg rect[stroke-dasharray]");
    el.dispatchEvent(mk("pointerup", 401, cx - 120, cy - 40));
    window.__lpDone = true;
  })();
  return "regression started";
})()
