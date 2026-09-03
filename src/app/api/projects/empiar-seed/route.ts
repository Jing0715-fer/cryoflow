import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProjectDTO, jitteredDuration } from "@/lib/seed";
import { registerProject } from "@/lib/projects";
import { defaultParams, jobType } from "@/lib/workflow";
import { startJob } from "@/lib/relion/dispatch";
import type { Job } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/empiar-seed — create the REAL EMPIAR-10017 project:
 * 10 wired jobs (import → ctffind/manualpick → extract → select → class2d →
 * initialmodel → refine3d → maskcreate/postprocess) with engine 'relion'.
 * import + manualpick are engine-native and auto-run at seed time.
 */
export async function POST() {
  try {
    const project = await db.project.create({
      data: { name: "EMPIAR-10017 β-Galactosidase (REAL)" },
    });
    registerProject(project.id, { mode: "spa", engine: "relion" }, true);

    interface JobSpec {
      type: string;
      name: string;
      x: number;
      y: number;
      params: Record<string, number | string | boolean>;
    }
    const specs: JobSpec[] = [
      {
        type: "import",
        name: "Import · EMPIAR-10017",
        x: 16,
        y: 240,
        params: { ...defaultParams("import"), empiarData: "true" },
      },
      {
        type: "ctffind",
        name: "CtfFind · EMPIAR-10017",
        x: 304,
        y: 240,
        params: defaultParams("ctffind"),
      },
      {
        type: "manualpick",
        name: "ManualPick · Henderson coords",
        x: 16,
        y: 420,
        params: defaultParams("manualpick"),
      },
      {
        type: "extract",
        name: "Extract · β-gal particles",
        x: 304,
        y: 420,
        params: defaultParams("extract"),
      },
      {
        type: "select",
        name: "Select · first 1000",
        x: 592,
        y: 420,
        params: defaultParams("select"),
      },
      {
        type: "class2d",
        name: "Class2D · 10 classes",
        x: 592,
        y: 240,
        params: defaultParams("class2d"),
      },
      {
        type: "initialmodel",
        name: "InitialModel · D2",
        x: 880,
        y: 240,
        params: defaultParams("initialmodel"),
      },
      {
        type: "refine3d",
        name: "Refine3D · gold-standard",
        x: 880,
        y: 420,
        params: { ...defaultParams("refine3d"), autoRefine: false },
      },
      {
        type: "maskcreate",
        name: "MaskCreate · soft mask",
        x: 1168,
        y: 240,
        params: defaultParams("maskcreate"),
      },
      {
        type: "postprocess",
        name: "PostProcess · sharpen",
        x: 1168,
        y: 420,
        params: defaultParams("postprocess"),
      },
    ];

    const created: Record<string, Job> = {};
    for (const s of specs) {
      created[s.type] = await db.job.create({
        data: {
          projectId: project.id,
          type: s.type,
          name: s.name,
          x: s.x,
          y: s.y,
          params: JSON.stringify(s.params),
          duration: jitteredDuration(jobType(s.type)?.duration ?? 5000),
        },
      });
    }

    await db.edge.createMany({
      data: [
        { projectId: project.id, fromJobId: created.import.id, toJobId: created.ctffind.id },
        { projectId: project.id, fromJobId: created.import.id, toJobId: created.manualpick.id },
        { projectId: project.id, fromJobId: created.ctffind.id, toJobId: created.extract.id },
        { projectId: project.id, fromJobId: created.manualpick.id, toJobId: created.extract.id },
        { projectId: project.id, fromJobId: created.extract.id, toJobId: created.select.id },
        { projectId: project.id, fromJobId: created.select.id, toJobId: created.class2d.id },
        { projectId: project.id, fromJobId: created.class2d.id, toJobId: created.initialmodel.id },
        { projectId: project.id, fromJobId: created.initialmodel.id, toJobId: created.refine3d.id },
        { projectId: project.id, fromJobId: created.refine3d.id, toJobId: created.maskcreate.id },
        { projectId: project.id, fromJobId: created.refine3d.id, toJobId: created.postprocess.id },
        { projectId: project.id, fromJobId: created.maskcreate.id, toJobId: created.postprocess.id },
      ],
    });

    // Auto-run the two engine-native jobs (import, then manualpick which
    // consumes import's micrographs.star output).
    await startJob(created.import, "relion");
    await startJob(created.manualpick, "relion");

    return NextResponse.json(
      { project: toProjectDTO(project, "spa", "relion") },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/empiar-seed failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
