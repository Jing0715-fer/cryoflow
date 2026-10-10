#!/usr/bin/env node
/* t826 — the toast's hourglass: the card's remaining life, drawn.
 *
 * The feature: every toast card grows a bottom hairline (ToastHourglass)
 * that draws Radix's close timer — the ONLY authority on a toast's
 * lifespan, and until now invisible (the t825 patrol watched toasts die
 * exactly on schedule and could only take the vendor's word for WHEN).
 * The bar's drain (scaleX 1→0) crosses --toast-life, fed from the
 * toast's OWN duration prop; the vendor's startTimer skips 0 and
 * Infinity, so an immortal card gets NO bar — a clock that never runs
 * is not drawn running.
 *
 * The real law is the FREEZE. The vendor pauses every close timer on
 * wrapper pointermove/focusin and window blur, and resumes on
 * pointerleave / focusout-outside / window focus — dispatching its OWN
 * toast.viewportPause / toast.viewportResume events on the viewport.
 * The mirror in ui/toaster.tsx listens to those events and paints
 * data-timers-paused on the viewport; the CSS rule in globals.css
 * pauses the bar's animation under that attribute. One clock
 * authority, zero drift by construction — the t825 free law
 * (Radix hover-pause) becomes a VISIBLE fact.
 *
 *   A. the bar rides every card (toast.tsx)
 *      1. the Root renders the hourglass BEFORE the caller's children
 *         (both present — the children not swallowed)
 *      2. geometry: pointer-events-none, absolute inset-x-0 bottom-0,
 *         h-0.5, origin-right (the drain flows toward the exit corner)
 *      3. motion-reduce:hidden — an affordance whose only channel is
 *         motion does not pretend under reduced motion
 *      4. the destructive tone rides (group-[.destructive]:bg-white/40)
 *
 *   B. the life var (the duration's honesty)
 *      5. effectiveDuration = duration ?? 5000; --toast-life fed from it
 *      6. the immortal card gets NO bar: hasTimer excludes 0/Infinity
 *         (the vendor's own startTimer skip)
 *      7. duration handed back to the Root — the vendor's durationProp
 *         path intact
 *
 *   C. the mirror (toaster.tsx)
 *      8. the ref rides the viewport
 *      9. BOTH vendor events wired by name — pause paints the
 *         attribute, resume removes it
 *     10. cleanup symmetric (the pair unwound)
 *     11. the comment names the vendor as the clock authority
 *
 *   D. the CSS law (globals.css)
 *     12. @keyframes toast-hourglass scaleX 1→0 on file
 *     13. .toast-hourglass: animation var(--toast-life, 5000ms) linear
 *         forwards
 *     14. [data-timers-paused] .toast-hourglass: play-state paused —
 *         the freeze rides the vendor's own attribute
 *
 *   E. the vendor authority (radix-toast-vendor.mjs)
 *     15. the event names on file
 *     16. the pause triggers still wired (pointermove / focusin /
 *         window blur)
 *     17. the resume set still wired (pointerleave / focusout /
 *         window focus)
 *     18. the paused-mount honesty: a toast born under pause waits for
 *         resume before startTimer — the bar inherits the attribute and
 *         stays full
 *
 *   F. the calibre
 *     19. no new API route — 18 api dirs + src/app/api/route.ts = 19
 */

import { readFileSync, readdirSync, statSync } from "node:fs";

const toastUi = readFileSync("src/components/ui/toast.tsx", "utf8");
const toasterSrc = readFileSync("src/components/ui/toaster.tsx", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");
const vendor = readFileSync("src/lib/radix-toast-vendor.mjs", "utf8");

let pass = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fails.push(label);
    console.log(`  FAIL  ${label}`);
  }
};

// ---- window helpers (the fifth amendment: bounded by the next
// declaration, never a fixed width) -------------------------------
const between = (src, startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + 1);
  return a > -1 && b > a ? src.slice(a, b) : "";
};

console.log("A. the bar rides every card (toast.tsx)");
{
  const rootWin = between(toastUi, "const Toast = React.forwardRef", "Toast.displayName");
  const barIdx = rootWin.indexOf("<ToastHourglass");
  const childIdx = rootWin.indexOf("{children}");
  ok(
    barIdx > -1 && childIdx > -1 && barIdx < childIdx,
    "A1 the Root renders the hourglass BEFORE the caller's children — both present"
  );
  const barWin = between(toastUi, "const ToastHourglass = React.forwardRef", 'ToastHourglass.displayName');
  ok(
    barWin.includes("pointer-events-none") &&
      barWin.includes("absolute inset-x-0 bottom-0") &&
      barWin.includes("h-0.5") &&
      barWin.includes("origin-right"),
    "A2 geometry: pointer-proof bottom hairline, drain toward the exit corner (origin-right)"
  );
  ok(
    barWin.includes("motion-reduce:hidden"),
    "A3 motion-reduce hides the drawing, never the clock"
  );
  ok(
    barWin.includes("group-[.destructive]:bg-white/40"),
    "A4 the destructive tone rides the group"
  );
}

console.log("B. the life var (the duration's honesty)");
{
  const rootWin = between(toastUi, "const Toast = React.forwardRef", "Toast.displayName");
  ok(
    rootWin.includes("const effectiveDuration = duration ?? 5000") &&
      rootWin.includes('"--toast-life"'),
    "B5 effectiveDuration = duration ?? 5000, --toast-life fed from it"
  );
  ok(
    rootWin.includes("effectiveDuration !== 0 && effectiveDuration !== Infinity"),
    "B6 the immortal card gets NO bar (the vendor's own startTimer skip)"
  );
  ok(
    rootWin.includes("duration={duration}"),
    "B7 duration handed back to the Root — durationProp path intact"
  );
}

console.log("C. the mirror (toaster.tsx)");
{
  ok(
    toasterSrc.includes("<ToastViewport ref={viewportRef} />"),
    "C8 the ref rides the viewport"
  );
  const mirrorWin = between(toasterSrc, "// t826 — the hourglass's clock authority", "<ToastProvider");
  ok(
    mirrorWin.includes('"toast.viewportPause"') &&
      mirrorWin.includes('setAttribute("data-timers-paused", "")') &&
      mirrorWin.includes('"toast.viewportResume"') &&
      mirrorWin.includes('removeAttribute("data-timers-paused")'),
    "C9 BOTH vendor events wired by name — pause paints, resume clears"
  );
  ok(
    mirrorWin.indexOf('viewport.addEventListener("toast.viewportPause", pause)') < mirrorWin.indexOf("removeEventListener") &&
      mirrorWin.includes('viewport.removeEventListener("toast.viewportPause", pause)') &&
      mirrorWin.includes('viewport.removeEventListener("toast.viewportResume", resume)'),
    "C10 cleanup symmetric — the pair unwound"
  );
  ok(
    mirrorWin.includes("clock authority") && mirrorWin.includes("a reflection, not a clock"),
    "C11 the comment names the vendor as the one clock"
  );
}

console.log("D. the CSS law (globals.css)");
{
  const cssWin = between(globals, "/* t826 — the toast's hourglass", "[data-timers-paused] .toast-hourglass");
  ok(
    cssWin.includes("@keyframes toast-hourglass") &&
      cssWin.includes("from { transform: scaleX(1); }") &&
      cssWin.includes("to { transform: scaleX(0); }"),
    "D12 the keyframes draw the drain scaleX 1→0"
  );
  ok(
    cssWin.includes("animation: toast-hourglass var(--toast-life, 5000ms) linear forwards"),
    "D13 the bar's life reads --toast-life (vendor default 5000ms on file)"
  );
  const pauseRule = between(globals, "[data-timers-paused] .toast-hourglass", "\n}");
  ok(
    pauseRule.includes("animation-play-state: paused"),
    "D14 the freeze rides the vendor's own attribute"
  );
}

console.log("E. the vendor authority (radix-toast-vendor.mjs)");
{
  ok(
    vendor.includes('var VIEWPORT_PAUSE = "toast.viewportPause";') &&
      vendor.includes('var VIEWPORT_RESUME = "toast.viewportResume";'),
    "E15 the event names on file (the mirror's strings target these vars' values)"
  );
  const wiringWin = between(vendor, "const wrapper = wrapperRef.current;", "}, [hasToasts");
  ok(
    wiringWin.includes('wrapper.addEventListener("pointermove", handlePause)') &&
      wiringWin.includes('wrapper.addEventListener("focusin", handlePause)') &&
      wiringWin.includes('window.addEventListener("blur", handlePause)'),
    "E16 the pause triggers still wired (pointermove / focusin / window blur)"
  );
  ok(
    wiringWin.includes('wrapper.addEventListener("pointerleave", handlePointerLeaveResume)') &&
      wiringWin.includes('wrapper.addEventListener("focusout", handleFocusOutResume)') &&
      wiringWin.includes('window.addEventListener("focus", handleResume)'),
    "E17 the resume set still wired (pointerleave / focusout / window focus)"
  );
  ok(
    vendor.includes("if (open && !context.isClosePausedRef.current) startTimer(duration);"),
    "E18 paused-mount honesty: a toast born under pause waits for resume"
  );
}

console.log("F. the calibre");
{
  const apiRoot = "src/app/api";
  const dirs = readdirSync(apiRoot).filter((f) => statSync(`${apiRoot}/${f}`).isDirectory());
  const hasRootRoute = statSync("src/app/api/route.ts").isFile();
  ok(
    dirs.length === 18 && hasRootRoute && dirs.length + 1 === 19,
    `F19 no new API route — ${dirs.length} api dirs + src/app/api/route.ts = ${dirs.length + 1} entries`
  );
}

console.log("");
if (fails.length) {
  console.error(`t826-toast-hourglass-unit: ${fails.length} FAILED`);
  process.exit(1);
}
console.log(`t826-toast-hourglass-unit: ${pass} pass / 0 fail`);
