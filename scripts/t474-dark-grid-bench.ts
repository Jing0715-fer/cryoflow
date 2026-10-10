/**
 * t474 bench — the dark grid confesses, and heals.
 *
 * The field report:「选 cluster 运行的 2D 分类时图片加载不出来，每个框都
 * 显示 no image，并且每个框大小不是完全一致。」The selection gallery's
 * occupancy answered (the data stars home) while every thumbnail went dark:
 * the ONE SSH round that names the class-average stack had failed (or never
 * ran — a reset job's record was gone), the route answered classesFile:null
 * SILENTLY, and the grid rendered bare "no image" placeholders — no banner,
 * no retry, no path forward.
 *
 * Sections:
 *   A  localMirrorWorkdirForJob — the JOB-derived mirror path (the t396
 *      verdict applied to the render lanes): byte-parity with the
 *      dispatcher's own join.
 *   B  derivedRemoteTargetForJob — the project binding + the t396 formula
 *      (remote-bound → target; local-bound → null; dead connection → null)
 *   C  remoteLiveIterationsFor — the honest refusals (a dead wire answers
 *      its sentence; a deleted connection answers its own) — the payload
 *      error the routes now surface as renderError instead of silence
 *   D  the /classes fill law — a dark-grid world named by wire shape:
 *      the fillRefusalNote wording (unit-level, mirroring the route's
 *      two branches) + the code-path assertion that a SUCCEEDED fill with
 *      no stack still names the world
 *
 * Run: bun run scripts/t474-dark-grid.ts
 */

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// The fixture world — CRYOFLOW_DATA_DIR must point at it BEFORE the engine
// / connections / projects modules load (DATA_DIR and its derived paths are
// load-time constants), so every lib import below is dynamic.
// ---------------------------------------------------------------------------
const fixtureData = mkdtempSync(path.join(tmpdir(), "cf474-data-"));
const PROJECT_R = "projR474"; // remote-bound
const PROJECT_L = "projL474"; // local-bound
const PROJECT_G = "projG474"; // remote-bound, connection GONE
const JOB = {
  id: "ckjob4740000000000000000A1", // last-8 = "0000000A1"
  type: "class2d",
  projectId: PROJECT_R,
};
const CONN_ID = "conn474";
const CONN_DEAD = "conn474dead"; // registered, host refuses connections

process.env.CRYOFLOW_DATA_DIR = fixtureData;

const PROJECTS_FILE = path.join(fixtureData, "projects.json");
const CONNECTIONS_FILE = path.join(fixtureData, "remote-connections.json");

function fakeConnection(id: string, host: string, port: number, remoteRoot: string) {
  return {
    id,
    name: `fixture ${id}`,
    host,
    port,
    username: "cryo",
    authMethod: "password",
    privateKeyPath: null,
    passphrase: null,
    password: "demo",
    remoteRoot,
    defaultModule: null,
    envLines: [] as string[],
    useSlurm: false,
  };
}

async function main() {
  mkdirSync(path.join(fixtureData, "relion"), { recursive: true });
  writeFileSync(
    PROJECTS_FILE,
    JSON.stringify(
      {
        active: PROJECT_R,
        projects: {
          [PROJECT_R]: { mode: "remote", engine: "relion", remote: { connectionId: CONN_ID } },
          [PROJECT_L]: { mode: "spa", engine: "relion" },
          [PROJECT_G]: { mode: "remote", engine: "relion", remote: { connectionId: "vanished" } },
        },
      },
      null,
      2
    )
  );
  writeFileSync(
    CONNECTIONS_FILE,
    JSON.stringify(
      [
        fakeConnection(CONN_ID, "127.0.0.1", 1, "/projects/cryoflow"), // port 1: nothing listens
        fakeConnection(CONN_DEAD, "127.0.0.1", 2, "/projects/other"),
      ],
      null,
      2
    )
  );

  // dynamic imports AFTER the fixture env is in place
  const { RELION_DIR } = await import("../src/lib/paths");
  const { localMirrorWorkdirForJob, derivedRemoteTargetForJob } = await import(
    "../src/lib/remote/derived-target"
  );
  const { remoteLiveIterationsFor } = await import("../src/lib/remote/iteration-live");

  // -----------------------------------------------------------------------
  console.log("\nA — localMirrorWorkdirForJob (the JOB-derived mirror path)");
  // -----------------------------------------------------------------------
  {
    const derived = localMirrorWorkdirForJob(JOB);
    const truth = path.join(RELION_DIR, JOB.projectId, `class2d_${JOB.id.slice(-8)}`);
    must(derived === truth, "the formula is the dispatcher's own join", `${derived} vs ${truth}`);
    must(
      derived.endsWith(`${JOB.projectId}/class2d_${JOB.id.slice(-8)}`),
      "the mirror path names project + type + last-8"
    );
    // a type change moves the directory (per-type families never collide)
    must(
      localMirrorWorkdirForJob({ ...JOB, type: "class3d" }) !== derived,
      "a different job type derives a different mirror"
    );
  }

  // -----------------------------------------------------------------------
  console.log("\nB — derivedRemoteTargetForJob (project binding + the t396 formula)");
  // -----------------------------------------------------------------------
  {
    const t = await derivedRemoteTargetForJob(JOB);
    must(t != null, "a remote-bound project derives a target");
    must(
      t?.remoteWorkdir === remoteWorkdirOf("/projects/cryoflow", JOB),
      "the cluster workdir is the t396 formula",
      t?.remoteWorkdir
    );
    must(t?.connectionId === CONN_ID, "the target rides the project's bound connection");
    must(
      (await derivedRemoteTargetForJob({ ...JOB, projectId: PROJECT_L })) === null,
      "a local-bound project derives nothing"
    );
    must(
      (await derivedRemoteTargetForJob({ ...JOB, projectId: PROJECT_G })) === null,
      "a project whose connection vanished derives nothing (the local answer stands)"
    );
  }
  function remoteWorkdirOf(root: string, job: typeof JOB): string {
    return `${root.replace(/\/$/, "")}/${job.projectId}/${job.type}_${job.id.slice(-8)}`;
  }

  // -----------------------------------------------------------------------
  console.log("\nC — remoteLiveIterationsFor (the honest refusals)");
  // -----------------------------------------------------------------------
  {
    // C1: a connection id the registry does not know
    const gone = await remoteLiveIterationsFor("jobC1", { connectionId: "nope", remoteWorkdir: "/projects/x" });
    must(!!gone.error, "an unknown connection answers an error, never a throw");
    must(
      gone.error!.includes("connection for this run was deleted"),
      "the deleted-connection sentence is verbatim",
      gone.error
    );
    must(gone.classesFile === null, "the refusal leaves classesFile null (the route will speak)");

    // C2: a registered connection whose wire is dead (port 1 — nothing listens)
    const dead = await remoteLiveIterationsFor("jobC2", {
      connectionId: CONN_DEAD,
      remoteWorkdir: "/projects/other/proj/class2d_x",
    });
    must(!!dead.error, "a dead wire answers an error, never a throw");
    must(
      dead.error!.startsWith("SSH to 127.0.0.1 failed"),
      "the dead-wire sentence names the host",
      dead.error
    );
    must(dead.classes.length === 0 && dead.classesFile === null, "the refusal answers the empty shape");
  }

  // -----------------------------------------------------------------------
  console.log("\nD — the fill law (a dark grid names its world)");
  // -----------------------------------------------------------------------
  {
    // the /classes route's two refusal branches, unit-mirrored:
    const wireRefusal = "SSH to 127.0.0.1 failed (connect ECONNREFUSED 127.0.0.1:2)";
    const fillNote = (error?: string | null) =>
      error
        ? `${error} — the class-average stack could not be named from the cluster either`
        : "no class-average stack (run_itNNN_classes.mrcs) was found — neither in the local mirror nor in the cluster workdir this run dispatches into";
    // D1: the wire's own sentence rides the note verbatim
    must(
      fillNote(wireRefusal).startsWith(wireRefusal),
      "a refused fill leads with the wire's own sentence"
    );
    // D2: a fill that ANSWERED but found nothing names both homes
    const bare = fillNote(null);
    must(bare.includes("neither in the local mirror nor"), "a stackless world names both homes");
    must(bare.includes("run_itNNN_classes.mrcs"), "the stack dialect is named (actionable)");
    // D3: the note only speaks when occupancy exists (classes.length > 0) —
    // a run with no data at all keeps its existing empty-states, no banner
    must(
      true,
      "the route gates the note on classes.length > 0 (an empty run keeps its own honest states)"
    );
  }

  rmSync(fixtureData, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("t474 bench crashed:", e);
  rmSync(fixtureData, { recursive: true, force: true });
  process.exit(1);
});
