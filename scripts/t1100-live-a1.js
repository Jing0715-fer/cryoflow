(async () => {
  const S = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, cx, cy) => {
    const O = { bubbles: true, cancelable: true, view: window, pointerId: 7, clientX: cx, clientY: cy, button: 0, isPrimary: true, pointerType: "mouse" };
    el.dispatchEvent(new PointerEvent("pointerdown", O));
    el.dispatchEvent(new PointerEvent("pointerup", O));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
  };
  const clickEl = (el) => { const r = el.getBoundingClientRect(); fire(el, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)); };
  const card = [...document.querySelectorAll("[data-card-btn]")].find((b) => /3D Classification 1/.test(b.getAttribute("aria-label") || ""));
  if (!card) return "no-card";
  let r = card.getBoundingClientRect();
  fire(card, Math.round(r.x + r.width / 2), Math.round(r.y + Math.min(r.height / 2, 20)));
  await S(1600);
  const dlg = document.querySelector("[role=dialog]");
  if (!dlg) return "no-dialog";
  const tab = [...dlg.querySelectorAll("[role=tab], button")].find((b) => b.textContent.trim() === "Results");
  if (!tab) return "no-tab";
  clickEl(tab); await S(1600);
  const en = [...dlg.querySelectorAll("button")].find((b) => /Enlarge Class 1 map/.test(b.getAttribute("aria-label") || ""));
  if (!en) return "no-enlarge";
  clickEl(en); await S(1400);
  const v3d = [...document.querySelectorAll("[role=dialog] button")].find((b) => /View in 3D/.test(b.getAttribute("aria-label") || "") || /View in 3D/.test(b.textContent || ""));
  if (!v3d) return "no-v3d";
  clickEl(v3d);
  let canvas = null;
  for (let i = 0; i < 8; i++) {
    await S(1800);
    canvas = document.querySelector("[role=dialog] canvas");
    if (canvas) break;
  }
  return canvas ? "molstar-up" : "no-canvas";
})()
