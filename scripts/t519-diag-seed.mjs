/** t519 diag — reproduce the seed's first steps with full observability. */
import { spawnSync } from "node:child_process";

const ROOT = "/home/z/cryoffow";
const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

const client = (cmd) => {
  const r = spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT, encoding: "utf8", timeout: 60_000,
  });
  console.log("client status:", r.status, "signal:", r.signal, "err:", r.error?.message);
  console.log("client stderr:", (r.stderr || "").slice(0, 300));
  console.log("client stdout:", (r.stdout || "").slice(0, 120));
  return r.stdout?.trim() ?? "";
};

console.log("step 1: mkdir fixture");
client("mkdir -p /data2/t519diag && echo diag-marker > /data2/t519diag/here.txt && cat /data2/t519diag/here.txt");

console.log("\nstep 2: connection");
const conn = await api("/api/remote/connections", {
  method: "POST", headers: SHJ,
  body: JSON.stringify({
    id: "qa-t474ui", name: "QA t474 UI", host: "127.0.0.1", port: 3022,
    username: "cryo", password: "demo", authMethod: "password",
    remoteRoot: "/projects/cryoflow",
  }),
});
console.log("conn:", conn.status, JSON.stringify(conn.body).slice(0, 150));
