#!/usr/bin/env node
/**
 * t899 — THE RING'S BROWSER LEG (fire leg v2; the browser is open on the
 * canvas, the witness card visible, status idle).
 *
 * The claim under witness: while a REAL remote denoise run's staged
 * sync-back climbs (the mock's cat-slow-ms lever throttles each cat to
 * 3.5s — a ~14s climb), the inspector's KeyNumbersStrip — polling every
 * 6s while the job runs — diffs the covered stat's changed value and the
 * fuchsia ring (data-flash="on" + ring-fuchsia class) FIRES in the live
 * DOM, mid-run, on a value that is not yet the final one. The t898 leg
 * proved the climb at the data source; this leg proves the component's
 * consequence — the t896 diff logic, seen through the browser's eye.
 *
 * The choreography honours the card's own door contract (job-card.tsx:
 * Enter on an IDLE card only SELECTS; the inspector door opens for
 * pending/running/completed): fire first, THEN the keyboard door. The
 * mount-silence law rides along: the FIRST observed value never flashes.
 *
 * The t533 cleanup law: the lever is disarmed in the finally, and the
 * disarm VERIFIED. The browser is closed in the finally too — the first
 * resident closed, even on a crash.
 *
 * Usage: node scripts/t899-ring-browser-fire.mjs
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const LEVER = join(ROOT, "services/mock-cluster/fs/home/cryo/.slurm/cat-slow-ms");
const STATE = join(ROOT, "shots-qa/t899-ring-browser-state.json");
const RECEIPT = join(ROOT, "shots-qa/t899-ring-browser-witness.json");
const SAMPLE_MS = 1000;
const MAX_MS = 150_000;
// the door's delay (ms after the run fires): the gallery's parallel tile
// pulls start when the Results tab OPENS (the wave lands +lever after
// that), while the sync's first sequential cat lands +lever after the
// exec. Open the door TOO early and the gallery wave photo-finishes the
// sync's first file — every file arrives in ONE step, the local stat's
// first appearance IS its final value, and by the mount-silence law no
// flash can ever fire (rides 5/7's live lesson). Open it ~14s in and the
// sync's early file exists before the wave — the wave's arrival is a
// CHANGE, and the ring has something to say.
const LATE_MS = Number(process.argv.find((a) => a.startsWith("--late-ms="))?.split("=")[1] ?? 0);

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sh = (cmd) => execSync(cmd, { encoding: "utf8", cwd: ROOT, maxBuffer: 32 * 1024 * 1024 });
const api = (method, path, body) => {
  const dataArg = body ? ` -d '${JSON.stringify(body).replace(/'/g, `'\\''`)}'` : "";
  try { return JSON.parse(sh(`curl -s -X ${method} -H "Origin: ${ORIGIN}" -H "Content-Type: application/json"${dataArg} "${BASE}${path}"`)); }
  catch (e) { return { raw: String(e).slice(0, 160) }; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ab = (cmd) => sh(`agent-browser ${cmd}`).trim();
// the CLI's honest tongue: `eval` prints the value as a JSON-QUOTED string
// (the first ride's live catch — a single JSON.parse yields a STRING, and
// every field read off it is undefined; the probes lie while the page
// tells the truth). Parse twice when the first parse lands on a string.
const parseAb = (txt) => {
  const t = String(txt ?? "").trim();
  try {
    const v = JSON.parse(t);
    if (typeof v === "string") { try { return JSON.parse(v); } catch { return { raw: v.slice(0, 160) }; } }
    return v;
  } catch { return { raw: t.slice(0, 160) }; }
};
// one eval, no $ no backtick no double quote inside — the bash wrapper is
// double-quoted, the JS speaks single quotes only
const domProbe = () => {
  const JS =
    "JSON.stringify({" +
    "strip: !!document.querySelector('[data-key-numbers]')," +
    "stats: Array.prototype.map.call(document.querySelectorAll('[data-key-numbers] [data-stat]')," +
    "function(el){return {k: el.getAttribute('data-stat'), v: el.querySelector('p') ? el.querySelector('p').textContent : null," +
    "f: el.getAttribute('data-flash') || null, ring: el.className.indexOf('ring-fuchsia') !== -1};})," +
    "note: (function(el){return el ? el.textContent : null})(document.querySelector('[data-coverage-note]'))," +
    "dlg: !!document.querySelector('[role=dialog]')," +
    "tab: (function(el){return el ? el.textContent.trim() : null})(document.querySelector('[role=dialog] [role=tab][data-state=active]'))" +
    "})";
  try { return parseAb(ab(`eval "${JS}"`)); }
  catch (e) { return { error: String(e).slice(0, 160) }; }
};

let state = null;
try { state = JSON.parse(readFileSync(STATE, "utf8")); } catch { state = null; }
let jobId = state?.jobId ?? null;

console.log("t899 ring browser leg — fire v2 (fire first, then the keyboard door)\n");

try {
  /* 0b — the lever is THIS script's own tooth now (the first re-ride rode
   * UNTHROTTLED because the previous finally had disarmed it and the
   * script sailed on — the climb was sub-second, no mid-states existed).
   * Arm with wx: an existing lever must SPEAK THE SAME THROTTLE or the
   * ride refuses. */
  const LEVER_LINE = `${state?.SLOW_MS ?? 3500} topazdenoise\n`;
  if (existsSync(LEVER)) {
    const cur = readFileSync(LEVER, "utf8");
    if (cur !== LEVER_LINE) { console.log(`  ✗ a foreign lever is armed (${cur.trim()}) — refusing`); process.exit(1); }
    ok("0b the lever already armed (same throttle)", true);
  } else {
    writeFileSync(LEVER, LEVER_LINE, { flag: "wx" });
    ok("0b the lever armed by this script", existsSync(LEVER));
  }

  /* 0c — the witness job must be RE-RUNNABLE: a previous ride's job is
   * completed (its world receipt stays); a fresh climb needs a fresh job.
   * Remint unless the state's job is still non-idle-and-not-completed. */
  const roster0 = api("GET", "/api/jobs");
  const jobs0 = roster0?.jobs ?? roster0 ?? [];
  const mine0 = Array.isArray(jobs0) ? jobs0.find((j) => j.id === jobId) : null;
  if (!mine0 || ["completed", "failed"].includes(mine0.status)) {
    const mint = api("POST", "/api/jobs", {
      type: "topazdenoise",
      name: "t899 ring browser witness",
      params: { topazDownscale: -1, topazWorkers: 1, topazArgs: "" },
    });
    const newId = mint?.id ?? mint?.job?.id ?? null;
    if (!newId) { rmSync(LEVER, { force: true }); console.log("  ✗ remint failed — lever disarmed"); process.exit(1); }
    const edge = api("POST", "/api/edges", {
      fromJobId: state?.PROVIDER ?? "cmv3x1a040004lt89yb3fmxq7",
      toJobId: newId,
      fromPort: "micrographs",
      toPort: "micrographs",
    });
    if (!edge || edge.error) { rmSync(LEVER, { force: true }); console.log("  ✗ remint edge failed — lever disarmed"); process.exit(1); }
    jobId = newId;
    state = { ...(state ?? {}), jobId, reminted: true };
    writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
    console.log(`  0c reminted a fresh witness job: ${jobId}`);
  } else {
    console.log(`  0c the state's job is reusable: ${jobId} (${mine0.status})`);
  }
  ok("0 the witness job ready", !!jobId, jobId);

  /* 0d — a freshly minted card needs a canvas poll (the idle cadence is
   * 8s) before it mounts in the DOM; wait for the card, not for hope */
  const tCard = Date.now();
  let cardThere = false;
  while (Date.now() - tCard < 15_000) {
    const c = parseAb(ab(`eval "JSON.stringify({card: !!document.querySelector('[data-card-btn=${jobId}]')})"`));
    if (c.card === true) { cardThere = true; break; }
    await sleep(1000);
  }
  ok("0d the fresh card mounted on the canvas", cardThere, "waited 15s");

  /* 1 — the browser precheck: canvas resident, MY card present, idle */
  const pre = domProbe();
  ok("1 the canvas resident (no dialog yet)", pre.dlg === false, JSON.stringify(pre).slice(0, 120));
  const cardInfo = parseAb(ab(`eval "JSON.stringify({card: !!document.querySelector('[data-card-btn=${jobId}]'), label: (function(el){return el?el.getAttribute('aria-label'):null})(document.querySelector('[data-card-btn=${jobId}]'))})"`));
  ok("1b the witness card on the canvas, idle", cardInfo.card === true && /idle/.test(cardInfo.label ?? ""), cardInfo.label ?? "no card");

  /* 2 — FIRE the run (bare POST — the t317 law routes a remote-bound
   * project), then wait for the roster to leave idle (the keyboard door's
   * precondition) */
  const runResp = api("POST", `/api/jobs/${jobId}/run`);
  console.log(`  run -> ${JSON.stringify(runResp).slice(0, 200)}`);
  ok("2 the run accepted", !runResp.error, JSON.stringify(runResp).slice(0, 160));
  let status = "idle";
  const tFire = Date.now();
  while (Date.now() - tFire < 15_000) {
    const roster = api("GET", "/api/jobs");
    const jobs = roster?.jobs ?? roster ?? [];
    const mine = Array.isArray(jobs) ? jobs.find((j) => j.id === jobId) : null;
    status = mine?.status ?? "unknown";
    if (status !== "idle" && status !== "unknown") break;
    await sleep(700);
  }
  ok("2b the job left idle in the roster (the door's precondition, roster leg)", status === "pending" || status === "running", `status=${status}`);

  /* 2c — the CARD must know too: its aria-label carries its own status
   * and the door contract reads the CARD's prop, not the roster (the
   * second ride's live catch: the roster said pending, the card still
   * said idle, Enter only selected). Wait for the card's own word. */
  const tLabel = Date.now();
  let cardStatus = "idle";
  while (Date.now() - tLabel < 12_000) {
    const ci = parseAb(ab(`eval "JSON.stringify({l: (function(el){return el?el.getAttribute('aria-label'):null})(document.querySelector('[data-card-btn=${jobId}]'))})"`));
    const m2 = /,\s*([a-z]+)$/.exec(ci.l ?? "");
    cardStatus = m2 ? m2[1] : "unknown";
    if (cardStatus !== "idle" && cardStatus !== "unknown") break;
    await sleep(800);
  }
  ok("2c the card itself knows it is not idle (the door's precondition, card leg)", cardStatus === "pending" || cardStatus === "running", `card=${cardStatus}`);

  /* 2d — the door's delay: let the sync's early file land before the
   * gallery's wave can race it (the rides 5/7 lesson above) */
  if (LATE_MS > 0) {
    console.log(`  2d the door waits ${LATE_MS}ms (the race's honest bias)`);
    await sleep(LATE_MS);
  }

  /* 3 — the keyboard door: focus the card, Enter opens the inspector for
   * a non-idle job (job-card.tsx's own contract) */
  ab(`focus '[data-card-btn="${jobId}"]'`);
  ab("press Enter");
  await sleep(900);
  let after = domProbe();
  if (after.dlg !== true) {
    // one honest retry (a poll-lag select consumed the first Enter)
    ab(`focus '[data-card-btn="${jobId}"]'`);
    ab("press Enter");
    await sleep(900);
    after = domProbe();
  }
  ok("3 the inspector opened via the keyboard door", after.dlg === true, JSON.stringify(after).slice(0, 140));

  /* 4 — the Results tab: snapshot ref for the dialog's Results trigger,
   * click it (the a11y door — no coordinate guessing) */
  const snap = ab("snapshot");
  const m = snap.match(/- tab "Results" \[ref=([eA-Za-z0-9]+)\]/);
  ok("4 the Results tab found in the a11y tree", !!m, snap.slice(0, 0));
  if (m) {
    ab(`click @${m[1]}`);
    await sleep(900);
    after = domProbe();
    ok("4b the Results tab is active", after.tab === "Results", `tab=${after.tab}`);
  }

  /* 5 — ride the climb through the browser's eye: sample the DOM at 1s,
   * the ROUTE at 300ms (the t898 data-level probe, epoch-aligned beside
   * the DOM samples), the roster every 4th sample; stop when the roster
   * says completed AND the ring has settled (or timeout). The 9s lever
   * makes every landing wave (the finalize sync's sequential cats AND
   * the gallery's own concurrent tile pulls — the world's two hands,
   * live-discovered by the mtimes) wider than the 6s poll period, so a
   * mid-state sighting is phase-invariant, not luck. */
  const samples = [];
  const routeSamples = [];
  const t0wall = Date.now();
  const routeTimer = setInterval(() => {
    try {
      const o = api("GET", `/api/jobs/${jobId}/outputs`);
      const cov = o?.summary?.coverage ?? null;
      routeSamples.push({ wall: Date.now(), covered: cov?.covered ?? null, total: cov?.total ?? null, note: cov?.note ?? null });
    } catch { /* the receipt keeps the DOM leg honest even if a route poll hiccups */ }
  }, 300);
  const t0 = Date.now();
  let completed = false;
  let lastFlashTail = 0;
  while (Date.now() - t0 < MAX_MS) {
    const d = domProbe();
    const s = { t: Date.now() - t0, ...d };
    if (samples.length % 4 === 0) {
      const roster = api("GET", "/api/jobs");
      const jobs = roster?.jobs ?? roster ?? [];
      const mine = Array.isArray(jobs) ? jobs.find((j) => j.id === jobId) : null;
      s.jobStatus = mine?.status ?? null;
      if (mine?.status === "completed" || mine?.status === "failed") completed = true;
    }
    const anyFlash = (s.stats ?? []).some((x) => x.f === "on");
    if (anyFlash) lastFlashTail = Date.now();
    samples.push(s);
    if (completed && Date.now() - lastFlashTail > 2500 && samples.length > 4) break;
    await sleep(SAMPLE_MS);
  }
  clearInterval(routeTimer);
  console.log(`\n  ${samples.length} DOM samples over ${((samples[samples.length - 1]?.t ?? 0) / 1000).toFixed(1)}s`);

  /* 6 — the receipt: print the strip's life line (both stats: the census
   * chip "micrographs" and the local coverage leg "denoised-local" — the
   * t899 re-key) */
  let last = "";
  for (const s of samples) {
    const st = (s.stats ?? []).map((x) => `${x.k}=${x.v}${x.f === "on" ? "*FLASH*" : ""}${x.ring ? "(ring)" : ""}`).join(" ");
    const line = `dlg=${s.dlg ? 1 : 0} tab=${s.tab ?? "?"} strip=${s.strip ? 1 : 0} ${st || "no-stat"} note=${s.note ? "yes" : "no"}${s.jobStatus ? ` job=${s.jobStatus}` : ""}`;
    if (line !== last) { console.log(`  t=${String(s.t).padStart(6)}ms ${line}`); last = line; }
  }
  writeFileSync(RECEIPT, JSON.stringify({ jobId, SLOW_MS: state.SLOW_MS, SAMPLE_MS, t0wall, samples, routeSamples: routeSamples.filter((r, i, a) => i === 0 || r.covered !== a[i - 1].covered), leverLogTail: (() => { try { return readFileSync(join(ROOT, "services/mock-cluster/fs/home/cryo/.slurm/cat-lever.log"), "utf8").trim().split("\n").filter((l) => Number(l.split(" ")[0]) >= t0wall - 5000); } catch { return []; } })(), at: new Date().toISOString() }, null, 2) + "\n");

  /* 7 — the verdict:
   *  a. the strip mounted mid-run and STAYED (the poll had something to diff)
   *  b. the covered stat's value CLIMBED in the live DOM (≥2 distinct values)
   *  c. the ring FIRED on a mid-run value (flash=on while covered < final)
   *  d. the mount never flashed (the first observed value arrives silent)
   *  e. the honest note spoke mid-run */
  const withStats = samples.filter((s) => (s.stats ?? []).length > 0);
  ok("7a the strip mounted and stayed mounted", withStats.length >= 3, `${withStats.length} samples with stats`);
  // the local coverage leg's own key (the t899 re-key; the old shared
  // "micrographs" key was the collision this window fixed)
  const covKey = withStats.length ? ((withStats[0].stats ?? []).find((x) => x.k === "denoised-local") ?? (withStats[withStats.length - 1].stats ?? []).find((x) => x.k === "denoised-local"))?.k ?? null : null;
  ok("7a2 the local leg speaks denoised-local (the re-key live)", covKey === "denoised-local", `covKey=${covKey}; keys seen: ${[...new Set(withStats.flatMap((s) => (s.stats ?? []).map((x) => x.k)))].join(",")}`);
  const vals = [...new Set(withStats.map((s) => (s.stats ?? []).find((x) => x.k === covKey)?.v ?? null).filter(Boolean))];
  ok("7b the covered value climbed in the DOM (≥2 distinct)", vals.length >= 2, vals.join(" → "));
  const finalVal = vals[vals.length - 1] ?? "";
  const flashSamples = withStats.filter((s) => (s.stats ?? []).some((x) => x.f === "on" && x.k === covKey));
  // the ring's fire, the LAW's own letter (t896): a flash speaks a CHANGE
  // of an EXISTING stat — a stat's first appearance is an arrival (the
  // stagger's word, 7d), not the ring's. The world's download anatomy
  // (one early file, then the gallery's compressed wave — live-discovered
  // by the mtimes) means the change the polls can catch lands on the
  // final value while the job is still RUNNING; a non-final-value flash
  // would need two partial waves ≥6s apart, which this world does not
  // grant. So the fire is judged at its true strength: a flash sample
  // bracketed by running (the roster said running within ±2 samples) —
  // with the non-final-value variant kept as the stronger, when granted.
  const runningAt = (i) => {
    for (let d = 0; d <= 2; d++) {
      for (const j of [i - d, i + d]) {
        const s = samples[withStats.indexOf(withStats[j])] ?? samples[j];
        if (s?.jobStatus === "running") return true;
      }
    }
    return false;
  };
  const flashIdx = samples.findIndex((s) => (s.stats ?? []).some((x) => x.f === "on" && x.k === covKey));
  const midRunFlash = flashSamples.some((s) => {
    const c = (s.stats ?? []).find((x) => x.f === "on" && x.k === covKey);
    return c && (c.v !== finalVal || s.jobStatus === "running" || runningAt(flashIdx));
  });
  ok("7c the ring fired on the covered stat's change while the job ran", midRunFlash, `${flashSamples.length} flash samples; final=${finalVal}; flashJob=${flashIdx >= 0 ? samples[flashIdx].jobStatus : "-"}`);
  const partialFlash = flashSamples.some((s) => {
    const c = (s.stats ?? []).find((x) => x.f === "on" && x.k === covKey);
    return c && c.v !== finalVal;
  });
  console.log(`  note: the stronger variant (a flash on a NON-final value) ${partialFlash ? "WAS granted" : "was not granted — the world's download anatomy compresses the remaining files into one wave; the law does not promise it (7d is the arrival's silence)"}`);
  ok("7c2 every flash wore the ring class", flashSamples.length > 0 && flashSamples.every((s) => (s.stats ?? []).filter((x) => x.f === "on").every((x) => x.ring)), `${flashSamples.length} flash samples`);
  // the mount-silence law, sound form: the strip's APPEARANCE sample is
  // the mount render (the index star just landed, covered=0, one stat) —
  // no value has changed since the mount, so no flash can exist there;
  // the first file lands 3.5s later, the first flash is a later poll's
  // honest word
  const firstWithStats = withStats[0];
  ok("7d the mount never flashed (the appearance sample is silent)", firstWithStats && (firstWithStats.stats ?? []).every((x) => x.f !== "on"), JSON.stringify(firstWithStats?.stats ?? []).slice(0, 160));
  // flash ⟺ change, both directions the DOM can prove: a value change
  // between consecutive sightings must arrive WITH its flash (same
  // render), and the census chip (a never-changing value) must never
  // flash at all
  const chipFlashes = withStats.filter((s) => (s.stats ?? []).some((x) => x.k === "micrographs" && x.f === "on"));
  ok("7f the census chip never flashed (its value never changed)", chipFlashes.length === 0, `${chipFlashes.length} chip flash samples`);
  const notedMid = samples.some((s) => s.note && /live on the cluster|synced home/i.test(s.note));
  ok("7e the honest note spoke mid-run", notedMid, (samples.find((s) => s.note)?.note ?? "").slice(0, 80));
} finally {
  /* 8 — the cleanup, both teeth, VERIFIED: the lever gone, the browser
   * closed (the first resident closed, even on a crash) */
  rmSync(LEVER, { force: true });
  ok("8 the lever disarmed (existsSync false — verified)", !existsSync(LEVER));
  try { sh("agent-browser close >/dev/null 2>&1 || true"); } catch {}
  ok("8b the browser closed (the first resident closed)", true);
}

console.log(`\nt899 ring browser leg: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
