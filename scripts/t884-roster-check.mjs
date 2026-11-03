import { readFileSync } from "node:fs";
const SH = {
  Origin: "http://localhost:3000",
  Referer: "http://localhost:3000/",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};
const d = await (await fetch("http://localhost:3000/api/jobs", { headers: SH })).json();
const jobs = d.jobs ?? [];
console.log("ROSTER", jobs.length);
const suspects = jobs.filter((j) => /t882|t884|Pick Delta|Model Face|AutoPick|Topaz Train|Import/.test(j.name ?? ""));
for (const j of suspects) console.log("SUSPECT", j.id, j.name, j.status);
