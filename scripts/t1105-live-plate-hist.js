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
    clickEl(slice); await S(1500);

    // 2 — wait for the σ chip (the embed's contour report rides the same
    // state the plate's cut line reads — isoSigma)
    let sigma = null;
    for (let i = 0; i < 14; i++) {
      await S(1000);
      const m = (dlg.textContent || "").match(/iso\s*[-−]?\d+\.\d\d\s*σ/);
      if (m) { sigma = m[0].replace(/\s+/g, " "); break; }
    }

    // 3 — the print verb: click it, the fetch precedes the flag (t1105)
    const btn = document.querySelector('[data-canvas-ui="ortho-plate-print"]');
    if (!btn) return "no-print-btn";
    const busyAtClick = btn.disabled;
    clickEl(btn);

    // 4 — poll for the σ leg in the DOM (fetch → state → commit)
    let leg = null;
    for (let i = 0; i < 14; i++) {
      await S(800);
      leg = document.querySelector("[data-ortho-plate-hist]");
      if (leg) break;
    }
    if (!leg) return JSON.stringify({ busyAtClick, sigma, leg: "ABSENT-AFTER-PRINT-CLICK" });
    await S(800); // the double-rAF commit settles

    const svg = leg.querySelector("svg");
    const rects = leg.querySelectorAll("rect").length;
    const lines = [...leg.querySelectorAll("line")];
    const cutLine = lines.find((l) => (l.getAttribute("stroke") || "") === "#0891b2");
    const strongTicks = lines.filter((l) => (l.getAttribute("stroke") || "") === "rgba(0,0,0,0.55)").length;
    const quietTicks = lines.filter((l) => (l.getAttribute("stroke") || "") === "rgba(0,0,0,0.30)").length;
    const caption = leg.querySelector("p") ? leg.querySelector("p").textContent.trim() : null;
    const viewBox = svg ? svg.getAttribute("viewBox") : null;
    const btnAfter = document.querySelector('[data-canvas-ui="ortho-plate-print"]');
    const world = (document.body.textContent.match(/(\d+) jobs · (\d+) edges/) || [])[0] || null;
    const plateImgs = document.querySelectorAll("[data-ortho-plate-doc] figure img").length;
    const flagNow = document.body.hasAttribute("data-plate-print");
    return JSON.stringify({ busyAtClick, sigma, leg: "PRESENT", viewBox, rects, lines: lines.length, strongTicks, quietTicks, cutPresent: !!cutLine, cutOpacity: cutLine ? cutLine.getAttribute("opacity") : null, caption, btnDisabledAfter: btnAfter ? btnAfter.disabled : null, flagNow, plateImgs, world });
  } catch (e) {
    return "ERR:" + e.message;
  }
})()
