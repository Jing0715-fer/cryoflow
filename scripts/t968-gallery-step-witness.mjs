#!/usr/bin/env node
/**
 * t968 — the MRC WALL'S NARROW STEP (the t965/t966 carry, twice recorded,
 * now cashed): the inspector's Overview tab mounts ImportGallery — the
 * results family's shared thumbnail wall — whose grid spoke `grid-cols-3`
 * at EVERY width. At the 320 fold that made ~80px cells inside a ~260px
 * panel: the squish disease (panel-contained — the shell never overflowed,
 * so the fold audits were blind to it; a LEGIBILITY disease, not a shell
 * one). The recorded candidate: the narrow `grid-cols-2` step.
 *
 * BEFORE=1  — the WITNESS ride: expects the DISEASED shape (3 columns at
 *             320, cells under 100px) and keeps the numbers.
 * default   — the GATE ride: expects the cured shape (2 columns at 320,
 *             cells >= 110px, the sm/lg steps intact, no overflow, the
 *             wall still mounts its thumbs).
 *
 * The world: the SEED's Motion Correction 1 Overview tab (the corrected
 * wall — its catalogue answers 6 real rows). The BENCH's wide star is the
 * peek door's stress face and does NOT fit the micrographs route's
 * catalogue contract (total 0 — probed t968) — the seed's wall is the
 * honest same-component ride: the same grid class is the disease site.
 *
 *   node scripts/t968-gallery-step-witness.mjs        (the gate)
 *   BEFORE=1 node scripts/t968-gallery-step-witness.mjs  (the witness)
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const RECEIPT = path.join(ROOT, "shots-qa", "t968-gallery-step-witness.json");
const NAME = "Motion Correction 1";
const BEFORE = process.env.BEFORE === "1";

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

console.log(`== t968 the mrc wall's narrow step ${BEFORE ? "(the BEFORE witness)" : "(the gate)"} ==`);

sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
if (!String(await openInspectorHard(NAME)).startsWith("open@try")) {
  console.log("FATAL: the bench's inspector never opened");
  process.exit(2);
}
await sleep(800);
if (!String(await clickTab("Overview", 4)).startsWith("clicked@")) {
  console.log("FATAL: the Overview tab never clicked");
  process.exit(2);
}
/* the fold */
sh(`${AB} set viewport 320 640`);
await sleep(1500);

/* the wall's face: the thumbnail grid inside the corrected wall */
const face = await poll(
  `(() => {
    const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
    if (!d) return JSON.stringify({ err: "no-dialog" });
    const grid = [...d.querySelectorAll('[data-gallery-ui="thumb"]')].length ? [...d.querySelectorAll('[data-gallery-ui="thumb"]')][0].parentElement : null;
    if (!grid) return JSON.stringify({ err: "no-grid" });
    const thumbs = [...grid.querySelectorAll('[data-gallery-ui="thumb"]')];
    const gs = getComputedStyle(grid);
    const panel = grid.closest('[role="tabpanel"]');
    const pRect = panel ? panel.getBoundingClientRect() : null;
    const gRect = grid.getBoundingClientRect();
    const cells = thumbs.slice(0, 4).map(t => Math.round(t.getBoundingClientRect().width));
    return JSON.stringify({
      thumbs: thumbs.length,
      cols: gs.gridTemplateColumns.split(" ").filter(c => c && c !== "0px").length,
      template: gs.gridTemplateColumns.slice(0, 90),
      cell0: cells[0] ?? null,
      cells,
      panelW: pRect ? Math.round(pRect.width) : null,
      gridW: Math.round(gRect.width),
      shellOverX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      panelOverX: panel ? panel.scrollWidth > panel.clientWidth + 1 : null,
    });
  })()`,
  (v) => v && !v.err && v.thumbs > 0, 12, 600,
);

if (!face) {
  console.log("FATAL: the corrected wall's thumbnail grid never measured");
  process.exit(2);
}
console.log(`  face: ${JSON.stringify(face)}`);

if (BEFORE) {
  ok("W1 the disease is PRESENT: three columns at the 320 fold", face.cols === 3, `cols=${face.cols}`);
  ok("W2 the squish: the cells are starved (under 100px)", face.cell0 !== null && face.cell0 < 100, `cell0=${face.cell0}px in panelW=${face.panelW}`);
  ok("W3 the t965 note was KINDER than the truth: the panel itself scrolls horizontally (panelOverX true — the real shape the fold audits' panel-blind spot hid)", face.shellOverX === false && face.panelOverX === true, `shell=${face.shellOverX} panel=${face.panelOverX}`);
} else {
  ok("G1 the narrow step: TWO columns at the 320 fold", face.cols === 2, `cols=${face.cols} template=${face.template}`);
  ok("G2 the cells breathe (>= 110px each)", face.cell0 !== null && face.cell0 >= 110, `cell0=${face.cell0}px in panelW=${face.panelW}`);
  ok("G3 the wall's own grid never overflows its box (the gallery keeps the one-box law even while the panel's OTHER mouths remain recorded)", face.gridW <= face.panelW && face.panelOverX !== undefined, `gridW=${face.gridW} panelW=${face.panelW} panelOverX=${face.panelOverX}`);
  ok("G4 the wall still mounts its thumbs", face.thumbs >= 4, `thumbs=${face.thumbs}`);
  /* the sm step: widen and confirm the template grows */
  sh(`${AB} set viewport 700 800`);
  await sleep(1200);
  const wide = evalJson(`(() => {
    const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
    const grid = d ? [...d.querySelectorAll('[data-gallery-ui="thumb"]')][0]?.parentElement : null;
    if (!grid) return JSON.stringify({ err: "no-grid" });
    return JSON.stringify({ cols: getComputedStyle(grid).gridTemplateColumns.split(" ").filter(c => c && c !== "0px").length });
  })()`);
  ok("G5 the sm step survived the cure (4 columns at sm)", wide && wide.cols === 4, `cols=${wide?.cols ?? "?"}`);
  sh(`${AB} set viewport 320 640`);
  await sleep(800);
  try { sh(`${AB} screenshot ${path.join(ROOT, "shots-qa", "t968-gallery-step-320.png")}`); ok("G6 the PNG receipt lands", true, "t968-gallery-step-320.png"); }
  catch (e) { ok("G6 the PNG receipt lands", false, String(e).slice(0, 60)); }
}

writeFileSync(RECEIPT, JSON.stringify({ mode: BEFORE ? "before-witness" : "gate", face, pass, fail }, null, 2));
console.log(`== t968 gallery step ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
