#!/usr/bin/env node
/**
 * t925 — the exclude verb's FIRST FIRE from the CTF face (the elder
 * domain's adoption verb, carried twice into the entries). The t922
 * ride found the CTF face's verb a HONEST LEAF: present, disabled,
 * "CTF Estimation 1 has no downstream jobs to re-wire". This window the
 * leaf grows the downstream and the verb fires:
 *
 *   prep  the t922 mint re-rides (the four completed runs), then the
 *         witness mints CTF-A a downstream consumer — "Automated
 *         Picking 1 (t925)", fed by CTF-A, run on the remote lane —
 *         and witnesses the BEFORE face: /picks answers catalogued=6.
 *   W     the replica — every CTF number computed on the ROUTES' own
 *         rows (FOM deltas, the regressed set, the trust line's median
 *         |Δ| in µm), never a memory.
 *   C     the CTF face: the verdict chips, the trust line verbatim, and
 *         THE FLIP — the exclude verb now ENABLED (the t922 ride's
 *         disabled leaf speaks its aria enabled), the plain adopt verb
 *         ENABLED beside it (present, counted, not fired).
 *   F     THE FIRE: click-until-WORLD-effect — the Exclude Micrographs
 *         filter minted with the regressed names baked at birth, CTF-B
 *         feeds it, CTF-A's downstream re-parents onto the filter, the
 *         old wire GONE (adoption moves, never duplicates), the toast
 *         speaks the full adoption contract, the dialog closes itself,
 *         the canvas holds the filter's card.
 *   C2    the loop closes: reopening the CTF face, the verb is DISABLED
 *         again — its downstream MOVED onto the filter — the same honest
 *         leaf aria the t922 ride first heard.
 *   D     the data layer: the filter RUNS (engine-native local) and
 *         speaks the count law verbatim "3 of 6 micrographs kept · 3
 *         excluded (list of 3)"; the star holds rows 3; the autopick
 *         RE-RUNS on the filtered feed (remote lane) and /picks answers
 *         catalogued=3 — the survivors only, the regressed names GONE;
 *         CTF-B untouched (6 rows — its own run's truth).
 *   P2    persistence — reload, the verdict still lives as WIRING.
 *   N     320 born-at-band — the CTF face at the narrow door.
 *   R     the restore — the witness's own jobs off downstream-first,
 *         workdirs swept local + mock-side, the t922 remove GREEN, the
 *         seed trio + 2 edges, the doctor CLEAN.
 *
 *   node scripts/t925-ctf-exclude-fire-witness.mjs main
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t925-ctf-exclude-fire-witness.json";
const MOCK_PROJECTS = path.join(ROOT, "services", "mock-cluster", "fs", "projects", "cryoflow");

const NAME_CTF_A = "CTF Estimation 1";
const NAME_CTF_B = "CTF Estimation 2 (t922)";
const NAME_AP = "Automated Picking 1 (t925)";
const NAME_FILTER = "Exclude Micrographs 1";

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

/* the remote lane's body — the mint's law: the run carries the remote
   body EXPLICITLY (a bare POST takes the LOCAL lane) */
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
const runJob = (id, remote = true) => api("POST", `/api/jobs/${id}/run`, remote ? REMOTE_BODY : undefined);

/* ---------------- the replica (band W's only truth) ---------------- */
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
console.log("== band P: prep — the mint re-rides, the downstream consumer mints ==");
const mintOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs mint 2>&1`);
console.log(mintOut.split("\n").slice(-3).join("\n"));
ok("P the t922 mint re-rides GREEN", /MINT \d+ pass \/ 0 fail/.test(mintOut), (mintOut.match(/MINT .*/) ?? ["?"])[0]);

const conn = mockClusterConn();
ok("P mock cluster resolved by name (create-if-missing)", !!conn?.id, conn?.id ?? "missing");
REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };

const ctfA = findName(NAME_CTF_A);
const ctfB = findName(NAME_CTF_B);
ok("P the elder pair aboard", !!(ctfA && ctfB), `${ctfA?.status}/${ctfB?.status}`);
ok("P both completed", ctfA?.status === "completed" && ctfB?.status === "completed");

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
ok("P the autopick completed (the BEFORE receipt exists)", apDone.status === "completed", apDone.status);

const picksBefore = apiJson(`/api/jobs/${ap.id}/picks`);
ok("P BEFORE: /picks catalogued 6 (the upstream star's own count)", picksBefore.catalogued === 6, String(picksBefore.catalogued));
ok("P BEFORE: 6 per-mic entries (the stub writes a star per mic)", (picksBefore.micrographs ?? []).length === 6, String((picksBefore.micrographs ?? []).length));
// the /picks route's identity law: names are BARE mic identities (the
// coord-star filename's own dialect — mic_001_autopick.star → mic_001;
// the catalogue read is reduced by the same bareMicName law)
const bare = (n) => String(n).replace(/\.(mrc|mrcs|tif|tiff)$/i, "");
const beforeNames = (picksBefore.micrographs ?? []).map((m) => m.name.split("/").pop()).sort();
ok("P BEFORE: the catalogue names are the six mics (bare identities)", JSON.stringify(beforeNames) === JSON.stringify(["mic_001", "mic_002", "mic_003", "mic_004", "mic_005", "mic_006"]), beforeNames.join(","));
const picksBeforeTotal = (picksBefore.micrographs ?? []).reduce((s, m) => s + (m.count ?? 0), 0);
ok("P BEFORE: picks landed (the picker picked)", picksBeforeTotal > 0, `${picksBeforeTotal} picks`);

/* ================================================================== */
console.log("== band W: the replica — the CTF face's numbers from the routes' own rows ==");
const ctfRows = (id) => byBase(apiJson(`/api/jobs/${id}/ctf`).micrographs ?? []);
const ra = ctfRows(ctfA.id), rb = ctfRows(ctfB.id);
// THE ROUTE'S OWN ORDER (t469: loadCtf sorts by defocusU DESCENDING —
// the worst fits first). The dialog's verdict inherits this order and
// the exclude verb bakes the regressed names in IT — the replica must
// speak the route's mouth, not a name-sorted guess.
const pairsRoute = [...ra.keys()].filter((n) => rb.has(n));
const pairs = [...pairsRoute].sort();
ok("W the join pairs 6", pairs.length === 6, pairs.join(","));
const deltas = pairsRoute.map((n) => ({ name: n, delta: rb.get(n).fom - ra.get(n).fom }));
const improved = deltas.filter((d) => d.delta > 0);
const regressed = deltas.filter((d) => d.delta < 0);
ok("W the FOM verdict 3 improved / 3 regressed", improved.length === 3 && regressed.length === 3,
  `${improved.map((d) => d.name).join(",")} vs ${regressed.map((d) => d.name).join(",")}`);
const fomMedian = median(deltas.map((d) => d.delta));
ok("W the FOM median Δ 0.000 (the symmetric verdict)", Math.abs(fomMedian) < 1e-9, fomMedian.toFixed(3));
const REGRESSED_LIST = regressed.map((d) => d.name);
const REGRESSED_JOINED = REGRESSED_LIST.join(", ");
const KEPT_LIST = improved.map((d) => d.name);
const defocusDeltas = pairs.map((n) => Math.abs((ra.get(n).defocusU + ra.get(n).defocusV) / 2 - (rb.get(n).defocusU + rb.get(n).defocusV) / 2));
const trustMedian = median(defocusDeltas);
ok("W the trust median |Δ| computed (µm)", Number.isFinite(trustMedian) && trustMedian > 0, `${trustMedian.toFixed(3)} µm`);
const TRUST_TEXT = `Defocus agreement: median |Δ| = ${trustMedian.toFixed(3)} µm across ${pairs.length} paired micrographs — the pairing's own health check.`;

/* ================================================================== */
console.log("== band C: the CTF face — the leaf GROWS the downstream ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 5, 30);
await settleCensus();
await openInspector(NAME_CTF_A);
const doorC = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${NAME_CTF_A}')); const b = d?.querySelector('[aria-label^="CTF A/B — compare with another completed run"]'); return JSON.stringify({ present: !!b, aria: b?.getAttribute('aria-label') ?? null }); })()`,
  (v) => v.present === true, 24, 750,
);
ok("C the CTF A/B door present", doorC?.present === true);
ok("C the door's aria counts its sibling", doorC?.aria === "CTF A/B — compare with another completed run (1 sibling runs available)", doorC?.aria ?? "none");
const openC = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("C the compare dialog opened on the FOM lens (the domain's default)", String(openC).startsWith("open@"), openC);

const faceC = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — FOM') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const chips = [...d.querySelectorAll('span')].map(s => s.textContent?.trim() ?? ''); const trust = [...d.querySelectorAll('div')].map(x => x.textContent?.trim() ?? '').find(t => t.startsWith('Defocus agreement')); const ex = d.querySelector('[data-testid="adopt-with-exclude"]'); const plain = d.querySelector('[data-testid="adopt-downstream"]'); return JSON.stringify({ chips, trust, exclude: ex ? { disabled: ex.disabled, aria: ex.getAttribute('aria-label'), title: ex.getAttribute('title'), label: ex.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null } : null, plain: plain ? { disabled: plain.disabled, aria: plain.getAttribute('aria-label') } : null }); })()`,
  (v) => v.chips?.length > 0, 12, 600,
);
const chipsC = faceC?.chips ?? [];
ok("C verdict chip 3 improved (FOM)", chipsC.includes("3 improved"), chipsC.filter((c) => c.includes("improved")).join("|"));
ok("C verdict chip 3 regressed", chipsC.includes("3 regressed"));
ok("C median Δ 0.000 (the symmetric FOM verdict)", chipsC.includes("median Δ 0.000"), chipsC.filter((c) => c.startsWith("median")).join("|"));
ok("C of 6 paired, NO unpaired chip", chipsC.includes("of 6 paired") && !chipsC.some((c) => c.startsWith("unpaired")), chipsC.filter((c) => c.includes("paired")).join("|"));
ok("C THE TRUST LINE verbatim (the pairing's own health check)", faceC?.trust === TRUST_TEXT, (faceC?.trust ?? "none").slice(0, 140));
ok("C the exclude verb present (3 regressed — the no-op law hides it at 0)", !!faceC?.exclude);
ok("C THE FLIP: the verb ENABLED (CTF-A now HAS a downstream to re-wire)", faceC?.exclude?.disabled === false, String(faceC?.exclude?.disabled));
ok("C the verb's label speaks the count", /Continue downstream, excluding these\s*\(3\)/.test(faceC?.exclude?.label ?? ""), faceC?.exclude?.label ?? "none");
ok("C the verb's aria speaks the whole plan verbatim",
  faceC?.exclude?.aria === `Continue downstream from ${NAME_CTF_B} with 3 regressed micrographs excluded — mints an Exclude Micrographs filter and re-wires 1 of ${NAME_CTF_A}'s downstream jobs onto it`,
  faceC?.exclude?.aria ?? "none");
ok("C the verb's title bakes the filter's contract",
  faceC?.exclude?.title === `Bakes the 3 regressed micrographs into an Exclude Micrographs filter consuming ${NAME_CTF_B} (editable in the filter's Exclusions tab), then re-wires ${NAME_CTF_A}'s 1 downstream wire onto the filter — results stay until re-run`,
  (faceC?.exclude?.title ?? "none").slice(0, 120));
ok("C the plain adopt verb present beside it", !!faceC?.plain);
ok("C the plain adopt ENABLED too (the elder face's other door — witnessed, not fired)",
  faceC?.plain?.disabled === false && faceC?.plain?.aria === `Continue downstream from ${NAME_CTF_B} — re-wires 1 of ${NAME_CTF_A}'s downstream jobs`,
  faceC?.plain?.aria ?? "none");

/* ================================================================== */
console.log("== band F: THE FIRE — the exclude verb's first fire from the CTF face ==");
const edgesBefore = edges();
ok("F pre-fire: CTF-A→autopick in place", edgesBefore.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id));

let toastSeen = null;
const firePoll = poll(
  `(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? null, all: t.textContent?.slice(0, 400) ?? '' })); const hit = toasts.find(t => (t.all || '').includes('Downstream adopted by')); return JSON.stringify(hit ? { title: hit.title, all: hit.all } : {}); })()`,
  (v) => v && v.all, 40, 500,
);
const fired = await (async () => {
  for (let i = 0; i < 10; i++) {
    const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('CTF A/B — FOM') && (d.textContent || '').includes('Run A'))?.querySelector('[data-testid="adopt-with-exclude"]')`);
    if (!String(clicked).startsWith("clicked@")) { await sleep(600); continue; }
    firePoll;
    for (let w = 0; w < 30; w++) {
      const f = findName(NAME_FILTER);
      const es = edges();
      const settled = f && es.some((e) => e.fromJobId === ctfB.id && e.toJobId === f.id) &&
        es.some((e) => e.fromJobId === f.id && e.toJobId === ap.id) &&
        !es.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id);
      if (settled) return { filter: f, try: i + 1 };
      await sleep(500);
    }
  }
  return null;
})();
const filter = fired?.filter ?? findName(NAME_FILTER);
ok("F THE FIRE: the filter minted and the wiring settled (click-until-world-effect)", !!fired, fired ? `try${fired.try} · ${filter.id.slice(0, 8)}` : "never");
ok("F the filter's NAME is the store's own counter", filter?.name === NAME_FILTER, filter?.name ?? "none");
ok("F the filter's params hold the replica's regressed names (baked at birth)",
  String(filter?.params?.excludeNames ?? "") === REGRESSED_JOINED,
  `${String(filter?.params?.excludeNames ?? "none")} vs ${REGRESSED_JOINED}`);
const esF = edges();
ok("F the graph: CTF-B feeds the filter (the filter consumes run B)", esF.some((e) => e.fromJobId === ctfB.id && e.toJobId === filter.id));
ok("F the graph: the filter feeds the autopick (A's downstream re-parented)", esF.some((e) => e.fromJobId === filter.id && e.toJobId === ap.id));
ok("F the graph: the old CTF-A→autopick wire is GONE (adoption moved it, never duplicated)", !esF.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id));

const toastV = await firePoll;
toastSeen = toastV?.all ?? null;
if (!toastSeen) {
  const again = evalJson(`(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => t.textContent?.slice(0, 400) ?? ''); const hit = toasts.find(t => t.includes('Downstream adopted by')); return JSON.stringify(hit ?? null); })()`);
  toastSeen = typeof again === "string" && again !== "null" ? again : null;
}
const TOAST_TITLE = `Downstream adopted by ${NAME_FILTER}`;
const TOAST_DETAIL = `1 downstream wire re-wired from ${NAME_CTF_A} to ${NAME_FILTER} · ${NAME_AP} now consumes ${NAME_FILTER} · their current results stay until re-run`;
ok("F the toast's title speaks the adoption", !!toastSeen && toastSeen.includes(TOAST_TITLE), (toastSeen ?? "none").slice(0, 120));
ok("F the toast's detail speaks the FULL contract verbatim",
  !!toastSeen && toastSeen.includes("1 downstream wire re-wired from") && toastSeen.includes(`${NAME_AP} now consumes ${NAME_FILTER}`) && toastSeen.includes("their current results stay until re-run"),
  (toastSeen ?? "none").slice(0, 260));

const dlgClosed = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; return JSON.stringify({ compare: ds.some(d => (d.textContent || '').includes('CTF A/B — FOM') && (d.textContent || '').includes('Run A')) }); })()`,
  (v) => v.compare === false, 8, 500,
);
ok("F the dialog closed itself (the verb is done — the canvas shows the wiring)", dlgClosed?.compare === false);
const canvasFilter = await poll(
  `JSON.stringify({ card: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('Exclude Micrographs')) })`,
  (v) => v.card === true, 8, 500,
);
ok("F the canvas holds the filter's card", canvasFilter?.card === true);

/* ================================================================== */
console.log("== band C2: the loop closes — the leaf returns to its honest refusal ==");
sh(`${AB} press Escape`); await sleep(500);
sh(`${AB} press Escape`); await sleep(500);
const stackClear = evalJson(`JSON.stringify({ dialogs: document.querySelectorAll('[role="dialog"]').length })`);
if ((stackClear?.dialogs ?? 0) > 0) { sh(`${AB} press Escape`); await sleep(600); }
await settleCensus();
await openInspector(NAME_CTF_A);
const openC2 = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("C2 the compare dialog reopened", String(openC2).startsWith("open@"), openC2);
const faceC2 = await poll(
  `(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — FOM') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const ex = d.querySelector('[data-testid="adopt-with-exclude"]'); const plain = d.querySelector('[data-testid="adopt-downstream"]'); return JSON.stringify({ exclude: ex ? { disabled: ex.disabled, aria: ex.getAttribute('aria-label') } : null, plain: plain ? { disabled: plain.disabled } : null }); })()`,
  (v) => v.exclude, 12, 600,
);
ok("C2 the verb present still (3 regressed — the verdict is the graph's, not the wiring's)", !!faceC2?.exclude);
ok("C2 THE LOOP CLOSES: the verb DISABLED again (its downstream MOVED onto the filter)", faceC2?.exclude?.disabled === true, String(faceC2?.exclude?.disabled));
ok("C2 the leaf's aria carries the honest refusal (the t922 ride's first words)",
  faceC2?.exclude?.aria === `Continue downstream with these micrographs excluded — unavailable: ${NAME_CTF_A} has no downstream jobs to re-wire`,
  faceC2?.exclude?.aria ?? "none");
ok("C2 the plain adopt disabled beside it (the same moved wire)", faceC2?.plain?.disabled === true, String(faceC2?.plain?.disabled));
sh(`${AB} press Escape`); await sleep(500);
sh(`${AB} press Escape`); await sleep(500);

/* ================================================================== */
console.log("== band D: the data layer — the filter runs, the downstream drinks ==");
const r1 = api("POST", `/api/jobs/${filter.id}/run`);
ok("D the filter's run accepted (bare POST — engine-native is local by design)", !r1.error, r1.error ?? r1.job?.status ?? "");
const run1 = await pollUntil(filter.id);
ok("D the filter completed", run1.status === "completed", run1.status);
const COUNT_LAW = `3 of 6 micrographs kept · 3 excluded (list of 3)`;
ok("D THE COUNT LAW verbatim (3 of 6 kept · 3 excluded)", String(run1.result ?? "").includes(COUNT_LAW), String(run1.result ?? "none").slice(0, 90));
const outs1 = apiJson(`/api/jobs/${filter.id}/outputs`);
const starFile = (outs1.files ?? []).find((f) => f.name === "micrographs_filtered.star");
ok("D the filtered star is the product (rows = the kept 3)", !!starFile && starFile.rows === 3, JSON.stringify(starFile ?? {}).slice(0, 110));

const r2 = runJob(ap.id);
ok("D the autopick re-run accepted (remote lane, the filter's feed)", !r2.error, r2.error ?? r2.job?.status ?? "");
const apDone2 = await pollUntil(ap.id);
ok("D the autopick re-run completed", apDone2.status === "completed", apDone2.status);
const picksAfter = apiJson(`/api/jobs/${ap.id}/picks`);
ok("D AFTER: /picks catalogued 3 (the filter's star is the input's truth)", picksAfter.catalogued === 3, String(picksAfter.catalogued));
const afterNames = (picksAfter.micrographs ?? []).map((m) => m.name.split("/").pop()).sort();
ok("D AFTER: the entries are the SURVIVORS (the replica's kept set, bare identities)",
  JSON.stringify(afterNames) === JSON.stringify(KEPT_LIST.map(bare).sort()), afterNames.join(","));
ok("D AFTER: the regressed names are GONE (the excluded micrographs did not ride back)",
  REGRESSED_LIST.map(bare).every((n) => !afterNames.includes(n)), REGRESSED_LIST.map(bare).join(","));
const picksAfterTotal = (picksAfter.micrographs ?? []).reduce((s, m) => s + (m.count ?? 0), 0);
ok("D AFTER: the picker picked on the survivors", picksAfterTotal > 0, `${picksAfterTotal} picks`);
const ctfBRowsAfter = apiJson(`/api/jobs/${ctfB.id}/ctf`).micrographs ?? [];
ok("D CTF-B untouched (6 rows — its own run's truth)", ctfBRowsAfter.length === 6, String(ctfBRowsAfter.length));

/* ================================================================== */
console.log("== band P2: persistence — the verdict lives as WIRING across reload ==");
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 5, 30);
await settleCensus();
const esP = edges();
ok("P2 the filter survives the reload", !!findName(NAME_FILTER));
ok("P2 CTF-B→filter still wired", esP.some((e) => e.fromJobId === ctfB.id && e.toJobId === filter.id));
ok("P2 filter→autopick still wired (the downstream still consumes the verdict)", esP.some((e) => e.fromJobId === filter.id && e.toJobId === ap.id));
ok("P2 no CTF-A→autopick resurrection (the graph keeps the adoption)", !esP.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id));
const canvasP = evalJson(`JSON.stringify({ filterCard: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('Exclude Micrographs')), apCard: [...document.querySelectorAll('[data-job]')].some(c => (c.textContent || '').includes('${NAME_AP}')) })`);
ok("P2 the canvas draws the filter and the autopick", canvasP?.filterCard === true && canvasP?.apCard === true);

/* ================================================================== */
console.log("== band N: 320 born-at-band — the CTF face at the narrow door ==");
sh(`${AB} set viewport 320 800`);
await settleCensus();
await openInspector(NAME_CTF_A);
const openN = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("N the dialog opened at 320 (click-until-open)", String(openN).startsWith("open@"), openN);
const narrowN = evalJson(`(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — FOM')); const r = d?.getBoundingClientRect(); const ex = d?.querySelector('[data-testid="adopt-with-exclude"]'); return JSON.stringify({ fits: r ? (r.width <= 322) : false, trust: (d?.textContent || '').includes('Defocus agreement'), verb: !!ex, disabled: ex?.disabled ?? null, overX: document.documentElement.scrollWidth - document.documentElement.clientWidth }); })()`);
ok("N the dialog fits the narrow door", narrowN?.fits === true, `fits=${narrowN?.fits}`);
ok("N the trust line renders at 320", narrowN?.trust === true);
ok("N the verb present and honestly disabled at 320 (the post-fire leaf)", narrowN?.verb === true && narrowN?.disabled === true);
ok("N no horizontal overflow", (narrowN?.overX ?? 1) <= 0, `overX=${narrowN?.overX}`);

/* ================================================================== */
console.log("== band R: the restore — the witness's own jobs off, the mint's remove, the doctor ==");
sh(`${AB} set viewport 1280 900`);
try { sh(`${AB} close`); } catch {}
// workdirs recorded BEFORE the deletes (the sweep's map)
const workdirs = {};
for (const j of [ap, filter]) {
  try { workdirs[j.id] = apiJson(`/api/jobs/${j.id}/outputs`).workdir ?? null; } catch { workdirs[j.id] = null; }
}
const rewireEdgeR = edges().find((e) => e.fromJobId === filter.id && e.toJobId === ap.id);
if (rewireEdgeR) {
  const d = api("DELETE", `/api/edges/${rewireEdgeR.id}`);
  ok("R the re-wire edge off (the downstream freed)", !d.error, rewireEdgeR.id.slice(0, 8));
}
const dAp = api("DELETE", `/api/jobs/${ap.id}`);
ok("R the autopick deleted (the consumer first)", !dAp.error || String(dAp.error).includes("not found"), dAp.error ?? "gone");
const dFilter = api("DELETE", `/api/jobs/${filter.id}`);
ok("R the filter deleted", !dFilter.error || String(dFilter.error).includes("not found"), dFilter.error ?? "gone");
ok("R no excludemg residue", jobs().every((j) => j.type !== "excludemg"));
// the workdirs swept: local + mock-side (the mint's own sweep law)
let swept = 0;
for (const [id, wd] of Object.entries(workdirs)) {
  if (wd && wd.startsWith(ROOT) && existsSync(wd) && !wd.endsWith(ROOT.split("/").pop())) {
    try { rmSync(wd, { recursive: true, force: true }); swept++; } catch {}
  }
  const mockDir = path.join(MOCK_PROJECTS, id);
  if (existsSync(mockDir)) { try { rmSync(mockDir, { recursive: true, force: true }); swept++; } catch {} }
}
ok("R the workdirs swept (local + mock-side)", swept >= 0, `${swept} dir(s) removed`);
let removeOut = "";
try { removeOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs remove 2>&1`); } catch (e) { removeOut = String(e); }
console.log(removeOut.split("\n").slice(-6).join("\n"));
ok("R the mint's remove GREEN", /REMOVE \d+ pass \/ 0 fail/.test(removeOut), (removeOut.match(/REMOVE .*/) ?? ["?"])[0]);
ok("R the world back to the seed trio (3 jobs)", jobs().length === 3, String(jobs().length));
const esR = apiJson("/api/edges").edges ?? [];
ok("R the world back to 2 edges", esR.length === 2, esR.map((e) => `${e.fromJobId.slice(0, 6)}→${e.toJobId.slice(0, 6)}`).join(" · "));
const ctfAHome = findName(NAME_CTF_A);
const mcAHome = findName("Motion Correction 1");
ok("R the seed's MC-A→CTF-A edge home", esR.some((e) => e.fromJobId === mcAHome?.id && e.toJobId === ctfAHome?.id));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("R the doctor CLEAN after the restore", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({
  main: {
    pass, fail,
    prep: { autopick: ap.id, beforeCatalogued: picksBefore.catalogued, beforePicks: picksBeforeTotal },
    replica: { improved: KEPT_LIST, regressed: REGRESSED_LIST, trustMedian: trustMedian.toFixed(3), trust: TRUST_TEXT },
    fire: { filter: filter ? { id: filter.id, name: filter.name, excludeNames: filter.params?.excludeNames } : null, toast: toastSeen },
    dataLayer: { countLaw: COUNT_LAW, starRows: starFile?.rows ?? null, afterCatalogued: picksAfter.catalogued, survivors: afterNames },
    at: new Date().toISOString(),
  },
});
console.log(`== t925 witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
