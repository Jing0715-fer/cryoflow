#!/usr/bin/env node
/**
 * t902 — the fsc-compare restore whisper's LIVE witness (the t901 bed's
 * second candidate, paid).
 *
 * t901 shipped the whisper (the t899 grammar's third seat) but its live
 * witness was honestly NOT GRANTED: the re-seeded world has zero
 * FSC-bearing jobs — fsc-index answers [], the dialog's door does not
 * exist. This window mints the door WITHOUT minting permanent rows:
 * the completed topazdenoise witnesses already own workdirs (engine
 * state), and the fsc-index classifies a workdir by FILE PRESENCE —
 * so the instrument seeds a synthetic run_half1_model.star into seven
 * of them (the qa64 star shape: _rlnResolution / _rlnAngstromResolution /
 * _rlnGoldStandardFsc, one crossing law per job), witnesses the whisper
 * end-to-end, then removes every seeded file in a crash-safe finally.
 * The world returns byte-for-byte: no new jobs, no new edges, no
 * residue — the door honestly closes behind the witness.
 *
 * The seeded persisted selection (localStorage cryoflow.fsc-compare:<pid>)
 * carries a GHOST id + eight entries: the launcher seats first (the
 * t653 law), five saved ids fill the cap, the eighth hits the cap
 * (reason "cap"), the ghost is outside the index (reason "vanished").
 * The whisper must name both edits in one line and go silent at the
 * user's first pick — and the bucket itself must come back byte-for-byte.
 *
 * Arms:
 *   P1  premise: fsc-index answers [] before the seeding (the t901
 *       honest not-granted, restated)
 *   P2  seven completed topazdenoise workdirs picked, all on disk
 *   P3  the seven synthetic stars landed
 *   P4  fsc-index answers 7 after the seeding (the door exists)
 *   P5  the launcher's own /fsc answers renderable shells (the chart
 *       will mount, the Compare chip with it)
 *   P6  the persisted bucket's pre-state recorded (raw bytes or MISSING)
 *   P7  the seeded bucket readable (ghost + launcher + 6 known)
 *   W1  the compare dialog opened (its own title)
 *   W2  the whisper BORN: [data-testid=fsc-compare-restore-whisper] exists
 *   W3  the whisper's text is the exact one-line edit summary
 *       ("2 remembered curves didn't return — 1 no longer in the index ·
 *       1 over the 6-curve cap")
 *   W4  the whisper speaks the house voice (font-mono + fuchsia — the
 *       t899 grammar)
 *   W5  the list renders the full index (7 rows, not the 6 picked)
 *   W6  the badge reads 6/6 (launcher + 5 seats; the cap ate the tail)
 *   W7  the capped row renders UNCHECKED (its seat was refused)
 *   D1  the user's first pick DISARMS the whisper (silence at ownership)
 *   D2  the badge reads 5/6 after the unpick
 *   D3  the persisted bucket now holds the LIVE truth (5 ids — the
 *       restore's memory replaced by the user's)
 *   R1  the bucket restored byte-for-byte (or re-absent)
 *   R2  every seeded star removed; each workdir's file list == pre-state
 *   R3  fsc-index answers [] again (the door honestly closed)
 *
 * Receipt: shots-qa/t902-fsc-whisper-witness.json.
 *
 *   node scripts/t902-fsc-whisper-witness.mjs
 */

import { execSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t902-fsc-whisper-witness.json";
const GHOST = `t902-whisper-ghost-${Date.now()}`;

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) =>
  execSync(cmd, { encoding: "utf8", timeout: 120_000, cwd: ROOT }).trim();
const api = (path) =>
  JSON.parse(sh(`curl -s -H "Origin: ${ORIGIN}" "${BASE}${path}"`));
// the t899 parse-twice law: the CLI's eval output is a JSON-quoted string;
// one parse yields the page's own output (itself JSON), the second the value
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, {
    encoding: "utf8",
    timeout: 120_000,
    input: expr,
  }).trim();
const evalJson = (expr) => {
  const out = evalJs(expr);
  try {
    const once = JSON.parse(out);
    if (typeof once === "string") {
      try {
        return JSON.parse(once);
      } catch {
        return once;
      }
    }
    return once;
  } catch {
    return out;
  }
};
// coordinate click with the scroll-into-view walk (the qa64 realClick
// pattern: Radix scroll-lock reverts scrollTop writes, CDP gestures pass)
const realClick = async (findExpr) => {
  const locate = `(() => {
    const el = (${findExpr}); if (!el) return null;
    let p = el.parentElement, container = null;
    while (p) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) { container = p; break; }
      p = p.parentElement;
    }
    if (container) {
      const er = el.getBoundingClientRect(), cr = container.getBoundingClientRect();
      if (er.top < cr.top + 1 || er.bottom > cr.bottom - 1) {
        const tid = container.getAttribute('data-testid');
        const sel = tid ? '[data-testid=' + tid + ']' : (container.id ? '#' + container.id : null);
        if (sel) return JSON.stringify({ scrollSel: sel, dir: er.top < cr.top ? 'up' : 'down' });
      }
    }
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`;
  let pos = evalJson(locate);
  if (!pos || pos === "null") return "NO-ELEMENT";
  if (pos.scrollSel) {
    sh(`${AB} scroll ${pos.dir} 250 -s ${pos.scrollSel}`);
    await sleep(250);
    pos = evalJson(
      `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`
    );
    if (!pos || pos === "null") return "NO-ELEMENT";
  }
  sh(`${AB} mouse move ${pos.x} ${pos.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${pos.x},${pos.y}`;
};

/* ------------------------------------------------------------------ */
/* the crash-safe cleanup — registered BEFORE anything touches the world */
/* ------------------------------------------------------------------ */
const seeded = []; // { workdir, file, beforeList }
let bucketPre = null; // the EXACT string stored, or null when the key was absent
let browserUp = false;
let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  console.log("\n  cleanup (crash-safe finally)…");
  // 1. the bucket — restored LIVE while the profile still exists (the
  // browser leg's tail owns this when the ride got there; this is the
  // FATAL-path fallback: the same contract, best-effort)
  if (browserUp) {
    try {
      const expr = bucketPre === null
        ? `localStorage.removeItem(${JSON.stringify(KEY)}); 'removed'`
        : `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(bucketPre)}); 'restored'`;
      evalJs(expr);
      console.log(`  cleanup: bucket ${bucketPre === null ? "re-absent" : "restored byte-for-byte"}`);
    } catch {}
  }
  // 2. the browser — the last resident opened, the first closed
  try {
    if (browserUp) {
      sh(`${AB} close`);
      browserUp = false;
    }
  } catch {}
  // 3. the seeded stars — remove ONLY what this instrument wrote
  for (const s of seeded) {
    try {
      rmSync(join(s.workdir, s.file), { force: true });
    } catch {}
  }
  // 4. verify the workdirs' file lists == pre-state
  let restored = true;
  for (const s of seeded) {
    try {
      const now = readdirSync(s.workdir).sort().join(",");
      if (now !== s.beforeList) restored = false;
    } catch {
      restored = false;
    }
  }
  console.log(`  cleanup: ${seeded.length} seeded stars removed, workdirs ${restored ? "byte-for-byte" : "DRIFTED"}`);
  return restored;
}

// the honest shipper: every exit path rides cleanup()
process.on("exit", (code) => {
  if (browserUp) {
    try {
      execSync(`${AB} close`, { timeout: 30_000 });
    } catch {}
  }
  for (const s of seeded) {
    try {
      rmSync(join(s.workdir, s.file), { force: true });
    } catch {}
  }
});

console.log("t902 fsc-whisper live witness — the door minted from file presence, closed behind the witness\n");

/* ------------------------------------------------------------------ */
/* P1 — the premise: the door does not exist yet                       */
/* ------------------------------------------------------------------ */
const PROJECT = api("/api/workspaces").workspaces[0].projectId;
const KEY = `cryoflow.fsc-compare:${PROJECT}`;
const indexPre = api(`/api/projects/${PROJECT}/fsc-index`);
ok("P1 premise: fsc-index answers [] (the t901 not-granted, restated)", (indexPre.jobs ?? []).length === 0, `jobs=${(indexPre.jobs ?? []).length}`);

/* ------------------------------------------------------------------ */
/* P2 — pick seven completed topazdenoise workdirs                     */
/* ------------------------------------------------------------------ */
const roster = api("/api/jobs").jobs ?? [];
// LATEST first: the twelve topazdenoise witnesses were minted at one
// default canvas spot — a STACK — and the top card is the latest mint.
// The launcher must hit-test clean (cards overlap; a covered center
// clicks the card above), so the top card has to be IN the picks. The
// browser leg's W0 hit-test walk then picks whichever clean card leads.
const done = roster
  .filter((j) => j.type === "topazdenoise" && j.status === "completed")
  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
const state = JSON.parse(readFileSync(join(ROOT, "data/engine-state.json"), "utf8"));
const runs = state.runs ?? state;
const picks = [];
for (const j of done) {
  const run = runs[j.id];
  const wd = run?.workdir;
  if (wd && existsSync(wd)) picks.push({ id: j.id, name: j.name, workdir: wd });
  if (picks.length === 7) break;
}
ok("P2 seven completed workdirs picked, all on disk", picks.length === 7, picks.map((p) => p.name.slice(0, 18)).join(" | "));
if (picks.length < 7) {
  await cleanup();
  process.exit(1);
}
const firstPick = picks[0];
const known = picks.map((p) => p.id);

/* ------------------------------------------------------------------ */
/* P3 — seed the synthetic half1 model stars (one crossing law each)   */
/* ------------------------------------------------------------------ */
function modelStar(k) {
  const lines = [
    "data_model_class001",
    "",
    "loop_",
    "_rlnResolution #1",
    "_rlnAngstromResolution #2",
    "_rlnGoldStandardFsc #3",
  ];
  for (let i = 0; i < 48; i++) {
    const f = 0.01 + (0.49 - 0.01) * (i / 47);
    const g = Math.min(0.99, 0.95 * Math.exp(-k * f));
    lines.push(`${f.toFixed(9)}  ${(1 / f).toFixed(6)}  ${g.toFixed(6)}`);
  }
  return lines.join("\n") + "\n";
}
for (let i = 0; i < picks.length; i++) {
  const p = picks[i];
  seeded.push({
    workdir: p.workdir,
    file: "run_half1_model.star",
    beforeList: readdirSync(p.workdir).sort().join(","),
  });
  writeFileSync(join(p.workdir, "run_half1_model.star"), modelStar(7.0 + i * 0.6));
}
ok("P3 seven synthetic half1 model stars landed", seeded.every((s) => existsSync(join(s.workdir, s.file))));

/* ------------------------------------------------------------------ */
/* P4/P5 — the door exists; the launcher's own curve is renderable     */
/* ------------------------------------------------------------------ */
const indexPost = api(`/api/projects/${PROJECT}/fsc-index`);
ok("P4 fsc-index answers 7 after the seeding", (indexPost.jobs ?? []).length === 7, `jobs=${(indexPost.jobs ?? []).length}`);
let launcherShells = 0;
try {
  const fsc = api(`/api/jobs/${firstPick.id}/fsc`);
  launcherShells = (fsc.shells ?? []).length;
} catch {}
ok("P5 the first pick's /fsc answers renderable shells", launcherShells > 0, `shells=${launcherShells} job=${firstPick.name}`);

/* ------------------------------------------------------------------ */
/* P6/P7 — the persisted bucket: record pre, seed the 8-entry memory   */
/* ------------------------------------------------------------------ */
sh(`${AB} set viewport 1600 900`);
sh(`${AB} open ${BASE}/`);
await sleep(4500);
browserUp = true;
const rawPre = evalJs(`localStorage.getItem(${JSON.stringify(KEY)})`);
const preMissing = !rawPre || rawPre === "null" || rawPre === undefined;
try {
  bucketPre = preMissing ? null : JSON.parse(rawPre); // the EXACT string stored
  if (typeof bucketPre !== "string") bucketPre = preMissing ? null : rawPre;
} catch {
  bucketPre = preMissing ? null : rawPre;
}
ok("P6 the persisted bucket's pre-state recorded", true, bucketPre === null ? "MISSING (absent key)" : `raw=${String(bucketPre).slice(0, 60)}`);

const SAVED = [GHOST, ...known]; // ghost first, then launcher + 6 known
evalJs(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify(SAVED))}); 'seeded'`);
const seededRead = evalJs(`localStorage.getItem(${JSON.stringify(KEY)})`);
let seededOk = false;
try {
  const once = JSON.parse(seededRead);
  const arr = typeof once === "string" ? JSON.parse(once) : once;
  seededOk = Array.isArray(arr) && arr.length === 8 && arr[0] === GHOST;
} catch {}
ok("P7 the seeded bucket readable (ghost + launcher + 6 known)", seededOk);

/* ------------------------------------------------------------------ */
/* W — the whisper's birth: launcher card → inspector → Compare chip    */
/* ------------------------------------------------------------------ */
console.log("\n  the witness leg (the door's door, the whisper's birth)…");

// the launcher card: [data-job] anchor, the card's own clickable button.
// CANVAS CARDS OVERLAP — the first live capture had the click at the
// t894 card's center land on the t899 card stacked above it (the t899
// inspector that opened was the proof, its own chip absent for the job
// was never seeded). So the launcher is the first candidate whose button
// center hit-tests to ITSELF; any of the seven can launch (the saved
// list dedupes the launcher wherever it sits — the arithmetic is
// launcher-agnostic).
let launcher = null;
let cardClick = "NO-CLEAN-CANDIDATE";
for (const cand of picks) {
  const probe = evalJson(`(() => {
    const btn = document.querySelector('[data-job="${cand.id}"] [role="button"][tabindex]');
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    return JSON.stringify({ cx, cy, own: !!hit && !!btn.contains(hit) });
  })()`);
  if (probe && probe.own) {
    launcher = cand;
    cardClick = await realClick(
      `document.querySelector('[data-job="${launcher.id}"] [role="button"][tabindex]')`
    );
    if (String(cardClick).startsWith("clicked@")) break;
    cardClick = `hit-clean-but-${cardClick}`;
  }
}
ok(
  "W0a the launcher card clicked (hit-test clean — no card above)",
  String(cardClick).startsWith("clicked@") && !!launcher,
  `${cardClick} launcher=${launcher ? launcher.name : "none"}`
);
await sleep(2500); // the inspector dialog mounts + its charts fetch

// the Compare chip lives in the FSC chart header inside the inspector
let chipClick = "NO-ELEMENT";
for (let i = 0; i < 8 && chipClick === "NO-ELEMENT"; i++) {
  chipClick = await realClick(`document.querySelector('[data-testid="fsc-compare-open"]')`);
  if (chipClick === "NO-ELEMENT") await sleep(1200);
}
ok("W0b the Compare chip clicked", String(chipClick).startsWith("clicked@"), String(chipClick));

// the dialog: poll for its list (discovery is a local fetch — fast)
let dlg = null;
for (let i = 0; i < 10 && !dlg; i++) {
  await sleep(1000);
  dlg = evalJson(`(() => {
    const list = document.querySelector('[data-testid="fsc-compare-list"]');
    if (!list) return null;
    const dlgEl = list.closest('[role="dialog"]');
    const whisper = document.querySelector('[data-testid="fsc-compare-restore-whisper"]');
    const rows = [...document.querySelectorAll('[data-testid="fsc-compare-row"]')];
    return JSON.stringify({
      title: (dlgEl?.querySelector('h2')?.textContent || dlgEl?.textContent || '').slice(0, 40),
      whisper: whisper ? whisper.textContent : null,
      whisperClass: whisper ? whisper.className : null,
      rows: rows.length,
      badge: (dlgEl?.textContent || '').match(/\\d+\\/6/)?.[0] ?? null,
    });
  })()`);
}
ok("W1 the compare dialog opened (its list mounted)", !!dlg, dlg ? `title=${dlg.title}` : "no list");
if (!dlg) {
  await cleanup();
  process.exit(1);
}

const WHISPER_EXPECT = "2 remembered curves didn't return \u2014 1 no longer in the index \u00b7 1 over the 6-curve cap";
ok("W2 the whisper BORN", typeof dlg.whisper === "string" && dlg.whisper.length > 0, dlg.whisper ?? "absent");
ok("W3 the whisper's text is the exact one-line edit summary", dlg.whisper === WHISPER_EXPECT, `got: ${dlg.whisper}`);
ok(
  "W4 the whisper speaks the house voice (font-mono + fuchsia, the t899 grammar)",
  typeof dlg.whisperClass === "string" && dlg.whisperClass.includes("font-mono") && dlg.whisperClass.includes("fuchsia"),
  dlg.whisperClass ?? "no class"
);
ok("W5 the list renders the full index (7 rows, not the 6 picked)", dlg.rows === 7, `rows=${dlg.rows}`);
ok("W6 the badge reads 6/6 (launcher + 5 seats; the cap ate the tail)", dlg.badge === "6/6", `badge=${dlg.badge}`);

// W7 — the capped row renders UNCHECKED: the eighth saved id's seat was
// refused at restore; its checkbox must not show the user picked it.
// Row identity rides the per-job jump testid (names collide — the roster
// carries duplicate witness names; the id is the honest key)
const capped = picks[6]; // the eighth SAVED entry (ghost, launcher, then 5 seats, then this)
const rowOf = (id) => `document.querySelector('[data-testid="fsc-compare-jump-${id}"]')?.closest('[data-testid="fsc-compare-row"]')`;
const cappedState = evalJson(`(() => {
  const row = ${rowOf(capped.id)};
  if (!row) return null;
  const cb = row.querySelector('button[role="checkbox"], [role="checkbox"]');
  return JSON.stringify({ found: !!row, checked: cb ? cb.getAttribute('aria-checked') || cb.getAttribute('data-state') : null });
})()`);
ok("W7 the capped row renders UNCHECKED (its seat was refused)", !!cappedState && cappedState.found && (cappedState.checked === "false" || cappedState.checked === "unchecked"), JSON.stringify(cappedState));

/* ------------------------------------------------------------------ */
/* D — the disarm: the user's first pick takes ownership               */
/* ------------------------------------------------------------------ */
// uncheck a SEATED row (the second pick entry) — a real user action with
// a visible effect; the whisper must go silent the moment it lands
const seated = picks[1];
const cbClick = await realClick(
  `${rowOf(seated.id)}?.querySelector('button[role="checkbox"], [role="checkbox"]')`
);
ok("D0a the seated row's checkbox clicked", String(cbClick).startsWith("clicked@"), String(cbClick));
if (String(cbClick).startsWith("clicked@")) {
  await sleep(1200);
  const after = evalJson(`(() => {
    const whisper = document.querySelector('[data-testid="fsc-compare-restore-whisper"]');
    const dlgEl = document.querySelector('[data-testid="fsc-compare-list"]')?.closest('[role="dialog"]');
    return JSON.stringify({
      whisper: whisper ? whisper.textContent : null,
      badge: (dlgEl?.textContent || '').match(/\\d+\\/6/)?.[0] ?? null,
      bucket: localStorage.getItem(${JSON.stringify(KEY)}),
    });
  })()`);
  ok("D1 the user's first pick DISARMS the whisper (silence at ownership)", after && after.whisper === null, after?.whisper ?? "whisper absent");
  ok("D2 the badge reads 5/6 after the unpick", after?.badge === "5/6", `badge=${after?.badge}`);
  let liveIds = [];
  try {
    const once = JSON.parse(after.bucket);
    liveIds = typeof once === "string" ? JSON.parse(once) : once;
  } catch {}
  ok(
    "D3 the persisted bucket now holds the LIVE truth (5 ids — the user's memory)",
    Array.isArray(liveIds) && liveIds.length === 5 && !liveIds.includes(GHOST),
    `ids=${Array.isArray(liveIds) ? liveIds.length : "?"}`
  );
}

/* ------------------------------------------------------------------ */
/* R — the restore: bucket byte-for-byte, stars gone, the door closed  */
/* ------------------------------------------------------------------ */
console.log("\n  the restore leg (byte-for-byte)…");
// R1 — the bucket: restore the EXACT pre-state while the profile lives
const rExpr = bucketPre === null
  ? `localStorage.removeItem(${JSON.stringify(KEY)}); 'removed'`
  : `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(bucketPre)}); 'restored'`;
evalJs(rExpr);
const rawPost = evalJs(`localStorage.getItem(${JSON.stringify(KEY)})`);
let r1 = false;
if (bucketPre === null) r1 = !rawPost || rawPost === "null";
else {
  try {
    const once = JSON.parse(rawPost);
    r1 = (typeof once === "string" ? once : rawPost) === bucketPre;
  } catch {
    r1 = rawPost === bucketPre;
  }
}
ok("R1 the bucket restored byte-for-byte (or re-absent)", r1, bucketPre === null ? "was MISSING" : String(bucketPre).slice(0, 50));

// close the dialog + inspector politely before the close (the Escape
// peel: the compare dialog consumes its own Escape at the React level)
try {
  sh(`${AB} press Escape`);
  await sleep(600);
  sh(`${AB} press Escape`);
  await sleep(600);
} catch {}

// the browser's last act — cleanup() owns the rest
try {
  sh(`${AB} close`);
  browserUp = false;
} catch {}

// R2 — the seeded stars removed, workdirs byte-for-byte
const r2 = await cleanup();
ok("R2 every seeded star removed; each workdir's file list == pre-state", r2, `${seeded.length} workdirs`);

// R3 — the door honestly closed
const indexTail = api(`/api/projects/${PROJECT}/fsc-index`);
ok("R3 fsc-index answers [] again (the door honestly closed)", (indexTail.jobs ?? []).length === 0, `jobs=${(indexTail.jobs ?? []).length}`);

/* ------------------------------------------------------------------ */
/* the receipt                                                         */
/* ------------------------------------------------------------------ */
const verdict = fail === 0 ? "GREEN" : "RED";
const receipt = {
  instrument: "t902-fsc-whisper-witness",
  at: new Date().toISOString(),
  project: PROJECT,
  launcher: launcher ? { id: launcher.id, name: launcher.name } : null,
  ghost: GHOST,
  saved: SAVED,
  bucketWasMissing: bucketPre === null,
  pass,
  fail,
  verdict,
};
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nFSC-WHISPER-WITNESS t902: ${pass} passed, ${fail} failed — ${verdict}`);
console.log(`receipt: ${RECEIPT}`);
process.exit(fail === 0 ? 0 : 1);
