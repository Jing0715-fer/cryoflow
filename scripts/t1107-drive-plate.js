(async () => {
  const S = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, cx, cy) => {
    const O = { bubbles: true, cancelable: true, view: window, pointerId: 7, clientX: cx, clientY: cy, button: 0, isPrimary: true, pointerType: "mouse" };
    el.dispatchEvent(new PointerEvent("pointerdown", O));
    el.dispatchEvent(new PointerEvent("pointerup", O));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
  };
  const clickEl = (el) => { const r = el.getBoundingClientRect(); fire(el, Math.round(r.x + r.width / 2), Math.round(r.y + Math.min(r.height / 2, 20))); };
  try {
    // the chain (resumable)
    let dlg = document.querySelector("[role=dialog]");
    if (!dlg) {
      const card = [...document.querySelectorAll("[data-card-btn]")].find((b) => /3D Classification 1/.test(b.getAttribute("aria-label") || ""));
      if (!card) return "no-card";
      const r = card.getBoundingClientRect();
      fire(card, Math.round(r.x + r.width / 2), Math.round(r.y + Math.min(r.height / 2, 20)));
      for (let i = 0; i < 10; i++) { await S(1500); dlg = document.querySelector("[role=dialog]"); if (dlg) break; }
      if (!dlg) return "no-dialog";
    }
    const tab = [...dlg.querySelectorAll("[role=tab], button")].find((b) => b.textContent.trim() === "Results");
    if (!tab) return "no-tab";
    clickEl(tab); await S(1500);
    let en = null;
    for (let i = 0; i < 10; i++) {
      en = [...dlg.querySelectorAll("button")].find((b) => /Enlarge Class 1 map/.test(b.getAttribute("aria-label") || ""));
      if (en) break;
      await S(1200);
    }
    if (!en) return "no-enlarge";
    clickEl(en); await S(1200);
    let v3d = null;
    for (let i = 0; i < 6; i++) {
      v3d = [...document.querySelectorAll("[role=dialog] button")].find((b) => /View in 3D/.test(b.getAttribute("aria-label") || "") || /View in 3D/.test(b.textContent || ""));
      if (v3d) break;
      await S(900);
    }
    if (!v3d) return "no-v3d";
    clickEl(v3d);
    let acc = null;
    for (let i = 0; i < 10; i++) {
      await S(1600);
      acc = [...document.querySelectorAll("button")].find((b) => /Orthogonal slices/.test(b.textContent || ""));
      if (acc) break;
    }
    if (!acc) return "no-accordion";
    await S(2500); // the panel settles
    return "CHAIN-DONE";
  } catch (e) {
    return "ERR:" + e.message;
  }
})()
