#!/usr/bin/env node
/**
 * t949 — the MINT PREVIEW, fired live (node-only orchestrator +
 * agent-browser). Carried from t948's entry as candidate (b2): the
 * riders' plans were computed against run B's ID as a stand-in for the
 * not-yet-minted filter — and in the multi-input world (a child of A
 * already consuming B through the same port pair) the stand-in LIED
 * twice: the aria's "re-wires N … onto it" undercounted the fire (the
 * wired child MOVES onto the mint), and with the wired child as A's
 * ONLY downstream the rider rendered DISABLED ("The downstream already
 * consumes B — nothing to adopt") for a fire that would re-wire.
 *
 * The cure is lib-level (t949-mint-preview-unit.mjs GREEN 14/14: the
 * PREVIEW ≡ FIRE equivalence pinned at the brain): planAdoption's
 * mintTargetType skips the dup check and reads the mint's ports. This
 * witness rides the PRODUCT face in exactly that world:
 *
 *   P   the t922 mint re-rides (the four completed runs), the wired
 *       child AP mints (Automated Picking 1 (t949)) and the world
 *       grows the multi-input fact: A→AP AND B→AP. NO new runs — the
 *       plan reads the graph, not the statuses.
 *   E   the SPLIT FACE (one world, two fires, two honest speeches):
 *       the PLAIN verb DISABLED — its fire truly leaves the wired
 *       child as is, and its title says so ("The downstream already
 *       consumes B — nothing to adopt", the t948 world's own speech);
 *       the EXCLUDE rider ENABLED — the cured count ("re-wires 1 of
 *       A's downstream jobs onto it", the wired child counted; the
 *       old stand-in filed it under alreadyWired and hid the rider).
 *   F   THE FIRE through the exclude door: the filter mints (consuming
 *       B, the regressed names baked at birth), AP re-wires onto the
 *       filter (A→AP GONE, filter→AP portless), and B→AP STAYS — the
 *       wired child keeps BOTH its upstreams through the mint's fire
 *       (the both-wires law at the data layer, the t948 proof's
 *       mint-side twin). The toast speaks the adoption contract with
 *       the filter as the new provider — exactly what the rider's
 *       aria counted.
 *   D   the filter's own birth record: params.excludeNames carries the
 *       regressed names (the t925 law — the list the dialog spoke IS
 *       the list the engine filters by).
 *   R   the restore: the filter and its edges off, AP off, the t922
 *       remove GREEN, the seed trio + 2 edges, the census 14/14, the
 *       doctor CLEAN, the final smoke clean.
 *
 *   node scripts/t949-mint-preview-live-witness.mjs main
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t949-mint-preview-live-witness.json";
const STATE = path.join(ROOT, "data", "t949-mint-preview.json");

const NAME_MC_A = "Motion Correction 1";
const NAME_MC_B = "Motion Correction 2 (t922)";
const NAME_CTF_A = "CTF Estimation 1";
const NAME_CTF_B = "CTF Estimation 2 (t922)";
const NAME_AP = "Automated Picking 1 (t949)";

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
/* THE T948 RIDE-1 LAW: the face's plan reads the STORE's edges — edges
 * POSTed on the API plane reach the store only through a fresh page
 * load. Reload after EVERY API-side graph mutation before any door. */
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
const closeDialogs = async () => {
  sh(`${AB} press Escape`);
  await sleep(700);
  await poll(
    `JSON.stringify({ open: document.querySelectorAll('[role="dialog"]').length > 0 })`,
    (v) => v.open === false, 8, 500,
  );
};
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
}
/* the compare dialog's verb row: BOTH verbs read whole (the split face) */
const dialogFace = async () => poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('CTF A/B — FOM') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const contractDivs = [...d.querySelectorAll('div')].filter(x => (x.textContent || '').trim().startsWith('Adoption re-wires'));
  const contract = (contractDivs.find(x => x.children.length === 0) ?? contractDivs.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0])?.textContent?.trim() ?? null;
  const ex = d.querySelector('[data-testid="adopt-with-exclude"]');
  const plain = d.querySelector('[data-testid="adopt-downstream"]');
  return JSON.stringify({ open: true, contract, exclude: ex ? { disabled: ex.disabled, aria: ex.getAttribute('aria-label'), title: ex.getAttribute('title'), label: ex.textContent?.replace(/\\s+/g, ' ')?.trim() ?? null } : null, plain: plain ? { disabled: plain.disabled, aria: plain.getAttribute('aria-label'), title: plain.getAttribute('title') } : null }); })()`,
  (v) => v.open === true, 12, 600,
);

/* ================================================================== */
console.log("== band P: prep — the mint re-rides, the wired child, the multi-input world ==");
const ctfA0 = findName(NAME_CTF_A);
let preAP = findName(NAME_AP);
if (preAP) {
  for (const preE of edges().filter((e) => e.toJobId === preAP.id || e.fromJobId === preAP.id)) api("DELETE", `/api/edges/${preE.id}`);
  const d = api("DELETE", `/api/jobs/${preAP.id}`);
  ok("P a stale consumer deleted (idempotent re-ride)", !d.error || String(d.error).includes("not found"), preAP.id.slice(0, 8));
}
const preMcA0 = findName(NAME_MC_A);
const ctfA0b = findName(NAME_CTF_A);
/* stale mint filter off (idempotent re-ride — ride 1's crash left one) */
for (const pf of jobs().filter((j) => j.type === "excludemg")) {
  for (const fe of edges().filter((e) => e.toJobId === pf.id || e.fromJobId === pf.id)) api("DELETE", `/api/edges/${fe.id}`);
  const d = api("DELETE", `/api/jobs/${pf.id}`);
  ok("P a stale mint filter deleted (idempotent re-ride)", !d.error || String(d.error).includes("not found"), pf.id.slice(0, 8));
}
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
/* the world starts with NO CTF-A/CTF-B outgoing edges (the t948 sweeps) */
for (const we of edges().filter((e) => e.fromJobId === ctfA.id || e.fromJobId === ctfB.id)) {
  const d = api("DELETE", `/api/edges/${we.id}`);
  ok("P a stale outgoing edge deleted (the world starts CLEAN)", !d.error, we.id.slice(0, 8));
}
/* the wired child */
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
const apEdgeA = edges().find((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id) ??
  api("POST", "/api/edges", { fromJobId: ctfA.id, toJobId: ap.id }).edge;
ok("P the wire CTF-A→AP", !!apEdgeA, apEdgeA?.id ?? "missing");
const apEdgeB = edges().find((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id) ??
  api("POST", "/api/edges", { fromJobId: ctfB.id, toJobId: ap.id }).edge;
ok("P THE MULTI-INPUT FACT: the wire CTF-B→AP", !!apEdgeB, apEdgeB?.id ?? "missing");
writeFileSync(STATE, JSON.stringify({ ap: ap.id }, null, 2));

/* ================================================================== */
console.log("== band E: the SPLIT FACE — two fires, two honest speeches, one world ==");
sh(`${AB} set viewport 1280 900`);
await reloadPage();
await openInspector(NAME_CTF_A);
const openE = await openCompareUntil(NAME_CTF_A, "CTF A/B — compare", "CTF A/B — FOM");
ok("E the compare dialog opened on the FOM lens", String(openE).startsWith("open@"), openE);
/* THE RIDE-1 LAW (读脸前先等脸的数据到场 — the t947 door-presence law
 * at the face read): the exclude rider mounts only after the FOM
 * analysis fetch resolves; ride 1 read the face in that window and
 * pinned nothing but empty objects. Wait for the rider's PRESENCE
 * before reading the face whole. */
const riderPresent = await poll(
  `JSON.stringify({ ex: !!document.querySelector('[data-testid="adopt-with-exclude"]') })`,
  (v) => v.ex === true, 30, 600,
);
ok("E the exclude rider's data arrived (the FOM analysis resolved)", riderPresent?.ex === true);
const faceE = await dialogFace();
ok("E the exclude rider PRESENT (the regressed series renders it)", !!faceE?.exclude, faceE?.exclude ? "present" : "missing");
/* THE PLAIN VERB: disabled — its fire truly leaves the wired child as
 * is, and the title says so (the t948 world's own speech) */
ok("E the PLAIN verb DISABLED (the wired child is A's only downstream — nothing to move)",
  faceE?.plain?.disabled === true, String(faceE?.plain?.disabled));
ok("E the PLAIN's disabled title speaks the t948 world verbatim (the downstream already consumes B)",
  faceE?.plain?.title === `The downstream already consumes ${NAME_CTF_B} — nothing to adopt`,
  faceE?.plain?.title ?? "none");
/* THE EXCLUDE RIDER: ENABLED with the CURED count — the wired child
 * counted (the old stand-in filed it under alreadyWired and the rider
 * rendered DISABLED for a fire that re-wires) */
ok("E THE EXCLUDE RIDER ENABLED (the mint preview's cure, live)",
  faceE?.exclude?.disabled === false, String(faceE?.exclude?.disabled));
const EXPECT_EX_ARIA = `Continue downstream from ${NAME_CTF_B} with 3 regressed micrographs excluded — mints an Exclude Micrographs filter and re-wires 1 of ${NAME_CTF_A}'s downstream jobs onto it`;
ok("E THE EXCLUDE ARIA speaks the CURED count verbatim (re-wires 1 — the wired child counted)",
  faceE?.exclude?.aria === EXPECT_EX_ARIA, faceE?.exclude?.aria ?? "none");
ok("E the aria's tail is the fire's own truth (re-wires 1 … onto it — no refusal clause: the mint preview has none)",
  /re-wires 1 of .+'s downstream jobs onto it$/.test(faceE?.exclude?.aria ?? ""), "");
const EXPECT_EX_TITLE = `Bakes the 3 regressed micrographs into an Exclude Micrographs filter consuming ${NAME_CTF_B} (editable in the filter's Exclusions tab), then re-wires ${NAME_CTF_A}'s 1 downstream wire onto the filter — results stay until re-run`;
ok("E THE EXCLUDE TITLE counts the wired child verbatim (1 downstream wire onto the filter)",
  faceE?.exclude?.title === EXPECT_EX_TITLE, faceE?.exclude?.title ?? "none");
ok("E the plain verb's contract line ABSENT (the contract rides only when adoptable)",
  faceE?.contract == null, faceE?.contract ?? "absent");

/* ================================================================== */
console.log("== band F: THE FIRE through the exclude door — the mint's own truth ==");
const jobsAtFire = jobs().length;
let toastSeen = null;
const firePoll = poll(
  `(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? null, all: t.textContent?.slice(0, 500) ?? '' })); const hit = toasts.find(t => (t.all || '').includes('Downstream adopted by')); return JSON.stringify(hit ? { title: hit.title, all: hit.all } : {}); })()`,
  (v) => v && v.all, 40, 500,
);
const fired = await (async () => {
  for (let i = 0; i < 10; i++) {
    const f = await dialogFace();
    if (f?.exclude?.disabled === false) {
      const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('CTF A/B — FOM') && (d.textContent || '').includes('Run A'))?.querySelector('[data-testid="adopt-with-exclude"]')`);
      if (!String(clicked).startsWith("clicked@")) { await sleep(600); continue; }
      for (let w = 0; w < 30; w++) {
        const js = jobs();
        const filter = js.find((j) => j.type === "excludemg");
        const es = edges();
        if (filter && es.some((e) => e.fromJobId === ctfB.id && e.toJobId === filter.id) &&
            es.some((e) => e.fromJobId === filter.id && e.toJobId === ap.id) &&
            !es.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id)) return `fired@try${i}`;
        await sleep(500);
      }
      return `clicked-but-unmoved@try${i}`;
    }
    await sleep(700);
  }
  return "NEVER-FIRED";
})();
ok("F the fire landed (the filter minted, AP re-wired onto it, A→AP gone)", String(fired).startsWith("fired@"), String(fired));
const filterJob = jobs().find((j) => j.type === "excludemg");
ok("F exactly ONE filter minted (jobs +1)", !!filterJob && jobs().length === jobsAtFire + 1, `${jobs().length} (was ${jobsAtFire}) filter=${filterJob?.name ?? "missing"}`);
const edgesAfterFire = edges();
ok("F the feed: CTF-B→filter exists", !!filterJob && edgesAfterFire.some((e) => e.fromJobId === ctfB.id && e.toJobId === filterJob.id));
ok("F THE MOVE: filter→AP exists", !!filterJob && edgesAfterFire.some((e) => e.fromJobId === filterJob.id && e.toJobId === ap.id));
ok("F the move: CTF-A→AP GONE", !edgesAfterFire.some((e) => e.fromJobId === ctfA.id && e.toJobId === ap.id));
ok("F THE BOTH-WIRES LAW THROUGH THE MINT'S FIRE — CTF-B→AP UNTOUCHED (the wired child keeps its B-upstream)",
  !!edgesAfterFire.find((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id),
  edgesAfterFire.find((e) => e.fromJobId === ctfB.id && e.toJobId === ap.id)?.id ?? "missing");
const toastV = await firePoll;
toastSeen = toastV && { title: toastV.title, all: toastV.all };
if (!toastSeen?.all) {
  const again = evalJson(`(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => t.textContent?.slice(0, 500) ?? ''); const hit = toasts.find(t => t.includes('Downstream adopted by')); return JSON.stringify(hit ?? null); })()`);
  toastSeen = typeof again === "string" && again !== "null" ? { title: null, all: again } : null;
}
ok("F THE TOAST's title speaks the FILTER as the new father", !!toastSeen?.all && !!filterJob && toastSeen.all.includes(`Downstream adopted by ${filterJob.name}`), (toastSeen?.title ?? toastSeen?.all ?? "none").slice(0, 90));
const EXPECT_DETAIL = `1 downstream wire re-wired from ${NAME_CTF_A} to ${filterJob?.name ?? "?"} · ${NAME_AP} now consumes ${filterJob?.name ?? "?"} · their current results stay until re-run`;
ok("F THE TOAST's detail carries the ONE-wire contract verbatim (the count the rider's aria spoke)",
  (toastSeen?.all ?? "").includes(EXPECT_DETAIL), (toastSeen?.all ?? "none").slice(0, 320));
const dialogClosed = await poll(
  `JSON.stringify({ gone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('CTF A/B — FOM')) })`,
  (v) => v.gone === true, 12, 600,
);
ok("F the dialog closes itself (the canvas shows the minted wiring)", dialogClosed?.gone === true);

/* ================================================================== */
console.log("== band D: the filter's birth record — the names baked at birth ==");
const filterFresh = filterJob ? (jobs().find((j) => j.id === filterJob.id) ?? null) : null;
const excludeNames = String(filterFresh?.params?.excludeNames ?? "");
ok("D the filter's params.excludeNames carries the regressed names (the t925 birth law)",
  excludeNames.length > 0, excludeNames.slice(0, 120));

/* ================================================================== */
console.log("== band R: the restore — the world back to the seed trio ==");
sh(`${AB} press Escape`);
await sleep(500);
if (filterJob) {
  for (const fe of edges().filter((e) => e.toJobId === filterJob.id || e.fromJobId === filterJob.id)) api("DELETE", `/api/edges/${fe.id}`);
  const d = api("DELETE", `/api/jobs/${filterJob.id}`);
  ok("R the filter deleted", !d.error || String(d.error).includes("not found"), filterJob.id.slice(0, 8));
}
for (const ae of edges().filter((e) => e.toJobId === ap.id || e.fromJobId === ap.id)) api("DELETE", `/api/edges/${ae.id}`);
const dAp = api("DELETE", `/api/jobs/${ap.id}`);
ok("R the wired child AP deleted", !dAp.error || String(dAp.error).includes("not found"), ap.id.slice(0, 8));
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
console.log(`\nMINT-PREVIEW-LIVE-WITNESS t949: ${pass}/${pass + fail} ${fail === 0 ? "green — the rider's count is the fire's own truth" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
