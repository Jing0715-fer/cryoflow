// Task 47 QA — single browser session:
//   A  Dashboard KPI DRILL-DOWN: Running/Completed/Projects cards are real
//      buttons (aria-pressed) wired to a presence filter over the project
//      grid + scroll-into-view flash; Total jobs & engine stay plain divs;
//      grid presence chips mirror the KPI state both ways; empty filter
//      state shows a clear-filter affordance
//   B  Canvas KPI BAR drill-down: the completion item is a button that
//      navigates to the dashboard; resolution/running chips carry
//      "click to open" titles when present
//   C  console errors + screenshots
// Usage: QA_PHASES=A,B,C node scripts/qa47-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa47-trace.log", import.meta.url).pathname;
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

const PHASES = (process.env.QA_PHASES || "A,B,C").split(",");
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));

const openDashboard = async () => {
  sh(`${AB} open http://localhost:3000`);
  await sleep(4500);
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
  await sleep(2500);
};

// KPI band buttons (aria-pressed present) vs plain cards — by label.
// Approach: find the LABEL <p>, then climb to the nearest .card-lift shell —
// querySelectorAll('div') races ancestor containers against the card itself
// in document order and mislabels buttons as divs.
const kpiBand = () => J(`(() => {
  const labels = ['Projects', 'Total jobs', 'Running', 'Completed', 'Active engine'];
  const out = {};
  for (const label of labels) {
    const p = [...document.querySelectorAll('p')].find(x => x.textContent.trim() === label);
    if (!p) continue;
    const card = p.closest('.card-lift');
    if (!card) continue;
    out[label] = { tag: card.tagName, pressed: card.getAttribute('aria-pressed') };
  }
  return out;
})()`);

const clickKpi = (label) => unq(evalJs(`(() => {
  const btn = [...document.querySelectorAll('button[aria-pressed]')].find(b =>
    [...b.querySelectorAll('p')].some(p => p.textContent.trim() === '${label}'));
  if (!btn) return 'NO-BUTTON';
  btn.click(); return 'clicked';
})()`));

// grid state: visible project cards + the presence chips row
const gridState = () => J(`(() => {
  const sec = [...document.querySelectorAll('h2')].find(h => h.textContent.trim() === 'All projects');
  if (!sec) return null;
  const wrap = sec.closest('div[class*="ring"], div');
  const root = sec.parentElement.parentElement;
  const chips = root.querySelector('[aria-label="Filter projects by job presence"]');
  return {
    cards: root.querySelectorAll('.grid > div.group').length,
    chipRow: chips ? [...chips.querySelectorAll('button')].map(b => ({
      t: b.textContent.replace(/\\s+/g, ' ').trim(),
      // the count lives in its own tabular-nums span — textContent would
      // concatenate the kbd corner digit ("Completed 1"+"3" → parse 13),
      // which only looks right when the old sandbox had 13 such projects
      n: (() => { const s = [...b.querySelectorAll('span')].find(x => /tabular-nums/.test(x.className || '')); return s ? parseInt(s.textContent, 10) : null; })(),
      pressed: b.getAttribute('aria-pressed'),
    })) : null,
    flash: root.className.includes('ring-primary') || root.parentElement?.className?.includes('ring-primary'),
    empty: (root.textContent.match(/No project with \\w+ jobs right now/) || [null])[0],
    clearBtn: [...root.querySelectorAll('button')].some(b => b.textContent.trim() === 'Clear filter'),
  };
})()`);

/** PHASE A — KPI drill-down + grid presence chips */
const phaseA = async () => {
  console.log("== PHASE A: KPI drill-down ==");
  let band = kpiBand();
  for (let i = 0; i < 8 && (!band || !band.Running); i++) {
    await sleep(2000);
    band = kpiBand();
  }
  step(`  kpi band: ${JSON.stringify(band)}`);
  if (!band.Projects || !band.Running || !band.Completed)
    throw new Error(`clickable KPI cards missing: ${JSON.stringify(band)}`);
  if (band.Projects.tag !== "BUTTON" || band.Running.tag !== "BUTTON" || band.Completed.tag !== "BUTTON")
    throw new Error("Projects/Running/Completed must be buttons");
  if (band["Total jobs"]?.tag === "BUTTON" || band["Active engine"]?.tag === "BUTTON")
    throw new Error("Total jobs / engine must stay plain divs");
  if (band.Running.pressed !== "false" || band.Completed.pressed !== "false")
    throw new Error("initial aria-pressed must be false");

  let gs = gridState();
  step(`  grid: ${JSON.stringify(gs)}`);
  if (!gs || gs.chipRow === null) throw new Error("presence chip row missing");
  const allN = gs.cards;
  if (allN < 1) throw new Error("grid has no cards — cannot assert filtering");

  // --- click Running KPI card → pressed + grid narrows (or honest empty state)
  let r = clickKpi("Running");
  if (r !== "clicked") throw new Error(`Running card click: ${r}`);
  await sleep(600);
  band = kpiBand();
  gs = gridState();
  step(`  after Running click: pressed=${band.Running.pressed} cards=${gs.cards} chips=${JSON.stringify(gs.chipRow)}`);
  if (band.Running.pressed !== "true") throw new Error("Running card did not show pressed");
  const runChip = gs.chipRow.find((c) => c.t.startsWith("Running"));
  if (runChip && runChip.pressed !== "true") throw new Error("grid Running chip not synced");
  // read the tabular-nums span (runChip.n) — Task 55 added a kbd corner digit
  // to each presence chip, so textContent reads "Running 1"+"2" → 12 (same
  // trap the Completed path below already guards against)
  const expectedRunning = runChip ? (runChip.n ?? parseInt(runChip.t.replace(/[^\d]/g, ""), 10)) : 0;
  if (expectedRunning > 0) {
    if (gs.cards !== expectedRunning)
      throw new Error(`grid cards ${gs.cards} != presence.running ${expectedRunning}`);
  } else {
    if (!gs.empty || !gs.clearBtn)
      throw new Error(`empty state missing (empty=${gs.empty} clear=${gs.clearBtn})`);
  }
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa47-kpi-running.png`);

  // --- toggle off by clicking the card again
  clickKpi("Running");
  await sleep(500);
  band = kpiBand();
  gs = gridState();
  step(`  after toggle-off: pressed=${band.Running.pressed} cards=${gs.cards}`);
  if (band.Running.pressed !== "false" || gs.cards !== allN)
    throw new Error("toggle-off failed");

  // --- Completed card drill-down
  r = clickKpi("Completed");
  if (r !== "clicked") throw new Error(`Completed card click: ${r}`);
  await sleep(600);
  band = kpiBand();
  gs = gridState();
  step(`  after Completed click: pressed=${band.Completed.pressed} cards=${gs.cards}`);
  if (band.Completed.pressed !== "true") throw new Error("Completed card did not show pressed");
  const doneChip = gs.chipRow.find((c) => c.t.startsWith("Completed"));
  const expectedDone = doneChip ? (doneChip.n ?? parseInt(doneChip.t.replace(/[^\d]/g, ""), 10)) : 0;
  if (expectedDone > 0 && gs.cards !== expectedDone)
    throw new Error(`grid cards ${gs.cards} != presence.completed ${expectedDone}`);
  if (expectedDone === 0 && !gs.empty) throw new Error("expected empty state");

  // --- chip → KPI reverse sync: click the grid's All chip, KPI pressed resets
  const rev = unq(evalJs(`(() => {
    const g = document.querySelector('[aria-label="Filter projects by job presence"]');
    if (!g) return 'NO-CHIPS';
    const all = [...g.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('All'));
    if (!all) return 'NO-ALL';
    all.click(); return 'clicked';
  })()`));
  step(`  grid All chip: ${rev}`);
  if (rev !== "clicked") throw new Error(rev);
  await sleep(500);
  band = kpiBand();
  gs = gridState();
  step(`  after chip-All: completedPressed=${band.Completed.pressed} cards=${gs.cards}`);
  if (band.Completed.pressed !== "false" || gs.cards !== allN)
    throw new Error("chip→KPI reverse sync failed");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa47-grid.png`);
};

/** PHASE B — canvas KPI bar drill-down */
const phaseB = async () => {
  console.log("== PHASE B: canvas KPI bar ==");
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Workflow'); b?b.click():0; return 'nav'; })()`);
  await sleep(3500);
  let probes = null;
  for (let i = 0; i < 8; i++) {
    probes = J(`(() => {
      const bar = document.querySelector('[data-canvas-ui="pipeline-kpi"]');
      if (!bar) return null;
      const btns = [...bar.querySelectorAll('button')];
      return {
        buttons: btns.map(b => (b.getAttribute('aria-label') || b.title || '').slice(0, 90)),
        completion: btns.some(b => (b.getAttribute('aria-label') || '').includes('Pipeline completion')),
      };
    })()`);
    if (probes && probes.completion) break;
    await sleep(2000);
  }
  step(`  canvas kpi: ${JSON.stringify(probes)}`);
  if (!probes || !probes.completion)
    throw new Error("canvas pipeline-kpi completion button missing");
  for (const t of probes.buttons) {
    if (!/click to open/i.test(t)) throw new Error(`clickable KPI lacks affordance title: ${t}`);
  }

  // click completion → dashboard view
  evalJs(`(() => {
    const bar = document.querySelector('[data-canvas-ui="pipeline-kpi"]');
    const b = [...bar.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').includes('Pipeline completion'));
    b.click(); return 'ok';
  })()`);
  await sleep(2500);
  const onDash = unq(evalJs(`([...document.querySelectorAll('h1')].some(h => h.textContent.trim() === 'Dashboard') + '')`));
  step(`  back on dashboard: ${onDash}`);
  if (onDash !== "true") throw new Error("completion drill-down did not open the dashboard");
};

/** PHASE C — console + close */
const phaseC = async () => {
  console.log("== PHASE C: console ==");
  const errs = sh(`${AB} errors`) || "(none)";
  step(`  console errors: ${errs}`);
  if (errs !== "(none)") throw new Error("console errors present");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa47-final.png`);
};

(async () => {
  await openDashboard();
  if (PHASES.includes("A")) await phaseA();
  if (PHASES.includes("B")) await phaseB();
  if (PHASES.includes("C")) await phaseC();
  step("ALL PHASES GREEN");
  sh(`${AB} close`);
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa47-fatal.png`);
  sh(`${AB} close`);
  process.exit(1);
});
