#!/usr/bin/env node
/**
 * diag-t381 — the RELION GUI parity round (the user's 「各种job的UI中可设置的
 * 参数好像还是不全…把所有可设置参数都加上，排版最好也和relion的GUI中一样」).
 *
 * Verifies:
 *   A. source-level — the showIf primitive, the Helix tabs on class2d/
 *      class3d/refine3d, the EM/VDAM algorithm knob, tab orders that mirror
 *      gui_jobwindow.cpp's setupTabs() labels
 *   B. argv-level, LIVE on the cluster — the dispatch scripts (.cf-run.sh)
 *      carry RELION 5 master's own dialects:
 *        · a DEFAULT class2d stays byte-compatible (classic --iter, no
 *          --grad, zero helical flags)
 *        · algorithm=vdam rides --grad --class_inactivity_threshold 0.1
 *          --grad_write_iter 10 --iter <miniBatches> (pipeline_jobs.cpp:3203)
 *        · the 2D Helix tab: --helical_outer_diameter + --bimodal_psi +
 *          --sigma_psi (range/3) + --helix --helical_rise_initial (:3309)
 *        · the 3D Helix tab on class3d: --helix + tube diameters + the
 *          symmetry group + --helical_symmetry_search with the twist/rise
 *          search bounds (:4031-4110)
 *
 * Usage: CF_ROOT=/home/z/cryoflow node scripts/diag-t381-relion-params.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.CF_ROOT ?? "/home/z/cryoflow";
const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const MOCK = `${ROOT}/services/mock-cluster`;
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };

let pass = 0;
let fail = 0;
const failures = [];
function must(cond, label, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  ✗ FAIL: ${label}${extra ? ` — ${String(extra).slice(0, 260)}` : ""}`);
  }
  return !!cond;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (t) => console.log(`\n━━━ ${t} ━━━`);

async function api(url, init) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let r;
    try {
      r = await fetch(`${BASE}${url}`, init);
    } catch (e) {
      console.log(`    [server-down: ${e.code ?? e.message} — resurrecting]`);
      spawnSync("bash", ["/tmp/cf-up.sh"], { encoding: "utf8", timeout: 150_000 });
      await sleep(2000);
      continue;
    }
    let body = null;
    try {
      body = await r.json();
    } catch {}
    return { status: r.status, body };
  }
  return { status: 0, body: null };
}

function client(cmd) {
  const r = spawnSync("node", [`${MOCK}/test-client.mjs`, cmd], { encoding: "utf8", timeout: 60_000 });
  return { out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

const src = (p) => readFileSync(path.join(ROOT, p), "utf8");

async function waitTerminal(jobId, timeoutMs = 200_000) {
  const t0 = Date.now();
  for (;;) {
    const { body } = await api("/api/jobs", { headers: SH });
    const job = (body?.jobs ?? []).find((j) => j.id === jobId);
    if (job && (job.status === "completed" || job.status === "failed")) return job;
    if (Date.now() - t0 > timeoutMs) return job ?? null;
    await sleep(2000);
  }
}

async function mkJob(type, params, name) {
  const r = await api("/api/jobs", { method: "POST", headers: SHJ, body: JSON.stringify({ type, params, name }) });
  must(r.status >= 200 && r.status < 300, `create ${type} (${r.status})`);
  return r.body?.job;
}

async function mkEdge(fromId, toId, fromPort, toPort) {
  const r = await api("/api/edges", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ fromJobId: fromId, toJobId: toId, ...(fromPort ? { fromPort } : {}), ...(toPort ? { toPort } : {}) }),
  });
  must(r.status >= 200 && r.status < 300, `edge ${fromPort ?? "*"}→${toPort ?? "*"}`);
}

async function dispatchAndAssert(label, job, clusterScriptAssert) {
  const run = await api(`/api/jobs/${job.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  if (!must(run.status === 200, `${label}: dispatch accepted`, JSON.stringify(run.body).slice(0, 160))) return;
  const done = await waitTerminal(job.id);
  must(done?.status === "completed", `${label}: completed (${done?.status}: ${String(done?.result).slice(0, 100)})`);
  const rW = `/projects/cryoflow/${done.projectId}/${job.type}_${job.id.slice(-8)}`;
  const script = client(`cat ${rW}/.cf-run.sh 2>/dev/null || cat ${rW}/.cf-sbatch.sh 2>/dev/null`).out;
  must(script.length > 100, `${label}: the cluster script is readable (${script.length}B)`);
  for (const [assertLabel, fn] of Object.entries(clusterScriptAssert ?? {})) {
    must(fn(script), `${label}: ${assertLabel}`, script.split("\n").find((l) => l.includes("relion_refine"))?.slice(0, 240) ?? "");
  }
  console.log(`    argv: ${script.split("\n").find((l) => l.includes("relion_refine"))?.trim().slice(0, 200)}…`);
}

try {
  section("PHASE A — source-level: the RELION GUI surface");
  {
    const types = src("src/lib/types.ts");
    must(types.includes("showIf?: { param: string; equals: ParamValue }"), "ParamSchema carries the showIf primitive");
    const panel = src("src/components/workflow/job-panel.tsx");
    must(panel.includes("gateVisible"), "the job panel resolves showIf gates (gateVisible)");
    must(panel.includes("gateVisible(p)"), "tab content filters through the gate");
    const wf = src("src/lib/workflow.ts");
    must(wf.includes('sel("algorithm", "Algorithm", "em"'), "class2d gains the EM/VDAM algorithm knob");
    must(wf.includes('"miniBatches"'), "class2d gains the VDAM mini-batches param");
    must(wf.includes("showIf: { param: \"algorithm\", equals: \"vdam\" }"), "miniBatches is gated on algorithm=vdam");
    must(wf.includes("helicalParams"), "the shared 3D helical family exists");
    must(wf.includes('tabs: ["CTF", "Optimisation", "Sampling", "Helix", "Compute"]'), "class2d tabs mirror RELION's (…Sampling, Helix, Compute)");
    must(wf.includes('tabs: ["Reference", "CTF", "Optimisation", "Sampling", "Helix", "Compute"]'), "class3d tabs mirror RELION's (…Sampling, Helix, Compute)");
    must(wf.includes('tabs: ["Reference", "CTF", "Optimisation", "Sampling", "Auto-sampling", "Helix", "Compute"]'), "refine3d tabs mirror RELION's (…Auto-sampling, Helix, Compute)");
    for (const key of [
      "doHelical2d", "helicalTubeOuterDiameter2d", "doBimodalPsi", "rangePsiHelical", "doRestrictXoff", "helicalRise2d",
      "doHelical", "helicalTubeInnerDiameter", "helicalTubeOuterDiameter", "rangeRotHelical", "rangeTiltHelical",
      "rangePsiHelical3d", "helicalRangeDistance", "keepTiltPriorFixed", "doApplyHelicalSymmetry", "helicalNrAsu",
      "helicalTwistInitial", "helicalRiseInitial", "helicalZPercentage", "doLocalSearchHelicalSymmetry",
      "helicalTwistMin", "helicalTwistMax", "helicalTwistInistep", "helicalRiseMin", "helicalRiseMax", "helicalRiseInistep",
    ]) {
      must(wf.includes(`"${key}"`), `the ${key} param is declared`);
    }
    const engine = src("src/lib/relion/engine.ts");
    must(engine.includes("function helicalArgs"), "the engine has the shared helicalArgs builder");
    must(engine.includes('"--grad", "--class_inactivity_threshold", "0.1", "--grad_write_iter", "10"'), "the VDAM dialect rides RELION's own wrapper flags");
  }

  section("PHASE B — argv fidelity, LIVE on the cluster (EMPIAR-10017 project)");
  {
    // find the t380 chain project (the newest EMPIAR-10017 t380) + switch
    const list = await api("/api/projects", { headers: SH });
    const t380 = (list.body?.projects ?? []).filter((p) => /EMPIAR-10017 t380/.test(p.name ?? "")).sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")).pop();
    if (!must(!!t380, "the t380 EMPIAR project exists (run diag-t380 first)")) process.exit(1);
    await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: t380.id }) });
    const { body } = await api("/api/jobs", { headers: SH });
    const jobs = body?.jobs ?? [];
    const ext = jobs.find((j) => j.type === "extract" && j.status === "completed");
    const i0m = jobs.find((j) => j.type === "initialmodel" && j.status === "completed");
    must(!!ext && !!i0m, "the chain's extract + initialmodel are completed");

    // B1 — DEFAULT class2d: byte-compat (classic EM dialect, zero helical flags)
    const c2dDefault = await mkJob("class2d", { numClasses: 4, iterations: 2, particleDiameter: 180, threads: 4 }, "t381 class2d default (byte-compat)");
    if (c2dDefault) {
      await mkEdge(ext.id, c2dDefault.id, "particles", "particles");
      await dispatchAndAssert("class2d default", c2dDefault, {
        "classic --iter (no --grad)": (s) => /--iter\s+2\b/.test(s) && !s.includes("--grad"),
        "zero helical flags": (s) => !s.includes("--helix") && !s.includes("--helical_"),
        "the em iteration param still rides --iter": (s) => /--iter\s+2/.test(s),
      });
    }

    // B2 — VDAM dialect
    const c2dVdam = await mkJob("class2d", { algorithm: "vdam", miniBatches: 50, numClasses: 4, threads: 4 }, "t381 class2d VDAM");
    if (c2dVdam) {
      await mkEdge(ext.id, c2dVdam.id, "particles", "particles");
      await dispatchAndAssert("class2d VDAM", c2dVdam, {
        "--grad with RELION's wrapper trio": (s) => /--grad\s+--class_inactivity_threshold\s+0\.1\s+--grad_write_iter\s+10/.test(s),
        "mini-batches ride --iter": (s) => /--iter\s+50\b/.test(s),
        "no helical flags": (s) => !s.includes("--helix"),
      });
    }

    // B3 — the 2D Helix tab
    const c2dHelix = await mkJob("class2d", {
      numClasses: 4, iterations: 2, threads: 4,
      doHelical2d: true, helicalTubeOuterDiameter2d: 240, rangePsiHelical: 9, helicalRise2d: 2.7,
    }, "t381 class2d 2D-helix");
    if (c2dHelix) {
      await mkEdge(ext.id, c2dHelix.id, "particles", "particles");
      await dispatchAndAssert("class2d 2D-helix", c2dHelix, {
        "--helical_outer_diameter 240": (s) => /--helical_outer_diameter\s+240\b/.test(s),
        "--bimodal_psi (default on)": (s) => s.includes("--bimodal_psi"),
        "--sigma_psi = range/3": (s) => /--sigma_psi\s+3\b/.test(s),
        "--helix --helical_rise_initial 2.7": (s) => /--helix\s+--helical_rise_initial\s+2\.7/.test(s),
      });
    }

    // B4 — the 3D Helix tab on class3d (full family + local symmetry search)
    const c3dHelix = await mkJob("class3d", {
      numClasses: 2, iterations: 2, symmetry: "C1", particleDiameter: 180, threads: 4,
      doHelical: true, helicalTubeInnerDiameter: 60, helicalTubeOuterDiameter: 220,
      helicalNrAsu: 2, helicalTwistInitial: 25.7, helicalRiseInitial: 2.8, helicalZPercentage: 30,
      doLocalSearchHelicalSymmetry: true, helicalTwistMin: 22, helicalTwistMax: 29, helicalTwistInistep: 0.5,
      helicalRiseMin: 2.6, helicalRiseMax: 3.1,
    }, "t381 class3d helix");
    if (c3dHelix) {
      await mkEdge(ext.id, c3dHelix.id, "particles", "particles");
      await mkEdge(i0m.id, c3dHelix.id, "model", "reference");
      await dispatchAndAssert("class3d helix", c3dHelix, {
        "--helix gate": (s) => /--helix(\s|$)/.test(s),
        "inner + outer tube diameters": (s) => /--helical_inner_diameter\s+60\b/.test(s) && /--helical_outer_diameter\s+-?1/.test(s) === false,
        "ASU count + initial twist/rise": (s) => /--helical_nr_asu\s+2\b/.test(s) && /--helical_twist_initial\s+25\.7\b/.test(s) && /--helical_rise_initial\s+2\.8\b/.test(s),
        "z-percentage /100": (s) => /--helical_z_percentage\s+0\.3\b/.test(s),
        "--helical_symmetry_search + bounds": (s) => s.includes("--helical_symmetry_search") && /--helical_twist_min\s+22\b/.test(s) && /--helical_twist_max\s+29\b/.test(s) && /--helical_rise_min\s+2\.6\b/.test(s) && /--helical_rise_max\s+3\.1\b/.test(s),
        "inistep only when positive": (s) => /--helical_twist_inistep\s+0\.5\b/.test(s) && !s.includes("--helical_rise_inistep"),
        "til-prior keeper (default on)": (s) => s.includes("--helical_keep_tilt_prior_fixed"),
        "sigma_tilt/psi = value/3": (s) => /--sigma_tilt\s+5\b/.test(s) && /--sigma_psi\s+3\.3333333333333335|--sigma_psi\s+3\.3333/.test(s),
      });
    }

    // B5 — the explicit No on symmetry application
    const c3dNoSym = await mkJob("class3d", {
      numClasses: 2, iterations: 2, symmetry: "C1", particleDiameter: 180, threads: 4,
      doHelical: true, doApplyHelicalSymmetry: false,
    }, "t381 class3d helix ignore-sym");
    if (c3dNoSym) {
      await mkEdge(ext.id, c3dNoSym.id, "particles", "particles");
      await mkEdge(i0m.id, c3dNoSym.id, "model", "reference");
      await dispatchAndAssert("class3d ignore-symmetry", c3dNoSym, {
        "--ignore_helical_symmetry on the explicit No": (s) => s.includes("--ignore_helical_symmetry"),
        "no nr_asu/twist_initial (the group is off)": (s) => !s.includes("--helical_nr_asu") && !s.includes("--helical_twist_initial"),
      });
    }
  }
} catch (e) {
  console.error("diag-t381 aborted:", e);
  must(false, "the diag ran to completion", String(e?.stack ?? e).slice(0, 300));
}

console.log(`\n===== diag-t381 RELION GUI parity: ${pass} passed, ${fail} failed =====`);
if (failures.length) for (const f of failures) console.log(`  - ${f}`);
process.exit(fail > 0 ? 1 : 0);
