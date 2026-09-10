// Task 114 QA — the job inspector prints as a JOB REPORT ("frontmost
// document wins"): Task 70 taught dialogs to step aside, but the inspector
// is the analysis reader, not chrome. With it open, Ctrl+P yields the
// report — masthead, active tab body, workdir footer — not the pipeline.
//   S  SEED + REACH: qa60 seed → inspector on QA Post 320 (Results
//      auto-tab) → print hooks present, masthead screen-hidden
//   A  PDF REPORT: agent-browser pdf → pdftotext — masthead ("job
//      report", "showing Results"), job name, workdir footer, FSC
//      content reach the paper; pipeline masthead, tab triggers, action
//      toolbar ("Re-run") do NOT; fixed per-sheet strip on every page
//   B  PIXEL PAPER: forced-dark theme → printToPDF → pdftoppm — page 1
//      rasterizes light (the print var remap reaches INSIDE the dialog)
//   C  EXCLUSIVITY BOTH WAYS: Escape closes the inspector → the same
//      Ctrl+P yields the pipeline sheet again ("pipeline snapshot"
//      present, "job report" gone) — the two paper identities never mix
//   D  LOG TAB PAPER: Log tab active → toolbar chrome ("run.out" bar)
//      absent, console body text present, masthead retitles "Engine log"
//   F  STATIC: data-inspector-dialog opt-in, InspectorPrintDoc masthead,
//      :has() exclusivity rules, no-print marks, data-print-keep escape
//      hatch, data-log-console remap hook, PrintDocFooter untouched
//   Z  CLEANUP: seed --clean, reload, console 0
// Usage: node scripts/t112-e2e.mjs
import { execSync } from "node:child_process";
import { readFileSync, appendFileSync, existsSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs";

const AB = "agent-browser";
const B = "http://localhost:3000";
const LOGF = "/home/z/my-project/.qa-logs/t112-trace.log";
const OUT = "/home/z/my-project/.qa-logs/t112-report.pdf";
const OUT2 = "/home/z/my-project/.qa-logs/t112-canvas.pdf";
const OUT3 = "/home/z/my-project/.qa-logs/t112-log.pdf";
const OUT_DARK = "/home/z/my-project/.qa-logs/t112-dark.pdf";
const PPM_DIR = "/home/z/my-project/.qa-logs/t112-ppm";
const step = (m) => {
  try { appendFileSync(LOGF, `[${(Date.now() / 1000).toFixed(0)}] ${m}\n`); } catch { /* ignore */ }
  console.log(m);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => { step(`SIGNAL ${sig}`); process.exit(1); });
}
process.on("exit", (c) => step(`exit code=${c}`));

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// qa62 CLI convention: eval --stdin; OBJECT returns print as bare JSON
// (one parse), strings get re-encoded — every readback returns an object
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 180_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));

let PASSED = 0;
const must = (cond, msg) => {
  if (!cond) { step(`FATAL: ${msg}`); console.error(`FATAL: ${msg}`); process.exit(1); }
  PASSED += 1;
  console.log(`  ok: ${msg}`);
};

// ---------- aim-verify pointer helpers (qa62 contract) ----------
const hoverAt = async (findExpr) => {
  const aimProbe = `(() => {
    const el = (${findExpr}); if (!el) return null;
    const r = el.getBoundingClientRect();
    const cands = [[0.5, 0.5], [0.5, 0.72], [0.35, 0.5], [0.5, 0.3]];
    for (const [fx, fy] of cands) {
      const x = Math.round(r.x + r.width * fx), y = Math.round(r.y + r.height * fy);
      const top = document.elementFromPoint(x, y);
      if (top && el.contains(top)) return { x, y };
    }
    el.scrollIntoView({ block: 'center' });
    return { scroll: true };
  })()`;
  let pos = null;
  for (let i = 0; i < 4; i++) {
    const a = evalJs(aimProbe);
    if (!a || a === "null") return "NO-ELEMENT";
    const cand = JSON.parse(a);
    if (cand.scroll) { await sleep(500); continue; }
    if (Number.isFinite(cand.x) && Number.isFinite(cand.y)) { pos = cand; break; }
    await sleep(400);
  }
  if (!pos) return "NO-ELEMENT";
  sh(`${AB} mouse move ${pos.x} ${pos.y}`);
  return `hovered@${pos.x},${pos.y}`;
};
const realClick = async (findExpr) => {
  const h = await hoverAt(findExpr);
  if (!h.includes("hovered@")) return h;
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return h.replace("hovered@", "clicked@");
};

// ---------- boot (qa62/t111 conventions) ----------
const HOST_JOB = "QA Post 320";
const SEED = "python3 /home/z/my-project/scripts/qa60-seed-fsc.py";
const errClear = () => sh(`${AB} errors --clear >/dev/null 2>&1 || true`);

const bootCanvas = async () => {
  sh(`${AB} close`); await sleep(1500);
  sh(`${AB} set viewport 1600 900`);
  sh(`${AB} open ${B}`);
  await sleep(5000);
  errClear();
  for (let i = 0; i < 12; i++) {
    const probe = evalJs(`(() => {
      const card = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'));
      const dash = !!document.querySelector('h1') && (document.querySelector('h1').textContent||'').includes('Dashboard');
      return (card ? 'CARD' : 'NOCARD') + (dash ? '+DASH' : '');
    })()`);
    if (String(probe).includes("CARD")) return true;
    if (String(probe).includes("DASH")) {
      evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true, bubbles: true }))`);
    }
    await sleep(2200);
  }
  return false;
};

const openInspector = async () => {
  for (let i = 0; i < 10; i++) {
    const r = await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${HOST_JOB}'))`,
    );
    if (r.includes("clicked@")) {
      await sleep(1500);
      const has = J(`(() => {
        const dl = document.querySelector('[data-inspector-dialog]');
        return { m: !!dl && dl.getAttribute('data-state') === 'open' };
      })()`).m;
      if (has === true) return true;
    }
    step(`  openInspector iter ${i}`);
    await sleep(2000);
  }
  return false;
};

const openResults = async () => {
  let tab = "";
  for (let i = 0; i < 8 && !tab.includes("active"); i++) {
    // Radix TabsTrigger activates on POINTERDOWN — a synthetic .click() is
    // dead here (latent t111 weakness masked by the completed-job default);
    // aim-verify + CDP mouse down/up is the honest click
    tab = await realClick(
      `[...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Results')`,
    );
    await sleep(1200);
    tab = evalJs(`(() => {
      const t=[...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Results');
      return t && t.getAttribute('data-state') === 'active' ? 'active' : 'INACTIVE';
    })()`);
  }
  if (!tab.includes("active")) return false;
  for (let i = 0; i < 15; i++) {
    await sleep(1500);
    const ok = J(`(() => {
      const svg = document.querySelector('[data-inspector-dialog] [role=tabpanel]:not([hidden]) svg');
      return { chart: !!svg };
    })()`).chart;
    if (ok === true) return true;
  }
  return false;
};

// minimal P5 (binary PGM) parser — header tokens then raw 8-bit samples
function samplePgm(path) {
  const buf = readFileSync(path);
  let pos = 0;
  const tok = () => {
    for (;;) {
      while (pos < buf.length && /\s/.test(String.fromCharCode(buf[pos]))) pos++;
      if (buf[pos] === 35) { while (pos < buf.length && buf[pos] !== 10) pos++; continue; }
      break;
    }
    const s = pos;
    while (pos < buf.length && !/\s/.test(String.fromCharCode(buf[pos]))) pos++;
    return buf.slice(s, pos).toString("ascii");
  };
  const magic = tok();
  const w = Number(tok()), h = Number(tok()), max = Number(tok());
  pos += 1; // exactly one whitespace byte after maxval
  if (magic !== "P5" || max !== 255) throw new Error(`unexpected pgm: ${magic} max=${max}`);
  const data = buf.slice(pos, pos + w * h);
  if (data.length < w * h) throw new Error("pgm truncated");
  let sum = 0, n = 0, dark = 0, light = 0;
  for (let i = 0; i < data.length; i += 3) {
    const v = data[i]; sum += v; n++;
    if (v < 128) dark++; else if (v > 200) light++;
  }
  return { w, h, mean: sum / n, darkRatio: dark / n, lightRatio: light / n };
}

const pdfText = (path) => sh(`pdftotext ${path} -`).replace(/\s+/g, " ");
const pageCount = (path) => (sh(`pdftotext ${path} -`).match(/\f/g) || []).length + 1;

// ---------- phases ----------
const phaseS = async () => {
  console.log("== PHASE S: seed + inspector + print hooks ==");
  sh(`${SEED} >/dev/null 2>&1`);
  if (!(await bootCanvas())) throw new Error("canvas never showed the host card");
  must(await openInspector(), "inspector opened on the host job");
  must(await openResults(), "Results tab live with a rendered chart");
  const hooks = J(`(() => {
    const dl = document.querySelector('[data-inspector-dialog]');
    const doc = document.querySelector('[data-inspector-print-doc]');
    return {
      hook: dl ? dl.getAttribute('data-inspector-dialog') !== undefined : false,
      pos: dl ? getComputedStyle(dl).position : 'none',
      docExists: !!doc,
      docHidden: doc ? getComputedStyle(doc).display === 'none' : false,
      docText: doc ? (doc.textContent || '').replace(/\\s+/g, ' ').slice(0, 160) : '',
    };
  })()`);
  must(hooks.hook === true, "data-inspector-dialog opt-in attr present on the open dialog");
  must(hooks.pos === "fixed", "screen layout untouched (dialog still fixed/centered)");
  must(hooks.docExists && hooks.docHidden, "print masthead exists and is screen-hidden");
  must(/job report/.test(hooks.docText) && hooks.docText.includes(HOST_JOB),
    "masthead carries the job-report eyebrow + host job name");
  step("PHASE S GREEN");
};

const phaseA = async () => {
  console.log("== PHASE A: PDF is the job report ==");
  sh(`${AB} pdf ${OUT} >/dev/null 2>&1`);
  await sleep(1200);
  must(existsSync(OUT) && statSync(OUT).size > 2000,
    `printToPDF produced an artifact (${existsSync(OUT) ? statSync(OUT).size : 0} bytes)`);
  const text = pdfText(OUT);
  must(/job report/i.test(text), "report masthead reaches the paper");
  must(text.includes("showing Results"), "masthead names the active tab");
  let n = 0;
  const re = new RegExp(HOST_JOB.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  n = (text.match(re) || []).length;
  must(n >= 2, `job name printed (masthead + identity + strip) — got ${n}`);
  must(/printed \d{4}/.test(text.replace(/·/g, "")) || /printed [A-Z][a-z]{2}/.test(text),
    "printed date reaches the paper");
  must(text.toLowerCase().includes("workdir"), "workdir footer reaches the paper");
  must(/fsc/i.test(text), "FSC section content reaches the paper");
  must(!/pipeline snapshot/i.test(text), "pipeline masthead does NOT reach the report paper");
  must(!/Re-run/.test(text), "action toolbar chrome does NOT reach the paper");
  must(!/Engine log/.test(text), "inactive tab triggers do NOT reach the paper");
  const pages = pageCount(OUT);
  const strips = (text.match(/job report · printed/g) || []).length;
  must(strips >= 1, `fixed identity strip prints on page 1 (${strips} of ${pages} pages)`);
  if (pages > 1) {
    must(strips === pages, `fixed strip repainted on EVERY page (${strips}/${pages})`);
  }
  step("PHASE A GREEN");
};

const phaseB = async () => {
  console.log("== PHASE B: forced-dark theme still prints light paper ==");
  evalJs(`document.documentElement.classList.add('dark'); 'ok'`);
  await sleep(400);
  sh(`${AB} pdf ${OUT_DARK} >/dev/null 2>&1`);
  await sleep(1200);
  must(existsSync(OUT_DARK) && statSync(OUT_DARK).size > 2000,
    `forced-dark printToPDF produced an artifact (${existsSync(OUT_DARK) ? statSync(OUT_DARK).size : 0} bytes)`);
  try { rmSync(PPM_DIR, { recursive: true, force: true }); } catch {}
  mkdirSync(PPM_DIR, { recursive: true });
  sh(`pdftoppm -gray -r 100 -f 1 -l 1 ${OUT_DARK} ${PPM_DIR}/page`);
  const pgms = readdirSync(PPM_DIR).filter((f) => f.endsWith(".pgm") || f.endsWith(".pnm"));
  must(pgms.length === 1, `pdftoppm rasterized page 1 (${pgms[0] ?? "nothing"})`);
  const s = samplePgm(`${PPM_DIR}/${pgms[0]}`);
  must(s.mean > 200 && s.darkRatio < 0.1,
    `paper is light under forced dark (mean=${s.mean.toFixed(1)}, dark=${(s.darkRatio * 100).toFixed(1)}%)`);
  evalJs(`document.documentElement.classList.remove('dark'); 'ok'`);
  await sleep(400);
  step("PHASE B GREEN");
};

const phaseC = async () => {
  console.log("== PHASE C: exclusivity both ways ==");
  // Radix Dialog Escape accepts CDP trusted keys (t109 doctrine)
  sh(`${AB} press Escape`);
  await sleep(1200);
  const gone = J(`(() => ({ gone: !document.querySelector('[data-inspector-dialog]') }))()`).gone;
  must(gone === true, "Escape closed the inspector");
  sh(`${AB} pdf ${OUT2} >/dev/null 2>&1`);
  await sleep(1200);
  must(existsSync(OUT2) && statSync(OUT2).size > 2000, "control printToPDF produced an artifact");
  const t2 = pdfText(OUT2);
  must(/pipeline snapshot/i.test(t2), "without the inspector the pipeline sheet returns");
  must(!/job report/i.test(t2), "report identity absent from the canvas paper");
  must(!t2.toLowerCase().includes("workdir"), "dialog-only content absent from the canvas paper");
  step("PHASE C GREEN");
};

const phaseD = async () => {
  console.log("== PHASE D: Log tab paper ==");
  must(await openInspector(), "inspector reopened on the host job");
  let tab = "";
  for (let i = 0; i < 8 && !tab.includes("active"); i++) {
    await realClick(
      `[...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Log')`,
    );
    await sleep(1200);
    tab = evalJs(`(() => {
      const t=[...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === 'Log');
      return t && t.getAttribute('data-state') === 'active' ? 'active' : 'INACTIVE';
    })()`);
  }
  must(tab.includes("active"), "Log tab active (real pointer click — Radix TabsTrigger ignores synthetic click)");
  const mast = J(`(() => {
    const doc = document.querySelector('[data-inspector-print-doc]');
    return { m: doc ? /showing Engine log/.test(doc.textContent) : false };
  })()`).m;
  must(mast === true, "screen masthead already retitles before print (prop flows)");
  await sleep(1500);
  sh(`${AB} pdf ${OUT3} >/dev/null 2>&1`);
  await sleep(1200);
  must(existsSync(OUT3) && statSync(OUT3).size > 2000, "log printToPDF produced an artifact");
  const t3 = pdfText(OUT3);
  must(t3.includes("showing Engine log"), "masthead retitles to the Log tab");
  must(!/run\.out/.test(t3), "console toolbar chrome (run.out bar) does NOT reach the paper");
  must(/No engine log|AUTH|INFO|WARNING|relion|Refine|\\[|\\]/i.test(t3),
    "console BODY text reaches the paper (log lines or the honest empty state)");
  sh(`${AB} press Escape`); await sleep(1000);
  step("PHASE D GREEN");
};

const phaseF = () => {
  console.log("== PHASE F: static contracts ==");
  const inspector = readFileSync("/home/z/my-project/src/components/workflow/job-inspector.tsx", "utf8");
  const browser = readFileSync("/home/z/my-project/src/components/workflow/results/particle-browser.tsx", "utf8");
  const css = readFileSync("/home/z/my-project/src/app/globals.css", "utf8");
  const page = readFileSync("/home/z/my-project/src/app/page.tsx", "utf8");

  must((inspector.match(/data-inspector-dialog=""|data-inspector-dialog=\{""\}/g) || []).length === 1,
    "exactly one data-inspector-dialog opt-in (other dialogs keep step-aside)");
  must(inspector.includes("function InspectorPrintDoc"), "InspectorPrintDoc masthead component exists");
  must(inspector.includes("<InspectorPrintDoc job={job} tab={tab} />"),
    "masthead mounts inside the dialog (survives the app-page hide)");
  must(inspector.includes("data-inspector-print-doc"), "masthead carries the probe hook");
  must(inspector.includes("INSPECTOR_PRINT_TAB"), "tab label map exists");
  must(inspector.includes("showing ${INSPECTOR_PRINT_TAB[tab] ?? tab}"),
    "masthead names the ACTIVE tab");
  must((inspector.match(/no-print/g) || []).length >= 4,
    "screen-chrome rows carry .no-print (tabs, actions, file filter, log toolbar)");
  must(inspector.includes("data-log-console"), "log console carries the print remap hook");
  must(inspector.includes("print:fixed print:bottom-1"), "per-sheet identity strip is print-fixed");

  must(browser.includes("data-print-keep"), "ParticleBrowser montage header opts back in");
  must((browser.match(/data-print-keep=""/g) || []).length === 1,
    "escape hatch used exactly once (comments may name it, attributes count)");

  const hasRules = (css.match(/html:has\(\[data-inspector-dialog\]\[data-state="open"\]\)/g) || []).length;
  must(hasRules >= 9, `:has() exclusivity rules present (got ${hasRules})`);
  must(css.includes("[data-print-keep]"), "keep-rule backdoor exists in the print block");
  must(/\[data-sonner-toaster\],\n  \.no-print/.test(css), "toasts join the print-hidden chrome");
  must((css.match(/\[data-log-console\]/g) || []).length >= 2, "log remap rules present");
  must(css.includes("[data-slot=\"dialog-content\"] {\n    display: none") ||
       /\[data-slot="dialog-content"\][^{]*\{\s*display: none !important/.test(css),
    "generic dialog step-aside rule still intact (Task 70)");

  must(page.includes("<PrintDocFooter />"), "pipeline paper footer untouched on the page");
  must(page.includes("<PrintDocHeader />"), "pipeline paper masthead untouched on the page");
  step("PHASE F GREEN");
};

const phaseZ = async () => {
  console.log("== PHASE Z: cleanup + console ==");
  sh(`${SEED} --clean >/dev/null 2>&1 || true`);
  step("  seed cleaned (files + engine-state; live job deleted)");
  sh(`${AB} close`); await sleep(1000);
  sh(`${AB} open ${B}`); await sleep(4000);
  errClear();
  const errs = sh(`${AB} errors || true`)
    .split("\n")
    .filter((l) => l.trim() && !l.includes("✗"));
  must(errs.length === 0, `console clean (got ${errs.length})`);
  step("PHASE Z GREEN");
};

// ---------- main ----------
(async () => {
  try {
    if (!existsSync("/home/z/my-project/.qa-logs")) execSync("mkdir -p /home/z/my-project/.qa-logs");
    await phaseS();
    await phaseA();
    await phaseB();
    await phaseC();
    await phaseD();
    phaseF();
    await phaseZ();
    console.log(`T112 ALL PASS (${PASSED} assertions)`);
    process.exit(0);
  } catch (e) {
    step(`FATAL: ${e.message}`);
    console.error(`FATAL: ${e.message}`);
    try { sh(`${AB} close`); } catch { /* already gone */ }
    process.exit(1);
  }
})();
