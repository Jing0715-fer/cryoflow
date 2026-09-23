/**
 * CryoFlow — CryoSPARC .cs → RELION particles.star converter (t336), PURE.
 *
 * The user's reference workflow (upload/cryosmart_relion_trans3.0.sh) runs
 * pyem's csparc2star.py on the cluster:
 *
 *   csparc2star.py particles.cs passthrough_particles.cs out.star --inverty
 *
 * …then symlinks the extract dir's .mrc stacks to .mrcs names and sed-edits
 * the star to match. This module implements the SAME conversion natively
 * (no pyem, no Python — the field table below is pyem's, verified against
 * asarnow/pyem master: metadata/cryosparc2.py + geom/convert.py):
 *
 *   uid                    — join key (passthrough merges by it)
 *   blob/path, blob/idx    — _rlnImageName = (idx+1)@path   [0-based idx]
 *   blob/psize_A           — _rlnImagePixelSize (optics)
 *   blob/shape[0]          — _rlnImageSize (optics; square extract boxes)
 *   ctf/df1_A, ctf/df2_A   — _rlnDefocusU/V  — ÅNGSTRÖM, no scaling
 *   ctf/df_angle_rad       — _rlnDefocusAngle — rad → deg
 *   ctf/phase_shift_rad    — _rlnPhaseShift   — rad → deg
 *   ctf/accel_kv/cs_mm/ac  — _rlnVoltage/_rlnSphericalAberration/_rlnAmplitudeContrast (optics)
 *   ctf/exp_group_id       — _rlnOpticsGroup (0-based → 1-based)
 *   location/center_*_frac — _rlnCoordinateX/Y: frac × micrograph_shape,
 *                            shape is [y, x] so the axes SWAP (pyem's
 *                            default); inverty flips Y (origin bottom-left
 *                            in cryoSPARC vs top-left in RELION)
 *   alignments3D/pose      — Rodrigues vector → expmap → Shoemake Euler
 *                            (rot, tilt, psi), rad → deg
 *   alignments3D/shift     — _rlnOriginX/YAngst = shift × angpix
 *                            (RELION 3.1+ optics dialect; pyem's
 *                            sync_origins_from_angst counterpart)
 *   alignments3D/split     — _rlnRandomSubset (0-based → 1-based)
 *   alignments3D/class     — _rlnClassNumber  (0-based → 1-based)
 *   alignments2D/{pose,shift,class} — the 2D dialect (psi in rad)
 *
 * The `--inverty` flag in pyem is argparse store_false — i.e. pyem's
 * DEFAULT inverts Y and the flag DISABLES it. The reference script PASSES
 * the flag, so its effective behavior is invertY=false (particles whose
 * coordinates came in via cryoSPARC's Import Particles already speak
 * RELION's convention). This converter defaults invertY=false to match
 * the user's proven pipeline, and exposes the toggle.
 *
 * The SELECTIVE-LINK plan (the requested optimization over the reference
 * script's "link every .mrc in every extract dir"): the star's unique
 * blob/path values decide which stacks get linked — an .mrc sitting in
 * the same extract dir but unreferenced by the .cs never gets a link.
 */

import type { NpyValue } from "./cs-npy";

/* ------------------------------------------------------------------ */
/* The conversion options + result                                      */
/* ------------------------------------------------------------------ */

export interface Cs2StarOptions {
  /** Flip particle Y coordinates (cryoSPARC bottom-left origin). Default
   *  false — the reference script's effective shape (pyem --inverty). */
  invertY?: boolean;
  /** Optics fallbacks for .cs files without ctf/mscope fields. */
  fallback?: { angpix?: number; voltage?: number; cs?: number; ac?: number };
  /** t366 — the stacks' PHYSICAL sampling, probed from their own MRC
   *  headers by the lane (cluster-side python, the SSH fallback, or the
   *  local filesystem). Whatever is set here OVERRIDES the .cs metadata's
   *  blob/psize_A + blob/shape for every optics group — the field report:
   *  a merged CryoSPARC particle set can carry STALE full-resolution
   *  metadata (256 px @ 0.808 Å) over stacks that are physically the
   *  4×-binned truth (100 px @ 3.232 Å), so the .cs is not the truth, the
   *  stacks are. Each half may be set independently (headers can lose
   * their cella and still vote on the box). */
  sampling?: { angpix?: number; box?: number };
}

export interface Cs2StarStackPlan {
  /** The blob/path exactly as written in the .cs (leading '>' stripped). */
  csPath: string;
  /** The flat link name the star will reference: `<base>.mrcs`. */
  linkName: string;
}

export interface Cs2StarResult {
  /** The complete RELION 5 star: data_optics + data_particles. */
  starText: string;
  particles: number;
  /** Unique referenced stacks — the ONLY files that get links. */
  stacks: Cs2StarStackPlan[];
  /** .cs fields present but unmapped (the receipt's transparency line). */
  unmapped: string[];
  /** Distinct optics groups after the merge. */
  opticsGroups: number;
  /** t366 — where the optics sampling values came from: the stacks' own
   *  probed headers (an override was handed in) or the .cs metadata. */
  opticsSource: "cs-metadata" | "stack-headers";
  /** t366 — the distinct samplings the .cs METADATA claimed across its
   *  optics groups (before any override). >1 variant + a probed override
   *  is the corrected-lie receipt; >1 variant with no probe is the
   *  unverifiable-lie receipt. */
  samplingVariants: { box: number; angpix: number }[];
  /** The optics values that landed in the star (for the receipt). */
  optics: { angpix: number; voltage: number; cs: number; ac: number; boxSize: number };
  /** Coordinate axes present? (absent for re-extracted/imported sets). */
  hasCoordinates: boolean;
  /** Alignment source: "3D" | "2D" | "none". */
  alignment: "3D" | "2D" | "none";
}

/* ------------------------------------------------------------------ */
/* Rodrigues → Euler (pyem geom/convert.py, verbatim)                   */
/* ------------------------------------------------------------------ */

/** axis-angle → rotation matrix (pyem expmap). */
function expmap(rx: number, ry: number, rz: number): number[] {
  const theta = Math.hypot(rx, ry, rz);
  const eps = 2.220446049250313e-16; // np.finfo(double).eps
  if (theta < 1e-16) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const wx = rx / theta, wy = ry / theta, wz = rz / theta;
  const k = [0, wz, -wy, -wz, 0, wx, wy, -wx, 0];
  const k2 = mul3(k, k);
  const s = Math.sin(theta), c1 = 1 - Math.cos(theta);
  const r: number[] = [];
  for (let i = 0; i < 9; i++) r.push((i % 4 === 0 ? 1 : 0) + s * k[i] + c1 * k2[i]);
  return r;
}

function mul3(a: number[], b: number[]): number[] {
  const out = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let l = 0; l < 3; l++) out[i * 3 + j] += a[i * 3 + l] * b[l * 3 + j];
  return out;
}

function sign(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

/** rotation matrix → ZYZ Euler (pyem rot2euler, Shoemake, RELION convention). */
function rot2euler(r: number[]): [number, number, number] {
  const eps = 2.220446049250313e-16;
  const absSb = Math.hypot(r[2], r[5]); // r[0,2], r[1,2]
  if (absSb > 16 * eps) {
    const gamma = Math.atan2(r[5], -r[2]);
    const alpha = Math.atan2(r[7], r[6]); // r[2,1], r[2,0]
    let signSb: number;
    if (Math.abs(Math.sin(gamma)) < eps) {
      signSb = sign(-r[2]) / Math.cos(gamma);
    } else {
      signSb = Math.sin(gamma) > 0 ? sign(r[5]) : -sign(r[5]);
    }
    const beta = Math.atan2(signSb * absSb, r[8]);
    return [alpha, beta, gamma];
  }
  if (Math.sign(r[8]) > 0) {
    return [0, 0, Math.atan2(-r[3], r[0])]; // r[1,0], r[0,0]
  }
  return [0, Math.PI, Math.atan2(r[3], -r[0])];
}

const DEG = 180 / Math.PI;

/* ------------------------------------------------------------------ */
/* Row helpers                                                          */
/* ------------------------------------------------------------------ */

type Row = Record<string, NpyValue>;

const num1 = (row: Row, key: string): number | null => {
  const v = row[key];
  return typeof v === "number" ? v : null;
};
const arr = (row: Row, key: string): number[] | null => {
  const v = row[key];
  return Array.isArray(v) ? v : null;
};
const str1 = (row: Row, key: string): string | null => {
  const v = row[key];
  return typeof v === "string" ? v : null;
};

/** Unique link names — basename minus extension + ".mrcs", collisions suffixed. */
function planLinkNames(csPaths: string[]): Cs2StarStackPlan[] {
  const used = new Map<string, number>();
  const out: Cs2StarStackPlan[] = [];
  for (const p of csPaths) {
    const base = (p.split(/[\\/]/).pop() ?? p).replace(/\.[^.]+$/, "");
    let name = `${base}.mrcs`;
    const n = used.get(name);
    if (n) {
      used.set(name, n + 1);
      name = `${base}-${n + 1}.mrcs`;
    } else {
      used.set(name, 1);
    }
    out.push({ csPath: p, linkName: name });
  }
  return out;
}

/** Field-number formatting (pyem/pandas writes %g-ish; RELION reads any).
 *  6 significant digits — float32 .cs fields carry representation noise
 *  (0.07 arrives as 0.070000000298…); 6 digits kills it without ever
 *  touching real precision (pyem's own pandas display default). */
const fmt = (v: number): string => {
  if (!Number.isFinite(v)) return "0";
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  return String(Number(v.toPrecision(6)));
};

/* ------------------------------------------------------------------ */
/* The converter                                                        */
/* ------------------------------------------------------------------ */

/**
 * Convert merged .cs rows (primary + passthroughs, uid-joined here) into
 * a RELION 5 particles.star. PURE: bytes in, text out — the engine lane
 * and the suites share this ONE classification.
 */
export function csRowsToStar(primary: Row[], passthroughs: Row[][], opts: Cs2StarOptions = {}): Cs2StarResult {
  const invertY = opts.invertY === true;
  const fb = opts.fallback ?? {};
  const phys =
    opts.sampling && ((opts.sampling.angpix ?? 0) > 0 || (opts.sampling.box ?? 0) > 0)
      ? opts.sampling
      : undefined;

  // ---- uid join: passthrough fields ride onto the primary rows --------
  // (pyem's smart_merge: left join keep-left rows, fields absent from the
  // primary only — a passthrough field the job itself rewrote never wins)
  const merged: Row[] = primary.map((r) => ({ ...r }));
  const primaryFields = new Set(primary.length > 0 ? Object.keys(primary[0]) : []);
  for (const pt of passthroughs) {
    if (pt.length === 0) continue;
    const byUid = new Map<string, Row>();
    for (const r of pt) {
      const u = num1(r, "uid");
      if (u != null) byUid.set(String(u), r);
    }
    const newFields = Object.keys(pt[0]).filter((k) => k !== "uid" && !primaryFields.has(k));
    for (const row of merged) {
      const u = num1(row, "uid");
      const donor = u != null ? byUid.get(String(u)) : undefined;
      if (donor) for (const f of newFields) row[f] = donor[f];
    }
    for (const f of newFields) primaryFields.add(f);
  }

  // ---- the mapped column extractor ------------------------------------
  const has = (k: string) => primaryFields.has(k);
  const alignment: "3D" | "2D" | "none" = has("alignments3D/pose")
    ? "3D"
    : has("alignments2D/pose")
      ? "2D"
      : "none";
  const hasCoords = has("location/center_x_frac") && has("location/micrograph_shape");

  // ---- the stack census (FIRST — the link names must be decided before
  // any row references them; a colliding basename gets a -2 suffix and the
  // star must speak the SAME suffixed name as the link)
  const stackPaths: string[] = [];
  const seenStacks = new Set<string>();
  for (const row of merged) {
    let imgPath = str1(row, "blob/path");
    if (imgPath != null && imgPath.startsWith(">")) imgPath = imgPath.replace(/^>+/, "");
    if (imgPath != null && !seenStacks.has(imgPath)) {
      seenStacks.add(imgPath);
      stackPaths.push(imgPath);
    }
  }
  const stackPlan = planLinkNames(stackPaths);
  const linkNameOf = new Map<string, string>(stackPlan.map((p) => [p.csPath, p.linkName]));

  // optics — one group per ctf/exp_group_id (fields are constant per group
  // in practice; first-seen wins, exactly pyem's groupby().first())
  const opticsRows = new Map<number, { voltage: number; cs: number; ac: number; angpix: number; box: number }>();
  const claimedVariants = new Map<string, { box: number; angpix: number }>(); // t366 — the .cs's own claim, pre-override
  const starRows: Record<string, string>[] = [];

  for (const row of merged) {
    // -- the stack reference (the census already named every link) --
    let imgPath = str1(row, "blob/path");
    const imgIdx = num1(row, "blob/idx") ?? 0;
    if (imgPath != null && imgPath.startsWith(">")) imgPath = imgPath.replace(/^>+/, "");
    const stackPath = imgPath ?? "";
    const linkName = linkNameOf.get(stackPath) ?? "";

    // -- optics group (t366: the sampling values yield to the stacks'
    //    probed headers — phys beats the .cs metadata, per-field) --
    const groupId = Math.round((num1(row, "ctf/exp_group_id") ?? 0)) + 1; // 1-based
    if (!opticsRows.has(groupId)) {
      const claimedAngpix = num1(row, "blob/psize_A") ?? fb.angpix ?? 1;
      const angpix = phys?.angpix != null && phys.angpix > 0 ? phys.angpix : claimedAngpix;
      const voltage = num1(row, "ctf/accel_kv") ?? fb.voltage ?? 300;
      const cs = num1(row, "ctf/cs_mm") ?? fb.cs ?? 2.7;
      const ac = num1(row, "ctf/amp_contrast") ?? num1(row, "ctf/ac") ?? fb.ac ?? 0.1;
      const shape = arr(row, "blob/shape");
      const claimedBox = shape != null ? Math.round(shape[0] ?? 0) : 0;
      const box = phys?.box != null && phys.box > 0 ? Math.round(phys.box) : claimedBox;
      opticsRows.set(groupId, { voltage, cs, ac, angpix, box });
      const ck = `${claimedBox}@${Number(claimedAngpix.toFixed(4))}`;
      if (!claimedVariants.has(ck)) claimedVariants.set(ck, { box: claimedBox, angpix: claimedAngpix });
    }
    const optics = opticsRows.get(groupId)!;

    // -- the row's values, in the emit order below --
    const vals: Record<string, string> = {};
    vals.opticsGroup = String(groupId); // t366 — the row SPEAKS its group
    vals.imageName = linkName
      ? `${Math.max(1, Math.round(imgIdx) + 1)}@micrographs/${linkName}`
      : ""; // a row without blob/path cannot be windowed — dropped below
    const mic = str1(row, "location/micrograph_path");
    vals.micrographName = mic != null ? mic.replace(/^>+/, "") : "";

    if (hasCoords) {
      const fx = num1(row, "location/center_x_frac") ?? 0;
      let fy = num1(row, "location/center_y_frac") ?? 0;
      if (invertY) fy = 1 - fy;
      const shape = arr(row, "location/micrograph_shape") ?? [0, 0]; // [y, x]
      const sx = shape[1] ?? shape[0] ?? 0;
      const sy = shape[0] ?? shape[1] ?? 0;
      vals.coordX = String(Math.round(fx * sx));
      vals.coordY = String(Math.round(fy * sy));
    }

    if (alignment === "3D") {
      const pose = arr(row, "alignments3D/pose");
      if (pose != null && pose.length >= 3) {
        const [rot, tilt, psi] = rot2euler(expmap(pose[0], pose[1], pose[2]));
        vals.angleRot = fmt(rot * DEG);
        vals.angleTilt = fmt(tilt * DEG);
        vals.anglePsi = fmt(psi * DEG);
      }
      const shift = arr(row, "alignments3D/shift");
      if (shift != null && shift.length >= 2) {
        vals.originXAngst = fmt(shift[0] * optics.angpix);
        vals.originYAngst = fmt(shift[1] * optics.angpix);
      }
      const split = num1(row, "alignments3D/split");
      if (split != null) vals.randomSubset = String(Math.round(split) + 1);
    } else if (alignment === "2D") {
      const psi = num1(row, "alignments2D/pose");
      if (psi != null) vals.anglePsi = fmt(psi * DEG);
      const shift = arr(row, "alignments2D/shift");
      if (shift != null && shift.length >= 2) {
        vals.originXAngst = fmt(shift[0] * optics.angpix);
        vals.originYAngst = fmt(shift[1] * optics.angpix);
      }
    }
    const cls = num1(row, `alignments${alignment === "2D" ? "2D" : "3D"}/class`) ?? num1(row, "class");
    if (cls != null) vals.classNumber = String(Math.round(cls) + 1);

    const dfu = num1(row, "ctf/df1_A");
    if (dfu != null) vals.defocusU = fmt(dfu);
    const dfv = num1(row, "ctf/df2_A");
    if (dfv != null) vals.defocusV = fmt(dfv);
    const dfa = num1(row, "ctf/df_angle_rad");
    if (dfa != null) vals.defocusAngle = fmt(dfa * DEG);
    const phs = num1(row, "ctf/phase_shift_rad");
    vals.phaseShift = phs != null ? fmt(phs * DEG) : "0"; // pyem check_defaults

    if (vals.imageName !== "") starRows.push(vals);
  }

  // ---- the emit order (RELION's canonical particles star) -------------
  const COLS: [string, string][] = [
    ["imageName", "_rlnImageName"],
    ["micrographName", "_rlnMicrographName"],
    ["coordX", "_rlnCoordinateX"],
    ["coordY", "_rlnCoordinateY"],
    ["angleRot", "_rlnAngleRot"],
    ["angleTilt", "_rlnAngleTilt"],
    ["anglePsi", "_rlnAnglePsi"],
    ["originXAngst", "_rlnOriginXAngst"],
    ["originYAngst", "_rlnOriginYAngst"],
    ["defocusU", "_rlnDefocusU"],
    ["defocusV", "_rlnDefocusV"],
    ["defocusAngle", "_rlnDefocusAngle"],
    ["phaseShift", "_rlnPhaseShift"],
    ["classNumber", "_rlnClassNumber"],
    ["randomSubset", "_rlnRandomSubset"],
    // t366 — without this column every particle silently rides optics
    // group 1 in RELION and the other groups' rows are dead metadata (the
    // field report: 45 groups, the 3D death quoted group 1 while the user
    // pasted group 45's full-resolution numbers back, baffled). Appended
    // LAST so every existing column index survives.
    ["opticsGroup", "_rlnOpticsGroup"],
  ];
  // columns present in ANY row (a column missing for every row is omitted,
  // pyem's dataframe semantics)
  const activeCols = COLS.filter(([k]) => starRows.some((r) => r[k] != null));

  const lines: string[] = [];
  lines.push("");
  lines.push("data_optics");
  lines.push("");
  lines.push("loop_");
  const opticsCols = [
    ["_rlnOpticsGroup", (g: number) => String(g)],
    ["_rlnOpticsGroupName", (g: number) => `opticsGroup${g}`],
    ["_rlnVoltage", (g: number) => fmt(opticsRows.get(g)!.voltage)],
    ["_rlnSphericalAberration", (g: number) => fmt(opticsRows.get(g)!.cs)],
    ["_rlnAmplitudeContrast", (g: number) => fmt(opticsRows.get(g)!.ac)],
    ["_rlnImageSize", (g: number) => (opticsRows.get(g)!.box > 0 ? String(opticsRows.get(g)!.box) : "")],
    ["_rlnImageDimensionality", () => "2"],
    ["_rlnImagePixelSize", (g: number) => fmt(opticsRows.get(g)!.angpix)],
  ] as [string, (g: number) => string][];
  opticsCols.forEach(([name], i) => lines.push(`${name} #${i + 1}`));
  for (const g of [...opticsRows.keys()].sort((a, b) => a - b)) {
    lines.push(opticsCols.map(([, f]) => f(g)).join("\t"));
  }
  lines.push("");
  lines.push("data_particles");
  lines.push("");
  lines.push("loop_");
  activeCols.forEach(([, name], i) => lines.push(`${name} #${i + 1}`));
  for (const r of starRows) {
    lines.push(activeCols.map(([k]) => r[k] ?? "").join("\t"));
  }

  // ---- the receipt fields ---------------------------------------------
  const unmapped = [...primaryFields].filter(
    (k) =>
      k !== "uid" &&
      !/^blob\/(path|idx|psize_A|shape)$/.test(k) &&
      !/^ctf\/(df1_A|df2_A|df_angle_rad|phase_shift_rad|accel_kv|cs_mm|ac|amp_contrast|exp_group_id|bfactor)$/.test(k) &&
      !/^location\/(center_x_frac|center_y_frac|micrograph_path|micrograph_shape)$/.test(k) &&
      !/^alignments(2D|3D)\/(pose|shift|class|split)$/.test(k)
  );

  const firstOptics = opticsRows.get(1) ?? [...opticsRows.values()][0] ?? {
    voltage: fb.voltage ?? 300,
    cs: fb.cs ?? 2.7,
    ac: fb.ac ?? 0.1,
    angpix: fb.angpix ?? 1,
    box: 0,
  };

  // t366 — the distinct samplings the .cs METADATA claimed (the raw
  // claim, whether or not the stacks' headers overrode it downstream;
  // a set that never disagreed claims exactly one)
  const samplingVariants = [...claimedVariants.values()].sort((a, b) => a.box - b.box || a.angpix - b.angpix);

  return {
    starText: lines.join("\n") + "\n",
    particles: starRows.length,
    stacks: planLinkNames([...stackPaths]),
    unmapped,
    opticsGroups: opticsRows.size,
    opticsSource: phys ? "stack-headers" : "cs-metadata",
    samplingVariants,
    optics: {
      voltage: firstOptics.voltage,
      cs: firstOptics.cs,
      ac: firstOptics.ac,
      angpix: firstOptics.angpix,
      boxSize: firstOptics.box,
    },
    hasCoordinates: hasCoords,
    alignment,
  };
}

/* ------------------------------------------------------------------ */
/* t366 — judging the stacks' own headers (the sampling truth)          */
/* ------------------------------------------------------------------ */

/** One probed stack header: what the file itself says. `box`/`angpix`
 *  are null when the header could not speak for that half (unreadable →
 *  both null; a header without cella → box only). */
export interface StackSamplingProbe {
  /** the resolved path that was probed (receipts name the first deviant) */
  path: string;
  /** nx of the stack (= the particle box; ny must equal it) */
  box: number | null;
  /** cella_x / nx — null when the header carries no cell sizes */
  angpix: number | null;
}

/** The verdict over every referenced stack's own header. */
export interface SamplingVerdict {
  /** what EVERY readable stack agrees on (null halves = no header spoke) */
  sampling: { box: number | null; angpix: number | null } | null;
  /** distinct physical samplings among the readable stacks (>1 = refuse) */
  variants: { box: number; angpix: number; stacks: number; first: string }[];
  /** stacks whose header parsed and voted on the box */
  probed: number;
  /** stacks whose header did not parse at all */
  unreadable: number;
}

/**
 * Judge the probed headers (t366). A stack votes with (nx, cella_x/nx)
 * when its header parses and nx == ny; a header without cell sizes still
 * votes on the box; anything else is unreadable and never judged. One
 * agreed sampling across all voters → `sampling`; disagreement → the
 * variant census a refusal can quote. PURE: the suites and all three
 * conversion lanes share this ONE classification.
 */
export function judgeStackSamplings(probes: StackSamplingProbe[]): SamplingVerdict {
  const votes = new Map<string, { box: number; angpix: number; stacks: number; first: string }>();
  let probed = 0;
  let unreadable = 0;
  for (const p of probes) {
    if (p.box == null || p.box <= 0) {
      unreadable++;
      continue;
    }
    probed++;
    const key = `${p.box}@${p.angpix != null ? Number(p.angpix.toFixed(4)) : "x"}`;
    const cur = votes.get(key);
    if (cur) cur.stacks++;
    else votes.set(key, { box: p.box, angpix: p.angpix ?? 0, stacks: 1, first: p.path });
  }
  const variants = [...votes.values()].sort((a, b) => a.box - b.box || a.angpix - b.angpix);
  if (variants.length > 1) return { sampling: null, variants, probed, unreadable };
  if (variants.length === 1) {
    return { sampling: { box: variants[0]!.box, angpix: variants[0]!.angpix > 0 ? variants[0]!.angpix : null }, variants, probed, unreadable };
  }
  return { sampling: null, variants: [], probed, unreadable };
}
