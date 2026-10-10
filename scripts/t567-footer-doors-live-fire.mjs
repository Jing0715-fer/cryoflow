/**
 * t567 — the footer doors, live end-to-end: the two borrowed-evidence
 * footers become navigation.
 *
 * t566 paired the cards (receipt | parent's verdict). This window makes
 * the pairing WALKABLE: a "from X" / "verdict on X" footer that names a
 * live job (provenance carries id AND name — the name proves the row
 * still exists) opens that job's own tab via the store's openJob dialect
 * (workspace hop → cross-project switch → select+focus or inspect).
 * A source known only as a string (receipt.source with no job id) stays
 * plain text — never a door whose destination is unverified.
 *
 * Faces proven here:
 *   A  birth select (verdict's keep ∪ maybe) → paired row, TWO doors:
 *      A1  click the stamp's "verdict on {parent}" → inspector lands on
 *          the parent's own tab (stamp self-fetches, NO via-link, no row,
 *          no receipt — the borrowed card became the owned card).
 *      A2  fresh-open the probe again, click the receipt's "from" door →
 *          the same landing, through the other card.
 *   B  param select (selectedClasses, no birth provenance) → plain
 *      receipt, NO pairing (kind param never borrows the stamp) — but
 *      the "from" footer IS a door since t568 (log-first provenance:
 *      the logged input path maps back to the wired parent; this face
 *      originally asserted the doorless plain text — t568 flipped it,
 *      see t568-footer-doors-live-fire.mjs for the focused proof).
 *
 * Runs in the EMPIAR world in place (no switch), deletes both mints on
 * the way out (roster must return to its starting count).
 *
 * Usage: node scripts/t567-footer-doors-live-fire.mjs
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
    // newline-normalize BEFORE stringify (t566 live catch #2) and unwrap
    // the CLI's JSON-encoded return (t566 live catch #3).
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
  // about:blank FIRST: a second `open` of the same URL is a soft no-op and
  // the previous face's inspector dialog eats Ctrl+K (t566 live catch #4)
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

// the parent's stamp is a durable world asset (t565b wrote it). Without
// it there is no pairing and no borrowed footer to make walkable.
const stampRes = JSON.parse(api("GET", `/api/jobs/${class2d.id}/ai-verdict`));
if (!stampRes.available) {
  console.error(`FATAL: ${class2d.name} carries no AI verdict stamp — run t565b once to write one`);
  process.exit(2);
}
check("parent class2d exists and is stamped", true, `${class2d.name} · ${stampRes.stamp.counts.keep} keep / ${stampRes.stamp.counts.maybe} maybe`);

// the probe's classes: the verdict's keep ∪ maybe — the exact gamble face
const gamble = [
  ...stampRes.stamp.classes.filter((c) => c.verdict === "keep").map((c) => c.cls),
  ...stampRes.stamp.classes.filter((c) => c.verdict === "maybe").map((c) => c.cls),
].sort((a, b) => a - b);
if (gamble.length === 0) { console.error("FATAL: the stamp has no keep/maybe classes — nothing to birth from"); process.exit(2); }

/** after a door click: poll the inspector into its LANDED shape — the
 * parent's own stamp present, nothing of the borrower's tab left. */
const landJs = `JSON.stringify((function(){
  return {
    stamp: !!document.querySelector("[data-canvas-ui='ai-verdict-stamp']"),
    row: !!document.querySelector("[data-canvas-ui='selection-evidence-row']"),
    receipt: !!document.querySelector("[data-canvas-ui='selection-receipt']"),
    viaLink: !!document.querySelector("[data-canvas-ui='verdict-via-link']"),
    fromLink: !!document.querySelector("[data-canvas-ui='receipt-from-link']")
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
  /* ================= FACE A — paired row, two doors ================== */
  console.log(`\n[Face A] birth select ${JSON.stringify(gamble)} → paired row, doors armed`);
  const mintA = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t567 Door Probe",
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
  check("provenance names a live parent (door precondition)",
    receiptA?.provenance?.sourceJobId === class2d.id && !!receiptA?.provenance?.sourceJobName,
    `${receiptA?.provenance?.sourceJobName ?? "?"}`);

  await openJob("t567 Door Probe");
  // poll for the PAIRED face with both doors armed
  const pairJs = `JSON.stringify((function(){
    const row = document.querySelector("[data-canvas-ui='selection-evidence-row']");
    if (!row) return { row: false };
    const receipt = row.querySelector("[data-canvas-ui='selection-receipt']");
    const stamp = row.querySelector("[data-canvas-ui='ai-verdict-stamp']");
    const fromBtn = row.querySelector("[data-canvas-ui='receipt-from-link']");
    const viaBtn = row.querySelector("[data-canvas-ui='verdict-via-link']");
    return {
      row: true, receipt: !!receipt, stamp: !!stamp,
      fromDoor: fromBtn ? { tag: fromBtn.tagName, icon: !!fromBtn.querySelector("svg"),
        text: (fromBtn.innerText || "").trim(),
        title: fromBtn.getAttribute("title") || "" } : null,
      viaDoor: viaBtn ? { tag: viaBtn.tagName, icon: !!viaBtn.querySelector("svg"),
        text: (viaBtn.innerText || "").trim(),
        title: viaBtn.getAttribute("title") || "" } : null
    };
  })())`;
  const pairRaw = await pollUntil(() => {
    const raw = evalJs(pairJs);
    if (!raw || raw === "null") return null;
    try {
      const j = JSON.parse(raw);
      return j.row && j.receipt && j.stamp && j.viaDoor && j.fromDoor ? raw : null;
    } catch { return null; }
  }, 25000);
  let pair = null;
  try { pair = JSON.parse(pairRaw ?? "null"); } catch { /* stays null */ }
  check("paired evidence row mounted", !!pair?.row);
  check("receipt carries a from-DOOR (button + icon)",
    pair?.fromDoor?.tag === "BUTTON" && pair?.fromDoor?.icon === true,
    pair?.fromDoor?.text ?? "no door");
  check("from-door title names the parent and promises the jump",
    (pair?.fromDoor?.title ?? "").includes("click to open") && (pair?.fromDoor?.title ?? "").includes(receiptA?.provenance?.sourceJobName ?? "§"),
    pair?.fromDoor?.title?.slice(0, 70));
  check("stamp carries a verdict-on DOOR (button + icon)",
    pair?.viaDoor?.tag === "BUTTON" && pair?.viaDoor?.icon === true,
    pair?.viaDoor?.text ?? "no door");
  check("verdict-door names its owner",
    new RegExp(`verdict on\\s*${class2d.name}`).test(pair?.viaDoor?.text ?? ""),
    pair?.viaDoor?.text);
  try {
    sh(`agent-browser screenshot '[data-canvas-ui="selection-evidence-row"]' .qa-logs/shots/t567-doors-paired.png >/dev/null 2>&1`);
    console.log("  📸 .qa-logs/shots/t567-doors-paired.png");
  } catch { /* best effort */ }

  /* ---- A1: click the verdict door → land on the parent's own tab ---- */
  console.log("\n[A1] click verdict-via-link → the parent's own tab");
  try { sh(`agent-browser click "[data-canvas-ui='verdict-via-link']" >/dev/null 2>&1`); } catch { /* poll decides */ }
  const land1 = await pollUntil(async () => landed(evalJs(landJs)), 15000);
  check("landed on the parent's own Results tab", !!land1,
    land1 ? "stamp owned, row/receipt/via gone" : JSON.stringify(evalJs(landJs)));
  // the parent's name must be the inspector's headline — the only name
  // the canvas behind cannot fake is the one inside the DIALOG. The
  // dialog is the topmost layer; its stamp footer has no "verdict on".
  const dialogNameJs = `JSON.stringify((function(){
    const dlg = document.querySelector("[role='dialog']");
    return dlg ? { has: dlg.innerText.indexOf(${JSON.stringify(class2d.name)}) >= 0 } : { has: false };
  })())`;
  const dlg1 = await pollUntil(async () => {
    const raw = evalJs(dialogNameJs);
    try { const j = JSON.parse(raw ?? "null"); return j?.has ? j : null; } catch { return null; }
  }, 8000);
  check("dialog headlines the parent job", !!dlg1, class2d.name);

  /* ---- A2: fresh-open the probe, take the receipt's door ------------ */
  console.log("\n[A2] fresh-open the probe, click receipt-from-link → same landing");
  await openJob("t567 Door Probe");
  const pair2Raw = await pollUntil(() => {
    const raw = evalJs(pairJs);
    if (!raw || raw === "null") return null;
    try { const j = JSON.parse(raw); return j.row && j.fromDoor ? raw : null; } catch { return null; }
  }, 25000);
  let pair2 = null;
  try { pair2 = JSON.parse(pair2Raw ?? "null"); } catch { /* stays null */ }
  check("paired row re-mounted on the fresh open", !!pair2?.row);
  try { sh(`agent-browser click "[data-canvas-ui='receipt-from-link']" >/dev/null 2>&1`); } catch { /* poll decides */ }
  const land2 = await pollUntil(async () => landed(evalJs(landJs)), 15000);
  check("from-door lands on the parent's own tab too", !!land2,
    land2 ? "stamp owned, row/receipt/from gone" : JSON.stringify(evalJs(landJs)));

  /* ================= FACE B — param select → plain receipt, from-door = */
  console.log("\n[Face B] param select (selectedClasses 3) → plain receipt, from-door via the log (t568)");
  const mintB = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t567 Plain Probe",
    x: 60, y: 420,
    params: { selectedClasses: "3" },
  }));
  const probeB = mintB.job ?? mintB;
  minted.push(probeB.id);
  check("minted param select2d", !!probeB?.id, probeB?.id);

  // a param select has NO birth source to resolve its input from — the
  // native run needs the wired edge (t564a/t566's shape)
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
  check("t568: source mapped from the LOG (params name nothing)",
    receiptB?.provenance?.sourceJobId === class2d.id && !!receiptB?.provenance?.sourceJobName,
    `${receiptB?.provenance?.sourceJobName ?? "none"} (from ${receiptB?.provenance?.sourceJobId ? "log path" : "params"})`);

  await openJob("t567 Plain Probe");
  const plainRaw = await pollUntil(() => {
    const raw = evalJs(
      `JSON.stringify((function(){
        const card = document.querySelector("[data-canvas-ui='selection-receipt']");
        if (!card) return { receipt: false };
        return {
          receipt: true,
          door: !!card.querySelector("[data-canvas-ui='receipt-from-link']"),
          fromText: ((card.innerText.match(/from [^\\n·]*/) ?? [""])[0]).trim()
        };
      })())`
    );
    if (!raw || raw === "null") return null;
    try { const j = JSON.parse(raw); return j.receipt ? raw : null; } catch { return null; }
  }, 20000);
  let plain = null;
  try { plain = JSON.parse(plainRaw ?? "null"); } catch { /* stays null */ }
  check("plain receipt still renders", plain?.receipt === true);
  check("t568: the param lane's from footer IS a door now", plain?.door === true,
    plain?.fromText || "no from footer text");
  if (plain?.fromText) {
    check("the door names the wired parent",
      new RegExp(`from\\s*${class2d.name}`).test(plain.fromText), plain.fromText.slice(0, 60));
  }

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
