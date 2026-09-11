// Task 116 QA — the job report is PAGINATED like a document, and nothing
// that wraps a record evaporates at the print glass door.
//   S  SEED + SCREEN: qa58 (gallery + STAR on QA Class2D Source) + qa60
//      (FSC on QA Post 320) → inspector on Source, Results tab → tiles and
//      rows visible on screen with their print attrs
//   A  GLASS-DOOR PAPER: scale-1 portrait PDF → tile names, tile meta and
//      STAR rows REACH the paper (pre-fix world: bare headings, zero
//      records — the diag that opened this task)
//   B  PAGINATION: scale-2 PDF spans pages; every atomic unit keeps whole
//      (tile name + meta same page, STAR name + "rows" same page); no
//      section heading orphans as a page's last line
//   C  CHART ATOMICITY: QA Post 320 → FSC card title and legend share a
//      page at scale 2
//   D  OVERVIEW + NOTE: PATCHed long note prints IN FULL (field-sizing
//      leg — the END marker reaching paper proves the textarea grew);
//      timeline step label/value and params key/value keep whole; no
//      orphan headings across a guaranteed multi-page document
//   F  STATIC: attrs in JSX, rules in source CSS AND compiled chunks
//   Z  CLEANUP: note restored, seeds cleaned, reload, console 0
// Usage: node scripts/t113-e2e.mjs
import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { chromium } from "playwright";

const AB = "agent-browser";
const B = "http://localhost:3000";
const GALLERY_JOB = "QA Class2D Source";
const FSC_JOB = "QA Post 320";
const SEED_G = "python3 /home/z/my-project/scripts/qa58-seed-gallery.py";
const SEED_F = "python3 /home/z/my-project/scripts/qa60-seed-fsc.py";
const OUT_A = "/home/z/my-project/.qa-logs/t113-results-s1.pdf";
const OUT_B = "/home/z/my-project/.qa-logs/t113-results-s2.pdf";
const OUT_C = "/home/z/my-project/.qa-logs/t113-fsc-s2.pdf";
const OUT_D = "/home/z/my-project/.qa-logs/t113-overview-s2.pdf";
const NOTE_URL = (id) => `${B}/api/jobs/${id}`;
const NOTE_TEXT =
  "NOTEHEAD7Q pagination probe — the margin annotation is a record, and a " +
 "record clipped at the textarea's screen height is a lost one. This filler " +
  "exists to push well past min-h-20: three lines at least, wrapping across " +
  "the paper column, so the field-sizing growth is the only way the tail " +
  "survives. The final token is the proof: NOTETAIL3Z";

const step = (m) => console.log(m);
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

const pdfPages = (path) =>
  sh(`pdftotext ${path} -`)
    .split("\f")
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0);

const errClear = () => sh(`${AB} errors --clear >/dev/null 2>&1 || true`);

async function findJob(namePart) {
  const { projects } = await (await fetch(`${B}/api/projects`)).json();
  for (const p of projects) {
    const { jobs } = await (await fetch(`${B}/api/jobs?projectId=${p.id}`)).json();
    const hit = jobs.find((x) => x.name.includes(namePart));
    if (hit) return hit;
  }
  return null;
}

/** one playwright session: boot → open a completed job's inspector → tab */
async function withSession(jobName, tab, fn) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.goto(B, { waitUntil: "networkidle" });
  await p.waitForTimeout(4000);
  const onDash = await p.evaluate(() =>
    (document.querySelector("h1")?.textContent || "").includes("Dashboard")
  );
  if (onDash) { await p.keyboard.press("Shift+D"); await p.waitForTimeout(1500); }
  let opened = false;
  for (let i = 0; i < 8 && !opened; i++) {
    const card = p.locator("[role=button]", { hasText: jobName }).first();
    if ((await card.count()) > 0) {
      await card.click();
      await p.waitForTimeout(1800);
      opened = await p.evaluate(() => !!document.querySelector("[data-inspector-dialog]"));
    }
    await p.waitForTimeout(1200);
  }
  if (!opened) { await b.close(); throw new Error(`inspector never opened for ${jobName}`); }
  await p.waitForTimeout(2000);
  if (tab && !/results/i.test(tab)) {
    // completed jobs default to Results; other tabs need a trusted pointer
    await p.locator('[role="tab"]', { hasText: new RegExp(tab, "i") }).first().click();
    await p.waitForTimeout(1200);
  }
  try { await fn(p); } finally { await b.close(); }
}

// ---------- phases ----------
const phaseS = async () => {
  console.log("== PHASE S: seed + screen contract ==");
  sh(`${SEED_G} >/dev/null 2>&1`);
  sh(`${SEED_F} >/dev/null 2>&1`);
  // agent-browser screen leg: inspector on Source, Results default
  sh(`${AB} close`); await sleep(1500);
  sh(`${AB} set viewport 1600 900`);
  sh(`${AB} open ${B}`); await sleep(5000);
  errClear();
  let opened = false;
  for (let i = 0; i < 8 && !opened; i++) {
    evalJs(`(() => {
      const el = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${GALLERY_JOB}'));
      if (!el) return 'NOCARD';
      const r = el.getBoundingClientRect();
      return 'CARD@' + Math.round(r.x + r.width/2) + ',' + Math.round(r.y + r.height/2);
    })()`);
    const pos = unq(evalJs(`(() => {
      const el = [...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${GALLERY_JOB}'));
      if (!el) return 'NOCARD';
      const r = el.getBoundingClientRect();
      el.scrollIntoView({ block: 'center' });
      const r2 = el.getBoundingClientRect();
      return Math.round(r2.x + r2.width/2) + ',' + Math.round(r2.y + r2.height/2);
    })()`));
    if (pos && pos !== "NOCARD" && pos.includes(",")) {
      const [x, y] = pos.split(",").map(Number);
      if (Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 && x < 1600 && y < 900) {
        sh(`${AB} mouse move ${x} ${y}`);
        sh(`${AB} mouse down`);
        sh(`${AB} mouse up`);
        await sleep(1800);
        opened = J(`(() => {
          const dl = document.querySelector('[data-inspector-dialog]');
          return { m: !!dl && dl.getAttribute('data-state') === 'open' };
        })()`).m === true;
      }
    }
    if (!opened) { step(`  openInspector iter ${i}`); await sleep(1500); }
  }
  must(opened, "inspector opened on the gallery job (completed → inspector)");
  const scr = J(`(() => {
    const dl = document.querySelector('[data-inspector-dialog]');
    const tiles = [...(dl?.querySelectorAll('[data-print-block]') ?? [])];
    const starRows = [...(dl?.querySelectorAll('[data-print-keep]') ?? [])];
    const t0 = tiles[0];
    return {
      tiles: tiles.length,
      tileNamed: !!t0,
      tileName: t0 ? (t0.querySelector('p')?.textContent || '').trim() : '',
      tileMeta: t0 ? (t0.querySelectorAll('p')[1]?.textContent || '').trim() : '',
      keeps: starRows.length,
      starName: starRows.length ? (starRows[0].textContent || '').slice(0, 60) : '',
      mapsHeading: !!(dl && [...dl.querySelectorAll('h4')].some(h => /maps/i.test(h.textContent || ''))),
      starHeading: !!(dl && [...dl.querySelectorAll('h4')].some(h => /STAR/i.test(h.textContent || ''))),
    };
  })()`);
  must(scr.mapsHeading && scr.starHeading, "Maps & STAR section headings on screen");
  must(scr.tiles >= 1, `gallery tiles carry data-print-block on screen (${scr.tiles})`);
  must(scr.keeps >= 1, `document-wrapping rows carry data-print-keep on screen (${scr.keeps})`);
  must(scr.tileName.length > 2, `tile name captured ("${scr.tileName.slice(0, 30)}")`);
  step("PHASE S GREEN");
  return scr;
};

const phaseA = async (scr) => {
  console.log("== PHASE A: glass-door paper (scale 1) ==");
  await withSession(GALLERY_JOB, "results", async (p) => {
    await p.pdf({ path: OUT_A, format: "Letter", landscape: false, scale: 1 });
  });
  await sleep(800);
  must(existsSync(OUT_A) && statSync(OUT_A).size > 2000, "scale-1 PDF artifact exists");
  const pages = pdfPages(OUT_A);
  const paper = pages.join(" ");
  must(/maps\s*&\s*images/i.test(paper), "Maps & images heading reaches the paper");
  must(paper.includes(scr.tileName),
    `gallery tile name PRINTS (pre-fix: vanished at the glass door) — "${scr.tileName.slice(0, 30)}"`);
  must(/\d+\s*imgs|³\s*·|·\s*\d/.test(paper), "tile meta line (imgs/size) reaches the paper");
  must(/STAR\s*tables/i.test(paper), "STAR tables heading reaches the paper");
  must(/rows/i.test(paper), "STAR row row-count record reaches the paper");
  must(/workdir/i.test(paper), "workdir footer still reaches the paper");
  step("PHASE A GREEN");
};

const HEADINGS = [
  "maps & images", "STAR tables", "logs & reports", "timeline",
  "key parameters", "note", "command line", "outputs at a glance", "inputs consumed",
];
const lastLineIsHeading = (pageText) => {
  const lines = pageText.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return false;
  const last = lines[lines.length - 1].toLowerCase().replace(/\s+/g, " ");
  return HEADINGS.some((h) => last.startsWith(h) && last.length <= h.length + 8);
};

const phaseB = async (scr) => {
  console.log("== PHASE B: pagination at scale 2 ==");
  await withSession(GALLERY_JOB, "results", async (p) => {
    await p.pdf({ path: OUT_B, format: "Letter", landscape: false, scale: 2 });
  });
  await sleep(800);
  must(existsSync(OUT_B) && statSync(OUT_B).size > 2000, "scale-2 PDF artifact exists");
  const pages = pdfPages(OUT_B);
  must(pages.length >= 2, `report spans pages under print scaling (got ${pages.length})`);
  const withTile = pages.filter((t) => t.includes(scr.tileName));
  const withMeta = pages.filter((t) => /\d+\s*imgs|³\s*·|·\s*\d/.test(t));
  must(withTile.length >= 1 && withTile.some((t) => withMeta.includes(t)),
    "tile name and tile meta share a page (tile never splits)");
  const withStar = pages.filter((t) => /rows/i.test(t));
  const withStarName = pages.filter((t) => /run_it012|run_data\.star|\.star/i.test(t));
  must(withStarName.length >= 1 && withStarName.some((t) => withStar.includes(t)),
    "STAR row name and its row-count keep together on one page");
  const orphans = pages.filter(lastLineIsHeading);
  must(orphans.length === 0,
    `no section heading orphans at a page bottom (${orphans.length} found)`);
  step("PHASE B GREEN");
};

const phaseC = async () => {
  console.log("== PHASE C: FSC card atomicity (Post 320) ==");
  let cap = null;
  await withSession(FSC_JOB, "results", async (p) => {
    cap = await p.evaluate(() => {
      const sec = document.querySelector("[data-inspector-dialog] [data-chart-export-root]");
      if (!sec) return null;
      const txt = sec.innerText.replace(/\s+/g, " ");
      const legend = [...sec.querySelectorAll("div span")].map((s) => s.textContent?.trim() ?? "")
        .find((t) => /FSC|corrected/i.test(t) && !/curve|shells/i.test(t));
      return { hasCurve: /FSC curve/i.test(txt), legend: legend || "" };
    });
    await p.pdf({ path: OUT_C, format: "Letter", landscape: false, scale: 2 });
  });
  await sleep(800);
  must(existsSync(OUT_C) && statSync(OUT_C).size > 2000, "FSC scale-2 PDF artifact exists");
  must(cap && cap.hasCurve, "FSC chart card present on screen");
  const pages = pdfPages(OUT_C);
  const titlePages = pages.filter((t) => /FSC curve/i.test(t));
  must(titlePages.length >= 1, "FSC card title reaches the paper");
  const legend = (cap?.legend || "").trim();
  if (legend.length > 3) {
    must(titlePages.some((t) => t.includes(legend)),
      `FSC title and legend "${legend}" share a page (chart card never splits)`);
  } else {
    must(titlePages.some((t) => /resolution|Å|0\.143/i.test(t)),
      "FSC title and axis content share a page");
  }
  step("PHASE C GREEN");
};

const phaseD = async (srcJob) => {
  console.log("== PHASE D: Overview paper + full-length note ==");
  const origNote = srcJob.note ?? "";
  const res = await fetch(NOTE_URL(srcJob.id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: NOTE_TEXT }),
  });
  must(res.ok, `long probe note PATCHed (${res.status})`);
  let cap = null;
  await withSession(GALLERY_JOB, "overview", async (p) => {
    cap = await p.evaluate(() => {
      const dl = document.querySelector("[data-inspector-dialog]");
      const ta = dl?.querySelector("[data-note-editor] textarea");
      const steps = [...(dl?.querySelectorAll("[data-print-atomic] li span") ?? [])]
        .map((s) => s.textContent?.trim() ?? "").filter(Boolean);
      const param = dl?.querySelector("[data-print-atomic] p");
      return {
        noteLen: ta ? (ta.value || "").length : 0,
        stepLabels: steps.slice(0, 6),
        paramText: param ? param.textContent?.trim() ?? "" : "",
        taHeight: ta ? ta.getBoundingClientRect().height : 0,
      };
    });
    await p.pdf({ path: OUT_D, format: "Letter", landscape: false, scale: 2 });
  });
  await sleep(800);
  must(existsSync(OUT_D) && statSync(OUT_D).size > 2000, "Overview scale-2 PDF artifact exists");
  const pages = pdfPages(OUT_D);
  const paper = pages.join(" ");
  must(pages.length >= 2, `Overview report spans pages (got ${pages.length})`);
  must(paper.includes("NOTEHEAD7Q"), "note HEAD marker reaches the paper");
  must(paper.includes("NOTETAIL3Z"),
    "note TAIL marker reaches the paper — field-sizing grew the textarea (no clipped record)");
  must(cap && cap.noteLen >= NOTE_TEXT.length - 10, `textarea holds the full note (${cap?.noteLen})`);
  must(/timeline/i.test(paper) && /key parameters/i.test(paper),
    "timeline + key parameters sections reach the paper");
  const createdPages = pages.filter((t) => /created/i.test(t));
  const startedPages = pages.filter((t) => /started/i.test(t));
  must(createdPages.length >= 1 && createdPages.some((t) => startedPages.includes(t)),
    "timeline steps keep together (Created/Started share a page)");
  const orphans = pages.filter(lastLineIsHeading);
  must(orphans.length === 0, `no orphan headings on the Overview paper (${orphans.length})`);
  must(/command line/i.test(paper) || /relion/i.test(paper),
    "command-line record reaches the paper");
  // restore the original note
  const res2 = await fetch(NOTE_URL(srcJob.id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: origNote }),
  });
  must(res2.ok, "probe note restored");
  step("PHASE D GREEN");
};

const phaseF = async () => {
  console.log("== PHASE F: static contracts ==");
  const src = (f) => sh(`cat src/${f}`);
  const rv = src("components/workflow/results/results-view.tsx");
  const ji = src("components/workflow/job-inspector.tsx");
  const css = sh("cat src/app/globals.css");
  must((rv.match(/data-print-keep=""?/g) || []).length === 2,
    "results-view: STAR row + log row opt back onto the paper (×2)");
  must((rv.match(/data-print-block=""?/g) || []).length === 1,
    "results-view: gallery tile is a print block (×1)");
  must((ji.match(/data-print-atomic=""?/g) || []).length >= 8,
    `job-inspector: atomic units marked (${(ji.match(/data-print-atomic=""?/g) || []).length})`);
  must(/data-print-keep/.test(sh("cat src/components/workflow/results/particle-browser.tsx")),
    "ParticleBrowser montage-header escape hatch (Task 114) untouched");
  for (const rule of ["data-print-block", "data-print-atomic", "data-chart-export-root",
    "data-files-table", "field-sizing: content", "break-after: avoid"]) {
    must(css.includes(rule), `globals.css carries "${rule}"`);
  }
  // (Task 119 fix: the compiled css chunk hash changes on every rebuild —
  // hardcoding it shipped a time bomb that detonated on the next feature
  // build. Locate the chunk by MARKER, the same way t119's F13 does.)
  const builtPath = sh(
    "rg -l 'data-print-block' .next/static/chunks/ --glob '*.css' | head -1"
  );
  must(builtPath.length > 0, "compiled css chunk located by marker (fresh build)");
  const built = builtPath ? sh(`cat ${builtPath}`) : "";
  must(built.includes("data-print-block") && built.includes("break-inside:avoid"),
    "compiled CSS chunk carries the pagination rules");
  must(built.includes("field-sizing:content"), "compiled CSS carries field-sizing");
  step("PHASE F GREEN");
};

const phaseZ = async () => {
  console.log("== PHASE Z: cleanup + console ==");
  sh(`${SEED_G} --clean >/dev/null 2>&1 || true`);
  sh(`${SEED_F} --clean >/dev/null 2>&1 || true`);
  step("  seeds cleaned");
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
    const scr = await phaseS();
    await phaseA(scr);
    await phaseB(scr);
    await phaseC();
    const srcJob = await findJob(GALLERY_JOB);
    if (!srcJob) throw new Error("gallery job vanished");
    await phaseD(srcJob);
    await phaseF();
    await phaseZ();
    console.log(`T113 ALL PASS (${PASSED} assertions)`);
    process.exit(0);
  } catch (e) {
    console.error("T113 FAILED:", e?.message ?? e);
    process.exit(1);
  }
})();
