import { readFileSync, existsSync } from "fs";

const starFile =
  "/home/z/my-project/data/relion/cmukrk2yy0000rjobryvy0pzu/ctffind_zffrydui/micrographs_ctf.star";

function bareMicName(cell: string): string {
  const base = cell.replace(/^\.?\//, "").split("/").pop() ?? cell;
  return base.replace(/\.(mrc|mrcs|tif|tiff)$/i, "");
}

if (!existsSync(starFile)) {
  console.log("FILE MISSING");
  process.exit(1);
}
const names: string[] = [];
const labels = new Map<string, number>();
let inLoop = false;
let stat = { data: 0, labels: 0, rows: 0, ixCalls: 0, pushes: 0 };
for (const raw of readFileSync(starFile, "utf8").split(/\r?\n/)) {
  const t = raw.trim();
  if (!t) continue;
  if (t.startsWith("data_")) {
    stat.data++;
    inLoop = t.startsWith("data_micrographs");
    if (inLoop) labels.clear();
    continue;
  }
  if (t === "loop_") continue;
  if (t.startsWith("_")) {
    if (inLoop) {
      const m = t.match(/^(\S+)\s+#(\d+)$/);
      if (m) {
        labels.set(m[1], Number(m[2]) - 1);
        stat.labels++;
      }
    }
    continue;
  }
  if (t.startsWith("#")) continue;
  stat.rows++;
  const ix =
    labels.get("_rlnMicrographName") ?? labels.get("_rlnMicrographNameNoDW");
  stat.ixCalls++;
  if (ix == null) continue;
  const cell = t.split(/\s+/)[ix];
  if (cell) {
    names.push(bareMicName(cell));
    stat.pushes++;
  }
}
console.log("stat:", JSON.stringify(stat), "labels:", [...labels.keys()]);
console.log("names:", names.length, "first:", names.slice(0, 3), "unique:", new Set(names).size);
