#!/usr/bin/env node
/**
 * t976 — the WALLTIME FLIP walk + the negative leg's re-face (two
 * segments, one ride):
 *
 *   SEGMENT A — the FLIP on the t972 face: the world's SEVENTH job
 *   ("Negative Diagnosis Face (t972)", the walltime death) carried the
 *   negative teaser since t972; the t976 ride added the walltime-limit
 *   row to the signature table (SLURM's own "DUE TO TIME LIMIT" is the
 *   scheduler's narration — the same epistemic class as bash's
 *   "Killed"), and the face FLIPPED positive. This segment witnesses
 *   the flip live: the rose teaser with EXACTLY ONE chip
 *   (data-ovd-chip="walltime-limit", the table's own label + hint), and
 *   — the t972 GATE's G6/G7 twin — the jump "Open the full diagnosis"
 *   lands the Log tab in Full mode where the strip NOW EXISTS (the
 *   findings.length > 0 gate opens on the flip: "the strip RETURNS on
 *   the flipped face"), its row the walltime row quoting SLURM's words.
 *
 *   SEGMENT B — the negative leg's NEW home, the t976 cancelled face:
 *   the world's EIGHTH job ("Cancelled Diagnosis Face (t976)") — a
 *   class3d killed by an operator scancel SLURM recorded WITHOUT a
 *   reason (*** CANCELLED AT … *** — no "DUE TO TIME LIMIT" suffix, so
 *   the walltime row stays out; bash's "Terminated", not "Killed", so
 *   the oom-kill row stays out). diagnoseFailureLog(full run.out) === []
 *   by construction — the mint's 16-pattern mirror proves it at the API
 *   tier; THIS walk is the ground truth: the zinc negative teaser ("0
 *   findings", chipless, the honest note reads whole), the jump "Read
 *   the full log" lands Full mode where the strip is ABSENT by design
 *   (the honest silence), and the fold contract (G1..G9) holds on the
 *   re-faced leg.
 *
 *   The contrast leg closes the ride: the t970 face still speaks the
 *   POSITIVE teaser (2 chips) — the three-state law's both legs on one
 *   canvas, now with the flip between them.
 *
 * BEFORE mode (default): walk + verdicts + PNG receipts; exits 0 even
 *   when a disease is present (a witness RECORDS, it does not gate).
 * GATE=1: the negative leg's fold contract + the flip's strip contract.
 *
 *   node scripts/t976-walltime-flip-walk.mjs
 *   GATE=1 node scripts/t976-walltime-flip-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const FLIP_NAME = "Negative Diagnosis Face (t972)"; // the walltime face — flipped positive by the t976 row
const NEG_NAME = "Cancelled Diagnosis Face (t976)"; // the negative leg's new home
const POS_NAME = "Failed Diagnosis Face (t970)"; // the contrast leg — Task 120's rose teaser
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
/* the t970 walk's realClick — visible-point validation + inset candidates */
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

/* the find-bar opener — Reset view does NOT fit the world, the
 * bottom-right overlay can cover a card, and the canvas is
 * transform-positioned (scrollIntoView is a no-op). The find bar's
 * match button CENTERS the job — the honest user flow. */
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
const clickTab = async (name, label, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${name}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('${label}')) ?? null; })()`);
    if (String(clicked).startsWith("clicked@")) return clicked;
    await sleep(800);
  }
  return "NEVER-CLICKED";
};

/* the teaser's presence probe — polls the ?full=1 fetch + the client-side
 * diagnosis (the failed face's own async leg), parameterized by face */
const teaserWait = (name) => `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${name}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const ovd = dlg.querySelector("[data-overview-diagnosis]");
  return JSON.stringify({ ovd: !!ovd, neg: !!(ovd && ovd.hasAttribute("data-ovd-negative")) });
})()`;

/* THE WALK — the t969/t970 panel-tier grammar + the card's named probes
 * (leg-agnostic: the same probe reads the zinc negative card AND the
 * rose positive card) */
const walkExpr = (name) => `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${name}'));
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
  /* the card's named probes — every shape measured at its address */
  const ovd = panel.querySelector("[data-overview-diagnosis]");
  if (ovd) {
    const box = (el) => el ? { sw: el.scrollWidth, cw: el.clientWidth, over: el.scrollWidth - el.clientWidth } : null;
    out.card = {
      neg: ovd.hasAttribute("data-ovd-negative"),
      aria: ovd.getAttribute("aria-label") ?? "",
      zinc: (ovd.className || "").includes("border-zinc-500/25"),
      iconSvg: !!ovd.querySelector("svg"),
      headLabel: ovd.querySelector(".ovd-head-label")?.textContent ?? "",
      count: ovd.querySelector(".ovd-count")?.textContent ?? "",
      chips: [...ovd.querySelectorAll("[data-ovd-chip]")].map((c) => ({
        id: c.getAttribute("data-ovd-chip"),
        label: (c.querySelector(".ovd-chip-label")?.textContent ?? "").trim(),
        hint: c.getAttribute("title") ?? "",
      })),
      chipCount: ovd.querySelectorAll("[data-ovd-chip]").length,
      ...box(ovd),
      note: ovd.querySelector(".ovd-negative-note") ? {
        text: (ovd.querySelector(".ovd-negative-note").textContent || "").replace(/\\s+/g, " ").trim(),
        ...box(ovd.querySelector(".ovd-negative-note")),
      } : null,
      jump: ovd.querySelector("button") ? {
        text: (ovd.querySelector("button").textContent || "").replace(/\\s+/g, " ").trim(),
        ...box(ovd.querySelector("button")),
      } : null,
    };
  }
  const failedP = [...panel.querySelectorAll("p")].find((p) => p.textContent === "Job failed");
  out.jobFailedHead = failedP ? "Job failed" : "";
  /* the exoneration probe — the t970/t971 law verbatim: a leaked button
   * must be aria-named with an absolute ::before (the Task 171 hit-slop
   * family); an unnamed leak with no pseudo is a DISEASE */
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

console.log(`== t976 the walltime flip + the negative leg's re-face ${GATE ? "(the GATE)" : "(the BEFORE witness)"} ==`);

/* fresh open + the eval-hang law */
sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);

/* ============================ SEGMENT A — the FLIP ============================ */
console.log("-- segment A: the t972 face (the walltime face, flipped) --");
const centeredA = await findAndCenter("Negative Diagnosis");
console.log(`  find-bar: ${centeredA}`);
if (!String(await openInspectorHard(FLIP_NAME)).startsWith("open@try")) {
  console.log("FATAL: the t972 face's inspector never opened");
  process.exit(2);
}
await sleep(800);
if (!String(await clickTab(FLIP_NAME, "Overview", 4)).startsWith("clicked@")) {
  console.log("FATAL: the Overview tab never clicked");
  process.exit(2);
}

/* wait for the teaser (the async diagnosis leg) — now the POSITIVE leg */
const tA = await poll(teaserWait(FLIP_NAME), (v) => v && !v.err && v.ovd, 20, 600);
if (!tA) { console.log("FATAL: the overview diagnosis never rendered"); process.exit(2); }
console.log(`  teaser: ovd=${tA.ovd} neg=${tA.neg}`);

const wideA = evalJson(walkExpr(FLIP_NAME));
if (!wideA || wideA.err) { console.log(`FATAL: the wide walk never measured (${wideA?.err ?? "null"})`); process.exit(2); }
console.log(`  wide: panelW=${wideA.panelW} sw=${wideA.panelSW} overX=${wideA.panelOverX}`);
mkdirSync(QA_DIR, { recursive: true });
sh(`${AB} screenshot ${QA_DIR}/t976-walltime-flip-wide.png`);

/* the flip's own verdicts (both modes — the face must SPEAK) */
ok("the FLIP: the t972 face now speaks the POSITIVE teaser (the t976 walltime row flipped it)", !!wideA.card && wideA.card.neg === false, `neg=${wideA.card?.neg}`);
ok("the flipped teaser's aria verdict counts 1 finding in the full log", wideA.card?.aria === "Failure diagnosis: 1 finding in the full log", `"${wideA.card?.aria ?? ""}"`);
ok("the flipped teaser carries exactly ONE chip (data-ovd-chip=walltime-limit)", wideA.card?.chips?.length === 1 && wideA.card.chips[0].id === "walltime-limit", JSON.stringify(wideA.card?.chips ?? []));
ok("the chip's label is the table's own sentence (the scheduler's word)", wideA.card?.chips?.[0]?.label === "Killed by the scheduler — the job outlived its time limit", `"${wideA.card?.chips?.[0]?.label ?? ""}"`);
ok("the chip's hint rides the title (the actionable next step)", (wideA.card?.chips?.[0]?.hint ?? "").includes("time limit"), `${(wideA.card?.chips?.[0]?.hint ?? "").length}B`);
ok("the chip carries an icon (svg present)", wideA.card?.iconSvg === true);
ok("the failed card's head says Job failed", wideA.jobFailedHead === "Job failed", `"${wideA.jobFailedHead}"`);

/* the exoneration on the flipped face (wide) */
ok(
  "every LEAK button is an aria-named hit-slop carrier (wide, flipped face)",
  (wideA.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (wideA.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

/* the fold face of the flipped teaser */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
const foldA = await poll(walkExpr(FLIP_NAME), (v) => v && !v.err, 12, 600);
if (!foldA) { console.log("FATAL: the fold walk never measured"); process.exit(2); }
console.log(`  fold: panelW=${foldA.panelW} sw=${foldA.panelSW} cw=${foldA.panelCW} overX=${foldA.panelOverX} shell=${foldA.shellOverX}`);
if (foldA.card) console.log(`  card@fold: over=${foldA.card.over} neg=${foldA.card.neg} chips=${foldA.card.chipCount}`);
sh(`${AB} screenshot ${QA_DIR}/t976-walltime-flip-320.png`);

ok("G-A1 the flipped teaser's panel never overflows at the fold (the t969 law holds on the new leg)", foldA.panelOverX === false, `sw=${foldA.panelSW} cw=${foldA.panelCW}`);
ok("G-A2 the flipped teaser's card absorbs at the fold", (foldA.card?.over ?? 1) === 0, `over=${foldA.card?.over}`);
ok(
  "every LEAK button is an aria-named hit-slop carrier (fold, flipped face)",
  (foldA.leakButtons ?? []).length > 0 && (foldA.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (foldA.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

if (GATE) {
  /* the FLIP's strip contract — the t972 GATE's G6/G7 twin: the jump
   * lands the Log tab in Full mode where the strip NOW EXISTS (the
   * findings.length > 0 gate opens on the flip) */
  const jumpClick = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${FLIP_NAME}')); const b = [...(d?.querySelectorAll('[data-overview-diagnosis] button') ?? [])].find(x => (x.textContent || '').includes('Open the full diagnosis')); return b ?? null; })()`);
  const jumpLanded = await poll(
    `(() => {
      const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${FLIP_NAME}'));
      if (!d) return JSON.stringify({ err: "no-dialog" });
      const tabs = [...(d.querySelectorAll('[role="tab"]') ?? [])];
      const logTab = tabs.find(t => (t.textContent || '').trim().startsWith('Log'));
      const fullBtn = [...(d.querySelectorAll('[role="group"][aria-label="Log window mode"] button') ?? [])].find(b => (b.textContent || '').trim() === 'Full');
      const strip = d.querySelector('[data-log-diagnosis]');
      const row = d.querySelector('[data-finding="walltime-limit"]');
      return JSON.stringify({
        logSelected: logTab?.getAttribute('aria-selected') === 'true',
        fullMode: fullBtn?.getAttribute('aria-pressed') === 'true',
        consoleThere: !!d.querySelector('[data-log-console]'),
        stripThere: !!strip,
        stripAria: strip?.getAttribute('aria-label') ?? "",
        rowThere: !!row,
        rowExcerpt: (row?.querySelector('.diag-excerpt')?.textContent ?? "").trim(),
        rowCount: (row?.querySelector('.diag-linebadge')?.textContent ?? "").trim(),
      });
    })()`,
    (v) => v && !v.err && v.logSelected && v.stripThere, 10, 600,
  );
  ok("G-A3 the flip's jump lands the Log tab in FULL mode", !!jumpLanded && jumpLanded.fullMode === true, JSON.stringify(jumpLanded ?? {}));
  ok("G-A4 the strip RETURNS on the flipped face (the findings.length > 0 gate opens — the honest silence's other side)", !!jumpLanded && jumpLanded.stripThere === true && jumpLanded.consoleThere === true, JSON.stringify(jumpLanded ?? {}));
  ok("G-A5 the strip's row is the walltime row (data-finding=walltime-limit)", !!jumpLanded && jumpLanded.rowThere === true);
  ok("G-A6 the strip's excerpt quotes SLURM's own words (DUE TO TIME LIMIT)", (jumpLanded?.rowExcerpt ?? "").includes("DUE TO TIME LIMIT"), `"${(jumpLanded?.rowExcerpt ?? "").slice(0, 80)}"`);
  ok("G-A7 the strip's line badge carries the first line (no ×N — the line appears once)", /^L\d+$/.test(jumpLanded?.rowCount ?? ""), `"${jumpLanded?.rowCount ?? ""}"`);
  sh(`${AB} screenshot ${QA_DIR}/t976-walltime-flip-strip.png`);
}

/* ==================== SEGMENT B — the negative leg's re-face ==================== */
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
try { sh(`${AB} press Escape`); } catch {}
await sleep(800);
console.log("-- segment B: the t976 face (the negative leg's new home) --");
const centeredB = await findAndCenter("Cancelled Diagnosis");
console.log(`  find-bar: ${centeredB}`);
if (!String(await openInspectorHard(NEG_NAME)).startsWith("open@try")) {
  console.log("FATAL: the t976 face's inspector never opened");
  process.exit(2);
}
await sleep(800);
if (!String(await clickTab(NEG_NAME, "Overview", 4)).startsWith("clicked@")) {
  console.log("FATAL: the Overview tab never clicked");
  process.exit(2);
}

/* wait for the teaser — the NEGATIVE leg again (on its new face) */
const tB = await poll(teaserWait(NEG_NAME), (v) => v && !v.err && v.ovd, 20, 600);
if (!tB) { console.log("FATAL: the overview diagnosis never rendered"); process.exit(2); }
console.log(`  teaser: ovd=${tB.ovd} neg=${tB.neg}`);

/* the fold face of the negative leg (the t972 walk's contract, re-faced) */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
const foldB = await poll(walkExpr(NEG_NAME), (v) => v && !v.err, 12, 600);
if (!foldB) { console.log("FATAL: the fold walk never measured"); process.exit(2); }
console.log(`  fold: panelW=${foldB.panelW} sw=${foldB.panelSW} cw=${foldB.panelCW} overX=${foldB.panelOverX} shell=${foldB.shellOverX} unclipped=${foldB.unclipped}`);
for (const o of foldB.offenders.slice(0, 8)) {
  console.log(`      · ${o.selfClip ? "SELF-CLIP" : "LEAK    "} +${o.over}px ${o.tag}.${o.cls.slice(0, 56)} "${o.text.slice(0, 36)}"`);
}
if (foldB.card) {
  console.log(`  negCard@fold: over=${foldB.card.over} neg=${foldB.card.neg} zinc=${foldB.card.zinc} count="${foldB.card.count}" chips=${foldB.card.chipCount}`);
  if (foldB.card.note) console.log(`  note: over=${foldB.card.note.over} "${foldB.card.note.text.slice(0, 70)}"`);
  if (foldB.card.jump) console.log(`  jump: over=${foldB.card.jump.over} "${foldB.card.jump.text}"`);
}
sh(`${AB} screenshot ${QA_DIR}/t976-cancelled-negative-320.png`);

/* the negative card's verdicts (both modes — the re-faced leg must SPEAK) */
ok("the overview diagnosis rendered on the cancelled face", !!foldB.card);
ok("the NEGATIVE leg is the leg that rendered (data-ovd-negative — the leg's NEW home)", foldB.card?.neg === true);
ok("the aria verdict says no signature matched the FULL log", foldB.card?.aria === "No known failure signature matched the full log", `"${foldB.card?.aria ?? ""}"`);
ok("the count span reads 0 findings", foldB.card?.count === "0 findings", `"${foldB.card?.count ?? ""}"`);
ok("the negative leg is CHIPLESS by design (zero ovd-chips)", foldB.card?.chipCount === 0, `chips=${foldB.card?.chipCount}`);
ok("the zinc styling is the negative leg's own (border-zinc-500/25)", foldB.card?.zinc === true);
ok("the SearchX icon rides the negative card (svg present)", foldB.card?.iconSvg === true);
ok("the honest note reads whole (the cause is custom, the log is the truth)", (foldB.card?.note?.text ?? "").startsWith("No known failure signature matched the full log — the cause is custom"));
ok("the jump button speaks the negative leg's own words", foldB.card?.jump?.text === "Read the full log", `"${foldB.card?.jump?.text ?? ""}"`);
ok("the failed card's head says Job failed", foldB.jobFailedHead === "Job failed", `"${foldB.jobFailedHead}"`);

/* the exoneration on the re-faced leg (fold) */
ok(
  "every LEAK button is an aria-named hit-slop carrier (no unnamed pseudo-less leak)",
  (foldB.leakButtons ?? []).length > 0 && (foldB.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (foldB.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

/* the GATE — the negative leg's fold contract on its NEW face */
if (GATE) {
  ok("G1 the panel never overflows at the fold (panelOverX FALSE — the t969 law on this face)", foldB.panelOverX === false, `sw=${foldB.panelSW} cw=${foldB.panelCW}`);
  ok("G2 the shell never scrolls at the fold", foldB.shellOverX === false);
  ok("G3 the negative card absorbs at the fold (over=0 — the card is honest)", (foldB.card?.over ?? 1) === 0, `over=${foldB.card?.over}`);
  ok("G4 the honest note absorbs at the fold (the one text that must read whole)", (foldB.card?.note?.over ?? 1) === 0, `over=${foldB.card?.note?.over}`);
  ok("G5 the jump button absorbs at the fold", (foldB.card?.jump?.over ?? 1) === 0, `over=${foldB.card?.jump?.over}`);
  ok("G8 the wide face stays clean", wideA.panelOverX === false && foldA.panelOverX === false, `flip sw=${foldA.panelSW}/${foldA.panelCW}`);
  ok("G9 the PNG receipts landed", true, "t976-walltime-flip-wide + t976-walltime-flip-320 + t976-cancelled-negative-320 (+ the strip's own)");

  /* the JUMP — the negative leg's contract: Read the full log lands the
   * Log tab in Full mode where the strip is ABSENT by design */
  const jumpClick = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NEG_NAME}')); const b = [...(d?.querySelectorAll('[data-ovd-negative] button') ?? [])][0]; return b ?? null; })()`);
  const jumpLanded = await poll(
    `(() => {
      const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NEG_NAME}'));
      if (!d) return JSON.stringify({ err: "no-dialog" });
      const tabs = [...(d.querySelectorAll('[role="tab"]') ?? [])];
      const logTab = tabs.find(t => (t.textContent || '').trim().startsWith('Log'));
      const fullBtn = [...(d.querySelectorAll('[role="group"][aria-label="Log window mode"] button') ?? [])].find(b => (b.textContent || '').trim() === 'Full');
      return JSON.stringify({
        logSelected: logTab?.getAttribute('aria-selected') === 'true',
        fullMode: fullBtn?.getAttribute('aria-pressed') === 'true',
        consoleThere: !!d.querySelector('[data-log-console]'),
        stripAbsent: !d.querySelector('[data-log-diagnosis]'),
      });
    })()`,
    (v) => v && !v.err && v.logSelected, 10, 600,
  );
  ok("G6 the jump lands the Log tab in FULL mode", !!jumpLanded && jumpLanded.fullMode === true, JSON.stringify(jumpLanded ?? {}));
  ok("G7 the strip is ABSENT on the cancelled face (the honest silence — the findings.length > 0 gate)", !!jumpLanded && jumpLanded.stripAbsent === true && jumpLanded.consoleThere === true, JSON.stringify(jumpLanded ?? {}));
}

/* back to the wide world for the CONTRAST leg: the t970 face's rose
 * teaser still speaks 2 chips — the three-state law's both legs on one
 * canvas (with the flip between them) */
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
try { sh(`${AB} press Escape`); } catch {}
await sleep(800);
const centeredC = await findAndCenter("Failed Diagnosis");
console.log(`  find-bar(contrast): ${centeredC}`);
if (String(await openInspectorHard(POS_NAME)).startsWith("open@try")) {
  await sleep(800);
  if (String(await clickTab(POS_NAME, "Overview", 4)).startsWith("clicked@")) {
    const posTeaser = await poll(
      `(() => {
        const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${POS_NAME}'));
        const ovd = d?.querySelector('[data-overview-diagnosis]');
        return JSON.stringify({ ovd: !!ovd, neg: !!(ovd && ovd.hasAttribute('data-ovd-negative')), chips: ovd ? ovd.querySelectorAll('[data-ovd-chip]').length : -1 });
      })()`,
      (v) => v && v.ovd, 16, 600,
    );
    ok("N10 the contrast leg: the t970 face still speaks the POSITIVE teaser (2 chips, not negative)", !!posTeaser && posTeaser.chips === 2 && posTeaser.neg === false, JSON.stringify(posTeaser ?? {}));
  } else {
    ok("N10 the contrast leg: the t970 face still speaks the POSITIVE teaser (2 chips, not negative)", false, "the Overview tab never clicked");
  }
} else {
  ok("N10 the contrast leg: the t970 face still speaks the POSITIVE teaser (2 chips, not negative)", false, "the t970 inspector never opened");
}

console.log(`== t976 walk ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(GATE ? (fail === 0 ? 0 : 1) : 0);
