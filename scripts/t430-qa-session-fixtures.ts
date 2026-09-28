/**
 * t430 live-QA fixtures — three sessions across days so the drawer's day
 * groups have something to group, plus a searchable word. All deleted by
 * the QA cleanup right after (the drawer's own DELETE door).
 * Run: bun scripts/t430-qa-session-fixtures.ts
 */
export {};

process.env.DATABASE_URL = `file:${process.env.HOME}/my-project/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${process.env.HOME}/my-project/data`;

const { createSession, saveSession } = await import("../src/lib/ai/sessions");
const { ensureActiveProject } = await import("../src/lib/seed");

const active = await ensureActiveProject();
const DAY = 86_400_000;

function make(ageMs: number, title: string | null, question: string): string {
  const s = createSession(active!.project.id);
  const at = Date.now() - ageMs;
  saveSession({
    ...s,
    title,
    createdAt: at,
    updatedAt: at,
    messages: [
      { role: "user", content: question, at },
      { role: "assistant", content: "好的。", at: at + 1_000 },
    ],
  });
  return s.id;
}

const a = make(3 * 3_600_000, "SPA 主线搭建", "帮我搭一条 SPA 流程"); // today
const b = make(1.5 * DAY, null, "分析 class2d 的分辨率分布"); // yesterday
const c = make(10 * DAY, "旧世界普查", "检查画布上的任务状态"); // earlier
console.log("fixtures:", a, b, c);
