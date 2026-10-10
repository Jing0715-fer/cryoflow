/**
 * CryoFlow — the deterministic job workdir formula (t396).
 *
 * A job's CLUSTER workdir is not a fact about a RUN — it is a fact about
 * the JOB: `<remoteRoot>/<projectId>/<type>_<last 8 of id>`, derived at
 * dispatch time and derivable again at ANY later moment with nothing but
 * the job row and the connection. The "Continue from here:" picker's
 * data plane needs exactly that: a job whose run record is gone (a
 * Reset-to-idle wipes it — the standard "failed, now re-configure"
 * flow) still has its output directory sitting on the cluster with
 * every run_it###_optimiser.star it ever wrote, and the rounds are just
 * as continuable as the day they were flushed.
 *
 * The formula lived inline in remote-run.ts's dispatch leg since t300;
 * it moves here so the picker and the dispatcher CANNOT drift (the
 * bench pins the byte-parity through the source x-ray: remote-run must
 * call this function, not its own copy).
 */

/**
 * The cluster workdir a dispatch of this job writes into (and where its
 * run_it###_optimiser.star checkpoints land). `remoteRoot` is the
 * connection's EXPANDED remote root (expandRemotePath — no `~` left).
 * Byte-parity with the dispatch leg: one trailing slash is stripped, then
 * `<projectId>/<type>_<last-8-of-id>` joins on forward slashes.
 */
export function remoteWorkdirForJob(
  remoteRoot: string,
  projectId: string,
  type: string,
  id: string
): string {
  const root = remoteRoot.replace(/\/$/, "");
  return `${root}/${projectId}/${type}_${id.slice(-8)}`;
}
