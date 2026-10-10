// t632 — demo archaeology census: the 20 QA rows t630 convicted in the demo
// project, plus the 2 QA t474 rows. Read-only: names, states, workdirs,
// tenant signals, per-row — so the ruling can be row-by-row (t628 doctrine).
// t641 — pin the repo's own live DB before the client is constructed
// (t377 poison law: a bare client eats the sandbox TEMPLATE URL from .env)
import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.DATABASE_URL = `file:${path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")}/db/cryoflow.db`;
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const projects = await db.project.findMany({ select: { id: true, name: true } });
  console.log("projects:", projects.map((p) => `${p.name}(${p.id.slice(0, 8)})`).join(", "));

  const demo = projects.find((p) => p.name.toLowerCase().includes("demo"));
  if (!demo) { console.log("NO DEMO PROJECT"); return; }
  console.log(`demo = ${demo.name} (${demo.id})`);

  const jobs = await db.job.findMany({
    where: { projectId: demo.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, type: true, status: true, workspaceId: true,
      createdAt: true, updatedAt: true,
    },
  });
  console.log(`\ndemo total jobs: ${jobs.length}`);

  // QA-flavoured rows (t630 census: 20 QA rows + 2 QA t474)
  const qaRe = /^QA |QA\b|t474/i;
  const qaRows = jobs.filter((j) => qaRe.test(j.name));
  const others = jobs.filter((j) => !qaRe.test(j.name));
  console.log(`QA-flavoured rows: ${qaRows.length}; others: ${others.length}`);

  for (const j of qaRows) {
    const ageD = ((Date.now() - j.createdAt.getTime()) / 86400000).toFixed(1);
    console.log(
      `  ${j.id}  "${j.name}"  type=${j.type} status=${j.status} ws=${j.workspaceId ? j.workspaceId.slice(0, 8) : "NULL"} age=${ageD}d`
    );
  }
  console.log(`\nnon-QA demo rows:`);
  for (const j of others) {
    console.log(`  ${j.id}  "${j.name}"  type=${j.type} status=${j.status} ws=${j.workspaceId ? j.workspaceId.slice(0, 8) : "NULL"}`);
  }
}

main().finally(() => db.$disconnect());
