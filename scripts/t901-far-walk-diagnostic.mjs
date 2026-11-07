#!/usr/bin/env node
// t901 diagnostic — WHY do the far walks see a dead page? Replays the
// sweep's width journey (the compressed form) and reports, at each step,
// the page's liveness: header present, body children, readyState, and
// the MEASURE guard chain's first failing branch. Read-only, no pins.

import { execSync } from "node:child_process";

const ROOT = process.cwd();
const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });

const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

const STATE =
  "(() => { const hdr = document.querySelector('header'); return JSON.stringify({ ready: document.readyState, hdr: !!hdr, hdrKids: hdr ? hdr.children.length : 0, bodyKids: document.body ? document.body.children.length : 0, url: location.pathname, innerW: window.innerWidth }); })()";

const MEASURE_GUARD =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return 'G0 no header or <2 kids'; const mid = hdr.children[0].children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return 'G1 mid missing or zero-width'; const psWrap = mid.children[1]; const psTrig = psWrap ? psWrap.querySelector('button, [role=combobox]') : null; const chip = hdr.children[1].children[0]; if (!psTrig || !chip || chip.getBoundingClientRect().width <= 0) return 'G2 ps/chip missing'; return 'PASS'; })()";

console.log("t901 far-walk diagnostic — replaying the sweep's width journey\n");

ab("open http://localhost:3000/");
ab("set viewport 1280 800");
ab("wait 900");
console.log("boot 1280:", JSON.stringify(evalJson(STATE)));

// the sweep's zone neighborhood (compressed) + below + bands — the width
// stress that precedes the far walk in the real ride
const journey = [1275, 1280, 1283, 1286, 1287, 1290, 1294, 1366, 1440, 768, 769, 770, 771, 772, 375, 640, 768, 1024, 1280];
for (const w of journey) {
  ab(`set viewport ${w} 800`);
  ab("wait 250");
}
console.log("after zone/below/band journey 1280:", JSON.stringify(evalJson(STATE)));

console.log("\n— the far walk itself —");
for (const w of [1366, 1440, 1536, 1920]) {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  const s = evalJson(STATE);
  const g = evalJson(MEASURE_GUARD);
  console.log(`far ${w}: state=${JSON.stringify(s)} guard=${g}`);
}

ab("set viewport 1280 800");
ab("wait 300");
console.log("\nreturn 1280:", JSON.stringify(evalJson(STATE)));
console.log("\nMEM at exit:", execSync("free -m | sed -n 2p", { encoding: "utf8" }).trim());
