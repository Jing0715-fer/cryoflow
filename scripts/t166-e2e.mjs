// t166 — THE RECESSION LADDER (Task 166).
//
// Before the ladder the product's "not the story" depths were scattered
// literals tuned in place: minimap chips recessed at 0.13 while the
// compare dialog's non-highlighted curves recessed at 0.15 — the SAME
// semantic ("far backstage") at two different depths by accident, not
// design. Spotlight cards sat at 0.28, receding wires at 0.32, and no
// surface could see the grammar they composed. Task 166 collapses all
// of it into ONE named ladder in globals.css:
//
//   ghost    0.06  erased — decorative minimap wires under a focus lens
//   whisper  0.15  far backstage — compare curves + minimap chips (unified)
//   recede   0.28  peripheral cards — spotlight deep / find misses
//   wire     0.32  receding wires (a 2px stroke dies at 0.28 on the dark
//                  canvas — wires keep one notch more ink than cards)
//   murmur   0.62  context — the spotlight 1-hop tier
//   (+ grayscale companions --dim-gray-deep 0.75 / --dim-gray-soft 0.35)
//
// The probe pins BOTH layers of the contract:
//   X  source oracles — the tokens defined once; every consumer rides a
//      var() (spotlight classes, edges-layer inline style, the compare
//      dialog's style-borne strokeOpacity, the minimap's ladder classes);
//      the old literals are GONE from the consumer files (a literal that
//      survives beside the token is a second source of truth)
//   R  runtime — every rung RESOLVES to its number: :root tokens, card
//      tiers by computed opacity against the LIVE graph partition, wire
//      story law, minimap status ink attribute-borne with computed ==
//      attribute while no lens owns the map
//   Z  cleanup (note removed, lens off, roster intact) + strict console
//
// Mechanics carried from t164: must() throws THIS instant (evidence is
// never destroyed by a running Z phase); expected tiers are computed from
// the REAL graph — the world's jobs are all "unknown ids"; each DOM read
// is ONE evaluate snapshot.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const read = (p) => readFileSync(`${ROOT}/${p}`, "utf8");
const css = read("src/app/globals.css");
const edgeSrc = read("src/components/workflow/edges-layer.tsx");
const dialogSrc = read("src/components/workflow/results/fsc-compare-dialog.tsx");
const mmSrc = read("src/components/workflow/canvas-minimap.tsx");

let checks = 0;
let failed = null;
let J = null; // hoisted — the finally cleanup must not hit a TDZ
let lensOn = false;
const must = (cond, msg) => {
  checks++;
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    if (failed == null) failed = msg;
    throw new Error(`t166: ${msg}`); // THIS instant
  }
  console.log(`  ok: ${msg}`);
};

const api = async (path, body) => {
  const r = await fetch(BASE + path, body
    ? { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  if (!r.ok) throw new Error(`t166: ${path} → ${r.status}`);
  return r.json();
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  // ---------------- S: seed + live-graph expectations ----------------
  console.log("== S: seed one judged card, compute the tier partition from the live graph ==");
  const jobs0 = (await api("/api/jobs")).jobs ?? [];
  must(jobs0.length > 0, `world has jobs (${jobs0.length})`);
  const strays = jobs0.filter((j) => j.note || (j.params?.classNotes && j.params.classNotes !== "{}"));
  for (const s of strays) await api(`/api/jobs/${s.id}`, { note: "", params: { classNotes: "{}" } });
  if (strays.length) console.log(`  (normalized ${strays.length} stray judgment(s))`);

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-job]", { timeout: 20000 });
  await page.waitForTimeout(600);

  const visible = await page.evaluate(() =>
    [...document.querySelectorAll("[data-job]")].map((el) => el.getAttribute("data-job")));
  must(visible.length >= 10, `canvas shows the workspace roster (${visible.length} cards)`);

  const edges0 = (await api("/api/edges")).edges ?? [];
  must(edges0.length > 0, `graph has edges (${edges0.length})`);
  const adj = new Map(visible.map((id) => [id, new Set()]));
  for (const e of edges0) {
    if (!adj.has(e.fromJobId) || !adj.has(e.toJobId)) continue; // both endpoints must render
    adj.get(e.fromJobId).add(e.toJobId);
    adj.get(e.toJobId).add(e.fromJobId);
  }
  // mid-graph seed: has neighbors on BOTH sides AND a visible strict-2-hop node
  for (const id of visible) {
    const nb = adj.get(id);
    if (!nb || nb.size < 2) continue;
    const twoHop = new Set();
    for (const n of nb) for (const m of adj.get(n) ?? []) if (m !== id && !nb.has(m)) twoHop.add(m);
    if (twoHop.size >= 1) { J = id; break; }
  }
  must(J != null, "mid-graph judged seed found (in- AND out-degree, visible 2-hop)");
  await api(`/api/jobs/${J}`, { note: "t166 ladder seed" });
  console.log(`  seeded note on ${J}`);
  // the header count rides the poll tick (1.2s/6s) — read EVENTUALLY
  let hdrOk = false;
  for (let i = 0; i < 16 && !hdrOk; i++) {
    await page.waitForTimeout(500);
    hdrOk = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /noted/i.test(x.textContent || ""));
      return b && !b.disabled && (b.textContent ?? "").includes("1");
    });
  }
  must(hdrOk, "header spotlight chip enables at 1 noted");

  // ---------------- X: source oracles — the ladder is ONE table ----------------
  console.log("== X: source oracles ==");
  must(/--dim-ghost:\s*0\.06/.test(css) && /--dim-whisper:\s*0\.15/.test(css) &&
       /--dim-recede:\s*0\.28/.test(css) && /--dim-wire:\s*0\.32/.test(css) &&
       /--dim-murmur:\s*0\.62/.test(css),
    "CSS: the five rungs defined once (ghost 0.06 / whisper 0.15 / recede 0.28 / wire 0.32 / murmur 0.62)");
  must(/--dim-gray-deep:\s*0\.75/.test(css) && /--dim-gray-soft:\s*0\.35/.test(css),
    "CSS: grayscale companions defined (deep 0.75 / soft 0.35)");
  must((css.match(/--dim-whisper:/g) || []).length === 1 && (css.match(/--dim-recede:/g) || []).length === 1,
    "CSS: each rung is DEFINED exactly once (a second definition is a second truth)");
  must(/THE RECESSION LADDER \(Task 166\)/.test(css) && /ghost/.test(css) && /whisper/.test(css) &&
       /murmur/.test(css) && /recede/.test(css) && /wire/.test(css),
    "CSS: the ladder carries its doctrine comment (a token without a story is a magic number)");
  must(/\.note-spotlight-dim\s*\{[^}]*opacity:\s*var\(--dim-recede\)/.test(css) &&
       /\.note-spotlight-dim\s*\{[^}]*grayscale\(var\(--dim-gray-deep\)\)/.test(css),
    "CSS: spotlight deep rides recede + gray-deep");
  must(/\.note-spotlight-context\s*\{[^}]*opacity:\s*var\(--dim-murmur\)/.test(css) &&
       /\.note-spotlight-context\s*\{[^}]*grayscale\(var\(--dim-gray-soft\)\)/.test(css),
    "CSS: spotlight context rides murmur + gray-soft");
  must(/\.mm-chip-dim\s*\{[^}]*opacity:\s*var\(--dim-whisper\)/.test(css),
    "CSS: minimap chip dim rides whisper (unified with the compare curves)");
  must(/\.mm-edge-dim\s*\{[^}]*opacity:\s*var\(--dim-ghost\)/.test(css),
    "CSS: minimap edge dim rides ghost");
  must(edgeSrc.includes('opacity: dimmed ? "var(--dim-wire)" : 1'),
    "edges-layer: receding wires ride --dim-wire through inline style");
  must(dialogSrc.includes('strokeOpacity: "var(--dim-whisper)"'),
    "compare dialog: non-highlighted curves ride --dim-whisper through style (attributes cannot var())");
  must(mmSrc.includes('(dimmed || findDim) && "mm-chip-dim"') && mmSrc.includes('dim && "mm-edge-dim"'),
    "minimap: the dim states gate the ladder classes");
  must(mmSrc.includes('opacity={j.status === "idle" ? 0.55 : 0.9}') && mmSrc.includes("opacity={0.25}"),
    "minimap: STATUS ink stays attribute-borne (idle 0.55 / active 0.9; base wire 0.25)");
  must(!/0\.13/.test(mmSrc) && !/0\.32/.test(edgeSrc) && !/0\.15/.test(dialogSrc),
    "the old scattered literals are GONE from the consumers (a surviving literal is a second truth)");

  // ---------------- B: lens OFF baseline — full ink everywhere ----------------
  console.log("== B: lens OFF baseline ==");
  const off = await page.evaluate(() => ({
    cardOps: [...document.querySelectorAll("[data-job]")].map((el) => getComputedStyle(el).opacity),
    edgeOps: [...document.querySelectorAll("g[data-edge-id]")].map((g) => getComputedStyle(g).opacity),
    mmChips: document.querySelectorAll(".mm-chip-dim").length,
    mmEdges: document.querySelectorAll(".mm-edge-dim").length,
  }));
  must(off.cardOps.length === visible.length && off.cardOps.every((o) => o === "1"),
    `lens OFF: every card at full ink (${off.cardOps.length} cards)`);
  must(off.edgeOps.length > 0 && off.edgeOps.every((o) => o === "1"),
    `lens OFF: every wire at full ink (${off.edgeOps.length} wires)`);

  // ---------------- C: lens ON — every rung RESOLVES to its number ----------------
  console.log("== C: lens ON — the ladder resolves ==");
  await page.keyboard.press("n");
  lensOn = true;
  await page.waitForTimeout(550); // 200ms transition + settle

  // expected partition from the live graph: judged / 1-hop / rest
  const expected = new Map(); // id -> { rung: "judged"|"murmur"|"recede", op: "1"|"0.62"|"0.28" }
  for (const id of visible) {
    if (id === J) expected.set(id, { rung: "judged", op: "1" });
    else if (adj.get(J)?.has(id)) expected.set(id, { rung: "murmur", op: "0.62" });
    else expected.set(id, { rung: "recede", op: "0.28" });
  }
  must([...expected.values()].filter((v) => v.rung === "murmur").length >= 1,
    "the seed's 1-hop radius is non-empty (the context tier has subjects)");

  // ONE snapshot; a mismatching card names both sides (a wrong rung is a
  // wrong NUMBER, not a wrong class — computed style is the verdict)
  let tierRead = null;
  for (let attempt = 0; attempt < 3 && (tierRead === null || !tierRead.ok); attempt++) {
    if (attempt > 0) await page.waitForTimeout(400); // mid-flight transition? re-read
    tierRead = await page.evaluate((exp) => {
      const bad = [];
      for (const [id, wantOp] of Object.entries(exp)) {
        const el = document.querySelector(`[data-job="${id}"]`);
        if (!el) { bad.push(`${id}: GONE`); continue; }
        const got = getComputedStyle(el).opacity;
        if (got !== wantOp) bad.push(`${id}: got ${got}, want ${wantOp}`);
      }
      return { ok: bad.length === 0, bad };
    }, Object.fromEntries([...expected].map(([k, v]) => [k, v.op])));
  }
  must(tierRead && tierRead.ok, `every visible card sits at its rung's resolved opacity (${tierRead?.bad?.length ?? 0} violations${tierRead?.bad?.length ? ": " + tierRead.bad.slice(0, 3).join("; ") : ""})`);

  // the class partition still agrees with the numbers (arrays cross the
  // evaluate boundary — page.evaluate does not serialize Sets, the t164
  // scar; the Set is built on the node side)
  const cls = await page.evaluate(() => ({
    deep: [...document.querySelectorAll(".note-spotlight-dim")].map((el) => el.getAttribute("data-job")),
    ctx: [...document.querySelectorAll('[data-spotlight-context="true"]')].map((el) => el.getAttribute("data-job")),
  }));
  const ctxSet = new Set(cls.ctx);
  const deepSet = new Set(cls.deep);
  must(ctxSet.size === [...expected.values()].filter((v) => v.rung === "murmur").length,
    `context attr count == graph 1-hop count (${ctxSet.size})`);
  must(deepSet.size === [...expected.values()].filter((v) => v.rung === "recede").length,
    `deep class count == beyond-radius count (${deepSet.size})`);

  // wire law at resolved values: story 1, receding 0.32 (edge map via API —
  // the DOM carries only the rendered order, not the endpoints)
  const freshEdges = (await api("/api/edges")).edges ?? edges0;
  const edgeById = new Map(freshEdges.map((e) => [e.id, e]));
  const wireOps = await page.evaluate(() =>
    [...document.querySelectorAll("g[data-edge-id]")].map((g) => ({
      id: g.getAttribute("data-edge-id"), o: getComputedStyle(g).opacity,
    })));
  let storyN = 0, storyBad = null, recedeBad = null;
  for (const w of wireOps) {
    const e = edgeById.get(w.id);
    if (!e || !adj.has(e.fromJobId) || !adj.has(e.toJobId)) continue;
    const story = e.fromJobId === J || e.toJobId === J;
    if (story) { storyN++; if (w.o !== "1" && storyBad == null) storyBad = w.o; }
    else if (w.o !== "0.32" && recedeBad == null) recedeBad = w.o;
  }
  must(storyN > 0 && storyBad == null, `story wires touching the judged card stay at 1 (${storyN} wires${storyBad ? `, bad ${storyBad}` : ""})`);
  must(recedeBad == null, `receding wires sit at the --dim-wire rung (0.32${recedeBad ? `, bad ${recedeBad}` : ""})`);

  // the spotlight lens does NOT own the minimap: no ladder dim class on
  // the map while only the lens is active (each lens dims its own stage)
  const mmDuringLens = await page.evaluate(() => ({
    chips: document.querySelectorAll(".mm-chip-dim").length,
    edges: document.querySelectorAll(".mm-edge-dim").length,
    chipAttr: document.querySelector('[data-canvas-ui="minimap-dot"]')?.getAttribute("opacity") ?? null,
  }));
  must(mmDuringLens.chips === 0 && mmDuringLens.edges === 0,
    "the spotlight lens never dims the minimap (each lens owns its own stage)");

  // ---------------- D: minimap inks — attribute-borne, computed agrees ----------------
  console.log("== D: minimap status ink (attribute) vs computed ==");
  const mmInk = await page.evaluate(() => {
    const dots = [...document.querySelectorAll('[data-canvas-ui="minimap-dot"]')];
    const idle = dots.find((d) => d.getAttribute("opacity") === "0.55");
    const active = dots.find((d) => d.getAttribute("opacity") === "0.9");
    return {
      idle: idle ? { attr: idle.getAttribute("opacity"), cso: getComputedStyle(idle).opacity } : null,
      active: active ? { attr: active.getAttribute("opacity"), cso: getComputedStyle(active).opacity } : null,
      line: (() => {
        const l = document.querySelector('[data-canvas-ui="minimap-svg"] line');
        return l ? { attr: l.getAttribute("opacity"), cso: getComputedStyle(l).opacity } : null;
      })(),
    };
  });
  must(mmInk.idle != null && mmInk.idle.attr === "0.55" && mmInk.idle.cso === "0.55",
    "minimap idle chip: status ink attribute 0.55, computed agrees (no dim class)");
  must(mmInk.active != null && mmInk.active.attr === "0.9" && mmInk.active.cso === "0.9",
    "minimap active chip: status ink attribute 0.9, computed agrees");
  must(mmInk.line != null && mmInk.line.attr === "0.25" && mmInk.line.cso === "0.25",
    "minimap wire: base ink attribute 0.25, computed agrees (ghost only under a sel/find lens — t118/t136 own that)");

  // ---------------- E: lens OFF — the ladder retires cleanly ----------------
  console.log("== E: lens OFF restore ==");
  await page.keyboard.press("n");
  lensOn = false;
  await page.waitForTimeout(550);
  const off2 = await page.evaluate(() => ({
    cardOps: [...document.querySelectorAll("[data-job]")].map((el) => getComputedStyle(el).opacity),
    edgeOps: [...document.querySelectorAll("g[data-edge-id]")].map((g) => getComputedStyle(g).opacity),
  }));
  must(off2.cardOps.every((o) => o === "1") && off2.edgeOps.every((o) => o === "1"),
    "lens OFF: cards and wires back at full ink");
} catch (e) {
  if (failed == null) failed = `uncaught: ${e.message}`;
  console.error(`  ERROR: ${e.message}`);
} finally {
  const problems = [];
  if (failed) problems.push(failed);
  try { if (J != null) { await api(`/api/jobs/${J}`, { note: "" }); console.log("  cleanup: seed note removed"); } } catch (e2) { problems.push(`note cleanup: ${e2.message}`); }
  try { if (lensOn) { await page.keyboard.press("n"); console.log("  cleanup: lens off"); } } catch (e3) { problems.push(`lens cleanup: ${e3.message}`); }
  try { await browser.close(); } catch (e4) { problems.push(`browser close: ${e4.message}`); }
  if (problems.length) {
    console.error(`T166 FAILED (${checks} assertions): ${problems.join(" | ")}`);
    process.exit(1);
  }
  if (consoleErrors.length) {
    console.error(`T166 FAILED (${checks} assertions): console errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
    process.exit(1);
  }
  console.log(`T166 ALL PASS (${checks} assertions)`);
}
