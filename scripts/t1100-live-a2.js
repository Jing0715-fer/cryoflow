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
  clickEl(acc); await S(1800);
  let slice = null;
  for (let i = 0; i < 6; i++) {
    slice = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Slice");
    if (slice) break;
    await S(1200);
  }
  if (!slice) return "no-slice";
  clickEl(slice); await S(1500);
  let ohead = null;
  for (let i = 0; i < 6; i++) {
    ohead = [...document.querySelectorAll("[role=dialog] *")].filter((e) => e.children.length === 0 && e.textContent.trim() === "Oblique section").pop();
    if (ohead) break;
    await S(1200);
  }
  if (!ohead) return "no-oblique-head";
  clickEl(ohead.closest("button, [role=button]") || ohead); await S(1200);
  const cut = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Cut the 3D isosurface open at this plane");
  if (!cut) return "no-cut";
  if (cut.getAttribute("aria-pressed") !== "true") { clickEl(cut); }
  let tile = null;
  for (let i = 0; i < 8; i++) {
    await S(1400);
    tile = document.querySelector('[data-canvas-ui="ortho-tile-z"]');
    if (tile && tile.querySelector("svg[data-canvas-ui^=ortho-oblique-trace] line")) break;
  }
  if (!tile) return "no-tile-z";
  const line = tile.querySelector("svg[data-canvas-ui^=ortho-oblique-trace] line");
  const readBlock = () => {
    const t = document.querySelector("[role=dialog]").textContent;
    const th = t.match(/θ polar\s*(\d+)°/);
    const ph = t.match(/φ azimuth\s*(\d+)°/);
    const of = t.match(/offset\s*([+\-]?\d+)%/);
    return { theta: th ? +th[1] : null, phi: ph ? +ph[1] : null, offset: of ? +of[1] : null };
  };
  const readLine = () => ({ x1: +line.getAttribute("x1"), y1: +line.getAttribute("y1"), x2: +line.getAttribute("x2"), y2: +line.getAttribute("y2") });
  const ends = [...document.querySelectorAll('[data-canvas-ui^=ortho-oblique-end]')];
  return JSON.stringify({ cutOn: cut.getAttribute("aria-pressed"), block: readBlock(), line: readLine(), traces: [...document.querySelectorAll('svg[data-canvas-ui^=ortho-oblique-trace]')].length, endHandles: ends.length, badges: [...document.querySelectorAll('[data-canvas-ui^=ortho-oblique-badge]')].length });
})()
