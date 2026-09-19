// t289 — THE WINDOW TAKES ORDERS IN EVERY DIALECT: t286 gave the strip a
// display window with two dialects (σ preset chips — one click; draggable
// handles — visual exploration); t287 carried the instrument into the
// stack. Two dialects were still missing:
//
//   1. THE NUMERIC ENTRY (the third dialect): a readout that can also be
//      WRITTEN. When a methods section says "displayed at lo = 0.2,
//      hi = 1.3", the user should not have to drag a handle to a
//      floating-point target — the lo/hi fields take absolute density
//      units and commit on Enter/blur. A per-keystroke commit would claim
//      a half-typed number is a command; a container-level focus gate
//      keeps external window changes from rewriting the fields under the
//      typist's hands; tabbing lo→hi does NOT commit early — only leaving
//      the pair entirely does. An invalid or half-typed pair is not a
//      command: the live window is restored (the strip refuses to lie,
//      it doesn't refuse to serve).
//
//   2. THE MONTAGE TAKES ORDERS (t287's leftover, the server was already
//      wired): the stack's montage overview can follow the display window
//      — but only by name. Sixteen images are sixteen distributions, so
//      the toggle is DEFAULT OFF (each cell speaks its own auto stretch)
//      and toggling it ON is the explicit act of commanding all of them.
//      With no window set there is nothing to follow — the toggle is
//      disabled and says so. The toggle survives slice steps (it is the
//      reader's intent, not a command over one image's pixels), but the
//      WINDOW itself still resets per image (t287's contract), so the
//      montage silently returns to auto with it.
//
// The evidence stack is the t287 recipe, deterministic: 4 sections ×
// 32×32, section s carries v = s·10 + ((x+y) % 4)·0.5 — μ_s = s·10+0.75,
// σ = √0.3125 ≈ 0.559017 is arithmetic, not sampling.
//
// Phases:
//   A  demo truth — homepage 200, roster 23
//   B  source ledger — the numeric entry (fields, commit path, focus
//      gate, restore-on-invalid), the montage toggle (conditional URL,
//      disabled-without-window, per-file reset, honest titles)
//   C  alive — C1 the numeric entry: typed μ±σ lands in the URL, the
//      fields follow the chips, an inverted pair and a half-typed pair
//      are refused; C2 the montage: disabled before any window, follows
//      ON, returns OFF, survives a slice step (disabled again — the
//      window died, the intent lived); C3 reopening resets everything
//   Z  roster identity + console clean
//
// Run: node scripts/t289-window-input.mjs   (server on :3000)
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
must((jobs0.jobs ?? []).length === 23, `roster 23 at the start (got ${(jobs0.jobs ?? []).length})`);

console.log("== PHASE B: source ledger ==");
const sharedSrc = readFileSync("src/components/workflow/results/density-histogram.tsx", "utf8");

// the numeric entry — the third dialect
must(
  (sharedSrc.match(/type="number"/g) ?? []).length === 2,
  "the strip grows TWO numeric fields (lo and hi — the third dialect, absolute units)"
);
must(
  sharedSrc.includes('step="any"'),
  "the fields take any decimal (a window is not an integer world)"
);
must(
  sharedSrc.includes("`${uiPrefix}-win-lo`") && sharedSrc.includes("`${uiPrefix}-win-hi`"),
  "the fields are machine-findable per consumer (uiPrefix-scoped hooks)"
);
must(
  sharedSrc.includes("const commitNum = () => {"),
  "ONE commit path for the fields (Enter and blur walk the same code)"
);
must(
  sharedSrc.includes("Number.isFinite(lo) && Number.isFinite(hi) && hi > lo"),
  "a commit demands a real PAIR with hi > lo (the route's own law, mirrored client-side)"
);
must(
  sharedSrc.includes("onPickWindow({ lo, hi })"),
  "a valid pair commits the same shape the handles commit (one window state)"
);
must(
  sharedSrc.includes("numFocus.current = true") && sharedSrc.includes("numFocus.current = false"),
  "a focus gate holds the fields' hands (external window changes don't rewrite under the typist)"
);
must(
  sharedSrc.includes("e.currentTarget.contains(e.relatedTarget as Node | null)"),
  "tabbing lo→hi does NOT commit early — only leaving the pair entirely does"
);
must(
  sharedSrc.includes("e.currentTarget.blur(); // blur walks the commit path"),
  "Enter commits through blur (one path — no double-commit race)"
);
must(
  sharedSrc.includes("restore the live") ||
    (sharedSrc.includes("setNumLo(winNow ? String(winNow.lo) : \"\")") &&
      sharedSrc.includes("setNumHi(winNow ? String(winNow.hi) : \"\")")),
  "an invalid pair restores the live window (refuse to lie, don't refuse to serve)"
);
must(
  sharedSrc.includes('placeholder="auto"'),
  "the empty fields say what AUTO is (the percentile stretch answers)"
);
must(
  sharedSrc.includes("the readout that can also be WRITTEN"),
  "the third dialect is documented WHERE the fields are born"
);

const rvSrc = readFileSync("src/components/workflow/results/results-view.tsx", "utf8");

// the montage takes orders — but only by name
must(
  rvSrc.includes("const [montageWin, setMontageWin] = useState(false)"),
  "the montage's follow-window toggle exists (default OFF — auto-overview holds by default)"
);
must(
  rvSrc.includes("(montageWin && imgWindow ? `&lo=${imgWindow.lo}&hi=${imgWindow.hi}` : \"\")"),
  "the montage URL carries the window ONLY when the toggle speaks AND a window lives"
);
must(
  rvSrc.includes('data-canvas-ui="stack-montage-window"'),
  "the toggle is machine-findable (stack-montage-window)"
);
must(
  rvSrc.includes('data-montage-window={montageWin && imgWindow ? "on" : "off"}'),
  "the hook reads the montage's ACTUAL behavior (intent=aria-pressed, interactivity=disabled, deed=this hook)"
);
must(
  rvSrc.includes("disabled={!imgWindow}"),
  "with no window set the toggle is disabled (nothing to follow — it says so)"
);
must(
  rvSrc.includes("Set a display window first"),
  "the disabled title tells the user HOW to earn the toggle"
);
must(
  rvSrc.includes("sixteen images are sixteen distributions"),
  "the enabled title keeps the honest arithmetic (why default OFF)"
);
must(
  rvSrc.includes("follow window"),
  "the toggle names its trade in plain words"
);
must(
  rvSrc.includes("setMontageWin(false);") && rvSrc.includes("}, [imgPath]);"),
  "the toggle resets per FILE (a fresh dialog starts honest — window auto, overview auto)"
);

console.log("== PHASE C: the window takes orders, alive ==");
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
    // t289stack is C-phase EVIDENCE, not a resident: rm first (a crashed
    // earlier run must not poison the world), rm again in the finally —
    // the world returns as it was found.
    rmSync(`${wd}/t289stack.mrcs`, { force: true });
    try {
      // the DETERMINISTIC stack (t287's recipe): 4 sections × 32×32
      // float32, section s carries v = s·10 + ((x + y) % 4)·0.5
      const N = 32, NZ = 4;
      const vals = new Float32Array(N * N * NZ);
      for (let z = 0; z < NZ; z++)
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++)
            vals[(z * N + y) * N + x] = z * 10 + ((x + y) % 4) * 0.5;
      const head = Buffer.alloc(1024);
      head.writeInt32LE(N, 0); head.writeInt32LE(N, 4); head.writeInt32LE(NZ, 8);
      head.writeInt32LE(2, 12); // mode float32
      head.writeInt32LE(N, 28); head.writeInt32LE(N, 32); head.writeInt32LE(NZ, 36);
      head.writeFloatLE(1.0, 40); head.writeFloatLE(1.0, 44); head.writeFloatLE(1.0, 48);
      head.writeInt32LE(1, 64); head.writeInt32LE(2, 68); head.writeInt32LE(3, 72);
      head.writeFloatLE(0, 76); head.writeFloatLE(31.5, 80); head.writeFloatLE(15.75, 84);
      head.writeInt32LE(0, 88); // ispg 0 — an image stack
      head.writeInt32LE(0, 92);
      head.write("MAP ", 208, "ascii");
      head.writeInt32LE(16777214, 212);
      writeFileSync(`${wd}/t289stack.mrcs`, Buffer.concat([head, Buffer.from(vals.buffer)]));
      must(true, "t289stack.mrcs written (4×32×32, section μ 0.75/10.75/20.75/30.75, σ √0.3125)");

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

        const tile = page.locator('button[aria-label*="t289stack"]').first();
        if (!(await tile.isVisible().catch(() => false))) {
          must(false, 'the stack tile "t289stack" is visible');
        } else {
          must(true, "the stack tile is visible in the maps gallery");
          await tile.click();
          await sleep(1000);
        }

        const montageImg = () => page.locator('img[alt*="montage"]').first();
        const metaRow = () => page.locator('[data-canvas-ui="stack-montage-meta"]');
        const winToggle = () => page.locator('[data-canvas-ui="stack-montage-window"]');

        // C2a — before any window exists the toggle is honest about being useless
        must((await metaRow().getAttribute("data-montage-window")) === "off", "the montage starts OFF (auto-overview by default)");
        must(await winToggle().isDisabled(), "the toggle is disabled with no window set (nothing to follow)");
        must(
          ((await winToggle().getAttribute("title")) ?? "").includes("Set a display window first"),
          "the disabled title says HOW to earn the toggle"
        );
        const m0 = await montageImg().getAttribute("src");
        must(!!m0 && m0.includes("montage=16") && !m0.includes("&lo="), "the montage URL is clean (auto for every cell)");

        // C1 — the numeric entry, alive
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').scrollIntoViewIfNeeded().catch(() => {});
        await sleep(350);
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').click();
        const st1 = await pollUntil(async () => {
          const strip = page.locator('[data-canvas-ui="quick-hist"]');
          if (!(await strip.isVisible().catch(() => false))) return null;
          const st = await strip.getAttribute("data-hist-state");
          return st === "ready" ? st : null;
        }, 12000);
        must(st1 === "ready", `the strip reaches ready (got ${st1})`);

        const loField = () => page.locator('[data-canvas-ui="quick-hist-win-lo"]');
        const hiField = () => page.locator('[data-canvas-ui="quick-hist-win-hi"]');
        must((await loField().inputValue()) === "" && (await hiField().inputValue()) === "",
          "the fields start empty (AUTO — the placeholder's word)");

        // type the pair (slice 0: μ 0.75, σ √0.3125 — but the user types
        // their OWN absolute bounds; that is the point of the dialect)
        await loField().fill("0.2");
        await hiField().fill("1.3");
        await hiField().press("Enter");
        const custom = await pollUntil(async () => {
          const s = await page.locator('[data-canvas-ui="quick-hist-win"]').getAttribute("data-win-state");
          return s === "custom" ? s : null;
        }, 8000);
        must(custom === "custom", "a typed pair commits (state hook: custom)");
        const winRow = () => page.locator('[data-canvas-ui="quick-hist-win"]');
        const loVal = parseFloat((await winRow().getAttribute("data-win-lo")) ?? "nan");
        const hiVal = parseFloat((await winRow().getAttribute("data-win-hi")) ?? "nan");
        must(Math.abs(loVal - 0.2) < 1e-6 && Math.abs(hiVal - 1.3) < 1e-6,
          `the typed window IS the typed window (lo ${loVal}, hi ${hiVal} — no drift, no rounding)`);
        const loSig = parseFloat((await winRow().getAttribute("data-win-lo-sigma")) ?? "nan");
        must(
          Number.isFinite(loSig) &&
            loSig.toFixed(2) === ((0.2 - 0.75) / Math.sqrt(0.3125)).toFixed(2),
          `the σ echo stays honest (lo reads ${loSig.toFixed(2)}σ at the hook's own precision — the strip's arithmetic serves the typed pair)`
        );
        const sliceImg = () => page.locator('img[alt*="particle image"]').first();
        const s1 = await pollUntil(async () => {
          const s = await sliceImg().getAttribute("src");
          return s && s.includes("&lo=0.2&hi=1.3") ? s : null;
        }, 8000);
        must(!!s1, "the slice view's URL carries the TYPED bounds verbatim (the render answers to the fields)");
        must((await loField().inputValue()) === "0.2" && (await hiField().inputValue()) === "1.3",
          "the fields keep what was typed (the readout IS the entry)");

        // the fields FOLLOW the chips (one window state, every dialect reads it)
        await page.locator('[data-win-preset="1"]').first().click();
        const chipFollow = await pollUntil(async () => {
          const v = await loField().inputValue();
          return v.startsWith("0.190983") ? v : null;
        }, 8000);
        must(!!chipFollow, `the fields follow the ±1σ chip (lo field reads μ−σ: ${chipFollow?.slice(0, 10)}…)`);

        // C1b — an inverted pair is not a command
        await loField().fill("1.3");
        await hiField().fill("0.2");
        await hiField().press("Enter");
        await sleep(500);
        const loAfter = parseFloat((await winRow().getAttribute("data-win-lo")) ?? "nan");
        must(Math.abs(loAfter - (0.75 - Math.sqrt(0.3125))) < 1e-3,
          `an inverted pair is refused — the μ±σ window survives (lo still ${loAfter.toFixed(4)})`);
        must((await loField().inputValue()).startsWith("0.190983"),
          "the fields snap back to the live window (the restore, alive)");

        // C1c — a half-typed pair is not a command
        await loField().fill("0.2");
        await hiField().fill("");
        await loField().press("Enter");
        await sleep(500);
        const loHalf = parseFloat((await winRow().getAttribute("data-win-lo")) ?? "nan");
        must(Math.abs(loHalf - (0.75 - Math.sqrt(0.3125))) < 1e-3,
          "a half-typed pair (empty hi) is refused — the live window survives");
        must((await loField().inputValue()).startsWith("0.190983"),
          "the fields restore again (refuse to lie, don't refuse to serve)");

        // C2b — now the montage CAN follow (a window lives)
        must(!(await winToggle().isDisabled()), "the toggle is enabled once a window lives");
        await winToggle().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
        await sleep(300);
        await winToggle().click();
        must((await metaRow().getAttribute("data-montage-window")) === "on", "the toggle speaks ON");
        const m1 = await pollUntil(async () => {
          const s = await montageImg().getAttribute("src");
          return s && s.includes("&lo=0.190983") ? s : null;
        }, 8000);
        must(!!m1, "the montage URL now carries the window (all sixteen cells take the order)");
        must(
          (await metaRow().textContent())?.includes("windowed"),
          "the caption says what the montage is doing (windowed)"
        );

        // the pose: windowed montage + strip + slice view, one instrument
        await page.screenshot({ path: `${SHOTS}/t289-windowed-montage.png` });
        must(true, "the windowed montage is posed (t289-windowed-montage.png)");

        // C2c — a slice step kills the WINDOW (t287's contract) but the
        // toggle's intent survives: the toggle is STILL PRESSED (ON) yet
        // disabled (no window to follow); a NEW window then re-arms it
        // without a second click — the intent outlived the image
        await page.locator('[data-canvas-ui="stack-slice-next"]').click();
        await sleep(700);
        must(await winToggle().isDisabled(), "after a slice step the toggle is disabled again (the window died with the image)");
        must((await metaRow().getAttribute("data-montage-window")) === "off",
          "the montage hook reads off (no window — the order cannot outlive its subject)");
        must((await winToggle().getAttribute("aria-pressed")) === "true",
          "yet the toggle is STILL PRESSED (the reader's intent survived the step)");
        // the window returns → the surviving toggle follows again, no second click
        await page.locator('[data-canvas-ui="quick-hist-toggle"]').scrollIntoViewIfNeeded().catch(() => {});
        await page.locator('[data-win-preset="2"]').first().click();
        const m3 = await pollUntil(async () => {
          const s = await montageImg().getAttribute("src");
          return s && s.includes("&lo=") ? s : null;
        }, 8000);
        must(!!m3, "a new window + the surviving toggle = the montage follows again (intent outlives the image)");

        // and the order can still be withdrawn by name
        await winToggle().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" })).catch(() => {});
        await sleep(300);
        await winToggle().click();
        const m4 = await pollUntil(async () => {
          const s = await montageImg().getAttribute("src");
          return s && !s.includes("&lo=") ? s : null;
        }, 8000);
        must(!!m4 && (await metaRow().getAttribute("data-montage-window")) === "off",
          "toggling OFF withdraws the order (the montage URL returns to auto)");

        // C3 — reopening resets EVERYTHING (a fresh dialog starts honest)
        await page.keyboard.press("Escape");
        await sleep(500);
        await page.locator('button[aria-label*="t289stack"]').first().click();
        await sleep(1000);
        must((await page.locator('[data-canvas-ui="stack-montage-meta"]').getAttribute("data-montage-window")) === "off",
          "reopening: the montage toggle is OFF (per-file reset)");
        must(await page.locator('[data-canvas-ui="stack-montage-window"]').isDisabled(),
          "reopening: the toggle is disabled again (no window in a fresh dialog)");
        must(
          (await page.locator('[data-canvas-ui="quick-hist-toggle"]').getAttribute("aria-pressed")) === "false",
          "reopening: the histogram toggle is OFF too (t284's per-file contract)"
        );
        await page.keyboard.press("Escape");
        await sleep(300);
      } finally {
        try { await browser.close().catch(() => {}); } catch { /* gone */ }
      }
    } finally {
      // the evidence leaves: the world returns EXACTLY as t212 accounts it
      rmSync(`${wd}/t289stack.mrcs`, { force: true });
    }
  }
}

console.log("== PHASE Z: the world as it was ==");
const jobsEnd = await (await fetch(`${BASE}/api/jobs`, { headers: SH })).json();
must((jobsEnd.jobs ?? []).length === 23, `roster 23 after the dance (got ${(jobsEnd.jobs ?? []).length})`);
must(consoleErrors.length === 0, `console clean (${consoleErrors.length} errors${consoleErrors.length ? `: ${consoleErrors[0]?.slice(0, 90)}` : ""})`);

console.log(fail === 0 ? "\nt289: ALL PASS" : `\nt289: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
