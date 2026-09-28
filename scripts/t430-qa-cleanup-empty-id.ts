/**
 * t430 QA cleanup helper — remove the collided empty-id session record
 * (a fixture accident, unaddressable via REST: the empty path segment
 * redirects). Direct atomic file surgery on data/ai-assistant.json,
 * matching the store's tmp+rename discipline.
 * Run: bun scripts/t430-qa-cleanup-empty-id.ts
 */
export {};

import { readFileSync, writeFileSync, renameSync } from "fs";
import path from "path";

process.env.CRYOFLOW_DATA_DIR = `${process.env.HOME}/my-project/data`;

const FILE = path.join(process.env.CRYOFLOW_DATA_DIR, "ai-assistant.json");
const raw = JSON.parse(readFileSync(FILE, "utf8")) as {
  version: number;
  sessions: { id: string; messages?: unknown[] }[];
};
const before = raw.sessions.length;
// the empty-id record AND the zero-message shells (createSession shells
// from the collided fixture run — summaries exclude them, but the world
// file should not carry QA droppings)
const kept = raw.sessions.filter((s) => s.id !== "" && Array.isArray(s.messages) && s.messages.length > 0);
const tmp = FILE + ".t430-cleanup";
writeFileSync(tmp, JSON.stringify({ version: 1, sessions: kept }, null, 2));
renameSync(tmp, FILE);
console.log(`surgery: ${before} -> ${kept.length} session(s), empty-id removed: ${before - kept.length}`);
