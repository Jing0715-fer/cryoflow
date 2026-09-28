/**
 * CryoFlow — the history drawer's search + day grouping (t430).
 *
 * The drawer lists sessions newest-first, but a growing history answers
 * "那是哪次对话" poorly: no way to narrow by word, and every row carries
 * the same relative time — "5 分钟前" and "3 周前" read alike when you
 * scan for a day. Two pure helpers serve the UI:
 *
 *   filterSessions   — case-insensitive substring over title AND preview
 *                      (a rename must not hide the conversation's first
 *                      words, and an unnamed session must be findable by
 *                      its opening question)
 *   groupSessionsByDay — the wall-clock buckets a scientist actually
 *                      speaks in: 今天 / 昨天 / 7 天内 / 更早. Bucket
 *                      boundaries are LOCAL midnights (the same zone every
 *                      timestamp in the app shows); empty buckets vanish.
 *
 * Pure over the summary DTOs — no fetch, no store, no DOM. The bench
 * (t430) drives both against synthetic clocks.
 */

import type { AiSessionSummaryDto } from "./types";

export interface SessionDayGroup {
  label: "今天" | "昨天" | "7 天内" | "更早";
  items: AiSessionSummaryDto[];
}

/** Case-insensitive substring filter over title + preview. An empty query
 * passes everything through (the drawer keeps its exact current shape). */
export function filterSessions(
  sessions: AiSessionSummaryDto[],
  query: string
): AiSessionSummaryDto[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return sessions;
  return sessions.filter((s) =>
    `${s.title ?? ""} ${s.preview ?? ""}`.toLowerCase().includes(q)
  );
}

/** The local-midnight boundaries the buckets split on — exported so the
 * bench can assert against the same clock the UI reads. */
export function dayBoundaries(now: Date = new Date()): {
  today: number;
  yesterday: number;
  week: number;
} {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 86_400_000;
  return { today, yesterday: today - DAY, week: today - 6 * DAY };
}

/** Newest-first sessions → day buckets, empty buckets dropped. The input
 * order is preserved WITHIN each bucket (the drawer's newest-first sort
 * must survive the regrouping untouched). */
export function groupSessionsByDay(
  sessions: AiSessionSummaryDto[],
  now: Date = new Date()
): SessionDayGroup[] {
  const { today, yesterday, week } = dayBoundaries(now);
  const groups: SessionDayGroup[] = [
    { label: "今天", items: [] },
    { label: "昨天", items: [] },
    { label: "7 天内", items: [] },
    { label: "更早", items: [] },
  ];
  for (const s of sessions) {
    if (s.updatedAt >= today) groups[0].items.push(s);
    else if (s.updatedAt >= yesterday) groups[1].items.push(s);
    else if (s.updatedAt >= week) groups[2].items.push(s);
    else groups[3].items.push(s);
  }
  return groups.filter((g) => g.items.length > 0);
}

/** The offset of the query inside the DISPLAY text (case-insensitive), or
 * -1 — the highlight helper's truth: only a match the reader can see in
 * the rendered line gets the highlight. */
export function matchIndex(text: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return -1;
  return text.toLowerCase().indexOf(q);
}
