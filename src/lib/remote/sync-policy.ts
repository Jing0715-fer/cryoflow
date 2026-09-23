/**
 * CryoFlow — the sync-back planner (PURE — the t326/t327/t334 recipe).
 *
 * t339 — 「extraction的mrcs也有一些放到本地了 … 我希望本地的空间占用
 * 尽量小一些」. The t289 key-files policy gated BINARY outputs per-file at
 * keyFileMb (default 16 MB): a map over the cap stays remote, class averages
 * under it come home. The loophole the field report walked straight through:
 * an extraction writes ONE .mrcs STACK PER MICROGRAPH — each a few MB, every
 * one of them under the cap, 865 of them. Per-file judgment cannot see an
 * aggregate; 865 "small" files are GBs on the laptop, none of them metadata.
 *
 * THE RULE this module owns: under key-files, the per-micrograph image
 * producers (the cleanup planner's own BULK_TYPES — extract, motioncorr,
 * polish: jobs whose binaries ARE bulk image data, never metadata) sync TEXT
 * ONLY — STAR/log/plot files come home, image stacks stay on the cluster
 * WHATEVER THEIR SIZE. Every other type keeps the t289 doctrine unchanged
 * (class averages of a few MB still land — the class gallery reads their
 * headers locally; big maps still stay). "everything" keeps meaning
 * everything under the caps — the explicit user override.
 *
 * PURE so the route, the receipt and the diag speak ONE classification: the
 * only import is the cleanup planner's own pure BULK_TYPES (the shared
 * grammar — a type that is bulk for DELETION is bulk for SYNC: both mean
 * "per-micrograph image product, reproducible from the inputs").
 *
 * What stayed on the cluster is never invisible: every entry rides the
 * manifest (`.cf-remote-manifest.json`, written from the FULL listing before
 * this planner runs), the Results tab lists it `remote: true`, and any
 * preview/download pulls it over SSH on demand (remote-files.ts, t289).
 */

// relative (not "@/…") so bun's dynamic file-path import in the diag harness
// resolves it without the tsconfig alias — the t338 particle-ref-gate recipe.
import { BULK_TYPES } from "../hpc/cleanup";

/** t289 — extensions that ALWAYS sync under the key-files policy: the small
 * textual skeleton of a RELION run (particles/metadata/logs/plots). Bulky
 * binary formats (.mrc/.mrcs/.map/.hdf/…) are gated — per-file at keyFileMb
 * for result types, NEVER for the bulk producers (the t339 rule). */
export const KEY_TEXT_EXT =
  /\.(star|log|txt|out|err|json|xml|com|lst|coord|bild|dat|eps|pdf|csv|ini|toml|ya?ml|md)$/i;

/** Why one entry did not come home. The first five come out of the pure
 * planner; the last two are appended by the download loop's own verdicts. */
export type SyncSkipWhy =
  | "metadata-only" // t339 — a bulk producer's image product (any size)
  | "key-cap" // over keyFileMb (key-files policy, non-bulk type)
  | "per-file-cap" // over the connection's maxFileMb
  | "budget" // the whole-sync budget ran out
  | "stale-generation" // t367 — predates this dispatch: a leftover the pre-run wipe failed to remove (never adopted as this run's output)
  | "download-failed" // the SSH pull itself failed
  | "grew-mid-download"; // the file grew past the cap while pulling

export interface SyncEntry {
  /** path relative to the job workdir (posix separators) */
  rel: string;
  size: number;
  /** t367 — the cluster-side mtime in epoch SECONDS (fractional), from
   * find's %T@. The generation gate (syncBackWorkdir) reads it: a file
   * that predates this dispatch is a previous run's leftover — the
   * pre-run wipe's silent-degrade debris — and must never graduate into
   * this run's outputs. Optional because the pure planner itself never
   * gates on it (legacy callers list without mtimes). */
  mtimeSec?: number;
}

export interface SyncPolicyContext {
  policy: "key-files" | "everything";
  /** the JOB's type — drives the metadata-only rule (absent = legacy caller,
   * the pre-t339 behavior: no type is never bulk). */
  jobType?: string;
  /** t289 per-file binary cap in MB (key-files policy, non-bulk types). */
  keyFileMb?: number;
  /** the connection's single-file cap (MB) — every policy. */
  maxFileMb: number;
  /** the connection's whole-sync budget (MB) — every policy. */
  maxTotalMb: number;
  /** the cluster workdir (the "everything" note names it). */
  remoteWorkdir?: string;
}

export interface SyncSkip extends SyncEntry {
  why: SyncSkipWhy;
}

export interface SyncPlan {
  /** entries to pull, in listing order, budget already deducted. */
  take: SyncEntry[];
  /** entries that stay on the cluster, with the spoken why. */
  skip: SyncSkip[];
}

/** Does this context sync metadata only? (key-files + a bulk producer) */
export function isMetadataOnlySync(ctx: SyncPolicyContext): boolean {
  return ctx.policy === "key-files" && !!ctx.jobType && BULK_TYPES.has(ctx.jobType);
}

/**
 * Classify a walked listing into what comes home and what stays. PURE: the
 * sync loop, the receipt note and the diag all speak THIS table, so the
 * reason a file stayed is the same word everywhere. Budget arithmetic runs
 * here (by listed size — conservative: a file that grows mid-download or
 * fails outright leaves the budget over-deducted, never over-spent).
 */
export function planSyncBack(entries: SyncEntry[], ctx: SyncPolicyContext): SyncPlan {
  const keyCap = (ctx.keyFileMb ?? 16) * 1024 * 1024;
  const capPerFile = ctx.maxFileMb * 1024 * 1024;
  let budget = ctx.maxTotalMb * 1024 * 1024;
  const metadataOnly = isMetadataOnlySync(ctx);
  const take: SyncEntry[] = [];
  const skip: SyncSkip[] = [];
  for (const entry of entries) {
    const { rel, size } = entry;
    if (metadataOnly && !KEY_TEXT_EXT.test(rel)) {
      skip.push({ ...entry, why: "metadata-only" });
      continue;
    }
    if (ctx.policy === "key-files" && !KEY_TEXT_EXT.test(rel) && size > keyCap) {
      skip.push({ ...entry, why: "key-cap" });
      continue;
    }
    if (size > capPerFile) {
      skip.push({ ...entry, why: "per-file-cap" });
      continue;
    }
    if (budget - size < 0) {
      skip.push({ ...entry, why: "budget" });
      continue;
    }
    budget -= size;
    take.push(entry);
  }
  return { take, skip };
}

/** One skip's per-file line (the record's skippedFiles list — the same
 * strings the pre-t339 note embedded, so no reader sees a dialect change). */
export function describeSyncSkipFile(s: SyncSkip, ctx: SyncPolicyContext): string {
  switch (s.why) {
    case "metadata-only":
      return `${s.rel} (image data — this job type syncs metadata only)`;
    case "key-cap":
      return `${s.rel} (${(s.size / 1024 / 1024).toFixed(0)} MB > ${ctx.keyFileMb ?? 16} MB key-file cap)`;
    case "per-file-cap":
      return `${s.rel} (${(s.size / 1024 / 1024).toFixed(0)} MB > ${ctx.maxFileMb} MB cap)`;
    case "budget":
      return `${s.rel} (sync budget exhausted)`;
    case "stale-generation":
      return `${s.rel} (leftover from an EARLIER run of this job — it predates this dispatch and the pre-run wipe did not remove it; NOT counted as this run's output, t367)`;
    case "download-failed":
      return `${s.rel} (download failed)`;
    case "grew-mid-download":
      return `${s.rel} (grew past the cap mid-download)`;
  }
}

/**
 * The receipt note for what stayed behind. The metadata-only class leads
 * with the POLICY (a user reading "865 files stayed" must learn it is by
 * design, not by caps they can raise); the capped classes keep the t289
 * wordings verbatim. Null when everything came home.
 */
export function describeSyncSkips(skips: SyncSkip[], ctx: SyncPolicyContext): string | null {
  if (skips.length === 0) return null;
  const segments: string[] = [];
  const meta = skips.filter((s) => s.why === "metadata-only");
  const stale = skips.filter((s) => s.why === "stale-generation");
  const capped = skips.filter((s) => s.why !== "metadata-only" && s.why !== "stale-generation");
  if (stale.length > 0) {
    // t367 — lead with the generation verdict: these files sit in the same
    // workdir but belong to a PREVIOUS run (the pre-run wipe could not
    // remove them). Pulling them would dress a leftover — possibly a
    // corrupt one from an earlier, differently-broken generation — as this
    // run's output. The receipt says exactly that.
    const named = stale.slice(0, 3).map((s) => s.rel).join(", ");
    const tail = stale.length > 3 ? " …" : "";
    segments.push(
      `${stale.length} file(s) in the workdir were left behind by an EARLIER run of this job (${named}${tail}) — they predate this dispatch (the pre-run wipe could not remove them), so they were NOT synced back as this run's outputs. If this run was cut short (check its log tail for where it stopped), its own final files may simply never have been written — re-dispatch writes fresh ones`
    );
  }
  if (meta.length > 0) {
    segments.push(
      `${meta.length} image file(s) stayed on the cluster — ${ctx.jobType} jobs sync metadata only under the key-files policy (STAR, logs and plots come home; image stacks never do, whatever their size). They are listed in this job's Results — open or download one to fetch it on demand — or switch the connection's sync policy to "everything" to bring them home`
    );
  }
  if (capped.length > 0) {
    const named = capped
      .slice(0, 3)
      .map((s) => describeSyncSkipFile(s, ctx))
      .join(", ");
    const tail = capped.length > 3 ? " …" : "";
    if (ctx.policy === "key-files") {
      segments.push(
        `${capped.length} bulky file(s) stayed on the cluster (key-files policy): ${named}${tail} — they are listed in this job's Results; preview or download them there on demand`
      );
    } else {
      segments.push(
        `${capped.length} file(s) stayed on the cluster (caps): ${named}${tail} — raise the sync caps in the connection settings or fetch them manually from ${ctx.remoteWorkdir ?? "the cluster workdir"}`
      );
    }
  }
  return segments.join(" — ");
}
