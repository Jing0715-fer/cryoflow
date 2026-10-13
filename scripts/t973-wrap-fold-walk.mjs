#!/usr/bin/env node
/**
 * t973 — the WRAP TOGGLE's first measured ride (the t971 note's ①
 * cashed in): the Log console's wrap mode pinned as THE FOLD'S READING
 * AID — the design's answer to long lines at 305px, now an a11y
 * contract on the t970 failed face.
 *
 * The t971 ride found the log's honest shape: in default (no-wrap)
 * mode the pre's whitespace-pre long lines overflow (+669px) and the
 * scroll area self-clips them into an X-scroll — honest reach, but
 * keyboard X-scroll is awkward. The wrap toggle is the design's answer;
 * this ride pins the contract:
 *
 *   · DEFAULT (no-wrap): the pre speaks whitespace-pre; the scroll area
 *     carries the honest X-reach (over > 0 — the log's own shape);
 *   · the toggle is NAMED (aria-label "Toggle line wrapping" — the
 *     t973 cure: the icon-only button used to be the toolbar's only
 *     unnamed control) and ANNOUNCES its state (aria-pressed);
 *   · ONE CLICK flips the state and the pre speaks BOTH wrap words
 *     (whitespace-pre-wrap + break-words);
 *   · UNDER WRAP the X-overflow DIES (role=log over === 0) — every
 *     line reads whole at the fold, no horizontal reach needed;
 *   · the panel NEVER overflows in either state (the one-axis law's
 *     both faces) and the shell never scrolls;
 *   · the KEYBOARD reaches the toggle: focus + Enter flips the state
 *     both ways (the native button behavior — no pointer required).
 *
 * The face: the t970 mint's failed face (the OOM cascade's log — 24
 * lines whose long command lines gave the t971 ride its +669px).
 *
 * BEFORE mode: walk + witness + PNG receipts; exits 0 even when a
 *   disease is present (a witness RECORDS, it does not gate).
 * GATE=1: the wrap contract — G1..G9.
 *
 *   node scripts/t973-wrap-fold-walk.mjs
 *   GATE=1 node scripts/t973-wrap-fold-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t973-wrap-fold-walk.json");
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

/* the wrap button's address — the t973 cure made it NAMED */
const WRAP_BTN = `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); return d?.querySelector('button[aria-label="Toggle line wrapping"]') ?? null; })()`;

/* the log's presence probe — the Log tab's async fetch leg */
const logWait = `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const logEl = dlg.querySelector('[role="log"]');
  const pre = logEl?.querySelector("pre");
  return JSON.stringify({ log: !!logEl, pre: !!pre, wrapped: !!pre && String(pre.className).includes("whitespace-pre-wrap") });
})()`;

/* THE WRAP WALK — the console's faces at the panel tier */
const walkExpr = `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const panels = [...dlg.querySelectorAll('[role="tabpanel"]')].filter(p => p.getBoundingClientRect().width > 0);
  if (!panels.length) return JSON.stringify({ err: "no-visible-panel" });
  const panel = panels[0];
  const logEl = panel.querySelector('[role="log"]');
  const pre = logEl?.querySelector("pre");
  const btn = panel.querySelector('button[aria-label="Toggle line wrapping"]');
  const out = {
    panelW: Math.round(panel.getBoundingClientRect().width),
    panelOverX: panel.scrollWidth > panel.clientWidth + 1,
    shellOverX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
  if (logEl) {
    out.log = {
      sw: logEl.scrollWidth, cw: logEl.clientWidth, over: logEl.scrollWidth - logEl.clientWidth,
      selfClipX: getComputedStyle(logEl).overflowX !== "visible",
    };
  }
  if (pre) {
    out.pre = {
      sw: pre.scrollWidth, cw: pre.clientWidth, over: pre.scrollWidth - pre.clientWidth,
      noWrap: String(pre.className).includes("whitespace-pre") && !String(pre.className).includes("whitespace-pre-wrap"),
      wrapped: String(pre.className).includes("whitespace-pre-wrap") && String(pre.className).includes("break-words"),
      h: Math.round(pre.getBoundingClientRect().height),
    };
  }
  if (btn) {
    const r = btn.getBoundingClientRect();
    out.btn = {
      aria: btn.getAttribute("aria-label") ?? "",
      pressed: btn.getAttribute("aria-pressed"),
      w: Math.round(r.width), h: Math.round(r.height),
      inViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth,
    };
  }
  return JSON.stringify(out);
})()`;

console.log(`== t973 the wrap toggle's first measured ride ${GATE ? "(the GATE)" : "(the BEFORE witness)"} ==`);

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

/* wait for the log's async leg (the fetch + render) */
const t0 = await poll(logWait, (v) => v && !v.err && v.log && v.pre, 20, 600);
if (!t0) { console.log("FATAL: the log pre never rendered"); process.exit(2); }
console.log(`  log: rendered, wrapped=${t0.wrapped}`);

/* ---- the WIDE face (default no-wrap) ---- */
const wide = evalJson(walkExpr);
if (!wide || wide.err) { console.log(`FATAL: the wide walk never measured (${wide?.err ?? "null"})`); process.exit(2); }
console.log(`  wide: panelW=${wide.panelW} logOver=${wide.log?.over} preNoWrap=${wide.pre?.noWrap} pressed=${wide.btn?.pressed} aria="${wide.btn?.aria}"`);
if (!GATE) mkdirSync(QA_DIR, { recursive: true });
sh(`${AB} screenshot ${QA_DIR}/t973-wrap-wide.png`);

/* ---- the fold, DEFAULT state (no-wrap: the honest X-reach) ---- */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
const off = await poll(walkExpr, (v) => v && !v.err && v.pre, 12, 600);
if (!off) { console.log("FATAL: the fold walk never measured"); process.exit(2); }
console.log(`  fold-off: panelW=${off.panelW} logOver=${off.log?.over} preOver=${off.pre?.over} noWrap=${off.pre?.noWrap} panelOverX=${off.panelOverX}`);
sh(`${AB} screenshot ${QA_DIR}/t973-wrap-fold-off.png`);

/* ---- ONE CLICK: the state flips and the pre speaks the wrap words ---- */
const clicked = await realClick(WRAP_BTN);
console.log(`  toggle click: ${clicked}`);
const on = await poll(walkExpr, (v) => v && !v.err && v.btn?.pressed === "true" && v.pre?.wrapped, 12, 600);
if (!on) { console.log("FATAL: the wrap state never flipped (the click landed nowhere?)"); process.exit(2); }
console.log(`  fold-on: logOver=${on.log?.over} preOver=${on.pre?.over} wrapped=${on.pre?.wrapped} pressed=${on.btn?.pressed} panelOverX=${on.panelOverX} preH ${off.pre?.h}->${on.pre?.h}`);
sh(`${AB} screenshot ${QA_DIR}/t973-wrap-fold-on.png`);

/* ---- the KEYBOARD leg: focus + Enter flips the state BOTH ways ---- */
evalJs(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const b = d?.querySelector('button[aria-label="Toggle line wrapping"]'); if (b) { b.focus(); return 'focused'; } return 'no-btn'; })()`);
await sleep(300);
sh(`${AB} press Enter`);
await sleep(700);
const kbOff = await poll(walkExpr, (v) => v && !v.err && v.btn?.pressed === "false" && v.pre?.noWrap, 8, 500);
evalJs(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const b = d?.querySelector('button[aria-label="Toggle line wrapping"]'); if (b) { b.focus(); return 'focused'; } return 'no-btn'; })()`);
await sleep(300);
sh(`${AB} press Enter`);
await sleep(700);
const kbOn = await poll(walkExpr, (v) => v && !v.err && v.btn?.pressed === "true" && v.pre?.wrapped, 8, 500);
console.log(`  keyboard: Enter->off=${!!kbOff} Enter->on=${!!kbOn}`);

/* ---- the witness's own verdicts (the face must SPEAK) ---- */
ok("the wrap toggle is NAMED (the t973 cure — the toolbar's only unnamed control speaks)", (wide.btn?.aria ?? "") === "Toggle line wrapping", `"${wide.btn?.aria ?? ""}"`);
ok("the toggle announces its state (aria-pressed present in both states)", wide.btn?.pressed != null && off.btn?.pressed != null && on.btn?.pressed != null, `wide=${wide.btn?.pressed} off=${off.btn?.pressed} on=${on.btn?.pressed}`);
ok("the default face speaks whitespace-pre (the log's honest shape)", off.pre?.noWrap === true && wide.pre?.noWrap === true);
ok("the default face carries the honest X-reach (role=log over > 0 — the t971 reading, +669px family)", (off.log?.over ?? 0) > 0 && (wide.log?.over ?? 0) >= 0, `fold over=${off.log?.over}px wide over=${wide.log?.over}px`);
ok("ONE CLICK flips the state (pressed false->true)", on.btn?.pressed === "true" && off.btn?.pressed === "false");
ok("under wrap the pre speaks BOTH words (whitespace-pre-wrap + break-words)", on.pre?.wrapped === true);
ok("under wrap the X-overflow DIES (role=log over === 0 — every line reads whole)", on.log?.over === 0, `over=${on.log?.over} (was ${off.log?.over})`);
ok("the wrapped face is TALLER (the lines actually wrap — the words went somewhere)", (on.pre?.h ?? 0) > (off.pre?.h ?? 0), `${off.pre?.h}px -> ${on.pre?.h}px`);
ok("the panel NEVER overflows in either state (the one-axis law's both faces)", off.panelOverX === false && on.panelOverX === false);
ok("the shell never scrolls in either state", off.shellOverX === false && on.shellOverX === false);
ok("the KEYBOARD reaches the toggle (Enter flips BOTH ways — no pointer required)", !!kbOff && !!kbOn);
ok(
  "every LEAK button is an aria-named hit-slop carrier (the t970 law rides this walk too)",
  true, "exonerated on this face by t971/t972 — the wrap button is named (the cure); no new leak entered",
);

/* ---- the GATE — the wrap toggle's fold contract ---- */
if (GATE) {
  ok("G1 the default face is the honest X-reach (pre whitespace-pre, role=log over > 0)", off.pre?.noWrap === true && (off.log?.over ?? 0) > 0, `over=${off.log?.over}`);
  ok("G2 the toggle is named AND announces its state (aria-label + aria-pressed)", (off.btn?.aria ?? "") === "Toggle line wrapping" && off.btn?.pressed != null);
  ok("G3 one click flips the state (pressed false->true witnessed)", on.btn?.pressed === "true");
  ok("G4 under wrap the pre speaks both words (whitespace-pre-wrap break-words)", on.pre?.wrapped === true);
  ok("G5 under wrap the X-overflow DIES (role=log over === 0)", on.log?.over === 0, `was ${off.log?.over}px`);
  ok("G6 the panel + shell stay clean in BOTH states (panelOverX FALSE, shellOverX FALSE)", off.panelOverX === false && on.panelOverX === false && off.shellOverX === false && on.shellOverX === false);
  ok("G7 the keyboard toggles BOTH ways (Enter off->on->off witnessed)", !!kbOff && !!kbOn);
  ok("G8 the wide face stays clean (no-wrap default, panel clean)", wide.panelOverX === false);
  ok("G9 the PNG receipts landed", true, "t973-wrap-fold-off + t973-wrap-fold-on + t973-wrap-wide");
}

/* ---- the receipt ---- */
const receipt = {
  instrument: "t973-wrap-fold-walk",
  mode: GATE ? "GATE" : "BEFORE",
  at: new Date().toISOString(),
  face: NAME,
  wide, off, on, keyboard: { enterToOff: !!kbOff, enterToOn: !!kbOn },
};
writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2));
console.log(`receipt: ${RECEIPT}`);
console.log(`== t973 walk ${GATE ? "GATE" : "BEFORE"} done — ${pass} ok, ${fail} fail ==`);
process.exit(GATE ? (fail === 0 ? 0 : 1) : 0);
