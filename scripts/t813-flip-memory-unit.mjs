#!/usr/bin/env node
/* t813 — THE GRAND FLIP: eighteen windows staged, one build, and the
 * flip-day verdicts. This probe pins the day's two code truths:
 *
 * 1. THE FLIP'S SCROLL MEMORY LEARNED PATIENCE (the flip day's first
 *    live bug, found by the verdict list itself): the t798 memory's
 *    restore raced the flip's leaf refetch and lost — the storage runs
 *    list deep-scrolled to 293 snapped to 0 across the companion
 *    flip-in and NEVER came back (the two-beat restore, sync + one
 *    frame, fired before the refetch's scrollable existed; witnessed
 *    live on the flip world: scrollTop 293 → 0, no recovery after
 *    1.5s). The cure is the patient ladder: apply every frame until
 *    every remembered position reads back (the pending test: a set
 *    that doesn't stick, or scrollables still missing against the
 *    memory's length), capped at ~90 frames. Fresh opens carry no
 *    memory and never enter the ladder.
 * 2. THE MEMORY ITSELF STANDS (t798's law unchanged): the
 *    capture-phase passive listener, the per-region array, the
 *    companionOpen key, the length-tolerant index match. */

import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const dialog = read("src/components/ui/dialog.tsx");

let pass = 0;
const fails = [];
const ok = (cond, msg, extra) => {
  if (cond) pass++;
  else fails.push(msg + (extra ? ` (${extra})` : ""));
};

/* A — the memory's spine (t798's law, unchanged) */
ok(
  dialog.includes('const scrollMemoryRef = React.useRef<number[] | null>(null)'),
  "A1 the memory ref lives above the flip (the component's own instance state)",
);
ok(
  dialog.includes('root.addEventListener("scroll", onScroll, { capture: true, passive: true })'),
  "A2 the capture-phase passive listener keeps the memory always current",
);
ok(
  dialog.includes("}, [companionOpen])"),
  "A3 the restore is keyed on the flip itself (every flip-in re-arms the restore)",
);
ok(
  dialog.includes("if (memory[i] !== undefined)"),
  "A4 the index match degrades, never throws (the length-tolerant law rides)",
);

/* B — the patient ladder (the flip day's cure) */
ok(
  dialog.includes("let pending = scrollables.length < memory.length"),
  "B1 the pending test counts missing scrollables (the refetch's regions may not exist yet)",
);
ok(
  dialog.includes("if (el.scrollTop !== memory[i]) pending = true"),
  "B2 the pending test requires every set to STICK (a clamped or short content keeps the ladder running)",
);
ok(
  dialog.includes("if (apply() || frames > 90) return"),
  "B3 the ladder is bounded (~90 frames — patience with a ceiling, the box is not asked to wait forever)",
);
ok(
  dialog.includes("cancelAnimationFrame(ladderRaf)") &&
    dialog.includes("ladderRaf = requestAnimationFrame(tick)"),
  "B4 the ladder's frame handle is cleaned up (the effect's return cancels the tick — no orphaned loops)",
);
ok(
  dialog.includes("if (!memory) return true"),
  "B5 fresh opens carry no memory and never enter the ladder (the honest top-of-page start)",
);
ok(
  dialog.includes("flip-day witness") && dialog.includes("the patient ladder"),
  "B6 the cure's prose rides with the code (the wound and the cure named where they live)",
);

/* C — the hand-back's dying-blur exemption (the flip day's second live
 * bug): Radix's exit blurs the content to BODY before onCloseAutoFocus
 * runs, and the t791 witness law's disarm answered that machinery noise
 * by spending the pocket — the storage dialog's Escape landed BODY on
 * the flip world (witnessed live, real-mouse path: focus after Escape
 * was BODY, the opener never received the keyboard). The cure: the
 * disarm answers only an opener-like choice; a BODY focusin while a
 * dialog is open is the exit's own machinery, never a voluntary exit. */
ok(
  dialog.includes("if (isOpenerLike(target)) layer.pocket = null") &&
    !dialog.includes("{\n        layer.pocket = null"),
  "C1 the disarm is opener-like-gated (the old bare disarm is gone; machinery noise keeps the pocket alive)",
);
ok(
  dialog.includes("machinery noise") && dialog.includes("onCloseAutoFocus runs"),
  "C2 the exemption's prose names the race (the exit's own blur vs the hand-back's spend)",
);
ok(
  (dialog.match(/if \(isOpenerLike\(target\)\) layer.pocket = null/g) || []).length === 1,
  "C3 exactly one gated disarm (the t791 voluntary-exit law keeps its single mouth)",
);

console.log(`t813-flip-memory-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
