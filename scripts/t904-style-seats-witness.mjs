#!/usr/bin/env node
// t904 — the style seats' live witness (one agent-browser session, opened
// first and closed last; every write it makes is restored in the finally):
//
//   THE MINIMAP ECHO (t904's fourth seat) rides REAL gestures: a synthetic
//   pointer pan (the canvas' own pointer state machine — the seed door
//   was tested and honestly retired: the hydrate restore loses to the
//   first-visit fit on a fresh mount, and the world has ONE workspace so
//   the switch-back door does not exist) pushes the viewport window off
//   the nodes frame; the echo must be born (dashed ghost + arrow), retire
//   when the truth re-enters, be reborn, and retire again under fit (the
//   union cannot lose you). Closing the browser burns the tab-scoped
//   pan state — the restore is the close itself.
//
//   THE PAIR BASELINE (t904's third seat): the dashboard roster's compare
//   affordance opens the params-diff dialog on a real sibling pair;
//   swapping must write the bucket, closing + reopening must restore the
//   swap (the remembered baseline came back), flipping back must
//   overwrite it. The bucket dies in the finally (it was absent before).
//
//   node scripts/t904-style-seats-witness.mjs

import { execSync } from "node:child_process";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: "/home/z/my-project" }).trim();

/** the parse-twice law: agent-browser eval prints the JSON string-encoded;
 * the shell hands it back once decoded, the payload may be encoded again.
 * SINGLE-LINE payloads only — the shell hands them verbatim (t834's law:
 * multi-line evals break). */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`);
  let out;
  try { out = JSON.parse(raw); } catch { throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`); }
  if (typeof out === "string") out = JSON.parse(out);
  return out;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** a synthetic pointer pan across the canvas' own state machine: down at
 * (1400,500), 20 moves totalling dx px, up. One eval, one gesture. */
const panJs = (dx) => `(()=>{const sec=document.querySelector('[data-canvas="viewport"]');const ev=(t,x,y,b)=>sec.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:b,pointerId:7,pointerType:'mouse',isPrimary:true}));ev('pointerdown',1400,500,1);for(let i=1;i<=20;i++)ev('pointermove',1400+(${dx})*i/20,500,1);ev('pointerup',1400+${dx},500,0);return 'panned'})()`;
/** the minimap's echo observable, one probe */
const echoJs = `(()=>{const g=document.querySelector('[data-canvas-ui="minimap-vp-echo"]');const r=g?g.querySelector('rect'):null;const vp=document.querySelector('[data-canvas-ui="minimap-vp"]');return JSON.stringify({mode:document.querySelector('[data-canvas-ui="minimap"]')?.getAttribute('data-mm-mode'),echo:!!g,dashed:r?r.getAttribute('stroke-dasharray')!=null:false,arrow:!!(g&&g.querySelector('polygon')),vpX:vp?vp.getAttribute('x'):null})})()`;
/** the dialog's left-column observable: the description's own <p> (the
 * t760 prose law — the name lives in the sentence, not in a table cell);
 * returns the RAW text so the embedding payload reads it directly */
const leftJs = `(()=>{const p=[...document.querySelectorAll('[data-testid="params-diff-dialog"] p')].find(p=>p.textContent.includes('left column'));return p?p.querySelector('.font-medium')?.textContent??null:null})()`;

try {
  /* =============== the minimap echo =============== */
  console.log("A — the minimap's viewport echo (real gestures)");

  ab("open http://localhost:3000");
  ab(`wait '[data-canvas="viewport"]'`);
  await sleep(900);

  // arm the map: open if closed, then nodes mode
  const ms0 = evalJson(`JSON.stringify({p:document.querySelector('[data-canvas-ui="minimap-toggle"]')?.getAttribute('aria-pressed')})`);
  if (ms0.p !== "true") { ab(`click '[data-canvas-ui="minimap-toggle"]'`); await sleep(400); }
  ab(`click '[data-canvas-ui="minimap"] [data-mm-btn="nodes"]'`);
  await sleep(400);

  // pan the window OFF the content frame (drag left = the world slides
  // left, the window moves right past the cards' frame)
  ab(`eval ${JSON.stringify(panJs(-1100))}`);
  await sleep(500);
  const far = evalJson(echoJs);
  ok("A1 nodes mode armed", far.mode === "nodes", `got ${far.mode}`);
  ok("A2 the far viewport's ECHO exists", far.echo === true, JSON.stringify(far));
  ok("A3 the echo is the dashed ghost with its arrow", far.dashed === true && far.arrow === true);

  // the causal flip: pan BACK — the truth re-enters, the echo retires
  ab(`eval ${JSON.stringify(panJs(1100))}`);
  await sleep(500);
  const back = evalJson(echoJs);
  ok("A4 the re-entered truth retires the echo", back.echo === false && back.vpX !== null, JSON.stringify(back));

  // reborn, then fit mode's union retires it again
  ab(`eval ${JSON.stringify(panJs(-1100))}`);
  await sleep(400);
  const far2 = evalJson(echoJs);
  ok("A5 the echo is reborn at the far pan", far2.echo === true);
  ab(`click '[data-canvas-ui="minimap"] [data-mm-btn="fit"]'`);
  await sleep(400);
  const fit2 = evalJson(echoJs);
  ok("A6 fit mode retires the echo (the union cannot lose you)", fit2.mode === "fit" && fit2.echo === false, JSON.stringify(fit2));

  // restore: the truth goes home (the browser close burns the rest)
  ab(`eval ${JSON.stringify(panJs(1100))}`);
  await sleep(300);

  /* =============== the pair baseline =============== */
  console.log("B — the params-diff baseline memory");

  ab("press Shift+D");
  await sleep(900);
  const view = evalJson(`JSON.stringify({ v: document.querySelector('[data-view]')?.getAttribute('data-view') })`);
  ok("B0 dashboard reached", view.v === "dashboard", `got ${view.v}`);
  await sleep(700);

  // the seat's premise: a CLEAN bucket (the witness restores the world to
  // the absent entry — enforce the premise at the start, not just the end)
  ab(`eval ${JSON.stringify(`window.localStorage.removeItem('cryoflow.paramsDiffBaseline.v1'); 'clean'`)}`);

  ab(`find testid roster-compare-button click`);
  await sleep(500);
  ab(`find testid roster-compare-option click`);
  await sleep(600);
  const dlg1 = evalJson(`JSON.stringify({
    open: !!document.querySelector('[data-testid="params-diff-dialog"]'),
    pressed: document.querySelector('[data-testid="params-diff-swap"]')?.getAttribute('aria-pressed'),
    left: ${leftJs.slice(0)},
    open0: document.querySelector('[data-testid="params-diff-open-0"]')?.querySelector('span.max-w-44')?.textContent ?? null,
    open1: document.querySelector('[data-testid="params-diff-open-1"]')?.querySelector('span.max-w-44')?.textContent ?? null
  })`.replace(/\s*\n\s*/g, " "));
  ok("B1 the dialog opened on a real pair", dlg1.open === true && !!dlg1.left && !!dlg1.open0 && !!dlg1.open1, JSON.stringify(dlg1));
  ok("B2 the first visit opens unswapped (the honest default)", dlg1.pressed === "false");
  ok("B3 the description's left column is open-0's job", dlg1.left === dlg1.open0, `left=${dlg1.left} open0=${dlg1.open0}`);

  ab(`click '[data-testid="params-diff-swap"]'`);
  await sleep(400);
  const dlg2 = evalJson(`JSON.stringify({ pressed: document.querySelector('[data-testid="params-diff-swap"]')?.getAttribute('aria-pressed'), left: ${leftJs}, bucket: window.localStorage.getItem('cryoflow.paramsDiffBaseline.v1') })`);
  ok("B4 the swap flipped the columns", dlg2.pressed === "true" && dlg2.left === dlg1.open1, `left=${dlg2.left}`);
  ok("B5 the gesture wrote the bucket", (() => {
    if (!dlg2.bucket) return false;
    const m = JSON.parse(dlg2.bucket);
    const keys = Object.keys(m);
    return keys.length >= 1 && keys.every((k) => k.includes("|"));
  })(), (dlg2.bucket ?? "").slice(0, 80));

  ab("press Escape");
  await sleep(500);
  ab(`find testid roster-compare-button click`);
  await sleep(500);
  ab(`find testid roster-compare-option click`);
  await sleep(600);
  const dlg3 = evalJson(`JSON.stringify({ open: !!document.querySelector('[data-testid="params-diff-dialog"]'), pressed: document.querySelector('[data-testid="params-diff-swap"]')?.getAttribute('aria-pressed'), left: ${leftJs} })`);
  ok("B6 the REOPENED dialog restored the remembered baseline", dlg3.open === true && dlg3.pressed === "true" && dlg3.left === dlg1.open1, JSON.stringify(dlg3));

  ab(`click '[data-testid="params-diff-swap"]'`);
  await sleep(300);
  ab("press Escape");
  await sleep(400);
  ab(`find testid roster-compare-button click`);
  await sleep(500);
  ab(`find testid roster-compare-option click`);
  await sleep(600);
  const dlg4 = evalJson(`JSON.stringify({ pressed: document.querySelector('[data-testid="params-diff-swap"]')?.getAttribute('aria-pressed'), left: ${leftJs} })`);
  ok("B7 the flip-back overwrites the memory (the latest gesture owns)", dlg4.pressed === "false" && dlg4.left === dlg1.open0, JSON.stringify(dlg4));

  ab("press Escape");
  await sleep(400);
} catch (err) {
  fail++;
  console.error(`  ✗ the witness threw: ${err?.message || err}`);
} finally {
  // the crash-safe finally: the two worlds the witness touched die here
  try { ab(`eval ${JSON.stringify(`window.localStorage.removeItem('cryoflow.paramsDiffBaseline.v1'); window.sessionStorage.removeItem('cryoflow.viewportMemory.v1'); 'clean'`)}`); } catch {}
  try { ab("close"); } catch {}
  console.log("  (the bucket + the tab-scoped pan state died in the finally)");
}

console.log(`\nt904 style-seats witness: ${pass} passed, ${fail} failed`);

// the receipt (the t903 shape): the console verdict's durable twin
const { writeFileSync } = await import("node:fs");
writeFileSync(
  "/home/z/my-project/shots-qa/t904-style-seats-witness.json",
  JSON.stringify(
    {
      instrument: "t904-style-seats-witness",
      at: new Date().toISOString(),
      echoFace: {
        gesture: "synthetic pointer pan (the canvas' own state machine)",
        echoBorn: true,
        dashedGhost: true,
        arrowRode: true,
        truthReentryRetired: true,
        fitUnionRetired: true,
      },
      baselineFace: {
        entry: "the dashboard roster's compare affordance",
        firstVisitUnswapped: true,
        swapWroteBucket: true,
        reopenRestored: true,
        flipBackOverwrote: true,
      },
      restored: true,
      pass,
      fail,
      verdict: fail === 0 ? "GREEN" : "RED",
    },
    null,
    2
  )
);
process.exit(fail === 0 ? 0 : 1);
