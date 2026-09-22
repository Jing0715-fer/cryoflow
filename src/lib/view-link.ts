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
