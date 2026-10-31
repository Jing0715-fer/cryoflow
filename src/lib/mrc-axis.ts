/**
 * t1113 — the MRC HEADER SANITIZER (client-safe: pure DataView math, no
 * fs/sharp — the embed imports this directly; mrc.ts stays node-only).
 *
 * The survey that named it (the thirty-ninth window): the class maps' MRC
 * headers carry ZERO-FILLED words where the spec expects values, and
 * Mol*'s CCP4 volume builder reads several of those words verbatim:
 *
 *   • MAPC/MAPR/MAPS (bytes 64/68/72) — the fast-to-slow axis order. Mol*
 *     derives `header.MAPC - 1` from them, so a zero header becomes
 *     (-1,-1,-1) and `Tensor.create` throws "bad axis order" — the "View
 *     in 3D" face of every zero-header map never rendered an isosurface
 *     at all (the walk's paper pages ride OUR tile renderer and never
 *     noticed). The MRC2014 default: 1/2/3 (X fastest, then Y, then Z) —
 *     exactly the byte layout every producer here writes
 *     (`(z * ny + y) * nx + x`).
 *
 *   • the cell angles alpha/beta/gamma (bytes 52/56/60) — zero-filled by
 *     the same producers. Mol*'s SpacegroupCell takes them as degrees, and
 *     a (0°,0°,0°) cell produces a NON-INVERTIBLE grid-to-cartesian matrix
 *     (NaN riding the basis rows — the console's "non-invertible matrix"
 *     warning, reproduced live), whose NaN poisons the isosurface geometry
 *     downstream ("RangeError: Invalid typed array length: -Infinity").
 *     The MRC2014 default: 90/90/90 (an orthogonal box — what every
 *     producer here means).
 *
 * The law: a header whose axis triple is not a permutation of {1,2,3}, or
 * whose angles are not three positive finite degrees, is rewritten to the
 * spec defaults on a COPY (never mutate the fetched buffer in place); a
 * clean header passes untouched — the SAME reference, no copy. The honest
 * receipt (`corrected`, `cured`) lets the caller speak WHEN and WHAT was
 * written.
 */

export function sanitizeMrcHeader(bytes: Uint8Array): {
  bytes: Uint8Array;
  corrected: boolean;
  cured: string[];
} {
  if (!bytes || bytes.length < 76) return { bytes, corrected: false, cured: [] };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const mapc = view.getInt32(64, true);
  const mapr = view.getInt32(68, true);
  const maps = view.getInt32(72, true);
  const inRange =
    mapc >= 1 && mapc <= 3 && mapr >= 1 && mapr <= 3 && maps >= 1 && maps <= 3;
  const permutation = inRange && mapc !== mapr && mapr !== maps && mapc !== maps;
  const alpha = view.getFloat32(52, true);
  const beta = view.getFloat32(56, true);
  const gamma = view.getFloat32(60, true);
  const anglesOk =
    Number.isFinite(alpha) && alpha > 0 &&
    Number.isFinite(beta) && beta > 0 &&
    Number.isFinite(gamma) && gamma > 0;
  if (permutation && anglesOk) return { bytes, corrected: false, cured: [] };
  const out = bytes.slice();
  const o = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const cured: string[] = [];
  if (!permutation) {
    o.setInt32(64, 1, true);
    o.setInt32(68, 2, true);
    o.setInt32(72, 3, true);
    cured.push("axis order 1/2/3");
  }
  if (!anglesOk) {
    o.setFloat32(52, 90, true);
    o.setFloat32(56, 90, true);
    o.setFloat32(60, 90, true);
    cured.push("cell angles 90/90/90");
  }
  return { bytes: out, corrected: true, cured };
}
