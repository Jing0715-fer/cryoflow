#!/usr/bin/env node
/**
 * t870 — the FIND BAR face's page: the canvas's ambient lens (Ctrl/⌘+F,
 * Task 134/135/137/578/584/653/724/782), the rotation's next un-walked
 * room — the first walk that lives ON the canvas itself rather than in a
 * dialog or tab. Walked live with the SHARED RULER (zero src expected:
 * the bar was built to the name layer's standards — role=search named,
 * the input's aria-label, the count as an aria-live BUTTON door, the
 * three chip groups' aria-pressed machines).
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> results family (t865) -> star
 * table (t866) -> quick-look (t867) -> text preview (t868) -> THIS page.
 *
 * The surface (the bar mounts on demand — render null until findOpen):
 *
 *   O   the clean room — role=search ABSENT before the door (the bar is
 *       summoned, never resident), the seed read before and after.
 *   F   the summoned bar — the Ctrl+F window-keyboard door, the 720ms
 *       entrance cascade waited out (the arming window, not a clock
 *       trust: the settle rides after it), role=search named, the input
 *       named (aria-label, not the placeholder's crutch) and TOOK FOCUS
 *       (the opening effect's focus+select — the focus law), the count
 *       honestly ABSENT on an empty lens (no query + no chip = no count),
 *       the r0 doors named (prev/next/close), the three chip groups
 *       named (status/type/note), every chip named with its aria-pressed
 *       machine, the arrows disabled at n=0 (the honest disabled), zero
 *       unnamed page-wide.
 *   Q   the query — "ion" typed through the React-controlled setter (the
 *       name AND type-label matcher): the count speaks "N matches" as a
 *       live BUTTON door (Task 137: one cursor, three triggers), zero
 *       unnamed still.
 *   W   the wrap walk — Enter advances "1 of N" ... "N of N", one more
 *       Enter WRAPS to "1 of N" (the modulo law), Shift+Enter walks back
 *       to "N of N", the count DOOR clicked advances too (the third
 *       trigger), the arrows enabled once n>0.
 *   L   the chip lens (findLens face) — the status chip's radio machine
 *       (pressed -> count updates -> second click CLEARS, the count
 *       returns to the honest empty), the "Failed" chip's honest ZERO
 *       ("no matches" — the lens is on, the world has nothing that
 *       matches), a type chip's machine walked, zero unnamed.
 *   E   the Escape seat — Escape ON THE INPUT closes the bar (the input's
 *       own preventDefault makes the page-level ladder stand down), the
 *       world back bit-for-bit, and the EPHEMERAL law (the lens keeps no
 *       memory): a reopen speaks an empty input and no pressed chip.
 *   K   the keymap seat — the shortcuts dialog teaches "⌘/Ctrl F — Find
 *       jobs on canvas".
 *   W   the world back — fresh load, the canvas count bit-for-bit, the
 *       seed hygiene (W2): the walk leaves no session seed behind.
 *
 * The ledger aboard from birth (three faces: findBar / findLens /
 * worldBack — the t861 birthright, the shared comparator law). The
 * settle carries the t869 arrival guard (a stable blank is not a
 * settled world).
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

/* ---------- provenance + the comparator (the family's shared law) ---------- */
const world = worldIdentity(ROOT);
const buildId = world.id;
const cmp = loadComparator(ROOT, "shots-qa/t870-find-bar-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t870 find-bar a11y walk — world ${world.mode}:${buildId}, the canvas's ambient lens through the shared ruler\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* ---------- the measures: ONE superset for the bar's faces + the world's
 * plain canvas census for the back. NO ${} inside — the shell reads these
 * strings through JSON.stringify. */
const BAR_MEASURE =
  '(() => { ' + NAMEOF + ' const bar = document.querySelector("[data-canvas-find-bar]"); const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const visible = bar && bar.getAttribute("aria-hidden") !== "true"; const ip = bar ? bar.querySelector("input") : null; const count = document.querySelector("[data-testid=canvas-find-count]"); const prev = document.querySelector("[data-testid=canvas-find-prev]"); const next = document.querySelector("[data-testid=canvas-find-next]"); const close = document.querySelector("[data-testid=canvas-find-close]"); const groups = bar ? Array.from(bar.querySelectorAll("[role=group]")).map((g) => ({ label: g.getAttribute("aria-label"), chips: Array.from(g.querySelectorAll("button")).map((b) => ({ name: nameOf(b), pressed: b.getAttribute("aria-pressed"), testid: b.getAttribute("data-testid") })) })) : []; return JSON.stringify({ pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 4).map((b) => String(b.className).slice(0, 44)), hasBar: !!bar, visible, searchNamed: bar ? bar.getAttribute("aria-label") : null, ip: ip ? { named: !!nameOf(ip), aria: ip.getAttribute("aria-label"), value: ip.value, focused: document.activeElement === ip } : null, count: count ? { tag: count.tagName, text: (count.textContent || "").trim(), named: !!nameOf(count), title: count.getAttribute("title") } : null, prevNextClose: { prev: prev ? { named: !!nameOf(prev), disabled: prev.disabled } : null, next: next ? { named: !!nameOf(next), disabled: next.disabled } : null, close: close ? { named: !!nameOf(close), disabled: close.disabled } : null }, groups, badge: !!document.querySelector("[data-testid=canvas-find-param-badge]"), heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

const WORLD_MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const bar = document.querySelector("[data-canvas-find-bar]"); const dlg = document.querySelector("[role=dialog]"); return JSON.stringify({ pageBtns: btns.length, pageUnnamed: un.length, hasBar: !!bar, hasDlg: !!dlg, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40) }); })()';

const seedRead = () =>
  evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');

/* the settle with the t869 arrival guard: a stable blank is not a settled
 * world; an empty page keeps the settle waiting (bounded). */
const settle = (what, maxIter = 16, need = 2) => {
  let m = evalJson(WORLD_MEASURE);
  let run = 1;
  for (let i = 0; i < maxIter; i++) {
    sleep(1);
    const next = evalJson(WORLD_MEASURE);
    const alive = next.pageBtns > 0;
    const same = alive && JSON.stringify(next) === JSON.stringify(m);
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need) break;
  }
  console.log(`  settled ${what} (${need}x stable)`);
  return m;
};

/* the bar's own settle — same guard, the bar's superset measure */
const settleBar = (what, maxIter = 16, need = 2) => {
  let m = evalJson(BAR_MEASURE);
  let run = 1;
  for (let i = 0; i < maxIter; i++) {
    sleep(1);
    const next = evalJson(BAR_MEASURE);
    const alive = next.pageBtns > 0;
    const same = alive && JSON.stringify(next) === JSON.stringify(m);
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need) break;
  }
  console.log(`  settled ${what} (${need}x stable)`);
  return m;
};

/* ---------- Face O: the clean room ---------- */
console.log("Face O — the clean room (the bar is summoned, never resident)");
ab(`open ${BASE}`);
sleep(3);
const c1 = settle("the canvas");
const OPEN = c1.pageBtns;
const seedBefore = seedRead();
const o1 = evalJson(BAR_MEASURE);
ok("O0 the bar is absent before the door (summoned, never resident)",
  o1.hasBar === false && c1.pageUnnamed === 0 && !c1.hasDlg,
  `pageBtns=${OPEN} bar=${o1.hasBar}`);

/* ---------- Face F: the summoned bar ---------- */
console.log("Face F — the Ctrl+F door and the summoned bar");
evalJson('(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true })); return "opened"; })()');
sleep(2); /* the 720ms entrance cascade + the focus rAF — wait it out, then settle */
const f1 = settleBar("the summoned bar");
ok("F1 the bar arrived as role=search, named", f1.hasBar === true && f1.visible === true && f1.searchNamed === "Find jobs on canvas", `aria-label="${f1.searchNamed}"`);
ok("F2 the input is named (aria-label, not the placeholder's crutch)",
  f1.ip && f1.ip.named === true && (f1.ip.aria || "").startsWith("Find jobs by name"),
  `aria="${f1.ip ? f1.ip.aria : null}"`);
ok("F3 the input TOOK FOCUS (the opening effect's focus+select — the focus law)",
  f1.ip && f1.ip.focused === true,
  f1.ip ? `value=${JSON.stringify(f1.ip.value)}` : "no input");
ok("F4 the empty lens speaks NO count (no query + no chip = the honest silence)",
  f1.count === null || f1.count.text === "",
  f1.count ? `text=${JSON.stringify(f1.count.text)}` : "count not rendered");
ok("F5 the r0 doors named (prev / next / close)",
  f1.prevNextClose.prev && f1.prevNextClose.prev.named && f1.prevNextClose.next && f1.prevNextClose.next.named && f1.prevNextClose.close && f1.prevNextClose.close.named,
  `prev=${f1.prevNextClose.prev ? f1.prevNextClose.prev.named : null} next=${f1.prevNextClose.next ? f1.prevNextClose.next.named : null} close=${f1.prevNextClose.close ? f1.prevNextClose.close.named : null}`);
ok("F6 the arrows disabled at n=0 (the honest disabled — nothing to cycle into)",
  f1.prevNextClose.prev && f1.prevNextClose.prev.disabled === true && f1.prevNextClose.next && f1.prevNextClose.next.disabled === true,
  "");
ok("F7 the three chip groups named (status / type / note)",
  f1.groups.length >= 3 && f1.groups.every((g) => (g.label || "").startsWith("Filter matches by")),
  f1.groups.map((g) => g.label).join(" · "));
ok("F8 every chip named, every chip carries its aria-pressed machine",
  f1.groups.every((g) => g.chips.every((c) => c.name && (c.pressed === "true" || c.pressed === "false"))),
  `chips=${f1.groups.reduce((s, g) => s + g.chips.length, 0)}`);
ok("F9 zero unnamed page-wide with the bar up", f1.pageUnnamed === 0,
  `btns=${f1.pageBtns}`);

/* ---------- Face Q: the query ---------- */
console.log("Face Q — the query (the name-and-type matcher)");
evalJson('(() => { const bar = document.querySelector("[data-canvas-find-bar]"); const ip = bar && bar.querySelector("input"); if (!ip) return JSON.stringify({ typed: false }); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(ip, "ion"); ip.dispatchEvent(new Event("input", { bubbles: true })); return JSON.stringify({ typed: true }); })()');
sleep(1);
const f2 = settleBar("the queried bar");
const countText = f2.count ? f2.count.text : "";
const mMatch = /^(\d+) match(es)?$/.exec(countText); /* match(es)? — "1 match" must be heard; the matches? idiom required the 'e' and stayed singular-deaf (the ride-3 lesson) */
ok("Q1 the count speaks N matches (the live button door)",
  f2.count && f2.count.tag === "BUTTON" && mMatch !== null && Number(mMatch[1]) >= 2,
  `text=${JSON.stringify(countText)} tag=${f2.count ? f2.count.tag : null}`);
ok("Q2 the count door named and titled (the count IS the name; the title speaks the verb)",
  f2.count && f2.count.named && f2.count.title === "Jump to next match",
  `title=${f2.count ? f2.count.title : null}`);
ok("Q3 the arrows enabled once n>0 (the disabled state follows the world)",
  f2.prevNextClose.prev && f2.prevNextClose.prev.disabled === false && f2.prevNextClose.next && f2.prevNextClose.next.disabled === false,
  "");
ok("Q4 zero unnamed with the query live", f2.pageUnnamed === 0, "");

/* ---------- Face W: the wrap walk ---------- */
const N = mMatch ? Number(mMatch[1]) : 0;
console.log(`Face W — the wrap walk (N=${N})`);
const readCount = () => {
  const r = evalJson('(() => { const c = document.querySelector("[data-testid=canvas-find-count]"); return JSON.stringify({ text: c ? (c.textContent || "").trim() : null, tag: c ? c.tagName : null }); })()');
  return r;
};
const pressKey = (key, shift) =>
  evalJson(`(() => { const bar = document.querySelector("[data-canvas-find-bar]"); const ip = bar && bar.querySelector("input"); if (!ip) return JSON.stringify({ sent: false }); ip.dispatchEvent(new KeyboardEvent("keydown", { key: ${JSON.stringify(key)}, shiftKey: ${shift ? "true" : "false"}, bubbles: true })); return JSON.stringify({ sent: true }); })()`);

let wrapOk = false;
let walkDetail = "no matches";
if (N >= 2) {
  pressKey("Enter", false);
  sleep(1);
  let r = readCount();
  const steps = [`first=${r.text}`];
  wrapOk = r.text === `1 of ${N}`;
  /* the count DOOR as the third trigger (Task 137) */
  evalJson('(() => { const c = document.querySelector("[data-testid=canvas-find-count]"); if (c && c.tagName === "BUTTON") { c.click(); return "clicked"; } return "no-door"; })()');
  sleep(1);
  r = readCount();
  steps.push(`door=${r.text}`);
  wrapOk = wrapOk && r.text === `2 of ${N}`;
  /* Enter to the end and past it — the modulo law */
  for (let k = 2; k <= N; k++) {
    pressKey("Enter", false);
    sleep(1);
    r = readCount();
    steps.push(r.text);
    if (k === N) wrapOk = wrapOk && r.text === `1 of ${N}`;
    else wrapOk = wrapOk && r.text === `${k + 1} of ${N}`;
  }
  /* Shift+Enter walks back to the top... from 1 of N it wraps BACKWARD */
  pressKey("Enter", true);
  sleep(1);
  r = readCount();
  steps.push(`shift=${r.text}`);
  wrapOk = wrapOk && r.text === `${N} of ${N}`;
  walkDetail = steps.join(" → ");
}
ok("W1 the wrap walk: Enter advances, the door advances, N+1 Enters WRAP, Shift+Enter walks back",
  wrapOk, walkDetail);

/* ---------- Face L: the chip lens ---------- */
console.log("Face L — the chip lens (the radio machines and the honest zero)");
/* clear the query first: the chip IS the lens with no query */
evalJson('(() => { const bar = document.querySelector("[data-canvas-find-bar]"); const ip = bar && bar.querySelector("input"); if (!ip) return JSON.stringify({ cleared: false }); const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set; setter.call(ip, ""); ip.dispatchEvent(new Event("input", { bubbles: true })); return JSON.stringify({ cleared: true }); })()');
sleep(1);
evalJson('(() => { const b = document.querySelector("[data-testid=canvas-find-status-completed]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
sleep(1);
const f3 = settleBar("the status-chip lens");
const chipCompleted = f3.groups.find((g) => (g.label || "") === "Filter matches by status");
const pressedCompleted = chipCompleted ? chipCompleted.chips.find((c) => (c.testid || "") === "canvas-find-status-completed") : null;
const f3count = f3.count ? f3.count.text : "";
ok("L1 the Completed chip presses and the count follows (the chip IS the lens)",
  pressedCompleted && pressedCompleted.pressed === "true" && /^\d+ match(es)?$/.test(f3count),
  `pressed=${pressedCompleted ? pressedCompleted.pressed : null} count=${JSON.stringify(f3count)}`);
ok("L2 zero unnamed in the chip lens", f3.pageUnnamed === 0, "");
/* the second click CLEARS (radio semantics) — the count returns to the honest empty */
evalJson('(() => { const b = document.querySelector("[data-testid=canvas-find-status-completed]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
sleep(1);
const f4 = evalJson(BAR_MEASURE);
const clearedChip = f4.groups.find((g) => (g.label || "") === "Filter matches by status");
const clearedCompleted = clearedChip ? clearedChip.chips.find((c) => (c.testid || "") === "canvas-find-status-completed") : null;
ok("L3 the second click clears (radio semantics; the empty lens is silent again)",
  clearedCompleted && clearedCompleted.pressed === "false" && (!f4.count || f4.count.text === ""),
  `pressed=${clearedCompleted ? clearedCompleted.pressed : null} count=${f4.count ? JSON.stringify(f4.count.text) : "absent"}`);
/* the honest ZERO: the Failed chip with a zero-hit world */
evalJson('(() => { const b = document.querySelector("[data-testid=canvas-find-status-failed]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
sleep(1);
const f5 = evalJson(BAR_MEASURE);
ok("L4 the armed lens with zero hits SAYS SO (the honest zero, not a silence)",
  f5.count && f5.count.tag === "SPAN" && f5.count.text === "no matches",
  f5.count ? `tag=${f5.count.tag} text=${JSON.stringify(f5.count.text)}` : "count absent");
evalJson('(() => { const b = document.querySelector("[data-testid=canvas-find-status-failed]"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()');
sleep(1);
/* a type chip's machine (the category lens) */
const typeChipR = evalJson('(() => { const groups = Array.from(document.querySelectorAll("[data-canvas-find-bar] [role=group]")); const g = groups.find((x) => x.getAttribute("aria-label") === "Filter matches by type"); if (!g) return JSON.stringify({ found: false }); const b = g.querySelector("button"); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true, name: (b.getAttribute("aria-label") || b.textContent || "").trim() }); })()');
sleep(1);
const f6 = evalJson(BAR_MEASURE);
const typeGroup = f6.groups.find((g) => (g.label || "") === "Filter matches by type");
const typePressedCount = typeGroup ? typeGroup.chips.filter((c) => c.pressed === "true").length : 0;
const f6count = f6.count ? f6.count.text : "";
const f6m = /^(\d+) match(es)?$/.exec(f6count); /* the singular speaks too: "1 match" — match(es)?, not matches? (the ride-3 lesson: the first cure was itself singular-deaf) */
ok("L5 the type chip presses and the count narrows (a category excludes something)",
  typeChipR.found === true && typePressedCount === 1 && f6m !== null && Number(f6m[1]) < 15,
  `chip=${typeChipR.name || "?"} pressed=${typePressedCount} count=${JSON.stringify(f6count)}`);
evalJson('(() => { const groups = Array.from(document.querySelectorAll("[data-canvas-find-bar] [role=group]")); const g = groups.find((x) => x.getAttribute("aria-label") === "Filter matches by type"); const b = g && g.querySelector("button"); if (b) b.click(); return "cleared"; })()');
sleep(1);

/* ---------- Face E: the Escape seat + the ephemeral law ---------- */
console.log("Face E — the Escape seat and the ephemeral law");
evalJson('(() => { const bar = document.querySelector("[data-canvas-find-bar]"); const ip = bar && bar.querySelector("input"); if (!ip) return JSON.stringify({ sent: false }); ip.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return JSON.stringify({ sent: true }); })()');
sleep(1);
const e1 = settle("the world after Escape");
ok("E1 Escape ON THE INPUT closed the bar (the input's own seat)",
  e1.hasBar === false && !e1.hasDlg, `bar=${e1.hasBar}`);
ok("E2 the world back bit-for-bit (the lens is ephemeral, the canvas unharmed)",
  e1.pageBtns === OPEN && e1.pageUnnamed === 0,
  `btns=${e1.pageBtns} (opening ${OPEN})`);
/* reopen: the lens kept no memory */
evalJson('(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true })); return "reopened"; })()');
sleep(2);
const f7 = settleBar("the reopened bar");
ok("E3 the reopen speaks an empty input and no pressed chip (closing cleared the lens)",
  f7.ip && f7.ip.value === "" && f7.groups.every((g) => g.chips.every((c) => c.pressed === "false")),
  `value=${f7.ip ? JSON.stringify(f7.ip.value) : null}`);
/* close again via the close DOOR (the third way out) */
evalJson('(() => { const b = document.querySelector("[data-testid=canvas-find-close]"); if (b) b.click(); return "closed"; })()');
sleep(1);
const e2 = evalJson(WORLD_MEASURE);
ok("E4 the Close door closes too (the seat teaches every exit)", e2.hasBar === false, "");

/* ---------- Face K: the keymap seat ---------- */
console.log("Face K — the keymap seat");
evalJson('(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true })); return "asked"; })()');
sleep(2);
const k1 = evalJson('(() => { ' + NAMEOF + ' const dlg = document.querySelector("[role=dialog]"); if (!dlg) return JSON.stringify({ open: false }); const text = (dlg.textContent || ""); const kbds = Array.from(dlg.querySelectorAll("kbd")).map((k) => (k.textContent || "").trim()); return JSON.stringify({ open: true, hasFind: text.includes("Find jobs on canvas"), ctrlF: (kbds.some((k) => /(^|\s)F$/.test(k)) && kbds.some((k) => /(Ctrl|⌘)/.test(k))) || kbds.some((k) => /F$/.test(k) && /(Ctrl|⌘)/.test(k)), unnamed: Array.from(dlg.querySelectorAll("button")).filter((b) => !nameOf(b)).length }); })()');
ok("K1 the keymap seat teaches the find bar (⌘/Ctrl F — Find jobs on canvas)",
  k1.open === true && k1.hasFind === true && k1.ctrlF === true,
  `hasFind=${k1.hasFind} ctrlF=${k1.ctrlF} — the seat's kbds are PAIRWISE ("⌘/Ctrl" + "F"), the t870 lens-cure`);
ok("K2 the keymap dialog itself zero unnamed", k1.unnamed === 0, "");
evalJson('(() => { const d = document.querySelector("[role=dialog]"); if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()');
sleep(1);

/* ---------- Face W: the world back + the seed hygiene ---------- */
console.log("Face W — the world back (fresh load, settled — the same lens cure)");
ab(`open ${BASE}`);
sleep(3);
const w1 = settle("the restored canvas");
ok("W1 the world unharmed (canvas count == the opening count, zero unnamed)",
  w1.pageBtns === OPEN && w1.pageUnnamed === 0 && !w1.hasBar,
  `btns=${w1.pageBtns} (opening ${OPEN})`);
const seedAfter = seedRead();
ok("W2 the walk leaves no session seed (the t157 two-way door's honest none — the t866 lesson rides every page)",
  (seedAfter.seed === "" || seedAfter.seed === null) && (seedBefore.seed === "" || seedBefore.seed === null),
  `seed=${JSON.stringify(seedAfter.seed)}`);

/* ---------- the ledger at birth (three faces: findBar / findLens / worldBack) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  findBar: ledgerFace(prevFaces ? prevFaces.findBar?.live ?? null : null, f2, scalarOf),
  findLens: ledgerFace(prevFaces ? prevFaces.findLens?.live ?? null : null, f3, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the find-bar face holds — the canvas's ambient lens walked: the clean room held (the bar summoned, never resident), the Ctrl+F door opened the bar through the 720ms cascade (role=search named, the input named and TOOK FOCUS, the empty lens honestly silent, the r0 doors named, the arrows honestly disabled at n=0), the query spoke "N matches" as the live count door and the wrap walk rode the modulo law (Enter to N, one more wraps to 1, Shift+Enter back, the door the third trigger), the chip lens pressed and CLEARED by radio semantics with the honest zero ("no matches" spoken, not silent), a type chip narrowed the world, Escape on the input closed the seat and the world came back bit-for-bit with the reopen speaking an empty lens (the ephemeral law), the keymap seat teaches ⌘/Ctrl F, and the walk left no session seed — the ledger aboard from birth (three faces, the shared law)`
  : `${fail} red — the find-bar layer moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: prevReceipt?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t870-find-bar-a11y.mjs",
  ruler: NAMEOF_LAW,
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> Ctrl+F door -> summoned bar (named, focused, honestly silent) -> query 'ion' (the live count door) -> wrap walk (Enter/door/Shift+Enter, the modulo law) -> chip lens (radio machines + the honest zero) -> Escape seat -> reopen (the ephemeral law) -> keymap seat -> worldBack + seed hygiene (one command)",
  doors: {
    open: "window keydown Ctrl+F — the product's own keyboard door",
    cycle: "Enter / Shift+Enter on the input + the count button door (Task 137's three triggers)",
    chips: "click the aria-pressed chips — the radio machines",
    close: "Escape on the input + the Close door — every exit taught",
  },
  openingCanvas: OPEN,
  matchedN: N,
  faces: {
    findBar: { live: f2 },
    findLens: { live: f3 },
    worldBack: { live: w1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, "shots-qa/t870-find-bar-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nFIND-BAR-A11Y t870: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
