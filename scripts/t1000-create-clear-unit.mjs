#!/usr/bin/env node
/**
 * t1000-create-clear-unit — the census's 33rd instrument.
 *
 * THE STORY: the workspace create dialog kept a dirty draft on every
 * close path except success — the user types a name, hits Cancel (or
 * Escape, or the X, or clicks outside), reopens, and the abandoned text
 * is still sitting in the input (the t999 entry's candidate ③, the
 * recorded-not-cured shape). The cure is the ONE-MOUTH law's dialog
 * form: every close path routes through a single `closeCreate` (the
 * t999 builders' law — one mouth, no drift), so a reopened dialog opens
 * EMPTY. The success path rides the same door.
 *
 * THE CONTRACT PINNED (in-process includes — the capture-layer law
 * t957 pinned: never a plain-text echo of source bytes):
 *   Q1  the one mouth exists (closeCreate: the draft cleared AND the
 *       dialog closed, nothing else).
 *   Q2  the law lives in the source ("the create dialog's doors keep no
 *       draft" — the comment IS the contract's home).
 *   Q3  the success path rides the mouth (the old inline brace form is
 *       GONE — the mouth is the only closer that carries the clear).
 *   Q4  the Radix door (Escape / outside click / X) routes through the
 *       mouth (`onOpenChange={(o) => { if (!o) closeCreate(); }}`) and
 *       the raw `onOpenChange={setCreateOpen}` is GONE.
 *   Q5  the Cancel button rides the mouth (`onClick={closeCreate}`) and
 *       the raw inline closer is GONE.
 *   Q6  the census's A6 exclusion law at file scope: workspace-panel
 *       carries NO literal disabled prop (`disabled={true}` /
 *       `disabled={false}` absent — the literals are design decisions,
 *       not census population).
 *   Q7  the census's slot-27 family voices UNCHANGED: the create
 *       button's ternary keeps its refusal branch ("Create workspace
 *       (name the workspace first)") and the Cancel keeps its busy
 *       branch ("Cancel (the workspace is being created)") — a wording
 *       change here re-keys the t982 unit's tallies.
 *   Q8  the probe of this window's first half is in the tree and names
 *       its receipt (the t1000-sub8s-probe pair — the reload verdict).
 *   Q9  the walk exists and names its receipt.
 *   Q10 the walk rides the family's shared skeleton (createWalk import
 *       — the t991 kit law; no copy-pasted organs).
 *
 *   node scripts/t1000-create-clear-unit.mjs
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import url from "url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PANEL = path.join(ROOT, "src/components/workflow/workspace-panel.tsx");
const WALK = path.join(ROOT, "scripts/t1000-create-clear-walk.mjs");
const PROBE = path.join(ROOT, "scripts/t1000-sub8s-probe.mjs");

const panel = readFileSync(PANEL, "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

/* Q1 — the one mouth exists, and it is EXACTLY the pair (clear + close) */
ok("Q1 the one mouth exists (closeCreate clears the draft and closes the dialog)",
  panel.includes(`const closeCreate = React.useCallback(() => {`) &&
  /closeCreate = React\.useCallback\(\(\) => \{\s*\n\s*setNewName\(""\);\s*\n\s*setCreateOpen\(false\);\s*\n\s*\}, \[\]\);/.test(panel));

/* Q2 — the law's home is the source */
ok("Q2 the law lives in the source comment",
  panel.includes("the create dialog's doors keep no draft"));

/* Q3 — the success path rides the mouth; the old inline form is gone */
ok("Q3 the success path rides the mouth",
  panel.includes(`if (ok) closeCreate();`));
ok("Q3b the old inline success-clear is GONE (the mouth is the only clearer)",
  !panel.includes(`setNewName("");\n      setCreateOpen(false);`));

/* Q4 — the Radix door routes through the mouth; the raw form is gone */
ok("Q4 the Radix door (Escape / outside / X) routes through the mouth",
  panel.includes(`onOpenChange={(o) => { if (!o) closeCreate(); }}`));
ok("Q4b the raw onOpenChange={setCreateOpen} is GONE",
  !panel.includes(`onOpenChange={setCreateOpen}`));

/* Q5 — the Cancel button rides the mouth; the raw inline closer is gone */
ok("Q5 the Cancel button rides the mouth",
  /onClick=\{closeCreate\}/.test(panel));
ok("Q5b the raw inline Cancel closer is GONE",
  !panel.includes(`onClick={() => setCreateOpen(false)}`));

/* Q6 — the census's A6 exclusion law at file scope */
ok("Q6 no literal disabled prop in the panel (the design-exclusion law)",
  !panel.includes(`disabled={true}`) && !panel.includes(`disabled={false}`));

/* Q7 — the census family's voices UNCHANGED (the t982 re-key tripwire) */
ok("Q7a the create button's refusal branch keeps its words",
  panel.includes(`newName.trim().length < 1 ? "Create workspace (name the workspace first)" : "Create workspace"`));
ok("Q7b the Cancel's busy branch keeps its words",
  panel.includes(`creating ? "Cancel (the workspace is being created)" : "Cancel"`));

/* Q8 — the window's first half: the probe is in the tree */
ok("Q8 the sub-8s probe exists and names its receipt",
  existsSync(PROBE) && readFileSync(PROBE, "utf8").includes("t1000-sub8s-probe.json"));

/* Q9 — the walk is in the tree */
ok("Q9 the walk exists and names its receipt",
  existsSync(WALK) && readFileSync(WALK, "utf8").includes("t1000-create-clear-walk.json"));

/* Q10 — the kit law */
ok("Q10 the walk rides the shared skeleton",
  existsSync(WALK) && readFileSync(WALK, "utf8").includes('from "./walk-kit.mjs"'));

console.log(`== t1000-create-clear-unit ${pass}/${pass + fail} green ==`);
process.exit(fail === 0 ? 0 : 1);
