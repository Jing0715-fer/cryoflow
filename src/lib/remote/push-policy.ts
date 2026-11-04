/**
 * CryoFlow — the twin-push planner (PURE — the t326/t327/t334 recipe, the
 * t1137 push direction of the sync-policy grammar).
 *
 * The t424 sync door brings cluster bytes HOME; the t1137 push leg is its
 * reverse face: an APP-SIDE native (the engine's local lane — select,
 * select2d, symexpand, rebalance — writing its books under RELION_DIR)
 * refreshes the CLUSTER twin its world carries. The seeder's stale twin
 * (select's `particles_select.star` cluster-side, 96 rows of the t1135
 * two-dot tilt) is the reason this door exists: a fossil retires through
 * a WRITER, not a hand edit — and the writer is the product's own push.
 *
 * THE RULE this module owns (the sync policy's caps/budgets applied in
 * reverse): the app-side native's book is METADATA — STAR/log/text files
 * push, image stacks NEVER (the cluster's stacks are the bulk producers'
 * own products; a laptop pushing GBs of `.mrcs` over SSH to "refresh" a
 * twin is the t339 loophole walked backwards). Under "everything" the
 * text-only gate lifts and the caps speak alone — the same explicit user
 * override the bring-home planner honors.
 *
 * PURE so the route, the probe and the unit speak ONE classification:
 * the same entry, the same context, the same verdict everywhere.
 *
 * The twin ADDRESS is not this module's business: it is the t396
 * deterministic formula (`remoteWorkdirForJob` — a fact about the JOB,
 * derivable with nothing but the job row and the connection), wrapped by
 * lib/remote/twin-push.ts. The planner only decides WHAT may ride.
 */

// relative (not "@/…") so bun's dynamic file-path import in a diag harness
// resolves it without the tsconfig alias — the sync-policy recipe.
import { KEY_TEXT_EXT } from "./sync-policy";

/** Why one entry did not ride. The planner's three; the route appends
 * its own two (absent-local, hygiene) at the verdict level — the planner
 * never sees a path, only (rel, size) pairs. */
export type PushSkipWhy =
  | "binary-book" // t1137 — the reverse metadata rule: images never push
  | "per-file-cap" // over the connection's maxFileMb — every policy
  | "budget"; // the whole-push budget ran out

export interface PushEntry {
  /** path relative to the job workdir (posix separators) */
  rel: string;
  size: number;
}

export interface PushPolicyContext {
  policy: "key-files" | "everything";
  /** the connection's single-file cap (MB) — every policy. */
  maxFileMb: number;
  /** the connection's whole-push budget (MB) — every policy. */
  maxTotalMb: number;
  /** the cluster workdir the take-list rides to (the honest note names it). */
  remoteWorkdir?: string;
}

export interface PushSkip extends PushEntry {
  why: PushSkipWhy;
}

export interface PushPlan {
  /** entries to push, in listing order, budget already deducted. */
  take: PushEntry[];
  /** entries that stay home, with the spoken why. */
  skip: PushSkip[];
}

/**
 * Classify a workdir listing into what rides to the twin and what stays.
 * PURE; budget arithmetic mirrored from planSyncBack (by listed size —
 * conservative: a file that fails mid-upload leaves the budget
 * over-deducted, never over-spent).
 */
export function planPush(entries: PushEntry[], ctx: PushPolicyContext): PushPlan {
  const capPerFile = ctx.maxFileMb * 1024 * 1024;
  let budget = ctx.maxTotalMb * 1024 * 1024;
  const take: PushEntry[] = [];
  const skip: PushSkip[] = [];
  for (const entry of entries) {
    const { rel, size } = entry;
    if (ctx.policy === "key-files" && !KEY_TEXT_EXT.test(rel)) {
      skip.push({ ...entry, why: "binary-book" });
      continue;
    }
    if (size > capPerFile) {
      skip.push({ ...entry, why: "per-file-cap" });
      continue;
    }
    if (budget - size < 0) {
      skip.push({ ...entry, why: "budget" });
      continue;
    }
    budget -= size;
    take.push(entry);
  }
  return { take, skip };
}

/** One skip's per-file line (the route's verdict error — the same word
 * everywhere, the t1132 honest-word law). */
export function describePushSkip(s: PushSkip, ctx: PushPolicyContext): string {
  switch (s.why) {
    case "binary-book":
      return `${s.rel} (image data — the push leg moves metadata books only; the cluster's image stacks are its bulk producers' own products, whatever their size, t1137)`;
    case "per-file-cap":
      return `${s.rel} (${(s.size / 1024 / 1024).toFixed(0)} MB > ${ctx.maxFileMb} MB cap)`;
    case "budget":
      return `${s.rel} (push budget exhausted)`;
  }
}
