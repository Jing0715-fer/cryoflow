/**
 * t562b — the receipt card's BIRTH face, live end-to-end.
 *
 * No living select2d carries a birth selection right now (the gamble
 * mint was deleted at t554 cleanup), so this probe mints one through the
 * SAME door the AI's select_classes uses (POST /api/jobs with
 * classStarSelection + run), verifies the receipt route's provenance
 * (kind "birth" + the source job's name) and the card's violet BORN
 * chip, then deletes the mint (cascade takes the edge) — zero drift.
 *
 * Usage: node scripts/t562b-birth-face-live-fire.mjs
 */

import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const DEMO_ID = "cmur3ti510002n5831da9zcuk";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
// the demo world's real class2d (the source the auto receipt rode: run_it012)
const CLASS2D_ID = "cmur4tdv60001n5w5j01dxmds"; // placeholder — resolved below from the roster

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, timeoutMs = 20000, step = 500) {
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

/* ---- world borrow ----------------------------------------------------- */
api("POST", "/api/projects/switch", { id: DEMO_ID });
const roster0 = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === DEMO_ID);
const n0 = roster0.stats.total;
console.log(`borrowed demo world — roster ${n0}`);

let minted = null;
try {
  /* ---- resolve the real class2d source from the roster ---------------- */
  const list = jobsOfActive();
  const class2d = list.find((j) => j.type === "class2d" && j.status === "completed");
  check("a completed class2d source exists", !!class2d, class2d?.name);
  const srcId = class2d?.id ?? CLASS2D_ID;

  /* ---- mint the birth select2d (the select_classes door) --------------- */
  const mintRes = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t562 Birth Probe",
    x: 60, y: 60,
    classStarSelection: { jobId: srcId, classes: [1, 2] },
  }));
  minted = mintRes.job ?? mintRes;
  check("minted", !!minted?.id, minted?.id);

  /* ---- run it (the engine-native sync lane) ---------------------------- */
  api("POST", `/api/jobs/${minted.id}/run`, {});
  const done = await pollUntil(() => {
    const lj = jobsOfActive().find((x) => x.id === minted.id);
    return lj && lj.status === "completed" ? lj : null;
  }, 20000);
  check("ran to completed", !!done, done?.result ?? "");

  /* ---- the route's provenance face -------------------------------------- */
  const receipt = await pollUntil(() => {
    const r = JSON.parse(api("GET", `/api/jobs/${minted.id}/selection-receipt`));
    return r.available ? r : null;
  }, 10000);
  check("receipt available", !!receipt);
  check("provenance kind = birth", receipt?.provenance?.kind === "birth", receipt?.provenance?.kind);
  check("sourceJobName resolved", receipt?.provenance?.sourceJobName === class2d?.name, receipt?.provenance?.sourceJobName);
  check("receipt.birth flag", receipt?.receipt?.birth === true);
  check("mode says birth selection", /birth selection/.test(receipt?.receipt?.mode ?? ""), receipt?.receipt?.mode);
  check("kept = the birth set's occupancy sum", receipt?.receipt?.kept > 0, `${receipt?.receipt?.kept}/${receipt?.receipt?.total}`);

  /* ---- the card's BORN chip, in the browser ----------------------------- */
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3000);
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "t562 Birth Probe" >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(1800);
  const card = await pollUntil(() => readCard(), 20000);
  check("card mounted on the birth probe", !!card);
  if (card) {
    check("BORN chip present", /BORN/i.test(card));
    check("from <source name> footer", new RegExp(`from ${class2d?.name}`).test(card), `from ${receipt?.provenance?.sourceJobName}`);
    check("manual chip (the mode line's verb)", /MANUAL/i.test(card));
    try {
      sh(`agent-browser screenshot '[data-canvas-ui="selection-receipt"]' .qa-logs/shots/t562b-birth-card.png >/dev/null 2>&1`);
      console.log("  📸 .qa-logs/shots/t562b-birth-card.png");
    } catch { /* best effort */ }
  }
  const errs = sh(`agent-browser errors 2>/dev/null`).trim();
  check("console clean", errs === "", errs ? errs.slice(0, 80) : "0 errors");
} finally {
  /* ---- return: delete the mint, restore the world ---------------------- */
  try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* gone */ }
  if (minted?.id) {
    api("DELETE", `/api/jobs/${minted.id}?confirm=true`);
    await sleep(600);
  }
  const roster1 = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === DEMO_ID);
  check("roster restored", roster1.stats.total === n0, `${n0} → ${roster1.stats.total}`);
  api("POST", "/api/projects/switch", { id: EMPIAR_ID });
  const back = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.active);
  check("returned to the EMPIAR world", back?.id === EMPIAR_ID, back?.name);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
