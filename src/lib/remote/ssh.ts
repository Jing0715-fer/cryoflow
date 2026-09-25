/**
 * CryoFlow — SSH transport for remote clusters (SERVER ONLY).
 *
 * A small ssh2 client pool keyed by connection id. Everything the remote
 * engine needs travels through exec channels:
 *   - commands            `exec()`        bash script → exit code + output
 *   - login-shell probes  `bash -lc`      (module is a login-shell function)
 *   - file download       stream `cat`    → local file (with byte cap)
 *   - file upload         stream `cat >`  ← local content (mkdir -p first)
 *   - file listing/stat   `find` / `stat` parsed helpers
 *
 * No SFTP subsystem is required — some hardened clusters disable it, and the
 * exec path works everywhere a shell does.
 *
 * t291 — auth is diagnosed, not just attempted: preflightAuthProblem fails
 * fast on user-fixable config errors, a custom authHandler records the
 * negotiation (methods tried + what the server offered), and the
 * keyboard-interactive round counts its prompts — so a rejected login says
 * WHICH failure it was instead of ssh2's one-size-fits-all
 * "All configured authentication methods failed".
 *
 * Every connection has a serialized command queue (clusters hate concurrent
 * exec storms); fire-and-forget callers can use tryExec() which declines
 * politely while a command is in flight (the poll sweep just keeps its
 * previous state — the next tick re-polls).
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, writeSync } from "fs";
import path from "path";
import { Client } from "ssh2";
import type { RemoteConnection } from "./types";

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  /** Human-readable failure when the channel itself broke (timeout/net). */
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Pool                                                                */
/* ------------------------------------------------------------------ */

interface PooledClient {
  client: Client;
  /** Config fingerprint — a saved edit replaces the live connection. */
  fingerprint: string;
  ready: Promise<void>;
  /** Serialized command queue tail (one exec at a time per connection). */
  queueTail: Promise<unknown>;
  /** Commands queued (waiting OR running) — the tryExec busy signal. */
  queued: number;
  /** Bumped on hard failure so callers can report honest errors. */
  lastError: string | null;
  /**
   * t346 — consecutive exec TIMEOUTS on this wire. keepalive needs its
   * whole 30s window to notice a dead peer, and until it does every
   * queued exec burns its full budget against the corpse (serialized —
   * the sweep, the log fetches, staging, all of them). Two timeouts in
   * a row is the wire saying the connection is gone: drop it so the
   * next exec re-dials a fresh TCP+auth channel instead of queuing onto
   * the body. A single timeout (a slow-but-alive login node) changes
   * nothing.
   */
  timeoutStreak: number;
}

const pool = new Map<string, PooledClient>();

function fingerprint(c: RemoteConnection): string {
  return JSON.stringify([c.host, c.port, c.username, c.authMethod, c.privateKeyPath, c.password, c.passphrase]);
}

function authConfig(c: RemoteConnection): {
  type: "none" | "agent" | "publickey" | "password";
  username: string;
  password?: string;
  privateKey?: Buffer | string;
  passphrase?: string;
  agent?: string;
  tryKeyboard?: boolean;
} {
  const base = { username: c.username };
  if (c.authMethod === "agent") {
    const sock = process.env.SSH_AUTH_SOCK;
    const agent =
      sock ?? (process.platform === "win32" ? "\\\\.\\pipe\\openssh-ssh-agent" : undefined);
    return { type: "agent", ...base, agent };
  }
  if (c.authMethod === "key" && c.privateKeyPath) {
    let key: Buffer | string | undefined;
    try {
      key = readFileSync(c.privateKeyPath);
    } catch {
      key = undefined;
    }
    return {
      type: "publickey",
      ...base,
      privateKey: key,
      ...(c.passphrase ? { passphrase: c.passphrase } : {}),
    };
  }
  return { type: "password", ...base, password: c.password ?? "", tryKeyboard: true };
}

/* ------------------------------------------------------------------ */
/* Auth pre-flight + negotiation recorder (t291)                       */
/* ------------------------------------------------------------------ */

/**
 * User-fixable auth config problems, caught BEFORE any network round-trip.
 * t291's user report made the cost of skipping this concrete: a connection
 * with no stored password (an edit that never re-typed it), a missing key
 * file, or a missing agent socket all degrade into ssh2's single cryptic
 * line — "All configured authentication methods failed" — which tells the
 * user nothing about WHICH of these very different problems they have.
 * Each message says what is wrong and what to do about it.
 */
export function preflightAuthProblem(c: RemoteConnection): string | null {
  if (c.authMethod === "password") {
    if (typeof c.password !== "string" || c.password.length === 0) {
      return (
        "this connection has NO password stored — open it in the cluster dialog, " +
        "type the password, Save, then test again (an edit that skips the password " +
        "field keeps it empty; MobaXterm working proves the credential, not the stored copy)"
      );
    }
  }
  if (c.authMethod === "key") {
    if (!c.privateKeyPath) {
      return "auth method is Private key but no key file path is set — choose the key file first";
    }
    try {
      readFileSync(c.privateKeyPath);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return `cannot read the private key file "${c.privateKeyPath}" on this machine (${reason}) — check the path`;
    }
  }
  if (c.authMethod === "agent") {
    if (!process.env.SSH_AUTH_SOCK && process.platform !== "win32") {
      return (
        "no SSH agent is running (SSH_AUTH_SOCK is unset on this machine) — start " +
        "ssh-agent with your key loaded, or switch the connection's auth method to Password / Private key"
      );
    }
  }
  return null;
}

/** What the auth negotiation saw — the recorder ssh2 never gives you. */
interface AuthNegotiation {
  /** Methods we sent, in order (ssh2's linear fallback chain). */
  tried: string[];
  /** The server's last "methods that can continue" list. */
  serverOffers: string[];
  /** Prompts in the keyboard-interactive round (0 = never reached / banner only). */
  kbdPrompts: number;
}

/**
 * Rewrite ssh2's auth-exhaustion error into a diagnosis. The base line stays
 * recognizable, then we append the two facts only the negotiation knows
 * (what we tried, what the server accepts) and ONE targeted hint — so "wrong
 * password", "cluster wants keys only", and "multi-prompt 2FA" stop sharing
 * a single indistinguishable sentence.
 */
function authFailureMessage(err: Error, n: AuthNegotiation): string {
  const base = err.message || "SSH authentication failed";
  const leveled = (err as Error & { level?: string }).level;
  if (leveled !== "client-authentication" && !/All configured authentication methods/i.test(base)) {
    return base; // not the exhaustion case — ssh2's own message is already specific
  }
  const tried = n.tried.filter((m) => m !== "none");
  const parts: string[] = [base];
  if (tried.length > 0) parts.push(`tried ${tried.join(" + ")}`);
  if (n.serverOffers.length > 0) parts.push(`the server accepts ${n.serverOffers.join(" + ")}`);
  parts.push(authHint(n));
  return parts.join(" — ");
}

function authHint(n: AuthNegotiation): string {
  const offers = new Set(n.serverOffers);
  const triedKbd = n.tried.includes("keyboard-interactive");
  if (triedKbd && n.kbdPrompts > 1) {
    return (
      `the cluster asked ${n.kbdPrompts} questions at login (multi-prompt / 2FA) — ` +
      "only single-prompt password login is supported"
    );
  }
  if (offers.size > 0 && !offers.has("password") && !offers.has("keyboard-interactive")) {
    return (
      "this cluster does not accept password logins at all — switch the " +
      "connection's auth method to Private key"
    );
  }
  if (triedKbd && offers.has("keyboard-interactive")) {
    return (
      "the username or password was refused — re-check the username, retype the " +
      "password in the cluster dialog and Save (a login that works in MobaXterm proves " +
      "the credential, not the stored copy)"
    );
  }
  if (offers.size === 0) {
    return (
      "the server rejected the login without listing what it accepts — check the " +
      "username, and whether this account is allowed password logins"
    );
  }
  return "re-check the username and password, then Save and test again";
}

/** Reset any pooled client whose saved config changed (or on demand). */
export function dropConnection(connectionId: string): void {
  const pooled = pool.get(connectionId);
  if (pooled) {
    pool.delete(connectionId);
    try {
      pooled.client.end();
    } catch {
      /* already gone */
    }
  }
}

function getPooled(c: RemoteConnection): PooledClient {
  const fp = fingerprint(c);
  const existing = pool.get(c.id);
  if (existing && existing.fingerprint === fp) return existing;
  if (existing) dropConnection(c.id);

  const client = new Client();
  // ready settles through the client events — the resolver handles are
  // captured so the pooled object can be fully typed BEFORE the handlers run
  let settleReady!: () => void;
  let failReady!: (e: Error) => void;
  const ready = new Promise<void>((res, rej) => {
    settleReady = res;
    failReady = rej;
  });
  const pooled: PooledClient = {
    client,
    fingerprint: fp,
    ready,
    queueTail: Promise.resolve(),
    queued: 0,
    lastError: null,
    timeoutStreak: 0,
  };

  // t291 pre-flight: config problems the user can fix get their OWN honest
  // error before any network round-trip — they used to collapse into ssh2's
  // "All configured authentication methods failed" together with genuinely
  // wrong credentials, which made the user's report unactionable.
  const preflight = preflightAuthProblem(c);
  if (preflight) {
    pooled.lastError = preflight;
    const err = new Error(preflight);
    failReady(err);
    ready.catch(() => {}); // idle rejection must not trip unhandledRejection
    pool.set(c.id, pooled);
    return pooled;
  }

  const auth = authConfig(c);
  // t291 negotiation recorder: ssh2's default auth handler throws away the
  // server's "methods that can continue" list, so a failed login can't say
  // which dialect the cluster speaks. This custom handler mirrors ssh2's
  // linear chain exactly (same methods, same order — validated against
  // ssh2's own authsAllowed on every step) while recording the exchange.
  const negotiation: AuthNegotiation = { tried: [], serverOffers: [], kbdPrompts: 0 };
  {
    const timeout = setTimeout(() => {
      pooled.lastError = "connect timeout";
      try {
        client.end();
      } catch {
        /* ignore */
      }
      failReady(new Error(`SSH connect timeout after 15s (${c.host}:${c.port})`));
    }, 15_000);
    // ssh2 ConnectConfig — built imperatively so each auth flavor gets its
    // exact shape (a conditional spread produces a union TS cannot place)
    const cfg: Record<string, unknown> = {
      host: c.host,
      port: c.port,
      readyTimeout: 15_000,
      // t346 — 10s×3 = a dead peer is noticed in ≤30s (was 15×4 = 60s:
      // a half-dead wire burned full exec budgets for a whole minute
      // while every queued command timed out against the corpse)
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3,
    };
    // mirrors ssh2's own authsAllowed construction order exactly: none →
    // password → publickey → agent → keyboard-interactive (client.js builds
    // this same list from the config; our strings must all be members of it)
    const authMethods: string[] = ["none"];
    if (auth.type === "agent" && auth.agent) {
      cfg.agent = auth.agent;
      cfg.username = auth.username;
      authMethods.push("agent");
    } else if (auth.type === "publickey" && auth.privateKey) {
      cfg.username = auth.username;
      cfg.privateKey = auth.privateKey;
      if (auth.passphrase) cfg.passphrase = auth.passphrase;
      authMethods.push("publickey");
    } else {
      cfg.username = auth.username;
      cfg.password = auth.password ?? "";
      cfg.tryKeyboard = true;
      authMethods.push("password", "keyboard-interactive");
    }
    cfg.authHandler = (authsLeft: unknown) => {
      if (Array.isArray(authsLeft) && authsLeft.length > 0) {
        negotiation.serverOffers = Array.from(new Set(authsLeft.map((m) => String(m))));
      }
      const next = negotiation.tried.length;
      if (next >= authMethods.length) return false;
      const method = authMethods[next];
      negotiation.tried.push(method);
      return method;
    };
    client
      .on("ready", () => {
        clearTimeout(timeout);
        settleReady();
      })
      .on("error", (err: Error) => {
        clearTimeout(timeout);
        const msg = authFailureMessage(err, negotiation);
        pooled.lastError = msg;
        pool.delete(c.id);
        failReady(new Error(msg));
      })
      .on("close", () => {
        pool.delete(c.id);
      });
    // keyboard-interactive continuation (very common on HPC clusters whose
    // sshd has PasswordAuthentication no + KbdInteractiveAuthentication yes —
    // the dialect MobaXterm speaks transparently; t291 also counts prompts,
    // because a multi-prompt round means 2FA, which we must name honestly).
    // Not in @types/ssh2's event union — attached through a string-typed shim.
    type AnyEmitter = { on(evt: string, fn: (...args: never[]) => void): void };
    (client as unknown as AnyEmitter).on("keyboard-interactive", (...args: never[]) => {
      const prompts = args[3] as unknown[] | undefined;
      const finish = args[4] as (answers: string[]) => void;
      const list = Array.isArray(prompts) ? prompts : [];
      negotiation.kbdPrompts = Math.max(negotiation.kbdPrompts, list.length);
      // answer every prompt with the configured password — MFA beyond that
      // is out of scope and fails honestly (with the prompt count in the
      // error, so the reason is legible)
      const pw = authConfig(c).password ?? "";
      finish(list.map(() => pw));
    });
    client.connect(cfg as Parameters<Client["connect"]>[0]);
  }
  pool.set(c.id, pooled);
  return pooled;
}

/** Quick reachability check used by the API test route (never throws). */
export async function connectionWorks(c: RemoteConnection): Promise<{ ok: boolean; error?: string }> {
  try {
    const pooled = getPooled(c);
    await pooled.ready;
    const r = await exec(c, "echo CF_OK", { timeoutMs: 10_000 });
    if (r.error) return { ok: false, error: r.error };
    if (r.code !== 0) return { ok: false, error: `remote echo failed (exit ${r.code}): ${r.stderr.trim().slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    dropConnection(c.id);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/* ------------------------------------------------------------------ */
/* Exec                                                                */
/* ------------------------------------------------------------------ */

function shellSingleQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/** Wrap a script for a LOGIN shell so `module` is defined (profile sourced). */
export function loginShellScript(script: string): string {
  return "bash -lc " + shellSingleQuote(script);
}

interface RawExecOutcome {
  code: number | null;
  stdout: Buffer;
  stderr: string;
  error?: string;
}

function rawExec(
  pooled: PooledClient,
  command: string,
  opts: { timeoutMs: number; stdin?: Buffer | null }
): Promise<RawExecOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    let exited = false;
    let streamRef: import("ssh2").ClientChannel | null = null;
    // 'close' under Bun is UNRELIABLE (may never fire after exit, or fire
    // spuriously while the remote is fine) — resolve on 'exit' and treat a
    // close-without-exit as fatal only after a grace window.
    let closeGrace: ReturnType<typeof setTimeout> | null = null;
    const done = (r: RawExecOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (closeGrace) clearTimeout(closeGrace);
      resolve(r);
    };
    const timer = setTimeout(() => {
      try {
        streamRef?.close();
      } catch {
        /* ignore */
      }
      done({ code: null, stdout: Buffer.alloc(0), stderr: "", error: `timeout after ${opts.timeoutMs}ms` });
    }, opts.timeoutMs);

    pooled.client.exec(command, (err, s) => {
      if (err) {
        done({ code: null, stdout: Buffer.alloc(0), stderr: "", error: err.message });
        return;
      }
      const stream = s;
      streamRef = s;
      const out: Buffer[] = [];
      const errBuf: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => out.push(chunk));
      stream.stderr.on("data", (chunk: Buffer) => errBuf.push(chunk));
      stream.on("exit", (code: number | null) => {
        exited = true;
        // give the final data events a beat to land before resolving
        setImmediate(() => done({ code, stdout: Buffer.concat(out), stderr: Buffer.concat(errBuf).toString("utf8") }));
      });
      stream.on("close", () => {
        if (settled) return;
        closeGrace = setTimeout(() => {
          if (!exited) {
            done({
              code: null,
              stdout: Buffer.concat(out),
              stderr: Buffer.concat(errBuf).toString("utf8"),
              error: "channel closed before exit",
            });
          }
        }, 1500);
      });
      if (opts.stdin && opts.stdin.length > 0) {
        // Bun + ssh2: channel end()/EOF is broken (never terminates the
        // remote `cat`), so stdin consumers MUST self-terminate — uploads
        // use `head -c <N> > file` which exits after exactly N bytes. No
        // stream.end() here on purpose.
        stream.write(opts.stdin);
      } else {
        stream.end();
      }
    });
  });
}

/**
 * Serialized exec: the command joins the connection's queue and only STARTS
 * when everything before it finished (the async fn is created lazily INSIDE
 * the chain — invoking it earlier would start it immediately, defeating the
 * serialization). Timeouts and channel errors degrade to { error }, never
 * throwing.
 */
export async function exec(
  c: RemoteConnection,
  command: string,
  opts: { timeoutMs?: number; stdin?: Buffer | null } = {}
): Promise<ExecResult> {
  const pooled = getPooled(c);
  pooled.queued += 1;
  const run = async (): Promise<ExecResult> => {
    try {
      try {
        await pooled.ready;
      } catch (e) {
        dropConnection(c.id);
        return { code: null, stdout: "", stderr: "", error: e instanceof Error ? e.message : String(e) };
      }
      const r = await rawExec(pooled, command, {
        timeoutMs: opts.timeoutMs ?? 20_000,
        stdin: opts.stdin ?? null,
      });
      // t346 — the timeout-streak ladder: ONE timeout is a slow login
      // node (forgiven); TWO in a row is a dead wire pretending to be
      // alive — drop the pooled client so the next exec re-dials. Only
      // the timeout word counts: exit codes and channel errors have
      // their own honest meanings.
      if (typeof r.error === "string" && /timeout after/.test(r.error)) {
        pooled.timeoutStreak += 1;
        if (pooled.timeoutStreak >= 2) {
          console.log(
            `ssh: ${c.id} timed out ${pooled.timeoutStreak}x in a row — dropping the pooled connection for a fresh re-dial (t346)`
          );
          pooled.timeoutStreak = 0;
          dropConnection(c.id);
        }
      } else if (!r.error) {
        pooled.timeoutStreak = 0;
      }
      return {
        code: r.code,
        stdout: r.stdout.toString("utf8"),
        stderr: r.stderr,
        ...(r.error ? { error: r.error } : {}),
      };
    } finally {
      pooled.queued -= 1;
    }
  };
  // chain: run starts only after the previous command settled; the tail
  // itself never rejects (later commands must still get their turn)
  const chained = pooled.queueTail.then(run, run);
  pooled.queueTail = chained.then(
    () => undefined,
    () => undefined
  );
  return chained;
}

/**
 * Declining exec: if another command is queued or running on this
 * connection, returns { error: "busy" } immediately — the poll sweep uses
 * this so a slow SSH round trip never stacks polls.
 */
export async function tryExec(
  c: RemoteConnection,
  command: string,
  opts: { timeoutMs?: number } = {}
): Promise<ExecResult> {
  const pooled = pool.get(c.id);
  if (pooled && pooled.queued > 0) {
    return { code: null, stdout: "", stderr: "", error: "busy" };
  }
  return exec(c, command, opts);
}

/**
 * t384 — the quick-read lane: an exec that does NOT join the connection's
 * serialized queue. The usage panel's `scontrol show nodes -o` must answer
 * while the queue is deep in a poll sweep, a log fetch or a sync-back —
 * the serialized exec's 12s budget expires BEFORE the turn ever comes,
 * which the field met as 「查询node使用情况一直失败」. Channels
 * multiplex over the one pooled SSH connection, so this runs concurrently
 * without disturbing the queue's ordering (and never delays the queue
 * either). Contract: short, read-only, idempotent commands only — never
 * anything that could race a queued writer on the same files.
 */
export async function execUnqueued(
  c: RemoteConnection,
  command: string,
  opts: { timeoutMs?: number } = {}
): Promise<ExecResult> {
  const pooled = getPooled(c);
  try {
    await pooled.ready;
  } catch (e) {
    dropConnection(c.id);
    return {
      code: null,
      stdout: "",
      stderr: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
  const r = await rawExec(pooled, command, {
    timeoutMs: opts.timeoutMs ?? 20_000,
    stdin: null,
  });
  return {
    code: r.code,
    stdout: r.stdout.toString("utf8"),
    stderr: r.stderr,
    ...(r.error ? { error: r.error } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* File helpers (exec-based — no SFTP dependency)                      */
/* ------------------------------------------------------------------ */

/** mkdir -p on the remote side. */
export async function remoteMkdir(c: RemoteConnection, dir: string): Promise<void> {
  await exec(c, `mkdir -p ${shellSingleQuote(dir)}`, { timeoutMs: 15_000 });
}

/** Remote file existence + size (null = absent OR the stat itself failed).
 *
 * t355 — this rides a DIRECT pooled channel, NOT the serialized exec queue:
 * a stat is the opening move of every file transfer (remoteDownload's own
 * pre-pull check, the t289 lazy fetch, the t354 iteration pulls), and on a
 * real cluster the queue is busy exactly when a transfer is asked for — the
 * sweep's heartbeat, the /iterations poll and the log fetches all serialize
 * ahead of it, and the old 10s queued budget expired BEFORE the stat ever
 * started (the sheet route then 404'd with "may not exist on this run" while
 * the stack sat healthy on the cluster). Downloads already bypass the queue
 * (their `cat` runs on a direct channel); the stat now speaks the same
 * transport, with a 20s budget for a login node under load.
 */
export async function remoteStat(
  c: RemoteConnection,
  file: string
): Promise<{ size: number; mtimeMs: number } | null> {
  const r = await remoteStatEx(c, file);
  return r.kind === "ok" ? { size: r.size, mtimeMs: r.mtimeMs } : null;
}

/** t358 — the stat that says WHICH miss it was. The plain remoteStat folds
 * three very different worlds into one null ("the file is not there", "the
 * wire could not answer", "the login node timed out"), and the t357 field
 * report showed the cost: every one of them rendered as the same
 * "the stack may not exist on the cluster" 404 while the real reason stayed
 * invisible. The chunked puller (and through it the sheet/image routes)
 * speaks THIS dialect so the UI can say what actually broke. */
export type RemoteStatResult =
  | { kind: "ok"; size: number; mtimeMs: number }
  | { kind: "absent" }
  | { kind: "error"; message: string };

export async function remoteStatEx(
  c: RemoteConnection,
  file: string
): Promise<RemoteStatResult> {
  const pooled = getPooled(c);
  try {
    await pooled.ready;
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
  const r = await rawExec(
    pooled,
    `stat -c '%s %Y' ${shellSingleQuote(file)} 2>/dev/null || echo MISSING`,
    { timeoutMs: 20_000, stdin: null }
  );
  if (r.error) return { kind: "error", message: r.error };
  if (r.code !== 0) return { kind: "error", message: `stat exited ${r.code}` };
  const m = /^(\d+) (\d+)\s*$/.exec(r.stdout.toString("utf8").trim());
  if (!m) {
    // the stat answered MISSING — the cluster's own verdict that the file
    // is not there (an HONEST miss, never retried into existence)
    if (/^MISSING\s*$/.test(r.stdout.toString("utf8").trim())) return { kind: "absent" };
    return { kind: "error", message: "stat output unparseable" };
  }
  return { kind: "ok", size: Number(m[1]), mtimeMs: Number(m[2]) * 1000 };
}

/** t358 — partial-write-safe synchronous write AT AN EXPLICIT POSITION.
 * Node/Bun's writeSync MAY short-write (signal interruption, internal
 * buffer edges); the t357 download loop ignored its return value, so a
 * short write would silently drop the tail of a chunk. Explicit positions
 * also make chunk RETRIES rewind-proof: a failed attempt that landed a
 * partial 3 MB does not move the next attempt's write point. */
function writeAllSyncAt(fd: number, buf: Buffer, position: number): void {
  let off = 0;
  while (off < buf.length) {
    const n = writeSync(fd, buf, off, buf.length - off, position + off);
    if (n <= 0) throw new Error(`writeSync returned ${n}`);
    off += n;
  }
}

/**
 * Stream-download a remote file into a local path with a hard byte cap.
 * Uses `cat` over exec; over-cap aborts (the sync-back caller then marks the
 * file as skipped). Returns bytes written or null on failure.
 */
export async function remoteDownload(
  c: RemoteConnection,
  remotePath: string,
  localPath: string,
  maxBytes: number
): Promise<number | null> {
  const st = await remoteStat(c, remotePath);
  if (st == null) return null;
  if (st.size > maxBytes) return -1; // over cap — caller decides (skip note)
  mkdirSync(path.dirname(localPath), { recursive: true });

  const pooled = getPooled(c);
  try {
    await pooled.ready;
  } catch {
    return null;
  }
  return new Promise<number | null>((resolve) => {
    let settled = false;
    let fd: number | null = null;
    const finish = (v: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (fd != null) {
        try { closeSync(fd); } catch { /* ignore */ }
        fd = null;
      }
      resolve(v);
    };
    // t298 — SYNCHRONOUS writes, not a WriteStream: bun's stream buffering
    // silently dropped chunks under concurrent load (the bare-ssh2 probe in
    // Node was byte-exact 10/10 while the app's streamed writes lost 1.6–48
    // MB per 64 MB transfer). writeSync has no buffer to drop from — each
    // chunk lands in the page cache the moment the SSH stream emits it, and
    // the SSH socket's own TCP backpressure paces the transfer.
    let written = 0;
    const timer = setTimeout(() => {
      try {
        streamRef?.close();
      } catch {
        /* ignore */
      }
      finish(null);
    }, Math.max(20_000, Math.min(600_000, st.size / 50))); // ~50KB/s floor → cap
    let streamRef: import("ssh2").ClientChannel | null = null;
    pooled.client.exec(`cat ${shellSingleQuote(remotePath)}`, (err, stream) => {
      if (err) {
        finish(null);
        return;
      }
      streamRef = stream;
      try {
        fd = openSync(localPath, "w");
      } catch {
        finish(null);
        return;
      }
      stream.on("data", (chunk: Buffer) => {
        written += chunk.length;
        if (written > maxBytes) {
          try {
            stream.close();
          } catch {
            /* ignore */
          }
          finish(-1);
          return;
        }
        if (fd != null) {
          try {
            writeSync(fd, chunk);
          } catch {
            finish(null);
          }
        }
      });
      // t298 — end the file ONLY on 'close': data may legally arrive between
      // 'exit' and 'close'. 'close' is the point where no further data is
      // possible.
      // t299 — the verdict is the BYTE ACCOUNT against the pre-pull
      // remoteStat, not "some bytes arrived": a clean ctffind run's run.err
      // is legitimately ZERO bytes, and `written > 0` sentenced every empty
      // file to "download failed" (the sync-back skipped it, the ledger
      // under-counted, t262's ≥3 assertion caught it). 0 === 0 is a PASS;
      // a truncated non-empty read (written < st.size) still fails honest.
      stream.on("close", () => {
        finish(written === st.size ? written : null);
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/* t358 — the CHUNKED transfer (big, lossy-wire-proof downloads)        */
/* ------------------------------------------------------------------ */

export interface ChunkedDownloadOpts {
  /** hard byte cap for the whole file (refused, not truncated) */
  maxBytes: number;
  /** per-chunk transfer size (default 8 MiB — half the 16 MiB envelope the
   * sync-back's key-files traffic has always crossed reliably; the t298
   * probe lost 1.6–48 MB per 64 MB transfer, so chunks stay well under) */
  chunkBytes?: number;
  /** attempts per CHUNK (default 3 — a failed chunk re-pays itself, not
   * the whole file) */
  chunkAttempts?: number;
}

export type ChunkedDownloadResult =
  | { ok: true; bytes: number }
  | {
      ok: false;
      /** machine reason — the routes surface it verbatim */
      reason: "absent" | "over-cap" | "stat-failed" | "transfer" | "truncated";
      /** human sentence, safe for the UI */
      message: string;
      /** the cluster-side size when known (over-cap names it) */
      size?: number;
    };

/**
 * t358 — download a (potentially large) remote file in VERIFIED CHUNKS.
 *
 * The t357 field report: a finished real-cluster 2D classification whose
 * every class-average pull failed with the same "the stack may not exist on
 * the cluster" 404. A real 20-round run writes 25–100 MB stacks, and the
 * whole-file `cat` of that size is exactly the t298 loss shape (the receive
 * side silently drops megabytes while reporting success) — a loss that is
 * size-dependent, which means whole-file RETRIES just re-roll the same
 * losing dice. The proven-safe envelope is the sync-back's ≤16 MB key-file
 * traffic; this puller never puts more than 8 MB on the wire at once:
 *
 *   stat → (absent | over-cap answered BEFORE any transfer)
 *   for each chunk: `tail -c +OFF 'path' | head -c N` on a direct pooled
 *   channel, every byte writeSync'd (partial-write-safe), the chunk's byte
 *   account checked against N, up to `chunkAttempts` tries per chunk — a
 *   mid-stream drop costs ONE chunk's re-transfer, not the file's.
 *
 * Chunks run SERIALLY (no parallel channel storms — concurrent load is the
 * documented trigger of the loss). The local file is written progressively;
 * on failure the partial is the CALLER's to destroy (the iteration pipeline
 * already deletes its transient).
 */
export async function remoteChunkedDownload(
  c: RemoteConnection,
  remotePath: string,
  localPath: string,
  opts: ChunkedDownloadOpts
): Promise<ChunkedDownloadResult> {
  const chunkBytes = opts.chunkBytes ?? 8 * 1024 * 1024;
  const attempts = opts.chunkAttempts ?? 3;

  const st = await remoteStatEx(c, remotePath);
  if (st.kind === "absent") {
    return { ok: false, reason: "absent", message: `${remotePath} does not exist on the cluster` };
  }
  if (st.kind === "error") {
    // one breath and a second stat — a pooled client mid-redial answers
    // "error" once; the file may be perfectly there
    await new Promise((r) => setTimeout(r, 400));
    const st2 = await remoteStatEx(c, remotePath);
    if (st2.kind === "absent") {
      return { ok: false, reason: "absent", message: `${remotePath} does not exist on the cluster` };
    }
    if (st2.kind === "ok") {
      return pullChunks(c, remotePath, localPath, st2.size, chunkBytes, attempts, opts.maxBytes);
    }
    // two refusals in a row — the pooled connection may be a zombie (the
    // socket died without ssh2's error/close ever firing; keepalive needs
    // up to 30s to notice). Force a fresh dial and ask ONE more time
    // before sentencing the file.
    dropConnection(c.id);
    const st3 = await remoteStatEx(c, remotePath);
    if (st3.kind === "ok") {
      return pullChunks(c, remotePath, localPath, st3.size, chunkBytes, attempts, opts.maxBytes);
    }
    if (st3.kind === "absent") {
      return { ok: false, reason: "absent", message: `${remotePath} does not exist on the cluster` };
    }
    return {
      ok: false,
      reason: "stat-failed",
      message: `could not stat ${remotePath} on the cluster (${st3.kind === "error" ? st3.message : "stat unavailable"}) — the connection was re-dialed and still refused`,
    };
  }
  return pullChunks(c, remotePath, localPath, st.size, chunkBytes, attempts, opts.maxBytes);
}

async function pullChunks(
  c: RemoteConnection,
  remotePath: string,
  localPath: string,
  size: number,
  chunkBytes: number,
  attempts: number,
  maxBytes?: number
): Promise<ChunkedDownloadResult> {
  const cap = maxBytes ?? Number.MAX_SAFE_INTEGER;
  if (size > cap) {
    return {
      ok: false,
      reason: "over-cap",
      size,
      message: `${remotePath} is ${fmtMb(size)} — above the ${fmtMb(cap)} on-demand transfer cap`,
    };
  }
  mkdirSync(path.dirname(localPath), { recursive: true });
  let pooled = getPooled(c);
  try {
    await pooled.ready;
  } catch (e) {
    return {
      ok: false,
      reason: "transfer",
      message: `the cluster connection is down (${e instanceof Error ? e.message : String(e)})`,
    };
  }

  let fd: number | null = null;
  // one forced re-dial per FILE: a chunk that died with a channel-level
  // error (timeout / channel closed / connection reset) often means the
  // pooled connection is a zombie — the next attempt deserves a fresh
  // socket, not the same corpse (the t346 timeout-streak ladder's doctrine
  // for the direct-channel world)
  let reDialUsed = false;
  try {
    fd = openSync(localPath, "w");
    let done = 0;
    let chunkIndex = 0;
    while (done < size) {
      const want = Math.min(chunkBytes, size - done);
      let landed = -1;
      let lastErr = "";
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 350));
        const r = await pumpChunk(
          pooled,
          remotePath,
          done, // byte offset the chunk starts at
          want,
          (buf, filePos) => writeAllSyncAt(fd!, buf, filePos)
        );
        if (r.ok) {
          landed = want;
          break;
        }
        lastErr = r.message;
        if (
          !reDialUsed &&
          /timed out|channel|connection|reset|ECONN|writeSync/i.test(r.message)
        ) {
          reDialUsed = true;
          dropConnection(c.id);
          // the pooled handle this loop captured is gone — re-fetch so the
          // next attempt rides the fresh connection
          const fresh = getPooled(c);
          try {
            await fresh.ready;
            pooled = fresh;
          } catch {
            /* the fresh dial itself failed — the loop's verdict says so */
          }
        }
      }
      if (landed !== want) {
        return {
          ok: false,
          reason: "truncated",
          size,
          message: `the transfer of ${remotePath} was truncated ${attempts}× in a row (chunk ${chunkIndex + 1}, bytes ${done}–${done + want}${lastErr ? `; ${lastErr}` : ""}) — the cluster wire is dropping data`,
        };
      }
      done += want;
      chunkIndex++;
    }
    return { ok: true, bytes: done };
  } catch (e) {
    return {
      ok: false,
      reason: "transfer",
      message: `the transfer of ${remotePath} failed (${e instanceof Error ? e.message : String(e)})`,
    };
  } finally {
    if (fd != null) {
      try {
        closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

/** One verified chunk: `tail -c +OFF path | head -c N` on a direct pooled
 * channel. The verdict is the BYTE ACCOUNT (written === N) plus the remote
 * pipeline's exit code — head exits 0 only after serving exactly N bytes. */
function pumpChunk(
  pooled: PooledClient,
  remotePath: string,
  offset: number,
  want: number,
  write: (buf: Buffer, filePos: number) => void
): Promise<{ ok: true; written: number } | { ok: false; message: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let written = 0;
    let exited: number | null = null;
    let streamRef: import("ssh2").ClientChannel | null = null;
    // a chunk is ≤8 MB; 50 KB/s floor → ≤170 s, capped at 180 s
    const timeoutMs = Math.max(30_000, Math.min(180_000, want / 25));
    const finish = (r: { ok: true; written: number } | { ok: false; message: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => {
      try {
        streamRef?.close();
      } catch {
        /* ignore */
      }
      finish({ ok: false, message: `chunk timed out after ${Math.round(timeoutMs / 1000)}s` });
    }, timeoutMs);
    const command = `tail -c +${offset + 1} ${shellSingleQuote(remotePath)} | head -c ${want}`;
    pooled.client.exec(command, (err, stream) => {
      if (err) {
        finish({ ok: false, message: err.message });
        return;
      }
      streamRef = stream;
      const errParts: Buffer[] = [];
      stream.stderr?.on("data", (chunk: Buffer) => errParts.push(chunk));
      stream.on("data", (chunk: Buffer) => {
        const at = offset + written; // absolute file position of this chunk byte
        written += chunk.length;
        if (written > want) {
          // more bytes than asked — a corrupted stream (head should cap it)
          try {
            stream.close();
          } catch {
            /* ignore */
          }
          finish({ ok: false, message: "chunk over-ran its byte count" });
          return;
        }
        try {
          write(chunk, at);
        } catch (e) {
          finish({ ok: false, message: `local write failed (${e instanceof Error ? e.message : String(e)})` });
        }
      });
      // 'exit' carries the pipeline's code; 'close' is when no more data
      // can arrive (the t298 discipline) — the verdict waits for close
      stream.on("exit", (code: number | null) => {
        exited = code;
      });
      stream.on("close", () => {
        const stderr = Buffer.concat(errParts).toString("utf8").trim();
        if (written === want && (exited === 0 || exited === null)) {
          finish({ ok: true, written });
        } else {
          finish({
            ok: false,
            message: `chunk read ${written}/${want} bytes${exited != null && exited !== 0 ? `, exit ${exited}` : ""}${
              stderr ? `: ${stderr.slice(0, 160)}` : ""
            }`,
          });
        }
      });
      stream.end();
    });
  });
}

function fmtMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

/** Upload bytes (buffer or local file) to a remote path (parents created).
 *
 * Transfer protocol (Bun-safe): `head -c <N> > path` consumes EXACTLY N
 * bytes from the channel and exits by itself — no client-side EOF needed
 * (ssh2's channel end() is broken under the Bun runtime). head's exit code
 * IS the integrity proof: exit 0 ⇒ exactly N bytes written (a mid-stream
 * channel death leaves head waiting → the exec timeout fires instead).
 */
export async function remoteUpload(
  c: RemoteConnection,
  data: Buffer | string,
  remotePath: string
): Promise<boolean> {
  const dir = path.posix.dirname(remotePath);
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  const mk = await exec(c, `mkdir -p ${shellSingleQuote(dir)}`, { timeoutMs: 15_000 });
  if (mk.error) return false;
  const r = await exec(
    c,
    `head -c ${buf.length} > ${shellSingleQuote(remotePath)}`,
    {
      timeoutMs: Math.max(20_000, Math.min(600_000, buf.length / 25)),
      stdin: buf,
    }
  );
  return !r.error && r.code === 0;
}

/** Local file mtime (for mirror freshness checks); null when absent. */
export function localMtime(file: string): number | null {
  try {
    return existsSync(file) ? statSync(file).mtimeMs : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Small utility shared by probe + remote-run                          */
/* ------------------------------------------------------------------ */

export function shQuote(s: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return shellSingleQuote(s);
}

export { shellSingleQuote as shSingleQuote };
