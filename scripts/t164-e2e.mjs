// t164 — Note spotlight CONTEXT RADIUS (Task 164).
//
// Task 75/83's lens was a binary flood: every unjudged card sank to the
// same deep dim. That kept the judged islands but erased WHERE they sit
// in the pipeline — a lit card with no lit neighbors reads as
// context-free. Task 164 turns the lens into a three-tier stage:
//
//   judged      full ink   — hasJudgment (job note OR class notes)
//   context     0.62/0.35  — ONE edge away from a judged card (either
//                            direction: what fed it AND what it fed)
//   peripheral  0.28/0.75  — beyond the 1-hop radius (the old deep dim)
//
// and gives wires the same law in edges-layer: a wire TOUCHING a judged
// card stays at full ink (it IS the story), wires between receding
// cards recede with them (the selection dim's exact grammar).
//
// Phases:
//   S  seed one judged card (mid-graph: in-degree AND out-degree, with a
//      visible distance-2 node for the radius oracle) via note PATCH;
//      expected tiers computed from the REAL graph (/api/jobs + /api/edges)
//   X  11 source oracles — CSS tier + print exemption, class gating,
//      both-direction adjacency, deep-dim exclusion, prop contract,
//      edges-layer union, store doc anchor
//   B  lens OFF baseline: zero context attrs, zero deep dims, edges at 1
//   C  CORE: lens ON — exact tier partition (context set == graph 1-hop,
//      deep dim == the rest, judged immune), the RADIUS oracle (a 2-hop
//      node must carry the DEEP dim, never context), story edges
//      (touches-judged → 1, else 0.32), header count still judged-only
//   D  composition: find lens over the spotlight — a find non-match takes
//      the deep dim EVEN IF adjacent to judged (deep beats context); a
//      find match is immune to the deep dim; Esc restores the tiers
//   E  lens OFF: full restore
//   F  print exemption: under print media emulation BOTH receding tiers
//      snap to full ink with transition:none (paper never dims)
//   Z  cleanup (note removed, lens off, roster restored) + strict console
//
// Engineering armor carried from t163: must throws THIS instant (evidence
// is never destroyed by a running Z phase — cleanup lives in finally);
// the world's jobs are all "unknown ids" so expected sets are computed
// from the LIVE graph, never hardcoded names; each DOM read is ONE
// evaluate (a single snapshot — the poller cannot tear it).

import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";
const read = (p) => readFileSync(`${ROOT}/${p}`, "utf8");
const css = read("src/app/globals.css");
const cardSrc = read("src/components/workflow/job-card.tsx");
const canvasSrc = read("src/components/workflow/canvas.tsx");
const edgeSrc = read("src/components/workflow/edges-layer.tsx");
const storeSrc = read("src/lib/store.ts");

let checks = 0;
let failed = null;
let J = null; // hoisted — the finally cleanup and verdict must not hit a TDZ
let jobs0 = null; //   when the try throws before S finished
let N1 = null, N2 = null;
const must = (cond, msg) => {
  checks++;
  if (!cond) {
    console.error(`  FAIL: ${msg}`);
    if (failed == null) failed = msg; // first failure is the verdict's headline
    throw new Error(`t164: ${msg}`); // THIS instant — a running Z phase destroys evidence
  }
  console.log(`  ok: ${msg}`);
};

const api = async (path, body) => {
  const r = await fetch(BASE + path, body
    ? { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  if (!r.ok) throw new Error(`t164: ${path} → ${r.status}`);
  return r.json();
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  // ---------------- S: seed ----------------
  console.log("== S: seed one judged card, compute expected tiers from the live graph ==");
  jobs0 = (await api("/api/jobs")).jobs ?? [];
  must(jobs0.length > 0, `world has jobs (${jobs0.length})`);
  // normalize stray judgments from earlier suites — the probe needs a
  // clean "zero judged" start so the seeded card is the ONLY judged one
  const strays = jobs0.filter((j) => j.note || (j.params?.classNotes && j.params.classNotes !== "{}"));
  for (const s of strays) await api(`/api/jobs/${s.id}`, { note: "", params: { classNotes: "{}" } });
  if (strays.length) console.log(`  (normalized ${strays.length} stray judgment(s))`);

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-job]", { timeout: 20000 });
  await page.waitForTimeout(600);

  const visible = await page.evaluate(() =>
    [...document.querySelectorAll("[data-job]")].map((el) => el.getAttribute("data-job")));
  must(visible.length >= 10, `canvas shows the workspace roster (${visible.length} cards)`);
  const visSet = new Set(visible);

  const edges0 = (await api("/api/edges")).edges ?? [];
  must(edges0.length > 0, `graph has edges (${edges0.length})`);

  // pick the judged seed among VISIBLE cards: mid-graph (in AND out
  // degree), with at least one visible 1-hop neighbor and one visible
  // strict-2-hop node (the radius oracle's subject)
  const adj = new Map(visible.map((id) => [id, new Set()]));
  for (const e of edges0) {
    // BOTH endpoints must be visible cards — an edge reaching into another
    // workspace would smuggle an invisible id into the neighbor set and
    // the tier expectation would chase a card the canvas never renders
    if (!adj.has(e.fromJobId) || !adj.has(e.toJobId)) continue;
    adj.get(e.fromJobId).add(e.toJobId);
    adj.get(e.toJobId).add(e.fromJobId);
  }
  // assigns the HOISTED bindings (the finally cleanup removes the seed
  // note through J — a try-local `let J` here would leave the note behind)
  for (const id of visible) {
    const nb = adj.get(id);
    if (!nb || nb.size < 2) continue;
    const twoHop = new Set();
    for (const n of nb) for (const m of adj.get(n) ?? []) if (m !== id && !nb.has(m)) twoHop.add(m);
    if (twoHop.size >= 1) { J = id; N1 = [...nb]; N2 = [...twoHop]; break; }
  }
  must(J != null, `mid-graph seed found (J with ${N1.length} neighbors, ${N2.length} 2-hop nodes)`);
  await api(`/api/jobs/${J}`, { note: "t164 spotlight seed" });
  console.log(`  seeded note on ${J}`);

  // the count rides the poll tick (1.2s with a running job in the world,
  // 6s idle) — a fixed sleep races the poll phase, so read EVENTUALLY:
  // poll the header until the count says 1, deadline 8s (~6 ticks)
  let hdr = null;
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(500);
    hdr = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /noted/i.test(x.textContent || ""));
      return { text: (b?.textContent ?? "").replace(/\s+/g, " ").trim(), disabled: b?.disabled ?? null };
    });
    if (hdr.text.includes("1") && hdr.disabled === false) break;
  }
  must(hdr.text.includes("1") && hdr.text.toLowerCase().includes("noted"), `header count is judged-only after seed ("${hdr.text}")`);
  must(hdr.disabled === false, "header spotlight chip ENABLES at 1 noted (disabled only at 0)");

  // ---------------- X: source oracles ----------------
  console.log("== X: source oracles ==");
  must(/\.note-spotlight-context\s*\{[^}]*opacity:\s*var\(--dim-murmur\)/.test(css),
    "CSS: context tier rides the ladder's --dim-murmur rung (0.62, Task 166)");
  must(/\.note-spotlight-context\s*\{[^}]*grayscale\(var\(--dim-gray-soft\)\)/.test(css),
    "CSS: context tier desaturates via --dim-gray-soft (lighter than deep's --dim-gray-deep)");
  must(/--dim-recede:\s*0\.28/.test(css) && /--dim-wire:\s*0\.32/.test(css) && /--dim-whisper:\s*0\.15/.test(css) && /--dim-ghost:\s*0\.06/.test(css),
    "CSS: the ladder defines recede/wire/whisper/ghost in one place (Task 166)");
  must(/\.note-spotlight-dim\s*\{[^}]*opacity:\s*var\(--dim-recede\)/.test(css),
    "CSS: the deep tier rides --dim-recede");
  must(/\.note-spotlight-dim,\s*\n\s*\.note-spotlight-context\s*\{[^}]*opacity:\s*1 !important/.test(css),
    "CSS: print block exempts BOTH tiers (paper never dims)");
  must(cardSrc.includes('data-spotlight-context='), "card: context exposes a probe-visible data attribute");
  must(/!dimmed && spotlightContext && "note-spotlight-context"/.test(cardSrc),
    "card: context class is gated on NOT deep-dimmed (deep wins the composition)");
  must(canvasSrc.includes("if (fromJ && !toJ) ctx.add(e.toJobId);") &&
       canvasSrc.includes("if (toJ && !fromJ) ctx.add(e.fromJobId);"),
    "canvas: adjacency is BOTH directions (what fed it AND what it fed)");
  must(canvasSrc.includes("!contextIds.has(job.id)"), "canvas: deep dim EXCLUDES the context radius");
  must(canvasSrc.includes("noteSpotlight && !hasJudgment(job) && contextIds.has(job.id)"),
    "canvas: context requires unjudged (a judged card can never hold the context tier)");
  must(canvasSrc.includes("judgedIds={noteSpotlight ? judgedIds : null}"),
    "canvas: edges-layer gets null when the lens is OFF (no edge dimming without the lens)");
  must(edgeSrc.includes("judgedIds.has(from.id) || judgedIds.has(to.id)") &&
       /const dimmed =\s*\n\s*\(selectedId != null && !touchesSelected\) \|\| \(judgedIds != null && !touchesJudged\);/.test(edgeSrc),
    "edges: story law keys on EITHER endpoint judged; dims UNION with selection");
  must(storeSrc.includes("three-tier stage since Task 164"), "store: lens contract doc names the tier stage");

  // ---------------- B: lens OFF baseline ----------------
  console.log("== B: lens OFF baseline ==");
  const off = await page.evaluate(() => ({
    ctx: [...document.querySelectorAll('[data-spotlight-context="true"]')].length,
    dim: [...document.querySelectorAll(".note-spotlight-dim")].length,
    edges: [...document.querySelectorAll("g[data-edge-id]")].map((g) => getComputedStyle(g).opacity),
  }));
  must(off.ctx === 0 && off.dim === 0, `lens OFF: zero context attrs, zero deep dims (${off.ctx}/${off.dim})`);
  must(off.edges.every((o) => o === "1"), `lens OFF: every wire at full ink (${off.edges.length} edges)`);

  // ---------------- C: CORE — lens ON, the three-tier stage ----------------
  console.log("== C: CORE — lens ON ==");
  await page.keyboard.press("n");
  await page.waitForTimeout(450); // 200ms tier transitions + settle
  const n1set = new Set(N1);
  const on = await page.evaluate(() => ({
    ctx: [...document.querySelectorAll('[data-spotlight-context="true"]')].map((el) => el.getAttribute("data-job")),
    dim: [...document.querySelectorAll(".note-spotlight-dim")].map((el) => el.getAttribute("data-job")),
    edges: [...document.querySelectorAll("g[data-edge-id]")].map((g) => ({
      id: g.getAttribute("data-edge-id"), o: getComputedStyle(g).opacity,
    })),
  }));
  const onSet = new Set(on.ctx);
  const dimSet = new Set(on.dim);
  // partition: every visible card is EXACTLY one of judged / context / deep
  must(on.ctx.every((id) => !dimSet.has(id)), "partition: no card carries BOTH context and deep dim");
  must(on.ctx.length + on.dim.length + 1 === visible.length,
    `partition: context ${on.ctx.length} + deep ${on.dim.length} + judged 1 == all ${visible.length}`);
  // context set EXACTLY equals the graph's 1-hop
  must(on.ctx.length === N1.length && N1.every((id) => onSet.has(id)),
    `context set == graph 1-hop (expected ${N1.length}, got ${on.ctx.length})`);
  must(!onSet.has(J) && !dimSet.has(J), "judged card: neither context nor deep (full ink)");
  // THE radius oracle: a 2-hop node must carry the DEEP dim, never context
  const twoHopProbes = N2.filter((id) => !dimSet.has(id) || onSet.has(id));
  must(N2.some((id) => dimSet.has(id) && !onSet.has(id)),
    `RADIUS: 2-hop node takes the DEEP dim, never context (violations: ${twoHopProbes.length})`);
  // story edges
  const freshEdges = (await api("/api/edges")).edges ?? edges0;
  const edgeById = new Map(freshEdges.map((e) => [e.id, e]));
  let storyOk = true, storyN = 0, recededOk = true;
  for (const g of on.edges) {
    const e = edgeById.get(g.id);
    if (!e || (!visSet.has(e.fromJobId) || !visSet.has(e.toJobId))) continue;
    const story = e.fromJobId === J || e.toJobId === J;
    if (story) { storyN++; if (g.o !== "1") storyOk = false; }
    else if (g.o !== "0.32") recededOk = false;
  }
  must(storyN > 0 && storyOk, `story wires touching the judged card stay at opacity 1 (${storyN} wires)`);
  must(recededOk, "wires between receding cards recede to 0.32");
  await page.screenshot({ path: "/tmp/t164-lens-on.png", fullPage: false });

  // ---------------- D: composition — find lens over the spotlight ----------------
  console.log("== D: find lens composition ==");
  const twoHopTarget = N2.find((id) => dimSet.has(id));
  must(twoHopTarget != null, "deep-dimmed 2-hop target resolved for the find leg");
  const targetName = (await api("/api/jobs")).jobs.find((j) => j.id === twoHopTarget)?.name ?? null;
  must(targetName != null, `find target name resolved ("${targetName}")`);
  await page.keyboard.press("Control+f");
  await page.waitForTimeout(300);
  await page.keyboard.insertText(targetName);
  await page.waitForTimeout(450);
  const comp = await page.evaluate(() => ({
    match: [...document.querySelectorAll('[data-find-match="true"]')].map((el) => el.getAttribute("data-job")),
    // arrays, not Sets — evaluate JSON-serializes and a Set crosses as {}
    dimIds: [...document.querySelectorAll(".note-spotlight-dim")].map((el) => el.getAttribute("data-job")),
    ctxIds: [...document.querySelectorAll('[data-spotlight-context="true"]')].map((el) => el.getAttribute("data-job")),
  }));
  const dimIds = new Set(comp.dimIds);
  const ctxIds = new Set(comp.ctxIds);
  must(comp.match.length === 1 && comp.match[0] === twoHopTarget,
    `find matched exactly the typed card (${comp.match.length} match)`);
  // the composition contract (pre-existing, now over tiers): the find lens
  // dims its own MISSES — the match keeps its amber ring but the spotlight's
  // verdict on judged-ness is untouched (search does not grant judgment),
  // and every non-match (context cards included) folds into the deep dim
  // while a query is open
  const m = comp.match[0];
  must(dimIds.has(m), "find match keeps the deep dim: search does not grant judged-ness (ring is the highlight, dim is the verdict)");
  must(ctxIds.size === 0 && N1.every((id) => dimIds.has(id)),
    `find misses fold into the deep dim — context cards included (${N1.length} adjacent cards now deep)`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const restored = await page.evaluate(() => ({
    ctx: [...document.querySelectorAll('[data-spotlight-context="true"]')].length,
  }));
  must(restored.ctx === N1.length, `Esc closes find, context tier restored (${restored.ctx} cards)`);

  // ---------------- E: lens OFF restore ----------------
  console.log("== E: lens OFF restore ==");
  await page.keyboard.press("n");
  await page.waitForTimeout(450);
  const off2 = await page.evaluate(() => ({
    ctx: [...document.querySelectorAll('[data-spotlight-context="true"]')].length,
    dim: [...document.querySelectorAll(".note-spotlight-dim")].length,
    edges: [...document.querySelectorAll("g[data-edge-id]")].map((g) => getComputedStyle(g).opacity),
  }));
  must(off2.ctx === 0 && off2.dim === 0, "lens OFF: tiers fully retire");
  must(off2.edges.every((o) => o === "1"), "lens OFF: wires back to full ink");

  // ---------------- F: print exemption ----------------
  console.log("== F: print media exemption ==");
  await page.keyboard.press("n"); // lens back ON
  await page.waitForTimeout(450);
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(250);
  const print = await page.evaluate(() => {
    const c = document.querySelector('[data-spotlight-context="true"]');
    const d = document.querySelector(".note-spotlight-dim");
    return {
      ctxOp: c ? getComputedStyle(c).opacity : null,
      dimOp: d ? getComputedStyle(d).opacity : null,
      ctxTrans: c ? getComputedStyle(c).transitionDuration : null,
    };
  });
  must(print.ctxOp === "1" && print.dimOp === "1",
    `print: BOTH tiers snap to full ink (context ${print.ctxOp}, deep ${print.dimOp})`);
  must(print.ctxTrans === "0s", `print: transition:none holds (got ${print.ctxTrans} — paper snaps, screens glide)`);
  await page.emulateMedia({ media: "screen" });
  await page.keyboard.press("n"); // lens OFF for cleanup
} catch (e) {
  // non-must exceptions (fetch/Evaluate/ReferenceError) must not masquerade
  // as a pass — the finally verdict reads `failed`, never the absence of one
  if (failed == null) failed = `uncaught: ${e.message}`;
  console.error(`  ERROR: ${e.message}`);
} finally {
  // evidence-preserving cleanup: runs on success AND on failure — a probe
  // that leaves its seed note behind would poison qa82/qa83's baseline.
  // NO must() here — a throwing cleanup must never skip browser.close()
  // or swallow the real verdict.
  const problems = [];
  if (failed) problems.push(failed);
  try { if (J != null) { await api(`/api/jobs/${J}`, { note: "" }); console.log("  cleanup: seed note removed"); } }
  catch (e) { problems.push(`cleanup note: ${e.message}`); }
  try { await page.emulateMedia({ media: "screen" }); } catch {}
  const jobsZ = await fetch(BASE + "/api/jobs").then((r) => r.json()).catch(() => null);
  const n = jobsZ?.jobs?.length ?? -1;
  if (n !== jobs0.length) problems.push(`roster not restored (${jobs0.length} == ${n})`);
  else console.log(`  cleanup: roster restored (${n} == ${jobs0.length})`);
  if (consoleErrors.length > 0) problems.push(`console errors: ${consoleErrors.length}: ${consoleErrors[0].slice(0, 160)}`);
  else console.log("  strict console: zero errors");
  try { await browser.close(); } catch {}
  console.log(problems.length === 0 ? `T164 ALL PASS (${checks} assertions)` : `T164 FAILED (${problems.length}): ${problems[0]}`);
  if (problems.length > 0) process.exit(1);
}
