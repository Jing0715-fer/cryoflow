/**
 * CryoFlow — the assistant's ACTION BLOCK protocol (t500).
 *
 * The user's ticket: an analysis that ends in "方案 A / 方案 B / 方案 C —
 * 你倾向哪种？" forces the user to TYPE the answer back. The decision was
 * already made by the model; the panel should let the user CLICK it.
 *
 * The protocol: the model closes a decision-bearing reply with a fenced
 * block
 *
 *   :::actions
 *   [{"label":"方案 A · 只保留 6 个 keep 类","prompt":"从「2D Classification 1」创建选择任务，保留 class 3,4,11,26,35,38"}]
 *   :::
 *
 * and the panel renders each entry as a button. Pressing the button sends
 * `prompt` back through the SAME send() engine the composer uses — the
 * click IS a user turn, the agent loop runs select_classes/build_pipeline
 * exactly as if the user had typed the words.
 *
 * The parser is deliberately paranoid (weak models mangle fences):
 *  - a block only counts when its body parses as a JSON array
 *  - entries need a non-empty label AND a non-empty prompt (string)
 *  - a failed block NEVER disappears — it degrades to plain markdown so
 *    the reader still sees what the model wrote (honesty over magic)
 *  - at most MAX_ACTIONS entries ride; a wall of buttons is noise
 *
 * Storage stays honest: the session keeps the RAW text (fences and all —
 * the md/json exports carry the protocol verbatim, the same law the t483
 * door lineage set for job links: doors live on the screen, bytes on disk).
 */

/** One clickable option as the panel renders it. */
export interface AssistantAction {
  label: string;
  prompt: string;
}

/** A transcript text split into renderable segments. */
export type AssistantSegment =
  | { kind: "md"; text: string }
  | { kind: "actions"; actions: AssistantAction[] };

export const MAX_ACTIONS = 5;

const FENCE_OPEN = /^:::actions\s*$/;
const FENCE_CLOSE = /^:::\s*$/;

/** Parse one block body (the text between the fences) into actions.
 * Returns null when the body is not a legal actions block (the caller
 * keeps the raw text as markdown — degradation, never deletion). */
export function parseActionBody(body: string): AssistantAction[] | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith("[")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const actions: AssistantAction[] = [];
  for (const raw of parsed) {
    if (actions.length >= MAX_ACTIONS) break;
    if (typeof raw !== "object" || raw === null) continue;
    const label = typeof (raw as { label?: unknown }).label === "string"
      ? ((raw as { label: string }).label).trim()
      : "";
    const prompt = typeof (raw as { prompt?: unknown }).prompt === "string"
      ? ((raw as { prompt: string }).prompt).trim()
      : "";
    if (!label || !prompt) continue;
    actions.push({
      label: label.slice(0, 120),
      prompt: prompt.slice(0, 2000),
    });
  }
  return actions.length > 0 ? actions : null;
}

/**
 * Split an assistant message into markdown and action segments. Fences
 * inside fenced code blocks (``` … ```) are PROSE-IMMUNE — a model showing
 * the protocol as an example must never mint buttons from its own
 * documentation. The scan tracks triple-backtick fences the same way
 * linkify-jobs learned to (code spans are not speech).
 */
export function parseActionBlocks(text: string): AssistantSegment[] {
  const lines = text.split("\n");
  const segments: AssistantSegment[] = [];
  let md: string[] = [];
  let inCodeFence = false;
  let i = 0;

  const flushMd = () => {
    if (md.length > 0) {
      segments.push({ kind: "md", text: md.join("\n") });
      md = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      md.push(line);
      i++;
      continue;
    }
    if (!inCodeFence && FENCE_OPEN.test(line)) {
      // collect until the closing fence
      let j = i + 1;
      const body: string[] = [];
      while (j < lines.length && !FENCE_CLOSE.test(lines[j])) {
        body.push(lines[j]);
        j++;
      }
      if (j < lines.length) {
        const actions = parseActionBody(body.join("\n"));
        if (actions) {
          flushMd();
          segments.push({ kind: "actions", actions });
          i = j + 1;
          continue;
        }
      }
      // no closing fence or not a legal body → the raw text survives as md
    }
    md.push(line);
    i++;
  }
  flushMd();
  return segments;
}
