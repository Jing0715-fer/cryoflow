#!/usr/bin/env python3
"""Task 107 — ensurePopover v2 for the legacy suites (qa42, 43, 44, 45).

Radix Popover triggers listen on POINTERDOWN — a programmatic el.click()
dispatches only a `click` event, which the trigger ignores: the popover
never opens and the callers' hard querySelector chains crash on null.
v2 verifies after the programmatic poke and, while the panel is absent,
follows up with a PHYSICAL click through the CLI (real pointer events;
safe here — the popover trigger lives in the viewer pane, not inside a
modal overlay). Idempotent on the identical era bodies.
"""
import pathlib

BASE = pathlib.Path("/home/z/my-project/scripts")
SUITES = ["qa42", "qa43", "qa44", "qa45"]

NEW = '''const ensurePopover = async (uiName, triggerAria) => {
  // Radix Popover triggers fire on POINTERDOWN — a programmatic t.click()
  // never opens it. Poke first (cheap when already open), then verify and
  // follow up with a physical CLI click while the panel is still absent.
  for (let i = 0; i < 4; i++) {
    const state = evalJs(`(() => {
      const p = document.querySelector('[data-canvas-ui=${uiName}]');
      if (p) return 'was-open';
      const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('${triggerAria}'));
      if (!t) return 'NO-TRIGGER';
      t.click();
      return 'poked';
    })()`);
    await sleep(1200);
    const open = evalJs(`String(!!document.querySelector('[data-canvas-ui=${uiName}]'))`).replace(/^"|"$/g, "") === "true";
    if (open) return "was-open";
    if (String(state).includes("NO-TRIGGER")) return "NO-TRIGGER";
    // physical CLI clicks refuse covered points (the trigger can sit under
    // the inspector footer inside the modal scroll area); a synthetic
    // PointerEvent pair drives Radix's pointerdown handler with no geometry
    evalJs(`(() => {
      const t = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').startsWith('${triggerAria}'));
      if (!t) return 'NO-TRIGGER';
      const r = t.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0, pointerId: 1 };
      t.dispatchEvent(new PointerEvent('pointerdown', opts));
      t.dispatchEvent(new PointerEvent('pointerup', opts));
      t.dispatchEvent(new MouseEvent('click', opts));
      return 'pointer-poked';
    })()`);
    await sleep(1200);
  }
  return evalJs(`String(!!document.querySelector('[data-canvas-ui=${uiName}]'))`).includes("true") ? "was-open" : "NEVER-OPENED";
};'''

for name in SUITES:
    p = BASE / f"{name}-e2e.mjs"
    s = p.read_text()
    head = "const ensurePopover = async (uiName, triggerAria) => {"
    if head not in s:
        print(f"{name}: no ensurePopover — skipped")
        continue
    start = s.index(head)
    end = s.index("\n};", start) + len("\n};")
    s = s[:start] + NEW + s[end:]
    p.write_text(s)
    print(f"{name}: ensurePopover v2 installed")
