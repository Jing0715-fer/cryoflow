#!/usr/bin/env node
/**
 * t1002 — the RENAME ARC'S BUSY GATE unit (node-only): the recorded-not-
 * cured pair from the t1001 entry's first candidate, cured this window.
 *
 * THE RECORDED SHAPE (the t1002 entry, candidate ①):
 *   commitRename's `void renameWorkspace(...).finally(cancelEdit)` had
 *   NO busy voice during the await — the input stayed editable and
 *   nothing said the commit was in flight; and a blur fired while the
 *   first PATCH was in the air re-entered commitRename with the editor
 *   still open and re-PATCHed (idempotent, harmless, the shape real).
 *
 * THE CURE (the gate is the substance, the voice is its face):
 *   R1–R4   renamingId — the flight's one truth: the commit refuses
 *           re-entry while it is set (the guard rides FIRST, before
 *           even the id check), the gate closes over the PATCH, and
 *           the finally lands BOTH the release and the editor's close
 *           (the raw `.finally(cancelEdit)` is GONE — the one-mouth
 *           line that let the blur re-enter);
 *   R5      the raw line's absence, pinned negative;
 *   R6–R7   the input's BUSY FACE — the fifth branch of the t998 four-
 *           branch voice, riding FIRST (during the flight the state's
 *           advice faces are moot: nothing to type while the rename is
 *           unresolved), aria-busy beside it; NO disabled prop — the
 *           disabled-refusal census's tallies must stand UNMOVED (R8);
 *   R9–R10  the wire: the panel's single gate (`renamingId !== null`)
 *           feeds every row — whichever input is open during a flight
 *           speaks the busy face, and the row's prop type pins the
 *           contract.
 *
 * THE FLIGHT IS SUB-PERCEPTUAL on localhost (the PATCH resolves in
 * milliseconds), so the busy face is unit-pinned at source, not walked
 * — the walk family measures what the world can show. The t998 walk
 * re-rides the arc's reachable faces unchanged (its probes read by the
 * "Workspace name" prefix, which the busy branch keeps).
 *
 * THE PROBE PROTOCOL: node-only, no imports from src — the census child
 * process plus readFileSync includes, exit honest.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CENSUS = path.join(ROOT, "scripts/t982-aria-refusal-census.mjs");
const TMP = path.join(ROOT, "shots-qa/.t1002-unit-receipt.json");
const PANEL = "src/components/workflow/workspace-panel.tsx";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* R8 first — the census tripwire runs BEFORE the source needles so a
   tally shift is the loudest word in the unit's mouth. The cure adds NO
   disabled prop (aria-busy is not disabled; the busy face rides the
   label), so the t982 tallies must stand exactly as t998's B22–B25 pin
   them. */
let receipt = null;
try {
  execFileSync("node", [CENSUS, "--receipt", TMP], { encoding: "utf8", timeout: 60_000 });
  receipt = JSON.parse(readFileSync(TMP, "utf8"));
} catch (e) {
  console.log(`  ✗ the census child process — ${String(e).slice(0, 200)}`);
  fail++;
}
try { unlinkSync(TMP); } catch {}

ok("R8a the disabled census's population stands at 173 (the busy gate added no disabled row; +1 the t1096 filmstrip walk name, +1 the t1098 ortho walk name)",
  receipt?.population === 173, `got ${receipt?.population}`);
ok("R8b stateful 151 · silent-static 0 · silences 22 — the t1005 second arm's re-key (the static bucket EMPTIED) + the t1008 third arm's re-key (three dynamic names moved their honest-name stories) + the t1096 filmstrip arm (+1 the walk's a11y voice) + the t1098 ortho walk arm (+1 the axis walk's a11y voice), this unit's own no-disabled-prop law stands untouched",
  receipt?.tally?.stateful === 151 &&
  receipt?.tally?.["silent-static"] === 0 &&
  receipt?.silences === 22,
  `stateful=${receipt?.tally?.stateful} static=${receipt?.tally?.["silent-static"]} silences=${receipt?.silences}`);

const panel = (() => { try { return readFileSync(path.join(ROOT, PANEL), "utf8"); } catch { return ""; } })();
const countOf = (needle) => panel.split(needle).length - 1;

/* R1–R5 — the gate */
ok("R1 renamingId — the flight's one truth (declared beside the editor's own state)",
  countOf("const [renamingId, setRenamingId] = React.useState<string | null>(null);") === 1);
ok("R2 the re-entry guard rides FIRST (before even the id check — the flight's own mouth)",
  panel.includes(`  const commitRename = () => {
    /* t1002 — the re-entry guard rides FIRST: a blur fired while the
     * PATCH is in the air re-enters here with the editor still open —
     * the busy gate refuses the second commit. The flight's own mouth:
     * nothing mutates the editor while the rename is unresolved, and
     * the open input's busy face is the gate's voice. */
    if (renamingId) return;`));
ok("R3 the gate closes over the PATCH (set before the await, not after)",
  panel.includes("    setRenamingId(id);\n    void renameWorkspace(id, trimmed.slice(0, WS_NAME_MAX)).finally(() => {"));
ok("R4 the finally lands BOTH the release and the editor's close (the pair, in that order)",
  panel.includes("      setRenamingId(null);\n      cancelEdit();\n    });"));
ok("R5 the raw one-mouth line is GONE (the blur's re-entry door, sealed)",
  countOf(".finally(cancelEdit);") === 0);

/* R6–R7 — the busy face */
ok("R6 the busy face rides FIRST (the state's advice faces are moot in flight)",
  panel.includes(`            renaming
              ? "Workspace name (rename in flight)"
              : !editName.trim()`));
ok("R7 aria-busy beside the voice (the widget's own busy flag, undefined at rest — the t997 ghost dialect)",
  panel.includes("aria-busy={renaming || undefined}"));

/* R9–R10 — the wire */
ok("R9 the row's prop type pins the contract (boolean, documented at the signature)",
  panel.includes("  renaming: boolean;"));
ok("R10 the panel's single gate feeds every row (whichever input is open speaks the flight)",
  countOf("renaming={renamingId !== null}") === 1);

console.log(`VERDICT: ${fail === 0 ? `GREEN ${pass}/${pass + fail}` : `RED ${pass}/${pass + fail}`}`);
console.log(`${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
