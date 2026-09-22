/**
 * Repair QA Sandbox B fixture corruption (Task 31, Bug #33 aftermath).
 *
 * State found:
 *   - TWO workspace rows both named "Main" (parallel-session race artifact)
 *   - 3 original jobs with workspaceId=NULL (pre-workspace legacy shape)
 * Goal:
 *   - ONE "Main" workspace; every B job lives in it
 *   - duplicates merged into the earliest row, then deleted
 * Idempotent: safe to re-run.
 *
 * Run: node scripts/fix-sandbox-b-fixture.mjs
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const b = await p.project.findFirst({ where: { name: "QA Sandbox B" } });
  if (!b) {
    console.log("QA Sandbox B not found — nothing to do");
    return;
  }
  const wss = await p.workspace.findMany({
    where: { projectId: b.id },
    orderBy: { createdAt: "asc" },
  });
  const jobs = await p.job.findMany({ where: { projectId: b.id } });
  console.log(`B: ${wss.length} workspaces [${wss.map((w) => w.name).join(", ")}], ${jobs.length} jobs`);

  let keep;
  if (wss.length === 0) {
    keep = await p.workspace.create({ data: { projectId: b.id, name: "Main" } });
    console.log("created Main workspace", keep.id);
  } else {
    keep = wss[0]; // earliest wins
    for (const extra of wss.slice(1)) {
      const moved = await p.job.updateMany({
        where: { workspaceId: extra.id },
        data: { workspaceId: keep.id },
      });
      await p.workspace.delete({ where: { id: extra.id } });
      console.log(`merged duplicate ws ${extra.name}/${extra.id} -> ${keep.id} (${moved.count} jobs moved)`);
    }
  }

  // legacy NULL-workspace jobs -> the surviving Main
  const fixed = await p.job.updateMany({
    where: { projectId: b.id, workspaceId: null },
    data: { workspaceId: keep.id },
  });
  console.log(`re-homed ${fixed.count} NULL-workspace jobs into "${keep.name}"`);

  const wss2 = await p.workspace.findMany({ where: { projectId: b.id } });
  const jobs2 = await p.job.findMany({ where: { projectId: b.id } });
  const nulls = jobs2.filter((j) => !j.workspaceId).length;
  console.log(`final: ${wss2.length} ws [${wss2.map((w) => w.name).join(", ")}], null-ws jobs: ${nulls}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
