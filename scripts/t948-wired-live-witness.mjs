#!/usr/bin/env node
/**
 * t948 — the ALREADY-WIRED twin, fired live (node-only orchestrator +
 * agent-browser). Carried from t947's entry as candidate (b): t931's
 * pre-announcement doctrine ("the enabled speech accounts for EVERY
 * one of A's downstream wires") had one bucket still unspoken — the
 * children already consuming B through the same port pair, named only
 * by the toast AFTER the fire ("N job(s) already on B (left as is)").
 * This window the world grows the third bucket:
 *
 *   P   the t922 mint re-rides (the four completed runs), the mock
 *       cluster, the consumer mints (Automated Picking 1 (t948), fed
 *       by CTF-A — NO run needed: the plan reads the graph, not the
 *       statuses).
 *   C0  the PURE clean face (t926's world re-proven in one breath):
 *       CTF-A's plan moves=1, refused=0, wired=0 — aria/title/contract
 *       byte-identical to the t926 pins (the empty-clause law, now
 *       proven for BOTH clauses live).
 *   L   the LOOP EDGE through the API's own door (CTF-A→MC-B — the
 *       t928 law, the movies input accepts micrographs): the mixed
 *       face returns verbatim — the t928 band-C pins byte-identical
 *       (wired=0, the twin silent).
 *   W   the THIRD BUCKET: the wire CTF-B→AP (the same port pair as
 *       CTF-A→AP — the multi-input world the lib's own comment names:
 *       "a multi-input job fed by both branches keeps both") + the
 *       mover AP2 (CTF-A→AP2). The FULL HOUSE face: moves=1,
 *       wired=1, refused=1 — the verb ENABLED and its speech
 *       accounting for every wire: aria "…re-wires 1 … and refuses 1
 *       (cycle) and 1 already on <B> (left as is)", title "…stay
 *       until re-run — and refuses 1 (cycle) — and 1 already on <B>
 *       (left as is)", contract "…stay until re-run. Also refuses 1
 *       downstream wire (cycle) — left consuming <A>. Also 1 job
 *       already on <B> (left as is)."
 *   F   THE FIRE with the third bucket aboard: AP2's wire moves,
 *       AP's A-wire STAYS (the wired child keeps BOTH upstreams —
 *       the lib's both-wires law at the data layer), MC-B's wire
 *       refuses — and the toast speaks the full contract INCLUDING
 *       "1 job already on <B> (left as is)" verbatim, exactly what
 *       the face pre-announced.
 *   R   the restore: the wired edge off, the loop edge off, both
 *       consumers deleted, the t922 remove GREEN, the seed trio + 2
 *       edges, the census 14/14, the doctor CLEAN.
 *
 *   node scripts/t948-wired-live-witness.mjs main
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t948-wired-live-witness.json";
const STATE = path.join(ROOT, "data", "t948-wired-live.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_MC_B = "Motion Correction 2 (t922)";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CTF_B = "CTF Estimation 2 (t922)";
const NAME_AP = "Automated Picking 1 (t948)";
const NAME_AP2 = "Automated Picking 2 (t948)";

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
/* THE RIDE-1 LAW (t948's own first ride taught it): the compare face's
 * plan reads the STORE's edges, and edges POSTed on the API plane (curl)
 * reach the store only through a fresh page load — t928 always re-opened
 * the page after its graph mutations; ride 1 skipped that and the face
 * spoke the stale plan (the loop and wired edges invisible, the fire
 * even tried to re-create the wired edge and was refused by the DB's
 * own unique (from,to) constraint). Reload after EVERY API-side graph
 * mutation before any door opens. */
const reloadPage = async () => {
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 5, 30);
  await settleCensus();
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
/* the t948 door law — a door that fetches its own data mounts late:
 * poll the door's PRESENCE before realClick (the t912 per-surface law,
 * at the door; the t947 Law ① carried) */
const closeDialogs = async () => {
  sh(`${AB} press Escape`);
  await sleep(700);
  const gone = await poll(
    `JSON.stringify({ open: document.querySelectorAll('[role="dialog"]').length > 0 })`,
    (v) => v.open === false, 8, 500,
  );
  return gone?.open === false;
};
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}
/* the compare dialog's verb row, read whole */
const dialogFace = async () => poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('CTF A/B — FOM') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const contractDivs = [...d.querySelectorAll('div')].filter(x => (x.textContent || '').trim().startsWith('Adoption re-wires'));
  const contract = (contractDivs.find(x => x.children.length === 0) ?? contractDivs.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0])?.textContent?.trim() ?? null;
  const plain = d.querySelector('[data-testid="adopt-downstream"]'); return JSON.stringify({ open: true, contract, plain: plain ? { disabled: plain.disabled, label: plain.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null, aria: plain.getAttribute('aria-label'), title: plain.getAttribute('title'), badge: plain.querySelector('span.font-semibold')?.textContent ?? null } : null }); })()`,
  (v) => v.open === true, 12, 600,
);

/* ================================================================== */
console.log("== band P: prep — the mint re-rides, the consumer mints, the world ==");
const ctfA0 = findName(NAME_CTF_A);
let preAP = findName(NAME_AP);
if (preAP) {
  const preE = edges().find((e) => e.toJobId === preAP.id);
  if (preE) api("DELETE", `/api/edges/${preE.id}`);
  const d = api("DELETE", `/api/jobs/${preAP.id}`);
  ok("P a stale consumer deleted (idempotent re-ride)", !d.error || String(d.error).includes("not found"), preAP.id.slice(0, 8));
}
const preAP2 = findName(NAME_AP2);
if (preAP2) {
  const preE2 = edges().find((e) => e.toJobId === preAP2.id);
  if (preE2) api("DELETE", `/api/edges/${preE2.id}`);
  const d2 = api("DELETE", `/api/jobs/${preAP2.id}`);
  ok("P a stale mover deleted (idempotent re-ride)", !d2.error || String(d2.error).includes("not found"), preAP2.id.slice(0, 8));
}
const preMcA0 = findName(NAME_MC_A);
const ctfA0b = findName(NAME_CTF_A);
const seed0 = ctfA0b && preMcA0 ? edges().find((e) => e.fromJobId === preMcA0.id && e.toJobId === ctfA0b.id) : null;
if (!seed0 && ctfA0b && preMcA0) {
  const p = api("POST", "/api/edges", { fromJobId: preMcA0.id, toJobId: ctfA0b.id });
  ok("P the seed MC-A→CTF-A edge back for the mint", !p.error && !!p.edge?.id, p.error ?? p.edge?.id);
}
const mintOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs mint 2>&1`);
ok("P the t922 mint re-rides GREEN", /MINT \d+ pass \/ 0 fail/.test(mintOut), (mintOut.match(/MINT .*/) ?? ["?"])[0]);

const mcA = findName(NAME_MC_A);
const mcB = findName(NAME_MC_B);
const ctfA = findName(NAME_CTF_A);
const ctfB = findName(NAME_CTF_B);
ok("P the four runs aboard and completed", !!mcA && !!mcB && !!ctfA && !!ctfB && [mcA, mcB, ctfA, ctfB].every((j) => j.status === "completed"));
/* stale loop edge off (the t928 law) */
const preLoop = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id);
if (preLoop) { const d = api("DELETE", `/api/edges/${preLoop.id}`); ok("P a stale loop edge deleted (the world starts CLEAN)", !d.error, preLoop.id.slice(0, 8)); }
/* stale wired edges off: after the mint CTF-B has NO outgoing edges in
 * the canonical world — any CTF-B→X edge is a stale wired bucket and
 * would poison the C0 clean face */
const staleWired = edges().filter((e) => e.fromJobId === ctfB.id);
for (const we of staleWired) { const d = api("DELETE", `/api/edges/${we.id}`); ok("P a stale wired edge deleted (the world starts CLEAN)", !d.error, we.id.slice(0, 8)); }

/* the consumer AP (the wired child) */
let ap = findName(NAME_AP);
if (!ap) {
  const mk = api("POST", "/api/jobs", {
    type: "autopick", name: NAME_AP,
    params: { pickingMethod: "Laplacian of Gaussian", logDiamMin: 150, logDiamMax: 180 },
  });
  ok("P the wired child minted", !mk.error && !!mk.job?.id, mk.error ?? mk.job?.id);
  ap = mk.job;
} else {
  ok("P the wired child already aboard (idempotent re-ride)", true, ap.id);
}
const apEdge = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id) ??
  api("POST", "/api/edges", { fromJobId: ctfA.id, toJobId: ap.id }).edge;
ok("P the wire CTF-A→AP", !!apEdge, apEdge?.id ?? "missing");

/* ================================================================== */
console.log("== band C0: the PURE clean face — t926's world, the twin silent ==");
sh(`${AB} set viewport 1280 900`);
await reloadPage();
await openInspector(NAME_CTF_A);
const openC0 = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("C0 the compare dialog opened on the FOM lens", String(openC0).startsWith("open@"), openC0);
const faceC0 = await dialogFace();
ok("C0 the plain adopt verb present and ENABLED", faceC0?.plain?.disabled === false, String(faceC0?.plain?.disabled));
ok("C0 the aria byte-identical to the t926 clean pin (the wired twin EMPTY — the empty-clause law, live)",
  faceC0?.plain?.aria === `Continue downstream from ${NAME_CTF_B} — re-wires 1 of ${NAME_CTF_A}'s downstream jobs`,
  faceC0?.plain?.aria ?? "none");
ok("C0 the title byte-identical to the t926 clean pin",
  faceC0?.plain?.title === `Re-wires ${NAME_CTF_A}'s 1 downstream wire to ${NAME_CTF_B} — their current results stay until re-run`,
  faceC0?.plain?.title ?? "none");
ok("C0 the contract byte-identical to the t926 clean pin",
  faceC0?.contract === `Adoption re-wires ${NAME_CTF_A}'s 1 downstream job to consume ${NAME_CTF_B} — their current results stay until re-run.`,
  faceC0?.contract ?? "none");

/* ================================================================== */
console.log("== band L: the LOOP EDGE — the mixed face returns, the twin still silent ==");
await closeDialogs();
const loopPost = api("POST", "/api/edges", { fromJobId: ctfA.id, toJobId: mcB.id });
ok("L the loop edge CTF-A→MC-B POSTED", !loopPost.error && !!loopPost.edge?.id, loopPost.error ?? loopPost.edge?.id);
const loopEdge = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id);
ok("L the loop edge persists", !!loopEdge, loopEdge?.id ?? "missing");
await reloadPage();
await openInspector(NAME_CTF_A);
const openC = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("C the compare dialog re-opened", String(openC).startsWith("open@"), openC);
const faceC = await dialogFace();
ok("C the aria byte-identical to the t928 mixed pin (refusal spoken, wired silent)",
  faceC?.plain?.aria === `Continue downstream from ${NAME_CTF_B} — re-wires 1 of ${NAME_CTF_A}'s downstream jobs and refuses 1 (cycle)`,
  faceC?.plain?.aria ?? "none");
ok("C the title byte-identical to the t928 mixed pin",
  faceC?.plain?.title === `Re-wires ${NAME_CTF_A}'s 1 downstream wire to ${NAME_CTF_B} — their current results stay until re-run — and refuses 1 (cycle)`,
  faceC?.plain?.title ?? "none");
ok("C the contract byte-identical to the t928 mixed pin",
  faceC?.contract === `Adoption re-wires ${NAME_CTF_A}'s 1 downstream job to consume ${NAME_CTF_B} — their current results stay until re-run. Also refuses 1 downstream wire (cycle) — left consuming ${NAME_CTF_A}.`,
  faceC?.contract ?? "none");

/* ================================================================== */
console.log("== band W: the THIRD BUCKET — the wired edge + the mover, the FULL HOUSE face ==");
await closeDialogs();
/* the wired edge: CTF-B→AP — the SAME port pair as CTF-A→AP (both
 * portless here, the lib's own dup check null==null) */
const wiredPost = api("POST", "/api/edges", { fromJobId: ctfB.id, toJobId: ap.id });
ok("W the wired edge CTF-B→AP POSTED (the multi-input world)", !wiredPost.error && !!wiredPost.edge?.id, wiredPost.error ?? wiredPost.edge?.id);
/* the mover AP2 */
let ap2 = findName(NAME_AP2);
if (!ap2) {
  const mk2 = api("POST", "/api/jobs", {
    type: "autopick", name: NAME_AP2,
    params: { pickingMethod: "Laplacian of Gaussian", logDiamMin: 150, logDiamMax: 180 },
  });
  ok("W the mover AP2 minted", !mk2.error && !!mk2.job?.id, mk2.error ?? mk2.job?.id);
  ap2 = mk2.job;
} else {
  ok("W the mover AP2 already aboard (idempotent re-ride)", true, ap2.id);
}
const ap2Edge = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === ap2.id) ??
  api("POST", "/api/edges", { fromJobId: ctfA.id, toJobId: ap2.id }).edge;
ok("W the wire CTF-A→AP2", !!ap2Edge, ap2Edge?.id ?? "missing");
writeFileSync(STATE, JSON.stringify({ ap: ap.id, ap2: ap2.id, loopEdge: loopEdge?.id ?? null }, null, 2));
await reloadPage();
await openInspector(NAME_CTF_A);
const openW = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("W the compare dialog re-opened on the full-house world", String(openW).startsWith("open@"), openW);
const faceW = await dialogFace();
ok("W the plain adopt verb present and ENABLED (the full house still moves one)", faceW?.plain?.disabled === false, String(faceW?.plain?.disabled));
ok("W THE ARIA speaks the move AND the refusal AND the wired count (the t948 twin, verbatim)",
  faceW?.plain?.aria === `Continue downstream from ${NAME_CTF_B} — re-wires 1 of ${NAME_CTF_A}'s downstream jobs and refuses 1 (cycle) and 1 already on ${NAME_CTF_B} (left as is)`,
  faceW?.plain?.aria ?? "none");
ok("W THE TITLE opens BOTH em-dash clauses (the t931 separator doctrine carried to the twin)",
  faceW?.plain?.title === `Re-wires ${NAME_CTF_A}'s 1 downstream wire to ${NAME_CTF_B} — their current results stay until re-run — and refuses 1 (cycle) — and 1 already on ${NAME_CTF_B} (left as is)`,
  faceW?.plain?.title ?? "none");
ok("W THE CONTRACT closes the accounting: refusal sentence + wired sentence, verbatim",
  faceW?.contract === `Adoption re-wires ${NAME_CTF_A}'s 1 downstream job to consume ${NAME_CTF_B} — their current results stay until re-run. Also refuses 1 downstream wire (cycle) — left consuming ${NAME_CTF_A}. Also 1 job already on ${NAME_CTF_B} (left as is).`,
  faceW?.contract ?? "none");

/* ================================================================== */
console.log("== band F: THE FIRE with the third bucket aboard ==");
const jobsAtFire = jobs().length;
let toastSeen = null;
const firePoll = poll(
  `(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? null, all: t.textContent?.slice(0, 500) ?? '' })); const hit = toasts.find(t => (t.all || '').includes('Downstream adopted by')); return JSON.stringify(hit ? { title: hit.title, all: hit.all } : {}); })()`,
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
        if (es.some((e) => e.fromJobId === ctfB.id && e.toJobId === ap2.id) &&
            !es.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap2.id)) return `fired@try${i}`;
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
  const again = evalJson(`(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => t.textContent?.slice(0, 500) ?? ''); const hit = toasts.find(t => t.includes('Downstream adopted by')); return JSON.stringify(hit ?? null); })()`);
  toastSeen = typeof again === "string" && again !== "null" ? { title: null, all: again } : null;
}
ok("F THE TOAST's title speaks the new father", !!toastSeen?.all && toastSeen.all.includes(`Downstream adopted by ${NAME_CTF_B}`), (toastSeen?.title ?? toastSeen?.all ?? "none").slice(0, 90));
const EXPECT_WIRED = `1 job already on ${NAME_CTF_B} (left as is)`;
ok("F THE TOAST speaks the wired line VERBATIM — exactly what the face pre-announced",
  (toastSeen?.all ?? "").includes(EXPECT_WIRED), (toastSeen?.all ?? "none").slice(0, 320));
ok("F THE TOAST speaks the refusal line verbatim (the t928 law stands beside the twin)",
  (toastSeen?.all ?? "").includes(`${NAME_MC_B} refused — re-wiring would close a loop`), "");
const EXPECT_DETAIL = `1 downstream wire re-wired from ${NAME_CTF_A} to ${NAME_CTF_B} · ${NAME_AP2} now consumes ${NAME_CTF_B} · their current results stay until re-run · ${EXPECT_WIRED} · ${NAME_MC_B} refused — re-wiring would close a loop`;
ok("F THE TOAST's detail carries the FULL three-bucket contract verbatim (the pre-announcement taught this exact sentence)",
  (toastSeen?.all ?? "").includes(EXPECT_DETAIL), (toastSeen?.all ?? "none").slice(0, 420));
const edgesAfterFire = edges();
ok("F the move: CTF-B→AP2 exists", edgesAfterFire.some((e) => e.fromJobId === ctfB.id && e.toJobId === ap2.id));
ok("F the move: CTF-A→AP2 GONE", !edgesAfterFire.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap2.id));
ok("F THE WIRED CHILD LEFT AS IS — CTF-A→AP UNTOUCHED (the lib's both-wires law at the data layer)",
  !!edgesAfterFire.find((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id),
  edgesAfterFire.find((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id)?.id ?? "missing");
ok("F the wired child keeps BOTH upstreams (CTF-B→AP and CTF-A→AP both live)",
  edgesAfterFire.some((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id) &&
  edgesAfterFire.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id));
ok("F THE REFUSAL HELD at the data layer — CTF-A→MC-B UNTOUCHED",
  !!edgesAfterFire.find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id),
  edgesAfterFire.find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id)?.id ?? "missing");
const dialogClosed = await poll(
  `JSON.stringify({ gone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('CTF A/B — FOM')) })`,
  (v) => v.gone === true, 12, 600,
);
ok("F the dialog closes itself (the canvas shows the new wiring)", dialogClosed?.gone === true);

/* ================================================================== */
console.log("== band R: the restore — the world back to the seed trio ==");
sh(`${AB} press Escape`);
await sleep(500);
/* AP2 and its (new) edge off */
const ap2E = edges().find((e) => e.toJobId === ap2.id || e.fromJobId === ap2.id);
if (ap2E) api("DELETE", `/api/edges/${ap2E.id}`);
const dAp2 = api("DELETE", `/api/jobs/${ap2.id}`);
ok("R the mover AP2 deleted", !dAp2.error || String(dAp2.error).includes("not found"), ap2.id.slice(0, 8));
/* the wired edge off */
const wiredEdge = edges().find((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id);
if (wiredEdge) { const d = api("DELETE", `/api/edges/${wiredEdge.id}`); ok("R the wired edge CTF-B→AP deleted", !d.error, wiredEdge.id.slice(0, 8)); }
/* the loop edge off */
const loopEdgeR = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === mcB.id);
if (loopEdgeR) { const d = api("DELETE", `/api/edges/${loopEdgeR.id}`); ok("R the loop edge deleted", !d.error, loopEdgeR.id.slice(0, 8)); }
/* AP off (its A-wire dies with the job or goes first) */
const apE = edges().find((e) => e.toJobId === ap.id);
if (apE) api("DELETE", `/api/edges/${apE.id}`);
const dAp = api("DELETE", `/api/jobs/${ap.id}`);
ok("R the wired child AP deleted", !dAp.error || String(dAp.error).includes("not found"), ap.id.slice(0, 8));
/* the mints off */
const removeOut = sh(`unset DATABASE_URL; node scripts/t922-mint.mjs remove 2>&1`);
ok("R the t922 remove GREEN", /REMOVE \d+ pass \/ 0 fail/.test(removeOut), (removeOut.match(/REMOVE .*/) ?? ["?"])[0]);
await sleep(1200);
await reloadPage();
const finalJobs = jobs();
const finalEdges = edges();
ok("R the world back to the seed trio (3 jobs, 2 edges)", finalJobs.length === 3 && finalEdges.length === 2, `${finalJobs.length} jobs / ${finalEdges.length} edges`);
const doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`);
ok("R the doctor CLEAN at the window end", doctorOut.includes("VERDICT: CLEAN"), (doctorOut.match(/VERDICT.*/) ?? ["?"])[0]);
const smoke = evalJson(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length, overX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 })`);
ok("R the final smoke clean (3 cards, overX 0)", smoke?.cards === 3 && smoke?.overX === false, JSON.stringify(smoke));

/* ================================================================== */
writeReceipt({ pass, fail, at: new Date().toISOString() });
console.log(`\nWIRED-LIVE-WITNESS t948: ${pass}/${pass + fail} ${fail === 0 ? "green — the third bucket speaks before the fire" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
