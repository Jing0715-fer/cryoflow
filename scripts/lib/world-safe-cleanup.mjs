// Task 414 — the world-safe cleanup law: a suite's cluster-side cleanup may
// kill its OWN residue and the staging dirs (micrographs, _staged), but never
// the shared world's job workdirs.
//
// THE INCIDENT THAT WROTE THIS (2026-09-28, the exec-audit.log testimony):
// fifteen suites carried cleanup globs like
//     rm -rf /projects/cryoflow/*/extract_*
// whose blast radius is EVERY project on the mock cluster. The t413 window's
// own t30 batch ran at 23:34 UTC and the glob ate the demo tutorial chain's
// ancestral workdirs — extract_ptt0ybmw (with its particle stack — the select
// star's refs point INTO it), import_dlv9sxf8, the chain's autopick/class2d/
// motioncorr dirs — across all 27 project trees. t313 had passed at 22:35
// (the stack alive); at 23:34 the t30 batch killed it; t413's window closed
// without re-running t31, so the wound went unnoticed until this window's
// family re-run heard the case. The glob's intent was honest ("the t30
// batch's own residue proved no suite burned those" — staging leftovers
// whose names a crashed run never recorded), but its scope was the whole
// world. The t245 one-project law for canvas fixtures, applied to the
// cluster tree: a suite cleans up its own name — the world's names are
// resolved at RUNTIME, never assumed (the t313 de-fossilization doctrine,
// cleanup division).
//
// THE LAW: a workdir basename is protectable iff the product's own API
// speaks a live job for it — `type_` + the job id's last 8 chars (the
// workdir naming law every suite already uses to CONSTRUCT the names).
// The staging dirs (plain `micrographs`, `_staged`) are not job-shaped and
// always die, exactly as before. A crashed run's own orphaned workdirs
// (its jobs deleted by a later world-hygiene pass) lose protection the
// moment the API stops speaking them — residue law, not world law.

/** The protect set, derived at runtime from the product's jobs API.
 * Every job the world currently speaks (minus the suite's own created ids —
 * their workdirs SHOULD die) becomes a protected basename. Call it in the
 * suite's finally, AFTER the created jobs have been deleted (the API then
 * speaks only survivors — but passing createdIds makes the call honest even
 * when the delete ran after or failed). */
export function worldProtectBasenames(jobs, excludeIds = []) {
  const ex = new Set(excludeIds);
  const out = [];
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j?.id || !j?.type || ex.has(j.id)) continue;
    out.push(`${j.type}_${j.id.slice(-8)}`);
  }
  return out;
}

/** Build the sh for a glob family, minus the protected basenames.
 * Returns ONE sh snippet (loop per pattern; unmatched globs are skipped by
 * the -d guard, the t309 lesson's cousin). An empty protect set degrades to
 * the plain rm the suites used to speak — the helper never widens a
 * deletion, only narrows it. */
export function worldSafeRmScript(patterns, protect) {
  const pats = (Array.isArray(patterns) ? patterns : [patterns]).filter(Boolean);
  if (!pats.length) return ": nothing to clean";
  const prot = [...new Set(Array.isArray(protect) ? protect : [])];
  const parts = pats.map((p) => {
    if (!prot.length) return `rm -rf -- ${p} 2>/dev/null || true`;
    return [
      `for d in ${p}; do`,
      `[ -d "$d" ] || continue;`,
      `case "$(basename "$d")" in ${prot.join("|")}) continue ;; esac;`,
      `rm -rf -- "$d";`,
      `done`,
    ].join(" ");
  });
  return parts.join("; ");
}

/** The loud line: a suite's cleanup prints this so the family log shows the
 * shield was armed (a guard nobody can see is a guard nobody trusts). */
export function worldGuardLine(protectCount, what = "world workdirs") {
  return `  (world-guard) ${protectCount} ${what} shielded from the cleanup glob`;
}
