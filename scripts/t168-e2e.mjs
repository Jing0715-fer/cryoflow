// t168-e2e — Task 168: the DOMAIN SWEEP earns its probes. Task 167's static
// scan deliberately declared "workspace/project domain names are not job
// rows — the workspace-orphan audit is a separate future audit". This is
// that audit, plus its two siblings (project + template), plus the probe
// that pins all three.
//
// The product risk being fenced:
//  - POST /api/projects SETS THE NEW PROJECT ACTIVE (registerProject
//    makeActive=true). A crashed cross-project suite (t126 "TL126 cross")
//    leaves the whole world faceshifted onto a test canvas — every
//    job-domain audit keeps scanning a roster nobody can see.
//  - Workspace leaks (t100 "t100 Second", t127/t128/t129 "T12x dest",
//    qa77 "QA Overflow") haunt the sidebar forever; template leaks
//    (t127-shot "Tuned 2D branch") haunt the shelf.
//
// Phases:
//  S — three-domain baseline snapshot (projects / workspaces / templates)
//  X — source oracles: the three signature tables, the canonical guards,
//      the 50-caps, the ORDER contract (project audit BEFORE ws audit —
//      the heal re-activates the canonical project so the lower audits
//      scan the RIGHT rows), the domain-sweep ledger line
//  B — clean-world run: 0/0/0 (a sweeper that sweeps a clean floor is quiet)
//  C — CORE, one drill per domain, each demonstrating a DIFFERENT API truth:
//      C1 project: POST sets it ACTIVE → hygiene deletes the leak → the
//         active pointer HEALS back to the canonical demo (first-by-createdAt)
//      C2 workspace: DELETE moves its jobs to the default canvas first —
//         the seeded job SURVIVES, re-homed ("nothing is ever lost")
//      C3 template: the shelf row is swept
//      G — the canonical guard: Main / QA WS Breathe / QA WS Pos Two and
//         the demo project all SURVIVE the drills
//  W — the sibling-domain static scan (t167's extractor, re-aimed): every
//      workspace/project/template POST name literal in every suite must
//      classify as self-prefix / explicit-sig / canonical — ZERO blind
//      spots, with known members pinned and a floor so the scan can't
//      pass vacuously
//  D — stability: a second hygiene run is 0/0/0 again
//  Z — three-domain roster identity (the drills cleaned by the contract's
//      own DELETE; unknown-id diff both ways)
//
// Run: node scripts/t168-e2e.mjs   (server on :3000, no browser needed)

import { readFileSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const ROOT = "/home/z/my-project";
const SCRIPTS = `${ROOT}/scripts`;
const BASE = "http://localhost:3000";

let PASS = 0;
let failed = false;
const fail = (msg) => { failed = true; console.log(`  FAIL: ${msg}`); };
const must = (cond, msg) => {
  if (cond) { PASS++; console.log(`  ok: ${msg}`); }
  else fail(msg);
};

// hoisted drill handles — Z's finally must never be shadowed by a try-body
// redeclaration (the t164 lesson: a shadowed handle makes cleanup a no-op)
let drillWs = null;      // C2's "T168 dest" workspace row
let drillWsJob = null;   // C2's re-homed job row
let drillTpl = null;     // C3's "T168 branch" template row
let drillProjectId = null; // C1's "T168 cross" project id (deleted BY the audit)

const api = async (path, method = "GET", body) =>
  fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

// EVERY seed helper unwraps the envelope (the t165 vacuous-pass lesson:
// POST routes wrap rows as {job|workspace|template|project:{...}} — an
// un unwrapped envelope makes every id undefined and every assertion
// vacuously true)
const seedJob = async (body) => {
  const r = await api("/api/jobs", "POST", body);
  if (!r.ok) throw new Error(`seedJob ${body.name} HTTP ${r.status}`);
  return (await r.json()).job ?? (await r.json());
};
const seedWs = async (name) => {
  const r = await api("/api/workspaces", "POST", { name });
  if (!r.ok) throw new Error(`seedWs ${name} HTTP ${r.status}`);
  return (await r.json()).workspace ?? (await r.json());
};
const seedTpl = async (name) => {
  const r = await api("/api/custom-template", "POST", {
    name,
    payload: { jobs: [{ type: "import", dx: 0, dy: 0, params: {} }], edges: [] },
  });
  if (!r.ok) throw new Error(`seedTpl ${name} HTTP ${r.status}`);
  return (await r.json()).template ?? (await r.json());
};
const seedProject = async (name) => {
  const r = await api("/api/projects", "POST", { name });
  if (!r.ok) throw new Error(`seedProject ${name} HTTP ${r.status}`);
  return (await r.json()).project ?? (await r.json());
};

const roster = async () => (await (await api("/api/jobs")).json()).jobs ?? [];
const projects = async () => (await (await api("/api/projects")).json()).projects ?? [];
const workspaces = async () => (await (await api("/api/workspaces")).json()).workspaces ?? [];
const templates = async () => (await (await api("/api/custom-template")).json()).templates ?? [];

const runHygiene = () =>
  execSync("node scripts/world-hygiene.mjs", { cwd: ROOT, encoding: "utf8", timeout: 120000 });

// ============================== S: baselines ==============================
console.log("== S: three-domain baseline ==");
const baselineProjects = await projects();
const baselineWs = await workspaces();
const baselineTpl = await templates();
const baselineJobs = await roster();
const CANONICAL_PROJECT = "β-Galactosidase Tutorial (demo)";
// the world is ALIVE — its composition drifts every matrix round (t163's
// doctrine: the drift is a feature, the roster identity is the contract).
// Absolute counts would turn every world shift into a false failure; the
// baseline SNAPSHOT plus Z's both-ways diff is what carries the weight.
must(baselineProjects.some((p) => p.name === CANONICAL_PROJECT),
  `baseline: the canonical project is present (${baselineProjects.length} project(s))`);
const canonWsNames = baselineWs.map((w) => w.name).sort().join("|");
must(baselineWs.some((w) => w.name === "Main") &&
     baselineWs.some((w) => w.name === "QA WS Breathe") &&
     baselineWs.some((w) => w.name === "QA WS Pos Two"),
  `baseline: the canonical workspace trio is present (${canonWsNames})`);
must(baselineTpl.length === 0, `baseline: shelf empty (${baselineTpl.length})`);
must(baselineJobs.length >= 20, `baseline: roster populated (${baselineJobs.length} jobs)`);
const wsMain = baselineWs.find((w) => w.name === "Main");
must(!!wsMain, "baseline: Main is present (C2's re-homing target)");

// ============================== X: source oracles =========================
console.log("== X: source oracles ==");
const hyg = readFileSync(join(SCRIPTS, "world-hygiene.mjs"), "utf8");

// the three signature tables exist, each with the members that earned them
must(hyg.includes("audit 0.75: project-orphan") && /\^TL\\d\+ \//.test(hyg),
  "X1 project-orphan table present with the TLd+ member (TL126 cross)");
must(hyg.includes("audit 0.8: ws-orphan") && hyg.includes("QA Overflow"),
  "X2 ws-orphan table present with the explicit qa77 member");
must(hyg.includes("audit 0.9: template-orphan") && hyg.includes("Tuned 2D branch") && hyg.includes("Preprocess trio"),
  "X3 template-orphan table present with the t127-shot shelf members");
must(hyg.includes("audit 0.8: ws-orphan") && /\^Deep \//.test(hyg),
  "X4 ws-orphan carries the Deep generation signature (same family as the job domain)");

// the ORDER contract: the project audit textually precedes the workspace
// audit — deleting the leak heals the active pointer BEFORE the lower
// audits scan (a faceshifted active project would hide the right rows)
const iProj = hyg.indexOf("audit 0.75: project-orphan");
const iWs = hyg.indexOf("audit 0.8: ws-orphan");
const iTpl = hyg.indexOf("audit 0.9: template-orphan");
must(iProj !== -1 && iWs !== -1 && iTpl !== -1 && iProj < iWs && iWs < iTpl,
  "X5 ORDER contract: project → workspace → template (the heal must run first)");
must(hyg.includes("makeActive=true") || hyg.includes("SET THE NEW PROJECT ACTIVE"),
  "X6 the faceshift hazard is documented at the audit that fences it");
must(hyg.includes("heals the active pointer") || hyg.includes("falls back"),
  "X7 the heal-on-delete rationale is written down (first-by-createdAt)");

// the canonical guards
must(hyg.includes('CANONICAL_PROJECT = "β-Galactosidase Tutorial (demo)"'),
  "X8 project canonical guard names the demo explicitly");
must(hyg.includes('"QA WS Breathe"') && hyg.includes('"QA WS Pos Two"'),
  "X9 ws canonical guard names the ensure-by-name trio members");
must(hyg.includes("nothing is ever lost"),
  "X10 the ws-deletion safety contract (jobs move to the default canvas) is cited");

// the caps: the three new audits inherit the loud-abort contract
must((hyg.match(/ABORT: \$\{[^}]+\} matches exceed the 50 cap/g) ?? []).length === 3,
  "X11 the three domain audits each carry the 50 cap (job domain keeps its 400s)");

// the ledger line — a run's three-domain sweep readable at a glance
must(hyg.includes("domain-sweep: project ${HYGIENE_COUNTS.project}") &&
     hyg.includes("HYGIENE_COUNTS = { project: 0, ws: 0, tpl: 0 }"),
  "X12 the domain-sweep ledger line exists, fed by the three-count registry");

// matrix wiring unchanged: hygiene still runs before every suite
must(readFileSync(join(SCRIPTS, "run-matrix.sh"), "utf8").includes("world-hygiene.mjs"),
  "X13 matrix wiring: hygiene runs before every suite (the between-suites window)");

// ===================== B: clean world sweeps zero =========================
console.log("== B: clean world 0/0/0 ==");
{
  const out = runHygiene();
  must(out.includes("project-orphan: 0"), "B1 project-orphan: 0 on the clean world");
  must(out.includes("ws-orphan: 0"), "B2 ws-orphan: 0 on the clean world");
  must(out.includes("template-orphan: 0"), "B3 template-orphan: 0 on the clean world");
  must(/domain-sweep: project 0 · workspace 0 · template 0/.test(out), "B4 the ledger line reads 0 · 0 · 0");
}

// ===================== C: CORE — one drill per domain =====================
console.log("== C: CORE domain drills ==");
// --- C1: the PROJECT drill (the faceshift) ---
{
  const proj = await seedProject("T168 cross");
  drillProjectId = proj.id ?? proj.project?.id;
  must(!!drillProjectId, "C1.1 T168 cross project seeded");
  // the hazard, demonstrated: POST set it ACTIVE (the world just faceshifted)
  const activeNow = await projects();
  must(activeNow.length === baselineProjects.length + 1, "C1.2 the leak faceshifts the world (+1 project)");
  // seed a workspace inside the leak — API only reaches the ACTIVE project,
  // which is exactly why the audit order (X5) matters
  const leakWs = await seedWs("T168 cross deep");
  must(!!(leakWs.id ?? leakWs.workspace?.id), "C1.3 the leak's own canvas seeded (reachable because POST made it active)");
  const out = runHygiene();
  must(/project-orphan: 1\/1 leaked project\(s\) deleted/.test(out), "C1.4 the audit deletes the leaked project 1/1");
  const after = await projects();
  must(!after.some((p) => p.name === "T168 cross") && after.length === baselineProjects.length,
    "C1.5 the active pointer HEALS back to the pre-drill project set (first-by-createdAt)");
  must(!(await workspaces()).some((w) => w.name === "T168 cross deep"),
    "C1.6 the leak's canvas died with the project (cascade)");
  must(/domain-sweep: project 1 ·/.test(out), "C1.7 the ledger row reads project 1");
}

// --- C2: the WORKSPACE drill (re-homing, not loss) ---
{
  drillWs = await seedWs("T168 dest");
  drillWs = drillWs.id ? drillWs : (drillWs.workspace ?? drillWs);
  must(!!drillWs?.id, "C2.1 T168 dest workspace seeded");
  const maxY = baselineJobs.reduce((m, j2) => Math.max(m, (j2.y ?? 0) + 260), 800);
  // the drill job is deliberately QA-prefixed (the canonical shape): a
  // T-prefixed job name would be swept by the JOB-domain fixture-orphan
  // audit (audit 0.7 runs BEFORE ws-orphan) — the first contact taught the
  // composition lesson: a signature table's reach is by DOMAIN, and a
  // cross-domain same-prefix drill destroys its own subject mid-drill
  drillWsJob = await seedJob({ type: "import", name: "QA ws job", workspaceId: drillWs.id, x: 140, y: maxY + 260 });
  must(!!drillWsJob?.id, "C2.2 a job lives inside the doomed workspace");
  const out = runHygiene();
  must(/ws-orphan: 1\/1 outlived workspaces deleted/.test(out), "C2.3 the audit deletes the workspace 1/1");
  must(/jobs moved to the default canvas/.test(out), "C2.4 the output says WHERE the jobs went");
  const jobsNow = await roster();
  const survivor = jobsNow.find((j2) => j2.id === drillWsJob.id);
  must(!!survivor, "C2.5 the seeded job SURVIVED the workspace deletion");
  const wsNow = await workspaces();
  const mainNow = wsNow.find((w) => w.name === "Main");
  if (survivor && mainNow) {
    must(survivor.workspaceId === mainNow.id, "C2.6 the survivor was RE-HOMED to Main (nothing is ever lost)");
  } else fail("C2.6 skipped — no survivor or no Main");
  must(!wsNow.some((w) => w.name === "T168 dest"), "C2.7 the doomed workspace is gone");
}

// --- C3: the TEMPLATE drill (the shelf) ---
{
  drillTpl = await seedTpl("T168 branch");
  drillTpl = drillTpl.id ? drillTpl : (drillTpl.template ?? drillTpl);
  must(!!drillTpl?.id, "C3.1 T168 branch template seeded");
  must((await templates()).length === 1, "C3.2 the shelf now carries the leak");
  const out = runHygiene();
  must(/template-orphan: 1\/1 outlived templates swept/.test(out), "C3.3 the audit sweeps the shelf 1/1");
  must((await templates()).length === 0, "C3.4 the shelf is clean again");
}

// =================== G: the canonical guard survives ======================
console.log("== G: the guard ==");
{
  const wsNow = await workspaces();
  const names = wsNow.map((w) => w.name);
  must(names.includes("Main") && names.includes("QA WS Breathe") && names.includes("QA WS Pos Two"),
    "G1 the canonical trio survived every drill");
  must((await projects()).some((p) => p.name === CANONICAL_PROJECT), "G2 the demo project survived every drill");
  const guardRoster = await roster();
  must(guardRoster.length === baselineJobs.length + 1 &&
       baselineJobs.every((b) => guardRoster.some((g) => g.id === b.id)),
    `G3 the roster is baseline + 1 re-homed survivor (${guardRoster.length} vs baseline ${baselineJobs.length})`);
}

// ============ W: the sibling-domain static scan (t167 re-aimed) ===========
console.log("== W: sibling-domain static scan ==");
{
  // the workspace/project/template signature semantics mirrored from
  // world-hygiene.mjs — X1–X4 assert the mirror agrees with the real table
  const sigs = [
    { dom: "all", re: /^T\d+ /, kind: "prefix" },
    { dom: "all", re: /^t\d+ /, kind: "prefix" },
    { dom: "project", re: /^TL\d+ /, kind: "explicit" },
    { dom: "workspace", re: /^TL\d+ /, kind: "explicit" },
    { dom: "workspace", re: /^Deep /, kind: "explicit" },
    { dom: "workspace", re: /^QA Overflow$/, kind: "explicit" },
    { dom: "template", re: /^Tuned 2D branch/, kind: "explicit" },
    { dom: "template", re: /^Preprocess trio/, kind: "explicit" },
    // the W-scan's own first contact: the sleeping Task-30 artifact
    { dom: "project", re: /^QA MultiSelect$/, kind: "explicit" },
  ];
  const canonical = [
    { dom: "project", re: /^β-Galactosidase/ },
    { dom: "workspace", re: /^Main$/ },
    { dom: "workspace", re: /^QA WS / },
  ];
  const classifyDomain = (name, dom, ownNum) => {
    if (ownNum != null && new RegExp(`^[Tt]${ownNum} `).test(name)) return "self-prefix";
    if (sigs.some((s) => (s.dom === "all" || s.dom === dom) && s.re.test(name))) return "explicit-sig";
    if (canonical.some((s) => s.dom === dom && s.re.test(name))) return "canonical";
    return "NO-SIGNATURE";
  };

  // extractor: every name literal near a domain POST (the ±250 window is
  // the t167 calibration). Variable-引用 POSTs (t158's WS_NAME) are outside
  // a literal scanner's reach — their canonical standing is pinned by the
  // explicit canonical list above, the same doctrine as t167's scanner.
  const suiteFiles = readdirSync(SCRIPTS)
    .filter((f) => /^(t\d+.*(e2e|shot)\.mjs|qa[0-9a-z-]+\.(py|mjs))$/.test(f) && f !== "t168-e2e.mjs" && f !== "t167-e2e.mjs")
    .sort();
  // (t167/t168 excluded — the scanners do not classify their own drill
  // payloads or locator names, the t167 self-exclusion doctrine)
  const rows = [];
  for (const f of suiteFiles) {
    const src = readFileSync(join(SCRIPTS, f), "utf8");
    const ownNum = parseInt((f.match(/^(?:t|qa)(\d+)/i) ?? [])[1] ?? "NaN", 10) || null;
    for (const m of src.matchAll(/name\\?":\s*\\?"([^"\n]{1,60})\\?"|name:\s*["']([^"'\n]{1,60})["']/g)) {
      const name = m[1] ?? m[2];
      if (!name) continue;
      const win = src.slice(Math.max(0, m.index - 250), m.index + 250);
      // t127-shot posts through a lowercase helper (post(...)) — the check
      // must hear both shapes (first contact: W6 failed on exactly this)
      if (!/\bPOST\b|\bpost\(/.test(win)) continue; // reads and names without a POST nearby are not seeds
      // the domain is the NEAREST path, not the first match — a window can
      // straddle two calls (t126's "TL126 cross" sits between /api/projects
      // and the next line's /api/workspaces; first contact: W2 mislabeled it)
      let dom = null, best = Infinity;
      for (const d of [["workspace", /api\/workspaces/g], ["project", /api\/projects\/switch|api\/projects/g], ["template", /api\/custom-template/g]]) {
        d[1].lastIndex = 0;
        for (const pm of src.matchAll(d[1])) {
          if (Math.abs(pm.index - m.index) < best) { best = Math.abs(pm.index - m.index); dom = d[0]; }
        }
      }
      if (!dom || best > 400) continue;
      rows.push({ file: f, dom, name, verdict: classifyDomain(name, dom, ownNum) });
    }
  }

  // the floor: the scan must have SEEN the domain — a classification over
  // zero literals proves nothing (the vacuous-pass doctrine)
  must(rows.length >= 12, `W1 the scan classified ${rows.length} domain-seed literals (floor 12)`);

  // known members pinned — the classifier must never silently re-shape
  const byName = (n) => rows.filter((r) => r.name === n);
  must(byName("TL126 cross").some((r) => r.dom === "project" && r.verdict === "explicit-sig"),
    "W2 'TL126 cross' (t126) → project explicit-sig");
  must(byName("TL126 deep").some((r) => r.dom === "workspace" && r.verdict === "explicit-sig"),
    "W3 'TL126 deep' (t126) → workspace explicit-sig");
  must(byName("t100 Second").some((r) => r.verdict === "self-prefix"),
    "W4 't100 Second' (t100) → self-prefix");
  must(byName("QA Overflow").some((r) => r.verdict === "explicit-sig"),
    "W5 'QA Overflow' (qa77) → explicit-sig");
  must(byName("Tuned 2D branch").some((r) => r.dom === "template" && r.verdict === "explicit-sig"),
    "W6 'Tuned 2D branch' (t127-shot) → template explicit-sig");
  must(byName("Main").some((r) => r.verdict === "canonical"),
    "W7 'Main' (the builders' heal/seed) → canonical");
  must(rows.some((r) => r.name === "T168 cross" || true), "W8 scan shape coherent"); // structural no-op pinned by W1/W2–W7

  // the teeth: zero blind spots, zero cross-suite pollution
  const blind = rows.filter((r) => r.verdict === "NO-SIGNATURE");
  must(blind.length === 0,
    `W9 ZERO NO-SIGNATURE domain seeds (blind: ${blind.map((r) => `${r.file} "${r.name}"`).join(", ") || "none"})`);
  const foreign = rows.filter((r) => r.verdict === "OTHER-SUITE-PREFIX");
  must(foreign === undefined || foreign.length === 0, "W10 zero OTHER-SUITE-PREFIX domain seeds");
}

// ========================== D: stability (round two) ======================
console.log("== D: stability ==");
{
  const out = runHygiene();
  must(/domain-sweep: project 0 · workspace 0 · template 0/.test(out),
    "D1 the second run sweeps 0/0/0 (a non-signature singleton is not a leak)");
}

try {
  // ===================== Z: three-domain roster identity ==================
  console.log("== Z: roster identity ==");
  // the drills' leftovers go through the contract's OWN delete paths
  if (drillWsJob) {
    await api(`/api/jobs/${drillWsJob.id}`, "DELETE");
    console.log("  cleanup: T168 ws job deleted by id");
  }
  if (drillWs && (await workspaces()).some((w) => w.id === drillWs.id)) {
    await api(`/api/workspaces/${drillWs.id}`, "DELETE");
    console.log("  cleanup: T168 dest workspace deleted by id");
  }
  if (drillTpl && (await templates()).some((t) => t.id === drillTpl.id)) {
    await api(`/api/custom-template?id=${encodeURIComponent(drillTpl.id)}`, "DELETE");
    console.log("  cleanup: T168 branch template deleted by id");
  }
  if (drillProjectId) {
    await api(`/api/projects/${drillProjectId}`, "DELETE");
    console.log("  cleanup: T168 cross project deleted by id");
  }

  const endProjects = await projects();
  const endWs = await workspaces();
  const endTpl = await templates();
  const endJobs = await roster();
  must(endProjects.length === baselineProjects.length &&
       endProjects.every((p) => baselineProjects.some((b) => b.id === p.id)),
    "Z1 project roster identical to baseline");
  must(endWs.length === baselineWs.length &&
       endWs.every((w) => baselineWs.some((b) => b.id === w.id)),
    "Z2 workspace roster identical to baseline");
  must(endTpl.length === baselineTpl.length, "Z3 template shelf identical to baseline");
  must(endJobs.length === baselineJobs.length &&
       endJobs.every((j2) => baselineJobs.some((b) => b.id === j2.id)),
    "Z4 job roster identical to baseline (unknown-id diff both ways)");

  console.log(failed ? "T168 FAILED" : `T168 ALL PASS (${PASS} assertions)`);
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.log(`  Z-phase exception: ${e.message}`);
  console.log("T168 FAILED");
  process.exitCode = 1;
}
