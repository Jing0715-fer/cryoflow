/**
 * Minimal ambient types for gifenc@1.0.3 (ships no .d.ts) — only the API
 * surface CryoFlow uses in lib/gif-export.ts. Palette entries are [r,g,b]
 * triples; `quantize`/`applyPalette` talk in packed rgb565 by default and
 * both sides must agree on the format.
 */
declare module "gifenc" {
  export interface GIFEncoderInstance {
    /** `index` = palettized pixel indices; a palette is required on the
     *  first frame (auto header mode writes LSD/GCT/NetSCape ext there) */
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        /** ms — GIF stores centiseconds, the encoder rounds */
        delay?: number;
        /** -1 = play once, 0 = loop forever (default), >0 = repeat count */
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
        colorDepth?: number;
        first?: boolean;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(auto?: boolean): GIFEncoderInstance;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      /** default "rgb565" — applyPalette must use the same format */
      format?: "rgb565" | "rgb444" | "rgba4444";
      oneBitAlpha?: boolean | number;
      clearAlpha?: boolean;
      clearAlphaThreshold?: number;
      clearAlphaColor?: number;
    }
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: "rgb565" | "rgb444" | "rgba4444"
  ): Uint8Array;
}
