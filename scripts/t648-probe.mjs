// t648 — the deep-ink rung vocabulary probe.
//
// This window legislated the semantic RUNG tokens (--color-success-100..900
// &c in globals.css, 27 tokens) and renamed every text-prop hue token in
// the non-exempt field to the semantic vocabulary (456 tokens / 52 files —
// census → codemod → assert, the t647 quartet pattern). The pairs kept
// their dark: twins; the hue NAME retired. status-style.ts — the law
// itself — now wears the vocabulary.
//
// Verdicts:
//   A  legislation — the 27 rung tokens in globals.css, byte-faithful to
//      the palette (the t646 lesson: the palette's oklch is the law), the
//      before→after example preserved in the head note, theme-independent
//      (no :root/.dark flip — the dark: prefix owns the theme switch).
//   B  ecosystem — t648-assert exits 0, the t648 codemod is idempotent
//      (dry = 0), and the t647 assert STILL exits 0 (two generations of
//      assert coexist: rung-2/3 wash/solid law untouched by this rename).
//   C  vocabulary — zero text-prop hue residue in the non-exempt field
//      (counted in-process), 400+ semantic rung classes alive, the
//      identity exemptions untouched (class-gallery selection teal).
//   D  living pixels — the dark-side rule EXISTS (a .dark-scoped
//      dark:text-success-300 sandbox resolves to palette emerald-300 —
//      JIT emitted it from the law's own usage), the α variant rides the
//      token (text-warning-700/90 ≡ color-mix 90%), and a real canvas
//      badge wears the renamed composite (text-success-700).
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
const SEMANTIC = { success: "emerald", warning: "amber", running: "teal" };
const SHADES = [100, 200, 300, 400, 500, 600, 700, 800, 900];
let faithful = 0, missing = 0;
for (const [sem, hue] of Object.entries(SEMANTIC)) {
  for (const shade of SHADES) {
    const g = globals.match(new RegExp(`--color-${sem}-${shade}:\\s*([^;]+);`));
    const t = theme.match(new RegExp(`--color-${hue}-${shade}:\\s*([^;]+);`));
    if (!g || !t) { missing++; continue; }
    if (g[1].trim() === t[1].trim()) faithful++;
  }
}
must(
  faithful === 27 && missing === 0,
  "A all 27 rung tokens byte-faithful to the palette",
  `${faithful}/27 faithful, ${missing} missing`,
);
must(
  /DEEP INK rung vocabulary/.test(globals) && /THEME-INDEPENDENT constants/.test(globals),
  "A legislation block present (rung vocabulary + theme-independence verdicts)",
);
must(
  /text-emerald-700 dark:text-emerald-300 becomes\s*\n?\s*text-success-700/.test(globals),
  "A rename example preserved (before→after contrast intact)",
);
// theme-independence: the rung tokens live in @theme, NOT in :root/.dark
const rootBlock = globals.match(/:root\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
const darkBlock = globals.match(/\.dark\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
must(
  !/--color-success-700/.test(rootBlock) && !/--color-success-700/.test(darkBlock),
  "A rung tokens are theme-independent (absent from :root/.dark flip)",
);

// B — ecosystem
const assert = spawnSync("node", ["scripts/t648-assert.mjs"], { encoding: "utf8" });
must(
  assert.status === 0,
  "B t648-assert exits 0 (fidelity + residue + law)",
  (assert.stdout || assert.stderr || "").trim().split("\n")[0],
);
const dry = spawnSync("node", ["scripts/t648-deep-codemod.mjs", "--dry"], { encoding: "utf8" });
must(
  /RENAMED 0 text tokens in 0 files|nothing to do/.test(dry.stdout),
  "B t648 codemod idempotent (dry = 0)",
  (dry.stdout || "").trim().split("\n")[0],
);
const assert647 = spawnSync("node", ["scripts/t647-assert.mjs"], { encoding: "utf8" });
must(
  assert647.status === 0,
  "B t647-assert STILL exits 0 (wash/solid law untouched by the rename)",
);

// C — vocabulary
const EXEMPT = [
  "command-palette.tsx", "map-ortho-panel.tsx", "fsc-chart.tsx",
  "fsc-compare-dialog.tsx", "reference-map-card.tsx",
  "class-distribution-chart.tsx", "canvas-minimap.tsx", "status-style.ts",
  "class-gallery.tsx", "denoise-compare-gallery.tsx", "palette.tsx",
  "workflow.ts", "globals.css",
];
let residue = 0;
const walk2 = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk2(p); continue; }
    if (!/\.(tsx?|css)$/.test(name)) continue;
    if (EXEMPT.some((x) => p.endsWith(x))) continue;
    residue += (readFileSync(p, "utf8").match(/(?:[a-z-]+:)?text-(?:emerald|amber|teal)-\d{2,3}/g) || []).length;
  }
};
walk2("src");
must(residue === 0, "C zero text-prop hue residue outside exemption", `${residue}`);
const counter = (needle) => {
  let n = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(name)) {
        n += (readFileSync(p, "utf8").match(new RegExp(needle.replace(/\//g, "\\/"), "g")) || []).length;
      }
    }
  };
  walk("src");
  return n;
};
must(
  counter("text-success-") + counter("text-warning-") + counter("text-running-") >= 400,
  "C semantic rung vocabulary alive at scale",
  `${counter("text-success-") + counter("text-warning-") + counter("text-running-")}`,
);
must(
  counter("text-success-700") >= 20 && counter("text-warning-700") >= 20 && counter("text-running-700") >= 10,
  "C deep rungs are the dominant ink",
  `700s: ${counter("text-success-700")}/${counter("text-warning-700")}/${counter("text-running-700")}`,
);
const gallerySrc = readFileSync("src/components/workflow/class-gallery.tsx", "utf8");
must(
  gallerySrc.includes('"bg-teal-600 text-white"'),
  "C identity exemption ALIVE: class-gallery selection teal untouched",
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

// D1 — the dark-side rule EXISTS: JIT emitted .dark .dark\:text-success-300
// because the LAW uses it (STATUS_TEXT's dark twins). Sandbox a .dark
// scope and resolve the class to palette emerald-300 bytes.
const darkProbe = await page.evaluate(() => {
  const scope = document.createElement("div");
  scope.className = "dark";
  scope.style.cssText = "position:absolute;visibility:hidden;";
  scope.innerHTML = [
    '<span id="t648-dark-ink" class="dark:text-success-300">x</span>',
    '<span id="t648-dark-ref" style="color:oklch(84.5% 0.143 164.978)">x</span>',
  ].join("");
  document.body.appendChild(scope);
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
  const out = {
    ink: bytes("t648-dark-ink", "color"),
    ref: bytes("t648-dark-ref", "color"),
  };
  scope.remove();
  return out;
});
const same = (a, z) => a.every((v, i) => Math.abs(v - z[i]) <= 1);
must(
  same(darkProbe.ink, darkProbe.ref),
  "D dark:text-success-300 ≡ palette emerald-300 (dark-side rule emitted)",
  darkProbe.ink.join(","),
);

// D2 — the α variant rides the token: text-warning-700/90 resolves to
// color-mix(in oklab, amber-700 90%, transparent).
const alphaProbe = await page.evaluate(() => {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;visibility:hidden;";
  el.innerHTML = [
    '<span id="t648-alpha" class="text-warning-700/90">x</span>',
    '<span id="t648-alpha-ref" style="color:color-mix(in oklab, oklch(55.5% 0.163 48.998) 90%, transparent)">x</span>',
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
  const out = { a: bytes("t648-alpha"), r: bytes("t648-alpha-ref") };
  el.remove();
  return out;
});
must(
  same(alphaProbe.a, alphaProbe.r),
  "D text-warning-700/90 ≡ color-mix 90% (α rides the rung token)",
  alphaProbe.a.join(","),
);

// D3 — a real canvas badge wears the RENAMED composite (t523 law: poll,
// never blind-read — roster mounts after the view flips).
let badgeAlive = 0;
for (let i = 0; i < 12 && badgeAlive === 0; i++) {
  badgeAlive = await page.evaluate(() => {
    return [...document.querySelectorAll("*")].filter(
      (el) =>
        /text-success-700/.test(el.className || "") &&
        (el.textContent || "").trim().toLowerCase() === "completed",
    ).length;
  });
  if (badgeAlive === 0) await page.waitForTimeout(1_500);
}
must(badgeAlive > 0, "D a real badge wears the renamed ink (text-success-700)", `count=${badgeAlive}`);

// E — console hygiene
must(consoleErrors.length === 0, "E zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t648-rung-vocab.png" });
console.log(`t648-probe: ${PASS} pass / ${FAIL} fail`);
try {
  mkdirSync("/tmp/cryoflow-qa", { recursive: true });
  writeFileSync(
    "/tmp/cryoflow-qa/t648-probe-verdict.json",
    JSON.stringify({ PASS, FAIL, darkProbe, alphaProbe, badgeAlive, residue }, null, 2),
  );
} catch {}
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
