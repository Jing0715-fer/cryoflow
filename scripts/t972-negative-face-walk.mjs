#!/usr/bin/env node
/**
 * t972 — the NEGATIVE DIAGNOSIS FACE's first measured ride (the t971
 * entry's candidate (a) cashed in): the Task 121 negative teaser —
 * data-ovd-negative, the calm zinc "no known signature matched" card —
 * walked at the 320 fold with the t969/t970 PANEL-tier grammar.
 *
 * The face: the t972 mint's seventh job ("Negative Diagnosis Face
 * (t972)") — a class3d whose run.out is the field's classic no-signature
 * death (a 24-hour walltime cancellation: SLURM's own words, bash's
 * "Terminated", no error anywhere). diagnoseFailureLog(full run.out) ===
 * [] by construction — the mint's 15-pattern mirror proves it at the API
 * tier; THIS walk is the ground truth: the negative teaser renders "0
 * findings", the Log console renders NO strip (the findings.length > 0
 * gate — the honest silence), and the three-state law's OTHER leg
 * (Task 120's rose teaser on the t970 face, 2 chips) is witnessed as the
 * contrast on the same canvas.
 *
 * The probes (the negative card's every shape, measured at its address):
 *   · data-ovd-negative present, the zinc border, the SearchX icon
 *   · the aria verdict "No known failure signature matched the full log"
 *   · the count span "0 findings" — ZERO chips (chipless by design)
 *   · the honest note (ovd-negative-note) — the one sentence that reads
 *     whole, wrapping at the fold like t971's hint law
 *   · the jump button "Read the full log" → lands the Log tab in Full
 *     mode where the strip is absent BY DESIGN (the log is the answer)
 *
 * BEFORE mode (default): walk + verdicts + PNG receipts; exits 0 even
 *   when a disease is present (a witness RECORDS, it does not gate).
 * GATE=1: the negative leg's fold contract.
 *
 *   node scripts/t972-negative-face-walk.mjs
 *   GATE=1 node scripts/t972-negative-face-walk.mjs
 */
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const AB = "agent-browser";
const BASE = process.env.MINT_BASE ?? "http://localhost:3000";
const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, "shots-qa");
const NAME = "Negative Diagnosis Face (t972)";
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

/* the find-bar opener — the t972 ride's own lesson: Reset view does NOT
 * fit the world, the bottom-right overlay can cover a card, and the
 * canvas is transform-positioned (scrollIntoView is a no-op). The find
 * bar's match button CENTERS the job — the honest user flow. Runs at
 * 1280 only (the toolbar's fold shape is a different contract). */
const findAndCenter = async (needle) => {
  /* idempotent: the bar may already be open (flow B after flow A) — a
   * blind toggle-click would CLOSE it and the fill would find nothing */
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

/* the negative teaser's presence probe — polls the ?full=1 fetch + the
 * client-side diagnosis (the failed face's own async leg) */
const teaserWait = `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const ovd = dlg.querySelector("[data-overview-diagnosis]");
  return JSON.stringify({ ovd: !!ovd, neg: !!(ovd && ovd.hasAttribute("data-ovd-negative")) });
})()`;

/* THE WALK — the t969/t970 grammar at the panel tier + the negative
 * card's named probes */
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
  /* the negative card's named probes — every shape measured at its address */
  const ovd = panel.querySelector("[data-overview-diagnosis]");
  if (ovd) {
    const box = (el) => el ? { sw: el.scrollWidth, cw: el.clientWidth, over: el.scrollWidth - el.clientWidth } : null;
    out.negCard = {
      neg: ovd.hasAttribute("data-ovd-negative"),
      aria: ovd.getAttribute("aria-label") ?? "",
      zinc: (ovd.className || "").includes("border-zinc-500/25"),
      iconSvg: !!ovd.querySelector("svg"),
      headLabel: ovd.querySelector(".ovd-head-label")?.textContent ?? "",
      count: ovd.querySelector(".ovd-count")?.textContent ?? "",
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

console.log(`== t972 the negative face's first measured ride ${GATE ? "(the GATE)" : "(the BEFORE witness)"} ==`);

/* fresh open + the eval-hang law */
sh(`${AB} open ${BASE}/`);
await sleep(2500);
sh(`${AB} set viewport 1280 800`);
await sleep(1200);

/* the find-bar flow centers the card (the ride's own lesson), then the
 * hard opener clicks it */
const centered = await findAndCenter("Negative Diagnosis");
console.log(`  find-bar: ${centered}`);
if (!String(await openInspectorHard(NAME)).startsWith("open@try")) {
  console.log("FATAL: the negative face's inspector never opened");
  process.exit(2);
}
await sleep(800);
if (!String(await clickTab(NAME, "Overview", 4)).startsWith("clicked@")) {
  console.log("FATAL: the Overview tab never clicked");
  process.exit(2);
}

/* wait for the teaser (the async diagnosis leg) — the NEGATIVE leg */
const t0 = await poll(teaserWait, (v) => v && !v.err && v.ovd, 20, 600);
if (!t0) { console.log("FATAL: the overview diagnosis never rendered"); process.exit(2); }
console.log(`  teaser: ovd=${t0.ovd} neg=${t0.neg}`);

/* the WIDE face first */
const wide = evalJson(walkExpr);
if (!wide || wide.err) { console.log(`FATAL: the wide walk never measured (${wide?.err ?? "null"})`); process.exit(2); }
console.log(`  wide: panelW=${wide.panelW} sw=${wide.panelSW} overX=${wide.panelOverX} unclipped=${wide.unclipped}`);
mkdirSync(QA_DIR, { recursive: true });
sh(`${AB} screenshot ${QA_DIR}/t972-negative-face-wide.png`);

/* the fold */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
const fold = await poll(walkExpr, (v) => v && !v.err, 12, 600);
if (!fold) { console.log("FATAL: the fold walk never measured"); process.exit(2); }
console.log(`  fold: panelW=${fold.panelW} sw=${fold.panelSW} cw=${fold.panelCW} overX=${fold.panelOverX} shell=${fold.shellOverX} unclipped=${fold.unclipped}`);
for (const o of fold.offenders.slice(0, 8)) {
  console.log(`      · ${o.selfClip ? "SELF-CLIP" : "LEAK    "} +${o.over}px ${o.tag}.${o.cls.slice(0, 56)} "${o.text.slice(0, 36)}"`);
}
if (fold.negCard) {
  console.log(`  negCard@fold: over=${fold.negCard.over} neg=${fold.negCard.neg} zinc=${fold.negCard.zinc} count="${fold.negCard.count}" chips=${fold.negCard.chipCount}`);
  if (fold.negCard.note) console.log(`  note: over=${fold.negCard.note.over} "${fold.negCard.note.text.slice(0, 70)}"`);
  if (fold.negCard.jump) console.log(`  jump: over=${fold.negCard.jump.over} "${fold.negCard.jump.text}"`);
}
sh(`${AB} screenshot ${QA_DIR}/t972-negative-face-320.png`);

/* the witness's own verdicts (both modes — the face must SPEAK) */
ok("the overview diagnosis rendered on the negative face", !!fold.negCard);
ok("the NEGATIVE leg is the leg that rendered (data-ovd-negative)", fold.negCard?.neg === true);
ok("the aria verdict says no signature matched the FULL log", fold.negCard?.aria === "No known failure signature matched the full log", `"${fold.negCard?.aria ?? ""}"`);
ok("the count span reads 0 findings", fold.negCard?.count === "0 findings", `"${fold.negCard?.count ?? ""}"`);
ok("the negative leg is CHIPLESS by design (zero ovd-chips)", fold.negCard?.chipCount === 0, `chips=${fold.negCard?.chipCount}`);
ok("the zinc styling is the negative leg's own (border-zinc-500/25)", fold.negCard?.zinc === true);
ok("the SearchX icon rides the negative card (svg present)", fold.negCard?.iconSvg === true);
ok("the honest note reads whole (the cause is custom, the log is the truth)", (fold.negCard?.note?.text ?? "").startsWith("No known failure signature matched the full log — the cause is custom"));
ok("the jump button speaks the negative leg's own words", fold.negCard?.jump?.text === "Read the full log", `"${fold.negCard?.jump?.text ?? ""}"`);
ok("the failed card's head says Job failed", fold.jobFailedHead === "Job failed", `"${fold.jobFailedHead}"`);

/* the exoneration's light form (both modes): every leaked button must be
 * aria-named with an absolute ::before — the Task 171 hit-slop family
 * (the t970/t971 law on this tier; the t972 ride's own +8px Copy button
 * is the family's newest member: aria="Copy", ::before 50x44 absolute,
 * the chain terminating at the panel scroll area's own clip) */
ok(
  "every LEAK button is an aria-named hit-slop carrier (no unnamed pseudo-less leak)",
  (fold.leakButtons ?? []).length > 0 && (fold.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (fold.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

/* the GATE — the negative leg's fold contract */
if (GATE) {
  ok("G1 the panel never overflows at the fold (panelOverX FALSE — the t969 law on this face)", fold.panelOverX === false, `sw=${fold.panelSW} cw=${fold.panelCW}`);
  ok("G2 the shell never scrolls at the fold", fold.shellOverX === false);
  ok("G3 the negative card absorbs at the fold (over=0 — the card is honest)", (fold.negCard?.over ?? 1) === 0, `over=${fold.negCard?.over}`);
  ok("G4 the honest note absorbs at the fold (the one text that must read whole)", (fold.negCard?.note?.over ?? 1) === 0, `over=${fold.negCard?.note?.over}`);
  ok("G5 the jump button absorbs at the fold", (fold.negCard?.jump?.over ?? 1) === 0, `over=${fold.negCard?.jump?.over}`);
  ok("G8 the wide face stays clean", wide.panelOverX === false, `sw=${wide.panelSW} cw=${wide.panelCW}`);
  ok("G9 the PNG receipts landed", true, "t972-negative-face-320.png + t972-negative-face-wide.png");

  /* the JUMP — the negative leg's contract: Read the full log lands the
   * Log tab in Full mode where the strip is ABSENT by design */
  const jumpClick = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}')); const b = [...(d?.querySelectorAll('[data-ovd-negative] button') ?? [])][0]; return b ?? null; })()`);
  const jumpLanded = await poll(
    `(() => {
      const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${NAME}'));
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
  ok("G7 the strip is ABSENT on the negative face (the honest silence — the findings.length > 0 gate)", !!jumpLanded && jumpLanded.stripAbsent === true && jumpLanded.consoleThere === true, JSON.stringify(jumpLanded ?? {}));
}

/* back to the wide world for the CONTRAST leg: the t970 face's rose
 * teaser still speaks 2 chips — the three-state law's both legs on one
 * canvas (the law's newest double witness) */
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
try { sh(`${AB} press Escape`); } catch {}
await sleep(800);
const centered2 = await findAndCenter("Failed Diagnosis");
console.log(`  find-bar(contrast): ${centered2}`);
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

console.log(`== t972 walk ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
