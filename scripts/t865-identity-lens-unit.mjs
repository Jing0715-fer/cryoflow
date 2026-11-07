#!/usr/bin/env node
/**
 * t865 — the IDENTITY-VS-LENS unit (the fleet's witness for the shared
 * helper's vocabulary growth): the ledger's honest `identical: false`
 * faces used to speak TWO words at once ("something changed") where one
 * word was meant — the measure's own LENS growing (a name string richer
 * after the ruler's growth) is a different event from the WORLD's
 * content moving (a button born, an image arrived). One event, one word.
 *
 * The one implementation lives in scripts/drift-ledger.mjs (the t861
 * law: a law that lives in one place grows in one place):
 *   ledgerFace(prev, live, scalarOf) -> { ..., moved: { lens, world } }
 *     lens  = moved fields whose values are strings / string-arrays
 *             (the name computation's own outputs — unWho and friends)
 *     world = moved fields whose values are numbers / booleans / null
 *             (the page's content — pageBtns, imgs, hasDlg)
 * and armVerdict's arm-2′ detail NAMES the moved fields when they exist,
 * so a dev-key ride's receipt says what moved, not merely that it did.
 *
 * This unit pins the vocabulary's CONTRACT on known pairs (offline,
 * deterministic) and then reads the family's LIVE receipts: every face
 * the helper has cut since the growth carries `moved`, and any face
 * whose identical is false must name its moved fields non-empty (the
 * flag's false and the lists agree — a false with both lists empty is a
 * lie the vocabulary exists to kill).
 */
import { ledgerFace, armVerdict } from "./drift-ledger.mjs";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
let pass = 0;
let fail = 0;
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
};

console.log("V — the vocabulary's contract on known pairs");
const scalar = (m) => m.pageBtns;

const lensOnly = ledgerFace(
  { pageBtns: 153, unWho: ["a-name"] },
  { pageBtns: 153, unWho: ["a-name", "b-name"] },
  scalar
);
ok("V1 lens-only move: identical false, drift 0, moved.lens = [unWho], moved.world empty",
  lensOnly.identical === false && lensOnly.drift === 0 &&
  lensOnly.moved.lens.length === 1 && lensOnly.moved.lens[0] === "unWho" &&
  lensOnly.moved.world.length === 0,
  "the ruler grew richer — the world never moved");

const worldMove = ledgerFace(
  { pageBtns: 153, imgs: 9, hasDlg: false },
  { pageBtns: 154, imgs: 10, hasDlg: true },
  scalar
);
ok("V2 world move: every numeric/boolean field named in moved.world, lens empty",
  worldMove.identical === false &&
  worldMove.moved.world.join(",") === "hasDlg,imgs,pageBtns" &&
  worldMove.moved.lens.length === 0,
  "the page's content moved — the vocabulary says which fields");

const mixed = ledgerFace(
  { pageBtns: 153, unWho: ["x"], ctrls: 2 },
  { pageBtns: 154, unWho: ["y"], ctrls: 2 },
  scalar
);
ok("V3 mixed move: both lists named — the flag's false speaks one word PER FIELD",
  mixed.identical === false &&
  mixed.moved.lens.join(",") === "unWho" &&
  mixed.moved.world.join(",") === "pageBtns");

const settled = ledgerFace({ pageBtns: 153, unWho: [] }, { pageBtns: 153, unWho: [] }, scalar);
ok("V4 settled face: identical true, BOTH lists empty (the empty vocabulary)",
  settled.identical === true && settled.moved.lens.length === 0 && settled.moved.world.length === 0);

const born = ledgerFace({ pageBtns: 1 }, { pageBtns: 1, imgPending: 0 }, scalar);
ok("V5 field born between rides: a numeric arrival is a WORLD move (a measure grew — recorded)",
  born.identical === false && born.moved.world.join(",") === "imgPending" && born.moved.lens.length === 0);

const gone = ledgerFace({ pageBtns: 1, stale: "old" }, { pageBtns: 1 }, scalar);
ok("V6 field retired between rides: a string's departure is a LENS move (the lens pruned)",
  gone.identical === false && gone.moved.lens.join(",") === "stale" && gone.moved.world.length === 0);

console.log("A — the arm-2′ detail speaks the moved fields");
const world = { mode: "dev", id: "dev@test" };
const cmpSame = { prevFound: true, sameBuild: true, prevBuild: "dev@test" };
const aLens = armVerdict(cmpSame, world, lensOnly);
ok("A1 arm 2′ names a lens move: 'lens [unWho]' aboard the detail",
  aLens.detail.includes("lens [unWho]"), aLens.detail.slice(0, 90));
const aWorld = armVerdict(cmpSame, world, worldMove);
ok("A2 arm 2′ names a world move: 'world [hasDlg, imgs, pageBtns]' aboard the detail",
  aWorld.detail.includes("world [hasDlg, imgs, pageBtns]"), aWorld.detail.slice(0, 90));
const aStill = armVerdict(cmpSame, world, settled);
ok("A3 arm 2′ on a settled face: no moved-fields clause (silence IS the settled word)",
  !aStill.detail.includes("moved fields"));

console.log("L — the family's live receipts carry the vocabulary");
const RECEIPTS = [
  "shots-qa/t865-results-a11y.json",
];
let checked = 0;
for (const rel of RECEIPTS) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) continue;
  const r = JSON.parse(readFileSync(p, "utf8"));
  const faces = r?.driftLedger?.faces ?? {};
  const names = Object.keys(faces);
  for (const n of names) {
    const f = faces[n];
    ok(`L ${rel} :: ${n} — moved lists agree with the identical flag`,
      f.moved
        ? (f.identical === true
            ? f.moved.lens.length === 0 && f.moved.world.length === 0
            : f.moved.lens.length + f.moved.world.length > 0)
        : false,
      f.identical === true ? "identical, both lists empty" : `identical false — lens [${(f.moved?.lens ?? []).join(", ")}] world [${(f.moved?.world ?? []).join(", ")}]`);
    checked++;
  }
}
ok("L0 at least one live receipt read (the vocabulary is on real rides, not just the contract)",
  checked >= 1, `${checked} faces checked across the family's receipts`);

console.log(`\nIDENTITY-LENS-UNIT t865: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
