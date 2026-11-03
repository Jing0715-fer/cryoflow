// t873-wedge-probe.mjs — the decisive wedge experiment against the mock cluster.
// Scenario: one pooled SSH connection; exec a SLOW script; close the channel
// mid-run (what rawExec's timeout does); then exec `echo probe-alive` on the
// SAME connection. If the echo never lands, the mock wedges the connection
// after a mid-run channel close — the finalize's death spiral explained.
import { Client } from "ssh2";
import { readFileSync } from "fs";

const cfg = {
  host: "127.0.0.1",
  port: 3022,
  username: "cryo",
  password: "demo",
};

const conn = new Client();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const done = (code, note) => { log("PROBE-EXIT", code, note); conn.end(); process.exit(code); };
const fail = setTimeout(() => done(3, "overall probe timeout (30s) — WEDGE CONFIRMED if echo pending"), 30_000);

conn.on("ready", () => {
  log("connected");
  const slow = "set -u; cd /home/z/my-project/services/mock-cluster/fs/projects/cryoflow/cmvxz96kf0000no9k5vb87i0b/class2d_fi85zu4c 2>/dev/null || exit 0; for i in 1 2 3 4 5 6 7 8 9 10; do head -c 200 run_model.star >/dev/null 2>&1; sleep 1; done; echo SLOW-DONE";
  conn.exec(slow, (err, s) => {
    if (err) return done(2, "exec1 err " + err.message);
    let out1 = "";
    s.on("data", (c) => (out1 += c));
    // close the channel mid-run after 3s — the rawExec timeout's exact move
    setTimeout(() => {
      log("closing channel mid-run (the timeout's move)");
      try { s.close(); } catch (e) { log("close err", e.message); }
      // then the NEXT exec on the SAME pooled connection — the finalize's next step
      setTimeout(() => {
        log("issuing echo probe on the SAME connection");
        conn.exec("echo probe-alive", (err2, s2) => {
          if (err2) return done(2, "exec2 err " + err2.message);
          let out2 = "";
          s2.on("data", (c) => (out2 += c.toString()));
          s2.on("exit", () => {
            clearTimeout(fail);
            log("echo answered:", JSON.stringify(out2.trim()));
            done(out2.includes("probe-alive") ? 0 : 4, out2.includes("probe-alive") ? "NO WEDGE — the connection survives a mid-run channel close" : "echo answered WRONG");
          });
        });
      }, 1500);
    }, 3000);
  });
});
conn.on("error", (e) => done(2, "conn err " + e.message));
conn.connect(cfg);
