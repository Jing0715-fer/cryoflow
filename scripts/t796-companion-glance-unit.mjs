/**
 * t796-companion-glance-unit — the seventh family: the focus layer
 * learns the live zones — a companion glance is not a departure.
 *
 * The composition verdict the worklog ordered (the t501 companion-yield
 * x the t792 layer's non-modal close chain), judged in two halves:
 *
 * The CLEAN half, witnessed live on the frozen bundle (real pointer
 * sequence): with a companion open the dialog drops to non-modal, an
 * outside click dismisses it, and focus lands wherever the browser put
 * it — no steal. The layer's stand-down (page focusin while open =>
 * pocket disarmed) and Radix's non-modal hasInteractedOutsideRef
 * bookkeeping agree: a click outside is the user leaving on their own,
 * and neither brain answers it with a focus hand-back.
 *
 * The WOUNDED half, proven by source trace and now anchored here: the
 * stand-down's disarm branch treats the LIVE ZONES as the outside
 * world. A focusin landing inside the companion (typing in the AI
 * assistant) or on a summon door (the header's AI button) while a
 * dialog is open fell through the sibling-surface early-return into
 * `pocket = null` — yet the t501 contract says the opposite: companion
 * interactions are exempt from the outside world's judgments ("focus,
 * typing, dragging in the companion work; the dialog stays open — both
 * surfaces live at once"). Escape then closed the dialog with the
 * pocket already spent: returnFocusToOpener prevented Radix's default
 * and landed nobody — focus on BODY, the family's disease reborn
 * through the companion door.
 *
 * The cure (t796): the two live-zone selectors join the early-return —
 * a glance is not a departure, the return address survives it. With no
 * dialog open the zones keep their idle right (an opener-like zone
 * control arms the pocket, so a dialog opened FROM the assistant hands
 * back to the assistant) — the idle behavior is byte-identical to the
 * old fall-through; the ONLY behavior change is openCount > 0: disarm
 * becomes preserve.
 *
 *   A  the live-zone exemption — the branch, its selectors, its arm,
 *      its return; the order between the sibling return and the
 *      stand-down.
 *   B  the glance chain — why the glance was lethal: the disarm branch
 *      below, the pocket spend, the preventDefault, the opener guards.
 *   C  the idle semantics — openCount === 0 && isOpenerLike arms, the
 *      summon door rides the same branch, the sibling early-return
 *      stays above (dialog-internal focus never arms, never disarms).
 *   D  the t501 contract intact — the guards, the yield law, the
 *      assistant's registration side of the bargain.
 *   E  the verdict notes on the raw channel.
 *   F  the history and the elders' regression — t792's layer words,
 *      t791's witness law for REAL departures, t788's order, t774's
 *      contract, t793's export surface, the nested walk-back.
 *
 * Run:  node scripts/t796-companion-glance-unit.mjs
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

const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const dialog = read("src/components/ui/dialog.tsx");
const alert = read("src/components/ui/alert-dialog.tsx");
const sheet = read("src/components/ui/sheet.tsx");
const assistant = read("src/components/ai/assistant-panel.tsx");

/* the focusin listener slice — the cure must live INSIDE the listener,
 * between the sibling early-return and the t791 stand-down (the
 * disarm branch), not anywhere else in the file */
const listenerStart = dialog.indexOf('document.addEventListener(\n    "focusin"');
const listenerEnd = dialog.indexOf("return layer", listenerStart);
const listener =
  listenerStart >= 0 && listenerEnd > listenerStart
    ? dialog.slice(listenerStart, listenerEnd)
    : "";
ok(listener.length > 600, "SLICE the focusin listener body isolated");

/* ------------------------------------------------------------------ */
/* A — the live-zone exemption (the cure)                               */
/* ------------------------------------------------------------------ */

ok(
  listener.indexOf("if (target.closest(SIBLING_SURFACE_SELECTOR)) return") <
    listener.indexOf("t796 — the live zones are not the outside world") &&
    listener.indexOf("t796 — the live zones are not the outside world") <
      listener.indexOf("if (openSurfaceExists())"),
  "A1 the exemption sits BETWEEN the sibling return and the stand-down (the t813 amendment: the stand-down reads the DOM truth)"
);
ok(
  listener.includes(
    "target.closest(`${COMPANION_WINDOW_SELECTOR}, ${DIALOG_LIVE_SELECTOR}`)"
  ),
  "A2 the branch composes BOTH live-zone selectors (companion window + summon door)"
);
ok(
  listener.includes(
    "if (!openSurfaceExists() && isOpenerLike(target)) layer.pocket = target"
  ),
  "A3 the idle right survives — an opener-like zone control still arms the pocket (the t813 amendment: the idle right reads the DOM truth)"
);
ok(
  /if \(target\.closest\(`\$\{COMPANION_WINDOW_SELECTOR\}, \$\{DIALOG_LIVE_SELECTOR\}`\)\) \{\s*\n\s*if \(!openSurfaceExists\(\) && isOpenerLike\(target\)\) layer\.pocket = target\s*\n\s*return\s*\n\s*\}/.test(
    listener
  ),
  "A4 the branch RETURNS — a glance can never fall through to the disarm (the t813 amendment rides)"
);
ok(
  (dialog.match(/t796 — the live zones are not the outside world/g) || []).length === 1,
  "A5 the cure is stated once — one exemption, no second brain"
);

/* ------------------------------------------------------------------ */
/* B — the glance chain (why the glance was lethal)                     */
/* ------------------------------------------------------------------ */

ok(
  listener.includes("if (openSurfaceExists()) {") &&
    listener.includes("layer.pocket = null"),
  "B1 the t791 stand-down still disarms below — a REAL page departure loses the pocket (the t813 amendment: the DOM truth gates it)");
ok(
  /export function returnFocusToOpener\(event: Event\): void \{[\s\S]*?layer\.pocket = null[\s\S]*?event\.preventDefault\(\)/.test(
    dialog
  ),
  "B2 the close hand-back clears BEFORE it prevents (t788 order) — a spent pocket lands nobody"
);
ok(
  /export function returnFocusToOpener\(event: Event\): void \{[\s\S]*?pocket\.focus\(\{ preventScroll: true \}\)/.test(
    dialog
  ),
  "B3 the landing keeps the t774 contract (preventScroll)"
);
ok(
  /tag === "INPUT" \|\|\s*\n\s*tag === "SELECT" \|\|\s*\n\s*tag === "TEXTAREA"/.test(dialog),
  "B4 isOpenerLike covers the companion textarea — the idle arm is real, not theoretical"
);
ok(
  /pocket\.focus\(\{ preventScroll: true \}\)[\s\S]*?if \(layer && pocket\.closest\(SIBLING_SURFACE_SELECTOR\)\) layer\.pocket = pocket/.test(
    dialog
  ),
  "B5 the nested walk-back stands untouched — restored addresses inside living surfaces persist"
);

/* ------------------------------------------------------------------ */
/* C — the idle semantics (byte-identical at openCount === 0)           */
/* ------------------------------------------------------------------ */

ok(
  listener.indexOf("if (target.closest(SIBLING_SURFACE_SELECTOR)) return") <
    listener.indexOf("t796 — the live zones"),
  "C1 the sibling early-return stays ABOVE the exemption — dialog-internal focus never arms, never disarms");
ok(
  listener.indexOf("t796 — the live zones") <
    listener.indexOf("if (isOpenerLike(target)) layer.pocket = target") &&
    listener.indexOf("if (isOpenerLike(target)) layer.pocket = target") < listener.length - 1,
  "C2 the idle arm for everything else stands AFTER the exemption — page openers arm as always"
);
ok(
  (dialog.match(/DIALOG_LIVE_SELECTOR = "\[data-dialog-live\]"/g) || []).length === 1,
  "C3 the summon-door selector keeps its one definition"
);
ok(
  (dialog.match(/COMPANION_WINDOW_SELECTOR = "\[data-companion-window\]"/g) || []).length === 1,
  "C4 the companion selector keeps its one definition"
);
ok(
  !listener.includes("layer.pocket = target\n        return\n      }\n      if (layer.openCount === 0"),
  "C5 no double-arm shadow — the exemption's arm is the only arm inside the branch"
);

/* ------------------------------------------------------------------ */
/* D — the t501 contract intact (the other side of the bargain)         */
/* ------------------------------------------------------------------ */

ok(
  /onPointerDownOutside=\{companionGuard\(onPointerDownOutside\)\}/.test(dialog) &&
    /onInteractOutside=\{companionGuard\(onInteractOutside\)\}/.test(dialog) &&
    /onFocusOutside=\{companionGuard\(onFocusOutside\)\}/.test(dialog),
  "D1 the three outside guards still ride the companionGuard composer"
);
ok(
  /modal=\{modal \?\? !companionOpen\}/.test(dialog),
  "D2 the yield law stands — dialogs drop non-modal while a companion lives"
);
ok(
  /isFromLiveZone[\s\S]*?target\.closest\(\s*`\$\{COMPANION_WINDOW_SELECTOR\}, \$\{DIALOG_LIVE_SELECTOR\}, \$\{SIBLING_SURFACE_SELECTOR\}`\s*\)/.test(
    dialog
  ),
  "D3 isFromLiveZone keeps its three-zone composition (dismissal side, untouched)"
);
ok(
  assistant.includes("data-companion-window=") &&
    assistant.includes("useCompanionWindow()"),
  "D4 the assistant still registers its half — [data-companion-window] + the live effect"
);

/* ------------------------------------------------------------------ */
/* E — the verdict notes (the raw channel)                              */
/* ------------------------------------------------------------------ */

ok(
  dialog.includes("the family's BODY disease reborn through the\n      // companion door"),
  "E1 the verdict is on file — the disease reborn through the companion door"
);
ok(
  dialog.includes("a GLANCE,\n      // not a voluntary exit"),
  "E2 the glance-not-departure verdict is on file"
);
ok(
  dialog.includes("an opener-like zone control (the companion textarea, the\n      // AI button) arms the pocket"),
  "E3 the idle right is recited — a dialog opened FROM the assistant hands back to the assistant"
);
ok(
  dialog.includes("Sibling surfaces stay above: their\n      // focus belongs to that surface and never arms"),
  "E4 the sibling boundary is on file — a dialog opened from a dialog is the walk-back's business"
);
ok(
  alert.includes("returnFocusToOpener") &&
    sheet.includes("returnFocusToOpener"),
  "E5 one layer, three bridges — the alert and sheet bridges inherit the exemption through the shared listener"
);

/* ------------------------------------------------------------------ */
/* F — the history and the elders' regression                           */
/* ------------------------------------------------------------------ */

ok(
  dialog.includes("t791 witness law: focus landing outside every dialog surface") &&
    dialog.includes("voluntary exit — stand down, don't steal"),
  "F1 the t791 witness law stands for REAL departures — the page focusin disarm is untouched"
);
ok(
  dialog.includes("t792 — the untriggered-dialog family's shared return-address layer"),
  "F2 the t792 layer's charter paragraph stands — the fourth family's home"
);
ok(
  /const layer: DialogFocusLayer = \{ pocket: null \}/.test(dialog) &&
    /function openSurfaceExists\(\)/.test(dialog),
  "F3 the layer singleton's shape is pocket-only (the t813 amendment: the counter is retired, the DOM truth answers the stand-down)"
);
ok(
  /\*\* True when the element lives inside a dialog surface whose host dialog\n \* is CLOSING/.test(dialog),
  "F4 the dying-subtree guard keeps its charter (isInsideClosingDialog)"
);
ok(
  dialog.includes("export function returnFocusToOpener") &&
    dialog.includes("export function useDialogFocusSurface"),
  "F5 the t793 export surface stands — both halves exported for the sibling bridges"
);
ok(
  /const COMPANION_WINDOW_SELECTOR[\s\S]*?const DIALOG_LIVE_SELECTOR[\s\S]*?const SIBLING_SURFACE_SELECTOR/.test(
    dialog
  ),
  "F6 the three zone selectors keep their t501/t503 order and homes"
);

/* ------------------------------------------------------------------ */
/* receipt                                                              */
/* ------------------------------------------------------------------ */

const label = "t796-companion-glance-unit";
if (fail === 0) {
  console.log(`${label}: ALL PASS ${pass}/${pass}`);
} else {
  console.error(`${label}: ${fail} FAILED of ${pass + fail}`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
