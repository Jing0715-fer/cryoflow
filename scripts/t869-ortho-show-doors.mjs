#!/usr/bin/env node
/**
 * t869 — the ortho panel's SHOW-at doors' live walk, and the camera↔plane
 * dialogue's own page.
 *
 * t867's V7 counted the three "Show the <plane> at <readout> in 3D" doors;
 * this window the doors are RIDDEN — the show → 3D handoff proven live:
 * each door's click turns the Mol* cross-section ON at the door's own
 * axis, the axis chip follows, the plane-position slider rides the door's
 * parsed address, the density profile tracks, and the 3D → 2D echo
 * returns the plane to the panel's own tile slider. The door's word is
 * its deed, at EVERY address: after one voxel-step the tile's label
 * re-speaks the NEW readout (the label is live, never a snapshot), and a
 * re-click carries the new address into the 3D scene; the step home
 * restores the arrival state bit-for-bit (the t867 S15 no-residue law).
 *
 * The oblique block's camera↔plane dialogue (t556/t557/t559) rides its
 * first live walk too: the provenance chip is ABSENT at arrival (honest
 * absence), the ⤸ adopt door pulls the live camera and the chip speaks
 * the adopted angles (the sliders followed the camera — measured), the
 * ⌖ jump door RE-ATTRIBUTES without re-cutting (the glyph flips, the
 * angles stay), and the reset door revokes (the footer must not lie).
 *
 * Faces:
 *   O   the clean room (the t866 law) + the calm canvas
 *   MO  the Mol* world reached (the t867 recipe: plain door -> Results
 *       mousedown -> Enlarge -> View-in-3D text door), the ortho panel
 *       expanded, the three show doors enumerated and PARSED
 *   SD  the three doors' deeds: per door — slice ON, the axis chip
 *       pressed, the plane slider at the door's address (half-step
 *       tolerance), the density profile at the door's percent, the echo
 *       returned to the tile slider; then the label-freshness walk and
 *       the no-residue return; zero unnamed; two settled rides
 *   OB  the provenance dialogue: absence -> ⤸ adopt (sliders follow) ->
 *       ⌖ jump (re-attribute, same angles) -> reset revokes; zero
 *       unnamed; two settled rides
 *   W   the world back (bit-for-bit) + the seed hygiene (the t866 lesson)
 *
 * Born with the ledger aboard (the t861 birthright): THREE faces —
 * showDoors / obliqueProv / worldBack — with the instrument's revision
 * signed (the t867 arm 2r contract, revision 1 = the birth).
 *
 * Receipt: shots-qa/t869-ortho-show-doors.json.
 *
 *   node scripts/t869-ortho-show-doors.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW, RENDERED } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
/* the instrument's own revision (the t867 arm 2r's contract): bumped
 * WHENEVER the measurement conditions change. Revision 1 = the birth. */
const REVISION = 1;

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

/** agent-browser eval unwrap — the t837 defensive form. */
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
const cmp = loadComparator(ROOT, "shots-qa/t869-ortho-show-doors.json", buildId);
console.log(
  `t869 ortho show-doors walk — world ${world.mode}:${buildId}, the show→3D handoff and the camera dialogue through the shared ruler\n` +
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

/* ---------- the walk's helpers (the house forms, t867's recipe) ---------- */
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

/* the ortho panel's own step button for one axis (dec/inc by index) — the
 * app's own state machine, the freshness walk rides it. */
const orthoStep = (i) =>
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); const s = Array.from(o.querySelectorAll("button")).filter((b) => (b.getAttribute("aria-label") || "").startsWith("Step the ")); if (s.length <= ' + i + ') return JSON.stringify({ clicked: false }); s[' + i + '].click(); return JSON.stringify({ clicked: true, label: s[' + i + '].getAttribute("aria-label").slice(0, 60) }); })()';

/* a SHOW-at door by index — clicked through its own aria-label (the
 * opacity-0 reveal is presentation, not absence — the t868 law). */
const showDoor = (i) =>
  '(() => { const o = document.querySelector("[data-canvas-ui=ortho-panel]"); if (!o) return JSON.stringify({ clicked: false }); const ds = Array.from(o.querySelectorAll("button")).filter((b) => (b.getAttribute("aria-label") || "").startsWith("Show the ")); if (ds.length <= ' + i + ') return JSON.stringify({ clicked: false, have: ds.length }); const b = ds[' + i + ']; b.click(); return JSON.stringify({ clicked: true, label: b.getAttribute("aria-label") }); })()';

/* the WORLD'S READY DOOR: the 3D controls block (the slice toggle, the
 * axis chips, the sliders) is PHASE-GATED on the Mol* embed's ready phase
 * (molstar-embed.tsx:4909) — the ortho panel itself mounts EARLIER
 * (mol-viewer.tsx:164, not gated), so "the panel arrived" is NOT "the
 * world ready" (the birth's second honest red: the first deed clicked a
 * world still compiling, and the intent rode into a controls-less DOM).
 * The ready door is the controls block's own arrival — bounded by the
 * world's own honesty (the embed's slow hint: the compile can
 * legitimately take ~a minute on slow disks). */
const READY_WAIT = 60;

/* the oblique block's doors, found inside its own region. */
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

/* ---------- the measure: the shared ruler + the show-door family's
 * probes. The 3D side is scoped to the dialog that CONTAINS the ortho
 * panel (the Mol* dialog) — never dlgTop guesses. NO ${} inside. */
const MEASURE =
  '(() => { ' + NAMEOF + RENDERED + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b) && rendered(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c) && rendered(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgCount = dgs.length; const actTabEl = dlgCount ? dgs[dlgCount - 1].querySelector("[role=tab][data-state=active]") : document.querySelector("[role=tab][data-state=active]"); const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())); const ortho = document.querySelector("[data-canvas-ui=ortho-panel]"); const molDlg = ortho ? ortho.closest("[role=dialog]") : null; const oBtns = ortho ? Array.from(ortho.querySelectorAll("button")) : []; const oDiscs = oBtns.filter((b) => b.getAttribute("aria-expanded") !== null); const shows = oBtns.filter((b) => (b.getAttribute("aria-label") || "").startsWith("Show the ")).map((b) => b.getAttribute("aria-label")); const oSliders = ortho ? Array.from(ortho.querySelectorAll("[role=slider]")).map((s) => ({ n: (s.getAttribute("aria-label") || ""), v: s.getAttribute("aria-valuenow") })) : []; const ob = document.querySelector("[data-canvas-ui=ortho-oblique]"); const prov = document.querySelector("[data-canvas-ui=ortho-oblique-prov]"); const sliceTgl = molDlg ? Array.from(molDlg.querySelectorAll("button")).find((b) => (b.getAttribute("aria-label") || "") === "Toggle cross-section plane") : null; const chipGroup = molDlg ? Array.from(molDlg.querySelectorAll("[role=group]")).find((g) => (g.getAttribute("aria-label") || "") === "Cross-section axis") : null; const chips = chipGroup ? Array.from(chipGroup.querySelectorAll("button")).map((b) => ({ a: (b.textContent || "").trim(), p: b.getAttribute("aria-pressed") === "true" })) : []; const sliceSlider = molDlg ? Array.from(molDlg.querySelectorAll("[role=slider]")).find((s) => (s.getAttribute("aria-label") || "").startsWith("Cross-section plane position")) : null; const profSlider = molDlg ? Array.from(molDlg.querySelectorAll("[role=slider]")).find((s) => (s.getAttribute("aria-label") || "").startsWith("Density profile along")) : null; return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dlgCount > 0, dlgCount: dlgCount, actTab: actTabEl ? (actTabEl.textContent || "").trim().slice(0, 12) : null, shimmer: leaves.length, orthoPresent: !!ortho, orthoRoot: ortho ? ortho.getAttribute("aria-label") : null, obliqueState: ob ? ob.getAttribute("data-oblique-state") : null, shows: shows, oSliders: oSliders, provText: prov ? (prov.textContent || "").trim() : null, sliceOn: sliceTgl ? sliceTgl.getAttribute("aria-pressed") : null, chips: chips, sliceNow: sliceSlider ? sliceSlider.getAttribute("aria-valuenow") : null, profNow: profSlider ? profSlider.getAttribute("aria-valuenow") : null, profText: profSlider ? profSlider.getAttribute("aria-valuetext") : null }); })()';

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

/* the SHOW-at door's own grammar, parsed — the door's label IS the deed's
 * promise, and the promise is the ROUNDED address: the readout "z 33/64"
 * speaks Math.round(pos*(dim-1))+1, so the fraction underneath is only
 * recoverable to ±half a voxel (the birth's first honest red: the draft
 * parsed the readout as the exact fraction and measured a world that
 * owed 33/64 at pos 0.5 = 31.5/63 — the readout's own rounding). The
 * door's deed is therefore demanded AT THE READOUT'S OWN PRECISION: the
 * 3D plane within half a voxel of the promised address, the family
 * (profile/tile echo) consistent with the plane the slider speaks. */
const parseShow = (label) => {
  let m = (label || "").match(/^Show the (.+) at ([xyz]) (\d+)\/(\d+) in 3D$/);
  if (m) {
    const dim = Number(m[4]);
    return {
      plane: m[1],
      axis: m[2],
      dim,
      readout: `${m[2]} ${m[3]}/${m[4]}`,
      form: "voxel",
      pos: dim > 1 ? (Number(m[3]) - 1) / (dim - 1) : 0,
      tol: dim > 1 ? 0.5 / (dim - 1) + 1e-9 : 0.0051,
    };
  }
  m = (label || "").match(/^Show the (.+) at ([xyz]) (\d+)% in 3D$/);
  if (m) {
    return { plane: m[1], axis: m[2], dim: null, readout: `${m[2]} ${m[3]}%`, form: "percent", pos: Number(m[3]) / 100, tol: 0.0051 };
  }
  return null;
};

/* the provenance chip's grammar: "⌖ 35°·120°" / "⤸ 0°·0°" — whole degrees
 * (cameraDirToAngles rounds). */
const parseProv = (text) => {
  const m = (text || "").match(/^([⌖⤸])\s*(\d+)°·(\d+)°$/);
  return m ? { glyph: m[1], theta: Number(m[2]), phi: Number(m[3]) } : null;
};

/* the tile slider for one axis — "XY plane position along Z" ends with
 * "along <AXIS>". */
const tileSliderOf = (m, axis) =>
  (m.oSliders || []).find((s) => s.n.endsWith("along " + axis.toUpperCase()));

/* the oblique angle sliders by their own names. */
const oblSlider = (m, pre) =>
  (m.oSliders || []).find((s) => s.n.startsWith(pre));

/* ---------- the faces' holders ---------- */
let host = null;
let sdArrival = null;
let sdSettled = null;
let obSettled = null;
let w3 = null;

/* ---------- the receipt ---------- */
const writeReceipt = (verdict) => {
  writeFileSync(
    join(ROOT, "shots-qa/t869-ortho-show-doors.json"),
    JSON.stringify(
      {
        instrument: "scripts/t869-ortho-show-doors.mjs",
        instrumentRevision: REVISION,
        ruler: NAMEOF_LAW,
        build: world.id,
        worldMode: world.mode,
        date: new Date().toISOString(),
        chain:
          "clean room -> canvas -> postprocess card (plain door) -> Results tab (mousedown) -> Enlarge postprocess.mrc -> quick-look -> View-in-3D (text door) -> ortho panel expanded -> the world's ready door (the phase-gated controls block) -> the three Show-at doors' deeds (slice ON + axis chip + plane slider + density profile + the echo, per door) -> the label-freshness walk (step, re-speak, re-click, home) -> the oblique camera dialogue (honest absence, adopt, jump, reset revokes) -> Escape home -> worldBack + seed hygiene (one command)",
        host: host ? { name: host.name, id: host.id, measured: true } : null,
        doors: {
          show: 'click "Show the <plane> at <readout> in 3D" — the label IS the promise, parsed',
          adopt: "the oblique ⤸ adopt door — the camera pulled, the angles adopted",
          jump: "the oblique ⌖ jump door — the camera swings face-on",
          reset: "the reset door — the hand revokes, the chip vanishes",
        },
        faces: {
          showDoors: { live: sdArrival, settled: sdSettled },
          obliqueProv: { live: obSettled },
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
        verdict,
      },
      null,
      2
    )
  );
};

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
  console.error("no completed postprocess in the roster — the Mol* rooms cannot open");
  writeReceipt("no map host — the ride stopped honestly before the show doors");
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
ok(
  "M5 the ortho root is named (Orthogonal slice browser)",
  mo1.orthoRoot === "Orthogonal slice browser"
);
const od = evalJson(orthoDisc);
ok("M6 the disclosure walked open (collapsed -> expanded)", od.clicked === true);
const mo2 = waitFor(
  "the expanded panel (its COMPLETE shape: shows + sliders)",
  (m) => m.shows.length === 3 && m.oSliders.length >= 3,
  20
);
ok(
  "M7 the three show doors are aboard, labels UNIQUE (one promise per plane)",
  mo2.shows.length === 3 && new Set(mo2.shows).size === 3,
  `shows=${JSON.stringify(mo2.shows)}`
);
const parsed = mo2.shows.map(parseShow);
ok(
  "M8 every label PARSES (the door's own grammar: plane + axis + address)",
  parsed.every((p) => p !== null),
  `forms=${JSON.stringify(parsed.map((p) => (p ? p.form : null)))}, axes=${JSON.stringify(parsed.map((p) => (p ? p.axis : null)))}`
);
ok(
  "M9 the three axes are DISTINCT (one door per normal axis)",
  parsed.every((p) => p !== null) && new Set(parsed.map((p) => p.axis)).size === 3
);
const mr = waitFor(
  "the world's ready door (the phase-gated 3D controls block)",
  (m) => m.sliceOn !== null,
  READY_WAIT
);
ok(
  "M10 the world's controls block arrived (the phase gate OPENED — the deeds ride a ready world)",
  mr.sliceOn !== null,
  `sliceOn=${mr.sliceOn} (the controls are phase-gated; the panel's arrival is not the world's readiness)`
);

/* ---------- Face SD — the three doors' deeds ---------- */
console.log("Face SD — the show → 3D handoff, door by door, address by address");
const deed = async (i, tag) => {
  const label = mo2.shows[i];
  const d = parseShow(label);
  const cl = evalJson(showDoor(i));
  ok(
    `${tag}a the door clicked and the cross-section turned ON at its axis`,
    cl.clicked === true,
    `label="${label.slice(0, 52)}"`
  );
  let mw = waitFor(
    `${tag} the axis chip`,
    (m) => m.sliceOn === "true" && m.chips.some((c) => c.p && c.a === d.axis.toUpperCase()),
    12
  );
  if (!(mw.sliceOn === "true" && mw.chips.some((c) => c.p && c.a === d.axis.toUpperCase()))) {
    /* the t867 S13 shape: the world's schedule, not the ride's — one
     * bounded re-click (the door re-sends the address; the pump
     * coalesces), then the bounded wait again. */
    console.log(`    (${tag}: the chip did not arrive — the door re-speaks, bounded)`);
    evalJson(showDoor(i));
    mw = waitFor(
      `${tag} the axis chip (re-click)`,
      (m) => m.sliceOn === "true" && m.chips.some((c) => c.p && c.a === d.axis.toUpperCase()),
      20
    );
  }
  const chip = mw.chips.find((c) => c.p);
  ok(
    `${tag}b the axis chip speaks the door's axis`,
    !!chip && chip.a === d.axis.toUpperCase(),
    `pressed=${chip ? chip.a : "none"} want ${d.axis.toUpperCase()}`
  );
  const mp = waitFor(`${tag} the ${d.axis} profile`, (m) => m.profNow !== null, 20);
  const now = mp.sliceNow !== null ? Number(mp.sliceNow) : null;
  ok(
    `${tag}c the plane slider rides the door's address (at the readout's own precision: half a voxel)`,
    now !== null && Math.abs(now - d.pos) <= d.tol,
    `slider=${mp.sliceNow} want ${d.readout} (±${d.tol.toFixed(5)})`
  );
  ok(
    `${tag}d the density profile tracks the plane the slider speaks`,
    mp.profNow !== null && now !== null &&
      Math.abs(Number(mp.profNow) - Math.round(now * 100)) <= 0,
    `profile=${mp.profNow}% vs slider ${(now * 100).toFixed(2)}%`
  );
  const ts = tileSliderOf(mp, d.axis);
  ok(
    `${tag}e the echo returned bit-for-bit: the panel's own ${d.axis.toUpperCase()}-tile slider reads the plane the 3D slider speaks`,
    ts && ts.v !== null && now !== null && Math.abs(Number(ts.v) - now) <= 1e-9,
    `tile=${ts ? ts.v : "absent"} vs slider=${mp.sliceNow}`
  );
  return mp;
};
await deed(0, "D1");
await deed(1, "D2");
await deed(2, "D3");

/* the label-freshness walk: the door's word must re-speak after the plane
 * moves — the label is LIVE, and the deed follows the new word. */
const z0 = parseShow(mo2.shows[0]);
const st1 = evalJson(orthoStep(0));
sleep(1.6);
const mf = evalJson(MEASURE);
const z1 = parseShow(mf.shows[0]);
ok(
  "D4a the step MOVED the plane and the door's label RE-SPOKE the new address (the word is live, never a snapshot)",
  st1.clicked === true && z1 !== null && z0 !== null && z1.readout !== z0.readout,
  `readout ${z0 ? z0.readout : "?"} -> ${z1 ? z1.readout : "?"}`
);
const cl2 = evalJson(showDoor(0));
const mf2 = waitFor("D4 the re-click's plane", (m) => m.sliceNow !== null, 12);
const now2 = mf2.sliceNow !== null ? Number(mf2.sliceNow) : null;
ok(
  "D4b the re-click carried the NEW address into the 3D scene (the deed follows the word, at the readout's own precision)",
  cl2.clicked === true && now2 !== null && z1 !== null && Math.abs(now2 - z1.pos) <= z1.tol,
  `slider=${mf2.sliceNow} want ${z1 ? z1.readout : "?"} (±${z1 ? z1.tol.toFixed(5) : "?"})`
);
evalJson(orthoStep(1));
sleep(1.6);
evalJson(showDoor(0));
sleep(1.6);
sdArrival = waitFor("the arrival state after the walks home", (m) => m.profNow !== null, 16);
const home = parseShow(sdArrival.shows[0]);
ok(
  "D4c the walk home restored the plane (the readout and the 3D address back)",
  home !== null && z0 !== null && home.readout === z0.readout &&
    sdArrival.sliceNow !== null && Math.abs(Number(sdArrival.sliceNow) - z0.pos) <= z0.tol,
  `readout ${home ? home.readout : "?"}, slider=${sdArrival.sliceNow}`
);
sdSettled = settle("the show-doors face (second ride)");
ok(
  "D5 two settled rides bit-identical (the t836 law — the walks left NO residue)",
  JSON.stringify(sdArrival) === JSON.stringify(sdSettled),
  diffKeys(sdArrival, sdSettled).length === 0 ? "bit-for-bit" : `moved: ${diffKeys(sdArrival, sdSettled).join(", ")}`
);
ok(
  "D6 zero unnamed page-wide WITH the deepest stack up (the census's invariant)",
  censusOk(sdSettled),
  `btns=${sdSettled.pageBtns} ctrls=${sdSettled.ctrls}`
);

/* ---------- Face OB — the camera↔plane dialogue ---------- */
console.log("Face OB — the provenance chip: absence, adopt, jump, reset");
const obd = evalJson(obliqueDisc);
ok("P1 the oblique disclosure walked open", obd.clicked === true);
const pob = waitFor("the oblique block", (m) => m.obliqueState === "on" && m.oSliders.length >= 6, 20);
const pobS = settle("the oblique block (the t860 conditions)");
ok(
  "P2 the provenance chip is ABSENT at arrival (honest absence — no gesture yet, the footer must not lie)",
  pobS.provText === null && pobS.obliqueState === "on",
  `chip=${JSON.stringify(pobS.provText)}`
);
const ad = evalJson(obliDoor("adopt the current 3d camera"));
const pa = waitFor("P3 the adopt chip", (m) => m.provText !== null, 12);
const pc = parseProv(pa.provText);
ok(
  "P3 the adopt door spoke the chip (⤸, whole degrees — the camera pulled)",
  ad.clicked === true && pc !== null && pc.glyph === "⤸",
  `chip="${pa.provText}"`
);
const th = oblSlider(pa, "Polar angle");
const ph = oblSlider(pa, "Azimuth angle");
ok(
  "P4 the sliders followed the camera (the chip's angles ARE the sliders')",
  pc !== null && th && th.v !== null && ph && ph.v !== null &&
    Math.abs(Number(th.v) - pc.theta) <= 2.5 && Math.abs(Number(ph.v) - pc.phi) <= 2.5,
  `sliders θ=${th ? th.v : "?"} φ=${ph ? ph.v : "?"} vs chip ${pc ? `${pc.theta}°·${pc.phi}°` : "?"}`
);
const thBefore = th ? th.v : null;
const phBefore = ph ? ph.v : null;
const jm = evalJson(obliDoor("swing the 3d camera"));
sleep(1.5);
const pj = evalJson(MEASURE);
const jc = parseProv(pj.provText);
ok(
  "P5 the jump door RE-ATTRIBUTED without re-cutting (glyph ⤸ -> ⌖, the angles stay)",
  jm.clicked === true && jc !== null && jc.glyph === "⌖" && pc !== null &&
    jc.theta === pc.theta && jc.phi === pc.phi,
  `chip "${pa.provText}" -> "${pj.provText}"`
);
const rs = evalJson(obliReset);
sleep(1.2);
const pr = evalJson(MEASURE);
const thHome = oblSlider(pr, "Polar angle");
const phHome = oblSlider(pr, "Azimuth angle");
ok(
  "P6 the reset door REVOKED the attribution (the chip gone, the sliders home at 0)",
  rs.clicked === true && pr.provText === null &&
    thHome && thHome.v === "0" && phHome && phHome.v === "0",
  `chip=${JSON.stringify(pr.provText)}, θ=${thHome ? thHome.v : "?"} φ=${phHome ? phHome.v : "?"} (adopt rode θ=${thBefore} φ=${phBefore})`
);
obSettled = settle("the oblique face (second ride)");
ok(
  "P7 zero unnamed page-wide WITH the camera dialogue walked (the census's invariant)",
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
  "W2 the ride leaves no session seed (the t157 two-way door's honest none — the t866 lesson rides every page)",
  seedAfter.seed === "" || seedAfter.seed === null,
  `seed=${JSON.stringify(seedAfter.seed)}`
);

/* ---------- the ledger at birth (three faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const faces = [
  ["showDoors", sdSettled],
  ["obliqueProv", obSettled],
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

writeReceipt(
  fail === 0
    ? `the show doors' page holds: the three "Show the <plane> at <readout> in 3D" doors rode live — each door's click turned the cross-section ON at the door's own axis (the chip pressed, the plane slider at the door's parsed address within half a step, the density profile at the door's percent, the echo returned to the tile slider), the label-freshness walk proved the word is live (a voxel step re-spoke the readout and the re-click carried the new address into the scene) and the walk home restored the arrival bit-for-bit, the oblique camera dialogue rode its first live walk (honest absence, ⤸ adopt with the sliders following the camera, ⌖ jump re-attributing without re-cutting, reset revoking), zero unnamed on every face, the world back bit-for-bit (${OPEN} == ${OPEN}) — the ledger aboard from birth (three faces, the shared law) with the instrument's revision signed`
    : `the show doors' page reds in ${fail} place(s) — the birth's honest reds are the curriculum`
);
console.log(`\nreceipt: ${join(ROOT, "shots-qa/t869-ortho-show-doors.json")}`);
console.log(`\nORTHO-SHOW-DOORS t869: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
