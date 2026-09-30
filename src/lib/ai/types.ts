/**
 * CryoFlow — AI assistant shared types (client + server safe, no runtime deps).
 *
 * t419 — the AI assistant's wire vocabulary: provider settings DTOs, the
 * normalized conversation transcript, and the per-iteration event stream the
 * panel renders. Server-only modules (settings/sessions/agent) own the
 * persistence; this file only speaks shapes so the client can type the
 * /api/ai/* responses without importing fs-touching code.
 */

/* ------------------------------------------------------------------ */
/* Provider registry (public info — no secrets here)                   */
/* ------------------------------------------------------------------ */

/**
 * The wire dialect a provider speaks. Four dialects cover the market:
 *  - "openai":    OpenAI-compatible /chat/completions + /models (OpenAI,
 *                 DeepSeek, Moonshot, Qwen, OpenRouter, Groq, Mistral, xAI,
 *                 MiniMax, Ollama, any custom endpoint)
 *  - "anthropic": /v1/messages + /v1/models (Claude family)
 *  - "gemini":    generateContent + :generateContent models listing
 *  - "builtin":   t463 — the bundled SDK lane (z-ai-web-dev-sdk). No key,
 *                 no base URL, no HTTP: the SDK client rides in-process.
 *                 The zero-config default when the user has configured
 *                 nothing — where the deployment carries no SDK
 *                 credentials the chat answers an actionable error.
 */
export type AiProviderFlavor = "openai" | "anthropic" | "gemini" | "builtin";

/** One provider catalog entry (GET /api/ai/settings serves these). */
export interface AiProviderSummary {
  id: string;
  label: string;
  /** API docs / key page (opens in a new tab from the settings dialog). */
  docsUrl: string;
  flavor: AiProviderFlavor;
  /** Default API base (custom providers override via the user's baseUrl). */
  baseUrl: string;
  /** Ollama needs no key — everyone else does. */
  needsKey: boolean;
  /** False → the provider has no public models endpoint; the curated list IS the answer. */
  supportsModelList: boolean;
  /** Built-in fallback / suggestion list (shown before any fetch, and the
   * permanent answer for providers without a listing endpoint). */
  curatedModels: string[];
  /** Suggested vision-capable model for the VLM judge (null = use main model). */
  visionDefault: string | null;
  /** True for the user-supplied OpenAI-compatible endpoint. */
  custom: boolean;
  /** Placeholder hint for the API-key input (e.g. "sk-…"). */
  keyHint: string;
}

/* ------------------------------------------------------------------ */
/* Settings (sanitized projection — API keys never cross this line)   */
/* ------------------------------------------------------------------ */

/** Per-provider config as the CLIENT sees it (secret stripped). */
export interface AiProviderConfigDto {
  model: string;
  baseUrl: string | null;
  hasKey: boolean;
  /** Last 4 characters of the stored key ("••••abcd") — enough to recognize,
   * useless for reconstruction. Empty string when no key is stored. */
  keyHint: string;
}

/**
 * t472 — the ACTIVE provider's reachability, probed server-side with a
 * short timeout and served with a TTL cache. The badge wears this so the
 * user learns "the endpoint is dead" from the header instead of from a
 * cryptic chat error (the t468 lesson: fetch failed + millisecond failure
 * = a dead baseUrl that nobody could see).
 */
export type AiProviderHealthState = "ok" | "unreachable" | "rejected" | "error";

export interface AiProviderHealthDto {
  /** Which provider was probed (the active one, or the derived builtin). */
  providerId: string;
  state: AiProviderHealthState;
  /** One human sentence — what was tried and what came back. */
  detail: string;
  /** Round-trip time of the probe (null for the in-process builtin lane). */
  latencyMs: number | null;
  /** ISO timestamp of the probe (the cache's age, in the open). */
  checkedAt: string;
}

export interface AiSettingsDto {
  /** Active provider id (null = assistant not configured yet). */
  activeProvider: string | null;
  /** Per-provider saved configs (only providers the user touched appear). */
  providers: Record<string, AiProviderConfigDto>;
  /** Model used by the VLM judge (null = the active provider's main model). */
  vlmModel: string | null;
  /**
   * t472 — named repairs the loader made to a hand-edited settings file
   * (dangling activeProvider, wrong-typed fields, unknown version…).
   * Empty/absent = the file is clean. NEVER quotes an API key.
   */
  problems?: string[];
  /** t472 — the active provider's last health probe (null = not probeable). */
  health?: AiProviderHealthDto | null;
}

/** GET /api/ai/settings response. */
export interface AiSettingsResponse {
  providers: AiProviderSummary[];
  settings: AiSettingsDto;
}

/**
 * t474 — GET /api/ai/providers/health response: the roll call. Every SAVED
 * provider's latest probe in one map (the settings dialog's roster face);
 * the header badge keeps its active-only truth from /api/ai/settings.
 */
export interface AiProviderRosterResponse {
  providers: Record<string, AiProviderHealthDto>;
}

/* ------------------------------------------------------------------ */
/* Conversation transcript (normalized — provider-neutral)             */
/* ------------------------------------------------------------------ */

export interface AiToolCallRecord {
  id: string;
  name: string;
  args: unknown;
}

export type AiMessage =
  | { role: "user"; content: string; at: number }
  | {
      role: "assistant";
      content: string;
      toolCalls?: AiToolCallRecord[];
      at: number;
    }
  | {
      role: "tool";
      toolCallId: string;
      name: string;
      content: string;
      isError?: boolean;
      at: number;
    };

/** A session as the CLIENT receives it (GET /api/ai/chat rehydration). */
export interface AiSessionDto {
  id: string;
  projectId: string;
  createdAt: number;
  updatedAt: number;
  /** t428 — the user's name for this conversation (null = unnamed; the
   * drawer falls back to the first-user-message preview). */
  title: string | null;
  messages: AiMessage[];
}

/**
 * One past session as the HISTORY DRAWER reads it (t423) — a summary, not
 * the transcript: the list must load O(1) per session even when a session
 * carries a full tool spiral. `preview` is the session's first user
 * message (what the conversation was ABOUT), never tool chatter.
 */
export interface AiSessionSummaryDto {
  id: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  /** Tool calls across the session — the "this chat did real work" signal. */
  toolCount: number;
  preview: string;
  /** t428 — the user's rename (null = the preview is the display name). */
  title: string | null;
}

/* ------------------------------------------------------------------ */
/* Agent iteration events (what one POST /api/ai/chat returns)         */
/* ------------------------------------------------------------------ */

export type AiEvent =
  | { type: "assistant_text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: unknown }
  | { type: "tool_result"; id: string; name: string; ok: boolean; summary: string; detail?: unknown }
  | { type: "error"; message: string }
  /** t498 — a neutral, non-error status line (e.g. "switched to this
   * project's chat after a project switch"). Renders as the muted notice
   * banner, not the rose error one. */
  | { type: "notice"; message: string };

/** POST /api/ai/chat response. */
export interface AiChatResponse {
  sessionId: string;
  events: AiEvent[];
  /** True while the assistant's last turn ended with tool calls — the client
   * immediately re-POSTs {continue:true} to run the next iteration. */
  needsContinue: boolean;
}
