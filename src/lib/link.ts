/**
 * CryoFlow — soft-link resolution (server only).
 *
 * A "linked" job (Job.linkedJobId set) is a read-only mirror of an ORIGINAL
 * job living in (usually) another workspace. Downstream jobs wired to the
 * link consume the ORIGINAL's outputs — so every results endpoint resolves
 * the link chain to its root before reading runs/logs. Cycle-safe.
 */

import type { Job } from "@prisma/client";
import { db } from "@/lib/db";

/** Max link hops before treating the chain as cyclic/corrupt. */
const MAX_LINK_HOPS = 16;

/**
 * Load a job by id and follow its soft-link chain to the ROOT original.
 * Returns the job itself when it is not a link. Null when the id is unknown.
 */
export async function findEffectiveJob(id: string): Promise<Job | null> {
  const initial = await db.job.findUnique({ where: { id } });
  if (!initial || !initial.linkedJobId) return initial;
  const seen = new Set<string>([initial.id]);
  let job: Job = initial;
  for (let hop = 0; hop < MAX_LINK_HOPS && job.linkedJobId; hop++) {
    const target = await db.job.findUnique({ where: { id: job.linkedJobId } });
    if (!target || seen.has(target.id)) break; // dangling / cyclic — treat current as root
    seen.add(target.id);
    job = target;
  }
  return job;
}

/**
 * Effective id for run/log lookups — follows the link chain synchronously
 * from an ALREADY-LOADED row (no extra db round-trips for non-links).
 */
export function effectiveIdOf(job: { id: string; linkedJobId: string | null }): string {
  // chains longer than 1 are collapsed at creation time (links always point
  // at originals), but stay defensive: db-free callers use findEffectiveJob
  return job.linkedJobId ?? job.id;
}
