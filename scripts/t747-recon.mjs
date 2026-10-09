// t747 recon — pour distribution across the type space (world first).
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createJiti } from "jiti";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src") },
});
const { JOB_TYPES, pourKindsOf, drinkKindsOf } = await __jiti.import("../src/lib/workflow");
const dist = new Map();
const zeroPours = [];
let maxP = 0;
for (const t of JOB_TYPES) {
  const p = pourKindsOf(t.key);
  dist.set(p.length, (dist.get(p.length) ?? 0) + 1);
  if (p.length === 0) zeroPours.push(t.key);
  maxP = Math.max(maxP, p.length);
  console.log(`${t.key}\tpours=${p.length}[${p.join(",")}]\tdrinks=${drinkKindsOf(t.key).length}`);
}
console.log("DIST", JSON.stringify([...dist.entries()].sort((a, b) => a[0] - b[0])));
console.log("ZERO_POURS", JSON.stringify(zeroPours));
console.log("MAX_POURS", maxP);
console.log("TOTAL_TYPES", JOB_TYPES.length);
