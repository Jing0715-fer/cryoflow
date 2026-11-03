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
 *   doctor   is the tracked snapshot still FRESH — does it still tell
 *            the truth about the live world? READ-ONLY (no file
 *            writes, no DB writes): the doctor names the drift before
 *            a restore lies with it (t1161). Verdicts, loudest first:
 *              LIED     meta.counts disagree with the snapshot's own
 *                       data rows — a snapshot that lies about itself
 *                       is worse than no snapshot.
 *              DRIFTED  the live world has moved since the snapshot
 *                       (count or job-ID differences, or rows updated
 *                       after exportedAt) — a restore now would
 *                       resurrect an OLD world; re-export first.
 *              STALE    data faithful, but the snapshot rides an older
 *                       commit (the docs/qa cars' usual footprint) —
 *                       re-export when convenient.
 *              FRESH    counts faithful, job IDs equal, engine-state
 *                       aligned.
 *            Exit codes: 0 FRESH/STALE (restore may proceed) ·
 *            1 LIED/DRIFTED (the drift is named, not guessed).
 *   probe    the doctor's THIRD face (t1162): the CHEAP reading for the
 *            family batch runner — count+head only, ONE live query
 *            (job count + newest updatedAt, one aggregate; no nine-model
 *            dump, no job-ID ledger). Machine face: ONE JSON line on
 *            stdout, {verdict, red, ...} — the freshness verdict rides
 *            the batch report the cron family already reads. Verdicts,
 *            loudest first:
 *              NO-SNAPSHOT  the snapshot file is gone or unparseable —
 *                           the family is riding a world whose only
 *                           tracked home vanished.
 *              LIED         meta.counts.job disagrees with the
 *                           snapshot's own job rows (the self-truth —
 *                           the one tooth the probe keeps, free once
 *                           the JSON is in hand).
 *              EMPTY-LIVE   the live lane has ZERO jobs while the
 *                           snapshot carries its spine — the recycle's
 *                           signature, recovery step 3.5 is about to
 *                           speak; NOT a disease (the snapshot is the
 *                           cure here), exit 0.
 *              DRIFTED      the live job count moved off the snapshot's,
 *                           or a live job was updated after exportedAt
 *                           (+1s slack) — the world moved on without
 *                           the snapshot.
 *              STALE        counts faithful, the snapshot rides an
 *                           older commit (the docs/qa cars' footprint).
 *              FRESH        counts faithful, same head.
 *            Exit codes: 0 EMPTY-LIVE/STALE/FRESH · 1 NO-SNAPSHOT/
 *            LIED/DRIFTED (doctor-RED). A RED probe is a DOORBELL, not
 *            a diagnosis — the full doctor holds the hearing.
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

/**
 * Doctor (t1161): the snapshot's second face — the freshness gate.
 * A stale snapshot restored after a recycle would resurrect an OLD
 * world and PRESENT it as the truth; the doctor names the drift before
 * it lies. Four checks, loudest first: (1) the self-truth — meta.counts
 * against the data rows it describes (the t1160 tooth); (2) the live
 * truth — every model counted in the lane the URL names; (3) the
 * freshness — any live job updated after exportedAt means the world
 * moved on without the snapshot; (4) the job-ID ledger — BOTH loss
 * directions named: live-only IDs a restore would not bring back,
 * snapshot-only IDs it would resurrect from a dead world. READ-ONLY:
 * the doctor writes nothing, deletes nothing, decides nothing — it
 * speaks, and the operator (or reboot-recover's step 3.5) decides.
 */
async function cmdDoctor(snapPath) {
  const snap = JSON.parse(readFileSync(snapPath, "utf8"));
  if (!snap.data || !snap.meta) {
    console.error("world-snapshot doctor: not a snapshot file — no meta/data");
    process.exit(1);
  }
  const dataCounts = Object.fromEntries(
    MODELS.map((m) => [m, (snap.data[m] || []).length]),
  );
  const engineKeys = snap.engineState
    ? Object.keys(snap.engineState).length
    : 0;

  // 1. the self-truth: meta.counts must match the rows it describes.
  const lied = MODELS.filter(
    (m) => (snap.meta.counts?.[m] ?? -1) !== dataCounts[m],
  );
  const engineLie = (snap.meta.engineStateJobs ?? -1) !== engineKeys;

  // 2-4. the live truth: count every model in the lane the URL names.
  const prisma = openClient(DB_URL);
  let liveCounts, liveJobs, liveEngineKeys;
  try {
    const live = await dumpModels(prisma);
    liveCounts = Object.fromEntries(
      MODELS.map((m) => [m, (live[m] || []).length]),
    );
    liveJobs = live.job || [];
  } finally {
    await prisma.$disconnect();
  }
  liveEngineKeys = existsSync(ENGINE_STATE)
    ? Object.keys(JSON.parse(readFileSync(ENGINE_STATE, "utf8"))).length
    : 0;

  // 3. the freshness: live rows updated after the snapshot = the world
  //    moved on (1s slack — the dump and the timestamp share an instant).
  const exportedAt = new Date(snap.meta.exportedAt).getTime();
  const moved = liveJobs.filter(
    (j) =>
      j.updatedAt && new Date(j.updatedAt).getTime() > exportedAt + 1000,
  );
  // 4. the job-ID ledger — both loss directions, named.
  const snapIds = new Set((snap.data.job || []).map((j) => j.id));
  const liveIds = new Set(liveJobs.map((j) => j.id));
  const liveOnly = [...liveIds].filter((id) => !snapIds.has(id));
  const snapOnly = [...snapIds].filter((id) => !liveIds.has(id));
  const countDrift = MODELS.filter((m) => liveCounts[m] !== dataCounts[m]);

  let headNow = "unknown";
  try {
    headNow = execSync("git rev-parse --short HEAD", { cwd: REPO })
      .toString()
      .trim();
  } catch {}

  const rows = MODELS.filter((m) => dataCounts[m] > 0)
    .map((m) => `${m}:${dataCounts[m]}`)
    .join(" · ");

  if (lied.length || engineLie) {
    const bits = [
      ...lied.map(
        (m) =>
          `meta says ${m}:${snap.meta.counts?.[m] ?? "∅"} but data carries ${dataCounts[m]}`,
      ),
      engineLie
        ? `meta says engine-state:${snap.meta.engineStateJobs ?? "∅"} but carries ${engineKeys}`
        : null,
    ].filter(Boolean);
    console.error(
      `world-snapshot doctor: LIED — ${bits.join("; ")} — a snapshot that lies about itself is worse than no snapshot; re-export (node scripts/world-snapshot.mjs export)`,
    );
    process.exit(1);
  }
  if (countDrift.length || liveOnly.length || snapOnly.length || moved.length) {
    const bits = [
      ...countDrift.map(
        (m) => `${m}: live ${liveCounts[m]} vs snapshot ${dataCounts[m]}`,
      ),
      liveOnly.length
        ? `restore would NOT bring back ${liveOnly.length} live-only job(s) (${liveOnly.slice(0, 3).join(", ")}${liveOnly.length > 3 ? "…" : ""})`
        : null,
      snapOnly.length
        ? `restore would resurrect ${snapOnly.length} job(s) the live world no longer has (${snapOnly.slice(0, 3).join(", ")}${snapOnly.length > 3 ? "…" : ""})`
        : null,
      moved.length
        ? `${moved.length} job(s) updated after the snapshot (${moved
            .slice(0, 2)
            .map(
              (j) =>
                `${j.id} @ ${new Date(j.updatedAt).toISOString().slice(0, 16)}Z`,
            )
            .join(", ")})`
        : null,
    ].filter(Boolean);
    console.error(
      `world-snapshot doctor: DRIFTED — ${bits.join("; ")} — a restore now would resurrect an OLD world; re-export first (node scripts/world-snapshot.mjs export)`,
    );
    process.exit(1);
  }
  const engineNote =
    liveEngineKeys === engineKeys
      ? `engine-state:${engineKeys}`
      : `engine-state snapshot:${engineKeys} vs live:${liveEngineKeys}`;
  if (snap.meta.head !== headNow) {
    console.log(
      `world-snapshot doctor: STALE — data faithful (${rows}, ${engineNote}) but the snapshot rides ${snap.meta.head} while the tree is at ${headNow} — re-export when convenient`,
    );
    process.exit(0);
  }
  console.log(
    `world-snapshot doctor: FRESH — ${dataCounts.job}/${liveCounts.job} job IDs equal, counts faithful (${rows}), ${engineNote}, exported ${String(snap.meta.exportedAt).slice(0, 16)}Z`,
  );
  process.exit(0);
}

/**
 * Probe (t1162): the doctor's third face — the CHEAP reading for the
 * family batch runner (see the header). The self-truth is free (the
 * JSON is already read); the live truth costs ONE aggregate. READ-ONLY
 * like the doctor: the probe speaks, it never touches.
 */
async function cmdProbe(snapPath) {
  const emit = (obj, code) => {
    console.log(JSON.stringify(obj));
    process.exit(code);
  };
  const gone = () =>
    emit(
      {
        verdict: "NO-SNAPSHOT",
        red: true,
        snapshotJobs: null,
        liveJobs: null,
        snapshotHead: null,
        treeHead: null,
        exportedAt: null,
        liveMaxUpdatedAt: null,
        probedAt: new Date().toISOString(),
      },
      1,
    );
  if (!existsSync(snapPath)) gone();
  let snap;
  try {
    snap = JSON.parse(readFileSync(snapPath, "utf8"));
  } catch {
    gone(); // an unparseable home is no home — same verdict, honestly
  }
  if (!snap.data || !snap.meta) gone();
  const snapJobs = (snap.data.job || []).length;
  const exportedAt = new Date(snap.meta.exportedAt).getTime();

  // The self-truth, kept: the one tooth that is FREE once the JSON is
  // in hand (the full doctor keeps all nine; the probe keeps job only).
  const selfLie =
    (snap.meta.counts?.job ?? -1) !== snapJobs ||
    (snap.meta.engineStateJobs ?? -1) !==
      (snap.engineState ? Object.keys(snap.engineState).length : 0);

  // The live truth, ONE aggregate: count + newest updatedAt.
  const prisma = openClient(DB_URL);
  let liveJobs, liveMax;
  try {
    const agg = await prisma.job.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
    });
    liveJobs = agg._count._all;
    liveMax = agg._max.updatedAt;
  } finally {
    await prisma.$disconnect();
  }

  let treeHead = null;
  try {
    treeHead = execSync("git rev-parse --short HEAD", { cwd: REPO })
      .toString()
      .trim();
  } catch {}
  const base = {
    snapshotJobs: snapJobs,
    liveJobs,
    snapshotHead: snap.meta.head ?? null,
    treeHead,
    exportedAt: snap.meta.exportedAt ?? null,
    liveMaxUpdatedAt: liveMax ? new Date(liveMax).toISOString() : null,
    probedAt: new Date().toISOString(),
  };

  if (selfLie) {
    emit({ verdict: "LIED", red: true, ...base }, 1);
  }
  if (liveJobs === 0 && snapJobs > 0) {
    // The recycle's signature: the recovery's step 3.5 is about to
    // rebuild from this very snapshot — the snapshot is the CURE here,
    // not a disease. Exit 0.
    emit({ verdict: "EMPTY-LIVE", red: false, ...base }, 0);
  }
  const moved =
    liveMax && new Date(liveMax).getTime() > exportedAt + 1000;
  if (liveJobs !== snapJobs || moved) {
    emit({ verdict: "DRIFTED", red: true, ...base }, 1);
  }
  if (snap.meta.head !== treeHead) {
    emit({ verdict: "STALE", red: false, ...base }, 0);
  }
  emit({ verdict: "FRESH", red: false, ...base }, 0);
}

const cmd = process.argv[2] || "export";
const arg = process.argv[3];
if (cmd === "export") await cmdExport(arg || DEFAULT_OUT);
else if (cmd === "restore") await cmdRestore(arg || DEFAULT_OUT);
else if (cmd === "selftest") await cmdSelftest();
else if (cmd === "doctor") await cmdDoctor(arg || DEFAULT_OUT);
else if (cmd === "probe") await cmdProbe(arg || DEFAULT_OUT);
else {
  console.error(
    "usage: world-snapshot.mjs export|restore|selftest|doctor|probe [path]",
  );
  process.exit(1);
}
