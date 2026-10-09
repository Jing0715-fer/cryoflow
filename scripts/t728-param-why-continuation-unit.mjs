// t728 — the param why's last mile: the inspector's params grid shows
// the winning row. t722 taught the find bar the `key:value` dialect and
// left its spans empty BY DESIGN — "the value lives in the params grid,
// the card face has no words to wash." This window the grid claims its
// own face: when the canvas find lens holds a param query and THIS job
// is genuinely inside the lens (the FULL jobMatchesFind gate, chips
// included — the same call canvas's matched-set memo makes), the row
// whose key won the lexicographic race wears a quiet amber whisper and
// its value cell washes through the shared FindMarkedText.
//
//   A  the last mile: the inspector asks the ONE matcher (imports from
//      lib, no private param walk), the lens state rides the store the
//      find bar already owns, and the gate mirrors canvas's line for
//      line (findOpen first, full gate second, param-only third).
//   B  the honest gate (live-fire): a row can never claim a match the
//      card does not ring — closed lens, empty query, chip mismatch,
//      chip-excluded job, non-matching value, text query: all wash
//      nothing. Winner determinism and legacy-row reach are live too.
//   C  the face: the hit row's whisper reuses the established amber
//      family (class-gallery token, never a new hue), the full-tree
//      FIND_MARK wash census stays at two homes, the value cell washes
//      whole through FindMarkedText, the row states with data and
//      title, and no motion debt rides the conditional class.
//   D  formatting honesty: displayParamValue may reformat the stored
//      value (true → "Yes"); the wash covers the displayed CELL — the
//      row-level claim — while the matcher's valueText stays the JS
//      truth. Both are honest at their own layer.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
// t733 jiti codemod — Node ≥24 ESM no longer resolves extensionless
// imports; jiti (in-tree) loads the REAL lib for live-fire, with the
// project's @/ alias wired so lib-internal @/ imports resolve too.
// In-place (not hoisted): the probe's own execution order is law.
import { createJiti } from "jiti";
import * as __path from "node:path";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": __path.resolve(import.meta.dirname, "..", "src") },
});
const { jobMatchWhy, jobMatchesFind } = await __jiti.import("../src/lib/job-match");

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) =>
  readFileSync(path.join(here, "..", "src", rel), "utf8");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const insp = readSrc("components/workflow/job-inspector.tsx");
const fm = readSrc("components/workflow/find-mark.tsx");
const card = readSrc("components/workflow/job-card.tsx");
const canvas = readSrc("components/workflow/canvas.tsx");

// ---------- A: the last mile ----------
console.log("A the last mile:");
must(insp.includes('from "@/lib/job-match"') && insp.includes("jobMatchWhy") && insp.includes("jobMatchesFind"),
  "A the inspector asks the one matcher (imports, no second walk)");
must(insp.includes('from "./find-mark"') && insp.includes("FindMarkedText"),
  "A the wash renders through its own home (t720's law holds)");
must(!/parseParamQuery|split\(":"\)|paramValueText/.test(insp),
  "A no private param dialect in the inspector (parse lives in lib only)");
{
  // the lens state rides the store — four selectors, zero new storage
  for (const sel of ["findOpen", "findQuery", "findStatus", "findCategory"]) {
    const ok = insp.includes(`useWorkflowStore((s) => s.${sel})`);
    must(ok, `A the grid reads the lens's own store word: ${sel}`);
  }
}
{
  // gate order inside the memo: findOpen → full jobMatchesFind → param-only
  // (t782 bookkeeping: the gate grew the noted rung — the anchor follows
  // the contract's new word form, the t776 lesson)
  const memoAt = insp.indexOf("const paramWhy = React.useMemo(");
  const openAt = insp.indexOf("if (!findOpen || !findQuery.trim()) return null;", memoAt);
  const gateAt = insp.indexOf("if (!jobMatchesFind(job, findQuery, findStatus, findCategory, findNoted)) return null;", memoAt);
  const srcAt = insp.indexOf('why && why.source === "param" ? why : null', memoAt);
  must(memoAt !== -1 && openAt !== -1 && openAt < gateAt && gateAt < srcAt,
    "A the gate order is findOpen → full gate → param-only (canvas's line-for-line mirror)",
    `open@${openAt - memoAt} gate@${gateAt - memoAt} src@${srcAt - memoAt}`);
  // canvas's own matched-set memo uses the same full-gate call (t782: the
  // noted rung rides in every consumer)
  must(canvas.includes("jobMatchesFind(j, findQuery, findStatus, findCategory, findNoted)"),
    "A canvas's matched set and the grid read the same gate call");
}

// ---------- B: the honest gate (live-fire) ----------
console.log("B the honest gate:");
{
  // probe-side mirror of ParamsGrid's derivation, built ONLY from lib
  // pieces — the census above pins the implementation to this structure.
  const paramWhy = (job, findOpen, query, status = "all", category = "all") => {
    if (!findOpen || !query.trim()) return null;
    if (!jobMatchesFind(job, query, status, category)) return null;
    const why = jobMatchWhy(job, query);
    return why && why.source === "param" ? why : null;
  };
  const j1 = {
    id: "j1", name: "mask round one", type: "maskcreate", status: "completed",
    params: { mask_diameter: 200, width: 400, do_queue: true },
  };
  must(paramWhy(j1, true, "mask:200")?.key === "mask_diameter",
    "B mask:200 wins on the mask_diameter row (the winner key is the stored key)");
  must(paramWhy(j1, true, "mask:200")?.valueText === "200",
    "B the why's valueText is the JS stringification (200)");
  must(paramWhy(j1, false, "mask:200") === null,
    "B a closed lens washes nothing (findOpen gate is real, not decorative)");
  must(paramWhy(j1, true, "") === null,
    "B an empty query washes nothing");
  must(paramWhy(j1, true, "mask:200", "running") === null,
    "B a status chip that excludes the job washes nothing (chips gate the row)");
  must(paramWhy(j1, true, "mask:200", "all", "class2d") === null,
    "B a stage chip outside postprocess washes nothing (category gate)");
  must(paramWhy(j1, true, "mask:200", "all", "postprocess")?.key === "mask_diameter",
    "B the matching stage chip leaves the row armed (postprocess ∋ maskcreate)");
  must(jobMatchWhy(j1, "mask")?.source === "name" && paramWhy(j1, true, "mask") === null,
    "B a text query still matches (as a name why) — and the grid ignores it");
  must(paramWhy(j1, true, "mask:400") === null,
    "B mask:400 is not 200 — whole-value equality holds to the last mile");
  must(paramWhy(j1, true, "width:400")?.key === "width",
    "B a second key finds its own row (the winner is per-query, not cached)");
  const j2 = {
    id: "j2", name: "mask round two", type: "maskcreate", status: "completed",
    params: { mask_diameter: 150, width: 400 },
  };
  must(paramWhy(j2, true, "mask:200") === null,
    "B the neighbor job with mask 150 washes nothing (per-job honesty)");
  const j3 = {
    id: "j3", name: "legacy carrier", type: "maskcreate", status: "completed",
    params: { legacy_relion_flag: "42", mask_diameter: 200 },
  };
  must(paramWhy(j3, true, "legacy:42")?.key === "legacy_relion_flag",
    "B a legacy stored key (spec no longer owns it) is still reachable — the Additional tab renders through the same row face");
  const j4 = {
    id: "j4", name: "tie breaker", type: "maskcreate", status: "completed",
    params: { mask_beta: 1, mask_alpha: 1, width: 400 },
  };
  must(paramWhy(j4, true, "mask:1")?.key === "mask_alpha",
    "B two keys match — the lexicographically smallest wins (t722 determinism to the last mile)");
}

// ---------- C: the face ----------
console.log("C the face:");
{
  // the hit row's conditional class: whisper tokens, no motion debt —
  // the census reads the CLASS STRING ITSELF (the law's literal scope),
  // not the prose around it (t717/t724's lesson: comments are literature).
  const cls = insp.match(/whyHit && "([^"]+)"/);
  must(cls !== null && cls[1].includes("bg-amber-500/5"),
    "C the row whisper uses the established amber family (bg-amber-500/5)",
    cls ? cls[1] : "no match");
  must(cls !== null && !cls[1].includes("transition") && !cls[1].includes("animate"),
    "C the hit row carries no motion debt (state, not arrival)");
  must(insp.includes('data-param-why-hit={whyHit || undefined}'),
    "C the row states with data (absent when false — no lying attributes)");
  must(insp.includes("spans={whyHit ? [[0, display.length]] : []}"),
    "C the value cell washes whole when hit, plain when not");
  must(insp.includes("title={whyHit ? whyTitle : undefined}"),
    "C the row's title speaks only when armed (hover truth, no cold chrome)");
  must(insp.includes("whyKey === row.key"),
    "C the winner lands by exact key identity (lexicographic winner → one row)");
}
{
  // full-tree census: the FIND_MARK wash hue keeps exactly two homes —
  // the inspector consumes it via FindMarkedText, invents no literal.
  const srcRoot = path.join(here, "..", "src");
  const amberHomes = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = path.join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(entry) && readFileSync(p, "utf8").includes("bg-amber-400/35"))
        amberHomes.push(path.relative(path.join(here, ".."), p));
    }
  };
  walk(srcRoot);
  must(amberHomes.length === 2 &&
       amberHomes.some((p) => p.endsWith("find-mark.tsx")) &&
       amberHomes.some((p) => p.endsWith("param-dialect-badge.tsx")),
    "C the wash hue still has exactly two homes in the whole tree", amberHomes.join(", "));
  must(!insp.includes("bg-amber-400/35"),
    "C the inspector invents no wash hue of its own");
  must(fm.includes("trustworthy") && fm.includes("spans.every"),
    "C the trustworthy guard still rides along (a wrong wash is worse than none)");
  must(card.includes("border-amber-500 ring-2 ring-amber-500/50"),
    "C the card's ring token is untouched (the row whisper is a quieter sibling, not a replacement)");
}
// ---------- D: formatting honesty ----------
console.log("D formatting honesty:");
{
  // displayParamValue's formatting (the inspector's own, mirrored):
  // booleans become Yes/No — the matcher matched "true", the cell says
  // "Yes". The wash covers the CELL (row-level claim); the why's
  // valueText stays the JS truth. Both layers stay honest.
  const display = (v) => {
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (v == null) return "—";
    if (typeof v === "object") { try { return JSON.stringify(v); } catch { return String(v); } }
    const s = String(v);
    return s === "" ? "—" : s;
  };
  const j5 = {
    id: "j5", name: "boolean carrier", type: "maskcreate", status: "completed",
    params: { do_queue: true, mask_diameter: 200 },
  };
  const why = jobMatchWhy(j5, "do_queue:true");
  must(why !== null && why.source === "param" && why.valueText === "true",
    "D the matcher's valueText is the JS word: \"true\"");
  must(display(true) === "Yes" && display(true) !== why?.valueText,
    "D the displayed cell is the human word: \"Yes\" — the two layers differ and both are honest");
  must(why !== null && why.spans.length === 0,
    "D the why's own spans stay empty by design (t722's geometry — the cell wash is the grid's, not the matcher's)");
  const j6 = {
    id: "j6", name: "empty string carrier", type: "maskcreate", status: "completed",
    params: { note_field: "" },
  };
  must(display(j6.params.note_field) === "—" && jobMatchWhy(j6, "note_field:") === null,
    "D the em-dash placeholder and the empty-value dialect edge both stay honest (no phantom hits)");
}

console.log(`\nt728 param why continuation: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);
