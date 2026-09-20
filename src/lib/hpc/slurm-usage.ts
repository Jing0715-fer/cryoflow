/**
 * CryoFlow — Slurm node USAGE truth (CLIENT-SAFE pure module, t327).
 *
 * The user's own ticket carried their script (show_free_gpu.sh):
 *
 *   fullgpu=`scontrol show nodes gpu01 | grep Gres`
 *   freegpu=`scontrol show nodes gpu01 | grep AllocTRES`
 *   printf … Partion  Total\ CPU  Total\ GPU  Use\ CPU\&GPU …
 *
 * …one line per node: what the node HAS (Gres=gpu:N, CPUTot) and what is
 * already spoken for (AllocTRES=cpu=X,gres/gpu=Y — empty = nothing
 * allocated). This module is that script's parser, promoted to the app's
 * single source: the /api/remote/connections/[id]/usage route runs
 * `scontrol show nodes -o` over SSH and feeds the stdout HERE, the run
 * dialog renders the result next to the partition picker, and the diag
 * suite pins the truth table — one implementation, three consumers (the
 * t320 log-autopick / t326 gpu-width doctrine: the table the dialog
 * shows cannot drift from the cluster's own words).
 *
 * The parser accepts BOTH scontrol dialects — one-line (`-o`) records and
 * the classic long form the user's script greps (records re-united on
 * their `NodeName=` boundaries) — because the app asks for -o but the
 * fixture dialects and future callers should not have to care.
 *
 * Zero imports — client/server/test share the same implementation.
 */

/** One node's occupancy, as Slurm itself reports it. */
export interface SlurmNodeUsage {
  /** NodeName (host name, e.g. "brain2" / "gpu06"). */
  node: string;
  /** Partitions the node serves (Partitions=a,b — may be empty). */
  partitions: string[];
  /** Primary state word: IDLE / MIXED / ALLOCATED / DOWN / DRAIN / … */
  state: string;
  /** Full State token as scontrol spelled it ("IDLE+DRAIN", "MIXED*"). */
  stateRaw: string;
  /** CPUTot — cores the node offers. */
  cpuTotal: number;
  /** CPUs already allocated (AllocTRES cpu=, falling back to CPUAlloc=). */
  cpuAlloc: number;
  /** GPUs the node offers (Gres=gpu[:model]:N summed across segments). */
  gpuTotal: number;
  /** GPUs already allocated (AllocTRES gres/gpu[[:model]]=N summed). */
  gpuAlloc: number;
}

/** GPUs free on the node (never negative — a stray TRES cannot invent capacity). */
export function nodeFreeGpus(n: Pick<SlurmNodeUsage, "gpuTotal" | "gpuAlloc">): number {
  return Math.max(0, n.gpuTotal - n.gpuAlloc);
}

/** CPUs free on the node. */
export function nodeFreeCpus(n: Pick<SlurmNodeUsage, "cpuTotal" | "cpuAlloc">): number {
  return Math.max(0, n.cpuTotal - n.cpuAlloc);
}

/** True when the node cannot take work at all (DOWN / DRAIN / …). */
export function nodeUnavailable(n: Pick<SlurmNodeUsage, "state">): boolean {
  return n.state === "DOWN" || n.state === "DRAIN" || n.state === "DRAINING" || n.state === "FAIL";
}

/**
 * Gres= field → total GPU count. Grammar (Slurm's own):
 *   gpu:5            → 5
 *   gpu:A100:5       → 5     (typed GRES)
 *   gpu:5(S:0-1)     → 5     (slot map suffix — stripped)
 *   gpu:2,gpu:4      → 6     (mixed segments sum)
 *   gpu              → 0     (countless — Slurm spells gpu:0 there in practice)
 *   (null) / empty   → 0
 */
export function gresGpuTotal(gres: string): number {
  const s = (gres ?? "").trim();
  if (!s || s === "(null)") return 0;
  let total = 0;
  for (const seg of s.split(",")) {
    // strip any parenthesized suffix (slot maps, SED notes)
    const clean = seg.replace(/\(.*\)\s*$/, "").trim();
    if (!clean) continue;
    // gpu | gpu:N | gpu:MODEL:N
    const m = /^gpu(?::([^:]+))?:(\d+)$/.exec(clean) ?? /^gpu$/.exec(clean);
    if (!m) continue;
    total += m[2] ? Number(m[2]) : 0;
  }
  return total;
}

/** AllocTRES= gres/gpu share → allocated GPU count. cpu= is ignored here. */
export function allocTresGpus(tres: string): number {
  const s = (tres ?? "").trim();
  if (!s || s === "(null)") return 0;
  let total = 0;
  for (const seg of s.split(",")) {
    // gres/gpu=1 | gres/gpu:A100=2 (typed) — NOT gres/shard=… or mem=…
    const m = /^gres\/gpu(?::[^=]+)?=(\d+)$/.exec(seg.trim());
    if (m) total += Number(m[1]);
  }
  return total;
}

/** AllocTRES= cpu= share → allocated CPUs (null when the TRES names none). */
export function allocTresCpus(tres: string): number | null {
  const s = (tres ?? "").trim();
  if (!s || s === "(null)") return null;
  for (const seg of s.split(",")) {
    const m = /^cpu=(\d+)$/.exec(seg.trim());
    if (m) return Number(m[1]);
  }
  return null;
}

/** A State token's primary word: "IDLE+DRAIN" → "IDLE", "MIXED*" → "MIXED". */
export function stateWord(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  return s.split("+")[0].replace(/\*+$/, "").trim().toUpperCase();
}

/** First unsigned integer a token-shaped field carries, else fallback. */
function fieldNum(record: string, key: string, fallback: number): number {
  const m = new RegExp(`\\b${key}=(\\d+)`).exec(record);
  return m ? Number(m[1]) : fallback;
}

function fieldRaw(record: string, key: string): string | null {
  const m = new RegExp(`\\b${key}=(\\S*)`).exec(record);
  return m ? m[1] : null;
}

/**
 * Parse `scontrol show nodes` output (either dialect) into usage rows.
 * Records are re-united on their `NodeName=` boundaries — the one-line
 * `-o` form yields one record per line, the long form spans several
 * lines per node (the form the user's show_free_gpu.sh greps). Nodes
 * without a NodeName (scontrol's error chatter) are dropped silently —
 * the caller sees only nodes.
 */
export function parseScontrolNodes(text: string): SlurmNodeUsage[] {
  const out: SlurmNodeUsage[] = [];
  const chunks = (text ?? "").split(/(?=NodeName=)/);
  for (const chunk of chunks) {
    const record = chunk.trim();
    if (!record.startsWith("NodeName=")) continue;
    const node = fieldRaw(record, "NodeName");
    if (!node) continue;
    const gres = fieldRaw(record, "Gres") ?? "";
    // AllocTRES: the LAST field on both dialects' records — it may be
    // EMPTY (nothing allocated; the user's own sample rows say exactly
    // that), so \S* (never \S+) is load-bearing here.
    const tresMatch = /\bAllocTRES=([^\n]*?)(?=\s\S+=|\s*$)/.exec(record);
    const tres = tresMatch ? tresMatch[1].trim() : "";
    const stateRaw = fieldRaw(record, "State") ?? "";
    const partitionsRaw = fieldRaw(record, "Partitions") ?? "";
    const cpuTotal = fieldNum(record, "CPUTot", 0);
    // AllocTRES cpu= is the scheduler's own ledger; CPUAlloc= agrees on
    // every healthy node and stands in when the TRES names none. No
    // clamping here — free is clamped at read (nodeFreeCpus), the raw
    // alloc stays the cluster's word.
    const cpuAlloc = allocTresCpus(tres) ?? fieldNum(record, "CPUAlloc", 0);
    out.push({
      node,
      partitions: partitionsRaw
        ? partitionsRaw.split(",").map((p) => p.trim()).filter(Boolean)
        : [],
      state: stateWord(stateRaw),
      stateRaw,
      cpuTotal,
      cpuAlloc,
      gpuTotal: gresGpuTotal(gres),
      gpuAlloc: allocTresGpus(tres),
    });
  }
  return out;
}

/**
 * Display order: GPU nodes first (widest offer first), then CPU nodes —
 * the run dialog cares about GPUs, and the user's script lists the GPU
 * nodes exclusively. Numeric-aware node names (gpu2 sorts before gpu10).
 */
export function sortNodesForDisplay(nodes: SlurmNodeUsage[]): SlurmNodeUsage[] {
  return [...nodes].sort(
    (a, b) =>
      b.gpuTotal - a.gpuTotal ||
      b.cpuTotal - a.cpuTotal ||
      a.node.localeCompare(b.node, undefined, { numeric: true })
  );
}
