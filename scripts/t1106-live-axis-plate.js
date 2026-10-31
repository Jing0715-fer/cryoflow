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
    clickEl(slice); await S(2000);

    // 2 — the plate doc: the axis walks page is UNCONDITIONAL (no cut
    // needed); the cut's walk page stays honestly absent (no live cut)
    const doc = document.querySelector("[data-ortho-plate-doc]");
    if (!doc) return "no-plate-doc";
    const page = doc.querySelector("[data-ortho-plate-axis-walks]");
    if (!page) return JSON.stringify({ doc: "PRESENT", axisPage: "ABSENT" });
    const strips = [...page.querySelectorAll("[data-ortho-plate-axis-walk]")];
    const stripReport = strips.map((st) => ({
      axis: st.getAttribute("data-ortho-plate-axis-walk"),
      border: st.style.borderColor,
      heading: st.querySelector("p") ? st.querySelector("p").textContent.trim() : null,
      frames: st.querySelectorAll("figure").length,
      firstCap: st.querySelector("figcaption") ? st.querySelector("figcaption").textContent.trim() : null,
      lastCap: st.querySelectorAll("figcaption").length ? st.querySelectorAll("figcaption")[st.querySelectorAll("figcaption").length - 1].textContent.trim() : null,
      srcs: [...st.querySelectorAll("img")].slice(0, 1).map((im) => im.getAttribute("src").replace(/^.*path=/, "path=")),
    }));
    const imgs = page.querySelectorAll("figure img").length;
    const loaded = [...page.querySelectorAll("figure img")].filter((im) => im.complete && im.naturalWidth > 0).length;
    const masthead = page.querySelector("header span") ? page.querySelector("header span").textContent.trim() : null;
    const page2 = doc.querySelectorAll("[data-ortho-plate-walk]").length;
    const bbp = page.className.includes("break-before-page");
    const gridCls = strips.length ? (strips[0].querySelector("div[class*=grid]") || {}).className || "" : "";

    // 3 — the print verb: ONE button prints all three pages
    const btn = document.querySelector('[data-canvas-ui="ortho-plate-print"]');
    if (!btn) return "no-print-btn";
    clickEl(btn);
    let flag = false;
    for (let i = 0; i < 16; i++) { await S(800); flag = document.body.hasAttribute("data-plate-print"); if (flag) break; }
    await S(1500);
    const histLeg = doc.querySelectorAll("[data-ortho-plate-hist]").length;
    const world = (document.body.textContent.match(/(\d+) jobs · (\d+) edges/) || [])[0] || null;
    const plateImgsAll = doc.querySelectorAll("figure img").length;
    return JSON.stringify({ masthead, page2Count: page2, breakBefore: bbp, gridClass: gridCls.slice(0, 40), strips: stripReport, imgs, loadedImgs: loaded, printFlagArmed: flag, histLeg, plateImgsAll, world });
  } catch (e) {
    return "ERR:" + e.message;
  }
})()
