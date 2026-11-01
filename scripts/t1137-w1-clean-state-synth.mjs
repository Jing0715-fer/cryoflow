#!/usr/bin/env node
/**
 * t1137 — the W1 CLEAN-STATE SYNTH PROBE (the fork's re-queued question,
 * midwifed into the mainline by the t1135 tombstone).
 *
 * THE QUESTION: the fork's t877-t879 measured the FSC compare dialog's
 * Escape close in CHURN state and read synth=0 — "React's synthetic
 * delegation never called the content's own onKeyDown; the close landed
 * ~2-2.5s late through the Radix document-level path". But the tombstone's
 * own meter law whispers the doubt: counters persist = the world moved —
 * in churn the props object is REPLACED on every render, so the wrap may
 * have died and the 0 was the instrument reading a dead generation. The
 * clean-state probe (no churn) is the controlled experiment the fork
 * never ran: wrap the content's own handler on a SETTLED dialog, plant
 * NATIVE document-level probes (re-render-proof), press a REAL Escape,
 * and let the counters + timestamps name the closer.
 *
 * THE DESIGN (every leg self-vindicating):
 *   W     the world (server-first, wide, fresh session, hydration gate)
 *   NAV   the real-click walk: FSC chip → the compare door → the dialog
 *   SETTLE the curves land (the post-open re-render exhausts) and the
 *         wrap survives a 600ms double-identity check (the churn guard)
 *   PROBE the wrap (window.__w1.synth + synthTs) + the native document
 *         probes (docCapture/docBubble + timestamps — capture sees every
 *         key top-down; bubble only survives if NOTHING stopped it)
 *   PRESS the REAL Escape (the trusted-Escape law: radix only trusts
 *         real keys — never an eval-dispatched KeyboardEvent)
 *   TRACE the immediate read + the one-eval 12×250ms late sampler
 *
 * THE VERDICT SHAPE (the chronology names the closer):
 *   capture=1, synth≥1, bubble=0  → the content's own consumer fired and
 *                                   its stopPropagation ate the event
 *                                   before Radix's document layer — the
 *                                   dialog comment's mechanism TRUE in a
 *                                   clean world; the fork's churn synth=0
 *                                   was the dead-generation reading.
 *   capture=1, synth=0, bubble=1  → the consumer is DEAD CODE in a clean
 *                                   world too — Radix's document path is
 *                                   the only closer; the comment describes
 *                                   an architecture that never runs.
 *   capture=0                     → the real key never reached the page
 *                                   (the world or the instrument is dead
 *                                   — FATAL, the meter law's own branch).
 */
import { createWalk } from "./walk-kit.mjs";
import path from "node:path";

const ROOT = process.cwd();
const walk = createWalk({ name: "t1137-w1-clean-state-synth", receiptFile: "t1137-w1-clean-state-synth.json" });
const { ok, sleep, sh, evalJs, evalJson } = walk;

/* single-line stringify evals (the t1136 lesson: the CLI pretty-prints
 * objects and the quote-locator breaks on multiline strings) */

const W1_INIT = `(() => { window.__w1 = { synth: 0, synthTs: 0, docCapture: 0, docCaptureTs: 0, docBubble: 0, docBubbleTs: 0, pressTs: 0 }; return JSON.stringify({ ready: true }); })()`;

const DOC_PROBES = `(() => { if (window.__w1docPlanted) return JSON.stringify({ planted: false, already: true }); window.__w1docPlanted = true; document.addEventListener("keydown", (e) => { if (e && e.key === "Escape") { window.__w1.docCapture++; window.__w1.docCaptureTs = performance.now(); } }, true); document.addEventListener("keydown", (e) => { if (e && e.key === "Escape") { window.__w1.docBubble++; window.__w1.docBubbleTs = performance.now(); } }, false); return JSON.stringify({ planted: true }); })()`;

const WRAP = `(() => { const dlg = document.querySelector("[data-fsc-compare-dialog]"); if (!dlg) return JSON.stringify({ err: "no-dialog" }); const pk = Object.keys(dlg).find((k) => k.startsWith("__reactProps")); if (!pk) return JSON.stringify({ err: "no-props" }); const cur = dlg[pk]; if (typeof cur.onKeyDown !== "function") return JSON.stringify({ err: "no-handler", propKeys: Object.keys(cur).length }); if (cur.__w1wrapped) return JSON.stringify({ ok: true, already: true }); const orig = cur.onKeyDown; cur.onKeyDown = function (e) { if (e && e.key === "Escape") { window.__w1.synth++; window.__w1.synthTs = performance.now(); } return orig.call(this, e); }; cur.__w1wrapped = true; window.__w1origRef = orig; return JSON.stringify({ ok: true, wrapped: true, propsKeyLen: pk.length }); })()`;

const VINDICATE = `(() => { const dlg = document.querySelector("[data-fsc-compare-dialog]"); if (!dlg) return JSON.stringify({ open: false }); const pk = Object.keys(dlg).find((k) => k.startsWith("__reactProps")); const cur = dlg[pk]; return JSON.stringify({ open: true, wrapped: !!(cur && cur.__w1wrapped === true), handlerIsFn: !!(cur && typeof cur.onKeyDown === "function"), state: dlg.getAttribute("data-state") }); })()`;

const READ = `(() => JSON.stringify({ w1: window.__w1 || null, dlgOpen: !!document.querySelector("[data-fsc-compare-dialog]"), inspectorOpen: [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.getBoundingClientRect().width > 0).length }))()`;

const LATE_TRACE = `(() => { return (async () => { for (let i = 1; i <= 12; i++) { await new Promise((r) => setTimeout(r, 250)); if (!document.querySelector("[data-fsc-compare-dialog]")) return JSON.stringify({ landed: true, atMs: i * 250 }); } return JSON.stringify({ landed: false, stillOpen: !!document.querySelector("[data-fsc-compare-dialog]") }); })(); })()`;

/* the t1136 NAV shape: eval finds the door, the ride sends REAL mouse
 * move/down/up at its center — the role-click's Done lie never trusted */
const clickPoint = async (findExpr) => {
  const pt = evalJson(`(() => { const el = (${findExpr}); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); if (r.width === 0) return null; return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (!pt) return null;
  sh(`${walk.AB} mouse move ${pt.x} ${pt.y}`);
  sh(`${walk.AB} mouse down`);
  sh(`${walk.AB} mouse up`);
  return pt;
};

const gate = async (expr, label, tries = 30, ms = 700) => {
  const v = await walk.poll(expr, (x) => x === true, tries, ms);
  return ok(`NAV ${label}`, !!v);
};

(async () => {
  /* ---------- W — the world ---------- */
  await walk.serverFirst();
  await walk.wideFirst();
  const buildKey = evalJs(`(document.documentElement.innerHTML.match(/build ([0-9a-f]{6,12})/) || [])[1] || "unknown"`);
  console.log(`  — world build key: ${buildKey}`);

  /* the hydration gate (the t1133 law's ride-shape): the footer's live
   * numbers are the world-read receipt */
  await gate(
    `document.body.innerText.includes('14 edges')`,
    "the world's first READ lands (the footer speaks the live numbers)",
    40, 900,
  );

  /* ---------- NAV — the real-click walk ---------- */
  /* the handler gate (the t1132/t1133 law): the FSC chip's onClick is
   * CONDITIONAL on resSource — poll the React props until the hand
   * exists behind the name */
  await gate(
    `(() => { const c = document.querySelector('button[aria-label^="Final FSC"]'); if (!c) return false; const pk = Object.keys(c).find((k) => k.startsWith("__reactProps")); return !!(pk && c[pk] && typeof c[pk].onClick === "function"); })()`,
    "the FSC chip's own handler is attached (resSource resolved)",
    40, 900,
  );

  const chip = await clickPoint(`document.querySelector('button[aria-label^="Final FSC"]')`);
  ok("NAV the FSC chip real-clicked at its center", !!chip, chip ? `@${chip.x},${chip.y}` : "NO-ELEMENT");
  await gate(
    `(() => { const b = document.querySelector('button[aria-label="Enlarge Sharpened map"]'); return !!b && b.getBoundingClientRect().width > 0; })()`,
    "the FSC chip opens the results (the Enlarge door is visible)",
  );

  /* the compare door: data-testid="fsc-compare-open" — projectId must be
   * bound for the button to exist; the handler gate first */
  await gate(
    `(() => { const b = document.querySelector('button[data-testid="fsc-compare-open"]'); if (!b) return false; const pk = Object.keys(b).find((k) => k.startsWith("__reactProps")); return !!(pk && b[pk] && typeof b[pk].onClick === "function"); })()`,
    "the compare door exists with its hand attached (projectId bound)",
    30, 900,
  );
  const cmp = await clickPoint(`document.querySelector('button[data-testid="fsc-compare-open"]')`);
  ok("NAV the compare door real-clicked", !!cmp, cmp ? `@${cmp.x},${cmp.y}` : "NO-ELEMENT");
  await gate(
    `(() => { const d = document.querySelector("[data-fsc-compare-dialog]"); return !!d && d.getAttribute("data-state") === "open" && d.getBoundingClientRect().width > 0; })()`,
    "the compare dialog is OPEN (data-state=open, visible)",
    30, 900,
  );
  await walk.shot("t1137-w1-dialog-open.png");

  /* ---------- SETTLE — the curves land, the churn exhausts ---------- */
  /* the open commit's curve effect fetches; "Reading curves…" is the
   * loading face — wait for it to be GONE (or never appear), then prove
   * the wrap survives a 600ms double-identity check (the churn guard:
   * a replaced props object loses the __w1wrapped mark) */
  await walk.poll(
    `(() => { const d = document.querySelector("[data-fsc-compare-dialog]"); if (!d) return JSON.stringify({ settled: false }); return JSON.stringify({ settled: !d.textContent.includes("Reading curves") }); })()`,
    (x) => x.settled === true, 20, 700,
  );
  await sleep(1200);

  ok("PROBE W1 counters initialized", evalJson(W1_INIT)?.ready === true, "window.__w1 minted");
  const planted = evalJson(DOC_PROBES);
  ok("PROBE native document probes planted (capture + bubble, re-render-proof)", planted?.planted === true, planted?.already ? "(already planted)" : "");

  let wrap = evalJson(WRAP);
  ok("PROBE the content's own onKeyDown wrapped", wrap?.ok === true, wrap?.err ? `err=${wrap.err}` : "the hand exists behind the name");
  if (wrap?.err) {
    /* the honest FATAL: without the wrap the question cannot be asked */
    console.log(`FATAL: the wrap could not land (${wrap.err}) — the served build's dialog carries no content onKeyDown to wrap`);
    walk.finish({ buildKey, wrapErr: wrap.err, note: "the served build's dialog has no content onKeyDown — the question dissolves at the source" });
    return;
  }
  const v1 = evalJson(VINDICATE);
  ok("SETTLE identity check #1 (the wrap survives on the SAME props object)", v1?.open === true && v1?.wrapped === true, `state=${v1?.state}`);
  await sleep(600);
  const v2 = evalJson(VINDICATE);
  ok("SETTLE identity check #2 after 600ms (the churn has exhausted — no re-render replaced the props)", v2?.open === true && v2?.wrapped === true, `state=${v2?.state}`);
  if (!(v2?.wrapped)) {
    /* re-wrap once and re-vindicate — the world re-rendered between the
     * checks; the clean-state claim needs a SETTLED dialog */
    wrap = evalJson(WRAP);
    await sleep(600);
    const v3 = evalJson(VINDICATE);
    ok("SETTLE re-wrapped and re-vindicated after the churn", v3?.wrapped === true);
  }

  /* ---------- PRESS — the real Escape (the trusted-Escape law) ---------- */
  evalJs(`(() => { window.__w1.pressTs = performance.now(); return JSON.stringify({ pressTs: window.__w1.pressTs }); })()`);
  sh(`${walk.AB} press Escape`);

  const imm = evalJson(READ);
  const w1 = imm?.w1 ?? {};
  ok("PRESS the page heard the key (document CAPTURE saw the real Escape)", (w1.docCapture ?? 0) >= 1, `docCapture=${w1.docCapture ?? 0}`);
  const chron = [];
  if (w1.docCaptureTs) chron.push(`capture@${Math.round(w1.docCaptureTs - (w1.pressTs || 0))}ms`);
  if (w1.synthTs) chron.push(`synth@${Math.round(w1.synthTs - (w1.pressTs || 0))}ms`);
  if (w1.docBubbleTs) chron.push(`bubble@${Math.round(w1.docBubbleTs - (w1.pressTs || 0))}ms`);
  console.log(`  — chronology (relative to the press stamp): ${chron.join(" → ") || "NO EVENTS"}`);
  console.log(`  — immediate read: synth=${w1.synth} capture=${w1.docCapture} bubble=${w1.docBubble} dlgOpen=${imm?.dlgOpen} dialogsVisible=${imm?.inspectorOpen}`);

  /* ---------- TRACE — the late sampler (one eval, 12 × 250ms) ---------- */
  const late = evalJson(LATE_TRACE);
  ok("TRACE the close landed", late?.landed === true, late?.landed ? `atMs=${late.atMs}` : `stillOpen=${late?.stillOpen}`);

  /* THE GONE-BRANCH COUNTER LAW (the t879 meter law, done right): the
   * immediate read may have RUN BEFORE the React dispatch — the close's
   * own work queues the dispatch behind the main thread (act 1's first
   * ride read synth=0 at ~300ms; the close landed at ~550ms). Re-read
   * the counters AFTER the close: the gone branch must carry counters. */
  const post = evalJson(READ);
  const pw = post?.w1 ?? {};
  console.log(`  — post-close counters: synth=${pw.synth} capture=${pw.docCapture} bubble=${pw.docBubble} dlgOpen=${post?.dlgOpen}`);
  ok("TRACE the gone-branch counters re-read AFTER the close (the dispatch had its chance)", post?.dlgOpen === false, `synth=${pw.synth} (immediate read said ${w1.synth})`);

  /* ---------- VERDICT — the chronology names the closer ---------- */
  const synth = Math.max(w1.synth ?? 0, pw.synth ?? 0), cap = Math.max(w1.docCapture ?? 0, pw.docCapture ?? 0), bub = Math.max(w1.docBubble ?? 0, pw.docBubble ?? 0);
  let closer;
  if (cap === 0) {
    closer = "FATAL-THE-KEY-NEVER-REACHED-THE-PAGE (the world or the instrument is dead — every counter reads a lie)";
  } else if (synth >= 1 && bub === 0) {
    closer = "THE CONTENT'S OWN CONSUMER RAN — AND RADIX'S CAPTURE CLOSE STILL WON (the consumer's stopPropagation ate the event before the document bubble — its real job is guarding the world BEYOND body: the app's window-level keymap never sees the modal's Escape; but Radix's useEscapeKeydown listens at document CAPTURE and dismisses BEFORE the event ever descends — the node_modules witness + the act-2 path census agree: the comment's claimed order is backwards, the consumer's close is the idempotent second writer)";
  } else if (synth === 0 && bub >= 1) {
    closer = "THE RADIX DOCUMENT PATH ONLY (the content's own onKeyDown is DEAD CODE in a clean state too — the comment describes an architecture that never runs; the fork's verdict stands, now proven in the controlled experiment)";
  } else if (synth >= 1 && bub >= 1) {
    closer = "BOTH PATHS SAW THE KEY (the consumer fired but the event still reached document — the stopPropagation did not hold; the close is a two-writer race resolved idempotently)";
  } else {
    closer = "NAMED BY THE ACT-2 STOPPER CENSUS (capture=1, the WRAP counter reads 0 in both reads, bubble=0, the close still lands — the wrap-on-__reactProps counter is the instrument's blind leg, the Event.prototype patch is the live witness: scripts/t1137-w1-stopper-census.mjs caught the content's own onKeyDown RUNNING with stopPropagation from the app chunk, Radix's document-capture useEscapeKeydown dismissed BEFORE descent, and the document-bubble + window-bubble seats empty — the consumer is ALIVE, Radix closes first, the consumer guards the world beyond body)";
  }
  console.log(`  — VERDICT: ${closer}`);
  console.log(`  — (synth counted across BOTH reads: immediate=${w1.synth} post-close=${pw.synth} — the t879 gone-branch law: an instrument that reads only once reads its own impatience)`);
  const lateMs = late?.landed ? late.atMs : null;
  ok("VERDICT the close is IMMEDIATE in a clean world (≤500ms)", lateMs !== null && lateMs <= 500, lateMs === null ? "never landed" : `atMs=${lateMs}`);

  await walk.shot("t1137-w1-after-close.png");
  const after = evalJson(READ);
  console.log(`  — after-close world: dialogsVisible=${after?.inspectorOpen} (the layer below must SURVIVE a single clean Escape — the peel-two danger is a churn-window shape)`);

  walk.finish({
    buildKey,
    counters: w1,
    postCloseCounters: pw,
    chronology: chron,
    lateTrace: late,
    closer,
    dialogsVisibleAfter: after?.inspectorOpen ?? null,
    question: "the fork's re-queued W1 clean-state synth probe — is the content's own Escape consumer dead code in a clean world too?",
  });
})().catch((e) => { console.error("FATAL:", e); process.exit(2); });
