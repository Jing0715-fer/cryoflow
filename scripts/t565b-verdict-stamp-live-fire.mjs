/**
 * t565b — the AI verdict stamp, live end-to-end: the judge speaks, the
 * job remembers, the Results tab shows it.
 *
 * The stamp's write path fires inside judge_2d_classes (t565's tools.ts
 * hook) — so the ONLY honest way to test it is a real judge arc: reset
 * session → ask for a judgment of class2d K5 → the VLM speaks (two-pass)
 * → the tool_result lands → THEN the route must serve the stamp, and
 * the browser must render the card.
 *
 * Verified on three layers:
 *   route:  available:true, counts EXACTLY matching the judge summary
 *           line (both derive from the same verdict — any divergence is
 *           a bug in one of them), model named, twoPass shape sane.
 *   card:   the violet "AI verdict" card mounted on the class2d Results
 *           tab — counts chips, per-class verdict chips, the footer's
 *           notebook provenance (asked · model · two-pass/single read).
 *   world:  ZERO roster drift — the stamp mints no jobs, deletes
 *           nothing; the judge is a reader, not a builder.
 *
 * Run twice: the second arc exercises the LIVE upsert (same job,
 * newest wins — the stamp's `at` must move forward).
 *
 * Usage: node scripts/t565b-verdict-stamp-live-fire.mjs [run-tag]
 */

const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/` };
const SHJ = { ...SH, "Content-Type": "application/json" };
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const CLASS2D_NAME = "class2d K5";
const TAG = process.argv[2] ?? "run1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function postChat(body) {
  const r = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST", headers: SHJ, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  return { status: r.status, ...j };
}
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
async function chat(sessionId, message, { maxTurns = 14, label = "" } = {}) {
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
  const toolResults = events.filter((e) => e.type === "tool_result");
  return {
    label, sessionId: sid, turns: guard + 1, ms: Date.now() - t0,
    toolSequence: events.filter((e) => e.type === "tool_call").map((c) => c.name),
    toolResults,
    events,
    finalText: [...events].reverse().find((e) => e.type === "assistant_text")?.text ?? "",
  };
}

const api = async (verb, path) => {
  const r = await fetch(`${BASE}${path}`, { method: verb, headers: SH });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const { execSync } = await import("node:child_process");
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};

/* ---- world guard ------------------------------------------------------- */
const projs = await api("GET", "/api/projects");
const active = (projs.body?.projects ?? []).find((p) => p.active || p.isActive);
if (!active || active.id !== EMPIAR_ID) {
  console.error(`FATAL: active world is ${active?.id ?? "?"}, expected EMPIAR ${EMPIAR_ID}`);
  process.exit(2);
}
const roster0 = active.stats.total;
console.log(`world guard ok — EMPIAR active, roster ${roster0} [${TAG}]`);

const class2d = (await api("GET", "/api/jobs")).body?.jobs
  ?.find((j) => j.type === "class2d" && j.status === "completed");
if (!class2d) { console.error("FATAL: no completed class2d — no judge face."); process.exit(2); }

// run2's upsert proof: if a stamp already exists, the re-judge must move
// its `at` forward (one job, one stamp, newest wins — live, not just in
// the unit test)
const preStamp = (await api("GET", `/api/jobs/${class2d.id}/ai-verdict`)).body?.stamp ?? null;
const prevAt = preStamp?.at ?? 0;
if (prevAt > 0) console.log(`    existing stamp found (prevAt ${new Date(prevAt).toISOString()}) — upsert must advance it`);

/* ---- the judge arc (fresh session, t552 reset form) -------------------- */
const fresh = await postChat({ action: "reset" });
const sid = fresh.sessionId;
check("reset door returns a fresh sessionId", !!sid, sid ?? "");
if (!sid) process.exit(2);

const t1 = await chat(sid, `Judge the 2D classes of ${CLASS2D_NAME} — which classes should I keep?`, { label: "T1 judge" });
check("judge_2d_classes called", t1.toolSequence.includes("judge_2d_classes"), t1.toolSequence.join(" → "));
const judgeRes = t1.toolResults.find((e) => e.name === "judge_2d_classes");
check("judge tool ok", judgeRes?.ok === true, (judgeRes?.summary ?? "").slice(0, 120));

// the summary line is the chat-side truth: "N keep / M maybe"
const sumM = /:\s*(\d+) keep \/ (\d+) maybe/.exec(judgeRes?.summary ?? "");
check("summary line parseable (N keep / M maybe)", !!sumM, judgeRes?.summary?.slice(0, 90));
const sumKeep = sumM ? Number(sumM[1]) : -1;
const sumMaybe = sumM ? Number(sumM[2]) : -1;
const judgedCount = (judgeRes?.detail?.judgedClasses ?? []).length;

/* ---- the route serves the stamp ----------------------------------------- */
let stamp = null;
for (let i = 0; i < 10; i++) {
  const r = await api("GET", `/api/jobs/${class2d.id}/ai-verdict`);
  if (r.body?.available) { stamp = r.body.stamp; break; }
  await sleep(500);
}
check("stamp available for the class2d job", !!stamp);
if (stamp) {
  check("stamp keyed to THIS job", stamp.jobId === class2d.id, stamp.jobId);
  check("counts match the chat-side summary EXACTLY",
    stamp.counts.keep === sumKeep && stamp.counts.maybe === sumMaybe,
    `stamp ${stamp.counts.keep}/${stamp.counts.maybe} vs summary ${sumKeep}/${sumMaybe}`);
  check("classes match judgedClasses length", stamp.classes.length === judgedCount,
    `${stamp.classes.length} vs ${judgedCount}`);
  check("model named (the notebook's who)", typeof stamp.model === "string" && stamp.model.length > 0, stamp.model);
  check("two-pass shape sane (or honest null)",
    stamp.twoPass === null ||
    (Number.isInteger(stamp.twoPass?.agreed) && Number.isInteger(stamp.twoPass?.torn)),
    stamp.twoPass ? `${stamp.twoPass.agreed} agreed, ${stamp.twoPass.torn} torn` : "null");
  check("advice carries", typeof stamp.advice === "string" && stamp.advice.length > 0, `${stamp.advice.length} chars`);
  check("at is recent", stamp.at > Date.now() - 30 * 60_000, new Date(stamp.at).toISOString());
  if (prevAt > 0) {
    check("LIVE upsert: re-judge advanced the stamp", stamp.at > prevAt,
      `${new Date(prevAt).toISOString()} → ${new Date(stamp.at).toISOString()}`);
  }
  globalThis.__t565_prevAt = stamp.at;
}

/* ---- the card, in the browser -------------------------------------------- */
try {
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3000);
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "${CLASS2D_NAME}" >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(2500);
  const CARD_JS = "document.querySelector(\"[data-canvas-ui='ai-verdict-stamp']\")?.innerText || ''";
  let card = null;
  for (let i = 0; i < 20; i++) {
    const raw = sh(`agent-browser eval ${JSON.stringify(CARD_JS)} 2>/dev/null`).replace(/^"|"$/g, "").trim();
    if (raw) { card = raw; break; }
    await sleep(500);
  }
  check("AI verdict card mounted on the class2d Results tab", !!card);
  if (card) {
    check("header present", /AI verdict/i.test(card));
    // the keep chip is CONDITIONAL by design (zero-keep verdicts render no
    // keep chip — the card's honest absence, run2's live catch): assert
    // presence when the verdict has keeps, ABSENCE when it does not
    if (stamp?.counts.keep > 0) {
      check("keep count chip", new RegExp(`${stamp.counts.keep} keep`).test(card), `${stamp.counts.keep} keep`);
    } else {
      check("zero-keep face: no keep chip (honest absence)", !/\d+ keep/.test(card), "verdict had 0 keeps, card shows none");
    }
    check("per-class verdict chips present", /class \d+/i.test(card));
    check("notebook footer: asked date", /asked/i.test(card));
    check("notebook footer: model", card.includes(stamp?.model ?? "⟨missing-model⟩"));
    check("notebook footer: pass summary", /two-pass|single read/i.test(card),
      (card.match(/two-pass[^\n]*|single read/i) ?? [""])[0]);
    try {
      sh(`agent-browser screenshot '[data-canvas-ui="ai-verdict-stamp"]' .qa-logs/shots/t565b-verdict-card-${TAG}.png >/dev/null 2>&1`);
      console.log(`  📸 .qa-logs/shots/t565b-verdict-card-${TAG}.png`);
    } catch { /* best effort */ }
  }
  const errs = sh(`agent-browser errors 2>/dev/null`).trim();
  check("console clean", errs === "", errs ? errs.slice(0, 80) : "0 errors");
} finally {
  try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* gone */ }
}

/* ---- world: zero drift (the judge mints nothing) -------------------------- */
const roster1 = (await api("GET", "/api/projects")).body?.projects.find((p) => p.id === EMPIAR_ID);
check("roster untouched (the judge is a reader)", roster1.stats.total === roster0, `${roster0} → ${roster1.stats.total}`);

console.log(`\n${pass} pass, ${fail} fail [${TAG}]`);
process.exit(fail === 0 ? 0 : 1);
