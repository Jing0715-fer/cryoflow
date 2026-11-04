// t1114 band-read — the cheap read-only shelf health probe (no measure).
import { createJiti } from "jiti";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, { alias: { "@": path.resolve(ROOT, "src") } });

const PID = process.argv[2] ?? "cmvbjl6060000srlis2ai5mb3";
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
const t0 = Date.now();
const r = await executeAiTool("get_fleet_ledger", {}, { projectId: PID });
console.log(`band read answered in ${Date.now() - t0}ms`);
console.log("head:", String(r?.summary ?? "").slice(0, 200));
