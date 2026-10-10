import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { aiProvider, effectiveBaseUrl, listProviderModels } from "@/lib/ai/providers";
import { loadAiSettings } from "@/lib/ai/settings";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/models — 「填写 apikey 后自动获取 model 列表」.
 *
 * Body: { provider, apiKey?, baseUrl? }. The apiKey is OPTIONAL — when
 * absent the STORED key serves (the dialog auto-fetches on provider select
 * when a key is already saved, so switching providers feels instant).
 * The provided key is used as-is and NEVER persisted by this route (only
 * PUT /api/ai/settings writes keys).
 *
 * Answers { models, source } where source says which lane spoke:
 *   "api"     — the provider's own listing endpoint
 *   "builtin" — the curated list (providers without an endpoint)
 * Network/auth failures answer 502 with the provider's own message so the
 * dialog can name the broken link exactly.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      provider?: unknown;
      apiKey?: unknown;
      baseUrl?: unknown;
    };
    const providerId = typeof body.provider === "string" ? body.provider : "";
    const provider = aiProvider(providerId);
    if (!provider) {
      return NextResponse.json({ error: `Unknown provider: ${providerId || "(none)"}` }, { status: 400 });
    }
    const typedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const baseUrlOverride =
      typeof body.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim() : null;

    // the stored key serves when none was typed (and the stored baseUrl too)
    let apiKey = typedKey;
    let baseUrl = baseUrlOverride;
    const stored = loadAiSettings().providers[providerId];
    if (!apiKey && stored?.apiKey) apiKey = stored.apiKey;
    if (!baseUrl && stored?.baseUrl) baseUrl = stored.baseUrl;

    const result = await listProviderModels(providerId, apiKey, baseUrl);
    if (result.error && result.models.length === 0) {
      return NextResponse.json(
        { error: result.error, source: result.source },
        { status: 502 }
      );
    }
    return NextResponse.json({
      models: result.models,
      source: result.source,
      ...(result.error ? { note: result.error } : {}),
      baseUrl: effectiveBaseUrl(provider, baseUrl),
    });
  } catch (error) {
    console.error("POST /api/ai/models failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
