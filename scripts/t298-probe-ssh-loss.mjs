// t298 probe — is the mock's exec `cat` lossy for a 64 MB stream?
// Direct ssh2 client, ten runs, byte count + sha256 each. Isolates the SSH
// transfer layer from the app's remoteDownload handling. Forensic tool for
// Task 298's verdict: with the ORIGINAL mock (pipe + close on readable end)
// 10/10 runs lost 1.6–48 MB with exit=0; with the write-callback pump all
// runs are byte-exact. Requires a t298 mid-suite world (the planted twin) —
// self-exits otherwise.
import { Client } from "ssh2";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Socket } from "node:net";
import { existsSync, statSync, readdirSync } from "node:fs";

const MOCK_PORT = 3022;
const FS_ROOT = "/home/z/my-project/services/mock-cluster/fs/projects/cryoflow";
const EXPECT = 67109888;
const RUNS = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// find the planted twin (any ctffind_* workdir holding the 64 MB map)
function findTwin() {
  try {
    for (const proj of readdirSync(FS_ROOT)) {
      for (const job of readdirSync(`${FS_ROOT}/${proj}`)) {
        const p = `${FS_ROOT}/${proj}/${job}/run_it003_class001.mrc`;
        if (existsSync(p) && statSync(p).size === EXPECT) return `/projects/cryoflow/${proj}/${job}/run_it003_class001.mrc`;
      }
    }
  } catch { /* no fs yet */ }
  return null;
}

function mockListening() {
  return new Promise((resolve) => {
    const sock = new Socket();
    const done = (ok) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(1500);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(MOCK_PORT, "127.0.0.1");
  });
}

const REMOTE_PATH = findTwin();
if (!REMOTE_PATH) {
  console.log("no planted 64MB twin on the mock fs — run t298's plant phase first (or mid-suite)");
  process.exit(1);
}
console.log(`twin on disk: ${statSync(`/home/z/my-project/services/mock-cluster/fs${REMOTE_PATH}`).size} bytes`);

if (!(await mockListening())) {
  execSync("bash services/mock-cluster/launch.sh", { cwd: "/home/z/my-project", stdio: "pipe" });
  for (let i = 0; i < 20 && !(await mockListening()); i++) await sleep(500);
}
console.log("mock up on :3022");

function oneRun(n) {
  return new Promise((resolve) => {
    const conn = new Client();
    const t0 = Date.now();
    let written = 0;
    const hash = createHash("sha256");
    let exitCode = null;
    const done = (verdict) => {
      try { conn.end(); } catch { /* ignore */ }
      resolve({ n, ms: Date.now() - t0, ...verdict });
    };
    conn.on("error", (e) => done({ error: String(e) }));
    conn
      .on("ready", () => {
        conn.exec(`cat ${REMOTE_PATH}`, (err, stream) => {
          if (err) return done({ error: err.message });
          stream.on("data", (chunk) => { written += chunk.length; hash.update(chunk); });
          stream.stderr.on("data", () => {});
          stream.on("exit", (code) => { exitCode = code; });
          stream.on("close", () => {
            done({ written, sha: hash.digest("hex").slice(0, 12), exitCode });
          });
        });
      })
      .connect({
        host: "127.0.0.1",
        port: MOCK_PORT,
        username: "cryo",
        password: "demo",
        readyTimeout: 10_000,
      });
  });
}

const results = [];
for (let i = 1; i <= RUNS; i++) results.push(await oneRun(i));

let bad = 0;
for (const r of results) {
  const okFull = r.written === EXPECT && r.exitCode === 0;
  if (!okFull) bad++;
  console.log(
    `run ${String(r.n).padStart(2)}: ${okFull ? "ok " : "BAD"} written=${r.written ?? "?"} exit=${r.exitCode} ` +
    `${r.ms}ms sha=${r.sha ?? r.error ?? "-"}${r.written !== EXPECT ? ` (missing ${EXPECT - (r.written ?? 0)})` : ""}`
  );
}
console.log(bad === 0 ? `PROBE: all ${RUNS} runs byte-exact — the SSH layer delivers whole` : `PROBE: ${bad}/${RUNS} runs LOST DATA — the exec cat is lossy for big streams`);
process.exit(0);
