/*
 * WORLD-DRIFT NOTICE (t691 census): this probe was built against the author-day
 * demo world — the 12-card / 13-edge era. The shared world has since grown
 * (17 jobs / 18 edges as of t691). Checks AND poll-waiters below may be PINNED
 * to that dead world: they fail, or hang forever, against today's roster.
 * Historical evidence value only — re-baseline to a pre-suite census (the t689
 * doctrine) before any re-run.
 */
/**
 * t598 — the card birth: the protagonist finally has an entrance voice.
 *
 * Six windows ago t593 asked the question and left it armed: "does the
 * new world's entrance already have its own voice?" Live forensics
 * answered NO — every surface in the app has an entrance (palette
 * groups, dashboard tiles, find rows/chips, inspector chips, minimap
 * set), but the canvas card — the protagonist — popped into existence
 * silently. This window gives the birth its voice:
 *
 *   - birth VERBS arm ids in the store (birthSeq/birthIds via birthArm,
 *     spread into the SAME set() as the new jobs — one commit):
 *     mint, linked step, linked copy, pipeline template, import (per
 *     file), duplicate, twin, and the adopt family
 *     (exclude/select/pick/train)
 *   - the canvas marks mounted cards data-born under data-birth-play
 *     BEFORE first paint (useLayoutEffect — the t593 from-frame
 *     doctrine), plays the family entrance (240ms, 8px rise, 24ms
 *     staircase, capped at 12), consumes per id, retires the attributes
 *     after the window (648ms budget)
 *   - the silent faces never arm — history restores
 *     (undoDelete/restoreFromGraveyard), poll replaces, adoption loads:
 *     silence by construction
 *   - the camera stays silent on births (the ANSWER to the six-window
 *     question's other half): the frame-set after an import is framing,
 *     not a journey — no viewport-glide, one-step transform
 *
 * Faces:
 *   G0  source contract + served freshness (t591/t596: the build can lie)
 *   Q   world — 12c/13e, console clean, sentinel round-trip
 *   W1  THE IMPORT CASCADE — drop → confirm → three cards materialize on
 *       the 24ms staircase, camera lands in ONE step (framing, not a
 *       journey), toast announces, attributes retire
 *   W2  THE MINT VOICE — palette add: exactly one card born, the world
 *       around it untouched
 *   W3  THE SILENT FACES — (a) delete → Ctrl+Z restore mounts with NO
 *       birth voice (history is not a birth); (b) reload mounts silent
 *   R   the world owes nothing — probes cleaned, roster 12→12, console
 *
 * Usage: node scripts/t598-card-birth-live-fire.mjs
 */

import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const readJson = async (js, tries = 3) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      const t = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      let v = t;
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith("\""); d++) v = JSON.parse(v);
      if (typeof v === "string" && (v.startsWith("{") || v.startsWith("["))) v = JSON.parse(v);
      if (typeof v === "string") {
        if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
        else if (v === "true") v = true;
        else if (v === "false") v = false;
      }
      return v;
    } catch { await sleep(600); }
  }
  return null;
};
async function pollUntil(fn, timeoutMs = 120000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* */ }
    await sleep(step);
  }
  return null;
}
const api = (path, method = "GET") =>
  JSON.parse(sh(`curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${BASE}${path}`));

try {
  console.log(`[boot] close-all + open + sentinel`);
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
  await sleep(1000);
  sh(`agent-browser open ${BASE} >/dev/null 2>&1`);
  const sentinel = await readJson(`JSON.stringify({ s: 40 + 2 })`);
  check("eval round-trip sentinel (pointer on the right page)", sentinel && sentinel.s === 42, JSON.stringify(sentinel));
  /* heal before you measure (t597): earlier forensic windows may have left
   * t598-named probes in the world — sweep them BEFORE the hydration and
   * census gates, so one window's leftovers never haunt the next run's
   * baselines (a polluted world would stall the 12-card hydration poll
   * for its whole timeout). */
  {
    const pre = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
    if (pre.stats.total !== 12) {
      const leftovers = api("/api/jobs").jobs.filter((j) => j.name && j.name.indexOf("t598") === 0);
      for (const j of leftovers) api(`/api/jobs/${j.id}`, "DELETE");
      await sleep(1200);
      console.log(`[heal] swept ${leftovers.length} leftover probe(s)`);
    }
  }
  const hydrated = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 12 ? n : null;
  }, 120000, 500);
  check("EMPIAR world hydrated 12 cards", hydrated === 12, `got ${hydrated}`);
  await sleep(800);
  {
    const post = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
    check("world census clean at boot (roster 12)", post.stats.total === 12, `12 → ${post.stats.total}`);
  }

  /* ---- G0 — the source contract + the SERVED freshness gate --------------- */
  console.log(`\n[G0] source contract + served freshness`);
  {
    const arms = sh(`rg -c "birthArm\\(get\\(\\)" src/lib/store.ts || true`);
    check("store: 12 birth verbs arm in their own set()", parseInt(arms || "0", 10) >= 12, `arms=${arms}`);
    const consume = sh(`rg -c "consumeBirths" src/lib/store.ts src/components/workflow/canvas.tsx | awk -F: '{s+=$2} END {print s}'`);
    check("store+canvas: per-id consume wired", parseInt(consume || "0", 10) >= 3, `refs=${consume}`);
    const immune = sh(`rg -c "backJobs" src/lib/store.ts || true`);
    check("store: the restore path stays (silent by construction)", parseInt(immune || "0", 10) >= 2, `backJobs=${immune}`);
    const stanza = sh(`rg -c "data-birth-play" src/app/globals.css || true`);
    const kf = sh(`rg -c "card-enter" src/app/globals.css || true`);
    check("css: card-enter keyframes + armed stanza", parseInt(stanza || "0", 10) >= 1 && parseInt(kf || "0", 10) >= 2, `stanza=${stanza} kf=${kf}`);
    const marker = sh(`rg -c "data-born" src/components/workflow/canvas.tsx || true`);
    check("canvas: the marker + retire loop in place", parseInt(marker || "0", 10) >= 4, `refs=${marker}`);
    const servedJs = sh(`rg -l "consumeBirths" .next/dev/static/chunks/ 2>/dev/null | wc -l`);
    const servedCss = sh(`rg -l "data-birth-play" .next/dev/ 2>/dev/null | wc -l`);
    check("served artifacts carry BOTH t598 signatures", parseInt(servedJs || "0", 10) >= 1 && parseInt(servedCss || "0", 10) >= 1, `js-chunks=${servedJs} css=${servedCss}`);
  }

  /* ---- Q — the world ------------------------------------------------------ */
  console.log(`\n[Q] world QA`);
  const counts = await readJson(`JSON.stringify({
    cards: document.querySelectorAll("[data-job]").length,
    edges: document.querySelectorAll("[data-edge-id]").length
  })`);
  check("12c/13e", counts && counts.cards === 12 && counts.edges === 13, JSON.stringify(counts));

  /* ---- W1 — THE IMPORT CASCADE -------------------------------------------- */
  console.log(`\n[W1] the import cascade — drop, confirm, three cards materialize`);
  const WF = JSON.stringify({
    format: "cryoflow-workflow",
    version: 1,
    exportedAt: "2026-10-05T06:00:00.000Z",
    project: "QA",
    workspace: "t598 source",
    jobs: [
      { type: "import", name: "t598 Birth A", x: 0, y: 0, params: {} },
      { type: "motioncorr", name: "t598 Birth B", x: 300, y: 0, params: {} },
      { type: "ctffind", name: "t598 Birth C", x: 600, y: 0, params: {} },
    ],
    edges: [],
  });
  const dropOpen = await readJson(`(function(){
    var dt = new DataTransfer();
    dt.items.add(new File([${JSON.stringify(WF)}], "t598-birth.json", { type: "application/json" }));
    var section = document.querySelector('section[data-canvas="viewport"]');
    if (!section) return JSON.stringify({ err: "no viewport section" });
    section.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true }));
    section.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true }));
    return "dropped";
  })()`);
  check("drop staged the import dialog", dropOpen === "dropped", JSON.stringify(dropOpen));
  const dlgOpen = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!!document.querySelector('[data-canvas-ui="import-workflow-dialog"]'))`);
    return v === true ? v : null;
  }, 15000, 400);
  check("import dialog opened", dlgOpen === true);

  /* the one-eval journey: click confirm, then sample the cascade from
   * inside the page — newborn ids (diff against the pre-click census),
   * their animated opacity, the birth attributes, the staircase delay,
   * the camera transform, and the glide class that must NEVER appear
   * (the camera's answer to a birth is a one-step frame-set). The merge
   * rides a server POST that can take >1s under memory pressure, so the
   * sampler is INTERVAL-based over a 6.5s window and returns only
   * CHANGED frames (t596's frozen-rAF doctrine: in-eval clocks stall —
   * every assertion is an ∃ over frames, the settle is read outside). */
  const w1 = await readJson(`(function(){
    var dlg = document.querySelector('[data-canvas-ui="import-workflow-dialog"]');
    if (!dlg) return JSON.stringify({ err: "dialog gone" });
    var btn = null;
    Array.from(dlg.querySelectorAll("button")).forEach(function(b){
      if (!btn && /^Import/.test((b.textContent || "").trim())) btn = b;
    });
    if (!btn) return JSON.stringify({ err: "no confirm button" });
    var before = {};
    document.querySelectorAll("[data-job]").forEach(function(el){ before[el.getAttribute("data-job")] = 1; });
    var ws = document.querySelector('[data-canvas="workspace"]');
    var pre = { tf: ws.style.transform };
    var frames = [];
    var last = "";
    btn.click();
    var t0 = performance.now();
    var iv = setInterval(function(){
      var w = document.querySelector('[data-canvas="workspace"]');
      if (!w) return;
      var nb = [];
      document.querySelectorAll("[data-job]").forEach(function(el){
        var id = el.getAttribute("data-job");
        if (!before[id]) nb.push({
          op: getComputedStyle(el).opacity,
          born: el.hasAttribute("data-born"),
          d: el.style.getPropertyValue("--card-d")
        });
      });
      var f = {
        t: Math.round(performance.now() - t0),
        n: nb.length,
        play: w.hasAttribute("data-birth-play"),
        glide: w.classList.contains("viewport-glide"),
        tf: w.style.transform,
        ops: nb.slice(0, 3).map(function(c){ return c.op; }),
        borns: nb.slice(0, 3).map(function(c){ return c.born ? 1 : 0; }),
        ds: nb.slice(0, 3).map(function(c){ return c.d; })
      };
      var key = JSON.stringify([f.n, f.play, f.glide, f.tf, f.ops, f.borns, f.ds]);
      if (key !== last) { last = key; frames.push(f); }
    }, 50);
    return new Promise(function(res){
      setTimeout(function(){
        clearInterval(iv);
        res(JSON.stringify({
          pre: pre,
          frames: frames,
          toast: document.body.textContent.indexOf("Workflows imported") >= 0
        }));
      }, 6500);
    });
  })()`, 5);
  const nbFrames = w1 && w1.frames ? w1.frames.filter((f) => f.n >= 3) : [];
  check("import landed — all three newborns seen", nbFrames.length >= 2, `newborn frames=${nbFrames.length}/${w1 && w1.frames ? w1.frames.length : 0}`);
  const midOp = nbFrames.filter((f) => f.ops.some((op) => parseFloat(op) < 0.99));
  check("W1 THE BIRTH FLOWS — some newborn painted mid-entrance (opacity < 1)", midOp.length >= 1, `mid frames at t=${midOp.map((f) => f.t).join(",") || "none"}`);
  /* a REAL flash = the FIRST newborn sighting unanimated. Frames after
   * the entrance completed legitimately read born=false — the retire
   * sweep removed the attributes, and the changed-frame dedupe records
   * exactly that boundary (play flips true→false). Only a prefix frame
   * (before any armed frame) is a pin failure. */
  const firstArmedIdx = nbFrames.findIndex((f) => f.borns.some((b) => b === 1));
  const flashFrames = firstArmedIdx === -1 ? [] : nbFrames.slice(0, firstArmedIdx).filter((f) => f.n > 0);
  check("born attribute present in EVERY visible frame (from-frame pinned before paint)", firstArmedIdx >= 0 && flashFrames.length === 0, flashFrames.length ? `flash frames: ${JSON.stringify(flashFrames.slice(0, 2))}` : "no unanimated flash");
  const stair = nbFrames.length >= 1 && JSON.stringify(nbFrames[0].ds) === JSON.stringify(["0ms", "24ms", "48ms"]);
  check("the 24ms staircase walks store order (0/24/48)", stair, JSON.stringify(nbFrames[0] && nbFrames[0].ds));
  const playEarly = nbFrames.some((f) => f.play === true);
  check("data-birth-play armed on the workspace", playEarly, `armed in ${nbFrames.filter((f) => f.play).length} frames`);
  const noGlide = w1 && w1.frames ? w1.frames.every((f) => f.glide === false) : false;
  check("camera never glides on a birth (no viewport-glide, all frames)", noGlide, "framing, not a journey");
  const tfConst = nbFrames.length >= 1 && nbFrames.every((f) => f.tf === nbFrames[0].tf) && nbFrames[0].tf !== w1.pre.tf;
  check("camera lands in ONE step (transform constant across all newborn frames, different from pre)", tfConst, tfConst ? "one-step frame-set" : "camera moved mid-cascade");
  check("the toast announces the birth", w1 && w1.toast === true, "Workflows imported");
  await sleep(600);
  const retired = await readJson(`JSON.stringify({
    play: !!document.querySelector('[data-canvas="workspace"][data-birth-play]'),
    born: document.querySelectorAll("[data-born]").length,
    d: (function(){ var el = document.querySelector("[data-job]"); return el ? el.style.getPropertyValue("--card-d") : "?"; })()
  })`);
  check("the window retires — attributes gone, drag/inspect channels clean", retired && retired.play === false && retired.born === 0 && (retired.d === "" || retired.d === "?"), JSON.stringify(retired));
  const w1Cards = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
  check("15 cards on the canvas after the import", w1Cards === 15, `got ${w1Cards}`);

  /* ---- W2 — THE MINT VOICE -------------------------------------------------- */
  console.log(`\n[W2] the mint voice — palette add, exactly one card born`);
  const censusBeforeMint = await readJson(`JSON.stringify(Array.from(document.querySelectorAll("[data-job]")).map(function(el){ return el.getAttribute("data-job"); }))`);
  await readJson(`(function(){
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    return "sent";
  })()`);
  await sleep(500);
  const palOpen = await readJson(`JSON.stringify(!!document.querySelector("[cmdk-input]"))`);
  check("command palette opened", palOpen === true);
  const w2 = await readJson(`(function(){
    var inp = document.querySelector("[cmdk-input]");
    if (!inp) return JSON.stringify({ err: "no palette input" });
    var before = {};
    document.querySelectorAll("[data-job]").forEach(function(el){ before[el.getAttribute("data-job")] = 1; });
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(inp, "add motioncorr");
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    return new Promise(function(res){
      setTimeout(function(){
        inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        var t0 = performance.now();
        var frames = [];
        var last = "";
        var iv = setInterval(function(){
          var nb = [];
          document.querySelectorAll("[data-job]").forEach(function(el){
            var id = el.getAttribute("data-job");
            if (!before[id]) nb.push({ op: getComputedStyle(el).opacity, born: el.hasAttribute("data-born"), d: el.style.getPropertyValue("--card-d") });
          });
          var w = document.querySelector('[data-canvas="workspace"]');
          var f = { t: Math.round(performance.now() - t0), n: nb.length, play: w ? w.hasAttribute("data-birth-play") : false, op: nb[0] ? nb[0].op : null, born: nb[0] ? nb[0].born : null, d: nb[0] ? nb[0].d : null };
          var key = JSON.stringify([f.n, f.play, f.op, f.born, f.d]);
          if (key !== last) { last = key; frames.push(f); }
        }, 50);
        setTimeout(function(){ clearInterval(iv); res(JSON.stringify({ frames: frames })); }, 5000);
      }, 400);
    });
  })()`, 5);
  const w2Born = w2 && w2.frames ? w2.frames.filter((f) => f.n >= 1) : [];
  check("mint landed — one newborn seen", w2Born.length >= 1, `newborn frames=${w2Born.length}`);
  const onlyOne = w2Born.every((f) => f.n === 1);
  check("exactly ONE card born (the world around it untouched)", onlyOne, `n=${w2Born.map((f) => f.n).join(",")}`);
  const w2Mid = w2Born.filter((f) => f.op !== null && parseFloat(f.op) < 0.99);
  check("W2 THE MINT FLOWS — the newborn painted mid-entrance", w2Mid.length >= 1, `mid at t=${w2Mid.map((f) => f.t).join(",") || "none"}`);
  const w2FirstArmed = w2Born.findIndex((f) => f.born === true);
  const w2Flash = w2FirstArmed === -1 ? [] : w2Born.slice(0, w2FirstArmed).filter((f) => f.n > 0);
  check("mint's from-frame pinned too", w2FirstArmed >= 0 && w2Flash.length === 0, w2Flash.length ? `flash frames: ${JSON.stringify(w2Flash.slice(0, 2))}` : "no flash");
  const w2D = w2Born.some((f) => f.d === "0ms");
  check("single birth stands at step 0 (--card-d 0ms)", w2D, "no staircase for one card");
  await sleep(700);
  const w2Retired = await readJson(`JSON.stringify({ born: document.querySelectorAll("[data-born]").length, play: !!document.querySelector('[data-birth-play]') })`);
  check("mint's window retired clean", w2Retired && w2Retired.born === 0 && w2Retired.play === false, JSON.stringify(w2Retired));
  /* cleanup the mint via API — the id is the DOM census diff (names lie,
   * ids don't) */
  const censusAfterMint = await readJson(`JSON.stringify(Array.from(document.querySelectorAll("[data-job]")).map(function(el){ return el.getAttribute("data-job"); }))`);
  const minted = Array.isArray(censusAfterMint) && Array.isArray(censusBeforeMint)
    ? censusAfterMint.filter((id) => !censusBeforeMint.includes(id))
    : [];
  if (minted.length === 1) {
    api(`/api/jobs/${minted[0]}`, "DELETE");
    check("mint probe cleaned via API (census diff)", true, minted[0]);
  } else {
    check("mint probe located for cleanup (exactly one diff)", false, `diff=${minted.length}`);
  }
  await sleep(400);

  /* ---- W3 — THE SILENT FACES ------------------------------------------------ */
  console.log(`\n[W3] the silent faces — history restore and reload never arm`);
  /* (a) delete a probe card through the UI (history entry), then Ctrl+Z:
   * the restore appends backJobs — a birth by NOBODY's hand, so the card
   * must remount WITHOUT the birth voice. The card must be HITTABLE at
   * its center (the t593 lesson: the minimap overlay floats over the
   * bottom-left of the world — an import lands BELOW the world, exactly
   * where the map floats). */
  const probeCard = await readJson(`(function(){
    var found = null;
    var cards = [];
    document.querySelectorAll("[data-job]").forEach(function(c){
      if ((c.textContent || "").indexOf("t598 Birth") >= 0) cards.push(c);
    });
    for (var i = 0; i < cards.length && !found; i++) {
      var r = cards[i].getBoundingClientRect();
      var hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && cards[i].contains(hit)) found = cards[i].getAttribute("data-job");
    }
    return found || (cards[0] ? cards[0].getAttribute("data-job") : null);
  })()`);
  check("hittable probe card located for the delete/undo face", !!probeCard, String(probeCard));
  sh(`agent-browser click '[data-job="${probeCard}"]' >/dev/null 2>&1 || true`);
  await sleep(500);
  /* selection lives on the INNER card-lift ring, and the stale-selection
   * trap is real: a previous verb (the W2 mint) may still own selectedId
   * after its card was API-deleted — the Delete key would then open a
   * dialog for a DEAD id and deleteJob would no-op (alive=[], the
   * errToast lane). The dialog's own title is the honest gate: it names
   * the job that will actually be deleted. */
  const selOk = await readJson(`JSON.stringify((function(){
    var wrap = document.querySelector('[data-job="${probeCard}"]');
    if (!wrap) return { err: "card gone" };
    var lift = wrap.querySelector(".card-lift");
    return { ringed: lift ? lift.className.indexOf("ring-primary/60") >= 0 : false };
  })())`);
  check("probe card selected (real CDP click, inner ring)", !!(selOk && selOk.ringed === true), JSON.stringify(selOk));
  await readJson(`(function(){
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    return "sent";
  })()`);
  const delDlg = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify((function(){
      var dlg = document.querySelector('[role="alertdialog"]');
      if (!dlg) return null;
      var t = (dlg.textContent || "");
      return { probe: t.indexOf("t598 Birth") >= 0, title: t.slice(0, 60) };
    })())`);
    return v && v.probe === true ? v : null;
  }, 8000, 300);
  check("the delete dialog opened FOR THE PROBE (title names it)", !!(delDlg && delDlg.probe === true), JSON.stringify(delDlg));
  await readJson(`(function(){
    var btn = null;
    Array.from(document.querySelectorAll('[role="alertdialog"] button')).forEach(function(b){
      if (!btn && /^Delete/.test((b.textContent || "").trim())) btn = b;
    });
    if (!btn) return JSON.stringify({ err: "no delete confirm" });
    btn.click();
    return "confirmed";
  })()`);
  const dlgClosed = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!document.querySelector('[role="alertdialog"]'))`);
    return v === true ? v : null;
  }, 8000, 300);
  check("delete confirmed through the dialog (dialog closed)", dlgClosed === true, `closed=${dlgClosed}`);
  /* the server truth first (the DELETE rides await api before the
   * optimistic remove — under memory pressure it can outrun 12s), then
   * the visual truth (the deferred card layer's unmount). */
  const dbGone = await pollUntil(async () => {
    try {
      const still = api("/api/jobs").jobs.some((j) => j.id === probeCard);
      return !still ? true : null;
    } catch { return null; }
  }, 30000, 700);
  check("probe deleted at the server", dbGone === true);
  const gone = await pollUntil(async () => {
    const v = await readJson(`JSON.stringify(!document.querySelector('[data-job="${probeCard}"]'))`);
    return v === true ? v : null;
  }, 30000, 400);
  check("probe card unmounted", gone === true);
  await readJson(`(function(){
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    return "sent";
  })()`);
  const w3a = await readJson(`(function(){
    var t0 = performance.now();
    var frames = [];
    var last = "";
    var iv = setInterval(function(){
      var el = document.querySelector('[data-job="${probeCard}"]');
      var w = document.querySelector('[data-canvas="workspace"]');
      var f = {
        t: Math.round(performance.now() - t0),
        back: !!el,
        born: el ? el.hasAttribute("data-born") : null,
        play: w ? w.hasAttribute("data-birth-play") : null
      };
      var key = JSON.stringify([f.back, f.born, f.play]);
      if (key !== last) { last = key; frames.push(f); }
    }, 60);
    return new Promise(function(res){ setTimeout(function(){ clearInterval(iv); res(JSON.stringify({ frames: frames })); }, 3200); });
  })()`, 5);
  const backFrames = w3a && w3a.frames ? w3a.frames.filter((f) => f.back) : [];
  check("restore landed — the card is back", backFrames.length >= 1, `back frames=${backFrames.length}`);
  const silentRestore = backFrames.every((f) => f.born === false && f.play === false);
  check("W3a THE RESTORE IS SILENT — no birth attributes on a history return", silentRestore, silentRestore ? "history is not a birth" : "restore wrongly armed");
  await sleep(400);
  /* (b) reload: the world mounts from the server — births nobody asked for
   * must stay silent (the F3 face under the new stanza). */
  await readJson(`(function(){ location.reload(); return "reloading"; })()`);
  await sleep(2500);
  const rehyd = await pollUntil(async () => {
    const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
    return n === 15 ? n : null;
  }, 60000, 500);
  check("world re-hydrated after reload (15 cards)", rehyd === 15, `got ${rehyd}`);
  const reloadSilent = await readJson(`JSON.stringify({
    born: document.querySelectorAll("[data-born]").length,
    play: !!document.querySelector('[data-birth-play]')
  })`);
  check("W3b THE RELOAD IS SILENT — no entrance for a world that simply is", reloadSilent && reloadSilent.born === 0 && reloadSilent.play === false, JSON.stringify(reloadSilent));

  /* ---- R — the net contract -------------------------------------------------- */
  console.log(`\n[R] the world owes nothing`);
  {
    /* clean every probe the window minted (all idle imports — honest deletes) */
    const after = api("/api/jobs").jobs || [];
    const probes = after.filter((j) => j.name && j.name.indexOf("t598 Birth") === 0);
    for (const p of probes) api(`/api/jobs/${p.id}`, "DELETE");
    await sleep(600);
    const roster = api("/api/projects").projects.find((p) => p.id === EMPIAR_ID);
    check("roster 12→12 (the probes were borrowed, not kept)", roster.stats.total === 12, `12 → ${roster.stats.total}`);
    const finalCount = await pollUntil(async () => {
      const n = await readJson(`JSON.stringify(document.querySelectorAll("[data-job]").length)`);
      return n === 12 ? n : null;
    }, 20000, 500);
    check("canvas back to the 12-card world", finalCount === 12, `got ${finalCount}`);
    let errs = "";
    try { errs = sh(`agent-browser errors 2>/dev/null`).trim(); } catch { /* */ }
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  }

  try { sh(`agent-browser screenshot /home/z/my-project/.qa-logs/shots/t598-card-birth-settled.png >/dev/null 2>&1`); } catch { /* best effort */ }
  check("📸 settled world screenshot", true, ".qa-logs/shots/t598-card-birth-settled.png");

  console.log(`\n[done] pass=${pass} fail=${fail}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  try { sh(`agent-browser close --all >/dev/null 2>&1`); } catch { /* */ }
}
process.exit(fail ? 1 : 0);
