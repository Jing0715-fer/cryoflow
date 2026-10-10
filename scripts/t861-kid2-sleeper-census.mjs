#!/usr/bin/env node
/**
 * t861 — the kid[2] sleeper's census (the t856 tail's carried candidate,
 * third window running): the mid row's THIRD kid — the "Workflow
 * statistics" counters group (waiting / running / completed, three
 * StatChips) — is 0 at EVERY width the family has ever walked
 * (375 → 1920). The census asks the carried question: dead code, or a
 * breakpoint nobody reached?
 *
 * The source's own claim (header.tsx, the t510 tier comment): the
 * counters ride `min-[2000px]:flex` — the row's natural width with all
 * four controls ~1311px, "which exists from ~2000 up"; below 2000 the
 * footer census speaks the same three numbers, the counters are the
 * most redundant chrome, they wait longest. Measure-first, as always:
 *
 *   S1  the SLEEP confirmed — kid[2].w === 0 at every family width
 *       (375/640/768/1024/1280/1536/1920); below 1280 the ROW itself
 *       sleeps (the twin-at-rest form — vacuous, but recorded)
 *   S2  the WAKE WALK — 1px steps 1994→2006, two rides per step (the
 *       t836 law before any pin): last asleep / first awake, expected a
 *       POINT (the chip's 1535/1536 mirror, t856)
 *   S3  the STEP ANATOMY — at the wake: kid[2] born at its natural
 *       width (three StatChips + two gap-2 seams), the row's OTHER
 *       awake kids unmoved ([0] workspace label, [1] PS wrapper, [3]
 *       lens chip 90.3), the right cluster (628.3) and seats (12)
 *       constant, the left row growing by the birth
 *   S4  the PLATEAU — 2000→2100: the counters born full-size and
 *       constant (the chip's own law: born at width, never grows), the
 *       only moving part the left row's free growth
 *   S5  the VERDICT — not dead code: a breakpoint nobody reached. The
 *       battery's farthest walk (1920) sits ~80px short of the wake;
 *       the census extends the family's far horizon to 2100 and pins
 *       the wake as the twelfth... the T510 tier's own number, measured.
 *   L   THE DRIFT LEDGER AT BIRTH (t861's own propagation lesson applied
 *       to the newest instrument): three faces (sleep-1920 / wake-2000 /
 *       plateau-2100) diffed against the PREVIOUS receipt via the
 *       family's shared law (scripts/drift-ledger.mjs) — first ride arm
 *       1 (vacuous), every later ride arm 2′/arm 3 per the jurisdiction.
 *
 * Receipt: shots-qa/t861-kid2-sleeper-census.json.
 *
 *   node scripts/t861-kid2-sleeper-census.mjs
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";

const ROOT = process.cwd();

let pass = 0;
let fail = 0;
const results = [];
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
  results.push({ label, pass: !!cond });
};

const ab = (args) =>
  execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });

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

/* ---------- provenance + the ledger's comparator ---------- */
const world = worldIdentity(ROOT); // t859 — the world key
const buildId = world.id;
console.log(
  `t861 kid[2] sleeper census — world ${world.mode}:${buildId}, the counters' 2000px tier measured-first\n`
);
const cmp = loadComparator(ROOT, "shots-qa/t861-kid2-sleeper-census.json", buildId);
console.log(
  cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${cmp.prev.date} (world ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "world MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n"
);

/* ---------- the walk: the t834 BAND walk + the kid[2] focus (one line,
 * sync IIFE — the t834 lesson; String(className) before slice — the
 * t838 SVG lesson) ---------- */
const WALK =
  "(() => { const hdr = document.querySelector('header'); if (!hdr || hdr.children.length < 2) return JSON.stringify({ error: 'no header' }); const kid = (c) => Math.round(c.getBoundingClientRect().width * 10) / 10; const left = hdr.children[0]; const right = hdr.children[1]; const mid = left.children[3]; if (!mid || mid.getBoundingClientRect().width <= 0) return JSON.stringify({ row: false, innerW: window.innerWidth }); const midKids = [...mid.children].map((c) => ({ lbl: c.getAttribute('aria-label') || String(c.className).slice(0, 30), w: kid(c) })); const k2 = midKids[2] || null; const seats = [...right.children].filter((c) => c.getBoundingClientRect().width > 0).length; return JSON.stringify({ row: true, innerW: window.innerWidth, leftW: kid(left), rightW: kid(right), seats, midW: kid(mid), midKids, k2, k0: midKids[0] || null, k1: midKids[1] || null, k3: midKids[3] || null }); })()";

const ride = (w) => {
  ab(`set viewport ${w} 800`);
  ab("wait 350");
  return evalJson(WALK);
};

/* own your world (the t849 lesson): open the page before walking */
ab("open http://localhost:3000/");
ab("set viewport 1280 800");
ab("wait 500");

/* ---------- S1: the sleep, confirmed at every family width ---------- */
console.log("\nS1 — the sleep: kid[2] is 0 at every width the family walks");
const FAMILY = [375, 640, 768, 1024, 1280, 1536, 1920];
const sleepRows = {};
for (const w of FAMILY) {
  const m = ride(w);
  if (m.error) {
    ok(false, `S1 ${w}: ${m.error}`);
    continue;
  }
  sleepRows[String(w)] = m;
  if (m.row === false) {
    ok(m.row === false && w < 1280, `S1 ${w}: the mid row itself asleep (the twin-at-rest form)`);
  } else {
    ok(m.k2 && m.k2.w === 0, `S1 ${w}: kid[2] "${m.k2 ? m.k2.lbl.slice(0, 30) : "?"}" asleep (w=0) — the total sleeper holds`);
  }
}
ok(
  sleepRows["1920"] && sleepRows["1920"].row === true && sleepRows["1920"].k2.w === 0,
  `S1 1920: the family's FARTHEST walk still films the sleeper — the horizon's own edge (row ${sleepRows["1920"] ? sleepRows["1920"].midW : "?"} wide, awake since xl)`
);

/* ---------- S2: the wake walk — 1px steps, two rides each ---------- */
console.log("\nS2 — the wake walk (1994 → 2006, 1px steps, the t836 law per step)");
const STEP_W = [];
for (let w = 1994; w <= 2006; w++) STEP_W.push(w);
const stepRows = {};
let lastAsleep = null;
let firstAwake = null;
for (const w of STEP_W) {
  const m1 = ride(w);
  const m2 = ride(w);
  const bit = JSON.stringify(m1) === JSON.stringify(m2);
  if (m1.error || m2.error) {
    ok(false, `S2 ${w}: ${m1.error || m2.error}`);
    continue;
  }
  ok(bit, `S2 ${w}: two rides bit-identical (the t836 law)`);
  stepRows[String(w)] = m1;
  const awake = m1.row === true && m1.k2 && m1.k2.w > 0;
  if (!awake) lastAsleep = w;
  else if (firstAwake === null) firstAwake = w;
}
ok(
  lastAsleep === 1999 && firstAwake === 2000,
  `S2 the wake is a POINT: last asleep ${lastAsleep}, first awake ${firstAwake} — 1px, the chip's 1535/1536 mirror (t856's form, at the T510 tier's own number)`
);
ok(
  stepRows["2000"] && stepRows["2000"].k2 && stepRows["2000"].k2.lbl === "Workflow statistics",
  `S2 the waker is the named group: "${stepRows["2000"] ? stepRows["2000"].k2.lbl : "?"}" (aria-label, the counters' own name)`
);

/* ---------- S3: the step anatomy — who pays at the wake ---------- */
console.log("\nS3 — the step anatomy: the birth's ledger (who pays, who never moves)");
const pre = stepRows["1999"];
const post = stepRows["2000"];
ok(
  pre && post && pre.row === true && post.row === true,
  "S3 the pre/post pair rides filmed (1999 asleep / 2000 awake)"
);
const k2Born = post.k2.w;
ok(
  post.k0.w === pre.k0.w && post.k1.w === pre.k1.w && post.k3.w === pre.k3.w,
  `S3 the row's other kids NEVER move at the wake: workspace ${pre.k0.w} → ${post.k0.w}, PS wrapper ${pre.k1.w} → ${post.k1.w}, lens chip ${pre.k3.w} → ${post.k3.w} — the birth charges no sibling`
);
ok(
  post.rightW === pre.rightW && post.seats === pre.seats && post.rightW === 628.3 && post.seats === 12,
  `S3 the right cluster never moves (the family's standing law): ${pre.rightW} → ${post.rightW}, seats ${pre.seats} → ${post.seats}`
);
/* the birth's cost, measured-first (the first ride's own correction: the
 * group joins the row's flex, so it brings TWO widths — its own natural
 * size AND one new gap-2 ROW seam; the first cut priced only the group
 * and the row refused to lie): 332.7 + 8 = 340.7. */
ok(
  Math.round((post.leftW - pre.leftW) * 10) / 10 === Math.round((k2Born + 8) * 10) / 10,
  `S3 the left row grows by EXACTLY the birth + its seam: ${pre.leftW} → ${post.leftW} (+${Math.round((post.leftW - pre.leftW) * 10) / 10}) == kid[2] ${k2Born} + one new gap-2 row seam 8 — the group's natural size charged to free space, plus the flex item's own arrival (the row's min-w-0 never binds here)`
);
ok(
  Math.round((post.midW - pre.midW) * 10) / 10 === Math.round((k2Born + 8) * 10) / 10,
  `S3 the row's own anatomy: mid ${pre.midW} → ${post.midW} (+${Math.round((post.midW - pre.midW) * 10) / 10}) — the birth's whole cost = three StatChips + their two INTERNAL gap-2 seams (inside the group's ${k2Born}) + ONE new row-level gap-2 seam (the group joining the row's flex) — the t510 comment's "natural width" measured at last, seam and all`
);

/* ---------- S4: the plateau — born full-size, never grows ---------- */
console.log("\nS4 — the plateau above the wake (2000 → 2100)");
const PLATEAU_W = [2010, 2048, 2100];
const plateauRows = {};
for (const w of PLATEAU_W) {
  const m = ride(w);
  if (m.error) {
    ok(false, `S4 ${w}: ${m.error}`);
    continue;
  }
  plateauRows[String(w)] = m;
}
ok(
  PLATEAU_W.every((w) => plateauRows[String(w)] && plateauRows[String(w)].k2.w === k2Born) &&
    plateauRows["2100"].rightW === 628.3 && plateauRows["2100"].seats === 12,
  `S4 the counters are CONSTANT ${k2Born} above the wake (born full-size, the chip's own law — never grows), the right cluster 628.3 / seats 12 to 2100`
);
ok(
  plateauRows["2100"].k0.w === post.k0.w && plateauRows["2100"].k1.w === post.k1.w && plateauRows["2100"].k3.w === post.k3.w,
  `S4 the row's other kids hold the wake's form to 2100 (${post.k0.w} / ${post.k1.w} / ${post.k3.w}) — the wake's step is the LAST anatomy event on the row`
);

/* ---------- S5: the verdict + restore ---------- */
console.log("\nS5 — the verdict");
ok(
  firstAwake === 2000 && lastAsleep === 1999,
  `S5 THE CENSUS'S ANSWER: not dead code — a BREAKPOINT NOBODY REACHED. The counters' tier is min-[2000px] (the t510 comment's own number, now measured): the seat has been alive the whole time, waiting 80px past the battery's farthest walk (1920, the t852 far edge). The family's far horizon extends to 2100; the wake joins the wake-family (the chip's 1535/1536 POINT, the below squeeze's [768, 770] zone) as the third measured birth in the header's anatomy`
);
ab("open http://localhost:3000/");
ab("set viewport 1280 800");
/* the hydration lesson (t846's fresh-load law): the first ride filmed
 * "no header" at 400ms — the page had not mounted; measure, and on
 * error wait and re-measure, bounded (the settle spirit at the boot
 * door). */
let restore = evalJson(WALK);
for (let i = 0; i < 6 && (restore.error || restore.row === false); i++) {
  ab("wait 800");
  restore = evalJson(WALK);
}
ok(
  restore.row === true && restore.k2 && restore.k2.w === 0 && restore.rightW === 628.3,
  "S5 the world restored: back at 1280, the sleeper asleep, the family's numbers holding"
);

/* ---------- L: the drift ledger at birth (t861's own lesson) ---------- */
console.log("\nL — the drift ledger (at birth: the newest instrument rides the family's law)");
const ledgerFaces = {
  sleep1920: ledgerFace(cmp.prev && cmp.prev.sleep && cmp.prev.sleep.rows ? cmp.prev.sleep.rows["1920"] : null, sleepRows["1920"], (m) => (m && m.row ? m.leftW : null)),
  wake2000: ledgerFace(cmp.prev && cmp.prev.wake && cmp.prev.wake.rows ? cmp.prev.wake.rows["2000"] : null, post, (m) => (m && m.row ? m.leftW : null)),
  plateau2100: ledgerFace(cmp.prev && cmp.prev.plateau && cmp.prev.plateau.rows ? cmp.prev.plateau.rows["2100"] : null, plateauRows["2100"], (m) => (m && m.row ? m.leftW : null)),
};
ok(
  Object.keys(ledgerFaces).length === 3 &&
    Object.values(ledgerFaces).every((f) => "prev" in f && "live" in f && "drift" in f && "identical" in f) &&
    (cmp.prevFound ? typeof cmp.prev.date === "string" && typeof cmp.prevBuild === "string" : cmp.prevFound === false),
  `L1 the drift ledger is aboard at BIRTH: three faces, the comparator's provenance recorded — ${cmp.prevFound ? `comparator ${cmp.prev.date} (world ${cmp.prevBuild})` : "first ride — no predecessor (arm 1)"}`
);
for (const [name, f] of Object.entries(ledgerFaces)) {
  const v = armVerdict(cmp, world, f);
  ok(v.ok, `L face ${name} ride-drift law — ${v.detail}`);
}

/* ---------- the receipt ---------- */
const receipt = {
  instrument: "scripts/t861-kid2-sleeper-census.mjs",
  build: buildId,
  worldMode: world.mode,
  date: new Date().toISOString(),
  question: "the mid row's kid[2] — 'Workflow statistics' — is 0 at every width the family walked (375→1920): dead code, or a breakpoint nobody reached?",
  answer: "NOT dead code — a breakpoint nobody reached: the counters ride min-[2000px]:flex (the t510 tier comment's own number), the wake is a 1px POINT at 2000 (last asleep 1999, first awake 2000), 80px past the battery's farthest walk. The seat was alive the whole time.",
  law: "the wake anatomy: the birth charges NO sibling (the row's other kids and the right cluster bit-identical across the wake) — the left row grows by EXACTLY the counters' natural width (charged to free space, the row's min-w-0 never binds); the counters are born full-size and CONSTANT above the wake (the chip's own law); the wake joins the header's measured births (the chip's 1535/1536 POINT, the below squeeze's [768, 770] zone) as the third",
  sleep: { widths: FAMILY, rows: sleepRows },
  wake: { widths: STEP_W, rows: stepRows, lastAsleep, firstAwake },
  plateau: { widths: PLATEAU_W, rows: plateauRows, born: k2Born },
  restore,
  driftLedger: {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevFound ? cmp.prevBuild : null,
    prevDate: cmp.prevFound ? cmp.prev.date : null,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces: ledgerFaces,
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
};
const out = join(ROOT, "shots-qa/t861-kid2-sleeper-census.json");
writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
console.log(`\nreceipt: ${out}`);
console.log(`\nKID2-CENSUS t861: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
