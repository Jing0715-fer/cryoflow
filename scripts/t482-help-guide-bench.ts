/**
 * t482 — the door's manual catches up with the product.
 *
 * The help popover has carried six ancient canvas tips since the demo
 * era; since then the app grew storage maps and a graveyard, dispatch
 * records, cluster rosters and a 21-tool assistant — none of it
 * discoverable from the "?" door. This round: the popover stays the
 * canvas quick start, and the full manual moves into a real dialog
 * (the shortcuts-dialog pattern) — HELP_CHAPTERS is the single source
 * of truth, the doors stay two (popover CTA + command palette), and no
 * keyboard hook is registered ("?" already owns the shortcuts dialog —
 * an ambiguous key is a lying door).
 *
 * The bench pins BOTH halves: the manual's words (every row names a
 * real door; the graveyard chapter speaks the three states, the armed
 * two-step and the spare law; the stale demo-era phrase is gone) and
 * the wiring (store flag, app-shell mount, popover CTA, palette index).
 *
 * Run: bun run scripts/t482-help-guide-bench.ts
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

/* ------------------------------------------------------------------ */
/* Imports (the component module is pure UI tree — bun imports it fine) */
/* ------------------------------------------------------------------ */

const { HELP_CHAPTERS } = await import("../src/components/workflow/help-guide-dialog");

/* ------------------------------------------------------------------ */
/* T1 — the manual's shape                                             */
/* ------------------------------------------------------------------ */

console.log("T1. HELP_CHAPTERS — one source of truth, five chapters");

{
  must(HELP_CHAPTERS.length === 5, "T1a: the guide carries 5 chapters");
  must(
    JSON.stringify(HELP_CHAPTERS.map((c) => c.id)) ===
      JSON.stringify(["canvas", "assistant", "storage", "clusters", "finding"]),
    "T1b: the chapters are canvas / assistant / storage / clusters / finding",
  );
  must(
    HELP_CHAPTERS.every((c) => c.title.length > 3 && c.rows.length >= 4),
    "T1c: every chapter has a title and at least 4 rows",
  );
  const total = HELP_CHAPTERS.reduce((n, c) => n + c.rows.length, 0);
  must(total >= 20, `T1d: the manual holds ${total} rows (≥ 20)`);
  must(
    HELP_CHAPTERS.every((c) => new Set(c.rows).size === c.rows.length),
    "T1e: no row repeats within a chapter",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — the manual names the product's real doors                      */
/* ------------------------------------------------------------------ */

console.log("T2. the words teach the real product, not the demo era");

{
  const rows = (id: string) =>
    HELP_CHAPTERS.find((c) => c.id === id)?.rows.join(" \n ") ?? "";
  const canvas = rows("canvas");
  const assistant = rows("assistant");
  const storage = rows("storage");
  const clusters = rows("clusters");
  const finding = rows("finding");

  must(
    canvas.includes("tombstone") && canvas.includes("ESC"),
    "T2a: the canvas chapter teaches the tombstone and the escape hatch",
  );
  must(
    assistant.includes("reads never change your canvas") &&
      assistant.includes("graveyard"),
    "T2b: the assistant chapter teaches reads-vs-acts and the restore verb",
  );
  must(
    storage.includes("Recently deleted") &&
      storage.includes("epitaph") &&
      storage.includes("armed two-step") &&
      storage.includes("spared by name") &&
      storage.includes("weight"),
    "T2c: the storage chapter speaks the drawer's whole grammar (restore/epitaph/armed/spare/weight)",
  );
  must(
    clusters.includes("probe dot") &&
      clusters.includes("Test") &&
      clusters.includes("résumé"),
    "T2d: the clusters chapter speaks roster law, probe-first and the résumé",
  );
  must(
    finding.includes("⌘K") && finding.includes("?") && finding.includes("Session QC report"),
    "T2e: the finding chapter names the palette, the shortcuts key and the QC report",
  );
  must(
    !src("src/components/workflow/help-popover.tsx").includes("simulated server-side"),
    "T2f: the stale demo-era phrase is gone from the popover — the manual never teaches dead words",
  );
}

/* ------------------------------------------------------------------ */
/* T3 — the wiring: one flag, two doors, one mount                     */
/* ------------------------------------------------------------------ */

console.log("T3. the guide is wired like the shortcuts dialog");

{
  const store = src("src/lib/store.ts");
  must(
    store.includes("helpGuideOpen: boolean") &&
      store.includes("setHelpGuideOpen: (open: boolean) => void") &&
      store.includes("helpGuideOpen: false"),
    "T3a: the store carries the flag (interface + setter + default)",
  );
  const shell = src("src/components/workflow/app-shell.tsx");
  must(
    shell.includes('from "@/components/workflow/help-guide-dialog"') &&
      shell.includes("<HelpGuideDialog />"),
    "T3b: the app-shell mounts the guide exactly once",
  );
  const popover = src("src/components/workflow/help-popover.tsx");
  must(
    popover.includes("setHelpGuideOpen(true)") &&
      popover.includes("Read the full guide"),
    "T3c: the popover's CTA opens the guide — quick start leads to the manual",
  );
  const palette = src("src/components/workflow/command-palette.tsx");
  must(
    palette.includes("setHelpGuideOpen(true)") &&
      palette.includes("Help — the full guide"),
    "T3d: the palette indexes the guide (t245's law: every door is indexed)",
  );
}

/* ------------------------------------------------------------------ */
/* T4 — the honest-absent: no ambiguous key                            */
/* ------------------------------------------------------------------ */

console.log("T4. the guide registers no keyboard hook of its own");

{
  const guide = src("src/components/workflow/help-guide-dialog.tsx");
  must(
    !guide.includes("addEventListener") && !guide.includes("onKeyDown={"),
    "T4a: no keyboard hook — \"?\" already owns the shortcuts dialog, an ambiguous key is a lying door",
  );
  must(
    guide.includes("setShortcutsOpen(true)"),
    "T4b: the guide's footer hands off to the shortcuts dialog (the same yield-focus dance)",
  );
}

/* ------------------------------------------------------------------ */

console.log(`\nt482 help-guide bench: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
