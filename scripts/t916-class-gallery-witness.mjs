#!/usr/bin/env node
/**
 * t916 — the class2d results family's LIVE WITNESS: the world's FIRST
 * class2d job (t916-class2d-mint.mjs — import → autopick → extract →
 * class2d through the Mock Cluster, plus a never-run select2d downstream)
 * rides the whole family contract, live:
 *
 *   R (wide 1280, born-at-band) — Act 1, the LOCAL faces (the audit's law:
 *   class2d ∉ BULK_TYPES, everything under the key-file cap comes home):
 *     R1  the inspector's ClassAveragesTeaser renders K=4 tiles, every
 *         class populated, every image actually decoded (naturalWidth>0)
 *     R2  the ClassDistributionChart speaks four occupancy bars whose
 *         labels carry the counts — the same numbers the /classes route
 *         measured against the (p*7+it)%K+1 law
 *     R3  the Results listing is ALL local — zero remote tiles (the
 *         non-bulk law's face), the classes stack named with its slices
 *     R4  the select2d downstream's gallery IS the parameter: the section
 *         mounts from the upstream's /classes, four cards, auto mode
 *         pre-keeps every class above cutoff×best (aria-pressed on all),
 *         thumbnails decoded through the outputs/file door
 *   N (narrow 320, born-at-band, its OWN ride):
 *     N1  the gallery survives the narrow door: cards in-rect, no
 *         horizontal overflow, the header row present
 *   F (wide 1280, born-at-band) — Act 2, the t355 REMOTE FILL, exercised
 *   honestly: the mint's OWN local workdir is removed (the mint owns the
 *   artifact; the cluster fs holds the originals — never the connection's
 *   caps), and the family must re-answer over the wire:
 *     F1  /classes names the stack + the occupancy from the CLUSTER data
 *         star with NO renderError (the fill's own docstring world)
 *     F2  the teaser re-renders its four tiles through the on-demand
 *         fetch door — the dark grid never appears
 *
 * RIDE LAWS inherited: born-at-band (t910 — set viewport RELOADS, each
 * band its own ride); per-surface presence polls (t912); click-time
 * vis/own re-probe + the clamped-point law (t910/t914); the settle law —
 * two agreeing own-censuses (t911); an instrument measures the LAWS,
 * never its author's memory (t915 — the expected occupancy comes from the
 * mint manifest, computed from the input star, not hardcoded).
 *
 *   node scripts/t916-class-gallery-witness.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const MANIFEST = path.join(ROOT, "data", "t916-class2d-mint.json");
const RECEIPT = "shots-qa/t916-class-gallery-witness.json";

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
  // the clamped-point law, GENERALIZED (t914 → t916): aim at the center,
  // but when the center is covered by a neighbor (the canvas stacks every
  // new job at the same default spot), probe the card's own uncovered
  // slivers — a corner inset ring — and click the first point where
  // elementFromPoint lands INSIDE the element. own at the ACTUAL point is
  // the gate; a click that hits a neighbor is refused.
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

// ---- the ground truth from the mint manifest + the API --------------------
if (!existsSync(MANIFEST)) { console.log("FATAL: no mint manifest — run t916-class2d-mint.mjs mint first"); process.exit(2); }
const mint = JSON.parse(readFileSync(MANIFEST, "utf8"));
const C2D_ID = mint.class2d.id;
const SEL_ID = mint.select2d.id;
const K = mint.K;
const WANT = mint.expect.perIter["2"];
const ROWS = mint.expect.rows;
const ORIGIN = `-H "Origin: ${BASE}"`;
const shApi = (url) => execSync(`curl -s ${ORIGIN} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
const jobsBefore = JSON.parse(shApi("/api/jobs"));
const jobCount = jobsBefore.jobs.length;
console.log(`witness target: class2d ${C2D_ID.slice(-8)} + select2d ${SEL_ID.slice(-8)} — K=${K}, law map ${JSON.stringify(WANT)}, ${ROWS} rows, ${jobCount} jobs`);

// the card contract, read from source before riding (job-card.tsx:1848):
// a plain click on the card body opens the INSPECTOR dialog for a
// submitted job (running/completed/failed) and SELECTS an idle one — the
// editing panel (the JobPanel aside at xl, a Sheet below it). The mint's
// class2d card is completed (dialog face); the select2d is idle (panel
// face). Two openers, one law each.
//
// THE GHOST-TAB LAW (t916's own ride lesson, the t910/t912 family): the
// page carries MORE tabs than the inspector's (the app nav, a stale
// Sheet portal) — a name-only finder rides the first twin and the switch
// silently never happens (own at the actual point was true — for the
// GHOST). Tab clicks are scoped to the dialog that carries the job name,
// and a click only counts when the tab's own data-state says active.
const inspectorTabExpr = (name, match) =>
  `[...([...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}'))?.querySelectorAll('[role="tab"]') ?? [])].find(t => ${match})`;
const clickTabUntilActive = async (name, match, label) => {
  for (let i = 0; i < 4; i++) {
    await realClick(inspectorTabExpr(name, match));
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
  // the per-surface presence law (t912) + the cold-compile reality (t911's
  // family, re-sighted): the inspector's tab strip lazy-mounts — the class
  // faces' chunks compiled on their FIRST-EVER ride under memory pressure.
  // A sibling's arrival (the dialog shell) is not a settle.
  const strip = await poll(
    `JSON.stringify({ tabs: [...document.querySelectorAll('[role="tab"]')].map(t => (t.textContent || '').trim()).filter(Boolean) })`,
    (v) => (v.tabs ?? []).length >= 3, 40, 750
  );
  ok(`the inspector's tab strip mounted (${(strip?.tabs ?? []).join("/")})`, (strip?.tabs ?? []).length >= 3);
  return opened;
};
const openPanel = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  // the panel face: the JobPanel aside (xl) or the Sheet below it — the
  // panel's header carries the TYPE WORDS (the spec's own description,
  // "Subset-selection" for select2d), NOT the job's name — anchor on what
  // the panel actually renders (witnessed live: the name never appears)
  const opened = await poll(
    `(() => { const aside = [...document.querySelectorAll('aside')].find(a => a.className.includes('border-l') && (a.textContent || '').includes('Subset-selection')); const sheet = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('Subset-selection')); return JSON.stringify({ aside: !!aside, sheet: !!sheet }); })()`,
    (v) => v.aside === true || v.sheet === true
  );
  ok(`editing panel open for "${name}" (aside=${opened?.aside} sheet=${opened?.sheet})`, opened?.aside === true || opened?.sheet === true);
  // the panel's default tab is I/O — the gallery IS the parameter and
  // lives in the Params tab; click it by its exact name
  const tabClicked = await realClick(`[...document.querySelectorAll('[role="tab"]')].find(t => (t.textContent || '').trim() === 'Params')`);
  ok("Params tab clicked", String(tabClicked).startsWith("clicked@"), String(tabClicked));
  return opened;
};

// ---- band R: 1280 wide, born at band — Act 1, the local faces -------------
console.log("== band R: 1280 wide, born at band (Act 1: the local faces) ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobCount, 30);
await settleCensus();

await openInspector("t916 class2d witness");

// the inspector for a COMPLETED job opens on RESULTS (the card's own
// hover title says "results inspector") — the teaser and the occupancy
// bars live on OVERVIEW: click it explicitly, never assume a default
const ovClicked = await clickTabUntilActive("t916 class2d witness", "(t.textContent || '').trim() === 'Overview'", "Overview");
ok("Overview tab ACTIVE (the completed card's inspector opens on Results)", String(ovClicked).startsWith("active@"), String(ovClicked));
const teaser = await poll(
  `(() => { const s = document.querySelector('section[data-class-teaser]'); if (!s) return JSON.stringify({ found: false }); const imgs = [...s.querySelectorAll('img')]; return JSON.stringify({ found: true, tiles: imgs.length, decoded: imgs.filter(i => i.complete && i.naturalWidth > 0).length }); })()`,
  (v) => v.found === true && v.tiles >= K && v.decoded >= K, 60, 750
);
ok("R1 the ClassAveragesTeaser mounts", teaser?.found === true);
ok(`R1 ${K} tiles and every one decoded (populated, bright)`, teaser?.tiles === K && teaser?.decoded === K, `tiles=${teaser?.tiles} decoded=${teaser?.decoded}`);

// R2 — the occupancy bars speak the law's numbers
const bars = await poll(
  `(() => { const els = [...document.querySelectorAll('[aria-label^="class "][aria-label$="occupancy"]')]; return JSON.stringify({ n: els.length, labels: els.map(e => e.getAttribute('aria-label')) }); })()`,
  (v) => v.n >= K, 24, 750
);
ok(`R2 the distribution chart speaks ${K} occupancy bars`, bars?.n === K, JSON.stringify(bars?.labels ?? []));
const barNumbers = (bars?.labels ?? []).map((l) => Number((l.match(/class (\d+)/) ?? [])[1]));
ok("R2 the bars carry every class 1..K in order", JSON.stringify(barNumbers) === JSON.stringify(Array.from({ length: K }, (_, i) => i + 1)), JSON.stringify(barNumbers));

// the inspector's own occupancy summary — the same counts, one face over
const inspCounts = evalJson(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')][0]; if (!d) return JSON.stringify({}); const t = d.textContent || ''; return JSON.stringify({ names4of4: t.includes('4 of 4') || t.includes('classes populated') }); })()`);
ok("R2b the inspector names the populated/K phrase", inspCounts.names4of4 === true);

// R3 — the Results tab: ALL local, the classes stack named with slices
const tabR = await clickTabUntilActive("t916 class2d witness", "/^Results/.test((t.textContent || '').trim())", "Results");
ok("R3 Results tab ACTIVE", String(tabR).startsWith("active@"), String(tabR));
const listing = await poll(
  `(() => { const g = document.querySelector('[data-canvas-ui="maps-gallery"]'); const remotes = document.querySelectorAll('[data-remote-file]').length; const localTiles = g ? g.querySelectorAll('button').length : 0; const classesTile = g ? [...g.querySelectorAll('button')].find(b => /Class averages/i.test(b.textContent || '')) : null; return JSON.stringify({ gallery: !!g, remotes, localTiles, classesTile: classesTile ? (classesTile.textContent || '').slice(0, 90) : null }); })()`,
  (v) => v.gallery === true, 24, 750
);
ok("R3 the maps gallery mounts", listing?.gallery === true);
ok("R3 ZERO remote tiles (the non-bulk law's face)", listing?.remotes === 0, `remotes=${listing?.remotes}`);
ok("R3 the class-averages stack is a LOCAL tile (friendlyLabel's classes dialect names it, slices + size spoken)", !!listing?.classesTile && /4 imgs/.test(listing.classesTile ?? ""), String(listing?.classesTile ?? "").slice(0, 90));

// R4 — the select2d downstream: the gallery IS the parameter
sh(`${AB} press Escape`);
await sleep(400);
await settleCensus();
await openPanel("t916 select witness");
const gallery = await poll(
  `(() => { const s = document.querySelector('section[aria-label="Class selection gallery"]'); if (!s) return JSON.stringify({ found: false }); const grid = s.querySelector('[data-canvas-ui="class-grid"]'); const cards = grid ? [...grid.querySelectorAll('button')].filter(b => /^Toggle class/.test(b.getAttribute('aria-label') ?? '')) : []; const imgs = [...s.querySelectorAll('img')]; return JSON.stringify({ found: true, grid: !!grid, cards: cards.length, pressed: cards.filter(b => b.getAttribute('aria-pressed') === 'true').length, labels: cards.map(b => b.getAttribute('aria-label')), decoded: imgs.filter(i => i.complete && i.naturalWidth > 0).length, imgs: imgs.length, pours: !!s.querySelector('[data-testid="class-gallery-pours-class2d"]') }); })()`,
  (v) => v.found === true && v.cards >= K && v.decoded >= Math.min(2, K), 30, 750
);
ok("R4 the selection gallery mounts from the upstream's /classes", gallery?.found === true);
ok(`R4 four class cards rendered`, gallery?.cards === K, `cards=${gallery?.cards} labels=${JSON.stringify(gallery?.labels ?? []).slice(0, 160)}`);
ok("R4 auto mode pre-keeps every class above cutoff×best (all aria-pressed)", gallery?.pressed === K, `pressed=${gallery?.pressed}`);
ok("R4 the pours chip names the class2d source", gallery?.pours === true);
ok("R4 thumbnails decoded through the outputs/file door", gallery?.decoded >= Math.min(2, K), `decoded=${gallery?.decoded}/${gallery?.imgs}`);
const cardLabels = (gallery?.labels ?? [])
  .filter((l) => /^Toggle class/.test(l ?? ""))
  .map((l) => {
    const m = /Toggle class (\d+) \((\d+) particles/.exec(l ?? "") ?? [];
    return { cls: Number(m[1] ?? 0), count: Number(m[2] ?? 0) };
  });
const lawMatches = cardLabels.length === K && cardLabels.every(({ cls, count }) => WANT[String(cls)] === count);
ok("R4 the card labels carry the LAW's counts (measured, not remembered)", lawMatches, JSON.stringify(cardLabels));
const overR = evalJson(overflowProbe);
ok("R4 no horizontal overflow at 1280", overR.overX <= 0, `overX=${overR.overX}`);

sh(`${AB} press Escape`);
await sleep(400);

// ---- band N: 320 narrow, born at band — the gallery's narrow door ---------
console.log("== band N: 320 narrow, born at band ==");
sh(`${AB} set viewport 320 800`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobCount, 30);
await settleCensus();
await openPanel("t916 select witness");
const galleryN = await poll(
  `(() => { const s = document.querySelector('section[aria-label="Class selection gallery"]'); if (!s) return JSON.stringify({ found: false }); const cards = [...(s.querySelector('[data-canvas-ui="class-grid"]')?.querySelectorAll('button') ?? [])]; const inRect = cards.every(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= document.documentElement.clientWidth + 1; }); const imgs = [...s.querySelectorAll('img')]; return JSON.stringify({ found: true, cards: cards.length, inRect, decoded: imgs.filter(i => i.complete && i.naturalWidth > 0).length, imgs: imgs.length }); })()`,
  (v) => v.found === true && v.cards >= K, 30, 750
);
ok("N1 the gallery mounts at 320", galleryN?.found === true);
ok("N1 every card in-rect at the narrow band", galleryN?.inRect === true, `cards=${galleryN?.cards}`);
ok("N1 thumbnails decode at 320 (lazy, but they arrive)", galleryN?.decoded >= 1, `decoded=${galleryN?.decoded}/${galleryN?.imgs}`);
const overN = evalJson(overflowProbe);
ok("N1 no horizontal overflow at 320", overN.overX <= 0, `overX=${overN.overX}`);
sh(`${AB} press Escape`);
await sleep(400);

// ---- band F: 1280 wide, born at band — Act 2, the t355 remote fill -------
console.log("== band F: 1280 wide, born at band (Act 2: the remote fill) ==");
sh(`${AB} set viewport 1280 900`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobCount, 30);
await settleCensus();

// the honest world-wound: remove the mint's OWN local workdir. The mint
// owns the artifact; the cluster fs holds the originals; the restore was
// going to sweep this dir anyway. NEVER the connection's caps.
const localWd = mint.workdirs.class2d;
ok("F0 the local workdir exists before the removal", !!localWd && existsSync(localWd), localWd ? String(localWd).replace(ROOT + "/", "") : "unknown");
if (localWd && existsSync(localWd)) {
  rmSync(localWd, { recursive: true, force: true });
  console.log(`  rm (the mint's own mirror) ${String(localWd).replace(ROOT + "/", "")}`);
}

// F1 — the classes route re-answers over the wire, the full shape
const clsF = JSON.parse(shApi(`/api/jobs/${C2D_ID}/classes`));
ok("F1 /classes names the stack from the CLUSTER", !!clsF.classesFile, clsF.classesFile ?? "null");
ok("F1 slices still K (read from the cluster header)", clsF.classesSlices === K, `slices=${clsF.classesSlices}`);
ok("F1 occupancy counted from the CLUSTER data star (the law, unchanged)",
  JSON.stringify(Object.fromEntries((clsF.classes ?? []).map((c) => [c.cls, c.count]))) === JSON.stringify(WANT),
  JSON.stringify(Object.fromEntries((clsF.classes ?? []).map((c) => [c.cls, c.count]))));
ok("F1 total still the input star's rows", clsF.total === ROWS, `total=${clsF.total}`);
ok("F1 NO renderError — the fill answered, the dark grid never earned its note", clsF.renderError == null, clsF.renderError ?? "clean");

// F2 — the family's UI face rides the wire: the teaser re-renders through
// the on-demand fetch door (the completed card's inspector opens on
// Results — the teaser lives on Overview; click it explicitly)
await openInspector("t916 class2d witness");
const ovF = await clickTabUntilActive("t916 class2d witness", "(t.textContent || '').trim() === 'Overview'", "Overview");
ok("F2 Overview tab ACTIVE for the wire-fed face", String(ovF).startsWith("active@"), String(ovF));
const teaserF = await poll(
  `(() => { const s = document.querySelector('section[data-class-teaser]'); if (!s) return JSON.stringify({ found: false }); const imgs = [...s.querySelectorAll('img')]; return JSON.stringify({ found: true, tiles: imgs.length, decoded: imgs.filter(i => i.complete && i.naturalWidth > 0).length, errNote: (s.textContent || '').includes('could not') || (s.textContent || '').includes('no class-average stack') }); })()`,
  (v) => v.found === true && v.decoded >= 1, 60, 750
);
ok("F2 the teaser re-mounts with NO dark-grid note", teaserF?.found === true && teaserF?.errNote === false, JSON.stringify(teaserF));
ok(`F2 all ${K} tiles decoded OVER THE WIRE (the fetch door fed the family)`, teaserF?.decoded === K, `decoded=${teaserF?.decoded}/${teaserF?.tiles}`);
const overF = evalJson(overflowProbe);
ok("F2 no horizontal overflow at 1280", overF.overX <= 0, `overX=${overF.overX}`);

// the world guard: the jobs list is unchanged by the whole ride
const jobsAfter = JSON.parse(shApi("/api/jobs"));
ok("F3 the world guard: job count unchanged", jobsAfter.jobs.length === jobCount, `${jobsAfter.jobs.length} vs ${jobCount}`);

// receipt
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({
  at: new Date().toISOString(), pass, fail,
  class2d: C2D_ID, select2d: SEL_ID, K, rows: ROWS, lawMap: WANT,
  act1: { teaserTiles: teaser?.tiles ?? null, decoded: teaser?.decoded ?? null, remoteTiles: listing?.remotes ?? null, galleryCards: gallery?.cards ?? null, galleryPressed: gallery?.pressed ?? null },
  act2: { classesFile: clsF.classesFile ?? null, renderError: clsF.renderError ?? null, decodedOverWire: teaserF?.decoded ?? null },
}, null, 2));
console.log(`== witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail == (receipt: ${RECEIPT})`);
process.exit(fail === 0 ? 0 : 1);
