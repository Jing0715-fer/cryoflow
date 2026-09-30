/**
 * t519 — turn the AI-generated 4x4 class sheet into a 12-frame mrcs.
 * Crops the bottom row (4x4 → 4x3), tiles 12 boxes, each resized to 64x64
 * grayscale, packed as one mode-2 float32 MRC stack.
 */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SRC = ".qa-logs/t519-class-sheet-ref.png";
const OUT = "data/relion/cmuoc66gl000eok6nplid8vmm/class2d_6kau3twp/run_it200_classes.mrcs";
const N = 64;

const img = sharp(SRC).removeAlpha();
const { data, info } = await img.greyscale().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
console.log(`source ${W}x${H}`);

// crop to top 3/4 (the 4x3 region)
const rows = 3, cols = 4;
const cellW = Math.floor(W / cols), cellH = Math.floor(H / 4);

const frames = [];
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const box = await sharp(Buffer.from(data), {
      raw: { width: W, height: H, channels: info.channels },
    })
      .extract({ left: c * cellW, top: r * cellH, width: cellW, height: cellH })
      .resize(N, N, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();
    frames.push(box);
  }
}

const header = Buffer.alloc(1024);
header.writeInt32LE(N, 0); header.writeInt32LE(N, 4); header.writeInt32LE(frames.length, 8);
header.writeInt32LE(2, 12);
header.writeInt32LE(1, 16); header.writeInt32LE(1, 20); header.writeInt32LE(0, 24);
header.writeInt32LE(N, 28); header.writeInt32LE(N, 32); header.writeInt32LE(frames.length, 36);
header.writeFloatLE(1.0, 40); header.writeFloatLE(1.0, 44); header.writeFloatLE(1.0, 48);

const body = Buffer.alloc(N * N * frames.length * 4);
let off = 0;
for (const f of frames)
  for (const v of f) {
    body.writeFloatLE(v / 255, off);
    off += 4;
  }
writeFileSync(OUT, Buffer.concat([header, body]));
console.log(`written ${OUT}: ${frames.length} frames of ${N}x${N} (${1024 + body.length} bytes)`);
