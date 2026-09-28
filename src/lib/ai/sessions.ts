/**
 * CryoFlow — AI assistant conversation store (SERVER ONLY).
 *
 * t419 — sessions persist as data/ai-assistant.json, the same JSON-file
 * convention the engine uses for run records (the frozen-schema doctrine:
 * engine state stays out of the Prisma schema). No secrets here — only the
 * normalized transcript — so plain atomic-rename persistence suffices.
 *
 * The client drives the loop: each POST /api/ai/chat runs ONE model turn;
 * `continue` re-enters after tool executions. Sessions are keyed by id,
 * pinned to the project they were born in, and the store answers the
 * latest session of a project for rehydration (panel reopen survives).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/paths";
import type { AiMessage, AiSessionDto, AiSessionSummaryDto } from "./types";

const SESSIONS_FILE = path.join(DATA_DIR, "ai-assistant.json");

/** A session IS its DTO — the server owns the same shape the client reads. */
export type AiSession = AiSessionDto;

interface SessionsFile {
  version: 1;
  sessions: AiSession[];
}

/** Keep the newest N sessions — the file is a convenience cache, not an archive. */
const MAX_SESSIONS = 20;
/** A single user message can never drive an unbounded tool spiral. */
const MAX_TOOL_CALLS_PER_SESSION = 80;
const MAX_MESSAGE_CHARS = 24_000;
/** t428 — the user's rename is a bookmark, not a novel. */
export const MAX_SESSION_TITLE_CHARS = 80;

function sanitizeMessage(m: AiMessage): AiMessage | null {
  if (m.role === "user" || m.role === "assistant") {
    const content = typeof m.content === "string" ? m.content.slice(0, MAX_MESSAGE_CHARS) : "";
    if (m.role === "assistant") {
      const toolCalls = (m.toolCalls ?? []).slice(0, 16).map((c) => ({
        id: String(c.id).slice(0, 64),
        name: String(c.name).slice(0, 64),
        args: c.args ?? {},
      }));
      return {
        role: "assistant",
        content,
        at: Number.isFinite(m.at) ? m.at : Date.now(),
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      };
    }
    return { role: "user", content, at: Number.isFinite(m.at) ? m.at : Date.now() };
  }
  if (m.role === "tool") {
    return {
      role: "tool",
      toolCallId: String(m.toolCallId).slice(0, 64),
      name: String(m.name).slice(0, 64),
      content: typeof m.content === "string" ? m.content.slice(0, MAX_MESSAGE_CHARS) : "",
      ...(m.isError ? { isError: true } : {}),
      at: Number.isFinite(m.at) ? m.at : Date.now(),
    };
  }
  return null;
}

export function loadSessions(): AiSession[] {
  try {
    if (existsSync(SESSIONS_FILE)) {
      const parsed = JSON.parse(readFileSync(SESSIONS_FILE, "utf8")) as Partial<SessionsFile>;
      if (parsed && Array.isArray(parsed.sessions)) {
        const out: AiSession[] = [];
        for (const s of parsed.sessions) {
          if (!s || typeof s !== "object" || typeof s.id !== "string") continue;
          const messages = (Array.isArray(s.messages) ? s.messages : [])
            .map(sanitizeMessage)
            .filter((m): m is AiMessage => m != null);
          out.push({
            id: s.id,
            projectId: typeof s.projectId === "string" ? s.projectId : "",
            createdAt: Number.isFinite(s.createdAt) ? s.createdAt : Date.now(),
            updatedAt: Number.isFinite(s.updatedAt) ? s.updatedAt : Date.now(),
            title:
              typeof s.title === "string" && s.title.trim()
                ? s.title.trim().slice(0, MAX_SESSION_TITLE_CHARS)
                : null,
            messages,
          });
        }
        return out;
      }
    }
  } catch {
    /* corrupt file → empty store */
  }
  return [];
}

function writeSessions(sessions: AiSession[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const trimmed = sessions.slice(-MAX_SESSIONS);
  const tmp = `${SESSIONS_FILE}.tmp-${Date.now().toString(36)}`;
  writeFileSync(tmp, JSON.stringify({ version: 1, sessions: trimmed } satisfies SessionsFile, null, 2));
  renameSync(tmp, SESSIONS_FILE);
}

export function getSession(id: string): AiSession | null {
  return loadSessions().find((s) => s.id === id) ?? null;
}

export function latestSessionForProject(projectId: string): AiSession | null {
  const sessions = loadSessions().filter((s) => s.projectId === projectId);
  return sessions.length > 0 ? sessions[sessions.length - 1] : null;
}

/**
 * t423 — the history drawer's food: summaries of a project's non-empty
 * sessions, newest conversation first. Empty sessions (a reset the user
 * never spoke into) are furniture, not history — they don't earn a row.
 * The preview is the first USER message: "what this conversation was
 * about" is the only indexing key a human needs.
 */
export function listSessionSummaries(projectId: string): AiSessionSummaryDto[] {
  const out: AiSessionSummaryDto[] = [];
  for (const s of loadSessions()) {
    if (s.projectId !== projectId || s.messages.length === 0) continue;
    const firstUser = s.messages.find((m) => m.role === "user");
    let toolCount = 0;
    for (const m of s.messages) if (m.role === "assistant") toolCount += m.toolCalls?.length ?? 0;
    out.push({
      id: s.id,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s.messages.length,
      toolCount,
      preview: firstUser ? firstUser.content.slice(0, 96) : "(no user message)",
      title: s.title,
    });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createSession(projectId: string): AiSession {
  const session: AiSession = {
    id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: null,
    messages: [],
  };
  const sessions = loadSessions();
  sessions.push(session);
  writeSessions(sessions);
  return session;
}

export function saveSession(session: AiSession): void {
  const sessions = loadSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  session.updatedAt = Date.now();
  if (idx >= 0) sessions[idx] = session;
  else sessions.push(session);
  writeSessions(sessions);
}

export function deleteSession(id: string): boolean {
  const sessions = loadSessions();
  const next = sessions.filter((s) => s.id !== id);
  if (next.length === sessions.length) return false;
  writeSessions(next);
  return true;
}

/**
 * t428 — the drawer's rename door. Deliberately NOT saveSession: a rename
 * must not bump updatedAt, or every rename floats the conversation to the
 * top of the newest-first drawer and destroys the chronological signal.
 * Empty/whitespace title clears the rename (back to the preview name).
 * The result is discriminated — ok:false is ONLY "unknown session",
 * ok:true with title:null is a cleared rename (the two nulls must never
 * blur, or clearing a title reads as a 404).
 */
export function renameSession(id: string, rawTitle: string): { ok: boolean; title: string | null } {
  const sessions = loadSessions();
  const session = sessions.find((s) => s.id === id);
  if (!session) return { ok: false, title: null };
  const title = rawTitle.trim().slice(0, MAX_SESSION_TITLE_CHARS);
  session.title = title.length > 0 ? title : null;
  writeSessions(sessions);
  return { ok: true, title: session.title };
}

/* ------------------------------------------------------------------ */
/* Guards                                                               */
/* ------------------------------------------------------------------ */

export function toolCallsUsed(session: AiSession): number {
  let n = 0;
  for (const m of session.messages) if (m.role === "assistant") n += m.toolCalls?.length ?? 0;
  return n;
}

export const TOOL_CALL_BUDGET = MAX_TOOL_CALLS_PER_SESSION;

/** The number of model turns since the last USER message (the continuation
 * cap — a client stuck in a continue loop cannot burn tokens forever). */
export function turnsSinceLastUser(session: AiSession): number {
  let n = 0;
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const m = session.messages[i];
    if (m.role === "user") break;
    if (m.role === "assistant") n++;
  }
  return n;
}

export const MAX_CONTINUATION_TURNS = 30;
