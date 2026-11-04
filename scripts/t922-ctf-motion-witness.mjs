#!/usr/bin/env node
/**
 * t922 — the compare dialog's ELDER domains' first live ride: the CTF
 * and Motion A/B faces (t439/t440) have lived in benches since t453's
 * family generalization; the DIALOG has never carried two real
 * motioncorr runs or two real ctffind runs. The t922 mint (movies
 * import + the stubs' new param laws) supplies the variable:
 *
 *   MC-A  "Motion Correction 1"   defaults (bfactor 150, dose 1.28)
 *   MC-B  "Motion Correction 2 (t922)"  bfactor 300, dose 2.0
 *         → Total drift: k even +1.5 Å REGRESSED (mic_001/003/005),
 *           k odd −1.5 Å improved (mic_002/004/006); median Δ 0.00 Å
 *   CTF-A "CTF Estimation 1"      defaults (window 5000..50000, ResMax 5)
 *   CTF-B "CTF Estimation 2 (t922)"  window 8000..30000, ResMax 4
 *         → FOM ±0.002 alternating (k even improves, k odd regresses);
 *           defocus estimates shift inside the narrower window
 *
 *   W   the API band — every expected number is a REPLICA computed on
 *       the routes' own rows (joinByName/pairedDeltas/verdict/median
 *       math), never a memory.
 *   M   the Motion face at 1280: the door speaks its dialect and counts
 *       its sibling; the dialog's verdict chips (3 improved / 3
 *       regressed / 0 unchanged, median Δ 0.00 Å — the symmetric
 *       verdict's own face), the movers named, NO trust line (the
 *       motion domain's count-agreement law), and THE EXCLUDE VERB'S
 *       FIRST FIRE: click-until-WORLD-effect — the excludemg filter is
 *       MINTED (its Exclusions tab holds the 3 regressed names), MC-B
 *       feeds it, MC-A's downstream re-parents onto it, the toast
 *       speaks, the dialog closes, the canvas shows the verdict as
 *       wiring.
 *   C   the CTF face: the trust line (the pairing's own health check,
 *       median |Δ| in µm from the replica), the FOM verdict, and the
 *       LEAF's honest verb — present, disabled, the plan's own reason
 *       ("no downstream jobs to re-wire"). The lens switch to Fit
 *       limit: the param-blind lens's all-unchanged face (the stub
 *       moves fom and defocus, never res — the lens table's honesty).
 *   P   persistence — reload, the filter still wired between MC-B and
 *       CTF-A (the verdict as wiring, not a memory).
 *   N   320 born-at-band: the CTF face survives the narrow door.
 *   R   the restore — the mint's remove (fire re-wire undone, original
 *       edge home, minted jobs gone, workdirs swept, seed trio + 2
 *       edges), then the t894 doctor CLEAN.
 *
 *   node scripts/t922-ctf-motion-witness.mjs main
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t922-ctf-motion-witness.json";

const NAME_MC_A = "Motion Correction 1";
const NAME_MC_B = "Motion Correction 2 (t922)";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CTF_B = "CTF Estimation 2 (t922)";
const NAME_FILTER_HINT = "Exclude";

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
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
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
const settleCensus = async () => {
  let last = null;
  for (let i = 0; i < 24; i++) {
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job]')].map(c => { const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return (c.getAttribute('data-job') ?? '') + ':' + Math.round(r.x) + ',' + Math.round(r.y); }).sort())`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
};
const overflowProbe = `JSON.stringify({ overX: document.documentElement.scrollWidth - document.documentElement.clientWidth })`;
const openInspector = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 12, 600,
  );
  ok(`inspector "${name}" opened`, opened?.open === true);
};
/** doorUntilOpen — the eaten-click law (t919 #2): click the door until
 *  the COMPARE dialog (found by its own title) is up. At 320 the door
 *  sits in a wrapped action cluster — OFF-VIEWPORT probes scroll the
 *  door into view, and the WHOLE inspector gets one reopen-tolerant
 *  retry (t919's band-N law: the cluster re-renders under the live
 *  poll). */
const openCompareUntil = async (inspectorName, doorAriaPrefix, compareTitlePrefix) => {
  for (let i = 0; i < 8; i++) {
    const already = evalJson(`JSON.stringify([...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${compareTitlePrefix}') && (d.textContent || '').includes('Run A')))`);
    if (already === true) return `open@try${i}`;
    const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${inspectorName}'))?.querySelector('[aria-label^="${doorAriaPrefix}"]')`);
    if (!String(clicked).startsWith("clicked@")) {
      // scroll the door into view and, past try 3, reopen the inspector
      evalJs(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${inspectorName}')); const b = d?.querySelector('[aria-label^="${doorAriaPrefix}"]'); if (b) { b.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; } return 'no-door'; })()`);
      if (i === 3) { sh(`${AB} press Escape`); await sleep(700); await openInspector(inspectorName); }
      await sleep(500);
      continue;
    }
    const opened = await poll(`(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; return JSON.stringify(ds.some(d => (d.textContent || '').includes('${compareTitlePrefix}') && (d.textContent || '').includes('Run A'))) })()`, (v) => v === true, 6, 450);
    if (opened === true) return `open@try${i + 1}`;
  }
  return "NEVER-OPEN";
};
const shApi = (url) => sh(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`);
const apiJson = (url) => JSON.parse(shApi(url));
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}

/* ------------------------------------------------------------------ */
/* the replica math — the SAME laws the dialog eats, run on the ROUTES' */
/* own rows (t919's band-A law: the instrument measures, never remembers)*/
/* ------------------------------------------------------------------ */
const byBase = (rows) => {
  const m = new Map();
  for (const r of rows) m.set(String(r.name).split("/").pop(), r);
  return m;
};
const median = (values) => {
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const fmtDelta = (value, digits) => {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
};

console.log("== band W: the API replica — the verdicts the dialog will eat ==");
const jobsW = apiJson("/api/jobs").jobs ?? [];
const mcA = jobsW.find((j) => j.name === NAME_MC_A);
const mcB = jobsW.find((j) => j.name === NAME_MC_B);
const ctfA = jobsW.find((j) => j.name === NAME_CTF_A);
const ctfB = jobsW.find((j) => j.name === NAME_CTF_B);
ok("W the four runs aboard", !!(mcA && mcB && ctfA && ctfB));
ok("W all four completed", [mcA, mcB, ctfA, ctfB].every((j) => j?.status === "completed"),
  [mcA, mcB, ctfA, ctfB].map((j) => j?.status).join("/"));

const motRows = (id) => byBase(apiJson(`/api/jobs/${id}/motion`).micrographs ?? []);
const ma = motRows(mcA.id), mb = motRows(mcB.id);
const motPairs = [...ma.keys()].filter((n) => mb.has(n)).sort();
ok("W motion join pairs 6", motPairs.length === 6, motPairs.join(","));
const motDeltas = motPairs.map((n) => ({ name: n, delta: mb.get(n).total - ma.get(n).total, a: ma.get(n).total, b: mb.get(n).total }));
const motImproved = motDeltas.filter((d) => d.delta < 0);
const motRegressed = motDeltas.filter((d) => d.delta > 0);
const motTied = motDeltas.filter((d) => d.delta === 0);
ok("W motion verdict 3 improved / 3 regressed / 0 tied", motImproved.length === 3 && motRegressed.length === 3 && motTied.length === 0,
  `${motImproved.map((d) => d.name).join(",")} vs ${motRegressed.map((d) => d.name).join(",")}`);
const motMedian = median(motDeltas.map((d) => d.delta));
ok("W motion median Δ ±0.00 (the symmetric verdict)", Math.abs(motMedian) < 1e-9, fmtDelta(motMedian, 2));
const MOT_MEDIAN_TEXT = `median Δ ${fmtDelta(motMedian, 2)} Å`;
const REGRESSED_NAMES = motRegressed.map((d) => d.name).sort();
ok("W the regressed names are mic_002/004/006 (k odd carries +1.5)", JSON.stringify(REGRESSED_NAMES) === JSON.stringify(["mic_002.mrc", "mic_004.mrc", "mic_006.mrc"]), REGRESSED_NAMES.join(","));
ok("W the improved names are mic_001/003/005", JSON.stringify(motImproved.map((d) => d.name).sort()) === JSON.stringify(["mic_001.mrc", "mic_003.mrc", "mic_005.mrc"]), motImproved.map((d) => d.name).join(","));

const ctfRows = (id) => byBase(apiJson(`/api/jobs/${id}/ctf`).micrographs ?? []);
const ca = ctfRows(ctfA.id), cb = ctfRows(ctfB.id);
const ctfPairs = [...ca.keys()].filter((n) => cb.has(n)).sort();
ok("W ctf join pairs 6", ctfPairs.length === 6, ctfPairs.join(","));
const ctfFomDeltas = ctfPairs.map((n) => ({ name: n, delta: cb.get(n).fom - ca.get(n).fom }));
const ctfImproved = ctfFomDeltas.filter((d) => d.delta > 0);
const ctfRegressed = ctfFomDeltas.filter((d) => d.delta < 0);
ok("W ctf FOM verdict 3 improved / 3 regressed", ctfImproved.length === 3 && ctfRegressed.length === 3, `${ctfImproved.map((d) => d.name).join(",")} vs ${ctfRegressed.map((d) => d.name).join(",")}`);
const ctfFomMedian = median(ctfFomDeltas.map((d) => d.delta));
ok("W ctf FOM median Δ 0.000 (symmetric)", Math.abs(ctfFomMedian) < 1e-9, fmtDelta(ctfFomMedian, 3));
const defocusDeltas = ctfPairs.map((n) => Math.abs((ca.get(n).defocusU + ca.get(n).defocusV) / 2 - (cb.get(n).defocusU + cb.get(n).defocusV) / 2));
const trustMedian = median(defocusDeltas);
ok("W the trust line's median |Δ| computed", Number.isFinite(trustMedian) && trustMedian > 0, `${trustMedian.toFixed(3)} µm`);
const TRUST_TEXT = `Defocus agreement: median |Δ| = ${trustMedian.toFixed(3)} µm across ${ctfPairs.length} paired micrographs — the pairing's own health check.`;
ok("W the trust line's exact words derived", TRUST_TEXT.includes("µm across 6 paired micrographs"), TRUST_TEXT);

const jobsAtStart = jobsW.length;

/* =========================== band M ====================================== */
console.log("== band M: the Motion face — the door, the symmetric verdict, THE FIRE ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobsAtStart - 2, 30);
await settleCensus();
await openInspector(NAME_MC_A);

const doorM = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_MC_A}')); const b = d?.querySelector('[aria-label^="Motion A/B — compare with another completed run"]'); return JSON.stringify({ present: !!b, aria: b?.getAttribute('aria-label') ?? null, title: b?.getAttribute('title') ?? null }); })()`,
  (v) => v.present === true, 24, 750,
);
ok("M the Motion A/B door present", doorM?.present === true);
ok("M the door's aria counts its sibling", doorM?.aria === "Motion A/B — compare with another completed run (1 sibling runs available)", doorM?.aria ?? "none");
ok("M the door's title speaks the micrograph dialect", doorM?.title === "Motion A/B — paired per-micrograph verdict between two completed runs: did the output actually move?", doorM?.title ?? "none");

const openM = await openCompareUntil(NAME_MC_A, "Motion A/B — compare", "Motion A/B — Total drift");
ok("M the compare dialog opened (click-until-open)", String(openM).startsWith("open@"), openM);

const faceM = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('Motion A/B — Total drift') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const chips = [...d.querySelectorAll('span')].map(s => s.textContent?.trim() ?? ''); return JSON.stringify({ title: d.querySelector('[data-slot="dialog-title"]')?.textContent?.trim() ?? null, desc: d.querySelector('[data-slot="dialog-description"]')?.textContent?.trim() ?? null, chips, region: !!d.querySelector('[role="region"][aria-label="Run comparison reading — the A/B verdict and its adoption verbs"]') }); })()`,
  (v) => v.title, 12, 600,
);
ok("M the dialog's title speaks lens + domain", faceM?.title === "Motion A/B — Total drift", faceM?.title ?? "none");
ok("M the intro is the micrograph dialect verbatim", faceM?.desc === "Paired per-micrograph verdict between two completed runs — did the output actually move, and which micrographs moved it?", faceM?.desc ?? "none");
ok("M the reading region carries its name (t804's seat)", faceM?.region === true);
const chipsM = faceM?.chips ?? [];
ok("M verdict chip 3 improved", chipsM.includes("3 improved"), chipsM.filter((c) => c.includes("improved")).join("|"));
ok("M verdict chip 3 regressed", chipsM.includes("3 regressed"), chipsM.filter((c) => c.includes("regressed")).join("|"));
ok("M verdict chip 0 unchanged", chipsM.includes("0 unchanged"), chipsM.filter((c) => c.includes("unchanged")).join("|"));
ok("M median Δ from the replica's own rendering (the −0.00 epsilon is the floats' truth)", chipsM.includes(MOT_MEDIAN_TEXT), `${chipsM.filter((c) => c.startsWith("median")).join("|")} vs ${MOT_MEDIAN_TEXT}`);
ok("M of 6 paired, NO unpaired chip (every row votes)", chipsM.includes("of 6 paired") && !chipsM.some((c) => c.startsWith("unpaired")), chipsM.filter((c) => c.includes("paired")).join("|"));

const moversM = evalJson(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('Motion A/B — Total drift') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const lists = [...d.querySelectorAll('div')].filter(x => { const t = x.textContent || ''; return (t.includes('Biggest improvements (Total drift)') || t.includes('Biggest regressions (Total drift)')) && x.children.length <= 3; }); const imp = d.textContent || ''; return JSON.stringify({ hasImpTitle: imp.includes('Biggest improvements (Total drift)'), hasRegTitle: imp.includes('Biggest regressions (Total drift)'), micNames: ['mic_001.mrc','mic_002.mrc','mic_003.mrc','mic_004.mrc','mic_005.mrc','mic_006.mrc'].filter(n => imp.includes(n)) }); })()`,
);
ok("M the movers' titles speak the domain's nouns", moversM?.hasImpTitle === true && moversM?.hasRegTitle === true);
ok("M the movers are NAMED (a verdict you can act on)", (moversM?.micNames ?? []).length >= 6, (moversM?.micNames ?? []).join(","));

ok("M NO trust line — motion's count-agreement law", evalJson(`JSON.stringify((() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('Motion A/B — Total drift')); return !(d?.textContent || '').includes('Defocus agreement'); })())`) === true);

const verbM = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('Motion A/B — Total drift') && (x.textContent || '').includes('Run A')); const b = d?.querySelector('[data-testid="adopt-with-exclude"]'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null, label: b?.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null, aria: b?.getAttribute('aria-label') ?? null, title: b?.getAttribute('title') ?? null }); })()`,
  (v) => v.present === true, 8, 500,
);
ok("M the exclude verb present (3 regressed — the no-op law hides it at 0)", verbM?.present === true);
ok("M the verb ENABLED (MC-A has a downstream to re-wire)", verbM?.disabled === false, String(verbM?.disabled));
ok("M the verb's label speaks the count (flex gap renders the space)", /Continue downstream, excluding these\s*\(3\)/.test(verbM?.label ?? ""), verbM?.label ?? "none");
ok("M the verb's aria speaks the whole plan verbatim",
  verbM?.aria === `Continue downstream from ${NAME_MC_B} with 3 regressed micrographs excluded — mints an Exclude Micrographs filter and re-wires 1 of ${NAME_MC_A}'s downstream jobs onto it`,
  verbM?.aria ?? "none");
ok("M the verb's title bakes the filter's contract",
  verbM?.title === `Bakes the 3 regressed micrographs into an Exclude Micrographs filter consuming ${NAME_MC_B} (editable in the filter's Exclusions tab), then re-wires ${NAME_MC_A}'s 1 downstream wire onto the filter — results stay until re-run`,
  (verbM?.title ?? "none").slice(0, 120));

console.log("== band M fire: THE EXCLUDE VERB'S FIRST FIRE (click-until-WORLD-effect) ==");
const edgesBefore = apiJson("/api/edges").edges ?? [];
const seedCtfEdgeBefore = edgesBefore.find((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id);
ok("M pre-fire: MC-A→CTF-A edge in place", !!seedCtfEdgeBefore);

let toastSeen = null;
const firePoll = poll(
  `(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? t.textContent?.slice(0, 120), all: t.textContent?.slice(0, 300) })); const hit = toasts.find(t => (t.all || '').includes('Downstream adopted by')); return JSON.stringify(hit ? { title: hit.all.slice(0, 260) } : {}); })()`,
  (v) => v && v.title, 40, 500,
);
const fired = await (async () => {
  for (let i = 0; i < 10; i++) {
    const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('Motion A/B — Total drift') && (d.textContent || '').includes('Run A'))?.querySelector('[data-testid="adopt-with-exclude"]')`);
    if (!String(clicked).startsWith("clicked@")) { await sleep(600); continue; }
    // the toast watcher rides CONCURRENTLY with the world poll
    firePoll;
    for (let w = 0; w < 24; w++) {
      const world = (() => { try { const js = apiJson("/api/jobs").jobs ?? []; const f = js.find((j) => j.type === "excludemg"); return f ? { filter: f } : null; } catch { return null; } })();
      if (world?.filter) return { filter: world.filter, try: i + 1 };
      await sleep(500);
    }
  }
  return null;
})();
ok("M THE FIRE: the excludemg filter minted (click-until-world-effect)", !!fired?.filter, fired ? `try${fired.try} · ${fired.filter.id.slice(0, 8)}` : "never");
const toastV = await firePoll;
toastSeen = toastV?.title ?? null;
if (!toastSeen) {
  // second chance — the toast lives ~4s; the world poll may have outlived it
  const again = evalJson(`(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => t.textContent?.slice(0, 300) ?? ''); const hit = toasts.find(t => t.includes('Downstream adopted by')); return JSON.stringify(hit ?? null); })()`);
  toastSeen = typeof again === "string" && again !== "null" ? again : null;
}
ok("M the toast speaks the adoption (Downstream adopted by <filter>)", !!toastSeen && toastSeen.includes("Downstream adopted by"), (toastSeen ?? "none").slice(0, 160));

await sleep(1200);
const filterJob = (apiJson("/api/jobs").jobs ?? []).find((j) => j.type === "excludemg");
ok("M the filter's params hold the regressed names (baked at birth)",
  String(filterJob?.params?.excludeNames ?? "") === "mic_002.mrc, mic_004.mrc, mic_006.mrc",
  String(filterJob?.params?.excludeNames ?? "none"));
const edgesAfter = apiJson("/api/edges").edges ?? [];
const feedEdge = edgesAfter.find((e) => e.fromJobId === mcB.id && e.toJobId === filterJob?.id);
const rewireEdge = edgesAfter.find((e) => e.fromJobId === filterJob?.id && e.toJobId === ctfA.id);
const seedGone = !edgesAfter.some((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id);
ok("M the graph: MC-B feeds the filter", !!feedEdge, feedEdge?.id ?? "missing");
ok("M the graph: the filter feeds CTF-A (A's downstream re-parented)", !!rewireEdge, rewireEdge?.id ?? "missing");
ok("M the graph: the old MC-A→CTF-A wire is GONE (adoption moved it, never duplicated)", seedGone === true);

const dlgClosed = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; return JSON.stringify({ compare: ds.some(d => (d.textContent || '').includes('Motion A/B — Total drift') && (d.textContent || '').includes('Run A')) }); })()`,
  (v) => v.compare === false, 8, 500,
);
ok("M the dialog closed itself (the verb is done — the canvas shows the wiring)", dlgClosed?.compare === false);
const canvasFilter = await poll(
  `JSON.stringify({ card: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('${NAME_FILTER_HINT}')) })`,
  (v) => v.card === true, 8, 500,
);
ok("M the canvas holds the filter's card", canvasFilter?.card === true);

/* =========================== band C ====================================== */
console.log("== band C: the CTF face — the trust line, the leaf's honest verb ==");
sh(`${AB} press Escape`); await sleep(500);
sh(`${AB} press Escape`); await sleep(500);
const stackClear = evalJson(`JSON.stringify({ dialogs: document.querySelectorAll('[role="dialog"]').length })`);
if ((stackClear?.dialogs ?? 0) > 0) { sh(`${AB} press Escape`); await sleep(600); }
await settleCensus();
await openInspector(NAME_CTF_A);

const doorC = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CTF_A}')); const b = d?.querySelector('[aria-label^="CTF A/B — compare with another completed run"]'); return JSON.stringify({ present: !!b, aria: b?.getAttribute('aria-label') ?? null }); })()`,
  (v) => v.present === true, 24, 750,
);
ok("C the CTF A/B door present (the elder domain armed)", doorC?.present === true);
ok("C the door's aria counts its sibling", doorC?.aria === "CTF A/B — compare with another completed run (1 sibling runs available)", doorC?.aria ?? "none");

const openC = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("C the compare dialog opened on the FOM lens (the domain's default)", String(openC).startsWith("open@"), openC);

const faceC = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — FOM') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const chips = [...d.querySelectorAll('span')].map(s => s.textContent?.trim() ?? ''); const trust = [...d.querySelectorAll('div')].map(x => x.textContent?.trim() ?? '').find(t => t.startsWith('Defocus agreement')); return JSON.stringify({ chips, trust, verb: (() => { const b = d.querySelector('[data-testid="adopt-with-exclude"]'); return b ? { disabled: b.disabled, aria: b.getAttribute('aria-label'), title: b.getAttribute('title') } : null; })() }); })()`,
  (v) => v.chips?.length > 0, 12, 600,
);
const chipsC = faceC?.chips ?? [];
ok("C verdict chip 3 improved (FOM)", chipsC.includes("3 improved"), chipsC.filter((c) => c.includes("improved")).join("|"));
ok("C verdict chip 3 regressed", chipsC.includes("3 regressed"));
ok("C median Δ 0.000 (the symmetric FOM verdict)", chipsC.includes("median Δ 0.000"), chipsC.filter((c) => c.startsWith("median")).join("|"));
ok("C THE TRUST LINE verbatim (the pairing's own health check)", faceC?.trust === TRUST_TEXT, (faceC?.trust ?? "none").slice(0, 140));
ok("C the leaf's verb present (3 regressed)", !!faceC?.verb);
ok("C the leaf's verb DISABLED (CTF-A has no downstream — the plan's own reason)", faceC?.verb?.disabled === true, String(faceC?.verb?.disabled));
ok("C the leaf's aria carries the honest refusal",
  faceC?.verb?.aria === `Continue downstream with these micrographs excluded — unavailable: ${NAME_CTF_A} has no downstream jobs to re-wire`,
  faceC?.verb?.aria ?? "none");

console.log("== band C lens: the Fit limit switch — the param-blind lens's honest null ==");
const fitClicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('CTF A/B — FOM') && (d.textContent || '').includes('Run A'))?.querySelector('[role="tab"][aria-selected="false"]')`);
ok("C the Fit limit chip clicked (first non-active tab)", String(fitClicked).startsWith("clicked@"), String(fitClicked));
const faceC2 = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — Fit limit') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const chips = [...d.querySelectorAll('span')].map(s => s.textContent?.trim() ?? ''); return JSON.stringify({ title: d.querySelector('[data-slot="dialog-title"]')?.textContent?.trim() ?? null, chips }); })()`,
  (v) => v.title, 12, 600,
);
ok("C the dialog's title FOLLOWS the lens", faceC2?.title === "CTF A/B — Fit limit", faceC2?.title ?? "none");
const chipsC2 = faceC2?.chips ?? [];
ok("C the param-blind lens's all-unchanged face (6 unchanged, median Δ 0.00 Å)",
  chipsC2.includes("6 unchanged") && chipsC2.includes("median Δ 0.00 Å"),
  chipsC2.filter((c) => c.includes("unchanged") || c.startsWith("median")).join("|"));

/* =========================== band P ====================================== */
console.log("== band P: persistence — the verdict as WIRING survives reload ==");
sh(`${AB} press Escape`); await sleep(400);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobsAtStart - 1, 30);
await settleCensus();
const edgesP = apiJson("/api/edges").edges ?? [];
const filterP = (apiJson("/api/jobs").jobs ?? []).find((j) => j.type === "excludemg");
ok("P the filter survives the reload", !!filterP, filterP?.id.slice(0, 8) ?? "gone");
ok("P MC-B→filter still wired", edgesP.some((e) => e.fromJobId === mcB.id && e.toJobId === filterP?.id));
ok("P filter→CTF-A still wired (A's downstream still consumes the verdict)", edgesP.some((e) => e.fromJobId === filterP?.id && e.toJobId === ctfA.id));
ok("P no MC-A→CTF-A resurrect (the graph keeps the adoption)", !edgesP.some((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id));
const canvasP = evalJson(`JSON.stringify({ filterCard: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('${NAME_FILTER_HINT}')) })`);
ok("P the canvas draws the filter's card after reload", canvasP?.filterCard === true);

/* =========================== band N ====================================== */
console.log("== band N: 320 born-at-band — the CTF face at the narrow door ==");
sh(`${AB} set viewport 320 800`);
await settleCensus();
await openInspector(NAME_CTF_A);
const doorN = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CTF_A}')); return JSON.stringify({ present: !!d?.querySelector('[aria-label^="CTF A/B — compare with another completed run"]') }); })()`,
  (v) => v.present === true, 12, 600,
);
ok("N the door present at 320", doorN?.present === true);
const openN = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("N the dialog opened at 320 (click-until-open)", String(openN).startsWith("open@"), openN);
const narrowN = evalJson(`(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — FOM')); const r = d?.getBoundingClientRect(); return JSON.stringify({ fits: r ? (r.width <= 322) : false, trust: (d?.textContent || '').includes('Defocus agreement'), overX: document.documentElement.scrollWidth - document.documentElement.clientWidth }); })()`);
ok("N the dialog fits the narrow door", narrowN?.fits === true, `w=${narrowN?.fits}`);
ok("N the trust line renders at 320", narrowN?.trust === true);
ok("N no horizontal overflow", (narrowN?.overX ?? 1) <= 0, `overX=${narrowN?.overX}`);

/* =========================== band R ====================================== */
console.log("== band R: the restore — the mint's remove + the doctor ==");
sh(`${AB} set viewport 1280 900`);
try { sh(`${AB} close`); } catch {}
let removeOut = "";
try { removeOut = sh(`node scripts/t922-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
console.log(removeOut.split("\n").slice(-8).join("\n"));
ok("R the mint's remove GREEN", /REMOVE \d+ pass \/ 0 fail/.test(removeOut), (removeOut.match(/REMOVE .*/) ?? ["?"])[0]);
ok("R the world back to the seed trio (3 jobs)", (apiJson("/api/jobs").jobs ?? []).length === 3);
const edgesR = apiJson("/api/edges").edges ?? [];
ok("R the world back to 2 edges", edgesR.length === 2, edgesR.map((e) => `${e.fromJobId.slice(0, 6)}→${e.toJobId.slice(0, 6)}`).join(" · "));
ok("R the seed's MC-A→CTF-A edge home (original id)", edgesR.some((e) => e.fromJobId === mcA.id && e.toJobId === ctfA.id));
ok("R the fire's filter gone", (apiJson("/api/jobs").jobs ?? []).every((j) => j.type !== "excludemg"));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("R the doctor CLEAN after the restore", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({
  main: {
    pass, fail,
    motion: { improved: motImproved.map((d) => d.name), regressed: REGRESSED_NAMES, median: fmtDelta(motMedian, 2) },
    ctf: { fomImproved: ctfImproved.map((d) => d.name), trustMedian: trustMedian.toFixed(3), trust: TRUST_TEXT },
    fire: { filter: filterJob ? { id: filterJob.id, name: filterJob.name, excludeNames: filterJob.params?.excludeNames } : null, toast: toastSeen },
    at: new Date().toISOString(),
  },
});
console.log(`== t922 witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
