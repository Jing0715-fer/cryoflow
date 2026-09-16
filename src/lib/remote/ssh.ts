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
 * Every connection has a serialized command queue (clusters hate concurrent
 * exec storms); fire-and-forget callers can use tryExec() which declines
 * politely while a command is in flight (the poll sweep just keeps its
 * previous state — the next tick re-polls).
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from "fs";
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
  };
  const auth = authConfig(c);
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
      keepaliveInterval: 15_000,
      keepaliveCountMax: 4,
    };
    if (auth.type === "agent" && auth.agent) {
      cfg.agent = auth.agent;
      cfg.username = auth.username;
    } else if (auth.type === "publickey" && auth.privateKey) {
      cfg.username = auth.username;
      cfg.privateKey = auth.privateKey;
      if (auth.passphrase) cfg.passphrase = auth.passphrase;
    } else {
      cfg.username = auth.username;
      cfg.password = auth.password ?? "";
      cfg.tryKeyboard = true;
    }
    client
      .on("ready", () => {
        clearTimeout(timeout);
        settleReady();
      })
      .on("error", (err: Error) => {
        clearTimeout(timeout);
        pooled.lastError = err.message;
        pool.delete(c.id);
        failReady(err);
      })
      .on("close", () => {
        pool.delete(c.id);
      })
      .connect(cfg as Parameters<Client["connect"]>[0]);
    // keyboard-interactive continuation (very common on HPC one-time codes).
    // Not in @types/ssh2's event union — attached through a string-typed shim.
    type AnyEmitter = { on(evt: string, fn: (...args: never[]) => void): void };
    (client as unknown as AnyEmitter).on("keyboard-interactive", (...args: never[]) => {
      const prompts = args[3] as { text: string }[];
      const finish = args[4] as (answers: string[]) => void;
      // answer every prompt with the configured password — MFA beyond that
      // is out of scope and fails honestly
      finish(prompts.map(() => authConfig(c).password ?? ""));
    });
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

/* ------------------------------------------------------------------ */
/* File helpers (exec-based — no SFTP dependency)                      */
/* ------------------------------------------------------------------ */

/** mkdir -p on the remote side. */
export async function remoteMkdir(c: RemoteConnection, dir: string): Promise<void> {
  await exec(c, `mkdir -p ${shellSingleQuote(dir)}`, { timeoutMs: 15_000 });
}

/** Remote file existence + size (null = absent). */
export async function remoteStat(
  c: RemoteConnection,
  file: string
): Promise<{ size: number; mtimeMs: number } | null> {
  const r = await exec(
    c,
    `stat -c '%s %Y' ${shellSingleQuote(file)} 2>/dev/null || echo MISSING`,
    { timeoutMs: 10_000 }
  );
  if (r.error || r.code !== 0) return null;
  const m = /^(\d+) (\d+)\s*$/.exec(r.stdout.trim());
  return m ? { size: Number(m[1]), mtimeMs: Number(m[2]) * 1000 } : null;
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
    const finish = (v: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(v);
    };
    const ws = createWriteStream(localPath);
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
        ws.write(chunk);
      });
      stream.on("exit", () => {
        ws.end(() => finish(written));
      });
      stream.on("close", () => {
        ws.end(() => finish(written > 0 ? written : null));
      });
    });
  });
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
