/**
 * t519 tail — run the last golden-path cases (A6/A7/A8) on the SAME session
 * with generous inter-case cooldowns (the bundled lane rate-limits bursts).
 * Reads the session id written by t519-real-agent-e2e.mjs (CF_SESSION_FILE).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const OUT_DIR = path.join(process.cwd(), ".qa-logs");
mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postChat(body) {
  const r = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  return await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
}

async function chat(sessionId, message, { maxTurns = 12 } = {}) {
  const t0 = Date.now();
  const events = [];
  let res = await postChat({ sessionId, message });
  // 429 auto-retry: the bundled lane rate-limits bursts; back off and retry
  for (let attempt = 1; attempt <= 4 && (res.events ?? []).some((e) => e.type === "error" && /429/.test(e.message)); attempt++) {
    console.log(`    (429 — backing off 75s, attempt ${attempt + 1})`);
    await sleep(75_000);
    res = await postChat({ sessionId, message });
  }
  let guard = 0;
  while (res.needsContinue && guard < maxTurns) {
    for (const e of res.events ?? []) events.push(e);
    res = await postChat({ sessionId: res.sessionId, continue: true });
    guard++;
  }
  for (const e of res.events ?? []) events.push(e);
  return {
    message, turns: guard + 1, ms: Date.now() - t0, events,
    toolSequence: events.filter((e) => e.type === "tool_call").map((c) => c.name),
    finalText: [...events].reverse().find((e) => e.type === "assistant_text")?.text ?? "",
    error: res.error ?? null,
  };
}

const sid = readFileSync(process.env.CF_SESSION_FILE ?? "/tmp/t519-a-session.txt", "utf8").trim();
console.log("session:", sid);

const cases = [
  { key: "A6-consult", msg: "做 2D 分类一般应该选多少个类？有什么经验法则？",
    expectTools: [] },
  { key: "A7-ghost", msg: "分析一下「Ghost Job 9」的结果，推荐保留哪些 class",
    expectTools: [],
    expectText: /没有|找不到|not found|不存在|no job/i },
  { key: "A8-chain", msg: "帮我搭一条新的分析链：导入粒子 → 2D 分类 → 初始模型",
    expectTools: ["build_pipeline"] },
];

const out = [];
for (const c of cases) {
  console.log(`\n[${c.key}] ${c.msg}`);
  const r = await chat(sid, c.msg);
  out.push({ ...r, key: c.key });
  const verdict = (name, pass, note = "") =>
    console.log(`    ${pass ? "PASS" : "FAIL"}  ${name}${note ? " — " + note : ""}`);
  if (c.expectTools.length === 0) {
    verdict("pure consult (no tool calls)", r.toolSequence.length === 0, r.toolSequence.join(","));
    verdict("substantive answer", r.finalText.length > 120, `${r.finalText.length} chars`);
  } else {
    verdict(`uses ${c.expectTools.join("/")}`, c.expectTools.every((t) => r.toolSequence.includes(t)), r.toolSequence.join(" → "));
    verdict("did not run unasked", !r.toolSequence.includes("run_job"));
  }
  if (c.expectText) verdict("honest absence", c.expectText.test(r.finalText), (r.finalText || r.error || "").slice(0, 90));
  if (r.error) verdict("no provider error", false, r.error.slice(0, 90));
  console.log("    finalText head:", (r.finalText || "(empty)").slice(0, 140).replace(/\n/g, " "));
  writeFileSync(path.join(OUT_DIR, "t519-tail-report.json"), JSON.stringify(out, null, 2));
  await sleep(75_000); // let the lane breathe between cases
}
console.log("\ntail done — report: .qa-logs/t519-tail-report.json");
