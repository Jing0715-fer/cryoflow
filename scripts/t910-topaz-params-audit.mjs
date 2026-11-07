#!/usr/bin/env node
/**
 * t910 — the Topaz wrapper's params surface, AUDITED (the dispatch's named
 * feature direction — audit-first, nothing seated yet). The denoise face
 * speaks topaz's own CLI through the wrapper, and its surface is spread
 * across FIVE layers that must agree; this instrument pins each joint so
 * a future seat (a new param) knows exactly which layers it must touch:
 *
 *   spec (workflow.ts)        → the form fields, tabs, defaults, hints
 *   builder (engine.ts:7340)  → the argv the job actually runs
 *   template (command-templates.ts:25) → the human-readable shape
 *   width (gpu-width.ts)      → the cluster's GPU grant
 *   handoff (store.ts)        → the denoise→pick knob sync
 *   collect (engine.ts:8308)  → the output the chain consumes
 *   live (GET /api/jobs)      → the params shape at rest
 *
 * The claims, one assert each:
 *   A1 the spec carries topazDownscale (default −1, the Denoise tab)
 *   A2 the spec carries topazWorkers (default 1, Advanced, advanced)
 *   A3 the spec carries topazArgs (raw extras; the hint names --device
 *      AND the --model override — the escape hatches are TAUGHT)
 *   A4 the builder's exe rule: the user-typed fn_topaz_exe WINS over the
 *      probe (the t387 rule, three lanes one law)
 *   A5 the argv shape: `topaz denoise --i <star> -o <workdir>/`
 *   A6 --downscale rides ONLY when > 0 (−1 = auto never becomes a flag)
 *   A7 --num-workers rides ONLY when > 1 (1 worker = topaz's own default)
 *   A8 topazArgs is the DIRECT dialect: raw extras expand in place —
 *      NOT the training face's --topaz_args bag (the asymmetry is named
 *      in the builder's own comment; this pin makes it law)
 *   A9 the input gate: no micrographs_star → an honest refusal naming
 *      the connectables (Import/MotionCorr/CTF)
 *   A10 the template names both first-class flags (--downscale,
 *       --num-workers) and the wrapper's star-expansion contract
 *   A11 topazdenoise ∈ SINGLE_GPU_TYPES (the cluster grants one card;
 *       --device stays the LOCAL lane's business via topazArgs)
 *   A12 the handoff: the denoise→pick seat syncs downscale + workers
 *       (same stack, same scale — nothing inherited on faith)
 *   A13 the collect face reads denoised_micrographs.star into
 *       outputs.micrographs_star (the chainable output Picking/Training
 *       consume unchanged)
 *   A14 the provider list: downstream stages accept topazdenoise as a
 *       micrographs_star source
 *   A15 LIVE: a resting topazdenoise job's params carry the three keys
 *
 * Usage: node --import ./scripts/ts-alias-register.mjs scripts/t910-topaz-params-audit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const read = (p) => readFileSync(`${ROOT}/${p}`, "utf8");

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* A1–A3 — the spec */
const wf = read("src/lib/workflow.ts");
const specBlock = wf.slice(wf.indexOf('"topazdenoise"', wf.indexOf('"topazdenoise"') + 1));
ok("A1 the spec: topazDownscale default −1 on the Denoise tab", /num\("topazDownscale", "Topaz: downscale factor", -1, \{ step: 1, min: -1, tab: "Denoise"/.test(wf), "−1 = automatic, topaz's own scale law");
ok("A2 the spec: topazWorkers default 1, Advanced, advanced", /num\("topazWorkers", "Topaz: workers", 1, \{ step: 1, min: 1, tab: "Advanced", advanced: true/.test(wf));
ok("A3 the spec: topazArgs teaches both escape hatches (--device, --model)", /raw extras passed to topaz denoise, e\.g\. --device cpu \(a --model here overrides the built-in general denoiser\)/.test(wf));

/* A4–A9 — the builder */
const engine = read("src/lib/relion/engine.ts");
const denoiseCase = engine.slice(engine.indexOf('case "topazdenoise": {', engine.indexOf('case "topazdenoise": {') + 1) + 20);
const caseSrc = engine.slice(engine.indexOf('case "topazdenoise":'), engine.indexOf('case "localres":'));
ok("A4 the exe rule: fn_topaz_exe wins over the probe", /str\(job, "fn_topaz_exe", ""\)\.trim\(\) \|\|\s*\(await externalFor\(ctx, "topaz", \["relion_python_topaz", "topaz"\]\)\)/.test(caseSrc), "the t387 user-typed-wins rule");
ok("A5 the argv shape: topaz denoise --i <star> -o <workdir>/", /const argv = \[\s*topaz,\s*"denoise",\s*"--i", inputs\.micrographs_star,\s*"-o", ctx\.workdir \+ "\/",\s*\];/.test(caseSrc), "the wrapper expands the star where the files live");
ok("A6 --downscale rides only > 0", /const downscale = num\(job, "topazDownscale", -1\);\s*if \(downscale > 0\) argv\.push\("--downscale", String\(Math\.round\(downscale\)\)\);/.test(caseSrc));
ok("A7 --num-workers rides only > 1", /const workers = Math\.round\(num\(job, "topazWorkers", 1\)\);\s*if \(workers > 1\) argv\.push\("--num-workers", String\(workers\)\);/.test(caseSrc));
ok("A8 topazArgs is the DIRECT dialect (raw split, not a --topaz_args bag)", /if \(extra\) argv\.push\(\.\.\.extra\.split\(\/\\s\+\/\)\.filter\(Boolean\)\);/.test(caseSrc) && /direct CLI dialect/.test(caseSrc));
ok("A9 the input gate refuses honestly and names the connectables", /"Micrographs missing — denoising runs on real micrograph files; connect Import\/MotionCorr\/CTF findings first"/.test(caseSrc));

/* A10 — the template */
const tmpl = read("src/lib/relion/command-templates.ts");
ok("A10 the template names both flags + the star-expansion contract", /topaz denoise --i <micrographs\.star> -o <outdir>\/ \[--downscale <f>\] \[--num-workers <n>\]/.test(tmpl) && /the RELION wrapper expands the star where the files live/.test(tmpl));

/* A11 — the width */
const width = read("src/lib/hpc/gpu-width.ts");
ok("A11 topazdenoise ∈ SINGLE_GPU_TYPES (one card; --device stays local's business)", /"topazdenoise",/.test(width.slice(width.indexOf("SINGLE_GPU_TYPES"))));

/* A12 — the handoff */
const store = read("src/lib/store.ts");
ok("A12 the denoise→pick handoff syncs downscale + workers", /topazDownscale: denoise\.params\.topazDownscale \?\? -1,/.test(store) && /topazWorkers: denoise\.params\.topazWorkers \?\? 1,/.test(store), "same stack, same scale — the pick's own dials keep their defaults");

/* A13 — the collect face */
ok("A13 the collect face reads denoised_micrographs.star → micrographs_star", /const star = firstExisting\(workdir, \["denoised_micrographs\.star"\]\);\s*if \(star\) \{\s*outputs\.micrographs_star = star;/.test(engine));

/* A14 — the provider list */
ok("A14 downstream accepts topazdenoise as a micrographs_star provider", /from: \["import", "motioncorr", "ctffind", "topazdenoise", "excludemg"\]/.test(engine));

/* A15 — the live shape */
let liveOk = false;
let liveKeys = "";
try {
  const raw = execSync(`curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs"`, { encoding: "utf8", timeout: 30_000 });
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : (parsed?.jobs ?? []);
  const td = list.find((j) => j.type === "topazdenoise");
  if (td) {
    const keys = Object.keys(td.params ?? {});
    liveKeys = keys.filter((k) => k.startsWith("topaz")).join(",");
    liveOk = ["topazDownscale", "topazWorkers"].every((k) => keys.includes(k));
  }
} catch {}
ok("A15 LIVE: a resting topazdenoise job carries the param keys", liveOk, liveKeys || "no topazdenoise job in the world");

console.log(`\nTOPAZ-PARAMS-AUDIT t910: ${pass}/${pass + fail} ${fail === 0 ? "green — the surface is mapped, the joints pinned" : "RED"}`);
try { writeFileSync(`${ROOT}/shots-qa/t910-topaz-params-audit.json`, JSON.stringify({ instrument: "t910-topaz-params-audit", pass, fail, at: new Date().toISOString() }, null, 2)); } catch {}
process.exit(fail === 0 ? 0 : 1);
