(async () => {
  const S = (ms) => new Promise((r) => setTimeout(r, ms));
  const trace = [];
  const fire = (el, cx, cy, type) => {
    const O = { bubbles: true, cancelable: true, view: window, pointerId: 7, clientX: cx, clientY: cy, button: 0, isPrimary: true, pointerType: "mouse" };
    el.dispatchEvent(new PointerEvent(type || "pointerdown", O));
    if (!type || type === "pointerdown") el.dispatchEvent(new PointerEvent("pointerup", O));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
  };
  const clickEl = (el) => { const r = el.getBoundingClientRect(); fire(el, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)); };
  try {
    // 1. the card (pointer sequence — the canvas's own dialect)
    let card = [...document.querySelectorAll("[data-card-btn]")].find((b) => /3D Classification 1/.test(b.getAttribute("aria-label") || ""));
    if (!card) return "no-card";
    let r = card.getBoundingClientRect();
    fire(card, Math.round(r.x + r.width / 2), Math.round(r.y + Math.min(r.height / 2, 20)));
    await S(2500);
    const dlg = document.querySelector("[role=dialog]");
    if (!dlg) return "no-dialog";
    // 2. Results
    const tab = [...dlg.querySelectorAll("[role=tab], button")].find((b) => b.textContent.trim() === "Results");
    if (!tab) return "no-tab";
    clickEl(tab); await S(2500);
    // 3. Enlarge Class 1
    const en = [...dlg.querySelectorAll("button")].find((b) => /Enlarge Class 1 map/.test(b.getAttribute("aria-label") || ""));
    if (!en) return "no-enlarge";
    clickEl(en); await S(2000);
    // 4. View in 3D
    const v3d = [...document.querySelectorAll("[role=dialog] button")].find((b) => /View in 3D/.test(b.getAttribute("aria-label") || "") || /View in 3D/.test(b.textContent || ""));
    if (!v3d) return "no-v3d";
    clickEl(v3d);
    // 5. wait for the Mol* embed's Orthogonal slices accordion
    let acc = null;
    for (let i = 0; i < 25; i++) {
      await S(2000);
      acc = [...document.querySelectorAll("button")].find((b) => /Orthogonal slices/.test(b.textContent || ""));
      if (acc) break;
    }
    if (!acc) return "no-accordion";
    clickEl(acc); await S(2500);
    // 6. Slice on (the contour panel mounts late — poll)
    let slice = null;
    for (let i = 0; i < 14; i++) {
      slice = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Slice");
      if (slice) break;
      await S(1500);
    }
    if (!slice) return "no-slice";
    clickEl(slice); await S(2000);
    // 7. Oblique section open (poll)
    let ohead = null;
    for (let i = 0; i < 10; i++) {
      ohead = [...document.querySelectorAll("[role=dialog] *")].filter((e) => e.children.length === 0 && e.textContent.trim() === "Oblique section").pop();
      if (ohead) break;
      await S(1500);
    }
    if (!ohead) return "no-oblique-head";
    clickEl(ohead.closest("button, [role=button]") || ohead); await S(1500);
    // 8. cut on
    const cut = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Cut the 3D isosurface open at this plane");
    if (!cut) return "no-cut";
    if (cut.getAttribute("aria-pressed") !== "true") { clickEl(cut); }
    // 9. wait for the traces
    let tile = null;
    for (let i = 0; i < 12; i++) {
      await S(1500);
      tile = document.querySelector('[data-canvas-ui="ortho-tile-z"]');
      if (tile && tile.querySelector("svg[data-canvas-ui^=ortho-oblique-trace] line")) break;
    }
    if (!tile) return "no-tile-z";
    const line = tile.querySelector("svg[data-canvas-ui^=ortho-oblique-trace] line");
    const section = [...document.querySelectorAll("[role=dialog] *")].filter((e) => e.children.length === 0 && e.textContent.trim() === "Oblique section").pop();
    const readBlock = () => {
      const c = section.closest("div");
      let box = section.parentElement;
      while (box && !/θ polar/.test(box.textContent)) box = box.parentElement;
      const t = box ? box.textContent : "";
      const th = t.match(/θ polar\s*(\d+)°/);
      const ph = t.match(/φ azimuth\s*(\d+)°/);
      const of = t.match(/offset\s*([+\-]?\d+)%/);
      return { theta: th ? +th[1] : null, phi: ph ? +ph[1] : null, offset: of ? +of[1] : null };
    };
    const readLine = () => ({ x1: +line.getAttribute("x1"), y1: +line.getAttribute("y1"), x2: +line.getAttribute("x2"), y2: +line.getAttribute("y2") });
    const before = { block: readBlock(), line: readLine() };
    // 10. THE TURN: grab endpoint 1 (percent → px on the handler div)
    const surface = tile.querySelector("div[class*=cursor-crosshair]") || tile.lastElementChild;
    const sr = surface.getBoundingClientRect();
    const gr = tile.getBoundingClientRect();
    const ex = gr.x + (before.line.x1 / 100) * gr.width;
    const ey = gr.y + (before.line.y1 / 100) * gr.height;
    // drag target: 46px below the endpoint, clamped inside the surface
    const tx = Math.min(sr.right - 6, Math.max(sr.left + 6, ex));
    const ty = Math.min(sr.bottom - 6, Math.max(sr.top + 6, ey + 46));
    const down = { bubbles: true, cancelable: true, view: window, pointerId: 9, clientX: ex, clientY: ey, button: 0, isPrimary: true, pointerType: "mouse" };
    surface.dispatchEvent(new PointerEvent("pointerdown", down));
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const mx = ex + ((tx - ex) * i) / steps;
      const my = ey + ((ty - ey) * i) / steps;
      surface.dispatchEvent(new PointerEvent("pointermove", { ...down, clientX: mx, clientY: my }));
      await S(140);
    }
    surface.dispatchEvent(new PointerEvent("pointerup", { ...down, clientX: tx, clientY: ty }));
    await S(2500);
    const after = { block: readBlock(), line: readLine() };
    // 11. the world unmoved: the jobs count on the footer
    const world = (document.body.textContent.match(/(\d+) jobs · (\d+) edges/) || [])[0] || null;
    return JSON.stringify({ before, after, moved: Math.hypot(after.line.x1 - before.line.x1, after.line.y1 - before.line.y1) > 1 || Math.hypot(after.line.x2 - before.line.x2, after.line.y2 - before.line.y2) > 1, thetaChanged: after.block.theta !== before.block.theta || after.block.phi !== before.block.phi, offsetUnmoved: after.block.offset === before.block.offset, world });
  } catch (e) {
    return "ERR:" + e.message + "|" + trace.join("|");
  }
})()
