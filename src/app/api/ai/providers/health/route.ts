import { NextRequest, NextResponse } from "next/server";
import { loadAiSettingsDetailed } from "@/lib/ai/settings";
import { providerRosterHealth } from "@/lib/ai/health";
import type { AiProviderRosterResponse } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/providers/health — t474's roll call: every SAVED provider's
 * reachability in one answer. Parallel probes, 2.5s ceiling each (a probe
 * never hangs the read), 60s TTL cache keyed by id+baseUrl+model. The
 * dialog fetches this when it opens; the roster wears the dots.
 *
 * `?refresh=1` (the dialog's re-probe button) re-tests every saved
 * provider NOW and the fresh answers become the cache — a manual re-probe
 * whose truth the next cached GET would contradict is two truths where
 * the user asked for one.
 *
 * No guard on GET: the detail sentences name what was tried and what came
 * back (baseUrl at most — already on the dialog's face), never a key
 * (t472's secret law); the active-only sibling in /api/ai/settings GET is
 * unguarded on the same grounds.
 */
export async function GET(request: NextRequest) {
  try {
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const { data } = loadAiSettingsDetailed();
    const providers = await providerRosterHealth(data, { refresh });
    const body: AiProviderRosterResponse = { providers };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/ai/providers/health failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
