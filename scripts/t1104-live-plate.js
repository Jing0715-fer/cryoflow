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
    // 0 — the honest absence: before any cut, the walk page must not exist
    const absenceBefore = document.querySelectorAll("[data-ortho-plate-walk]").length;

    // 1 — the chain (resumable: each stage skipped when already through)
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
    if (!cut) return "no-cut";
    if (cut.getAttribute("aria-pressed") !== "true") { clickEl(cut); }
    // 2 — wait for the cut's live echo: the tile's violet trace line
    let tile = null;
    for (let i = 0; i < 9; i++) {
      await S(800);
      tile = document.querySelector('[data-canvas-ui="ortho-tile-z"]');
      if (tile && tile.querySelector("svg[data-canvas-ui^=ortho-oblique-trace] line")) break;
    }
    if (!tile) return "no-trace";
    await S(1500); // the ACK settles — the plate's echo state rides the same wire

    // 3 — the plate's DOM (print-only, but the DOM tells the paper's plan)
    const walk = document.querySelector("[data-ortho-plate-walk]");
    if (!walk) return JSON.stringify({ absenceBefore, cutPressed: cut.getAttribute("aria-pressed"), walkPage: "ABSENT-WITH-CUT-ON" });
    const imgs = [...walk.querySelectorAll("img")].map((im) => (im.getAttribute("src") || "").replace(/^.*&(plane|axis)=/, "$1").slice(0, 90));
    const caps = [...walk.querySelectorAll("figcaption")].map((c) => c.textContent.trim());
    const meta = walk.querySelector("p") ? walk.querySelector("p").textContent.trim() : null;
    const head = walk.querySelector("header") ? walk.querySelector("header").textContent.trim().replace(/\s+/g, " ") : null;
    const stripBtn = document.querySelector('[data-canvas-ui="ortho-oblique-filmstrip"]');
    const cls = walk.className;
    const plateImgs = document.querySelectorAll("[data-ortho-plate-doc] figure img").length;
    const world = (document.body.textContent.match(/(\d+) jobs · (\d+) edges/) || [])[0] || null;
    return JSON.stringify({ absenceBefore, cutPressed: cut.getAttribute("aria-pressed"), walkPage: "PRESENT", head, meta, frames: imgs.length, urls: imgs, caps, stripEnabled: stripBtn ? !stripBtn.disabled : null, breakBefore: /break-before-page/.test(cls), plateImgsTotal: plateImgs, world });
  } catch (e) {
    return "ERR:" + e.message;
  }
})()
