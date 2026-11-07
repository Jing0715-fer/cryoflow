#!/usr/bin/env node
// t1136-book-vaccine-unit.mjs — the corruption's own vaccine, the census's
// 74th instrument.
//
// THE LAW (t1135 carried to the READERS): the classification family's
// books carried a malformed _rlnAngleTilt on every row — a float with two
// dots ("90.0.2") — because the stub writer's f-string lost its colon.
// The writer is cured (t1135); the BOOK-HEAL RIDE re-ran the five
// corrupt-book jobs through the product's own run door and the world's
// books speak valid floats again. But a reader that parses LENIENTLY
// spreads the lie: parseFloat("89.97.2") === 89.97 — a partial acceptance
// that lets a corrupt book flow into fresh bytes. THE VACCINE: the book
// doors (symexpand, rebalance, select — the lanes that consume a
// classification/refine data star) refuse the whole book BEFORE the
// corruption spreads, and the refusal names the mechanism AND the way out
// (the t416 law).
//
// This instrument pins, in six bands:
//   A. the PURE classification — the exact verdict the doors refuse on
//      (one classification shared by the dispatch path and the bench,
//      the t535 star-shape recipe);
//   B. the refusal word — the mechanism, the way out, the law's name;
//   C. the three door sites — symexpand, rebalance, and THIS WINDOW'S
//      select wiring, each calling the ONE classification and returning
//      the ONE refusal word;
//   D. the strict grammar's deliberate breadth (e-notation and the plus
//      sign are not the books' dialect);
//   E. the live world's books — the ride's per-leg witness, standing
//      guard: every _rlnAngleTilt cell in all five workdirs speaks a
//      valid float (a future regression re-infecting the books goes RED
//      here, on sight);
//   F. the world's shape — the ride minted nothing, the DB's young floor
//      held, and select's book keeps its 96-row promise.

import { readFileSync, readdirSync, statSync } from "fs";
import { corruptAngleCell, angleVaccineRefusal, STRICT_FLOAT_RE } from "@/lib/relion/angle-vaccine";

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? "ok" : "FAIL"}: ${label}`);
};

const REPO = "/home/z/my-project";
const PROJ = "cmvbjl6060000srlis2ai5mb3";
const CLUSTER = `${REPO}/services/mock-cluster/fs/projects/cryoflow/${PROJ}`;

console.log("== A. the PURE classification (the verdict the doors refuse on) ==");
{
  const cols = [{ label: "_rlnAngleRot", col: 1 }, { label: "_rlnAngleTilt", col: 2 }];
  const bad = corruptAngleCell(["row", "12.5", "89.97.2"], cols);
  ok(bad != null && bad.label === "_rlnAngleTilt" && bad.value === "89.97.2", "the two-dot shape is refused, under its own label");
  const bad2 = corruptAngleCell(["row", "12.5", "90.0.2"], cols);
  ok(bad2 != null && bad2.value === "90.0.2", "the t1135 signature verbatim (90.0.2) is refused");
  ok(corruptAngleCell(["row", "12.5", "89.97"], cols) === null, "a strict decimal passes");
  ok(corruptAngleCell(["row", "-12.5", "0"], cols) === null, "signed and integer cells pass");
  ok(corruptAngleCell(["row", "abc", "89.97"], cols) === null, "a NaN cell is not the vaccine's business (the skip path)");
  ok(corruptAngleCell(["row", "", "-"], cols) === null, "empty and sign-only cells take the skip path");
  ok(corruptAngleCell(["row", "12.5"], cols) === null, "a row shorter than the column is not the vaccine's business");
  const badRot = corruptAngleCell(["row", "1.2.3", "89.97"], cols);
  ok(badRot != null && badRot.label === "_rlnAngleRot", "a corrupt rot cell is reported under its own label");
  const cols3 = [...cols, { label: "_rlnAnglePsi", col: 3 }];
  const badPsi = corruptAngleCell(["row", "12.5", "89.97", "-0.5.5"], cols3);
  ok(badPsi != null && badPsi.label === "_rlnAnglePsi" && badPsi.value === "-0.5.5", "a corrupt psi cell is reported under its own label");
  const badFirst = corruptAngleCell(["row", "1.2.3", "89.97.2"], cols);
  ok(badFirst != null && badFirst.label === "_rlnAngleRot", "the first corrupt column wins the report");
}

console.log("== B. the refusal word (the mechanism AND the way out, t416) ==");
{
  const w = angleVaccineRefusal({ label: "_rlnAngleTilt", value: "89.97.2" }, "particle selection", "/x/run_data.star", 7);
  ok(w.includes("_rlnAngleTilt") && w.includes("line 7") && w.includes('"89.97.2"'), "the word names the label, the line, the value");
  ok(w.includes("lenient reader silently truncates") && w.includes("strict reader refuses the whole book"), "the word names the mechanism (the lenient lie vs the strict refusal)");
  ok(w.includes("Re-run the producing job") && w.includes("wire a clean data star"), "the word names the way out (both doors of it)");
  ok(w.includes("particle selection"), "the word wears the door's own name");
  ok(w.includes("t1135"), "the word names the law");
  const w2 = angleVaccineRefusal({ label: "_rlnAngleRot", value: "1.2.3" }, "symmetry expansion", "/y/in.star", 1);
  ok(w2.includes("symmetry expansion") && w2.includes("_rlnAngleRot"), "the same mouth speaks for every door (parameterized, not copy-pasted)");
}

console.log("== C. the three door sites (one classification, one mouth) ==");
{
  const engine = readFileSync(`${REPO}/src/lib/relion/engine.ts`, "utf8");
  ok(engine.includes('import { angleVaccineRefusal, corruptAngleCell } from "./angle-vaccine"'), "the engine imports the ONE classification");
  const symSite = engine.slice(engine.indexOf("async function runSymexpandNative"), engine.indexOf("async function runRebalanceNative"));
  ok(symSite.includes("corruptAngleCell(parts, [") && symSite.includes('"_rlnAngleRot"') && symSite.includes('"_rlnAngleTilt"') && symSite.includes('"_rlnAnglePsi"'), "the symexpand door checks rot/tilt/psi");
  ok(symSite.includes('angleVaccineRefusal(bad, "symmetry expansion", inStar'), "the symexpand door returns the refusal word");
  const rebSite = engine.slice(engine.indexOf("async function runRebalanceNative"), engine.indexOf("function outPath(ctx: BuildCtx"));
  ok(rebSite.includes("corruptAngleCell(parts, [") && rebSite.includes('"_rlnAngleRot"') && rebSite.includes('"_rlnAngleTilt"'), "the rebalance door checks rot/tilt");
  ok(rebSite.includes('angleVaccineRefusal(bad, "rebalancing", inStar'), "the rebalance door returns the refusal word");
  const selSite = engine.slice(engine.indexOf("async function runSelectNative"), engine.indexOf("async function runSelect2dNative"));
  ok(selSite.includes("corruptAngleCell(parts, [") && selSite.includes('"_rlnAngleRot"') && selSite.includes('"_rlnAngleTilt"') && selSite.includes('"_rlnAnglePsi"'), "the select door checks rot/tilt/psi (this window's wiring — the pass-through refuses before it copies)");
  ok(selSite.includes('angleVaccineRefusal(bad, "particle selection", inStar'), "the select door returns the refusal word");
  const s2dSite = engine.slice(engine.indexOf("async function runSelect2dNative"), engine.indexOf("async function runSymexpandNative") > 0 ? engine.indexOf("async function runSymexpandNative") : engine.length);
  ok(s2dSite.includes("corruptAngleCell(parts, [") && s2dSite.includes('"_rlnAngleTilt"') && s2dSite.includes('angleVaccineRefusal(bad, "2D class selection", inStar'), "the select2d door checks and refuses (the fourth pass-through, found by the ride's own live refusal)");
  ok(engine.split("corruptAngleCell(").length - 1 === 4, "exactly four call sites (four pass-through doors) share the classification");
}

console.log("== D. the grammar's deliberate breadth (the t1135 instrument's own shape) ==");
{
  ok(!STRICT_FLOAT_RE.test("1e5") && Number.isFinite(parseFloat("1e5")), "e-notation is parseFloat-finite but not the books' dialect — refused");
  ok(!STRICT_FLOAT_RE.test("+1.5") && Number.isFinite(parseFloat("+1.5")), "the plus sign is not the grammar's dialect — refused");
  ok(!STRICT_FLOAT_RE.test("90.") && Number.isFinite(parseFloat("90.")), "a naked trailing dot is refused");
  ok(STRICT_FLOAT_RE.test("-0.5") && STRICT_FLOAT_RE.test("90") && STRICT_FLOAT_RE.test("0.00"), "the grammar's own family passes");
}

console.log("== E. the live world's books (the ride's witness, standing guard) ==");
{
  const STRICT = /^-?\d+(\.\d+)?$/;
  const LEGS = [
    ["class2d", `${CLUSTER}/class2d_46lkfgpq`, 19392],
    ["select2d (app-side)", `${REPO}/data/relion/${PROJ}/select2d_64qkashd`, 96],
    ["select (app-side, the living book)", `${REPO}/data/relion/${PROJ}/select_nlu3ijj8`, 96],
    ["initialmodel", `${CLUSTER}/initialmodel_s0bx0t07`, 19296],
    ["class3d", `${CLUSTER}/class3d_g7jbyk63`, 2592],
    ["refine3d", `${CLUSTER}/refine3d_xxe3896f`, 73736],
  ];
  for (const [name, dir, wantCells] of LEGS) {
    let cells = 0, corrupt = 0;
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== ".cryoflow_prev") walk(p); continue; }
        if (!e.name.endsWith(".star")) continue;
        const lines = readFileSync(p, "utf8").split("\n");
        let tiltCol = -1, inLoop = false;
        for (const line of lines) {
          if (line.startsWith("data_")) { tiltCol = -1; inLoop = false; continue; }
          if (line.startsWith("loop_")) { inLoop = true; continue; }
          if (inLoop && line.startsWith("_rlnAngleTilt")) { tiltCol = parseInt(line.split("#")[1]?.trim() || "0", 10) - 1; continue; }
          if (inLoop && line.startsWith("_rln")) continue;
          if (inLoop && tiltCol >= 0 && line.trim() && !line.startsWith("#")) {
            const c = line.trim().split(/\s+/);
            if (c.length <= tiltCol) continue;
            cells++;
            if (!STRICT.test(c[tiltCol])) corrupt++;
          }
        }
      }
    };
    walk(dir);
    ok(corrupt === 0 && cells === wantCells, `${name}: ${corrupt}/${cells} corrupt (the book speaks valid floats, ${wantCells}-cell promise intact)`);
  }
}

console.log("== F. the world's shape (the ride minted nothing) ==");
{
  const db = statSync(`${REPO}/db/cryoflow.db`);
  ok(db.size === 135168, `the DB file at the young floor (${db.size} bytes)`);
  const selBook = readFileSync(`${CLUSTER}/select_nlu3ijj8/particles_select.star`, "utf8");
  const rows = selBook.split(/\r?\n/).filter((l) => l.includes("@") && l.includes(".mrcs"));
  ok(rows.length === 96, `select's book keeps its 96-row promise (${rows.length} rows)`);
  const c2dBook = readFileSync(`${CLUSTER}/class2d_46lkfgpq/run_data.star`, "utf8");
  const c2dRows = c2dBook.split(/\r?\n/).filter((l) => l.includes("@") && l.includes(".mrcs"));
  ok(c2dRows.length === 96, `class2d's book keeps its 96-row promise (${c2dRows.length} rows)`);
}

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
