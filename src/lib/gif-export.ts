/**
 * CryoFlow — animated-GIF export for the turntable recorder (client).
 *
 * The turntable already records an archival WebM via MediaRecorder; this
 * module hand-rolls the slide-deck-friendly sibling: per-frame 256-color
 * quantization (rgb565 median-cut from gifenc) over evenly sampled plates
 * of the SAME composite canvas the video is captured from — bg color,
 * figure footer, caption and overlay legend all come along, so the GIF is
 * self-describing exactly like the stills and clips.
 *
 * Frame budget: ≤90 ImageData plates at 480 px wide (~50 MB heap worst
 * case) sampled by the caller during the spin; encoding runs AFTER the
 * recorder has wound down so the capture never stutters. Each frame yields
 * to the event loop so the progress badge paints and a pending unmount can
 * cancel the rest via `alive`.
 */

export interface GifEncodeProgress {
  done: number;
  total: number;
}

export interface GifEncodeOptions {
  /** progress sink for UI badges — fires once per encoded frame */
  onProgress?: (p: GifEncodeProgress) => void;
  /** cancel check — when it turns false the encode aborts with "gif-cancelled" */
  alive?: () => boolean;
}

/** GIF frame delays are stored in centiseconds; sub-20 ms frames get
 *  clamped by browsers anyway, so keep the floor honest */
export function gifDelayMs(rawMs: number): number {
  const cs = Math.max(2, Math.round(rawMs / 10));
  return cs * 10;
}

export async function encodeGifFrames(
  frames: ImageData[],
  delayMs: number,
  opts: GifEncodeOptions = {}
): Promise<Blob> {
  if (frames.length < 2) throw new Error("A GIF needs at least two frames.");
  // dynamic import keeps gifenc out of the viewer's initial chunk — it is
  // only needed on the encode path, seconds after the user pressed record
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  const delay = gifDelayMs(delayMs);
  for (let i = 0; i < frames.length; i++) {
    if (opts.alive && !opts.alive()) throw new Error("gif-cancelled");
    const f = frames[i];
    const palette = quantize(f.data, 256);
    const index = applyPalette(f.data, palette, "rgb565");
    gif.writeFrame(index, f.width, f.height, { palette, delay, repeat: 0 });
    opts.onProgress?.({ done: i + 1, total: frames.length });
    // macrotask yield — rAF paints the badge, React can flush, the user
    // can still close the viewer (which flips `alive` for the next frame)
    await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();
  return new Blob([gif.bytes() as unknown as BlobPart], { type: "image/gif" });
}
