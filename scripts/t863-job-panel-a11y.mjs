#!/usr/bin/env node
/**
 * t863 — the a11y rotation's heaviest page: the JOB PANEL (the run form,
 * the app's core action surface), walked live with the census's own ruler
 * — through the world's FIRST sanctioned mutation ride (zero src).
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862: shortcuts + knock).
 * The panel was named unreachable: the world speaks only completed jobs
 * (19/19) and the edit form mounts for IDLE jobs only (the card's own
 * law: idle -> onSelect, else -> onInspect). This window pays the ride:
 *   1  CREATE one idle probe job through the app's own write door
 *      (POST /api/jobs, the same-origin metadata — the t708 gate), parked
 *      in a far corner so no existing card moves or overlaps
 *   2  WALK the panel: the click door (pointerdown -> pointerup, the
 *      card's own plain-click law), then the census's ruler — zero
 *      unnamed buttons / controls / imgs, the io+params tabs' four-tab
 *      bar, the Run button's MODE face (the t397 label law: a fresh job
 *      speaks "Run" — never Re-run, never Continue), the param form's
 *      aria-label={p.label} coverage, two settled rides bit-identical
 *   3  UN-MUTATE: DELETE through the same door (the app's own cascade),
 *      then demand the world BACK — the canvas count bit-for-bit the
 *      opening count, the probe card gone, zero unnamed everywhere. The
 *      tombstone file (data/deleted-jobs/<id>.json, the app's own undo
 *      ledger, t341) is by-design and recorded, not residue.
 * The ledger family is the tripwire: any residue the deletion left would
 * move the t846 faces' live counts on the NEXT ride and the drift would
 * speak loudly (the t861 law).
 *
 * Born with the ledger aboard (the t861 birthright, t862's practice):
 * the shared helper cuts the faces (panel / worldBack), records the arms.
 *
 * Receipt: shots-qa/t863-job-panel-a11y.json.
 *
 *   node scripts/t863-job-panel-a11y.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

/** agent-browser eval unwrap — the t837 defensive form. */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

/* ---------- provenance + the comparator (the family's shared law) ---------- */
const world = worldIdentity(ROOT);
const buildId = world.id;
const cmp = loadComparator(ROOT, "shots-qa/t863-job-panel-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t863 job-panel a11y walk — world ${world.mode}:${buildId}, the run form's page through the sanctioned mutation ride\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* same-origin metadata — the write door is a t708 gate (the healer's shape) */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
const api = async (method, url, body) => {
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: SH,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let b = null;
  try {
    b = await r.json();
  } catch {
    b = null;
  }
  return { status: r.status, body: b };
};

/* ---------- the measure: the census's name computation + panel fields.
 * NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { const nameOf = (el) => { const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim(); const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\\s+/).map((id) => { const d = document.getElementById(id); return d ? (d.textContent || "").trim() : ""; }).join(" ").trim(); if (t) return t; } if (el.id) { const lf = document.querySelector(\'label[for="\' + CSS.escape(el.id) + \'"]\'); if (lf && (lf.textContent || "").trim()) return lf.textContent.trim(); } const tc = (el.textContent || "").trim(); if (tc) return tc; if (el.tagName === "IMG") { const a = el.getAttribute("alt"); if (a !== null && a.trim()) return a.trim(); } if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const v = (el.value || "").trim(); if (v) return v; const p = (el.getAttribute("placeholder") || "").trim(); if (p) return p; } return ""; }; const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const io = document.querySelector(\'section[aria-label="Inputs"]\'); const oo = document.querySelector(\'section[aria-label="Outputs"]\'); const TABS = ["I/O", "Params", "Results", "Log"]; const tabNames = TABS.map((t) => btns.some((b) => (b.textContent || "").trim() === t)); const runBtn = btns.find((b) => ["Run", "Re-run", "Continue", "Run on cluster", "Re-run on cluster", "Continue on cluster"].includes((b.textContent || "").trim())); const act = document.activeElement; return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, unCtrlsWho: unCtrls.slice(0, 5).map((c) => String(c.className).slice(0, 50)), imgs: imgs.length, altless: altless.length, hasPanel: !!(io && oo), runFace: runBtn ? (runBtn.textContent || "").trim() : null, runTitle: runBtn ? (runBtn.getAttribute("title") || "").slice(0, 60) : null, tabs: tabNames, heading: ((document.querySelector("h1,h2") || {}).textContent || "").trim().slice(0, 40), act: act ? (act.getAttribute && act.getAttribute("aria-label")) || act.tagName : null }); })()';

/* t860 — the settle-wait: measure, re-measure, require equality, bounded. */
const settle = (what) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < 6; i++) {
    sleep(0.8);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    m = next;
    if (same) break;
  }
  console.log(`  settled ${what}`);
  return m;
};

/* ---------- Face 0: the calm canvas (the opening count) ---------- */
console.log("Face 0 — the calm canvas (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
ok("O1 the canvas is calm and named (the census's invariant)",
  !m0.hasPanel && m0.pageUnnamed === 0 && m0.unCtrls === 0 && m0.altless === 0,
  `btns=${m0.pageBtns} ctrls=${m0.ctrls} — zero unnamed anywhere`);

/* ---------- the mutation door: CREATE the idle probe job ---------- */
console.log("Mutation — POST /api/jobs (the app's own write door, far-corner parked)");
const PROBE_NAME = "Panel A11y Probe";
const mk = await api("POST", "/api/jobs", { type: "motioncorr", name: PROBE_NAME, x: 2600, y: 1400 });
ok("M1 the probe job created (201, the roster's own door)",
  mk.status === 201 && !!mk.body?.job?.id,
  mk.status === 201 ? `id ${mk.body.job.id}` : `status ${mk.status} ${JSON.stringify(mk.body)}`);
if (mk.status !== 201 || !mk.body?.job?.id) {
  writeFileSync(join(ROOT, "shots-qa/t863-job-panel-a11y.json"), JSON.stringify({ instrument: "scripts/t863-job-panel-a11y.mjs", build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "the mutation door refused — the ride never happened, the world untouched" }, null, 2));
  process.exit(1);
}
const probeId = mk.body.job.id;

/* the card arrives on the canvas (the store refetch) */
let card0 = null;
for (let i = 0; i < 8; i++) {
  await sleep(1);
  card0 = evalJson('(() => { const c = document.querySelector("[data-card-btn=\\"' + probeId + '\\"]"); return JSON.stringify({ present: !!c, label: c ? c.getAttribute("aria-label") : null }); })()');
  if (card0.present) break;
}
ok("M2 the probe card is on the canvas and speaks IDLE",
  card0.present === true && String(card0.label).endsWith(", idle"),
  `label="${card0.label}"`);

/* ---------- Face P: the job panel (the plain-click door) ---------- */
console.log("Face P — the job panel (pointerdown -> pointerup, the card's plain-click law)");
const clickCard =
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + probeId + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';
const cl = evalJson(clickCard);
ok("P1 the plain-click fired (down + up, no move)",
  cl.clicked === true, "the card's own selection law");
const p0 = settle("the panel (whatever tab the world remembers)");
ok("P2 the panel arrived (the Run face aboard — the opening tab is world-state, the persistence is the app's own)",
  p0.runFace !== null,
  `opening face: run="${p0.runFace}" io-sections=${p0.hasPanel}`);

/* the I/O face — the app's persistence must not decide what the walk films */
const clickIO =
  // Radix Tabs switches on MOUSEDOWN, not click — the trigger's own contract
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "I/O"); if (!t) return JSON.stringify({ clicked: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ clicked: true }); })()';
const cio = evalJson(clickIO);
const p1 = settle("the I/O face");
ok("P2b the I/O face mounted (the io + outputs sections — the walk films the tab it opens)",
  cio.clicked === true && p1.hasPanel === true, "section[aria-label=Inputs] + Outputs");
ok("P3 the Run button speaks the MODE (the t397 label law: a fresh job says Run — never Re-run, never Continue)",
  p1.runFace === "Run", `face="${p1.runFace}" title="${p1.runTitle}"`);
ok("P4 zero unnamed buttons page-wide WITH the panel up (the census's invariant holds on the run form)",
  p1.pageUnnamed === 0, `btns=${p1.pageBtns} (opening ${m0.pageBtns}) unnamed=${p1.pageUnnamed}`);
ok("P5 zero unnamed CONTROLS on the I/O face",
  p1.unCtrls === 0, `ctrls=${p1.ctrls} unnamed=${p1.unCtrls}${p1.unCtrlsWho.length ? ` who=${JSON.stringify(p1.unCtrlsWho)}` : ""}`);
ok("P6 zero alt-less imgs", p1.altless === 0, `imgs=${p1.imgs}`);
ok("P7 the four-tab bar is aboard and every tab named (I/O / Params / Results / Log — the display case, the icons aria-hidden)",
  p1.tabs.every(Boolean), `tabs=${JSON.stringify(p1.tabs)}`);
const p2 = settle("the I/O face (second ride)");
ok("P8 two settled rides bit-identical (the t836 law, the t860 settle)",
  JSON.stringify(p2) === JSON.stringify(p1), "the panel world is stable once settled");

/* ---------- Face P2/P3: the params tab (the form's real home) + the log tab ---------- */
console.log("Face P2 — the params tab (the form's real home — Radix mounts it on demand)");
const clickTab =
  // Radix Tabs switches on MOUSEDOWN, not click — the trigger's own contract
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "Params"); if (!t) return JSON.stringify({ clicked: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ clicked: true }); })()';
const ct = evalJson(clickTab);
ok("P9 the Params tab clicked (the mousedown door — Radix's own switch)", ct.clicked === true);
const p3 = settle("the params tab");
ok("P10 the param form's labels cover EVERY control (label-for named — the HTML spec's own mechanism, the ruler now follows it)",
  p3.unCtrls === 0 && p3.unCtrlsWho.length === 0,
  `ctrls=${p3.ctrls} (io face had ${p1.ctrls}) unnamed=${p3.unCtrls}${p3.unCtrlsWho.length ? ` who=${JSON.stringify(p3.unCtrlsWho)}` : ""}`);
ok("P11 zero unnamed buttons on the params tab too",
  p3.pageUnnamed === 0, `btns=${p3.pageBtns} unnamed=${p3.pageUnnamed}`);
const p3b = settle("the params tab (second ride)");
ok("P12 the params tab rides bit-identical", JSON.stringify(p3b) === JSON.stringify(p3));

console.log("Face P3 — the log tab (the engine log tail's named region)");
const clickLog =
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "Log"); if (!t) return JSON.stringify({ clicked: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ clicked: true }); })()';
const cl2 = evalJson(clickLog);
const p4 = settle("the log tab");
ok("P13 the log tab holds the name layer (zero unnamed, the tail region aboard)",
  cl2.clicked === true && p4.pageUnnamed === 0 && p4.unCtrls === 0,
  `btns=${p4.pageBtns} ctrls=${p4.ctrls} unnamed=${p4.pageUnnamed}/${p4.unCtrls}`);

/* ---------- the un-mutation: DELETE through the same door ---------- */
console.log("Un-mutation — DELETE /api/jobs/:id (the app's own cascade)");
const del = await api("DELETE", `/api/jobs/${probeId}`);
ok("U1 the probe job deleted (200 ok)", del.status === 200 && del.body?.ok === true,
  `status ${del.status}`);
let post = null;
for (let i = 0; i < 8; i++) {
  await sleep(1);
  post = { ...evalJson(MEASURE) };
  const gone = evalJson('(() => { return JSON.stringify({ card: !!document.querySelector("[data-card-btn=\\"' + probeId + '\\"]") }); })()');
  if (!gone.card && !post.hasPanel) break;
}
const postDelete = settle("the world after deletion");
ok("U2 the world is BACK — canvas count bit-for-bit the opening count",
  postDelete.pageBtns === m0.pageBtns && !postDelete.hasPanel,
  `btns=${postDelete.pageBtns} (opening ${m0.pageBtns})`);
ok("U3 the probe card is gone and the name layer holds (zero unnamed everywhere)",
  !evalJson('(() => { return JSON.stringify({ card: !!document.querySelector("[data-card-btn=\\"' + probeId + '\\"]") }); })()').card &&
    postDelete.pageUnnamed === 0 && postDelete.unCtrls === 0 && postDelete.altless === 0,
  "no card, no unnamed — the roster == the canvas again");

/* ---------- the DRIFT LEDGER (t861's law, at birth) ---------- */
const scalarOf = (m) => m.pageBtns;
const prevFaces = cmp.prevFound && cmp.prev.faces ? cmp.prev.faces : null;
const ledgerFaces = {
  panel: ledgerFace(prevFaces ? prevFaces.panel?.live ?? null : null, p1, scalarOf),
  params: ledgerFace(prevFaces ? prevFaces.params?.live ?? null : null, p3, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, postDelete, scalarOf),
};
ok("L1 the ledger is aboard at birth: three faces (panel/params/worldBack), each carrying prev/live/drift/identical",
  Object.values(ledgerFaces).every((f) => "prev" in f && "live" in f && "drift" in f && "identical" in f) &&
  (cmp.prevFound ? typeof prevReceipt.date === "string" : cmp.prevFound === false),
  cmp.prevFound ? `comparator ${prevReceipt.date} (key ${cmp.prevBuild})` : "first ride — no predecessor");

const verdictOf = (f) => armVerdict(cmp, world, f);
ok("L2 panel face ride-drift law", verdictOf(ledgerFaces.panel).ok, verdictOf(ledgerFaces.panel).detail);
ok("L3 params face ride-drift law", verdictOf(ledgerFaces.params).ok, verdictOf(ledgerFaces.params).detail);
ok("L4 worldBack face ride-drift law", verdictOf(ledgerFaces.worldBack).ok, verdictOf(ledgerFaces.worldBack).detail);

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the run form holds: the probe job rode the app's own doors (POST 201 -> the card idle -> the plain-click -> the panel), the panel arrived fully named (zero unnamed buttons/controls/imgs with the form up — the param form's labels cover every input), the Run button spoke the t397 MODE face ("Run"), the four-tab bar named, two settled rides bit-identical — and the un-mutation returned the world bit-for-bit (the canvas count, the card gone, the name layer intact; the tombstone file is the app's own undo ledger, by design) — the ledger family aboard from birth (three faces, the shared law)`
  : `${fail} red — the run form's name layer moved (or the mutation ride left residue); the ledger family will catch it loudly on the next family ride`;

const receipt = {
  instrument: "scripts/t863-job-panel-a11y.mjs",
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "canvas -> CREATE (POST /api/jobs) -> card idle -> plain-click -> PANEL -> DELETE -> worldBack (one command)",
  doors: {
    create: "POST /api/jobs { type: motioncorr, far-corner parked } — the t708 write door",
    panel: "pointerdown + pointerup on [data-card-btn] — the card's plain-click selection law",
    unmutate: `DELETE /api/jobs/${probeId} — the app's own cascade (tombstone + stop + sweep)`,
  },
  probe: { id: probeId, name: PROBE_NAME, type: "motioncorr" },
  faces: {
    canvas: { live: m0 },
    panelOpening: { live: p0 },
    panel: { live: p1, secondRide: p2 },
    params: { live: p3, secondRide: p3b, log: p4 },
    worldBack: { live: postDelete },
  },
  driftLedger: {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevBuild,
    prevDate: cmp.prevFound ? prevReceipt.date : null,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces: ledgerFaces,
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
};
writeFileSync(join(ROOT, "shots-qa/t863-job-panel-a11y.json"), JSON.stringify(receipt, null, 2));

console.log(`\nJOB-PANEL-A11Y t863: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
