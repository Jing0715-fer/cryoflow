// t769 — the GRAVEYARD CHIP seat probe: the StoragePours helper's FOURTH
// seat (the t764 reader's own board grows a grave row). The promise seat's
// FIFTH face: the grave row's Restore door promises "its workdir, run
// record and wires re-attach as if the delete never happened" — the water
// previews WHICH wires re-attach, the sentence's word-face and the dots'
// color-face of one promise. Genealogy: picker's selection (t763) -> diff's
// side-by-side (t766) -> cleanup's destruction (t767) -> remote's dispatch
// (t768) -> the grave's RESTORATION (t769).
//
// The seat is NOT a new reader and NOT a new address: the file already
// reads the vocabulary (t764's own import line) and the grave rides the
// helper's twelfth address form (storage-pours-${type}). What joins is a
// SEAT — the helper's birth condition (seats repeat, the ask does not)
// confirmed at four. And the physics: three prose hosts glue the water to
// the type word, this flex host seats it as a chip sibling — ONE inline-flex
// container serves both physics (the boundary clause's third staging:
// context-neutral physics, the row's gap-2 speaks, flex owes nothing).
//
// Stock counted BEFORE any anchor was written (the t768 discipline):
//   hex 0 · <StoragePours type= 3 -> 4 · <StoragePours type={g.type} 0 -> 1
//   {" "} 7 (unchanged — flex host pays nothing) · storage writes 0
//
//   A  the ask & the seat: the t764 import still leads (no new reader —
//      the fourth seat reuses the family's own line); the gated ask exactly
//      once in the FILE (comments stripped — the t760 meta-law); spec ask +
//      riding ask + render gate verbatim; the lib home keeps its question;
//      exactly one helper, exactly FOUR seats; the fourth seat's word-form
//      unique (type={g.type} — the other three prose seats hold their own
//      variables); seat adjacency (chip close -> water, no payment between).
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      SEVENTEENTH-interlocked, refine3d pours by the lib's own answer,
//      every known type speaks, the unknown silent, every pour's ink is a
//      real PORT_COLORS wire.
//   C  the face: the twelfth address defined once (no new testid — the
//      grave rides the family form), no collision with the family's other
//      FOURTEEN DOM addresses, container class verbatim (dialect equation
//      SIXTEENTH staging — cross-file verbatim vs t760 + t767 + t768),
//      per-dot anatomy + sr-only ear, the flex host's row class intact +
//      the file's seven text-flow payments survive (both disciplines
//      cohabiting one file, the boundary clause's two faces), the chip's
//      mono anatomy untouched, position anchor (chip -> water -> age).
//   D  purity: zero hex = 0 (the whole-stock audit ran BEFORE the anchor),
//      the t769 judgment note leads its block, zero storage writes, the
//      old residents keep their graves (graveyard testids, graveAge,
//      GraveRow import), the restore promise sentence survives, the t764
//      A8 repair is honest (its probe now holds four + the judgment note),
//      both shovel doors still wired.
//
// Runs standalone: node scripts/t769-grave-pours-unit.mjs  (exit 0 = all
// green; every failure prints FAIL + the assert label).

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
const t764probe = readFileSync("scripts/t764-storage-pours-unit.mjs", "utf8");

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

console.log("A — the ask & the seat (one book, four seats, two host physics)");
{
  assert(
    code.includes('import { jobType, pourKindsOf, PORT_COLORS } from "@/lib/workflow";'),
    "A1 the t764 import still leads (no new reader — the fourth seat reuses the family's own line)",
  );
  const askCount = (code.match(/const pouring = spec \? pourKindsOf\(/g) ?? []).length;
  assert(askCount === 1, "A2 the gated ask exactly once in the FILE (comments stripped)", `found ${askCount}`);
  assert(
    code.includes("const spec = jobType(type);") &&
      code.includes("const pouring = spec ? pourKindsOf(type) : [];"),
    "A3 helper spec ask + riding ask verbatim (the lib answers, the helper rides)",
  );
  assert(
    code.includes("if (pouring.length === 0) return null;"),
    "A4 render gate verbatim (the empty pours close the helper — unknown graves keep the bare chip)",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A5 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  const helperCount = (code.match(/function StoragePours\(/g) ?? []).length;
  assert(helperCount === 1, "A6 exactly one helper (one ask — the unification's engine, fourth seat does not fork it)", `found ${helperCount}`);
  const seatCount = (code.match(/<StoragePours type=/g) ?? []).length;
  assert(seatCount === 4, "A7 exactly FOUR seats (one ask, four word-forms — the birth condition confirmed at four)", `found ${seatCount}`);
  const graveSeat = (code.match(/<StoragePours type=\{g\.type\} \/>/g) ?? []).length;
  assert(
    graveSeat === 1 &&
      code.includes("<StoragePours type={job.type} />") &&
      code.includes("<StoragePours type={runLensRow.type} />") &&
      code.includes("<StoragePours type={r.type} />"),
    "A8 the fourth seat's word-form unique (type={g.type}) + the three prose seats' word-forms intact",
  );
  assert(
    /\{g\.type\}\s*\n\s*<\/span>\s*\n\s*<StoragePours type=\{g\.type\} \/>/.test(src),
    "A9 seat adjacency: chip close -> water (flex sibling — the gap-2 speaks, no {\" \"} payment between)",
  );
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
    "B3 t747 account SEVENTEENTH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
    JSON.stringify(account),
  );
  assert(
    JSON.stringify(pourKindsOf("refine3d")) === JSON.stringify(["particles", "volume", "halfmap"]),
    "B4 refine3d pours particles, volume, halfmap (the grave of a refine speaks its three wires)",
    JSON.stringify(pourKindsOf("refine3d")),
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).length > 0 && jobType(t.key) != null),
    "B5 every known type speaks (a restorable grave of a known kind shows what comes back)",
  );
  assert(
    pourKindsOf("no-such-type").length === 0 && jobType("no-such-type") == null,
    "B6 the unknown type stays silent at the lib (a grave of unknown kind keeps the bare chip)",
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).every((k) => typeof PORT_COLORS[k]?.wire === "string" && PORT_COLORS[k].wire.startsWith("#"))),
    "B7 every pour's ink is a real PORT_COLORS wire (the dots' hex is the lib's, not guessed)",
  );
}

console.log("C — the face (context-neutral physics, the boundary clause's two faces)");
{
  const addr = (code.match(/data-testid=\{`storage-pours-\$\{type\}`\}/g) ?? []).length;
  assert(addr === 1, "C1 the twelfth address defined once in the helper (no new testid — the grave rides the family form)", `found ${addr}`);
  const family = [
    "lens-pours-${", "peek-pours-${", "refmap-pours-${", "runtime-pours-${",
    "palette-fav-pours-${", "palette-pours-${", "queue-pours-${",
    "cmd-pours-${", "cmd-preset-pours-${", "cmd-user-pours-${", "shelf-pours-${",
    "pdiff-pours-${", "cleanup-pours-${", "remote-pours-${",
  ];
  assert(
    family.every((f) => !src.includes(f)),
    "C2 no collision with the family's other FOURTEEN DOM addresses (storage-pours is home here)",
  );
  assert(
    code.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C3 container class verbatim (the intersection form — prose glue and flex sibling share it)",
  );
  const t760 = stripLineComments(readFileSync("src/components/workflow/reference-map-card.tsx", "utf8"));
  const t767 = stripLineComments(readFileSync("src/components/workflow/cleanup-dialog.tsx", "utf8"));
  const t768 = stripLineComments(readFileSync("src/components/workflow/remote-run-button.tsx", "utf8"));
  const container = 'className="inline-flex shrink-0 items-center gap-1"';
  assert(
    t760.includes(container) && t767.includes(container) && t768.includes(container),
    "C4 dialect equation SIXTEENTH staging: container verbatim-equals t760 + t767 + t768 across files (one seat physics, four files)",
  );
  assert(
    code.includes('aria-hidden="true"') &&
      /title=\{`pours \$\{k\}`\}/.test(code) &&
      code.includes("inline-block size-1.5 rounded-full") &&
      code.includes("style={{ background: PORT_COLORS[k].wire }}"),
    "C5 per-dot anatomy verbatim (aria-hidden + title + whisper size + wire ink)",
  );
  assert(
    code.includes('className="sr-only">pours {pouring.join(", ")}'),
    "C6 sr-only ear line verbatim (the hearing reader's whole pour)",
  );
  assert(
    code.includes('className="flex items-center gap-2 text-xs"') &&
      src.includes("<StoragePours type={g.type} />") &&
      !/\{" "\}\s*\n\s*<StoragePours type=\{g\.type\}/.test(src) &&
      (src.match(/\{" "\}/g) ?? []).length === 7,
    "C7 the flex host owes nothing + the prose hosts keep paying (row gap-2 intact, no payment at the grave seat, the file's seven text-flow debts unchanged — both disciplines cohabiting)",
    `payments: ${(src.match(/\{" "\}/g) ?? []).length}`,
  );
  assert(
    code.includes("shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"),
    "C8 the chip's mono anatomy untouched (the water rides AFTER the chip, the badge law holds)",
  );
  const chipPos = code.indexOf('shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground');
  const seatPos = code.indexOf("<StoragePours type={g.type}");
  const agePos = code.indexOf('title={new Date(g.deletedAt).toLocaleString()}');
  assert(
    chipPos >= 0 && seatPos > chipPos && agePos > seatPos,
    "C9 position anchor: chip -> water -> age (the seat follows the type word — full word-forms only the seats hold)",
    `chip ${chipPos} seat ${seatPos} age ${agePos}`,
  );
}

console.log("D — purity (zero hex, note leads, old residents seated, the repair honest)");
{
  const hexes = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert(hexes === 0, `D1 ZERO hex = ZERO (the whole-stock audit ran BEFORE the anchor was written — 0 hex before, 0 after)`, `found ${hexes}`);
  assert(
    src.includes("t769 — the FOURTH seat joins") && src.includes("t769 — each grave's type chip speaks the pours"),
    "D2 the t769 judgment note leads its blocks (helper contract + drawer neighborhood)",
  );
  const storage = (src.match(/localStorage|sessionStorage/g) ?? []).length;
  assert(storage === 0, `D3 zero storage writes`, `found ${storage}`);
  for (const resident of [
    'data-testid="graveyard-row"',
    'data-testid="graveyard-row-toggle"',
    'data-testid="graveyard-epitaph"',
    "function graveAge(",
    'import type { GraveRow } from "@/lib/job-tombstone";',
    "function CleanDoor({",
    "function WeighDoor(",
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 48)}`);
  }
  assert(
    src.includes('title="Bring it back under its original id — its workdir, run record and wires re-attach as if the delete never happened"'),
    "D5 the restore promise sentence survives (the water's word-face — the sentence the dots color)",
  );
  assert(
    t764probe.includes("seatCount === 4") &&
      t764probe.includes("t769 honest repair 3->4"),
    "D6 the t764 A8 repair is honest (its probe holds four + the judgment note — counted before, repaired not guessed)",
  );
  assert(
    src.includes('aria-label={`Clean ${name} intermediates`}') ||
      src.includes("function CleanDoor("),
    "D7 the shovel door still wired (CleanDoor — the board's destructive affordance unchanged)",
  );
  const restoreAria = (src.match(/aria-label=\{`Restore \$\{g\.name \?\? g\.type\} to the canvas`\}/g) ?? []).length;
  assert(restoreAria === 1, "D8 the Restore door's aria word-form intact (the seat's own summoner — the door the water advertises)", `found ${restoreAria}`);
}

console.log(`\nt769-grave-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
