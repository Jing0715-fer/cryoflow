/**
 * t1115 — the import-receipt pins' re-key (the text-surgery law: a
 * formal script, never an inline regex injection). The words law's
 * cure moved the extent bytes into the lib's ONE father
 * (orthoPlateDirectionWalkExtentWord) and the button rides it — the
 * import lines and the receipt pins speak the final bytes:
 *   t1111-direction-dial-unit.mjs  E8 — the button rides the extent
 *     word seat (the words law's own shape), no coin in the panel
 *   t1104-oblique-plate-unit.mjs  W1 — the import lines' verbatim
 *     receipt, re-keyed to the final bytes (the t1108 family-growth
 *     re-key precedent, reason named in the pin text)
 *   t1112-direction-walk-paper-unit.mjs  U4 — the import receipts
 *     grow the extent word seat (the receipt list's own growth)
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const REPO = "/home/z/my-project";

const JOBS = [
  {
    file: `${REPO}/scripts/t1111-direction-dial-unit.mjs`,
    swaps: [
      [
        `ok(
  "E8 the button speaks the extent word and rides DIRECTION_STATIONS — no second six",
  panelSrc.includes("frames, around the box") &&
    panelSrc.includes("\${DIRECTION_STATIONS} frames, around the box")
);`,
        `ok(
  "E8 the button rides the extent word's ONE father — orthoPlateDirectionWalkExtentWord(DIRECTION_STATIONS) in the aria, the words law's own shape (no coin in the panel's code; the t1115 words-cure re-key — the raw coin left the panel, the lib's seat speaks)",
  panelSrc.includes(
    "orthoPlateDirectionWalkExtentWord(DIRECTION_STATIONS)"
  ) && panelSrc.includes("orthoPlateDirectionWalkExtentWord(n)")
);`,
      ],
    ],
  },
  {
    file: `${REPO}/scripts/t1104-oblique-plate-unit.mjs`,
    swaps: [
      [
        `'import { orthoAxisWalkHeading, orthoPlateDirectionCurrentLegend, orthoPlateDirectionWalkMetaLine, orthoPlateMetaLine, orthoPlateObliqueCurrentLegend, orthoPlateTileUrl, orthoPlateWalkCurrentLegend, orthoPlateWalkMetaLine, orthoWalkFrameCaption, planOrthoPlate, planPlateHistogram, PLATE_HIST_INKS, type PlateHistPayload } from "@/lib/ortho-plate"'`,
        `'import { orthoAxisWalkHeading, orthoPlateDirectionCurrentLegend, orthoPlateDirectionWalkExtentWord, orthoPlateDirectionWalkMetaLine, orthoPlateMetaLine, orthoPlateObliqueCurrentLegend, orthoPlateTileUrl, orthoPlateWalkCurrentLegend, orthoPlateWalkMetaLine, orthoWalkFrameCaption, planOrthoPlate, planPlateHistogram, PLATE_HIST_INKS, type PlateHistPayload } from "@/lib/ortho-plate"'`,
      ],
      [
        `'import { FILMSTRIP_FRAMES, obliqueDirectionWalkCurrentIndex, obliqueDirectionWalkUrls, obliqueFilmstripFilename, obliqueFilmstripUrls, obliqueWalkCurrentIndex, planObliqueDirectionWalk, planObliqueFilmstrip } from "@/lib/oblique-filmstrip"'`,
        `'import { DIRECTION_STATIONS, FILMSTRIP_FRAMES, obliqueDirectionWalkCurrentIndex, obliqueDirectionWalkFilename, obliqueDirectionWalkUrls, obliqueFilmstripFilename, obliqueFilmstripUrls, obliqueWalkCurrentIndex, planObliqueDirectionWalk, planObliqueFilmstrip } from "@/lib/oblique-filmstrip"'`,
      ],
      [
        "W1 the panel imports the walk page's words from the ONE plate lib (the t1107/t1108 legends join the family; the t1112 direction page's extent + legend joined the line) and the geometry from the ONE walk lib (the t1108 frac seat joins; the t1111 direction seats + the t1112 direction URL edition joined the line — the family-growth re-key)",
        "W1 the panel imports the walk page's words from the ONE plate lib (the t1107/t1108 legends join the family; the t1112 direction page's extent + legend joined the line; the t1115 extent word seat joined — the words law's ONE father for the export button) and the geometry from the ONE walk lib (the t1108 frac seat joins; the t1111 direction seats + the t1112 direction URL edition + the t1115 filename edition joined the line — the family-growth re-key, third named)",
      ],
    ],
  },
  {
    file: `${REPO}/scripts/t1112-direction-walk-paper-unit.mjs`,
    swaps: [
      [
        `"orthoPlateDirectionCurrentLegend, orthoPlateDirectionWalkMetaLine, orthoPlateMetaLine"`,
        `"orthoPlateDirectionCurrentLegend, orthoPlateDirectionWalkExtentWord, orthoPlateDirectionWalkMetaLine, orthoPlateMetaLine"`,
      ],
      [
        `"obliqueDirectionWalkCurrentIndex, obliqueDirectionWalkUrls, obliqueFilmstripFilename"`,
        `"obliqueDirectionWalkCurrentIndex, obliqueDirectionWalkFilename, obliqueDirectionWalkUrls, obliqueFilmstripFilename"`,
      ],
      [
        "U4 the import receipts — orthoPlateDirectionWalkMetaLine + orthoPlateDirectionCurrentLegend + obliqueDirectionWalkUrls join the panel's import lines",
        "U4 the import receipts — orthoPlateDirectionWalkMetaLine + orthoPlateDirectionCurrentLegend + obliqueDirectionWalkUrls join the panel's import lines (the t1115 re-key: the extent word seat + the filename edition joined the same lines, the receipts speak the final bytes)",
      ],
    ],
  },
  {
    file: `${REPO}/scripts/t1106-axis-plate-unit.mjs`,
    swaps: [
      [
        `'import { orthoAxisWalkHeading, orthoPlateDirectionCurrentLegend, orthoPlateDirectionWalkMetaLine, orthoPlateMetaLine, orthoPlateObliqueCurrentLegend, orthoPlateTileUrl, orthoPlateWalkCurrentLegend, orthoPlateWalkMetaLine, orthoWalkFrameCaption, planOrthoPlate, planPlateHistogram, PLATE_HIST_INKS, type PlateHistPayload } from "@/lib/ortho-plate"'`,
        `'import { orthoAxisWalkHeading, orthoPlateDirectionCurrentLegend, orthoPlateDirectionWalkExtentWord, orthoPlateDirectionWalkMetaLine, orthoPlateMetaLine, orthoPlateObliqueCurrentLegend, orthoPlateTileUrl, orthoPlateWalkCurrentLegend, orthoPlateWalkMetaLine, orthoWalkFrameCaption, planOrthoPlate, planPlateHistogram, PLATE_HIST_INKS, type PlateHistPayload } from "@/lib/ortho-plate"'`,
      ],
      [
        "W1 the panel imports the axis page's words from the ONE plate lib (orthoAxisWalkHeading and the t1107/t1108 legends ride the family line; the t1112 direction page's extent + legend joined the line — the family-growth re-key, reason named) and the geometry from the ONE strip lib (the plan families plus the t1107/t1108 current seats)",
        "W1 the panel imports the axis page's words from the ONE plate lib (orthoAxisWalkHeading and the t1107/t1108 legends ride the family line; the t1112 direction page's extent + legend joined the line; the t1115 extent word seat joined — the words law's ONE father — the family-growth re-key, third named) and the geometry from the ONE strip lib (the plan families plus the t1107/t1108 current seats)",
      ],
    ],
  },
];

for (const job of JOBS) {
  const short = job.file.split("/").pop();
  let src = readFileSync(job.file, "utf8");
  // idempotency by MARKER (the new bytes' own fingerprint) — append-type
  // swaps contain their own old anchor, a swap-count guard would misfire
  const MARKERS = {
    "t1111-direction-dial-unit.mjs": "the t1115 words-cure re-key",
    "t1104-oblique-plate-unit.mjs": "the family-growth re-key, third named",
    "t1112-direction-walk-paper-unit.mjs": "the t1115 re-key: the extent word seat",
    "t1106-axis-plate-unit.mjs": "the family-growth re-key, third named",
  };
  if (MARKERS[short] && src.includes(MARKERS[short])) {
    console.log(`${short}: already re-keyed`);
    continue;
  }
  let n = 0;
  for (const [oldS, newS] of job.swaps) {
    const c = src.split(oldS).length - 1;
    if (c > 0) {
      src = src.split(oldS).join(newS);
      n += c;
    }
  }
  if (n === 0) {
    console.log(`${short}: already re-keyed`);
    continue;
  }
  if (n < job.swaps.length) {
    console.error(`FATAL ${short}: ${n}/${job.swaps.length} swaps landed — the anchors moved`);
    process.exit(1);
  }
  writeFileSync(job.file, src);
  console.log(`${short}: ${n} swaps landed`);
}
console.log("import receipts re-keyed");
