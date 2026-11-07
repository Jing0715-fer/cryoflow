#!/usr/bin/env node
/**
 * t1043-import-lineage-preview-unit — the preview speaks the row's MEMORY.
 *
 * The seat: the t1039 arc gave every bookmark row a memory of WHERE the
 * view came from (src, write-once at import), t1041 spread it to both
 * aggregate doors, and t1042 carried it across the share link. But the
 * THIRD import surface — the import dialog's preview rows — showed each
 * incoming row's NAME, optics chips and date while stripping its MEMORY:
 * a re-imported export arrived in the preview looking exactly like a
 * fresh export, and the user confirmed rows whose lineage they could not
 * see. This window the preview rows wear the same `from …` chip the
 * saved rows wear — BEFORE the confirm, in the family dialect, with the
 * preview's own future-honest voice (the import has not happened yet,
 * so the chip's title says KEEPS, not remembers).
 *
 * Bands:
 *   A — the preview row's memory face (source pins on the embed): the
 *       chip's testid, the family line (the saved row's flex+gap date
 *       line), the chip's small-line dialect (min-w-0 truncate — the I3
 *       law: lineage SHRINKS honestly), the gate (`e.src &&` — a row
 *       without its own memory wears no chip), the word verbatim (`from
 *       {e.src}`), and the future-honest teaching title (KEEPS voice).
 *   B — the family's pins intact (the neighbors): the saved row's chip
 *       still wears bm-src-chip with the REMEMBERS voice, the confirm's
 *       first-hand fallback (`e.src ?? src` — the entry's own memory
 *       wins), the read-lane normalize (trim + the 120 cap + absent),
 *       the export's wholesale spread, and the display-economy pin: the
 *       no-chip rows' memory IS the group header's label, already on
 *       screen (the face says what the header doesn't, never the same
 *       word twice).
 *   C — the mirrored semantics on real rows: the normalize law
 *       re-implemented once (the unit's own mirror) and run against
 *       fixtures — a padded memory arrives trimmed and WEARS the chip;
 *       an oversized one is capped and wears it; an empty whisper and a
 *       non-string degrade to absent and go BARE; and the confirm's
 *       fallback arithmetic (`e.src ?? label`) stamped on the same
 *       fixtures — first-hand wins, the label catches the rest.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

console.log("A — the preview row's memory face");
{
  // the chip is born, in the import dialog's preview row (the testid)
  const chipIdx = embed.indexOf('data-testid="import-preview-src-chip"');
  ok(chipIdx > 0, "the preview chip is born (the testid)");

  // the gate — a row without its own memory wears no chip
  const gateWindow = embed.slice(chipIdx - 700, chipIdx + 100);
  ok(/\{e\.src && \(/.test(gateWindow), "the gate: the chip rides `e.src &&` (no memory, no chip)");

  // the family line — the saved row's date line dialect (flex + gap-1 +
  // the 9px face) — the preview row's date line GREW into it
  const previewIdx = embed.indexOf('{/* t1043 — the preview speaks the row\'s MEMORY too');
  ok(previewIdx > 0, "the t1043 comment stands at the surgery seat");
  const rowWindow = embed.slice(previewIdx, previewIdx + 2400);
  ok(rowWindow.includes('className="flex items-center gap-1 text-[9px] text-muted-foreground"'), "the date line wears the family's flex line (the saved row's dialect)");
  ok(rowWindow.includes('<span className="shrink-0">{new Date(e.ts).toLocaleString()}</span>'), "the date keeps its shrink-0 seat beside the chip");

  // the small-line law — the chip shrinks honestly (the I3 receipt)
  ok(rowWindow.includes("min-w-0 truncate rounded bg-muted/80 px-1 py-px font-mono text-[8px] font-medium text-muted-foreground"), "the chip wears the small-line dialect (min-w-0 truncate — lineage shrinks, never mid-chip wrap)");

  // the future-honest voice — KEEPS, not remembers (the preview's own)
  ok(rowWindow.includes('this row keeps its origin memory through the import'), "the title speaks the preview's future-honest voice (KEEPS, not remembers)");
  ok(rowWindow.includes('Imported from “${e.src}”'), "the title names the origin verbatim (the family's curly-quote grammar)");

  // the word verbatim
  ok(rowWindow.includes("from {e.src}"), "the chip's word is `from {e.src}` (the family's word, the row's own memory)");
}

console.log("B — the family's pins intact");
{
  // the saved row's chip — the REMEMBERS voice, untouched
  const savedIdx = embed.indexOf('data-testid="bm-src-chip"');
  ok(savedIdx > 0, "the saved row's chip stands (bm-src-chip)");
  const savedWindow = embed.slice(savedIdx, savedIdx + 400);
  ok(savedWindow.includes('this row remembers where the view came from'), "the saved row keeps the REMEMBERS voice (present tense — the import happened)");

  // the confirm's first-hand fallback — the entry's own memory wins
  ok(embed.includes("src: e.src ?? src"), "the confirm's birth stamp keeps the first-hand fallback (`e.src ?? src`)");

  // the read-lane normalize — trim + the 120 cap + the honest absent
  const normalizeWindow = embed.slice(embed.indexOf("const cleanBookmarkList ="), embed.indexOf("const cleanBookmarkList =") + 900);
  ok(normalizeWindow.includes('typeof b.src === "string" && b.src.trim() ? b.src.trim().slice(0, 120) : undefined'), "the read lane's normalize survives (trim + the 120 cap + absent)");

  // the export's wholesale spread — src travels verbatim
  const exportWindow = embed.slice(embed.indexOf("const exportBookmarks ="), embed.indexOf("const exportBookmarks =") + 800);
  ok(exportWindow.includes("bookmarks: bookmarksRef.current"), "the export still spreads the list wholesale (src rides verbatim)");

  // the display-economy pin — the no-chip rows' memory is the header's
  // label, already on screen (the group label render stands untouched)
  const headerIdx = embed.indexOf('title={g.label}');
  ok(headerIdx > 0, "the group header's label face stands (the fallback memory's seat)");
  ok(embed.includes("{g.label}\n                    </span>"), "the header still speaks the label verbatim (no-chip rows' future stamp, already visible)");
}

console.log("C — the mirrored semantics on real rows");
{
  // the unit's own mirror of the read-lane normalize law
  const mirror = (b) =>
    typeof b.src === "string" && b.src.trim() ? b.src.trim().slice(0, 120) : undefined;
  // the unit's own mirror of the confirm's birth stamp
  const stamp = (e, label) => e.src ?? label;

  // a padded memory arrives trimmed and WEARS the chip
  const padded = mirror({ src: "  Initial Model (tutorial)  " });
  ok(padded === "Initial Model (tutorial)", "padded memory → trimmed (and the gate `e.src &&` wears the chip)");
  ok(stamp({ src: padded }, "cryoflow-views.json") === "Initial Model (tutorial)", "the confirm stamps the row's OWN memory first-hand");

  // an oversized one is capped and wears it
  const oversized = mirror({ src: "x".repeat(300) });
  ok(oversized.length === 120, "oversized memory → capped at 120 (the one length law)");

  // an empty whisper and a non-string degrade to absent — bare row
  ok(mirror({ src: "   " }) === undefined, "empty whisper → absent (bare row, no chip — the honest face)");
  ok(mirror({ src: 42 }) === undefined, "non-string → absent (untrusted door, honest absence)");

  // the fallback catches the rest — a bare entry takes the label
  ok(stamp({ src: undefined }, "cryoflow-views.json") === "cryoflow-views.json", "the label catches bare rows at birth (the group header's word, honored)");
  ok(stamp({}, "Mask Create (tutorial)") === "Mask Create (tutorial)", "a src-less entry is stamped with its source's label (the fallback arithmetic)");
}

console.log(`\n${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
