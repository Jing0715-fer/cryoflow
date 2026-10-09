// t752 — the keyboard menu borrows the water dots: the command palette's
// "Add job type" rows are the CATALOG menu for the keyboard-first user —
// the mouse menu's rows spoke at t747 (palette-pours), the shelf chips at
// t750, the preset shelf cards at t751; this sixteenth reader dresses the
// ⌘K catalog rows. Dialect is t750/t751 verbatim: one dot per unique
// poured kind riding the resting wire hex, small is the whisper
// (size-1.5), the word per dot on its title, an sr-only ear line; one
// family only (pours — the appetite's full sentence stays in the
// dictionary). The row's SEARCH CONTRACT is untouched: the dots are
// decor and ear, never filter words — cmdk filters on the `value` prop,
// which stays verbatim. One-reader discipline: the "Add with preset" and
// "Add from your presets" groups stay undressed this window (staged —
// the t747→t750 same-surface-two-windows precedent).
//
//   A  one book: the row asks the lib's own named question
//      (pourKindsOf — the t746 home, asked once per row render, read by
//      dots and ear), the ask lives in a block body (the map's arrow
//      grew a body), dots ride PORT_COLORS[k].wire, ask is DIRECT (a
//      JOB_TYPES member always resolves — no gate needed, t751's gated
//      dialect is for unknown-able types only).
//   B  live-fire over the TYPE SPACE (40): the pour distribution holds
//      the t747 account ([[1,35],[2,3],[3,2]]) — now FOURTH-interlocked
//      (rows / chips / shelf / cmd) — zero ghost kinds, sorted before
//      compared (t748's order lesson).
//   C  the face: the cmd-pours-{key} testid (the pours family's fourth
//      address), dots verbatim the t750 shape (structurally equal), the
//      dots' seat between the label and the category (row-tail seat),
//      the value contract verbatim, the sibling groups untouched.
//   D  purity: zero hex literals in the file (no legal residents), the
//      judgment note leads the block, no storage writes, the t727/t714
//      residents keep their seats, the category span's word form
//      unchanged.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, PORT_COLORS, jobType, pourKindsOf } = await __jiti.import("../src/lib/workflow");

const here = path.dirname(fileURLToPath(import.meta.url));
const cp = readFileSync(path.join(here, "..", "src", "components", "workflow", "command-palette.tsx"), "utf8");
const pal = readFileSync(path.join(here, "..", "src", "components", "workflow", "palette.tsx"), "utf8");
const wf = readFileSync(path.join(here, "..", "src", "lib", "workflow.ts"), "utf8");

// slice discipline (t748's lesson: an assertion = word form × ground):
// the group slice is the "Add job type" CommandGroup; the water slice is
// the t752 note through the category span; the sibling slices are the
// two preset groups (which must stay undressed).
const groupStart = cp.indexOf('<CommandGroup heading="Add job type">');
const groupEnd = cp.indexOf("{/* ---------------- add with preset ---------------- */}", groupStart);
const group = groupStart >= 0 && groupEnd > groupStart ? cp.slice(groupStart, groupEnd) : "";

const waterStart = cp.indexOf("{/* t752 —", groupStart);
const waterEnd = cp.indexOf('<span className="shrink-0 text-[10px] uppercase', waterStart);
const water = waterStart >= 0 && waterEnd > waterStart ? cp.slice(waterStart, waterEnd) : "";

const presetGroupStart = cp.indexOf('<CommandGroup heading="Add with preset">');
const presetGroupEnd = cp.indexOf("Add from your presets", presetGroupStart);
const presetGroup = presetGroupStart >= 0 && presetGroupEnd > presetGroupStart ? cp.slice(presetGroupStart, presetGroupEnd) : "";

const userGroupStart = cp.indexOf("Add from your presets");
const userGroupEnd = cp.indexOf('heading="Projects"', userGroupStart);
const userGroup = userGroupStart >= 0 && userGroupEnd > userGroupStart ? cp.slice(userGroupStart, userGroupEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — one book, on the keyboard's catalog rows                        */
/* ================================================================== */
console.log("\nA — the row asks the lib's named question");

must(cp.includes('import { JOB_TYPES, jobType, pourKindsOf, PORT_COLORS, CARD_W, CARD_H } from "@/lib/workflow";'),
  "A the workflow import stays ONE line (pourKindsOf + PORT_COLORS merged into the existing line)");

must(group.includes("const pouring = pourKindsOf(t.key);"),
  "A the row asks pourKindsOf with the DIRECT form (JOB_TYPES members always resolve — no gate)");

must((cp.match(/const pouring/g) || []).length === 1,
  "A the question is asked exactly ONCE in the file (dots + ear read the answer; sibling groups undressed)");

must(group.includes("JOB_TYPES.map((t) => {") && group.includes("return ("),
  "A the ask lives in a block body (the map's arrow grew a body to host it)");

must(group.includes("PORT_COLORS[k].wire"),
  "A dots ride PORT_COLORS[k].wire (the t735 sample, now on the keyboard's rows)");

must(libHomeHasPour(), "A pourKindsOf still lives in the lib home (the t746 question, not palette logic)");
function libHomeHasPour() {
  const start = wf.indexOf("t746 — the dictionary page's water row");
  const end = wf.indexOf("/** Port shorthands. */", start);
  return start >= 0 && end > start && /export function pourKindsOf\(typeKey: string\): PortKind\[\]/.test(wf.slice(start, end));
}

/* ================================================================== */
/* B — live-fire over the type space                                   */
/* ================================================================== */
console.log("\nB — the type space's pour account, re-counted at the keyboard");

let ghost = 0;
const dist = {};
for (const t of JOB_TYPES) {
  const pk = pourKindsOf(t.key);
  for (const k of pk) if (!PORT_COLORS[k]) ghost++;
  dist[pk.length] = (dist[pk.length] ?? 0) + 1;
}

must(JOB_TYPES.length === 40, "B the type space is 40 strong", `got ${JOB_TYPES.length}`);
must(ghost === 0, "B zero ghost kinds (every dot the keyboard can show has a color)");

const account = Object.entries(dist).map(([n, c]) => [Number(n), c]).sort((a, b) => a[0] - b[0]);
must(JSON.stringify(account) === JSON.stringify([[1, 35], [2, 3], [3, 2]]),
  "B the SORTED pour account holds the t747 ledger ([[1,35],[2,3],[3,2]]) — FOURTH interlock (rows/chips/shelf/cmd)",
  `got ${JSON.stringify(account)}`);

const allNamed = JOB_TYPES.every((t) => jobType(t.key) !== undefined);
must(allNamed, "B every catalog type resolves a spec (the direct ask never blinds a known type)");

/* ================================================================== */
/* C — the face                                                        */
/* ================================================================== */
console.log("\nC — the keyboard row's face");

must((cp.match(/data-testid=\{`cmd-pours-/g) || []).length === 1,
  "C exactly one pours container in the file (the cmd-pours family's first address)");

must((water.match(/title=\{`pours \$\{k\}`\}/g) || []).length === 1,
  "C the word per dot rides the title (verbatim t750 form: pours ${k})");

must((water.match(/aria-hidden="true"/g) || []).length === 1,
  "C the dots are aria-hidden (decor stays out of the ear)");

must(water.includes('className="inline-block size-1.5 rounded-full"'),
  "C the dots are the scanning whisper (size-1.5, verbatim t750 shape)");

must(water.includes('sr-only">pours {pouring.join(", ")}'),
  "C the sr-only ear line names the kinds (verbatim t750 grammar)");

must(/<span className="min-w-0 flex-1 truncate text-sm">\{t\.label\}<\/span>[\s\S]*?cmd-pours-[\s\S]*?text-\[10px\] uppercase/.test(group),
  "C the dots' seat is the row tail (label → water → category)");

must(dialectEqualsT750(),
  "C the dot dialect is STRUCTURALLY t750's (same mapped-span syntax, same ear grammar — var and testid names normalized)");

must(group.includes("value={`add ${t.key} ${t.label} ${t.category}`}"),
  "C the search contract is verbatim (cmdk filters on `value` — the dots are decor and ear, never filter words)");

must(!presetGroup.includes("pourKindsOf") && !presetGroup.includes("cmd-pours") &&
     !userGroup.includes("pourKindsOf") && !userGroup.includes("cmd-pours"),
  "C one-reader discipline: the preset groups stay UNDRESSED this window (staged — t747→t750 precedent)");

function dialectEqualsT750() {
  const grab = (src, testidMark) => {
    const i = src.indexOf(testidMark);
    if (i < 0) return "";
    const start = src.lastIndexOf("<span", i);
    const endMark = 'sr-only">pours {pouring.join(", ")}</span>';
    const j = src.indexOf(endMark, i);
    if (start < 0 || j < 0) return "";
    return src.slice(start, j + endMark.length).replace(/\s+/g, " ");
  };
  const a = grab(pal, "data-testid={`palette-fav-pours-${t.key}`}")
    .replaceAll("t.key", "P.TYPE").replaceAll("palette-fav-pours", "X-POURS");
  const b = grab(cp, "data-testid={`cmd-pours-${t.key}`}")
    .replaceAll("t.key", "P.TYPE").replaceAll("cmd-pours", "X-POURS");
  return a.length > 0 && a === b;
}

/* ================================================================== */
/* D — purity                                                          */
/* ================================================================== */
console.log("\nD — the keyboard stays clean");

const hexLines = cp.split("\n").filter((l) => /#[0-9a-fA-F]{3,8}\b/.test(l));
must(hexLines.length === 0,
  "D zero hex literals in the file (no legal residents; the dots' ink rides PORT_COLORS)",
  `${hexLines.length} hex line(s)`);

must(water.startsWith("{/* t752 —") && water.includes("keyboard menu borrows the water dots") && water.includes("never filter words"),
  "D the t752 judgment note leads the block and names the law (keyboard menu + the search contract's untouchability)");

must(!/localStorage|sessionStorage|writeUserParamPresets/.test(water),
  "D no storage writes in the t752 water block (the palette's collectors keep their own homes)");

must(cp.includes("the user face of the preset family joins the palette") &&
     cp.includes("the palette's first FETCHED group"),
  "D the t714 user-preset note and the t668 saved-views note keep their seats (old residents, verbatim word forms)");

must(group.includes('<span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">'),
  "D the category span's word form is unchanged (the right slot keeps its own contract)");

/* ================================================================== */
console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL === 0 ? 0 : 1);
