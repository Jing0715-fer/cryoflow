/**
 * One-off migration: backfill the Workspace table.
 * - Creates a "Main" workspace (order 0) for every existing project
 * - Assigns every job (workspaceId null) to its project's Main workspace
 * Idempotent — safe to re-run.
 * Usage: bun scripts/migrate-workspaces.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const projects = await db.project.findMany({ select: { id: true } });
  for (const p of projects) {
    let main = await db.workspace.findFirst({
      where: { projectId: p.id },
      orderBy: { order: "asc" },
    });
    if (!main) {
      main = await db.workspace.create({
        data: { projectId: p.id, name: "Main", order: 0 },
      });
      console.log(`project ${p.id}: created workspace "${main.name}" (${main.id})`);
    }
    const res = await db.job.updateMany({
      where: { projectId: p.id, workspaceId: null },
      data: { workspaceId: main.id },
    });
    if (res.count > 0) {
      console.log(`project ${p.id}: assigned ${res.count} job(s) to ${main.name}`);
    }
  }
  const total = await db.workspace.count();
  console.log(`done — ${total} workspace(s) total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
