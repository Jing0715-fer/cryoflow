"use client";

import * as React from "react";
import { Cloud, House, Loader2, Square, TriangleAlert } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";

/**
 * t549 — the project-level homecoming sweep.
 *
 * The per-job faces (t424 batch bar in Results, the t429/t431 notes and
 * chips) each tell one job's story; a session that left files on several
 * jobs makes homecoming a tour of inspectors. This bar aggregates the
 * same truth the jobs list already annotates (`remoteRemaining`, computed
 * once per poll by remote-remaining.ts) into ONE project-level verb:
 * walk every owing job, fetch its honest listing (the manifest join —
 * the same source the inspector's bar drinks), and drive the t424 sync
 * route in small client-driven chunks until every ledger entry is home.
 *
 * Honesty contracts inherited from the family:
 *   - the annotation is the only door to this bar: `remoteRemaining == null`
 *     means "truth not loaded" and counts NOTHING (the no-flicker law) —
 *     a bar never appears on a guess;
 *   - self-effacing (t491): nothing owing, nothing running, no failures
 *     to report → the bar renders nothing; the teal "all brought home"
 *     epilogues carry the story after a clean sweep;
 *   - the chunk loop speaks the t424 dialect: stop between chunks, and a
 *     chunk whose WIRE died halts the whole sweep — an unreachable
 *     connection is not a per-file verdict, so we stop walking instead of
 *     dressing transport death as file failures;
 *   - per-file refusals ("The cluster connection for this run was deleted
 *     — …") surface verbatim, grouped under their job — the product's own
 *     remedy wording ("re-add it") is the advice the user needs;
 *   - the listing is the truth: a job whose listing shows zero remote
 *     tiles is skipped silently (a stale annotation self-corrects on the
 *     next poll) — but if the whole sweep ends with nothing fetched and
 *     nothing failed, the verdict says so instead of claiming victory.
 */

const CHUNK = 4; // route cap is 8; the per-job bar walks 3 — the sweep is the batch leg, mid-ground

type SyncResult = { path: string; ok: boolean; bytes?: number; error?: string };

type SweepFailure = {
  jobId: string;
  jobName: string;
  path?: string;
  error: string;
};

type OwingJob = { id: string; name: string; remaining: number };

const MAX_SHOWN_FAILURES = 4;

export function HomecomingSweepBar({
  /** t613 — the spotlight wave's ticket for this face: when present the
   *  root joins the arrival grammar (data-spot-sweep + --sd); the bar
   *  mounts ONCE (an animation is a mount event, not a render event) so
   *  a late-appearing story arrives in its reading-order seat without
   *  shifting anyone else's delay. Absent → the bar mounts as it
   *  always did (no other call site passes it). */
  arrivalDelay,
}: {
  arrivalDelay?: string;
}) {
  const jobs = useWorkflowStore((s) => s.jobs);
  const pollTick = useWorkflowStore((s) => s.pollTick);

  const [phase, setPhase] = React.useState<"idle" | "running" | "settled">("idle");
  const [progress, setProgress] = React.useState({ done: 0, total: 0, jobsLeft: 0 });
  const [currentName, setCurrentName] = React.useState<string | null>(null);
  const [failures, setFailures] = React.useState<SweepFailure[]>([]);
  const [fetched, setFetched] = React.useState(0);
  const [stopped, setStopped] = React.useState(false);
  const [allSettled, setAllSettled] = React.useState(false);
  // t549 — the settled verdict LINGERS: a small sweep settles faster than a
  // human reads, and a confirmation that flashes for one frame is a lie of
  // attention (the work happened; the story must be tellable). The linger
  // holds the verdict a grace period, then the self-effacing contract
  // resumes — the teal epilogue chips carry the permanent story.
  const [linger, setLinger] = React.useState(false);
  const stopRef = React.useRef(false);
  // t549 — Stop must stop NOW, not at the next chunk boundary: the
  // in-flight chunk rides an AbortController the stop button fires, so a
  // slow wire cannot hold the sweep hostage after the user said stop.
  const abortRef = React.useRef<AbortController | null>(null);

  // the settled verdict's grace timer — all hooks live above the early return
  React.useEffect(() => {
    if (!linger) return;
    const t = setTimeout(() => setLinger(false), 6000);
    return () => clearTimeout(t);
  }, [linger]);

  // The owing census — ONLY annotation-bearing jobs count (no-flicker).
  // Biggest debts first: the jobs with the most files still out get the
  // wire first, so an interrupted sweep clears the heavyweights.
  const owing: OwingJob[] = jobs
    .filter((j) => j.remoteRemaining != null && j.remoteRemaining.remaining > 0)
    .map((j) => ({
      id: j.id,
      name: j.name,
      remaining: j.remoteRemaining?.remaining ?? 0,
    }))
    .sort((a, b) => b.remaining - a.remaining);

  const owingFiles = owing.reduce((sum, j) => sum + j.remaining, 0);

  // Self-effacing: nothing owed, not running, and no failures still owed
  // their story → the bar does not exist. (Failures persist: a failed
  // fetch keeps its manifest entry, so the owing face would show anyway —
  // but a wire-death sweep can end with honest rows AND a census that
  // never loaded, so the settled face holds its own door.)
  const hasStory =
    owing.length > 0 || phase === "running" || linger || (phase === "settled" && failures.length > 0);
  if (!hasStory) return null;

  const runSweep = async () => {
    if (owing.length === 0) return;
    const queue = [...owing]; // frozen census — the poll re-annotates underneath, the loop stays stable
    const total = queue.reduce((sum, j) => sum + j.remaining, 0);
    stopRef.current = false;
    setStopped(false);
    setAllSettled(false);
    setLinger(false);
    setFetched(0);
    setFailures([]);
    setCurrentName(null);
    setPhase("running");
    setProgress({ done: 0, total, jobsLeft: queue.length });

    const rows: SweepFailure[] = [];
    let done = 0;
    let wireDied = false;

    for (let qi = 0; qi < queue.length; qi++) {
      if (stopRef.current) break;
      const job = queue[qi];
      setCurrentName(job.name);

      // 1 — the honest listing: the manifest join marks cluster-resident
      // tiles `remote` (ledger sizes, no SSH). This is the same source the
      // inspector's batch bar drinks; the sweep never guesses paths.
      let listing: { path: string; remote?: boolean }[] | null = null;
      const listAc = new AbortController();
      abortRef.current = listAc;
      try {
        const res = await fetch(`/api/jobs/${job.id}/outputs`, {
          cache: "no-store",
          signal: listAc.signal,
        });
        if (res.ok) {
          const body: { status?: string; files?: { path: string; remote?: boolean }[] } = await res.json();
          listing = body.files ?? [];
        }
      } catch {
        /* our own stop → the stopRef check below ends the loop cleanly;
           a real network death → null listing → wire death below */
      }
      if (stopRef.current) break;
      if (listing === null) {
        // the listing leg itself died — an unreachable wire is not a
        // per-file verdict (t424 law), halt the whole sweep
        rows.push({ jobId: job.id, jobName: job.name, error: "Listing failed — connection or server error" });
        setFailures([...rows]);
        break;
      }
      const remotePaths = listing.filter((f) => f.remote).map((f) => f.path);
      if (remotePaths.length === 0) {
        // listing answered but nothing remote → stale annotation; skip
        // silently, the poll self-corrects
        setProgress({ done, total, jobsLeft: queue.length - qi - 1 });
        continue;
      }

      // 2 — the chunked fetch through the t424 route
      let jobDead = false;
      for (let i = 0; i < remotePaths.length; i += CHUNK) {
        if (stopRef.current) break;
        const chunk = remotePaths.slice(i, i + CHUNK);
        let results: SyncResult[] | null = null;
        const ac = new AbortController();
        abortRef.current = ac;
        try {
          const res = await fetch(`/api/jobs/${job.id}/outputs/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paths: chunk }),
            signal: ac.signal,
          });
          if (res.ok) {
            const body = await res.json();
            results = Array.isArray(body?.results) ? body.results : null;
          }
        } catch {
          /* our own stop → the stopRef check below ends the loop cleanly;
             a real network death → rows null → wire death below */
        }
        if (stopRef.current) break;
        if (results === null) {
          rows.push({
            jobId: job.id,
            jobName: job.name,
            error: "Sync request failed — connection or server error",
          });
          setFailures([...rows]);
          jobDead = true;
          break;
        }
        for (const r of results) {
          if (r.ok) done += 1;
          else rows.push({ jobId: job.id, jobName: job.name, path: r.path, error: r.error ?? "Fetch failed" });
        }
        setFetched(done);
        setFailures([...rows]);
        setProgress({ done: done + rows.length, total, jobsLeft: queue.length - qi - 1 });
      }
      if (stopRef.current) break;
      if (jobDead) {
        // this job's wire died — the same wire serves the rest of the
        // queue; halt instead of re-proving the death job by job
        wireDied = true;
        break;
      }
    }

    setCurrentName(null);
    setAllSettled(!wireDied && !stopRef.current);
    setStopped(stopRef.current);
    setPhase("settled");
    setLinger(true);
    // the annotations re-judge on the next poll — the teal epilogues flip,
    // the owing face re-derives, and a clean sweep self-hides after the
    // verdict's grace period
    void pollTick();
  };

  const stop = () => {
    stopRef.current = true;
    abortRef.current?.abort(); // a hung chunk dies NOW — stop is not a suggestion
  };

  const running = phase === "running";
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const shownFailures = failures.slice(0, MAX_SHOWN_FAILURES);
  const hiddenFailures = failures.length - shownFailures.length;

  return (
    <div
      data-testid="homecoming-sweep"
      data-spot-sweep={arrivalDelay === undefined ? undefined : ""}
      style={
        arrivalDelay === undefined
          ? undefined
          : ({ "--sd": arrivalDelay } as React.CSSProperties)
      }
      role="status"
      aria-busy={running}
      aria-label={
        running
          ? `Homecoming sweep running: ${progress.done} of ${progress.total} files settled`
          : `Homecoming: ${owingFiles} files on the cluster across ${owing.length} job${owing.length === 1 ? "" : "s"}`
      }
      className="no-print mb-2 rounded-lg border border-running/30 bg-running/[0.04] px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
          {running ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Cloud className="size-3.5" aria-hidden="true" />
          )}
          {running ? (
            <span data-testid="homecoming-sweep-progress" className="tabular-nums">
              Bringing home… {progress.done}/{progress.total} file(s) settled
              {currentName ? ` · ${currentName}` : ""}
              {progress.jobsLeft > 0 ? ` · ${progress.jobsLeft} job${progress.jobsLeft === 1 ? "" : "s"} left` : ""}
            </span>
          ) : (
            <span className="tabular-nums">
              {owingFiles} file{owingFiles === 1 ? "" : "s"} on the cluster across {owing.length} job
              {owing.length === 1 ? "" : "s"}
            </span>
          )}
        </span>

        {running ? (
          <button
            type="button"
            data-testid="homecoming-sweep-stop"
            onClick={stop}
            className="ml-auto flex h-6 items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-500/20 focus-visible:ring-2 focus-visible:ring-rose-500/40 dark:text-rose-300"
          >
            <Square className="size-3" aria-hidden="true" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            data-testid="homecoming-sweep-run"
            onClick={runSweep}
            disabled={owing.length === 0}
            className="ml-auto flex h-6 items-center gap-1 rounded-md border border-running/40 bg-running/10 px-2 text-[11px] font-medium text-teal-700 transition-colors hover:bg-running/20 focus-visible:ring-2 focus-visible:ring-running/40 disabled:cursor-not-allowed disabled:opacity-50 dark:text-teal-300"
          >
            <House className="size-3" aria-hidden="true" />
            Bring home all
          </button>
        )}
      </div>

      {running && (
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-running/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Homecoming sweep progress"
        >
          <div className="h-full rounded-full bg-teal-600/60 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}

      {phase === "settled" && (
        <p
          data-testid="homecoming-sweep-verdict"
          className="mt-1.5 flex items-center gap-1.5 text-[11px] leading-relaxed text-teal-700 dark:text-teal-300"
        >
          <House className="size-3 shrink-0" aria-hidden="true" />
          {stopped
            ? `Stopped — ${fetched} file${fetched === 1 ? "" : "s"} brought home before the stop.`
            : failures.length > 0
              ? `Sweep finished — ${fetched} file${fetched === 1 ? "" : "s"} home, ${failures.length} need${failures.length === 1 ? "s" : ""} attention.`
              : allSettled && fetched > 0
                ? `Sweep finished — ${fetched} file${fetched === 1 ? "" : "s"} brought home across the project.`
                : "Nothing to fetch — the receipts were already settled."}
        </p>
      )}

      {failures.length > 0 && (
        <ul data-testid="homecoming-sweep-failures" className="mt-1.5 space-y-1">
          {shownFailures.map((f, i) => (
            <li
              key={`${f.jobId}-${f.path ?? "job"}-${i}`}
              className="flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-[10.5px] leading-relaxed text-amber-700 dark:text-amber-300"
            >
              <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">{f.jobName}</span>
                {f.path ? <span className="text-amber-700/80 dark:text-amber-300/80"> · {f.path}</span> : null}
                {" — "}
                {f.error}
              </span>
            </li>
          ))}
          {hiddenFailures > 0 && (
            <li className="px-2 text-[10.5px] leading-relaxed text-amber-700/80 tabular-nums dark:text-amber-300/80">
              and {hiddenFailures} more — Results → Bring home all on the job shows every verdict.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
