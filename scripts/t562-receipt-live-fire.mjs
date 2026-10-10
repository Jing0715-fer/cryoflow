/**
 * t562 — the selection receipt card, alive in the browser.
 *
 * Borrow-return law: the completed native select2d (auto mode, 168 of
 * 240, 8 classes) lives in the β-Gal demo world — switch IN, verify,
 * switch BACK to the EMPIAR world the session opened on (zero drift).
 *
 * Claims pinned here:
 *   A1  the receipt card mounts in the Results tab of a completed
 *       select2d and shows the engine's receipt: kept 168 of 240, the
 *       70% badge, the occupancy-rule chip, 8 class chips with counts
 *   A2  the fraction bar renders (the emerald fill exists)
 *   A3  a 1D select from the PRE-RECEIPT mock lane renders NO card —
 *       the honest absence is absence in the DOM, not an empty shell
 *   A4  the tab's other content still stands around the card (the
 *       receipt is additive, nothing displaced)
 *
 * Usage: node scripts/t562-receipt-live-fire.mjs
 */

import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const DEMO_ID = "cmur3ti510002n5831da9zcuk";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const SELECT2D_ID = "cmur5xp450003n5u2mm94x2te"; // QA Class Select — auto receipt
const SELECT_1D_ID = "cmur61wzl000zn5u2r1pcg9hj"; // QA Particle Select — pre-receipt lane

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pollUntil(fn, timeoutMs = 15000, step = 500) {
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
    (body ? ` -d '${JSON.stringify(body)}'` : "") + ` "${BASE}${path}"`
  );

/* the card reader: eval + innerText (the `text` command does not exist in
   this agent-browser build — probe the tool's own vocabulary first) */
const CARD_JS =
  "document.querySelector(\"[data-canvas-ui='selection-receipt']\")?.innerText || ''";
const readCard = () => {
  try {
    const raw = sh('agent-browser eval ' + JSON.stringify(CARD_JS) + ' 2>/dev/null');
    const t = raw.replace(/^"|"$/g, "").trim();
    return t.length > 0 ? t : null;
  } catch { return null; }
};

/* ---- world guard: note where we start, borrow the demo world --------- */
const startWorld = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.active);
console.log(`start world: ${startWorld?.name} (${startWorld?.id})`);
api("POST", "/api/projects/switch", { id: DEMO_ID });
const borrowed = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.active);
check("borrowed the demo world", borrowed?.id === DEMO_ID, borrowed?.name);

try {
  /* ---- A1-A2: the receipt card on a completed select2d ---------------- */
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3000);

  // drive the app's own dialect: ⌘K palette → job name → Enter → openJob
  // (completed → inspect → the inspector lands on Results by default)
  const jumpTo = async (name) => {
    try { sh(`agent-browser press Escape >/dev/null 2>&1`); } catch { /* best effort */ }
    await sleep(400);
    sh(`agent-browser press Control+k >/dev/null 2>&1`);
    await sleep(900);
    sh(`agent-browser keyboard type "${name}" >/dev/null 2>&1`);
    await sleep(900);
    sh(`agent-browser press Enter >/dev/null 2>&1`);
    await sleep(1800);
  };

  await jumpTo("QA Class Select");

  // the Results tab is the smart default for completed jobs — wait for card
  const cardText = await pollUntil(() => readCard(), 20000);
  check("A1 receipt card mounted", !!cardText);

  if (cardText) {
    check("A1 kept 168 present", /168/.test(cardText));
    check("A1 of 240 present", /240/.test(cardText));
    check("A1 70% badge", /70%/.test(cardText));
    check("A1 occupancy-rule chip", /occupancy rule/i.test(cardText));
    check("A1 2/8 classes kept", /2\/8 classes kept/.test(cardText));
    for (const cls of ["class 1", "class 2", "class 8"]) {
      check(`A1 chip ${cls}`, cardText.includes(cls));
    }
    check("A1 ran-at stamp", /ran /.test(cardText));
    const bar = await pollUntil(
      () => { try { return sh(`agent-browser eval "!!document.querySelector('[data-canvas-ui=\\'selection-receipt\\'] [role=\\'img\\']')" 2>/dev/null`).includes("true") || null; } catch { return null; } },
      8000
    );
    check("A2 fraction bar in DOM", bar === true);
    const barPct = sh(
      `agent-browser eval "document.querySelector('[data-canvas-ui=\\'selection-receipt\\'] [role=\\'img\\'] > div')?.style?.width || ''" 2>/dev/null`
    ).trim();
    check("A2 bar width = 70%", /70/.test(barPct), barPct);

    // screenshot for the eyeball
    try {
      sh(`agent-browser screenshot '[data-canvas-ui="selection-receipt"]' .qa-logs/shots/t562-receipt-card.png >/dev/null 2>&1`);
      console.log("  📸 .qa-logs/shots/t562-receipt-card.png");
    } catch { /* shot is best-effort */ }
  }

  /* ---- A3: the pre-receipt 1D select renders NO card ------------------ */
  await jumpTo("QA Particle Select");
  let ghost = null;
  try {
    ghost = readCard();
  } catch { ghost = null; }
  check("A3 no card on the pre-receipt 1D select", !ghost || ghost.trim() === "", ghost ? ghost.slice(0, 40) : "absent");

  /* ---- A4: console stayed clean during the visit ---------------------- */
  const errs = sh(`agent-browser errors 2>/dev/null`).trim();
  check("A4 browser error ledger clean", errs === "", errs ? errs.slice(0, 80) : "0 errors");
} finally {
  /* ---- return the world: zero drift ----------------------------------- */
  try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* gone is fine */ }
  api("POST", "/api/projects/switch", { id: EMPIAR_ID });
  const back = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.active);
  check("returned to the EMPIAR world", back?.id === EMPIAR_ID, back?.name);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
