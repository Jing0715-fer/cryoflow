#!/usr/bin/env node
/**
 * t326 diag — the run dialog's information architecture, verified twice.
 *
 * The user's ticket (post-t318 backlog, the newest of the four):
 *   「这个页面的ui再重新设计一下，目前感觉排版不是很合理和美观」
 *   — the "Run on cluster" dialog's layout felt neither organized nor
 *   pretty. The VLM critique of the before-screenshot agreed on every
 *   axis: a wall-of-text intro, six equal-weight rows with no grouping,
 *   the structural choice (direct vs slurm) buried in a dropdown, flag
 *   dialects squeezed into wrapping prose beside steppers, and an
 *   identity line compressed into middots.
 *
 * THE REDESIGN keeps every contract (the suites are contracts — t306's
 * array pins, t320's LoG pins, the aria grammar, the submit body) and
 * regroups the SAME knobs: job-identity header, sectioned form
 * (Cluster / Run mode / Slurm resources), run mode as two radio CARDS,
 * the Slurm knobs inside a panel that only exists in slurm mode, flags
 * as mono CHIPS on their own line, a submission PREVIEW rendering the
 * sbatch directives these knobs produce, and a lifecycle strip that
 * says in two lines what the old five-line paragraph buried.
 *
 * PHASES:
 *  A. CONTRACTS — every suite-pinned string still rides the source
 *     verbatim (t306's set + shards row + submit spread; t320's LoG
 *     predicate line + data-log-cpu-row + CPU dialect); the aria
 *     grammar survives (every label the browser flows use); the new
 *     structure hooks exist; the redesign doctrines hold (the intro is
 *     SHORT, the old prose forms are dead, the mode is a radiogroup,
 *     the preview's directives are built from the submit's own state).
 *  B. LIVE HONESTY — the preview is a promise the sbatch keeps: a
 *     motioncorr dispatched with the exact knob values the preview
 *     renders (slurm · brain2 · 3 GPUs · 4 shards) lands a .cf-sbatch.sh
 *     whose directives are the preview's own strings (--partition=brain2,
 *     --nodelist=brain2, --gres=gpu:3, --ntasks=3, --array=1-4%4,
 *     mpirun -n 3); a direct-lane dispatch writes NO scheduler script.
 *     The equivalence is the point: nothing the preview shows is a flag
 *     the dispatch would not write, and nothing it hides is one it would.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = "/home/z/cryoflow";
const BASE = "http://localhost:3001";
const CONN = "qa-t326";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3001",
};
const SHJ = { ...SH, "Content-Type": "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 800) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  }).stdout?.trim() ?? "";
const clientBoth = (cmd) => {
  const r = spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
  return `${r.stdout?.trim() ?? ""}${r.stderr?.trim() ? ` <<stderr>> ${r.stderr.trim()}` : ""}`.trim();
};

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const createdJobs = [];
let projectId = null;
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  if (b?.job?.projectId) projectId = b.job.projectId;
  return b?.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
  (
    await api("/api/edges", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    })
  ).status;

const dispatch = (id, body) =>
  api(`/api/jobs/${id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify(body) });

const awaitJobTerminal = async (id, deadlineMs) => {
  const done = await pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);
  return done;
};

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t326",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  const proj = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t326 dialog redesign", mode: "remote", remoteConnectionId: CONN }),
  });
  must(proj.status >= 200 && proj.status < 300, `the remote project creates (${proj.status})`);
  projectId = proj.body?.project?.id;
  must(!!projectId, "the project id rides the response");
  const projRoot = `/projects/cryoflow/${projectId}`;

  // ======================================================================
  console.log("== PHASE A: CONTRACTS — the pins survive, the doctrine holds ==");

  const ui = readFileSync(`${ROOT}/src/components/workflow/remote-run-button.tsx`, "utf8");

  // --- the t306 pins (the array split's own suite reads this source) ---
  must(
    ui.includes('new Set(["motioncorr", "ctffind", "extract", "autopick"])'),
    "t306 pin — the ARRAY_ELIGIBLE_TYPES set rides verbatim"
  );
  must(
    ui.includes('data-array-shards-row=""'),
    "t306 pin — data-array-shards-row=\"\" rides verbatim"
  );
  must(
    ui.includes("arrayEligible && shards >= 2 ? { shards: Math.min(ARRAY_MAX_SHARDS, shards) } : {}"),
    "t306 pin — the submit's shards spread rides verbatim"
  );

  // --- the t320 pins (the LoG CPU contract's own suite reads this source) ---
  must(
    ui.includes("const logPick = isLogAutopick(job.type, job.params)"),
    "t320 pin — the LoG predicate line rides verbatim"
  );
  must(ui.includes("data-log-cpu-row"), "t320 pin — data-log-cpu-row rides");
  must(/CPU \(LoG picker\)/.test(ui), "t320 pin — the CPU (LoG picker) dialect rides");

  // --- the aria grammar (every label a browser flow can target) ---
  for (const [needle, label] of [
    ['aria-label="Run on cluster (SSH)"', "the trigger's label"],
    ['aria-label="Cluster connection"', "the connection select's label"],
    ['aria-label="relion module to load"', "the module select's label"],
    ['aria-label="Node or partition to submit to"', "the partition select's label"],
    ['aria-label="One GPU less"', "the GPU stepper's minus"],
    ['aria-label="One GPU more"', "the GPU stepper's plus"],
    ['aria-label="One shard fewer"', "the array stepper's minus"],
    ['aria-label="One shard more"', "the array stepper's plus"],
    ['aria-label="Run mode"', "the mode group's label"],
    ['aria-live="polite"', "the steppers' live regions"],
  ]) {
    must(ui.includes(needle), `aria grammar — ${label} survives`);
  }

  // --- the new structure hooks (t326's own DOM contract) ---
  for (const hook of [
    "data-section-cluster",
    "data-section-mode",
    "data-run-mode-cards",
    "data-slurm-panel",
    "data-submission-preview",
    "data-lifecycle-strip",
    "data-node-picker-row",
    "data-run-mode-line",
    "data-gpu-width-row",
  ]) {
    must(ui.includes(hook), `structure hook — ${hook} exists`);
  }

  // --- the redesign doctrines ---
  must(
    ui.includes("Stage the inputs over SSH, load the chosen relion module, and submit"),
    "the intro is the SHORT one-liner (the wall of text is dead)"
  );
  must(
    !ui.includes("When it finishes, key files"),
    "the old five-line intro paragraph is extinct"
  );
  must(
    !ui.includes("One MPI rank per GPU — "),
    "the old prose-squeezed GPU hint (em-dash inline form) is extinct"
  );
  must(
    ui.includes('role="radiogroup"') && (ui.match(/role="radio"/g) ?? []).length === 2,
    "the mode is a radiogroup of exactly two cards"
  );
  must(
    ui.includes('aria-checked={mode === "direct"}') && ui.includes('aria-checked={mode === "slurm"}'),
    "both cards speak aria-checked off the same state"
  );
  must(
    ui.includes('aria-disabled={!slurmAvailable}') && ui.includes("no Slurm client on this cluster"),
    "the Slurm card states its own unavailability (no disabled dropdown option)"
  );
  must(
    ui.includes("ArrowRight") && ui.includes("if (slurmAvailable) setMode(\"slurm\")"),
    "the radiogroup's arrow keys never select an unavailable mode"
  );
  must(
    ui.includes('className={cn(\n                      "flex flex-col items-start gap-0.5 rounded-lg border p-3'),
    "the cards are CARDS (bordered, stacked content — not dropdown options)"
  );
  must(
    ui.includes("{mode === \"slurm\" ? (\n                <section") &&
      ui.includes('data-slurm-panel=""'),
    "the Slurm knobs live inside a panel that exists ONLY in slurm mode"
  );
  must(
    ui.includes("sbatch .cf-sbatch.sh"),
    "the preview speaks the real script's name (.cf-sbatch.sh)"
  );
  must(
    ui.includes("--partition=${previewPartition}") &&
      ui.includes("conn?.slurmPartition ?? null"),
    "the preview's partition falls back to the connection default (same as the dispatch)"
  );
  must(
    ui.includes("selectedGroup && selectedGroup.hosts?.length === 1") &&
      ui.includes("--nodelist=${selectedGroup.hosts[0]}"),
    "the preview pins --nodelist exactly when the dispatch does (single-host group)"
  );
  must(
    ui.includes('sbatchDirectives.push(`--ntasks=${gpus}`, `--gres=gpu:${gpus}`)'),
    "the preview's width directives are the submit's own gpus state"
  );
  must(
    ui.includes("if (logPick) sbatchDirectives.push(\"--ntasks=1\")"),
    "the preview speaks the LoG CPU truth (--ntasks=1, no gres)"
  );
  must(
    ui.includes("sbatchDirectives.push(`--array=1-${shards}%4`)"),
    "the preview's array directive is the submit's own shards state"
  );
  must(
    ui.includes("single CPU task — no mpirun, no --gpu"),
    "the LoG preview states its rank shape honestly"
  );
  must(
    ui.includes("nohup … on the login node — no scheduler"),
    "the direct preview says what direct means"
  );
  must(
    ui.includes("`module ${effectiveModule}` : \"no module\""),
    "the identity line speaks the effective module (custom door included)"
  );
  must(
    ui.includes("conn.port && conn.port !== 22"),
    "the identity line shows non-standard ports (the mock's :3022)"
  );
  must(
    ui.includes("Stage inputs") &&
      ui.includes("Load module") &&
      ui.includes("Sync key files back") &&
      ui.includes("stay on the cluster — listed in Results, fetchable on demand"),
    "the lifecycle strip carries the old intro's sync policy in two lines"
  );
  must(
    ui.includes("sm:max-w-xl"),
    "the dialog widened for the two-column mode cards (xl)"
  );
  must(
    ui.includes("max-h-[calc(100vh-3rem)] overflow-y-auto"),
    "the taller dialog scrolls instead of overflowing the viewport"
  );
  must(
    ui.includes('{job.name}') && ui.includes("{job.type}") &&
      ui.includes("text-sm font-semibold text-foreground\">{job.name}"),
    "the job's identity (name + type badge) sits in the header"
  );
  must(
    ui.includes("disabled={pending || !conn || (mode === \"slurm\" && !slurmAvailable)}"),
    "the submit's disable gate is unchanged (the behavior contract)"
  );
  must(
    ui.includes("0 × GPU — CPU-only picker"),
    "the LoG CPU box keeps its exact dialect (t320's browser receipt)"
  );

  // --- t326 — the WIDTH truth: one pure table, three consumers ---------
  const widthSrc = readFileSync(`${ROOT}/src/lib/hpc/gpu-width.ts`, "utf8");
  const slurmSrc = readFileSync(`${ROOT}/src/lib/hpc/slurm.ts`, "utf8");
  must(
    !/from "/.test(widthSrc.replace(/^[\s\S]*?\*\//, "")),
    "gpu-width.ts is PURE (zero imports — client/server/test share it, the t320 log-autopick doctrine)"
  );
  must(
    widthSrc.includes('export function slurmWidthFor') &&
      widthSrc.includes('export const MULTI_GPU_TYPES') &&
      widthSrc.includes('export const SINGLE_GPU_TYPES'),
    "the width truth exports its table (multi-gpu/single/array/cpu)"
  );
  must(
    slurmSrc.includes('import { slurmWidthFor } from "./gpu-width"') &&
      /const w = slurmWidthFor\(type, opts\)/.test(slurmSrc) &&
      /mode: w\.mode, gpus: w\.gpus, shards/.test(slurmSrc),
    "the strategy DERIVES from the shared table (mode + script width single-sourced)"
  );
  must(
    /gpus: Math\.max\(2, w\.gpus\)/.test(slurmSrc),
    "the strategy keeps its own PLANNING floor (never plan < 2) — a simulator choice, distinct from the dispatch's raw width"
  );
  must(
    ui.includes('from "@/lib/hpc/gpu-width"') &&
      /const widthTruth = slurmWidthFor\(job\.type, \{ gpus, logAutopick: logPick \}\)/.test(ui) &&
      /widthTruth\.mode === "multi-gpu" && moduleHasMpi/.test(ui),
    "the dialog renders the SAME table (width real only for MPI types on an mpirun-capable module)"
  );
  must(
    /relionMpi\?\.\[effectiveModule\]/.test(ui),
    "the width's reality consults the probe's relionMpi map for the CHOSEN module"
  );
  must(
    /\.\.\.\(logPick \|\| !widthIsReal \? \(widthTruth\.gpus === 1 \? \{ gpus: 1 \} : \{\}\) : \{ gpus \}\)/.test(ui),
    "the submit sends the width only when real; a 1-GPU truth sends its honest 1 (the t320 LoG omission pattern, generalized)"
  );
  must(
    ui.includes('data-width-truth-row=""') &&
      ui.includes("1 × GPU per task") &&
      ui.includes("0 × GPU — CPU tasks") &&
      ui.includes("1 × GPU — single-GPU step") &&
      ui.includes("1 × GPU — this module has no mpirun"),
    "non-MPI types get honest state boxes, not a lying stepper (t320's trap doctrine, applied to the width)"
  );
  must(
    ui.includes('" · 1 GPU/task"'),
    "the run-mode dialect speaks the per-task width for 1-GPU types"
  );
  must(
    ui.includes("relion … --gpu 0 — one GPU task, no mpirun"),
    "the preview's rank line states the 1-GPU-task shape"
  );
  must(
    /else if \(widthTruth\.gpus === 1\) \{[\s\S]*?--ntasks=1", "--gres=gpu:1"/.test(ui),
    "the preview derives its 1-GPU directives from the shared truth (never the stepper)"
  );

  // the pure table's own truth table (bun, zero deps)
  const unitWidth = (type, opts) => {
    const prog = [
      `const { slurmWidthFor } = await import(${JSON.stringify(path.join(ROOT, "src/lib/hpc/gpu-width.ts"))});`,
      `console.log(JSON.stringify(slurmWidthFor(${JSON.stringify(type)}, ${JSON.stringify(opts)})));`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 160)}`;
    try {
      return JSON.parse(r.stdout?.trim().split("\n").pop());
    } catch {
      return `UNIT-PARSE-ERROR: ${r.stdout?.slice(0, 120)}`;
    }
  };
  const widthCases = [
    ["class2d", { gpus: 6 }, "multi-gpu", 6],
    ["class2d", { gpus: 1 }, "multi-gpu", 1], // RAW width — the dispatch honors the pick; the max(2,·) floor is the simulator's
    ["refine3d", { gpus: 8 }, "multi-gpu", 8],
    ["motioncorr", { gpus: 6 }, "array", 1],
    ["autopick", { gpus: 6 }, "array", 1], // References picking keeps its single GPU
    ["autopick", { gpus: 6, logAutopick: true }, "array", 0], // the LoG truth (t320)
    ["ctffind", { gpus: 6 }, "array", 0],
    ["extract", { gpus: 6 }, "array", 0],
    ["topaztrain", { gpus: 6 }, "single", 1],
    ["postprocess", { gpus: 6 }, "cpu", 0],
  ];
  for (const [type, opts, mode, gpus] of widthCases) {
    const w = unitWidth(type, opts);
    must(
      w && w.mode === mode && w.gpus === gpus,
      `width truth — ${type}${opts.logAutopick ? " (LoG)" : ""} @${opts.gpus ?? "-"} → ${mode} · ${gpus} GPU(s) (got ${JSON.stringify(w)})`
    );
  }
  // and the STRATEGY agrees on mode (the derived consumer cannot drift)
  const unitStrategyMode = (type, opts) => {
    const prog = [
      `const { gpuStrategyFor } = await import(${JSON.stringify(path.join(ROOT, "src/lib/hpc/slurm.ts"))});`,
      `const s = gpuStrategyFor(${JSON.stringify(type)}, ${JSON.stringify(opts)});`,
      `console.log(s.mode + " " + s.gpus);`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", prog], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, DATABASE_URL: "file:/home/z/cryoflow/db/cryoflow.db" },
    });
    return r.status === 0 ? r.stdout?.trim().split("\n").pop() : `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 120)}`;
  };
  for (const [type, opts, mode] of widthCases) {
    const s = unitStrategyMode(type, opts);
    must(
      s?.startsWith(mode + " "),
      `strategy mirror — ${type} mode ${mode} (strategy says "${s}")`
    );
  }
  must(
    unitStrategyMode("class2d", { gpus: 1 }) === "multi-gpu 2",
    "strategy mirror — the planning floor stays the simulator's (class2d@1 plans 2, the script honors 1 — both pinned, no drift either way)"
  );

  // ======================================================================
  console.log("== PHASE B: LIVE HONESTY — the preview is a promise the sbatch keeps ==");

  // the probe — the UI flow always runs against a PROBED connection (the
  // partition picker, the node pin, and the module's MPI word all live in
  // the probe's inventory); the suite's connection gets the same word
  const probeRes = await api(`/api/remote/connections/${CONN}/test`, {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({}),
  });
  must(probeRes.status >= 200 && probeRes.status < 300, `the probe answers (${probeRes.status})`);
  const probe = probeRes.body?.probe ?? null;
  must(probe?.ok === true, "the probe lands ok");
  must(probe?.slurm === true, "the probe sees the Slurm client (the mode card unlocks)");
  must(
    probe?.relionMpi?.["relion/5.0.1"] === true,
    "the probe's relionMpi map says relion/5.0.1 carries mpirun (the width is real for MPI types)"
  );
  must(
    Array.isArray(probe?.slurmGpus) && probe.slurmGpus.some((p) => p.partition === "brain2" && p.hosts?.[0] === "brain2"),
    "the probe's sinfo inventory resolves brain2 to its single host (the --nodelist pin's source)"
  );

  // the fixtures — 8 single-section micrographs, cluster-side (t320's shape)
  const mrcHdr = (() => {
    const b = Buffer.alloc(64);
    b.writeInt32LE(1024, 0);
    b.writeInt32LE(1024, 4);
    b.writeInt32LE(1, 8); // NZ=1
    b.writeInt32LE(2, 12); // mode 2
    return b.toString("base64");
  })();
  const fx = clientBoth(
    "mkdir -p /data2/t326-mics; " +
      `echo ${mrcHdr} | base64 -d > /tmp/.t326-mic.mrc; ` +
      "for i in $(seq 1 8); do cp /tmp/.t326-mic.mrc /data2/t326-mics/mic_$(printf %02d $i).mrc; done"
  );
  must(fx === "", `the 8 fixtures build quietly (${fx.slice(0, 100)})`);

  const importJob = await mkJob({
    projectId,
    type: "import",
    name: "QA t326 import",
    params: {
      micrographsPath: Array.from(
        { length: 8 },
        (_, i) => `/data2/t326-mics/mic_${String(i + 1).padStart(2, "0")}.mrc`
      ).join("\n"),
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!importJob?.id, "the import job creates");
  const runImport = await api(`/api/jobs/${importJob.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runImport.status >= 200 && runImport.status < 300, `the import run accepts (${runImport.status})`);
  const doneImport = await awaitJobTerminal(importJob.id, 90_000);
  must(
    doneImport?.status === "completed",
    `the import completes (${doneImport?.status}: ${String(doneImport?.result ?? "").slice(0, 80)})`
  );

  // the motioncorr — an ARRAY type: the dialog no longer offers a width
  // stepper for it (the sbatch sizes it itself); dispatched exactly as
  // the dialog now submits: slurm · brain2 · 4 shards · the honest 1 GPU
  const mcJob = await mkJob({
    projectId,
    type: "motioncorr",
    name: "QA t326 motioncorr",
    params: {},
  });
  must(!!mcJob?.id, "the motioncorr job creates");
  // motioncorr's input port is "movies" (accepts the import's
  // micrographs-star kind — portsValid's own table)
  const edge = await mkEdge(importJob.id, mcJob.id, "micrographs", "movies");
  must(edge === 200 || edge === 201, `the edge wires import → motioncorr (${edge})`);
  const workdir = `${projRoot}/motioncorr_${mcJob.id.slice(-8)}`;

  const dispatchRes = await dispatch(mcJob.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 1, partition: "brain2", shards: 4 },
  });
  must(dispatchRes.status >= 200 && dispatchRes.status < 300, `the dispatch answers (${dispatchRes.status})`);
  must(!dispatchRes.body?.error, `the dispatch is ACCEPTED (${String(dispatchRes.body?.error ?? "").slice(0, 120)})`);

  const done = await awaitJobTerminal(mcJob.id, 180_000);
  must(
    done?.status === "completed",
    `the motioncorr COMPLETES (${done?.status}: ${String(done?.result ?? "").slice(0, 90)})`
  );

  // the script — every directive the preview renders for an ARRAY type at
  // these knobs must be in the script the dispatch actually wrote (the
  // honesty contract: 1 GPU per task, no mpirun, the split is the width)
  const sbatch = client(`cat ${workdir}/.cf-sbatch.sh 2>/dev/null`);
  must(sbatch.length > 0, "the sbatch script is on disk (.cf-sbatch.sh)");
  must(/#SBATCH --partition=brain2/.test(sbatch), "array type — the script carries --partition=brain2 (the preview's first directive)");
  must(/#SBATCH --nodelist=brain2/.test(sbatch), "array type — the script carries --nodelist=brain2 (the preview's single-host pin)");
  must(/#SBATCH --gres=gpu:1\b/.test(sbatch), "array type — the script carries --gres=gpu:1 (ONE GPU per task — the width the box states, not the old stepper's lie)");
  must(/#SBATCH --ntasks=1\b/.test(sbatch), "array type — the script carries --ntasks=1 (no MPI width for a per-mic shard)");
  must(/#SBATCH --array=1-4%4/.test(sbatch), "array type — the script carries --array=1-4%4 (the preview's split directive)");
  must(!/mpirun/.test(sbatch), "array type — NO mpirun wrapper (the preview's 'one GPU task' line is true)");

  // and the record agrees with both of them
  const rec = done?.runRemote ?? {};
  must(rec.mode === "slurm", `the record speaks mode=slurm (${String(rec.mode)})`);
  must(rec.gpusRequested === 1, `the record speaks gpusRequested=1 — the honest per-task width, not the old default 6 (${String(rec.gpusRequested)})`);

  // the direct lane — the preview's other face: no scheduler script at all
  const mcDirect = await mkJob({
    projectId,
    type: "motioncorr",
    name: "QA t326 motioncorr direct",
    params: {},
  });
  must(!!mcDirect?.id, "the direct motioncorr job creates");
  const edge2 = await mkEdge(importJob.id, mcDirect.id, "micrographs", "movies");
  must(edge2 === 200 || edge2 === 201, `the edge wires import → direct motioncorr (${edge2})`);
  const workdir2 = `${projRoot}/motioncorr_${mcDirect.id.slice(-8)}`;
  const dispatch2 = await dispatch(mcDirect.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "direct" },
  });
  must(dispatch2.status >= 200 && dispatch2.status < 300, `the direct dispatch answers (${dispatch2.status})`);
  const done2 = await awaitJobTerminal(mcDirect.id, 180_000);
  must(
    done2?.status === "completed",
    `the direct motioncorr COMPLETES (${done2?.status}: ${String(done2?.result ?? "").slice(0, 90)})`
  );
  const noScript = client(`cat ${workdir2}/.cf-sbatch.sh 2>/dev/null | head -c 40`);
  const hasRun = client(`test -f ${workdir2}/.cf-run.sh && echo yes || echo no`);
  must(noScript === "", "the direct lane writes NO .cf-sbatch.sh (the preview's 'no scheduler' is true)");
  must(hasRun === "yes", "the direct lane writes its .cf-run.sh instead");
  const rec2 = done2?.runRemote ?? {};
  must(rec2.mode === "direct", `the direct record speaks mode=direct (${String(rec2.mode)})`);

  // ======================================================================
  console.log("== PHASE C: THE REAL WIDTH — an MPI type at 3 GPUs (the user's own 2D Classification shape) ==");

  // the particles fixture: a star with absolute stack refs + the stack
  // itself (the mock's refine audits every ref against its fs root)
  const pfx = clientBoth(
    "mkdir -p /data2/t326-particles; " +
      `echo ${mrcHdr} | base64 -d > /data2/t326-particles/stack.mrcs; ` +
      "printf 'data_\\n\\nloop_\\n_rlnImageName #1\\n" +
      "0001@/data2/t326-particles/stack.mrcs\\n" +
      "0002@/data2/t326-particles/stack.mrcs\\n" +
      "0003@/data2/t326-particles/stack.mrcs\\n" +
      "0004@/data2/t326-particles/stack.mrcs\\n' > /data2/t326-particles/particles.star"
  );
  must(pfx === "", `the particles fixture builds quietly (${pfx.slice(0, 100)})`);

  // import (particles node type) — the remote leg reads the star over SSH
  // and keeps its rows cluster-absolute (zero upload)
  const pImport = await mkJob({
    projectId,
    type: "import",
    name: "QA t326 particles import",
    params: {
      nodeType: "particles",
      micrographsPath: "/data2/t326-particles/particles.star",
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!pImport?.id, "the particles import creates");
  const runPImport = await api(`/api/jobs/${pImport.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runPImport.status >= 200 && runPImport.status < 300, `the particles import run accepts (${runPImport.status})`);
  const donePImport = await awaitJobTerminal(pImport.id, 90_000);
  must(
    donePImport?.status === "completed",
    `the particles import completes (${donePImport?.status}: ${String(donePImport?.result ?? "").slice(0, 80)})`
  );

  // the 2D Classification — THE MPI type (the user's own dialog receipt):
  // here and only here the stepper's width is real
  const c2d = await mkJob({
    projectId,
    type: "class2d",
    name: "2D Classification 1",
    params: { numClasses: 4, iterations: 2 },
  });
  must(!!c2d?.id, "the class2d job creates");
  const edgeC2d = await mkEdge(pImport.id, c2d.id, "particles", "particles");
  must(edgeC2d === 200 || edgeC2d === 201, `the edge wires particles import → class2d (${edgeC2d})`);
  const workdirC2d = `${projRoot}/class2d_${c2d.id.slice(-8)}`;

  const dispatchC2d = await dispatch(c2d.id, {
    remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 3, partition: "brain2" },
  });
  must(dispatchC2d.status >= 200 && dispatchC2d.status < 300, `the class2d dispatch answers (${dispatchC2d.status})`);
  must(!dispatchC2d.body?.error, `the class2d dispatch is ACCEPTED (${String(dispatchC2d.body?.error ?? "").slice(0, 120)})`);

  const doneC2d = await awaitJobTerminal(c2d.id, 180_000);
  must(
    doneC2d?.status === "completed",
    `the class2d COMPLETES (${doneC2d?.status}: ${String(doneC2d?.result ?? "").slice(0, 90)})`
  );

  // the script — the preview's FULL-width directives, kept to the letter
  const sbatchC2d = client(`cat ${workdirC2d}/.cf-sbatch.sh 2>/dev/null`);
  must(sbatchC2d.length > 0, "the class2d sbatch script is on disk");
  must(/#SBATCH --partition=brain2/.test(sbatchC2d), "MPI type — the script carries --partition=brain2");
  must(/#SBATCH --nodelist=brain2/.test(sbatchC2d), "MPI type — the script carries --nodelist=brain2");
  must(/#SBATCH --gres=gpu:3\b/.test(sbatchC2d), "MPI type — the script carries --gres=gpu:3 (the width IS real here)");
  must(/#SBATCH --ntasks=3\b/.test(sbatchC2d), "MPI type — the script carries --ntasks=3 (one rank per GPU)");
  must(/mpirun -n 3\b/.test(sbatchC2d), "MPI type — the script wraps mpirun -n 3 (the preview's rank line)");
  must(/--gpu 0:1:2\b/.test(sbatchC2d), "MPI type — the argv pins --gpu 0:1:2 (the preview's device list)");

  // and the record speaks the same width
  const recC2d = doneC2d?.runRemote ?? {};
  must(recC2d.mode === "slurm", `the class2d record speaks mode=slurm (${String(recC2d.mode)})`);
  must(recC2d.gpusRequested === 3, `the class2d record speaks gpusRequested=3 (${String(recC2d.gpusRequested)})`);

  console.log(fail === 0 ? "\n== t326 diag: ALL GREEN ==" : `\n== t326 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: the API trees + the cluster-side fixtures ----
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  if (projectId) {
    try {
      client(`rm -rf /projects/cryoflow/${projectId}`);
    } catch { /* the jobs DELETE already dropped the local twin */ }
    await api(`/api/projects/${projectId}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  try {
    client("rm -rf /data2/t326-mics /data2/t326-particles /tmp/.t326-mic.mrc");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);
