import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJobDTO } from "@/lib/seed";
import { stopRun, isRunAlive, getRun, updateRun } from "@/lib/relion/engine";
import { remoteInfoFor, remoteStopRun } from "@/lib/remote/remote-run";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/stop — gracefully stop a running job.
 *
 * LOCAL runs: SIGTERM → 5s grace → SIGKILL for the whole process tree
 * (mpirun, hydra proxy and every MPI rank — killing only mpirun would orphan
 * the ranks). Stopped refine-family runs keep their checkpoints: the next
 * POST /run auto-resumes via RELION --continue.
 *
 * REMOTE runs (record.remote): kill the cluster-side SESSION (process group
 * leader from .cf-pid) over SSH — same semantics, distant tree. Checkpoints
 * stay on the cluster and sync back; re-run resumes from them.
 *
 * t618's feat docket — the receipt contract: the response carries
 * `outcome: "killed" | "missed" | "already-ended"` alongside the legacy
 * `stopped` boolean, and the LEDGER honors it. A confirmed kill earns the
 * user-stop stamp (exit 137, "stopped by user"). A MISSED kill claims
 * NOTHING: no 137, no "stopped by user" — the ledger record keeps whatever
 * exit it logged, the interim result names the miss, and the cluster-ledger
 * reconcile lands the real truth when the run's records come home (the heal
 * that used to LOOK like a flip from "stopped" to "completed" was the
 * pre-written lie speaking twice; with the miss named, the heal is just a
 * landing).
 *
 * t624 — the teardown confirmation window (t418's awaitSlurmTeardown on the
 * single-job door): scancel exiting 0 means the scheduler ACCEPTED the
 * cancellation, not that the tree is dead — for seconds the ranks keep
 * flushing (COMPLETING, in squeue-speak). The remote stop now polls squeue
 * for a bounded 8s and carries the verdict as `settled` on the response:
 * true = the job left the queue (the tree is GONE); false = accepted but
 * still leaving (the ledger decides the final state); null = the question
 * never applied. The DB row and the toast speak the difference instead of
 * claiming "stopped" flatly in both cases.
 *
 * t625 — the receipt's third level: the stop-time words are the BEST
 * KNOWLEDGE, not the final word — the cluster's accounting ledger holds
 * that. Every slurm-mode stop (killed or missed) opens the question on the
 * record (`remote.accountingPending`), and the sweep's sacct consult lands
 * the ledger's terminal answer: COMPLETED heals the row (the cancel arrived
 * after the run had finished — the heal is a landing, not a flip),
 * CANCELLED confirms the stamp (case closed), FAILED/TIMEOUT name the run's
 * own death. A ledger that stays silent past the patience window has the
 * receipt's stamp stand.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Write door (t252): bodyless action — form-firable blind cross-site.
    // Same drive-by door + Host pin pair as the read routes (http-guard).
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site job actions are not allowed" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (existing.status !== "running") {
      return NextResponse.json(
        { error: `Job is not running (status: ${existing.status})` },
        { status: 409 }
      );
    }

    // ---- remote branch: the process tree lives on the cluster ----------
    const rec = getRun(id);
    if (rec?.remote) {
      // t624 — the bounded confirmation window (8s: a healthy scheduler
      // purge lands in 1–3s, the deadline only caps the WAIT, never the
      // kill — the project-delete's 15s budget exists for the rm below,
      // this one only feeds the receipt's words).
      const outcome = await remoteStopRun(id, { settleMs: 8_000 });
      const missed = !outcome.stopped;
      // t625 — slurm-mode stops open the accounting question: the ledger
      // holds the FINAL word for the slurmId, whatever the receipt just
      // said. Missed stops promise the same thing ("the cluster ledger
      // decides the final state") — a refused scancel is often "already
      // finished", exactly when sacct holds a COMPLETED row.
      const slurmBackfill = rec.remote.mode === "slurm" && !!rec.remote.slurmId;
      // finalize the record now — a SIGKILL'd wrapper never writes its exit
      // file, and a !done record would ghost-block re-runs (isRunAlive).
      // The receipt decides the words (t618 feat docket): a confirmed kill
      // earns the 137 user-stop stamp; a missed kill claims nothing — the
      // cluster ledger decides the final state when the records come home.
      updateRun(
        id,
        (cur) =>
          cur.remote && !cur.done
            ? {
                ...cur,
                done: true,
                ...(missed ? {} : { exitCode: cur.exitCode ?? 137 }),
                ...(slurmBackfill
                  ? { remote: { ...cur.remote, accountingPending: { at: Date.now(), missed } } }
                  : {}),
                result:
                  cur.result ??
                  (missed
                    ? "stop missed — no live cluster session found; the cluster ledger decides the final state"
                    : "stopped by user"),
              }
            : null
      );
      // t625 — the handshake's mirror case (t623's fresh-read fixed the
      // sweep-yields-to-route order; THIS is the route-yields-to-sweep
      // order): the background reconciler sweeps RUNNING rows globally on
      // a 15s beat, and a stop's own in-flight window (the 8s settle wait,
      // or the dying wrapper's exit file landing first) lets the tick
      // finalize the record BEFORE this route's updateRun — whose !done
      // guard then rightly declines to speak over the tick's fresh words.
      // The QUESTION is not a word: open it on the tick-finalized record
      // too, so the ledger's last word is still consulted. The landing's
      // own guards (RECEIPT_STAMPS on the record's words, the failed-row
      // condition on the flip) keep this write honest in both orders.
      if (slurmBackfill) {
        updateRun(
          id,
          (cur) =>
            cur.remote && cur.done && cur.remote.slurmId && !cur.remote.accountingPending
              ? {
                  ...cur,
                  remote: { ...cur.remote, accountingPending: { at: Date.now(), missed } },
                }
              : null
        );
      }
      // give the cluster a beat to write the exit status, then reflect the
      // DB (the remote poll sweep finalizes + syncs checkpoints on its next
      // tick — typically ≤5s)
      await new Promise((r) => setTimeout(r, 800));
      let job = await db.job.findUnique({ where: { id } });
      if (job && job.status === "running") {
        job = await db.job.update({
          where: { id },
          data: {
            status: "failed",
            progress: 0,
            result: missed
              ? "stop missed (no live cluster session found) — the cluster ledger decides the final state when the run's records come home"
              : outcome.settled === true
                ? "stopped by user (cluster-side session killed; teardown confirmed — the job left the queue) — re-run resumes from the last synced checkpoint"
                : outcome.settled === false
                  ? "stopped by user (cluster-side cancellation accepted — the job was still leaving the queue after the confirmation window; the cluster ledger decides the final state) — re-run resumes from the last synced checkpoint"
                  : `stopped by user (cluster-side session killed) — re-run resumes from the last synced checkpoint`,
          },
        });
      }
      const dto = toJobDTO(job ?? existing);
      const rinfo = remoteInfoFor(id);
      if (rinfo) dto.runRemote = rinfo;
      return NextResponse.json({
        job: dto,
        stopped: outcome.stopped,
        outcome: outcome.outcome,
        message: outcome.message,
        settled: outcome.settled,
      });
    }

    const wasAlive = isRunAlive(id);
    const outcome = await stopRun(id);

    // The exit handler usually wins the DB write (child SIGTERM → exit
    // event → status failed, exit −1). Give it a moment, then reflect
    // whatever the DB says; if nothing landed (restart-orphaned tree),
    // mark it ourselves. The receipt decides the words: a missed kill
    // doesn't claim the user stopped anything (t618 feat docket).
    await new Promise((r) => setTimeout(r, 400));
    let job = await db.job.findUnique({ where: { id } });
    if (job && job.status === "running") {
      job = await db.job.update({
        where: { id },
        data: {
          status: "failed",
          progress: 0,
          result: outcome.stopped
            ? wasAlive
              ? "stopped by user — re-run resumes from checkpoint"
              : "stopped by user"
            : outcome.outcome === "already-ended"
              ? "the run had already ended — nothing was stopped"
              : wasAlive
                ? "the run ended between the check and the stop — nothing was killed"
                : "stop missed — no live process found; the run ended outside this session",
        },
      });
    }

    return NextResponse.json({
      job: toJobDTO(job ?? existing),
      stopped: outcome.stopped,
      outcome: outcome.outcome,
      message: outcome.message,
    });
  } catch (error) {
    console.error("POST /api/jobs/[id]/stop failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
