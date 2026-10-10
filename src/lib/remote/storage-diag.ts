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
import { wordsAreZero, wordsAreHealthy, type HeaderWords } from "./cache-witness";
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
  /**
   * t384 — THE SUSPECT FILE itself (cluster-absolute path of a round that
   * read as a right-sized zero-header through the login node). The probe
   * legs below (urandom write/read) can NEVER exhibit the disease: a
   * probe is written once, closed, then read — the class stacks were read
   * WHILE being written, which is the difference. With a suspect, the
   * diagnostic witnesses the SAME file from three seats: the login
   * node's buffered view (what relion_display/md5sum see), the login
   * node's O_DIRECT view (its wire to the storage, cache bypassed), and
   * a compute node's own read (the sbatch leg) — and DROPS the login
   * node's cached pages for it (posix_fadvise) between the first two, so
   * the illusion is not just named, it is healed.
   */
  suspect?: string;
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
  // experiment without a baseline. t384: a suspect file rides the SAME
  // round — its buffered header, its O_DIRECT header, the fadvise drop,
  // the post-drop buffered header, and the post-drop md5 (the bytes
  // relion_display would read after the heal).
  const suspectArgs: string[] = [];
  if (opts.suspect) {
    const S = shQuote(opts.suspect);
    const odSuspect = `od -An -tu4 -j0 -N12 ${S} 2>/dev/null | tr -s ' \\n' ' '`;
    const odSuspectDirect = `dd if=${S} iflag=direct bs=4096 count=1 2>/dev/null | od -An -tu4 -j0 -N12 2>/dev/null | tr -s ' \\n' ' '`;
    suspectArgs.push(
      `echo "CF_SUSPECT_BEGIN"`,
      `__sb="$(${odSuspect})"`,
      `__sd="$(${odSuspectDirect})"`,
      `__sf="N"`,
      `if [ -n "$__sd" ] && [ "$__sd" != "$__sb" ]; then`,
      `  if python3 -c 'import os,sys; os.posix_fadvise(os.open(sys.argv[1], os.O_RDONLY), 0, 0, os.POSIX_FADV_DONTNEED)' ${S} >/dev/null 2>&1; then __sf="Y"; fi`,
      `fi`,
      `__sa="$(${odSuspect})"`,
      `printf 'CF_SUSPECT_B=%s\n' "$__sb"`,
      `printf 'CF_SUSPECT_D=%s\n' "$__sd"`,
      `printf 'CF_SUSPECT_FADV=%s\n' "$__sf"`,
      `printf 'CF_SUSPECT_A=%s\n' "$__sa"`,
      `if [ -f ${S} ]; then md5sum ${S} 2>/dev/null | awk '{print "CF_SUSPECT_LOGIN_MD5 " $1}'; fi`,
      `stat -c 'CF_SUSPECT_SIZE %s' ${S} 2>/dev/null || true`,
      `echo "CF_SUSPECT_END"`
    );
  }
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
      ...suspectArgs,
      `echo "CF_DF_BEGIN"`,
      `df -h ${shQuote(root)} 2>/dev/null`,
      `echo "CF_DF_END"`,
      `echo "CF_QUOTA_BEGIN"`,
      `( quota -s 2>/dev/null || lfs quota -u "$(whoami)" ${shQuote(root)} 2>/dev/null || true )`,
      `echo "CF_QUOTA_END"`,
    ].join("\n"),
    { timeoutMs: 45_000 }
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
  // t384 — parse the suspect's witness block (absent when no suspect rode
  // along: the plain probe world of t369/t370).
  const suspectText = loginText.split("CF_SUSPECT_BEGIN")[1]?.split("CF_SUSPECT_END")[0] ?? "";
  const parseWords = (tag: string): HeaderWords | null => {
    const m = new RegExp(`^CF_SUSPECT_${tag}=(.*)$`, "m").exec(suspectText);
    if (!m) return null;
    const parts = m[1].trim().split(/\s+/).filter((t) => /^\d+$/.test(t));
    if (parts.length < 3) return null;
    return { nx: Number(parts[0]), ny: Number(parts[1]), nz: Number(parts[2]) };
  };
  const suspectBuffered = parseWords("B");
  const suspectDirect = parseWords("D");
  const suspectAfter = parseWords("A");
  const suspectFadvise = /CF_SUSPECT_FADV=Y/m.test(suspectText);
  const suspectLoginMd5 = /CF_SUSPECT_LOGIN_MD5 ([0-9a-f]{32})/i.exec(suspectText)?.[1] ?? null;
  const suspectSize = Number(/CF_SUSPECT_SIZE (\d+)/.exec(suspectText)?.[1] ?? NaN);
  if (opts.suspect && suspectBuffered == null && suspectDirect == null) {
    lines.unshift(`suspect ${opts.suspect}: the login leg could not read its header at all (absent or unreadable)`);
  } else if (opts.suspect) {
    const fmt = (w: HeaderWords | null) => (w == null ? "no-words" : `nx=${w.nx} ny=${w.ny} nz=${w.nz}`);
    lines.unshift(
      `suspect ${opts.suspect}: buffered ${fmt(suspectBuffered)} · direct ${fmt(suspectDirect)}${
        suspectFadvise ? ` · post-drop buffered ${fmt(suspectAfter)}` : ""
      }${suspectLoginMd5 ? ` · login md5 ${suspectLoginMd5.slice(0, 8)}${Number.isFinite(suspectSize) ? ` (${suspectSize} bytes)` : ""}` : ""}`
    );
  }
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
    ...(opts.suspect
      ? ["# t384 — and witnesses THE SUSPECT FILE itself: its header words + md5", "# from THIS compute node's own read of the same bytes."]
      : []),
    "#SBATCH --job-name=cf-stordiag",
    "#SBATCH --time=2:00",
    "#SBATCH --ntasks=1",
    "#SBATCH --cpus-per-task=1",
    ...(conn.slurmPartition ? [`#SBATCH --partition=${conn.slurmPartition}`] : []),
    `#SBATCH --output=${computeOut}`,
    `head -c ${COMPUTE_PROBE_BYTES} /dev/urandom > ${shQuote(computeBin)} && sync && md5sum ${shQuote(computeBin)} | awk '{print "CF_COMPUTE_MD5 " $1}'`,
    ...(opts.suspect
      ? [
          `if [ -f ${shQuote(opts.suspect)} ]; then`,
          `  od -An -tu4 -j0 -N12 ${shQuote(opts.suspect)} 2>/dev/null | tr -s ' \\n' ' ' | awk '{print "CF_COMPUTE_SUSPECT " $1, $2, $3}'`,
          `  md5sum ${shQuote(opts.suspect)} | awk '{print "CF_COMPUTE_SUSPECT_MD5 " $1}'`,
          `else`,
          `  echo "CF_COMPUTE_SUSPECT ABSENT"`,
          `fi`,
        ]
      : []),
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
  let computeSuspectText = "";
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
    if (/CF_COMPUTE_SUSPECT /.test(pollText)) computeSuspectText = pollText;
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
  // t384 — THE SUSPECT FILE's layered verdict (when a zero-header round was
  // handed in). The three seats, in evidentiary order:
  //   · login BUFFERED  — what relion_display / md5sum / a plain cat see;
  //   · login DIRECT   — the same node's O_DIRECT read: its own wire to
  //     the storage, page cache bypassed;
  //   · COMPUTE node   — the sbatch leg's read of the very same file from
  //     where the RELION runs actually live.
  // The layers name themselves:
  //   LOGIN-NODE CACHE ILLUSION — buffered zero, direct healthy: the file
  //     is HEALTHY on the storage; the login node's page cache was serving
  //     stale zero pages (planted by a mid-write read — cryoflow's own
  //     pre-t384 sniffs were exactly that). The ladder DROPPED them
  //     (fadvise) before the login md5 below was taken, so that md5 is the
  //     HEALED view.
  //   LOGIN WIRE SEES ZEROS, COMPUTE VIEW HEALTHY — the file is healthy on
  //     the storage (a compute node reads it fine); the login node's own
  //     path to the storage is the broken layer. Run display/rendering from
  //     a compute node until the admin fixes it.
  //   ZERO ON THE STORAGE ITSELF — every observer that bypasses the login
  //     cache reads zeros: the t369 world (the run's writes never durably
  //     reached the storage), now convicted on THE FILE, not on a probe.
  if (opts.suspect && (suspectBuffered != null || suspectDirect != null)) {
    const computeSuspectWords = (() => {
      const m = /CF_COMPUTE_SUSPECT (\d+) (\d+) (\d+)/.exec(computeSuspectText);
      return m ? { nx: Number(m[1]), ny: Number(m[2]), nz: Number(m[3]) } : null;
    })();
    const computeSuspectMd5 = /CF_COMPUTE_SUSPECT_MD5 ([0-9a-f]{32})/i.exec(computeSuspectText)?.[1] ?? null;
    const computeSuspectAbsent = /CF_COMPUTE_SUSPECT ABSENT/.test(computeSuspectText);
    const computeRan = computeSuspectWords != null || computeSuspectMd5 != null || computeSuspectAbsent;
    const md5Agree =
      computeSuspectMd5 != null && suspectLoginMd5 != null && computeSuspectMd5 === suspectLoginMd5;
    if (wordsAreZero(suspectBuffered) && wordsAreHealthy(suspectDirect)) {
      result = {
        ok: true,
        verdict: `LOGIN-NODE CACHE ILLUSION (t384) — ${opts.suspect}: the login node's BUFFERED read showed a zero header while its own DIRECT read says the file is HEALTHY (buffered nx/ny/nz all 0 vs direct ${suspectDirect?.nx ?? "?"}/${suspectDirect?.ny ?? "?"}/${suspectDirect?.nz ?? "?"}). The login node's page cache was serving stale zero pages — planted by a read of the file while the cluster was still writing it (NFS's one-second mtime granularity can keep them "valid" forever; cryoflow's pre-t384 live sniffs were such readers, and nobody ever reads a manual run's files mid-write — the manual-vs-cryoflow difference).${
          suspectFadvise
            ? wordsAreHealthy(suspectAfter)
              ? ` The stale pages were DROPPED (posix_fadvise) and the login view now agrees${md5Agree ? " (login md5 matches the compute node's md5 of the same file)" : ""} — the file is fine, re-open the results.`
              : " The stale pages were dropped but the buffered view still disagrees — read the file from a compute node (srun) and report both md5s to the admin."
            : " python3 is missing on the login node, so the pages could not be dropped — read the file from a compute node (srun), or wait out the login node's cache; the file itself is fine."
        }${computeRan && wordsAreHealthy(computeSuspectWords) ? " The compute node's own read of this file confirms: healthy." : ""}`,
        lines,
      };
    } else if (
      wordsAreZero(suspectDirect) &&
      (wordsAreHealthy(computeSuspectWords) || md5Agree)
    ) {
      result = {
        ok: true,
        verdict: `LOGIN WIRE SEES ZEROS, COMPUTE VIEW HEALTHY (t384) — ${opts.suspect}: even the login node's DIRECT (cache-bypassing) read returns a zero header, but a COMPUTE node's read of the very same file is healthy. The file is healthy on the storage; the login node's own path to the storage is the broken layer. Display/rendering from the login node (and anything routed through it, including cryoflow's pulls) will keep seeing zeros until that path is fixed — hand the lines below (both md5s) to the cluster admin.`,
        lines,
      };
    } else if (wordsAreZero(suspectDirect) || wordsAreZero(suspectBuffered)) {
      result = {
        ok: true,
        verdict: `ZERO ON THE STORAGE ITSELF (t384) — ${opts.suspect}: ${
          wordsAreZero(suspectDirect)
            ? "the login node's DIRECT read returns a zero header"
            : "the login node's buffered read returns a zero header (its direct read was unavailable — the cluster's dd refuses O_DIRECT)"
        }${
          computeRan && (wordsAreZero(computeSuspectWords) || (computeSuspectMd5 != null && !md5Agree))
            ? ", and the compute node's own read of the same file agrees"
            : computeRan && computeSuspectAbsent
              ? " — and the compute node reports the file ABSENT (a wiped/moved workdir?)"
              : " (the compute node's own read could not be taken — this verdict rests on the login node's direct view)"
        }: this run's writes never durably reached the storage under ${root}. That is the t369 disease, now convicted on the file itself. Hand the lines below to the storage admin; re-dispatch the run after the path is fixed.`,
        lines,
      };
    } else {
      result = {
        ok: true,
        verdict: `SUSPECT FILE READS HEALTHY NOW (t384) — ${opts.suspect}: buffered ${suspectBuffered ? `${suspectBuffered.nx}/${suspectBuffered.ny}/${suspectBuffered.nz}` : "no-words"} · direct ${suspectDirect ? `${suspectDirect.nx}/${suspectDirect.ny}/${suspectDirect.nz}` : "no-words"}${md5Agree ? " · login and compute md5s match" : ""}. Whatever read as zero earlier was a transient view (a read racing the writer mid-write); no corruption remains — re-open the results.`,
        lines,
      };
    }
    persistVerdict(conn.id, result);
    return result;
  }
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
