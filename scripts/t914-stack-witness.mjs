#!/usr/bin/env node
/**
 * t914 — the quick-keymap's rich row, WITNESSED LIVE (the browser face of
 * the stack-bearing door).
 *
 * The API witness (t914-import-visibility-witness) proved the listing now
 * carries the imported stacks with their header nz. THIS instrument rides
 * the UI end-to-end: canvas → the mint import job's inspector → the
 * Results tab → the Maps & images gallery → the quick-look dialog on a
 * multi-image .mrcs → the rich keymap row (←/→ "step the slice") that the
 * world could never show before.
 *
 * Faces:
 *   K (wide 1280, the 4-frame stack)  the rich row LIVES:
 *     K1  the quick-keymap row carries the slice chips (two Kbd + "step
 *         the slice") — the row the must-not-lie law gated on slices>1
 *     K2  the Esc chip beside it ("closes")
 *     K3  the slice readout reads "slice 1 of 4" (the cursor's voice)
 *     K4  ArrowRight STEPS the slice → "slice 2 of 4" — the taught key
 *         WORKS; a keymap for a dead key would be the lie the family forbids
 *     K5  ArrowLeft steps back → "slice 1 of 4"
 *     K6  prev/next buttons + the range input present
 *     K7  BOTH images render (the montage + the slice view, naturalWidth>0)
 *     K8  no horizontal overflow on the dialog
 *   M (wide, the 1-frame stack)  the must-not-lie face:
 *     M1  the keymap shows ONLY the Esc chip — no "step the slice" for a
 *         key that cannot step (a 1-frame stack is a single image)
 *     M2  the cursor is honest about its deadness: readout "slice 1 of 1",
 *         prev/next disabled, range max=0
 *     M3  the slice view renders
 *     M4  no horizontal overflow
 *   N (narrow 320, born-at-band, the 4-frame stack):
 *     N1  the rich row present at the narrow door
 *     N2  the keymap row wraps honestly — every child inside its rect
 *         (the t909 door-strip law, the keymap family's seat)
 *     N3  the readout present and ArrowRight still steps
 *     N4  no horizontal overflow
 *
 * RIDE LAWS inherited (each paid for in a previous window):
 *   - born-at-band (t910): `set viewport` RELOADS — each band is its OWN
 *     ride: viewport FIRST, then open, click, measure.
 *   - per-surface presence polls (t912): every surface is polled to ITS
 *     OWN presence before any measure; a sibling's arrival is not a settle.
 *   - click-time vis/own re-probe (t910): scrollIntoView re-anchors, the
 *     hit-test proves the click lands on the element itself.
 *   - read-only world (t491/t910/t911): no PATCH, no pan, no wipe — the
 *     ride measures; the only world change is the mint job the window
 *     created through the real doors (and removes after, by hand).
 *
 *   node scripts/t914-stack-witness.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const MINT_JOB = process.env.T914_JOB_ID ?? "";
const RECEIPT = "shots-qa/t914-stack-witness.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000, cwd: ROOT }).trim();
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
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
  // t914 clamped-point law: a card clipped by a narrow viewport has its
  // CENTER off-screen — the t910 full-containment vis gate can never pass
  // and the ride dies NEVER-VISIBLE on a card that is plainly clickable on
  // its visible part. The honest gate is the own-probe AT THE ACTUAL POINT:
  // aim at the center, clamp into the viewport, then elementFromPoint must
  // still land inside the element — a click that hits a neighbor is refused.
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const cx = Math.max(4, Math.min(window.innerWidth - 4, Math.round(r.x + r.width / 2))); const cy = Math.max(4, Math.min(window.innerHeight - 4, Math.round(r.y + r.height / 2))); const hit = document.elementFromPoint(cx, cy); const own = !!hit && !!el.contains(hit); return JSON.stringify({ own, x: cx, y: cy }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) { return "OFF-VIEWPORT"; }
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};

const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};

// open the mint job's inspector: click the canvas card whose text names it
const openMintInspector = async () => {
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 4);
  // the settle law (t911's entry-animation ghost): the card COUNT arriving
  // is not a settle — the cards fly in on mount. Two consecutive identical
  // own-censuses (name+rect) are the settle; only then may a click land.
  let last = null;
  for (let i = 0; i < 24; i++) {
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job]')].map(c => { const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return (c.getAttribute('data-job') ?? '') + ':' + Math.round(r.x) + ',' + Math.round(r.y); }).sort())`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
  const cardExpr = `[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('t914 stack mint'))?.querySelector('[role="button"][tabindex]')`;
  const clicked = await realClick(cardExpr);
  if (!String(clicked).startsWith("clicked@")) return { clicked };
  // the inspector: a dialog carrying the job's name
  const insp = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('t914 stack mint')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true
  );
  return { clicked, open: insp?.open === true };
};

const openResultsTab = async () => {
  const clicked = await realClick(
    `[...document.querySelectorAll('[role="tab"]')].find(t => /^Results/.test((t.textContent || '').trim()))`
  );
  if (!String(clicked).startsWith("clicked@")) return { clicked };
  const landed = await poll(
    `(() => { const s = document.querySelector('[data-canvas-ui="maps-gallery"]'); return JSON.stringify({ found: !!s }); })()`,
    (v) => v.found === true
  );
  return { clicked, landed: landed?.found === true };
};

// click a gallery tile by stem (the t913 lesson: mrc tiles caption the
// extensionless stem — find by stem, not by name)
const openStackDialog = async (stem) => {
  const tileExpr = `[...document.querySelectorAll('[data-canvas-ui="maps-gallery"] button')].find(b => (b.textContent || '').includes('${stem}'))`;
  const clicked = await realClick(tileExpr);
  if (!String(clicked).startsWith("clicked@")) return { clicked };
  const dlg = await poll(
    `(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; if (!d) return JSON.stringify({ open: false }); const readout = d.querySelector('[data-canvas-ui="stack-slice-readout"]'); return JSON.stringify({ open: true, readout: readout ? readout.textContent.trim() : null }); })()`,
    (v) => v.open === true && !!v.readout
  );
  return { clicked, dialog: dlg };
};

const keymapFace = () =>
  evalJson(`(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; if (!d) return null; const km = d.querySelector('[data-canvas-ui="quick-keymap"]'); if (!km) return JSON.stringify({ km: false }); const kr = km.getBoundingClientRect(); const kids = [...km.children].map(k => { const r = k.getBoundingClientRect(); return r.left >= kr.left - 1 && r.right <= kr.right + 1 && r.height > 0; }); const chips = km.querySelectorAll('kbd').length; const step = (km.textContent || '').includes('step the slice'); const esc = (km.textContent || '').includes('closes'); const overX = d.scrollWidth - d.clientWidth; const imgs = [...d.querySelectorAll('img')].map(i => i.naturalWidth > 0); const prev = d.querySelector('[data-canvas-ui="stack-slice-prev"]'); const next = d.querySelector('[data-canvas-ui="stack-slice-next"]'); const range = d.querySelector('[data-canvas-ui="stack-slice-range"]'); const readout = d.querySelector('[data-canvas-ui="stack-slice-readout"]'); return JSON.stringify({ km: true, chips, step, esc, kidsIn: kids.filter(Boolean).length, kids: kids.length, overX, imgsOk: imgs.length > 0 && imgs.every(Boolean), imgs: imgs.length, prevDisabled: prev ? prev.disabled : null, nextDisabled: next ? next.disabled : null, rangeMax: range ? Number(range.max) : null, readout: readout ? readout.textContent.trim() : null }); })()`);

let browserUp = false;
try {
  sh(`${AB} open about:blank`);
  browserUp = true;

  /* ---------- ride 1 — wide 1280, the rich row LIVES ---------- */
  sh(`${AB} set viewport 1280 800`);
  const o1 = await openMintInspector();
  ok("W1 the mint inspector opened on the wide canvas", o1.open === true, JSON.stringify(o1.clicked ?? o1));
  if (o1.open) {
    const r1 = await openResultsTab();
    ok("W2 the Results tab landed (the maps gallery polled to presence)", r1.landed === true);
    if (r1.landed) {
      const s4 = await openStackDialog("FoilHole_217_35");
      ok("W3 the 4-frame stack dialog opened with its cursor voice", !!s4.dialog, JSON.stringify(s4.clicked ?? s4));
      if (s4.dialog) {
        const f = await poll(`keymapFace()`.replace("keymapFace()", `(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; if (!d) return null; const km = d.querySelector('[data-canvas-ui="quick-keymap"]'); if (!km) return JSON.stringify({ km: false }); return JSON.stringify({ km: true, step: (km.textContent || '').includes('step the slice'), chips: km.querySelectorAll('kbd').length }); })()`), (v) => v?.km === true);
        ok("W4 the keymap row polled to presence", !!f && f.km === true);
        const face = keymapFace();
        ok("K1 the rich row speaks — slice chips + 'step the slice'", face?.km === true && face.step === true && face.chips >= 3, `chips=${face?.chips}`);
        ok("K2 the Esc chip beside it", face?.esc === true);
        ok("K3 the readout reads slice 1 of 4", face?.readout === "slice 1 of 4", face?.readout ?? "none");
        sh(`${AB} press ArrowRight`);
        await sleep(400);
        const afterR = keymapFace();
        ok("K4 ArrowRight STEPS the slice → slice 2 of 4", afterR?.readout === "slice 2 of 4", afterR?.readout ?? "none");
        sh(`${AB} press ArrowLeft`);
        await sleep(400);
        const afterL = keymapFace();
        ok("K5 ArrowLeft steps back → slice 1 of 4", afterL?.readout === "slice 1 of 4", afterL?.readout ?? "none");
        ok("K6 the cursor present with its honest edge state (at slice 1: prev disabled, next armed, max=3)", face?.prevDisabled === true && face?.nextDisabled === false && face?.rangeMax === 3, `prev=${face?.prevDisabled} next=${face?.nextDisabled} max=${face?.rangeMax}`);
        const imgs = await poll(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][1]; if (!d) return null; const imgs = [...d.querySelectorAll('img')]; return JSON.stringify({ n: imgs.length, ok: imgs.every(i => i.naturalWidth > 0) }); })()`, (v) => v?.n >= 2);
        ok("K7 both images render (montage + slice view)", !!imgs && imgs.ok === true && imgs.n >= 2, `n=${imgs?.n}`);
        ok("K8 no horizontal overflow on the dialog", (face?.overX ?? 99) <= 1, `overX=${face?.overX}`);
        sh(`${AB} press Escape`);
        await sleep(700);

        /* ---------- the must-not-lie face: the 1-frame stack ---------- */
        const s1 = await openStackDialog("FoilHole_219_20");
        ok("W5 the 1-frame stack dialog opened", !!s1.dialog, JSON.stringify(s1.clicked ?? s1));
        if (s1.dialog) {
          const m = keymapFace();
          ok("M1 the keymap teaches ONLY Esc — no dead step chips", m?.km === true && m.esc === true && m.step === false, `step=${m?.step} chips=${m?.chips}`);
          ok("M2 the cursor is honest about its deadness (slice 1 of 1, prev/next disabled, max=0)", m?.readout === "slice 1 of 1" && m?.prevDisabled === true && m?.nextDisabled === true && m?.rangeMax === 0, `readout=${m?.readout} prev=${m?.prevDisabled} next=${m?.nextDisabled} max=${m?.rangeMax}`);
          const img1 = await poll(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][1]; if (!d) return null; const imgs = [...d.querySelectorAll('img')]; return JSON.stringify({ n: imgs.length, ok: imgs.every(i => i.naturalWidth > 0) }); })()`, (v) => v?.n >= 1);
          ok("M3 the slice view renders", !!img1 && img1.ok === true, `n=${img1?.n}`);
          ok("M4 no horizontal overflow", (m?.overX ?? 99) <= 1, `overX=${m?.overX}`);
          sh(`${AB} press Escape`);
          await sleep(600);
        }
      }
    }
  }
  try { sh(`${AB} press Escape`); } catch {}

  /* ---------- ride 2 — narrow 320, born-at-band ---------- */
  sh(`${AB} set viewport 320 800`);
  const o2 = await openMintInspector();
  ok("N0 the mint inspector opened at 320 (born-at-band)", o2.open === true, JSON.stringify(o2.clicked ?? o2));
  if (o2.open) {
    const r2 = await openResultsTab();
    ok("N0a the Results tab landed at 320", r2.landed === true);
    if (r2.landed) {
      const s4n = await openStackDialog("FoilHole_217_35");
      ok("N0b the 4-frame stack dialog opened at 320", !!s4n.dialog, JSON.stringify(s4n.clicked ?? s4n));
      if (s4n.dialog) {
        const face = await poll(`(() => { const dl = [...document.querySelectorAll('[role="dialog"]')]; const d = dl.length > 1 ? dl[1] : null; if (!d) return null; const km = d.querySelector('[data-canvas-ui="quick-keymap"]'); if (!km) return null; const kr = km.getBoundingClientRect(); const kids = [...km.children].map(k => { const r = k.getBoundingClientRect(); return r.left >= kr.left - 1 && r.right <= kr.right + 1 && r.height > 0; }); const readout = d.querySelector('[data-canvas-ui="stack-slice-readout"]'); return JSON.stringify({ step: (km.textContent || '').includes('step the slice'), kidsIn: kids.filter(Boolean).length, kids: kids.length, readout: readout ? readout.textContent.trim() : null, overX: d.scrollWidth - d.clientWidth }); })()`, (v) => v?.step === true);
        ok("N1 the rich row present at the narrow door", face?.step === true);
        ok("N2 the keymap row wraps honestly — every child in-rect", face?.kidsIn === face?.kids, `${face?.kidsIn}/${face?.kids}`);
        ok("N3 the readout present", !!face?.readout, face?.readout ?? "");
        sh(`${AB} press ArrowRight`);
        await sleep(400);
        const stepped = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][1]; const r = d?.querySelector('[data-canvas-ui="stack-slice-readout"]'); return JSON.stringify({ readout: r ? r.textContent.trim() : null }); })()`);
        ok("N4 ArrowRight still steps at 320 → slice 2 of 4", stepped?.readout === "slice 2 of 4", stepped?.readout ?? "none");
        const over = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][1]; return JSON.stringify({ overX: d ? d.scrollWidth - d.clientWidth : null }); })()`);
        ok("N5 no horizontal overflow at 320", (over?.overX ?? 99) <= 1, `overX=${over?.overX}`);
      }
    }
  }
} catch (e) {
  fail++;
  console.error("witness crashed:", String(e).slice(0, 300));
} finally {
  if (browserUp) {
    try { sh(`${AB} close`); } catch {}
  }
}

const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\nverdict: ${verdict}  (${pass} ok, ${fail} fail)`);
try {
  writeFileSync(RECEIPT, JSON.stringify({ witness: "t914-stack-witness", verdict, pass, fail, at: new Date().toISOString(), mintJob: MINT_JOB }, null, 2) + "\n");
  console.log(`receipt: ${RECEIPT}`);
} catch {}
process.exit(fail === 0 ? 0 : 1);
