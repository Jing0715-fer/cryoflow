/**
 * CryoFlow — AI agent iteration driver (SERVER ONLY).
 *
 * t419 — one POST /api/ai/chat = ONE model turn + its tool executions.
 * The CLIENT drives the loop (needsContinue → immediate continue POST):
 * each tool batch lands on the UI the moment it executed, a closed panel
 * simply stops the loop (the session's transcript already has everything),
 * and no SSE/websocket infra is needed — the app's polling doctrine
 * untouched.
 *
 * Guards: a tool-call budget per session (80) and a continuation cap (30
 * model turns since the last user message) — a stuck client or a
 * tool-looping model can never burn unbounded tokens.
 */

import { getActiveProject } from "@/lib/projects";
import { ensureActiveProject } from "@/lib/seed";
import { resolveAssistant } from "./settings";
import {
  MAX_CONTINUATION_TURNS,
  TOOL_CALL_BUDGET,
  createSession,
  deleteSession,
  getSession,
  latestSessionForProject,
  listSessionSummaries,
  renameSession,
  saveSession,
  toolCallsUsed,
  turnsSinceLastUser,
} from "./sessions";
import { buildSystemPrompt } from "./prompt";
import { hasAgedToolHistory } from "./stale-history";
import { AI_TOOLS, executeAiTool } from "./tools";
import { chatOnce } from "./wire";
import type { AiEvent, AiMessage } from "./types";
import type { AiSession } from "./sessions";

export interface AgentRunResult {
  sessionId: string;
  events: AiEvent[];
  needsContinue: boolean;
  error?: string;
  /** The assistant is not configured — the panel opens the settings dialog. */
  needsSetup?: boolean;
}

export interface AgentRunInput {
  sessionId?: string;
  message?: string;
  cont?: boolean;
  action?: "reset";
}

export async function runAiIteration(input: AgentRunInput): Promise<AgentRunResult> {
  // ---- the assistant must exist before anything else --------------------
  const assistant = resolveAssistant();
  if (!assistant) {
    return {
      sessionId: input.sessionId ?? "",
      events: [{ type: "error", message: "AI provider is not configured yet — open the AI settings, pick a provider, paste its API key and choose a model." }],
      needsContinue: false,
      needsSetup: true,
    };
  }

  // ---- project + session ------------------------------------------------
  const active = await ensureActiveProject();
  if (!active) {
    return {
      sessionId: "",
      events: [{ type: "error", message: "No active project — create one first." }],
      needsContinue: false,
    };
  }
  if (input.action === "reset") {
    const fresh = createSession(active.project.id);
    return { sessionId: fresh.id, events: [], needsContinue: false };
  }

  let session = input.sessionId ? getSession(input.sessionId) : null;
  // t498 — a stale sessionId (the panel held another project's session
  // across a project switch, or the stored session vanished) is NOT a dead
  // end: fall back to this project's latest conversation (or a fresh one)
  // and SAY so in a notice. The old behavior hard-errored "Session not
  // found" and made the user click New chat by hand — the world moved, the
  // conversation follows it.
  let staleNotice: string | null = null;
  if (input.sessionId && (!session || session.projectId !== active.project.id)) {
    staleNotice = session
      ? "已自动切换到当前项目的对话 — 上一个会话属于另一个项目。"
      : "上一个会话已不存在 — 已切换到当前项目最近的对话。";
    session = null;
  }
  if (!session) {
    session = latestSessionForProject(active.project.id) ?? createSession(active.project.id);
  }
  const events: AiEvent[] = [];
  if (staleNotice) events.push({ type: "notice", message: staleNotice });

  // ---- new user message --------------------------------------------------
  // t502 — the old answer admits its age: tool results in a restored
  // session are readings of a world that moved on. The reminder rides the
  // system prompt (rebuilt every request, never stored) — only on a NEW
  // user turn; a continue's tool chatter is mid-loop and fresh.
  let staleHistory = false;
  const message = typeof input.message === "string" ? input.message.trim().slice(0, 8000) : "";
  if (!message && !input.cont) {
    return {
      sessionId: session.id,
      events: [...events, { type: "error", message: "Nothing to send — provide a message or continue." }],
      needsContinue: false,
    };
  }
  if (message) {
    staleHistory = hasAgedToolHistory(session.messages, Date.now());
    session.messages.push({ role: "user", content: message, at: Date.now() });
  } else {
    // a continue needs a pending tool round: the last message must be a
    // tool result (its assistant turn had the calls)
    const last = session.messages[session.messages.length - 1];
    if (!last || last.role !== "tool") {
      return {
        sessionId: session.id,
        events: [...events, { type: "error", message: "Nothing to continue — the last turn is complete." }],
        needsContinue: false,
      };
    }
    if (turnsSinceLastUser(session) >= MAX_CONTINUATION_TURNS) {
      session.messages.push({
        role: "assistant",
        content: "(stopped: the continuation cap was reached — send a new message to continue)",
        at: Date.now(),
      });
      saveSession(session);
      return {
        sessionId: session.id,
        events: [...events, { type: "error", message: `Stopped after ${MAX_CONTINUATION_TURNS} automatic turns — send a new message to continue.` }],
        needsContinue: false,
      };
    }
  }

  // ---- the model turn -----------------------------------------------------
  // (events was minted at the session boundary — a stale-session notice
  // rides every outcome below, including provider errors)
  // the census rides the prompt (cheap: one indexed count)
  let jobCount = 0;
  try {
    const { db } = await import("@/lib/db");
    jobCount = await db.job.count({ where: { projectId: active.project.id } });
  } catch {
    /* count is cosmetic */
  }
  let remoteLabel: string | null = null;
  // seed's ensureActiveProject types meta narrowly (mode/engine) — the
  // runtime object is the full ProjectMeta (remote rides along since t300)
  const meta = active.meta as { mode: string; remote?: { connectionId: string } | null };
  if (meta.remote?.connectionId) {
    const { getConnection } = await import("@/lib/remote/connections");
    const conn = getConnection(meta.remote.connectionId);
    remoteLabel = conn ? (conn.name || `${conn.username}@${conn.host}`) : meta.remote.connectionId;
  }
  const system = buildSystemPrompt({
    projectName: active.project.name,
    projectMode: active.meta.mode,
    projectRemote: remoteLabel,
    jobCount,
    staleHistory,
  });

  let response;
  try {
    response = await chatOnce({
      flavor: assistant.flavor,
      apiKey: assistant.apiKey,
      model: assistant.model,
      baseUrl: assistant.baseUrl,
      system,
      messages: session.messages,
      tools: AI_TOOLS,
    });
  } catch (err) {
    const message2 = err instanceof Error ? err.message : String(err);
    session.messages.push({ role: "assistant", content: `(provider error: ${message2.slice(0, 400)})`, at: Date.now() });
    saveSession(session);
    return {
      sessionId: session.id,
      events: [...events, { type: "error", message: message2.slice(0, 500) }],
      needsContinue: false,
    };
  }

  const assistantMessage: AiMessage = {
    role: "assistant",
    content: response.text,
    at: Date.now(),
  };
  if (response.toolCalls.length > 0) assistantMessage.toolCalls = response.toolCalls;
  session.messages.push(assistantMessage);
  if (response.text) events.push({ type: "assistant_text", text: response.text });

  // ---- tool execution -----------------------------------------------------
  if (response.toolCalls.length > 0) {
    const ctx = { projectId: active.project.id };
    let budget = TOOL_CALL_BUDGET - toolCallsUsed(session);

    for (const call of response.toolCalls) {
      events.push({ type: "tool_call", id: call.id, name: call.name, args: call.args });
      if (budget <= 0) {
        const refusal =
          "The session's tool budget is exhausted — ask the user to start a new chat for more actions.";
        session.messages.push({
          role: "tool",
          toolCallId: call.id,
          name: call.name,
          content: refusal,
          isError: true,
          at: Date.now(),
        });
        events.push({ type: "tool_result", id: call.id, name: call.name, ok: false, summary: refusal });
        continue;
      }
      budget--;
      const result = await executeAiTool(call.name, call.args ?? {}, ctx);
      const content = JSON.stringify({ ok: result.ok, summary: result.summary, detail: result.detail ?? null });
      session.messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content,
        isError: !result.ok,
        at: Date.now(),
      });
      events.push({
        type: "tool_result",
        id: call.id,
        name: call.name,
        ok: result.ok,
        summary: result.summary,
        ...(result.detail !== undefined ? { detail: result.detail } : {}),
      });
    }
    saveSession(session);
    return { sessionId: session.id, events, needsContinue: true };
  }

  // ---- done ---------------------------------------------------------------
  saveSession(session);
  return { sessionId: session.id, events, needsContinue: false };
}

/** Rehydration (GET /api/ai/chat): the latest session of the active project. */
export async function latestSessionForActiveProject(): Promise<{
  session: AiSession | null;
}> {
  const active = await getActiveProject();
  if (!active) return { session: null };
  return { session: latestSessionForProject(active.project.id) };
}

/**
 * t423 — the history drawer's list: this project's past conversations,
 * newest first. An active project is still required — sessions are pinned
 * to the project they were born in, so a projectless world has no history.
 */
export async function listSessionsForActiveProject(): Promise<{
  sessions: Awaited<ReturnType<typeof listSessionSummaries>>;
}> {
  const active = await getActiveProject();
  if (!active) return { sessions: [] };
  return { sessions: listSessionSummaries(active.project.id) };
}

/**
 * t423 — fetch ONE session for the panel's history switch, with the same
 * pinning law the iteration path enforces: a session from another project
 * simply does not exist here (the switch answers "not found", never the
 * other project's transcript).
 */
export async function sessionForActiveProject(id: string): Promise<{
  session: AiSession | null;
  error?: string;
}> {
  const active = await getActiveProject();
  if (!active) return { session: null, error: "No active project." };
  const session = getSession(id);
  if (!session || session.projectId !== active.project.id) {
    return { session: null, error: "Session not found." };
  }
  return { session };
}

/** t423 — delete one session under the same pinning law as the fetch. */
export async function deleteSessionForActiveProject(id: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const active = await getActiveProject();
  if (!active) return { ok: false, error: "No active project." };
  const session = getSession(id);
  if (!session || session.projectId !== active.project.id) {
    return { ok: false, error: "Session not found." };
  }
  return { ok: deleteSession(id) };
}

/**
 * t428 — rename one session under the same pinning law as fetch/delete.
 * Returns the normalized title (null = unnamed) so the route echoes what
 * actually landed; the caller distinguishes "unknown session" from
 * "cleared title" via ok.
 */
export async function renameSessionForActiveProject(
  id: string,
  rawTitle: string
): Promise<{ ok: boolean; title: string | null; error?: string }> {
  const active = await getActiveProject();
  if (!active) return { ok: false, title: null, error: "No active project." };
  const session = getSession(id);
  if (!session || session.projectId !== active.project.id) {
    return { ok: false, title: null, error: "Session not found." };
  }
  const renamed = renameSession(id, rawTitle);
  if (!renamed.ok) return { ok: false, title: null, error: "Session not found." };
  return { ok: true, title: renamed.title };
}
