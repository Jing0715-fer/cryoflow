// t757 — the dormant face's REVIVAL: the HPC sbatch dry-run dialog comes
// back from retirement behind the inspector's tools menu. t399 retired the
// dry-run BUTTON from the panel row (two Server glyphs taught confusion;
// its 38px was the primary label's survival margin) but prophesied the
// home: "should a tools-menu home ever be wanted". This window builds that
// home: a wrench door in the inspector's identity row opens a menu whose
// first item speaks the tool's name in words and opens the sbatch dialog
// CONTROLLED (the menu item owns the door; the dialog's self-trigger stays
// unrendered — no Server BUTTON returns to the row, t399's law holds). The
// whole dormant family rides behind the one door: the sbatch dialog hosts
// the profiles editor (t185) and the queue sim (t186) — whose t756 water
// dots go from dormant-waiting to LIVE-IN-DIALOG the moment it opens.
//
//   A  the controlled form: optional open/onOpenChange, the merged open,
//      the gated self-trigger (uncontrolled callers keep it byte for byte),
//      the outward setter, the Escape peel law intact, the family rides.
//   B  the inspector wiring: one import, the wrench anatomy, the controlled
//      mount, the menu item owns the door, the row stays one-Server-glyph.
//   C  the seat: cleanup door -> wrench -> dialog -> separator; the row
//      wraps (wrap-not-clip — the panel row's lesson does not transfer);
//      the item speaks in words; the judgment note leads the block.
//   D  purity & history: zero hex in the new block, no storage writes, the
//      t399 prophecy comment stays verbatim in the panel, the uncontrolled
//      face intact, the t756 reader still seated, old residents keep seats.
//   E  live wire: /api/hpc/profiles and /api/hpc/sbatch/<job> answer a
//      browser-shaped request (the door's server side; the UI side is the
//      browser repatrol).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const sbatch = readFileSync(path.join(here, "..", "src", "components", "workflow", "hpc-sbatch-dialog.tsx"), "utf8");
const insp = readFileSync(path.join(here, "..", "src", "components", "workflow", "job-inspector.tsx"), "utf8");
const panel = readFileSync(path.join(here, "..", "src", "components", "workflow", "job-panel.tsx"), "utf8");
const queue = readFileSync(path.join(here, "..", "src", "components", "workflow", "hpc-queue-sim.tsx"), "utf8");

// slice discipline: the tools-menu block runs from its judgment note to the
// HpcSbatchDialog mount line; the action-row slice runs from the row's
// comment head to the row's closing Separator.
const tmStart = insp.indexOf("{/* t757 — the tools-menu home");
const tmEnd = tmStart >= 0 ? insp.indexOf("<HpcSbatchDialog jobId={job.id}", tmStart) : -1;
const toolsMenu = tmStart >= 0 && tmEnd > tmStart ? insp.slice(tmStart, tmEnd) : "";

const rowStart = insp.indexOf("{/* action cluster + close");
const rowEnd = rowStart >= 0 ? insp.indexOf('aria-label="Close inspector"', rowStart) : -1;
const actionRow = rowStart >= 0 && rowEnd > rowStart ? insp.slice(rowStart, rowEnd) : "";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};

/* ================================================================== */
/* A — the controlled form                                             */
/* ================================================================== */
console.log("\nA — the dialog learns the controlled form, keeps the self-trigger");

must(sbatch.includes("open?: boolean;") && sbatch.includes("onOpenChange?: (open: boolean) => void;"),
  "A the props type gains the optional controlled pair (open + onOpenChange)");

must((sbatch.match(/const open = openProp \?\? openState;/g) || []).length === 1,
  "A the merged open reads exactly once (the owner's word wins, the internal state stands for the uncontrolled form)");

// structural pairing over counting: residents own `) : null}` closures too
// (badges, slurmNotes — four in the file), so the gate is proven by its
// SLICE: open -> DialogTrigger -> the trigger's own close.
const gateOpen = sbatch.indexOf("{openProp === undefined ? (");
const gateClose = gateOpen >= 0 ? sbatch.indexOf(") : null}", gateOpen) : -1;
const gateSlice = gateOpen >= 0 && gateClose > gateOpen ? sbatch.slice(gateOpen, gateClose) : "";
must((sbatch.match(/\{openProp === undefined \? \(/g) || []).length === 1 &&
     gateSlice.includes("<DialogTrigger asChild>") && gateSlice.includes("</DialogTrigger>"),
  "A the self-trigger is gated on the uncontrolled form (open -> DialogTrigger -> close, a structural pairing — the file's other `) : null}` closures belong to residents)");

must(sbatch.includes('aria-label="Generate Slurm sbatch script for this job"') &&
     sbatch.includes('title="HPC / Slurm submission script (dry-run)"'),
  "A the uncontrolled face survives byte for byte (the trigger's name and title stay verbatim)");

must(sbatch.includes("onOpenChange?.(v);"),
  "A the merged setter reports outward (the owner's state stays the single truth)");

must(sbatch.includes("onKeyDown={onEscapeClose(() => setOpen(false))}"),
  "A the Escape peel law stays wired (the t60 contract: the dialog closes itself, the inspector survives)");

must(sbatch.includes('import { HpcQueueSim } from "./hpc-queue-sim";') &&
     sbatch.includes('import { HpcProfilesEditor } from "./hpc-profiles-editor";'),
  "A the dormant family rides behind the one door (queue sim + profiles editor still hosted)");

/* ================================================================== */
/* B — the inspector wiring                                            */
/* ================================================================== */
console.log("\nB — the tools menu owns the door");

must((insp.match(/import \{ HpcSbatchDialog \} from "\.\/hpc-sbatch-dialog";/g) || []).length === 1,
  "B the import lands once (the revival's single line)");

must((insp.match(/\n  Wrench,\n/g) || []).length === 1,
  "B the Wrench glyph joins the lucide roster (a tool door, not a second Server)");

must((insp.match(/<HpcSbatchDialog jobId=\{job\.id\} open=\{sbatchOpen\} onOpenChange=\{setSbatchOpen\} \/>/g) || []).length === 1,
  "B the controlled mount reads exactly once (jobId + the owned open pair)");

must(toolsMenu.includes('data-testid="tools-sbatch-item"') &&
     toolsMenu.includes("onSelect={() => setSbatchOpen(true)}"),
  "B the menu item owns the door (named testid + onSelect opens the sbatch dialog)");

must((actionRow.match(/aria-label="Run on cluster \(SSH\)"/g) || []).length === 1,
  "B the row keeps exactly one Server BUTTON (the cluster door — t399's two-Server law holds in the revival)");

must(!insp.slice(0, insp.indexOf("t757")).includes('aria-label="Generate Slurm sbatch script for this job"'),
  "B the dry-run's self-trigger appears nowhere in the inspector (the trigger stays unrendered, the icon never returns as a button)");

must(toolsMenu.includes('aria-label="More job tools"') &&
     toolsMenu.includes("before:-inset-1.5") && toolsMenu.includes("size-7 shrink-0"),
  "B the wrench wears the row's icon dialect (hit-slop + size-7 shrink-0, the Eraser's exact coat)");

/* ================================================================== */
/* C — the seat: door order, wrap-not-clip, named words                */
/* ================================================================== */
console.log("\nC — the seat between the cleanup door and the separator");

const seatRe = /onCleaned=\{onCleaned\}\s*\/>[\s\S]*?\{\/\* t757 — the tools-menu home[\s\S]*?<DropdownMenu>[\s\S]*?<\/DropdownMenu>[\s\S]*?<HpcSbatchDialog jobId=\{job\.id\}[\s\S]*?<Separator orientation="vertical"/;
must(seatRe.test(insp),
  "C the seat is cleanup door -> wrench menu -> sbatch dialog -> separator (after the icon doors, before the close)");

must(actionRow.includes("flex-wrap"),
  "C the row wraps (wrap-not-clip: the inspector row's shrink-0 items fold, the panel row's 38px lesson does not transfer here)");

must(toolsMenu.includes(">Slurm sbatch dry-run…</span>"),
  "C the item speaks the tool's name in words (a named door, never a cryptic glyph's return)");

must(toolsMenu.includes(">Job tools</DropdownMenuLabel>"),
  "C the menu carries its label (the home's nameplate — one tool today, the home grows)");

const blockHex = toolsMenu.split("\n").filter((l) => /#[0-9a-fA-F]{6}\b/.test(l));
must(blockHex.length === 0,
  "C zero hex literals in the tools-menu block (ink rides the token vocabulary)",
  `${blockHex.length} hex line(s)`);

must(insp.includes("t757 — the tools-menu home, prophesied by t399's retirement") &&
     toolsMenu.includes("two-Server law") && toolsMenu.includes("the menu is the home that grows"),
  "C the judgment note leads the block and names its laws (the prophecy + the glyph law + the grower)");

/* ================================================================== */
/* D — purity & history                                                */
/* ================================================================== */
console.log("\nD — purity and the respected history");

must(!/localStorage|sessionStorage|writeUserParamPresets/.test(toolsMenu),
  "D no storage writes in the tools-menu block");

must(panel.includes("should a tools-menu home") &&
     panel.includes("dry-run generator ever be wanted"),
  "D the t399 prophecy comment stays verbatim in the panel (history is cited, never rewritten — read in inline segments, the t753 line-wrap lesson)");

must(!panel.includes("HpcSbatchDialog") && !panel.includes("hpc-sbatch-dialog"),
  "D the panel row stays retired (the revival's home is the inspector — the 38px budget is untouched)");

must(queue.includes("data-testid={`queue-pours-${row.key}`}"),
  "D the t756 reader stays seated in the family (the queue sim's water dots ride behind the revived door)");

must(actionRow.includes('aria-label="Clean intermediates (local + cluster)"') &&
     insp.includes('aria-label="Close inspector"'),
  "D the old residents keep their seats (the eraser door and the close)");

must(insp.includes("const [sbatchOpen, setSbatchOpen] = React.useState(false);"),
  "D the door's state lives once in the header (owned where the other doors' state lives)");

/* ================================================================== */
/* E — live wire: the door's server side answers                       */
/* ================================================================== */
console.log("\nE — the server side of the revived door");

const BASE = "http://localhost:3000";
const BROWSER_HEADERS = { Origin: BASE, "Accept": "application/json" };
try {
  const jobsRes = await fetch(`${BASE}/api/jobs`, { headers: BROWSER_HEADERS });
  const jobsBody = await jobsRes.json();
  const roster = Array.isArray(jobsBody?.jobs) ? jobsBody.jobs : [];
  must(jobsRes.ok && roster.length > 0,
    "E the roster answers a browser-shaped request (jobs for the dry-run)",
    `${roster.length} job(s)`);

  const profRes = await fetch(`${BASE}/api/hpc/profiles`, { headers: BROWSER_HEADERS });
  const profBody = await profRes.json();
  const profCount = Array.isArray(profBody?.profiles) ? profBody.profiles.length : 0;
  must(profRes.ok && profCount > 0,
    "E /api/hpc/profiles serves the registry (the dialog's Select has faces to show)",
    `${profCount} profile(s)`);

  const profileId = profBody?.profiles?.find((p) => p.id !== "local-workstation")?.id ?? profBody?.profiles?.[0]?.id ?? "";
  // The route's contract: ok + dryRun + a strategy verdict. The SCRIPT face
  // depends on the job's own inputs (a missing input earns the error face —
  // the dialog renders both honestly), so the full-script evidence walks a
  // candidate list until a resolving job speaks #SBATCH.
  const firstJob = roster[0]?.id ?? "";
  const firstRes = await fetch(`${BASE}/api/hpc/sbatch/${encodeURIComponent(firstJob)}?profile=${encodeURIComponent(profileId)}`, { headers: BROWSER_HEADERS });
  const firstBody = await firstRes.json();
  must(firstRes.ok && firstBody?.dryRun === true && typeof firstBody?.strategy?.mode === "string",
    "E /api/hpc/sbatch answers the dry-run contract (dryRun + a strategy verdict)",
    `mode ${firstBody?.strategy?.mode ?? "?"}`);

  let fullScript = false, scriptJob = "";
  for (const j of roster) {
    const r = await fetch(`${BASE}/api/hpc/sbatch/${encodeURIComponent(j.id)}?profile=${encodeURIComponent(profileId)}`, { headers: BROWSER_HEADERS });
    if (!r.ok) continue;
    const b = await r.json();
    if (typeof b?.script === "string" && b.script.includes("#SBATCH")) { fullScript = true; scriptJob = j.id; break; }
  }
  must(fullScript,
    "E the full sbatch text renders for a resolving job (real argv, cluster-translated — the brochure's content behind the menu item)",
    scriptJob);
} catch (e) {
  must(false, "E the live wire reachable", String(e));
}

/* ================================================================== */
console.log(`\n${PASS} passed, ${FAIL} failed`);
process.exit(FAIL === 0 ? 0 : 1);
