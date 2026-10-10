#!/usr/bin/env node
/**
 * t833 — the keymap family's first seat OUTSIDE results-view, and the
 * census that proves it is the only one.
 *
 * The t832 tail named the seam: "the keymap family outside results-view
 * (the job-report dialog, the settings doors — a census of which dialogs
 * have keys to teach, then the rows that earn their chips)". This probe
 * pays both halves:
 *
 *   - THE SEAT: the session-report dialog joins the family with
 *     data-canvas-ui="report-keymap" — four families in one quiet
 *     10px footer: ← → step the compass sections (t235's map walk,
 *     invisible until now), H and M are the t247 byte mouths (the
 *     export doors already speak them at the point of action; the row
 *     gathers the dialog's whole inventory in one voice), Esc is the
 *     house close. The walk's chips are gated on toc.length > 1 (a
 *     one-section map has no step — the quick-look's single-image
 *     law) and carry their scope in their own words ("Tab in first")
 *     because the walk only works once a section chip has focus — the
 *     family's first focus-scoped keys, taught WITH their reach.
 *
 *   - THE CENSUS: a scripted walk of every dialog host in the tree
 *     for single-letter key handlers (modifier-gated lines excluded —
 *     the palette's ⌘K is an open toggle, not a dialog key). The
 *     verdict: among non-results hosts exactly ONE file answers to
 *     letter keys — the session report. The settings doors (ai
 *     settings, storage, diagnostics, cleanup, hpc editor/sbatch,
 *     path browser, pipeline script, remote cluster, template
 *     presets, params diff, import workflow, type card, help guide,
 *     shortcuts doc) have exactly one key — the house Esc close —
 *     and a door with no keys to teach plants no row (the
 *     must-not-lie law scaling DOWN: a row padding itself with keys
 *     nobody can press is the same lie as a dead chip). If a future
 *     dialog grows a letter key, the census moves, red — the row
 *     then owes its seat.
 *
 * Sections:
 *   A  the report-keymap seat (the row, the gate, the scope, the wires)
 *   B  the census verdict (the only letter-keyed non-results dialog;
 *      the family's seat count)
 *   C  regression guards (the t247 doors, the t235 walk, the t832
 *      seats, the family's earlier rows)
 *   D  the calibre (18 api dirs + route.ts = 19 entries)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
};
const src = (p) => readFileSync(join(ROOT, p), "utf8");

const report = src("src/components/workflow/session-report-dialog.tsx");
const rv = src("src/components/workflow/results/results-view.tsx");
const embed = src("src/components/workflow/results/molstar-embed.tsx");
const ortho = src("src/components/workflow/results/map-ortho-panel.tsx");

/* single-letter key-binding census: a line that binds one letter key
 * WITHOUT a modifier gate on the same line (the palette's ⌘K is an
 * app-level open toggle — the census reads dialog-interior keys) */
const LETTER_KEY = /e\.key === "[a-zA-Z]"|k === "[a-z]"|key\.toLowerCase\(\) === "[a-z]"/;
const MODIFIER = /metaKey|ctrlKey|altKey|shiftKey/;
const letterKeyLines = (text) =>
  text.split("\n").filter((l) => LETTER_KEY.test(l) && !MODIFIER.test(l));

console.log("A — the report-keymap seat");
{
  ok(/data-canvas-ui="report-keymap"/.test(report), "A1 the row exists — data-canvas-ui=\"report-keymap\"");

  const rowIdx = report.indexOf('data-canvas-ui="report-keymap"');
  const rowBlock = rowIdx >= 0 ? report.slice(rowIdx, rowIdx + 1600) : "";
  ok(
    /no-print flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-\[10px\] leading-tight text-muted-foreground/.test(rowBlock),
    "A2 the family calibre — 10px muted footer, flex-wrap, no-print (paper law)",
  );

  ok(
    /\{toc\.length > 1 && \(/.test(rowBlock),
    "A3 the walk's gate — toc.length > 1 (a one-section map has no step; the quick-look's law)",
  );

  ok(
    /step the sections \(Tab in first\)/.test(rowBlock),
    "A4 the scope taught WITH the key — \"step the sections (Tab in first)\" (the family's first focus-scoped keys)",
  );

  ok(
    rowBlock.includes("<Kbd>←</Kbd>") &&
      rowBlock.includes("<Kbd>→</Kbd>") &&
      rowBlock.includes("<Kbd>H</Kbd>") &&
      rowBlock.includes("<Kbd>M</Kbd>") &&
      rowBlock.includes("<Kbd>Esc</Kbd>"),
    "A5 four families in one row — ← → / H / M / Esc, the t642 kbd bones",
  );

  ok(
    /HTML report/.test(rowBlock) && /Markdown report/.test(rowBlock),
    "A6 the byte mouths named in the doors' own words — H HTML report · M Markdown report",
  );

  ok(
    /k === "h"[\s\S]{0,80}exportHtml/.test(report) && /k === "m"[\s\S]{0,80}exportMd/.test(report),
    "A7 the row is WIRED — the t247 listener drives H → exportHtml, M → exportMd",
  );

  ok(
    /onCompassKeyDown[\s\S]{0,400}ArrowRight[\s\S]{0,200}ArrowLeft/.test(report) ||
      /ArrowRight|ArrowLeft/.test(report.slice(report.indexOf("onCompassKeyDown"), report.indexOf("onCompassKeyDown") + 400)),
    "A8 the walk is WIRED — t235's compass handler answers ArrowLeft/ArrowRight",
  );

  ok(
    /<Kbd>Esc<\/Kbd>\s*<span className="ml-1">closes<\/span>/.test(rowBlock),
    "A9 the house close in the family's one voice — Esc · closes (the t832 vocabulary)",
  );
}

console.log("B — the census verdict");
{
  const hosts = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx$/.test(e.name)) hosts.push(p);
    }
  };
  walk("src/components");
  const dialogHosts = hosts.filter((p) => {
    const s = src(p);
    return /<DialogContent|<CommandDialog/.test(s);
  });
  ok(dialogHosts.length >= 30, `B1 dialog hosts enumerated — ${dialogHosts.length} files host a dialog (the census's population)`);

  const isResults = (p) => p.includes("/results/");
  const lettered = dialogHosts.filter((p) => letterKeyLines(src(p)).length > 0);
  const nonResultsLettered = lettered.filter((p) => !isResults(p));
  ok(
    lettered.every((p) => isResults(p) || p.endsWith("session-report-dialog.tsx")),
    `B2 the census's verdict — letter-keyed hosts: ${lettered.map((p) => p.split("/").pop()).join(", ")}; non-results = the session report ONLY`,
  );
  ok(
    nonResultsLettered.length === 1,
    "B3 exactly ONE non-results dialog house answers to letter keys (the settings doors plant no rows — they have nothing to teach beyond the house Esc)",
  );

  const allKeymaps = hosts.map((p) => (src(p).match(/data-canvas-ui="[a-z-]*keymap"/g) ?? []).length).reduce((a, b) => a + b, 0);
  ok(allKeymaps === 6, `B4 the family's seat count — ${allKeymaps} keymap rows tree-wide (results' five + the report's first outside seat)`);
}

console.log("C — regression guards");
{
  ok(
    /title="The Markdown bytes[^"]*or press M"/.test(report) && /or press H/.test(report),
    "C1 the t247 doors keep their point-of-action voices — 'or press M/H' titles on the export buttons",
  );

  ok(
    report.includes('aria-label="Download session report"') && report.includes('aria-label="Download portable HTML report"'),
    "C2 the export doors untouched — the honest a11y names held",
  );

  ok(
    /const onCompassKeyDown = React\.useCallback/.test(report) &&
      /chips\[\(idx \+ \(e\.key === "ArrowRight" \? 1 : chips\.length - 1\)\) % chips\.length\]/.test(report),
    "C3 the t235 walk untouched — the wrapping step arithmetic verbatim",
  );

  ok(
    /data-canvas-ui="star-keymap"/.test(rv) && /data-canvas-ui="text-keymap"/.test(rv) && /data-canvas-ui="quick-keymap"/.test(rv),
    "C4 the t832/t831 seats held — star, text, quick rows untouched in results-view",
  );

  ok(
    /data-canvas-ui="door-keymap"/.test(embed) && /data-canvas-ui="ortho-keymap"/.test(ortho),
    "C5 the t830 rows held — the door's chips and the ortho row untouched",
  );

  ok(
    /\{toc\.length > 0 && \(/.test(report) && /aria-label="Report sections"/.test(report),
    "C6 the compass itself untouched — renders on toc.length > 0, the honest aria name",
  );
}

console.log("D — the calibre");
{
  const apiDir = join(ROOT, "src/app/api");
  const entries = readdirSync(apiDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).length;
  const hasRoute = existsSync(join(apiDir, "route.ts"));
  ok(dirs === 18 && hasRoute, `D1 ${dirs} api dirs + route.ts = ${dirs + 1} entries — zero new routes through the feature (the family rides existing mouths)`);
}

console.log(`\nFLEET PROBE t833: ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
