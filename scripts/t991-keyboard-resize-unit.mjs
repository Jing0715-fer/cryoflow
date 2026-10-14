#!/usr/bin/env node
/**
 * t991 — the KEYBOARD-RESIZE unit (node-only): the window-splitter
 * cure's source pins. The spec read found the old promise dead — the
 * resize grips' comment said "keyboard users reach the same geometry
 * through the header's double-click reset", but a dblclick never fires
 * from the keyboard (two Enters do not synthesize one), so a keyboard
 * user had NO resize road at all.
 *
 * THE CURE (what this unit pins):
 *  - the e/s grips are real ARIA window separators now (role=separator,
 *    aria-orientation, aria-valuenow speaking the live shape, tabIndex);
 *  - the arrow keys step the same clampGeo the pointer drag rides
 *    (16px per press, GEO_MIN floors held);
 *  - the raise rides every step (the t990 raise law's keyboard form —
 *    raiseToFront is a no-op when already last);
 *  - the echo is debounced 400ms — the t638 law's keyboard form: the
 *    shape is written once when the hand RESTS;
 *  - the SE corner stays pointer-only (the redundant affordance —
 *    e + s cover both axes; no third tab stop);
 *  - the dead-promise comment is extinct.
 *
 *   node scripts/unit-runner.mjs scripts/t991-keyboard-resize-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RECEIPT = "shots-qa/t991-keyboard-resize-unit.json";
const SRC = path.join(ROOT, "src", "components", "ai", "assistant-panel.tsx");

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok  ${name}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`); }
}

const src = readFileSync(SRC, "utf8");

/* ---- the separators exist and speak the window-splitter pattern ---- */
const eGripStart = src.indexOf('role="separator"\n              aria-orientation="vertical"');
const sGripStart = src.indexOf('role="separator"\n              aria-orientation="horizontal"');
ok("the e grip is a vertical separator (the window-splitter role)", eGripStart > 0);
ok("the s grip is a horizontal separator (the window-splitter role)", sGripStart > 0 && sGripStart !== eGripStart);

if (eGripStart > 0 && sGripStart > 0) {
  const eGrip = src.slice(eGripStart, src.indexOf("/>", eGripStart));
  const sGrip = src.slice(sGripStart, src.indexOf("/>", sGripStart));

  ok("the e grip is tabbable (tabIndex={0})", eGrip.includes("tabIndex={0}"));
  ok("the s grip is tabbable (tabIndex={0})", sGrip.includes("tabIndex={0}"));
  ok("the e grip names itself (调整助手窗口宽度)", eGrip.includes('aria-label="调整助手窗口宽度（左右方向键）"'));
  ok("the s grip names itself (调整助手窗口高度)", sGrip.includes('aria-label="调整助手窗口高度（上下方向键）"'));
  ok("the e grip's valuenow speaks the live width (geo?.w)", eGrip.includes("aria-valuenow={geo?.w}"));
  ok("the s grip's valuenow speaks the live height (geo?.h)", sGrip.includes("aria-valuenow={geo?.h}"));
  ok("the e grip's floor is GEO_MIN_W", eGrip.includes("aria-valuemin={GEO_MIN_W}"));
  ok("the s grip's floor is GEO_MIN_H", sGrip.includes("aria-valuemin={GEO_MIN_H}"));
  ok("the e grip carries the pointer drag too (onPointerDown e)", eGrip.includes('beginDrag(e, "e")'));
  ok("the s grip carries the pointer drag too (onPointerDown s)", sGrip.includes('beginDrag(e, "s")'));
  ok("NO aria-hidden on the e separator (a focusable element never hides)", !eGrip.includes("aria-hidden"));
  ok("NO aria-hidden on the s separator (a focusable element never hides)", !sGrip.includes("aria-hidden"));

  /* ---- the arrow-key steps ride the same clamp the pointer rides ---- */
  ok("the e separator steps width on Left/Right with preventDefault",
    eGrip.includes('e.key === "ArrowLeft" || e.key === "ArrowRight"') && eGrip.includes("e.preventDefault()")
      && eGrip.includes('keyResize("w", e.key === "ArrowRight" ? 16 : -16)'));
  ok("the s separator steps height on Up/Down with preventDefault",
    sGrip.includes('e.key === "ArrowUp" || e.key === "ArrowDown"') && sGrip.includes("e.preventDefault()")
      && sGrip.includes('keyResize("h", e.key === "ArrowDown" ? 16 : -16)'));
}

/* ---- the keyResize body: the raise, the clamp, the debounced echo ---- */
const keyResizeAt = src.indexOf("const keyResize = React.useCallback(");
ok("keyResize exists as a stable callback", keyResizeAt > 0);
if (keyResizeAt > 0) {
  const body = src.slice(keyResizeAt, src.indexOf("}, [raiseToFront]);", keyResizeAt));
  ok("the raise rides every step BEFORE the geometry (the t990 law's keyboard form)",
    body.indexOf("raiseToFront()") < body.indexOf("setGeo("));
  ok("the step falls back to the home shape when geo is null (defaultGeo)", body.includes("prev ?? defaultGeo(window.innerWidth, window.innerHeight)"));
  ok("the width step floors at GEO_MIN_W", body.includes('Math.max(GEO_MIN_W, base.w + delta)'));
  ok("the height step floors at GEO_MIN_H", body.includes('Math.max(GEO_MIN_H, base.h + delta)'));
  ok("the result rides the SAME clampGeo as the pointer drag", body.includes("return clampGeo({ ...base, w, h }, vw, vh);"));
  ok("the echo is debounced 400ms (the hand rests, THEN the shape lands)", body.includes("}, 400);"));
  ok("the echo guards the mobile breakpoint (no desktop geometry from a phone-shaped session)", body.includes("window.innerWidth >= GEO_MOBILE_BP"));
  ok("the echo writes the same GEO_KEY the drag echo writes", body.includes("localStorage.setItem(GEO_KEY, JSON.stringify(geoRef.current))"));
  ok("the echo timer resets per keypress (one write per rest, not per key)", body.includes("window.clearTimeout(keyEchoTimer.current)"));
  ok("the t902 ownership law rides the keyboard (setGeoTouched(true) in the step)", body.includes("setGeoTouched(true)"));
}

/* ---- the SE corner stays pointer-only (the redundant affordance) ---- */
const seAt = src.indexOf('onPointerDown={(e) => beginDrag(e, "se")}');
ok("the SE corner exists", seAt > 0);
if (seAt > 0) {
  const seChunk = src.slice(src.lastIndexOf("<div", seAt), seAt + 200);
  ok("the SE corner stays aria-hidden + presentation (no third tab stop)",
    seChunk.includes('aria-hidden="true"') && seChunk.includes('role="presentation"') && !seChunk.includes("tabIndex"));
}

/* ---- the dead promise is extinct ---- */
ok("the dead-promise comment is gone (dblclick was never a keyboard road)",
  !src.includes("keyboard users reach the same geometry through the header's double-click"));
ok("the new comment names the spec read's find", src.includes("The spec read found the old comment's promise dead"));

/* ---- the pointer roads are untouched (the t799 D6 shape stands) ---- */
ok("the pointer drag's window-level listener pair is untouched",
  src.includes('window.addEventListener("pointermove", onMove)') && src.includes('window.addEventListener("pointerup", onUp)'));
ok("the drag's raise still rides the FIRST REAL MOVE only (never the pointerdown)",
  /if \(!dragMovedRef\.current\) raiseToFront\(\);\s*\n\s*dragMovedRef\.current = true;/m.test(src.replace(/\r/g, "")) || src.includes("if (!dragMovedRef.current) raiseToFront();"));

/* ---- the receipt ---- */
const { writeFileSync, mkdirSync } = await import("node:fs");
const receipt = {
  unit: "t991-keyboard-resize-unit",
  at: new Date().toISOString(),
  file: "src/components/ai/assistant-panel.tsx",
  pins: ["e/s separators", "arrow-key steps", "clampGeo shared", "debounced echo 400ms", "SE pointer-only", "dead promise extinct", "pointer roads untouched"],
  pass, fail,
};
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nKEYBOARD-RESIZE-UNIT t991: ${pass}/${pass + fail} ${fail === 0 ? "green — the keyboard resize road is real, the pointer roads untouched" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
