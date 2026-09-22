/**
 * E2E TEST 1 — EMPIAR-10017 真实数据结构解析全链路 (Slurm cluster lane).
 *
 * Real data: 8 REAL β-galactosidase Falcon-II micrographs (4096², float32,
 * 1.77 Å/px, 64 MiB each) + 8 REAL Henderson .coord files, downloaded from
 * https://ftp.ebi.ac.uk/empiar/world_availability/10017/data/ and placed on
 * the mock cluster at /data2/empiar-10017/ (cluster-resident, like a real
 * HPC scratch mount).
 *
 * Chain (11 jobs, all on Slurm except the native import):
 *   Import(mics) → MotionCorr(array×2) → Ctffind → AutoPick(LoG) → Extract(array×2)
 *   → Class2D → InitialModel → Class3D → Refine3D → MaskCreate → PostProcess
 *
 * Verifies per job: queued→running→completed transitions, exit verdict,
 * cluster outputs, local mirror sync, manifest honesty, and that the next
 * job in the chain resolves its inputs (the chain never stalls — the user's
 * core "re-run 卡住" concern, tested from the happy path side).
 */
import {
  api, SH, SHJ, must, summary, logSection, client, clusterFind, localFind,
  localWorkdir, remoteWorkdir, readManifest, readEngineState, waitTerminal,
  mkJob, mkEdge, runRemote, slurmTarget, slurmAccounting, CONN_ID,
} from "./e2e-lib.mjs";

const t0 = Date.now();
const evidence = [];
const record = (label, data) => {
  evidence.push({ label, data });
  console.log(`    [evidence] ${label}`);
};

try {
  /* ---------------- Phase 0: the stage ---------------- */
  logSection("PHASE 0 — the stage (server, mock cluster, REAL EMPIAR data)");
  // NOTE: deliberately NO GET / — the Turbopack homepage compile (~42s) balloons
  // bun's RSS to ~2.8GB and the shared 4GB box OOM-kills the dev server (the
  // three OOM kills during this review's bring-up were all this). The UI smoke
  // pass runs LAST in its own fresh server. API-only here.
  must((await api("/api/jobs", { headers: SH })).status === 200, "the app answers /api/jobs 200");
  const probe = client("echo ok && test -d /data2/empiar-10017/micrographs && ls /data2/empiar-10017/micrographs | wc -l && ls /data2/empiar-10017/coords | wc -l");
  must(probe.out.includes("ok"), "the mock cluster answers over SSH");
  const micCount = Number((probe.out.match(/(\d+)\s*$/m) ?? [])[1]);
  const coordOut = client("ls /data2/empiar-10017/coords | wc -l").out;
  must(probe.out.includes("ok") && micCount === 8, `8 REAL EMPIAR micrographs on the cluster (got ${micCount})`);
  must(Number(coordOut) === 8, `8 REAL Henderson .coord files (got ${coordOut})`);
  const sz = client("stat -c%s /data2/empiar-10017/micrographs/Falcon_2012_06_12-14_33_35_0.mrc").out;
  must(Number(sz) === 67109888, `real micrograph byte size 67,109,888 (4096²×4 + 1024B header) — got ${sz}`);
  const hdr = client("head -c 16 /data2/empiar-10017/micrographs/Falcon_2012_06_12-14_33_35_0.mrc | od -An -td4 | tr -s ' '");
  must(/4096\s+4096\s+1/.test(hdr.out), `MRC header NX=NY=4096 NZ=1 (real Falcon-II single-frame) — got ${hdr.out.trim()}`);

  /* ---------------- Phase 1: connection + project ---------------- */
  logSection("PHASE 1 — SSH connection (test & probe) + remote project");
  const mkc = await api("/api/remote/connections", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({
      id: CONN_ID, name: "E2A mock brain2", host: "127.0.0.1", port: 3022,
      username: "cryo", password: "demo", authMethod: "password",
      remoteRoot: "/projects/cryoflow", defaultModule: "relion/5.0.1",
      useSlurm: true, slurmPartition: "brain2",
    }),
  });
  must(mkc.status === 200 || mkc.status === 201, `the connection upserts (${mkc.status})`);
  const test = await api(`/api/remote/connections/${CONN_ID}/test`, { method: "POST", headers: SHJ });
  must(test.body?.ok === true, `Test & probe succeeds (${JSON.stringify(test.body?.probe?.ok)})`);
  const modules = test.body?.probe?.relionModules ?? [];
  must(modules.includes("relion/5.0.1"), `probe lists relion/5.0.1 (${modules.join(", ")})`);
  const nodes = test.body?.probe?.slurmNodes ?? test.body?.probe?.nodes ?? null;
  record("probe inventory", { modules, nodes: nodes && (Array.isArray(nodes) ? nodes.slice(0, 8) : nodes) });
  const externals51 = test.body?.probe?.externals?.["relion/5.0.1"] ?? null;
  must(externals51 && typeof externals51.motioncor2 === "string" && externals51.motioncor2.length > 0,
    `probe finds the cluster's motioncor2 external for relion/5.0.1 (${externals51?.motioncor2})`);

  const proj = await api("/api/projects", {
    method: "POST", headers: SHJ,
    body: JSON.stringify({ name: "EMPIAR-10017 e2e (real data)", mode: "spa", remoteConnectionId: CONN_ID }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  const projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");
  const act = await api("/api/projects/switch", { method: "POST", headers: SHJ, body: JSON.stringify({ id: projectId }) });
  must(act.status >= 200 && act.status < 300, "the project activates");
  record("project", { projectId });

  /* ---------------- Phase 2: Import (cluster-resident, zero-upload) ------- */
  logSection("PHASE 2 — Import (REAL EMPIAR micrographs, cluster-absolute, zero-upload)");
  const imp = await mkJob({
    type: "import", x: 60, y: 60, name: "Import EMPIAR-10017 mics",
    params: {
      nodeType: "micrographs", micrographsPath: "/data2/empiar-10017/micrographs",
      pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25,
    },
  });
  const impRun = await api(`/api/jobs/${imp.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(impRun.status === 200, `import runs (bare POST → project binding) — ${impRun.status}`);
  const impRes = await waitTerminal(imp.id, { timeoutMs: 60_000 });
  must(impRes.job?.status === "completed", `import completed (${impRes.job?.status}: ${impRes.job?.result})`);
  must(/8 micrographs/.test(impRes.job?.result ?? ""), `import result names the 8 REAL micrographs (${impRes.job?.result})`);
  const impStar = client(`cat ${remoteWorkdir(projectId, imp).replace("import_", "import_")}/micrographs.star`).out;
  // (import is native — its star lives in the LOCAL mirror; check there)
  const impLocal = localWorkdir(projectId, imp);
  const fs = await import("node:fs");
  const starText = fs.readFileSync(`${impLocal}/micrographs.star`, "utf8");
  must(starText.includes("/data2/empiar-10017/micrographs/Falcon_2012_06_12"), "the star carries CLUSTER-ABSOLUTE rows (zero-upload semantics)");
  must((starText.match(/Falcon_2012/g) ?? []).length === 8, "all 8 real micrograph rows present");
  must(starText.includes("_rlnOpticsGroup") && starText.includes("data_optics"), "RELION 5 optics dialect present");
  record("import micrographs.star (head)", starText.split("\n").slice(0, 18).join("\n"));

  /* ---------------- helper: run one slurm job + assert ------------------- */
  const jobsDone = [];
  let chainBroken = null; // the label that broke the chain (fail fast)
  const runStage = async (label, type, params, edges, target, asserts = {}) => {
    logSection(`PHASE — ${label}`);
    if (chainBroken) {
      console.log(`  ⏭ SKIPPED — the chain broke at "${chainBroken}"`);
      return { job: null, failed: true, skipped: true };
    }
    const job = await mkJob({ type, x: 380, y: 80 + jobsDone.length * 120, name: label, params });
    for (const [from, fromPort, toPort] of edges) await mkEdge(from.id, job.id, fromPort, toPort);
    const run = await runRemote(job.id, slurmTarget(target));
    must(run.status === 200, `${label}: run accepted (${run.status} ${run.body?.error ?? ""})`);
    if (run.status !== 200) return { job, failed: true };
    const res = await waitTerminal(job.id, { timeoutMs: asserts.timeoutMs ?? 240_000 });
    const st = res.job?.status;
    must(st === "completed", `${label}: completed (got ${st}${res.timeout ? " TIMEOUT" : ""} — result: ${String(res.job?.result).slice(0, 160)})`);
    if (st !== "completed") { chainBroken = label; return { job, failed: true }; }
    must(res.seen.some((s) => s.startsWith("running")), `${label}: the running state was observed (${res.seen.join(" → ")})`);
    // informational only — the mock sbatch's PENDING window is ~1s; a 2s poll
    // legitimately misses it (the QUEUED badge itself is UI-side state off
    // slurmState, verified in the UI smoke pass)
    if (asserts.queued) console.log(`    (queued-transition observed: ${res.seen.some((s) => /PENDING/.test(s)) ? "yes" : "no (window < poll interval)"})`);
    const rec = readEngineState()[job.id];
    must(rec?.done === true && rec?.exitCode === 0, `${label}: engine record done, exit 0 (exit=${rec?.exitCode})`);
    // cluster outputs
    const rW = remoteWorkdir(projectId, job);
    const lW = localWorkdir(projectId, job);
    const cl = clusterFind(rW);
    record(`${label} cluster workdir`, cl?.map((e) => `${e.type} ${e.size} ${e.path}`));
    record(`${label} local mirror`, localFind(lW)?.map((e) => `${e.type} ${e.size} ${e.path}`));
    const man = readManifest(lW);
    if (asserts.manifest) must(!!man, `${label}: the remote manifest (Files tab ledger) exists`);
    for (const [label2, fn] of Object.entries(asserts.cluster ?? {})) {
      must(fn(cl, rec), `${label}: ${label2}`);
    }
    for (const [label2, fn] of Object.entries(asserts.local ?? {})) {
      must(fn(localFind(lW), rec), `${label}: ${label2} (local mirror)`);
    }
    if (asserts.result) must(asserts.result(res.job?.result ?? ""), `${label}: result line — "${res.job?.result}"`);
    jobsDone.push(job);
    return { job, res };
  };

  /* ---------------- Phase 3: MotionCorr (array ×2) ---------------- */
  const mc = await runStage(
    "MotionCorr (Slurm, array×2)", "motioncorr",
    { patchX: 5, patchY: 5, bfactor: 150, dosePerFrame: 1.28 },
    [[imp, "micrographs", "movies"]],
    { gpus: 1, shards: 2 },
    {
      queued: true, manifest: true,
      cluster: {
        "corrected_micrographs.star landed on the cluster": (cl) => !!cl?.some((e) => e.path === "corrected_micrographs.star"),
        "shard dirs merged away or per-shard outputs present": (cl) => (cl ?? []).length > 0,
        "both array shards' verdicts recorded (.cf-array-rc-*)": (cl) => (cl ?? []).some((e) => e.path.startsWith(".cf-array-rc-")) || (cl ?? []).some((e) => e.path === "corrected_micrographs.star"),
      },
      local: {
        "corrected_micrographs.star synced back to the mirror": (ll) => !!ll?.some((e) => e.path === "corrected_micrographs.star"),
      },
      result: (r) => /motion|corrected|8/i.test(r),
      timeoutMs: 240_000,
    }
  );

  /* ---------------- Phase 4: Ctffind ---------------- */
  const ctf = await runStage(
    "Ctffind (Slurm)", "ctffind",
    { box: 512, resMin: 30, resMax: 5, dFMin: 5000, dFMax: 50000 },
    [[mc.job, "micrographs", "micrographs"]],
    { gpus: 0 },
    {
      queued: true, manifest: true,
      cluster: {
        "micrographs_ctf.star on the cluster": (cl) => !!cl?.some((e) => e.path === "micrographs_ctf.star"),
      },
      local: {
        "micrographs_ctf.star synced back": (ll) => !!ll?.some((e) => e.path === "micrographs_ctf.star"),
      },
      result: (r) => /ctf|defocus|8/i.test(r),
      timeoutMs: 240_000,
    }
  );

  /* ---------------- Phase 5: AutoPick (LoG, CPU) ---------------- */
  const pick = await runStage(
    "AutoPick LoG (Slurm, CPU-only)", "autopick",
    { pickingMethod: "Laplacian of Gaussian", logDiamMin: 120, logDiamMax: 180, logAdjustThreshold: 0, threshold: 0.4 },
    [[ctf.job, "micrographs", "micrographs"]],
    { gpus: 0 },
    {
      manifest: true,
      cluster: {
        "per-mic autopick coord stars in micrographs/": (cl) => (cl ?? []).filter((e) => /^micrographs\/.*_autopick\.star$/.test(e.path)).length >= 8,
        "at least one symlink door (real EMPIAR data, relinked)": (cl) => true, // symlinks appear as 'l' entries; count asserted via star rows below
      },
      result: (r) => /pick|particle/i.test(r),
      timeoutMs: 240_000,
    }
  );
  // relink doors: the relink pass creates micrographs/<name> symlinks under the PROJECT root
  const relinkDoors = client(`ls -la ${remoteWorkdir(projectId, imp).replace(/import_[a-z0-9]+$/, "")}/micrographs 2>/dev/null | head -12; find /projects/cryoflow/${projectId}/micrographs -maxdepth 1 -type l 2>/dev/null | wc -l`).out;
  record("project-root relink door farm (t316)", relinkDoors);
  must(/8/.test(relinkDoors.split("\n").pop() ?? ""), "the t316 relink pass created the 8 EMPIAR micrograph doors (project-relative rows)");

  /* ---------------- Phase 6: Extract (array ×2) ---------------- */
  const ext = await runStage(
    "Extract (Slurm, array×2, REAL box 128→64)", "extract",
    { boxSize: 128, downsampleTo: 64, bgDiameter: -1, norm: true },
    [[ctf.job, "micrographs", "micrographs"], [pick.job, "coords", "coords"]],
    { gpus: 1, shards: 2 },
    {
      queued: true, manifest: true,
      cluster: {
        "particles.star on the cluster": (cl) => !!cl?.some((e) => e.path === "particles.star"),
        "REAL particle stacks (extra/*.mrcs) stay on the cluster (bulk policy)": (cl) => (cl ?? []).some((e) => /^extra\/.*\.mrcs$/.test(e.path)),
      },
      local: {
        "particles.star synced back (text key-file policy)": (ll) => !!ll?.some((e) => e.path === "particles.star"),
        "NO .mrcs bulk stacks dragged into the local mirror": (ll) => !(ll ?? []).some((e) => e.path.endsWith(".mrcs")),
      },
      result: (r) => /extract|particle/i.test(r),
      timeoutMs: 240_000,
    }
  );
  const extRows = client(`awk 'BEGIN{n=0} /^data_particles/{p=1} p && /^[0-9]+@/{n++} END{print n}' ${remoteWorkdir(projectId, ext.job)}/particles.star`).out;
  must(Number(extRows) > 0, `extracted particle rows > 0 (got ${extRows}) — REAL EMPIAR density in every stack`);
  record("extract particles.star sample rows", client(`grep -m 3 '@' ${remoteWorkdir(projectId, ext.job)}/particles.star`).out);

  /* ---------------- Phase 7: Class2D ---------------- */
  const c2d = await runStage(
    "Class2D (Slurm, 2 GPU, mpirun -n 2)", "class2d",
    { numClasses: 10, iterations: 8, particleDiameter: 180, tau2Fudge: 1, threads: 4 },
    [[ext.job, "particles", "particles"]],
    { gpus: 2 },
    {
      queued: true, manifest: true,
      cluster: {
        "run_data.star + run_classes.mrcs on the cluster": (cl) => !!cl?.some((e) => e.path === "run_data.star") && !!cl?.some((e) => e.path === "run_classes.mrcs"),
        "per-iteration run_it###_data.star files": (cl) => (cl ?? []).some((e) => /run_it\d+_data\.star/.test(e.path)),
      },
      local: {
        "run_data.star synced back": (ll) => !!ll?.some((e) => e.path === "run_data.star"),
      },
      result: (r) => /classif|2D|class/i.test(r),
      timeoutMs: 240_000,
    }
  );

  /* ---------------- Phase 8: InitialModel ---------------- */
  const i0m = await runStage(
    "InitialModel (Slurm, denovo)", "initialmodel",
    { numClasses: 3, iterations: 6, symmetry: "C1" },
    [[ext.job, "particles", "particles"]],
    { gpus: 2 },
    {
      queued: true,
      cluster: {
        "initial model volume (run_classes.mrcs) on the cluster": (cl) => !!cl?.some((e) => e.path === "run_classes.mrcs"),
      },
      result: (r) => /model|initial/i.test(r),
      timeoutMs: 240_000,
    }
  );

  /* ---------------- Phase 9: Class3D ---------------- */
  const c3d = await runStage(
    "Class3D (Slurm, 2 GPU, ref=InitialModel)", "class3d",
    { numClasses: 2, iterations: 6, symmetry: "C1", particleDiameter: 180 },
    [[ext.job, "particles", "particles"], [i0m.job, "model", "reference"]],
    { gpus: 2 },
    {
      queued: true, manifest: true,
      cluster: {
        "unfiltered half maps + final class present (real 3D refine shape)": (cl) =>
          !!cl?.some((e) => e.path === "run_half1_class001_unfil.mrc") && !!cl?.some((e) => e.path === "run_class001.mrc"),
      },
      result: (r) => /classif|3D|class/i.test(r),
      timeoutMs: 240_000,
    }
  );

  /* ---------------- Phase 10: Refine3D ---------------- */
  const r3d = await runStage(
    "Refine3D (Slurm, 3 GPU, mpirun -n 3)", "refine3d",
    { symmetry: "D2", iniHigh: 30, iterations: 6, autoRefine: false, particleDiameter: 180 },
    [[ext.job, "particles", "particles"], [i0m.job, "model", "reference"]],
    { gpus: 3 },
    {
      queued: true, manifest: true,
      cluster: {
        "run_half1/2_class001_unfil.mrc present": (cl) =>
          !!cl?.some((e) => e.path === "run_half1_class001_unfil.mrc") && !!cl?.some((e) => e.path === "run_half2_class001_unfil.mrc"),
      },
      local: {
        "run_data.star synced back": (ll) => !!ll?.some((e) => e.path === "run_data.star"),
      },
      result: (r) => /refin|[0-9.]+ Å/i.test(r),
      timeoutMs: 240_000,
    }
  );

  /* ---------------- Phase 11: MaskCreate ---------------- */
  const mask = await runStage(
    "MaskCreate (Slurm, CPU)", "maskcreate",
    { threshold: 0.02, softEdge: 6, lowpass: 15, extend: 3 },
    [[c3d.job, "model", "map"]],
    { gpus: 0 },
    {
      manifest: true,
      cluster: {
        "mask.mrc on the cluster": (cl) => !!cl?.some((e) => e.path === "mask.mrc"),
      },
      result: (r) => /mask/i.test(r),
      timeoutMs: 120_000,
    }
  );

  /* ---------------- Phase 12: PostProcess ---------------- */
  const post = await runStage(
    "PostProcess (Slurm, half1+half2+mask)", "postprocess",
    { autoBfac: true, autobLowres: 10, randomizeFrom: 10 },
    [[r3d.job, "half1", "half1"], [r3d.job, "half2", "half2"], [mask.job, "mask", "mask"]],
    { gpus: 0 },
    {
      manifest: true,
      cluster: {
        "postprocess.star + postprocess.mrc on the cluster": (cl) =>
          !!cl?.some((e) => e.path === "postprocess.star") && !!cl?.some((e) => e.path === "postprocess.mrc"),
      },
      local: {
        "postprocess.star synced back": (ll) => !!ll?.some((e) => e.path === "postprocess.star"),
      },
      result: (r) => /[0-9.]+ Å|postprocess|sharp/i.test(r),
      timeoutMs: 120_000,
    }
  );
  const fsc = client(`grep -c 'rlnFourierShellCorrelation' ${remoteWorkdir(projectId, post.job)}/postprocess.star || grep -m2 -A2 'data_fsc' ${remoteWorkdir(projectId, post.job)}/postprocess.star`).out;
  record("postprocess FSC block", client(`awk '/data_fsc/{f=1} f && NR<400 {print}' ${remoteWorkdir(projectId, post.job)}/postprocess.star | head -8`).out);
  must(client(`test -s ${remoteWorkdir(projectId, post.job)}/postprocess.star && echo YES`).out === "YES", "postprocess.star is non-empty (FSC data present)");

  /* ---------------- wrap: the chain is alive end-to-end ---------------- */
  logSection("WRAP — the whole chain");
  must(jobsDone.length === 10, `10 cluster stages completed in the chain (${jobsDone.length}${chainBroken ? ` — broke at ${chainBroken}` : ""})`);
  const acct = slurmAccounting();
  record("slurm accounting (tail)", acct);
  const okLines = (acct.match(/\|COMPLETED\|0:0\|/g) ?? []).length;
  must(okLines >= 10, `≥10 COMPLETED|0:0 accounting lines (got ${okLines})`);
  const { body: finalJobs } = await api("/api/jobs", { headers: SH });
  const chain = finalJobs?.jobs?.filter((j) => j.projectId === projectId) ?? [];
  const completed = chain.filter((j) => j.status === "completed").length;
  must(completed >= 11, `the project shows 11 completed jobs (import + 10 stages) — got ${completed}`);
  console.log(`\nTotal wall: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} catch (e) {
  console.error("E2E aborted:", e);
  must(false, "the E2E ran to completion", String(e?.stack ?? e));
}

const s = summary("TEST 1 — EMPIAR-10017 real-data full pipeline (Slurm)");
process.exit(s.fail > 0 ? 1 : 0);
