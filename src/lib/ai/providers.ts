/**
 * CryoFlow — LLM provider registry (SERVER ONLY).
 *
 * t419 — the market's common providers, each speaking one of three wire
 * dialects. The registry is PUBLIC DATA (labels, docs URLs, base URLs,
 * curated model lists) — it carries no secrets. The API key arrives from
 * the user's settings (ai-settings.json, 0600) and is used per-request.
 *
 * 「填写 apikey 后自动获取 model 列表」: listProviderModels() hits each
 * provider's own models endpoint (OpenAI-compatible GET /models, Anthropic
 * GET /v1/models, Gemini GET /v1beta/models) with a 15s timeout. Providers
 * without a listing endpoint (Zhipu) answer from the curated list — the
 * response's `source` field says which lane spoke, so the UI never lies
 * about where the list came from.
 */

import type { AiProviderFlavor, AiProviderSummary } from "./types";

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const P = (s: AiProviderSummary): AiProviderSummary => s;

export const AI_PROVIDERS: AiProviderSummary[] = [
  P({
    id: "openai",
    label: "OpenAI",
    docsUrl: "https://platform.openai.com/api-keys",
    flavor: "openai",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
    supportsModelList: true,
    curatedModels: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini"],
    visionDefault: "gpt-4o",
    custom: false,
    keyHint: "sk-…",
  }),
  P({
    id: "anthropic",
    label: "Anthropic (Claude)",
    docsUrl: "https://console.anthropic.com/settings/keys",
    flavor: "anthropic",
    baseUrl: "https://api.anthropic.com",
    needsKey: true,
    supportsModelList: true,
    curatedModels: [
      "claude-sonnet-4-20250514",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
    ],
    visionDefault: "claude-sonnet-4-20250514",
    custom: false,
    keyHint: "sk-ant-…",
  }),
  P({
    id: "gemini",
    label: "Google Gemini",
    docsUrl: "https://aistudio.google.com/app/apikey",
    flavor: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    needsKey: true,
    supportsModelList: true,
    curatedModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    visionDefault: "gemini-2.5-flash",
    custom: false,
    keyHint: "AIza…",
  }),
  P({
    id: "deepseek",
    label: "DeepSeek",
    docsUrl: "https://platform.deepseek.com/api_keys",
    flavor: "openai",
    baseUrl: "https://api.deepseek.com",
    needsKey: true,
    supportsModelList: true,
    curatedModels: ["deepseek-chat", "deepseek-reasoner"],
    visionDefault: null,
    custom: false,
    keyHint: "sk-…",
  }),
  P({
    id: "moonshot",
    label: "Moonshot (Kimi)",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
    flavor: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    needsKey: true,
    supportsModelList: true,
    curatedModels: [
      "kimi-k2-0711-preview",
      "kimi-k2-turbo-preview",
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k",
    ],
    visionDefault: null,
    custom: false,
    keyHint: "sk-…",
  }),
  P({
    id: "zhipu",
    label: "Zhipu (GLM)",
    docsUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    flavor: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    needsKey: true,
    // Zhipu's open platform has no public model-listing endpoint — the
    // curated list IS the answer (source: "builtin").
    supportsModelList: false,
    curatedModels: ["glm-4.6", "glm-4.5", "glm-4.5-air", "glm-4.5-flash", "glm-4-flash"],
    visionDefault: null,
    custom: false,
    keyHint: "…",
  }),
  P({
    id: "dashscope",
    label: "Alibaba Qwen (DashScope)",
    docsUrl: "https://bailian.console.aliyun.com/?apiKey=1",
    flavor: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    needsKey: true,
    supportsModelList: true,
    curatedModels: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen3-max"],
    visionDefault: "qwen-vl-max",
    custom: false,
    keyHint: "sk-…",
  }),
  P({
    id: "openrouter",
    label: "OpenRouter",
    docsUrl: "https://openrouter.ai/keys",
    flavor: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    supportsModelList: true,
    curatedModels: [
      "openai/gpt-4o",
      "anthropic/claude-sonnet-4",
      "google/gemini-2.5-flash",
      "deepseek/deepseek-chat",
    ],
    visionDefault: null,
    custom: false,
    keyHint: "sk-or-…",
  }),
  P({
    id: "groq",
    label: "Groq",
    docsUrl: "https://console.groq.com/keys",
    flavor: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
    supportsModelList: true,
    curatedModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen/qwen3-32b"],
    visionDefault: "meta-llama/llama-4-scout-17b-16e-instruct",
    custom: false,
    keyHint: "gsk_…",
  }),
  P({
    id: "mistral",
    label: "Mistral AI",
    docsUrl: "https://console.mistral.ai/api-keys",
    flavor: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    needsKey: true,
    supportsModelList: true,
    curatedModels: ["mistral-large-latest", "mistral-small-latest", "magistral-medium-latest"],
    visionDefault: "pixtral-large-latest",
    custom: false,
    keyHint: "…",
  }),
  P({
    id: "xai",
    label: "xAI (Grok)",
    docsUrl: "https://console.x.ai",
    flavor: "openai",
    baseUrl: "https://api.x.ai/v1",
    needsKey: true,
    supportsModelList: true,
    curatedModels: ["grok-4", "grok-3", "grok-3-mini"],
    visionDefault: "grok-4",
    custom: false,
    keyHint: "xai-…",
  }),
  P({
    id: "ollama",
    label: "Ollama (local)",
    docsUrl: "https://ollama.com/download",
    flavor: "openai",
    baseUrl: "http://127.0.0.1:11434/v1",
    needsKey: false,
    supportsModelList: true,
    curatedModels: ["qwen3", "llama3.1", "deepseek-r1"],
    visionDefault: "llava",
    custom: false,
    keyHint: "(no key needed)",
  }),
  P({
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    docsUrl: "https://platform.openai.com/docs/api-reference",
    flavor: "openai",
    baseUrl: "",
    needsKey: false,
    supportsModelList: true,
    curatedModels: [],
    visionDefault: null,
    custom: true,
    keyHint: "any token",
  }),
];

const BY_ID = new Map(AI_PROVIDERS.map((p) => [p.id, p]));

export function aiProvider(id: string): AiProviderSummary | null {
  return BY_ID.get(id) ?? null;
}

/** Effective base URL: the user's override wins (custom requires it). */
export function effectiveBaseUrl(provider: AiProviderSummary, override?: string | null): string {
  const trimmed = typeof override === "string" ? override.trim().replace(/\/+$/, "") : "";
  if (trimmed) return trimmed;
  return provider.baseUrl;
}

/* ------------------------------------------------------------------ */
/* Response parsers (pure — bench-covered)                             */
/* ------------------------------------------------------------------ */

export function parseOpenAiModels(json: unknown): string[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const m of data) {
    const id = (m as { id?: unknown })?.id;
    if (typeof id === "string" && id.trim()) out.push(id.trim());
  }
  return [...new Set(out)].sort();
}

export function parseAnthropicModels(json: unknown): string[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const out: string[] = [];
  for (const m of data) {
    const id = (m as { id?: unknown })?.id;
    if (typeof id === "string" && id.trim()) out.push(id.trim());
  }
  return [...new Set(out)].sort();
}

export function parseGeminiModels(json: unknown): string[] {
  const models = (json as { models?: unknown })?.models;
  if (!Array.isArray(models)) return [];
  const out: string[] = [];
  for (const m of models) {
    const row = m as { name?: unknown; supportedGenerationMethods?: unknown };
    const name = typeof row.name === "string" ? row.name.replace(/^models\//, "") : "";
    const methods = Array.isArray(row.supportedGenerationMethods)
      ? (row.supportedGenerationMethods as unknown[])
      : [];
    // only models this key can actually GENERATE with (embeddings/tuning
    // models answer the listing but cannot chat)
    if (name && methods.includes("generateContent")) out.push(name);
  }
  return [...new Set(out)].sort();
}

/* ------------------------------------------------------------------ */
/* Model listing (network)                                             */
/* ------------------------------------------------------------------ */

export interface ModelListResult {
  models: string[];
  /** "api" = live listing from the provider; "builtin" = curated list. */
  source: "api" | "builtin";
}

const LIST_TIMEOUT_MS = 15_000;

/**
 * List the models a key can use. Never throws — a network/auth failure
 * returns { error } with the provider's own message (truncated), so the
 * settings dialog can show exactly which link of the chain broke.
 */
export async function listProviderModels(
  providerId: string,
  apiKey: string,
  baseUrlOverride?: string | null
): Promise<ModelListResult & { error?: string }> {
  const provider = aiProvider(providerId);
  if (!provider) return { models: [], source: "builtin", error: `Unknown provider: ${providerId}` };
  const base = effectiveBaseUrl(provider, baseUrlOverride);
  if (provider.custom && !base) {
    return { models: [], source: "builtin", error: "Custom providers need a base URL (e.g. http://host:8000/v1)" };
  }
  if (provider.needsKey && !apiKey) {
    return { models: [], source: "builtin", error: `${provider.label} needs an API key` };
  }
  // providers without a listing endpoint answer from the curated list
  if (!provider.supportsModelList) {
    return { models: [...provider.curatedModels], source: "builtin" };
  }

  let url: string;
  let headers: Record<string, string> = { accept: "application/json" };
  if (provider.flavor === "anthropic") {
    url = `${base}/v1/models?limit=200`;
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (provider.flavor === "gemini") {
    url = `${base}/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`;
  } else {
    url = `${base}/models`;
    if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        models: [],
        source: "api",
        error: `${provider.label} answered ${res.status}: ${excerpt(text)}`,
      };
    }
    const json = JSON.parse(text) as unknown;
    const models =
      provider.flavor === "anthropic"
        ? parseAnthropicModels(json)
        : provider.flavor === "gemini"
          ? parseGeminiModels(json)
          : parseOpenAiModels(json);
    if (models.length === 0) {
      return {
        models: [],
        source: "api",
        error: `${provider.label} listed no models for this key`,
      };
    }
    return { models, source: "api" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { models: [], source: "api", error: `${provider.label}: ${excerpt(message)}` };
  }
}

function excerpt(s: string, max = 240): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
