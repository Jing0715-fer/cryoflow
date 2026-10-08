/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t598 forensic — fine-grained observation of one mint: does data-born
 * EVER appear? Samples at 25ms for 4s across the palette-add, keeps
 * every frame where anything birth-related moved, plus dense frames
 * around the newborn's first appearance.
 */
import { execSync } from "node:child_process";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const readJson = async (js, tries = 3) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      return v;
    } catch { await sleep(600); }
  }
  return null;
};
async function pollUntil(fn, timeoutMs = 60000, step = 400) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}

try {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(800);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const hy = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 90000, 400);
  console.log(`hydrated: ${hy}`);
  await sleep(600);

  const probe = await readJson(`(function(){
    var inp = document.querySelector("[cmdk-input]");
    var opened = false;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    return new Promise(function(res){
      setTimeout(function(){
        var inp2 = document.querySelector("[cmdk-input]");
        if (!inp2) { res(JSON.stringify({ err: "palette did not open" })); return; }
        var before = {};
        document.querySelectorAll("[data-job]").forEach(function(el){ before[el.getAttribute("data-job")] = 1; });
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(inp2, "add ctffind");
        inp2.dispatchEvent(new Event("input", { bubbles: true }));
        setTimeout(function(){
          inp2.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
          var t0 = performance.now();
          var frames = [];
          var iv = setInterval(function(){
            var nb = [];
            document.querySelectorAll("[data-job]").forEach(function(el){
              var id = el.getAttribute("data-job");
              if (!before[id]) nb.push({ op: getComputedStyle(el).opacity, born: el.hasAttribute("data-born"), d: el.style.getPropertyValue("--card-d"), tf: el.style.transform || "" });
            });
            var w = document.querySelector('[data-canvas="workspace"]');
            frames.push({
              t: Math.round(performance.now() - t0),
              n: nb.length,
              born0: nb[0] ? nb[0].born : null,
              op0: nb[0] ? nb[0].op : null,
              d0: nb[0] ? nb[0].d : null,
              play: w ? w.hasAttribute("data-birth-play") : null
            });
          }, 25);
          setTimeout(function(){
            clearInterval(iv);
            var interesting = frames.filter(function(f, i){
              if (i === 0) return true;
              var p = frames[i - 1];
              return f.n !== p.n || f.born0 !== p.born0 || f.play !== p.play || (f.op0 !== null && parseFloat(f.op0) < 1);
            });
            var firstNb = frames.findIndex(function(f){ return f.n > 0; });
            var dense = firstNb >= 0 ? frames.slice(Math.max(0, firstNb - 2), firstNb + 12) : [];
            res(JSON.stringify({ total: frames.length, interesting: interesting, dense: dense }));
          }, 4000);
        }, 400);
      }, 450);
    });
  })()`, 5);
  console.log(JSON.stringify(probe, null, 1).slice(0, 3500));

  const dbg = await readJson(`JSON.stringify((window.__t598dbg || []).slice(-14))`);
  console.log(`DBG: ${JSON.stringify(dbg)}`);

  /* cleanup: delete the probe job by census diff */
  const ids = await readJson(`JSON.stringify(Array.from(document.querySelectorAll("[data-job]")).map(function(el){ return el.getAttribute("data-job"); }))`);
  const known = await readJson(`JSON.stringify(13)`);
  if (Array.isArray(ids) && ids.length === 13) {
    const fresh = ids[ids.length - 1];
    sh(`curl -s -X DELETE -H "Origin: ${BASE}" ${BASE}/api/jobs/${fresh} >/dev/null`);
    console.log(`cleaned ${fresh}`);
  }
} catch (e) {
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(0);
