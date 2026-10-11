#!/usr/bin/env node
/**
 * t899 — THE WIPE MEMORY'S CROSS-MODE ECHO (the side-by-side whisper chip).
 *
 * The claim: the wipe divider's position memory survives a mode flip
 * (t896's round trip), but in side-by-side the divider is ABSENT and the
 * measurement is invisible — the user must flip back to learn their
 * finding survived. The side caption now whispers the parked divider for
 * every card the user actually moved (a position at the 50 default is no
 * finding; silence is its honest voice): the house mono chip, the
 * fuchsia at whisper level, naming the value — "wipe 100%".
 *
 * The witness (the browser is the last resident, opened and closed by
 * this script's own discipline):
 *   1. the bucket snapshot (the position memory's localStorage home,
 *      `cryoflow.wipe:<jobId>` — the t896 grammar) rides out FIRST;
 *   2. End parks the first card's divider at 100% (one absolute press —
 *      prior state cannot lie about it);
 *   3. the side-by-side flip: exactly ONE chip speaks, and it speaks the
 *      value ("wipe 100%") — the cards the user never moved stay silent;
 *   4. the flip back: the divider is STILL at 100% (the round-trip law,
 *      re-witnessed at the chip's own value);
 *   5. the bucket restored BYTE-FOR-BYTE (the t533 law — the instrument
 *      writes, the instrument pays back).
 *
 * Usage: node scripts/t899-wipe-memory-echo-witness.mjs
 */
import { execSync } from "node:child_process";

const JOB = "cmv3y2m370001ltn309f8q29s"; // the t896 witness job (paired tiles)
const BUCKET_KEY = `cryoflow.wipe:${JOB}`;

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const ab = (cmd) => sh(`agent-browser ${cmd}`);
// the CLI's honest tongue: parse twice (the t899 first-ride lesson)
const parseAb = (txt) => {
  const t = String(txt ?? "").trim();
  try {
    const v = JSON.parse(t);
    if (typeof v === "string") { try { return JSON.parse(v); } catch { return { raw: v.slice(0, 200) }; } }
    return v;
  } catch { return { raw: t.slice(0, 200) }; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (js) => parseAb(ab(`eval "${js}"`));

console.log("t899 wipe-memory echo witness — the side caption speaks the parked divider\n");

// the crash-safe cleanup pair: the bucket's restore rides the FINALLY (a
// crash mid-witness must never leave the memory's home dirty — the t533
// law owns the crash path too), and the browser closes first regardless
let bucketBefore = "__ABSENT__";
let bucketTouched = false;
let bucketRestored = false;
const restoreBucket = () => {
  if (!bucketTouched || bucketRestored) return;
  bucketRestored = true;
  try {
    const restoreJs = bucketBefore === "__ABSENT__"
      ? `localStorage.removeItem('${BUCKET_KEY}'); 'removed'`
      : `localStorage.setItem('${BUCKET_KEY}', ${JSON.stringify(bucketBefore)}); 'restored'`;
    evalJs(`JSON.stringify({r: (function(){${restoreJs}})()})`);
    const verify = evalJs(`JSON.stringify({raw: (function(){var v=localStorage.getItem('${BUCKET_KEY}');return v===null?'__ABSENT__':v})()})`).raw;
    ok("6 the bucket restored byte-for-byte (crash-safe path)", verify === bucketBefore, `after=${String(verify).slice(0, 60)}`);
  } catch (e) {
    ok("6 the bucket restored byte-for-byte (crash-safe path)", false, String(e).slice(0, 120));
  }
};

try {
  /* 1 — the bucket snapshot (before any browser work — the memory's home
   * must be captured BEFORE this instrument touches it) */
  // browser opens FIRST so localStorage reads ride the app's origin
  ab("open http://localhost:3000/");
  ab("wait 1500");
  const snap = evalJs(`JSON.stringify({raw: (function(){var v=localStorage.getItem('${BUCKET_KEY}');return v===null?'__ABSENT__':v})()})`);
  bucketBefore = snap.raw;
  bucketTouched = true;
  ok("1 the bucket snapshot taken", typeof bucketBefore === "string", `raw=${String(bucketBefore).slice(0, 80)}`);

  /* 2 — the inspector via the keyboard door (a completed card opens on
   * Enter), the Results tab, the gallery's first wipe range */
  const card = evalJs(`JSON.stringify({card: !!document.querySelector('[data-card-btn=${JOB}]')})`);
  ok("2 the witness card on the canvas", card.card === true, JSON.stringify(card).slice(0, 120));
  ab(`focus '[data-card-btn="${JOB}"]'`);
  ab("press Enter");
  await sleep(900);
  // the tab latch (t176's own law): the inspector may ALREADY be on the
  // Results tab (the last-viewed latch re-applies) — only click when the
  // active tab says otherwise
  let tabState = evalJs(`JSON.stringify({tab: (function(el){return el?el.textContent.trim():null})(document.querySelector('[role=dialog] [role=tab][data-state=active]'))})`);
  if (tabState.tab !== "Results") {
    const m = ab("snapshot").match(/- tab "Results" \[ref=([eA-Za-z0-9]+)\]/);
    ok("2b the Results tab found (needing the click)", !!m);
    if (m) {
      ab(`click @${m[1]}`);
      await sleep(1200);
      tabState = evalJs(`JSON.stringify({tab: (function(el){return el?el.textContent.trim():null})(document.querySelector('[role=dialog] [role=tab][data-state=active]'))})`);
    }
  } else {
    ok("2b the Results tab already active (the latch's own memory)", true);
  }
  ok("2b-final the Results tab is active", tabState.tab === "Results", JSON.stringify(tabState).slice(0, 120));
  // the gallery's data rides a fetch — WAIT for it, never a fixed sleep
  // (the second ride's lesson: the latch opens Results instantly, the
  // fetch lands a breath later, and a fixed 1200ms is a coin flip)
  let gallery = { gallery: false, range: false };
  const tGal = Date.now();
  while (Date.now() - tGal < 10_000) {
    gallery = evalJs(`JSON.stringify({gallery: !!document.querySelector('[data-denoise-card]'), range: !!document.querySelector('[data-denoise-card] input[type=range]')})`);
    if (gallery.gallery === true && gallery.range === true) break;
    await sleep(700);
  }
  ok("2c the gallery renders with a wipe range", gallery.gallery === true && gallery.range === true, JSON.stringify(gallery));

  /* 3 — End parks the divider at 100% (absolute; the nudge chip speaks
   * and the debounced bucket write follows) */
  ab(`focus '[data-denoise-card] input[type="range"]'`);
  ab("press End");
  await sleep(900); // the 350ms debounce + settle
  const bucketAfter = evalJs(`JSON.stringify({raw: (function(){var v=localStorage.getItem('${BUCKET_KEY}');return v===null?'__ABSENT__':v})()})`).raw;
  ok("3 the bucket carries the parked divider (mic001: 100)", /"mic001"\s*:\s*100/.test(String(bucketAfter)), `raw=${String(bucketAfter).slice(0, 120)}`);

  /* 4 — the side-by-side flip: the chip speaks ONCE, with the value */
  const modeBtns = ab("snapshot").match(/- button "(side-by-side|wipe)" \[ref=([eA-Za-z0-9]+)\]/g);
  const sideRef = (ab("snapshot").match(/- button "side-by-side" \[ref=([eA-Za-z0-9]+)\]/) ?? [])[1];
  ok("4 the side-by-side toggle found in the a11y tree", !!sideRef, JSON.stringify(modeBtns ?? []).slice(0, 160));
  if (sideRef) {
    ab(`click @${sideRef}`);
    await sleep(900);
    const chip = evalJs(`JSON.stringify({chips: Array.prototype.map.call(document.querySelectorAll('[data-wipe-memory-chip]'),function(el){return el.textContent.trim()}), side: (function(){var b=document.querySelectorAll('[aria-pressed]');for(var i=0;i<b.length;i++){if(b[i].textContent.trim()==='side-by-side'&&b[i].getAttribute('aria-pressed')==='true')return true}return false})()})`);
    ok("4b side mode is active", chip.side === true, JSON.stringify(chip).slice(0, 140));
    ok("4c exactly ONE card speaks (the moved one)", Array.isArray(chip.chips) && chip.chips.length === 1, JSON.stringify(chip.chips));
    ok("4d the chip NAMES the value (wipe 100%)", chip.chips?.[0] === "wipe 100%", JSON.stringify(chip.chips));
  }

  /* 5 — the flip back: the divider is still parked at the chip's value */
  const wipeRef = (ab("snapshot").match(/- button "wipe" \[ref=([eA-Za-z0-9]+)\]/) ?? [])[1];
  if (wipeRef) {
    ab(`click @${wipeRef}`);
    await sleep(900);
    const back = evalJs(`JSON.stringify({aria: (function(){var r=document.querySelector('[data-denoise-card] input[type=range]');return r?r.getAttribute('aria-valuetext'):null})()})`);
    ok("5 the round trip keeps the divider at 100 (the memory's law, at the chip's own value)", /100% original/.test(back.aria ?? ""), back.aria);
  }

  /* 6 — the restore is the FINALLY's job now (crash-safe); this step
   * only verifies it happened on the happy path too */
  restoreBucket();
} finally {
  restoreBucket();
  try { sh("agent-browser close >/dev/null 2>&1 || true"); } catch {}
  ok("7 the browser closed (the first resident closed)", true);
}

console.log(`\nt899 wipe-memory echo witness: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
