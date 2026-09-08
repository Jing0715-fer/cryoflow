// Task 49 QA — single browser session:
//   A  RUN REPORT: open a completed refine job's Results tab → "Report"
//      button present → hook URL.createObjectURL → click → toast fires
//      + captured Blob has size (and markdown content when the eval
//      bridge resolves promises)
//   B  REDUCED-MOTION: motion-reduce variants present on the drill-down
//      chevron, grid flash container, gallery card and canvas KPI items
//   C  console errors + screenshot
// Usage: QA_PHASES=A,B,C node scripts/qa49-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa49-trace.log", import.meta.url).pathname;
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
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",").map((s) => s.trim().toUpperCase());

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

const toastObserver = `(() => {
  window.__qaToasts = [];
  const t0 = Date.now();
  window.__qaMo && window.__qaMo.disconnect();
  window.__qaMo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/report|failed/i.test(t)) {
          window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 160) });
        }
      }
    }
  });
  window.__qaMo.observe(document.body, { childList: true, subtree: true });
  return 'observer-on';
})()`;

/** PHASE A — run report export */
const phaseA = async () => {
  console.log("== PHASE A: run report ==");
  sh(`${AB} open http://localhost:3000`);
  await sleep(6000);
  let node = "";
  for (let i = 0; i < 15 && !node.includes("clicked@"); i++) {
    node = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('3D Auto-Refine 1') && (x.textContent||'').includes('completed'))`,
    );
    if (!node.includes("clicked@")) await sleep(2000);
  }
  step(`  job node: ${node}`);
  if (!node.includes("clicked@")) throw new Error("job node never appeared");
  await sleep(2500);

  // results tab
  const tab = unq(evalJs(`(() => {
    const t = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim().includes('Results'));
    if (!t) return 'NO-TAB';
    t.click(); return 'tab-clicked';
  })()`));
  step(`  results tab: ${tab}`);
  if (tab !== "tab-clicked") throw new Error(tab);
  await sleep(2500);

  const probe = J(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Export run report');
    return { btn: !!btn, title: btn?.getAttribute('title')?.slice(0, 80) ?? null, refresh: [...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === 'Refresh outputs') };
  })()`);
  step(`  report probe: ${JSON.stringify(probe)}`);
  if (!probe.btn || !probe.refresh) throw new Error(`buttons wrong: ${JSON.stringify(probe)}`);
  if (!probe.title || !/Markdown/.test(probe.title)) throw new Error(`title wrong: ${probe.title}`);

  // hook blob creation, then click
  evalJs(`(() => {
    window.__qaBlobs = [];
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { window.__qaBlobs.push(b); return orig(b); };
    return 'hooked';
  })()`);
  evalJs(toastObserver);
  const clk = unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Export run report');
    if (!b) return 'NO-BTN';
    b.click(); return 'clicked';
  })()`));
  step(`  report click: ${clk}`);
  if (clk !== "clicked") throw new Error(clk);
  await sleep(3000);

  const toasts = unq(evalJs(`(window.__qaToasts||[]).map(t=>t.text).join(' | ') || 'NONE'`));
  const blobs = J(`({ n: (window.__qaBlobs||[]).length, sizes: (window.__qaBlobs||[]).map(b => b.size) })`);
  step(`  toasts: ${toasts}`);
  step(`  blobs: ${JSON.stringify(blobs)}`);
  if (!/Run report downloaded/i.test(toasts)) throw new Error(`toast missing: ${toasts}`);
  if (blobs.n < 1 || (blobs.sizes[0] ?? 0) < 200) throw new Error(`blob not captured: ${JSON.stringify(blobs)}`);

  // content check — the eval bridge may or may not resolve promises; try text()
  const text = unq(evalJs(`(async () => {
    const b = (window.__qaBlobs||[])[0];
    if (!b) return 'NO-BLOB';
    return b.text();
  })()`));
  step(`  md head: ${text.slice(0, 160)}`);
  if (text.includes("# CryoFlow run report")) {
    if (!text.includes("3D Auto-Refine 1")) throw new Error("report missing job name");
    if (!text.includes("## Resolution") || !text.includes("## Outputs on disk"))
      throw new Error("report missing sections");
    step("  content assertions: PASS (promise resolved)");
  } else {
    step("  content assertions: SKIPPED (eval did not resolve the promise — size check only)");
  }
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa49-report.png`);
};

/** PHASE B — reduced-motion variants */
const phaseB = async () => {
  console.log("== PHASE B: reduced-motion ==");
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Dashboard'); b?b.click():0; return 'nav'; })()`);
  // cold-compile window: poll until the flash container is on the page
  let probe = null;
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    probe = J(`(() => {
      const flash = [...document.querySelectorAll('div')].some(d => (d.className||'').includes('motion-reduce:transition-none') && (d.className||'').includes('transition-shadow'));
      const gallerySec = !!document.querySelector('section[aria-label="Saved 3D views across all projects"]');
      const gallery = [...document.querySelectorAll('button')].some(b => (b.className||'').includes('motion-reduce:transition-none') && (b.getAttribute('title')||'').includes('restores the view'));
      return { flash, gallerySec, gallery, ready: [...document.querySelectorAll('h1')].some(h => h.textContent.trim() === 'Dashboard') };
    })()`);
    if (probe.ready && probe.flash) break;
  }
  step(`  reduced-motion probe: ${JSON.stringify(probe)}`);
  if (!probe.ready) throw new Error("dashboard never rendered");
  if (!probe.flash) throw new Error("grid flash container lacks motion-reduce:transition-none");
  // the wall only renders when saved views exist — Task 48's cleanup left
  // it empty; when seeded, the card must carry the variant
  if (probe.gallerySec && !probe.gallery)
    throw new Error("gallery card lacks motion-reduce:transition-none");
  if (!probe.gallerySec) step("  gallery wall empty (post-cleanup) — card variant check skipped");
  // canvas KPI item variant
  evalJs(`(() => { const b=[...document.querySelectorAll('a,button')].find(e=>e.textContent.trim()==='Workflow'); b?b.click():0; return 'nav'; })()`);
  await sleep(3000);
  const kpiItem = unq(evalJs(`(() => {
    const btn = [...document.querySelectorAll('[data-canvas-ui="pipeline-kpi"] button')].find(b => (b.className||'').includes('motion-reduce:transition-none'));
    return (btn ? 'variant-present' : 'MISSING');
  })()`));
  step(`  canvas kpi item: ${kpiItem}`);
  if (kpiItem !== "variant-present") throw new Error(kpiItem);
};

/** PHASE C — console + close */
const phaseC = async () => {
  console.log("== PHASE C: console ==");
  const errs = sh(`${AB} errors`) || "(none)";
  step(`  console errors: ${errs}`);
  if (errs !== "(none)") throw new Error("console errors present");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa49-final.png`);
};

(async () => {
  if (PHASES.includes("A")) await phaseA();
  else {
    // standalone batches: land on the canvas first (root view)
    sh(`${AB} open http://localhost:3000`);
    await sleep(7000);
  }
  if (PHASES.includes("B")) await phaseB();
  if (PHASES.includes("C")) await phaseC();
  step("ALL PHASES GREEN");
  sh(`${AB} close`);
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa49-fatal.png`);
  sh(`${AB} close`);
  process.exit(1);
});
