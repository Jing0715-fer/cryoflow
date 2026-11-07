#!/usr/bin/env node
// t649 — danger rung vocabulary assert (static law enforcement).
//
// Family A — HUE ZERO: outside the exemptions, no rose-/red- color class
//            survives in src/. Same regex as the codemod (single source
//            of truth for what a "site" is), same file/line/comment
//            exemptions. Zero-whitelist on rungs: 50–950 are ALL
//            legislated, so any hit anywhere is a violation.
// Family B — LEGISLATION FIDELITY: the 11 danger rung tokens in
//            globals.css must match theme.css's rose scale byte-for-byte
//            (t646 lesson: the palette's oklch is the law).
// Family C — CODEX WEARS THE VOCABULARY: lib/status-style.ts's failed
//            SOLID rides bg-danger-500/85 (the codex is the first
//            citizen, not a holdout).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP_FILES = new Set([
  "src/lib/workflow.ts",
  "src/components/workflow/results/fsc-compare-dialog.tsx",
]);
const SKIP_LINE_IF = [
  { file: "src/components/workflow/header.tsx", test: (l) => l.includes('=== "rose"') },
  { file: "src/components/workflow/results/fsc-chart.tsx", test: (l) => l.includes("linear-gradient(90deg, currentColor") },
  { file: "src/components/workflow/results/molstar-embed.tsx", test: (l) => l.includes("bg-red-600/90") },
];
const SITE = /(?<![\w-])((?:[a-z-]+:)*)((?:text|bg|border|ring|from|via|to|fill|stroke|outline|decoration|divide|shadow|accent|caret)(?:-(?:x|y|t|b|l|r|s|e|offset))?)-(rose|red)-(\d{2,3})(\/(?:\d+|\[0?\.\d+\]))?(?![\w/-])/g;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?)$/.test(name)) out.push(p);
  }
  return out;
}

let failures = 0;
const ok = (cond, label) => {
  if (!cond) { failures++; console.error(`FAIL: ${label}`); }
  else console.log(`ok: ${label}`);
};

// ---- Family A: hue zero ----
const survivors = [];
for (const f of walk("src")) {
  const rel = f.replaceAll("\\", "/");
  if (SKIP_FILES.has(rel)) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isComment = line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("/*");
    if (isComment) continue;
    if (SKIP_LINE_IF.some(({ file, test }) => file === rel && test(line))) continue;
    SITE.lastIndex = 0;
    if (SITE.test(line)) survivors.push(`${rel}:${i + 1}`);
  }
}
ok(survivors.length === 0, `A: rose/red hue classes = 0 outside exemptions (got ${survivors.length}${survivors.length ? ": " + survivors.join(", ") : ""})`);

// ---- Family B: legislation fidelity (11 rungs vs theme.css) ----
const theme = readFileSync("node_modules/tailwindcss/theme.css", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");
const RUNGS = ["50","100","200","300","400","500","600","700","800","900","950"];
for (const r of RUNGS) {
  const m = theme.match(new RegExp(`--color-rose-${r}: ([^;]+);`));
  ok(!!m, `B: theme.css has --color-rose-${r}`);
  if (m) {
    const val = m[1];
    ok(globals.includes(`--color-danger-${r}: ${val};`), `B: --color-danger-${r} ≡ palette rose-${r} (${val})`);
  }
}
ok(globals.includes("t649 — the DANGER rung vocabulary"), "B: t649 legislation verdict comment in place");

// ---- Family C: codex wears the vocabulary ----
const codex = readFileSync("src/lib/status-style.ts", "utf8");
ok(codex.includes('failed: "bg-danger-500/85 dark:bg-danger-500/80"'), "C: codex failed SOLID rides bg-danger-500/85");
ok(!codex.includes("bg-rose-500/85"), "C: codex has no rose literal left");

if (failures) { console.error(`t649-assert: ${failures} FAIL`); process.exit(1); }
console.log("t649-assert: ALL PASS");
