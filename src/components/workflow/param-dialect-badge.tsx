"use client";

/**
 * CryoFlow — the param dialect badge, one face for both search surfaces.
 *
 * t724 — the `key:value` dialect grew a second consumer: the dashboard's
 * roster search now speaks the same language the canvas find bar has
 * spoken since t722. Two faces answering the same kind of question must
 * wear the same marker, and a badge copied between them is a badge that
 * drifts (one face changes hue, the other never hears about it) — so
 * the marker moves into its own file and both faces import it. The
 * vocabulary-lives-in-two-homes law (t720's JOURNAL_KIND_FACE move),
 * now for a chip.
 *
 * The badge arms from parseParamQuery — the SAME parser the matcher
 * runs inside its param rung — so the marker and the meaning cannot
 * disagree no matter which surface renders it. Amber is the find
 * dialect's own hue (the same wash matched cards ring with); the badge
 * is a STATE, not an arrival: no motion debt of its own — nothing
 * enters, nothing animates, no cascade rung — motion-reduce is safe
 * by construction, and the full match law lives in the title/hover
 * rather than a tutorial.
 */

import { parseParamQuery } from "@/lib/job-match";

export function ParamDialectBadge({
  query,
  testid,
  title = "Matching by parameter: key matches by substring, value must equal exactly",
}: {
  query: string;
  testid: string;
  title?: string;
}) {
  if (!parseParamQuery(query)) return null;
  return (
    <span
      data-testid={testid}
      title={title}
      className="shrink-0 whitespace-nowrap rounded-full bg-amber-400/35 px-1.5 py-px text-[10px] font-medium leading-4 text-inherit dark:bg-amber-400/25"
    >
      params
    </span>
  );
}
