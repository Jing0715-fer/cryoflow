/**
 * t554 — GAMBLE LANE LIVE-FIRE (t552 handover ②, the last unproven arc).
 *
 * The zero-keep doctrine (t520) ships four quadrants; the gamble faces:
 *   keep=0 + maybe>0 → tiers.borderline, nextStep law: "offer it only as
 *   the explicit gamble, never as advice."
 *   keep>0 + maybe>0 → tiers conservative vs inclusive — the inclusive
 *   set IS the gamble (maybes ride on the keeps).
 * t552b proved the JUDGE side on real data (3 fresh sessions on class2d
 * K5: F1 0-keep/[2,4,5], F2 [5]+[2], F3 [5]+[2,3] — honest boundary
 * variance, stable core). Never yet proven end-to-end: the user
 * ACCEPTING the gamble and the select actually LANDING (t508 create-AND-
 * run) with a particle receipt on the real EMPIAR world.
 *
 * This script drives that arc through the product's own door
 * (POST /api/ai/chat, builtin glm-4-plus lane):
 *   Turn 1 (fresh session — the t552 reset form): judge class2d K5.
 *     - doctrine: get_workflow_state → judge_2d_classes (real VLM)
 *     - verdict parsed from the tool_result detail (ground truth)
 *     - law 5: NO select_classes before the user's word
 *   Turn 2 (the acceptance): the user takes the bet, naming the classes.
 *     - select_classes must fire with the gamble set
 *     - a select2d target executes immediately — the RAN receipt
 *   Paper side (t553 checker form): the select2d THIS run created (id
 *   parsed from the tool summary, never the first card on the wall) must
 *   be completed, result "N of M particles kept" with N > 0.
 *
 * Requires the EMPIAR world active (fail fast otherwise) — the shell
 * orchestrates world switching.
 *
 * Usage:  node scripts/t554-gamble-live-fire.mjs [--no-cleanup]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.CF_BASE ?? "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const EMPIAR_NAME = "EMPIAR-10017 real t372 muro2ufa";
const CLASS2D_NAME = "class2d K5";
const OUT_DIR = path.join(process.cwd(), ".qa-logs");
mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------- */
/* Product doors                                                     */
/* ---------------------------------------------------------------- */

async function postChat(body) {
  const r = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  return { status: r.status, ...j };
}

// t552 doctrine live: the 429 lane retries with backoff INSIDE the route;
// a 429 that still surfaces means the window is hot — back off outside.
async function postChatRetry(body, { retries = 2, backoffMs = 25_000 } = {}) {
  let res = await postChat(body);
  let n = 0;
  while (res.status === 429 && n < retries) {
    n++;
    console.log(`    429 — backing off ${backoffMs / 1000}s (retry ${n}/${retries})`);
    await sleep(backoffMs);
    res = await postChat(body);
  }
  return res;
}

async function chat(sessionId, message, { maxTurns = 12, label = "" } = {}) {
  const t0 = Date.now();
  const events = [];
  let res = await postChatRetry(sessionId ? { sessionId, message } : { message });
  let sid = res.sessionId ?? sessionId;
  let guard = 0;
  while (res.needsContinue && guard < maxTurns) {
    for (const e of res.events ?? []) events.push(e);
    res = await postChatRetry({ sessionId: sid, continue: true });
    guard++;
  }
  for (const e of res.events ?? []) events.push(e);
  const finalText =
    [...events].reverse().find((e) => e.type === "assistant_text")?.text ?? "";
  const toolCalls = events.filter((e) => e.type === "tool_call");
  const toolResults = events.filter((e) => e.type === "tool_result");
  return {
    label, message, sessionId: sid, turns: guard + 1,
    ms: Date.now() - t0,
    toolSequence: toolCalls.map((c) => c.name),
    toolArgs: Object.fromEntries(toolCalls.map((c) => [c.name, c.args ?? c.arguments ?? null])),
    toolOk: Object.fromEntries(toolResults.map((r) => [r.name, r.ok])),
    toolSummaries: Object.fromEntries(toolResults.map((r) => [r.name, (r.summary ?? "").slice(0, 500)])),
    events, finalText,
    error: res.error ?? null,
  };
}

async function worldJobs() {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const j = await r.json();
  return j.jobs ?? [];
}

async function activeProject() {
  const r = await fetch(`${BASE}/api/projects`, { headers: SH });
  const j = await r.json();
  const projs = j.projects ?? [];
  return projs.find((p) => p.active) ?? null;
}

async function deleteJob(id) {
  const r = await fetch(`${BASE}/api/jobs/${id}`, { method: "DELETE", headers: SH });
  return r.ok;
}

/* ---------------------------------------------------------------- */
/* Checks                                                            */
/* ---------------------------------------------------------------- */

const REPORT = { startedAt: new Date().toISOString(), purpose: "gamble lane live-fire: maybe-tier accepted → select lands (t552 handover ②)", checks: [], world: {} };

function check(name, pass, note = "") {
  REPORT.checks.push({ name, pass, note });
  console.log(`    ${pass ? "PASS" : "FAIL"}  ${name}${note ? ` — ${note}` : ""}`);
  return pass;
}

const called = (rec, tool) => rec.toolSequence.includes(tool);

/* ---------------------------------------------------------------- */

async function main() {
  const noCleanup = process.argv.includes("--no-cleanup");

  // world guard — fail fast, never judge in the wrong world
  const proj = await activeProject();
  REPORT.world.activeProject = proj ? `${proj.name} [${proj.id}]` : null;
  if (!proj || proj.id !== EMPIAR_ID) {
    console.error(`FATAL: active project is ${REPORT.world.activeProject}, expected ${EMPIAR_NAME} [${EMPIAR_ID}] — switch worlds first.`);
    process.exit(2);
  }
  const rosterBefore = await worldJobs();
  const rosterBeforeIds = new Set(rosterBefore.map((j) => j.id));
  const class2d = rosterBefore.find((j) => j.type === "class2d" && j.status === "completed");
  if (!class2d) {
    console.error("FATAL: no completed class2d in this world — no gamble face.");
    process.exit(2);
  }
  REPORT.world.class2d = { id: class2d.id, name: class2d.name, result: class2d.result };
  REPORT.world.rosterBefore = rosterBefore.length;
  console.log(`world: ${proj.name} · roster ${rosterBefore.length} · source ${class2d.name} [${class2d.id}]`);

  /* ---- Turn 1: the judge (fresh session, t552 reset form) ---- */
  console.log("\n[T1] 新会话问判：请分析 class2d K5 的分类结果，推荐保留哪些 class");
  const fresh = await postChat({ action: "reset" });
  const sid = fresh.sessionId;
  if (!sid) {
    console.error("FATAL: reset door returned no sessionId");
    process.exit(2);
  }
  await sleep(2_000);
  const t1 = await chat(
    sid,
    `请分析「${CLASS2D_NAME}」的分类结果：看看 class 平均图，结合每类占比和分辨率，推荐保留哪些 class`,
    { label: "T1-judge" }
  );
  REPORT.t1 = t1;
  check("T1: judge_2d_classes ran and ok", called(t1, "judge_2d_classes") && t1.toolOk.judge_2d_classes === true,
    (t1.toolSummaries.judge_2d_classes ?? "").slice(0, 160));
  check("T1: law 5 — no select before the user's word", !called(t1, "select_classes"), t1.toolSequence.join(" → "));

  // verdict ground truth from the LAST judge result (recovery arcs may retry)
  const judgeResults = t1.events.filter((e) => e.type === "tool_result" && e.name === "judge_2d_classes");
  const ev = judgeResults[judgeResults.length - 1];
  const judged = ev?.detail?.judgedClasses ?? [];
  const keep = judged.filter((c) => c.verdict === "keep").map((c) => c.cls).sort((a, b) => a - b);
  const maybe = judged.filter((c) => c.verdict === "maybe").map((c) => c.cls).sort((a, b) => a - b);
  const reject = judged.filter((c) => c.verdict === "reject").map((c) => c.cls).sort((a, b) => a - b);
  REPORT.verdict = { keep, maybe, reject, judgedCount: judged.length };
  console.log(`    verdict: keep=[${keep.join(",")}] maybe=[${maybe.join(",")}] reject=[${reject.join(",")}]`);
  check("T1: verdict parsed (no null collapse)", judged.length > 0, `${judged.length} classes judged`);

  // the gamble face — both quadrants the doctrine ships
  const zeroKeep = keep.length === 0;
  const gambleSet = zeroKeep ? [...maybe] : [...new Set([...keep, ...maybe])].sort((a, b) => a - b);
  REPORT.gamble = { quadrant: zeroKeep ? "borderline" : "inclusive", set: gambleSet };
  // CF_QUADRANT — target a specific face (t561): the judge's boundary is
  // honest variance (t552b: F1 0-keep, F2/F3 keep=[5]); rerolling is the
  // legitimate way to reach the unvisited quadrant, and a wrong-face run
  // must NOT fire T2 (no select, no cleanup debt — exit before the offer)
  const wantQuadrant = process.env.CF_QUADRANT ?? null;
  if (wantQuadrant && (zeroKeep ? "borderline" : "inclusive") !== wantQuadrant) {
    console.log(`    face is ${zeroKeep ? "borderline" : "inclusive"} — CF_QUADRANT=${wantQuadrant} wants otherwise; reroll for a fresh judge mood`);
    writeReport();
    process.exit(3);
  }
  if (gambleSet.length === 0) {
    check("gamble face exists this round", false, "0 keep / 0 maybe — no gamble to fire; rerun when the judge sees a maybe");
    writeReport();
    process.exit(3);
  }
  const gambleFace = zeroKeep
    ? check("gamble face: borderline quadrant (0 keep + maybe>0)", true, `borderline=[${gambleSet.join(",")}]`)
    : check("gamble face: inclusive quadrant (keep>0 + maybe>0)", true, `conservative=[${keep.join(",")}] inclusive=[${gambleSet.join(",")}]`);

  // the offer — the AI must have put the gamble on the table (never advice)
  const offered = gambleSet.some((c) => t1.finalText.includes(String(c)));
  check("T1: the gamble is on the table (class names in the offer)", offered,
    offered ? "final text names the borderline classes" : "final text never names them — see t1.finalText");

  /* ---- Turn 2: the acceptance — the user takes the bet ---- */
  const setStr = gambleSet.join("、");
  const acceptMsg = zeroKeep
    ? `我接受这个赌博：把 class ${setStr} 都选上——我知道它们只是边缘候选，不是正式建议，但我想赌一把看看。请从「${CLASS2D_NAME}」建一个选择任务并跑起来。`
    : `我接受这个赌博：不只选 keep 的 class ${keep.join("、")}，把 maybe 的 class ${maybe.join("、")} 也一起带上（inclusive）。请从「${CLASS2D_NAME}」建一个选择任务并跑起来。`;
  console.log(`\n[T2] 用户接赌: "${acceptMsg.slice(0, 80)}…"`);
  await sleep(3_000);
  const t2 = await chat(t1.sessionId, acceptMsg, { label: "T2-gamble-select" });
  REPORT.t2 = t2;
  check("T2: select_classes fired", called(t2, "select_classes"), t2.toolSequence.join(" → "));
  check("T2: select ok", t2.toolOk.select_classes === true, (t2.toolSummaries.select_classes ?? "").slice(0, 200));

  // the classes arg must BE the gamble set (the user's bet, not a re-judge)
  const selArgs = t2.toolArgs.select_classes ?? null;
  const selClasses = Array.isArray(selArgs?.classes) ? selArgs.classes.map(Number).sort((a, b) => a - b) : null;
  check("T2: the bet's classes are the ones selected",
    !!selClasses && selClasses.length === gambleSet.length && selClasses.every((c, i) => c === gambleSet[i]),
    selClasses ? `selected=[${selClasses.join(",")}] bet=[${gambleSet.join(",")}]` : "args unreadable");
  REPORT.selection = { args: selArgs, classes: selClasses };

  const ranNote = t2.toolSummaries.select_classes ?? "";
  check("T2: the selection EXECUTED (t508 create AND run)", /RAN|kept/.test(ranNote), ranNote.slice(0, 200));

  /* ---- Paper side: the receipt on disk (t553 checker form) ---- */
  const jobsAfter = await worldJobs();
  const createdSel = (ranNote.match(/\[(cmu[a-z0-9]{16,})\]/) ?? [])[1];
  const sel = (createdSel && jobsAfter.find((j) => j.id === createdSel))
    || jobsAfter.find((j) => j.type === "select2d" && j.status === "completed" && !rosterBeforeIds.has(j.id))
    || null;
  check("paper: the select2d THIS run created exists", !!sel, sel ? `${sel.name} [${sel.id}] ${sel.status}` : "none");
  if (sel) {
    check("paper: select2d completed (not idle)", sel.status === "completed", `${sel.name} ${sel.status}`);
    // t554 — the receipt speaks human numbers: "7,421 of 10,866" — the
    // thousands separator is part of the receipt, not noise (the first
    // draft grabbed "421" out of "7,421" — the same parse-the-receipt
    // class the A3b checker tripped on; strip commas BEFORE reading).
    const keptM = /([\d,]+) of ([\d,]+) particles kept/.exec(sel.result ?? "");
    const kept = keptM ? Number(keptM[1].replace(/,/g, "")) : null;
    const total = keptM ? Number(keptM[2].replace(/,/g, "")) : null;
    check("paper: the gamble paid a particle receipt", kept !== null, sel.result ?? "no result");
    check("paper: the bet kept particles (N > 0)", kept !== null && kept > 0, `${kept ?? 0} of ${total ?? "?"} kept`);
    REPORT.receipt = { id: sel.id, name: sel.name, status: sel.status, result: sel.result, kept, total };
    if (judged.length > 0 && total) {
      const frac = kept / total;
      REPORT.receipt.keptFraction = +frac.toFixed(3);
      console.log(`    the gamble kept ${kept}/${total} particles (${(frac * 100).toFixed(1)}%) — the bet's price`);
    }
  }

  /* ---- cleanup: restore the roster (the world was borrowed) ---- */
  if (!noCleanup && sel?.id) {
    const ok = await deleteJob(sel.id);
    check("cleanup: created select2d removed (roster restored)", ok, `deleted ${sel.id}`);
    const jobsFinal = await worldJobs();
    check("cleanup: roster back to baseline", jobsFinal.length === rosterBefore.length,
      `${rosterBefore.length} → ${jobsFinal.length}`);
    REPORT.world.rosterAfter = jobsFinal.length;
  } else if (noCleanup) {
    console.log("    [--no-cleanup] select2d left on the canvas");
  }

  /* ---- roll-up ---- */
  const failed = REPORT.checks.filter((c) => !c.pass);
  REPORT.summary = {
    checks: REPORT.checks.length,
    failed: failed.length,
    failures: failed.map((c) => `${c.name}: ${c.note}`),
  };
  writeReport();
  console.log(`\n=== ${REPORT.checks.length - failed.length}/${REPORT.checks.length} checks passed${failed.length ? " · FAILURES:" : " · the gamble lane is PROVEN"}`);
  for (const f of failed) console.log("  -", f.name, "—", f.note);
  process.exit(failed.length ? 1 : 0);
}

function writeReport() {
  // CF_REPORT_NAME — a rerun of this harness for a different quadrant
  // writes its own report (t555's inclusive-quadrant run), never the
  // t554 borderline artifact.
  const out = path.join(OUT_DIR, process.env.CF_REPORT_NAME ?? "t554-gamble-live-fire-report.json");
  writeFileSync(out, JSON.stringify(REPORT, null, 2));
  console.log(`report: ${out}`);
}

main().catch((e) => { console.error("t554 gamble live-fire failed:", e); process.exit(1); });
