/**
 * t550 — the judge's real-data bench: the class-stats parser learns the
 * REAL RELION model-star dialects, and the judge's voice carries the run's
 * own resolution estimate.
 *
 * The t520 fixtures taught classStatsFromWorkdir ONE dialect — a single
 * loop with `_rlnEstimatedResolution` rows. The real t474 200-iteration
 * forest speaks a different shape: a gold-standard model star whose
 * data_model_general block carries `_rlnCurrentResolution 3.20` as a
 * GLOBAL key-value and has NO per-class numbers at all. On that real file
 * every class read "resolution unknown" while the run knew exactly where
 * it stood — the judge discarded the one honest number the file held.
 *
 *   A  the dialect units — three synthesized workdirs in a temp world:
 *      (1) gold-standard global (per-class stays honestly null, the global
 *          lands on globalResolution — a global number never wears a
 *          per-class badge), (2) per-class blocks data_model_class_N,
 *          (3) the t520 single-loop shape (regression guard), plus the
 *          priority law (per-class blocks beat the row loop) and the
 *          empty-workdir shape
 *   B  the REAL t474 stack (read-only world read): iteration 200, twelve
 *      real classes, occupancy from the real data star (24 particles, 2
 *      per class), per-class null ×12, globalResolution 3.2; the per-class
 *      forest derives the stack name; the real bytes render to a real
 *      sheet (12 tiles, IHDR dims the grid math predicts)
 *   C  the judge end-to-end through the agent loop on the real bytes
 *      (bit-exact copies into the isolated fixture path — the real world
 *      is only ever READ): the mock VLM captures the wire prompt and
 *      answers a canned 12-class verdict twice; the merge agrees; the
 *      summary speaks "run at 3.2 Å (global)"; and the PROMPT ON THE WIRE
 *      carries the global estimate line plus the honest "resolution
 *      unknown" context — the t550 lesson, spoken where the VLM reads it
 *
 * Run: bun scripts/t550-judge-real-stack-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import (the t419 law)     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t550-judge-"));
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

const { classStatsFromWorkdir, deriveClassStackFromPerClass } = await import("../src/lib/ai/tools");
const { renderClassSheetPng } = await import("../src/lib/mrc");
const { ensureActiveProject } = await import("../src/lib/seed");
const { runAiIteration, deleteSessionForActiveProject } = await import("../src/lib/ai/agent");
const { applySettingsUpdate } = await import("../src/lib/ai/settings");
const { db } = await import("../src/lib/db");
const { deleteSession } = await import("../src/lib/ai/sessions");

/* ------------------------------------------------------------------ */
/* Star fixtures — the three real dialects, minimal and exact          */
/* ------------------------------------------------------------------ */

/** a particles data star: `count` particles spread round-robin over `k` classes */
function dataStar(rows: number[]): string {
  return (
    "data_particles\n\nloop_\n_rlnImageName #1\n_rlnClassNumber #2\n_rlnAngleRot #3\n" +
    rows.map((cls, i) => `${i + 1}@/x/stack.mrcs ${cls} 0.0`).join("\n") +
    "\n"
  );
}

/** dialect 3 — gold-standard: a global key-value and an FSC loop, NO per-class */
function goldStar(current: string): string {
  return (
    "data_model_general\n\n_rlnReferenceImage run_classes.mrcs\n" +
    `_rlnCurrentResolution ${current}\n\n` +
    "data_model_half1\n\nloop_\n_rlnResolution #1\n_rlnGoldStandardFsc #2\n0.01 1.0\n"
  );
}

/** dialect 2 — per-class blocks, one single-row loop each */
function perClassStar(res: [number, string][]): string {
  return (
    res
      .map(
        ([n, v]) =>
          `data_model_class_${n}\n\nloop_\n_rlnEstimatedResolution #1\n_rlnClassDistribution #2\n${v} 0.5\n`
      )
      .join("\n") + "\n"
  );
}

/** dialect 1 — the t520 shape: one loop, row order = class order */
function rowLoopStar(res: string[]): string {
  return (
    "data_model_general\n\nloop_\n_rlnEstimatedResolution #1\n" +
    res.map((v) => `${v}`).join("\n") +
    "\n"
  );
}

function makeWorkdir(files: Record<string, string>): string {
  const wd = mkdtempSync(path.join(TMP, "wd-"));
  for (const [name, body] of Object.entries(files)) writeFileSync(path.join(wd, name), body);
  return wd;
}

const it = (n: number) => String(n).padStart(3, "0");

/* ------------------------------------------------------------------ */
console.log("== PHASE A: the dialect units ==");
{
  // (1) gold-standard — the t474 shape: global present, per-class honestly null
  const wd = makeWorkdir({
    [`run_it${it(2)}_data.star`]: dataStar([1, 2, 1, 2]),
    [`run_it${it(2)}_model.star`]: goldStar("3.20"),
    [`run_it${it(2)}_classes.mrcs`]: "x",
  });
  const s = classStatsFromWorkdir(wd);
  must(s.iteration === 2, "A1: the latest iteration wins");
  must(s.globalResolution === 3.2, `A1: the global lands on globalResolution (got ${s.globalResolution})`);
  must(s.classes.length === 2 && s.classes.every((c) => c.resolution === null),
    "A1: per-class resolutions stay null — the global never wears a per-class badge");
  must(s.classes[0].count === 2 && s.classes[1].count === 2 && Math.abs(s.classes[0].fraction - 0.5) < 1e-9,
    "A1: occupancy still speaks from the data star");
  rmSync(wd, { recursive: true, force: true });
}
{
  // (2) per-class blocks — data_model_class_N names its own class
  const wd = makeWorkdir({
    [`run_it${it(3)}_data.star`]: dataStar([1, 2, 3]),
    [`run_it${it(3)}_model.star`]:
      "data_model_general\n\n_rlnCurrentResolution 4.10\n\n" + perClassStar([[1, "7.5"], [2, "9.1"], [3, "12.3"]]),
    [`run_it${it(3)}_classes.mrcs`]: "x",
  });
  const s = classStatsFromWorkdir(wd);
  must(s.globalResolution === 4.1, "A2: the general block's global rides alongside the per-class numbers");
  must(
    s.classes.map((c) => c.resolution).join(",") === "7.5,9.1,12.3",
    `A2: per-class blocks parse to their own classes (got ${s.classes.map((c) => c.resolution).join(",")})`
  );
  rmSync(wd, { recursive: true, force: true });
}
{
  // (3) the t520 single-loop dialect — row order = class order (regression)
  const wd = makeWorkdir({
    [`run_it${it(1)}_data.star`]: dataStar([1, 2, 3, 3]),
    [`run_it${it(1)}_model.star`]: rowLoopStar(["8.8", "11.2", "15.7"]),
    [`run_it${it(1)}_classes.mrcs`]: "x",
  });
  const s = classStatsFromWorkdir(wd);
  must(s.globalResolution === null, "A3: a loop-only star carries no global");
  must(s.classes.map((c) => c.resolution).join(",") === "8.8,11.2,15.7",
    "A3: the t520 row-loop dialect still parses (the regression guard)");
  rmSync(wd, { recursive: true, force: true });
}
{
  // (4) the priority law — per-class blocks beat the row loop
  const wd = makeWorkdir({
    [`run_it${it(1)}_data.star`]: dataStar([1, 2]),
    [`run_it${it(1)}_model.star`]:
      "data_model_general\n\nloop_\n_rlnEstimatedResolution #1\n8.8\n11.2\n\n" +
      perClassStar([[1, "9.9"]]),
    [`run_it${it(1)}_classes.mrcs`]: "x",
  });
  const s = classStatsFromWorkdir(wd);
  must(s.classes[0].resolution === 9.9 && s.classes[1].resolution === null,
    `A4: a named block outranks the row loop (got ${s.classes[0].resolution}/${s.classes[1].resolution})`);
  rmSync(wd, { recursive: true, force: true });
}
{
  // (5) the empty-workdir shape (no stars at all)
  const wd = makeWorkdir({ "notes.txt": "nothing here" });
  const s = classStatsFromWorkdir(wd);
  must(s.iteration === null && s.classes.length === 0 && s.globalResolution === null,
    "A5: a starless workdir answers the empty shape");
  rmSync(wd, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ */
console.log("== PHASE B: the REAL t474 stack (read-only) ==");
const REAL_WORKDIR = "/home/z/my-project/data/relion/cmur48ywy0000n5w2ihfsaadq/class2d_8wy7dl3m";
if (existsSync(REAL_WORKDIR)) {
  const realStack = path.join(REAL_WORKDIR, "run_it200_classes.mrcs");
  must(existsSync(realStack), "B: the real 200-iteration stack is on disk");
  const s = classStatsFromWorkdir(REAL_WORKDIR);
  must(s.iteration === 200, `B: the real iteration reads 200 (got ${s.iteration})`);
  must(s.classes.length === 12, `B: twelve real classes (got ${s.classes.length})`);
  must(s.total === 24, `B: the real data star counts 24 particles (got ${s.total})`);
  must(s.classes.every((c) => c.count === 2), "B: the real occupancy is 2 per class (the fixture's design)");
  const fracSum = s.classes.reduce((a, c) => a + c.fraction, 0);
  must(Math.abs(fracSum - 1) < 1e-9, `B: fractions sum to one (got ${fracSum})`);
  must(s.classes.every((c) => c.resolution === null),
    "B: the gold-standard dialect yields no per-class resolution — honest unknowns");
  must(s.globalResolution === 3.2, `B: the run's real global estimate reads 3.2 Å (got ${s.globalResolution})`);
  must(s.stackFile === "run_it200_classes.mrcs", `B: the stack picker names the real stack (got ${s.stackFile})`);
  must(deriveClassStackFromPerClass(REAL_WORKDIR, 200) === "run_it200_classes.mrcs",
    "B: the per-class forest derives the same stack name (the t520 pull-lane law on real files)");

  const sheet = await renderClassSheetPng(realStack);
  must(sheet != null && sheet.rendered === 12, `B: the real stack renders all twelve tiles (got ${sheet?.rendered})`);
  if (sheet) {
    // PNG signature + IHDR dims: 12 tiles → 4 cols × 3 rows at cell 64, gap 2
    const png = sheet.png;
    must(png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47, "B: the bytes are a real PNG");
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    must(w === 4 * 64 + 5 * 2 && h === 3 * 64 + 4 * 2, `B: IHDR dims match the grid math (${w}×${h})`);
  }
} else {
  console.log("  (skip) the t474 world is not on this disk — lane B needs the real forest");
  fail++;
  console.log("  FAIL B: the real t474 workdir is part of this bench's contract");
}

/* ------------------------------------------------------------------ */
console.log("== PHASE C: the judge end-to-end on the real bytes ==");
{
  const active = await ensureActiveProject();
  must(active != null, "C: the isolated world has an active project");
  const proj = active!.project;

  // the provider activation (the t419 phase-F idiom): the custom lane rides
  // the patched fetch, the builtin lane stays disabled — hermeticity holds
  applySettingsUpdate({ provider: "custom", apiKey: "mock-key", model: "mock-chat", baseUrl: "http://127.0.0.1:3999/v1", activate: true });

  // the fixture class2d at the DERIVED path the judge uses (no run record):
  // the real t474 trio copied bit-exact — the real world is only ever read
  const realTrio = ["run_it200_data.star", "run_it200_model.star", "run_it200_classes.mrcs"];
  const fixtureJobId = "cmu55000000000000000000judge01";
  await db.job.create({
    data: {
      id: fixtureJobId,
      projectId: proj.id,
      type: "class2d",
      name: "t550 Real Stack 2D",
      x: 0,
      y: 0,
      status: "completed",
    },
  });
  const fixtureWorkdir = path.join(DATA_DIR, "relion", proj.id, `class2d_${fixtureJobId.slice(-8)}`);
  mkdirSync(fixtureWorkdir, { recursive: true });
  for (const f of realTrio) copyFileSync(path.join(REAL_WORKDIR, f), path.join(fixtureWorkdir, f));
  must(realTrio.every((f) => existsSync(path.join(fixtureWorkdir, f))),
    "C: the real trio copied bit-exact into the fixture workdir");

  // the mock VLM: capture the wire prompt, answer a canned 12-class verdict
  const VISION_PROMPTS: string[] = [];
  const verdictJson = JSON.stringify({
    classes: Array.from({ length: 12 }, (_, i) => ({
      cls: i + 1,
      verdict: i < 6 ? "keep" : i < 8 ? "maybe" : "reject",
      reason: i < 6 ? "coherent particle with internal detail" : i < 8 ? "weak but plausible" : "featureless noise",
    })),
    advice: "Take the six sharp classes forward; the rest are noise or borderline.",
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/chat/completions")) {
      const raw = String(init?.body ?? "{}");
      const body = JSON.parse(raw);
      const text = JSON.stringify(body.messages ?? []);
      if (text.includes("data:image/png;base64")) {
        VISION_PROMPTS.push(String(body.messages?.[0]?.content?.[0]?.text ?? ""));
        return new Response(
          JSON.stringify({
            id: "chatcmpl-mock-vision",
            object: "chat.completion",
            choices: [{ index: 0, message: { role: "assistant", content: "```json\n" + verdictJson + "\n```" }, finish_reason: "stop" }],
            usage: {},
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      // the chat lane: dispatch the judge tool on the class2d mention
      const last = (body.messages ?? []).filter((m: { role: string }) => m.role === "user").pop();
      const t = String(last?.content ?? "");
      if (/分析|judge/i.test(t)) {
        const idMatch = t.match(/id:\s*([A-Za-z0-9_-]+)/);
        return new Response(
          JSON.stringify({
            id: "chatcmpl-mock",
            object: "chat.completion",
            choices: [{
              index: 0,
              message: {
                role: "assistant",
                content: "",
                tool_calls: [{ id: "call_j", type: "function", function: { name: "judge_2d_classes", arguments: JSON.stringify({ job_id: idMatch?.[1] ?? "" }) } }],
              },
              finish_reason: "tool_calls",
            }],
            usage: {},
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          id: "chatcmpl-mock",
          object: "chat.completion",
          choices: [{ index: 0, message: { role: "assistant", content: "DONE" }, finish_reason: "stop" }],
          usage: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (u.includes("/models")) {
      return new Response(JSON.stringify({ data: [{ id: "mock-chat" }, { id: "mock-vision" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  // the t543 law: a let inside the try block is a stranger to finally —
  // the declaration moves ABOVE the try or the cleanup chain dies unseen
  let judgeSessionId = "";
  try {
    const r1 = await runAiIteration({ message: `请分析 2D 分类任务 id: ${fixtureJobId} 的结果` });
    judgeSessionId = r1.sessionId ?? "";
    const judgeEvent = r1.events.find((e) => e.type === "tool_result" && e.name === "judge_2d_classes");
    must(r1.needsContinue && judgeEvent != null, "C: the judge tool dispatched");
    const jr = judgeEvent as {
      ok?: boolean;
      summary?: string;
      detail?: { judgedClasses?: { cls: number }[]; confirm?: { agreed?: number }; globalResolution?: number | null };
    };
    must(jr.ok === true, "C: the judge ran green on the real bytes");
    must((jr.detail?.judgedClasses?.length ?? 0) === 12, `C: twelve classes judged (got ${jr.detail?.judgedClasses?.length})`);
    must(jr.detail?.globalResolution === 3.2, `C: the detail carries the real global (got ${jr.detail?.globalResolution})`);
    must(/run at 3\.2 Å \(global\)/.test(jr.summary ?? ""), `C: the summary speaks the run's standing (got ${(jr.summary ?? "").slice(0, 120)})`);
    must(jr.detail?.confirm?.agreed === 12, `C: the two-pass merge agreed on all twelve (got ${jr.detail?.confirm?.agreed})`);

    // the money assertion — the prompt ON THE WIRE speaks the real run
    must(VISION_PROMPTS.length === 2, `C: both VLM passes captured (got ${VISION_PROMPTS.length})`);
    const prompt = VISION_PROMPTS[0] ?? "";
    must(prompt.includes("The run's current resolution estimate (global, gold-standard): 3.2 Å."),
      "C: the wire prompt carries the real global estimate line");
    must(prompt.includes("24 particles total") && prompt.includes("12 classes shown"),
      "C: the wire prompt speaks the real census");
    must(prompt.includes("judge those classes by the image alone"),
      "C: the honest unknown-context rides the rubric (the t550 lesson, spoken where the VLM reads it)");

    // the confirm pass must read the SAME rubric (stability bought where it confirms)
    must(VISION_PROMPTS[1] === VISION_PROMPTS[0], "C: the confirm pass runs the identical prompt (t545's law)");
  } finally {
    globalThis.fetch = originalFetch;
    if (judgeSessionId) await deleteSessionForActiveProject(judgeSessionId).catch(() => {});
    if (judgeSessionId) deleteSession(judgeSessionId);
  }

}

rmSync(TMP, { recursive: true, force: true });
console.log(`\nt550 judge real-stack: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
