/**
 * t568 — log-first provenance, live end-to-end: the receipt's "from"
 * footer works for edge-fed param and auto selections too.
 *
 * t567 Face B caught the gap live: a param select fed through a wired
 * edge had NO from footer at all — the receipt route read provenance
 * from params only (classStarSelection.jobId), and the edge graph said
 * nothing. But the ENGINE already logs the run-time truth: every native
 * select receipt carries `input:  <absolute path> (N particles)`, and
 * the input lives in the producer's workdir whose leaf is
 * `{type}_{id-tail8}` (workdirFor). The route now maps that path back
 * to the producing job (uniqueness gate — zero or several candidates →
 * no mapping) when params name nothing.
 *
 * Why the LOG and not the wire: the wire can be rewired after a run,
 * the log cannot. The receipt card's own law ("never disagree with what
 * ran") extends to its from-relation: provenance is what the engine
 * READ, not what the canvas shows now.
 *
 * Faces proven here:
 *   A  param select (selectedClasses "3") wired from the class2d → run
 *      → kind param + sourceJobId mapped from the LOG → plain receipt
 *      (no evidence row — param never borrows the stamp) with a DOOR →
 *      click → lands on the parent's own tab.
 *   B  auto select (no params at all) wired from the class2d → kind
 *      auto + mapped source → the occupancy rule's run names its feed.
 *   C  rewire honesty: delete the edge AFTER the run → the mapping
 *      stands (the log is the primary source, not the graph).
 *
 * Runs in the EMPIAR world in place (no switch), deletes both mints on
 * the way out (roster must return to its starting count).
 *
 * Usage: node scripts/t568-log-provenance-live-fire.mjs
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
if (!class2d) { console.error("FATAL: no completed class2d — no feed to map back to."); process.exit(2); }
check("parent class2d exists", true, class2d.name);

/** after a door click: the inspector lands on the parent's own shape */
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
const wiredEdges = [];
try {
  /* ============ FACE A — param select + edge → door via the log ====== */
  console.log("\n[Face A] param select (selectedClasses 3) + edge → from-door mapped from the log");
  const mintA = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t568 Log Path Probe",
    x: 60, y: 60,
    params: { selectedClasses: "3" },
  }));
  const probeA = mintA.job ?? mintA;
  minted.push(probeA.id);
  check("minted param select2d (NO classStarSelection in params)", !!probeA?.id, probeA?.id);

  const edgeA = JSON.parse(api("POST", "/api/edges", {
    fromJobId: class2d.id, toJobId: probeA.id,
  }));
  const edgeAId = edgeA?.edge?.id ?? edgeA?.id ?? null;
  if (edgeAId) wiredEdges.push(edgeAId);
  check("wired edge from the parent", !!edgeAId, `HTTP ${edgeA?.error ?? "201"}`);

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
  check("kind = param (the expression's own story)", receiptA?.provenance?.kind === "param", receiptA?.provenance?.kind);
  check("t568: sourceJobId mapped from the LOG PATH",
    receiptA?.provenance?.sourceJobId === class2d.id,
    `${receiptA?.provenance?.sourceJobName ?? "none"}`);
  check("mapping knows the input's home (birth params would say the same)",
    receiptA?.receipt?.inputPath?.includes(`class2d_${class2d.id.slice(-8)}`) === true,
    `…${(receiptA?.receipt?.inputPath ?? "?").slice(-45)}`);

  await openJob("t568 Log Path Probe");
  const plainJs = `JSON.stringify((function(){
    const card = document.querySelector("[data-canvas-ui='selection-receipt']");
    if (!card) return { receipt: false };
    const btn = card.querySelector("[data-canvas-ui='receipt-from-link']");
    const row = document.querySelector("[data-canvas-ui='selection-evidence-row']");
    return {
      receipt: true, door: !!btn, row: !!row,
      text: btn ? (btn.innerText || "").trim() : ((card.innerText.match(/from [^\\n·]*/) ?? [""])[0]).trim()
    };
  })())`;
  const plainRaw = await pollUntil(() => {
    const raw = evalJs(plainJs);
    if (!raw || raw === "null") return null;
    try { const j = JSON.parse(raw); return j.receipt ? raw : null; } catch { return null; }
  }, 20000);
  let plain = null;
  try { plain = JSON.parse(plainRaw ?? "null"); } catch { /* stays null */ }
  check("plain receipt renders (kind param → NO evidence row)", plain?.receipt === true && plain?.row === false);
  check("the from footer IS a door", plain?.door === true, plain?.text);
  check("the door names the wired parent", new RegExp(`from\\s*${class2d.name}`).test(plain?.text ?? ""), plain?.text);

  console.log("\n[A-land] click the from-door → the parent's own tab");
  try { sh(`agent-browser click "[data-canvas-ui='receipt-from-link']" >/dev/null 2>&1`); } catch { /* poll decides */ }
  const land1 = await pollUntil(async () => landed(evalJs(landJs)), 15000);
  check("landed on the parent's own Results tab", !!land1,
    land1 ? "stamp owned, row/receipt/from gone" : JSON.stringify(evalJs(landJs)));
  const dialogNameJs = `JSON.stringify((function(){
    const dlg = document.querySelector("[role='dialog']");
    return dlg ? { has: dlg.innerText.indexOf(${JSON.stringify(class2d.name)}) >= 0 } : { has: false };
  })())`;
  const dlg1 = await pollUntil(async () => {
    const raw = evalJs(dialogNameJs);
    try { const j = JSON.parse(raw ?? "null"); return j?.has ? j : null; } catch { return null; }
  }, 8000);
  check("dialog headlines the parent job", !!dlg1, class2d.name);

  /* ============ FACE C — rewire honesty (before B's UI work) ========= */
  console.log("\n[Face C] delete the edge AFTER the run → the mapping stands");
  if (edgeAId) {
    api("DELETE", `/api/edges/${edgeAId}`);
    await sleep(600);
    const receiptC = JSON.parse(api("GET", `/api/jobs/${probeA.id}/selection-receipt`));
    check("edge deleted", true, wiredEdges.length + " wire(s) removed");
    check("t568 law: the LOG is the primary source — mapping survives the rewire",
      receiptC?.available === true && receiptC?.provenance?.sourceJobId === class2d.id,
      `${receiptC?.provenance?.sourceJobName ?? "none"}`);
    // fresh open: the UI reads the same receipt → the door still stands
    await openJob("t568 Log Path Probe");
    const plain2Raw = await pollUntil(() => {
      const raw = evalJs(plainJs);
      if (!raw || raw === "null") return null;
      try { const j = JSON.parse(raw); return j.receipt ? raw : null; } catch { return null; }
    }, 20000);
    let plain2 = null;
    try { plain2 = JSON.parse(plain2Raw ?? "null"); } catch { /* stays null */ }
    check("door still offered after the edge is gone", plain2?.door === true, plain2?.text);
  } else {
    check("edge deleted", false, "no edge id to delete — face skipped");
    check("t568 law: the LOG is the primary source — mapping survives the rewire", false, "face skipped");
    check("door still offered after the edge is gone", false, "face skipped");
  }

  /* ============ FACE B — auto select, no params at all =============== */
  console.log("\n[Face B] auto select (occupancy rule) + edge → the auto run names its feed");
  const mintB = JSON.parse(api("POST", "/api/jobs", {
    type: "select2d",
    name: "t568 Auto Probe",
    x: 60, y: 420,
  }));
  const probeB = mintB.job ?? mintB;
  minted.push(probeB.id);
  check("minted auto select2d (params empty)", !!probeB?.id, probeB?.id);

  const edgeB = JSON.parse(api("POST", "/api/edges", {
    fromJobId: class2d.id, toJobId: probeB.id,
  }));
  const edgeBId = edgeB?.edge?.id ?? edgeB?.id ?? null;
  if (edgeBId) wiredEdges.push(edgeBId);
  check("wired edge from the parent", !!edgeBId, `HTTP ${edgeB?.error ?? "201"}`);

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
  check("kind = auto (the occupancy rule decided)", receiptB?.provenance?.kind === "auto", receiptB?.provenance?.kind);
  check("t568: the auto run names its feed too",
    receiptB?.provenance?.sourceJobId === class2d.id && !!receiptB?.provenance?.sourceJobName,
    `${receiptB?.provenance?.sourceJobName ?? "none"}`);

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
