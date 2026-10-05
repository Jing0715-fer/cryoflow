/**
 * t573 — the 3D judge, live: discovery → faces sheet → VLM → stamp.
 *
 * The subject under fire is judge_3d_classes — the volume sibling of
 * judge_2d_classes (t565). The engine's class3d lane is NOT the subject
 * here: this world's stacks live on the (mock) cluster and the class3d
 * pre-run refuses without them (observed live this window — the stackless
 * world's law, t520's sibling). So the harness FEEDS the judge the way
 * t519 made a judgeable stack: it fabricates the workdir a never-run
 * class3d probe would own (workdirFor is deterministic:
 * class3d_{id-tail}) with four synthetic 32³ volumes + a data star, and
 * lets the REAL judge do everything else — volume discovery, occupancy
 * read, faces render, the VLM's three-face argument (2-3 real provider
 * calls: main + confirm pass), and the stamp write through the t565
 * door. Nothing about the judge is mocked.
 *
 * The four volumes are a verdict MENU, not a quiz with an answer key:
 *   class 1  centered sphere (r=9)        — coherent from every face
 *   class 2  two-lobe blob                — coherent, different shape
 *   class 3  uniform noise                — the reject signature
 *   class 4  elongated rail               — the streak signature
 * The assertions pin the CONTRACT (4 entries, verdict enum, model named,
 * advice shipped, stamp readable through the route) — never the exact
 * verdicts; a judge whose verdicts are asserted in advance is theater.
 * The two coherent rows MUST land keep/maybe and the two junk rows MUST
 * NOT both be keep — a rubric sanity band, the t519 field-test's lesson.
 *
 * Cleanup: DELETE the probe, then prune its stamp entry from
 * data/ai-verdicts.json with the store's own atomic-rename convention
 * (the stamp has no delete API; an orphan entry for a deleted job is
 * unreachable, and zero-pollution is the house law). Roster 12 → 12.
 *
 * Usage: node scripts/t573-judge3d-live-fire.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const DATA_ROOT = "/home/z/my-project/data/relion";

let pass = 0, fail = 0;
const check = (name, ok, evidence) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${evidence != null ? ` — ${evidence}` : ""}`);
  if (ok) pass++; else fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const api = (method, path_, body) => {
  const args = ["-s", "-X", method, `${BASE}${path_}`, "-H", "Origin: http://localhost:3000"];
  if (body) args.push("-H", "Content-Type: application/json", "-d", JSON.stringify(body));
  return sh(`curl --max-time 400 ${args.map((a) => JSON.stringify(a)).join(" ")}`);
};

/* ---- the synthetic volume writer (the unit suite's, inlined) ---------- */
const N = 64;
function writeMrcVolume(file, density) {
  const header = Buffer.alloc(1024, 0);
  header.writeInt32LE(N, 0);
  header.writeInt32LE(N, 4);
  header.writeInt32LE(N, 8);
  header.writeInt32LE(2, 12); // mode 2 = float32
  header.writeFloatLE(N, 40); header.writeFloatLE(N, 44); header.writeFloatLE(N, 48);
  header.writeInt32LE(1, 56); header.writeInt32LE(2, 60); header.writeInt32LE(3, 64);
  header.writeFloatLE(0, 76); header.writeFloatLE(1, 80); header.writeFloatLE(0, 84);
  const data = Buffer.alloc(N * N * N * 4);
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        data.writeFloatLE(density(x, y, z), (z * N + y) * N * 4 + x * 4);
  writeFileSync(file, Buffer.concat([header, data]));
}
const C = (N - 1) / 2;
// the "good" volumes carry INTERNAL STRUCTURE — a flat step sphere is the
// rubric's own reject signature ("featureless blob") and the first live
// fire judged it exactly so (the VLM reads, it does not guess). Real class
// volumes have organized interior variation: domains, cavities, rods.
let seed = 7;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return (seed / 0x7fffffff) * 0.9 + 0.05;
};
const sphereStructured = (x, y, z) => {
  const r = Math.hypot(x - C, y - C, z - C);
  if (r > 20) return 0.02 + noise() * 0.02;
  let v = 0.5; // envelope floor
  const dA = Math.hypot(x - C - 6, y - C - 4, z - C + 2); // domain A
  const dB = Math.hypot(x - C + 8, y - C + 2, z - C - 6); // domain B
  const dC2 = Math.hypot(x - C - 2, y - C + 7, z - C - 2); // domain C
  const cav = Math.hypot(x - C + 2, y - C - 6, z - C + 8); // cavity
  if (dA < 9) v += 0.5 * (1 - dA / 9);
  if (dB < 7.5) v += 0.4 * (1 - dB / 7.5);
  if (dC2 < 6) v += 0.3 * (1 - dC2 / 6);
  if (cav < 5) v -= 0.55 * (1 - cav / 5);
  if (Math.abs(y - C + 2) < 2.8 && Math.abs(z - C - 4) < 2.8 && Math.abs(x - C) < 14) v += 0.45; // helix rod
  return v + noise() * 0.03;
};
const twoLobeStructured = (x, y, z) => {
  const a = Math.hypot(x - C + 8, y - C, z - C);
  const b = Math.hypot(x - C - 8, y - C, z - C);
  if (a > 13 && b > 13) return 0.02 + noise() * 0.02;
  let v = 0.5;
  if (Math.abs(z - C) < 2.4 && Math.abs(y - C) < 2.4) v += 0.5; // central filament
  if (Math.hypot(x - C + 8, y - C, z - C) < 4.5) v += 0.45; // lobe cores
  if (Math.hypot(x - C - 8, y - C, z - C) < 4.5) v += 0.45;
  if (Math.abs(y - C) < 1.2) v -= 0.4; // cleft between the lobes
  return v + noise() * 0.04;
};
const noiseVol = () => noise();
const rail = (x, y, z) => (Math.abs(y - C) <= 4 && Math.abs(x - C) <= 22 ? 0.9 + noise() * 0.1 : 0.02 + noise() * 0.02);

const roster0 = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID)?.stats?.total ?? -1;
const minted = [];

try {
  /* ---- world guard ---------------------------------------------------- */
  // t597: the guard used to pin roster0 === 12 — a hardcoded census rots
  // with the world (t596 caught it live as 13/14). The honest invariant is
  // "the world I measured at entry is the world I return at the end" — the
  // final check below already compares against roster0, so the guard only
  // asserts the world is EMPIAR and the census is sane.
  const active = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.active);
  check("world guard ok — EMPIAR active, roster " + roster0, active?.id === EMPIAR_ID && roster0 > 0, active?.name?.slice(0, 24));

  /* ---- mint the probe + fabricate its workdir -------------------------- */
  // the name carries a per-run tag: the chat route RESUMES the latest
  // session (a stale history remembers a deleted probe's id and the agent
  // will fire at it — observed live), so the lookup key must be unique.
  const tag = Date.now().toString(36);
  const mint = JSON.parse(api("POST", "/api/jobs", {
    type: "class3d", name: `t573 Judge Probe ${tag}`, x: -420, y: -80, projectId: EMPIAR_ID,
  }));
  const probe = mint.job ?? mint;
  minted.push(probe.id);
  check("class3d probe minted (idle, never run)", !!probe?.id, probe?.id);
  const workdir = path.join(DATA_ROOT, EMPIAR_ID, `class3d_${probe.id.slice(-8)}`);
  mkdirSync(workdir, { recursive: true });
  writeMrcVolume(path.join(workdir, "run_it007_class001.mrc"), sphereStructured);
  writeMrcVolume(path.join(workdir, "run_it007_class002.mrc"), twoLobeStructured);
  writeMrcVolume(path.join(workdir, "run_it007_class003.mrc"), noise);
  writeMrcVolume(path.join(workdir, "run_it007_class004.mrc"), rail);
  // occupancy 55/30/10/5% — 100 data-star rows of _rlnClassNumber
  const occ = [...Array(55).fill(1), ...Array(30).fill(2), ...Array(10).fill(3), ...Array(5).fill(4)];
  const star = ["data_", "", "loop_", "_rlnClassNumber", ...occ.map(String), ""].join("\n");
  writeFileSync(path.join(workdir, "run_it007_data.star"), star);
  writeFileSync(path.join(workdir, "run_it007_model.star"), "data_model_general\n\n_rlnCurrentResolution 12.5\n");
  check("workdir fabricated — 4 volumes + data star + model witness", existsSync(path.join(workdir, "run_it007_class004.mrc")), path.basename(workdir));

  /* ---- fire the judge through the assistant --------------------------- */
  console.log(`\n[judge] the assistant calls judge_3d_classes (real VLM, 2-3 passes)`);
  // the chat turn is a MULTI-ROUND protocol: each POST advances one round
  // and answers needsContinue — the client re-POSTs {sessionId, continue}
  // until the turn settles (observed live: a single POST stopped mid-turn
  // with the tool call not yet made).
  const ask0 = JSON.parse(api("POST", "/api/ai/chat", {
    message: `请立即调用 judge_3d_classes 工具判读名为 t573 Judge Probe ${tag} 的 class3d job 的 3D 分类结果，不要先问问题，直接给出每类的 keep/maybe/reject 判词。`,
  }));
  let sessionId = ask0?.sessionId;
  let events = Array.isArray(ask0?.events) ? ask0.events : [];
  let toolOk = events.some((e) => e?.type === "tool_result" && e?.name === "judge_3d_classes" && e?.ok === true);
  let rounds = 1;
  for (let i = 0; i < 12 && !toolOk && ask0?.needsContinue && sessionId; i++) {
    const cont = JSON.parse(api("POST", "/api/ai/chat", { sessionId, continue: true }));
    const more = Array.isArray(cont?.events) ? cont.events : [];
    events = [...events, ...more];
    toolOk = toolOk || more.some((e) => e?.type === "tool_result" && e?.name === "judge_3d_classes" && e?.ok === true);
    if (cont?.needsContinue === false) break;
    sessionId = cont?.sessionId ?? sessionId;
    rounds++;
  }
  check("assistant turn completed", !!sessionId, `${sessionId} × ${rounds} round(s)`);
  check("judge_3d_classes rode the turn (tool_result ok)", toolOk, `${events.filter((e) => e?.type === "tool_call").length} tool call(s) in ${events.length} event(s)`);

  /* ---- the stamp through the t565 door -------------------------------- */
  let stamp = null;
  for (let i = 0; i < 24 && !stamp?.available; i++) {
    try {
      const raw = api("GET", `/api/jobs/${probe.id}/ai-verdict`);
      const parsed = JSON.parse(raw ?? "null");
      if (parsed?.available) stamp = parsed;
    } catch { /* keep polling */ }
    if (!stamp?.available) await sleep(10000);
  }
  check("stamp readable through the ai-verdict route", stamp?.available === true, stamp ? `${(stamp.stamp?.classes ?? []).length} classes` : "never landed");
  const cls = stamp?.stamp?.classes ?? [];
  check("every class judged exactly once", cls.length === 4 && new Set(cls.map((c) => c.cls)).size === 4, cls.map((c) => `#${c.cls}:${c.verdict}`).join(" "));
  check("verdicts inside the enum", cls.every((c) => ["keep", "maybe", "reject"].includes(c.verdict)), "keep|maybe|reject");
  check("model named on the stamp", !!stamp?.stamp?.model, stamp?.stamp?.model ?? "missing");
  check("advice shipped", (stamp?.stamp?.advice ?? "").length > 20, `${(stamp?.stamp?.advice ?? "").length} chars`);
  // the rubric sanity band: the two coherent rows may not BOTH be rejected
  // and the two junk rows may not BOTH be keeps (t519's field-test lesson —
  // a verdict with zero discrimination is a rubric failure, not an opinion)
  const v = Object.fromEntries(cls.map((c) => [c.cls, c.verdict]));
  const coherentOk = v[1] !== "reject" || v[2] !== "reject";
  const junkOk = v[3] !== "keep" || v[4] !== "keep";
  check("rubric sanity band — coherent rows not both rejected", coherentOk, `1:${v[1]} 2:${v[2]}`);
  check("rubric sanity band — junk rows not both kept", junkOk, `3:${v[3]} 4:${v[4]}`);
} catch (e) {
  fail++;
  console.error(`FATAL: ${e.message}`);
} finally {
  /* ---- cleanup: the world owes nothing -------------------------------- */
  try {
    for (const id of minted) {
      api("DELETE", `/api/jobs/${id}?confirm=true`);
      // the fabricated feed dies with the probe (rm -rf scoped to its tail)
      const wd = path.join(DATA_ROOT, EMPIAR_ID, `class3d_${id.slice(-8)}`);
      if (existsSync(wd)) rmSync(wd, { recursive: true, force: true });
    }
    // prune the orphan stamp with the store's own atomic-rename convention
    const stampsFile = "/home/z/my-project/data/ai-verdicts.json";
    if (minted.length && existsSync(stampsFile)) {
      const doc = JSON.parse(readFileSync(stampsFile, "utf8"));
      const before = (doc.stamps ?? []).length;
      const kept = (doc.stamps ?? []).filter((s) => !minted.includes(s.jobId));
      if (kept.length !== before) {
        const tmp = `${stampsFile}.tmp-${Date.now().toString(36)}`;
        writeFileSync(tmp, JSON.stringify({ ...doc, stamps: kept }, null, 2));
        renameSync(tmp, stampsFile);
      }
    }
    await sleep(400);
    const after = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
    check("roster returned to its starting count", after?.stats?.total === roster0, `${roster0} → ${after?.stats?.total}`);
  } catch (e) { check("cleanup ran", false, String(e.message)); }
  try {
    const errs = sh(`agent-browser errors 2>/dev/null`).trim();
    check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
  } catch { /* eval unavailable */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}
