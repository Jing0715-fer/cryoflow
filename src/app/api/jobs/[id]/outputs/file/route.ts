import { NextRequest, NextResponse } from "next/server";
import { openSync, readSync, closeSync, createReadStream, statSync } from "fs";
import { Readable } from "stream";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { readPathrefTarget } from "@/lib/relion/pathref";
import { resolveInsideJobWorkdir } from "@/lib/relion/jobfile";
import { isLocalRequest } from "@/lib/http-guard";
import { fetchRemoteFileIntoWorkdir } from "@/lib/remote/remote-files";
import { isMrcPath, readMrcHeader, readMrcHistogram, readMrcVoxel, renderMrcLargePng, renderMrcMontagePng, renderMrcObliquePng, renderMrcOrthoPng, renderMrcSlicePng } from "@/lib/mrc";
import { displayPolarityFor } from "@/lib/render-polarity";
import { cachedComputeAsync } from "@/lib/relion/statcache";

export const dynamic = "force-dynamic";

// t665 — the heavy-render semaphore. A PNG render of a large frame is the
// box's heaviest single request (a 64 MB read + a sharp encode each); a
// 9-tile wall firing at once reset connections under this machine's
// memory regime before the stat cache could ever fill — the tiles showed
// "unavailable" on every cold visit. Two renders at a time, the rest
// queue: the browser waits for images (no img timeout), the queue drains
// as renders land, and repeat visits are stat-check hits that never take
// a slot at all (the cache is inside the slot).
let heavyRunning = 0;
const heavyQueue: (() => void)[] = [];
async function withHeavySlot<T>(fn: () => Promise<T>): Promise<T> {
  if (heavyRunning >= 2) {
    await new Promise<void>((release) => heavyQueue.push(release));
  }
  heavyRunning++;
  try {
    return await fn();
  } finally {
    heavyRunning--;
    heavyQueue.shift()?.();
  }
}

type RouteContext = { params: Promise<{ id: string }> };

const TEXT_TAIL = 64 * 1024; // last 64 KB for format=text

/* ------------------------------------------------------------------ */
/* Workdir + path safety                                               */
/* ------------------------------------------------------------------ */

// Unified containment policy shared with the outputs/star route — see
// src/lib/relion/jobfile.ts. Lexical workdir scoping + realpath inside the
// app data tree (engine-created cross-job symlinks stay inside it); the
// .pathref escape hatch below runs only AFTER this check accepts the marker.

function tailText(file: string): string {
  const size = statSync(file).size;
  const start = Math.max(0, size - TEXT_TAIL);
  const fd = openSync(file, "r");
  try {
    const len = size - start;
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, start);
    return buf.toString("utf8");
  } finally {
    closeSync(fd);
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/jobs/[id]/outputs/file                                     */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Hardening (#5, round 2): this route serves CONTENT BYTES from the job
    // workdir — and via the .pathref escape hatch from arbitrary import
    // sources on the host (cross-drive/UNC micrographs). Same-origin fetch
    // metadata + pinned Host header, same pair as /api/fs/browse: the
    // browser-always-sent headers a drive-by page cannot control, with Host
    // pinning catching the DNS-rebinding case the origin check alone
    // passes (see http-guard for the full threat model).
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site access to job outputs is not allowed" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir) {
      return NextResponse.json({ error: "No on-disk outputs for this job" }, { status: 400 });
    }

    const url = new URL(request.url);
    const rel = url.searchParams.get("path") ?? "";
    const format = url.searchParams.get("format") ?? "png";

    let resolved = resolveInsideJobWorkdir(run.workdir, rel);
    // t289 — the lazy leg: a remote run's bulky files stay on the cluster
    // (key-files policy) until an EXPLICIT user action asks for them. This
    // route is that ask — every format (png/raw/text/value/histogram)
    // funnels through the one resolution above, so the fetch here serves
    // gallery previews, browser downloads and Mol* alike. Only a remote
    // run pays the SSH round trip; local jobs keep the plain 404 path.
    if ("error" in resolved && resolved.error === "File not found" && run.remote) {
      const fetched = await fetchRemoteFileIntoWorkdir(
        { workdir: run.workdir, remote: run.remote },
        rel
      );
      if (fetched.ok) {
        resolved = resolveInsideJobWorkdir(run.workdir, rel);
      } else if (fetched.status !== 404) {
        return NextResponse.json({ error: fetched.error }, { status: fetched.status });
      }
      // a 404 from the fetch falls through to the original 404 below —
      // "not on disk AND not on the cluster" is simply not found
    }
    // t367 — the GHOST leg: the local mirror HOLDS an MRC-family file whose
    // header does not parse (a corrupt leftover a size-only sync-back once
    // adopted — the field report's zero-header classes stack). Serving its
    // bytes would dress corruption as a download; the fetch door re-pulls
    // instead (remoteDownload truncates and rewrites, so the ghost dies
    // here too), and the freshly-pulled bytes answer every format.
    let localHeaderReads = true;
    if (!("error" in resolved) && run.remote && isMrcPath(resolved.abs)) {
      try {
        localHeaderReads = readMrcHeader(resolved.abs) != null;
      } catch {
        localHeaderReads = false;
      }
    }
    if (!("error" in resolved) && run.remote && !localHeaderReads) {
      const fetched = await fetchRemoteFileIntoWorkdir(
        { workdir: run.workdir, remote: run.remote },
        rel
      );
      if (fetched.ok) {
        resolved = resolveInsideJobWorkdir(run.workdir, rel);
        if ("error" in resolved) {
          return NextResponse.json({ error: resolved.error }, { status: resolved.status });
        }
      }
      // a failed re-pull falls through: the parse below speaks the honest
      // "could not render" instead of streaming the ghost's bytes
    }
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    let { abs, name } = resolved;

    // pathref marker: the engine records UNLINKABLE import sources (Windows
    // cross-drive / \\wsl.localhost UNC — no hardlink, no symlink rights) as
    // micrographs/.<name>.pathref files whose content is the source path.
    // Follow the marker to serve the real file; markers are engine-written
    // only (no API writes into workdirs) and readPathrefTarget validates the
    // target is an existing regular file.
    if (name.endsWith(".pathref")) {
      const target = readPathrefTarget(abs);
      if (!target) {
        return NextResponse.json({ error: "Broken path reference (source moved or deleted)" }, { status: 404 });
      }
      abs = target;
      name = path.basename(target);
    }

    const lower = name.toLowerCase();
    const isMrc = isMrcPath(name);
    const isImage = lower.endsWith(".eps") || lower.endsWith(".pdf");
    const isTextual =
      !isMrc && !isImage && (lower.endsWith(".star") || /\.(log|txt|out|err|json|bild|dat|xml|com|lst|coord)$/i.test(lower));

    if (format === "raw") {
      // binary download — maps for Mol*, EPS/PDF reports for the browser.
      // STREAMED, not readFileSync: a 700³ float32 map is ~1.4 GB — loading
      // it into memory (twice, via the Uint8Array copy) OOM'd the dev server
      // and blocked the event loop for the whole read. The stream path keeps
      // memory flat and the loop free. Content-Length from the stat keeps the
      // download progress meaningful for the browser.
      if (!isMrc && !isImage) {
        return NextResponse.json({ error: "Raw format is for maps and image files" }, { status: 400 });
      }
      const size = statSync(abs).size;
      const safeName = name.replace(/[^A-Za-z0-9._-]/g, "_");
      const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream<Uint8Array>;
      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": String(size),
          "Cache-Control": "no-cache",
        },
      });
    }

    // t281 — the density probe: ONE voxel's value under the cursor. Same
    // containment chain as every other format (it runs after the workdir
    // scoping + realpath + pathref resolution above), but unlike png/raw
    // it serves a NUMBER, not bytes: the read is a single
    // `bytesPerVoxel` pread (readMrcVoxel) — hover-frequency polling is
    // effectively free, no plane buffer, no section scan.
    //   fx/fy  — the in-plane fractions (the tile's hAxis/vAxis frame,
    //            identical to what the pick handler computes)
    //   pos    — the plane's position along `axis` (the movement axis)
    // The axis→(hAxis,vAxis) mapping is the renderer's own (the tiles'
    // TileSpec): z → (x,y), y → (x,z), x → (y,z).
    if (format === "value") {
      if (!isMrc) {
        return NextResponse.json({ error: "Density probing is for MRC maps only" }, { status: 400 });
      }
      if (lower.endsWith(".mrcs")) {
        return NextResponse.json(
          { error: "Density probing is for 3D volumes — stacks browse images with slice/montage" },
          { status: 400 }
        );
      }
      const num = (k: string, fallback: number) => {
        const raw = url.searchParams.get(k);
        if (raw === null) return fallback;
        const v = Number.parseFloat(raw);
        return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
      };
      const axisParam = (url.searchParams.get("axis") ?? "z").toLowerCase();
      const axis = axisParam === "x" || axisParam === "y" || axisParam === "z" ? axisParam : "z";
      const pos = num("pos", 0.5);
      const fx = num("fx", 0.5);
      const fy = num("fy", 0.5);
      // plane position + in-plane fractions → the volume fractions the
      // reader speaks (fx rides hAxis, fy rides vAxis — the TileSpec map)
      const vf =
        axis === "z"
          ? { fx, fy, fz: pos }
          : axis === "y"
            ? { fx, fy: pos, fz: fy }
            : { fx: pos, fy: fx, fz: fy };
      const hit = readMrcVoxel(abs, vf.fx, vf.fy, vf.fz);
      if (!hit) {
        return NextResponse.json({ error: "Could not read this map" }, { status: 400 });
      }
      return NextResponse.json(
        {
          jobId: job.id,
          axis,
          value: hit.value,
          voxel: { x: hit.ix, y: hit.iy, z: hit.iz },
        },
        { headers: { "Cache-Control": "no-cache" } }
      );
    }

    // t283 — the histogram instrument: the WHOLE volume's density
    // distribution in one JSON payload. Same containment chain as every
    // other format, but like "value" it serves NUMBERS, not bytes. The
    // reader walks the file chunked (O(1) memory, two passes) and caches
    // per (path, mtime, size, slice) — panel-open frequency, not hover
    // frequency.
    // t287 — STACKS SPEAK NOW: a .mrcs must name its slice (&slice=N,
    // 0-based), and the payload is THAT particle image's distribution —
    // "is this particle even usable?" answered per image, not as the
    // stack-wide blur of thousands. The slice is REQUIRED for stacks
    // (an un-named stack histogram would be exactly that blur — a
    // number with no subject); a VOLUME with a slice is refused (the
    // volume's histogram is the whole grid — silently ignoring the
    // parameter would be a lie), and a missing slice gets an
    // actionable 400 that names the range.
    if (format === "histogram") {
      if (!isMrc) {
        return NextResponse.json({ error: "The density histogram is for MRC maps only" }, { status: 400 });
      }
      const isStack = lower.endsWith(".mrcs");
      const sliceRaw = url.searchParams.get("slice");
      let slice: number | undefined;
      if (isStack) {
        if (sliceRaw === null) {
          return NextResponse.json(
            { error: "Stacks histogram per slice — pass &slice=N (0-based)" },
            { status: 400 }
          );
        }
        const s = Number.parseFloat(sliceRaw);
        if (!Number.isFinite(s) || !Number.isInteger(s)) {
          return NextResponse.json({ error: "slice must be an integer (0-based)" }, { status: 400 });
        }
        const hdr = readMrcHeader(abs);
        if (!hdr) {
          return NextResponse.json({ error: "Could not read this map" }, { status: 400 });
        }
        if (s < 0 || s >= hdr.nz) {
          return NextResponse.json(
            { error: `slice out of range — this stack holds ${hdr.nz} images (0…${hdr.nz - 1})` },
            { status: 400 }
          );
        }
        slice = s;
      } else if (sliceRaw !== null) {
        return NextResponse.json(
          { error: "slice is for stacks — a volume's histogram is the whole grid" },
          { status: 400 }
        );
      }
      const hist = readMrcHistogram(abs, slice);
      if (!hist) {
        return NextResponse.json({ error: "Could not read this map" }, { status: 400 });
      }
      return NextResponse.json(
        { jobId: job.id, file: name, slice: slice ?? null, ...hist },
        { headers: { "Cache-Control": "no-cache" } }
      );
    }

    if (format === "png") {
      if (!isMrc) {
        return NextResponse.json({ error: "PNG rendering is for MRC maps only" }, { status: 400 });
      }
      const montageParam = url.searchParams.get("montage");
      const sliceParam = url.searchParams.get("slice");
      const scale = url.searchParams.get("scale") ?? "thumb";
      let png: Buffer | null = null;
      const isStack = lower.endsWith(".mrcs");

      // t286 — the display window: the histogram (or a drag on it) can
      // COMMAND the render. lo → black, hi → white, literal mapping (no
      // auto-inversion). Only a PAIR of finite numbers with hi > lo is a
      // window; anything else (missing, garbage, inverted) means AUTO —
      // the 2–98 percentile stretch answers, as it always has.
      let win: { lo: number; hi: number } | undefined;
      const loRaw = url.searchParams.get("lo");
      const hiRaw = url.searchParams.get("hi");
      if (loRaw !== null && hiRaw !== null) {
        const loV = Number.parseFloat(loRaw);
        const hiV = Number.parseFloat(hiRaw);
        if (Number.isFinite(loV) && Number.isFinite(hiV) && hiV > loV) {
          win = { lo: loV, hi: hiV };
        }
      }

      // orthogonal plane request? axis = the plane's normal/movement axis
      // (x|y|z), pos ∈ 0…1 positions it inside the box. Volumes only —
      // for .mrcs stacks the X/Y "planes" are in-image axes, and the Z
      // axis is already covered by the slice/montage renders below.
      const axisParam = (url.searchParams.get("axis") ?? "z").toLowerCase();
      const axis = axisParam === "x" || axisParam === "y" || axisParam === "z" ? axisParam : "z";
      const posRaw = url.searchParams.get("pos");
      const toPos = () => {
        const p = posRaw !== null ? Number.parseFloat(posRaw) : 0.5;
        return Number.isFinite(p) ? p : 0.5;
      };
      // t380 — display polarity pinned by the import job's negative-stain
      // checkbox: "auto" (cryo, flip negative-dominant images bright-on-black)
      // or "negativeStain" (stained particles are positive density, never flip).
      // Resolved ONCE per request from the job's own params or its import
      // ancestor; an explicit lo/hi window still bypasses all of this.
      const polarity = await displayPolarityFor(job);
      // t555 — plane=oblique is the plane family the box axes don't
      // cover: theta (polar, deg), phi (azimuth, deg) name the normal,
      // offset ∈ −1…1 rides it (fraction of the box's support). Same
      // window/polarity pipeline, same volumes-only law as axis planes.
      const planeParam = url.searchParams.get("plane");
      // the volume-only laws hoisted out of the render (they are
      // request-shape validations — a cache miss never needs to reach
      // them, and the cached compute below stays a pure render)
      if (isStack && (planeParam === "oblique" || axis !== "z")) {
        return NextResponse.json(
          { error: planeParam === "oblique"
            ? "Oblique planes are for 3D volumes — stacks browse images with slice/montage"
            : "Orthogonal planes are for 3D volumes — stacks browse images with slice/montage" },
          { status: 400 }
        );
      }
      // t665 — the render rides the stat cache: a wall re-mount (reopen,
      // deep link, palette jump, tab round-trip) re-requests the SAME
      // tiles, and every miss used to re-read a 64 MB frame + re-encode
      // — under the box's memory regime the burst reset connections and
      // the original legs showed "unavailable". The key carries every
      // param that reaches the render + the resolved polarity; the
      // (size, mtime) slot key invalidates when the file changes; a
      // THROWN render (transient pressure) is not cached — the next
      // request retries; a null render (unparseable file) is — the
      // file's own bytes answer "no" deterministically.
      const pngKey = `png|scale=${scale}|m=${montageParam}|s=${sliceParam}|ax=${axis}|pos=${posRaw ?? ""}|pl=${planeParam ?? ""}|th=${url.searchParams.get("theta")}|ph=${url.searchParams.get("phi")}|of=${url.searchParams.get("offset")}|lo=${loRaw ?? ""}|hi=${hiRaw ?? ""}|pol=${polarity}`;
      png = await cachedComputeAsync(abs, pngKey, () =>
        // only a MISS takes a heavy slot — a hit is a stat check
        withHeavySlot(async () => {
          if (planeParam === "oblique") {
            const num = (raw: string | null, lo: number, hi: number, dflt: number) => {
              const v = raw !== null ? Number.parseFloat(raw) : NaN;
              return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
            };
            const theta = num(url.searchParams.get("theta"), 0, 180, 0);
            const phi = num(url.searchParams.get("phi"), 0, 360, 0);
            const offset = num(url.searchParams.get("offset"), -1, 1, 0);
            return renderMrcObliquePng(abs, theta, phi, offset, undefined, win, polarity);
          }
          if (axis !== "z") {
            return renderMrcOrthoPng(abs, axis, toPos(), undefined, win, polarity);
          }
          if (!isStack && posRaw !== null) {
            // fractional z plane (pos) — without pos, the legacy slice/montage
            // params below keep their meaning
            return renderMrcOrthoPng(abs, "z", toPos(), undefined, win, polarity);
          }
          if (isStack && montageParam !== "0") {
            const n = Math.min(16, Math.max(1, Number.parseInt(montageParam ?? "8", 10) || 8));
            return renderMrcMontagePng(abs, n, win, polarity);
          }
          if (scale === "large") {
            const slice = sliceParam !== null ? Number.parseInt(sliceParam, 10) || 0 : 0;
            return renderMrcLargePng(abs, slice, win, polarity);
          }
          const slice = sliceParam !== null ? Number.parseInt(sliceParam, 10) || 0 : undefined;
          return renderMrcSlicePng(abs, slice, win, polarity);
        })
      );
      if (!png) {
        return NextResponse.json({ error: "Could not render this MRC file" }, { status: 400 });
      }
      return new NextResponse(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache",
        },
      });
    }

    if (format === "text") {
      if (!isTextual) {
        return NextResponse.json({ error: "Text preview is for log/text files" }, { status: 400 });
      }
      const text = tailText(abs);
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    return NextResponse.json({ error: "Unknown format (expected png, raw, value or text)" }, { status: 400 });
  } catch (error) {
    console.error("GET /api/jobs/[id]/outputs/file failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
