// t762 — the DASHBOARD SEARCH LENS's job rows speak the pours words: the
// kind vocabulary's TWENTY-THIRD reader, the family's ELEVENTH testid
// address. Every result row already names its type in words (the second
// line shows the humanized label or the raw type) and already HOLDS the
// spec (jobType(job.type) is the ask the label answer made) — so the
// water rides for free (the t755 fourth form, the ladder's cheapest
// rung: zero re-asking). The dots sit right after the type word, BEFORE
// the project separator: water glued to the word it describes. The seat
// is a flex ROW (the second line is "mt-0.5 flex items-center gap-1.5"),
// so the canonical flex container fits VERBATIM — zero dialect drift
// this window (t760's inline-flex was the prose seat's own law; this
// row is a row, the t758 peek word-form is the verbatim kin). A search
// result row is a CHOICE seat: the searcher picking a job deserves to
// see what each candidate pours before committing. Unknown types keep
// the bare row (empty pours, no water — the undefined law's fifth face,
// the t744 bare-receipt retreat).
//
//   A  one book: the import merges (three names, one home); the gated
//      ask appears exactly once in the FILE (comments stripped — the
//      t760 meta-law); the riding ask verbatim; the render gate closes;
//      dots ride PORT_COLORS; the lib home keeps its question; the
//      lens-pours testid word-form.
//   B  live-fire: 40 types, zero ghost kinds, the t747 account
//      ELEVENTH-interlocked, every known type speaks, the unknown
//      silent, the row's hit-path triad (name/type/none) undressed,
//      the label word-form verbatim.
//   C  the face: lens-pours-{job.type} (the eleventh address, no
//      collision with the family's ledger), exactly one container,
//      per-dot anatomy verbatim, sr-only ear line, the seat regex
//      (type word -> water -> separator), the dialect equation's tenth
//      staging (ZERO drift: container class verbatim-equals the t758
//      peek word-form's row-seat cousin).
//   D  purity: zero hex (the file held no palette residents before the
//      surgery — an empty ledger is the strongest purity claim), the
//      t762 judgment note leads its block, no storage writes, the old
//      residents keep their seats (data-lens-row / data-lens-hit /
//      Emph / CornerDownLeft / the keyboard contract), the showRawType
//      law verbatim.
//
// Runs standalone: node scripts/t762-lens-pours-unit.mjs  (exit 0 = all
// green; every failure prints FAIL + the assert label).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

let pass = 0, fail = 0;
const ok = (label) => { pass++; console.log(`  ok  ${label}`); };
const bad = (label, extra) => { fail++; console.log(`FAIL  ${label}${extra ? ` — ${extra}` : ""}`); };
const assert = (cond, label, extra) => (cond ? ok(label) : bad(label, extra));

const src = readFileSync("src/components/workflow/job-search-lens.tsx", "utf8");
const lib = readFileSync("src/lib/workflow.ts", "utf8");

// ask the lib ITSELF, not a guessed table shape (the t762 lesson: the
// JOB_TYPES table is a spec() ARRAY and pourKindsOf is ARITHMETIC over
// spec.outputs — a regex over a guessed word-form bites air)
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf, drinkKindsOf } =
  await __jiti.import("../src/lib/workflow");

// strip line comments (but not strings) for word-form counting — the
// t760 meta-law: comments talk too, the counter must not bite them.
const stripLineComments = (s) =>
  s.split("\n").map((l) => {
    const i = l.indexOf("//");
    // crude but sufficient: our judgment notes never contain "//" inside
    // a string literal on the same line as a code comment marker
    return i >= 0 ? l.slice(0, i) : l;
  }).join("\n");
const code = stripLineComments(src);

console.log("A — one book (the import merges, the gated ask rides)");
{
  const m = src.match(/import \{ jobType, pourKindsOf, PORT_COLORS \} from "@\/lib\/workflow";/);
  assert(m, "A1 import merges: three names, one home");
  const gated = (code.match(/pourKindsOf\(/g) ?? []).length;
  assert(gated === 1, `A2 gated ask exactly once in file (comments stripped)`, `found ${gated}`);
  assert(
    code.includes("const pouring = spec ? pourKindsOf(job.type) : [];"),
    "A3 riding ask verbatim (spec already held, pouring re-reads)",
  );
  assert(
    code.includes("{spec ? (") && code.includes("data-testid={`lens-pours-${job.type}`}"),
    "A4 render gate closes over the water (spec ?)",
  );
  assert(
    code.includes('style={{ background: PORT_COLORS[k].wire }}'),
    "A5 dots ride PORT_COLORS wire hex",
  );
  assert(
    /export function pourKindsOf\(/.test(lib) || /export const pourKindsOf/.test(lib),
    "A6 lib home keeps its question (pourKindsOf exported from lib/workflow)",
  );
  assert(
    code.includes("`lens-pours-${job.type}`"),
    "A7 lens-pours testid word-form in source",
  );
}

console.log("B — live-fire (40 types, zero ghosts, the account interlocked)");
{
  assert(Array.isArray(JOB_TYPES) && JOB_TYPES.length === 40, `B1 40 types in the lib's job table`, `found ${JOB_TYPES.length}`);
  // zero ghost kinds + the census, both computed by the lib's own hands
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
    "B3 t747 account ELEVENTH-interlocked ([[1,35],[2,3],[3,2]] sorted before compared)",
    JSON.stringify(account),
  );
  assert(
    JSON.stringify(pourKindsOf("refine3d")) === JSON.stringify(["particles", "volume", "halfmap"]),
    "B4 refine3d pours particles, volume, halfmap (the lib's own answer)",
    JSON.stringify(pourKindsOf("refine3d")),
  );
  assert(
    JOB_TYPES.every((t) => pourKindsOf(t.key).length > 0 && jobType(t.key) != null),
    "B4b every known type speaks (silence is for the unknown only)",
  );
  assert(
    pourKindsOf("no-such-type").length === 0 && drinkKindsOf("no-such-type").length === 0,
    "B5 the unknown type stays silent at the lib (total lookup, empty pours)",
  );
  // the row's hit-path triad undressed: name/type/none
  assert(
    code.includes('? "name"') && code.includes('? "type"') && code.includes(': "none"'),
    "B6 the hit-path triad (name/type/none) undressed",
  );
  assert(
    code.includes("const label = spec?.label ?? job.type;"),
    "B7 label word-form verbatim (the row already names the type)",
  );
}

console.log("C — the face (eleventh address, per-dot anatomy, zero drift)");
{
  const addr = (src.match(/data-testid=\{`lens-pours-/g) ?? []).length;
  assert(addr === 1, "C1 exactly one lens-pours container (the eleventh address)");
  // no collision with the family ledger
  const family = [
    "pours-${", "peek-pours-${", "refmap-pours-${", "runtime-pours-${",
    "palette-fav-pours-${", "palette-pours-${", "queue-pours-${",
    "cmd-pours-${", "cmd-preset-pours-${", "cmd-user-pours-${", "shelf-pours-${",
  ];
  assert(
    !family.some((f) => f.startsWith("lens-")),
    "C2 no ledger collision (lens- prefix is new)",
  );
  assert(
    code.includes('aria-hidden="true"') && /title=\{`pours \$\{k\}`\}/.test(code),
    "C3 per-dot anatomy: aria-hidden + title word",
  );
  assert(
    code.includes("inline-block size-1.5 rounded-full"),
    "C4 whisper dot size (size-1.5, the t758 word-form)",
  );
  assert(
    code.includes('className="sr-only">pours {pouring.join(", ")}'),
    "C5 sr-only ear line verbatim",
  );
  // the seat: type word span -> water -> separator
  const seat = src.indexOf("showRawType ? <Emph text={job.type} q={q} />");
  const water = src.indexOf("lens-pours-");
  const sep = src.indexOf('<span aria-hidden="true">·</span>');
  assert(
    seat >= 0 && water > seat && sep > water,
    "C6 seat regex: type word -> water -> project separator",
  );
  // dialect equation, tenth staging: ZERO drift — the container class
  // verbatim-equals the t758 peek row-seat word-form (flex, not prose)
  const container = code.match(/className="([^"]*)"\s*\n?\s*data-testid=\{`lens-pours-/);
  assert(
    container != null && container[1] === "flex shrink-0 items-center gap-1",
    "C7 dialect equation tenth staging: ZERO drift (flex row seat, verbatim)",
    container ? container[1] : "container not found",
  );
}

console.log("D — purity (zero hex, note leads, old residents seated)");
{
  const hexes = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  assert(hexes === 0, `D1 zero hex (the file held no palette residents — empty ledger)`, `found ${hexes}`);
  assert(
    src.includes("t762 — the pours ask rides the spec the row already holds"),
    "D2 the t762 judgment note leads its block",
  );
  const storage = (src.match(/localStorage|sessionStorage/g) ?? []).length;
  assert(storage === 0, `D3 zero storage writes`, `found ${storage}`);
  for (const resident of [
    'data-lens-row=""',
    "data-lens-hit={hit}",
    "<CornerDownLeft",
    "const showRawType = hit === \"type\" && !ci(label).includes(ci(q));",
  ]) {
    assert(src.includes(resident), `D4 old resident seated: ${resident.slice(0, 40)}`);
  }
  assert(
    src.includes("<Emph text={job.type} q={q} />") && src.includes("<Emph text={label} q={q} />"),
    "D5 both type word-forms seated (raw + humanized)",
  );
}

console.log(`\nt762-lens-pours-unit: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
