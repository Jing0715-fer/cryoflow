// t722 — the PARAM dialect unit probe: lib/job-match.ts grows an explicit
// `key:value` rung ("which jobs ever ran mask = 20?"), the find bar grows
// the badge that says what kind of question is being answered, and the
// three existing consumers (canvas ring/dim, minimap dots, find count)
 // inherit the rung through the SAME import they already read.
//
//   A  parseParamQuery — the dialect gate (colon required, both sides
//      non-empty, FIRST colon splits, case preserved, typing-mid queries
//      fall through to the text ladder untouched).
//   B  the param rung's match law (key substring, value EXACT equality,
//      three value domains, determinism, exclusivity) and the why
//      contract (spans empty on purpose; boolean is still the view).
//   C  the consumers: status ∧ stage gates hold, import graph carries
//      the rung (canvas/minimap untouched), job-card washes nothing.
//   D  the find bar's badge face (same parse, amber hue, honest title).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  parseParamQuery,
  jobMatchWhy,
  jobMatchesQuery,
  jobMatchesFind,
} from "../src/lib/job-match";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** A job fixture with a params record — the domain the new rung reads. */
const pjob = (name, type, params, status = "completed") => ({
  id: "j", name, type, status, params,
});

// ---------- A: the dialect gate ----------
console.log("A parseParamQuery:");
must(eq(parseParamQuery("mask:20"), { key: "mask", value: "20" }),
  "A the plain form: mask:20 → key mask, value 20");
must(parseParamQuery("ctf") === null,
  "A no colon, no dialect — a bare query stays a text question");
must(parseParamQuery("mask 20") === null,
  "A space is not a colon: 'mask 20' is a name question like it always was");
must(parseParamQuery("mask:") === null,
  "A empty value (still typing) is NOT the dialect — text ladder untouched");
must(parseParamQuery(":20") === null,
  "A empty key is NOT the dialect — ':20' has nothing to match a key by");
must(eq(parseParamQuery("fn:/path/Relion/job007/movies"), { key: "fn", value: "/path/Relion/job007/movies" }),
  "A FIRST colon splits: a path value keeps its own colons");
must(eq(parseParamQuery("  Mask: 20 "), { key: "Mask", value: " 20" }),
  "A outer trim then FIRST split: case preserved, inner spaces survive");
must(parseParamQuery("") === null && parseParamQuery("   ") === null,
  "A empty/blank query is no dialect (and no text match — the old law)");

// ---------- B: the param rung's match law ----------
console.log("B param rung:");
const j1 = pjob("Refine3D", "refine3d", {
  mask_diameter: 200,
  angpix: 1.24,
  do_helix: false,
  fn_mask: "/previous/run/mask.mrc",
});
{
  const why = jobMatchWhy(j1, "fn:/previous/run/mask.mrc");
  must(why !== null && why.source === "param",
    "B key substring + value equality: 'fn' finds fn_mask via the param rung");
  must(why !== null && why.key === "fn_mask" && why.valueText === "/previous/run/mask.mrc",
    "B the why names the FULL key, not the needle the user typed",
    why && why.key);
}
{
  const twin = pjob("J5b", "refine3d", { mask_diameter: 30, zmask: 30 });
  const why = jobMatchWhy(twin, "mask:30");
  must(why?.key === "mask_diameter",
    "B lexicographically smallest key wins: mask_diameter beats zmask",
    why?.key);
}
must(jobMatchWhy(j1, "mask:200") !== null,
  "B the full value matches: mask:200 hits mask_diameter");
must(jobMatchWhy(j1, "mask:20") === null,
  "B value is EXACT, not substring: mask:20 means twenty — j1 holds 200 and a path, neither is 20");
must(jobMatchWhy(pjob("J2", "class2d", { K: 64 }), "k:64") !== null,
  "B key match is case-insensitive: k:64 finds K");
must(jobMatchWhy(j1, "angpix:1.24") !== null,
  "B number domain: a float matches its JS stringification");
must(jobMatchWhy(j1, "do_helix:true") === null,
  "B boolean domain: false never answers true");
must(jobMatchWhy(pjob("J3", "class2d", { do_norm: true }), "do_norm:TRUE") !== null,
  "B boolean domain: comparison is case-insensitive (TRUE hits true)");
must(jobMatchWhy(j1, "fn_mask:/previous/run/mask.mrc") !== null,
  "B string domain: a path answers its whole self");
must(jobMatchWhy(j1, "nonsense:20") === null,
  "B a key nothing half-remembers is a null, not a guess");
must(jobMatchWhy(pjob("J4", "class2d", undefined), "mask:20") === null,
  "B a job with no params record fails the rung without throwing");
// determinism over insertion order: the SAME winner whichever way the
// JSON happened to serialize — the badge names one key on every machine
{
  const a = jobMatchWhy(pjob("J5", "refine3d", { mask_diameter: 30, zmask: 30 }), "mask:30");
  const b = jobMatchWhy(pjob("J5", "refine3d", { zmask: 30, mask_diameter: 30 }), "mask:30");
  must(a?.key === b?.key && a?.key === "mask_diameter",
    "B insertion order is noise: smallest key wins both ways", a?.key);
}
// exclusivity: an explicit dialect query never falls back to text
{
  const named = pjob("mask:20 fan club", "import", { other: 1 });
  must(jobMatchWhy(named, "mask:20") === null,
    "B the rung is exclusive: mask:20 does not ring a job by its name");
  must(jobMatchWhy(named, "other:1") !== null,
    "B the same job rings fine on a param it actually has");
}
// the why contract survives: predicate ⟺ why != null, spans stay empty
{
  const queries = ["mask:20", "angpix:1.24", "ctf", "cls2", "zzz"];
  let allView = true;
  for (const q of queries) {
    if (jobMatchesQuery(j1, q) !== (jobMatchWhy(j1, q) !== null)) allView = false;
  }
  must(allView, "B the boolean is still a VIEW of the why (one walk, two answers)");
}
{
  const why = jobMatchWhy(j1, "mask:200");
  must(why !== null && why.source === "param" && Array.isArray(why.spans) && why.spans.length === 0,
    "B param geometry is honestly empty — no surface text claims the value");
}

// ---------- C: the consumers and the import graph ----------
console.log("C consumers:");
{
  const withStatus = pjob("J6", "refine3d", { mask_diameter: 200 }, "running");
  must(jobMatchesFind(withStatus, "mask:200", "completed", "all") === false,
    "C the status gate holds: a param hit cannot revive a non-running card");
  must(jobMatchesFind(withStatus, "mask:200", "running", "all") === true,
    "C the status gate holds in the positive direction");
  must(jobMatchesFind(withStatus, "mask:200", "all", "class2d") === false,
    "C the stage gate holds: param hits answer to the same category lens");
  must(jobMatchesFind(withStatus, "mask:200", "all", "refine") === true,
    "C the stage gate holds in the positive direction");
}
{
  const canvas = readSrc("components/workflow/canvas.tsx");
  const minimap = readSrc("components/workflow/canvas-minimap.tsx");
  must(!canvas.includes("parseParamQuery") && !minimap.includes("parseParamQuery"),
    "C canvas/minimap carry no dialect awareness — they inherit through jobMatchesFind");
  must(canvas.includes("jobMatchesFind") && minimap.includes("jobMatchesFind"),
    "C the three-consumer import graph is intact");
  const card = readSrc("components/workflow/job-card.tsx");
  must(!card.includes('source === "param"') && !card.includes('source==="param"'),
    "C job-card washes nothing for the param member (the badge is the why)");
  must(card.includes('source === "name"') && card.includes('source === "label"'),
    "C job-card's text washes are exactly as t655 left them");
}

// ---------- D: the find bar's badge face ----------
console.log("D badge face:");
{
  // t724 AMENDMENT — the badge moved into param-dialect-badge.tsx (the
  // roster search speaks the same dialect and imports the same marker).
  // The census follows the words: the parser/amber/title assertions now
  // read the badge component; the find bar's own census is the import.
  const badge = readSrc("components/workflow/param-dialect-badge.tsx");
  const bar = readSrc("components/workflow/canvas-find-bar.tsx");
  must(bar.includes('from "./param-dialect-badge"'),
    "D the find bar renders the shared badge component");
  must(badge.includes("parseParamQuery"),
    "D the badge arms from the SAME parser the matcher runs");
  must(bar.includes("canvas-find-param-badge"),
    "D the badge carries its testid (via prop)");
  must(badge.includes("bg-amber-400/35"),
    "D the badge wears the find dialect's amber — no second color language");
  must(badge.includes("key matches by substring, value must equal exactly"),
    "D the full match law lives in the badge's title/hover");
  must(badge.includes("if (!parseParamQuery(query)) return null"),
    "D the badge renders only while the dialect is armed");
  must(bar.includes('placeholder="Find by name, type, or key:value…"'),
    "D the placeholder names the new dialect (discovery without a tutorial)");
  must(!badge.includes("transition") && !badge.includes("animate-"),
    "D the badge is a state, not an arrival — no cascade rung, no motion debt");
}

console.log(`\n${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
