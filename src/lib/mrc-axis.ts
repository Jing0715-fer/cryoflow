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
 *   • the cell sampling MX/MY/MZ (bytes 28/32/36) — the THIRD zero-filled
 *     layer, caught red-handed in the t1114 window. Mol*'s mol-io parser
 *     maps these words to header.NX/NY/NZ and `volumeFromCcp4` DIVIDES the
 *     map origin by them (`origin_frac = origin / [NX,NY,NZ]`): a zero
 *     triple makes that 0/0 = NaN, the fractionalBox turns NaN and the
 *     grid-to-cartesian matrix goes all-NaN EVEN WITH cured angles and a
 *     sane 64 Å cell — every bounding sphere becomes NaN and the instance
 *     grid throws "Uint32Array(-Infinity)" (the t1113 fossil's true root,
 *     reproduced headlessly in node: `getGridToCartesianTransform` printed
 *     NaN ×16 on the sanitized bytes). The MRC2014 default for unit
 *     sampling: MX/MY/MZ = NC/NR/NS (the data dims themselves).
 *
 * The law: a header whose axis triple is not a permutation of {1,2,3},
 * whose angles are not three positive finite degrees, or whose cell
 * sampling counts are not three positive finite ints, is rewritten to the
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
  // t1114 — the cell sampling triple (MX/MY/MZ, bytes 28/32/36). Mol* reads
  // them as header.NX/NY/NZ and divides the origin by them — a zero or
  // non-finite triple poisons the fractional box with 0/0 = NaN and the
  // grid-to-cartesian matrix follows (all-NaN), taking every bounding
  // sphere down with it. The spec default: the data dims (unit sampling).
  const nc = view.getInt32(0, true);
  const nr = view.getInt32(4, true);
  const ns = view.getInt32(8, true);
  const mx = view.getInt32(28, true);
  const my = view.getInt32(32, true);
  const mz = view.getInt32(36, true);
  const samplingOk =
    Number.isFinite(mx) && mx > 0 &&
    Number.isFinite(my) && my > 0 &&
    Number.isFinite(mz) && mz > 0;
  if (permutation && anglesOk && samplingOk) return { bytes, corrected: false, cured: [] };
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
  if (!samplingOk) {
    // unit sampling: the cell counts equal the data counts (only written
    // when the data counts themselves are sane — a header that lies about
    // BOTH triples is beyond this cure's reach, and the receipt says so)
    if (nc > 0 && nr > 0 && ns > 0) {
      o.setInt32(28, nc, true);
      o.setInt32(32, nr, true);
      o.setInt32(36, ns, true);
      cured.push("cell sampling = data dims");
    } else {
      cured.push("cell sampling INCURABLE (data dims also lie)");
    }
  }
  return { bytes: out, corrected: true, cured };
}
