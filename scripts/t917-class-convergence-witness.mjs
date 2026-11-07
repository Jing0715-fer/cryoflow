#!/usr/bin/env node
/**
 * t917 — the class CONVERGENCE face's LIVE WITNESS (the t917 entry's
 * first candidate): the world's first class2d (the t916 mint — ready
 * law) ran 3 rounds (the seed round writes a FULL product set, so the
 * ladder is [0,1,2]) and the convergence dialog — the compare family's
 * FOURTH question, one run vs its OWN iterations — has never been ridden
 * live. The face + the t455 continue VERB (the face's one mutation) +
 * the class-iteration-gallery ride this window:
 *
 *   C (wide 1280, born-at-band) — the face speaks the LAW:
 *     C1  the door (History icon) present on the completed class2d's
 *         inspector, its aria-label counting the route's own ladder (3)
 *     C2  the dialog opens on the WHOLE ARC: Round A "Round 000" vs
 *         Round B "Round 002" (defaultRoundPair), the t804 region named
 *     C3  the verdict chips speak the (p*7+it)%K+1 law's deltas exactly
 *     C4  the identity scatter renders inside the region
 *     C5  the mover lists carry the law's a→b percentages
 *     C6  the census sentence computed from the formula, verbatim
 *     C7  the t455 verb row speaks its plan: Resumes from Round 002 ·
 *         2 + 5 → 7 iterations total (EM options 5/10/25, +5 pressed)
 *   P (the pickers) — the reversed pair mirrors the truth; Esc → reopen
 *     restores the whole arc (NO PERSISTENCE law)
 *   V (the verb FIRES — the t455 machinery's first live ride):
 *     V1  "Continue the run" (default +5) → the dialog steps aside, the
 *         job re-runs on its OWN lane (the cluster), completes
 *     V2  the world's receipt: params.iterations === 7 (RELION's --iter
 *         is the TOTAL), the ladder EXTENDED to 8 rounds [0..7] — the
 *         route's live growth curve recorded as the gallery's heartbeat
 *     V3  the face re-reads the extended arc: default (000, 007),
 *         1 gained / 1 lost / 2 held, the verb resumes Round 007
 *     G   the class-iteration-gallery: 8 chips, chip-click switches the
 *         sheet, the sheet img decodes
 *   W (world guard): the continue verb creates NO job — the count is
 *     unchanged; the mint's remove returns the world after.
 *
 * RIDE LAWS inherited: born-at-band (t910); per-surface presence polls
 * (t912); click-time vis/own re-probe + the clamped-point law DENSIFIED
 * to the 1px edge (t917 — the canvas stacks new cards with a 2–3px
 * cascade offset; the buried card's sliver IS the 1–2px rim); the settle
 * law (t911); the ghost-tab law (t916); CLICK-UNTIL-EFFECT on every
 * dialog door (t917's own ride lesson: the action cluster re-renders
 * under the live poll — a hit-test-clean click can land on a neighbor
 * that moved into the point; the door is clicked again until the dialog
 * ITSELF says open); a page RESET between acts (dialogs left open by a
 * failed step poisoned every later poll — the t917 ride2 lesson);
 * an instrument measures the LAWS, never its author's memory (t915 —
 * every expected number is computed from the assignment formula here).
 *
 * t945 RE-KEY — THE WITNESS MINTS ITS OWN VARIANT. The t921 window
 * re-keyed the t916 chain's extract to 60 particles, and 60 is DIVISIBLE
 * by the chain class2d's K=4: the assignment law (p*7+it)%K+1 with
 * gcd(7,4)=1 turns uniform-p into uniform-occupancy at EVERY round
 * (15/15/15/15 forever — the assignment is BORN settled). This witness's
 * mover-based pins (the a→b percentages, the census's biggest note, the
 * extended arc's gained/lost) starved — the first re-ride since t921
 * crashed on an empty lost list. The cure rides the t919 doctrine ("the
 * mint can mint a SECOND class2d with a different K"): the witness mints
 * its OWN class2d off the chain's extract with K=8 — 60 = 7×8+4 gives
 * per-round counts {8,8,8,8,7,7,7,7} that ROTATE per iteration, so every
 * pair carries a real gain and a real loss (±1.67pp, above the 1.0pp
 * motion bar) and the census's biggest note speaks a REAL sign — which
 * is exactly the live fire the t945 two-minus re-key needs. The chain's
 * K=4 pins are untouched; the variant is the witness's own litter and
 * the witness sweeps it (both sides, the t919 remove's law) before it
 * exits — the t916 chain stays for the style witness and the B mint.
 *
 *   node scripts/t917-class-convergence-witness.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const MANIFEST = path.join(ROOT, "data", "t916-class2d-mint.json");
const RECEIPT = "shots-qa/t917-class-convergence-witness.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000, cwd: ROOT }).trim();
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
  // the clamped-point law DENSIFIED (t914 → t916 → t917): the grid walks
  // the 1px rim — the canvas stacks new cards with a 2–3px cascade
  // offset, so the buried card's sliver IS the 1–2px edge; the 6/14/26
  // rings of the older grid never touch it. A late-mounting element (a
  // Radix portal mid-animation) is retried, not abandoned.
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
const inspectorTabExpr = (name, match) =>
  `[...([...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}'))?.querySelectorAll('[role="tab"]') ?? [])].find(t => ${match})`;
const clickTabUntilActive = async (name, match, label) => {
  for (let i = 0; i < 4; i++) {
    await realClick(inspectorTabExpr(name, match));
    const active = await poll(
      `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); const hit = d ? [...d.querySelectorAll('[role="tab"]')].find(t => ${match}) : null; return JSON.stringify({ active: !!hit && hit.dataset.state === 'active' }); })()`,
      (v) => v.active === true, 6, 400
    );
    if (active?.active === true) return `active@try${i + 1}`;
    await sleep(400);
  }
  return "NEVER-ACTIVE";
};
const dumpDialogs = () => {
  try {
    const titles = evalJson(`JSON.stringify([...document.querySelectorAll('[role="dialog"]')].map(d => (d.querySelector('h2,h1,[data-slot="dialog-title"]')?.textContent || d.textContent || '').trim().slice(0, 60)))`);
    console.log(`      [dialogs open: ${titles}]`);
  } catch { console.log("      [dialogs: unreadable]"); }
};
const closeAllDialogs = async () => {
  for (let i = 0; i < 4; i++) {
    const n = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="dialog"]').length })`);
    if ((n?.n ?? 0) === 0) return i;
    sh(`${AB} press Escape`);
    await sleep(450);
  }
  return 4;
};
/** a clean slate between acts: close every dialog, reload the page, wait
 *  for the canvas. A failed step's leftover dialogs poisoned the ride2's
 *  later phases — the reset makes every act born-fresh. */
const resetPage = async (minCards) => {
  await closeAllDialogs();
  sh(`${AB} open ${BASE}/`);
  await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= minCards, 30);
  await settleCensus();
};
const openInspector = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true
  );
  ok(`inspector open for "${name}"`, opened?.open === true);
  const strip = await poll(
    `JSON.stringify({ tabs: [...document.querySelectorAll('[role="tab"]')].map(t => (t.textContent || '').trim()).filter(Boolean) })`,
    (v) => (v.tabs ?? []).length >= 3, 40, 750
  );
  ok(`the inspector's tab strip mounted (${(strip?.tabs ?? []).join("/")})`, (strip?.tabs ?? []).length >= 3);
  return opened;
};
const CONV_TITLE = "Class convergence — Occupancy share";
const doorExpr = (name) => `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${name}')); return d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Class convergence — read this run')) : null; })()`;
/** CLICK-UNTIL-EFFECT (the ride2 lesson: the action cluster re-renders
 *  under the live poll; a hit-test-clean click can be eaten by a neighbor
 *  that moved into the point between the probe and the mouse down). The
 *  door is clicked again — closing whatever opened instead — until the
 *  CONVERGENCE dialog ITSELF says open. */
const openConvergenceDialog = async (name) => {
  for (let i = 0; i < 4; i++) {
    const clicked = await realClick(doorExpr(name));
    const opened = await poll(
      `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); return JSON.stringify({ open: !!dlg }); })()`,
      (v) => v.open === true, 5, 500
    );
    if (opened?.open === true) return `open@try${i + 1} (click ${clicked})`;
    if (i < 3) { await closeAllDialogs(); await openInspectorQuiet(name); }
  }
  dumpDialogs();
  return "NEVER-OPEN";
};
/** a quiet inspector re-open for the door-retry cycle (no asserts — the
 *  surrounding law asserts once). */
const openInspectorQuiet = async (name) => {
  await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 16, 500
  );
};

// ---- the ground truth: the mint manifest + the assignment LAW -------------
if (!existsSync(MANIFEST)) { console.log("FATAL: no mint manifest — run t916-class2d-mint.mjs mint first"); process.exit(2); }
const mint = JSON.parse(readFileSync(MANIFEST, "utf8"));
const ORIGIN = `-H "Origin: ${BASE}"`;
const shApi = (url) => execSync(`curl -s ${ORIGIN} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
const api = (method, url, body) => {
  const out = execSync(`curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
  try { return JSON.parse(out); } catch { return { error: out.slice(0, 200) }; }
};
const jobsApi = () => api("GET", "/api/jobs").jobs ?? [];
const bindingOf = () => {
  try {
    const reg = JSON.parse(readFileSync(path.join(ROOT, "data", "projects.json"), "utf8"));
    return reg.projects?.[reg.active]?.remote?.connectionId ?? null;
  } catch { return null; }
};
/** the t921 law: the resolved Mock Cluster body rides EVERY run
 *  explicitly — a bare POST takes the LOCAL lane on an unbound world. */
function mockClusterConn() {
  const conns = api("GET", "/api/remote/connections").connections ?? [];
  const conn = conns.find((c) => c.name === "Mock Cluster");
  if (conn) return { conn, created: false };
  const mk = api("POST", "/api/remote/connections", {
    name: "Mock Cluster",
    host: "127.0.0.1",
    port: 3022,
    username: "cryo",
    password: "demo",
    authMethod: "password",
    remoteRoot: "/projects/cryoflow",
    useSlurm: true,
    defaultModule: "relion/5.0.1",
  });
  return { conn: mk.connection ?? mk.job ?? null, created: true };
}
let REMOTE_BODY = null;
async function pollUntil(jobId, timeoutMs = 300_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = jobsApi().find((x) => x.id === jobId);
    if (!j) return { status: "VANISHED" };
    if (["completed", "failed", "cancelled"].includes(j.status)) return j;
    await sleep(2500);
  }
  return { status: "TIMEOUT" };
}

// the world's guards + THE VARIANT MINT (the t919 doctrine, inlined)
const chainAlive = jobsApi().some((j) => j.id === mint.extract.id && j.status === "completed");
if (!chainAlive) { console.log("FATAL: the t916 chain's extract is not completed — mint the chain first"); process.exit(2); }
const staleVariant = jobsApi().filter((j) => (j.name ?? "").includes("t917 convergence class2d"));
if (staleVariant.length > 0) { console.log(`FATAL: ${staleVariant.length} stale t917 variant(s) — remove first`); process.exit(2); }
const binding0 = bindingOf();
ok("guard: binding untouched at mint time", binding0 === (mint.binding ?? null), `binding=${binding0}`);
const { conn, created } = mockClusterConn();
ok("guard: Mock Cluster connection present", !!conn?.id, `${created ? "created" : "reused"} ${conn?.id?.slice(0, 14) ?? "NONE"}`);
if (!conn?.id) { console.log("FATAL: no Mock Cluster connection — cannot ride"); process.exit(2); }
REMOTE_BODY = { remote: { connectionId: conn.id, module: "relion/5.0.1", mode: "slurm" } };
const preVariantCount = jobsApi().length;
const variant = api("POST", "/api/jobs", {
  type: "class2d",
  name: "t917 convergence class2d",
  params: { algorithm: "em", iterations: 2, numClasses: 8 },
});
ok("the K=8 variant node created", !!variant.job?.id, variant.job?.id?.slice(-8) ?? JSON.stringify(variant).slice(0, 120));
if (!variant.job?.id) process.exit(2);
const eV = api("POST", "/api/edges", { fromJobId: mint.extract.id, toJobId: variant.job.id });
ok("edge extract→K=8 variant", !eV.error, JSON.stringify(eV).slice(0, 120));
const rV = api("POST", `/api/jobs/${variant.job.id}/run`, REMOTE_BODY);
ok("the K=8 variant run accepted (the remote lane, the t921 law)", !rV.error, rV.error ?? rV.job?.status);
const doneV = await pollUntil(variant.job.id);
ok("the K=8 variant completed", doneV.status === "completed", `status=${doneV.status} ${String(doneV.result ?? "").slice(0, 140)}`);
if (doneV.status !== "completed") { console.log("FATAL: the variant did not complete — remove it by hand (DELETE /api/jobs/<id> + sweep class2d_<suffix>)"); process.exit(2); }

const C2D_ID = variant.job.id;
const C2D_NAME = "t917 convergence class2d";
/** t945 — the witness's OWN K: 8 (60 = 7×8+4 — the rotating non-uniform
 *  occupancy; the chain's K=4 stays pinned by ITS instruments). */
const K = 8;
const ROWS = mint.expect.rows;
// the API is the truth — the jobs LIST is the world's mouth
const jobById = (id) => {
  const d = JSON.parse(shApi("/api/jobs"));
  return (d.jobs ?? []).find((j) => j.id === id) ?? null;
};

// the LAW: the mock's assignment formula — occupancy is COMPUTABLE
const lawOcc = (it) => {
  const counts = Object.fromEntries(Array.from({ length: K }, (_, i) => [i + 1, 0]));
  for (let p = 0; p < ROWS; p++) counts[((p * 7 + it) % K) + 1] += 1;
  return counts;
};
const pad3 = (n) => String(n).padStart(3, "0");
const roundLabel = (r) => `Round ${pad3(r)}`;

// the route is the truth: every round the ladder names must match the law
const ladder0 = JSON.parse(shApi(`/api/jobs/${C2D_ID}/iterations`)).iterations ?? [];
ok("the route's ladder matches the law's rounds (0..2 — the seed writes a full set)",
  JSON.stringify(ladder0) === JSON.stringify([0, 1, 2]), JSON.stringify(ladder0));
for (const r of ladder0) {
  const cls = JSON.parse(shApi(`/api/jobs/${C2D_ID}/classes?iter=${r}`));
  const got = Object.fromEntries((cls.classes ?? []).map((c) => [c.cls, c.count]));
  ok(`?iter=${r} occupancy matches the (p*7+it)%K+1 law`, JSON.stringify(got) === JSON.stringify(lawOcc(r)), JSON.stringify(got));
}

// the pair reader — every expected number computed, nothing remembered
const pairStats = (a, b) => {
  const oa = lawOcc(a), ob = lawOcc(b);
  const deltas = Array.from({ length: K }, (_, i) => {
    const cls = i + 1;
    const pa = (oa[cls] / ROWS) * 100, pb = (ob[cls] / ROWS) * 100;
    const d = pb - pa;
    return { cls, name: `Class ${pad3(cls)}`, a: pa, b: pb, delta: d, kind: d > 0 ? "improved" : d < 0 ? "regressed" : "tied" };
  });
  const gained = deltas.filter((x) => x.kind === "improved");
  const lost = deltas.filter((x) => x.kind === "regressed");
  const held = deltas.filter((x) => x.kind === "tied");
  const sorted = [...deltas.map((x) => x.delta)].sort((x, y) => x - y);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const movers = deltas.filter((x) => Math.abs(x.delta) > 1.0);
  const biggest = [...deltas].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))[0]; // stable: ties keep the deltas' class order
  const settledShare = (deltas.length - movers.length) / deltas.length;
  const ending = movers.length === 0 ? "the assignment has settled" : settledShare >= 0.9 ? "the assignment is mostly settled" : "the assignment is still re-shuffling";
  // t945 re-key — the census's biggest note now speaks the FAMILY's sign
  // (fmtDelta's U+2212 minus), not toFixed's ASCII hyphen: one dialog,
  // one minus convention. The formula mirrors fmtDelta exactly (sign ""
  // at exactly 0, Math.abs().toFixed(1) for the magnitude).
  const census = `Convergence census: ${movers.length} of ${deltas.length} classes moved more than 1.0 pp between ${roundLabel(a)} and ${roundLabel(b)}${movers.length > 0 ? ` (biggest: ${biggest.name}, ${biggest.delta > 0 ? "+" : biggest.delta < 0 ? "\u2212" : ""}${Math.abs(biggest.delta).toFixed(1)} pp)` : ""} — ${ending}.`;
  return { deltas, gained, lost, held, median, census };
};
const fmt1 = (v) => v.toFixed(1);
const convText = `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); return JSON.stringify({ text: dlg ? (dlg.textContent || '') : '' }); })()`;
const moversGrab = `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); const blocks = dlg ? [...dlg.querySelectorAll('.rounded-lg.border.p-2\\\\.5')] : []; const grab = (t) => { const b = blocks.find(x => (x.textContent || '').includes(t)); return b ? (b.textContent || '') : ''; }; return JSON.stringify({ gains: grab('Biggest gains'), losses: grab('Biggest losses') }); })()`;

// ---- band C: 1280 wide, born at band — the convergence face ---------------
console.log("== band C: 1280 wide, born at band (the face speaks the law) ==");
sh(`${AB} set viewport 1280 900`);
// t945 re-key — the world is the seed trio + the t916 chain + the K=8
// variant (8 cards), not the 15-job bound world this seat was born in.
await resetPage(8);

await openInspector(C2D_NAME);

// C1 — the door: the History icon, its label counting the ROUTE's ladder
const door = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${C2D_NAME}')); const b = d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Class convergence — read this run')) : null; return JSON.stringify({ found: !!b, label: b ? b.getAttribute('aria-label') : null }); })()`,
  (v) => v.found === true, 60, 750
);
ok(`C1 the convergence door present, counting its own ${ladder0.length} rounds`,
  door?.found === true && door?.label === `Class convergence — read this run's occupancy across its own ${ladder0.length} iterations`, door?.label ?? "absent");

// C2 — CLICK-UNTIL-EFFECT: the dialog opens on the WHOLE ARC
const doorOpened = await openConvergenceDialog(C2D_NAME);
ok("C2 the convergence dialog OPEN (click-until-effect)", String(doorOpened).startsWith("open@"), doorOpened);
const conv = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); if (!dlg) return JSON.stringify({ open: false }); const region = dlg.querySelector('[role="region"][aria-label="Class convergence reading — verdict, scatter, movers, census"]'); const trig = [...dlg.querySelectorAll('[role="combobox"]')].map(t => (t.textContent || '').trim()); return JSON.stringify({ open: true, region: !!region, trig }); })()`,
  (v) => v.open === true, 12, 500
);
ok("C2 the t804 region present (role=region, its own name)", conv?.open === true && conv?.region === true);
ok("C2 the default pair is the WHOLE ARC (A=Round 000, B=Round 002)",
  conv?.trig?.[0] === "Round 000" && conv?.trig?.[1] === "Round 002", JSON.stringify(conv?.trig ?? []));

const S0 = pairStats(0, 2);
const face0 = await poll(convText, (v) => (v.text || "").includes("paired"), 20, 750);

// C3 — the verdict chips speak the law's deltas exactly
ok(`C3 the chips speak ${S0.gained.length} gained`, (face0?.text ?? "").includes(`${S0.gained.length} gained`));
ok(`C3 the chips speak ${S0.lost.length} lost`, (face0?.text ?? "").includes(`${S0.lost.length} lost`));
ok(`C3 the chips speak ${S0.held.length} held`, (face0?.text ?? "").includes(`${S0.held.length} held`));
ok("C3 the median Δ 0.0% (the law's symmetric swap)", (face0?.text ?? "").includes("median Δ 0.0%"));
// t945 re-key — the pair count is the WITNESS'S OWN K (the "4" was the
// chain's K leaking into a computed pin; the variant rides K=8)
ok(`C3 of ${K} paired, no unpaired chip`, (face0?.text ?? "").includes(`of ${K} paired`) && !(face0?.text ?? "").includes("unpaired:"));

// C4 — the identity scatter renders (recharts' own surface, K paired symbols)
const scatter = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); const wrap = dlg ? dlg.querySelector('.recharts-wrapper') : null; const syms = dlg ? dlg.querySelectorAll('.recharts-scatter-symbol').length : 0; return JSON.stringify({ chart: !!wrap, syms, label: wrap ? ((wrap.querySelector('.recharts-surface')?.getAttribute('aria-label') ?? '') || 'surface') : null }); })()`,
  (v) => v.chart === true, 20, 750
);
ok("C4 the identity scatter renders (recharts surface present)", scatter?.chart === true);
ok("C4 the paired symbols speak the law (>= K drawn)", (scatter?.syms ?? 0) >= K, `symbols=${scatter?.syms}`);

// C5 — the mover lists carry the law's a→b percentages
const movers0 = await poll(moversGrab, (v) => (v.gains || "").length > 0 && (v.losses || "").length > 0, 20, 750);
const gainNames = S0.gained.map((g) => g.name);
const lossNames = S0.lost.map((g) => g.name);
ok("C5 the gains list names the law's gainers", gainNames.every((n) => (movers0?.gains ?? "").includes(n)), `wants ${gainNames.join(",")}`);
ok("C5 the losses list names the law's losers", lossNames.every((n) => (movers0?.losses ?? "").includes(n)), `wants ${lossNames.join(",")}`);
const lossTop = S0.lost[0];
ok(`C5 the losses' item speaks the a→b percentages (${fmt1(lossTop.a)}% → ${fmt1(lossTop.b)}%)`,
  (movers0?.losses ?? "").includes(`${fmt1(lossTop.a)}% → ${fmt1(lossTop.b)}%`));
const gainTop = S0.gained[0];
ok(`C5 the gains' item speaks the a→b percentages (${fmt1(gainTop.a)}% → ${fmt1(gainTop.b)}%)`,
  (movers0?.gains ?? "").includes(`${fmt1(gainTop.a)}% → ${fmt1(gainTop.b)}%`));

// C6 — the census sentence, computed from the formula, verbatim
ok("C6 the census sentence verbatim (computed, not remembered)", (face0?.text ?? "").includes(S0.census), S0.census);

// C7 — the t455 verb row speaks its plan (EM options 5/10/25, +5 pressed)
const verb0 = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); if (!dlg) return JSON.stringify({}); const row = [...dlg.querySelectorAll('div')].find(x => (x.textContent || '').includes('Continue with more iterations')); const chips = row ? [...row.querySelectorAll('button')].filter(b => /^\\+\\d+$/.test((b.textContent || '').trim())) : []; return JSON.stringify({ present: !!row, chips: chips.map(b => ({ t: (b.textContent || '').trim(), pressed: b.getAttribute('aria-pressed') })), text: row ? (row.textContent || '') : '' }); })()`,
  (v) => v.present === true, 20, 750
);
ok("C7 the continue verb row present", verb0?.present === true);
ok("C7 the EM options +5/+10/+25, +5 default-pressed", JSON.stringify((verb0?.chips ?? []).map((c) => c.t)) === JSON.stringify(["+5", "+10", "+25"]) && verb0?.chips?.[0]?.pressed === "true", JSON.stringify(verb0?.chips ?? []));
ok("C7 the plan line: Resumes from Round 002 · 2 + 5 → 7 total",
  (verb0?.text ?? "").includes("Resumes from Round 002") && (verb0?.text ?? "").includes("2 + 5 → 7") && (verb0?.text ?? "").includes("TOTAL"), (verb0?.text ?? "").slice(0, 220));

// P — the reversed pair mirrors the truth; Esc → reopen restores the arc
console.log("== the pickers: the reversed pair + the no-persistence law ==");
const pickRound = async (which, want) => {
  // the TRIGGER is click-until-effect too (the ride6 eyes: the first click
  // after a sibling pick can be eaten by Radix's focus transition —
  // expanded stays "false"). The retry is IN-PLACE: a reopen would reset
  // the pair state (the no-persistence law makes a reopen a different
  // question entirely), so the same dialog re-clicks its own trigger
  // until the dropdown itself says open. No Escape between tries — with
  // no portal open, Escape would close the DIALOG.
  const triggerExpr = `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); return dlg ? [...dlg.querySelectorAll('[role="combobox"]')].find(t => (t.getAttribute('aria-label') || '') === '${which}') : null; })()`;
  let opened = false, clickNote = "never-clicked";
  for (let i = 0; i < 4 && !opened; i++) {
    clickNote = await realClick(triggerExpr);
    opened = (await poll(
      `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); const trig = dlg ? [...dlg.querySelectorAll('[role="combobox"]')].find(t => (t.getAttribute('aria-label') || '') === '${which}') : null; return JSON.stringify({ expanded: trig ? trig.getAttribute('aria-expanded') === 'true' : false }); })()`,
      (v) => v.expanded === true, 5, 400
    ))?.expanded === true;
  }
  if (!opened) return { clicked: `NEVER-EXPANDED (${clickNote})`, applied: false };
  // the Radix portal mounts mid-animation — poll for the option's own
  // arrival (the per-surface presence law), then click at its center
  const optReady = await poll(
    `(() => { const opts = [...document.querySelectorAll('[role="option"]')].filter(o => (o.textContent || '').trim() === '${want}'); const o = opts[opts.length - 1]; if (!o) return JSON.stringify({ ready: false }); const r = o.getBoundingClientRect(); const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)); return JSON.stringify({ ready: !!(hit && (o === hit || o.contains(hit))), n: opts.length }); })()`,
    (v) => v.ready === true, 8, 400
  );
  if (optReady?.ready !== true) {
    // EYES on the stuck portal: the trigger's own expanded state + every
    // option's text/rect/hit — the ride's log is the diagnosis
    const eyes = evalJson(`(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('Class convergence — Occupancy share')); const trig = dlg ? [...dlg.querySelectorAll('[role="combobox"]')].find(t => (t.getAttribute('aria-label') || '') === '${which}') : null; const opts = [...document.querySelectorAll('[role="option"]')].map(o => { const r = o.getBoundingClientRect(); const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)); return { t: (o.textContent || '').trim().slice(0, 20), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], hitSelf: !!(hit && (o === hit || o.contains(hit))) }; }); return JSON.stringify({ expanded: trig ? trig.getAttribute('aria-expanded') : null, trigText: trig ? (trig.textContent || '').trim() : null, opts }); })()`);
    console.log(`      [pick ${which} → ${want}: portal eyes ${typeof eyes === "string" ? eyes : JSON.stringify(eyes)}]`);
  }
  const clicked = optReady?.ready === true
    ? await realClick(`(() => { const opts = [...document.querySelectorAll('[role="option"]')].filter(o => (o.textContent || '').trim() === '${want}'); return opts[opts.length - 1] ?? null; })()`)
    : "OPTIONS-NEVER-READY";
  const applied = await poll(
    `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); const t = dlg ? [...dlg.querySelectorAll('[role="combobox"]')].find(x => (x.getAttribute('aria-label') || '') === '${which}') : null; return JSON.stringify({ v: t ? (t.textContent || '').trim() : null, optsLeft: document.querySelectorAll('[role="option"]').length }); })()`,
    (v) => v.v === want && v.optsLeft === 0, 8, 400
  );
  if (applied?.v !== want) {
    const stuck = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="option"]').length })`);
    if ((stuck?.n ?? 0) > 0) {
      // a stuck portal poisons every later step — the portal is the
      // topmost layer, so the Escape closes IT, never the dialog
      sh(`${AB} press Escape`);
      await sleep(400);
    }
  }
  return { clicked: `${clickNote} → ${clicked}`, applied: applied?.v === want };
};
const pickA = await pickRound("Round A", "Round 002");
ok("P Round A switched to 002 (Radix option clicked + trigger speaks it)", pickA.applied, `click=${pickA.clicked}`);
const pickB = await pickRound("Round B", "Round 000");
ok("P Round B switched to 000", pickB.applied, `click=${pickB.clicked}`);
const S1 = pairStats(2, 0);
const face1 = await poll(convText, (v) => (v.text || "").includes(S1.census), 24, 750);
ok("P the reversed face re-reads: census names the flipped arc",
  (face1?.text ?? "").includes(S1.census), S1.census);
const movers1 = await poll(moversGrab, (v) => (v.gains || "").length > 0, 20, 750);
ok("P the gains/losses membership FLIPPED with the pair",
  S1.gained.every((g) => (movers1?.gains ?? "").includes(g.name)) && S1.lost.every((g) => (movers1?.losses ?? "").includes(g.name)),
  `gains wants ${S1.gained.map((g) => g.name).join(",")}; losses wants ${S1.lost.map((g) => g.name).join(",")}`);

await closeAllDialogs();
await openInspectorQuiet(C2D_NAME);
const reopen = await openConvergenceDialog(C2D_NAME);
const reopenConv = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); const trig = dlg ? [...dlg.querySelectorAll('[role="combobox"]')].map(t => (t.textContent || '').trim()) : []; return JSON.stringify({ open: !!dlg, trig }); })()`,
  (v) => v.open === true, 12, 500
);
ok("P reopen restores the WHOLE ARC (no persistence law)",
  reopenConv?.open === true && reopenConv?.trig?.[0] === "Round 000" && reopenConv?.trig?.[1] === "Round 002",
  `${reopenConv?.trig ?? []} via ${reopen}`);

// V — the verb FIRES: the t455 machinery's first live ride
console.log("== the verb fires: the continue machinery's live ride ==");
const jobsBeforeFire = JSON.parse(shApi("/api/jobs"));
const countBefore = jobsBeforeFire.jobs.length;
const fireBtn = `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); return dlg ? [...dlg.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Continue the run') : null; })()`;
let fired = "NO-DIALOG";
for (let i = 0; i < 3; i++) {
  fired = await realClick(fireBtn);
  if (String(fired).startsWith("clicked@")) break;
  await sleep(600);
}
ok("V1 'Continue the run' clicked (default +5 → total 7)", String(fired).startsWith("clicked@"), String(fired));
if (String(fired).startsWith("clicked@")) {
  // CLICK-UNTIL-WORLD-EFFECT: the dialog steps aside AND the world's own
  // mouth (the API) says the run began — the click that changed nothing
  // is retried, the click that changed the world is banked.
  let started = false;
  for (let i = 0; i < 20 && !started; i++) {
    const st = jobById(C2D_ID)?.status;
    if (st === "running" || st === "pending" || st === "staging") started = true;
    else await sleep(500);
  }
  ok("V1 the run STARTED on its own lane (the API says so)", started === true);
}

// the heartbeat: the route's live growth curve while the run is in flight,
// then the SETTLE law — after the status lands, the mirror's files are
// still landing; the ladder must hold its top for three agreeing reads
// before the arc is called extended (the ride3 lesson: the route's source
// flips from the cluster's live state to the mirror mid-sync — a single
// read mid-flip is a lie either way).
const growth = [];
let completed = false, settleHits = 0, lastLen = -1;
for (let i = 0; i < 360 && !completed; i++) {
  try {
    const j = jobById(C2D_ID);
    const st = j ? j.status : null;
    const it = JSON.parse(shApi(`/api/jobs/${C2D_ID}/iterations`)).iterations ?? [];
    if (growth[growth.length - 1] !== it.length) growth.push(it.length);
    if (st === "completed" && it.length >= 8) {
      if (it.length === lastLen) settleHits++;
      else { settleHits = 0; lastLen = it.length; }
      if (settleHits >= 2) completed = true; // three agreeing reads
    }
  } catch { /* the route hiccups are the run's own noise */ }
  await sleep(500);
}
ok("V2 the continue run COMPLETED on its own lane", completed === true, `growth curve ${JSON.stringify(growth)}`);
ok("V2 the ladder EXTENDED to 8 rounds [0..7]", growth[growth.length - 1] === 8, `final=${growth[growth.length - 1]}`);
const heartbeats = growth.filter((n, i) => i > 0 && n > growth[i - 1]).length;
ok(`V2 the route's heartbeat GREW during the ride (${heartbeats} growth steps witnessed)`,
  growth.length >= 2 && growth[growth.length - 1] === 8, JSON.stringify(growth));

const jobAfter = jobById(C2D_ID);
ok("V2 the verb's receipt in the world: params.iterations === 7 (RELION's --iter is the TOTAL; the knob's key is the curated form's own)",
  jobAfter?.params?.iterations === 7, `iterations=${jobAfter?.params?.iterations} (iter=${jobAfter?.params?.iter})`);
const jobsAfterFire = JSON.parse(shApi("/api/jobs"));
ok("W the continue verb created NO job (the count is unchanged)", jobsAfterFire.jobs.length === countBefore, `${jobsAfterFire.jobs.length} vs ${countBefore}`);

// V3 — the face re-reads the extended arc (a FRESH page — the reset law)
console.log("== the extended arc: the face re-reads the run's new shape ==");
await resetPage(8);
await openInspector(C2D_NAME);
const door2 = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${C2D_NAME}')); return JSON.stringify({ label: (d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Class convergence — read this run'))?.getAttribute('aria-label') : null) ?? null }); })()`,
  (v) => !!v.label, 24, 750
);
ok(`V3 the door counts its own 8 rounds now`, door2?.label === `Class convergence — read this run's occupancy across its own 8 iterations`, door2?.label ?? "absent");
const doorOpened2 = await openConvergenceDialog(C2D_NAME);
const reopen2 = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); const trig = dlg ? [...dlg.querySelectorAll('[role="combobox"]')].map(t => (t.textContent || '').trim()) : []; return JSON.stringify({ open: !!dlg, trig }); })()`,
  (v) => v.open === true, 12, 500
);
ok("V3 the extended arc leads: A=Round 000, B=Round 007",
  reopen2?.open === true && reopen2?.trig?.[0] === "Round 000" && reopen2?.trig?.[1] === "Round 007", `${JSON.stringify(reopen2?.trig ?? [])} via ${doorOpened2}`);
const S2 = pairStats(0, 7);
const face2 = await poll(convText, (v) => (v.text || "").includes(S2.census), 24, 750);
ok("V3 the extended face speaks the law: 1 gained / 1 lost / 2 held (cls2+cls4 returned to their seed shares)",
  (face2?.text ?? "").includes(`${S2.gained.length} gained`) && (face2?.text ?? "").includes(`${S2.lost.length} lost`) && (face2?.text ?? "").includes(`${S2.held.length} held`), S2.census);
ok("V3 the extended census verbatim", (face2?.text ?? "").includes(S2.census), S2.census);
const verb2 = await poll(
  `(() => { const dlg = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${CONV_TITLE}')); const row = dlg ? [...dlg.querySelectorAll('div')].find(x => (x.textContent || '').includes('Continue with more iterations')) : null; return JSON.stringify({ text: row ? (row.textContent || '') : '' }); })()`,
  (v) => (v.text || "").length > 0, 20, 750
);
ok("V3 the verb resumes the NEW tip: Round 007 · 7 + 5 → 12 total",
  (verb2?.text ?? "").includes("Resumes from Round 007") && (verb2?.text ?? "").includes("7 + 5 → 12"), (verb2?.text ?? "").slice(0, 200));

// G — the class-iteration-gallery (a FRESH page — the reset law)
sh(`${AB} press Escape`);
await sleep(400);
await closeAllDialogs();
const galInsp = await openInspector(C2D_NAME);
const tabG = await clickTabUntilActive(C2D_NAME, "/^Results/.test((t.textContent || '').trim())", "Results");
ok("G the Results tab ACTIVE", String(tabG).startsWith("active@"), String(tabG));
const gal = await poll(
  `(() => { const s = document.querySelector('section[aria-label="Class snapshots per iteration"]'); if (!s) return JSON.stringify({ found: false, resultsText: ([...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${C2D_NAME}')))?.textContent || '' }); const bar = s.querySelector('[aria-label="Iteration rounds"]'); const chips = bar ? [...bar.querySelectorAll('button')].map(b => (b.textContent || '').trim()) : []; const opener = [...s.querySelectorAll('button')].find(b => /Open iteration \\d+ class sheet enlarged/.test(b.getAttribute('aria-label') || '')); const imgs = [...s.querySelectorAll('img')]; return JSON.stringify({ found: true, chips, opener: opener ? opener.getAttribute('aria-label') : null, imgs: imgs.length, decoded: imgs.filter(i => i.complete && i.naturalWidth > 0).length }); })()`,
  (v) => v.found === true && (v.chips ?? []).length >= 8, 40, 750
);
if (gal?.found !== true) dumpDialogs();
ok(`G the gallery speaks 8 chips (every round with a stack)`, (gal?.chips ?? []).length === 8, JSON.stringify(gal?.chips ?? []));
ok(`G the followed round is the newest (the opener names ${pad3(7)})`, (gal?.opener ?? "").includes(`iteration ${pad3(7)}`), gal?.opener ?? "none");
const chipClicked = await realClick(`(() => { const bar = document.querySelector('section[aria-label="Class snapshots per iteration"]')?.querySelector('[aria-label="Iteration rounds"]'); return bar ? [...bar.querySelectorAll('button')].find(b => /^it ${pad3(0)}/.test((b.textContent || '').trim())) : null; })()`);
ok("G the Round 000 chip clicked (the seed chip speaks 'it 000 seed')", String(chipClicked).startsWith("clicked@"), String(chipClicked));
const switched = await poll(
  `(() => { const s = document.querySelector('section[aria-label="Class snapshots per iteration"]'); const opener = [...(s?.querySelectorAll('button') ?? [])].find(b => /Open iteration \\d+ class sheet enlarged/.test(b.getAttribute('aria-label') || '')); const imgs = [...(s?.querySelectorAll('img') ?? [])]; return JSON.stringify({ opener: opener ? opener.getAttribute('aria-label') : null, decoded: imgs.filter(i => i.complete && i.naturalWidth > 0).length, imgs: imgs.length }); })()`,
  (v) => (v.opener ?? "").includes(`iteration ${pad3(0)}`), 30, 750
);
ok("G the sheet switched to Round 000 (the opener's label speaks it)", (switched?.opener ?? "").includes(`iteration ${pad3(0)}`), switched?.opener ?? "none");
ok("G the sheet img decoded", (switched?.decoded ?? 0) >= 1, `decoded=${switched?.decoded}/${switched?.imgs}`);
const overC = evalJson(overflowProbe);
ok("G no horizontal overflow at 1280", overC.overX <= 0, `overX=${overC.overX}`);

// receipt
// ---- the variant's own restore (the t919 remove's law, inlined) ----------
// The witness's litter dies with the witness — DELETE + both-side sweep —
// and it runs on RED too (a stranded variant would poison the style
// witness's world). The t916 chain STAYS: the style witness's header
// seats and the t919 B mint ride it next; the final chain remove is
// their restore's business.
console.log("== the variant's own restore (both sides swept; the chain stays) ==");
await closeAllDialogs();
const vWorkdir = jobById(C2D_ID)?.workdir ?? null;
const delV = api("DELETE", `/api/jobs/${C2D_ID}`);
ok("restore: the K=8 variant deleted (the hard door)", !delV.error, JSON.stringify(delV).slice(0, 80));
const vSuffix = C2D_ID.slice(-8);
const sweepTree = (tree, re, label) => {
  try {
    for (const proj of readdirSync(tree)) {
      const projDir = path.join(tree, proj);
      let dirs = [];
      try { dirs = readdirSync(projDir); } catch { continue; }
      for (const dir of dirs) {
        if (!(dir.endsWith(vSuffix) && re.test(dir))) continue;
        const p = path.join(projDir, dir);
        try { rmSync(p, { recursive: true, force: true }); console.log(`  rm (${label}) ${path.relative(ROOT, p)}`); }
        catch (e) { console.log(`  ✗ rm (${label}) failed for ${p}: ${e.message}`); fail++; }
      }
    }
  } catch { /* nothing to sweep */ }
};
sweepTree(path.join(ROOT, "data", "relion"), /^class2d_/, "local");
if (vWorkdir && existsSync(vWorkdir)) {
  try { rmSync(vWorkdir, { recursive: true, force: true }); console.log(`  rm (workdir) ${vWorkdir.replace(ROOT + "/", "")}`); }
  catch (e) { console.log(`  ✗ rm (workdir) failed: ${e.message}`); fail++; }
}
sweepTree(path.join(ROOT, "services", "mock-cluster", "fs", "projects"), /^class2d_/, "cluster");
const afterRide = jobsApi();
ok("restore: the world back to the pre-variant count", afterRide.length === preVariantCount, `${afterRide.length} vs ${preVariantCount}`);
ok("restore: no t917 variant residue", afterRide.every((j) => !(j.name ?? "").includes("t917 convergence class2d")));
ok("restore: binding untouched through the whole arc", bindingOf() === binding0, `binding=${bindingOf()}`);

writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({
  at: new Date().toISOString(), pass, fail,
  class2d: C2D_ID, K, rows: ROWS,
  pair0: { census: S0.census, gained: S0.gained.map((g) => g.name), lost: S0.lost.map((g) => g.name) },
  reversed: { census: S1.census },
  extended: { census: S2.census, ladderFinal: growth[growth.length - 1] ?? null, growthCurve: growth, paramsIterations: jobAfter?.params?.iterations ?? null },
  gallery: { chips: gal?.chips ?? [], opener: gal?.opener ?? null, switched: switched?.opener ?? null },
  restore: { preVariantCount, afterCount: afterRide.length },
}, null, 2));
console.log(`== witness ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail == (receipt: ${RECEIPT})`);
process.exit(fail === 0 ? 0 : 1);
