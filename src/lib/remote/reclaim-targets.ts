/**
 * CryoFlow — project-delete reclaim targets (SERVER ONLY, pure logic).
 *
 * t417 — the file-reclaim half of DELETE /api/projects/[id], extracted so
 * the risky parts (path guards, target collection, dedup) are unit-testable
 * without booting the server or dialing a cluster. The route owns the IO
 * (reading runs, tilde expansion over SSH, the `rm` itself); this module
 * owns the JUDGMENT: what may be deleted, and where the mirrors are.
 *
 * The dialog's promise is the contract: "This removes the project with all
 * of its jobs ... cannot be undone." Files that outlive a project delete
 * are not preserved work (the single-job route keeps workdirs for undo;
 * project delete has NO restore) — they are orphans. Witnessed 2026-09-28:
 * 21 cluster husks + ~35 local roots (1.4GB) accumulated from earlier
 * deletes — and then the sandbox reboot of 04:14 wiped every uncommitted
 * byte of this window, so this file is the SECOND writing of itself (the
 * first died in the reboot; its unit suite passed 24/24 before the fall).
 */

/** A cluster mirror witness: WHERE this project's data was mirrored. */
export interface MirrorTarget {
  /** connection id as recorded (may reference a deleted connection). */
  connectionId: string | null;
  /** host:port as configured — the same-host re-creation key (t325). */
  host: string;
  /** expanded remote root, trailing slashes trimmed. */
  remoteRoot: string;
}

/** Minimal record shape this module needs (structural — RunRecord fits). */
interface RecordWitness {
  projectId: string;
  remote?: {
    connectionId: string;
    host: string;
    remoteRoot: string;
  } | null;
}

/** Minimal bound-connection shape (structural — RemoteConnection fits). */
interface BoundWitness {
  id: string;
  host: string;
  port: number;
  /** absolute roots are deterministic; tilde roots need an SSH $HOME probe
   * the route performs — here they are SKIPPED, never guessed. */
  remoteRoot: string;
}

/**
 * Project ids are DB-generated cuids ([A-Za-z0-9_-]). The guard exists so
 * a hostile id can never traverse out of the reclaim root — belt with the
 * route's own path-shape suspenders.
 */
export function isReclaimSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id);
}

/**
 * The local workdir root this project owns, or null when the id is not
 * reclaim-safe (traversal refused) or the root would escape relionDir.
 */
export function localReclaimRootFor(id: string, relionDir: string): string | null {
  if (!isReclaimSafeId(id)) return null;
  if (!id) return null;
  // normalize the base: trailing separators would poison both the join and
  // the startsWith guard (relionDir + "/" + "/" never matches anything).
  const sep = relionDir.includes("\\") ? "\\" : "/";
  const base = relionDir.replace(/[\\/]+$/, "");
  if (!base) return null; // "/" normalizes to "" — a root-level relionDir
  const root = base + sep + id;
  // the root must be EXACTLY one segment deep — never the base itself
  // (a caller passing id="" must not reclaim the whole workdir tree).
  if (root === base || !root.startsWith(base + sep)) return null;
  return root;
}

/**
 * Collect the DISTINCT cluster mirror roots a project's data may live
 * under. Two witnesses, in priority order:
 *   1. the project's run records — rec.remote is the only witness of the
 *      EXPANDED root staging actually used (read before the records die);
 *   2. the project's bound connection — the fallback witness for projects
 *      whose records are already gone (every job individually deleted
 *      first). Absolute roots are deterministic; tilde roots are skipped
 *      here (the route may expand them, but this pure module never dials).
 *
 * Dedup key is connection|host|root: the same root seen through two
 * records is one rm, not two; a root that differs only by trailing slash
 * is the same root.
 */
export function collectMirrorTargets(
  projectId: string,
  records: RecordWitness[],
  bound: BoundWitness | null
): MirrorTarget[] {
  const targets = new Map<string, MirrorTarget>();
  const add = (connectionId: string | null, host: string, rawRoot: string) => {
    const remoteRoot = rawRoot.replace(/\/+$/, "");
    if (!remoteRoot || remoteRoot.startsWith("~")) return; // unexpanded — refuse to guess
    const key = `${connectionId}|${host}|${remoteRoot}`;
    if (!targets.has(key)) targets.set(key, { connectionId, host, remoteRoot });
  };

  for (const rec of records) {
    if (rec.projectId !== projectId) continue;
    const rem = rec.remote;
    if (!rem?.remoteRoot) continue;
    add(rem.connectionId, rem.host, rem.remoteRoot);
  }

  if (bound?.remoteRoot) {
    add(bound.id, `${bound.host}:${bound.port}`, bound.remoteRoot);
  }

  return [...targets.values()];
}

/**
 * The cluster-side mirror dir for a target: <remoteRoot>/<projectId>.
 * Same convention every twin uses (remoteRoot/<projectId>/<type>_<id8>/ —
 * the extract field logs' shape), one level up.
 */
export function mirrorDirFor(target: MirrorTarget, projectId: string): string {
  return `${target.remoteRoot}/${projectId}`;
}
