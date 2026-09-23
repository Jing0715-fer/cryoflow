/**
 * CryoFlow — the AUTOMATED storage diagnostic (t370, SERVER ONLY).
 *
 * The t369 session proved right-sized ZERO-HEADER class stacks (MRC nz=0,
 * relion_display "exceeds stack size 0") but could only diagnose them
 * AFTER the run, with a MANUAL 60-second experiment: write bytes from a
 * compute node, read them back from the login node, compare. The field
 * world (gpu05, /data03 network storage) made that experiment the
 * decisive one — a healthy RELION writer never leaves a zero header, so
 * the loss lives between the compute node's writes and the storage.
 *
 * This module IS that experiment, automated end to end:
 *
 *   · LOGIN leg (one SSH exec): 2 MB of /dev/urandom written under
 *     <root>/.cryoflow-diag/, md5-summed in place, plus `df -h <root>`
 *     and the best-effort quota read — the context lines a storage
 *     admin asks for first.
 *   · COMPUTE leg (one tiny sbatch, --time=2:00, 1 task, no GPU): 8 MB
 *     of urandom + `sync` + md5sum, echoed into the job's own output
 *     file. This is the leg the disease lives on — bytes written where
 *     the RELION runs actually run.
 *   · READBACK leg (one SSH exec): the login node md5-sums THE SAME
 *     file; the two digests decide. Probe files are cleaned up
 *     best-effort afterwards (the experiment leaves only its verdict).
 *
 * Verdicts speak the project's receipt dialect:
 *
 *   COMPUTE→STORAGE WRITE LOST — … (t369/t370)   bytes never durably
 *                                                reached the storage
 *   STORAGE WRITE PATH HEALTHY — …               identical digests; the
 *                                                mystery is NOT the storage
 *
 * Resilient BY CONTRACT: the function NEVER throws — every failure
 * (unreachable cluster, refused sbatch, a 3-minute queue wait, no Slurm
 * on the connection) degrades to { ok: false, verdict: "storage
 * diagnostic could not run (<reason>)" } so the sweep can fire it
 * fire-and-forget and the route can answer 200 with the honest word.
 *
 * The last verdict per connection persists in a small JSON SIDECAR
 * (data/remote-storage-diag.json) rather than a typed field on the
 * connection record — connections.ts's sanitizeConnection would silently
 * drop an unknown field on the next PATCH, and the verdict is a
 * diagnostic artifact, not connection configuration.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/paths";
import { getConnection } from "./connections";
import { exec, loginShellScript, remoteUpload, shQuote } from "./ssh";
import type { RemoteConnection } from "./types";

const DIAG_DIR_NAME = ".cryoflow-diag";
/** the login leg's probe size — small enough for any filesystem, big enough to notice truncation */
const LOGIN_PROBE_BYTES = 2 * 1024 * 1024;
/** the compute leg's probe size — the same order as one class-average slice write burst */
const COMPUTE_PROBE_BYTES = 8 * 1024 * 1024;
/** how long the compute leg may sit in the queue before the diagnostic gives up honestly */
const COMPUTE_WAIT_MS = 3 * 60_000;
const COMPUTE_POLL_MS = 10_000;

export interface StorageDiagnosticResult {
  /** true = the experiment RAN to a decisive verdict (healthy or lost); false = it could not run */
  ok: boolean;
  /** the one-line verdict, receipt dialect — safe for the log tail and the job result */
  verdict: string;
  /** the evidence lines (df/quota/md5) to hand a storage admin */
  lines: string[];
}

/** the sidecar record — the last verdict per connection */
interface StoredDiag {
  verdict: string;
  ok: boolean;
  at: number;
}

const SIDECAR_FILE = path.join(DATA_DIR, "remote-storage-diag.json");

function readSidecar(): Record<string, StoredDiag> {
  try {
    if (existsSync(SIDECAR_FILE)) {
      const parsed = JSON.parse(readFileSync(SIDECAR_FILE, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, StoredDiag>;
      }
    }
  } catch {
    /* corrupt sidecar → start empty */
  }
  return {};
}

function persistVerdict(connectionId: string, r: StorageDiagnosticResult): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const all = readSidecar();
    all[connectionId] = { verdict: r.verdict, ok: r.ok, at: Date.now() };
    writeFileSync(SIDECAR_FILE, JSON.stringify(all, null, 2), { mode: 0o600 });
  } catch {
    /* the sidecar is a courtesy, never a verdict of its own */
  }
}

/** The last stored verdict for a connection (null = never ran). */
export function lastStorageDiagnostic(connectionId: string): StoredDiag | null {
  return readSidecar()[connectionId] ?? null;
}

/** expand a `~`-prefixed root on the cluster itself (login shell, $HOME). */
async function resolveDiagRoot(conn: RemoteConnection, projectRoot?: string): Promise<string | { err: string }> {
  if (projectRoot && projectRoot.startsWith("/")) return projectRoot;
  const raw = (conn.remoteRoot || "~/cryoflow").trim();
  if (raw.startsWith("~")) {
    const expanded = raw.replace(/^~(?=\/|$)/, "$HOME");
    try {
      const r = await exec(conn, loginShellScript(`printf '%s\\n' "${expanded}"`), {
        timeoutMs: 15_000,
      });
      const home = (r.stdout ?? "").trim().split(/\r?\n/).pop() ?? "";
      if (r.error || !home.startsWith("/")) {
        return { err: `could not resolve the cluster storage root "${raw}" (${r.error ?? (home.slice(0, 120) || "no answer")})` };
      }
      return home;
    } catch (e) {
      return { err: `could not resolve the cluster storage root "${raw}" (${e instanceof Error ? e.message : String(e)})` };
    }
  }
  return raw.startsWith("/") ? raw : { err: `the connection's remote root "${raw}" is not an absolute path` };
}

const couldNotRun = (reason: string, lines: string[] = []): StorageDiagnosticResult => ({
  ok: false,
  verdict: `storage diagnostic could not run (${reason})`,
  lines,
});

/**
 * Run the decisive experiment. See the module header — never throws.
 */
export async function runStorageDiagnostic(opts: {
  connectionId: string;
  /** the storage the suspect run wrote to (the run's project root); defaults to the connection's remoteRoot */
  projectRoot?: string;
}): Promise<StorageDiagnosticResult> {
  const conn = getConnection(opts.connectionId);
  if (!conn) {
    return couldNotRun("the cluster connection no longer exists — re-add it first");
  }
  const rootRes = await resolveDiagRoot(conn, opts.projectRoot);
  if (typeof rootRes === "object") {
    return couldNotRun(rootRes.err);
  }
  const root = rootRes.replace(/\/+$/, "");
  const diagDir = `${root}/${DIAG_DIR_NAME}`;
  const ts = Math.floor(Date.now() / 1000);
  const loginBin = `${diagDir}/login_${ts}.bin`;
  const computeBin = `${diagDir}/compute_${ts}.bin`;
  const computeOut = `${diagDir}/compute_${ts}.out`;
  const sbatchPath = `${diagDir}/diag_${ts}.sbatch`;
  const lines: string[] = [];

  // ---- the LOGIN leg --------------------------------------------------
  // 2 MB of urandom + md5 in place + df/quota context, all in ONE exec.
  // A login leg that cannot write says so immediately — there is no
  // experiment without a baseline.
  const loginLeg = await exec(
    conn,
    [
      `if ! mkdir -p ${shQuote(diagDir)} 2>/dev/null; then echo "CF_DIAG: NOROOT"; exit 0; fi`,
      `F=${shQuote(loginBin)}`,
      `if head -c ${LOGIN_PROBE_BYTES} /dev/urandom > "$F" 2>/dev/null && [ -s "$F" ]; then`,
      `  md5sum "$F" | awk '{print "CF_LOGIN_MD5 " $1}'`,
      `else`,
      `  echo "CF_DIAG: LOGIN_WRITE_FAILED"`,
      `fi`,
      `echo "CF_DF_BEGIN"`,
      `df -h ${shQuote(root)} 2>/dev/null`,
      `echo "CF_DF_END"`,
      `echo "CF_QUOTA_BEGIN"`,
      `( quota -s 2>/dev/null || lfs quota -u "$(whoami)" ${shQuote(root)} 2>/dev/null || true )`,
      `echo "CF_QUOTA_END"`,
    ].join("\n"),
    { timeoutMs: 30_000 }
  );
  if (loginLeg.error) {
    return couldNotRun(`SSH to ${conn.host} failed: ${loginLeg.error}`);
  }
  const loginText = loginLeg.stdout ?? "";
  const dfBlock = /^\s*CF_DF_BEGIN\s*\n([\s\S]*?)\n\s*CF_DF_END/m.exec(loginText)?.[1]?.trim() ?? "";
  const quotaBlock = /^\s*CF_QUOTA_BEGIN\s*\n([\s\S]*?)\n?\s*CF_QUOTA_END/m.exec(loginText)?.[1]?.trim() ?? "";
  if (dfBlock) lines.push(...dfBlock.split("\n").map((l) => l.trim()).filter(Boolean));
  if (quotaBlock) lines.push(...quotaBlock.split("\n").map((l) => l.trim()).filter(Boolean));
  if (/CF_DIAG: NOROOT/.test(loginText)) {
    const r = couldNotRun(`could not create ${diagDir} on the login node (permissions or a read-only mount)`, lines);
    persistVerdict(conn.id, r);
    return r;
  }
  if (/CF_DIAG: LOGIN_WRITE_FAILED/.test(loginText)) {
    const r = couldNotRun(`the login node itself could not write 2 MB under ${root} — the storage is refusing writes outright; hand the lines below to the storage admin`, lines);
    persistVerdict(conn.id, r);
    return r;
  }
  const loginMd5 = /CF_LOGIN_MD5 ([0-9a-f]{32})/i.exec(loginText)?.[1] ?? null;
  if (!loginMd5) {
    const r = couldNotRun("the login leg wrote its probe but the md5 never came back", lines);
    persistVerdict(conn.id, r);
    return r;
  }
  lines.unshift(`login write: 2 MB → ${loginBin} md5 ${loginMd5}`);

  // ---- the COMPUTE leg (sbatch; the leg the disease lives on) ---------
  if (!conn.useSlurm) {
    const r = couldNotRun(
      "the decisive leg writes from a COMPUTE node, and this connection is not Slurm-enabled — enable Slurm on the connection (or run the manual test from a compute node) to convict or clear the storage",
      lines
    );
    persistVerdict(conn.id, r);
    return r;
  }
  // minimal CPU allocation: --time=2:00, 1 task, no --gres (a probe must
  // never queue behind GPUs). The partition is the connection's own when
  // it has one — the same world the RELION jobs land in.
  const sbatchLines = [
    "#!/bin/bash",
    "# CryoFlow storage diagnostic (t370) — writes 8 MB from a compute node,",
    "# syncs, and echoes the md5; the login node then reads the SAME file back.",
    "#SBATCH --job-name=cf-stordiag",
    "#SBATCH --time=2:00",
    "#SBATCH --ntasks=1",
    "#SBATCH --cpus-per-task=1",
    ...(conn.slurmPartition ? [`#SBATCH --partition=${conn.slurmPartition}`] : []),
    `#SBATCH --output=${computeOut}`,
    `head -c ${COMPUTE_PROBE_BYTES} /dev/urandom > ${shQuote(computeBin)} && sync && md5sum ${shQuote(computeBin)} | awk '{print "CF_COMPUTE_MD5 " $1}'`,
  ];
  const upOk = await remoteUpload(conn, sbatchLines.join("\n") + "\n", sbatchPath);
  if (!upOk) {
    const r = couldNotRun(`could not upload the probe script to ${sbatchPath}`, lines);
    persistVerdict(conn.id, r);
    return r;
  }
  const sub = await exec(conn, `sbatch ${shQuote(sbatchPath)}`, { timeoutMs: 30_000 });
  const jobId = /Submitted batch job (\d+)/.exec(sub.stdout)?.[1] ?? null;
  if (!jobId) {
    const why =
      (sub.stderr || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 2).join(" · ") ||
      sub.error ||
      `ssh exit ${sub.code}`;
    const r = couldNotRun(`sbatch refused the probe job: ${why.slice(0, 200)}`, lines);
    persistVerdict(conn.id, r);
    return r;
  }
  lines.unshift(`compute write: sbatch ${jobId} → 8 MB + sync → ${computeBin}`);

  // poll the scheduler + the job's own output until the md5 line lands
  // or the ledger says terminal (accounting-off clusters rely on the
  // output file; a full queue earns the honest give-up below)
  let computeMd5: string | null = null;
  let ledgerTerminal = false;
  const deadline = Date.now() + COMPUTE_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, COMPUTE_POLL_MS));
    const poll = await exec(
      conn,
      [
        `sacct -j ${shQuote(jobId)} -X -n -o State 2>/dev/null`,
        `echo "CF_POLL_OUT"`,
        `cat ${shQuote(computeOut)} 2>/dev/null`,
      ].join("\n"),
      { timeoutMs: 15_000 }
    );
    if (poll.error) continue; // a wire blink never ends the wait early
    const pollText = poll.stdout ?? "";
    computeMd5 = /CF_COMPUTE_MD5 ([0-9a-f]{32})/i.exec(pollText)?.[1] ?? computeMd5;
    const stateWord = pollText.split("CF_POLL_OUT")[0].trim().split(/\s+/)[0] ?? "";
    if (/^(COMPLETED|FAILED|CANCELLED|TIMEOUT|NODE_FAIL|OUT_OF_MEMORY|DEADLINE|PREEMPTED)/i.test(stateWord)) {
      ledgerTerminal = true;
      if (computeMd5) break;
      // terminal without the md5 line: give the output file one last
      // grace beat, then fall through to the readback's own honesty
      if (/FAILED|CANCELLED|TIMEOUT|NODE_FAIL|OUT_OF_MEMORY/i.test(stateWord)) {
        const r = couldNotRun(
          `the probe job ended ${stateWord} before writing its 8 MB — the node itself is unhealthy (state ${stateWord}, job ${jobId}); hand the lines below to the cluster admin`,
          lines
        );
        await cleanupProbes(conn, [loginBin, computeBin, computeOut, sbatchPath]);
        persistVerdict(conn.id, r);
        return r;
      }
      break;
    }
  }

  // ---- the READBACK leg (login node reads THE SAME bytes) -------------
  const readback = await exec(
    conn,
    [
      `if [ -f ${shQuote(computeBin)} ]; then`,
      `  stat -c '%s' ${shQuote(computeBin)} 2>/dev/null`,
      `  md5sum ${shQuote(computeBin)} | awk '{print "CF_READBACK_MD5 " $1}'`,
      `else`,
      `  echo "CF_NOFILE"`,
      `fi`,
    ].join("\n"),
    { timeoutMs: 30_000 }
  );
  const readbackText = readback.stdout ?? "";
  const readbackMd5 = /CF_READBACK_MD5 ([0-9a-f]{32})/i.exec(readbackText)?.[1] ?? null;
  const readbackSize = Number(/^\s*(\d+)\s*$/m.exec(readbackText)?.[1] ?? NaN);
  const cleanup = await cleanupProbes(conn, [loginBin, computeBin, computeOut, sbatchPath]);
  if (!cleanup) lines.push("note: the probe files could not be removed — clean .cryoflow-diag/ by hand");

  // ---- the verdict -----------------------------------------------------
  let result: StorageDiagnosticResult;
  if (/CF_NOFILE/.test(readbackText)) {
    result = {
      ok: true,
      verdict: `COMPUTE→STORAGE WRITE LOST — the compute node's 8 MB (sbatch ${jobId}) is MISSING from the login node's view of ${root}: bytes written on the compute node did not durably reach the storage under ${root}; this is the zero-header disease's cause (t369/t370). Hand the lines below to the storage admin.`,
      lines,
    };
  } else if (readbackMd5 == null || !Number.isFinite(readbackSize)) {
    result = couldNotRun(
      computeMd5
        ? "the compute leg wrote its md5 but the login readback could not stat/md5 the same file"
        : `the probe job never reported within ${Math.round(COMPUTE_WAIT_MS / 60000)} minutes (queue full or accounting silent${ledgerTerminal ? ", ledger says terminal" : ""}) — try again when the cluster is quieter`,
      lines
    );
  } else if (readbackSize === 0) {
    result = {
      ok: true,
      verdict: `COMPUTE→STORAGE WRITE LOST — the file the compute node wrote under ${root} reads back ZERO LENGTH from the login node: bytes written on the compute node did not durably reach the storage under ${root}; this is the zero-header disease's cause (t369/t370). Hand the lines below to the storage admin.`,
      lines,
    };
  } else if (computeMd5 != null && readbackMd5 !== computeMd5) {
    result = {
      ok: true,
      verdict: `COMPUTE→STORAGE WRITE LOST — md5 mismatch: the compute node computed ${computeMd5}, the login node reads back ${readbackMd5} (${readbackSize} bytes on disk): bytes written on the compute node did not durably reach the storage under ${root}; this is the zero-header disease's cause (t369/t370). Hand the lines below to the storage admin.`,
      lines,
    };
  } else if (computeMd5 != null && readbackMd5 === computeMd5) {
    result = {
      ok: true,
      verdict: `STORAGE WRITE PATH HEALTHY — login and compute legs both read back identical bytes (${readbackMd5}, ${readbackSize} bytes); the zero-header mystery is NOT the storage and must be chased elsewhere.`,
      lines,
    };
  } else {
    // the compute md5 line never landed (output capture or accounting
    // gap) but the file DID come home — the size is the fallback witness
    result =
      readbackSize === COMPUTE_PROBE_BYTES
        ? {
            ok: true,
            verdict: `STORAGE WRITE PATH HEALTHY (by size) — the compute node's file reached the login node intact (${readbackSize} bytes; its md5 line never reached the job output, so the byte-for-byte comparison could not run); the write path under ${root} carried the full payload.`,
            lines,
          }
        : {
            ok: true,
            verdict: `COMPUTE→STORAGE WRITE LOST — the compute node's file reached the login node at ${readbackSize} bytes, not the ${COMPUTE_PROBE_BYTES} it wrote: bytes written on the compute node did not durably reach the storage under ${root}; this is the zero-header disease's cause (t369/t370). Hand the lines below to the storage admin.`,
            lines,
          };
  }
  persistVerdict(conn.id, result);
  return result;
}

/** best-effort probe cleanup — the experiment leaves only its verdict. */
async function cleanupProbes(conn: RemoteConnection, files: string[]): Promise<boolean> {
  try {
    const r = await exec(conn, `rm -f ${files.map((f) => shQuote(f)).join(" ")} 2>/dev/null; echo CF_CLEANED`, {
      timeoutMs: 15_000,
    });
    return !r.error && r.stdout.includes("CF_CLEANED");
  } catch {
    return false;
  }
}
