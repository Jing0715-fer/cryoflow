// Task 53 QA — #5 hardening round 2 (Host pinning closes DNS-rebinding,
// gates extended to outputs/file) + Topaz training section joins the
// report snapshot suite (sixth chart):
//   A  FULL REPORT: Task 52 seed superset + topaz_training.txt (30 epochs,
//      overfit-after-24 signature) → Results → Report → markdown asserts
//      (six sections in order, topaz summary/table/PNG, 6 PNGs IHDR-checked)
//   B  SECURITY GATES (curl): same-origin + Host pinning matrix on
//      /api/fs/browse and /api/jobs/[id]/outputs/file — the rebinding
//      simulation (Host:evil + Origin:http://evil.com) must 403 (the old
//      origin-only gate passed it), bare-curl on outputs/file must 403
//   C  HONEST GAP + CONSOLE: clean seed → report again → all six chart
//      sections absent, plain toast, zero PNGs; console 0 errors
// Usage: QA_PHASES=A,B,C node scripts/qa53-e2e.mjs
import { execSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa53-trace.log", import.meta.url).pathname;
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
const JID = "cmts0qoho0003p8da75rvxycc";
const B = "http://localhost:3000";

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

const norm = (mdRaw) =>
  mdRaw.includes("\\n") && !mdRaw.includes("\n") ? mdRaw.replace(/\\n/g, "\n") : mdRaw;

/** PHASE A — full report with all six snapshot sections */
const phaseA = async () => {
  console.log("== PHASE A: full report (…+ ctf + angdist + topaz) ==");
  step("  seeding Task52 superset + topaz_training.txt …");
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
  if (!/CTF fit quality scatter \+ orientation distribution map/.test(toasts))
    throw new Error(`toast phase-3 bits missing: ${toasts}`);
  if (!/Topaz training curves/.test(toasts))
    throw new Error(`toast topaz bit missing: ${toasts}`);
  // 6 SVG intermediates + 1 markdown blob; markdown is the LAST
  if (blobs.n < 7) throw new Error(`expected ≥7 blobs (6 svg + md), got ${JSON.stringify(blobs)}`);
  const size = blobs.sizes[blobs.sizes.length - 1] ?? 0;
  if (size < 100_000) throw new Error(`blob suspiciously small for 6 PNG embeds: ${size}B`);

  const md = norm(await blobText());
  step(`  md bytes: ${md.length}`);
  if (!md.includes("# CryoFlow run report")) throw new Error("md head missing");
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
    // phase-6: topaz training
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
  // strict section order — topaz slots between Angular distribution and Outputs
  const order = ["## Resolution", "## Resolution progress", "## FSC curve", "## Guinier plot",
    "## CTF fit quality", "## Angular distribution", "## Topaz training", "## Outputs on disk"]
    .map((s) => md.indexOf(s));
  if (order.some((i) => i < 0) || !order.every((v, i) => i === 0 || v > order[i - 1]))
    throw new Error(`section order broken: ${order.join(",")}`);
  // six embedded PNGs: line charts @640×280 (→1280×560), ctf/angdist @640×320 (→1280×640)
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
    writeFileSync(`/home/z/my-project/agent-ctx/qa53-snap-${names[i]}.png`, Buffer.from(b64, "base64"));
  });
  step("  ALL markdown assertions PASS");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa53-report.png`);
};

/** PHASE B — security gates (curl; no browser involved) */
const phaseB = async () => {
  console.log("== PHASE B: #5 hardening gates ==");
  const code = (url, extra = []) =>
    sh(`curl -s -o /dev/null -w "%{http_code}" ${extra.map((h) => `-H "${h}"`).join(" ")} "${url}"`);
  const cases = [
    // [label, url, headers, want]
    ["fs/browse control (same-origin Origin header)", `${B}/api/fs/browse`, ["Origin: http://localhost:3000"], "200"],
    ["fs/browse cross-site Origin", `${B}/api/fs/browse`, ["Origin: http://evil.com"], "403"],
    ["fs/browse DNS-rebinding (Host+Origin both evil)", `${B}/api/fs/browse`, ["Host: evil.com", "Origin: http://evil.com"], "403"],
    ["fs/browse bare curl (no fetch metadata)", `${B}/api/fs/browse`, [], "403"],
    ["outputs/file bare curl (was UNPROTECTED before)", `${B}/api/jobs/${JID}/outputs/file?path=x.mrc`, [], "403"],
    ["outputs/file control (passes gate → business 404)", `${B}/api/jobs/${JID}/outputs/file?path=x.mrc`, ["Origin: http://localhost:3000"], "404"],
    ["outputs/file cross-site Origin", `${B}/api/jobs/${JID}/outputs/file?path=x.mrc`, ["Origin: http://evil.com"], "403"],
    ["outputs/file DNS-rebinding", `${B}/api/jobs/${JID}/outputs/file?path=x.mrc`, ["Host: evil.com", "Origin: http://evil.com"], "403"],
  ];
  for (const [label, url, headers, want] of cases) {
    const got = code(url, headers);
    step(`  ${got} (want ${want}) — ${label}`);
    if (got !== want) throw new Error(`gate matrix failure: ${label} → ${got} (want ${want})`);
  }
  // control sanity: the HOST allowlist must accept our own interface IP too
  const ip = sh(`hostname -I | awk '{print $1}'`).trim();
  if (ip) {
    const got = code(`http://${ip}:3000/api/fs/browse`, [`Host: ${ip}:3000`]);
    step(`  own interface IP ${ip} → ${got} (want 403 via missing metadata — gate ORDER proves pin ran)`);
    // bare curl from our own IP: still 403 (no fetch metadata) — but the
    // important part is the request was not blocked by Host pinning path
    // before metadata check; assert it IS the metadata 403 by adding Origin
    const ok = code(`http://${ip}:3000/api/fs/browse`, [`Host: ${ip}:3000`, `Origin: http://${ip}:3000`]);
    step(`  own IP + matching Origin → ${ok} (want 200 — LAN access survives the pin)`);
    if (ok !== "200") throw new Error(`own-interface access broken: ${ok}`);
  }
};

/** PHASE C — honest gap + console + close */
const phaseC = async () => {
  console.log("== PHASE C: honest gap + console ==");
  sh(SEED_CLEAN);
  if (!PHASES.includes("A")) await openJobResults();
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
  if (/FSC table & curve snapshot|resolution progress chart|CTF fit quality scatter|orientation distribution map|Topaz training curves/.test(toasts))
    throw new Error(`toast should be plain variant: ${toasts}`);
  const md = norm(await blobText());
  for (const s of ["## Resolution progress", "## FSC curve", "## Guinier plot",
    "## CTF fit quality", "## Angular distribution", "## Topaz training"]) {
    if (md.includes(s)) throw new Error(`${s} should be absent without data`);
  }
  if (md.includes("data:image/png")) throw new Error("no PNG should be embedded without data");
  if (!md.includes("## Resolution") || !md.includes("## Outputs on disk"))
    throw new Error("base sections missing");
  step(`  honest-gap markdown OK (${md.length}B, plain toast)`);
  const errs = sh(`${AB} errors`) || "(none)";
  step(`  console errors: ${errs}`);
  if (errs !== "(none)") throw new Error("console errors present");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa53-final.png`);
};

(async () => {
  if (PHASES.includes("A")) await phaseA();
  if (PHASES.includes("B")) await phaseB();
  if (PHASES.includes("C")) await phaseC();
  step("ALL PHASES GREEN");
  sh(`${AB} close`);
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  try { sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa53-fatal.png`); } catch { /* ignore */ }
  try { sh(SEED_CLEAN); } catch { /* ignore */ }
  try { sh(`${AB} close`); } catch { /* ignore */ }
  process.exit(1);
});
