import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { applySettingsUpdate, aiSettingsDto } from "@/lib/ai/settings";
import type { AiSettingsResponse } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/settings — the provider catalog (public data) + the sanitized
 * settings projection (hasKey + last-4 hint only; the raw key never crosses
 * this line — the remote-connections secret contract).
 */
export async function GET() {
  try {
    const body: AiSettingsResponse = {
      providers: AI_PROVIDERS,
      settings: aiSettingsDto(),
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/ai/settings failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/ai/settings — save one provider's config (+ optionally activate
 * it, + the VLM model override). The API key is write-only: an undefined
 * apiKey keeps the stored one (the edit form never echoes secrets back),
 * an explicitly empty string clears it.
 */
export async function PUT(request: NextRequest) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { data, error } = applySettingsUpdate(raw);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, settings: aiSettingsDto(data) });
  } catch (error) {
    console.error("PUT /api/ai/settings failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
