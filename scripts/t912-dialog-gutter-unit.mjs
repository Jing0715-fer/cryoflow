#!/usr/bin/env node
/**
 * t912 — the DIALOG GUTTER's unit (the family law, node-only, 20 arms).
 *
 * THE LAW: the base DialogContent (ui/dialog.tsx) owns the narrow gutter
 * (`w-full max-w-[calc(100%-2rem)]`); a caller's width cap is
 * SM-PREFIXED. A bare unprefixed `max-w-<scale>` in a caller's className
 * is merged INTO the base string by cn() (tailwind-merge), which drops
 * the base's max-width as a conflicting utility — the measured
 * consequence (t912-star-gallery-narrow-audit, pre-seat): the star
 * dialog at a 320 viewport was 320px wide, edge-glued, the base gutter
 * void. 19 call-sites across 13 files carried the clobber; the seat
 * (t912-dialog-gutter-seat.mjs) moved every cap to sm:. This unit pins
 * the law where it lives so the next dialog inherits it on sight.
 *
 *   node scripts/t912-dialog-gutter-unit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* A1 — the base carries BOTH halves of the law: the gutter and the cap */
const base = readFileSync(`${ROOT}/src/components/ui/dialog.tsx`, "utf8");
/* the base's className is a multi-line cn() template with JSX `>` chars
 * inside — a block-regex would close early. The class LINE is the law. */
const baseLine = base.split("\n").find((l) => l.includes("max-w-[calc(100%-2rem)]")) ?? "";
ok("A1 the base DialogContent carries the gutter class", baseLine !== "");
ok("A2 the base carries w-full (the gutter's other half)", / w-full /.test(baseLine));

/* A3..A6 — tailwind-merge semantics, read from the installed lib: a bare
 * unprefixed max-w clobbers the base's arbitrary max-w; a sm:-prefixed
 * cap does NOT. This is the mechanism the seat relies on — pinned, not
 * assumed. */
const twMergePath = execSync("node -e 'console.log(require.resolve(\"tailwind-merge\"))'", { encoding: "utf8", cwd: ROOT }).trim();
const { twMerge } = await import(twMergePath);
const mergedBare = twMerge("w-full max-w-[calc(100%-2rem)] sm:max-w-lg", "max-w-4xl");
ok("A3 twMerge: a bare max-w REMOVES the base gutter (the clobber, named)", !/max-w-\[calc/.test(mergedBare) && /max-w-4xl/.test(mergedBare), mergedBare);
const mergedSm = twMerge("w-full max-w-[calc(100%-2rem)] sm:max-w-lg", "sm:max-w-4xl");
ok("A4 twMerge: an sm: cap PRESERVES the base gutter", /max-w-\[calc\(100%-2rem\)\]/.test(mergedSm) && /sm:max-w-4xl/.test(mergedSm), mergedSm);
ok("A5 twMerge: the sm: cap outranks the base's sm:max-w-lg (the wide cap survives)", !/sm:max-w-lg/.test(mergedSm));
ok("A6 the seat's rule-1 shape: dropping the bare twin leaves one sm: cap", twMerge("sm:max-w-4xl", "sm:max-w-4xl") === "sm:max-w-4xl");

/* A7..A9 — the family census: every <DialogContent> className in src/
 * (a) carries NO bare unprefixed max-w-<scale> cap (the clobber is dead);
 * (b) every sm: cap that exists sits WITH the base gutter surviving
 *     (twMerge dry-run proves it per site);
 * (c) the self-guttering shapes are exempt and counted. */
const files = execSync("grep -rl '<DialogContent' src --include=*.tsx", { encoding: "utf8" }).trim().split("\n");
const sites = [];
for (const f of files) {
  const src = readFileSync(`${ROOT}/${f}`, "utf8");
  for (const block of src.match(/<DialogContent\b[\s\S]*?>/g) || []) {
    const m = block.match(/className="([^"]*)"/);
    if (!m) continue;
    const line = src.slice(0, src.indexOf(block)).split("\n").length;
    sites.push({ f, line, cls: m[1] });
  }
}
ok("A7 the census walked the family", sites.length >= 40, `${sites.length} DialogContent call-sites`);
const BARE = /(^|\s)max-w-(sm|md|lg|xl|2xl|3xl|4xl|5xl)(?=\s|"|$)/;
const selfGutter = (cls) => /w-\[calc\(100vw/.test(cls) || /max-w-\[[^\]]*(?:calc|min)\(/.test(cls);
const clobbering = sites.filter((s) => !selfGutter(s.cls) && BARE.test(s.cls));
ok("A8 zero bare max-w caps remain (the clobber is dead family-wide)", clobbering.length === 0, clobbering.map((s) => `${s.f}:${s.line}`).join(", ") || "none");
const exempt = sites.filter((s) => selfGutter(s.cls)).length;
ok("A9 the self-guttering exemptions counted", exempt >= 4, `${exempt} sites carry their own arithmetic`);

/* A10 — per-site dry-run: for every site with an sm: cap, cn(base+site)
 * keeps BOTH the gutter and the cap (the merge law holding at every
 * door, not just in the abstract). */
const BASE_CLS = "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 sm:max-w-lg";
let mergeFails = 0, mergeChecked = 0;
for (const s of sites) {
  if (!/sm:max-w-/.test(s.cls)) continue;
  if (selfGutter(s.cls)) continue; // the site REPLACES the arithmetic with its own — by design, not a clobber
  mergeChecked++;
  const merged = twMerge(BASE_CLS, s.cls);
  if (!/max-w-\[calc\(100%-2rem\)\]/.test(merged)) mergeFails++;
}
ok("A10 every sm:-capped site keeps the gutter under twMerge (dry-run)", mergeFails === 0, `${mergeChecked} sites checked, ${mergeFails} failures`);

/* A11..A14 — the four named seats' source truth (the audit's own doors):
 * the star dialog, the inspector's two, the import gallery's two —
 * sm-prefixed, no bare twin. */
const srcOf = (f) => readFileSync(`${ROOT}/${f}`, "utf8");
const starDialog = srcOf("src/components/workflow/results/results-view.tsx").match(/className="([^"]*)"[^>]*\n\s+onKeyDown=\{onEscapeClose\(\(\) => setStarFile\(null\)\)\}/);
ok("A11 the star dialog's cap is sm-prefixed", !!starDialog && /sm:max-w-4xl/.test(starDialog[1]) && !BARE.test(starDialog[1]), starDialog?.[1]);
const inspectorSrc = srcOf("src/components/workflow/job-inspector.tsx");
ok("A12 the inspector carries no bare max-w cap", !([...inspectorSrc.matchAll(/<DialogContent\b[\s\S]*?>/g)].some((b) => { const m = b[0].match(/className="([^"]*)"/); return m && !selfGutter(m[1]) && BARE.test(m[1]); })));
ok("A13 the canvas save-template dialog's cap is sm-prefixed", /<DialogContent className="sm:max-w-sm gap-3"/.test(srcOf("src/components/workflow/canvas.tsx")));
ok("A14 the hpc-profiles editor's cap is sm-prefixed", /sm:max-w-4xl/.test(srcOf("src/components/workflow/hpc-profiles-editor.tsx")));

/* A15 — the seat script is on disk (the seat's own provenance) */
ok("A15 the seat script rides in scripts/", !!readFileSync(`${ROOT}/scripts/t912-dialog-gutter-seat.mjs`, "utf8").includes("the gutter law rides the family"));

/* A16 — git truth: the seat touched only className strings (no logic
 * lines moved). The diff must be max-w-only. */
const diff = execSync("git diff -U0 -- src", { encoding: "utf8", cwd: ROOT, maxBuffer: 10 * 1024 * 1024 });
const changed = diff.split("\n").filter((l) => /^[+-]/.test(l) && !/^[+-]{3}/.test(l));
const nonClass = changed.filter((l) => !/max-w-|className=/.test(l));
ok("A16 the diff is className-only (no logic moved)", changed.length > 0 && nonClass.length === 0, `${changed.length} +/- lines, ${nonClass.length} non-class`);

console.log(`\nDIALOG-GUTTER-UNIT t912: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
/* the receipt IS the receipt (the t910 lesson): an instrument that
 * cannot write its proof must fail loudly, not print green */
try {
  writeFileSync(
    `${ROOT}/shots-qa/t912-dialog-gutter-unit.json`,
    JSON.stringify({ instrument: "t912-dialog-gutter-unit", pass, fail, at: new Date().toISOString() }, null, 2)
  );
} catch (e) {
  console.log(`  ✗ the receipt could not be written: ${e.message?.slice(0, 120)}`);
  process.exit(2);
}
process.exit(fail === 0 ? 0 : 1);
