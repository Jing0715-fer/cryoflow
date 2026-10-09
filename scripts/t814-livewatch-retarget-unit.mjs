#!/usr/bin/env node
/* t814 — the guard's retarget-proofing: the live-zone match reads the
 * pointer's truth.
 *
 * The t813 flip day filed the wound: a MODAL-born storage dialog closed
 * when the header's AI summon door was clicked, while the door (kept
 * hittable by the t501 z-law) opened the companion — "both live" was the
 * law, and the dialog died. The diagnosis: Radix's OUTSIDE events
 * (pointerdown-outside, focus-outside, interact-outside) are CustomEvents
 * dispatched ON THE LAYER NODE — their `target` is the layer itself, so
 * isFromLiveZone's `event.target` read asked the layer where the click
 * landed and heard "me" every time; the live-zone match could never fire,
 * on ANY outside interaction, EVER (the t501 law's guard was structurally
 * blind from birth — every outside test that ever passed did so because
 * the guard's branch was never the thing that saved it). The pointer's
 * truth lives in `detail.originalEvent.target`; the keydown path (native
 * events, no detail) keeps reading `event.target` untouched. */

import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const dialog = read("src/components/ui/dialog.tsx");

let pass = 0;
const fails = [];
const ok = (cond, msg, extra) => {
  if (cond) pass++;
  else fails.push(msg + (extra ? ` (${extra})` : ""));
};

/* A — the retarget-proofing itself */
ok(
  dialog.includes(
    "const src = (event as { detail?: { originalEvent?: Event } }).detail",
  ) && dialog.includes("?.originalEvent?.target"),
  "A1 the guard reads the pointer's truth (detail.originalEvent.target) before event.target",
);
ok(
  dialog.includes("const target = src ?? event.target"),
  "A2 the native-event path keeps event.target (keydown has no detail — the escape law untouched)",
);
ok(
  dialog.includes("detail?: { originalEvent?: Event }"),
  "A3 the originalEvent read is typed (no any — the family's lint law rides)",
);
ok(
  dialog.includes("isFromLiveZone(event, selfRef.current)"),
  "A4 the escape self-exemption still passes self (the t530 law rides on the native path)",
);

/* B — the wound's prose rides with the fix */
ok(
  dialog.includes("retarget-proofing") &&
    dialog.includes("dispatched ON THE"),
  "B1 the diagnosis named where it lives (the custom events point at the layer, never the pointer)",
);
ok(
  dialog.includes("a modal-born storage dialog closed when the AI"),
  "B2 the flip world's witness is on file (the door opened the companion, the dialog died)",
);
ok(
  dialog.includes("The pointer's truth"),
  "B3 the cure's one-line spine is stated (detail.originalEvent.target)",
);

/* C — the guarded surfaces unchanged */
ok(
  dialog.includes("onPointerDownOutside={companionGuard(onPointerDownOutside)}") &&
    dialog.includes("onFocusOutside={companionGuard(onFocusOutside)}") &&
    dialog.includes("onInteractOutside={companionGuard(onInteractOutside)}"),
  "C1 the three outside guards keep their composer (one brain, three consumers)",
);
ok(
  dialog.includes("if (!event.defaultPrevented && isFromLiveZone(event))"),
  "C2 the composer's order law (the caller's judgment first, the zone rescue second)",
);
ok(
  (dialog.match(/isFromLiveZone\(/g) || []).length === 3,
  "C3 exactly three call sites (the composer + the inline escape guard — no second brain)",
);

/* D — the yield's remount discrimination (the second flip found on this
 * window's live walk): the yield's modal→non-modal swap fires the
 * FocusScope's unmount auto-focus TOO — spending the pocket there hands
 * the trigger the keyboard one frame before the remount pulls focus back,
 * and the pocket is empty when the REAL close comes (witnessed live: the
 * Escape after a yield landed BODY). The discrimination: a real close has
 * no data-state="open" surface left; a remount has one. And the pocket is
 * cleared only AT the spend (the t788 order law governs the SPEND, not
 * the entry — the first cut cleared at entry and the remount's own event
 * emptied the pocket before its discrimination could speak). */
ok(
  dialog.includes("if (openSurfaceExists()) return") &&
    dialog.includes("the remount discrimination"),
  "D1 the spend discriminates a real close from the yield's remount (an open surface means the dialog lives — the pocket waits)",
);
ok(
  dialog.includes("layer && (layer.pocket = null)") &&
    !dialog.includes("if (layer) layer.pocket = null"),
  "D2 the pocket is cleared at the spend, not at the entry (the t788 order law governs the spend)",
);
ok(
  dialog.includes("the Escape after a yield landed BODY"),
  "D3 the witness rides with the discrimination (the remount's premature spend, on film)",
);

console.log(`t814-livewatch-retarget-unit: ${pass} pass / ${fails.length} fail`);
if (fails.length > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
