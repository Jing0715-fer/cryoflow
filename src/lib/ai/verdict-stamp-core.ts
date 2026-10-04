/**
 * t565 — the AI verdict stamp's PURE core (no imports — node-direct
 * testable, the t562 lib-test doctrine).
 *
 * judge_2d_classes speaks about a class2d job; until now the verdict
 * lived only in the chat transcript (sessions are a 20-entry convenience
 * cache, not an archive) — reset the panel and the opinion is gone.
 * The stamp pins the verdict to the JOB it is about: one entry per job,
 * newest wins, stored in data/ai-verdicts.json (the frozen-schema
 * doctrine — engine state stays out of the Prisma schema).
 *
 * LAWS:
 *  - THE STAMP IS A NOTEBOOK ENTRY, NOT ENGINE OUTPUT. It never touches
 *    particle sets, selections or params — the footer names the model
 *    and the two-pass summary so it can never masquerade as a receipt.
 *  - SANITIZE AT THE DOOR: the payload is AI-derived text entering
 *    persistent storage — verdict values are enum-checked, class numbers
 *    positive integers, reasons/advice length-capped, counts re-derived
 *    from the (validated) class list, never trusted from the caller.
 *  - ONE JOB, ONE STAMP: a re-judge overwrites (the newest opinion is
 *    the run's current verdict); upsert moves it to the front, the cap
 *    drops from the back.
 */

export interface VerdictStampClass {
  cls: number;
  verdict: "keep" | "maybe" | "reject";
  reason: string;
}

export interface VerdictStamp {
  /** the class2d job this verdict is ABOUT */
  jobId: string;
  /** Date.now() at stamp time */
  at: number;
  /** the class2d iteration the sheet came from (null = unknown) */
  iteration: number | null;
  /** the vision model that spoke (the notebook's "who wrote this") */
  model: string;
  /** t545 two-pass summary — null when the second read was unreadable */
  twoPass: { agreed: number; torn: number; missing: number } | null;
  classes: VerdictStampClass[];
  advice: string;
  /** re-derived from the validated class list at sanitize time */
  counts: { keep: number; maybe: number; reject: number };
}

export interface StampsFile {
  version: 1;
  stamps: VerdictStamp[];
}

/** the file is a notebook, not an archive */
export const MAX_STAMPS = 200;
export const MAX_REASON_CHARS = 240;
export const MAX_ADVICE_CHARS = 800;

const VERDICTS = new Set(["keep", "maybe", "reject"]);

/**
 * Validate one incoming stamp payload (whatever the caller constructed —
 * usually the judge tool). Returns null on shape garbage; every string
 * is trimmed and capped; counts are recomputed from the class list.
 */
export function sanitizeStamp(input: unknown): VerdictStamp | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const s = input as Record<string, unknown>;

  // jobId: the stamp IS about a job — no id, no stamp
  const jobId = typeof s.jobId === "string" ? s.jobId.trim().slice(0, 64) : "";
  if (!jobId) return null;

  const at =
    typeof s.at === "number" && Number.isFinite(s.at) && s.at > 0
      ? Math.floor(s.at)
      : Date.now();
  const iteration =
    typeof s.iteration === "number" && Number.isFinite(s.iteration)
      ? Math.floor(s.iteration)
      : null;
  const model =
    typeof s.model === "string" ? s.model.trim().slice(0, 120) : "";

  // twoPass: present-or-null, numbers floored (a torn count is an int)
  let twoPass: VerdictStamp["twoPass"] = null;
  if (
    s.twoPass &&
    typeof s.twoPass === "object" &&
    !Array.isArray(s.twoPass)
  ) {
    const tp = s.twoPass as Record<string, unknown>;
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0
        ? Math.floor(v)
        : 0;
    twoPass = {
      agreed: num(tp.agreed),
      torn: num(tp.torn),
      missing: num(tp.missing),
    };
  }

  // classes: enum-checked, positive cls, capped reasons
  const classes: VerdictStampClass[] = [];
  if (Array.isArray(s.classes)) {
    for (const raw of s.classes) {
      if (!raw || typeof raw !== "object") continue;
      const c = raw as Record<string, unknown>;
      const cls =
        typeof c.cls === "number" && Number.isInteger(c.cls) && c.cls > 0
          ? c.cls
          : NaN;
      const verdict =
        typeof c.verdict === "string" && VERDICTS.has(c.verdict)
          ? (c.verdict as VerdictStampClass["verdict"])
          : null;
      if (!Number.isFinite(cls) || !verdict) continue;
      const reason =
        typeof c.reason === "string"
          ? c.reason.trim().slice(0, MAX_REASON_CHARS)
          : "";
      classes.push({ cls, verdict, reason });
    }
  }

  const counts = {
    keep: classes.filter((c) => c.verdict === "keep").length,
    maybe: classes.filter((c) => c.verdict === "maybe").length,
    reject: classes.filter((c) => c.verdict === "reject").length,
  };

  const advice =
    typeof s.advice === "string" ? s.advice.trim().slice(0, MAX_ADVICE_CHARS) : "";

  return { jobId, at, iteration, model, twoPass, classes, advice, counts };
}

/** one job, one stamp: same jobId replaces in place AND moves to front */
export function upsertStamp(
  stamps: VerdictStamp[],
  stamp: VerdictStamp
): VerdictStamp[] {
  const rest = stamps.filter((s) => s.jobId !== stamp.jobId);
  return [stamp, ...rest];
}

/** the notebook's cap: newest first on the way in, so the tail is oldest */
export function trimStamps(
  stamps: VerdictStamp[],
  cap: number = MAX_STAMPS
): VerdictStamp[] {
  return stamps.slice(0, Math.max(1, cap));
}

/**
 * Tolerant file parse: a hand-edited or partially-written file must not
 * 500 every read — garbage becomes an empty notebook (the honest
 * absence the card already renders).
 */
export function parseStampsFile(text: string): StampsFile {
  const empty: StampsFile = { version: 1, stamps: [] };
  if (!text) return empty;
  try {
    const parsed = JSON.parse(text) as Partial<StampsFile> | null;
    if (!parsed || typeof parsed !== "object") return empty;
    if (!Array.isArray(parsed.stamps)) return empty;
    const stamps: VerdictStamp[] = [];
    for (const raw of parsed.stamps) {
      const stamp = sanitizeStamp(raw);
      if (stamp) stamps.push(stamp);
    }
    return { version: 1, stamps: trimStamps(stamps) };
  } catch {
    return empty;
  }
}

export function serializeStampsFile(stamps: VerdictStamp[]): string {
  return JSON.stringify(
    { version: 1, stamps: trimStamps(stamps) } satisfies StampsFile,
    null,
    2
  );
}
