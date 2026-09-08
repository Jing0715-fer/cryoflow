// Task 50 QA — enriched Markdown run report (FSC milestone table + curve
// snapshot PNG + fuller Resolution lines) on top of Task 49's export:
//   A  ENRICHED REPORT: seed a postprocess.star into the sandbox refine3d
//      workdir → open Results → FSC chart renders → hook createObjectURL →
//      click Report → markdown asserts (FSC section + milestone table +
//      PNG data URL + 0.5/reported/Nyquist lines) + toast enriched variant
//   B  HONEST GAP: remove the seed → refresh → report again → markdown has
//      NO FSC section, toast falls back to the plain variant, small blob
//   C  console errors + close
// Usage: QA_PHASES=A,B,C node scripts/qa50-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa50-trace.log", import.meta.url).pathname;
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

const SEED = "python3 /home/z/my-project/scripts/qa50-seed-fsc.py";
const SEED_CLEAN = "python3 /home/z/my-project/scripts/qa50-seed-fsc.py --clean";
const JOB = "3D Auto-Refine 1";

const openJobResults = async () => {
  sh(`${AB} open http://localhost:3000`);
  await sleep(6000);
  // cold-compile tolerant: poll for the job card, click it
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
  // sanity probe — a freshly written probe must prove it can return true
  // before it's allowed to gate a poll (qa46 lesson, re-earned today: the
  // first draft of this line was `(() => x) + ''` — an IIFE never invoked,
  // so the poll compared a FUNCTION SOURCE string and was always false)
  const sanity = unq(evalJs(`(() => !!document.querySelectorAll('button').length)() + ''`));
  if (sanity !== "true") throw new Error(`probe sanity failed: "${sanity}"`);
  // wait for the Report button (poll — results view fetches outputs AND
  // turbopack may cold-compile the edited chunk on first navigation)
  let ok = false;
  for (let i = 0; i < 24 && !ok; i++) {
    await sleep(1500);
    ok = unq(evalJs(`(() => !![...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Export run report'))() + ''`)) === "true";
  }
  if (!ok) {
    const dump = J(`(() => {
      const tabs = [...document.querySelectorAll('[role=tab]')].map(t => t.textContent.trim());
      const secs = [...document.querySelectorAll('section[aria-label]')].map(s => s.getAttribute('aria-label'));
      const btns = [...document.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label')).slice(0, 15);
      const h1 = document.querySelector('h1')?.textContent?.trim() ?? null;
      return { tabs, secs, btns, h1, url: location.pathname };
    })()`);
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
  // PNG rasterization joins the fetch set — give it room
  await sleep(4500);
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

/** PHASE A — enriched report with FSC table + PNG snapshot */
const phaseA = async () => {
  console.log("== PHASE A: enriched report ==");
  step("  seeding postprocess.star …");
  sh(SEED);
  await openJobResults();

  // the in-app FSC chart must light up from the seeded star (regression:
  // the same payload feeds both chart and report)
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
  if (blobs.n < 1) throw new Error("blob not captured");
  const size = blobs.sizes[blobs.sizes.length - 1] ?? 0;
  if (size < 20_000) throw new Error(`blob suspiciously small for a PNG embed: ${size}B`);

  const mdRaw = await blobText();
  // the eval bridge JSON-stringifies blob text — literal "\\n" when the
  // bridge doesn't unwrap; normalize so line-based assertions see real lines
  const md = mdRaw.includes("\\n") && !mdRaw.includes("\n")
    ? mdRaw.replace(/\\n/g, "\n")
    : mdRaw;
  step(`  md bytes: ${md.length}`);
  if (!md.includes("# CryoFlow run report")) throw new Error("md head missing");
  const asserts = [
    ["## FSC curve", "FSC section"],
    ["Source: postprocess.star", "source line"],
    ["| Resolution (Å) | Unmasked FSC | Masked + corrected | Phase-rand noise |", "milestone table header"],
    ["![FSC curve — 3.12 Å", "png alt text"],
    ["data:image/png;base64,iVBORw0KGgo", "png magic"],
    ["RELION reported: **3.12 Å**", "reported line"],
    ["RELION final resolution (masked, sharpened)", "reported label"],
    ["Box Nyquist limit (2 × pixel size): **2.86 Å**", "nyquist line"],
    ["0.5 (half-bit) resolution: **3.58 Å**", "half-bit line"],
    ["## Outputs on disk", "outputs intact"],
  ];
  for (const [needle, label] of asserts) {
    if (!md.includes(needle)) throw new Error(`report missing ${label}: "${needle}"`);
  }
  // milestone rows: ≥8 checkpoints earned rows (Nyquist 2.86 Å → milestones
  // 20/15/10/8/6/5/4/3.5/3/2.5 all within the 15 % tolerance band); per-row
  // shape: corrected sits between phase-noise and unmasked (mask-boost order)
  const rows = md.split("\n").filter((l) => /^\| \d+\.\d{2} \| \d\.\d{3} \| \d\.\d{3} \| \d\.\d{3} \|$/.test(l));
  step(`  milestone rows: ${rows.length} (first: ${rows[0] ?? "none"})`);
  if (rows.length < 8) throw new Error(`too few milestone rows: ${rows.length}`);
  for (const r of rows) {
    // "| res | unmasked | corrected | phase |" — split("|") leads with ""
    const [, res, un, co, ph] = r.split("|").map((s) => parseFloat(s));
    if (!(res > 0 && ph <= co && co <= un)) throw new Error(`curve order broken in row: ${r}`);
  }
  // FSC section must sit between Resolution and Outputs
  const iRes = md.indexOf("## Resolution");
  const iFsc = md.indexOf("## FSC curve");
  const iOut = md.indexOf("## Outputs on disk");
  if (!(iRes < iFsc && iFsc < iOut)) throw new Error("FSC section out of order");
  // sanity: the snapshot PNG is 640x280@2x = 1280x560 — check IHDR dims,
  // and decode it to disk so the curve can be eyeballed later
  const b64 = md.split("data:image/png;base64,")[1]?.split(")")[0] ?? "";
  if (b64.length > 100) {
    const bin = Buffer.from(b64.slice(0, 120), "base64");
    const w = bin.readUInt32BE(16);
    const h = bin.readUInt32BE(20);
    step(`  png dims: ${w}x${h}`);
    if (w !== 1280 || h !== 560) throw new Error(`png dims wrong: ${w}x${h} (want 2x of 640x280)`);
    const pngPath = "/home/z/my-project/agent-ctx/qa50-fsc-snapshot.png";
    writeFileSync(pngPath, Buffer.from(b64, "base64"));
    step(`  png saved for visual check: ${pngPath}`);
  }
  step("  ALL markdown assertions PASS");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa50-report.png`);
};

/** PHASE B — honest gap when no FSC data */
const phaseB = async () => {
  console.log("== PHASE B: honest gap (no FSC data) ==");
  sh(SEED_CLEAN);
  // refresh outputs + give the FSC API's mtime-keyed cache a beat
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
  if (/FSC table & curve snapshot/.test(toasts))
    throw new Error(`toast should be plain variant: ${toasts}`);
  const mdRaw = await blobText();
  const md = mdRaw.includes("\\n") && !mdRaw.includes("\n")
    ? mdRaw.replace(/\\n/g, "\n")
    : mdRaw;
  if (md.includes("## FSC curve")) throw new Error("FSC section should be absent without data");
  if (md.includes("data:image/png")) throw new Error("no PNG should be embedded without data");
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
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa50-final.png`);
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
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa50-fatal.png`);
  sh(SEED_CLEAN);
  sh(`${AB} close`);
  process.exit(1);
});
