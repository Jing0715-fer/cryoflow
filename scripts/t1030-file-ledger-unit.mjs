#!/usr/bin/env node
/**
 * t1030-file-ledger-unit — the ledger's data doors' instrument.
 *
 * The t1030 window continues the product line: the t1019/t1028/t1029
 * grammar chain visits its next seat — the job inspector's Files tab,
 * whose workdir file ledger (a real table: File / Kind / Details / Size,
 * the View and Get columns being rendered doors) could not leave as
 * bytes. The cure, two cars:
 *   1. src/lib/file-ledger.ts — the ledger's ONE father: LEDGER_HEAD
 *      (the paper's own head words as the CSV keys), LEDGER_KIND_LABELS
 *      (the paper's kind words, one vocabulary), fileDetailsCell (the
 *      Details word — one formula, two surfaces, the t215 precedent),
 *      ledgerBytes (the Size word — the inspector's private byte twin
 *      retired to the import), and fileLedgerRows (the row builder —
 *      File speaks the PATH, the listing's unique address, the t1029
 *      name-address law's ledger shape: file names collide across runs).
 *   2. job-inspector.tsx — the Files tab mounts the data doors
 *      (png={false}: a list owns no <svg> — the t1019 two-door dialect),
 *      getRows drinks the VIEWED rows (the table the door sits beside IS
 *      the paper it mirrors), the Details cell and the two Size cells
 *      pour from the lib's wells, and KIND_META's faces carry only the
 *      paint (the labels read the lib's map).
 *
 * F band — source pins on both cars (the laws' words in the sources).
 * B band — the fixture ride: the builder's keys are LEDGER_HEAD, the
 *          cells are the paper's own words (the images/voxels/rows/—
 *          word forms, the byte tiers, the toLocaleString grouping),
 *          the name-collision fixture proves the PATH is the address,
 *          and the honest guards refuse null/empty views.
 *
 * Census slot 46. Run: node scripts/unit-runner.mjs scripts/t1030-file-ledger-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const LIB = path.join(ROOT, "src/lib/file-ledger.ts");
const INSPECTOR = path.join(ROOT, "src/components/workflow/job-inspector.tsx");

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); };
};

const { fileLedgerRows, fileDetailsCell, ledgerBytes, LEDGER_HEAD, LEDGER_KIND_LABELS } =
  await import(path.join(ROOT, "src/lib/file-ledger.ts"));

console.log("== t1030 file ledger unit ==");

// ---------- F band: the cure's words in the sources ----------
console.log("-- F band: source pins --");
const lib = readFileSync(LIB, "utf8");
const insp = readFileSync(INSPECTOR, "utf8");

// 1. the lib's head is the paper's own four words
ok("lib: LEDGER_HEAD is the paper's own head (File/Kind/Details/Size)",
  JSON.stringify([...LEDGER_HEAD]) === JSON.stringify(["File", "Kind", "Details", "Size"]),
  LEDGER_HEAD.join("/"));
// 2. the row keys repeat the head (the t1019 grammar — typed once, repeated, pinned)
ok("lib: the builder's keys are the head words verbatim",
  lib.includes("File: f.path") && lib.includes("Kind: LEDGER_KIND_LABELS[f.kind]") &&
  lib.includes("Details: fileDetailsCell(f)") && lib.includes("Size: ledgerBytes(f.size)"));
// 3. the name-address law's ledger shape — the File cell speaks the PATH
ok("lib: the File cell speaks the path (the unique address — names collide across runs)",
  lib.includes("File: f.path") && !lib.includes("File: f.name") && !lib.includes("File: f.label"));
// 4. the kind vocabulary is the paper's own words, one father
ok("lib: LEDGER_KIND_LABELS speaks the paper's kind words",
  LEDGER_KIND_LABELS.mrc === "MRC" && LEDGER_KIND_LABELS.star === "STAR" &&
  LEDGER_KIND_LABELS.text === "TEXT" && LEDGER_KIND_LABELS.image === "PLOT");
// 5. the Details word's four forms ride the lib (never re-derived)
ok("lib: fileDetailsCell speaks images/voxels/rows/—",
  lib.includes("} images`") && lib.includes("³ voxels`") && lib.includes("} rows`") &&
  lib.includes('return "—";'));
// 6. the byte word is the inspector's own grammar (the retired twin's shape)
ok("lib: ledgerBytes speaks the inspector's byte tiers",
  lib.includes("if (n < 1024) return `${n} B`;") &&
  lib.includes(".toFixed(1)} KB`") && lib.includes(".toFixed(1)} MB`") &&
  lib.includes(".toFixed(2)} GB`"));
// 7. the inspector's private byte twin is GONE (the import won)
ok("inspector: the private formatBytes function is retired to the lib import",
  insp.includes("const formatBytes = ledgerBytes;") &&
  !insp.includes("function formatBytes(n: number)"));
// 8. the paper's Details cell drinks the lib's well (no inline twin)
ok("inspector: the Details cell pours from fileDetailsCell (one formula, two surfaces)",
  insp.includes("{fileDetailsCell(f)}") &&
  !/f\.kind === "mrc"\s*\?\s*f\.name\.toLowerCase\(\)\.endsWith\("\.mrcs"\)/.test(insp));
// 9. the kind badge and the kind chips read the lib's labels (one vocabulary, two faces)
ok("inspector: the kind faces read LEDGER_KIND_LABELS (the labels live once)",
  insp.includes("{LEDGER_KIND_LABELS[f.kind]}") &&
  insp.includes("LEDGER_KIND_LABELS[k as OutputKind] ?? k") &&
  !insp.includes('label: "MRC"'));
// 10. the door mounts with the two-door dialect (png={false}) and drinks the VIEWED rows
ok("inspector: the ledger door is the t1019 two-door face",
  insp.includes('name="File ledger"') && insp.includes("png={false}") &&
  insp.includes("getRows={() => fileLedgerRows(files)}"));
// 11. the rendered doors stay off the bytes (View/Get never join the file)
ok("lib: no View/Get keys ride the builder (rendered doors, not data)",
  !lib.includes("View:") && !lib.includes('"Get"'));
// 12. the lib imports the chart-export row grammar (type-only — the one family)
ok("lib: the row grammar comes from chart-export (the family's own CsvRow)",
  lib.includes('import type { CsvRow } from "@/lib/chart-export"'));

// ---------- B band: the fixture ride ----------
console.log("-- B band: the builder answers the paper's words --");

// a shaped fixture: every Details word form, every byte tier, and the
// name collision that proves the path is the address
const files = [
  { path: "PostProcess/run_class001.mrc", name: "run_class001.mrc", kind: "mrc", size: 512, slices: 128 },
  { path: "PostProcess/movies.mrcs", name: "movies.mrcs", kind: "mrc", size: 1024, slices: 64 },
  { path: "Refine3D/run_class001.mrc", name: "run_class001.mrc", kind: "mrc", size: 1572864, slices: 256 },
  { path: "Refine3D/data.star", name: "data.star", kind: "star", size: 1048576, rows: 1234 },
  { path: "Refine3D/run.err", name: "run.err", kind: "text", size: 1073741824 + 52428800 },
  { path: "Refine3D/plot.png", name: "plot.png", kind: "image", size: 20480 },
];

const rows = fileLedgerRows(files);
ok("B: fileLedgerRows answers a settled listing", !!rows && rows.length === 6,
  rows ? `${rows.length} rows` : "null");
ok("B: the keys are the paper's own head words, in order",
  !!rows && JSON.stringify(Object.keys(rows[0])) === JSON.stringify([...LEDGER_HEAD]),
  rows ? Object.keys(rows[0]).join("/") : "—");

// the Details word forms, cell for cell the paper's own words
ok("B: a plain .mrc speaks the voxel cube (128³ voxels)",
  fileDetailsCell(files[0]) === "128³ voxels", fileDetailsCell(files[0]));
ok("B: an .mrcs speaks images (64 images)",
  fileDetailsCell(files[1]) === "64 images", fileDetailsCell(files[1]));
ok("B: a rowed file speaks its count with the paper's grouping (1,234 rows)",
  fileDetailsCell(files[3]) === "1,234 rows", fileDetailsCell(files[3]));
ok("B: a rowless non-mrc speaks — (never a guess)",
  fileDetailsCell(files[5]) === "—", fileDetailsCell(files[5]));
ok("B: an unreadable mrc speaks the ? form (the paper's own honesty)",
  fileDetailsCell({ path: "x", name: "x.mrc", kind: "mrc", size: 1 }) === "?³ voxels");

// the byte tiers — the inspector's own grammar
ok("B: the byte tiers speak B/KB/MB/GB",
  ledgerBytes(512) === "512 B" && ledgerBytes(1024) === "1.0 KB" &&
  ledgerBytes(1572864) === "1.5 MB" && ledgerBytes(1073741824) === "1.00 GB",
  `${ledgerBytes(512)} · ${ledgerBytes(1024)} · ${ledgerBytes(1572864)} · ${ledgerBytes(1073741824)}`);

// the cells themselves — the paper's words in the builder's mouth
ok("B: the Size cells are the byte word verbatim",
  rows?.[0].Size === "512 B" && rows?.[2].Size === "1.5 MB" && rows?.[4].Size === "1.05 GB",
  rows?.[4].Size);
ok("B: the Kind cells are the paper's kind words",
  rows?.[0].Kind === "MRC" && rows?.[3].Kind === "STAR" && rows?.[5].Kind === "PLOT");
ok("B: the File cells speak the PATH — the name collision proves the address",
  rows?.[0].File === "PostProcess/run_class001.mrc" &&
  rows?.[2].File === "Refine3D/run_class001.mrc" &&
  rows?.[0].File !== rows?.[2].File,
  `${rows?.[0].File} vs ${rows?.[2].File}`);

// the honest guards
ok("B: a null listing refuses (the doors keep the honest disabled face)",
  fileLedgerRows(null) === null);
ok("B: an empty listing refuses (a zero-row file helps nobody)",
  fileLedgerRows([]) === null);

console.log(`== t1030-file-ledger-unit ${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green ==`);
process.exit(fail === 0 ? 0 : 1);
