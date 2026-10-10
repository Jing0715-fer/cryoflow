#!/usr/bin/env node
/**
 * t828 — the header's narrow-band tier law + the toolbar family's cap.
 *
 * Evidence (all measured live at :3000 before the cure, agent-browser):
 *  - at 375 the header's RIGHT cluster (10 icon seats, ~404px, flex
 *    min-width:auto floors) pushed 53px past the viewport (shell
 *    scrollWidth 428 > 375) and justify-between crushed the brand row to
 *    ZERO width — the wordmark vanished silently and the ViewSwitcher
 *    interpenetrated the right cluster (the t510 disease at the narrow
 *    band); at 640 the same cluster (Relion chip joined) overflowed 16px.
 *  - the theme toggle + help sat at right 419/428 — unreachable on touch.
 *  - the toolbar popovers: at 1280×560 the turntable door ran 28px past
 *    the fold (h 440 > available 411.6); export-scale 18px at 470 — while
 *    the t827 bookmarks door capped itself exactly at the published
 *    available height. The cure: the door's law crosses the family.
 *
 * Sections:
 *   A  the header tier law (brand shrinks first, ops seats fall by band)
 *   B  the right cluster's last-resort pane (min-w-0 + internal scroll)
 *   C  the four toolbar siblings wear the t827 cap (dormant at desktop)
 *   D  the door's own cap untouched (t827 regression guard)
 *   E  the comments name their evidence (the house style)
 *   F  the t383 dialog floor still guards the import dialogs (untouched)
 *   G  the calibre (19 api entries — census rotation)
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

const header = src("src/components/workflow/header.tsx");
const molstar = src("src/components/workflow/results/molstar-embed.tsx");
const dialog = src("src/components/ui/dialog.tsx");

console.log("A — the header tier law (measured: 375 = 53px overflow, 640 = 16px)");
ok(
  /size-9 shrink-0 items-center justify-center rounded-xl bg-primary\/10 text-primary max-sm:hidden/.test(header),
  "A1 the brand logo falls away below sm (the tabs carry navigation)"
);
ok(
  /min-w-0 leading-tight max-md:hidden/.test(header),
  "A2 the wordmark waits for md (it was silently truncating to 0 anyway)"
);
ok(
  /hidden xl:block">[\s\S]{0,80}<RelionStatusChip \/>/.test(header),
  "A3 the Relion status chip waits for xl (md band measured the tabs over it)"
);
ok(
  /<span className="hidden xl:inline">Dashboard<\/span>/.test(header) &&
    /<span className="hidden xl:inline">Workflow<\/span>/.test(header),
  "A10 the tab labels wait for xl (they painted 148px into the seats at 768)"
);
ok(
  /className="max-sm:hidden text-muted-foreground hover:text-foreground"\s*\n\s*onClick=\{\(\) => setStorageOpen\(true\)\}/.test(header),
  "A4 the storage map seat falls below sm (desktop ops chrome)"
);
ok(
  /className="max-md:hidden text-muted-foreground hover:text-foreground"\s*\n\s*onClick=\{\(\) => setDiagOpen\(true\)\}/.test(header),
  "A5 the diagnostics seat waits for md"
);
ok(
  /className="max-md:hidden text-muted-foreground hover:text-foreground"\s*\n\s*onClick=\{\(\) => window.print\(\)\}/.test(header),
  "A6 the print seat waits for md (paper is a desktop act)"
);
ok(
  /<span className="max-sm:hidden">\s*\n\s*<KnockSettingsButton \/>/.test(header),
  "A7 the knock-settings bell falls below sm (set-once chrome)"
);
ok(
  /max-md:hidden[\s\S]{0,400}aria-label="CryoFlow on GitHub/.test(header),
  "A8 the GitHub link waits for md (decoration next to a command surface)"
);
ok(
  !/className="hidden sm:block">\s*\n\s*<RelionStatusChip/.test(header),
  "A9 the old sm tier for Relion is gone (it was the 640px breaker)"
);

console.log("B — the right cluster's seat contract (t510's absorber law kept)");
ok(
  /no-print flex shrink-0 items-center gap-1\.5/.test(header),
  "B1 the cluster never shrinks — the left row stays the only shock absorber"
);
ok(
  /the narrow bands are yielded by the TIER LAW above/.test(header) ||
    /narrow bands are yielded by the TIER LAW/.test(header.replace(/\n\s+/g, " ")),
  "B2 the comment names the 1280 steal (left 671 vs right 565)"
);

console.log("C — the four toolbar siblings wear the t827 cap (dormant at desktop)");
const cap = 'max-h-[var(--radix-popover-content-available-height)] overflow-y-auto nice-scroll';
for (const [ui, w] of [
  ["layers-popover", "w-72"],
  ["export-scale-popover", "w-60"],
  ["turntable-popover", "w-60"],
  ["view-presets", "w-52"],
]) {
  const re = new RegExp(`className="${w} ${cap.replace(/[[\]()\\]/g, "\\$&")} p-2"\\s*\\n\\s*data-canvas-ui="${ui}"`);
  ok(re.test(molstar), `C1 ${ui} carries the available-height cap (${w})`);
}
ok(
  /28px past the fold \(h 440\s*> the 411\.6 Radix published\)/.test(molstar.replace(/\n\s+/g, " ")),
  "C2 the turntable comment names its measurement (28px at 560, avail 411.6)"
);

console.log("D — the door's own cap untouched (t827 regression guard)");
ok(
  /className="w-64 max-h-\[var\(--radix-popover-content-available-height\)\] overflow-y-auto nice-scroll p-2"\s*\n\s*data-canvas-ui="camera-bookmarks"/.test(molstar),
  "D1 the bookmarks door keeps its t827 waist"
);

console.log("E — the comments name their evidence");
ok(
  /shell scrollWidth lied \(428 > 375\)/.test(header),
  "E1 the header comment names the 428 > 375 lie"
);
ok(
  /crushed the\s*\n\s*brand row to ZERO/.test(header),
  "E2 the header comment names the zero-width brand row"
);

console.log("F — the t383 dialog floor still guards the import dialogs");
ok(
  /max-h-\[calc\(100dvh-2rem\)\]/.test(dialog) && /overflow-y-auto/.test(dialog),
  "F1 DialogContent base keeps max-h + overflow (the import dialogs' guard)"
);
ok(
  /max-h-44/.test(src("src/components/workflow/import-workflow-dialog.tsx")),
  "F2 the workflow import queue keeps its internal cap"
);

console.log("G — the calibre (census rotation)");
const apiDir = join(ROOT, "src/app/api");
const dirs = readdirSync(apiDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
const entries = dirs + (existsSync(join(apiDir, "route.ts")) ? 1 : 0);
ok(entries === 19, `G1 api entries = 19 (18 dirs + root route.ts) — got ${entries}`);

console.log(`\nFLEET-UNIT t828: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
