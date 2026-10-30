(async () => {
  const S = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__t1100spoken && (window.__t1100spoken.length = 0);
  const tile = document.querySelector('[data-canvas-ui="ortho-tile-z"]');
  if (!tile) return "no-tile-z";
  const line = tile.querySelector("svg[data-canvas-ui^=ortho-oblique-trace] line");
  if (!line) return "no-trace";
  const readBlock = () => {
    const dlgs = [...document.querySelectorAll("[role=dialog]")];
    const t = dlgs.map((d) => d.textContent).find((x) => /θ polar/.test(x)) || "";
    const th = t.match(/θ polar\s*(\d+)°/);
    const ph = t.match(/φ azimuth\s*(\d+)°/);
    const of = t.match(/offset\s*([+\-]?\d+)%/);
    return { theta: th ? +th[1] : null, phi: ph ? +ph[1] : null, offset: of ? +of[1] : null };
  };
  const before = readBlock();
  const surface = [...tile.children].find((c) => typeof c.className === "string" && c.className.includes("aspect-square"));
  const sr = surface.getBoundingClientRect();
  // the line's MIDPOINT (the body — the slide's word), 24px above it (the
  // grab radius is 14 — 24px off is a miss; land ON the midpoint)
  const mx = sr.x + ((+line.getAttribute("x1") + +line.getAttribute("x2")) / 200) * sr.width;
  const my = sr.y + ((+line.getAttribute("y1") + +line.getAttribute("y2")) / 200) * sr.height;
  const tx = mx, ty = Math.min(sr.bottom - 6, my + 40);
  const down = { bubbles: true, cancelable: true, view: window, pointerId: 11, clientX: mx, clientY: my, button: 0, isPrimary: true, pointerType: "mouse" };
  surface.dispatchEvent(new PointerEvent("pointerdown", down));
  for (let i = 1; i <= 5; i++) {
    surface.dispatchEvent(new PointerEvent("pointermove", { ...down, clientX: mx, clientY: my + ((ty - my) * i) / 5 }));
    await S(140);
  }
  surface.dispatchEvent(new PointerEvent("pointerup", { ...down, clientX: tx, clientY: ty }));
  await S(2400);
  const after = readBlock();
  const tile2 = document.querySelector('[data-canvas-ui="ortho-tile-z"]');
  const line2 = tile2 && tile2.querySelector("svg[data-canvas-ui^=ortho-oblique-trace] line");
  return JSON.stringify({
    before, after,
    offsetMoved: after.offset !== before.offset,
    anglesUnmoved: after.theta === before.theta && after.phi === before.phi,
    lineMoved: line2 ? Math.abs(+line2.getAttribute("x1") - +line.getAttribute("x1")) > 1 : null,
    spoken: (window.__t1100spoken || []).slice(0, 6),
    errs: (window.__t1100err || []).slice(0, 3),
  });
})()
