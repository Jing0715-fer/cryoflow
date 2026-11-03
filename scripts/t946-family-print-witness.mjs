#!/usr/bin/env node
/**
 * t946 — THE COMPARE FAMILY's print-face live witness: three papers in
 * one arc.
 *
 * The family print unit (t946-family-print-unit.mjs) pins the law to the
 * source; this instrument rides the three doors the minted world can
 * actually open and proves the faces on REAL PAPER (agent-browser pdf —
 * Chromium's own print pipeline):
 *
 *   R1  THE CONVERGENCE PAPER (on the witness's own K=8 variant — the
 *       t919/t917 doctrine: the chain's K=4 census face is degenerate,
 *       60%4==0, born settled; the mover world lives in the variant):
 *       the provenance line (Run · Round 000 vs Round 002 · printed)
 *       reaches the paper — the round pickers it replaces stay home —
 *       the census, the scatter's words and the mover lists reach the
 *       paper, and the continue verb stays home (a verb that prints is
 *       a verb that lies).
 *   R2  THE ARC PAPER (on the chain's class2d): the curve's reading —
 *       the title, the plateau law, the legend, the paper clock —
 *       reaches the paper; the verb stays home.
 *   R3  THE FUNNEL PAPER (on the chain's class2d): the chain's ledger —
 *       the honest verbless footer and the no-postprocess honesty line —
 *       reaches the paper; the copy/CSV chrome stays home.
 *   R4  THE SCREEN KEEPS ITS DOORS: the provenance lines are
 *       screen-hidden, the close X stays on screen (the hide is
 *       print-scoped), overX 0.
 *   R5  THE INSPECTOR STEPS ASIDE on every paper: the inspector's own
 *       print masthead ("CryoFlow — job report") prints no byte while a
 *       family face owns the sheet.
 *   R6  THE RESTORE: the variant dies first (DELETE + both-side sweep,
 *       the t919 remove's law), then the chain remove (the mint's own
 *       verb) — the world back to the seed trio, the binding untouched.
 *
 * Ride laws inherited: born-at-band (t910); click-until-effect on every
 * dialog door (t917); the palette as the deterministic inspector lever
 * (t945); the world's facts persist past the instrument's exit (t944);
 * the litter dies with the witness, on RED too (t917/t919).
 *
 *   node scripts/t946-family-print-witness.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t946-family-print-witness.json";
const T916_MANIFEST = path.join(ROOT, "data", "t916-class2d-mint.json");

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 240_000, cwd: ROOT }).trim();
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};
const ORIGIN = `-H "Origin: ${BASE}"`;
// the API plane is armored against the dev server's own recompile
// windows (the t946 third ride's lesson: the variant DELETE landed the
// server into a restart and the NEXT read got connection-refused —
// curl exit 7. A refused read is the window's noise, not a dead world:
// retry, never conclude).
const api = (method, url, body) => {
  for (let i = 0; i < 6; i++) {
    let out = null;
    try {
      out = execSync(`curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
    } catch {
      sleep(2500);
      continue;
    }
    try { return JSON.parse(out); } catch {
      if (out && out.length > 0) return { error: out.slice(0, 200) };
      sleep(2500);
      continue;
    }
  }
  return { error: "the route never answered through six windows" };
};
const jobsApi = () => api("GET", "/api/jobs").jobs ?? [];
const pollUntil = async (jobId, timeoutMs = 300_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobsApi().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
};
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [1, 2, 6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") { await sleep(400); continue; }
    if (pos.off) return "OFF-VIEWPORT";
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const overflowProbe = `JSON.stringify({ overX: document.documentElement.scrollWidth - document.documentElement.clientWidth })`;
const closeAllDialogs = async () => {
  for (let i = 0; i < 4; i++) {
    const n = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="dialog"]').length })`);
    if ((n?.n ?? 0) === 0) return i;
    sh(`${AB} press Escape`);
    await sleep(450);
  }
  return 4;
};
const resetPage = async (minCards) => {
  await closeAllDialogs();
  for (let i = 0; i < 10; i++) {
    try { sh(`${AB} open ${BASE}/`); break; }
    catch { await sleep(3000); }
  }
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= minCards, 30);
};
const openInspectorByPalette = async (name) => {
  await closeAllDialogs();
  sh(`${AB} press Control+k`);
  await sleep(600);
  // the name is QUOTED — a spaced name unquoted is shell-split and the
  // type command types only the first token (the t946 first ride's lesson)
  sh(`${AB} keyboard type "${name}"`);
  await sleep(800);
  // the hit reads the CONCATENATED value+text — the cmdk items carry the
  // name in their TEXT (the value attribute renders null in this build;
  // the t945-era value-only check is dead against today's DOM)
  const rows = await poll(
    `JSON.stringify({ n: document.querySelectorAll('[cmdk-item]').length, hit: [...document.querySelectorAll('[cmdk-item]')].some(i => ((i.getAttribute('value') || '') + (i.textContent || '')).includes('${name.slice(0, 30)}')) })`,
    (v) => v.hit === true, 8, 400
  );
  if (rows?.hit !== true) { await closeAllDialogs(); return false; }
  sh(`${AB} press Enter`);
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name.slice(0, 30)}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 20, 500
  );
  return opened?.open === true;
};
const openDialogByDoor = async (name, doorAriaStart, wantTitleIncludes) => {
  for (let i = 0; i < 5; i++) {
    const viaPalette = await openInspectorByPalette(name);
    if (!viaPalette) console.log("      [palette missed — the card rim is the fallback door]");
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('${doorAriaStart}')) : null; })()`);
    const opened = await poll(
      `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${wantTitleIncludes}')); return JSON.stringify({ open: !!dlg }); })()`,
      (v) => v.open === true, 8, 500
    );
    if (opened?.open === true) return `open@try${i + 1} (click ${clicked}${viaPalette ? ", palette" : ""})`;
    await closeAllDialogs();
  }
  return "NEVER-OPEN";
};
/** one face, one paper, one set of asserts — the shared print ride */
const paperOf = async (pdfOut) => {
  const rendered = sh(`${AB} pdf ${pdfOut}`);
  if (!existsSync(pdfOut)) return { ok: false, flat: "", rendered };
  const paper = execSync(`pdftotext ${pdfOut} -`, { encoding: "utf8" });
  return { ok: true, flat: paper.replace(/\s+/g, " "), rendered };
};
const sweepTree = (tree, re, label, suffix) => {
  try {
    for (const proj of readdirSync(tree)) {
      const projDir = path.join(tree, proj);
      let dirs = [];
      try { dirs = readdirSync(projDir); } catch { continue; }
      for (const dir of dirs) {
        if (!(dir.endsWith(suffix) && re.test(dir))) continue;
        const p = path.join(projDir, dir);
        try { rmSync(p, { recursive: true, force: true }); console.log(`  rm (${label}) ${path.relative(ROOT, p)}`); }
        catch (e) { console.log(`  ✗ rm (${label}) failed for ${p}: ${e.message}`); fail++; }
      }
    }
  } catch { /* nothing to sweep */ }
};
const mockClusterConn = () => {
  const conns = api("GET", "/api/remote/connections").connections ?? [];
  return conns.find((c) => c.name === "Mock Cluster") ?? null;
};

// ---- guards: the dev server warm, the world armed ------------------------
for (let i = 0; i < 40; i++) {
  try {
    if (execSync(`curl -s -o /dev/null -w "%{http_code}" ${BASE}/ --max-time 5`, { encoding: "utf8" }).includes("200")) break;
  } catch { /* cold — keep waiting */ }
  await sleep(1500);
}
const list0 = jobsApi();
const preCount = list0.length;
const chainNameJob = list0.find((j) => j.name === "t916 class2d witness" && j.status === "completed");
let mintedHere = false;
if (!chainNameJob) {
  console.log("== the t916 chain is not alive — minting it (the mint's own verb) ==");
  const mintOut = sh(`node scripts/t916-class2d-mint.mjs mint`);
  console.log(mintOut.split("\n").filter((l) => l.startsWith("==") || l.startsWith("  manifest")).join("\n"));
  mintedHere = true;
}
if (!existsSync(T916_MANIFEST)) { console.log("FATAL: no t916 manifest after the mint attempt"); process.exit(2); }
const mint = JSON.parse(execSync(`node -e 'console.log(JSON.stringify(require("${T916_MANIFEST}")))'`, { encoding: "utf8" }));
const CHAIN_ID = mint.class2d.id;
const CHAIN_NAME = "t916 class2d witness";
const EXTRACT_ID = mint.extract.id;
const chainOk = jobsApi().some((j) => j.id === CHAIN_ID && j.status === "completed");
ok("guard: the chain's class2d alive and completed", chainOk);
if (!chainOk) { console.log("FATAL: the chain still is not completed"); process.exit(2); }

// the binding's shape is the world's standing law — untouched through the arc
const bindingOf = () => {
  const j = jobsApi().find((x) => x.id === EXTRACT_ID);
  return j?.runRemote?.connectionId ?? null;
};
const binding0 = bindingOf();

// ---- the K=8 variant (the t919/t917 doctrine — the mover world) ----------
// SELF-HEAL (the t945 stale-probe law): a previous ride that died before
// its restore leaves the variant behind — a completed one is ADOPTED as
// this ride's mover world (the litter becomes the seat), never re-minted.
const staleVariant = jobsApi().filter((j) => (j.name ?? "").includes("t917 convergence class2d"));
ok("guard: at most one stale variant in the world", staleVariant.length <= 1, `${staleVariant.length} found`);
if (staleVariant.length > 1) { console.log("FATAL: ambiguous stale variants — remove by hand"); process.exit(2); }
const adoptedVariant = staleVariant.find((j) => j.status === "completed") ?? null;
const conn = mockClusterConn();
ok("guard: Mock Cluster connection present", !!conn?.id, conn?.id?.slice(0, 14) ?? "NONE");
if (!conn?.id) { console.log("FATAL: no Mock Cluster connection"); process.exit(2); }
const CONN_ID = conn.id;
const REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };
let C2D_ID = null;
const C2D_NAME = "t917 convergence class2d";
if (adoptedVariant) {
  C2D_ID = adoptedVariant.id;
  ok("the stale variant ADOPTED (the previous ride's restore, run late — the litter becomes the seat)", true, C2D_ID.slice(-8));
} else {
  const variant = api("POST", "/api/jobs", {
    type: "class2d",
    name: C2D_NAME,
    params: { algorithm: "em", iterations: 2, numClasses: 8 },
  });
  ok("the K=8 variant node created", !!variant.job?.id, variant.job?.id?.slice(-8) ?? "");
  if (!variant.job?.id) process.exit(2);
  C2D_ID = variant.job.id;
  const eV = api("POST", "/api/edges", { fromJobId: EXTRACT_ID, toJobId: C2D_ID });
  ok("edge extract→K=8 variant", !eV.error);
  const rV = api("POST", `/api/jobs/${C2D_ID}/run`, REMOTE_BODY);
  ok("the K=8 variant run accepted (the remote lane)", !rV.error, rV.error ?? rV.job?.status);
  const doneV0 = await pollUntil(C2D_ID);
  ok("the K=8 variant completed", doneV0.status === "completed", `status=${doneV0.status}`);
  if (doneV0.status !== "completed") {
    // the litter dies even on this early exit — the t919 law runs here too
    api("DELETE", `/api/jobs/${C2D_ID}`);
    const suffix0 = C2D_ID.slice(-8);
    sweepTree(path.join(ROOT, "data", "relion"), /^class2d_/, "local", suffix0);
    sweepTree(path.join(ROOT, "services", "mock-cluster", "fs", "projects"), /^class2d_/, "cluster", suffix0);
    if (mintedHere) { try { sh(`node scripts/t916-class2d-mint.mjs remove`); } catch { /* best effort */ } }
    process.exit(2);
  }
}

sh(`${AB} set viewport 1280 900`);
await resetPage(6);
const cardsNow = evalJson(`JSON.stringify({ n: document.querySelectorAll('[data-job]').length })`);
ok("guard: the canvas carries the minted world", (cardsNow?.n ?? 0) >= 6, `${cardsNow?.n} cards`);

// ---- R1 — the convergence paper (on the variant: real movers) ------------
console.log("== R1: the convergence face on real paper (the K=8 variant's mover world) ==");
const convOpen = await openDialogByDoor(C2D_NAME, "Class convergence — read this run", "Class convergence — Occupancy share");
ok("R1 the convergence dialog OPEN (click-until-effect)", String(convOpen).startsWith("open@"), String(convOpen));
const convReady = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Class convergence — Occupancy share')); if (!dlg) return JSON.stringify({ open: false }); return JSON.stringify({ open: true, movers: dlg.textContent.includes('Biggest gains'), census: dlg.textContent.includes('Convergence census'), hook: dlg.matches('[data-family-read-dialog]') || !!dlg.querySelector('[data-family-read-dialog]') }); })()`,
  (v) => v.open === true && v.movers === true && v.census === true, 30, 750
);
ok("R1 the variant's mover world mounted (the census + the movers speak)", convReady?.movers === true && convReady?.census === true);
ok("R1 the open face carries the family hook", convReady?.hook === true);
// R4's screen half: the provenance line is screen-hidden; the X stays
const screenProbe = evalJson(`(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Class convergence — Occupancy share')); if (!dlg) return JSON.stringify({ provDisplay: null, xDisplay: null }); const content = dlg.matches('[data-family-read-dialog]') ? dlg : dlg.querySelector('[data-family-read-dialog]'); if (!content) return JSON.stringify({ provDisplay: null, xDisplay: null }); const prov = content.querySelector('[data-family-read-print-doc]'); const x = content.querySelector(':scope > [data-slot="dialog-close"]'); return JSON.stringify({ provDisplay: prov ? getComputedStyle(prov).display : null, xDisplay: x ? getComputedStyle(x).display : null }); })()`);
ok("R4 the provenance line is SCREEN-HIDDEN (the pickers speak live)", screenProbe?.provDisplay === "none", `display=${screenProbe?.provDisplay}`);
ok("R4 the close X stays on screen (the hide is print-scoped)", screenProbe?.xDisplay != null && screenProbe.xDisplay !== "none", `display=${screenProbe?.xDisplay}`);
const ovScreen = evalJson(overflowProbe);
ok("R4 no horizontal overflow on screen at 1280", ovScreen.overX <= 0, `overX=${ovScreen.overX}`);
const p1 = await paperOf("/tmp/t946-convergence-print.pdf");
ok("R1 the pdf rendered through the print pipeline", p1.ok, String(p1.rendered).slice(0, 60));
if (p1.ok) {
  ok("R1 the provenance line reaches the paper (Run · pair · printed)",
    p1.flat.includes(`Run: ${C2D_NAME}`) && /Round \d+ vs Round \d+/.test(p1.flat) && p1.flat.includes("printed"),
    p1.flat.slice(0, 120));
  ok("R1 the census reaches the paper", p1.flat.includes("Convergence census"));
  ok("R1 the mover lists reach the paper", p1.flat.includes("Biggest gains") && p1.flat.includes("Biggest losses"));
  ok("R1 the round pickers stay home (the provenance line speaks the pair)", !p1.flat.includes("Round A (earlier)"));
  ok("R1 the continue verb stays home (a verb that prints is a verb that lies)",
    !p1.flat.includes("Continue the run") && !p1.flat.includes("Continue with more iterations"));
  ok("R1 + R5 the inspector's masthead prints no byte (the hide outranks the revival)",
    !p1.flat.includes("CryoFlow — job report"), p1.flat.includes("CryoFlow — job report") ? "THE INSPECTOR PRINTED" : "one document, one sheet");
}
await closeAllDialogs();

// ---- R2 — the arc paper (on the chain's class2d) --------------------------
console.log("== R2: the resolution arc face on real paper ==");
const arcOpen = await openDialogByDoor(CHAIN_NAME, "Resolution arc — read this", "Resolution arc —");
ok("R2 the arc dialog OPEN (click-until-effect)", String(arcOpen).startsWith("open@"), String(arcOpen));
const arcReady = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Resolution arc —')); if (!dlg) return JSON.stringify({ open: false }); return JSON.stringify({ open: true, plateau: dlg.textContent.includes('The plateau law'), legend: dlg.textContent.includes('lower is better') }); })()`,
  (v) => v.open === true && v.plateau === true, 30, 750
);
ok("R2 the arc's reading mounted (the plateau law speaks)", arcReady?.plateau === true);
const p2 = await paperOf("/tmp/t946-arc-print.pdf");
ok("R2 the pdf rendered through the print pipeline", p2.ok);
if (p2.ok) {
  ok("R2 the paper signs the run (the title's name byte) and carries the clock",
    p2.flat.includes(CHAIN_NAME) && p2.flat.includes("printed"), p2.flat.slice(0, 120));
  ok("R2 the plateau law reaches the paper", p2.flat.includes("The plateau law"));
  ok("R2 the legend reaches the paper", p2.flat.includes("lower is better"));
  ok("R2 the continue verb stays home",
    !p2.flat.includes("Continue the run") && !p2.flat.includes("Continue with more iterations"));
  ok("R2 + R5 the inspector's masthead prints no byte", !p2.flat.includes("CryoFlow — job report"));
}
await closeAllDialogs();

// ---- R3 — the funnel paper (on the chain's class2d) -----------------------
console.log("== R3: the particle funnel face on real paper ==");
const funOpen = await openDialogByDoor(CHAIN_NAME, "Particle funnel — read where the particles went", "Particle funnel —");
ok("R3 the funnel dialog OPEN (click-until-effect)", String(funOpen).startsWith("open@"), String(funOpen));
const funReady = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Particle funnel —')); if (!dlg) return JSON.stringify({ open: false }); return JSON.stringify({ open: true, rows: dlg.querySelectorAll('[role="img"]').length, footer: dlg.textContent.includes('The funnel reads the receipts') }); })()`,
  (v) => v.open === true && v.rows > 0, 30, 750
);
ok("R3 the funnel's ledger mounted (stage rows speak)", (funReady?.rows ?? 0) > 0, `rows=${funReady?.rows}`);
const p3 = await paperOf("/tmp/t946-funnel-print.pdf");
ok("R3 the pdf rendered through the print pipeline", p3.ok);
if (p3.ok) {
  ok("R3 the paper signs the run and carries the clock",
    p3.flat.includes(`Particle funnel — ${CHAIN_NAME}`) && p3.flat.includes("printed"), p3.flat.slice(0, 120));
  ok("R3 the honest verbless footer reaches the paper", p3.flat.includes("The funnel reads the receipts; it does not mutate."));
  ok("R3 the chain's honesty line reaches the paper (no postprocess ends this chain yet)",
    p3.flat.includes("No postprocess ends this chain yet"));
  ok("R3 the ledger's copy/CSV chrome stays home (the ledger itself prints above)",
    !p3.flat.includes("Copy ledger"), p3.flat.includes("Copy ledger") ? "THE COPY BUTTON PRINTED" : "no button byte");
  ok("R3 + R5 the inspector's masthead prints no byte", !p3.flat.includes("CryoFlow — job report"));
}
await closeAllDialogs();

// ---- R6 — the restore: the variant first, then the chain ------------------
console.log("== R6: the restore (the variant's litter dies, then the chain remove) ==");
const vWorkdir = jobsApi().find((j) => j.id === C2D_ID)?.workdir ?? null;
const delV = api("DELETE", `/api/jobs/${C2D_ID}`);
ok("restore: the K=8 variant deleted (the hard door)", !delV.error);
const vSuffix = C2D_ID.slice(-8);
sweepTree(path.join(ROOT, "data", "relion"), /^class2d_/, "local", vSuffix);
if (vWorkdir && existsSync(vWorkdir)) {
  try { rmSync(vWorkdir, { recursive: true, force: true }); console.log(`  rm (workdir) ${vWorkdir.replace(ROOT + "/", "")}`); }
  catch (e) { console.log(`  ✗ rm (workdir) failed: ${e.message}`); fail++; }
}
sweepTree(path.join(ROOT, "services", "mock-cluster", "fs", "projects"), /^class2d_/, "cluster", vSuffix);
const afterVariant = jobsApi();
ok("restore: no t917 variant residue", afterVariant.every((j) => !(j.name ?? "").includes("t917 convergence class2d")));
let chainRemoveOk = false;
if (mintedHere) {
  try { sh(`node scripts/t916-class2d-mint.mjs remove`); chainRemoveOk = true; }
  catch (e) { console.log(`  ✗ the chain remove refused: ${String(e.message).slice(0, 200)}`); }
} else {
  chainRemoveOk = true; // the chain predates this ride — its restore is its own instruments' business
}
const afterAll = jobsApi();
ok("restore: the chain's litter gone with it",
  mintedHere ? afterAll.every((j) => !(j.name ?? "").includes(CHAIN_NAME)) : true);
ok("restore: the world back to the pre-ride count", afterAll.length === preCount, `${afterAll.length} vs ${preCount}`);
// the registry's standing shape (the world's law): exactly ONE Mock Cluster,
// at its standing id — the chain remove deletes jobs, never connections
const connsEnd = api("GET", "/api/remote/connections").connections ?? [];
ok("restore: the registry's standing shape — ONE Mock Cluster at its standing id",
  connsEnd.filter((c) => c.name === "Mock Cluster").length === 1 && connsEnd.find((c) => c.name === "Mock Cluster")?.id === CONN_ID,
  connsEnd.map((c) => c.id?.slice(0, 12)).join(","));

writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({
  at: new Date().toISOString(), pass, fail,
  chain: { id: CHAIN_ID, mintedHere },
  variant: { id: C2D_ID, K: 8, name: C2D_NAME },
  papers: { convergence: p1.ok, arc: p2.ok, funnel: p3.ok },
  restore: { preCount, afterCount: afterAll.length, binding0 },
}, null, 2));
console.log(`== family-print witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail == (receipt: ${RECEIPT})`);
process.exit(fail === 0 ? 0 : 1);
