/**
 * t486 — the agent reads the curves.
 *
 * The results charts had a data half (three private GET bodies) and a
 * derivation half (chart-rows.ts); the agent could reach NEITHER. This
 * round lifts the loading half into chart-data.ts (loadFsc / loadGuinier /
 * loadAngDist), turns the three routes into thin guard+json shells, and
 * opens the agent's 22nd tool get_job_curves over the very same loaders —
 * the numbers the model quotes ARE the numbers the chart draws, by
 * construction (t110's law, extended from derivations to loaders).
 *
 * Five benches in one:
 *   T1  tool shape      — 22nd tool, kinds enum, honest description
 *   T2  sampler law     — ≤12 uniform, head and tail always kept
 *   T3  postprocess face— FSC+Guinier read against the REAL fixture star,
 *                         cross-checked against the file itself
 *   T4  honest empty    — a postprocess has no angles, a 2D has no FSC;
 *                         each empty kind says WHY, never fakes a zero
 *   T5  kinds + errors  — kind filter, unknown kind, missing job
 *   T6  the law         — prompt #15 THE CURVE LAW + read list + numbering
 *   T7  one bridge      — the routes import the loaders (thin shells),
 *                         statcache keys untouched, 404 translation wired
 *
 * Runs against the LIVE fixture (tutorial project in db/cryoflow.db,
 * workdirs under data/relion/) — read-only throughout.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";

/* t503 — the checkout moves between sandbox resets (my-project era ->
 * cryoflow home); resolve the repo root from THIS file, not a
 * hardcoded absolute path that rots the bench the moment the tree moves. */
const REPO = (await import("node:path")).default.resolve(
  (await import("node:url")).fileURLToPath(new URL(".", import.meta.url)),
  "..",
);
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

let pass = 0;
let fail = 0;
function ok(cond: unknown, label: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
function section(t: string): void {
  console.log(`\n== ${t}`);
}

// dynamic imports AFTER the env pins (t484's lesson)
const { AI_TOOLS, executeAiTool, sampleSeries } = await import(
  "../src/lib/ai/tools"
);
const { loadFsc, loadGuinier, loadAngDist } = await import(
  "../src/lib/chart-data"
);
const { ChartJobNotFound } = await import("../src/lib/chart-data");
const { db } = await import("../src/lib/db");
const { parseStar, findPair } = await import("../src/lib/starfile");
const promptSrc = readFileSync(`${REPO}/src/lib/ai/prompt.ts`, "utf8");
const fscRouteSrc = readFileSync(
  `${REPO}/src/app/api/jobs/[id]/fsc/route.ts`,
  "utf8"
);
const guinierRouteSrc = readFileSync(
  `${REPO}/src/app/api/jobs/[id]/guinier/route.ts`,
  "utf8"
);
const angdistRouteSrc = readFileSync(
  `${REPO}/src/app/api/jobs/[id]/angdist/route.ts`,
  "utf8"
);
const chartDataSrc = readFileSync(`${REPO}/src/lib/chart-data.ts`, "utf8");

const tool = AI_TOOLS.find((t) => t.name === "get_job_curves") as
  | (typeof AI_TOOLS[number] & { description: string })
  | undefined;

/* ---------------- T1 tool shape ---------------- */
section("T1 — tool shape (the 22nd tool)");
ok(AI_TOOLS.length === 34, `AI_TOOLS holds 34 tools — t530's diagnostics read is the newest birth (t530 count-debt, caught by the t547 family run) (got ${AI_TOOLS.length})`);
ok(tool != null, "get_job_curves is in the catalog");
const schema = tool?.parameters as {
  type: string;
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: boolean;
} | null;
ok(schema?.type === "object" && schema.additionalProperties === false && Array.isArray(schema?.required) && schema.required.length === 1 && schema.required[0] === "job_id",
  "schema: object, additionalProperties:false, exactly job_id required");
const kindsProp = schema?.properties?.kinds as {
  type: string;
  items?: { enum?: string[] };
  maxItems?: number;
} | undefined;
ok(
  kindsProp?.type === "array" &&
    Array.isArray(kindsProp.items?.enum) &&
    kindsProp.items.enum.join(",") ===
      "fsc,guinier,angdist,ctf,motion,topaz" &&
    kindsProp.maxItems === 6,
  "kinds: array of the six curve kinds, maxItems 6 (t487: the bridge carries six)"
);
const desc = tool?.description ?? "";
ok(
  desc.includes("fsc") &&
    desc.includes("guinier") &&
    desc.includes("angdist") &&
    desc.includes("ctf") &&
    desc.includes("motion") &&
    desc.includes("topaz") &&
    desc.includes("inspect_job") &&
    desc.includes("check_convergence") &&
    desc.includes("RESULT CURVES"),
  "description names the six kinds AND the honest split from inspect_job/check_convergence"
);
ok(
  desc.includes("到多少埃") && desc.includes("取向均匀吗") && desc.includes("CTF 拟合怎么样") && desc.includes("漂移大吗"),
  "description speaks the user's question words (science trio + prep trio)"
);

/* ---------------- T2 sampler law ---------------- */
section("T2 — sampleSeries keeps the head and the tail");
{
  const hundred = Array.from({ length: 100 }, (_, i) => i);
  const s = sampleSeries(hundred);
  ok(s.length === 12, "100 rows → 12 samples");
  ok(s[0] === 0 && s[s.length - 1] === 99, "first and last always kept");
  ok(
    s.every((v, i) => i === 0 || v > s[i - 1]),
    "samples strictly ascending (uniform, no repeats)"
  );
  ok(sampleSeries([1, 2, 3]).join(",") === "1,2,3", "short series passes through");
  ok(sampleSeries(hundred, 8).length === 8, "max is honored");
}

/* ---------------- fixture resolution ---------------- */
const ppJob = await db.job.findFirst({
  where: { type: "postprocess", name: { contains: "tutorial" } },
});
const c2dJob = await db.job.findFirst({
  where: { type: "class2d", name: { contains: "tutorial" } },
});
ok(ppJob != null && c2dJob != null, "tutorial postprocess + class2d jobs exist in the live db");

/* ---------------- T3 postprocess face (real fixture) ---------------- */
section("T3 — the postprocess face reads the real fixture star");
if (ppJob) {
  const ctx = { projectId: ppJob.projectId };
  const res = await executeAiTool("get_job_curves", { job_id: ppJob.id }, ctx);
  ok(res.ok === true, `tool runs ok (${res.summary.slice(0, 80)}…)`);
  const detail = res.detail as { curves: Array<Record<string, unknown>> };
  const fsc = detail.curves.find((c) => c.kind === "fsc");
  const guinier = detail.curves.find((c) => c.kind === "guinier");
  const angdist = detail.curves.find((c) => c.kind === "angdist");

  // the file is the third party: read it directly, bypassing every loader
  const workdir = `/home/z/my-project/data/relion/${ppJob.projectId}`.replace(
    /\/$/,
    ""
  );
  // workdir from the engine state is the honest source (job.workdir is not
  // a column); find it the way the loader does:
  const { getRun } = await import("../src/lib/relion/engine");
  const run = getRun(ppJob.id);
  ok(run?.workdir != null && existsSync(run.workdir!), "engine state carries the fixture workdir");

  const starText = run ? readFileSync(path.join(run.workdir!, "postprocess.star"), "utf8") : "";
  const star = parseStar(starText);
  const fileReported = parseFloat(findPair(star, "_rlnFinalResolution") ?? "");
  const fileBfac = parseFloat(findPair(star, "_rlnBfactorUsedForSharpening") ?? "");

  ok(fsc?.renderable === true && fsc?.source === "postprocess", "fsc face: renderable, source postprocess");
  ok(
    fsc?.resolutionAt143 != null &&
      Number.isFinite(fsc.resolutionAt143 as number),
    "fsc face: 0.143 crossing present"
  );
  ok(
    Math.abs((fsc?.reportedResolution as number) - fileReported) < 1e-6,
    `fsc face: reportedResolution matches the star file (${fileReported} Å)`
  );
  const shells = (await loadFsc(ppJob.id)).shells;
  ok(
    (fsc?.resolutionAt143 as number) >= Math.min(...shells.map((s) => s.res)) &&
      (fsc?.resolutionAt143 as number) <= Math.max(...shells.map((s) => s.res)),
    "0.143 crossing lies inside the shells' resolution span"
  );
  const sampled = fsc?.sampledShells as Array<{ res: number }>;
  const resMin = Math.min(...shells.map((s) => s.res));
  const resMax = Math.max(...shells.map((s) => s.res));
  ok(
    Array.isArray(sampled) && sampled.length <= 12 && sampled.length >= 2 &&
      Math.abs(sampled[0].res - resMax) < 0.11 &&
      Math.abs(sampled[sampled.length - 1].res - resMin) < 0.11,
    "sampledShells ≤12 and carries the true head (low-res, big Å) and tail (high-res)"
  );
  ok(
    (fsc?.postprocessGeneral as Record<string, unknown> | undefined) != null,
    "t457 trio rides the tool face too"
  );

  ok(guinier?.renderable === true, "guinier face: renderable");
  ok(
    Math.abs((guinier?.bfactor as number) - fileBfac) < 1e-6,
    `guinier face: B-factor matches the star file (${fileBfac} Å²)`
  );
  ok(
    ((guinier?.pointCount as number) ?? 0) > 0 &&
      Array.isArray(guinier?.sampledPoints) &&
      (guinier.sampledPoints as unknown[]).length <= 8,
    "guinier face: points counted, ≤8 sampled"
  );

  ok(
    angdist?.renderable === false &&
      typeof angdist?.reason === "string" &&
      (angdist.reason as string).includes("no particle-angle star"),
    "angdist face: a postprocess honestly has no angles (reason, not a fake zero)"
  );
  ok(
    (res.summary as string).includes("none in the workdir"),
    "summary speaks the empty kind out loud"
  );
}

/* ---------------- T4 class2d face (angles yes, FSC no) ---------------- */
section("T4 — the class2d face: angles renderable, FSC honestly absent");
if (c2dJob) {
  const ctx = { projectId: c2dJob.projectId };
  const res = await executeAiTool(
    "get_job_curves",
    { job_id: c2dJob.id, kinds: ["angdist", "fsc"] },
    ctx
  );
  ok(res.ok === true, "tool runs ok on the class2d fixture");
  const detail = res.detail as { curves: Array<Record<string, unknown>> };
  const angdist = detail.curves.find((c) => c.kind === "angdist");
  const fsc = detail.curves.find((c) => c.kind === "fsc");
  ok(
    angdist?.renderable === true &&
      (angdist.total as number) > 0 &&
      (angdist.occupied as number) > 0,
    `angdist face: ${angdist?.total} particles over ${angdist?.occupied} bins`
  );
  ok(
    Array.isArray(angdist?.hottestBins) &&
      (angdist.hottestBins as unknown[]).length === 3 &&
      (angdist.hottestBins as Array<Record<string, unknown>>).every(
        (b) => typeof b.rotBin === "number" && typeof b.tiltBin === "number"
      ),
    "hottest bins carry rot/tilt indices"
  );
  ok(
    angdist?.anisotropyVerdict === "anisotropic" ||
      angdist?.anisotropyVerdict === "fairly even",
    "anisotropy verdict is one of the two honest words"
  );
  ok(
    fsc?.renderable === true && fsc?.source === "model",
    "fsc face: the fixture class2d's model star DOES carry a gold-standard FSC — the loader reads it honestly (source model, never faked)"
  );
}

/* ---------------- T4b — a motioncorr job has NO curves at all ------- */
section("T4b — a motioncorr job honestly has nothing to read");
{
  const mcJob = await db.job.findFirst({
    where: { projectId: "cmukrk2yy0000rjobryvy0pzu", type: "motioncorr" },
  });
  ok(mcJob != null, "tutorial motioncorr job exists");
  if (mcJob) {
    const res = await executeAiTool(
      "get_job_curves",
      { job_id: mcJob.id, kinds: ["fsc"] },
      { projectId: mcJob.projectId }
    );
    ok(res.ok === true, "the tool still answers ok — empty is an answer, not an error");
    const fsc = (res.detail as { curves: Array<Record<string, unknown>> }).curves[0];
    ok(
      fsc?.renderable === false &&
        typeof fsc?.reason === "string" &&
        (fsc.reason as string).includes("no FSC source"),
      "fsc face: motioncorr gets the honest reason, never a fake zero"
    );
  }
}

/* ---------------- T5 kinds filter + errors ---------------- */
section("T5 — kinds filter, unknown kinds, missing jobs");
if (ppJob) {
  const ctx = { projectId: ppJob.projectId };
  const onlyFsc = await executeAiTool(
    "get_job_curves",
    { job_id: ppJob.id, kinds: ["fsc"] },
    ctx
  );
  const curves = (onlyFsc.detail as { curves: Array<{ kind: string }> }).curves;
  ok(
    onlyFsc.ok === true && curves.length === 1 && curves[0].kind === "fsc",
    "kinds:['fsc'] returns exactly one fsc curve"
  );
  const bad = await executeAiTool(
    "get_job_curves",
    { job_id: ppJob.id, kinds: ["fsc", "vibes"] },
    ctx
  );
  ok(
    bad.ok === false && (bad.summary as string).includes("vibes"),
    "unknown kind named and refused"
  );
  const ghost = await executeAiTool(
    "get_job_curves",
    { job_id: "cm-nonexistent-job" },
    ctx
  );
  ok(
    ghost.ok === false && (ghost.summary as string).includes("not found"),
    "missing job refused honestly"
  );
}

/* ---------------- T6 the law ---------------- */
section("T6 — THE CURVE LAW is on the books");
ok(
  /15\. THE CURVE LAW:/.test(promptSrc),
  "law #15 THE CURVE LAW exists"
);
ok(
  promptSrc.includes("get_job_curves(job_id) FIRST"),
  "the law names the verb first"
);
ok(
  promptSrc.includes("never the curves") &&
    promptSrc.includes("a curve question and a stability question are different questions"),
  "the law teaches the honest split from inspect_job AND check_convergence"
);
ok(
  promptSrc.includes("到多少埃") &&
    promptSrc.includes("取向均匀吗") &&
    promptSrc.includes("is the map good/trustworthy"),
  "the law speaks the asker's words (zh + en)"
);
ok(
  /2\. QUESTIONS ARE READS:[^\n]*get_job_curves/.test(promptSrc) &&
    promptSrc.includes('"这张图到多少埃？"'),
  "the read list and its sample question carry the new door"
);
{
  const nums = [...promptSrc.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  ok(
    nums.length === 16 && nums.every((n, i) => n === i + 1),
    `doctrine numbers run 1–16 with no gaps (${nums.join(",")})`
  );
}

/* ---------------- T7 one bridge ---------------- */
section("T7 — the routes and the tool drink from ONE loader");
ok(
  fscRouteSrc.includes('from "@/lib/chart-data"') &&
    fscRouteSrc.includes("loadFsc") &&
    guinierRouteSrc.includes("loadGuinier") &&
    angdistRouteSrc.includes("loadAngDist"),
  "all three thin shells import their loader from chart-data"
);
ok(
  !fscRouteSrc.includes("parseLoop") &&
    !guinierRouteSrc.includes("cachedFileCompute") &&
    !angdistRouteSrc.includes("readdirSync"),
  "no parse logic left behind in the shells"
);
ok(
  [fscRouteSrc, guinierRouteSrc, angdistRouteSrc].every((s) =>
    s.includes("ChartJobNotFound") && s.includes("404")
  ),
  "every shell translates ChartJobNotFound → 404"
);
ok(
  [fscRouteSrc, guinierRouteSrc, angdistRouteSrc].every((s) =>
    s.includes("isLocalRequest")
  ),
  "every shell keeps the same-origin guard (t251)"
);
const cacheKeys = [
  '"fsc:pp-star"',
  '"fsc:legacy-fsc"',
  '"fsc:plain-dat"',
  '"fsc:model-star"',
  '"fsc:final-model-reported"',
  '"guinier:pp-star-table"',
  '"guinier:eps"',
  '"guinier:legacy-table"',
  '"guinier:pp-star-bfactor"',
  '"guinier:runout-bfactor"',
  '"angdist:bins"',
];
ok(
  cacheKeys.every((k) => chartDataSrc.includes(k)),
  `all ${cacheKeys.length} statcache keys survive the move verbatim (hit rate intact)`
);
ok(
  chartDataSrc.includes("export class ChartJobNotFound") &&
    chartDataSrc.includes("export async function loadFsc") &&
    chartDataSrc.includes("export async function loadGuinier") &&
    chartDataSrc.includes("export async function loadAngDist"),
  "chart-data exports the three loaders + the not-found truth"
);

/* ---------------- live loader sanity (no db writes happened) ---------------- */
section("Live loader sanity");
const live = await loadFsc(ppJob!.id);
ok(
  live.shells.length > 0 && live.source === "postprocess",
  `loadFsc on the fixture: ${live.shells.length} shells via ${live.sourceFile}`
);
const liveG = await loadGuinier(ppJob!.id);
ok(
  liveG.points.length > 0 && liveG.bfactor != null,
  `loadGuinier on the fixture: ${liveG.points.length} pts, B ${liveG.bfactor} Å²`
);
const liveA = await loadAngDist(c2dJob!.id);
ok(
  liveA.total > 0 && liveA.starFile != null,
  `loadAngDist on the fixture: ${liveA.total} particles via ${liveA.starFile}`
);

await db.$disconnect();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
