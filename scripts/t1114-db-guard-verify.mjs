// t1114 db-guard verification — the two-DB trap's own test.
// Run WITHOUT DATABASE_URL: the warn MUST fire (the template world).
// Run WITH DATABASE_URL=...cryoflow.db: SILENT (the runtime world).
import { createJiti } from "jiti";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, { alias: { "@": path.resolve(ROOT, "src") } });

const label = process.argv[2] ?? "unlabeled";
console.error(`[${label}] importing src/lib/db.ts …`);
const { db } = await __jiti.import("../src/lib/db.ts");
// one honest query to prove the client is alive on whichever world it landed
const n = await db.project.count();
console.log(`[${label}] project count: ${n}`);
await db.$disconnect();
