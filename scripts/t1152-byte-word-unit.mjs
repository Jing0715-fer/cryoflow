#!/usr/bin/env node
/**
 * t1152 — THE BYTE-WORD unit: one formatter per app, the census father's
 * seat.
 *
 * The t1152 window walked the server-face × tool-roster map's THIRD pass
 * (activity feed / fs/browse / workflow-import / cleanup's second face —
 * all four buried with evidence at the source, the map SPENT) and opened
 * the NEW map the guidance named: which UI FACES still re-derive what a
 * father already knows? The first vein answered instantly: the BYTE WORD
 * had SIX births and FOUR dialects — the father (disk-usage's fmtBytes,
 * the t518 voice law, "One formatter per app: two byte formats on one
 * screen is a lie about precision") plus five twins: byte-identical
 * copies in cleanup-dialog and job-inspector, a KB-0-decimals no-GB
 * dialect in canvas-export ("2 KB", a 2.5 GB blob rendered "2560.0 MB"),
 * a KB-1-decimal no-GB dialect in results-view (the same blob the
 * inspector called "1.50 GB" rendered "1536.0 MB"), and the
 * import-gallery's unit-loop dialect with whole-number shortcuts
 * ("10 KB" beside the father's "10.0 KB"). A seventh face — the 3D
 * viewer's export toasts — drank the canvas-export dialect through its
 * import. All twins died the same day: every face imports the father.
 *
 * A — the father run FOR REAL: the dialect's every band (B, KB, MB, GB),
 *     the two decimals that make GB honest, the whole-number shortcut
 *     that is now dead, the 700 MB t458 pin, the 2.5 GB blob's true
 *     word, the determinism.
 * B — the source law: all seven faces import the father, no local
 *     definition survives anywhere, the canvas-export export is a death
 *     certificate, the absence word ("—" for an UNKNOWN size) is the
 *     import-gallery's own and rides the father for known bytes, the
 *     census lives in the father's own header.
 * C — the doctrine: the one-formatter law, the client-safe construction
 *     (no fs in the father's module — six client faces import it), the
 *     engine's voice boundary (log prose keeps its dialect), the B/px
 *     measurement is a different word.
 *
 * node scripts/unit-runner.mjs scripts/t1152-byte-word-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fmtBytes } from "@/lib/relion/disk-usage";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const fatherSrc = read("src/lib/relion/disk-usage.ts");
const cleanupSrc = read("src/components/workflow/cleanup-dialog.tsx");
const inspectorSrc = read("src/components/workflow/job-inspector.tsx");
const resultsSrc = read("src/components/workflow/results/results-view.tsx");
const gallerySrc = read("src/components/workflow/results/import-gallery.tsx");
const canvasSrc = read("src/components/workflow/canvas.tsx");
const molstarSrc = read("src/components/workflow/results/molstar-embed.tsx");
const canvasExportSrc = read("src/lib/canvas-export.ts");
const toolsSrc = read("src/lib/ai/tools.ts");
const storageDialogSrc = read("src/components/workflow/storage-dialog.tsx");

let pass = 0;
let fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

/* ---------- A — the father run FOR REAL ---------- */
console.log("A — the father run FOR REAL");

ok("A1 the byte band: sub-KB speaks the integer and the unit",
  fmtBytes(0) === "0 B" && fmtBytes(500) === "500 B" && fmtBytes(1023) === "1023 B",
  `got ${fmtBytes(0)} / ${fmtBytes(500)} / ${fmtBytes(1023)}`);
ok("A2 the KB band: one decimal, 1024 base",
  fmtBytes(1024) === "1.0 KB" && fmtBytes(1536) === "1.5 KB",
  `got ${fmtBytes(1024)} / ${fmtBytes(1536)}`);
ok("A3 the whole-number shortcut is dead — 10 KiB is 10.0 KB, never the gallery's 10 KB",
  fmtBytes(10240) === "10.0 KB",
  `got ${fmtBytes(10240)}`);
ok("A4 the MB band: one decimal",
  fmtBytes(1048576) === "1.0 MB" && fmtBytes(734003200) === "700.0 MB",
  `got ${fmtBytes(1048576)} / ${fmtBytes(734003200)}`);
ok("A5 the t458 pin holds — the run lens' 700 MB line keeps its word",
  fmtBytes(734003200) === "700.0 MB");
ok("A6 the GB band: TWO decimals — the father's own precision word",
  fmtBytes(1073741824) === "1.00 GB" && fmtBytes(1610612736) === "1.50 GB",
  `got ${fmtBytes(1073741824)} / ${fmtBytes(1610612736)}`);
ok("A7 the 2.5 GB blob speaks its true word — never again 2560.0 MB",
  fmtBytes(2684354560) === "2.50 GB",
  `got ${fmtBytes(2684354560)}`);
ok("A8 the determinism — the same bytes, twice, one word",
  fmtBytes(2684354560) === fmtBytes(2684354560) && fmtBytes(1024) === fmtBytes(1024));

/* ---------- B — the source law ---------- */
console.log("B — the source law: seven faces, one birthplace");

const FATHER_IMPORT = 'from "@/lib/relion/disk-usage"';
ok("B1 cleanup-dialog rides the father (the dialect's own birthplace came home)",
  cleanupSrc.includes(`import { fmtBytes } ${FATHER_IMPORT}`) &&
    !/function fmtBytes\(/.test(cleanupSrc));
ok("B2 job-inspector rides the father (the byte-identical twin died)",
  inspectorSrc.includes(`import { fmtBytes } ${FATHER_IMPORT}`) &&
    !/function formatBytes\(/.test(inspectorSrc));
ok("B3 results-view rides the father (the no-GB dialect died — GB files speak GB)",
  resultsSrc.includes(`import { fmtBytes } ${FATHER_IMPORT}`) &&
    !/function formatBytes\(/.test(resultsSrc));
ok("B4 import-gallery rides the father (the unit-loop dialect died)",
  gallerySrc.includes(`import { fmtBytes } ${FATHER_IMPORT}`));
ok("B5 canvas.tsx rides the father (canvas-export's dialect has no consumers left)",
  canvasSrc.includes(`import { fmtBytes } ${FATHER_IMPORT}`));
ok("B6 molstar-embed rides the father (the seventh face came home with its dialect)",
  molstarSrc.includes(`import { fmtBytes } ${FATHER_IMPORT}`));
ok("B7 the death certificate — canvas-export exports no byte word",
  !/export function fmtBytes\(/.test(canvasExportSrc) &&
    canvasExportSrc.includes("t1152"));
ok("B8 the census lives in the father's own header — six births, four dialects, dated",
  fatherSrc.includes("SIX births and FOUR dialects") &&
    fatherSrc.includes("2026-11-02 (t1152)"));
ok("B9 the absence word is the gallery's own — an UNKNOWN size is not 0 B",
  gallerySrc.includes('const formatBytes = (bytes: number): string => (bytes > 0 ? fmtBytes(bytes) : "—");'));
ok("B10 the B/px measurement is a different word and stays",
  gallerySrc.includes("function formatBytesPerPixel") && gallerySrc.includes("B/px"));
ok("B11 the pre-existing client reader never moved (storage-dialog)",
  storageDialogSrc.includes(`import {\n  fmtBytes,`) ||
    /fmtBytes,\s*\n/.test(storageDialogSrc));
ok("B12 the t518 voice law holds in tools.ts — fmtBytes the only bytes",
  toolsSrc.includes('import { fmtBytes } from "@/lib/relion/disk-usage"'));
ok("B13 no local definition survives in ANY of the seven faces",
  !/function fmtBytes\(/.test(cleanupSrc + inspectorSrc + resultsSrc + gallerySrc + canvasSrc + molstarSrc + canvasExportSrc));

/* ---------- C — the doctrine ---------- */
console.log("C — the doctrine");

ok("C1 the one-formatter law, verbatim at the father",
  fatherSrc.includes("One formatter") &&
    fatherSrc.includes("two byte formats on one screen is a lie about precision"));
ok("C2 the father is CLIENT-SAFE by construction — six client faces import it",
  fatherSrc.includes("CLIENT-SAFE") &&
    !fatherSrc.includes('from "fs"') && !fatherSrc.includes('from "node:fs"') &&
    !fatherSrc.includes("readFileSync"));
ok("C3 the engine's voice boundary — the log prose keeps its own dialect",
  fatherSrc.includes("the ENGINE's voice") &&
    fatherSrc.includes("ssh.ts") && fatherSrc.includes("engine.ts") &&
    fatherSrc.includes("remote-run.ts"));
ok("C4 the absence word is not a byte format — the father's CODE never speaks the em dash",
  (() => {
    const m = /export function fmtBytes\(n: number\): string \{[\s\S]*?\n\}/.exec(fatherSrc);
    return m !== null && !m[0].includes("\u2014") && fatherSrc.includes("ABSENCE word");
  })());
ok("C5 the dialect's drift words are in the census, never in code",
  fatherSrc.includes("2560.0 MB") && fatherSrc.includes("1.50 GB") &&
    fatherSrc.includes("1536.0 MB"));
ok("C6 the results-view grave marker names what died and why",
  resultsSrc.includes("formatBytes lived here once") &&
    resultsSrc.includes("NO GB branch"));

/* ---------- receipt ---------- */
console.log(`\nBYTE-WORD-UNIT t1152: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
