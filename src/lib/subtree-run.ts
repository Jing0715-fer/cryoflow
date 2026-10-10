/**
 * t448 — the wavefront's verb: re-running a SUBTREE, not a job.
 *
 * The chain of precedents built a story with one missing verb: adoption
 * re-wires downstream (t443), the wavefront says which results predates
 * an upstream's latest run (t444), the healer re-runs a chain from a
 * given node — but OUTSIDE the product (scripts/demo-chain-resurrect.mjs,
 * --from <type>). This brain brings the verb inside: from any job, the
 * plan walks every DOWNSTREAM node in topological order — the order the
 * runs must happen in, because a re-run consumes its upstream's fresh
 * output and a child started before its parent's terminal state would
 * eat a half-written world.
 *
 * Laws:
 *   - only OUT-edges count: the subtree is "this job and everything it
 *     feeds" — upstream is never re-run by a downstream verb;
 *   - churn blocks the WHOLE plan: a running/pending node inside the
 *     subtree means a dispatch is already in flight — re-dispatching
 *     under it would queue a second run of the same work. The plan
 *     refuses and NAMES the churning node (t441 walk law: receipts name
 *     names, refusals included);
 *   - the order is BFS from the root with a name tie-break: same depth
 *     siblings run in a stable, greppable order on every call;
 *   - the roster speaks with a cap (t146 census dialect): the sentence
 *     names the first few and counts the tail.
 *
 * All pure brain — no store, no fetch, no React. The store wires the
 * execution (dispatch → await terminal → next) and the dialog wires the
 * lane (the cluster door builds one RemoteRunTarget for the whole
 * subtree).
 */

export interface SubtreeNode {
  id: string;
  name: string;
}

export interface SubtreeBlock {
  id: string;
  name: string;
  status: string;
}

export interface SubtreePlan {
  /** Root first, then descendants level by level (name tie-break). */
  order: SubtreeNode[];
  /** Running/pending nodes found inside the subtree — non-empty refuses
   *  the whole plan (a dispatch is already in flight). */
  blocked: SubtreeBlock[];
}

/** Jobs the plan reads from the world — the JobDTO's smallest truth. */
export interface SubtreeJobLike {
  id: string;
  name: string;
  status: string;
  /** t451 — when the current run started (ISO string). The scan reads
   *  it to tell a walk's own landing from a pre-walk result. */
  startedAt?: string | null;
}

/** BFS downstream order from `rootId` following only out-edges. Ties
 *  (same-depth siblings) break by name — stable across calls. */
export function subtreeOrder(
  jobs: readonly SubtreeJobLike[],
  edges: readonly { fromJobId: string; toJobId: string }[],
  rootId: string
): SubtreeNode[] {
  const byId = new Map(jobs.map((j) => [j.id, j] as const));
  const root = byId.get(rootId);
  if (!root) return [];
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    const list = childrenOf.get(e.fromJobId);
    if (list) list.push(e.toJobId);
    else childrenOf.set(e.fromJobId, [e.toJobId]);
  }
  const order: SubtreeNode[] = [{ id: root.id, name: root.name }];
  const seen = new Set<string>([root.id]);
  let frontier = [root.id];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const pid of frontier) {
      const kids = [...new Set(childrenOf.get(pid) ?? [])]
        .filter((id) => byId.has(id) && !seen.has(id))
        .map((id) => byId.get(id)!)
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const k of kids) {
        seen.add(k.id);
        order.push({ id: k.id, name: k.name });
        next.push(k.id);
      }
    }
    frontier = next;
  }
  return order;
}

/** The plan: subtree order + the churn check. Any running/pending node
 *  inside the subtree blocks the whole run — the plan refuses, the
 *  receipt names it. The server owns the deeper laws (a job that cannot
 *  run refuses its own dispatch); this guard only pre-filters what the
 *  server would obviously refuse — the door is a courtesy, the run
 *  route is the authority (t441 door law). */
export function planSubtreeRun(
  jobs: readonly SubtreeJobLike[],
  edges: readonly { fromJobId: string; toJobId: string }[],
  rootId: string
): SubtreePlan {
  const order = subtreeOrder(jobs, edges, rootId);
  const blocked: SubtreeBlock[] = [];
  if (order.length === 0) return { order, blocked };
  const byId = new Map(jobs.map((j) => [j.id, j] as const));
  // walk the order (root first) so the blocked roster speaks in run order
  for (const node of order) {
    const j = byId.get(node.id)!;
    if (j.status === "running" || j.status === "pending") {
      blocked.push({ id: j.id, name: j.name, status: j.status });
    }
  }
  return { order, blocked };
}

/** Roster cap for the sentence — the census dialect (t146): name the
 *  first few, count the tail. */
export const SUBTREE_ROSTER_CAP = 4;

/** The sentence the dialog's checkbox line speaks: what will re-run, in
 *  what order, and (when refused) who blocks it. One truth for the aria
 *  label, the title and the visible line. */
export function describeSubtreeRun(plan: SubtreePlan): string {
  if (plan.order.length === 0) return "No downstream jobs — only this one would re-run.";
  const names = plan.order.map((n) => n.name);
  const head = names.slice(0, SUBTREE_ROSTER_CAP).join(" → ");
  const tail = names.length - SUBTREE_ROSTER_CAP;
  const roster = tail > 0 ? `${head} … and ${tail} more` : head;
  if (plan.blocked.length > 0) {
    const b = plan.blocked.map((x) => `${x.name} (${x.status})`).slice(0, SUBTREE_ROSTER_CAP).join(", ");
    const bTail = plan.blocked.length - SUBTREE_ROSTER_CAP;
    return `Blocked — ${b}${bTail > 0 ? ` and ${bTail} more` : ""} ${plan.blocked.length === 1 ? "is" : "are"} still churning inside the subtree. Let the run land first, then ask again.`;
  }
  return `Re-runs ${plan.order.length} job${plan.order.length === 1 ? "" : "s"} in run order: ${roster}. Stops at the first refusal — everything re-ran before it keeps its fresh result.`;
}

/* ------------------------------------------------------------------ */
/* t449 — the verb's face. The orchestration loop lives in the store,  */
/* invisible by construction: a 13-node subtree re-run walks for       */
/* minutes with no readout, no current-node name, no way to say stop.  */
/* This brain is the face's smallest truths — ticks, headline, stop    */
/* receipt, guard — all pure, all benchable. The strip component and   */
/* the store loop are the lenses; the laws live here.                  */
/* ------------------------------------------------------------------ */

/** The orchestration's live state — the store holds exactly one. */
export interface SubtreeOrchState {
  rootId: string;
  rootName: string;
  /** The authoritative run order (planned from the live world at the
   *  moment of dispatch — the plan the loop is actually walking). */
  order: SubtreeNode[];
  /** Nodes landed completed so far (the loop's `done` counter, mirrored
   *  so the face renders from state, not from closure memory). */
  index: number;
  /** The stop verb's request — the loop checks it BEFORE each next
   *  dispatch; the job now running finishes on its own. */
  stopRequested: boolean;
  /** t450 — this walk was resurrected from the session record after a
   *  reload: the strip wears the resumed honesty line and the chip. */
  resumed?: boolean;
  /** t451 — the resurrection crossed a tab's death: a SIBLING tab
   *  claimed the walk after the original owner went silent. The strip
   *  wears the inherited chip; the honest line names the hand-off. */
  inherited?: boolean;
}

/** Per-node tick states for the strip's progress dots. */
export type OrchTick = "done" | "active" | "todo";

/** Above this many nodes the dots retire — the headline carries the
 *  count alone (30 dots is a texture, not a readout). */
export const TICKS_CAP = 24;

export function ticksVisible(total: number): boolean {
  return total > 0 && total <= TICKS_CAP;
}

/** The dot row: `done` nodes filled, the node in flight pulsing (only
 *  while one exists), the rest waiting. `done` clamps — a face that
 *  reads backwards is a lie, never a glitch. */
export function orchestrationTicks(total: number, done: number): OrchTick[] {
  if (total <= 0) return [];
  const d = Math.max(0, Math.min(done, total));
  return Array.from({ length: total }, (_, i) =>
    i < d ? "done" : i === d && d < total ? "active" : "todo"
  );
}

/** The strip's headline — one sentence that is true at every instant:
 *  count so far, then who is running now (or the refreshed close). */
export function orchestrationHeadline(o: {
  total: number;
  done: number;
  currentName?: string | null;
}): string {
  const { total, done, currentName } = o;
  if (total <= 0) return "Nothing to re-run";
  const d = Math.max(0, Math.min(done, total));
  if (d >= total) return `${total} of ${total} re-ran — subtree refreshed`;
  const running = currentName ? ` — ${currentName} is running now` : "";
  return `${d} of ${total} re-ran${running}`;
}

/** The user-stop receipt's sentence. done includes the node that was in
 *  flight when stop was asked (it lands on its own before the loop
 *  breaks). Verb agreement follows the remaining count. */
export function stopReceiptSentence(done: number, total: number): string {
  const remaining = Math.max(0, total - done);
  return `You stopped the dispatching — ${done} of ${total} re-ran; the remaining ${remaining} ${
    remaining === 1 ? "keeps" : "keep"
  } their current results.`;
}

/** The one-orchestration-at-a-time guard. Two subtree walks would fight
 *  over the same lanes — the second is refused by naming both roots. */
export function orchGuardSentence(activeRootName: string): string {
  return `A subtree re-run from ${activeRootName} is already in flight — stop it or let it land before starting another.`;
}

/** The strip's honesty line: where the walk lives and what kills it.
 *
 *  t450 — the walk's plan, progress and target survived a reload in
 *  this tab (the session record) and the boot resumed the walk from
 *  the world's own truth.
 *
 *  t451 — the record moved house: sessionStorage (one tab's private
 *  memory) → localStorage (the workspace's shared memory). The walk
 *  now follows the WORKSPACE: close this tab and a sibling tab adopts
 *  it (the claim law — heartbeat stale means the owner is gone), or
 *  the next tab to open does. The last boundary is "every tab closed
 *  AND none opens" — the record waits in the workspace's memory until
 *  a heir shows up. The face says so before the user learns it the
 *  hard way. */
export const ORCH_TAB_LAW =
  "Survives a reload and a closed tab — another tab of this workspace picks the walk up.";

/** The honesty line after a same-tab resurrection — the face wears
 *  the resumed state: the walk came back from this tab's own reload. */
export const ORCH_TAB_LAW_RESUMED =
  "Resumed after a reload — the walk now follows the workspace across tabs.";

/** The honesty line after an inheritance — the original owner went
 *  silent; this tab claimed the walk and the world-truth scan brought
 *  it back here. */
export const ORCH_TAB_LAW_INHERITED =
  "Inherited from another tab — the walk continues here and follows the workspace.";

/** The receipt for a walker that woke up dispossessed: a sibling tab
 *  claimed the walk while this one slept (background-throttled heart
 *  beat, closed drawer, whatever made it silent). The walker stands
 *  down BETWEEN nodes — the node it was waiting for landed and counts
 *  here — and the dispatching continues on the heir's face. Intent,
 *  not failure: the neutral dialect, never the destructive one. */
export function handoffReceiptSentence(): string {
  return "Another tab of this workspace took over the walk — the dispatching continues there; this tab stands down.";
}

/* ------------------------------------------------------------------ */
/* t450 — the walk's second breath. The loop died with the reload; the  */
/* plan, the progress and the target did not (sessionStorage). The boot */
/* re-enters the walk by scanning the LIVE world against the persisted  */
/* order — the world is the truth, the record is just the plan.         */
/* ------------------------------------------------------------------ */

/** The boot-time scan: persisted order vs live jobs. Laws:
 *  - completed nodes at the head count as done — the walk's own
 *    dispatches landed while the tab was dead;
 *  - t451 — a completion counts ONLY if it postdates the walk's own
 *    first breath (walkStart, stamped when the record was first saved):
 *    a node that was ALREADY completed before the walk began (a previous
 *    run's result) is not this walk's landing — the walk must re-run it
 *    so it eats its upstream's fresh output. Caught live: a re-run over
 *    an already-completed subtree read the old results as fresh landings
 *    and short-circuited to allLanded without re-running anything;
 *  - a node the world no longer has is missing, not failed — it is
 *    filtered out of the walk and named in the receipt;
 *  - the first LIVE non-counted node is the resume point: running or
 *    pending = the in-flight node, await it; idle or completed-before-
 *    the-walk = dispatch it; failed = the frontier found the walk dead
 *    — stop;
 *  - every node landed this walk = the walk finished on its own while
 *    away;
 *  - a persisted stop request is honored without dispatching anything.
 *  Missing nodes never break the leading count — completed and deleted
 *  interleave freely at the head (a deleted node is not unfinished).
 *  walkStart omitted (legacy records) → every completed node counts
 *  (the t450 semantics, kept for records that cannot answer the
 *  question). */
export interface ResumeScan {
  /** Nodes landed completed at the head of the persisted order. */
  done: number;
  /** The live resume point (undefined when nothing remains). */
  resumeNode?: SubtreeNode;
  /** The resume node is mid-flight (running/pending) — the walk must
   *  AWAIT it, never re-dispatch it (the live 409 door caught this
   *  exact double-dispatch in t450's first live fire). */
  resumeInflight: boolean;
  /** Everything still to dispatch, missing nodes filtered out. */
  remaining: SubtreeNode[];
  /** Persisted nodes the world no longer holds. */
  missing: SubtreeNode[];
  /** The whole walk landed while the tab was away. */
  allLanded: boolean;
  /** A node at the resume point failed — the walk stops here. */
  failedFrontier?: SubtreeNode;
}

export function resumeScan(
  order: readonly SubtreeNode[],
  jobs: readonly SubtreeJobLike[],
  opts?: { walkStart?: number }
): ResumeScan {
  const byId = new Map(jobs.map((j) => [j.id, j] as const));
  const missing: SubtreeNode[] = [];
  const live: Array<{ node: SubtreeNode; status: string | null }> = [];
  for (const node of order) {
    const j = byId.get(node.id);
    if (!j) {
      missing.push(node);
      continue;
    }
    live.push({ node, status: j.status });
  }
  // t451 — the grace absorbs the dispatch gap: the walk's first breath
  // (the record save) lands a beat BEFORE the first server-side
  // startedAt stamp; five seconds of slack keeps same-host clock jitter
  // from un-counting the walk's own first landing.
  const WALK_START_GRACE_MS = 5_000;
  const landedThisWalk = (job: SubtreeJobLike): boolean => {
    if (opts?.walkStart == null) return true; // legacy record — cannot ask
    if (!job.startedAt) return false; // no witness → not this walk's
    const started = new Date(job.startedAt).getTime();
    return Number.isFinite(started) && started >= opts.walkStart - WALK_START_GRACE_MS;
  };
  let done = 0;
  let cursor = 0;
  while (cursor < live.length) {
    const entry = live[cursor];
    if (entry.status !== "completed") break;
    const j = byId.get(entry.node.id)!;
    if (!landedThisWalk(j)) break; // a pre-walk result — the walk must re-run it
    done += 1;
    cursor += 1;
  }
  const remaining = live.slice(cursor).map((x) => x.node);
  const resumeNode = remaining[0];
  const resumeStatus = resumeNode ? live[cursor].status : null;
  const failedFrontier =
    resumeNode && resumeStatus === "failed" ? resumeNode : undefined;
  return {
    done,
    resumeNode,
    resumeInflight: resumeStatus === "running" || resumeStatus === "pending",
    remaining,
    missing,
    allLanded: live.length > 0 && cursor === live.length,
    failedFrontier,
  };
}

/** The resume welcome's title — the walk's second receipt. */
export function resumeToastTitle(done: number, total: number): string {
  return `Subtree re-run resumed — ${done} of ${total} already landed`;
}

/** The resume welcome's description: what happens next, and (when the
 *  world lost nodes while the tab was away) what will be skipped. */
export function resumeToastDescription(
  nextName: string | null,
  missing: readonly SubtreeNode[]
): string {
  const next = nextName
    ? `Continuing from ${nextName}.`
    : "Nothing left to dispatch.";
  if (missing.length === 0) return next;
  const names = missing
    .slice(0, SUBTREE_ROSTER_CAP)
    .map((n) => n.name)
    .join(", ");
  const tail = missing.length - SUBTREE_ROSTER_CAP;
  return `${next} Skipped — gone from the canvas while the tab was away: ${names}${tail > 0 ? ` and ${tail} more` : ""}.`;
}

/** The frontier receipt for a walk that found its node FAILED after the
 *  reload — the death happened while the tab was away; the sentence
 *  carries that witness. */
export function resumeFrontierReason(node: SubtreeNode): string {
  return `${node.name} failed while the tab was away — the run died with the reload window; its downstream did not re-run.`;
}

/** The inherited welcome's description prefix — the receipt names the
 *  hand-off before it names the plan, so the user knows WHY a walk
 *  they did not start here just arrived on their face. */
export const INHERITED_PREFIX = "Inherited from another tab — ";
