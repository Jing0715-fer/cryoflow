// t1109-band-ride.mjs — the band's silences seat's ride witness.
// One dispatch per invocation; the stage names the film's beat:
//   absent   — the flat world: the band carries NO silences clause
//   singular — one lone hole interior: the pair sentence
//   plural   — two lone holes: the ages sentence
// The DB is pinned (the t377/t635 lesson); the tool is the shelf's own.
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";
const { createJiti } = await import("jiti");
const __jiti = createJiti(import.meta.url, { alias: { "@": "/home/z/my-project/src" } });
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const project = await db.project.findFirst({
  where: { name: "β-Galactosidase Tutorial (demo)" },
  select: { id: true },
});
await db.$disconnect();
if (!project) {
  console.error("NO PROJECT");
  process.exit(1);
}
const measure = process.argv[3] === "measure";
const r = await executeAiTool(
  "get_fleet_ledger",
  measure ? { measure: true } : {},
  { projectId: project.id },
);
const summary = r?.summary ?? "";
const band = summary.split(" | ")[0] ?? "";
const sil =
  band.match(/(An honest silence[^.]*\.|[0-9]+ honest silences[^.]*\.)/)?.[1] ??
  "(no silences clause)";
console.log(
  JSON.stringify({ stage: process.argv[2] ?? "read", silences: sil, ok: r?.ok ?? null }),
);
