#!/usr/bin/env node
// t1137-twin-push-ride.mjs — the seeder's stale twin retires through a
// WRITER (the product's own push door), never a hand edit.
//
// THE ARC (the t1132/t1136 ride shape, push direction):
//   BEFORE  — the cluster twin's bytes confess the t1135 disease (96
//             two-dot tilt cells; md5 on the record) while the local
//             book speaks valid floats (the t1136 ride's re-run product);
//   PROBE   — the GET preflight names the witness (the sibling-run's
//             Mock Cluster), the t396 twin address, and the planner's
//             take-list (the fossil's book among the candidates);
//   PUSH    — POST the books through /api/jobs/:id/outputs/push (the
//             route's own gates: hygiene, planner, remoteUpload's head -c
//             integrity), chunk by chunk;
//   REFUSALS— the door's own verdicts on the record: a .. path refused,
//             an absent local book refused, a 403 for a non-local claim;
//   AFTER   — the twin's md5 EQUALS the local book's md5 (the fossil
//             retired through a writer), zero two-dot cells anywhere in
//             the twin dir, and the both-trees census (data/relion + the
//             cluster's living engine tree) speaks 0 corrupt cells — the
//             world's books complete the t1136 arc's last named fossil.

import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";

const REPO = "/home/z/my-project";
const PROJ = "cmvbjl6060000srlis2ai5mb3";
const SELECT = "cmvbjl9bm000ksrlinlu3ijj8";
const BASE = "http://localhost:3000";
// the guard's own word: curl-style clients with no fetch metadata are
// rejected — a QA ride sends the same-origin metadata (Sec-Fetch-Site
// short-circuits the gate; Origin/Host parity carries the POSTs)
const ORIGIN = {
  "Content-Type": "application/json",
  "Origin": BASE,
  "Sec-Fetch-Site": "same-origin",
};
const TWIN_DIR = `${REPO}/services/mock-cluster/fs/projects/cryoflow/${PROJ}/select_nlu3ijj8`;
const LOCAL_DIR = `${REPO}/data/relion/${PROJ}/select_nlu3ijj8`;
const TWO_DOT = /\b-?\d+\.\d+\.\d+\b/;

const md5 = (p) => createHash("md5").update(readFileSync(p)).digest("hex");
const twoDotCount = (p) =>
  readFileSync(p, "utf8").split("\n").filter((l) => TWO_DOT.test(l)).length;

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? "ok" : "FAIL"}: ${label}`);
};

console.log("== BEFORE: the fossil confesses, the local book is fresh ==");
const fossil = `${TWIN_DIR}/particles_select.star`;
const localBook = `${LOCAL_DIR}/particles_select.star`;
const beforeTwinMd5 = md5(fossil);
const beforeLocalMd5 = md5(localBook);
ok(beforeTwinMd5 !== beforeLocalMd5, "the twin's bytes differ from the local book (the staleness, on the record)");
ok(twoDotCount(fossil) === 96, `the twin wears 96 two-dot cells (${twoDotCount(fossil)}/96)`);
ok(twoDotCount(localBook) === 0, "the local book speaks zero two-dot cells");

console.log("== PROBE: the preflight names the witness and the take-list ==");
const probeRes = await fetch(`${BASE}/api/jobs/${SELECT}/outputs/push`, {
  headers: { "Sec-Fetch-Site": "same-origin", "Origin": BASE },
});
ok(probeRes.status === 200, `the probe answers 200 (${probeRes.status})`);
const probe = await probeRes.json();
ok(probe.witness?.connectionId === "conn-mvbjhms6", `the witness is the Mock Cluster registry entry (${probe.witness?.connectionId})`);
ok(probe.witness?.source === "sibling-run", "the witness names its source (sibling-run — the select native has no remote of its own)");
ok(probe.twinWorkdir === `/projects/cryoflow/${PROJ}/select_nlu3ijj8`, `the twin address is the t396 formula's answer (${probe.twinWorkdir})`);
ok(Array.isArray(probe.candidates) && probe.candidates.some((c) => c.path === "particles_select.star"), "the fossil's book sits in the take-list");

console.log("== REFUSALS: the door's own verdicts, on the record ==");
{
  const r1 = await fetch(`${BASE}/api/jobs/${SELECT}/outputs/push`, {
    method: "POST",
    headers: ORIGIN,
    body: JSON.stringify({ paths: ["../escape.star"] }),
  });
  const b1 = await r1.json();
  ok(r1.status === 200 && b1.results?.[0]?.ok === false && /Path rejected/.test(b1.results[0].error ?? ""), "a .. path is refused at the verdict layer (200 + per-path refusal)");

  const r2 = await fetch(`${BASE}/api/jobs/${SELECT}/outputs/push`, {
    method: "POST",
    headers: ORIGIN,
    body: JSON.stringify({ paths: ["no_such_book.star"] }),
  });
  const b2 = await r2.json();
  ok(r2.status === 200 && b2.results?.[0]?.ok === false && /Not present in the local workdir/.test(b2.results[0].error ?? ""), "an absent local book is refused (the push moves this job's own books)");

  const r3 = await fetch(`${BASE}/api/jobs/${SELECT}/outputs/push`, {
    method: "POST",
    headers: ORIGIN,
    body: JSON.stringify({ paths: [] }),
  });
  ok(r3.status === 400, "an empty paths array is a 400 (the chunk doctrine's floor)");
}

console.log("== PUSH: the books ride through the product's own door ==");
{
  const paths = probe.candidates.map((c) => c.path);
  const res = await fetch(`${BASE}/api/jobs/${SELECT}/outputs/push`, {
    method: "POST",
    headers: ORIGIN,
    body: JSON.stringify({ paths }),
  });
  const body = await res.json();
  ok(res.status === 200 && body.ok === true, `the push answers ok (${res.status})`);
  ok(body.pushed === paths.length, `every take-list book rode (${body.pushed}/${paths.length})`);
  ok(body.twinWorkdir === probe.twinWorkdir, "the receipt names the same twin address the probe did");
  for (const row of body.results ?? []) {
    ok(row.ok === true, `pushed: ${row.path} (${row.bytes} bytes)`);
  }
}

console.log("== AFTER: the fossil retired through a writer ==");
const afterTwinMd5 = md5(fossil);
ok(afterTwinMd5 === beforeLocalMd5, "the twin's bytes now EQUAL the local book's md5 (the writer's receipt)");
ok(afterTwinMd5 !== beforeTwinMd5, "the twin actually moved (not a no-op pass-through)");
ok(twoDotCount(fossil) === 0, "zero two-dot cells in the twin's book (the t1135 disease retired here)");

console.log("== THE BOTH-TREES CENSUS: the world's books complete the arc ==");
{
  const walk = (root, skip) => {
    let files = [];
    let stack = [root];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        if (skip && e.name === skip) continue;
        const abs = `${dir}/${e.name}`;
        if (e.isDirectory()) stack.push(abs);
        else if (e.isFile() && /\.(star|out|err|log|txt|dat|csv)$/i.test(e.name)) files.push(abs);
      }
    }
    return files;
  };
  const appSide = walk(`${REPO}/data/relion`, ".cryoflow_prev");
  const clusterSide = walk(`${REPO}/services/mock-cluster/fs/projects/cryoflow`, null);
  let appBad = 0, clusterBad = 0;
  for (const f of appSide) {
    try {
      if (TWO_DOT.test(readFileSync(f, "utf8"))) {
        appBad += 1;
        console.log(`    APP-SIDE corrupt: ${f}`);
      }
    } catch { /* unreadable — not a book */ }
  }
  for (const f of clusterSide) {
    try {
      if (TWO_DOT.test(readFileSync(f, "utf8"))) {
        clusterBad += 1;
        console.log(`    CLUSTER-SIDE corrupt: ${f}`);
      }
    } catch { /* unreadable — not a book */ }
  }
  ok(appSide.length > 1000, `the app-side walk covered the living tree (${appSide.length} books)`);
  ok(clusterSide.length > 100, `the cluster-side walk covered the living engine tree (${clusterSide.length} books)`);
  ok(appBad === 0, `data/relion speaks 0 corrupt cells across ${appSide.length} books`);
  ok(clusterBad === 0, `the cluster's living engine tree speaks 0 corrupt cells across ${clusterSide.length} books`);
}

console.log(`\nRIDE ${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
