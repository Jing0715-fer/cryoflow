#!/usr/bin/env node
/**
 * t998 — the RENAME ARC'S VOICE unit (node-only): the workspace row's
 * rename arc learned to speak, pinned at source AND against the live
 * census. The arc's faces before this unit:
 *
 *   the inline rename input   a static "Workspace name" — its commit
 *                             refuses empty and unchanged names with a
 *                             SILENT cancel, and the 60-character wall
 *                             ate keystrokes without a word;
 *   the delete door           a disabled default-row button whose NAME
 *                             said "Delete Main" with the reason only
 *                             in the hover-only title;
 *   the create input          a 60 maxLength that silently truncated
 *                             pasted names.
 *
 * THE CURES (voice-only — the commit's arithmetic never moved):
 *   B1      WS_NAME_MAX — the wall's ONE truth (the t997 formula law:
 *           the two maxLengths, the two slices, the create guard, and
 *           both voices' cap faces ride the const; the API's 1–60
 *           re-validation is the wall's other bank);
 *   B2–B7   the rename input's FOUR-BRANCH voice (empty / unchanged /
 *           at-cap / rest) — the open lands on the unchanged face
 *           honestly (Enter right now would do nothing);
 *   B8–B11  the delete door's refusal rides the NAME (the t982
 *           zoom-clamp dialect — the reason promoted from the
 *           hover-only title to the accessible name);
 *   B12–B13 the create input's GHOST GUARD (the t997 dialect: the
 *           attribute is undefined at rest — the Label element carries
 *           the plain name — and appears only to refuse);
 *   B14–B20 the const's riders (maxLengths, slices, guard, the commit's
 *           unchanged pair) + zero residual literal 60s;
 *   B21–B26 the CENSUS TRIPWIRE — the unit re-runs the t982 census live
 *           and pins the tallies UNCHANGED (population 171, stateful
 *           116, silent-static 30, silences 55, the story slots): the
 *           cured faces were never in the disabled-refusal census (the
 *           rename input and the create input carry no disabled prop;
 *           the delete door was already stateful), so the re-key law
 *           does NOT fire — pinned here so a future verdict shift
 *           cannot slip by unnoticed;
 *   B27–B28 the keyboard ownership (the input owns its Escape —
 *           preventDefault + stopPropagation + cancel; the row stands
 *           down while editing — the t997 ownership-guard's sibling).
 *
 * THE PROBE PROTOCOL: node-only, no imports from src — the census child
 * process plus readFileSync includes, exit honest.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CENSUS = path.join(ROOT, "scripts/t982-aria-refusal-census.mjs");
const TMP = path.join(ROOT, "shots-qa/.t998-unit-receipt.json");
const PANEL = "src/components/workflow/workspace-panel.tsx";
const CENSUS_SRC = "scripts/t982-aria-refusal-census.mjs";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

/* B21–B26 first — the census tripwire runs BEFORE the source needles so
   a census failure is the loudest word in the unit's mouth. */
let receipt = null;
try {
  execFileSync("node", [CENSUS, "--receipt", TMP], { encoding: "utf8", timeout: 60_000 });
  receipt = JSON.parse(readFileSync(TMP, "utf8"));
} catch (e) {
  console.log(`  ✗ the census child process — ${String(e).slice(0, 200)}`);
  fail++;
}
try { unlinkSync(TMP); } catch {}

ok("B21 the census's population gate stands (the disabled-refusal law the no-re-key ruling reads)",
  (() => { try { return readFileSync(path.join(ROOT, CENSUS_SRC), "utf8").includes("if (!/\\bdisabled=\\{/.test(text)) continue;"); } catch { return false; } })());
ok("B22 population = 171 (the cured faces were never in it — the no-re-key ruling, live)",
  receipt?.population === 171, `got ${receipt?.population}`);
ok("B23 stateful = 146 (the delete door stays stateful through its cure; +30 from the t1005 refusal-name arm)",
  receipt?.tally?.stateful === 146, `got ${receipt?.tally?.stateful}`);
ok("B24 silent-static = 0 (the rename input was never counted — no disabled prop; the t1005 arm emptied the bucket)",
  receipt?.tally?.["silent-static"] === 0, `got ${receipt?.tally?.["silent-static"]}`);
ok("B25 silences = 25 (the flip bucket only — the t1005 arm retired the static half)",
  receipt?.silences === 25, `got ${receipt?.silences}`);
ok("B26 the story slots hold (flip 20 · var 2 · component 1 · blind 0 · vendor 2 · unnamed 0)",
  receipt?.storyTally?.flip === 20 && receipt?.storyTally?.var === 2 &&
  receipt?.storyTally?.component === 1 && (receipt?.storyTally?.blind ?? 0) === 0 &&
  receipt?.storyTally?.vendor === 2 && (receipt?.storyTally?.unnamed ?? 0) === 0,
  `flip=${receipt?.storyTally?.flip} var=${receipt?.storyTally?.var} vendor=${receipt?.storyTally?.vendor}`);

const shape = (file, needle) => {
  try { return readFileSync(path.join(ROOT, file), "utf8").includes(needle); }
  catch { return false; }
};
const panel = (() => { try { return readFileSync(path.join(ROOT, PANEL), "utf8"); } catch { return ""; } })();
const countOf = (needle) => panel.split(needle).length - 1;

/* B1 — the wall's one truth */
ok("B1 WS_NAME_MAX = 60 (the wall's ONE truth, the t997 formula law)",
  countOf("const WS_NAME_MAX = 60;") === 1);

/* B2–B7 — the rename input's four-branch voice */
ok("B2 the five-branch block stands (busy / empty / unchanged / at-cap / rest, in that order — the t1002 busy face rides FIRST)", shape(PANEL,
  `          aria-label={
            renaming
              ? "Workspace name (rename in flight)"
              : !editName.trim()
                ? "Workspace name (empty — type a name to rename)"
                : editName.trim() === workspace.name
                  ? "Workspace name (unchanged — edit the name to rename)"
                  : editName.length >= WS_NAME_MAX
                    ? \`Workspace name (at the \${WS_NAME_MAX}-character limit)\`
                    : "Workspace name"
          }`));
ok("B3 the empty face speaks the way out", shape(PANEL, `"Workspace name (empty — type a name to rename)"`));
ok("B4 the unchanged face speaks the way in", shape(PANEL, `"Workspace name (unchanged — edit the name to rename)"`));
ok("B5 the cap face rides the const (the wall's voice is the wall's truth)",
  shape(PANEL, "`Workspace name (at the ${WS_NAME_MAX}-character limit)`"));
ok("B6 the unchanged guard is the commit's own comparison (one truth, two scopes)",
  shape(PANEL, "editName.trim() === workspace.name"));
ok("B7 the cap guard rides the const", shape(PANEL, "editName.length >= WS_NAME_MAX"));

/* B8–B11 — the delete door's name-borne refusal */
ok("B8 the delete door's two-branch name stands", shape(PANEL,
  `            aria-label={
              isDefault
                ? \`Delete \${workspace.name} (the default workspace cannot be deleted)\`
                : \`Delete \${workspace.name}\`
            }`));
ok("B9 the default face carries the reason (and the fence holds — the plain face is its prefix)",
  shape(PANEL, "`Delete ${workspace.name} (the default workspace cannot be deleted)`"));
ok("B10 the enabled face stays plain", shape(PANEL, ": `Delete ${workspace.name}`"));
ok("B11 the door's state is isDefault (the design-disable, unmoved)",
  shape(PANEL, "disabled={isDefault}"));

/* B12–B13 — the create input's ghost guard */
ok("B12 the create input's cap face stands (the same wall's voice)", shape(PANEL,
  `              aria-label={
                newName.length >= WS_NAME_MAX
                  ? \`Name (at the \${WS_NAME_MAX}-character limit)\`
                  : undefined
              }`));
ok("B13 the rest face is UNDEFINED (the t997 ghost-guard dialect — the Label speaks at rest)",
  shape(PANEL, "? `Name (at the ${WS_NAME_MAX}-character limit)`\n                  : undefined"));

/* B14–B20 — the const's riders + zero residual 60s */
ok("B14 both maxLengths ride the const", countOf("maxLength={WS_NAME_MAX}") === 2,
  `count=${countOf("maxLength={WS_NAME_MAX}")}`);
ok("B15 no residual literal maxLength={60}", countOf("maxLength={60}") === 0,
  `count=${countOf("maxLength={60}")}`);
ok("B16 both slices ride the const", countOf("trimmed.slice(0, WS_NAME_MAX)") === 2,
  `count=${countOf("trimmed.slice(0, WS_NAME_MAX)")}`);
ok("B17 the create guard rides the const", shape(PANEL, "trimmed.length > WS_NAME_MAX"));
ok("B18 no residual literal slice(0, 60)", countOf("slice(0, 60)") === 0,
  `count=${countOf("slice(0, 60)")}`);
ok("B19 the commit's unchanged pair (the label's one truth, the commit's side)",
  shape(PANEL, `const current = workspaces.find((w) => w.id === id)?.name ?? "";`) &&
  shape(PANEL, "if (!trimmed || trimmed === current) {"));
ok("B20 the rename commit rides the const (the arithmetic, one mention) + the gate's finally pair (the t1002 re-key: the raw .finally(cancelEdit) is GONE)",
  shape(PANEL, "void renameWorkspace(id, trimmed.slice(0, WS_NAME_MAX)).finally(() => {") &&
  !shape(PANEL, ".finally(cancelEdit);"));

/* B27–B28 — the keyboard ownership (the arc's keys are owned) */
ok("B27 the input owns its Escape (preventDefault + stopPropagation + cancel)", shape(PANEL,
  `            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancelEdit();
            }`));
ok("B28 the row stands down while editing (the t997 ownership-guard's sibling)", shape(PANEL,
  `      onKeyDown={(e) => {
        if (editing) return;`));

console.log(`VERDICT: ${fail === 0 ? `GREEN ${pass}/${pass + fail}` : `RED ${pass}/${pass + fail}`}`);
console.log(`${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
