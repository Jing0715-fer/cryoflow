#!/usr/bin/env python3
"""t1120 — the interval readout's voxel voice (three knives, counted).

The clip panel's axis rows (slider language) read "33–41%" today; the
slab tool's users think in voxels. The t905 boundary paragraph kept the
clip family fraction-voiced because an OBLIQUE cut or an ANCHORED BOX has
no single honest address along an axis — but the slider language's axis
rows DO (the same geometry the slice family voices). This knife amends
the boundary to that refined law and mints ONE lib word:

  voxelIntervalReadout(lo, hi, dim) -> "21–26/64" | null

  knife 1  lib: boundary paragraph amended (oblique/box keep fractions;
           axis rows speak the address)
  knife 2  lib: the word minted after obliqueCutAnnotation (family lib
           only — the word law)
  knife 3  embed: import + per-row vox const + the readout span rides
           the voice (w-14 -> w-24, vox in opacity-70, a title)

Every knife: exact-string anchor, count==want assertion, idempotent
(a sentinel check runs first; re-running is a no-op).
"""
import pathlib
import sys

ROOT = pathlib.Path("/home/z/my-project")
LIB = ROOT / "src/lib/voxel-voice.ts"
EMB = ROOT / "src/components/workflow/results/molstar-embed.tsx"

errors: list[str] = []


def anchored_replace(text: str, anchor: str, want: int, old: str, new: str, label: str) -> str:
    n = text.count(anchor)
    if n != want:
        errors.append(f"{label}: anchor count {n} != {want}")
        return text
    if new in text and old in text:
        # already applied AND still has the old form — ambiguous; refuse
        errors.append(f"{label}: both old and new present")
        return text
    if old not in text:
        errors.append(f"{label}: old form absent (idempotent re-run?)")
        return text
    return text.replace(old, new, 1)


# ---------------- knife 1: the boundary paragraph ----------------
lib_text = LIB.read_text()
SENTINEL1 = "voxelIntervalReadout"
SENTINEL_B = "t1120 the SLIDER language's axis rows join the voxel family"
if SENTINEL_B in lib_text and SENTINEL1 in lib_text:
    print("knife 1+2: sentinels present — lib already carries both (idempotent skip)")
elif SENTINEL1 in lib_text and SENTINEL_B not in lib_text:
    # a partial earlier run wrote the word but not the boundary — finish
    # the boundary only, never append the word twice
    B_ANCHOR = (
        " *     honest address). This module speaks for the SLICE family — and,\n"
        " *     since t907, for the OBLIQUE cut's DEPTH address (voxels along the\n"
        " *     cut's own normal — the one honest position a plane without an axis\n"
        " *     can have). The clip EXTENT fractions stay fraction-voiced.\n"
        " */"
    )
    B_NEW = (
        " *     honest address). This module speaks for the SLICE family — and,\n"
        " *     since t907, for the OBLIQUE cut's DEPTH address (voxels along the\n"
        " *     cut's own normal — the one honest position a plane without an axis\n"
        " *     can have). The clip's OBLIQUE cut and ANCHORED-BOX language stay\n"
        " *     fraction-voiced — no single honest address along an axis. Since\n"
        " *     t1120 the SLIDER language's axis rows join the voxel family: a\n"
        " *     kept interval on a NAMED axis is the same geometry the slice\n"
        " *     voices speak, so its readout rides voxelIntervalReadout.\n"
        " */"
    )
    lib_text = anchored_replace(lib_text, B_ANCHOR, 1, B_ANCHOR, B_NEW, "knife 1 boundary (repair pass)")
    if not errors:
        LIB.write_text(lib_text)
        print("knife 1 (repair): boundary amended; word already present")
elif not errors:
    B_ANCHOR = (
        " *     honest address). This module speaks for the SLICE family — and,\n"
        " *     since t907, for the OBLIQUE cut's DEPTH address (voxels along the\n"
        " *     cut's own normal — the one honest position a plane without an axis\n"
        " *     can have). The clip EXTENT fractions stay fraction-voiced.\n"
        " */"
    )
    B_NEW = (
        " *     honest address). This module speaks for the SLICE family — and,\n"
        " *     since t907, for the OBLIQUE cut's DEPTH address (voxels along the\n"
        " *     cut's own normal — the one honest position a plane without an axis\n"
        " *     can have). The clip's OBLIQUE cut and ANCHORED-BOX language stay\n"
        " *     fraction-voiced — no single honest address along an axis. Since\n"
        " *     t1120 the SLIDER language's axis rows join the voxel family: a\n"
        " *     kept interval on a NAMED axis is the same geometry the slice\n"
        " *     voices speak, so its readout rides voxelIntervalReadout.\n"
        " */"
    )
    lib_text = anchored_replace(lib_text, B_ANCHOR, 1, B_ANCHOR, B_NEW, "knife 1 boundary")
    if errors:
        for e in errors:
            print("ERROR:", e)
        sys.exit(1)  # lib must never be written half-knifed

    WORD = '''
/** The clip interval's readout voice — the kept extent's voxel address:
 * "21–26/64" (1-based, inclusive — the tiles' convention), or null when
 * the grid is unknown (the call site keeps its bare percent: the
 * fallback is the OLD voice, not a wrong one). The SLIDER language's
 * axis rows only — an oblique cut or an anchored box has no honest
 * address along a named axis (the boundary paragraph above). Both ends
 * ride the ONE formula (voxelIndexOf's round), so the address agrees
 * with every plane voice the panel already speaks. Pure. */
export function voxelIntervalReadout(
  lo: number,
  hi: number,
  dim: number | null | undefined
): string | null {
  if (typeof dim !== "number" || !Number.isFinite(dim) || !Number.isInteger(dim) || dim <= 1) {
    return null;
  }
  const a = voxelIndexOf(lo, dim);
  const b = voxelIndexOf(hi, dim);
  if (a === null || b === null || b < a) return null;
  return `${a + 1}–${b + 1}/${dim}`;
}
'''
    lib_text = lib_text.rstrip("\n") + "\n" + WORD
    LIB.write_text(lib_text)
    print("knife 1+2: boundary amended + word minted")


# ---------------- knife 3: the embed's readout ----------------
emb_text = EMB.read_text()
SENTINEL3 = "voxelIntervalReadout(lo, hi,"
if SENTINEL3 in emb_text:
    print("knife 3: sentinel present — embed already rides the voice (idempotent skip)")
else:
    I_OLD = 'voxelAriaText, voxelAnnotation, voxelIndexOf, voxelPlaneVoice, voxelSliderVoice } from "@/lib/voxel-voice"'
    I_NEW = 'voxelAriaText, voxelAnnotation, voxelIndexOf, voxelIntervalReadout, voxelPlaneVoice, voxelSliderVoice } from "@/lib/voxel-voice"'
    emb_text = anchored_replace(emb_text, I_OLD, 1, I_OLD, I_NEW, "knife 3 import")

    R_OLD = (
        "                ).map(([ax, axisIdx]) => {\n"
        "                  const [lo, hi] = keptIntervalOf(clipStateRef.current, axisIdx);\n"
        "                  const full = lo <= 0.001 && hi >= 0.999;\n"
    )
    R_NEW = (
        "                ).map(([ax, axisIdx]) => {\n"
        "                  const [lo, hi] = keptIntervalOf(clipStateRef.current, axisIdx);\n"
        "                  const full = lo <= 0.001 && hi >= 0.999;\n"
        "                  // t1120 — the slab speaks voxels: the kept extent's\n"
        "                  // address rides the ONE formula (voxel-voice), null\n"
        "                  // when the grid is unknown (the bare percent stays\n"
        "                  // the honest fallback); full rows keep their —\n"
        "                  const vox = full\n"
        "                    ? null\n"
        "                    : voxelIntervalReadout(lo, hi, clipBox()?.dims?.[axisIdx] ?? null);\n"
    )
    emb_text = anchored_replace(emb_text, R_OLD, 1, R_OLD, R_NEW, "knife 3 vox const")

    S_OLD = (
        "                      <span\n"
        "                        className=\"w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground\"\n"
        "                        data-testid={`clip-interval-${ax.toLowerCase()}`}\n"
        "                      >\n"
        "                        {full ? \"—\" : `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`}\n"
        "                      </span>"
    )
    S_NEW = (
        "                      <span\n"
        "                        className=\"w-24 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground\"\n"
        "                        data-testid={`clip-interval-${ax.toLowerCase()}`}\n"
        "                        title={vox ? `voxel planes ${vox} along ${ax.toLowerCase()}` : undefined}\n"
        "                      >\n"
        "                        {full ? (\n"
        "                          \"—\"\n"
        "                        ) : (\n"
        "                          <>\n"
        "                            {Math.round(lo * 100)}–{Math.round(hi * 100)}%\n"
        "                            {vox && <span className=\"opacity-70\"> · {vox}</span>}\n"
        "                          </>\n"
        "                        )}\n"
        "                      </span>"
    )
    emb_text = anchored_replace(emb_text, S_OLD, 1, S_OLD, S_NEW, "knife 3 span")

    if not errors:
        EMB.write_text(emb_text)
        print("knife 3: import + vox const + span written")

if errors:
    for e in errors:
        print("ERROR:", e)
    sys.exit(1)
print("t1120 voxel-interval cure: all knives landed")
