/**
 * t621-diag — the palette search-mode recon (the witness's eyes).
 *
 * One pass, all readings: boot ledger census -> the search word's
 * forced-open + fill-on-miss ladder -> the clear's de-nomination -> the
 * re-search's frozen replay. Output: one JSON blob per phase.
 * Product under test: palette.tsx docblock 119-124 —
 *   search RE-FILTERS (forced-open categories nominate their matching
 *   rows in encounter order; clearing de-nominates; re-searching
 *   replays the frozen tickets).
 */
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const CDP_PORT = "9338";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t621-diag-chrome-profile";

let chromeProc = null;
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = async (js, tries = 3) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      let v = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith('"'); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      return v;
    } catch { await sleep(600); }
  }
  return null;
};
const pollUntil = async (fn, timeoutMs = 20000, step = 400) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
};
const clickRef = (needle, rolePrefix = "- tab ") => {
  for (let a = 0; a < 4; a++) {
    try {
      const snap = sh("agent-browser snapshot -i 2>/dev/null");
      const line = snap.split("\n").find((l) => l.trimStart().startsWith(rolePrefix) && l.includes(needle));
      const m = line && line.match(/ref=(e\d+)/);
      if (m) { sh(`agent-browser click @${m[1]} >/dev/null 2>&1`); return "clicked"; }
    } catch { /* */ }
    sleep(500);
  }
  return "no-ref";
};

try { sh("pkill -f agent-browser"); } catch { /* */ }
try { sh(`pkill -f remote-debugging-port=${CDP_PORT}`); } catch { /* */ }
rmSync(PROFILE, { recursive: true, force: true });
await sleep(800);

console.log("== boot chrome ==");
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
console.log("chrome ready:", ready);
if (!ready) process.exit(1);
sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`);
sh(`agent-browser navigate ${BASE} >/dev/null 2>&1`);
await pollUntil(async () => {
  const v = await readJson(`document.body.innerText.length`);
  return typeof v === "number" && v > 500;
}, 30000, 500);
console.log("page loaded, bodyLen:", await readJson(`document.body.innerText.length`));

/* open the palette: a real click on the rail's Catalog tab */
const click1 = clickRef("Catalog");
await sleep(1200);
console.log("catalog click:", click1);
const boot = await readJson(`(() => {
  const faces = [...document.querySelectorAll('[data-pal-arrival] [data-pal-face]')];
  const rows = faces.filter(f => f.dataset.palFace === 'row').map(f => ({
    id: (f.querySelector('button span') || f).textContent.trim().slice(0, 18),
    ad: getComputedStyle(f).animationDelay,
    key: f.getAttribute('data-row-key') || null,
  }));
  const cats = faces.filter(f => f.dataset.palFace === 'cat').map(f => ({
    txt: f.textContent.trim().slice(0, 20),
    ad: getComputedStyle(f).animationDelay,
    expanded: f.getAttribute('aria-expanded'),
  }));
  return {
    scope: !!document.querySelector('[data-pal-arrival]'),
    bootSize: faces.length,
    kinds: [...new Set(faces.map(f => f.dataset.palFace))].join(','),
    rows, cats,
    searchBox: !!document.querySelector('input[aria-label="Search job types"]'),
    footerTitle: (document.querySelector('[title*="types shown"]') || {}).title || null,
  };
})()`);
console.log("BOOT:", JSON.stringify(boot, null, 1));

/* type the search word — the diag's probe word */
const WORD = "topaz";
const typeIntoSearch = async () => {
  for (let a = 0; a < 4; a++) {
    try {
      const snap = sh("agent-browser snapshot -i 2>/dev/null");
      const line = snap.split("\n").find((l) => l.includes("Search job types"));
      const m = line && line.match(/ref=(e\d+)/);
      if (m) { sh(`agent-browser type @${m[1]} ${WORD} >/dev/null 2>&1`); return "typed"; }
    } catch { /* */ }
    await sleep(500);
  }
  return "no-ref";
};
console.log("== search:", WORD, "==");
const t1 = await typeIntoSearch();
await sleep(900);
console.log("type:", t1);
const searched = await readJson(`(() => {
  const faces = [...document.querySelectorAll('[data-pal-arrival] [data-pal-face]')];
  const rows = faces.filter(f => f.dataset.palFace === 'row').map(f => ({
    txt: f.textContent.trim().slice(0, 22),
    ad: getComputedStyle(f).animationDelay,
    an: getComputedStyle(f).animationName,
  }));
  const cats = [...document.querySelectorAll('[data-pal-arrival] [data-pal-face="cat"]')].map(f => ({
    txt: f.textContent.trim().slice(0, 16),
    expanded: f.getAttribute('aria-expanded'),
  }));
  const search = document.querySelector('input[aria-label="Search job types"]');
  return {
    faceCount: faces.length,
    rows, cats,
    footerTitle: (document.querySelector('[title*="types shown"]') || {}).title || null,
    searchValue: search ? search.value : null,
    searchAnim: search ? getComputedStyle(search).animationName : null,
  };
})()`);
console.log("SEARCHED:", JSON.stringify(searched, null, 1));

/* clear via the X verb, then re-type the same word (frozen replay) */
console.log("== clear ==");
const clearClick = clickRef("Clear", "- button ");
if (clearClick === "no-ref") {
  /* the search box's X verb — try the input's own clear button */
  try { sh(`agent-browser snapshot -i 2>/dev/null | grep -iE "clear|\\\\bx\\\\b" | head -3`); } catch { /* */ }
}
await sleep(700);
const cleared = await readJson(`(() => {
  const faces = [...document.querySelectorAll('[data-pal-arrival] [data-pal-face]')];
  const search = document.querySelector('input[aria-label="Search job types"]');
  return { faceCount: faces.length, searchValue: search ? search.value : null, footerTitle: (document.querySelector('[title*="types shown"]') || {}).title || null };
})()`);
console.log("CLEARED:", JSON.stringify(cleared));

console.log("== re-search (frozen replay?) ==");
const t2 = await typeIntoSearch();
await sleep(900);
console.log("re-type:", t2);
const researched = await readJson(`(() => {
  const rows = [...document.querySelectorAll('[data-pal-arrival] [data-pal-face="row"]')].map(f => ({
    txt: f.textContent.trim().slice(0, 22),
    ad: getComputedStyle(f).animationDelay,
  }));
  return { rows };
})()`);
console.log("RESEARCHED:", JSON.stringify(researched, null, 1));

/* teardown: leave the world as found */
try { sh("agent-browser close >/dev/null 2>&1"); } catch { /* */ }
try { sh(`pkill -f remote-debugging-port=${CDP_PORT}`); } catch { /* */ }
rmSync(PROFILE, { recursive: true, force: true });
console.log("== diag done, chrome reaped ==");
