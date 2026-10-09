/**
 * t780-log-keyboard-unit — the engine log's reading face becomes a
 * focusable scroll region (the Log tab's keyboard face, the tail
 * preview's twin lesson).
 *
 * History: the inspector's Log tab streamed RELION's engine log into a
 * dark console whose reading face was pointer-only — a scroll region no
 * key could reach. t780 makes the console a focusable scroll region
 * (tabIndex 0, the inset ring that survives the shell's overflow-hidden)
 * with Home/End as the two explicit jumps a log reader actually wants,
 * arrows and PageUp/PageDown left NATIVE — and both the native scrolls
 * and the jumps feed the SAME onScroll law the wheel feeds: landing at
 * the tail re-arms follow, leaving it dis-arms. No second follow system.
 * The shortcuts dialog gains the log-console group (a live key layer no
 * row names is the t641 drift again).
 *
 * Relay note: the surgery landed via the previous executor's framework
 * commit (f076f348, no worklog entry — the relay archaeology); this
 * probe is the completion's receipt, run by the NEXT executor.
 *
 * A: the keyboard face's wiring — the console div is focusable with the
 *    log role and its name, the key handler rides the SAME div the
 *    scroll ref rides, the ring is INSET (the outer ring would clip
 *    against the shell's overflow-hidden), Home/End are explicit
 *    preventDefault jumps, and nothing else is intercepted (arrows stay
 *    native — the platform's scroll on a focused container is the right
 *    gesture).
 * B: the follow law's unity — the 40px at-bottom judge, the auto-scroll
 *    effect gated on BOTH follow and the at-bottom ref, the "no second
 *    follow system" verdict note, and the filter input living outside
 *    the console element so typing never meets the key handler.
 * C: the shortcuts dialog's log-console group + the ledger — the group
 *    id/label/hint, the two rows verbatim (native scroll row + the
 *    Home/End row that names the re-arm), the t641 drift note, and the
 *    stock census pre=post on both touched files (the relay's promise:
 *    the surgery added a group and a face, nothing else moved).
 *
 * Run:  node scripts/unit-runner.mjs scripts/t780-log-keyboard-unit.mjs
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "src");

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
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const strip = (s) =>
  s
    .split("\n")
    .map((l) => {
      const i = l.indexOf("//");
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join("\n");

const inspRaw = readFileSync(path.join(SRC, "components/workflow/job-inspector.tsx"), "utf8");
const insp = strip(inspRaw);
const scRaw = readFileSync(path.join(SRC, "components/workflow/shortcuts-dialog.tsx"), "utf8");
const sc = strip(scRaw);
// the raw channels: the verdict notes live in COMMENTS — strip() would
// silence exactly the voices this probe is here to hear (t779 C4's
// mirror: judge comment word-forms on the raw text, whitespace-normalized)
const norm = (s) => s.replace(/\s+/g, " ");
const inspRawN = norm(inspRaw);
const scRawN = norm(scRaw);

/* ------------------------------------------------------------------ */
/* A — the keyboard face's wiring                                      */
/* ------------------------------------------------------------------ */

// A1 — the console element: focusable, log role, honest name
ok(/tabIndex=\{0\}/.test(insp), "A1 the console carries tabIndex 0");
ok(/role="log"/.test(insp), "A1 the console carries the log role");
ok(/aria-label="Engine log"/.test(insp), "A1 the console's aria name verbatim");

// A2 — the handler rides the SAME div the scroll ref rides (one element,
// not a wrapper — the key handler must meet the scroller itself)
{
  const m = insp.match(/<div\s+ref=\{scrollRef\}[\s\S]{0,200}?onKeyDown=\{onLogKeyDown\}/);
  ok(!!m, "A2 onKeyDown rides the scrollRef div (within 200 chars of the ref)");
  ok(/onScroll=\{onScroll\}/.test(insp), "A2 the wheel's onScroll rides the same div");
}

// A3 — the ring is INSET: the outer ring would clip against the shell's
// overflow-hidden and never be seen (the comment's lesson, the class's law)
ok(/focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-running-500\/60/.test(insp),
  "A3 the focus ring: ring-2, INSET, running-500/60 verbatim");
ok(/outline-none\s+focus-visible:ring-2 focus-visible:ring-inset/.test(insp.replace(/\s+/g, " ")),
  "A3 outline-none gives the inset ring the only focus voice");

// A4 — Home/End are the two explicit jumps, each preventDefault'd
ok(/if \(e\.key === "Home"\)\s*\{\s*e\.preventDefault\(\);\s*el\.scrollTop = 0;/.test(insp),
  "A4 Home preventDefaults and jumps to the head (scrollTop 0)");
ok(/else if \(e\.key === "End"\)\s*\{\s*e\.preventDefault\(\);\s*el\.scrollTop = el\.scrollHeight;/.test(insp),
  "A4 End preventDefaults and jumps to the tail (scrollHeight)");

// A5 — nothing else intercepted: arrows and PageUp/PageDown stay native.
// The handler must NOT mention any other key name.
{
  const handler = insp.match(/const onLogKeyDown = \(e: React\.KeyboardEvent\) => \{[\s\S]*?\n  \};/);
  ok(!!handler, "A5 the onLogKeyDown handler exists");
  const body = handler ? handler[0] : "";
  eq((body.match(/Arrow|Page/g) ?? []).length, 0,
    "A5 the handler intercepts NO arrow or Page key (native stays native)");
  eq((body.match(/preventDefault/g) ?? []).length, 2, "A5 exactly two preventDefaults (Home, End)");
}

/* ------------------------------------------------------------------ */
/* B — the follow law's unity                                          */
/* ------------------------------------------------------------------ */

// B1 — the 40px judge the wheel and the keyboard BOTH feed
ok(/scrollHeight - el\.scrollTop - el\.clientHeight < 40/.test(insp),
  "B1 the at-bottom judge (< 40px) lives in onScroll");

// B2 — the auto-scroll effect gated on BOTH follow and the ref: a user
// scrolled up must not be yanked down by the next poll commit
ok(/if \(!follow\) return;\s*const el = scrollRef\.current;\s*if \(!el \|\| !atBottomRef\.current\) return;/.test(insp),
  "B2 the auto-scroll effect gates on follow AND the at-bottom ref");

// B3 — the verdict note: one follow system, the keyboard rides the wheel
// (a COMMENT voice — judged on the raw channel)
ok(/No second follow system/.test(inspRaw), "B3 the verdict note 'No second follow system' present");
ok(/keyboard rides the wheel's law/.test(inspRawN),
  "B3 the 'keyboard rides the wheel's law' phrase present");

// B4 — the filter input lives OUTSIDE the console element: typing the
// filter's Home/End must never meet the console's jump handler
ok(/typing never meets this handler/.test(inspRawN),
  "B4 the comment names the boundary: typing never meets this handler");
{
  // the filter input (setQuery lives on an <input> whose value is query)
  // must appear BEFORE the console div in the file (toolbar above console)
  const inputAt = insp.indexOf("value={query}");
  const consoleAt = insp.indexOf("ref={scrollRef}");
  ok(inputAt > 0 && consoleAt > 0 && inputAt < consoleAt,
    "B4 the filter input is toolbar chrome (before the console div)");
  ok(!/onKeyDown=\{onLogKeyDown\}[\s\S]{0,400}value=\{query\}/.test(insp),
    "B4 the key handler never wraps the filter input");
}

/* ------------------------------------------------------------------ */
/* C — the shortcuts dialog's group + the ledger                       */
/* ------------------------------------------------------------------ */

// C1 — the group exists with its identity
ok(/id: "log-console"/.test(sc), "C1 the log-console group id present");
ok(/label: "Log console"/.test(sc), "C1 the group label verbatim");
ok(/Inside the job inspector's Log tab/.test(sc), "C1 the hint names the door (Log tab)");

// C2 — the two rows verbatim
ok(/\{ keys: "↑ ↓ PgUp PgDn", text: "Scroll the log natively once the console holds the focus \(Tab reaches it\)" \}/.test(sc),
  "C2 row one: native scroll + Tab reaches it, verbatim");
ok(/\{ keys: "Home End", text: "Jump to the window's head \/ tail — landing at the tail re-arms follow" \}/.test(sc),
  "C2 row two: Home End + the re-arm promise, verbatim");

// C3 — the t641 drift note leads the group: a live key layer no row
// names is the drift the family already cured once
ok(/the t641 drift again/.test(scRawN), "C3 the t641 drift note leads the group");

// C4 — the row count: exactly two rows (the face has exactly two laws)
{
  const g = sc.match(/id: "log-console"[\s\S]*?rows: \[([\s\S]*?)\],/);
  ok(!!g, "C4 the log-console group block found");
  const rows = g ? (g[1].match(/\{ keys:/g) ?? []).length : 0;
  eq(rows, 2, "C4 exactly two shortcut rows");
}

/* ------------------------------------------------------------------ */
/* D — the ledger: the relay's promise (stock census pre=post)         */
/* ------------------------------------------------------------------ */

// D1 — the surgery's only inspector additions are the keyboard face and
// its notes: the LogConsole function body gained onLogKeyDown + tabIndex
// + the comments, and NOTHING ELSE moved. Pin the neighbors' word forms:
ok(/const \[log, setLog\] = React\.useState<string \| null>\(null\);/.test(insp),
  "D1 the log state word form untouched");
ok(/const \[noLog, setNoLog\] = React\.useState\(false\);/.test(insp),
  "D1 the noLog state word form untouched");
ok(/const \[totalLines, setTotalLines\] = React\.useState\(0\);/.test(insp),
  "D1 the totalLines state word form untouched");
ok(/const \[follow, setFollow\] = React\.useState\(true\);/.test(insp),
  "D1 the follow state word form untouched");
ok(/const \[wrap, setWrap\] = React\.useState\(false\);/.test(insp),
  "D1 the wrap state word form untouched");
ok(/const \[query, setQuery\] = React\.useState\(""\);/.test(insp),
  "D1 the filter query state word form untouched");

// D2 — the RELION \r collapse law untouched (the lines memo's job)
ok(/lastIndexOf\("\\r"\)/.test(insp), "D2 the CR collapse law untouched");

// D3 — the download/copy/print neighbors untouched: the keyboard face
// did not come at any neighbor's expense
ok(/data-log-console=/.test(insp), "D3 the print re-ink hook survives");
ok(/aria-pressed=\{follow\}/.test(insp), "D3 the follow toggle survives");

// D4 — the verdict notes lead their blocks (five in the surgery zone)
ok(/the console's keyboard face: Home jumps to the window's head/.test(inspRawN),
  "D4 the keyboard-face verdict note leads its block");
ok(/the reading face is focusable/.test(inspRawN),
  "D4 the reading-face verdict note leads the console div");
ok(/reachability IS the destination/.test(inspRawN),
  "D4 the twin-lesson phrase (t779's law) present");

// D5 — the group sits in SHORTCUT_GROUPS (the one registry), not a
// second list
ok(/export const SHORTCUT_GROUPS: ShortcutGroup\[\]/.test(sc),
  "D5 the registry export unchanged (one registry)");

/* ------------------------------------------------------------------ */

console.log(`t780-log-keyboard-unit: ${pass} pass / ${fail} fail`);
if (fail) {
  fails.forEach((f) => console.log("  FAIL:", f));
  process.exit(1);
}
