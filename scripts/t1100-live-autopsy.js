(async () => {
  const S = (ms) => new Promise((r) => setTimeout(r, ms));
  // error traps BEFORE anything
  if (!window.__t1100trap) {
    window.__t1100trap = true;
    window.__t1100err = [];
    const origErr = console.error;
    console.error = (...a) => {
      try { window.__t1100err.push("CE:" + a.map(x => (x && x.message) ? x.message : String(x)).join(" ").slice(0, 300)); } catch {}
      origErr(...a);
    };
    window.addEventListener("error", (e) => { try { window.__t1100err.push("EV:" + String(e.message).slice(0, 300) + " || STACK:" + String(e.error && e.error.stack ? e.error.stack : "(no stack)").slice(0, 900)); } catch {} });
    window.addEventListener("unhandledrejection", (e) => { try { window.__t1100err.push("REJ:" + String(e.reason).slice(0, 300)); } catch {} });
  }
  window.__t1100err.length = 0;
  const fire = (el, cx, cy) => {
    const O = { bubbles: true, cancelable: true, view: window, pointerId: 7, clientX: cx, clientY: cy, button: 0, isPrimary: true, pointerType: "mouse" };
    el.dispatchEvent(new PointerEvent("pointerdown", O));
    el.dispatchEvent(new PointerEvent("pointerup", O));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
  };
  const clickEl = (el) => { const r = el.getBoundingClientRect(); fire(el, Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)); };
  const dlg = document.querySelector("[role=dialog]");
  if (!dlg) return "no-dialog";
  const cut = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Cut the 3D isosurface open at this plane");
  if (!cut) return "no-cut";
  const pressed = cut.getAttribute("aria-pressed");
  const deathClock = [];
  if (pressed !== "true") {
    clickEl(cut);
    // micro-probe: when does the dialog die relative to the cut?
    for (let i = 0; i < 20; i++) {
      await S(250);
      const d = document.querySelectorAll("[role=dialog]").length;
      const tiles = document.querySelectorAll('[data-canvas-ui^=ortho-tile]').length;
      deathClock.push(i * 250 + ":" + d + ":" + tiles);
      if (d === 0) break;
      if (tiles > 0) break;
    }
  }
  return JSON.stringify({ pressedBefore: pressed, pressedNow: (document.querySelector('button[aria-label="Cut the 3D isosurface open at this plane"]') || {}).getAttribute ? cut.getAttribute("aria-pressed") : "button-gone", deathClock: deathClock.slice(0, 22), errs: window.__t1100err.slice(0, 8) });
})()
