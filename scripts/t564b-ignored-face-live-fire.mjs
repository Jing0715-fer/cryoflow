/**
 * t564b — the receipt card's IGNORED face, live end-to-end (t562 entry ②).
 *
 * The engine writes "(ignored: N, M)" into a manual/birth mode line when
 * the requested class list names classes the classification doesn't
 * have (engine.ts L6017: missing = explicit.filter(c => !counts.has(c))).
 * Two windows of receipt-card work proved the auto, manual, birth and
 * occupancy faces — but no probe ever TRIGGERED the ignored clause, so
 * the amber footer note was pinned only by a synthetic fixture.
 *
 * This probe mints a birth select2d whose class list is [2, 99]: class
 * 2 exists in the class2d K5 input (2932 particles — the t554 gamble's
 * second keep), 99 does not. Expected receipt: mode
 * "manual 1 class (birth selection) (ignored: 99)", kept = 2,932, and
 * the card shows BOTH the violet BORN chip and the amber
 * "ignored: 99" note in one footer row.
 *
 * Runs in the EMPIAR world in place (no switch), deletes the mint on
 * the way out (roster must return to its starting count).
 *
 * Usage: node scripts/t564b-ignored-face-live-fire.mjs
 */

import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";

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
  /* ---- resolve the class2d K5 source from the roster ---------------- */
  const list = jobsOfActive();
  const class2d = list.find((j) => j.type === "class2d" && j.status === "completed");
  check("a completed class2d source exists", !!class2d, class2d?.name);

  /* ---- mint the birth select2d with one ghost class ----------------- */
  const mintRes = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t564 Ignored Probe",
    x: 60, y: 60,
    classStarSelection: { jobId: class2d.id, classes: [2, 99] },
  }));
  minted = mintRes.job ?? mintRes;
  check("minted birth select2d [2, 99]", !!minted?.id, minted?.id);

  /* ---- run it (the native lane through the explicit local door) ----- */
  api("POST", `/api/jobs/${minted.id}/run`, { local: true });
  const done = await pollUntil(() => {
    const lj = jobsOfActive().find((x) => x.id === minted.id);
    return lj && lj.status === "completed" ? lj : null;
  }, 30000);
  check("ran to completed", !!done, done?.result ?? "");

  /* ---- the route's ignored face -------------------------------------- */
  const receipt = await pollUntil(() => {
    const r = JSON.parse(api("GET", `/api/jobs/${minted.id}/selection-receipt`));
    return r.available ? r : null;
  }, 10000);
  check("receipt available", !!receipt);
  check("provenance kind = birth", receipt?.provenance?.kind === "birth", receipt?.provenance?.kind);
  check("mode: birth + ignored, one line", receipt?.receipt?.mode === "manual 1 class (birth selection) (ignored: 99)", receipt?.receipt?.mode);
  check("ignored [99] parsed", JSON.stringify(receipt?.receipt?.ignored) === "[99]", JSON.stringify(receipt?.receipt?.ignored));
  check("kept = class 2's occupancy (the ghost never counted)", receipt?.receipt?.kept === 2932, `${receipt?.receipt?.kept}/${receipt?.receipt?.total}`);
  check("1/5 classes kept", receipt?.receipt?.keptClasses === 1 && receipt?.receipt?.totalClasses === 5, `${receipt?.receipt?.keptClasses}/${receipt?.receipt?.totalClasses}`);

  /* ---- the card's BORN + amber ignored row, in the browser ----------- */
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3000);
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "t564 Ignored Probe" >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(1800);
  const card = await pollUntil(() => readCard(), 20000);
  check("card mounted on the ignored probe", !!card);
  if (card) {
    check("BORN chip present", /BORN/i.test(card));
    check("MANUAL chip (the mode line's verb)", /MANUAL/i.test(card));
    check("amber ignored: 99 footer", /ignored:\s*99/i.test(card));
    check("from <source> footer", new RegExp(`from ${class2d?.name}`).test(card), `from ${receipt?.provenance?.sourceJobName}`);
    check("kept = 2,932 on the card", /2,932/.test(card));
    try {
      sh(`agent-browser screenshot '[data-canvas-ui="selection-receipt"]' .qa-logs/shots/t564b-ignored-card.png >/dev/null 2>&1`);
      console.log("  📸 .qa-logs/shots/t564b-ignored-card.png");
    } catch { /* best effort */ }
  }
  const errs = sh(`agent-browser errors 2>/dev/null`).trim();
  check("console clean", errs === "", errs ? errs.slice(0, 80) : "0 errors");
} finally {
  /* ---- return: delete the mint, verify roster ------------------------- */
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
