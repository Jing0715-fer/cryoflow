#!/usr/bin/env node
/**
 * t969 — the Overview PANEL's offender-walk (the t964 dialog-audit grammar
 * generalized to the PANEL tier — the t968 recorded-not-cured ① cashed in):
 *
 * The disease site is the inspector's Overview tab — a PANEL, not a dialog.
 * The t968 BEFORE ride named panelOverX TRUE at 320 with the offenders
 * listed by the same walk's earlier shape (the `grid gap-6 lg:grid-cols-2`
 * block's 329px min-content, the ResultSummary card's chip row 258 vs 231,
 * a 42-vs-34 button) — but recorded shapes are not measured shapes; only
 * the ride speaks. This instrument WALKS the tabpanel subtree at the 320
 * fold and ranks every mouth (scrollWidth > clientWidth + 1) with the
 * t963/t964 self-clipping judgment:
 *
 *   · a mouth whose own overflow-x is clipped (overflow != visible) is
 *     良性 — it eats its own disease;
 *   · a mouth that overflows ITSELF carries the disease UP the chain to
 *     the panel, and the panelOverX TRUE is the proof the panel tier
 *     leaks to the eye.
 *
 * The honest same-component ride stays the SEED's Motion Correction 1
 * Overview tab (the t968 law: the bench's wide star serves the peek door;
 * the seed's wall is the catalogue face — and the seed's Overview carries
 * the same ResultSummary + the same two-column grid block, so the walk
 * rides the disease's real address).
 *
 * BEFORE mode (default): walk + rank + PNG receipt at 320 and wide; exits 0
 *   even when the disease is present (a witness RECORDS, it does not gate).
 * GATE mode (GATE=1): the cure's verifier — panelOverX must be FALSE at the
 *   fold, the shell must never scroll, the t968 narrow-step cure must still
 *   stand (regression pin), and the wide face must stay clean.
 *
 *   node scripts/t969-panel-offender-walk.mjs
 *   GATE=1 node scripts/t969-panel-offender-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t969-panel-offender-walk.json");
const NAME = "Motion Correction 1";
const GATE = process.env.GATE === "1";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
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

/* THE WALK — the t964 grammar at the panel tier. The walk root is the
 * inspector dialog's VISIBLE tabpanel (the Overview tab's mounted content),
 * not a dialog mouth: the panel is where the t968 ride pinned panelOverX
 * TRUE. Self-clipping judgment verbatim from t964 (overflow != visible eats
 * its own disease; sr-only never counts). */
const walkExpr = `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const panels = [...dlg.querySelectorAll('[role="tabpanel"]')].filter(p => p.getBoundingClientRect().width > 0);
  if (!panels.length) return JSON.stringify({ err: "no-visible-panel" });
  const panel = panels[0];
  const offenders = [];
  const selfClipping = (el) => {
    const s = getComputedStyle(el);
    if (typeof el.className === "string" && el.className.includes("sr-only")) return true;
    return s.overflowX !== "visible" || s.overflowY !== "visible";
  };
  const walk = (el, depth) => {
    if (depth > 24) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 120),
        sw: el.scrollWidth, cw: el.clientWidth, over: el.scrollWidth - el.clientWidth,
        text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60),
        selfClip: selfClipping(el),
      });
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(panel, 0);
  offenders.sort((a, b) => b.over - a.over);
  const pRect = panel.getBoundingClientRect();
  return JSON.stringify({
    panelW: Math.round(pRect.width),
    panelSW: panel.scrollWidth, panelCW: panel.clientWidth,
    panelOverX: panel.scrollWidth > panel.clientWidth + 1,
    shellOverX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    offenders: offenders.slice(0, 14),
    unclipped: offenders.filter((o) => !o.selfClip).length,
  });
})()`;

console.log(`== t969 the Overview panel's offender-walk ${GATE ? "(the GATE)" : "(the BEFORE witness)"} ==`);

sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
if (!String(await openInspectorHard(NAME)).startsWith("open@try")) {
  console.log("FATAL: the seed's inspector never opened");
  process.exit(2);
}
await sleep(800);
if (!String(await clickTab("Overview", 4)).startsWith("clicked@")) {
  console.log("FATAL: the Overview tab never clicked");
  process.exit(2);
}

/* the WIDE face first (a cure must never break what was already breathing) */
const wide = evalJson(walkExpr);
if (!wide || wide.err) { console.log(`FATAL: the wide walk never measured (${wide?.err ?? "null"})`); process.exit(2); }
console.log(`  wide: panelW=${wide.panelW} sw=${wide.panelSW} overX=${wide.panelOverX} unclipped=${wide.unclipped}`);

/* the fold */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
const fold = await poll(walkExpr, (v) => v && !v.err, 12, 600);
if (!fold) { console.log("FATAL: the fold walk never measured"); process.exit(2); }
console.log(`  fold: panelW=${fold.panelW} sw=${fold.panelSW} cw=${fold.panelCW} overX=${fold.panelOverX} shell=${fold.shellOverX} unclipped=${fold.unclipped}`);
for (const o of fold.offenders.slice(0, 8)) {
  console.log(`      · ${o.selfClip ? "SELF-CLIP" : "LEAK    "} +${o.over}px ${o.tag}.${o.cls.slice(0, 56)} "${o.text.slice(0, 36)}"`);
}

/* the three named mouths, measured directly (the t968 list — the walk's
 * rank alone can miss a mouth that a parent absorbs; the named probes pin
 * the recorded shapes at their real addresses) */
const named = await poll(`(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const panel = [...dlg.querySelectorAll('[role="tabpanel"]')].filter(p => p.getBoundingClientRect().width > 0)[0];
  if (!panel) return JSON.stringify({ err: "no-panel" });
  const out = {};
  /* mouth (a): the two-column grid block — classList match survives the
   * colon-escaping a selector would need */
  const twoCol = [...panel.querySelectorAll("div.grid")].find(g => g.classList.contains("lg:grid-cols-2"));
  if (twoCol) {
    const cols = getComputedStyle(twoCol).gridTemplateColumns.split(" ").filter(c => c && c !== "0px").length;
    out.twoCol = { sw: twoCol.scrollWidth, cw: twoCol.clientWidth, over: twoCol.scrollWidth - twoCol.clientWidth, cols, selfClip: getComputedStyle(twoCol).overflowX !== "visible", clsHasStep: twoCol.classList.contains("grid-cols-1") && twoCol.classList.contains("lg:grid-cols-2") };
  }
  /* mouth (b): the ResultSummary card — the success face is a
   * data-print-atomic flex card; the diagnosis teaser (failed face) would
   * be data-overview-diagnosis. Measure whichever exists. */
  const ovd = panel.querySelector("[data-overview-diagnosis]");
  const summary = ovd ?? [...panel.querySelectorAll("[data-print-atomic]")].find(c => (c.className || "").includes("bg-success/5"));
  if (summary) out.summary = { sw: summary.scrollWidth, cw: summary.clientWidth, over: summary.scrollWidth - summary.clientWidth };
  /* mouth (c): the presets row — the t969 cure's address. Measure the row,
   * the button group's wrap class, and the wall's narrow step (t968). */
  const presetsRow = panel.querySelector('[data-testid="inspector-param-presets"] > div');
  if (presetsRow) {
    const grp = presetsRow.querySelector("div.ml-auto");
    out.presets = {
      rowOver: presetsRow.scrollWidth - presetsRow.clientWidth,
      grpWraps: grp ? (grp.classList.contains("flex-wrap") && grp.classList.contains("justify-end")) : null,
    };
  }
  const wallStep = [...panel.querySelectorAll("[data-gallery-ui='thumb']")].length
    ? [...panel.querySelectorAll("[data-gallery-ui='thumb']")][0].parentElement?.classList.contains("grid-cols-2") ?? null
    : "no-wall-on-this-face";
  out.wallStep = wallStep;
  return JSON.stringify(out);
})()`, (v) => v && !v.err, 8, 500);
console.log(`  named: ${JSON.stringify(named)}`);

const PNG = path.join(QA_DIR, GATE ? "t969-panel-gate-320.png" : "t969-panel-walk-320.png");
try { sh(`${AB} screenshot ${PNG}`); } catch {}

if (GATE) {
  /* THE GATE: the cure's verdicts. */
  ok("G1 the panel no longer leaks at the fold (panelOverX FALSE)", fold.panelOverX === false, `sw=${fold.panelSW} cw=${fold.panelCW}`);
  ok("G2 the shell never scrolls horizontally (the viewport law)", fold.shellOverX === false, `shellOverX=${fold.shellOverX}`);
  ok("G3 the two-column grid block holds its min-content inside its box", named?.twoCol ? named.twoCol.over <= 1 : true, named?.twoCol ? `over=${named.twoCol.over}px` : "absent (no inputs/outputs on this face)");
  ok("G4 the wide face stays clean (no regression above the fold)", wide.panelOverX === false, `wide overX=${wide.panelOverX}`);
  ok("G5a the narrow step class stands on the grid block (the cure's own string)", named?.twoCol?.clsHasStep === true, `clsHasStep=${named?.twoCol?.clsHasStep ?? "?"} cols=${named?.twoCol?.cols ?? "?"}`);
  ok("G5b the presets button group wraps internally (the cure's own string)", named?.presets ? named.presets.grpWraps === true : false, JSON.stringify(named?.presets ?? null));
  ok("G5c the presets row no longer leaks", named?.presets ? named.presets.rowOver <= 1 : true, `rowOver=${named?.presets?.rowOver ?? "?"}`);
  const leaked = fold.offenders.filter((o) => !o.selfClip && o.over > 1).map((o) => `${o.tag}+${o.over}`);
  ok("G6 the only remaining overflow is self-clipping or the CopyButton's designed hit-slop (+8, Task 171)", leaked.every((x) => x.startsWith("button+8")), leaked.length ? leaked.join(",") : "none");
  const pngOK = (() => { try { execSync(`test -s ${PNG}`); return true; } catch { return false; } })();
  ok("G7 the PNG receipt lands", pngOK, path.basename(PNG));
} else {
  /* THE BEFORE: record the disease's real shape (a witness does not gate). */
  ok("W1 the panel tier leaks at the fold (panelOverX TRUE — the t968 record confirmed by measurement)", fold.panelOverX === true, `sw=${fold.panelSW} cw=${fold.panelCW}`);
  ok("W2 the shell itself does NOT scroll (the panel is the top of the leak)", fold.shellOverX === false, `shellOverX=${fold.shellOverX}`);
  ok("W3 the mouths are ranked and named for the cure", fold.offenders.length > 0, `offenders=${fold.offenders.length} unclipped=${fold.unclipped}`);
  ok("W4 the wide face was already breathing (no wide disease)", wide.panelOverX === false, `wide overX=${wide.panelOverX}`);
}

mkdirSync(QA_DIR, { recursive: true });
writeFileSync(RECEIPT, JSON.stringify({ mode: GATE ? "gate" : "before-witness", fold, wide, named }, null, 2));
console.log(`== t969 panel walk ${GATE ? (fail === 0 ? "GATE GREEN" : "GATE RED") : "witness done"} — ${pass} ok, ${fail} fail ==`);
process.exit(GATE ? (fail === 0 ? 0 : 1) : 0);
