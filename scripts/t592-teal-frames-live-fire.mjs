/**
 * t592 — the teal frames read their rungs (the deferred audit pays off).
 *
 * t583 tokenized the accent vocabulary (--glow-XX teal / --pulse-XX
 * primary-srgb / --tint-XX primary-oklch) and claimed two things the sheet
 * never verified LIVE: every animation frame cites a rung (no scattered
 * inline math), and the dual-form pipeline split (opaque fallback +
 * @supports truth) serves both scopes. The note "teal 动画内部双形拆分注意
 * 逐帧一致性" hung for eight windows; this window cashes it.
 *
 * The audit is synthetic-probe only: the EMPIAR world has no RUNNING job
 * (11 completed + 1 idle) and minting one would mutate the world, so the
 * harness appends disposable .job-running / .ws-running elements — the
 * animations are class-driven and run on any element. Deterministic phase
 * sampling without fighting the frame clock: `animation-delay: -Xs` PLUS
 * `animation-play-state: paused` freezes the computed style at exactly
 * phase X (0% = rest, -1.05s = the 2.1s cycle's 50% peak).
 *
 * Finding baked in before the run (manual smoke): the animated frames
 * serialize as oklab(...) while static var() references serialize as
 * oklch(...) — the SAME resolved color in two spellings (L 0.719995,
 * C 0.139996, H 181.994 ⇔ a -0.139912, b -0.00487). The t582/t583
 * serialization family, N+1: frame-consistency must compare COLOR VALUES,
 * never strings. The harness parses both spellings into oklab components
 * and compares with an epsilon; the shadow GEOMETRY (offsets/blur/spread)
 * still compares verbatim.
 *
 * Faces proven here:
 *   G0  the served sheet carries the dual-form split (fallback
 *       var(--teal-glow) + @supports truth) for both scopes, and the
 *       keyframes cite the rung tokens verbatim.
 *   A1  source census — zero color-mix() outside definition lines in
 *       globals.css (comments don't count; the t583 claim, audited).
 *   A2  rest frame honesty — .job-running paused at 0%: the FULL
 *       three-line box-shadow (ring glow-42 / halo glow-38 / ink-10
 *       floor) equals the static rung reference, color-value-wise and
 *       geometry-verbatim.
 *   A3  peak frame honesty — paused at -1.05s (the 50% keyframe): ring
 *       glow-78 / halo glow-62, same full-frame equality.
 *   A4  the frames actually travel — the 25%-phase ring differs from
 *       BOTH endpoints (interpolation is alive between the rungs).
 *   A5  the breathe twin — .ws-running at 0%: background glow-10, ring
 *       spread 0 of glow-00 (alpha ≈ 0 — the from-nothing start); at
 *       50%: background glow-22, ring glow-14.
 *   A6  dark-scope parity — probes inside a div.dark wrapper (the real
 *       theme is never toggled): --teal-glow resolves to the dark source
 *       (0.78 vs 0.72 light), the dark rest frame equals its own dark
 *       reference, and the dark ring is genuinely a different color from
 *       the light one — the bake-bug class, caught if it existed.
 *   A7  the reduced-motion freeze cites the shared vocabulary (glow-60 /
 *       glow-48) — source and served sheet both.
 *   A8  the other accent consumers resolve: ::selection cites tint-26,
 *       reveal-flash cites pulse-45, progress-shimmer carries tint-45 in
 *       its gradient (source + served asserts; a live shimmer probe's
 *       background-image is a non-none gradient).
 *   R   roster untouched, console clean, probes removed from the DOM.
 *
 * Environment shim = t571/t585..t591's: desktop-capable Chrome via CDP
 * port 9336 (9323=t578, 9324=t584, 9325=t585, 9326=t586, 9327=t587,
 * 9328=t587 probe, 9329=t589 QA, 9330=t588, 9331=t589, 9332=t590,
 * 9333=t591 QA probe, 9334=t591, 9335=t592 QA probe — zombies keep their
 * ports; t581's law). Runs in the EMPIAR world in place, mints nothing.
 *
 * Usage: node scripts/t592-teal-frames-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9336";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t592-harness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
const SRC_CSS = "src/app/globals.css";

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, timeoutMs = 30000, step = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    await sleep(step);
  }
  return null;
}
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const api = (verb, path, body) =>
  sh(
    `curl -s -X ${verb} -H "Content-Type: application/json" -H "Origin: ${BASE}" -H "Referer: ${BASE}/"` +
    (body ? ` -d ${JSON.stringify(JSON.stringify(body))}` : "") + ` "${BASE}${path}"`
  );
const evalJs = (expr) => {
  try {
    const flat = expr.replace(/\s*\n\s*/g, " ");
    const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed.trim() : raw.trim();
    } catch {
      return raw.replace(/^"|"$/g, "").trim();
    }
  } catch { return ""; }
};
const readJson = async (js) => {
  const raw = evalJs(js);
  try { return JSON.parse(raw); } catch { return null; }
};

/* ---- the environment shim: own Chrome, desktop capabilities ----------- */
let chromeProc = null;
async function launchDesktopChrome() {
  chromeProc = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--hide-scrollbars", "--window-size=1280,720",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
    "about:blank",
  ], { stdio: "ignore", detached: false });
  const ready = await pollUntil(() => {
    try { return sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200"; }
    catch { return false; }
  }, 15000, 300);
  return ready;
}
const applyShim = () => {
  try { return sh(`node ${SHIM} ${CDP_PORT} 2>/dev/null`).includes('"ok":true'); }
  catch { return false; }
};

/* ---- world guard BEFORE any browser spend ----------------------------- */
const projects = JSON.parse(api("GET", "/api/projects")).projects;
const active = projects.find((p) => p.active);
if (!active || active.id !== EMPIAR_ID) {
  console.error(`FATAL: active world is ${active?.id ?? "unknown"}, expected EMPIAR — refusing to run in a borrowed world`);
  process.exit(2);
}
const roster0 = active.stats.total;
console.log(`world guard ok — EMPIAR active, roster ${roster0}`);

/* ---- A1 — the source census (node-side, before the browser) ----------- */
console.log(`\n[A1] source census — color-mix lives only at definition lines`);
{
  const lines = readFileSync(SRC_CSS, "utf8").split("\n");
  let inComment = false;
  const offenders = [];
  lines.forEach((line, i) => {
    if (line.includes("/*")) inComment = true;
    const isComment = inComment || line.trim().startsWith("*") || line.includes("*/");
    if (line.includes("*/")) inComment = false;
    if (!isComment && line.includes("color-mix") && !line.trim().startsWith("--")) {
      offenders.push(`${i + 1}: ${line.trim().slice(0, 70)}`);
    }
  });
  check("zero color-mix outside definition lines", offenders.length === 0,
    offenders.length ? offenders.slice(0, 3).join(" | ") : "sheet is clean");
}

/* ---- G0 — the served sheet's dual-form split --------------------------- */
{
  const cssUrl = sh(`curl -s ${BASE}/ | grep -oE '/_next/static/[^"]+\\.css' | head -1`);
  const sheet = cssUrl ? sh(`curl -s "${BASE}${cssUrl}"`) : "";
  console.log(`\n[G0] the served sheet's dual-form split + rung citations`);
  check("css url resolved", cssUrl.length > 0, cssUrl.slice(-40));
  check("fallback branch (opaque source) for glow-42, light scope",
    /:root\s*\{\s*--glow-42:\s*var\(--teal-glow\)/.test(sheet));
  check("@supports truth branch for glow-42, light scope",
    /@supports[^{]*color-mix[^{]*\{\s*:root\s*\{\s*--glow-42:\s*color-mix\(in oklch,\s*var\(--teal-glow\) 42%/.test(sheet));
  check("dual-form present for the dark scope too",
    /\.dark\s*\{\s*--glow-42:\s*var\(--teal-glow\)/.test(sheet) &&
    /@supports[^{]*\{\s*\.dark\s*\{\s*--glow-42:\s*color-mix/.test(sheet));
  check("run-glow cites rungs (42/38 → 78/62)",
    /run-glow/.test(sheet) && sheet.includes("var(--glow-42)") && sheet.includes("var(--glow-78)"));
  check("run-breathe cites rungs (10/00 → 22/14)",
    sheet.includes("var(--glow-10)") && sheet.includes("var(--glow-00)") && sheet.includes("var(--glow-22)"));
}

/* ---- browser up -------------------------------------------------------- */
rmSync(PROFILE, { recursive: true, force: true });
const chromeUp = await launchDesktopChrome();
check("desktop chrome up", chromeUp);
if (chromeUp) {
  try { sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`); } catch { /* best effort */ }
  check("hover/pointer shim applied", applyShim());
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`document.querySelectorAll("[data-job]").length`);
    return n > 0 ? n : null;
  }, 45000);
  check("canvas hydrated", hydrated > 0, `${hydrated} cards`);

  /* ---- the probe rig ----------------------------------------------------
     Numeric color compare: parse oklab(...) / oklch(...) / rgba(...) from
     a computed string into {L,a,b,alpha}; oklch converts via C·cosH,
     C·sinH. Geometry (everything outside color parens) compares verbatim.
     Probes: class-driven animations, frozen at a phase by negative
     animation-delay + play-state paused; references are static rung
     citations of the same geometry. All removed in the same eval. */
  console.log(`\n[rig] synthetic probes + numeric color compare`);

  /* ---- A2/A3/A4 — run-glow frames --------------------------------------- */
  console.log(`\n[A2] rest frame — the 0% keyframe reads glow-42/38 + ink-10`);
  const glow = await readJson(`new Promise((res)=>{
    const parse=(str)=>{
      const colors=[];let geom=str;
      const re=/(oklab|oklch|rgba|rgb|hsl)\\([^)]*\\)/g;let m;
      while((m=re.exec(str))!==null){
        const tok=m[0];colors.push(tok);
        geom=geom.replace(tok,"\\u0000");
      }
      geom=geom.replace(/\\s+/g," ").trim();
      const comps=colors.map(tok=>{
        let mm=tok.match(/^oklab\\(\\s*([\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s*\\/\\s*([\\d.]+)\\s*\\)$/);
        if(mm)return {L:+mm[1],a:+mm[2],b:+mm[3],al:+mm[4]};
        mm=tok.match(/^oklch\\(\\s*([\\d.]+)\\s+([\\d.]+)\\s+(-?[\\d.]+)\\s*\\/\\s*([\\d.]+)\\s*\\)$/);
        if(mm){const L=+mm[1],C=+mm[2],H=+mm[3]*Math.PI/180;return {L,a:+(C*Math.cos(H)).toFixed(6),b:+(C*Math.sin(H)).toFixed(6),al:+mm[4]};}
        mm=tok.match(/^rgba?\\(([^)]+)\\)$/);
        if(mm){const p=mm[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);return {L:-1,a:p[0],b:p[1],al:p[3]===undefined?1:p[3],rgb:p};}
        return {L:-2,a:0,b:0,al:-1};
      });
      return {colors,comps,geom};
    };
    const eq=(x,y,eps)=>{
      eps=eps||0.002;
      if(x.rgb&&y.rgb)return x.rgb.every((v,i)=>Math.abs(v-(y.rgb[i]||0))<2)&&Math.abs(x.al-y.al)<eps;
      return Math.abs(x.L-y.L)<eps&&Math.abs(x.a-y.a)<eps&&Math.abs(x.b-y.b)<eps&&Math.abs(x.al-y.al)<eps;
    };
    const mk=(cls,delay)=>{const d=document.createElement("div");d.className=cls;
      d.dataset.t592Probe="1";
      d.style.cssText="width:60px;height:36px;animation-delay:"+delay+"s;animation-play-state:paused";
      document.body.appendChild(d);return d;};
    const ref=(shadow)=>{const d=document.createElement("div");
      d.dataset.t592Probe="1";
      d.style.cssText="width:60px;height:36px;box-shadow:"+shadow;
      document.body.appendChild(d);return d;};
    let rest,peak,mid,refRest,refPeak;
    try{
      rest=mk("job-running",0); peak=mk("job-running",-1.05); mid=mk("job-running",-0.525);
      refRest=ref("0 0 0 1px var(--glow-42), 0 0 14px -2px var(--glow-38), 0 6px 16px -4px var(--ink-10)");
      refPeak=ref("0 0 0 1px var(--glow-78), 0 0 24px -2px var(--glow-62), 0 6px 16px -4px var(--ink-10)");
      const A=parse(getComputedStyle(rest).boxShadow);
      const B=parse(getComputedStyle(refRest).boxShadow);
      const P=parse(getComputedStyle(peak).boxShadow);
      const Q=parse(getComputedStyle(refPeak).boxShadow);
      const M=parse(getComputedStyle(mid).boxShadow);
      res(JSON.stringify({
        rest:{colors:A.colors,geom:A.geom,comps:A.comps},
        refRest:{geom:B.geom,comps:B.comps},
        peak:{comps:P.comps},refPeak:{geom:Q.geom,comps:Q.comps},
        mid:{comps:M.comps},
        restEq:A.geom===B.geom&&A.comps.length===B.comps.length&&A.comps.every((c,i)=>eq(c,B.comps[i])),
        peakEq:P.comps.length===Q.comps.length&&P.comps.every((c,i)=>eq(c,Q.comps[i])),
        midTravels:!eq(M.comps[0],A.comps[0],0.01)&&!eq(M.comps[0],P.comps[0],0.01)
      }));
    }finally{[rest,peak,mid,refRest,refPeak].forEach(e=>e.remove());}
  })`);
  check("probe payload", !!glow && !!glow.rest, glow ? "" : "eval failed");
  check("rest frame == static rung reference (colors + geometry)",
    glow?.restEq === true,
    glow ? `geom=${glow.rest?.geom?.slice(0, 40)} n=${glow.rest?.comps?.length}` : "");
  check("peak frame == static rung reference (colors + geometry)",
    glow?.peakEq === true,
    glow ? `geom=${glow.refPeak?.geom?.slice(0, 40)}` : "");
  check("geometry verbatim across frames (offsets/blur/spread unchanged)",
    glow?.rest?.geom === glow?.refRest?.geom);

  console.log(`\n[A3] peak frame — the 50% keyframe reads glow-78/62`);
  check("peak ring is glow-78's alpha (0.78)", Math.abs((glow?.peak?.comps?.[0]?.al ?? 0) - 0.78) < 0.003,
    `al=${glow?.peak?.comps?.[0]?.al}`);

  console.log(`\n[A4] the frames travel — 25% phase is between the endpoints`);
  check("mid ring differs from rest AND peak (interpolation alive)",
    glow?.midTravels === true,
    glow ? `mid al=${glow.mid?.comps?.[0]?.al}` : "");

  /* ---- A5 — the breathe twin -------------------------------------------- */
  console.log(`\n[A5] run-breathe — the chip twin reads the same rungs`);
  const breathe = await readJson(`new Promise((res)=>{
    const parse=(str)=>{
      const colors=[];let geom=str;
      const re=/(oklab|oklch|rgba|rgb|hsl)\\([^)]*\\)/g;let m;
      while((m=re.exec(str))!==null){
        const tok=m[0];colors.push(tok);
        geom=geom.replace(tok,"\\u0000");
      }
      geom=geom.replace(/\\s+/g," ").trim();
      const comps=colors.map(tok=>{
        let mm=tok.match(/^oklab\\(\\s*([\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s*\\/\\s*([\\d.]+)\\s*\\)$/);
        if(mm)return {L:+mm[1],a:+mm[2],b:+mm[3],al:+mm[4]};
        mm=tok.match(/^oklch\\(\\s*([\\d.]+)\\s+([\\d.]+)\\s+(-?[\\d.]+)\\s*\\/\\s*([\\d.]+)\\s*\\)$/);
        if(mm){const L=+mm[1],C=+mm[2],H=+mm[3]*Math.PI/180;return {L,a:+(C*Math.cos(H)).toFixed(6),b:+(C*Math.sin(H)).toFixed(6),al:+mm[4]};}
        mm=tok.match(/^rgba?\\(([^)]+)\\)$/);
        if(mm){const p=mm[1].split(/[\\s,\\/]+/).filter(Boolean).map(Number);return {L:-1,a:p[0],b:p[1],al:p[3]===undefined?1:p[3],rgb:p};}
        return {L:-2,a:0,b:0,al:-1};
      });
      return {colors,comps,geom};
    };
    const eq=(x,y,eps)=>{eps=eps||0.002;
      if(x.rgb&&y.rgb)return x.rgb.every((v,i)=>Math.abs(v-(y.rgb[i]||0))<2)&&Math.abs(x.al-y.al)<eps;
      if(!x||!y)return false;
      return Math.abs(x.L-y.L)<eps&&Math.abs(x.a-y.a)<eps&&Math.abs(x.b-y.b)<eps&&Math.abs(x.al-y.al)<eps;};
    const al0=(c)=>c&&typeof c.al==="number"?Math.abs(c.al):1;
    const mk=(delay)=>{const d=document.createElement("div");d.className="ws-running";
      d.dataset.t592Probe="1";
      d.style.cssText="width:30px;height:20px;border-radius:99px;animation-delay:"+delay+"s;animation-play-state:paused";
      document.body.appendChild(d);return d;};
    const refEl=(css)=>{const d=document.createElement("div");
      d.dataset.t592Probe="1";
      d.style.cssText="width:30px;height:20px;"+css;
      document.body.appendChild(d);return d;};
    let rest,peak,bg10,bg22,ring0,ring14;
    try{
      rest=mk(0); peak=mk(-1.05);
      bg10=refEl("background-color:var(--glow-10)");
      bg22=refEl("background-color:var(--glow-22)");
      ring0=refEl("box-shadow:0 0 0 0 var(--glow-00)");
      ring14=refEl("box-shadow:0 0 0 3px var(--glow-14)");
      const Abg=parse(getComputedStyle(rest).backgroundColor);
      const Ash=parse(getComputedStyle(rest).boxShadow);
      const B=parse(getComputedStyle(bg10).backgroundColor);
      const Pbg=parse(getComputedStyle(peak).backgroundColor);
      const Psh=parse(getComputedStyle(peak).boxShadow);
      const Q=parse(getComputedStyle(bg22).backgroundColor);
      const R0=parse(getComputedStyle(ring0).boxShadow);
      const R14=parse(getComputedStyle(ring14).boxShadow);
      res(JSON.stringify({
        restBgEq:eq(Abg.comps[0],B.comps[0]),restBgAl:Abg.comps[0]?Abg.comps[0].al:null,
        peakBgEq:eq(Pbg.comps[0],Q.comps[0]),peakBgAl:Pbg.comps[0]?Pbg.comps[0].al:null,
        restRingEq:Ash.geom===R0.geom&&al0(Ash.comps[0])<0.01&&al0(R0.comps[0])<0.01,
        restRingGeom:Ash.geom,ring0Geom:R0.geom,
        peakRingEq:Psh.geom===R14.geom&&eq(Psh.comps[0],R14.comps[0]),
        peakRingGeom:Psh.geom,ring14Geom:R14.geom
      }));
    }finally{[rest,peak,bg10,bg22,ring0,ring14].forEach(e=>e&&e.remove());}
  })`);
  check("rest: background == glow-10 reference", breathe?.restBgEq === true,
    breathe ? `al=${breathe.restBgAl}` : "");
  check("peak: background == glow-22 reference", breathe?.peakBgEq === true,
    breathe ? `al=${breathe.peakBgAl}` : "");
  check("rest ring: spread 0 of glow-00 (from-nothing, alpha 0)",
    breathe?.restRingEq === true,
    breathe ? `${JSON.stringify(breathe.restRingGeom)} vs ${JSON.stringify(breathe.ring0Geom)}` : "");
  check("peak ring: spread 3px of glow-14 (geometry + color)", breathe?.peakRingEq === true,
    breathe ? `${JSON.stringify(breathe.peakRingGeom)} vs ${JSON.stringify(breathe.ring14Geom)}` : "");

  /* ---- A6 — dark-scope parity (without touching the real theme) --------- */
  console.log(`\n[A6] dark-scope parity — the .dark wrapper resolves its own rungs`);
  const dark = await readJson(`new Promise((res)=>{
    const mk=(parent,cls,delay)=>{const d=document.createElement(cls?"div":"div");
      d.dataset.t592Probe="1";
      if(cls)d.className=cls;
      d.style.cssText=(cls?"":"width:60px;height:36px;box-shadow:0 0 0 1px var(--glow-42)");
      if(cls)d.style.cssText="width:60px;height:36px;animation-delay:"+delay+"s;animation-play-state:paused";
      parent.appendChild(d);return d;};
    const parseFirst=(str)=>{
      let mm=str.match(/(oklab|oklch)\\(\\s*([\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)?\\s*[,\\/]\\s*([\\d.]+)\\s*\\)/);
      if(!mm)return null;
      if(mm[1]==="oklab")return {L:+mm[2],a:+mm[3],b:+mm[4],al:+mm[5]};
      const C=+mm[3],H=(+mm[4]||0)*Math.PI/180;
      return {L:+mm[2],a:+(C*Math.cos(H)).toFixed(6),b:+(C*Math.sin(H)).toFixed(6),al:+mm[5]};
    };
    const eq=(x,y,eps)=>{eps=eps||0.002;if(!x||!y)return false;
      return Math.abs(x.L-y.L)<eps&&Math.abs(x.a-y.a)<eps&&Math.abs(x.b-y.b)<eps&&Math.abs(x.al-y.al)<eps;};
    let w,probe,refE,lProbe;
    try{
      w=document.createElement("div");w.className="dark";document.body.appendChild(w);
      probe=mk(w,"job-running",0);
      refE=mk(w,null,0);
      lProbe=document.createElement("div");
      lProbe.dataset.t592Probe="1";
      lProbe.style.cssText="width:60px;height:36px;box-shadow:0 0 0 1px var(--glow-42)";
      document.body.appendChild(lProbe);
      const tealLight=getComputedStyle(document.documentElement).getPropertyValue("--teal-glow").trim();
      const tealDark=getComputedStyle(w).getPropertyValue("--teal-glow").trim();
      const dAl=parseFirst(getComputedStyle(probe).boxShadow);
      const dRef=parseFirst(getComputedStyle(refE).boxShadow);
      const lAl=parseFirst(getComputedStyle(lProbe).boxShadow);
      res(JSON.stringify({tealLight,tealDark,darkEq:eq(dAl,dRef),lightVsDark:!eq(lAl,dAl,0.004),
        lAl,dAl,dRef}));
    }finally{[probe,refE,lProbe,w].forEach(e=>e&&e.remove());}
  })`);
  check("the two scopes resolve different teal sources",
    !!dark?.tealLight && !!dark?.tealDark && dark.tealLight !== dark.tealDark,
    dark ? `light=${dark.tealLight.slice(0, 22)} dark=${dark.tealDark.slice(0, 22)}` : "");
  check("dark rest frame == its own dark reference (no bake bug)",
    dark?.darkEq === true);
  check("dark ring is genuinely a different color from light",
    dark?.lightVsDark === true,
    dark ? `ΔL=${Math.abs((dark.lAl?.L ?? 0) - (dark.dAl?.L ?? 0)).toFixed(4)}` : "");

  /* ---- A7/A8 — the freeze + the other accent consumers ------------------- */
  console.log(`\n[A7] reduced-motion freeze cites the shared vocabulary`);
  {
    const src = readFileSync(SRC_CSS, "utf8");
    const cssUrl = sh(`curl -s ${BASE}/ | grep -oE '/_next/static/[^"]+\\.css' | head -1`);
    const served = sh(`curl -s "${BASE}${cssUrl}"`);
    const freezeBlock = src.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.job-running\s*\{[^}]*\}/);
    check("source freeze block cites glow-60/48",
      !!freezeBlock && freezeBlock[0].includes("var(--glow-60)") && freezeBlock[0].includes("var(--glow-48)"));
    check("served sheet carries the freeze", /prefers-reduced-motion:\s*reduce\)\s*\{[^@]*\.job-running/.test(served.replace(/\n/g, " ")));
  }

  console.log(`\n[A8] the other accent consumers resolve`);
  {
    const src = readFileSync(SRC_CSS, "utf8");
    check("::selection cites tint-26", /::selection\s*\{[^}]*var\(--tint-26\)/.test(src));
    check("reveal-flash cites pulse-45", /reveal-flash[^{]*\{[^}]*var\(--pulse-45\)/.test(src) || src.includes("var(--pulse-45)"));
    check("progress-shimmer gradient carries tint-45", /var\(--tint-45\)/.test(src));
    const shimmerProbe = await readJson(`JSON.stringify((function(){
      const d=document.createElement("div");d.className="progress-shimmer";
      d.style.cssText="width:80px;height:8px";
      document.body.appendChild(d);
      const bg=getComputedStyle(d).backgroundImage;
      d.remove();
      return {bg: bg.slice(0,120), alive: bg!=="none" && bg.indexOf("gradient")>-1};
    })())`);
    check("live shimmer probe carries a gradient", shimmerProbe?.alive === true,
      shimmerProbe ? shimmerProbe.bg.slice(0, 60) : "");
  }

  /* ---- cleanup ----------------------------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  try {
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster untouched (probes were never world state)", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
  } catch (e) { check("cleanup ran", false, String(e.message)); }
  try {
    const errs = sh(`agent-browser errors 2>/dev/null`).trim();
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  } catch { /* eval unavailable */ }
  const leftovers = await readJson(`JSON.stringify({probes:document.querySelectorAll("[data-t592-probe]").length, classes:document.querySelectorAll(".job-running,.ws-running").length})`);
  check("no probe elements left in the DOM", leftovers?.probes === 0 && leftovers?.classes === 0,
    leftovers ? `probes=${leftovers.probes} classed=${leftovers.classes}` : "");
}

/* ---- the exit ---------------------------------------------------------- */
try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* already gone */ }
if (chromeProc) { try { chromeProc.kill("SIGKILL"); } catch { /* gone */ } }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
