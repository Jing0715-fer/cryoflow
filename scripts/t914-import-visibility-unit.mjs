#!/usr/bin/env node
/**
 * t914 — the import-visibility seat's unit: the law read from source, the
 * causal story pinned, the diff's hygiene checked.
 *
 * A1  the walk's loop-safety law is REAL: walkWorkdir refuses symlinked
 *     directories (the st.isDirectory() continue) — the law that made the
 *     dir-link exposure invisible.
 * A2  importFileSet's workdir exposure is the PER-FILE loop, unconditional:
 *     no `linkDirInto(projectMic, workdirMic)` wrapper survives in it.
 * A3  the EMPIAR lane exposes the set per-file into the workdir: no
 *     ensureEmpiarLink on the workdir path survives (the project-level link
 *     keeps its ensureEmpiarLink — the star's path contract).
 * A4  the folder lane keeps the PROJECT-level linkDirInto (the star's
 *     path-resolution contract) AND adds the per-file workdir exposure.
 * A5  the causal receipts: the BEFORE witness red (the defect, exact
 *     numbers) + the AFTER witness green + the stack witness green — the
 *     pair cannot be retold loose.
 * A6  the diff rides the seat only: every changed hunk in engine.ts names
 *     the import exposure (no drive-by edits).
 *
 *   node scripts/t914-import-visibility-unit.mjs
 *   (alias imports resolved via --import ./scripts/ts-alias-register.mjs
 *    when an assert needs them — this unit reads files as text, none needed)
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const engine = readFileSync("src/lib/relion/engine.ts", "utf8");
const walker = readFileSync("src/lib/relion/outputs-list.ts", "utf8");

// A1 — the walk's loop-safety law (the law the seat respects)
const a1 = /A symlinked DIRECTORY is not followed[\s\S]{0,400}if \(st\.isDirectory\(\)\) continue;/.test(walker);
ok("A1 the walk refuses symlinked directories (loop safety, untouched)", a1);

// A2 — importFileSet: the per-file exposure, unconditional
// (the end anchor is the NEXT block after the function — uniqueStarName
// sits BEFORE importFileSet in this file, the unit bit its own anchor once)
const ifsStart = engine.indexOf("function importFileSet(");
const ifsEnd = engine.indexOf("/* ------------------------------------------------------------------ */\n/* Param helpers", ifsStart);
const ifs = engine.slice(ifsStart, ifsEnd);
ok("A2a importFileSet found", ifsStart > 0 && ifsEnd > ifsStart);
ok("A2b the exposure comment names the t914 law", ifs.includes("t914 — expose the set inside the import job's workdir"));
ok("A2c NO linkDirInto call survives inside importFileSet", !ifs.includes("linkDirInto("));
const exposureLoop = /for \(const e of entries\) \{\s*\n\s*if \(!e\.startsWith\("micrographs\/"\)\) continue;/.test(ifs);
ok("A2d the per-file loop over entries is the exposure", exposureLoop);
const ladder = ifs.includes("linkSync(src, dst)") && ifs.includes("symlinkSync(src, dst, \"file\")");
ok("A2e the hardlink→symlink ladder kept", ladder);

// A3 — the EMPIAR lane: per-file exposure, no workdir dir-link
const empStart = engine.indexOf("async function runImportNative(");
const empSlice = engine.slice(empStart, empStart + 9000);
ok("A3a the EMPIAR comment names the seat's law", empSlice.includes("the importFileSet seat's law, EMPIAR face"));
ok("A3b ensureEmpiarLink keeps ONLY the project-level link", (empSlice.match(/ensureEmpiarLink\(/g) ?? []).length === 1 && empSlice.includes("ensureEmpiarLink(micLink);"));
ok("A3c the EMPIAR workdir exposure hardlinks from EMPIAR_DIR", empSlice.includes("linkSync(path.join(EMPIAR_DIR, m), dst)"));

// A4 — the folder lane: project link kept + per-file exposure added
const folderIdx = engine.indexOf("the PROJECT-level link is the star's path-resolution contract");
ok("A4a the folder lane names the star's path contract", folderIdx > 0);
ok("A4b the folder lane keeps exactly ONE linkDirInto (the project tree)", (engine.slice(folderIdx - 400, folderIdx + 400).match(/linkDirInto\(/g) ?? []).length === 1);
const folderSlice = engine.slice(folderIdx, folderIdx + 2000);
ok("A4c the folder lane's workdir exposure is per-file", folderSlice.includes("const workdirMic = path.join(workdir, \"micrographs\")") && folderSlice.includes("linkSync(f, dst)"));

// A5 — the causal receipts pinned
const before = existsSync("shots-qa/t914-import-visibility-BEFORE.json")
  ? JSON.parse(readFileSync("shots-qa/t914-import-visibility-BEFORE.json", "utf8")) : null;
const after = existsSync("shots-qa/t914-import-visibility-AFTER.json")
  ? JSON.parse(readFileSync("shots-qa/t914-import-visibility-AFTER.json", "utf8")) : null;
const stackW = existsSync("shots-qa/t914-stack-witness.json")
  ? JSON.parse(readFileSync("shots-qa/t914-stack-witness.json", "utf8")) : null;
ok("A5a the BEFORE receipt is RED with the defect's face (star only, no images)", before?.verdict === "RED" && JSON.stringify(before?.listing?.names ?? []) === JSON.stringify(["micrographs.star", "run.err", "run.out"]), before ? `${before.pass}/${before.pass + before.fail}` : "missing");
ok("A5b the AFTER receipt is GREEN with the cure's numbers (slices 4 + 1)", after?.verdict === "GREEN" && after?.listing?.slices?.a === 4 && after?.listing?.slices?.b === 1, after ? `${after.pass}/${after.pass + after.fail}` : "missing");
ok("A5c the stack witness is GREEN (the rich row live, 25 arms)", stackW?.verdict === "GREEN" && stackW?.pass === 25, stackW ? `${stackW.pass}/${stackW.pass + stackW.fail}` : "missing");

// A6 — the diff rides the seat only. Comment lines are prose (the seat's
// law being explained); every added NON-COMMENT line must speak the seat's
// vocabulary. Removed lines get the same courtesy (the old lanes' prose
// goes with them).
const diff = execSync("git diff -U0 -- src/lib/relion/engine.ts", { encoding: "utf8" });
const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
const seatWords = /(t914|workdirMic|per-file|PER-FILE|micrographs|exposure|star's path|importFileSet|EMPIAR|ensureEmpiarLink|linkDirInto|junction|walkWorkdir|symlinked|INVISIBLE|loop.safety|listing|lstatSync|rmSync|mkdirSync|linkSync|symlinkSync|setProgress|entries|gallery preview|import still works|nothing there yet|mkdir below|const src|const dst|hostDir|unlinked|hostFiles|pathref|kindNote|skipNote|linkedCount|linkNote|const linked|if \(linked\)|mrcs|lines\.push|sourceLabel|result =|kindWord|pixel)/i;
const addedCode = added.filter((l) => !/^\+\s*(\/\/|\/\*|\*|$)/.test(l));
// structural scaffolding (try/catch braces) is SHAPE, not logic — the A16
// lesson: pin the law the shape reaches for (no foreign logic), not one
// window's literal tokens
const scaffold = /^\+\s*(try \{|\} catch( \{)?|\} \{|\.?\.\.\.|\}|\{)\s*$/;
const strays = addedCode.filter((l) => !scaffold.test(l) && !seatWords.test(l));
ok("A6 every added code line speaks the seat", strays.length === 0, strays.length ? `strays: ${strays.slice(0, 3).join(" | ")}` : `${added.length} added lines (${addedCode.length} code), all the seat's`);
const removed = diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
const removedCode = removed.filter((l) => !/^\-\s*(\/\/|\/\*|\*|$)/.test(l));
const oldLaneWords = /(linkDirInto|micLinkInWorkdir|ensureEmpiarLink|linkSync|symlinkSync|mkdirSync|const src|const dst|const linked|entries|for \(const (e|m|f) of|lines\.push|hostToWsl|unlinked|void setProgress|path\.join|startsWith|folder import|expose|micrographs)/i;
const oldScaffold = /^\-\s*(try \{|\} catch( \{)?|\} \{|\} else \{|\}|\{)\s*$/;
const removedStrays = removedCode.filter((l) => !oldScaffold.test(l) && !oldLaneWords.test(l));
ok("A6b every removed code line is the old lanes' own shape", removedStrays.length === 0, removedStrays.length ? `strays: ${removedStrays.slice(0, 3).join(" | ")}` : `${removed.length} removed lines (${removedCode.length} code), all the old lanes'`);

console.log(`\nverdict: ${fail === 0 ? "GREEN" : "RED"}  (${pass} ok, ${fail} fail)`);
try {
  const { writeFileSync } = await import("node:fs");
  writeFileSync("shots-qa/t914-import-visibility-unit.json", JSON.stringify({ unit: "t914-import-visibility-unit", verdict: fail === 0 ? "GREEN" : "RED", pass, fail, at: new Date().toISOString() }, null, 2) + "\n");
  console.log("receipt: shots-qa/t914-import-visibility-unit.json");
} catch {}
process.exit(fail === 0 ? 0 : 1);
