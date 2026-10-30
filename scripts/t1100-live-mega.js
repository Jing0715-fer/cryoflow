(async () => {
  const S = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, cx, cy) => {
    const O = { bubbles: true, cancelable: true, view: window, pointerId: 7, clientX: cx, clientY: cy, button: 0, isPrimary: true, pointerType: "mouse" };
    el.dispatchEvent(new PointerEvent("pointerdown", O));
    el.dispatchEvent(new PointerEvent("pointerup", O));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
  };
  const clickEl = (el) => { const r = el.getBoundingClientRect(); fire(el, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)); };
  try {
    const card = [...document.querySelectorAll("[data-card-btn]")].find((b) => /3D Classification 1/.test(b.getAttribute("aria-label") || ""));
    if (!card) return "no-card";
    let r = card.getBoundingClientRect();
    fire(card, Math.round(r.x + r.width / 2), Math.round(r.y + Math.min(r.height / 2, 20)));
    await S(1500);
    const dlg = document.querySelector("[role=dialog]");
    if (!dlg) return "no-dialog";
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
    // state-aware: only click when the accordion is actually collapsed
    // (a fresh dialog may open it expanded — a blind click folds it)
    const accState = acc.getAttribute('data-state') || acc.getAttribute('aria-expanded') || 'collapsed';
    if (accState === 'closed' || accState === 'collapsed' || accState === 'false') { clickEl(acc); }
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
    if (!cut) return "no-cut";
    const cutBefore = cut.getAttribute("aria-pressed");
    if (cutBefore !== "true") clickEl(cut);
    let tile = null;
    for (let i = 0; i < 7; i++) {
      await S(800);
      tile = document.querySelector('[data-canvas-ui="ortho-tile-z"]');
      if (tile && tile.querySelector("svg[data-canvas-ui^=ortho-oblique-trace] line")) break;
    }
    if (!tile) {
      const acc2 = [...document.querySelectorAll("button")].find((b) => /Orthogonal slices/.test(b.textContent || ""));
      const st2 = acc2 ? (acc2.getAttribute('data-state') || acc2.getAttribute('aria-expanded')) : null;
      if (st2 === 'closed' || st2 === 'collapsed' || st2 === 'false') { clickEl(acc2); await S(1500); }
      tile = document.querySelector('[data-canvas-ui="ortho-tile-z"]');
    }
    if (!tile) {
      const acc2 = [...document.querySelectorAll("button")].find((b) => /Orthogonal slices/.test(b.textContent || ""));
      const cut2 = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Cut the 3D isosurface open at this plane");
      return "no-tile-z:dlg=" + document.querySelectorAll("[role=dialog]").length + ":acc=" + (acc2 ? acc2.getAttribute('data-state') || acc2.getAttribute('aria-expanded') : 'gone') + ":cut=" + (cut2 ? cut2.getAttribute("aria-pressed") : 'gone') + ":tiles=" + document.querySelectorAll('[data-canvas-ui^=ortho-tile]').length;
    }
    const line = tile.querySelector("svg[data-canvas-ui^=ortho-oblique-trace] line");
    const readBlock = () => {
      const t = document.querySelector("[role=dialog]").textContent;
      const th = t.match(/θ polar\s*(\d+)°/);
      const ph = t.match(/φ azimuth\s*(\d+)°/);
      const of = t.match(/offset\s*([+\-]?\d+)%/);
      return { theta: th ? +th[1] : null, phi: ph ? +ph[1] : null, offset: of ? +of[1] : null };
    };
    const readLine = () => ({ x1: +line.getAttribute("x1"), y1: +line.getAttribute("y1"), x2: +line.getAttribute("x2"), y2: +line.getAttribute("y2") });
    const before = { block: readBlock(), line: readLine() };
    // THE TURN: grab endpoint 1, drag 46px down, release
    const surface = tile.querySelector("div[class*=cursor-crosshair]") || tile.lastElementChild;
    const sr = surface.getBoundingClientRect();
    const gr = tile.getBoundingClientRect();
    const ex = gr.x + (before.line.x1 / 100) * gr.width;
    const ey = gr.y + (before.line.y1 / 100) * gr.height;
    const tx = Math.min(sr.right - 6, Math.max(sr.left + 6, ex));
    const ty = Math.min(sr.bottom - 6, Math.max(sr.top + 6, ey + 46));
    const down = { bubbles: true, cancelable: true, view: window, pointerId: 9, clientX: ex, clientY: ey, button: 0, isPrimary: true, pointerType: "mouse" };
    surface.dispatchEvent(new PointerEvent("pointerdown", down));
    for (let i = 1; i <= 6; i++) {
      surface.dispatchEvent(new PointerEvent("pointermove", { ...down, clientX: ex + ((tx - ex) * i) / 6, clientY: ey + ((ty - ey) * i) / 6 }));
      await S(130);
    }
    surface.dispatchEvent(new PointerEvent("pointerup", { ...down, clientX: tx, clientY: ty }));
    await S(2200);
    const after = { block: readBlock(), line: readLine() };
    const world = (document.body.textContent.match(/(\d+) jobs · (\d+) edges/) || [])[0] || null;
    return JSON.stringify({ before, after, lineMoved: Math.hypot(after.line.x1 - before.line.x1, after.line.y1 - before.line.y1) > 1 || Math.hypot(after.line.x2 - before.line.x2, after.line.y2 - before.line.y2) > 1, anglesMoved: after.block.theta !== before.block.theta || after.block.phi !== before.block.phi, offsetUnmoved: after.block.offset === before.block.offset, endHandles: document.querySelectorAll('[data-canvas-ui^=ortho-oblique-end]').length, world });
  } catch (e) {
    return "ERR:" + e.message;
  }
})()
