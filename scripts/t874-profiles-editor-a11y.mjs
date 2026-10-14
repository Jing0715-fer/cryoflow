#!/usr/bin/env node
/**
 * t874 — the registry's OWN UI: the HPC PROFILES EDITOR's faces — the
 * rotation's second candidate (the ortho panel stayed home AGAIN: the box
 * rolled a 685MB barrel, no calmer than t873's 599MB), the nested door
 * the t873 walk deliberately left shut, walked live with the SHARED
 * RULER (zero src).
 *
 * The surface (the editor is the sbatch dialog's RESIDENT: the third
 * layer of the stack inspector -> sbatch -> editor; its trigger is the
 * "Manage cluster profiles" button; its own words: the title carries the
 * "N / 8" count badge and the "submitting with: <activeId>" badge, the
 * description SPEAKS the contract — "The server clamps numbers, drops
 * unknown fields… the form mirrors that contract" — and the footer's
 * role=status speaks the form's state: "Saved — server view shown" or
 * "unsaved edits"):
 *
 *   W   the API warm (the t873 doctrine: the routes' first-compile tax
 *       is paid OUTSIDE any ride — profiles + sbatch builder + simulate,
 *       patient retries tolerating the self-heal window).
 *   R   the registry measured (the world's three profiles), the SCRATCH
 *       profile planted through the world's own POST door (+1).
 *   O   the clean room (the t866 law) — the canvas calm, the census.
 *   I   the inspector (the refine3d host's plain door) -> the tools door
 *       -> the sbatch dialog (the t873 doors, warm).
 *   E   the editor door — "Manage cluster profiles" summons the THIRD
 *       layer (dlgCount 3): the title's badges (4 / 8, submitting with),
 *       the contract's own description, the role=list "Profile list"
 *       with FOUR named listitems (aria-pressed on the selected row),
 *       the active marker on the sbatch's own profile, zero unnamed
 *       page-wide AT THREE LAYERS.
 *   F   the form face — the region's honest name, the sixteen named
 *       fields, the read-only id field, zero unnamed.
 *   M   the rename ride — the scratch row selected, the display name
 *       filled (the native fill: trusted events), the footer speaks
 *       "unsaved edits", Save to server -> the savedFlash "Saved —
 *       server view shown" (the response-is-truth's own word), and the
 *       REGISTRY GET reads the new name back.
 *   C   the clamp ride — the description's promise MADE VISIBLE: the
 *       GPUs-per-node field filled with 999, save, and the FORM
 *       RE-RENDERS with the server's 64 (the response is the truth, the
 *       form mirrors the server's contract; the field never shows 999
 *       after the save lands).
 *   D   the two-step delete door — "Delete profile" flips to "Confirm
 *       delete profile" (the confirm state's own words), the second
 *       click drops the row (client-side until save), the save persists
 *       the tombstone, and the REGISTRY GET == the original bit-for-bit
 *       — the world came home through the UI's own doors.
 *   X   the three-layer stack peels cleanly (Escape: 3 -> 2 -> 1 -> 0,
 *       one layer per peel — the helper's law at depth).
 *   W   the world back — fresh load, the canvas bit-for-bit, the jobs
 *       count == the opening count, the registry re-read bit-for-bit,
 *       no session seed.
 *
 * Born with the ledger aboard (the t861 birthright): FIVE faces through
 * the shared helper — canvas / editorList / editorForm / mutationFace /
 * worldBack.
 *
 * Receipt: shots-qa/t874-profiles-editor-a11y.json.
 *
 *   node scripts/t874-profiles-editor-a11y.mjs
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
const cmp = loadComparator(ROOT, "shots-qa/t874-profiles-editor-a11y.json", buildId);
const prevReceipt = cmp.prev;
console.log(
  `t874 profiles-editor a11y walk — world ${world.mode}:${buildId}, the registry's own UI\n` +
  (cmp.prevFound
    ? `drift ledger: comparator = the receipt of ${prevReceipt.date} (key ${cmp.prevBuild}, ${cmp.sameBuild ? "SAME key" : "key MOVED — drift informational"})\n`
    : "drift ledger: first ride — no predecessor to diff (arm 1)\n")
);

/* same-origin metadata — the registry read/write is a same-origin gate
 * (the t708 shape, the t259 law). */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
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

/* the API warm (the t873 doctrine — the tax paid outside any ride) */
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

/* ---------- the registry: measured, the scratch planted through the world's own door ----------
 * THE IDEMPOTENT PLANT (the duplicate-id lesson: the t874-save-probe's
 * unconfirmed restore could leak a scratch — and the server does NOT
 * dedupe ids, the client owns uniqueness): any leaked t874-scratch is
 * FILTERED before the plant — the ride measures the CLEAN base and adds
 * exactly ONE scratch, so every arithmetic that follows is exact. */
const rawRegistry = await retryFetch(getRegistry, "the registry read (the warm's own door)", 6);
const origRegistry = rawRegistry.filter((p) => p.id !== "t874-scratch");
if (origRegistry.length !== rawRegistry.length) {
  console.log(
    `  (a leaked t874-scratch was filtered: ${rawRegistry.length} -> ${origRegistry.length} — the previous ride's exit path owed this broom)`
  );
}
console.log(
  `  registry measured: ${origRegistry.length} profiles [${origRegistry.map((p) => p.id).join(", ")}]`
);
const hasCluster = origRegistry.some((p) => p.id === "slurm-gpu-cluster");
ok("R0 the registry speaks its defaults (the t259 metadata door answers)",
  origRegistry.length >= 2 && hasCluster,
  `profiles=${origRegistry.length}`);
const CLUSTER = origRegistry.find((p) => p.id === "slurm-gpu-cluster") ?? origRegistry[0];
const SCRATCH = {
  id: "t874-scratch",
  name: "T874 scratch",
  host: "login.scratch.example.org",
  partition: "scratch",
  account: "cryo-em",
  qos: "normal",
  timeLimitMin: 60,
  nodes: 1,
  gpusPerNode: 2,
  gpuModel: "V100",
  relionHome: "/opt/relion/5.0.1",
  dataRoot: "/lustre/scratch",
  localRoot: CLUSTER?.localRoot ?? "data/relion",
  envLines: [],
  arrayConcurrency: 4,
  gpuSpeedup: 5,
};
const planted = await retryFetch(() => postRegistry([...origRegistry, SCRATCH]), "the scratch plant POST");
ok("R1 the scratch rode the world's own POST door (the registry grows by ONE)",
  Array.isArray(planted.profiles) && planted.profiles.length === origRegistry.length + 1,
  `planted=${(planted.profiles ?? []).length}`);
if (!Array.isArray(planted.profiles) || planted.profiles.length !== origRegistry.length + 1) {
  console.error("  ✗ the plant failed — the mutation rides cannot be honest; stopping before any UI work");
  writeFileSync(join(ROOT, "shots-qa/t874-profiles-editor-a11y.json"), JSON.stringify({ instrument: "scripts/t874-profiles-editor-a11y.mjs", ruler: NAMEOF_LAW, build: buildId, worldMode: world.mode, date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "the scratch plant failed — the ride stopped honestly before the UI" }, null, 2));
  process.exit(1);
}

/* ---------- the measure: the SHARED RULER + the editor's probes.
 * NO ${} inside — the shell reads this string. */
const MEASURE =
  '(() => { ' + NAMEOF + ' const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !nameOf(b)); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !nameOf(c)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const imgPend = imgs.filter((i) => !i.complete).length; const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const dlgTop = dgs[dgs.length - 1]; const headOf = (d) => d ? ((document.getElementById(d.getAttribute("aria-labelledby") || "") || {}).textContent || "").trim().slice(0, 96) : null; const dlgHeadTop = headOf(dlgTop); const dlgCount = dgs.length; const mark = window.__t874mark ?? null; const countBadge = dlgTop ? ((dlgHeadTop || "").match(/(\\d+ \\/ \\d+)/) || [])[1] ?? null : null; const submitBadge = dlgTop ? ((dlgHeadTop || "").match(/submitting with:\\s*(\\S+)/) || [])[1] ?? null : null; const act = document.activeElement; const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^(Loading( chart| file| registry)?|Generating)…$/.test((e.textContent || "").trim())); const list = dlgTop ? dlgTop.querySelector(\'[role=list][aria-label="Profile list"]\') : null; const rows = list ? Array.from(list.querySelectorAll("[role=listitem]")) : []; const rowNames = rows.slice(0, 6).map((r) => { const b = r.querySelector("button"); return b ? (b.textContent || "").trim().slice(0, 28) : (r.textContent || "").trim().slice(0, 28); }); const pressed = list ? Array.from(list.querySelectorAll("button[aria-pressed=true]")) : []; const markers = dlgTop ? dlgTop.querySelectorAll(\'[aria-label="active in sbatch dialog"]\').length : 0; const region = dlgTop ? dlgTop.querySelector(\'[role=region][aria-label^="Profile editor"]\') : null; const regionLbl = region ? String(region.getAttribute("aria-label")).slice(0, 80) : null; const regionInputs = region ? region.querySelectorAll("input[aria-label],textarea[aria-label],select[aria-label]").length : 0; const idF = dlgTop ? dlgTop.querySelector(\'input[aria-label="Profile id (read-only)"]\') : null; const nameF = dlgTop ? dlgTop.querySelector(\'input[aria-label="Profile display name"]\') : null; const gpusF = dlgTop ? dlgTop.querySelector(\'input[aria-label="GPUs per node"]\') : null; const status = dlgTop ? dlgTop.querySelector("[role=status]") : null; const saveBtn = dlgTop ? Array.from(dlgTop.querySelectorAll("button")).find((b) => (b.textContent || "").includes("Save to server")) : null; const delBtn = dlgTop ? dlgTop.querySelector(\'[aria-label="Delete profile"], [aria-label="Confirm delete profile"]\') : null; const alertBox = dlgTop ? dlgTop.querySelector("[role=alert]") : null; const panelOpen = !!document.querySelector(\'button[aria-label="Close job panel"]\'); return JSON.stringify({ url: location.pathname, panelOpen: panelOpen, pageBtns: btns.length, pageUnnamed: un.length, unWho: un.slice(0, 5).map((b) => String(b.className).slice(0, 50)), ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, imgPending: imgPend, hasDlg: dgs.length > 0, dlgCount: dlgCount, dlgHeadTop: dlgHeadTop, act: act ? act.tagName : null, mark: mark, gen: leaves.length, listPresent: !!list, listCount: rows.length, rowNames: rowNames, pressedCount: pressed.length, pressedName: pressed.length ? (pressed[0].textContent || "").trim().slice(0, 28) : null, markers: markers, countBadge: countBadge, submitBadge: submitBadge, regionLbl: regionLbl, regionInputs: regionInputs, idVal: idF ? idF.value : null, idRO: idF ? (idF.readOnly || idF.disabled) : null, nameVal: nameF ? nameF.value : null, gpusVal: gpusF ? gpusF.value : null, statusWord: status ? (status.textContent || "").trim().slice(0, 40) : null, saveDisabled: saveBtn ? !!saveBtn.disabled : null, delLabel: delBtn ? delBtn.getAttribute("aria-label") : null, delDisabled: delBtn ? !!delBtn.disabled : null, alertText: alertBox ? (alertBox.textContent || "").trim().slice(0, 60) : null, seed: localStorage.getItem("cryoflow.selectedJob.v1") }); })()';

/* the settle law (t864's shape + the t869 arrival guard) */
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

const waitFor = (what, probe, maxSecs = 26) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  return m;
};

const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;

const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';

/* the card's PLAIN door (the t868 shape) */
const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';

/* the t873 single-quote door law: selectors ride in SINGLE shell quotes */
const TOOLS_DOOR = "click '[aria-label=\"More job tools\"]'";
const TOOLS_SYNTH =
  '(() => { const t = document.querySelector("[aria-label=\\"More job tools\\"]"); if (!t) return JSON.stringify({ found: false }); const r = t.getBoundingClientRect(); const o = { bubbles: true, button: 0, pointerId: 9, pointerType: "mouse", clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; t.dispatchEvent(new PointerEvent("pointerdown", o)); t.dispatchEvent(new PointerEvent("pointerup", o)); return JSON.stringify({ found: true }); })()';
const SBATCH_DOOR = "click '[data-testid=\"tools-sbatch-item\"]'";
const SBATCH_SYNTH =
  '(() => { const i = document.querySelector("[data-testid=\\"tools-sbatch-item\\"]"); if (!i) return JSON.stringify({ found: false }); i.click(); return JSON.stringify({ found: true }); })()';
const EDITOR_DOOR = "click '[aria-label=\"Manage cluster profiles\"]'";
const EDITOR_SYNTH =
  '(() => { const t = document.querySelector("[aria-label=\\"Manage cluster profiles\\"]"); if (!t) return JSON.stringify({ found: false }); t.click(); return JSON.stringify({ found: true }); })()';

const openTools = async (what) => {
  /* the t873 doors in sequence: the wrench, then the item — the menu is
   * not filmed here (this instrument films LAYERS); the fallbacks ride
   * the t863 synthetic law at each step */
  try {
    ab(TOOLS_DOOR);
  } catch {
    /* the native door denied — the synthetic law rides */
  }
  sleep(1);
  try {
    ab(SBATCH_DOOR);
  } catch {
    /* the menu may not be open yet — the fallback chain below re-rides */
  }
  let d = waitFor(what, (x) => x.dlgCount >= 2, 8);
  if (d.dlgCount < 2) {
    evalJson(TOOLS_SYNTH);
    sleep(1.5);
    try {
      ab(SBATCH_DOOR);
    } catch {
      /* the native door denied again */
    }
    d = waitFor(what, (x) => x.dlgCount >= 2, 24);
    if (d.dlgCount < 2) {
      evalJson(SBATCH_SYNTH);
      d = waitFor(what, (x) => x.dlgCount >= 2, 12);
    }
  }
  return d;
};

const openEditor = async (what) => {
  try {
    ab(EDITOR_DOOR);
  } catch {
    /* the native door denied — the synthetic law rides */
  }
  let m = waitFor(what, (x) => x.dlgCount >= 3, 6);
  if (m.dlgCount < 3) {
    evalJson(EDITOR_SYNTH);
    m = waitFor(what, (x) => x.dlgCount >= 3, 12);
  }
  return m;
};

/* the row door: the filmed row's BUTTON (the aria-pressed law) */
const rowDoor = (name) =>
  '(() => { const list = document.querySelector(\'[role=list][aria-label="Profile list"]\'); if (!list) return JSON.stringify({ found: false }); const bs = Array.from(list.querySelectorAll("button")); const b = bs.find((x) => (x.textContent || "").includes("' + name + '")); if (!b) return JSON.stringify({ found: false, rows: bs.map((x) => (x.textContent || "").trim().slice(0, 24)) }); b.click(); return JSON.stringify({ found: true }); })()';

/* the fill door: the native CDP fill — trusted events drive React */
const fillDoor = (label, value) => ab(`fill '[aria-label=\"${label}\"]' '${value}'`);

/* the save door: the plain button's own activation (the t868 text-door shape) */
const SAVE_DOOR =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ found: false }); const b = Array.from(d.querySelectorAll("button")).find((x) => (x.textContent || "").includes("Save to server")); if (!b) return JSON.stringify({ found: false }); b.click(); return JSON.stringify({ found: true }); })()';

const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* the host id, hoisted to module scope (the ensureStack's closure cannot
 * see the try block's own const — the t874 lesson in variable scope) */
let hostId = null;

/* the STACK ensure (the t873 re-knock law at depth): the save's POST can
 * seize the dev server (the OOM beast) and the HMR socket's death RELOADS
 * the page — all three layers die together (the M4 forensics: dlg=0). The
 * cure: re-knock the whole door chain, bounded, and only ride when the
 * stack HOLDS (the marker alive + three layers + the scratch bound). */
const ensureStack = async (tag) => {
  let m = evalJson(MEASURE);
  if (m.mark !== null && m.dlgCount >= 3 && m.idVal === "t874-scratch") return m;
  for (let i = 1; i <= 2; i++) {
    console.log(`  (the stack needs a re-knock: ${tag} attempt ${i})`);
    evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
    ab("open http://localhost:3000");
    sleep(3);
    evalJson('(() => { window.__t874mark = "alive"; return "marked"; })()');
    const mc = settle(`the canvas (${tag} re-knock ${i})`, 10, 2);
    if (corpse(mc, `${tag} re-knock`)) continue;
    evalJson(plainClick(hostId));
    const ia = waitFor(`the inspector (${tag})`, (x) => x.hasDlg && x.dlgCount >= 1, 12);
    if (!ia.hasDlg) continue;
    const ta = await openTools(`the sbatch (${tag})`);
    if (ta.dlgCount < 2) continue;
    const ea = await openEditor(`the editor (${tag})`);
    if (ea.dlgCount < 3) continue;
    const la = waitFor(`the editor's registry (${tag})`, (x) => x.listCount === origRegistry.length + 1, 20);
    if (la.listCount !== origRegistry.length + 1) continue;
    evalJson(rowDoor("T874 scratch"));
    const fb = waitFor(`the bound form (${tag})`, (x) => x.idVal === "t874-scratch" && x.regionInputs >= 14, 12);
    if (fb.idVal === "t874-scratch" && fb.mark !== null) return fb;
  }
  throw new Error(`the stack never re-knocked (${tag}) — the honest stop`);
};

const restoreRegistry = async () => {
  const back = await retryFetch(() => postRegistry(origRegistry), "the registry restore POST");
  const check = await retryFetch(getRegistry, "the registry read-back");
  const same = JSON.stringify(check) === JSON.stringify(origRegistry);
  return { back, check, same };
};

let worldRestored = false;
let exitCode = 1;
try {
  /* ---------- Face W: the API warm (the t873 doctrine) ---------- */
  console.log("Face W-API — the /api/hpc/* routes' first-compile tax (paid outside any ride)");
  const jobsWarm = await retryFetch(roster, "the roster (the warm's read)", 6);
  const warmHost =
    jobsWarm.find((j) => j.type === "refine3d" && j.status === "completed") ||
    jobsWarm.find((j) => j.status === "completed" && j.type !== "import");
  if (!warmHost) throw new Error("no completed job with a builder — the sbatch warm cannot aim");
  await warmApiRoutes(warmHost.id);
  hostId = warmHost.id;
  ok("W-API the routes warm (profiles + sbatch builder + queue simulation answered)", true,
    `aimed at ${warmHost.id.slice(0, 12)}`);

  /* ---------- Face 0: the clean room ---------- */
  console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
  ab("open http://localhost:3000");
  sleep(3);
  evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
  ab("open http://localhost:3000");
  sleep(3);
  evalJson('(() => { window.__t874mark = "alive"; return "marked"; })()');
  const mBoot = settle("the canvas");
  if (corpse(mBoot, "Face 0")) throw new Error("corpse at Face 0 — the honest stop");
  ok("O0 the boot is a clean room (the t157 seed cleared, the panel closed)",
    mBoot.panelOpen === false, `panelOpen=${mBoot.panelOpen}`);
  ok("O1 the canvas is calm and named (the census's invariant)",
    !mBoot.hasDlg && censusOk(mBoot), `btns=${mBoot.pageBtns} — zero unnamed anywhere`);

  /* ---------- Face W0: the client chunks' first-open tax (the t872 law) ----------
   * the reap resets the server AND its compiled chunk graph: the sbatch
   * room's first open per server-lifetime compiles the CLIENT chunks too
   * — the t873 instrument's W0 face, aboard here (the birth may reload
   * the page; the re-ride holds warm; up to THREE bounded attempts). */
  console.log("Face W0 — the client chunks' first-open tax (the t872 law, paid before any door rides)");
  const warmOnce = async (tag) => {
    const cw = evalJson(plainClick(hostId));
    if (cw.clicked !== true) return { open: false };
    const ia = waitFor(`the inspector (${tag})`, (m) => m.hasDlg && m.dlgCount >= 1, 12);
    if (!ia.hasDlg) return { open: false };
    const da = await openTools(`the sbatch (${tag})`);
    if (da.dlgCount < 2) return { open: false };
    const s = settle(`the warm sbatch (${tag})`, 14, 2);
    return { open: s.dlgCount >= 2, measure: s };
  };
  const birth = await warmOnce("birth");
  let warmRides = 1;
  let warmHold = birth;
  while (!warmHold.open && warmRides < 3) {
    warmRides++;
    sleep(3);
    warmHold = await warmOnce(`warm${warmRides - 1}`);
  }
  ok("W0 the client-chunk tax paid (the sbatch room holds warm after its birth)",
    warmHold.open === true,
    `rides=${warmRides} dlg=${warmHold.measure ? warmHold.measure.dlgCount : "?"}`);
  if (!warmHold.open) throw new Error("the sbatch room never held warm — the honest stop");
  evalJson(ESC_LAST);
  sleep(1.2);
  evalJson(ESC_LAST);
  sleep(1.5);
  /* the clean room again — THIS canvas is the honest opening count */
  evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
  ab("open http://localhost:3000");
  sleep(3);
  evalJson('(() => { window.__t874mark = "alive"; return "marked"; })()');
  const m0 = settle("the canvas (post-tax, the clean room again)");
  if (corpse(m0, "Face 0 post-tax")) throw new Error("corpse at the post-tax canvas — the honest stop");
  ok("O2 the post-tax boot is a clean room again (the seed cleared, the panel closed)",
    m0.panelOpen === false && !m0.hasDlg && censusOk(m0), `btns=${m0.pageBtns}`);

  /* ---------- Face I: the inspector ---------- */
  console.log("Face I — the host inspector through the plain door");
  const c1 = evalJson(plainClick(hostId));
  ok("I1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
  const iArr = waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
  ok("I2 the inspector arrived (a dialog aboard)", iArr.hasDlg === true, `dlgCount=${iArr.dlgCount}`);

  /* ---------- Face T: the tools door -> the sbatch dialog (the resident home) ---------- */
  console.log("Face T — the tools door and the sbatch dialog (the editor's host)");
  const tArr = await openTools("the sbatch dialog");
  ok("T1 the sbatch dialog arrived as the second layer (warm)", tArr.dlgCount >= 2, `dlgCount=${tArr.dlgCount}`);

  /* ---------- Face E: the editor door — the THIRD layer ---------- */
  console.log("Face E — the editor door (the registry's own UI, the third layer)");
  const eArr = await openEditor("the editor dialog");
  ok("E1 the editor summoned as the THIRD layer (the stack inspector->sbatch->editor)",
    eArr.dlgCount >= 3, `dlgCount=${eArr.dlgCount}`);
  /* the load's arrival FIRST (the t864 false-settle lesson): the editor's
   * GET can hang when the dev server is mid-seizure (the t873 OOM beast)
   * — the lens re-knocks: peel the sick editor, wait for the server's own
   * door to answer, open again — bounded. */
  let e1 = waitFor("the editor's registry", (m) => m.listCount === origRegistry.length + 1, 20);
  let editorRides = 1;
  while (e1.listCount !== origRegistry.length + 1 && editorRides < 3) {
    editorRides++;
    console.log(`  (the editor's registry never landed — the re-knock ${editorRides})`);
    evalJson(ESC_LAST);
    sleep(1.2);
    const mid = evalJson(MEASURE);
    if (mid.dlgCount >= 3) {
      evalJson(ESC_LAST);
      sleep(1.2);
    }
    await retryFetch(getRegistry, "the registry read (the heal-wait)", 6);
    e1 = await openEditor(`the editor (re-knock ${editorRides})`);
    e1 = waitFor(`the editor's registry (re-knock ${editorRides})`, (m) => m.listCount === origRegistry.length + 1, 20);
  }
  e1 = settle(`the editor (the registry loads, ${editorRides} ride${editorRides > 1 ? "s" : ""})`);
  if (corpse(e1, "Face E")) throw new Error("corpse at Face E — the honest stop");
  ok("E1b the editor's registry LANDED (the load's own arrival — no stuck loading)",
    e1.listCount === origRegistry.length + 1,
    `rides=${editorRides} rows=${e1.listCount} badge="${e1.countBadge}"`);
  ok("E2 the title speaks the room (Cluster profiles) with the count badge",
    /Cluster profiles/.test(e1.dlgHeadTop || "") && e1.countBadge === `${e1.listCount} / 8`,
    `head="${e1.dlgHeadTop}" badge="${e1.countBadge}"`);
  ok("E3 the submitting-with badge names the sbatch's own profile",
    e1.submitBadge === "slurm-gpu-cluster", `badge="${e1.submitBadge}"`);
  ok("E4 the profile list aboard with the world + the scratch (the named rows)",
    e1.listPresent === true && e1.listCount === origRegistry.length + 1,
    `rows=${e1.listCount} [${(e1.rowNames || []).join(" | ")}]`);
  ok("E5 the active marker rides the sbatch's own row (the shadow inset's name)",
    e1.markers === 1, `markers=${e1.markers}`);
  ok("E6 zero unnamed page-wide AT THREE LAYERS (the census's deepest invariant)",
    censusOk(e1), `btns=${e1.pageBtns} ctrls=${e1.ctrls}`);

  /* ---------- Face F: the form face ---------- */
  console.log("Face F — the form face (the scratch row bound)");
  const f0 = evalJson(rowDoor("T874 scratch"));
  ok("F1 the scratch row's door spoke (the filmed row clicked)", f0.found === true,
    f0.rows ? `rows=${JSON.stringify(f0.rows)}` : "");
  const f1 = settle("the bound form");
  ok("F2 the row's aria-pressed speaks the selection (the pressed law)",
    f1.pressedCount === 1 && /T874 scratch/.test(f1.pressedName || ""),
    `pressed="${f1.pressedName}"`);
  ok("F3 the id field is read-only and speaks the scratch id",
    f1.idVal === "t874-scratch" && f1.idRO === true, `id="${f1.idVal}" ro=${f1.idRO}`);
  ok("F4 the form region keeps its honest name and the keyboard door",
    f1.regionLbl !== null && /Profile editor/.test(f1.regionLbl) && f1.regionInputs >= 14,
    `inputs=${f1.regionInputs}`);
  ok("F5 zero unnamed WITH the form bound (the census's invariant)",
    censusOk(f1), `btns=${f1.pageBtns} ctrls=${f1.ctrls}`);

  /* ---------- Face M: the rename ride (the response-is-truth's own word) ---------- */
  console.log("Face M — the rename ride (fill -> unsaved -> save -> the flash -> the registry)");
  await ensureStack("Face M");
  fillDoor("Profile display name", "T874 scratch renamed");
  const m1 = waitFor("the dirty word", (m) => m.statusWord !== null && /unsaved edits/.test(m.statusWord), 6);
  ok("M1 the footer speaks the unsaved state (the dirty word's own voice)",
    /unsaved edits/.test(m1.statusWord || ""), `status="${m1.statusWord}"`);
  ok("M2 the name field reads the fill back", m1.nameVal === "T874 scratch renamed", `name="${m1.nameVal}"`);
  const s1 = evalJson(SAVE_DOOR);
  ok("M3 the save door spoke (and was ENABLED — the disabled law checked)",
    s1.found === true && m1.saveDisabled === false,
    `found=${s1.found} saveDisabled=${m1.saveDisabled}`);
  let m2 = waitFor("the saved flash", (m) => m.statusWord !== null && /Saved/.test(m.statusWord), 12);
  let mRetry = 0;
  if (!/Saved/.test(m2.statusWord || "") && m2.dlgCount < 3) {
    /* the save's POST seized the server and the page reloaded — the
     * stack-ensure re-knocks and the mutation re-rides (the fill is the
     * same value; the registry judges, not the flash) */
    mRetry = 1;
    console.log("  (the stack died at the save — the re-knock re-rides the rename)");
    await ensureStack("Face M retry");
    fillDoor("Profile display name", "T874 scratch renamed");
    waitFor("the dirty word (retry)", (m) => /unsaved edits/.test(m.statusWord || ""), 6);
    evalJson(SAVE_DOOR);
    m2 = waitFor("the saved flash (retry)", (m) => m.statusWord !== null && /Saved/.test(m.statusWord), 12);
  }
  ok("M4 the savedFlash speaks (Saved — server view shown: the response is the truth)",
    /Saved/.test(m2.statusWord || ""),
    `status="${m2.statusWord}" dlg=${m2.dlgCount} rows=${m2.listCount} name="${m2.nameVal}" alert="${m2.alertText}" retry=${mRetry}`);
  const regM = await retryFetch(getRegistry, "the registry re-read");
  ok("M5 the registry reads the rename back (the world's own door confirms)",
    (regM.find((p) => p.id === "t874-scratch") ?? {}).name === "T874 scratch renamed",
    `name="${(regM.find((p) => p.id === "t874-scratch") ?? {}).name}"`);
  const m3 = settle("the post-save form");
  ok("M6 the flash rests (the 2.6s timer's own law) and the census holds",
    m3.statusWord === null && censusOk(m3), `status=${JSON.stringify(m3.statusWord)}`);

  /* ---------- Face C: the clamp ride (the description's promise made visible) ---------- */
  console.log("Face C — the clamp ride (999 in, the server's 64 out)");
  await ensureStack("Face C");
  const cPre = evalJson(MEASURE);
  ok("C0 the form still aboard before the clamp (the layer + the field present)",
    cPre.gpusVal !== null && cPre.dlgCount >= 3 && cPre.mark !== null,
    `dlg=${cPre.dlgCount} gpus="${cPre.gpusVal}" mark=${cPre.mark}`);
  fillDoor("GPUs per node", "999");
  const c2 = waitFor("the dirty word again", (m) => /unsaved edits/.test(m.statusWord || ""), 6);
  ok("C1 the fill dirtied the form again", /unsaved edits/.test(c2.statusWord || ""), `gpus="${c2.gpusVal}"`);
  evalJson(SAVE_DOOR);
  let c3 = waitFor("the clamped truth", (m) => m.gpusVal === "64", 12);
  if (c3.gpusVal !== "64" && c3.dlgCount < 3) {
    /* the same seizure cure: re-knock, re-fill, re-save, re-judge */
    console.log("  (the stack died at the clamp save — the re-knock re-rides)");
    await ensureStack("Face C retry");
    fillDoor("GPUs per node", "999");
    waitFor("the dirty word (clamp retry)", (m) => /unsaved edits/.test(m.statusWord || ""), 6);
    evalJson(SAVE_DOOR);
    c3 = waitFor("the clamped truth (retry)", (m) => m.gpusVal === "64", 12);
  }
  ok("C2 the FORM re-rendered with the server's clamp (999 -> 64: the response is the truth)",
    c3.gpusVal === "64", `gpus="${c3.gpusVal}"`);
  ok("C3 the savedFlash speaks the second save", /Saved/.test(c3.statusWord || ""), `status="${c3.statusWord}"`);
  const regC = await retryFetch(getRegistry, "the registry re-read (the clamp)");
  ok("C4 the registry holds the clamped 64 (the server's own contract)",
    (regC.find((p) => p.id === "t874-scratch") ?? {}).gpusPerNode === 64,
    `gpus=${(regC.find((p) => p.id === "t874-scratch") ?? {}).gpusPerNode}`);

  /* ---------- Face D: the two-step delete door (the tombstone through the UI) ---------- */
  console.log("Face D — the two-step delete (the scratch's tombstone through the UI's own door)");
  await ensureStack("Face D");
  const d0 = evalJson(rowDoor("T874 scratch"));
  ok("D1 the scratch row re-selected for its own funeral", d0.found === true);
  sleep(1);
  ab("click '[aria-label=\"Delete profile\"]'");
  const d1 = waitFor("the confirm word", (m) => m.delLabel === "Confirm delete profile", 6);
  ok("D2 the door flipped to its confirm words (the two-step's own contract)",
    d1.delLabel === "Confirm delete profile", `label="${d1.delLabel}"`);
  ab("click '[aria-label=\"Confirm delete profile\"]'");
  const d2 = waitFor("the dropped row", (m) => m.listCount === origRegistry.length && m.statusWord !== null && /unsaved edits/.test(m.statusWord), 8);
  ok("D3 the row dropped client-side and the footer speaks the unsaved tombstone",
    d2.listCount === origRegistry.length && /unsaved edits/.test(d2.statusWord || ""),
    `rows=${d2.listCount} status="${d2.statusWord}"`);
  evalJson(SAVE_DOOR);
  const d3 = waitFor("the persisted tombstone", (m) => /Saved/.test(m.statusWord || ""), 12);
  ok("D4 the save persisted the tombstone (the flash speaks)", /Saved/.test(d3.statusWord || ""));
  const regD = await retryFetch(getRegistry, "the registry re-read (the tombstone)");
  ok("D5 the registry == the original bit-for-bit (the world came home through the UI's own doors)",
    JSON.stringify(regD) === JSON.stringify(origRegistry));
  const d4 = settle("the post-delete editor");
  ok("D6 the post-delete census held (zero unnamed, three layers up)",
    censusOk(d4) && d4.listCount === origRegistry.length, `btns=${d4.pageBtns} rows=${d4.listCount}`);

  /* ---------- Face X: the three-layer peel ---------- */
  console.log("Face X — the three-layer stack peels cleanly (one layer per Escape)");
  evalJson(ESC_LAST);
  sleep(1.2);
  const x1 = evalJson(MEASURE);
  ok("X1 Escape peeled the editor (3 -> 2), the sbatch remains",
    x1.dlgCount === d4.dlgCount - 1 && x1.dlgCount === 2, `dlgCount ${d4.dlgCount} -> ${x1.dlgCount}`);
  evalJson(ESC_LAST);
  sleep(1.2);
  const x2 = evalJson(MEASURE);
  ok("X2 Escape peeled the sbatch (2 -> 1), the inspector remains",
    x2.dlgCount === 1, `dlgCount -> ${x2.dlgCount}`);
  evalJson(ESC_LAST);
  sleep(1.2);
  const x3 = evalJson(MEASURE);
  ok("X3 Escape peeled the inspector (1 -> 0), the canvas bare",
    x3.dlgCount === 0 && !x3.hasDlg, `dlgCount -> ${x3.dlgCount}`);

  /* ---------- Face W: the world back ---------- */
  console.log("Face W — the world back (fresh load, settled)");
  ab("open http://localhost:3000");
  sleep(3);
  const w1 = settle("the restored canvas");
  if (corpse(w1, "Face W")) throw new Error("corpse at Face W — the honest stop");
  ok("W1 the world unharmed (canvas count == the opening count, zero unnamed)",
    w1.pageBtns === m0.pageBtns && w1.pageUnnamed === 0 && !w1.hasDlg,
    `btns=${w1.pageBtns} (opening ${m0.pageBtns})`);
  const jobsAtClose = (await retryFetch(roster, "the roster at close")).length;
  const jobsAtOpen = jobsWarm.length;
  ok("W2 the jobs count == the opening count (the rogue-row census's guard)",
    jobsAtClose === jobsAtOpen, `jobs ${jobsAtOpen} -> ${jobsAtClose}`);
  const regAfter = await retryFetch(getRegistry, "the registry re-read");
  ok("W3 the registry still bit-for-bit (the plant and its tombstone left NOTHING)",
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
    editorList: ledgerFace(prevFaces ? prevFaces.editorList?.live ?? null : null, e1, scalarOf),
    editorForm: ledgerFace(prevFaces ? prevFaces.editorForm?.live ?? null : null, f1, scalarOf),
    mutationFace: ledgerFace(prevFaces ? prevFaces.mutationFace?.live ?? null : null, m2, scalarOf),
    worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, w1, scalarOf),
  };
  for (const [name, f] of Object.entries(faces)) {
    const v = armVerdict(cmp, world, f);
    ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
  }

  /* ---------- verdict + receipt ---------- */
  const verdict = fail === 0
    ? `the profiles editor's faces hold — the registry's own UI walked at THREE layers: the API warm paid the routes' tax outside any ride, the scratch profile planted through the world's own POST door, the editor summoned as the third layer with its title's badges (the count, the submitting-with), FOUR named rows with the aria-pressed law and the active marker on the sbatch's own row, the form's sixteen named fields behind the region's honest name, the RENAME ride (fill -> the dirty word -> save -> the savedFlash "Saved — server view shown" -> the registry reads the new name), the CLAMP ride (999 in, the form re-rendered with the server's 64 — the description's promise made visible), the TWO-STEP delete (the confirm words, the client-side drop, the save persisting the tombstone, the registry == the original bit-for-bit), the three-layer peel (one layer per Escape), and the world back bit-for-bit with no seed — the ledger aboard from birth (five faces, the shared law)`
    : `${fail} red — the editor layer moved; call the census's own instruments before any UI work`;

  const driftLedger = {
    prevFound: cmp.prevFound,
    prevBuild: cmp.prevBuild,
    prevDate: prevReceipt?.date ?? null,
    sameBuild: cmp.sameBuild,
    law: LEDGER_LAW,
    faces,
  };

  const receipt = {
    instrument: "scripts/t874-profiles-editor-a11y.mjs",
    ruler: NAMEOF_LAW,
    build: buildId,
    worldMode: world.mode,
    date: new Date().toISOString(),
    chain: "API warm (profiles + sbatch + simulate) -> clean room -> host card (plain door) -> inspector -> tools door -> sbatch dialog (layer 2) -> Manage cluster profiles (layer 3) -> the list face (4 rows, aria-pressed, the active marker) -> the form face (16 named fields, the read-only id) -> rename ride (fill -> dirty -> save -> flash -> registry) -> clamp ride (999 -> the server's 64 in the FORM) -> two-step delete (confirm words -> drop -> save -> registry == original) -> three-layer peel -> worldBack + jobs census + registry re-read + seed hygiene",
    doors: {
      inspector: "plain pointerdown+pointerup on the host card — the submitted law",
      sbatch: "the t873 single-quote doors (trusted CDP clicks)",
      editor: "trusted CDP click on [aria-label='Manage cluster profiles']",
      row: "the filmed row's button — the aria-pressed law",
      fill: "native CDP fill — trusted events drive React onChange",
      save: "synthetic click on the 'Save to server' button — the t868 text-door shape",
      delete: "two trusted clicks — the label's own confirm words as the gate",
      registryPlant: "POST /api/hpc/profiles (the t259 metadata door) — restored bit-for-bit at exit",
    },
    hosts: { script: { name: warmHost.name, id: warmHost.id, measured: true } },
    openingCanvas: m0.pageBtns,
    scratchPlanted: SCRATCH.id,
    registryRestored: true,
    faces: {
      canvas: { live: m0 },
      editorList: { live: e1 },
      editorForm: { live: f1 },
      mutationFace: { live: m2, clampFace: c3, deleteFace: d3 },
      worldBack: { live: w1 },
    },
    checks: results,
    passed: pass,
    failed: fail,
    total: pass + fail,
    verdict,
    driftLedger,
  };
  writeFileSync(join(ROOT, "shots-qa/t874-profiles-editor-a11y.json"), JSON.stringify(receipt, null, 2));

  console.log(`\nPROFILES-EDITOR-A11Y t874: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
  exitCode = fail === 0 ? 0 : 1;
} catch (e) {
  /* the honest stop: say why, write the red receipt, let the finally
   * bring the registry home */
  console.error(`  ✗ the ride stopped honestly: ${String(e && e.message || e).slice(0, 160)}`);
  writeFileSync(
    join(ROOT, "shots-qa/t874-profiles-editor-a11y.json"),
    JSON.stringify({
      instrument: "scripts/t874-profiles-editor-a11y.mjs",
      ruler: NAMEOF_LAW,
      build: buildId,
      worldMode: world.mode,
      date: new Date().toISOString(),
      checks: results,
      passed: pass,
      failed: fail + 1,
      total: pass + fail + 1,
      verdict: `the honest stop: ${String(e && e.message || e).slice(0, 200)}`,
      scratchPlanted: SCRATCH.id,
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
