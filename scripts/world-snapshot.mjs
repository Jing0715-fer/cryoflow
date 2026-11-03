#!/usr/bin/env node
/**
 * world-snapshot.mjs — the world snapshot lane (t1160): the DB truth +
 * the engine-state file, frozen into ONE tracked JSON, restorable in one
 * command. The world died twice in one week (the t418 disaster's echo,
 * then t1159's recycle that zeroed db/cryoflow.db and emptied the mock
 * fs); each rebirth cost an afternoon of chain rounds and OOM rides.
 * THIS script is that afternoon, written down:
 *
 *   export   dump the 9 Prisma models (FK-safe order, IDs preserved)
 *            + data/engine-state.json into fixtures/world-snapshot.json
 *            (tracked — the only world home the recycle cannot eat).
 *   restore  wipe the target DB and rebuild it from the snapshot, in FK
 *            order (jobs two-pass: linkedJobId is a self-FK). Writes the
 *            engine-state file back. The FILE half of the world (the
 *            workdirs under data/relion/) is NOT in the snapshot — a
 *            restored job is DB-complete but file-hollow; the chain
 *            (scripts/demo-chain-resurrect.mjs) re-runs what needs
 *            files. Restore NEVER touches the live dev lane unless the
 *            target URL says so — the URL is the jurisdiction.
 *   selftest export live → restore into a TEMP sqlite → re-export →
 *            deep-compare (data payloads byte-equal, meta ignored).
 *
 * The URL: CRYOFLOW_DB_URL overrides; default is the dev lane
 * (file:<repo>/db/cryoflow.db) — the t921 split-brain cure's own
 * default, never the sandbox's template leak.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const REPO = "/home/z/my-project";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const DB_URL =
  process.env.CRYOFLOW_DB_URL || `file:${REPO}/db/cryoflow.db`;
const DEFAULT_OUT = `${REPO}/fixtures/world-snapshot.json`;
const ENGINE_STATE = `${REPO}/data/engine-state.json`;

/** FK-safe order: parents before children; wipe walks it backwards. */
const MODELS = [
  "project",
  "workspace",
  "customTemplate",
  "job",
  "edge",
  "overlaySession",
  "bookmarkSession",
  "presetShelf",
  "worldLedger",
];

function openClient(url) {
  return new PrismaClient({
    datasources: { db: { url } },
  });
}

async function dumpModels(prisma) {
  const data = {};
  for (const m of MODELS) {
    const rows = await prisma[m].findMany();
    rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    data[m] = rows;
  }
  return data;
}

async function wipeModels(prisma) {
  for (const m of [...MODELS].reverse()) {
    await prisma[m].deleteMany();
  }
}

async function seedModels(prisma, data) {
  for (const m of MODELS) {
    const rows = data[m] || [];
    // Job.linkedJobId is a self-FK: create detached, then wire the links.
    if (m === "job") {
      const detached = rows.map(({ linkedJobId, ...rest }) => rest);
      if (detached.length)
        await prisma.job.createMany({ data: detached });
      const linked = rows.filter((r) => r.linkedJobId);
      for (const r of linked) {
        await prisma.job.update({
          where: { id: r.id },
          data: { linkedJobId: r.linkedJobId },
        });
      }
      continue;
    }
    if (rows.length) await prisma[m].createMany({ data: rows });
  }
}

async function cmdExport(outPath) {
  const prisma = openClient(DB_URL);
  try {
    const data = await dumpModels(prisma);
    const engineState = existsSync(ENGINE_STATE)
      ? JSON.parse(readFileSync(ENGINE_STATE, "utf8"))
      : null;
    let head = "unknown";
    try {
      head = execSync("git rev-parse --short HEAD", { cwd: REPO })
        .toString()
        .trim();
    } catch {}
    const counts = Object.fromEntries(
      MODELS.map((m) => [m, (data[m] || []).length]),
    );
    const snap = {
      meta: {
        exportedAt: new Date().toISOString(),
        head,
        db: DB_URL.replace(/file:.*\//, "file:…/"),
        counts,
        engineStateJobs: engineState ? Object.keys(engineState).length : 0,
      },
      data,
      engineState,
    };
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(snap, null, 1) + "\n");
    console.log(
      `world-snapshot: exported ${Object.values(counts).reduce((a, b) => a + b, 0)} rows (${Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(" · ")}) engine-state:${counts.engineStateJobs || snap.meta.engineStateJobs} → ${outPath}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function cmdRestore(snapPath) {
  const snap = JSON.parse(readFileSync(snapPath, "utf8"));
  if (!snap.data || !snap.meta) {
    console.error("world-snapshot: not a snapshot file — no meta/data");
    process.exit(1);
  }
  const prisma = openClient(DB_URL);
  try {
    await wipeModels(prisma);
    await seedModels(prisma, snap.data);
    if (snap.engineState) {
      writeFileSync(ENGINE_STATE, JSON.stringify(snap.engineState, null, 2));
    }
    const counts = Object.fromEntries(
      MODELS.map((m) => {
        const rows = snap.data[m] || [];
        return [m, rows.length];
      }),
    );
    console.log(
      `world-snapshot: restored ${Object.values(counts).reduce((a, b) => a + b, 0)} rows into ${DB_URL.replace(/file:.*\//, "file:…/")} — the file half rides the chain (scripts/demo-chain-resurrect.mjs)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

/** Selftest: live export → temp restore → temp re-export → deep compare. */
async function cmdSelftest() {
  const live = openClient(DB_URL);
  let liveData, engineState;
  try {
    liveData = await dumpModels(live);
    engineState = existsSync(ENGINE_STATE)
      ? JSON.parse(readFileSync(ENGINE_STATE, "utf8"))
      : null;
  } finally {
    await live.$disconnect();
  }
  const total = MODELS.reduce((a, m) => a + (liveData[m] || []).length, 0);
  let pass = 0;
  const ok = (cond) => {
    if (cond) pass += 1;
    return cond;
  };

  // A — the live world exports FOR REAL: every model present, rows sane.
  ok(MODELS.every((m) => Array.isArray(liveData[m])));
  ok(total > 0);
  ok(
    (liveData.project || []).length >= 1 &&
      (liveData.job || []).length >= 1,
  );
  // A2 — the engine-state's shape: every record speaks its job (null is
  // an honest absence — a fresh world has no engine-state file).
  ok(
    engineState === null ||
      Object.values(engineState).every(
        (v) => v && typeof v === "object" && v.jobId,
      ),
  );
  // A3 — the determinism law: a second dump of the same instant is
  // byte-identical (the snapshot must diff clean across re-exports).
  const live2 = openClient(DB_URL);
  let liveData2;
  try {
    liveData2 = await dumpModels(live2);
  } finally {
    await live2.$disconnect();
  }
  ok(JSON.stringify(liveData2) === JSON.stringify(liveData));

  // B — the temp restore roundtrip: byte-equal data, IDs preserved.
  const tmpDb = `file:/tmp/world-snapshot-selftest-${Date.now()}.db`;
  execSync(
    `npx prisma db push --skip-generate --accept-data-loss`,
    {
      cwd: REPO,
      env: { ...process.env, DATABASE_URL: tmpDb },
      stdio: "ignore",
    },
  );
  const tmp = openClient(tmpDb);
  let tmpData;
  try {
    await seedModels(tmp, liveData);
    tmpData = await dumpModels(tmp);
  } finally {
    await tmp.$disconnect();
  }
  ok(JSON.stringify(tmpData) === JSON.stringify(liveData));
  const srcJobs = liveData.job || [];
  const restoredLinked = srcJobs.filter((j) => j.linkedJobId).length;
  ok(
    restoredLinked === 0 ||
      (tmpData.job || []).filter((j) => j.linkedJobId).length ===
        restoredLinked,
  );
  rmSync(tmpDb.replace("file:", ""), { force: true });

  console.log(`PASS ${pass}`);
  console.log(
    `world-snapshot selftest: ${pass}/7 pins — live ${total} rows, roundtrip ${restoredLinked ? `with ${restoredLinked} linked self-FK(s)` : "linkedJobId clean"}, temp DB deleted`,
  );
  process.exit(pass === 7 ? 0 : 1);
}

const cmd = process.argv[2] || "export";
const arg = process.argv[3];
if (cmd === "export") await cmdExport(arg || DEFAULT_OUT);
else if (cmd === "restore") await cmdRestore(arg || DEFAULT_OUT);
else if (cmd === "selftest") await cmdSelftest();
else {
  console.error("usage: world-snapshot.mjs export|restore|selftest [path]");
  process.exit(1);
}
