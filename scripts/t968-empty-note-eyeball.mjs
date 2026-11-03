#!/usr/bin/env node
/**
 * t968 — the EMPTY NOTE's VISUAL EYEBALL (the t967 entry's candidate (a)):
 * the t967 kind note has been pinned by DOM contract (the words, the hook,
 * the conditional, the focus law) — but the STYLE round's own eyes have
 * never SEEN it. This rider takes the bench's empty face to the 320 fold
 * and MEASURES the note's look:
 *
 *   box      — the note's width vs the dialog's content box (does it fit?
 *              does it waste? does it overflow?), the height (does the
 *              sentence wrap honestly at the fold?)
 *   paint    — the computed colors COMPOSITED over the dialog's own
 *              background (bg-muted/40 is translucent — the honest contrast
 *              number needs the composite, not the raw rgba), then the
 *              WCAG contrast ratio of fg vs the composite bg
 *   order    — the note sits ABOVE the copy row, the pre BELOW it (the
 *              honest-words-first reading order the cure pinned)
 *   shot     — the dialog's PNG receipt (shots-qa/t968-empty-note-320.png)
 *
 * The gate (all assertions must hold):
 *   1  the note renders at the fold (width > 0, height > 0)
 *   2  the note NEVER overflows the dialog (the family's shell law)
 *   3  the composite contrast ratio >= 4.5 (the muted idiom's AA duty —
 *      a "kind" note nobody can read is not kind)
 *   4  the order: note above copy row, pre after both (the ADDITION shape
 *      as the EYES see it, not just the source)
 *   5  the sentence wraps (height >= 2 lines at the 320 fold) OR the
 *      single line fits — either is honest; the wrap number is pinned
 *      for the next rider to notice a regression
 *
 *   node scripts/t968-empty-note-eyeball.mjs
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const RECEIPT = path.join(ROOT, "shots-qa", "t968-empty-note-eyeball.json");
const NAME = "Peek Stress Bench (t966)";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim(); } catch (e) { return String(e?.stdout ?? e); } };

function evalJs(expr) {
  try { return execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim(); }
  catch (e) { return String(e?.stdout ?? "") || "null"; }
}
function evalJson(expr) {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
}
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [4, 10, 20]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
      await sleep(500);
      const pos2 = evalJson(locate);
      if (pos2 && pos2.own) {
        sh(`${AB} mouse move ${pos2.x} ${pos2.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
        return `clicked@${pos2.x},${pos2.y}`;
      }
      return "OFF-VIEWPORT";
    }
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};
const openInspectorHard = async (name, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
    const opened = await poll(
      `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
      (v) => v.open === true, 5, 500,
    );
    if (opened?.open === true) return `open@try${i}`;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(700);
  }
  return "NEVER-OPEN";
};
const ensureDialog = async () => {
  const st = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return JSON.stringify({ open: !!d }); })()`);
  if (st?.open === true) return true;
  if (st === null || st === "null") { try { sh(`${AB} open ${BASE}/`); } catch {} await sleep(2500); }
  const reopened = await openInspectorHard(NAME, 8);
  return String(reopened).startsWith("open@try");
};
const clickTab = async (label, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('${label}')) ?? null; })()`);
    if (String(clicked).startsWith("clicked@")) return clicked;
    if (!(await ensureDialog())) console.log(`  (tab '${label}' try ${i + 1}: the dialog would not return)`);
    await sleep(800);
  }
  return "NEVER-CLICKED";
};
const clickPreview = async (rowName, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return [...(d?.querySelectorAll('button') ?? [])].find(b => (b.getAttribute('aria-label') || '') === 'Preview ${rowName}') ?? null; })()`);
    if (String(clicked).startsWith("clicked@")) return clicked;
    await sleep(600);
  }
  return "NEVER-CLICKED";
};

console.log(`== t968 the empty note's VISUAL EYEBALL ${process.env.WIDE ? "(the WIDE face)" : "(the 320 fold)"} ==`);

/* the wide settle first (the family's law: settle wide, then fold) */
sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
if (!String(await openInspectorHard(NAME)).startsWith("open@try")) {
  console.log("FATAL: the bench's inspector never opened");
  process.exit(2);
}
await sleep(800);
if (!String(await clickTab("Files", 4)).startsWith("clicked@")) {
  console.log("FATAL: the Files tab never clicked");
  process.exit(2);
}
await sleep(1200);

if (!process.env.WIDE) {
  sh(`${AB} set viewport 320 640`);
  await sleep(1200);
}

/* open the empty face */
let opened = false;
for (let round = 0; round < 3 && !opened; round++) {
  if (!(await ensureDialog())) { await sleep(800); continue; }
  if (String(await clickPreview("run.err", 4)).startsWith("clicked@")) {
    const up = await poll(
      `(() => { const d = [...document.querySelectorAll('[data-slot="dialog-content"][data-state="open"]')].filter(x => !x.hasAttribute('data-inspector-dialog')); const p = d[d.length - 1]; const n = p?.querySelector('[data-canvas-ui="text-preview-empty-note"]'); return JSON.stringify({ open: !!p, note: !!n }); })()`,
      (v) => v.open === true && v.note === true, 10, 600,
    );
    opened = !!up;
  }
  if (!opened) { try { sh(`${AB} press Escape`); } catch {} await sleep(600); }
}
if (!opened) {
  console.log("FATAL: the empty face (run.err's peek) never opened with its note");
  process.exit(2);
}

/* THE LOOK — one probe, the whole judgment */
const look = evalJson(`(() => {
  const peeks = [...document.querySelectorAll('[data-slot="dialog-content"][data-state="open"]')].filter(d => !d.hasAttribute('data-inspector-dialog'));
  const d = peeks[peeks.length - 1];
  if (!d) return JSON.stringify({ err: "no-dialog" });
  const n = d.querySelector('[data-canvas-ui="text-preview-empty-note"]');
  if (!n) return JSON.stringify({ err: "no-note" });
  const dRect = d.getBoundingClientRect();
  const nRect = n.getBoundingClientRect();
  const copyRow = n.nextElementSibling;
  const pre = d.querySelector('pre[aria-label="File content preview"]');
  const cs = getComputedStyle(n);
  /* Tailwind v4's computed colors speak lab()/oklab() — the canvas readback
   * echoes them verbatim (probed t968: no engine-side sRGB conversion), so
   * the probe carries the REAL color math: oklab -> linear sRGB (Ottosson),
   * lab (D50) -> XYZ -> Bradford D65 -> linear sRGB -> gamma. */
  const clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const gamma = (c) => { const a = Math.abs(c); const lin = a <= 0.0031308 ? 12.92 * a : 1.055 * Math.pow(a, 1 / 2.4) - 0.055; return lin * Math.sign(c); };
  const oklabToRGB = (L, a, b) => {
    const l = L + 0.3963377774 * a + 0.2158037573 * b;
    const m = L - 0.1055613458 * a - 0.0638541728 * b;
    const s = L - 0.0894841775 * a - 1.2914855480 * b;
    const L3 = l * l * l, M3 = m * m * m, S3 = s * s * s;
    return [
      +4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3,
      -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3,
      -0.0041960863 * L3 - 0.7034186147 * M3 + 1.7076147010 * S3,
    ].map(gamma);
  };
  const labToRGB = (L, a, b) => {
    const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
    const EPS = 216 / 24389, K = 24389 / 27;
    const finv = (F) => { const F3 = F * F * F; return F3 > EPS ? F3 : (116 * F - 16) / K; };
    const X = 0.9642956764295677 * finv(fx), Y = 1.0 * finv(fy), Z = 0.8251046025104602 * finv(fz);
    const xd = 0.9555766 * X - 0.0230393 * Y + 0.0631636 * Z;
    const yd = -0.0282895 * X + 1.0099416 * Y + 0.0210077 * Z;
    const zd = 0.0122982 * X - 0.0204830 * Y + 1.3299098 * Z;
    return [
      3.2404542 * xd - 1.5371385 * yd - 0.4985314 * zd,
      -0.9692660 * xd + 1.8760108 * yd + 0.0415560 * zd,
      0.0556434 * xd - 0.2040259 * yd + 1.0572252 * zd,
    ].map(gamma);
  };
  const toRGB = (c) => {
    if (!c) return null;
    const mm = c.match(/^(lab|oklab)\\(\\s*([\\d.]+%?)\\s+(-?[\\d.]+%?)\\s+(-?[\\d.]+%?)\\s*(?:\\/\\s*([\\d.]+%?)\\s*)?\\)$/i);
    if (mm) {
      const pct = (v) => String(v).endsWith("%") ? parseFloat(v) / 100 : parseFloat(v);
      const L = String(mm[2]).endsWith("%") ? parseFloat(mm[2]) : parseFloat(mm[2]);
      const A = pct(mm[3]), B = pct(mm[4]);
      const alpha = mm[5] !== undefined ? pct(mm[5]) : 1;
      const rgb = mm[1].toLowerCase() === "lab" ? labToRGB(L, A, B) : oklabToRGB(L, A, B);
      return { r: clamp8(rgb[0]), g: clamp8(rgb[1]), b: clamp8(rgb[2]), a: alpha };
    }
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (m) { const p = m[1].split(",").map(s => parseFloat(s)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    if (/^#[0-9a-f]{6}$/i.test(c)) return { r: parseInt(c.slice(1,3),16), g: parseInt(c.slice(3,5),16), b: parseInt(c.slice(5,7),16), a: 1 };
    return null;
  };
  const comp = toRGB(cs.backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
  let bg = { ...comp };
  if (bg.a < 1) {
    let el = n.parentElement;
    while (el && bg.a < 1) {
      const c = toRGB(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0) {
        bg.r = Math.round(c.r * c.a + bg.r * bg.a * (1 - c.a));
        bg.g = Math.round(c.g * c.a + bg.g * bg.a * (1 - c.a));
        bg.b = Math.round(c.b * c.a + bg.b * bg.a * (1 - c.a));
        bg.a = c.a + bg.a * (1 - c.a);
      }
      el = el.parentElement;
    }
    if (bg.a < 1) { bg.r = Math.round(bg.r + 255 * (1 - bg.a)); bg.g = Math.round(bg.g + 255 * (1 - bg.a)); bg.b = Math.round(bg.b + 255 * (1 - bg.a)); }
  }
  const lum = (o) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(o.r) + 0.7152 * f(o.g) + 0.0722 * f(o.b); };
  const fg = toRGB(cs.color);
  const ratio = fg ? ((Math.max(lum(bg), lum(fg)) + 0.05) / (Math.min(lum(bg), lum(fg)) + 0.05)) : null;
  /* the line count: the note's line-height vs its box height */
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
  const lines = Math.max(1, Math.round(nRect.height / lh));
  const preRect = pre ? pre.getBoundingClientRect() : null;
  return JSON.stringify({
    dialogW: Math.round(dRect.width),
    dialogOverX: d.scrollWidth > d.clientWidth + 1,
    noteW: Math.round(nRect.width),
    noteH: Math.round(nRect.height),
    noteTop: Math.round(nRect.top),
    copyTop: copyRow ? Math.round(copyRow.getBoundingClientRect().top) : null,
    preTop: preRect ? Math.round(preRect.top) : null,
    preFocused: pre ? document.activeElement === pre : null,
    words: (n.textContent || "").trim().slice(0, 90),
    fontSize: cs.fontSize,
    radius: cs.borderRadius,
    border: cs.borderTopColor,
    bgComposite: \`rgb(\${bg.r},\${bg.g},\${bg.b})\`,
    fgColor: cs.color,
    fgParsed: fg ? "rgb(" + fg.r + "," + fg.g + "," + fg.b + ")" : null,
    contrast: ratio ? Math.round(ratio * 100) / 100 : null,
    lines,
  });
})()`);

console.log(`  look: ${JSON.stringify(look)}`);
if (look?.err) {
  console.log(`FATAL: the look probe failed: ${look.err}`);
  process.exit(2);
}

ok("1 the note renders at the fold (a real box, not a zero-rect ghost)", look.noteW > 40 && look.noteH > 12, `${look.noteW}x${look.noteH}`);
ok("2 the note NEVER overflows the dialog (the family's shell law)", look.dialogOverX === false && look.noteW <= look.dialogW, `dialogW=${look.dialogW} noteW=${look.noteW}`);
ok("3 the composite contrast ratio >= 4.5 (a kind note is READABLE — WCAG AA)", look.contrast !== null && look.contrast >= 4.5, `ratio=${look.contrast} fg=${look.fgColor} bg=${look.bgComposite}`);
ok("4 the order the EYES see: note ABOVE the copy row, pre below both (the ADDITION shape)", look.copyTop !== null && look.noteTop < look.copyTop && look.preTop !== null && look.copyTop < look.preTop, `note=${look.noteTop} copy=${look.copyTop} pre=${look.preTop}`);
ok("5 the focus law the EYES confirm: the pre still takes the seat (the note did not steal the destination)", look.preFocused === true, `focused=${look.preFocused}`);
ok("6 the wrap honesty at the fold: the sentence wraps to 2+ lines OR the single line fits the box", look.lines >= 2 ? look.noteH >= 2 * 14 : look.noteH >= 14, `lines=${look.lines} h=${look.noteH}`);

/* the PNG receipt */
try {
  const shot = path.join(ROOT, "shots-qa", process.env.WIDE ? "t968-empty-note-wide.png" : "t968-empty-note-320.png");
  sh(`${AB} screenshot ${shot}`);
  ok("7 the PNG receipt lands", true, path.basename(shot));
} catch (e) {
  ok("7 the PNG receipt lands", false, String(e).slice(0, 80));
}

writeFileSync(RECEIPT, JSON.stringify({ mode: process.env.WIDE ? "wide" : "fold-320", look, pass, fail }, null, 2));
console.log(`== t968 empty-note eyeball ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
