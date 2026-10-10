// t649 — the danger rung vocabulary probe.
//
// This window retired the rose/red hue NAMES into semantic rung tokens
// (--color-danger-50..950 in globals.css, 11 tokens) — the t648 move
// applied to the danger family. Rose sites were pure renames (zero-pixel;
// rose-600 IS --danger's oklch); red sites were documented pixel changes
// (t646 pinned --danger to rose-600, so red follows the rose base).
// Two blind spots were found and fixed along the way: the census's α gap
// (\d missed two-digit alphas — 89 unsseeable sites) and its rung gap
// (\d00 missed 50/950), plus the codemod's prop gap (ring-offset,
// border-l) that the diff audit caught.
//
// Verdicts:
//   A  legislation — the 11 rung tokens byte-faithful to the palette's
//      rose scale, the verdict comment in place, theme-independent
//      (no :root/.dark flip), full 50–950 coverage (no whitelist).
//   B  ecosystem — t649-assert exits 0, the codemod is idempotent
//      (dry = 0), the REPAIRED t646 census asserts clean (SAFE+TAIL
//      zero, NAME 16 identity strings only), and the t647/t648 asserts
//      STILL exit 0 (four generations of law coexist).
//   C  vocabulary — zero rose/red class residue in the non-exempt field
//      (counted in-process with the codemod's own regex), the semantic
//      vocabulary alive at scale, identity exemptions ALIVE (workflow.ts
//      references2d rose, header ternary dots, fsc-chart legend swatch,
//      molstar REC badge).
//   D  living pixels — sandboxed .text-danger-700 resolves to palette
//      rose-700 bytes (legislation fidelity, t647 D2 mode), .text-danger-50
//      proves the two-digit rung (the blind-spot fix is REAL law), and
//      the stylesheet carries the renamed classes at scale.
//   E  console hygiene.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const BASE = "http://localhost:3000";
let PASS = 0;
let FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) {
    PASS++;
    console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    FAIL++;
    console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
};

// A — legislation
const globals = readFileSync("src/app/globals.css", "utf8");
const theme = readFileSync("node_modules/tailwindcss/theme.css", "utf8");
const RUNGS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
let faithful = 0, missing = 0;
for (const r of RUNGS) {
  const g = globals.match(new RegExp(`--color-danger-${r}:\\s*([^;]+);`));
  const t = theme.match(new RegExp(`--color-rose-${r}:\\s*([^;]+);`));
  if (!g || !t) { missing++; continue; }
  if (g[1].trim() === t[1].trim()) faithful++;
}
must(
  faithful === 11 && missing === 0,
  "A all 11 danger rungs byte-faithful to the palette rose scale (50–950, no whitelist)",
  `${faithful}/11 faithful, ${missing} missing`,
);
must(
  /t649 — the DANGER rung vocabulary/.test(globals) && /DOCUMENTED pixel change/.test(globals),
  "A legislation verdicts in place (pure rename vs documented pixel change)",
);
const rootBlock = globals.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
const darkBlock = globals.match(/\.dark\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
must(
  !/--color-danger-700/.test(rootBlock) && !/--color-danger-700/.test(darkBlock),
  "A rung tokens are theme-independent (absent from :root/.dark flip)",
);

// B — ecosystem
const assert = spawnSync("node", ["scripts/t649-assert.mjs"], { encoding: "utf8" });
must(assert.status === 0, "B t649-assert exits 0", (assert.stdout || "").trim().split("\n").pop());
const dry = spawnSync("node", ["scripts/t649-danger-rung-codemod.mjs", "--dry"], { encoding: "utf8" });
must(
  /0 sites \/ 0 files/.test(dry.stdout),
  "B t649 codemod idempotent (dry = 0)",
  (dry.stdout || "").trim().split("\n")[0],
);
const census = spawnSync("node", ["scripts/t646-danger-census.mjs", "--assert"], { encoding: "utf8" });
must(
  census.status === 0,
  "B REPAIRED t646 census asserts clean (SAFE+TAIL zero — the α/rung blind spots are closed)",
);
const censusOut = spawnSync("node", ["scripts/t646-danger-census.mjs"], { encoding: "utf8" }).stdout;
must(/NAME\s+16/.test(censusOut), "B census NAME = 16 (identity strings intact, untouched)", "NAME 16");
for (const gen of ["t647-assert.mjs", "t648-assert.mjs"]) {
  const r = spawnSync("node", ["scripts/" + gen], { encoding: "utf8" });
  must(r.status === 0, `B ${gen} STILL exits 0 (generations coexist)`);
}

// C — vocabulary
const SKIP_FILES = new Set([
  "src/lib/workflow.ts",
  "src/components/workflow/results/fsc-compare-dialog.tsx",
  "src/app/globals.css",
]);
const SKIP_LINE_IF = [
  { file: "src/components/workflow/header.tsx", test: (l) => l.includes('=== "rose"') },
  { file: "src/components/workflow/results/fsc-chart.tsx", test: (l) => l.includes("linear-gradient(90deg, currentColor") },
  { file: "src/components/workflow/results/molstar-embed.tsx", test: (l) => l.includes("bg-red-600/90") },
];
const SITE = /(?<![\w-])((?:[a-z-]+:)*)((?:text|bg|border|ring|from|via|to|fill|stroke|outline|decoration|divide|shadow|accent|caret)(?:-(?:x|y|t|b|l|r|s|e|offset))?)-(rose|red)-(\d{2,3})(\/(?:\d+|\[0?\.\d+\]))?(?![\w/-])/g;
let residue = 0, dangerVocab = 0;
const walk2 = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk2(p); continue; }
    if (!/\.(tsx?)$/.test(name)) continue;
    const rel = p.replaceAll("\\", "/");
    if (SKIP_FILES.has(rel)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      if (line.trim().startsWith("//") || line.trim().startsWith("*") || line.trim().startsWith("/*")) continue;
      if (SKIP_LINE_IF.some(({ file, test }) => file === rel && test(line))) continue;
      SITE.lastIndex = 0;
      if (SITE.test(line)) residue++;
      dangerVocab += (line.match(/(?:text|bg|border)-danger-\d{2,3}/g) || []).length;
    }
  }
};
walk2("src");
must(residue === 0, "C zero rose/red class residue outside exemptions", `${residue}`);
must(dangerVocab >= 180, "C semantic danger vocabulary alive at scale", `${dangerVocab} rung classes`);
const wf = readFileSync("src/lib/workflow.ts", "utf8");
const molstar = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
must(
  wf.includes("bg-rose-500") && wf.includes("text-rose-700 dark:text-rose-300"),
  "C identity exemption ALIVE: workflow.ts references2d rose palette member",
);
must(
  molstar.includes("bg-red-600/90"),
  "C identity exemption ALIVE: molstar turntable REC badge (recording red, not danger)",
);
must(
  readFileSync("src/components/workflow/header.tsx", "utf8").includes('"bg-rose-500"'),
  "C identity exemption ALIVE: header ternary category dots",
);

// D — living pixels
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(2_500);

// D1 — legislation fidelity: the renamed class resolves to the palette
// bytes we copied into the law (the t647 D2 mode — both sides normalized
// through canvas sRGB; the reference is the palette oklch verbatim).
const fidelity = await page.evaluate(() => {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;visibility:hidden;";
  el.innerHTML = [
    '<span id="t649-ink" class="text-danger-700">x</span>',
    '<span id="t649-ref" style="color:oklch(51.4% 0.222 16.935)">x</span>',
  ].join("");
  document.body.appendChild(el);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d");
  const bytes = (id, prop) => {
    const c = getComputedStyle(document.getElementById(id))[prop];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  };
  const out = { ink: bytes("t649-ink", "color"), ref: bytes("t649-ref", "color") };
  el.remove();
  return out;
});
const same = (a, z) => a.every((v, i) => Math.abs(v - z[i]) <= 1);
must(
  same(fidelity.ink, fidelity.ref),
  "D text-danger-700 ≡ palette rose-700 (legislation fidelity, zero-pixel rename certified)",
  fidelity.ink.join(","),
);

// D2 — the two-digit rung is REAL law: .text-danger-50 exists (the
// census rung-gap fix made 50/950 legal; the JIT emitted it from the
// field's usage).
const twoDigit = await page.evaluate(() => {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;visibility:hidden;";
  el.innerHTML = [
    '<span id="t649-50" class="text-danger-50">x</span>',
    '<span id="t649-50-ref" style="color:oklch(96.9% 0.015 12.422)">x</span>',
  ].join("");
  document.body.appendChild(el);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d");
  const bytes = (id) => {
    const c = getComputedStyle(document.getElementById(id)).color;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  };
  const out = { a: bytes("t649-50"), r: bytes("t649-50-ref") };
  el.remove();
  return out;
});
must(
  same(twoDigit.a, twoDigit.r),
  "D text-danger-50 ≡ palette rose-50 (two-digit rung is law, not a gap)",
  twoDigit.a.join(","),
);

// D3 — the stylesheet carries the renamed vocabulary at scale (rules the
// field actually uses: deep ink 700s, the codex SOLID 500s, prefixed
// variants from toast's destructive surface).
const rules = await page.evaluate(() => {
  const found = { ink: 0, solid: 0, prefixed: 0 };
  const scan = (sheet) => {
    let list;
    try { list = sheet.cssRules; } catch { return; }
    for (const r of list) {
      // CSSStyleRule.cssRules (nested-CSS list) is ALWAYS truthy, even
      // when empty — recursing on it skips every plain rule. Only
      // group rules (layer/media/supports — no selectorText) recurse.
      if (r.cssRules?.length > 0 && !r.selectorText) { scan(r); continue; }
      const sel = r.selectorText || "";
      if (/\.text-danger-\d{2,3}/.test(sel)) found.ink++;
      if (/\.bg-danger-500\\\//.test(sel)) found.solid++;
      if (/group-\[\.destructive\].*danger-\d|hover.*danger-\d|focus.*danger-\d/.test(sel)) found.prefixed++;
    }
  };
  for (const sheet of document.styleSheets) scan(sheet);
  return found;
});
must(
  rules.ink >= 5 && rules.solid >= 1,
  "D stylesheet carries the renamed vocabulary at scale",
  `ink ${rules.ink} / solid ${rules.solid} / prefixed ${rules.prefixed}`,
);

// E — console hygiene
must(consoleErrors.length === 0, "E zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t649-danger-vocab.png" });
console.log(`t649-probe: ${PASS} pass / ${FAIL} fail`);
try {
  mkdirSync("/tmp/cryoflow-qa", { recursive: true });
  writeFileSync(
    "/tmp/cryoflow-qa/t649-probe-verdict.json",
    JSON.stringify({ PASS, FAIL, fidelity, twoDigit, rules, residue, dangerVocab }, null, 2),
  );
} catch {}
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
