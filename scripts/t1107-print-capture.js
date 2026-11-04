(async () => {
  const S = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, cx, cy) => {
    const O = { bubbles: true, cancelable: true, view: window, pointerId: 7, clientX: cx, clientY: cy, button: 0, isPrimary: true, pointerType: "mouse" };
    el.dispatchEvent(new PointerEvent("pointerdown", O));
    el.dispatchEvent(new PointerEvent("pointerup", O));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
  };
  try {
    const btn = document.querySelector('[data-canvas-ui="ortho-plate-print"]');
    if (!btn) return "no-print-btn";
    const r = btn.getBoundingClientRect();
    fire(btn, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2));
    let flag = false;
    for (let i = 0; i < 12; i++) { await S(500); flag = document.body.hasAttribute("data-plate-print"); if (flag) break; }
    if (!flag) return "no-flag";
    await S(800); // the imgs settle — then return AT ONCE, the pdf command rides the same bash
    return "FLAG-ARMED";
  } catch (e) {
    return "ERR:" + e.message;
  }
})()
