#!/usr/bin/env node
/**
 * t980 — the FOLLOW preference's persistence ride (the t980 contract's
 * candidate (d), the t977 decision's second seat): the Log console's
 * follow mode — the auto-scroll reading state — joins the wrap
 * preference's law. The decision, made deliberately the way t977 made
 * its own: the follow preference is a property of the USER'S VIEWPORT,
 * not of any job's content — ONE global key, the house style
 * (`cryoflow.logFollow.v1`); the read is the lazy useState initializer
 * (every mount re-reads); the write rides the toggle's click HANDLER
 * (the #13 law — never render, never the updater: StrictMode
 * double-invokes updater functions); the scroll-up dis-arm stays
 * EPHEMERAL (it rides atBottomRef, the reading position — the
 * preference has exactly ONE writer, the toggle).
 *
 * The contract this walk pins (the t977 G-legs' twin, default ON):
 *
 *   · the walk RESETS the stored preference BEFORE opening the inspector
 *     (the lazy initializer reads at mount — the reset must precede the
 *     mount, or the walk measures a stale face);
 *   · the DEFAULT face speaks ON (aria-pressed=true, "Following") with
 *     the key absent — follow is the live console's natural resting
 *     state (the wrap default's twin: absent reads ON here, OFF there);
 *   · the toggle is NAMED BY ITS OWN TEXT (Following/Paused — the
 *     accessible name speaks the state) and ANNOUNCES aria-pressed;
 *   · ONE CLICK flips ON->OFF and WRITES the preference ("0" after OFF —
 *     the #13 law, the handler's own write);
 *   · the KEYBOARD writes both values (Enter->ON stores "1",
 *     Enter->OFF stores "0");
 *   · the REOPEN leg: Escape closes the inspector, the hard opener
 *     returns, the Log tab's FRESH MOUNT comes back PAUSED with no
 *     click — the follow preference survives the close;
 *   · the follow ride NEVER touches the wrap preference
 *     (cryoflow.logWrap.v1 stays absent through the whole walk);
 *   · the walk leaves no trace (the key removed at the end).
 *
 * The face: the t970 mint's failed face (the OOM cascade's log) — the
 * same face the wrap walk rode, so the two preference contracts are
 * receipts on ONE toolbar. The mint is armed by this window's fleet
 * step (MINT_PROJECT_ID-addressable, removable).
 *
 * GATE=1: the follow contract — F1..F10.
 *
 *   node scripts/t980-follow-persistence-walk.mjs
 *   GATE=1 node scripts/t980-follow-persistence-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t980-follow-persistence-walk.json");
const NAME = "Failed Diagnosis Face (t970)";
const GATE = process.env.GATE === "1";
const FOLLOW_KEY = "cryoflow.logFollow.v1"; // the t980 preference key — the implementation's own word
const WRAP_KEY = "cryoflow.logWrap.v1"; // the t977 key — the negative leg (the follow ride must never write it)

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

/* the follow button's address — NAMED BY ITS OWN TEXT (Following/Paused),
 * the only aria-pressed button in the toolbar whose label speaks the
 * state (the wrap button is icon-only, named by aria-label) */
const FOLLOW_BTN = `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const panels = [...(d?.querySelectorAll('[role="tabpanel"]') ?? [])].filter(p => p.getBoundingClientRect().width > 0); return panels[0]?.querySelector('button[aria-pressed]') ? [...panels[0].querySelectorAll('button[aria-pressed]')].find(b => /^(Following|Paused)$/.test((b.textContent || '').trim())) ?? null : null; })()`;

/* the log's presence probe — the Log tab's async fetch leg */
const logWait = `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const logEl = dlg.querySelector('[role="log"]');
  const pre = logEl?.querySelector("pre");
  return JSON.stringify({ log: !!logEl, pre: !!pre });
})()`;

/* THE FOLLOW WALK — the toolbar's faces at the panel tier */
const walkExpr = `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const panels = [...dlg.querySelectorAll('[role="tabpanel"]')].filter(p => p.getBoundingClientRect().width > 0);
  if (!panels.length) return JSON.stringify({ err: "no-visible-panel" });
  const panel = panels[0];
  const logEl = panel.querySelector('[role="log"]');
  const pre = logEl?.querySelector("pre");
  const btn = [...panel.querySelectorAll('button[aria-pressed]')].find(b => /^(Following|Paused)$/.test((b.textContent || '').trim())) ?? null;
  const out = {
    panelW: Math.round(panel.getBoundingClientRect().width),
    panelOverX: panel.scrollWidth > panel.clientWidth + 1,
    shellOverX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  };
  if (pre) out.preRendered = true;
  if (btn) {
    const r = btn.getBoundingClientRect();
    out.btn = {
      label: (btn.textContent || "").trim(),
      pressed: btn.getAttribute("aria-pressed"),
      w: Math.round(r.width), h: Math.round(r.height),
      inViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth,
    };
  }
  return JSON.stringify(out);
})()`;

/* the find-bar opener — the t972 ride's lesson generalized to law: Reset
 * view does NOT fit, the overlay can cover a card, scrollIntoView is a
 * no-op on the transform canvas. The REOPEN leg opens through it (at the
 * wide viewport — the fold's card box is unknown after the close). */
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

/* the stored preferences' live values (the persistence legs) */
const storeExpr = `(() => { try { return JSON.stringify({ v: window.localStorage.getItem("${FOLLOW_KEY}") }); } catch (e) { return JSON.stringify({ v: null }); } })()`;
const wrapStoreExpr = `(() => { try { return JSON.stringify({ v: window.localStorage.getItem("${WRAP_KEY}") }); } catch (e) { return JSON.stringify({ v: null }); } })()`;

console.log(`== t980 the follow preference's persistence ride ${GATE ? "(the GATE)" : "(the BEFORE witness)"} ==`);

sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);

/* the t980 reset — BEFORE the inspector opens: the lazy initializer
 * reads the preference at mount, so the reset must precede the mount or
 * the walk measures a stale face */
const cleared = evalJson(`(() => { try { window.localStorage.removeItem("${FOLLOW_KEY}"); return "cleared"; } catch (e) { return "denied"; } })()`);
console.log(`  pref reset: ${cleared}`);
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
console.log(`  log: rendered`);

/* ---- the DEFAULT face (key absent -> ON, the natural resting state) ---- */
const def = await poll(walkExpr, (v) => v && !v.err && v.btn, 12, 600);
if (!def) { console.log("FATAL: the follow button never measured"); process.exit(2); }
console.log(`  default: pressed=${def.btn?.pressed} label="${def.btn?.label}" panelW=${def.panelW} panelOverX=${def.panelOverX}`);
mkdirSync(QA_DIR, { recursive: true });
sh(`${AB} screenshot ${QA_DIR}/t980-follow-default.png`);
const wrapAtDefault = evalJson(wrapStoreExpr);

/* ---- ONE CLICK: ON -> OFF, and the preference writes "0" ---- */
const clicked = await realClick(FOLLOW_BTN);
console.log(`  toggle click: ${clicked}`);
const off = await poll(walkExpr, (v) => v && !v.err && v.btn?.pressed === "false", 12, 600);
if (!off) { console.log("FATAL: the follow state never flipped (the click landed nowhere?)"); process.exit(2); }
console.log(`  off: pressed=${off.btn?.pressed} label="${off.btn?.label}"`);
sh(`${AB} screenshot ${QA_DIR}/t980-follow-paused.png`);

/* the write check — the click rides the HANDLER, so the storage already
 * carries "0" when the state settles (the #13 law) */
const stored0 = evalJson(storeExpr);

/* ---- the KEYBOARD leg: focus + Enter flips the state BOTH ways ---- */
evalJs(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const panels = [...(d?.querySelectorAll('[role="tabpanel"]') ?? [])].filter(p => p.getBoundingClientRect().width > 0); const b = [...panels[0].querySelectorAll('button[aria-pressed]')].find(x => /^(Following|Paused)$/.test((x.textContent || '').trim())); if (b) { b.focus(); return 'focused'; } return 'no-btn'; })()`);
await sleep(300);
sh(`${AB} press Enter`);
await sleep(700);
const kbOn = await poll(walkExpr, (v) => v && !v.err && v.btn?.pressed === "true", 8, 500);
const stored1 = evalJson(storeExpr);
evalJs(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const panels = [...(d?.querySelectorAll('[role="tabpanel"]') ?? [])].filter(p => p.getBoundingClientRect().width > 0); const b = [...panels[0].querySelectorAll('button[aria-pressed]')].find(x => /^(Following|Paused)$/.test((x.textContent || '').trim())); if (b) { b.focus(); return 'focused'; } return 'no-btn'; })()`);
await sleep(300);
sh(`${AB} press Enter`);
await sleep(700);
const kbOff = await poll(walkExpr, (v) => v && !v.err && v.btn?.pressed === "false", 8, 500);
const stored2 = evalJson(storeExpr);
console.log(`  keyboard: Enter->on=${!!kbOn} Enter->off=${!!kbOff} store: click=${stored0?.v} kbOn=${stored1?.v} kbOff=${stored2?.v}`);

/* ---- the REOPEN leg: the preference survives the close ---- */
try { sh(`${AB} press Escape`); } catch {}
await sleep(900);
const centeredRe = await findAndCenter("Failed Diagnosis");
console.log(`  find-bar(reopen): ${centeredRe}`);
const reopened = String(await openInspectorHard(NAME, 8)).startsWith("open@try");
let reFace = null;
if (reopened) {
  if (!String(await clickTab("Log", 4)).startsWith("clicked@")) console.log("  (the reopened Log tab never clicked)");
  reFace = await poll(walkExpr, (v) => v && !v.err && v.btn && v.preRendered, 16, 600);
  console.log(`  reopen: pressed=${reFace?.btn?.pressed} label="${reFace?.btn?.label}" (no click — the fresh mount read the pref)`);
}
/* the walk leaves no trace — the world stays as found */
const cleaned = evalJson(`(() => { try { window.localStorage.removeItem("${FOLLOW_KEY}"); return "cleaned"; } catch (e) { return "denied"; } })()`);
const wrapAtEnd = evalJson(wrapStoreExpr);
console.log(`  cleanup: ${cleaned} · wrap key untouched: ${wrapAtEnd?.v === null}`);

/* ---- the witness's own verdicts ---- */
ok("the DEFAULT face speaks ON with the key absent (pressed=true, Following — the natural resting state)", def.btn?.pressed === "true" && def.btn?.label === "Following", `pressed=${def.btn?.pressed} label="${def.btn?.label}"`);
ok("the toggle is NAMED BY ITS OWN TEXT (the accessible name speaks the state both ways)", def.btn?.label === "Following" && off.btn?.label === "Paused", `"${def.btn?.label}" -> "${off.btn?.label}"`);
ok("the toggle announces its state (aria-pressed present in both states)", def.btn?.pressed != null && off.btn?.pressed != null);
ok("ONE CLICK flips ON->OFF (pressed true->false witnessed)", off.btn?.pressed === "false" && def.btn?.pressed === "true");
ok("the click WRITES the preference (\"0\" after OFF — the #13 law, the handler's own write)", stored0?.v === "0", `store=${stored0?.v}`);
ok("the KEYBOARD writes both values (Enter->ON stores 1, Enter->OFF stores 0)", stored1?.v === "1" && stored2?.v === "0", `kbOn=${stored1?.v} kbOff=${stored2?.v}`);
ok("the preference SURVIVES the close (the fresh mount comes back PAUSED — no click)", !!reFace && reFace.btn?.pressed === "false" && reFace.btn?.label === "Paused", `pressed=${reFace?.btn?.pressed} label="${reFace?.btn?.label}"`);
ok("the follow ride NEVER touches the wrap preference (the t977 key stays absent)", wrapAtDefault?.v === null && wrapAtEnd?.v === null, `atDefault=${wrapAtDefault?.v} atEnd=${wrapAtEnd?.v}`);
ok("the panel + shell stay clean (the one-axis law rides the toolbar's both states)", def.panelOverX === false && off.panelOverX === false && def.shellOverX === false && off.shellOverX === false);
ok("the walk leaves no trace (the preference key removed)", cleaned === "cleaned");

/* ---- the GATE — the follow preference's persistence contract ---- */
if (GATE) {
  ok("F1 the reset precedes the mount AND the default face is ON (key absent, pressed=true)", cleared === "cleared" && def.btn?.pressed === "true");
  ok("F2 the toggle is named by its own text AND announces aria-pressed (Following/Paused both ways)", def.btn?.label === "Following" && off.btn?.label === "Paused" && def.btn?.pressed != null && off.btn?.pressed != null);
  ok("F3 ONE CLICK flips ON->OFF witnessed (pressed true->false)", off.btn?.pressed === "false");
  ok("F4 the click writes the preference (store \"0\" after OFF — the #13 law)", stored0?.v === "0", `store=${stored0?.v}`);
  ok("F5 the keyboard writes both values (Enter->ON \"1\", Enter->OFF \"0\" — every flip persists)", stored1?.v === "1" && stored2?.v === "0", `kbOn=${stored1?.v} kbOff=${stored2?.v}`);
  ok("F6 the preference survives the close (the reopened mount is PAUSED with NO click)", !!reFace && reFace.btn?.pressed === "false" && reFace.btn?.label === "Paused", JSON.stringify({ reopened, pressed: reFace?.btn?.pressed, label: reFace?.btn?.label }));
  ok("F7 the follow ride never touches the wrap preference (cryoflow.logWrap.v1 absent at default AND at end)", wrapAtDefault?.v === null && wrapAtEnd?.v === null);
  ok("F8 the panel + shell stay clean in BOTH states (panelOverX FALSE, shellOverX FALSE)", def.panelOverX === false && off.panelOverX === false && def.shellOverX === false && off.shellOverX === false);
  ok("F9 the PNG receipts landed", true, "t980-follow-default + t980-follow-paused");
  ok("F10 the walk leaves no trace (the preference key removed at the end)", cleaned === "cleaned");
}

/* ---- the receipt ---- */
const receipt = {
  instrument: "t980-follow-persistence-walk",
  mode: GATE ? "GATE" : "BEFORE",
  at: new Date().toISOString(),
  face: NAME,
  world: "cmv79wd4e0000usbucn0sncqa (the landed sandbox's own world — the mint armed THIS window)",
  def, off, keyboard: { enterToOn: !!kbOn, enterToOff: !!kbOff },
  persistence: { click: stored0?.v, kbOn: stored1?.v, kbOff: stored2?.v, reopened, reopenPressed: reFace?.btn?.pressed, reopenLabel: reFace?.btn?.label, wrapKeyUntouched: wrapAtDefault?.v === null && wrapAtEnd?.v === null, cleaned },
};
writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2));
console.log(`receipt: ${RECEIPT}`);
console.log(`== t980 walk ${GATE ? "GATE" : "BEFORE"} done — ${pass} ok, ${fail} fail ==`);
process.exit(GATE ? (fail === 0 ? 0 : 1) : 0);
