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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
 *   fs/opt/bin                       — mock module system (`module`)
 *   /home/z/relion-build/bin         — real RELION build of this sandbox
 *   /home/z/relion-build/deps/mpich/bin — its MPI runtime
 *   /usr/bin, /bin                   — coreutils, bash, setsid, …
 */
const MOCK_PATH = [
  `${FS_ROOT}/opt/bin`,
  "/home/z/relion-build/bin",
  "/home/z/relion-build/deps/mpich/bin",
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
      const translated = translateCommand(raw);
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
