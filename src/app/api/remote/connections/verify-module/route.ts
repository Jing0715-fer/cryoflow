import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { sanitizeConnection } from "@/lib/remote/connections";
import { emptyProbe, mergeVerifiedModule, probeModuleDetail } from "@/lib/remote/probe";
import { dropConnection } from "@/lib/remote/ssh";
import type { RemoteConnection, RemoteProbe } from "@/lib/remote/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/remote/connections/verify-module — t310, the verify door BY
 * VALUE (the t290 test route's sibling; nothing is persisted).
 *
 * t297 gave SAVED connections a beta/hidden-module door: `module avail`
 * does not list hidden modules, but a name the user KNOWS can be proven —
 * load it in a login shell, require relion_refine on PATH. That door lives
 * at [id]/verify-module, so the CREATE form could not ask the question:
 * "this beta module name in my env lines — does it load on the cluster I
 * am about to add?" — the same leap of faith t290's by-value probe retired
 * for logins, still alive for module names.
 *
 * This route runs the EXACT same ceremony against a connection the request
 * body carries (host/username required, same contract as /test):
 *
 *   body: { host, username, port?, authMethod?, password?|privateKeyPath?|passphrase?,
 *           module: "relion/beta_5.0_gpu_ompi5_cuda118",
 *           probe?: RemoteProbe }        // the client's probeOverride to merge into
 *
 * The verdict chain matches the saved door (t310 adds the first link):
 *   1. execError — the SSH layer's own complaint (dead host / bad auth /
 *      timeout); a login that cannot happen is a different answer than a
 *      module that does not exist;
 *   2. loadRc !== 0 — the module tool's own words come back verbatim
 *      (Lmod's "Unknown module"), never a forged success when a stale
 *      environment still offers relion_refine on PATH;
 *   3. !home — relion_refine never appeared on PATH after the load.
 *
 * On success the module is merged into the probe the client sent (or into
 * an empty skeleton) with the SAME mergeVerifiedModule the saved door uses
 * — one merge, no drift — and the merged probe rides the response; the
 * client shows the chips and pins the default in its own draft (pin is a
 * draft concern here: nothing is persisted until Create).
 *
 * The transient connection id is dropped from the SSH pool afterwards (a
 * probe opens a session keyed by id; a phantom id must not squat it), and
 * the registry is untouched — verified by the suite byte-for-byte.
 */
export async function POST(request: NextRequest) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body must be a connection object with a module name" }, { status: 400 });
    }
    if (typeof body.host !== "string" || !body.host.trim()) {
      return NextResponse.json({ error: "host is required" }, { status: 400 });
    }
    if (typeof body.username !== "string" || !body.username.trim()) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }
    const moduleName =
      typeof body.module === "string" ? body.module.trim().slice(0, 200) : "";
    if (!moduleName || !/^[A-Za-z0-9][A-Za-z0-9._\-+/]*$/.test(moduleName)) {
      return NextResponse.json(
        { error: "Body must carry a module name (letters, digits, . _ - + /)" },
        { status: 400 }
      );
    }

    const conn = sanitizeConnection(body);
    const detail = await probeModuleDetail(conn as RemoteConnection, moduleName);
    // the transient id must not keep an SSH session alive in the pool
    dropConnection(conn.id);

    // ---- the verdict chain (execError first — t310) ---------------------
    if (detail.execError) {
      return NextResponse.json({ ok: false, error: `SSH failed: ${detail.execError}` });
    }
    if (detail.loadRc != null && detail.loadRc !== 0) {
      return NextResponse.json({
        ok: false,
        error: detail.loadError
          ? `module load failed (exit ${detail.loadRc}): ${detail.loadError}`
          : `module load ${moduleName} failed (exit ${detail.loadRc})`,
      });
    }
    if (!detail.home) {
      return NextResponse.json({
        ok: false,
        error: detail.loadError
          ? `module load failed: ${detail.loadError}`
          : `relion_refine not found on PATH after module load ${moduleName}`,
      });
    }

    // ---- verified: merge into the client's probe (or an empty skeleton) --
    const base: RemoteProbe =
      body.probe && typeof body.probe === "object" && !Array.isArray(body.probe)
        ? { ...emptyProbe(), ...(body.probe as RemoteProbe) }
        : emptyProbe();
    const probe = mergeVerifiedModule(base, moduleName, detail);

    return NextResponse.json({
      ok: true,
      module: moduleName,
      relionHome: detail.home,
      mpi: detail.mpi,
      ctffind: detail.ctffind,
      probe,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "module verification failed" },
      { status: 500 }
    );
  }
}
