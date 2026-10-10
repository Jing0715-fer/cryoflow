"use client";

/**
 * t725 — the find wash's own home. FIND_MARK_CLASS and FindMarkedText
 * lived in job-card since t655, when the card was the wash's only face.
 * This window the palette's dialect rows needed the same character wash,
 * and vocabulary that lives in two homes moves into its own file —
 * t720's law, third execution (JOURNAL_KIND_FACE, ParamDialectBadge,
 * now FindMarkedText). job-card imports from here; so does the palette.
 *
 * The hue is THE find lens's amber — the same family the matched card
 * rings with (border-amber-500 / ring-amber-500/50). The lens must not
 * invent a second color language (t134's chip law, now for characters):
 * a wash, not a recolor — the text's own ink stays. Identity-exempt in
 * the t650 census/codemod tables (rows follow this file since t725):
 * this is the hit ring's own amber, one dialect, one hue word.
 */
import { Fragment, type ReactNode } from "react";

export const FIND_MARK_CLASS =
  "rounded-[2px] bg-amber-400/35 text-inherit dark:bg-amber-400/25";

/** t655 — the WHY renderer: text between amber washes. A `<mark>` per
 * span — the element IS the semantics ("highlighted for reference"),
 * the classes quiet its loud UA yellow to the find dialect's wash.
 * Defensive guard: should a span ever escape the text's bounds (the
 * lowercase-coordinate edge documented on subsequenceSpans), the whole
 * render falls back to plain text — a wrong highlight is worse than
 * none, and the ring still tells the truth it always did. */
export function FindMarkedText({
  text,
  spans,
}: {
  text: string;
  spans: ReadonlyArray<readonly [number, number]>;
}) {
  const trustworthy =
    spans.length > 0 &&
    spans.every(
      ([s, e]) =>
        Number.isInteger(s) &&
        Number.isInteger(e) &&
        0 <= s &&
        s < e &&
        e <= text.length,
    );
  if (!trustworthy) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  spans.forEach(([s, e], i) => {
    if (s > at)
      out.push(<Fragment key={`t${i}`}>{text.slice(at, s)}</Fragment>);
    out.push(
      <mark key={`m${i}`} data-find-why-mark="" className={FIND_MARK_CLASS}>
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < text.length)
    out.push(<Fragment key="tail">{text.slice(at)}</Fragment>);
  return <>{out}</>;
}
