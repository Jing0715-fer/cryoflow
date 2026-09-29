/**
 * CryoFlow — LLM wire adapters (SERVER ONLY).
 *
 * t419 — the assistant thinks in ONE normalized message format (AiMessage)
 * and this module translates to/from the three market dialects on the edge:
 *   openai    POST {base}/chat/completions      (12 providers)
 *   anthropic POST {base}/v1/messages           (Claude)
 *   gemini    POST {base}/v1beta/models/{m}:generateContent
 *
 * The request builders and response parsers are PURE (bench-covered) —
 * chatOnce()/visionOnce() only add fetch, timeouts and error wording.
 *
 * Dialect quirks the pure layer owns:
 *  - Anthropic requires alternating roles: consecutive tool results MERGE
 *    into one user message of tool_result blocks.
 *  - Gemini function responses ride as user-turn functionResponse parts,
 *    matched by tool NAME (not id).
 *  - OpenAI tool arguments are a JSON STRING in both directions.
 */

import type { AiMessage } from "./types";

/* ------------------------------------------------------------------ */
/* Tool schema                                                          */
/* ------------------------------------------------------------------ */

export interface ToolSchema {
  name: string;
  description: string;
  /** JSON Schema (draft-07 style object) for the tool's arguments. */
  parameters: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Normalized response                                                  */
/* ------------------------------------------------------------------ */

export interface NormalizedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface NormalizedResponse {
  text: string;
  toolCalls: NormalizedToolCall[];
}

/* ------------------------------------------------------------------ */
/* Request bodies (pure)                                                */
/* ------------------------------------------------------------------ */

function safeJsonParse(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

export function buildOpenAiBody(
  model: string,
  system: string,
  messages: readonly AiMessage[],
  tools: readonly ToolSchema[]
): Record<string, unknown> {
  const wire: Record<string, unknown>[] = [
    { role: "system", content: system },
  ];
  for (const m of messages) {
    if (m.role === "user") {
      wire.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const toolCalls = (m.toolCalls ?? []).map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
      }));
      wire.push({
        role: "assistant",
        content: m.content || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    } else {
      wire.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return {
    model,
    messages: wire,
    ...(tools.length > 0
      ? {
          tools: tools.map((t) => ({
            type: "function",
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
          tool_choice: "auto",
        }
      : {}),
  };
}

export function buildAnthropicBody(
  model: string,
  system: string,
  messages: readonly AiMessage[],
  tools: readonly ToolSchema[]
): Record<string, unknown> {
  const wire: Record<string, unknown>[] = [];
  let pendingToolResults: Record<string, unknown>[] = [];
  const flushToolResults = () => {
    if (pendingToolResults.length > 0) {
      wire.push({ role: "user", content: pendingToolResults });
      pendingToolResults = [];
    }
  };
  for (const m of messages) {
    if (m.role === "user") {
      flushToolResults();
      wire.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      flushToolResults();
      const content: Record<string, unknown>[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const c of m.toolCalls ?? []) {
        content.push({ type: "tool_use", id: c.id, name: c.name, input: c.args ?? {} });
      }
      if (content.length === 0) content.push({ type: "text", text: "" });
      wire.push({ role: "assistant", content });
    } else {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: m.toolCallId,
        content: m.content,
        ...(m.isError ? { is_error: true } : {}),
      });
    }
  }
  flushToolResults();
  return {
    model,
    system,
    max_tokens: 8192,
    messages: wire,
    ...(tools.length > 0
      ? {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
          })),
        }
      : {}),
  };
}

export function buildGeminiBody(
  model: string,
  system: string,
  messages: readonly AiMessage[],
  tools: readonly ToolSchema[]
): Record<string, unknown> {
  void model; // the model rides the URL, not the body
  const contents: Record<string, unknown>[] = [];
  let pendingResponses: Record<string, unknown>[] = [];
  const flushResponses = () => {
    if (pendingResponses.length > 0) {
      contents.push({ role: "user", parts: pendingResponses });
      pendingResponses = [];
    }
  };
  for (const m of messages) {
    if (m.role === "user") {
      flushResponses();
      contents.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      flushResponses();
      const parts: Record<string, unknown>[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const c of m.toolCalls ?? []) {
        parts.push({ functionCall: { name: c.name, args: c.args ?? {} } });
      }
      if (parts.length === 0) parts.push({ text: "" });
      contents.push({ role: "model", parts });
    } else {
      const detail = safeJsonParse(m.content);
      pendingResponses.push({
        functionResponse: { name: m.name, response: { result: detail } },
      });
    }
  }
  flushResponses();
  return {
    system_instruction: { parts: [{ text: system }] },
    contents,
    ...(tools.length > 0
      ? {
          tools: [
            {
              functionDeclarations: tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            },
          ],
        }
      : {}),
    generationConfig: { maxOutputTokens: 8192, temperature: 0.4 },
  };
}

/* ------------------------------------------------------------------ */
/* Response parsers (pure)                                              */
/* ------------------------------------------------------------------ */

export function parseOpenAiResponse(json: unknown): NormalizedResponse {
  const choices = (json as { choices?: unknown[] })?.choices;
  const first = Array.isArray(choices) ? (choices[0] as Record<string, unknown> | undefined) : undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  if (!message) return { text: "", toolCalls: [] };
  const text = typeof message.content === "string" ? message.content : "";
  const toolCalls: NormalizedToolCall[] = [];
  const raw = message.tool_calls;
  if (Array.isArray(raw)) {
    for (const c of raw) {
      const call = c as {
        id?: unknown;
        function?: { name?: unknown; arguments?: unknown };
      };
      const name = typeof call.function?.name === "string" ? call.function.name : "";
      if (!name) continue;
      toolCalls.push({
        id: typeof call.id === "string" ? call.id : `call_${toolCalls.length + 1}`,
        name,
        args: safeJsonParse(call.function?.arguments),
      });
    }
  }
  return { text, toolCalls };
}

export function parseAnthropicResponse(json: unknown): NormalizedResponse {
  const content = (json as { content?: unknown })?.content;
  if (!Array.isArray(content)) return { text: "", toolCalls: [] };
  let text = "";
  const toolCalls: NormalizedToolCall[] = [];
  for (const block of content) {
    const b = block as { type?: unknown; text?: unknown; id?: unknown; name?: unknown; input?: unknown };
    if (b.type === "text" && typeof b.text === "string") text += b.text;
    else if (b.type === "tool_use" && typeof b.name === "string") {
      toolCalls.push({
        id: typeof b.id === "string" ? b.id : `call_${toolCalls.length + 1}`,
        name: b.name,
        args: safeJsonParse(b.input),
      });
    }
  }
  return { text, toolCalls };
}

export function parseGeminiResponse(json: unknown): NormalizedResponse {
  const candidates = (json as { candidates?: unknown[] })?.candidates;
  const first = Array.isArray(candidates) ? (candidates[0] as Record<string, unknown> | undefined) : undefined;
  const content = first?.content as { parts?: unknown[] } | undefined;
  if (!content || !Array.isArray(content.parts)) return { text: "", toolCalls: [] };
  let text = "";
  const toolCalls: NormalizedToolCall[] = [];
  for (const part of content.parts) {
    const p = part as {
      text?: unknown;
      functionCall?: { name?: unknown; args?: unknown };
    };
    if (typeof p.text === "string") text += p.text;
    else if (p.functionCall && typeof p.functionCall.name === "string") {
      toolCalls.push({
        id: `call_${toolCalls.length + 1}`,
        name: p.functionCall.name,
        args: safeJsonParse(p.functionCall.args),
      });
    }
  }
  return { text, toolCalls };
}

/* ------------------------------------------------------------------ */
/* Network edge                                                          */
/* ------------------------------------------------------------------ */

const CHAT_TIMEOUT_MS = 120_000;

export interface ChatOnceOptions {
  flavor: "openai" | "anthropic" | "gemini" | "builtin";
  apiKey: string;
  model: string;
  baseUrl: string;
  system: string;
  messages: readonly AiMessage[];
  tools: readonly ToolSchema[];
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function providerError(flavor: string, status: number, body: string): Error {
  const t = body.replace(/\s+/g, " ").trim().slice(0, 400);
  return new Error(`LLM provider (${flavor}) answered ${status}: ${t || "(empty body)"}`);
}

/* ------------------------------------------------------------------ */
/* The built-in SDK lane (t463)                                          */
/* ------------------------------------------------------------------ */

/** The slice of the SDK client the two builtin lanes speak. */
interface ZAiClient {
  chat: {
    completions: {
      create: (body: Record<string, unknown>) => Promise<unknown>;
      createVision: (body: Record<string, unknown>) => Promise<unknown>;
    };
  };
}

let builtinClient: Promise<ZAiClient> | null = null;

/**
 * One lazily-created SDK client per process. Init failures reset the slot
 * (the next call retries — a missing-credential deployment answers the
 * SAME actionable wording each time instead of caching a rejection).
 */
function getBuiltinClient(): Promise<ZAiClient> {
  if (!builtinClient) {
    builtinClient = (async () => {
      const mod = (await import("z-ai-web-dev-sdk")) as unknown as {
        default: { create: () => Promise<ZAiClient> };
      };
      return await mod.default.create();
    })();
    builtinClient.catch(() => {
      builtinClient = null;
    });
  }
  return builtinClient;
}

/** The builtin lane's honest failure voice — never a raw stack trace. */
function builtinError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  return new Error(
    `The built-in model (bundled SDK) is unavailable in this deployment: ${message.slice(0, 300)} — open the AI settings and configure your own provider (OpenAI / Anthropic / DeepSeek / …)`
  );
}

/** One assistant turn (text + tool calls) through the active dialect. */
export async function chatOnce(opts: ChatOnceOptions): Promise<NormalizedResponse> {
  // the bundled lane — no HTTP, no key: the SDK client speaks in-process
  // (tool calls pass through the OpenAI-shaped body; the platform's
  // function-calling was verified live before this lane shipped)
  if (opts.flavor === "builtin") {
    let client: ZAiClient;
    try {
      client = await getBuiltinClient();
    } catch (err) {
      throw builtinError(err);
    }
    const body = buildOpenAiBody(opts.model, opts.system, opts.messages, opts.tools);
    let completion: unknown;
    try {
      completion = await client.chat.completions.create({
        ...body,
        thinking: { type: "disabled" },
      });
    } catch (err) {
      throw builtinError(err);
    }
    return parseOpenAiResponse(completion);
  }

  let url: string;
  let headers: Record<string, string> = {};
  let body: Record<string, unknown>;
  let parse: (json: unknown) => NormalizedResponse;

  if (opts.flavor === "anthropic") {
    url = `${opts.baseUrl}/v1/messages`;
    headers = { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" };
    body = buildAnthropicBody(opts.model, opts.system, opts.messages, opts.tools);
    parse = parseAnthropicResponse;
  } else if (opts.flavor === "gemini") {
    url = `${opts.baseUrl}/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    body = buildGeminiBody(opts.model, opts.system, opts.messages, opts.tools);
    parse = parseGeminiResponse;
  } else {
    url = `${opts.baseUrl}/chat/completions`;
    if (opts.apiKey) headers = { authorization: `Bearer ${opts.apiKey}` };
    body = buildOpenAiBody(opts.model, opts.system, opts.messages, opts.tools);
    parse = parseOpenAiResponse;
  }

  const res = await postJson(url, headers, body);
  if (!res.ok) throw providerError(opts.flavor, res.status, res.text);
  let json: unknown;
  try {
    json = JSON.parse(res.text) as unknown;
  } catch {
    throw new Error(`LLM provider (${opts.flavor}) returned non-JSON: ${res.text.slice(0, 200)}`);
  }
  return parse(json);
}

/* ------------------------------------------------------------------ */
/* Vision (the VLM judge's one-shot)                                    */
/* ------------------------------------------------------------------ */

export interface VisionOptions {
  flavor: "openai" | "anthropic" | "gemini" | "builtin";
  apiKey: string;
  model: string;
  baseUrl: string;
  prompt: string;
  /** Base64-encoded PNG bytes. */
  imageBase64: string;
}

/** One user→assistant vision round with a single PNG. Returns the text. */
export async function visionOnce(opts: VisionOptions): Promise<string> {
  // the bundled lane — the SDK's own multimodal door (chat.completions
  // proper rejects image content; createVision is the verified path)
  if (opts.flavor === "builtin") {
    let client: ZAiClient;
    try {
      client = await getBuiltinClient();
    } catch (err) {
      throw builtinError(err);
    }
    let completion: unknown;
    try {
      completion = await client.chat.completions.createVision({
        ...(opts.model ? { model: opts.model } : {}),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: opts.prompt },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${opts.imageBase64}` },
              },
            ],
          },
        ],
      });
    } catch (err) {
      throw builtinError(err);
    }
    return parseOpenAiResponse(completion).text;
  }

  let url: string;
  let headers: Record<string, string> = {};
  let body: Record<string, unknown>;

  if (opts.flavor === "anthropic") {
    url = `${opts.baseUrl}/v1/messages`;
    headers = { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" };
    body = {
      model: opts.model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: opts.prompt },
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: opts.imageBase64 },
            },
          ],
        },
      ],
    };
  } else if (opts.flavor === "gemini") {
    url = `${opts.baseUrl}/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: opts.prompt },
            { inline_data: { mime_type: "image/png", data: opts.imageBase64 } },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 4096, temperature: 0.2 },
    };
  } else {
    url = `${opts.baseUrl}/chat/completions`;
    if (opts.apiKey) headers = { authorization: `Bearer ${opts.apiKey}` };
    body = {
      model: opts.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: opts.prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${opts.imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 4096,
    };
  }

  const res = await postJson(url, headers, body);
  if (!res.ok) throw providerError(opts.flavor, res.status, res.text);
  const json = JSON.parse(res.text) as unknown;
  if (opts.flavor === "anthropic") return parseAnthropicResponse(json).text;
  if (opts.flavor === "gemini") return parseGeminiResponse(json).text;
  return parseOpenAiResponse(json).text;
}
