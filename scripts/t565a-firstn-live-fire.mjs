/**
 * t565a — the receipt card's LAST unlit face: 1D select in first-N mode,
 * live end-to-end (t564 entry ②).
 *
 * The receipt family matrix after this probe:
 *   2D select2d  — auto (t562, demo world) / birth (t562b, t564b) /
 *                  gamble inclusive (t561) / borderline (t554)
 *   1D select    — class-aware occupancy (t564a) / FIRST-N (this probe)
 *
 * Recon correction (t564's claim, checked against the drive): the extract
 * world's particles.star CARRIES _rlnClassNumber #4 (autopick picks ship
 * class numbers), so a plain wire would light the class-aware face again.
 * The engine's first-N mode has TWO disjuncts — engine.ts ~L5692
 * `classCol >= 0 && cutoff > 0` means classCutoff=0 takes the second one,
 * and the mode line says so verbatim: "first-N (no _rlnClassNumber column
 * or classCutoff=0)". This probe drives the classCutoff=0 branch with
 * maxParticles=2500 against the extract star's 10866 particles.
 *
 * Usage: node scripts/t565a-firstn-live-fire.mjs
 */

import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const WANT_KEPT = 2500;
const WANT_TOTAL = 10866;

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, timeoutMs = 30000, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    await sleep(step);
  }
  return null;
}
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const api = (verb, path, body) =>
  sh(
    `curl -s -X ${verb} -H "Content-Type: application/json" -H "Origin: ${BASE}" -H "Referer: ${BASE}/"` +
    (body ? ` -d ${JSON.stringify(JSON.stringify(body))}` : "") + ` "${BASE}${path}"`
  );
const jobsOfActive = () => {
  const d = JSON.parse(api("GET", "/api/jobs"));
  return Array.isArray(d) ? d : (d.jobs ?? []);
};

const CARD_JS =
  "document.querySelector(\"[data-canvas-ui='selection-receipt']\")?.innerText || ''";
const readCard = () => {
  try {
    const raw = sh('agent-browser eval ' + JSON.stringify(CARD_JS) + ' 2>/dev/null');
    const t = raw.replace(/^"|"$/g, "").trim();
    return t.length > 0 ? t : null;
  } catch { return null; }
};

/* ---- world guard: the EMPIAR world must already be active ------------- */
const projects = JSON.parse(api("GET", "/api/projects")).projects;
const active = projects.find((p) => p.active || p.isActive);
if (!active || active.id !== EMPIAR_ID) {
  console.error(`FATAL: active world is ${active?.id ?? "unknown"} (${active?.name ?? "?"}), expected EMPIAR ${EMPIAR_ID} — refusing to run in a borrowed world`);
  process.exit(2);
}
const roster0 = active.stats.total;
console.log(`world guard ok — EMPIAR active, roster ${roster0}`);

let minted = null;
try {
  /* ---- resolve the extract source from the roster ------------------------ */
  const list = jobsOfActive();
  const extract = list.find((j) => j.type === "extract" && j.status === "completed");
  check("a completed extract source exists", !!extract, extract?.name);

  /* ---- mint the 1D select with the first-N dial -------------------------
   * classCutoff=0 is the engine's SECOND first-N disjunct (the star does
   * carry _rlnClassNumber — autopick picks ship class numbers); setting it
   * to 0 bypasses the class-aware branch and the mode line names it. */
  const mintRes = JSON.parse(api("POST", "/api/jobs", {
    type: "select",
    name: "t565 1D first-N Probe",
    x: 60, y: 60,
    params: { maxParticles: WANT_KEPT, classCutoff: 0 },
  }));
  minted = mintRes.job ?? mintRes;
  check("minted 1D select (maxParticles 2500, classCutoff 0)", !!minted?.id, minted?.id);
  // params rides as a JSON string in the roster DTO but may arrive as an
  // object in the mint response (t560: don't assume the REST shape)
  const rawParams = typeof minted?.params === "string" ? minted.params : JSON.stringify(minted?.params ?? {});
  const mintParams = JSON.parse(rawParams || "{}");
  check("params landed (maxParticles/classCutoff)", mintParams.maxParticles === WANT_KEPT && mintParams.classCutoff === 0,
    `maxParticles=${mintParams.maxParticles} classCutoff=${mintParams.classCutoff}`);

  const edgeRes = JSON.parse(api("POST", "/api/edges", {
    fromJobId: extract.id, toJobId: minted.id,
  }));
  check("edge wired extract → select", !!edgeRes?.edge?.id || !!edgeRes?.id, JSON.stringify(edgeRes).slice(0, 60));

  /* ---- run it (the native lane through the explicit local door) --------- */
  api("POST", `/api/jobs/${minted.id}/run`, { local: true });
  const done = await pollUntil(() => {
    const lj = jobsOfActive().find((x) => x.id === minted.id);
    return lj && lj.status === "completed" ? lj : null;
  }, 30000);
  check("ran to completed", !!done, done?.result ?? "");

  /* ---- the route's first-N face ------------------------------------------ */
  const receipt = await pollUntil(() => {
    const r = JSON.parse(api("GET", `/api/jobs/${minted.id}/selection-receipt`));
    return r.available ? r : null;
  }, 10000);
  check("receipt available", !!receipt);
  check("verb = select (the 1D family)", receipt?.receipt?.verb === "select", receipt?.receipt?.verb);
  check("mode line verbatim (the classCutoff=0 disjunct)",
    receipt?.receipt?.mode === "first-N (no _rlnClassNumber column or classCutoff=0)",
    receipt?.receipt?.mode);
  check("modeKind first-n", receipt?.receipt?.modeKind === "first-n", receipt?.receipt?.modeKind);
  check("NO class rows (first-N keeps no class stats)", (receipt?.receipt?.classes?.length ?? -1) === 0,
    `${receipt?.receipt?.classes?.length} class rows`);
  check(`kept = ${WANT_KEPT} (maxParticles honored)`, receipt?.receipt?.kept === WANT_KEPT, receipt?.receipt?.kept);
  check(`total = ${WANT_TOTAL} (the extract star)`, receipt?.receipt?.total === WANT_TOTAL, receipt?.receipt?.total);
  check("no class-count group in the result line",
    receipt?.receipt?.keptClasses == null && receipt?.receipt?.totalClasses == null,
    `keptClasses=${receipt?.receipt?.keptClasses} totalClasses=${receipt?.receipt?.totalClasses}`);
  check("result line bare (no occupancy verdict)",
    /^[\d,]+ of [\d,]+ particles selected$/.test((receipt?.result ?? "").trim()),
    (receipt?.result ?? "").slice(0, 60));

  /* ---- the card's first-N chip + note, in the browser -------------------- */
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3000);
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "t565 1D first-N Probe" >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(1800);
  const card = await pollUntil(() => readCard(), 20000);
  check("card mounted on the first-N probe", !!card);
  if (card) {
    check("first-N chip (not the grey selection, not occupancy)", /first-N/i.test(card) && !/OCCUPANCY RULE/i.test(card),
      (card.match(/first-N/i) ?? [""])[0]);
    check("the honest note line (no per-class rows)", /no per-class rows/i.test(card));
    check("note names the first N", new RegExp(`first ${WANT_KEPT.toLocaleString("en-US")} particles`).test(card.replace(/\u00a0/g, ",")) ||
          new RegExp(`first ${WANT_KEPT}`).test(card), "first 2,500");
    check("no class chips (nothing to rank)", !/class \d+/.test(card));
    check("kept/total big numbers", new RegExp(`${WANT_KEPT.toLocaleString("en-US")}`).test(card) &&
          new RegExp(`${WANT_TOTAL.toLocaleString("en-US")}`).test(card),
          `${WANT_KEPT.toLocaleString("en-US")} / ${WANT_TOTAL.toLocaleString("en-US")}`);
    try {
      sh(`agent-browser screenshot '[data-canvas-ui="selection-receipt"]' .qa-logs/shots/t565a-firstn-card.png >/dev/null 2>&1`);
      console.log("  📸 .qa-logs/shots/t565a-firstn-card.png");
    } catch { /* best effort */ }
  }
  const errs = sh(`agent-browser errors 2>/dev/null`).trim();
  check("console clean", errs === "", errs ? errs.slice(0, 80) : "0 errors");
} finally {
  /* ---- return: delete the mint (cascade takes the edge), verify roster -- */
  try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* gone */ }
  if (minted?.id) {
    api("DELETE", `/api/jobs/${minted.id}?confirm=true`);
    await sleep(600);
  }
  const roster1 = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
  check("roster restored", roster1.stats.total === roster0, `${roster0} → ${roster1.stats.total}`);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
