/**
 * CryoFlow — AI assistant settings (SERVER ONLY).
 *
 * t419 — the LLM provider credentials registry, persisted in
 * data/ai-settings.json. The file holds SECRETS (API keys) — written 0600
 * and NEVER projected to the client: the settings route answers the
 * sanitized AiSettingsDto (hasKey + last-4 hint only), the same
 * secret-stripping contract remote-connections.json has spoken since t2xx.
 *
 * The three-state key dialect is the connections module's: an apiKey that
 * is undefined keeps the stored one (the edit form never echoes secrets
 * back), an explicitly EMPTY string clears it.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/paths";
import { aiProvider } from "./providers";
import type { AiSettingsDto } from "./types";

const SETTINGS_FILE = path.join(DATA_DIR, "ai-settings.json");

export interface AiProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string | null;
}

export interface AiSettingsData {
  version: 1;
  activeProvider: string | null;
  providers: Record<string, AiProviderConfig>;
  vlmModel: string | null;
}

const EMPTY: AiSettingsData = { version: 1, activeProvider: null, providers: {}, vlmModel: null };

export function loadAiSettings(): AiSettingsData {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(readFileSync(SETTINGS_FILE, "utf8")) as Partial<AiSettingsData>;
      if (parsed && typeof parsed === "object" && parsed.providers && typeof parsed.providers === "object") {
        const providers: Record<string, AiProviderConfig> = {};
        for (const [id, raw] of Object.entries(parsed.providers)) {
          const cfg = raw as Partial<AiProviderConfig> | null;
          if (!cfg || typeof cfg !== "object") continue;
          providers[id] = {
            apiKey: typeof cfg.apiKey === "string" ? cfg.apiKey : "",
            model: typeof cfg.model === "string" ? cfg.model.slice(0, 200) : "",
            baseUrl: typeof cfg.baseUrl === "string" && cfg.baseUrl.trim() ? cfg.baseUrl.trim().slice(0, 400) : null,
          };
        }
        return {
          version: 1,
          activeProvider:
            typeof parsed.activeProvider === "string" && parsed.activeProvider in providers
              ? parsed.activeProvider
              : null,
          providers,
          vlmModel: typeof parsed.vlmModel === "string" && parsed.vlmModel.trim() ? parsed.vlmModel.trim().slice(0, 200) : null,
        };
      }
    }
  } catch {
    /* corrupt file → start empty (the old file stays on disk for inspection) */
  }
  return { ...EMPTY, providers: {} };
}

export function saveAiSettings(data: AiSettingsData): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${SETTINGS_FILE}.tmp-${Date.now().toString(36)}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    chmodSync(tmp, 0o600); // umask may have softened the create mode
  } catch {
    /* chmod best-effort (network FS) */
  }
  renameSync(tmp, SETTINGS_FILE);
}

/* ------------------------------------------------------------------ */
/* Sanitized projection                                                */
/* ------------------------------------------------------------------ */

export function aiSettingsDto(data: AiSettingsData = loadAiSettings()): AiSettingsDto {
  const providers: AiSettingsDto["providers"] = {};
  for (const [id, cfg] of Object.entries(data.providers)) {
    providers[id] = {
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      hasKey: cfg.apiKey.length > 0,
      keyHint: cfg.apiKey.length > 4 ? `••••${cfg.apiKey.slice(-4)}` : "",
    };
  }
  return {
    activeProvider: data.activeProvider,
    providers,
    vlmModel: data.vlmModel,
  };
}

/* ------------------------------------------------------------------ */
/* Update semantics (the PUT route's engine)                            */
/* ------------------------------------------------------------------ */

export interface SaveProviderInput {
  provider: string;
  /** undefined = keep stored; "" = clear; else = replace (≤4096 chars). */
  apiKey?: unknown;
  model?: unknown;
  baseUrl?: unknown;
}
export interface SaveSettingsInput {
  provider?: unknown;
  /** undefined = keep stored; "" = clear; else = replace (≤4096 chars). */
  apiKey?: unknown;
  model?: unknown;
  baseUrl?: unknown;
  /** Activate this provider as the assistant's chat model. */
  activate?: unknown;
  /** VLM model override (string = set, null = clear, undefined = keep). */
  vlmModel?: unknown;
}

/**
 * Apply a PUT body to the stored settings. Returns the new data + a human
 * error string when the body was shapeless (unknown provider / bad URL).
 */
export function applySettingsUpdate(raw: SaveSettingsInput): { data: AiSettingsData; error?: string } {
  const data = loadAiSettings();
  const providerId = typeof raw.provider === "string" ? raw.provider : "";
  const provider = aiProvider(providerId);
  if (!provider) {
    return { data, error: `Unknown provider: ${providerId || "(none)"}` };
  }

  const prev: AiProviderConfig = data.providers[providerId] ?? {
    apiKey: "",
    model: provider.curatedModels[0] ?? "",
    baseUrl: null,
  };
  const next: AiProviderConfig = { ...prev };

  // API key — three-state dialect (see module header)
  if (typeof raw.apiKey === "string") {
    next.apiKey = raw.apiKey.length > 0 ? raw.apiKey.slice(0, 4096) : "";
  }
  if (typeof raw.model === "string" && raw.model.trim()) {
    next.model = raw.model.trim().slice(0, 200);
  } else if (typeof raw.model === "string") {
    next.model = ""; // explicit clear — the dialog re-fetches and re-picks
  }
  if (raw.baseUrl !== undefined) {
    if (typeof raw.baseUrl === "string" && raw.baseUrl.trim()) {
      const url = raw.baseUrl.trim().slice(0, 400).replace(/\/+$/, "");
      if (!/^https?:\/\//i.test(url)) {
        return { data, error: "Base URL must start with http:// or https://" };
      }
      next.baseUrl = url;
    } else {
      next.baseUrl = null; // "" or null → back to the provider default
    }
  }
  // a custom provider with no base URL is inert — refuse to save it at all
  if (provider.custom && !next.baseUrl) {
    return { data, error: "Custom providers need a base URL before they can be saved" };
  }

  data.providers[providerId] = next;

  if (raw.vlmModel === null) data.vlmModel = null;
  else if (typeof raw.vlmModel === "string" && raw.vlmModel.trim())
    data.vlmModel = raw.vlmModel.trim().slice(0, 200);

  const activate = raw.activate !== false;
  const usable = !provider.needsKey || next.apiKey.length > 0;
  let error: string | undefined;
  if (activate && usable && next.model) {
    data.activeProvider = providerId;
  } else if (activate && !usable) {
    // saving a key-less provider is legal (drafting), but it cannot become
    // active — keep the previous active and say why
    error = `${provider.label} has no API key saved — configuration saved as a draft, but the assistant stays on its current provider`;
  }
  saveAiSettings(data);
  return { data, ...(error ? { error } : {}) };
}

/* ------------------------------------------------------------------ */
/* The assistant's resolved identity                                    */
/* ------------------------------------------------------------------ */

export interface ResolvedAssistant {
  providerId: string;
  flavor: "openai" | "anthropic" | "gemini";
  apiKey: string;
  model: string;
  baseUrl: string;
  /** The VLM judge's model (explicit setting, else the chat model). */
  vlmModel: string;
}

/**
 * The fully-resolved chat identity, or null when the assistant is not
 * configured (no active provider / missing key / missing model).
 */
export function resolveAssistant(): ResolvedAssistant | null {
  const data = loadAiSettings();
  if (!data.activeProvider) return null;
  const cfg = data.providers[data.activeProvider];
  if (!cfg) return null;
  const provider = aiProvider(data.activeProvider);
  if (!provider) return null;
  if (provider.needsKey && !cfg.apiKey) return null;
  if (!cfg.model) return null;
  if (provider.custom && !cfg.baseUrl) return null;
  const base = cfg.baseUrl ?? provider.baseUrl;
  return {
    providerId: provider.id,
    flavor: provider.flavor,
    apiKey: cfg.apiKey,
    model: cfg.model,
    baseUrl: base,
    vlmModel: data.vlmModel?.trim() || cfg.model,
  };
}
