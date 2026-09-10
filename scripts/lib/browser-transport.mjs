// Task 117 — transport resilience for agent-browser suites (single source).
//
// The qa60/qa61 intermittent channel (two matrix rounds, same slot #5,
// filed as an order-case in Task 116) was forensically reproduced live on
// this box: the failure form is BROWSER TRANSPORT death, not an app bug —
//
//   renderer crash (in progress) → eval exits 1, EMPTY stdout, fast
//   renderer crashed, daemon wedged → the next evals HANG forever (suites
//     only notice via their 120s execSync timeouts — a slow-motion death)
//   daemon fully dead → the next eval AUTO-RELAUNCHES the browser and
//     silently serves a BLANK page — stderr carries the "[agent-browser]
//     launched browser" fingerprint (verified: only the eval that itself
//     triggered the relaunch prints it); return shapes stay legal (numbers
//     read 0, strings read "") so blankness is detectable ONLY via stderr
//   recovery ladder (verified live) → `close` returns fast even on a
//     wedged daemon; `open <url>` relaunches; evals are healthy again
//   page-side throw (NOT transport) → stdout "✗ Evaluation error: ..."
//     — must be passed through untouched, never mistaken for death
//
// makeTransport() wraps exactly one thing — the eval pipe — with:
//   short eval timeouts (15s: a hung eval is a dead eval; suites ran 120s)
//   death detection across all four signatures above
//   one close→open→sentinel recovery, then a retry of the original eval
//   a TAGGED error on double death, so a mid-phase renderer crash reads
//     as "browser transport died twice — renderer crash likely under
//     memory pressure" instead of a cryptic JSON.parse SyntaxError
//
// The sentinel (CRYOFLOW_SENTINEL) verifies recovery actually landed the
// app: an error page (dead port) or about:blank answers "no" and recovery
// is reported as failed rather than retried against garbage.
//
// Scope discipline: only qa60/qa61 ride this module (the filed case).
// The other suites keep their inline evalJs — migrating the fleet is not
// this task. Suites stay independently runnable: the import is relative
// and carries no state across processes.
import { execSync, spawnSync } from "node:child_process";

export const AB = "agent-browser";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const unq = (s) => (s || "").replace(/^"|"$/g, "");

/** recovery-landing check: the app must be the app (title, not error page) */
export const CRYOFLOW_SENTINEL =
  `(() => document.title.includes('CryoFlow') ? 'yes' : 'no')()`;

export function makeTransport({
  url,
  log = () => {},
  evalTimeoutMs = 15_000,
  openTimeoutMs = 45_000,
  sentinelExpr = CRYOFLOW_SENTINEL,
} = {}) {
  if (!url) throw new Error("makeTransport: url is required");
  const stats = { deaths: 0, recoveries: 0, failures: 0 };

  const isEvalErr = (out) => out.startsWith("✗ Evaluation error:");
  // spawnSync single probe — captures BOTH streams: stdout is the data,
  // stderr carries the auto-relaunch fingerprint, exit status the failure
  const rawEvalErr = (expr, timeoutMs) => {
    const sp = spawnSync(`${AB}`, ["eval", "--stdin"], {
      encoding: "utf8", timeout: timeoutMs, input: expr,
    });
    return {
      out: String(sp.stdout || "").trim(),
      err: String(sp.stderr || ""),
      status: sp.status,
      killed: sp.killed === true,
      spawnErr: sp.error ? String(sp.error.message || sp.error) : "",
    };
  };

  const recover = () => {
    // sync blocking sleeps — recover() is sync (evalJs callers are all
    // sync); the promise-based `sleep` would resolve unawaited and the
    // close→open pair would race (live-caught in t117 phase A: open fired
    // ~0ms after close and landed nothing)
    const syncSleep = (s) => { try { execSync(`sleep ${s}`, { timeout: (s + 1) * 1000 }); } catch { /* fine */ } };
    // `close` is fast even on a wedged daemon (verified live); ignore its
    // failures — the open below is the real test
    try { execSync(`${AB} close`, { encoding: "utf8", timeout: 20_000 }); } catch { /* wedged is fine */ }
    syncSleep(0.8);
    execSync(`${AB} open ${url}`, {
      encoding: "utf8", timeout: openTimeoutMs, stdio: ["ignore", "pipe", "ignore"],
    });
    syncSleep(2.5);
    if (sentinelExpr) {
      // the freshly-opened page needs a beat to mount the app; a single
      // read right after open races the title (live-observed: sentinel
      // said "no" on a healthy app) — poll before declaring failure.
      // recover() stays SYNC (evalJs's callers are all sync), so polling
      // sleeps shell out to `sleep` like any other awaited second
      for (let i = 0; i < 5; i++) {
        const s = unq(rawEvalErr(sentinelExpr, 10_000).out);
        if (s === "yes") { stats.recoveries++; return; }
        try { execSync("sleep 1.2", { timeout: 5000 }); } catch { /* fine */ }
      }
      throw new Error(`recovery sentinel says the page is not the app after 5 reads (dead port, blank, or boot failure?)`);
    }
    stats.recoveries++;
  };

  const evalJs = (expr) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      let out = "";
      let died = "";
      const r = rawEvalErr(expr, evalTimeoutMs);
      out = r.out;
      if (r.killed || /timed out|ETIMEDOUT|SIGTERM/i.test(r.spawnErr)) {
        died = `hang (eval killed after ${evalTimeoutMs}ms — wedged daemon on a dead target)`;
      } else if (/launched browser/.test(r.err)) {
        // the eval ITSELF relaunched a dead daemon — stdout is blank-page
        // data with legal shapes (0, ""), untrustworthy regardless
        died = "blank-page relaunch (daemon was dead; stderr launch fingerprint)";
      } else if (r.status !== 0 && (isEvalErr(r.out) || isEvalErr(r.err))) {
        // page-side JS error: the transport is ALIVE — pass the evaluation
        // error text through (spawnSync routes it to STDERR, execSync-era
        // forensics merged the streams; check both before declaring death)
        return isEvalErr(r.out) ? r.out : r.err.trim();
      } else if (r.status !== 0) {
        died = `exit ${r.status} without an evaluation error (${(r.spawnErr || r.err || "no stderr").slice(0, 120)})`;
      } else if (out === "" || out === '""') {
        died = "silent-empty (exit 0 but nothing on stdout)";
      }
      if (!died) return out;
      stats.deaths++;
      log(`  TRANSPORT-DEATH (${attempt}/2): ${died}`);
      if (attempt === 2) {
        stats.failures++;
        throw new Error(
          `browser transport died twice — renderer crash likely under memory pressure; phase state lost, rerun solo to confirm (last form: ${died})`,
        );
      }
      try {
        recover();
        log("  TRANSPORT-RECOVER: close→open ladder landed the app, retrying eval");
      } catch (e) {
        stats.failures++;
        throw new Error(
          `browser transport unrecoverable: recovery ladder failed (${String(e.message || e).slice(0, 160)})`,
        );
      }
    }
  };

  const J = (expr) => JSON.parse(unq(evalJs(expr)));
  return { evalJs, J, recover, stats, rawEvalErr };
}
