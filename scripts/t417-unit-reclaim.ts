/**
 * t417 unit suite — the reclaim-target judgment (pure logic, no server,
 * no cluster). Run: bun run scripts/t417-unit-reclaim.ts
 *
 * These cover the parts of DELETE /api/projects/[id] where a bug EATS
 * DATA: the traversal guard, the one-segment-deep local root, the
 * witness dedup, the tilde refusal. The route's IO (SSH rm, tilde
 * expansion) is verified live once the next build window lands the fix.
 *
 * SECOND WRITING: the first copy of this suite (and everything else in
 * the t417 window) died in the 04:14 sandbox reboot — the box restores
 * from a stale repo.tar and any uncommitted byte is lost. ALL PASS 24/24
 * before the fall; re-verified after the re-write.
 */

import {
  isReclaimSafeId,
  localReclaimRootFor,
  collectMirrorTargets,
  mirrorDirFor,
} from "../src/lib/remote/reclaim-targets";

let fail = 0;
const must = (cond: boolean, label: string) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const RELION_DIR = "/home/z/my-project/data/relion";
const PID = "cmukm554t000nk62dn6a5282f";

/* ---- the id guard ---------------------------------------------------- */
must(isReclaimSafeId(PID), "cuid-shaped id passes");
must(isReclaimSafeId("ck396proj000000000000000001"), "fixture-shaped id passes");
must(!isReclaimSafeId("../etc"), "traversal via .. refused");
must(!isReclaimSafeId("a/b"), "path separator refused");
must(!isReclaimSafeId(".."), "bare .. refused");
must(!isReclaimSafeId(""), "empty id refused");
must(!isReclaimSafeId("a\tb"), "control char refused");
must(!isReclaimSafeId("日本"), "non-ascii refused");

/* ---- the local root ---------------------------------------------------- */
must(
  localReclaimRootFor(PID, RELION_DIR) === `${RELION_DIR}/${PID}`,
  "local root is exactly one segment deep"
);
must(localReclaimRootFor("", RELION_DIR) === null, "empty id reclaims NOTHING");
must(
  localReclaimRootFor("../etc", RELION_DIR) === null,
  "traversal id reclaims nothing"
);
must(
  localReclaimRootFor(PID, RELION_DIR + "/") === `${RELION_DIR}/${PID}`,
  "trailing-slash relionDir tolerated"
);
must(
  localReclaimRootFor("x", "/") === null,
  "root-level relionDir (pathological) reclaims NOTHING"
);

/* ---- mirror targets: the records witness -------------------------------- */
const rec = (projectId: string, remoteRoot: string, host = "localhost:3022", connectionId = "conn-1") => ({
  projectId,
  remote: { connectionId, host, remoteRoot },
});
const t1 = collectMirrorTargets(PID, [rec(PID, "/projects/cryoflow")], null);
must(t1.length === 1, "one record witness → one target");
must(t1[0].remoteRoot === "/projects/cryoflow", "root as recorded");
must(t1[0].connectionId === "conn-1", "connection id carried for resolution");
must(t1[0].host === "localhost:3022", "host carried for same-host re-creation");

const t2 = collectMirrorTargets(
  PID,
  [
    rec(PID, "/projects/cryoflow/"),
    rec(PID, "/projects/cryoflow", "localhost:3022", "conn-1"),
    rec("other-project", "/projects/cryoflow"),
    { projectId: PID, remote: null },
    { projectId: PID },
  ],
  null
);
must(t2.length === 1, "dedup: trailing slash + repeat + other-project + no-remote → one target");

const t3 = collectMirrorTargets(
  PID,
  [rec(PID, "/clusters/a", "h1:22", "c1"), rec(PID, "/clusters/b", "h2:22", "c2")],
  null
);
must(t3.length === 2, "two distinct roots → two targets (rm each)");

/* ---- mirror targets: the bound-connection fallback ----------------------- */
const t4 = collectMirrorTargets(PID, [], {
  id: "conn-9",
  host: "cluster",
  port: 3022,
  remoteRoot: "/projects/cryoflow",
});
must(t4.length === 1, "records all dead → bound connection still names the mirror");
must(t4[0].host === "cluster:3022", "bound host:port reconstructed");

const t5 = collectMirrorTargets(PID, [], {
  id: "conn-9",
  host: "cluster",
  port: 3022,
  remoteRoot: "~/cryoflow",
});
must(t5.length === 0, "tilde root unexpanded → SKIPPED, never guessed");

const t6 = collectMirrorTargets(
  PID,
  [rec(PID, "/projects/cryoflow", "localhost:3022", "conn-1")],
  { id: "conn-1", host: "localhost", port: 3022, remoteRoot: "/projects/cryoflow" }
);
must(t6.length === 1, "record + bound agreeing → ONE rm, not two");

/* ---- the mirror dir ------------------------------------------------------ */
must(
  mirrorDirFor({ connectionId: "c", host: "h", remoteRoot: "/projects/cryoflow" }, PID) ===
    `/projects/cryoflow/${PID}`,
  "mirror dir is remoteRoot/<projectId> — the twin convention one level up"
);

console.log(fail === 0 ? "\nALL PASS" : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
