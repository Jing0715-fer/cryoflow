/** t580-cascade-forensics — one-shot, single-lifetime probe.
 *  Spawns the desktop-capable Chrome, opens the app, opens the inspector,
 *  lands on Overview, hovers the first whisper card, then enumerates EVERY
 *  stylesheet rule that matches the card and declares box-shadow — with the
 *  hover state live — so the winning rule is identified by name, not guessed.
 */
import { execSync, spawn } from "node:child_process";

const BASE = "http://localhost:3000";
const CDP_PORT = "9329";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t580-forensics-profile";
const TARGET = process.env.T580_JOB_SUFFIX || "dk6u5c";

const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim(); } catch (e) { return ""; } };
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

const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--hide-scrollbars", "--window-size=1280,720",
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
  "about:blank",
], { stdio: "ignore" });

try {
  const ready = await pollUntil(() => sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200", 15000, 300);
  if (!ready) { console.error("chrome cdp never opened"); process.exit(2); }
  sh("agent-browser close >/dev/null 2>&1");
  await sleep(400);
  sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`);
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  const hydrated = await pollUntil(() => (readJson(`JSON.stringify((function(){ return { cards: document.querySelectorAll('[data-job]').length }; })())`)?.cards > 0), 90000, 1000);
  console.log("hydrated:", JSON.stringify(hydrated));

  // open the inspector: real click on the target card body
  const pos = readJson(`JSON.stringify((function(){
    const c = [...document.querySelectorAll('[data-job]')].find(function(x){ return x.getAttribute('data-job').endsWith('${TARGET}'); });
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })())`);
  sh(`agent-browser mouse move ${pos.x} ${pos.y} >/dev/null 2>&1`); await sleep(200);
  sh(`agent-browser mouse down left >/dev/null 2>&1`); await sleep(120);
  sh(`agent-browser mouse up left >/dev/null 2>&1`);
  await pollUntil(() => readJson(`JSON.stringify((function(){ const d = document.querySelector('[role=dialog]'); return d ? { open: true } : null; })())`), 6000, 300);
  await sleep(700); // entry animation settle

  // land on Overview (real pointer)
  const tab = readJson(`JSON.stringify((function(){
    const t = [...document.querySelectorAll('[role=dialog] [role=tab]')].find(function(x){ return x.textContent.trim() === 'Overview'; });
    const r = t.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), sel: t.getAttribute('aria-selected') };
  })())`);
  if (tab.sel !== "true") {
    sh(`agent-browser mouse move ${tab.x} ${tab.y} >/dev/null 2>&1`); await sleep(200);
    sh(`agent-browser mouse down left >/dev/null 2>&1`); await sleep(120);
    sh(`agent-browser mouse up left >/dev/null 2>&1`);
    await sleep(1200);
  }

  // hover + enumerate every matching box-shadow rule
  sh(`agent-browser hover "[role=dialog] .insp-card-whisper" >/dev/null 2>&1`);
  await sleep(600);
  const report = readJson(`JSON.stringify((function(){
    const el = document.querySelector('[role=dialog] .insp-card-whisper');
    if (!el) return { error: "no whisper card" };
    const out = { hovered: el.matches(':hover'), computed: getComputedStyle(el).boxShadow.slice(0, 110), hits: [] };
    const scan = function(rules, ctx){
      for (const r of rules) {
        if (r.selectorText) {
          let m = false; try { m = el.matches(r.selectorText); } catch (e) { /* invalid */ }
          if (m && r.style && r.style.boxShadow) out.hits.push({ ctx, sel: r.selectorText.slice(0, 70), bs: r.style.boxShadow.slice(0, 100) });
        }
        if (r.cssRules) scan(r.cssRules, (ctx + " > " + (r.conditionText || r.selectorText || "?")).slice(-90));
      }
    };
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      scan(rules, (sheet.href || "inline").slice(-14));
    }
    out.fg = getComputedStyle(el).getPropertyValue("--foreground").slice(0, 50);
    return out;
  })())`);
  console.log(JSON.stringify(report, null, 1));
} finally {
  try { sh("agent-browser close >/dev/null 2>&1"); } catch { /* gone */ }
  try { chrome.kill(); } catch { /* gone */ }
  try { execSync(`pkill -f "remote-debugging-port=${CDP_PORT}" 2>/dev/null`); } catch { /* gone */ }
}
