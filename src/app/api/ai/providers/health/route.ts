import { NextRequest, NextResponse } from "next/server";
import { loadAiSettingsDetailed } from "@/lib/ai/settings";
import { providerRosterHealth } from "@/lib/ai/health";
import { isLocalRequest } from "@/lib/http-guard";
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
 * Guard history, stated honestly: t474 originally left GET unguarded on
 * SECRECY grounds — the detail sentences name what was tried and what came
 * back (baseUrl at most — already on the dialog's face), never a key
 * (t472's secret law). t709 retires that reasoning as answering a
 * different question: the door's value was never response secrecy, it is
 * EXECUTION behind an opaque response. A drive-by no-cors GET would still
 * run the roster (parallel probes) and, worse, `?refresh=1` would fire a
 * full provider probe volley — forced outbound traffic from a page that
 * never sees a byte of the answer. The t472 secrecy law stays true and
 * untouched; the nine-readers ledger (t707 census addendum) prices the
 * execution, and this door closes it (doctrine in http-guard.ts).
 */
export async function GET(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site provider probes are not allowed" }, { status: 403 });
  }
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
