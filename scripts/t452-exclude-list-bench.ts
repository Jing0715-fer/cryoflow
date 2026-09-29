/**
 * t452 bench — the loser's list: the verdict's exclude door.
 *
 *   E1 (the name law): parseExcludeNames eats commas, newlines and
 *      semicolons in any mix, trims, drops empties, and collapses
 *      duplicates — a list is a set, not a log.
 *   E2 (the filter): rows whose _rlnMicrographName matches the list are
 *      dropped by exact name OR bare filename (the path-prefix drift the
 *      mock's own STARs exhibit); a different file that merely shares a
 *      directory survives; non-micrograph blocks (optics) ride through
 *      verbatim; the column law reads the RIGHT column when
 *      _rlnMicrographName is not first; counts and the missing roster
 *      are honest.
 *   E3 (the receipt): describeExcludeDoor speaks singular and plural
 *      wires and names — a receipt that can't count lies about graphs.
 *   E4 (the one-law bridge): what the dialog bakes (`names.join(", ")`)
 *      is byte-for-byte what the engine parses back — the same names
 *      enter the param and reach the filter.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  baseNameOf,
  describeExcludeDoor,
  filterMicrographStar,
  parseExcludeNames,
} from "../src/lib/exclude-list";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL — ${label}`);
  }
}

/* ------------------------------------------------------------------ */
/* fixtures                                                             */
/* ------------------------------------------------------------------ */

/** A motioncorr-shaped star: optics scalars ride through, the loop
 *  carries the micrograph names first. */
const SIMPLE_STAR = `data_optics

loop_
_rlnOpticsGroup
_rlnVoltage
1 300
2 300

data_micrographs

loop_
_rlnMicrographName
_rlnOpticsGroup
/data/movies/Falcon_01.mrcs 1
/data/movies/Falcon_02.mrcs 1
/data/movies/Falcon_03.mrcs 2
`;

/** The column law's fixture: the micrograph name is the SECOND column —
 *  a filter that guesses "first column" kills the wrong rows. */
const WIDE_STAR = `data_micrographs

loop_
_rlnVoltage
_rlnMicrographName
_rlnDefocusUVE
300 /data/mics/Mic_A.mrc 12000
300 /data/mics/Mic_B.mrc 13500
`;

/* ------------------------------------------------------------------ */
/* E1 — the name law                                                    */
/* ------------------------------------------------------------------ */

// E1a — comma list
must(JSON.stringify(parseExcludeNames("a.mrcs, b.mrcs, c.mrcs")) === JSON.stringify(["a.mrcs", "b.mrcs", "c.mrcs"]), "E1a comma list");
// E1b — newline list
must(parseExcludeNames("a.mrcs\nb.mrcs\nc.mrcs").length === 3, "E1b newline list");
// E1c — mixed separators + semicolons
must(parseExcludeNames("a.mrcs, b.mrcs; c.mrcs\nd.mrcs").length === 4, "E1c mixed separators");
// E1d — empties and whitespace drop
must(JSON.stringify(parseExcludeNames("  a.mrcs ,, \n\n b.mrcs \n")) === JSON.stringify(["a.mrcs", "b.mrcs"]), "E1d empties drop");
// E1e — duplicates collapse (first occurrence wins)
must(parseExcludeNames("a.mrcs, b.mrcs, a.mrcs").length === 2, "E1e dedupe");
// E1f — the empty param is an empty list
must(parseExcludeNames("").length === 0, "E1f empty param");
// E1g — whitespace-only param is an empty list
must(parseExcludeNames("  \n , \n ").length === 0, "E1g whitespace only");
// E1h — full paths pass through untouched (no basename mangling at parse)
must(JSON.stringify(parseExcludeNames("/data/x/Falcon_01.mrcs")) === JSON.stringify(["/data/x/Falcon_01.mrcs"]), "E1h paths intact");

/* ------------------------------------------------------------------ */
/* E2 — the filter                                                      */
/* ------------------------------------------------------------------ */

// E2a — exact full-path drop
const r1 = filterMicrographStar(SIMPLE_STAR, parseExcludeNames("/data/movies/Falcon_02.mrcs"));
must(r1.total === 3 && r1.dropped === 1 && r1.kept === 2, "E2a counts exact drop");
must(!r1.text.includes("Falcon_02"), "E2a excluded row gone");
must(r1.text.includes("Falcon_01") && r1.text.includes("Falcon_03"), "E2a survivors intact");
must(r1.missing.length === 0, "E2a nothing missing");

// E2b — the basename law: a bare filename in the list kills the full path
const r2 = filterMicrographStar(SIMPLE_STAR, parseExcludeNames("Falcon_02.mrcs"));
must(r2.dropped === 1 && !r2.text.includes("Falcon_02"), "E2b bare name kills full path");

// E2c — the basename law, reverse: a full path in the list kills a bare row
const BARE_STAR = "data_micrographs\n\nloop_\n_rlnMicrographName\nFalcon_01.mrcs 1\nFalcon_09.mrcs 1\n";
const r3 = filterMicrographStar(BARE_STAR, parseExcludeNames("/other/run/Falcon_01.mrcs"));
must(r3.dropped === 1 && r3.text.includes("Falcon_09"), "E2c full path kills bare row");

// E2d — a different file sharing the directory survives
const r4 = filterMicrographStar(SIMPLE_STAR, parseExcludeNames("/data/movies/Falcon_01.mrcs"));
must(r4.text.includes("Falcon_02") && r4.text.includes("Falcon_03"), "E2d sibling file survives");

// E2e — non-micrograph blocks ride through byte-identical (optics group)
must(r1.text.includes("data_optics") && r1.text.includes("_rlnOpticsGroup") && r1.text.includes("1 300"), "E2e optics block intact");

// E2f — the column law: name in the second column still filters right
const r5 = filterMicrographStar(WIDE_STAR, parseExcludeNames("/data/mics/Mic_A.mrc"));
must(r5.dropped === 1 && r5.kept === 1 && r5.text.includes("Mic_B"), "E2f column index honored");
must(!r5.text.includes("Mic_A"), "E2f right row dropped");

// E2g — an empty list drops nothing
const r6 = filterMicrographStar(SIMPLE_STAR, []);
must(r6.dropped === 0 && r6.kept === 3, "E2g empty list drops nothing");

// E2h — a name that matches nothing is REPORTED, not silently swallowed
const r7 = filterMicrographStar(SIMPLE_STAR, parseExcludeNames("/data/movies/Falcon_02.mrcs, Ghost.mrc"));
must(r7.missing.length === 1 && r7.missing[0] === "Ghost.mrc", "E2h missing roster names the ghost");
must(r7.dropped === 1, "E2h the real match still drops");

// E2i — the basename match does NOT report missing (Falcon_02 hit by basename)
const r8 = filterMicrographStar(SIMPLE_STAR, parseExcludeNames("/elsewhere/Falcon_02.mrcs"));
must(r8.missing.length === 0 && r8.dropped === 1, "E2i basename hit not missing");

// E2j — loop scaffolding survives verbatim (labels keep their order)
must(r1.text.includes("loop_") && r1.text.includes("_rlnMicrographName") && r1.text.includes("data_micrographs"), "E2j scaffolding intact");

// E2k — a multi-name list drops all of its matches at once
const r9 = filterMicrographStar(SIMPLE_STAR, parseExcludeNames("Falcon_01.mrcs, /data/movies/Falcon_03.mrcs"));
must(r9.dropped === 2 && r9.kept === 1 && r9.text.includes("Falcon_02"), "E2k batch drop");

// E2l — counts with an all-dropped list
const r10 = filterMicrographStar(SIMPLE_STAR, parseExcludeNames("Falcon_01.mrcs, Falcon_02.mrcs, Falcon_03.mrcs"));
must(r10.kept === 0 && r10.total === 3 && r10.dropped === 3, "E2l all dropped");

/* ------------------------------------------------------------------ */
/* E3 — the receipt                                                     */
/* ------------------------------------------------------------------ */

// E3a — singular wire, singular name
must(
  describeExcludeDoor(1, 1, "CTF (copy)") ===
    "Mints an Exclude Micrographs job consuming CTF (copy) with 1 name baked in, and re-wires 1 downstream wire to consume the filtered list — results stay until re-run.",
  "E3a singular receipt",
);
// E3b — plural wires and names
must(
  describeExcludeDoor(3, 2, "Motion Correction 1 (copy)").includes("with 3 names baked in") &&
    describeExcludeDoor(3, 2, "Motion Correction 1 (copy)").includes("re-wires 2 downstream wires"),
  "E3b plural receipt",
);
// E3c — the receipt always names the provider and the duty
must(
  describeExcludeDoor(2, 1, "X").includes("consuming X") && describeExcludeDoor(2, 1, "X").includes("results stay until re-run"),
  "E3c provider + duty present",
);

/* ------------------------------------------------------------------ */
/* E4 — the one-law bridge                                              */
/* ------------------------------------------------------------------ */

// E4a — the dialog's join(", ") round-trips through the engine's parse
const verdictNames = ["/data/movies/Falcon_01.mrcs", "Falcon_02.mrcs", "/data/movies/Falcon_03.mrcs"];
const baked = verdictNames.join(", ");
const parsed = parseExcludeNames(baked);
must(JSON.stringify(parsed) === JSON.stringify(verdictNames), "E4a bake → parse round-trip");

// E4b — the round-tripped list filters exactly what the verdict named
// (the fixture's THREE rows all appear in the verdict list — kept 0)
const r11 = filterMicrographStar(SIMPLE_STAR, parsed);
must(r11.dropped === 3 && r11.kept === 0, "E4b round-trip filters right");

// E4c — the basename helper is the law's shared root
must(baseNameOf("/data/x/Falcon_01.mrcs") === "Falcon_01.mrcs" && baseNameOf("Falcon_01.mrcs") === "Falcon_01.mrcs" && baseNameOf("C:\\data\\x.mrc") === "x.mrc", "E4c basename dialects");

/* ------------------------------------------------------------------ */

console.log(`\nt452 — the loser's list: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
