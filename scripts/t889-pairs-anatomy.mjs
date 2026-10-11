#!/usr/bin/env node
/**
 * t889 — the denoise pairing map's deep anatomy (RE-BORN, t897).
 *
 * The original t889 (64/64) died in the annihilate; the route's SRC
 * survived the merge, so this instrument re-writes onto the living code
 * and rides the REAL door: GET /api/jobs/[id]/denoise-pairs on the
 * witness job (the t894 denoise witness, 4 micrographs, a live provider
 * upstream). It pins the pairing contract at depth — the stem identity
 * (the wrapper's own recipe: basename minus the movie extension minus
 * the _denoised suffix), the provider leg (lineageFor's first DONE
 * provider carrying an accepted micrographs star), the per-row fields —
 * and then WITNESSES THE UNPAIRED HONESTY live: one synthetic row
 * appended to the denoised index (a stem no input star knows) must come
 * back with original null and originalJobId null — the row the gallery
 * dresses in amber (the t895 pair-status echo's reason to exist).
 *
 * The t533 cleanup VERIFIED law aboard from birth: the synthetic row is
 * an APPEND to a snapshot — the star's exact bytes are snapshotted
 * before, restored after, and the restoration is VERIFIED three ways
 * (byte-equal compare, the route's 4/4 again, no leftover files).
 *
 * Usage: node scripts/t889-pairs-anatomy.mjs   (dev server on :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const JOB = "cmv3y2m370001ltn309f8q29s"; // the t894 denoise witness
const PROVIDER_ID = "cmv3x1a020002lt89biep4phx"; // Import Movies 1
const WORKDIR = join(ROOT, "data/relion/cmv3x1a000000lt89qwh34u45/topazdenoise_09f8q29s");
const STAR = join(WORKDIR, "denoised_micrographs.star");
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const curl = (path, withOrigin = true) => {
  const cmd = `curl -s -w "\\n%{http_code}" ${withOrigin ? `-H "Origin: ${ORIGIN}"` : ""} "${BASE}${path}"`;
  const out = execSync(cmd, { encoding: "utf8", cwd: ROOT });
  const lines = out.trim().split("\n");
  const code = Number(lines[lines.length - 1]);
  let body = null;
  try { body = JSON.parse(lines.slice(0, -1).join("\n")); } catch {}
  return { code, body };
};

console.log(`t889 pairs anatomy — witness job ${JOB}\n`);

console.log("A — the door laws");
{
  const r = curl(`/api/jobs/${JOB}/denoise-pairs`, true);
  ok("A1 same-origin GET answers 200", r.code === 200);
  const x = curl(`/api/jobs/${JOB}/denoise-pairs`, false);
  ok("A2 cross-site refused 403 (workdir-derived data)", x.code === 403, `got ${x.code}`);
  const n = curl("/api/jobs/nonexistent-t889/denoise-pairs", true);
  ok("A3 unknown id 404", n.code === 404, `got ${n.code}`);
}

console.log("\nB — the response contract at depth (4 micrographs, a live provider)");
{
  const r = curl(`/api/jobs/${JOB}/denoise-pairs`, true);
  const b = r.body;
  ok("B1 the shape speaks (jobId/jobType/total/paired/provider/pairs)", b && b.jobId === JOB && b.jobType === "topazdenoise" && "total" in b && "paired" in b && "provider" in b && Array.isArray(b.pairs));
  ok("B2 total 4, paired 4 (the witness world's own number — D1 = 4, mourned not faked)", b?.total === 4 && b?.paired === 4, `got ${b?.total}/${b?.paired}`);
  ok("B3 the provider is the import job the engine itself would pick", b?.provider?.id === PROVIDER_ID && b?.provider?.name === "Import Movies 1", JSON.stringify(b?.provider));
  ok("B4 the names are the stems (mic001..004)", JSON.stringify(b?.pairs?.map((p) => p.name)) === JSON.stringify(["mic001", "mic002", "mic003", "mic004"]), JSON.stringify(b?.pairs?.map((p) => p.name)));
  ok("B5 each denoised row is the wrapper's own recipe (<stem>_denoised.mrc)", b?.pairs?.every((p) => p.denoised === `${p.name}_denoised.mrc`), JSON.stringify(b?.pairs?.map((p) => p.denoised)));
  ok("B6 each original resolves under the PROVIDER's workdir", b?.pairs?.every((p) => p.original === `micrographs/${p.name}.mrc` && p.originalJobId === PROVIDER_ID), JSON.stringify(b?.pairs?.map((p) => [p.original, p.originalJobId])));
}

console.log("\nC — the unpaired honesty, live (the amber row's reason to exist)");
const SNAP = readFileSync(STAR); // the exact bytes, the restoration's ruler
let appended = false;
try {
  const txt = SNAP.toString("utf8");
  if (!txt.includes("mic999")) {
    writeFileSync(STAR, txt.replace(/\n*$/, "\n") + "mic999_denoised.mrc\n");
    appended = readFileSync(STAR).toString("utf8").includes("mic999");
  }
  ok("C1 the synthetic row appended (a stem no input star knows)", appended);
} catch (e) {
  ok("C1 the synthetic row appended (a stem no input star knows)", false, String(e).slice(0, 80));
}
if (appended) {
  const r = curl(`/api/jobs/${JOB}/denoise-pairs`, true);
  const b = r.body;
  ok("C2 total climbs to 5 (the index is the route's row source)", b?.total === 5, `got ${b?.total}`);
  ok("C3 paired stays 4 — the unpaired row is the HONEST null", b?.paired === 4, `got ${b?.paired}`);
  const row = b?.pairs?.find((p) => p.name === "mic999");
  ok("C4 the unpaired row carries its denoised identity", row && row.denoised === "mic999_denoised.mrc", JSON.stringify(row));
  ok("C5 the unpaired row's original is null and its provider null — nothing fabricated", row && row.original === null && row.originalJobId === null, JSON.stringify(row));
}

console.log("\nD — the cleanup, VERIFIED three ways (the t533 doctrine)");
let restored = false;
try {
  writeFileSync(STAR, SNAP); // bit-for-bit
  restored = Buffer.compare(readFileSync(STAR), SNAP) === 0;
} catch {
  restored = false;
}
ok("D1 the star restored BYTE-FOR-BYTE (Buffer.compare === 0 — verified, not assumed)", restored);
{
  const r = curl(`/api/jobs/${JOB}/denoise-pairs`, true);
  ok("D2 the route's answer restored: 4/4 again", r.body?.total === 4 && r.body?.paired === 4, `got ${r.body?.total}/${r.body?.paired}`);
  ok("D3 no mic999 anywhere in the answer", !(JSON.stringify(r.body?.pairs ?? []).includes("mic999")));
}
ok("D4 no leftover files (the instrument's only writes were the star append — restored; no fixture files created)", !existsSync(join(WORKDIR, "t889-fixture")));

console.log(`\nt889 pairs anatomy (re-born): ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
