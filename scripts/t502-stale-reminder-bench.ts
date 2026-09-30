/**
 * t502 — the old answer admits its age. The live incident (t501's
 * three-act drama): the panel restored a persisted session and the model
 * answered from the tool results ALREADY in history — never re-measuring.
 * Old readings wore the costume of current truth. The cure has two faces
 * and one threshold (stale-history.ts, a pure module both drink):
 *
 *   T1 the threshold — behavioral: aged tool results are stale, fresh
 *                      ones are not, the boundary is strict, a transcript
 *                      without tools is never stale
 *   T2 the model face — buildSystemPrompt carries the STALE HISTORY
 *                      REMINDER only when the flag says so (and it is
 *                      absent for false AND undefined — old callers safe)
 *   T3 the wiring     — agent.ts arms the flag on a new user turn BEFORE
 *                      the push, passes it into the prompt ctx, and never
 *                      stores the reminder (transcript stays plain)
 *   T4 the human face — the panel floats the one-time banner on restore
 *                      (rehydrate AND drawer switch), clears it on send
 *                      and new chat, persists nothing
 *   T5 the neighbors  — t500's stale-session notice, the rehydrate deps,
 *                      prompt law 16 and the notice event variant intact;
 *                      the reminder lives in exactly ONE file
 */

import { readFileSync } from "fs";

/* t503 — the checkout moves between sandbox resets (my-project era ->
 * cryoflow home); resolve the repo root from THIS file, not a
 * hardcoded absolute path that rots the bench the moment the tree moves. */
const REPO = (await import("node:path")).default.resolve(
  (await import("node:url")).fileURLToPath(new URL(".", import.meta.url)),
  "..",
);

let pass = 0;
let fail = 0;
function ok(cond: unknown, label: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
function section(t: string): void {
  console.log(`\n== ${t}`);
}

const read = (p: string): string => readFileSync(`${REPO}/${p}`, "utf8");
const { hasAgedToolHistory, STALE_HISTORY_MS } = await import("../src/lib/ai/stale-history");
const { buildSystemPrompt } = await import("../src/lib/ai/prompt");

const agentSrc = read("src/lib/ai/agent.ts");
const promptSrc = read("src/lib/ai/prompt.ts");
const panelSrc = read("src/components/ai/assistant-panel.tsx");
const typesSrc = read("src/lib/ai/types.ts");

// ---------------------------------------------------------------- T1
section("T1 the threshold — aged readings are history, fresh ones are not");
const MIN = 60 * 1000;
const toolAt = (at: number) => [{ role: "user", at: 1 }, { role: "tool", at }];
const NOW = 1_000_000_000_000;
ok(hasAgedToolHistory(toolAt(NOW - 11 * MIN), NOW) === true, "tool results 11 minutes old are history");
ok(hasAgedToolHistory(toolAt(NOW - 1 * MIN), NOW) === false, "tool results 1 minute old are still readings");
ok(hasAgedToolHistory([{ role: "user", at: NOW - 99 * MIN }, { role: "assistant", at: NOW - 98 * MIN }], NOW) === false, "a transcript without tool results is never stale");
ok(hasAgedToolHistory(toolAt(NOW - STALE_HISTORY_MS), NOW) === false, "the boundary is strict: exactly the window is not yet old");
ok(hasAgedToolHistory(toolAt(NOW - STALE_HISTORY_MS - 1), NOW) === true, "one ms past the window flips the answer");
ok(STALE_HISTORY_MS === 10 * 60 * 1000, "the window is ten minutes, one named constant");

// ---------------------------------------------------------------- T2
section("T2 the model face — the reminder rides the rebuilt prompt only");
const stalePrompt = buildSystemPrompt({
  projectName: "P",
  projectMode: "spa",
  projectRemote: null,
  jobCount: 3,
  staleHistory: true,
});
const freshPrompt = buildSystemPrompt({
  projectName: "P",
  projectMode: "spa",
  projectRemote: null,
  jobCount: 3,
});
ok(/STALE HISTORY REMINDER/.test(stalePrompt), "a stale-history turn carries the reminder");
ok(/RE-RUN the matching tool/.test(stalePrompt) && /NOT a source of current truth/.test(stalePrompt), "the reminder speaks the doctrine: re-run, history is not truth");
ok(!/STALE HISTORY REMINDER/.test(freshPrompt), "a fresh turn stays silent");
const compatPrompt = buildSystemPrompt({
  projectName: "P",
  projectMode: "spa",
  projectRemote: null,
  jobCount: 3,
  staleHistory: undefined,
});
ok(!/STALE HISTORY REMINDER/.test(compatPrompt), "undefined stays silent too (old callers safe)");

// ---------------------------------------------------------------- T3
section("T3 the wiring — armed before the push, stored never");
ok(/import \{ hasAgedToolHistory \} from "\.\/stale-history";/.test(agentSrc), "agent.ts drinks the one well");
const armIdx = agentSrc.indexOf("staleHistory = hasAgedToolHistory(session.messages, Date.now())");
const pushIdx = agentSrc.indexOf('session.messages.push({ role: "user", content: message, at: Date.now() })');
ok(armIdx > -1 && pushIdx > -1 && armIdx < pushIdx, "the flag is armed BEFORE the user turn joins the transcript");
ok(/staleHistory,\n  \}\);/.test(agentSrc) || /staleHistory,/.test(agentSrc.slice(agentSrc.indexOf("buildSystemPrompt("), agentSrc.indexOf("buildSystemPrompt(") + 300)), "the prompt ctx carries the flag");
ok(!agentSrc.includes("STALE HISTORY REMINDER"), "the reminder never enters agent.ts — the transcript stays plain (t483 door law)");
ok((agentSrc.match(/let staleHistory = false;/g) ?? []).length === 1, "the flag defaults off — a continue's mid-loop tool chatter never arms it");

// ---------------------------------------------------------------- T4
section("T4 the human face — a one-time banner, cleared by life, stored never");
ok(/import \{ hasAgedToolHistory \} from "@\/lib\/ai\/stale-history";/.test(panelSrc), "the panel drinks the same well");
const arms = panelSrc.match(/setStaleBanner\(hasAgedToolHistory\(data\.session\.messages, Date\.now\(\)\)\)/g) ?? [];
ok(arms.length === 2, "restore arms the banner twice: rehydrate AND the drawer switch");
const clears = panelSrc.match(/setStaleBanner\(false\)/g) ?? [];
ok(clears.length === 3, "life clears it three ways: empty restore, send, new chat");
ok(/data-stale-banner/.test(panelSrc) && /role="status"/.test(panelSrc), "the banner is marked for tests and announced to ears");
ok(panelSrc.includes("测量读数可能已过期") && panelSrc.includes("工具会重新测量"), "the copy says the honest thing: readings may be stale, asking re-measures");
ok(!/localStorage\.setItem\([^\n]*stale/i.test(panelSrc), "the banner persists nothing — ephemeral React state only");

// ---------------------------------------------------------------- T5
section("T5 the neighbors — the world around the reminder is untouched");
ok(/staleNotice\) events\.push\(\{ type: "notice", message: staleNotice \}\)/.test(agentSrc), "t500's stale-session notice still rides the session boundary");
ok(/\[open, activeWorkspaceId\]/.test(panelSrc), "the rehydrate effect's deps stay open + workspace");
ok(/16\. THE ACTION BLOCK LAW/.test(promptSrc), "prompt law 16 stands untouched");
ok(/\{ type: "notice";/.test(typesSrc) || /type: "notice"/.test(typesSrc), "the notice event variant stands untouched");
ok((promptSrc.match(/STALE HISTORY REMINDER/g) ?? []).length === 1, "the reminder lives in exactly one face (no twin)");

// ----------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
