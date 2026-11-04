/**
 * One-off codemod: route every job-scoped results endpoint through the
 * soft-link resolver (findEffectiveJob) so linked copies resolve to the
 * ORIGINAL's run/outputs. Idempotent.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const BASE = "/home/z/my-project/src/app/api/jobs/[id]";
const FILES = [
  "picks/route.ts",
  "outputs/file/route.ts",
  "outputs/star/route.ts",
  "outputs/route.ts",
  "angdist/route.ts",
  "classes/route.ts",
  "micrographs/route.ts",
  "fsc/route.ts",
  "guinier/route.ts",
  "ctf/route.ts",
  "resolution/route.ts",
  "particles/route.ts",
];

const OLD_CALL = "const job = await db.job.findUnique({ where: { id } });";
const NEW_CALL = "const job = await findEffectiveJob(id); // resolves soft links to the original";

for (const rel of FILES) {
  const file = path.join(BASE, rel);
  let text = readFileSync(file, "utf8");
  if (!text.includes(OLD_CALL)) {
    console.log(`SKIP (no pattern): ${rel}`);
    continue;
  }
  text = text.replace(OLD_CALL, NEW_CALL);
  if (!text.includes('from "@/lib/link"')) {
    text = text.replace(
      'import { db } from "@/lib/db";',
      'import { db } from "@/lib/db";\nimport { findEffectiveJob } from "@/lib/link";'
    );
  }
  writeFileSync(file, text);
  // report whether db is still used (import may become dangling)
  const uses = (text.match(/\bdb\./g) ?? []).length;
  console.log(`PATCHED: ${rel} (db. usages left: ${uses})`);
}
