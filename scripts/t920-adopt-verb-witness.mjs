#!/usr/bin/env node
/**
 * t920 — the A/B adopt verb's FIRST FIRE from the dialog. The t919 ride
 * proved every face AROUND the verb: enabled on the wired host (1
 * downstream wire), disabled on the bare one, disabled with the
 * same-run reason. But the verb itself was never clicked — adoption is
 * a GRAPH MUTATION (adopt-branch.ts: "run A's downstream jobs stop
 * consuming A and start consuming B") and its fire has never been
 * witnessed live. This witness rides the whole arc:
 *
 *   A   the data + edge plane — both /classes routes answer the
 *       (p*7+it)%K+1 law; /api/edges holds EXACTLY ONE wire leaving the
 *       K=4 host (select2d) and none leaving the K=6 (the t919 faces'
 *       precondition, re-proved on this window's world).
 *   F   THE FIRE — the all-lost face (0 gained / 4 lost / 0 held,
 *       median −8.3%), the adoption contract line, the verb ENABLED
 *       with its count badge, then the click: the dialog CLOSES (the
 *       verb's own close is a one-floor elevator — the inspector
 *       beneath stays; Escape is the whole-stack law, the verb is not),
 *       the receipt toast speaks (title "Downstream adopted by B",
 *       detail "1 downstream wire re-wired from A to B · <child> now
 *       consumes B · their current results stay until re-run"), the
 *       edges API truth moves (old wire GONE, new K6→select2d wire with
 *       the SAME ports), and the CANVAS DRAWS IT (g[data-edge-id] — the
 *       store's t444 refetch pins UI truth to server truth).
 *   E   the CONSUMER'S OWN FACE — the select2d gallery finds its
 *       upstream THROUGH THE EDGES (class-gallery.tsx: incoming edges
 *       whose source is a class2d), so the adopt changed what the
 *       consumer EATS: the gallery now renders SIX class cards (was
 *       four) without anything re-running. The mutation is not a line
 *       on a canvas; it is a data source switch, live.
 *   P   persistence — a FRESH page load still draws the K6→select2d
 *       wire (server truth; the DB row moved).
 *   U   THE UN-WIRE (restore prelude) — DELETE the new wire, POST the
 *       ORIGINAL edge back byte-exact (original id + ports), the
 *       gallery eats K=4 again (four cards), the canvas draws the
 *       original g[data-edge-id]. After U the t919 law holds again:
 *       B has no downstream, so the two-manifest remove order
 *       (t919 remove FIRST, then t916 remove) is safe.
 *
 * World law: the ride MUTATES the graph (the t919 ride was a reading —
 * this one is not), so the un-wire is part of the witness, and the
 * mint removes run AFTER it from the shell. Nothing is created or
 * deleted by the fire itself: job count unchanged end to end.
 *
 *   node scripts/t920-adopt-verb-witness.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const T916 = path.join(ROOT, "data", "t916-class2d-mint.json");
const T919 = path.join(ROOT, "data", "t919-class2d-b-mint.json");
const RECEIPT = "shots-qa/t920-adopt-verb-witness.json";

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
  // the clamped-point law (t914 → t916 → t919): own at the ACTUAL point,
  // re-scoped per attempt; a click that hits a neighbor is refused.
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
const openInspector = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true
  );
  ok(`inspector open for "${name}"`, opened?.open === true);
  return opened;
};
const compareDlg = `[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('Paired per-class verdict'))`;
/** t916's law: the select2d card opens the JobPanel (aside or Sheet), whose
 *  header carries the TYPE WORDS ("Subset-selection"), NOT the job name —
 *  "witnessed live: the name never appears". The gallery is the parameter
 *  and lives in the Params tab. */
const openSelectPanel = async () => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${SEL_NAME}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${SEL_NAME}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const aside = [...document.querySelectorAll('aside')].find(a => (a.className || '').includes('border-l') && (a.textContent || '').includes('Subset-selection')); const sheet = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('Subset-selection')); return JSON.stringify({ aside: !!aside, sheet: !!sheet }); })()`,
    (v) => v.aside === true || v.sheet === true
  );
  ok(`the select2d JobPanel open (aside=${opened?.aside} sheet=${opened?.sheet})`, opened?.aside === true || opened?.sheet === true);
  const tabClicked = await realClick(`[...document.querySelectorAll('[role="tab"]')].find(t => (t.textContent || '').trim() === 'Params')`);
  ok("the panel's Params tab clicked (the gallery IS the parameter)", String(tabClicked).startsWith("clicked@"), String(tabClicked));
  return opened;
};
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
    // the door drifts while lazy chunks mount (t919's 60px law) — wait
    // for the door's center to hold STILL before clicking
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
    const neighbor = evalJson(`JSON.stringify({ heads: [...document.querySelectorAll('[role="dialog"] h2')].map(h => (h.textContent || '').trim()) })`);
    console.log(`  (attempt ${i + 1}: compare did not open; dialogs now: ${JSON.stringify(neighbor?.heads ?? [])})`);
    sh(`${AB} press Escape`); await sleep(800);
  }
  return "NEVER-OPEN";
};

/* ---- the replica brain: the lib's math on the ROUTE's own rows ---- */
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
    const delta = share(b) - share(a);
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

// ---- the ground truth -------------------------------------------------------
if (!existsSync(T916) || !existsSync(T919)) {
  console.log("FATAL: both mint manifests must exist (t916-class2d-mint.mjs mint, then t919-class2d-b-mint.mjs mint)");
  process.exit(2);
}
const m916 = JSON.parse(readFileSync(T916, "utf8"));
const m919 = JSON.parse(readFileSync(T919, "utf8"));
const A_NAME = m916.class2d.name;      // K=4, wired (select2d downstream)
const A_ID = m916.class2d.id;
const B_NAME = m919.class2dB.name;     // K=6, bare
const B_ID = m919.class2dB.id;
const SEL_NAME = m916.select2d.name;   // the consumer
const SEL_ID = m916.select2d.id;
console.log(`world: A="${A_NAME}" (K4, wired) · B="${B_NAME}" (K6, bare) · consumer="${SEL_NAME}"`);

const shApi = (url) => execSync(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
const classesOf = (id) => {
  const data = JSON.parse(shApi(`/api/jobs/${id}/classes`));
  return (data.classes ?? []).map((c) => ({ name: `Class ${String(c.cls).padStart(3, "0")}`, cls: c.cls, count: c.count, fraction: c.fraction }));
};

console.log("== band A: the data + edge plane ==");
const rowsA = classesOf(A_ID);
ok("A the K=4 route answers the law's map", JSON.stringify(Object.fromEntries(rowsA.map((r) => [r.cls, r.count]))) === JSON.stringify(m916.expect.perIter["2"]), JSON.stringify(rowsA.map((r) => [r.cls, r.count])));
const rowsB = classesOf(B_ID);
ok("A the K=6 route answers the law's map", JSON.stringify(Object.fromEntries(rowsB.map((r) => [r.cls, r.count]))) === JSON.stringify(m919.expect.perIter["2"]), JSON.stringify(rowsB.map((r) => [r.cls, r.count])));

// the all-lost replica (host K4), computed on the ROUTE's own rows
const lost = joinByName(rowsA, rowsB);
const lostD = deltasOf(lost.pairs);
const EXP_LOST = {
  improved: lostD.filter((d) => d.kind === "improved").length,
  regressed: lostD.filter((d) => d.kind === "regressed").length,
  tied: lostD.filter((d) => d.kind === "tied").length,
  median: fmtDelta(medianOf(lostD.map((d) => d.delta))),
};
ok(`A the replica: ${EXP_LOST.improved} gained / ${EXP_LOST.regressed} lost / ${EXP_LOST.tied} held, median ${EXP_LOST.median}`, EXP_LOST.improved === 0 && EXP_LOST.regressed === 4 && EXP_LOST.tied === 0, `median=${EXP_LOST.median}`);

const edgesNow = JSON.parse(shApi("/api/edges")).edges;
const origEdge = edgesNow.find((e) => e.fromJobId === A_ID && e.toJobId === SEL_ID);
ok("A EXACTLY ONE wire leaves the K=4 host (the select2d consumer)", !!origEdge && edgesNow.filter((e) => e.fromJobId === A_ID).length === 1, origEdge ? `${origEdge.id} ports=${origEdge.fromPort ?? "∅"}→${origEdge.toPort ?? "∅"}` : "MISSING");
ok("A no wire leaves the K=6 (the t919 faces' precondition, re-proved)", !edgesNow.some((e) => e.fromJobId === B_ID));
const jobsNow = JSON.parse(shApi("/api/jobs")).jobs.length;
ok("A the world carries 20 jobs (15 + the t916 chain + the K6)", jobsNow === 20, `${jobsNow}`);
const jobs0 = jobsNow;

/* =========================== band F: THE FIRE ============================ */
console.log("== band F: THE FIRE — the adopt verb's first click ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobs0 - 2, 30);
await settleCensus();
await openInspector(A_NAME);
const doorEffect = await openCompareUntil(A_NAME);
ok("F the compare dialog OPEN (click-until-effect)", String(doorEffect).startsWith("open@"), String(doorEffect));

const faceF = await poll(
  `(() => { const d = ${compareDlg}; if (!d) return JSON.stringify({}); return JSON.stringify({ t: d.textContent || '', runA: d.querySelector('[aria-label="Run A"]')?.textContent?.trim() ?? null, runB: d.querySelector('[aria-label="Run B"]')?.textContent?.trim() ?? null }); })()`,
  (v) => (v.t ?? "").includes("median"), 24, 750
);
ok(`F the all-LOST face (${EXP_LOST.improved} gained / ${EXP_LOST.regressed} lost / ${EXP_LOST.tied} held, median ${EXP_LOST.median}%)`, (faceF?.t ?? "").includes(`${EXP_LOST.improved} gained`) && (faceF?.t ?? "").includes(`${EXP_LOST.regressed} lost`) && (faceF?.t ?? "").includes(`median Δ ${EXP_LOST.median}%`));
ok("F Run A leads with the host (this run)", (faceF?.runA ?? "").includes(`${A_NAME} (this run)`), faceF?.runA ?? "");
ok("F Run B is the K=6 sibling", (faceF?.runB ?? "").includes(B_NAME), faceF?.runB ?? "");
ok("F the adoption contract line speaks the plan (1 downstream job, results stay)", (faceF?.t ?? "").includes(`Adoption re-wires ${A_NAME}'s 1 downstream job to consume ${B_NAME} — their current results stay until re-run`));

const verbF = await poll(
  `(() => { const d = ${compareDlg}; const b = d?.querySelector('[data-testid="adopt-downstream"]'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null, aria: b?.getAttribute('aria-label') ?? null, label: b?.textContent?.trim() ?? null }); })()`,
  (v) => v.present === true, 24, 750
);
ok("F the plain adopt verb ENABLED (the host's downstream is real)", verbF?.present === true && verbF?.disabled === false, verbF?.aria ?? "");
ok("F the verb's aria names the re-wire plan (1 of A's downstream jobs)", (verbF?.aria ?? "").includes(`Continue downstream from ${B_NAME} — re-wires 1 of ${A_NAME}'s downstream jobs`), verbF?.aria ?? "");
ok("F the label carries the count badge (1)", (verbF?.label ?? "").includes("(1)"), verbF?.label ?? "");

// THE FIRE — click the verb
const fireClick = await realClick(`${compareDlg}?.querySelector('[data-testid="adopt-downstream"]')`);
ok("F THE VERB CLICKED (own at the actual point)", String(fireClick).startsWith("clicked@"), String(fireClick));

// the verb's own close: one floor (the compare), the inspector beneath stays
const closed = await poll(
  `JSON.stringify({ compare: !!${compareDlg}, dialogs: document.querySelectorAll('[role="dialog"]').length, insp: [...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${A_NAME}')) })`,
  (v) => v.compare === false, 16, 500
);
ok("F the compare dialog CLOSED (the verb's finally fired)", closed?.compare === false);
ok("F the verb's close is a ONE-FLOOR elevator — the inspector beneath stays open", closed?.insp === true && (closed?.dialogs ?? 0) >= 1, `dialogs=${closed?.dialogs}`);

// the receipt toast — it fires BEFORE the dialog's finally, so it is up now
const toastF = await poll(
  `JSON.stringify({ toasts: [...document.querySelectorAll('[role="status"]')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? null, text: (t.textContent || '').trim() })) })`,
  (v) => (v.toasts ?? []).some((t) => (t.text || "").includes("Downstream adopted by")), 14, 350
);
const fired = (toastF?.toasts ?? []).find((t) => (t.text || "").includes("Downstream adopted by"));
ok("F the receipt toast SPOKE (Downstream adopted by the K6)", !!fired, fired ? fired.text.slice(0, 160) : "MISSED");
if (fired) {
  ok("F the toast's detail: 1 downstream wire re-wired from A to B", fired.text.includes(`1 downstream wire re-wired from ${A_NAME} to ${B_NAME}`));
  ok("F the toast names the consumer and the stay-until-re-run law", fired.text.includes(`${SEL_NAME} now consumes ${B_NAME}`) && fired.text.includes("their current results stay until re-run"));
}

// the edges API truth — the old wire GONE, the new wire with the SAME ports
let newEdge = null;
for (let i = 0; i < 12; i++) {
  const edges = JSON.parse(shApi("/api/edges")).edges;
  newEdge = edges.find((e) => e.fromJobId === B_ID && e.toJobId === SEL_ID) ?? null;
  const oldGone = !edges.some((e) => e.id === origEdge.id || e.fromJobId === A_ID);
  if (newEdge && oldGone) break;
  await sleep(500);
}
ok("F the OLD wire is GONE server-side (delete half of the POST-first contract)", !JSON.parse(shApi("/api/edges")).edges.some((e) => e.id === origEdge.id || e.fromJobId === A_ID));
ok("F the NEW wire K6→select2d EXISTS server-side", !!newEdge, newEdge ? newEdge.id : "MISSING");
ok("F the new wire KEPT the ports (the port law: wires keep their ports)", !!newEdge && (newEdge.fromPort ?? null) === (origEdge.fromPort ?? null) && (newEdge.toPort ?? null) === (origEdge.toPort ?? null), newEdge ? `${newEdge.fromPort ?? "∅"}→${newEdge.toPort ?? "∅"}` : "");
const NEW_ID = newEdge?.id ?? null;
const ORIG_ID = origEdge.id;

// the CANVAS DRAWS IT — the store's t444 refetch pins UI truth to server truth
const canvasF = await poll(
  `JSON.stringify({ newEdge: !!document.querySelector('g[data-edge-id="${NEW_ID}"]'), oldEdge: !!document.querySelector('g[data-edge-id="${ORIG_ID}"]') })`,
  (v) => v.newEdge === true && v.oldEdge === false, 16, 500
);
ok("F the canvas DRAWS the new wiring (g[data-edge-id] of the K6→select2d wire)", canvasF?.newEdge === true);
ok("F the canvas RELEASED the old wire", canvasF?.oldEdge === false);
const jobsF = JSON.parse(shApi("/api/jobs")).jobs.length;
ok("F the fire created nothing and deleted nothing (a re-wiring, not a mutation of jobs)", jobsF === jobs0, `${jobsF} vs ${jobs0}`);

/* ================ band E: the consumer's own face ======================== */
console.log("== band E: the select2d gallery now EATS the K6 ==");
sh(`${AB} press Escape`); await sleep(700);
// the stack reset is asserted (with retries) — an open overlay would eat
// every subsequent card click (the elementFromPoint law)
let stackE = 0;
for (let i = 0; i < 3; i++) {
  stackE = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="dialog"]').length })`)?.n ?? -1;
  if (stackE === 0) break;
  sh(`${AB} press Escape`); await sleep(700);
}
ok("E the stack reset before the panel ride (one Escape closes the whole stack)", stackE === 0, `dialogs=${stackE}`);
await settleCensus();
await openSelectPanel();
const galleryE = await poll(
  `(() => { const s = document.querySelector('section[aria-label="Class selection gallery"]'); if (!s) return JSON.stringify({ found: false }); const grid = s.querySelector('[data-canvas-ui="class-grid"]'); const cards = grid ? [...grid.querySelectorAll('button')].filter(b => /^Toggle class/.test(b.getAttribute('aria-label') ?? '')).length : 0; const imgs = [...s.querySelectorAll('img')]; return JSON.stringify({ found: true, cards, decoded: imgs.filter(i => i.complete && i.naturalWidth > 0).length, pours: !!s.querySelector('[data-testid="class-gallery-pours-class2d"]') }); })()`,
  (v) => v.found === true && v.cards === 6 && v.decoded >= 2, 30, 750
);
ok("E the gallery mounts from the NEW upstream (follows the wire)", galleryE?.found === true);
ok("E SIX class cards — the consumer reads the K=6's /classes (was four)", galleryE?.cards === 6, `cards=${galleryE?.cards}`);
ok("E the thumbnails decoded through the re-pointed source", (galleryE?.decoded ?? 0) >= 2, `decoded=${galleryE?.decoded}`);
ok("E the pours chip still names the class2d dialect (the source type followed too)", galleryE?.pours === true);
sh(`${AB} press Escape`); await sleep(500);

/* ============== band P: persistence across a fresh page ================== */
console.log("== band P: a fresh page still draws the adopted wiring ==");
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobs0 - 2, 30);
await settleCensus();
const canvasP = await poll(
  `JSON.stringify({ newEdge: !!document.querySelector('g[data-edge-id="${NEW_ID}"]'), oldEdge: !!document.querySelector('g[data-edge-id="${ORIG_ID}"]') })`,
  (v) => v.newEdge === true, 20, 600
);
ok("P the fresh page DRAWS the K6→select2d wire (server truth moved)", canvasP?.newEdge === true);
ok("P the old wire still absent after reload", canvasP?.oldEdge === false);
const apiP = JSON.parse(shApi("/api/edges")).edges;
ok("P the API agrees: no K4→select2d, one K6→select2d", !apiP.some((e) => e.fromJobId === A_ID) && apiP.some((e) => e.id === NEW_ID && e.fromJobId === B_ID));

/* ==================== band U: THE UN-WIRE (restore) ====================== */
console.log("== band U: the un-wire — restore prelude for the remove order ==");
const del = sh(`curl -s -X DELETE -H "Origin: ${BASE}" "${BASE}/api/edges/${NEW_ID}"`);
const postBody = JSON.stringify({ id: ORIG_ID, fromJobId: A_ID, toJobId: SEL_ID, fromPort: origEdge.fromPort ?? undefined, toPort: origEdge.toPort ?? undefined });
const restored = execSync(
  `curl -s -X POST -H "Origin: ${BASE}" -H "Content-Type: application/json" -d '${postBody.replace(/'/g, `'\\''`)}' "${BASE}/api/edges"`,
  { encoding: "utf8", timeout: 60_000 },
);
let restoredOk = false;
try { restoredOk = !!JSON.parse(restored).edge; } catch { restoredOk = false; }
ok("U the DELETE of the new wire answered", !String(del).includes("error"), String(del).slice(0, 80));
ok("U the POST restored the ORIGINAL edge byte-exact (original id accepted)", restoredOk, restored.slice(0, 100));
const edgesU = JSON.parse(shApi("/api/edges")).edges;
ok("U the edge plane is back to the pre-fire truth (orig present, no K6→select2d)", edgesU.some((e) => e.id === ORIG_ID && e.fromJobId === A_ID && e.toJobId === SEL_ID) && !edgesU.some((e) => e.fromJobId === B_ID && e.toJobId === SEL_ID), `${edgesU.length} edges`);

// the canvas and the consumer follow the un-wire too
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobs0 - 2, 30);
await settleCensus();
const canvasU = await poll(
  `JSON.stringify({ orig: !!document.querySelector('g[data-edge-id="${ORIG_ID}"]'), newEdge: !!document.querySelector('g[data-edge-id="${NEW_ID}"]') })`,
  (v) => v.orig === true && v.newEdge === false, 20, 600
);
ok("U the canvas draws the ORIGINAL wiring again", canvasU?.orig === true && canvasU?.newEdge === false);
await openSelectPanel();
const galleryU = await poll(
  `(() => { const s = document.querySelector('section[aria-label="Class selection gallery"]'); if (!s) return JSON.stringify({ found: false }); const grid = s.querySelector('[data-canvas-ui="class-grid"]'); return JSON.stringify({ found: true, cards: grid ? [...grid.querySelectorAll('button')].filter(b => /^Toggle class/.test(b.getAttribute('aria-label') ?? '')).length : 0 }); })()`,
  (v) => v.found === true && v.cards === 4, 30, 750
);
ok("U the gallery EATS K=4 again (four cards) — the consumer's source followed the un-wire", galleryU?.cards === 4, `cards=${galleryU?.cards}`);
sh(`${AB} press Escape`); await sleep(400);

// world guard
const jobsU = JSON.parse(shApi("/api/jobs")).jobs.length;
ok("WORLD the ride ended where it began in job terms (the remove order law is safe again: B bare)", jobsU === jobs0, `${jobsU} vs ${jobs0}`);

const receiptDir = path.join(ROOT, "shots-qa");
mkdirSync(receiptDir, { recursive: true });
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({
  at: new Date().toISOString(),
  pass, fail,
  world: { A: A_NAME, B: B_NAME, consumer: SEL_NAME, jobs: jobs0 },
  fire: { origEdge: ORIG_ID, newEdge: NEW_ID, ports: { from: origEdge.fromPort ?? null, to: origEdge.toPort ?? null } },
}, null, 2));
console.log(`== t920 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail == (receipt: ${RECEIPT})`);
process.exit(fail === 0 ? 0 : 1);
