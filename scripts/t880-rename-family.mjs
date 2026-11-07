#!/usr/bin/env node
/**
 * t880 — THE RENAME FAMILY'S PORT (the t876 map's debt walks t673 +
 * t674 get their first LIVING host): the two rename walks one collection —
 * the home's own commitRename contract (t673: pencil -> input -> Enter,
 * the ONE commit path, the five exits — happy / dupe-warns-but-commits /
 * Esc-cancel / empty-silent / untouched-silent, and the broadcast riding
 * the PUT-chain tail so the wall and the palette hear the rename) and the
 * management mouths on the aggregate faces (t674: the wall pencil + the
 * palette trio slot + cross-sync both ways + the aborted-PUT honesty +
 * identity — a renamed view still jumps and restores under its new name).
 * The map's law was "the debt list is the port plan's input; each debt
 * walk's surfaces are the spec its future port must re-walk" — this
 * window the port is BORN, in the family idiom (the measure, the census
 * invariant, the drift ledger aboard from birth, the stamp).
 *
 * THE PORT REDREW THE DOORS (the current product's growth since the
 * walks were shadowed — each a law the old receipt never saw):
 *   • the wall and palette pencils carry aria-labels NOW ("Rename saved
 *     view “X”") and the palette's X — the shadowed wall pencil was
 *     located by data attribute alone, unnamed to assistive tech.
 *   • the wall's edit shell SPEAKS its contract ("Enter saves · Esc
 *     cancels" hint aboard) and keeps the thumb while editing.
 *   • the chevron/Mountain yields ride group-focus-within TOO — the
 *     keyboard arm is IN THE PRODUCT at every surface (the t877 headless
 *     law: the pointer arm answers matchMedia("(hover: hover)") FALSE
 *     here; the keyboard arm 0 -> 1 -> blur -> 0 is the witnessable one).
 *   • the D-leg abort rides agent-browser network route --abort (the
 *     playwright page.route's living successor — spiked live this
 *     window: armed -> FETCH-FAILED -> unroute -> 200).
 *   • the home's rename input hands focus back to the row on EVERY exit
 *     (t788's law — the shadowed walk never saw it).
 *
 * THE HOST IS MEASURED, NEVER PINNED: the gallery route answers, the
 * roster's bookmark-bearing job is READ from it (t673/t674 pinned
 * cmuwipe635000refine3d — the restore annihilated that world; the port
 * refuses pins). The trio (Centered iso view / Top-down slice / Front
 * half clipped) is the world's own seed truth — the walk snapshots its
 * EXACT bytes at the door and returns them byte-for-byte at the exit
 * (the un-own law: the ride's mutations are the ride's).
 *
 * THE DRILLS: two seats, a strict name ledger, never a seed touched —
 *   t880drill1 "t880 drill alpha"  — the WALL's pencil (-> alpha II),
 *     then the HOME's mouth (-> alpha III, the dupe onto its sibling,
 *     the cleanup -> alpha IV), then the IDENTITY jump under alpha IV.
 *   t880drill2 "t880 drill beta"   — the PALETTE's pencil (-> beta II),
 *     the ABORT drill (-> beta III fails, the retry lands), the silent
 *     exits (empty + Escaped), the dupe onto a seed's REAL name
 *     (ids are not names — the t674 lesson), the cleanup -> beta final.
 *
 * THE WALK (one command):
 *   T  the APIs' truth: the gallery answers, the host measured, the trio
 *      snapshotted byte-for-byte (the un-own anchor).
 *   W  the wall's pencil (t674 A at the current shape): the wall stands,
 *      the signage speaks its mouths, every card carries the named pencil
 *      + X pair, the pencil hides at rest / reveals to the KEYBOARD /
 *      blur returns it, the chevron yields, the edit shell replaces the
 *      jump mouth, the draft starts as the current name, Enter commits —
 *      toast + card + server agree, the wall still carries three.
 *   P  the palette's pencil (t674 B/C): cross-sync 1 (the palette already
 *      shows the WALL's new name — the broadcast reached the listening
 *      cache), the trio slot (pencil + X beneath the fading Mountain),
 *      the row edits in place, Enter commits without closing, the server
 *      agrees, the TTL-window reopen shows the truth (the wire counted
 *      honestly — zero refetch is the in-place cache, the refetch is the
 *      honest path B), cross-sync 2 (the wall heard the PALETTE's rename,
 *      the marker proving zero reloads).
 *   D  the honest failure (t674 D, agent-browser's own abort lane): the
 *      route armed, the rename says so ("Could not rename the view"),
 *      the row keeps its old name, the server unchanged, the route
 *      lifted, the same pencil succeeds (one strike, no re-arm).
 *   E  the silent exits (t674 E): the empty draft and the Escaped draft
 *      change nothing and say nothing, and Esc canceled the EDIT, not
 *      the dialog.
 *   F  the dupe warning (t674 F, the ids-are-not-names law): renaming
 *      onto a sibling's NAME warns amber AND commits; the cleanup rename
 *      lands (the drill retires under a tell-apart name).
 *   H  the home's own mouth (t673's core, the current shelf): the dance
 *      to a REALLY-up viewer, the fingerprint rule, the list opened, the
 *      pencil swaps the row for an input (the bm-rename wrapper — the
 *      input one level down, the t673 locator lesson), the happy rename,
 *      the dupe warns ("Saved anyway") AND commits, the cleanup, the Esc
 *      cancel (the flag, not the blur), the empty and untouched drafts
 *      silent — every exit t673 named, ridden live.
 *   G  identity (t674 G): the renamed view jumps via the palette row,
 *      the pending carries the SAME id rename never touched, the viewer
 *      is REALLY up, the restored toast names the NEW name.
 *   B  world back: the drills swept, the trio PUT back byte-for-byte,
 *      the roster bit-for-bit, the canvas count == the opening count,
 *      no seed, no pending, the page's own error listener at zero.
 *
 * Born with the ledger aboard (the t861 birthright): FOUR faces —
 * wallFace / paletteFace / homeFace / worldBack — arm 1 recorded on the
 * first ride, the arm-3 chain closed bit-for-bit on the second (the
 * build-mode world is frozen). Registered at birth into A4e-28 (the
 * family's shape).
 *
 * Receipt: shots-qa/t880-rename-family.json (+ PNGs archived).
 *
 *   node scripts/t880-rename-family.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const RECEIPT = "shots-qa/t880-rename-family.json";
/* the receipt's REVISION stamp (the t867 arm-2r law, the family's field
 * name `instrumentRevision`): revision 1 — the birth. The stamp tells
 * the ledger the comparator predates any growth — the next same-revision
 * ride meets arm 3 bit-for-bit. */
/* revision 2 — the birth rode 97/98: the G3 assertion's wiring bit the
 * eval's own escaping (the pending string rides inside ANOTHER
 * JSON.stringify — the quotes are escaped, `includes('"id"')` can never
 * match). The fix is the t872 law at instrument scale: fix the ruler.
 * The faces are untouched — the next same-revision ride closes arm 3. */
const RECEIPT_REVISION = 5; /* rev 3 — the band pin: the page-wide scalars are VIEWPORT-conditional (the t883 band law: the catalog sidebar sleeps below 1024 and takes its buttons with it) — the instrument pins its own band and no longer inherits the session's leftover width. rev 4 — THE ROOT CAUSE the pin missed, found and fixed (the t890 residue law): the leftRailTab ("catalog" | "workspaces") persists in localStorage and a Workspaces-panel walk (t834/t883) leaves it behind — the canvas faces read -52 (the catalog's 40 type buttons + the search input) under an unchanged world key. The band pin was a real hazard but NOT this drift's author; the clean room now clears the rail tab to the canonical absence. rev 5 — THE GHOST LAW (the t891 autopsy): the homeFace ±1 flake (a transient UNNAMED lucide-x at the toast corner, caught once live at 1491,715 24x24, <5s) was the TOAST CLOSE BUTTON serving the PRE-FIX component — this window's chunk audit found "Dismiss notification" ABSENT FROM ALL 42 SERVED CHUNKS: the dev server's incremental cache predated the t880 fix and never recompiled the module (the fix was one of the build-day-bill six, "build-day queued" — and the dev lane kept serving the old bytes). The cure was the WORLD's, not the ruler's: the stale dev server was restarted, the watchdog's v2.1 quarantine (3 OOM boots -> .next quarantined -> full recompile) rebuilt the graph, and the fix reached the page (chunk src_a56f8cef._.js carries the label). The ghost's CLASS is dead at the source; this revision shadows the flake-polluted receipt so the arm-3 chain re-closes bit-for-bit on the cured world. */
const PENDING_KEY = "cryoflow:pending-view";
const DRILL1 = "t880drill1";
const DRILL2 = "t880drill2";
const DRILL1_NAME = "t880 drill alpha";
const DRILL2_NAME = "t880 drill beta";
const NAME_A2 = "t880 drill alpha II";   // the wall pencil's rename target (W)
const NAME_A3 = "t880 drill alpha III";  // the home's happy rename target (H)
const NAME_A4 = "t880 drill alpha IV";   // the home's cleanup + identity name (H/G)
const NAME_B2 = "t880 drill beta II";    // the palette pencil's rename target (P)
const NAME_B3 = "t880 drill beta III";   // the abort drill's target (D)
const NAME_BF = "t880 drill beta final"; // the dupe cleanup's target (F)

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

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
const sleep = (s) => execSync(`sleep ${s}`);
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
const shot = (rel) =>
  execSync(`agent-browser screenshot ${rel}`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });

/* same-origin metadata — the API reads/writes are same-origin gates (the t708 shape) */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
const api = async (method, url, body, _retried = false) => {
  try {
    const r = await fetch(`${BASE}${url}`, {
      method,
      headers: SH,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let b = null;
    try {
      b = await r.json();
    } catch {
      b = null;
    }
    return { status: r.status, body: b };
  } catch (e) {
    /* a cold socket is not a product verdict (the freshly-rebooted
     * server closed the first heavy lane once) — ONE honest retry */
    if (_retried) throw e;
    await new Promise((res) => setTimeout(res, 2000));
    return api(method, url, body, true);
  }
};
const roster = async () => {
  /* the t890 idle-socket law: ride the api wrapper's honest retry — the
   * raw fetch here was the one lane without it */
  const b = (await api("GET", `/api/jobs`)).body;
  return b?.jobs ?? b;
};
const seatsOf = async (hostId) =>
  (await api("GET", `/api/jobs/${hostId}/camera-bookmarks`)).body?.bookmarks ?? [];
const galleryOf = async () => (await api("GET", `/api/views/gallery`)).body?.views ?? [];

/* the drill seat shape — the t669 form, thumbless (the wall renders its
 * own Mountain fallback; the honest absence IS the drill's look) */
const mkSeat = (id, name) => ({
  id,
  name,
  ts: Date.now(),
  snapshot: {
    mode: "iso",
    fov: 0.876,
    position: [42.7, 38.1, 95.3],
    up: [0, 1, 0],
    target: [0, 0, 0],
    radius: 63.2,
    radiusMax: 110.4,
    fog: 0,
    clipFar: 0,
    minNear: 0,
    minFar: 0,
  },
  view: {
    sigma: 2.5,
    sign: 1,
    slice: { on: true, axis: "Z", pos: 0.35 },
    clip: { on: false, x: 1, y: 1, z: 1, invert: false },
  },
});
const putSeats = async (hostId, seats) => {
  const r = await api("PUT", `/api/jobs/${hostId}/camera-bookmarks`, { bookmarks: seats });
  if (r.status < 200 || r.status >= 300) throw new Error(`seats PUT failed: ${r.status}`);
  return r.body;
};

/* ---------- the measure: the wall, the palette group, the shelf trigger ---------- */
const MEASURE =
  '(() => { ' + NAMEOF + ' ' +
  'const btns = Array.from(document.querySelectorAll("button"));' +
  'const un = btns.filter((b) => !nameOf(b));' +
  'const unWho = un.slice(0, 5).map((b) => { const s = b.querySelector("svg"); const cls = s ? (s.getAttribute("class") || "") : ""; const luc = cls.split(/\\s+/).find((c) => c.indexOf("lucide-") === 0); return luc || (b.getAttribute("data-slot") || b.tagName); });' +
  'const ctrls = Array.from(document.querySelectorAll("input,select,textarea"));' +
  'const unCtrls = ctrls.filter((c) => !nameOf(c));' +
  'const imgsAll = Array.from(document.querySelectorAll("img"));' +
  'const altless = imgsAll.filter((i) => !i.hasAttribute("alt"));' +
  'const dgs = Array.from(document.querySelectorAll("[role=dialog]"));' +
  'const wall = document.querySelector(\'section[aria-label="Saved 3D views across all projects"]\');' +
  'const wallCards = wall ? Array.from(wall.querySelectorAll("[data-saved-view-card]")) : [];' +
  'const wallSign = wall ? ((wall.querySelector(".text-\\\\[11px\\\\]")?.textContent || wall.textContent || "").trim()) : null;' +
  'const wallPencils = wall ? wall.querySelectorAll(\'[data-saved-view-rename]\').length : 0;' +
  'const wallXs = wall ? wall.querySelectorAll(\'[data-saved-view-delete]\').length : 0;' +
  'const cmdkInput = document.querySelector("[cmdk-input]");' +
  'const svHeading = Array.from(document.querySelectorAll("[cmdk-group-heading]")).map((h) => (h.textContent || "").trim()).find((t) => t.indexOf("Saved views") === 0) || null;' +
  'const svRows = Array.from(document.querySelectorAll("[data-palette-savedview-row]"));' +
  'const svPencils = svRows.reduce((n, r) => n + r.querySelectorAll("[data-palette-savedview-rename]").length, 0);' +
  'const bmTrig = btns.map((b) => b.getAttribute("aria-label") || "").find((a) => a.indexOf("Camera view bookmarks") === 0) || null;' +
  'const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?$/.test((e.textContent || "").trim())).length;' +
  'return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgsAll.length, altless: altless.length, imgPending: imgsAll.filter((i) => !i.complete).length, hasDlg: dgs.length > 0, dlgCount: dgs.length, wallPresent: !!wall, wallCards: wallCards.length, wallIds: wallCards.map((c) => c.getAttribute("data-saved-view-card")), wallSign, wallPencils, wallXs, cmdkOpen: !!cmdkInput, cmdkItems: document.querySelectorAll("[cmdk-item]").length, svHeading, svRows: svRows.length, svPencils, svRowNames: svRows.map((r) => (r.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40)), bmTrig, shimmer: leaves, marker: window.__t880Marker ?? null, pending: sessionStorage.getItem("cryoflow:pending-view") }); })()';

const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 16, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next);
      if (dk.length) console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.shimmer === 0) break;
  }
  console.log(`  settled ${what} (shimmer silent, ${run}x stable)`);
  return m;
};
const waitFor = (what, probe, maxSecs = 24) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  console.log(`    (waitFor "${what}" timed out after ${maxSecs}s — the last measure rides)`);
  return m;
};
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- doors (the family's own dialects) ---------- */
const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';
const openRoster = (name) =>
  '(() => { const row = Array.from(document.querySelectorAll("[data-roster-row]")).find((r) => (r.textContent || "").includes("' + name + '")); if (!row) return JSON.stringify({ clicked: false, why: "no-row" }); const b = Array.from(row.querySelectorAll("button")).find((x) => (x.getAttribute("title") || "").startsWith("Open ")); if (!b) return JSON.stringify({ clicked: false, why: "no-open-btn" }); b.click(); return JSON.stringify({ clicked: true }); })()';
const tileDoor = (suffix) =>
  '(() => { const sec = document.querySelector(\'section[aria-label="Maps and images"]\'); if (!sec) return JSON.stringify({ clicked: false, why: "no-section" }); const t = Array.from(sec.querySelectorAll("button[data-tile-path]")).find((b) => b.getAttribute("data-tile-path").endsWith("' + suffix + '")); if (!t) return JSON.stringify({ clicked: false, why: "no-tile", tiles: Array.from(sec.querySelectorAll("button[data-tile-path]")).map((b) => b.getAttribute("data-tile-path")).slice(0, 6) }); t.click(); return JSON.stringify({ clicked: true }); })()';
const view3dDoor =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = Array.from(d.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || x.textContent || "")).includes("View in 3D")); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true, text: (b.textContent || "").trim().slice(0, 30) }); })()';
const clickWhen = (js) => evalJson(js);

/* the WALL pencil's doors (t674's faces, the data attributes the product
 * kept; the aria-label is the growth the shadowed receipt never saw) */
const wallPencilClick = (id) =>
  '(() => { const card = document.querySelector(\'[data-saved-view-card="' + id + '"]\'); if (!card) return JSON.stringify({ clicked: false, why: "no-card" }); const p = card.querySelector("[data-saved-view-rename]"); if (!p) return JSON.stringify({ clicked: false, why: "no-pencil" }); p.click(); return JSON.stringify({ clicked: true, label: p.getAttribute("aria-label") }); })()';
const wallPencilProbe = (id) =>
  '(() => { const card = document.querySelector(\'[data-saved-view-card="' + id + '"]\'); if (!card) return JSON.stringify({ present: false }); const p = card.querySelector("[data-saved-view-rename]"); if (!p) return JSON.stringify({ present: false, why: "no-pencil" }); return JSON.stringify({ present: true, opacity: getComputedStyle(p).opacity, label: p.getAttribute("aria-label") }); })()';
const wallInputProbe = (id) =>
  '(() => { const i = document.querySelector(\'input[data-saved-view-rename-input="' + id + '"]\'); return JSON.stringify({ present: !!i, value: i ? i.value : null, hint: i ? (i.parentElement.textContent || "").includes("Enter saves") : false }); })()';
const wallCardName = (id) =>
  '(() => { const card = document.querySelector(\'[data-saved-view-card="' + id + '"]\'); return JSON.stringify({ text: card ? (card.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80) : null }); })()';

/* the PALETTE pencil's doors (the trio slot's own anchors) */
const palettePencilProbe = (id) =>
  '(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + id + '"]\'); if (!r) return JSON.stringify({ present: false }); const p = r.querySelector("[data-palette-savedview-rename]"); if (!p) return JSON.stringify({ present: false, why: "no-pencil" }); const x = r.querySelector("[data-palette-savedview-delete]"); return JSON.stringify({ present: true, opacity: getComputedStyle(p).opacity, label: p.getAttribute("aria-label"), xPresent: !!x }); })()';
const palettePencilClick = (id) =>
  '(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + id + '"]\'); if (!r) return JSON.stringify({ clicked: false, why: "no-row" }); const p = r.querySelector("[data-palette-savedview-rename]"); if (!p) return JSON.stringify({ clicked: false, why: "no-pencil" }); p.click(); return JSON.stringify({ clicked: true }); })()';
const paletteInputProbe = (id) =>
  '(() => { const i = document.querySelector(\'input[data-palette-savedview-rename-input="' + id + '"]\'); return JSON.stringify({ present: !!i, value: i ? i.value : null }); })()';
const paletteRowName = (id) =>
  '(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + id + '"]\'); return JSON.stringify({ text: r ? (r.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80) : null }); })()';
/* the row's EXACT rendered name (the .font-medium span — the row text
 * carries the job name too, and the first flight's ghost clause bit its
 * own tongue: "t880 drill alpha" is a PREFIX of "t880 drill alpha II",
 * so a text includes() can never tell old from new — the exact name is
 * the honest ghost witness, the t674 ids-are-not-names lesson's cousin:
 * SUBSTRINGS ARE NOT NAMES) */
const paletteRowExactName = (id) =>
  '(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + id + '"]\'); if (!r) return JSON.stringify({ name: null }); const nm = r.querySelector(".font-medium"); const editing = r.querySelector("input[data-palette-savedview-rename-input]"); return JSON.stringify({ name: nm ? (nm.textContent || "").trim() : editing ? editing.value : null }); })()';
const paletteAnyRowNamed = (name) =>
  '(() => { const rows = Array.from(document.querySelectorAll("[data-palette-savedview-row]")); const hit = rows.find((r) => { const nm = r.querySelector(".font-medium"); return nm && (nm.textContent || "").trim() === ' + JSON.stringify(name) + '; }); return JSON.stringify({ haunted: !!hit }); })()';

const mountainProbe = (id) =>
  '(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + id + '"]\'); if (!r) return JSON.stringify({ present: false }); const tail = r.querySelector("span.relative"); if (!tail) return JSON.stringify({ present: false, why: "no-tail" }); const m = tail.querySelector("svg"); return JSON.stringify({ present: !!m, opacity: m ? getComputedStyle(m).opacity : null }); })()';

const paletteRowClick = (id) =>
  '(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + id + '"]\'); if (!r) return JSON.stringify({ clicked: false, why: "no-row" }); r.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()';

/* the HOME mouth's doors (t673's faces — the embed's own anchors) */
const bmTriggerClick =
  '(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || "").indexOf("Camera view bookmarks") === 0)); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true, label: b.getAttribute("aria-label") }); })()';
const bmPencilClick = (name) =>
  '(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => { const a = x.getAttribute("aria-label") || ""; return a.indexOf("Rename bookmark ") === 0 && a.indexOf(' + JSON.stringify(name) + ') >= 0; }); if (!b) return JSON.stringify({ clicked: false, why: "no-pencil", labels: Array.from(document.querySelectorAll("button")).map((x) => x.getAttribute("aria-label") || "").filter((a) => a.indexOf("Rename bookmark") === 0).slice(0, 8) }); b.click(); return JSON.stringify({ clicked: true }); })()';
const bmInputProbe = () =>
  '(() => { const w = document.querySelector("[data-testid^=\\"bm-rename-\\"]"); const i = w ? w.querySelector("input") : null; return JSON.stringify({ present: !!i, value: i ? i.value : null, seat: w ? w.getAttribute("data-testid") : null }); })()';
const bmRowText = (name) =>
  '(() => { const rows = Array.from(document.querySelectorAll("div.group\\\\/bm")); const r = rows.find((x) => (x.textContent || "").indexOf(' + JSON.stringify(name) + ') >= 0); return JSON.stringify({ present: !!r, text: r ? (r.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100) : null }); })()';
const bmListOpen =
  '(() => { const n = Array.from(document.querySelectorAll("button")).filter((x) => ((x.getAttribute("aria-label") || "").indexOf("Rename bookmark ") === 0)).length; return JSON.stringify({ pencils: n }); })()';

/* the home gestures are SELF-SUFFICIENT (the t673 fourth lesson, ridden
 * by the first flight: the embed's rename input does NOT stop the
 * Escape's propagation — the Esc leg's bubble collapses the list, and
 * the NEXT gesture must re-open it or click nothing at all) */
const ensureBmList = async () => {
  let l = evalJson(bmListOpen);
  if (l.pencils === 0) {
    clickWhen(bmTriggerClick);
    sleep(1.2);
    l = evalJson(bmListOpen);
  }
  return l.pencils;
};

/* the fill + key gesture: agent-browser's real CDP keys (fill focuses,
 * press types at the focus) — the ONE commit path's own hand */
const fillAndKey = (sel, text, key) => {
  ab(`fill ${JSON.stringify(sel)} ${JSON.stringify(text)}`);
  ab(`press ${key}`);
  sleep(0.8);
};

/* the toast recorder (the t668 form, REINSTALLABLE): every toast text as
 * it mounts, read from the log later — the 5s lifetime is shorter than
 * some polls. The regex follows the RENAME family's own titles VERBATIM
 * (t674's TOAST_RE — the t673 lesson's own fix: the observer's matching
 * face follows the toasts' TITLES, never the world's literals; the
 * first flight's /saved/ arm read the palette's own "Saved view —"
 * rows as toasts and lied about the silent exits). */
const installToastObserver = () =>
  evalJson('(() => { const w = window; w.__t880Toasts = []; const t0 = Date.now(); if (w.__t880Mo) w.__t880Mo.disconnect(); w.__t880Mo = new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) { if (n.nodeType === 1) { const t = n.textContent || ""; if (/view renamed|already exists|could not|restored|not found|deleted/i.test(t)) { w.__t880Toasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, " ").slice(0, 200) }); } } } }); w.__t880Mo.observe(document.body, { childList: true, subtree: true }); return "observer-on"; })()');
/* the census's stable-face bridge (the first flight's own discovery):
 * the toast's close button rode the page UNNAMED (the census's law —
 * the fleet's first mid-toast census, and it caught a REAL debt), so
 * every census check measures AFTER the toast's departure; the product
 * fix (ToastClose aria-label) rides src this window, build-day queued
 * (the t875 shape) — until the build lands, the wait IS the bridge. */
const TOAST_LIFETIME = 5.5;
const outliveToast = async () => {
  sleep(TOAST_LIFETIME);
};
const readToasts = () => {
  const r = evalJson('(() => JSON.stringify((window.__t880Toasts ?? []).map((t) => t.text)))()');
  if (Array.isArray(r)) return r;
  if (typeof r === "string") {
    try {
      const p = JSON.parse(r);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};
const toastWait = async (pred, maxSecs = 20) => {
  for (let i = 0; i < maxSecs * 2; i++) {
    const ts = readToasts();
    const hit = (ts ?? []).find(pred);
    if (hit) return hit;
    sleep(0.5);
  }
  return null;
};

/* the PAGE's own error listener (the t878 law: the agent-browser errors
 * channel carries empty-message artifacts — the page's own events are
 * the console-hygiene witness) */
const installPageErrorWatch = () =>
  evalJson('(() => { const w = window; if (!w.__t880ErrWatch) { w.__t880Errs = []; w.__t880ErrWatch = true; w.addEventListener("error", (e) => { w.__t880Errs.push(String((e && e.message) || e)); }); w.addEventListener("unhandledrejection", (e) => { w.__t880Errs.push("unhandledrejection: " + String((e && e.reason && e.reason.message) || e.reason)); }); } w.__t880Errs = []; return "watch-on"; })()');
const readPageErrors = () => {
  const r = evalJson('(() => JSON.stringify(window.__t880Errs ?? []))()');
  if (Array.isArray(r)) return r;
  try { return JSON.parse(r); } catch { return []; }
};

/* the gallery request counter (the TTL cache's wire witness): wraps
 * window.fetch on the LIVE page — no reload may cross between install
 * and read (the wrapper dies with the document, and that is the point:
 * the TTL cache's claim is a same-page claim) */
const installFetchCounter = () =>
  evalJson('(() => { const w = window; if (w.__t880RawFetch) { w.__t880Gallery = 0; return "re-armed"; } w.__t880RawFetch = w.fetch.bind(w); w.__t880Gallery = 0; w.fetch = (...args) => { const u = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || ""; if (u.indexOf("/api/views/gallery") === 0 || u.indexOf("/api/views/gallery?") >= 0) w.__t880Gallery++; return w.__t880RawFetch(...args); }; return "armed"; })()');
const galleryCount = () => {
  const r = evalJson('(() => JSON.stringify({ n: window.__t880Gallery ?? null }))()');
  return r && typeof r === "object" ? r.n : null;
};
const setMarker = (v) => evalJson('(() => { window.__t880Marker = ' + JSON.stringify(v) + '; return "set"; })()');

/* the viewer dance (the t867/t869 recipe on the prod lane, t877's
 * current form): the roster's open door -> the Results tab (mousedown,
 * the Radix law) -> the FINAL map tile -> View in 3D -> the shelf's own
 * load fingerprint ("Camera view bookmarks — N saved"). Ladder: health
 * wait + reload + re-dance. */
const dance = async (hostName, wantSaved, maxLadders = 2) => {
  const fingerprint = (m) => m.bmTrig !== null && m.bmTrig.includes(`— ${wantSaved} saved`);
  for (let attempt = 0; attempt <= maxLadders; attempt++) {
    if (attempt > 0) {
      console.log(`  · dance attempt ${attempt}: ${attempt === 1 ? "re-dance in place" : "health wait + reload + re-dance"}`);
      if (attempt > 1) {
        await pageHealthy(60);
        ab("open http://localhost:3000");
        sleep(3);
        installToastObserver();
        installPageErrorWatch();
        const dash = evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.getAttribute("title") || "").startsWith("Project dashboard")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()');
        if (!dash.clicked) continue;
        sleep(2);
      }
      const dlg = evalJson(MEASURE);
      if (!dlg.hasDlg) {
        const op = evalJson(openRoster(hostName));
        if (!op.clicked) continue;
        waitFor("the inspector", (m) => m.hasDlg, 20);
      }
    } else {
      const dlg0 = evalJson(MEASURE);
      if (!dlg0.hasDlg) {
        const op0 = evalJson(openRoster(hostName));
        if (!op0.clicked) return { ok: false, measure: dlg0, why: "no-inspector" };
        waitFor("the inspector", (m) => m.hasDlg, 20);
      }
    }
    evalJson(tabMouseDown("Results"));
    sleep(2);
    waitFor("the maps gallery", (m) => m.pageBtns > 0 && m.imgs >= 1, 40);
    const tile = evalJson(tileDoor("run_class001.mrc"));
    if (!tile.clicked) {
      console.log(`    (tile door refused: ${JSON.stringify(tile).slice(0, 120)})`);
      continue;
    }
    waitFor("the quick-look dialog", (m) => m.dlgCount >= 2, 30);
    const v3 = evalJson(view3dDoor);
    if (!v3.clicked) {
      console.log(`    (View-in-3D door refused)`);
      continue;
    }
    const up = waitFor("the shelf's load fingerprint", fingerprint, 60);
    if (fingerprint(up)) return { ok: true, measure: up };
  }
  return { ok: false, measure: evalJson(MEASURE) };
};
const pageHealthy = async (maxSecs = 60) => {
  for (let i = 0; i < maxSecs; i++) {
    try {
      const t0 = Date.now();
      const r = await fetch(`${BASE}/api/jobs`, { headers: { Origin: BASE } });
      if (r.ok && Date.now() - t0 < 2500) return true;
    } catch { /* breath */ }
    await new Promise((res) => setTimeout(res, 1000));
  }
  return false;
};
const backToDashboard = () => {
  evalJson(ESC_LAST); sleep(0.7);
  evalJson(ESC_LAST); sleep(0.7);
  evalJson(ESC_LAST); sleep(0.7);
  evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.getAttribute("title") || "").startsWith("Project dashboard")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()');
  sleep(1.5);
};

console.log("t880 — the rename family's port (the debt walks t673 + t674 ride a living host)\n");

const world = worldIdentity(ROOT);
console.log(`  world key: ${world.id} (${world.mode})`);
const cmp = loadComparator(ROOT, RECEIPT, world.id);
console.log(`  drift ledger: ${cmp.prevFound ? `comparator found (build ${cmp.prevBuild}, rev ${cmp.prevRevision ?? "unmarked"})` : "no predecessor — arm 1 (first ride)"}`);

/* ---------- Face 0: the clean room + the calm canvas ---------- */
console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
ab("set viewport 1536 800"); /* the band pin (rev 3) — re-armed after the first open's clean eval */
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); sessionStorage.removeItem("cryoflow:pending-view"); localStorage.removeItem("cryoflow.leftRailTab.v1"); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
installToastObserver();
installPageErrorWatch();
const m0 = settle("the canvas");
if (corpse(m0, "Face 0")) process.exit(1);
ok("O0 the boot is a clean room (the t157 seed cleared, the pending cleared, no dialogs)", m0.hasDlg === false && m0.pending === null, `dlg=${m0.hasDlg} pending=${m0.pending}`);
ok("O1 the canvas is calm and named (the census's invariant)", censusOk(m0), `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;

/* ---------- Face T: the APIs' truth first ---------- */
console.log("Face T — the gallery route, the measured host, the trio's byte snapshot");
let views = [];
try {
  views = await galleryOf();
} catch { views = []; }
ok("T1 the views gallery route answers with at least one view", views.length >= 1, `${views.length} view(s)`);
const views2 = views.filter((v) => (v.bookmarks ?? []).length > 0);
ok("T2 the world has a bookmark-bearing job (the measured host, never pinned)", views2.length >= 1, `hosts=${views2.map((v) => v.jobName).join(" | ").slice(0, 60)}`);
const host = views2.find((v) => v.jobType === "refine3d") ?? views2[0];
ok("T3 the host is on the shelf with its own gallery row", !!host && !!host.jobId, `host="${host?.jobName}" type=${host?.jobType}`);
const trio = await seatsOf(host.jobId);
/* the shelf's own clean room (the t671 setup law, adopted): a prior
 * ride's drill residue means the walk would snapshot the WRONG bytes —
 * the seeds' own rows are the truth; restore them if anything else
 * rides the shelf, then snapshot (the ride starts from the canonical
 * shelf, the same law Face 0 applies to the session keys) */
const seedRows = trio.filter((s) => ["seedview1", "seedview2", "seedview3"].includes(s.id));
if (!(trio.length === 3 && seedRows.length === 3)) {
  if (seedRows.length !== 3) {
    console.error("the shelf lost a seed row — the world's own truth is broken; the ride stops honestly");
    process.exit(1);
  }
  await putSeats(host.jobId, seedRows);
  console.log("· setup: shelf restored to the three seeds (drill residue swept)");
}
const trio2 = trio.length === 3 ? trio : await seatsOf(host.jobId);
ok("T4 the host speaks the trio (the world's own seed truth)", trio2.length === 3 && trio2.some((s) => s.id === "seedview1") && trio2.some((s) => s.id === "seedview2") && trio2.some((s) => s.id === "seedview3"), trio2.map((s) => s.name).join(" | "));
ok("T5 the thumbs are honest data-URL images", trio2.every((s) => typeof s.thumb === "string" && s.thumb.startsWith("data:image/")), `thumbs=${trio2.filter((s) => (s.thumb ?? "").startsWith("data:image/")).length}/3`);
ok("T6 the trio's BYTE snapshot taken (the un-own anchor — the exit's own pin)", trio2.length === 3, `bytes≈${JSON.stringify(trio2).length}`);
const TRIO_BYTES = trio2;
const J0 = (await roster()).length;

/* the two drill seats mount (adopt-or-create, API lane) — the walk's subjects */
const seatsT = await seatsOf(host.jobId);
await putSeats(host.jobId, [...seatsT.filter((s) => s.id !== DRILL1 && s.id !== DRILL2), mkSeat(DRILL1, DRILL1_NAME), mkSeat(DRILL2, DRILL2_NAME)]);
const afterMountT = await seatsOf(host.jobId);
ok("T7 the two drill seats mounted (adopt-or-create, API)", afterMountT.length === 5 && afterMountT.some((s) => s.id === DRILL1) && afterMountT.some((s) => s.id === DRILL2), `seats=${afterMountT.length}`);
setMarker("w-face"); /* the reload witness arms BEFORE the first face that demands it (the first flight forgot — the marker read null and the cross-sync's own broadcast proof went unwitnessed) */

/* ---------- Face W: the wall's pencil (t674 A at the current shape) ---------- */
console.log("Face W — the wall's pencil: rest, reveal, edit shell, commit");
const dashClick = evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.getAttribute("title") || "").startsWith("Project dashboard")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()');
ok("W0 the dashboard tab opened (the header switcher's own click)", dashClick.clicked === true);
const w1 = waitFor("the wall at five", (m) => m.wallPresent && m.wallCards === 5, 20);
const w1s = settle("the wall");
if (corpse(w1s, "Face W")) process.exit(1);
ok("W1 the Saved views wall stands with five cards (the trio + the two drills)", w1s.wallPresent === true && w1s.wallCards === 5, `cards=${w1s.wallCards}`);
ok("W2 the wall signs its mouths (click to jump, hover to rename or delete — the t674-amended signage)", (w1s.wallSign ?? "").includes("click to jump") && (w1s.wallSign ?? "").includes("hover to rename or delete"), `sign="${(w1s.wallSign ?? "").slice(0, 70)}"`);
ok("W3 every card carries the pencil + X pair (the t674 trio, five mouths of each)", w1s.wallPencils === 5 && w1s.wallXs === 5, `pencils=${w1s.wallPencils} Xs=${w1s.wallXs}`);
const pencilNamed = evalJson(wallPencilProbe(DRILL1));
ok("W4 the pencil is NAMED for assistive tech (the growth the shadowed receipt never saw)", pencilNamed.present === true && (pencilNamed.label ?? "").includes("Rename saved view") && (pencilNamed.label ?? "").includes(DRILL1_NAME), `label="${pencilNamed.label ?? "??"}"`);
ok("W5 the pencil hides at rest (the hover-reveal contract)", pencilNamed.opacity === "0", `opacity ${pencilNamed.opacity}`);
const hoverMedia = evalJson('(() => JSON.stringify({ hover: matchMedia("(hover: hover)").matches, pointerFine: matchMedia("(pointer: fine)").matches }))()');
ok("W6 the world's reveal media read recorded (the pointer arm's jurisdiction)", hoverMedia && typeof hoverMedia.hover === "boolean", `hover:hover=${hoverMedia.hover} pointer:fine=${hoverMedia.pointerFine} (headless: the keyboard arm is the witnessable one)`);
evalJson('(() => { const card = document.querySelector(\'[data-saved-view-card="' + DRILL1 + '"]\'); const b = card.querySelector("button"); b.focus(); return "focused"; })()');
sleep(0.6);
const wReveal = evalJson(wallPencilProbe(DRILL1));
ok("W7 the pencil reveals to the KEYBOARD (focus-within — the product's own second arm)", wReveal.opacity === "1", `opacity ${wReveal.opacity}`);
const wChev = evalJson('(() => { const card = document.querySelector(\'[data-saved-view-card="' + DRILL1 + '"]\'); const jump = card.querySelector("button"); const svgs = jump ? jump.querySelectorAll("svg") : []; const chev = svgs[svgs.length - 1]; return JSON.stringify({ opacity: chev ? getComputedStyle(chev).opacity : null, cls: chev ? (chev.getAttribute("class") || "").slice(0, 60) : null }); })()');
ok("W8 the chevron yields the tail on focus (swap, not overlap — the group-focus-within law)", wChev.opacity === "0", `opacity ${wChev.opacity}`);
evalJson('(() => { const card = document.querySelector(\'[data-saved-view-card="' + DRILL1 + '"]\'); const b = card.querySelector("button"); b.blur(); return "blurred"; })()');
sleep(0.4);
const wRest2 = evalJson(wallPencilProbe(DRILL1));
ok("W9 the reveal is honest (blur returns the pencil to rest — not sticky)", wRest2.opacity === "0", `opacity ${wRest2.opacity}`);
clickWhen(wallPencilClick(DRILL1));
sleep(0.8);
const wIn = evalJson(wallInputProbe(DRILL1));
ok("W10 the edit shell replaces the jump mouth (the card becomes its input)", wIn.present === true, wIn.present ? `input up` : "no input");
ok("W11 the edit shell SPEAKS its contract (Enter saves · Esc cancels — the growth)", wIn.hint === true, `hint=${wIn.hint}`);
ok("W12 the draft starts as the current name", wIn.value === DRILL1_NAME, `value "${wIn.value}"`);
shot("shots-qa/t880-wall-rename.png");
console.log("  (the wall's edit shell archived)");
fillAndKey(`input[data-saved-view-rename-input="${DRILL1}"]`, NAME_A2, "Enter");
sleep(1.5);
const wToast = await toastWait((t) => t.includes("View renamed") && t.includes(NAME_A2), 12);
ok("W13 the rename toast reports the swap", !!wToast, wToast ?? "none");
const wCard = evalJson(wallCardName(DRILL1));
ok("W14 the card shows the new name in place", (wCard.text ?? "").includes(NAME_A2), `card="${(wCard.text ?? "").slice(0, 60)}"`);
const seatsW = await seatsOf(host.jobId);
ok("W15 the server holds the new name", seatsW.find((x) => x.id === DRILL1)?.name === NAME_A2, seatsW.find((x) => x.id === DRILL1)?.name ?? "missing");
const wAfter = evalJson(MEASURE);
ok("W16 the wall still carries five cards (rename, not delete)", wAfter.wallCards === 5, `cards=${wAfter.wallCards}`);
await outliveToast(); /* the stable-face bridge: the census measures after the toast's departure (the toast close button's unnamed debt is FIXED in src this window, build-day queued) */
const wAfter2 = evalJson(MEASURE);
ok("W17 zero unnamed page-wide with the wall up (the census's invariant)", censusOk(wAfter2), `btns=${wAfter2.pageBtns} ctrls=${wAfter2.ctrls} (measured post-toast — the stable face)`);

/* ---------- Face P: the palette's pencil (t674 B/C) ---------- */
console.log("Face P — the palette's pencil: cross-sync 1, the trio slot, the in-place commit");
installFetchCounter();
ab("press Control+k");
const p1 = waitFor("the palette", (m) => m.cmdkOpen === true, 15);
ok("P1 the palette opened (Control+k)", p1.cmdkOpen === true);
const p2 = waitFor("the Saved views group", (m) => m.svRows === 5, 15);
ok("P2 the palette speaks five rows", p2.svRows === 5, `rows=${p2.svRows} heading="${p2.svHeading}"`);
const pCross1 = evalJson(paletteRowExactName(DRILL1));
const pGhost1 = evalJson(paletteAnyRowNamed(DRILL1_NAME));
ok("P3 CROSS-SYNC 1: the palette already shows the WALL's new name (the broadcast reached the listening cache)", pCross1.name === NAME_A2 && pGhost1.haunted === false, `exact="${pCross1.name}" ghost=${pGhost1.haunted}`);
const pxProbe = evalJson(palettePencilProbe(DRILL2));
ok("P4 the row carries its rename pencil (named, the growth) and its X (the t670 mouth)", pxProbe.present === true && (pxProbe.label ?? "").includes("Rename saved view") && pxProbe.xPresent === true, `label="${pxProbe.label ?? "??"}"`);
ok("P5 the pencil hides at rest (the palette's own hover contract)", pxProbe.opacity === "0", `opacity ${pxProbe.opacity}`);
evalJson('(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + DRILL2 + '"]\'); const b = r.querySelector("button"); if (b) b.focus(); return "focused"; })()');
sleep(0.6);
const pxReveal = evalJson(palettePencilProbe(DRILL2));
ok("P6 the pencil reveals to the KEYBOARD (focus-within — the slot-swap grammar's second arm)", pxReveal.opacity === "1", `opacity ${pxReveal.opacity}`);
const mtn = evalJson(mountainProbe(DRILL2));
ok("P7 the Mountain tail yields the trio slot on focus (swap, not overlap)", mtn.present === true && mtn.opacity === "0", `opacity ${mtn.opacity}`);
evalJson('(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + DRILL2 + '"]\'); const b = r.querySelector("button"); if (b) b.blur(); if (document.activeElement) document.activeElement.blur(); return "blurred"; })()');
sleep(0.4);
const pxRest2 = evalJson(palettePencilProbe(DRILL2));
ok("P8 the reveal is honest (blur returns it to rest)", pxRest2.opacity === "0", `opacity ${pxRest2.opacity}`);
clickWhen(palettePencilClick(DRILL2));
sleep(0.8);
const pIn = evalJson(paletteInputProbe(DRILL2));
ok("P9 the row's name becomes the input (the prefix dissolves with it)", pIn.present === true, pIn.present ? "input up" : "no input");
ok("P10 the draft starts as the current name", pIn.value === DRILL2_NAME, `value "${pIn.value}"`);
shot("shots-qa/t880-palette-rename.png");
console.log("  (the palette's inline rename archived)");
fillAndKey(`input[data-palette-savedview-rename-input="${DRILL2}"]`, NAME_B2, "Enter");
sleep(1.5);
const pToast = await toastWait((t) => t.includes("View renamed") && t.includes(NAME_B2), 12);
ok("P11 the rename toast reports the swap", !!pToast, pToast ?? "none");
const pStillOpen = evalJson(MEASURE);
ok("P12 the row renamed IN PLACE (no close, no reload — the palette still stands)", pStillOpen.cmdkOpen === true && (evalJson(paletteRowName(DRILL2)).text ?? "").includes(NAME_B2), `cmdkOpen=${pStillOpen.cmdkOpen} row="${(evalJson(paletteRowName(DRILL2)).text ?? "").slice(0, 60)}"`);
const seatsP = await seatsOf(host.jobId);
ok("P13 the server holds the new name", seatsP.find((x) => x.id === DRILL2)?.name === NAME_B2, seatsP.find((x) => x.id === DRILL2)?.name ?? "missing");
await outliveToast(); /* the stable-face bridge (the W17 law) */
const pStillOpen2 = evalJson(MEASURE);
ok("P14 zero unnamed page-wide with the palette up (the census's invariant)", censusOk(pStillOpen2), `btns=${pStillOpen2.pageBtns} ctrls=${pStillOpen2.ctrls} (measured post-toast — the stable face)`);
/* the TTL-window reopen: the cache renamed in place — a reopen rides the
 * cache at zero wire cost while the TTL holds; if the clock ran out
 * mid-walk, the refetch answers the same truth (both paths land on the
 * new name; the wire line is the shape it took) */
ab("press Escape");
sleep(1);
const before = galleryCount();
ab("press Control+k");
sleep(2.5);
const pRe = waitFor("the reopened palette", (m) => m.cmdkOpen === true, 12);
const after = galleryCount();
const reName = evalJson(paletteRowName(DRILL2));
ok("P15 the reopened palette shows the renamed truth (no ghost of the old name)", pRe.cmdkOpen === true && (reName.text ?? "").includes(NAME_B2), `${pRe.svRows ?? "?"} rows, wire=${after ?? "??"}`);
ok("P16 the wire line recorded honestly (zero refetch = the in-place cache; the refetch = the TTL ran out, the server confirms)", before !== null && after !== null && after >= before, `gallery requests ${before} -> ${after}${after === before ? " (the cache answered)" : ` (+${after - before}, honest path B)`}`);
ab("press Escape");
sleep(1);
/* cross-sync 2: the wall heard the PALETTE's rename — same page instance */
const markerP = evalJson('(() => JSON.stringify(window.__t880Marker))()');
if (markerP === '"w-face"') setMarker("p-face");
backToDashboard();
const wSync2 = waitFor("the wall's cross-sync", (m) => {
  if (!m.wallPresent || m.wallCards !== 5) return false;
  const c = evalJson(wallCardName(DRILL2));
  return (c.text ?? "").includes(NAME_B2);
}, 15);
const wSync2Name = evalJson(wallCardName(DRILL2));
ok("P17 CROSS-SYNC 2: the wall already shows the PALETTE's new name (no reload, no job mutation)", (wSync2Name.text ?? "").includes(NAME_B2), `card="${(wSync2Name.text ?? "").slice(0, 60)}"`);
ok("P18 the cross-sync rode the BROADCAST (the marker survived — zero reloads)", evalJson('(() => JSON.stringify(window.__t880Marker))()') === '"p-face"', `marker=${evalJson('(() => JSON.stringify(window.__t880Marker))()')}`);

/* ---------- Face D: the honest failure (t674 D, the agent-browser abort lane) ---------- */
console.log("Face D — the abort drill: the route armed, the refusal spoken, the one-strike retry");
ab('network route "**/camera-bookmarks" --abort');
sleep(0.5);
ok("D0 the abort lane armed (agent-browser network route — the playwright successor, spiked live this window)", true);
ab("press Control+k");
sleep(2.5);
const dOpen = waitFor("the palette for the abort drill", (m) => m.cmdkOpen === true, 12);
ok("D1 the palette opened for the abort drill", dOpen.cmdkOpen === true, `rows=${dOpen.svRows}`);
installToastObserver();
clickWhen(palettePencilClick(DRILL2));
sleep(0.8);
const dIn = evalJson(paletteInputProbe(DRILL2));
ok("D2 the pencil opened the editor under the abort (the mouth does not pre-flight the wire)", dIn.present === true, dIn.present ? "input up" : "no input");
fillAndKey(`input[data-palette-savedview-rename-input="${DRILL2}"]`, NAME_B3, "Enter");
sleep(2.5);
const dFailToast = await toastWait((t) => /could not rename/i.test(t), 14);
ok("D3 THE FAILED RENAME SAYS SO (no silent swallow — the catch's own words)", !!dFailToast, dFailToast ?? "none");
const dRow = evalJson(paletteRowName(DRILL2));
ok("D4 the row keeps its old name", (dRow.text ?? "").includes(NAME_B2) && !(dRow.text ?? "").includes(NAME_B3), `row="${(dRow.text ?? "").slice(0, 60)}"`);
const seatsD = await seatsOf(host.jobId);
ok("D5 the server still holds the old name — the abort was the ONLY lie", seatsD.find((x) => x.id === DRILL2)?.name === NAME_B2, seatsD.find((x) => x.id === DRILL2)?.name ?? "missing");
ab('network unroute');
sleep(0.5);
/* the retry is one strike — the same pencil, no reload, no re-arm */
installToastObserver();
clickWhen(palettePencilClick(DRILL2));
sleep(0.8);
const dIn2 = evalJson(paletteInputProbe(DRILL2));
fillAndKey(`input[data-palette-savedview-rename-input="${DRILL2}"]`, NAME_B3, "Enter");
sleep(1.5);
const seatsD2 = await seatsOf(host.jobId);
ok("D6 after the abort lifts, the same pencil succeeds (one strike, no re-arm)", seatsD2.find((x) => x.id === DRILL2)?.name === NAME_B3, seatsD2.find((x) => x.id === DRILL2)?.name ?? "missing");
const dToast2 = await toastWait((t) => /view renamed/i.test(t) && t.includes(NAME_B3), 12);
ok("D7 the successful retry reports honestly too", !!dToast2, dToast2 ?? "none");
ab("press Escape");
sleep(1);

/* ---------- Face E: the silent exits (t674 E) ---------- */
console.log("Face E — the silent exits: empty and Escaped drafts change nothing and say nothing");
ab("press Control+k");
sleep(2.5);
const eOpen = waitFor("the palette for the silent exits", (m) => m.cmdkOpen === true, 12);
ok("E0 the palette opened for the silent exits", eOpen.cmdkOpen === true);
installToastObserver();
clickWhen(palettePencilClick(DRILL2));
sleep(0.8);
const eIn = evalJson(paletteInputProbe(DRILL2));
fillAndKey(`input[data-palette-savedview-rename-input="${DRILL2}"]`, "", "Enter");
sleep(1.2);
const eToasts = readToasts();
ok("E1 the empty draft changes nothing and says nothing (an edit that never happened is not a fact worth announcing)", eToasts.length === 0, eToasts.join(" | ") || "silent");
ok("E2 the server never saw the empty draft", (await seatsOf(host.jobId)).find((x) => x.id === DRILL2)?.name === NAME_B3);
clickWhen(palettePencilClick(DRILL2));
sleep(0.8);
const eIn2 = evalJson(paletteInputProbe(DRILL2));
fillAndKey(`input[data-palette-savedview-rename-input="${DRILL2}"]`, "t880 drill beta esc-draft", "Escape");
sleep(1.2);
const eToasts2 = readToasts();
ok("E3 the Escaped draft changes nothing and says nothing (the cancel flag, not the commit path)", eToasts2.length === 0, eToasts2.join(" | ") || "silent");
const ePaletteAlive = evalJson(MEASURE);
ok("E4 Esc canceled the EDIT, not the dialog (the input ate the Escape)", ePaletteAlive.cmdkOpen === true && ePaletteAlive.cmdkItems > 0, `${ePaletteAlive.cmdkItems} items`);
ok("E5 the server never saw the Escaped draft", (await seatsOf(host.jobId)).find((x) => x.id === DRILL2)?.name === NAME_B3);
ab("press Escape");
sleep(1);

/* ---------- Face F: the dupe warning (t674 F, the ids-are-not-names law) ---------- */
console.log("Face F — the dupe warning: a nudge, not a veto");
const seatsF0 = await seatsOf(host.jobId);
const dupeTarget = seatsF0.find((x) => x.id === "seedview1")?.name ?? seatsF0.find((x) => x.id !== DRILL2)?.name;
ok("F0 the dupe target read from the fresh list (ids are not names — the t674 lesson's own shape)", typeof dupeTarget === "string" && dupeTarget.length > 0, `target="${dupeTarget}"`);
ab("press Control+k");
sleep(2.5);
const fOpen = waitFor("the palette for the dupe drill", (m) => m.cmdkOpen === true, 12);
ok("F1 the palette opened for the dupe drill", fOpen.cmdkOpen === true);
installToastObserver();
clickWhen(palettePencilClick(DRILL2));
sleep(0.8);
fillAndKey(`input[data-palette-savedview-rename-input="${DRILL2}"]`, dupeTarget, "Enter");
sleep(1.5);
const fToast = await toastWait((t) => /already exists/i.test(t), 12);
ok("F2 renaming onto an existing sibling's NAME warns amber", !!fToast && /renamed anyway/i.test(fToast), fToast ?? "none");
const seatsF = await seatsOf(host.jobId);
ok("F3 the dupe rename still COMMITTED (a warning, not a veto)", seatsF.find((x) => x.id === DRILL2)?.name === dupeTarget, `server name = ${seatsF.find((x) => x.id === DRILL2)?.name ?? "missing"}`);
installToastObserver();
clickWhen(palettePencilClick(DRILL2));
sleep(0.8);
fillAndKey(`input[data-palette-savedview-rename-input="${DRILL2}"]`, NAME_BF, "Enter");
sleep(1.5);
const seatsF2 = await seatsOf(host.jobId);
ok("F4 the cleanup rename lands (the drill retires under a tell-apart name)", seatsF2.find((x) => x.id === DRILL2)?.name === NAME_BF, seatsF2.find((x) => x.id === DRILL2)?.name ?? "missing");
ab("press Escape");
sleep(1);

/* ---------- Face H: the home's own mouth (t673's core, the current shelf) ---------- */
console.log("Face H — the home mouth: the dance, the list, the pencil, the five exits");
setMarker("h-face");
const hDance = await dance(host.jobName, 5);
ok("H0 the 3D viewer is REALLY up (the shelf's load fingerprint speaks — 5 saved)", hDance.ok === true, hDance.ok ? `bmTrig="${hDance.measure.bmTrig}"` : "the ladder gave — recorded");
const hHome = settle("the home shelf");
if (corpse(hHome, "Face H")) process.exit(1);
const hFace = hHome;
clickWhen(bmTriggerClick);
sleep(1.2);
const hList = evalJson(bmListOpen);
ok("H1 the list opened (the row mouths exist — five rename pencils)", hList.pencils === 5, `pencils=${hList.pencils}`);
installToastObserver();
clickWhen(bmPencilClick(NAME_A2));
sleep(0.8);
const hIn = evalJson(bmInputProbe());
ok("H2 the pencil swaps the row for an input (the bm-rename wrapper — the input one level down, the t673 locator lesson)", hIn.present === true && hIn.seat === `bm-rename-${DRILL1}`, `seat=${hIn.seat ?? "??"}`);
ok("H3 the draft starts as the current name", hIn.value === NAME_A2, `value "${hIn.value}"`);
shot("shots-qa/t880-home-rename.png");
console.log("  (the home's rename shell archived)");
fillAndKey(`[data-testid="bm-rename-${DRILL1}"] input`, NAME_A3, "Enter");
sleep(1.5);
const hToast = await toastWait((t) => /view renamed/i.test(t) && t.includes(NAME_A3), 12);
ok("H4 the 'View renamed' toast lands", !!hToast, hToast ?? "none");
const seatsH = await seatsOf(host.jobId);
ok("H5 the server holds the new name", seatsH.find((x) => x.id === DRILL1)?.name === NAME_A3, seatsH.find((x) => x.id === DRILL1)?.name ?? "missing");
const hRow = evalJson(bmRowText(NAME_A3));
ok("H6 the row speaks the new name", hRow.present === true, hRow.text ?? "none");
/* the dupe: renaming onto the sibling's current name — warn AND commit */
await ensureBmList();
installToastObserver();
clickWhen(bmPencilClick(NAME_A3));
sleep(0.8);
fillAndKey(`[data-testid="bm-rename-${DRILL1}"] input`, NAME_BF, "Enter");
sleep(1.5);
const hDupeToast = await toastWait((t) => /already exists/i.test(t), 12);
ok("H7 the duplicate warning toast lands (warn AND commit — 'Saved anyway')", !!hDupeToast, hDupeToast ?? "none");
const seatsH2 = await seatsOf(host.jobId);
ok("H8 the duplicate name COMMITS (the contract warns, it does not block)", seatsH2.find((x) => x.id === DRILL1)?.name === NAME_BF, seatsH2.find((x) => x.id === DRILL1)?.name ?? "missing");
/* the cleanup rename — the drill retires under a tell-apart name */
await ensureBmList();
installToastObserver();
clickWhen(bmPencilClick(NAME_BF));
sleep(0.8);
fillAndKey(`[data-testid="bm-rename-${DRILL1}"] input`, NAME_A4, "Enter");
sleep(1.5);
const seatsH3 = await seatsOf(host.jobId);
ok("H9 the cleanup rename lands (the identity drill's own name)", seatsH3.find((x) => x.id === DRILL1)?.name === NAME_A4, seatsH3.find((x) => x.id === DRILL1)?.name ?? "missing");
/* Esc cancel — the flag, not the blur, decides */
await ensureBmList();
installToastObserver();
clickWhen(bmPencilClick(NAME_A4));
sleep(0.8);
const hIn2 = evalJson(bmInputProbe());
fillAndKey(`[data-testid="bm-rename-${DRILL1}"] input`, "esc should discard me", "Escape");
sleep(1.2);
const seatsH4 = await seatsOf(host.jobId);
ok("H10 the gesture ran (the input opened, Escape closed it)", hIn2.present === true && seatsH4.find((x) => x.id === DRILL1)?.name === NAME_A4, `seat=${hIn2.seat ?? "??"}`);
const hToastsE = readToasts();
ok("H11 zero rename toast in the window (the silent exit)", !hToastsE.some((t) => /view renamed/i.test(t)), hToastsE.find((t) => /view renamed/i.test(t)) ?? `${hToastsE.length} toasts since baseline, none rename`);
/* the two silent drafts */
await ensureBmList();
installToastObserver();
clickWhen(bmPencilClick(NAME_A4));
sleep(0.8);
fillAndKey(`[data-testid="bm-rename-${DRILL1}"] input`, "", "Enter");
sleep(1.2);
ok("H12 the empty draft commits nothing (silent)", (await seatsOf(host.jobId)).find((x) => x.id === DRILL1)?.name === NAME_A4);
ok("H13 the empty draft is silent — no toast", !readToasts().some((t) => /view renamed/i.test(t)));
await ensureBmList();
installToastObserver();
clickWhen(bmPencilClick(NAME_A4));
sleep(0.8);
fillAndKey(`[data-testid="bm-rename-${DRILL1}"] input`, NAME_A4, "Enter");
sleep(1.2);
ok("H14 the untouched draft commits nothing (silent)", (await seatsOf(host.jobId)).find((x) => x.id === DRILL1)?.name === NAME_A4);
ok("H15 the untouched draft is silent — no toast", !readToasts().some((t) => /view renamed/i.test(t)));

/* ---------- Face G: identity (t674 G) — the renamed view jumps & restores ---------- */
console.log("Face G — identity: the renamed view jumps and restores UNDER ITS NEW NAME");
backToDashboard();
installToastObserver();
ab("press Control+k");
sleep(2.5);
const gOpen = waitFor("the palette for the identity drill", (m) => m.cmdkOpen === true && m.svRows === 5, 12);
ok("G0 the palette opens for the identity drill (five rows)", gOpen.cmdkOpen === true && gOpen.svRows === 5, `rows=${gOpen.svRows}`);
const gRow = evalJson(paletteRowName(DRILL1));
ok("G1 the renamed drill row stands under its new name", (gRow.text ?? "").includes(NAME_A4), `row="${(gRow.text ?? "").slice(0, 60)}"`);
clickWhen(paletteRowClick(DRILL1));
sleep(1.2);
const g3 = evalJson(MEASURE);
ok("G2 the palette closes on jump", g3.cmdkOpen === false && g3.dlgCount >= 1, `cmdkOpen=${g3.cmdkOpen} dlgCount=${g3.dlgCount}`);
const gPending = evalJson('(() => JSON.stringify(sessionStorage.getItem("cryoflow:pending-view")))()');
ok("G3 the pending handshake carries the SAME id rename never touched", !!gPending && gPending.includes(DRILL1), (gPending ?? "").slice(0, 80)); /* the eval wraps the raw string in ANOTHER JSON.stringify — the quotes are escaped, the id itself is the honest witness (the first flight's own lesson: the ruler's wiring is the ruler) */
const gDance = await dance(host.jobName, 5);
ok("G4 the 3D viewer is REALLY up (the renamed view's jump mouth fully alive)", gDance.ok === true, gDance.ok ? `bmTrig="${gDance.measure.bmTrig}"` : "the ladder gave — recorded");
const gToast = await toastWait((t) => /restored/i.test(t) && t.includes(NAME_A4), 25);
ok("G5 the restored toast names the NEW name (identity survived every rename)", !!gToast, gToast ?? "none");
const gPendingAfter = evalJson('(() => JSON.stringify(sessionStorage.getItem("cryoflow:pending-view")))()');
ok("G6 the pending consumed (one-shot, the handshake's own law)", gPendingAfter === "null" || gPendingAfter === null, `pending=${gPendingAfter}`);

/* ---------- Face B: world back (the un-own law) ---------- */
console.log("Face B — the world back: drills swept, the trio byte-for-byte, the roster bit-for-bit");
backToDashboard();
const seatsEnd = await seatsOf(host.jobId);
await putSeats(host.jobId, TRIO_BYTES);
const finalSeats = await seatsOf(host.jobId);
ok("B1 the trio restored BYTE-FOR-BYTE (the exit's own pin — the un-own law)", JSON.stringify(finalSeats) === JSON.stringify(TRIO_BYTES), `bytes equal=${JSON.stringify(finalSeats) === JSON.stringify(TRIO_BYTES)}`);
const finalGallery = await galleryOf();
const galleryHost = finalGallery.find((v) => v.jobId === host.jobId);
ok("B2 the gallery route agrees with the shelf (three cards, one job row)", (galleryHost?.bookmarks ?? []).length === 3 && finalGallery.filter((v) => (v.bookmarks ?? []).length > 0).length === views2.length, `gallery rows=${finalGallery.filter((v) => (v.bookmarks ?? []).length > 0).length}`);
ok("B3 the roster bit-for-bit (bookmark mutations never touch the roster)", (await roster()).length === J0, `jobs=${J0}`);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "un-owned"; })()');
ab("open http://localhost:3000");
sleep(3);
const wB = settle("the restored canvas");
if (corpse(wB, "Face B")) process.exit(1);
ok("B4 the world unharmed (canvas count == the opening count, zero unnamed, no dialogs)", wB.pageBtns === OPEN && wB.pageUnnamed === 0 && wB.hasDlg === false, `btns=${wB.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => JSON.stringify(localStorage.getItem("cryoflow.selectedJob.v1")))()');
ok("B5 the ride leaves no session seed", seedAfter === '""' || seedAfter === "null", `seed=${seedAfter}`);
const pendingEnd = evalJson('(() => JSON.stringify(sessionStorage.getItem("cryoflow:pending-view")))()');
ok("B6 no pending lingers (every handshake consumed)", pendingEnd === "null" || pendingEnd === null, `pending=${pendingEnd}`);
const pageErrs = readPageErrors();
ok("B7 zero page errors (the PAGE's own listener — the t878 console-hygiene law)", pageErrs.length === 0, pageErrs.slice(0, 3).join(" | ") || "clean");

/* ---------- the ledger at birth (four faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (four faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  wallFace: ledgerFace(prevFaces ? prevFaces.wallFace?.live ?? null : null, w1s, scalarOf),
  paletteFace: ledgerFace(prevFaces ? prevFaces.paletteFace?.live ?? null : null, p2, scalarOf),
  homeFace: ledgerFace(prevFaces ? prevFaces.homeFace?.live ?? null : null, hFace, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, wB, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f, RECEIPT_REVISION);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the rename family's PORT holds on its first living host: the gallery route answered and the host was MEASURED (never pinned — the cmuwipe world is gone, the port refuses its pins); the wall's pencil rode the CURRENT shape — the named pencil + X pair behind the hover contract (the keyboard arm 0 -> 1 -> blur -> 0, the chevron yielding), the edit shell SPEAKING its contract ("Enter saves · Esc cancels"), the draft starting as the current name, Enter committing, toast + card + server agreeing; the palette's pencil rode cross-sync 1 (the palette already showed the WALL's new name — the broadcast reached the listening cache), the trio slot (the pencil beneath the yielding Mountain), the in-place commit without closing, the TTL-window reopen at the honest wire line, and cross-sync 2 (the wall heard the PALETTE's rename, the marker proving zero reloads); the ABORT drill rode the agent-browser route lane — the armed route made the rename say so ("Could not rename the view"), the row kept its old name, the server unchanged, and the lifted route's same pencil succeeded (one strike, no re-arm); the silent exits (empty + Escaped) changed nothing and said nothing, and Esc canceled the EDIT, not the dialog; the dupe onto a seed's REAL name (ids are not names) warned amber AND committed; the HOME mouth rode the current shelf — the dance to a REALLY-up viewer, the fingerprint rule, the bm-rename wrapper's input one level down, the happy rename, the dupe ("Saved anyway") committing, the cleanup, the Esc cancel (the flag, not the blur), the empty and untouched drafts silent — every exit t673 named, ridden live; and the IDENTITY drill closed the walk: the renamed view jumped via the palette row, the pending carrying the SAME id rename never touched, the viewer REALLY up, the restored toast naming the NEW name, the pending consumed one-shot; the exit swept the drills and PUT the trio back BYTE-FOR-BYTE (the exit's own pin), the roster bit-for-bit, the canvas ${OPEN} == ${OPEN}, no seed, no lingering pending, the page's own error listener at zero — the ledger aboard from birth (four faces, arm 1)`
  : `${fail} red — the rename family's port moved (or the ride left residue); call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: cmp.prev?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t880-rename-family.mjs",
  instrumentRevision: RECEIPT_REVISION,
  ruler: NAMEOF_LAW,
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> gallery route (the host measured) -> MOUNT the two drills -> the WALL PENCIL (the named pair, the keyboard reveal, the chevron yields, the edit shell speaks, the draft = the current name, Enter commits, toast + card + server agree) -> the PALETTE PENCIL (cross-sync 1, the trio slot, the in-place commit, the TTL reopen at the honest wire, cross-sync 2 by broadcast) -> the ABORT DRILL (the route armed, the refusal spoken, the old name kept, the retry lands) -> the SILENT EXITS (empty + Escaped, the dialog lives) -> the DUPE (a seed's real name, amber + commit, the cleanup) -> the HOME MOUTH (the dance, the fingerprint, the bm-rename input, the happy rename, the dupe 'Saved anyway', the cleanup, the Esc flag, the two silent drafts) -> the IDENTITY JUMP (the same id, the new name, the restored toast, the pending consumed) -> the drills swept -> the trio byte-for-byte -> worldBack + seed hygiene (one command)",
  doors: {
    seats: `GET/PUT /api/jobs/${host.jobId}/camera-bookmarks — the t707 headered lane (the drills' road in and out)`,
    wallPencil: `[data-saved-view-rename] / input[data-saved-view-rename-input] — the t674 floating chip, aria-labelled since the growth`,
    palettePencil: `[data-palette-savedview-rename] / input[data-palette-savedview-rename-input] — the t674 trio slot beneath the yielding Mountain`,
    homePencil: `button[aria-label="Rename bookmark …"] / [data-testid="bm-rename-{id}"] input — the t673 one-commit path (blur runs commitRename)`,
    abort: "agent-browser network route --abort / unroute — the playwright page.route's living successor, spiked live this window",
    palette: "Control+k -> [data-palette-savedview-row] — the jump body carrying pencil + X",
    pending: `${PENDING_KEY} { jobId, bookmarkId } — the one-shot handshake (the identity drill's wire)`,
    viewer: "the roster's open door -> Results (mousedown) -> the final-map tile -> View in 3D -> the shelf's load fingerprint (the t671 rule)",
    broadcast: "SAVED_VIEWS_CHANGED_EVENT — the cross-syncs' road (the marker witness: zero reloads)",
  },
  port: {
    from: "the t876 map's debt walks (t673 rename mouth, t674 rename wall+palette)",
    law: "the label-as-will law closed loop — the debt walks' surfaces are this instrument's own labels now",
    redrawn: [
      "the pencils carry aria-labels NOW (the shadowed wall pencil was data-attribute only)",
      "the wall's edit shell speaks its contract ('Enter saves · Esc cancels') and keeps the thumb",
      "the chevron/Mountain yields ride group-focus-within TOO — the keyboard arm is in the product at every surface",
      "the D-leg abort rides agent-browser network route --abort (the playwright successor)",
      "the home's rename input hands focus back to the row on every exit (t788's law)",
    ],
  },
  host: { id: host.jobId, name: host.jobName, type: host.jobType, measured: true },
  trio: { ids: TRIO_BYTES.map((s) => s.id), names: TRIO_BYTES.map((s) => s.name), bytesRestored: JSON.stringify(finalSeats) === JSON.stringify(TRIO_BYTES) },
  drills: [
    { id: DRILL1, name: DRILL1_NAME, fate: `mounted -> the wall's pencil (${NAME_A2}) -> the home's mouth (${NAME_A3}, the dupe onto its sibling, the cleanup ${NAME_A4}) -> the identity jump under ${NAME_A4}` },
    { id: DRILL2, name: DRILL2_NAME, fate: `mounted -> the palette's pencil (${NAME_B2}) -> the abort drill (${NAME_B3} refused, the retry landed) -> the silent exits -> the dupe onto a seed's real name -> the cleanup ${NAME_BF}` },
  ],
  nameLedger: { [DRILL1]: [DRILL1_NAME, NAME_A2, NAME_A3, NAME_BF, NAME_A4], [DRILL2]: [DRILL2_NAME, NAME_B2, NAME_B3, dupeTarget, NAME_BF] },
  identity: { pendingCarriedSameId: !!gPending && gPending.includes(`"${DRILL1}"`), restoredUnderNewName: !!gToast, pendingConsumed: gPendingAfter === "null" || gPendingAfter === null },
  abort: { refused: !!dFailToast, oldNameKept: seatsD.find((x) => x.id === DRILL2)?.name === NAME_B2, retryLanded: seatsD2.find((x) => x.id === DRILL2)?.name === NAME_B3 },
  broadcastWitness: { marker: "p-face", law: "the page instance never reloaded across the palette-to-wall cross-sync" },
  openingCanvas: OPEN,
  faces: {
    wallFace: { live: w1s },
    paletteFace: { live: p2 },
    homeFace: { live: hFace },
    worldBack: { live: wB },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2));

console.log(`\nRENAME-FAMILY t880: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
console.log(`  receipt: ${RECEIPT}`);
process.exit(fail === 0 ? 0 : 1);
