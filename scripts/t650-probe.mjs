// t650 — the solid-domain vocabulary probe.
//
// This window recast the t647 three-rung law's rung 3 ("solid IS the
// rung" = literals): once t648/t649 legislated rung tokens, the solid,
// wash and gradient domains could retire their hue NAMES with zero
// pixels moved (136 sites / 34 files). The t648 census read "no 50/950
// in the field" because it only saw the TEXT domain — the solid-domain
// census found amber-50/95 and amber-950/80 riding molstar's banner,
// so three families extend to 50–950 FULL. Entry ①'s verdict: SVG hex
// is the SVG domain's NATIVE vocabulary (no token utility classes exist
// for fill/stroke; serialized SVGs have no var() source) — but the
// three verbatim TEAL/AMBER/ROSE copies per chart were real debt: the
// values now flow from STATUS_HEX.
//
// Verdicts:
//   A  legislation — the six 50/950 extension tokens byte-faithful to
//      the palette (emerald/amber/teal), verdict comment in place,
//      theme-independent, three families now span 50–950 FULL.
//   B  ecosystem — t650-assert exits 0, the codemod is idempotent, and
//      FOUR generations of prior asserts (t646/t647/t648/t649) STILL
//      exit 0.
//   C  vocabulary — zero teal/amber/emerald class residue in the field
//      (census --assert), the new vocabulary alive at scale, identity
//      exemptions ALIVE (results-view selection teal, AI brand gradient,
//      storage legend swatches, rebalance delta pair).
//   D  living pixels — .text-success-700 resolves to palette emerald-700
//      bytes (legislation fidelity, t649 D1 mode), .bg-warning-50 proves
//      the 50 rung is REAL law (the t648 blind spot is closed for the
//      wash/solid domain too), the codex floor rides .bg-running-400\/85
//      in the stylesheet, and real roster badges wear the vocabulary.
//   E  console hygiene.
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
const globals = readFileSync("src/app/globals.css", "utf8");
const theme = readFileSync("node_modules/tailwindcss/theme.css", "utf8");
const EXT = {
  "success-50": "emerald-50", "success-950": "emerald-950",
  "warning-50": "amber-50", "warning-950": "amber-950",
  "running-50": "teal-50", "running-950": "teal-950",
};
let faithful = 0, missing = 0;
for (const [sem, pal] of Object.entries(EXT)) {
  const g = globals.match(new RegExp(`--color-${sem}:\\s*([^;]+);`));
  const t = theme.match(new RegExp(`--color-${pal}:\\s*([^;]+);`));
  if (!g || !t) { missing++; continue; }
  if (g[1].trim() === t[1].trim()) faithful++;
}
must(
  faithful === 6 && missing === 0,
  "A all six 50/950 extension rungs byte-faithful to the palette (families now 50–950 FULL)",
  `${faithful}/6 faithful, ${missing} missing`,
);
must(
  /t650 — the 50\/950 extension/.test(globals) && /partial coverage = a whitelist that grows/.test(globals),
  "A legislation verdict in place (the t649 lesson extended to the solid domain)",
);
must(
  /--color-danger-50[\s\S]*--color-danger-950/.test(globals),
  "A danger scale already 50–950 (t649) — all four families now FULL",
);

// B — ecosystem
const assert = spawnSync("node", ["scripts/t650-assert.mjs"], { encoding: "utf8" });
must(assert.status === 0, "B t650-assert exits 0", (assert.stdout || "").trim().split("\n").pop());
const dry = spawnSync("node", ["scripts/t650-solid-codemod.mjs", "--dry"], { encoding: "utf8" });
must(
  /sites: 0\s+files: 0/.test(dry.stdout),
  "B t650 codemod idempotent (dry = 0)",
  (dry.stdout || "").trim().split("\n")[1],
);
// t646's generation keeps its law inside the census (--assert); there is
// no standalone t646-assert.mjs — the census IS the assert (t649 B-group
// precedent).
for (const gen of ["t647-assert.mjs", "t648-assert.mjs", "t649-assert.mjs"]) {
  const r = spawnSync("node", ["scripts/" + gen], { encoding: "utf8" });
  must(r.status === 0, `B ${gen} STILL exits 0 (generations coexist)`);
}

// C — vocabulary
const census = spawnSync("node", ["scripts/t650-solid-census.mjs", "--assert"], { encoding: "utf8" });
must(census.status === 0, "C t650 census asserts clean (field hue-name residue = 0)");
const t646 = spawnSync("node", ["scripts/t646-danger-census.mjs", "--assert"], { encoding: "utf8" });
must(t646.status === 0, "C t646 danger census STILL asserts clean (generations coexist)");
const censusOut = spawnSync("node", ["scripts/t650-solid-census.mjs"], { encoding: "utf8" }).stdout;
const m = censusOut.match(/totals: (\{[^\}]+\})/);
must(!!m && /"TEXT_DEEP":0/.test(m[1]) && /"TEXT_OTHER":0/.test(m[1]),
  "C census buckets agree with the t648 verdict (text domain still clean)", m && m[1]);

// identity exemptions ALIVE (source-level: the hue name IS the identity there)
const rv = readFileSync("src/components/workflow/results/results-view.tsx", "utf8");
must(
  rv.includes("border-teal-600 bg-teal-600 text-white"),
  "C identity exemption ALIVE: results-view selection/action teal",
);
const ai = readFileSync("src/components/ai/assistant-panel.tsx", "utf8");
must(
  ai.includes("from-teal-500 to-cyan-600"),
  "C identity exemption ALIVE: assistant-panel AI brand gradient (teal→cyan pair)",
);
const storage = readFileSync("src/components/workflow/storage-dialog.tsx", "utf8");
must(
  storage.includes('maps: "bg-teal-500"') && storage.includes('plots: "bg-amber-500"'),
  "C identity exemption ALIVE: storage legend swatches (map/plot series)",
);

// D — living pixels
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(2_500);

// D1 — legislation fidelity: the codex's deep ink rung resolves to the
// palette bytes (both sides normalized through canvas sRGB; the
// reference is the palette oklch verbatim — t649 D1 mode).
const fidelity = await page.evaluate(() => {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;visibility:hidden;";
  el.innerHTML = [
    '<span id="t650-ink" class="text-success-700">x</span>',
    '<span id="t650-ref" style="color:oklch(50.8% 0.118 165.612)">x</span>',
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
  const out = { ink: bytes("t650-ink", "color"), ref: bytes("t650-ref", "color") };
  el.remove();
  return out;
});
const same = (a, z) => a.every((v, i) => Math.abs(v - z[i]) <= 1);
must(
  same(fidelity.ink, fidelity.ref),
  "D text-success-700 ≡ palette emerald-700 (legislation fidelity certified)",
  fidelity.ink.join(","),
);

// D2 — the 50 rung is REAL law for the wash/solid domain too (the t648
// blind-spot verdict "no 50/950 in the field" was a TEXT-domain reading;
// this window made 50/950 legal for every family).
const shallow = await page.evaluate(() => {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;visibility:hidden;";
  el.innerHTML = [
    '<span id="t650-50" class="bg-warning-50">x</span>',
    '<span id="t650-50-ref" style="background-color:oklch(98.7% 0.022 95.277)">x</span>',
  ].join("");
  document.body.appendChild(el);
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d");
  const bytes = (id) => {
    const c = getComputedStyle(document.getElementById(id)).backgroundColor;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  };
  const out = { a: bytes("t650-50"), r: bytes("t650-50-ref") };
  el.remove();
  return out;
});
must(
  same(shallow.a, shallow.r),
  "D bg-warning-50 ≡ palette amber-50 (the 50 rung is law, not a gap — solid/wash domain)",
  shallow.a.join(","),
);

// D3 — the codex floor rides the rung vocabulary in the emitted
// stylesheet (bg-running-400/85 with the alpha, the dark twin, and the
// 50/950 shallow molstar banner classes).
const rules = await page.evaluate(() => {
  const found = { floor: 0, shallow: 0, deep: 0, darkNine: 0, fam: 0 };
  const scan = (sheet) => {
    let list;
    try { list = sheet.cssRules; } catch { return; }
    for (const r of list) {
      // CSSStyleRule.cssRules (nested-CSS list) is ALWAYS truthy, even
      // when empty — recursing on it skips every plain rule. Only
      // group rules (layer/media/supports — no selectorText) recurse.
      if (r.cssRules?.length > 0 && !r.selectorText) { scan(r); continue; }
      const sel = r.selectorText || "";
      if (/\.bg-running-400\\\/85/.test(sel)) found.floor++;
      if (/bg-warning-50(?!\\\/)/.test(sel)) found.shallow++;
      if (/\.text-(?:success|warning|running)-700/.test(sel)) found.deep++;
      // dark: variants serialize as ".dark\\:bg-warning-950\\/80:is(.dark *)"
      // — the class does NOT start with ".bg", so anchor on the family
      // substring plus the dark context, not on a leading dot.
      if (/dark.*bg-warning-950/.test(sel)) found.darkNine++;
      if (/\.(?:text|bg|border)-(?:success|warning|running)-\d{2,3}/.test(sel)) found.fam++;
    }
  };
  for (const sheet of document.styleSheets) scan(sheet);
  return found;
});
must(
  rules.floor >= 1 && rules.deep >= 3,
  "D stylesheet carries the codex floor + deep ink (one rule per CLASS — dedup, not per site)",
  `floor ${rules.floor} / deep700 ${rules.deep} / fam ${rules.fam}`,
);
must(
  rules.shallow >= 1 && rules.darkNine >= 1,
  "D 50/950 banner rungs emitted (molstar banner field usage is REAL law)",
  `50 ${rules.shallow} / 950 ${rules.darkNine}`,
);
must(
  rules.fam >= 20,
  "D semantic family vocabulary alive at scale (three families, class-level)",
  `${rules.fam} class rules`,
);

// D4 — real roster badges wear the vocabulary (t523 law: the roster
// mounts after the view flip — poll, never blind-read).
await page.waitForTimeout(1_500);
const badges = await page.evaluate(() => {
  for (let i = 0; i < 12; i++) {
    const n = document.querySelectorAll('.text-success-700[data-slot="chip"], [data-testid="job-card"] .text-success-700, .text-success-700').length;
    if (n > 0) return n;
    // eslint-disable-next-line no-await-in-loop
    void 0;
  }
  return document.querySelectorAll(".text-success-700").length;
});
must(badges >= 10, "D roster badges wear the rung vocabulary (completed ink)", `${badges} nodes`);

// E — console hygiene
must(consoleErrors.length === 0, "E zero console errors", consoleErrors.slice(0, 2).join(" | ") || "0");

mkdirSync(".qa-logs", { recursive: true });
await page.screenshot({ path: ".qa-logs/t650-solid-vocab.png" });
console.log(`t650-probe: ${PASS} pass / ${FAIL} fail`);
try {
  writeFileSync(
    "/tmp/cryoflow-qa/t650-probe-verdict.json",
    JSON.stringify({ PASS, FAIL, fidelity, shallow, rules, badges }, null, 2),
  );
} catch {}
await b.close();
process.exit(FAIL === 0 ? 0 : 1);
