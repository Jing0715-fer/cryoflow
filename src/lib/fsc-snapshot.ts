/**
 * CryoFlow — FSC curve snapshot + milestone table for the Markdown run report.
 *
 * The report needs a curve image that renders identically everywhere it is
 * pasted (lab notes, issues, chat), so we do NOT scrape the recharts DOM —
 * the chart inherits Tailwind classes (`text-muted-foreground` on axes,
 * `currentColor` grid) that vanish the moment the SVG leaves the page.
 * Instead we draw a self-contained SVG from the /api/jobs/[id]/fsc payload
 * with explicit colors and a white background, then rasterize it to a PNG
 * data URL via canvas at 2× for crisp embedding.
 *
 * Every step is fail-soft: `buildFscSvg` returns null when the data cannot
 * be plotted, `svgToPngDataUrl` resolves null when the browser refuses the
 * conversion. The report earns its image or ships an honest gap — never a
 * broken embed.
 */

export interface FscSnapshotShell {
  freq: number;
  res: number;
  fsc: number;
  correctedFsc?: number;
  phaseRandomizedFsc?: number;
}

export interface FscSnapshotInput {
  /** job name — used for the in-image title */
  title: string;
  source: "postprocess" | "model" | null;
  sourceFile: string | null;
  shells: FscSnapshotShell[];
  resolutionAt143: number | null;
}

/* ------------------------------------------------------------------ */
/* milestone table — FSC at conventional resolution checkpoints        */
/* ------------------------------------------------------------------ */

export interface FscMilestoneRow {
  /** actual sampled resolution (Å) of the nearest shell */
  res: number;
  /** unmasked (model: gold-standard) FSC */
  fsc: number;
  corrected: number | null;
  phaseRand: number | null;
}

/** conventional checkpoint resolutions, low → high; shells within 15 % of
 *  a checkpoint earn a row, checkpoints with no nearby shell stay absent */
const MILESTONES = [20, 15, 10, 8, 6, 5, 4, 3.5, 3, 2.5];

const finite = (v: number | undefined): number | null =>
  v != null && Number.isFinite(v) ? v : null;

export function fscMilestones(shells: FscSnapshotShell[]): FscMilestoneRow[] {
  const sorted = shells
    .filter((s) => Number.isFinite(s.res) && s.res > 0 && Number.isFinite(s.fsc))
    .sort((a, b) => a.res - b.res);
  // claim nearest shell per checkpoint; two checkpoints can race for the
  // same shell — the closer one keeps it (no duplicate rows)
  const claims = new Map<number, { m: number; d: number }>();
  for (const m of MILESTONES) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < sorted.length; i++) {
      const d = Math.abs(sorted[i].res - m);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0 || bestD > m * 0.15) continue;
    const cur = claims.get(best);
    if (!cur || bestD < cur.d) claims.set(best, { m, d: bestD });
  }
  return [...claims.entries()]
    .sort((a, b) => b[1].m - a[1].m)
    .map(([i]) => {
      const s = sorted[i];
      return {
        res: s.res,
        fsc: s.fsc,
        corrected: finite(s.correctedFsc),
        phaseRand: finite(s.phaseRandomizedFsc),
      };
    });
}

/** Markdown table from milestone rows; column set follows the source
 *  (postprocess carries corrected + phase-rand curves, model does not).
 *  Returns null when there is nothing to tabulate. */
export function fscTableMarkdown(
  rows: FscMilestoneRow[],
  source: "postprocess" | "model" | null
): string | null {
  if (rows.length === 0) return null;
  const isPost = source === "postprocess";
  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(3));
  const head = isPost
    ? "| Resolution (Å) | Unmasked FSC | Masked + corrected | Phase-rand noise |"
    : "| Resolution (Å) | Gold-standard FSC |";
  const sep = isPost ? "| ---: | ---: | ---: | ---: |" : "| ---: | ---: |";
  const lines = rows.map((r) =>
    isPost
      ? `| ${r.res.toFixed(2)} | ${fmt(r.fsc)} | ${fmt(r.corrected)} | ${fmt(r.phaseRand)} |`
      : `| ${r.res.toFixed(2)} | ${fmt(r.fsc)} |`
  );
  return [head, sep, ...lines].join("\n");
}

/** highest sampled spatial frequency → its resolution = the box Nyquist
 *  limit (2 × pixel size). Null when no usable frequency column. */
export function fscNyquist(shells: FscSnapshotShell[]): number | null {
  const freqs = shells
    .map((s) => s.freq)
    .filter((f) => Number.isFinite(f) && f > 0);
  if (freqs.length === 0) {
    const ress = shells.map((s) => s.res).filter((r) => Number.isFinite(r) && r > 0);
    return ress.length > 0 ? Math.min(...ress) : null;
  }
  return 1 / Math.max(...freqs);
}

/* ------------------------------------------------------------------ */
/* snapshot SVG — self-contained, explicit colors, white background    */
/* ------------------------------------------------------------------ */

export const FSC_SNAPSHOT = { width: 640, height: 280 };

const C = {
  teal: "#14b8a6",
  amber: "#f59e0b",
  zinc: "#71717a",
  text: "#18181b",
  muted: "#71717a",
  faint: "#a1a1aa",
  grid: "#e4e4e7",
  gridSoft: "#f4f4f5",
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fx = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : "0");

/** log-scale x ticks from the {1,2,5}×10^k ladder — the FSC x-axis spans
 *  two decades (first shell ~100 Å → Nyquist ~3 Å) and a linear axis
 *  crushes the informative high-res end, same reason the in-app chart
 *  uses scale="log". */
function logTicks(min: number, max: number): number[] {
  if (!(min > 0) || !(max > min)) return [];
  const out: number[] = [];
  const lo = Math.floor(Math.log10(min));
  const hi = Math.ceil(Math.log10(max));
  for (let k = lo; k <= hi; k++) {
    for (const m of [1, 2, 5]) {
      const v = m * Math.pow(10, k);
      if (v >= min * 0.999 && v <= max * 1.001) out.push(Number(v.toPrecision(6)));
    }
  }
  return out;
}

/** Build the standalone FSC curve SVG. Null when the data cannot be
 *  plotted (fewer than 2 usable shells, degenerate resolution span). */
export function buildFscSvg(input: FscSnapshotInput): {
  svg: string;
  width: number;
  height: number;
} | null {
  const { width: W, height: H } = FSC_SNAPSHOT;
  const M = { t: 30, r: 14, b: 36, l: 42 };
  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;

  const shells = input.shells
    .filter((s) => Number.isFinite(s.res) && s.res > 0 && Number.isFinite(s.fsc))
    .sort((a, b) => a.res - b.res); // low-res (left) → high-res (right)
  if (shells.length < 2) return null;
  const resMin = Math.min(...shells.map((s) => s.res));
  const resMax = Math.max(...shells.map((s) => s.res));
  if (!(resMax > resMin)) return null;

  const yMin = -0.05;
  const yMax = 1.0;
  // x REVERSED + LOG scale: high resolution (small Å) on the right — the
  // conventional cryo-EM orientation, same as the in-app chart. A linear
  // axis lets the ~100 Å first shell crush the informative high-res end.
  const lx = (res: number) => Math.log10(res);
  const logMin = lx(resMin);
  const logMax = lx(resMax);
  const px = (res: number) => M.l + ((logMax - lx(res)) / (logMax - logMin)) * pw;
  const py = (v: number) => M.t + (1 - (v - yMin) / (yMax - yMin)) * ph;

  const path = (
    pick: (s: FscSnapshotShell) => number | null | undefined,
    stroke: string,
    w: number,
    dash?: string
  ) => {
    const pts = shells
      .map((s) => ({ x: px(s.res), y: py(pick(s) as number), v: pick(s) }))
      .filter((p) => p.v != null && Number.isFinite(p.v));
    if (pts.length < 2) return "";
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${fx(p.x)} ${fx(p.y)}`).join(" ");
    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}"${
      dash ? ` stroke-dasharray="${dash}"` : ""
    } stroke-linejoin="round" stroke-linecap="round"/>`;
  };

  const isPost = input.source === "postprocess";
  const parts: string[] = [];

  // background + title
  const title =
    input.title.length > 52 ? input.title.slice(0, 51) + "…" : input.title;
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(
    `<text x="${M.l}" y="17" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" fill="${C.text}">${esc(title)} — FSC curve</text>`
  );

  // grid + y ticks
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const y = py(v);
    parts.push(
      `<line x1="${M.l}" y1="${fx(y)}" x2="${W - M.r}" y2="${fx(y)}" stroke="${C.grid}" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${M.l - 6}" y="${fx(y + 3)}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${v.toFixed(2)}</text>`
    );
  }

  // x ticks (log ladder, reversed)
  for (const v of logTicks(resMin, resMax)) {
    const x = px(v);
    parts.push(
      `<line x1="${fx(x)}" y1="${M.t}" x2="${fx(x)}" y2="${H - M.b}" stroke="${C.gridSoft}" stroke-width="1"/>`
    );
    parts.push(
      `<text x="${fx(x)}" y="${H - M.b + 13}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${v >= 1 ? v.toFixed(0) : v.toFixed(1)}</text>`
    );
  }

  // axis labels
  parts.push(
    `<text x="${W - M.r}" y="${H - 8}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.muted}">resolution (Å) → higher res</text>`
  );
  parts.push(
    `<text x="12" y="${fx(M.t + ph / 2)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${C.muted}" transform="rotate(-90 12 ${fx(M.t + ph / 2)})">FSC</text>`
  );

  // criterion reference lines
  parts.push(
    `<line x1="${M.l}" y1="${fx(py(0.143))}" x2="${W - M.r}" y2="${fx(py(0.143))}" stroke="${C.amber}" stroke-width="1" stroke-dasharray="5 4" opacity="0.75"/>`
  );
  parts.push(
    `<text x="${M.l + 4}" y="${fx(py(0.143) - 4)}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.amber}">0.143</text>`
  );
  parts.push(
    `<line x1="${M.l}" y1="${fx(py(0.5))}" x2="${W - M.r}" y2="${fx(py(0.5))}" stroke="${C.zinc}" stroke-width="1" stroke-dasharray="2 4" opacity="0.45"/>`
  );
  parts.push(
    `<text x="${M.l + 4}" y="${fx(py(0.5) - 4)}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.faint}">0.5</text>`
  );

  // curves — unmasked/gold first, then postprocess-only companions
  parts.push(
    path(
      (s) => s.fsc,
      C.teal,
      2
    )
  );
  if (isPost) {
    parts.push(path((s) => finite(s.correctedFsc), C.amber, 2));
    parts.push(path((s) => finite(s.phaseRandomizedFsc), C.zinc, 1.25, "4 3"));
  }

  // 0.143 crossing dot + label (clamped inside the plot)
  if (input.resolutionAt143 != null && Number.isFinite(input.resolutionAt143)) {
    const cx = Math.max(M.l + 18, Math.min(W - M.r - 18, px(input.resolutionAt143)));
    const cy = py(0.143);
    parts.push(
      `<circle cx="${fx(px(input.resolutionAt143))}" cy="${fx(cy)}" r="4" fill="${C.amber}" stroke="#ffffff" stroke-width="1.5"/>`
    );
    parts.push(
      `<text x="${fx(cx)}" y="${fx(cy - 9)}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="600" fill="${C.amber}">${input.resolutionAt143.toFixed(2)} Å</text>`
    );
  }

  // legend — right-aligned row above the plot
  const legend: { label: string; color: string; dash?: string }[] = [
    isPost
      ? { label: "unmasked FSC", color: C.teal }
      : { label: "gold-standard FSC", color: C.teal },
    ...(isPost
      ? [
          { label: "masked + corrected", color: C.amber },
          { label: "phase-rand noise", color: C.zinc, dash: "4 3" },
        ]
      : []),
  ];
  const swW = 16;
  const gapX = 14;
  let curX = W - M.r;
  for (let i = legend.length - 1; i >= 0; i--) {
    const item = legend[i];
    const tw = item.label.length * 5.2;
    parts.push(
      `<text x="${fx(curX)}" y="16" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9.5" fill="${C.muted}">${esc(item.label)}</text>`
    );
    curX -= tw + 6;
    parts.push(
      `<line x1="${fx(curX - swW)}" y1="13" x2="${fx(curX)}" y2="13" stroke="${item.color}" stroke-width="2"${
        item.dash ? ` stroke-dasharray="${item.dash}"` : ""
      }/>`
    );
    curX -= swW + gapX;
  }

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`,
    width: W,
    height: H,
  };
}

/* ------------------------------------------------------------------ */
/* SVG → PNG data URL (canvas rasterization at 2×)                     */
/* ------------------------------------------------------------------ */

/** Rasterize a self-contained SVG to a PNG data URL. Resolves null on any
 *  failure or 4 s timeout — the report ships an honest gap instead of a
 *  broken embed. The SVG is loaded from a same-origin blob URL, so the
 *  canvas stays untainted and toDataURL is allowed. */
export function svgToPngDataUrl(
  svg: string,
  width: number,
  height: number,
  scale = 2
): Promise<string | null> {
  return new Promise((resolve) => {
    let url: string | null = null;
    let settled = false;
    const done = (v: string | null) => {
      if (settled) return;
      settled = true;
      if (url) URL.revokeObjectURL(url);
      resolve(v);
    };
    try {
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      url = URL.createObjectURL(blob);
      const img = new Image();
      const timer = setTimeout(() => done(null), 4000);
      img.onload = () => {
        try {
          const cv = document.createElement("canvas");
          cv.width = Math.round(width * scale);
          cv.height = Math.round(height * scale);
          const ctx = cv.getContext("2d");
          if (!ctx) {
            clearTimeout(timer);
            return done(null);
          }
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, width, height);
          clearTimeout(timer);
          done(cv.toDataURL("image/png"));
        } catch {
          clearTimeout(timer);
          done(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        done(null);
      };
      img.src = url;
    } catch {
      done(null);
    }
  });
}
