/**
 * t1113 — the AXIS-ORDER SANITIZER unit: the survey's cure pinned.
 *
 * The story: this window's bed rolls found the world's project binding
 * NULLED (the t894 doctor grew a BINDING witness — probe 2.5 — that
 * heals through the honest PATCH door), and the canvas QA's console
 * re-ran the t1112 stash spectrum ("bad axis order" among it). The
 * survey followed the throw to its root: Mol*'s CCP4 volume builder
 * derives its tensor axis order from the header's MAPC/MAPR/MAPS words
 * verbatim (0 → -1), and EVERY map producer this project ever wrote
 * (nine scripts) left those words zero-filled — so "View in 3D" never
 * rendered an isosurface for any of them. The cure is two-sided: the
 * reader-side sanitizer (a client-safe pure lib — the MRC2014 default
 * 1/2/3 written on a COPY when the triple is not a permutation of
 * {1,2,3}) at the embed's two ParseCcp4 doors, and the producer-side
 * law (all nine writers now speak 1/2/3 at bytes 64/68/72). The world's
 * frozen map files stay UNMOVED — the sanitizer meets them at read
 * time, nobody rewrites history behind the world's back.
 *
 * Bands: P the lib's law in numbers (zero-filled corrected to 1/2/3,
 * identity and valid permutations pass untouched — the SAME reference,
 * no copy for a clean file, the input never mutated, the copy byte-exact
 * outside the three words, the short-file honest pass, duplicates die);
 * U the wiring receipts (ONE import, the main map's RawData riding the
 * sanitized bytes, both honest debug receipts, the overlay's fetch
 * sanitized); W the producer roster (each of the nine scripts carries
 * exactly ONE MAPC law line, the t978 mint's line names the disease);
 * D the doctor's new binding witness (the receipt, the named cluster,
 * the PATCH door, the flags gate).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeMrcHeader } from "@/lib/mrc-axis";

let pass = 0;
let fail = 0;
const ok = (name, cond, extra) => {
  if (cond) {
    pass += 1;
    console.log(`  ok  ${name}`);
  } else {
    fail += 1;
    console.log(`  RED ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

const ROOT = join(import.meta.dirname, "..");
const embedSrc = readFileSync(
  join(ROOT, "src/components/workflow/results/molstar-embed.tsx"),
  "utf8"
);
const libSrc = readFileSync(join(ROOT, "src/lib/mrc-axis.ts"), "utf8");

// a 1030-byte synthetic MRC: 1024 header + 6 float32 voxels — header words
// the producers write (nx/ny/nz/mode, cella, angles, MAP, MACHST) plus a
// data plane. Zero-filled by default — the exact shape the nine producers
// wrote before this window's cure. mx/my/mz (the cell sampling, bytes
// 28/32/36) default to ZERO — the third zero-filled layer (t1114).
const mrcBytes = (mapc, mapr, maps, alpha = 0, beta = 0, gamma = 0, mx = 0, my = 0, mz = 0) => {
  const b = new Uint8Array(1024 + 24);
  const v = new DataView(b.buffer);
  v.setInt32(0, 2, true);
  v.setInt32(4, 2, true);
  v.setInt32(8, 2, true);
  v.setInt32(12, 2, true); // mode float32
  v.setInt32(28, mx, true);
  v.setInt32(32, my, true);
  v.setInt32(36, mz, true); // cell sampling MX/MY/MZ
  v.setFloat32(40, 64, true);
  v.setFloat32(44, 64, true);
  v.setFloat32(48, 64, true); // cella
  v.setFloat32(52, alpha, true);
  v.setFloat32(56, beta, true);
  v.setFloat32(60, gamma, true); // cell angles
  v.setInt32(64, mapc, true);
  v.setInt32(68, mapr, true);
  v.setInt32(72, maps, true);
  b.set([0x4d, 0x41, 0x50, 0x20], 208); // "MAP "
  v.setFloat32(1024, 0.25, true);
  return b;
};
const words = (b) => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return [v.getInt32(64, true), v.getInt32(68, true), v.getInt32(72, true)];
};
const angles = (b) => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return [v.getFloat32(52, true), v.getFloat32(56, true), v.getFloat32(60, true)];
};
// t1114 — the third law's own reader: the cell sampling words (28/32/36)
const sampling = (b) => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return [v.getInt32(28, true), v.getInt32(32, true), v.getInt32(36, true)];
};

/* ------------------------------------------------------------------ */
/* P — the lib's law in numbers                                        */
/* ------------------------------------------------------------------ */

// P1 — the zero-filled header (the whole disease): ALL THREE cures, named
const zero = mrcBytes(0, 0, 0);
const p1 = sanitizeMrcHeader(zero);
ok(
  "P1 zero-filled header corrected — 0/0/0 rides out as 1/2/3, angles as 90/90/90, sampling as 2/2/2",
  p1.corrected === true &&
    words(p1.bytes).join("/") === "1/2/3" &&
    angles(p1.bytes).map((a) => Math.round(a)).join("/") === "90/90/90" &&
    sampling(p1.bytes).join("/") === "2/2/2"
);
ok(
  // t1114 re-key — the third layer entered the law, the receipt grows the
  // third name ("cell sampling = data dims")
  "P1b the cured receipt names all three words — axis + angles + sampling",
  p1.cured.length === 3 &&
    p1.cured[0] === "axis order 1/2/3" &&
    p1.cured[1] === "cell angles 90/90/90" &&
    p1.cured[2] === "cell sampling = data dims"
);

// P2 — the clean header passes UNTOUCHED: same reference, no copy, no cure
// (t1114 re-key — clean now INCLUDES a sane sampling triple: 2/2/2 rides in)
const ident = mrcBytes(1, 2, 3, 90, 90, 90, 2, 2, 2);
const p2 = sanitizeMrcHeader(ident);
ok(
  "P2 clean header passes untouched — corrected=false, same reference, cured=[]",
  p2.corrected === false && p2.bytes === ident && p2.cured.length === 0
);

// P3 — a valid non-identity permutation passes too (Mol* canonicalizes it)
// (t1114 re-key — the sampling triple rides clean with it)
const perm = mrcBytes(2, 3, 1, 90, 90, 90, 2, 2, 2);
const p3 = sanitizeMrcHeader(perm);
ok(
  "P3 valid permutation 2/3/1 passes untouched — not ours to touch",
  p3.corrected === false && p3.bytes === perm
);

// P4 — garbage axis triple with CLEAN angles: the minimal cure touches
// only the axis words (the angles ride out exactly as they came)
// (t1114 re-key — the sampling disease still rides along: 2 cures named)
const junk = mrcBytes(7, -1, 0, 90, 90, 90);
const p4 = sanitizeMrcHeader(junk);
ok(
  "P4 garbage axis 7/-1/0 corrected — clean angles untouched, sampling rides the copy",
  p4.corrected === true &&
    words(p4.bytes).join("/") === "1/2/3" &&
    angles(p4.bytes).join("/") === "90/90/90" &&
    sampling(p4.bytes).join("/") === "2/2/2" &&
    p4.cured.length === 2 &&
    p4.cured[0] === "axis order 1/2/3" &&
    p4.cured[1] === "cell sampling = data dims"
);

// P5 — duplicates are not a permutation
const dup = mrcBytes(1, 1, 1, 90, 90, 90);
const p5 = sanitizeMrcHeader(dup);
ok(
  "P5 duplicates 1/1/1 corrected — a permutation means distinct",
  p5.corrected === true && words(p5.bytes).join("/") === "1/2/3"
);

// P6 — the isolated angles disease: identity axis, zero angles — only the
// angles are cured (this is the second layer: the non-invertible matrix)
// (t1114 re-key — sampling still rides: 2 cures named)
const flatBox = mrcBytes(1, 2, 3, 0, 0, 0);
const p6 = sanitizeMrcHeader(flatBox);
ok(
  "P6 zero angles with clean axis — angles cured alone (the matrix disease), sampling rides",
  p6.corrected === true &&
    angles(p6.bytes).map((a) => Math.round(a)).join("/") === "90/90/90" &&
    p6.cured.length === 2 &&
    p6.cured[0] === "cell angles 90/90/90" &&
    p6.cured[1] === "cell sampling = data dims"
);

// P7 — the input buffer is NEVER mutated in place: the fix lives in the copy
ok(
  "P7 input unmuted — the original still reads 0/0/0 and flat after the call",
  words(zero).join("/") === "0/0/0" && angles(zero).join("/") === "0/0/0"
);

// P8 — the copy is byte-exact OUTSIDE the cured words (angles 52..63 + axis 64..75)
const p8Same =
  p1.bytes.length === zero.length &&
  p1.bytes[0] === zero[0] && // nx
  p1.bytes[12] === zero[12] && // mode
  p1.bytes[40] === zero[40] && // cella rides through
  p1.bytes[208] === 0x4d && // "M" of MAP
  p1.bytes[1024] === zero[1024]; // first data byte
const p8Changed =
  p1.bytes[64] !== zero[64] &&
  p1.bytes[68] !== zero[68] &&
  p1.bytes[72] !== zero[72] &&
  p1.bytes[55] !== zero[55]; // 90.0f's high byte (0x42) — byte 52's low byte is zero either way
let diffOutside = false;
for (let i = 0; i < zero.length; i++) {
  // t1114 re-key — the sampling words' own bytes (28..39) join the skip band
  if ((i >= 52 && i < 76) || (i >= 28 && i < 40)) continue; // the cured words' own bytes
  if (p1.bytes[i] !== zero[i]) {
    diffOutside = true;
    break;
  }
}
ok(
  "P8 copy byte-exact outside bytes 28..39 + 52..75 — header words, cella, MAP, data plane",
  p8Same && p8Changed && !diffOutside
);

// P9 — the honest short pass: not enough bytes for the words, no touching
const short = new Uint8Array([1, 2, 3]);
const p9 = sanitizeMrcHeader(short);
ok(
  "P9 short file (<76) passes honest — corrected=false, same reference",
  p9.corrected === false && p9.bytes === short
);

// P10 — purity: the lib is client-safe (no fs/sharp — the embed imports it)
ok(
  "P10 lib purity — no node-only imports (fs/sharp) in mrc-axis.ts",
  !/\bfrom "(node:)?fs"|from "sharp"/.test(libSrc)
);

// P11 — the ISOLATED sampling disease (the third layer alone): identity
// axis, right angles, sane cella — but MX/MY/MZ zero (exactly the t978
// mint's own shape). ONLY the sampling is cured; axis words ride out as
// they came (t1114 — caught red-handed: Mol* divides origin by [NX,NY,NZ])
const onlyMx = mrcBytes(1, 2, 3, 90, 90, 90);
const p11 = sanitizeMrcHeader(onlyMx);
ok(
  "P11 isolated sampling disease — MX/MY/MZ 0 rides out as 2/2/2, axis+angles untouched",
  p11.corrected === true &&
    sampling(p11.bytes).join("/") === "2/2/2" &&
    words(p11.bytes).join("/") === "1/2/3" &&
    angles(p11.bytes).join("/") === "90/90/90" &&
    p11.cured.length === 1 &&
    p11.cured[0] === "cell sampling = data dims"
);

// P12 — the incurable edge: sampling zero AND data dims zero — the header
// lies about BOTH triples, no write happens, and the receipt says so
// (honesty over silence — a cure that can't cure names itself)
const doomed = mrcBytes(1, 2, 3, 90, 90, 90, 0, 0, 0);
new DataView(doomed.buffer).setInt32(0, 0, true);
new DataView(doomed.buffer).setInt32(4, 0, true);
new DataView(doomed.buffer).setInt32(8, 0, true);
const p12 = sanitizeMrcHeader(doomed);
ok(
  "P12 incurable sampling — data dims also lie: no write, INCURABLE named in the receipt",
  p12.corrected === true &&
    sampling(p12.bytes).join("/") === "0/0/0" &&
    p12.cured.length === 1 &&
    p12.cured[0] === "cell sampling INCURABLE (data dims also lie)"
);

// P13 — the negative/non-finite sampling triple counts as diseased too
// (a float-typed word read as int32 can ride garbage — any non-positive
// or non-finite triple takes the cure)
const negMx = mrcBytes(1, 2, 3, 90, 90, 90, -4, 0, 2);
const p13 = sanitizeMrcHeader(negMx);
ok(
  "P13 negative sampling triple is diseased — rides out as the data dims",
  p13.corrected === true && sampling(p13.bytes).join("/") === "2/2/2"
);

/* ------------------------------------------------------------------ */
/* U — the wiring receipts                                             */
/* ------------------------------------------------------------------ */

// U1 — ONE import in the embed, from the one lib
const u1 = embedSrc.match(/import \{ sanitizeMrcHeader \} from "@\/lib\/mrc-axis";/g) ?? [];
ok(
  'U1 ONE sanitizer import in the embed — from "@/lib/mrc-axis"',
  u1.length === 1
);

// U2 — the main map's RawData rides the SANITIZED bytes (no re-wrap copy)
ok(
  'U2 main map RawData rides the sanitized bytes — apply(RawData, { data: buf',
  /apply\(RawData, \{ data: buf, label: name \}\)/.test(embedSrc) &&
    !embedSrc.includes("data: new Uint8Array(buf)")
);

// U3 — the main path's corrected receipt speaks (the honest debug, with
// the cured words named)
ok(
  'U3 main path receipt — "header sanitized (${cured.join(...)} )" debug when corrected',
  embedSrc.includes("console.debug(`[molstar] header sanitized (${cured.join")
);

// U4 — the overlay fetch returns sanitized bytes (the second ParseCcp4 door)
ok(
  "U4 overlay fetchMapBytes returns the sanitizer's bytes",
  /const fetched = sanitizeMrcHeader\(new Uint8Array\(await r\.arrayBuffer\(\)\)\);/.test(
    embedSrc
  ) && /return fetched\.bytes;/.test(embedSrc)
);

// U5 — the overlay's own receipt names the lane and the cure
ok(
  'U5 overlay receipt — "header sanitized (overlay: ...)"',
  embedSrc.includes('console.debug(`[molstar] header sanitized (overlay: ${fetched.cured.join')
);

// U6 — the empty-surface clamp rides the pump (the ONE apply funnel): a
// contour at-or-beyond the map's own peak is pulled to 0.9 × the peak
// side's range, and the UI chip speaks the clamped truth
ok(
  "U6 the pump's empty-surface clamp — statsRef guard, 0.9 × peak, setSigma mirror",
  embedSrc.includes("const statsRef = useRef<GridStats | null>(null);") &&
    embedSrc.includes("statsRef.current = full;") &&
    embedSrc.includes("const over = d === 1 ? abs >= st.max : abs <= st.min;") &&
    embedSrc.includes("Math.round(((peak * 0.9) / st.sigma) * 100) / 100")
);

// U7 — the creation isoValue is explicit and inside the data (never the
// library's at-peak relative-2 default)
ok(
  'U7 creation isoValue explicit — IsoValueRef.current.relative(0.5) in the repr params',
  embedSrc.includes("params: { isoValue: IsoValueRef.current.relative(0.5) }")
);

/* ------------------------------------------------------------------ */
/* W — the producer roster (nine writers, one law)                     */
/* ------------------------------------------------------------------ */

const PRODUCERS = [
  "t416-topaz-denoise.mjs",
  "t308-array-downstream.mjs",
  "t575-class3d-cluster-live-fire.mjs",
  "diag-t360-mapimport-cluster.mjs",
  "diag-t409-mcorr.mjs",
  "t605-status-news-live-fire.mjs",
  "t269-time-ledger.mjs",
  "diag-t391-perf-log-lane.mjs",
  "t978-select-rider-world-mint.mjs",
];

// W1 — each producer carries EXACTLY ONE MAPC law line (born-clean t391 too)
const w1Counts = PRODUCERS.map((f) => {
  const src = readFileSync(join(ROOT, "scripts", f), "utf8");
  return (src.match(/writeInt32LE\(1, 64\)/g) ?? []).length;
});
ok(
  "W1 nine producers, each exactly one MAPC 1/2/3 law line",
  w1Counts.every((c) => c === 1),
  w1Counts.join(",")
);

// W2 — the mint's own cure line NAMES the disease (the story stays legible)
const mintSrc = readFileSync(
  join(ROOT, "scripts", "t978-select-rider-world-mint.mjs"),
  "utf8"
);
ok(
  'W2 the t978 mint names the disease — "bad axis order" in its cure line',
  /MAPC\/MAPR\/MAPS.*bad axis order/.test(mintSrc)
);

// W3 — the ANGLES law: each of the nine producers writes 90/90/90 exactly
// once (t391 was born clean — its line predates the window)
const w3Counts = PRODUCERS.map((f) => {
  const src = readFileSync(join(ROOT, "scripts", f), "utf8");
  return (src.match(/\.writeFloatLE\(90, 52\)/g) ?? []).length;
});
ok(
  "W3 nine producers, each exactly one receiver'd 90/90/90 angles line",
  w3Counts.every((c) => c === 1),
  w3Counts.join(",")
);

// W4 — the SAMPLING law (t1114): each of the nine producers writes the
// MX/MY/MZ words exactly once (t391 was born clean — its line predates
// the window)
const w4Counts = PRODUCERS.map((f) => {
  const src = readFileSync(join(ROOT, "scripts", f), "utf8");
  return (src.match(/\.writeInt32LE\([^)]+, 36\)/g) ?? []).length;
});
ok(
  "W4 nine producers, each exactly one MX/MY/MZ (byte 36) sampling line",
  w4Counts.every((c) => c === 1),
  w4Counts.join(",")
);

/* ------------------------------------------------------------------ */
/* D — the doctor's binding witness (probe 2.5, born this window)      */
/* ------------------------------------------------------------------ */

const doctorSrc = readFileSync(
  join(ROOT, "scripts", "t894-window-start-sweep.mjs"),
  "utf8"
);

// D1 — the witness receipts exist (sound + stomped + healed)
ok(
  "D1 doctor receipts — BINDING sound / STOMPED / HEALED all spoken",
  doctorSrc.includes('BINDING: "${active}" → ${CLUSTER_CONN} (sound)') &&
    doctorSrc.includes("BINDING STOMPED:") &&
    doctorSrc.includes("BINDING HEALED:")
);

// D2 — the cluster is named, not guessed (the conn-mvwf4vla replant epoch's
// re-key, t1125: conn-mv6a23lx died with the t1075 16-world's db in the
// epoch rollback; the pin rides whichever connection the epoch replanted)
ok(
  'D2 the Cluster is named — CLUSTER_CONN = "conn-mvwf4vla"',
  doctorSrc.includes('const CLUSTER_CONN = "conn-mvwf4vla";')
);

// D3 — the heal rides the honest PATCH door (the t979 bind law's verb)
ok(
  "D3 the heal rides PATCH /api/projects/:id with remoteConnectionId",
  /method: "PATCH"/.test(doctorSrc) &&
    doctorSrc.includes("remoteConnectionId: CLUSTER_CONN")
);

// D4 — the heal is flags-gated (report/no-align modes never write)
ok(
  "D4 the heal is flags-gated — !REPORT_ONLY && !NO_ALIGN guards the PATCH",
  /if \(!REPORT_ONLY && !NO_ALIGN\) \{\s*\n\s*const res = await fetch\(`\$\{ORIGIN\}\/api\/projects\/\$\{active\}`/.test(
    doctorSrc
  )
);

/* ------------------------------------------------------------------ */
console.log(`${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
