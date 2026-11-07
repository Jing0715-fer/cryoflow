#!/usr/bin/env node
/**
 * t870 — the ortho panel's EXPORT triptych door: the footer's honesty at
 * document scale.
 *
 * The t869 tail's first candidate. The export door (t279/t291/t556/t559)
 * turns the live plane into ONE publishing-grade PNG — three canonical
 * sections on a fixed grid, a density-distribution thumbnail with the σ
 * ruler and the cyan contour cut, and a footer whose segments speak the
 * SAME truths the live panel speaks: the σ chip's contour (the footer's
 * σ segment — a GUESSED σ is a lie, absent σ simply stays honest), the
 * focus fractions, the UTC moment, and the oblique block's provenance
 * dialogue ⌖/⤸ in the block's own violet — ONLY while the reading still
 * holds (a hand on a slider revokes it; the footer must not lie).
 *
 * The walk rides SIX documents, one story:
 *   E1 the arrival triptych (oblique OFF) — the fixed grid measured from
 *      the pixels, the publishing backdrop, the three label strips' axis
 *      accents, the tile borders, the crosshair dashes AT THE LIVE
 *      ADDRESS (each line's column/row within ±3px of pos*512), the
 *      thumbnail's bars + σ ticks + the cyan cut COHERENT WITH THE
 *      WORLD'S OWN HISTOGRAM (fetched from the same API the export
 *      fetches), the footer's two text runs, the state machine ok.
 *   E2 one voxel step — the teal crosshair row MOVED exactly one voxel
 *      (512/(dim-1) px), the readout strips changed, the footer's stats
 *      run changed: the document follows the live plane.
 *   E3 the step home — the crosshair back bit-for-bit.
 *   E4 the oblique block ON, no gesture — the TETRAPTYCH (width 2118),
 *      the fourth strip violet, and the footer band's violet count ZERO
 *      (honest absence at document scale).
 *   E5 the ⤸ adopt door — the footer band speaks the dialogue (violet
 *      present): the chip's own law at document scale.
 *   E6 the reset door — the footer band's violet count back to ZERO
 *      (the hand revokes; the footer must not lie).
 *
 * The σ coherence check needs no OCR: the histogram's own coordinate
 * system pins the cut's expected column (px0 + (mean+sign·σ·std-lo)/
 * span · (px1-px0)), the σ ticks' expected columns likewise — every
 * found tick/cut cluster must sit within ±5px of the world's truth.
 *
 * Faces:
 *   O   the clean room (the t866 law) + the calm canvas
 *   MO  the Mol* world reached (the t867 recipe), the ortho panel
 *       expanded, the world's ready door + the σ chip's arrival
 *   EX  the six documents' deeds (above)
 *   OB  the provenance dialogue at document scale
 *   W   the world back (bit-for-bit) + the seed hygiene (the t866 lesson)
 *
 * Born with the ledger aboard (the t861 birthright): THREE faces —
 * exportDoc / obliDoc / worldBack — the instrument's revision 1 signed
 * (the birth).
 *
 * Receipt: shots-qa/t870-ortho-export-triptych.json (+ the six PNGs).
 *
 *   node scripts/t870-ortho-export-triptych.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW, RENDERED } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const REVISION = 1;

/* the export's fixed document grid — src-pinned ON PURPOSE (a document,
 * not a screenshot: map-ortho-panel.tsx EXPORT_* constants) */
const GAP = 14, TILE = 512, LABEL_H = 34, FOOT_H = 64, THUMB_H = 40;
const W_TRI = GAP * 4 + TILE * 3; // 1592
const W_TET = GAP * 5 + TILE * 4; // 2118
const H_DOC = GAP + LABEL_H + TILE + GAP + FOOT_H; // 638
const FOOT_TOP = GAP + LABEL_H + TILE + GAP; // 574
const STRIP_TOP = GAP, STRIP_BOT = GAP + LABEL_H; // 14..48
const TILE_TOP = STRIP_BOT, TILE_BOT = STRIP_BOT + TILE; // 48..560

/* the export's own colours (map-ortho-panel.tsx) */
const C = {
  bg: [0x0b, 0x12, 0x20],
  border: [0x33, 0x45, 0x55],
  text: [0x94, 0xa3, 0xb8],
  violet: [0x7c, 0x3a, 0xed],
  labelX: [0xf5, 0x9e, 0x0b],
  labelY: [0x8b, 0x5c, 0xf6],
  labelZ: [0x14, 0xb8, 0xa6],
  bar: [0x64, 0x74, 0x8b],
  tick: [0x47, 0x55, 0x69],
  mean: [0xe2, 0xe8, 0xf0],
  cut: [0x22, 0xd3, 0xee],
};
const eq = (p, c, tol = 10) =>
  Math.abs(p[0] - c[0]) <= tol && Math.abs(p[1] - c[1]) <= tol && Math.abs(p[2] - c[2]) <= tol;

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

/* ---------- provenance + the comparator (the family's shared law) ---------- */
const world = worldIdentity(ROOT);
const buildId = world.id;
const cmp = loadComparator(ROOT, "shots-qa/t870-ortho-export-triptych.json", buildId);
console.log(
  `t870 ortho export-triptych walk — world ${world.mode}:${buildId}, the footer's honesty at document scale\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${cmp.prev.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* same-origin metadata — the roster read is a same-origin gate (the t708 shape) */
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

/* ---------- the walk's helpers (the house forms, t867/t869's recipe) ---------- */
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';

const tileDoor = (suffix) =>
  '(() => { const sec = document.querySelector("section[aria-label=\\"Maps and images\\"]"); if (!sec) return JSON.stringify({ clicked: false }); const t = Array.from(sec.querySelectorAll("button[data-tile-path]")).find((b) => b.getAttribute("data-tile-path").endsWith("' + suffix + '")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()';

const view3dDoor =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = Array.from(d.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || x.textContent || "")).includes("View in 3D")); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true, text: (b.textContent || "").trim().slice(0, 30) }); })()';

const orthoDisc =
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); if (!o) return JSON.stringify({ clicked: false }); const d = Array.from(o.querySelectorAll("button")).find((b) => b.getAttribute("aria-expanded") !== null); if (!d) return JSON.stringify({ clicked: false }); d.click(); return JSON.stringify({ clicked: true, was: d.getAttribute("aria-expanded") }); })()';

const obliqueDisc =
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); if (!o) return JSON.stringify({ clicked: false }); const ds = Array.from(o.querySelectorAll("button")).filter((b) => b.getAttribute("aria-expanded") !== null); if (ds.length < 2) return JSON.stringify({ clicked: false }); ds[1].click(); return JSON.stringify({ clicked: true, was: ds[1].getAttribute("aria-expanded") }); })()';

/* the WORLD'S READY DOOR (the t869 law): the 3D controls block is
 * PHASE-GATED on the Mol* embed's ready phase; the σ chip rides the
 * embed's own contour report. Bounded by the world's own honesty (the
 * compile can legitimately take ~a minute). */
const READY_WAIT = 60;

const orthoStep = (i) =>
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const s = Array.from(o.querySelectorAll("button")).filter((b) => (b.getAttribute("aria-label") || "").startsWith("Step the ")); if (s.length <= ' + i + ') return JSON.stringify({ clicked: false }); s[' + i + '].click(); return JSON.stringify({ clicked: true, label: s[' + i + '].getAttribute("aria-label").slice(0, 60) }); })()';

const obliDoor = (needle) =>
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-oblique]"); if (!o) return JSON.stringify({ clicked: false }); const b = Array.from(o.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || "")).toLowerCase().includes("' + needle + '")); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true, label: (b.getAttribute("aria-label") || "").slice(0, 60) }); })()';

const obliReset =
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-oblique]"); if (!o) return JSON.stringify({ clicked: false }); const b = Array.from(o.querySelectorAll("button")).find((x) => (x.textContent || "").trim() === "reset"); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';

const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';
const escAll = () => {
  for (let i = 0; i < 8; i++) {
    const m = evalJson(MEASURE);
    if (!m.hasDlg) return i;
    evalJson(ESC_LAST);
    sleep(1.2);
  }
  return evalJson(MEASURE).hasDlg ? -1 : 8;
};

const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};

const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- the measure: the shared ruler + the export family's probes.
 * NO ${} inside. */
const MEASURE =
  '(() => { ' + NAMEOF + RENDERED + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b) && rendered(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c) && rendered(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgCount = dgs.length; const ortho = document.querySelector("[data-canvas-ui=ortho-panel]"); const oBtns = ortho ? Array.from(ortho.querySelectorAll("button")) : []; const shows = oBtns.filter((b) => (b.getAttribute("aria-label") || "").startsWith("Show the ")).map((b) => b.getAttribute("aria-label")); const oSliders = ortho ? Array.from(ortho.querySelectorAll("[role=slider]")).map((s) => ({ n: (s.getAttribute("aria-label") || ""), v: s.getAttribute("aria-valuenow") })) : []; const ob = document.querySelector("[data-canvas-ui=ortho-oblique]"); const prov = document.querySelector("[data-canvas-ui=ortho-oblique-prov]"); const sig = document.querySelector("[data-canvas-ui=ortho-sigma-chip]"); const exBtn = document.querySelector("[data-canvas-ui=ortho-export]"); const xh = document.querySelector("[data-canvas-ui=ortho-crosshair-toggle]"); return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dlgCount > 0, dlgCount: dlgCount, shimmer: Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())).length, orthoPresent: !!ortho, shows: shows, oSliders: oSliders, provText: prov ? (prov.textContent || "").trim() : null, sigmaChip: sig ? (sig.textContent || "").trim() : null, exState: exBtn ? exBtn.getAttribute("data-ortho-export-state") : null, xhairOn: xh ? xh.getAttribute("aria-pressed") : null, obliqueState: ob ? ob.getAttribute("data-oblique-state") : null }); })()';

const settle = (what, maxSecs = 16, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next);
      console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.shimmer === 0 && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (shimmer silent, ${run}x stable)`);
  return m;
};

const waitFor = (what, probe, maxSecs = 30) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  console.log(`    (waitFor "${what}" timed out after ${maxSecs}s — the last measure rides)`);
  return m;
};

/* the show-door grammar (the t869 law) — the voxel readout carries the DIM */
const parseShow = (label) => {
  let m = (label || "").match(/^Show the (.+) at ([xyz]) (\d+)\/(\d+) in 3D$/);
  if (m) {
    const dim = Number(m[4]);
    return { plane: m[1], axis: m[2], dim, readout: `${m[2]} ${m[3]}/${m[4]}`, form: "voxel" };
  }
  m = (label || "").match(/^Show the (.+) at ([xyz]) (\d+)% in 3D$/);
  if (m) return { plane: m[1], axis: m[2], dim: null, readout: `${m[2]} ${m[3]}%`, form: "percent" };
  return null;
};

/* the tile slider for one axis — "XY plane position along Z" ends with
 * "along <AXIS>"; its valuenow IS the focus point's coordinate on that axis. */
const tileSliderOf = (m, axis) =>
  (m.oSliders || []).find((s) => s.n.endsWith("along " + axis.toUpperCase()));

const positionsOf = (m) => {
  const g = (a) => {
    const s = tileSliderOf(m, a);
    return s && s.v !== null ? Number(s.v) : null;
  };
  return { x: g("x"), y: g("y"), z: g("z") };
};

/* the σ chip's grammar: "iso 3.29 σ" / "iso -0.87 σ" */
const parseSigma = (text) => {
  const m = (text || "").match(/^iso (-?)(\d+\.\d{2}) σ$/);
  return m ? { sign: m[1] ? -1 : 1, sigma: Number(m[2]) } : null;
};

/* ---------- the document reader (sharp decodes; the grid speaks) ---------- */
async function readDoc(path) {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, ch = info.channels;
  const px = (x, y) => {
    const i = (y * w + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  };
  return { w, h, px, data, ch };
}

/* column cluster finder: columns (x0..x1) whose in-band pixel count of a
 * colour family ≥ minCount → merged runs → each run's centre column */
function colClusters(doc, y0, y1, x0, x1, test, minCount) {
  const counts = new Array(x1 - x0 + 1).fill(0);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) if (test(doc.px(x, y))) counts[x - x0]++;
  const runs = [];
  let s = -1;
  for (let i = 0; i <= counts.length; i++) {
    const on = i < counts.length && counts[i] >= minCount;
    if (on && s < 0) s = i;
    if (!on && s >= 0) {
      runs.push({ from: x0 + s, to: x0 + i - 1, at: Math.round(x0 + (s + i - 1) / 2) });
      s = -1;
    }
  }
  return runs;
}

function rowClusters(doc, x0, x1, y0, y1, test, minCount) {
  const counts = new Array(y1 - y0 + 1).fill(0);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) if (test(doc.px(x, y))) counts[y - y0]++;
  const runs = [];
  let s = -1;
  for (let i = 0; i <= counts.length; i++) {
    const on = i < counts.length && counts[i] >= minCount;
    if (on && s < 0) s = i;
    if (!on && s >= 0) {
      runs.push({ from: y0 + s, to: y0 + i - 1, at: Math.round(y0 + (s + i - 1) / 2) });
      s = -1;
    }
  }
  return runs;
}

/* the crosshair hues — rgba(...,0.75) over grayscale tile content: the
 * hue gaps survive the blend (amber r-b≈176, violet b-g≈115, teal g-r≈123) */
const amberish = (p) => p[0] > 150 && p[0] - p[2] > 110;
const violetish = (p) => p[2] > 140 && p[2] - p[1] > 85 && p[0] < p[2];
const tealish = (p) => p[1] > 115 && p[1] - p[0] > 85;
/* the faded cut (alpha 0.35 over bg): g>70, b>90, r<45, b>g */
const cutish = (p) =>
  eq(p, C.cut, 12) || (p[1] > 70 && p[2] > 90 && p[0] < 45 && p[2] > p[1]);

/* region diff: how many pixels differ ≥ d between two docs in a rect */
function regionDiff(d1, d2, x0, y0, x1, y1, dmin = 26) {
  let n = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const a = d1.px(x, y), b = d2.px(x, y);
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) >= dmin) n++;
    }
  return n;
}

/* the download ride: the official door clicks the element and saves the
 * bytes; the export's own fetches + canvas + toBlob happen before the
 * anchor dance, the command waits for the download event. */
const exportRide = async (n) => {
  const p = join(ROOT, `shots-qa/t870-export-${n}.png`);
  ab(`download "[data-canvas-ui=ortho-export]" "${p}"`);
  const born = existsSync(p) && statSync(p).size > 0;
  return { path: p, born };
};

/* the export state machine: busy may flash; ok is the deed's receipt */
const waitExportOk = (maxSecs = 15) => {
  for (let i = 0; i < maxSecs; i++) {
    const s = evalJson('(() => { const b = document.querySelector("[data-canvas-ui=ortho-export]"); return JSON.stringify({ s: b ? b.getAttribute("data-ortho-export-state") : null }); })()');
    if (s.s === "ok") return "ok";
    if (s.s === "err") return "err";
    sleep(1);
  }
  return evalJson('(() => { const b = document.querySelector("[data-canvas-ui=ortho-export]"); return JSON.stringify({ s: b ? b.getAttribute("data-ortho-export-state") : null }); })()').s;
};

/* the world's own histogram — the SAME API the export's footer fetches */
const fetchHist = async (jobId, path) => {
  const r = await fetch(
    `${BASE}/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}&format=histogram`,
    { headers: SH, cache: "no-store" }
  );
  if (!r.ok) return null;
  return r.json();
};

/* ---------- the faces' holders ---------- */
let host = null;
let exSettled = null;
let obSettled = null;
let w3 = null;
const docs = {};

/* ---------- Face O — the clean room + the calm canvas ---------- */
console.log("Face O — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const m0 = settle("the canvas");
if (corpse(m0, "Face O")) process.exit(1);
ok(
  "O0 the boot is a clean room (the t157 seed cleared, the panel closed)",
  !m0.hasDlg && censusOk(m0),
  `btns=${m0.pageBtns} — zero unnamed anywhere`
);
const OPEN = m0.pageBtns;

/* ---------- the host: measured never pinned (a completed postprocess) ---------- */
const jobs = await roster();
const mapHost = jobs.find((j) => j.type === "postprocess" && j.status === "completed");
if (!mapHost) {
  console.error("no completed postprocess in the roster — the export door cannot open");
  process.exit(1);
}
host = mapHost;
console.log(`  map host (measured): ${host.name}`);

/* ---------- Face MO — reach the Mol* world, expand the ortho panel ---------- */
console.log("Face MO — the t867 recipe to the Mol* dialog, the ortho panel expanded");
const c1 = evalJson(plainClick(host.id));
ok("M1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
evalJson(tabMouseDown("Results"));
sleep(3);
waitFor("the maps gallery (the lazy barrel compiles)", (m) => m.pageBtns > 0 && m.imgs >= 1, 40);
const d0 = evalJson(tileDoor("postprocess.mrc"));
ok("M2 the map's Enlarge door clicked", d0.clicked === true);
waitFor("the quick-look dialog", (m) => m.dlgCount >= 2, 30);
const v3 = evalJson(view3dDoor);
ok(
  "M3 the View-in-3D door clicked (the name rides TEXT — the ruler's branch)",
  v3.clicked === true,
  `text="${v3.text}"`
);
const mo1 = waitFor(
  "the Mol* dialog + the ortho panel (the WebGL chunk compiles)",
  (m) => m.orthoPresent === true,
  45
);
if (corpse(mo1, "Face MO")) process.exit(1);
ok(
  "M4 the ortho panel rode in with the map handoff",
  mo1.orthoPresent === true && mo1.dlgCount >= 2,
  `dlgCount=${mo1.dlgCount}`
);
const od = evalJson(orthoDisc);
ok("M6 the disclosure walked open (collapsed -> expanded)", od.clicked === true);
const mo2 = waitFor(
  "the expanded panel (its COMPLETE shape: shows + sliders, the dims LANDED — the readouts in voxel form)",
  (m) => m.shows.length === 3 && m.oSliders.length >= 3 && m.shows.every((s) => / \/ \d+ in 3D$/.test(s || "")),
  20
);
const parsed = mo2.shows.map(parseShow);
ok(
  "M8 every show label PARSES with its dim (the readout carries the voxel count)",
  parsed.every((p) => p !== null) && parsed.filter((p) => p && p.form === "voxel").length === 3,
  `dims=${JSON.stringify(parsed.map((p) => (p ? p.dim : null)))}, shows=${JSON.stringify(mo2.shows.map((s) => (s || "").slice(0, 40)))}`
);
const pos0 = positionsOf(mo2);
ok(
  "M9 the three tile sliders give the focus point (the crosshair's coordinates)",
  pos0.x !== null && pos0.y !== null && pos0.z !== null,
  `x=${pos0.x} y=${pos0.y} z=${pos0.z}`
);
const mr = waitFor("the world's ready door", (m) => m.exState !== null, READY_WAIT);
ok(
  "M10 the export door's state machine is aboard (the phase gate OPENED)",
  mr.exState !== null,
  `exState=${mr.exState}`
);
/* the σ chip rides the embed's own report — absent σ keeps the footer honest */
const ms = waitFor("the σ chip (the embed's contour report)", (m) => m.sigmaChip !== null, READY_WAIT);
const sigma = parseSigma(ms.sigmaChip);
ok(
  "M11 the σ chip spoke (the embed answered; the footer's σ segment rides the SAME truth)",
  sigma !== null,
  `chip="${ms.sigmaChip}" -> sign=${sigma ? sigma.sign : "?"} σ=${sigma ? sigma.sigma : "?"}`
);

/* ---------- Face EX — the six documents' deeds ---------- */
console.log("Face EX — the export door: six documents, one story");
const exProbe = evalJson('(() => { const b = document.querySelector("[data-canvas-ui=ortho-export]"); return JSON.stringify({ label: b ? b.getAttribute("aria-label") : null, state: b ? b.getAttribute("data-ortho-export-state") : null, title: b ? b.getAttribute("title") : null }); })()');
ok(
  "X1 the export door is aboard, named EXACTLY (the t867 V7 census's own words)",
  exProbe.label === "Export the three orthogonal sections as a PNG triptych" && exProbe.state === "idle",
  `aria-label="${(exProbe.label || "").slice(0, 52)}", state=${exProbe.state}`
);

const pos = pos0;
const dimZ = parsed.find((p) => p && p.axis === "z")?.dim ?? null;
/* the map's path — read from the world's own tile door (never guessed):
 * the same path the export's fetches ride. */
const mapPath = evalJson('(() => { const sec = document.querySelector("section[aria-label=\\"Maps and images\\"]"); const t = Array.from(sec.querySelectorAll("button[data-tile-path]")).find((b) => b.getAttribute("data-tile-path").endsWith("postprocess.mrc")); return JSON.stringify({ p: t ? t.getAttribute("data-tile-path") : null }); })()').p;
const hist = mapPath ? await fetchHist(host.id, mapPath) : null;
console.log(`  map path (measured): ${mapPath}`);
console.log(`  histogram: ${hist ? `bins=${hist.bins.length} mean=${hist.mean.toFixed(2)} std=${hist.std.toFixed(2)} lo=${hist.lo.toFixed(2)} hi=${hist.hi.toFixed(2)}` : "ABSENT (the footer honestly skips the thumbnail)"}`);

/* the document's grid + accents + crosshair + footer, measured from pixels */
const auditDoc = (doc, tag, posn, sig, h) => {
  const W = doc.w;
  const nTiles = W === W_TET ? 4 : 3;
  const A = {};
  A.grid = doc.h === H_DOC && (W === W_TRI || W === W_TET);
  A.backdrop = eq(doc.px(2, 2), C.bg) && eq(doc.px(W - 3, doc.h - 3), C.bg) && eq(doc.px(2, doc.h - 3), C.bg) && eq(doc.px(W - 3, 2), C.bg);
  /* label strips: each tile's strip speaks its OWN axis accent */
  const accents = [];
  for (let i = 0; i < nTiles; i++) {
    const x0 = GAP + i * (TILE + GAP);
    let amber = 0, violet = 0, teal = 0;
    for (let x = x0; x < x0 + TILE; x += 2)
      for (let y = STRIP_TOP + 4; y < STRIP_BOT - 4; y += 2) {
        const p = doc.px(x, y);
        if (eq(p, C.labelX)) amber++;
        else if (eq(p, C.labelY)) violet++;
        else if (eq(p, C.labelZ)) teal++;
      }
    accents.push({ amber, violet, teal });
  }
  A.strips =
    accents[0].teal > 3 && accents[1].violet > 3 && accents[2].amber > 3 &&
    accents[0].violet === 0 && accents[0].amber === 0 &&
    accents[1].teal === 0 && accents[1].amber === 0 &&
    accents[2].teal === 0 && accents[2].violet === 0;
  /* tile borders: count the border ink along the expected EDGE SEGMENTS
   * (point samples straddle the 1px antialiased line — count, don't peek) */
  let topInk = 0, leftInk = 0, gapClean = true;
  for (let x = GAP + 4; x < GAP + TILE - 4; x++) if (eq(doc.px(x, TILE_TOP), C.border, 24) || eq(doc.px(x, TILE_TOP + 1), C.border, 24)) topInk++;
  for (let y = TILE_TOP + 4; y < TILE_BOT - 4; y++) if (eq(doc.px(GAP, y), C.border, 24) || eq(doc.px(GAP + 1, y), C.border, 24)) leftInk++;
  for (let y = TILE_TOP; y < TILE_BOT; y++) if (!eq(doc.px(GAP + TILE + Math.round(GAP / 2), y), C.bg)) { gapClean = false; break; }
  A.borders = topInk > TILE - 40 && leftInk > TILE - 40 && gapClean;
  A.borderInk = { topInk, leftInk, gapClean };
  /* crosshairs: per tile, the h/v lines at pos*512 (±3px) */
  const xh = {};
  const t0x = GAP, t1x = GAP + TILE + GAP, t2x = GAP + 2 * (TILE + GAP);
  const vAmber = colClusters(doc, TILE_TOP + 4, TILE_BOT - 4, t0x + 3, t0x + TILE - 3, amberish, 40);
  const hViolet = rowClusters(doc, t0x + 3, t0x + TILE - 3, TILE_TOP + 4, TILE_BOT - 4, violetish, 40);
  xh.t0 = vAmber.length === 1 && Math.abs(vAmber[0].at - (t0x + posn.x * TILE)) <= 3 &&
    hViolet.length === 1 && Math.abs(hViolet[0].at - (TILE_TOP + posn.y * TILE)) <= 3;
  const vAmber1 = colClusters(doc, TILE_TOP + 4, TILE_BOT - 4, t1x + 3, t1x + TILE - 3, amberish, 40);
  const hTeal1 = rowClusters(doc, t1x + 3, t1x + TILE - 3, TILE_TOP + 4, TILE_BOT - 4, tealish, 40);
  xh.t1 = vAmber1.length === 1 && Math.abs(vAmber1[0].at - (t1x + posn.x * TILE)) <= 3 &&
    hTeal1.length === 1 && Math.abs(hTeal1[0].at - (TILE_TOP + posn.z * TILE)) <= 3;
  const vViolet2 = colClusters(doc, TILE_TOP + 4, TILE_BOT - 4, t2x + 3, t2x + TILE - 3, violetish, 40);
  const hTeal2 = rowClusters(doc, t2x + 3, t2x + TILE - 3, TILE_TOP + 4, TILE_BOT - 4, tealish, 40);
  xh.t2 = vViolet2.length === 1 && Math.abs(vViolet2[0].at - (t2x + posn.y * TILE)) <= 3 &&
    hTeal2.length === 1 && Math.abs(hTeal2[0].at - (TILE_TOP + posn.z * TILE)) <= 3;
  A.crosshair = xh;
  /* the footer band: text runs + thumbnail */
  const footTextR = colClusters(doc, FOOT_TOP + 6, doc.h - 6, Math.round(W * 0.55), W - GAP - 2, (p) => eq(p, C.text), 2);
  const footTextL = colClusters(doc, FOOT_TOP + 6, doc.h - 6, GAP, GAP + 220, (p) => eq(p, C.mean), 2);
  A.footText = footTextR.length >= 8 && footTextL.length >= 4;
  /* the thumbnail's own border: #334155 columns that span the thumb's
   * FULL height (top edge rows AND bottom edge rows) — the bars' 0.5px
   * fills blend to a border-ish hue in the middle band only, so the
   * full-height test separates the rect's edge from the bar noise */
  const borderCol = (x) => {
    /* the rect's edge is a 1px stroke (ty+0.5 lands on ONE row) — demand
     * one ink row at the top band and one at the bottom band; the bars'
     * blend lives in the middle band only, so the two-band test stays
     * clean against the bar noise */
    let top = 0, bot = 0;
    for (let y = 584; y <= 589; y++) if (eq(doc.px(x, y), C.border, 24)) top++;
    for (let y = 622; y <= 628; y++) if (eq(doc.px(x, y), C.border, 24)) bot++;
    return top >= 1 && bot >= 1;
  };
  let tx0 = null, tx1 = null;
  for (let x = GAP; x < W - GAP; x++) if (borderCol(x)) { if (tx0 === null) tx0 = x; tx1 = x; }
  const thumbRuns = tx0 !== null ? [{ at: tx0 }, { at: tx1 }] : [];
  A.thumbBorder = thumbRuns.length >= 2;
  A.thumbGeo = { tx0, tx1, runs: thumbRuns.length };
  if (h && tx0 !== null && tx1 !== null && tx1 - tx0 > 50) {
    const px0 = tx0 + 4, px1 = tx1 - 4;
    const span = h.hi - h.lo;
    const xOf = (v) => (span > 0 ? px0 + ((v - h.lo) / span) * (px1 - px0) : (px0 + px1) / 2);
    /* bars — the 256 bars over a ~290px plot area draw at 0.5px fills:
     * the canvas BLENDS them (#374355 over the bg), the solid #64748b
     * never survives. The test counts INK columns — columns in the plot
     * band whose rows hold ≥8 non-bg pixels (bars + their blend); the
     * ticks/cut are 1-2px wide, the bars span hundreds of columns. */
    let inkCols = 0;
    for (let x = tx0 + 3; x <= tx1 - 3; x++) {
      let ink = 0;
      for (let y = FOOT_TOP + 14; y <= FOOT_TOP + THUMB_H - 8; y++)
        if (!eq(doc.px(x, y), C.bg, 8)) ink++;
      if (ink >= 8) inkCols++;
    }
    A.bars = inkCols >= 100;
    A.barInk = inkCols;
    /* σ ticks: expected columns from the world's own histogram. The
     * draw order is ticks -> bars -> cut, so a tick can hide UNDER the
     * bars' 0.5px fills or under the cut line — the rule demands the two
     * ±1σ ANCHORS (symmetric about μ) and at least two visible hits. */
    const tickRuns = colClusters(doc, FOOT_TOP + 6, FOOT_TOP + THUMB_H - 6, tx0 + 2, tx1 - 2, (p) => eq(p, C.tick, 12), 2);
    const expTicks = [-2, -1, 0, 1, 2]
      .map((s) => ({ s, col: xOf(h.mean + s * h.std) }))
      .filter((e) => e.col >= px0 && e.col <= px1);
    const hitOf = (col) => tickRuns.some((r) => Math.abs(r.at - col) <= 5);
    const anchors = expTicks.filter((e) => Math.abs(e.s) === 1);
    const anchorHits = anchors.filter((e) => hitOf(e.col)).length;
    const allHits = expTicks.filter((e) => hitOf(e.col)).length;
    A.ticks = { found: tickRuns.map((r) => r.at), expected: expTicks.map((e) => Math.round(e.col)), hit: allHits, anchorHits, anchors: anchors.length };
    /* the cyan cut: the σ chip's own value AT EXPORT TIME at the
     * histogram's coordinates — the chip's law at document scale. The
     * chip is read settled right before the ride (the pumpContour settle
     * can flip the sign late; the footer speaks the state AS EXPORTED). */
    if (sig) {
      const v = h.mean + sig.sign * sig.sigma * h.std;
      const expCol = Math.min(px1, Math.max(px0, xOf(v)));
      const cutRuns = colClusters(doc, FOOT_TOP + 4, FOOT_TOP + THUMB_H - 8, tx0 + 2, tx1 - 2, cutish, 2);
      const onScale = v >= h.lo && v <= h.hi;
      const cHit = cutRuns.some((r) => Math.abs(r.at - expCol) <= 5);
      A.cut = { expCol: Math.round(expCol), found: cutRuns.map((r) => r.at), onScale, hit: cHit, chip: `iso ${sig.sign < 0 ? "-" : ""}${sig.sigma.toFixed(2)} σ` };
    }
  }
  return A;
};

/* the σ chip read SETTLED — the pumpContour settle can flip the sign late;
 * the footer speaks the state AS EXPORTED, so the instrument reads the
 * chip twice (1s apart) and rides the settled value. */
const sigmaSettled = async (maxTries = 8) => {
  let prev = null;
  for (let i = 0; i < maxTries; i++) {
    const t = evalJson('(() => { const s = document.querySelector("[data-canvas-ui=ortho-sigma-chip]"); return JSON.stringify({ t: s ? (s.textContent || "").trim() : null }); })()').t;
    const cur = parseSigma(t);
    if (cur && prev && cur.sign === prev.sign && cur.sigma === prev.sigma) return cur;
    prev = cur;
    sleep(1);
  }
  return prev;
};

/* E1 — the arrival triptych. The σ chip is read SETTLED BEFORE the click:
 * the export speaks the state AS CLICKED, the pumpContour settle can flip
 * the sign late — the instrument settles first, then rides. */
const sigmaE1 = await sigmaSettled();
if (sigmaE1 && (sigma.sign !== sigmaE1.sign || sigma.sigma !== sigmaE1.sigma))
  console.log(`    (the σ chip settled late: M11 read ${sigma.sign < 0 ? "-" : ""}${sigma.sigma}, settled ${sigmaE1.sign < 0 ? "-" : ""}${sigmaE1.sigma} — the footer speaks the state AS EXPORTED)`);
const e1 = await exportRide(1);
ok("X2 the download rode (the official door saved the bytes)", e1.born, `${e1.path.split("/").pop()} ${e1.born ? statSync(e1.path).size + "B" : ""}`);
docs.e1 = e1.born ? await readDoc(e1.path) : null;
const stOk1 = waitExportOk();
ok("X3 the state machine spoke ok (busy -> ok, the deed's receipt)", stOk1 === "ok", `state=${stOk1}`);
if (docs.e1) {
  const A1 = auditDoc(docs.e1, "E1", pos, sigmaE1 ?? sigma, hist);
  ok("X4 the fixed document grid measured (3×512 tiles, 1592×638 — a document, not a screenshot)", A1.grid, `${docs.e1.w}×${docs.e1.h}`);
  ok("X5 the publishing backdrop (#0b1220 at all four corners)", A1.backdrop);
  ok("X6 the three label strips speak their OWN axis accents (z teal / y violet / x amber, none strayed)", A1.strips, JSON.stringify(A1.strips && [1, 1, 1]));
  ok("X7 the tile borders drawn at the grid's seams, the gap clean (edge-segment ink counted)", A1.borders, `top=${A1.borderInk.topInk}px left=${A1.borderInk.leftInk}px gapClean=${A1.borderInk.gapClean}`);
  ok(
    "X8 the crosshair rides the live address — every line within ±3px of pos×512 (t0 amber/violet, t1 amber/teal, t2 violet/teal)",
    A1.crosshair.t0 && A1.crosshair.t1 && A1.crosshair.t2,
    `t0=${A1.crosshair.t0} t1=${A1.crosshair.t1} t2=${A1.crosshair.t2}`
  );
  ok("X9 the footer's two text runs present (basename left in #e2e8f0, stats right in #94a3b8)", A1.footText);
  if (hist) {
    ok("X10 the thumbnail drew (the border and the log bars measured)", A1.thumbGeo.runs >= 2 && A1.bars, `border runs=${A1.thumbGeo.runs} at x ${A1.thumbGeo.tx0}..${A1.thumbGeo.tx1}, ink cols=${A1.barInk}`);
    if (A1.ticks)
      ok(
        "X11 the σ ruler coherent with the WORLD'S OWN HISTOGRAM (both ±1σ anchors + ≥2 visible ticks within ±5px)",
        A1.ticks.anchorHits === A1.ticks.anchors && A1.ticks.hit >= 2,
        `anchors ${A1.ticks.anchorHits}/${A1.ticks.anchors}, all ${A1.ticks.hit}/${A1.ticks.expected.length} (found ${JSON.stringify(A1.ticks.found)} vs expected ${JSON.stringify(A1.ticks.expected)})`
      );
    if (sigma && A1.cut)
      ok(
        "X12 the cyan cut speaks the σ CHIP'S value AT EXPORT TIME at the histogram's coordinates",
        A1.cut.hit,
        `chip "${A1.cut.chip}" -> expected col ${A1.cut.expCol}, found ${JSON.stringify(A1.cut.found)} (${A1.cut.onScale ? "on-scale" : "off-scale faded"})`
      );
  }
}
exSettled = settle("the export face");
ok("X13 zero unnamed page-wide WITH the export face walked (the census's invariant)", censusOk(exSettled), `btns=${exSettled.pageBtns} ctrls=${exSettled.ctrls}`);

/* E2 — one voxel step: the document follows the live plane */
const stFwd = evalJson(orthoStep(1)); // tile 0's "toward the end" (one voxel along Z)
sleep(1.8);
const mFwd = waitFor("E2 the stepped plane", (m) => m.oSliders.length >= 3, 12);
const posF = positionsOf(mFwd);
ok(
  "X14 the step MOVED the z focus one voxel (the live plane the document must follow)",
  stFwd.clicked === true && pos.z !== null && posF.z !== null && posF.z > pos.z,
  `z ${pos.z?.toFixed(4)} -> ${posF.z?.toFixed(4)} (Δ=${posF.z !== null && pos.z !== null ? (posF.z - pos.z).toFixed(4) : "?"})`
);
const e2 = await exportRide(2);
docs.e2 = e2.born ? await readDoc(e2.path) : null;
ok("X15 the second document rode", e2.born);
if (docs.e1 && docs.e2) {
  const t1x = GAP + TILE + GAP;
  const rowA = rowClusters(docs.e1, t1x + 3, t1x + TILE - 3, TILE_TOP + 4, TILE_BOT - 4, tealish, 40);
  const rowB = rowClusters(docs.e2, t1x + 3, t1x + TILE - 3, TILE_TOP + 4, TILE_BOT - 4, tealish, 40);
  const want = dimZ ? TILE / (dimZ - 1) : null;
  const got = rowA.length === 1 && rowB.length === 1 ? rowB[0].at - rowA[0].at : null;
  ok(
    "X16 the teal crosshair row MOVED exactly one voxel (TILE/(dim-1) px, ±3px) — the document followed the plane",
    want !== null && got !== null && Math.abs(got - want) <= 3,
    `row ${rowA[0] ? rowA[0].at : "?"} -> ${rowB[0] ? rowB[0].at : "?"} (Δ=${got}, want ${want ? want.toFixed(1) : "?"} px for dim=${dimZ})`
  );
  /* the z step re-speaks TILE 0's own readout ("z N/D") — tile 1's strip
   * reads y and stays still (the readouts are per-PLANE, the t869 law's
   * own grammar) */
  const stripMoved = regionDiff(docs.e1, docs.e2, GAP, STRIP_TOP, GAP + TILE, STRIP_BOT);
  const footMoved = regionDiff(docs.e1, docs.e2, Math.round(docs.e1.w * 0.55), FOOT_TOP, docs.e1.w - GAP - 2, docs.e1.h);
  ok(
    "X17 the readout strip and the footer's stats run BOTH re-spoke (pixel-diff > 0 in both regions)",
    stripMoved > 0 && footMoved > 0,
    `strip diff=${stripMoved}px, footer diff=${footMoved}px`
  );
}

/* E3 — the step home: the document back bit-for-bit */
evalJson(orthoStep(0)); // tile 0's "toward the start" — one voxel back
sleep(1.8);
const mHome = waitFor("E3 the restored plane", (m) => m.oSliders.length >= 3, 12);
const posH = positionsOf(mHome);
ok(
  "X18 the walk home restored the focus (z back within half a voxel)",
  posH.z !== null && pos.z !== null && Math.abs(posH.z - pos.z) <= (dimZ ? 0.5 / (dimZ - 1) + 1e-9 : 0.0051),
  `z ${posF.z?.toFixed(4)} -> ${posH.z?.toFixed(4)} (arrival ${pos.z?.toFixed(4)})`
);
const e3 = await exportRide(3);
docs.e3 = e3.born ? await readDoc(e3.path) : null;
if (docs.e1 && docs.e3) {
  const t1x = GAP + TILE + GAP;
  const rowA = rowClusters(docs.e1, t1x + 3, t1x + TILE - 3, TILE_TOP + 4, TILE_BOT - 4, tealish, 40);
  const rowC = rowClusters(docs.e3, t1x + 3, t1x + TILE - 3, TILE_TOP + 4, TILE_BOT - 4, tealish, 40);
  ok(
    "X19 the restored document's crosshair back at the arrival row (±2px — the walk left NO residue)",
    rowA.length === 1 && rowC.length === 1 && Math.abs(rowC[0].at - rowA[0].at) <= 2,
    `row ${rowA[0] ? rowA[0].at : "?"} -> ${rowC[0] ? rowC[0].at : "?"}`
  );
}

/* ---------- Face OB — the provenance dialogue at document scale ---------- */
console.log("Face OB — the footer's dialogue: honest absence, ⤸ speaks, reset revokes");
const obd = evalJson(obliqueDisc);
ok("P1 the oblique disclosure walked open", obd.clicked === true);
const pob = waitFor("the oblique block", (m) => m.obliqueState === "on" && m.oSliders.length >= 6, 20);
ok("P2 the oblique block ON at home angles (θ=0 φ=0, no gesture yet)", pob.obliqueState === "on", `sliders=${pob.oSliders.length}`);

/* E4 — the tetraptych, honest absence in the footer */
const e4 = await exportRide(4);
docs.e4 = e4.born ? await readDoc(e4.path) : null;
ok("X20 the fourth document rode (the tetraptych's own door)", e4.born);
if (docs.e4) {
  const t3x = GAP + 3 * (TILE + GAP);
  const stripViolet = colClusters(docs.e4, STRIP_TOP + 4, STRIP_BOT - 4, t3x + 2, t3x + TILE - 2, (p) => eq(p, C.violet), 2);
  const footViolet = colClusters(docs.e4, FOOT_TOP + 6, docs.e4.h - 6, GAP, docs.e4.w - GAP - 2, (p) => eq(p, C.violet), 1);
  ok(
    "X21 the TETRAPTYCH measured (width 2118 — the fourth panel aboard)",
    docs.e4.w === W_TET && docs.e4.h === H_DOC,
    `${docs.e4.w}×${docs.e4.h}`
  );
  ok(
    "X22 the fourth strip speaks the oblique's own violet (the 'Oblique' label, #7c3aed)",
    stripViolet.length >= 1,
    `violet runs=${stripViolet.length} at x=${JSON.stringify(stripViolet.map((r) => r.at))}`
  );
  ok(
    "X23 the footer band's violet count ZERO (honest absence at document scale — no gesture, no dialogue)",
    footViolet.length === 0,
    `violet runs=${footViolet.length}`
  );
}

/* E5 — the ⤸ adopt door: the footer speaks the dialogue */
const ad = evalJson(obliDoor("adopt the current 3d camera"));
const pa = waitFor("P3 the adopt chip", (m) => m.provText !== null, 12);
ok(
  "P3 the adopt door spoke the chip (⤸, whole degrees)",
  ad.clicked === true && pa.provText !== null && (pa.provText || "").startsWith("⤸"),
  `chip="${pa.provText}"`
);
const e5 = await exportRide(5);
docs.e5 = e5.born ? await readDoc(e5.path) : null;
ok("X24 the fifth document rode", e5.born);
if (docs.e5) {
  const footViolet = colClusters(docs.e5, FOOT_TOP + 6, docs.e5.h - 6, GAP, docs.e5.w - GAP - 2, (p) => eq(p, C.violet), 1);
  const t3x = GAP + 3 * (TILE + GAP);
  const stripViolet = colClusters(docs.e5, STRIP_TOP + 4, STRIP_BOT - 4, t3x + 2, t3x + TILE - 2, (p) => eq(p, C.violet), 2);
  ok(
    "X25 the footer SPEAKS the dialogue (violet in the footer band — the chip's own law at document scale)",
    docs.e5.w === W_TET && footViolet.length >= 1,
    `w=${docs.e5.w}, footer violet runs=${footViolet.length} at x=${JSON.stringify(footViolet.map((r) => r.at))}, strip runs=${stripViolet.length}`
  );
  if (docs.e4) {
    const footMoved = regionDiff(docs.e4, docs.e5, Math.round(docs.e5.w * 0.5), FOOT_TOP, docs.e5.w - GAP - 2, docs.e5.h);
    ok(
      "X26 the dialogue's arrival CHANGED the footer (the two documents' footers differ — the dialogue is ink, not air)",
      footMoved > 0,
      `footer diff=${footMoved}px vs E4`
    );
  }
}

/* E6 — the reset door: the hand revokes, the footer must not lie */
const rs = evalJson(obliReset);
sleep(1.2);
const pr = evalJson(MEASURE);
ok(
  "P6 the reset door revoked the attribution (the chip gone)",
  rs.clicked === true && pr.provText === null,
  `chip=${JSON.stringify(pr.provText)}`
);
const e6 = await exportRide(6);
docs.e6 = e6.born ? await readDoc(e6.path) : null;
ok("X27 the sixth document rode", e6.born);
if (docs.e6) {
  const footViolet = colClusters(docs.e6, FOOT_TOP + 6, docs.e6.h - 6, GAP, docs.e6.w - GAP - 2, (p) => eq(p, C.violet), 1);
  ok(
    "X28 the footer band's violet count back to ZERO (the reset revokes at document scale — the footer must not lie)",
    docs.e6.w === W_TET && footViolet.length === 0,
    `w=${docs.e6.w}, footer violet runs=${footViolet.length}`
  );
}
obSettled = settle("the oblique face (second ride)");
ok(
  "P7 zero unnamed page-wide WITH the camera dialogue walked at document scale",
  censusOk(obSettled),
  `btns=${obSettled.pageBtns} ctrls=${obSettled.ctrls}`
);

/* ---------- Face W — the world back + the seed hygiene ---------- */
console.log("Face W — the world back (fresh load, sleep 3)");
escAll();
ab("open http://localhost:3000");
sleep(3);
w3 = settle("the restored canvas");
if (corpse(w3, "Face W")) process.exit(1);
ok(
  "W1 the world unharmed (canvas count == the opening count, zero unnamed)",
  w3.pageBtns === OPEN && censusOk(w3) && !w3.hasDlg,
  `btns=${w3.pageBtns} (opening ${OPEN})`
);
const seedAfter = evalJson('(() => { return JSON.stringify({ seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()');
ok(
  "W2 the ride leaves no session seed (the t157 two-way door's honest none)",
  seedAfter.seed === "" || seedAfter.seed === null,
  `seed=${JSON.stringify(seedAfter.seed)}`
);

/* ---------- the ledger at birth (three faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const faces = [
  ["exportDoc", exSettled],
  ["obliDoc", obSettled],
  ["worldBack", w3],
];
const dlFaces = {};
for (const [name, live] of faces) {
  const prevObj = cmp.prevFound ? cmp.prev?.faces?.[name]?.live ?? cmp.prev?.faces?.[name]?.settled ?? null : null;
  const scalarOf = (m) => m.pageBtns;
  const f = ledgerFace(prevObj, live, scalarOf);
  dlFaces[name] = f;
  const v = armVerdict(cmp, world, f, REVISION);
  ok(`${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- the receipt ---------- */
const docAudit = {
  e1: docs.e1 ? { w: docs.e1.w, h: docs.e1.h } : null,
  e4: docs.e4 ? { w: docs.e4.w, h: docs.e4.h } : null,
  e5: docs.e5 ? { w: docs.e5.w, h: docs.e5.h } : null,
  e6: docs.e6 ? { w: docs.e6.w, h: docs.e6.h } : null,
};
writeFileSync(
  join(ROOT, "shots-qa/t870-ortho-export-triptych.json"),
  JSON.stringify(
    {
      instrument: "scripts/t870-ortho-export-triptych.mjs",
      instrumentRevision: REVISION,
      ruler: NAMEOF_LAW,
      build: world.id,
      worldMode: world.mode,
      date: new Date().toISOString(),
      chain:
        "clean room -> canvas -> postprocess card (plain door) -> Results tab (mousedown) -> Enlarge postprocess.mrc -> quick-look -> View-in-3D (text door) -> ortho panel expanded -> the world's ready door + the σ chip's arrival -> SIX documents: E1 arrival triptych (grid/accents/crosshair-at-address/thumbnail coherent with the world's own histogram/the cyan cut at the chip's σ), E2 one voxel step (the teal row moved exactly one voxel, strip+footer re-spoke), E3 step home (the crosshair back), E4 tetraptych with the footer's violet count ZERO (honest absence), E5 the ⤸ adopt door (the footer speaks the dialogue), E6 the reset door (the footer's violet back to ZERO) -> Escape home -> worldBack + seed hygiene (one command)",
      host: host ? { name: host.name, id: host.id, path: mapPath, measured: true } : null,
      docs: docAudit,
      histogram: hist ? { bins: hist.bins.length, mean: hist.mean, std: hist.std, lo: hist.lo, hi: hist.hi } : null,
      sigma: sigma ?? null,
      faces: {
        exportDoc: { live: exSettled },
        obliDoc: { live: obSettled },
        worldBack: { live: w3 },
      },
      driftLedger: {
        prevFound: cmp.prevFound,
        sameBuild: cmp.sameBuild,
        prevBuild: cmp.prevBuild,
        prevDate: cmp.prev ? cmp.prev.date : null,
        prevRevision: cmp.prevRevision,
        law: LEDGER_LAW,
        faces: dlFaces,
      },
      checks: results,
      passed: pass,
      failed: fail,
      total: pass + fail,
      verdict:
        fail === 0
          ? `the export door's page holds: six documents one story — the triptych's fixed grid measured from its own pixels (1592×638, the publishing backdrop, the three strips' axis accents, the crosshair at the live address ±3px, the thumbnail coherent with the world's own histogram, the cyan cut at the σ chip's value at the histogram's coordinates), the voxel step followed by the document (the teal row moved exactly ${dimZ ? (TILE / (dimZ - 1)).toFixed(1) : "?"}px, the strip and the footer re-spoke), the step home restored, the tetraptych's honest absence (footer violet ZERO), the ⤸ dialogue's ink in the footer, the reset's revocation — the footer must not lie, at ANY scale; the ledger aboard from birth (three faces, the shared law) with the instrument's revision signed`
          : `the export door's page reds in ${fail} place(s) — the birth's honest reds are the curriculum`,
    },
    null,
    2
  )
);
console.log(`\nreceipt: ${join(ROOT, "shots-qa/t870-ortho-export-triptych.json")}`);
console.log(`\nORTHO-EXPORT-TRIPTYCH t870: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);

