// t282 — updatedAt honesty: a PATCH that writes the SAME values no longer
// touches @updatedAt.
//
// The bug was never in Prisma — @updatedAt fires on every update() CALL,
// faithfully. The lie was in what the dashboard's "updated X ago" then
// claimed: it answered "the last REQUEST" (drag jitter landing back on
// the same spot, a repeated save, an empty body) instead of "the last
// REAL edit". Task 164 already taught the store's equality predicate not
// to DEPEND on the courtesy; this patch removes the courtesy itself.
//
// The idle-reset branch is exempt BY DESIGN: it is an explicit intent
// whose kill + record-clear side effects have already run when the check
// would fire — a reset always touches the stamp.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  source ledger — the no-op detection, the semantic params compare,
//      the reset exemption, the short-circuit return of `existing`
//   C  alive on a demo import job — same-value PATCH keeps the stamp,
//      empty body keeps it, a real change moves it; params same/different
//      (semantic compare), name and note likewise; the reset intent
//      touches even when everything already equals the reset values
//   Z  roster identity + the dashboard's consumer still wired
//
// Run: node scripts/t282-updated-at-honesty.mjs   (server on :3000)
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "User-Agent": "Mozilla/5.0",
  "Content-Type": "application/json",
};

console.log("== PHASE A: demo truth ==");
const home = await fetch(`${BASE}/`, { headers: SH });
must(home.status === 200, `homepage 200 (got ${home.status})`);
const jobs0 = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobs0.jobs ?? []).length === 21, `roster 21 at the start (got ${(jobs0.jobs ?? []).length})`);

console.log("== PHASE B: source ledger ==");
const { readFileSync } = await import("node:fs");
const routeSrc = readFileSync("src/app/api/jobs/[id]/route.ts", "utf8");
must(routeSrc.includes("patchIsNoOp"), "the PATCH grows the no-op detection");
must(routeSrc.includes("keys.length === 0) return true"), "an empty body is a no-op (Prisma touches @updatedAt even for empty data)");
must(routeSrc.includes("resetIntent"), "the idle-reset intent is EXEMPT (its side effects already ran)");
must(routeSrc.includes("JSON.stringify(JSON.parse(v as string)) === JSON.stringify(storedParams)"),
  "params compare SEMANTICALLY (stringify can disagree on key order)");
must(routeSrc.includes("if (storedParams === null) return false;"),
  "unparseable stored params are never 'equal' (writing the merge is the honest fix)");
must(routeSrc.includes("? existing\n        : await db.job.update"), "a no-op returns the existing row (no update call, no touch)");
const dashSrc = readFileSync("src/components/workflow/project-dashboard.tsx", "utf8");
must(dashSrc.includes("formatDistanceToNow(new Date(j.updatedAt)"),
  "the dashboard's 'updated X ago' is the consumer this patch makes honest");

console.log("== PHASE C: the stamp, alive ==");
const job = (jobs0.jobs ?? []).find((j) => j.type === "import" && j.name === "Import Movies 1");
must(!!job, "the demo Import Movies 1 is the specimen");
if (job) {
  const patch = (body) =>
    fetch(`${BASE}/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: SH,
      body: JSON.stringify(body),
    });
  const stamp = async () =>
    (await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json()).jobs.find((j) => j.id === job.id).updatedAt;

  const s0 = await stamp();
  must(!!s0, `the stamp is readable (got ${s0})`);
  await sleep(1100); // the clock must MOVE past s0 for the honesty probe to mean anything

  // C1 — same-value PATCH (x written back at its current value) keeps it
  const sameX = await patch({ x: job.x });
  must(sameX.status === 200, `a same-value PATCH answers 200 (got ${sameX.status})`);
  must(!!(await sameX.json()).job?.id, "the response shape is untouched (job DTO)");
  const s1 = await stamp();
  must(s1 === s0, `a same-value PATCH does NOT touch the stamp (${s0 === s1 ? "held" : `LIED: ${s0} -> ${s1}`})`);

  // C2 — an empty body is a no-op too
  await patch({});
  const s2 = await stamp();
  must(s2 === s0, `an empty PATCH does NOT touch the stamp (held: ${s2 === s0})`);

  // C3 — a real change moves it
  const movedX = (job.x ?? 16) === 16 ? 20 : 16;
  await patch({ x: movedX });
  const s3 = await stamp();
  must(s3 !== s0, `a real change moves the stamp (${s0.slice(17)} -> ${s3.slice(17)})`);

  // C4 — params: same map keeps it, a changed key moves it
  const cur = job.params ?? {};
  const sameParams = await patch({ params: cur });
  must(sameParams.status === 200, `a same-map params PATCH answers 200 (got ${sameParams.status})`);
  const s4 = await stamp();
  must(s4 === s3, `a same-map params PATCH does NOT touch the stamp (held: ${s4 === s3})`);
  const pixel = (cur.pixelSize ?? 1.77) === 1.77 ? 1.78 : 1.77;
  await patch({ params: { ...cur, pixelSize: pixel } });
  const s5 = await stamp();
  must(s5 !== s3, `a changed param moves the stamp (${s3.slice(17)} -> ${s5.slice(17)})`);

  // C5 — name and note behave the same
  await patch({ name: job.name });
  const s6 = await stamp();
  must(s6 === s5, "a same-value name PATCH does not touch the stamp");
  await patch({ note: job.note ?? "" });
  const s7 = await stamp();
  must(s7 === s6, `a same-value note PATCH does not touch the stamp (note ${job.note == null ? "absent -> writes null?" : "present"})`);

  // C6 — the reset intent touches even when everything already equals
  // the reset values (an explicit intent, side effects already ran)
  const beforeReset = await stamp();
  await patch({ status: "idle" });
  const s8 = await stamp();
  must(s8 !== beforeReset, `the reset intent ALWAYS touches (${beforeReset.slice(17)} -> ${s8.slice(17)})`);

  // restore the specimen's canvas position (a real change, on purpose)
  const back = await patch({ x: job.x });
  must(back.status === 200, "the specimen's x is restored");
  const after = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
  must(after.jobs.find((j) => j.id === job.id).x === job.x, "the specimen's canvas position is exactly as found");
}

console.log("== PHASE Z: the world as it was ==");
const jobsEnd = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobsEnd.jobs ?? []).length === 21, `roster 21 after the dance (got ${(jobsEnd.jobs ?? []).length})`);

// a light browser pass — the canvas still paints and the console is clean
const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2000);
must((await page.locator("[data-job]").count()) === 21, "the canvas paints its 21 jobs");
await browser.close();
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors)`);

console.log(fail === 0 ? "\nt282: ALL PASS" : `\nt282: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
