// Task 46 QA — single browser session:
//   A  KPI sparkline TOUCH: tap an 84×24 KPI spark → crosshair chip pops
//      ("Sep 8 · N (+d)") → auto-dismisses ~2.8s (pointerleave never fires
//      for touch — the timer must)
//   B  spotlight Jobs STATUS FILTER: chips render with counts (All +
//      status tones) → click "Completed" → aria-pressed flips + row count ==
//      completed count → click "All" → full count restored
//   C  console errors + screenshots
// Usage: QA_PHASES=A,B,C node scripts/qa46-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa46-trace.log", import.meta.url).pathname;
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

const AB_ = AB;
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",");
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");

const realClick = async (findExpr) => {
  const coords = evalJs(
    `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
  );
  if (!coords || coords === "null") return "NO-ELEMENT";
  const c = JSON.parse(coords);
  sh(`${AB} mouse move ${c.x} ${c.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${c.x},${c.y}`;
};
step("helpers ready");

const openDashboard = async () => {
  sh(`${AB} open http://localhost:3000`);
  await sleep(4500);
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
  await sleep(2500);
};

/** PHASE A — KPI sparkline touch chip */
const phaseA = async () => {
  console.log("== PHASE A: KPI sparkline touch ==");
  const probe = JSON.parse(unq(evalJs(`(() => {
    const svgs = [...document.querySelectorAll('svg')].filter(s => s.getAttribute('viewBox') === '0 0 84 24');
    return { kpiSparks: svgs.length };
  })()`)) || "{}");
  step(`  kpi sparks: ${JSON.stringify(probe)}`);
  if ((probe.kpiSparks ?? 0) < 1) throw new Error("no interactive KPI sparkline on the dashboard");

  const tapped = await realClick(
    `[...document.querySelectorAll('svg')].find(s => s.getAttribute('viewBox') === '0 0 84 24')`,
  );
  step(`  tap: ${tapped}`);
  if (!tapped.includes("clicked@")) throw new Error("KPI spark not tappable");
  await sleep(400);
  const chip = unq(evalJs(`(() => {
    const chip = document.querySelector('span[aria-hidden="true"].pointer-events-none.absolute.bottom-full');
    return chip ? chip.textContent.replace(/\\s+/g, ' ').trim() : 'NO-CHIP';
  })()`));
  step(`  chip: ${chip}`);
  if (!/\w{3} \d{1,2} · [\d,]+/.test(chip)) throw new Error(`KPI chip wrong: ${chip}`);
  sh(`${AB_} screenshot /home/z/my-project/agent-ctx/qa46-kpi-chip.png`);

  // mouse tap keeps hover semantics — moving the pointer away dismisses
  sh(`${AB_} mouse move 700 700`);
  await sleep(400);
  const chipM = unq(evalJs(`(() => {
    const chip = document.querySelector('span[aria-hidden="true"].pointer-events-none.absolute.bottom-full');
    return chip ? 'STILL' : 'GONE';
  })()`));
  step(`  chip after mouse-leave: ${chipM}`);
  if (chipM !== "GONE") throw new Error("mouse leave did not dismiss");

  // true touch path: synthetic PointerEvent(pointerType='touch') → timer branch
  const touched = unq(evalJs(`(() => {
    const svg = [...document.querySelectorAll('svg')].find(s => s.getAttribute('viewBox') === '0 0 84 24');
    if (!svg) return 'NO-SVG';
    const r = svg.getBoundingClientRect();
    svg.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    return 'touched';
  })()`));
  step(`  touch-dispatch: ${touched}`);
  if (touched !== "touched") throw new Error(touched);
  await sleep(400);
  const chipT = unq(evalJs(`(() => {
    const chip = document.querySelector('span[aria-hidden="true"].pointer-events-none.absolute.bottom-full');
    return chip ? chip.textContent.replace(/\\s+/g, ' ').trim() : 'NO-CHIP';
  })()`));
  step(`  touch chip: ${chipT}`);
  if (!/\w{3} \d{1,2} · [\d,]+/.test(chipT)) throw new Error(`touch chip wrong: ${chipT}`);
  // auto-dismiss ~2.6s (touch has no pointerleave)
  await sleep(3000);
  const chip2 = unq(evalJs(`(() => {
    const chip = document.querySelector('span[aria-hidden="true"].pointer-events-none.absolute.bottom-full');
    return chip ? chip.textContent : 'GONE';
  })()`));
  step(`  chip after 3s: ${chip2}`);
  if (chip2 !== "GONE") throw new Error("touch chip did not auto-dismiss");
};

/** PHASE B — spotlight Jobs status filter */
const phaseB = async () => {
  console.log("== PHASE B: spotlight status filter ==");
  // the spotlight needs the store's /api/project fetch to land — on a cold
  // server that compile+fetch window can outlive the plain 2.5s wait
  let sec = "false";
  for (let i = 0; i < 10 && sec !== "true"; i++) {
    sec = unq(evalJs(`(!!document.querySelector('section[aria-label="Active project spotlight"]') + '')`));
    if (sec !== "true") {
      // fallback: bounce through the canvas so switchProject re-runs, then back
      if (i === 4) {
        evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Workflow'); b?b.click():0; return 'nav'; })()`);
        await sleep(2500);
        evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
      }
      await sleep(2000);
    }
  }
  if (sec !== "true") {
    const diag = unq(evalJs(`(() => ({
      secs: [...document.querySelectorAll('section[aria-label]')].map(x => x.getAttribute('aria-label')),
      topbar: document.querySelector('header, nav') ? document.querySelector('header, nav').textContent.replace(/\\s+/g, ' ').slice(0, 120) : 'NO-HEADER',
      h2s: [...document.querySelectorAll('h2')].map(h => h.textContent.trim()),
    }))()`));
    throw new Error(`spotlight section missing (no active project?) | diag: ${diag}`);
  }

  const chips0 = JSON.parse(unq(evalJs(`(() => {
    const g = document.querySelector('section[aria-label="Active project spotlight"] [aria-label="Filter jobs by status"]');
    if (!g) return null;
    return [...g.querySelectorAll('button')].map(b => b.textContent.replace(/\\s+/g, ' ').trim());
  })()`) || "null"));
  step(`  chips: ${JSON.stringify(chips0)}`);
  if (!Array.isArray(chips0) || chips0.length < 2 || !chips0[0].startsWith("All"))
    throw new Error(`filter chips wrong: ${JSON.stringify(chips0)}`);

  const rowCount = () => JSON.parse(unq(evalJs(`(() => {
    const g = document.querySelector('section[aria-label="Active project spotlight"] [aria-label="Filter jobs by status"]');
    let list = g && g.nextElementSibling;
    return { rows: list ? list.querySelectorAll('button[title^="Open "]').length : -1 };
  })()`))).rows;

  const allN = parseInt(chips0[0].replace(/[^\d]/g, ""), 10);
  if (rowCount() !== allN) throw new Error(`All rows ${rowCount()} != chip ${allN}`);

  // find the Completed chip index (label contains "Completed")
  const cIdx = chips0.findIndex((t) => t.startsWith("Completed"));
  if (cIdx >= 1) {
    const completedN = parseInt(chips0[cIdx].replace(/[^\d]/g, ""), 10);
    const clk = unq(evalJs(`(() => {
      const b = [...document.querySelectorAll('section[aria-label="Active project spotlight"] [aria-label="Filter jobs by status"] button')].find(x => x.textContent.trim().startsWith('Completed'));
      if (!b) return 'NO-CHIP'; b.click(); return 'clicked';
    })()`));
    step(`  completed chip click: ${clk}`);
    if (clk !== "clicked") throw new Error(clk);
    await sleep(500);
    const pressed = JSON.parse(unq(evalJs(`(() => {
      const g = document.querySelector('section[aria-label="Active project spotlight"] [aria-label="Filter jobs by status"]');
      const bs = [...g.querySelectorAll('button')];
      return { completed: bs.find(b => b.textContent.trim().startsWith('Completed')).getAttribute('aria-pressed'),
               all: bs[0].getAttribute('aria-pressed') };
    })()`)));
    step(`  pressed after Completed click: ${JSON.stringify(pressed)} | rows: ${rowCount()} (expect ${completedN})`);
    if (pressed.completed !== "true" || pressed.all !== "false") throw new Error("aria-pressed did not flip");
    if (rowCount() !== completedN) throw new Error(`filtered rows ${rowCount()} != completed ${completedN}`);
    sh(`${AB_} screenshot /home/z/my-project/agent-ctx/qa46-filter.png`);
  }

  // back to All
  evalJs(`(() => { const b = [...document.querySelectorAll('section[aria-label="Active project spotlight"] [aria-label="Filter jobs by status"] button')].find(x => x.textContent.trim().startsWith('All')); b && b.click(); return 'all-clicked'; })()`);
  await sleep(500);
  if (rowCount() !== allN) throw new Error(`All restore failed: ${rowCount()} != ${allN}`);
  step(`  All restored: ${rowCount()} rows`);
};

/** PHASE C — console + close */
const phaseC = async () => {
  console.log("== PHASE C: console ==");
  const errs = sh(`${AB} errors`) || "(none)";
  step(`  console errors: ${errs}`);
  if (errs !== "(none)") throw new Error("console errors present");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa46-final.png`);
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
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa46-fatal.png`);
  sh(`${AB} close`);
  process.exit(1);
});
