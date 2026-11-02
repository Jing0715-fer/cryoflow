#!/usr/bin/env node
/**
 * t1150 — THE TEMPLATE-SHELF-TOOL unit: the user's template shelf, the
 * AGENT face.
 *
 * The user's hand-built workflow shapes learned to speak in t127 (the
 * canvas's save flow) and the apply door re-mints the branch anywhere
 * with one click. Thirty-five agent tools could read the param shelf
 * (get_param_presets), the world's health (get_world_health) and the
 * whole roster — none could quote the USER'S OWN saved shapes: a user
 * asking 「我存过哪些模板」 or "which of my saved shapes fits here?"
 * forced the model to invent a pipeline. Inventing a shape the user
 * wired by hand is how a twin is born. The cure rides the
 * t1148/t1149/t530 shape: a PURE presenter
 * (src/lib/ai/template-shelf-present.ts) that speaks the shelf's rows
 * through the ONE counts father (templateCountsOf — the route and the
 * agent speak the SAME arithmetic), a well in tools.ts that only feeds
 * (the route's OWN query, project-scoped), and the prompt's TEMPLATE
 * LAW (never invent a template, never re-mint a saved shape).
 *
 * A — the presenter run FOR REAL: the rows face (newest first pinned in
 *     the source, the dialog's own "jobs · wires" word, the counts
 *     byte-equal to the route's own arithmetic, the corrupt row listed
 *     and named, the emptied shelf the deletion's truth), the
 *     determinism, the no-age law, the wear line, the scope line.
 * B — the tools.ts source-pinned: the zero-knob schema, the cousins
 *     named, the case routed, the well's feed (the route's OWN query,
 *     no parsing, no sorting in JS), the counts' ONE birthplace (the
 *     route's list block rides templateCountsOf too).
 * C — the doctrine: the prompt's TEMPLATE LAW, the apply door as the
 *     shape's only writer, the purity laws (no clock, no db, no age
 *     father, no second parse).
 *
 * node scripts/unit-runner.mjs scripts/t1150-template-shelf-tool-unit.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { templateCountsOf } from "@/lib/template-io";
import { presentTemplateShelf } from "@/lib/ai/template-shelf-present";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..");
const toolsSrc = readFileSync(join(ROOT, "src/lib/ai/tools.ts"), "utf8");
const promptSrc = readFileSync(join(ROOT, "src/lib/ai/prompt.ts"), "utf8");
const presentSrc = readFileSync(
  join(ROOT, "src/lib/ai/template-shelf-present.ts"),
  "utf8"
);
const fatherSrc = readFileSync(join(ROOT, "src/lib/template-io.ts"), "utf8");
const routeSrc = readFileSync(
  join(ROOT, "src/app/api/custom-template/route.ts"),
  "utf8"
);

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

const T1 = "2026-01-05T08:00:00.000Z"; // oldest
const T2 = "2026-02-10T09:00:00.000Z"; // middle
const T3 = "2026-03-20T10:00:00.000Z"; // newest

const payloadOf = (jobs, edges) => JSON.stringify({ jobs, edges });
const job = (type) => ({ type, dx: 0, dy: 0, params: {} });

// The WELL's dialect is createdAt desc — the fixture feeds the OPPOSITE
// order (oldest first) to prove the display sort is pinned in the
// PRESENTER's source, not trusted from the feed (the t1147 lesson).
const SHELF_ROWS = [
  {
    id: "tpl-1",
    name: "screening core",
    payload: payloadOf([job("motioncorr"), job("ctffind"), job("extract")], [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ]),
    createdAt: T1,
  },
  {
    id: "tpl-2",
    name: "2D branch",
    payload: payloadOf([job("class2d")], []),
    createdAt: T2,
  },
  {
    id: "tpl-3",
    name: "full SPA",
    payload: payloadOf(
      [
        job("import"),
        job("motioncorr"),
        job("ctffind"),
        job("manualpick"),
        job("extract"),
        job("class2d"),
      ],
      [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 5 },
      ]
    ),
    createdAt: T3,
  },
];

const feed = (rows) => presentTemplateShelf({ rows });

/* ---------- A — the presenter run FOR REAL ---------- */

console.log("A — the presenter run FOR REAL (the shelf's own words, composed)");

const spoken = feed(SHELF_ROWS);
const rows = spoken.detail?.templates ?? [];

// A1 — the rows face: ok, every template named, the count spoken.
ok("A1 the read speaks ok and names every template in the summary",
  spoken.ok === true &&
    spoken.summary.includes('"screening core"') &&
    spoken.summary.includes('"2D branch"') &&
    spoken.summary.includes('"full SPA"'));
ok("A1 the count rides the shelf's own arithmetic (newest first)",
  spoken.summary.includes("holds 3 templates (newest first)"));

// A2 — the display dialect: newest first — the pin re-orders the feed.
ok("A2 the annex rides newest first (the sort is the presenter's, not the feed's)",
  rows.length === 3 &&
    rows[0].name === "full SPA" &&
    rows[1].name === "2D branch" &&
    rows[2].name === "screening core");

// A3 — the dialog's own count word and per-row facts.
ok("A3 the count word is the dialog's own 'jobs · wires' and the numbers are honest",
  spoken.summary.includes('"full SPA" (6 jobs · 5 wires)') &&
    spoken.summary.includes('"2D branch" (1 job · 0 wires)') &&
    spoken.summary.includes('"screening core" (3 jobs · 2 wires)') &&
    rows[0].jobCount === 6 && rows[0].edgeCount === 5);

// A4 — the counts ARE the route's own arithmetic (the counts father's
// output vs a direct read of the same bytes).
ok("A4 the counts are byte-equal to the father's own output on the same bytes",
  rows.every((r) => {
    const direct = templateCountsOf(SHELF_ROWS.find((s) => s.id === r.id).payload);
    return r.jobCount === direct.jobCount && r.edgeCount === direct.edgeCount;
  }));

// A5 — the corrupt row: listed (deletable) with 0 · 0 and NAMED.
const corruptFeed = feed([
  ...SHELF_ROWS,
  { id: "tpl-x", name: "a save gone bad", payload: "{not json at all", createdAt: T2 },
]);
const corruptRows = corruptFeed.detail?.templates ?? [];
ok("A5 the corrupt row stays listed with 0 · 0 counts (the route's own law)",
  corruptRows.length === 4 &&
    corruptRows.some((r) => r.name === "a save gone bad" && r.jobCount === 0 && r.edgeCount === 0));
ok("A5 the corrupt row is flagged in the row AND named in the summary (the t753 law)",
  corruptRows.find((r) => r.name === "a save gone bad")?.corrupt === true &&
    corruptFeed.summary.includes("1 row reads corrupt") &&
    corruptFeed.summary.includes('"a save gone bad"') &&
    corruptFeed.summary.includes("quote nothing from it"));

// A6 — the emptied shelf: the deletion's truth, not a missing sync.
const empty = feed([]);
ok("A6 the emptied shelf speaks its own word (the deletion's truth + the scope line)",
  empty.ok === true &&
    empty.summary.includes("holds 0 templates") &&
    empty.summary.includes("the deletion's truth") &&
    empty.summary.includes("ACTIVE PROJECT") &&
    empty.detail.templates.length === 0);

// A7 — determinism: the same rows speak the same words, byte for byte.
const again = feed(SHELF_ROWS);
ok("A7 the read is deterministic (the same rows, the same bytes)",
  JSON.stringify(spoken) === JSON.stringify(again));

// A8 — the no-age law: a template does not rot (dates, never paces).
ok("A8 the face speaks dates, never an age verdict (no ago, no Fresh, no Marathon)",
  /^\d{4}-\d{2}-\d{2}T/.test(rows[0].created) &&
    !spoken.summary.includes("ago") && !spoken.summary.includes("Fresh") &&
    !spoken.summary.includes("Marathon"));

// A9 — a payload with jobs and NO edges array: 0 wires, never corrupt
// (edges is optional by the payload's own contract).
const noEdges = feed([
  { id: "tpl-n", name: "lone shape", payload: payloadOf([job("class2d")], undefined), createdAt: T3 },
]);
ok("A9 a missing edges array reads 0 wires, never corrupt (the contract's optional leg)",
  noEdges.detail.templates[0].edgeCount === 0 &&
    noEdges.detail.templates[0].corrupt === false);

// A10 — the wear line: the apply door named, the re-mint refusal said.
ok("A10 the summary teaches the wear line (the apply door, never re-mint)",
  spoken.summary.includes("one-click apply") &&
    spoken.summary.includes("NEVER re-mint") &&
    spoken.summary.includes("wired exactly as saved"));

// A11 — the scope line: the shelf is the ACTIVE PROJECT's (the cousin
// line with the user's param presets drawn at the door).
ok("A11 the scope is the project's own (the param presets' cousin line)",
  spoken.summary.includes("ACTIVE PROJECT") &&
    spoken.summary.includes("does not follow the user across projects"));

/* ---------- B — the tools.ts source-pinned ---------- */

console.log("B — the well and the schema, source-pinned (the file's own bytes)");

const schemaStart = toolsSrc.indexOf('name: "get_custom_templates"');
const schemaEnd = toolsSrc.indexOf('name: "get_continue_sources"', schemaStart);
const schemaSlice = schemaStart > -1 && schemaEnd > schemaStart ? toolsSrc.slice(schemaStart, schemaEnd) : "";
const wellStart = toolsSrc.indexOf("async function getCustomTemplates");
const wellEnd = toolsSrc.indexOf("/* ---- get_continue_sources", wellStart);
const wellSlice = wellStart > -1 && wellEnd > wellStart ? toolsSrc.slice(wellStart, wellEnd) : "";

ok("B1 the tool is registered with ZERO knobs (the shelf is the shelf)",
  schemaSlice.length > 0 &&
    schemaSlice.includes('parameters: { type: "object", properties: {}, additionalProperties: false }') &&
    !schemaSlice.includes("required:"));
ok("B2 the description names its cousins and its own cup",
  schemaSlice.includes("get_param_presets") && schemaSlice.includes("build_pipeline") &&
    schemaSlice.includes("list_job_types") &&
    schemaSlice.includes("THE tool for") && schemaSlice.includes("Read-only QUOTER"));
ok("B3 the switch routes the read to its well",
  toolsSrc.includes('case "get_custom_templates":') &&
    toolsSrc.includes("return await getCustomTemplates(ctx);"));
ok("B4 the well drinks the PURE presenter (the t530 shape — the bench's lane stays clean)",
  toolsSrc.includes('import { presentTemplateShelf } from "@/lib/ai/template-shelf-present";'));
ok("B5 the well rides the GET list route's OWN query (same where, same order, same select)",
  wellSlice.includes("db.customTemplate.findMany") &&
    wellSlice.includes("where: { projectId: ctx.projectId }") &&
    wellSlice.includes('orderBy: [{ createdAt: "desc" }]') &&
    wellSlice.includes("select: { id: true, name: true, payload: true, createdAt: true }"));
ok("B6 the well only feeds — no parsing, no sorting, no father call inside",
  wellSlice.length > 0 &&
    !wellSlice.includes("JSON.parse") && !wellSlice.includes(".sort(") &&
    !wellSlice.includes("templateCountsOf") && !wellSlice.includes(".filter("));

// B7 — the counts' ONE birthplace: the route's list block rides the
// father too (two parsers of the same blob are how the numbers drift).
const listStart = routeSrc.indexOf("// t1150 — the counts ride the ONE father");
const listEnd = routeSrc.indexOf("return NextResponse.json({ templates });", listStart);
const listSlice = listStart > -1 && listEnd > listStart ? routeSrc.slice(listStart, listEnd) : "";
ok("B7 the route's list block rides the ONE counts father (byte-equal response face)",
  routeSrc.includes("templateCountsOf,") &&
    listSlice.includes("templateCountsOf(r.payload)") &&
    !listSlice.includes("JSON.parse") && !listSlice.includes("try {"));
ok("B7 the father is exported from the shared template lib (the ONE birthplace)",
  fatherSrc.includes("export function templateCountsOf") &&
    fatherSrc.includes("parsed: true") && fatherSrc.includes("parsed: false"));

/* ---------- C — the doctrine + the purity laws ---------- */

console.log("C — the doctrine source-pinned, the fathers' exclusivity");

const presentCode = presentSrc.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

ok("C1 the prompt's TEMPLATE LAW names the tool and the invention refusal",
  promptSrc.includes("19. THE TEMPLATE LAW") &&
    promptSrc.includes("get_custom_templates FIRST") &&
    promptSrc.includes("NEVER invent a template"));
ok("C2 the law teaches the re-mint refusal and the apply door",
  promptSrc.includes("NEVER re-mint a saved shape through build_pipeline") &&
    promptSrc.includes("one-click apply") &&
    promptSrc.includes("the payload travels on apply only"));
ok("C3 the law draws the cousin line (the ACTIVE PROJECT's shelf, not the user's global one)",
  promptSrc.includes("ACTIVE PROJECT") &&
    promptSrc.includes("the param presets' cousin line drawn"));
ok("C4 the presenter is pure — no clock, no db, no react (a template has no pace)",
  !/\bDate\.now\(\)/.test(presentCode) &&
    !presentSrc.includes("@/lib/db") && !presentSrc.includes("from \"react\"") &&
    !presentSrc.includes("useEffect"));
ok("C5 the no-age law at the door — the jobs' age fathers stay out",
  !presentSrc.includes("worldAgeWords") && !presentSrc.includes("durationMsOf") &&
    !presentSrc.includes("clockWordsOf"));
ok("C6 the counts ride the ONE father (no second parse in the presenter)",
  presentSrc.includes('from "@/lib/template-io"') &&
    presentSrc.includes("templateCountsOf") &&
    !presentCode.includes("JSON.parse"));
ok("C7 the display dialect is the source's own sort (newest first, pinned)",
  /localeCompare\(String\(a\.createdAt\)\)/.test(presentCode));
ok("C8 the corrupt word rides the father's own parsed flag (never inferred from zeros)",
  presentSrc.includes("corrupt: !counts.parsed"));

/* ---------- receipt ---------- */
console.log(`\nTEMPLATE-SHELF-TOOL-UNIT t1150: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
