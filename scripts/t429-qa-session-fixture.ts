/**
 * t429 live-QA fixture — one small session in the REAL world DB so the
 * drawer's export dropdown has a row to act on. Deleted by the QA cleanup
 * (via the drawer's own DELETE door) right after.
 * Run: bun scripts/t429-qa-session-fixture.ts
 */
export {};

process.env.DATABASE_URL = `file:${process.env.HOME}/my-project/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${process.env.HOME}/my-project/data`;

const { createSession, saveSession } = await import("../src/lib/ai/sessions");
const { ensureActiveProject } = await import("../src/lib/seed");

const active = await ensureActiveProject();
const s = createSession(active!.project.id);
saveSession({
  ...s,
  title: "t429 导出演练",
  messages: [
    { role: "user", content: "给 Extract 拉一张 FOM 图看看质量", at: Date.now() - 60_000 },
    {
      role: "assistant",
      content: "已打开 picks 地图。",
      at: Date.now() - 50_000,
      toolCalls: [{ id: "fx1", name: "get_picks_map", args: { jobId: "demo" } }],
    },
    {
      role: "tool",
      toolCallId: "fx1",
      name: "get_picks_map",
      content: JSON.stringify({ ok: true, summary: "FOM 地图已渲染 408 picks", detail: "threshold 0.394" }),
      at: Date.now() - 45_000,
    },
  ],
});
console.log("fixture session:", s.id);
