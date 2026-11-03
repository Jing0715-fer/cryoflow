"use client";

/**
 * Group-drag registry — lets ONE leader card drag every selected card.
 *
 * The leader (the card whose pointer went down) already owns the pointer
 * capture and the rAF loop. Instead of fanning store updates per frame
 * (which would re-render the whole canvas), followers register imperative
 * callbacks here; the leader invokes them inside its existing rAF so the
 * whole selection moves in one paint — the exact pattern the edge layer's
 * zero-React drag patching uses (see job-card.tsx patchEdgeGroups).
 *
 * Lifecycle:
 *   1. every JobCard registers itself on mount (registration is cheap;
 *      the callbacks no-op unless THIS card is part of the drag group)
 *   2. leader starts a group drag → beginGroupDrag(ids) lets followers
 *      cache their edge SVG groups once
 *   3. each rAF → moveGroupDrag(ids, dx, dy) — canvas-space delta
 *   4. pointer up → endGroupDrag(ids, commit): followers clear their
 *      transient transform; on abort they also restore their wires
 */

export interface GroupMember {
  /** Cache edge DOM groups (called once when the group drag starts). */
  begin(): void;
  /** Follow the leader by a canvas-space delta (inside the leader's rAF). */
  move(dx: number, dy: number): void;
  /** Drop the transient transform; restore wires when the drag aborted. */
  end(commit: boolean): void;
}

const members = new Map<string, GroupMember>();

/** Register a card. Returns an unregister function for effect cleanup. */
export function registerGroupMember(jobId: string, member: GroupMember): () => void {
  members.set(jobId, member);
  return () => {
    if (members.get(jobId) === member) members.delete(jobId);
  };
}

export function beginGroupDrag(ids: readonly string[], leaderId: string): void {
  for (const id of ids) {
    if (id !== leaderId) members.get(id)?.begin();
  }
}

export function moveGroupDrag(
  ids: readonly string[],
  leaderId: string,
  dx: number,
  dy: number
): void {
  for (const id of ids) {
    if (id !== leaderId) members.get(id)?.move(dx, dy);
  }
}

export function endGroupDrag(
  ids: readonly string[],
  leaderId: string,
  commit: boolean
): void {
  for (const id of ids) {
    if (id !== leaderId) members.get(id)?.end(commit);
  }
}
