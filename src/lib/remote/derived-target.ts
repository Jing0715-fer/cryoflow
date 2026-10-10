/**
 * CryoFlow — the derived scan targets (t474).
 *
 * The galleries' data planes historically demanded a LIVE run record:
 * `run.workdir` for the local mirror, `run.remote` for the cluster side.
 * A Reset-to-idle (the standard "failed, now re-configure" flow) clears
 * the record — and the class galleries went dark: every card "no image",
 * no banner, no retry, even though the class-average stacks still sit
 * in BOTH the local mirror (if the sync-back landed them) and the
 * cluster workdir (the dispatcher's deterministic directory, which
 * nothing ever deletes).
 *
 * The workdir is a fact about the JOB, not the run (the t396 verdict):
 *   local  : <RELION_DIR>/<projectId>/<type>_<last-8-of-id>
 *   cluster: <remoteRoot>/<projectId>/<type>_<last-8-of-id>
 * These helpers re-derive both, so the /classes, /iterations and
 * /iterations/image routes keep answering for record-less jobs.
 *
 * Server-only module (fs via projects/connections, ssh for ~ expansion).
 */

import path from "path";
import { RELION_DIR } from "@/lib/paths";
import { remoteWorkdirForJob } from "@/lib/relion/workdir";
import { projectRemoteTarget } from "@/lib/projects";
import { getConnection } from "./connections";
import { expandRemotePath } from "./remote-run";

/** The LOCAL mirror workdir a dispatch of this job writes into — the same
 * fallback formula the /classes route always had, now shared by every
 * gallery data plane. Pure, synchronous, never throws. */
export function localMirrorWorkdirForJob(job: {
  projectId: string;
  type: string;
  id: string;
}): string {
  return path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);
}

/** A cluster pull/scan target re-derived from the PROJECT's remote binding
 * (t396's deriveWorkdir law, exported for the gallery routes): the
 * connection the project is bound to + remoteWorkdirForJob's formula.
 * Null when the project is local-bound or its connection is gone — the
 * caller then answers from the local mirror alone (or says so honestly). */
export async function derivedRemoteTargetForJob(
  job: { projectId: string; type: string; id: string }
): Promise<{ connectionId: string; remoteWorkdir: string } | null> {
  const target = projectRemoteTarget(job.projectId);
  if (!target) return null;
  const conn = getConnection(target.connectionId);
  if (!conn || !conn.host || !conn.username) return null;
  let remoteRoot: string;
  try {
    remoteRoot = await expandRemotePath(conn, conn.remoteRoot || "~/cryoflow");
  } catch {
    return null; // ~ expansion needs a wire round that refused — local-only answer
  }
  return {
    connectionId: conn.id,
    remoteWorkdir: remoteWorkdirForJob(remoteRoot, job.projectId, job.type, job.id),
  };
}
