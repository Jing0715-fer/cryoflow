(async () => {
  const S = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, cx, cy) => {
    const O = { bubbles: true, cancelable: true, view: window, pointerId: 7, clientX: cx, clientY: cy, button: 0, isPrimary: true, pointerType: "mouse" };
    el.dispatchEvent(new PointerEvent("pointerdown", O));
    el.dispatchEvent(new PointerEvent("pointerup", O));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
  };
  const clickEl = (el) => { const r = el.getBoundingClientRect(); fire(el, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)); };
  const dlg = document.querySelector("[role=dialog]");
  if (!dlg) return "no-dialog";
  const acc = [...document.querySelectorAll("button")].find((b) => /Orthogonal slices/.test(b.textContent || ""));
  if (!acc) return "no-accordion";
  const accState = acc.getAttribute("data-state") || acc.getAttribute("aria-expanded") || "collapsed";
  if (accState === "closed" || accState === "collapsed" || accState === "false") clickEl(acc);
  await S(1500);
  let slice = null;
  for (let i = 0; i < 5; i++) {
    slice = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Slice");
    if (slice) break;
    await S(1000);
  }
  if (!slice) return "no-slice";
  clickEl(slice); await S(1200);
  let ohead = null;
  for (let i = 0; i < 5; i++) {
    ohead = [...document.querySelectorAll("[role=dialog] *")].filter((e) => e.children.length === 0 && e.textContent.trim() === "Oblique section").pop();
    if (ohead) break;
    await S(1000);
  }
  if (!ohead) return "no-oblique-head";
  clickEl(ohead.closest("button, [role=button]") || ohead); await S(1000);
  const cut = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Cut the 3D isosurface open at this plane");
  const tilesPre = document.querySelectorAll('[data-canvas-ui^=ortho-tile]').length;
  const tracesPre = document.querySelectorAll("svg[data-canvas-ui^=ortho-oblique-trace]").length;
  const endsPre = document.querySelectorAll('[data-canvas-ui^=ortho-oblique-end]').length;
  return JSON.stringify({ ready: true, cutPressed: cut ? cut.getAttribute("aria-pressed") : "gone", tilesPre, tracesPre, endsPre });
})()
