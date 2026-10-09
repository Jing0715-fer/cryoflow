// t772 — the PARTICLE FUNNEL's census line speaks the pours words: the
// kind vocabulary's THIRTIETH reader, the family's SEVENTEENTH testid
// address (funnel-pours-). The census is the chain's confession of what
// the mainline left behind — "Off this mainline, the same chain also
// fed: Name (type) · Name (type). The walk follows one line at each
// branch — these ran beside it." The census's BESIDE-FACE of the
// commitment-seat taxonomy: these verbs ran on the same particles, and
// kinds have different wire contracts — the name says WHO ran beside,
// the type says WHAT it was, the water says which wires that kind feeds
// on. This is the PROSE LAW's home turf (the t760 seat's third staging
// with t766): the type word lives inside mono parens in running text,
// the dots hug the parenthetical inline (display:flex would break the
// sentence into blocks — the seat's physics is its witness), the ask
// rides the map's own row (one source word-form, one dose per census
// entry), and the gate closes on spec (the t760 prose ternary — the
// riding ask pairs with the spec gate). The file's TWO {" "} glue
// payments and eight truncate-family payments cohabit untouched.
//
//   A  one book: the import joins (three names, one home); the gated
//      ask appears exactly once in the FILE (comments stripped — the
//      t760 meta-law); the spec ask + riding ask verbatim (j.type —
//      the census entry's own word); the ask rides the map (map -> spec
//      -> pouring -> return); the render gate closes on spec (the t760
//      prose ternary); the lib home keeps its question; exactly one
//      seat.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      NINETEENTH-interlocked, refine3d pours by the lib's own answer,
//      every known type speaks, the unknown silent, every pour's ink is
//      a real PORT_COLORS wire.
//   C  the face: the seventeenth address verbatim, no collision with
//      the family's SIXTEEN other DOM addresses, the container class
//      verbatim (dialect equation EIGHTEENTH staging, cross-file
//      verbatim vs t760 + t766 + t767 + t768 + t769 + t771), per-dot
//      anatomy + sr-only ear line, the seat regex (the name's glue ->
//      the mono parens -> the water -> the beside-tail), the hug form
//      proven (no rendered content between the parens and the seat),
//      the boundary clause's two faces in one file (the prose host's
//      TWO {" "} glue payments survive / eight truncate-family payments
//      intact), the type word's room untouched.
//   D  purity: ZERO hex = ZERO (the whole-stock audit ran BEFORE the
//      anchor was written), the t772 judgment notes lead their blocks,
//      ZERO storage mentions = ZERO, the old residents keep their seats
//      (the census head, the beside-tail, the export/copy doors, the
//      entry types, the fetcher, the head law), and the summoner
//      (canvas-funnel-door) still mounts this dialog.
//
// Runs standalone: node scripts/t772-funnel-pours-unit.mjs  (exit 0 =
// all green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const src = readFileSync("src/components/workflow/results/particle-funnel-dialog.tsx", "utf8");
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
// (Block comments survive — position anchors therefore use the FULL
// testid word-form only the seat holds: the t767 lesson baked in.)
const stripLineComments = (s) =>
  s.split("\n").map((l) => {
    const i = l.indexOf("//");
    return i >= 0 ? l.slice(0, i) : l;
  }).join("\n");
const code = stripLineComments(src);

console.log("A — one book (the import joins, the ask rides the census map)");
{
  assert(
    /import \{ jobType, pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/.test(src),
    "A1 import joins: three names, one home",
  );
  const gated = (code.match(/pourKindsOf\(/g) ?? []).length;
  assert(gated === 1, `A2 gated ask exactly once in file (comments stripped)`, `found ${gated}`);
  assert(code.includes("const spec = jobType(j.type);"), "A3 the spec ask verbatim (the census entry's own word)");
  assert(
    code.includes("const pouring = spec ? pourKindsOf(j.type) : [];"),
    "A4 riding ask verbatim (spec gates the pours)",
  );
  // the ask rides the map — inside the census map callback, before its
  // return (the dose follows each entry's own word)
  const mapPos = code.indexOf("payload.offMainline.map((j, i) => {");
  const specPos = code.indexOf("const spec = jobType(j.type);");
  const pouringPos = code.indexOf("const pouring = spec ? pourKindsOf(j.type) : [];");
  const returnPos = code.indexOf("              return (");
  assert(
    mapPos >= 0 && specPos > mapPos && pouringPos > specPos && returnPos > pouringPos,
    "A5 the ask rides the census map (map -> spec -> pouring -> return)",
  );
  assert(
    code.includes("{spec ? (") && code.includes("data-testid={`funnel-pours-${j.type}`}"),
    "A6 render gate closes on spec (the t760 prose ternary — the riding ask's own form)",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A7 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  const seats = (code.match(/data-testid=\{`funnel-pours-/g) ?? []).length;
  assert(seats === 1, "A8 exactly one seat (one word-form, one dose per census entry)", `found ${seats}`);
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
    "B3 t747 account NINETEENTH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
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
    "B5 every known type speaks, the unknown silent (the undefined law's face)",
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).every((k) => typeof PORT_COLORS[k]?.wire === "string" && PORT_COLORS[k].wire.startsWith("#"))),
    "B6 every pour's ink is a real PORT_COLORS wire (the dots' hex is the lib's, not guessed)",
  );
}

console.log("C — the face (seventeenth address, prose law's home turf)");
{
  assert(
    code.includes("data-testid={`funnel-pours-${j.type}`}"),
    "C1 the seventeenth address verbatim (funnel-pours-{type})",
  );
  const family = [
    "lens-pours-${", "peek-pours-${", "refmap-pours-${", "runtime-pours-${",
    "palette-fav-pours-${", "palette-pours-${", "queue-pours-${",
    "cmd-pours-${", "cmd-preset-pours-${", "cmd-user-pours-${", "shelf-pours-${",
    "storage-pours-${", "params-diff-pours-${", "cleanup-pours-${",
    "remote-pours-${", "fsc-compare-pours-${",
  ];
  assert(
    family.every((f) => !src.includes(f)),
    "C2 no collision with the family's SIXTEEN other DOM addresses (none of them lives here)",
  );
  assert(
    code.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C3 container class verbatim (the family's canonical container)",
  );
  // dialect equation, EIGHTEENTH staging: the container class verbatim-
  // equals the t760 prose form AND the t766 + t767 + t768 + t769 + t771
  // seats ACROSS FILES
  const t760 = stripLineComments(readFileSync("src/components/workflow/reference-map-card.tsx", "utf8"));
  const t766 = stripLineComments(readFileSync("src/components/workflow/params-diff-dialog.tsx", "utf8"));
  const t767 = stripLineComments(readFileSync("src/components/workflow/cleanup-dialog.tsx", "utf8"));
  const t768 = stripLineComments(readFileSync("src/components/workflow/remote-run-button.tsx", "utf8"));
  const t769 = stripLineComments(readFileSync("src/components/workflow/storage-dialog.tsx", "utf8"));
  const t771 = stripLineComments(readFileSync("src/components/workflow/results/fsc-compare-dialog.tsx", "utf8"));
  assert(
    t760.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t766.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t767.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t768.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t769.includes('className="inline-flex shrink-0 items-center gap-1"') &&
      t771.includes('className="inline-flex shrink-0 items-center gap-1"'),
    "C4 dialect equation eighteenth staging: container verbatim-equals t760 + t766 + t767 + t768 + t769 + t771 across files",
  );
  assert(
    code.includes("aria-hidden=\"true\"") &&
      /title=\{`pours \$\{k\}`\}/.test(code) &&
      code.includes("inline-block size-1.5 rounded-full") &&
      code.includes("style={{ background: PORT_COLORS[k].wire }}") &&
      code.includes('className="sr-only">pours {pouring.join(", ")}'),
    "C5 per-dot anatomy + sr-only ear line verbatim",
  );
  // position anchor on unique word-forms: the name's glue (the census's
  // existing {" "} payment) -> the mono parens -> the water -> the
  // beside-tail (the sentence the census closes with)
  const namePos = code.indexOf("text-foreground/80");
  const parenPos = code.indexOf("({j.type})");
  const waterPos = code.indexOf("funnel-pours-${j.type}");
  const tailPos = code.indexOf("The walk follows one line");
  assert(
    namePos >= 0 && parenPos > namePos && waterPos > parenPos && tailPos > waterPos,
    "C6 seat regex: the name's glue -> the mono parens -> the water -> the beside-tail",
  );
  // the HUG form proven: no RENDERED content between the parens and the
  // seat (the seat comment is prose, stripped here — the t771 lesson:
  // count the code, not the prose about the code)
  const hug = /\(\{j\.type\}\)\s*\{spec \? \(/.test(code);
  assert(
    hug && !/\(\{j\.type\}\)\{" "\}/.test(code),
    "C7a the hug form: the water directly follows the parenthetical (no glue needed — the next iteration's separator speaks)",
  );
  // the boundary clause's TWO FACES in one file (the t760 shape,
  // replayed): the prose host keeps paying its TWO explicit {" "} glue
  // debts (the sentence head + the name gap), the file's eight
  // truncate-family payments survive, and the seat added NEITHER
  const glues = (code.match(/\{" "\}/g) ?? []).length;
  const payments = (code.match(/truncate|min-w-0|overflow|whitespace-nowrap/g) ?? []).length;
  assert(
    glues === 2 && payments === 8,
    "C7b boundary clause two faces: the prose host's TWO {\" \"} glue payments + EIGHT text-flow payments intact (the seat added neither)",
    `glues ${glues}, payments ${payments}`,
  );
  assert(
    code.includes("({j.type})") && code.includes('{j.name}</span>{" "}'),
    "C8 the type word's room untouched (mono parens verbatim, the name's glue intact)",
  );
}

console.log("D — purity (zero hex, zero storage, residents seated, summoner wired)");
{
  const hexes = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert(
    hexes === 0,
    `D1 ZERO hex = ZERO (the whole-stock audit ran BEFORE the anchor was written — the t766/t767/t768 lesson applied: count first, anchor second)`,
    `found ${hexes}`,
  );
  assert(
    src.includes("t772 — the census line speaks the kind vocabulary") &&
      src.includes("t772 — the pours ask rides the census's own type word") &&
      src.includes("t772 — the census sentence names the type"),
    "D2 the t772 judgment notes lead their blocks (head + ask + seat)",
  );
  const storageHits = [...src.matchAll(/localStorage|sessionStorage/g)];
  assert(
    storageHits.length === 0,
    `D3 ZERO storage mentions = ZERO (the whole-stock audit ran BEFORE the anchor was written)`,
    `found ${storageHits.length}`,
  );
  for (const resident of [
    "Off this mainline",
    "The walk follows one line",
    'data-testid="funnel-export-csv"',
    'data-testid="funnel-copy-ledger"',
    "FUNNEL_ENTRY_TYPES",
    "fetchFunnel",
    "THE DOOR GUARDS ITSELF",
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 44)}`);
  }
  const summoner = readFileSync("src/components/workflow/canvas-funnel-door.tsx", "utf8");
  assert(
    summoner.includes("<ParticleFunnelDialog"),
    "D5 summoner wired: canvas-funnel-door still mounts the funnel dialog",
  );
}

console.log(`\nt772-funnel-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
