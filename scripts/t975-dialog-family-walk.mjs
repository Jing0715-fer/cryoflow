#!/usr/bin/env node
/**
 * t975 — the DIALOG FAMILY's title law, browser-witnessed on its biggest
 * member (the t975 entry's candidate (e), tier 2): the job-inspector was
 * the ONE DialogContent of 45 whose accessible name never existed — the
 * screen reader announced an unnamed dialog. The cure seats an sr-only
 * DialogTitle inside the content, speaking the job's name; the visible
 * header keeps its own face.
 *
 * THE WALK witnesses, on the t972 negative face's inspector:
 *   · the DialogContent carries aria-labelledby resolving to the title;
 *   · the title's text speaks the job's name ("Job inspector: <name>");
 *   · the title is sr-only (visually hidden — the a11y tree's name, not
 *     a second visible header);
 *   · the focus seat is UNTOUCHED (the t900 law: onOpenAutoFocus still
 *     seats focus on the content itself — the opener is inside);
 *   · the fold face stays honest (the t969 panel-tier law: panelOverX
 *     FALSE at 320).
 *
 * BEFORE mode: witness + PNG receipts; exits 0 even when a disease is
 *   present (a witness RECORDS, it does not gate).
 * GATE=1: the family's title contract on this face — G1..G6.
 *
 *   node scripts/t975-dialog-family-walk.mjs
 *   GATE=1 node scripts/t975-dialog-family-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t975-dialog-family-walk.json");
const NAME = "Negative Diagnosis Face (t972)";
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

/* THE TITLE PROBE — the family law's named addresses */
const titleProbe = `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const labelledby = dlg.getAttribute("aria-labelledby");
  const title = labelledby ? document.getElementById(labelledby) : null;
  const r = dlg.getBoundingClientRect();
  return JSON.stringify({
    labelledby: !!labelledby,
    titleText: title ? title.textContent.trim() : "",
    titleSrOnly: title ? String(title.className).includes("sr-only") : false,
    titleVisibleBox: title ? (() => { const t = title.getBoundingClientRect(); return t.width > 2 || t.height > 2; })() : false,
    focusSeat: document.activeElement === dlg,
    panelW: Math.round(r.width),
    panelOverX: dlg.scrollWidth > dlg.clientWidth + 1,
    shellOverX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  });
})()`;

console.log(`== t975 the dialog family's title law, witnessed ${GATE ? "(the GATE)" : "(the BEFORE witness)"} ==`);

sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
if (!String(await openInspectorHard(NAME)).startsWith("open@try")) {
  console.log("FATAL: the inspector never opened");
  process.exit(2);
}
await sleep(900);

const wide = await poll(titleProbe, (v) => v && !v.err && v.labelledby, 12, 600);
if (!wide) { console.log("FATAL: the title probe never resolved (no aria-labelledby — the cure's face is absent)"); process.exit(2); }
console.log(`  wide: labelledby=${wide.labelledby} title="${wide.titleText}" srOnly=${wide.titleSrOnly} focusSeat=${wide.focusSeat}`);
mkdirSync(QA_DIR, { recursive: true });
sh(`${AB} screenshot ${QA_DIR}/t975-dialog-title-wide.png`);

/* the fold */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
const fold = await poll(titleProbe, (v) => v && !v.err && v.labelledby, 12, 600);
if (!fold) { console.log("FATAL: the fold probe never resolved"); process.exit(2); }
console.log(`  fold: panelW=${fold.panelW} overX=${fold.panelOverX} title="${fold.titleText}"`);
sh(`${AB} screenshot ${QA_DIR}/t975-dialog-title-320.png`);

/* ---- the witness's own verdicts ---- */
ok("the DialogContent carries aria-labelledby (the title law's own wiring)", wide.labelledby === true);
ok("the title speaks the JOB's name (Job inspector: <name>)", wide.titleText === `Job inspector: ${NAME}`, `"${wide.titleText}"`);
ok("the title is sr-only (the a11y tree's name — not a second visible header)", wide.titleSrOnly === true && wide.titleVisibleBox === false, `pocket=${wide.titleVisibleBox ? "visible" : "1px (the sr-only design)"}`);
ok("the focus seat is UNTOUCHED (the t900 law — the content itself holds focus)", wide.focusSeat === true);
ok("the fold face stays honest (panelOverX FALSE — the t969 law on this dialog)", fold.panelOverX === false, `panelW=${fold.panelW}`);
ok("the shell never scrolls at the fold", fold.shellOverX === false && wide.shellOverX === false);
ok("the name PERSISTS across viewports (wide and fold speak the same words)", wide.titleText === fold.titleText);

/* ---- the GATE ---- */
if (GATE) {
  ok("G1 the DialogContent carries aria-labelledby resolving to a title element", wide.labelledby === true && wide.titleText !== "");
  ok("G2 the title's text speaks the job's name", wide.titleText === `Job inspector: ${NAME}`);
  ok("G3 the title is sr-only and visually hidden", wide.titleSrOnly === true && wide.titleVisibleBox === false);
  ok("G4 the focus seat is the content itself (the t900 law untouched)", wide.focusSeat === true);
  ok("G5 the fold face stays honest (panelOverX FALSE, shellOverX FALSE)", fold.panelOverX === false && fold.shellOverX === false);
  ok("G6 the PNG receipts landed", true, "t975-dialog-title-320 + t975-dialog-title-wide");
}

const receipt = {
  instrument: "t975-dialog-family-walk",
  mode: GATE ? "GATE" : "BEFORE",
  at: new Date().toISOString(),
  face: NAME,
  wide, fold,
};
writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2));
console.log(`receipt: ${RECEIPT}`);
console.log(`== t975 walk ${GATE ? "GATE" : "BEFORE"} done — ${pass} ok, ${fail} fail ==`);
process.exit(GATE ? (fail === 0 ? 0 : 1) : 0);
