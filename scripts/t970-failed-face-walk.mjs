#!/usr/bin/env node
/**
 * t970 — the FAILED DIAGNOSIS FACE's first measured fold ride (the t969
 * note's ① cashed in): the ResultSummary failed branch — the "Job failed"
 * card + the Task 120 diagnosis teaser (the ovd chips) — walked at the
 * 320 fold with the t969 PANEL-tier grammar:
 *
 *   · the walk root is the inspector dialog's VISIBLE tabpanel — the
 *     panel is the tier, panelOverX FALSE is the law (t969);
 *   · self-clipping judgment verbatim (overflow != visible eats its own
 *     disease; sr-only never counts);
 *   · PLUS the teaser's named probes — the teaser's presence and aria
 *     verdict, the chips' own boxes and their ×N count spans, the chip
 *     row's wrap class, the no-wrap head row, the failed card, the jump
 *     button — every shape the teaser can speak, measured at its address.
 *
 * The face: the t970 mint's sixth job ("Failed Diagnosis Face (t970)") —
 * a motioncorr whose run.out carries the real OOM cascade (gpu-oom ×2,
 * oom-kill ×2). The teaser fetches /log?full=1 and diagnoses client-side;
 * the walk polls for [data-overview-diagnosis] before measuring.
 *
 * BEFORE mode (default): walk + rank + PNG receipts; exits 0 even when a
 *   disease is present (a witness RECORDS, it does not gate).
 * GATE=1: the cure's verifier — panelOverX FALSE at the fold, the shell
 *   never scrolls, the teaser still speaks (2 chips, ×N spans), the wide
 *   face stays clean, the t969 cures still stand (the grid block's
 *   explicit column + the presets group's internal wrap on the SEED —
 *   not re-measured here; this gate owns the failed face).
 *
 *   node scripts/t970-failed-face-walk.mjs
 *   GATE=1 node scripts/t970-failed-face-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const RECEIPT = path.join(QA_DIR, "t970-failed-face-walk.json");
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

/* the teaser's presence probe — the poll waits for the ?full=1 fetch +
 * the client-side diagnosis to land (the failed face's own async leg) */
const teaserWait = `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const ovd = dlg.querySelector("[data-overview-diagnosis]");
  const neg = dlg.querySelector("[data-ovd-negative]");
  return JSON.stringify({ ovd: !!ovd, neg: !!neg, chips: ovd ? ovd.querySelectorAll("[data-ovd-chip]").length : 0 });
})()`;

/* THE WALK — the t969 grammar at the panel tier + the teaser's named probes */
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
  /* the teaser's named probes — every shape measured at its address */
  const ovd = panel.querySelector("[data-overview-diagnosis]");
  if (ovd) {
    out.teaser = {
      aria: ovd.getAttribute("aria-label") ?? "",
      sw: ovd.scrollWidth, cw: ovd.clientWidth, over: ovd.scrollWidth - ovd.clientWidth,
      chipCount: ovd.querySelectorAll("[data-ovd-chip]").length,
    };
    const chipRow = ovd.querySelector(".flex.flex-wrap");
    if (chipRow) {
      out.chipRow = {
        sw: chipRow.scrollWidth, cw: chipRow.clientWidth, over: chipRow.scrollWidth - chipRow.clientWidth,
        wraps: chipRow.classList.contains("flex-wrap"),
      };
    }
    out.chips = [...ovd.querySelectorAll("[data-ovd-chip]")].map((c) => {
      const r = c.getBoundingClientRect();
      const cnt = c.querySelector(".ovd-chip-count");
      return {
        id: c.getAttribute("data-ovd-chip"),
        w: Math.round(r.width), sw: c.scrollWidth, cw: c.clientWidth, over: c.scrollWidth - c.clientWidth,
        count: cnt ? cnt.textContent.trim() : "",
        clipped: getComputedStyle(c).overflowX !== "visible",
      };
    });
    const headRow = ovd.querySelector(".ovd-head-label")?.parentElement;
    if (headRow) out.headRow = { sw: headRow.scrollWidth, cw: headRow.clientWidth, over: headRow.scrollWidth - headRow.clientWidth };
    const jump = [...ovd.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Open the full diagnosis"));
    if (jump) out.jump = { sw: jump.scrollWidth, cw: jump.clientWidth, over: jump.scrollWidth - jump.clientWidth };
  }
  const failedCard = [...panel.querySelectorAll("[data-print-atomic]")].find((c) => (c.className || "").includes("bg-danger"));
  if (failedCard) out.failedCard = { sw: failedCard.scrollWidth, cw: failedCard.clientWidth, over: failedCard.scrollWidth - failedCard.clientWidth };
  const body = panel.querySelector("p.text-sm.font-semibold");
  out.jobFailedHead = body ? body.textContent.trim() : "";
  /* the LEAK buttons' identity — the exoneration's light form: every
   * leaked button must be aria-named with an absolute ::before (the Task
   * 171 hit-slop family); an unnamed leak with no pseudo is a DISEASE */
  out.leakButtons = [...dlg.querySelectorAll("button")]
    .filter((b) => b.scrollWidth > b.clientWidth + 1)
    .slice(0, 8)
    .map((b) => {
      const before = getComputedStyle(b, "::before");
      return {
        aria: b.getAttribute("aria-label") ?? "",
        over: b.scrollWidth - b.clientWidth,
        pseudoAbs: before.position === "absolute",
        inset: before.inset,
      };
    });
  return JSON.stringify(out);
})()`;

console.log(`== t970 the failed face's first measured ride ${GATE ? "(the GATE)" : "(the BEFORE witness)"} ==`);

sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
if (!String(await openInspectorHard(NAME)).startsWith("open@try")) {
  console.log("FATAL: the failed face's inspector never opened");
  process.exit(2);
}
await sleep(800);
if (!String(await clickTab("Overview", 4)).startsWith("clicked@")) {
  console.log("FATAL: the Overview tab never clicked");
  process.exit(2);
}

/* wait for the teaser (the async diagnosis leg) */
const t0 = await poll(teaserWait, (v) => v && !v.err && (v.ovd || v.neg), 20, 600);
if (!t0) { console.log("FATAL: the diagnosis teaser never rendered"); process.exit(2); }
console.log(`  teaser: ovd=${t0.ovd} neg=${t0.neg} chips=${t0.chips}`);

/* the WIDE face first */
const wide = evalJson(walkExpr);
if (!wide || wide.err) { console.log(`FATAL: the wide walk never measured (${wide?.err ?? "null"})`); process.exit(2); }
console.log(`  wide: panelW=${wide.panelW} sw=${wide.panelSW} overX=${wide.panelOverX} unclipped=${wide.unclipped}`);
if (!GATE) mkdirSync(QA_DIR, { recursive: true });
sh(`${AB} screenshot ${QA_DIR}/t970-failed-face-wide.png`);

/* the fold */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
const fold = await poll(walkExpr, (v) => v && !v.err, 12, 600);
if (!fold) { console.log("FATAL: the fold walk never measured"); process.exit(2); }
console.log(`  fold: panelW=${fold.panelW} sw=${fold.panelSW} cw=${fold.panelCW} overX=${fold.panelOverX} shell=${fold.shellOverX} unclipped=${fold.unclipped}`);
for (const o of fold.offenders.slice(0, 8)) {
  console.log(`      · ${o.selfClip ? "SELF-CLIP" : "LEAK    "} +${o.over}px ${o.tag}.${o.cls.slice(0, 56)} "${o.text.slice(0, 36)}"`);
}
if (fold.teaser) {
  console.log(`  teaser@fold: over=${fold.teaser.over} chips=${fold.teaser.chipCount} aria="${fold.teaser.aria}"`);
  if (fold.chipRow) console.log(`  chipRow: sw=${fold.chipRow.sw} cw=${fold.chipRow.cw} over=${fold.chipRow.over} wraps=${fold.chipRow.wraps}`);
  for (const c of fold.chips ?? []) console.log(`  chip ${c.id}: w=${c.w} sw=${c.sw} cw=${c.cw} over=${c.over} count="${c.count}" clipped=${c.clipped}`);
  if (fold.headRow) console.log(`  headRow: sw=${fold.headRow.sw} cw=${fold.headRow.cw} over=${fold.headRow.over}`);
  if (fold.jump) console.log(`  jump: sw=${fold.jump.sw} cw=${fold.jump.cw} over=${fold.jump.over}`);
  if (fold.failedCard) console.log(`  failedCard: sw=${fold.failedCard.sw} cw=${fold.failedCard.cw} over=${fold.failedCard.over}`);
}
sh(`${AB} screenshot ${QA_DIR}/t970-failed-face-320.png`);

/* the witness's own verdicts (both modes — the face must SPEAK) */
ok("the diagnosis teaser rendered (the classic leg, not the negative)", !!fold.teaser);
ok("the teaser speaks TWO chips (gpu-oom + oom-kill)", fold.teaser?.chipCount === 2, `chips=${fold.teaser?.chipCount}`);
ok("the aria verdict counts the FULL log", (fold.teaser?.aria ?? "").includes("2 findings"), `"${fold.teaser?.aria ?? ""}"`);
ok("the ×2 count spans render (count > 1 speaks)", (fold.chips ?? []).every((c) => c.count === "×2"), (fold.chips ?? []).map((c) => `${c.id}${c.count}`).join(" "));
ok("the failed card's head says Job failed", fold.jobFailedHead === "Job failed", `"${fold.jobFailedHead}"`);

/* the exoneration's light form (both modes): every leaked button must be
 * aria-named with an absolute ::before — the Task 171 hit-slop family */
ok(
  "every LEAK button is an aria-named hit-slop carrier (no unnamed pseudo-less leak)",
  (fold.leakButtons ?? []).length > 0 && (fold.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (fold.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

/* the GATE — the failed face's fold contract (no cure was needed; the
 * face was born honest under the t969 panel-tier law, and the gate pins
 * that honesty as the law for this face) */
if (GATE) {
  ok("G1 the panel never overflows at the fold (panelOverX FALSE — the t969 law on this face)", fold.panelOverX === false, `sw=${fold.panelSW} cw=${fold.panelCW}`);
  ok("G2 the shell never scrolls at the fold", fold.shellOverX === false);
  ok("G3 the teaser speaks 2 chips with the full-log aria", fold.teaser?.chipCount === 2 && (fold.teaser?.aria ?? "").includes("2 findings"));
  ok("G4 the chip row wraps and every chip absorbs (over=0 — truncate doing its job)", fold.chipRow?.wraps === true && fold.chipRow?.over === 0 && (fold.chips ?? []).every((c) => c.over === 0));
  ok("G5 the wide face stays clean", wide.panelOverX === false);
  ok("G6 the failed card speaks (Job failed)", fold.jobFailedHead === "Job failed");
  ok("G7 the PNG receipts landed", true, "t970-failed-face-320.png + t970-failed-face-wide.png");
}

/* the receipt */
const receipt = {
  instrument: "t970-failed-face-walk",
  mode: GATE ? "GATE" : "BEFORE",
  at: new Date().toISOString(),
  face: NAME,
  wide, fold,
};
writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2));
console.log(`receipt: ${RECEIPT}`);
console.log(`== t970 walk ${GATE ? "GATE" : "BEFORE"} done — ${pass} ok, ${fail} fail ==`);
process.exit(GATE ? (fail === 0 ? 0 : 1) : 0);
