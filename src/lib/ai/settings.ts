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

/* ------------------------------------------------------------------ */
/* t472 — the honest loader                                            */
/* ------------------------------------------------------------------ */

/**
 * Validate a hand-edited (or tool-written) settings file, collecting NAMED
 * problems instead of silently repairing. Every repair is spoken: the old
 * loader fixed wrong-typed fields without a word, and the t468 lesson was
 * exactly that silence — a mock-dialect baseUrl slept in the real file for
 * three windows because nothing ever confesses what it ignored.
 *
 * The secret law: problems describe SHAPE, never CONTENT — an apiKey is
 * named by field path, its value never enters a sentence.
 */
export function validateAiSettings(raw: unknown): {
  data: AiSettingsData;
  problems: string[];
} {
  const problems: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    problems.push("settings file is not a JSON object — starting from empty (the old file stays on disk for inspection)");
    return { data: { ...EMPTY, providers: {} }, problems };
  }
  const parsed = raw as Partial<AiSettingsData> & { version?: unknown };

  const providers: Record<string, AiProviderConfig> = {};
  if (!parsed.providers || typeof parsed.providers !== "object" || Array.isArray(parsed.providers)) {
    problems.push("providers map is missing or not an object — no saved configs were recovered");
  } else {
    for (const [id, rawCfg] of Object.entries(parsed.providers)) {
      if (!rawCfg || typeof rawCfg !== "object" || Array.isArray(rawCfg)) {
        problems.push(`providers.${id} is not an object — entry skipped`);
        continue;
      }
      const cfg = rawCfg as Partial<AiProviderConfig>;
      const apiKey = typeof cfg.apiKey === "string" ? cfg.apiKey : "";
      if (cfg.apiKey !== undefined && typeof cfg.apiKey !== "string") {
        problems.push(`providers.${id}.apiKey was not a string — key reset to empty`);
      }
      let model = typeof cfg.model === "string" ? cfg.model : "";
      if (cfg.model !== undefined && typeof cfg.model !== "string") {
        problems.push(`providers.${id}.model was not a string — model reset to empty`);
      }
      if (model.length > 200) {
        model = model.slice(0, 200);
        problems.push(`providers.${id}.model was longer than 200 characters — truncated`);
      }
      let baseUrl: string | null = null;
      if (typeof cfg.baseUrl === "string" && cfg.baseUrl.trim()) {
        const url = cfg.baseUrl.trim();
        if (!/^https?:\/\/./i.test(url)) {
          problems.push(`providers.${id}.baseUrl "${url.slice(0, 120)}" is not an http(s) URL — reset to the provider default`);
        } else if (url.length > 400) {
          baseUrl = url.slice(0, 400);
          problems.push(`providers.${id}.baseUrl was longer than 400 characters — truncated`);
        } else {
          baseUrl = url;
        }
      } else if (cfg.baseUrl !== undefined && cfg.baseUrl !== null) {
        problems.push(`providers.${id}.baseUrl was not a string — reset to the provider default`);
      }
      providers[id] = { apiKey, model, baseUrl };
    }
  }

  let activeProvider: string | null = null;
  if (typeof parsed.activeProvider === "string" && parsed.activeProvider) {
    if (parsed.activeProvider in providers) {
      activeProvider = parsed.activeProvider;
    } else {
      problems.push(`activeProvider "${parsed.activeProvider}" has no saved config — treated as not configured`);
    }
  } else if (parsed.activeProvider !== null && parsed.activeProvider !== undefined) {
    problems.push("activeProvider was not a string — treated as not configured");
  }

  let vlmModel: string | null = null;
  if (typeof parsed.vlmModel === "string" && parsed.vlmModel.trim()) {
    vlmModel = parsed.vlmModel.trim().slice(0, 200);
  } else if (parsed.vlmModel !== null && parsed.vlmModel !== undefined) {
    problems.push("vlmModel was not a string — the active provider's main model will judge vision");
  }

  if (parsed.version !== undefined && parsed.version !== 1) {
    problems.push(`unknown settings version ${JSON.stringify(parsed.version)} — loaded as best effort`);
  }

  // t574 — the judge worker's toggle. Optional in the file (older files
  // predate it — absence means the default, true); a WRONG type is
  // repaired to the default with a named problem, like every field here.
  let autoJudge = true;
  if (parsed.autoJudge !== undefined && parsed.autoJudge !== null) {
    if (typeof parsed.autoJudge === "boolean") {
      autoJudge = parsed.autoJudge;
    } else {
      problems.push(`autoJudge was not a boolean — reset to the default (on)`);
    }
  }

  return { data: { version: 1, activeProvider, providers, vlmModel, autoJudge }, problems };
}

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
  /**
   * t574 — auto-judge finished classifications (the judge worker's
   * toggle). Default true: with the builtin lane the marginal cost is
   * the bundled SDK's own quota, and the feature IS the product —
   * "the verdict arrives before you ask". Turn it off (dialog switch or
   * PUT {autoJudge:false}) to keep judging strictly on-demand.
   */
  autoJudge: boolean;
}

const EMPTY: AiSettingsData = { version: 1, activeProvider: null, providers: {}, vlmModel: null, autoJudge: true };

export function loadAiSettings(): AiSettingsData {
  return loadAiSettingsDetailed().data;
}

/** t472 — the load PLUS the named repairs (the settings route wears both). */
export function loadAiSettingsDetailed(): { data: AiSettingsData; problems: string[] } {
  try {
    if (existsSync(SETTINGS_FILE)) {
      return validateAiSettings(JSON.parse(readFileSync(SETTINGS_FILE, "utf8")));
    }
  } catch {
    /* corrupt file → start empty (the old file stays on disk for inspection) */
    return {
      data: { ...EMPTY, providers: {} },
      problems: ["settings file is corrupt JSON — starting from empty (the old file stays on disk for inspection)"],
    };
  }
  return { data: { ...EMPTY, providers: {} }, problems: [] };
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
  // t463 — when the user has configured nothing, the DTO still names the
  // built-in lane as the (derived) active provider and synthesizes its
  // config row, so the panel badge and the dialog's 「当前使用」chip say
  // what will actually answer: Built-in (GLM) · glm-4-plus.
  if (!providers.builtin) {
    providers.builtin = { model: "glm-4-plus", baseUrl: null, hasKey: false, keyHint: "" };
  }
  return {
    activeProvider: data.activeProvider ?? "builtin",
    providers,
    vlmModel: data.vlmModel,
    autoJudge: data.autoJudge,
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
  /** t574 — the judge worker's toggle (boolean = set, undefined = keep). */
  autoJudge?: unknown;
}

/**
 * Apply a PUT body to the stored settings. Returns the new data + a human
 * error string when the body was shapeless (unknown provider / bad URL).
 */
export function applySettingsUpdate(raw: SaveSettingsInput): { data: AiSettingsData; error?: string } {
  const data = loadAiSettings();

  // t574 — the auto-judge toggle is a GLOBAL setting, not provider config:
  // a body carrying autoJudge (and nothing else) updates it without
  // needing a provider row — the dialog's switch fires alone. Combined
  // bodies ride the provider path below, which saves the same data.
  {
    const providerOnly =
      raw.provider === undefined &&
      raw.apiKey === undefined &&
      raw.model === undefined &&
      raw.baseUrl === undefined &&
      raw.vlmModel === undefined &&
      raw.activate === undefined;
    if (raw.autoJudge !== undefined) {
      if (typeof raw.autoJudge !== "boolean") {
        return { data, error: "autoJudge must be a boolean" };
      }
      data.autoJudge = raw.autoJudge;
      if (providerOnly) {
        saveAiSettings(data);
        return { data };
      }
    }
  }

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
  flavor: "openai" | "anthropic" | "gemini" | "builtin";
  apiKey: string;
  model: string;
  baseUrl: string;
  /** The VLM judge's model (explicit setting, else the chat model). */
  vlmModel: string;
}

/** t463 — the zero-config identity: the bundled SDK lane. */
const BUILTIN_ASSISTANT: ResolvedAssistant = {
  providerId: "builtin",
  flavor: "builtin",
  apiKey: "",
  model: "glm-4-plus",
  baseUrl: "",
  vlmModel: "glm-4-plus",
};

/** The built-in lane's opt-out (env kill-switch; "1" = force explicit config). */
export function builtinLaneDisabled(): boolean {
  return process.env.CRYOFLOW_DISABLE_BUILTIN_AI === "1";
}

/**
 * The fully-resolved chat identity. t463: when NOTHING is configured the
 * BUILT-IN lane serves (no key, no base URL — the SDK rides in-process).
 * Where the deployment carries no SDK credentials, the first chat answers
 * an actionable error (wire.ts words it) instead of a setup wall — the
 * panel stays honest without becoming a locked door.
 *
 * A STORED-but-unusable provider (a hand-edited settings file) still
 * answers null → needsSetup: the badge must never say one provider while
 * another one answers.
 */
export function resolveAssistant(): ResolvedAssistant | null {
  const data = loadAiSettings();
  if (!data.activeProvider) {
    return builtinLaneDisabled() ? null : { ...BUILTIN_ASSISTANT };
  }
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
