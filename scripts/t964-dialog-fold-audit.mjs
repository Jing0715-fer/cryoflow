#!/usr/bin/env node
/**
 * t964 — the 320-fold audit ACROSS THE DIALOGS: the t963 probe's
 * offender-walk (walk the dialog's DOM, skip the sr-only self-shadows,
 * rank by over-width) was pointed at ONE dialog last window; this audit
 * aims it at SIX global-mouth dialogs and ranks what falls out.
 *
 * The six mouths (each a stable aria-label trigger on the app chrome —
 * openable on ANY world, no results/jobs required):
 *   storage overview · system diagnostics · session QC report ·
 *   remote clusters (SSH) · help guide · finish-knock settings
 *
 * THE JUDGMENT (the t963 law, generalized): an offender whose
 * overflow is contained by its own overflow/truncate (a self-clipping
 * container) is 良性 — the dialog's own scrollWidth is the verdict; a
 * dialog that overflows ITSELF (dialogOverX true) carries the disease
 * UP the chain to the viewport, and its biggest non-self-clipping
 * offender is the cure's address.
 *
 *   node scripts/t964-dialog-fold-audit.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t964-dialog-fold-audit.json");

const TARGETS = [
  { label: "Project storage overview", name: "storage-dialog" },
  { label: "System diagnostics", name: "system-diagnostics-dialog" },
  { label: "Session QC report", name: "session-report-dialog" },
  { label: "Remote clusters (SSH)", name: "remote-cluster-dialog" },
  { label: "Help — how to use the workflow", name: "help-guide-dialog" },
  { label: "Finish knock settings", name: "finish-knock-dialog" },
];

const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim(); } catch (e) { return String(e?.stdout ?? e); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) => {
  try { return execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim(); }
  catch (e) { return String(e?.stdout ?? "") || "null"; }
};
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
/* the real-mouse click (the t963 law: DOM click() opens NOTHING) */
const realClick = async (findExpr, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const pos = evalJson(`(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0) return null; const inV = r.x >= 0 && r.right <= window.innerWidth && r.y >= 0 && r.bottom <= window.innerHeight; return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), in: inV }); })()`);
    if (pos?.in) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    if (pos) { evalJs(`(() => { const el = (${findExpr}); el?.scrollIntoView({ block: 'center', behavior: 'instant' }); return 'siv'; })()`); }
    await sleep(600);
  }
  return "NEVER-VISIBLE";
};

const walkExpr = `(() => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
  if (!dlg) return JSON.stringify({ open: false });
  const offenders = [];
  const selfClipping = (el) => {
    const s = getComputedStyle(el);
    if (typeof el.className === "string" && el.className.includes("sr-only")) return true;
    return s.overflowX !== "visible" || s.overflowY !== "visible";
  };
  const walk = (el, depth) => {
    if (depth > 20) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 100),
        sw: el.scrollWidth, cw: el.clientWidth, over: el.scrollWidth - el.clientWidth,
        text: (el.textContent || "").trim().slice(0, 60),
        selfClip: selfClipping(el),
      });
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(dlg, 0);
  offenders.sort((a, b) => b.over - a.over);
  return JSON.stringify({
    open: true,
    dialogW: Math.round(dlg.getBoundingClientRect().width),
    dialogOverX: dlg.scrollWidth > dlg.clientWidth + 1,
    dialogSW: dlg.scrollWidth, dialogCW: dlg.clientWidth,
    offenders: offenders.slice(0, 10),
  });
})()`;

console.log("== t964 the 320-fold audit across the dialogs ==");
sh(`${AB} open ${BASE}/`);
await sleep(2500);

const report = [];
for (const t of TARGETS) {
  const row = { name: t.name, label: t.label };
  // open: the trigger may only exist on the wide chrome — go wide, click,
  // then fold BEFORE measuring (the dialog measures at whatever width the
  // viewport is when it mounts)
  sh(`${AB} set viewport 1280 800`);
  await sleep(700);
  const clicked = await realClick(`(() => [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '') === ${JSON.stringify(t.label)}) ?? null)()`);
  row.clicked = clicked;
  await sleep(1500);
  const openWide = evalJson(walkExpr);
  if (!openWide?.open) { row.error = "dialog never opened"; report.push(row); console.log(`  ${t.name}: NEVER-OPENED (${clicked})`); try { sh(`${AB} press Escape`); } catch {} continue; }

  sh(`${AB} set viewport 320 640`);
  await sleep(1200);
  const fold = evalJson(walkExpr);
  if (!fold?.open) { row.error = "dialog vanished at 320"; report.push(row); console.log(`  ${t.name}: VANISHED at 320`); try { sh(`${AB} press Escape`); } catch {} continue; }

  row.wide = { w: openWide.dialogW, overX: openWide.dialogOverX, sw: openWide.dialogSW };
  row.fold = {
    w: fold.dialogW, overX: fold.dialogOverX, sw: fold.dialogSW, cw: fold.dialogCW,
    offenders: fold.offenders.filter((o) => o.selfClip === false).slice(0, 4),
    selfClippingCount: fold.offenders.filter((o) => o.selfClip === true).length,
  };
  row.verdict = fold.dialogOverX ? "OVERFLOW" : "clean";
  report.push(row);
  console.log(`  ${t.name}: ${row.verdict} (wide ${openWide.dialogW}px no-overflow=${!openWide.dialogOverX} → 320 sw=${fold.dialogSW} cw=${fold.dialogCW}${fold.dialogOverX ? ` OVER ${fold.dialogSW - fold.dialogCW}px` : ""})`);
  for (const o of row.fold.offenders) console.log(`      · ${o.tag}.${o.cls.slice(0, 60)} +${o.over}px "${o.text.slice(0, 40)}"`);
  try { sh(`${AB} press Escape`); } catch {}
  await sleep(700);
}

mkdirSync(QA_DIR, { recursive: true });
writeFileSync(RECEIPT, JSON.stringify({ viewport: 320, targets: report }, null, 2));
const bad = report.filter((r) => r.verdict === "OVERFLOW");
console.log(`== audit done: ${report.length - bad.length}/${report.length} clean, ${bad.length} overflow${bad.length ? ` — ${bad.map((b) => b.name).join(", ")}` : ""} ==`);
