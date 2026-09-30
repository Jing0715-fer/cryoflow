/**
 * t510-header-shrink-bench.ts — The Header Learns to Yield + the
 * Receipt Learns to Leave.
 *
 * QA found the header's middle tier painting INTO the actions cluster
 * at 1280: "RELION not found" over "note" — 57px of interpenetration,
 * the row's children 207px past their container. The re-measure told a
 * four-layer story, and each layer got its own law:
 *
 *   T1  the tiers    — the chip rises to 2xl, the counters to 2000
 *                      (t301's 1700 predated the right cluster's growth),
 *                      the project trigger gives 170 in the tight band
 *   T2  the chain    — min-w-0 rides the row and the wrapper, the badge
 *                      joins the shrink chain (shrink-0 was a hard 105px
 *                      floor — the original sin), the trigger keeps a
 *                      name-worthy 130px floor
 *   T3  the name     — the trigger speaks the name, nothing else (the
 *                      item's shrink-0 RELION badge used to eat ~60px of
 *                      every width and the whole name below 190)
 *   T4  neighbors    — the footer census and the dashboard Noted chip
 *                      carry what the header yields; the measured story
 *                      is written where the tiers live
 */

import { readFileSync } from "fs";
import path from "path";

const REPO = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(REPO, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond: boolean, msg: string) => {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${msg}`);
  } else {
    fail += 1;
    console.error(`  FAIL ${msg}`);
  }
};

const header = read("src/components/workflow/header.tsx");

/* slice helper — the NoteSpotlightChip's own className (chip anchor) */
const chipStart = header.indexOf("function NoteSpotlightChip");
const chipEnd = header.indexOf("/* ---", chipStart);
const chipSlice = header.slice(chipStart, chipEnd);
/* the ProjectSwitcher slice */
const psStart = header.indexOf("function ProjectSwitcher");
const rsStart = header.indexOf("/* ---", psStart);
const psSlice = header.slice(psStart, rsStart);
/* the middle-row slice (WorkspaceSelect + ProjectSwitcher + counters + chip mount) */
const rowStart = header.indexOf("t510 — re-measured");
const rowEnd = header.indexOf("</div>", rowStart);
const rowSlice = header.slice(rowStart, rowEnd);

console.log("T1 the tiers — only where room is measured");
ok(
  /hidden h-8 items-center[^"]*2xl:flex/.test(chipSlice),
  "T1.1 the lens chip wears hidden + 2xl:flex (rises to the wide tier)"
);
ok(
  !/(^|[^2])xl:flex/.test(chipSlice.split("className")[1] ?? ""),
  "T1.2 the chip no longer shows at xl (2xl:flex is not xl:flex)"
);
ok(
  header.includes('min-[2000px]:flex" aria-label="Workflow statistics"'),
  "T1.3 the counters' tier moved to 2000 (1700 crushed the trigger to 54px)"
);
ok(!header.includes("min-[1700px]"), "T1.4 no stale 1700 tier remains in the header");
ok(
  /xl:w-\[170px\] 2xl:w-\[220px\]/.test(psSlice),
  "T1.5 the project trigger gives 170 in the tight band, 220 back from 2xl"
);
ok(
  /min-w-\[130px\]/.test(psSlice),
  "T1.6 the trigger keeps a name-worthy 130px floor (an ellipsis with no name teaches nothing)"
);

console.log("T2 the chain — flexbox floors rule");
ok(
  /hidden min-w-0 items-center gap-2 xl:flex/.test(rowSlice),
  "T2.1 min-w-0 rides the middle row (compress, never paint over)"
);
ok(
  /flex min-w-0 items-center gap-1\.5/.test(psSlice),
  "T2.2 the ProjectSwitcher wrapper joins the chain"
);
ok(
  psSlice.includes("max-w-[170px] min-w-0"),
  "T2.3 the binding badge joins the shrink chain"
);
ok(
  !psSlice.includes("max-w-[170px] shrink-0"),
  "T2.4 the badge's hard shrink-0 floor is gone (the original sin)"
);
ok(
  psSlice.includes("min-w-[130px]"),
  "T2.5 the trigger's floor rides the className (the wrapper note points here)"
);
ok(
  /w-\[128px\] min-w-0/.test(header),
  "T2.6 the workspace trigger is compressible too (its value already truncates)"
);

console.log("T3 the name — the trigger speaks the name, nothing else");
ok(
  /SelectValue placeholder=\{pending \? "Switching…" : "Select project"\}>\s*\n\s*<span className="truncate">\{project\?\.name \?\? ""\}<\/span>/.test(
    psSlice
  ),
  "T3.1 the trigger's SelectValue carries a truncating name span"
);
ok(
  (psSlice.match(/<SelectValue/g) ?? []).length === 1,
  "T3.2 exactly one SelectValue — no second face"
);
ok(
  /<Badge\s+variant="outline"\s+className="text-xs">/.test(psSlice) ||
    /<Badge[^>]*variant="outline"/.test(psSlice),
  "T3.3 the RELION badge still lives on the dropdown rows"
);

console.log("T4 neighbors — what the header yields is carried elsewhere");
ok(
  /t510 — re-measured/.test(header) && header.includes("57px of interpenetration"),
  "T4.1 the measured story lives where the tiers live"
);
ok(
  /the most redundant chrome, they wait longest/.test(header),
  "T4.2 the counters' waiting law is written down"
);
const footer = read("src/components/workflow/footer.tsx");
ok(
  footer.includes("status census") || footer.includes("Task 140"),
  "T4.3 the footer census still speaks the numbers below 2000"
);
const dashboard = read("src/components/workflow/project-dashboard.tsx");
ok(
  dashboard.includes("noted") && dashboard.includes("hasJudgment"),
  "T4.4 the dashboard Noted chip remains the lens's second entry"
);

console.log("T5 the receipt — the tool card's detail learns to leave");
const panel = read("src/components/ai/assistant-panel.tsx");
ok(
  panel.includes('import { CopyButton } from "@/components/workflow/copy-button";'),
  "T5.1 the one clipboard affordance rides in (t170's component, no second dialect)"
);
ok(
  /const detail = React\.useMemo\(\(\) => \{/.test(panel) &&
    panel.includes("return { window: full.slice(0, 4000), full };"),
  "T5.2 the receipt has two faces: a 4,000-character window, the full payload"
);
ok(
  panel.includes('<CopyButton text={detail.full} label="Copy detail" />'),
  "T5.3 the copy door takes the WHOLE payload (Copy ledger / Copy report → Copy detail)"
);
ok(
  panel.includes("characters — Copy takes all of it"),
  "T5.4 the window says when it is a window (truncation honesty)"
);
ok(
  !/JSON\.stringify\(item\.detail, null, 2\)\.slice\(0, 4000\)/.test(panel),
  "T5.5 the old inline window is retired — the useMemo is the one well"
);
ok(
  /text=\{detail\.full\}/.test(panel) && !/text=\{detail\.window\}/.test(panel),
  "T5.6 no door hands out the truncated window"
);

console.log(`\nt510 bench: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
