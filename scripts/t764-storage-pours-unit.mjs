// t764 — the STORAGE BOARD's three type-naming rows speak the pours
// words: the kind vocabulary's TWENTY-FIFTH reader, the family's TWELFTH
// testid address, and the t762 deferred UNIFICATION VERDICT cashed. The
// board names a run's type in words three times (`{dirName} · {type} ·
// {status}` — board rows, run lens, category lens), and one window pours
// all three: ONE gated ask (the StoragePours helper asks once), THREE
// seats (every word-form speaks), zero one-speaks-two-silent
// inconsistency (t762's exact dilemma — a single injection would have
// been a lie by omission, three separate asks would have been surgery
// bloat; the helper is the resolution form). The seats are truncate
// PROSE lines (mono, ellipsis), so the container is inline-flex — the
// t760 prose law's SECOND staging, the container class verbatim-equals
// the refmap word-form across files — and the dots sit right after the
// type word, BEFORE the status separator: water glued to the word it
// describes. Unknown types keep the bare line (the undefined law's
// fifth face); the sr-only ear line speaks the whole pour for readers
// who hear instead of hover.
//
//   A  one book: the import merges (three names, one home); the gated
//      ask appears exactly once in the FILE (comments stripped — the
//      t760 meta-law); the spec ask + riding ask + render gate verbatim;
//      the lib home keeps its question; exactly one helper, exactly
//      three seats.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      THIRTEENTH-interlocked, refine3d pours by the lib's own answer,
//      every known type speaks, the unknown silent, every pour's ink is
//      a real PORT_COLORS wire.
//   C  the face: the twelfth address (one testid word-form in the
//      helper, no collision with the family's eleven DOM addresses),
//      the container class verbatim (the prose law's second staging —
//      dialect equation TWELFTH staging, cross-file verbatim vs t760),
//      per-dot anatomy + sr-only ear line, the seat regex (type word ->
//      water -> status separator) three times, the three mono truncate
//      hosts intact.
//   D  purity: zero hex (empty ledger), the t764 judgment note leads
//      its block, zero storage writes, the old residents keep their
//      seats (CATEGORY_COLORS/CleanDoor/sortJobs/runStackSegments/
//      GraveRow), the t458 stack law survives.
//
// Runs standalone: node scripts/t764-storage-pours-unit.mjs  (exit 0 =
// all green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const src = readFileSync("src/components/workflow/storage-dialog.tsx", "utf8");
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

console.log("A — one book (the import merges, ONE ask, THREE seats)");
{
  assert(
    /import \{ jobType, pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/.test(src),
    "A1 import merges: three names, one home",
  );
  const gated = (code.match(/pourKindsOf\(/g) ?? []).length;
  assert(gated === 1, `A2 gated ask exactly once in file (comments stripped)`, `found ${gated}`);
  assert(code.includes("const spec = jobType(type);"), "A3 the spec ask verbatim (the helper asks once)");
  assert(
    code.includes("const pouring = spec ? pourKindsOf(type) : [];"),
    "A4 riding ask verbatim (spec gates the pours)",
  );
  assert(
    code.includes("if (pouring.length === 0) return null;"),
    "A5 render gate verbatim (the empty pours close the helper)",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A6 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  const helperCount = (code.match(/function StoragePours\(/g) ?? []).length;
  assert(helperCount === 1, "A7 exactly one helper (one ask, the unification's engine)", `found ${helperCount}`);
  // t769 honest repair 3->4: the graveyard drawer's type chip is the
  // helper's FOURTH seat — the promise seat's fifth face (the Restore
  // door's "wires re-attach" is the sentence, the water its color-face);
  // the helper's birth condition confirmed again (seats repeat, the ask
  // does not). The count was counted BEFORE the seat was written; this
  // anchor is the repair, not a guess.
  const seatCount = (code.match(/<StoragePours type=/g) ?? []).length;
  assert(seatCount === 4, "A8 exactly four seats (t769: the graveyard chip joins — one ask, four word-forms)", `found ${seatCount}`);
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
    "B3 t747 account THIRTEENTH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
    JSON.stringify(account),
  );
  assert(
    JSON.stringify(pourKindsOf("refine3d")) === JSON.stringify(["particles", "volume", "halfmap"]),
    "B4 refine3d pours particles, volume, halfmap (the lib's own answer)",
    JSON.stringify(pourKindsOf("refine3d")),
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).length > 0 && jobType(t.key) != null),
    "B5 every known type speaks (silence is for the unknown only)",
  );
  assert(
    pourKindsOf("no-such-type").length === 0 && jobType("no-such-type") == null,
    "B6 the unknown type stays silent at the lib (total lookup, empty pours)",
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).every((k) => typeof PORT_COLORS[k]?.wire === "string" && PORT_COLORS[k].wire.startsWith("#"))),
    "B7 every pour's ink is a real PORT_COLORS wire (the dots' hex is the lib's, not guessed)",
  );
}

console.log("C — the face (twelfth address, prose law second staging)");
{
  const addr = (code.match(/data-testid=\{`storage-pours-\$\{type\}`\}/g) ?? []).length;
  assert(addr === 1, "C1 the twelfth address defined once in the helper", `found ${addr}`);
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
    code.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C3 container class verbatim (the prose law's second staging)",
  );
  // dialect equation, TWELFTH staging: the container class verbatim-equals
  // the t760 refmap prose word-form ACROSS FILES (one prose law, one class)
  const t760 = stripLineComments(readFileSync("src/components/workflow/reference-map-card.tsx", "utf8"));
  assert(
    t760.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C4 dialect equation twelfth staging: container verbatim-equals t760 across files (one prose law)",
  );
  assert(
    code.includes("aria-hidden=\"true\"") &&
      /title=\{`pours \$\{k\}`\}/.test(code) &&
      code.includes("inline-block size-1.5 rounded-full") &&
      code.includes("style={{ background: PORT_COLORS[k].wire }}"),
    "C5 per-dot anatomy verbatim (aria-hidden + title + whisper size + wire ink)",
  );
  assert(
    code.includes('className="sr-only">pours {pouring.join(", ")}'),
    "C6 sr-only ear line verbatim (the hearing reader's whole pour)",
  );
  for (const [v, label] of [["job", "board row"], ["runLensRow", "run lens"], ["r", "category lens"]]) {
    const seat = new RegExp(`\\{${v}\\.type\\}\\{" "\\}\\s*\\n\\s*<StoragePours type=\\{${v}\\.type\\} \\/> · \\{${v}\\.status\\}`);
    assert(seat.test(src), `C7 seat regex (${label}): type word -> water -> status separator`);
  }
  const hosts = (src.match(/mt-0\.5 truncate font-mono text-\[11px\] text-muted-foreground/g) ?? []).length;
  assert(hosts === 3, `C8 the three mono truncate hosts intact (the seats' physics unchanged)`, `found ${hosts}`);
}

console.log("D — purity (zero hex, note leads, old residents seated)");
{
  const hexes = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert(hexes === 0, `D1 zero hex (the file held no palette residents — empty ledger)`, `found ${hexes}`);
  assert(
    src.includes("t764 — the kind vocabulary's TWENTY-FIFTH reader and the family's"),
    "D2 the t764 judgment note leads its block",
  );
  const storage = (src.match(/localStorage|sessionStorage/g) ?? []).length;
  assert(storage === 0, `D3 zero storage writes`, `found ${storage}`);
  for (const resident of [
    "const CATEGORY_COLORS: Record<StorageCategoryId, string> = {",
    "function CleanDoor({",
    "function WeighDoor({",
    "function sortJobs(",
    "import type { GraveRow } from \"@/lib/job-tombstone\";",
    "runStackSegments(",
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 44)}`);
  }
  assert(src.includes("t458: the stack — one segment per"), "D5 the t458 stack law survives (the board's byte story)");
}

console.log(`\nt764-storage-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
