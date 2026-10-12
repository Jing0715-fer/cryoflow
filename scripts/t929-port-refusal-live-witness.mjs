#!/usr/bin/env node
/**
 * t929 — the port refusal's LIVE face on the class graph, through the
 * SELECT RIDER's own combo (carried from t928 as candidate (a)). Every
 * port refusal until now had only the lib's mouth (t928 band G, jiti) —
 * the compare face "cannot produce a port drift (same-type pairs)".
 * But the SELECT rider adopts the MINTED SELECTION, not run B — and a
 * 2D Class Selection declares ONE output (particles) while its host
 * class2d declares TWO (classAverages + particles). The rider's own
 * world IS the port drift the plain face cannot make:
 *
 *   the class graph (the t916+t919 mint law, one ready world):
 *     extract → class2d A (K=4, "t916 class2d witness")
 *                    → t916 select witness (idle, classAverages→classes)
 *     extract → class2d B (K=6, "t919 class2d second witness")  ← THE HOST
 *                    → t929 select child   (classAverages→classes) ← REFUSED
 *                    → t929 inimodel child (particles→particles)   ← MOVES
 *
 *   the rider: host B (K=6) sees all-gained against A (K=4) — the t919
 *   law (host K6 sees all-gained) — so the dialog's CLASS_SPEC grows
 *   "Continue downstream, selecting these (4)". The click mints a 2D
 *   Class Selection consuming A with BOTH mouths (classes←classAverages,
 *   particles←particles), then adoptDownstream(B, selection):
 *     - B→t929 select child leaves through classAverages — the selection
 *       does not declare it — plan.refused[0].reason === "port" LIVE,
 *       the toast speaks "<child> refused — <selection> has no matching
 *       output port" VERBATIM;
 *     - B→t929 inimodel child leaves through particles — declared —
 *       the wire MOVES (the father flips at the wire layer).
 *
 * Bands:
 *   M  the mint: t916 + t919 re-ride, the two children hang off B with
 *      EXPLICIT ports, the lib's mouth computes the rider's plan BEFORE
 *      the face (jiti, the REAL catalog: moves=1 + refused=1 port) and
 *      the plain plan (moves=2 — B's own two ports both align).
 *   C  the rider's face: the dialog's selectPlan already knows (the
 *      aria says "re-wires 1 of B's downstream jobs onto it" while the
 *      plain verb above says "re-wires 2") — the split contract, live.
 *   F  THE FIRE: the rider's combo (mint + two mouths + adopt), the
 *      toast's title AND the FULL detail including the port line
 *      verbatim, nothing minted but the selection, and the data layer:
 *      B→select child UNTOUCHED (the refusal held), B→inimodel GONE,
 *      selection→inimodel born with the same port pair.
 *   D  the persisted face: a fresh reload still holds the moved wire
 *      and the refused wire — server truth, not optimistic paint; the
 *      selection's baked param still speaks "1, 2, 3, 4"; the t916
 *      select witness (A's own child) never noticed the storm.
 *   R  the restore: the rider's selection and both children die, the
 *      t919 remove then the t916 remove (the two-manifest law), the
 *      seed trio + 2 edges, the doctor CLEAN.
 *
 *   node scripts/t929-port-refusal-live-witness.mjs main
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t929-port-refusal-live-witness.json";
const STATE = path.join(ROOT, "data", "t929-port-refusal-live.json");

const NAME_K4 = "t916 class2d witness";
const NAME_K6 = "t919 class2d second witness";
const NAME_T916_SEL = "t916 select witness";
const NAME_SEL_CHILD = "t929 select child";
const NAME_INI_CHILD = "t929 inimodel child";
const COMPARE_TITLE = "Class A/B — Occupancy share";
const DOOR_ARIA = "Class A/B — compare";

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
function writeReceipt(obj) {
  const p = path.join(ROOT, RECEIPT);
  let prev = {};
  try { prev = JSON.parse(readFileSync(p, "utf8")); } catch {}
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...prev, ...obj, at: new Date().toISOString() }, null, 2));
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
/* the class dialog's face: the plain verb, the rider, the contract line.
 * The gate waits for the VERB ROW, not just the dialog shell — the a/b
 * fetch lands after the header paints (the first ride's band C lesson:
 * six asserts read undefined while the spinner still held the stage). */
const dialogFace = async () => poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${COMPARE_TITLE}') && (x.textContent || '').includes('Run A')); if (!d) return JSON.stringify({}); const contractDivs = [...d.querySelectorAll('div')].filter(x => (x.textContent || '').trim().startsWith('Adoption re-wires'));
  const contract = (contractDivs.find(x => x.children.length === 0) ?? contractDivs.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0])?.textContent?.trim() ?? null;
  const plain = d.querySelector('[data-testid="adopt-downstream"]');
  const rider = d.querySelector('[data-testid="adopt-with-select"]'); return JSON.stringify({ open: true, contract,
    plain: plain ? { disabled: plain.disabled, aria: plain.getAttribute('aria-label'), badge: plain.querySelector('span.font-semibold')?.textContent ?? null } : null,
    rider: rider ? { disabled: rider.disabled, aria: rider.getAttribute('aria-label'), title: rider.getAttribute('title'), badge: rider.querySelector('span.font-semibold')?.textContent ?? null } : null }); })()`,
  (v) => v.open === true && v.plain != null, 30, 600,
);

/* ---------------------------------------------------------------- */
console.log("== band M: the mint — the class world grows the two children ==");
/* prep self-healing: a previous RED ride's residue dies first — with
 * or without a manifest (a FATAL'd mint writes none, so the mint's
 * own remove refuses; the fallback deletes by name and sweeps BOTH
 * workdir sides by id suffix — the t915/t916 lesson) */
let healed = 0;
for (const stale of jobs().filter((j) => (j.name ?? "").startsWith("t929 "))) {
  api("DELETE", `/api/jobs/${stale.id}`); healed++;
}
for (const stale of jobs().filter((j) => j.type === "select2d" && j.name !== NAME_T916_SEL && !(j.name ?? "").startsWith("t929 "))) {
  api("DELETE", `/api/jobs/${stale.id}`); healed++;
}
const sweepDirs = (id, types) => {
  const sfx = id.slice(-8);
  for (const base of [path.join(ROOT, "data", "relion"), path.join(ROOT, "services", "mock-cluster", "fs", "projects", "cryoflow")]) {
    try {
      for (const proj of readdirSync(base)) {
        const projDir = path.join(base, proj);
        for (const dir of readdirSync(projDir)) {
          if (types.some((t) => dir.startsWith(`${t}_`) && dir.endsWith(sfx))) {
            try { rmSync(path.join(projDir, dir), { recursive: true, force: true }); console.log(`  sweep ${dir}`); } catch {}
          }
        }
      }
    } catch { /* the base may not exist */ }
  }
};
if (findName(NAME_K6)) {
  let green = false;
  try { green = /== remove GREEN/.test(sh(`unset DATABASE_URL; node scripts/t919-class2d-b-mint.mjs remove 2>&1`)); } catch {}
  if (!green) {
    const b = findName(NAME_K6);
    if (b) { api("DELETE", `/api/jobs/${b.id}`); sweepDirs(b.id, ["class2d"]); healed++; }
  }
}
if (findName(NAME_K4) || findName(NAME_T916_SEL)) {
  let green = false;
  try { green = /== remove GREEN/.test(sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`)); } catch {}
  if (!green) {
    for (const [n, t] of [[NAME_T916_SEL, "select2d"], [NAME_K4, "class2d"], ["t916 extract witness", "extract"], ["t916 pick witness", "autopick"]]) {
      const j = findName(n);
      if (j) { api("DELETE", `/api/jobs/${j.id}`); sweepDirs(j.id, [t]); healed++; }
    }
  }
}
ok("M prep swept (idempotent re-ride)", true, `${healed} stale deleted`);

const mint16 = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs mint 2>&1`);
ok("M the t916 mint re-rides GREEN", /== mint GREEN — \d+ ok, 0 fail ==/.test(mint16), (mint16.match(/== mint.*/) ?? ["?"])[0]);
const mint19 = sh(`unset DATABASE_URL; node scripts/t919-class2d-b-mint.mjs mint 2>&1`);
ok("M the t919 mint re-rides GREEN", /== mint GREEN — \d+ ok, 0 fail ==/.test(mint19), (mint19.match(/== mint.*/) ?? ["?"])[0]);

const k4 = findName(NAME_K4);
const k6 = findName(NAME_K6);
const t916sel = findName(NAME_T916_SEL);
ok("M the two class2d runs aboard (K4 completed, K6 completed, the t916 selection idle)",
  !!k4 && !!k6 && !!t916sel && k4.status === "completed" && k6.status === "completed" && t916sel.status === "idle",
  `K4=${k4?.status} K6=${k6?.status} t916sel=${t916sel?.status}`);

/* the two children hang off B (K6) with EXPLICIT ports */
let selChild = findName(NAME_SEL_CHILD);
if (!selChild) {
  const mk = api("POST", "/api/jobs", { type: "select2d", name: NAME_SEL_CHILD });
  ok("M the select child minted", !mk.error && !!mk.job?.id, mk.error ?? mk.job?.id);
  selChild = mk.job;
}
const eSel = edges().find((e) => e.fromJobId === k6.id && e.toJobId === selChild.id) ??
  api("POST", "/api/edges", { fromJobId: k6.id, toJobId: selChild.id, fromPort: "classAverages", toPort: "classes" }).edge;
ok("M the wire K6→select child carries classAverages→classes (explicit)",
  !!eSel && eSel.fromPort === "classAverages" && eSel.toPort === "classes", JSON.stringify(eSel ?? {}).slice(0, 120));
let iniChild = findName(NAME_INI_CHILD);
if (!iniChild) {
  const mk = api("POST", "/api/jobs", { type: "initialmodel", name: NAME_INI_CHILD });
  ok("M the inimodel child minted", !mk.error && !!mk.job?.id, mk.error ?? mk.job?.id);
  iniChild = mk.job;
}
const eIni = edges().find((e) => e.fromJobId === k6.id && e.toJobId === iniChild.id) ??
  api("POST", "/api/edges", { fromJobId: k6.id, toJobId: iniChild.id, fromPort: "particles", toPort: "particles" }).edge;
ok("M the wire K6→inimodel child carries particles→particles (explicit)",
  !!eIni && eIni.fromPort === "particles" && eIni.toPort === "particles", JSON.stringify(eIni ?? {}).slice(0, 120));

/* the lib's mouth BEFORE the face — the REAL catalog via jiti */
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") }, interopDefault: true });
const adoptLib = await jiti.import(pathToFileURL(path.join(ROOT, "src/lib/adopt-branch.ts")).href);
const wf = await jiti.import(pathToFileURL(path.join(ROOT, "src/lib/workflow.ts")).href);
const portsOf = (type) => (wf.jobType(type)?.outputs ?? []).map((p) => p.name);
const liveJobs = jobs().map((j) => ({ id: j.id, type: j.type, name: j.name }));
const planFor = (toRunId, rider) => adoptLib.planAdoption({
  edges: edges(),
  jobs: liveJobs,
  fromRunId: k6.id,
  toRunId,
  outputPortsOf: (type) =>
    rider && type === k4.type ? portsOf("select2d") : portsOf(type),
});
const riderPlan = planFor(k4.id, true);
ok("M THE RIDER'S PLAN (the dialog's own brain): 1 move + 1 refusal",
  riderPlan.moves.length === 1 && riderPlan.refused.length === 1,
  `moves=${riderPlan.moves.length} refused=${JSON.stringify(riderPlan.refused.map((r) => r.reason))}`);
ok("M the refusal is the PORT bucket on the select child",
  riderPlan.refused[0]?.reason === "port" && riderPlan.refused[0]?.move.child.id === selChild.id,
  riderPlan.refused[0]?.move.child.name ?? "none");
ok("M the move is the inimodel child", riderPlan.moves[0]?.child.id === iniChild.id, riderPlan.moves[0]?.child.name ?? "none");
const plainPlan = planFor(k4.id, false);
ok("M the PLAIN plan moves both (K4's own ports align) — the split the rider's world makes",
  plainPlan.moves.length === 2 && plainPlan.refused.length === 0,
  `moves=${plainPlan.moves.length} refused=${plainPlan.refused.length}`);
const selCountBefore = jobs().filter((j) => j.type === "select2d").length;
const NAME_SEL_JOB = `2D Class Selection ${selCountBefore + 1}`;
const riderReceipt = adoptLib.describeAdoption(riderPlan, NAME_K6, NAME_SEL_JOB);
ok("M the receipt's port line VERBATIM, pinned before the face",
  riderReceipt.detail === `1 downstream wire re-wired from ${NAME_K6} to ${NAME_SEL_JOB} · ${NAME_INI_CHILD} now consumes ${NAME_SEL_JOB} · their current results stay until re-run · ${NAME_SEL_CHILD} refused — ${NAME_SEL_JOB} has no matching output port`,
  riderReceipt.detail.slice(0, 160));
ok("M the world holds 10 jobs (seed trio + t916 chain + B + 2 children)", jobs().length === 10, String(jobs().length));
writeFileSync(STATE, JSON.stringify({ selChild: selChild.id, iniChild: iniChild.id, nameSelJob: NAME_SEL_JOB }, null, 2));

/* ---------------------------------------------------------------- */
console.log("== band C: the rider's face — the split contract, live ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 10, 30);
await settleCensus();
await openInspector(NAME_K6);
const openC = await openCompareUntil(NAME_K6, DOOR_ARIA, COMPARE_TITLE);
ok("C the class compare dialog opened on the Occupancy-share lens", String(openC).startsWith("open@"), openC);
const faceC = await dialogFace();
ok("C the plain adopt verb present and ENABLED (both of B's ports align with A's)",
  faceC?.plain?.disabled === false, String(faceC?.plain?.disabled));
ok("C the plain verb's aria speaks TWO moves",
  faceC?.plain?.aria === `Continue downstream from ${NAME_K4} — re-wires 2 of ${NAME_K6}'s downstream jobs`,
  faceC?.plain?.aria ?? "none");
ok("C the plain contract speaks two downstream jobs",
  faceC?.contract === `Adoption re-wires ${NAME_K6}'s 2 downstream jobs to consume ${NAME_K4} — their current results stay until re-run.`,
  faceC?.contract ?? "none");
ok("C THE RIDER present and ENABLED (its virtual selection moves one and refuses one)",
  faceC?.rider?.disabled === false, String(faceC?.rider?.disabled));
ok("C the rider's aria speaks 4 gained classes, ONE re-wire, AND the refusal (the t931 pre-announcement — the port drift the rider's own world makes)",
  faceC?.rider?.aria === `Continue downstream from ${NAME_K4} with 4 gained classes selected — mints a 2D Class Selection consuming ${NAME_K4} and re-wires 1 of ${NAME_K6}'s downstream jobs onto it and refuses 1 (port)`,
  faceC?.rider?.aria ?? "none");
ok("C the rider's title carries the same split AND the refusal (the t931 em-dash clause)",
  faceC?.rider?.title === `Bakes the 4 gained classes into a 2D Class Selection consuming ${NAME_K4} (editable in its Classes tab), then re-wires ${NAME_K6}'s 1 downstream wire onto the selection — results stay until re-run — and refuses 1 (port)`,
  faceC?.rider?.title ?? "none");

/* ---------------------------------------------------------------- */
console.log("== band F: THE FIRE — mint + two mouths + adopt, the port line live ==");
const jobsAtFire = jobs().length;
const firePoll = poll(
  `(() => { const toasts = [...document.querySelectorAll('[role="status"], [data-sonner-toast], li')].map(t => ({ title: t.querySelector('[data-title]')?.textContent ?? null, all: t.textContent?.slice(0, 500) ?? '' })); const hit = toasts.find(t => (t.all || '').includes('Downstream adopted by')); return JSON.stringify(hit ? { title: hit.title, all: hit.all } : {}); })()`,
  (v) => v && v.all, 60, 500,
);
const fired = await (async () => {
  for (let i = 0; i < 10; i++) {
    const f = await dialogFace();
    if (f?.rider?.disabled === false) {
      const clicked = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${COMPARE_TITLE}') && (d.textContent || '').includes('Run A'))?.querySelector('[data-testid="adopt-with-select"]')`);
      if (!String(clicked).startsWith("clicked@")) { await sleep(600); continue; }
      for (let w = 0; w < 40; w++) {
        const js = jobs();
        const sj = js.find((x) => x.type === "select2d" && x.id !== selChild.id && x.id !== t916sel.id);
        const es = edges();
        if (sj && es.some((e) => e.fromJobId === sj.id && e.toJobId === iniChild.id) &&
            !es.some((e) => e.fromJobId === k6.id && e.toJobId === iniChild.id)) return { state: `fired@try${i}`, selJob: sj };
        await sleep(500);
      }
      return { state: `clicked-but-unmoved@try${i}` };
    }
    await sleep(700);
  }
  return { state: "NEVER-FIRED" };
})();
ok("F the fire landed (the selection minted, the move POSTed, the old wire GONE)",
  String(fired.state).startsWith("fired@"), fired.state);
const selJob = fired.selJob;
ok("F the mint is exactly ONE new job (the selection — the combo's own product)",
  jobs().length === jobsAtFire + 1, `${jobs().length} (was ${jobsAtFire})`);
ok("F the selection's name follows the type-count law",
  selJob?.name === NAME_SEL_JOB, selJob?.name ?? "none");
ok("F the gained classes baked at birth ('1, 2, 3, 4' — the list the dialog spoke)",
  JSON.stringify(selJob?.params?.selectedClasses ?? selJob?.selectedClasses ?? null) === JSON.stringify("1, 2, 3, 4"),
  String(selJob?.params?.selectedClasses ?? selJob?.selectedClasses ?? "none"));
const edgesF = edges();
ok("F the selection consumes A through BOTH mouths (classes←classAverages, particles←particles)",
  edgesF.some((e) => e.fromJobId === k4.id && e.toJobId === selJob.id && e.fromPort === "classAverages" && e.toPort === "classes") &&
  edgesF.some((e) => e.fromJobId === k4.id && e.toJobId === selJob.id && e.fromPort === "particles" && e.toPort === "particles"),
  `${edgesF.filter((e) => e.toJobId === selJob.id).length} wires into the selection`);
ok("F the move: selection→inimodel exists (particles→particles, the pair kept)",
  edgesF.some((e) => e.fromJobId === selJob.id && e.toJobId === iniChild.id && e.fromPort === "particles" && e.toPort === "particles"));
ok("F the move: K6→inimodel GONE", !edgesF.some((e) => e.fromJobId === k6.id && e.toJobId === iniChild.id));
ok("F THE REFUSAL HELD at the data layer — K6→select child (classAverages→classes) UNTOUCHED",
  !!edgesF.find((e) => e.fromJobId === k6.id && e.toJobId === selChild.id && e.fromPort === "classAverages" && e.toPort === "classes"),
  edgesF.find((e) => e.fromJobId === k6.id && e.toJobId === selChild.id)?.id ?? "missing");
const toastV = await firePoll;
const toastSeen = toastV && toastV.all ? toastV : null;
ok("F THE TOAST's title speaks the selection as the new father",
  !!toastSeen?.all && toastSeen.all.includes(`Downstream adopted by ${NAME_SEL_JOB}`),
  (toastSeen?.title ?? toastSeen?.all ?? "none").slice(0, 90));
const EXPECT_DETAIL = `1 downstream wire re-wired from ${NAME_K6} to ${NAME_SEL_JOB} · ${NAME_INI_CHILD} now consumes ${NAME_SEL_JOB} · their current results stay until re-run · ${NAME_SEL_CHILD} refused — ${NAME_SEL_JOB} has no matching output port`;
ok("F THE TOAST's detail carries THE PORT LINE verbatim (the prize)",
  (toastSeen?.all ?? "").includes(EXPECT_DETAIL) || (toastSeen?.all ?? "").includes(`${NAME_SEL_CHILD} refused — ${NAME_SEL_JOB} has no matching output port`),
  (toastSeen?.all ?? "none").slice(0, 260));
const dialogClosed = await poll(
  `JSON.stringify({ gone: ![...document.querySelectorAll('[role="dialog"]')].some(d => (d.textContent || '').includes('${COMPARE_TITLE}')) })`,
  (v) => v.gone === true, 12, 600,
);
ok("F the dialog closes itself (the canvas shows the minted selection and the new wiring)", dialogClosed?.gone === true);

/* ---------------------------------------------------------------- */
console.log("== band D: the persisted face — the reload keeps both truths ==");
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 11, 30);
await settleCensus();
const edgesD = edges();
ok("D after reload the moved wire stands (selection→inimodel)",
  edgesD.some((e) => e.fromJobId === selJob.id && e.toJobId === iniChild.id && e.fromPort === "particles"));
ok("D after reload THE REFUSAL STILL HOLDS (K6→select child, classAverages→classes — server truth)",
  edgesD.some((e) => e.fromJobId === k6.id && e.toJobId === selChild.id && e.fromPort === "classAverages" && e.toPort === "classes"));
const selJobAfter = jobs().find((x) => x.id === selJob.id);
ok("D the selection's baked param survived the reload",
  JSON.stringify(selJobAfter?.params?.selectedClasses ?? null) === JSON.stringify("1, 2, 3, 4"),
  String(selJobAfter?.params?.selectedClasses ?? "none"));
const t916selAfter = findName(NAME_T916_SEL);
ok("D the t916 select witness never noticed (idle, still A's child through classAverages)",
  t916selAfter?.status === "idle" && edgesD.some((e) => e.fromJobId === k4.id && e.toJobId === t916selAfter.id && e.fromPort === "classAverages"));

/* ---------------------------------------------------------------- */
console.log("== band R: the restore — the combo's products die, the mints unwind, the doctor CLEAN ==");
sh(`${AB} set viewport 1280 900`);
try { sh(`${AB} close`); } catch {}
for (const [label, id] of [["the select child", selChild.id], ["the inimodel child", iniChild.id], ["the rider's selection", selJob.id]]) {
  const d = api("DELETE", `/api/jobs/${id}`);
  ok(`R ${label} deleted (its wires cascade)`, !d.error || String(d.error).includes("not found"), d.error ?? "gone");
}
let rm19 = "";
try { rm19 = sh(`unset DATABASE_URL; node scripts/t919-class2d-b-mint.mjs remove 2>&1`); } catch (e) { rm19 = String(e); }
ok("R the t919 remove GREEN (B first — the two-manifest law)", /== remove GREEN — \d+ ok, 0 fail ==/.test(rm19), (rm19.match(/== remove.*/) ?? ["?"])[0]);
let rm16 = "";
try { rm16 = sh(`unset DATABASE_URL; node scripts/t916-class2d-mint.mjs remove 2>&1`); } catch (e) { rm16 = String(e); }
ok("R the t916 remove GREEN (the chain unwinds)", /== remove GREEN — \d+ ok, 0 fail ==/.test(rm16), (rm16.match(/== remove.*/) ?? ["?"])[0]);
ok("R the world back to the seed trio (3 jobs)", jobs().length === 3, String(jobs().length));
ok("R the world holds exactly 2 edges", edges().length === 2, String(edges().length));
let doctorOut = "";
try { doctorOut = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1`); } catch (e) { doctorOut = String(e); }
ok("R the doctor CLEAN", /VERDICT: CLEAN/.test(doctorOut), (doctorOut.match(/VERDICT: .*/) ?? ["?"])[0]);

writeReceipt({
  main: {
    pass, fail,
    portLaw: "select2d declares ONE output (particles); the classAverages wire refuses, the particles wire moves",
    faces: {
      riderAria: `Continue downstream from ${NAME_K4} with 4 gained classes selected — mints a 2D Class Selection consuming ${NAME_K4} and re-wires 1 of ${NAME_K6}'s downstream jobs onto it and refuses 1 (port)`,
      riderTitle: `Bakes the 4 gained classes into a 2D Class Selection consuming ${NAME_K4} (editable in its Classes tab), then re-wires ${NAME_K6}'s 1 downstream wire onto the selection — results stay until re-run — and refuses 1 (port)`,
      toastDetail: EXPECT_DETAIL,
      libPortLine: `${NAME_SEL_CHILD} refused — ${NAME_SEL_JOB} has no matching output port`,
    },
    dataPlane: { refusalHeld: true, movedWire: `${NAME_SEL_JOB} → ${NAME_INI_CHILD}`, bakedParam: "1, 2, 3, 4" },
    at: new Date().toISOString(),
  },
});
console.log(`== t929 witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail ==`);
process.exit(fail === 0 ? 0 : 1);
