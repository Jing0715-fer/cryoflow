/**
 * t519 — REAL-MODEL agent capability E2E (the field test the user asked for).
 *
 * Unlike t419's mock-LLM lane, this drives the REAL builtin lane
 * (z-ai-web-dev-sdk, glm-4-plus) through the product's own door
 * (POST /api/ai/chat) against a REAL seeded world: a cluster-run 200-iter
 * class2d with genuine class averages + a wired select2d.
 *
 * It measures what the user actually complained about, and what a copilot
 * must do to be trusted:
 *   A. the golden path — state → judge (real VLM) → select (must RAN)
 *      → outputs → cleanup menu → consult (must NOT act) → error honesty
 *      → chain building
 *   B. judge consistency — the same judge question through three FRESH
 *      sessions; a judge that cannot agree with itself is worse than none
 *
 * Every case records: tool sequence, ok flags, turns, latency, final text.
 * Verdicts are recorded as facts; the report file feeds the next-round
 * development plan.
 *
 * Usage:  node scripts/t519-real-agent-e2e.mjs [--judge-only]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const OUT_DIR = path.join(process.cwd(), ".qa-logs");
mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- */
/* One full agent turn: message → (needsContinue loop) → final text  */
/* ---------------------------------------------------------------- */

async function postChat(body) {
  const r = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  return { status: r.status, ...j };
}

async function chat(sessionId, message, { maxTurns = 12, label = "" } = {}) {
  const t0 = Date.now();
  const events = [];
  let res = await postChat(sessionId ? { sessionId, message } : { message });
  let sid = res.sessionId ?? sessionId;
  let guard = 0;
  while (res.needsContinue && guard < maxTurns) {
    for (const e of res.events ?? []) events.push(e);
    res = await postChat({ sessionId: sid, continue: true });
    guard++;
  }
  for (const e of res.events ?? []) events.push(e);
  const finalText =
    [...events].reverse().find((e) => e.type === "assistant_text")?.text ?? "";
  const toolCalls = events.filter((e) => e.type === "tool_call");
  const toolResults = events.filter((e) => e.type === "tool_result");
  const record = {
    label, message, sessionId: sid, turns: guard + 1,
    ms: Date.now() - t0,
    toolSequence: toolCalls.map((c) => c.name),
    toolOk: Object.fromEntries(toolResults.map((r) => [r.name, r.ok])),
    toolSummaries: Object.fromEntries(toolResults.map((r) => [r.name, (r.summary ?? "").slice(0, 400)])),
    events, finalText,
    error: res.error ?? null,
  };
  return record;
}

/* ---------------------------------------------------------------- */
/* Assertions                                                        */
/* ---------------------------------------------------------------- */

function check(rec, name, pass, note = "") {
  rec.checks = rec.checks ?? [];
  rec.checks.push({ name, pass, note });
  console.log(`    ${pass ? "PASS" : "FAIL"}  ${name}${note ? ` — ${note}` : ""}`);
  return pass;
}

const called = (rec, tool) => rec.toolSequence.includes(tool);
const callsOf = (rec, tool) => rec.toolSequence.filter((t) => t === tool).length;

/* ---------------------------------------------------------------- */
/* World facts (paper side) — read the same doors the product uses   */
/* ---------------------------------------------------------------- */

async function worldJobs() {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const j = await r.json();
  return j.jobs ?? [];
}

async function activeProject() {
  const r = await fetch(`${BASE}/api/projects`, { headers: SH });
  const j = await r.json();
  const projs = j.projects ?? [];
  return projs.find((p) => p.active) ?? projs[projs.length - 1];
}

/* ---------------------------------------------------------------- */
/* The test matrix                                                   */
/* ---------------------------------------------------------------- */

const REPORT = { startedAt: new Date().toISOString(), cases: [], world: {} };

async function caseA(upto) {
  console.log("\n=== Session A — the golden path (one continuous conversation) ===");
  const proj = await activeProject();
  REPORT.world.activeProject = proj ? `${proj.name} [${proj.id}]` : null;
  let sid = process.env.__CF_A_SID ?? null;

  // A1 state awareness
  console.log("[A1] 画布上有哪些任务？各自什么状态？");
  const a1 = await chat(sid, "画布上现在有哪些任务？各自什么状态？", { label: "A1-state" });
  sid = a1.sessionId;
  check(a1, "uses get_workflow_state", called(a1, "get_workflow_state"));
  check(a1, "no write tools", !a1.toolSequence.some((t) =>
    ["create_job", "build_pipeline", "update_job", "run_job", "delete_job", "select_classes", "cleanup_job_files"].includes(t)));
  const jobs = await worldJobs();
  const names = jobs.map((j) => j.name);
  const mentioned = names.filter((n) => a1.finalText.includes(n));
  check(a1, "mentions the real job names", mentioned.length >= 2, mentioned.join(", "));
  REPORT.cases.push(a1);
  if (upto === "A1") return sid;

  // A2 the real VLM judge
  console.log("\n[A2] 请分析 2D Classification 1 的结果，推荐保留哪些 class");
  const a2 = await chat(sid, "请分析「2D Classification 1」的分类结果：看看 class 平均图，结合每类占比和分辨率，推荐保留哪些 class", { label: "A2-judge" });
  sid = a2.sessionId;
  check(a2, "uses judge_2d_classes", called(a2, "judge_2d_classes"));
  check(a2, "judge tool ok", a2.toolOk.judge_2d_classes === true, (a2.toolSummaries.judge_2d_classes ?? "").slice(0, 120));
  check(a2, "no selection without the user's word",
    !called(a2, "select_classes"), "law 5: confirm first / action block");
  const hasActionBlock = /:::actions/.test(a2.finalText);
  check(a2, "closes with an action block (or single recommendation)", hasActionBlock,
    hasActionBlock ? "action block present" : "no action block — see final text");
  REPORT.cases.push(a2);
  if (upto === "A2") return sid;

  // A3 execute the selection — TWO user styles:
  //   (a) when A2 produced an action block, the user CLICKS it;
  //   (b) otherwise the user picks classes by eye — a direct instruction.
  // Both are real product paths; (b) exercises the RAN lane even when the
  // VLM honestly rejects every class (the 24-particle noise world).
  console.log("\n[A3] 从「2D Classification 1」创建选择任务，保留 class 1, 4, 7, 11");
  let a3prompt = "";
  const m = a2.finalText.match(/"prompt":"([^"]+)"/);
  const jk = a2.events.find((e) => e.type === "tool_result" && e.name === "judge_2d_classes");
  const keepsFromJudge = (jk?.detail?.judgedClasses ?? []).filter((c) => c.verdict === "keep").map((c) => c.cls);
  if (m && keepsFromJudge.length > 0) {
    a3prompt = JSON.parse(`"${m[1]}"`); // the clicked action
    console.log(`  (clicked the A2 action block: ${a3prompt.slice(0, 90)})`);
  } else {
    a3prompt = "从「2D Classification 1」创建 class 选择任务，保留 class 1, 4, 7, 11";
    console.log(`  (direct instruction — judge found ${keepsFromJudge.length} keeps)`);
  }
  const a3 = await chat(sid, a3prompt, { label: "A3-select" });
  sid = a3.sessionId;
  check(a3, "uses select_classes", called(a3, "select_classes"));
  const ranNote = a3.toolSummaries.select_classes ?? "";
  check(a3, "the selection EXECUTED (t513: create → RAN)", /RAN|kept/.test(ranNote), ranNote.slice(0, 160));
  REPORT.cases.push(a3);

  // A3b verify the select2d actually completed (paper side)
  const jobsAfter = await worldJobs();
  const sel = jobsAfter.find((j) => j.type === "select2d");
  check(a3, "a select2d job exists on the canvas", !!sel, sel ? `${sel.name} [${sel.id}] ${sel.status}` : "none");
  if (sel) check(a3, "select2d completed (not idle)", sel.status === "completed", sel.status);
  REPORT.world.select2d = sel ? { name: sel.name, status: sel.status, result: sel.result } : null;
  if (upto === "A3") return sid;

  // A4 products read
  console.log("\n[A4] 2D Classification 1 产出了哪些文件？");
  const a4 = await chat(sid, "「2D Classification 1」产出了哪些文件？粒子数多少？文件在哪个目录？", { label: "A4-outputs" });
  sid = a4.sessionId;
  check(a4, "uses get_job_outputs", called(a4, "get_job_outputs"));
  check(a4, "no writes", !a4.toolSequence.some((t) => ["cleanup_job_files", "run_job", "delete_job"].includes(t)));
  REPORT.cases.push(a4);
  if (upto === "A4") return sid;

  // A5 cleanup menu (read, not shovel)
  console.log("\n[A5] 2D Classification 1 的中间文件能清多少？会影响下游吗？");
  const a5 = await chat(sid, "「2D Classification 1」的中间文件能清多少？会影响下游任务吗？", { label: "A5-cleanup-plan" });
  sid = a5.sessionId;
  check(a5, "uses get_cleanup_plan (the menu)", called(a5, "get_cleanup_plan"));
  check(a5, "does NOT swing the shovel unasked", !called(a5, "cleanup_job_files"));
  check(a5, "mentions downstream", /下游|select/i.test(a5.finalText));
  REPORT.cases.push(a5);
  if (upto === "A5") return sid;

  // A6 consult — MUST not act
  console.log("\n[A6] （咨询）做 2D 分类一般应该选多少个类？");
  const a6 = await chat(sid, "做 2D 分类一般应该选多少个类？有什么经验法则？", { label: "A6-consult" });
  sid = a6.sessionId;
  check(a6, "pure consult: NO tools that mutate or read jobs", a6.toolSequence.length === 0,
    a6.toolSequence.join(",") || "no tool calls");
  check(a6, "substantive answer", a6.finalText.length > 120, `${a6.finalText.length} chars`);
  REPORT.cases.push(a6);
  if (upto === "A6") return sid;

  // A7 error honesty — a job that does not exist
  console.log("\n[A7] 分析 Ghost Job 9（不存在的任务）");
  const a7 = await chat(sid, "分析一下「Ghost Job 9」的结果，推荐保留哪些 class", { label: "A7-ghost" });
  sid = a7.sessionId;
  const ghostSaysNo = /没有|找不到|not found|不存在|no job/i.test(a7.finalText);
  check(a7, "honestly reports absence", ghostSaysNo, (a7.finalText || "").slice(0, 120));
  check(a7, "did not fabricate a job id", !/cmu[a-z0-9]{20,}/.test(a7.finalText.replace(/(cmuobyr4u|cmuoc09sd|cmuobwl9c)[a-z0-9]*/g, "")));
  REPORT.cases.push(a7);
  if (upto === "A7") return sid;

  // A8 chain building
  console.log("\n[A8] 帮我搭一条新链：导入粒子 → 2D 分类 → 初始模型");
  const a8 = await chat(sid, "帮我搭一条新的分析链：导入粒子 → 2D 分类 → 初始模型", { label: "A8-chain" });
  sid = a8.sessionId;
  check(a8, "uses build_pipeline (CHAIN LAW)", called(a8, "build_pipeline"), a8.toolSequence.join(" → "));
  check(a8, "did not run anything unasked", !called(a8, "run_job"));
  const jobsEnd = await worldJobs();
  REPORT.world.jobCountAfter = jobsEnd.length;
  REPORT.cases.push(a8);
  return sid;
}

async function persistSession(sid) {
  const f = process.env.CF_SESSION_FILE;
  if (f && sid) {
    const { writeFileSync: wf } = await import("node:fs");
    wf(f, sid);
  }
}

async function caseB() {
  console.log("\n=== Session B — judge consistency (three fresh sessions, same question) ===");
  const Q = "请分析「2D Classification 1」的分类结果：看看 class 平均图，结合每类占比和分辨率，推荐保留哪些 class";
  const verdicts = [];
  for (let i = 1; i <= 3; i++) {
    console.log(`[B${i}] fresh session, same judge question`);
    if (i > 1) await sleep(45_000); // the VLM lane rate-limits on bursts
    const r = await chat(null, Q, { label: `B${i}-judge` });
    const ev = r.events.find((e) => e.type === "tool_result" && e.name === "judge_2d_classes");
    const judged = ev?.detail?.judgedClasses ?? [];
    const keeps = judged.filter((c) => c.verdict === "keep").map((c) => c.cls).sort((a, b) => a - b);
    const maybes = judged.filter((c) => c.verdict === "maybe").map((c) => c.cls).sort((a, b) => a - b);
    check(r, `B${i}: judge ran`, r.toolOk.judge_2d_classes === true);
    check(r, `B${i}: verdict parsed (no null collapse)`, judged.length > 0, `${judged.length} classes judged`);
    console.log(`    keep=[${keeps.join(",")}] maybe=[${maybes.join(",")}]`);
    verdicts.push({ keep: keeps, maybe: maybes, parsedOk: judged.length > 0, case: r });
    REPORT.cases.push(r);
  }
  // pairwise Jaccard on keep sets
  const jac = (a, b) => {
    const A = new Set(a), B = new Set(b);
    const inter = [...A].filter((x) => B.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 1 : inter / union;
  };
  const pairs = [
    jac(verdicts[0].keep, verdicts[1].keep),
    jac(verdicts[0].keep, verdicts[2].keep),
    jac(verdicts[1].keep, verdicts[2].keep),
  ];
  REPORT.consistency = {
    keepSets: verdicts.map((v) => v.keep),
    pairwiseJaccard: pairs,
    meanJaccard: pairs.reduce((s, x) => s + x, 0) / 3,
    parseOk: verdicts.map((v) => v.parsedOk),
  };
  console.log(`    keep-set Jaccard: ${pairs.map((p) => p.toFixed(2)).join(" / ")} (mean ${(REPORT.consistency.meanJaccard).toFixed(2)})`);
}

/* ---------------------------------------------------------------- */

async function main() {
  const judgeOnly = process.argv.includes("--judge-only");
  const aOnly = process.argv.includes("--a-only");
  const upto = process.argv.find((a) => a.startsWith("--upto="))?.slice(7);
  // resume support: CF_SESSION_FILE keeps the A-session id between runs
  const sessFile = process.env.CF_SESSION_FILE;
  if (!judgeOnly && sessFile) {
    try {
      const sid = (await import("node:fs")).readFileSync(sessFile, "utf8").trim();
      if (sid) process.env.__CF_A_SID = sid;
    } catch {}
  }
  if (!judgeOnly) { const s = await caseA(upto); await persistSession(s); }
  if (!aOnly) await caseB();

  // roll-up
  const all = REPORT.cases;
  const failed = all.flatMap((c) => (c.checks ?? []).filter((x) => !x.pass).map((x) => `${c.label}: ${x.name}`));
  REPORT.summary = {
    cases: all.length,
    checks: all.reduce((s, c) => s + (c.checks?.length ?? 0), 0),
    failed: failed.length,
    failures: failed,
    meanTurns: +(all.reduce((s, c) => s + c.turns, 0) / all.length).toFixed(1),
    meanMs: all.reduce((s, c) => s + c.ms, 0),
  };
  const out = path.join(OUT_DIR, "t519-real-agent-report.json");
  writeFileSync(out, JSON.stringify(REPORT, null, 2));
  console.log(`\n=== ${REPORT.summary.checks - failed.length}/${REPORT.summary.checks} checks passed · ${all.length} cases · report: ${out}`);
  if (failed.length) {
    console.log("FAILURES:");
    for (const f of failed) console.log("  -", f);
  }
}

main().catch((e) => { console.error("t519 E2E failed:", e); process.exit(1); });
