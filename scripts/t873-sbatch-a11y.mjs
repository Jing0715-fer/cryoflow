#!/usr/bin/env node
/**
 * t873 — the tools-menu home's OWN room: the HPC SBATCH DIALOG's faces —
 * the rotation's second candidate (the ortho panel stayed home: the box
 * rolled a 599MB non-build, non-calm barrel, and the corpse pattern lives
 * on a calm box only), walked live with the SHARED RULER (zero src).
 *
 * The rotation: census (t698) -> cheap pair (t843) -> fragile pair (t844)
 * -> maintenance sweep (t846) -> overlay tier (t862) -> job panel (t863)
 * -> document/compare dialogs (t864) -> results family (t865) -> star
 * table (t866) -> quick-look (t867) -> text preview (t868) -> find bar
 * (t870) -> workspace panel (t871) -> system diagnostics (t872) -> THIS
 * dialog (t873).
 *
 * The surface (the inspector's tools menu — t757's controlled home —
 * hosts the ONE item, "Slurm sbatch dry-run…", whose dialog generates a
 * DRY-RUN sbatch script for the job: the profile Select, the strategy
 * badges, the generated <pre>, the Copy door, the slurmNotes, and the
 * HpcQueueSim's Gantt projection riding the same room):
 *
 *   O   the clean room — the t866 law (the seed cleared, the panel-closed
 *       boot demanded, the canvas calm).
 *   I   the inspector — the refine3d host's plain door (measured, never
 *       pinned).
 *   T   the tools door — the wrench opens the menu (Radix DropdownMenu in
 *       its portal), the ONE item speaks its name in words, and the CLICK
 *       (the t872 deterministic door — no Enter gambles) summons the
 *       sbatch dialog as the TOPMOST layer.
 *   D   the dialog's own face — the heading follows the door ("Slurm
 *       submission · <job>"), the t808 region workspace (role=region +
 *       the honest name + tabIndex 0), the profile Select named, the
 *       script pre NAMED and LANDED (the arrival predicate: the pre's
 *       own content — the loading leaf "Generating…" is the world's
 *       between-word), the strategy badges speak (the mode leaf, the GPU
 *       leaf), the Copy door named and ENABLED (the disabled-law's first
 *       witness), the slurmNotes speak, the Gantt projection rides the
 *       same room (Queue simulation + KPIs + the Gantt region), zero
 *       unnamed page-wide, two settled rides bit-identical.
 *   P   the profile switch — the registry planted +1 GPU profile through
 *       the world's OWN door (POST /api/hpc/profiles — the t259
 *       metadata door, isLocalRequest's same-origin law), the Select
 *       opens (Radix listbox in its portal), TWO options filmed by
 *       name, the CLICK on the filmed option moves the selection, and
 *       the script's OWN WORDS follow the profile (the #SBATCH
 *       --partition line moves gpu -> the planted partition, the length
 *       moves) — the builder's honesty made visible.
 *   C   the copy door — the clipboard probed FIRST (the world grants or
 *       denies; both are its own word), the door clicked, and the label
 *       must speak the door's TRUE state either way: granted -> "Copied"
 *       (and back after the 1.6s timer), denied -> the honest no-flip.
 *   K   Escape peels exactly ONE layer (the helper's law), the inspector
 *       remains.
 *   R   the fallback law — the registry restored bit-for-bit, the dialog
 *       re-opened, and the deleted selection FALLS BACK (the code's own
 *       words: "a renamed id is still the same profile, a deleted one is
 *       not") — the Select reads the restored profile, the script's
 *       partition returns.
 *   E   the error face — the motioncorr host (no builder on this box:
 *       "MotionCor2 executable not found"), the danger box speaks the
 *       error, the pre never lands (the honest-empty doctrine: the panel
 *       never invents a script), the Copy door DISABLED (the
 *       disabled-law's second witness), the badges still honest.
 *   W   the world back — fresh load, the canvas bit-for-bit, the seed
 *       clean, the jobs count == the opening count (the t872 rogue-row
 *       census's guard), and the registry GET == the original GET
 *       bit-for-bit (the plant leaves NOTHING behind).
 *
 * Born with the ledger aboard (the t861 birthright): FIVE faces through
 * the shared helper — canvas / sbatchDialog / profileSwitch / errorFace /
 * worldBack — the receipt's top-level `faces` block carries the RAW
 * measures, the ledger diffs prev.faces.<name>.live.
 *
 * Receipt: shots-qa/t873-sbatch-a11y.json.
 *
 *   node scripts/t873-sbatch-a11y.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);

/** agent-browser eval unwrap — the t837 defensive form. */
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string — the value itself */
    }
  }
  return out;
};

/* ---------- provenance + the comparator (the family's shared law) ---------- */
const world = worldIdentity(ROOT);
const buildId = world.id;
const cmp = loadComparator(ROOT, "shots-qa/t873-sbatch-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t873 sbatch a11y walk — world ${world.mode}:${buildId}, the tools-menu home's own room\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* same-origin metadata — the registry read/write is a same-origin gate
 * (the t708 shape, the t259 law: isLocalRequest closes the cross-site
 * carriers; the same-origin UI always passes). */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
/* bounded retry for the box's own API calls — the t869 lesson: a fresh
 * page load's compile spike can reset an undici connection; an arrival
 * waits for arrival, and a TRANSIENT denial is retried before the ride
 * calls it honest failure. */
const retryFetch = async (fn, what, tries = 3) => {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      sleep(2);
    }
  }
  throw new Error(`${what} failed after ${tries} tries: ${String((last && last.message) || last).slice(0, 120)}`);
};

/* ---------- THE API ROUTES' FIRST-COMPILE TAX (the t872 law, extended) ----------
 * the death film's verdict (scripts/t873-death-film2.mjs): the sbatch
 * room's first open per server-lifetime compiles the /api/hpc/* routes
 * ON FIRST REQUEST — and under memory pressure the compile can OOM the
 * next-server itself (ERR_CONNECTION_REFUSED; the dev supervisor's
 * self-heal respawns it). The dialog's fetch hangs, the page's dialogs
 * die with the server, and the mid-ride faces film a world that died
 * of its own birth. THE CURE IS THE TAX PAID OUTSIDE ANY RIDE: the
 * routes are compiled HERE, through the API's own door, with a patient
 * wait that tolerates the self-heal window — before any browser ride. */
const warmApiRoutes = async (hostId) => {
  const warmGet = async (url, what, tries = 10) => {
    let last = null;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(`${BASE}${url}`, { headers: SH });
        if (r.ok) return true;
        last = new Error(`HTTP ${r.status}`);
      } catch (e) {
        last = e;
      }
      sleep(5);
    }
    throw new Error(`the ${what} warm never answered after ${tries} tries: ${String((last && last.message) || last).slice(0, 120)}`);
  };
  const warmPost = async (url, body, what, tries = 10) => {
    let last = null;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(`${BASE}${url}`, { method: "POST", headers: SH, body: JSON.stringify(body) });
        if (r.ok) return true;
        last = new Error(`HTTP ${r.status}`);
      } catch (e) {
        last = e;
      }
      sleep(5);
    }
    throw new Error(`the ${what} warm never answered after ${tries} tries: ${String((last && last.message) || last).slice(0, 120)}`);
  };
  await warmGet("/api/hpc/profiles", "profiles registry");
  await warmGet(`/api/hpc/sbatch/${hostId}?profile=slurm-gpu-cluster`, "sbatch builder");
  await warmPost("/api/hpc/simulate", {}, "queue simulation");
};

const getRegistry = async () => {
  const r = await fetch(`${BASE}/api/hpc/profiles`, { headers: SH });
  const b = await r.json();
  return b.profiles ?? [];
};
const postRegistry = async (profiles) => {
  const r = await fetch(`${BASE}/api/hpc/profiles`, {
    method: "POST",
    headers: SH,
    body: JSON.stringify({ profiles }),
  });
  const b = await r.json();
  return b;
};
const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`, {
    headers: { Origin: BASE, Referer: `${BASE}/`, "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" },
  });
  const b = await r.json();
  return b.jobs ?? b;
};

/* ---------- the registry: measured, planted through the world's own door ----------
 * the registry read IS the profiles route's warm (patient: the self-heal
 * window is tolerated before the ride calls anything honest) */
const origRegistry = await retryFetch(getRegistry, "the registry read (the warm's own door)", 6);
console.log(
  `  registry measured: ${origRegistry.length} profiles [${origRegistry.map((p) => p.id).join(", ")}]`
);
const hasCluster = origRegistry.some((p) => p.id === "slurm-gpu-cluster");
ok("R0 the registry speaks its defaults (the t259 metadata door answers)",
  origRegistry.length >= 2 && hasCluster,
  `profiles=${origRegistry.length}`);
const PLANTED = {
  id: "t873-h100-alt",
  name: "T873 H100 alt",
  host: "login.alt.example.org",
  partition: "a100",
  account: "cryo-em",
  qos: "normal",
  timeLimitMin: 600,
  nodes: 2,
  gpusPerNode: 8,
  gpuModel: "H100",
  relionHome: "/opt/relion/5.0.1",
  dataRoot: "/lustre/alt/project/cryoflow",
  localRoot: origRegistry.find((p) => p.id === "slurm-gpu-cluster")?.localRoot ?? "data/relion",
  envLines: [],
  arrayConcurrency: 8,
  gpuSpeedup: 30,
};
const planted = await retryFetch(() => postRegistry([...origRegistry, PLANTED]), "the registry plant POST");
ok("R1 the plant rode the world's own POST door (the registry grows by ONE)",
  Array.isArray(planted.profiles) && planted.profiles.length === origRegistry.length + 1,
  `planted=${(planted.profiles ?? []).length}`);
if (!Array.isArray(planted.profiles) || planted.profiles.length !== origRegistry.length + 1) {
  console.error("  ✗ the plant failed — the switch ride cannot be honest; stopping before any UI work");
  writeFileSync(join(ROOT, "shots-qa/t873-sbatch-a11y.json"), JSON.stringify({ instrument: "scripts/t873-sbatch-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "the registry plant failed — the ride stopped honestly before the UI" }, null, 2));
  process.exit(1);
}
// the restore is guaranteed by the exit path below (finally-restore)

/* ---------- the measure: the SHARED RULER + the sbatch family's probes.
 * ONE superset measure — every face films the same fields; the absent
 * selectors speak false/0 (within-face stability is what the rides diff).
 * NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 48) : null; const dlgHeadTop = headOf(dlgTop); const dlgCount = dgs.length; const act = document.activeElement; const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^(Loading( chart| file)?|Generating)…$/.test((e.textContent || "").trim())); const region = dlgTop ? dlgTop.querySelector("[role=region][aria-label]") : null; const combo = dlgTop ? dlgTop.querySelector("[role=combobox]") : null; const listbox = document.querySelector("[role=listbox]"); const opts = listbox ? Array.from(listbox.querySelectorAll("[role=option]")) : []; const pre = dlgTop ? dlgTop.querySelector(\'pre[aria-label="Generated sbatch script"]\') : null; const preTxt = pre ? (pre.textContent || "") : ""; const partMatch = preTxt.match(/#SBATCH --partition=(\\S+)/); const rowLeaves = dlgTop ? Array.from(dlgTop.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^(multi-gpu|array|single|cpu)$/.test((e.textContent || "").trim())) : []; const gpuLeaves = dlgTop ? Array.from(dlgTop.querySelectorAll("*")).filter((e) => e.children.length === 0 && /(^CPU$|\\d+ × GPU)/.test((e.textContent || "").trim())) : []; const copyBtn = dlgTop ? Array.from(dlgTop.querySelectorAll("button")).find((b) => /^(Copy script|Copied)$/.test((b.textContent || "").trim())) : null; const notes = dlgTop ? Array.from(dlgTop.querySelectorAll("p span.text-primary")).length : 0; const qsim = document.querySelector(\'[aria-label="Queue simulation"]\'); const kpis = document.querySelector(\'[aria-label="Simulation KPIs"]\'); const gantt = document.querySelector(\'[aria-label="Simulated schedule (Gantt)"]\'); const kpiCells = kpis ? kpis.children.length : 0; const ganttTab = gantt ? gantt.getAttribute("tabindex") : null; const errBox = dlgTop ? dlgTop.querySelector("div[class*=danger]") : null; const menu = document.querySelector("[role=menu]"); const items = menu ? Array.from(menu.querySelectorAll("[role=menuitem]")) : []; const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgCount: dlgCount, dlgHeadTop: dlgHeadTop, act: act ? (act.tagName === "PRE" ? "PRE" : act.tagName + (act.getAttribute && act.getAttribute("aria-label") ? ":" + String(act.getAttribute("aria-label")).slice(0, 24) : "")) : null, gen: leaves.length, regionLbl: region ? String(region.getAttribute("aria-label")).slice(0, 90) : null, regionTab: region ? region.getAttribute("tabindex") : null, comboName: combo ? combo.getAttribute("aria-label") : null, comboVal: combo ? (combo.textContent || "").trim().slice(0, 60) : null, comboOpen: combo ? combo.getAttribute("aria-expanded") : null, listbox: !!listbox, optCount: opts.length, optNames: opts.slice(0, 4).map((o) => (o.textContent || "").trim().slice(0, 40)), prePresent: !!pre, preNamed: pre ? pre.getAttribute("aria-label") : null, preTab: pre ? pre.getAttribute("tabindex") : null, preLen: preTxt.length, preHead: preTxt.trim().slice(0, 48), prePart: partMatch ? partMatch[1] : null, preScroll: pre ? pre.scrollHeight > pre.clientHeight : false, modeLeaf: rowLeaves.length, modeWord: rowLeaves.length ? (rowLeaves[0].textContent || "").trim() : null, gpuLeaf: gpuLeaves.length, gpuWord: gpuLeaves.length ? (gpuLeaves[0].textContent || "").trim().slice(0, 30) : null, copyLabel: copyBtn ? (copyBtn.textContent || "").trim() : null, copyDisabled: copyBtn ? !!copyBtn.disabled : null, notesCount: notes, qsim: !!qsim, kpis: !!kpis, gantt: !!gantt, kpiCells: kpiCells, ganttTab: ganttTab, errBox: !!errBox, errText: errBox ? (errBox.textContent || "").trim().slice(0, 80) : null, hasMenu: !!menu, menuItems: items.length, menuNames: items.slice(0, 4).map((i) => (i.textContent || "").trim().slice(0, 40)), sbatchItem: !!document.querySelector(\'[data-testid="tools-sbatch-item"]\'), seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()';

/* the settle law (t864's shape + the t869 arrival guard): bounded,
 * MULTIPLE consecutive equal pairs, the loading leaves' own quiescence
 * door (the regex now speaks "Generating…" too) and the images'
 * contract; a BLANK page (pageBtns 0) is never stable — the world keeps
 * arriving or the ride says so (the t869 law). */
const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 18, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const alive = next.pageBtns > 0;
    const same = alive && JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next);
      console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.gen === 0 && m.imgPending === 0) break;
  }
  console.log(`  settled ${what} (${run}x stable)`);
  return m;
};

/* the arrival door: WAIT for a predicate on the live measure (bounded) —
 * an arrival waits for arrival, never for a clock. */
const waitFor = (what, probe, maxSecs = 26) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

/* the OOM corpse guard (the t859/t861/t864/t865/t866/t872 pattern): an
 * eval filming a dead server returns ZEROS — say so, stop honestly. */
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

/* the card's PLAIN door: pointerdown+pointerup, no move, no shift — the
 * job-card's own law: idle opens the panel, submitted opens the inspector. */
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

/* the tools door + the sbatch door: the t872 deterministic door — the
 * CLICK on the filmed item (trusted CDP events, no Enter gambles). The
 * probe's verdict (scripts/t873-door-probe.mjs): the selector rides in
 * SINGLE shell quotes (the \\" escape form gets SPLIT by the sh handoff
 * — the door-probe's t-lesson), and the t863 law rides as the fallback
 * (Radix primitives hear the pointer events they listen for — with
 * pointerType "mouse" named; the tab's mousedown proof; it was cmdk's
 * INTERNAL store that ignored synthetics, and there is no cmdk here). */
const TOOLS_DOOR = "click '[aria-label=\"More job tools\"]'";
const TOOLS_SYNTH =
  '(() => { const t = document.querySelector("[aria-label=\\"More job tools\\"]"); if (!t) return JSON.stringify({ found: false }); const r = t.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, pointerType: "mouse", clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; t.dispatchEvent(new PointerEvent("pointerdown", o)); t.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ found: true }); })()';
const SBATCH_DOOR = "click '[data-testid=\"tools-sbatch-item\"]'";
const SBATCH_SYNTH =
  '(() => { const i = document.querySelector("[data-testid=\\"tools-sbatch-item\\"]"); if (!i) return JSON.stringify({ found: false }); i.click(); return JSON.stringify({ found: true }); })()';
const openTools = async (what) => {
  try {
    ab(TOOLS_DOOR);
  } catch {
    /* the native door denied (selector/actionability) — the synthetic law rides */
  }
  let m = waitFor(what, (x) => x.hasMenu === true && x.sbatchItem === true, 6);
  if (!(m.hasMenu === true && m.sbatchItem === true)) {
    evalJson(TOOLS_SYNTH);
    m = waitFor(what, (x) => x.hasMenu === true && x.sbatchItem === true, 8);
  }
  return m;
};
const openSbatch = async (what) => {
  try {
    ab(SBATCH_DOOR);
  } catch {
    /* the native door denied — the synthetic law rides */
  }
  let m = waitFor(what, (x) => x.dlgCount >= 2, 6);
  if (m.dlgCount < 2) {
    evalJson(SBATCH_SYNTH);
    m = waitFor(what, (x) => x.dlgCount >= 2, 24);
  }
  return m;
};

/* the Select trigger door: the probe's single-quote form (space between
 * the compound selector's two parts lives INSIDE the quotes). */
const COMBO_DOOR = "click '[role=\"dialog\"] [role=\"combobox\"]'";

/* the Select option door: the filmed option's pointer pair (the card
 * door's shape — Radix SelectItem selects on pointerup). */
const optionDoor = (name) =>
  '(() => { const os = Array.from(document.querySelectorAll("[role=option]")); const o = os.find((x) => (x.textContent || "").trim() === "' + name + '"); if (!o) return JSON.stringify({ found: false, opts: os.map((x) => (x.textContent || "").trim().slice(0, 40)) }); const r = o.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, pointerType: "mouse", clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; o.dispatchEvent(new PointerEvent("pointerdown", opts)); o.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ found: true }); })()';

/* the copy door: the plain button's own activation (the t868 text-door
 * shape: a synthetic click speaks the button's activation). */
const COPY_DOOR =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ found: false }); const b = Array.from(d.querySelectorAll("button")).find((x) => /^(Copy script|Copied)$/.test((x.textContent || "").trim())); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()';

/* the clipboard probe: the world grants or denies — both its own word.
 * The result lands on window.__t873clip (a promise cannot cross eval). */
const CLIP_PROBE =
  '(() => { window.__t873clip = "pending"; if (!navigator.clipboard || !navigator.clipboard.writeText) { window.__t873clip = "no-api"; return "no-api"; } navigator.clipboard.writeText("t873 clipboard probe").then(() => { window.__t873clip = "granted"; }).catch((e) => { window.__t873clip = "denied:" + String((e && e.name) || e); }); return "pending"; })()';
const CLIP_READ = '(() => { return JSON.stringify({ clip: window.__t873clip ?? "unset" }); })()';
const clipVerdict = (maxSecs = 6) => {
  evalJson(CLIP_PROBE);
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const r = evalJson(CLIP_READ);
    if (r.clip !== "pending") return r.clip;
  }
  return "timeout";
};

/* the zero-unnamed census invariant, one voice everywhere */
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

const restoreRegistry = async () => {
  const back = await retryFetch(() => postRegistry(origRegistry), "the registry restore POST");
  const check = await retryFetch(getRegistry, "the registry read-back");
  const same = JSON.stringify(check) === JSON.stringify(origRegistry);
  return { back, check, same };
};

let worldRestored = false;
let exitCode = 1;
try {
  /* ---------- Face W-API: the routes' first-compile tax (the death film's cure) ----------
   * paid HERE, through the API's own door, outside any browser ride —
   * the sbatch builder and the queue simulation compile ON FIRST REQUEST
   * per server-lifetime, and that compile can OOM the dev server under
   * memory pressure; the patient warm tolerates the self-heal window. */
  console.log("Face W-API — the /api/hpc/* routes' first-compile tax (paid outside any ride)");
  const jobsWarm = await retryFetch(roster, "the roster (the warm's read)", 6);
  const warmHost =
    jobsWarm.find((j) => j.type === "refine3d" && j.status === "completed") ||
    jobsWarm.find((j) => j.status === "completed" && j.type !== "import");
  if (!warmHost) throw new Error("no completed job with a builder — the sbatch warm cannot aim");
  await warmApiRoutes(warmHost.id);
  ok("W-API the routes warm (profiles + sbatch builder + queue simulation answered)", true,
    `aimed at ${warmHost.id.slice(0, 12)}`);

  /* ---------- Face 0: the clean room + the calm canvas ---------- */
  console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
  ab("open http://localhost:3000");
  sleep(3);
  evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
  ab("open http://localhost:3000");
  sleep(3);
  const mBoot = settle("the canvas");
  if (corpse(mBoot, "Face 0")) throw new Error("corpse at Face 0 — the honest stop");
  ok("O0 the boot is a clean room (the t157 seed cleared, the panel closed)",
    mBoot.panelOpen === false,
    `panelOpen=${mBoot.panelOpen}`);
  ok("O1 the canvas is calm and named (the census's invariant)",
    !mBoot.hasDlg && censusOk(mBoot),
    `btns=${mBoot.pageBtns} — zero unnamed anywhere`);

  /* ---------- the roster: the two hosts, measured never pinned ---------- */
  const jobs = await retryFetch(roster, "the roster");
  const host =
    jobs.find((j) => j.type === "refine3d" && j.status === "completed") ||
    jobs.find((j) => j.status === "completed" && j.type !== "import");
  const host2 = jobs.find((j) => j.type === "motioncorr" && j.status === "completed") || null;
  if (!host) {
    throw new Error("no completed job with a builder in the roster — the dialog cannot fill");
  }
  console.log(`  script host (measured, not pinned): ${host.name} (${host.id.slice(0, 12)})`);
  if (host2) console.log(`  error host (measured, not pinned): ${host2.name} (${host2.id.slice(0, 12)})`);

  /* ---------- Face W0: the first-open tax (the t872 law, paid as its own face) ----------
   * the sbatch room's first open BUILDS on the dev server — and the build
   * can remount the page (the room dies with its inspector: the t872
   * first-open-tax lesson, learned again as a full reload). The tax is
   * paid HERE, before any door rides: the room is born, and if the birth
   * kills the page, the re-ride holds WARM. */
  console.log("Face W0 — the first-open tax (the sbatch room's BIRTH, paid before any door rides)");
  const warmOnce = async (tag) => {
    const cw = evalJson(plainClick(host.id));
    if (cw.clicked !== true) return { open: false };
    const ia = waitFor(`the inspector (${tag})`, (m) => m.hasDlg && m.dlgCount >= 1, 12);
    if (!ia.hasDlg) return { open: false };
    await openTools(`the tools menu (${tag})`);
    const da = await openSbatch(`the sbatch dialog (${tag})`);
    if (da.dlgCount < 2) return { open: false };
    const s = settle(`the warm dialog (${tag})`, 14, 2);
    return { open: s.dlgCount >= 2 && s.prePresent === true, measure: s };
  };
  const birth = await warmOnce("birth");
  let warmRides = 1;
  let warmHold = birth;
  /* the tax may cost MORE than one page (the chunk graph compiles in
   * waves — the t872 tens-of-seconds lesson): up to THREE bounded
   * attempts, each arrival-gated, the pass only when a ride HOLDS */
  while (!warmHold.open && warmRides < 3) {
    warmRides++;
    sleep(3);
    warmHold = await warmOnce(`warm${warmRides - 1}`);
  }
  ok("W0 the first-open tax paid (the room holds warm after its birth)",
    warmHold.open === true,
    `rides=${warmRides} dlg=${warmHold.measure ? warmHold.measure.dlgCount : "?"} preLen=${warmHold.measure ? warmHold.measure.preLen : "?"}`);
  if (!warmHold.open) throw new Error("the sbatch room never held warm — the honest stop");
  evalJson(ESC_LAST);
  sleep(1.2);
  evalJson(ESC_LAST);
  sleep(1.5);
  /* the clean room again (the birth's reloads may have seeded state) —
   * THIS canvas is the honest opening count the world-back is judged on */
  evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
  ab("open http://localhost:3000");
  sleep(3);
  const m0 = settle("the canvas (post-tax, the clean room again)");
  if (corpse(m0, "Face 0 post-tax")) throw new Error("corpse at the post-tax canvas — the honest stop");
  ok("O2 the post-tax boot is a clean room again (the seed cleared, the panel closed)",
    m0.panelOpen === false && !m0.hasDlg && censusOk(m0),
    `btns=${m0.pageBtns}`);
  const OPEN = m0.pageBtns;
  const jobsAtOpen = (await retryFetch(roster, "the roster at open")).length;
  console.log(`  jobs at open: ${jobsAtOpen} (the rogue-row census's opening word)`);

  /* ---------- Face I: the inspector through the plain door ---------- */
  console.log("Face I — the host inspector through the plain door");
  const c1 = evalJson(plainClick(host.id));
  ok("I1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
  const w = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
  ok("I2 the inspector arrived (a dialog aboard)", w.hasDlg === true, `dlgCount=${w.dlgCount}`);

  /* ---------- Face T: the tools door — the wrench, the ONE item, the click ---------- */
  console.log("Face T — the tools door (the t323 contract: door to tools)");
  const tArr = await openTools("the tools menu");
  ok("T1 the wrench opened the tools menu (Radix's portal menu aboard)", tArr.hasMenu === true);
  ok("T2 the ONE item speaks its name in words (the t757 contract)",
    tArr.menuItems >= 1 && /Slurm sbatch dry-run/.test((tArr.menuNames || []).join(" | ")),
    `items=${tArr.menuItems} [${(tArr.menuNames || []).join(" | ")}]`);
  const dArr = await openSbatch("the sbatch dialog");
  ok("T3 the CLICK summoned the sbatch dialog as the TOPMOST layer (the t872 deterministic door)",
    dArr.dlgCount >= 2, `dlgCount=${dArr.dlgCount}`);

  /* ---------- Face D: the sbatch dialog's own face ---------- */
  console.log("Face D — the dialog's own face (the arrival: the pre's own content)");
  const d0 = waitFor("the script pre", (m) => m.dlgCount >= 2 && m.prePresent === true && m.preLen > 0);
  const d1 = settle("the sbatch dialog (the script lands)");
  if (corpse(d1, "Face D")) throw new Error("corpse at Face D — the honest stop");
  ok("D1 the heading follows the door (Slurm submission · <job>)",
    /^Slurm submission/.test(d1.dlgHeadTop || ""), `head="${d1.dlgHeadTop}"`);
  ok("D2 the t808 region workspace (role=region + the honest name + tabIndex 0)",
    d1.regionLbl !== null && /Slurm sbatch workspace/.test(d1.regionLbl) && d1.regionTab === "0",
    `label="${(d1.regionLbl || "").slice(0, 48)}…" tab=${d1.regionTab}`);
  ok("D3 the profile Select is named (the Cluster profile door)",
    d1.comboName === "Cluster profile", `name="${d1.comboName}"`);
  ok("D4 the script pre is named and keeps its keyboard door (the t809 house dialect)",
    d1.preNamed === "Generated sbatch script" && d1.preTab === "0",
    `label="${d1.preNamed}" tabindex=${d1.preTab}`);
  ok("D5 the script LANDED (the dry-run's own words speak sbatch)",
    d1.preLen > 200 && /^#!/.test(d1.preHead || ""),
    `len=${d1.preLen} head="${(d1.preHead || "").slice(0, 32)}…"`);
  ok("D6 the strategy badges speak (the mode leaf + the GPU leaf)",
    d1.modeLeaf >= 1 && d1.gpuLeaf >= 1,
    `mode="${d1.modeWord}" gpu="${d1.gpuWord}"`);
  ok("D7 the Copy door named and ENABLED (the disabled-law's first witness — a script aboard)",
    d1.copyLabel === "Copy script" && d1.copyDisabled === false,
    `label="${d1.copyLabel}" disabled=${d1.copyDisabled}`);
  ok("D8 the slurmNotes speak (the › list rides the room)",
    d1.notesCount >= 1, `notes=${d1.notesCount}`);
  ok("D9 the Queue simulation section rides the same room (the projection's home)",
    d1.qsim === true,
    `qsim=${d1.qsim}`);
  ok("D10 zero unnamed page-wide WITH the dialog up (the census's invariant)",
    censusOk(d1),
    `btns=${d1.pageBtns} ctrls=${d1.ctrls}`);
  const d1b = settle("the sbatch dialog (second ride)");
  ok("D11 two settled rides bit-identical (the t836 law, the t860 settle)",
    JSON.stringify(d1) === JSON.stringify(d1b));

  /* the projection's own door: the sim is the room's RUN — the KPIs and
   * the Gantt render only when the simulation has been run (the sim
   * state's own gate), so the ride summons it through the room's own
   * play button (the t872 deterministic door, single-quote form). */
  console.log("Face D2 — the projection's Run door (the sim state's own gate)");
  try {
    ab("click '[aria-label=\"Run queue simulation\"]'");
  } catch {
    evalJson('(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => (x.getAttribute("aria-label") || "") === "Run queue simulation"); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()');
  }
  const g1 = waitFor("the projection", (m) => m.kpis === true && m.gantt === true, 30);
  ok("D12 the Run door raised the projection (KPIs + Gantt aboard)",
    g1.kpis === true && g1.gantt === true,
    `kpiCells=${g1.kpiCells} ganttTab=${g1.ganttTab}`);
  ok("D13 the KPI band speaks its four cells (Makespan / GPU util / Avg wait / GPU hours)",
    g1.kpiCells >= 4, `cells=${g1.kpiCells}`);
  ok("D14 the Gantt keeps its keyboard door (the t803 scroll law's honest name)",
    g1.ganttTab === "0", `tabindex=${g1.ganttTab}`);
  ok("D15 the post-run census held (zero unnamed WITH the projection up)",
    censusOk(g1), `btns=${g1.pageBtns}`);

  /* ---------- Face P: the profile switch — the script's words follow ---------- */
  console.log("Face P — the profile switch (the registry planted, the listbox filmed)");
  try {
    ab(COMBO_DOOR);
  } catch {
    /* the native door denied — the synthetic law rides */
  }
  let p0 = waitFor("the listbox", (m) => m.listbox === true && m.optCount >= 2, 6);
  if (!(p0.listbox === true && p0.optCount >= 2)) {
    evalJson('(() => { const c = document.querySelector("[role=dialog] [role=combobox]"); if (!c) return JSON.stringify({ found: false }); const r = c.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, pointerType: "mouse", clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ found: true }); })()');
    p0 = waitFor("the listbox (synthetic)", (m) => m.listbox === true && m.optCount >= 2, 8);
  }
  ok("P1 the Select opened its portal listbox", p0.listbox === true, `optCount=${p0.optCount}`);
  ok("P2 TWO options filmed by name (the planted one among them)",
    p0.optCount >= 2 && (p0.optNames || []).some((n) => /T873 H100 alt/.test(n)),
    `[${(p0.optNames || []).join(" | ")}]`);
  const o1 = evalJson(optionDoor("T873 H100 alt"));
  ok("P3 the CLICK on the filmed option spoke the selection (no Enter gambles)",
    o1.found === true, o1.opts ? `opts=${JSON.stringify(o1.opts)}` : "");
  const p1 = waitFor("the moved script", (m) => m.prePart === "a100" && m.preLen > 0);
  const p1s = settle("the switched dialog (the script re-lands)");
  if (corpse(p1s, "Face P")) throw new Error("corpse at Face P — the honest stop");
  ok("P4 the trigger's value follows the door (the planted name reads back)",
    /T873 H100 alt/.test(p1s.comboVal || ""), `value="${p1s.comboVal}"`);
  ok("P5 the script's OWN WORDS follow the profile (the partition moved gpu -> a100)",
    p1s.prePart === "a100", `partition=${p1s.prePart} len=${p1s.preLen} (was ${d1.preLen})`);
  ok("P6 the moved script is a DIFFERENT script (the builder's honesty made visible)",
    p1s.preLen !== d1.preLen, `len ${d1.preLen} -> ${p1s.preLen}`);
  ok("P7 the switched face's census held (zero unnamed)",
    censusOk(p1s), `btns=${p1s.pageBtns}`);

  /* ---------- Face C: the copy door — the world grants or denies ---------- */
  console.log("Face C — the copy door (the clipboard's own word probed first)");
  const clip = clipVerdict();
  console.log(`  clipboard verdict: ${clip}`);
  const c1r = evalJson(COPY_DOOR);
  ok("C1 the copy door spoke its activation", c1r.found === true);
  const c2 = waitFor("the label's true state", (m) => m.copyLabel === "Copied" || clip !== "granted", 3);
  if (clip === "granted") {
    ok("C2 the world GRANTED the clipboard and the label flipped to Copied",
      c2.copyLabel === "Copied", `label="${c2.copyLabel}"`);
    sleep(2);
    const c3 = evalJson(MEASURE);
    ok("C3 the 1.6s timer returned the label to its rest state",
      c3.copyLabel === "Copy script", `label="${c3.copyLabel}"`);
  } else {
    ok("C2 the world DENIED the clipboard and the label stayed honest (no false Copied)",
      c2.copyLabel === "Copy script", `verdict=${clip} label="${c2.copyLabel}"`);
  }
  ok("C4 the copied face's census held (zero unnamed)", censusOk(c2), `btns=${c2.pageBtns}`);

  /* ---------- Face K: Escape peels exactly one layer ---------- */
  evalJson(ESC_LAST);
  sleep(1.5);
  const k1 = evalJson(MEASURE);
  ok("K1 Escape peeled exactly ONE layer (the helper's law), the inspector remains",
    k1.dlgCount === d1.dlgCount - 1 && k1.hasDlg === true,
    `dlgCount ${d1.dlgCount} -> ${k1.dlgCount}`);
  ok("K2 the peeled layer's census back (zero unnamed without the dialog)", censusOk(k1));

  /* ---------- Face R: the fallback law — the deleted selection falls back ---------- */
  console.log("Face R — the registry restored, the dialog re-opened, the selection falls back");
  const restored = await restoreRegistry();
  ok("R1 the registry restored bit-for-bit (the plant leaves NOTHING)",
    restored.same === true, restored.same ? "" : "GET !== original — investigate before proceeding");
  const rMenu = await openTools("the tools menu again");
  ok("R2 the tools door re-opened (the wrench is ONE decision, repeated)", rMenu.hasMenu === true);
  const r0pre = await openSbatch("the re-opened dialog");
  const r0 = waitFor("the re-opened script", (m) => m.dlgCount >= 2 && m.prePresent === true && m.preLen > 0);
  const r1 = settle("the re-opened dialog (the fallback lands)");
  if (corpse(r1, "Face R")) throw new Error("corpse at Face R — the honest stop");
  ok("R3 the deleted selection FELL BACK (the code's own law: a deleted id is not the same profile)",
    /Slurm GPU cluster/.test(r1.comboVal || "") && !/T873 H100 alt/.test(r1.comboVal || ""),
    `value="${r1.comboVal}"`);
  ok("R4 the script's partition returned with the restored profile",
    r1.prePart === "gpu", `partition=${r1.prePart} len=${r1.preLen}`);
  ok("R5 the fallback face's census held (zero unnamed)", censusOk(r1), `btns=${r1.pageBtns}`);
  evalJson(ESC_LAST);
  sleep(1.5);

  /* ---------- Face E: the error face — the honest empty ---------- */
  console.log("Face E — the error host (no builder on this box: the honest empty)");
  evalJson(ESC_LAST);
  sleep(1.5);
  const inspGone = evalJson(MEASURE);
  ok("E0 the inspector peeled clean (the stage reset for the second host)",
    inspGone.hasDlg === false, `dlgCount=${inspGone.dlgCount}`);
  const c2r = evalJson(plainClick(host2 ? host2.id : host.id));
  ok("E1 the second host's plain door opened the inspector", c2r.clicked === true);
  const eArr = waitFor("the second inspector", (m) => m.hasDlg && m.dlgCount >= 1);
  ok("E2 the second inspector arrived", eArr.hasDlg === true, `dlgCount=${eArr.dlgCount}`);
  await openTools("the error face's tools menu");
  await openSbatch("the error face's dialog");
  const e0 = waitFor("the error box", (m) => m.dlgCount >= 2 && (m.errBox === true || m.preLen > 0));
  const e1 = settle("the error face (the honest empty lands)");
  if (corpse(e1, "Face E")) throw new Error("corpse at Face E — the honest stop");
  ok("E3 the danger box speaks the error (the world's own words, never a invented script)",
    e1.errBox === true && e1.errText.length > 0, `text="${e1.errText}"`);
  ok("E4 the pre never lands (the honest-empty doctrine)",
    e1.prePresent === false || e1.preLen === 0, `preLen=${e1.preLen}`);
  ok("E5 the Copy door DISABLED (the disabled-law's second witness — no script aboard)",
    e1.copyDisabled === true, `label="${e1.copyLabel}" disabled=${e1.copyDisabled}`);
  ok("E6 the badges still honest (the strategy speaks even when the script cannot)",
    e1.modeLeaf >= 1 && e1.gpuLeaf >= 1, `mode="${e1.modeWord}" gpu="${e1.gpuWord}"`);
  ok("E7 the error face's census held (zero unnamed WITH the dialog up)",
    censusOk(e1), `btns=${e1.pageBtns}`);
  evalJson(ESC_LAST);
  sleep(1.2);
  evalJson(ESC_LAST);
  sleep(1.5);

  /* ---------- Face W: the world back + the seed hygiene ---------- */
  console.log("Face W — the world back (fresh load, settled)");
  ab("open http://localhost:3000");
  sleep(3);
  const w1 = settle("the restored canvas");
  if (corpse(w1, "Face W")) throw new Error("corpse at Face W — the honest stop");
  ok("W1 the world unharmed (canvas count == the opening count, zero unnamed)",
    w1.pageBtns === OPEN && w1.pageUnnamed === 0 && !w1.hasDlg,
    `btns=${w1.pageBtns} (opening ${OPEN})`);
  const jobsAtClose = (await retryFetch(roster, "the roster at close")).length;
  ok("W2 the jobs count == the opening count (the t872 rogue-row census's guard)",
    jobsAtClose === jobsAtOpen, `jobs ${jobsAtOpen} -> ${jobsAtClose}`);
  const regAfter = await retryFetch(getRegistry, "the registry re-read");
  ok("W3 the registry still bit-for-bit (the world's own door, re-read)",
    JSON.stringify(regAfter) === JSON.stringify(origRegistry));
  ok("W4 the ride leaves no session seed (the t157 two-way door's honest none)",
    w1.seed === "" || w1.seed === null, `seed=${JSON.stringify(w1.seed)}`);

  worldRestored = true;

  /* ---------- the ledger at birth (five faces, the shared law) ---------- */
  console.log("Ledger — the t861 birthright aboard from birth (five faces, the shared law)");
  const prevFaces = cmp.prev?.faces ?? null;
  const scalarOf = (m) => m.pageBtns;
  const faces = {
    canvas: ledgerFace(prevFaces ? prevFaces.canvas?.live ?? null : null, m0, scalarOf),
    sbatchDialog: ledgerFace(prevFaces ? prevFaces.sbatchDialog?.live ?? null : null, d1, scalarOf),
    profileSwitch: ledgerFace(prevFaces ? prevFaces.profileSwitch?.live ?? null : null, p1s, scalarOf),
    errorFace: ledgerFace(prevFaces ? prevFaces.errorFace?.live ?? null : null, e1, scalarOf),
    worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
  };
  for (const [name, f] of Object.entries(faces)) {
    const v = armVerdict(cmp, world, f);
    ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
  }

  /* ---------- verdict + receipt ---------- */
  const verdict = fail === 0
    ? `the sbatch dialog's faces hold — the tools-menu home's own room walked: the clean room held, the refine3d host's plain door opened the inspector, the wrench's menu spoke its ONE item in words and the CLICK (the t872 deterministic door) summoned the dialog as the topmost layer; the heading followed the door, the t808 region workspace held its name and tab stop, the script pre landed named and keyboard-armed (the arrival was the pre's own content), the strategy badges spoke, the Copy door named and enabled (the disabled-law's first witness), the slurmNotes spoke, and the Gantt projection rode the same room; the registry grew by ONE through the world's own POST door and the profile switch moved the script's OWN WORDS (the partition line gpu -> a100, a different script); the clipboard probed first (${clip}) and the label spoke its true state either way; Escape peeled exactly one layer; the registry restored bit-for-bit and the deleted selection FELL BACK (the code's own law, witnessed); the motioncorr host's error face spoke the danger box with the pre never landing (the honest-empty doctrine) and the Copy door disabled (the second witness); the world back bit-for-bit (${OPEN} == ${OPEN}), the jobs count unchanged (no rogue rows), and the ride left no session seed — the ledger aboard from birth (five faces, the shared law)`
    : `${fail} red — the sbatch layer moved; call the census's own instruments before any UI work`;

  const driftLedger = {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevBuild,
    prevDate: prevReceipt?.date ?? null,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces,
  };

  const receipt = {
    instrument: "scripts/t873-sbatch-a11y.mjs",
    ruler: NAMEOF_LAW,
    build: buildId,
    worldMode: world.mode,
    date: new Date().toISOString(),
    chain: "clean room -> canvas -> host card (plain door) -> inspector -> tools door (the wrench, trusted click) -> the ONE item (Slurm sbatch dry-run…) -> sbatch dialog (topmost, the pre's own arrival) -> profile switch (registry planted via POST, listbox filmed, the partition's words moved) -> copy door (clipboard probed first, both branches honest) -> Escape -> registry restored bit-for-bit -> fallback law (the deleted selection falls back) -> error face (motioncorr, the honest empty, the disabled door) -> worldBack + jobs census + registry re-read + seed hygiene (one command)",
    doors: {
      inspector: "plain pointerdown+pointerup on the host card — the submitted law",
      toolsMenu: "trusted CDP click on [aria-label='More job tools'] — the t323 door-to-tools contract",
      sbatchDialog: "trusted CDP click on [data-testid='tools-sbatch-item'] — the t872 deterministic door, no Enter gambles",
      profileSwitch: "pointer pair on the filmed [role=option] — Radix SelectItem selects on pointerup",
      copyDoor: "synthetic click on the filmed button — the t868 text-door shape",
      close: "Escape — one layer per peel",
      registryPlant: "POST /api/hpc/profiles (the t259 metadata door) — restored bit-for-bit at exit",
    },
    clipboard: clip,
    hosts: {
      script: { name: host.name, id: host.id, measured: true },
      error: host2 ? { name: host2.name, id: host2.id, measured: true } : null,
    },
    openingCanvas: OPEN,
    registryPlanted: PLANTED.id,
    registryRestored: restored.same,
    faces: {
      canvas: { live: m0 },
      sbatchDialog: { live: d1, secondRide: d1b },
      profileSwitch: { live: p1s },
      errorFace: { live: e1 },
      worldBack: { live: w1 },
    },
    checks: results,
    passed: pass,
    failed: fail,
    total: pass + fail,
    verdict,
    driftLedger,
  };
  writeFileSync(join(ROOT, "shots-qa/t873-sbatch-a11y.json"), JSON.stringify(receipt, null, 2));

  console.log(`\nSBATCH-A11Y t873: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
  exitCode = fail === 0 ? 0 : 1;
} catch (e) {
  /* the honest stop: say why, write the red receipt, let the finally
   * bring the registry home */
  console.error(`  ✗ the ride stopped honestly: ${String(e && e.message || e).slice(0, 160)}`);
  writeFileSync(
    join(ROOT, "shots-qa/t873-sbatch-a11y.json"),
    JSON.stringify({
      instrument: "scripts/t873-sbatch-a11y.mjs",
      ruler: NAMEOF_LAW,
      build: buildId,
      worldMode: world.mode,
      date: new Date().toISOString(),
      checks: results,
      passed: pass,
      failed: fail + 1,
      total: pass + fail + 1,
      verdict: `the honest stop: ${String(e && e.message || e).slice(0, 200)}`,
      registryPlanted: PLANTED.id,
    }, null, 2)
  );
  exitCode = 1;
} finally {
  if (!worldRestored) {
    /* the honest exit: the registry MUST come home even on a red ride */
    try {
      const r = await restoreRegistry();
      console.log(`  (exit-restore: registry ${r.same ? "bit-for-bit" : "MISMATCH — inspect manually"})`);
    } catch (e) {
      console.error(`  (exit-restore FAILED: ${String(e).slice(0, 120)})`);
    }
  }
}
process.exit(exitCode);
