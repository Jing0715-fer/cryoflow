/**
 * t793-alert-sheet-family-unit — the fifth family: the shared return-
 * address layer rides ALL THREE bridges (dialog / alert-dialog / sheet),
 * and the saved-view wall's X learns to ask before it deletes.
 *
 * The census (t793 scouting): ui/dialog.tsx got the t792 layer, but two
 * SIBLING bridges still stood bare — ui/alert-dialog.tsx (9 households,
 * 7 with zero bespoke onCloseAutoFocus: project-dashboard, user-preset-
 * shelf, app-shell, job-panel, cleanup-dialog, workspace-panel,
 * job-inspector; canvas t789 and job-card t789 carry their own chains)
 * and ui/sheet.tsx (4 users: app-shell, swipe-sheet-content, assistant-
 * panel, sidebar — none bespoke). Radix's react-alert-dialog renders
 * DialogPrimitive.Content with role="alertdialog", and ui/sheet.tsx
 * aliases react-dialog as SheetPrimitive — BOTH close through the same
 * DialogContentModal chain (composeEventHandlers(onCloseAutoFocus,
 * preventDefault + triggerRef?.focus())), so every untriggered alert and
 * sheet falls to BODY on every exit exactly like the t792 dialogs did.
 * Alerts cannot even be dismissed by clicking outside (Radix preventDefaults
 * onPointerDownOutside) — Escape/Action/Cancel are the only doors, and all
 * of them led to BODY.
 *
 * The old world, judged live (real fingers, frozen bundle): the job-panel
 * rerun confirm alert — open on top of the job inspector dialog, Radix
 * parks focus on Cancel (the a11y default: a destructive confirm never
 * lands on the destructive action), Escape -> **BODY** WITH THE INSPECTOR
 * STILL OPEN (the outer FocusScope trap did NOT self-heal — the nested
 * reading is as sick as the flat one). The flat specimen hunt became the
 * window's incident: the dashboard's saved-view X had NO confirm at all —
 * the finger meant to open an alert DELETED a named camera pose instead
 * (world restored via the t531 resurrection seed, CHECK PASS, three
 * views verbatim back — the seeder chain is the world's third copy, again).
 *
 * The cure, one layer three bridges (t793): ui/dialog.tsx EXPORTS the
 * t792 layer's two halves — returnFocusToOpener (the close hand-back) and
 * useDialogFocusSurface (the openCount registration) — and the sibling
 * bridges consume them: same handler injected before {...props} (bespoke
 * chains override wholesale), same counter driving the same stand-down.
 * One brain, three consumers, zero second copies.
 *
 * The new feature the incident paid for (t793): the saved-view wall's X
 * now opens a confirm AlertDialog (viewDeleteTarget state, honest copy —
 * the pose goes, the job and its data stay, cannot be undone) whose YES
 * closes the dialog FIRST and then runs the exact deleteView the X used
 * to call. The confirm costs one keypress and pays the focus relay for
 * free — the alert bridge's default hand-back returns focus to the very
 * X that opened it, while it is still alive.
 *
 *   A  the export surface — the layer's two halves are exported from
 *      ui/dialog.tsx and DialogContent consumes the hook (word-forms
 *      preserved: one brain, now with consumers).
 *   B  the alert bridge — the import, the registration, the injection
 *      BEFORE the {...props} spread (spread-order override contract).
 *   C  the sheet bridge — the same three anchors.
 *   D  the saved-view confirm — the state, the button's new mouth, the
 *      close-first-then-delete order, the honest copy.
 *   E  the verdict notes on the raw channel (single-line + wrap-tolerant).
 *   F  the history in the margins — t792, t791, t788, t531.
 *
 * Run:  node scripts/t793-alert-sheet-family-unit.mjs
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
const dlg = read("src/components/ui/dialog.tsx");
const alert = read("src/components/ui/alert-dialog.tsx");
const sheet = read("src/components/ui/sheet.tsx");
const dash = read("src/components/workflow/project-dashboard.tsx");

/* ------------------------------------------------------------------ */
/* A — the export surface (one brain, three consumers)                 */
/* ------------------------------------------------------------------ */

ok(/export function returnFocusToOpener\(event: Event\): void \{/.test(dlg),
  "A1 returnFocusToOpener is exported from the dialog bridge");
ok(/export function useDialogFocusSurface\(\): void \{/.test(dlg),
  "A2 useDialogFocusSurface is exported from the dialog bridge");
ok(/layer\.openCount \+= 1/.test(dlg) &&
   /layer\.openCount = Math\.max\(0, layer\.openCount - 1\)/.test(dlg),
  "A3 the t792 registration word-forms live inside the exported hook");
ok(/onCloseAutoFocus=\{returnFocusToOpener\}/.test(dlg),
  "A4 the dialog bridge still injects the default hand-back");
// the t792 order law survives the refactor: clear BEFORE focus.
const rfto = dlg.slice(dlg.indexOf("export function returnFocusToOpener"),
                       dlg.indexOf("export function returnFocusToOpener") + 900);
ok(rfto.indexOf("layer.pocket = null") >= 0 &&
   rfto.indexOf("pocket.focus(") > rfto.indexOf("layer.pocket = null"),
  "A5 the t788 order law survives the export refactor");

/* ------------------------------------------------------------------ */
/* B — the alert bridge                                                */
/* ------------------------------------------------------------------ */

ok(/import \{\s*returnFocusToOpener,\s*useDialogFocusSurface,\s*\} from "@\/components\/ui\/dialog"/.test(alert),
  "B1 the alert bridge imports both halves from the one brain");
ok(alert.indexOf("useDialogFocusSurface()") > 0,
  "B2 the alert bridge counts itself into the shared layer");
const aInj = alert.indexOf("onCloseAutoFocus={returnFocusToOpener}");
const aSpread = alert.indexOf("{...props}", aInj);
ok(aInj >= 0 && aSpread > aInj,
  "B3 the injection rides BEFORE the spread — bespoke chains override wholesale");
ok(/canvas t789, job-card t789\) override wholesale|bespoke chains \(canvas t789, job-card t789\)/.test(alert),
  "B4 the override register is cited on the alert bridge");
const canvas = read("src/components/workflow/canvas.tsx");
const jobcard = read("src/components/workflow/job-card.tsx");
ok(/onCloseAutoFocus=\{\(e\) => \{/.test(canvas) &&
   /onCloseAutoFocus=\{\(e\) => \{/.test(jobcard),
  "B5 the two t789 households' bespoke chains are still on file");

/* ------------------------------------------------------------------ */
/* C — the sheet bridge                                                */
/* ------------------------------------------------------------------ */

ok(/import \{\s*returnFocusToOpener,\s*useDialogFocusSurface,\s*\} from "@\/components\/ui\/dialog"/.test(sheet),
  "C1 the sheet bridge imports both halves from the one brain");
ok(sheet.indexOf("useDialogFocusSurface()") > 0,
  "C2 the sheet bridge counts itself into the shared layer");
const sInj = sheet.indexOf("onCloseAutoFocus={returnFocusToOpener}");
const sSpread = sheet.indexOf("{...props}", sInj);
ok(sInj >= 0 && sSpread > sInj,
  "C3 the injection rides BEFORE the spread on the sheet bridge too");
ok(/SheetPrimitive IS react-dialog \(aliased\)/.test(sheet),
  "C4 the same-close-chain verdict is on file on the sheet bridge");

/* ------------------------------------------------------------------ */
/* D — the saved-view confirm (the incident's feature)                 */
/* ------------------------------------------------------------------ */

ok(/const \[viewDeleteTarget, setViewDeleteTarget\] = React\.useState<\{\s*v: GalleryEntry;\s*b: GalleryBookmark;\s*\} \| null>\(null\)/.test(dash),
  "D1 the confirm state carries the exact entry + bookmark pair");
ok(/onClick=\{\(\) => setViewDeleteTarget\(\{ v, b \}\)\}/.test(dash) &&
   !/onClick=\{\(\) => void deleteView\(v, b\)\}/.test(dash),
  "D2 the wall's X now asks instead of deleting");
const cvd = dash.slice(dash.indexOf("const confirmViewDelete"),
                       dash.indexOf("const confirmViewDelete") + 400);
ok(cvd.indexOf("setViewDeleteTarget(null)") >= 0 &&
   cvd.indexOf("await deleteView(v, b)") > cvd.indexOf("setViewDeleteTarget(null)"),
  "D3 close FIRST, then delete — the opener stays alive for the hand-back");
ok(/Delete saved view “\{viewDeleteTarget\?\.b\.name \?\? ""\}”\?/.test(dash),
  "D4 the question names the pose");
ok(/only this named view goes, and the\s*\n\s*\*?\s*action cannot be undone|cannot be undone/.test(dash),
  "D5 the copy is honest about irreversibility");
ok(/This removes the named camera pose from\s*\n?\s*\{?["']?\s*\{?"?\s*"?\s*"?\s*\{viewDeleteTarget\?\.v\.jobName\}/.test(dash) ||
   /This removes the named camera pose from\s*\{?\s*"?\s*\{viewDeleteTarget\?\.v\.jobName\}/.test(dash) ||
   dash.includes("This removes the named camera pose from"),
  "D6 the copy spares the job (only the pose goes)");
const alertJsx = dash.slice(dash.indexOf("open={viewDeleteTarget !== null}"));
ok(/className="h-10 bg-destructive text-destructive-foreground[^"]*"/.test(
     alertJsx.slice(0, 1400)),
  "D7 the destructive action wears the destructive suit");
ok(/open=\{viewDeleteTarget !== null\}/.test(dash),
  "D8 the alert is controlled by the target, not a boolean twin");

/* ------------------------------------------------------------------ */
/* E — the verdict notes on the raw channel                            */
/* ------------------------------------------------------------------ */

ok(/the fifth family|fifth-family/.test(dlg + alert + sheet),
  "E1 the fifth-family verdict is on file");
ok(/role="alertdialog"/.test(alert) || alert.includes('role="alertdialog"') ||
   /DialogPrimitive\.Content \(role="alertdialog"\)/.test(alert),
  "E2 the same-chain proof is cited on the alert bridge");
ok(/one\s*\n?\s*(\/\/\s*)?\*?\s*mis-click from eating a named camera pose/.test(dash),
  "E3 the incident is on file in the source margins");
ok(/pays the focus relay for\s*\n?\s*\*?\s*free|pays the focus relay for free/.test(dash),
  "E4 the confirm-pays-the-relay verdict is on file");

/* ------------------------------------------------------------------ */
/* F — the history in the margins                                      */
/* ------------------------------------------------------------------ */

ok(/t792/.test(alert) && /t792|t793/.test(sheet),
  "F1 the t792 lineage is cited on both sibling bridges");
ok(/t791 stand-down|t791/.test(dlg) && /t791/.test(alert + sheet),
  "F2 the t791 witness law rides along");
ok(/t788 order law|t788/.test(dlg),
  "F3 the t788 order law is cited");
ok(/canvas t789|job-card t789/.test(dlg + alert),
  "F4 the cured-household register survives on the bridges");

/* ------------------------------------------------------------------ */

console.log(`t793-alert-sheet-family-unit: ${pass} pass / ${fail} fail`);
if (fail > 0) {
  for (const f of fails) console.log("  FAIL " + f);
  process.exit(1);
}
