// t81 chain replay — run the palette's filter logic step by step in-page
// against fresh API data vs what the palette actually rendered.
import { chromium } from "playwright";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(800);

const replay = await p.evaluate(async () => {
  const { jobs } = await (await fetch("/api/jobs")).json();
  const { edges } = await (await fetch("/api/edges")).json();
  const { workspaces } = await (await fetch("/api/workspaces")).json().catch(() => ({ workspaces: [] }));

  const sel = jobs.find((j) => j.name === "QA Class Select");
  const steps = {};
  steps.total = jobs.length;
  steps.isSelect2d = sel?.type === "select2d";
  steps.status = sel?.status;
  steps.paramsType = typeof sel?.params;
  steps.classNotesRaw = sel?.params?.classNotes;
  steps.wsId = sel?.workspaceId;
  steps.wsExists = workspaces.some((w) => w.id === sel?.workspaceId);
  const sources = edges
    .filter((e) => e.toJobId === sel?.id)
    .map((e) => jobs.find((j) => j.id === e.fromJobId))
    .filter((j) => j && (j.type === "class2d" || j.type === "select2d"));
  steps.sources = sources.map((s) => ({ name: s.name, status: s.status }));
  return steps;
});
console.log(JSON.stringify(replay, null, 1));
await b.close();
