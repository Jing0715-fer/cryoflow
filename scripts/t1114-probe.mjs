// t1114 liveness probe — the ORTHODOX liveness (the t1111 law): pgrep + the
// port LISTEN + a measure dispatch. Read-only on the world EXCEPT the one
// honest measure (an auto-measure's push is the ring's ordinary weather —
// the t1113 as-left itself carried one). Reports the ring's shape after.
import { createJiti } from "jiti";
import path from "node:path";
import { readFileSync } from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, { alias: { "@": path.resolve(ROOT, "src") } });
const SIDECAR = path.join(ROOT, "data", "remote-fleet-ledger.json");

const stamp = () => new Date().toISOString().slice(11, 19);
const say = (msg) => console.log(`[${stamp()}] ${msg}`);

const readSidecar = () => JSON.parse(readFileSync(SIDECAR, "utf8"));
const ringPointsOf = (sc, pid) => {
  const hist = sc?.projects?.[pid]?.history ?? {};
  return Object.values(hist)[0] ?? [];
};

const describeRing = (pts, label) => {
  const n = pts.length;
  const nulls = pts.filter((p) => p.bytes == null).length;
  const zeros = pts.filter((p) => p.bytes === 0).length;
  const mZeros = pts.filter((p) => p.mirrorBytes === 0).length;
  const clusterVals = [...new Set(pts.map((p) => p.bytes))];
  const mirrorVals = [...new Set(pts.map((p) => p.mirrorBytes))];
  say(
    `${label}: ring ${n}/12, nulls ${nulls}, cluster-zeros ${zeros}, mirror-zeros ${mZeros}; ` +
      `cluster distinct ${JSON.stringify(clusterVals)}, mirror distinct ${JSON.stringify(mirrorVals)}`
  );
  return { n, nulls, zeros, mZeros };
};

say("importing the shelf…");
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const project = await db.project.findFirst({
  where: { name: "β-Galactosidase Tutorial (demo)" },
  select: { id: true, name: true },
});
await db.$disconnect();
if (!project) { say("FAIL the demo project is gone — the world is not the expected one"); process.exit(1); }
say(`project: ${project.id} "${project.name}"`);

const before = readSidecar();
describeRing(ringPointsOf(before, project.id), "BEFORE");

say("dispatching ONE measure (the orthodox liveness)…");
const t0 = Date.now();
const r = await executeAiTool("get_fleet_ledger", { measure: true }, { projectId: project.id });
say(`measure answered in ${Date.now() - t0}ms`);

const after = readSidecar();
const pts = ringPointsOf(after, project.id);
describeRing(pts, "AFTER");
const newest = pts[0] ?? null;
say(`newest stamp ${newest?.at ?? "(none)"}, bytes ${newest?.bytes ?? "null"}, mirror ${newest?.mirrorBytes ?? "null"}`);

const spoken = pts.length === 12 && pts.every((p) => p.bytes != null);
const flat =
  spoken && pts.every((p) => p.bytes === pts[0].bytes) && pts.every((p) => p.mirrorBytes === pts[0].mirrorBytes);
say(spoken ? "PASS the ring 12/12 ALL SPOKEN" : `WARN the ring holds ${pts.filter((p) => p.bytes == null).length} nulls`);
say(flat ? "PASS the purest flat (one distinct value per channel)" : "INFO the ring is not flat (holes or values riding) — read before judging");
if (r?.summary) say(`shelf summary head: ${String(r.summary).slice(0, 160)}`);
say("probe done.");
