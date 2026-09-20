#!/usr/bin/env node
/**
 * t333 diag — the fresh-start wipe, verified twice.
 *
 * The user's ticket:
 *   「reset&，re-run或者delete任务时会先清除之前已生成的文件吗？」
 *   — arriving with a crash attached: a re-run of an extraction job
 *   (changed box size) died inside relion_preprocess at image.h:1534,
 *   "write: target and source objects have different size", because the
 *   previous run's .mrcs stacks still sat in the STABLE workdir; a NEW
 *   job (empty workdir) sailed.
 *
 * THE FEATURE: a fresh start is a fresh directory (RELION GUI's
 * "Overwrite", answered automatically). Every fresh dispatch wipes the
 * previous generation's RECOGNIZED products from the run directory on
 * BOTH sides — the local workdir (engine lane) / the local mirror of a
 * cluster run (remote lane, at dispatch time) and the cluster workdir
 * itself (pre-submit) — behind the t331 keep-set's fresh-run dialect:
 * input links, note.txt, the manifest ledger and anything UNRECOGNIZED
 * survive; products, ALL iterations, .cf-* scratch and the logs die. The
 * --continue resume path (interrupted refine-family + usable checkpoint)
 * never wipes — the checkpoints ARE the state.
 *
 * PHASES:
 *  A. UNIT — the pure classifier's truth table (bun, zero deps): the
 *     user's extraction dialect, the refine dialect, the keep-set
 *     (links/note/ledger/unknown), the extension grammar (case, .sav,
 *     .ctf, nested products, shard subtrees, .cf-* family), and the
 *     reset/delete semantics pins (state-only reset, files-kept delete).
 *  B. LIVE LOCAL — the engine's own wipe leg (bun imports
 *     run-wipe.ts): a fixture workdir's disk truth (products die,
 *     doors/notes/unknowns/ledger survive, empty dirs pruned, root
 *     kept), the idempotent second pass, and the SOURCE ORDER — the
 *     wipe sits BELOW the --continue resume branch and the engine-native
 *     dispatchers, so a resumed run never wipes.
 *  C. LIVE REMOTE — the REAL thing: a class2d dispatched @slurm onto
 *     the mock cluster, stale canaries injected on BOTH sides (a
 *     "future" iteration, a stale canonical product, diagnostics, an
 *     unknown file, a note, an input door), then the RE-DISPATCH of the
 *     same job: canary products gone on both sides, keeps alive on both
 *     sides, the new generation regenerated, the ledger honest, the
 *     re-run itself COMPLETES (the point of the fix).
 *  D. CONTRACTS — the source pins: the wipe blades' positions (local
 *     mirror before the record is built, cluster pre-submit before the
 *     t318 fence), the honest-refusal wording, the cache drop, the
 *     dialog/tooltip texts, and the reset/delete file contracts.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, readdirSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { tmpdir } from "node:os";

const ROOT = "/home/z/my-project";
const BASE = "http://localhost:3001";
const CONN = "qa-t333";
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  Host: "localhost:3001",
};
const SHJ = { ...SH, "Content-Type": "application/json" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, deadlineMs, intervalMs = 800) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

let fail = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

const client = (cmd) =>
  spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  }).stdout?.trim() ?? "";
const clientBoth = (cmd) => {
  const r = spawnSync("node", ["services/mock-cluster/test-client.mjs", cmd], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 60_000,
  });
  return `${r.stdout?.trim() ?? ""}${r.stderr?.trim() ? ` <<stderr>> ${r.stderr.trim()}` : ""}`.trim();
};

const mockListening = () =>
  new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(1200);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
    sock.connect(3022, "127.0.0.1");
  });

const api = async (url, init) => {
  const r = await fetch(`${BASE}${url}`, init);
  return { status: r.status, body: await r.json().catch(() => null) };
};

const jobById = async (id) => {
  const { body } = await api("/api/jobs", { headers: SH });
  return (body?.jobs ?? []).find((j) => j.id === id) ?? null;
};

const createdJobs = [];
const createdProjects = [];
const mkJob = async (body) => {
  const { body: b } = await api("/api/jobs", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify(body),
  });
  if (b?.job?.id) createdJobs.push(b.job.id);
  return b?.job;
};
const mkEdge = async (fromJobId, toJobId, fromPort, toPort) =>
  (
    await api("/api/edges", {
      method: "POST",
      headers: SHJ,
      body: JSON.stringify({ fromJobId, toJobId, fromPort, toPort }),
    })
  ).status;

const dispatch = (id, body) =>
  api(`/api/jobs/${id}/run`, { method: "POST", headers: SHJ, body: JSON.stringify(body) });

const awaitJobTerminal = async (id, deadlineMs) => {
  const done = await pollUntil(async () => {
    const j = await jobById(id);
    return j && (j.status === "completed" || j.status === "failed") ? j : null;
  }, deadlineMs);
  return done;
};

const STATE_FILE = `${ROOT}/data/engine-state.json`;
const readState = () => {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
};

try {
  console.log("== PHASE 0: the stage ==");
  must((await api("/")).status === 200, "the prod server answers on :3001");
  must(await mockListening(), "the mock cluster answers on :3022");

  const mk = await api("/api/remote/connections", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({
      id: CONN,
      name: "QA t333",
      host: "127.0.0.1",
      port: 3022,
      username: "cryo",
      password: "demo",
      authMethod: "password",
      remoteRoot: "/projects/cryoflow",
    }),
  });
  must(mk.status === 200 || mk.status === 201, `the connection upserts (${mk.status})`);

  // ======================================================================
  console.log("== PHASE A: UNIT — the fresh-run classifier's truth table (bun, zero deps) ==");

  const pureSrc = readFileSync(`${ROOT}/src/lib/hpc/cleanup.ts`, "utf8");
  must(
    !/^import\s/m.test(pureSrc) && !/^}\s*from\s/m.test(pureSrc),
    "hpc/cleanup.ts stays PURE (zero imports — the t326/t327 recipe)"
  );
  must(pureSrc.includes("export function classifyRerunWipe"), "the fresh-run classifier is exported");

  const unit = (expr) => {
    const prog = [
      `const m = await import(${JSON.stringify(path.join(ROOT, "src/lib/hpc/cleanup.ts"))});`,
      `const out = (${expr});`,
      `console.log("__UNIT__" + JSON.stringify(out));`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    if (r.status !== 0) return `UNIT-ERROR: ${(r.stderr ?? "").slice(0, 200)}`;
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("__UNIT__"));
    if (!line) return `UNIT-PARSE-ERROR: ${(r.stdout ?? "").slice(0, 120)}`;
    return JSON.parse(line.slice("__UNIT__".length));
  };

  // THE USER'S EXACT DIALECT — a re-run extraction workdir: the previous
  // generation's stacks (the collision that died at image.h:1534), the
  // canonical star, the witnesses, and the keep-set.
  {
    const listing = [
      { path: "particles.star", size: 2048 },
      { path: "particles/mic001_extract.star", size: 512 },
      { path: "particles/mic001_extract.mrcs", size: 10_000_000 }, // the crash's own file
      { path: "particles/mic002_extract.mrcs", size: 10_000_000 },
      { path: "run.out", size: 900 },
      { path: "run.err", size: 400 },
      { path: ".cf-exit", size: 1 },
      { path: ".cf-pid", size: 4 },
      { path: ".cf-run.sh", size: 700 },
      { path: ".cf-shard-3.star", size: 30 },
      { path: ".cf-array-rc-12", size: 1 },
      { path: "shard_7/micrographs_ctf.star", size: 60 },
      { path: "shard_7/anything.bin", size: 12 }, // the whole scratch subtree dies
      { path: ".cf-remote-manifest.json", size: 400 }, // the LEDGER stays
      { path: "note.txt", size: 20 }, // the user's margin note stays
      { path: "unknown_leftover.bin", size: 15 }, // unknown = keep
      { path: "micrographs", size: 0, link: true }, // the input door stays
    ];
    const verdict = unit(`(() => {
      const { wipe, kept } = m.classifyRerunWipe(${JSON.stringify(listing)});
      return { wipe: wipe.slice().sort(), keptCount: kept.count };
    })()`);
    const expectWipe = [
      ".cf-array-rc-12",
      ".cf-exit",
      ".cf-pid",
      ".cf-run.sh",
      ".cf-shard-3.star",
      "particles.star",
      "particles/mic001_extract.mrcs",
      "particles/mic001_extract.star",
      "particles/mic002_extract.mrcs",
      "run.err",
      "run.out",
      "shard_7/anything.bin",
      "shard_7/micrographs_ctf.star",
    ];
    must(
      JSON.stringify(verdict.wipe) === JSON.stringify(expectWipe),
      `the extraction dialect: every product + witness dies, the whole shard subtree included (${JSON.stringify(verdict).slice(0, 140)}…)`
    );
    must(verdict.keptCount === 4, `exactly the keep-set survives (ledger, note, unknown, door): ${verdict.keptCount}`);
  }

  // THE REFINE DIALECT — ALL iterations die (a fresh start has no resume
  // contract), the canonical finals die too (they are regenerated), the
  // diagnostics die (a fresh start keeps no plots).
  {
    const verdict = unit(`(() => {
      const listing = [
        { path: "run_data.star", size: 100 },
        { path: "run_classes.mrcs", size: 500 },
        { path: "run_it000_data.star", size: 90 },
        { path: "run_it000_optimiser.star", size: 80 },
        { path: "run_it001_data.star", size: 90 },
        { path: "run_it001_class001.mrc", size: 800 },
        { path: "run_it002_class002.mrc", size: 800 }, // family max — dies anyway
        { path: "mic1_power.eps", size: 40 },
        { path: "mic1.ctf", size: 30 },
        { path: "mic1_ctf.mrc", size: 2048 },
        { path: "topaz_model.sav", size: 120 },
        { path: "mask.mrc", size: 64 },
        { path: "postprocess.star", size: 90 },
        { path: "polish.tmp", size: 5 },
        { path: "STALE_UPPER.MRCS", size: 77 }, // case-insensitive grammar
      ];
      const { wipe, kept } = m.classifyRerunWipe(listing);
      return { n: wipe.length, keptCount: kept.count, missing: listing.filter(f => !wipe.includes(f.path)).map(f => f.path) };
    })()`);
    must(verdict.n === 15 && verdict.missing.length === 0,
      `the refine dialect: iterations INCLUDING family maxima, finals, plots, .sav, .tmp and UPPER-case stacks all die (${verdict.missing.join(", ") || "all"})`);
    must(verdict.keptCount === 0, "nothing unrecognized in the refine fixture — nothing kept");
  }

  // THE KEEP-SET GRAMMAR — names that never die.
  {
    const verdict = unit(`(() => {
      const listing = [
        { path: "micrographs", size: 0, link: true },
        { path: "deep/nested/door", size: 0, link: true },
        { path: "note.txt", size: 3 },
        { path: ".cf-remote-manifest.json", size: 9 },
        { path: "manual_notes.md", size: 11 },
        { path: "run.log", size: 13 }, // not run.out/run.err — unknown
        { path: "hidden.cfg", size: 7 }, // unknown dotfile
      ];
      const { wipe, kept } = m.classifyRerunWipe(listing);
      return { wipe, keptCount: kept.count };
    })()`);
    must(verdict.wipe.length === 0 && verdict.keptCount === 7,
      "doors (any depth), notes, the ledger and unknowns all survive — unknown still means keep");
  }

  // ======================================================================
  console.log("== PHASE B: LIVE LOCAL — the engine's own wipe leg (bun) ==");

  const unitFs = (program) => {
    const prog = [
      `const { wipeLocalRunProducts } = await import(${JSON.stringify(path.join(ROOT, "src/lib/relion/run-wipe.ts"))});`,
      `const fs = await import("node:fs");`,
      `const path = await import("node:path");`,
      `const os = await import("node:os");`,
      `const out = ${program};`,
      `console.log("__OUT__" + JSON.stringify(out));`,
    ].join("\n");
    const r = spawnSync("bun", ["-e", prog], { cwd: ROOT, encoding: "utf8", timeout: 60_000 });
    if (r.status !== 0) return { ERROR: (r.stderr ?? "").slice(0, 300) };
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("__OUT__"));
    if (!line) return { ERROR: (r.stdout ?? "").slice(0, 200) };
    return JSON.parse(line.slice("__OUT__".length));
  };

  // a fixture workdir in the extraction dialect; the door link points at
  // a REAL directory so a mistaken recursive delete would be observable
  // on the target side too.
  {
    const verdict = unitFs(`(() => {
      const doorTarget = fs.mkdtempSync(path.join(os.tmpdir(), "t333-door-"));
      fs.writeFileSync(path.join(doorTarget, "movie.mrcs"), "RAW MOVIE BYTES");
      const wd = fs.mkdtempSync(path.join(os.tmpdir(), "t333-wd-"));
      for (const rel of ["particles.star", "particles/mic001_extract.star", "particles/mic001_extract.mrcs", "run.out", "run.err", ".cf-exit", ".cf-remote-manifest.json", "note.txt", "unknown_leftover.bin"]) {
        const p = path.join(wd, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, "x".repeat(8));
      }
      fs.symlinkSync(doorTarget, path.join(wd, "micrographs"), "dir");
      const first = wipeLocalRunProducts(wd);
      const walk = (d, pre) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
        const rel = pre ? pre + "/" + e.name : e.name;
        return e.isDirectory() ? walk(path.join(d, e.name), rel) : [e.isSymbolicLink() ? rel + " ->link" : rel];
      }).sort();
      const tree1 = walk(wd, "");
      const doorAlive = fs.existsSync(path.join(doorTarget, "movie.mrcs"));
      const second = wipeLocalRunProducts(wd);
      const tree2 = walk(wd, "");
      return { first: { wiped: first.wiped.slice().sort(), keptCount: first.keptCount }, tree1, doorAlive, second: second.wiped.length, tree2 };
    })()`);
    must(!verdict.ERROR, `the fixture wipe runs clean (${verdict.ERROR ?? "ok"})`);
    must(
      JSON.stringify(verdict.first?.wiped) ===
        JSON.stringify([".cf-exit", "particles.star", "particles/mic001_extract.mrcs", "particles/mic001_extract.star", "run.err", "run.out"]),
      `the local leg deletes exactly the products + witnesses (${JSON.stringify(verdict.first?.wiped)})`
    );
    must(
      JSON.stringify(verdict.tree1) ===
        JSON.stringify([".cf-remote-manifest.json", "micrographs ->link", "note.txt", "unknown_leftover.bin"]),
      `the surviving tree is exactly the keep-set; the emptied particles/ dir is pruned (${JSON.stringify(verdict.tree1)})`
    );
    must(verdict.doorAlive === true, "the door's TARGET survives untouched (the link is a door, not a tree)");
    must(verdict.second === 0, `the second pass is an honest zero (idempotent)`);
    must(JSON.stringify(verdict.tree2) === JSON.stringify(verdict.tree1), "the tree is stable across passes");
  }

  // an absent workdir answers null; an empty one wipes nothing.
  {
    const verdict = unitFs(`(() => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), "t333-empty-"));
      const a = wipeLocalRunProducts(path.join(os.tmpdir(), "t333-absent-never"));
      const b = wipeLocalRunProducts(empty);
      return { absent: a === null, emptyWiped: b.wiped.length };
    })()`);
    must(verdict.absent === true && verdict.emptyWiped === 0, "absent → null, empty → nothing (first runs are no-ops)");
  }

  // THE SOURCE ORDER — the resume path and the engine-native dispatchers
  // must sit ABOVE the wipe call site (they return before it).
  {
    const engineSrc = readFileSync(`${ROOT}/src/lib/relion/engine.ts`, "utf8");
    const iNative = engineSrc.indexOf('if (job.type === "select2d")');
    const iResume = engineSrc.indexOf("return spawnTrackedRun(job, resumeArgv");
    // LAST occurrence: an earlier engine-native also mkdirs its workdir —
    // the runRealJob one is the LAST (right before the wipe call).
    const iMkdir = engineSrc.lastIndexOf("mkdirSync(workdir, { recursive: true });");
    const iWipe = engineSrc.indexOf("wipeLocalRunProducts(workdir)");
    must(iNative > 0 && iResume > iNative && iMkdir > iResume && iWipe > iMkdir,
      "engine order: natives → resume → workdir mkdir → wipe (a resumed run never wipes)");
    must(
      engineSrc.includes("fresh run of ${job.type}") || engineSrc.includes("fresh run of "),
      "the engine's wipe logs its generation-clearing (the t318 console dialect)"
    );
  }

  // ======================================================================
  console.log("== PHASE C: LIVE REMOTE — the real re-run on the mock cluster ==");

  // the particles fixture (the t331 PHASE C shape)
  const mrcHdr = (() => {
    const b = Buffer.alloc(1024);
    b.writeInt32LE(1024, 0);
    b.writeInt32LE(1024, 4);
    b.writeInt32LE(2, 8); // NZ=2 — one section per referenced image (t338: the consumer gate refuses a star that outruns its stack)
    b.writeInt32LE(2, 12);
    b.writeInt32LE(1, 20);
    b.writeInt32LE(256, 44);
    b.writeInt32LE(1, 64);
    b.writeFloatLE(1.0, 68);
    b.writeInt32LE(1, 92);
    b.writeInt32LE(128, 96);
    return b.toString("base64");
  })();
  const fx = clientBoth(
    "mkdir -p /data2/t333-particles; " +
      `echo ${mrcHdr} | base64 -d > /data2/t333-particles/stack.mrcs; ` +
      "printf 'data_\\n\\nloop_\\n_rlnImageName #1\\n" +
      "0001@/data2/t333-particles/stack.mrcs\\n" +
      "0002@/data2/t333-particles/stack.mrcs\\n' > /data2/t333-particles/particles.star"
  );
  must(fx === "", `the particles fixture builds quietly (${fx.slice(0, 100)})`);

  const projR = await api("/api/projects", {
    method: "POST",
    headers: SHJ,
    body: JSON.stringify({ name: "QA t333 rerun wipe", mode: "remote", remoteConnectionId: CONN }),
  });
  must(projR.status >= 200 && projR.status < 300, `the remote project creates (${projR.status})`);
  const projRId = projR.body?.project?.id;
  createdProjects.push(projRId);

  const pImport = await mkJob({
    projectId: projRId,
    type: "import",
    name: "QA t333 particles import",
    params: {
      nodeType: "particles",
      micrographsPath: "/data2/t333-particles/particles.star",
      pixelSize: 0.93,
      voltage: 300,
    },
  });
  must(!!pImport?.id, "the particles import creates");
  const runPImport = await api(`/api/jobs/${pImport.id}/run`, { method: "POST", headers: SHJ, body: "{}" });
  must(runPImport.status >= 200 && runPImport.status < 300, `the import run accepts (${runPImport.status})`);
  const donePImport = await awaitJobTerminal(pImport.id, 90_000);
  must(donePImport?.status === "completed", `the particles import completes (${donePImport?.status})`);

  const c2d = await mkJob({
    projectId: projRId,
    type: "class2d",
    name: "2D Classification 1",
    params: { numClasses: 3, iterations: 3 },
  });
  must(!!c2d?.id, "the class2d job creates");
  const edgeC2d = await mkEdge(pImport.id, c2d.id, "particles", "particles");
  must(edgeC2d === 200 || edgeC2d === 201, `the edge wires particles import → class2d (${edgeC2d})`);

  const target = { remote: { connectionId: CONN, module: "relion/5.0.1", mode: "slurm", gpus: 2, partition: "brain2" } };

  const dispatch1 = await dispatch(c2d.id, target);
  must(dispatch1.status >= 200 && dispatch1.status < 300, `dispatch 1 answers (${dispatch1.status})`);
  const done1 = await awaitJobTerminal(c2d.id, 240_000);
  must(done1?.status === "completed", `dispatch 1 COMPLETES (${done1?.status}: ${String(done1?.result ?? "").slice(0, 80)})`);

  const rec1 = readState()[c2d.id];
  const wdR = rec1?.remote?.remoteWorkdir;
  must(!!wdR, `the record carries the cluster workdir (${wdR})`);
  const mirrorWd = rec1?.workdir;
  must(!!mirrorWd && existsSync(mirrorWd), "the record carries the local mirror workdir (and it exists)");

  const lsR = () =>
    client(`find ${JSON.stringify(wdR)} -mindepth 1 -maxdepth 2 \\( -type f -o -type l \\) -printf '%P\\n' | sort`)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  const lsMirror = () =>
    readdirSync(mirrorWd, { recursive: true })
      .map((n) => String(n))
      .sort();

  const tree0 = lsR();
  must(
    tree0.includes("run_data.star") && tree0.includes("run_classes.mrcs"),
    `generation 1 wrote its canonical finals on the cluster (${tree0.filter((f) => f.startsWith("run_")).slice(0, 4).join(", ")}…)`
  );
  must(tree0.some((f) => /^run_it\d+_/.test(f)), "generation 1 left per-iteration intermediates (the pre-t333 collision material)");

  // ---- inject the canaries: stale products + keeps, BOTH sides ----
  const fxCluster = clientBoth(
    `cd ${JSON.stringify(wdR)} && ` +
      `printf 'stale' > run_it009_class009.mrc && ` +          // a "future" iteration product
      `printf 'stale' > particles.star && ` +                    // a stale canonical-looking product
      `printf 'PS' > mic1_power.eps && ` +                       // a diagnostics-shape stale file
      `head -c 256 /dev/urandom > unknown_cluster.bin && ` +     // unknown = keep
      `printf 'note' > note.txt && ` +                           // note = keep
      `ln -s /data2/t333-particles micrographs_door && echo OK`  // a door = keep
  );
  must(fxCluster.endsWith("OK"), `the cluster canaries build (${fxCluster.slice(-40)})`);
  const mirrorCanaries = ["stale_mirror.mrcs", "unknown_local.bin", "note.txt"];
  for (const name of mirrorCanaries) {
    writeFileSync(path.join(mirrorWd, name), "canary");
  }
  const mirror0 = lsMirror();
  must(
    mirrorCanaries.every((n) => mirror0.includes(n)),
    `the local-mirror canaries are in place (${mirrorCanaries.join(", ")})`
  );
  const cluster0 = lsR();
  must(
    ["run_it009_class009.mrc", "particles.star", "mic1_power.eps", "unknown_cluster.bin", "note.txt", "micrographs_door"].every((n) =>
      cluster0.includes(n)
    ),
    "the cluster canaries are in place"
  );

  // ---- THE RE-RUN: the same job, the same workdir, a fresh generation ----
  const dispatch2 = await dispatch(c2d.id, target);
  must(dispatch2.status >= 200 && dispatch2.status < 300, `the re-dispatch answers (${dispatch2.status})`);
  const done2 = await awaitJobTerminal(c2d.id, 240_000);
  must(done2?.status === "completed",
    `the re-run COMPLETES — the point of the fix (${done2?.status}: ${String(done2?.result ?? "").slice(0, 120)})`);

  const tree1 = lsR();
  must(!tree1.includes("run_it009_class009.mrc"), "the stale 'future' iteration product is GONE from the cluster (the wipe ran)");
  must(!tree1.includes("particles.star"), "the stale canonical-looking product is GONE");
  must(!tree1.includes("mic1_power.eps"), "the stale diagnostics file is GONE");
  must(tree1.includes("unknown_cluster.bin"), "the unknown cluster file SURVIVES (unknown = keep, fresh-run dialect)");
  must(tree1.includes("note.txt"), "the cluster note SURVIVES");
  must(tree1.includes("micrographs_door"), "the cluster door link SURVIVES");
  must(
    tree1.includes("run_data.star") && tree1.includes("run_classes.mrcs"),
    "the NEW generation's canonical finals are back on the cluster"
  );
  must(tree1.some((f) => /^run_it\d+_/.test(f)), "the new generation wrote its own iterations");
  must(tree1.includes("run.out") && tree1.includes(".cf-exit"), "the fresh witnesses exist (run.out, the verdict)");
  must(tree1.includes(".cf-sbatch.sh"), "the fresh dispatch script was uploaded");

  const mirror1 = lsMirror();
  must(!mirror1.includes("stale_mirror.mrcs"), "the local-mirror stale product is GONE (the dispatch-time mirror wipe ran)");
  must(mirror1.includes("unknown_local.bin"), "the local-mirror unknown file SURVIVES");
  must(mirror1.includes("note.txt"), "the local-mirror note SURVIVES");
  must(mirror1.includes(".cf-remote-manifest.json"), "the local-mirror LEDGER survives the mirror wipe (pruned, never blanked)");
  must(mirror1.includes("run.out"), "the fresh run.out synced back to the mirror");

  // the ledger tells the truth about the live tree
  const manifest2 = JSON.parse(readFileSync(path.join(mirrorWd, ".cf-remote-manifest.json"), "utf8"));
  const manifestPaths = (manifest2.files ?? []).map((f) => f.path);
  must(
    manifestPaths.every((p) => tree1.includes(p)),
    `every ledger entry matches the live cluster tree (the ledger lies about nothing: ${manifestPaths.filter((p) => !tree1.includes(p)).join(", ") || "clean"})`
  );
  must(
    !manifestPaths.includes("run_it009_class009.mrc") && !manifestPaths.includes("particles.star"),
    "the ledger no longer lists the wiped canaries"
  );

  // the re-run's record is the new generation's own (fresh fence included)
  const rec2 = readState()[c2d.id];
  must(!!rec2?.remote?.slurmId, `the re-run's record carries its own slurm id (${rec2?.remote?.slurmId})`);
  must(rec2?.remote?.dispatchedAtEpoch == null || Number.isFinite(rec2.remote.dispatchedAtEpoch),
    "the t318 dispatch fence shape survives the wipe interplay (fence still stamped)");

  // the t331 cleanup still works on the post-wipe tree (regression, live)
  const planAfter = await api(`/api/jobs/${c2d.id}/cleanup`, { headers: SH });
  must(planAfter.status === 200 && planAfter.body?.ok === true, `the cleanup plan still answers on the re-run tree (${planAfter.status})`);
  must(planAfter.body?.remote?.exists === true, "the plan's remote side still lists the workdir");
  must(
    !planAfter.body?.remote?.groups?.some((g) => g.files?.some((f) => f.path === "run_it009_class009.mrc" || f.path === "particles.star")),
    "the plan offers nothing the wipe already took (the cache was dropped, the listing is live truth)"
  );

  // ======================================================================
  console.log("== PHASE D: CONTRACTS — the source pins ==");

  const rr = readFileSync(`${ROOT}/src/lib/remote/remote-run.ts`, "utf8");
  const rc = readFileSync(`${ROOT}/src/lib/remote/remote-cleanup.ts`, "utf8");
  const rw = readFileSync(`${ROOT}/src/lib/relion/run-wipe.ts`, "utf8");
  const insp = readFileSync(`${ROOT}/src/components/workflow/job-inspector.tsx`, "utf8");
  const panel = readFileSync(`${ROOT}/src/components/workflow/job-panel.tsx`, "utf8");
  const jobRoute = readFileSync(`${ROOT}/src/app/api/jobs/[id]/route.ts`, "utf8");

  // the remote lane's two blades, in order
  {
    const iMirror = rr.indexOf("wipeLocalRunProducts(localWorkdir)");
    const iRecord = rr.indexOf("upsertRun(job.id, record)");
    const iMkdirR = rr.indexOf("await remoteMkdir(conn, remoteWorkdir);");
    const iWipeR = rr.indexOf("listRemoteWorkdir(conn, remoteWorkdir, {");
    const iFence = rr.indexOf("t318 — the re-run's ghost");
    must(iMirror > 0 && iRecord > iMirror, "the local-mirror wipe runs BEFORE the new record is built (finalize can never see stale logs)");
    must(iMkdirR > 0 && iWipeR > iMkdirR && iFence > iWipeR, "the cluster wipe runs after remoteMkdir and BEFORE the t318 fence");
    must(rr.includes("bypassCache: true"), "the wipe lists LIVE (bypasses the 10s cache)");
    must(rr.includes("dropRemoteListingCache(conn.id, remoteWorkdir)"), "the post-wipe cache drop is called");
    must(rr.includes("rewriteManifestAfterCleanup(localWorkdir, wipeRels)"), "the wipe prunes the ledger entry-by-entry");
    must(
      rr.includes("a re-run into stale outputs is refused"),
      "an rm failure REFUSES the re-run (proceeding into stale files is the crash this kills)"
    );
    must(
      rr.includes("proceeding without it (a stale-file collision may fail the job, as before t333)"),
      "a LISTING failure degrades to warn-and-proceed (the pre-t333 behavior, spelled out)"
    );
  }

  // the wipe module's own grammar
  must(rw.includes("d.isSymbolicLink()") && rw.includes("never followed"), "the walker lists symlinks as doors, never follows them");
  must(rw.includes("recursive: true, force: true"), "the prune removes directories the way Node allows (the EISDIR lesson)");
  must(rw.includes("never a caller refusal"), "the local wipe is best-effort (never a run refusal)");
  must(rc.includes("dropRemoteListingCache"), "the remote legs export the cache drop");

  // the UI speaks the new truth
  must(
    insp.includes("are cleared first") && insp.includes("on this machine and on the cluster"),
    "the re-run confirm discloses the wipe (both sides, before the run)"
  );
  must(
    insp.includes("run directory stays until the next Run rebuilds it") &&
      panel.includes("run directory stays until the next Run rebuilds it"),
    "both reset affordances say reset clears STATE, not files"
  );

  // reset & delete keep files — the user's question, pinned as contract
  {
    const iIdle = jobRoute.indexOf('body.status === "idle"');
    const idleBranch = jobRoute.slice(iIdle, jobRoute.indexOf("const resetIntent", iIdle));
    must(iIdle > 0 && idleBranch.includes("clearRunRecord"), "reset clears the run record (fresh start next Run)");
    must(!idleBranch.includes("rmSync") && !idleBranch.includes("rm -rf"), "reset deletes NO files");
    must(jobRoute.includes("intentionally kept"), "delete keeps the workdir for restore (the Undo doctrine)");
  }

  console.log(fail === 0 ? "\n== t333 diag: ALL GREEN ==" : `\n== t333 diag: ${fail} FAIL ==`);
} finally {
  // ---- cleanup: the API trees, the cluster fixtures ----
  for (const id of createdJobs) {
    await api(`/api/jobs/${id}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  for (const pid of createdProjects) {
    try {
      client(`rm -rf /projects/cryoflow/${pid}`);
    } catch { /* the jobs DELETE already dropped the local twin */ }
    await api(`/api/projects/${pid}`, { method: "DELETE", headers: SH }).catch(() => null);
  }
  try {
    client("rm -rf /data2/t333-particles");
  } catch { /* fixtures are runtime, gitignored */ }
  await api(`/api/remote/connections/${CONN}`, { method: "DELETE", headers: SH }).catch(() => null);
}

process.exit(fail === 0 ? 0 : 1);
