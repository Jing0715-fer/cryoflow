#!/usr/bin/env node
/**
 * t926 — the plain adopt verb's FIRST FIRE from the CTF face (the elder
 * face's OTHER door: t925 burned the exclude rider and pinned this
 * door's enabled aria verbatim; this window the fire itself rides).
 *
 * The plain adopt ("Continue downstream from run B") is adoptDownstream
 * (A→B) at its rawest: POST the new edges (B→child) first, DELETE the
 * old — ports preserved, NOTHING minted, the dialog closes itself, the
 * toast speaks the adoption contract. Where the t925 fire changed the
 * SCIENCE (the filter's attrition: catalogued 6 → 3), the plain adopt
 * changes only the FATHER: the autopick re-parents onto CTF-B directly
 * and /picks answers catalogued 6 again — the same count, a different
 * father, proven at the data plane by the re-run's RECORDED argv (the
 * outputs API's cmd — the spawn's own receipt, `ctffind_<id-suffix>`
 * workdirFor law) naming CTF-B's star instead of CTF-A's.
 *
 *   prep  the t922 mint re-rides, the autopick consumer mints (fed by
 *         CTF-A, remote lane), the BEFORE face: catalogued 6 AND the
 *         recorded cmd's --i names CTF-A's workdir.
 *   W     the replica — the CTF face's numbers from the ROUTES' own rows,
 *         in the ROUTES' own order (the t925 law: defocusU descending).
 *   A     the plain adopt's face: the adoption contract line above the
 *         verbs verbatim, the verb ENABLED with its (1) badge, aria and
 *         title verbatim — beside the exclude rider (also ENABLED: the
 *         two-door face, witnessed together for the first time).
 *   F     THE FIRE: click-until-world-effect — CTF-B→autopick posted,
 *         CTF-A→autopick GONE, NO excludemg minted (the plain adopt
 *         mints nothing), the toast's full contract verbatim, the
 *         dialog closes itself, the canvas shows the re-wiring.
 *   C2    the loop closes: reopening the CTF face, BOTH verbs disabled
 *         again (the moved wire's honest leaves).
 *   D     the data plane: the autopick re-runs (remote lane) and its
 *         recorded cmd's --i names CTF-B's workdir — the father flipped;
 *         /picks answers catalogued 6 — NO attrition (the provider
 *         changed, the science did not).
 *   P2    persistence — reload, the re-wiring survives.
 *   N     320 born-at-band — the CTF face at the narrow door.
 *   R     the restore — the re-wire off, the consumer deleted, the t922
 *         remove GREEN, the seed trio + 2 edges, the doctor CLEAN.
 *
 *   node scripts/t926-ctf-plain-adopt-witness.mjs main
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t926-ctf-plain-adopt-witness.json";

const NAME_CTF_A = "CTF Estimation 1";
const NAME_CTF_B = "CTF Estimation 2 (t922)";
const NAME_AP = "Automated Picking 1 (t926)";

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
const openInspector = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 12, 600,
  );
  ok(`inspector "${name}" opened`, opened?.open === true);
};
const openCompareUntil = async (inspectorName, doorAriaPrefix, compareTitlePrefix) => {
  for (let i = 0; i < 8; i++) {
    const already = evalJson(`JSON.stringify([...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${compareTitlePrefix}') && (d.textContent || '').includes('Run A')))`);
    if (already === true) return `open@try${i}`;
    const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${inspectorName}'))?.querySelector('[aria-label^="${doorAriaPrefix}"]')`);
    if (!String(clicked).startsWith("clicked@")) {
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
const api = (method, url, body) => {
  const cmd = `curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  const out = sh(cmd);
  try { return JSON.parse(out); } catch { return { error: out.slice(0, 200) }; }
};
const jobs = () => apiJson("/api/jobs").jobs ?? [];
const edges = () => apiJson("/api/edges").edges ?? [];
const findName = (n) => jobs().find((j) => j.name === n);
const pollUntil = async (id, want = "completed", timeoutMs = 300_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobs().find((x) => x.id === id);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
};
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}
function mockClusterConn() {
  const conns = apiJson("/api/remote/connections").connections ?? [];
  let conn = conns.find((c) => c.name === "Mock Cluster");
  if (conn) return conn;
  const mk = api("POST", "/api/remote/connections", {
    name: "Mock Cluster", host: "127.0.0.1", port: 3022, username: "cryo",
    password: "demo", authMethod: "password", remoteRoot: "/projects/cryoflow",
    useSlurm: true, defaultModule: "relion/5.0.1",
  });
  return mk.connection ?? mk.job ?? null;
}
let REMOTE_BODY = null;
const runJob = (id) => api("POST", `/api/jobs/${id}/run`, REMOTE_BODY);

/* the replica (the routes' own rows, the routes' own order — t925's law) */
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

/* ================================================================== */
console.log("== band P: prep — the mint re-rides, the consumer mints, the BEFORE father ==");
const mintOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs mint 2>&1`);
console.log(mintOut.split("\n").slice(-3).join("\n"));
ok("P the t922 mint re-rides GREEN", /MINT \d+ pass \/ 0 fail/.test(mintOut), (mintOut.match(/MINT .*/) ?? ["?"])[0]);

const conn = mockClusterConn();
ok("P mock cluster resolved by name", !!conn?.id, conn?.id ?? "missing");
REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };

const ctfA = findName(NAME_CTF_A);
const ctfB = findName(NAME_CTF_B);
ok("P the elder pair aboard and completed", !!ctfA && !!ctfB && ctfA.status === "completed" && ctfB.status === "completed", `${ctfA?.status}/${ctfB?.status}`);
const A_DIR = `ctffind_${ctfA.id.slice(-8)}`;
const B_DIR = `ctffind_${ctfB.id.slice(-8)}`;

let ap = findName(NAME_AP);
if (!ap) {
  const mk = api("POST", "/api/jobs", {
    type: "autopick", name: NAME_AP,
    params: { pickingMethod: "Laplacian of Gaussian", logDiamMin: 150, logDiamMax: 180 },
  });
  ok("P the downstream consumer minted", !mk.error && !!mk.job?.id, mk.error ?? mk.job?.id);
  ap = mk.job;
} else {
  ok("P the downstream consumer already aboard (idempotent re-ride)", true, ap.id);
}
const apEdge = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id) ??
  api("POST", "/api/edges", { fromJobId: ctfA.id, toJobId: ap.id }).edge;
ok("P the wire CTF-A→autopick", !!apEdge, apEdge?.id ?? "missing");
if (ap.status !== "completed") {
  const r = runJob(ap.id);
  ok("P the autopick run accepted (remote lane)", !r.error, r.error ?? r.job?.status ?? "");
}
const apDone = await pollUntil(ap.id);
ok("P the autopick completed", apDone.status === "completed", apDone.status);

const outsBefore = apiJson(`/api/jobs/${ap.id}/outputs`);
ok("P BEFORE: the recorded cmd's --i names CTF-A's workdir (the father, spawn's own receipt)",
  String(outsBefore.cmd ?? "").includes(`--i`) && String(outsBefore.cmd ?? "").includes(A_DIR) && !String(outsBefore.cmd ?? "").includes(B_DIR),
  (String(outsBefore.cmd ?? "").match(/--i \S+/) ?? ["none"])[0].slice(0, 110));
const picksBefore = apiJson(`/api/jobs/${ap.id}/picks`);
ok("P BEFORE: /picks catalogued 6", picksBefore.catalogued === 6, String(picksBefore.catalogued));

/* ================================================================== */
console.log("== band W: the replica — the routes' own rows, the routes' own order ==");
const ctfRows = (id) => byBase(apiJson(`/api/jobs/${id}/ctf`).micrographs ?? []);
const ra = ctfRows(ctfA.id), rb = ctfRows(ctfB.id);
const pairsRoute = [...ra.keys()].filter((n) => rb.has(n));
ok("W the join pairs 6", pairsRoute.length === 6, String(pairsRoute.length));
const deltas = pairsRoute.map((n) => ({ name: n, delta: rb.get(n).fom - ra.get(n).fom }));
const improved = deltas.filter((d) => d.delta > 0);
const regressed = deltas.filter((d) => d.delta < 0);
ok("W the FOM verdict 3 improved / 3 regressed", improved.length === 3 && regressed.length === 3,
  `${improved.map((d) => d.name).join(",")} vs ${regressed.map((d) => d.name).join(",")}`);
const fomMedian = median(deltas.map((d) => d.delta));
ok("W the FOM median Δ 0.000 (the symmetric verdict)", Math.abs(fomMedian) < 1e-9, fomMedian.toFixed(3));
const defocusDeltas = pairsRoute.map((n) => Math.abs((ra.get(n).defocusU + ra.get(n).defocusV) / 2 - (rb.get(n).defocusU + rb.get(n).defocusV) / 2));
const trustMedian = median(defocusDeltas);
const TRUST_TEXT = `Defocus agreement: median |Δ| = ${trustMedian.toFixed(3)} µm across ${pairsRoute.length} paired micrographs — the pairing's own health check.`;
ok("W the trust line's words derived", Number.isFinite(trustMedian) && trustMedian > 0, `${trustMedian.toFixed(3)} µm`);

/* ================================================================== */
console.log("== band A: the plain adopt's face — the two-door cluster, together ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 5, 30);
await settleCensus();
await openInspector(NAME_CTF_A);
const openA = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("A the compare dialog opened on the FOM lens", String(openA).startsWith("open@"), openA);

const faceA = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — FOM') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const spans = [...d.querySelectorAll('span')].map(s => s.textContent?.trim() ?? ''); const contractDivs = [...d.querySelectorAll('div')].filter(x => (x.textContent || '').trim().startsWith('Adoption re-wires'));
  const contract = (contractDivs.find(x => x.children.length === 0) ?? contractDivs.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0])?.textContent?.trim() ?? null;
  const plain = d.querySelector('[data-testid="adopt-downstream"]'); const ex = d.querySelector('[data-testid="adopt-with-exclude"]'); const trust = [...d.querySelectorAll('div')].map(x => x.textContent?.trim() ?? '').find(t => t.startsWith('Defocus agreement')); return JSON.stringify({ spans, contract, trust, plain: plain ? { disabled: plain.disabled, label: plain.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null, aria: plain.getAttribute('aria-label'), title: plain.getAttribute('title'), badge: plain.querySelector('span.font-semibold')?.textContent ?? null } : null, exclude: ex ? { disabled: ex.disabled, aria: ex.getAttribute('aria-label') } : null }); })()`,
  (v) => v.spans?.length > 0, 12, 600,
);
ok("A the verdict's chips speak 3/3 + the symmetric median", faceA?.spans?.includes("3 improved") === true && faceA?.spans?.includes("3 regressed") === true && faceA?.spans?.includes("median Δ 0.000") === true, faceA?.spans?.filter((c) => c.includes("improved") || c.includes("regressed") || c.startsWith("median")).join("|"));
ok("A THE TRUST LINE verbatim (the replica's own words)", faceA?.trust === TRUST_TEXT, (faceA?.trust ?? "none").slice(0, 140));
ok("A the adoption contract line above the verbs verbatim",
  faceA?.contract === `Adoption re-wires ${NAME_CTF_A}'s 1 downstream job to consume ${NAME_CTF_B} — their current results stay until re-run.`,
  faceA?.contract ?? "none");
ok("A the plain adopt verb present and ENABLED", faceA?.plain?.disabled === false, String(faceA?.plain?.disabled));
ok("A the verb's label speaks the run-B dialect + the (1) badge",
  /Continue downstream from run B\s*\(1\)/.test(faceA?.plain?.label ?? ""), faceA?.plain?.label ?? "none");
ok("A the verb's aria verbatim (the t925 pin, now spoken enabled)",
  faceA?.plain?.aria === `Continue downstream from ${NAME_CTF_B} — re-wires 1 of ${NAME_CTF_A}'s downstream jobs`,
  faceA?.plain?.aria ?? "none");
ok("A the verb's title carries the plan's own words",
  faceA?.plain?.title === `Re-wires ${NAME_CTF_A}'s 1 downstream wire to ${NAME_CTF_B} — their current results stay until re-run`,
  faceA?.plain?.title ?? "none");
ok("A the exclude rider ENABLED beside it (the two-door face together)", faceA?.exclude?.disabled === false, String(faceA?.exclude?.disabled));

/* ================================================================== */
console.log("== band F: THE FIRE — the plain adopt re-parents, NOTHING minted ==");
const jobsAtFire = jobs().length;
const edgesBefore = edges();
ok("F pre-fire: CTF-A→autopick in place, no CTF-B→autopick",
  edgesBefore.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id) && !edgesBefore.some((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id));

let toastSeen = null;
const firePoll = poll(
  `(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? null, all: t.textContent?.slice(0, 400) ?? '' })); const hit = toasts.find(t => (t.all || '').includes('Downstream adopted by')); return JSON.stringify(hit ? { title: hit.title, all: hit.all } : {}); })()`,
  (v) => v && v.all, 40, 500,
);
const fired = await (async () => {
  for (let i = 0; i < 10; i++) {
    const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('CTF A/B — FOM') && (d.textContent || '').includes('Run A'))?.querySelector('[data-testid="adopt-downstream"]')`);
    if (!String(clicked).startsWith("clicked@")) { await sleep(600); continue; }
    firePoll;
    for (let w = 0; w < 30; w++) {
      const es = edges();
      const settled = es.some((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id) &&
        !es.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id);
      if (settled) return { try: i + 1 };
      await sleep(500);
    }
  }
  return null;
})();
ok("F THE FIRE: the re-wire settled (click-until-world-effect)", !!fired, fired ? `try${fired.try}` : "never");
ok("F the graph: the autopick now consumes CTF-B (POST the new edge first)", edges().some((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id));
ok("F the graph: the old CTF-A→autopick wire is GONE (DELETE after)", !edges().some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id));
ok("F NOTHING minted (the plain adopt is wiring only)", jobs().length === jobsAtFire, `${jobs().length} jobs (was ${jobsAtFire})`);
ok("F no excludemg anywhere (the rider's door stayed shut)", jobs().every((j) => j.type !== "excludemg"));

const toastV = await firePoll;
toastSeen = toastV?.all ?? null;
if (!toastSeen) {
  const again = evalJson(`(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => t.textContent?.slice(0, 400) ?? ''); const hit = toasts.find(t => t.includes('Downstream adopted by')); return JSON.stringify(hit ?? null); })()`);
  toastSeen = typeof again === "string" && again !== "null" ? again : null;
}
const TOAST_TITLE = `Downstream adopted by ${NAME_CTF_B}`;
ok("F the toast's title speaks the new father", !!toastSeen && toastSeen.includes(TOAST_TITLE), (toastSeen ?? "none").slice(0, 120));
ok("F the toast's detail speaks the FULL contract verbatim",
  !!toastSeen &&
  toastSeen.includes(`1 downstream wire re-wired from ${NAME_CTF_A} to ${NAME_CTF_B}`) &&
  toastSeen.includes(`${NAME_AP} now consumes ${NAME_CTF_B}`) &&
  toastSeen.includes("their current results stay until re-run"),
  (toastSeen ?? "none").slice(0, 280));

const dlgClosed = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; return JSON.stringify({ compare: ds.some(d => (d.textContent || '').includes('CTF A/B — FOM') && (d.textContent || '').includes('Run A')) }); })()`,
  (v) => v.compare === false, 8, 500,
);
ok("F the dialog closed itself (the verb is done — the canvas shows the re-wiring)", dlgClosed?.compare === false);

/* ================================================================== */
console.log("== band C2: the loop closes — both leaves return to their refusal ==");
sh(`${AB} press Escape`); await sleep(500);
const stackClear = evalJson(`JSON.stringify({ dialogs: document.querySelectorAll('[role="dialog"]').length })`);
if ((stackClear?.dialogs ?? 0) > 0) { sh(`${AB} press Escape`); await sleep(600); }
await settleCensus();
await openInspector(NAME_CTF_A);
const openC2 = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("C2 the compare dialog reopened", String(openC2).startsWith("open@"), openC2);
const faceC2 = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — FOM') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const plain = d.querySelector('[data-testid="adopt-downstream"]'); const ex = d.querySelector('[data-testid="adopt-with-exclude"]'); return JSON.stringify({ plain: plain ? { disabled: plain.disabled, aria: plain.getAttribute('aria-label') } : null, exclude: ex ? { disabled: ex.disabled } : null }); })()`,
  (v) => v.plain, 12, 600,
);
ok("C2 the plain adopt DISABLED again (its downstream MOVED)", faceC2?.plain?.disabled === true, String(faceC2?.plain?.disabled));
ok("C2 the plain adopt's aria carries the honest refusal",
  faceC2?.plain?.aria === `Continue downstream from run B — unavailable: ${NAME_CTF_A} has no downstream jobs to re-wire`,
  faceC2?.plain?.aria ?? "none");
ok("C2 the exclude rider disabled beside it (the same moved wire)", faceC2?.exclude?.disabled === true, String(faceC2?.exclude?.disabled));
sh(`${AB} press Escape`); await sleep(500);
sh(`${AB} press Escape`); await sleep(500);

/* ================================================================== */
console.log("== band D: the data plane — the father flipped, the science did not ==");
const r2 = runJob(ap.id);
ok("D the autopick re-run accepted (remote lane, CTF-B's feed)", !r2.error, r2.error ?? r2.job?.status ?? "");
const apDone2 = await pollUntil(ap.id);
ok("D the autopick re-run completed", apDone2.status === "completed", apDone2.status);
const outsAfter = apiJson(`/api/jobs/${ap.id}/outputs`);
ok("D THE FATHER FLIPPED: the recorded cmd's --i names CTF-B's workdir, CTF-A's is gone",
  String(outsAfter.cmd ?? "").includes(B_DIR) && !String(outsAfter.cmd ?? "").includes(A_DIR),
  (String(outsAfter.cmd ?? "").match(/--i \S+/) ?? ["none"])[0].slice(0, 110));
const picksAfter = apiJson(`/api/jobs/${ap.id}/picks`);
ok("D NO ATTRITION: /picks catalogued 6 again (the provider changed, the science did not)", picksAfter.catalogued === 6, String(picksAfter.catalogued));
ok("D the six entries still answer (bare identities)", (picksAfter.micrographs ?? []).length === 6, String((picksAfter.micrographs ?? []).length));
const afterTotal = (picksAfter.micrographs ?? []).reduce((s, m) => s + (m.count ?? 0), 0);
ok("D the picker picked on the full six", afterTotal > 0, `${afterTotal} picks`);

/* ================================================================== */
console.log("== band P2: persistence — the re-wiring survives reload ==");
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 5, 30);
await settleCensus();
const esP = edges();
ok("P2 CTF-B→autopick still wired", esP.some((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id));
ok("P2 no CTF-A→autopick resurrection", !esP.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id));
const canvasP = evalJson(`JSON.stringify({ apCard: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('${NAME_AP}')) })`);
ok("P2 the canvas draws the re-parented consumer", canvasP?.apCard === true);

/* ================================================================== */
console.log("== band N: 320 born-at-band — the CTF face at the narrow door ==");
sh(`${AB} set viewport 320 800`);
// the t924 law: set viewport does not necessarily reload — and when it
// does not, the canvas keeps its 1280 pan and the card sits off-view.
// Mount AT 320, then drive the FIND BAR (Task 134's own door): a unique
// fragment focuses the card through focusJob — the camera centers it,
// the same door a narrow-window user reaches for.
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 5, 30);
await sleep(800);
sh(`${AB} press Control+f`);
await sleep(500);
sh(`${AB} keyboard type "CTF Estimation 1"`);
await sleep(600);
sh(`${AB} press Enter`);
await sleep(900);
sh(`${AB} press Escape`);
await sleep(400);
await settleCensus();
const findCentered = evalJson(`JSON.stringify({ vis: (() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME_CTF_A}')); if (!c) return false; const r = c.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth; })() })`);
ok("N the find bar centered the card (the unique fragment's focusJob)", findCentered?.vis === true, JSON.stringify(findCentered));
await openInspector(NAME_CTF_A);
const openN = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("N the dialog opened at 320 (click-until-open)", String(openN).startsWith("open@"), openN);
const narrowN = evalJson(`(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — FOM')); const r = d?.getBoundingClientRect(); const plain = d?.querySelector('[data-testid="adopt-downstream"]'); return JSON.stringify({ fits: r ? (r.width <= 322) : false, verb: !!plain, disabled: plain?.disabled ?? null, overX: document.documentElement.scrollWidth - document.documentElement.clientWidth }); })()`);
ok("N the dialog fits the narrow door", narrowN?.fits === true, `fits=${narrowN?.fits}`);
ok("N the verb present and honestly disabled at 320 (the post-fire leaf)", narrowN?.verb === true && narrowN?.disabled === true);
ok("N no horizontal overflow", (narrowN?.overX ?? 1) <= 0, `overX=${narrowN?.overX}`);

/* ================================================================== */
console.log("== band R: the restore — the witness's own job off, the mint's remove, the doctor ==");
sh(`${AB} set viewport 1280 900`);
try { sh(`${AB} close`); } catch {}
const rewireEdgeR = edges().find((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id);
if (rewireEdgeR) {
  const d = api("DELETE", `/api/edges/${rewireEdgeR.id}`);
  ok("R the re-wire edge off", !d.error, rewireEdgeR.id.slice(0, 8));
}
const dAp = api("DELETE", `/api/jobs/${ap.id}`);
ok("R the autopick deleted (the consumer, nothing else was minted)", !dAp.error || String(dAp.error).includes("not found"), dAp.error ?? "gone");
let removeOut = "";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
console.log(removeOut.split("\n").slice(-6).join("\n"));
ok("R the mint's remove GREEN", /REMOVE \d+ pass \/ 0 fail/.test(removeOut), (removeOut.match(/REMOVE .*/) ?? ["?"])[0]);
ok("R the world back to the seed trio (3 jobs)", jobs().length === 3, String(jobs().length));
const esR = apiJson("/api/edges").edges ?? [];
ok("R the world back to 2 edges", esR.length === 2, String(esR.length));
const ctfAHome = findName(NAME_CTF_A);
const mcAHome = findName("Motion Correction 1");
ok("R the seed's MC-A→CTF-A edge home", esR.some((e) => e.fromJobId === mcAHome?.id && e.toJobId === ctfAHome?.id));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("R the doctor CLEAN after the restore", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({
  main: {
    pass, fail,
    prep: { autopick: ap.id, beforeFather: A_DIR, beforeCatalogued: picksBefore.catalogued },
    fire: { toast: toastSeen, minted: false },
    dataPlane: { afterFather: B_DIR, afterCatalogued: picksAfter.catalogued, picks: afterTotal },
    at: new Date().toISOString(),
  },
});
console.log(`== t926 witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
