/**
 * t781-palette-preview-unit — the command palette's rows grow a PROMISE:
 * a fixed-height strip under the list recites what Enter will do to the
 * highlighted row (the preview-before-commit face — Raycast's promise
 * pane, palette-sized).
 *
 * The architecture is one signal, one reader, zero coupling: cmdk's own
 * store is subscribed by a null-rendered probe (useCommandState — the
 * store's honest ear, it fires on every selected-value change,
 * controlled or NOT, because the uncontrolled root never calls
 * onValueChange props), the parent reads the highlighted row's
 * data-preview-* attributes from the DOM, and the strip merely recites
 * them. The promise is WRITTEN BESIDE the row that can act on it (one
 * writer per row), never in a second map that could drift from the row's
 * own onSelect. The strip is a RECITER, not a mouth: it owns no
 * onSelect, no onClick — Enter's contract lives in the rows above.
 *
 *   A  the signal's wiring — the cmdk import is useCommandState, the
 *      probe renders null, the read is deferred past cmdk's commit, the
 *      selector is the aria-selected row, the attrs are read by
 *      getAttribute, the thumb is the row's own inline data-URL img,
 *      and the honest empty (no highlighted row) recites null.
 *   B  the strip — one data-palette-preview registry, role=status, the
 *      fixed height (min-h-9 shrink-0 — filtering never shifts the
 *      dialog), the keys hint for the empty state, the label/hint/thumb
 *      render slots, and the reciter's purity (no onSelect/onClick in
 *      the strip block).
 *   C  the promise coverage — every row family's hint word-form (jobs,
 *      notes, class notes, the three walls, saved views, run, the three
 *      preset faces, projects/workspaces with the honest already-active
 *      law, the chart pair, engine, the app actions), the dynamic
 *      labels (spotlight/theme/dashboard ternaries), and the SEARCH
 *      CONTRACT verbatim (value templates untouched — t752's law: the
 *      promise is decor and ear, never a filter word).
 *   D  the ledger — pourKindsOf reader count (t758's interlock), the
 *      t752/t753 water-dot residents, the t674/t670 rename+delete
 *      mouths, the t668 storage handshake (exactly one setItem, the
 *      pre-existing resident), and the verdict notes leading their
 *      blocks on the raw channel.
 *
 * Run:  node scripts/t781-palette-preview-unit.mjs
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
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const cpRaw = readFileSync(path.join(ROOT, "src/components/workflow/command-palette.tsx"), "utf8");
const strip = (s) =>
  s
    .split("\n")
    .map((l) => {
      const i = l.indexOf("//");
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join("\n");
const cp = strip(cpRaw);
// the raw channel: verdict notes live in COMMENTS — strip() would
// silence exactly the voices this probe is here to hear (t779 C4 / t780
// lessons: judge comment word-forms on the raw text, whitespace-normalized)
const norm = (s) => s.replace(/\s+/g, " ");
const cpRawN = norm(cpRaw);

/* ------------------------------------------------------------------ */
/* A — the signal's wiring                                             */
/* ------------------------------------------------------------------ */

// A1 — the store's honest ear: useCommandState comes from cmdk (the
// uncontrolled root never fires the onValueChange prop — reading the
// props would be reading a line that never rings)
ok(/import \{ useCommandState \} from "cmdk";/.test(cp),
  "A1 useCommandState imported from cmdk (the store's own ear)");

// A2 — the probe component: named, null-rendered, subscribed
ok(/function PalettePreviewProbe\(\{ onSelectedValueChange \}:/.test(cp),
  "A2 the probe component exists (named, one prop)");
ok(/const selectedValue = useCommandState\(\(s\) => s\.value\);/.test(cp),
  "A2 the probe subscribes to the selected value");
ok(/return null;\n\}/.test(cp),
  "A2 the probe renders null (zero visual footprint)");

// A3 — the effect reports through a stable callback
ok(/React\.useEffect\(\(\) => \{\n    onSelectedValueChange\(selectedValue\);\n  \}, \[selectedValue, onSelectedValueChange\]\);/.test(cp),
  "A3 the effect reports on every selected-value change (deps verbatim)");

// A4 — the read is deferred past cmdk's own commit (store updates
// BEFORE the aria-selected attributes land)
ok(/setTimeout\(handleSelectedValueChange, 0\);/.test(cp),
  "A4 the DOM read is deferred past cmdk's render commit");

// A5 — the selector is the aria-selected row, the attrs are read by name
ok(/document\.querySelector\("\[cmdk-item\]\[aria-selected='true'\]"\)/.test(cp),
  "A5 the reader queries the highlighted row by aria-selected");
ok(/row\.getAttribute\("data-preview-label"\)/.test(cp),
  "A5 the label is read from the row's own attribute");
ok(/row\.getAttribute\("data-preview-hint"\)/.test(cp),
  "A5 the hint is read from the row's own attribute");

// A6 — the thumb is the row's own inline data-URL img (no second fetch —
// the saved-view thumb and the t663 gallery family already carry one)
ok(/row\.querySelector\("img\[src\^='data:'\]"\)/.test(cp),
  "A6 the thumb rides the row's own inline img (data-URL only)");
ok(/thumb instanceof HTMLImageElement \? thumb\.getAttribute\("src"\) : null,/.test(cp),
  "A6 the thumb read is type-guarded");

// A7 — the honest empty: no highlighted row recites null (the strip
// never promises a row that isn't there)
ok(/if \(!row\) \{\n      setPreview\(null\);\n      return;\n    \}/.test(cp),
  "A7 no highlighted row recites null");
ok(/if \(label == null && hint == null\) \{\n      setPreview\(null\);\n      return;\n    \}/.test(cp),
  "A7 an attr-less row recites null (the empty is honest twice)");

// A8 — the probe is mounted INSIDE the Command tree (useCommandState
// needs the context) with the stable handler
ok(/<PalettePreviewProbe onSelectedValueChange=\{onSelectedValueChange\} \/>/.test(cp),
  "A8 the probe rides inside the CommandDialog");
ok(/const onSelectedValueChange = React\.useCallback\(/.test(cp),
  "A8 the report handler is a stable callback");

/* ------------------------------------------------------------------ */
/* B — the strip                                                       */
/* ------------------------------------------------------------------ */

// slice discipline (t748's lesson: an assertion = word form × ground):
// the strip slice runs from the strip's JSX to the probe mount
const stripStart = cp.indexOf('<div\n        data-palette-preview=""');
const stripEnd = cp.indexOf("<PalettePreviewProbe", stripStart);
const stripBlock = stripStart >= 0 && stripEnd > stripStart ? cp.slice(stripStart, stripEnd) : "";

// B1 — ONE registry (one reciter, never a second preview system)
eq((cp.match(/data-palette-preview=""/g) || []).length, 1,
  "B1 exactly one data-palette-preview registry");
ok(stripBlock.length > 0, "B1 the strip block is locatable");

// B2 — role=status (the screen reader hears the promise as arrows move)
ok(/role="status"/.test(stripBlock), "B2 the strip is a status region");

// B3 — the fixed height: filtering never shifts the dialog's layout
ok(/min-h-9 shrink-0/.test(stripBlock), "B3 the strip's height is fixed (min-h-9 shrink-0)");
ok(/border-t bg-muted\/30/.test(stripBlock), "B3 the strip separates from the list");

// B4 — the keys hint: the honest empty state
ok(/data-palette-preview-keys=""/.test(stripBlock),
  "B4 the empty state carries the keys hint anchor");
ok(/↑↓ to move · ↵ to run · Esc to close/.test(stripBlock),
  "B4 the keys hint is verbatim (move · run · close)");

// B5 — the render slots: label, hint, thumb
ok(/data-palette-preview-label=""/.test(stripBlock),
  "B5 the label slot exists");
ok(/\{preview\.label\}/.test(stripBlock), "B5 the label slot recites preview.label");
ok(/data-palette-preview-hint=""/.test(stripBlock), "B5 the hint slot exists");
ok(/\{preview\.hint\}/.test(stripBlock), "B5 the hint slot recites preview.hint");
ok(/data-palette-preview-thumb=""/.test(stripBlock),
  "B5 the thumb slot exists");
ok(/src=\{preview\.thumb\}/.test(stripBlock), "B5 the thumb recites preview.thumb");

// B6 — the ↵ glyph is decor, the words are the substance
ok(/<CornerDownLeft className="size-3\.5 shrink-0 text-muted-foreground\/60" aria-hidden="true" \/>/.test(stripBlock),
  "B6 the ↵ glyph is aria-hidden decor");

// B7 — the reciter's purity: the strip owns no acting (Enter's contract
// lives in the rows above — a strip that could act would be a second
// mouth promising the same doors)
ok(!/onSelect/.test(stripBlock), "B7 the strip owns no onSelect");
ok(!/onClick/.test(stripBlock), "B7 the strip owns no onClick");

/* ------------------------------------------------------------------ */
/* C — the promise coverage                                            */
/* ------------------------------------------------------------------ */

// C1 — every row family carries the promise (36 attr sites; label and
// hint always paired)
eq((cp.match(/data-preview-label=/g) || []).length, 36,
  "C1 36 rows carry the label promise (pre-counted inventory)");
eq((cp.match(/data-preview-hint=/g) || []).length, 36,
  "C1 36 rows carry the hint promise (label and hint paired)");
ok(!/data-preview-hint=\{/.test(cp) || (cp.match(/data-preview-hint=\{/g) || []).length >= 3,
  "C1 dynamic hints are expressions where the promise depends on state");

// C2 — the per-family hint word-forms (slice-judged where the group
// heading gives the ground)
const groupSlice = (heading, endHeading) => {
  const s = cp.indexOf(`<CommandGroup heading=${heading}`);
  if (s < 0) return "";
  // search PAST the opening tag — indexOf at s would hit the group's own
  // `<CommandGroup` prefix and return an empty slice (the self-match
  // trap; +16 clears any `<CommandGroup heading="...">` opening)
  let e = endHeading ? cp.indexOf(endHeading, s + 16) : -1;
  if (e < 0) e = cp.length;
  return cp.slice(s, e);
};
// the multi-line heading groups (template-literal or span headings —
// the single-line `heading="X"` anchor never lands there): anchor on
// the heading EXPRESSION's own words instead, slice to the next group
const exprSlice = (anchor) => {
  const s = cp.indexOf(anchor);
  if (s < 0) return "";
  const e = cp.indexOf("<CommandGroup", s + anchor.length);
  return e < 0 ? cp.slice(s) : cp.slice(s, e);
};
const jobsGroup = groupSlice('"Jobs"', "<CommandGroup");
ok(/data-preview-hint="jump to this job and open its inspector"/.test(jobsGroup),
  "C2 the jobs rows promise the jump-and-inspect");
const recentGroup = exprSlice("Recent jobs</span>");
ok(/data-preview-hint="jump to this job and open its inspector"/.test(recentGroup),
  "C2 the recent rows promise the same jump (one vocabulary)");
const notesGroup = exprSlice("heading={`Notes · ");
ok(/data-preview-hint="jump to the note's job and open its inspector"/.test(notesGroup),
  "C2 the notes rows name the note's job");
const classNotesGroup = exprSlice("heading={`Class notes · ");
ok(/data-preview-hint="open the host job's class gallery on this class"/.test(classNotesGroup),
  "C2 the class-note rows promise the gallery landing");
ok(/data-preview-label=\{`Class \$\{cls\} — \$\{job\.name\}`\}/.test(classNotesGroup),
  "C2 the class-note label carries class AND host");
const galleryGroup = exprSlice("heading={`Frame galleries · ");
ok(/data-preview-hint="land on this job's micrographs wall"/.test(galleryGroup),
  "C2 the frame-gallery rows promise the wall");
const avgGroup = exprSlice("heading={`Class averages · ");
ok(/data-preview-hint="land on the classification's class overview"/.test(avgGroup),
  "C2 the averages rows promise the overview");
const denoiseGroup = exprSlice("heading={`Denoise compare · ");
ok(/data-preview-hint="land on the before\/after wall"/.test(denoiseGroup),
  "C2 the denoise rows promise the before/after wall");
const savedViewGroup = exprSlice("heading={`Saved views · ");
ok(/data-preview-hint=\{`restore this camera view in \$\{v\.jobName\}'s viewer`\}/.test(savedViewGroup),
  "C2 the saved-view rows name the restore destination");
const runGroup = groupSlice('"Run"', "<CommandGroup");
ok(/data-preview-hint="queue this idle job to run"/.test(runGroup),
  "C2 the run rows promise the queue");
const typeGroup = groupSlice('"Add job type"', "<CommandGroup");
ok(/data-preview-hint="place one job of this type on the canvas"/.test(typeGroup),
  "C2 the type rows promise the placement");
const presetGroup = groupSlice('"Add with preset"', "<CommandGroup");
ok(/data-preview-hint=\{`place this type with the \$\{p\.preset\} preset's parameters applied`\}/.test(presetGroup),
  "C2 the curated preset rows name the preset's params");
const userPresetGroup = groupSlice('"Add from your presets"', "<CommandGroup");
ok(/data-preview-hint="place this type with your saved parameters applied"/.test(userPresetGroup),
  "C2 the user preset rows name YOUR params");
const projectsGroup = groupSlice('"Projects"', "<CommandGroup");
ok(/already active — Enter just closes the palette/.test(projectsGroup),
  "C2 the project rows speak the honest already-active law");
const workspacesGroup = groupSlice('"Workspaces"', "<CommandGroup");
ok(/already active — Enter just closes the palette/.test(workspacesGroup),
  "C2 the workspace rows speak the same law");
const exportGroup = exprSlice("heading={`Export chart data · ");
ok(/data-preview-hint="download this chart's rows as a csv file"/.test(exportGroup),
  "C2 the export rows promise the csv download");
const copyGroup = exprSlice("heading={`Copy chart data · ");
ok(/data-preview-hint="copy this chart's rows to the clipboard as tsv"/.test(copyGroup),
  "C2 the copy rows promise the tsv clipboard");

// C3 — the app actions (the single-row groups, judged file-wide: their
// values are the ground)
ok(/data-preview-hint="re-run the environment probe — no restart needed"/.test(cp),
  "C3 the engine row's promise is the probe, not a restart");
ok(/data-preview-hint="place ten pre-wired jobs — import through postprocess"/.test(cp),
  "C3 the template row names the span");
ok(/data-preview-hint="open the find bar — lens every job at once"/.test(cp),
  "C3 the find row names the lens (t134's vocabulary)");
ok(/data-preview-hint="toggle the note spotlight on the canvas"/.test(cp),
  "C3 the spotlight row promises the toggle");
ok(/data-preview-hint="open the shortcuts sheet"/.test(cp),
  "C3 the shortcuts row promises the sheet");
ok(/data-preview-hint="preview the replay script, then download"/.test(cp),
  "C3 the shell-script row keeps the preview-before-download order");
ok(/data-preview-hint="compose the printable report"/.test(cp),
  "C3 the QC report row promises the composition");
ok(/data-preview-hint="open the vitals panel"/.test(cp),
  "C3 the diagnostics row promises the panel");
ok(/data-preview-hint="open the repository in a new tab"/.test(cp),
  "C3 the GitHub row names the tab honesty");
ok(/data-preview-hint="manage SSH connections and job dispatch"/.test(cp),
  "C3 the remote row names the handshake's reach");
ok(/data-preview-hint="toggle the light and dark appearance"/.test(cp),
  "C3 the theme row promises the toggle");

// C4 — the dynamic labels (the promise follows the row's own face)
ok(/data-preview-label=\{\n              noteSpotlight \? "Show all jobs \(spotlight off\)" : "Spotlight noted jobs"\n            \}/.test(cp),
  "C4 the spotlight label follows the row's dynamic face");
ok(/data-preview-label=\{`Switch to \$\{resolvedTheme === "dark" \? "light" : "dark"\} theme`\}/.test(cp),
  "C4 the theme label follows resolvedTheme (same ternary as the row)");
ok(/view === "canvas" \? "Open project dashboard" : "Back to workflow canvas"/.test(cp),
  "C4 the dashboard label follows the view (same ternary as the row)");

// C5 — the SEARCH CONTRACT verbatim (t752's law: the promise is decor
// and ear, never a filter word — the value templates did not move)
ok(/value=\{`job \$\{j\.name\} \$\{j\.type\} \$\{spec\?\.label \?\? ""\} \$\{j\.status\}`\}/.test(cp),
  "C5 the jobs value contract verbatim");
ok(/value=\{`recent job \$\{j\.name\} \$\{j\.type\} \$\{spec\?\.label \?\? ""\} \$\{j\.status\}`\}/.test(cp),
  "C5 the recent value contract verbatim");
ok(/value=\{`add \$\{t\.key\} \$\{t\.label\} \$\{t\.category\}`\}/.test(cp),
  "C5 the type value contract verbatim (t752's slice ground)");
ok(/value=\{`preset add \$\{p\.type\} \$\{t\?\.label \?\? ""\} \$\{p\.preset\} \$\{p\.note\}`\}/.test(cp),
  "C5 the preset value contract verbatim");
ok(/value=\{`preset add your saved \$\{p\.name\} \$\{p\.type\} \$\{t\?\.label \?\? ""\}`\}/.test(cp),
  "C5 the user-preset value contract verbatim (t714's ground)");
ok(/value=\{`saved view 3d bookmark \$\{b\.name\} \$\{v\.jobName\} \$\{v\.jobType\}`\}/.test(cp),
  "C5 the saved-view value contract verbatim");
ok(/value=\{`class note class \$\{cls\} \$\{job\.name\} \$\{job\.type\} \$\{text\}`\}/.test(cp),
  "C5 the class-note value contract verbatim");

/* ------------------------------------------------------------------ */
/* D — the ledger                                                      */
/* ------------------------------------------------------------------ */

// D1 — the t758 interlock: pourKindsOf's reader count is unchanged (the
// promise added ZERO readers — the strip reads attrs, not the lib)
eq((cp.match(/pourKindsOf\(/g) || []).length, 3,
  "D1 pourKindsOf reader count unchanged (3: direct + two gated)");

// D2 — the t752/t753 water-dot residents keep their seats
ok(/data-testid=\{`cmd-pours-\$\{t\.key\}`\}/.test(cp), "D2 the t752 cmd-pours testid survives");
ok(/data-testid=\{`cmd-preset-pours-\$\{p\.type\}-\$\{p\.preset\}`\}/.test(cp),
  "D2 the t753 preset pours testid survives");
ok(/data-testid=\{`cmd-user-pours-\$\{p\.id\}`\}/.test(cp),
  "D2 the t753 user pours testid survives");

// D3 — the saved-view trio's mouths (t674 rename / t670 delete) and the
// t668 handshake (exactly ONE storage write, the pre-existing resident)
ok(/data-palette-savedview-rename-input=\{b\.id\}/.test(cp),
  "D3 the t674 rename input survives");
ok(/data-palette-savedview-delete=\{b\.id\}/.test(cp),
  "D3 the t670 delete anchor survives");
eq((cp.match(/sessionStorage\.setItem\(/g) || []).length, 1,
  "D3 exactly one storage write (the t668 handshake — no second resident)");

// D4 — the verdict notes lead their blocks (raw channel)
ok(/the promise strip's probe: a null-rendered child INSIDE the/.test(cpRawN),
  "D4 the probe's verdict note leads its block");
ok(/the promise strip: what Enter WILL do, recited under the list/.test(cpRawN),
  "D4 the strip-state verdict note leads its block");
ok(/the promise strip: a fixed-height reciter under the list/.test(cpRawN),
  "D4 the strip JSX's verdict note leads its block");
ok(/the signal rides INSIDE the Command tree/.test(cpRawN),
  "D4 the probe-mount note leads its block");
ok(/strip is a RECITER, not a mouth/.test(cpRawN),
  "D4 the reciter's purity law is on the record");

// D5 — the keys-hint span is the empty state's WHOLE content (no stray
// promise alongside the hint). The slice starts AT the keys anchor —
// the thumb ternary's `) : (` sits earlier in the if-branch, so slicing
// from the first ternary seam would swallow the label slot (the
// self-match trap's cousin: anchor on the WORD, not the punctuation)
const emptySlice = stripBlock.slice(
  stripBlock.indexOf("data-palette-preview-keys"),
  stripBlock.indexOf(")}\n      </div>")
);
ok(emptySlice.includes("↑↓ to move") && !emptySlice.includes("preview.label"),
  "D5 the empty state shows only the keys hint (no ghost promise)");

/* ------------------------------------------------------------------ */

console.log(`t781-palette-preview-unit: ${pass} pass / ${fail} fail`);
if (fail) {
  fails.forEach((f) => console.log("  FAIL:", f));
  process.exit(1);
}
