import * as React from "react";

/**
 * t605/t606 — the news face. A status can change with no finger anywhere
 * near the surface: the sweep completes a running job, the poll merges the
 * new status a tick later, and the world changed behind the page's back.
 * The surface that already shows the state acknowledges the news QUIETLY:
 * it blooms once in its own new color and settles — an acknowledgment,
 * not a ceremony (news is slower than a summon's reply but faster than a
 * birth).
 *
 * Returns a transition counter. The consumer keys its animated element
 * with it: 0 = the mount (the state the element was BORN showing is not
 * news — the no-flicker law: a surface never flashes a state it hasn't
 * seen), n>0 = the nth transition, each bump a remount, each remount a
 * one-shot bloom (the CSS lives on [data-news] at panel distance and
 * [data-news-floor] at the two canvas distances — t606 gives the map's
 * dot the floor's vocabulary: one mechanism, three distances, one
 * keyframe). A re-render with the same display word (a progress tick, a
 * position write, a neighbor's poll) keeps the counter and the element
 * identity — nothing replays.
 *
 * The display word is WHAT THE EYE SEES, not the DB column: a queued
 * remote run paints pending amber (t322's dialect), so the word is
 * "pending" — the bloom keys on the face, never on the ledger.
 */
export function useStatusNews(display: string): number {
  const [prev, setPrev] = React.useState<string | null>(null);
  const [news, setNews] = React.useState(0);
  if (prev !== display) {
    // React's render-phase adjustment: the word swap and the bloom land
    // in ONE commit — the surface never shows the new word un-blooming.
    if (prev !== null) setNews((n) => n + 1);
    setPrev(display);
  }
  return news;
}
