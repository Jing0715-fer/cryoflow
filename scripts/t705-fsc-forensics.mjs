#!/usr/bin/env node
// t705-fsc-forensics.mjs — WHY doesn't the FSC section render for qa50?
//
// The suite's own flow (seed → open → poll-click card → Results tab → probe)
// ends NO-CHART while the API serves 40 shells and the chart code is byte-
// identical between src and the frozen bundle (zero commits since the build).
// This forensic replicates the suite EXACTLY and instruments every hop:
//   1. fresh browser, dashboard
//   2. poll-click the refine card — WITH IDENTITY VERIFICATION (which
//      inspector actually opened? the earlier manual repro clicked the
//      reported coords and Topaz Train's inspector came out)
//   3. Results tab, then every 2s: sections + inspector heading
//   4. the fsc API fetched from INSIDE the page (same-origin, browser eyes)
//   5. the full job-card rect map — do dashboard cards overlap?
// Read-only on the world; the seed it writes is qa50's own (cleaned after).

import { execSync } from "node:child_process";

const AB = "agent-browser";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleepS = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => { const raw = evalJs(expr); return JSON.parse(JSON.parse(raw)); };

const realClick = async (findExpr) => {
  let coords = null;
  try {
    coords = evalJs(`(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
  } catch { return "NO-ELEMENT"; }
  if (!coords || coords === "null") return "NO-ELEMENT";
  let c = null;
  try { c = JSON.parse(coords); } catch { return "PARSE:" + coords.slice(0, 80); }
  if (!c || typeof c.x !== "number" || typeof c.y !== "number") return "BAD:" + coords.slice(0, 80);
  sh(`${AB} mouse move ${c.x} ${c.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${c.x},${c.y}`;
};

(async () => {
  console.log("== 0. fresh browser (t524 remedy: retry until the page sticks) ==");
  for (let i = 0; i < 6; i++) {
    try { sh(`${AB} close`); } catch {}
    sh(`${AB} open http://localhost:3000`);
    await sleepS(5000);
    const url = (() => { try { return unq(evalJs(`location.href`)); } catch { return "EVAL-DEAD"; } })();
    console.log(`  attempt ${i}: ${url}`);
    if (url.startsWith("http://localhost:3000")) break;
  }

  console.log("== 1. seed (qa50's own seeder) ==");
  console.log(sh(`python3 /home/z/my-project/scripts/qa50-seed-fsc.py 2>&1 | tail -1`));

  console.log("== 2. poll-click the refine card ==");
  let node = "";
  for (let i = 0; i < 15 && !node.includes("clicked@"); i++) {
    node = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D auto-refine') && (x.textContent||'').includes('completed'))`,
    );
    if (!node.includes("clicked@")) await sleepS(2000);
  }
  console.log("  card:", node);
  await sleepS(2500);

  console.log("== 3. WHICH inspector opened? ==");
  const identity = J(`(() => JSON.stringify({
    headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent.trim()).slice(0, 6),
    hasDialog: !!document.querySelector('[role=dialog]')
  }))()`);
  console.log("  identity:", JSON.stringify(identity));

  console.log("== 4. Results tab ==");
  const tab = await realClick(
    `[...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim().includes('Results'))`,
  );
  console.log("  tab:", tab);
  await sleepS(2500);

  console.log("== 5. 20s watch: sections + in-page fsc fetch ==");
  for (let i = 0; i < 10; i++) {
    const st = J(`(async () => {
      const secs = [...document.querySelectorAll('section')].map(s => s.getAttribute('aria-label')).filter(Boolean);
      const fscSec = document.querySelector('section[aria-label="Fourier-shell correlation"]');
      const r = await fetch('/api/jobs/cmuwipe635000refine3d/fsc');
      const body = await r.json().catch(() => ({ parseFail: true }));
      return JSON.stringify({
        t: ${i},
        nSec: secs.length,
        secs: secs.slice(0, 10),
        fscPresent: !!fscSec,
        api: { status: r.status, source: body.source, nShells: (body.shells || []).length, res143: body.resolutionAt143 }
      });
    })()`);
    console.log("  ", JSON.stringify(st));
    if (st.fscPresent) break;
    await sleepS(2000);
  }

  console.log("== 6. dashboard job-card rect map (overlap hunt) ==");
  // back to dashboard first
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
  await sleepS(3000);
  const rects = J(`(() => JSON.stringify(
    [...document.querySelectorAll('[role=button]')]
      .map(b => { const t = (b.textContent||'').trim().slice(0, 30); const r = b.getBoundingClientRect(); return { t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })
      .filter(c => c.w > 0 && /import|motioncorr|CTF|pick|extract|class|refine|post|Topaz|Initial|Mask/i.test(c.t))
      .slice(0, 30)
  ))()`);
  for (const c of rects) console.log("  ", JSON.stringify(c));
  // overlap pairs
  for (let a = 0; a < rects.length; a++) {
    for (let b = a + 1; b < rects.length; b++) {
      const A = rects[a], B = rects[b];
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      if (ox > 4 && oy > 4) console.log(`  OVERLAP: [${A.t}] × [${B.t}] ${Math.round(ox)}x${Math.round(oy)}px`);
    }
  }
  console.log("== done ==");
})().catch((e) => { console.error("FATAL:", e.message); try { sh(`${AB} close`); } catch {} process.exit(1); });
