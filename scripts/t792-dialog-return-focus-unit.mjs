/**
 * t792-dialog-return-focus-unit — the untriggered-dialog family's shared
 * return-address layer: 32 homes, one disease, one cure in the bridge.
 *
 * The census (t792 scouting): 36 files render a controlled Radix Dialog
 * (open={...}) and only 4 carry a DialogTrigger — the other 32 open
 * imperatively from buttons that often live in OTHER components (header
 * state, chart affordances, gallery cells). Radix's close chain hands the
 * keyboard back to context.triggerRef — null for every untriggered dialog
 * — so `triggerRef.current?.focus()` is a no-op and focus falls to BODY
 * on EVERY exit. The old world, judged live twice on the frozen bundle
 * (real fingers): storage dialog Escape -> BODY; diagnostics dialog
 * Escape -> BODY. The same disease the class gallery's lightbox was born
 * with (t791's "born without a trigger"), now at census scale — and the
 * same disease t789 cured per-dialog on the canvas, this time cured ONCE
 * for the whole family in the bridge every dialog already crosses
 * (src/components/ui/dialog.tsx).
 *
 * The cure is ONE layer, not 32 wirings. A document-level focusin capture
 * keeps the RETURN ADDRESS — the last opener-like element focused outside
 * every dialog surface (the SIBLING_SURFACE_SELECTOR trio: dialog /
 * alert-dialog / sheet) — and DialogContent injects a default
 * onCloseAutoFocus that spends it on close. Callers who pass their OWN
 * onCloseAutoFocus (the cured households: canvas t789, job-card t789,
 * class-gallery t791, mol-viewer) replace the default wholesale because
 * {...props} spreads AFTER the injection — bespoke chains stay verbatim.
 *
 * The laws the layer inherits:
 * - the t791 witness stand-down: a focusin landing OUTSIDE every open
 *   dialog while one is open is a voluntary exit — the pocket is
 *   disarmed (null), never answered with a focus steal.
 * - the t788 order law: the pocket is cleared BEFORE the focus moves.
 * - the t774 contract: the restore passes preventScroll: true.
 * - the nested walk-back: a restored address inside a LIVING dialog
 *   surface stays as that surface's return address, so chained closes
 *   hand focus back through both doors.
 *
 *   A  the layer's mechanics — the singleton + the one focusin capture,
 *      the inside-surface skip, the voluntary-exit stand-down, the
 *      opener-like census (button/a/input/select/textarea/role=button/
 *      tabindex), the dying-subtree guard, the t788 order (clear before
 *      focus), the t774 preventScroll, the nested walk-back re-seed.
 *   B  the injection contract — the default onCloseAutoFocus rides
 *      BEFORE the {...props} spread (caller override wins), the
 *      openCount registration effect (+1 on mount, floored decrement).
 *   C  the cured households — the four bespoke onCloseAutoFocus chains
 *      still on file, still overriding the default wholesale.
 *   D  the old contracts untouched — companion guards, the t530 escape
 *      guard, the onEscapeClose helper, the t501 live-door selector.
 *   E  the verdict notes on the raw channel (single-line word-forms).
 *   F  the history in the margins — t788, t789, t791, t774.
 *
 * Run:  node scripts/t792-dialog-return-focus-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

let pass = 0;
let fail = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) pass++;
  else {
    fail++;
    fails.push(label);
  }
};

const dlgPath = path.join(ROOT, "src/components/ui/dialog.tsx");
const dlg = readFileSync(dlgPath, "utf8");

/* ------------------------------------------------------------------ */
/* A — the layer's mechanics                                           */
/* ------------------------------------------------------------------ */

// A1 — the layer shape: one pocket, one counter.
ok(/const layer: DialogFocusLayer = \{ pocket: null, openCount: 0 \}/.test(dlg),
  "A1 the layer is born empty (pocket null, openCount 0)");

// A2 — exactly ONE document-level focusin capture listener, armed once.
ok(/document\.addEventListener\(\s*"focusin",/.test(dlg),
  "A2 the focusin capture listener exists");
ok((dlg.match(/document\.addEventListener\(/g) || []).length === 1,
  "A3 exactly one document listener — the layer is built once");

// A4 — the inside-surface skip rides the sibling trio (dialog/alert/sheet).
ok(/if \(target\.closest\(SIBLING_SURFACE_SELECTOR\)\) return/.test(dlg),
  "A4 focus inside a dialog surface is never an opener address");

// A5 — the t791 witness stand-down: voluntary exit disarms the pocket.
ok(/if \(layer\.openCount > 0\) \{\s*layer\.pocket = null\s*return\s*\}/.test(dlg),
  "A5 a focusin outside every open dialog stands the pocket down");

// A6 — the opener-like census: the seven dialects of a legitimate opener.
ok(/tag === "BUTTON"/.test(dlg) && /tag === "A"/.test(dlg) &&
   /tag === "INPUT"/.test(dlg) && /tag === "SELECT"/.test(dlg) &&
   /tag === "TEXTAREA"/.test(dlg) &&
   /el\.getAttribute\("role"\) === "button"/.test(dlg) &&
   /el\.hasAttribute\("tabindex"\)/.test(dlg),
  "A6 isOpenerLike counts button/a/input/select/textarea/role=button/tabindex");

// A7 — the type predicate: isOpenerLike narrows to HTMLElement.
ok(/function isOpenerLike\(el: Element\): el is HTMLElement \{/.test(dlg),
  "A7 isOpenerLike is a type predicate (narrows Element to HTMLElement)");

// A8 — the dying-subtree guard: never restore into a closing surface.
ok(/function isInsideClosingDialog\(el: Element\): boolean \{/.test(dlg) &&
   /\[data-slot="dialog-content"\]\[data-state="closed"\]/.test(dlg),
  "A8 the dying-subtree guard reads data-state=closed surfaces");

// A9 — the t788 order law: the pocket is cleared BEFORE the focus moves.
const rftoIdx = dlg.indexOf("function returnFocusToOpener");
const rftoBody = rftoIdx >= 0 ? dlg.slice(rftoIdx, rftoIdx + 1600) : "";
ok(rftoIdx >= 0, "A9 returnFocusToOpener exists");
const clearIdx = rftoBody.indexOf("layer.pocket = null");
const focusIdx = rftoBody.indexOf("pocket.focus(");
ok(clearIdx >= 0 && focusIdx >= 0 && clearIdx < focusIdx,
  "A10 the pocket is cleared before the focus moves (the t788 order law)");

// A11 — the dead-opener guard: spend only on a connected, opener-like pocket.
ok(/if \(!pocket \|\| !pocket\.isConnected \|\| !isOpenerLike\(pocket\)\) return/.test(rftoBody),
  "A11 dead or non-opener pockets are never spent");

// A12 — the t774 contract: the restore is scroll-silent.
ok(/pocket\.focus\(\{ preventScroll: true \}\)/.test(rftoBody),
  "A12 the restore passes preventScroll: true (the t774 contract)");

// A13 — the nested walk-back: a living-surface address stays spendable.
ok(/if \(layer && pocket\.closest\(SIBLING_SURFACE_SELECTOR\)\) layer\.pocket = pocket/.test(rftoBody),
  "A13 the nested walk-back re-seeds a restored living-surface address");

// A14 — the deterministic skip of Radix's own default (null-trigger no-op).
ok(/event\.preventDefault\(\)/.test(rftoBody),
  "A14 preventDefault skips Radix's triggerRef?.focus() in both chains");

/* ------------------------------------------------------------------ */
/* B — the injection contract                                          */
/* ------------------------------------------------------------------ */

// B1 — the default hand-back is injected on DialogPrimitive.Content.
const injectIdx = dlg.indexOf("onCloseAutoFocus={returnFocusToOpener}");
ok(injectIdx >= 0, "B1 DialogContent injects onCloseAutoFocus={returnFocusToOpener}");

// B2 — the spread comes AFTER the injection: a caller's own handler
//      replaces the default wholesale (the cured households stay verbatim).
const spreadIdx = dlg.indexOf("{...props}", injectIdx);
ok(spreadIdx > injectIdx,
  "B2 {...props} spreads after the injection — caller override wins");

// B3 — the registration effect: every mounted surface counts itself.
ok(/layer\.openCount \+= 1/.test(dlg),
  "B3 each DialogContent mount increments the open count");
ok(/layer\.openCount = Math\.max\(0, layer\.openCount - 1\)/.test(dlg),
  "B4 unmount decrements with a floor at zero");

// B5 — the effect is mount-once (empty deps) inside DialogContent.
const regIdx = dlg.indexOf("layer.openCount += 1");
const regRegion = dlg.slice(Math.max(0, regIdx - 400), regIdx + 300);
ok(/\}, \[\]\)/.test(regRegion),
  "B5 the registration effect runs once per mount (empty deps)");

/* ------------------------------------------------------------------ */
/* C — the cured households (bespoke chains stay verbatim)             */
/* ------------------------------------------------------------------ */

const households = [
  ["src/components/workflow/canvas.tsx", "C1 canvas (t789)"],
  ["src/components/workflow/job-card.tsx", "C2 job-card (t789)"],
  ["src/components/workflow/class-gallery.tsx", "C3 class-gallery (t791)"],
  ["src/components/workflow/results/mol-viewer.tsx", "C4 mol-viewer"],
];
for (const [rel, label] of households) {
  const raw = readFileSync(path.join(ROOT, rel), "utf8");
  ok(/onCloseAutoFocus=\{\(e\) => \{/.test(raw), `${label} keeps its bespoke onCloseAutoFocus`);
}

/* ------------------------------------------------------------------ */
/* D — the old contracts untouched                                     */
/* ------------------------------------------------------------------ */

ok(/onPointerDownOutside=\{companionGuard\(onPointerDownOutside\)\}/.test(dlg) &&
   /onInteractOutside=\{companionGuard\(onInteractOutside\)\}/.test(dlg) &&
   /onFocusOutside=\{companionGuard\(onFocusOutside\)\}/.test(dlg),
  "D1 the t501 companion guards ride all three outside handlers");
ok(/isFromLiveZone\(event, selfRef\.current\)/.test(dlg),
  "D2 the t530 escape-guard self exemption stands");
ok(/export function onEscapeClose\(/.test(dlg),
  "D3 the onEscapeClose helper is still exported");
ok(/DIALOG_LIVE_SELECTOR = "\[data-dialog-live\]"/.test(dlg),
  "D4 the t501 live-door selector stands");
ok(/const SIBLING_SURFACE_SELECTOR =/.test(dlg),
  "D5 the sibling-surface trio is shared, not duplicated");

/* ------------------------------------------------------------------ */
/* E — the verdict notes on the raw channel                            */
/* ------------------------------------------------------------------ */

ok(/the fourth family of the focus-relay law/.test(dlg),
  "E1 the fourth-family verdict is on file");
ok(/ONE layer, not 32 wirings/.test(dlg),
  "E2 the shared-cure verdict is on file");
ok(/36 files\s*\n\s*\*\s*render a controlled Radix Dialog/.test(dlg),
  "E3 the census headline (36 files) is on file");
ok(/storage dialog\s*\n?\s*\*?\s*Escape -> BODY/.test(dlg),
  "E4 the storage-dialog live verdict is on file");
ok(/diagnostics dialog\s*\n?\s*\*?\s*Escape -> BODY/.test(dlg),
  "E5 the diagnostics-dialog live verdict is on file");
ok(/born without a trigger|born-without-a-trigger/.test(dlg),
  "E6 the t791 lineage phrase is cited");

/* ------------------------------------------------------------------ */
/* F — the history in the margins                                      */
/* ------------------------------------------------------------------ */

ok(/t791 witness stand-down|t791 witness law/.test(dlg),
  "F1 the t791 witness law is cited");
ok(/the t788 order law/.test(dlg),
  "F2 the t788 order law is cited");
ok(/the t774 contract/.test(dlg),
  "F3 the t774 preventScroll contract is cited");
ok(/canvas t789, job-card t789,/.test(dlg),
  "F4 the cured-household register (t789 twice) is cited");

/* ------------------------------------------------------------------ */

console.log(`t792-dialog-return-focus-unit: ${pass} pass / ${fail} fail`);
if (fail > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
