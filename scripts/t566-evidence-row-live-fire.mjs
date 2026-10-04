/**
 * t566 — the selection evidence row, live end-to-end: a birth selection's
 * Results tab pairs the receipt (engine numbers — WHAT was kept) with the
 * parent's AI verdict stamp (the judge's reasons — WHY).
 *
 * The pairing's gate is the receipt route's provenance: kind "birth" +
 * sourceJobId names the class2d run the selection was born from; when
 * THAT job carries a stamp (t565b's verdict — a durable world asset in
 * data/ai-verdicts.json), the row renders
 *   [ receipt (emerald, lg:col-span-2) | verdict (violet, lg:col-span-3) ]
 * with the stamp's footer naming its true owner ("verdict on class2d K5").
 * Any other shape degrades to the plain full-width receipt.
 *
 * Faces proven here:
 *   A  birth select (classes [2,5] — the verdict's maybe ∪ keep) → PAIRED
 *      row: both cards side by side, receipt left & narrower, verdict
 *      right & wider, "verdict on" note in the footer.
 *   B  param select (selectedClasses "3", no birth provenance) → PLAIN
 *      receipt: no evidence-row wrapper, no stamp card anywhere.
 *
 * Not proven here (noted honestly): a birth select whose parent has NO
 * stamp — this world's only class2d (K5) is stamped, and minting a fresh
 * classification just to leave it unjudged would burn minutes of engine
 * time for one boolean of the same guard line Face B already exercises
 * (`!source || !receipt?.available || !stamp?.available`).
 *
 * Runs in the EMPIAR world in place (no switch), deletes both mints on
 * the way out (roster must return to its starting count).
 *
 * Usage: node scripts/t566-evidence-row-live-fire.mjs
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
    // newline-normalize BEFORE stringify: a literal \n that survives the
    // shell round-trip lands at JS CODE position in the CLI's eval and is
    // a SyntaxError (run-1's silent Face A failure — every eval threw,
    // 2>/dev/null ate the testimony). None of our exprs need real newlines.
    const flat = expr.replace(/\s*\n\s*/g, " ");
    const raw = sh(`agent-browser eval ${JSON.stringify(flat)} 2>/dev/null`);
    // the CLI returns the eval result JSON-ENCODED — a quoted string with
    // escaped inner quotes ("{\"row\":true}"). Stripping the outer quotes
    // leaves {\"row\":true}, which JSON.parse rejects (run-2/3's silent
    // failure — the poll threw for 25s while the row sat filled on screen,
    // the 📸 line proving the element existed all along). Unwrap for real.
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed.trim() : raw.trim();
    } catch {
      return raw.replace(/^"|"$/g, "").trim();
    }
  } catch { return ""; }
};
const openJob = async (name) => {
  // about:blank FIRST: a second `open` of the same URL is a soft no-op —
  // the previous face's inspector dialog stays up, the modal eats Ctrl+K,
  // and the palette jump silently never happens (run-2's Face B failure)
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
if (!class2d) { console.error("FATAL: no completed class2d — no birth source."); process.exit(2); }

// the parent's stamp is a durable world asset (t565b wrote it; upserts
// keep it newest). Without it there is no pairing to prove — refuse
// instead of minting an opinion this harness has no business minting.
const stampRes = JSON.parse(api("GET", `/api/jobs/${class2d.id}/ai-verdict`));
if (!stampRes.available) {
  console.error(`FATAL: ${class2d.name} carries no AI verdict stamp — run t565b once to write one`);
  process.exit(2);
}
check("parent class2d exists and is stamped", true, `${class2d.name} · ${stampRes.stamp.counts.keep} keep / ${stampRes.stamp.counts.maybe} maybe / ${stampRes.stamp.counts.reject} reject`);

// the probe's classes: the verdict's maybe ∪ keep — the exact gamble face
const gamble = [
  ...stampRes.stamp.classes.filter((c) => c.verdict === "keep").map((c) => c.cls),
  ...stampRes.stamp.classes.filter((c) => c.verdict === "maybe").map((c) => c.cls),
].sort((a, b) => a - b);
if (gamble.length === 0) { console.error("FATAL: the stamp has no keep/maybe classes — nothing to birth from"); process.exit(2); }

const minted = [];
try {
  /* ================= FACE A — birth select → PAIRED row ============== */
  console.log(`\n[Face A] birth select ${JSON.stringify(gamble)} → paired evidence row`);
  const mintA = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t566 Evidence Probe",
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

  const receiptA = await pollUntil(() => {
    const r = JSON.parse(api("GET", `/api/jobs/${probeA.id}/selection-receipt`));
    return r.available ? r : null;
  }, 10000);
  check("receipt available", !!receiptA);
  check("provenance kind = birth", receiptA?.provenance?.kind === "birth", receiptA?.provenance?.kind);
  check("provenance names the parent", receiptA?.provenance?.sourceJobId === class2d.id,
    `${receiptA?.provenance?.sourceJobName ?? "?"} (${receiptA?.provenance?.sourceJobId ?? "?"})`);

  await openJob("t566 Evidence Probe");
  const rowJs = `JSON.stringify((function(){
    const row = document.querySelector("[data-canvas-ui='selection-evidence-row']");
    if (!row) return { row: false };
    const receipt = row.querySelector("[data-canvas-ui='selection-receipt']");
    const stamp = row.querySelector("[data-canvas-ui='ai-verdict-stamp']");
    const r = receipt?.getBoundingClientRect(); const s = stamp?.getBoundingClientRect();
    return {
      row: true, grid: row.className, receipt: !!receipt, stamp: !!stamp,
      sideBySide: !!(r && s && s.left >= r.right - 1),
      receiptNarrower: !!(r && s && r.width < s.width),
      receiptLeft: !!(r && s && r.left < s.left),
      stampText: stamp?.innerText || ""
    };
  })())`;
  // the row mounts FIRST (its wrapper has no data dependency); the cards
  // land after the dynamic chunks load AND the row's fetch chain fills
  // (receipt response -> birth source -> parent's stamp -> paired grid).
  // Poll for the COMPLETED face, not the wrapper — the first paint is
  // the plain receipt with the stamp still in flight (live catch).
  const rowRaw = await pollUntil(() => {
    const raw = evalJs(rowJs);
    if (!raw || raw === "null") return null;
    try { const j = JSON.parse(raw); return j.row && j.receipt && j.stamp ? raw : null; }
    catch { return null; }
  }, 25000);
  let row = null;
  try { row = JSON.parse(rowRaw ?? "null"); } catch { /* stays null */ }
  check("evidence row mounted", !!row?.row);
  check("grid classes (lg:grid-cols-5)", (row?.grid ?? "").includes("lg:grid-cols-5"), row?.grid?.slice(0, 60));
  check("receipt card inside the row", row?.receipt === true);
  check("parent's stamp card inside the row", row?.stamp === true);
  check("side by side (verdict right of receipt)", row?.sideBySide === true);
  check("receipt leads left, narrower (2:3 spans)", row?.receiptLeft === true && row?.receiptNarrower === true);
  if (row?.stampText) {
    check("stamp footer names its owner", new RegExp(`verdict on\\s*${class2d.name}`).test(row.stampText),
      (row.stampText.match(/verdict on[^\n]*/i) ?? [""])[0].trim());
    check("stamp carries the verdict chips", /class \d+/i.test(row.stampText));
    check("stamp keeps the notebook footer", /asked/i.test(row.stampText));
  } else {
    check("stamp footer names its owner", false, "stamp text unreadable");
  }
  try {
    sh(`agent-browser screenshot '[data-canvas-ui="selection-evidence-row"]' .qa-logs/shots/t566-evidence-row.png >/dev/null 2>&1`);
    console.log("  📸 .qa-logs/shots/t566-evidence-row.png");
  } catch { /* best effort */ }

  /* ================= FACE B — param select → PLAIN receipt =========== */
  console.log("\n[Face B] param select (selectedClasses 3) → plain receipt, no pairing");
  const mintB = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t566 Plain Probe",
    x: 60, y: 420,
    params: { selectedClasses: "3" },
  }));
  const probeB = mintB.job ?? mintB;
  minted.push(probeB.id);
  check("minted param select2d", !!probeB?.id, probeB?.id);

  // a param select has NO birth source to resolve its input from — the
  // native run needs the wired edge (the gallery tick flow always wires
  // its source; t564a's probe did the same)
  const edgeB = JSON.parse(api("POST", "/api/edges", {
    fromJobId: class2d.id, toJobId: probeB.id,
  }));
  check("wired edge from the parent", !!edgeB?.edge?.id || !!edgeB?.id, `HTTP ${edgeB?.error ?? "201"}`);

  api("POST", `/api/jobs/${probeB.id}/run`, { local: true });
  const doneB = await pollUntil(() => {
    const lj = jobsOfActive().find((x) => x.id === probeB.id);
    return lj && lj.status === "completed" ? lj : null;
  }, 30000);
  check("ran to completed", !!doneB, doneB?.result ?? "");

  const receiptB = await pollUntil(() => {
    const r = JSON.parse(api("GET", `/api/jobs/${probeB.id}/selection-receipt`));
    return r.available ? r : null;
  }, 10000);
  check("receipt available", !!receiptB);
  check("provenance kind = param (no birth)", receiptB?.provenance?.kind === "param", receiptB?.provenance?.kind);

  await openJob("t566 Plain Probe");
  // the plain receipt also rides a dynamic chunk + its own fetch — poll
  // for the CARD first, only then assert the absences around it
  const plainRow = await pollUntil(() => {
    const raw = evalJs(
      `JSON.stringify({ row: !!document.querySelector("[data-canvas-ui='selection-evidence-row']"), receipt: !!document.querySelector("[data-canvas-ui='selection-receipt']"), stamp: !!document.querySelector("[data-canvas-ui='ai-verdict-stamp']") })`
    );
    if (!raw || raw === "null") return null;
    try { const j = JSON.parse(raw); return j.receipt ? raw : null; } catch { return null; }
  }, 20000);
  let plain = null;
  try { plain = JSON.parse(plainRow ?? "null"); } catch { /* stays null */ }
  check("plain receipt still renders", plain?.receipt === true);
  check("NO evidence row (honest degradation)", plain?.row === false);
  check("no stamp card anywhere on the tab", plain?.stamp === false);

  const errs = sh(`agent-browser errors 2>/dev/null`).trim();
  check("console clean across both faces", errs === "", errs ? errs.slice(0, 80) : "0 errors");
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
