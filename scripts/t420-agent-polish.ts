/**
 * t420 — the agent polish bench: build_pipeline + wait_for_jobs end to end.
 *
 * The t419 delivery gave the assistant hands; this round gives it reach —
 * one-call chains and in-turn settling. Phases, no world pollution:
 *   A. pure validation (normalizePipelineSteps, clampWaitSeconds)
 *   B. build_pipeline live against the isolated DB: a 5-step chain off the
 *      seeded import (jobs + wires + params + head/tail contract), the
 *      fail-fast type gate (a typo in step 3 creates NOTHING), the unknown
 *      connect_from refusal, the dropped-param ledger
 *   C. wait_for_jobs live: a job that settles mid-wait (timer flip) is
 *      caught with allSettled; a job that never settles returns the honest
 *      timeout with progress; the caps and unknown-id refusals
 *   D. the system prompt grounds the new tools + the end-to-end recipe
 *   E. the FULL agent loop with the new tools (mock LLM, in-process fetch):
 *      "从头到尾" → state → build_pipeline → run_job (waiting verdict, no
 *      engine spawn) → wait_for_jobs (honest still-pending) → narration
 *
 * Run: bun scripts/t420-agent-polish.ts
 */

import { execSync } from "child_process";
import { mkdtempSync, mkdirSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t420-agent-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* Imports (after env)                                                 */
/* ------------------------------------------------------------------ */

const {
  normalizePipelineSteps,
  executeAiTool,
  AI_TOOLS,
  clampWaitSeconds,
} = await import("../src/lib/ai/tools");
const { buildSystemPrompt } = await import("../src/lib/ai/prompt");
const { runAiIteration } = await import("../src/lib/ai/agent");
const { applySettingsUpdate } = await import("../src/lib/ai/settings");
const { db } = await import("../src/lib/db");
const { ensureActiveProject } = await import("../src/lib/seed");

const active = await ensureActiveProject();
must(active != null, "the isolated world has an active project");
const project = active!.project;
const ctx = { projectId: project.id };

/* ------------------------------------------------------------------ */
/* A. Pure validation                                                   */
/* ------------------------------------------------------------------ */

console.log("A. pure validation");
{
  const empty = normalizePipelineSteps(undefined);
  must(empty.error != null && empty.steps.length === 0, "A1: non-array steps refused");
  const none = normalizePipelineSteps([]);
  must(none.error != null, "A2: empty steps refused");
  const tooMany = normalizePipelineSteps(
    Array.from({ length: 13 }, (_, i) => ({ type: `t${i}` }))
  );
  must(tooMany.error != null && /cap is 12/.test(tooMany.error!), "A3: 13 steps refused with the cap named");
  const noType = normalizePipelineSteps([{ name: "x" }]);
  must(noType.error != null && /missing its type/.test(noType.error!), "A4: a step without type refused");
  const junk = normalizePipelineSteps(["motioncorr"]);
  must(junk.error != null && /not an object/.test(junk.error!), "A5: a string step refused");
  const good = normalizePipelineSteps([
    { type: "motioncorr", params: { dosePerFrame: 1.2 } },
    { type: "ctffind", name: "我的 CTF" },
    { type: "class2d", params: { numClasses: 20 }, extra: true },
  ]);
  must(
    good.error == null &&
      good.steps.length === 3 &&
      good.steps[0].type === "motioncorr" &&
      good.steps[0].params != null &&
      good.steps[1].name === "我的 CTF" &&
      good.steps[2].type === "class2d",
    "A6: a valid 3-step chain parses (params + names kept)"
  );
  must(clampWaitSeconds(undefined) === 45, "A7: default wait 45s");
  must(clampWaitSeconds(0) === 1 && clampWaitSeconds(999) === 180 && clampWaitSeconds(12.7) === 13, "A8: wait seconds clamped to [1,180]");
  const registered = AI_TOOLS.map((t) => t.name);
  must(registered.includes("build_pipeline") && registered.includes("wait_for_jobs"), "A9: both new tools registered in the catalog");
}

/* ------------------------------------------------------------------ */
/* B. build_pipeline live                                               */
/* ------------------------------------------------------------------ */

console.log("B. build_pipeline (isolated DB)");
const seededImport = await db.job.findFirst({
  where: { projectId: project.id, type: "import" },
});
must(seededImport != null, "B0: the seeded import exists to chain from");

const edgesBefore = await db.edge.count({ where: { projectId: project.id } });
const jobsBefore = await db.job.count({ where: { projectId: project.id } });

// B1: the 5-step chain off the seeded import
{
  const r = await executeAiTool(
    "build_pipeline",
    {
      connect_from: seededImport!.id,
      steps: [
        { type: "motioncorr", params: { dosePerFrame: 1.5 } },
        { type: "ctffind" },
        { type: "manualpick" },
        { type: "extract" },
        { type: "class2d", params: { numClasses: 20, bogusKey: "x" } },
      ],
    },
    ctx
  );
  must(r.ok, `B1: the 5-step chain builds (summary: ${r.summary})`);
  const detail = r.detail as {
    jobs: { id: string; name: string; type: string }[];
    head: string;
    tail: string;
    refusedWires: unknown[];
    dropped: string[];
  };
  must(detail.jobs.length === 5, "B1a: five jobs in the ledger");
  must(detail.head === detail.jobs[0].id && detail.tail === detail.jobs[4].id, "B1b: head/tail contract");
  must(detail.refusedWires.length === 0, "B1c: no refused wires (the SPA canon chain)");
  must(detail.dropped.length === 1 && detail.dropped[0].includes("bogusKey"), `B1d: the bogus param lands in the ledger (${detail.dropped.join()})`);

  const after = await db.job.count({ where: { projectId: project.id } });
  must(after === jobsBefore + 5, `B1e: exactly 5 jobs created (got ${after - jobsBefore})`);
  const edgesAfter = await db.edge.count({ where: { projectId: project.id } });
  must(edgesAfter === edgesBefore + 5, `B1f: 5 wires drawn (import→mc + 4 in-chain; got ${edgesAfter - edgesBefore})`);

  const class2d = await db.job.findFirst({
    where: { projectId: project.id, type: "class2d" },
    orderBy: { createdAt: "desc" },
  });
  const params = JSON.parse(class2d!.params || "{}") as Record<string, unknown>;
  must(params.numClasses === 20, "B1g: numClasses landed on the class2d step");
  must(!("bogusKey" in params), "B1h: the bogus param never reached the row");

  // the chain reads head-to-tail on the canvas: x strictly increasing
  const chainIds = detail.jobs.map((j) => j.id);
  const rows = await db.job.findMany({ where: { id: { in: chainIds } } });
  const byId = new Map(rows.map((r2) => [r2.id, r2]));
  const xs = chainIds.map((id) => byId.get(id)!.x);
  must(xs.every((x, i) => i === 0 || x > xs[i - 1]), "B1i: the chain positions left→right (the canvas reads like the pipeline)");
}

// B2: fail-fast — a typo in step 3 must create NOTHING
// t463 contract change: a NEAR-MISS typo ("motioncorrr") is now RECOVERED
// by the alias ladder (fuzzy containment, narrated in the summary) — the
// field failure this repo shipped to fix. Only true garbage refuses.
{
  const r = await executeAiTool(
    "build_pipeline",
    { steps: [{ type: "motioncorr" }, { type: "ctffind" }, { type: "motioncorrr" }] },
    ctx
  );
  must(r.ok === true && /interpreted stage names: step 3: "motioncorrr" → motioncorr/.test(r.summary), "B2: the near-miss typo is recovered AND narrated");
  const after = await db.job.count({ where: { projectId: project.id } });
  must(after === jobsBefore + 5 + 3, `B2a: the recovered chain landed its 3 jobs (delta ${after - jobsBefore - 5})`);
  // true garbage still fails fast, creating nothing (the pre-flight gate)
  const before2 = await db.job.count({ where: { projectId: project.id } });
  const junk = await executeAiTool(
    "build_pipeline",
    { steps: [{ type: "motioncorr" }, { type: "flurbgarbage" }] },
    ctx
  );
  must(!junk.ok && /unknown job type "flurbgarbage"/.test(junk.summary), "B2b: garbage types still refuse with the name in the message");
  const after2 = await db.job.count({ where: { projectId: project.id } });
  must(after2 === before2, "B2c: nothing was created by the refused chain (the pre-flight type gate)");
}

// B3: unknown connect_from refused
{
  const r = await executeAiTool("build_pipeline", { connect_from: "nope", steps: [{ type: "motioncorr" }] }, ctx);
  must(!r.ok && /not found in this project: nope/.test(r.summary), "B3: unknown connect_from refused");
}

// B4: the standalone create_job still works after the refactor (regression)
{
  const r = await executeAiTool("create_job", { type: "select", name: "回归选择" }, ctx);
  must(r.ok && /回归选择/.test(r.summary), "B4: create_job keeps its contract after the createOneJob refactor");
  const detail = r.detail as { job?: { id?: string }; wired?: boolean };
  must(detail.job?.id != null && detail.wired === false, "B4a: the DTO + wired flag still ride the result");
}

/* ------------------------------------------------------------------ */
/* C. wait_for_jobs live                                                */
/* ------------------------------------------------------------------ */

console.log("C. wait_for_jobs (isolated DB)");

// C1: a job that settles mid-wait is caught
{
  const settled = await db.job.findFirst({
    where: { projectId: project.id, type: "motioncorr", status: "idle" },
    orderBy: { createdAt: "desc" },
  });
  must(settled != null, "C1 precondition: an idle chain job exists");
  // flip it to running, then to completed 1.6s in — the waiter must see it
  await db.job.update({
    where: { id: settled!.id },
    data: { status: "running", progress: 0.4, result: null },
  });
  const timer = setTimeout(() => {
    db.job.update({
      where: { id: settled!.id },
      data: { status: "completed", progress: 1, result: "All 25 micrographs processed" },
    })
      .then(() => console.log("  (c1 timer: completed write landed)"))
      .catch((e) => console.log(`  (c1 timer REJECTED: ${String(e).slice(0, 200)})`));
  }, 1600);
  const t0 = Date.now();
  const r = await executeAiTool(
    "wait_for_jobs",
    { job_ids: [settled!.id], timeout_sec: 15 },
    ctx
  );
  clearTimeout(timer);
  must(r.ok, `C1: the wait resolves (summary: ${r.summary})`);
  const detail = r.detail as {
    jobs: { status: string; result: string | null }[];
    allSettled: boolean;
    waitedMs: number;
  };
  must(detail.allSettled === true, "C1a: allSettled verdict");
  must(detail.jobs[0].status === "completed", "C1b: the settled status is read fresh from the DB");
  must(detail.jobs[0].result === "All 25 micrographs processed", "C1c: the result line rides the report");
  must(Date.now() - t0 >= 1500, "C1d: it actually waited (the poll loop ran)");
}

// C2: the honest timeout — a job that never settles
{
  const stuck = await db.job.findFirst({
    where: { projectId: project.id, type: "ctffind", status: "idle" },
    orderBy: { createdAt: "desc" },
  });
  await db.job.update({
    where: { id: stuck!.id },
    data: { status: "running", progress: 0.62 },
  });
  const t0 = Date.now();
  const r = await executeAiTool("wait_for_jobs", { job_ids: [stuck!.id], timeout_sec: 2 }, ctx);
  must(r.ok, "C2: the honest timeout still answers ok (it waited, it reported)");
  must(/still 1 running\/pending after 2s/.test(r.summary), `C2a: the summary says still running (got: ${r.summary})`);
  must(/62%/.test(r.summary), "C2b: the progress percentage rides the honest report");
  const detail = r.detail as { allSettled: boolean; timeoutSec: number };
  must(detail.allSettled === false && detail.timeoutSec === 2, "C2c: the detail carries the verdict + the timeout asked for");
  must(Date.now() - t0 >= 1900, "C2d: it burned the full 2s (no early exit)");
  // restore idle so later phases stay clean
  await db.job.update({ where: { id: stuck!.id }, data: { status: "idle", progress: 0 } });
}

// C3: guards — empty, unknown, over-cap
{
  const rEmpty = await executeAiTool("wait_for_jobs", { job_ids: [] }, ctx);
  must(!rEmpty.ok && /job_ids is empty/.test(rEmpty.summary), "C3: empty ids refused");
  const rUnknown = await executeAiTool("wait_for_jobs", { job_ids: ["ghost"] }, ctx);
  must(!rUnknown.ok && /not found in this project: ghost/.test(rUnknown.summary), "C3a: unknown id refused");
  const rCap = await executeAiTool("wait_for_jobs", { job_ids: Array.from({ length: 11 }, (_, i) => `j${i}`) }, ctx);
  must(!rCap.ok && /cap is 10/.test(rCap.summary), "C3b: the 11-id cap");
}

/* ------------------------------------------------------------------ */
/* D. Prompt grounding                                                  */
/* ------------------------------------------------------------------ */

console.log("D. system prompt grounding");
{
  const prompt = buildSystemPrompt({
    projectName: "p",
    projectMode: "SPA",
    projectRemote: null,
    jobCount: 3,
  });
  must(prompt.includes("build_pipeline"), "D1: the prompt teaches build_pipeline");
  must(prompt.includes("wait_for_jobs"), "D2: the prompt teaches wait_for_jobs");
  must(prompt.includes("end-to-end recipe"), "D3: the end-to-end recipe is on the page");
  must(/never claim a job finished while it runs/i.test(prompt), "D4: the honesty law for running jobs");
}

/* ------------------------------------------------------------------ */
/* E. Agent E2E — the new tools through the real loop (mock LLM)        */
/* ------------------------------------------------------------------ */

console.log("E. agent end-to-end with the new tools");

applySettingsUpdate({ provider: "custom", apiKey: "mock-key", model: "mock-chat", baseUrl: "http://127.0.0.1:3999/v1", activate: true });

// the scripted mock: 「从头到尾」 → state → build_pipeline → run_job (a
// downstream step = the waiting verdict, no engine spawn) → wait_for_jobs
// (short honest timeout) → narration. Deterministic, no real binaries.
function mockToolCall(id: string, name: string, args: unknown) {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
  const u = String(url);
  if (!u.includes("/chat/completions")) return new Response("not found", { status: 404 });
  const body = JSON.parse(String(init?.body ?? "{}")) as {
    messages: { role: string; content?: unknown; tool_calls?: { id?: string; function: { name: string; arguments: string } }[] }[];
  };
  const messages = body.messages;
  const last = messages[messages.length - 1];
  const toolNameOf = (m: { role: string; tool_call_id?: string }): string | null => {
    if (m.role !== "tool" || !m.tool_call_id) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const a = messages[i];
      if (a.role === "assistant" && a.tool_calls) {
        const hit = a.tool_calls.find((t) => t.id === m.tool_call_id);
        if (hit) return hit.function.name;
      }
    }
    return null;
  };
  let payload: { content?: string; tool_calls?: ReturnType<typeof mockToolCall>[] };
  if (last.role === "user") {
    payload = { tool_calls: [mockToolCall("c1", "get_workflow_state", {})] };
  } else if (last.role === "tool") {
    const name = toolNameOf(last as unknown as { role: string; tool_call_id?: string });
    let parsed: { detail?: { jobs?: { id?: string; type?: string; name?: string }[]; head?: string } } = {};
    try {
      parsed = JSON.parse(String(last.content));
    } catch {
      /* keep {} */
    }
    if (name === "get_workflow_state") {
      payload = {
        tool_calls: [
          mockToolCall("c2", "build_pipeline", {
            connect_from: parsed.detail?.jobs?.find((j) => j.type === "import")?.id,
            steps: [{ type: "motioncorr" }, { type: "ctffind" }, { type: "autopick" }],
          }),
        ],
      };
    } else if (name === "build_pipeline") {
      payload = {
        tool_calls: [
          mockToolCall("c3", "run_job", { job_id: parsed.detail?.head }),
        ],
      };
    } else if (name === "run_job") {
      // the head id lives in the BUILD_PIPELINE result — scan back for it
      let head: string | undefined;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role !== "tool") continue;
        if (toolNameOf(m as unknown as { role: string; tool_call_id?: string }) !== "build_pipeline") continue;
        try {
          const bp = JSON.parse(String(m.content)) as { detail?: { head?: string } };
          head = bp.detail?.head;
        } catch {
          /* keep scanning */
        }
        if (head) break;
      }
      payload = {
        tool_calls: [
          mockToolCall("c4", "wait_for_jobs", { job_ids: [head ?? "x"], timeout_sec: 2 }),
        ],
      };
    } else if (name === "wait_for_jobs") {
      payload = {
        content:
          "DONE-E2E：链已建好（build_pipeline 一步到位），头部任务已排队自动启动；短等待内未全部完成 — 我可以稍后再查。流程：import → motioncorr → ctffind → autopick。",
      };
    } else {
      payload = { content: "DONE" };
    }
  } else {
    payload = { content: "…" };
  }
  return new Response(
    JSON.stringify({
      id: "chatcmpl-mock",
      object: "chat.completion",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: payload.content ?? "",
            ...(payload.tool_calls?.length ? { tool_calls: payload.tool_calls } : {}),
          },
          finish_reason: payload.tool_calls?.length ? "tool_calls" : "stop",
        },
      ],
      usage: {},
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}) as typeof fetch;

try {
  const jobsAtStart = await db.job.count({ where: { projectId: project.id } });

  const r1 = await runAiIteration({ message: "从头到尾帮我跑一遍流程" });
  const sid = r1.sessionId;
  must(r1.needsContinue && r1.events.some((e) => e.type === "tool_call" && e.name === "get_workflow_state"), "E1: the state-first doctrine holds");
  const r2 = await runAiIteration({ sessionId: sid, cont: true });
  must(r2.needsContinue && r2.events.some((e) => e.type === "tool_call" && e.name === "build_pipeline"), "E2: the mock drives build_pipeline");
  const r3 = await runAiIteration({ sessionId: sid, cont: true });
  must(r3.needsContinue && r3.events.some((e) => e.type === "tool_call" && e.name === "run_job"), "E3: run_job follows the chain verdict");
  const r4 = await runAiIteration({ sessionId: sid, cont: true });
  must(r4.needsContinue && r4.events.some((e) => e.type === "tool_call" && e.name === "wait_for_jobs"), "E4: wait_for_jobs rides the loop");
  const r5 = await runAiIteration({ sessionId: sid, cont: true });
  must(!r5.needsContinue && r5.events.some((e) => e.type === "assistant_text" && e.text.includes("DONE-E2E")), "E5: the final narration lands");

  // the chain the loop built: 3 more jobs (motioncorr/ctffind/autopick)
  const jobsAfter = await db.job.count({ where: { projectId: project.id } });
  must(jobsAfter === jobsAtStart + 3, `E6: the E2E chain created exactly 3 jobs (got ${jobsAfter - jobsAtStart})`);

  // the run_job verdict was the waiting lane (upstream idle — no spawn)
  const runResult = r3.events.find((e) => e.type === "tool_result" && e.name === "run_job") as
    | { type: "tool_result"; ok: boolean; summary: string }
    | undefined;
  must(runResult != null && runResult.ok && /waiting/.test(runResult.summary), `E7: the waiting verdict spoke (got: ${runResult?.summary ?? "none"})`);

  // the wait verdict was the honest timeout
  const waitResult = r5.events.find((e) => e.type === "tool_result" && e.name === "wait_for_jobs") as
    | { type: "tool_result"; ok: boolean; summary: string }
    | undefined;
  // (it may ride r4's own iteration — search both)
  const waitResult2 = r4.events.find((e) => e.type === "tool_result" && e.name === "wait_for_jobs") as
    | { type: "tool_result"; ok: boolean; summary: string }
    | undefined;
  const waitSummary = (waitResult ?? waitResult2)?.summary ?? "";
  must(/still|settled/.test(waitSummary), `E8: the wait answered with a verdict (got: ${waitSummary})`);
} finally {
  globalThis.fetch = originalFetch;
}

/* ------------------------------------------------------------------ */

console.log(`\n${pass} passed, ${fail} failed ${fail === 0 ? "— ALL GREEN" : "— FAILURES ABOVE"}`);
process.exit(fail === 0 ? 0 : 1);
