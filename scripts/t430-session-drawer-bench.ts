/**
 * t430 — the history drawer's search + day grouping bench.
 *
 * D1-D4 (groupSessionsByDay): the wall-clock buckets — 今天/昨天/7 天内/
 *    更早 — split on LOCAL midnights, empty buckets vanish, the
 *    newest-first order inside each bucket survives untouched, and the
 *    boundary instants themselves (23:59:59 yesterday vs 00:00:00 today)
 *    land on the sides the labels promise.
 * D5-D8 (filterSessions): case-insensitive substring over title AND
 *    preview — a rename must not hide the opening words, an unnamed
 *    session must be findable by its first question, an empty query is
 *    the identity, and a whitespace query filters nothing either.
 * D9 (matchIndex): the highlight helper's truth — the offset inside the
 *    DISPLAY text, case-insensitive, -1 when absent or query empty.
 *
 * Run: bun scripts/t430-session-drawer-bench.ts
 */

import { mkdtempSync, mkdirSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* Isolated world FIRST — env before any src import */
const TMP = mkdtempSync(path.join(os.tmpdir(), "t430-drawer-"));
const DATA_DIR = path.join(TMP, "data");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${path.join(TMP, "test.db")}`;

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

const { filterSessions, groupSessionsByDay, matchIndex } = await import(
  "../src/lib/ai/session-groups"
);
type S = import("../src/lib/ai/types").AiSessionSummaryDto;

function sess(id: string, updatedAt: number, title: string | null, preview = ""): S {
  return { id, createdAt: updatedAt, updatedAt, messageCount: 2, toolCount: 0, preview, title };
}

/* ------------------------------------------------------------------ */
/* A fixed clock: local noon today, so bucket edges are unambiguous     */
/* ------------------------------------------------------------------ */

const NOW = new Date();
NOW.setHours(12, 0, 0, 0);
const NOON = NOW.getTime();
const DAY = 86_400_000;

console.log("D1-D4. groupSessionsByDay — the wall-clock buckets");
{
  const sessions = [
    sess("now", NOON - 3_600_000, "今天上午的对话"), // 11:00 today
    sess("yesterday", NOON - DAY - 3_600_000, "昨天下午"), // 11:00 yesterday
    sess("threedays", NOON - 3 * DAY, "三天前"), // inside the week
    sess("tendays", NOON - 10 * DAY, "两周前"), // earlier
  ];
  const groups = groupSessionsByDay(sessions, NOW);
  must(groups.length === 4, "D1: four non-empty buckets, no empty ones in between");
  must(groups[0].label === "今天" && groups[0].items[0].id === "now", "D1: today lands in 今天");
  must(groups[1].label === "昨天" && groups[1].items[0].id === "yesterday", "D2: yesterday lands in 昨天");
  must(groups[2].label === "7 天内" && groups[2].items[0].id === "threedays", "D3: 3 days ago lands in 7 天内");
  must(groups[3].label === "更早" && groups[3].items[0].id === "tendays", "D4: 10 days ago lands in 更早");

  // the boundary instants — midnight is the seam, and it belongs to the NEW day
  const midnight = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime();
  const around = groupSessionsByDay(
    [sess("just-before", midnight - 1, "昨天最后一秒"), sess("just-after", midnight, "今天第一毫秒")],
    NOW
  );
  // groups return in BUCKET order (今天 first), never insertion order
  must(
    around[0].label === "今天" && around[0].items[0].id === "just-after",
    "D2: midnight sharp starts 今天 (bucket order, not insertion order)"
  );
  must(around[1].label === "昨天" && around[1].items[0].id === "just-before", "D2: 00:00:00 minus 1ms is still 昨天");

  // within-bucket order: the drawer's newest-first survives the regrouping
  const mixed = [
    sess("a", NOON - 1_000, "today-newer"),
    sess("b", NOON - 2_000, "today-older"),
  ];
  const todayGroup = groupSessionsByDay(mixed, NOW)[0];
  must(todayGroup.items[0].id === "a" && todayGroup.items[1].id === "b", "D3: newest-first order preserved inside the bucket");

  // empty buckets vanish: only-更早 history renders ONE label, not four
  const old = groupSessionsByDay([sess("old", NOON - 30 * DAY, "远古")], NOW);
  must(old.length === 1 && old[0].label === "更早", "D4: empty buckets vanish (single-bucket history stays flat-worthy)");
}

console.log("D5-D8. filterSessions — title AND preview, case-insensitive");
{
  const sessions = [
    sess("named", NOON, "SPA 主线", "帮我搭一条 SPA 流程"),
    sess("unnamed", NOON - DAY, null, "检查 class2d 的分辨率"),
  ];
  must(filterSessions(sessions, "spa").length === 1, "D5: the query matches case-insensitively (spa → SPA 主线)");
  must(filterSessions(sessions, "class2d").length === 1, "D6: an unnamed session is findable by its opening question");
  must(filterSessions(sessions, "搭").length === 1, "D6: a rename must not hide the opening words (preview still searched)");
  must(filterSessions(sessions, "").length === 2, "D7: the empty query is the identity");
  must(filterSessions(sessions, "   ").length === 2, "D7: a whitespace query filters nothing");
  must(filterSessions(sessions, "不存在的词").length === 0, "D7: a miss answers empty (the drawer speaks its 没有匹配 line)");
}

console.log("D9. matchIndex — the highlight's truth");
{
  must(matchIndex("SPA 主线", "主") === 4, "D9: the offset lands inside the display text");
  must(matchIndex("SPA 主线", "s") === 0, "D9: case-insensitive (s → position 0 of SPA)");
  must(matchIndex("SPA 主线", "xyz") === -1, "D9: a miss answers -1 (no highlight)");
  must(matchIndex("SPA 主线", "  ") === -1, "D9: a whitespace query highlights nothing");
}

console.log(`\nt430 session drawer search + groups: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
