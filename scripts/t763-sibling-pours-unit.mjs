// t763 — the SIBLING COMPARE PICKER's trigger contracts speak the pours
// words: the kind vocabulary's TWENTY-FOURTH reader, the family's SECOND
// pure word-form reader (the t761 lineage's second staging). t762's
// deferred verdict is cashed: the picker's small door cannot fit a dot
// family, so the water is HEARD, not seen — the icon variant's aria-label
// + title and the labeled variant's title all name the job type, and each
// contract gains the " — pours ..." suffix glued to the word it describes
// (identity words first, water after). No dots, no testid address: the
// contract IS the seat — the family ledger records a word-form seat, the
// t761 precedent's second face. The popover header keeps its bare type
// word DELIBERATELY: it labels the list after the open, not at the
// commitment moment — the water lives at the decision point (the t762
// choice-seat doctrine), and the header's unification question belongs
// to the storage-dialog window, not this one.
//
//   A  one book: the import merges (TWO names, one home — no PORT_COLORS,
//      the pure word-form reader carries no palette); the gated ask
//      appears exactly once in the FILE (comments stripped — the t760
//      meta-law); the spec ask + riding ask + suffix empty-gate verbatim;
//      the lib home keeps its question; three contracts interpolate the
//      suffix.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      TWELFTH-interlocked, refine3d pours by the lib's own answer, the
//      suffix rebuilt live-fire (known speaks, unknown silent, every
//      suffix answers to the contract shape).
//   C  the face: NO testid address (the second word-form seat — zero
//      `pours-${` in the file, no collision with the family's eleven DOM
//      addresses), the three contracts verbatim, the seat regex (identity
//      -> water, three times), the dialect equation's ELEVENTH staging:
//      the suffix builder verbatim-equals the t761 word-form lineage's
//      contract across files.
//   D  purity: zero hex (empty ledger), the t763 judgment note leads its
//      block, zero storage writes, the old residents keep their seats
//      (compare-button/option/popover testids, STATUS_DOT, SiblingDiffChip,
//      the "Runs in workspace" hook t88 leans on), the popover header's
//      bare type word (the parked scoping witnessed), the diff chip's own
//      title contract untouched.
//
// Runs standalone: node scripts/t763-sibling-pours-unit.mjs  (exit 0 = all
// green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const src = readFileSync("src/components/workflow/sibling-compare-picker.tsx", "utf8");
const lib = readFileSync("src/lib/workflow.ts", "utf8");

// ask the lib ITSELF, not a guessed table shape (the t762 canonical
// loader: createJiti + alias @->src + await import — regex stays for the
// surgery file's word-forms, functions stay for the lib's semantics)
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
    /import \{ jobType, pourKindsOf \} from "@\/lib\/workflow";/.test(src),
    "A1 import merges: two names, one home (no PORT_COLORS — word-form reader carries no palette)",
  );
  const gated = (code.match(/pourKindsOf\(/g) ?? []).length;
  assert(gated === 1, `A2 gated ask exactly once in file (comments stripped)`, `found ${gated}`);
  assert(code.includes("const spec = jobType(job.type);"), "A3 the spec ask verbatim (the picker asks once)");
  assert(
    code.includes("const pouring = spec ? pourKindsOf(job.type) : [];"),
    "A4 riding ask verbatim (spec gates the pours)",
  );
  assert(
    code.includes('const poursSuffix = pouring.length > 0 ? ` — pours ${pouring.join(", ")}` : "";'),
    "A5 suffix empty-gate verbatim (the t761 contract)",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A6 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  const interp = (code.match(/\$\{poursSuffix\}/g) ?? []).length;
  assert(interp === 3, "A7 three contracts interpolate the suffix (aria + icon title + labeled title)", `found ${interp}`);
}

console.log("B — live-fire (40 types, zero ghosts, the suffix rebuilt)");
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
    "B3 t747 account TWELFTH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
    JSON.stringify(account),
  );
  assert(
    JSON.stringify(pourKindsOf("refine3d")) === JSON.stringify(["particles", "volume", "halfmap"]),
    "B4 refine3d pours particles, volume, halfmap (the lib's own answer)",
    JSON.stringify(pourKindsOf("refine3d")),
  );
  // the suffix rebuilt live-fire, exactly the way the component builds it
  const sfx = (t) => {
    const spec = jobType(t);
    const pouring = spec ? pourKindsOf(t) : [];
    return pouring.length > 0 ? ` — pours ${pouring.join(", ")}` : "";
  };
  assert(
    sfx("refine3d") === " — pours particles, volume, halfmap",
    "B5 refine3d's suffix rebuilt live-fire (the contract's product)",
    JSON.stringify(sfx("refine3d")),
  );
  assert(sfx("no-such-type") === "", "B6 the unknown type's suffix stays empty (the undefined law's fifth face)");
  assert(
    JOB_TYPES.every((t) => {
      const s = sfx(t.key);
      return s === "" || (s.startsWith(" — pours ") && s.length > " — pours ".length);
    }),
    "B7 every known type's suffix answers to the contract shape (empty or ' — pours ...')",
  );
}

console.log("C — the face (no address, three verbatim contracts, the lineage equation)");
{
  const addr = (src.match(/pours-\$\{/g) ?? []).length;
  assert(addr === 0, "C1 NO testid address (the second pure word-form seat — zero `pours-${` in the file)", `found ${addr}`);
  const family = [
    "lens-pours-${", "peek-pours-${", "refmap-pours-${", "runtime-pours-${",
    "palette-fav-pours-${", "palette-pours-${", "queue-pours-${",
    "cmd-pours-${", "cmd-preset-pours-${", "cmd-user-pours-${", "shelf-pours-${",
  ];
  assert(
    family.every((f) => !src.includes(f)),
    "C2 no collision with the family's eleven DOM addresses (none of them lives here)",
  );
  assert(
    code.includes("Compare parameters with another ${job.type} job${poursSuffix} (${siblings.length} sibling"),
    "C3 icon aria-label contract verbatim (identity -> water -> sibling counts)",
  );
  assert(
    code.includes("Compare launch parameters with another ${job.type} job${poursSuffix} — ${siblings.length} sibling"),
    "C4 icon title contract verbatim (identity -> water -> sibling counts)",
  );
  assert(
    code.includes("Compare launch parameters with another ${job.type} job${poursSuffix}`}"),
    "C5 labeled title contract verbatim (identity -> water, then close)",
  );
  const glued = (code.match(/another \$\{job\.type\} job\$\{poursSuffix\}/g) ?? []).length;
  assert(glued === 3, "C6 seat regex: identity -> water, three times (the water always glued)", `found ${glued}`);
  // dialect equation, ELEVENTH staging: the word-form lineage's contract
  // is ONE contract — the suffix builder verbatim-equals the t761 line
  const t761 = readFileSync("src/components/workflow/template-shape-preview.tsx", "utf8");
  const line = 'const poursSuffix = pouring.length > 0 ? ` — pours ${pouring.join(", ")}` : "";';
  assert(
    code.includes(line) && stripLineComments(t761).includes(line),
    "C7 dialect equation eleventh staging: suffix builder verbatim-equals t761 (one lineage, one contract)",
  );
}

console.log("D — purity (zero hex, note leads, old residents seated)");
{
  const hexes = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert(hexes === 0, `D1 zero hex (the file held no palette residents — empty ledger)`, `found ${hexes}`);
  assert(
    src.includes("t763 — the pours ask rides the trigger's own contracts"),
    "D2 the t763 judgment note leads its block",
  );
  const storage = (src.match(/localStorage|sessionStorage/g) ?? []).length;
  assert(storage === 0, `D3 zero storage writes`, `found ${storage}`);
  for (const resident of [
    "`${idPrefix}-compare-button`",
    "`${idPrefix}-compare-option`",
    "`${idPrefix}-compare-popover`",
    'import { STATUS_DOT } from "@/lib/status-style";',
    "export function SiblingDiffChip",
    "Runs in workspace", // t88's hook — the chip title's curly quotes mean the bare prefix is the honest anchor
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 44)}`);
  }
  assert(
    src.includes("Compare with a {job.type} sibling") &&
      !code.includes("Compare with a ${job.type} sibling${poursSuffix}"),
    "D5 the popover header keeps its bare type word (the parked scoping witnessed)",
  );
  assert(
    code.includes("opens the side-by-side table") && !code.includes("table${poursSuffix}"),
    "D6 the diff chip's own title contract untouched",
  );
}

console.log(`\nt763-sibling-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
