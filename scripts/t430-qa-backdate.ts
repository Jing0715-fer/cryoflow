/**
 * t430 live-QA backdater — the store's saveSession stamps updatedAt=now on
 * every save (a save IS activity — the app's own law). Fixtures that need
 * a backdated wall clock must therefore go to the FILE after the last
 * save. Atomic tmp+rename, matching the store's discipline.
 * Run: bun scripts/t430-qa-backdate.ts
 */
export {};

import { readFileSync, writeFileSync, renameSync } from "fs";
import path from "path";

process.env.CRYOFLOW_DATA_DIR = `${process.env.HOME}/my-project/data`;

const FILE = path.join(process.env.CRYOFLOW_DATA_DIR, "ai-assistant.json");
const DAY = 86_400_000;
const AGES: Record<string, number> = {
  "帮我搭一条 SPA 流程": 3 * 3_600_000, // today, 3h ago
  "分析 class2d 的分辨率分布": 1.5 * DAY, // yesterday
  "检查画布上的任务状态": 10 * DAY, // earlier
};

const raw = JSON.parse(readFileSync(FILE, "utf8")) as {
  version: number;
  sessions: { id: string; messages: { role: string; content: string }[]; createdAt: number; updatedAt: number }[];
};
let patched = 0;
for (const s of raw.sessions) {
  const first = s.messages[0]?.content ?? "";
  if (first in AGES) {
    const at = Date.now() - AGES[first];
    s.createdAt = at;
    s.updatedAt = at;
    patched += 1;
  }
}
const tmp = FILE + ".t430-backdate";
writeFileSync(tmp, JSON.stringify(raw, null, 2));
renameSync(tmp, FILE);
console.log(`backdated ${patched} fixture session(s)`);
