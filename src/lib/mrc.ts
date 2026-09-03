/**
 * CryoFlow — MRC2014 / CCP4 map reader + slice → PNG rendering (SERVER ONLY).
 *
 * Real RELION outputs on disk are classic MRC2014 files:
 *  - mode 0 (int8), 1 (int16), 2 (float32), 6 (uint16)
 *  - nx/ny/nz at byte offsets 0/4/8, mode at 12, nsymbt (extended header
 *    size) at 92, voxel data starts at 1024 + nsymbt.
 *  - image stacks (.mrcs) stack images along z.
 *
 * Rendering: nearest-neighbour downsample to ≤ MAX_W px, 2–98 percentile
 * contrast stretch, grayscale PNG via sharp (raw 1-channel buffer input).
 */

import { closeSync, openSync, readSync, statSync } from "fs";
import sharp from "sharp";

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/** bytes per voxel for the MRC modes we support */
const MODE_BYTES: Record<number, number> = { 0: 1, 1: 2, 2: 4, 6: 2 };

export interface MrcHeader {
  nx: number;
  ny: number;
  nz: number;
  /** 0 int8 · 1 int16 · 2 float32 · 6 uint16 */
  mode: number;
  /** extended header bytes (data starts at 1024 + nsymbt) */
  nsymbt: number;
  bytesPerVoxel: number;
  dmin: number;
  dmax: number;
}

/** Read + validate the 1024-byte MRC2014 header. Returns null when not a map we can read. */
export function readMrcHeader(file: string): MrcHeader | null {
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const buf = Buffer.alloc(1024);
    const got = readSync(fd, buf, 0, 1024, 0);
    if (got < 1024) return null;
    const nx = buf.readInt32LE(0);
    const ny = buf.readInt32LE(4);
    const nz = buf.readInt32LE(8);
    const mode = buf.readInt32LE(12);
    const nsymbt = buf.readInt32LE(92);
    const bpp = MODE_BYTES[mode];
    if (
      !Number.isFinite(nx) || nx <= 0 || ny <= 0 || nz <= 0 ||
      nx > 65536 || ny > 65536 || nz > 1_000_000 ||
      nsymbt < 0 || nsymbt > 16_000_000 || bpp === undefined
    ) {
      return null;
    }
    const size = statSync(file).size;
    if (1024 + nsymbt + nx * ny * nz * bpp > size + bpp) return null;
    return {
      nx, ny, nz, mode, nsymbt,
      bytesPerVoxel: bpp,
      dmin: buf.readFloatLE(76),
      dmax: buf.readFloatLE(80),
    };
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/* ------------------------------------------------------------------ */
/* Slices                                                              */
/* ------------------------------------------------------------------ */

/** Read one 2D slice (image index for stacks / section for volumes) as float values. */
export function readMrcSlice(file: string, z: number, header?: MrcHeader): Float32Array | null {
  const h = header ?? readMrcHeader(file);
  if (!h) return null;
  const zi = Math.max(0, Math.min(Math.trunc(z), h.nz - 1));
  const count = h.nx * h.ny;
  const nbytes = count * h.bytesPerVoxel;
  const offset = 1024 + h.nsymbt + zi * nbytes;
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const raw = Buffer.alloc(nbytes);
    const got = readSync(fd, raw, 0, nbytes, offset);
    if (got < nbytes) return null;
    const out = new Float32Array(count);
    switch (h.mode) {
      case 0:
        for (let i = 0; i < count; i++) out[i] = raw.readInt8(i);
        break;
      case 1:
        for (let i = 0; i < count; i++) out[i] = raw.readInt16LE(i * 2);
        break;
      case 6:
        for (let i = 0; i < count; i++) out[i] = raw.readUInt16LE(i * 2);
        break;
      default: // 2 — float32
        for (let i = 0; i < count; i++) out[i] = raw.readFloatLE(i * 4);
        break;
    }
    return out;
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/* ------------------------------------------------------------------ */
/* Grayscale rendering helpers                                         */
/* ------------------------------------------------------------------ */

/** max output PNG width (slice) and cell size (montage) */
const MAX_W = 384;
const MONTAGE_COLS = 4;
const MONTAGE_CELL = 128;
const MONTAGE_GAP = 2;

/** nearest-neighbour downsample of a slice to ≤ maxW columns. */
function downsample(
  data: Float32Array,
  nx: number,
  ny: number,
  maxW: number
): { values: Float32Array; width: number; height: number } {
  const step = Math.max(1, Math.ceil(nx / maxW));
  const w = Math.ceil(nx / step);
  const h = Math.ceil(ny / step);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(ny - 1, y * step);
    for (let x = 0; x < w; x++) {
      const sx = Math.min(nx - 1, x * step);
      out[y * w + x] = data[sy * nx + sx];
    }
  }
  return { values: out, width: w, height: h };
}

/** 2–98 percentile contrast stretch → 8-bit grayscale buffer. */
function stretchToGray(data: Float32Array): Buffer {
  const n = data.length;
  const sorted = Float32Array.from(data).sort();
  const lo = sorted[Math.floor(0.02 * (n - 1))];
  const hi = sorted[Math.ceil(0.98 * (n - 1))];
  const gray = Buffer.alloc(n);
  const span = hi - lo;
  if (!(span > 0)) {
    gray.fill(128);
    return gray;
  }
  for (let i = 0; i < n; i++) {
    const v = (data[i] - lo) / span;
    gray[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
  }
  return gray;
}

async function grayToPng(gray: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(gray, { raw: { width, height, channels: 1 } })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

/* ------------------------------------------------------------------ */
/* Public render API                                                   */
/* ------------------------------------------------------------------ */

/**
 * Render one slice as a grayscale PNG (≤384 px wide).
 * `slice` defaults to the middle section for volumes, 0 for stacks.
 */
export async function renderMrcSlicePng(file: string, slice?: number): Promise<Buffer | null> {
  const h = readMrcHeader(file);
  if (!h) return null;
  const z = slice !== undefined && Number.isFinite(slice) ? Math.trunc(slice) : Math.floor(h.nz / 2);
  const data = readMrcSlice(file, z, h);
  if (!data) return null;
  const small = downsample(data, h.nx, h.ny, MAX_W);
  const gray = stretchToGray(small.values);
  return grayToPng(gray, small.width, small.height);
}

/**
 * Render the first `count` (≤16) images of a .mrcs stack as a 4-column
 * montage PNG: white background, 2 px gaps, each cell ≤128 px.
 */
export async function renderMrcMontagePng(file: string, count = 8): Promise<Buffer | null> {
  const h = readMrcHeader(file);
  if (!h) return null;
  const n = Math.max(1, Math.min(16, Math.trunc(count) || 8, h.nz));
  const cellW = Math.min(MONTAGE_CELL, h.nx);
  const cellH = Math.min(MONTAGE_CELL, h.ny);
  const rows = Math.ceil(n / MONTAGE_COLS);
  const gap = MONTAGE_GAP;
  const gw = MONTAGE_COLS * cellW + (MONTAGE_COLS + 1) * gap;
  const gh = rows * cellH + (rows + 1) * gap;
  const grid = Buffer.alloc(gw * gh, 255); // white background

  for (let i = 0; i < n; i++) {
    const data = readMrcSlice(file, i, h);
    if (!data) continue;
    const small = downsample(data, h.nx, h.ny, MONTAGE_CELL);
    const cell = stretchToGray(small.values);
    const cx = gap + (i % MONTAGE_COLS) * (cellW + gap);
    const cy = gap + Math.floor(i / MONTAGE_COLS) * (cellH + gap);
    for (let y = 0; y < small.height && y < cellH; y++) {
      for (let x = 0; x < small.width && x < cellW; x++) {
        grid[(cy + y) * gw + (cx + x)] = cell[y * small.width + x];
      }
    }
  }
  return grayToPng(grid, gw, gh);
}

/** Render one slice of a stack enlarged for the dialog view (≤ 768 px). */
export async function renderMrcLargePng(file: string, slice: number): Promise<Buffer | null> {
  const h = readMrcHeader(file);
  if (!h) return null;
  const data = readMrcSlice(file, slice, h);
  if (!data) return null;
  const small = downsample(data, h.nx, h.ny, 768);
  const gray = stretchToGray(small.values);
  return grayToPng(gray, small.width, small.height);
}

/** MRC-format extensions (ctffind .ctf diagnostics are classic MRC too) */
export function mrcExtensions(): string[] {
  return [".mrc", ".mrcs", ".map", ".ccp4", ".ctf"];
}

export function isMrcPath(p: string): boolean {
  const lower = p.toLowerCase();
  return mrcExtensions().some((ext) => lower.endsWith(ext));
}
