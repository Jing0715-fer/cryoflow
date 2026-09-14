import { statSync, readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const FILE = "/home/z/my-project/data/engine-state.json";
const LIVE_ID = "cmu1a3ifj009zq1jvxafg8hv3";
const db = new PrismaClient();

const st = statSync(FILE);
const s = JSON.parse(readFileSync(FILE, "utf8"));
const r = s[LIVE_ID];
const j = await db.job.findUnique({
  where: { id: LIVE_ID },
  select: { status: true, result: true, startedAt: true },
});

console.log(
  "file:  mtime=" + st.mtime.toISOString().slice(11, 19), "size=" + st.size,
  "keys=" + Object.keys(s).length
);
console.log(
  "rec:  ",
  r ? "pid=" + r.pid + " done=" + r.done + " started=" + String(r.startedAt || "").slice(11, 19) : "GONE"
);
console.log(
  "row:  ",
  j ? j.status + " | " + String(j.result || "").slice(0, 44) + " | startedAt=" + j.startedAt : "GONE"
);
await db.$disconnect();
