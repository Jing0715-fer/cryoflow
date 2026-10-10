// t753 — the keyboard's PRESET menu borrows the water dots: the two
// sibling groups t752 left staged — "Add with preset" (17 curated rows
// over 9 types; six types wear more than one preset) and "Add from your
// presets" (t714's user snapshots) — are type-naming rows too, so the
// t747 promise rides them and the keyboard menu's type-naming surface is
// complete. Dialect is the t751 GATED form (a preset's p.type is
// unknown-able: the ask gate + the render gate — t752's direct ask is a
// right only JOB_TYPES members earn). Row-unique testids because the
// rows are not unique by type: the curated tail mirrors the row key
// (type + preset), the user tail mirrors the snapshot id. The value
// search contracts stay verbatim — decor and ear, never filter words.
//
//   A  one book: both groups ask the lib's named question behind the
//      ask gate, asked once per group; the catalog group's direct ask
//      (t752) stays untouched; dots ride PORT_COLORS[k].wire.
//   B  live-fire over the TYPE SPACE (40) + the PRESET SPACE (17): the
//      t747 account FIFTH-interlocked, zero ghost kinds, every preset
//      type resolves a spec (the gates never silence a known preset).
//   C  the face: cmd-preset-pours-{type}-{preset} and cmd-user-pours-
//      {id} testids (row-unique, key-aligned), dots verbatim the t750
//      shape (structurally equal, both blocks), row-tail seats, value
//      contracts verbatim.
//   D  purity: zero hex literals, both judgment notes lead their blocks,
//      no storage writes, the t752 catalog block byte-intact, the
//      t714/t668 residents keep their seats.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } = await __jiti.import("../src/lib/workflow");
const { JOB_PRESETS } = await __jiti.import("../src/lib/job-presets");

const here = path.dirname(fileURLToPath(import.meta.url));
const cp = readFileSync(path.join(here, "..", "src", "components", "workflow", "command-palette.tsx"), "utf8");
const pal = readFileSync(path.join(here, "..", "src", "components", "workflow", "palette.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

// slice discipline: curated group = "Add with preset" heading through
// "add from your presets" comment; user group = that heading through
// the Projects heading; catalog group = "Add job type" heading through
// "add with preset" comment (must stay t752-intact).
const catStart = cp.indexOf('<CommandGroup heading="Add job type">');
const catEnd = cp.indexOf("{/* ---------------- add with preset ---------------- */}", catStart);
const catalog = catStart >= 0 && catEnd > catStart ? cp.slice(catStart, catEnd) : "";

const curStart = cp.indexOf('<CommandGroup heading="Add with preset">');
const curEnd = cp.indexOf("{/* ---------------- add from your presets (t714) ----------------", curStart);
const curated = curStart >= 0 && curEnd > curStart ? cp.slice(curStart, curEnd) : "";

const usrStart = cp.indexOf('<CommandGroup heading="Add from your presets">');
const usrEnd = cp.indexOf('heading="Projects"', usrStart);
const user = usrStart >= 0 && usrEnd > usrStart ? cp.slice(usrStart, usrEnd) : "";

const curWater = curated.indexOf("{/* t753 —") >= 0 ? curated.slice(curated.indexOf("{/* t753 —"), curated.indexOf('<span className="hidden shrink-0 max-w-40', curated.indexOf("{/* t753 —"))) : "";
const usrWater = user.indexOf("{/* t753 —") >= 0 ? user.slice(user.indexOf("{/* t753 —"), user.indexOf('<span className="hidden shrink-0 items-center', user.indexOf("{/* t753 —"))) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, on the preset rows                                    */
/* ================================================================== */
console.log("\nA — the preset rows ask the lib's named question, gated");

must((cp.match(/const pouring = t \? pourKindsOf\(p\.type\) : \[\];/g) || []).length === 2,
  "A the GATED ask appears exactly twice (curated + user — the t751 dialect for unknown-able p.type)");

must(catalog.includes("const pouring = pourKindsOf(t.key);") &&
     (catalog.match(/const pouring/g) || []).length === 1,
  "A the t752 catalog ask stays DIRECT and alone in its group (a JOB_TYPES member's earned right)");

must((curated.match(/\{t \? \(/g) || []).length === 1 && curated.includes(") : null}"),
  "A the curated render gate is in place (unknown type renders nothing)");

must((user.match(/\{t \? \(/g) || []).length === 1 && user.includes(") : null}"),
  "A the user render gate is in place (same law, twin group)");

must(curated.includes("PORT_COLORS[k].wire") && user.includes("PORT_COLORS[k].wire"),
  "A dots ride PORT_COLORS[k].wire in BOTH groups (the t735 sample, now on the preset rows)");

must(libHomeHasPour(), "A pourKindsOf still lives in the lib home (the t746 question, not palette logic)");
function libHomeHasPour() {
  const start = wf.indexOf("t746 — the dictionary page's water row");
  const end = wf.indexOf("/** Port shorthands. */", start);
  return start >= 0 && end > start && /export function pourKindsOf\(typeKey: string\): PortKind\[\]/.test(wf.slice(start, end));
}

/* ================================================================== */
/* B — live-fire over the type space AND the preset space              */
/* ================================================================== */
console.log("\nB — the pour account, re-counted at the keyboard's preset menu");

let ghost = 0;
const dist = {};
for (const t of JOB_TYPES) {
  const pk = pourKindsOf(t.key);
  for (const k of pk) if (!PORT_COLORS[k]) ghost++;
  dist[pk.length] = (dist[pk.length] ?? 0) + 1;
}

must(JOB_TYPES.length === 40, "B the type space is 40 strong", `got ${JOB_TYPES.length}`);
must(ghost === 0, "B zero ghost kinds (every dot the preset rows can show has a color)");

const account = Object.entries(dist).map(([n, c]) => [Number(n), c]).sort((a, b) => a[0] - b[0]);
must(JSON.stringify(account) === JSON.stringify([[1, 35], [2, 3], [3, 2]]),
  "B the SORTED pour account holds the t747 ledger — FIFTH interlock (rows/chips/shelf/cmd/preset-cmd)",
  `got ${JSON.stringify(account)}`);

const unknownPresets = JOB_PRESETS.filter((p) => jobType(p.type) === undefined);
must(unknownPresets.length === 0,
  "B every curated preset's type resolves a spec (the gates never silence a KNOWN preset)",
  `checked ${JOB_PRESETS.length}`);

const typeCounts = {};
for (const p of JOB_PRESETS) typeCounts[p.type] = (typeCounts[p.type] ?? 0) + 1;
const shared = Object.values(typeCounts).filter((n) => n > 1).length;
must(shared > 0,
  "B the preset space truly repeats types (the row-unique testid tail is load-bearing, not decorative)",
  `${shared} types wear >1 preset across ${JOB_PRESETS.length} rows / ${Object.keys(typeCounts).length} types`);

/* ================================================================== */
/* C — the face                                                        */
/* ================================================================== */
console.log("\nC — the preset rows' face");

must((cp.match(/data-testid=\{`cmd-preset-pours-/g) || []).length === 1,
  "C the curated container testid is cmd-preset-pours-{type}-{preset} (mirrors the row key's tail)");

must((cp.match(/data-testid=\{`cmd-user-pours-/g) || []).length === 1,
  "C the user container testid is cmd-user-pours-{id} (mirrors the user row key's id tail)");

must((cp.match(/data-testid=\{`cmd-/g) || []).length === 3,
  "C exactly three cmd pours containers in the file (catalog + curated + user — one per type-naming group)");

for (const [name, w] of [["curated", curWater], ["user", usrWater]]) {
  must((w.match(/title=\{`pours \$\{k\}`\}/g) || []).length === 1 &&
       w.includes('className="inline-block size-1.5 rounded-full"') &&
       w.includes('aria-hidden="true"') &&
       w.includes('sr-only">pours {pouring.join(", ")}'),
    `C the ${name} dots are verbatim t750 shape (whisper + per-dot word + aria-hidden + ear)`);
}

must(/<span className="ml-1\.5 font-medium">\{p\.preset\}<\/span>\s*<\/span>[\s\S]*?cmd-preset-pours[\s\S]*?text-\[10px\] text-muted-foreground sm:inline/.test(curated),
  "C the curated dots' seat is the row tail (label+preset → water → note)");

must(/<span className="ml-1\.5 font-medium">\{p\.name\}<\/span>\s*<\/span>[\s\S]*?cmd-user-pours[\s\S]*?text-\[10px\] text-muted-foreground sm:inline-flex/.test(user),
  "C the user dots' seat is the row tail (label+name → water → knobs·ago)");

must(dialectEqualsT750(curWater) && dialectEqualsT750(usrWater),
  "C BOTH dot dialects are STRUCTURALLY t750's (names normalized, byte-equal)");

must(curated.includes("value={`preset add ${p.type} ${t?.label ?? \"\"} ${p.preset} ${p.note}`}") &&
     user.includes("value={`preset add your saved ${p.name} ${p.type} ${t?.label ?? \"\"}`}"),
  "C both search contracts are verbatim (the dots are decor and ear, never filter words)");

function dialectEqualsT750(src) {
  const grab = (text, testidMark) => {
    const i = text.indexOf(testidMark);
    if (i < 0) return "";
    const start = text.lastIndexOf("<span", i);
    const endMark = 'sr-only">pours {pouring.join(", ")}</span>';
    const j = text.indexOf(endMark, i);
    if (start < 0 || j < 0) return "";
    return text.slice(start, j + endMark.length).replace(/\s+/g, " ");
  };
  const norm = (s) => s
    .replace(/data-testid=\{`[^`]*`\}/, "data-testid={X}")
    .replaceAll("t.key", "P.TYPE")
    .replaceAll("p.type", "P.TYPE")
    .replaceAll("palette-fav-pours", "X-POURS")
    .replaceAll("cmd-preset-pours", "X-POURS")
    .replaceAll("cmd-user-pours", "X-POURS");
  const a = norm(grab(pal, "data-testid={`palette-fav-pours-${t.key}`}"));
  const b = norm(grab(src, "data-testid={`cmd-"));
  return a.length > 0 && b.length > 0 && a === b;
}

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — the keyboard stays clean");

const hexLines = cp.split("\n").filter((l) => /#[0-9a-fA-F]{3,8}\b/.test(l));
must(hexLines.length === 0,
  "D zero hex literals in the file (no legal residents; the dots' ink rides PORT_COLORS)",
  `${hexLines.length} hex line(s)`);

must(curWater.includes("preset menu borrows the water") && curWater.includes("SILENT") &&
     usrWater.includes("user group's water") && usrWater.includes("row-unique testid tail"),
  "D both t753 judgment notes lead their blocks and name their laws (row-unique tails + the silence)");

must(!/localStorage|sessionStorage|writeUserParamPresets/.test(curWater + usrWater),
  "D no storage writes in either t753 water block");

must(catalog.includes("data-testid={`cmd-pours-${t.key}`}") && catalog.includes("keyboard menu borrows the water dots"),
  "D the t752 catalog block stays byte-intact (its note and testid untouched)");

must(cp.includes("the user face of the preset family joins the palette") &&
     cp.includes("the palette's first FETCHED group"),
  "D the t714 user-preset note and the t668 saved-views note keep their seats (old residents)");

/* ================================================================== */
console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL === 0 ? 0 : 1);
