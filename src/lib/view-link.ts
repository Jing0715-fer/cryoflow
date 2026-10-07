/**
 * Dashboard gallery → 3D viewer handoff.
 *
 * Clicking a saved view on the dashboard's cross-project gallery writes a
 * one-shot request here before deep-linking to the job. The viewer
 * consumes it once its plugin is up AND its bookmark list has loaded
 * (so a view that was deleted in the meantime reports honestly instead
 * of silently doing nothing). Fresh intent overwrites stale — the key
 * holds exactly one pending view.
 */
export const PENDING_VIEW_KEY = "cryoflow:pending-view";

export interface PendingView {
  jobId: string;
  bookmarkId: string;
}

/**
 * t670 — "saved views changed"broadcast. The collection now has TWO
 * mutation mouths (the dashboard wall's X, t669; the palette row's X,
 * t670), and the wall's own refetch trigger (jobCount) never fires for a
 * bookmark mutation — a delete from the OTHER mouth would leave the wall
 * holding its stale copy until some unrelated job mutation happened to
 * refresh it. A delete dispatches this; the wall re-reads the route at
 * click-time freshness (never trusts a payload — the same doctrine as its
 * own delete: read fresh, render what the server confirms).
 */
export const SAVED_VIEWS_CHANGED_EVENT = "cryoflow:saved-views-changed";
