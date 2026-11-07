#!/usr/bin/env node
/* t552b — the fresh-session redo: t552's live-fire exposed that chat(null)
 * attaches to the project's LATEST session (agent.ts latestSessionForProject
 * fallback), so t551/t545's "three fresh sessions" were one continuing
 * conversation (S2/S3 re-narrated S1's verdict with zero tool calls —
 * history anchoring, not independent agreement).
 *
 * This harness creates a TRULY fresh session per round via
 * { action: "reset" } (the route's own door for "New chat") and then chats
 * WITH that sessionId. Read-only: judge question only, no select_classes.
 * Records every tool event with args + sessionIds; parses the LAST
 * judge_2d_classes result per session (recovery arcs carry a failed first).
 */
const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Content-Type": "application/json" };
const Q = "请分析「class2d K5」的分类结果：看看 class 平均图，结合每类占比和分辨率，推荐保留哪些 class";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(sessionId, body) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST", headers: SH, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  const sid = j.sessionId ?? sessionId ?? null;
  let events = j.events ?? [];
  let guard = 0;
  while (j.needsContinue && guard < 6) {
    guard++;
    const r2 = await fetch(`${BASE}/api/ai/chat`, {
      method: "POST", headers: SH, body: JSON.stringify({ sessionId: sid, continue: true }),
    });
    const j2 = await r2.json().catch(() => ({}));
    events = events.concat(j2.events ?? []);
  }
  return { sessionId: sid, events, ms: Date.now() - t0 };
}

const REPORT = { startedAt: new Date().toISOString(), purpose: "fresh-session judge consistency on real data (class2d K5, EMPIAR-10017 t372 world)", sessions: [] };
const jacc = (a, b) => { const A = new Set(a), B = new Set(b); const u = new Set([...a, ...b]).size; return u === 0 ? 1 : [...A].filter((x) => B.has(x)).length / u; };

for (const tag of ["F1", "F2", "F3"]) {
  const fresh = await chat(null, { action: "reset" });
  console.log(`\n[${tag}] fresh session ${fresh.sessionId}`);
  await sleep(2_000);
  const s = await chat(fresh.sessionId, { sessionId: fresh.sessionId, message: Q });
  const calls = s.events.filter((e) => e.type === "tool_call").map((e) => ({ name: e.name, args: e.args ?? {} }));
  const judgeResults = s.events.filter((e) => e.type === "tool_result" && e.name === "judge_2d_classes");
  const last = judgeResults[judgeResults.length - 1] ?? null;
  const d = last?.detail ?? {};
  const judged = d.judgedClasses ?? [];
  const by = (v) => judged.filter((c) => c.verdict === v).map((c) => c.cls).sort((a, b) => a - b);
  const rec = {
    tag, sessionId: s.sessionId,
    toolCalls: calls,
    judgeAttempts: judgeResults.map((e) => ({ ok: e.ok ?? true, summary: (e.summary ?? "").slice(0, 140) })),
    judgedCount: judged.length,
    keep: by("keep"), maybe: by("maybe"), reject: by("reject"),
    perClass: Object.fromEntries(judged.map((c) => [c.cls, { verdict: c.verdict, res: c.resolution ?? null, frac: c.fraction ?? null, count: c.count ?? null }])),
    globalResolution: d.globalResolution ?? null,
    iteration: d.iteration ?? null,
    confirm: d.confirm ?? null,
    summary: (last?.summary ?? "").slice(0, 400),
    advice: (d.advice ?? "").slice(0, 500),
    finalExcerpt: (s.events.filter((e) => e.type === "assistant_text").map((e) => e.text ?? "").join("\n")).slice(-600),
    ms: s.ms,
  };
  REPORT.sessions.push(rec);
  console.log(`  tools: ${calls.map((c) => c.name).join(" → ") || "(none)"}`);
  console.log(`  judge attempts: ${rec.judgeAttempts.length} | last ok: ${rec.judgeAttempts.length ? rec.judgeAttempts[rec.judgeAttempts.length - 1].ok : "n/a"}`);
  console.log(`  judged ${rec.judgedCount} | keep=[${rec.keep}] maybe=[${rec.maybe}] reject=[${rec.reject}]`);
  console.log(`  globalRes=${rec.globalResolution} confirm=${JSON.stringify(rec.confirm)}`);
  if (tag !== "F3") await sleep(40_000);
}

const pairs = [jacc(REPORT.sessions[0].keep, REPORT.sessions[1].keep), jacc(REPORT.sessions[0].keep, REPORT.sessions[2].keep), jacc(REPORT.sessions[1].keep, REPORT.sessions[2].keep)];
REPORT.consistency = { pairwiseJaccard: pairs, mean: pairs.reduce((s, x) => s + x, 0) / 3 };
console.log(`\nkeep-set Jaccard: ${pairs.map((p) => p.toFixed(2)).join(" / ")} (mean ${REPORT.consistency.mean.toFixed(2)}) — TRUE fresh sessions`);
const out = ".qa-logs/t552b-fresh-judge-report.json";
(await import("node:fs")).writeFileSync(out, JSON.stringify(REPORT, null, 2));
console.log(`report: ${out}`);
