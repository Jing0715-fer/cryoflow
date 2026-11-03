(async () => {
  const S = (ms) => new Promise((r) => setTimeout(r, ms));
  if (!window.__t1100trap) { window.__t1100err = []; }
  window.__t1100err && (window.__t1100err.length = 0);
  // the event listener: what does the tile SPEAK?
  window.__t1100spoken = [];
  if (!window.__t1100listening) {
    window.__t1100listening = true;
    window.addEventListener("cryoflow:oblique-clip", (e) => {
      try { window.__t1100spoken.push(JSON.stringify(e.detail).slice(0, 140)); } catch {}
    });
  }
  window.__t1100spoken.length = 0;
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
  const readLine = () => ({ x1: +line.getAttribute("x1"), y1: +line.getAttribute("y1"), x2: +line.getAttribute("x2"), y2: +line.getAttribute("y2") });
  const before = { block: readBlock(), line: readLine() };
  // the handler div: hover may swap cursor-crosshair → cursor-grab — pick
  // by the STABLE class (aspect-square), the fiber-verified pointer owner
  const surface = [...tile.children].find((c) => typeof c.className === "string" && c.className.includes("aspect-square")) || tile.lastElementChild;
  const sr = surface.getBoundingClientRect();
  // the endpoints ride the SURFACE's own coordinate space (the trace svg
  // is inset-0 within it) — the tile root's rect is offset by the header
  const ex = sr.x + (before.line.x1 / 100) * sr.width;
  const ey = sr.y + (before.line.y1 / 100) * sr.height;
  const tx = Math.min(sr.right - 6, Math.max(sr.left + 6, ex));
  const ty = Math.min(sr.bottom - 6, Math.max(sr.top + 6, ey + 46));
  const down = { bubbles: true, cancelable: true, view: window, pointerId: 9, clientX: ex, clientY: ey, button: 0, isPrimary: true, pointerType: "mouse" };
  surface.dispatchEvent(new PointerEvent("pointerdown", down));
  for (let i = 1; i <= 6; i++) {
    surface.dispatchEvent(new PointerEvent("pointermove", { ...down, clientX: ex + ((tx - ex) * i) / 6, clientY: ey + ((ty - ey) * i) / 6 }));
    await S(130);
  }
  surface.dispatchEvent(new PointerEvent("pointerup", { ...down, clientX: tx, clientY: ty }));
  await S(2600);
  const after = { block: readBlock(), line: readLine() };
  const world = (document.body.textContent.match(/(\d+) jobs · (\d+) edges/) || [])[0] || null;
  return JSON.stringify({
    before, after,
    lineMoved: Math.hypot(after.line.x1 - before.line.x1, after.line.y1 - before.line.y1) > 1 || Math.hypot(after.line.x2 - before.line.x2, after.line.y2 - before.line.y2) > 1,
    anglesMoved: after.block.theta !== before.block.theta || after.block.phi !== before.block.phi,
    offsetUnmoved: after.block.offset === before.block.offset,
    endHandles: document.querySelectorAll('[data-canvas-ui^=ortho-oblique-end]').length,
    spoken: (window.__t1100spoken || []).slice(0, 8),
    dlgAlive: document.querySelectorAll("[role=dialog]").length,
    world, errs: (window.__t1100err || []).slice(0, 4),
  });
})()
