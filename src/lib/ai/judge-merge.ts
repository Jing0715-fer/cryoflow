/**
 * judge-merge — the two-pass verdict merge (t545).
 *
 * The field test's finding (t519, phase B): edge classes flip between
 * keep and maybe across runs — 7 of 11 borderline classes changed sides
 * between fresh sessions while the keep core (4/5) held. A judge that
 * cannot agree with itself is worse than no judge, so the judge now
 * reads the SAME sheet TWICE with the SAME rubric and ships only what
 * survives both reads:
 *
 *   keep   = keep in pass 1 AND pass 2          (the intersection —
 *                                                every shipped keep is
 *                                                a twice-confirmed keep)
 *   reject = reject in both passes              (same doctrine, junk side)
 *   maybe  = everything else — any disagreement lands in the honest
 *            uncertainty band, where the rubric already says torn
 *            verdicts belong ("When genuinely torn between keep and
 *            reject, say maybe — do not flip-flop")
 *
 * The merge is structural, not probabilistic: it does not gamble on a
 * provider honoring a temperature knob (the bundled SDK's vision body
 * carries no temperature field), it makes the evidence bar for "keep"
 * twice as high. The cost is one extra VLM round per judge call — a
 * price paid only on an explicitly user-initiated analysis.
 *
 * A confirm pass that fails to parse (or comes back empty) degrades to
 * the first verdict — never to silence; the caller marks it honestly.
 */

export interface JudgeVerdict {
  classes: { cls: number; verdict: string; reason: string }[];
  advice: string;
}

export interface JudgePassMergeMove {
  cls: number;
  from: string;
  to: string;
}

export interface JudgePassMerge {
  /** the merged verdict — what the judge ships */
  verdict: JudgeVerdict;
  /** classes where both passes agreed AND kept their first-pass verdict */
  agreed: number;
  /** classes where the two passes disagreed (all land in maybe) */
  torn: number;
  /** classes named by only one pass (an unconfirmed read is a maybe) */
  missing: number;
  /** per-class first-verdict → final-verdict moves (stability telemetry) */
  moved: JudgePassMergeMove[];
  /** true when pass 2 parsed but named zero classes — nothing to confirm
   *  against, so the caller keeps pass 1 untouched */
  degenerate: boolean;
}

/**
 * Merge two independent reads of the same sheet. Verdict strings are
 * compared verbatim (the parser already lowercases); agreement ships the
 * first read's reason, disagreement ships the SECOND read's reason — the
 * dissent is why the class lost its confident verdict. Advice stays the
 * first read's (the confirm pass judges classes, not prose).
 */
export function mergeJudgePasses(a: JudgeVerdict, b: JudgeVerdict): JudgePassMerge {
  const first = new Map(a.classes.map((c) => [c.cls, c]));
  const second = new Map(b.classes.map((c) => [c.cls, c]));

  // degenerate confirm: parsed but named nothing — keep pass 1 untouched
  if (b.classes.length === 0) {
    return { verdict: a, agreed: 0, torn: 0, missing: 0, moved: [], degenerate: true };
  }

  const clsKeys = [...new Set([...first.keys(), ...second.keys()])].sort((x, y) => x - y);
  const classes: JudgeVerdict["classes"] = [];
  const moved: JudgePassMergeMove[] = [];
  let agreed = 0;
  let torn = 0;
  let missing = 0;

  for (const cls of clsKeys) {
    const p1 = first.get(cls);
    const p2 = second.get(cls);
    if (p1 && p2) {
      if (p1.verdict === p2.verdict) {
        classes.push({ cls, verdict: p1.verdict, reason: p1.reason });
        agreed++;
      } else {
        classes.push({ cls, verdict: "maybe", reason: p2.reason });
        torn++;
      }
    } else {
      // every cls key came from one of the maps — at least one side exists
      const only = p1 ?? p2 ?? { cls, verdict: "maybe", reason: "" };
      classes.push({ cls, verdict: "maybe", reason: only.reason });
      missing++;
    }
    const finalV = classes[classes.length - 1].verdict;
    if (p1 && finalV !== p1.verdict) {
      moved.push({ cls, from: p1.verdict, to: finalV });
    }
  }

  return { verdict: { classes, advice: a.advice }, agreed, torn, missing, moved, degenerate: false };
}
