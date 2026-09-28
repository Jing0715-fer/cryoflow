import { existsSync } from "fs";
import { readRemoteManifest } from "@/lib/remote/remote-files";
import type { RunRecord } from "@/lib/relion/engine";

/**
 * CryoFlow — the homecoming truth computation (t431).
 *
 * "How many of this run's synced-away files are STILL absent from the
 * local workdir" — the number every surface rendering a stay receipt
 * needs to re-judge it honestly. The sync route uses the same
 * manifest × existsSync arithmetic for its own `remaining`; t429 gave it
 * a read-only GET; t431 lifts the computation into this module so the
 * jobs LIST can annotate every DTO with it once per poll — the canvas
 * card, the minimap and the dashboard then judge their receipts with
 * ZERO extra requests.
 *
 * Cost posture: one manifest read + one existsSync per entry, per remote
 * job, per list poll. The demo world is 24 entries; even a multi-thousand
 * manifest is only stat calls (no data reads) — honest and cheap. A
 * statcache memo can come later if a real-world listing ever feels it.
 */

export interface RemoteRemaining {
  remaining: number;
  total: number;
}

/**
 * Count the manifest entries still absent from `workdir`. No manifest /
 * empty manifest → { remaining: 0, total: 0 }: vacuously all-home (the
 * ledger is the claim; an empty ledger makes no claim to contradict).
 */
export function remainingFromWorkdir(workdir: string): RemoteRemaining {
  const manifest = readRemoteManifest(workdir);
  if (!manifest || manifest.files.length === 0) {
    return { remaining: 0, total: 0 };
  }
  let remaining = 0;
  for (const entry of manifest.files) {
    if (!existsSync(`${workdir}/${entry.path}`)) remaining += 1;
  }
  return { remaining, total: manifest.files.length };
}

/**
 * The annotation for a run record: only jobs whose run actually lives on
 * a cluster (run.remote) AND has a local workdir carry the number — a
 * local-only job has no receipt to re-judge, and a workdir-less remote
 * job has no presence truth (the t429 route answers 400 for the same
 * case; the annotation simply stays absent).
 */
export function remainingForRun(run: RunRecord | null | undefined): RemoteRemaining | null {
  if (!run?.remote || !run.workdir || !existsSync(run.workdir)) return null;
  return remainingFromWorkdir(run.workdir);
}
