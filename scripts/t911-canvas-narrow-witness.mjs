#!/usr/bin/env node
/**
 * t911 — the CANVAS NARROW WITNESS: the strip's wrap face and the canvas's
 * reachability kit, behaviorally, at the two narrow bands — each band its
 * OWN ride (the viewport-reload law: a page born AT the band, never
 * danced across bands).
 *
 * The laws this witness pins (the unit t911 pins their sources):
 *   W-settle  the entry animation must settle before any measure — the
 *             window's lesson: a census 5s after a reload measures cards
 *             mid-flight (the desktop probe's 649-784px ghost centers)
 *   W-strip   the strip's every button inside the section at 375 AND 320
 *             (the wrap law's face — Redo/History/Auto-arrange/bookmarks
 *             used to clip out of reach here)
 *   W-zoom    zoom-out works and zoom-in restores 100% (the reverse verb)
 *   W-entry   at least one card own-clean in the fresh viewport (the
 *             pipeline head — the reach's entry)
 *   W-minimap display:none below lg (the designed pair, not death)
 *   W-deck    the witness deck's face is ALWAYS a card (paint-order
 *             honesty) and the top of the stack is own-clean
 *   W-pan     a pan on a LIVE-picked empty point moves the layer 1:1 and
 *             the reverse pan restores the transform (±2px)
 *   W-world   GET /api/jobs x/y before and after — byte-equal (the P3
 *             law this window's own stray drag earned the hard way)
 *   W-inspect the entry card's click opens the inspector (the end-to-end
 *             reach), Escape closes it
 *
 * Read-only EXCEPT pan/zoom/click verbs, each restored by its own reverse;
 * the world guard proves the ride wrote nothing.
 *
 * Usage: node scripts/t911-canvas-narrow-witness.mjs  (dev server :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t911-canvas-narrow-witness.json";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000, cwd: ROOT }).trim();
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};
const realClick = async (findExpr) => {
  // vis AND own at click time, scrollIntoView-first centering (the t910 walk)
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); const vis = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(cx, cy); const own = !!hit && !!el.contains(hit); return JSON.stringify({ vis, own, x: cx, y: cy }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.vis && pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};

/* the world guard — the API is the truth (never a bare client) */
const worldPositions = async () => {
  const res = await fetch(`${BASE}/api/jobs`, { headers: { Origin: BASE } });
  const data = await res.json();
  const jobs = data.jobs || data;
  return jobs.map((j) => `${j.id}:${j.x}:${j.y}`).sort().join("|");
};

/* the own-census: cards whose button center lies in the viewport and is
   hit-clean. The settle gate runs it twice and demands agreement. */
const OWN_CENSUS = `(() => { let okc = 0, inVp = 0; for (const c of document.querySelectorAll('[data-job]')) { const btn = c.querySelector('[role="button"][tabindex]'); if (!btn) continue; const br = btn.getBoundingClientRect(); if (br.width === 0) continue; const cx = Math.round(br.x + br.width / 2), cy = Math.round(br.y + br.height / 2); if (cx < 0 || cx >= window.innerWidth || cy < 0 || cy >= window.innerHeight) continue; inVp++; const hit = document.elementFromPoint(cx, cy); if (hit && btn.contains(hit)) okc++; } return JSON.stringify({ okc, inVp }); })()`;
const ownCensus = () => evalJson(OWN_CENSUS);

const settle = async () => {
  for (let i = 0; i < 10; i++) {
    const a = ownCensus();
    await sleep(2500);
    const b = ownCensus();
    if (a && b && a.okc === b.okc && a.inVp === b.inVp && b.inVp > 0) return { settled: true, census: b };
    // else: the poll/animation is still moving the deck — keep waiting
  }
  return { settled: false, census: ownCensus() };
};

/* the strip's face: every visible button inside the section's rect */
const STRIP_FACE = `(() => { const sec = document.querySelector('section.canvas-grid'); if (!sec) return null; const zc = document.querySelector('[data-canvas-ui="zoom-controls"]'); if (!zc) return null; const sr = sec.getBoundingClientRect(); const zr = zc.getBoundingClientRect(); const btns = [...zc.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0); const out = btns.filter(b => { const r = b.getBoundingClientRect(); return r.left >= sr.left - 1 && r.right <= sr.right + 1 && r.bottom <= sr.bottom + 1; }); return JSON.stringify({ secW: Math.round(sr.width), stripW: Math.round(zr.width), stripH: Math.round(zr.height), stripRight: Math.round(zr.right), secRight: Math.round(sr.right), btns: btns.length, inside: out.length, wrapped: zr.height > 60 }); })()`;

/* the layer transform */
const TF = `(() => { const sec = document.querySelector('section.canvas-grid'); const inner = sec ? sec.querySelector(':scope > div') : null; return inner ? getComputedStyle(inner).transform : null; })()`;
const tfParse = (tf) => {
  const m = /matrix\(([^)]+)\)/.exec(tf || "");
  if (!m) return null;
  const p = m[1].split(",").map(Number);
  return { a: p[0], e: p[4], f: p[5] };
};

/* the zoom readout: the % span inside the strip */
const ZOOM_READ = `(() => { const zc = document.querySelector('[data-canvas-ui="zoom-controls"]'); if (!zc) return null; const span = [...zc.querySelectorAll('span')].find(s => /^\\d+%$/.test((s.textContent || '').trim())); return span ? span.textContent.trim() : null; })()`;

/* a LIVE-picked empty point: scan candidate points, demand elementFromPoint
   lands on the section itself (the pan gate's own law, enforced at pick time) */
const PICK_EMPTY = `(() => { const sec = document.querySelector('section.canvas-grid'); if (!sec) return null; const sr = sec.getBoundingClientRect(); const pts = []; for (let y = Math.round(sr.top) + 60; y < Math.min(sr.bottom, window.innerHeight) - 90; y += 40) for (let x = Math.round(sr.left) + 14; x < Math.min(sr.right, window.innerWidth) - 14; x += 34) pts.push({ x, y }); for (const p of pts) { const h = document.elementFromPoint(p.x, p.y); if (h && h === sec) return JSON.stringify(p); } return null; })()`;

let browserUp = false;
const verdicts = {};
let worldBefore = null;
let tfFresh = null;
try {
  worldBefore = await worldPositions();
  sh(`${AB} open about:blank`);
  browserUp = true;

  for (const band of [375, 320]) {
    console.log(`\n== ride ${band} (born at the band) ==`);
    sh(`${AB} set viewport ${band} 800`);
    sh(`${AB} open ${BASE}/`);
    await sleep(3000);
    const st = await settle();
    verdicts[`settle${band}`] = st.settled;
    ok(`W-settle ${band}: the census agrees twice (the animation settled)`, st.settled === true, `own=${st.census?.okc} inVp=${st.census?.inVp}`);
    if (!tfFresh) tfFresh = await evalJson(TF);

    const face = await evalJson(STRIP_FACE);
    ok(`W-strip ${band}: every strip button inside the section (the wrap law's face)`, !!face && face.btns > 0 && face.inside === face.btns, `${face?.inside}/${face?.btns} strip ${face?.stripW}x${face?.stripH} sec ${face?.secW}`);
    ok(`W-strip ${band}: the strip's right edge keeps the gutter (no clip)`, !!face && face.stripRight <= face.secRight - 8, `right=${face?.stripRight} ≤ ${face ? face.secRight - 8 : "?"}`);

    const z0 = await evalJson(ZOOM_READ);
    sh(`${AB} click "button[aria-label='Zoom out']"`);
    await sleep(900);
    const z1 = await evalJson(ZOOM_READ);
    const tf1 = tfParse(await evalJson(TF));
    ok(`W-zoom ${band}: zoom-out answers (the readout moves, scale < 1)`, z0 !== z1 && !!tf1 && tf1.a < 1, `${z0} → ${z1} a=${tf1?.a}`);
    const steps = 1;
    for (let i = 0; i < steps; i++) { sh(`${AB} click "button[aria-label='Zoom in']"`); await sleep(700); }
    const z2 = await evalJson(ZOOM_READ);
    ok(`W-zoom ${band}: zoom-in restores (the reverse verb)`, z2 === z0, `${z1} → ${z2}`);

    const own = await evalJson(OWN_CENSUS);
    ok(`W-entry ${band}: a fresh card own-clean in the viewport (the reach's entry)`, !!own && own.okc >= 1, `own=${own?.okc}/${own?.inVp}`);

    const mm = await evalJson(`(() => { const m = document.querySelector('[data-canvas-ui="minimap"]'); return m ? getComputedStyle(m).display : 'absent'; })()`);
    ok(`W-minimap ${band}: the map display:none below lg (the designed pair)`, mm === "none", mm);

    if (band === 320) {
      /* the deck's face */
      const deck = await evalJson(`(() => { const cards = [...document.querySelectorAll('[data-job]')].map(c => ({ c, r: c.getBoundingClientRect() })); const dense = cards.filter(x => x.r.width > 0 && x.r.left > -240 && x.r.left < window.innerWidth); let best = null; for (const x of dense) { for (const y of dense) { if (x === y) continue; const ox = Math.min(x.r.right, y.r.right) - Math.max(x.r.left, y.r.left); const oy = Math.min(x.r.bottom, y.r.bottom) - Math.max(x.r.top, y.r.top); if (ox > x.r.width * 0.4 && oy > x.r.height * 0.5) { const cx = Math.round(Math.max(x.r.left, y.r.left) + ox / 2), cy = Math.round(Math.max(x.r.top, y.r.top) + oy / 2); if (cx > 0 && cx < window.innerWidth && cy > 0 && cy < window.innerHeight) { const h = document.elementFromPoint(cx, cy); const job = h && h.closest ? h.closest('[data-job]') : null; if (job) best = { cx, cy, top: job.getAttribute('data-job').slice(-4) }; } } } } return best ? JSON.stringify(best) : null; })()`);
      ok("W-deck: the stack's face is a card (paint-order honesty)", !!deck, deck ? `top=${deck.top}` : "no overlap pair in view");
      if (deck) {
        const topOwn = evalJson(`(() => { const c = [...document.querySelectorAll('[data-job]')].find(x => x.getAttribute('data-job').endsWith('${deck.top}')); if (!c) return null; const btn = c.querySelector('[role="button"][tabindex]'); const br = btn.getBoundingClientRect(); const cx = Math.round(br.x + br.width / 2), cy = Math.round(br.y + br.height / 2); if (cx < 0 || cx >= window.innerWidth || cy < 0 || cy >= window.innerHeight) return JSON.stringify({ inVp: false }); const hit = document.elementFromPoint(cx, cy); return JSON.stringify({ inVp: true, own: !!hit && !!btn.contains(hit) }); })()`);
        ok("W-deck: the top of the stack is own-clean (clickable face)", !!topOwn && topOwn.inVp === true && topOwn.own === true, topOwn ? JSON.stringify(topOwn) : "top card not found");
      }

      /* the pan ride — LIVE-picked empty point, 1:1 law, reverse restore */
      const tfPre = tfParse(await evalJson(TF));
      const p = await evalJson(PICK_EMPTY);
      ok("W-pan: an empty point exists (the LIVE-picked down-point)", !!p, p ? `@${p.x},${p.y}` : "none");
      if (p && tfPre) {
        sh(`${AB} mouse move ${p.x} ${p.y}`);
        sh(`${AB} mouse down`);
        sh(`${AB} mouse move ${p.x + 120} ${p.y + 60}`);
        sh(`${AB} mouse up`);
        await sleep(700);
        const tfMid = tfParse(await evalJson(TF));
        ok("W-pan: the layer moves 1:1 with the drag (±2px)", !!tfMid && Math.abs(tfMid.e - (tfPre.e + 120)) <= 2 && Math.abs(tfMid.f - (tfPre.f + 60)) <= 2, `Δe=${tfMid ? Math.round(tfMid.e - tfPre.e) : "?"} Δf=${tfMid ? Math.round(tfMid.f - tfPre.f) : "?"}`);
        sh(`${AB} mouse move ${p.x + 120} ${p.y + 60}`);
        sh(`${AB} mouse down`);
        sh(`${AB} mouse move ${p.x} ${p.y}`);
        sh(`${AB} mouse up`);
        await sleep(700);
        const tfPost = tfParse(await evalJson(TF));
        ok("W-pan: the reverse pan restores the transform (±2px)", !!tfPost && Math.abs(tfPost.e - tfPre.e) <= 2 && Math.abs(tfPost.f - tfPre.f) <= 2, `e=${tfPost?.e} vs ${tfPre?.e}`);
      }

      /* the inspector end-to-end */
      const opened = await openInspectorAt();
      ok("W-inspect: the entry card's click opens the inspector (the end-to-end reach)", !!opened, opened ? String(opened).split("/").pop() : "none");
      try { sh(`${AB} press Escape`); } catch {}
      await sleep(600);
    }
  }
} catch (e) {
  fail++;
  console.log(`  ✗ the ride threw: ${e.message?.slice(0, 200)}`);
} finally {
  if (browserUp) {
    try { sh(`${AB} press Escape`); } catch {}
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(400);
    try { sh(`${AB} close`); browserUp = false; } catch {}
  }
  let worldAfter = null;
  try { worldAfter = await worldPositions(); } catch {}
  const worldSame = worldBefore !== null && worldAfter !== null && worldBefore === worldAfter;
  ok("W-world: the API's x/y byte-equal before and after (the ride wrote nothing)", worldSame);
}

/* open the inspector from the entry card: click ANY own-clean card's button
   (the t910 walk — vis AND own at click time), then read the dialog */
async function openInspectorAt() {
  for (let round = 0; round < 6; round++) {
    const cands = evalJson(`(() => { const out = []; for (const card of document.querySelectorAll('[data-job]')) { const btn = card.querySelector('[role="button"][tabindex]'); if (!btn) continue; const r = btn.getBoundingClientRect(); if (r.width === 0) continue; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); if (cx < 0 || cx >= window.innerWidth || cy < 0 || cy >= window.innerHeight) continue; const hit = document.elementFromPoint(cx, cy); if (hit && btn.contains(hit)) out.push({ cx, cy }); } return JSON.stringify(out.slice(0, 3)); })()`);
    if (!Array.isArray(cands) || cands.length === 0) { await sleep(1200); continue; }
    const pick = cands[round % cands.length];
    sh(`${AB} mouse move ${pick.cx} ${pick.cy}`);
    sh(`${AB} mouse down`);
    sh(`${AB} mouse up`);
    await sleep(2400);
    const dlg = evalJson(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return null; const wd = [...d.querySelectorAll('span,code,div')].find(e => /data\\/relion\\/.+topazdenoise_|Motion Correction|Import Movies/.test(e.textContent || '') && (e.textContent || '').length < 200); return JSON.stringify({ open: true, head: wd ? wd.textContent.trim().slice(0, 40) : '' }); })()`);
    if (dlg && dlg.open) return `dialog:${dlg.head}`;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(800);
  }
  return null;
}

const receipt = { instrument: "t911-canvas-narrow-witness", verdicts, pass, fail, at: new Date().toISOString() };
try { writeFileSync(`${ROOT}/${RECEIPT}`, JSON.stringify(receipt, null, 2)); } catch (e) {
  console.log(`  ✗ the receipt could not be written: ${e.message}`);
  fail++;
}
console.log(`\nCANVAS-NARROW-WITNESS t911: ${pass}/${pass + fail} ${fail === 0 ? "green — the narrow canvas reaches everything" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
