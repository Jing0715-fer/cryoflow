/**
 * CryoFlow — the arrow walk's voice (pure brain, no React, no store).
 *
 * Task 103 taught the canvas to walk: arrows hop the anchor to the
 * nearest card in the pressed direction, Shift extends. But the walk
 * itself was MUTE — three moments where the user cannot tell what
 * happened:
 *
 *   1. ENTRY. With nothing selected the walk enters the graph from the
 *      viewport center — a card gets selected SOMEWHERE, the ring may
 *      sit far from the user's eye, and nothing names it (the t465
 *      field report: ten probe presses just to learn where the walk
 *      landed). The entry hint names the landed job and the two
 *      companion keys.
 *   2. STEP. Silently correct — the ring visibly moves. A walk that
 *      spoke on every hop would be noise, not orientation.
 *   3. DEAD END. The ±45° cone finds no candidate and the keypress
 *      does nothing — indistinguishable from a broken shortcut (the
 *      footer's own law: a readout that never moves cannot be told
 *      apart from a hung run). The dead-end hint says so, with the
 *      direction named.
 *
 * The caller (app-shell's global keydown) decides WHEN to speak; this
 * module only owns the WORDS, so the bench can pin the dialect and the
 * UI cannot drift from it.
 */

export type WalkDirection = "left" | "right" | "up" | "down";

/** Map a KeyboardEvent.key to the walk's direction word (null = not a
 * walk key — callers route those elsewhere). */
export function walkDirectionName(key: string): WalkDirection | null {
  switch (key) {
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    default:
      return null;
  }
}

export interface WalkHint {
  title: string;
  description: string;
}

/**
 * The ENTRY hint — fired once when the walk lands with no previous
 * anchor. The title names the card (the user's question is always
 * "where am I now"), the description teaches the walk's three
 * companion gestures: hop, extend, clear.
 */
export function arrowWalkEntryHint(jobName: string): WalkHint {
  return {
    title: `Arrow walk — ${jobName}`,
    description:
      "The walk entered the graph here. Arrows hop to the nearest card in the direction pressed, Shift+Arrow grows the selection, Escape clears it.",
  };
}

/**
 * The DEAD-END hint — the cone found no candidate. Works for both dead
 * ends: an anchored walk at the graph's edge ("nothing further") and an
 * entry whose direction faces an empty world. One sentence, honest in
 * both worlds: no card lies in that direction.
 */
export function arrowWalkDeadEndHint(direction: WalkDirection): WalkHint {
  return {
    title: `Arrow walk — nothing to the ${direction}`,
    description:
      "No card lies in that direction, so the selection stays as it was. Try another arrow, or Shift+click a card to anchor the walk there.",
  };
}
