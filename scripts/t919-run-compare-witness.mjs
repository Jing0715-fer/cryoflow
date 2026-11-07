#!/usr/bin/env node
/**
 * t919 — the run-compare dialog's Class A/B door, its FIRST live ride
 * (t453's third domain — the class-compare verdict brain has lived in
 * benches since t453; the DIALOG has never carried two real class2d
 * runs). The world now holds the variable: the t916 chain's class2d
 * (K=4, 42 particles, occupancy law {1:10,2:11,3:11,4:10}) and the
 * t919 second class2d (K=6, same extract, law {1..6: 7}).
 *
 * TWO PHASES (the door's guard is one of the faces under proof):
 *   g0    with the K=6 run REMOVED (run `t919-class2d-b-mint.mjs remove`
 *         first): the completed K=4 inspector carries the convergence
 *         and arc doors but NO Class A/B door — zero completed siblings
 *         is the guard's null face, witnessed LIVE, not assumed.
 *   main  with the K=6 run minted back (`t919-class2d-b-mint.mjs mint`):
 *     A   the API band — both /classes routes answer; every expected
 *         number below is a REPLICA computed on the ROUTE's own rows
 *         (joinByName/pairedDeltas/verdict/census/fmtDelta math), never
 *         a memory.
 *     C   1280, host = the K=4 wired run: the door speaks its dialect
 *         and counts its sibling; the all-LOST face — 0 gained / 4
 *         lost / 0 held, median Δ −8.3%, the amber unpaired chip
 *         ("0 in A · 2 in B"), four rose dots, the census line, the
 *         losses named, the gains side honest ("none"), the select
 *         rider ABSENT (nothing gained — the no-op law), the plain
 *         adopt verb ENABLED with its 1 downstream wire.
 *     P   the same-run face, one picker flip away: Run A → the K=6
 *         sibling while B defaults to the same sibling — 6 held, no
 *         unpaired chip, the adopt verb disabled with the same-run
 *         reason. A reachable user state, witnessed.
 *     V   host = the K=6 bare run: the all-GAINED face — 4 gained /
 *         median Δ +8.3%, "2 in A · 0 in B", four teal dots, the
 *         census flipped (66.7% → 100.0%), and the select rider
 *         PRESENT but DISABLED with the plan's own honest reason
 *         (the host has no downstream to re-wire).
 *     NP  no persistence — reopen restores the host-led default pair.
 *     N   320 born-at-band: the verdict face survives the narrow door
 *         (chips wrap, movers stack, no horizontal overflow).
 *
 * The dialogue between the two orientations IS the domain's law: one
 * join, two directions, and the host decides which way the verdict
 * reads. K=6 against K=4 is the richest legal pair — classes 5–6 are
 * B-only, so the unpaired chip is part of the face.
 *
 *   node scripts/t919-run-compare-witness.mjs g0|main
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const T916 = path.join(ROOT, "data", "t916-class2d-mint.json");
const T919 = path.join(ROOT, "data", "t919-class2d-b-mint.json");
const RECEIPT = "shots-qa/t919-run-compare-witness.json";
const PHASE = process.argv[2] ?? "main";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000, cwd: ROOT }).trim();
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};
const realClick = async (findExpr) => {
  // the clamped-point law (t914 → t916): own at the ACTUAL point, corners
  // as slivers when the canvas stacks cards — a click that hits a
  // neighbor is refused, and the finder is re-scoped per attempt.
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) return "OFF-VIEWPORT";
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const settleCensus = async () => {
  let last = null;
  for (let i = 0; i < 24; i++) {
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job]')].map(c => { const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return (c.getAttribute('data-job') ?? '') + ':' + Math.round(r.x) + ',' + Math.round(r.y); }).sort())`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
};
const overflowProbe = `JSON.stringify({ overX: document.documentElement.scrollWidth - document.documentElement.clientWidth })`;
const clickTabUntilActive = async (name, match, label) => {
  for (let i = 0; i < 4; i++) {
    await realClick(`[...([...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}'))?.querySelectorAll('[role="tab"]') ?? [])].find(t => ${match})`);
    const active = await poll(
      `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); const hit = d ? [...d.querySelectorAll('[role="tab"]')].find(t => ${match}) : null; return JSON.stringify({ active: !!hit && hit.dataset.state === 'active' }); })()`,
      (v) => v.active === true, 6, 400
    );
    if (active?.active === true) return `active@try${i + 1}`;
    await sleep(400);
  }
  return "NEVER-ACTIVE";
};
const openInspector = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true
  );
  ok(`inspector open for "${name}"`, opened?.open === true);
  const strip = await poll(
    `JSON.stringify({ tabs: [...document.querySelectorAll('[role="tab"]')].map(t => (t.textContent || '').trim()).filter(Boolean) })`,
    (v) => (v.tabs ?? []).length >= 3, 40, 750
  );
  ok(`the inspector's tab strip mounted`, (strip?.tabs ?? []).length >= 3, (strip?.tabs ?? []).join("/"));
  return opened;
};

/* ---- the replica brain: the lib's math, re-spoken on the ROUTE's rows --- */
const share = (r) => r.fraction * 100;
function joinByName(aRows, bRows) {
  const byNameB = new Map(bRows.map((r) => [r.name, r]));
  const pairs = []; const onlyA = []; const seenB = new Set();
  for (const a of aRows) {
    const b = byNameB.get(a.name);
    if (b) { pairs.push({ name: a.name, a, b }); seenB.add(a.name); }
    else onlyA.push(a.name);
  }
  const onlyB = bRows.filter((r) => !seenB.has(r.name)).map((r) => r.name);
  return { pairs, onlyA, onlyB };
}
function deltasOf(pairs) {
  return pairs.map(({ name, a, b }) => {
    const delta = share(b) - share(a); // the share lens: higher IS better
    return { name, a: share(a), b: share(b), delta, kind: delta > 0 ? "improved" : delta < 0 ? "regressed" : "tied" };
  });
}
function medianOf(values) {
  const s = [...values].sort((x, y) => x - y);
  if (s.length === 0) return NaN;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const fmtDelta = (v, d = 1) => !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
const topShare = (rows) => [...rows].sort((x, y) => y.fraction - x.fraction).slice(0, 5).reduce((s, r) => s + r.fraction, 0) * 100;
const usableCount = (rows) => rows.filter((r) => r.fraction >= 0.01).length;
function censusLine(pairs) {
  if (pairs.length === 0) return null;
  const a = pairs.map((p) => p.a), b = pairs.map((p) => p.b);
  return `Concentration census: the top 5 classes hold ${topShare(a).toFixed(1)}% → ${topShare(b).toFixed(1)}% of the particles; classes above the 1% bar: ${usableCount(a)} → ${usableCount(b)}, across ${pairs.length} paired classes — the distribution's own health check.`;
}
const compareDlg = `[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('Paired per-class verdict'))`;

/** THE EATEN-CLICK LAWS, both live this window (t917's re-sighted + one new):
 *  (1) the inspector's action cluster re-renders under the live poll and a
 *  neighbor moves into the point between the probe and the mouse down — the
 *  door is clicked until the COMPARE dialog ITSELF says open, never trusted
 *  on the probe's receipt; (2) ONE Escape closes the WHOLE STACK (compare
 *  AND inspector — witnessed live), so every reset starts from the canvas:
 *  Esc, re-open the inspector by its card, re-click the door. */
const inspectorOpen = (name) =>
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d && !!d.querySelector('[aria-label^="Class A/B — compare with another completed run"]') }); })()`;
const reopenInspector = async (name) => {
  sh(`${AB} press Escape`); await sleep(700);
  await settleCensus();
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  if (!String(clicked).startsWith("clicked@")) return `card:${clicked}`;
  await poll(inspectorOpen(name), (v) => v.open === true, 16, 500);
  return `reopened`;
};
const openCompareUntil = async (name) => {
  for (let i = 0; i < 5; i++) {
    const insp = await poll(inspectorOpen(name), (v) => v.open === true, 4, 400);
    if (insp?.open !== true) {
      const r = await reopenInspector(name);
      if (!String(r).startsWith("reopened")) return `inspector:${r}`;
    }
    // the cluster re-renders as the inspector's lazy chunks mount — the door
    // has been seen to drift 60px between two probes (743→683, live this
    // window). Wait for the door's center to hold STILL before clicking:
    // own-at-a-moving-point is a rumor.
    let stable = null;
    for (let s = 0; s < 10; s++) {
      const pos = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); const b = d?.querySelector('[aria-label^="Class A/B — compare with another completed run"]'); if (!b) return JSON.stringify({ gone: true }); const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
      if (stable && pos && stable.x === pos.x && stable.y === pos.y) break;
      stable = pos; await sleep(450);
    }
    const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}'))?.querySelector('[aria-label^="Class A/B — compare with another completed run"]')`);
    if (!String(clicked).startsWith("clicked@")) { await sleep(700); continue; }
    const opened = await poll(`(() => { const d = ${compareDlg}; return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 6, 450);
    if (opened?.open === true) return `open@try${i + 1}`;
    // what ACTUALLY opened: a neighbor door moved into the point (the
    // convergence/arc twin) — name it, then ONE Escape resets the stack
    const neighbor = evalJson(`JSON.stringify({ heads: [...document.querySelectorAll('[role="dialog"] h2')].map(h => (h.textContent || '').trim()) })`);
    console.log(`  (attempt ${i + 1}: compare did not open; dialogs now: ${JSON.stringify(neighbor?.heads ?? [])})`);
    sh(`${AB} press Escape`); await sleep(800);
  }
  return "NEVER-OPEN";
};

// ---- the ground truth ------------------------------------------------------
if (PHASE === "g0") {
  if (!existsSync(T916)) { console.log("FATAL: no t916 manifest — mint the chain first"); process.exit(2); }
  if (existsSync(T919)) { console.log("FATAL: the t919 manifest exists — the K=6 run must be REMOVED for the g0 null face (t919-class2d-b-mint.mjs remove)"); process.exit(2); }
} else {
  if (!existsSync(T916) || !existsSync(T919)) { console.log("FATAL: both mint manifests must exist for the main phase"); process.exit(2); }
}
const m916 = JSON.parse(readFileSync(T916, "utf8"));
const A_NAME = m916.class2d.name;      // "t916 class2d witness" — K=4, wired
const A_ID = m916.class2d.id;
let B_NAME = null, B_ID = null, rowsA = null, rowsB = null;
const shApi = (url) => execSync(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
const classesOf = (id) => {
  const data = JSON.parse(shApi(`/api/jobs/${id}/classes`));
  return (data.classes ?? []).map((c) => ({ name: `Class ${String(c.cls).padStart(3, "0")}`, cls: c.cls, count: c.count, fraction: c.fraction }));
};
rowsA = classesOf(A_ID);
ok("the K=4 route answers with the law's map", JSON.stringify(Object.fromEntries(rowsA.map((r) => [r.cls, r.count]))) === JSON.stringify(m916.expect.perIter["2"]), JSON.stringify(rowsA.map((r) => [r.cls, r.count])));

if (PHASE === "main") {
  const m919 = JSON.parse(readFileSync(T919, "utf8"));
  B_NAME = m919.class2dB.name;         // "t919 class2d second witness" — K=6, bare
  B_ID = m919.class2dB.id;
  rowsB = classesOf(B_ID);
  ok("the K=6 route answers with the law's map", JSON.stringify(Object.fromEntries(rowsB.map((r) => [r.cls, r.count]))) === JSON.stringify(m919.expect.perIter["2"]), JSON.stringify(rowsB.map((r) => [r.cls, r.count])));

  // the three joins the face can speak, computed on the ROUTE's own rows
  const lost = joinByName(rowsA, rowsB);
  const lostD = deltasOf(lost.pairs);
  var EXP_LOST = {
    pairs: lost.pairs.length, onlyA: lost.onlyA, onlyB: lost.onlyB,
    improved: lostD.filter((d) => d.kind === "improved").length,
    regressed: lostD.filter((d) => d.kind === "regressed").length,
    tied: lostD.filter((d) => d.kind === "tied").length,
    median: fmtDelta(medianOf(lostD.map((d) => d.delta))),
    census: censusLine(lost.pairs),
    bigLosers: lostD.filter((d) => d.kind === "regressed").sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 2).map((d) => d.name).sort(),
  };
  const gained = joinByName(rowsB, rowsA);
  const gainedD = deltasOf(gained.pairs);
  var EXP_GAINED = {
    pairs: gained.pairs.length, onlyA: gained.onlyA, onlyB: gained.onlyB,
    improved: gainedD.filter((d) => d.kind === "improved").length,
    regressed: gainedD.filter((d) => d.kind === "regressed").length,
    tied: gainedD.filter((d) => d.kind === "tied").length,
    median: fmtDelta(medianOf(gainedD.map((d) => d.delta))),
    census: censusLine(gained.pairs),
    bigGainers: gainedD.filter((d) => d.kind === "improved").sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 2).map((d) => d.name).sort(),
  };
  const same = joinByName(rowsB, rowsB);
  const sameD = deltasOf(same.pairs);
  var EXP_SAME = {
    pairs: same.pairs.length, onlyA: same.onlyA, onlyB: same.onlyB,
    improved: sameD.filter((d) => d.kind === "improved").length,
    regressed: sameD.filter((d) => d.kind === "regressed").length,
    tied: sameD.filter((d) => d.kind === "tied").length,
    median: fmtDelta(medianOf(sameD.map((d) => d.delta))),
    census: censusLine(same.pairs),
  };
  console.log(`replicas: LOST ${EXP_LOST.improved}g/${EXP_LOST.regressed}l/${EXP_LOST.tied}h median ${EXP_LOST.median} of ${EXP_LOST.pairs} · GAINED ${EXP_GAINED.improved}g median ${EXP_GAINED.median} · SAME ${EXP_SAME.tied}h median ${EXP_SAME.median}`);
}

const jobsNow = JSON.parse(shApi("/api/jobs")).jobs.length;

/* =========================== PHASE g0 ==================================== */
if (PHASE === "g0") {
  console.log("== band G0: the door's NULL face (0 completed class2d siblings) ==");
  sh(`${AB} set viewport 1280 900`);
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 15, 30);
  await settleCensus();
  await openInspector(A_NAME);

  const doors = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${A_NAME}')); if (!d) return JSON.stringify({}); return JSON.stringify({ classAB: !!d.querySelector('[aria-label^="Class A/B — compare with another completed run"]'), convergence: (d.querySelector('[aria-label^="Class convergence —"]')?.getAttribute('aria-label') ?? null), arc: (d.querySelector('[aria-label^="Resolution arc —"]')?.getAttribute('aria-label') ?? null) }); })()`,
    (v) => v.convergence && v.arc, 24, 750
  );
  ok("G0 the family cluster renders (convergence door present, it counts its own ladder)", !!doors?.convergence, String(doors?.convergence ?? "").slice(0, 100));
  ok("G0 the arc door present beside it (the ML dialect's own door)", !!doors?.arc, String(doors?.arc ?? "").slice(0, 100));
  ok("G0 the Class A/B door ABSENT with zero completed siblings — the guard's null face, live", doors?.classAB === false, `classAB=${doors?.classAB}`);

  sh(`${AB} press Escape`); await sleep(400);
  writeReceipt({ g0: { pass, fail, doors } });
  console.log(`== g0 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

/* =========================== PHASE main ================================== */
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}

console.log("== band C: 1280, host K4 — the all-LOST face ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobsNow - 2, 30);
await settleCensus();
await openInspector(A_NAME);

const doorC = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${A_NAME}')); const b = d?.querySelector('[aria-label^="Class A/B — compare with another completed run"]'); return JSON.stringify({ present: !!b, aria: b?.getAttribute('aria-label') ?? null, title: b?.getAttribute('title') ?? null }); })()`,
  (v) => v.present === true, 24, 750
);
ok("C the Class A/B door ARRIVED with the sibling (the guard's live flip from g0)", doorC?.present === true);
ok(`C the door counts its sibling (1 sibling runs available)`, (doorC?.aria ?? "").includes("(1 sibling runs available)"), doorC?.aria ?? "");
ok("C the door's title is the class domain's OWN dialect (not the per-micrograph hardcode)", (doorC?.title ?? "").includes("paired per-class verdict between two completed runs: where did the particles go?"), doorC?.title ?? "");

const doorEffect = await openCompareUntil(A_NAME);
ok("C the compare dialog OPEN (click-until-effect held — the door re-clicked until the dialog ITSELF says open)", String(doorEffect).startsWith("open@"), String(doorEffect));

const face = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); const h = d.querySelector('[role="heading"], h2'); return JSON.stringify({ heading: h?.textContent?.trim() ?? null, intro: (d.textContent || '').includes('where did the particles go, and which classes did run B concentrate?'), lensTabs: d.querySelectorAll('[role="tablist"][aria-label="Comparison metric"] [role="tab"]').length, runA: d.querySelector('[aria-label="Run A"]')?.textContent?.trim() ?? null, runB: d.querySelector('[aria-label="Run B"]')?.textContent?.trim() ?? null }); })()`,
  (v) => v.heading, 24, 750
);
ok(`C the heading speaks the one lens ("Class A/B — Occupancy share")`, face?.heading === "Class A/B — Occupancy share", face?.heading ?? "null");
ok("C the intro names the class domain's question verbatim", face?.intro === true);
ok("C NO lens tablist — a one-lens domain speaks in its heading", face?.lensTabs === 0, `tabs=${face?.lensTabs}`);
ok("C Run A leads with the host (this run)", (face?.runA ?? "").includes(`${A_NAME} (this run)`), face?.runA ?? "");
ok("C Run B defaults to the first candidate (the K=6 sibling)", (face?.runB ?? "").includes(B_NAME), face?.runB ?? "");

const chipsC = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); const t = d.textContent || ''; const un = [...d.querySelectorAll('span')].find(s => (s.textContent || '').startsWith('unpaired:')); return JSON.stringify({ t, unpaired: un?.textContent ?? null, unpairedTitle: un?.getAttribute('title') ?? null }); })()`,
  (v) => (v.t ?? "").includes("median"), 24, 750
);
ok(`C verdict chips: ${EXP_LOST.improved} gained / ${EXP_LOST.regressed} lost / ${EXP_LOST.tied} held (the replica's counts)`, (chipsC?.t ?? "").includes(`${EXP_LOST.improved} gained`) && (chipsC?.t ?? "").includes(`${EXP_LOST.regressed} lost`) && (chipsC?.t ?? "").includes(`${EXP_LOST.tied} held`));
ok(`C the median chip speaks the replica's median (${EXP_LOST.median}%) with the lib's own U+2212`, (chipsC?.t ?? "").includes(`median Δ ${EXP_LOST.median}%`));
ok(`C the pairing census ("of ${EXP_LOST.pairs} paired")`, (chipsC?.t ?? "").includes(`of ${EXP_LOST.pairs} paired`));
ok("C the amber unpaired chip speaks B-only classes (0 in A · 2 in B)", chipsC?.unpaired === "unpaired: 0 in A · 2 in B", chipsC?.unpaired ?? "absent");
ok("C the unpaired chip's tooltip names Class 005/006", (chipsC?.unpairedTitle ?? "").includes("Only in B: Class 005, Class 006"), (chipsC?.unpairedTitle ?? "").replace(/\n/g, " | "));

const dotsOf = `(() => { const d = ${compareDlg}; const svg = d?.querySelector('.recharts-surface'); if (!svg) return JSON.stringify({}); const count = (f) => [...svg.querySelectorAll('[fill="' + f + '"]')].filter(el => el.tagName.toLowerCase() === 'path' || el.tagName.toLowerCase() === 'circle').length; return JSON.stringify({ svg: true, teal: count('#0d9488'), rose: count('#e11d48'), slate: count('#94a3b8') }); })()`;
const dotsC = await poll(
  dotsOf,
  (v) => v.svg, 24, 750
);
ok("C the identity scatter: 4 rose dots (the lost series), zero teal, zero slate", dotsC?.rose === 4 && dotsC?.teal === 0 && dotsC?.slate === 0, `teal=${dotsC?.teal} rose=${dotsC?.rose} slate=${dotsC?.slate}`);
const dashesC = evalJson(`(() => { const d = ${compareDlg}; const svg = d?.querySelector('.recharts-surface'); return JSON.stringify({ dashed: !!svg?.querySelector('[stroke-dasharray="4 4"]'), legend: (d?.textContent || '').includes('dashed line = no change (B equals A)') }); })()`);
ok("C the 45° dashed reference line + the legend's own sentence", dashesC?.dashed === true && dashesC?.legend === true);

const moversC = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); const blocks = [...d.querySelectorAll('.rounded-lg.border.p-2\\\\.5')]; const byTitle = (t) => blocks.find(b => (b.textContent || '').includes(t)); const g = byTitle('Biggest gains'), l = byTitle('Biggest losses'); return JSON.stringify({ gainsNone: g ? (g.textContent || '').includes('none — the whole pack moved the other way') : null, lossItems: l ? [...l.querySelectorAll('li')].map(li => (li.textContent || '').trim()) : null, census: (d.textContent || '').includes('Concentration census:') }); })()`,
  (v) => v.lossItems, 24, 750
);
ok("C the gains side is honest: 'none — the whole pack moved the other way'", moversC?.gainsNone === true);
ok("C the losses name all four classes (a verdict you can act on is names)", (moversC?.lossItems ?? []).length === 4, JSON.stringify((moversC?.lossItems ?? []).map((s) => s.slice(0, 40))));
ok("C the two biggest losses are the −9.5 twins (magnitude-first)", JSON.stringify((moversC?.lossItems ?? []).slice(0, 2).map((s) => (s.match(/Class \d{3}/) ?? [""])[0]).sort()) === JSON.stringify(EXP_LOST.bigLosers), JSON.stringify((moversC?.lossItems ?? []).slice(0, 2)));
ok("C the loss rows speak the share move (e.g. 26.2% → 16.7% (−9.5%))", (moversC?.lossItems ?? []).every((s) => /→ .+ \(−\d+\.\d%\)$/.test(s)), (moversC?.lossItems ?? [])[0]?.slice(-40) ?? "");
ok("C the census line speaks the replica's concentration truth", (chipsC?.t ?? "").includes(EXP_LOST.census), EXP_LOST.census.slice(0, 80));

const verbsC = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); const adopt = d.querySelector('[data-testid="adopt-downstream"]'); const sel = d.querySelector('[data-testid="adopt-with-select"]'); const openA = [...d.querySelectorAll('button')].find(b => (b.textContent || '').includes('Open run A')); const openB = [...d.querySelectorAll('button')].find(b => (b.textContent || '').includes('Open run B')); return JSON.stringify({ adopt: adopt ? { disabled: adopt.disabled, aria: adopt.getAttribute('aria-label'), label: adopt.textContent?.trim() } : null, selectRider: sel ? { disabled: sel.disabled } : null, openA: !!openA, openB: !!openB }); })()`,
  (v) => v.adopt, 24, 750
);
ok("C the plain adopt verb ENABLED — the host's downstream is real (1 wire)", verbsC?.adopt?.disabled === false && (verbsC?.adopt?.aria ?? "").includes(`re-wires 1 of ${A_NAME}'s downstream jobs`), verbsC?.adopt?.aria ?? "");
ok("C the adopt label carries the count badge (1)", (verbsC?.adopt?.label ?? "").includes("(1)"), verbsC?.adopt?.label ?? "");
ok("C the select rider ABSENT — nothing gained, a no-op button is noise (the t448 law)", verbsC?.selectRider === null);
ok("C the Open run A / Open run B doors present", verbsC?.openA === true && verbsC?.openB === true);
const overC = evalJson(overflowProbe);
ok("C no horizontal overflow at 1280", overC.overX <= 0, `overX=${overC.overX}`);

// band P — the same-run face, one picker flip away
console.log("== band P: the same-run face (Run A flipped to the K=6 sibling) ==");
// the picker is click-until-effect too (the t917 law's second home): the
// trigger is clicked until the listbox says open, the option until the
// VERDICT says flipped — a stale click lands on a re-rendered row
let pickEffect = "NEVER";
for (let i = 0; i < 4; i++) {
  const trig = await realClick(`${compareDlg}?.querySelector('[aria-label="Run A"]')`);
  if (!String(trig).startsWith("clicked@")) { const re = await openCompareUntil(A_NAME); if (!String(re).startsWith("open@")) break; continue; }
  const lb = await poll(`JSON.stringify({ open: !!document.querySelector('[role="listbox"]') })`, (v) => v.open === true, 6, 400);
  if (lb?.open !== true) { continue; }
  const opt = await realClick(`[...document.querySelectorAll('[role="option"]')].find(o => (o.textContent || '').includes('${B_NAME}'))`);
  if (!String(opt).startsWith("clicked@")) { continue; }
  const eff = await poll(
    `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({ effect: false }); return JSON.stringify({ effect: (d.textContent || '').includes('${EXP_SAME.tied} held') }); })()`,
    (v) => v.effect === true, 8, 450
  );
  if (eff?.effect === true) { pickEffect = `flipped@try${i + 1}`; break; }
  // the dialog may have closed under us (ONE Escape closes the stack) — reopen
  sh(`${AB} press Escape`); await sleep(700);
  const re = await openCompareUntil(A_NAME);
  if (!String(re).startsWith("open@")) break;
}
ok("P the Run A picker flipped to the K=6 sibling (click-until-effect)", String(pickEffect).startsWith("flipped@"), String(pickEffect));
const chipsP = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); const t = d.textContent || ''; const adopt = d.querySelector('[data-testid="adopt-downstream"]'); const un = [...d.querySelectorAll('span')].find(s => (s.textContent || '').startsWith('unpaired:')); return JSON.stringify({ t, adoptDisabled: adopt?.disabled ?? null, adoptAria: adopt?.getAttribute('aria-label') ?? null, adoptTitle: adopt?.getAttribute('title') ?? null, unpaired: un?.textContent ?? null }); })()`,
  (v) => (v.t ?? "").includes(`${EXP_SAME.tied} held`), 24, 750
);
ok(`P the same-run verdict: ${EXP_SAME.improved} gained / ${EXP_SAME.regressed} lost / ${EXP_SAME.tied} held, median ${EXP_SAME.median}%`, (chipsP?.t ?? "").includes(`${EXP_SAME.tied} held`) && (chipsP?.t ?? "").includes(`median Δ ${EXP_SAME.median}%`), `t has held=${(chipsP?.t ?? "").includes("6 held")}`);
ok("P the unpaired chip GONE (the join left nobody out)", chipsP?.unpaired === null, chipsP?.unpaired ?? "absent");
ok("P the adopt verb disabled with the same-run reason — the plan speaks, never a guess", chipsP?.adoptDisabled === true && (chipsP?.adoptTitle ?? "").includes("Runs A and B are the same run — adoption needs two different runs"), chipsP?.adoptTitle ?? "");
const dotsP = evalJson(dotsOf);
ok("P the scatter flips to 6 slate tied dots", dotsP?.slate === 6 && dotsP?.rose === 0 && dotsP?.teal === 0, `teal=${dotsP?.teal} rose=${dotsP?.rose} slate=${dotsP?.slate}`);
// TWO doors were stacked (compare over the inspector) — ONE Escape closes
// the WHOLE stack (the app's own law, witnessed live); assert the reset
sh(`${AB} press Escape`); await sleep(700);
const stackReset = evalJson(`JSON.stringify({ left: document.querySelectorAll('[role="dialog"]').length })`);
ok("P ONE Escape resets the whole stack (compare AND inspector)", stackReset?.left === 0, `left=${stackReset?.left}`);

// band V — host = the K=6 bare run, the all-GAINED face
console.log("== band V: host K6 — the all-GAINED face + the honest rider ==");
await settleCensus();
await openInspector(B_NAME);
const doorV = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${B_NAME}')); const b = d?.querySelector('[aria-label^="Class A/B — compare with another completed run"]'); return JSON.stringify({ aria: b?.getAttribute('aria-label') ?? null }); })()`,
  (v) => v.aria, 24, 750
);
ok("V the door counts the same single sibling from the K=6 side", (doorV?.aria ?? "").includes("(1 sibling runs available)"), doorV?.aria ?? "");
const doorVEffect = await openCompareUntil(B_NAME);
ok("V the compare dialog OPEN (click-until-effect)", String(doorVEffect).startsWith("open@"), String(doorVEffect));

const faceV = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); return JSON.stringify({ runA: d.querySelector('[aria-label="Run A"]')?.textContent?.trim() ?? null, runB: d.querySelector('[aria-label="Run B"]')?.textContent?.trim() ?? null, t: d.textContent || '' }); })()`,
  (v) => (v.t ?? "").includes("median"), 24, 750
);
ok("V Run A is the K=6 host (this run)", (faceV?.runA ?? "").includes(`${B_NAME} (this run)`), faceV?.runA ?? "");
ok("V Run B defaults to the K=4 sibling", (faceV?.runB ?? "").includes(A_NAME), faceV?.runB ?? "");
ok(`V the all-GAINED verdict: ${EXP_GAINED.improved} gained / ${EXP_GAINED.regressed} lost, median ${EXP_GAINED.median}%`, (faceV?.t ?? "").includes(`${EXP_GAINED.improved} gained`) && (faceV?.t ?? "").includes(`${EXP_GAINED.regressed} lost`) && (faceV?.t ?? "").includes(`median Δ ${EXP_GAINED.median}%`));
ok("V the unpaired chip flips sides (2 in A · 0 in B)", (faceV?.t ?? "").includes("unpaired: 2 in A · 0 in B"));
ok("V the census flipped — the replica's own truth", (faceV?.t ?? "").includes(EXP_GAINED.census), EXP_GAINED.census.slice(0, 80));

const dotsV = evalJson(dotsOf);
ok("V the scatter: 4 teal dots (the gained series), zero rose", dotsV?.teal === 4 && dotsV?.rose === 0, `teal=${dotsV?.teal} rose=${dotsV?.rose}`);

const moversV = evalJson(`(() => { const d = ${compareDlg}; const blocks = [...d.querySelectorAll('.rounded-lg.border.p-2\\\\.5')]; const byTitle = (t) => blocks.find(b => (b.textContent || '').includes(t)); const g = byTitle('Biggest gains'), l = byTitle('Biggest losses'); return JSON.stringify({ gainItems: g ? [...g.querySelectorAll('li')].map(li => (li.textContent || '').trim()) : null, lossNone: l ? (l.textContent || '').includes('none — the whole pack moved the other way') : null }); })()`);
ok("V the gains name all four classes, the −9.5 twins first", (moversV?.gainItems ?? []).length === 4 && JSON.stringify((moversV?.gainItems ?? []).slice(0, 2).map((s) => (s.match(/Class \d{3}/) ?? [""])[0]).sort()) === JSON.stringify(EXP_GAINED.bigGainers), JSON.stringify((moversV?.gainItems ?? []).slice(0, 2)));
ok("V the losses side honest: 'none — the whole pack moved the other way'", moversV?.lossNone === true);

const verbsV = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); const adopt = d.querySelector('[data-testid="adopt-downstream"]'); const sel = d.querySelector('[data-testid="adopt-with-select"]'); return JSON.stringify({ adopt: adopt ? { disabled: adopt.disabled, aria: adopt.getAttribute('aria-label') } : null, sel: sel ? { disabled: sel.disabled, aria: sel.getAttribute('aria-label'), label: sel.textContent?.trim() } : null }); })()`,
  (v) => v.sel, 24, 750
);
ok("V the select rider PRESENT with its count badge (4) — the gained face earns it", !!verbsV?.sel && (verbsV?.sel?.label ?? "").includes("(4)"), verbsV?.sel?.label ?? "");
ok("V the rider DISABLED with the plan's own reason (the bare host has no downstream to re-wire)", verbsV?.sel?.disabled === true && (verbsV?.sel?.aria ?? "").includes(`unavailable: ${B_NAME} has no downstream jobs to re-wire`), verbsV?.sel?.aria ?? "");
ok("V the plain adopt verb disabled for the same reason", verbsV?.adopt?.disabled === true && (verbsV?.adopt?.aria ?? "").includes(`unavailable: ${B_NAME} has no downstream jobs to re-wire`), verbsV?.adopt?.aria ?? "");

// NP — no persistence: ONE Escape closes the stack; reopening from the
// canvas must restore the host-led default pair. The reset is ASSERTED
// (with retries) — a stack that refuses to reset would be a finding.
let stackGone = false;
for (let i = 0; i < 3; i++) {
  sh(`${AB} press Escape`); await sleep(700);
  const left = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="dialog"]').length })`);
  if (left?.n === 0) { stackGone = true; break; }
}
ok("NP the stack RESET (one Escape, both dialogs gone)", stackGone === true);
const npEffect = await openCompareUntil(B_NAME);
ok("NP the compare reopened from the canvas (the stack reset did not lose the door)", String(npEffect).startsWith("open@"), String(npEffect));
const npFace = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); return JSON.stringify({ runA: d.querySelector('[aria-label="Run A"]')?.textContent?.trim() ?? null, t: d.textContent || '' }); })()`,
  (v) => (v.t ?? "").includes("median"), 24, 750
);
ok("NP reopen restores the WHOLE-ARC default: host leads, 4 gained — an A/B is a question about the CURRENT pair", (npFace?.runA ?? "").includes(`${B_NAME} (this run)`) && (npFace?.t ?? "").includes("4 gained"));

// the dialog's own navigation verb — Open run B hands the inspector to the sibling
const openBClicked = await realClick(`[...(${compareDlg}?.querySelectorAll('button') ?? [])].find(b => (b.textContent || '').includes('Open run B'))`);
ok("NP Open run B clicked", String(openBClicked).startsWith("clicked@"), String(openBClicked));
const handed = await poll(
  `(() => { const gone = !${compareDlg}; const insp = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${A_NAME}')); return JSON.stringify({ gone, insp: !!insp }); })()`,
  (v) => v.gone === true && v.insp === true, 24, 750
);
ok("NP the compare dialog closed and the K=4 inspector took its place (inspect(runB) ran)", handed?.gone === true && handed?.insp === true);
sh(`${AB} press Escape`); await sleep(500);

// band N — 320 born-at-band: the verdict face at the narrow door
console.log("== band N: 320 narrow, born at band — host K4's all-lost face ==");
sh(`${AB} set viewport 320 800`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobsNow - 2, 30);
await settleCensus();
await openInspector(A_NAME);
// the door's presence at 320 — with ONE reopen-tolerant retry: the ride
// evals have been seen to lie transiently ("{}" for a live page), so a
// miss re-derives the inspector from the canvas before it's believed
let doorN = null;
for (let i = 0; i < 2 && doorN?.present !== true; i++) {
  if (i > 0) {
    sh(`${AB} press Escape`); await sleep(600);
    await settleCensus();
    const re = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${A_NAME}'))?.querySelector('[role="button"][tabindex]')`);
    await poll(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${A_NAME}')); return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 16, 500);
  }
  doorN = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${A_NAME}')); return JSON.stringify({ present: !!d?.querySelector('[aria-label^="Class A/B — compare with another completed run"]') }); })()`,
    (v) => v.present === true, 16, 750
  );
}
ok("N the door present at 320", doorN?.present === true);
const doorNEffect = await openCompareUntil(A_NAME);
ok("N the compare dialog OPEN at 320 (click-until-effect)", String(doorNEffect).startsWith("open@"), String(doorNEffect));
const faceN = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); const r = d.getBoundingClientRect(); const adopt = d.querySelector('[data-testid="adopt-downstream"]'); const adoptR = adopt?.getBoundingClientRect(); return JSON.stringify({ t: d.textContent || '', w: Math.round(r.width), inW: r.left >= -1 && r.right <= document.documentElement.clientWidth + 1, adoptIn: adoptR ? adoptR.left >= -1 && adoptR.right <= document.documentElement.clientWidth + 1 : null }); })()`,
  (v) => (v.t ?? "").includes("median"), 30, 750
);
ok("N the dialog fits the narrow door (the calc-width face)", faceN?.inW === true, `w=${faceN?.w}`);
ok("N the all-lost verdict spoken at 320 (4 lost, median −8.3%)", (faceN?.t ?? "").includes("4 lost") && (faceN?.t ?? "").includes(`median Δ ${EXP_LOST.median}%`));
ok("N the adopt verb in-rect (the verdict's verb survives the stack)", faceN?.adoptIn === true);
const overN = evalJson(overflowProbe);
ok("N no horizontal overflow at 320", overN.overX <= 0, `overX=${overN.overX}`);
sh(`${AB} press Escape`); await sleep(400);

// world guard
const jobsAfter = JSON.parse(shApi("/api/jobs")).jobs.length;
ok("WORLD the ride created nothing and killed nothing (a reading, not a mutation)", jobsAfter === jobsNow, `${jobsAfter} vs ${jobsNow}`);

writeReceipt({
  main: {
    pass, fail,
    lost: EXP_LOST, gained: EXP_GAINED, same: EXP_SAME,
    counts: { jobs: jobsNow },
  },
});
console.log(`== main ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail == (receipt: ${RECEIPT})`);
process.exit(fail === 0 ? 0 : 1);
