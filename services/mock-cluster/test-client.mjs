#!/usr/bin/env node
/**
 * Minimal SSH client for testing the CryoFlow mock cluster — no system
 * ssh/sshpass required (uses the same ssh2 package the server uses).
 *
 *   node test-client.mjs                                     # full self-test suite
 *   node test-client.mjs 'uname -a && module avail relion'   # run one command
 *   node test-client.mjs --shell [script]                    # shell channel
 *
 * Connection: 127.0.0.1:3022, user cryo / password demo.
 */

import ssh2 from "ssh2";

const { Client } = ssh2;

const HOST = process.env.MOCK_CLUSTER_HOST ?? "127.0.0.1";
const PORT = Number(process.env.MOCK_CLUSTER_PORT ?? 3022);
const USERNAME = "cryo";
const PASSWORD = "demo";

function connect({ password = PASSWORD } = {}) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const onErr = (err) => {
      conn.removeListener("ready", onReady);
      reject(err);
    };
    const onReady = () => {
      conn.removeListener("error", onErr);
      resolve(conn);
    };
    conn.once("error", onErr);
    conn.once("ready", onReady);
    conn.connect({ host: HOST, port: PORT, username: USERNAME, password, readyTimeout: 10000 });
  });
}

/** exec a command; resolves { code, signal, stdout, stderr }. */
function exec(conn, cmd, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`exec timed out after ${timeoutMs}ms: ${cmd}`)),
      timeoutMs
    );
    timer.unref?.();
    conn.exec(cmd, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }
      let stdout = "";
      let stderr = "";
      let code = null;
      let signal = null;
      stream.on("data", (d) => { stdout += d.toString("utf8"); });
      stream.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
      stream.on("exit", (c, sig) => { code = c; signal = sig ?? null; });
      stream.on("close", () => {
        clearTimeout(timer);
        resolve({ code, signal, stdout, stderr });
      });
    });
  });
}

/** exec a command and send it an SSH signal shortly after it starts. */
function execWithSignal(conn, cmd, signalName, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`signal test timed out: ${cmd}`)),
      timeoutMs
    );
    timer.unref?.();
    conn.exec(cmd, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }
      let stdout = "";
      let stderr = "";
      let code = null;
      let signal = null;
      stream.on("data", (d) => { stdout += d.toString("utf8"); });
      stream.stderr.on("data", (d) => { stderr += d.toString("utf8"); });
      stream.on("exit", (c, sig) => { code = c; signal = sig ?? null; });
      stream.on("close", () => {
        clearTimeout(timer);
        resolve({ code, signal, stdout, stderr });
      });
      setTimeout(() => stream.signal(signalName), 300).unref?.();
    });
  });
}

/** open a shell channel, feed a script, collect all output. */
function shell(conn, script, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("shell test timed out")), timeoutMs);
    timer.unref?.();
    conn.shell((err, stream) => {
      if (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }
      let output = "";
      stream.on("data", (d) => { output += d.toString("utf8"); });
      stream.stderr.on("data", (d) => { output += d.toString("utf8"); });
      stream.on("close", () => {
        clearTimeout(timer);
        resolve(output);
      });
      stream.end(`${script}\nexit\n`);
    });
  });
}

// ---------------------------------------------------------------------------
// Self-test suite
// ---------------------------------------------------------------------------

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  FAIL  ${name}\n        ${err?.message ?? err}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function selfTest() {
  console.log(`mock-cluster self-test → ${USERNAME}@${HOST}:${PORT}`);

  let conn;
  await step("connect (password auth)", async () => {
    conn = await connect();
  });

  if (!conn) {
    console.log("cannot continue without a connection");
    process.exit(1);
  }

  await step("exec: uname + module avail", async () => {
    const r = await exec(conn, "uname -a && module avail relion");
    assert(r.code === 0, `exit code ${r.code}, stderr: ${r.stderr}`);
    assert(/Linux|Darwin/.test(r.stdout), `no uname output: ${JSON.stringify(r.stdout)}`);
    assert(
      r.stderr.includes("relion/5.0.1") &&
        r.stderr.includes("relion/4.4.1") &&
        r.stderr.includes("relion/5.0-beta"),
      `module list wrong on stderr: ${JSON.stringify(r.stderr)}`
    );
  });

  await step("exec: login shell (bash -lc) finds module", async () => {
    const r = await exec(conn, "bash -lc 'command -v module && module avail relion 2>&1'");
    assert(r.code === 0, `exit code ${r.code}: ${r.stdout} ${r.stderr}`);
    assert(/\/module$/.test(r.stdout.trim().split("\n")[0] ?? ""), `module not found first: ${JSON.stringify(r.stdout)}`);
    assert(r.stdout.includes("relion/5.0.1"), `no module list: ${JSON.stringify(r.stdout)}`);
  });

  await step("module load + list + purge", async () => {
    const load = await exec(conn, "module load relion/5.0.1 && module list");
    assert(load.code === 0, `load failed: ${load.stderr}`);
    assert(load.stdout.includes("1) relion/5.0.1"), `list wrong: ${JSON.stringify(load.stdout)}`);
    const purge = await exec(conn, "module purge && module list");
    assert(purge.stdout.includes("No modules loaded"), `purge failed: ${JSON.stringify(purge.stdout)}`);
  });

  await step("unknown module → Lmod-style error, rc=1", async () => {
    const r = await exec(conn, "module load relion/nope; echo rc=$?");
    assert(/rc=1/.test(r.stdout), `rc wrong: ${JSON.stringify(r.stdout)}`);
    assert(r.stderr.includes("Unknown module: relion/nope"), `stderr wrong: ${JSON.stringify(r.stderr)}`);
  });

  await step("module help", async () => {
    const r = await exec(conn, "module help");
    assert(r.code === 0 && r.stdout.includes("Version 8.3 (mock)"), `help wrong: ${JSON.stringify(r.stdout)}`);
  });

  await step("exit code propagation (exit 42)", async () => {
    const r = await exec(conn, "exit 42");
    assert(r.code === 42, `expected 42, got ${r.code}`);
  });

  await step("PATH has mock + relion dirs (login shell)", async () => {
    const r = await exec(conn, "bash -lc 'echo $PATH'");
    assert(r.stdout.includes("/opt/bin"), `mock bin missing: ${r.stdout}`);
    assert(r.stdout.includes("/home/z/relion-build/bin"), `relion bin missing: ${r.stdout}`);
  });

  await step("HOME is the mock home", async () => {
    const r = await exec(conn, "bash -lc 'echo $HOME; cd ~ && pwd'");
    assert(r.stdout.trim().endsWith("/fs/home/cryo"), `HOME wrong: ${JSON.stringify(r.stdout)}`);
  });

  await step("path translation + background job + CRYOFLOW_PID", async () => {
    const clear = await exec(conn, "rm -rf /projects/cryoflow/t1");
    assert(clear.code === 0, `cleanup failed: ${clear.stderr}`);
    const r = await exec(
      conn,
      'mkdir -p /projects/cryoflow/t1 && cd /projects/cryoflow/t1 && setsid bash -c "sleep 2; echo done > out.txt" > run.out 2> run.err < /dev/null & echo CRYOFLOW_PID:$!'
    );
    assert(r.code === 0, `bg launch rc=${r.code}: ${r.stderr}`);
    assert(/CRYOFLOW_PID:\d+/.test(r.stdout), `no pid: ${JSON.stringify(r.stdout)}`);
    const check = await exec(conn, "sleep 3; cat /projects/cryoflow/t1/out.txt", { timeoutMs: 30000 });
    assert(check.code === 0, `cat rc=${check.code}: ${check.stderr}`);
    assert(check.stdout.trim() === "done", `out.txt wrong: ${JSON.stringify(check.stdout)}`);
    const logs = await exec(conn, "cat /projects/cryoflow/t1/run.err; wc -c < /projects/cryoflow/t1/run.out");
    assert(logs.stdout.trim() === "0", `run.err/run.out not clean: ${JSON.stringify(logs.stdout)}${logs.stderr}`);
  });

  await step("signal forwarding (SIGTERM kills foreground sleep)", async () => {
    const r = await execWithSignal(conn, "exec sleep 30", "TERM", { timeoutMs: 10000 });
    assert(r.signal === "TERM" || (r.code === null && !r.stdout), `sleep not killed: ${JSON.stringify(r)}`);
  });

  await step("foreground command cleaned up on connection drop (SIGHUP)", async () => {
    const connA = await connect();
    const dangling = exec(connA, "exec sleep 45", { timeoutMs: 60000 });
    dangling.catch(() => {}); // abandoned on purpose — never resolves
    await sleep(700); // let the sleep actually start
    connA.end(); // drop the connection like a network cut
    await sleep(700); // give the server a moment to deliver SIGHUP
    const r = await exec(conn, "pgrep -f '[s]leep 45' >/dev/null && echo ALIVE || echo GONE");
    assert(r.stdout.includes("GONE"), `foreground sleep survived the disconnect: ${r.stdout}`);
  });

  await step("shell channel", async () => {
    const out = await shell(conn, "echo hello-from-shell");
    assert(out.includes("hello-from-shell"), `shell output wrong: ${JSON.stringify(out)}`);
  });

  await step("sftp refused", async () => {
    const failure = await new Promise((resolve) => {
      conn.sftp((err) => resolve(!err ? new Error("sftp unexpectedly worked") : null));
    });
    if (failure) throw failure;
  });

  conn.end();

  await step("wrong password rejected", async () => {
    try {
      const c2 = await connect({ password: "wrong" });
      c2.end();
      throw new Error("server accepted a wrong password");
    } catch (err) {
      assert(/auth|authentication|failed/i.test(err?.message ?? ""), `unexpected error: ${err?.message}`);
    }
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
  if (failed.length > 0) process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
if (argv[0] === "--shell") {
  const script = argv.slice(1).join(" ") || "echo hello-from-shell";
  const conn = await connect();
  const out = await shell(conn, script, { timeoutMs: 30000 });
  conn.end();
  process.stdout.write(out);
} else if (argv.length > 0) {
  const cmd = argv.join(" ");
  const conn = await connect();
  const r = await exec(conn, cmd, { timeoutMs: 120000 });
  conn.end();
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  if (r.code !== null && r.code !== 0) process.exitCode = r.code;
} else {
  await selfTest();
}
