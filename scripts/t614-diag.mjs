/**
 * t614diag — minimal: boot, hydrate, click Workspaces tab, dump what happens.
 */
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const CDP_PORT = "9337";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t614diag4-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
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

const chromeProc = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--hide-scrollbars", "--window-size=1280,720",
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${PROFILE}`,
  "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
  "about:blank",
], { stdio: "ignore", detached: false });
const t0 = Date.now();
while (Date.now() - t0 < 15000) {
  try { if (sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200") break; } catch {}
  await sleep(300);
}
try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`);
sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
try { sh(`node ${SHIM} ${CDP_PORT} >/dev/null 2>&1`); } catch {}
for (let i = 0; i < 90; i++) {
  const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
  if (n === 12) break;
  await sleep(1000);
}
console.log("hydrated:", await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`));

const tabsBefore = await readJson(`(() => {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  return JSON.stringify(tabs.map((t) => ({ text: (t.textContent || "").trim().slice(0, 30), state: t.dataset.state })));
})()`);
console.log("tabs before:", JSON.stringify(tabsBefore));

/* click and immediately watch — REAL input via snapshot ref flow */
let clickRes = "n/a";
try {
  const snap = sh("agent-browser snapshot -i --json 2>/dev/null");
  const j = JSON.parse(snap);
  const find = (o) => {
    if (!o || typeof o !== "object") return null;
    if (o.role === "tab" && typeof o.text === "string" && o.text.includes("Workspaces")) return o.ref || o.id || null;
    for (const k of Object.keys(o)) {
      const r = find(o[k]);
      if (r) return r;
    }
    return null;
  };
  const ref = find(j);
  console.log("tab ref:", ref);
  if (ref) { sh(`agent-browser click @${ref} 2>&1`); clickRes = "clicked@" + ref; }
  else clickRes = "no-ref-found:" + JSON.stringify(j).slice(0, 200);
} catch (e) {
  clickRes = "real-click-failed: " + String(e).slice(0, 150);
}
console.log("click:", clickRes);
for (const wait of [300, 700, 1500, 3000]) {
  await sleep(wait);
  const st = await readJson(`(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const overlay = document.querySelector("nextjs-portal") ? "OVERLAY" : "none";
    return JSON.stringify({
      tabs: tabs.length,
      states: tabs.map((t) => t.dataset.state),
      jobs: document.querySelectorAll("[data-job]").length,
      overlay,
      bodyStart: (document.body.innerText || "").slice(0, 60).replace(/\\n/g, "|"),
    });
  })()`);
  console.log(`+${wait}ms:`, JSON.stringify(st));
}
try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch {}
try { chromeProc.kill(); } catch {}
