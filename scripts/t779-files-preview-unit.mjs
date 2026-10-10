/**
 * t779-files-preview-unit — the Files tab's peek doors: the tail preview
 * and the STAR table come to the inspector (the third door-set family).
 *
 * History: the results view speaks two preview laws (Logs & reports ->
 * the 64 KB tail through TextPreview; STAR files -> the structured
 * StarTable); the job inspector's Files tab offered only the raw
 * download — a pilgrimage to a browser tab for what is a 64 KB tail
 * read. t779 extracts TextPreview into its own home (the extraction
 * law: a component moves when a SECOND family needs it) and mounts both
 * doors on the Files tab's textual rows. A sidecar cure: the results
 * grid's re-seat effect was the cascading-render trap the lint rule
 * names — the roving anchor is DERIVED now, same law, lighter body.
 *
 * A: the extraction + the wiring — text-preview.tsx exists with the
 *    keyboard face (focusable pre that takes the focus, copy row), both
 *    consumers import it one-name-one-home, the inspector's View column
 *    gates on the two textual kinds with the reveal grammar, the two
 *    dialogs speak the results view's word forms verbatim, the
 *    download door stays for mrc/image rows.
 * B: the route laws the doors speak — format=text with the isTextual
 *    guard and the 64 KB tail constant, the classify fallback that makes
 *    the error face necessary and honest.
 * C: the ledger — the fetch word form preserved through the extraction,
 *    the stock census pre=post on both touched files, the retired
 *    re-seat word-forms proven GONE, judgment notes leading every block.
 *
 * Run:  node scripts/unit-runner.mjs scripts/t779-files-preview-unit.mjs
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

const tpRaw = readFileSync(path.join(SRC, "components/workflow/results/text-preview.tsx"), "utf8");
const tp = strip(tpRaw);
const rvRaw = readFileSync(path.join(SRC, "components/workflow/results/results-view.tsx"), "utf8");
const rv = strip(rvRaw);
const inspRaw = readFileSync(path.join(SRC, "components/workflow/job-inspector.tsx"), "utf8");
const insp = strip(inspRaw);
const fileRoute = readFileSync(path.join(SRC, "app/api/jobs/[id]/outputs/file/route.ts"), "utf8");
const outputsList = readFileSync(path.join(SRC, "lib/relion/outputs-list.ts"), "utf8");

/* ------------------------------------------------------------------ */
/* A — the extraction + the wiring                                     */
/* ------------------------------------------------------------------ */

// A1 — the extraction: one home, two consumers, no inline copy left
ok(/export function TextPreview\(\{ jobId, path \}: \{ jobId: string; path: string \}\)/.test(tp), "A1 TextPreview exported from its own home");
eq((rv.match(/function TextPreview/g) ?? []).length, 0, "A1 no inline copy left in results-view");
eq((rv.match(/from "\.\/text-preview"/g) ?? []).length, 1, "A1 results-view imports the new home");
eq((insp.match(/from "\.\/results\/text-preview"/g) ?? []).length, 1, "A1 the inspector imports the same home");
ok(/import \{ StarTable \} from "\.\/results\/star-table";/.test(insp), "A1 the inspector rides the StarTable brain the results view already speaks");

// A2 — the keyboard face (t774 lineage: focus must have reachability)
ok(/tabIndex=\{0\}/.test(tp), "A2 the tail is a focusable scroll region");
ok(/preRef\.current\?\.focus\(\);/.test(tp), "A2 the tail TAKES the focus when it lands");
ok(/if \(text !== null\) preRef\.current\?\.focus\(\);/.test(tp), "A2 the focus rides the ready state (not the mount)");
ok(/outline-none focus-visible:ring-2 focus-visible:ring-running-600\/60/.test(tp), "A2 the focus ring is visible (the arrival has a receipt)");
ok(/aria-label="File content preview"/.test(tp), "A2 the region's name verbatim (the results view's contract)");
ok(/max-h-\[55vh\] overflow-auto whitespace-pre-wrap break-words/.test(tp), "A2 the scroll geometry verbatim (one tail, one shape)");

// A3 — the copy affordance: one clipboard dialect, no occlusion
ok(/import \{ CopyButton \} from "@\/components\/workflow\/copy-button";/.test(tp), "A3 CopyButton rides the one-clipboard law (Task 170)");
ok(/<CopyButton text=\{text\} label="Copy" \/>/.test(tp), "A3 the copy row carries the whole tail");
ok(!/absolute right-2 top-2/.test(tp), "A3 no floating occluder — a header row, not an overlay");
ok(/mb-1\.5 flex items-center justify-end/.test(tp), "A3 the header row layout (copy above, tail below)");

// A4 — the inspector's View column: the peek door per textual row
ok(/<th scope="col" className="w-12 px-2 py-2 text-right">View<\/th>/.test(insp), "A4 the View column header (between Size and Get)");
ok(/f\.kind === "star" \|\| f\.kind === "text" \? \(/.test(insp), "A4 the gate: exactly the two textual kinds");
ok(/aria-label=\{`Preview \$\{f\.name\}`\}/.test(insp), "A4 the door's honest name");
ok(/<Eye className="size-3\.5" \/>/.test(insp), "A4 the Eye rides the peek button");
ok(/onClick=\{\(\) => \(f\.kind === "star" \? setStarFile\(f\) : setTextFile\(f\)\)\}/.test(insp), "A4 the split law: star -> structured, text -> tail");
ok(/className="size-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover-none:opacity-100"/.test(insp), "A4 the reveal grammar verbatim (hover, focus-visible, hover-none)");

// A5 — the dialogs: the results view's word forms, verbatim
ok(/<Dialog open=\{textFile !== null\} onOpenChange=\{\(o\) => !o && setTextFile\(null\)\}>/.test(insp), "A5 the text dialog's open contract");
ok(/className="max-w-3xl sm:max-w-3xl"/.test(insp), "A5 the text dialog's geometry verbatim");
ok(/<ScrollText className="h-4 w-4 text-warning-600" aria-hidden="true" \/>/.test(insp), "A5 the text dialog's ScrollText warning face");
ok(/\{textFile\.path\} · last 64 KB/.test(insp), "A5 the tail notice in the description");
ok(/<StarTable job=\{job\} path=\{starFile\.path\} \/>/.test(insp), "A5 the star dialog mounts the structured law");
ok(/<Table2 className="h-4 w-4 text-violet-600" aria-hidden="true" \/>/.test(insp), "A5 the star dialog's Table2 violet face");
eq((insp.match(/onKeyDown=\{onEscapeClose\(\(\) => set(Text|Star)File\(null\)\)\}/g) ?? []).length, 2, "A5 both doors consume Escape (Radix owns the trap, onEscapeClose owns the key)");

// A6 — the download door: untouched for the bytes-shaped kinds
ok(/aria-label=\{\`Download \$\{f\.name\}\`\}/.test(insp), "A6 the Download door keeps its name");
ok(/format=raw/.test(insp), "A6 the raw channel keeps the binary pilgrimage (mrc/image)");

/* ------------------------------------------------------------------ */
/* B — the route laws the doors speak                                  */
/* ------------------------------------------------------------------ */

// B1 — the tail route: the guard, the constant, the honest 400 face
ok(/const TEXT_TAIL = 64 \* 1024;/.test(fileRoute), "B1 the 64 KB tail constant verbatim");
ok(/if \(format === "text"\) \{/.test(fileRoute), "B1 the format=text branch exists");
ok(/if \(!isTextual\) \{/.test(fileRoute), "B1 the isTextual guard gates the branch");
ok(/"Text preview is for log\/text files"/.test(fileRoute), "B1 the honest 400 face for non-textual asks");
ok(
  fileRoute.includes('!isMrc && !isImage && (lower.endsWith(".star") || /\\.(log|txt|out|err|json|bild|dat|xml|com|lst|coord)$/i.test(lower))'),
  "B1 isTextual's extension law verbatim (STAR included — the tail law's reach)"
);

// B2 — the classify law: why the error face must exist
ok(/return "text";\n\}/.test(outputsList.replace(/\r/g, "")) || /return "text";\s*\n\}/.test(outputsList), "B2 classify's fallback is 'text' (unknown extensions ride the text kind)");
ok(/error \? err instanceof Error \? err\.message : "Failed to load file"|setError\(err instanceof Error \? err\.message : "Failed to load file"\)/.test(tp), "B2 the door's failure face: the route's verdict rendered inline, honestly");
ok(/if \(error\) \{/.test(tp), "B2 the error branch leads (before the spinner, before the tail)");

/* ------------------------------------------------------------------ */
/* C — the ledger                                                      */
/* ------------------------------------------------------------------ */

// C1 — the extraction fidelity: the fetch contract preserved verbatim
ok(
  /`\/api\/jobs\/\$\{jobId\}\/outputs\/file\?path=\$\{encodeURIComponent\(path\)\}&format=text`/.test(tp),
  "C1 the fetch word form survived the move byte-for-byte"
);
ok(/let cancelled = false;/.test(tp) && /cancelled = true;/.test(tp), "C1 the cancellation contract survived the move");
ok(/setText\(null\);\n    setError\(null\);/.test(tp) || /setText\(null\);/.test(tp), "C1 the stale-state reset survived the move");

// C2 — the stock census holds pre=post on both touched files
const count = (s, re) => (s.match(re) ?? []).length;
for (const f of ["src/components/workflow/results/results-view.tsx", "src/components/workflow/job-inspector.tsx"]) {
  const pre = strip(execSync(`git show HEAD:${f}`, { encoding: "utf8" }));
  const post = strip(readFileSync(path.join(ROOT, f), "utf8"));
  const metrics = {
    glue: /\{" "\}/g,
    truncate: /\btruncate\b/g,
    storage: /localStorage|sessionStorage/g,
    hex: /#[0-9a-fA-F]{3,8}\b/g,
  };
  for (const [k, re] of Object.entries(metrics)) {
    eq(count(post, re), count(pre, re), `C2 ${path.basename(f)} ${k} pre=post (${count(pre, re)})`);
  }
}

// C3 — the re-seat effect's retirement is real (the lint cure kept it cured)
ok(!/setActivePath\(shown\[0\]\?\.path \?\? null\)/.test(rv), "C3 the synchronous re-seat write is GONE (the trap stays empty)");
ok(!/activePath \?\? shown\[0\]\?\.path/.test(rv), "C3 the old tabIndex fallback is GONE (the derivation owns it)");
ok(!/\}, \[shown, activePath\];/.test(rv), "C3 the effect itself is gone (no deps array, no body)");
ok(/const anchorPath =\n    activePath != null && shown\.some\(\(f\) => f\.path === activePath\)/.test(rv), "C3 the derivation lives (the anchor survives the listing)");
ok(/tabIndex=\{f\.path === anchorPath \? 0 : -1\}/.test(rvRaw), "C3 the tabIndex rides the derived anchor");
ok(/setActivePath\(target\);/.test(rv), "C3 the focus write survives (event handlers may set state)");

// C4 — the judgment notes lead every block
ok(tpRaw.includes("Task 779 — extracted from"), "C4 the extraction note leads the new home");
ok(tpRaw.includes("the extraction law: a component moves when a SECOND family needs it"), "C4 the extraction law verbatim");
ok(inspRaw.includes("t779 — the peek doors' state"), "C4 the inspector's door note leads");
ok(rvRaw.includes("t779 — the roving anchor is DERIVED, not mirrored"), "C4 the derivation note leads");
ok(inspRaw.includes("the peek door: textual rows preview in-app"), "C4 the row door's note leads");

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

const label = "t779-files-preview-unit";
if (fail === 0) {
  console.log(`${label}: ${pass}/${pass} PASS`);
} else {
  console.error(`${label}: ${pass}/${pass + fail} PASS, ${fail} FAIL`);
  for (const f of fails) console.error(`  FAIL ${f}`);
  process.exit(1);
}
