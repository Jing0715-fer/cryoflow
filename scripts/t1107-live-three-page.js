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
    // 0 — the honest absence: before any cut, the walk page must not exist
    const doc0 = document.querySelector("[data-ortho-plate-doc]");
    const absenceBefore = doc0 ? doc0.querySelectorAll("[data-ortho-plate-walk]").length : "no-doc";

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

    // 3 — the THREE-PAGE state verdict
    const doc = document.querySelector("[data-ortho-plate-doc]");
    if (!doc) return JSON.stringify({ stage: "post-cut", plateDoc: "ABSENT" });
    const walk = doc.querySelector("[data-ortho-plate-walk]");
    const axisPage = doc.querySelector("[data-ortho-plate-axis-walks]");
    const verdict = { absenceBefore, cutPressed: cut.getAttribute("aria-pressed") };
    if (!walk) return JSON.stringify({ ...verdict, walkPage: "ABSENT-WITH-CUT-ON" });
    if (!axisPage) return JSON.stringify({ ...verdict, walkPage: "PRESENT", axisWalksPage: "ABSENT" });

    // page 2 details
    const wImgs = walk.querySelectorAll("figure img").length;
    const wLoaded = [...walk.querySelectorAll("figure img")].filter((im) => im.complete && im.naturalWidth > 0).length;
    const wHead = walk.querySelector("header") ? walk.querySelector("header").textContent.trim().replace(/\s+/g, " ") : null;
    const wMeta = walk.querySelector("p") ? walk.querySelector("p").textContent.trim() : null;
    const wBreak = /break-before-page/.test(walk.className);

    // page 3 details
    const strips = [...axisPage.querySelectorAll("[data-ortho-plate-axis-walk]")];
    const stripReport = strips.map((st) => ({
      axis: st.getAttribute("data-ortho-plate-axis-walk"),
      border: st.style.borderColor,
      heading: st.querySelector("p") ? st.querySelector("p").textContent.trim() : null,
      frames: st.querySelectorAll("figure").length,
      lastCap: st.querySelectorAll("figcaption").length ? st.querySelectorAll("figcaption")[st.querySelectorAll("figcaption").length - 1].textContent.trim() : null,
    }));
    const aImgs = axisPage.querySelectorAll("figure img").length;
    const aLoaded = [...axisPage.querySelectorAll("figure img")].filter((im) => im.complete && im.naturalWidth > 0).length;
    const aBreak = /break-before-page/.test(axisPage.className);
    const aMast = axisPage.querySelector("header span") ? axisPage.querySelector("header span").textContent.trim() : null;

    // page 1 details
    const p1Imgs = [...doc.children[0] ? doc.children[0].querySelectorAll("figure img") : []].length;
    const p1Break = doc.children[0] ? /break-before-page/.test(doc.children[0].className) : null;

    const world = (document.body.textContent.match(/(\d+) jobs · (\d+) edges/) || [])[0] || null;
    return JSON.stringify({ ...verdict, walkPage: "PRESENT", axisWalksPage: "PRESENT", p1: { imgs: p1Imgs, breakBefore: p1Break }, p2: { head: wHead, meta: wMeta, imgs: wImgs, loaded: wLoaded, breakBefore: wBreak }, p3: { masthead: aMast, breakBefore: aBreak, imgs: aImgs, loaded: aLoaded, strips: stripReport }, world });
  } catch (e) {
    return "ERR:" + e.message;
  }
})()
