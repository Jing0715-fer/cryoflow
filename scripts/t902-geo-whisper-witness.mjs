#!/usr/bin/env node
/**
 * t902 — the assistant geometry whisper's LIVE witness (the fourth
 * seat's browser leg; the unit t902-geo-restore-unit owns the
 * arithmetic, this leg owns the DOM).
 *
 * The persisted window geometry can come back EDITED (a shrunken
 * viewport clamps it) and the edit is invisible — the panel whispers
 * the edit once (the t899 grammar's fourth seat, the house mono
 * fuchsia) and goes silent at the user's first gesture. This witness
 * seeds an OVERSIZE geometry (w=4000 h=3000 at x=5000 y=5000 — far
 * past any viewport), opens the panel, and rides the laws:
 *   P1  the geometry bucket's pre-state recorded (raw bytes or MISSING)
 *   P2  the seeded oversize shape readable
 *   W1  the panel window opened ([data-ai-assistant])
 *   W2  the whisper BORN (testid assistant-geo-whisper)
 *   W3  the whisper's text is the exact one-line clause (the panel's
 *       Chinese voice, size before position)
 *   W4  the whisper speaks the house voice (font-mono + fuchsia)
 *   W5  the window's shape is the CLAMPED one (the edit's consequence
 *       visible in the DOM: width 1584 at the 1600 viewport)
 *   D1  the user's first gesture (a header drag) DISARMS the whisper
 *   D2  the pointerup echo rewrote the bucket (the t638 law live)
 *   D3  a second drag keeps the silence (no rebirth)
 *   R1  the bucket restored byte-for-byte (or re-absent)
 *
 * Receipt: shots-qa/t902-geo-whisper-witness.json.
 *
 *   node scripts/t902-geo-whisper-witness.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t902-geo-whisper-witness.json";
const GEO_KEY = "cryoflow.assistant.geometry.v1";
const OVERSIZE = { x: 5000, y: 5000, w: 4000, h: 3000 };

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) =>
  execSync(cmd, { encoding: "utf8", timeout: 120_000, cwd: ROOT }).trim();
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, {
    encoding: "utf8",
    timeout: 120_000,
    input: expr,
  }).trim();
const evalJson = (expr) => {
  const out = evalJs(expr);
  try {
    const once = JSON.parse(out);
    if (typeof once === "string") {
      try {
        return JSON.parse(once);
      } catch {
        return once;
      }
    }
    return once;
  } catch {
    return out;
  }
};

/* ------------------------------------------------------------------ */
/* the crash-safe cleanup — registered BEFORE anything touches the world */
/* ------------------------------------------------------------------ */
let bucketPre = null; // the EXACT string stored, or null when the key was absent
let browserUp = false;
let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  console.log("\n  cleanup (crash-safe finally)…");
  // 1. the bucket — restored LIVE while the profile still exists
  if (browserUp) {
    try {
      const expr =
        bucketPre === null
          ? `localStorage.removeItem(${JSON.stringify(GEO_KEY)}); 'removed'`
          : `localStorage.setItem(${JSON.stringify(GEO_KEY)}, ${JSON.stringify(bucketPre)}); 'restored'`;
      evalJs(expr);
      console.log(`  cleanup: bucket ${bucketPre === null ? "re-absent" : "restored byte-for-byte"}`);
    } catch {}
  }
  // 2. the browser — the last resident opened, the first closed
  try {
    if (browserUp) {
      sh(`${AB} close`);
      browserUp = false;
    }
  } catch {}
}
process.on("exit", () => {
  if (browserUp) {
    try {
      execSync(`${AB} close`, { timeout: 30_000 });
    } catch {}
  }
});

console.log("t902 geo-whisper live witness — the oversize memory, the clamp's edit, the whisper, the disarm\n");

/* ------------------------------------------------------------------ */
/* P — the bucket: record pre, seed the oversize memory                */
/* ------------------------------------------------------------------ */
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${BASE}/`);
await sleep(4500);
browserUp = true;
const rawPre = evalJs(`localStorage.getItem(${JSON.stringify(GEO_KEY)})`);
const preMissing = !rawPre || rawPre === "null" || rawPre === undefined;
try {
  bucketPre = preMissing ? null : JSON.parse(rawPre); // the EXACT string stored
  if (typeof bucketPre !== "string") bucketPre = preMissing ? null : rawPre;
} catch {
  bucketPre = preMissing ? null : rawPre;
}
ok("P1 the geometry bucket's pre-state recorded", true, bucketPre === null ? "MISSING (absent key)" : `raw=${String(bucketPre).slice(0, 70)}`);

evalJs(
  `localStorage.setItem(${JSON.stringify(GEO_KEY)}, ${JSON.stringify(JSON.stringify(OVERSIZE))}); 'seeded'`
);
const seededRead = evalJs(`localStorage.getItem(${JSON.stringify(GEO_KEY)})`);
let seededOk = false;
try {
  const once = JSON.parse(seededRead);
  const arr = typeof once === "string" ? JSON.parse(once) : once;
  seededOk = arr && arr.w === OVERSIZE.w && arr.x === OVERSIZE.x;
} catch {}
ok("P2 the seeded oversize shape readable", seededOk);

/* ------------------------------------------------------------------ */
/* W — the whisper's birth (fresh load: the restore rides the boot)    */
/* ------------------------------------------------------------------ */
console.log("\n  the witness leg (the panel's door, the whisper's birth)…");
sh(`${AB} open ${BASE}/`);
await sleep(4500); // fresh load — the boot restore runs with the oversize seed

// the header door opens the panel
const doorClick = await (async () => {
  const locate = `(() => {
    const btn = document.querySelector('button[aria-label="AI assistant"]');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`;
  const pos = evalJson(locate);
  if (!pos) return "NO-ELEMENT";
  sh(`${AB} mouse move ${pos.x} ${pos.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${pos.x},${pos.y}`;
})();
ok("W0 the header's AI door clicked", String(doorClick).startsWith("clicked@"), String(doorClick));
await sleep(2000);

let win = null;
for (let i = 0; i < 8 && !win; i++) {
  await sleep(800);
  win = evalJson(`(() => {
    const w = document.querySelector('[data-ai-assistant]');
    if (!w) return null;
    const whisper = document.querySelector('[data-testid="assistant-geo-whisper"]');
    return JSON.stringify({
      style: w.getAttribute('style') || '',
      whisper: whisper ? whisper.textContent : null,
      whisperClass: whisper ? whisper.className : null,
    });
  })()`);
}
ok("W1 the panel window opened", !!win, win ? "data-ai-assistant present" : "absent");
if (!win) {
  await cleanup();
  process.exit(1);
}

const WHISPER_EXPECT = "记住的窗口没原样回来 — 尺寸被收紧到屏幕内 · 位置被拉回屏幕内";
ok("W2 the whisper BORN", typeof win.whisper === "string" && win.whisper.length > 0, win.whisper ?? "absent");
ok("W3 the whisper's text is the exact one-line clause", win.whisper === WHISPER_EXPECT, `got: ${win.whisper}`);
ok(
  "W4 the whisper speaks the house voice (font-mono + fuchsia, the t899 grammar)",
  typeof win.whisperClass === "string" && win.whisperClass.includes("font-mono") && win.whisperClass.includes("fuchsia"),
  win.whisperClass ?? "no class"
);
const width = win.style.match(/width:\s*(\d+(?:\.\d+)?)px/)?.[1];
ok("W5 the window's shape is the CLAMPED one (width 1584 at 1600)", width === "1584", `width=${width}`);

/* ------------------------------------------------------------------ */
/* D — the disarm: the user's first gesture takes ownership            */
/* ------------------------------------------------------------------ */
// the drag: pointerdown on the header's title area, +30px right, pointerup
const hdr = evalJson(`(() => {
  const w = document.querySelector('[data-ai-assistant]');
  if (!w) return null;
  const title = [...w.querySelectorAll('p')].find(p => p.textContent === 'AI 助手');
  if (!title) return null;
  const r = title.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
})()`);
ok("D0a the drag surface located (the header's title)", !!hdr && !!hdr.x, JSON.stringify(hdr));
if (hdr && hdr.x) {
  sh(`${AB} mouse move ${hdr.x} ${hdr.y}`);
  sh(`${AB} mouse down`);
  // the move: five steps so the pointer stream reads as a drag
  for (let i = 1; i <= 5; i++) sh(`${AB} mouse move ${hdr.x + i * 6} ${hdr.y}`);
  sh(`${AB} mouse up`);
  await sleep(1200);
  const after = evalJson(`(() => {
    const whisper = document.querySelector('[data-testid="assistant-geo-whisper"]');
    return JSON.stringify({
      whisper: whisper ? whisper.textContent : null,
      bucket: localStorage.getItem(${JSON.stringify(GEO_KEY)}),
    });
  })()`);
  ok("D1 the user's first gesture DISARMS the whisper (silence at ownership)", after && after.whisper === null, after?.whisper ?? "whisper absent");
  let bucket = null;
  try {
    const once = JSON.parse(after.bucket);
    bucket = typeof once === "string" ? JSON.parse(once) : once;
  } catch {}
  ok(
    "D2 the pointerup echo rewrote the bucket (the t638 law live)",
    !!bucket && bucket.w === 1584 && Math.abs(bucket.x - (5000 + 30)) > 1000,
    JSON.stringify(bucket)
  );

  // D3 — a second drag keeps the silence (no rebirth)
  sh(`${AB} mouse move ${hdr.x + 30} ${hdr.y}`);
  sh(`${AB} mouse down`);
  for (let i = 1; i <= 5; i++) sh(`${AB} mouse move ${hdr.x + 30 + i * 6} ${hdr.y - 4}`);
  sh(`${AB} mouse up`);
  await sleep(900);
  const again = evalJson(
    `JSON.stringify({ w: !!document.querySelector('[data-testid="assistant-geo-whisper"]') })`
  );
  ok("D3 a second drag keeps the silence (no rebirth)", again && again.w === false, JSON.stringify(again));
}

/* ------------------------------------------------------------------ */
/* R — the restore: bucket byte-for-byte                               */
/* ------------------------------------------------------------------ */
console.log("\n  the restore leg (byte-for-byte)…");
const rExpr =
  bucketPre === null
    ? `localStorage.removeItem(${JSON.stringify(GEO_KEY)}); 'removed'`
    : `localStorage.setItem(${JSON.stringify(GEO_KEY)}, ${JSON.stringify(bucketPre)}); 'restored'`;
evalJs(rExpr);
const rawPost = evalJs(`localStorage.getItem(${JSON.stringify(GEO_KEY)})`);
let r1 = false;
if (bucketPre === null) r1 = !rawPost || rawPost === "null";
else {
  try {
    const once = JSON.parse(rawPost);
    r1 = (typeof once === "string" ? once : rawPost) === bucketPre;
  } catch {
    r1 = rawPost === bucketPre;
  }
}
ok("R1 the bucket restored byte-for-byte (or re-absent)", r1, bucketPre === null ? "was MISSING" : String(bucketPre).slice(0, 50));

await cleanup();

/* ------------------------------------------------------------------ */
/* the receipt                                                         */
/* ------------------------------------------------------------------ */
const verdict = fail === 0 ? "GREEN" : "RED";
const receipt = {
  instrument: "t902-geo-whisper-witness",
  at: new Date().toISOString(),
  seeded: OVERSIZE,
  bucketWasMissing: bucketPre === null,
  pass,
  fail,
  verdict,
};
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nGEO-WHISPER-WITNESS t902: ${pass} passed, ${fail} failed — ${verdict}`);
console.log(`receipt: ${RECEIPT}`);
process.exit(fail === 0 ? 0 : 1);
