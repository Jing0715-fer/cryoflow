#!/usr/bin/env node
/**
 * t978 — the SELECT RIDER's SEAT walk (the (d′) candidate's browser
 * witness, the t975 recorded-not-cured ①): on the t978 minted world
 * (a completed class2d NINTH + a completed class3d TENTH, the
 * select-shaped graph — C on the classes mouth, P on the particles
 * twin), the class A/B dialog's rider contract pinned LIVE:
 *
 *   · the class2d host: the Class A/B door renders, the verdict loads
 *     (1 gained / 1 lost / 1 held — the join's own math), and the
 *     rider RENDERS DISABLED with the graph's own reason — aria
 *     verbatim "Continue downstream with these classes selected —
 *     unavailable: All 1 downstream wire(s) refused — port" (the mint
 *     declares ONE output, particles; C's classes-mouth wire refuses).
 *   · the class3d host: the SAME door renders, the verdict loads
 *     (1 gained — improvedSeries.length > 0, the data would enable) —
 *     and the rider's SEAT IS ABSENT ([data-testid="adopt-with-select"]
 *     finds nothing). THE SHARPEST ABSENCE: the hiding is the
 *     mouth-coverage gate's choice (the classes mouth starves on a
 *     class3d), never a data verdict — while the PLAIN adopt verb
 *     stays ENABLED speaking "re-wires 1 of ..." (the t954 M-pin's
 *     live twin: the plan would move P's particles wire).
 *
 * GATE mode only — the face is born-honest by design; the walk pins
 * the contract (R1..R10) and leaves PNG receipts.
 *
 *   node scripts/t978-rider-seat-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t978-rider-seat-walk.json");
const NAME_A = "2D Classification 1 (t978)";
const NAME_B = "3D Classification 1 (t978)";

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
/* the find-bar opener — the t972/t973 law: Reset view is NOT a fit, the
 * overlay can cover a card, scrollIntoView is a no-op on the transform
 * canvas */
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
/* closing takes TWO Escapes when the compare dialog rode on top of the
 * inspector (the walk opens both) — Escape closes the TOPMOST layer, so
 * the loop presses until NEITHER dialog remains (the stale-inspector
 * fight is the FATAL's own lesson) */
const closeInspector = async () => {
  for (let i = 0; i < 4; i++) {
    const st = evalJson(`(() => { const ins = [...document.querySelectorAll('[data-inspector-dialog]')].some(d => d.getBoundingClientRect().width > 0); const cmp = [...document.querySelectorAll('[data-compare-dialog]')].some(d => d.getBoundingClientRect().width > 0); return JSON.stringify({ ins, cmp }); })()`);
    if (!st || (!st.ins && !st.cmp)) return true;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(900);
  }
  return evalJson(`(() => JSON.stringify({ left: document.querySelectorAll('[data-inspector-dialog]').length }))()`);
};

/* the inspector header's Class A/B door — the spec's own aria */
const doorExpr = (hostName) => `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${hostName}')); return [...(d?.querySelectorAll('button') ?? [])].find(b => (b.getAttribute('aria-label') ?? '').startsWith('Class A/B')) ?? null; })()`;

/* the compare dialog's own probes — the region + the rider seat */
const compareExpr = (hostName) => `(() => {
  const dlg = document.querySelector('[data-compare-dialog]');
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const region = dlg.querySelector('[aria-label="Run comparison reading — the A/B verdict and its adoption verbs"]');
  const rider = dlg.querySelector('[data-testid="adopt-with-select"]');
  const plain = dlg.querySelector('[data-testid="adopt-downstream"]');
  const title = dlg.querySelector('[role="heading"], h2, [data-slot="dialog-title"]')?.textContent ?? dlg.textContent.slice(0, 60);
  const out = {
    title: (title || "").trim().slice(0, 60),
    region: !!region,
    text: (dlg.textContent || "").replace(/\\s+/g, " ").slice(0, 900),
  };
  if (rider) {
    out.rider = {
      present: true,
      disabled: rider.disabled,
      aria: rider.getAttribute("aria-label") ?? "",
      title: rider.getAttribute("title") ?? "",
      label: (rider.textContent || "").replace(/\\s+/g, " ").trim(),
    };
  } else {
    out.rider = { present: false };
  }
  if (plain) {
    out.plain = {
      disabled: plain.disabled,
      aria: plain.getAttribute("aria-label") ?? "",
      label: (plain.textContent || "").replace(/\\s+/g, " ").trim(),
    };
  }
  out.shellOverX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  return JSON.stringify(out);
})()`;

/* the verdict's load poll — the region + the pair's rows landed (the
 * text carries the join's own words: gained/lost/held chips) */
const verdictReady = (v) => v && !v.err && v.region && /\bgained\b/.test(v.text);

console.log("== t978 the select rider's seat walk (GATE) ==");

sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);

/* ---------- the class2d host: the rider PRESENT-DISABLED ---------- */
/* the full NAME, not the type — "3D Classification" matches THREE cards
 * (the t972/t976 faces are class3d too); the unique name matches ONE */
if (!String(await findAndCenter(NAME_A)).startsWith("centered:")) {
  console.log("  (find-bar opener did not center — falling back to the hard opener)");
}
if (!String(await openInspectorHard(NAME_A)).startsWith("open@try")) {
  console.log("FATAL: the class2d host's inspector never opened");
  process.exit(2);
}
await sleep(600);

const doorA = await poll(
  `(() => { const b = (${doorExpr(NAME_A)}); if (!b) return null; return JSON.stringify({ aria: b.getAttribute("aria-label") ?? "", title: b.getAttribute("title") ?? "" }); })()`,
  (v) => !!v && !!v.aria, 8, 500,
);
ok("R1 the class2d host carries the Class A/B door", !!doorA, doorA ? `"${doorA.aria}"` : "missing");
ok("R2 the door's aria speaks the sibling count (1 sibling runs available)", (doorA?.aria ?? "").includes("(1 sibling runs available)"), doorA?.aria ?? "");

const clickedA = await realClick(doorExpr(NAME_A));
ok("R3 the door opens the compare dialog", String(clickedA).startsWith("clicked@"), clickedA);
const vA = await poll(compareExpr(NAME_A), verdictReady, 24, 600);
if (!vA) { console.log("FATAL: the class2d pair verdict never loaded"); process.exit(2); }
console.log(`  class2d dialog: title="${vA.title}" rider=${JSON.stringify(vA.rider)}`);
mkdirSync(QA_DIR, { recursive: true });
sh(`${AB} screenshot ${QA_DIR}/t978-rider-class2d-host.png`);

ok("R4 the dialog's title is the class domain's (Class A/B — Occupancy share)", vA.title.includes("Class A/B") && vA.title.includes("Occupancy share"), `"${vA.title}"`);
ok("R5 the verdict loads with the join's own words (gained/lost/held)", /\bgained\b/.test(vA.text) && /\blost\b/.test(vA.text) && /\bheld\b/.test(vA.text));
ok("R6 THE RIDER RENDERS on the class2d host (selectWired true, improved 1)", vA.rider.present === true);
ok("R7 the rider is DISABLED with the graph's own reason (the plan refuses the classes-mouth wire)",
  vA.rider.present && vA.rider.disabled === true, vA.rider.present ? `disabled=${vA.rider.disabled}` : "no rider");
ok("R8 the rider's aria is the unavailable speech, verbatim",
  (vA.rider.aria ?? "") === "Continue downstream with these classes selected — unavailable: All 1 downstream wire(s) refused — port",
  `"${vA.rider.aria ?? ""}"`);
ok("R9 the rider's label counts the gained classes ((1))", (vA.rider.label ?? "").includes("Continue downstream, selecting these") && (vA.rider.label ?? "").includes("(1)"), vA.rider.label ?? "");

await closeInspector();

/* ---------- the class3d host: THE SHARPEST ABSENCE ---------- */
/* the leg opens FRESH — the class2d leg stacked the compare dialog on
 * the inspector, and a half-closed stack fights every later probe (the
 * first ride's FATAL lesson: two Escapes is still a guess; a fresh page
 * load is a fact) */
sh(`${AB} open ${BASE}/`);
await sleep(2800);
sh(`${AB} set viewport 1280 800`);
await sleep(1000);
if (!String(await findAndCenter(NAME_B)).startsWith("centered:")) {
  console.log("  (find-bar opener did not center — falling back to the hard opener)");
}
if (!String(await openInspectorHard(NAME_B)).startsWith("open@try")) {
  console.log("FATAL: the class3d host's inspector never opened");
  process.exit(2);
}
await sleep(600);
const doorB = await poll(
  `(() => { const b = (${doorExpr(NAME_B)}); if (!b) return null; return JSON.stringify({ aria: b.getAttribute("aria-label") ?? "" }); })()`,
  (v) => !!v && !!v.aria, 8, 500,
);
ok("R10 the class3d host carries the SAME Class A/B door (the dialog itself is not gated)", !!doorB, doorB ? `"${doorB.aria}"` : "missing");

const clickedB = await realClick(doorExpr(NAME_B));
ok("R11 the class3d dialog opens", String(clickedB).startsWith("clicked@"), clickedB);
const vB = await poll(compareExpr(NAME_B), verdictReady, 24, 600);
if (!vB) { console.log("FATAL: the class3d pair verdict never loaded"); process.exit(2); }
console.log(`  class3d dialog: title="${vB.title}" rider=${JSON.stringify(vB.rider)} plain=${vB.plain ? `${vB.plain.label} disabled=${vB.plain.disabled}` : "missing"}`);
sh(`${AB} screenshot ${QA_DIR}/t978-rider-class3d-host.png`);

ok("R12 the class3d verdict loads TOO — improved = 1 (the data would enable the rider)", /\bgained\b/.test(vB.text), "the join's words present");
ok("R13 THE SHARPEST ABSENCE: the rider's seat is GONE on the class3d host", vB.rider.present === false);
ok("R14 the plain adopt verb STAYS (the hiding is the rider's, not the dialog's death)", !!vB.plain, vB.plain?.label ?? "missing");
ok("R15 the plain verb speaks the live counter-proof (re-wires 1 of — the plan would move P)",
  !!vB.plain && vB.plain.disabled === false && (vB.plain.aria ?? "").includes("re-wires 1 of"),
  vB.plain ? `disabled=${vB.plain.disabled} aria="${(vB.plain.aria ?? "").slice(0, 90)}"` : "missing");
ok("R16 the shell never scrolls on either face", vA.shellOverX === false && vB.shellOverX === false);

await closeInspector();

/* ---------- the receipt ---------- */
const receipt = {
  instrument: "t978-rider-seat-walk",
  mode: "GATE",
  at: new Date().toISOString(),
  world: { class2d: NAME_A, class3d: NAME_B },
  class2dHost: vA,
  class3dHost: vB,
  doors: { class2d: doorA?.aria, class3d: doorB?.aria },
};
writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2));
console.log(`receipt: ${RECEIPT}`);
console.log(`== t978 walk GATE done — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
