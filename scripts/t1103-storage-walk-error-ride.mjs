// t1103-storage-walk-error-ride.mjs — THE WALK'S OWN SILENCE, TYPED,
// LIVE (Task 1103). The typed StorageWalkError's three mouths ridden
// through the honest trigger (chmod 000 the project's relion dir — the
// walk's top readdir throws EACCES, the world was never lied to, the
// walk simply couldn't speak):
//
//   f1 — the broken window: the AI tool (get_storage_report through
//        executeAiTool) reads the WALK-FAILED face (the family's line —
//        ok:false, NEVER the false absence "gone"); curl reads the
//        ROUTE's face (the 500 body's family line verbatim). LEAVES
//        THE WORLD BROKEN (the camera needs it).
//   v  — the restored world: the walk speaks again — the tool's normal
//        summary (ok:true, the project's weight), the route 200, the
//        mode 775, the ring untouched (the storage walk never writes
//        the sidecar).
//
// The CAMERA (between f1 and v, agent-browser): open the Project
// storage overview — the dialog's danger panel pours the route's words
// verbatim, the Try again door waits. Photograph, close, then run v.
//
// ⚠ PIN the DB explicitly (the t377/t635 poisoning lesson).
process.env.DATABASE_URL = "file:/home/z/my-project/db/cryoflow.db";

import { createJiti } from "jiti";
import path from "node:path";
import { readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const __jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(ROOT, "src") },
});

const WATCHDOG_MS = 120_000;

const stamp = () => new Date().toISOString().slice(11, 19);
const say = (msg) => console.log(`[${stamp()}] ${msg}`);

const withWatchdog = async (label, promise) => {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`WATCHDOG: ${label} exceeded ${WATCHDOG_MS}ms`)), WATCHDOG_MS);
  });
  try {
    return await Promise.race([promise, guard]);
  } finally {
    clearTimeout(timer);
  }
};

const modeOf = (dir) => (statSync(dir).mode & 0o777).toString(8).padStart(3, "0");
const chmodDir = (dir, mode) => {
  execSync(`chmod ${mode} "${dir}"`);
  say(`chmod ${mode} ${dir} (now ${modeOf(dir)})`);
};

say("importing the shelf…");
const { executeAiTool } = await __jiti.import("../src/lib/ai/tools.ts");
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const project = await db.project.findFirst({
  where: { name: "β-Galactosidase Tutorial (demo)" },
  select: { id: true, name: true },
});
if (!project) throw new Error("demo project not found — the world is not the expected one");
await db.$disconnect();
say(`project: ${project.id} "${project.name}"`);

const PROJECT_DIR = path.join(ROOT, "data", "relion", project.id);
const AS_FOUND_MODE = "775";
const ctx = { projectId: project.id };
const FAMILY_LINE_TOOL =
  "The storage walk could not speak — the run directories are unreadable from here (an honest unknown, never a zero). The ledger's faces wait for a spoken walk; ask again once the directories are readable.";
const FAMILY_LINE_ROUTE =
  "The storage walk could not speak — the run directories are unreadable from here (an honest unknown, never a zero). Every face in this dialog waits for a spoken walk.";

const expect = (name, cond) => say(`${cond ? "PASS" : "FAIL"} ${name}`);

const toolRead = async (label) => {
  const r = await withWatchdog(`tool ${label}`, executeAiTool("get_storage_report", {}, ctx));
  say(`[${label}] TOOL ok=${r?.ok} summary: ${(r?.summary ?? "").slice(0, 140)}`);
  return r;
};
const routeRead = async (label) => {
  // the local gate's own dialect: a same-origin fetch (the dialog's
  // browser sends sec-fetch-site: same-origin; the harness says the
  // same — the gate is the route's law, the harness obeys it)
  const res = await fetch(`http://localhost:3000/api/projects/${project.id}/storage`, {
    headers: { "sec-fetch-site": "same-origin" },
  });
  const body = await res.json().catch(() => ({}));
  say(`[${label}] ROUTE ${res.status}: ${JSON.stringify(body).slice(0, 180)}`);
  return { status: res.status, body };
};

const restore = (why) => {
  if (modeOf(PROJECT_DIR) !== AS_FOUND_MODE) {
    chmodDir(PROJECT_DIR, AS_FOUND_MODE);
    say(`RESTORED (${why})`);
  }
};

const stage = process.argv[2];
if (!stage || !["f1", "v"].includes(stage)) {
  console.error("usage: node scripts/t1103-storage-walk-error-ride.mjs <f1|v>");
  process.exit(2);
}

if (stage === "f1") {
  say("=== STAGE f1 — the chmod, the TYPED faces (LEAVES THE WORLD BROKEN) ===");
  const m0 = modeOf(PROJECT_DIR);
  if (m0 !== AS_FOUND_MODE) {
    say(`unexpected as-found mode ${m0} — restoring ${AS_FOUND_MODE} first`);
    chmodDir(PROJECT_DIR, AS_FOUND_MODE);
  }
  chmodDir(PROJECT_DIR, "000");

  const tool = await toolRead("f1-tool");
  expect("f1 the TOOL answers ok:false (an honest failure, never a fake report)", tool?.ok === false);
  expect("f1 the TOOL reads the family's line verbatim", tool?.summary === FAMILY_LINE_TOOL);
  expect("f1 the FALSE ABSENCE is dead (no 'gone' anywhere)", !(tool?.summary ?? "").includes("gone"));

  const route = await routeRead("f1-route");
  expect("f1 the ROUTE answers 500", route.status === 500);
  expect("f1 the ROUTE's body carries the family's line verbatim", route.body?.error === FAMILY_LINE_ROUTE);
  expect("f1 the ROUTE never wears the generic face for a walk failure", route.body?.error !== "Failed to compute storage");

  say(">>> THE WORLD IS NOW BROKEN (chmod 000) — run the CAMERA witness (the storage dialog's danger panel), then stage v (which restores).");
}

if (stage === "v") {
  say("=== STAGE v — the restored world: the walk speaks again ===");
  restore("stage v's entry law");
  const tool = await toolRead("v-tool");
  expect("v the TOOL answers ok:true again (the walk spoke)", tool?.ok === true);
  expect("v the TOOL reads the project's weight (the normal summary)", typeof tool?.summary === "string" && tool.summary.includes(project.name) && tool.summary.includes("weighs"));
  expect("v the TOOL never wears the walk-failed face in the spoken world", !(tool?.summary ?? "").includes("could not speak"));
  const route = await routeRead("v-route");
  expect("v the ROUTE answers 200", route.status === 200);
  expect("v the ROUTE's body is the walk's own ledger (no error key)", route.body?.error == null && typeof route.body?.totalBytes === "number");
  expect("v the world AS FOUND (mode 775)", modeOf(PROJECT_DIR) === AS_FOUND_MODE);
}

say("stage done.");
process.exit(0);
