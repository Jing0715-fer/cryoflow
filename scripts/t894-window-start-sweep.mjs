#!/usr/bin/env node
/**
 * t894-window-start-sweep.mjs — the WINDOW-START DOCTOR.
 *
 * Born from Task 894's opening hour, which watched a fresh Prisma script
 * read a DEAD database while the dev server lived in another file (the
 * pin rides the process env, start.sh keeps rewriting .env — the
 * reboot-recover.sh ENV PIN section). The dead world LIED — a sweep
 * instinct built on it nearly deleted the LIVE demo (the last-project
 * guard refused, the demo survived, and the lesson became this tool).
 * The same hour captured the phantom-switch door live: `POST
 * /api/projects/switch` answered `ok:true` for a registry ghost (meta in
 * projects.json, no Prisma row) and wrote the active pointer to it — the
 * canvas-0-jobs FATAL signature, one door away (fixed this window in
 * the route; this tool probes the fix on every ride).
 *
 * Re-born after the window's mid-hour SECOND ANNIHILATE (the snapshot
 * restore that killed the t867-t893 line) — the tool itself died
 * uncommitted and was re-written from the window's own record.
 *
 * Three probes, one receipt, exit code verdicts:
 *   1. DB IDENTITY — the server's DATABASE_URL (from /proc/<pid>/environ,
 *      the honest source) vs `.env`'s URL. Divergence = SPLIT BRAIN: every
 *      fresh node script that omits DATABASE_URL reads a foreign world.
 *      Default fix: align .env to the server (with receipt; --no-align to
 *      report only).
 *   2. REGISTRY AUDIT — every id in data/projects.json must have a live
 *      Prisma row (GHOST META otherwise: sweep it), and every DB row
 *      should have meta (missing meta heals on read; note only). The
 *      active pointer must target a live row.
 *   3. PHANTOM-SWITCH PROBE — POST /api/projects/switch with (a) a
 *      synthetic never-known id and (b) each ghost id found in probe 2.
 *      The t894 door answers 404 for both and the pointer must not move.
 *      A 200 here is the door still lying → exit 2.
 *
 * Usage:
 *   node scripts/t894-window-start-sweep.mjs            # full doctor (aligns + sweeps)
 *   node scripts/t894-window-start-sweep.mjs --report   # report only (exit 1 on findings)
 *   node scripts/t894-window-start-sweep.mjs --no-align # sweep ghosts, keep .env as is
 *
 * Exit codes: 0 clean (or findings fixed with receipts) · 1 findings left
 * (--report / --no-align) · 2 the door lies or the server is unreachable.
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from "fs";
import { execSync } from "child_process";

const ROOT = "/home/z/my-project";
const REGISTRY = `${ROOT}/data/projects.json`;
const ENV_FILE = `${ROOT}/.env`;
const ORIGIN = "http://localhost:3000";

const argv = new Set(process.argv.slice(2));
const REPORT_ONLY = argv.has("--report");
const NO_ALIGN = argv.has("--no-align");

let exitCode = 0;
const findings = [];

function receipt(line) {
  console.log(line);
}
function finding(line) {
  findings.push(line);
  console.log(`FINDING: ${line}`);
  if (REPORT_ONLY || NO_ALIGN) exitCode = Math.max(exitCode, 1);
}

/* ---------------------------------------------------------------------- */
/* Probe 1 — DB identity                                                    */
/* ---------------------------------------------------------------------- */

function serverDatabaseUrl() {
  try {
    const out = execSync("pgrep -f 'next-server' | head -1", { encoding: "utf8" }).trim();
    if (!out) return null;
    const pid = Number(out);
    const env = readFileSync(`/proc/${pid}/environ`, "utf8");
    const hit = env.split("\0").find((kv) => kv.startsWith("DATABASE_URL="));
    if (hit) return { pid, url: hit.slice("DATABASE_URL=".length), source: "process env (the pin)" };
    // t894 recovery addendum — the pin does NOT always ride the env: the
    // harness's own boot chain spawns next-server with a bare env, and the
    // Prisma client falls back to .env. The GROUND TRUTH then is what the
    // server actually OPENED: the .db file among its fds. An env-vs-.env
    // match can still be a lie if the file was replaced under a live fd —
    // the fd scan cuts through every layer of that.
    try {
      const fds = execSync(`ls -l /proc/${pid}/fd 2>/dev/null`, { encoding: "utf8" });
      const dbLinks = [...fds.matchAll(/-> (\/\S+\/(?:[^/\s]+)\.db)\s*$/gm)].map((m) => m[1]);
      const dbFile = dbLinks.find((p) => !p.endsWith("-journal") && !p.endsWith("-wal") && !p.endsWith("-shm"));
      if (dbFile) return { pid, url: `file:${dbFile}`, source: "open fd (the server's actual world)" };
    } catch {
      /* fd scan unavailable — fall through to null */
    }
    return null;
  } catch {
    return null;
  }
}

function envFileUrl() {
  if (!existsSync(ENV_FILE)) return null;
  const hit = readFileSync(ENV_FILE, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("DATABASE_URL="));
  return hit ? hit.split("=", 2)[1].trim() : null;
}

receipt("=== t894 window-start sweep ===");
const server = serverDatabaseUrl();
if (!server) {
  receipt("VERDICT: no next-server process found — the identity probe needs the dev lane up. Aborting before any write.");
  process.exit(2);
}
receipt(`server pid ${server.pid} DATABASE_URL = ${server.url}  [source: ${server.source}]`);

const envUrl = envFileUrl();
receipt(`.env           DATABASE_URL = ${envUrl ?? "(none)"}`);

if (envUrl !== server.url) {
  finding(
    `SPLIT BRAIN: .env (${envUrl ?? "none"}) != server pin (${server.url}) — fresh scripts without an explicit DATABASE_URL read a foreign world`
  );
  if (!REPORT_ONLY && !NO_ALIGN) {
    // Align .env to the server's pin. start.sh may rewrite it on the next
    // sandbox boot (reboot-recover.sh's ENV PIN documents the fight); the
    // pin itself rides the process env and this probe re-verifies it
    // every window.
    const body = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
    const had = body.split("\n").some((l) => l.trim().startsWith("DATABASE_URL="));
    const next = had
      ? body
          .split("\n")
          .map((l) => (l.trim().startsWith("DATABASE_URL=") ? `DATABASE_URL=${server.url}` : l))
          .join("\n")
      : `DATABASE_URL=${server.url}\n${body}`;
    writeFileSync(ENV_FILE, next);
    receipt(`ALIGNED: .env DATABASE_URL -> ${server.url} (re-read to verify: ${envFileUrl()})`);
  }
} else {
  receipt("IDENTITY: .env matches the server pin — one world");
}

/* ---------------------------------------------------------------------- */
/* Shared DB access — two clients, two worlds (construction-time env)      */
/* ---------------------------------------------------------------------- */

async function openClient(url) {
  process.env.DATABASE_URL = url;
  const mod = await import("@prisma/client");
  return new mod.PrismaClient();
}

const live = await openClient(server.url);

/* ---------------------------------------------------------------------- */
/* Probe 2 — registry audit                                                */
/* ---------------------------------------------------------------------- */

const regRaw = readFileSync(REGISTRY, "utf8");
const registry = JSON.parse(regRaw);
const regIds = Object.keys(registry.projects ?? {});
const dbRows = await live.project.findMany({ select: { id: true, name: true } });
const dbIds = new Set(dbRows.map((r) => r.id));

receipt(`registry: ${regIds.length} meta entr${regIds.length === 1 ? "y" : "ies"} · live DB: ${dbIds.size} project row${dbIds.size === 1 ? "" : "s"}`);

const ghosts = [];
for (const id of regIds) {
  if (!dbIds.has(id)) {
    ghosts.push(id);
    finding(`GHOST META: registry holds "${id}" but the live DB (${server.url.replace(/^file:/, "")}) has no such row`);
  }
}
const metaMissing = dbRows.filter((r) => !regIds.includes(r.id));
for (const row of metaMissing) {
  receipt(`NOTE: DB row "${row.id}" (${row.name}) has no registry meta — getActiveProject heals meta on read; not swept`);
}

const active = registry.active;
if (active && !dbIds.has(active) && ghosts.includes(active)) {
  finding(`ACTIVE POINTER TARGETS A GHOST: active="${active}" — the canvas boots 0 jobs (the FATAL signature) until the read-path heal fires`);
} else if (active && dbIds.has(active)) {
  receipt(`ACTIVE: "${active}" is a live DB row — pointer sound`);
}

/* ---------------------------------------------------------------------- */
/* Ghost sweep (default)                                                   */
/* ---------------------------------------------------------------------- */

if (ghosts.length > 0) {
  if (!REPORT_ONLY) {
    const next = {
      active: dbIds.has(active) ? active : (dbRows[0]?.id ?? null),
      projects: Object.fromEntries(Object.entries(registry.projects).filter(([id]) => dbIds.has(id))),
    };
    const tmp = `${REGISTRY}.sweep-tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n");
    renameSync(tmp, REGISTRY);
    const verify = JSON.parse(readFileSync(REGISTRY, "utf8"));
    const survived = Object.keys(verify.projects ?? {});
    const gone = ghosts.every((g) => !survived.includes(g));
    if (gone) {
      receipt(`SWEPT: ${ghosts.length} ghost meta entr${ghosts.length === 1 ? "y" : "ies"} gone — registry now holds ${survived.length}, active="${verify.active}" — VERIFIED by re-read`);
    } else {
      finding(`RESIDUE LEFT: ${ghosts.filter((g) => survived.includes(g)).join(", ")} — sweep again before the next ride`);
    }
  }
} else {
  receipt("SWEEP: registry is ghost-free — nothing to do");
}

/* ---------------------------------------------------------------------- */
/* Probe 3 — the phantom-switch door                                       */
/* ---------------------------------------------------------------------- */

async function switchProbe(id) {
  const res = await fetch(`${ORIGIN}/api/projects/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ id }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty body is a valid answer for the probe */
  }
  return { status: res.status, body };
}

const beforeActive = JSON.parse(readFileSync(REGISTRY, "utf8")).active;
const probes = [`t894-phantom-${Date.now()}`, ...ghosts];
let doorLies = false;
for (const id of probes) {
  const { status, body } = await switchProbe(id);
  if (status === 404) {
    receipt(`DOOR: switch("${id.slice(0, 24)}…") -> 404 (refused) — phantom gate holds`);
  } else {
    doorLies = true;
    receipt(`DOOR LIES: switch("${id.slice(0, 24)}…") -> ${status} ${JSON.stringify(body)} — the phantom gate is NOT holding`);
  }
}
const afterActive = JSON.parse(readFileSync(REGISTRY, "utf8")).active;
if (afterActive !== beforeActive) {
  doorLies = true;
  receipt(`POINTER MOVED DURING PROBE: "${beforeActive}" -> "${afterActive}" — a refused switch must never touch the pointer`);
} else {
  receipt(`POINTER: unmoved through ${probes.length} probe${probes.length === 1 ? "" : "s"} ("${beforeActive ?? "null"}")`);
}
if (doorLies) {
  finding("the switch door failed the phantom probe — fix the route before any ride that activates projects");
  exitCode = 2;
}

await live.$disconnect();

/* ---------------------------------------------------------------------- */
/* Verdict                                                                 */
/* ---------------------------------------------------------------------- */

if (findings.length === 0) {
  receipt("VERDICT: CLEAN — one world, ghost-free registry, an honest door");
} else if (exitCode === 0) {
  receipt(`VERDICT: ${findings.length} finding${findings.length === 1 ? "" : "s"} found and FIXED with receipts — re-run to see the CLEAN line`);
} else {
  receipt(`VERDICT: ${findings.length} finding${findings.length === 1 ? "" : "s"} REMAIN (report-only or unfixed) — resolve before riding`);
}
process.exit(exitCode);
