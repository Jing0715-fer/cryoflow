#!/usr/bin/env node
/**
 * t1149 — THE PRESET-SHELF-TOOL unit: the user's preset shelf, the
 * AGENT face.
 *
 * The user's hand-tuned parameter presets learned to speak in t713
 * (the inspector's save/apply), t714 (the palette's "Add from your
 * presets" group) and t715 (the server mirror). Thirty-four agent
 * tools could read the type roster, one job's live params and the
 * world's health — none could quote the USER'S OWN saved snapshots: a
 * user asking 「用我常用的 2D 参数建一个 job」 forced the model to
 * invent values. The cure rides the t1148/t530 shape: a PURE presenter
 * (src/lib/ai/preset-shelf-present.ts) that speaks the shelf's rows
 * byte for byte, a well in tools.ts that only feeds (the row by its
 * ONE id, no parsing, no project scope), and the prompt's PRESET LAW
 * (never invent a preset, never paraphrase its values).
 *
 * A — the presenter run FOR REAL: the rows face (newest first, the
 *     UI's own "knobs" word, the labels resolved, the unknown type
 *     flagged), the params byte-equal to the father's own output, the
 *     three honest absences (never-synced / corrupt / synced-empty),
 *     the trust decision riding the father (junk rows drop at the
 *     whitelist), the determinism, the no-age law.
 * B — the tools.ts source-pinned: the zero-knob schema, the cousins
 *     named, the case routed, the well's feed (no parsing, no sort, no
 *     project scope), the id's ONE birthplace.
 * C — the doctrine: the prompt's PRESET LAW, the wear flow, the purity
 *     laws (no clock, no db, no age father).
 *
 * node scripts/unit-runner.mjs scripts/t1149-preset-shelf-tool-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizePresetShelf } from "@/lib/param-preset-sanitize";
import { presentPresetShelf } from "@/lib/ai/preset-shelf-present";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const toolsSrc = readFileSync(join(ROOT, "src/lib/ai/tools.ts"), "utf8");
const promptSrc = readFileSync(join(ROOT, "src/lib/ai/prompt.ts"), "utf8");
const presentSrc = readFileSync(
  join(ROOT, "src/lib/ai/preset-shelf-present.ts"),
  "utf8",
);
const sanitizeSrc = readFileSync(join(ROOT, "src/lib/param-preset-sanitize.ts"), "utf8");
const routeSrc = readFileSync(join(ROOT, "src/app/api/param-presets/route.ts"), "utf8");

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

/* ---------- fixtures ---------- */

// Historical stamps (the trust father clamps createdAt against the wall
// clock — a fixture from the far future would be clamped and lie).
const T1 = Date.parse("2026-01-05T08:00:00Z"); // oldest
const T2 = Date.parse("2026-02-10T09:00:00Z"); // middle
const T3 = Date.parse("2026-03-20T10:00:00Z"); // newest

const KNOWN_TYPES = [
  { key: "motioncorr", label: "Motion Correction" },
  { key: "class2d", label: "2D Classification" },
  { key: "ctffind", label: "CTF Refinement" },
];

// Storage order (oldest first — loadUserParamPresets' dialect): the
// newest save sits LAST in the row's bytes and FIRST in the display.
const SHELF = [
  {
    id: "upp-1",
    type: "ctffind",
    name: "ctf tight",
    params: { angpix: 1.24, dast: 2.0 },
    createdAt: T1,
  },
  {
    id: "upp-3",
    type: "topazx", // a type no known job speaks
    name: "orphan preset",
    params: { phase: "hybrid" },
    createdAt: T2,
  },
  {
    id: "upp-2",
    type: "class2d",
    name: "My 2D tuned",
    params: { K: 50, tau_fudge: 1.0, do_preread_images: true, psi_sampling: 5 },
    createdAt: T3,
  },
];

const SHELF_BYTES = JSON.stringify(SHELF);
const feed = (raw, rowExists = true) =>
  presentPresetShelf({
    rowExists,
    raw,
    rowUpdatedAt: rowExists ? "2026-03-21T00:00:00.000Z" : null,
    knownTypes: KNOWN_TYPES,
  });

/* ---------- A — the presenter run FOR REAL ---------- */

console.log("A — the presenter run FOR REAL (the shelf's own words, composed)");

const spoken = feed(SHELF_BYTES);
const rows = spoken.detail?.presets ?? [];

// A1 — the rows face: ok, every preset named, the counts spoken.
ok("A1 the read speaks ok and names every preset in the summary",
  spoken.ok === true &&
    spoken.summary.includes('"ctf tight"') &&
    spoken.summary.includes('"My 2D tuned"') &&
    spoken.summary.includes('"orphan preset"'));
ok("A1 the counts ride the shelf's own arithmetic",
  spoken.summary.includes("holds 3 presets across 3 job types (newest first)"));

// A2 — the display dialect: newest first (the palette's own order).
ok("A2 the annex rides newest first (the palette's own display dialect)",
  rows.length === 3 &&
    rows[0].name === "My 2D tuned" &&
    rows[1].name === "orphan preset" &&
    rows[2].name === "ctf tight");

// A3 — the UI's own count word and per-row facts.
ok("A3 the count word is the cards' own 'knobs' and the numbers are honest",
  spoken.summary.includes('"My 2D tuned" (2D Classification, 4 knobs)') &&
    spoken.summary.includes('"ctf tight" (CTF Refinement, 2 knobs)') &&
    rows[0].knobs === 4 && rows[2].knobs === 2);

// A4 — the labels resolved; the unknown type flagged, never hidden.
ok("A4 the known types speak the JOB_TYPES label",
  rows[0].typeLabel === "2D Classification" && rows[0].typeKnown === true);
ok("A4 the unknown type is flagged in the row AND the summary (the t753 law)",
  rows[1].typeKnown === false && rows[1].typeLabel === null &&
    spoken.summary.includes("1 preset wears a type no known job speaks") &&
    spoken.summary.includes('"orphan preset" → topazx') &&
    spoken.summary.includes("the apply gate is structural"));

// A5 — the annex IS the father's output (the t1148 lesson: the fixture
// feeds the SAME list through the raw father, byte for byte).
const rawFather = sanitizePresetShelf(JSON.parse(SHELF_BYTES));
const rawMap = new Map(rawFather.map((p) => [p.name, p]));
ok("A5 the annex's params are the father's own output byte for byte",
  rows.every((r) =>
    JSON.stringify(r.params) === JSON.stringify(rawMap.get(r.name)?.params) &&
    r.created === new Date(rawMap.get(r.name)?.createdAt).toISOString(),
  ));

// A6 — the never-synced face: no row, the honest absence.
const never = feed(null, false);
ok("A6 the never-synced face speaks its own word (not 'empty', not an error)",
  never.ok === true &&
    never.summary.includes("has never been written") &&
    never.summary.includes("the server cannot see local lists") &&
    never.detail.synced === false && never.detail.presets.length === 0);

// A7 — the corrupt face: unreadable bytes, quoted as corruption.
const corrupt = feed("{not json at all");
ok("A7 the corrupt row says so instead of pretending empty",
  corrupt.ok === true &&
    corrupt.summary.includes("bytes could not be parsed") &&
    corrupt.summary.includes("Quote nothing as a preset until then") &&
    corrupt.detail.corrupt === true && corrupt.detail.synced === true);

// A8 — the synced-empty face: the deletion's truth, not a missing sync.
const empty = feed("[]");
ok("A8 the emptied shelf is the deletion's truth (the route's own semantics)",
  empty.ok === true &&
    empty.summary.includes("holds 0 presets") &&
    empty.summary.includes("the deletion's truth") &&
    empty.detail.synced === true && empty.detail.corrupt === false);

// A8b — a non-array JSON body rides the same trust decision to the same
// synced-empty face (the father's own non-array law, never re-derived).
const nonArray = feed('"hello shelf"');
ok("A8b a non-array payload reads as the synced-empty face (the father's law)",
  nonArray.detail.synced === true && nonArray.detail.presets.length === 0 &&
    nonArray.summary.includes("holds 0 presets"));

// A9 — the trust decision rides the father: junk rows drop at the
// whitelist, the good neighbours live on (the gallery's law).
const junky = feed(JSON.stringify([
  ...SHELF,
  { id: "", type: "class2d", name: "no id", params: {}, createdAt: T3 },
  { id: "upp-9", type: "class2d", name: 42, params: {}, createdAt: T3 },
  "a bare string row",
]));
ok("A9 junk rows drop at the father's whitelist, the neighbours live",
  junky.detail.presets.length === 3 && junky.summary.includes("holds 3 presets"));

// A10 — determinism: the same bytes speak the same words, byte for byte.
const again = feed(SHELF_BYTES);
ok("A10 the read is deterministic (the same row, the same bytes)",
  JSON.stringify(spoken) === JSON.stringify(again));

// A11 — the no-age law: a preset does not rot (dates, never paces).
ok("A11 the face speaks dates, never an age verdict (no Fresh, no Marathon)",
  /^\d{4}-\d{2}-\d{2}T/.test(rows[0].created) &&
    !spoken.summary.includes("ago") && !spoken.summary.includes("Fresh") &&
    !spoken.summary.includes("Marathon"));

/* ---------- B — the tools.ts source-pinned ---------- */

console.log("B — the well and the schema, source-pinned (the file's own bytes)");

const schemaStart = toolsSrc.indexOf('name: "get_param_presets"');
const schemaEnd = toolsSrc.indexOf('name: "get_custom_templates"', schemaStart); // t1150 boundary re-key — the anchor names its OWN neighbor (the t1149 law)
const schemaSlice = schemaStart > -1 && schemaEnd > schemaStart ? toolsSrc.slice(schemaStart, schemaEnd) : "";
const wellStart = toolsSrc.indexOf("async function getParamPresets");
const wellEnd = toolsSrc.indexOf("/* ---- get_custom_templates", wellStart); // t1150 boundary re-key — the anchor names its OWN neighbor (the t1149 law)
const wellSlice = wellStart > -1 && wellEnd > wellStart ? toolsSrc.slice(wellStart, wellEnd) : "";

ok("B1 the tool is registered with ZERO knobs (the shelf is the shelf)",
  schemaSlice.length > 0 &&
    schemaSlice.includes('parameters: { type: "object", properties: {}, additionalProperties: false }') &&
    !schemaSlice.includes("required:"));
ok("B2 the description names its cousins and its own cup",
  schemaSlice.includes("list_job_types") && schemaSlice.includes("get_job_params") &&
    schemaSlice.includes("THE tool for") && schemaSlice.includes("Read-only QUOTER"));
ok("B3 the switch routes the read to its well",
  toolsSrc.includes('case "get_param_presets":') &&
    toolsSrc.includes("return await getParamPresets();"));
ok("B4 the well drinks the PURE presenter (the t530 shape — the bench's lane stays clean)",
  toolsSrc.includes('import { presentPresetShelf } from "@/lib/ai/preset-shelf-present";'));
ok("B5 the row's id has ONE birthplace (the re-key chore class's law)",
  toolsSrc.includes("PARAM_PRESET_SHELF_ID") &&
    !toolsSrc.includes('"user-param-presets"') &&
    sanitizeSrc.includes('export const PARAM_PRESET_SHELF_ID = "user-param-presets"') &&
    routeSrc.includes("PARAM_PRESET_SHELF_ID as SHELF_ID") &&
    !routeSrc.includes('const SHELF_ID = "user-param-presets"'));
ok("B6 the well takes NO project scope (the shelf is the user's, not the project's)",
  wellSlice.length > 0 &&
    !wellSlice.includes("getActiveProject") && !wellSlice.includes("projectId") &&
    !wellSlice.includes("ctx."));
ok("B7 the well only feeds — no parsing, no sorting, no second gate inside",
  wellSlice.length > 0 &&
    !wellSlice.includes("JSON.parse") && !wellSlice.includes(".sort(") &&
    !wellSlice.includes("sanitizePresetShelf") && !wellSlice.includes(".filter("));
ok("B8 the vocabulary feed rides JOB_TYPES (the type gate's own words)",
  wellSlice.includes("JOB_TYPES.map((t) => ({ key: t.key, label: t.label }))"));

/* ---------- C — the doctrine + the purity laws ---------- */

console.log("C — the doctrine source-pinned, the fathers' exclusivity");

const presentCode = presentSrc.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

ok("C1 the prompt's PRESET LAW names the tool and the invention refusal",
  promptSrc.includes("18. THE PRESET LAW") &&
    promptSrc.includes("get_param_presets FIRST") &&
    promptSrc.includes("NEVER invent a preset"));
ok("C2 the law teaches the wear flow (the snapshot semantics, the type gate)",
  promptSrc.includes("create_job/update_job") &&
    promptSrc.includes("FULL spec-key snapshot") &&
    promptSrc.includes("type-X preset never lands on another type"));
ok("C3 the law draws the cousin lines (one job's live params; the curated face)",
  promptSrc.includes("get_job_params") && promptSrc.includes("add-time palette's face"));
ok("C4 the presenter is pure — no clock, no db, no react (a preset has no pace)",
  !/\bDate\.now\(\)/.test(presentCode) &&
    !presentSrc.includes("@/lib/db") && !presentSrc.includes("from \"react\"") &&
    !presentSrc.includes("useEffect"));
ok("C5 the no-age law at the door — the jobs' age fathers stay out",
  !presentSrc.includes("worldAgeWords") && !presentSrc.includes("durationMsOf") &&
    !presentSrc.includes("clockWordsOf"));
ok("C6 the trust decision rides the ONE father (no ad-hoc key checks)",
  presentSrc.includes("sanitizePresetShelf") && presentSrc.includes("@/lib/param-preset-sanitize") &&
    !/\btypeof\s+\w+\.params\s*===/.test(presentCode));
ok("C7 the display dialect is the source's own sort (newest first)",
  /\.sort\(\(a,\s*b\)\s*=>\s*b\.createdAt\s*-\s*a\.createdAt\)/.test(presentCode));

/* ---------- receipt ---------- */
console.log(`\nPRESET-SHELF-TOOL-UNIT t1149: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
