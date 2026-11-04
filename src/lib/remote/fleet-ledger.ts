/**
 * CryoFlow — the FLEET LEDGER (t1053): per-connection disk budget.
 *
 * The question the roadmap left standing (docs/remote-relion.md §7's last
 * weakly-justified "deliberately not done"): a project's remote runs live
 * on a cluster, and their local mirrors live under data/relion/<projectId>/
 * — the storage map answers the LOCAL side (categories, runs, graves) and
 * the cleanup dialog answers BOTH sides for ONE job at a time, but NO
 * surface answers the fleet question: "for this cluster connection, how
 * many bytes do my workdirs hold THERE, and how many do their mirrors
 * hold HERE?"
 *
 * The answer is a ledger per connection:
 *   · the CLUSTER side is measured live over SSH (remoteWorkdirBytes —
 *     the cleanup dialog's own before/after well, reused verbatim) under
 *     a total time budget, stamped measuredAt, and cached in a sidecar
 *     so opening the dialog never blocks on N sequential du probes —
 *     the band says how stale its cluster numbers are, honestly;
 *   · the MIRROR side is computed fresh on every read from the same walk
 *     the storage map drinks (computeStorageReport's per-job rows), so
 *     "bytes here" is always the disk's own word;
 *   · the connection's sync ceiling (maxTotalMb — the sync-policy cap on
 *     what sync-back may bring home) rides along as the yardstick the
 *     mirror side is read against.
 *
 * The ONE-WELL shape: aggregateFleetLedger is PURE (plain rows in, ledger
 * out — the unit band pins the arithmetic: heaviest-first order, null
 * remoteBytes sorted last and counted unmeasured, per-connection totals,
 * reachability = at least one answered probe); computeFleetLedger is the
 * thin IO shell (DB join + readRuns join + probes + sidecar). The AI's
 * get_storage_report drinks computeStorageReport directly — this ledger
 * is its cluster-side twin and is served to the same family through the
 * route first; an agent tool mouth can follow without forking the well.
 *
 * Server-only (fs, ssh, db).
 */

import path from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { db } from "@/lib/db";
import { DATA_DIR } from "@/lib/paths";
import {
  computeStorageReport,
  type StorageJobRow,
} from "@/lib/relion/storage-report";
import { getConnection } from "@/lib/remote/connections";
import { remoteInfoFor } from "@/lib/remote/remote-run";
import { remoteWorkdirBytes } from "@/lib/remote/remote-cleanup";
import type { RemoteConnection } from "@/lib/remote/types";

/** Total wall-clock the live probes may spend (the mock answers in ms; a
 *  real cluster spends ~0.5–2 s per workdir). Past the budget the rest
 *  are counted unmeasured — a partial ledger with an honest stamp beats
 *  a slow dialog. */
const PROBE_BUDGET_MS = 12_000;

/** the sidecar — the last MEASURED snapshot per project (the
 *  storage-diag pattern: corrupt sidecar → start empty, write 0600,
 *  the sidecar is a courtesy, never a verdict of its own). */
const SIDECAR_FILE = path.join(DATA_DIR, "remote-fleet-ledger.json");

/** the ledger's MEMORY (t1055): how many PAST measurements a connection's
 *  trend ring keeps. The row's own numbers are the present; the ring is
 *  everything before them, newest first — the next measure pushes the
 *  current one back and the delta finds its voice. 12 × ~30B per point
 *  per connection: a courtesy's courtesy, the sidecar stays tiny.
 *  t1057 — the NUMBER lives in the client-safe well (fleet-trend.ts
 *  exports FLEET_TREND_RING_CAP) so the client mouths can speak the cap
 *  without dragging this server module into the bundle; the import
 *  below binds it for the ledger's own arithmetic and the re-export
 *  keeps the ledger's callers spelling the one name. */
import { FLEET_TREND_RING_CAP as FLEET_HISTORY_CAP } from "./fleet-trend";
import { fleetHistoryOutgoingPoint, mirrorBytesTotalFor } from "./fleet-trend";
export { FLEET_HISTORY_CAP };

/** One remembered measurement of a connection's cluster-side total.
 *  bytes null = that measurement heard nothing from the cluster (every
 *  probe unanswered) — an honest hole in the trend, never a fake zero.
 *  t1095 — mirrorBytes rides beside it (the SECOND CHANNEL): the local
 *  mirrors' own total at that moment. undefined = the point predates
 *  the channel (the key is ABSENT on disk — JSON.stringify drops it,
 *  the old shape survives byte-for-byte); null = the mirror walk
 *  didn't speak at that measure. The reader never derives one from
 *  the other — two channels, two words, remembered exactly as they
 *  fell (the faithfulness law's second face). */
export interface FleetHistoryPoint {
  at: string;
  bytes: number | null;
  mirrorBytes?: number | null;
}

export interface FleetJobRow {
  jobId: string;
  jobName: string;
  type: string;
  status: string;
  remoteWorkdir: string;
  /** Cluster-side bytes as last measured. null = the probe didn't answer
   *  (workdir gone, connection dead, or the probe budget ran out) — an
   *  honest hole, never a 0 wearing a number's clothes. */
  remoteBytes: number | null;
  /** Local mirror bytes (the disk's own word, fresh on every read). */
  localBytes: number;
  localExists: boolean;
}

export interface FleetConnectionRow {
  /** null = the ledger remembers the run but the connection row is gone —
   *  the orphan band speaks the record's own name, not a lie. */
  connectionId: string | null;
  connectionName: string;
  host: string | null;
  jobs: FleetJobRow[];
  /** Heaviest first: remoteBytes desc, nulls last, name tiebreak. */
  remoteBytesTotal: number | null;
  localBytesTotal: number;
  /** The sync policy's ceiling on what sync-back may bring home. */
  syncCeilingBytes: number | null;
  measured: number;
  unmeasured: number;
  measuredAt: string | null;
  /** ≥1 probe answered — the connection spoke. */
  reachable: boolean;
  /** t1100 — THE WALK'S SPOKENNESS, the mirror side's own stamp (the
   *  t1095 law's row-level seat): the local mirror walk answered for this
   *  project (computeStorageReport returned). false = the walk failed —
   *  every mirror face (the total, the per-run exists flags, the
   *  unmirrored count) is UNVERIFIED, and the mouths say so instead of
   *  wearing a zero or a "no mirror" name the walk never earned. */
  mirrorWalkSpoke: boolean;
  /** The ledger's memory (t1055): this connection's PAST measured totals,
   *  newest first, capped at FLEET_HISTORY_CAP. The live row's own numbers
   *  are the present and are NOT duplicated here — an empty ring with a
   *  set measuredAt means the trend begins with this measurement. */
  history: FleetHistoryPoint[];
}

export interface FleetLedgerResponse {
  projectId: string;
  /** Heaviest connection first (remoteBytesTotal desc). [] = this project
   *  has no remote runs — the honest empty, the section dissolves. */
  connections: FleetConnectionRow[];
  measuredAt: string | null;
  /** measuredAt set but some workdirs went unanswered (or were never
   *  probed) — the band should offer "Measure again". */
  incomplete: boolean;
  generatedAt: string;
}

/** A connection's sidecar snapshot: exactly what the probes produced.
 *  t1095 — mirrorBytesTotal rides beside the cluster sizes (the SECOND
 *  CHANNEL's on-disk home): the connection's local mirror total at
 *  measure time. undefined = a pre-channel entry (the old generation's
 *  shape, read as-is); null = the mirror walk didn't speak; a number
 *  = the walk's own word. The push law reads it to stamp the OUTGOING
 *  point — the channel-young sidecar entries produce channel-young
 *  points, and the ring's memory ages into the channel honestly. */
interface SidecarConnection {
  connectionId: string | null;
  connectionName: string;
  host: string | null;
  syncCeilingBytes: number | null;
  sizes: Record<string, number | null>; // jobId → probe answer
  mirrorBytesTotal?: number | null;
  measuredAt: string;
}

interface SidecarShape {
  projects?: Record<
    string,
    {
      connections: SidecarConnection[];
      measuredAt: string;
      /** t1055 — the memory: connection key (connectionId, else name for
       *  the orphan ride) → the ring of PAST measurements, newest first. */
      history?: Record<string, FleetHistoryPoint[]>;
    }
  >;
}

/** the ring's arithmetic: the sum of a snapshot's ANSWERED probes — no
 *  answer at all is a hole, spoken null, never a zero wearing a sum. */
function totalMeasuredBytes(sizes: Record<string, number | null>): number | null {
  let sum = 0;
  let answered = 0;
  for (const v of Object.values(sizes)) {
    if (v != null) {
      sum += v;
      answered += 1;
    }
  }
  return answered > 0 ? sum : null;
}

function readSidecar(): SidecarShape {
  try {
    const parsed = JSON.parse(readFileSync(SIDECAR_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as SidecarShape) : {};
  } catch {
    return {}; // absent or corrupt → start empty (the courtesy law)
  }
}

function writeSidecar(all: SidecarShape): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(SIDECAR_FILE, JSON.stringify(all, null, 2), { mode: 0o600 });
  } catch {
    // the sidecar is a courtesy — a failed write never fails a measured ledger
  }
}

/* ------------------------------------------------------------------ */
/* t1058 — the fleet memory's OPS face (the ring's fifth mouth)         */
/* ------------------------------------------------------------------ */

/** One project-connection ring as the OPS view sees it: how full, and
 *  when the newest remembered measure landed. No clusters are asked —
 *  the sidecar's own memory, read as bytes. */
export interface FleetMemoryRing {
  projectId: string;
  /** the history record's key — the connectionId, else the orphan's
   *  name ride (the E5 seed law's own keying) */
  connectionKey: string;
  /** the snapshot's own name for the connection; a stale key with no
   *  matching snapshot row falls back to the key itself (never a blank) */
  connectionName: string;
  points: number;
  /** the newest remembered measure (null = an empty ring) */
  lastAt: string | null;
  lastBytes: number | null;
  /** t1059 — the ring's SECOND-newest point, riding as a fact on disk:
   *  the AI's drill speaks each ring's delta in one breath without
   *  re-reading the sidecar (the arithmetic stays fleetTrendDelta's —
   *  the well drinks [prev] as the history and the newest as current).
   *  null = the ring holds fewer than two points (the delta says
   *  "begins"). Never derived, never guessed — history[1] or nothing. */
  prevAt: string | null;
  prevBytes: number | null;
  /** t1060 — the ring's FULL memory riding as facts on disk (newest
   *  first, exactly as the sidecar holds it, defensively capped at
   *  read): the drill's span clause speaks the far end ("a week ago
   *  the cluster held X") and any future mouth drinks the same array
   *  without re-reading the file. The two ends above stay — they are
   *  the last-hop dialect's convenience, and the pins speak them.
   *  t1095 — the points carry the SECOND CHANNEL when the sidecar
   *  remembers it (mirrorBytes, optional — channel-young points lack
   *  the key); the span's mirror clause drinks it, nothing derives. */
  history: { at: string; bytes: number | null; mirrorBytes?: number | null }[];
}

export interface FleetSidecarMemory {
  /** the sidecar file exists and parsed — an absent/corrupt sidecar is
   *  SAID (the courtesy law: an absence is a fact, never a guess) */
  sidecar: boolean;
  rings: FleetMemoryRing[];
  /** the summed remembered measures across every ring */
  totalPoints: number;
}

/** What the sidecar remembers, for the diagnostics panel (and the AI's
 *  box summary) to speak: which rings exist, how full each is, when the
 *  last measure landed. Total (never throws — readSidecar already
 *  catches), cheap (one small JSON read), and honest (sidecar:false is
 *  the "nothing written yet" fact, not an error). */
export function readFleetSidecarMemory(): FleetSidecarMemory {
  const all = readSidecar();
  const sidecar = existsSync(SIDECAR_FILE);
  const rings: FleetMemoryRing[] = [];
  for (const [projectId, snap] of Object.entries(all.projects ?? {})) {
    const nameByKey = new Map(
      snap.connections.map((c) => [c.connectionId ?? c.connectionName, c.connectionName])
    );
    for (const [key, history] of Object.entries(snap.history ?? {})) {
      const newest = history[0] ?? null;
      const prev = history[1] ?? null; // t1059 — the delta's other end
      rings.push({
        projectId,
        connectionKey: key,
        connectionName: nameByKey.get(key) ?? key,
        points: history.length,
        lastAt: newest?.at ?? null,
        lastBytes: newest?.bytes ?? null,
        prevAt: prev?.at ?? null,
        prevBytes: prev?.bytes ?? null,
        // t1060 — the whole ring rides (newest first), capped at read
        // like every other read of the memory (the E4 law's third face)
        history: history.slice(0, FLEET_HISTORY_CAP),
      });
    }
  }
  rings.sort(
    (a, b) =>
      b.points - a.points ||
      a.projectId.localeCompare(b.projectId) ||
      a.connectionKey.localeCompare(b.connectionKey)
  );
  return { sidecar, rings, totalPoints: rings.reduce((s, r) => s + r.points, 0) };
}

/** The sort the ledger speaks everywhere: remoteBytes desc, nulls last,
 *  name tiebreak (the storage rows' own bytes-desc dialect). PURE. */
function compareJobRows(a: FleetJobRow, b: FleetJobRow): number {
  const av = a.remoteBytes;
  const bv = b.remoteBytes;
  if (av == null && bv == null) return a.jobName.localeCompare(b.jobName);
  if (av == null) return 1;
  if (bv == null) return -1;
  return bv - av || a.jobName.localeCompare(b.jobName);
}

/** The ledger minus its identity stamps — the pure core's honest return
 *  (the caller — the shell — owns projectId/generatedAt). */
export type FleetLedgerCore = Omit<FleetLedgerResponse, "projectId" | "generatedAt">;

/** The one aggregation — every mouth (route, dialog, a future agent tool)
 *  drinks this cup. PURE: plain rows in, ledger out.
 *
 * @param jobMetas the project's jobs (id, name, type, status)
 * @param remoteByJob jobId → the run ledger's remote info (the
 *   remoteInfoFor contract — null for jobs that never ran remote)
 * @param localByJob jobId → the mirror's own word (bytes + dir presence)
 * @param snapshot the cluster side: per connection, either live probe
 *   answers or the sidecar's last measurement (sizes keyed by jobId)
 * @param history (t1055) the memory: keyed by the SAME keys the snapshot
 *   uses (the connection id; an orphan bucket may use its `orphan:<name>`
 *   key) → the ring of past measurements, newest first. The core caps
 *   defensively — a ring that arrives longer than the cap leaves capped.
 * @param mirrorWalkSpoke (t1100) the local walk's spokenness — false when
 *   the walk failed, so the rows' mirror faces (totals, exists flags,
 *   the unmirrored count) ride UNVERIFIED and the mouths say so.
 */
export function aggregateFleetLedger(
  jobMetas: { id: string; name: string; type: string; status: string }[],
  remoteByJob: Map<string, { connectionId: string; connectionName: string; host: string; remoteWorkdir: string }>,
  localByJob: Map<string, { bytes: number; exists: boolean }>,
  snapshot: Map<
    string,
    { connectionId: string | null; connectionName: string; host: string | null; syncCeilingBytes: number | null; sizes: Record<string, number | null>; measuredAt: string | null }
  >,
  history?: Map<string, FleetHistoryPoint[]>,
  mirrorWalkSpoke = true
): FleetLedgerCore {
  // Bucket the remote jobs by connection key — the record's connectionId
  // when the ledger still serves it, else the record's own name (the
  // orphan bucket keyed by name so two vanished connections don't merge).
  const buckets = new Map<
    string,
    { connectionId: string | null; connectionName: string; host: string | null; syncCeilingBytes: number | null; jobs: FleetJobRow[]; sizes: Record<string, number | null>; measuredAt: string | null }
  >();
  for (const meta of jobMetas) {
    const remote = remoteByJob.get(meta.id);
    if (!remote) continue;
    const snap = snapshot.get(remote.connectionId);
    const key = snap ? remote.connectionId : `orphan:${remote.connectionName}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        connectionId: snap ? snap.connectionId : null,
        connectionName: snap ? snap.connectionName : remote.connectionName,
        host: snap ? snap.host : remote.host,
        syncCeilingBytes: snap ? snap.syncCeilingBytes : null,
        jobs: [],
        sizes: snap ? snap.sizes : {},
        measuredAt: snap ? snap.measuredAt : null,
      };
      buckets.set(key, bucket);
    }
    const local = localByJob.get(meta.id) ?? { bytes: 0, exists: false };
    bucket.jobs.push({
      jobId: meta.id,
      jobName: meta.name,
      type: meta.type,
      status: meta.status,
      remoteWorkdir: remote.remoteWorkdir,
      remoteBytes: bucket.sizes[meta.id] ?? null,
      localBytes: local.bytes,
      localExists: local.exists,
    });
  }

  const connections: FleetConnectionRow[] = [...buckets.entries()].map(([bucketKey, b]) => {
    b.jobs.sort(compareJobRows);
    let remoteBytesTotal = 0;
    let measured = 0;
    for (const j of b.jobs) {
      if (j.remoteBytes != null) {
        remoteBytesTotal += j.remoteBytes;
        measured += 1;
      }
    }
    return {
      connectionId: b.connectionId,
      connectionName: b.connectionName,
      host: b.host,
      jobs: b.jobs,
      // t1067 — NOTHING answered means the total is AIR, never a zero:
      // the honest null rides the source, so every mouth (the strips,
      // the KPI chip, the AI drill) speaks the unanswered state instead
      // of a fake "0 B" and a false down-delta against it.
      remoteBytesTotal: measured > 0 ? remoteBytesTotal : null,
      localBytesTotal: b.jobs.reduce((s, j) => s + j.localBytes, 0),
      syncCeilingBytes: b.syncCeilingBytes,
      measured,
      unmeasured: b.jobs.length - measured,
      measuredAt: b.measuredAt,
      reachable: measured > 0,
      mirrorWalkSpoke,
      history: (history?.get(bucketKey) ?? []).slice(0, FLEET_HISTORY_CAP),
    };
  });
  connections.sort((a, b) => (b.remoteBytesTotal ?? 0) - (a.remoteBytesTotal ?? 0) || a.connectionName.localeCompare(b.connectionName));

  const measuredAtAll = [...snapshot.values()].map((s) => s.measuredAt);
  const measuredAt = measuredAtAll.length > 0 ? measuredAtAll.sort().at(-1)! : null;
  const incomplete = connections.some((c) => c.unmeasured > 0 || c.measuredAt == null);

  return { connections, measuredAt, incomplete };
}

/** The IO shell the route drinks: join the DB's jobs, the run ledger's
 *  remote records, the walk's local bytes and (measure? live probes :
 *  the sidecar) into one fleet ledger. null = the project row is gone.
 *
 *  Local side: ALWAYS fresh (computeStorageReport's walk — the same well
 *  the storage map drinks; a jobId with no dir reads {0, false}).
 *  Cluster side: `measure` → live probes under the budget, sidecar
 *  rewritten; otherwise the sidecar (possibly empty — a ledger of
 *  unmeasured rows with measuredAt null, the honest "never measured"). */
export async function computeFleetLedger(
  projectId: string,
  opts: { measure?: boolean } = {}
): Promise<FleetLedgerResponse | null> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return null;

  const jobs = await db.job.findMany({
    where: { projectId },
    select: { id: true, name: true, type: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  const remoteByJob = new Map<string, { connectionId: string; connectionName: string; host: string; remoteWorkdir: string }>();
  for (const j of jobs) {
    const info = remoteInfoFor(j.id);
    if (info) {
      remoteByJob.set(j.id, {
        connectionId: info.connectionId,
        connectionName: info.connectionName,
        host: info.host,
        remoteWorkdir: info.remoteWorkdir,
      });
    }
  }

  // The mirror's own word — one walk, the storage map's cup. t1095 —
  // the walk's SPOKENNESS is remembered beside its rows: a failed walk
  // leaves localByJob empty AND walkSpoke false, so the SECOND CHANNEL
  // stamps null (the walk didn't speak) instead of a zero wearing the
  // sum's clothes.
  const localByJob = new Map<string, { bytes: number; exists: boolean }>();
  let mirrorWalkSpoke = false;
  if (remoteByJob.size > 0) {
    const report = await computeStorageReport(projectId).catch(() => null);
    if (report) mirrorWalkSpoke = true;
    const rows: StorageJobRow[] = report?.jobs ?? [];
    for (const row of rows) {
      if (row.jobId) localByJob.set(row.jobId, { bytes: row.bytes, exists: row.exists });
    }
  }

  // The cluster side — keyed by the connection ids the runs actually rode
  // (a sidecar row for a connection this project never used must not
  // speak here). EVERY needed connection enters the snapshot with its
  // live metadata (name/host/ceiling are local reads, always fresh);
  // the SIZES are what varies: measure → live probes under the budget
  // (sidecar rewritten), otherwise the sidecar's last measurement, and
  // a never-measured connection wears sizes {} with a null stamp — the
  // honest "never measured", never a fake zero.
  const neededConnIds = new Set<string>();
  for (const r of remoteByJob.values()) neededConnIds.add(r.connectionId);
  const sidecar = readSidecar();
  const prevByConn = new Map(
    (sidecar.projects?.[projectId]?.connections ?? []).map((c) => [c.connectionId ?? c.connectionName, c])
  );
  const snapshot = new Map<string, { connectionId: string | null; connectionName: string; host: string | null; syncCeilingBytes: number | null; sizes: Record<string, number | null>; mirrorBytesTotal?: number | null; measuredAt: string | null }>();
  for (const connId of neededConnIds) {
    const conn = getConnection(connId);
    const prev = prevByConn.get(connId);
    const mine = jobs.filter((j) => remoteByJob.get(j.id)?.connectionId === connId);
    const nameFallback =
      conn?.name ??
      prev?.connectionName ??
      (mine.length > 0 ? (remoteByJob.get(mine[0].id)?.connectionName ?? "unknown") : "unknown");
    snapshot.set(connId, {
      connectionId: conn ? conn.id : null,
      connectionName: nameFallback,
      host: conn ? conn.host : null,
      syncCeilingBytes: conn ? conn.maxTotalMb * 1024 * 1024 : null,
      sizes: {},
      measuredAt: null,
      ...((connId === prev?.connectionId || (!conn && prev)) ? { sizes: prev.sizes, measuredAt: prev.measuredAt, mirrorBytesTotal: prev.mirrorBytesTotal } : {}),
    });
  }

  // The memory (t1055) — the sidecar's rings, keyed by connection key
  // (the id when alive, the name for the orphan ride). The core's cup is
  // keyed by the SNAPSHOT's keys (the connIds), so the seed walks the
  // snapshot and tries both keys — an orphan's ring was written under its
  // name the day its connection died, and the memory must not forget it.
  const historyRec: Record<string, FleetHistoryPoint[]> =
    sidecar.projects?.[projectId]?.history ?? {};
  const historyForCore = new Map<string, FleetHistoryPoint[]>();
  for (const [connId, snapRow] of snapshot) {
    const ring = historyRec[connId] ?? historyRec[snapRow.connectionName] ?? [];
    historyForCore.set(connId, ring);
  }
  if (opts.measure && neededConnIds.size > 0) {
    // Live probes, sequential, under one budget. Each answered workdir
    // lands in the new snapshot; unanswered stay null (→ honest holes).
    const started = Date.now();
    const fresh: SidecarConnection[] = [];
    for (const [connId, base] of snapshot) {
      const conn = getConnection(connId);
      const sizes: Record<string, number | null> = {};
      const mine = jobs.filter((j) => remoteByJob.get(j.id)?.connectionId === connId);
      for (const j of mine) {
        const workdir = remoteByJob.get(j.id)!.remoteWorkdir;
        let bytes: number | null = null;
        if (conn && Date.now() - started < PROBE_BUDGET_MS) {
          bytes = await remoteWorkdirBytes(conn, workdir);
        }
        sizes[j.id] = bytes;
      }
      // The ring remembers the OUTGOING measurement (the past): the row's
      // own numbers are about to become the present, so the push happens
      // BEFORE the fresh sizes replace them. A never-measured outgoing
      // state pushes nothing — the trend begins with the fresh numbers.
      // t1095 — the outgoing point's shape (including the SECOND
      // CHANNEL's ride or absence) is fleetHistoryOutgoingPoint's own
      // law now — one home, the unit band pins it, the loop pours.
      const ringKey = base.connectionId ?? base.connectionName;
      const outgoing = fleetHistoryOutgoingPoint({
        measuredAt: base.measuredAt,
        bytes: totalMeasuredBytes(base.sizes),
        mirrorBytesTotal: base.mirrorBytesTotal,
      });
      const seed = historyForCore.get(connId) ?? [];
      const nextRing = (outgoing ? [outgoing, ...seed] : seed).slice(0, FLEET_HISTORY_CAP);
      historyRec[ringKey] = nextRing;
      historyForCore.set(connId, nextRing);
      const entry: SidecarConnection = {
        connectionId: base.connectionId,
        connectionName: base.connectionName,
        host: base.host,
        syncCeilingBytes: base.syncCeilingBytes,
        sizes,
        mirrorBytesTotal: mirrorBytesTotalFor(
          mine.map((j) => j.id),
          localByJob,
          mirrorWalkSpoke
        ),
        measuredAt: new Date().toISOString(),
      };
      fresh.push(entry);
      snapshot.set(connId, { ...base, sizes, mirrorBytesTotal: entry.mirrorBytesTotal, measuredAt: entry.measuredAt });
    }
    const nextAll: SidecarShape = {
      projects: {
        ...(sidecar.projects ?? {}),
        [projectId]: {
          connections: fresh,
          measuredAt: new Date().toISOString(),
          history: historyRec,
        },
      },
    };
    writeSidecar(nextAll);
  }

  const ledger = aggregateFleetLedger(jobs, remoteByJob, localByJob, snapshot, historyForCore, mirrorWalkSpoke);
  return { ...ledger, projectId, generatedAt: new Date().toISOString() };
}
