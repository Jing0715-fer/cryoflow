/**
 * CryoFlow — per-class particle stars, the cryoSPARC-style flow (t350).
 *
 * The user's ask: 「relion做3D分类后，需要通过subset selection再选择想要的
 * 类的颗粒，我希望改成像cryosparc一样，每一类的颗粒都有一个单独的star文
 * 件……直接选择想要的类进行后续步骤……支持多个star文件link到同一个后续
 * job，自动用joinstar完成，避免人为操作」
 *
 * Two cluster-side primitives, both POSIX awk (the t346 doctrine: the
 * counting/splitting happens WHERE the star lives — a 35 万-particle data
 * star never crosses the wire for a class count):
 *
 *   · splitPerClassStars() — after a class2d/class3d finishes, the final
 *     run_itNNN_data.star splits into particles_class001.star,
 *     particles_class002.star, … (one per class, optics block copied,
 *     particle rows bucketed by _rlnClassNumber). Runs BEFORE the
 *     sync-back so the .star key-file policy carries every class star
 *     home like any other metadata.
 *   · combineClassStars() — N selected class stars merge into ONE
 *     combined_input.star inside the CONSUMER's workdir (optics block
 *     from the first file, particle rows concatenated; the column
 *     headers must match or the merge refuses honestly — cross-job
 *     merges with different columns are the user's joinstar job, not a
 *     silent guess). This is the "auto joinstar": no manual step, no
 *     extra queue wait — one awk over files that already sit on the
 *     same cluster filesystem.
 *
 * Server-only module (ssh).
 */

import { exec, remoteUpload } from "./ssh";
import type { RemoteConnection } from "./types";

function shQ(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

/** the job types whose final data star carries a _rlnClassNumber column */
export const PER_CLASS_TYPES = new Set(["class2d", "class3d"]);

export interface PerClassSplitResult {
  ok: boolean;
  /** workdir-relative class star names, ascending by class */
  files: string[];
  /** the data star that was split (workdir-relative) */
  dataStar: string | null;
  error?: string;
}

/**
 * The splitter — one bash script uploaded next to the data star and run
 * in place (idempotent: an existing split is reported, not redone).
 *
 * Layout of a RELION data star:
 *   data_optics   → loop_ of _rlnOptics* (copied verbatim to every class)
 *   data_particles→ loop_ of _rln* headers + one row per particle
 * The awk walks once: everything up to data_particles is "head" (shared),
 * the particle loop's header rows are captured while resolving the
 * _rlnClassNumber column (by its #N suffix, falling back to header
 * order), then each data row is appended to that class's file — which is
 * opened (head + loop header already written) lazily on first sight.
 */
const SPLITTER_SH = `#!/bin/bash
set -u
W=$1
DS=$2
cd "$W" || { echo "CF_ERR: cannot enter $W"; exit 1; }
[ -f "$DS" ] || { echo "CF_ERR: no data star $DS"; exit 1; }
if ls particles_class*.star >/dev/null 2>&1; then
  echo "CF_HAVE $(ls particles_class*.star | wc -l | tr -d ' ')"
  exit 0
fi
awk '
  BEGIN { mode = 0; clscol = 0 }
  /^data_(particles)?[ \t]*$/ { mode = 1; next }
  mode == 0 {
    head = head $0 "\\n"
    next
  }
  mode == 1 && /^loop_/ { mode = 2; next }
  mode == 2 && /^_/ {
    phead = phead $0 "\\n"
    if ($0 ~ /^_rlnClassNumber/) {
      n = $0; sub(/^.*#/, "", n); sub(/[^0-9].*$/, "", n)
      clscol = (n ~ /^[0-9]+$/) ? n + 0 : phdr + 1
    }
    phdr++
    next
  }
  mode == 2 && !/^_/ && !/^#/ && NF >= 1 {
    if (!clscol || NF < clscol) next
    c = $clscol + 0
    if (c < 1) next
    if (!(c in opened)) {
      opened[c] = 1
      fn = sprintf("particles_class%03d.star", c)
      printf "%s", head > fn
      printf "data_particles\\n" >> fn
      printf "loop_\\n" >> fn
      printf "%s", phead >> fn
      order[++ncls] = c
    }
    print $0 >> sprintf("particles_class%03d.star", c)
    total++
    next
  }
  END {
    printf "CF_SPLIT %d %d\\n", ncls + 0, total + 0
    for (i = 1; i <= ncls; i++) printf "CF_FILE particles_class%03d.star\\n", order[i]
  }
' "$DS"
`;

/**
 * Split a finished classification's final data star into per-class stars
 * ON THE CLUSTER. The caller (finalize) runs this BEFORE the sync-back so
 * the class stars ride the .star key-file policy home.
 */
export async function splitPerClassStars(
  conn: RemoteConnection,
  remoteWorkdir: string,
  jobType: string
): Promise<PerClassSplitResult> {
  if (!PER_CLASS_TYPES.has(jobType)) {
    return { ok: false, files: [], dataStar: null, error: `${jobType} has no per-class split` };
  }
  const scriptPath = `${remoteWorkdir.replace(/\/+$/, "")}/.cf-split-classes.sh`;
  const up = await remoteUpload(conn, SPLITTER_SH, scriptPath);
  if (!up) {
    return { ok: false, files: [], dataStar: null, error: `could not upload the splitter to ${conn.host}` };
  }
  // the newest data star (it%03d zero-pads — lexical order == numeric)
  const res = await exec(
    conn,
    [
      `DS=$(ls ${shQ(remoteWorkdir)} 2>/dev/null | grep -E '^(run_it|_it)[0-9]+_data\\.star$' | sort | tail -1)`,
      "if [ -z \"$DS\" ]; then echo CF_ERR: no iteration data star; exit 0; fi",
      `bash ${shQ(scriptPath)} ${shQ(remoteWorkdir)} "$DS"`,
    ].join("\n"),
    { timeoutMs: 120_000 }
  );
  if (res.error) {
    return { ok: false, files: [], dataStar: null, error: `SSH to ${conn.host} failed (${res.error})` };
  }
  if (/CF_ERR:/.test(res.stdout)) {
    const line = res.stdout.split("\n").find((l) => l.includes("CF_ERR:")) ?? "CF_ERR: split failed";
    return { ok: false, files: [], dataStar: null, error: line.trim() };
  }
  const have = /CF_HAVE (\d+)/.exec(res.stdout);
  if (have) {
    // idempotent re-run: list what already exists
    const files = (res.stdout.match(/CF_FILE (\S+)/g) ?? []).map((l) => l.slice("CF_FILE ".length));
    if (files.length > 0) return { ok: true, files, dataStar: null };
    const lsRes = await exec(
      conn,
      `ls ${shQ(remoteWorkdir)} 2>/dev/null | grep -E '^particles_class[0-9]+\\.star$' | sort`,
      { timeoutMs: 20_000 }
    );
    const existing = lsRes.stdout.split("\n").map((l) => l.trim()).filter((l) => /^particles_class\d+\.star$/.test(l));
    return { ok: existing.length > 0, files: existing, dataStar: null, error: existing.length === 0 ? "split reported done but no files appeared" : undefined };
  }
  const split = /CF_SPLIT (\d+) (\d+)/.exec(res.stdout);
  if (!split) {
    return { ok: false, files: [], dataStar: null, error: `the splitter produced no verdict (${res.stdout.trim().slice(0, 120)})` };
  }
  const files = (res.stdout.match(/CF_FILE (\S+)/g) ?? []).map((l) => l.slice("CF_FILE ".length));
  const dsLine = `data star split into ${split[1]} class star(s), ${split[2]} particles assigned`;
  console.log(`per-class: ${dsLine} in ${remoteWorkdir}`);
  return { ok: true, files, dataStar: null };
}

/* ------------------------------------------------------------------ */
/* the auto-joinstar                                                   */
/* ------------------------------------------------------------------ */

/**
 * The combiner — merges N particle stars (same column layout — the
 * per-class stars of ONE classification always qualify) into ONE star
 * inside the consumer's workdir. Built from four tiny awks instead of
 * one clever one (each is checkable by reading it once):
 *   1. the FIRST file's optics head (everything before data_particles);
 *   2. the FIRST file's particle-loop header (data_particles + loop_ +
 *      its _rln label rows) — appended to the output AND captured as the
 *      reference header;
 *   3. per input: its own particle-loop header must MATCH the reference
 *      byte-for-byte (a cross-layout mix is refused honestly — that is
 *      the explicit joinstar job's territory, not a silent guess);
 *   4. per input: append the data rows (everything in the particles
 *      loop that is not a label/comment/blank) and count them.
 */
const COMBINER_SH = `#!/bin/bash
set -u
OUT=$1
shift
[ $# -ge 1 ] || { echo "CF_ERR: no inputs"; exit 1; }
FIRST=$1
[ -f "$FIRST" ] || { echo "CF_ERR: missing $FIRST"; exit 1; }
TMPD=$(dirname "$OUT")
HDR="$TMPD/.cf-combine-hdr.tmp"
# 1 — optics head of the first file
awk '/^data_(particles)?[ \t]*$/{exit} {print}' "$FIRST" > "$OUT" || { echo "CF_ERR: head extract failed"; exit 1; }
# 2 — particle-loop header (data_particles + loop_ + its _rln rows),
#     appended to OUT and captured (labels only) as the reference
awk '/^data_(particles)?[ \t]*$/{p=1; print; next} p && /^loop_/{pl=1; print; next} p && pl && /^_/{print; next} p && pl {exit}' "$FIRST" >> "$OUT"
awk '/^data_(particles)?[ \t]*$/{p=1;next} p && /^loop_/{pl=1;next} p && pl && /^_/{print;next} p && pl {exit}' "$FIRST" > "$HDR"
REF=$(cat "$HDR")
[ -n "$REF" ] || { echo "CF_ERR: no particle loop in $FIRST"; exit 1; }
ROWS=0
ROWTMP="$TMPD/.cf-combine-rows.tmp"
for f in "$@"; do
  [ -f "$f" ] || { echo "CF_ERR: missing $f"; exit 1; }
  THIS=$(awk '/^data_(particles)?[ \t]*$/{p=1;next} p && /^loop_/{pl=1;next} p && pl && /^_/{print;next} p && pl {exit}' "$f")
  if [ "$THIS" != "$REF" ]; then
    echo "CF_ERR: particle columns of $f differ from $FIRST — connect a joinstar job for cross-layout merges instead"
    exit 1
  fi
  awk '/^data_(particles)?[ \t]*$/{p=1;next} p && /^loop_/{pl=1;next} p && pl && /^_/{next} p && pl && /^data_/{exit} p && pl && !/^#/ && NF >= 1 {print}' "$f" > "$ROWTMP"
  N=$(wc -l < "$ROWTMP")
  cat "$ROWTMP" >> "$OUT"
  ROWS=$((ROWS + N))
done
rm -f "$HDR" "$ROWTMP"
echo "CF_COMBINED $ROWS"
`;

/**
 * Merge N class stars (cluster-absolute paths) into outPath
 * (cluster-absolute). Returns the row count, or an honest error.
 *
 * The header-match guard: the combiner refuses when a later file's
 * particle-loop header differs from the first file's — the per-class
 * stars of one classification always match; a cross-job mix belongs to
 * the explicit joinstar job.
 */
export async function combineClassStars(
  conn: RemoteConnection,
  clusterPaths: string[],
  outPath: string
): Promise<{ ok: boolean; rows: number; error?: string }> {
  if (clusterPaths.length === 0) return { ok: false, rows: 0, error: "no input stars" };
  if (clusterPaths.length === 1) {
    return { ok: false, rows: 0, error: "one input star needs no combine — point --i at it directly" };
  }
  const scriptPath = `${outPath.replace(/\/[^/]+$/, "")}/.cf-combine-stars.sh`;
  const up = await remoteUpload(conn, COMBINER_SH, scriptPath);
  if (!up) return { ok: false, rows: 0, error: `could not upload the combiner to ${conn.host}` };
  const res = await exec(
    conn,
    [
      `mkdir -p ${shQ(outPath.replace(/\/[^/]+$/, ""))}`,
      `rm -f ${shQ(outPath)}`,
      `CF_OUT=${shQ(outPath)} bash ${shQ(scriptPath)} ${shQ(outPath)} ${clusterPaths.map(shQ).join(" ")}`,
    ].join("\n"),
    { timeoutMs: 120_000 }
  );
  if (res.error) return { ok: false, rows: 0, error: `SSH to ${conn.host} failed (${res.error})` };
  if (/CF_ERR:/.test(res.stdout)) {
    const line = res.stdout.split("\n").find((l) => l.includes("CF_ERR:")) ?? "CF_ERR: combine failed";
    return { ok: false, rows: 0, error: line.trim() };
  }
  const m = /CF_COMBINED (\d+)/.exec(res.stdout);
  if (!m) return { ok: false, rows: 0, error: `the combiner produced no verdict (${res.stdout.trim().slice(0, 120)})` };
  return { ok: true, rows: Number(m[1]) };
}
