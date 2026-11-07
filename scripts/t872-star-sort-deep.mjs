#!/usr/bin/env node
/**
 * t872 — the STAR table's SORT DEEP WALK (the t871 tail's first
 * candidate, non-build-day arm): the t866 walk named the sort machine
 * (aria-sort ascending -> descending -> native) but only ever read the
 * STATE — never the DATA. This window the machine's arithmetic rides
 * live on the roster's biggest STAR table, and the DOM must speak the
 * comparator's own truth, cell for cell.
 *
 * The host is MEASURED, never pinned: every completed job's outputs
 * API speaks its .star files; the door with the most rows wins (the
 * world's symexpand leg grew particles_symexpand.star to 5,760 rows —
 * the biggest table the star dialog has ever hosted).
 *
 *   O   the clean room — the seed cleared, the panel-closed boot
 *       demanded (the t866 law), the calm canvas.
 *   H   the host, chosen from the OUTPUTS APIs across the whole roster
 *       (the API truth first, the DOM found BY NAME — the door whose
 *       text carries the winning file's name).
 *   A   arrival + the API truth at CELL scale: the dialog fetches
 *       rows=100; the DOM's 100 body rows must BE the API's rows (row
 *       0 compared cell for cell, exact strings), the door's spoken
 *       "N rows" must equal the star route's rowCount (two API mouths,
 *       one truth), the footer speaks the slice arithmetic ("showing
 *       100 of 5760 rows (truncated)"), the TSV door's href carries
 *       the export lane and the encoded path.
 *   S1  ASC — the STRONG form: the instrument mirrors the t651
 *       comparator exactly (parseFloat numeric sampling, NaN/empty
 *       tail, native-index tiebreak), computes the expected order of
 *       the API's own 100 rows for the measured max-scramble numeric
 *       column, and demands the DOM's # column AND the data column
 *       equal that order — not just monotone, EXACT. aria-sort
 *       ascending; the footer names the sort.
 *   S2  DESC — the same strong form, flipped.
 *   S3  native — aria-sort drops everywhere, # returns to identity
 *       1..100, row 0 returns to the API's rows[0] bit-for-bit, the
 *       footer's sort note is honestly absent.
 *   M   the CROSS-COLUMN machine (the t866 walk never left column 1):
 *       engaging a second column drops the first's aria-sort, the full
 *       three-state cycle rides the second, the first stays silent.
 *   X   the export lane at FILE scale: ?export=tsv returns the FULL
 *       loop block — header line == the API's columns, data lines ==
 *       rowCount, line 1 == the API's rows[0] (the file's native order
 *       is the artifact, at file scale).
 *   W   the world back — Escape closes what the world opened (dialog,
 *       then inspector), the fresh load's canvas bit-for-bit, the seed
 *       hygiene (the t866 lesson rides every page).
 *
 * Born with the ledger aboard (the t861 birthright): THREE faces —
 * starDialog / sortAsc / worldBack — the receipt's top-level `faces`
 * block carries the RAW measures, the ledger diffs prev.faces.<name>.
 * live. First ride: arm 1 recorded.
 *
 * Receipt: shots-qa/t872-star-sort-deep.json (+ two PNGs archived).
 *
 *   node scripts/t872-star-sort-deep.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

// t874 — the revision-stamp propagation: the family's stamp habit (the t873
// lesson's field name `instrumentRevision`) aboard — a future growth of THIS
// instrument rides arm 2r on the record, then closes bit-for-bit.
const RECEIPT_REVISION = 1;

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const RECEIPT = "shots-qa/t872-star-sort-deep.json";

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

const shot = (rel) =>
  execSync(`agent-browser screenshot ${rel}`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });

/* same-origin metadata — the roster/outputs reads are same-origin gates */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};
const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const b = await r.json();
  return b.jobs ?? b;
};

/* ---------- the t651 comparator, mirrored EXACTLY (the instrument's
 * half of the arithmetic law: the DOM must equal THIS, because THIS is
 * what the component computes — parseFloat sampling, the 0.8 threshold
 * over the first 50 filled cells, empties/NaN to the tail in BOTH
 * directions, ties on the native index). ---------- */
const isNumMirror = (rows, col) => {
  if (rows.length === 0) return false;
  const sample = rows.slice(0, 50);
  let numeric = 0;
  let filled = 0;
  for (const row of sample) {
    const cell = row[col] ?? "";
    if (cell.trim() === "") continue;
    filled++;
    if (Number.isFinite(parseFloat(cell))) numeric++;
  }
  return filled > 0 && numeric / filled >= 0.8;
};
const sortMirror = (rows, col, dir, numeric) => {
  const keyed = rows.map((row, i) => ({ i, cell: (row[col] ?? "").trim() }));
  const flip = dir === "asc" ? 1 : -1;
  keyed.sort((a, b) => {
    const av = a.cell;
    const bv = b.cell;
    const aE = av === "";
    const bE = bv === "";
    if (aE && bE) return a.i - b.i;
    if (aE) return 1;
    if (bE) return -1;
    if (numeric) {
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      const aN = !Number.isFinite(an);
      const bN = !Number.isFinite(bn);
      if (aN && bN) return a.i - b.i;
      if (aN) return 1;
      if (bN) return -1;
      if (an !== bn) return (an - bn) * flip;
      return a.i - b.i;
    }
    const c = av.localeCompare(bv);
    return c !== 0 ? c * flip : a.i - b.i;
  });
  return keyed.map((k) => k.i);
};
const shortMirror = (col) => col.replace(/^_rln/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
const num = (s) => Number(String(s).replace(/,/g, ""));

/* ---------- the measure: the star dialog's superset (the # column, the
 * data cells, the aria-sort states, the footer, the TSV door — one
 * shape every face films; absent selectors speak false/0). NO ${} and
 * no backslash-bearing regex inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 40) : null; const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())); const sec = document.querySelector(\'section[aria-label="STAR tables"]\'); const secBtns = sec ? Array.from(sec.querySelectorAll("button")) : []; const region = dlgTop ? dlgTop.querySelector("[role=region]") : null; const actTabEl = dlgTop ? dlgTop.querySelector("[role=tab][data-state=active]") : document.querySelector("[role=tab][data-state=active]"); const ths = dlgTop ? Array.from(dlgTop.querySelectorAll("thead th")) : []; const cols = ths.map((th) => ({ title: th.getAttribute("title"), sort: th.getAttribute("aria-sort") })); const trs = dlgTop ? dlgTop.querySelectorAll("tbody tr") : []; const rows = Array.from(trs).map((tr) => { const tds = tr.querySelectorAll("td"); return { n: tds[0] ? (tds[0].textContent || "").trim() : "", c: Array.from(tds).slice(1).map((td) => (td.textContent || "").trim()) }; }); let footText = ""; if (dlgTop) { const sp = Array.from(dlgTop.querySelectorAll("span")).find((s) => ((s.textContent || "").trim()).indexOf("showing") === 0); footText = sp ? (sp.textContent || "").trim() : ""; } const tsvA = dlgTop ? dlgTop.querySelector("a[download]") : null; const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); return JSON.stringify({ panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, hasDlg: dgs.length > 0, dlgCount: dgs.length, dlgHeadTop: headOf(dlgTop), shimmer: leaves.length, starSection: !!sec, starDoors: secBtns.length, starDoorTexts: secBtns.map((b) => (b.textContent || "").trim().slice(0, 80)), regionNamed: region ? !!(region.getAttribute("aria-label") || "").startsWith("Star table") : false, regionTabindex: region ? region.getAttribute("tabindex") : null, actTab: actTabEl ? (actTabEl.textContent || "").trim().slice(0, 12) : null, cols: cols, nrows: rows.length, rows: rows, footText: footText.slice(0, 200), tsvHref: tsvA ? tsvA.getAttribute("href") : null, keymap: dlgTop ? !!dlgTop.querySelector("[data-canvas-ui=star-keymap]") : false }); })()';

const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 16, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next).filter((k) => k !== "rows");
      if (dk.length) console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.shimmer === 0 && (!m.hasDlg || m.nrows > 0)) break;
  }
  console.log(`  settled ${what} (shimmer silent, ${run}x stable)`);
  return m;
};
const waitFor = (what, probe, maxSecs = 24) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  console.log(`    (waitFor "${what}" timed out after ${maxSecs}s — the last measure rides)`);
  return m;
};
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- doors ---------- */
const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';
const starDoor = (n) =>
  '(() => { const sec = document.querySelector("section[aria-label=\\"STAR tables\\"]"); if (!sec) return JSON.stringify({ clicked: false }); const b = sec.querySelectorAll("button")[' + n + ']; if (!b) return JSON.stringify({ clicked: false }); b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()';
/* the sort click speaks the CLICK dialect (React onClick — the t871
 * family's measured law: a pointer pair does not open a click door). */
const sortClick = (dataCol) =>
  '(() => { const d = Array.from(document.querySelectorAll("[role=dialog]")).pop(); const ths = d ? d.querySelectorAll("thead th") : []; const th = ths[' + (dataCol + 1) + ']; const b = th && th.querySelector("button"); if (!b) return JSON.stringify({ clicked: false }); b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()';

const thSort = (m, dataCol) => (m.cols[dataCol + 1] ? m.cols[dataCol + 1].sort : undefined);
const domIdxSeq = (m) => m.rows.map((r) => num(r.n));
const domColVals = (m, c) => m.rows.map((r) => r.c[c] ?? "");

console.log("t872 — the star table's sort deep walk (the DOM must speak the comparator's truth)\n");

const world = worldIdentity(ROOT);
console.log(`  world key: ${world.id} (${world.mode})`);
const cmp = loadComparator(ROOT, RECEIPT, world.id);
console.log(`  drift ledger: ${cmp.prevFound ? `comparator found (build ${cmp.prevBuild})` : "no predecessor — arm 1 (first ride)"}`);

/* ---------- Face 0: the clean room + the calm canvas ---------- */
console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
if (corpse(m0, "Face 0")) process.exit(1);
ok("O0 the boot is a clean room (the t157 seed cleared, the panel closed)", m0.panelOpen === false, `panelOpen=${m0.panelOpen}`);
ok("O1 the canvas is calm and named (the census's invariant)", !m0.hasDlg && censusOk(m0), `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;

/* ---------- Face H: the host, measured from the OUTPUTS APIs ---------- */
console.log("Face H — the host measured across the whole roster's outputs APIs");
const jobs = await roster();
let host = null;
let hostRows = -1;
for (const j of jobs.filter((x) => x.status === "completed")) {
  let files = [];
  try {
    const o = await (await fetch(`${BASE}/api/jobs/${j.id}/outputs`, { headers: SH })).json();
    files = o.files ?? [];
  } catch {
    continue; // a job whose outputs lane shrugs — the ride measures the rest
  }
  for (const f of files) {
    if (f.kind === "star" && (f.rows ?? 0) > hostRows) {
      hostRows = f.rows ?? 0;
      host = { job: j, path: f.path, name: f.name, rows: f.rows ?? 0 };
    }
  }
}
if (!host) {
  console.error("no .star output anywhere in the roster — the ride stops honestly");
  writeFileSync(
    join(ROOT, RECEIPT),
    JSON.stringify({ instrument: "scripts/t872-star-sort-deep.mjs", ruler: NAMEOF_LAW, instrumentRevision: RECEIPT_REVISION, build: world.id, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no star output — the ride stopped honestly" }, null, 2)
  );
  process.exit(1);
}
console.log(`  host (measured, not pinned): ${host.name} (${hostRows} rows) of job ${host.job.name} (${host.job.id.slice(0, 12)})`);

/* the star route's own truth (the DOM must speak it) */
const api = await (
  await fetch(`${BASE}/api/jobs/${host.job.id}/outputs/star?path=${encodeURIComponent(host.path)}&rows=100`, { headers: SH })
).json();
const apiRows = api.rows ?? [];
const NC = (api.columns ?? []).length;
console.log(`  star API: rowCount ${api.rowCount}, ${NC} columns, page rows ${apiRows.length}, truncated ${api.truncated}`);

/* the sort targets: numeric columns by the mirror, ranked by scramble */
const scrambles = [];
for (let c = 0; c < NC; c++) {
  if (!isNumMirror(apiRows, c)) continue;
  const ord = sortMirror(apiRows, c, "asc", true);
  const moved = ord.filter((v, i) => v !== i).length;
  scrambles.push({ c, moved });
}
scrambles.sort((a, b) => b.moved - a.moved || a.c - b.c);
if (scrambles.length < 2) {
  console.error("fewer than two numeric columns — the cross-column machine cannot ride; the ride stops honestly");
  process.exit(1);
}
const K = scrambles[0].c;
const J = scrambles[1].c;
const expAscK = sortMirror(apiRows, K, "asc", true);
const expDescK = sortMirror(apiRows, K, "desc", true);
console.log(`  sort targets (measured): col ${K} "${api.columns[K]}" (scramble ${scrambles[0].moved}/100), col ${J} "${api.columns[J]}" (scramble ${scrambles[1].moved}/100)`);

/* ---------- Face EXT: the inspector + the section + the door BY NAME ---------- */
console.log("Face EXT — the host card's plain door, the Results tab, the section's winning door");
const c1 = evalJson(plainClick(host.job.id));
ok("E1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
const w = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
ok("E2 the inspector arrived (a dialog aboard)", w.hasDlg === true, `dlgCount=${w.dlgCount}`);
const tab1 = evalJson(tabMouseDown("Results"));
ok("E3 the Results tab switched through the MOUSEDOWN door (the t863 Radix law)", tab1.found === true);
const s1 = settle("the Results tab (the lazy barrel compiles)");
if (corpse(s1, "Face EXT")) process.exit(1);
ok("E4 the active tab speaks Results", s1.actTab === "Results", `actTab=${s1.actTab}`);
ok("E5 the STAR tables section is present and named", s1.starSection === true);
const doorIdx = s1.starDoorTexts.findIndex((t) => t.indexOf(host.name) !== -1);
ok("E6 the winning file's door exists and is found BY NAME (the text IS the name)", doorIdx >= 0, `door="${doorIdx >= 0 ? s1.starDoorTexts[doorIdx] : "??"}"`);
ok("E7 zero unnamed page-wide WITH the inspector up (the census's invariant)", censusOk(s1), `btns=${s1.pageBtns} ctrls=${s1.ctrls}`);

/* ---------- Face A: the dialog + the API truth at cell scale ---------- */
console.log("Face A — the dialog arrives; the DOM must speak the star route's truth, cell for cell");
const d0 = evalJson(starDoor(doorIdx));
ok("A1 the winning door clicked", d0.clicked === true);
const a1 = waitFor("the star dialog's rows", (m) => m.dlgCount >= 2 && m.nrows > 0);
const a2 = settle("the star dialog (the table fetch)");
if (corpse(a2, "Face A")) process.exit(1);
ok("A2 the dialog arrived as the TOPMOST layer (the t865 nested-portal lesson)", a2.hasDlg && a2.dlgCount >= 2, `dlgCount=${a2.dlgCount}`);
ok("A3 the dialog's heading is the file label, read from the TOPMOST layer", (a2.dlgHeadTop || "").endsWith(".star"), `head="${a2.dlgHeadTop}"`);
ok("A4 the region is named with its keyboard door (the t812 grounded-verdict law)", a2.regionNamed === true && a2.regionTabindex === "0", `tabindex=${a2.regionTabindex}`);
ok("A5 the t832 keymap seat is aboard (star-keymap)", a2.keymap === true);
ok("A6 the body's row count speaks the API's page (100 of the budget)", a2.nrows === apiRows.length, `dom=${a2.nrows} api=${apiRows.length}`);
ok("A7 row 0 speaks the API's rows[0] cell for cell (exact strings)", a2.nrows > 0 && a2.rows[0].c.join("|||") === apiRows[0].join("|||"), `"${a2.rows[0].c.join("|||").slice(0, 60)}"`);
const doorSpoken = num((s1.starDoorTexts[doorIdx].match(/([0-9,]+) rows/) || [])[1]);
ok("A8 the door's spoken rows equal the star route's rowCount (two API mouths, one truth)", doorSpoken === api.rowCount, `door=${doorSpoken} route=${api.rowCount}`);
ok("A9 the footer speaks the slice arithmetic (the honest truncation)", (a2.footText || "").includes(`of ${api.rowCount} rows (truncated)`), `foot="${(a2.footText || "").slice(0, 60)}"`);
ok("A10 the TSV door carries the export lane and the encoded path", !!a2.tsvHref && a2.tsvHref.includes("export=tsv") && a2.tsvHref.includes(encodeURIComponent(host.path)), `href="${(a2.tsvHref || "").slice(0, 70)}"`);
ok("A11 zero unnamed page-wide WITH the dialog up (the census's invariant)", censusOk(a2), `btns=${a2.pageBtns} ctrls=${a2.ctrls}`);

/* ---------- Face S1: ASC — the strong form ---------- */
console.log(`Face S1 — sort col ${K} ascending; the DOM must equal the mirror's own order, cell for cell`);
evalJson(sortClick(K));
const asc = waitFor("the ascending order", (m) => m.nrows === apiRows.length && thSort(m, K) === "ascending" && domIdxSeq(m).join(",") === expAscK.map((i) => i + 1).join(","));
const ascS = settle("the ascending table");
ok("S1a aria-sort announces ascending", thSort(ascS, K) === "ascending", `aria-sort=${thSort(ascS, K)}`);
ok("S1b the # column IS the mirror's native-index order (the t656 map, exact)", domIdxSeq(ascS).join(",") === expAscK.map((i) => i + 1).join(","), `first5=${domIdxSeq(ascS).slice(0, 5).join("/")}`);
ok("S1c the data column IS the mirror's sorted values (exact, not just monotone)", domColVals(ascS, K).join("|||") === expAscK.map((i) => apiRows[i][K]).join("|||"), `first3=${domColVals(ascS, K).slice(0, 3).join(" / ")}`);
ok("S1d the footer names the sort (the frozen grammar's own words)", (ascS.footText || "").includes(`sorted by ${shortMirror(api.columns[K])} asc`), `foot="${(ascS.footText || "").slice(0, 80)}"`);
ok("S1e zero unnamed on the sorted table (the census's invariant)", censusOk(ascS));
shot("shots-qa/t872-star-sort-asc.png");
console.log("  (the ascending big table archived)");

/* ---------- Face S2: DESC — the same strong form, flipped ---------- */
console.log("Face S2 — the second click flips to descending");
evalJson(sortClick(K));
const desc = waitFor("the descending order", (m) => thSort(m, K) === "descending" && domIdxSeq(m).join(",") === expDescK.map((i) => i + 1).join(","));
const descS = settle("the descending table");
ok("S2a aria-sort announces descending", thSort(descS, K) === "descending", `aria-sort=${thSort(descS, K)}`);
ok("S2b the # column IS the mirror's descending order (exact)", domIdxSeq(descS).join(",") === expDescK.map((i) => i + 1).join(","), `first5=${domIdxSeq(descS).slice(0, 5).join("/")}`);
ok("S2c the data column IS the mirror's descending values (exact)", domColVals(descS, K).join("|||") === expDescK.map((i) => apiRows[i][K]).join("|||"));
ok("S2d the footer speaks desc", (descS.footText || "").includes(`sorted by ${shortMirror(api.columns[K])} desc`));
ok("S2e zero unnamed on the descending table", censusOk(descS));

/* ---------- Face S3: native — the file's own order returns ---------- */
console.log("Face S3 — the third click returns to the file's native order");
evalJson(sortClick(K));
const nat = waitFor("the native order", (m) => m.nrows === apiRows.length && thSort(m, K) === null && domIdxSeq(m).join(",") === Array.from({ length: apiRows.length }, (_, i) => i + 1).join(","));
const natS = settle("the native table");
ok("S3a aria-sort drops everywhere (the file's native order needs no announcement)", natS.cols.every((c) => c.sort === null), `sorts=${JSON.stringify(natS.cols.map((c) => c.sort))}`);
ok("S3b the # column returns to identity 1..100", domIdxSeq(natS).join(",") === Array.from({ length: apiRows.length }, (_, i) => i + 1).join(","));
ok("S3c row 0 returns to the API's rows[0] bit-for-bit", natS.rows[0].c.join("|||") === apiRows[0].join("|||"));
ok("S3d the footer's sort note is honestly absent", !(natS.footText || "").includes("sorted by"), `foot="${(natS.footText || "").slice(0, 60)}"`);
ok("S3e zero unnamed on the native table", censusOk(natS));
shot("shots-qa/t872-star-sort-native.png");
console.log("  (the native big table archived)");

/* ---------- Face M: the cross-column machine (the t866 walk never left column 1) ---------- */
console.log(`Face M — engaging col ${J} drops col ${K}'s aria-sort; the full cycle rides the second column`);
evalJson(sortClick(J));
const m1 = waitFor("col J ascending", (m) => thSort(m, J) === "ascending");
ok("M1 the second column gains ascending", thSort(m1, J) === "ascending", `colJ=${thSort(m1, J)}`);
ok("M2 the first column's aria-sort drops (one sort at a time)", thSort(m1, K) === null, `colK=${thSort(m1, K)}`);
ok("M3 the footer names the NEW column", (m1.footText || "").includes(`sorted by ${shortMirror(api.columns[J])} asc`), `foot="${(m1.footText || "").slice(0, 80)}"`);
evalJson(sortClick(J));
const m2 = waitFor("col J descending", (m) => thSort(m, J) === "descending");
ok("M4 the second column rides descending", thSort(m2, J) === "descending");
evalJson(sortClick(J));
const m3 = waitFor("col J native", (m) => thSort(m, J) === null);
ok("M5 the second column's third click returns to native (the full machine, second seat)", thSort(m3, J) === null && thSort(m3, K) === null);
ok("M6 zero unnamed through the whole second-column cycle", censusOk(m3));

/* ---------- Face X: the export lane at FILE scale ---------- */
console.log("Face X — ?export=tsv: the FULL loop block, the file's native order as data");
const tsv = await (await fetch(`${BASE}/api/jobs/${host.job.id}/outputs/star?path=${encodeURIComponent(host.path)}&export=tsv`, { headers: SH })).text();
const tsvLines = tsv.split("\n").filter((l, i, arr) => !(i === arr.length - 1 && l === ""));
ok("X1 the export's header line IS the API's columns (the original _rln names)", tsvLines[0] === api.columns.join("\t"), `head="${tsvLines[0].slice(0, 60)}"`);
ok("X2 the export's data lines equal the file's rowCount (the FULL block, not the 100 budget)", tsvLines.length - 1 === api.rowCount, `lines=${tsvLines.length - 1} rowCount=${api.rowCount}`);
ok("X3 the export's first data row IS the API's rows[0] (the native order as data)", (tsvLines[1] ?? "").split("\t").join("|||") === apiRows[0].join("|||"));
ok("X4 the export's last data row is non-empty (the file's own tail rides)", (tsvLines[tsvLines.length - 1] ?? "").length > 0);

/* ---------- the close: Escape closes what the world opened ---------- */
evalJson(ESC_LAST);
sleep(1.5);
const s4 = evalJson(MEASURE);
ok("C1 Escape closed the star dialog (the keymap seat's own teaching)", s4.dlgCount === a2.dlgCount - 1, `dlgCount ${a2.dlgCount} -> ${s4.dlgCount}`);
ok("C2 the inspector remains, zero unnamed", s4.hasDlg === true && censusOk(s4));
evalJson(ESC_LAST);
sleep(1);

/* ---------- Face W: the world back + the seed hygiene ---------- */
console.log("Face W — the world back (fresh load, sleep 3)");
ab("open http://localhost:3000");
sleep(3);
const w1 = settle("the restored canvas");
if (corpse(w1, "Face W")) process.exit(1);
ok("W1 the world unharmed (canvas count == the opening count, zero unnamed)", w1.pageBtns === OPEN && w1.pageUnnamed === 0 && !w1.hasDlg, `btns=${w1.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok("W2 the ride leaves no session seed (the t157 two-way door's honest none)", seedAfter.seed === "" || seedAfter.seed === null, `seed=${JSON.stringify(seedAfter.seed)}`);

/* ---------- the ledger at birth (three faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  starDialog: ledgerFace(prevFaces ? prevFaces.starDialog?.live ?? null : null, a2, scalarOf),
  sortAsc: ledgerFace(prevFaces ? prevFaces.sortAsc?.live ?? null : null, ascS, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f, RECEIPT_REVISION);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the star table's sort deep walk holds on the roster's biggest table (${host.name}, ${api.rowCount} rows): the clean room held, the host was measured from the outputs APIs and found BY NAME in the section, the dialog's 100 body rows speak the star route's truth cell for cell (row 0 exact, the door's spoken rows == rowCount, the footer's slice arithmetic honest), the aria-sort machine's every state was verified against the t651 comparator's own mirror — the # column AND the data column EXACTLY the mirror's order under ascending and descending, the native return bit-for-bit to rows[0] with the sort note honestly absent, the cross-column machine rode a second column (the first drops its announcement, the footer follows the new column), the export lane returned the FULL loop block at file scale (header, ${api.rowCount} data lines, line 1 == rows[0]), the world returned bit-for-bit and no seed was left — the ledger aboard from birth (three faces, arm 1)`
  : `${fail} red — the sort layer moved; call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: cmp.prev?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t872-star-sort-deep.mjs",
  ruler: NAMEOF_LAW,
  instrumentRevision: RECEIPT_REVISION,
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> outputs APIs (the host measured) -> host card (plain door) -> Results tab (mousedown) -> the winning door BY NAME -> star dialog (topmost) -> cell-scale API truth -> sort cycle (asc/desc/native, the mirror's exact order) -> cross-column machine -> export at file scale -> Escape x2 -> worldBack + seed hygiene (one command)",
  host: { name: host.job.name, id: host.job.id, file: host.name, path: host.path, rows: api.rowCount, measured: true },
  apiTruth: { rowCount: api.rowCount, columns: api.columns, pageRows: apiRows.length, truncated: api.truncated },
  sortTargets: { k: K, kColumn: api.columns[K], kScramble: scrambles[0].moved, j: J, jColumn: api.columns[J], jScramble: scrambles[1].moved },
  openingCanvas: OPEN,
  faces: {
    starDialog: { live: a2 },
    sortAsc: { live: ascS },
    worldBack: { live: w1 },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2));

console.log(`\nSTAR-SORT-DEEP t872: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
