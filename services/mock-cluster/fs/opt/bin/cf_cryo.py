#!/usr/bin/env python3
"""cf_cryo.py — shared cryo-physics realism for the mock RELION binaries (t380).

The EMPIAR-10017 full-chain ask: every stage's .mrcs/.mrc must be a REAL,
renderable file whose PIXELS follow cryo-EM physics, so the app's display
polarity path (mrc.ts stretchToGray) is exercised by real data end to end:

  · raw micrographs  — all-positive ice + DARK protein blobs (cryo truth:
                       particles are black in the micrograph, exactly the
                       user's field report)
  · extracted boxes  --norm → solvent ≈ 0 σ≈1, particle NEGATIVE (below the
                       mean) — RELION's own normalization dialect
  · class averages   — averaged REAL crops: negative particle over flattened
                       solvent; a deterministic subset of classes carries the
                       weak-contrast shape (ratio ~1.05–1.15) that used to
                       fall in the 1.2× gate's dead zone and rendered BLACK
  · 3D volumes/maps  — negative-density core (protein) over zero-mean solvent

Every helper degrades honestly: numpy is used when importable (it is on this
mock's python), the pure-python fallback still works, and unreadable input
returns None so each binary can keep its legacy synthetic path for suites
that feed text-placeholder fixtures.
"""
import math
import os
import struct

try:
    import numpy as _np
except Exception:  # pragma: no cover — the mock's python always has it
    _np = None


# ---------------------------------------------------------------- MRC I/O --

def read_mrc(path):
    """Read a mode-2 float32 MRC. Returns (nx, ny, nz, numpy.ndarray) or None.

    The header check mirrors the app's readMrcHeader: MAP magic, plausible
    dims, mode 2, NSYMBT-aware data offset.
    """
    try:
        with open(path, "rb") as fh:
            head = fh.read(1024)
            if len(head) < 1024:
                return None
            if head[208:212] != b"MAP ":
                return None
            nx, ny, nz = struct.unpack_from("<3i", head, 0)
            mode = struct.unpack_from("<i", head, 12)[0]
            nsymbt = struct.unpack_from("<i", head, 92)[0]
            if mode != 2:
                return None
            if not (0 < nx <= 8192 and 0 < ny <= 8192 and 0 < nz <= 4096):
                return None
            n = nx * ny * nz
            fh.seek(1024 + nsymbt)
            data = fh.read(n * 4)
            if len(data) < n * 4:
                return None
            if _np is not None:
                vals = _np.frombuffer(data, dtype="<f4").reshape((nz, ny, nx)).copy()
            else:
                vals = list(struct.unpack(f"<{n}f", data))
            return nx, ny, nz, vals
    except Exception:
        return None


def write_mrc(path, nx, ny, nz, vals, angpix=1.0):
    """Write a mode-2 float32 MRC2014 (the same offsets the other fakes use).

    `vals` is a flat float sequence of nx*ny*nz values (z-major, row-major
    per plane — the MRC layout).
    """
    if _np is not None and isinstance(vals, _np.ndarray):
        flat = vals.reshape(-1).astype("<f4")
        dmin = float(flat.min())
        dmax = float(flat.max())
        dmean = float(flat.mean())
        payload = flat.tobytes()
    else:
        flat = list(vals)
        dmin = min(flat) if flat else 0.0
        dmax = max(flat) if flat else 0.0
        dmean = (sum(flat) / len(flat)) if flat else 0.0
        payload = struct.pack(f"<{len(flat)}f", *flat)
    header = bytearray(1024)
    struct.pack_into("<3i", header, 0, nx, ny, nz)                    # NX NY NZ
    struct.pack_into("<i", header, 12, 2)                             # MODE float32
    struct.pack_into("<3i", header, 16, 0, 0, 0)                      # NXSTART…
    struct.pack_into("<3i", header, 28, nx, ny, nz)                   # MX MY MZ
    struct.pack_into("<3f", header, 40, float(nx) * angpix, float(ny) * angpix, float(nz) * angpix)
    struct.pack_into("<3f", header, 52, 90.0, 90.0, 90.0)             # CELLB
    struct.pack_into("<3i", header, 64, 1, 2, 3)                      # MAPC MAPR MAPS
    struct.pack_into("<3f", header, 76, dmin, dmax, dmean)            # DMIN DMAX DMEAN
    struct.pack_into("<i", header, 88, 1)                             # ISPG
    struct.pack_into("<i", header, 92, 0)                             # NSYMBT
    struct.pack_into("<3f", header, 96, 0.0, 0.0, 0.0)                # ORIGIN
    header[208:212] = b"MAP "
    header[212:216] = b"\x44\x41\x00\x00"                             # MACHST LE
    struct.pack_into("<f", header, 216, 0.29)                         # RMS
    struct.pack_into("<i", header, 220, 1)                            # NLABL
    with open(path, "wb") as fh:
        fh.write(header)
        fh.write(payload)


# --------------------------------------------------------- dark-blob picks --

def dark_blob_picks(vals, nx, ny, diam_min_px, diam_max_px, threshold=0.0, max_picks=300):
    """LoG-style dark-blob detection on a REAL micrograph.

    Downsamples 4× (speed), difference-of-box-means at the two pick scales
    (diam_min/diam_max from --LoG_diam_min/max), and takes local maxima of
    the DoG response whose small-window mean sits clearly BELOW the image
    mean — i.e. the dark protein blobs. `threshold` (LoG_adjust_threshold,
    RELION semantics: lower → more picks) shifts the cut. Returns a list of
    (x, y) in ORIGINAL pixel coordinates, or [] when nothing clears the bar.
    """
    if _np is None or not len(vals):
        return []
    img = _np.asarray(vals, dtype=_np.float32).reshape(ny, nx)
    step = 4
    small = img[::step, ::step]
    h, w = small.shape
    if h < 32 or w < 32:
        return []
    # integral image → O(1) window means at any radius
    ii = _np.zeros((h + 1, w + 1), dtype=_np.float64)
    ii[1:, 1:] = _np.cumsum(_np.cumsum(small, axis=0), axis=1)

    def box_mean(r):
        # window of radius r px (in downsampled space), clamped at edges
        r = max(1, int(round(r)))
        k = 2 * r + 1
        s = ii[r + 1 : h + 1, r + 1 : w + 1] - ii[0 : h - r, r + 1 : w + 1] \
            - ii[r + 1 : h + 1, 0 : w - r] + ii[0 : h - r, 0 : w - r]
        return s / float(k * k)

    r_small = max(2.0, (diam_min_px / step) / 2.0)
    r_large = max(r_small + 1.0, (diam_max_px / step) / 2.0)
    m_small = box_mean(r_small)
    m_large = box_mean(r_large)
    # the two radii clamp differently at the borders — trim to the common
    # interior shape so the difference is element-wise honest
    hh = min(m_small.shape[0], m_large.shape[0])
    ww = min(m_small.shape[1], m_large.shape[1])
    m_small = m_small[:hh, :ww]
    m_large = m_large[:hh, :ww]
    dog = m_large - m_small  # dark blob on flat ice → positive response
    img_mean = float(small.mean())
    img_std = float(small.std()) or 1.0
    # darkness bar: the blob's core sits well below the ice plane; the
    # threshold knob shifts it RELION-style (lower threshold → more picks)
    dark_bar = img_mean - img_std * (0.9 + max(0.0, threshold))
    dog_bar = float(dog.std()) * (1.2 - min(0.9, max(0.0, threshold) * 0.5))
    core = m_small[1:-1, 1:-1] < dark_bar  # interior region only
    d = dog[1:-1, 1:-1]
    peak = (d >= _np.roll(d, 1, 0)) & (d > _np.roll(d, -1, 0)) & \
           (d >= _np.roll(d, 1, 1)) & (d > _np.roll(d, -1, 1))
    ys, xs = _np.nonzero(peak & core & (d > dog_bar))
    # order the candidates by response strength — then greedily accept the
    # strongest, suppressing any neighbour within diam_min/2 (one blob,
    # one pick — the DoG plateaus can otherwise yield double detections)
    order = _np.argsort(d[ys, xs])[::-1] if len(ys) else []
    # refinement kernel: an 11×11 block mean fights the ice noise (a single
    # darkest pixel wanders ±10 px at σ=140; the blob's mean dip is stable)
    k = 2 * 5 + 1
    pad = _np.pad(img.astype(_np.float64), k // 2, mode="edge")
    csum = _np.cumsum(_np.cumsum(pad, axis=0), axis=1)
    csum = _np.pad(csum, ((1, 0), (1, 0)), mode="constant")
    blk = (csum[k:, k:] - csum[:-k, k:] - csum[k:, :-k] + csum[:-k, :-k]) / float(k * k)
    min_dist = max(6.0, diam_min_px / 2.0)
    picks = []
    for idx in order:
        y = int(ys[idx])
        x = int(xs[idx])
        px = (x + 1) * step
        py = (y + 1) * step
        if any(((px - qx) ** 2 + (py - qy) ** 2) ** 0.5 < min_dist for (qx, qy) in picks):
            continue
        # refine to the darkest 11×11 BLOCK in a ±3·step window — the
        # downsampled grid quantises the peak, Extract deserves the true
        # blob centre (and the class average its centred particle)
        ry0 = max(0, py - 3 * step)
        ry1 = min(ny, py + 3 * step + 1) - k + 1
        rx0 = max(0, px - 3 * step)
        rx1 = min(nx, px + 3 * step + 1) - k + 1
        if ry1 <= ry0 or rx1 <= rx0:
            continue
        win = blk[ry0:ry1, rx0:rx1]
        if win.size == 0:
            continue
        dy, dx = _np.unravel_index(int(_np.argmin(win)), win.shape)
        picks.append((rx0 + int(dx) + k // 2, ry0 + int(dy) + k // 2))
        if len(picks) >= max_picks:
            break
    return picks


# ------------------------------------------------------ crop + normalize --

def crop_box(vals, nx, ny, cx, cy, box):
    """Crop a box×box window centred on (cx, cy) — RELION's extract geometry.
    Returns None when the box crosses the micrograph edge (RELION refuses
    those picks too)."""
    half = box // 2
    x0 = int(round(cx)) - half
    y0 = int(round(cy)) - half
    if x0 < 0 or y0 < 0 or x0 + box > nx or y0 + box > ny:
        return None
    if _np is not None:
        img = _np.asarray(vals, dtype=_np.float32).reshape(ny, nx)
        return img[y0 : y0 + box, x0 : x0 + box].copy()
    out = []
    for y in range(y0, y0 + box):
        base = y * nx
        for x in range(x0, x0 + box):
            out.append(vals[base + x])
    return out


def downsample_box(boxvals, target):
    """Block-mean downsample to target×target (RELION --scale in extract)."""
    box = boxvals.shape[0] if _np is not None and hasattr(boxvals, "shape") else int(math.sqrt(len(boxvals)))
    if target >= box or target <= 0:
        return boxvals
    if _np is not None and hasattr(boxvals, "shape"):
        f = box // target
        if f * target != box:  # non-integer factor: nearest resize fallback
            ys = _np.linspace(0, box - 1, target).round().astype(int)
            return boxvals[_np.ix_(ys, ys)]
        return boxvals.reshape(target, f, target, f).mean(axis=(1, 3))
    out = []
    f = box // target
    for y in range(target):
        for x in range(target):
            s = 0.0
            for dy in range(f):
                for dx in range(f):
                    s += boxvals[(y * f + dy) * box + (x * f + dx)]
            out.append(s / (f * f))
    return out


def normalize_box(boxvals, bg_radius):
    """RELION --norm: rim-annulus background → zero mean, unit σ.

    The particle (a DARK cryo blob) lands NEGATIVE — the polarity the app's
    display flips to bright-on-black. bg_radius is the annulus inner radius
    in px (the engine's --bg_radius)."""
    if _np is not None and hasattr(boxvals, "shape"):
        box = boxvals.shape[0]
        yy, xx = _np.mgrid[0:box, 0:box]
        c = (box - 1) / 2.0
        rr = _np.sqrt((yy - c) ** 2 + (xx - c) ** 2)
        r_in = max(2, int(bg_radius)) if bg_radius and bg_radius > 0 else max(2, int(box * 0.375))
        r_out = min(box / 2.0 - 1, r_in + max(3, box // 12))
        rim = (rr >= r_in) & (rr <= r_out)
        if rim.sum() < 8:
            rim = rr >= box * 0.42
        bg = boxvals[rim]
        mean = float(bg.mean())
        std = float(bg.std()) or 1.0
        return (boxvals - mean) / std
    box = int(math.sqrt(len(boxvals)))
    c = (box - 1) / 2.0
    r_in = max(2, int(bg_radius)) if bg_radius and bg_radius > 0 else max(2, int(box * 0.375))
    r_out = min(box / 2.0 - 1, r_in + max(3, box // 12))
    rim = []
    for y in range(box):
        for x in range(box):
            r = math.hypot(x - c, y - c)
            if r_in <= r <= r_out:
                rim.append(boxvals[y * box + x])
    mean = sum(rim) / len(rim) if rim else 0.0
    var = sum((v - mean) ** 2 for v in rim) / len(rim) if rim else 1.0
    std = math.sqrt(var) or 1.0
    return [(v - mean) / std for v in boxvals]


# ------------------------------------------------- class averages / maps --

def class_image(box, member_boxes, amp=1.0, seed=1):
    """One 2D class average from REAL member crops (or synthetic when the
    list is empty): zero-mean solvent noise + the NEGATIVE particle signal.

    `amp` scales the PARTICLE SIGNAL only (not the solvent noise) — the
    t380 dead-zone lever: amp≈0.08 puts the negative dominance at ratio
    ~1.05–1.15, the exact shape that the OLD 1.2× gate refused to flip
    (particles rendered BLACK) and the t380 1.0× gate now flips
    (bright-on-black). A uniform image scale would leave the ratio
    untouched — the noise floor must stay put while the signal shrinks.
    """
    if _np is None:
        raise RuntimeError("numpy required for class_image")
    rng = _np.random.default_rng(seed)
    if member_boxes:
        stack = _np.stack(member_boxes).astype(_np.float32)
        mean_img = stack.mean(axis=0)
        # signal = deviation from the solvent plane (the blob, negative);
        # the noise floor is FRESH flattened-solvent noise at the real
        # solvent σ (averaging has already shrunk it ~1/√N — restore the
        # honest per-class level so amp has a stable floor to modulate)
        sig = mean_img - float(mean_img.mean())
        solvent_sigma = float(stack[:, 8:16, 8:16].std()) if stack.ndim == 3 else 0.35
        if not (0.05 < solvent_sigma < 3.0):
            solvent_sigma = 0.35
        noise = rng.standard_normal((box, box)).astype(_np.float32) * max(0.12, solvent_sigma * 0.35)
        return (sig * amp + noise).astype(_np.float32)
    # synthetic fallback: negative blob + noise
    img = _np.zeros((box, box), dtype=_np.float32)
    c = (box - 1) / 2.0
    r_blob = box * 0.30
    yy, xx = _np.mgrid[0:box, 0:box]
    rr = _np.sqrt((yy - c) ** 2 + (xx - c) ** 2)
    img -= 1.4 * _np.exp(-(rr ** 2) / (2 * (r_blob * 0.55) ** 2))
    noise = (rng.random((box, box), dtype=_np.float32) - 0.5) * 0.5
    mean_img = img + noise
    sig = mean_img - float(mean_img.mean())
    return (sig * amp + noise * (1.0 - amp)).astype(_np.float32)


def weak_class_preset(ncls):
    """Which class indices carry the t380 dead-zone amplitude (1-based).
    Deterministic: every 4th class (c % 4 == 3) is weak-contrast."""
    return {c for c in range(1, ncls + 1) if c % 4 == 3}


def negative_volume(dim, seed=1):
    """A 3D map in RELION's density convention: NEGATIVE protein core over
    zero-mean solvent noise — the app's ortho planes flip it to a bright
    blob, exactly like a real run_class001.mrc."""
    if _np is None:
        raise RuntimeError("numpy required for negative_volume")
    rng = _np.random.default_rng(seed)
    noise = (rng.random((dim, dim, dim), dtype=_np.float32) - 0.5) * 0.4
    zz, yy, xx = _np.mgrid[0:dim, 0:dim, 0:dim]
    c = (dim - 1) / 2.0
    r = _np.sqrt((xx - c) ** 2 + (yy - c) ** 2 + (zz - c) ** 2)
    # core σ ≈ 0.16·dim: the protein fills ~1/3 of the box diameter and the
    # solvent shell stays noise-dominated (positive tail intact — a blanket
    # Gaussian would make every slice all-negative, a shape no real map has)
    core = -1.6 * _np.exp(-(r ** 2) / (2 * (dim * 0.16) ** 2))
    return (noise + core).astype(_np.float32)
