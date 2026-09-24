#!/usr/bin/env node
/**
 * CryoFlow — mock SSH cluster service (Task 2-b)
 *
 * Emulates an HPC cluster login node so the "remote RELION" feature can be
 * tested without a real cluster:
 *
 *   - SSH2 server on 0.0.0.0:3022 (RSA host key auto-generated on first run)
 *   - password auth only: user "cryo" / password "demo"
 *   - `exec` + `shell` channels, backed by a real /bin/bash
 *   - fake Lmod-style `module` tool at fs/opt/bin/module
 *     (relion/4.4.1, relion/5.0.1, relion/5.0-beta, cuda/*)
 *   - command PATH: fs/opt/bin (mock module system) + /home/z/relion-build/bin
 *     + /home/z/relion-build/deps/mpich/bin (the sandbox's real RELION build,
 *     when present) + /usr/bin + /bin; HOME = fs/home/cryo
 *   - cluster-absolute paths in commands (/projects/…, /home/cryo/…) are
 *     rewritten to land inside services/mock-cluster/fs/ — configure the app
 *     with remoteRoot=/projects/cryoflow
 *   - background jobs (`setsid bash -c … >log 2>err < /dev/null &`) survive
 *     channel close, like on a real login node
 *   - sftp is intentionally NOT supported (the subsystem request is refused
 *     automatically by ssh2 when no 'sftp' listener exists)
 *
 * Run:  bun run start   (or: bun run dev  for hot reload)
 */

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import ssh2 from "ssh2";

const { Server } = ssh2;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Fake cluster filesystem root. */
const FS_ROOT = join(__dirname, "fs");
const KEYS_DIR = join(__dirname, "keys");
const HOST_KEY_PATH = join(KEYS_DIR, "host_key_rsa");

const PORT = Number(process.env.MOCK_CLUSTER_PORT ?? 3022);
// 0.0.0.0 binds every interface (incl. 127.0.0.1).
const BIND_HOST = "0.0.0.0";

const AUTH_USER = "cryo";
const AUTH_PASSWORD = "demo";

/**
 * Auth dialect this login node speaks (t291):
 *   - "password"              — sshd default (`PasswordAuthentication yes`).
 *   - "keyboard-interactive"  — HPC hardened sshd (`PasswordAuthentication no` +
 *                               `KbdInteractiveAuthentication yes`): the password
 *                               METHOD is refused outright and the credential is
 *                               only accepted through a keyboard-interactive
 *                               round. MobaXterm/OpenSSH handle this transparently;
 *                               naive clients that only send the `password` method
 *                               die with "All configured authentication methods
 *                               failed" — the exact user report this mode reproduces.
 *   - "keyboard-interactive-2fa" — same, but the round asks TWO questions
 *                               (password + verification code). MobaXterm pops a
 *                               dialog and the user answers both; a client that
 *                               answers every prompt with the stored password
 *                               fails — and t291's error must NAME the cause.
 */
const RAW_AUTH_MODE = process.env.MOCK_AUTH_MODE ?? "password";
const AUTH_MODE = ["password", "keyboard-interactive", "keyboard-interactive-2fa"].includes(RAW_AUTH_MODE)
  ? RAW_AUTH_MODE
  : "password";
const AUTH_2FA_CODE = process.env.MOCK_2FA_CODE ?? "654321";

/**
 * PATH for every command spawned "on the cluster":
 *   /home/z/relion-build/bin         — the REAL RELION build of this sandbox
 *                                      (5.0.0, CPU + MPI; FIRST so the real
 *                                      binaries win over the python stubs —
 *                                      the stubs are the no-build fallback)
 *   /home/z/relion-build/deps/mpich/bin — its MPI runtime (mpirun + hydra)
 *   fs/opt/bin                       — mock module system + Slurm stubs +
 *                                      the relion_* python stubs (fallback
 *                                      when no real build exists)
 *   /usr/bin, /bin                   — coreutils, bash, setsid, …
 */
const MOCK_PATH = [
  "/home/z/relion-build/bin",
  "/home/z/relion-build/deps/mpich/bin",
  `${FS_ROOT}/opt/bin`,
  "/usr/bin",
  "/bin",
].join(":");

/** Grace period after process exit before closing the SSH channel anyway.
 * t298 — the grace is IDLE-aware AND the close is FLUSH-aware: a big pipe
 * (`cat 64MB` through the SSH channel) is still MOVING when the process exits,
 * and destroying it mid-drain silently truncates the transfer (the client sees
 * a short read with exit=0 — ten-run probe: 10/10 lost 1.6–48 MB). Two layers:
 * the close waits for ssh2's write CALLBACKS (pipe 'end' means HANDED TO the
 * channel, not FLUSHED to the socket), and the grace re-arms while the pipes
 * flow (data or drain events within the window) — only an IDLE window (the
 * stuck grandchild it was written for) fires it. The hard cap bounds a
 * forever-flowing pipe (tail -f). */
const DRAIN_GRACE_MS = 400;
const DRAIN_HARD_CAP_MS = 60_000;

const KNOWN_SIGNALS = new Set([
  "SIGABRT", "SIGALRM", "SIGFPE", "SIGHUP", "SIGILL", "SIGINT", "SIGKILL",
  "SIGPIPE", "SIGQUIT", "SIGSEGV", "SIGTERM", "SIGUSR1", "SIGUSR2",
  "SIGCONT", "SIGSTOP", "SIGTSTP", "SIGTTOU", "SIGTTIN",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`[mock-cluster] ${msg}`);
}

function commandEnv() {
  return {
    ...process.env, // inherit the rest
    HOME: `${FS_ROOT}/home/cryo`,
    PATH: MOCK_PATH,
    // t315 — stubs that AUDIT absolute star rows (relion_refine's merge
    // audit) resolve cluster-absolute candidates through the mock's fs
    // root: a staged star's /projects/… or /data2/… rows point at the
    // MOCK's mounts, which live under FS_ROOT on the host.
    CRYOFLOW_MOCK_FS_ROOT: FS_ROOT,
    // `bash -l` sources /etc/profile which RESETS PATH; fs/home/cryo/.bash_profile
    // re-exports it from this variable (the app runs `bash -lc '…'`).
    CRYOFLOW_MOCK_PATH: MOCK_PATH,
  };
}

/**
 * Rewrite cluster-absolute paths in a command string so they land inside the
 * mock filesystem root:
 *   /projects/…  → <FS_ROOT>/projects/…
 *   /home/cryo/… → <FS_ROOT>/home/cryo/…
 *   /data2/…     → <FS_ROOT>/data2/…   (t300 — the user's cluster keeps its
 *                  Relion installs + movies under /data2; the remote-project
 *                  browser rehearses against that shape)
 * FS_ROOT itself contains neither prefix, so a single replaceAll pass is safe.
 * (Reverse translation is not needed.)
 */
function translateCommand(cmd) {
  // A command that already carries the REAL fs root (the app echoing back
  // an expanded $HOME — the mock's $HOME IS the sandbox-absolute path) must
  // not be translated AGAIN: its mount prefixes are already real paths, and
  // a second pass would double them.
  if (String(cmd).includes(FS_ROOT)) return String(cmd);
  let out = String(cmd)
    .replaceAll("/projects/", `${FS_ROOT}/projects/`)
    .replaceAll("/home/cryo/", `${FS_ROOT}/home/cryo/`)
    .replaceAll("/data2/", `${FS_ROOT}/data2/`);
  // BARE mount roots (a listing of /data2 itself — quoted, whitespace,
  // shell-metacharacter or line terminated) miss the trailing-slash forms
  // above. The lookahead never matches "/" so already-translated
  // <FS_ROOT>/data2/… tails are never re-matched.
  out = out.replace(/\/(data2|projects|home\/cryo)(?=['"\s;&|)]|$)/g, `${FS_ROOT}/$1`);
  // Uploaded SCRIPT files carry cluster-absolute paths in their CONTENT —
  // the command translation above can't see those. When the app uploads a
  // shell script (`head -c N > path.sh`), rewrite the content's paths too
  // so the script's own mkdir/cd/redirections land inside the mock fs root.
  const up = /head -c \d+ > (.+\.sh)['"]?\s*$/.exec(out);
  if (up) {
    const target = up[1].trim().replace(/^['"]|['"]$/g, "");
    out += ` && sed -i 's#/projects/#${FS_ROOT}/projects/#g; s#/home/cryo/#${FS_ROOT}/home/cryo/#g; s#/data2/#${FS_ROOT}/data2/#g' ${JSON.stringify(target)}`;
  }
  return out;
}

function normalizeSignal(name) {
  let sig = String(name ?? "").toUpperCase();
  if (!sig.startsWith("SIG")) sig = `SIG${sig}`;
  return KNOWN_SIGNALS.has(sig) ? sig : "SIGTERM";
}

// ---------------------------------------------------------------------------
// t344 — wipe-torture levers (~/.slurm, the same convention the nvidia-smi
// stub reads): the E2E suite reproduces the field report
// "could not clear the previous run's files … (batch 1: SSH failed (timeout
// after 30000ms))" without owning a slow login node.
//   rm-slow-ms       — every batched `rm -f --` sleeps N ms before running
//                      (a deletion that is SLOW, not broken — the listing
//                      answered fine moments earlier, exactly the field
//                      shape)
//   rm-channel-close — ONE-SHOT: the next batched rm's channel closes
//                      WITHOUT an exit, so the app sees the SSH-level
//                      "channel closed before exit" error and must retry
//                      on a fresh connection; the lever file consumes
//                      itself when it fires
// Both append a witness line to rm-lever.log so the suite can prove the
// torture actually fired (a green job alone could also mean the lever
// never matched anything).
// ---------------------------------------------------------------------------
const LEVER_DIR = join(FS_ROOT, "home/cryo/.slurm");

function leverLog(line) {
  try {
    appendFileSync(join(LEVER_DIR, "rm-lever.log"), `${Date.now()} ${line}\n`);
  } catch {
    /* best effort — the lever is the test's own instrument */
  }
}

/** Does this exec carry a BATCHED rm (deleteRemoteFiles's exact shape)?
 * Only that shape matches — the t318 fence rm (`rm -f <workdir>/.cf-exit …`)
 * and scratch rms inside sbatch scripts never carry the `--`. */
function isBatchedRm(cmd) {
  return cmd.includes("rm -f --");
}

// ---------------------------------------------------------------------------
// t345 — star-read torture levers (same ~/.slurm convention, same witness
// discipline as the rm pair above): the E2E suite reproduces the field
// report "particles star unreadable … and that read failed: timeout after
// 15000ms" without owning a slow login node.
//   cat-slow-ms        — "<ms> <substring>": a `cat` of the file whose path
//                        contains the substring sleeps N ms first (a read
//                        that is SLOW, not broken). The substring is
//                        MANDATORY — the poll's run.out tails are cats too
//                        and must never slow with it.
//   cat-channel-close  — ONE-SHOT: content is the substring; the next
//                        matching cat's channel closes WITHOUT an exit, so
//                        the app sees the SSH-level "channel closed before
//                        exit" error and must redial-retry (t345's ladder).
// Both append witness lines to cat-lever.log (a green job alone could
// also mean the lever never matched anything).
// ---------------------------------------------------------------------------
function catLeverLog(line) {
  try {
    appendFileSync(join(LEVER_DIR, "cat-lever.log"), `${Date.now()} ${line}\n`);
  } catch {
    /* best effort — the lever is the test's own instrument */
  }
}

/** The matching cat + the lever's own word, or null. */
function catLeverSpec(cmd, leverName) {
  if (!/^cat\s/.test(cmd)) return null;
  const lever = join(LEVER_DIR, leverName);
  if (!existsSync(lever)) return null;
  let content = "";
  try {
    content = readFileSync(lever, "utf8").trim();
  } catch {
    return null;
  }
  if (!content) return null;
  if (leverName === "cat-slow-ms") {
    const m = /^(\d+)\s+(\S+)$/.exec(content);
    if (!m || !cmd.includes(m[2])) return null;
    return { ms: Number(m[1]), substr: m[2] };
  }
  return cmd.includes(content) ? { substr: content } : null;
}

/** Inject the slowdown lever into a (translated) cat command. */
function applyCatSlowLever(cmd) {
  const spec = catLeverSpec(cmd, "cat-slow-ms");
  if (!spec) return cmd;
  catLeverLog(`slow ${spec.ms}ms on ${spec.substr}`);
  return cmd.replace(/^cat\s/, `sleep ${(spec.ms / 1000).toFixed(3)}; cat `);
}

/** Inject the slowdown lever into a (translated) command. */
function applyRmSlowLever(cmd) {
  if (!isBatchedRm(cmd)) return cmd;
  const lever = join(LEVER_DIR, "rm-slow-ms");
  if (!existsSync(lever)) return cmd;
  const ms = Number(readFileSync(lever, "utf8").trim()) || 0;
  if (ms <= 0) return cmd;
  leverLog(`slow ${ms}ms`);
  return cmd.replace("rm -f --", `sleep ${(ms / 1000).toFixed(3)}; rm -f --`);
}

// ---------------------------------------------------------------------------
// t346 — the GENERIC exec torture levers (same ~/.slurm convention): the
// star read is now a CENSUS awk pass (t346), not a cat — the cat pair
// above cannot reach it. These two match ANY exec whose command contains
// the lever's substring, so the suites can torture whatever wire traffic
// the CURRENT code speaks.
//   exec-slow-ms       — "<ms> <substring>": a matching exec sleeps N ms
//                        first (SLOW, not broken)
//   exec-channel-close — ONE-SHOT: content is the substring; the next
//                        matching exec's channel closes WITHOUT an exit
//                        (the SSH-level error the redial ladder exists for)
// Both append witness lines to exec-lever.log.
// ---------------------------------------------------------------------------
function execLeverLog(line) {
  try {
    appendFileSync(join(LEVER_DIR, "exec-lever.log"), `${Date.now()} ${line}\n`);
  } catch {
    /* best effort — the lever is the test's own instrument */
  }
}

function execLeverSpec(cmd, leverName) {
  const lever = join(LEVER_DIR, leverName);
  if (!existsSync(lever)) return null;
  let content = "";
  try {
    content = readFileSync(lever, "utf8").trim();
  } catch {
    return null;
  }
  if (!content) return null;
  if (leverName === "exec-slow-ms") {
    const m = /^(\d+)\s+(\S+)$/.exec(content);
    if (!m || !cmd.includes(m[2])) return null;
    return { ms: Number(m[1]), substr: m[2] };
  }
  return cmd.includes(content) ? { substr: content } : null;
}

function applyExecSlowLever(cmd) {
  const spec = execLeverSpec(cmd, "exec-slow-ms");
  if (!spec) return cmd;
  execLeverLog(`slow ${spec.ms}ms on ${spec.substr}`);
  return `sleep ${(spec.ms / 1000).toFixed(3)}; ${cmd}`;
}

// ---------------------------------------------------------------------------
// t358 — the LOSSY-WIRE lever (same ~/.slurm convention, same witness
// discipline): the field report showed a real cluster whose every 25–100 MB
// class-average pull was silently truncated (the t298 receive-side loss
// shape — size-dependent, exit=0). This lever reproduces that wire:
//   cat-drop-bytes — content "<substr> <minTransferBytes> <dropBytes>
//                     [maxFires]": any exec whose TRANSFER is at least
//                     minTransferBytes and whose command carries substr
//                     loses dropBytes from the middle of its stream. The
//                     two transfer shapes the app actually speaks both
//                     match:
//                       cat '<path>'                        (whole file)
//                       tail -c +OFF '<path>' | head -c N   (t358 chunk)
//                     maxFires (optional, default unlimited) bounds the
//                     total fires across ALL matching execs — the suite
//                     arms one-shot drops to prove the per-chunk retry
//                     recovers. Fires are counted in a sidecar file; every
//                     fire logs a cat-lever.log witness line so a green
//                     pull can be PROVEN to have survived a drop (and not
//                     just never matched).
// ---------------------------------------------------------------------------
function catDropSpec(cmd) {
  const lever = join(LEVER_DIR, "cat-drop-bytes");
  if (!existsSync(lever)) return null;
  let content = "";
  try {
    content = readFileSync(lever, "utf8").trim();
  } catch {
    return null;
  }
  const m = /^(\S+)\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/.exec(content);
  if (!m) return null;
  const spec = {
    substr: m[1],
    minBytes: Number(m[2]),
    drop: Number(m[3]),
    maxFires: m[4] != null ? Number(m[4]) : 0, // 0 = unlimited
    lever,
  };
  if (!cmd.includes(spec.substr)) return null;
  return spec;
}

/** The transfer size the command would put on the wire, and the pieces
 * needed to rewrite it with a mid-stream drop. Only the two shapes the
 * app's download paths speak (whole-file cat, t358 chunk) are modeled. */
function catDropTransfer(cmd) {
  // whole file: cat '<path>'  (the t289/t298 lanes)
  let mm = /^cat\s+'([^']+)'\s*$/.exec(cmd) ?? /^cat\s+(\S+)\s*$/.exec(cmd);
  if (mm) {
    const path = mm[1];
    let size = 0;
    try {
      size = statSync(path).size;
    } catch {
      return null;
    }
    return { kind: "cat", path, size, want: size };
  }
  // t358 chunk: tail -c +OFF '<path>' | head -c N
  mm = /^tail -c \+(\d+)\s+'([^']+)'\s*\|\s*head -c (\d+)\s*$/.exec(cmd);
  if (mm) {
    const off = Number(mm[1]); // 1-based first byte
    const path = mm[2];
    const want = Number(mm[3]);
    let size = 0;
    try {
      size = statSync(path).size;
    } catch {
      return null;
    }
    const remaining = Math.max(0, size - (off - 1));
    return { kind: "chunk", path, size, want: Math.min(want, remaining), off };
  }
  return null;
}

function applyCatDropLever(cmd) {
  const spec = catDropSpec(cmd);
  if (!spec) return cmd;
  const t = catDropTransfer(cmd);
  if (!t || t.want < spec.minBytes) return cmd; // below the loss threshold — the wire is clean here
  // count fires first (maxFires bounds the TOTAL, across shapes)
  const countFile = `${spec.lever}.fires`;
  let fires = 0;
  try {
    fires = Number(readFileSync(countFile, "utf8").trim()) || 0;
  } catch {
    /* fresh */
  }
  if (spec.maxFires > 0 && fires >= spec.maxFires) return cmd;
  try {
    writeFileSync(countFile, String(fires + 1));
  } catch {
    /* best effort — the witness still tells the tale */
  }
  // deterministic mid-stream drop point: a third of the way in
  const at = Math.floor(t.want / 3);
  const drop = Math.min(spec.drop, t.want - at - 1);
  if (drop <= 0) return cmd;
  catLeverLog(
    `drop ${drop}B at ${at} (transfer ${t.want}B ≥ ${spec.minBytes}B) on ${spec.substr} — fire ${fires + 1}`
  );
  log(`exec: cat-drop-bytes lever fired — dropping ${drop}B of a ${t.want}B transfer (fire ${fires + 1})`);
  // bash group: head emits [0, at), tail then skips `drop` bytes of the
  // remaining stream and emits the rest — the pipeline still exits 0 with
  // a SHORT read, the t298 "silent truncation" shape exactly
  if (t.kind === "cat") {
    return `cat ${t.path} | { head -c ${at}; tail -c +${drop + 1}; }`;
  }
  return `tail -c +${t.off} ${t.path} | { head -c ${at}; tail -c +${drop + 1}; } | head -c ${t.want}`;
}

function safeWrite(writable, data) {
  try {
    writable?.write?.(data);
  } catch {
    /* channel may already be gone */
  }
}

/** Generate + persist the host key on first run, load it afterwards. */
function ensureHostKey() {
  if (existsSync(HOST_KEY_PATH)) return readFileSync(HOST_KEY_PATH, "utf8");
  mkdirSync(KEYS_DIR, { recursive: true });
  // ssh2 parses OpenSSH or traditional PEM keys — NOT PKCS#8 — so export
  // the private key as PKCS#1 ("-----BEGIN RSA PRIVATE KEY-----").
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  writeFileSync(HOST_KEY_PATH, privateKey, { mode: 0o600 });
  log(`generated new 2048-bit RSA host key at ${HOST_KEY_PATH}`);
  return privateKey;
}

// ---------------------------------------------------------------------------
// Command runner
// ---------------------------------------------------------------------------

/**
 * Spawn /bin/bash for one SSH channel and wire the streams together.
 *
 *   proc.stdout → channel stdout
 *   proc.stderr → channel stderr (extended data)
 *   channel input → proc.stdin (used by `shell`, harmless for `exec`)
 *
 * Lifecycle rules:
 *   - on process exit (and after output drained, or a short grace period if a
 *     grandchild holds the pipes) → stream.exit(code) + stream.close()
 *   - on client disconnect / channel close → SIGHUP the direct child only
 *     (like a real sshd). Backgrounded jobs (`setsid … &`, `nohup … &`)
 *     survive: they ignore SIGHUP or live in another session.
 *   - `detached: true` puts the direct child in its own session, so background
 *     grandchildren are never killed when the channel or the server goes away.
 *
 * @param {import("ssh2").Channel} stream
 * @param {string[]} args bash argv (["-c", cmd] for exec, ["-l"] for shell)
 * @param {{ onFinish?: () => void }} opts
 */
function runCommand(stream, args, { onFinish } = {}) {
  let proc;
  try {
    proc = spawn("/bin/bash", args, {
      cwd: FS_ROOT,
      env: commandEnv(),
      detached: true, // own session → backgrounded children survive
    });
  } catch (err) {
    safeWrite(stream.stderr, `mock-cluster: failed to spawn bash: ${err?.message ?? err}\n`);
    try { stream.exit(127); } catch { /* ignore */ }
    try { stream.close(); } catch { /* ignore */ }
    onFinish?.();
    return null;
  }

  let dead = false; // direct child exited/errored
  let finished = false; // channel already closed
  let exitCode = 0;
  let exitSignal = null;
  let outEnded = !proc.stdout;
  let errEnded = !proc.stderr;
  let graceTimer = null;
  let lastFlow = Date.now(); // t298 — the drain-aware grace's pulse
  let graceStart = 0;
  let pendingWrites = 0; // t298 — chunks handed to the channel, callbacks pending

  const clearGrace = () => {
    if (graceTimer) {
      clearTimeout(graceTimer);
      graceTimer = null;
    }
  };

  const cleanupPipes = () => {
    try { proc.stdout?.destroy(); } catch { /* ignore */ }
    try { proc.stderr?.destroy(); } catch { /* ignore */ }
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearGrace();
    try {
      if (exitSignal) stream.exit(exitSignal, false, `killed by ${exitSignal}`);
      else stream.exit(exitCode);
    } catch { /* ignore */ }
    try { stream.close(); } catch { /* ignore */ }
    cleanupPipes();
    onFinish?.();
  };

  const maybeFinish = () => {
    if (finished || !dead) return;
    if (outEnded && errEnded) {
      if (pendingWrites > 0) {
        // t298 — the readables are exhausted but the channel's write buffer
        // still holds chunks in flight (pipe 'end' means HANDED TO the ssh2
        // writable, not FLUSHED to the socket). Closing here destroyed the
        // tail of every big transfer. Wait for the write callbacks; the
        // drain-aware grace below bounds the wait.
        armGrace();
        return;
      }
      finish();
      return;
    }
    // Process exited but a pipe is still open — either output is still
    // draining or a backgrounded grandchild inherited the fd. Close after a
    // grace period either way (`setsid … >log 2>err &` redirects its stdio to
    // files, so this is only a safety net) — but t298: the grace is DRAIN-AWARE.
    // The timer re-arms while the flow pulses (proc stdout/stderr data, channel
    // drain) and only fires when NOTHING has moved for the whole window — plus
    // a hard cap for forever-flowers.
    armGrace();
  };

  const armGrace = () => {
    if (graceTimer) return;
    graceStart = Date.now();
    graceTimer = setTimeout(function check() {
      const now = Date.now();
      if (now - graceStart > DRAIN_HARD_CAP_MS) return finish();
      if (now - lastFlow < DRAIN_GRACE_MS) {
        graceTimer = setTimeout(check, DRAIN_GRACE_MS);
        return;
      }
      finish();
    }, DRAIN_GRACE_MS);
  };

  proc.on("error", (err) => {
    dead = true;
    exitCode = 127;
    exitSignal = null;
    safeWrite(stream.stderr, `mock-cluster: ${err?.message ?? err}\n`);
    maybeFinish();
  });

  proc.on("exit", (code, signal) => {
    dead = true;
    exitSignal = signal ?? null;
    exitCode = code ?? (signal ? 1 : 0);
    if (process.env.CF_MOCK_DEBUG) log(`exec-exit: code=${exitCode}`);
    maybeFinish();
  });

  // end:false — we close the channel ourselves (after exit status is known).
  // t298 — NOT a bare pipe: a pipe hands chunks to stream.write() and treats
  // them as done, but ssh2's channel buffers them (crypto + socket) — a 64 MB
  // cat's 'end' fired with megabytes still unflushed, and the close then ate
  // them. Manual pump with write CALLBACKS: a chunk counts as delivered only
  // when its callback fires; backpressure pauses the readable until drain.
  try {
    if (proc.stdout) {
      proc.stdout.on("data", (chunk) => {
        lastFlow = Date.now();
        pendingWrites++;
        try {
          const flushed = stream.write(chunk, () => {
            pendingWrites--;
            lastFlow = Date.now();
            maybeFinish();
          });
          if (!flushed) {
            proc.stdout.pause();
            stream.once("drain", () => proc.stdout.resume());
          }
        } catch {
          pendingWrites--; // channel gone — the chunk is lost either way
          proc.stdout.destroy();
        }
      });
      proc.stdout.on("end", () => { outEnded = true; maybeFinish(); });
    }
    if (proc.stderr) {
      proc.stderr.on("data", (chunk) => {
        lastFlow = Date.now();
        pendingWrites++;
        try {
          const flushed = stream.stderr.write(chunk, () => {
            pendingWrites--;
            lastFlow = Date.now();
            maybeFinish();
          });
          if (!flushed) {
            proc.stderr.pause();
            stream.stderr.once("drain", () => proc.stderr.resume());
          }
        } catch {
          pendingWrites--; // channel gone — the chunk is lost either way
          proc.stderr.destroy();
        }
      });
      proc.stderr.on("end", () => { errEnded = true; maybeFinish(); });
    }
    stream.pipe(proc.stdin, { end: false });
    proc.stdin.on("error", () => { /* bash may exit before consuming stdin */ });
    // sshd semantics: the client's channel EOF (MSG_CHANNEL_EOF, emitted by
    // the standard `stream.write(data); stream.end();` upload pattern) must
    // close the child's stdin — otherwise `cat > file` never sees EOF and
    // blocks forever. pipe's end:false guards the write-after-exit case; the
    // explicit end() here covers the EOF case.
    stream.on("end", () => {
      try { proc.stdin.end(); } catch { /* child already gone */ }
    });
  } catch (err) {
    log(`pipe setup failed: ${err?.message ?? err}`);
    dead = true;
    finish();
    return proc;
  }

  // Client disconnected (or we closed the channel). Emulate sshd: SIGHUP the
  // direct child only. nohup'd/setsid'd children ignore or survive it.
  stream.on("close", () => {
    clearGrace();
    if (!dead) {
      log(`channel closed while command still running — SIGHUP to pid ${proc.pid}`);
      try { proc.kill("SIGHUP"); } catch { /* already gone */ }
    }
    finished = true; // channel is gone; nothing left to close
    cleanupPipes();
    onFinish?.();
  });

  return proc;
}

// ---------------------------------------------------------------------------
// Session handling
// ---------------------------------------------------------------------------

function handleSession(session) {
  /** Currently running process for this session (signal routing target). */
  let activeProc = null;

  const clearActive = () => { activeProc = null; };

  // Client → server signals (e.g. Ctrl-C). info.name is e.g. "SIGINT" or "INT".
  session.on("signal", (accept, reject, info) => {
    try { accept?.(); } catch { /* ignore */ }
    if (!activeProc) return;
    const sig = normalizeSignal(info?.name);
    log(`forwarding signal ${info?.name ?? "?"} as ${sig} to pid ${activeProc.pid ?? "?"}`);
    try { activeProc.kill(sig); } catch { /* already gone */ }
  });

  // Accept pty/window-change requests so interactive ssh clients are happy.
  // (No real pty is allocated — the channel itself acts as the terminal.)
  session.on("pty", (accept) => {
    try { accept?.(); } catch { /* ignore */ }
  });
  session.on("window-change", () => { /* cosmetic only */ });

  session.on("exec", (accept, reject, info) => {
    let stream;
    try {
      stream = accept();
    } catch (err) {
      log(`exec accept failed: ${err?.message ?? err}`);
      try { reject?.(); } catch { /* ignore */ }
      return;
    }
    try {
      const raw = String(info?.command ?? "");
      log(`exec: ${raw}`);
      // t346 — the exec audit: every command's first line lands in
      // exec-audit.log so the E2E suites can PROVE wire-traffic shapes
      // ("the log tab's 1.5s polling paid ZERO SSH round trips", "the
      // dispatch censed the star without catting it"). Bounded: past 4MB
      // the audit resets (a test rig instrument, not a forever ledger).
      try {
        const auditPath = join(LEVER_DIR, "exec-audit.log");
        let auditSize = 0;
        try {
          auditSize = statSync(auditPath).size;
        } catch {
          /* fresh */
        }
        if (auditSize > 4 * 1024 * 1024) rmSync(auditPath, { force: true });
        // newlines → ⏎ so a MULTI-LINE command (the poll sweep's script)
        // keeps its shape markers (===CF:START:, ---LOG--- …) visible in
        // the audit — the first line alone is just "set -u"
        appendFileSync(auditPath, `${Date.now()} ${raw.replace(/\r?\n/g, "⏎").slice(0, 400)}\n`);
      } catch {
        /* best effort — the audit is the test's own instrument */
      }
      // t344 — the one-shot channel-kill lever: the app's wipe rm meets a
      // channel that dies without a verdict (the SSH-level error the retry
      // ladder exists for). Consumed on first fire.
      if (isBatchedRm(raw) && existsSync(join(LEVER_DIR, "rm-channel-close"))) {
        try { rmSync(join(LEVER_DIR, "rm-channel-close")); } catch { /* already gone */ }
        leverLog("channel-close");
        log("exec: rm-channel-close lever fired — closing the channel without an exit");
        try { stream.close(); } catch { /* ignore */ }
        return;
      }
      // t345 — the same one-shot channel-kill for the star preflight's cat
      // (the redial-retry ladder's own door). Consumed on first fire.
      const catClose = catLeverSpec(raw, "cat-channel-close");
      if (catClose) {
        try { rmSync(join(LEVER_DIR, "cat-channel-close")); } catch { /* already gone */ }
        catLeverLog(`channel-close on ${catClose.substr}`);
        log("exec: cat-channel-close lever fired — closing the channel without an exit");
        try { stream.close(); } catch { /* ignore */ }
        return;
      }
      // t346 — the GENERIC one-shot channel-kill: any exec whose command
      // contains the lever's substring dies without a verdict (tortures
      // whatever read path the current code speaks — the census awk, a
      // header sniff, …). Consumed on first fire.
      const execClose = execLeverSpec(raw, "exec-channel-close");
      if (execClose) {
        try { rmSync(join(LEVER_DIR, "exec-channel-close")); } catch { /* already gone */ }
        execLeverLog(`channel-close on ${execClose.substr}`);
        log("exec: exec-channel-close lever fired — closing the channel without an exit");
        try { stream.close(); } catch { /* ignore */ }
        return;
      }
      const translated = applyCatDropLever(
        applyExecSlowLever(applyCatSlowLever(applyRmSlowLever(translateCommand(raw))))
      );
      if (process.env.CF_MOCK_DEBUG) log(`exec-translated: ${translated.slice(0, 200)}`);
      activeProc = runCommand(stream, ["-c", translated], { onFinish: clearActive });
    } catch (err) {
      log(`exec handler error: ${err?.stack ?? err}`);
      safeWrite(stream.stderr, `mock-cluster: internal error: ${err?.message ?? err}\n`);
      try { stream.exit(127); } catch { /* ignore */ }
      try { stream.close(); } catch { /* ignore */ }
      clearActive();
    }
  });

  session.on("shell", (accept, reject) => {
    let stream;
    try {
      stream = accept();
    } catch (err) {
      log(`shell accept failed: ${err?.message ?? err}`);
      try { reject?.(); } catch { /* ignore */ }
      return;
    }
    try {
      log("shell: interactive login shell");
      // Login shell reading commands from the channel (no real pty attached).
      activeProc = runCommand(stream, ["-l"], { onFinish: clearActive });
    } catch (err) {
      log(`shell handler error: ${err?.stack ?? err}`);
      safeWrite(stream.stderr, `mock-cluster: internal error: ${err?.message ?? err}\n`);
      try { stream.exit(127); } catch { /* ignore */ }
      try { stream.close(); } catch { /* ignore */ }
      clearActive();
    }
  });

  // NOTE: 'sftp' deliberately NOT handled — ssh2 refuses the subsystem
  // request automatically when no listener exists.
}

// ---------------------------------------------------------------------------
// Connection handling
// ---------------------------------------------------------------------------

function handleClient(client) {
  const remote = `${client._sock?.remoteAddress ?? "?"}:${client._sock?.remotePort ?? "?"}`;

  client.on("authentication", (ctx) => {
    const { method, username } = ctx;

    if (AUTH_MODE.startsWith("keyboard-interactive")) {
      // Hardened login node: the `password` method does not exist here — the
      // credential must travel through a keyboard-interactive round, exactly
      // like PAM-backed sshd with PasswordAuthentication no.
      if (method === "keyboard-interactive" && username === AUTH_USER) {
        const prompts = AUTH_MODE === "keyboard-interactive-2fa"
          ? [
              { prompt: `${username}'s password: `, echo: false },
              { prompt: "Verification code: ", echo: false },
            ]
          : [{ prompt: `${username}'s password: `, echo: false }];
        ctx.prompt(
          prompts,
          "SSH Authentication",
          "This cluster only accepts keyboard-interactive authentication.",
          (answers) => {
            const passwordOk = Array.isArray(answers) && answers[0] === AUTH_PASSWORD;
            const codeOk =
              AUTH_MODE !== "keyboard-interactive-2fa"
              || (Array.isArray(answers) && answers[1] === AUTH_2FA_CODE);
            if (passwordOk && codeOk) {
              log(`auth ok: keyboard-interactive login for "${username}" from ${remote}`);
              ctx.accept();
            } else {
              log(`auth rejected: bad keyboard-interactive answer for "${username}" from ${remote}`);
              ctx.reject(["keyboard-interactive"]);
            }
          }
        );
        return;
      }
      log(`auth rejected: ${method} attempt for "${username}" (keyboard-interactive only)`);
      ctx.reject(["keyboard-interactive"]);
      return;
    }

    if (method === "password" && username === AUTH_USER && ctx.password === AUTH_PASSWORD) {
      log(`auth ok: password login for "${username}" from ${remote}`);
      ctx.accept();
      return;
    }
    if (method !== "password") {
      log(`auth rejected: ${method} attempt for "${username}" (password only)`);
    } else {
      log(`auth rejected: bad credentials for "${username}" from ${remote}`);
    }
    ctx.reject(["password"]); // hint: only password auth is supported
  });

  client.on("ready", () => {
    log(`client ready: ${remote}`);
  });

  client.on("session", (accept, reject) => {
    try {
      handleSession(accept());
    } catch (err) {
      log(`session error: ${err?.stack ?? err}`);
      try { reject?.(); } catch { /* ignore */ }
    }
  });

  client.on("error", (err) => {
    log(`client error (${remote}): ${err?.message ?? err}`);
  });

  client.on("end", () => {
    log(`client disconnected: ${remote}`);
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// `bun --hot` re-runs this module on file change — close the previous
// listener first so the new one can bind (existing background jobs keep
// running: they are detached).
const HOT_KEY = Symbol.for("cryoflow.mock-cluster.server");
const prev = globalThis[HOT_KEY];
if (prev) {
  try { prev.close(); } catch { /* ignore */ }
  log("hot reload: replaced previous listener");
}

const server = new Server({ hostKeys: [ensureHostKey()] }, handleClient);
globalThis[HOT_KEY] = server;

server.on("error", (err) => {
  log(`server error: ${err?.message ?? err}`);
  if (err?.code === "EADDRINUSE") {
    log(`port ${PORT} is already in use — is another mock-cluster instance running?`);
  }
});

server.listen(PORT, BIND_HOST, () => {
  log(`mock cluster listening on :${PORT} (bind ${BIND_HOST})`);
  log(`fs root: ${FS_ROOT}`);
  log(`auth mode: ${AUTH_MODE} — "${AUTH_USER}" / "${AUTH_PASSWORD}" · remoteRoot: /projects/cryoflow`);
});

// One bad command must never take the server down.
const GLOBALS_KEY = Symbol.for("cryoflow.mock-cluster.globals");
if (!globalThis[GLOBALS_KEY]) {
  globalThis[GLOBALS_KEY] = true;
  process.on("uncaughtException", (err) => {
    log(`uncaught exception (server stays up): ${err?.stack ?? err}`);
  });
  process.on("unhandledRejection", (err) => {
    log(`unhandled rejection (server stays up): ${err?.stack ?? err}`);
  });
  const shutdown = (sig) => {
    log(`received ${sig} — shutting down`);
    try { server.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
