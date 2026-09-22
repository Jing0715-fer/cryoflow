// Task 51 QA — run report phase 2 (resolution progress + Guinier snapshot
// sections join the FSC one):
//   A  FULL REPORT: seed postprocess.star (fsc + guinier + B-factor) AND
//      run_itXXX_half1_model.star family → Results → Report → markdown
//      asserts (Resolution progress table+PNG, FSC table+PNG regression,
//      Guinier B-factor + table+PNG, section order, 3 PNGs at 1280×560)
//   B  HONEST GAP: clean seed → report again → all three chart sections
//      absent, plain toast, tiny blob
//   C  console errors + close
// Usage: QA_PHASES=A,B,C node scripts/qa51-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa51-trace.log", import.meta.url).pathname;
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

const SEED = "python3 /home/z/my-project/scripts/qa51-seed-report.py";
const SEED_CLEAN = "python3 /home/z/my-project/scripts/qa51-seed-report.py --clean";
const JOB = "QA Refine3D";

const openJobResults = async () => {
  sh(`${AB} open http://localhost:3000`);
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
  // a poll (qa50 lesson: an IIFE without call parens compares fn source)
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
      secs: [...document.querySelectorAll('section[aria-label]')].map(s => s.getAttribute('aria-label')),
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
            window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 200) });
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
  await sleep(6000); // three rasterizations join the fetch set — give room
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

const norm = (mdRaw) =>
  mdRaw.includes("\\n") && !mdRaw.includes("\n") ? mdRaw.replace(/\\n/g, "\n") : mdRaw;

/** PHASE A — full report with all three snapshot sections */
const phaseA = async () => {
  console.log("== PHASE A: full report (progress + fsc + guinier) ==");
  step("  seeding postprocess.star + iteration family …");
  sh(SEED);
  await openJobResults();

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
    throw new Error(`toast not enriched variant: ${toasts}`);
  // 3 SVG intermediates + 1 markdown blob; markdown is the LAST
  if (blobs.n < 4) throw new Error(`expected ≥4 blobs (3 svg + md), got ${JSON.stringify(blobs)}`);
  const size = blobs.sizes[blobs.sizes.length - 1] ?? 0;
  if (size < 60_000) throw new Error(`blob suspiciously small for 3 PNG embeds: ${size}B`);

  const md = norm(await blobText());
  step(`  md bytes: ${md.length}`);
  if (!md.includes("# CryoFlow run report")) throw new Error("md head missing");
  const asserts = [
    ["## Resolution", "resolution section"],
    ["Refinement resolution: current **3.18 Å**, best **3.18 Å**", "refine line from points"],
    ["## Resolution progress", "progress section"],
    ["Per-iteration `_rlnCurrentResolution`", "progress note"],
    ["| Iteration | Resolution (Å) |", "progress table header"],
    ["| 2 | 28.50 |", "progress first row"],
    ["| 30 | 3.18 |", "progress last row"],
    ["![Resolution progress — 3.18 Å at iteration 30 for " + JOB + "]", "progress png alt"],
    ["## FSC curve", "fsc section"],
    ["| Resolution (Å) | Unmasked FSC | Masked + corrected | Phase-rand noise |", "fsc table header"],
    ["![FSC curve — 3.12 Å", "fsc png alt"],
    ["## Guinier plot", "guinier section"],
    ["Applied B-factor: **-52.4 Å²**", "bfactor line"],
    ["| 1/d² (Å⁻²) | ln amplitude | after sharpening |", "guinier table header"],
    ["![Guinier plot for " + JOB + "]", "guinier png alt"],
    ["## Outputs on disk", "outputs intact"],
  ];
  for (const [needle, label] of asserts) {
    if (!md.includes(needle)) throw new Error(`report missing ${label}: "${needle}"`);
  }
  // strict section order
  const order = ["## Resolution", "## Resolution progress", "## FSC curve", "## Guinier plot", "## Outputs on disk"]
    .map((s) => md.indexOf(s));
  if (order.some((i) => i < 0) || !order.every((v, i) => i === 0 || v > order[i - 1]))
    throw new Error(`section order broken: ${order.join(",")}`);
  // three embedded PNGs, each 1280×560; save for the eyeball
  const pngs = [...md.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)].map((m) => m[1]);
  step(`  embedded PNGs: ${pngs.length}`);
  // three legacy snapshot PNGs minimum — phase-3 (Task 52) may append more
  // (CTF scatter + orientation heatmap); the count stays future-tolerant
  if (pngs.length < 3) throw new Error(`want ≥3 embedded PNGs, got ${pngs.length}`);
  const names = ["resolution", "fsc", "guinier"];
  pngs.slice(0, 3).forEach((b64, i) => {
    const bin = Buffer.from(b64.slice(0, 120), "base64");
    const w = bin.readUInt32BE(16);
    const h = bin.readUInt32BE(20);
    step(`  png[${names[i]}]: ${w}x${h}`);
    if (w !== 1280 || h !== 560) throw new Error(`png[${i}] dims wrong: ${w}x${h}`);
    writeFileSync(`/home/z/my-project/agent-ctx/qa51-snap-${names[i]}.png`, Buffer.from(b64, "base64"));
  });
  step("  ALL markdown assertions PASS");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa51-report.png`);
};

/** PHASE B — honest gap when no chart data */
const phaseB = async () => {
  console.log("== PHASE B: honest gap (no chart data) ==");
  sh(SEED_CLEAN);
  const rf = unq(evalJs(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Refresh outputs');
    if (!b) return 'NO-REFRESH';
    b.click(); return 'refreshed';
  })()`));
  step(`  refresh: ${rf}`);
  if (rf !== "refreshed") throw new Error(rf);
  await sleep(2500);
  const { toasts, blobs } = await hookAndClickReport();
  if (!/Run report downloaded/i.test(toasts)) throw new Error(`toast missing: ${toasts}`);
  if (/FSC table & curve snapshot|resolution progress chart/.test(toasts))
    throw new Error(`toast should be plain variant: ${toasts}`);
  const md = norm(await blobText());
  for (const s of ["## Resolution progress", "## FSC curve", "## Guinier plot"]) {
    if (md.includes(s)) throw new Error(`${s} should be absent without data`);
  }
  // the sandbox workdir now carries OTHER honest data sources (Task 53+
  // charts: micrographs_ctf.star, run_data.star, topaz logs) — the honest-
  // gap contract is about the FSC section specifically: it must be absent,
  // and no FSC-flavored PNG may embed. Other charts legitimately render
  // from whatever data still exists in the workdir.
  if (md.includes("## FSC curve") || /!\[[^\]]*FSC/i.test(md))
    throw new Error("FSC section or PNG should be absent without the seed");
  if (!md.includes("## Resolution") || !md.includes("## Outputs on disk"))
    throw new Error("base sections missing");
  step(`  honest-gap markdown OK (${md.length}B, plain toast)`);
};

/** PHASE C — console + close */
const phaseC = async () => {
  console.log("== PHASE C: console ==");
  const errs = sh(`${AB} errors`) || "(none)";
  step(`  console errors: ${errs}`);
  if (errs !== "(none)") throw new Error("console errors present");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa51-final.png`);
};

(async () => {
  if (PHASES.includes("A")) await phaseA();
  else {
    sh(`${AB} open http://localhost:3000`);
    await sleep(7000);
  }
  if (PHASES.includes("B")) await phaseB();
  if (PHASES.includes("C")) await phaseC();
  step("ALL PHASES GREEN");
  sh(`${AB} close`);
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa51-fatal.png`);
  sh(SEED_CLEAN);
  sh(`${AB} close`);
  process.exit(1);
});
