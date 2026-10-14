#!/usr/bin/env node
/**
 * t988 — the CONTINUE-FACE WALK (the A44 witness carry + the t397 label
 * dialect + the pending face — the t987 entry's candidates ① and ②,
 * folded): the t987 mint woke the idle plane but its "Use this path"
 * witness carried — the singleFile branch's host is the continue-picker's
 * Browse, and no idle job carried a continue field. This window's mint
 * (one idle refine3d, "Continue Face (t988)") hosts the ContinueField,
 * and this walk rides it:
 *
 *   leg 3  the t397 resting plane — "Run" (no continue target), the
 *          blocked lane's described refusal (the t987 DESCRIBED witness
 *          re-read on the new face), the fn_cont input empty;
 *   leg 4  A44's FULL FLIP — the singleFile dialog ("Select an
 *          optimiser.star"), "Use this path (type a path first)"
 *          disabled, a real keystroke into the manual input, the plain
 *          enabled name, then the pick CLICK (the enabled plane's own
 *          action — the path lands in fn_cont);
 *   leg 5  THE t397 LABEL FLIP — the Run button says "Continue" while a
 *          continue target is set; the restore (focus gate → select-all
 *          → Delete → the auto-save) returns it to "Run";
 *   leg 6  THE PENDING FACE (the row-flip lane, the reaper's window
 *          respected) — pending (the badge word + the Run button's
 *          pending title + the Reset-to-idle door still enabled), then
 *          completed ("Re-run" blooms), then the panel's own
 *          Reset-to-idle CLICK back to idle ("Run" again);
 *   leg 7  world honesty — eighteen jobs, the face idle with no run
 *          evidence and fn_cont empty, the standing seventeen untouched.
 *
 * RIDE LAWS inherited (the t987 birth laws, executable): WIDE-FIRST
 * viewport before the fresh open; the palette's ENTER mouth (the row list
 * re-flows under the mouse — cmdk's selection semantics carry the jump);
 * the landing verified through the panel header's own mouth
 * (input[aria-label="Job name"]); the FOCUS GATE before any keystroke
 * (Ctrl+A on the canvas is select-all-the-JOBS — a tab trigger is not a
 * form field); the CONDITIONAL Escape (a bare Escape with no dialog open
 * deselects); the HEADER-ANCHORED badge (the canvas behind wears the same
 * badge on eighteen cards — an x-range bleeds); row-flip lanes carry
 * fresh startedAt and finish inside the 120s reconcile window; the walk
 * asserts and exits honest (the face STAYS — removable via the mint's
 * remove verb; zero localStorage writes; the standing seventeen
 * untouched).
 *
 *   node scripts/t988-continue-face-walk.mjs
 */
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t988-continue-face-walk.json");
const FACE_NAME = "Continue Face (t988)";
const JOB_ID = process.env.T988_JOB_ID ?? "cmv863x9a0001usvbkt5ky1k0";
const CONT_ID = `param-${JOB_ID}-fn_cont`;
const PICK_PATH = "/data/runs/run_it020_optimiser.star";

let pass = 0, fail = 0;
const results = [];
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
  results.push({ label, ok: !!cond, extra });
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
/* the t982 realClick: probe visibility AND self-hit over a nine-point
 * grid, scroll into view when off, click through the real mouse path */
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
    await sleep(400);
  }
  return "NEVER-OWN";
};
const shot = (name) => sh(`${AB} screenshot ${path.join(QA_DIR, name)}`);
/* the FOCUS GATE (the t987 law #2): no keystroke until the target input
 * itself answers document.activeElement */
const focusGate = async (id, tries = 10) => {
  for (let i = 0; i < tries; i++) {
    const f = evalJson(`(() => JSON.stringify({ active: document.activeElement ? document.activeElement.id : null }))()`);
    if (f && f.active === id) return true;
    await sleep(300);
  }
  return false;
};
/* the CONDITIONAL Escape (the t987 law #3) */
const dialogOpen = () => evalJson(`(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => d.getBoundingClientRect().width > 0) }))()`);

console.log("=== t988 continue-face walk ===");

/* the server-first law */
let serverUp = false;
for (let i = 0; i < 24 && !serverUp; i++) {
  try { const c = execSync(`curl -s -o /dev/null -w '%{http_code}' ${BASE}/ --max-time 5`, { encoding: "utf8" }); serverUp = c.trim() === "200"; }
  catch { serverUp = false; }
  if (!serverUp) await sleep(2500);
}
if (!serverUp) { console.log("FATAL: the server never answered 200"); process.exit(2); }
console.log("server: 200");
/* the standing world's fingerprint, captured BEFORE any leg rides */
const apiPre = (url) => execSync(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`, { encoding: "utf8", timeout: 30_000 });
let standingBody = null;
try { standingBody = JSON.parse(apiPre("/api/jobs")); } catch { standingBody = null; }
const standingArr = Array.isArray(standingBody) ? standingBody : standingBody?.jobs ?? [];
const standingFingerprint = standingArr
  .filter((j) => j.name !== FACE_NAME)
  .map((j) => `${j.id}:${j.status}:${j.name}`)
  .sort()
  .join("|");

/* LEG 1 — the fresh open (the WIDE-FIRST law, executable) */
console.log("leg 1: the fresh open (wide-first)");
sh(`${AB} set viewport 1440 900`);
sh(`${AB} open ${BASE}/`);
const alive = await poll(
  `(() => JSON.stringify({ n: document.querySelectorAll('button').length }))()`,
  (v) => v.n > 0, 24, 500);
ok("the world renders (page buttons > 0)", !!alive && alive.n > 0, `buttons=${alive?.n}`);
const companionShut = await poll(
  `(() => { const b = document.querySelector('[aria-label="关闭 AI 助手"]'); if (!b) return JSON.stringify({ shut: true }); const r = b.getBoundingClientRect(); return JSON.stringify({ shut: r.width === 0 }); })()`,
  (v) => v.shut, 4, 400);
ok("the companion is shut (the ride plane is clear)", !!companionShut && companionShut.shut);

/* LEG 2 — the palette jump (the t987 ENTER mouth, executable) */
console.log("leg 2: the Cmd+K palette jump to the continue face");
sh(`${AB} press Control+K`);
await sleep(700);
await poll(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`, (v) => v.up, 10, 400);
evalJs(`(() => { const i = document.querySelector('[cmdk-input]'); if (i) i.focus(); return 'f'; })()`);
sh(`${AB} keyboard type "Continue Face"`);
const row = await poll(
  `(() => { const items = [...document.querySelectorAll('[cmdk-item]')]; const hit = items.find((it) => (it.textContent ?? '').includes('Continue Face')); return JSON.stringify({ found: !!hit }); })()`,
  (v) => v.found, 12, 400);
ok("the palette's Jobs group answers the face's name", !!row && row.found);
let jumpLanded = false;
let jumpDetail = "";
for (let attempt = 1; attempt <= 3 && !jumpLanded; attempt++) {
  sh(`${AB} press Enter`);
  const landed = await poll(
    `(() => { const name = document.querySelector('input[aria-label="Job name"]'); return JSON.stringify({ shut: !document.querySelector('[cmdk-input]'), hosted: !!name && name.value === ${JSON.stringify(FACE_NAME)} }); })()`,
    (v) => v.shut && v.hosted, 10, 500);
  if (landed) { jumpLanded = true; jumpDetail += `attempt ${attempt}: Enter on the selected row, landed`; }
  else {
    jumpDetail += `attempt ${attempt}: Enter, no landing; `;
    const pal = evalJson(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`);
    if (pal?.up) { sh(`${AB} press Escape`); await sleep(500); sh(`${AB} press Control+K`); await sleep(700); await poll(`(() => JSON.stringify({ up: !!document.querySelector('[cmdk-input]') }))()`, (v) => v.up, 10, 400); evalJs(`(() => { const i = document.querySelector('[cmdk-input]'); if (i) i.focus(); return 'f'; })()`); sh(`${AB} keyboard type "Continue Face"`); await sleep(800); }
  }
}
ok("the jump landed — the edit panel hosts the face", jumpLanded, jumpDetail.trim());
/* the HEADER-ANCHORED badge (the t987 law #4) */
const headerBadge = (words) => `(() => { const name = document.querySelector('input[aria-label="Job name"]'); if (!name || name.value !== ${JSON.stringify(FACE_NAME)}) return JSON.stringify({ word: null, panel: false }); const header = name.closest('div[class*="border-b"]'); const badge = header ? [...header.querySelectorAll('span')].find((sp) => ${JSON.stringify(words)}.includes(sp.textContent.trim().toLowerCase()) && (sp.className ?? '').includes('rounded-full')) : null; return JSON.stringify({ word: badge ? badge.textContent.trim().toLowerCase() : null, panel: true }); })()`;
const badgeIdle = await poll(headerBadge(["idle"]), (v) => v.panel && v.word === "idle", 10, 500);
ok("the panel's badge says idle (the header-scoped read)", !!badgeIdle && badgeIdle.panel && badgeIdle.word === "idle");
shot("t988-idle-panel.png");

/* LEG 3 — the t397 resting plane: "Run", the blocked lane, fn_cont empty */
console.log("leg 3: the t397 resting plane (Run, blocked-described, no continue target)");
const restRun = await poll(
  `(() => { const b = [...document.querySelectorAll('button')].find((x) => { const t = (x.textContent ?? '').trim(); return ['Run','Re-run','Continue'].includes(t) && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().x > 1000; }); return JSON.stringify({ label: b ? b.textContent.trim() : null, disabled: b ? b.disabled : null, describedby: b ? b.getAttribute('aria-describedby') : null }); })()`,
  (v) => v.label, 12, 500);
ok("the first-run face rests on \"Run\" (no continue target)", !!restRun && restRun.label === "Run", `label="${restRun?.label}"`);
ok("the blocked lane re-speaks on the new face (described, the t987 witness holding)",
  !!restRun && restRun.disabled === true && restRun.describedby === "job-relion-blocked-hint",
  `disabled=${restRun?.disabled} describedby="${restRun?.describedby}"`);
const contRest = await poll(
  `(() => { const c = document.getElementById(${JSON.stringify(CONT_ID)}); if (!c) return JSON.stringify({ up: false }); return JSON.stringify({ up: true, value: c.value }); })()`,
  (v) => v.up, 12, 500);
ok("the fn_cont input is up and empty (the picker's own id)", !!contRest && contRest.up && contRest.value === "", `value=${JSON.stringify(contRest?.value)}`);
const browseDoor = await poll(
  `(() => { const b = [...document.querySelectorAll('button[aria-label="Browse for an optimiser.star"]')].find((x) => x.getBoundingClientRect().width > 0); return JSON.stringify({ up: !!b }); })()`,
  (v) => v.up, 10, 500);
ok("the continue-picker's Browse door is up (the A44 host, live)", !!browseDoor && browseDoor.up);

/* LEG 4 — A44's FULL FLIP: the singleFile dialog, both planes + the pick */
console.log("leg 4: A44 the Use-this-path full flip (the singleFile plane)");
const browseClick = await realClick(`[...document.querySelectorAll('button[aria-label="Browse for an optimiser.star"]')].find((b) => b.getBoundingClientRect().width > 0)`);
ok("the Browse door clicked through the real mouse path", String(browseClick).startsWith("clicked@"), String(browseClick));
const dlgState = (btnMatch) => `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.getBoundingClientRect().width > 0); if (!dlg) return JSON.stringify({ open: false }); const b = [...dlg.querySelectorAll('button')].find((x) => (${btnMatch})(x)); if (!b) return JSON.stringify({ open: true, btn: false }); return JSON.stringify({ open: true, btn: true, disabled: b.disabled, label: b.getAttribute('aria-label') ?? "" }); })()`;
const dlgTitle = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.getBoundingClientRect().width > 0); if (!dlg) return JSON.stringify({ open: false }); const t = dlg.querySelector('h2, [data-slot="dialog-title"]'); return JSON.stringify({ open: true, title: t ? (t.textContent ?? '').trim() : null }); })()`,
  (v) => v.open, 16, 500);
ok("the singleFile dialog opened (\"Select an optimiser.star\")",
  !!dlgTitle && dlgTitle.open && dlgTitle.title === "Select an optimiser.star",
  `title="${dlgTitle?.title}"`);
const useRefusal = await poll(
  dlgState(`(x) => (x.getAttribute('aria-label') ?? '').startsWith('Use this path')`),
  (v) => v.open && v.btn && v.disabled, 16, 500);
ok("A44's refusal plane is LIVE (empty manual speaks through the name)",
  !!useRefusal && useRefusal.btn && useRefusal.disabled && useRefusal.label === "Use this path (type a path first)",
  `disabled=${useRefusal?.disabled} label="${useRefusal?.label}"`);
shot("t988-use-refusal.png");
const manualClick = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find((d) => d.getBoundingClientRect().width > 0)?.querySelector('input[aria-label="Manual path or wildcard pattern"]')`);
ok("the manual input clicked through the real mouse path", String(manualClick).startsWith("clicked@"), String(manualClick));
const manualFocused = await focusGate("manual-path-or-pattern") || await poll(
  `(() => { const m = document.querySelector('input[aria-label="Manual path or wildcard pattern"]'); return JSON.stringify({ focused: document.activeElement === m }); })()`,
  (v) => v.focused, 6, 300);
sh(`${AB} keyboard type "${PICK_PATH}"`);
const useEnabled = await poll(
  dlgState(`(x) => (x.getAttribute('aria-label') ?? '').startsWith('Use this path')`),
  (v) => v.open && v.btn && !v.disabled, 12, 500);
ok("A44's enabled plane answers the keystroke (plain name, the flip)",
  !!useEnabled && useEnabled.btn && !useEnabled.disabled && useEnabled.label === "Use this path",
  `disabled=${useEnabled?.disabled} label="${useEnabled?.label}"`);
shot("t988-use-enabled.png");
const pickClick = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find((d) => d.getBoundingClientRect().width > 0)?.querySelector('button[aria-label="Use this path"]')`);
ok("the pick click landed (the enabled plane's own action)", String(pickClick).startsWith("clicked@"), String(pickClick));
const dlgShut = await poll(
  `(() => JSON.stringify({ open: [...document.querySelectorAll('[role="dialog"]')].some((d) => d.getBoundingClientRect().width > 0) }))()`,
  (v) => v.open === false, 10, 500);
const contPicked = await poll(
  `(() => { const c = document.getElementById(${JSON.stringify(CONT_ID)}); return JSON.stringify({ value: c ? c.value : null }); })()`,
  (v) => v.value === PICK_PATH, 12, 500);
ok("the dialog closed and the path landed in fn_cont",
  !!dlgShut && dlgShut.open === false && !!contPicked && contPicked.value === PICK_PATH,
  `fn_cont=${JSON.stringify(contPicked?.value)}`);

/* LEG 5 — THE t397 LABEL FLIP: "Run" → "Continue" → the restore → "Run" */
console.log("leg 5: the t397 label flip (Continue blooms, then the restore)");
const labelFlip = await poll(
  `(() => { const b = [...document.querySelectorAll('button')].find((x) => { const t = (x.textContent ?? '').trim(); return ['Run','Re-run','Continue'].includes(t) && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().x > 1000; }); return JSON.stringify({ label: b ? b.textContent.trim() : null }); })()`,
  (v) => v.label === "Continue", 16, 500);
ok("THE t397 FLIP BLOOMS (the button now says \"Continue\" — a continue target owns the label)",
  !!labelFlip && labelFlip.label === "Continue", `label="${labelFlip?.label}"`);
shot("t988-continue-label.png");
/* the restore: the fn_cont input, the focus gate, select-all, Delete */
const contClick = await realClick(`document.getElementById(${JSON.stringify(CONT_ID)})`);
const contFocused = String(contClick).startsWith("clicked@") && (await focusGate(CONT_ID));
if (contFocused) {
  sh(`${AB} press Control+A`);
  sh(`${AB} press Delete`);
  await sleep(1500); // the ~700ms debounce + the PATCH round trip
}
const contBack = await poll(
  `(() => { const c = document.getElementById(${JSON.stringify(CONT_ID)}); const b = [...document.querySelectorAll('button')].find((x) => { const t = (x.textContent ?? '').trim(); return ['Run','Re-run','Continue'].includes(t) && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().x > 1000; }); return JSON.stringify({ value: c ? c.value : null, label: b ? b.textContent.trim() : null }); })()`,
  (v) => v.value === "", 16, 500);
ok("the restore lands (fn_cont empty, the label back to \"Run\")",
  !!contBack && contBack.value === "" && contBack.label === "Run",
  `fn_cont=${JSON.stringify(contBack?.value)} label="${contBack?.label}"`);

/* LEG 6 — THE PENDING FACE (the row-flip lane, the reaper's window) */
console.log("leg 6: the pending face (row-flip: pending → completed → the real Reset-to-idle click)");
const flipRow = (status, extra = {}) =>
  spawnSync(
    "node",
    [
      "-e",
      `const { PrismaClient } = require("@prisma/client");
       const db = new PrismaClient();
       db.job.update({ where: { id: process.argv[1] }, data: JSON.parse(process.env.T988_DATA) })
         .then(() => db.$disconnect()).catch((e) => { console.error(String(e)); process.exit(1); });`,
      JOB_ID,
    ],
    {
      env: { ...process.env, DATABASE_URL: `file:${ROOT}/db/cryoflow.db`, T988_DATA: JSON.stringify({ status, ...extra }) },
      encoding: "utf8",
      timeout: 30_000,
    }
  );
/* the header-anchored state read: badge + the Run button's label/title +
 * the Reset-to-idle door (the t987 law #4, executable) */
const resetIdleName = `Reset ${FACE_NAME} to idle`;
const stateRead = (words) => `(() => { const name = document.querySelector('input[aria-label="Job name"]'); if (!name || name.value !== ${JSON.stringify(FACE_NAME)}) return JSON.stringify({ word: null, runLabel: null, runTitle: null, resetDisabled: null, panel: false }); const header = name.closest('div[class*="border-b"]'); const badge = header ? [...header.querySelectorAll('span')].find((sp) => ${JSON.stringify(words)}.includes(sp.textContent.trim().toLowerCase()) && (sp.className ?? '').includes('rounded-full')) : null; const b = [...document.querySelectorAll('button')].find((x) => { const t = (x.textContent ?? '').trim(); return ['Run','Re-run','Continue'].includes(t) && x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().x > 1000; }); const ri = document.querySelector('button[aria-label=${JSON.stringify(resetIdleName)}]'); return JSON.stringify({ word: badge ? badge.textContent.trim().toLowerCase() : null, runLabel: b ? b.textContent.trim() : null, runTitle: b ? (b.getAttribute('title') ?? '') : null, resetDisabled: ri ? ri.disabled : null, panel: true }); })()`;
const flip1 = flipRow("pending", { startedAt: new Date().toISOString() });
ok("the row flip to pending landed (the t263/t970 lane)", flip1.status === 0, `exit=${flip1.status}`);
const pendingPlane = await poll(stateRead(["pending"]), (v) => v.panel && v.word === "pending", 40, 500);
ok("THE PENDING FACE BLOOMED (the panel's badge says pending — the queue's own word, first live witness)",
  !!pendingPlane && pendingPlane.panel && pendingPlane.word === "pending", `word=${pendingPlane?.word}`);
ok("the Run button's pending title speaks (inputs will be re-checked before the run starts)",
  !!pendingPlane && /re-checked/.test(pendingPlane.runTitle ?? ""), `title="${(pendingPlane?.runTitle ?? "").slice(0, 60)}"`);
ok("the Reset-to-idle door stays ENABLED under pending (only running closes it)",
  !!pendingPlane && pendingPlane.resetDisabled === false, `resetDisabled=${pendingPlane?.resetDisabled}`);
shot("t988-pending.png");
const RESULT_SENTENCE = "refine3d completed — 12 classes refined (the t988 walk's row-flip lane)";
const flip2 = flipRow("completed", { progress: 100, result: RESULT_SENTENCE, ranParams: JSON.stringify({ pixelSize: 1.77 }), startedAt: new Date().toISOString() });
ok("the row flip to completed landed", flip2.status === 0, `exit=${flip2.status}`);
const donePlane = await poll(stateRead(["completed", "failed"]), (v) => v.panel && v.word === "completed", 30, 500);
ok("the COMPLETED face bloomed", !!donePlane && donePlane.panel && donePlane.word === "completed", `word=${donePlane?.word}`);
ok("the ranBefore flip blooms (the button now says \"Re-run\")",
  !!donePlane && donePlane.runLabel === "Re-run", `runLabel="${donePlane?.runLabel}"`);
shot("t988-completed.png");
const resetIdleClick = await realClick(`document.querySelector('button[aria-label=${JSON.stringify(resetIdleName)}]')`);
ok("the Reset-to-idle click landed (the panel's own door)", String(resetIdleClick).startsWith("clicked@"), String(resetIdleClick));
const backToIdle = await poll(stateRead(["idle", "completed"]), (v) => v.panel && v.word === "idle", 16, 500);
ok("the face returned to idle (the reset law's own door)",
  !!backToIdle && backToIdle.panel && backToIdle.word === "idle", `word=${backToIdle?.word}`);
ok("\"Run\" again (the first-run face is the idle plane's own)",
  !!backToIdle && backToIdle.runLabel === "Run", `runLabel="${backToIdle?.runLabel}"`);
shot("t988-reset-idle.png");

/* LEG 7 — the world's honesty (the API is the judge) */
console.log("leg 7: the world's honesty");
const api = (method, url) => execSync(`curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" "${BASE}${url}"`, { encoding: "utf8", timeout: 30_000 });
let body = null;
try { body = JSON.parse(api("GET", "/api/jobs")); } catch { body = null; }
const arr = Array.isArray(body) ? body : body?.jobs ?? [];
ok("the world carries EIGHTEEN jobs (17 standing + the face)", arr.length === 18, `rows=${arr.length}`);
const face = arr.find((j) => j.name === FACE_NAME);
ok("the face is back to idle with no run evidence and no continue target (the t445 reset law)",
  !!face && face.status === "idle" && face.ranParams == null && face.result == null && !face.params?.fn_cont,
  face ? `status=${face.status} ranParams=${JSON.stringify(face.ranParams)} fn_cont=${JSON.stringify(face.params?.fn_cont)}` : "missing");
const fingerprint = arr.filter((j) => j.name !== FACE_NAME).map((j) => `${j.id}:${j.status}:${j.name}`).sort().join("|");
ok("the standing seventeen untouched (byte-identical id:status:name fingerprint)",
  fingerprint === standingFingerprint,
  `rows=${fingerprint.split("|").length}`);

/* the receipt */
mkdirSync(QA_DIR, { recursive: true });
writeFileSync(RECEIPT, JSON.stringify({
  walk: "t988-continue-face-walk",
  at: new Date().toISOString(),
  face: { name: FACE_NAME, jobId: JOB_ID },
  pass, fail,
  results,
}, null, 2));
console.log(`receipt: ${RECEIPT}`);

console.log(`== t988 continue-face walk ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
