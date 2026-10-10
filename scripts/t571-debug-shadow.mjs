/** t571 debug — why doesn't hover:shadow-md compute? Dump the truth. */
import { execSync, spawn } from "node:child_process";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CDP_PORT = "9323";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t571-debug-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const evalJs = (expr) => {
  const flat = expr.replace(/\s*\n\s*/g, " ");
  const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
  try { const p = JSON.parse(raw); return typeof p === "string" ? p.trim() : raw.trim(); }
  catch { return raw.replace(/^"|"$/g, "").trim(); }
};

const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--hide-scrollbars", "--window-size=1280,720",
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
  "about:blank",
], { stdio: "ignore" });
await sleep(2500);
try { sh(`agent-browser close >/dev/null 2>&1`); } catch {}
sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`);
sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
await sleep(3500);
sh(`node ${SHIM} ${CDP_PORT} >/dev/null 2>&1`);

const jobs = JSON.parse(sh(`curl -s -H "Origin: ${BASE}" "${BASE}/api/jobs"`));
const list = Array.isArray(jobs) ? jobs : jobs.jobs;
const k5 = list.find((j) => j.type === "class2d" && j.status === "completed");

// palette → inspector → focus → escape
sh(`agent-browser press Control+k >/dev/null 2>&1`); await sleep(900);
sh(`agent-browser keyboard type "${k5.name}" >/dev/null 2>&1`); await sleep(900);
sh(`agent-browser press Enter >/dev/null 2>&1`); await sleep(2200);
evalJs(`(function(){const dlg=document.querySelector('[data-inspector-dialog]');if(!dlg)return 'nodialog';const b=[...dlg.querySelectorAll('button')].find(x=>x.textContent.trim()==='Focus');if(b)b.click();return 'clicked';})()`);
await sleep(1100);
sh(`agent-browser press Escape >/dev/null 2>&1`); await sleep(900);
sh(`agent-browser hover "header" >/dev/null 2>&1`); await sleep(400);
sh(`agent-browser hover "[data-job=\\"${k5.id}\\"]" >/dev/null 2>&1`); await sleep(500);

const dump = evalJs(`JSON.stringify((function(){
  const el=document.querySelector('[data-job="${k5.id}"] div[role="button"]');
  if(!el) return {found:false};
  const cs=getComputedStyle(el);
  let ruleFound=false, ruleMedia='';
  for(const sheet of document.styleSheets){
    let rules; try{rules=sheet.cssRules;}catch{continue;}
    const scan=(rs,ctx)=>{for(const r of rs){
      if(r.cssRules){scan(r.cssRules, ctx + '/' + (r.conditionText||'')); continue;}
      if(r.selectorText && r.selectorText.includes('hover\\\\:shadow-md')){ruleFound=true;ruleMedia=ctx;}
    }};
    scan(rules,'');
  }
  return {found:true, cls: el.className, translate: cs.translate, shadow: cs.boxShadow, border: cs.borderColor, ruleFound, ruleMedia, hover: el.matches(':hover')};
})())`);
console.log(dump);
chrome.kill("SIGKILL");
