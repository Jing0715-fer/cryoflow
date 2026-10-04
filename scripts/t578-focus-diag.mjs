/**
 * t578 diagnostic — why does t571's focus face fail under the shimmed Chrome
 * while the identical flow passes in agent-browser's own browser?
 *
 * Mirrors t571's environment EXACTLY (own Chrome on 9323 + t570 hover shim),
 * then walks the centerCard sequence with a full state dump at each beat:
 *   D1  Ctrl+K          — cmdk-root present? item count? open?
 *   D2  after typing    — first item text? highlighted item? input value?
 *   D3  after Enter     — dialog present? palette still open? selected item?
 *   D4  unshimmed retry — close page, reopen WITHOUT re-applying the shim,
 *                         same sequence (isolates the shim variable)
 */
import { execSync, spawn } from "node:child_process";

const BASE = "http://localhost:3000";
const CDP_PORT = "9324";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t578-diag-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const evalJs = (expr) => {
  try {
    const flat = expr.replace(/\s*\n\s*/g, " ");
    const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed.trim() : raw.trim();
    } catch { return raw.replace(/^"|"$/g, "").trim(); }
  } catch { return ""; }
};
const readJson = async (js) => { const raw = evalJs(js); try { return JSON.parse(raw); } catch { return null; } };

const chromeProc = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--hide-scrollbars", "--window-size=1280,720",
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${PROFILE}`,
  "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
  "about:blank",
], { stdio: "ignore", detached: false });

const ready = await (async () => {
  for (let i = 0; i < 50; i++) {
    try { if (sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200") return true; } catch {}
    await sleep(300);
  }
  return false;
})();
console.log(`chrome ready: ${ready}`);
try { sh(`agent-browser close >/dev/null 2>&1`); } catch {}
await sleep(400);
sh(`agent-browser connect ${CDP_PORT} 2>&1`);
sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
await sleep(3500);
console.log(`shim: ${sh(`node ${SHIM} ${CDP_PORT} 2>/dev/null`)}`);

// hydration poll
for (let i = 0; i < 40; i++) {
  const v = await readJson(`JSON.stringify({cards: document.querySelectorAll('[data-job]').length})`);
  if (v?.cards > 0) { console.log(`hydrated: ${v.cards} cards`); break; }
  await sleep(1000);
}

const dump = (tag) => readJson(`JSON.stringify((function(){
  const root=document.querySelector('[cmdk-root]');
  const items=[...document.querySelectorAll('[cmdk-item]')];
  const inp=document.querySelector('[cmdk-input]');
  const dlg=document.querySelector('[data-inspector-dialog]');
  return {
    tag: ${JSON.stringify(tag)},
    pk: !!root,
    n: items.length,
    first: items[0]?.textContent?.slice(0,40) || null,
    value: inp?.value || null,
    dlg: !!dlg,
  };
})())`);

console.log("\n[D1] Ctrl+K");
sh(`agent-browser press Control+k >/dev/null 2>&1`);
await sleep(900);
console.log(JSON.stringify(await dump("after-ctrlk")));

console.log("\n[D2] type");
sh(`agent-browser keyboard type "class2d K5" >/dev/null 2>&1`);
await sleep(900);
console.log(JSON.stringify(await dump("after-type")));

console.log("\n[D3] Enter");
sh(`agent-browser press Enter >/dev/null 2>&1`);
await sleep(2200);
console.log(JSON.stringify(await dump("after-enter")));

// D4 — reload WITHOUT shim (isolates the hover-shim variable)
console.log("\n[D4] reload WITHOUT shim");
sh(`agent-browser open "about:blank" >/dev/null 2>&1`);
await sleep(400);
sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
await sleep(3500);
for (let i = 0; i < 40; i++) {
  const v = await readJson(`JSON.stringify({cards: document.querySelectorAll('[data-job]').length})`);
  if (v?.cards > 0) { console.log(`hydrated: ${v.cards} cards`); break; }
  await sleep(1000);
}
sh(`agent-browser press Control+k >/dev/null 2>&1`);
await sleep(900);
sh(`agent-browser keyboard type "class2d K5" >/dev/null 2>&1`);
await sleep(900);
sh(`agent-browser press Enter >/dev/null 2>&1`);
await sleep(2200);
console.log(JSON.stringify(await dump("unshimmed-after-enter")));

try { sh(`agent-browser close >/dev/null 2>&1`); } catch {}
try { chromeProc.kill("SIGKILL"); } catch {}
