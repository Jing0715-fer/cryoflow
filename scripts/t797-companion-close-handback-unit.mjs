/**
 * t797-companion-close-handback-unit — the eighth family: the companion's
 * own close chain learns the family law — the hand-back and the layered
 * Esc, rename edition.
 *
 * The wound, judged live on the frozen bundle (real fingers): the AI
 * companion is the one floating surface Radix never adopted — no trigger,
 * no DismissableLayer close chain, no refocus machinery. Both of its
 * close mouths (the layered-Esc peel inside onWindowKeyDown, the header
 * X) did nothing but setOpen(false): the panel's subtree unmounts, the
 * focused element leaves the DOM, and focus fell to BODY — witnessed in
 * the solo world (companion only, Escape in the composer, activeElement
 * read BODY). With a dialog open beneath (the t501 non-modal world) the
 * fall is caught by the modal-flip: closing the companion flips the
 * dialog back to modal and Radix REMOUNTS its content subtree, whose
 * onMountAutoFocus lands the first tabbable (witnessed live twice — the
 * dialog's open-time autofocus reasserts regardless of the last-focused
 * control). That flip landing is t501's own documented price and owns
 * the keyboard — the hand-back must stand down there.
 *
 * The cure (t797, one file): closeWithHandBack — the family law by hand.
 * The keyboard returns to the summon door ([data-dialog-live], the t501
 * mark) after the DOM commits (rAF, the t794 wall-relay precedent) with
 * the t774 preventScroll contract — but only when the close orphaned OUR
 * focus (the focus guard) and no dialog-family surface owns the landing
 * beneath (the flip guard). PLUS the layered Esc, rename edition: the
 * session-rename editor's Escape now stopPropagation — cancelling a
 * rename no longer slams the whole panel shut (the innermost layer
 * consumes its Escape; the NEXT one peels — the t430 law the search
 * input already earned through the root's live-query veto).
 *
 *   A  the hand-back — closeWithHandBack's shape: the focus guard, the
 *      flip guard's three-family query, the close always happening, the
 *      rAF landing on the door with preventScroll.
 *   B  the two mouths — the peel and the X ride the helper; no raw
 *      setOpen(false) survives outside it; the search veto and the
 *      store's door toggle stand untouched.
 *   C  the layered Esc, rename edition — stopPropagation after
 *      preventDefault, cancelRename intact, the search edition's veto
 *      path unchanged.
 *   D  the guards' honesty — the guard order (reads BEFORE the close,
 *      rAF only after both guards pass), the door mark, the flip-guard
 *      recital.
 *   E  the verdict notes on the raw channel.
 *   F  the history and the elders' regression — t430's comment, t501's
 *      mark, t796's exemption, t530's self-exemption, the registration
 *      side of the bargain, the composer's IME Enter path.
 *
 * Run:  node scripts/t797-companion-close-handback-unit.mjs
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
const panel = read("src/components/ai/assistant-panel.tsx");
const dialog = read("src/components/ui/dialog.tsx");

/* the closeWithHandBack body slice — the guard anchors must live INSIDE
 * the helper, not in its siblings */
const hStart = panel.indexOf("const closeWithHandBack = React.useCallback");
const hEnd = panel.indexOf("const onWindowKeyDown", hStart);
const helper = hStart >= 0 && hEnd > hStart ? panel.slice(hStart, hEnd) : "";
ok(helper.length > 400, "SLICE closeWithHandBack body isolated from onWindowKeyDown");

/* ------------------------------------------------------------------ */
/* A — the hand-back (the family law by hand)                           */
/* ------------------------------------------------------------------ */

ok(
  helper.includes(
    'document.activeElement.closest("[data-companion-window]") != null'
  ),
  "A1 the focus guard asks the companion's own root — only an orphaned panel focus hands back"
);
ok(
  helper.includes(
    '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"]'
  ),
  "A2 the flip guard composes all three family slots (dialog + alert + sheet)"
);
ok(
  helper.indexOf("setOpen(false);") > helper.indexOf("const dialogBeneath") &&
    helper.indexOf("if (!focusInside || dialogBeneath) return;") >
      helper.indexOf("setOpen(false);"),
  "A3 the close always happens — the guards stand down AFTER the panel closes, never instead of it"
);
ok(
  /requestAnimationFrame\(\(\) => \{\s*\n\s*document\.querySelector<HTMLElement>\("\[data-dialog-live\]"\)\?\.focus\(\{ preventScroll: true \}\);/.test(
    helper
  ),
  "A4 the landing rides the rAF post-commit (the t794 precedent) onto the t501 door mark with the t774 contract"
);
ok(
  (panel.match(/setOpen\(false\)/g) || []).length === 1,
  "A5 exactly ONE raw close remains — inside the helper; every mouth goes through the law"
);

/* ------------------------------------------------------------------ */
/* B — the two mouths ride it                                           */
/* ------------------------------------------------------------------ */

ok(
  /const onWindowKeyDown[\s\S]*?closeWithHandBack\(\);\s*\n\s*\};/.test(panel),
  "B1 the layered-Esc peel hands back through the helper"
);
ok(
  panel.includes("onClick={() => closeWithHandBack()}") &&
    panel.includes('aria-label="关闭 AI 助手"'),
  "B2 the header X hands back through the helper"
);
ok(
  /if \(t && t\.closest\("\[data-session-search\]"\) && sessionQuery\.trim\(\)\.length > 0\) \{\s*\n\s*e\.preventDefault\(\);\s*\n\s*setSessionQuery\(""\);\s*\n\s*return;/.test(
    panel
  ),
  "B3 the search veto stands verbatim — a live query is cleared FIRST, the window stays"
);
ok(
  panel.includes("setAiAssistantOpen") && panel.includes("aiAssistantOpen"),
  "B4 the store's door toggle is untouched — the outside world opens and toggles as always"
);
const panelBody = panel.slice(panel.indexOf("export function AssistantPanel()"));
ok(
  (panelBody.match(/onClick=\{\(\) => setOpen/g) || []).length === 0,
  "B5 no close mouth bypasses the helper — the raw setOpen escape hatch is closed (the ToolCard's own expand toggle lives outside this slice)"
);

/* ------------------------------------------------------------------ */
/* C — the layered Esc, rename edition                                  */
/* ------------------------------------------------------------------ */

ok(
  /else if \(e\.key === "Escape"\) \{\s*\n\s*e\.preventDefault\(\);\s*\n\s*\/\/ t797 — the innermost layer consumes its Escape[\s\S]*?e\.stopPropagation\(\);\s*\n\s*cancelRename\(\);/.test(
    panel
  ),
  "C1 the rename editor consumes its Escape — preventDefault, stopPropagation, then cancel"
);
ok(
  panel.includes("onBlur={() => void commitRename(s.id)}"),
  "C2 the rename commit path stands — the blur contract untouched by the layering"
);
ok(
  panel.includes('data-session-search=""'),
  "C3 the search input keeps its mark — the root's veto reads it every Escape"
);

/* ------------------------------------------------------------------ */
/* D — the guards' honesty                                              */
/* ------------------------------------------------------------------ */

ok(
  helper.indexOf("const focusInside") < helper.indexOf("const dialogBeneath") &&
    helper.indexOf("const dialogBeneath") < helper.indexOf("setOpen(false);"),
  "D1 the guards read BEFORE the close — the panel is still mounted, the reads are honest"
);
ok(
  helper.indexOf("if (!focusInside || dialogBeneath) return;") <
    helper.indexOf("requestAnimationFrame"),
  "D2 the rAF sits behind BOTH guards — a stood-down close never touches the keyboard"
);
ok(
  dialog.includes('const DIALOG_LIVE_SELECTOR = "[data-dialog-live]"'),
  "D3 the landing target's mark keeps its one definition (the t501 summon-door contract)"
);
ok(
  panel.includes("the remount's onMountAutoFocus owns the landing") &&
    panel.includes("the t501-documented flip price"),
  "D4 the flip guard's recital is on file — the remount owns the landing when a dialog lives beneath"
);

/* ------------------------------------------------------------------ */
/* E — the verdict notes (the raw channel)                              */
/* ------------------------------------------------------------------ */

ok(
  panel.includes("the one floating\n   *  surface Radix never adopted"),
  "E1 the census verdict is on file — no Radix machinery ever closed behind the companion"
);
ok(
  panel.includes("the t788 order: the DOM commits first") &&
    panel.includes("the t774 contract: preventScroll"),
  "E2 the family law's recital — the order and the contract, by name"
);
ok(
  panel.includes("the t796 exemption\n   *  keeps the dialog's return address armed"),
  "E3 the t796 coherence is on file — the door landing is a live-zone focusin, the pocket survives"
);
ok(
  panel.includes("the NEXT\n                // Escape peels"),
  "E4 the layered law's promise — cancelling a rename never slams the panel; the next Escape does"
);
ok(
  panel.includes("(The search input earns the same layering\n                // through the root's live-query veto instead;"),
  "E5 the two-mechanisms honesty — the rename's boundary lives in stopPropagation, the search's in the veto"
);

/* ------------------------------------------------------------------ */
/* F — the history and the elders' regression                           */
/* ------------------------------------------------------------------ */

ok(
  panel.includes("t430's layered Esc, floating edition"),
  "F1 the t430 charter stands — the search edition's comment survives the surgery"
);
ok(
  dialog.includes("t796 — the live zones are not the outside world") &&
    dialog.includes(
      "if (target.closest(`${COMPANION_WINDOW_SELECTOR}, ${DIALOG_LIVE_SELECTOR}`))"
    ),
  "F2 the t796 exemption stands — the staged world receives the door landing as designed"
);
ok(
  dialog.includes("if (!event.defaultPrevented && isFromLiveZone(event, selfRef.current))"),
  "F3 the t530 self-exemption stands — the dialog's own Escape is nobody else's business"
);
ok(
  panel.includes('data-companion-window=""') && panel.includes("useCompanionWindow()"),
  "F4 the registration side of the t501 bargain stands — the panel still counts itself"
);
ok(
  /if \(e\.key === "Enter" && !e\.shiftKey && !e\.nativeEvent\.isComposing\) \{\s*\n\s*e\.preventDefault\(\);\s*\n\s*void send\(input\);/.test(
    panel
  ),
  "F5 the composer's IME-guarded Enter path stands — the surgery never touched the send mouth"
);
ok(
  panel.includes("if (!open) return null;"),
  "F6 the mount gate stands — the panel's state persists across closes, the draft survives the peel"
);

/* ------------------------------------------------------------------ */
/* receipt                                                              */
/* ------------------------------------------------------------------ */

const label = "t797-companion-close-handback-unit";
if (fail === 0) {
  console.log(`${label}: ALL PASS ${pass}/${pass}`);
} else {
  console.error(`${label}: ${fail} FAILED of ${pass + fail}`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
