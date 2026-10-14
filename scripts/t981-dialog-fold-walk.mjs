#!/usr/bin/env node
/**
 * t981 — the DIALOG FAMILY's FOLD TIER (the t981 entry's candidate (c),
 * carried since t976's (e′)): the t975 sweep pinned TITLES at the source
 * tier; this ride witnesses ABSORPTION at the browser tier — the t969
 * panel law (panelOverX FALSE at 320) generalized across a SAMPLE of the
 * family's dialogs.
 *
 * THE SAMPLE (five mouths, zero minting — every face exists on the
 * standing world):
 *   1. the job-inspector (the anchor; the failed face job — the t975
 *      walk's own host, [data-inspector-dialog]);
 *   2. the FSC compare dialog (the t981 entry's named family member —
 *      the inspector's stacked mouth, [data-testid="fsc-compare-open"]
 *      → a dialog hosting [data-testid="fsc-compare-list"]);
 *   3. the shortcuts dialog (the help popover's CTA "View all keyboard
 *      shortcuts");
 *   4. the help-guide dialog (the help popover's CTA "Read the full
 *      guide");
 *   5. the command palette (the ⌘/Ctrl+K door — command.tsx is a
 *      DialogContent host; identity marker [cmdk-input]).
 *
 * THE MEASURE (the t969 grammar): the topmost visible [role=dialog] per
 * leg — w, sw/cw, overX (sw > cw + 1), shellOverX, the DialogTitle's
 * own words, and the top-3 offender children (the t969 ranking).
 *
 * RIDE LAWS inherited: each leg FRESH-opened (the eval-hang law); the
 * 320 viewport set BEFORE any mouth opens (the t910 law — set viewport
 * reloads the page, a pre-mounted dialog is a ghost); realClick probes
 * vis AND own every round (the ghost-click race); poll-then-probe;
 * stacked legs close BOTH layers (Esc twice); the walk WITNESSES — it
 * records diseases and exits 0; GATE=1 turns the census into the cure's
 * verifier (every sampled dialog must absorb: overX FALSE AND
 * shellOverX FALSE).
 *
 *   node scripts/t981-dialog-fold-walk.mjs
 *   GATE=1 node scripts/t981-dialog-fold-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t981-dialog-fold-walk.json");
const ANCHOR = process.env.T981_ANCHOR ?? "Failed Diagnosis Face (t970)";
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
const poll = async (expr, gate, times = 20, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && v !== "null" && gate(v)) return v;
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
const escAll = async (times = 2) => { for (let i = 0; i < times; i++) { try { sh(`${AB} press Escape`); } catch {} await sleep(500); } };

/* the find-bar opener — the t972/t973 law: Reset view is NOT a fit, the
   overlay can cover a card, scrollIntoView is a no-op on the transform
   canvas (the t978 house pattern verbatim). */
const findAndCenter = async (needle) => {
  const alreadyOpen = evalJson(`(() => { const b = document.querySelector('[aria-label="Find jobs by name, type, or key:value parameter query"]'); return JSON.stringify({ open: !!b && b.getBoundingClientRect().width > 0 }); })()`);
  if (!(alreadyOpen && alreadyOpen.open)) {
    const btn = await realClick(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Find jobs on canvas') ?? null`);
    if (!String(btn).startsWith("clicked@")) return "NO-FIND-BAR";
    await sleep(700);
  }
  const box = `[aria-label="Find jobs by name, type, or key:value parameter query"]`;
  sh(`${AB} fill '${box}' '${needle}'`);
  await sleep(900);
  const matchBtn = await evalJson(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^\\d+ match(es)?$/.test((x.textContent || '').trim()) && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (!matchBtn || !matchBtn.x) return "NO-MATCH";
  sh(`${AB} mouse move ${matchBtn.x} ${matchBtn.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  await sleep(900);
  return `centered:${needle}`;
};
const openInspectorHard = async (name, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
    const opened = await poll(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 5, 500);
    if (opened?.open === true) return `open@try${i}`;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(700);
  }
  return "NEVER-OPEN";
};
/* closing takes TWO Escapes when a stacked dialog rode on top — Escape
   closes the TOPMOST layer, so the loop presses until NO dialog remains
   (the t978 stale-inspector fight's own lesson). */
const closeAllDialogs = async () => {
  for (let i = 0; i < 4; i++) {
    const st = evalJson(`(() => JSON.stringify({ any: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].some(d => d.getBoundingClientRect().width > 0) }))()`);
    if (st && st.any === false) return true;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(800);
  }
  return false;
};

const serverReady = async (times = 24, ms = 2500) => {
  for (let i = 0; i < times; i++) {
    try {
      const code = execSync(`curl -s -o /dev/null -w '%{http_code}' --max-time 8 ${BASE}`, { encoding: "utf8", timeout: 15_000 }).trim();
      if (code === "200") return true;
    } catch {}
    await sleep(ms);
  }
  return false;
};

/* the viewport law, TWO shapes:
   · freshOpenAt320 — the t910 law (set viewport BEFORE any mouth opens;
     fresh open per leg; re-set when the width drifted — the reopen
     happens while no dialog is mounted, so the reload is free);
   · freshOpenWide — the t975 law for the CANVAS-hosted mouths (the job
     cards live on the transform canvas; scrollIntoView is a no-op
     there, and at 320 the anchor card sat OFF-VIEWPORT — the BEFORE
     ride's own receipt): open the dialog at a WIDE viewport first,
     THEN narrow to 320 and re-poll; if the narrow ghosted the dialog,
     the mouth is re-clicked at 320 (the inspector's job rides the
     persisted store, the card is re-clickable; the compare button
     lives inside the inspector). */
const freshOpenAt320 = async () => {
  if (!(await serverReady())) return false;
  sh(`${AB} open ${BASE}/`);
  await sleep(2200);
  let w = evalJson(`(() => JSON.stringify({ w: window.innerWidth }))()`);
  if (!w || w.w !== 320) {
    sh(`${AB} set viewport 320 640`);
    await sleep(1500);
    sh(`${AB} open ${BASE}/`);
    await sleep(2200);
    w = evalJson(`(() => JSON.stringify({ w: window.innerWidth }))()`);
  }
  return w?.w === 320;
};
const freshOpenWide = async () => {
  if (!(await serverReady())) return false;
  sh(`${AB} open ${BASE}/`);
  await sleep(2200);
  const w = evalJson(`(() => JSON.stringify({ w: window.innerWidth }))()`);
  if (!w || w.w < 1000) {
    sh(`${AB} set viewport 1280 800`);
    await sleep(1500);
    sh(`${AB} open ${BASE}/`);
    await sleep(2200);
  }
  return true;
};
const narrowTo320 = async () => {
  sh(`${AB} set viewport 320 640`);
  await sleep(1500);
  const w = evalJson(`(() => JSON.stringify({ w: window.innerWidth }))()`);
  return w?.w === 320;
};

/* THE MEASURE — the t969 grammar on the topmost visible dialog */
const MEASURE = `(() => {
  const dlgs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(d => { const r = d.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (!dlgs.length) return JSON.stringify({ err: "no-dialog" });
  const dlg = dlgs[dlgs.length - 1];
  const r = dlg.getBoundingClientRect();
  const offenders = [];
  const walkKids = (el, depth) => {
    if (depth > 3) return;
    for (const k of el.children) {
      if (k.scrollWidth > k.clientWidth + 1) offenders.push({ tag: k.tagName.toLowerCase(), cls: String(k.className || "").slice(0, 90), sw: k.scrollWidth, cw: k.clientWidth, over: k.scrollWidth - k.clientWidth });
      walkKids(k, depth + 1);
    }
  };
  walkKids(dlg, 0);
  offenders.sort((a, b) => b.over - a.over);
  const lb = dlg.getAttribute("aria-labelledby");
  const t = (lb && document.getElementById(lb)) || dlg.querySelector('[data-slot="dialog-title"], [data-slot="alert-dialog-title"]');
  return JSON.stringify({
    n: dlgs.length,
    w: Math.round(r.width),
    sw: dlg.scrollWidth, cw: dlg.clientWidth,
    overX: dlg.scrollWidth > dlg.clientWidth + 1,
    shellOverX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    labelledby: !!lb,
    title: t ? (t.textContent || "").trim().slice(0, 70) : "",
    isInspector: dlg.hasAttribute("data-inspector-dialog"),
    hasCmdk: !!dlg.querySelector("[cmdk-input]"),
    hasCompareList: !!dlg.querySelector('[data-testid="fsc-compare-list"]'),
    offenders: offenders.slice(0, 3),
  });
})()`;

const records = [];
const record = (leg, mouth, m, shot) => {
  records.push({ leg, mouth, ...m, shot });
  console.log(`  [${leg}] w=${m.w} sw=${m.sw} cw=${m.cw} overX=${m.overX} shell=${m.shellOverX} title="${m.title}" offenders=${m.offenders.length}`);
};

console.log(`== t981 the dialog family's FOLD TIER — absorption across a SAMPLE at 320 ${GATE ? "(the GATE)" : "(the BEFORE witness)"} ==`);
mkdirSync(QA_DIR, { recursive: true });

/* ---- LEG 1: the job-inspector (the anchor) — the t975 law: open at
   WIDE (the card lives on the transform canvas), then narrow to 320. */
console.log("· leg 1: the job-inspector (the anchor)");
if (!(await freshOpenWide())) { console.log("FATAL: the wide viewport never held"); process.exit(2); }
const centered = await findAndCenter(ANCHOR);
if (!String(centered).startsWith("centered")) console.log(`  [inspector] the find bar did not center (${centered}) — falling back to the raw card click`);
const cardClick = await openInspectorHard(ANCHOR);
let insOpen = await poll(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(d => (d.textContent || '').includes('${ANCHOR}')); return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 4, 500);
if (!insOpen?.open) {
  records.push({ leg: "inspector", mouth: "job-card", blocked: String(cardClick) });
  console.log(`  [inspector] MOUTH-BLOCKED at wide (${cardClick}) — recorded honestly`);
} else {
  await narrowTo320();
  insOpen = await poll(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(d => (d.textContent || '').includes('${ANCHOR}')); return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 8, 500);
  if (!insOpen?.open) {
    const reClick = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${ANCHOR}'))?.querySelector('[role="button"][tabindex]')`);
    await sleep(900);
    insOpen = await poll(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(d => (d.textContent || '').includes('${ANCHOR}')); return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 8, 500);
    if (!insOpen?.open) console.log(`  [inspector] the narrow ghosted the dialog and the re-click refused (${reClick})`);
  }
  const m = insOpen?.open ? await poll(MEASURE, (v) => v && !v.err && v.isInspector, 10, 500) : null;
  if (m && !m.err) {
    sh(`${AB} screenshot ${QA_DIR}/t981-fold-inspector.png`);
    record("inspector", "job-card (wide-first)", m, "t981-fold-inspector.png");
  } else { records.push({ leg: "inspector", mouth: "job-card (wide-first)", blocked: "measure-never-resolved" }); console.log("  [inspector] measure never resolved at 320"); }
  await closeAllDialogs();
}

/* ---- LEG 2: the FSC compare dialog (the named family member) ----
   The compare mouth lives on a COMPLETED refine/postprocess job's FSC
   chart inside its inspector's RESULTS TAB (the mouth is not in the DOM
   until the tab is clicked — the BEFORE ride's own receipt). Wide-first
   (the same canvas law), then narrow WITH the stacked dialog up; re-click
   the compare mouth if the narrow ghosts it. Cards are tried
   refine/postprocess-FIRST (the chain's FSC carriers), cap eight. */
console.log("· leg 2: the fsc-compare dialog (the named member)");
if (!(await freshOpenWide())) { console.log("FATAL: viewport drift at leg 2"); process.exit(2); }
const cardNames = evalJson(`(() => {
  const cards = [...document.querySelectorAll('[data-job]')].filter(c => !(c.textContent || '').includes('${ANCHOR}'));
  /* the CLEAN name lives in .job-card-title — the button's textContent
     concatenates name+status+type and the find bar (and the inspector's
     own text) never contains the concatenation (the BEFORE ride's own
     receipt: every card stage failed on the 60-char concat). */
  const names = cards.map(c => (c.querySelector('.job-card-title')?.textContent || "").trim()).filter(Boolean);
  const fscFirst = names.filter(n => /refine|post-process|postprocess/i.test(n));
  const rest = names.filter(n => !/refine|post-process|postprocess/i.test(n));
  return JSON.stringify([...fscFirst, ...rest].slice(0, 8));
})()`) || [];
const names = Array.isArray(cardNames) ? cardNames : [];
let compareDone = false;
const tried = [];
for (const name of names) {
  if (compareDone) break;
  const stage = { name };
  tried.push(stage);
  await closeAllDialogs();
  stage.find = await findAndCenter(name);
  const opened = await openInspectorHard(name, 4);
  stage.opened = opened;
  if (!String(opened).startsWith("open@")) continue;
  stage.tab = await realClick(`[...document.querySelectorAll('[data-inspector-dialog] [role="tab"]')].find(t => (t.textContent || '').includes('Results'))`);
  await sleep(1200);
  const hasMouth = await poll(`(() => { const b = document.querySelector('[data-testid="fsc-compare-open"]'); return JSON.stringify({ has: !!b }); })()`, (v) => v.has === true, 8, 600);
  stage.mouth = hasMouth?.has === true;
  if (!hasMouth?.has) { await closeAllDialogs(); continue; }
  const cmpClick = await realClick(`document.querySelector('[data-testid="fsc-compare-open"]')`);
  stage.cmpClick = cmpClick;
  await sleep(900);
  let cmpOpen = await poll(`(() => { const d = document.querySelector('[data-testid="fsc-compare-list"]'); return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 8, 500);
  stage.stack = cmpOpen?.open === true;
  if (!cmpOpen?.open) { await closeAllDialogs(); continue; }
  await narrowTo320();
  cmpOpen = await poll(`(() => { const d = document.querySelector('[data-testid="fsc-compare-list"]'); return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 8, 500);
  stage.narrowSurvived = cmpOpen?.open === true;
  if (!cmpOpen?.open) {
    const reClick = await realClick(`document.querySelector('[data-testid="fsc-compare-open"]')`);
    stage.reClick = reClick;
    await sleep(900);
    cmpOpen = await poll(`(() => { const d = document.querySelector('[data-testid="fsc-compare-list"]'); return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 8, 500);
    if (!cmpOpen?.open) { console.log(`  [fsc-compare] the narrow ghosted the stack and the re-click refused (${reClick})`); await closeAllDialogs(); continue; }
  }
  const m = await poll(MEASURE, (v) => v && !v.err && v.hasCompareList, 10, 500);
  stage.measured = !!(m && !m.err);
  if (m && !m.err) {
    sh(`${AB} screenshot ${QA_DIR}/t981-fold-fsc-compare.png`);
    record("fsc-compare", `card:${name}`, m, "t981-fold-fsc-compare.png");
    compareDone = true;
  }
  await closeAllDialogs();
}
if (!compareDone) { records.push({ leg: "fsc-compare", mouth: "none-of-the-cards-carried-the-mouth", blocked: true, tried }); console.log(`  [fsc-compare] MOUTH-ABSENT — stages: ${JSON.stringify(tried)}`); }

/* ---- LEG 3: the shortcuts dialog (the help popover's CTA) ---- */
console.log("· leg 3: the shortcuts dialog (the help popover's CTA)");
if (!(await freshOpenAt320())) { console.log("FATAL: viewport drift at leg 3"); process.exit(2); }
const helpClick = await realClick(`document.querySelector('[aria-label="Help — how to use the workflow canvas"]')`);
await sleep(800);
const ctaClick = await realClick(`[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('View all keyboard shortcuts'))`);
await sleep(900);
const scMeasure = await poll(MEASURE, (v) => v && !v.err && !v.isInspector && !v.hasCmdk, 10, 500);
if (scMeasure && !scMeasure.err) {
  sh(`${AB} screenshot ${QA_DIR}/t981-fold-shortcuts.png`);
  record("shortcuts", "help-popover-cta", scMeasure, "t981-fold-shortcuts.png");
} else { records.push({ leg: "shortcuts", mouth: "help-popover-cta", blocked: `help=${helpClick} cta=${ctaClick}` }); console.log(`  [shortcuts] MOUTH-BLOCKED (help=${helpClick} cta=${ctaClick})`); }
await escAll(3);

/* ---- LEG 4: the help-guide dialog (the same popover's other CTA) ---- */
console.log("· leg 4: the help-guide dialog (the popover's other CTA)");
if (!(await freshOpenAt320())) { console.log("FATAL: viewport drift at leg 4"); process.exit(2); }
const helpClick2 = await realClick(`document.querySelector('[aria-label="Help — how to use the workflow canvas"]')`);
await sleep(800);
const ctaClick2 = await realClick(`[...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('Read the full guide'))`);
await sleep(900);
const hgMeasure = await poll(MEASURE, (v) => v && !v.err && !v.isInspector && !v.hasCmdk, 10, 500);
if (hgMeasure && !hgMeasure.err) {
  sh(`${AB} screenshot ${QA_DIR}/t981-fold-help-guide.png`);
  record("help-guide", "help-popover-cta", hgMeasure, "t981-fold-help-guide.png");
} else { records.push({ leg: "help-guide", mouth: "help-popover-cta", blocked: `help=${helpClick2} cta=${ctaClick2}` }); console.log(`  [help-guide] MOUTH-BLOCKED (help=${helpClick2} cta=${ctaClick2})`); }
await escAll(3);

/* ---- LEG 5: the command palette (the ⌘/Ctrl+K door) ---- */
console.log("· leg 5: the command palette (the Ctrl+K door)");
if (!(await freshOpenAt320())) { console.log("FATAL: viewport drift at leg 5"); process.exit(2); }
sh(`${AB} press Control+k`);
await sleep(900);
let palOpen = await poll(`(() => { const i = document.querySelector('[cmdk-input]'); return JSON.stringify({ open: !!i }); })()`, (v) => v.open === true, 6, 500);
if (!palOpen?.open) {
  evalJs(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, metaKey: true, bubbles: true })); return 'dispatched'; })()`);
  await sleep(900);
  palOpen = await poll(`(() => { const i = document.querySelector('[cmdk-input]'); return JSON.stringify({ open: !!i }); })()`, (v) => v.open === true, 6, 500);
}
if (palOpen?.open) {
  const m = await poll(MEASURE, (v) => v && !v.err && v.hasCmdk, 10, 500);
  if (m && !m.err) {
    sh(`${AB} screenshot ${QA_DIR}/t981-fold-palette.png`);
    record("palette", "ctrl-k", m, "t981-fold-palette.png");
  } else { records.push({ leg: "palette", mouth: "ctrl-k", blocked: "measure-never-resolved" }); console.log("  [palette] measure never resolved"); }
} else { records.push({ leg: "palette", mouth: "ctrl-k", blocked: true }); console.log("  [palette] MOUTH-BLOCKED — the palette never opened"); }
await escAll(2);

/* ---- the census's verdicts ---- */
const measured = records.filter((r) => r.leg && !r.blocked && r.overX !== undefined);
const leaky = measured.filter((r) => r.overX === true || r.shellOverX === true);
console.log(`\n== the fold-tier census: ${measured.length} faces measured, ${leaky.length} leaky ==`);
ok("the sample is not empty (at least three faces measured)", measured.length >= 3, `measured=${measured.length}`);
for (const r of measured) ok(`[${r.leg}] absorbs the fold (overX FALSE + shellOverX FALSE)`, r.overX === false && r.shellOverX === false, `sw=${r.sw} cw=${r.cw}`);
if (GATE) {
  ok("GATE every sampled face measured (five mouths, none blocked)", measured.length === 5, `measured=${measured.length}`);
  ok("GATE the family absorbs the fold (zero leaky faces)", leaky.length === 0, leaky.map((r) => r.leg).join(","));
} else if (leaky.length) {
  console.log(`\n  the BEFORE witness found ${leaky.length} leaky face(s) — the offenders above name the cures`);
}

writeFileSync(RECEIPT, JSON.stringify({ at: new Date().toISOString(), mode: GATE ? "GATE" : "BEFORE", viewport: 320, sample: records, pass, fail }, null, 2));
console.log(`\nreceipt: ${RECEIPT} (${pass} ok, ${fail} fail)`);
process.exit(GATE && fail > 0 ? 1 : 0);
