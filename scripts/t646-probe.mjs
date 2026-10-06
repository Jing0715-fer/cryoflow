// t646 — the danger-vocabulary unification probe.
//
// rose (401 sites) / red (54) / destructive spoke DANGER in three hues.
// This window legislated four status tokens (--danger/--success/
// --warning/--running, light 600s + dark 400s in globals.css), aliased
// the shadcn destructive surface onto the rose hue (Task 175's lightness
// verdict preserved), and swept 121 SAFE-bucket sites to the token
// vocabulary via the census-gated codemod.
//
// Verdicts:
//   A  legislation — the token layer exists (globals.css :root/.dark/
//      @theme inline), the class layer exists (lib/status-style.ts),
//      the minimap's hex twin moved into the lib (STATUS_FILL literal
//      extinct), isSlurmQueued relocated + re-exported (importers keep
//      their paths).
//   B  dialect extinction — the census --assert oracle: zero SAFE-bucket
//      sites remain in sweep scope; the head ink pair is gone from src.
//   C  CSS law living body — sandbox elements resolve the utilities in
//      the browser: text-danger = rose-600 in light, rose-400 in dark
//      (canvas-resolved sRGB bytes, not class strings); bg-danger/10
//      keeps its alpha law; bg-destructive = rose-600 in BOTH modes
//      (hue unified, Task 175 contrast verdict intact); the .text-danger
//      rule exists in document.styleSheets (the silent-generation
//      family's counter-oracle: the utility is COMPILED, not just typed).
//   D  console hygiene.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
const css = readFileSync("src/app/globals.css", "utf8");
must(
  css.includes("--danger: oklch(58.6% 0.253 17.585)") && css.includes("--danger: oklch(71.2% 0.194 13.428)"),
  "A --danger light(rose-600)/dark(rose-400) ink rungs",
);
must(
  ["--success: oklch(59.6% 0.145 163.225)", "--warning: oklch(66.6% 0.179 58.318)", "--running: oklch(60% 0.118 184.704)"].every((s) => css.includes(s)),
  "A success/warning/running light rungs (emerald/amber/teal 600)",
);
must(
  css.includes("--color-danger: var(--danger)") && css.includes("--color-running: var(--running)"),
  "A @theme inline maps the four status tokens",
);
must(
  css.split("--destructive: oklch(58.6% 0.253 17.585)").length === 3,
  "A destructive wears rose-600 in :root AND .dark (hue unified, lightness pinned)",
);
must(css.includes("--color-success: var(--success)"), "A success theme mapping present");

const styleSrc = readFileSync("src/lib/status-style.ts", "utf8");
// t647 recast — the maps obey the THREE-RUNG LAW now: ink speaks the deep
// 700/300 literals (the 600 token rungs miss 4.5:1 for amber/emerald/
// teal; rose-600 passes, so failed rides the token), solid dots keep their
// 500 rung, washes/borders carry the token α vocabulary. Same law, new
// spelling — the anchor follows the map; the token layer is untouched.
must(
  styleSrc.includes("failed: \"text-danger\"") &&
    styleSrc.includes("completed: \"text-emerald-700 dark:text-emerald-300\"") &&
    styleSrc.includes("pending: \"bg-amber-500\"") &&
    styleSrc.includes("running: \"bg-teal-500\"") &&
    styleSrc.includes("completed: \"bg-success/10\""),
  "A status-style.ts: the class layer speaks the status vocabulary (t647 rung recast)",
);
must(
  styleSrc.includes('failed: "#f43f5e"') && styleSrc.includes('completed: "#10b981"'),
  "A status-style.ts: the SVG hex twin (verbatim from the minimap era)",
);
const minimapSrc = readFileSync("src/components/workflow/canvas-minimap.tsx", "utf8");
must(
  minimapSrc.includes("STATUS_HEX, statusWord") && !minimapSrc.includes("STATUS_FILL"),
  "A minimap consumes the lib hex twin (STATUS_FILL literal extinct)",
);
const jobCardSrc = readFileSync("src/components/workflow/job-card.tsx", "utf8");
must(
  jobCardSrc.includes("isSlurmQueued") && jobCardSrc.includes("export { isSlurmQueued };"),
  "A job-card re-exports the relocated word law (importers keep paths)",
);

// B — dialect extinction (census oracle). The census knows the identity
// exemptions (workflow.ts category colors keep their verbatim pairs —
// references2d is rose by IDENTITY, not by danger), so it is the single
// source of "swept scope is clean"; a raw rg would false-positive on the
// exempt files.
const census = spawnSync("node", ["scripts/t646-danger-census.mjs", "--assert"], { encoding: "utf8" });
must(
  census.status === 0,
  "B census assert: all SAFE buckets swept to zero (exemptions respected)",
  census.stdout.split("\n").find((l) => l.includes("ASSERT"))?.trim(),
);

// C — CSS law living body
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
let view = null;
for (let i = 0; i < 10; i++) {
  view = await page.evaluate(() =>
    document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  if (view === "canvas") break;
  await page.waitForTimeout(1_500);
}
must(view === "canvas", "C canvas view reached", `${view}`);

// resolve a computed color to sRGB bytes via canvas (oklch-safe)
// t646 lesson — the first draft asserted v3-era hex bytes (#e11d48);
// Tailwind v4's palette lives in oklch and its true rendered sRGB is
// NOT the old hex (rose-600 renders ≈ 236,0,63). The honest oracle is
// EQUIVALENCE: the token's computed color string must equal an inline
// style carrying the exact palette oklch — no color-space guessing.
const probe = await page.evaluate(() => {
  const ROSE600 = "oklch(0.586 0.253 17.585)";
  const ROSE400 = "oklch(0.712 0.194 13.428)";
  const AMBER600 = "oklch(0.666 0.179 58.318)";
  const TEAL600 = "oklch(0.6 0.118 184.704)";
  const EMERALD600 = "oklch(0.596 0.145 163.225)";
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;visibility:hidden;";
  el.innerHTML = [
    '<span id="t646-ink" class="text-danger">x</span>',
    '<span id="t646-ink-warn" class="text-warning">x</span>',
    '<span id="t646-ink-run" class="text-running">x</span>',
    '<span id="t646-ink-ok" class="text-success">x</span>',
    '<span id="t646-wash" class="bg-danger/10">x</span>',
    '<span id="t646-dest" class="bg-destructive">x</span>',
    `<span id="t646-ref-600" style="color:${ROSE600}">x</span>`,
    `<span id="t646-ref-warn" style="color:${AMBER600}">x</span>`,
    `<span id="t646-ref-run" style="color:${TEAL600}">x</span>`,
    `<span id="t646-ref-ok" style="color:${EMERALD600}">x</span>`,
    `<span id="t646-ref-dest" style="background-color:${ROSE600}">x</span>`,
    `<span id="t646-ref-wash" style="background-color:color-mix(in oklab, ${ROSE600} 10%, transparent)">x</span>`,
  ].join("");
  document.body.appendChild(el);
  // t646 second lesson — computed STRINGS lie by serialization: a var()
  // indirected color serializes as lab(), an inline oklch stays oklch()
  // (same color, different spelling). Equality must be resolved through
  // a common space — canvas sRGB bytes on BOTH sides, reference = the
  // palette oklch itself, never a memorized hex.
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
    ink: bytes("t646-ink", "color"),
    ref600: bytes("t646-ref-600", "color"),
    warn: bytes("t646-ink-warn", "color"),
    refWarn: bytes("t646-ref-warn", "color"),
    run: bytes("t646-ink-run", "color"),
    refRun: bytes("t646-ref-run", "color"),
    ok: bytes("t646-ink-ok", "color"),
    refOk: bytes("t646-ref-ok", "color"),
    wash: bytes("t646-wash", "backgroundColor"),
    refWash: bytes("t646-ref-wash", "backgroundColor"),
    dest: bytes("t646-dest", "backgroundColor"),
    refDest: bytes("t646-ref-dest", "backgroundColor"),
  };
  el.remove();
  return out;
});

const same = (a, z) => a.every((v, i) => Math.abs(v - z[i]) <= 1);
must(same(probe.ink, probe.ref600), "C light text-danger ≡ rose-600 (canvas-resolved bytes)", probe.ink.join(","));
must(same(probe.warn, probe.refWarn), "C light text-warning ≡ amber-600", probe.warn.join(","));
must(same(probe.run, probe.refRun), "C light text-running ≡ teal-600", probe.run.join(","));
must(same(probe.ok, probe.refOk), "C light text-success ≡ emerald-600", probe.ok.join(","));
must(same(probe.wash, probe.refWash), "C bg-danger/10 ≡ color-mix 10% law", probe.wash.join(","));
must(same(probe.dest, probe.refDest), "C light bg-destructive ≡ rose-600", probe.dest.join(","));

// dark mode — flip the html class and re-resolve
await page.evaluate(() => document.documentElement.classList.add("dark"));
const dark = await page.evaluate(() => {
  const ROSE400 = "oklch(0.712 0.194 13.428)";
  const ROSE600 = "oklch(0.586 0.253 17.585)";
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;visibility:hidden;";
  el.innerHTML = [
    '<span id="t646-d-ink" class="text-danger">x</span>',
    '<span id="t646-d-dest" class="bg-destructive">x</span>',
    `<span id="t646-d-ref-400" style="color:${ROSE400}">x</span>`,
    `<span id="t646-d-ref-600" style="background-color:${ROSE600}">x</span>`,
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
  const out = {
    ink: bytes("t646-d-ink", "color"),
    ref400: bytes("t646-d-ref-400", "color"),
    dest: bytes("t646-d-dest", "backgroundColor"),
    ref600: bytes("t646-d-ref-600", "backgroundColor"),
  };
  el.remove();
  return out;
});
const sameD = (a, z) => a.every((v, i) => Math.abs(v - z[i]) <= 1);
must(sameD(dark.ink, dark.ref400), "C dark text-danger flips to rose-400 (token dark rung)", dark.ink.join(","));
must(sameD(dark.dest, dark.ref600), "C dark bg-destructive STAYS rose-600 (Task 175 lightness law)", dark.dest.join(","));
await page.evaluate(() => document.documentElement.classList.remove("dark"));

// the utility is COMPILED — a real stylesheet rule exists. Dev CSS nests
// inside @layer blocks, so the walk must recurse (top-level iteration
// only sees the layer wrapper — the first draft's false FAIL).
const ruleAlive = await page.evaluate(() => {
  const found = [];
  const walk = (rules) => {
    for (const r of rules) {
      if (r.selectorText?.includes(".text-danger")) found.push(r.selectorText);
      if (r.cssRules) walk(r.cssRules);
    }
  };
  for (const s of document.styleSheets) {
    try {
      walk(s.cssRules);
    } catch {}
  }
  return found.length > 0;
});
must(ruleAlive, "C .text-danger rule alive in document.styleSheets (recursive walk)");

// D — console hygiene
must(consoleErrors.length === 0, "D zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t646-danger-vocab.png" });
console.log(`t646-probe: ${PASS} pass / ${FAIL} fail`);
try {
  mkdirSync("/tmp/cryoflow-qa", { recursive: true });
  writeFileSync(
    "/tmp/cryoflow-qa/t646-probe-verdict.json",
    JSON.stringify({ PASS, FAIL, light: probe, dark }, null, 2),
  );
} catch {}
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
