#!/usr/bin/env node
/* t552 — the KEEP verdict's first live-fire on real, resolvable data.
 *
 * World: EMPIAR-10017 real t372 (class2d K5 — 10,866 real β-gal particles,
 * 5 classes with visible structural features, single-loop per-class
 * EstimatedResolution dialect 25–45 Å, global 25.17 Å). The t474 stack only
 * ever tested the reject face (2 particles/class); this run can test the
 * keep face for real.
 *
 * Arc (4 sessions):
 *   S1–S3: fresh sessions, same judge question — consistency on real data.
 *   S4:    judge question, then the USER'S WORD ("按你推荐的保留类来") —
 *          the golden path judge → recommend → user approves →
 *          select_classes(select2d) → selection actually runs.
 *          The created "Particle Selection" job is cleaned up by the
 *          launcher afterwards (world restored to its 10-job roster).
 *
 * Read-only except S4's user-authorized select. C-class ops tool: never
 * registered in any family roster (t547 ledger).
 */
const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Content-Type": "application/json" };
const JOB_NAME = "class2d K5";
const Q_JUDGE = `请分析「${JOB_NAME}」的分类结果：看看 class 平均图，结合每类占比和分辨率，推荐保留哪些 class`;
const Q_APPROVE = "好，就按你推荐的保留类来，选 select2d，把选择跑起来";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(sessionId, message) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST", headers: SH,
    body: JSON.stringify(sessionId ? { sessionId, message } : { message }),
  });
  const j = await r.json().catch(() => ({}));
  let sid = j.sessionId ?? sessionId ?? null;
  let events = j.events ?? [];
  let guard = 0;
  while (j.needsContinue && guard < 6) {
    guard++;
    const r2 = await fetch(`${BASE}/api/ai/chat`, {
      method: "POST", headers: SH,
      body: JSON.stringify({ sessionId: sid, continue: true }),
    });
    const j2 = await r2.json().catch(() => ({}));
    events = events.concat(j2.events ?? []);
    if (j2.sessionId) sid = j2.sessionId;
  }
  const texts = events.filter((e) => e.type === "assistant_text").map((e) => e.text ?? "");
  return { sessionId: sid, events, finalText: texts.join("\n"), ms: Date.now() - t0 };
}

const REPORT = { startedAt: new Date().toISOString(), world: {}, sessions: [] };

async function snapshotJobs() {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const j = await r.json();
  return (j.jobs ?? []).map((x) => ({ id: x.id, name: x.name, type: x.type, status: x.status }));
}

async function main() {
  REPORT.world.jobsBefore = await snapshotJobs();
  console.log(`world roster before: ${REPORT.world.jobsBefore.length} jobs`);

  // ---- S1–S3: fresh judge sessions ----
  for (const tag of ["S1", "S2", "S3"]) {
    console.log(`\n[${tag}] fresh session, judge question`);
    const s = await chat(null, Q_JUDGE);
    const ev = s.events.find((e) => e.type === "tool_result" && e.name === "judge_2d_classes");
    const d = ev?.detail ?? {};
    const judged = d.judgedClasses ?? [];
    const by = (v) => judged.filter((c) => c.verdict === v).map((c) => c.cls).sort((a, b) => a - b);
    const session = {
      tag, toolSequence: s.events.filter((e) => e.type === "tool_call").map((e) => e.name),
      toolOk: Object.fromEntries(s.events.filter((e) => e.type === "tool_result").map((e) => [e.name, e.ok ?? true])),
      globalResolution: d.globalResolution ?? null,
      iteration: d.iteration ?? null,
      verdicts: Object.fromEntries(judged.map((c) => [c.cls, { verdict: c.verdict, res: c.resolution ?? null, frac: c.fraction ?? null, reason: (c.reason ?? "").slice(0, 160) }])),
      keep: by("keep"), maybe: by("maybe"), reject: by("reject"),
      confirm: d.confirm ?? null,
      summary: (ev?.summary ?? "").slice(0, 400),
      advice: (d.advice ?? "").slice(0, 500),
      finalExcerpt: s.finalText.slice(0, 700),
      ms: s.ms,
    };
    REPORT.sessions.push(session);
    console.log(`  judged ${judged.length} classes | keep=[${session.keep}] maybe=[${session.maybe}] reject=[${session.reject}]`);
    console.log(`  globalRes=${session.globalResolution} confirm=${JSON.stringify(session.confirm)}`);
    console.log(`  summary: ${session.summary.slice(0, 180)}`);
    await sleep(45_000); // the VLM lane rate-limits on bursts
  }

  // ---- S4: the golden path — judge, then the user's word ----
  console.log("\n[S4] golden path: judge → user approves → select_classes");
  const s4 = await chat(null, Q_JUDGE);
  const sid4 = s4.sessionId;
  const ev4a = s4.events.find((e) => e.type === "tool_result" && e.name === "judge_2d_classes");
  const d4a = ev4a?.detail ?? {};
  const judged4 = d4a.judgedClasses ?? [];
  const keep4 = judged4.filter((c) => c.verdict === "keep").map((c) => c.cls);
  const maybe4 = judged4.filter((c) => c.verdict === "maybe").map((c) => c.cls);
  console.log(`  judge done: keep=[${keep4}] maybe=[${maybe4}]`);
  console.log(`  final: ${s4.finalText.slice(0, 220).replace(/\n/g, " ")}`);
  await sleep(8_000);
  const s4b = await chat(sid4, Q_APPROVE);
  const ev4b = s4b.events.find((e) => e.type === "tool_result" && e.name === "select_classes");
  const s4rec = {
    tag: "S4",
    judgeDetail: {
      globalResolution: d4a.globalResolution ?? null,
      judged: Object.fromEntries(judged4.map((c) => [c.cls, { verdict: c.verdict, res: c.resolution ?? null }])),
      confirm: d4a.confirm ?? null,
    },
    turn2ToolSequence: s4b.events.filter((e) => e.type === "tool_call").map((e) => e.name),
    selectResult: ev4b ? { ok: ev4b.ok ?? true, summary: (ev4b.summary ?? "").slice(0, 400), detail: ev4b.detail ?? null } : null,
    finalExcerpt: s4b.finalText.slice(0, 700),
    ms: s4b.ms,
  };
  REPORT.sessions.push(s4rec);
  console.log(`  turn2 tools: ${s4rec.turn2ToolSequence.join(" → ") || "(none)"}`);
  console.log(`  select: ${s4rec.selectResult ? s4rec.selectResult.summary.slice(0, 200) : "(no select_classes call)"}`);

  await sleep(3_000);
  REPORT.world.jobsAfter = await snapshotJobs();
  const before = new Set(REPORT.world.jobsBefore.map((j) => j.id));
  REPORT.world.jobsCreated = REPORT.world.jobsAfter.filter((j) => !before.has(j.id));
  console.log(`\nworld roster after: ${REPORT.world.jobsAfter.length} jobs; created: ${JSON.stringify(REPORT.world.jobsCreated)}`);

  const out = ".qa-logs/t552-keep-verdict-report.json";
  (await import("node:fs")).writeFileSync(out, JSON.stringify(REPORT, null, 2));
  console.log(`report: ${out}`);
}

main().catch((e) => { console.error("t552 live-fire failed:", e); process.exit(1); });
