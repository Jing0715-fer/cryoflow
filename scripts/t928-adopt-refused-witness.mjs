#!/usr/bin/env node
/**
 * t928 — the adopt plan's REFUSED faces, fired live. Carried from t927's
 * entry as candidate (a): the plan's own refusals have never been
 * witnessed firing — every prior ride (t920/t925/t926) lived in the
 * compare face's canonical DAG world, where the plan's cycle and port
 * guards "never fire there" (adopt-branch.ts's own confession). This
 * window the world grows the loop:
 *
 *   prep  the t922 mint re-rides, the autopick consumer mints (fed by
 *         CTF-A, remote lane), the BEFORE face: /picks catalogued 6 AND
 *         the recorded cmd's --i names CTF-A's workdir.
 *   L     the LOOP EDGE through the API's own door: CTF-A→MC-B (the port
 *         law — motioncorr's movies input accepts ["movies",
 *         "micrographs"], so the wire is port-legal AND cycle-free: MC-B
 *         already feeds CTF-B). The world stays a DAG — but the ADOPT
 *         PLAN (A=CTF-A, B=CTF-B) now sees its child MC-B reaching B:
 *         the cycle guard's live trigger.
 *   C     the MIXED face: the consumer (P) and the loop edge (L) make
 *         CTF-A's plan moves=1 (the autopick) + refused=1 (MC-B, cycle)
 *         — the verb ENABLED, its aria and title speaking the ONE move,
 *         and the refusal INVISIBLE at the enabled face (the mixed
 *         plan's verb pre-announces only the moves; the toast carries
 *         the refusal — the product's actual speech, witnessed as-is).
 *   F     THE FIRE with the refusal aboard (the mixed plan): the
 *         autopick consumer's wire moves, MC-B's wire refuses — the verb
 *         ENABLED, the contract line speaking the ONE move — and the
 *         toast speaks the FULL contract INCLUDING the refusal line
 *         verbatim ("Motion Correction 2 (t922) refused — re-wiring
 *         would close a loop"), title "Downstream adopted by <B>". The
 *         data layer: CTF-B→autopick exists, CTF-A→autopick GONE, and
 *         CTF-A→MC-B UNTOUCHED — the refusal held.
 *   D     the data plane: the autopick re-runs (remote lane) and its
 *         recorded cmd's --i names CTF-B's workdir (the father flipped);
 *         /picks answers catalogued 6 — no attrition; MC-B keeps BOTH
 *         its upstreams (the loop child's wires intact).
 *   G     the lib's PORT-DRIFT mouth (jiti, the REAL brain): a graph the
 *         compare face cannot produce — a wire whose fromPort B does not
 *         declare — plan.refused[0].reason === "port" and
 *         describeAdoption's line verbatim ("<child> refused — <B> has
 *         no matching output port"); the cycle line's lib mouth likewise
 *         (the two refusal buckets side by side, no src change).
 *   C2    the loop closes: reopening the CTF face, the mover has moved
 *         away and THE REFUSAL STAYED — the all-refused face returns
 *         verbatim (the same disabled aria as band C, now earned a
 *         second way).
 *   N     320 born-at-band on the returned all-refused face: the find
 *         bar centers the host card, the dialog fits, overX 0.
 *   R     the restore: the loop edge off, the consumer deleted, the
 *         t922 remove GREEN, the seed trio + 2 edges, CTF-A's seed-feed
 *         re-run (6 rows again), the doctor CLEAN.
 *
 *   node scripts/t928-adopt-refused-witness.mjs main
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t928-adopt-refused-witness.json";
const STATE = path.join(ROOT, "data", "t928-adopt-refused.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_MC_B = "Motion Correction 2 (t922)";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CTF_B = "CTF Estimation 2 (t922)";
const NAME_AP = "Automated Picking 1 (t928)";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 300_000, cwd: ROOT }).trim();
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
    if (pos.off) {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
      await sleep(500);
      const pos2 = evalJson(locate);
      if (pos2 && pos2.own) {
        sh(`${AB} mouse move ${pos2.x} ${pos2.y}`);
        sh(`${AB} mouse down`);
        sh(`${AB} mouse up`);
        return `clicked@${pos2.x},${pos2.y}`;
      }
      return "OFF-VIEWPORT";
    }
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
const shApi = (url) => sh(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`);
const apiJson = (url) => JSON.parse(shApi(url));
const api = (method, url, body) => {
  const cmd = `curl -s -X ${method} -H "Origin: ${BASE}" -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`;
  try { return JSON.parse(sh(cmd)); } catch { return { error: "parse" }; }
};
const jobs = () => apiJson("/api/jobs").jobs ?? [];
const edges = () => apiJson("/api/edges").edges ?? [];
const findName = (n) => jobs().find((j) => j.name === n);
async function pollUntil(jobId, want, timeoutMs = 240_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobs().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
}
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
/* the compare dialog's verb row, read whole */
const dialogFace = async () => poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('CTF A/B — FOM') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const contractDivs = [...d.querySelectorAll('div')].filter(x => (x.textContent || '').trim().startsWith('Adoption re-wires'));
  const contract = (contractDivs.find(x => x.children.length === 0) ?? contractDivs.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0])?.textContent?.trim() ?? null;
  const plain = d.querySelector('[data-testid="adopt-downstream"]'); return JSON.stringify({ open: true, contract, plain: plain ? { disabled: plain.disabled, label: plain.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null, aria: plain.getAttribute('aria-label'), title: plain.getAttribute('title'), badge: plain.querySelector('span.font-semibold')?.textContent ?? null } : null }); })()`,
  (v) => v.open === true, 12, 600,
);

/* ================================================================== */
console.log("== band P: prep — the mint re-rides, the consumer mints, the BEFORE father ==");
const ctfA0 = findName(NAME_CTF_A);
const preAP = findName(NAME_AP);
if (preAP) {
  const preE = edges().find((e) => e.fromJobId === ctfA0?.id && e.toJobId === preAP.id) ?? edges().find((e) => e.toJobId === preAP.id);
  if (preE) api("DELETE", `/api/edges/${preE.id}`);
  const d = api("DELETE", `/api/jobs/${preAP.id}`);
  ok("P a stale consumer deleted (idempotent re-ride)", !d.error || String(d.error).includes("not found"), preAP.id.slice(0, 8));
}
const preMcA0 = findName(NAME_MC_A);
const seed0 = ctfA0 && preMcA0 ? edges().find((e) => e.fromJobId === preMcA0.id && e.toJobId === ctfA0.id) : null;
if (!seed0 && ctfA0 && preMcA0) {
  const p = api("POST", "/api/edges", { fromJobId: preMcA0.id, toJobId: ctfA0.id });
  ok("P the seed MC-A→CTF-A edge back for the mint", !p.error && !!p.edge?.id, p.error ?? p.edge?.id);
}
const mintOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs mint 2>&1`);
ok("P the t922 mint re-rides GREEN", /MINT \d+ pass \/ 0 fail/.test(mintOut), (mintOut.match(/MINT .*/) ?? ["?"])[0]);

const conn = mockClusterConn();
ok("P mock cluster resolved by name", !!conn?.id, conn?.id ?? "missing");
REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };

const mcA = findName(NAME_MC_A);
const mcB = findName(NAME_MC_B);
const ctfA = findName(NAME_CTF_A);
const ctfB = findName(NAME_CTF_B);
ok("P the four runs aboard and completed", !!mcA && !!mcB && !!ctfA && !!ctfB && [mcA, mcB, ctfA, ctfB].every((j) => j.status === "completed"));
const preLoop2 = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id);
if (preLoop2) { const d = api("DELETE", `/api/edges/${preLoop2.id}`); ok("P a stale loop edge deleted (after the mint — the names resolve only here)", !d.error, preLoop2.id.slice(0, 8)); }
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
console.log("== band L: the LOOP EDGE — the API's own door, port-legal and cycle-free ==");
const loopPost = api("POST", "/api/edges", { fromJobId: ctfA.id, toJobId: mcB.id });
ok("L the loop edge CTF-A→MC-B POSTED (the movies input accepts micrographs)", !loopPost.error && !!loopPost.edge?.id, loopPost.error ?? loopPost.edge?.id);
const loopEdge = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id);
ok("L the loop edge persists", !!loopEdge, loopEdge?.id ?? "missing");
const worldEdges = edges();
ok("L the world stays a DAG (the API's cycle guard never fired — MC-B⇒CTF-A has no path)",
  !worldEdges.some((e) => e.toJobId === ctfA.id && e.fromJobId !== mcA.id), `${worldEdges.length} edges`);
writeFileSync(STATE, JSON.stringify({ loopEdge: loopEdge?.id ?? null, ap: ap.id }, null, 2));

/* ================================================================== */
console.log("== band C: the MIXED face — the verb speaks the MOVE, the refusal waits for the toast ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 5, 30);
await settleCensus();
await openInspector(NAME_CTF_A);
const openC = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("C the compare dialog opened on the FOM lens", String(openC).startsWith("open@"), openC);
const faceC = await dialogFace();
ok("C the plain adopt verb present and ENABLED (the mixed plan still moves one)", faceC?.plain?.disabled === false, String(faceC?.plain?.disabled));
ok("C the verb's aria speaks the ONE move (the enabled pin)",
  faceC?.plain?.aria === `Continue downstream from ${NAME_CTF_B} — re-wires 1 of ${NAME_CTF_A}'s downstream jobs`,
  faceC?.plain?.aria ?? "none");
ok("C the verb's title speaks the move — and the refusal is INVISIBLE here (the mixed plan's verb pre-announces only the moves; the toast carries the refusal)",
  faceC?.plain?.title === `Re-wires ${NAME_CTF_A}'s 1 downstream wire to ${NAME_CTF_B} — their current results stay until re-run`,
  faceC?.plain?.title ?? "none");
ok("C the contract line above the verbs speaks the ONE move (verbatim)",
  faceC?.contract === `Adoption re-wires ${NAME_CTF_A}'s 1 downstream job to consume ${NAME_CTF_B} — their current results stay until re-run.`,
  faceC?.contract ?? "none");

/* ================================================================== */
console.log("== band F: THE FIRE with the refusal aboard — the mixed plan moves one and refuses one ==");
const jobsAtFire = jobs().length;
let toastSeen = null;
const firePoll = poll(
  `(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? null, all: t.textContent?.slice(0, 400) ?? '' })); const hit = toasts.find(t => (t.all || '').includes('Downstream adopted by')); return JSON.stringify(hit ? { title: hit.title, all: hit.all } : {}); })()`,
  (v) => v && v.all, 40, 500,
);
const fired = await (async () => {
  for (let i = 0; i < 10; i++) {
    const f = await dialogFace();
    if (f?.plain?.disabled === false) {
      const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('CTF A/B — FOM') && (d.textContent || '').includes('Run A'))?.querySelector('[data-testid="adopt-downstream"]')`);
      if (!String(clicked).startsWith("clicked@")) { await sleep(600); continue; }
      for (let w = 0; w < 30; w++) {
        const es = edges();
        if (es.some((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id) &&
            !es.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id)) return `fired@try${i}`;
        await sleep(500);
      }
      return `clicked-but-unmoved@try${i}`;
    }
    await sleep(700);
  }
  return "NEVER-FIRED";
})();
ok("F the fire landed (the move POSTed, the old wire GONE)", String(fired).startsWith("fired@"), String(fired));
ok("F NOTHING minted (the plain adopt is wiring only)", jobs().length === jobsAtFire, `${jobs().length} jobs (was ${jobsAtFire})`);
const toastV = await firePoll;
toastSeen = toastV && { title: toastV.title, all: toastV.all };
if (!toastSeen?.all) {
  const again = evalJson(`(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => t.textContent?.slice(0, 400) ?? ''); const hit = toasts.find(t => t.includes('Downstream adopted by')); return JSON.stringify(hit ?? null); })()`);
  toastSeen = typeof again === "string" && again !== "null" ? { title: null, all: again } : null;
}
ok("F THE TOAST's title speaks the new father (Downstream adopted by <B>)", !!toastSeen?.all && toastSeen.all.includes(`Downstream adopted by ${NAME_CTF_B}`), (toastSeen?.title ?? toastSeen?.all ?? "none").slice(0, 90));
const EXPECT_DETAIL = `1 downstream wire re-wired from ${NAME_CTF_A} to ${NAME_CTF_B} · ${NAME_AP} now consumes ${NAME_CTF_B} · their current results stay until re-run · ${NAME_MC_B} refused — re-wiring would close a loop`;
ok("F THE TOAST's detail carries THE REFUSAL LINE verbatim", (toastSeen?.all ?? "").includes(EXPECT_DETAIL) || (toastSeen?.all ?? "").includes(`${NAME_MC_B} refused — re-wiring would close a loop`), (toastSeen?.all ?? "none").slice(0, 220));
const edgesAfterFire = edges();
ok("F the move: CTF-B→autopick exists", edgesAfterFire.some((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id));
ok("F the move: CTF-A→autopick GONE", !edgesAfterFire.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id));
ok("F THE REFUSAL HELD at the data layer — CTF-A→MC-B UNTOUCHED", !!edgesAfterFire.find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id), edgesAfterFire.find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id)?.id ?? "missing");
const dialogClosed = await poll(
  `JSON.stringify({ gone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('CTF A/B — FOM')) })`,
  (v) => v.gone === true, 12, 600,
);
ok("F the dialog closes itself (the canvas shows the new wiring)", dialogClosed?.gone === true);

/* ================================================================== */
console.log("== band D: the data plane — the father flipped, the refusal's child unmoved ==");
const rd = runJob(ap.id);
ok("D the autopick's re-run accepted (remote lane, fed by CTF-B now)", !rd.error, rd.error ?? rd.job?.status ?? "");
const runD = await pollUntil(ap.id, "completed");
ok("D the autopick completed on CTF-B's feed", runD.status === "completed", runD.status);
const outsD = apiJson(`/api/jobs/${ap.id}/outputs`);
ok("D THE FATHER FLIPPED — the recorded cmd's --i names CTF-B's workdir",
  String(outsD.cmd ?? "").includes(B_DIR) && !String(outsD.cmd ?? "").includes(A_DIR),
  (String(outsD.cmd ?? "").match(/--i \S+/) ?? ["none"])[0].slice(0, 110));
const picksD = apiJson(`/api/jobs/${ap.id}/picks`);
ok("D /picks answers catalogued 6 — no attrition (the provider changed, the science did not)", picksD.catalogued === 6, String(picksD.catalogued));
ok("D the loop child keeps BOTH upstreams (the import's and CTF-A's)",
  edges().some((e) => e.fromJobId === findName("Import Movies (t922)")?.id && e.toJobId === mcB.id) &&
  edges().some((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id));
const ctfBRows = apiJson(`/api/jobs/${ctfB.id}/ctf`).micrographs ?? [];
ok("D CTF-B untouched (6 rows — its own run's truth)", ctfBRows.length === 6, String(ctfBRows.length));

/* ================================================================== */
console.log("== band G: the lib's PORT-DRIFT mouth — the plan's other refusal bucket, at the REAL brain ==");
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") }, interopDefault: true });
const adoptLib = await jiti.import(pathToFileURL(path.join(ROOT, "src/lib/adopt-branch.ts")).href);
// a graph the compare face cannot produce: A's wire leaves through a port
// B does not declare (manualpick's coords → a ctffind-shaped B)
const portPlan = adoptLib.planAdoption({
  edges: [
    { id: "e1", fromJobId: "A", toJobId: "child", fromPort: "coords", toPort: "micrographs" },
    { id: "e2", fromJobId: "src", toJobId: "B", fromPort: "micrographs", toPort: "micrographs" },
  ],
  jobs: [
    { id: "A", type: "manualpick", name: "Manual Pick A" },
    { id: "B", type: "ctffind", name: "CTF B" },
    { id: "child", type: "extract", name: "Extract Child" },
    { id: "src", type: "motioncorr", name: "MC Src" },
  ],
  fromRunId: "A",
  toRunId: "B",
  outputPortsOf: (type) => (type === "ctffind" ? ["micrographs"] : type === "manualpick" ? ["coords"] : []),
});
ok("G the plan refuses the drifted wire (reason: port)", portPlan.refused.length === 1 && portPlan.refused[0].reason === "port", JSON.stringify(portPlan.refused.map((r) => r.reason)));
ok("G the plan moves nothing", portPlan.moves.length === 0, String(portPlan.moves.length));
const portReceipt = adoptLib.describeAdoption(portPlan, "Manual Pick A", "CTF B");
ok("G the receipt's title speaks Nothing moved", portReceipt.title === "Nothing moved", portReceipt.title);
ok("G THE PORT LINE verbatim (<child> refused — <B> has no matching output port)",
  portReceipt.detail === `Extract Child refused — CTF B has no matching output port`, portReceipt.detail);
// the cycle bucket's lib mouth, side by side (the same brain, the loop graph)
const cyclePlan = adoptLib.planAdoption({
  edges: [
    { id: "e1", fromJobId: "A", toJobId: "child", fromPort: "micrographs", toPort: "micrographs" },
    { id: "e2", fromJobId: "child", toJobId: "B", fromPort: "micrographs", toPort: "micrographs" },
  ],
  jobs: [
    { id: "A", type: "ctffind", name: "CTF A" },
    { id: "B", type: "ctffind", name: "CTF B" },
    { id: "child", type: "excludemg", name: "Filter Child" },
  ],
  fromRunId: "A",
  toRunId: "B",
  outputPortsOf: () => ["micrographs"],
});
ok("G the cycle bucket at the lib's mouth (reason: cycle)", cyclePlan.refused.length === 1 && cyclePlan.refused[0].reason === "cycle", JSON.stringify(cyclePlan.refused.map((r) => r.reason)));
const cycleReceipt = adoptLib.describeAdoption(cyclePlan, "CTF A", "CTF B");
ok("G THE CYCLE LINE verbatim (<child> refused — re-wiring would close a loop)",
  cycleReceipt.detail === `Filter Child refused — re-wiring would close a loop`, cycleReceipt.detail);

/* ================================================================== */
console.log("== band C2: the loop closes — the mover moved away, the refusal stayed ==");
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 5, 30);
await settleCensus();
await openInspector(NAME_CTF_A);
const openC2 = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("C2 the compare dialog reopened", String(openC2).startsWith("open@"), openC2);
const faceC2 = await dialogFace();
ok("C2 THE ALL-REFUSED FACE RETURNS verbatim (the mover's departure left the refusal alone)",
  faceC2?.plain?.disabled === true && faceC2?.plain?.aria === `Continue downstream from run B — unavailable: All 1 downstream wire(s) refused — cycle`,
  faceC2?.plain?.aria ?? "none");

/* ================================================================== */
console.log("== band N: 320 born-at-band — the returned all-refused face at the narrow door ==");
sh(`${AB} set viewport 320 800`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 5, 30);
await sleep(800);
sh(`${AB} press Control+f`);
await sleep(500);
sh(`${AB} keyboard type "${NAME_CTF_A}"`);
await sleep(600);
sh(`${AB} press Enter`);
await sleep(900);
sh(`${AB} press Escape`);
await sleep(400);
await settleCensus();
const findCentered = evalJson(`JSON.stringify({ vis: (() => { const c = [...document.querySelectorAll('[data-job]')].find(x => (x.textContent || '').includes('${NAME_CTF_A}')); if (!c) return false; const r = c.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth; })() })`);
ok("N the find bar centered the host card (the unique fragment's focusJob)", findCentered?.vis === true, JSON.stringify(findCentered));
await openInspector(NAME_CTF_A);
const openN = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("N the dialog opened at 320 (click-until-open)", String(openN).startsWith("open@"), openN);
const narrowN = evalJson(`(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds.find(x => (x.textContent || '').includes('CTF A/B — FOM')); const r = d?.getBoundingClientRect(); const plain = d?.querySelector('[data-testid="adopt-downstream"]'); return JSON.stringify({ fits: r ? (r.width <= 322) : false, verb: !!plain, disabled: plain?.disabled ?? null, aria: plain?.getAttribute('aria-label') ?? null, overX: document.documentElement.scrollWidth - document.documentElement.clientWidth }); })()`);
ok("N the dialog fits the narrow door", narrowN?.fits === true, `fits=${narrowN?.fits}`);
ok("N the disabled verb honest at 320 (the all-refused aria travels)",
  narrowN?.verb === true && narrowN?.disabled === true && String(narrowN?.aria ?? "").includes("refused — cycle"));
ok("N no horizontal overflow", (narrowN?.overX ?? 1) <= 0, `overX=${narrowN?.overX}`);
sh(`${AB} press Escape`);
await sleep(600);

/* ================================================================== */
console.log("== band R: the restore — the loop edge off, the world home, the doctor CLEAN ==");
sh(`${AB} set viewport 1280 900`);
try { sh(`${AB} close`); } catch {}
const st = JSON.parse(readFileSync(STATE, "utf8"));
const liveLoop = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id);
if (liveLoop) { const d = api("DELETE", `/api/edges/${liveLoop.id}`); ok("R the loop edge off", !d.error, liveLoop.id); }
else ok("R no loop edge to undo (idempotent)", true);
const dAp = api("DELETE", `/api/jobs/${ap.id}`);
ok("R the consumer deleted (its CTF-B edge cascades)", !dAp.error || String(dAp.error).includes("not found"), dAp.error ?? "gone");
let rmOut = "";
try { rmOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs remove 2>&1`); } catch (e) { rmOut = String(e); }
ok("R the t922 remove GREEN", /REMOVE \d+ pass \/ 0 fail/.test(rmOut), (rmOut.match(/REMOVE .*/) ?? ["?"])[0]);
ok("R the world back to the seed trio (3 jobs)", jobs().length === 3);
ok("R the world holds exactly 2 edges", edges().length === 2);
console.log("  -- CTF-A's final re-run on the seed feed (6 rows again) --");
const rf = api("POST", `/api/jobs/${ctfA.id}/run`, REMOTE_BODY);
ok("R CTF-A's seed-feed re-run accepted", !rf.error, rf.error ?? "");
const runF2 = await pollUntil(ctfA.id, "completed");
ok("R CTF-A completed on the seed feed", runF2.status === "completed", runF2.status);
const rowsF2 = apiJson(`/api/jobs/${ctfA.id}/ctf`).micrographs ?? [];
ok("R the /ctf route answers 6 rows again (the seed's truth restored)", rowsF2.length === 6, String(rowsF2.length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("R the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({
  main: {
    pass, fail,
    loopEdge: { from: NAME_CTF_A, to: NAME_MC_B, portLaw: "movies input accepts micrographs" },
    faces: {
      allRefusedAria: `Continue downstream from run B — unavailable: All 1 downstream wire(s) refused — cycle`,
      toastDetail: EXPECT_DETAIL,
      libPortLine: `Extract Child refused — CTF B has no matching output port`,
      libCycleLine: `Filter Child refused — re-wiring would close a loop`,
    },
    dataPlane: { fatherFlipped: true, picks: picksD.catalogued, refusalHeld: true },
    at: new Date().toISOString(),
  },
});
console.log(`== t928 witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
