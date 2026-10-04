/**
 * t564a — the receipt card's 1D face, live end-to-end (t562 entry ②).
 *
 * t562's A-face probe minted a 2D receipt (demo world, mock lane) and
 * proved the card, but the 1D `select` family ran on pre-receipt logs —
 * its native lane was never lit in a browser. This probe mints a real
 * 1D select in the EMPIAR world, wires it to the completed class2d K5
 * (real edge, real run.out), runs the engine-native lane ({local:true}
 * — the ▾ door), and verifies BOTH layers:
 *
 *   route:  verb "select", NO mode line (runSelectNative only writes one
 *           for first-N), modeKind "auto" derived from the result line's
 *           occupancy verdict (the t564 lib polish), class rows present.
 *   card:   the sky "OCCUPANCY RULE" chip — NOT the grey "selection"
 *           chip the pre-polish parser produced for every 1D receipt.
 *
 * The world is borrowed in place (no switch — the EMPIAR world IS the
 * active world), the mint + edge are deleted on the way out (cascade
 * takes the edge), the roster must return to its starting count.
 *
 * Usage: node scripts/t564a-select1d-live-fire.mjs
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
  /* ---- resolve the class2d K5 source from the roster -------------------- */
  const list = jobsOfActive();
  const class2d = list.find((j) => j.type === "class2d" && j.status === "completed");
  check("a completed class2d source exists", !!class2d, class2d?.name);

  /* ---- mint the 1D select + wire it to the class2d ---------------------- */
  const mintRes = JSON.parse(api("POST", "/api/jobs", {
    type: "select",
    name: "t564 1D Select Probe",
    x: 60, y: 60,
  }));
  minted = mintRes.job ?? mintRes;
  check("minted 1D select", !!minted?.id, minted?.id);

  const edgeRes = JSON.parse(api("POST", "/api/edges", {
    fromJobId: class2d.id, toJobId: minted.id,
  }));
  check("edge wired class2d → select", !!edgeRes?.edge?.id || !!edgeRes?.id, JSON.stringify(edgeRes).slice(0, 60));

  /* ---- run it (the native lane through the explicit local door) --------- */
  api("POST", `/api/jobs/${minted.id}/run`, { local: true });
  const done = await pollUntil(() => {
    const lj = jobsOfActive().find((x) => x.id === minted.id);
    return lj && lj.status === "completed" ? lj : null;
  }, 30000);
  check("ran to completed", !!done, done?.result ?? "");

  /* ---- the route's 1D face ---------------------------------------------- */
  const receipt = await pollUntil(() => {
    const r = JSON.parse(api("GET", `/api/jobs/${minted.id}/selection-receipt`));
    return r.available ? r : null;
  }, 10000);
  check("receipt available", !!receipt);
  check("verb = select (the 1D family)", receipt?.receipt?.verb === "select", receipt?.receipt?.verb);
  check("NO mode line (class-aware 1D writes none)", receipt?.receipt?.mode === null, receipt?.receipt?.mode);
  check("t564 pin: modeKind auto (from the result line's verdict)", receipt?.receipt?.modeKind === "auto", receipt?.receipt?.modeKind);
  check("class rows present", (receipt?.receipt?.classes?.length ?? 0) > 0, `${receipt?.receipt?.classes?.length} classes`);
  check("kept/total read", receipt?.receipt?.kept > 0 && receipt?.receipt?.total > 0,
    `${receipt?.receipt?.kept}/${receipt?.receipt?.total}`);
  check("result line says 'particles selected'", /particles selected/.test(receipt?.result ?? ""), (receipt?.result ?? "").slice(0, 70));

  /* ---- the card's OCCUPANCY chip, in the browser ------------------------- */
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3000);
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "t564 1D Select Probe" >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(1800);
  const card = await pollUntil(() => readCard(), 20000);
  check("card mounted on the 1D probe", !!card);
  if (card) {
    check("OCCUPANCY RULE chip (not the grey selection)", /OCCUPANCY RULE/i.test(card));
    check("no grey SELECTION-only chip mislead", !/SELECTION\s*\n/i.test(card) || /OCCUPANCY RULE/i.test(card));
    check("classes kept counter", /\d+\/\d+ classes kept/i.test(card), (card.match(/\d+\/\d+ classes kept/i) ?? [""])[0]);
    try {
      sh(`agent-browser screenshot '[data-canvas-ui="selection-receipt"]' .qa-logs/shots/t564a-select1d-card.png >/dev/null 2>&1`);
      console.log("  📸 .qa-logs/shots/t564a-select1d-card.png");
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
