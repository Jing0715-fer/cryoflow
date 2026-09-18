import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { getConnection, patchConnection, toConnectionDTO } from "@/lib/remote/connections";
import { probeModuleDetail } from "@/lib/remote/probe";
import { dropConnection } from "@/lib/remote/ssh";
import { withRunResume } from "@/lib/remote/remote-run";
import type { RemoteConnection, RemoteProbe } from "@/lib/remote/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/remote/connections/[id]/verify-module — t297, the beta/hidden
 * module door.
 *
 * `module avail` does not list hidden modules (Lmod hides beta installs),
 * and the parser can only see what a listing says — but the user KNOWS the
 * name (`module load relion/beta_5.0_gpu_ompi5_cuda118` works in their env
 * lines). This route proves the name the same way a run would: load it in a
 * login shell and require relion_refine on PATH afterwards.
 *
 *   body: { module: "relion/beta_5.0_gpu_ompi5_cuda118", pin?: true }
 *
 * On success the verified module is MERGED into the connection's lastProbe
 * (module list + home/mpi/ctffind/externals) so every downstream picker
 * offers it, and — with pin — it becomes the connection's defaultModule.
 * On failure the module-tool's own complaint comes back verbatim (Lmod's
 * "Unknown module" is the honest answer); nothing is persisted.
 *
 * The response's connection DTO carries the merged probe, so the dialog
 * re-renders from the server's truth (one truth, no local surgery).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | { module?: unknown; pin?: unknown }
      | null;
    const moduleName =
      typeof body?.module === "string" ? body.module.trim().slice(0, 200) : "";
    if (!moduleName || !/^[A-Za-z0-9][A-Za-z0-9._\-+/]*$/.test(moduleName)) {
      return NextResponse.json(
        { error: "Body must carry a module name (letters, digits, . _ - + /)" },
        { status: 400 }
      );
    }
    const conn = getConnection(id);
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const detail = await probeModuleDetail(conn as RemoteConnection, moduleName);
    // The module tool's OWN verdict first: a non-zero load rc means the name
    // is wrong even when a stale environment still offers relion_refine on
    // PATH (the mock and half-loaded shells both do this) — reporting
    // success there would forge the exact confirmation the user asked for.
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

    // ---- verified: merge into lastProbe + optional pin --------------------
    const probe: RemoteProbe = conn.lastProbe
      ? { ...conn.lastProbe }
      : {
          ok: true,
          checkedAt: new Date().toISOString(),
          uname: null,
          moduleSystem: "none",
          relionModules: [],
          relionHomes: {},
          relionMpi: {},
          relionCtffind: {},
          externals: {},
          slurm: false,
          gpus: [],
          slurmGpus: [],
          homeDir: null,
        };
    if (!probe.relionModules.includes(moduleName)) {
      probe.relionModules = [...probe.relionModules, moduleName].sort((a, b) => {
        const va = /(\d+(?:\.\d+)*)/.exec(a)?.[1] ?? "0";
        const vb = /(\d+(?:\.\d+)*)/.exec(b)?.[1] ?? "0";
        return vb.localeCompare(va, undefined, { numeric: true });
      });
    }
    probe.relionHomes = { ...probe.relionHomes, [moduleName]: detail.home };
    probe.relionMpi = { ...probe.relionMpi, [moduleName]: detail.mpi };
    if (detail.ctffind) {
      probe.relionCtffind = { ...probe.relionCtffind, [moduleName]: detail.ctffind };
    }
    if (Object.keys(detail.externals).length > 0) {
      probe.externals = { ...probe.externals, [moduleName]: detail.externals };
    }

    const patch: Record<string, unknown> = { lastProbe: probe };
    if (body?.pin === true) patch.defaultModule = moduleName;
    const patched = patchConnection(id, patch);
    if (!patched) {
      return NextResponse.json({ error: "Connection vanished while patching" }, { status: 404 });
    }
    dropConnection(id); // the probe facts changed — re-handshake on next use

    return NextResponse.json({
      ok: true,
      module: moduleName,
      relionHome: detail.home,
      mpi: detail.mpi,
      ctffind: detail.ctffind,
      connection: await withRunResume(toConnectionDTO(patched)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "module verification failed" },
      { status: 500 }
    );
  }
}
