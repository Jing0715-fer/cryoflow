import { db } from "../src/lib/db";
import { getRun } from "../src/lib/relion/engine";

const autopickId = "cmukrkgjn000crjobud2kzmms";

async function main() {
  const edges = await db.edge.findMany({
    where: { toJobId: { in: [autopickId] } },
    select: { fromJobId: true },
  });
  console.log("depth1 edges:", JSON.stringify(edges));
  const ids = edges.map((e) => e.fromJobId);
  if (ids.length === 0) process.exit(0);
  const jobs = await db.job.findMany({
    where: { id: { in: ids } },
    select: { id: true, type: true, linkedJobId: true },
  });
  console.log("providers:", JSON.stringify(jobs));
  for (const j of jobs) {
    const r = getRun(j.id);
    console.log(`run ${j.id} (${j.type}):`, r ? "exists" : "MISSING");
    if (r) {
      console.log("  outputs keys:", Object.keys(r.outputs ?? {}));
      for (const k of ["micrographs_star", "micrographs_ctf_star"]) {
        const p = r.outputs?.[k];
        console.log(`  ${k}:`, p ?? "(absent)");
      }
    }
  }
  process.exit(0);
}
main();
