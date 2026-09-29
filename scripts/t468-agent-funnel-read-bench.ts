/**
 * t468 — the agent reads the LEDGER (get_funnel_chain, the 15th tool).
 *
 * The funnel dialog and its Copy-ledger button (t460–t463) are the UI's
 * own doors onto the cross-job story. This bench pins the agent's door to
 * the SAME furniture: the tool runs funnelDoorCandidate (the canvas
 * door's crown law) + funnelLedgerOf + funnelLedgerText (the clipboard
 * grammar) on the same DB shape the funnel route fetches — never a
 * private read path.
 *
 * Run: bun run scripts/t468-agent-funnel-read-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t468-funnel-read-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.CRYOFLOW_DISABLE_BUILTIN_AI = "1";
execSync("bunx prisma db push --skip-generate", {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: "pipe",
});

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

/* ------------------------------------------------------------------ */
/* Imports (after env)                                                 */
/* ------------------------------------------------------------------ */

const { executeAiTool } = await import("../src/lib/ai/tools");
const { buildSystemPrompt } = await import("../src/lib/ai/prompt");
const { AI_TOOLS } = await import("../src/lib/ai/tools");
const { db } = await import("../src/lib/db");
const { funnelDoorCandidate, funnelLedgerOf, funnelLedgerText, FUNNEL_DOOR_BLOCK_LINES } =
  await import("../src/lib/particle-funnel");

console.log("T1. the catalog wears the ledger read");

const funnelTool = AI_TOOLS.find((t) => t.name === "get_funnel_chain");
must(funnelTool != null, "T1a: get_funnel_chain is in the catalog (the 15th tool)");
must(
  AI_TOOLS.length === 21 && new Set(AI_TOOLS.map((t) => t.name)).size === 21,
  `T1b: 21 unique tools (got ${AI_TOOLS.length})`,
);
const funnelParams = (funnelTool?.parameters ?? {}) as {
  properties?: Record<string, unknown>;
  additionalProperties?: unknown;
};
must(
  funnelParams.properties?.job_id != null && funnelParams.additionalProperties === false,
  "T1c: the schema takes an optional job_id and nothing else",
);
must(
  /get_funnel_chain|funnel/i.test(funnelTool?.description ?? "") && (funnelTool?.description ?? "").includes("LEDGER"),
  "T1d: the description names the ledger and the count question",
);

/* ------------------------------------------------------------------ */
/* A fresh project — idle demo seed = no receipts = honest block        */
/* ------------------------------------------------------------------ */

const project = await db.project.create({
  data: { name: "t468 ledger read" },
});
const ctx = { projectId: project.id };

console.log("T2. an empty canvas refuses honestly");

{
  const r = await executeAiTool("get_funnel_chain", {}, ctx);
  must(r.ok === false, "T2a: no-arg read on an idle canvas is ok:false");
  must(
    r.summary === FUNNEL_DOOR_BLOCK_LINES["no-receipts"],
    "T2b: the block line is the canvas door's own no-receipts sentence, verbatim",
  );
  const named = await executeAiTool("get_funnel_chain", { job_id: "no-such-id" }, ctx);
  must(
    named.ok === false && named.summary.includes("get_workflow_state"),
    "T2c: a bogus job_id refuses and points at the state read",
  );
}

/* ------------------------------------------------------------------ */
/* Seed the bench mainline — the tutorial's receipt lines, verbatim     */
/* ------------------------------------------------------------------ */

async function seedJob(data: {
  type: string;
  name: string;
  status: string;
  result: string | null;
  x: number;
}) {
  return db.job.create({
    data: { projectId: project.id, params: "{}", y: 0, ...data },
  });
}

const jImport = await seedJob({
  type: "import",
  name: "Import Movies",
  status: "completed",
  result: "24 micrographs imported · EMPIAR-10017 (pixel 1.77 Å)",
  x: 0,
});
const jMotion = await seedJob({
  type: "motioncorr",
  name: "Motion Correction",
  status: "completed",
  result: "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: motion corrected, 24 micrographs",
  x: 1,
});
const jCtf = await seedJob({
  type: "ctffind",
  name: "CTF Estimation",
  status: "completed",
  result: "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: CTF estimated for 24 micrographs",
  x: 2,
});
const jPick = await seedJob({
  type: "autopick",
  name: "Auto-pick (bench)",
  status: "completed",
  result: "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: 408 particles picked across 24 micrographs",
  x: 3,
});
const jExtract = await seedJob({
  type: "extract",
  name: "Extract (bench)",
  status: "completed",
  result: "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: 96 particles extracted",
  x: 4,
});
const jClass2d = await seedJob({
  type: "class2d",
  name: "2D Classification (bench)",
  status: "completed",
  result: "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: 2D classification finished — 50 classes · 96 particles · top: class 3 at 12.5%",
  x: 5,
});
const jPost = await seedJob({
  type: "postprocess",
  name: "Post-process (bench)",
  status: "completed",
  result: "REMOTE[cryo@127.0.0.1 · relion/5.0.1]: sharpened map · FSC(0.143) = 7.79 Å",
  x: 6,
});

const chain = [jImport.id, jMotion.id, jCtf.id, jPick.id, jExtract.id, jClass2d.id, jPost.id];
for (let i = 0; i < chain.length - 1; i++) {
  await db.edge.create({
    data: { projectId: project.id, fromJobId: chain[i], toJobId: chain[i + 1] },
  });
}

console.log("T3. the no-arg crown read — the whole ledger in one call");

{
  const r = await executeAiTool("get_funnel_chain", {}, ctx);
  must(r.ok === true && (r.detail as Record<string, unknown>)?.picked === "crown", "T3a: ok:true, picked:crown");
  const s = r.summary;
  must(
    s.includes("Post-process (bench)") && s.includes("[postprocess]"),
    "T3b: the summary names the entered verb (crown = deepest entry-type verb)",
  );
  must(
    s.includes("24 micrographs went in") && s.includes("96 particles came out classified") && s.includes("7.79 Å"),
    "T3c: the headline numbers ride in the summary",
  );
  must(s.includes("6 counted stations"), "T3d: the counted-station census is stated (postprocess is the closing, not a row)");

  const detail = r.detail as Record<string, unknown>;
  const text = String(detail.ledgerText);
  must(text.startsWith("Particle funnel — Post-process (bench)"), "T3e: the ledger text opens like the Copy button's");
  must(
    text.includes("24 micrographs") && text.includes("408 picks") && text.includes("96 particles") && text.includes("50 classes"),
    "T3f: the per-station counts (incl. class2d's class census) are all in the text",
  );
  must(
    text.includes("17.0 per micrograph") && text.includes("−312 · 76% of the picks never became particles"),
    "T3g: the edge verbs speak — the transform and the shed with its percentage",
  );
  must(!text.endsWith("\n"), "T3h: no trailing newline — clipboard text is not a file (t463's law)");
}

console.log("T4. the copy-button equality law");

{
  const rows = await db.job.findMany({
    where: { projectId: project.id },
    select: { id: true, type: true, name: true, status: true, result: true, updatedAt: true },
  });
  const edges = await db.edge.findMany({ where: { projectId: project.id }, select: { fromJobId: true, toJobId: true } });
  const funnelJobs = rows.map((j) => ({
    id: j.id,
    type: j.type,
    name: j.name,
    status: j.status,
    result: j.result,
    updatedAt: j.updatedAt ? j.updatedAt.toISOString() : null,
  }));
  const ledger = funnelLedgerOf({ jobs: funnelJobs, edges, enteredId: jPost.id });
  must(ledger != null, "T4a: the pure brain reads the same world");
  const golden = funnelLedgerText(ledger!, funnelJobs.find((j) => j.id === jPost.id)!.name);
  const r = await executeAiTool("get_funnel_chain", { job_id: jPost.id }, ctx);
  must(
    r.ok === true && (r.detail as Record<string, unknown>).ledgerText === golden,
    "T4b: the tool's ledgerText is byte-identical to funnelLedgerText — one source of truth",
  );
  must(
    (r.detail as Record<string, unknown>).picked === "named",
    "T4c: a named job_id reports picked:named (the door law stays visible)",
  );
}

console.log("T5. a running station is read honestly, never invented");

{
  await db.job.update({ where: { id: jMotion.id }, data: { status: "running", result: null } });
  const r = await executeAiTool("get_funnel_chain", { job_id: jClass2d.id }, ctx);
  must(r.ok === true, "T5a: a chain with a running station still reads");
  const s = r.summary;
  must(
    s.includes("Motion Correction (running)") && s.includes("no receipt yet"),
    "T5b: the summary names the unfinished station and its status",
  );
  const detail = r.detail as Record<string, unknown>;
  const unfinished = (detail.unfinished as { name: string; status: string }[]) ?? [];
  must(
    unfinished.length === 1 && unfinished[0].name === "Motion Correction" && unfinished[0].status === "running",
    "T5c: detail.unfinished carries the station",
  );
  const stations = (detail.stations as { name: string; kind: string; count: number | null }[]) ?? [];
  const motionRow = stations.find((x) => x.name === "Motion Correction");
  must(
    motionRow != null && motionRow.kind === "amber" && motionRow.count === null,
    "T5d: the running station's row is amber with no invented count",
  );
  const text = String(detail.ledgerText);
  must(text.includes("status: running"), "T5e: the ledger text speaks the status line, not a number");
}

console.log("T6. a solitary verb reads as a chain of one");

{
  const lone = await seedJob({
    type: "extract",
    name: "Lone Extract",
    status: "completed",
    result: "96 particles extracted",
    x: 20,
  });
  const r = await executeAiTool("get_funnel_chain", { job_id: lone.id }, ctx);
  must(r.ok === true, "T6a: an unwired verb still reads (no refusal for solitude)");
  const detail = r.detail as Record<string, unknown>;
  const stations = (detail.stations as unknown[]) ?? [];
  must(stations.length === 1, "T6b: the ledger is a chain of one");
  must(
    String((r.detail as Record<string, unknown>).ledgerText).includes("96 particles"),
    "T6c: the solitary receipt speaks",
  );
}

console.log("T7. the prompt teaches the count law");

{
  const sys = buildSystemPrompt({ projectName: "P", projectMode: "spa", projectRemote: null, jobCount: 7 });
  must(sys.includes("get_funnel_chain"), "T7a: the prompt names the ledger read");
  must(sys.includes("THE COUNT LAW"), "T7b: THE COUNT LAW is on the page");
  must(
    /QUESTIONS ARE READS[\s\S]*get_funnel_chain/.test(sys),
    "T7c: QUESTIONS ARE READS routes through the ledger read too",
  );
}

/* ------------------------------------------------------------------ */

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
