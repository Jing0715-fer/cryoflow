/**
 * t794-wall-delete-relay-unit — the sixth family: the wall's DELETE
 * RELAY, and the t670 symmetry's last silent mouth speaks.
 *
 * The hole, judged live (real fingers, frozen bundle): the dashboard's
 * saved-view wall deletes a card — the row unmounts — and focus falls
 * to BODY. Witnessed with a temp view grown beside the three canon
 * poses (never touching them): focus parked on the temp card's X, the
 * X clicked, the row gone, document.activeElement read on BODY. In the
 * staged t793 world the confirm's hand-back returns focus to the very
 * X that opened the question — and then THAT X unmounts one step later,
 * the same hole, one hop downstream.
 *
 * The cure (t794, the t791 law in wall dialect): deleteView computes
 * the landing from the PRE-delete closure — the card now occupying the
 * vanished card's slot (t788's min-math: the next sibling shifts into
 * place; the LAST visible card's delete hands to the previous), on the
 * SAME mouth (the X — a delete spree stays a spree; an accidental Enter
 * opens the confirm, whose Cancel is the default). When the wall
 * dissolves entirely (the last bookmark of the last job), focus
 * continues in reading order at the successor section's first live
 * control. Focus keeps the t774 contract: preventScroll, then the
 * nearest-block scroll. And the wall's delete now BROADCASTS like every
 * other mutation mouth — the t670 symmetry's missing half (the
 * palette's row delete told the wall; the wall's delete told no one,
 * leaving the palette's rows and the viewer's door stale until some
 * unrelated mutation).
 *
 *   A  the relay math — the vanished card's slot, the flatAfter mirror,
 *      the min-math landing, the dissolve flag, the inert guard.
 *   B  the landing hook — data-saved-view-delete, the composed query,
 *      the post-commit rAF, the t774 focus contract + reachability.
 *   C  the dissolve arm — the successor attribute, the reading-order
 *      query, the preventScroll landing there too.
 *   D  the t670 symmetry repair — the wall's delete broadcasts; all
 *      three aggregate faces listen; the echo is token-guarded.
 *   E  the verdict notes on the raw channel.
 *   F  the history and the elders' regression — t791's grid relay
 *      untouched, t793's confirm contract intact, the bridge injection
 *      still riding before the spread.
 *
 * Run:  node scripts/t794-wall-delete-relay-unit.mjs
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
const dash = read("src/components/workflow/project-dashboard.tsx");
const palette = read("src/components/workflow/command-palette.tsx");
const molstar = read("src/components/workflow/results/molstar-embed.tsx");
const gallery = read("src/components/workflow/class-gallery.tsx");
const alert = read("src/components/ui/alert-dialog.tsx");

/* the deleteView body slice — the broadcast and relay anchors must live
 * INSIDE deleteView, not in its siblings (renameView dispatches too) */
const dvStart = dash.indexOf("const deleteView = async");
const dvEnd = dash.indexOf("const confirmViewDelete", dvStart);
const dv = dvStart >= 0 && dvEnd > dvStart ? dash.slice(dvStart, dvEnd) : "";
ok(dv.length > 400, "SLICE deleteView body isolated from renameView");

/* ------------------------------------------------------------------ */
/* A — the relay math (the t791 law in wall dialect)                    */
/* ------------------------------------------------------------------ */

ok(/const pos = wall\.findIndex\(\(x\) => x\.b\.id === b\.id\);/.test(dv),
  "A1 the vanished card's slot is found on the VISIBLE wall");
ok(/const rest = row\.bookmarks\.filter\(\(x\) => x\.id !== b\.id\);/.test(dv) &&
   /row\.bookmarks\.length > 0/.test(dv),
  "A2 flatAfter mirrors the setViews filter (same shape, one truth)");
ok(/const landing = pos >= 0 \? \(wallAfter\[pos\] \?\? wallAfter\[pos - 1\] \?\? null\) : null;/.test(dv),
  "A3 the landing is the slot's new tenant, else the previous (t788 min-math, wall dialect)");
ok(/const dissolved = pos >= 0 && wallAfter\.length === 0;/.test(dv),
  "A4 the dissolve flag fires only when the wall truly empties");
ok(/no relay, no steal, focus keeps whatever the/.test(dash),
  "A5 the impossible world (pos -1) stays inert — no relay, no steal");

/* ------------------------------------------------------------------ */
/* B — the landing hook                                                 */
/* ------------------------------------------------------------------ */

ok(/data-saved-view-delete=\{b\.id\}/.test(dash),
  "B1 the X carries the data-saved-view-delete hook");
ok(/\[data-saved-view-card="\$\{CSS\.escape\(landing\.b\.id\)\}"\] \[data-saved-view-delete\]/.test(dv),
  "B2 the query composes card+delete and CSS.escape guards the id");
ok(/requestAnimationFrame\(\(\) => \{/.test(dv),
  "B3 the relay fires after the commit that unmounts the row (rAF)");
ok(/el\.focus\(\{ preventScroll: true \}\); \/\/ the t774 contract/.test(dv) &&
   /el\.scrollIntoView\(\{ block: "nearest", inline: "nearest" \}\); \/\/ reachability/.test(dv),
  "B4 focus keeps the t774 contract and earns reachability");

/* ------------------------------------------------------------------ */
/* C — the dissolve arm (the reading-order continuation)                */
/* ------------------------------------------------------------------ */

ok(/if \(dissolved\) \{/.test(dv),
  "C1 the dissolve branch exists inside the relay");
ok((dash.match(/data-saved-views-successor/g) || []).length === 2,
  "C2 the successor attribute sits on the shelf wrapper AND the query (exactly two)");
ok(/querySelector<HTMLElement>\("\[data-saved-views-successor\]"\)/.test(dv) &&
   /button:not\(\[disabled\]\), a\[href\]/.test(dv),
  "C3 the dissolve lands on the successor section's first live control");
ok(/querySelector<HTMLElement>\("\[data-saved-views-successor\]"\)/.test(dv) &&
   dash.indexOf("?.focus({ preventScroll: true });", dash.indexOf("[data-saved-views-successor]")) >
     dash.indexOf("[data-saved-views-successor]"),
  "C4 the dissolve landing keeps the preventScroll contract too");

/* ------------------------------------------------------------------ */
/* D — the t670 symmetry repair (the last silent mouth speaks)          */
/* ------------------------------------------------------------------ */

ok(/window\.dispatchEvent\(new CustomEvent\(SAVED_VIEWS_CHANGED_EVENT\)\);/.test(dv),
  "D1 the wall's own deleteView now broadcasts (scoped inside deleteView)");
ok((dash.match(/window\.dispatchEvent\(new CustomEvent\(SAVED_VIEWS_CHANGED_EVENT\)\);/g) || []).length === 2,
  "D2 exactly two dispatchers on the wall (delete + rename) — no duplication");
ok(/window\.addEventListener\(SAVED_VIEWS_CHANGED_EVENT, onSavedViewsChanged\)/.test(palette),
  "D3 the palette's rows hear the wall's delete now");
ok(/window\.addEventListener\(SAVED_VIEWS_CHANGED_EVENT, onSavedViewsChanged\)/.test(molstar),
  "D4 the viewer's door hears the wall's delete now");
ok(/the read-token guards the echo/.test(dv),
  "D5 the broadcast's echo through the wall's own listener is token-guarded");

/* ------------------------------------------------------------------ */
/* E — the verdict notes on the raw channel                             */
/* ------------------------------------------------------------------ */

ok(/the sixth family: the wall's DELETE RELAY \(the t791 law in/.test(dv),
  "E1 the sixth-family verdict note rides the surgery");
ok(/and focus falls to BODY: the live world judged it \(a temp view/.test(dv),
  "E2 the live BODY verdict is on file in the margins");
ok(/the friction survives the relay\)/.test(dv),
  "E3 the accidental-Enter friction verdict is on file");
ok(/on the SAME mouth — the X — so a delete spree stays a spree \(an/.test(dv),
  "E4 the same-mouth verdict is on file");
ok(/t670 symmetry, completed — the wall's own delete was the ONE/.test(dv),
  "E5 the t670 completion verdict is on file");

/* ------------------------------------------------------------------ */
/* F — the history and the elders' regression                           */
/* ------------------------------------------------------------------ */

ok(/the t791 law in\s*\n\s*\/\/ wall dialect/.test(dv),
  "F1 the t791 law is cited (wrap-tolerant anchor — lesson four)");
ok(/t788's min-math — the next sibling shifts/.test(dv),
  "F2 the t788 min-math is cited as the landing's ancestor");
ok(/t669 — delete from the wall/.test(dash),
  "F3 the t669 delete-face contract still heads the mouth");
ok(/handFocusBackToGrid/.test(gallery) &&
   /Math\.min\(idx, visible\.length - 1\)/.test(gallery),
  "F4 the t791 grid relay stands untouched (the elder family)");
const cfd = dash.slice(dash.indexOf("const confirmViewDelete"),
                       dash.indexOf("const renameView"));
ok(/setViewDeleteTarget\(null\);/.test(cfd) &&
   cfd.indexOf("await deleteView(v, b);") > cfd.indexOf("setViewDeleteTarget(null);"),
  "F5 the t793 confirm still closes FIRST, then deletes (the opener stays alive)");
const aInj = alert.indexOf("onCloseAutoFocus={returnFocusToOpener}");
const aSpread = alert.indexOf("{...props}", aInj);
ok(aInj >= 0 && aSpread > aInj,
  "F6 the t793 alert bridge injection still rides BEFORE the spread");

/* ------------------------------------------------------------------ */
/* receipt                                                              */
/* ------------------------------------------------------------------ */

const label = "t794-wall-delete-relay-unit";
if (fail === 0) {
  console.log(`${label}: ALL PASS ${pass}/${pass}`);
} else {
  console.error(`${label}: ${fail} FAILED of ${pass + fail}`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
