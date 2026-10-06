// t632 — pre-delete audit: tenant signals + edge references for the rows
// the ruling will touch. Read-only. (t161 radius doctrine: tenant alive
// → the row stays; the product door cascades edges, but a linked-copy
// guard may refuse — better to know before the first DELETE.)
// t641 — pin the repo's own live DB before the client is constructed
// (t377 poison law: a bare client eats the sandbox TEMPLATE URL from .env)
import path from "node:path";
import { fileURLToPath } from "node:url";
process.env.DATABASE_URL = `file:${path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")}/db/cryoflow.db`;
import { PrismaClient } from "@prisma/client";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const db = new PrismaClient();
const WORKROOT = "/home/z/my-project/data/relion";

const TENANT_SIGNALS = [".cf-remote-manifest.json", ".cf-cluster-state.json"];

function dirSize(p) {
  let n = 0;
  try {
    for (const e of readdirSync(p)) {
      const fp = join(p, e);
      const st = statSync(fp);
      n += st.isDirectory() ? dirSize(fp) : st.size;
    }
  } catch { /* gone */ }
  return n;
}

async function audit(label, ids, projId) {
  console.log(`\n=== ${label} (${ids.length} rows) ===`);
  const projDirs = existsSync(join(WORKROOT, projId))
    ? readdirSync(join(WORKROOT, projId)) : [];
  for (const id of ids) {
    const j = await db.job.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
    if (!j) { console.log(`  ${id} — GONE`); continue; }
    // edges: anything referencing this job as upstream or downstream
    const asUp = await db.edge.count({ where: { fromJobId: id } });
    const asDown = await db.edge.count({ where: { toJobId: id } });
    // workdir: data/relion/<projectId>/<dir whose suffix == jobId>
    const dirName = projDirs.find((d) => (d.includes("_") ? d.split("_", 1).slice(-1)[0] === id || d.split("_").pop() === id : d === id) || d.endsWith(id));
    let wd = "no-workdir";
    let tenant = [];
    let bytes = 0;
    if (dirName) {
      const full = join(WORKROOT, projId, dirName);
      tenant = TENANT_SIGNALS.filter((s) => existsSync(join(full, s)));
      bytes = dirSize(full);
      wd = `${dirName} ${bytes}B`;
    }
    console.log(
      `  ${id}  "${j.name}" ${j.status} edges(out=${asUp},in=${asDown}) wd=[${wd}]${tenant.length ? ` TENANT:${tenant.join(",")}` : ""}`
    );
  }
}

async function main() {
  // QA rows in demo
  const demo = await db.project.findFirst({ where: { name: { contains: "demo" } } });
  const demoJobs = await db.job.findMany({
    where: { projectId: demo.id, name: { startsWith: "QA " } },
    select: { id: true },
  });
  await audit("demo QA rows", demoJobs.map((j) => j.id), demo.id);

  // QA t474 project rows
  const t474 = await db.project.findFirst({ where: { name: { contains: "t474" } } });
  if (t474) {
    const t474Jobs = await db.job.findMany({ where: { projectId: t474.id }, select: { id: true } });
    console.log(`\nQA t474 project "${t474.name}": ${t474Jobs.length} jobs`);
    await audit("t474 rows", t474Jobs.map((j) => j.id), t474.id);
  }
}

main().finally(() => db.$disconnect());
