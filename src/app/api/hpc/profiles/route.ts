import { NextRequest, NextResponse } from "next/server";
import { loadProfiles, saveProfiles, defaultProfiles, type SlurmProfile } from "@/lib/hpc/slurm";

export const dynamic = "force-dynamic";

/**
 * GET /api/hpc/profiles — cluster profile registry (defaults + persisted).
 * POST — replace the registry (validated, sanitized).
 */
export async function GET() {
  return NextResponse.json({ profiles: loadProfiles() });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { profiles?: unknown };
    if (!Array.isArray(body.profiles)) {
      return NextResponse.json({ error: "Body must be { profiles: [...] }" }, { status: 400 });
    }
    const clean: SlurmProfile[] = [];
    const defaults = defaultProfiles();
    for (const raw of body.profiles.slice(0, 8)) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r.id === "string" && r.id.trim() ? r.id.trim().slice(0, 60) : `profile-${clean.length}`;
      // shape-guard each field; unknown fields are dropped
      clean.push({
        id,
        name: typeof r.name === "string" ? r.name.slice(0, 120) : id,
        host: typeof r.host === "string" && r.host.trim() ? r.host.trim().slice(0, 200) : null,
        partition: typeof r.partition === "string" ? r.partition.slice(0, 60) : "gpu",
        account: typeof r.account === "string" && r.account.trim() ? r.account.trim().slice(0, 60) : null,
        qos: typeof r.qos === "string" && r.qos.trim() ? r.qos.trim().slice(0, 60) : null,
        timeLimitMin: Number.isFinite(Number(r.timeLimitMin)) ? Math.max(0, Math.min(43200, Math.round(Number(r.timeLimitMin)))) : 720,
        nodes: Number.isFinite(Number(r.nodes)) ? Math.max(1, Math.min(1024, Math.round(Number(r.nodes)))) : 4,
        gpusPerNode: Number.isFinite(Number(r.gpusPerNode)) ? Math.max(0, Math.min(64, Math.round(Number(r.gpusPerNode)))) : 4,
        gpuModel: ["A100", "H100", "V100", "RTX4090"].includes(String(r.gpuModel)) ? (String(r.gpuModel) as SlurmProfile["gpuModel"]) : "A100",
        relionHome: typeof r.relionHome === "string" ? r.relionHome.slice(0, 300) : "/opt/relion/5.0.1",
        dataRoot: typeof r.dataRoot === "string" ? r.dataRoot.slice(0, 300) : "/lustre/project/cryoflow",
        localRoot: typeof defaults[1]?.localRoot === "string" ? defaults[1].localRoot : "data/relion",
        envLines: Array.isArray(r.envLines) ? r.envLines.filter((l) => typeof l === "string").map((l) => String(l).slice(0, 300)).slice(0, 12) : [],
        ctffind: typeof r.ctffind === "string" && r.ctffind.trim() ? r.ctffind.trim().slice(0, 300) : null,
        arrayConcurrency: Number.isFinite(Number(r.arrayConcurrency)) ? Math.max(1, Math.min(512, Math.round(Number(r.arrayConcurrency)))) : 16,
        gpuSpeedup: Number.isFinite(Number(r.gpuSpeedup)) ? Math.max(1, Math.min(1000, Math.round(Number(r.gpuSpeedup)))) : 25,
      });
    }
    if (clean.length === 0) {
      return NextResponse.json({ error: "No valid profiles supplied" }, { status: 400 });
    }
    saveProfiles(clean);
    return NextResponse.json({ profiles: clean });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "profile save failed" }, { status: 500 });
  }
}
