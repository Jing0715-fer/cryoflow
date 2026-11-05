import { presentSystemDiagnostics } from "@/lib/diagnostics";
import { readFileSync } from "node:fs";

const d = JSON.parse(readFileSync("/tmp/diag-t883.json", "utf8"));
const res = presentSystemDiagnostics(d);
const s = res.summary ?? "";
const i = s.indexOf("the kernel ring");
console.log(i >= 0 ? s.slice(i) : "(no pressure segment)");
