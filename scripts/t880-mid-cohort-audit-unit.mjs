// t880 — THE MID-COHORT AUDIT UNIT: the route tree's between-generation
// tier (5 doors last touched 2026-10-15 → 2026-11-02) walked line by line,
// the receipt becomes the fence.
//
// The method (t1168's, continued): the route tree sorted by last-touch
// date — 12 @2026-10-10 walked in t1168, 18 @2026-10-13 in t1171 — the
// FIVE doors between the audit generations and the young surge walked
// this window (562 lines): projects/[id]/pace · projects/[id]/world-ledger ·
// jobs/[id]/outputs/push · param-presets · projects/[id]/fleet-ledger.
//
// The verdict: CLEAN — every door guards first (and the guard-ORDERING
// law the t879 audit's E-family pinned holds here too), world-ledger's
// byte bound answers BEFORE the trust decision spends a parse, the
// envelope rides VERBATIM (no re-stringify between PUT and GET),
// param-presets' both handlers ride the ONE sanitize father and the
// empty-PUT keeps the row (the synced-flag semantics), push's twin
// address is DERIVED (no body field can aim the write) with the per-call
// cap and the dedupe law, and pace stays FS-FREE (DB clock facts only).
//
// A clean receipt is not a fence. The laws become pins so the next
// window's drift flaps here instead of living quietly.
//
// node scripts/t880-mid-cohort-audit-unit.mjs
//

import { readFileSync } from "node:fs";

const ROOT = "/home/z/my-project";
const read = (rel) => readFileSync(`${ROOT}/${rel}`, "utf8");
/** strip comments so prose mentions never count as code */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const TIER = [
  "src/app/api/projects/[id]/pace/route.ts",
  "src/app/api/projects/[id]/world-ledger/route.ts",
  "src/app/api/jobs/[id]/outputs/push/route.ts",
  "src/app/api/param-presets/route.ts",
  "src/app/api/projects/[id]/fleet-ledger/route.ts",
];

// ── A — the tier is the audit's 5 files, each door guarded ──────────────

ok("A0 the tier is exactly the 5 mid-cohort doors", TIER.length === 5, `${TIER.length} files, last touched 2026-10-15 → 2026-11-02`);

const tierCode = new Map();
let missing = null;
for (const rel of TIER) {
  try {
    tierCode.set(rel, codeOf(read(rel)));
  } catch {
    missing = rel;
  }
}
ok("A0b every tier file exists and reads", missing === null, missing ?? "5/5");

const unguarded = TIER.filter((rel) => !tierCode.get(rel).includes("isLocalRequest"));
ok("A1 every tier door carries the same-origin guard", unguarded.length === 0, unguarded[0] ?? "isLocalRequest ×5");

const VERB_RE = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
const lateDoors = [];
for (const rel of TIER) {
  const code = tierCode.get(rel);
  VERB_RE.lastIndex = 0;
  let m;
  while ((m = VERB_RE.exec(code)) !== null) {
    const rest = code.slice(m.index);
    const touch = rest.search(/findEffectiveJob\(|db\.(job|edge|workspace|project|user|presetShelf|worldLedger)\.|getRun\(|readdirSync\(|readFileSync\(|existsSync\(/);
    const guard = rest.indexOf("isLocalRequest(");
    if (touch !== -1 && guard !== -1 && touch < guard) lateDoors.push(`${rel} [${m[1]}]`);
  }
}
ok("A2 every tier door's guard answers before its first data-touch", lateDoors.length === 0, lateDoors[0] ?? "the ordering law holds ×5");

// ── B — the tier's named laws, pinned ───────────────────────────────────

const ledger = tierCode.get("src/app/api/projects/[id]/world-ledger/route.ts");
const boundAt = ledger.indexOf("envelope.length > WORLD_LEDGER_ENVELOPE_MAX_BYTES");
const trustAt = ledger.indexOf("validateWorldLedgerEnvelope(envelope)");
ok("B1 world-ledger's byte bound precedes the trust decision", boundAt !== -1 && trustAt !== -1 && boundAt < trustAt, "413 before the parse spends its effort (the t1141 tooth made law)");
ok("B2 world-ledger stores the envelope VERBATIM", /update: \{ envelope \}/.test(ledger) && /create: \{ projectId: id, envelope \}/.test(ledger), "no re-stringify — the GET hands back the exact bytes");
ok("B3 world-ledger speaks one envelope shape (the 400 door)", ledger.includes('envelope: string }'), "a non-string envelope is refused, never coerced");

const presets = tierCode.get("src/app/api/param-presets/route.ts");
const sanitizes = (presets.match(/sanitizePresetShelf\(/g) || []).length;
ok("B4 param-presets rides the ONE sanitize father", sanitizes === 2, `${sanitizes} call sites — GET's corrupt-row read and PUT's body, one parser, never a second`);
ok("B5 param-presets keeps the row on an empty PUT", presets.includes("upsert") && !presets.includes("delete"), "the row's existence is the synced flag (t715's semantics)");
ok("B6 param-presets' corrupt row reads as empty, not a 500", presets.includes("JSON.parse(row.data)") && presets.includes("presets = [];"), "the next PUT rewrites it");

const push = tierCode.get("src/app/api/jobs/[id]/outputs/push/route.ts");
ok("B7 push's twin address is DERIVED, never body-supplied", /twinWorkdirFor\(\s*witness/.test(push) && !push.includes("body?.twinWorkdir"), "no body field can aim the write");
ok("B8 push keeps the per-call cap and the dedupe law", push.includes("MAX_PATHS_PER_CALL = 8") && push.includes("new Set(bodyPaths"), "a duplicated path is one push, not two");
const twinLib = codeOf(read("src/lib/remote/twin-push.ts"));
ok("B9 push's path law lives in the lib (no leading /, no .. segments)", twinLib.includes("rel.split(\"/\").includes(\"..\")") && twinLib.includes("Path rejected"), "the verdict layer speaks it — the planner never sees raw paths");

const pace = tierCode.get("src/app/api/projects/[id]/pace/route.ts");
ok("B10 pace stays FS-FREE (the DB-clock law)", !pace.includes("existsSync") && !pace.includes("readFileSync") && !pace.includes("walkWorkdir"), "cheap on any project size");

const fleet = tierCode.get("src/app/api/projects/[id]/fleet-ledger/route.ts");
ok("C1 fleet-ledger's live probe is opt-in (?measure=1)", fleet.includes('get("measure") === "1"'), "the sidecar's last measurement serves by default");
ok("C2 fleet-ledger refuses cross-site like every storage-adjacent door", fleet.includes("isLocalRequest(request)"), "the t259 family law");

// ── D — the t1165 census's LATE-GUARD phase covers the tier ─────────────

const censusSrc = read("scripts/t1165-route-guard-census.mjs");
ok("D1 the tree-wide ordering instrument exists", censusSrc.includes("LATE-GUARD"), "t879's phase walks every door automatically");

console.log(`\nt880 mid-cohort audit unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
