// t766 — the PARAMS DIFF DIALOG's description speaks the pours words: the
// kind vocabulary's TWENTY-SIXTH reader, the family's THIRTEENTH testid
// address (params-diff-pours-). The dialog's prose already names the
// pair's shared type ("Launch parameters of the two selected {type}
// jobs, side by side") — the picker's guard guarantees the pair is
// same-type, so ONE mention speaks for both columns — and the dots sit
// inline right after the type word: the t760 prose law (the description
// is a <p>; a block flex would break the sentence into anonymous blocks;
// the seat's physics is its witness). The gate closes on spec (the t760
// verbatim form): unknown types keep the bare sentence (the undefined
// law's fifth face). The diff dialog is a DECISION seat's confirmation
// stage: the sibling picker's water (t763, on the trigger) promises what
// the pair pours; the dialog's water repeats it at the moment the two
// parameter sets are actually read side by side.
//
//   A  one book: the import merges (three names, one home); the gated
//      ask appears exactly once in the FILE (comments stripped — the
//      t760 meta-law); the spec ask + riding ask verbatim; the render
//      gate closes on spec; the lib home keeps its question; exactly one
//      seat.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      FOURTEENTH-interlocked, refine3d pours by the lib's own answer,
//      every known type speaks, the unknown silent, every pour's ink is
//      a real PORT_COLORS wire.
//   C  the face: the thirteenth address verbatim, no collision with the
//      family's twelve DOM addresses, the container class verbatim (the
//      prose law — dialect equation THIRTEENTH staging, cross-file
//      verbatim vs t760), per-dot anatomy + sr-only ear line, the seat
//      regex (type word -> water -> "jobs"), one mention speaks for two
//      (the description names the type once).
//   D  purity: THREE hex = THREE (COLUMN_COLORS teal/amber + the
//      #71717a orphan colorOf fallback — pre-surgery residents audited,
//      not purged; the t761 form: purity bites additions, not stock —
//      and the autopsy must count the fallback), the t766
//      judgment note leads its block, zero storage writes, the old
//      residents keep their seats (dialog/swap/openrow testids, the
//      column-jump row, the teal=left title, the swap aria-pressed law).
//
// Runs standalone: node scripts/t766-pdiff-pours-unit.mjs  (exit 0 = all
// green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const src = readFileSync("src/components/workflow/params-diff-dialog.tsx", "utf8");
const lib = readFileSync("src/lib/workflow.ts", "utf8");

// ask the lib ITSELF (the t761 canonical loader: createJiti + alias
// @->src + await import — regex stays for the surgery file's word-forms,
// functions stay for the lib's semantics)
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } =
  await __jiti.import("../src/lib/workflow");

// strip line comments (but not strings) for word-form counting — the
// t760 meta-law: comments talk too, the counter must not bite them.
const stripLineComments = (s) =>
  s.split("\n").map((l) => {
    const i = l.indexOf("//");
    return i >= 0 ? l.slice(0, i) : l;
  }).join("\n");
const code = stripLineComments(src);

console.log("A — one book (the import merges, the gated ask rides)");
{
  assert(
    /import \{ jobType, pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/.test(src),
    "A1 import merges: three names, one home",
  );
  const gated = (code.match(/pourKindsOf\(/g) ?? []).length;
  assert(gated === 1, `A2 gated ask exactly once in file (comments stripped)`, `found ${gated}`);
  assert(code.includes("const spec = jobType(jobs[0].type);"), "A3 the spec ask verbatim (the dialog asks once)");
  assert(
    code.includes("const pouring = spec ? pourKindsOf(jobs[0].type) : [];"),
    "A4 riding ask verbatim (spec gates the pours)",
  );
  assert(
    code.includes("{spec ? (") && code.includes("data-testid={`params-diff-pours-${jobs[0].type}`}"),
    "A5 render gate closes on spec (the t760 verbatim form)",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A6 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  const seats = (code.match(/data-testid=\{`params-diff-pours-/g) ?? []).length;
  assert(seats === 1, "A7 exactly one seat (ONE mention speaks for the pair)", `found ${seats}`);
}

console.log("B — live-fire (40 types, zero ghosts, real ink)");
{
  assert(Array.isArray(JOB_TYPES) && JOB_TYPES.length === 40, `B1 40 types in the lib's job table`, `found ${JOB_TYPES.length}`);
  let ghost = 0;
  const dist = {};
  for (const t of JOB_TYPES) {
    for (const k of pourKindsOf(t.key)) if (!PORT_COLORS[k]) ghost++;
    const n = pourKindsOf(t.key).length;
    dist[n] = (dist[n] ?? 0) + 1;
  }
  assert(ghost === 0, "B2 zero ghost kinds (every pour is a port color)");
  const account = Object.entries(dist).map(([n, c]) => [Number(n), c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert(
    JSON.stringify(account) === JSON.stringify([[1, 35], [2, 3], [3, 2]]),
    "B3 t747 account FOURTEENTH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
    JSON.stringify(account),
  );
  assert(
    JSON.stringify(pourKindsOf("refine3d")) === JSON.stringify(["particles", "volume", "halfmap"]),
    "B4 refine3d pours particles, volume, halfmap (the lib's own answer)",
    JSON.stringify(pourKindsOf("refine3d")),
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).length > 0 && jobType(t.key) != null) &&
      pourKindsOf("no-such-type").length === 0,
    "B5 every known type speaks, the unknown silent (the undefined law's fifth face)",
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).every((k) => typeof PORT_COLORS[k]?.wire === "string" && PORT_COLORS[k].wire.startsWith("#"))),
    "B6 every pour's ink is a real PORT_COLORS wire (the dots' hex is the lib's, not guessed)",
  );
}

console.log("C — the face (thirteenth address, prose law, one mention for two)");
{
  assert(
    code.includes("data-testid={`params-diff-pours-${jobs[0].type}`}"),
    "C1 the thirteenth address verbatim (params-diff-pours-{type})",
  );
  const family = [
    "lens-pours-${", "peek-pours-${", "refmap-pours-${", "runtime-pours-${",
    "palette-fav-pours-${", "palette-pours-${", "queue-pours-${",
    "cmd-pours-${", "cmd-preset-pours-${", "cmd-user-pours-${", "shelf-pours-${",
    "storage-pours-${",
  ];
  assert(
    family.every((f) => !src.includes(f)),
    "C2 no collision with the family's twelve DOM addresses (none of them lives here)",
  );
  assert(
    code.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C3 container class verbatim (the prose law's third staging)",
  );
  // dialect equation, THIRTEENTH staging: the container class verbatim-
  // equals the t760 refmap prose word-form ACROSS FILES (one prose law)
  const t760 = stripLineComments(readFileSync("src/components/workflow/reference-map-card.tsx", "utf8"));
  assert(
    t760.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C4 dialect equation thirteenth staging: container verbatim-equals t760 across files (one prose law)",
  );
  assert(
    code.includes("aria-hidden=\"true\"") &&
      /title=\{`pours \$\{k\}`\}/.test(code) &&
      code.includes("inline-block size-1.5 rounded-full") &&
      code.includes("style={{ background: PORT_COLORS[k].wire }}") &&
      code.includes('className="sr-only">pours {pouring.join(", ")}'),
    "C5 per-dot anatomy + sr-only ear line verbatim",
  );
  const typePos = src.indexOf("the two selected {jobs[0].type}");
  const waterPos = src.indexOf("params-diff-pours-");
  const jobsPos = src.indexOf("jobs, side by");
  assert(
    typePos >= 0 && waterPos > typePos && jobsPos > waterPos,
    "C6 seat regex: type word -> water -> the 'jobs' word (water glued)",
  );
  const mentions = (code.match(/the two selected \{jobs\[0\]\.type\}/g) ?? []).length;
  assert(mentions === 1, "C7 ONE mention speaks for two (the picker's guard made the pair same-type)", `found ${mentions}`);
}

console.log("D — purity (two residents audited, note leads, old residents seated)");
{
  const hexes = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert(
    hexes === 3,
    `D1 THREE hex = THREE (COLUMN_COLORS teal/amber + the #71717a orphan colorOf fallback — the residents audited, not purged; the t761 form: purity bites additions, not stock — and the autopsy must count the fallback)`,
    `found ${hexes}`,
  );
  assert(
    src.includes("t766 — the pours ask rides the description's own type word"),
    "D2 the t766 judgment note leads its block",
  );
  const storage = (src.match(/localStorage|sessionStorage/g) ?? []).length;
  assert(storage === 0, `D3 zero storage writes`, `found ${storage}`);
  for (const resident of [
    'data-testid="params-diff-dialog"',
    'data-testid="params-diff-swap"',
    'data-testid="params-diff-openrow"',
    'aria-pressed={swapped}',
    "teal = left",
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 44)}`);
  }
  assert(src.includes("Task 90 — column-jump row"), "D5 the Task 90 column-jump law survives");
}

console.log(`\nt766-pdiff-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
