/**
 * CryoFlow — the postprocess verdict domain module (t457).
 *
 * The compare family's SIXTH question — and the third that pairs one run
 * with ITSELF. t454 asked a classification "did you settle", t456 asked a
 * refinement "are you still sharpening"; this one asks a postprocess the
 * honesty question: "is the final number TRUE — what did the mask buy,
 * and did the phase-randomization correction claw the flattery back?"
 *
 * The data plane is the job's own postprocess.star, already parsed by the
 * FSC route (four curves per shell + the data_general trio). Read as
 * crossings on the resolution axis, the curves ARE the story:
 *
 *   unmasked   the halves' naked word — solvent noise drags it down;
 *              its 0.143 crossing is the "no mask" truth
 *   corrected  the OFFICIAL curve (masked, phase-rand-corrected) — its
 *              crossing is _rlnFinalResolution, the number the record
 *              speaks
 *   masked     the RAW masked curve — the flattery before the correction;
 *              it always crosses finer than the official one
 *   box edge   2x angpix — no honest estimate beats it, ever
 *
 * The laws (domain-local):
 *   - THE GIFT IS A DISTANCE: maskGift = unmaskedCrossing - official (in
 *     Å; how much resolution the whole mask+correction pipeline bought
 *     over the naked halves). A tiny gift is honest; a huge one usually
 *     means an over-tight mask inflating the correlation.
 *   - THE CLAW IS THE CORRECTION'S WORK: clawBack = rawMaskedCrossing -
 *     official — how much flattery the phase-randomization correction
 *     removed. Without it the record would have spoken the raw mask's
 *     number.
 *   - THE BOX OWNS THE CEILING: official < 2x angpix is physics, not
 *     style. A crossing beyond the box edge is not a resolution — the
 *     verdict refuses to dress it as one.
 *   - THE B-FACTOR IS A DIAL WITH A WEATHER REPORT: the sharpening
 *     strength gets words, not just a number — gentle enough to trust,
 *     strong enough to watch, aggressive enough to expect noise.
 */

/** One shell's verdict-relevant fields (a superset-safe slice of the
 *  FSC route's FscShell — structural, no route import). */
export interface VerdictShell {
  /** spatial frequency in 1/Å */
  freq: number;
  /** the head curve the route keeps: unmasked when present */
  fsc: number;
  /** masked + phase-corrected — the official criterion curve */
  correctedFsc?: number;
  /** raw masked-maps FSC before correction (the flattery) */
  maskedFsc?: number;
}

/** The data_general trio the FSC route reads off the same star. */
export interface PostprocessGeneral {
  finalResolution: number | null;
  bfactor: number | null;
  angpix: number | null;
}

/** What the brain eats — the FSC route's response shape, mirrored. */
export interface VerdictInput {
  shells: readonly VerdictShell[];
  postprocessGeneral?: PostprocessGeneral | null;
}

/* ------------------------------------------------------------------ */
/* The threshold — RELION's gold-standard criterion, one constant.     */
/* ------------------------------------------------------------------ */

export const FSC_CRITERION = 0.143;

/* The verdict's own bands (Å) — the gift's honesty vocabulary. */
/** Below this the mask's gift is noise-level: the estimate is what the
 *  halves already said. */
export const GIFT_MODEST_ANGSTROM = 0.3;
/** Above this the mask is buying a lot — check it for over-tightening. */
export const GIFT_GENEROUS_ANGSTROM = 1.5;

/* The B-factor's weather bands (|B| in Å²). */
export const BFACTOR_GENTLE = 50;
export const BFACTOR_STRONG = 110;

/* ------------------------------------------------------------------ */
/* The crossing — linear interpolation of a curve's 0.143 descent.     */
/* ------------------------------------------------------------------ */

/**
 * The Å value where a curve descends through the threshold, linearly
 * interpolated between the straddling shells. Null when the curve never
 * crosses inside the table (a curve that stays above says "the estimate
 * lives past this table" — the verdict treats that as its own word).
 */
export function crossingOf(
  points: readonly { freq: number; value: number }[],
  threshold: number = FSC_CRITERION
): number | null {
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    if (!(a.freq > 0) || !(b.freq > 0)) continue;
    if (a.value >= threshold && b.value < threshold) {
      const denom = a.value - b.value;
      if (denom <= 0) continue;
      const t = (a.value - threshold) / denom;
      const freq = a.freq + t * (b.freq - a.freq);
      if (freq > 0) return 1 / freq;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* The B-factor's weather report                                       */
/* ------------------------------------------------------------------ */

export interface SharpeningRead {
  word: "gentle" | "strong" | "aggressive";
  detail: string;
}

/**
 * Words for the sharpening dial. The B-factor amplifies high frequencies
 * by exp(-B·f²/4); its magnitude — not its sign (RELION's convention is
 * negative for sharpening) — picks the weather.
 */
export function sharpeningRead(bfactor: number | null): SharpeningRead | null {
  if (bfactor == null || !Number.isFinite(bfactor)) return null;
  const mag = Math.abs(bfactor);
  if (mag < BFACTOR_GENTLE) {
    return {
      word: "gentle",
      detail:
        `a gentle ${bfactor.toFixed(1)} Å² — the map stays close to its raw contrast`,
    };
  }
  if (mag <= BFACTOR_STRONG) {
    return {
      word: "strong",
      detail:
        `a strong ${bfactor.toFixed(1)} Å² — high frequencies are amplified; the map owes its crispness to this dial`,
    };
  }
  return {
    word: "aggressive",
    detail:
      `an aggressive ${bfactor.toFixed(1)} Å² — expect amplified noise riding the sharpened high frequencies`,
  };
}

/* ------------------------------------------------------------------ */
/* The verdict                                                         */
/* ------------------------------------------------------------------ */

export type VerdictWord =
  | "honest"
  | "modest gift"
  | "generous gift"
  | "mask-carried"
  | "beyond the box";

export interface PostprocessVerdict {
  /** the official number (data_general's word, falling back to the
   *  corrected curve's own crossing) */
  official: number;
  /** the naked halves' crossing — null when the unmasked curve never
   *  crosses inside the table */
  unmasked: number | null;
  /** the raw mask's crossing (the flattery) — null likewise */
  rawMasked: number | null;
  /** the box edge (2x angpix) — null when the star carries no pixel size */
  nyquist: number | null;
  /** how much the pipeline bought over the naked halves (Å) */
  maskGift: number | null;
  /** how much flattery the correction clawed back (Å) */
  clawBack: number | null;
  /** the word the verdict wears */
  word: VerdictWord;
  /** the evidence line under the word */
  detail: string;
  /** the face's headline */
  headline: string;
  /** the sharpening dial's weather report */
  sharpening: SharpeningRead | null;
}

const fmt = (v: number): string => v.toFixed(1);

/**
 * The honesty read. Null unless the input is genuinely a postprocess
 * table: at least two shells AND a corrected curve on at least two of
 * them (a model-star FSC has no corrected column — no verdict to give).
 */
export function postprocessVerdictOf(
  input: VerdictInput
): PostprocessVerdict | null {
  // ascending frequency — the crossings walk the curve in order, and a
  // defensive sort costs nothing (the route feeds sorted shells; the
  // brain refuses to depend on it)
  const shells = input.shells
    .filter(
      (s) => Number.isFinite(s.freq) && s.freq > 0 && Number.isFinite(s.fsc)
    )
    .sort((a, b) => a.freq - b.freq);
  const corrected = shells.filter(
    (s) => s.correctedFsc != null && Number.isFinite(s.correctedFsc)
  );
  if (shells.length < 2 || corrected.length < 2) return null;

  const correctedCrossing = crossingOf(
    corrected.map((s) => ({ freq: s.freq, value: s.correctedFsc as number }))
  );
  const unmaskedCrossing = crossingOf(
    shells.map((s) => ({ freq: s.freq, value: s.fsc }))
  );
  const maskedPoints = shells.filter(
    (s) => s.maskedFsc != null && Number.isFinite(s.maskedFsc)
  );
  const rawMaskedCrossing =
    maskedPoints.length >= 2
      ? crossingOf(
          maskedPoints.map((s) => ({ freq: s.freq, value: s.maskedFsc as number }))
        )
      : null;

  // the official number: the star's own word first, the curve's crossing
  // as the honest fallback (they agree by construction in real RELION —
  // _rlnFinalResolution IS the corrected curve's 0.143 crossing)
  const official =
    input.postprocessGeneral?.finalResolution != null &&
    Number.isFinite(input.postprocessGeneral.finalResolution) &&
    (input.postprocessGeneral.finalResolution as number) > 0
      ? (input.postprocessGeneral.finalResolution as number)
      : correctedCrossing;
  if (official == null) return null;

  const angpix = input.postprocessGeneral?.angpix ?? null;
  const nyquist =
    angpix != null && Number.isFinite(angpix) && angpix > 0 ? 2 * angpix : null;

  const maskGift =
    unmaskedCrossing != null ? unmaskedCrossing - official : null;
  // the claw is the flattery's SIZE: the raw mask crosses FINER than the
  // official number (smaller Å), so the correction's work is the official
  // word minus the raw word — positive when the correction did its job
  const clawBack =
    rawMaskedCrossing != null ? official - rawMaskedCrossing : null;

  // ---- the word ----
  let word: VerdictWord;
  let detail: string;
  if (nyquist != null && official < nyquist) {
    word = "beyond the box";
    detail =
      `${fmt(official)} Å is finer than the box edge (${fmt(nyquist)} Å at ${angpix?.toFixed(2)} Å/px) — ` +
      `no honest postprocess can claim it; check the star's pixel size and the FSC table`;
  } else if (unmaskedCrossing == null) {
    word = "mask-carried";
    detail =
      `the unmasked halves never cross ${FSC_CRITERION} inside this table — ` +
      `the mask carries the entire ${fmt(official)} Å estimate; treat the number as the mask's word, not the halves'`;
  } else if (maskGift != null && maskGift < 0) {
    word = "honest";
    detail =
      `the unmasked halves cross finer than the corrected curve (${fmt(unmaskedCrossing)} Å vs ${fmt(official)} Å) — ` +
      `an unusual read; the mask's correction cost more than it bought, and the number stays the halves' own`;
  } else if (maskGift != null && maskGift <= GIFT_MODEST_ANGSTROM) {
    word = "honest";
    detail =
      `the mask bought ${maskGift.toFixed(1)} Å over the naked halves (${fmt(unmaskedCrossing)} Å → ${fmt(official)} Å) — ` +
      `the estimate is what the halves already said`;
  } else if (maskGift != null && maskGift <= GIFT_GENEROUS_ANGSTROM) {
    word = "modest gift";
    detail =
      `the mask bought ${maskGift.toFixed(1)} Å (${fmt(unmaskedCrossing)} Å unmasked → ${fmt(official)} Å official) — ` +
      `a real gift, in the range a well-fit solvent mask earns`;
  } else {
    word = "generous gift";
    detail =
      `the mask bought ${maskGift?.toFixed(1)} Å (${fmt(unmaskedCrossing)} Å unmasked → ${fmt(official)} Å official) — ` +
      `a big gift; check the mask for over-tightening, which inflates the correlation it then reports`;
  }

  // the claw line rides under every word — the correction's own work;
  // the word's own sentence gets its period here so the two read as two
  if (clawBack != null && rawMaskedCrossing != null && word !== "beyond the box") {
    detail +=
      `${detail.endsWith(".") ? " " : ". "}The raw mask crossed at ${fmt(rawMaskedCrossing)} Å; ` +
      `the phase-randomization correction clawed ${clawBack.toFixed(1)} Å of that flattery back.`;
  }

  const parts: string[] = [`${fmt(official)} Å final (masked, corrected)`];
  if (unmaskedCrossing != null) parts.push(`unmasked halves said ${fmt(unmaskedCrossing)} Å`);
  if (rawMaskedCrossing != null) parts.push(`the raw mask flattered ${fmt(rawMaskedCrossing)} Å`);

  return {
    official,
    unmasked: unmaskedCrossing,
    rawMasked: rawMaskedCrossing,
    nyquist,
    maskGift,
    clawBack,
    word,
    detail,
    headline: parts.join(" — "),
    sharpening: sharpeningRead(input.postprocessGeneral?.bfactor ?? null),
  };
}
