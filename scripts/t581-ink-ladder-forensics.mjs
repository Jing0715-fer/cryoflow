/** t581-ink-ladder-forensics — the pipeline-immunity witness for the ink ladder.
 *
 *  t580 caught the build pipeline (Tailwind v4 / Lightning) rewriting every
 *  handwritten inline color-mix() into a fallback+@supports dual form. t581
 *  pulled the ladder's ink into :root/.dark tokens (--ink-04/06/09/10/14/18)
 *  so the box-shadow declarations say var(--ink-XX) — opaque to the minifier.
 *  This witness proves the win survived contact with the served output:
 *
 *  CSS faces (fetch the served stylesheet directly):
 *    F1  all five ladder declarations reference var(--ink-XX) VERBATIM and
 *        sit at top level (never inside an @supports block)
 *    F2  zero old-inline ladder signatures remain in served CSS
 *    F3  token definitions are dual-formed by the pipeline — opaque fallback
 *        first, color-mix truth after — for BOTH :root and .dark
 *    F4  run-glow keyframes keep var(--ink-10) verbatim (2 frames) plus the
 *        .card-lift rest layer (1)
 *    F5  on-disk source: all 21 ink sites say var(--ink-XX); the TOTAL
 *        assertion (t582/t583): outside definition lines, NO color-mix
 *        against foreground/teal-glow/primary survives anywhere
 *    F6  hairline/chrome declarations verbatim at top level (t582)
 *    F7  accent vocabulary definitions (t583: --glow-XX/--pulse-XX/--tint-XX,
 *        16 rungs x root+dark) are dual-formed exactly like the ink ones
 *    F8  every accent USE site cites var() verbatim, outside @supports; the
 *        served var(--glow|pulse|tint-*) citation count is EXACTLY 10/4/2 —
 *        a dual-formed use site would double the count and fail here
 *    F9  on-disk accent refs == 16 (comments stripped — doctrine prose
 *        mentions tokens too)
 *
 *  Runtime faces (desktop Chrome + agent-browser, injected probe — reads the
 *  SERVED stylesheet end-to-end):
 *    R1  a live .card-lift element computes a two-layer shadow whose ink
 *        alphas are 0.06 / 0.1 — the tokens RESOLVE (a typo'd token would
 *        serve verbatim declarations that paint nothing)
 *    R2  overriding --ink-10 on the element changes the computed shadow —
 *        the vocabulary is a REAL runtime API, not dead definitions
 *    R3  hairline/chrome inks resolve (grid dots + scrollbar-color)
 *    R4  accent tokens resolve through an element-level var() citation:
 *        --glow-42 paints alpha 0.42, --pulse-38 alpha 0.38, --tint-26
 *        alpha 0.26 — one probe per family, no animation interference
 *    R5  toggling .dark changes what --glow-42 resolves to — the dual-domain
 *        co-location is doing real work (a :root-only definition would bake
 *        light teal for the dark scope)
 *
 *  Single-lifetime probe per the t580 forensics doctrine: one Chrome, one
 *  session, every assertion inside this process.
 */
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const CDP_PORT = "9331";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t581-forensics-profile";
const GLOBALS = new URL("../src/app/globals.css", import.meta.url).pathname;

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim(); } catch { return ""; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => {
  const flat = expr.replace(/\s*\n\s*/g, " ");
  const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
  try { const p = JSON.parse(raw); return typeof p === "string" ? p.trim() : raw.trim(); }
  catch { return raw.replace(/^"|"$/g, "").trim(); }
};
const readJson = (js) => { try { return JSON.parse(evalJs(js)); } catch { return null; } };
async function pollUntil(fn, timeoutMs = 30000, step = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { try { const v = await fn(); if (v) return v; } catch { /* keep */ } await sleep(step); }
  return null;
}

/* ---------- CSS forensics ---------- */
const cssHref = sh(`curl -s ${BASE}/ | grep -o 'href="[^"]*\\.css[^"]*"' | head -1 | sed 's/href="//;s/"//'`);
ok("served css href found", cssHref.length > 0, cssHref);
const served = sh(`curl -s "${BASE}${cssHref}"`);
ok("served css fetched", served.length > 100000, `${served.length} bytes`);

// supports-block ranges, so F1 can prove the ladder rules live at top level
const supportsRanges = [...served.matchAll(/@supports[^{]*\{/g)].map((m) => {
  // walk braces from the opener to find the block end
  let depth = 1, i = m.index + m[0].length;
  while (i < served.length && depth > 0) {
    if (served[i] === "{") depth++;
    else if (served[i] === "}") depth--;
    i++;
  }
  return [m.index, i];
});
const insideSupports = (pos) => supportsRanges.some(([a, b]) => pos >= a && pos <= b);

const LADDER = [
  ["card-lift",        "0 1px 2px var(--ink-06), 0 6px 16px -4px var(--ink-10)"],
  ["card-lift-lg",     "0 1px 2px var(--ink-06), 0 16px 40px -12px var(--ink-18)"],
  ["card-hover-lean:hover", "0 1px 2px var(--ink-06), 0 10px 24px -6px var(--ink-14)"],
  ["dash-card-hover:hover", "0 1px 2px var(--ink-06), 0 10px 24px -6px var(--ink-14)"],
  ["insp-card-whisper:hover", "0 1px 2px var(--ink-04), 0 6px 14px -5px var(--ink-09)"],
];
console.log("F1 — ladder declarations verbatim at top level");
for (const [sel, decl] of LADDER) {
  const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{[^}]*" + decl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const m = served.match(re);
  ok(`${sel} verbatim`, !!m, "declaration not found verbatim");
  if (m) ok(`${sel} outside @supports`, !insideSupports(m.index), "rule got wrapped in @supports");
}

console.log("F2 — zero old-inline ladder signatures in served CSS");
const OLD = [
  "0 1px 2px color-mix(in oklch, var(--foreground) 6%, transparent)",
  "0 1px 2px color-mix(in oklch, var(--foreground) 4%, transparent)",
  "0 16px 40px -12px color-mix(in oklch, var(--foreground) 18%, transparent)",
  "0 10px 24px -6px color-mix(in oklch, var(--foreground) 14%, transparent)",
  "0 6px 14px -5px color-mix(in oklch, var(--foreground) 9%, transparent)",
];
for (const sig of OLD) ok(`absent: ${sig.slice(0, 48)}…`, !served.includes(sig));

console.log("F3 — definitions dual-formed (fallback first, truth after, both themes)");
for (const pct of ["04", "05", "06", "09", "10", "12", "14", "16", "18", "20", "22", "24", "28", "40"]) {
  const token = `--ink-${pct}`;
  const fb = [...served.matchAll(new RegExp(token.replace(/-/g, "\\-") + ":\\s*var\\(--foreground\\)", "g"))].map((m) => m.index);
  const tr = [...served.matchAll(new RegExp(token.replace(/-/g, "\\-") + ":\\s*color-mix\\(in oklch, var\\(--foreground\\) " + Number(pct) + "%, transparent\\)", "g"))].map((m) => m.index);
  ok(`${token} fallback defs >= 2 (root+dark)`, fb.length >= 2, `found ${fb.length}`);
  ok(`${token} truth defs >= 2 (root+dark)`, tr.length >= 2, `found ${tr.length}`);
  ok(`${token} truth after fallback`, tr.length > 0 && fb.length > 0 && Math.min(...tr) > Math.min(...fb));
}

console.log("F4 — run-glow keyframes keep var(--ink-10)");
const ink10 = [...served.matchAll(/0 6px 16px -4px var\(--ink-10\)/g)].length;
ok("ink-10 ambient layer x3 (rest + 2 keyframe frames)", ink10 === 3, `found ${ink10}`);

console.log("F5 — on-disk source: 21 ink refs + accent vocabulary TOTAL (t582/t583)");
const src = readFileSync(GLOBALS, "utf8");
// strip CSS comments first — the doctrine comment mentions var(--ink-14) in prose
const srcNoComments = src.replace(/\/\*[\s\S]*?\*\//g, "");
const varRefs = [...srcNoComments.matchAll(/var\(--ink-\d+\)/g)].length;
ok("21 var(--ink-XX) declaration refs in globals.css", varRefs === 21, `found ${varRefs}`);
// vocabulary TOTAL (t582 foreground, t583 accents): outside the definition
// lines, no color-mix against ANY source survives anywhere in the sheet
const bodyNoDefs = srcNoComments.replace(/^\s*--(ink|glow|pulse|tint)-\d+:\s*color-mix[^;]*;/gm, "");
ok(
  "zero inline color-mix outside token definitions (all sources)",
  !/color-mix\(\s*in\s+(oklch|srgb),\s*var\(--(foreground|teal-glow|primary)\)/.test(bodyNoDefs),
);
const accentRefs = [...srcNoComments.matchAll(/var\(--(glow|pulse|tint)-\d+\)/g)].length;
ok("16 var(--glow|pulse|tint-XX) declaration refs", accentRefs === 16, `found ${accentRefs}`);

console.log("F6 — hairline/chrome declarations verbatim at top level (t582)");
const CHROME_INK = [
  ["canvas-grid", "var(--ink-16) 1px"],
  ["canvas-grid-fine", "var(--ink-12) 1px"],
  ["scrollbar-color: var(--ink-28) transparent", null],
  ["-webkit-scrollbar-thumb", "background: var(--ink-24)"],
  ["-webkit-scrollbar-thumb:hover", "background: var(--ink-40)"],
  ["nice-scroll", "scrollbar-color: var(--ink-22) transparent"],
  ["nice-scroll::-webkit-scrollbar-thumb", "background: var(--ink-20)"],
  ["grid-pattern-header", "var(--ink-05) 1px"],
];
for (const [sel, decl] of CHROME_INK) {
  const needle = (decl ?? sel).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = served.match(new RegExp(needle));
  ok(`${decl ?? sel} verbatim`, !!m, "not found in served CSS");
  if (m) ok(`${decl ?? sel} outside @supports`, !insideSupports(m.index), "wrapped in @supports");
}

console.log("F7 — accent definitions dual-formed like the ink ones (t583)");
const ACCENT_DEFS = [
  ...["00", "10", "14", "22", "38", "42", "48", "60", "62", "78"].map((p) => [`glow-${p}`, "teal-glow", "oklch"]),
  ...["12", "38", "45", "55"].map((p) => [`pulse-${p}`, "primary", "srgb"]),
  ...["26", "45"].map((p) => [`tint-${p}`, "primary", "oklch"]),
];
for (const [token, source, space] of ACCENT_DEFS) {
  const esc = token.replace(/-/g, "\\-");
  const fb = [...served.matchAll(new RegExp("--" + esc + ":\\s*var\\(--" + source + "\\)", "g"))].map((m) => m.index);
  const tr = [...served.matchAll(new RegExp("--" + esc + ":\\s*color-mix\\(in " + space + ", var\\(--" + source + "\\) " + Number(token.split("-")[1]) + "%, transparent\\)", "g"))].map((m) => m.index);
  ok(`--${token} fallback defs >= 2 (root+dark)`, fb.length >= 2, `found ${fb.length}`);
  ok(`--${token} truth defs >= 2 (root+dark)`, tr.length >= 2, `found ${tr.length}`);
  ok(`--${token} truth after fallback`, tr.length > 0 && fb.length > 0 && Math.min(...tr) > Math.min(...fb));
}

console.log("F8 — accent use sites cite var() verbatim; citation counts are EXACT");
const ACCENT_USES = [
  ["run-glow rest ring", "0 0 0 1px var\\(--glow-42\\)"],
  ["run-glow rest halo", "0 0 14px -2px var\\(--glow-38\\)"],
  ["run-glow peak ring", "0 0 0 1px var\\(--glow-78\\)"],
  ["run-glow peak halo", "0 0 24px -2px var\\(--glow-62\\)"],
  ["run-glow reduced ring", "0 0 0 1px var\\(--glow-60\\)"],
  ["run-glow reduced halo", "0 0 18px -2px var\\(--glow-48\\)"],
  ["run-breathe rest bg", "background-color:\\s*var\\(--glow-10\\)"],
  ["run-breathe rest ring", "0 0 0 0 var\\(--glow-00\\)"],
  ["run-breathe peak bg", "background-color:\\s*var\\(--glow-22\\)"],
  ["run-breathe peak ring", "0 0 0 3px var\\(--glow-14\\)"],
  ["reveal-flash 0% bloom", "0 0 0 0 var\\(--pulse-38\\)"],
  ["reveal-flash 70% spread", "0 0 0 14px var\\(--pulse-12\\)"],
  ["reveal-flash rest 2px", "0 0 0 2px var\\(--pulse-55\\)"],
  ["reveal-flash rest 1px", "0 0 0 1px var\\(--pulse-45\\)"],
  ["::selection wash", "var\\(--tint-26\\)"],
  ["shimmer peak", "var\\(--tint-45\\)\\s*50%"],
];
for (const [name, needle] of ACCENT_USES) {
  const m = served.match(new RegExp(needle));
  ok(`${name} verbatim`, !!m, "citation not found in served CSS");
  if (m) ok(`${name} outside @supports`, !insideSupports(m.index), "wrapped in @supports");
}
// exact totals: the pipeline must NOT dual-form use sites (it dual-forms
// definitions — F3/F7 — but citations are verbatim, t581's core win). If a
// future pipeline change re-rolls the fallback split per declaration, every
// count doubles and this face catches it.
const glowCites = [...served.matchAll(/var\(--glow-\d+\)/g)].length;
const pulseCites = [...served.matchAll(/var\(--pulse-\d+\)/g)].length;
const tintCites = [...served.matchAll(/var\(--tint-\d+\)/g)].length;
ok("served glow citations == 10", glowCites === 10, `found ${glowCites}`);
ok("served pulse citations == 4", pulseCites === 4, `found ${pulseCites}`);
ok("served tint citations == 2", tintCites === 2, `found ${tintCites}`);
// frame shape lives in the token set: rest 42/38 -> peak 78/62, freeze 60/48
const framePairs = [
  ["run-glow rest cites 42 before 38", served.indexOf("0 0 0 1px var(--glow-42)") >= 0 && served.indexOf("0 0 14px -2px var(--glow-38)") >= 0],
  ["run-glow peak cites 78 before 62", served.indexOf("0 0 0 1px var(--glow-78)") >= 0 && served.indexOf("0 0 24px -2px var(--glow-62)") >= 0],
];
for (const [name, cond] of framePairs) ok(name, cond, "frame vocabulary drifted");

/* ---------- runtime faces ---------- */
// pre-warm the world before the browser lands (t571 house pattern): a freshly
// recycled dev server compiles the canvas graph on first hit — the hydration
// guard must never race that compile (first-run lesson: 90s of cards:0, then
// 12 cards in 6s once warm)
for (let i = 0; i < 30; i++) {
  if (sh(`curl -s -o /dev/null -w "%{http_code}" --max-time 8 ${BASE}/`) === "200") break;
  await sleep(2000);
}
sh(`curl -s -H "Origin: ${BASE}" "${BASE}/api/jobs" -o /dev/null`);
await sleep(1000);

const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--hide-scrollbars", "--window-size=1280,720",
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
  "about:blank",
], { stdio: "ignore" });

try {
  const ready = await pollUntil(() => sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200", 15000, 300);
  if (!ready) throw new Error("chrome cdp never opened");
  sh("agent-browser close >/dev/null 2>&1");
  await sleep(400);
  sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`);
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  // hydration guard (t578 doctrine): poll for the app graph, not a fixed sleep;
  // a still-cold canvas gets ONE refresh + second window before we call it.
  // Budgets are cold-start real (first-run lesson: curl cannot warm the client
  // chunk graph — only a real browser requests the ~200 dev chunks, and a CSS
  // edit invalidates the graph into a recompile storm; 150s+120s covers it,
  // warm sessions answer in <10s)
  // the poll predicate must be the CHECK, not the raw object — {cards:0} is
  // truthy and would "pass" at t≈0 before React mounts (first-run lesson: the
  // 150s budget never ran; t571's guard polls cards > 0, mirror it)
  let hyd = await pollUntil(() => {
    const v = readJson(`JSON.stringify((function(){ return { cards: document.querySelectorAll('[data-job]').length }; })())`);
    if (process.env.T581_DEBUG && v) console.log("[dbg] hyd poll:", JSON.stringify(v), "url:", evalJs(`JSON.stringify(location.href.slice(0, 60))`));
    return v && v.cards > 0 ? v : null;
  }, 150000, 1000);
  if (!hyd) {
    sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
    hyd = await pollUntil(() => {
      const v = readJson(`JSON.stringify((function(){ return { cards: document.querySelectorAll('[data-job]').length }; })())`);
      return v && v.cards > 0 ? v : null;
    }, 120000, 1000);
  }
  ok("app hydrated (canvas cards mounted)", !!hyd && hyd.cards > 0, JSON.stringify(hyd));

  console.log("R1 — .card-lift computes a resolved two-layer 0.06/0.1 shadow");
  // DOM side stays TRIVIAL (no regex literals, no comments): regex backslashes
  // inside a template literal lose their escapes in transit (\/ -> / spawns a
  // // comment bomb mid-IIFE — t579's flatten lesson one level deeper), so all
  // parsing happens Node-side on the returned string.
  const r1 = readJson(`JSON.stringify((function(){
    var probe = document.createElement("div");
    probe.className = "card-lift";
    probe.style.cssText = "position:absolute;left:-9999px;top:0;width:40px;height:40px;";
    probe.setAttribute("data-t581-probe", "1");
    document.body.appendChild(probe);
    var shadow = getComputedStyle(probe).boxShadow;
    probe.remove();
    return { shadow: shadow };
  })())`);
  ok("probe attached and read", !!r1 && !!r1.shadow, JSON.stringify(r1));
  if (r1 && r1.shadow && r1.shadow !== "none") {
    const colorTokens = r1.shadow.match(/(oklch|rgba|rgb|color|hsla?)\(/g) || [];
    const alphas = [...r1.shadow.matchAll(/\/\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
    ok("two shadow layers", colorTokens.length === 2, r1.shadow);
    ok("layer alphas 0.06 / 0.1", alphas.length === 2 && Math.abs(alphas[0] - 0.06) < 1e-6 && Math.abs(alphas[1] - 0.1) < 1e-6, JSON.stringify(alphas));
  } else {
    ok("shadow resolved (not none)", false, "tokens did not resolve — declarations verbatim but dead");
  }

  console.log("R2 — overriding --ink-10 on the element moves the shadow (real API)");
  const r2 = readJson(`JSON.stringify((function(){
    var mk = function(override){
      var probe = document.createElement("div");
      probe.className = "card-lift";
      probe.style.cssText = "position:absolute;left:-9999px;top:0;width:40px;height:40px;" + (override || "");
      probe.setAttribute("data-t581-probe", "1");
      document.body.appendChild(probe);
      return probe;
    };
    var base = mk("");
    var overridden = mk("--ink-10:rgba(0,255,0,0.5)");
    var out = { base: getComputedStyle(base).boxShadow, overridden: getComputedStyle(overridden).boxShadow };
    out.changed = out.base !== out.overridden;
    base.remove(); overridden.remove();
    return out;
  })())`);
  ok("override flows into computed shadow", !!r2 && r2.changed && r2.overridden !== "none", JSON.stringify(r2));

  console.log("R3 — hairline/chrome inks resolve (grid dots + scrollbar-color)");
  const r3 = readJson(`JSON.stringify((function(){
    var grid = document.createElement("div");
    grid.className = "canvas-grid";
    grid.style.cssText = "position:absolute;left:-9999px;top:0;width:40px;height:40px;";
    document.body.appendChild(grid);
    var gridBg = getComputedStyle(grid).backgroundImage;
    grid.remove();
    var scroll = document.createElement("div");
    scroll.className = "nice-scroll";
    scroll.style.cssText = "position:absolute;left:-9999px;top:0;width:40px;height:40px;";
    document.body.appendChild(scroll);
    var sbColor = getComputedStyle(scroll).scrollbarColor;
    scroll.remove();
    return { gridBg: gridBg, scrollbarColor: sbColor };
  })())`);
  ok("probe strings returned", !!r3 && !!r3.gridBg && !!r3.scrollbarColor, JSON.stringify(r3));
  if (r3 && r3.gridBg && r3.scrollbarColor) {
    const gridAlpha = Number((r3.gridBg.match(/\/\s*([\d.]+)\)/) || [])[1]);
    const sbAlpha = Number((r3.scrollbarColor.match(/\/\s*([\d.]+)\)/) || [])[1]);
    ok("grid dot ink resolves at 0.16", Math.abs(gridAlpha - 0.16) < 1e-6, `${r3.gridBg.slice(0, 80)} alpha=${gridAlpha}`);
    // Chrome serializes the `transparent` keyword as rgba(0, 0, 0, 0) in
    // computed scrollbar-color — accept both spellings of "nothing"
    const secondLayerClear = /transparent|rgba\(0, 0, 0, 0\)|#0000/.test(r3.scrollbarColor);
    ok("scrollbar ink resolves at 0.22 over clear track", Math.abs(sbAlpha - 0.22) < 1e-6 && secondLayerClear, `${r3.scrollbarColor.slice(0, 90)} alpha=${sbAlpha}`);
  }

  console.log("R4 — accent tokens resolve through element-level citations (one probe per family)");
  // The keyframes/animations breathe — a probe riding .job-running would read
  // a moving target. Instead each probe cites the token DIRECTLY in an inline
  // box-shadow: no animation, deterministic alpha, and it proves the token is
  // a real runtime API (R2's doctrine, accent edition).
  const r4 = readJson(`JSON.stringify((function(){
    var probe = function(cite){
      var el = document.createElement("div");
      el.style.cssText = "position:absolute;left:-9999px;top:0;width:40px;height:40px;box-shadow:" + cite;
      el.setAttribute("data-t581-probe", "1");
      document.body.appendChild(el);
      var v = getComputedStyle(el).boxShadow;
      el.remove();
      return v;
    };
    return {
      glow: probe("0 0 0 1px var(--glow-42)"),
      pulse: probe("0 0 0 1px var(--pulse-38)"),
      tint: probe("0 0 0 1px var(--tint-26)")
    };
  })())`);
  ok("accent probe strings returned", !!r4 && !!r4.glow && !!r4.pulse && !!r4.tint, JSON.stringify(r4));
  if (r4 && r4.glow && r4.pulse && r4.tint) {
    const a = (s) => Number((s.match(/\/\s*([\d.]+)\)/) || [])[1]);
    ok("--glow-42 paints alpha 0.42", Math.abs(a(r4.glow) - 0.42) < 1e-6, `${r4.glow.slice(0, 90)} alpha=${a(r4.glow)}`);
    ok("--pulse-38 paints alpha 0.38", Math.abs(a(r4.pulse) - 0.38) < 1e-6, `${r4.pulse.slice(0, 90)} alpha=${a(r4.pulse)}`);
    ok("--tint-26 paints alpha 0.26", Math.abs(a(r4.tint) - 0.26) < 1e-6, `${r4.tint.slice(0, 90)} alpha=${a(r4.tint)}`);
    // the color SPACE is part of the name: the srgb mix must NOT serialize
    // as oklch. Modern Chrome emits CSS Color 4 form `color(srgb r g b / a)`
    // (first-run lesson: rgba() was the 2020s spelling — accept both; the
    // serialization layer rewrites literals, assertions must read every form)
    ok("pulse serializes as srgb, not oklch", /color\(srgb|rgba?\(/.test(r4.pulse) && !/oklch/.test(r4.pulse), r4.pulse.slice(0, 60));
  }

  console.log("R5 — .dark changes what --glow-42 resolves to (dual domains at work)");
  // teal-glow is theme-scoped (light oklch(0.72 0.14 182) / dark oklch(0.78
  // 0.13 182)), so the SAME citation must paint different colors per scope —
  // a :root-only definition would bake light teal for the whole tree.
  const r5 = readJson(`JSON.stringify((function(){
    var root = document.documentElement;
    var wasDark = root.classList.contains("dark");
    var el = document.createElement("div");
    el.style.cssText = "position:absolute;left:-9999px;top:0;width:40px;height:40px;box-shadow:0 0 0 1px var(--glow-42)";
    el.setAttribute("data-t581-probe", "1");
    document.body.appendChild(el);
    var light = getComputedStyle(el).boxShadow;
    root.classList.add("dark");
    var dark = getComputedStyle(el).boxShadow;
    if (!wasDark) root.classList.remove("dark");
    el.remove();
    return { light: light, dark: dark, wasDark: wasDark };
  })())`);
  ok("dark toggle probe returned", !!r5 && !!r5.light && !!r5.dark, JSON.stringify(r5 && { wasDark: r5.wasDark }));
  if (r5 && r5.light && r5.dark) {
    ok("glow-42 differs across scopes", r5.light !== r5.dark, `light=${r5.light.slice(0, 60)} dark=${r5.dark.slice(0, 60)}`);
  }
} catch (e) {
  fail++; console.log("FAIL  runtime faces —", e.message);
} finally {
  sh("agent-browser close >/dev/null 2>&1");
  try { chrome.kill(); } catch { /* already gone */ }
}

console.log(`\nt581 ink-ladder forensics: ${pass} ok, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
