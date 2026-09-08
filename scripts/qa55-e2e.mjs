// Task 55 QA — report Contents block (TOC + explicit anchors) and dashboard
// grid-filter keyboard shortcuts (1–4):
//   A  FULL REPORT: Task 53 seed (9 sections) → Results → Report → markdown
//      asserts: Contents block with 9 numbered entries, GitHub-style slugs,
//      one explicit <a id/name> anchor per h2, anchor precedes its heading,
//      TOC sits between the metadata table and Summary; qa53's 24 content
//      asserts + 6-PNG IHDR suite rerun as regression
//   B  DASHBOARD KEYS: KPI cards show corner kbd badges (1/2/3), presence
//      chips carry aria-keyshortcuts; dispatching keydowns drives the same
//      drill-downs as the cards — 2 toggles running (honest empty state),
//      1 resets, 3 completed, Ctrl+2 is left to the browser, typing in the
//      search box is ignored
//   C  HONEST GAP + CONSOLE: clean seed → slim report has NO Contents, no
//      TOC links (3 anchors still exist for its 3 h2s), plain toast; console
//      0 errors
// Usage: QA_PHASES=A,B,C node scripts/qa55-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa55-trace.log", import.meta.url).pathname;
const step = (m) => {
  const line = `[${(Date.now() / 1000).toFixed(0)}] ${m}`;
  try { appendFileSync(LOGF, line + "\n"); } catch { /* ignore */ }
  console.log(m);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => { step(`SIGNAL ${sig} — dying`); process.exit(1); });
}
process.on("exit", (c) => step(`exit code=${c}`));
process.on("uncaughtException", (e) => { step(`uncaught: ${e.message}`); process.exit(2); });
process.on("unhandledRejection", (e) => { step(`unhandledRejection: ${e}`); process.exit(3); });

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",").map((s) => s.trim().toUpperCase());

const SEED = "python3 /home/z/my-project/scripts/qa53-seed-topaz.py";
const SEED_CLEAN = "python3 /home/z/my-project/scripts/qa53-seed-topaz.py --clean";
const JOB = "3D Auto-Refine 1";
const B = "http://localhost:3000";

const openDashboard = async () => {
  sh(`${AB} open ${B}`);
  await sleep(4500);
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
  await sleep(2500);
};

const openJobResults = async () => {
  sh(`${AB} open ${B}`);
  await sleep(6000);
  let node = "";
  for (let i = 0; i < 15 && !node.includes("clicked@"); i++) {
    node = await (async () => {
      const coords = evalJs(
        `(() => { const el = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${JOB}') && (x.textContent||'').includes('completed')); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
      );
      if (!coords || coords === "null") return "NO-ELEMENT";
      const c = JSON.parse(coords);
      sh(`${AB} mouse move ${c.x} ${c.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${c.x},${c.y}`;
    })();
    if (!node.includes("clicked@")) await sleep(2000);
  }
  if (!node.includes("clicked@")) throw new Error("job node never appeared");
  await sleep(2500);
  const tab = unq(evalJs(`(() => {
    const t = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim().includes('Results'));
    if (!t) return 'NO-TAB';
    t.click(); return 'tab-clicked';
  })()`));
  if (tab !== "tab-clicked") throw new Error(tab);
  // sanity probe — a fresh probe must prove it can be true before gating
  // a poll (qa50 lesson)
  const sanity = unq(evalJs(`(() => !!document.querySelectorAll('button').length)() + ''`));
  if (sanity !== "true") throw new Error(`probe sanity failed: "${sanity}"`);
  let ok = false;
  for (let i = 0; i < 24 && !ok; i++) {
    await sleep(1500);
    ok = unq(evalJs(`(() => !![...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Export run report'))() + ''`)) === "true";
  }
  if (!ok) {
    const dump = J(`(() => ({
      tabs: [...document.querySelectorAll('[role=tab]')].map(t => t.textContent.trim()),
      h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    }))()`);
    step(`  DIAG on poll failure: ${JSON.stringify(dump)}`);
    throw new Error("Report button never appeared");
  }
  step("  results tab open, Report button present");
};

const hookAndClickReport = async () => {
  evalJs(`(() => {
    window.__qaBlobs = [];
    if (!window.__qaHooked) {
      const orig = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (b) => { window.__qaBlobs.push(b); return orig(b); };
      window.__qaHooked = true;
    }
    return 'hooked';
  })()`);
  evalJs(`(() => {
    window.__qaToasts = [];
    const t0 = Date.now();
    window.__qaMo && window.__qaMo.disconnect();
    window.__qaMo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType === 1) {
          const t = (n.textContent || '');
          if (/report|failed/i.test(t)) {
            window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 220) });
          }
        }
      }
    });
    window.__qaMo.observe(document.body, { childList: true, subtree: true });
    return 'observer-on';
  })()`);
  const clk = unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Export run report');
    if (!b) return 'NO-BTN';
    b.click(); return 'clicked';
  })()`));
  if (clk !== "clicked") throw new Error(clk);
  await sleep(11000); // six rasterizations join the fetch set — give room
  const toasts = unq(evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));
  const blobs = J(`({ n: (window.__qaBlobs||[]).length, sizes: (window.__qaBlobs||[]).map(b => b.size) })`);
  step(`  toasts: ${toasts}`);
  step(`  blobs: ${JSON.stringify(blobs)}`);
  return { toasts, blobs };
};

const blobText = async () =>
  unq(evalJs(`(async () => {
    const b = (window.__qaBlobs||[])[(window.__qaBlobs||[]).length - 1];
    if (!b) return 'NO-BLOB';
    return b.text();
  })()`));

const norm = (mdRaw) => {
  // the eval bridge JSON-serializes the blob text: literal \n for newlines
  // (first time qa50 hit it) AND \" for quotes (first time qa55 hits it —
  // the anchor HTML is the first needle that contains double quotes)
  let s = mdRaw;
  if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n");
  s = s.replace(/\\"/g, '"');
  return s;
};

/** PHASE A — full report with all six snapshot sections + Contents block */
const phaseA = async () => {
  console.log("== PHASE A: full report + Contents ==");
  step("  seeding Task53 superset …");
  sh(SEED);
  await openJobResults();

  // regression guard: the FSC chart still lights up from the same payload
  const chart = unq(evalJs(`(() => {
    const sec = document.querySelector('section[aria-label="Fourier-shell correlation"]');
    if (!sec) return 'NO-CHART';
    return (sec.textContent||'').includes('postprocess') ? 'chart-postprocess' : 'chart-other';
  })()`));
  step(`  fsc chart: ${chart}`);
  if (chart !== "chart-postprocess") throw new Error(chart);

  const { toasts, blobs } = await hookAndClickReport();
  if (!/Run report downloaded/i.test(toasts)) throw new Error(`toast missing: ${toasts}`);
  if (!/Markdown \+ FSC table & curve snapshot/i.test(toasts))
    throw new Error(`toast fsc bit missing: ${toasts}`);
  if (blobs.n < 7) throw new Error(`expected ≥7 blobs (6 svg + md), got ${JSON.stringify(blobs)}`);
  const size = blobs.sizes[blobs.sizes.length - 1] ?? 0;
  if (size < 100_000) throw new Error(`blob suspiciously small for 6 PNG embeds: ${size}B`);

  const md = norm(await blobText());
  writeFileSync("/home/z/my-project/agent-ctx/qa55-report.md", md);
  step(`  md bytes: ${md.length}`);
  if (!md.includes("# CryoFlow run report")) throw new Error("md head missing");

  // ---- Contents block ----
  const tocAsserts = [
    "**Contents**",
    "1. [Summary](#summary)",
    "2. [Resolution](#resolution)",
    "3. [Resolution progress](#resolution-progress)",
    "4. [FSC curve](#fsc-curve)",
    "5. [Guinier plot](#guinier-plot)",
    "6. [CTF fit quality](#ctf-fit-quality)",
    "7. [Angular distribution](#angular-distribution)",
    "8. [Topaz training](#topaz-training)",
    "9. [Outputs on disk](#outputs-on-disk)",
  ];
  for (const needle of tocAsserts) {
    if (!md.includes(needle)) throw new Error(`TOC missing: "${needle}"`);
  }
  // TOC sits between the metadata table and the first section
  const iContents = md.indexOf("**Contents**");
  const iWorkdir = md.indexOf("| Workdir |");
  const iSummary = md.indexOf("## Summary");
  if (!(iWorkdir > 0 && iContents > iWorkdir && iContents < iSummary))
    throw new Error(`TOC position wrong: workdir=${iWorkdir} contents=${iContents} summary=${iSummary}`);
  // every linked slug has an explicit anchor; anchors precede headings;
  // document anchor order matches TOC order; exactly 9 anchors (one per h2)
  const slugHeading = {
    "summary": "## Summary",
    "resolution": "## Resolution",
    "resolution-progress": "## Resolution progress",
    "fsc-curve": "## FSC curve",
    "guinier-plot": "## Guinier plot",
    "ctf-fit-quality": "## CTF fit quality",
    "angular-distribution": "## Angular distribution",
    "topaz-training": "## Topaz training",
    "outputs-on-disk": "## Outputs on disk",
  };
  const slugs = Object.keys(slugHeading);
  let prev = -1;
  for (const s of slugs) {
    const anchor = `<a id="${s}" name="${s}"></a>`;
    const ai = md.indexOf(anchor);
    if (ai < 0) throw new Error(`anchor missing for #${s}`);
    const hi = md.indexOf(slugHeading[s]);
    if (hi < 0) throw new Error(`heading missing for #${s}`);
    if (ai > hi) throw new Error(`anchor for #${s} must precede its heading`);
    if (ai <= prev) throw new Error(`anchor order broken at #${s}`);
    prev = ai;
  }
  const anchorCount = (md.match(/<a id="/g) || []).length;
  // ≥9: one per h2. 10 when the Contents block itself carries the footer
  // link's target anchor (Task 57 added `#contents` + "Back to contents")
  if (anchorCount < 9) throw new Error(`want ≥9 anchors (one per h2), got ${anchorCount}`);
  step("  Contents block: 9 entries, anchors verified, position OK");

  // ---- regression: qa53's content asserts ----
  const asserts = [
    ["## Resolution", "resolution section"],
    ["Refinement resolution: current **3.18 Å**, best **3.18 Å**", "refine line from points"],
    ["## Resolution progress", "progress section"],
    ["| 2 | 28.50 |", "progress first row"],
    ["| 30 | 3.18 |", "progress last row"],
    ["![Resolution progress — 3.18 Å at iteration 30 for " + JOB + "]", "progress png alt"],
    ["## FSC curve", "fsc section"],
    ["![FSC curve — 3.12 Å", "fsc png alt"],
    ["## Guinier plot", "guinier section"],
    ["Applied B-factor: **-52.4 Å²**", "bfactor line"],
    ["![Guinier plot for " + JOB + "]", "guinier png alt"],
    ["## CTF fit quality", "ctf section"],
    ["48 micrographs — mean defocus **", "ctf summary line"],
    ["| Micrograph | Defocus (µm) | Astig (µm) | FOM | Fit (Å) |", "ctf table header"],
    ["![CTF defocus scatter for " + JOB + "]", "ctf png alt"],
    ["## Angular distribution", "angdist section"],
    ["anisotropic (preferred-orientation risk)", "angdist verdict"],
    ["![Orientation distribution heatmap for " + JOB + "]", "angdist png alt"],
    ["## Topaz training", "topaz section"],
    ["Source: `topaz_training.txt`", "topaz source line"],
    ["30 epochs — final train loss **0.309**, test loss **0.896**", "topaz summary line"],
    ["| Epoch | Train loss | Test loss | Precision | Recall |", "topaz table header (5 cols earn place)"],
    ["| 1 | 2.713 | 2.721 | 0.409 | 0.393 |", "topaz first row"],
    ["| 30 | 0.309 | 0.896 | 0.871 | 0.832 |", "topaz last row (sampled table keeps it)"],
    ["![Topaz training loss curves for " + JOB + "]", "topaz png alt"],
    ["## Outputs on disk", "outputs intact"],
  ];
  for (const [needle, label] of asserts) {
    if (!md.includes(needle)) throw new Error(`report missing ${label}: "${needle}"`);
  }
  const order = ["## Resolution", "## Resolution progress", "## FSC curve", "## Guinier plot",
    "## CTF fit quality", "## Angular distribution", "## Topaz training", "## Outputs on disk"]
    .map((s) => md.indexOf(s));
  if (order.some((i) => i < 0) || !order.every((v, i) => i === 0 || v > order[i - 1]))
    throw new Error(`section order broken: ${order.join(",")}`);
  const pngs = [...md.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)].map((m) => m[1]);
  step(`  embedded PNGs: ${pngs.length}`);
  if (pngs.length !== 6) throw new Error(`want 6 embedded PNGs, got ${pngs.length}`);
  const names = ["resolution", "fsc", "guinier", "ctf", "angdist", "topaz"];
  const wantH = [560, 560, 560, 640, 640, 560];
  pngs.forEach((b64, i) => {
    const bin = Buffer.from(b64.slice(0, 120), "base64");
    const w = bin.readUInt32BE(16);
    const h = bin.readUInt32BE(20);
    step(`  png[${names[i]}]: ${w}x${h}`);
    if (w !== 1280 || h !== wantH[i])
      throw new Error(`png[${names[i]}] dims wrong: ${w}x${h} (want 1280x${wantH[i]})`);
    writeFileSync(`/home/z/my-project/agent-ctx/qa55-snap-${names[i]}.png`, Buffer.from(b64, "base64"));
  });
  step("  ALL markdown assertions PASS");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa55-report.png`);
};

/** PHASE B — dashboard grid-filter keyboard shortcuts */
const pressKey = (key, opts = {}) =>
  unq(evalJs(`(() => {
    const ev = new KeyboardEvent('keydown', { key: '${key}', bubbles: true, cancelable: true${opts.ctrl ? ", ctrlKey: true" : ""} });
    ${opts.onInput
      ? `const el = [...document.querySelectorAll('input')].find(i => (i.getAttribute('placeholder')||'').includes('Search projects'));
         if (!el) return 'NO-INPUT'; el.dispatchEvent(ev); return 'input-dispatched';`
      : `window.dispatchEvent(ev); return 'dispatched';`}
  })()`));

const kpiBand = () => J(`(() => {
  const labels = ['Projects', 'Total jobs', 'Running', 'Completed', 'Active engine'];
  const out = {};
  for (const label of labels) {
    const p = [...document.querySelectorAll('p')].find(x => x.textContent.trim() === label);
    if (!p) continue;
    const card = p.closest('.card-lift');
    if (!card) continue;
    out[label] = {
      tag: card.tagName,
      pressed: card.getAttribute('aria-pressed'),
      kbd: card.querySelector('kbd')?.textContent ?? null,
      keyshortcuts: card.getAttribute('aria-keyshortcuts'),
      title: card.getAttribute('title'),
    };
  }
  return out;
})()`);

const gridState = () => J(`(() => {
  const sec = [...document.querySelectorAll('h2')].find(h => h.textContent.trim() === 'All projects');
  if (!sec) return null;
  const root = sec.parentElement.parentElement;
  const chips = root.querySelector('[aria-label="Filter projects by job presence"]');
  return {
    cards: root.querySelectorAll('.grid > div.group').length,
    chipRow: chips ? [...chips.querySelectorAll('button')].map(b => ({
      t: b.textContent.replace(/\\s+/g, ' ').trim(),
      pressed: b.getAttribute('aria-pressed'),
      ks: b.getAttribute('aria-keyshortcuts'),
    })) : null,
    empty: (root.textContent.match(/No project with \\w+ jobs right now/) || [null])[0],
    clearBtn: [...root.querySelectorAll('button')].some(b => b.textContent.trim() === 'Clear filter'),
  };
})()`);

const phaseB = async () => {
  console.log("== PHASE B: dashboard filter keys ==");
  await openDashboard();
  let band = kpiBand();
  for (let i = 0; i < 8 && (!band || !band.Running); i++) {
    await sleep(2000);
    band = kpiBand();
  }
  step(`  kpi band: ${JSON.stringify(band)}`);
  if (!band.Projects || !band.Running || !band.Completed)
    throw new Error(`clickable KPI cards missing: ${JSON.stringify(band)}`);

  // kbd badges: interactive drill cards carry their digit, informational
  // cards stay clean, aria-keyshortcuts wired
  if (band.Projects.kbd !== "1") throw new Error(`Projects kbd: ${JSON.stringify(band.Projects)}`);
  if (band.Running.kbd !== "2") throw new Error(`Running kbd: ${JSON.stringify(band.Running)}`);
  if (band.Completed.kbd !== "3") throw new Error(`Completed kbd: ${JSON.stringify(band.Completed)}`);
  if (band["Total jobs"]?.kbd !== null || band["Active engine"]?.kbd !== null)
    throw new Error("informational cards must not carry kbd badges");
  if (band.Running.keyshortcuts !== "2" || band.Completed.keyshortcuts !== "3")
    throw new Error("aria-keyshortcuts missing on KPI buttons");
  if (!/press 2/.test(band.Running.title ?? ""))
    throw new Error(`Running title lacks key hint: ${band.Running.title}`);

  let gs = gridState();
  step(`  grid initial: ${JSON.stringify(gs)}`);
  if (!gs || gs.chipRow === null) throw new Error("presence chip row missing");
  const allN = gs.cards;
  if (allN < 1) throw new Error("grid has no cards — cannot assert filtering");
  // chips: All carries 1; running presence is 0 in this sandbox so its chip
  // (and only its chip) is absent; completed chip carries 3
  const chipAll = gs.chipRow.find((c) => c.t.startsWith("All "));
  const chipCompleted = gs.chipRow.find((c) => c.t.startsWith("Completed "));
  const chipRunning = gs.chipRow.find((c) => c.t.startsWith("Running "));
  if (!chipAll || chipAll.ks !== "1") throw new Error(`All chip keyshortcuts: ${JSON.stringify(gs.chipRow)}`);
  if (!chipCompleted || chipCompleted.ks !== "3") throw new Error("Completed chip keyshortcuts missing");
  if (chipRunning) throw new Error("Running chip should be absent (no running jobs in sandbox)");

  // key 2 — running filter on (presence 0 → honest empty state)
  if (pressKey("2") !== "dispatched") throw new Error("dispatch failed");
  await sleep(600);
  gs = gridState();
  band = kpiBand();
  step(`  after key 2: cards=${gs.cards} empty=${JSON.stringify(gs.empty)} runningPressed=${band.Running.pressed}`);
  if (band.Running.pressed !== "true") throw new Error("key 2 did not engage running filter");
  if (gs.cards !== 0 || !gs.empty || !/running/.test(gs.empty)) throw new Error("honest empty state missing");
  if (!gs.clearBtn) throw new Error("clear-filter affordance missing");

  // key 1 — back to the whole grid (mirrors the Projects card)
  if (pressKey("1") !== "dispatched") throw new Error("dispatch failed");
  await sleep(600);
  gs = gridState();
  band = kpiBand();
  step(`  after key 1: cards=${gs.cards} runningPressed=${band.Running.pressed}`);
  if (gs.cards !== allN) throw new Error(`key 1 did not restore grid: ${gs.cards} vs ${allN}`);
  if (band.Running.pressed !== "false") throw new Error("key 1 did not clear running");

  // key 3 — completed filter (sandbox has exactly one completed project)
  if (pressKey("3") !== "dispatched") throw new Error("dispatch failed");
  await sleep(600);
  gs = gridState();
  band = kpiBand();
  step(`  after key 3: cards=${gs.cards} completedPressed=${band.Completed.pressed}`);
  if (band.Completed.pressed !== "true") throw new Error("key 3 did not engage completed filter");
  if (gs.cards !== 1) throw new Error(`completed presence filter expected 1 card, got ${gs.cards}`);

  // Ctrl+2 — browser territory (tab switching), the app must not react
  if (pressKey("2", { ctrl: true }) !== "dispatched") throw new Error("dispatch failed");
  await sleep(400);
  band = kpiBand();
  if (band.Running.pressed !== "false" || band.Completed.pressed !== "true")
    throw new Error("ctrl+digit leaked into the filter state");

  // typing in the search box must own the digit
  if (pressKey("2", { onInput: true }) !== "input-dispatched") throw new Error("search input not found");
  await sleep(400);
  band = kpiBand();
  if (band.Running.pressed !== "false" || band.Completed.pressed !== "true")
    throw new Error("digit in search input leaked into the filter state");

  // key 2 plain — single-select semantics: running replaces completed
  if (pressKey("2") !== "dispatched") throw new Error("dispatch failed");
  await sleep(600);
  band = kpiBand();
  step(`  after key 2 (from completed): running=${band.Running.pressed} completed=${band.Completed.pressed}`);
  if (band.Running.pressed !== "true" || band.Completed.pressed !== "false")
    throw new Error("filter switch semantics broken");

  // reset for the next phase
  if (pressKey("1") !== "dispatched") throw new Error("dispatch failed");
  await sleep(400);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa55-keys.png`);
  step("  keyboard shortcut matrix PASS");
};

/** PHASE C — honest gap + console + close */
const phaseC = async () => {
  console.log("== PHASE C: honest gap + console ==");
  sh(SEED_CLEAN);
  // always re-bootstrap: phase B may have navigated to the dashboard (and
  // standalone batches start with no page at all) — land on Results first
  await openJobResults();
  const rf = unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Refresh outputs');
    if (!b) return 'NO-REFRESH';
    b.click(); return 'refreshed';
  })()`));
  step(`  refresh: ${rf}`);
  if (rf !== "refreshed") throw new Error(rf);
  await sleep(2500);
  const { toasts } = await hookAndClickReport();
  if (!/Run report downloaded/i.test(toasts)) throw new Error(`toast missing: ${toasts}`);
  if (/FSC table & curve snapshot|resolution progress chart|CTF fit quality scatter|orientation distribution map|Topaz training curves/.test(toasts))
    throw new Error(`toast should be plain variant: ${toasts}`);
  const md = norm(await blobText());
  for (const s of ["## Resolution progress", "## FSC curve", "## Guinier plot",
    "## CTF fit quality", "## Angular distribution", "## Topaz training"]) {
    if (md.includes(s)) throw new Error(`${s} should be absent without data`);
  }
  // slim report: no Contents (3 sections < threshold), no TOC links — but its
  // 3 h2s still earn their explicit anchors
  if (md.includes("**Contents**")) throw new Error("Contents must be absent on a slim report");
  if (md.includes("](#")) throw new Error("TOC links must be absent on a slim report");
  const anchorCount = (md.match(/<a id="/g) || []).length;
  if (anchorCount !== 3) throw new Error(`slim report should have 3 anchors, got ${anchorCount}`);
  if (md.includes("data:image/png")) throw new Error("no PNG should be embedded without data");
  if (!md.includes("## Resolution") || !md.includes("## Outputs on disk"))
    throw new Error("base sections missing");
  step(`  honest-gap markdown OK (${md.length}B, no Contents, plain toast)`);
  const errs = sh(`${AB} errors`) || "(none)";
  step(`  console errors: ${errs}`);
  if (errs !== "(none)") throw new Error("console errors present");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa55-final.png`);
};

(async () => {
  if (PHASES.includes("A")) await phaseA();
  if (PHASES.includes("B")) await phaseB();
  if (PHASES.includes("C")) await phaseC();
  step("ALL PHASES GREEN");
  sh(`${AB} close`);
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  try { sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa55-fatal.png`); } catch { /* ignore */ }
  try { sh(SEED_CLEAN); } catch { /* ignore */ }
  try { sh(`${AB} close`); } catch { /* ignore */ }
  process.exit(1);
});
