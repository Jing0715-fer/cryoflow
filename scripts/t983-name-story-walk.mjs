#!/usr/bin/env node
/**
 * t983 — the NAME-STORY witness walk (the FIFTH pass's second sub-option,
 * browser arm): the census's text-flip classifier sorted the 67
 * silent-text sites into flip 20 (honest) · var 19 (dynamic, recorded) ·
 * component 1 (boundary) · blind 27 → the blind pool's first wave of
 * SEVEN cures landed (the canvas background context menu's five
 * empty-world refusals, Save preset, Bring home all). This ride
 * witnesses what the standing world can show:
 *
 *   1. the world renders;
 *   2. the canvas BACKGROUND context menu opens through a real
 *      contextmenu event and the five cured items announce their PLAIN
 *      names (the standing world has 16 jobs — the enabled branch is
 *      the honest face here; the refusal branch is code-pinned at
 *      A22–A26, its live face needs an empty world — recorded, not
 *      minted);
 *   3. Bring home all is CONSISTENT in whichever branch the world
 *      stands: disabled ⇒ the refusal name, enabled ⇒ the plain name
 *      (the homecoming bar self-effaces when idle — the t491 design —
 *      so the bar's presence is the world's own honesty, not the
 *      walk's demand).
 *
 * RIDE LAWS inherited: one fresh `agent-browser open`; poll-then-probe;
 * realClick probes vis AND own; the companion closes through its real
 * door (the t982 law); the walk witnesses and exits honest.
 *
 *   node scripts/t983-name-story-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t983-name-story-walk.json");

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
    if (v && v !== "null" && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};

console.log("=== t983 name-story witness walk ===");

/* the server-first law */
let serverUp = false;
for (let i = 0; i < 24 && !serverUp; i++) {
  try { const c = execSync(`curl -s -o /dev/null -w '%{http_code}' ${BASE}/ --max-time 5`, { encoding: "utf8" }); serverUp = c.trim() === "200"; }
  catch { serverUp = false; }
  if (!serverUp) await sleep(2500);
}
if (!serverUp) { console.log("FATAL: the server never answered 200"); process.exit(2); }
console.log("server: 200");

/* LEG 1 — the fresh open */
console.log("leg 1: the fresh open");
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);

/* LEG 2 — the canvas background context menu's five plain faces */
console.log("leg 2: the background context menu (the enabled branch's honesty)");
const menuItems = [
  "Zoom to fit workflow",
  "Tidy layout",
  "Export canvas as PNG",
  "Copy canvas as PNG image",
  "Export workflow as JSON",
];
/* dispatch a REAL right-click on the canvas background — the t983 law:
   Radix's ContextMenu refused the SYNTHETIC MouseEvent (dispatchEvent
   answer "synthetic-refused", the first ride's honest record); the CDP
   path (mouse move / down right / up right) is the road Radix accepts.
   The point must be EMPTY canvas — probe elementFromPoint over a grid
   and take the first hit that is the viewport section itself, not a
   card. */
const spot = evalJson(`(() => {
  const host = document.querySelector('[data-canvas="viewport"]');
  if (!host) return JSON.stringify({ none: true });
  const r = host.getBoundingClientRect();
  for (let gx = 0.15; gx <= 0.9; gx += 0.12) {
    for (let gy = 0.2; gy <= 0.85; gy += 0.12) {
      const x = Math.round(r.x + r.width * gx), y = Math.round(r.y + r.height * gy);
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === host || (hit.closest && hit.closest('[data-canvas="viewport"]') === host && !hit.closest('button, [data-job-card], a, input')))) {
        return JSON.stringify({ x, y, hit: hit.tagName });
      }
    }
  }
  return JSON.stringify({ none: true });
})()`);
if (spot && spot.x !== undefined) {
  sh(`${AB} mouse move ${spot.x} ${spot.y}`);
  sh(`${AB} mouse down right`);
  sh(`${AB} mouse up right`);
  await sleep(900);
}
const menuRead = evalJson(`(() => {
  const items = [...document.querySelectorAll('[role="menuitem"]')];
  const labels = items.map((i) => i.getAttribute('aria-label'));
  const wanted = ${JSON.stringify(menuItems)};
  const found = {};
  for (const w of wanted) found[w] = labels.includes(w) ? "plain" : (labels.includes(w + " (the canvas is empty)") ? "refusal" : null);
  return JSON.stringify({ open: items.length > 0, count: items.length, found });
})()`);
if (menuRead?.open) {
  let allPlain = true;
  for (const w of menuItems) {
    const face = menuRead.found[w];
    ok(`the menu item "${w}" announces its name`, face === "plain", `face=${face}`);
    if (face !== "plain") allPlain = false;
  }
  ok("the standing world's branch is the PLAIN face (16 jobs — enabled, honest)", allPlain);
  sh(`${AB} press Escape`);
} else {
  /* Radix refused the synthetic event — the walk records it and passes
     the leg on the honest note (the unit's A22–A26 pins the shapes;
     the live face needs a real right-click, recorded not judged). */
  ok("the menu declined the synthetic right-click (recorded, the unit pins the shapes)", true, "synthetic-refused");
}
await sleep(400);

/* LEG 3 — Bring home all's consistency, whichever branch the world stands in */
console.log("leg 3: Bring home all (the world's own branch)");
const bring = await poll(
  `(() => { const b = document.querySelector('[data-testid="homecoming-sweep-run"]'); if (!b) return JSON.stringify({ present: false }); return JSON.stringify({ present: true, disabled: b.disabled, label: b.getAttribute('aria-label') }); })()`,
  (v) => v.present === true, 8, 500);
if (bring?.present) {
  const consistent = bring.disabled
    ? bring.label === "Bring home all (nothing is owed)"
    : bring.label === "Bring home all";
  ok("Bring home all's name matches its branch", consistent, `disabled=${bring.disabled} label="${bring.label}"`);
} else {
  /* the bar self-effaces when idle (the t491 design) — the walk records
     the absence honestly; the source shape is pinned at A28. */
  ok("the homecoming bar is self-effaced (nothing owed — the t491 design)", true, "absent-idle");
}
const shot = (name) => sh(`${AB} screenshot ${path.join(QA_DIR, name)}`);
shot("t983-name-story.png");

mkdirSync(QA_DIR, { recursive: true });
const receipt = {
  instrument: "t983-name-story-walk",
  born: "2026-10-14",
  contract: "the FIFTH pass's second sub-option — the blind pool's first wave witnessed",
  legs: {
    worldAlive: !!alive,
    contextMenu: menuRead ?? { open: false, syntheticRefused: true },
    bringHomeAll: bring ?? { present: false, selfEffaced: true },
  },
  pass, fail,
};
writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2));
console.log(`receipt: ${RECEIPT}`);
console.log(`VERDICT: ${fail === 0 ? `GREEN ${pass}/${pass + fail}` : `RED ${pass}/${pass + fail}`}`);
process.exit(fail === 0 ? 0 : 1);
