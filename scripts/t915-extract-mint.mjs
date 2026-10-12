#!/usr/bin/env node
/**
 * t915 — the extract-chain mint: the world has no extract job, so the
 * quick-keymap's rich row (the slice-step chips) has never been witnessed
 * in its NATIVE habitat — an extract job's per-micrograph particle stacks.
 * The t914 law applies: the world lacks the variable — MINT it through the
 * REAL doors, nothing hand-planted:
 *
 *   import (already in the world, completed, 4 real mic001-004.mrc)
 *     → autopick  (POST /api/jobs {type:"autopick"} + edge import→autopick,
 *                  bare run → t317 → the project's Mock Cluster binding)
 *     → extract   (POST /api/jobs {type:"extract"} + edges autopick→extract
 *                  and import→extract, bare run → the Mock Cluster)
 *
 * The mock's autopick stub writes per-mic coordinate stars; the extract
 * stub writes per-mic `extra/<mic>_extract.mrcs` (renderable MRC stacks,
 * 8–12 particles each) + a two-block particles.star. The sync-back is
 * metadata-only BY DESIGN (t339: extract ∈ BULK_TYPES): the star comes
 * home, the stacks stay cluster-side and ride the remote manifest — the
 * listing must show them `remote: true`, honestly header-less until the
 * on-demand fetch graduates them.
 *
 * Verbs (the t913/t914 mint contract — the manifest is the restore's law):
 *   mint    build the chain, run it, verify the products, write manifest.json
 *   verify  re-check every manifest claim against the live world
 *   remove  delete the minted jobs (the hard door), rm leftovers, verify
 *           the pre-state job count and the untouched Mock Cluster binding
 *
 *   node scripts/t915-extract-mint.mjs mint|verify|remove
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const ORIGIN = `-H "Origin: ${BASE}"`;
const MANIFEST = path.join(process.cwd(), "data", "t915-extract-mint.json");
const RECEIPT_DEFAULT = "shots-qa/t915-extract-mint.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", timeout: 180_000 }).trim(); }
  catch (e) { return `ERR:${String(e.message).slice(0, 300)}`; }
};
const api = (method, url, body) => {
  const cmd = `curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  const out = sh(cmd);
  try { return JSON.parse(out); } catch { return { error: out.slice(0, 200) }; }
};

const jobs = () => api("GET", "/api/jobs").jobs ?? [];
const findType = (t) => jobs().filter((j) => j.type === t);
const binding = () => {
  try {
    const reg = JSON.parse(readFileSync(path.join(process.cwd(), "data", "projects.json"), "utf8"));
    return reg.projects?.[reg.active]?.remote?.connectionId ?? null;
  } catch { return null; }
};

/** poll a job to a terminal state (the mock lane is fast; the cap is honest) */
async function pollUntil(jobId, want, timeoutMs = 240_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobs().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
}

const preCount = () => jobs().length;

// ---- the world guards (the t914 lessons, both applied) --------------------
function guards() {
  ok("guard: server answers", Array.isArray(jobs()));
  // the world must be SINGULAR: no stale t915 mints (a same-name twin makes
  // a finder ride the wrong card — the t914 lesson, word for word)
  const stalePick = findType("autopick").filter((j) => (j.name ?? "").includes("t915"));
  const staleEx = findType("extract").filter((j) => (j.name ?? "").includes("t915"));
  ok("guard: no stale t915 mints", stalePick.length === 0 && staleEx.length === 0,
    stalePick.length + staleEx.length ? `${stalePick.length + staleEx.length} stale — run remove first` : "");
  if (stalePick.length + staleEx.length) { console.log("FATAL: singular-world guard — remove first"); process.exit(2); }
  const imports = findType("import").filter((j) => j.status === "completed");
  ok("guard: a completed import exists (the chain's root)", imports.length >= 1);
  // the binding must be LIVE (the bare run's remote leg rides it)
  const conn = api("GET", "/api/remote/connections").connections ?? [];
  ok("guard: Mock Cluster connection present", conn.some((c) => c.id === "conn-mv3y5x8f"));
  ok("guard: project bound to conn-mv3y5x8f", binding() === "conn-mv3y5x8f", `binding=${binding()}`);
  if (fail > 0) { console.log("FATAL: guards failed — the mint refuses to ride"); process.exit(2); }
  return imports[0];
}

// ---- mint -----------------------------------------------------------------
async function mint() {
  console.log("== t915 extract mint — mint ==");
  const root = guards();
  const before = preCount();
  console.log(`  pre-state: ${before} jobs; chain root: import ${root.id.slice(-8)} "${root.name}"`);

  // 1. autopick node + edge import→autopick
  const pick = api("POST", "/api/jobs", { type: "autopick", name: "t915 pick witness" });
  ok("autopick node created", !!pick.job?.id, pick.job?.id?.slice(-8));
  if (!pick.job?.id) process.exit(2);
  const e1 = api("POST", "/api/edges", { fromJobId: root.id, toJobId: pick.job.id });
  ok("edge import→autopick", !e1.error, JSON.stringify(e1).slice(0, 120));

  // 2. bare run (t317: the project binding dispatches to the Mock Cluster)
  const r1 = api("POST", `/api/jobs/${pick.job.id}/run`);
  ok("autopick run accepted", !r1.error, r1.error ?? r1.job?.status);
  const pickDone = await pollUntil(pick.job.id);
  ok("autopick completed", pickDone.status === "completed", `status=${pickDone.status} ${String(pickDone.result ?? "").slice(0, 90)}`);
  if (pickDone.status !== "completed") { console.log("FATAL: autopick did not complete — remove and inspect"); process.exit(2); }

  // 3. extract node + edges (coords from autopick, micrographs from import)
  const ex = api("POST", "/api/jobs", { type: "extract", name: "t915 extract witness" });
  ok("extract node created", !!ex.job?.id, ex.job?.id?.slice(-8));
  if (!ex.job?.id) process.exit(2);
  const e2 = api("POST", "/api/edges", { fromJobId: pick.job.id, toJobId: ex.job.id });
  ok("edge autopick→extract", !e2.error, JSON.stringify(e2).slice(0, 120));
  const e3 = api("POST", "/api/edges", { fromJobId: root.id, toJobId: ex.job.id });
  ok("edge import→extract", !e3.error, JSON.stringify(e3).slice(0, 120));

  // 4. bare run
  const r2 = api("POST", `/api/jobs/${ex.job.id}/run`);
  ok("extract run accepted", !r2.error, r2.error ?? r2.job?.status);
  const exDone = await pollUntil(ex.job.id);
  ok("extract completed", exDone.status === "completed", `status=${exDone.status} ${String(exDone.result ?? "").slice(0, 90)}`);
  if (exDone.status !== "completed") { console.log("FATAL: extract did not complete — remove and inspect"); process.exit(2); }

  // 5. verify the products: the star home, the stacks remote, the listing honest
  const outs = api("GET", `/api/jobs/${ex.job.id}/outputs`);
  ok("outputs listing ok", outs.status === "ok", outs.workdir ? String(outs.workdir).replace(process.cwd() + "/", "") : "no workdir");
  const files = outs.files ?? [];
  const star = files.find((f) => f.name === "particles.star");
  ok("particles.star came home (local)", !!star && !star.remote, star ? `${star.rows ?? "?"} rows · ${star.size}B` : "missing");
  const remotes = files.filter((f) => f.remote && /\.mrcs$/i.test(f.name));
  ok("per-mic stacks listed remote:true", remotes.length >= 1, `${remotes.length} stack(s)`);
  ok("remote cards honest: NO slices until fetch", remotes.every((f) => f.slices == null));
  ok("remote cards carry size", remotes.every((f) => typeof f.size === "number" && f.size > 0));

  // the manifest on disk is the ground truth of what stayed behind
  const wd = outs.workdir;
  let manifest = null;
  try { manifest = JSON.parse(readFileSync(path.join(wd, ".cf-remote-manifest.json"), "utf8")); } catch { /* below */ }
  ok("remote manifest present in the workdir", !!manifest?.files?.length);
  const manStacks = (manifest?.files ?? []).filter((f) => /\.mrcs$/i.test(f.path));
  ok("manifest lists the per-mic stacks", manStacks.length >= 1, manStacks.map((f) => f.path).join(", ").slice(0, 160));

  // the star's rows resolve into the remote stacks (the merged relpath dialect)
  let starRows = 0, rowRefs = new Set();
  try {
    const text = readFileSync(path.join(wd, "particles.star"), "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("_") || t.startsWith("#") || t.startsWith("data_") || t === "loop_") continue;
      const img = t.split(/\s+/)[0] ?? "";
      const m = /^\d+@(.+)$/.exec(img);
      if (m) { starRows++; rowRefs.add(m[1]); }
    }
  } catch { /* below */ }
  ok("star rows reference stacks", starRows > 0, `${starRows} rows → ${[...rowRefs].join(", ").slice(0, 120)}`);
  ok("row refs land in the manifest (the walk's contract)", [...rowRefs].every((r) => manStacks.some((f) => f.path === r)));

  // 6. the restore's law — write the manifest
  mkdirSync(path.dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    writtenAt: new Date().toISOString(),
    preJobs: before,
    binding: binding(),
    root: { id: root.id, name: root.name },
    pick: { id: pick.job.id, name: pick.job.name },
    extract: { id: ex.job.id, name: ex.job.name },
    workdirs: { pick: pickDone.workdir ?? null, extract: wd ?? null },
    stacks: manStacks.map((f) => f.path),
  }, null, 2));
  console.log(`  manifest written: ${MANIFEST}`);
  console.log(`== mint ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---- verify ---------------------------------------------------------------
function verify() {
  console.log("== t915 extract mint — verify ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to verify"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const list = jobs();
  ok("extract job alive", list.some((j) => j.id === m.extract.id && j.type === "extract"));
  ok("autopick job alive", list.some((j) => j.id === m.pick.id && j.type === "autopick"));
  ok("import root alive", list.some((j) => j.id === m.root.id));
  ok("job count matches pre-state + 2", list.length === m.preJobs + 2, `${list.length} vs ${m.preJobs}+2`);
  for (const rel of m.stacks ?? []) {
    const p = path.join(m.workdirs.extract, rel);
    ok(`stack still cluster-side (NOT local): ${rel}`, !existsSync(p));
  }
  ok("binding untouched", binding() === m.binding, `binding=${binding()}`);
  console.log(`== verify ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

// ---- remove ---------------------------------------------------------------
function remove() {
  console.log("== t915 extract mint — remove ==");
  if (!existsSync(MANIFEST)) { console.log("  ✗ no manifest — nothing to remove"); process.exit(1); }
  const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
  // downstream first: the extract dies before its autopick feed
  const d1 = api("DELETE", `/api/jobs/${m.extract.id}`);
  ok("extract job deleted (the hard door)", !d1.error, JSON.stringify(d1).slice(0, 80));
  const d2 = api("DELETE", `/api/jobs/${m.pick.id}`);
  ok("autopick job deleted (the hard door)", !d2.error, JSON.stringify(d2).slice(0, 80));
  // workdir leftovers (a DELETE refuses nothing about disk state; rm by hand)
  // the t915 lesson (the instrument bit its own tool, second sighting): the
  // poll DTO carries NO workdir, so the manifest's pick entry is null — the
  // sweep must not trust the manifest alone. Sweep BOTH type dirs by the
  // minted jobs' id suffixes (the workdir name is <type>_<id-suffix>), then
  // the manifest's own entries as the belt-and-braces second pass.
  const suffixes = [m.extract?.id, m.pick?.id].filter(Boolean).map((id) => id.slice(-8));
  const base = path.join(process.cwd(), "data", "relion");
  try {
    for (const proj of readdirSync(base)) {
      for (const dir of readdirSync(path.join(base, proj))) {
        if (suffixes.some((s) => dir.endsWith(s)) && /^(autopick_|extract_)/.test(dir)) {
          const p = path.join(base, proj, dir);
          try { rmSync(p, { recursive: true, force: true }); console.log(`  rm ${path.relative(process.cwd(), p)}`); }
          catch (e) { console.log(`  ✗ rm failed for ${p}: ${e.message}`); fail++; }
        }
      }
    }
  } catch { /* the base may not exist — nothing to sweep */ }
  for (const wd of [m.workdirs?.extract, m.workdirs?.pick]) {
    if (wd && existsSync(wd)) {
      try { rmSync(wd, { recursive: true, force: true }); console.log(`  rm ${wd.replace(process.cwd() + "/", "")}`); }
      catch (e) { console.log(`  ✗ rm failed for ${wd}: ${e.message}`); fail++; }
    }
  }
  const list = jobs();
  ok("world restored: pre-state job count", list.length === m.preJobs, `${list.length} vs ${m.preJobs}`);
  ok("no t915 residue", list.every((j) => !(j.name ?? "").includes("t915")));
  ok("binding untouched", binding() === m.binding, `binding=${binding()}`);
  rmSync(MANIFEST, { force: true });
  console.log(`== remove ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
  process.exit(fail === 0 ? 0 : 1);
}

const verb = process.argv[2];
if (verb === "mint") await mint();
else if (verb === "verify") verify();
else if (verb === "remove") remove();
else { console.log("usage: t915-extract-mint.mjs mint|verify|remove"); process.exit(1); }
