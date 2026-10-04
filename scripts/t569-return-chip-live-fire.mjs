/**
 * t569 — the return face of the door family, live end-to-end: the way
 * BACK from a door landing.
 *
 * t567 made the borrowed footers walkable (from / verdict on → the
 * parent's own tab); t568 taught the receipt where its feed lives. This
 * window closes the loop: openJob swapping an OPEN inspector for another
 * job now remembers what was showing, and the header offers a one-level
 * return chip — "back to {name}". The chip's click is the openJob
 * dialect itself, which RE-captures (ping-pong: back and forth forever),
 * never a history stack. Direct navigation (canvas click) and a dialog
 * close clear the context — a chip only means something while the swap
 * it came from is still on screen. (The in-page clearing is enforced in
 * the store's inspect(); the harness proves the two user-visible faces.)
 *
 * Faces proven here:
 *   A  birth select → paired row → verdict door → land on the parent →
 *      return chip present, naming the probe → click → land BACK on the
 *      probe's tab (paired row re-mounts) → chip now names the parent
 *      (the ping-pong capture) — the full round trip.
 *   B  direct open (fresh page, palette) → NO return chip — a navigation
 *      that never went through a door owes nobody a way back.
 *
 * Runs in the EMPIAR world in place (no switch), deletes the mint on the
 * way out (roster must return to its starting count).
 *
 * Usage: node scripts/t569-return-chip-live-fire.mjs
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
const evalJs = (expr) => {
  try {
    const flat = expr.replace(/\s*\n\s*/g, " ");
    const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed.trim() : raw.trim();
    } catch {
      return raw.replace(/^"|"$/g, "").trim();
    }
  } catch { return ""; }
};
const openJob = async (name) => {
  sh(`agent-browser open "about:blank" >/dev/null 2>&1`);
  await sleep(600);
  sh(`agent-browser open "${BASE}" >/dev/null 2>&1`);
  await sleep(3000);
  sh(`agent-browser press Control+k >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser keyboard type "${name}" >/dev/null 2>&1`);
  await sleep(900);
  sh(`agent-browser press Enter >/dev/null 2>&1`);
  await sleep(1800);
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

const class2d = jobsOfActive().find((j) => j.type === "class2d" && j.status === "completed");
if (!class2d) { console.error("FATAL: no completed class2d — no door destination."); process.exit(2); }
const stampRes = JSON.parse(api("GET", `/api/jobs/${class2d.id}/ai-verdict`));
if (!stampRes.available) {
  console.error(`FATAL: ${class2d.name} carries no AI verdict stamp — run t565b once to write one`);
  process.exit(2);
}
check("parent class2d exists and is stamped", true, class2d.name);

const gamble = [
  ...stampRes.stamp.classes.filter((c) => c.verdict === "keep").map((c) => c.cls),
  ...stampRes.stamp.classes.filter((c) => c.verdict === "maybe").map((c) => c.cls),
].sort((a, b) => a - b);
if (gamble.length === 0) { console.error("FATAL: the stamp has no keep/maybe classes"); process.exit(2); }

/** the landing shape: the parent's OWN tab (nothing of the visitor's) */
const landJs = `JSON.stringify((function(){
  return {
    stamp: !!document.querySelector("[data-canvas-ui='ai-verdict-stamp']"),
    row: !!document.querySelector("[data-canvas-ui='selection-evidence-row']"),
    receipt: !!document.querySelector("[data-canvas-ui='selection-receipt']"),
    viaLink: !!document.querySelector("[data-canvas-ui='verdict-via-link']"),
    fromLink: !!document.querySelector("[data-canvas-ui='receipt-from-link']"),
    chip: (document.querySelector("[data-canvas-ui='inspector-return-link']")?.innerText || "").trim()
  };
})())`;
const landed = (raw) => {
  try {
    const j = JSON.parse(raw ?? "null");
    return j && j.stamp && !j.row && !j.receipt && !j.viaLink && !j.fromLink ? j : null;
  } catch { return null; }
};

const minted = [];
try {
  /* ============ FACE A — the full round trip ========================= */
  console.log(`\n[Face A] birth select ${JSON.stringify(gamble)} → door → parent → chip → back`);
  const mintA = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t569 Return Probe",
    x: 60, y: 60,
    classStarSelection: { jobId: class2d.id, classes: gamble },
  }));
  const probeA = mintA.job ?? mintA;
  minted.push(probeA.id);
  check("minted birth select2d", !!probeA?.id, probeA?.id);

  api("POST", `/api/jobs/${probeA.id}/run`, { local: true });
  const doneA = await pollUntil(() => {
    const lj = jobsOfActive().find((x) => x.id === probeA.id);
    return lj && lj.status === "completed" ? lj : null;
  }, 30000);
  check("ran to completed", !!doneA, doneA?.result ?? "");

  await openJob("t569 Return Probe");
  const pairJs = `JSON.stringify((function(){
    const row = document.querySelector("[data-canvas-ui='selection-evidence-row']");
    if (!row) return { row: false };
    return {
      row: true,
      stamp: !!row.querySelector("[data-canvas-ui='ai-verdict-stamp']"),
      viaDoor: !!row.querySelector("[data-canvas-ui='verdict-via-link']")
    };
  })())`;
  const pairRaw = await pollUntil(() => {
    const raw = evalJs(pairJs);
    if (!raw || raw === "null") return null;
    try { const j = JSON.parse(raw); return j.row && j.stamp && j.viaDoor ? raw : null; } catch { return null; }
  }, 25000);
  let pair = null;
  try { pair = JSON.parse(pairRaw ?? "null"); } catch { /* stays null */ }
  check("paired row mounted on the probe's tab", !!pair?.row);

  console.log("\n[A1] verdict door → the parent's tab → the return chip");
  try { sh(`agent-browser click "[data-canvas-ui='verdict-via-link']" >/dev/null 2>&1`); } catch { /* poll decides */ }
  const land1 = await pollUntil(async () => {
    const j = landed(evalJs(landJs));
    return j && j.chip ? j : null;
  }, 15000);
  check("landed on the parent's own tab", !!land1, land1 ? "stamp owned, visitor's cards gone" : evalJs(landJs).slice(0, 120));
  check("the return chip is present", !!land1?.chip, land1?.chip);
  check("the chip names where we came from",
    (land1?.chip ?? "").includes("back to") && (land1?.chip ?? "").includes("t569 Return Probe"),
    land1?.chip);

  console.log("\n[A2] click the chip → back on the probe's tab, chip re-captured");
  try { sh(`agent-browser click "[data-canvas-ui='inspector-return-link']" >/dev/null 2>&1`); } catch { /* poll decides */ }
  const backRaw = await pollUntil(() => {
    const raw = evalJs(pairJs);
    if (!raw || raw === "null") return null;
    try { const j = JSON.parse(raw); return j.row && j.stamp && j.viaDoor ? raw : null; } catch { return null; }
  }, 25000);
  let back = null;
  try { back = JSON.parse(backRaw ?? "null"); } catch { /* stays null */ }
  check("landed back on the probe's paired row", !!back?.row, "row + stamp + door all home");
  const chip2Raw = await pollUntil(async () => {
    const raw = evalJs(`JSON.stringify((function(){
      const c = document.querySelector("[data-canvas-ui='inspector-return-link']");
      return { chip: c ? (c.innerText || "").trim() : "" };
    })())`);
    try { const j = JSON.parse(raw ?? "null"); return j?.chip ? raw : null; } catch { return null; }
  }, 10000);
  let chip2 = null;
  try { chip2 = JSON.parse(chip2Raw ?? "null"); } catch { /* stays null */ }
  check("the re-captured chip names the parent (ping-pong, one level)",
    (chip2?.chip ?? "").includes("back to") && (chip2?.chip ?? "").includes(class2d.name),
    chip2?.chip);
  try {
    sh(`agent-browser screenshot '[data-canvas-ui="selection-evidence-row"]' .qa-logs/shots/t569-back-home.png >/dev/null 2>&1`);
    console.log("  📸 .qa-logs/shots/t569-back-home.png");
  } catch { /* best effort */ }

  /* ============ FACE B — direct open, NO chip ======================== */
  console.log("\n[Face B] direct open of the parent (fresh page, palette) → no chip");
  await openJob(class2d.name);
  const directRaw = await pollUntil(async () => {
    const j = landed(evalJs(landJs));
    return j ? JSON.stringify(j) : null;
  }, 15000);
  let direct = null;
  try { direct = JSON.parse(directRaw ?? "null"); } catch { /* stays null */ }
  check("the parent's own tab renders (self-fetch stamp)", !!direct?.stamp);
  check("NO return chip on a direct open — nobody to go back to",
    (direct?.chip ?? "") === "", direct?.chip || "absent");

  const errs = sh(`agent-browser errors 2>/dev/null`).trim();
  check("console clean across all faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
} finally {
  try { sh(`agent-browser close >/dev/null 2>&1`); } catch { /* gone */ }
  for (const id of minted) {
    try { api("DELETE", `/api/jobs/${id}?confirm=true`); } catch { /* best effort */ }
  }
  await sleep(800);
  const roster1 = JSON.parse(api("GET", "/api/projects")).projects.find((p) => p.id === EMPIAR_ID);
  check("roster restored", roster1.stats.total === roster0, `${roster0} → ${roster1.stats.total}`);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
