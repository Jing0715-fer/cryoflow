#!/usr/bin/env node
/**
 * t971 — the LOG STRIP's first measured fold ride (the t970 note's ①
 * cashed in): the failed face's Log tab — the Task 119 diagnosis strip
 * (data-log-diagnosis) that lives INSIDE the log console, the teaser's
 * sibling — walked at the 320 fold with the t969 panel-tier grammar.
 *
 * The strip's design (what the ride must confirm at the fold):
 *   · the strip sits between toolbar and scroll area (shrink-0) — it
 *     stays visible while the log scrolls beneath it;
 *   · the findings list caps at max-h-52 (208px) with its OWN scroll —
 *     five findings must not push the log out of view (the log is the
 *     ground truth and keeps its lane);
 *   · every finding's label and excerpt truncate (title carries the
 *     full text); the hint WRAPS (the remedy is the one text that must
 *     be read whole);
 *   · the head's provenance note hides below xl (the honest hiding);
 *   · the console self-clips (overflow-hidden) — the one-axis law.
 *
 * The face: the t970 mint's failed face. The strip's findings are
 * computed on the TAIL window (600 lines) — the face's log is 24 lines,
 * so tail window == whole log and the strip's count MUST agree with the
 * teaser's (the t969 parity note, witnessed here by construction).
 *
 * BEFORE mode (default): walk + rank + PNG receipts; exits 0 even when
 *   a disease is present (a witness RECORDS, it does not gate).
 * GATE=1: the fold contract — panelOverX FALSE, the shell never scrolls,
 *   the strip speaks 2 findings and absorbs every shape, the list keeps
 *   its lane, the wide face stays clean, every leak is hit-slop.
 *
 *   node scripts/t971-log-strip-walk.mjs
 *   GATE=1 node scripts/t971-log-strip-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t971-log-strip-walk.json");
const NAME = "Failed Diagnosis Face (t970)";
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

/* the strip's presence probe — the Log console's fetch + diagnosis is the
 * tab's own async leg; wait for data-log-diagnosis before measuring */
const stripWait = `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const strip = dlg.querySelector("[data-log-diagnosis]");
  return JSON.stringify({ strip: !!strip, findings: strip ? strip.querySelectorAll("[data-finding]").length : 0 });
})()`;

/* THE WALK — the t969 grammar at the panel tier + the strip's named probes */
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
  const out = {
    panelW: Math.round(pRect.width),
    panelSW: panel.scrollWidth, panelCW: panel.clientWidth,
    panelOverX: panel.scrollWidth > panel.clientWidth + 1,
    shellOverX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    offenders: offenders.slice(0, 14),
    unclipped: offenders.filter((o) => !o.selfClip).length,
  };
  /* the strip's named probes — every shape measured at its address */
  const strip = panel.querySelector("[data-log-diagnosis]");
  if (strip) {
    out.strip = {
      aria: strip.getAttribute("aria-label") ?? "",
      sw: strip.scrollWidth, cw: strip.clientWidth, over: strip.scrollWidth - strip.clientWidth,
      findingCount: strip.querySelectorAll("[data-finding]").length,
    };
    const headRow = strip.querySelector(".diag-head-label")?.parentElement;
    if (headRow) out.headRow = { sw: headRow.sw = headRow.scrollWidth, cw: headRow.clientWidth, over: headRow.scrollWidth - headRow.clientWidth };
    const list = strip.querySelector("ul");
    if (list) {
      const ls = getComputedStyle(list);
      out.list = {
        sw: list.scrollWidth, cw: list.clientWidth, over: list.scrollWidth - list.clientWidth,
        maxH: ls.maxHeight, scrollableY: list.scrollHeight > list.clientHeight + 1,
        ownScrollY: ls.overflowY,
        focusable: list.getAttribute("tabindex") === "0",
      };
    }
    out.findings = [...strip.querySelectorAll("[data-finding]")].map((li) => {
      const label = li.querySelector(".diag-label");
      const badge = li.querySelector(".diag-linebadge");
      const excerpt = li.querySelector(".diag-excerpt");
      const hint = li.querySelector(".diag-hint");
      return {
        id: li.getAttribute("data-finding"),
        over: li.scrollWidth - li.clientWidth,
        labelTrunc: !!label && String(label.className).includes("truncate"),
        badge: badge ? badge.textContent.trim() : "",
        excerptTrunc: !!excerpt && String(excerpt.className).includes("truncate"),
        hintWraps: !!hint && !String(hint.className).includes("truncate") && String(hint.className).includes("items-start"),
      };
    });
  }
  const consoleEl = panel.querySelector("[data-log-console]");
  if (consoleEl) {
    out.console = {
      sw: consoleEl.scrollWidth, cw: consoleEl.clientWidth, over: consoleEl.scrollWidth - consoleEl.clientWidth,
      selfClip: getComputedStyle(consoleEl).overflowX !== "visible",
    };
    /* the toolbar — Task 176's wrap cure must stand on this face */
    const toolbar = consoleEl.querySelector(":scope > div");
    if (toolbar) out.toolbar = { sw: toolbar.scrollWidth, cw: toolbar.clientWidth, over: toolbar.scrollWidth - toolbar.clientWidth };
  }
  /* the LEAK buttons' identity — the t970 exoneration's light form */
  out.leakButtons = [...dlg.querySelectorAll("button")]
    .filter((b) => b.scrollWidth > b.clientWidth + 1)
    .slice(0, 8)
    .map((b) => {
      const before = getComputedStyle(b, "::before");
      return { aria: b.getAttribute("aria-label") ?? "", over: b.scrollWidth - b.clientWidth, pseudoAbs: before.position === "absolute" };
    });
  return JSON.stringify(out);
})()`;

console.log(`== t971 the log strip's first measured ride ${GATE ? "(the GATE)" : "(the BEFORE witness)"} ==`);

sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
if (!String(await openInspectorHard(NAME)).startsWith("open@try")) {
  console.log("FATAL: the failed face's inspector never opened");
  process.exit(2);
}
await sleep(800);
if (!String(await clickTab("Log", 4)).startsWith("clicked@")) {
  console.log("FATAL: the Log tab never clicked");
  process.exit(2);
}

/* wait for the strip (the async diagnosis leg of the Log tab) */
const t0 = await poll(stripWait, (v) => v && !v.err && v.strip, 20, 600);
if (!t0) { console.log("FATAL: the log diagnosis strip never rendered"); process.exit(2); }
console.log(`  strip: present, findings=${t0.findings}`);

/* the WIDE face first */
const wide = evalJson(walkExpr);
if (!wide || wide.err) { console.log(`FATAL: the wide walk never measured (${wide?.err ?? "null"})`); process.exit(2); }
console.log(`  wide: panelW=${wide.panelW} sw=${wide.panelSW} overX=${wide.panelOverX} unclipped=${wide.unclipped}`);
if (!GATE) mkdirSync(QA_DIR, { recursive: true });
sh(`${AB} screenshot ${QA_DIR}/t971-log-strip-wide.png`);

/* the fold */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
const fold = await poll(walkExpr, (v) => v && !v.err, 12, 600);
if (!fold) { console.log("FATAL: the fold walk never measured"); process.exit(2); }
console.log(`  fold: panelW=${fold.panelW} sw=${fold.panelSW} cw=${fold.panelCW} overX=${fold.panelOverX} shell=${fold.shellOverX} unclipped=${fold.unclipped}`);
for (const o of fold.offenders.slice(0, 8)) {
  console.log(`      · ${o.selfClip ? "SELF-CLIP" : "LEAK    "} +${o.over}px ${o.tag}.${o.cls.slice(0, 56)} "${o.text.slice(0, 36)}"`);
}
if (fold.strip) {
  console.log(`  strip@fold: over=${fold.strip.over} findings=${fold.strip.findingCount} aria="${fold.strip.aria}"`);
  if (fold.headRow) console.log(`  headRow: sw=${fold.headRow.sw} cw=${fold.headRow.cw} over=${fold.headRow.over}`);
  if (fold.list) console.log(`  list: over=${fold.list.over} maxH=${fold.list.maxH} scrollable=${fold.list.scrollableY} ownY=${fold.list.ownScrollY} focusable=${fold.list.focusable}`);
  for (const f of fold.findings ?? []) console.log(`  finding ${f.id}: over=${f.over} labelTrunc=${f.labelTrunc} badge="${f.badge}" excerptTrunc=${f.excerptTrunc} hintWraps=${f.hintWraps}`);
  if (fold.console) console.log(`  console: over=${fold.console.over} selfClip=${fold.console.selfClip}`);
  if (fold.toolbar) console.log(`  toolbar: sw=${fold.toolbar.sw} cw=${fold.toolbar.cw} over=${fold.toolbar.over}`);
}
sh(`${AB} screenshot ${QA_DIR}/t971-log-strip-320.png`);

/* the witness's own verdicts (both modes — the face must SPEAK) */
ok("the log strip rendered inside the console", !!fold.strip);
ok("the strip speaks TWO findings (the tail window == whole log here)", fold.strip?.findingCount === 2, `findings=${fold.strip?.findingCount}`);
ok("the strip's aria counts its window", (fold.strip?.aria ?? "").includes("2 findings"), `"${fold.strip?.aria ?? ""}"`);
ok("both findings carry the ×N badge (the count rides the line badge)", (fold.findings ?? []).every((f) => f.badge.includes("×2")), (fold.findings ?? []).map((f) => `${f.id}="${f.badge}"`).join(" "));
ok("every finding's label truncates (the design)", (fold.findings ?? []).every((f) => f.labelTrunc));
ok("every finding's excerpt truncates (the design)", (fold.findings ?? []).every((f) => f.excerptTrunc));
ok("every finding's hint WRAPS (the remedy reads whole)", (fold.findings ?? []).every((f) => f.hintWraps));
ok("the findings list is focusable (the t780 reading face)", fold.list?.focusable === true);
ok(
  "every LEAK button is an aria-named hit-slop carrier (the t970 law)",
  (fold.leakButtons ?? []).length > 0 && (fold.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (fold.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

/* the GATE — the log strip's fold contract */
if (GATE) {
  ok("G1 the panel never overflows at the fold (panelOverX FALSE)", fold.panelOverX === false, `sw=${fold.panelSW} cw=${fold.panelCW}`);
  ok("G2 the shell never scrolls at the fold", fold.shellOverX === false);
  ok("G3 the strip absorbs (over=0) and its head row absorbs", fold.strip?.over === 0 && fold.headRow?.over === 0);
  ok("G4 every finding absorbs (over=0 — truncate doing its job)", (fold.findings ?? []).every((f) => f.over === 0));
  ok("G5 the list keeps its lane (max-h cap + own scroll-Y, no X overflow)", fold.list?.over === 0 && fold.list?.ownScrollY === "auto" && (fold.list?.maxH ?? "").startsWith("208"));
  ok("G6 the console self-clips and the toolbar wraps clean (Task 176 standing)", fold.console?.selfClip === true && fold.toolbar?.over === 0);
  ok("G7 the wide face stays clean", wide.panelOverX === false);
  ok("G8 the PNG receipts landed", true, "t971-log-strip-320.png + t971-log-strip-wide.png");
}

/* the receipt */
const receipt = {
  instrument: "t971-log-strip-walk",
  mode: GATE ? "GATE" : "BEFORE",
  at: new Date().toISOString(),
  face: NAME,
  wide, fold,
};
writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2));
console.log(`receipt: ${RECEIPT}`);
console.log(`== t971 walk ${GATE ? "GATE" : "BEFORE"} done — ${pass} ok, ${fail} fail ==`);
process.exit(GATE ? (fail === 0 ? 0 : 1) : 0);
