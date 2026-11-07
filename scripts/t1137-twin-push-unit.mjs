#!/usr/bin/env node
// t1137-twin-push-unit.mjs — the twin-refresh push leg, the census's
// 75th instrument.
//
// THE LAW (the sync door's reverse face): the t424 sync route brings
// cluster bytes home; the t1137 push leg is its PUSH direction — an
// app-side native's fresh book (the engine's local lane writes under
// RELION_DIR) refreshes the CLUSTER twin its world carries. The seeder's
// stale twin (select's `particles_select.star` cluster-side, 96 rows of
// the t1135 two-dot tilt) is the door's reason: a fossil retires through
// a WRITER (the product's own remoteUpload, head -c integrity), never a
// hand edit. The sync policy's caps/budgets apply in REVERSE: the
// app-side book is metadata — STAR/log/text push, image stacks NEVER
// (the t339 loophole walked backwards) — under "everything" the text
// gate lifts and the caps speak alone. The address is the t396
// deterministic formula (a fact about the JOB), never client-supplied;
// the connection is a WITNESS question (explicit id, else the project's
// most recent remote-run sibling).
//
// This instrument pins, in seven bands:
//   A. the PURE classification — the exact verdicts planPush speaks
//      (take/skip, the budget arithmetic, the policy split);
//   B. the honest words — describePushSkip's three whys verbatim, the
//      law's name in the binary-book word;
//   C. the ONE grammar — push-policy imports the sync-policy's own
//      KEY_TEXT_EXT (one extension family, both directions) and
//      twin-push re-exports the ONE plan (no forked classification);
//   D. the twin formula's wiring — remoteWorkdirForJob's byte-parity on
//      the world's own select job (the address the fossil sits at);
//   E. the witness resolution — the live world's sibling-run witness
//      (motioncorr's remote state), the explicit override, the honest
//      null for a project with no cluster home;
//   F. the live world's twin face — the fossil stands (96 corrupt cells
//      cluster-side), the local book speaks valid floats, the derived
//      twin address names the real cluster dir;
//   G. the route's door sites — the route imports the lib's ONE loop
//      (no second classification), the family hardening (isLocalRequest,
//      the chunk cap, the hygiene), and the honest-word log line.

import { readFileSync, existsSync } from "fs";
import { planPush, describePushSkip } from "@/lib/remote/push-policy";
import {
  resolvePushWitness,
  twinWorkdirFor,
  pushPolicyContext,
  pushPathRejected,
} from "@/lib/remote/twin-push";
import { remoteWorkdirForJob } from "@/lib/relion/workdir";
import { KEY_TEXT_EXT } from "@/lib/remote/sync-policy";

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? "ok" : "FAIL"}: ${label}`);
};

const REPO = "/home/z/my-project";
const PROJ = "cmvbjl6060000srlis2ai5mb3";
const SELECT_ID = "cmvbjl9bm000ksrlinlu3ijj8";
const CLUSTER = `${REPO}/services/mock-cluster/fs/projects/cryoflow/${PROJ}`;

console.log("== A. the PURE classification (planPush's verdicts) ==");
{
  const ctx = { policy: "key-files", maxFileMb: 16, maxTotalMb: 64, remoteWorkdir: "/projects/x/select_a" };
  const plan = planPush(
    [
      { rel: "particles_select.star", size: 6964 },
      { rel: "run.out", size: 2992 },
      { rel: "run.err", size: 0 },
    ],
    ctx
  );
  ok(plan.take.length === 3 && plan.skip.length === 0, "three text books take, none skip (key-files)");
  ok(plan.take[0].rel === "particles_select.star", "listing order conserved in the take-list");

  const plan2 = planPush(
    [
      { rel: "particles.mrcs", size: 1024 },
      { rel: "micrograph.mrc", size: 2048 },
      { rel: "run.out", size: 2992 },
    ],
    ctx
  );
  ok(plan2.take.length === 1 && plan2.take[0].rel === "run.out", "image stacks NEVER push under key-files (the reverse metadata rule)");
  ok(plan2.skip.length === 2 && plan2.skip.every((s) => s.why === "binary-book"), "both images skip with the binary-book verdict");

  const big = planPush([{ rel: "huge.star", size: 17 * 1024 * 1024 }], ctx);
  ok(big.take.length === 0 && big.skip[0]?.why === "per-file-cap", "a text book over the per-file cap skips (the cap applies to text too)");

  const budgeted = planPush(
    [
      { rel: "a.star", size: 12 * 1024 * 1024 },
      { rel: "b.star", size: 10 * 1024 * 1024 },
    ],
    { policy: "key-files", maxFileMb: 16, maxTotalMb: 16 }
  );
  ok(budgeted.take.length === 1 && budgeted.take[0].rel === "a.star", "the budget takes the first-fit and refuses the overflow (order-conserving)");
  ok(budgeted.skip[0]?.rel === "b.star" && budgeted.skip[0]?.why === "budget", "the overflow's verdict is budget");

  const exact = planPush([{ rel: "a.star", size: 16 * 1024 * 1024 }], { policy: "key-files", maxFileMb: 16, maxTotalMb: 16 });
  ok(exact.take.length === 1, "a book exactly at the budget line rides (budget - size < 0 is the gate, not <=)");

  const everything = planPush(
    [
      { rel: "particles.mrcs", size: 1024 },
      { rel: "huge.star", size: 17 * 1024 * 1024 },
    ],
    { policy: "everything", maxFileMb: 512, maxTotalMb: 2048 }
  );
  ok(everything.take.length === 2, "the explicit everything override lifts the text gate (the t339 override, reversed)");
}

console.log("== B. the honest words (describePushSkip) ==");
{
  const ctx = { policy: "key-files", maxFileMb: 16, maxTotalMb: 64 };
  const w1 = describePushSkip({ rel: "particles.mrcs", size: 1024, why: "binary-book" }, ctx);
  ok(w1.includes("image data") && w1.includes("metadata books only"), "the binary-book word names the rule (metadata books only)");
  ok(w1.includes("t1137"), "the word carries the law's name");
  const w2 = describePushSkip({ rel: "big.star", size: 20 * 1024 * 1024, why: "per-file-cap" }, ctx);
  ok(w2.includes("20 MB > 16 MB cap"), "the per-file-cap word carries the arithmetic verbatim");
  const w3 = describePushSkip({ rel: "late.star", size: 1024, why: "budget" }, ctx);
  ok(w3.includes("push budget exhausted"), "the budget word speaks the exhaustion");
}

console.log("== C. the ONE grammar (the shared extension family) ==");
{
  ok(KEY_TEXT_EXT.test("particles_select.star"), "the star dialect is the shared family's member");
  ok(!KEY_TEXT_EXT.test("particles.mrcs") && !KEY_TEXT_EXT.test("map.mrc"), "image extensions are not books (both directions agree)");
  ok(KEY_TEXT_EXT.test("run.out") && KEY_TEXT_EXT.test("note.txt") && KEY_TEXT_EXT.test("plot.eps"), "logs, notes and plots ride the same family");
  const src = readFileSync(`${REPO}/src/lib/remote/push-policy.ts`, "utf8");
  ok(src.includes('from "./sync-policy"'), "push-policy imports the sync-policy's own KEY_TEXT_EXT (no forked grammar)");
}

console.log("== D. the twin formula's wiring (the t396 byte-parity) ==");
{
  const addr = remoteWorkdirForJob("/projects/cryoflow", PROJ, "select", SELECT_ID);
  ok(addr === `/projects/cryoflow/${PROJ}/select_nlu3ijj8`, "the formula derives the world's own select twin address verbatim");
  ok(addr.endsWith("/select_nlu3ijj8"), "the address ends in the job dir the fossil actually sits in");
  ok(remoteWorkdirForJob("/projects/cryoflow/", PROJ, "select", SELECT_ID) === addr, "one trailing slash on the root is stripped (the formula's contract)");
  const tilted = remoteWorkdirForJob("/projects/cryoflow", PROJ, "select2d", "cmvbjl9bf000isrli64qkashd");
  ok(tilted.endsWith("/select2d_64qkashd"), "a different type slices its own id8 (type_last-8, the world's select2d job)");
}

console.log("== E. the witness resolution (the live world's own witness) ==");
{
  const sibling = resolvePushWitness(PROJ);
  ok(sibling != null, "the project's sibling-run witness resolves (motioncorr's remote state speaks for the project)");
  ok(sibling?.source === "sibling-run", "the witness names its own source (sibling-run)");
  ok(sibling?.conn.id === "conn-mvbjhms6", "the witness connection is the world's Mock Cluster registry entry");
  const explicit = resolvePushWitness(PROJ, "conn-mvbjhms6");
  ok(explicit?.source === "explicit" && explicit?.conn.id === "conn-mvbjhms6", "an explicit connectionId wins and names itself (explicit)");
  const ghost = resolvePushWitness("no-such-project-id");
  ok(ghost === null, "a project with no remote sibling and no explicit id resolves honestly null");
}

console.log("== F. the live world's twin face (the fossil retired, the guard stands) ==");
{
  // THE FACE THE RIDE MOVED (the t1133 unit's self-rendering lesson): this
  // band pinned the fossil's PRE-ride disease (96 two-dot cells) — the ride
  // retired it through the writer, and a unit that asserts a moved world
  // reads RED forever. The band now pins the POST-ride truth and keeps the
  // standing guard: any future two-dot cell on EITHER side goes RED here,
  // on sight.
  const fossil = `${CLUSTER}/select_nlu3ijj8/particles_select.star`;
  ok(existsSync(fossil), "the twin stands at the derived address");
  const twinBytes = readFileSync(fossil, "utf8");
  const twinLocal = readFileSync(`${REPO}/data/relion/${PROJ}/select_nlu3ijj8/particles_select.star`, "utf8");
  const corruptTwin = twinBytes.split("\n").filter((l) => /\b-?\d+\.\d+\.\d+\b/.test(l)).length;
  const corruptLocal = twinLocal.split("\n").filter((l) => /\b-?\d+\.\d+\.\d+\b/.test(l)).length;
  ok(corruptTwin === 0, `the twin's book speaks zero two-dot cells (the fossil retired through the writer, ${corruptTwin} corrupt)`);
  ok(corruptLocal === 0, `the local book speaks zero two-dot cells (${corruptLocal} corrupt — a re-infection goes RED on sight)`);
  ok(!twinBytes.includes("90.0.2") && !twinLocal.includes("90.0.2"), "the t1135 signature value (90.0.2) lives nowhere in either book");
  ok(twinBytes === twinLocal, "the twin's bytes EQUAL the local book's (the ride's own receipt, standing)");
  ok(twinLocal.split("\n").filter((l) => /\d+\s/.test(l)).length > 0, "the book carries its row family (a real book, not an emptied shell)");
}

console.log("== G. the route's door sites (the ONE loop, the hardening, the words) ==");
{
  const route = readFileSync(`${REPO}/src/app/api/jobs/[id]/outputs/push/route.ts`, "utf8");
  ok(route.includes("isLocalRequest"), "the route wears the family gate (isLocalRequest)");
  ok(route.includes("pushBooksToTwin"), "the route calls the lib's ONE push loop (no second classification)");
  ok(route.includes("MAX_PATHS_PER_CALL = 8"), "the chunk cap is the t424 doctrine's own 8");
  ok(route.includes("resolvePushWitness"), "the connection is a witness question, resolved in the lib");
  ok(route.includes("twin-refresh push leg, t1137"), "the honest log line names the leg and the law");
  ok(route.includes('error: "No local workdir for this job"'), "a workdir-less job is a 400 with its own word");
  const lib = readFileSync(`${REPO}/src/lib/remote/twin-push.ts`, "utf8");
  ok(lib.includes("remoteWorkdirForJob"), "the twin address is the t396 formula, never a guess");
  ok(lib.includes("remoteUpload"), "the write rides the product's own upload (head -c integrity)");
  ok(pushPathRejected("/etc/passwd") !== null, "an absolute path is refused at the verdict layer");
  ok(pushPathRejected("../escape.star") !== null, "a .. segment is refused");
  ok(pushPathRejected("deep/../trick.star") !== null, "a buried .. segment is refused too");
  ok(pushPathRejected("particles_select.star") === null, "an honest workdir-relative book passes the hygiene");
  ok(pushPathRejected("") !== null, "an empty path is refused");
}

console.log(`\n${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
