#!/usr/bin/env node
/**
 * t869 — the source-contract unit behind the text-preview face's walk.
 *
 * The walk (t869-textpreview-a11y.mjs) measures the LIVE world; this unit
 * pins the SOURCE contracts the world's build compiles from — the t832
 * pattern (its section B asserted the star/text seats from source) riding
 * the t869 fixes:
 *
 *   A  the keymap family's second-family seats (job-inspector.tsx):
 *      the text peek and the star peek each carry their results-view
 *      word form verbatim (data-canvas-ui + the Esc chip), the Kbd
 *      vocabulary imported — one brain, one voice, no family left
 *      teaching nothing.
 *   B  the tail preview's two silent states learned the house dialects
 *      (text-preview.tsx): the loading row speaks (role="status"), the
 *      wound strip speaks (aria-live="polite" + a named section) and
 *      offers its door (the t491 third state — the retry chip re-fires
 *      the SAME fetch through the effect's own dependency, no imperative
 *      wiring).
 *   C  the ENGINE's classes stacks speak the t373 convention
 *      (relion_refine): all three call sites speak kind="classes" for the 2D lane — no lane
 *      left rendering the static (the t287 law).
 *
 *   node scripts/t869-textpreview-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
let pass = 0;
let fail = 0;
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
};

const inspector = readFileSync(join(ROOT, "src/components/workflow/job-inspector.tsx"), "utf8");
const preview = readFileSync(join(ROOT, "src/components/workflow/results/text-preview.tsx"), "utf8");
const refine = readFileSync(join(ROOT, "services/mock-cluster/fs/opt/bin/relion_refine"), "utf8");

/* ---------- A — the second family's seats ---------- */
console.log("A — the keymap family's second-family seats (job-inspector.tsx)");
ok("A1 the Kbd vocabulary is imported",
  /import \{ Kbd \} from "@\/components\/ui\/kbd"/.test(inspector));
const textSeat = inspector.match(/data-canvas-ui="text-keymap"/g) ?? [];
const starSeat = inspector.match(/data-canvas-ui="star-keymap"/g) ?? [];
ok("A2 the text peek carries its seat (text-keymap)", textSeat.length === 1,
  `count=${textSeat.length}`);
ok("A3 the star peek carries its seat (star-keymap)", starSeat.length === 1,
  `count=${starSeat.length}`);
/* the word form: results-view's rows teach exactly "Esc closes" — the
 * inspector's seats must speak the SAME words verbatim (one voice). */
const seatBlocks = inspector.split('data-canvas-ui="').slice(1)
  .map((s) => s.split("</div>")[0]);
for (const seat of ["text-keymap", "star-keymap"]) {
  const blk = seatBlocks.find((b) => b.startsWith(seat)) ?? "";
  ok(`A4 the ${seat} seat speaks the family's word form (Esc + closes, one chip)`,
    blk.includes("<Kbd>Esc</Kbd>") && blk.includes("closes") && (blk.match(/Kbd>/g) ?? []).length === 2);
}
ok("A5 the t869 birthright comment rides the seats (the law's own voice)",
  inspector.includes("t869") && inspector.includes("must-not-lie"));

/* ---------- B — the tail preview's speaking states ---------- */
console.log("B — the tail preview's two states learned the house dialects (text-preview.tsx)");
ok("B1 the loading row speaks (role=status)",
  /role="status"/.test(preview) && preview.includes("Loading file…"));
ok("B2 the wound strip speaks (aria-live=polite + a named section)",
  preview.includes('aria-live="polite"') && preview.includes('aria-label="File preview could not be loaded"'));
ok("B3 the wound carries its evidence (the error message rendered in mono)",
  /font-mono text-\[10px\] opacity-70/.test(preview));
ok("B4 the wound offers its door (the t491 third state — the retry chip)",
  preview.includes("data-text-error-retry") && preview.includes("Retry loading the file"));
ok("B5 the retry re-fires the SAME fetch (the effect's own dependency — no imperative wiring)",
  /\[jobId, path, attempt\]/.test(preview) && preview.includes("setAttempt"));
ok("B6 the healthy world shows no false wound (the strip renders only on error)",
  preview.indexOf("if (error)") < preview.indexOf("if (text === null)"));
ok("B7 the region's keyboard face is untouched (tabIndex 0 + the t774 focus law)",
  preview.includes("tabIndex={0}") && preview.includes("preRef.current?.focus()"));
ok("B8 the t869 birthright comment rides the header",
  preview.includes("t869"));

/* ---------- C — the ENGINE's classes stacks ---------- */
console.log("C — the ENGINE's classes stacks speak the t373 convention (relion_refine)");
/* the call sites are single-line statements — the honest read is per
 * LINE (a regex over nested parens would strangle on os.path.join).
 * THREE sites speak the classes stacks: the fresh-run flow (t485's line,
 * kind conditional on is2d — the convention's first speaker), the
 * continue branch and the seed round (the t869 fix — both now kind=
 * "classes" unconditionally). */
const callLines = refine.split("\n").filter((l) => l.trim().startsWith("write_mrc(") && l.includes("classes.mrcs"));
ok("C1 all three classes-stack call sites are aboard (fresh-run + continue + seed round)",
  callLines.length === 3, `calls=${callLines.length}`);
ok("C2 every classes-stack call speaks kind=\"classes\" for the 2D lane (no lane left rendering the static)",
  callLines.length > 0 && callLines.every((c) => c.includes('kind="classes"')));
ok("C3 the t869 birthright comment rides the call sites",
  refine.includes("t869") && refine.includes("speaks the t373 convention") && refine.includes("joins the t373 convention"));
ok("C4 the per-frame sub-seed is the writer's own (the t287 law's mechanism present)",
  refine.includes("sub = seed * 613 + z * 977"));

console.log(`\nT869 TEXT-PREVIEW UNIT: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
