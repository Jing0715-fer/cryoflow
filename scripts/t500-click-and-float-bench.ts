/**
 * t500 — the assistant learns to be CLICKED and MOVED. The user's ticket
 * had two halves and one ghost:
 *
 *   1. "最后的几种方案应该做成选项，点击后就按照这个执行" — an
 *      analysis that ends in 方案 A/B/C made the user TYPE the choice
 *      back. Now the model closes decision-bearing replies with a
 *      :::actions fence; the panel renders buttons; the click IS a user
 *      turn through the same send() engine.
 *   2. "AI助手的窗口改成可以自由移动和调整大小" — the fixed right Sheet
 *      covered the canvas and could not be moved. Now a floating
 *      window: drag by header, resize from three grips, double-click
 *      resets home, geometry persists; mobile keeps the full face.
 *   3. (the ghost, from the same session) "切换project后用AI分析出现
 *      Session not found" — a stale sessionId across a project switch
 *      hard-errored. Now the server falls back to the project's own
 *      latest chat with a notice, and the panel rehydrates when the
 *      workspace switches underneath it.
 *
 *   T1 the parser    — parseActionBlocks: blocks mint actions, broken
 *                      JSON degrades to visible markdown (never
 *                      deleted), code fences are immune, caps hold
 *   T2 the render    — the panel wires the buttons through send(),
 *                      disabled while busy; info notices ride the
 *                      muted banner
 *   T3 the prompt     — law 16 teaches the protocol; doctrine 5 sends
 *                      ambiguous selections to it
 *   T4 the fallback   — the agent no longer hard-errors a stale
 *                      session; notice events exist; the panel
 *                      rehydrates on workspace switch and stops a
 *                      live loop first
 *   T5 the window     — floating, draggable, resizable, persisted,
 *                      clamped; mobile full-screen; Esc layered
 *   T6 the neighbors  — linkify + prose doors ride the md segments
 *                      untouched; the composer contract unchanged
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

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
function eq(a: unknown, b: unknown, label: string): void {
  ok(a === b, `${label} (got ${JSON.stringify(a)})`);
}

const read = (p: string): string => readFileSync(`${REPO}/${p}`, "utf8");
const panelSrc = read("src/components/ai/assistant-panel.tsx");
const agentSrc = read("src/lib/ai/agent.ts");
const promptSrc = read("src/lib/ai/prompt.ts");
const typesSrc = read("src/lib/ai/types.ts");

// behavior: the real parser, not a re-typed twin
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseActionBlocks, parseActionBody, MAX_ACTIONS } = require(`${REPO}/src/lib/ai/action-blocks.ts`) as {
  parseActionBlocks: (text: string) => Array<{ kind: "md" | "actions"; text?: string; actions?: { label: string; prompt: string }[] }>;
  parseActionBody: (body: string) => { label: string; prompt: string }[] | null;
  MAX_ACTIONS: number;
};

const GOOD_BLOCK = `分析完成：6 个 keep 类。

:::actions
[{"label":"方案 A · 只保留 6 个 keep 类","prompt":"从「2D Classification 1」创建选择任务，只保留 class 3,4,11,26,35,38"},{"label":"方案 B · keep + 灰色地带","prompt":"从「2D Classification 1」创建选择任务，保留 class 1,3,4,7,11,26,35,38"}]
:::

选好后告诉我。`;

// ---------------------------------------------------------------- T1
section("T1 the parser — blocks mint actions, junk degrades visibly");

{
  const segs = parseActionBlocks(GOOD_BLOCK);
  eq(segs.length, 3, "prose + actions + prose = 3 segments");
  eq(segs[0].kind, "md", "leading analysis is markdown");
  eq(segs[1].kind, "actions", "the fence mints an actions segment");
  eq(segs[1].actions?.length, 2, "both options survive");
  eq(
    segs[1].actions?.[0].prompt,
    "从「2D Classification 1」创建选择任务，只保留 class 3,4,11,26,35,38",
    "the prompt rides verbatim (the click sends THESE words)",
  );
  eq(segs[2].kind, "md", "trailing prose is markdown");
}

{
  // broken JSON never deletes the model's words — the reader still sees them
  const broken = `建议如下

:::actions
[{label: 方案A, prompt: 未闭合的 JSON}]
:::`;
  const segs = parseActionBlocks(broken);
  ok(
    segs.every((s) => s.kind === "md"),
    "a malformed block degrades to markdown",
  );
  ok(
    segs.some((s) => s.kind === "md" && s.text?.includes(":::actions")),
    "degradation keeps the raw fence VISIBLE (honesty over magic)",
  );
}

{
  // entries missing label or prompt are filtered; all-bad = degrade
  eq(parseActionBody(`[{"label":"A"},{"prompt":"x"},{"label":"B","prompt":"y"}]`)?.length, 1, "label-less and prompt-less entries drop");
  eq(parseActionBody(`[{"label":"","prompt":"x"}]`), null, "all-bad body = no actions");
  eq(parseActionBody(`{"label":"object not array"}`), null, "a JSON object (not array) = no actions");
  eq(parseActionBody(`not json at all`), null, "non-JSON body = no actions");
}

{
  // the cap holds — a wall of buttons is noise
  const many = Array.from({ length: 9 }, (_, i) => ({ label: `方案 ${i}`, prompt: `do ${i}` }));
  eq(parseActionBody(JSON.stringify(many))?.length, MAX_ACTIONS, `entries cap at MAX_ACTIONS (${MAX_ACTIONS})`);
  eq(MAX_ACTIONS, 5, "the cap is five");
}

{
  // code fences are immune — the model documenting the protocol must
  // not mint buttons from its own documentation
  const doc = `协议长这样：

\`\`\`
:::actions
[{"label":"示例","prompt":"示例指令"}]
:::
\`\`\`

以上只是说明。`;
  const segs = parseActionBlocks(doc);
  ok(
    segs.every((s) => s.kind === "md"),
    "a fence inside triple-backticks is prose-immune",
  );
}

{
  // multiple blocks and no-block text both behave
  const two = `A

:::actions
[{"label":"一","prompt":"p1"}]
:::

B

:::actions
[{"label":"二","prompt":"p2"}]
:::`;
  const segs = parseActionBlocks(two);
  eq(segs.filter((s) => s.kind === "actions").length, 2, "two blocks mint two segments");
  const plain = parseActionBlocks("只是普通文本，没有块。");
  eq(plain.length, 1, "plain text stays one md segment");
  eq(plain[0].kind, "md", "…and it is markdown");
}

{
  // an unclosed fence degrades (no closing :::)
  const unclosed = `x

:::actions
[{"label":"一","prompt":"p1"}]`;
  const segs = parseActionBlocks(unclosed);
  ok(segs.every((s) => s.kind === "md"), "an unclosed fence degrades to markdown");
}

// ---------------------------------------------------------------- T2
section("T2 the render — the buttons send, the info notice lands");

ok(panelSrc.includes("import { parseActionBlocks, type AssistantAction }"), "the panel imports the real parser");
ok(panelSrc.includes("parseActionBlocks(item.text).map"), "the assistant bubble renders from segments");
ok(
  panelSrc.includes("onPick={(p) => void send(p)}") && panelSrc.includes("disabled={busy}"),
  "a click rides the SAME send() engine, disabled while busy",
);
ok(panelSrc.includes('aria-label="建议的操作"'), "the button group is labelled");
ok(
  panelSrc.includes('item.variant === "info"') && panelSrc.includes('e.type === "notice"'),
  "notice events render through the muted info banner",
);

// ---------------------------------------------------------------- T3
section("T3 the prompt — law 16 teaches the protocol");

ok(promptSrc.includes("THE ACTION BLOCK LAW"), "law 16 exists");
ok(promptSrc.includes(":::actions"), "the prompt shows the exact fence");
ok(
  promptSrc.includes("each prompt is a SELF-CONTAINED instruction the agent can execute much later"),
  "self-containment is the law (the click may come much later)",
);
ok(
  /NO action block when only ONE sensible path exists/.test(promptSrc),
  "single-path replies stay prose (no fake choices)",
);
ok(
  /present them as an ACTION BLOCK \(law 16\)/.test(promptSrc),
  "doctrine 5 routes ambiguous class selections to the block",
);

// ---------------------------------------------------------------- T4
section("T4 the fallback — the stale session follows the world");

ok(
  !agentSrc.includes("Session not found (it may belong to another project)"),
  "the hard error is GONE (the old dead-end verdict)",
);
ok(
  agentSrc.includes("已自动切换到当前项目的对话") && agentSrc.includes("上一个会话已不存在"),
  "the fallback speaks both stale shapes (other project / vanished)",
);
ok(
  agentSrc.includes("latestSessionForProject(active.project.id) ?? createSession(active.project.id)"),
  "the fallback lands on the project's own latest chat (or a fresh one)",
);
ok(
  /events: \[\.\.\.events, \{ type: "error"/.test(agentSrc),
  "every early-return path carries the notice prefix (it rides all outcomes)",
);
ok(typesSrc.includes('| { type: "notice"; message: string }'), "the wire vocabulary has the notice event");
ok(
  panelSrc.includes("[open, activeWorkspaceId]"),
  "the panel rehydrates when the workspace switches underneath it",
);
ok(
  panelSrc.includes("const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);"),
  "…subscribing to the store's workspace id",
);

// ---------------------------------------------------------------- T5
section("T5 the window — floating, draggable, resizable, persisted");

ok(!panelSrc.includes('from "@/components/ui/sheet"'), "the Radix Sheet import is retired for this panel");
ok(
  panelSrc.includes('role="dialog"') && panelSrc.includes('aria-modal="false"'),
  "a NON-modal dialog (the canvas keeps its clicks)",
);
ok(
  panelSrc.includes('"cryoflow.assistant.geometry.v1"'),
  "geometry persists in localStorage",
);
ok(
  panelSrc.includes("function clampGeo") && panelSrc.includes("function defaultGeo"),
  "clamp + default-home laws exist as functions",
);
ok(
  panelSrc.includes('closest("button, input, a, textarea, [data-nodrag]")'),
  "the header's own controls never drag (the X still clicks)",
);
ok(
  /beginDrag\(e, "e"\)/.test(panelSrc) && /beginDrag\(e, "s"\)/.test(panelSrc) && /beginDrag\(e, "se"\)/.test(panelSrc),
  "three resize grips (east edge, south edge, corner)",
);
ok(
  /hdr\.addEventListener\("dblclick", onDbl\)/.test(panelSrc) && /\[isMobile, open\]/.test(panelSrc),
  "double-click the header snaps home (native listener — rebinds on reopen)",
);
ok(
  panelSrc.includes('closest("[data-session-search]")') && panelSrc.includes("setOpen(false);"),
  "layered Esc: live query clears first, empty query closes",
);
ok(
  panelSrc.includes('isMobile\n          ? "inset-0 z-50"'),
  "mobile keeps the honest full-screen face",
);
ok(
  panelSrc.includes("GEO_MIN_W = 360") && panelSrc.includes("GEO_MIN_H = 420"),
  "minimum geometry laws (a 100px chat is not a chat)",
);

// ---------------------------------------------------------------- T6
section("T6 the neighbors — doors and composer untouched");

ok(
  panelSrc.includes("linkifyJobs(seg.text, jobs)"),
  "job-name doors ride the md SEGMENTS (not just the whole text)",
);
ok(
  panelSrc.includes("PROSE_COMPONENTS") && panelSrc.includes("urlTransformKeepDoors"),
  "the prose door + its sanitizer-survival ride on",
);
ok(
  panelSrc.includes("e.nativeEvent.isComposing"),
  "the IME composition guard survives the container swap",
);
ok(
  panelSrc.includes("consumeAiPendingPrompt"),
  "the class gallery's「AI 分析」one-shot door survives",
);

/* ---------------------------------------------------------------- */
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
