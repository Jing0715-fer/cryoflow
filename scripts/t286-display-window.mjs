// t286 — THE HISTOGRAM COMMANDS THE DISPLAY: t283 made the strip SPEAK
// (where does the density live), t284 carried the speech into the quick
// look (the first glance reads the distribution) — but the IMAGE itself
// still answered to nobody: a fixed 2–98 percentile stretch decided what
// is black and what is white. t286 closes the loop: an explicit display
// window (lo → black, hi → white) can be commanded from the strip —
//   server: stretchToGray accepts a window (LITERAL mapping — no
//     auto-inversion: the heuristic second-guesses an AUTO range, but a
//     range the user picked is an explicit command; silently flipping it
//     would betray the drag); every renderer threads it; the png route
//     parses lo/hi and answers AUTO (gracefully) to anything that is not
//     a finite pair with hi > lo.
//   client: the dialog's strip grows a THIRD mode — σ preset chips
//     (auto / ±1σ / ±2σ / ±3σ / ±5σ) + two draggable handles (lo = the
//     black point in amber, hi = the white point in violet), bars OUTSIDE
//     the window dim (what the render clips is visible on the strip
//     itself), and the SAME state re-renders the image (one window, two
//     consumers — the one-state-two-consumers doctrine again).
// The evidence file is a DETERMINISTIC volume: values ((x+2y+3z) % 16) − 8
// — sixteen distinct densities, each exactly 1024 times, so μ = −0.5 and
// σ = √21.25 are known BEFORE the server answers: the histogram's truth is
// checked against arithmetic, not against itself.
//
// Phases:
//   A  demo truth — homepage 200, roster 21
//   B  source ledger — the window type + literal-mapping branch in mrc.ts,
//      the route's lo/hi parse + graceful auto fallback, the strip's third
//      mode (drag gate, commit-on-release, chips, hooks), the dialog's
//      lifted state + URL threading + per-file reset, the stack branch
//      untouched (montage stays auto — the histogram never spoke stacks)
//   C  alive — C1 the API's histogram matches arithmetic (μ −0.5, σ √21.25);
//      C2 the png route: no window / valid window / inverted / garbage /
//      half-window — the graceful trio is BYTE-IDENTICAL to auto, the valid
//      window differs; C3 the dialog: chips row speaks auto → ±1σ sets the
//      window (img src carries &lo=&hi=, the handles' σ offsets read
//      ±1.00) → the hi handle DRAGS right (σ offset > 1, custom) → auto
//      clears it; C4 the per-file reset (reopen another volume → src clean,
//      toggle OFF, window auto); C5 the posed screenshots
//   Z  roster identity + console clean
//
// Run: node scripts/t286-display-window.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const SHOTS = "/home/z/my-project/shots-qa";

let fail = 0;
const consoleErrors = [];
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// t280's lesson lives on: anything that races a render is POLLED, not read
async function pollUntil(fn, deadlineMs, intervalMs = 250) {
  const end = Date.now() + deadlineMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

// same-origin headers the guarded routes demand (the SH discipline)
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "User-Agent": "Mozilla/5.0",
};

console.log("== PHASE A: demo truth ==");
const home = await fetch(`${BASE}/`, { headers: SH });
must(home.status === 200, `homepage 200 (got ${home.status})`);
const jobs0 = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobs0.jobs ?? []).length === 21, `roster 21 at the start (got ${(jobs0.jobs ?? []).length})`);

console.log("== PHASE B: source ledger ==");
const mrcSrc = readFileSync("src/lib/mrc.ts", "utf8");
must(mrcSrc.includes("export interface MrcWindow"), "the window type is exported (one shape, every renderer)");
must(
  mrcSrc.includes("function stretchToGray(data: Float32Array, window?: MrcWindow): Buffer"),
  "the stretch accepts an explicit window"
);
must(mrcSrc.includes("if (window) {"), "the explicit-window branch comes FIRST (the percentile path is the fallback)");
must(
  mrcSrc.includes("LITERAL mapping (no auto-inversion"),
  "the literal mapping is documented WHERE the auto-inversion is skipped (an explicit command is not second-guessed)"
);
const stretchCalls = mrcSrc.split("stretchToGray(small.values, window)").length - 1;
must(stretchCalls === 5, `every renderer threads the window into the stretch (got ${stretchCalls}/5)`);
must(
  (mrcSrc.match(/window\?: MrcWindow/g) ?? []).length === 5,
  "all five render signatures accept the window (slice, montage, large, ortho×… — 4 fns, 5 with the stretch)"
);

const routeSrc = readFileSync("src/app/api/jobs/[id]/outputs/file/route.ts", "utf8");
must(routeSrc.includes('url.searchParams.get("lo")') && routeSrc.includes('url.searchParams.get("hi")'), "the route reads lo and hi");
must(routeSrc.includes("hiV > loV"), "the window is a PAIR with hi > lo — anything else is not a window");
must(routeSrc.includes("renderMrcOrthoPng(abs, axis, toPos(), undefined, win)"), "the x/y ortho render threads the window");
must(routeSrc.includes('renderMrcOrthoPng(abs, "z", toPos(), undefined, win)'), "the z-plane render threads the window");
must(routeSrc.includes("renderMrcMontagePng(abs, n, win)"), "the montage render threads the window (shared cells)");
must(routeSrc.includes("renderMrcLargePng(abs, slice, win)"), "the large render threads the window");
must(routeSrc.includes("renderMrcSlicePng(abs, slice, win)"), "the thumb render threads the window");

const sharedSrc = readFileSync("src/components/workflow/results/density-histogram.tsx", "utf8");
must(sharedSrc.includes("onPickWindow?: (w: HistWindow | null) => void"), "the strip speaks WINDOW through one handler (object-or-null: set or clear)");
must(
  sharedSrc.includes("if (!onPickWindow || !winNow || !data) return;"),
  "the drag gate is honest: no consumer, no handles, no data — no drag"
);
must(sharedSrc.includes("dragWinRef.current"), "the release reads the REF (a pointerup racing the last move cannot commit a stale window)");
must(sharedSrc.includes("commit on release"), "the window commits on RELEASE (no per-frame re-renders mid-drag)");
must(sharedSrc.includes("HIST_WIN_LO") && sharedSrc.includes("HIST_WIN_HI"), "the handles have their own colors (amber/violet — not the contour's cyan)");
must(sharedSrc.includes("clipped ? 0.28 : 1"), "bars OUTSIDE the window dim — what the render clips is visible on the strip");
must(sharedSrc.includes("cursor-ew-resize"), "the cursor offers the drag only where a drag exists");
must(sharedSrc.includes('data-win-preset={k}'), "the σ preset chips are machine-findable");
must(sharedSrc.includes('data-win-state={winNow ? "custom" : "auto"}'), "the window state is a hook (custom vs auto)");
must(
  sharedSrc.includes('placeholder="auto"'),
  "the numeric fields say what AUTO is — an empty field answers to the percentile stretch (t288: the readout became an entry)"
);
must(sharedSrc.includes("if (!onPickSigma) return;"), "the σ pick gate survives (t284's honest gate, untouched)");
must(
  sharedSrc.includes("Math.min(Math.max(v, data.lo), hi - minGap)"),
  "the handles cannot cross: lo is clamped against hi minus the min gap"
);

const rvSrc = readFileSync("src/components/workflow/results/results-view.tsx", "utf8");
must(rvSrc.includes("imgWindow"), "the dialog holds the window state (one state, two consumers: strip + image)");
must(rvSrc.includes("&lo=${imgWindow.lo}&hi=${imgWindow.hi}"), "the image URL carries the window (the render answers to it)");
must(rvSrc.includes("window={imgWindow}") && rvSrc.includes("onWindowChange={setImgWindow}"), "the strip's window lifts into the dialog's state");
must(rvSrc.includes("setImgWindow(null)"), "the window resets (a new file inherits no command)");
must(!rvSrc.includes("onPickSigma"), "the dialog STILL never passes a σ pick handler (t284's read-only-by-construction, preserved)");
must(
  rvSrc.includes('"&format=png&montage=16") +') && rvSrc.includes("montageWin && imgWindow"),
  "the montage follows the window ONLY through the explicit toggle (t288: sixteen images are sixteen distributions — the default is still auto)"
);

console.log("== PHASE C: the window commands, alive ==");
// the volume world (t283's recipe — idempotent, roster stays 21)
try {
  execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe", timeout: 120_000 });
  must(true, "the volume world is seeded (qa67-seed-volume)");
} catch (e) {
  must(false, `the volume world failed to seed: ${String(e).slice(0, 90)}`);
}

const jobsNow = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
const host = (jobsNow.jobs ?? []).find((j) => j.name === "QA Refine3D");
must(!!host, "QA Refine3D in roster (the seeder's host)");
if (host) {
  const state = JSON.parse(readFileSync("data/engine-state.json", "utf8"));
  const wd = state[host.id]?.workdir;
  must(!!wd, "the host's workdir is registered in engine-state");
  if (wd) {
    // the standing world is ACCOUNTED FOR by t212 (the host owns FOUR
    // volumes — orthovol + both halves + masked). t286win is C-phase
    // EVIDENCE, not a resident: rm first (a crashed earlier run must not
    // poison the world), rm again in the finally.
    rmSync(`${wd}/t286win.mrc`, { force: true });
    try {
      // C0 — the DETERMINISTIC volume: 64×64×4 float32,
      // v = ((x + 2y + 3z) % 16) − 8. x alone is uniform mod 16 (64 % 16
      // == 0), so all sixteen values appear exactly 1024 times:
      // μ = −0.5, σ = √21.25 — arithmetic, not sampling.
      const N = 64, NZ = 4;
      const vals = new Float32Array(N * N * NZ);
      for (let z = 0; z < NZ; z++)
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++)
            vals[(z * N + y) * N + x] = ((x + 2 * y + 3 * z) % 16) - 8;
      const head = Buffer.alloc(1024);
      head.writeInt32LE(N, 0); head.writeInt32LE(N, 4); head.writeInt32LE(NZ, 8);
      head.writeInt32LE(2, 12); // mode float32
      head.writeInt32LE(N, 28); head.writeInt32LE(N, 32); head.writeInt32LE(NZ, 36);
      head.writeFloatLE(1.0, 40); head.writeFloatLE(1.0, 44); head.writeFloatLE(1.0, 48);
      head.writeInt32LE(1, 64); head.writeInt32LE(2, 68); head.writeInt32LE(3, 72);
      head.writeFloatLE(-8, 76); head.writeFloatLE(7, 80); head.writeFloatLE(-0.5, 84);
      head.writeInt32LE(0, 88); head.writeInt32LE(0, 92);
      head.write("MAP ", 208, "ascii");
      head.writeInt32LE(16777214, 212);
      writeFileSync(`${wd}/t286win.mrc`, Buffer.concat([head, Buffer.from(vals.buffer)]));
      must(true, "t286win.mrc written (64×64×4, sixteen densities × 1024 — deterministic)");

      const fileUrl = (q) =>
        `${BASE}/api/jobs/${host.id}/outputs/file?path=${encodeURIComponent("t286win.mrc")}&${q}`;

      // C1 — the histogram's truth is ARITHMETIC
      const c1 = await fetch(fileUrl("format=histogram"), { headers: SH });
      must(c1.status === 200, `the histogram answers 200 (got ${c1.status})`);
      const c1d = await c1.json().catch(() => null);
      must(!!c1d && c1d.nTotal === N * N * NZ, `nTotal is the 64×64×4 grid (got ${c1d && c1d.nTotal})`);
      must(!!c1d && Math.abs(c1d.mean - -0.5) < 1e-4, `μ is −0.5 by arithmetic (got ${c1d && c1d.mean})`);
      must(!!c1d && Math.abs(c1d.std - Math.sqrt(21.25)) < 1e-3, `σ is √21.25 ≈ 4.6098 by arithmetic (got ${c1d && c1d.std})`);
      must(!!c1d && c1d.lo === -8 && c1d.hi === 7, `the strip's span is [−8, 7] (got ${c1d && c1d.lo}, ${c1d && c1d.hi})`);

      // C2 — the png route: window in, auto out (gracefully), bytes tell
      const pngOf = async (q) => {
        const r = await fetch(fileUrl(q), { headers: SH });
        const buf = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
        return { status: r.status, type: r.headers.get("content-type"), buf };
      };
      const autoPng = await pngOf("format=png&scale=large");
      must(autoPng.status === 200 && autoPng.type === "image/png", `auto render is a png (got ${autoPng.status}, ${autoPng.type})`);
      const winPng = await pngOf("format=png&scale=large&lo=-4&hi=4");
      must(winPng.status === 200 && winPng.type === "image/png", "a valid window renders too (lo −4, hi +4)");
      const invPng = await pngOf("format=png&scale=large&lo=9&hi=3");
      const garbagePng = await pngOf("format=png&scale=large&lo=abc&hi=xyz");
      const halfPng = await pngOf("format=png&scale=large&lo=-4");
      must(
        invPng.status === 200 && garbagePng.status === 200 && halfPng.status === 200,
        "inverted / garbage / half-window render anyway (graceful AUTO — never a 400 for a bad window)"
      );
      must(
        !!invPng.buf && !!autoPng.buf && invPng.buf.equals(autoPng.buf) &&
        !!garbagePng.buf && garbagePng.buf.equals(autoPng.buf) &&
        !!halfPng.buf && halfPng.buf.equals(autoPng.buf),
        "the graceful trio is BYTE-IDENTICAL to auto (fallback, not error)"
      );
      must(!!winPng.buf && !winPng.buf.equals(autoPng.buf), "the valid window renders DIFFERENT bytes (the command took)");

      // C3 — the dialog, alive: chips → src → drag → auto
      const browser = await chromium.launch();
      const page = await browser.newPage();
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });
      page.on("pageerror", (e) => consoleErrors.push(String(e)));
      try {
        await page.goto(BASE, { waitUntil: "domcontentloaded" });
        await sleep(1800);
        await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
        await sleep(1600);
        await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
        await sleep(1400);

        const openFile = async (name) => {
          // gallery labels carry NO extension (f.label ?? f.name → "t286win")
          const tile = page.locator(`button[aria-label="Enlarge ${name}"]`).first();
          if (await tile.isVisible().catch(() => false)) await tile.click();
          else throw new Error(`tile "Enlarge ${name}" not visible`);
          await sleep(900);
        };
        // the dialog scrolls (max-h-90dvh): anything below the fold must be
        // brought to the viewport center before a click, or the point lands
        // on the img/wrapper and Playwright retries forever (t284's lesson,
        // now earned by t286 too)
        const ensureVisible = async (loc) => {
          await loc.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
          await sleep(350);
        };
        const imgSrc = async () =>
          page.locator('img[alt="t286win.mrc central slice"]').getAttribute("src");
        const winRow = () => page.locator('[data-canvas-ui="quick-hist-win"]');
        const waitReady = async () =>
          pollUntil(async () => {
            const strip = page.locator('[data-canvas-ui="quick-hist"]');
            if (!(await strip.isVisible().catch(() => false))) return null;
            const st = await strip.getAttribute("data-hist-state");
            return st === "ready" ? st : null;
          }, 12000);

        await openFile("t286win");
        must(
          await page.getByText("Central slice").first().isVisible().catch(() => false),
          "the dialog is open on the evidence volume (central-slice view)"
        );
        const src0 = await imgSrc();
        must(!!src0 && !src0.includes("&lo="), "AUTO first: the image URL carries no window");

        await page.locator('[data-canvas-ui="quick-hist-toggle"]').scrollIntoViewIfNeeded().catch(() => {});
        await sleep(350);
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').click();
        const st1 = await waitReady();
        must(st1 === "ready", `the strip reaches ready (got ${st1})`);
        await winRow().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
        await sleep(300);
        must(await winRow().isVisible().catch(() => false), "the window control row is here (the strip speaks WINDOW in the dialog)");
        must((await winRow().getAttribute("data-win-state")) === "auto", "the window state hook says auto");

        // ±1σ preset — the values sit INSIDE [−8, 7] (±2σ would clamp:
        // μ+2σ ≈ 8.72 > 7 — the deterministic range's honest boundary)
        await ensureVisible(page.locator('[data-win-preset="1"]').first());
        await page.locator('[data-win-preset="1"]').first().click();
        const custom = await pollUntil(async () => {
          const s = await winRow().getAttribute("data-win-state");
          return s === "custom" ? s : null;
        }, 8000);
        must(custom === "custom", "±1σ sets the window (state hook: custom)");
        const loSig = parseFloat((await winRow().getAttribute("data-win-lo-sigma")) ?? "9");
        const hiSig = parseFloat((await winRow().getAttribute("data-win-hi-sigma")) ?? "9");
        must(Math.abs(loSig + 1) < 0.02 && Math.abs(hiSig - 1) < 0.02, `the handles read ±1.00σ (got ${loSig}, ${hiSig})`);
        const src1 = await pollUntil(async () => {
          const s = await imgSrc();
          return s && s.includes("&lo=") ? s : null;
        }, 8000);
        must(!!src1, "the image URL now carries &lo=&hi= (the render answers to the strip)");
        if (src1) {
          const u = new URL(src1, BASE);
          const uLo = parseFloat(u.searchParams.get("lo") ?? "nan");
          const uHi = parseFloat(u.searchParams.get("hi") ?? "nan");
          must(Math.abs(uLo - (-0.5 - Math.sqrt(21.25))) < 1e-3 && Math.abs(uHi - (-0.5 + Math.sqrt(21.25))) < 1e-3,
            `the URL's window IS μ±σ (lo ${uLo.toFixed(4)}, hi ${uHi.toFixed(4)})`);
        }
        must((await page.locator('[data-win-preset="1"]').first().getAttribute("aria-pressed")) === "true",
          "the ±1σ chip mirrors the live window (aria-pressed)");

        // drag the hi handle RIGHT: at ±1σ its x sits at
        // padL + (μ+σ−(−8))/15 · (w−padL−padR) — the suite computes the
        // SAME mapping the strip draws
        const canvas = page.locator('[data-canvas-ui="quick-hist"] canvas');
        const box = await canvas.boundingBox();
        if (box) {
          const padL = 6, padR = 6;
          const span = 15; // [−8, 7]
          const fracHi = (c1d.mean + c1d.std - c1d.lo) / span;
          const xHi = box.x + padL + fracHi * (box.width - padL - padR);
          const y = box.y + box.height / 2;
          await page.mouse.move(xHi, y);
          await page.mouse.down();
          await page.mouse.move(xHi + 24, y, { steps: 8 });
          await page.mouse.up();
          await sleep(400);
        } else {
          must(false, "the strip canvas has a bounding box (drag skipped — FAIL)");
        }
        const draggedSig = parseFloat((await winRow().getAttribute("data-win-hi-sigma")) ?? "0");
        must(draggedSig > 1.0, `the hi handle dragged right: σ offset now ${draggedSig.toFixed(2)} > 1.00`);
        must(
          (await page.locator('[data-win-preset="1"]').first().getAttribute("aria-pressed")) === "false",
          "a dragged window is CUSTOM — no preset claims it anymore"
        );
        const src2 = await imgSrc();
        must(!!src2 && parseFloat(new URL(src2, BASE).searchParams.get("hi") ?? "0") > c1d.mean + c1d.std,
          "the image URL's hi moved with the drag");

        mkdirSync(SHOTS, { recursive: true });
        await canvas.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
        await sleep(400);
        await page.screenshot({ path: `${SHOTS}/t286-display-window-dragged.png` });
        must(true, "the dragged window is posed (t286-display-window-dragged.png)");

        // auto clears the command
        await ensureVisible(page.locator('[data-win-preset="auto"]').first());
        await page.locator('[data-win-preset="auto"]').first().click();
        const cleared = await pollUntil(async () => {
          const s = await winRow().getAttribute("data-win-state");
          return s === "auto" ? s : null;
        }, 8000);
        must(cleared === "auto", "Auto clears the override (state hook: auto)");
        const src3 = await pollUntil(async () => {
          const s = await imgSrc();
          return s && !s.includes("&lo=") ? s : null;
        }, 8000);
        must(!!src3, "the image URL is clean again (no &lo=)");

        // C4 — the per-file reset: a window belongs to its file
        await page.keyboard.press("Escape"); // C3's dialog closes first — the tiles live behind the modal
        await sleep(500);
        await openFile("t286win");
        await ensureVisible(page.locator('[data-canvas-ui="quick-hist-toggle"]'));
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').click();
        await waitReady();
        await ensureVisible(page.locator('[data-win-preset="3"]').first());
        await page.locator('[data-win-preset="3"]').first().click();
        const set3 = await pollUntil(async () => {
          const s = await winRow().getAttribute("data-win-state");
          return s === "custom" ? s : null;
        }, 8000);
        must(set3 === "custom", "±3σ sets a window on the second look");
        await page.keyboard.press("Escape");
        await sleep(500);
        await openFile("orthovol");
        // the t286win selector is gone now — orthovol's own img is a
        // different node; what must hold is: the DIALOG shows orthovol and
        // its central-slice img carries no window (the reset ran)
        const opened = await page.getByText("Central slice").first().isVisible().catch(() => false);
        must(opened, "the other volume's dialog is open");
        const anySrc = await page.locator('img[alt*="central slice"]').first().getAttribute("src");
        must(!!anySrc && !anySrc.includes("&lo="), "a new file, a clean URL (the window did not ride along)");
        const tg = await page.locator('[data-canvas-ui="quick-hist-toggle"]').getAttribute("aria-pressed").catch(() => null);
        must(tg === "false", `the toggle is OFF for the new file too (aria-pressed=${tg})`);

        // C5 — the second pose: orthovol with a fresh ±2σ (its own window)
        await ensureVisible(page.locator('[data-canvas-ui="quick-hist-toggle"]'));
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').click();
        await waitReady();
        await winRow().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
        await sleep(300);
        await ensureVisible(page.locator('[data-win-preset="2"]').first());
        await page.locator('[data-win-preset="2"]').first().click();
        await pollUntil(async () => {
          const s = await winRow().getAttribute("data-win-state");
          return s === "custom" ? s : null;
        }, 8000);
        await sleep(400);
        await page.screenshot({ path: `${SHOTS}/t286-ortho-window-2sigma.png` });
        must(true, "orthovol speaks ±2σ (t286-ortho-window-2sigma.png)");
        await page.keyboard.press("Escape");
        await sleep(300);
      } finally {
        try { await browser.close().catch(() => {}); } catch { /* gone */ }
      }
    } finally {
      // the evidence leaves: the world returns EXACTLY as t212 accounts it
      rmSync(`${wd}/t286win.mrc`, { force: true });
    }
  }
}

console.log("== PHASE Z: the world as it was ==");
const jobsEnd = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobsEnd.jobs ?? []).length === 21, `roster 21 after the dance (got ${(jobsEnd.jobs ?? []).length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0]?.slice(0, 90)}` : ""})`);

console.log(fail === 0 ? "\nt286: ALL PASS" : `\nt286: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
