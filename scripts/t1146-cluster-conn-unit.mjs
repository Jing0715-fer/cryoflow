#!/usr/bin/env node
/**
 * t1146 — THE CLUSTER-CONN IDENTITY unit: the t894 doctor carried the
 * world's one Cluster connection as a hardcoded id, and every epoch that
 * re-minted the connection (a recycle, a re-heal) taxed a window with a
 * manual re-key (the chain: conn-mv6a23lx → conn-mvwf4vla → conn-mvy782td
 * → conn-mvz6i8yv). The cure: the id is an accident of minting; the
 * IDENTITY (the healer's own creation spec — the mock Slurm listener on
 * the loopback) is the world's actual fact. The brain moved to
 * scripts/cluster-conn.mjs (ONE father, pure, no fs/fetch/process), the
 * doctor rides it, and an epoch that changes the IDENTITY edits
 * MOCK_CLUSTER_SPEC in ONE place — this seat REDs if the instruments
 * drift apart.
 *
 * A — the resolution brain run FOR REAL (the decision table):
 *   identity match, the last-match determinism, the stranger family
 *   (name/host/port), the junk-row immunity, the honest absences.
 * B — the binding verdict: the doctor's three-way extracted verbatim
 *   (sound / stomped / unplanted), each arm's precondition pinned.
 * C — the fathers source-pinned: the doctor imports BOTH fathers and no
 *   longer carries a hardcoded CLUSTER_CONN id; the spec's identity is
 *   the healer's own creation spec (the instruments cannot drift).
 *
 * node scripts/t1146-cluster-conn-unit.mjs   (bare node — the brain is
 * a scripts/-module .mjs with zero deps; no jiti alias needed)
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveClusterConnId, clusterBindingVerdict, MOCK_CLUSTER_SPEC } from "./cluster-conn.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "  ok" : "  FAIL"}: ${label}${cond ? "" : ` — ${extra}`}`);
  if (cond) pass++;
  else fail++;
};

/* ---------- A. the resolution brain, run FOR REAL ---------- */

const row = (id, over = {}) => ({ id, name: "Mock Cluster", host: "127.0.0.1", port: 3022, ...over });

ok("A1 the identity match resolves the connection's id",
  resolveClusterConnId([row("conn-aaa")]) === "conn-aaa");

ok("A2 multiple matches fall to the array's LAST (the house determinism law)",
  resolveClusterConnId([row("conn-old"), row("conn-mid"), row("conn-new")]) === "conn-new");

ok("A3 a same-name stranger on ANOTHER HOST is not this world's anchor",
  resolveClusterConnId([row("conn-x", { host: "10.0.0.8" })]) === null);

ok("A4 a same-name stranger on ANOTHER PORT is not this world's anchor",
  resolveClusterConnId([row("conn-x", { port: 3023 })]) === null);

ok("A5 the name compares EXACTLY (a lowercase stranger is a stranger)",
  resolveClusterConnId([row("conn-x", { name: "mock cluster" })]) === null);

ok("A6 the port compares as a NUMBER after coercion (a JSON string port matches)",
  resolveClusterConnId([row("conn-x", { port: "3022" })]) === "conn-x");

ok("A7 a non-finite port never matches (NaN is not a door)",
  resolveClusterConnId([row("conn-x", { port: "slurm" })]) === null);

ok("A8 junk rows are skipped, never a throw (null, numbers, id-less rows)",
  resolveClusterConnId([null, 42, { name: "Mock Cluster" }, row("conn-ok")]) === "conn-ok");

ok("A9 an empty roster resolves to the honest absence (the re-plant precondition)",
  resolveClusterConnId([]) === null);

ok("A10 a foreign roster shape (null/object/string) is the honest absence, never a throw",
  resolveClusterConnId(null) === null &&
  resolveClusterConnId({ connections: [row("conn-x")] }) === null &&
  resolveClusterConnId("Mock Cluster") === null);

ok("A11 a custom spec rides the same brain (the mock-cluster harness world: name+host+port all honored)",
  resolveClusterConnId([{ id: "conn-h", name: "Mini HPC", host: "127.0.0.1", port: 2222 }],
    { name: "Mini HPC", host: "127.0.0.1", port: 2222 }) === "conn-h" &&
  resolveClusterConnId([{ id: "conn-h", name: "Mini HPC", host: "127.0.0.1", port: 2222 }],
    { name: "Mini HPC", host: "127.0.0.1", port: 3022 }) === null);

/* ---------- B. the binding verdict (the doctor's three-way, verbatim) ---------- */

ok("B1 the binding IS the Cluster → sound (nothing to do)",
  clusterBindingVerdict("conn-c1", "conn-c1") === "sound");

ok("B2 a Cluster exists but the binding holds null → stomped (tonight's own finding: the untracked registry rewritten behind the world's back)",
  clusterBindingVerdict(null, "conn-c1") === "stomped");

ok("B3 a Cluster exists but the binding holds a FOREIGN id → stomped (the heal verb applies)",
  clusterBindingVerdict("conn-old", "conn-c1") === "stomped");

ok("B4 the world plants NO Cluster → unplanted (re-plant before riding remote — there is no id to bind TO, whatever the binding holds)",
  clusterBindingVerdict("conn-old", null) === "unplanted" &&
  clusterBindingVerdict(null, null) === "unplanted");

ok("B5 the verdict is TOTAL (every combination lands in exactly one arm)",
  [["c", "c"], [null, "c"], ["old", "c"], ["c", null], [null, null]]
    .every(([a, c]) => ["sound", "stomped", "unplanted"].includes(clusterBindingVerdict(a, c))));

/* ---------- C. the fathers source-pinned (the drift law) ---------- */

const doctor = readFileSync(join(here, "t894-window-start-sweep.mjs"), "utf8");
const healer = readFileSync(join(here, "demo-chain-resurrect.mjs"), "utf8");

ok("C1 the doctor imports BOTH fathers (the ONE-father law at the door)",
  doctor.includes('from "./cluster-conn.mjs"') &&
  doctor.includes("resolveClusterConnId") &&
  doctor.includes("clusterBindingVerdict"));

ok("C2 the doctor no longer carries a hardcoded CLUSTER_CONN id (the re-key chore class is dead)",
  !/const CLUSTER_CONN\s*=\s*"conn-/.test(doctor));

ok("C3 the doctor's spec IS the module's MOCK_CLUSTER_SPEC (no second identity born)",
  /MOCK_CLUSTER_SPEC/.test(doctor));

ok("C4 the spec's identity is the healer's own creation spec (the world's actual fact — a healer rename REDs this seat)",
  MOCK_CLUSTER_SPEC.name === "Mock Cluster" &&
  MOCK_CLUSTER_SPEC.host === "127.0.0.1" &&
  Number(MOCK_CLUSTER_SPEC.port) === 3022 &&
  healer.includes('"Mock Cluster"'));

ok("C5 the epoch chain survives as archaeology in BOTH files (the law's own history is the comment's burden)",
  /conn-mvy782td/.test(doctor) && /conn-mv6a23lx/.test(doctor) &&
  /conn-mvy782td/.test(readFileSync(join(here, "cluster-conn.mjs"), "utf8")));

ok("C6 the brain stays pure (no fs, no fetch, no process — the store is a parameter)",
  !/require\(|readFileSync|fetch\(|process\.env/.test(
    readFileSync(join(here, "cluster-conn.mjs"), "utf8").split("*/").slice(1).join("*/")
  ));

/* ---------- receipt ---------- */
console.log(`\nCLUSTER-CONN-UNIT t1146: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
