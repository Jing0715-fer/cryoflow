/**
 * t799-drawer-scroll-tabstops-unit — the companion's two scrollables
 * learn the t798 law: the transcript log and the session history list
 * gain the tab stop.
 *
 * The recon, prompted by the t798 tail's first non-build-day candidate
 * ("is the drawer's row loop arrow-key navigable or Tab-only?"): the
 * row loop's Tab-only face is LEGITIMATE — four buttons per row (switch,
 * delete, rename, export) is the compound-row shape, and arrows would
 * need a roving tabindex to have something to say. The REAL wound sat
 * one layer down: BOTH scrollable regions of the companion — the
 * transcript (role="log", the drawer's primary content) and the session
 * history list (role="list") — had overflow and NO tab stop. The t798
 * law says it plainly: a scrollable region without a tab stop answers
 * the wheel and nothing else. The transcript is the sharpest case: a
 * long text-only conversation has NO tabbable below the fold, so the
 * keyboard could not reach yesterday's turns at all.
 *
 * The cure (one file, two regions, one law): each scrollable gains
 * tabIndex={0} + the visible ring (the storage runs dialect, verbatim
 * in spirit). The transcript keeps role="log" + aria-live="polite"; the
 * list keeps role="list" — the rows' listitem semantics hang off it.
 * A tab stop and a log/list role are not rivals. The row loop itself
 * stays Tab-only ON PURPOSE, and the verdict says so.
 *
 *   A  the transcript's tab stop — the cure, the ring, the log's role
 *      and live semantics intact, the verdict comment on file.
 *   B  the session list's tab stop — the cure, the ring, the list role
 *      intact, the same law stated once.
 *   C  the row loop's honesty — Tab-only ON PURPOSE is written down;
 *      the compound row's four buttons stand; no roving tabindex crept
 *      in; the search input's Escape veto is untouched.
 *   D  the elders' regression — t798's dialect in the storage dialog,
 *      the scroll memory in ui/dialog, t797's hand-back and layering,
 *      t430's search law, the companion contract.
 *   E  the verdict notes — the wheel-only verdict, the no-tabbable
 *      honesty, exactly two tab stops (scoped, no blanket).
 *   F  the history — the roster's 2672 region (the dialect's first
 *      speaker), the t383 cap, the t501 yield, the t796 exemption,
 *      the t500 floating face.
 *
 * Run:  node scripts/t799-drawer-scroll-tabstops-unit.mjs
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
const storage = read("src/components/workflow/storage-dialog.tsx");
const dialog = read("src/components/ui/dialog.tsx");
const dash = read("src/components/workflow/project-dashboard.tsx");

/* the transcript slice — from the t799 comment to the log's aria-label */
const trStart = panel.indexOf("t799 — the transcript is the drawer's primary scrollable");
const trEnd = panel.indexOf('aria-label="AI assistant transcript"', trStart);
const tr = trStart >= 0 && trEnd > trStart ? panel.slice(trStart, trEnd) : "";
ok(tr.length > 300, "SLICE transcript region isolated");

/* the drawer list slice */
const lsStart = panel.indexOf("t799 — the same law for the drawer's own list");
const lsEnd = panel.indexOf('aria-label="Session history"', lsStart);
const ls = lsStart >= 0 && lsEnd > lsStart ? panel.slice(lsStart, lsEnd) : "";
ok(ls.length > 200, "SLICE session list region isolated");

/* ------------------------------------------------------------------ */
/* A — the transcript's tab stop                                        */
/* ------------------------------------------------------------------ */

ok(
  /ref=\{scrollRef\}\s*\n\s*onScroll=\{handleScroll\}\s*\n\s*tabIndex=\{0\}/.test(tr),
  "A1 the transcript log gains the tab stop — right behind its own ref"
);
ok(
  tr.includes('className="h-full space-y-3 overflow-y-auto px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"'),
  "A2 the ring rides the transcript — the stop is visible, the wheel-only era ends here too"
);
ok(
  /role="log"\s*\n\s*aria-live="polite"/.test(tr),
  "A3 the log keeps its role and its aria-live — a tab stop and a log role are not rivals"
);
ok(
  tr.includes("the t798 law — the storage runs region learned it"),
  "A4 the verdict names the law's home — the dialect was taught one window ago"
);
ok(
  tr.includes("A long text-only conversation has NO tabbable") &&
    tr.includes("below the fold, so the keyboard could not reach"),
  "A5 the text-only honesty is on file — the wound's sharpest face"
);

/* ------------------------------------------------------------------ */
/* B — the session list's tab stop                                      */
/* ------------------------------------------------------------------ */

ok(
  /tabIndex=\{0\}\s*\n\s*className="max-h-56 space-y-1 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary\/50"/.test(ls),
  "B1 the session list gains the tab stop — the t383 sibling shape (max-h cap + overflow)"
);
ok(
  ls.includes('role="list"') &&
    panel.slice(lsStart).includes('aria-label="Session history"'),
  "B2 the list keeps its role and its name — the rows' listitem semantics hang off it"
);
ok(
  ls.includes("the t798 runs\n                dialect"),
  "B3 the same law, stated once more at its second home"
);
ok(
  ls.includes("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"),
  "B4 the ring rides the list too"
);
ok(
  panel.indexOf("max-h-56") > -1 &&
    /max-h-56 space-y-1 overflow-y-auto focus-visible/.test(panel),
  "B5 the max-h-56 cap holds — the drawer's own height law is untouched"
);

/* ------------------------------------------------------------------ */
/* C — the row loop's honesty                                           */
/* ------------------------------------------------------------------ */

ok(
  ls.includes("the row loop itself stays Tab-only") &&
    ls.includes("arrows would need a roving tabindex"),
  "C1 the Tab-only verdict is WRITTEN DOWN — a deliberate shape, not an omission"
);
ok(
  panel.includes("onClick={() => void switchSession(s.id)}") &&
    panel.includes('aria-label={`删除会话：') &&
    panel.includes('aria-label={`重命名会话：') &&
    panel.includes('aria-label={`导出会话：'),
  "C2 the compound row's four faces stand — switch, delete, rename, export"
);
ok(
  !panel.includes("aria-activedescendant") &&
    (panel.match(/role="listitem"/g) || []).length === 1,
  "C3 no roving machinery crept in — one listitem role, no activedescendant"
);
ok(
  panel.includes('data-session-search=""') &&
    panel.includes("a live query is cleared first, an empty\n                      // query lets the close proceed"),
  "C4 the search input's Escape veto stands verbatim — the t430 grammar untouched"
);

/* ------------------------------------------------------------------ */
/* D — the elders' regression                                           */
/* ------------------------------------------------------------------ */

ok(
  /tabIndex=\{0\}\s*\n\s*role="region"\s*\n\s*aria-label="Storage contents — disk totals and run directories"/.test(storage),
  "D1 t798's runs region stands — the dialect's previous speaker"
);
ok(
  dialog.includes("scrollMemoryRef") &&
    dialog.includes('root.addEventListener("scroll", onScroll, { capture: true, passive: true })'),
  "D2 t798's scroll memory stands — the place law and the reachability law share one family now"
);
ok(
  panel.includes("closeWithHandBack") &&
    panel.includes("layered-Esc law, rename edition"),
  "D3 t797's companion surgery stands — the hand-back and the layered Esc ride above the new tab stops"
);
ok(
  panel.includes("filterSessions(sessions, sessionQuery)") &&
    panel.includes("groupSessionsByDay(visibleSessions)") &&
    panel.includes("matchIndex(display, sessionQuery)"),
  "D4 t430's search + grouping + highlight law stands"
);
ok(
  panel.includes('data-companion-window=""') && panel.includes('data-ai-assistant=""'),
  "D5 the companion contract's two names stand on the root"
);
ok(
  panel.includes("onKeyDown={onWindowKeyDown}") &&
    panel.includes("onPointerDownCapture={onRootPointerDownCapture}"),
  "D6 the t500 floating face's handlers stand — the tab stops change nothing about the close grammar"
);

/* ------------------------------------------------------------------ */
/* E — the verdict notes                                                */
/* ------------------------------------------------------------------ */

ok(
  panel.includes("a\n              scrollable region without a tab stop answers the wheel and\n              nothing else"),
  "E1 the wheel-only verdict is on file at the transcript"
);
ok(
  (panel.match(/tabIndex=\{0\}/g) || []).length === 2,
  "E2 exactly two tab stops — the cure is scoped to the two scrollables, no blanket tabindex"
);
ok(
  panel.includes("are not rivals"),
  "E3 the role-compatibility verdict is on file — stop and role coexist"
);
ok(
  tr.includes("Focused, the arrows and Space scroll it") &&
    ls.includes("the compound-row face"),
  "E4 the keyboard contract named at both regions — arrows/Space scroll the focused scrollable; rows stay Tab-only"
);

/* ------------------------------------------------------------------ */
/* F — the history                                                      */
/* ------------------------------------------------------------------ */

ok(
  dash.includes("tabIndex={0}") && dash.includes('role="region"') && dash.includes("Jobs roster"),
  "F1 the roster's 2672 region stands — the dialect's first speaker, two cures downstream and still honest"
);
ok(
  dialog.includes("t383 — max-h + overflow") &&
    dialog.includes("max-h-[calc(100dvh-2rem)]"),
  "F2 the t383 height law stands in the dialog — the cap that makes inner scroll regions the places to reach"
);
ok(
  dialog.includes("modal={modal ?? !companionOpen}"),
  "F3 the t501 yield law stands — the companion is not a dialog and answers to no Radix flip"
);
ok(
  dialog.includes("t796 — the live zones are not the outside world"),
  "F4 the t796 live-zone exemption stands"
);
ok(
  panel.includes("const renderSessionRow") &&
    panel.indexOf("renderSessionRow") < panel.indexOf("if (!open) return null;"),
  "F5 the shared row renderer stands — one row, both renderings (the t430 extraction)"
);
ok(
  (panel.match(/role="list"/g) || []).length === 1 &&
    (panel.match(/role="log"/g) || []).length === 1,
  "F6 one list, one log — the companion's semantic map stays simple"
);

/* ------------------------------------------------------------------ */
/* receipt                                                              */
/* ------------------------------------------------------------------ */

const label = "t799-drawer-scroll-tabstops-unit";
if (fail === 0) {
  console.log(`${label}: ALL PASS ${pass}/${pass}`);
} else {
  console.error(`${label}: ${fail} FAILED of ${pass + fail}`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(1);
}
