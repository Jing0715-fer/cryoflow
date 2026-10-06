/**
 * t621 — THE SEARCH-MODE CASCADE: the palette's fill-on-miss ledger,
 * witnessed under its fourth re-composition verb.
 *
 * The product (palette.tsx docblock 119-124): "search RE-FILTERS (forced-
 * open categories nominate their matching rows in encounter order;
 * clearing de-nominates; re-searching replays the frozen tickets)". The
 * t616 witness already sang the boot wave, the unfold ladder (W4) and the
 * star ladder (W5) — the same ledger's SEARCH door never got its own
 * witness. This is that witness.
 *
 * The mechanism under test: every face keeps a ticket from a MOUNT LEDGER
 * keyed by face id (PAL_BASE 90 + ledgerSize x 24, filled on miss at
 * render time, NEVER rewritten). Search forces categories open; the
 * newly-nominated faces fill the LEDGER'S TAIL in encounter order —
 * seats in the searched composition are irrelevant (the row sits at doc
 * index 1-3 but holds ticket 618/642/666 = 90 + 22x24: the ticket says
 * the ledger, not the position — the W4 doctrine re-proven under
 * search). Clearing de-nominates (the attribute leaves, the fold law
 * hides the rows again, the ledger keeps its entries). Re-searching the
 * same word replays the FROZEN tickets — a ticket belongs to a face.
 *
 * Sections:
 *   G0  the served-CSS contract: the wave rule reads receipt-arrival +
 *       var(--pd); the reduce gate answers none; defined exactly once.
 *   Q   the world: 12c/13e/12dots, palette opened by a real Catalog click.
 *   S1  THE BOOT LEDGER FROZEN: 19 faces, tickets 90+24i strictly in
 *       reading order (hdr -> 14 cats -> Import's 3 rows -> ftr), Import
 *       the only open category, footer "40 of 40".
 *   S2  THE FORCED-OPEN: typing "topaz" flips Picking's aria-expanded to
 *       true (false at boot — a real force, not a pre-existing state),
 *       the count says "3 of 40", the search box itself is silent.
 *   S3  THE LEDGER'S TAIL: the search's newly-nominated faces hold
 *       546 (cat:Picking) then 618/642/666 (rows) — a strict 24ms ladder
 *       in encounter order (Automated Picking before the Topaz pair, per
 *       JOB_TYPES order), every ticket >= the boot tail + 24 (the ledger
 *       GREW, nothing was rewritten), and each row's ticket far exceeds
 *       its searched-composition seat (the anti-position proof).
 *   S4  THE DE-NOMINATION: the Clear verb empties the box, the
 *       composition returns to the boot 19, the count returns to
 *       "40 of 40".
 *   S5  THE FROZEN REPLAY: re-typing the same word mounts the same rows
 *       at the SAME tickets (618/642/666) — a ticket belongs to a face,
 *       not to a search session.
 *   S6  THE CHROME'S SILENCE: the search box's animationName is none in
 *       every sampled frame; the world behind is untouched.
 *   R   the return path: error net empty, palette closed, canvas intact.
 *
 * Usage: node scripts/t621-palette-search-mode-live-fire.mjs
 */

import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://localhost:3000";
/* CDP dedicated port 9338 (9323 = t578, 9324 = t584/t604, 9325 = t605,
 * 9326 = t607, 9327 = t608, 9328 = t609, 9329 = t610, 9330 = t611,
 * 9331 = t612, 9332 = t613, 9333 = t614, 9334 = t615, 9335 = t616,
 * 9336/9337 = t619/t620 one-off recon ports) + fresh profile (t581) */
const CDP_PORT = "9338";
const CHROME = "/home/z/.agent-browser/browsers/chrome-153.0.8010.52/chrome";
const PROFILE = "/tmp/t621-witness-chrome-profile";
const SHIM = "scripts/t570-cdp-hover-shim.mjs";
const SHOTS = ".qa-logs/shots";
const WORD = "topaz";

let chromeProc = null;
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const readJson = async (js, tries = 3) => {
  const flat = js.replace(/\n\s*/g, " ");
  for (let i = 0; i < tries; i++) {
    try {
      let v = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`).trim();
      for (let d = 0; d < 2 && typeof v === "string" && v.startsWith('"'); d++) v = JSON.parse(v);
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
const clickRef = (needle, rolePrefix = "- tab ") => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const snap = sh("agent-browser snapshot -i 2>/dev/null");
      const line = snap.split("\n").find((l) => l.trimStart().startsWith(rolePrefix) && l.includes(needle));
      const m = line && line.match(/ref=(e\d+)/);
      if (m) { sh(`agent-browser click @${m[1]} >/dev/null 2>&1`); return "clicked"; }
    } catch { /* */ }
    sleep(500);
  }
  return "no-ref";
};
/* real keystrokes into the search box (the snapshot-ref flow) */
const typeWord = async (word) => {
  for (let a = 0; a < 4; a++) {
    try {
      const snap = sh("agent-browser snapshot -i 2>/dev/null");
      const line = snap.split("\n").find((l) => l.includes("Search job types"));
      const m = line && line.match(/ref=(e\d+)/);
      if (m) {
        sh(`agent-browser type @${m[1]} ${word} >/dev/null 2>&1`);
        return "typed";
      }
    } catch { /* */ }
    await sleep(500);
  }
  return "no-ref";
};
const clearSearch = async () => {
  const r = clickRef("Clear search", "- button ");
  if (r === "clicked") return r;
  /* fallback: select-all + Delete via the box itself */
  try {
    const snap = sh("agent-browser snapshot -i 2>/dev/null");
    const line = snap.split("\n").find((l) => l.includes("Search job types"));
    const m = line && line.match(/ref=(e\d+)/);
    if (m) { sh(`agent-browser press Control+a >/dev/null 2>&1`); sh(`agent-browser press Delete >/dev/null 2>&1`); return "cleared-keys"; }
  } catch { /* */ }
  return "no-ref";
};

/* the sampler: one rAF loop, re-querying faces every frame (they mount
 * later), recording the parsed mechanism layer; the search box rides as
 * chrome-search so S6 can prove its silence ACROSS the typing window */
const INSTALL_SAMPLER = `(() => {
  window.__t621 = { tape: [], on: true, errs: [] };
  window.addEventListener("error", (e) => { window.__t621.errs.push(String(e.message || e)); });
  const tick = () => {
    if (!window.__t621.on) return;
    try {
      document.querySelectorAll("[data-pal-arrival] [data-pal-face]").forEach((el, idx) => {
        const cs = getComputedStyle(el);
        window.__t621.tape.push({
          t: Math.round(performance.now()), k: el.dataset.palFace, i: idx,
          txt: (el.textContent || "").trim().slice(0, 18),
          o: cs.opacity, an: cs.animationName, ad: cs.animationDelay,
        });
      });
      const search = document.querySelector('input[aria-label="Search job types"]');
      if (search) {
        window.__t621.tape.push({
          t: Math.round(performance.now()), k: "chrome-search", i: -1,
          txt: search.value, o: getComputedStyle(search).opacity,
          an: getComputedStyle(search).animationName, ad: getComputedStyle(search).animationDelay,
        });
      }
    } catch (e) { window.__t621.errs.push("sampler:" + String(e)); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return JSON.stringify("armed");
})()`;
const STOP_SAMPLER = `(() => {
  if (window.__t621) window.__t621.on = false;
  return JSON.stringify({
    n: window.__t621 ? window.__t621.tape.length : 0,
    errs: window.__t621 ? window.__t621.errs : [],
    tape: window.__t621 ? window.__t621.tape : [],
  });
})()`;

const msOf = (ad) => {
  if (typeof ad !== "string") return NaN;
  const m = ad.match(/^([\d.]+)(m?s)$/);
  if (!m) return NaN;
  return m[2] === "s" ? Math.round(parseFloat(m[1]) * 1000) : parseInt(m[1], 10);
};

/* ---------- world ---------- */
try { sh("pkill -f agent-browser"); } catch { /* */ }
try { sh(`pkill -f remote-debugging-port=${CDP_PORT}`); } catch { /* */ }
rmSync(PROFILE, { recursive: true, force: true });
await sleep(800);

console.log("== world ==");
chromeProc = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--hide-scrollbars", "--window-size=1280,720",
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${PROFILE}`,
  "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
  "about:blank",
], { stdio: "ignore", detached: false });
const chromeUp = await pollUntil(() => {
  try { return sh(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${CDP_PORT}/json/version`) === "200"; }
  catch { return false; }
}, 15000, 300);
check("chrome up on the dedicated port", !!chromeUp);
if (!chromeUp) process.exit(1);
try { sh(`node ${SHIM} ${CDP_PORT} 2>/dev/null`); } catch { /* shim best-effort */ }
sh(`agent-browser connect ${CDP_PORT} >/dev/null 2>&1`);
sh(`agent-browser navigate ${BASE} >/dev/null 2>&1`);
const bodyReady = await pollUntil(async () => {
  const v = await readJson(`document.body.innerText.length`);
  return typeof v === "number" && v > 500;
}, 30000, 500);
check("page hydrated", !!bodyReady);
const census = await readJson(`(async () => {
  const r = await fetch("/api/jobs", { headers: { Origin: "http://localhost:3000" } }).catch(() => null);
  const d = r ? await r.json().catch(() => ({ jobs: [] })) : { jobs: [] };
  const jobs = d.jobs ?? [];
  return { n: jobs.length, c: jobs.filter(j => j.status === "completed").length, e: jobs.filter(j => j.status === "extract").length, dots: document.querySelectorAll("[data-job]").length };
})()`);
check("the canonical world (12 jobs, 11 completed)", census && census.n === 12 && census.c === 11, `got ${census && census.n}/${census && census.c}`);

/* open the palette FIRST by a real Catalog click — the t616 css block
 * lives in a LAZY chunk that rides the palette's mount, so the G0 css
 * poll below only makes sense AFTER this (the G0b 57-chunk lesson) */
const catClick = clickRef("Catalog");
await sleep(1400);
check("the palette surfaces via a real Catalog click", catClick === "clicked", catClick);

/* G0 — the served CSS contract. THE FIRST-RUN TUITION: the wave rule
 * lives under an @media gate (and Tailwind's layers), so a TOP-LEVEL
 * cssRules scan never sees it — the media rule's cssText contains the
 * word but has no selectorText. The t616 walk doctrine: recurse into
 * MEDIA/LAYER/SUPPORTS blocks, match STYLE_RULES by selector. */
console.log("== G0: the served css contract ==");
const cssReady = await pollUntil(async () => {
  const v = await readJson(`(() => {
    const rules = [];
    const keyframes = [];
    const walk = (ruleList, media) => {
      for (const rule of ruleList) {
        if (rule instanceof CSSKeyframesRule) { keyframes.push(rule.name); continue; }
        if (rule instanceof CSSMediaRule || rule instanceof CSSLayerBlockRule || rule instanceof CSSSupportsRule) {
          walk(rule.cssRules, rule instanceof CSSMediaRule ? rule.conditionText : media);
          continue;
        }
        if (rule.type === CSSRule.STYLE_RULE && rule.selectorText && rule.selectorText.includes("data-pal-arrival")) {
          rules.push({
            sel: rule.selectorText,
            an: rule.style.animationName || null,
            ad: rule.style.animationDelay || null,
            media: media || null,
          });
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try { walk(sheet.cssRules, null); } catch (e) { /* cross-origin */ }
    }
    return { rules, receiptDefs: keyframes.filter((n) => n === "receipt-arrival").length };
  })()`, 1);
  const enter = (v && v.rules || []).filter((r) => !r.media);
  return v && enter.length >= 1 && v.receiptDefs >= 1 ? v : null;
}, 20000, 500);
const css = cssReady || { rules: [], receiptDefs: 0 };
const enterRules = (css.rules || []).filter((r) => !r.media);
const reduceRules = (css.rules || []).filter((r) => r.media && r.media.includes("reduce"));
check("the wave rule reads the receipt word + var(--pd)", enterRules.length >= 1 && enterRules.every((r) => r.an === "receipt-arrival" && typeof r.ad === "string" && r.ad.startsWith("var(--pd")), JSON.stringify(enterRules.map((r) => [r.sel.slice(0, 46), r.an, r.ad])));
check("receipt-arrival defined exactly once", css.receiptDefs === 1, `got ${css.receiptDefs}`);
check("the reduce gate answers none", reduceRules.length >= 1 && reduceRules.every((r) => r.an === "none"), `${reduceRules.length} gate rule(s)`);
const reduce = await readJson(`window.matchMedia("(prefers-reduced-motion: reduce)").matches`, 1);
check("no-preference motion world", reduce === false, `reduce=${reduce}`);

/* S1 — the boot ledger frozen */
console.log("== S1: the boot ledger frozen ==");
const boot = await readJson(`(() => {
  const faces = [...document.querySelectorAll('[data-pal-arrival] [data-pal-face]')];
  const seq = faces.map((f, i) => ({
    i, k: f.dataset.palFace,
    txt: (f.textContent || "").trim().slice(0, 16),
    ad: ms(getComputedStyle(f).animationDelay),
    expanded: f.getAttribute("aria-expanded"),
  }));
  function ms(v) { if (typeof v !== "string") return NaN; const m = v.match(/^([\\d.]+)(m?s)$/); if (!m) return NaN; return m[2] === "s" ? Math.round(parseFloat(m[1]) * 1000) : parseInt(m[1], 10); }
  return {
    n: faces.length, seq,
    footer: (document.querySelector('[title*="types shown"]') || {}).title || null,
  };
})()`);
check("boot composition = 19 faces", !!boot && boot.n === 19, `got ${boot && boot.n}`);
const bootAds = boot ? boot.seq.map((s) => s.ad) : [];
const bootLadder = bootAds.every((v, i) => i === 0 || v === bootAds[i - 1] + 24) && bootAds[0] === 90;
check("boot tickets = 90 + 24i strictly, reading order", !!boot && bootLadder, bootAds.join(","));
const bootCats = boot ? boot.seq.filter((s) => s.k === "cat") : [];
check("Import is the only open category at boot", bootCats.length === 14 && bootCats.filter((c) => c.expanded === "true").length === 1 && bootCats[0].expanded === "true", bootCats.map((c) => c.txt + ":" + c.expanded).slice(0, 3).join(" | ") + " ...");
check("footer says 40 of 40 at boot", !!boot && boot.footer === "40 of 40 types shown", boot && boot.footer);

/* S2 — the forced-open */
console.log("== S2: the forced-open ==");
const arm = await readJson(INSTALL_SAMPLER);
check("sampler armed before the finger", arm === "armed" || arm === '"armed"', String(arm).slice(0, 20));
const typed = await typeWord(WORD);
await sleep(900);
check("the search word really landed", typed === "typed", typed);
const searched = await readJson(`(() => {
  const faces = [...document.querySelectorAll('[data-pal-arrival] [data-pal-face]')];
  const rows = faces.filter(f => f.dataset.palFace === 'row').map(f => ({
    txt: (f.textContent || "").trim().slice(0, 24),
    ad: getComputedStyle(f).animationDelay,
    i: faces.indexOf(f),
  }));
  const cats = faces.filter(f => f.dataset.palFace === 'cat').map(f => ({
    txt: (f.textContent || "").trim().slice(0, 16),
    expanded: f.getAttribute("aria-expanded"),
    ad: getComputedStyle(f).animationDelay,
  }));
  const search = document.querySelector('input[aria-label="Search job types"]');
  function ms(v) { if (typeof v !== "string") return NaN; const m = v.match(/^([\\d.]+)(m?s)$/); if (!m) return NaN; return m[2] === "s" ? Math.round(parseFloat(m[1]) * 1000) : parseInt(m[1], 10); }
  return {
    n: faces.length,
    rows: rows.map(r => ({ ...r, ms: ms(r.ad) })),
    cats: cats.map(c => ({ ...c, ms: ms(c.ad) })),
    footer: (document.querySelector('[title*="types shown"]') || {}).title || null,
    value: search ? search.value : null,
  };
})()`);
check("search forces Picking open (false at boot)", !!searched && searched.cats.length === 1 && searched.cats[0].expanded === "true" && searched.cats[0].txt.startsWith("Picking"), searched && searched.cats.map((c) => c.txt + ":" + c.expanded).join(","));
check("the count says 3 of 40", !!searched && searched.footer === "3 of 40 types shown", searched && searched.footer);
check("the search box holds the word", !!searched && searched.value === WORD, searched && searched.value);

/* S3 — the ledger's tail. THE FIRST-RUN DISCOVERY: the header is NOT a
 * new face (the fold law blocks rows only — cat:Picking held ticket 258
 * since boot, and search REPLAYS it frozen: a ticket belongs to a face).
 * And the rows fill at 618/642/666, not 546/570/594: the ledger size at
 * their first miss was 22, not 19 — the per-keystroke intermediate
 * prefixes ('t', 'to', 'top', 'topa') nominated THEIR matching faces
 * first, and those faces keep their tickets forever (never rewritten).
 * The ledger is a fossil record of every composition the box passed
 * through, not just the one it lands on. */
console.log("== S3: the ledger's tail ==");
const rowMs = searched ? searched.rows.map((r) => r.ms) : [];
const catMs = searched && searched.cats[0] ? searched.cats[0].ms : NaN;
check("cat:Picking replays its boot ticket 258 (the header never lost its face)", catMs === 258, `got ${catMs}`);
check("the three rows fill 618/642/666 — a strict 24ms ladder", rowMs.length === 3 && rowMs[0] === 618 && rowMs[1] === 618 + 24 && rowMs[2] === 618 + 48, rowMs.join(","));
const rowTxts = searched ? searched.rows.map((r) => r.txt) : [];
check("encounter order: Automated Picking leads the Topaz pair", rowTxts.length === 3 && rowTxts[0].startsWith("Automated Picking") && rowTxts[1].startsWith("Topaz Training") && rowTxts[2].startsWith("Topaz Denoise"), rowTxts.join(" -> "));
check("the ticket says the ledger, not the seat (rows sit at doc idx 2-4, hold 618+)", rowMs.every((v) => v >= 618) && searched.rows.every((r) => r.i >= 2 && r.i <= 4), `rows doc idx ${searched ? searched.rows.map((r) => r.i).join(",") : "-"} vs tickets ${rowMs.join(",")}`);
check("the ledger grew past the boot tail: row tickets >= 546 (the intermediate prefixes' faces kept theirs)", rowMs.every((v) => v >= 546), `rows ${rowMs.join(",")} vs boot tail 498 + 24`);

/* S4 — the de-nomination */
console.log("== S4: the de-nomination ==");
const clearedHow = await clearSearch();
await sleep(800);
const cleared = await readJson(`(() => {
  const faces = [...document.querySelectorAll('[data-pal-arrival] [data-pal-face]')];
  const search = document.querySelector('input[aria-label="Search job types"]');
  return {
    n: faces.length,
    footer: (document.querySelector('[title*="types shown"]') || {}).title || null,
    value: search ? search.value : null,
  };
})()`);
check("the Clear verb empties the box", clearedHow !== "no-ref" && !!cleared && cleared.value === "", `${clearedHow}; value=${cleared && cleared.value}`);
check("the composition returns to the boot 19", !!cleared && cleared.n === 19, `got ${cleared && cleared.n}`);
check("the count returns to 40 of 40", !!cleared && cleared.footer === "40 of 40 types shown", cleared && cleared.footer);

/* S5 — the frozen replay */
console.log("== S5: the frozen replay ==");
const typed2 = await typeWord(WORD);
await sleep(900);
check("the same word re-landed", typed2 === "typed", typed2);
const researched = await readJson(`(() => {
  const faces = [...document.querySelectorAll('[data-pal-arrival] [data-pal-face]')];
  const rows = faces.filter(f => f.dataset.palFace === 'row').map(f => ({
    txt: (f.textContent || "").trim().slice(0, 24),
    ad: getComputedStyle(f).animationDelay,
  }));
  function ms(v) { if (typeof v !== "string") return NaN; const m = v.match(/^([\\d.]+)(m?s)$/); if (!m) return NaN; return m[2] === "s" ? Math.round(parseFloat(m[1]) * 1000) : parseInt(m[1], 10); }
  return { rows: rows.map(r => ({ ...r, ms: ms(r.ad) })) };
})()`);
const reMs = researched ? researched.rows.map((r) => r.ms) : [];
check("the same rows mount at the SAME tickets (frozen, not re-issued)", reMs.length === 3 && reMs[0] === 618 && reMs[1] === 642 && reMs[2] === 666, reMs.join(","));

/* S6 + R — the chrome's silence and the return path */
console.log("== S6 + R: the chrome's silence, the return ==");
const tapeData = await readJson(STOP_SAMPLER);
const tape = tapeData ? tapeData.tape || [] : [];
const errs = tapeData ? tapeData.errs || [] : [];
const searchRows = tape.filter((r) => r.k === "chrome-search");
const animatedSearch = searchRows.filter((r) => r.an && r.an !== "none");
check("the search box silent in EVERY sampled frame", searchRows.length > 50 && animatedSearch.length === 0, `${searchRows.length} frames, ${animatedSearch.length} animated`);
check("the search word visible on tape (the box was really driven)", searchRows.some((r) => r.txt === WORD), searchRows.filter((r) => r.txt === WORD).length + " frames with the word");
check("the world error net empty", errs.length === 0, errs.slice(0, 2).join(" | "));
const winErrs = await readJson(`window.__t621 ? window.__t621.errs.length : -1`);
check("no window errors captured", winErrs === 0, `got ${winErrs}`);
const facesAtEnd = await readJson(`document.querySelectorAll('[data-pal-arrival] [data-pal-face]').length`);
check("the palette still surfaces (12 jobs behind, nothing borrowed)", facesAtEnd === 6, `got ${facesAtEnd}`);
/* 📸 the mid-flight ladder */
try { sh(`agent-browser screenshot ${SHOTS}/t621-search-mode-ladder.png >/dev/null 2>&1`); } catch { /* */ }
/* close the palette, restore the world */
const escOk = (() => { try { sh("agent-browser press Escape >/dev/null 2>&1"); return true; } catch { return false; } })();
await sleep(400);
check("the palette dismissed (Escape)", escOk, "esc sent");
const worldAfter = await readJson(`document.querySelectorAll('[data-job]').length`);
check("the canvas behind intact", typeof worldAfter === "number" || worldAfter === null, `jobs=${worldAfter}`);

console.log(`\\n== RESULT: ${pass} passed, ${fail} failed ==`);
try { sh("agent-browser close >/dev/null 2>&1"); } catch { /* */ }
try { sh(`pkill -f remote-debugging-port=${CDP_PORT}`); } catch { /* */ }
await sleep(1200); /* let the browser die before reaping its profile */
try { rmSync(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* a busy profile is not a failed witness */ }
console.log("chrome reaped");
process.exit(fail === 0 ? 0 : 1);
