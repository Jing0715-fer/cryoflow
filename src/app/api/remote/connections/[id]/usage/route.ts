import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { getConnection } from "@/lib/remote/connections";
import { execUnqueued, loginShellScript } from "@/lib/remote/ssh";
import { parseScontrolNodes, sortNodesForDisplay } from "@/lib/hpc/slurm-usage";

export const dynamic = "force-dynamic";

/**
 * GET /api/remote/connections/[id]/usage — live per-node GPU/CPU occupancy
 * for the Run-on-cluster dialog (t327, the user's show_free_gpu.sh).
 *
 * ONE SSH exec of `scontrol show nodes -o` (the same fields their script
 * greps from the long form: Gres= totals, AllocTRES= usage, CPUTot/CPUAlloc),
 * parsed by the pure slurm-usage module both sides share. The result is
 * cached in-process for 15s so the dialog's 30s auto-refresh (and two
 * dialogs open at once) never storms the login node; `?refresh=1` bypasses
 * the cache for the manual refresh button.
 *
 * Honesty contract (the probe's own dialect): a cluster that cannot or
 * will not answer is NOT a 500 — the route answers 200 with
 * { ok:false, error } and the panel degrades to a rose note that says
 * exactly what failed. Usage is informational; it never gates a dispatch.
 */

const CACHE_TTL_MS = 15_000;
/** Hard cap on rows handed to the UI (the panel scrolls; giant clusters
 *  do not get to flood the response). The parser's order is preserved. */
const MAX_NODES = 128;

const usageCache = new Map<string, { at: number; payload: ClusterUsagePayload }>();

type ClusterUsagePayload = {
  ok: boolean;
  checkedAt: string;
  command: string;
  nodes?: ReturnType<typeof parseScontrolNodes>;
  error?: string;
};

async function fetchUsage(connectionId: string): Promise<ClusterUsagePayload> {
  const conn = getConnection(connectionId);
  if (!conn) {
    return { ok: false, checkedAt: new Date().toISOString(), command: "", error: "connection not found" };
  }
  const command = "scontrol show nodes -o";
  // t384 — the QUICK-READ lane: this answer must not wait behind the
  // connection's serialized queue (poll sweeps, log fetches, sync-backs).
  // A queued exec's 12s budget expired before its turn ever came — the
  // field report's 「查询node使用情况一直失败」. scontrol is short,
  // read-only and idempotent: the exact execUnqueued contract.
  const r = await execUnqueued(conn, loginShellScript(command), { timeoutMs: 12_000 });
  if (r.error) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      command,
      error: `SSH to ${conn.host} failed (${r.error})`,
    };
  }
  if (r.code !== 0) {
    // 127 = no scontrol on the login node; other codes = slurmctl's own
    // complaint. First meaningful stderr line, login-shell noise stripped.
    const line =
      r.stderr
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.includes(".bashrc")) ?? `scontrol exited ${r.code}`;
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      command,
      error: r.code === 127 ? `no scontrol on ${conn.host} (not a Slurm login node?)` : line,
    };
  }
  const nodes = sortNodesForDisplay(parseScontrolNodes(r.stdout)).slice(0, MAX_NODES);
  if (nodes.length === 0) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      command,
      error: "scontrol answered but listed no nodes",
    };
  }
  return { ok: true, checkedAt: new Date().toISOString(), command, nodes };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const conn = getConnection(id);
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    const bypass = request.nextUrl.searchParams.get("refresh") === "1";
    const cached = usageCache.get(id);
    if (!bypass && cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return NextResponse.json(cached.payload);
    }
    const payload = await fetchUsage(id);
    usageCache.set(id, { at: Date.now(), payload });
    // Errors cache too — a dead cluster is not re-dialed every 30s by
    // every open dialog; the 15s TTL bounds the staleness either way.
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "usage fetch failed" },
      { status: 500 }
    );
  }
}
